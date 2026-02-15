/**
 * MCP Authentication Manager
 *
 * Handles AI autonomous login using MCP tokens and OAuth 2.0 device flow
 */

import type { MCPSession } from './webmcp-client';

export interface DeviceAuthResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export class MCPAuthManager {
  private apiBaseUrl: string;

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl;
  }

  /**
   * Authenticate with MCP token (Method 1: Direct token)
   */
  async authenticate(mcpToken: string): Promise<MCPSession> {
    const response = await fetch(`${this.apiBaseUrl}/api/mcp/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MCP-Token': mcpToken,
      },
      body: JSON.stringify({ token: mcpToken }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Authentication failed');
    }

    const data = await response.json();

    return {
      sessionId: data.sessionId,
      userId: data.userId,
      capabilities: data.capabilities || ['read', 'write_with_confirmation'],
      expiresAt: new Date(data.expiresAt),
    };
  }

  /**
   * Start OAuth 2.0 device flow (Method 2: Fully autonomous)
   */
  async startDeviceFlow(): Promise<DeviceAuthResponse> {
    const response = await fetch(`${this.apiBaseUrl}/api/mcp/auth/device`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: 'awareness-market-webmcp',
        scope: 'read:vectors read:memories write:memories',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to start device flow');
    }

    return await response.json();
  }

  /**
   * Poll for device authorization
   */
  async pollDeviceAuthorization(deviceCode: string, interval: number = 5): Promise<string> {
    return new Promise((resolve, reject) => {
      const pollInterval = setInterval(async () => {
        try {
          const response = await fetch(`${this.apiBaseUrl}/api/mcp/auth/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
              device_code: deviceCode,
              client_id: 'awareness-market-webmcp',
            }),
          });

          if (response.ok) {
            const data: TokenResponse = await response.json();
            clearInterval(pollInterval);
            resolve(data.access_token);
          } else if (response.status === 400) {
            const error = await response.json();
            if (error.error === 'authorization_pending') {
              // Continue polling
              return;
            } else if (error.error === 'slow_down') {
              // Increase interval (not implemented for simplicity)
              return;
            } else {
              clearInterval(pollInterval);
              reject(new Error(error.error || 'Authorization failed'));
            }
          }
        } catch (error) {
          clearInterval(pollInterval);
          reject(error);
        }
      }, interval * 1000);

      // Timeout after 10 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        reject(new Error('Device authorization timeout'));
      }, 600000);
    });
  }

  /**
   * Full OAuth device flow with user instructions
   */
  async authenticateWithDeviceFlow(): Promise<MCPSession> {
    // Step 1: Start device flow
    const deviceAuth = await this.startDeviceFlow();

    // Step 2: Display instructions to user
    console.log(`
╔════════════════════════════════════════════════════════════╗
║  AI Agent Authorization Required                           ║
╠════════════════════════════════════════════════════════════╣
║  Please visit: ${deviceAuth.verification_uri.padEnd(39)} ║
║  Enter code:   ${deviceAuth.user_code.padEnd(39)} ║
╠════════════════════════════════════════════════════════════╣
║  Waiting for authorization...                              ║
╚════════════════════════════════════════════════════════════╝
    `);

    // Step 3: Poll for authorization
    const accessToken = await this.pollDeviceAuthorization(
      deviceAuth.device_code,
      deviceAuth.interval
    );

    // Step 4: Authenticate with access token
    return await this.authenticate(accessToken);
  }

  /**
   * Create a new MCP token (requires API key authentication)
   */
  async createMCPToken(
    apiKey: string,
    options: {
      name?: string;
      permissions?: string[];
      expiresInDays?: number;
    } = {}
  ): Promise<{
    token: string;
    tokenPrefix: string;
    expiresAt: string;
  }> {
    const response = await fetch(`${this.apiBaseUrl}/api/mcp/tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        name: options.name || 'WebMCP Token',
        permissions: options.permissions || ['read', 'write_with_confirmation'],
        expiresInDays: options.expiresInDays || 30,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create MCP token');
    }

    return await response.json();
  }

  /**
   * List all MCP tokens for authenticated user
   */
  async listMCPTokens(apiKey: string): Promise<any[]> {
    const response = await fetch(`${this.apiBaseUrl}/api/mcp/tokens`, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to list MCP tokens');
    }

    const data = await response.json();
    return data.tokens || [];
  }

  /**
   * Revoke an MCP token
   */
  async revokeMCPToken(apiKey: string, tokenId: number): Promise<void> {
    const response = await fetch(`${this.apiBaseUrl}/api/mcp/tokens/${tokenId}`, {
      method: 'DELETE',
      headers: {
        'X-API-Key': apiKey,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to revoke MCP token');
    }
  }

  /**
   * Request user confirmation for sensitive operations
   */
  async requestUserConfirmation(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      const confirmed = window.confirm(
        `AI Agent Permission Request:\n\n${message}\n\nAllow this action?`
      );
      resolve(confirmed);
    });
  }

  /**
   * Check if user has specific capability
   */
  hasCapability(session: MCPSession | null, capability: string): boolean {
    if (!session) return false;
    return session.capabilities.includes(capability);
  }

  /**
   * Verify if operation requires confirmation
   */
  requiresConfirmation(operation: string, session: MCPSession | null): boolean {
    if (!session) return true;

    // Write operations with 'write_with_confirmation' capability require confirmation
    const writeOperations = [
      'create_memory',
      'update_memory',
      'delete_memory',
      'purchase_vector',
      'create_vector',
    ];

    if (writeOperations.includes(operation)) {
      return (
        session.capabilities.includes('write_with_confirmation') &&
        !session.capabilities.includes('write')
      );
    }

    // Admin operations always require confirmation
    const adminOperations = ['delete_account', 'update_settings', 'revoke_all_tokens'];

    return adminOperations.includes(operation);
  }
}

/**
 * Helper function to store MCP token in localStorage
 */
export function storeMCPToken(token: string): void {
  localStorage.setItem('awareness_mcp_token', token);
}

/**
 * Helper function to retrieve MCP token from localStorage
 */
export function getMCPToken(): string | null {
  return localStorage.getItem('awareness_mcp_token');
}

/**
 * Helper function to clear MCP token
 */
export function clearMCPToken(): void {
  localStorage.removeItem('awareness_mcp_token');
}
