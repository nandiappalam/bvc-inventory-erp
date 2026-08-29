const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database(
  './database/company_2.db',
  sqlite3.OPEN_READONLY
);

const tables = [
  'companies',
  'users',
  'item_master',
  'supplier_master',
  'customer_master',
  'godown_master',
  'purchases',
  'purchase_items',
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
      console.log(
        `${table}:`,
        err ? `ERROR - ${err.message}` : `${row.count} rows`
      );
      next();
    }
  );
}

next();
