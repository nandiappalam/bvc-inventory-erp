/**
 * System Health & Diagnostic Endpoints
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const databaseHealth = require('../services/DatabaseHealthService');
const errorLogger = require('../services/ErrorLoggerService');
const { authMiddleware } = require('../middleware/authMiddleware');

// Public lightweight health check (used by Render, load balancers, and frontend ping)
router.get(['/health', '/system-health'], async (req, res) => {
  const health = await databaseHealth.checkDatabaseHealth();
  const statusCode = health.database === 'HEALTHY' ? 200 : 503;
  res.status(statusCode).json({
    status: health.ready ? 'OK' : 'INITIALIZING',
    database: health.engine,
    databaseStatus: health.database,
    ready: health.ready,
    uptimeSeconds: health.uptimeSeconds || 0,
    timestamp: health.timestamp,
  });
});

// Detailed system health diagnostics
router.get('/system/health', async (req, res) => {
  const health = await databaseHealth.checkDatabaseHealth();
  res.json({
    application: 'BVC Inventory ERP',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    systemStatus: health.status,
    ready: health.ready,
    database: {
      engine: health.engine,
      status: health.database,
      latencyMs: health.latencyMs,
    },
    uptimeSeconds: health.uptimeSeconds || 0,
    timestamp: new Date().toISOString(),
  });
});

// Administrative Error Audit Log
router.get('/system/errors', authMiddleware, (req, res) => {
  // Only Admin role can inspect system error diagnostics
  if (req.user && req.user.role !== 'Admin' && req.user.role !== 'admin' && req.user.role !== 'SuperAdmin') {
    return res.status(403).json({ success: false, message: 'Access denied. Administrator privileges required.' });
  }

  const limit = parseInt(req.query.limit, 10) || 50;
  const recentErrors = errorLogger.getRecentErrors(limit);
  res.json({
    success: true,
    count: recentErrors.length,
    errors: recentErrors,
  });
});

// Multi-Tenant Context Diagnostics Endpoint
router.get('/system/tenant-context', async (req, res) => {
  try {
    const isPostgres = db.isPostgres;
    const companyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const schema = req.companySchema || `company_${companyId}`;
    
    let currentSchema = 'unknown';
    let searchPath = 'unknown';
    let companyName = 'Unknown Company';
    let databaseName = isPostgres ? (process.env.DATABASE_URL ? 'Neon PostgreSQL' : 'PostgreSQL') : `company_${companyId}.db`;
    let tableCount = 0;
    let itemCount = 0;
    let purchaseCount = 0;
    let salesCount = 0;
    let registeredCompanies = [];

    // 1. Fetch registered companies from master database
    try {
      const compRes = await db.master.query('SELECT id, code, name, database_name, database_schema, status FROM companies ORDER BY id ASC');
      registeredCompanies = compRes.rows || [];
      const match = registeredCompanies.find(c => String(c.id) === String(companyId));
      if (match) {
        companyName = match.name;
        if (match.database_name) databaseName = match.database_name;
      }
    } catch (e) {
      console.warn('Notice querying companies in tenant-context:', e.message);
    }

    // 2. Query PostgreSQL schema & search_path diagnostics
    if (isPostgres) {
      try {
        const csRes = await db.query("SELECT current_schema() AS current_schema, current_setting('search_path') AS search_path");
        if (csRes.rows && csRes.rows[0]) {
          currentSchema = csRes.rows[0].current_schema;
          searchPath = csRes.rows[0].search_path;
        }
        
        const tblRes = await db.query(
          "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = ?",
          [schema]
        );
        tableCount = parseInt(tblRes.rows[0]?.count, 10) || 0;
      } catch (e) {
        console.warn('Notice querying pg diagnostics in tenant-context:', e.message);
      }
    } else {
      currentSchema = `company_${companyId}.db`;
      searchPath = 'local_sqlite';
      try {
        const tblRes = await db.query("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
        tableCount = parseInt(tblRes.rows[0]?.count, 10) || 0;
      } catch (_) {}
    }

    // 3. Query active tenant record counts
    try {
      const iRes = await db.query('SELECT COUNT(*) AS cnt FROM item_master');
      itemCount = parseInt(iRes.rows[0]?.cnt, 10) || 0;
    } catch (_) {}

    try {
      const pRes = await db.query('SELECT COUNT(*) AS cnt FROM purchases');
      purchaseCount = parseInt(pRes.rows[0]?.cnt, 10) || 0;
    } catch (_) {}

    try {
      const sRes = await db.query('SELECT COUNT(*) AS cnt FROM sales');
      salesCount = parseInt(sRes.rows[0]?.cnt, 10) || 0;
    } catch (_) {}

    res.json({
      mode: process.env.RENDER ? 'RENDER' : (isPostgres ? 'POSTGRES_REMOTE' : 'LOCAL_SQLITE'),
      database: isPostgres ? 'postgresql' : 'sqlite',
      companyId: companyId,
      companyName: companyName,
      schema: schema,
      databaseName: databaseName,
      server: process.env.RENDER ? 'Render' : 'Local/Container',
      sqliteEnabled: !isPostgres,
      current_schema: currentSchema,
      search_path: searchPath,
      tenant_tables_count: tableCount,
      active_records_summary: {
        items: itemCount,
        purchases: purchaseCount,
        sales: salesCount,
      },
      registered_companies: registeredCompanies.map(c => ({
        id: c.id,
        code: c.code,
        name: c.name,
        schema: c.database_schema || `company_${c.id}`,
        status: c.status
      }))
    });
  } catch (err) {
    console.error('Error serving tenant context diagnostics:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
