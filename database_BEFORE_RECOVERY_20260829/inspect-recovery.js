const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database(
  './database/company_2.recovery_work.db',
  sqlite3.OPEN_READONLY
);

const tables = [
  'companies',
  'users',
  'item_master',
  'item_groups',
  'supplier_master',
  'customer_master',
  'godown_master',
  'purchases',
  'purchase_items',
  'purchase_returns',
  'purchase_return_items',
  'sales',
  'purchase_orders',
  'purchase_requests',
  'qc_inspections',
  'grains'
];

let i = 0;

function next() {
  if (i >= tables.length) {
    console.log('\nInspection complete.');
    db.close();
    return;
  }

  const table = tables[i++];

  db.get(
    `SELECT COUNT(*) AS count FROM "${table}"`,
    (err, row) => {
      if (err) {
        console.log(`${table}: ERROR - ${err.message}`);
      } else {
        console.log(`${table}: ${row.count} rows`);
      }

      next();
    }
  );
}

next();
