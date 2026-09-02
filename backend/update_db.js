const db = require('./config/database')

async function updateDatabase() {
  try {
    // Add updated_at column to flour_out table
    await db.run('ALTER TABLE flour_out ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP')

    console.log('Database updated successfully!')
  } catch (error) {
    console.error('Error updating database:', error.message)
  }
}

updateDatabase()
