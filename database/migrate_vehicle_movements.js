// Quick migration to add vehicle_movements table
const db = require('../backend/config/database');

async function migrate() {
  try {
    // Check if table exists
    const check = await db.query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='vehicle_movements'
    `);
    
    if (check.rows.length === 0) {
      // Create table
      await db.run(`
CREATE TABLE vehicle_movements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          reference_type TEXT,
          reference_id INTEGER,
          movement_type TEXT,
          operation_type TEXT,
          vehicle_no TEXT NOT NULL,
          driver_name TEXT,
          transporter_id INTEGER,
          gate_in_time DATETIME,
          gate_out_time DATETIME,
          gross_weight REAL DEFAULT 0,
          tare_weight REAL DEFAULT 0,
          net_weight REAL DEFAULT 0,
          status TEXT DEFAULT 'IN',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✓ vehicle_movements table created');
    } else {
      console.log('✓ vehicle_movements table already exists');
    }
    
    // Verify
    const verify = await db.query('SELECT COUNT(*) as count FROM vehicle_movements');
    console.log('Current records:', verify.rows[0].count);
    
  } catch (err) {
    console.error('Migration error:', err.message);
  }
  
  process.exit();
}

migrate();
