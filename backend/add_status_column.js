const db = require('./config/database')

async function addStatusToItemMaster() {
  console.log('Adding status column to item_master...')
  
  try {
    // Check if status column exists
    const result = await db.query('PRAGMA table_info(item_master)')
    const columns = result.rows.map(r => r.name)
    console.log('Current columns:', columns)
    
    if (!columns.includes('status')) {
      await db.run('ALTER TABLE item_master ADD COLUMN status TEXT DEFAULT "Active"')
      console.log('✓ Added status column to item_master')
    } else {
      console.log('✓ item_master already has status column')
    }
    
    // Insert sample items
    console.log('\nInserting sample items...')
    const items = [
      { item_code: 'URD001', item_name: 'Urad Dal', print_name: 'URAD DAL', item_group: 'Pulses', status: 'Active' },
      { item_code: 'MOO001', item_name: 'Moong Dal', print_name: 'MOONG DAL', item_group: 'Pulses', status: 'Active' },
      { item_code: 'MAS001', item_name: 'Masur Dal', print_name: 'MASUR DAL', item_group: 'Pulses', status: 'Active' },
    ]
    
    for (const item of items) {
      try {
        await db.run(
          'INSERT INTO item_master (item_code, item_name, print_name, item_group, status) VALUES (?, ?, ?, ?, ?)',
          [item.item_code, item.item_name, item.print_name, item.item_group, item.status]
        )
        console.log(`✓ Inserted: ${item.item_name}`)
      } catch (e) {
        if (e.message.includes('UNIQUE constraint failed')) {
          console.log(`- Already exists: ${item.item_name}`)
        } else {
          console.log(`✗ Error: ${e.message}`)
        }
      }
    }
    
    console.log('\n✓ Done!')
  } catch (error) {
    console.log('Error:', error.message)
  }
  
  process.exit(0)
}

addStatusToItemMaster()
