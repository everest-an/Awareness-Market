#!/usr/bin/env node

import { Command } from 'commander';
import { loginCommand, logoutCommand } from './commands/login.js';
import { initCommand } from './commands/init.js';
import { statusCommand } from './commands/status.js';
import { resumeCommand } from './commands/resume.js';
import { syncCommand } from './commands/sync.js';

const program = new Command();

program
  .name('awareness')
  .description('Manage multi-AI workspaces — stop re-explaining your codebase to AI')
  .version('0.1.0');

// Default command (no subcommand) → status
program
  .action(async () => {
    await statusCommand();
  });

program
  .command('login')
  .description('Authenticate with Awareness Market')
  .option('-s, --server <url>', 'Server URL (default: https://awareness.market)')
  .action(loginCommand);

program
  .command('logout')
  .description('Remove stored credentials')
  .action(logoutCommand);

program
  .command('init')
  .description('Scan project and create an AI workspace')
  .option('-f, --force', 'Reinitialize even if already configured')
  .action(initCommand);

program
  .command('status')
  .description('Show project brain — agents, context, decisions')
  .action(statusCommand);

program
  .command('resume')
  .description('Generate a session resume prompt to paste into your AI tool')
  .option('-c, --copy', 'Copy to clipboard (if supported)')
  .action(resumeCommand);

program
  .command('sync [direction]')
  .description('Sync context (push/pull/both). Default: both')
  .action(syncCommand);

program.parse();
