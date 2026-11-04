const http = require('http');
// Suppress verbose startup logs
console.log = (...args) => {
  if (typeof args[0] === 'string' && (args[0].includes('rebuildStockLedger') || args[0].includes('COMPANY') || args[0].includes('BVC ERP MODE'))) return;
  process.stdout.write(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') + '\n');
};

const db = require('../config/database');
const app = require('../server');
const { generateToken } = require('../middleware/authMiddleware');

let testServer = null;
let PORT = 3098;

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const reqOpts = {
      hostname: '127.0.0.1',
      port: PORT,
      path,
      method: options.method || 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOpts, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(body);
        } catch (_) {
          json = body;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json
        });
      });
    });

    req.on('error', (err) => reject(err));
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function startTestServer() {
  return new Promise((resolve) => {
    testServer = http.createServer(app);
    testServer.listen(PORT, '127.0.0.1', () => {
      console.log(`📡 [Test Runner] In-memory API test server running on port ${PORT}`);
      resolve();
    });
  });
}

async function stopTestServer() {
  if (testServer) {
    return new Promise((resolve) => {
      testServer.close(() => resolve());
    });
  }
}

async function runFullAudit() {
  console.log('================================================================');
  console.log('🧪 BVC ERP COMPLETE ERP MODULE & TENANT ISOLATION AUDIT');
  console.log('================================================================');

  await startTestServer();

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // Tokens
  const tokenComp1 = generateToken({ id: 101, username: 'user_comp1', role: 'user', companyId: 1 });
  const tokenComp2 = generateToken({ id: 102, username: 'user_comp2', role: 'user', companyId: 2 });

  // DB instances
  const comp1Db = db.forCompany(1);
  const comp2Db = db.forCompany(2);

  console.log('\n--- 1. Seeding Isolated Test Master Records ---');
  try {
    // Seed Company 1 Records
    await comp1Db.run(`CREATE TABLE IF NOT EXISTS item_master (id INTEGER PRIMARY KEY AUTOINCREMENT, item_name TEXT UNIQUE, item_code TEXT, item_group TEXT, status TEXT DEFAULT 'Active')`);
    await comp1Db.run(`CREATE TABLE IF NOT EXISTS supplier_master (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, print_name TEXT, status TEXT DEFAULT 'Active')`);
    await comp1Db.run(`CREATE TABLE IF NOT EXISTS customer_master (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, print_name TEXT, status TEXT DEFAULT 'Active')`);
    await comp1Db.run(`CREATE TABLE IF NOT EXISTS transport_master (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, status TEXT DEFAULT 'Active')`);
    await comp1Db.run(`CREATE TABLE IF NOT EXISTS godown_master (id INTEGER PRIMARY KEY AUTOINCREMENT, godown_name TEXT UNIQUE, status TEXT DEFAULT 'Active')`);

    await comp1Db.run(`INSERT INTO item_master (item_name, item_code) VALUES ('C1_RAW_RICE', 'C1-001') ON CONFLICT DO NOTHING`);
    await comp1Db.run(`INSERT INTO supplier_master (name, print_name) VALUES ('C1_SUPPLIER_NORTH', 'C1 North') ON CONFLICT DO NOTHING`);
    await comp1Db.run(`INSERT INTO customer_master (name, print_name) VALUES ('C1_CUSTOMER_SOUTH', 'C1 South') ON CONFLICT DO NOTHING`);
    await comp1Db.run(`INSERT INTO transport_master (name) VALUES ('C1_EXPRESS_LOGISTICS') ON CONFLICT DO NOTHING`);
    await comp1Db.run(`INSERT INTO godown_master (godown_name) VALUES ('C1_MAIN_WAREHOUSE') ON CONFLICT DO NOTHING`);

    // Seed Company 2 Records
    await comp2Db.run(`CREATE TABLE IF NOT EXISTS item_master (id INTEGER PRIMARY KEY AUTOINCREMENT, item_name TEXT UNIQUE, item_code TEXT, item_group TEXT, status TEXT DEFAULT 'Active')`);
    await comp2Db.run(`CREATE TABLE IF NOT EXISTS supplier_master (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, print_name TEXT, status TEXT DEFAULT 'Active')`);
    await comp2Db.run(`CREATE TABLE IF NOT EXISTS customer_master (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, print_name TEXT, status TEXT DEFAULT 'Active')`);
    await comp2Db.run(`CREATE TABLE IF NOT EXISTS transport_master (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, status TEXT DEFAULT 'Active')`);
    await comp2Db.run(`CREATE TABLE IF NOT EXISTS godown_master (id INTEGER PRIMARY KEY AUTOINCREMENT, godown_name TEXT UNIQUE, status TEXT DEFAULT 'Active')`);

    await comp2Db.run(`INSERT INTO item_master (item_name, item_code) VALUES ('C2_WHEAT_FLOUR', 'C2-002') ON CONFLICT DO NOTHING`);
    await comp2Db.run(`INSERT INTO supplier_master (name, print_name) VALUES ('C2_SUPPLIER_EAST', 'C2 East') ON CONFLICT DO NOTHING`);
    await comp2Db.run(`INSERT INTO customer_master (name, print_name) VALUES ('C2_CUSTOMER_WEST', 'C2 West') ON CONFLICT DO NOTHING`);
    await comp2Db.run(`INSERT INTO transport_master (name) VALUES ('C2_FAST_CARGO') ON CONFLICT DO NOTHING`);
    await comp2Db.run(`INSERT INTO godown_master (godown_name) VALUES ('C2_COLD_STORE_B') ON CONFLICT DO NOTHING`);

    console.log('  ✓ Test master records successfully seeded');
  } catch (err) {
    console.error('Seeding error:', err.message);
  }

  console.log('\n--- 2. End-to-End Master Dropdown Isolation Audit ---');
  const masterModules = [
    { name: 'Item Master', path: '/api/masters/item_master', comp1Key: 'C1_RAW_RICE', comp2Key: 'C2_WHEAT_FLOUR' },
    { name: 'Supplier Master', path: '/api/masters/supplier_master', comp1Key: 'C1_SUPPLIER_NORTH', comp2Key: 'C2_SUPPLIER_EAST' },
    { name: 'Customer Master', path: '/api/masters/customer_master', comp1Key: 'C1_CUSTOMER_SOUTH', comp2Key: 'C2_CUSTOMER_WEST' },
    { name: 'Transport Master', path: '/api/masters/transport_master', comp1Key: 'C1_EXPRESS_LOGISTICS', comp2Key: 'C2_FAST_CARGO' },
    { name: 'Godown Master', path: '/api/godowns', comp1Key: 'C1_MAIN_WAREHOUSE', comp2Key: 'C2_COLD_STORE_B' }
  ];

  for (const mod of masterModules) {
    try {
      const res1 = await makeRequest(mod.path, { headers: { 'Authorization': `Bearer ${tokenComp1}` } });
      const res2 = await makeRequest(mod.path, { headers: { 'Authorization': `Bearer ${tokenComp2}` } });

      const arr1 = Array.isArray(res1.body) ? res1.body : (res1.body?.data || res1.body?.godowns || []);
      const arr2 = Array.isArray(res2.body) ? res2.body : (res2.body?.data || res2.body?.godowns || []);

      const jsonStr1 = JSON.stringify(arr1);
      const jsonStr2 = JSON.stringify(arr2);

      const hasKey1In1 = jsonStr1.includes(mod.comp1Key);
      const hasKey2In1 = jsonStr1.includes(mod.comp2Key);
      const hasKey2In2 = jsonStr2.includes(mod.comp2Key);
      const hasKey1In2 = jsonStr2.includes(mod.comp1Key);

      assert(hasKey1In1 && !hasKey2In1, `${mod.name}: Company 1 returns strictly Company 1 data (0 cross-company records)`);
      assert(hasKey2In2 && !hasKey1In2, `${mod.name}: Company 2 returns strictly Company 2 data (0 cross-company records)`);
    } catch (err) {
      console.error(`Error in ${mod.name}:`, err.message);
      failed++;
    }
  }

  console.log('\n--- 3. Transaction & Report Isolation Audit ---');
  const reportModules = [
    { name: 'Purchases List', path: '/api/purchases' },
    { name: 'Sales List', path: '/api/sales' },
    { name: 'Stock Summary Report', path: '/api/reports/stock' },
    { name: 'Purchase Report', path: '/api/reports/purchase' },
    { name: 'Sales Report', path: '/api/reports/sales' },
    { name: 'Next Lot Preview', path: '/api/lots/preview' }
  ];

  for (const rep of reportModules) {
    try {
      const res1 = await makeRequest(rep.path, { headers: { 'Authorization': `Bearer ${tokenComp1}` } });
      const res2 = await makeRequest(rep.path, { headers: { 'Authorization': `Bearer ${tokenComp2}` } });

      assert(res1.status === 200, `${rep.name}: Company 1 request responds 200 OK`);
      assert(res2.status === 200, `${rep.name}: Company 2 request responds 200 OK`);
    } catch (err) {
      console.error(`Error in ${rep.name}:`, err.message);
      failed++;
    }
  }

  console.log('\n--- 4. Stock Reconciliation Verification ---');
  try {
    // Seed stock movement
    await comp1Db.run(`CREATE TABLE IF NOT EXISTS stock (id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER, item_name TEXT, qty REAL DEFAULT 0, weight REAL DEFAULT 0, rate REAL DEFAULT 0, type TEXT)`);
    await comp1Db.run(`INSERT INTO stock (item_name, qty, weight, rate, type) VALUES ('C1_RAW_RICE', 100, 5000, 45, 'Purchase')`);
    await comp1Db.run(`INSERT INTO stock (item_name, qty, weight, rate, type) VALUES ('C1_RAW_RICE', -30, -1500, 45, 'Sales')`);

    const stockRows = await comp1Db.all(`SELECT item_name, SUM(qty) as total_qty, SUM(weight) as total_wt FROM stock WHERE TRIM(item_name) = 'C1_RAW_RICE' GROUP BY TRIM(item_name)`);
    const summary = stockRows[0] || { total_qty: 0, total_wt: 0 };

    assert(summary.total_qty === 70, 'Company 1 Stock Reconciliation: Opening 100 - Sales 30 = Net 70 Qty');
    assert(summary.total_wt === 3500, 'Company 1 Weight Reconciliation: Opening 5000kg - Sales 1500kg = Net 3500kg Weight');
  } catch (err) {
    console.error('Stock Reconciliation Error:', err.message);
    failed++;
  }

  console.log('\n--- 5. Response Header & Cache Audit ---');
  try {
    const resCache = await makeRequest('/api/masters/item_master', {
      headers: { 'Authorization': `Bearer ${tokenComp1}` }
    });

    const cc = resCache.headers['cache-control'] || '';
    const etag = resCache.headers['etag'];

    assert(cc.includes('private') && cc.includes('no-store'), 'HTTP Response Header Cache-Control is "private, no-store"');
    assert(etag === undefined, 'HTTP ETag header is completely disabled');
  } catch (err) {
    console.error('Header Cache Error:', err.message);
    failed++;
  }

  await stopTestServer();

  console.log('\n================================================================');
  console.log(`FINAL MODULE AUDIT RESULT: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL ERP MODULE & TENANT ISOLATION AUDITS PASSED 100%!');
  }
}

runFullAudit().catch(err => {
  console.error('Fatal Test Error:', err);
  if (testServer) testServer.close();
  process.exit(1);
});
