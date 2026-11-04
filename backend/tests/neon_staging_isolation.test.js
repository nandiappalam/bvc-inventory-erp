const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../config/database');
const { rebuildStockLedger } = require('../utils/stockRebuilder');
const { ensureVoucherTables } = require('../utils/ledgerHelper');

test('Neon Staging Isolation: Concurrent multi-tenant reads & writes do not leak across companies', async () => {
  // Ensure tables exist
  await ensureVoucherTables();

  const comp1 = 1;
  const comp2 = 2;

  await db.forCompany(comp1).run(`DELETE FROM item_master WHERE item_name = 'ITEM_COMP1_EXCLUSIVE'`);
  await db.forCompany(comp2).run(`DELETE FROM item_master WHERE item_name = 'ITEM_COMP2_EXCLUSIVE'`);

  // Insert distinct item in Company 1
  await db.forCompany(comp1).run(`
    INSERT INTO item_master (item_name, print_name, item_group, unit, status)
    VALUES (?, ?, ?, ?, ?)
  `, ['ITEM_COMP1_EXCLUSIVE', 'COMP1 EXCLUSIVE', 'Raw Materials', 'KGS', 'Active']);

  // Insert distinct item in Company 2
  await db.forCompany(comp2).run(`
    INSERT INTO item_master (item_name, print_name, item_group, unit, status)
    VALUES (?, ?, ?, ?, ?)
  `, ['ITEM_COMP2_EXCLUSIVE', 'COMP2 EXCLUSIVE', 'Raw Materials', 'KGS', 'Active']);

  // Run 20 concurrent alternating reads
  const operations = [];
  for (let i = 0; i < 20; i++) {
    const targetComp = (i % 2 === 0) ? comp1 : comp2;
    operations.push(
      db.forCompany(targetComp).all('SELECT item_name FROM item_master WHERE item_name LIKE ?', ['ITEM_COMP%'])
        .then(rows => ({ targetComp, rows: rows.map(r => r.item_name) }))
    );
  }

  const results = await Promise.all(operations);
  for (const res of results) {
    if (res.targetComp === comp1) {
      assert.ok(res.rows.includes('ITEM_COMP1_EXCLUSIVE'), 'Company 1 must see its own item');
      assert.ok(!res.rows.includes('ITEM_COMP2_EXCLUSIVE'), 'Company 1 must NEVER see Company 2 item');
    } else {
      assert.ok(res.rows.includes('ITEM_COMP2_EXCLUSIVE'), 'Company 2 must see its own item');
      assert.ok(!res.rows.includes('ITEM_COMP1_EXCLUSIVE'), 'Company 2 must NEVER see Company 1 item');
    }
  }

  // Verify stock rebuilder does not delete user items or inject hardcoded records
  await rebuildStockLedger(comp1);
  const c1Items = await db.forCompany(comp1).all('SELECT item_name FROM item_master WHERE item_name = ?', ['ITEM_COMP1_EXCLUSIVE']);
  assert.equal(c1Items.length, 1, 'Company 1 item must persist after rebuildStockLedger');
});

test('Database Connection Pool: Connection checkout and release preserves tenant boundaries', async () => {
  const conn1 = await db.getConnection(1);
  const conn2 = await db.getConnection(2);

  try {
    await conn1.run('SELECT 1');
    await conn2.run('SELECT 1');
  } finally {
    await conn1.release();
    await conn2.release();
  }

  // After releasing, checking out a new connection for company 2 should strictly access company 2
  const freshConn = await db.getConnection(2);
  try {
    const rows = await freshConn.query('SELECT item_name FROM item_master WHERE item_name = ?', ['ITEM_COMP1_EXCLUSIVE']);
    assert.equal(rows.rows.length, 0, 'Company 2 connection must not see Company 1 exclusive data');
  } finally {
    await freshConn.release();
  }
});
