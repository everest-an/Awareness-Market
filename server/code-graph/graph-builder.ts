/**
 * Code Graph Builder
 *
 * Orchestrates: fetch repo tree → filter source files → parse in parallel → build knowledge graph.
 * Produces a CodeGraph with file nodes, symbol nodes, dependency edges, communities, and processes.
 * Includes confidence scoring on all edges and in-memory caching (30min TTL).
 */

import { getRepoTree, getFileContent } from './github-service';
import { parseFile } from './code-parser';
import { detectCommunities } from './community-detector';
import { detectProcesses } from './process-detector';
import type { CodeGraph, CodeNode, CodeEdge } from './types';
import { createLogger } from '../utils/logger';

const logger = createLogger('GraphBuilder');

const PARSEABLE_EXTENSIONS = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'py']);
const SKIP_DIRS = new Set([
  'node_modules', 'dist', '.git', '.next', 'build', 'coverage',
  '__pycache__', '.cache', '.turbo', '.vercel', 'vendor',
]);
const MAX_FILES_TO_PARSE = 150;
const MAX_FILE_SIZE = 50_000; // 50KB
const CONCURRENCY = 5;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ─── Graph Cache ──────────────────────────────────────────────────────────

interface CacheEntry {
  graph: CodeGraph;
  expiresAt: number;
}

const graphCache = new Map<string, CacheEntry>();

export function getCachedGraph(owner: string, repo: string): CodeGraph | null {
  const key = `${owner}/${repo}`;
  const entry = graphCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    graphCache.delete(key);
    return null;
  }
  return entry.graph;
}

function cacheGraph(owner: string, repo: string, graph: CodeGraph): void {
  const key = `${owner}/${repo}`;
  graphCache.set(key, { graph, expiresAt: Date.now() + CACHE_TTL });
  // Evict old entries (max 20 cached repos)
  if (graphCache.size > 20) {
    const oldest = [...graphCache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
    if (oldest) graphCache.delete(oldest[0]);
  }
}

// ─── Build Graph ──────────────────────────────────────────────────────────

export async function buildCodeGraph(
  token: string,
  owner: string,
  repo: string,
  branch: string,
): Promise<CodeGraph> {
  // Check cache first
  const cached = getCachedGraph(owner, repo);
  if (cached && cached.branch === branch) return cached;

  // 1. Get full repo tree
  const tree = await getRepoTree(token, owner, repo, branch);

  // 2. Filter to parseable source files
  const sourceFiles = tree
    .filter(f => {
      const ext = f.path.split('.').pop()?.toLowerCase();
      if (!ext || !PARSEABLE_EXTENSIONS.has(ext)) return false;
      const parts = f.path.split('/');
      return !parts.some(p => SKIP_DIRS.has(p));
    })
    .filter(f => !f.size || f.size <= MAX_FILE_SIZE)
    .slice(0, MAX_FILES_TO_PARSE);

  logger.info('Building code graph', {
    repo: `${owner}/${repo}`,
    totalFiles: tree.length,
    sourceFiles: sourceFiles.length,
  });

  const nodes: CodeNode[] = [];
  const edges: CodeEdge[] = [];
  const fileNodeMap = new Map<string, string>(); // path → nodeId
  const allPaths = sourceFiles.map(f => f.path);

  // Track imports per file for call resolution
  const fileImports = new Map<string, Map<string, string>>(); // filePath → (importedName → resolvedFilePath)

  // 3. Create file nodes
  for (const file of sourceFiles) {
    const nodeId = `file:${file.path}`;
    const dir = file.path.includes('/')
      ? file.path.substring(0, file.path.lastIndexOf('/') + 1)
      : '/';
    const ext = file.path.split('.').pop()?.toLowerCase() || '';
    const lang = langFromExt(ext);

    nodes.push({
      id: nodeId,
      type: 'file',
      label: file.path.split('/').pop() || file.path,
      filePath: file.path,
      directory: dir,
      language: lang,
    });
    fileNodeMap.set(file.path, nodeId);
  }

  // 4. Fetch + parse files in batches
  for (let i = 0; i < sourceFiles.length; i += CONCURRENCY) {
    const batch = sourceFiles.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async file => {
        const content = await getFileContent(token, owner, repo, file.path, branch);
        return { path: file.path, content };
      }),
    );

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const { path, content } = result.value;
      const fileNodeId = fileNodeMap.get(path)!;
      const dir = path.includes('/') ? path.substring(0, path.lastIndexOf('/') + 1) : '/';
      const ext = path.split('.').pop()?.toLowerCase() || '';
      const lang = langFromExt(ext);

      const parsed = parseFile(content, path);

      // Build import map for this file (importedName → resolved file path)
      const importMap = new Map<string, string>();
      for (const imp of parsed.imports) {
        const resolvedPath = resolveImportPath(path, imp.source, allPaths);
        if (resolvedPath) {
          for (const name of imp.names) {
            importMap.set(name, resolvedPath);
          }
        }
      }
      fileImports.set(path, importMap);

      // Create symbol nodes + DEFINED_IN edges
      for (const sym of parsed.symbols) {
        const symbolId = `${sym.type}:${path}::${sym.name}`;
        nodes.push({
          id: symbolId,
          type: sym.type as CodeNode['type'],
          label: sym.type === 'function' ? `${sym.name}()` : sym.name,
          filePath: path,
          directory: dir,
          language: lang,
          lineStart: sym.lineStart,
        });

        edges.push({
          id: `edge:${symbolId}->${fileNodeId}`,
          source: symbolId,
          target: fileNodeId,
          type: 'defined_in',
          weight: 0.3,
          confidence: 1.0,
          reason: 'structural',
        });

        // EXTENDS edge
        if (sym.extends) {
          const extNode = nodes.find(
            n => n.label === sym.extends || n.label === `${sym.extends}()`,
          );
          if (extNode) {
            edges.push({
              id: `edge:${symbolId}->extends:${extNode.id}`,
              source: symbolId,
              target: extNode.id,
              type: 'extends',
              weight: 0.7,
              confidence: 0.9,
              reason: 'heritage',
            });
          }
        }
      }

      // IMPORTS edges (file → file) with confidence
      for (const imp of parsed.imports) {
        const resolvedPath = resolveImportPath(path, imp.source, allPaths);
        if (resolvedPath) {
          const targetFileId = fileNodeMap.get(resolvedPath);
          if (targetFileId) {
            const edgeId = `edge:${fileNodeId}->imports:${targetFileId}`;
            if (!edges.some(e => e.id === edgeId)) {
              edges.push({
                id: edgeId,
                source: fileNodeId,
                target: targetFileId,
                type: 'imports',
                weight: 0.5,
                confidence: 0.95,
                reason: 'import-statement',
              });
            }
          }
        }
      }

      // CALLS edges — resolve function calls with confidence scoring
      const localSymbols = parsed.symbols.filter(s => s.type === 'function' || s.type === 'class');
      const localNames = new Set(localSymbols.map(s => s.name));

      for (const call of parsed.calls) {
        const calleeName = call.calleeName;
        let targetNode: CodeNode | undefined;
        let confidence: number;
        let reason: string;

        // Priority 1: imported symbol → high confidence
        const importedFromPath = importMap.get(calleeName);
        if (importedFromPath) {
          targetNode = nodes.find(
            n => n.filePath === importedFromPath &&
              (n.label === calleeName || n.label === `${calleeName}()`) &&
              n.type !== 'file',
          );
          confidence = 0.9;
          reason = 'import-resolved';
        }
        // Priority 2: same-file symbol
        else if (localNames.has(calleeName)) {
          targetNode = nodes.find(
            n => n.filePath === path &&
              (n.label === calleeName || n.label === `${calleeName}()`) &&
              n.type !== 'file',
          );
          confidence = 0.85;
          reason = 'same-file';
        }
        // Priority 3: fuzzy global match
        else {
          const globalMatches = nodes.filter(
            n => (n.label === calleeName || n.label === `${calleeName}()`) && n.type !== 'file',
          );
          if (globalMatches.length === 1) {
            targetNode = globalMatches[0];
            confidence = 0.5;
            reason = 'fuzzy-global-single';
          } else if (globalMatches.length > 1) {
            // Pick the one in the closest directory
            targetNode = globalMatches[0];
            confidence = 0.3;
            reason = 'fuzzy-global-multiple';
          } else {
            continue; // No match found
          }
        }

        if (!targetNode) continue;

        // Find caller symbol (function containing this call line)
        const callerSym = parsed.symbols
          .filter(s => s.type === 'function')
          .sort((a, b) => b.lineStart - a.lineStart)
          .find(s => s.lineStart <= call.line);

        const sourceId = callerSym
          ? `function:${path}::${callerSym.name}`
          : fileNodeId;

        // Skip self-calls and duplicate edges
        if (sourceId === targetNode.id) continue;
        const callEdgeId = `edge:${sourceId}->calls:${targetNode.id}`;
        if (edges.some(e => e.id === callEdgeId)) continue;

        edges.push({
          id: callEdgeId,
          source: sourceId,
          target: targetNode.id,
          type: 'calls',
          weight: confidence * 0.6,
          confidence,
          reason,
        });
      }
    }
  }

  // 5. Detect communities
  const communities = detectCommunities(nodes, edges);

  // Assign community IDs to nodes
  for (const community of communities) {
    for (const memberId of community.memberIds) {
      const node = nodes.find(n => n.id === memberId);
      if (node) node.communityId = community.id;
    }
  }

  // 6. Detect execution flows
  const processes = detectProcesses(nodes, edges, communities);

  logger.info('Code graph built', {
    repo: `${owner}/${repo}`,
    nodes: nodes.length,
    edges: edges.length,
    communities: communities.length,
    processes: processes.length,
  });

  const graph: CodeGraph = {
    nodes,
    edges,
    communities,
    processes,
    repoOwner: owner,
    repoName: repo,
    branch,
    fetchedAt: new Date().toISOString(),
  };

  // Cache the result
  cacheGraph(owner, repo, graph);

  return graph;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveImportPath(
  currentFile: string,
  importSource: string,
  allPaths: string[],
): string | null {
  // Skip package/bare imports
  if (!importSource.startsWith('.')) return null;

  const currentDir = currentFile.substring(0, currentFile.lastIndexOf('/'));
  const parts = importSource.split('/');
  let resolved = currentDir;

  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') {
      resolved = resolved.substring(0, resolved.lastIndexOf('/'));
    } else {
      resolved = `${resolved}/${part}`;
    }
  }

  // Try extensions
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];
  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (allPaths.includes(candidate)) return candidate;
  }

  if (allPaths.includes(resolved)) return resolved;
  return null;
}

function langFromExt(ext: string): string {
  if (['ts', 'tsx'].includes(ext)) return 'typescript';
  if (['js', 'jsx', 'mjs'].includes(ext)) return 'javascript';
  if (ext === 'py') return 'python';
  return ext;
}
