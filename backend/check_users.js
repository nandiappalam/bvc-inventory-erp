const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database/bvc.db');

console.log('=== Companies ===');
db.all("SELECT * FROM companies", [], (err, rows) => {
  if (err) console.error(err);
  else console.log(JSON.stringify(rows, null, 2));
  
  console.log('\n=== Users ===');
  db.all("SELECT id, username, company_id, role FROM users", [], (err, rows) => {
    if (err) console.error(err);
    else console.log(JSON.stringify(rows, null, 2));
    
    console.log('\n=== Check admin for company 1 ===');
    db.all("SELECT * FROM users WHERE username = 'admin' AND company_id = 1", [], (err, rows) => {
      if (err) console.error(err);
      else console.log(JSON.stringify(rows, null, 2));
      db.close();
    });
  });
});
