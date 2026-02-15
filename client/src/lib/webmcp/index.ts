/**
 * WebMCP Integration for Awareness Market
 *
 * Main export file for WebMCP client library
 */

export { initializeWebMCP, getWebMCPClient, WebMCPClient } from './webmcp-client';
export type { WebMCPConfig, MCPSession } from './webmcp-client';

export { MCPAuthManager, storeMCPToken, getMCPToken, clearMCPToken } from './auth';
export type { DeviceAuthResponse, TokenResponse } from './auth';

export { webMCPTools } from './tools';
export type { MCPTool } from './tools';

export { webMCPPrompts } from './prompts';
export type { MCPPrompt } from './prompts';

export { webMCPResources } from './resources';
export type { MCPResource } from './resources';
