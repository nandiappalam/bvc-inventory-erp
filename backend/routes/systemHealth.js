/**
 * System Health & Diagnostic Endpoints
 */

const express = require('express');
const router = express.Router();
const databaseHealth = require('../services/DatabaseHealthService');
const errorLogger = require('../services/ErrorLoggerService');
const { authMiddleware } = require('../middleware/authMiddleware');

// Public lightweight health check (used by Render, load balancers, and frontend ping)
router.get('/health', async (req, res) => {
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

module.exports = router;
