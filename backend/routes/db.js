const express = require('express')
const router = express.Router()
const db = require('../config/database')
const multer = require('multer')
const fs = require('fs')
const path = require('path')

// Multer setup for temporary storage
const upload = multer({ dest: 'database/temp/' })

// Ensure temp directory exists
if (!fs.existsSync('database/temp/')) {
  fs.mkdirSync('database/temp/', { recursive: true })
}

// Download/Export database backup
router.get('/backup', async (req, res) => {
  try {
    const companyId = parseInt(req.headers['x-company-id'] || req.query.company_id || (req.user && req.user.company_id) || 1, 10);
    
    if (db.isPostgres) {
      // PostgreSQL: Export tenant schema tables as JSON backup
      const tablesRes = await db.master.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE'`,
        [`company_${companyId}`]
      );
      
      const backupData = {
        companyId,
        schema: `company_${companyId}`,
        exportedAt: new Date().toISOString(),
        tables: {}
      };

      const tables = (tablesRes.rows || []).map(r => r.table_name);
      for (const tbl of tables) {
        try {
          const rowsRes = await db.forCompany(companyId).query(`SELECT * FROM ${tbl}`);
          backupData.tables[tbl] = rowsRes.rows || [];
        } catch (tblErr) {
          console.warn(`Could not export table ${tbl}:`, tblErr.message);
        }
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="bvc_backup_company_${companyId}_${Date.now()}.json"`);
      return res.send(JSON.stringify(backupData, null, 2));
    }

    const dbPath = db.getDbPath(companyId);
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ message: 'Database file not found' });
    }

    // Flush any pending WAL checkpoint to ensure db contains all latest data before download
    try {
      await db.forCompany(companyId).run('PRAGMA wal_checkpoint(TRUNCATE)');
    } catch (e) {
      console.warn('WAL checkpoint before backup warning:', e.message);
    }
    
    // Set appropriate headers for file download
    res.setHeader('Content-Type', 'application/x-sqlite3');
    res.setHeader('Content-Disposition', `attachment; filename="bvc_backup_company_${companyId}.db"`);
    
    const fileStream = fs.createReadStream(dbPath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Database backup error:', error);
    res.status(500).json({ message: 'Failed to create database backup', error: error.message });
  }
});

// Upload/Restore database backup
router.post('/restore', upload.single('database'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No database file uploaded' })
    }
    
    const tempFilePath = req.file.path
    const companyId = req.headers['x-company-id'] || req.body.company_id || (req.user && req.user.company_id) || 1
    
    // Perform database restoration
    await db.restoreDatabase(tempFilePath, companyId)
    
    // Clean up temporary uploaded file
    try {
      fs.unlinkSync(tempFilePath)
    } catch (e) {
      console.warn('Could not delete temp uploaded file:', e.message)
    }
    
    res.json({ success: true, message: 'Database restored successfully!' })
  } catch (error) {
    console.error('Database restoration error:', error)
    // Clean up temporary file on failure too
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path)
      } catch (e) {}
    }
    res.status(500).json({ success: false, message: 'Failed to restore database', error: error.message })
  }
})

// Execute Query (SELECT) - returns array of results
router.post('/query', async (req, res) => {
  try {
    const { sql, params } = req.body
    
    if (!sql) {
      return res.status(400).json({ message: 'SQL query is required' })
    }
    
    // Only allow SELECT queries for security
    if (!sql.trim().toUpperCase().startsWith('SELECT')) {
      return res.status(400).json({ message: 'Only SELECT queries are allowed' })
    }
    
    const result = await db.query(sql, params || [])
    res.json(result.rows)
  } catch (error) {
    console.error('Query error:', error)
    res.status(500).json({ message: 'Error executing query', error: error.message })
  }
})

// Execute Statement (INSERT, UPDATE, DELETE)
router.post('/statement', async (req, res) => {
  try {
    const { sql, params } = req.body
    
    if (!sql) {
      return res.status(400).json({ message: 'SQL statement is required' })
    }
    
    // Block dangerous operations
    const upperSql = sql.trim().toUpperCase()
    if (upperSql.startsWith('DROP') || upperSql.startsWith('ALTER') || upperSql.startsWith('CREATE')) {
      return res.status(400).json({ message: 'DDL operations are not allowed' })
    }
    
    const result = await db.run(sql, params || [])
    res.json({ 
      message: 'Statement executed successfully',
      lastID: result.lastID,
      changes: result.changes
    })
  } catch (error) {
    console.error('Statement error:', error)
    res.status(500).json({ message: 'Error executing statement', error: error.message })
  }
})

module.exports = router
