const db = require('./config/database');

async function createLedgerEntriesTable() {
  try {
    console.log('Creating ledger_entries table...');
    
    // Create ledger_entries table
    await db.run(`
      CREATE TABLE IF NOT EXISTS ledger_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ledger_id INTEGER,
        ledger_name TEXT NOT NULL,
        date DATE NOT NULL,
        voucher_type TEXT NOT NULL,
        voucher_no TEXT,
        debit REAL DEFAULT 0,
        credit REAL DEFAULT 0,
        reference_id INTEGER,
        reference_type TEXT,
        particulars TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ledger_id) REFERENCES ledgermaster(id)
      )
    `);
    console.log('✓ ledger_entries table created');
    
    // Create indexes
    await db.run('CREATE INDEX IF NOT EXISTS idx_ledger_entries_date ON ledger_entries(date)');
    await db.run('CREATE INDEX IF NOT EXISTS idx_ledger_entries_ledger_id ON ledger_entries(ledger_id)');
    await db.run('CREATE INDEX IF NOT EXISTS idx_ledger_entries_voucher ON ledger_entries(voucher_type, voucher_no)');
    console.log('✓ Indexes created');
    
    console.log('\n✅ ledger_entries table setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error creating ledger_entries table:', error);
    process.exit(1);
  }
}

createLedgerEntriesTable();
