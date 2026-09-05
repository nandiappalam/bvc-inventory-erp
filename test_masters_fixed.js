const db = require('./backend/config/database');

const masters = [
  { table: 'supplier_master', nameField: 'name', name: 'Test Supplier 1' },
  { table: 'supplier_master', nameField: 'name', name: 'Test Supplier 2' },
  { table: 'customer_master', nameField: 'name', name: 'Test Customer' },
  { table: 'godown_master', nameField: 'godown_name', name: 'Main Godown' },
  { table: 'flour_mill_master', nameField: 'flourmill', name: 'Test Flour Mill' },
  { table: 'papad_company_master', nameField: 'name', name: 'Test Papad Co' }
];

masters.forEach(m => {
  db.run(`INSERT INTO ${m.table} (${m.nameField}, status) VALUES (?, 'Active')`, [m.name], function(err) {
    if (err) {
      console.log(`Failed ${m.table}:`, err.message);
    } else {
      console.log(`Added ${m.table}: ${m.name} (ID: ${this.lastID})`);
    }
  });
});
console.log('✅ Test masters inserted. Refresh browser!');
