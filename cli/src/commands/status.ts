import chalk from 'chalk';
import ora from 'ora';
import { ApiClient } from '../lib/api-client.js';
import { loadConfig, isLoggedIn, loadProjectConfig } from '../lib/config.js';
import * as fmt from '../lib/formatter.js';

export async function statusCommand() {
  if (!isLoggedIn()) {
    console.log(chalk.red('\nNot logged in. Run `awareness login` first.\n'));
    return;
  }

  const config = loadConfig();
  const projectConfig = loadProjectConfig();
  const workspaceId = projectConfig?.workspaceId || config.workspaceId;

  if (!workspaceId) {
    console.log(chalk.yellow('\nNo workspace found. Run `awareness init` in your project directory.\n'));
    return;
  }

  const spinner = ora('Loading project brain...').start();

  try {
    const client = new ApiClient();

    // Fetch workspace details
    let workspace: any;
    try {
      workspace = await client.trpcQuery('workspace.get', { workspaceId });
    } catch {
      spinner.fail('Could not load workspace');
      console.log(chalk.dim('  The workspace may not exist or you may not have access.\n'));
      return;
    }

    // Fetch project brain from memory
    let brain: any = null;
    try {
      const memResult = await client.getMemory(`workspace:${workspaceId}:project-brain`);
      brain = memResult?.value;
    } catch { /* non-critical */ }

    // Fetch collaboration status
    let collabStatus: any = null;
    try {
      collabStatus = await client.collabGet('status', { workspace: `workspace:${workspaceId}` });
    } catch { /* collab API may not be configured */ }

    // Fetch recent context
    let context: any = null;
    try {
      context = await client.collabGet('context', { workspace: `workspace:${workspaceId}` });
    } catch { /* non-critical */ }

    spinner.stop();

    // Display
    const name = projectConfig?.projectName || workspace?.name || workspaceId;
    console.log('');
    console.log(chalk.bold.cyan(`  Project Brain: ${name}`));
    console.log(fmt.label('Workspace', workspaceId));
    if (brain?.stack) {
      console.log(fmt.label('Stack', Array.isArray(brain.stack) ? brain.stack.join(' + ') : brain.stack));
    }

    // Agents
    const agents = workspace?.agents || projectConfig?.agents || [];
    if (agents.length > 0) {
      console.log('');
      console.log(chalk.bold(`  Agents (${agents.length}):`));
      for (const agent of agents) {
        const lastActivity = agent.lastActivity || agent.lastSeen;
        const lastSeenStr = lastActivity ? fmt.timestamp(lastActivity) : undefined;
        console.log(fmt.agentStatus(
          agent.name,
          agent.role,
          lastSeenStr,
          agent.lastContext?.slice(0, 50),
        ));
      }
    }

    // Recent context
    const entries = context?.entries || context?.context || collabStatus?.recentContext || [];
    if (Array.isArray(entries) && entries.length > 0) {
      console.log('');
      console.log(chalk.bold('  Recent Context:'));
      for (const entry of entries.slice(0, 5)) {
        const time = entry.timestamp ? fmt.timestamp(entry.timestamp) : '';
        const agent = entry.agentRole || entry.agent || 'unknown';
        const text = entry.reasoning || entry.content || entry.task || '';
        if (text) {
          console.log(fmt.contextEntry(time, agent, text.slice(0, 60)));
        }
      }
    }

    // Decisions
    const decisions = collabStatus?.decisions || collabStatus?.recentDecisions || [];
    if (Array.isArray(decisions) && decisions.length > 0) {
      console.log('');
      console.log(chalk.bold('  Decisions:'));
      for (const dec of decisions.slice(0, 3)) {
        const proposer = dec.proposedBy || dec.agent || 'unknown';
        const status = dec.status || 'pending';
        const statusColor = status === 'accepted' ? chalk.green : status === 'rejected' ? chalk.red : chalk.yellow;
        console.log(`    ${chalk.dim('•')} ${chalk.white(dec.proposal || dec.decision || dec.content)}`);
        console.log(`      ${chalk.dim('by')} ${proposer} ${chalk.dim('|')} ${statusColor(status)}`);
      }
    }

    // Conflicts
    const conflicts = collabStatus?.conflicts || [];
    if (Array.isArray(conflicts) && conflicts.length > 0) {
      console.log('');
      console.log(chalk.bold.yellow('  Conflicts:'));
      for (const c of conflicts) {
        console.log(`    ${chalk.yellow('⚠')} ${c.description || c.message || JSON.stringify(c)}`);
      }
    } else {
      console.log('');
      console.log(chalk.dim('  No conflicts detected.'));
    }

    console.log('');
  } catch (err: any) {
    spinner.fail('Failed to load status');
    console.log(chalk.red(`  ${err.message}\n`));
  }
}
