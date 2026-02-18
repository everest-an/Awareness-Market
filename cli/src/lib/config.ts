import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface AwarenessConfig {
  apiUrl: string;
  token?: string;
  refreshToken?: string;
  userId?: number;
  workspaceId?: string;
  mcpToken?: string;
  lastSync?: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.awareness');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Project-level config
const PROJECT_DIR = '.ai-collaboration';
const PROJECT_CONFIG_FILE = 'awareness.json';

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): AwarenessConfig {
  ensureConfigDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    return { apiUrl: 'https://awareness.market' };
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return { apiUrl: 'https://awareness.market' };
  }
}

export function saveConfig(config: AwarenessConfig) {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function clearConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    fs.unlinkSync(CONFIG_FILE);
  }
}

export function isLoggedIn(): boolean {
  const config = loadConfig();
  return !!config.token;
}

// Project-level config (stored in .ai-collaboration/awareness.json)
export interface ProjectConfig {
  workspaceId: string;
  mcpToken: string;
  projectName: string;
  agents: Array<{ name: string; role: string; integration: string }>;
  createdAt: string;
}

export function loadProjectConfig(cwd: string = process.cwd()): ProjectConfig | null {
  const filePath = path.join(cwd, PROJECT_DIR, PROJECT_CONFIG_FILE);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

export function saveProjectConfig(config: ProjectConfig, cwd: string = process.cwd()) {
  const dir = path.join(cwd, PROJECT_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(path.join(dir, PROJECT_CONFIG_FILE), JSON.stringify(config, null, 2));
}
