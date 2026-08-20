// Database verification script
const db = require('./config/database');

async function checkDatabase() {
  try {
    // Check tables
    const tables = await db.query("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('stock_lots', 'stock', 'ledger_entries')");
    console.log('=== TABLES ===');
    console.log(tables.rows.map(t => t.name));
    
    // Check indexes on stock_lots
    const indexes = await db.query("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='stock_lots'");
    console.log('\n=== INDEXES ON stock_lots ===');
    console.log(indexes.rows.map(i => i.name));
    
    // Check sample data
    const stockLots = await db.query("SELECT * FROM stock_lots LIMIT 5");
    console.log('\n=== SAMPLE stock_lots DATA ===');
    console.log(stockLots.rows);
    
    const stock = await db.query("SELECT * FROM stock LIMIT 5");
    console.log('\n=== SAMPLE stock DATA ===');
    console.log(stock.rows);
    
    // Check ledger entries
    const ledger = await db.query("SELECT SUM(debit) as total_debit, SUM(credit) as total_credit FROM ledger_entries");
    console.log('\n=== LEDGER BALANCE ===');
    console.log(ledger.rows);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkDatabase();

