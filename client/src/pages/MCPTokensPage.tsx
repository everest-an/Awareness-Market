/**
 * MCP Tokens Page
 *
 * Page for managing MCP (Model Context Protocol) tokens
 */

import { MCPTokenManager } from '@/components/MCPTokenManager';

export default function MCPTokensPage() {
  return (
    <div className="mcp-tokens-page">
      <MCPTokenManager />

      <style>{`
        .mcp-tokens-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          padding: 40px 20px;
        }
      `}</style>
    </div>
  );
}
