const sqlite3 = require('sqlite3').verbose();

const files = [
  './database/bvc.db',
  './database/bvc.db.backup',
  './database/bvc.db.before-postgres-migration.backup',
  './database/backups/backup_before_restore_1_1787738119677.db',
  './database/backups/backup_before_restore_1_1787825476453.db'
];

function inspect(file) {
  return new Promise((resolve) => {
    console.log('\n========================================');
    console.log('FILE:', file);
    console.log('========================================');

    const db = new sqlite3.Database(
      file,
      sqlite3.OPEN_READONLY,
      (openError) => {
        if (openError) {
          console.log('OPEN ERROR:', openError.message);
          resolve();
          return;
        }

        db.all(
          "SELECT name, type FROM sqlite_master WHERE type IN ('table','view') ORDER BY type,name",
          (error, rows) => {
            if (error) {
              console.log('SCHEMA ERROR:', error.message);
            } else {
              console.log('OBJECT COUNT:', rows.length);
              console.table(rows);
            }

            db.close(() => resolve());
          }
        );
      }
    );
  });
}

(async () => {
  for (const file of files) {
    await inspect(file);
  }
})();