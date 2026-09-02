const sqlite3 = require('sqlite3').verbose()
const path = require('path')

const dbPath = path.join(__dirname, '../../database/bvc.db')
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message)
  } else {
    console.log('Connected to SQLite database')
    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON')
  }
})

module.exports = {
  query: (text, params) => {
    return new Promise((resolve, reject) => {
      db.all(text, params, (err, rows) => {
        if (err) reject(err)
        else resolve({ rows })
      })
    })
  },
  run: (text, params) => {
    return new Promise((resolve, reject) => {
      db.run(text, params, function(err) {
        if (err) reject(err)
        else resolve({ lastID: this.lastID, lastInsertRowid: this.lastID, changes: this.changes })
      })
    })
  },
  pool: {
    connect: () => Promise.resolve({
      query: (text, params) => {
        return new Promise((resolve, reject) => {
          if (text.trim().toUpperCase().startsWith('INSERT') ||
              text.trim().toUpperCase().startsWith('UPDATE') ||
              text.trim().toUpperCase().startsWith('DELETE')) {
            db.run(text, params, function(err) {
              if (err) reject(err)
              else resolve({ rows: [{ id: this.lastID }] })
            })
          } else {
            db.all(text, params, (err, rows) => {
              if (err) reject(err)
              else resolve({ rows })
            })
          }
        })
      },
      release: () => {}
    })
  }
}
