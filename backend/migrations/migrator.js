/**
 * BVC Inventory ERP — Migration System
 *
 * Manages database schema migrations in a safe, non-destructive way.
 * Migrations are versioned and tracked in the `migrations` table.
 * Each migration is repeat-safe (uses CREATE TABLE IF NOT EXISTS, etc.).
 *
 * Usage:
 *   const { runMigrations } = require('./migrations/migrator');
 *   await runMigrations();
 */
const db = require('../config/database');
const path = require('path');
const fs = require('fs');

// Migration files are loaded from this directory
const MIGRATIONS_DIR = path.join(__dirname);

/**
 * Get list of executed migration versions.
 */
async function getExecutedMigrations() {
  try {
    const result = await db.query('SELECT version FROM migrations ORDER BY version ASC');
    return result.rows.map(r => r.version);
  } catch (err) {
    // migrations table might not exist yet
    return [];
  }
}

/**
 * Load all migration files from the migrations directory.
 * Files must be named: NNN_description.js
 */
function loadMigrations() {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.match(/^\d{3}_.*\.js$/) && f !== 'migrator.js')
    .sort();

  const migrations = [];
  for (const file of files) {
    const mod = require(path.join(MIGRATIONS_DIR, file));
    if (mod.up && mod.down && mod.version) {
      migrations.push(mod);
    }
  }
  return migrations;
}

/**
 * Run all pending migrations.
 * Never deletes or drops existing data.
 */
async function runMigrations() {
  console.log('🔧 Running database migrations...');

  // Ensure migrations table exists
  await db.run(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const executed = await getExecutedMigrations();
  const allMigrations = loadMigrations();

  let ranCount = 0;
  for (const migration of allMigrations) {
    if (executed.includes(migration.version)) {
      console.log(`✓ Migration ${migration.version} (${migration.name}) already executed`);
      continue;
    }

    console.log(`→ Running migration ${migration.version} (${migration.name})...`);
    try {
      await migration.up();
      await db.run(
        'INSERT INTO migrations (version, name) VALUES (?, ?)',
        [migration.version, migration.name]
      );
      console.log(`✓ Migration ${migration.version} (${migration.name}) completed`);
      ranCount++;
    } catch (err) {
      console.error(`✗ Migration ${migration.version} (${migration.name}) failed:`, err.message);
      throw err;
    }
  }

  if (ranCount === 0) {
    console.log('✓ No pending migrations');
  } else {
    console.log(`✓ ${ranCount} migration(s) completed`);
  }
}

/**
 * Get current migration version.
 */
async function getCurrentVersion() {
  const result = await db.query('SELECT MAX(version) as version FROM migrations');
  return result.rows[0]?.version || 0;
}

module.exports = {
  runMigrations,
  getExecutedMigrations,
  loadMigrations,
  getCurrentVersion,
};
