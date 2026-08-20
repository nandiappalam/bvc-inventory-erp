const db = require('./config/database')

const seedData = async () => {
  try {
    console.log('Starting seed process...')
    
    // First, let's add missing columns to users table
    try {
      await db.run(`ALTER TABLE users ADD COLUMN company_id INTEGER`)
      console.log('Added company_id column')
    } catch (e) {
      // Column might already exist
    }
    
    try {
      await db.run(`ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'Active'`)
      console.log('Added status column')
    } catch (e) {
      // Column might already exist
    }
    
    try {
      await db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'`)
      console.log('Added role column')
    } catch (e) {
      // Column might already exist
    }
    
    // Check if companies exist
    const companies = await db.query('SELECT * FROM companies ORDER BY id ASC LIMIT 1')
    let companyId = null
    
    if (companies.rows.length > 0) {
      companyId = companies.rows[0].id
      console.log('Using existing company:', companies.rows[0].name)
    } else {
      console.log('Creating default company...')
      const companyResult = await db.run(
        'INSERT INTO companies (name, address, gst_number, contact, email) VALUES (?, ?, ?, ?, ?)',
        ['BVC Company', '123 Main Street, City', '27AABCV1234A1Z5', '9876543210', 'info@bvc.com']
      )
      companyId = companyResult.lastID
      console.log('Company created with ID:', companyId)
    }
    
    console.log('Updating users with company_id:', companyId)
    
    // Delete existing users and create new ones
    await db.run('DELETE FROM users')
    console.log('Cleared users table')
    
    // Create admin user (password: admin123)
    const adminResult = await db.run(
      'INSERT INTO users (username, password_hash, role, status, company_id) VALUES (?, ?, ?, ?, ?)',
      ['admin', 'admin123', 'Admin', 'Active', companyId]
    )
    console.log('Admin user created with lastID:', adminResult.lastID)
    
    // Create staff user (password: staff123)
    const staffResult = await db.run(
      'INSERT INTO users (username, password_hash, role, status, company_id) VALUES (?, ?, ?, ?, ?)',
      ['staff', 'staff123', 'Staff', 'Active', companyId]
    )
    console.log('Staff user created with lastID:', staffResult.lastID)
    
    // Verify data using rowid as id (works with SERIAL type)
    const users = await db.query('SELECT rowid as id, username, role, company_id, status FROM users')
    console.log('Users in database:', JSON.stringify(users.rows, null, 2))
    
    console.log('Seed completed successfully!')
    console.log('')
    console.log('LOGIN CREDENTIALS:')
    console.log('Company: asm (select this from company list)')
    console.log('Admin: username=admin, password=admin123')
    console.log('Staff: username=staff, password=staff123')
    
    process.exit(0)
  } catch (error) {
    console.error('Seed error:', error)
    process.exit(1)
  }
}

seedData()
