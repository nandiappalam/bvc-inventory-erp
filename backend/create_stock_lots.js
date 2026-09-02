const db = require('./config/database')

async function createStockLotsTable() {
  console.log('Creating stock_lots table...')
  
  try {
    // Create stock_lots table for FIFO tracking
    await db.run(`
      CREATE TABLE IF NOT EXISTS stock_lots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL,
        lot_no TEXT NOT NULL,
        purchase_id INTEGER,
        quantity REAL NOT NULL,
        remaining_quantity REAL NOT NULL,
        rate REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (item_id) REFERENCES item_master(id),
        FOREIGN KEY (purchase_id) REFERENCES purchases(id)
      )
    `)
    console.log('✓ stock_lots table created')
    
    // Create index for faster queries
    await db.run(`
      CREATE INDEX IF NOT EXISTS idx_stock_lots_item 
      ON stock_lots(item_id, remaining_quantity)
    `)
    console.log('✓ Index created on stock_lots')
    
    // Check if sales_items table needs lot tracking columns
    const salesItemsColumns = await db.query('PRAGMA table_info(sales_items)')
    const columnNames = salesItemsColumns.rows.map(c => c.name)
    
    if (!columnNames.includes('lot_id')) {
      await db.run('ALTER TABLE sales_items ADD COLUMN lot_id INTEGER')
      console.log('✓ Added lot_id column to sales_items')
    }
    
    if (!columnNames.includes('lot_no')) {
      await db.run('ALTER TABLE sales_items ADD COLUMN lot_no TEXT')
      console.log('✓ Added lot_no column to sales_items')
    }
    
    console.log('\n✓ Stock lots table setup complete!')
    
  } catch (error) {
    console.log('Error:', error.message)
  }
  
  process.exit(0)
}

createStockLotsTable()
