#!/usr/bin/env node
'use strict';

const {spawn} = require('node:child_process');

const workerCommand = process.env.LUMI_INGESTION_WORKER_CMD?.trim();

if (!workerCommand) {
  console.log('[Launcher] No ingestion worker command was provided; exiting.');
  process.exit(0);
}

console.log(`[Launcher] Launching ingestion worker command: ${workerCommand}`);
const child = spawn(workerCommand, {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

child.on('exit', (code, signal) => {
  const exitCode = signal ? 1 : (code ?? 0);
  console.log(`[Launcher] Ingestion worker exited with code ${exitCode} (signal ${signal ?? 'none'}).`);
  process.exit(exitCode);
});

process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
