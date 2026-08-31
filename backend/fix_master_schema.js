const db = require('./config/database')

async function fixMasterSchema() {
  console.log('Fixing master tables schema...\n')
  
  // List of tables that need status column added
  const tablesToFix = [
    { name: 'item_master', hasStatus: true },
    { name: 'papad_company_master', hasStatus: true },
    { name: 'flour_mill_master', hasStatus: true },
    { name: 'customer_master', hasStatus: true },
    { name: 'supplier_master', hasStatus: true },
    { name: 'consignee_group_master', hasStatus: true },
    { name: 'sender_group_master', hasStatus: true },
    { name: 'ptrans_master', hasStatus: true },
    { name: 'transport_master', hasStatus: true },
    { name: 'weightmaster', hasStatus: false },
    { name: 'ledgergroupmaster', hasStatus: false },
    { name: 'ledgermaster', hasStatus: false },
    { name: 'item_groups', hasStatus: false },
    { name: 'deduction_sales', hasStatus: true },
    { name: 'deduction_purchase', hasStatus: true },
  ]
  
  for (const table of tablesToFix) {
    try {
      // Check if status column exists
      const result = await db.query(`PRAGMA table_info(${table.name})`)
      const columns = result.rows.map(r => r.name)
      
      if (!columns.includes('status')) {
        await db.run(`ALTER TABLE ${table.name} ADD COLUMN status TEXT DEFAULT 'Active'`)
        console.log(`✓ Added status column to ${table.name}`)
      } else {
        console.log(`✓ ${table.name} already has status column`)
      }
    } catch (error) {
      console.log(`✗ Error with ${table.name}: ${error.message}`)
    }
  }
  
  // Insert sample data for testing
  console.log('\nInserting sample data...')
  
  const sampleData = [
    // Cities
    { table: 'city_master', data: { name: 'Mumbai', print_name: 'MUMBAI', status: 'Active' } },
    { table: 'city_master', data: { name: 'Delhi', print_name: 'DELHI', status: 'Active' } },
    { table: 'city_master', data: { name: 'Surat', print_name: 'SURAT', status: 'Active' } },
    
    // Areas
    { table: 'area_master', data: { name: 'Station Road', print_name: 'STATION ROAD', status: 'Active' } },
    { table: 'area_master', data: { name: 'Ring Road', print_name: 'RING ROAD', status: 'Active' } },
    
    // Items
    { table: 'item_master', data: { item_code: 'URD001', item_name: 'Urad Dal', print_name: 'URAD DAL', item_group: 'Pulses', status: 'Active' } },
    { table: 'item_master', data: { item_code: 'MOO001', item_name: 'Moong Dal', print_name: 'MOONG DAL', item_group: 'Pulses', status: 'Active' } },
    { table: 'item_master', data: { item_code: 'MAS001', item_name: 'Masur Dal', print_name: 'MASUR DAL', item_group: 'Pulses', status: 'Active' } },
    
    // Item Groups
    { table: 'item_groups', data: { group_code: 'PLS', group_name: 'Pulses', print_name: 'PULSES', tax: 5 } },
    { table: 'item_groups', data: { group_code: 'GRM', group_name: 'Grains', print_name: 'GRAINS', tax: 0 } },
    
    // Suppliers
    { table: 'supplier_master', data: { name: 'ABC Traders', print_name: 'ABC TRADERS', contact_person: 'John Doe', address1: '123 Main St', area: 'Station Road', status: 'Active' } },
    { table: 'supplier_master', data: { name: 'XYZ Suppliers', print_name: 'XYZ SUPPLIERS', contact_person: 'Jane Smith', address1: '456 Market Rd', area: 'Ring Road', status: 'Active' } },
    
    // Customers
    { table: 'customer_master', data: { name: 'Customer A', print_name: 'CUSTOMER A', contact_person: 'Alice', address1: '789 Customer St', area: 'Station Road', status: 'Active' } },
    { table: 'customer_master', data: { name: 'Customer B', print_name: 'CUSTOMER B', contact_person: 'Bob', address1: '321 Buyer Ave', area: 'Ring Road', status: 'Active' } },
    
    // Papad Companies
    { table: 'papad_company_master', data: { name: 'Shree Papad', print_name: 'SHREE PAPAD', contact_person: 'Mr. Patel', address1: '100 Industrial Area', status: 'Active' } },
    { table: 'papad_company_master', data: { name: 'Amul Papad', print_name: 'AMUL PAPAD', contact_person: 'Mr. Shah', address1: '200 Food Park', status: 'Active' } },
    
    // Flour Mills
    { table: 'flour_mill_master', data: { flourmill: 'Premium Flour Mill', print_name: 'PREMIUM FLOUR MILL', contact_person: 'Mr. Kumar', address1: '50 Mill Road', status: 'Active' } },
    
    // PTrans
    { table: 'ptrans_master', data: { name: 'Gujarat Transport', print_name: 'GUJARAT TRANSPORT', status: 'Active' } },
    
    // Transport
    { table: 'transport_master', data: { name: 'Speedy Cargo', print_name: 'SPEEDY CARGO', status: 'Active' } },
    
    // Weights
    { table: 'weightmaster', data: { name: '1 KG', printname: '1 KG', weight: 1 } },
    { table: 'weightmaster', data: { name: '500 GM', printname: '500 GM', weight: 0.5 } },
    { table: 'weightmaster', data: { name: '1 GM', printname: '1 GM', weight: 0.001 } },
  ]
  
  for (const item of sampleData) {
    try {
      const fields = Object.keys(item.data)
      const values = Object.values(item.data)
      const placeholders = fields.map(() => '?').join(', ')
      
      await db.run(`INSERT INTO ${item.table} (${fields.join(', ')}) VALUES (${placeholders})`, values)
      console.log(`✓ Inserted into ${item.table}: ${item.data.name || item.data.item_name || item.data.flourmill || item.data.group_code}`)
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        console.log(`- Already exists in ${item.table}`)
      } else {
        console.log(`✗ Error inserting into ${item.table}: ${error.message}`)
      }
    }
  }
  
  console.log('\n✓ Schema fix complete!')
  
  // Verify
  console.log('\nVerifying tables...')
  const tables = ['city_master', 'area_master', 'item_master', 'supplier_master', 'customer_master', 'papad_company_master', 'flour_mill_master']
  for (const table of tables) {
    try {
      const result = await db.query(`SELECT COUNT(*) as cnt FROM ${table}`)
      console.log(`  ${table}: ${result.rows[0].cnt} records`)
    } catch (error) {
      console.log(`  ${table}: Error - ${error.message}`)
    }
  }
}

fixMasterSchema().then(() => process.exit(0)).catch(err => {
  console.error(err)
  process.exit(1)
})
