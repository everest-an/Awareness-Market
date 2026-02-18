import chalk from 'chalk';

export function header(text: string): string {
  return chalk.bold.cyan(text);
}

export function success(text: string): string {
  return chalk.green(text);
}

export function warn(text: string): string {
  return chalk.yellow(text);
}

export function error(text: string): string {
  return chalk.red(text);
}

export function dim(text: string): string {
  return chalk.dim(text);
}

export function label(key: string, value: string): string {
  return `  ${chalk.dim(key + ':')} ${value}`;
}

export function agentStatus(name: string, role: string, lastSeen?: string, context?: string): string {
  const statusColor = lastSeen ? chalk.green('●') : chalk.dim('○');
  const nameStr = chalk.bold(name.padEnd(14));
  const roleStr = chalk.dim(role.padEnd(12));
  const timeStr = lastSeen ? chalk.dim(`[${lastSeen}]`) : chalk.dim('[no activity]');
  const ctxStr = context ? ` ${chalk.white(context)}` : '';
  return `  ${statusColor} ${nameStr} ${roleStr} ${timeStr}${ctxStr}`;
}

export function contextEntry(time: string, agent: string, text: string): string {
  return `  ${chalk.dim(`[${time}]`)} ${chalk.cyan(agent + ':')} ${text}`;
}

export function box(title: string, lines: string[]): string {
  const width = Math.max(title.length + 4, ...lines.map(l => stripAnsi(l).length + 4));
  const top = chalk.dim('┌' + '─'.repeat(width) + '┐');
  const bottom = chalk.dim('└' + '─'.repeat(width) + '┘');
  const titleLine = chalk.dim('│ ') + chalk.bold(title) + ' '.repeat(width - title.length - 2) + chalk.dim(' │');
  const sep = chalk.dim('├' + '─'.repeat(width) + '┤');
  const bodyLines = lines.map(l => {
    const stripped = stripAnsi(l);
    const padding = Math.max(0, width - stripped.length - 2);
    return chalk.dim('│ ') + l + ' '.repeat(padding) + chalk.dim(' │');
  });
  return [top, titleLine, sep, ...bodyLines, bottom].join('\n');
}

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[\d+m/g, '').replace(/\x1B\[[\d;]*m/g, '');
}

export function divider(): string {
  return chalk.dim('─'.repeat(50));
}

export function timestamp(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}
