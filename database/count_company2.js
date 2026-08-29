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
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      async (err, tables) => {
        if (err) {
          console.error("TABLE QUERY ERROR:", err.message);
          process.exit(1);
        }

        const results = [];

        for (const table of tables) {
          await new Promise((resolve) => {
            const safeName = '"' + table.name.replace(/"/g, '""') + '"';

            db.get(
              `SELECT COUNT(*) AS count FROM ${safeName}`,
              (err, row) => {
                results.push({
                  table: table.name,
                  rows: err ? `ERROR: ${err.message}` : row.count
                });

                resolve();
              }
            );
          });
        }

        results.sort((a, b) => {
          if (typeof a.rows !== "number") return 1;
          if (typeof b.rows !== "number") return -1;
          return b.rows - a.rows;
        });

        console.table(results);

        db.close();
      }
    );
  }
);