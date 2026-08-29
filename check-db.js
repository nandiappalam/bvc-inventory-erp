const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const files = [
  './database/bvc.db.before-postgres-migration.backup',
  './database/bvc.db.corrupted_20260713',
  './database/bvc.db.corrupted_20260719'
];

function testDatabase(dbPath) {
  return new Promise((resolve) => {
    console.log('\n========================================');
    console.log('TESTING:', dbPath);
    console.log('========================================');

    try {
      const stat = fs.statSync(dbPath);
      console.log('FILE SIZE:', stat.size);
      console.log('LAST MODIFIED:', stat.mtime);
    } catch (err) {
      console.log('FILE ERROR:', err.message);
      resolve();
      return;
    }

    const db = new sqlite3.Database(
      dbPath,
      sqlite3.OPEN_READONLY,
      (openErr) => {
        if (openErr) {
          console.log('OPEN ERROR:', openErr.message);
          resolve();
          return;
        }

        console.log('DATABASE OPEN: OK');

        db.get('PRAGMA integrity_check', (err, row) => {
          if (err) {
            console.log('INTEGRITY CHECK: ERROR');
            console.log(err.message);
          } else {
            console.log('INTEGRITY CHECK:', row);
          }

          db.all(
            "SELECT name, type FROM sqlite_master WHERE type IN ('table','index','trigger','view') ORDER BY type, name",
            (err, rows) => {
              if (err) {
                console.log('SQLITE_MASTER: ERROR');
                console.log(err.message);
              } else {
                console.log('SQLITE_MASTER OBJECTS:', rows.length);

                const tables = rows.filter(
                  (r) => r.type === 'table' && !r.name.startsWith('sqlite_')
                );

                console.log('USER TABLES:', tables.length);

                if (tables.length > 0) {
                  console.log('\nTABLES:');

                  for (const table of tables) {
                    console.log('  -', table.name);
                  }
                }
              }

              db.close(() => resolve());
            }
          );
        });
      }
    );
  });
}

async function main() {
  console.log('BVC SQLITE DATABASE COMPARISON');
  console.log('READ-ONLY TEST — NO DATABASE WILL BE MODIFIED');

  for (const file of files) {
    await testDatabase(file);
  }

  console.log('\n========================================');
  console.log('ALL TESTS COMPLETE');
  console.log('========================================');
}

main();