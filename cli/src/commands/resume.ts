import chalk from 'chalk';
import ora from 'ora';
import { ApiClient } from '../lib/api-client.js';
import { loadConfig, isLoggedIn, loadProjectConfig } from '../lib/config.js';
import * as fmt from '../lib/formatter.js';

export async function resumeCommand(options: { copy?: boolean }) {
  if (!isLoggedIn()) {
    console.log(chalk.red('\nNot logged in. Run `awareness login` first.\n'));
    return;
  }

  const config = loadConfig();
  const projectConfig = loadProjectConfig();
  const workspaceId = projectConfig?.workspaceId || config.workspaceId;

  if (!workspaceId) {
    console.log(chalk.yellow('\nNo workspace found. Run `awareness init` first.\n'));
    return;
  }

  const spinner = ora('Generating session resume...').start();

  try {
    const client = new ApiClient();

    // Gather all info
    let workspace: any;
    try {
      workspace = await client.trpcQuery('workspace.get', { workspaceId });
    } catch {
      spinner.fail('Could not load workspace');
      return;
    }

    let brain: any = null;
    try {
      const mem = await client.getMemory(`workspace:${workspaceId}:project-brain`);
      brain = mem?.value;
    } catch { /* non-critical */ }

    let context: any = null;
    try {
      context = await client.collabGet('context', { workspace: workspaceId });
    } catch { /* non-critical */ }

    let collabStatus: any = null;
    try {
      collabStatus = await client.collabGet('status', { workspace: workspaceId });
    } catch { /* non-critical */ }

    spinner.stop();

    // Build markdown resume
    const name = projectConfig?.projectName || workspace?.name || workspaceId;
    const now = new Date().toISOString().split('T')[0];
    const agents = workspace?.agents || projectConfig?.agents || [];
    const entries = context?.entries || context?.context || [];
    const decisions = collabStatus?.decisions || [];

    const lines: string[] = [];
    lines.push(`## Session Resume - ${name}`);
    lines.push(`**Date**: ${now}`);
    lines.push('');

    // Stack info
    if (brain?.stack) {
      const stack = Array.isArray(brain.stack) ? brain.stack.join(' + ') : brain.stack;
      lines.push(`**Stack**: ${stack}`);
      if (brain.databaseType) lines.push(`**Database**: ${brain.databaseType}`);
      lines.push('');
    }

    // What happened
    if (entries.length > 0) {
      lines.push('### What happened:');
      for (const entry of entries.slice(0, 10)) {
        const agent = entry.agentRole || entry.agent || 'Agent';
        const text = entry.reasoning || entry.content || entry.task || '';
        if (text) {
          lines.push(`- **${agent}**: ${text}`);
        }
      }
      lines.push('');
    }

    // Decisions
    if (decisions.length > 0) {
      lines.push('### Decisions:');
      for (const dec of decisions.slice(0, 5)) {
        const proposer = dec.proposedBy || dec.agent || 'unknown';
        const status = dec.status || 'pending';
        const text = dec.proposal || dec.decision || dec.content || '';
        lines.push(`- ${text} (${status}, by ${proposer})`);
      }
      lines.push('');
    }

    // Active agents
    if (agents.length > 0) {
      lines.push('### Active agents:');
      for (const a of agents) {
        lines.push(`- **${a.name}** (${a.role})`);
      }
      lines.push('');
    }

    // Context note
    lines.push('### Instructions:');
    lines.push('Continue from where the team left off. Check the decisions above and coordinate with other agents through Awareness.');
    lines.push('');

    const markdown = lines.join('\n');

    // Output
    console.log('');
    console.log(chalk.bold.cyan('  Session Resume Generated\n'));
    console.log(chalk.dim('  ─'.repeat(25)));
    console.log('');
    console.log(markdown);
    console.log(chalk.dim('  ─'.repeat(25)));
    console.log('');
    console.log(chalk.dim('  Copy the above markdown and paste it into your AI tool to resume context.'));
    console.log('');
  } catch (err: any) {
    spinner.fail('Failed to generate resume');
    console.log(chalk.red(`  ${err.message}\n`));
  }
}
