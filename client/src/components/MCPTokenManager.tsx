/**
 * MCP Token Manager Component
 *
 * Allows users to create, view, and revoke MCP tokens for AI agent authentication
 */

import { useState } from 'react';
import { trpc } from '@/lib/trpc';

interface MCPToken {
  id: number;
  tokenPrefix: string;
  name: string;
  permissions: string;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}

export function MCPTokenManager() {
  const [isCreating, setIsCreating] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenPermissions, setNewTokenPermissions] = useState<string[]>(['read', 'write_with_confirmation']);
  const [newTokenExpiry, setNewTokenExpiry] = useState(30);
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  // Fetch tokens
  const { data: tokens, isLoading, refetch } = trpc.mcp.listTokens.useQuery();

  // Create token mutation
  const createTokenMutation = trpc.mcp.createToken.useMutation({
    onSuccess: (data) => {
      setCreatedToken(data.token);
      setNewTokenName('');
      refetch();
    },
    onError: (error) => {
      alert(`Failed to create token: ${error.message}`);
    },
  });

  // Revoke token mutation
  const revokeTokenMutation = trpc.mcp.revokeToken.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      alert(`Failed to revoke token: ${error.message}`);
    },
  });

  const handleCreateToken = () => {
    if (!newTokenName.trim()) {
      alert('Please enter a token name');
      return;
    }

    createTokenMutation.mutate({
      name: newTokenName,
      permissions: newTokenPermissions,
      expiresInDays: newTokenExpiry,
    });
  };

  const handleRevokeToken = (tokenId: number, tokenName: string) => {
    if (confirm(`Are you sure you want to revoke token "${tokenName}"? This action cannot be undone.`)) {
      revokeTokenMutation.mutate({ tokenId });
    }
  };

  const handleCopyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    alert('Token copied to clipboard!');
    setCreatedToken(null);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString();
  };

  const isExpired = (expiresAt: Date | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="mcp-token-manager">
      <div className="mcp-header">
        <h2>MCP Tokens</h2>
        <p className="mcp-subtitle">
          Manage authentication tokens for AI agents (Claude Desktop, GPT-4, etc.)
        </p>
      </div>

      {/* Created Token Display */}
      {createdToken && (
        <div className="mcp-created-token-card">
          <div className="mcp-alert-header">
            <strong>✅ Token Created Successfully!</strong>
          </div>
          <p className="mcp-alert-message">
            Copy this token now. It won't be shown again.
          </p>
          <div className="mcp-token-display">
            <code>{createdToken}</code>
            <button
              className="mcp-copy-btn"
              onClick={() => handleCopyToken(createdToken)}
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {/* Create New Token */}
      <div className="mcp-create-section">
        <button
          className="mcp-toggle-create-btn"
          onClick={() => setIsCreating(!isCreating)}
        >
          {isCreating ? '− Cancel' : '+ Create New Token'}
        </button>

        {isCreating && (
          <div className="mcp-create-form">
            <div className="mcp-form-group">
              <label>Token Name</label>
              <input
                type="text"
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
                placeholder="e.g., Claude Desktop Token"
                className="mcp-input"
              />
            </div>

            <div className="mcp-form-group">
              <label>Permissions</label>
              <div className="mcp-checkbox-group">
                <label className="mcp-checkbox">
                  <input
                    type="checkbox"
                    checked={newTokenPermissions.includes('read')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewTokenPermissions([...newTokenPermissions, 'read']);
                      } else {
                        setNewTokenPermissions(newTokenPermissions.filter(p => p !== 'read'));
                      }
                    }}
                  />
                  <span>Read (search vectors, query memories)</span>
                </label>

                <label className="mcp-checkbox">
                  <input
                    type="checkbox"
                    checked={newTokenPermissions.includes('write_with_confirmation')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewTokenPermissions([...newTokenPermissions, 'write_with_confirmation']);
                      } else {
                        setNewTokenPermissions(newTokenPermissions.filter(p => p !== 'write_with_confirmation'));
                      }
                    }}
                  />
                  <span>Write with Confirmation (create memories, purchase vectors)</span>
                </label>

                <label className="mcp-checkbox">
                  <input
                    type="checkbox"
                    checked={newTokenPermissions.includes('write')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewTokenPermissions([...newTokenPermissions, 'write']);
                      } else {
                        setNewTokenPermissions(newTokenPermissions.filter(p => p !== 'write'));
                      }
                    }}
                  />
                  <span>Full Write (trusted AI agents only)</span>
                </label>
              </div>
            </div>

            <div className="mcp-form-group">
              <label>Expires In</label>
              <select
                value={newTokenExpiry}
                onChange={(e) => setNewTokenExpiry(parseInt(e.target.value))}
                className="mcp-select"
              >
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
                <option value={365}>1 year</option>
              </select>
            </div>

            <button
              className="mcp-create-btn"
              onClick={handleCreateToken}
              disabled={createTokenMutation.isPending}
            >
              {createTokenMutation.isPending ? 'Creating...' : 'Create Token'}
            </button>
          </div>
        )}
      </div>

      {/* Tokens List */}
      <div className="mcp-tokens-list">
        <h3>Active Tokens</h3>

        {isLoading ? (
          <div className="mcp-loading">Loading tokens...</div>
        ) : tokens && tokens.length > 0 ? (
          <div className="mcp-tokens-grid">
            {tokens.map((token) => (
              <div
                key={token.id}
                className={`mcp-token-card ${isExpired(token.expiresAt) ? 'expired' : ''} ${!token.isActive ? 'revoked' : ''}`}
              >
                <div className="mcp-token-header">
                  <div className="mcp-token-name">{token.name}</div>
                  <div className="mcp-token-prefix">
                    <code>{token.tokenPrefix}***</code>
                  </div>
                </div>

                <div className="mcp-token-details">
                  <div className="mcp-token-detail">
                    <span className="mcp-label">Permissions:</span>
                    <span className="mcp-value">
                      {token.permissions ? JSON.parse(token.permissions).join(', ') : 'N/A'}
                    </span>
                  </div>

                  <div className="mcp-token-detail">
                    <span className="mcp-label">Last Used:</span>
                    <span className="mcp-value">{formatDate(token.lastUsedAt)}</span>
                  </div>

                  <div className="mcp-token-detail">
                    <span className="mcp-label">Expires:</span>
                    <span className={`mcp-value ${isExpired(token.expiresAt) ? 'expired' : ''}`}>
                      {formatDate(token.expiresAt)}
                      {isExpired(token.expiresAt) && ' (Expired)'}
                    </span>
                  </div>

                  <div className="mcp-token-detail">
                    <span className="mcp-label">Created:</span>
                    <span className="mcp-value">{formatDate(token.createdAt)}</span>
                  </div>
                </div>

                {token.isActive && !isExpired(token.expiresAt) && (
                  <button
                    className="mcp-revoke-btn"
                    onClick={() => handleRevokeToken(token.id, token.name)}
                    disabled={revokeTokenMutation.isPending}
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="mcp-empty-state">
            <p>No tokens created yet.</p>
            <p>Create a token to allow AI agents to access Awareness Market.</p>
          </div>
        )}
      </div>

      <style>{`
        .mcp-token-manager {
          max-width: 1000px;
          margin: 0 auto;
          padding: 20px;
        }

        .mcp-header {
          margin-bottom: 30px;
        }

        .mcp-header h2 {
          font-size: 28px;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 8px;
        }

        .mcp-subtitle {
          color: #666;
          font-size: 14px;
        }

        .mcp-created-token-card {
          background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
          border: 1px solid #c3e6cb;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .mcp-alert-header {
          color: #155724;
          font-size: 16px;
          margin-bottom: 10px;
        }

        .mcp-alert-message {
          color: #155724;
          font-size: 14px;
          margin-bottom: 15px;
        }

        .mcp-token-display {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .mcp-token-display code {
          flex: 1;
          background: white;
          padding: 12px;
          border-radius: 6px;
          font-family: 'Monaco', 'Courier New', monospace;
          font-size: 13px;
          color: #155724;
          overflow-x: auto;
        }

        .mcp-copy-btn {
          padding: 10px 20px;
          background: #155724;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
        }

        .mcp-copy-btn:hover {
          background: #0f4419;
        }

        .mcp-create-section {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 30px;
        }

        .mcp-toggle-create-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .mcp-toggle-create-btn:hover {
          transform: translateY(-2px);
        }

        .mcp-create-form {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #e0e0e0;
        }

        .mcp-form-group {
          margin-bottom: 20px;
        }

        .mcp-form-group label {
          display: block;
          font-weight: 600;
          color: #333;
          margin-bottom: 8px;
          font-size: 14px;
        }

        .mcp-input,
        .mcp-select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d0d0d0;
          border-radius: 6px;
          font-size: 14px;
        }

        .mcp-input:focus,
        .mcp-select:focus {
          outline: none;
          border-color: #667eea;
        }

        .mcp-checkbox-group {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .mcp-checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .mcp-checkbox input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .mcp-create-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 12px 32px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .mcp-create-btn:hover {
          opacity: 0.9;
        }

        .mcp-create-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .mcp-tokens-list {
          margin-top: 30px;
        }

        .mcp-tokens-list h3 {
          font-size: 20px;
          font-weight: 600;
          color: #1a1a1a;
          margin-bottom: 20px;
        }

        .mcp-loading,
        .mcp-empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #666;
        }

        .mcp-tokens-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }

        .mcp-token-card {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 12px;
          padding: 20px;
          transition: all 0.2s;
        }

        .mcp-token-card:hover {
          border-color: #667eea;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.1);
        }

        .mcp-token-card.expired,
        .mcp-token-card.revoked {
          opacity: 0.6;
          background: #f5f5f5;
        }

        .mcp-token-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
          padding-bottom: 15px;
          border-bottom: 1px solid #e0e0e0;
        }

        .mcp-token-name {
          font-weight: 600;
          color: #1a1a1a;
          font-size: 16px;
        }

        .mcp-token-prefix code {
          background: #f5f5f5;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          color: #666;
        }

        .mcp-token-details {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 15px;
        }

        .mcp-token-detail {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
        }

        .mcp-label {
          color: #666;
          font-weight: 500;
        }

        .mcp-value {
          color: #1a1a1a;
          text-align: right;
        }

        .mcp-value.expired {
          color: #dc3545;
        }

        .mcp-revoke-btn {
          width: 100%;
          padding: 8px 16px;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .mcp-revoke-btn:hover {
          background: #c82333;
        }

        .mcp-revoke-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
