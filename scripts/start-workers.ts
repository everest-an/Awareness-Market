#!/usr/bin/env tsx
/**
 * Worker Startup Script
 *
 * Starts all enabled background workers for Awareness Network.
 *
 * Usage:
 *   npx tsx scripts/start-workers.ts [--phase=N] [--critical-only]
 *
 * Options:
 *   --phase=N: Only start workers for a specific v3.0 phase
 *   --critical-only: Only start critical priority workers
 *   --status: Show worker status and exit
 */

import workerManager from '../server/workers/worker-deployment-config';
import { createLogger } from '../server/utils/logger';

const logger = createLogger('WorkerStart');

// ============================================================================
// Parse CLI Arguments
// ============================================================================

const args = process.argv.slice(2);
const phase = args.find((arg) => arg.startsWith('--phase='))?.split('=')[1];
const criticalOnly = args.includes('--critical-only');
const statusOnly = args.includes('--status');

// ============================================================================
// Display Banner
// ============================================================================

function displayBanner() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  Awareness Network - Worker Manager                  ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log('');
}

// ============================================================================
// Display Status
// ============================================================================

function displayStatus() {
  const status = workerManager.getStatus();

  console.log('\n📊 Worker Status:\n');
  console.log('Worker                          | Enabled | Running | Schedule      | Priority ');
  console.log('--------------------------------|---------|---------|---------------|----------');

  for (const worker of status) {
    const name = worker.name.padEnd(30);
    const enabled = (worker.enabled ? '✅' : '❌').padEnd(8);
    const running = (worker.running ? '🟢' : '⚪').padEnd(8);
    const schedule = worker.schedule.padEnd(14);
    const priority = worker.priority.padEnd(10);

    console.log(`${name} | ${enabled} | ${running} | ${schedule} | ${priority}`);
  }

  const enabledCount = status.filter((w) => w.enabled).length;
  const runningCount = status.filter((w) => w.running).length;

  console.log('');
  console.log(`Total Workers: ${status.length}`);
  console.log(`Enabled: ${enabledCount}`);
  console.log(`Running: ${runningCount}`);
}

// ============================================================================
// Start Workers
// ============================================================================

async function startWorkers() {
  displayBanner();

  if (statusOnly) {
    displayStatus();
    process.exit(0);
  }

  logger.info('Starting workers...');

  // Filter workers based on CLI args
  if (phase) {
    const phaseNum = parseInt(phase, 10);
    logger.info(`Starting Phase ${phaseNum} workers only`);

    const phaseWorkers = workerManager.getByPhase(phaseNum);
    for (const worker of phaseWorkers) {
      const key = Object.keys(workerManager.WORKERS).find(
        (k) => workerManager.WORKERS[k] === worker
      );
      if (key) {
        workerManager.start(key);
      }
    }
  } else if (criticalOnly) {
    logger.info('Starting critical workers only');

    const criticalWorkers = workerManager.getCritical();
    for (const worker of criticalWorkers) {
      const key = Object.keys(workerManager.WORKERS).find(
        (k) => workerManager.WORKERS[k] === worker
      );
      if (key) {
        workerManager.start(key);
      }
    }
  } else {
    // Start all enabled workers
    workerManager.startAll();
  }

  // Display status after starting
  setTimeout(() => {
    displayStatus();
    logger.info('\n✅ Workers started successfully');
    logger.info('Press Ctrl+C to stop all workers\n');
  }, 1000);
}

// ============================================================================
// Error Handling
// ============================================================================

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

// ============================================================================
// Main
// ============================================================================

startWorkers().catch((error) => {
  logger.error('Failed to start workers:', error);
  process.exit(1);
});
