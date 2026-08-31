/**
 * Database Health Service for BVC Inventory ERP
 * Performs non-blocking health checks, connection readiness, and engine diagnosis
 */

const db = require('../config/database');

class DatabaseHealthService {
  constructor() {
    this.isReady = false;
    this.startupTimestamp = new Date();
    this.lastHealthStatus = {
      status: 'INITIALIZING',
      engine: process.env.DATABASE_URL ? 'PostgreSQL' : 'SQLite',
      ready: false,
      timestamp: new Date().toISOString(),
    };
  }

  setReady(ready = true) {
    this.isReady = ready;
    this.lastHealthStatus.ready = ready;
    this.lastHealthStatus.status = ready ? 'READY' : 'DEGRADED';
  }

  async checkDatabaseHealth() {
    const startTime = Date.now();
    const isPostgres = !!process.env.DATABASE_URL;
    const engine = isPostgres ? 'PostgreSQL' : 'SQLite';

    try {
      // Execute lightweight probe
      const result = await db.query('SELECT 1 as alive');
      const latencyMs = Date.now() - startTime;

      const isAlive = !!(result && (result.rows || result.length));

      this.lastHealthStatus = {
        status: this.isReady ? 'READY' : 'STARTING',
        ready: this.isReady,
        engine,
        database: isAlive ? 'HEALTHY' : 'UNRESPONSIVE',
        latencyMs,
        uptimeSeconds: Math.floor((Date.now() - this.startupTimestamp.getTime()) / 1000),
        timestamp: new Date().toISOString(),
      };

      return this.lastHealthStatus;
    } catch (err) {
      this.lastHealthStatus = {
        status: 'DEGRADED',
        ready: false,
        engine,
        database: 'ERROR',
        error: err.message,
        timestamp: new Date().toISOString(),
      };

      return this.lastHealthStatus;
    }
  }
}

module.exports = new DatabaseHealthService();
