#!/usr/bin/env node

const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const nodeCommand = process.execPath;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });
  if (result.error) {
    throw new Error(`Failed to run ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with code ${result.status}`);
  }
}

async function waitForHealth(baseUrl) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(new URL('/api/health', baseUrl));
      if (response.ok) return;
    } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`Backend did not become healthy at ${baseUrl}`);
}

async function main() {
  if (process.env.DB_ENGINE !== 'postgres' || !process.env.DATABASE_URL) {
    throw new Error('Set DB_ENGINE=postgres and DATABASE_URL to a disposable TEST Neon database before running predeploy.');
  }
  if (process.env.PREDEPLOY_TEST_DATABASE !== 'true' && !process.env.PREDEPLOY_ALLOW_PRODUCTION_DB) {
    throw new Error('Refusing to run without PREDEPLOY_TEST_DATABASE=true. Production data must not be used for write tests.');
  }

  console.log('== Git working tree ==');
  run('git', ['--no-pager', 'status', '--short']);
  run('git', ['--no-pager', 'diff', '--check']);
  run('git', ['--no-pager', 'diff', '--stat']);
  run('git', ['--no-pager', 'log', '--oneline', '-5']);

  console.log('== Frontend build ==');
  run(npmCommand, ['run', 'build'], { cwd: path.join(root, 'frontend') });

  console.log('== Backend syntax ==');
  const files = [
    'backend/server.js',
    'backend/config/database.js',
    'backend/routes/masters.js',
    'backend/routes/purchaseRequests.js',
    'backend/routes/purchaseOrderService.js',
    'backend/routes/purchases_fixed.js',
    'backend/routes/qc.js',
    'backend/routes/compliance.js',
    'backend/scripts/api-smoke-test.js',
  ];
  for (const file of files) run(nodeCommand, ['--check', file]);

  const externalBaseUrl = process.env.API_BASE_URL;
  const baseUrl = externalBaseUrl || 'http://127.0.0.1:3001';
  let server;
  try {
    if (!externalBaseUrl) {
      console.log('== Starting local PostgreSQL backend ==');
      server = spawn(nodeCommand, ['backend/server.js'], {
        cwd: root,
        env: { ...process.env, PORT: process.env.PORT || '3001' },
        stdio: 'inherit',
      });
      await waitForHealth(baseUrl);
    }

    console.log('== PostgreSQL schema and API smoke test ==');
    run(nodeCommand, ['backend/scripts/api-smoke-test.js'], {
      env: { ...process.env, API_BASE_URL: baseUrl },
    });
  } finally {
    if (server && !server.killed) {
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/pid', String(server.pid), '/t', '/f'], { stdio: 'ignore' });
      } else {
        server.kill('SIGTERM');
      }
    }
  }

  console.log('PREDEPLOY RESULT: PASS');
}

main().catch(error => {
  console.error(`PREDEPLOY RESULT: FAIL\n${error.message}`);
  process.exitCode = 1;
});
