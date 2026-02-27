/**
 * GitHub Service — API calls + encrypted token storage
 *
 * Reuses the AES-256-GCM encryption pattern from provider-keys-service.ts.
 * Stores GitHub OAuth tokens encrypted per-user in the GitHubConnection table.
 */

import axios from 'axios';
import { encryptKey, decryptKey, maskKey } from '../provider-keys-service';
import { prisma } from '../db-prisma';
import { createLogger } from '../utils/logger';
import type { RepoSummary, GitHubConnectionStatus } from './types';

const logger = createLogger('GitHubService');
const GITHUB_API = 'https://api.github.com';
const CALLBACK_BASE_URL = process.env.OAUTH_CALLBACK_URL || 'http://localhost:3000';

// ─── Token Management ────────────────────────────────────────────────────────

export async function saveGitHubToken(
  userId: number,
  accessToken: string,
  githubUsername: string,
  githubId: number,
  scope: string,
): Promise<void> {
  const encrypted = encryptKey(accessToken);
  const mask = maskKey(accessToken);

  await prisma.gitHubConnection.upsert({
    where: { userId },
    create: {
      userId,
      encryptedToken: encrypted,
      tokenMask: mask,
      githubUsername,
      githubId,
      scope,
    },
    update: {
      encryptedToken: encrypted,
      tokenMask: mask,
      githubUsername,
      githubId,
      scope,
      isActive: true,
    },
  });

  logger.info('GitHub token saved', { userId, githubUsername });
}

export async function getGitHubToken(userId: number): Promise<string | null> {
  const conn = await prisma.gitHubConnection.findFirst({
    where: { userId, isActive: true },
  });
  if (!conn) return null;
  return decryptKey(conn.encryptedToken);
}

export async function getConnectionStatus(userId: number): Promise<GitHubConnectionStatus> {
  const conn = await prisma.gitHubConnection.findFirst({
    where: { userId, isActive: true },
  });
  if (!conn) {
    return { connected: false, username: null, tokenMask: null, scope: null };
  }
  return {
    connected: true,
    username: conn.githubUsername,
    tokenMask: conn.tokenMask,
    scope: conn.scope,
  };
}

export async function disconnectGitHub(userId: number): Promise<void> {
  await prisma.gitHubConnection.updateMany({
    where: { userId },
    data: { isActive: false },
  });
  logger.info('GitHub disconnected', { userId });
}

// ─── OAuth Token Exchange ────────────────────────────────────────────────────

export async function exchangeCodeForRepoToken(code: string): Promise<{
  access_token: string;
  scope: string;
}> {
  const response = await axios.post(
    'https://github.com/login/oauth/access_token',
    new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID || '',
      client_secret: process.env.GITHUB_CLIENT_SECRET || '',
      code,
      redirect_uri: `${CALLBACK_BASE_URL}/api/auth/callback/github-code-graph`,
    }).toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
    },
  );

  if (!response.data.access_token) {
    throw new Error(response.data.error_description || 'Failed to exchange code for token');
  }

  return {
    access_token: response.data.access_token,
    scope: response.data.scope || 'repo',
  };
}

export async function getGitHubUserFromToken(token: string): Promise<{
  login: string;
  id: number;
}> {
  const response = await axios.get(`${GITHUB_API}/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  return { login: response.data.login, id: response.data.id };
}

// ─── GitHub API Calls ────────────────────────────────────────────────────────

export async function listUserRepos(token: string): Promise<RepoSummary[]> {
  const response = await axios.get(`${GITHUB_API}/user/repos`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
    params: { sort: 'updated', per_page: 50, type: 'all' },
  });

  return response.data.map((r: any) => ({
    id: r.id,
    fullName: r.full_name,
    name: r.name,
    owner: r.owner.login,
    description: r.description,
    language: r.language,
    defaultBranch: r.default_branch,
    isPrivate: r.private,
    updatedAt: r.updated_at,
  }));
}

export async function getRepoTree(
  token: string,
  owner: string,
  repo: string,
  branch: string,
): Promise<Array<{ path: string; type: 'blob' | 'tree'; size?: number }>> {
  const response = await axios.get(
    `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    },
  );

  return response.data.tree
    .filter((item: any) => item.type === 'blob')
    .map((item: any) => ({ path: item.path, type: item.type, size: item.size }));
}

export async function getFileContent(
  token: string,
  owner: string,
  repo: string,
  path: string,
  branch: string,
): Promise<string> {
  const response = await axios.get(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.raw+json',
      },
    },
  );
  return typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
}

export async function getRepoInfo(
  token: string,
  owner: string,
  repo: string,
): Promise<{ defaultBranch: string }> {
  const response = await axios.get(`${GITHUB_API}/repos/${owner}/${repo}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  return { defaultBranch: response.data.default_branch };
}
