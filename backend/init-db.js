require('dotenv').config()
const sqlite3 = require('sqlite3').verbose()
const fs = require('fs')
const path = require('path')

async function initDatabase() {
  const dbPath = path.join(__dirname, '../database/bvc.db')
  const db = new sqlite3.Database(dbPath)

  try {
    console.log('Connecting to database...')

    // Read schema file
    const schemaPath = path.join(__dirname, '../database/schema.sql')
    const schema = fs.readFileSync(schemaPath, 'utf8')

    // Split schema into individual statements
    const statements = schema.split(';').filter(stmt => stmt.trim().length > 0)

    console.log('Running schema...')

    for (const statement of statements) {
      if (statement.trim()) {
        await new Promise((resolve, reject) => {
          db.run(statement, (err) => {
            if (err) reject(err)
            else resolve()
          })
        })
      }
    }

    console.log('Database initialized successfully!')

    // Test the connection
    const result = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM purchases', (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    })
    console.log(`Purchases table has ${result.count} records`)

  } catch (error) {
    console.error('Error initializing database:', error)
  } finally {
    db.close()
  }
}

initDatabase()
