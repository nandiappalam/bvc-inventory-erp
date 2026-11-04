const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const databaseModule = path.resolve(__dirname, '../config/database.js');
const emptyPostgresEnvironment = {
  DATABASE_URL: '',
  POSTGRES_URL: '',
  NEON_DATABASE_URL: '',
  DATABASE_URI: '',
  PGURI: '',
};

function requireDatabaseWith(envOverrides) {
  return spawnSync(process.execPath, ['-e', `require(${JSON.stringify(databaseModule)})`], {
    encoding: 'utf8',
    env: {
      ...process.env,
      ...emptyPostgresEnvironment,
      ...envOverrides,
    },
  });
}

test('Render refuses to start in SQLite mode', () => {
  const result = requireDatabaseWith({
    RENDER: 'true',
    RENDER_SERVICE_ID: 'test-service',
    NODE_ENV: 'test',
    DB_ENGINE: 'sqlite',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Production requires PostgreSQL/);
});

test('production refuses to start without a PostgreSQL URL', () => {
  const result = requireDatabaseWith({
    RENDER: '',
    RENDER_SERVICE_ID: '',
    NODE_ENV: 'production',
    DB_ENGINE: 'postgres',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Production requires a PostgreSQL connection URL/);
});
