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
      "SELECT * FROM ledgermaster",
      (err, rows) => {
        if (err) {
          console.error("QUERY ERROR:", err.message);
          process.exit(1);
        }

        console.table(rows);

        db.get(
          "PRAGMA page_count",
          (err, row) => {
            console.log("PAGE COUNT:", row);

            db.get(
              "PRAGMA page_size",
              (err, row) => {
                console.log("PAGE SIZE:", row);

                db.get(
                  "PRAGMA journal_mode",
                  (err, row) => {
                    console.log("JOURNAL MODE:", row);
                    db.close();
                  }
                );
              }
            );
          }
        );
      }
    );
  }
);