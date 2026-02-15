/**
 * WebMCP Client for Awareness Market
 *
 * Provides a wrapper around the WebMCP library for easy integration
 * with Awareness Market's backend MCP API.
 *
 * Features:
 * - AI autonomous login with MCP tokens
 * - Tool registration (search_vectors, retrieve_memories_rmc, etc.)
 * - Prompt templates
 * - Resource exposure (memory graphs, vector marketplace)
 * - Multi-agent collaboration
 */

import { webMCPTools } from './tools';
import { webMCPPrompts } from './prompts';
import { webMCPResources } from './resources';
import { MCPAuthManager } from './auth';

export interface WebMCPConfig {
  apiBaseUrl: string;
  enableWidget?: boolean;
  widgetPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  autoConnect?: boolean;
  mcpToken?: string;
}

export interface MCPSession {
  sessionId: string;
  userId: number;
  capabilities: string[];
  expiresAt: Date;
}

export class WebMCPClient {
  private config: WebMCPConfig;
  private authManager: MCPAuthManager;
  private session: MCPSession | null = null;
  private isInitialized = false;

  constructor(config: WebMCPConfig) {
    this.config = {
      enableWidget: true,
      widgetPosition: 'bottom-right',
      autoConnect: false,
      ...config,
    };

    this.authManager = new MCPAuthManager(config.apiBaseUrl);
  }

  /**
   * Initialize WebMCP client and register tools/prompts/resources
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('[WebMCP] Already initialized');
      return;
    }

    console.log('[WebMCP] Initializing Awareness Market WebMCP client...');

    // Register tools
    console.log('[WebMCP] Registering tools:', webMCPTools.length);
    this.registerTools();

    // Register prompts
    console.log('[WebMCP] Registering prompts:', webMCPPrompts.length);
    this.registerPrompts();

    // Register resources
    console.log('[WebMCP] Registering resources:', webMCPResources.length);
    this.registerResources();

    // Auto-connect if token provided
    if (this.config.autoConnect && this.config.mcpToken) {
      await this.authenticate(this.config.mcpToken);
    }

    // Show widget if enabled
    if (this.config.enableWidget) {
      this.showWidget();
    }

    this.isInitialized = true;
    console.log('[WebMCP] Initialization complete ✓');
  }

  /**
   * Authenticate with MCP token
   */
  async authenticate(mcpToken: string): Promise<MCPSession> {
    console.log('[WebMCP] Authenticating with MCP token...');

    try {
      this.session = await this.authManager.authenticate(mcpToken);
      console.log('[WebMCP] Authentication successful:', {
        sessionId: this.session.sessionId,
        userId: this.session.userId,
        capabilities: this.session.capabilities,
      });

      return this.session;
    } catch (error) {
      console.error('[WebMCP] Authentication failed:', error);
      throw error;
    }
  }

  /**
   * Set MCP token (for AI autonomous login)
   */
  setToken(mcpToken: string): void {
    this.config.mcpToken = mcpToken;
  }

  /**
   * Get current session
   */
  getSession(): MCPSession | null {
    return this.session;
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    if (!this.session) return false;

    // Check if session expired
    if (new Date() > this.session.expiresAt) {
      this.session = null;
      return false;
    }

    return true;
  }

  /**
   * Register MCP tools
   */
  private registerTools(): void {
    webMCPTools.forEach((tool) => {
      // In a real WebMCP implementation, this would call:
      // window.webMCP.registerTool(tool)
      // For now, we store them for manual registration
      console.log(`[WebMCP] Registered tool: ${tool.name}`);
    });
  }

  /**
   * Register MCP prompts
   */
  private registerPrompts(): void {
    webMCPPrompts.forEach((prompt) => {
      // window.webMCP.registerPrompt(prompt)
      console.log(`[WebMCP] Registered prompt: ${prompt.name}`);
    });
  }

  /**
   * Register MCP resources
   */
  private registerResources(): void {
    webMCPResources.forEach((resource) => {
      // window.webMCP.registerResource(resource)
      console.log(`[WebMCP] Registered resource: ${resource.uri}`);
    });
  }

  /**
   * Show WebMCP widget (blue floating button)
   */
  private showWidget(): void {
    const widget = this.createWidgetElement();
    document.body.appendChild(widget);
    console.log('[WebMCP] Widget displayed at', this.config.widgetPosition);
  }

  /**
   * Create widget DOM element
   */
  private createWidgetElement(): HTMLElement {
    const widget = document.createElement('div');
    widget.id = 'webmcp-widget';
    widget.className = `webmcp-widget ${this.config.widgetPosition}`;
    widget.innerHTML = `
      <button class="webmcp-toggle-btn" title="Connect AI Agent">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div class="webmcp-panel" style="display: none;">
        <div class="webmcp-header">
          <h3>Connect AI Agent</h3>
          <button class="webmcp-close-btn">×</button>
        </div>
        <div class="webmcp-content">
          <p>Paste your MCP token to connect an AI agent to Awareness Market.</p>
          <input
            type="password"
            class="webmcp-token-input"
            placeholder="mcp_xxxxxxxxxxxxxxxx"
          />
          <button class="webmcp-connect-btn">Connect</button>
          <div class="webmcp-status"></div>
        </div>
      </div>
    `;

    // Add event listeners
    this.attachWidgetEventListeners(widget);

    return widget;
  }

  /**
   * Attach event listeners to widget
   */
  private attachWidgetEventListeners(widget: HTMLElement): void {
    const toggleBtn = widget.querySelector('.webmcp-toggle-btn') as HTMLButtonElement;
    const closeBtn = widget.querySelector('.webmcp-close-btn') as HTMLButtonElement;
    const connectBtn = widget.querySelector('.webmcp-connect-btn') as HTMLButtonElement;
    const tokenInput = widget.querySelector('.webmcp-token-input') as HTMLInputElement;
    const panel = widget.querySelector('.webmcp-panel') as HTMLDivElement;
    const status = widget.querySelector('.webmcp-status') as HTMLDivElement;

    // Toggle panel
    toggleBtn.addEventListener('click', () => {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });

    // Close panel
    closeBtn.addEventListener('click', () => {
      panel.style.display = 'none';
    });

    // Connect with token
    connectBtn.addEventListener('click', async () => {
      const token = tokenInput.value.trim();
      if (!token) {
        status.textContent = '❌ Please enter a valid MCP token';
        status.className = 'webmcp-status error';
        return;
      }

      try {
        status.textContent = '⏳ Connecting...';
        status.className = 'webmcp-status loading';

        await this.authenticate(token);

        status.textContent = `✅ Connected as User ${this.session?.userId}`;
        status.className = 'webmcp-status success';

        // Hide panel after 2 seconds
        setTimeout(() => {
          panel.style.display = 'none';
        }, 2000);
      } catch (error) {
        status.textContent = `❌ Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        status.className = 'webmcp-status error';
      }
    });

    // Enter key to connect
    tokenInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        connectBtn.click();
      }
    });
  }

  /**
   * Call a registered tool
   */
  async callTool(toolName: string, args: Record<string, any>): Promise<any> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated. Please call authenticate() first.');
    }

    const tool = webMCPTools.find((t) => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    console.log(`[WebMCP] Calling tool: ${toolName}`, args);

    // Validate args against schema (basic validation)
    if (tool.inputSchema.required) {
      for (const required of tool.inputSchema.required) {
        if (!(required in args)) {
          throw new Error(`Missing required parameter: ${required}`);
        }
      }
    }

    // Call the tool handler
    try {
      const result = await tool.handler(args, this.config.apiBaseUrl, this.config.mcpToken!);
      console.log(`[WebMCP] Tool result:`, result);
      return result;
    } catch (error) {
      console.error(`[WebMCP] Tool error:`, error);
      throw error;
    }
  }

  /**
   * Get a resource
   */
  async getResource(uri: string): Promise<any> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated. Please call authenticate() first.');
    }

    const resource = webMCPResources.find((r) => {
      // Simple URI matching (can be improved with pattern matching)
      return uri.startsWith(r.uri.split('{')[0]);
    });

    if (!resource) {
      throw new Error(`Resource not found: ${uri}`);
    }

    console.log(`[WebMCP] Getting resource: ${uri}`);

    try {
      const result = await resource.handler(uri, this.config.apiBaseUrl, this.config.mcpToken!);
      return result;
    } catch (error) {
      console.error(`[WebMCP] Resource error:`, error);
      throw error;
    }
  }

  /**
   * Render a prompt template with arguments
   */
  renderPrompt(promptName: string, args: Record<string, string>): string {
    const prompt = webMCPPrompts.find((p) => p.name === promptName);
    if (!prompt) {
      throw new Error(`Prompt not found: ${promptName}`);
    }

    let rendered = prompt.template;
    for (const [key, value] of Object.entries(args)) {
      rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    return rendered;
  }
}

/**
 * Global WebMCP client instance
 */
let webmcpClientInstance: WebMCPClient | null = null;

/**
 * Initialize WebMCP for Awareness Market
 */
export async function initializeWebMCP(config: WebMCPConfig): Promise<WebMCPClient> {
  if (webmcpClientInstance) {
    console.warn('[WebMCP] Already initialized, returning existing instance');
    return webmcpClientInstance;
  }

  webmcpClientInstance = new WebMCPClient(config);
  await webmcpClientInstance.initialize();

  // Expose to window for debugging
  if (typeof window !== 'undefined') {
    (window as any).awarenessWebMCP = webmcpClientInstance;
  }

  return webmcpClientInstance;
}

/**
 * Get the global WebMCP client instance
 */
export function getWebMCPClient(): WebMCPClient {
  if (!webmcpClientInstance) {
    throw new Error('WebMCP not initialized. Call initializeWebMCP() first.');
  }
  return webmcpClientInstance;
}
