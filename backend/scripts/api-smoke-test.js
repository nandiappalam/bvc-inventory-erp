#!/usr/bin/env node

const requiredTables = [
  'purchase_requests',
  'purchase_request_items',
  'purchase_request_approval_history',
  'purchase_orders',
  'purchase_order_items',
  'purchases',
  'purchase_items',
  'stock_lots',
  'qc_inspections',
  'qc_inspection_params',
];

const readOnlyEndpoints = [
  ['/api/health', 'Health'],
  ['/api/companies', 'Companies'],
  ['/api/masters/all/items', 'Master items'],
  ['/api/masters/all/suppliers', 'Master suppliers'],
  ['/api/masters/all/weights', 'Master weights'],
  ['/api/masters/all/godowns', 'Master godowns'],
  ['/api/masters/all/transports', 'Master transports'],
  ['/api/purchase-requests', 'Purchase Requests'],
  ['/api/purchase-requests/reports?reportType=summary', 'Purchase Request report'],
  ['/api/purchase-requests/dashboard/metrics', 'Purchase Request metrics'],
  ['/api/purchase-orders', 'Purchase Orders'],
  ['/api/purchases/purchase-list', 'Purchase list'],
  ['/api/qc/pending', 'QC pending'],
  ['/api/qc/pending?all=true', 'QC pending all'],
  ['/api/quality/registers', 'QC registers'],
  ['/api/compliance/dashboard', 'Compliance dashboard'],
];

function fail(message) {
  throw new Error(message);
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (_) {}
  if (!response.ok) {
    const detail = body?.message || body?.error || text || response.statusText;
    fail(`${options.method || 'GET'} ${path} -> HTTP ${response.status}: ${detail}`);
  }
  if (body && body.success === false) {
    fail(`${options.method || 'GET'} ${path} -> API failure: ${body.message || body.error || 'unknown error'}`);
  }
  return body;
}

async function checkSchema() {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const result = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'company_1' AND table_name = ANY($1::text[])`,
      [requiredTables]
    );
    const found = new Set(result.rows.map(row => row.table_name));
    const missing = requiredTables.filter(table => !found.has(table));
    if (missing.length) fail(`Missing company_1 tables: ${missing.join(', ')}`);
    console.log(`✓ PostgreSQL schema (${requiredTables.length} required tables)`);
  } finally {
    await pool.end();
  }
}

async function run() {
  if (process.env.DB_ENGINE !== 'postgres' || !process.env.DATABASE_URL) {
    fail('Refusing to run: set DB_ENGINE=postgres and DATABASE_URL to a TEST Neon/PostgreSQL database.');
  }
  if (!process.env.PREDEPLOY_TEST_DATABASE && !process.env.PREDEPLOY_ALLOW_PRODUCTION_DB) {
    fail('Refusing to run against an unspecified database. Set PREDEPLOY_TEST_DATABASE=true for the test Neon database.');
  }

  const baseUrl = process.env.API_BASE_URL || 'http://127.0.0.1:3001';
  console.log('========================================');
  console.log(' BVC ERP PostgreSQL Pre-Deploy API Test');
  console.log('========================================');
  console.log(`Target: ${baseUrl}`);
  console.log(`Write tests: ${process.env.PREDEPLOY_WRITE_TESTS === 'true' ? 'enabled' : 'disabled'}`);

  await checkSchema();
  for (const [path, label] of readOnlyEndpoints) {
    await request(baseUrl, path);
    console.log(`✓ ${label}`);
  }

  if (process.env.PREDEPLOY_WRITE_TESTS === 'true') {
    console.log('! CRUD chain tests are intentionally opt-in and require a disposable test database.');
    console.log('! The read-only API contract checks passed; run the workflow test with a test payload before deployment.');
  }

  console.log('========================================');
  console.log('RESULT: PASS');
  console.log('0 API ERRORS');
  console.log('========================================');
}

run().catch(error => {
  console.error('========================================');
  console.error(`RESULT: FAIL\n${error.message}`);
  console.error('========================================');
  process.exitCode = 1;
});
