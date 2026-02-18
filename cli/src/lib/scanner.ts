import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

export interface ProjectScan {
  name: string;
  stack: string[];
  recentCommits: string[];
  detectedAITools: string[];
  fileCount: number;
  lastCommitAge: string;
  hasDatabase: boolean;
  databaseType?: string;
  frameworks: string[];
}

const AI_TOOL_SIGNATURES: Array<{ name: string; paths: string[]; configKeys?: string[] }> = [
  { name: 'Cursor', paths: ['.cursor', '.cursorignore', '.cursorrules'] },
  { name: 'Windsurf', paths: ['.windsurf', '.windsurfrules'] },
  { name: 'Kiro', paths: ['.kiro'] },
  { name: 'Claude Code', paths: ['.claude', 'claude_desktop_config.json', 'CLAUDE.md'] },
  { name: 'v0', paths: ['.v0'] },
  { name: 'Manus', paths: ['.manus'] },
  { name: 'GitHub Copilot', paths: ['.github/copilot'] },
  { name: 'Aider', paths: ['.aider.conf.yml', '.aider'] },
];

export function scanProject(cwd: string = process.cwd()): ProjectScan {
  const stack: string[] = [];
  const frameworks: string[] = [];

  // Read package.json
  let name = path.basename(cwd);
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      name = pkg.name || name;
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      // Detect stack
      if (allDeps['react']) { stack.push('React'); frameworks.push('React'); }
      if (allDeps['vue']) { stack.push('Vue'); frameworks.push('Vue'); }
      if (allDeps['next']) { stack.push('Next.js'); frameworks.push('Next.js'); }
      if (allDeps['express']) { stack.push('Express'); frameworks.push('Express'); }
      if (allDeps['fastify']) { stack.push('Fastify'); frameworks.push('Fastify'); }
      if (allDeps['@prisma/client'] || allDeps['prisma']) stack.push('Prisma');
      if (allDeps['drizzle-orm']) stack.push('Drizzle');
      if (allDeps['mongoose']) stack.push('MongoDB');
      if (allDeps['pg'] || allDeps['postgres']) stack.push('PostgreSQL');
      if (allDeps['typescript']) stack.push('TypeScript');
      if (allDeps['tailwindcss']) stack.push('Tailwind');
      if (allDeps['vite']) stack.push('Vite');
      if (allDeps['@trpc/server']) stack.push('tRPC');
    } catch { /* ignore parse errors */ }
  }

  // Detect Python
  if (fs.existsSync(path.join(cwd, 'requirements.txt')) || fs.existsSync(path.join(cwd, 'pyproject.toml'))) {
    stack.push('Python');
  }

  // Detect database
  let hasDatabase = false;
  let databaseType: string | undefined;
  if (fs.existsSync(path.join(cwd, 'prisma', 'schema.prisma'))) {
    hasDatabase = true;
    try {
      const schema = fs.readFileSync(path.join(cwd, 'prisma', 'schema.prisma'), 'utf-8');
      if (schema.includes('postgresql')) databaseType = 'PostgreSQL';
      else if (schema.includes('mysql')) databaseType = 'MySQL';
      else if (schema.includes('sqlite')) databaseType = 'SQLite';
    } catch { /* ignore */ }
  }

  // Git recent commits
  let recentCommits: string[] = [];
  let lastCommitAge = 'unknown';
  try {
    const log = execSync('git log --oneline -10', { cwd, encoding: 'utf-8', timeout: 5000 });
    recentCommits = log.trim().split('\n').filter(Boolean);

    const lastDate = execSync('git log -1 --format=%cr', { cwd, encoding: 'utf-8', timeout: 5000 }).trim();
    lastCommitAge = lastDate;
  } catch { /* not a git repo or git not available */ }

  // Detect AI tools
  const detectedAITools: string[] = [];
  for (const tool of AI_TOOL_SIGNATURES) {
    for (const p of tool.paths) {
      if (fs.existsSync(path.join(cwd, p))) {
        detectedAITools.push(tool.name);
        break;
      }
    }
  }

  // Count files (rough estimate, skip node_modules)
  let fileCount = 0;
  try {
    const countCmd = process.platform === 'win32'
      ? 'git ls-files | wc -l'
      : 'git ls-files | wc -l';
    const count = execSync(countCmd, { cwd, encoding: 'utf-8', timeout: 5000 }).trim();
    fileCount = parseInt(count) || 0;
  } catch {
    fileCount = 0;
  }

  return {
    name,
    stack,
    recentCommits,
    detectedAITools,
    fileCount,
    lastCommitAge,
    hasDatabase,
    databaseType,
    frameworks,
  };
}

// Map detected AI tools to workspace agent presets
export function mapToolsToAgents(tools: string[]): Array<{ name: string; role: string; model: string; integration: 'mcp' | 'rest' }> {
  const mapping: Record<string, { role: string; model: string; integration: 'mcp' | 'rest' }> = {
    'Claude Code': { role: 'backend', model: 'Claude (Anthropic)', integration: 'mcp' },
    'Cursor': { role: 'fullstack', model: 'Cursor', integration: 'mcp' },
    'Windsurf': { role: 'fullstack', model: 'Windsurf', integration: 'mcp' },
    'Kiro': { role: 'architect', model: 'Kiro (AWS)', integration: 'mcp' },
    'v0': { role: 'frontend', model: 'v0 (Vercel)', integration: 'rest' },
    'Manus': { role: 'reviewer', model: 'Manus', integration: 'mcp' },
    'GitHub Copilot': { role: 'assistant', model: 'GitHub Copilot', integration: 'rest' },
    'Aider': { role: 'fullstack', model: 'Aider', integration: 'rest' },
  };

  // Avoid duplicate roles
  const usedRoles = new Set<string>();
  return tools
    .filter(t => mapping[t])
    .map(t => {
      let role = mapping[t].role;
      if (usedRoles.has(role)) {
        role = `${role}-${t.toLowerCase().replace(/\s+/g, '-')}`;
      }
      usedRoles.add(role);
      return { name: t, role, model: mapping[t].model, integration: mapping[t].integration };
    });
}
