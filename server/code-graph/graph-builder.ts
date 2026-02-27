/**
 * Code Graph Builder
 *
 * Orchestrates: fetch repo tree → filter source files → parse in parallel → build knowledge graph.
 * Produces a CodeGraph with file nodes, symbol nodes, and dependency edges.
 */

import { getRepoTree, getFileContent } from './github-service';
import { parseFile } from './code-parser';
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

export async function buildCodeGraph(
  token: string,
  owner: string,
  repo: string,
  branch: string,
): Promise<CodeGraph> {
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
            });
          }
        }
      }

      // IMPORTS edges (file → file)
      for (const imp of parsed.imports) {
        const resolvedPath = resolveImportPath(path, imp.source, allPaths);
        if (resolvedPath) {
          const targetFileId = fileNodeMap.get(resolvedPath);
          if (targetFileId) {
            const edgeId = `edge:${fileNodeId}->imports:${targetFileId}`;
            // Avoid duplicate edges
            if (!edges.some(e => e.id === edgeId)) {
              edges.push({
                id: edgeId,
                source: fileNodeId,
                target: targetFileId,
                type: 'imports',
                weight: 0.5,
              });
            }
          }
        }
      }
    }
  }

  logger.info('Code graph built', {
    repo: `${owner}/${repo}`,
    nodes: nodes.length,
    edges: edges.length,
  });

  return {
    nodes,
    edges,
    repoOwner: owner,
    repoName: repo,
    branch,
    fetchedAt: new Date().toISOString(),
  };
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
