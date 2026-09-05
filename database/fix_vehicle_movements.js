// Fix vehicle_movements table - make reference_type and other optional fields nullable
const db = require('../backend/config/database');

async function fix() {
  try {
    // Check current column info
    const info = await db.query(`PRAGMA table_info(vehicle_movements)`);
    console.log('Current table info:');
    info.rows.forEach(row => console.log(row));
    
    // Find reference_type column
    const refTypeCol = info.rows.find(c => c.name === 'reference_type');
    console.log('\nreference_type column:', refTypeCol);
    
    // If it's NOT NULL, we need to recreate the table
    if (refTypeCol && refTypeCol.notnull === 1) {
      console.log('\nRecreating table with nullable reference_type...');
      
      // Rename old table
      await db.run(`ALTER TABLE vehicle_movements RENAME TO vehicle_movements_old`);
      console.log('✓ Renamed old table');
      
      // Create new table with nullable reference_type
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
      console.log('✓ Created new table');
      
      // Copy data from old table (handling nullable reference_type)
      await db.run(`
        INSERT INTO vehicle_movements (
          id, reference_type, reference_id, movement_type, operation_type,
          vehicle_no, driver_name, transporter_id,
          gate_in_time, gate_out_time,
          gross_weight, tare_weight, net_weight, status, created_at
        )
        SELECT 
          id, NULL, reference_id, movement_type, operation_type,
          vehicle_no, driver_name, transporter_id,
          gate_in_time, gate_out_time,
          gross_weight, tare_weight, net_weight, status, created_at
        FROM vehicle_movements_old
      `);
      console.log('✓ Copied data');
      
      // Drop old table
      await db.run(`DROP TABLE vehicle_movements_old`);
      console.log('✓ Dropped old table');
      
      console.log('\n✓ Success: reference_type is now nullable');
    } else {
      console.log('✓ reference_type is already nullable');
    }
    
    // Verify fix
    const verify = await db.query(`PRAGMA table_info(vehicle_movements)`);
    const verifyCol = verify.rows.find(c => c.name === 'reference_type');
    console.log('\nVerified column:', verifyCol);
    
  } catch (err) {
    console.error('Fix error:', err.message);
    
    // Try to recover if old table exists
    try {
      const check = await db.query(`SELECT name FROM sqlite_master WHERE type='table' AND name='vehicle_movements_old'`);
      if (check.rows.length > 0) {
        await db.run(`ALTER TABLE vehicle_movements_old RENAME TO vehicle_movements`);
        console.log('✓ Recovered original table');
      }
    } catch (e) {}
  }
  
  process.exit();
}

fix();
