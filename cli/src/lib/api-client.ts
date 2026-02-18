import { loadConfig } from './config.js';

export class ApiClient {
  private apiUrl: string;
  private token: string | undefined;
  private mcpToken: string | undefined;

  constructor() {
    const config = loadConfig();
    this.apiUrl = config.apiUrl.replace(/\/$/, '');
    this.token = config.token;
    this.mcpToken = config.mcpToken;
  }

  private get authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  // tRPC query (GET)
  async trpcQuery<T = any>(procedure: string, input?: any): Promise<T> {
    const url = new URL(`${this.apiUrl}/api/trpc/${procedure}`);
    if (input !== undefined) {
      url.searchParams.set('input', JSON.stringify({ json: input }));
    }
    const res = await fetch(url.toString(), { headers: this.authHeaders });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`tRPC query ${procedure} failed (${res.status}): ${text}`);
    }
    const data = await res.json();
    return data?.result?.data?.json ?? data?.result?.data ?? data;
  }

  // tRPC mutation (POST)
  async trpcMutate<T = any>(procedure: string, input?: any): Promise<T> {
    const res = await fetch(`${this.apiUrl}/api/trpc/${procedure}`, {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify({ json: input }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`tRPC mutation ${procedure} failed (${res.status}): ${text}`);
    }
    const data = await res.json();
    return data?.result?.data?.json ?? data?.result?.data ?? data;
  }

  // REST collab endpoints
  async collabGet(path: string, params?: Record<string, string>): Promise<any> {
    const url = new URL(`${this.apiUrl}/api/collab/${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }
    const headers: Record<string, string> = { ...this.authHeaders };
    if (this.mcpToken) {
      headers['X-MCP-Token'] = this.mcpToken;
    }
    const res = await fetch(url.toString(), { headers });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Collab GET ${path} failed (${res.status}): ${text}`);
    }
    return res.json();
  }

  async collabPost(path: string, body: any): Promise<any> {
    const headers: Record<string, string> = { ...this.authHeaders };
    if (this.mcpToken) {
      headers['X-MCP-Token'] = this.mcpToken;
    }
    const res = await fetch(`${this.apiUrl}/api/collab/${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Collab POST ${path} failed (${res.status}): ${text}`);
    }
    return res.json();
  }

  // AI Memory endpoints
  async getMemory(key: string): Promise<any> {
    const res = await fetch(`${this.apiUrl}/api/ai/memory/${encodeURIComponent(key)}`, {
      headers: this.authHeaders,
    });
    if (!res.ok) return null;
    return res.json();
  }

  async setMemory(key: string, value: any, metadata?: any): Promise<any> {
    const res = await fetch(`${this.apiUrl}/api/ai/memory/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: this.authHeaders,
      body: JSON.stringify({ value, metadata }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Set memory failed (${res.status}): ${text}`);
    }
    return res.json();
  }

  // Auth — login with email/password
  async login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string; user: any }> {
    const res = await fetch(`${this.apiUrl}/api/trpc/auth.loginEmail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: { email, password } }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Login failed (${res.status}): ${text}`);
    }
    const data = await res.json();
    const result = data?.result?.data?.json ?? data?.result?.data ?? data;
    if (!result.success && !result.accessToken) {
      throw new Error(result.message || 'Login failed');
    }
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    };
  }
}
