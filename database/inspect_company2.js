const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database(
  "./database/company_2.recovery_work.db",
  sqlite3.OPEN_READONLY,
  (err) => {
    if (err) {
      console.error("OPEN ERROR:", err.message);
      process.exit(1);
    }

    db.all(
      "SELECT name, type FROM sqlite_master WHERE type IN ('table','view') ORDER BY type,name",
      (err, rows) => {
        if (err) {
          console.error("QUERY ERROR:", err.message);
          process.exit(1);
        }

        console.table(rows);
        db.close();
      }
    );
  }
);