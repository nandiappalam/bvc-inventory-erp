// Test script for Lot Number Auto-Generation System
const db = require('./backend/config/database');

async function testLotSystem() {
  console.log('=== Testing Lot Number Auto-Generation System ===\n');
  
  // Test 1: Check if stock_lots table exists
  console.log('1. Checking stock_lots table...');
  try {
    const result = await db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='stock_lots'");
    console.log('   ✓ stock_lots table exists:', result.rows.length > 0);
  } catch(e) {
    console.log('   ✗ Error:', e.message);
  }
  
  // Test 2: Check indexes
  console.log('\n2. Checking stock indexes...');
  try {
    const result = await db.query("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE '%idx_stock%'");
    console.log('   ✓ Stock indexes found:', result.rows.map(r => r.name).join(', ') || 'None');
  } catch(e) {
    console.log('   ✗ Error:', e.message);
  }
  
  // Test 3: Get sample lots
  console.log('\n3. Checking existing lots...');
  try {
    const result = await db.query('SELECT * FROM stock_lots LIMIT 3');
    console.log('   ✓ Found lots:', result.rows.length);
    result.rows.forEach((lot, i) => {
      console.log(`   Lot ${i+1}: ${lot.lot_no} - ${lot.item_name} (Qty: ${lot.quantity}, Remaining: ${lot.remaining_quantity})`);
    });
  } catch(e) {
    console.log('   ✗ Error:', e.message);
  }
  
  // Test 4: Check purchase_items with lots
  console.log('\n4. Checking purchase items with lots...');
  try {
    const result = await db.query('SELECT * FROM purchase_items WHERE lot_no IS NOT NULL AND lot_no != "" LIMIT 3');
    console.log('   ✓ Purchase items with lots:', result.rows.length);
  } catch(e) {
    console.log('   ✗ Error:', e.message);
  }
  
  console.log('\n=== Test Complete ===');
  process.exit(0);
}

testLotSystem().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

