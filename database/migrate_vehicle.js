const db = require('../backend/config/database');

async function migrate() {
  try {
    // Create table if not exists (from schema)
    await db.run(`
      CREATE TABLE IF NOT EXISTS vehicle_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reference_type TEXT NOT NULL,
        reference_id INTEGER NOT NULL,
        movement_type TEXT NOT NULL,
        operation_type TEXT NOT NULL,
        vehicle_no TEXT NOT NULL,
        driver_name TEXT,
        transporter_id INTEGER,
        gate_in_time DATETIME,
        gate_out_time DATETIME,
        gross_weight REAL DEFAULT 0,
        tare_weight REAL DEFAULT 0,
        net_weight REAL DEFAULT 0,
        status TEXT DEFAULT 'IN',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (transporter_id) REFERENCES transport_master(id)
      )
    `);
    
    await db.run('CREATE INDEX IF NOT EXISTS idx_vehicle_ref ON vehicle_movements(reference_type, reference_id)');
    
    console.log('✓ vehicle_movements table ready');
    
    // Test query
    const test = await db.query('SELECT COUNT(*) as count FROM vehicle_movements');
    console.log('Vehicle movements count:', test.rows[0].count);
  } catch (e) {
    console.error('Migration failed:', e.message);
  }
}

migrate();

