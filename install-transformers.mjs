#!/usr/bin/env node

/**
 * Helper script to ensure @huggingface/transformers is properly installed
 * This is required for vector search capabilities in Awareness Local
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { createRequire } from 'module';

// This file is ESM ("type": "module"), where `require` does not exist. The
// require.resolve() below therefore threw ReferenceError on every single run,
// making the "already installed" early-exit unreachable and running the catch
// branch unconditionally. Every `npm install` — and every `npx -y` cold start,
// since postinstall runs then too — kicked off a nested install of a large
// package that was already a declared dependency.
const require = createRequire(import.meta.url);

// Check if @huggingface/transformers is installed
try {
  require.resolve('@huggingface/transformers');
  // Package is already available, nothing to do
  process.exit(0);
} catch (e) {
  console.log('[awareness-local] Installing @huggingface/transformers for vector search capabilities...');
  
  try {
    // Determine the package manager based on lock files in the current working directory
    const projectRoot = process.cwd();
    let cmd = 'npm install --no-save @huggingface/transformers@^3.0.0';
    
    if (fs.existsSync(path.join(projectRoot, 'yarn.lock'))) {
      cmd = 'yarn add @huggingface/transformers@^3.0.0';
    } else if (fs.existsSync(path.join(projectRoot, 'pnpm-lock.yaml'))) {
      cmd = 'pnpm add @huggingface/transformers@^3.0.0';
    }
    
    console.log(`[awareness-local] Running: ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
    
    console.log('[awareness-local] @huggingface/transformers installed successfully!');
    console.log('[awareness-local] Awareness Local now has full vector search capabilities.');
  } catch (err) {
    // Note: We still allow the application to run since the embedder module will fall back to FTS5
    console.error(`[awareness-local] Warning: Failed to install @huggingface/transformers:`, err.message);
    console.log('[awareness-local] Awareness Local will run with reduced search capabilities (FTS5 only).');
  }
}