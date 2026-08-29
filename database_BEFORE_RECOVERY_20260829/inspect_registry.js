const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database(
  "./database/master.db",
  sqlite3.OPEN_READONLY,
  (err) => {
    if (err) {
      console.error("OPEN ERROR:", err.message);
      process.exit(1);
    }

    db.all(
      "SELECT * FROM companies",
      (err, rows) => {
        if (err) {
          console.error("COMPANIES ERROR:", err.message);
          process.exit(1);
        }

        console.log("=== COMPANIES ===");
        console.table(rows);

        db.all(
          "SELECT * FROM database_registry",
          (err, rows) => {
            if (err) {
              console.error("REGISTRY ERROR:", err.message);
              process.exit(1);
            }

            console.log("=== DATABASE REGISTRY ===");
            console.table(rows);

            db.close();
          }
        );
      }
    );
  }
);