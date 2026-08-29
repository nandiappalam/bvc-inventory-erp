const db = require('../backend/config/database');

// Migration for voucher system
async function migrate() {
  try {
    console.log('🚀 Starting voucher migration...');

    // Drop old vouchers table if exists (JSON version)
    await db.run('DROP TABLE IF EXISTS vouchers');
    console.log('✓ Old vouchers table dropped');

    // Ensure new tables exist (schema.sql already has CREATE IF NOT EXISTS)
    await db.run(`
      CREATE TABLE IF NOT EXISTS voucher (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        voucher_type TEXT NOT NULL,
        voucher_no TEXT UNIQUE NOT NULL,
        date DATE NOT NULL,
        reference_no TEXT,
        narration TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.run(`
      CREATE TABLE IF NOT EXISTS voucher_entry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        voucher_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('Dr','Cr')),
        ledger_id INTEGER,
        debit REAL DEFAULT 0 CHECK(debit >= 0),
        credit REAL DEFAULT 0 CHECK(credit >= 0),
        remarks TEXT,
        FOREIGN KEY (voucher_id) REFERENCES voucher(id) ON DELETE CASCADE,
        FOREIGN KEY (ledger_id) REFERENCES ledgermaster(id)
      )
    `);
    console.log('✓ New tables ensured');

    // Insert sample voucher for testing
    const sampleDate = new Date().toISOString().split('T')[0];
    const voucherId = await db.run(
      'INSERT INTO voucher (voucher_type, voucher_no, date, narration) VALUES (?, ?, ?, ?)',
      ['Payment', 'PAY001', sampleDate, 'Sample payment']
    ).then(({ lastInsertRowid }) => lastInsertRowid);

    await db.run(
      'INSERT INTO voucher_entry (voucher_id, type, ledger_id, debit, remarks) VALUES (?, ?, ?, ?, ?)',
      [voucherId, 'Dr', 1, 1000, 'Cash payment']
    );
    await db.run(
      'INSERT INTO voucher_entry (voucher_id, type, ledger_id, credit, remarks) VALUES (?, ?, ?, ?, ?)',
      [voucherId, 'Cr', 2, 1000, 'Supplier payment']
    );
    console.log('✓ Sample voucher PAY001 created');

    console.log('✅ Migration complete!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    db.close();
  }
}

migrate();

