import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'node:child_process';
import { ApiClient } from '../lib/api-client.js';
import { loadConfig, isLoggedIn, loadProjectConfig } from '../lib/config.js';
import * as fmt from '../lib/formatter.js';

export async function syncCommand(direction: string | undefined) {
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

  const client = new ApiClient();

  if (direction === 'push') {
    await pushContext(client, workspaceId);
  } else if (direction === 'pull') {
    await pullContext(client, workspaceId);
  } else {
    // Default: push current state then pull latest
    await pushContext(client, workspaceId);
    console.log('');
    await pullContext(client, workspaceId);
  }
}

async function pushContext(client: ApiClient, workspaceId: string) {
  const spinner = ora('Pushing local context...').start();

  try {
    // Gather git status
    let gitDiff = '';
    let branch = '';
    try {
      branch = execSync('git branch --show-current', { encoding: 'utf-8', timeout: 5000 }).trim();
      gitDiff = execSync('git diff --stat HEAD', { encoding: 'utf-8', timeout: 5000 }).trim();
    } catch { /* not a git repo */ }

    const summary = [
      branch ? `Branch: ${branch}` : '',
      gitDiff ? `Changes:\n${gitDiff}` : 'No uncommitted changes',
    ].filter(Boolean).join('\n');

    // Parse modified files from git diff --stat output
    const modifiedFiles = gitDiff
      ? gitDiff.split('\n').slice(0, -1).map(l => l.trim().split('|')[0].trim()).filter(Boolean)
      : [];

    await client.collabPost('progress', {
      workspace: workspaceId,
      role: 'cli',
      completedTasks: ['Manual sync from CLI'],
      currentTask: branch ? `Working on branch: ${branch}` : undefined,
      filesModified: modifiedFiles.length > 0 ? modifiedFiles : undefined,
    });

    spinner.succeed('Context pushed');
    if (branch) console.log(fmt.label('Branch', branch));
    if (gitDiff) {
      const fileCount = gitDiff.split('\n').length - 1; // last line is summary
      console.log(fmt.label('Changes', `${fileCount} files`));
    }
  } catch (err: any) {
    spinner.fail('Push failed');
    console.log(chalk.dim(`  ${err.message}`));
  }
}

async function pullContext(client: ApiClient, workspaceId: string) {
  const spinner = ora('Pulling remote context...').start();

  try {
    const context = await client.collabGet('context', {
      workspace: workspaceId,
    });

    const entries = context?.entries || context?.context || [];
    spinner.succeed(`Pulled ${entries.length} context entries`);

    if (entries.length > 0) {
      console.log('');
      console.log(chalk.bold('  Latest from other agents:'));
      for (const entry of entries.slice(0, 5)) {
        const agent = entry.agentRole || entry.agent || 'unknown';
        const text = entry.reasoning || entry.content || entry.task || '';
        const time = entry.timestamp ? fmt.timestamp(entry.timestamp) : '';
        if (text) {
          console.log(fmt.contextEntry(time, agent, text.slice(0, 60)));
        }
      }
    } else {
      console.log(chalk.dim('  No context from other agents yet.'));
    }
  } catch (err: any) {
    spinner.fail('Pull failed');
    console.log(chalk.dim(`  ${err.message}`));
  }

  console.log('');
}
