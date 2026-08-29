const sqlite3 = require('sqlite3').verbose();

const dbPath = './database/company_2.db';

console.log('==============================================');
console.log('DEEP INSPECTION OF COMPANY 2');
console.log('==============================================');
console.log('Database:', dbPath);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('OPEN ERROR:', err.message);
    return;
  }

  console.log('Database opened successfully.');
  inspect();
});

function run(sql, label) {
  return new Promise((resolve) => {
    console.log('\n----------------------------------------------');
    console.log(label);
    console.log('SQL:', sql);

    db.all(sql, (err, rows) => {
      if (err) {
        console.log('ERROR:', err.message);
      } else {
        console.table(rows);
      }
      resolve();
    });
  });
}

async function inspect() {

  await run(
    `PRAGMA journal_mode`,
    'JOURNAL MODE'
  );

  await run(
    `PRAGMA page_count`,
    'PAGE COUNT'
  );

  await run(
    `PRAGMA integrity_check`,
    'INTEGRITY CHECK'
  );

  await run(
    `SELECT type, name, tbl_name, rootpage
     FROM sqlite_master
     WHERE name NOT LIKE 'sqlite_%'
     ORDER BY type, name`,
    'ALL SQLITE OBJECTS AND ROOT PAGES'
  );

  await run(
    `SELECT name
     FROM sqlite_master
     WHERE type = 'table'
       AND name NOT LIKE 'sqlite_%'
     ORDER BY name`,
    'ALL USER TABLES'
  );

  await run(
    `SELECT name, sql
     FROM sqlite_master
     WHERE type = 'table'
       AND name NOT LIKE 'sqlite_%'
     ORDER BY name`,
    'TABLE SCHEMAS'
  );

  await run(
    `SELECT name, type, tbl_name, rootpage
     FROM sqlite_master
     WHERE type IN ('index','trigger','view')
     ORDER BY type, name`,
    'INDEXES / TRIGGERS / VIEWS'
  );

  await run(
    `SELECT name, seq
     FROM sqlite_sequence
     ORDER BY name`,
    'SQLITE_SEQUENCE'
  );

  db.close(() => {
    console.log('\n==============================================');
    console.log('DEEP INSPECTION COMPLETE');
    console.log('==============================================');
  });
}

