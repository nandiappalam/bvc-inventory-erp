const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./database/bvc.db");

db.all("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name", (err, rows) => {
    if (err) {
        console.error(err);
        return;
    }

    for (const row of rows) {
        console.log("\nTABLE:", row.name);
        console.log(row.sql);
    }

    db.close();
});
