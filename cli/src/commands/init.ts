import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ApiClient } from '../lib/api-client.js';
import { loadConfig, saveConfig, isLoggedIn, saveProjectConfig, loadProjectConfig } from '../lib/config.js';
import { scanProject, mapToolsToAgents } from '../lib/scanner.js';
import * as fmt from '../lib/formatter.js';

/** MCP config file paths for each AI tool (project-level) */
const MCP_CONFIG_PATHS: Record<string, string> = {
  'Claude Code': '.claude/mcp_config.json',
  'Cursor':      '.cursor/mcp.json',
  'Windsurf':    '.windsurf/mcp.json',
  'Kiro':        '.kiro/mcp.json',
};

/**
 * Build the MCP server block for awareness-collab.
 */
function buildMcpServerEntry(apiUrl: string, mcpToken: string, role: string, memoryKey: string) {
  return {
    command: 'npx',
    args: ['-y', '@anthropic-ai/mcp-server-awareness-collab'],
    env: {
      VITE_APP_URL: apiUrl,
      MCP_COLLABORATION_TOKEN: mcpToken,
      AGENT_ROLE: role,
      MEMORY_KEY: memoryKey,
    },
  };
}

/**
 * Auto-inject awareness-collab MCP config into detected AI tool config files.
 * Merges with existing config if the file already exists.
 * Returns list of paths that were written.
 */
function injectMcpConfigs(
  detectedTools: string[],
  agents: Array<{ name: string; role: string; integration: string }>,
  apiUrl: string,
  mcpToken: string,
  workspaceId: string,
  cwd: string = process.cwd(),
): string[] {
  const written: string[] = [];

  for (const toolName of detectedTools) {
    const configRelPath = MCP_CONFIG_PATHS[toolName];
    if (!configRelPath) continue; // tool doesn't support MCP config (e.g. v0, Copilot, Aider)

    const agent = agents.find(a => a.name === toolName);
    const role = agent?.role || 'fullstack';
    const memoryKey = `workspace:${workspaceId}:dev`;
    const entry = buildMcpServerEntry(apiUrl, mcpToken, role, memoryKey);

    const configPath = path.join(cwd, configRelPath);
    const configDir = path.dirname(configPath);

    // Ensure directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Merge with existing config
    let existing: any = {};
    if (fs.existsSync(configPath)) {
      try {
        existing = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      } catch { /* overwrite if parse fails */ }
    }

    if (!existing.mcpServers) existing.mcpServers = {};
    existing.mcpServers['awareness-collab'] = entry;

    fs.writeFileSync(configPath, JSON.stringify(existing, null, 2) + '\n');
    written.push(configRelPath);
  }

  return written;
}

export async function initCommand(options: { force?: boolean }) {
  // Check if already initialized
  const existing = loadProjectConfig();
  if (existing && !options.force) {
    console.log(chalk.yellow('\nThis project is already connected to Awareness.'));
    console.log(fmt.label('Workspace', existing.workspaceId));
    console.log(fmt.label('Project', existing.projectName));
    console.log(chalk.dim('\n  Use --force to reinitialize\n'));
    return;
  }

  if (!isLoggedIn()) {
    console.log(chalk.red('\nNot logged in. Run `awareness login` first.\n'));
    return;
  }

  console.log(chalk.bold('\nawareness init\n'));

  // Step 1: Scan project
  const scanSpinner = ora('Scanning project...').start();
  const scan = scanProject();
  scanSpinner.succeed('Project scanned');

  console.log('');
  console.log(fmt.label('Name', chalk.white(scan.name)));
  console.log(fmt.label('Stack', scan.stack.length > 0 ? scan.stack.join(' + ') : chalk.dim('unknown')));
  console.log(fmt.label('Files', String(scan.fileCount)));
  if (scan.hasDatabase) {
    console.log(fmt.label('Database', scan.databaseType || 'detected'));
  }
  if (scan.recentCommits.length > 0) {
    console.log(fmt.label('Last commit', scan.lastCommitAge));
    console.log(fmt.label('Recent work', `${scan.recentCommits.length} commits`));
  }

  // Step 2: Detect AI tools
  console.log('');
  if (scan.detectedAITools.length > 0) {
    console.log(fmt.success(`  AI Tools detected: ${scan.detectedAITools.join(', ')}`));
  } else {
    console.log(chalk.dim('  No AI tool configs detected (you can add agents later)'));
  }

  // Step 3: Create workspace
  console.log('');
  const createSpinner = ora('Creating workspace...').start();

  try {
    const client = new ApiClient();
    const agents = scan.detectedAITools.length > 0
      ? mapToolsToAgents(scan.detectedAITools)
      : [{ name: 'Default Agent', role: 'fullstack', model: 'Custom', integration: 'rest' as const }];

    const result = await client.trpcMutate('workspace.create', {
      name: scan.name,
      description: `${scan.stack.join(' + ')} project${scan.hasDatabase ? ` with ${scan.databaseType || 'database'}` : ''}`,
      agents: agents.map(a => ({
        name: a.name,
        role: a.role,
        model: a.model,
        integration: a.integration,
        permissions: ['read', 'write'],
      })),
    });

    createSpinner.succeed('Workspace created');

    // Step 4: Store project brain as AI memory
    const brainSpinner = ora('Building project brain...').start();
    try {
      await client.setMemory(`workspace:${result.workspaceId}:project-brain`, {
        name: scan.name,
        stack: scan.stack,
        frameworks: scan.frameworks,
        recentCommits: scan.recentCommits.slice(0, 5),
        fileCount: scan.fileCount,
        hasDatabase: scan.hasDatabase,
        databaseType: scan.databaseType,
        detectedAITools: scan.detectedAITools,
        scannedAt: new Date().toISOString(),
      });
      brainSpinner.succeed('Project brain stored');
    } catch {
      brainSpinner.warn('Could not store project brain (non-critical)');
    }

    // Step 5: Save project config locally
    saveProjectConfig({
      workspaceId: result.workspaceId,
      mcpToken: result.mcpToken || '',
      projectName: scan.name,
      agents: agents.map(a => ({ name: a.name, role: a.role, integration: a.integration })),
      createdAt: new Date().toISOString(),
    });

    // Update global config with workspace ID and MCP token
    const config = loadConfig();
    config.workspaceId = result.workspaceId;
    if (result.mcpToken) config.mcpToken = result.mcpToken;
    saveConfig(config);

    // Step 6: Auto-inject MCP configs into detected AI tools
    let injectedPaths: string[] = [];
    if (result.mcpToken && scan.detectedAITools.length > 0) {
      const mcpSpinner = ora('Injecting MCP configs...').start();
      try {
        injectedPaths = injectMcpConfigs(
          scan.detectedAITools,
          agents,
          config.apiUrl,
          result.mcpToken,
          result.workspaceId,
        );
        if (injectedPaths.length > 0) {
          mcpSpinner.succeed(`MCP config injected into ${injectedPaths.length} tool(s)`);
        } else {
          mcpSpinner.info('No MCP-compatible tools to configure');
        }
      } catch {
        mcpSpinner.warn('Could not inject MCP configs (non-critical)');
      }
    }

    // Step 7: Print success
    console.log('');
    console.log(chalk.green.bold('  awareness knows your project!\n'));
    console.log(fmt.label('Project', chalk.white(scan.name)));
    console.log(fmt.label('Stack', scan.stack.join(' + ') || 'unknown'));
    if (scan.recentCommits.length > 0) {
      console.log(fmt.label('Recent', `${scan.recentCommits.length} recent commits`));
    }
    if (scan.detectedAITools.length > 0) {
      console.log(fmt.label('AI Tools', scan.detectedAITools.join(', ')));
    }
    console.log(fmt.label('Workspace', result.workspaceId));

    // Step 8: Show config instructions
    console.log('');
    console.log(chalk.dim('  Config saved to .ai-collaboration/awareness.json'));

    if (injectedPaths.length > 0) {
      console.log('');
      console.log(chalk.dim('  MCP configs written:'));
      for (const p of injectedPaths) {
        console.log(chalk.dim(`    + ${p}`));
      }
    }

    console.log('');
    console.log(chalk.dim('  Next steps:'));
    console.log(chalk.dim('  1. Run `awareness status` to see your project brain'));
    if (injectedPaths.length > 0) {
      console.log(chalk.dim('  2. Restart your AI tools to load the new MCP config'));
      console.log(chalk.dim('  3. Agents will auto-connect and appear in Control Center'));
    } else {
      console.log(chalk.dim('  2. Configure your AI tools with the workspace MCP config'));
      console.log(chalk.dim('     Visit your workspace settings page to get MCP configs'));
    }

    if (result.mcpToken) {
      console.log('');
      console.log(chalk.dim('  MCP Token (for manual config):'));
      console.log(chalk.dim(`    ${result.mcpToken.slice(0, 12)}...`));
    }

    console.log('');
  } catch (err: any) {
    createSpinner.fail('Failed to create workspace');
    console.log(chalk.red(`  ${err.message}\n`));
  }
}
