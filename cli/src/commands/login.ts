import * as readline from 'node:readline';
import chalk from 'chalk';
import ora from 'ora';
import { ApiClient } from '../lib/api-client.js';
import { loadConfig, saveConfig, clearConfig, isLoggedIn } from '../lib/config.js';

function prompt(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (hidden) {
      // For password, use raw mode if available
      process.stdout.write(question);
      let password = '';
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf-8');
        const onData = (ch: string) => {
          if (ch === '\r' || ch === '\n') {
            process.stdin.setRawMode(false);
            process.stdin.removeListener('data', onData);
            process.stdout.write('\n');
            rl.close();
            resolve(password);
          } else if (ch === '\u0003') {
            // Ctrl+C
            process.exit(0);
          } else if (ch === '\u007F' || ch === '\b') {
            // Backspace
            if (password.length > 0) {
              password = password.slice(0, -1);
              process.stdout.write('\b \b');
            }
          } else {
            password += ch;
            process.stdout.write('*');
          }
        };
        process.stdin.on('data', onData);
      } else {
        rl.question('', (answer) => {
          rl.close();
          resolve(answer);
        });
      }
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

export async function loginCommand(options: { server?: string }) {
  if (isLoggedIn()) {
    const config = loadConfig();
    console.log(chalk.dim(`Already logged in to ${config.apiUrl}`));
    const answer = await prompt('Log in again? (y/N) ');
    if (answer.toLowerCase() !== 'y') return;
  }

  const config = loadConfig();
  if (options.server) {
    config.apiUrl = options.server.replace(/\/$/, '');
    saveConfig(config);
  }

  console.log(chalk.bold('\nAwareness CLI Login\n'));
  console.log(chalk.dim(`Server: ${config.apiUrl}\n`));

  const email = await prompt('Email: ');
  const password = await prompt('Password: ', true);

  if (!email || !password) {
    console.log(chalk.red('Email and password are required'));
    return;
  }

  const spinner = ora('Authenticating...').start();
  try {
    const client = new ApiClient();
    const result = await client.login(email, password);

    saveConfig({
      ...config,
      token: result.accessToken,
      refreshToken: result.refreshToken,
      userId: result.user?.id,
    });

    spinner.succeed(chalk.green('Logged in successfully'));
    console.log(chalk.dim(`  User: ${result.user?.email || email}`));
    console.log(chalk.dim(`  Token stored at ~/.awareness/config.json\n`));
  } catch (err: any) {
    spinner.fail(chalk.red('Login failed'));
    console.log(chalk.dim(`  ${err.message}\n`));
  }
}

export async function logoutCommand() {
  clearConfig();
  console.log(chalk.green('Logged out. Token removed from ~/.awareness/config.json'));
}
