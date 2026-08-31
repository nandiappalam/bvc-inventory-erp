const db = require('../config/database');

async function tableExists(name) {
  const rows = await db.query(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    [name]
  );
  return rows.rows.length > 0;
}

async function getColumns(table) {
  const cols = await db.query(`PRAGMA table_info(${table})`);
  return new Set(cols.rows.map(r => r.name));
}

async function countRows(table) {
  const res = await db.query(`SELECT COUNT(*) as c FROM ${table}`);
  return res.rows[0]?.c ?? 0;
}

async function validate() {
  console.log('==============================');
  console.log('PHASE 1A VALIDATION');
  console.log('==============================');

  let ok = true;

  const requiredStockCols = [
    'qc_status',
    'usable_for_production',
    'ledger_posted',
    'approval_status',
    'approval_date',
    'approved_by',
    'hold_reason',
    'rejection_reason'
  ];

  const qcTables = [
    'qc_inspections',
    'qc_inspection_params',
    'incoming_quality_reports',
    'qc_approval_history'
  ];

  // stock_lots columns
  console.log('\nstock_lots columns:');
  const stockCols = await getColumns('stock_lots');
  for (const c of requiredStockCols) {
    const present = stockCols.has(c);
    if (present) {
      console.log(`✓ ${c}`);
    } else {
      ok = false;
      console.log(`✗ Missing column: ${c}`);
    }
  }

  // QC tables
  console.log('\nQC tables:');
  for (const t of qcTables) {
    const present = await tableExists(t);
    if (present) {
      console.log(`✓ ${t}`);
    } else {
      ok = false;
      console.log(`✗ Missing table: ${t}`);
    }
  }

  // Existing business data counts
  console.log('\nRow counts:');
  const purchasesCount = await countRows('purchases');
  const ledgerEntriesCount = await countRows('ledger_entries');
  const stockLotsCount = await countRows('stock_lots');

  console.log(`Purchases: ${purchasesCount}`);
  console.log(`Ledger Entries: ${ledgerEntriesCount}`);
  console.log(`Stock Lots: ${stockLotsCount}`);

  // Final result
  console.log('\nRESULT:');
  if (ok) {
    console.log('✓ Phase 1A validation PASSED');
    process.exit(0);
  } else {
    console.log('✗ Phase 1A validation FAILED');
    process.exit(1);
  }
}

validate().catch((e) => {
  console.error('Validation script crashed:', e);
  process.exit(1);
});
