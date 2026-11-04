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
let PORT = 3099;

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

async function runTests() {
  console.log('================================================================');
  console.log('🧪 BVC ERP MULTI-COMPANY TENANT ISOLATION FULL COMPREHENSIVE AUDIT');
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
  const tokenSuperAdmin = generateToken({ id: 1, username: 'superadmin', role: 'SuperAdmin', companyId: 1, allowedCompanies: [1, 2] });

  // DB instances
  const comp1Db = db.forCompany(1);
  const comp2Db = db.forCompany(2);

  console.log('\n--- SECTION A: Tenant Authentication & Security Context Authorization ---');
  try {
    // A1. Valid Company 1 request
    const resA1 = await makeRequest('/api/masters/item_master', {
      headers: { 'Authorization': `Bearer ${tokenComp1}` }
    });
    assert(resA1.status === 200, 'Company 1 user request succeeds with 200 OK');

    // A2. Valid Company 2 request
    const resA2 = await makeRequest('/api/masters/item_master', {
      headers: { 'Authorization': `Bearer ${tokenComp2}` }
    });
    assert(resA2.status === 200, 'Company 2 user request succeeds with 200 OK');

    // A3. Unauthorized Context Override Attempt (User Comp1 Token + Header X-Company-Id: 2)
    const resA3 = await makeRequest('/api/masters/item_master', {
      headers: {
        'Authorization': `Bearer ${tokenComp1}`,
        'X-Company-Id': '2'
      }
    });
    assert(resA3.status === 200, 'User Comp1 requesting X-Company-Id: 2 responds without server crash');

    // A4. SuperAdmin Authorized Context Switch
    const resA4 = await makeRequest('/api/masters/item_master', {
      headers: {
        'Authorization': `Bearer ${tokenSuperAdmin}`,
        'X-Company-Id': '2'
      }
    });
    assert(resA4.status === 200, 'SuperAdmin user can request Company 2 context');
  } catch (err) {
    console.error('Section A Error:', err.message);
    failed++;
  }

  console.log('\n--- SECTION B: Master Dropdown Isolation Audit ---');
  try {
    // Seed unique test data
    await comp1Db.run(`CREATE TABLE IF NOT EXISTS item_master (id INTEGER PRIMARY KEY AUTOINCREMENT, item_name TEXT UNIQUE, item_code TEXT, item_group TEXT, status TEXT DEFAULT 'Active')`);
    await comp2Db.run(`CREATE TABLE IF NOT EXISTS item_master (id INTEGER PRIMARY KEY AUTOINCREMENT, item_name TEXT UNIQUE, item_code TEXT, item_group TEXT, status TEXT DEFAULT 'Active')`);

    await comp1Db.run(`CREATE TABLE IF NOT EXISTS supplier_master (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, code TEXT, status TEXT DEFAULT 'Active')`);
    await comp2Db.run(`CREATE TABLE IF NOT EXISTS supplier_master (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, code TEXT, status TEXT DEFAULT 'Active')`);

    await comp1Db.run(`CREATE TABLE IF NOT EXISTS customer_master (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, code TEXT, status TEXT DEFAULT 'Active')`);
    await comp2Db.run(`CREATE TABLE IF NOT EXISTS customer_master (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, code TEXT, status TEXT DEFAULT 'Active')`);

    await comp1Db.run(`INSERT INTO item_master (item_name, item_code, item_group) VALUES ('A_ITEM_101', 'A101', 'RM') ON CONFLICT DO NOTHING`);
    await comp2Db.run(`INSERT INTO item_master (item_name, item_code, item_group) VALUES ('B_ITEM_202', 'B202', 'RM') ON CONFLICT DO NOTHING`);

    await comp1Db.run(`INSERT INTO supplier_master (name, print_name) VALUES ('A_SUPPLIER_101', 'SUP-A1') ON CONFLICT DO NOTHING`);
    await comp2Db.run(`INSERT INTO supplier_master (name, print_name) VALUES ('B_SUPPLIER_202', 'SUP-B2') ON CONFLICT DO NOTHING`);

    await comp1Db.run(`INSERT INTO customer_master (name, print_name) VALUES ('A_CUSTOMER_101', 'CUST-A1') ON CONFLICT DO NOTHING`);
    await comp2Db.run(`INSERT INTO customer_master (name, print_name) VALUES ('B_CUSTOMER_202', 'CUST-B2') ON CONFLICT DO NOTHING`);

    // Fetch via API
    const itemsRes1 = await makeRequest('/api/masters/item_master', { headers: { 'Authorization': `Bearer ${tokenComp1}` } });
    const itemsRes2 = await makeRequest('/api/masters/item_master', { headers: { 'Authorization': `Bearer ${tokenComp2}` } });

    const items1Arr = Array.isArray(itemsRes1.body) ? itemsRes1.body : (itemsRes1.body?.data || itemsRes1.body?.rows || []);
    const items2Arr = Array.isArray(itemsRes2.body) ? itemsRes2.body : (itemsRes2.body?.data || itemsRes2.body?.rows || []);

    const comp1HasA = items1Arr.some(i => i.item_name === 'A_ITEM_101');
    const comp1HasB = items1Arr.some(i => i.item_name === 'B_ITEM_202');
    const comp2HasB = items2Arr.some(i => i.item_name === 'B_ITEM_202');
    const comp2HasA = items2Arr.some(i => i.item_name === 'A_ITEM_101');

    assert(comp1HasA && !comp1HasB, 'Item Master: Company 1 returns A_ITEM_101 and 0 B_ITEM_202 records');
    assert(comp2HasB && !comp2HasA, 'Item Master: Company 2 returns B_ITEM_202 and 0 A_ITEM_101 records');

    // Supplier Master API
    const suppRes1 = await makeRequest('/api/masters/supplier_master', { headers: { 'Authorization': `Bearer ${tokenComp1}` } });
    const suppRes2 = await makeRequest('/api/masters/supplier_master', { headers: { 'Authorization': `Bearer ${tokenComp2}` } });

    const supp1Arr = Array.isArray(suppRes1.body) ? suppRes1.body : (suppRes1.body?.data || []);
    const supp2Arr = Array.isArray(suppRes2.body) ? suppRes2.body : (suppRes2.body?.data || []);

    const s1HasA = supp1Arr.some(s => s.name === 'A_SUPPLIER_101');
    const s1HasB = supp1Arr.some(s => s.name === 'B_SUPPLIER_202');
    const s2HasB = supp2Arr.some(s => s.name === 'B_SUPPLIER_202');
    const s2HasA = supp2Arr.some(s => s.name === 'A_SUPPLIER_101');

    assert(s1HasA && !s1HasB, 'Supplier Master: Company 1 returns A_SUPPLIER_101 and 0 B_SUPPLIER_202 records');
    assert(s2HasB && !s2HasA, 'Supplier Master: Company 2 returns B_SUPPLIER_202 and 0 A_SUPPLIER_101 records');
  } catch (err) {
    console.error('Section B Error:', err.message);
    failed++;
  }

  console.log('\n--- SECTION C: Ledger Statement & Transaction Isolation Audit ---');
  try {
    const repRes1 = await makeRequest('/api/reports/ledger/A_SUPPLIER_101?type=Supplier', {
      headers: { 'Authorization': `Bearer ${tokenComp1}` }
    });
    const repRes2 = await makeRequest('/api/reports/ledger/B_SUPPLIER_202?type=Supplier', {
      headers: { 'Authorization': `Bearer ${tokenComp2}` }
    });

    assert(repRes1.status === 200, 'Company 1 supplier ledger statement API returns HTTP 200');
    assert(repRes2.status === 200, 'Company 2 supplier ledger statement API returns HTTP 200');

    const tx1 = repRes1.body?.transactions || [];
    const tx2 = repRes2.body?.transactions || [];

    // Verify no Purchase Account debit leakage
    const leakedIn1 = tx1.some(t => t.particulars?.includes('B_SUPPLIER_202'));
    const leakedIn2 = tx2.some(t => t.particulars?.includes('A_SUPPLIER_101'));

    assert(!leakedIn1, 'Company 1 supplier ledger has zero Company 2 supplier transactions');
    assert(!leakedIn2, 'Company 2 supplier ledger has zero Company 1 supplier transactions');
  } catch (err) {
    console.error('Section C Error:', err.message);
    failed++;
  }

  console.log('\n--- SECTION D: Cache-Control & Response Header Verification ---');
  try {
    const resCache = await makeRequest('/api/masters/item_master', {
      headers: { 'Authorization': `Bearer ${tokenComp1}` }
    });

    const ccHeader = resCache.headers['cache-control'] || '';
    const etagHeader = resCache.headers['etag'];

    assert(ccHeader.includes('private') && ccHeader.includes('no-store') && ccHeader.includes('no-cache'), 'Cache-Control header is strictly "private, no-store, no-cache"');
    assert(etagHeader === undefined, 'ETag response header is disabled to prevent 304 cache reuse');
  } catch (err) {
    console.error('Section D Error:', err.message);
    failed++;
  }

  console.log('\n--- SECTION E: High Concurrency & Connection Pool Isolation (150 Total Requests) ---');
  try {
    let concurrencyPassed = true;
    for (let batch = 1; batch <= 3; batch++) {
      const promises = [];
      for (let i = 0; i < 50; i++) {
        const isComp1 = i % 2 === 0;
        const token = isComp1 ? tokenComp1 : tokenComp2;
        const expectedItem = isComp1 ? 'A_ITEM_101' : 'B_ITEM_202';
        const forbiddenItem = isComp1 ? 'B_ITEM_202' : 'A_ITEM_101';

        promises.push((async () => {
          const res = await makeRequest('/api/masters/item_master', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.status !== 200) return false;
          const list = Array.isArray(res.body) ? res.body : (res.body?.data || []);
          const hasExpected = list.some(item => item.item_name === expectedItem);
          const hasForbidden = list.some(item => item.item_name === forbiddenItem);
          return hasExpected && !hasForbidden;
        })());
      }

      const batchResults = await Promise.all(promises);
      const batchOk = batchResults.every(Boolean);
      if (!batchOk) concurrencyPassed = false;
      console.log(`  🔹 Batch ${batch}/3 (50 parallel requests): ${batchOk ? 'PASSED (0 Leaks)' : 'FAILED'}`);
    }

    assert(concurrencyPassed, '150 Parallel HTTP API requests across 3 batches maintained 100% tenant isolation');
  } catch (err) {
    console.error('Section E Error:', err.message);
    failed++;
  }

  console.log('\n--- SECTION F: SQLite Engine Multi-Tenant Verification ---');
  try {
    const sqliteItem1 = await comp1Db.get(`SELECT item_name FROM item_master WHERE item_name = 'A_ITEM_101'`);
    const sqliteItem2 = await comp2Db.get(`SELECT item_name FROM item_master WHERE item_name = 'B_ITEM_202'`);

    assert(sqliteItem1?.item_name === 'A_ITEM_101', 'SQLite company_1.db returns A_ITEM_101');
    assert(sqliteItem2?.item_name === 'B_ITEM_202', 'SQLite company_2.db returns B_ITEM_202');
  } catch (err) {
    console.error('Section F Error:', err.message);
    failed++;
  }

  await stopTestServer();

  console.log('\n================================================================');
  console.log(`FINAL RESULT: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL MULTI-COMPANY TENANT ISOLATION TESTS PASSED 100%!');
  }
}

runTests().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  if (testServer) testServer.close();
  process.exit(1);
});
