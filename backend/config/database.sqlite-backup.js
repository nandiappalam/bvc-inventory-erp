const sqlite3 = require('sqlite3').verbose()
const path = require('path')
const fs = require('fs')
const tenantContext = require('./tenantContext')

// Determine database path - support both development and production
let dbDir

// Render / server environment
if (process.env.DATABASE_URL) {
  dbDir = path.join(__dirname, '../../database')
}
// Local development
else {
  dbDir = path.join(__dirname, '../../database')
}

// Ensure database directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

const dbPath = path.join(dbDir, 'bvc.db')
console.log('Database path:', dbPath)

let db

function openDatabase() {
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening database:', err.message)
    } else {
      console.log('Connected to SQLite database at:', dbPath)
      db.serialize(() => {
        db.run('PRAGMA foreign_keys = ON')
        db.run('PRAGMA journal_mode = DELETE')
        db.run('PRAGMA synchronous = NORMAL')
        
        // Check for corruption on startup using a simple query and an integrity check
        db.get('SELECT name FROM sqlite_master LIMIT 1', [], (queryErr) => {
          if (queryErr) {
            const msg = (queryErr.message || '').toLowerCase()
            if (
              msg.includes('sqlite_corrupt') || 
              msg.includes('sqlite_notadb') || 
              msg.includes('malformed') || 
              msg.includes('corrupt') || 
              msg.includes('not a database') ||
              msg.includes('unsupported file format') ||
              msg.includes('unsupported')
            ) {
              handleCorruptedDatabase(queryErr.message)
              return
            }
          }
          
          db.get('PRAGMA integrity_check', [], (integrityErr, row) => {
            if (integrityErr) {
              const msg = (integrityErr.message || '').toLowerCase()
              if (
                msg.includes('corrupt') || 
                msg.includes('malformed') || 
                msg.includes('sqlite_notadb') || 
                msg.includes('not a database') ||
                msg.includes('unsupported file format') ||
                msg.includes('unsupported')
              ) {
                handleCorruptedDatabase(integrityErr.message)
                return
              }
            } else if (row && row.integrity_check && row.integrity_check !== 'ok' && row.integrity_check.toLowerCase().includes('corrupt')) {
              handleCorruptedDatabase(row.integrity_check)
            }
          })
        })
      })
    }
  })
}

function activeDatabase() {
  return tenantContext.getDatabase() || db
}

function handleCorruptedDatabase(reason) {
  console.error('🔥 CRITICAL DATABASE CORRUPTION DETECTED:', reason)
  console.error('🔄 Initiating self-healing: destroying and rebuilding database...')
  try {
    db.close(() => {
      deleteAndRebuild()
    })
  } catch (closeErr) {
    console.error('Failed to close corrupted database, attempting deletion anyway:', closeErr.message)
    deleteAndRebuild()
  }
}

function deleteAndRebuild() {
  try {
    const walPath = dbPath + '-wal'
    const shmPath = dbPath + '-shm'
    const journalPath = dbPath + '-journal'
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath)
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath)
    if (fs.existsSync(journalPath)) fs.unlinkSync(journalPath)
    console.log('🗑️ Successfully deleted corrupted database file:', dbPath)
  } catch (unlinkErr) {
    console.error('Failed to delete corrupted database file:', unlinkErr.message)
  }
  openDatabase()
}

openDatabase()

// Function to safely close current DB, overwrite with backup, and reopen DB
const restoreDatabase = (tempFilePath) => {
  return new Promise((resolve, reject) => {
    console.log('🔄 Restoring database from temp file:', tempFilePath)
    
    // Validate file is a valid SQLite database
    try {
      if (!fs.existsSync(tempFilePath)) {
        return reject(new Error('Uploaded file does not exist'));
      }
      const fd = fs.openSync(tempFilePath, 'r');
      const buffer = Buffer.alloc(15);
      fs.readSync(fd, buffer, 0, 15, 0);
      fs.closeSync(fd);
      if (buffer.toString() !== 'SQLite format 3') {
        return reject(new Error('Invalid database file format. Must be a valid SQLite database file.'));
      }
    } catch (err) {
      return reject(new Error('Failed to validate SQLite format: ' + err.message));
    }

    const cleanAuxFiles = () => {
      const walPath = dbPath + '-wal'
      const shmPath = dbPath + '-shm'
      const journalPath = dbPath + '-journal'
      try { if (fs.existsSync(walPath)) fs.unlinkSync(walPath) } catch (e) {}
      try { if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath) } catch (e) {}
      try { if (fs.existsSync(journalPath)) fs.unlinkSync(journalPath) } catch (e) {}
    }

    const doCopyAndReopen = () => {
      db.close((err) => {
        if (err) {
          console.error('Error closing database before restore:', err.message)
          // Proceed with restore attempt anyway
        }
        
        try {
          cleanAuxFiles()

          // Overwrite the database file
          fs.copyFileSync(tempFilePath, dbPath)
          console.log('✅ Database file overwritten successfully')

          cleanAuxFiles()
          
          // Reopen database
          db = new sqlite3.Database(dbPath, async (reopenErr) => {
            if (reopenErr) {
              console.error('Error reopening database after restore:', reopenErr.message)
              return reject(reopenErr)
            }
            
            console.log('✅ Reconnected to SQLite database after restore')
            db.serialize(() => {
              db.run('PRAGMA foreign_keys = ON')
              db.run('PRAGMA journal_mode = DELETE')
            })

            try {
              const autoMigrate = require('../autoMigrate')
              await autoMigrate()
              console.log('✅ Auto-migration completed after restore')
            } catch (migErr) {
              console.warn('Migration warning after restore:', migErr.message)
            }

            resolve()
          })
        } catch (copyErr) {
          console.error('Error copying backup database file:', copyErr.message)
          // Try to reopen current anyway to avoid leaving server dead
          db = new sqlite3.Database(dbPath, () => {
            db.run('PRAGMA foreign_keys = ON')
            db.run('PRAGMA journal_mode = DELETE')
          })
          reject(copyErr)
        }
      })
    }

    // Safely attempt WAL checkpoint before closing
    try {
      db.run('PRAGMA wal_checkpoint(TRUNCATE)', () => {
        doCopyAndReopen()
      })
    } catch (e) {
      doCopyAndReopen()
    }
  })
}

// Export functions to get DB path and restore (useful for API and Tauri)
class DbConnection {
  constructor(dbInstance) {
    this.db = dbInstance
  }

  beginTransaction() {
    return new Promise((resolve, reject) => {
      this.db.run('BEGIN TRANSACTION', (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  commit() {
    return new Promise((resolve, reject) => {
      this.db.run('COMMIT', (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  rollback() {
    return new Promise((resolve, reject) => {
      this.db.run('ROLLBACK', (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  query(text, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(text, params, (err, rows) => {
        if (err) reject(err)
        else resolve({ rows: rows || [] })
      })
    })
  }

  run(text, params = []) {
    // Debug: log exact SQL to pinpoint SQLite errors like near "ORDER": syntax error
    console.log('[SQL]', String(text).replace(/\s+/g,' ').trim())
    return new Promise((resolve, reject) => {
      this.db.run(text, params, function (err) {
        if (err) reject(err)
        else resolve({
          lastID: this.lastID,
          lastInsertRowid: this.lastID,
          changes: this.changes,
        })
      })
    })
  }

  release() {
    // SQLite doesn't need explicit connection release.
  }
}

module.exports = {
  getDbPath: () => dbPath,
  restoreDatabase,
  query: (text, params = []) => {
    return new Promise((resolve, reject) => {
      activeDatabase().all(text, params, (err, rows) => {
        if (err) reject(err)
        else resolve({ rows: rows || [] })
      })
    })
  },
  run: (text, params = []) => {
    try {
      console.log('[SQL-RUN]', String(text).replace(/\s+/g,' ').trim())
    } catch (e) {
      console.log('[SQL-RUN]', '<unprintable-sql>')
    }
    return new Promise((resolve, reject) => {
      activeDatabase().run(text, params, function (err) {
        if (err) reject(err)
        else resolve({ lastID: this.lastID, lastInsertRowid: this.lastID, changes: this.changes })
      })
    })
  },

  // ✅ Provides transaction-aware connection wrapper for modules that expect it.
  getConnection: async () => {
    return new DbConnection(activeDatabase())
  },

  pool: {
    connect: async () => {
      return new DbConnection(activeDatabase())
    }
  },
}

