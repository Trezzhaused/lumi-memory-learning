#!/usr/bin/env node
'use strict';

const path = require('node:path');
const {spawn} = require('node:child_process');

let workerProcess = null;
let appProcess = null;
let shuttingDown = false;

function loadRuntimeModule() {
  try {
    return require(path.join(process.cwd(), 'dist', 'lumi-runtime.js'));
  } catch (error) {
    console.error('[Launcher] Failed to load dist/lumi-runtime.js. Did the build complete successfully?');
    console.error(error);
    process.exit(1);
  }
}

function startBackgroundWorker() {
  const enabled = process.env.LUMI_ENABLE_BACKGROUND_INGESTION === 'true';
  const workerCommand = process.env.LUMI_INGESTION_WORKER_CMD?.trim();

  if (!enabled) {
    console.log('[Launcher] Background ingestion is disabled; skipping worker startup.');
    return;
  }

  if (!workerCommand) {
    console.log('[Launcher] Background ingestion is enabled but LUMI_INGESTION_WORKER_CMD is empty; skipping worker startup.');
    return;
  }

  console.log(`[Launcher] Starting background ingestion worker: ${workerCommand}`);
  workerProcess = spawn(process.execPath, ['scripts/ingestion-worker.cjs'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      LUMI_INGESTION_WORKER_CMD: workerCommand,
    },
  });

  workerProcess.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.log(`[Launcher] Background worker exited with code ${code ?? 'null'} signal ${signal ?? 'none'}.`);
  });
}

function startApp() {
  console.log('[Launcher] Starting Lumi application...');
  appProcess = spawn(process.execPath, ['dist/app.js'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  });

  appProcess.on('exit', (code, signal) => {
    if (shuttingDown) {
      process.exit(0);
    }
    const exitCode = signal ? 1 : (code ?? 0);
    console.error(`[Launcher] Lumi app exited with code ${exitCode} (signal ${signal ?? 'none'}).`);
    process.exit(exitCode);
  });
}

function stopChildren(signal) {
  shuttingDown = true;
  if (workerProcess && !workerProcess.killed) {
    workerProcess.kill(signal);
  }
  if (appProcess && !appProcess.killed) {
    appProcess.kill(signal);
  }
}

function main() {
  const {loadEnvironmentFiles, validateRuntimeConfiguration, formatRuntimeSummary} = loadRuntimeModule();
  const loadedFiles = loadEnvironmentFiles(process.cwd(), process.env);
  const runtimeSummary = validateRuntimeConfiguration(process.env);

  if (loadedFiles.length > 0) {
    console.log(`[Launcher] Loaded env files: ${loadedFiles.map((entry) => path.basename(entry.path)).join(', ')}`);
  } else {
    console.log('[Launcher] No environment files were loaded.');
  }
  console.log(`[Launcher] Runtime summary:\n${formatRuntimeSummary(runtimeSummary.summary)}`);

  if (runtimeSummary.shouldExit) {
    console.error('[Launcher] Runtime validation failed. Resolve the missing requirements above and try again.');
    process.exit(1);
  }

  console.log('[Launcher] Health endpoints will be available at /healthz and /readyz after startup.');
  startBackgroundWorker();
  startApp();
}

process.on('SIGINT', () => stopChildren('SIGINT'));
process.on('SIGTERM', () => stopChildren('SIGTERM'));

main();
