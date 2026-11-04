const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const databaseDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'bvc-sqlite-tenant-test-'));
process.env.DB_ENGINE = 'sqlite';
process.env.BVC_SQLITE_DB_DIR = databaseDirectory;
process.env.JWT_SECRET = 'sqlite-tenant-test-secret-0123456789';

const db = require('../config/database');
const { hasCompanyAccess } = require('../middleware/authMiddleware');
const { rebuildStockLedger } = require('../utils/stockRebuilder');

test('company database accessors isolate records and leave empty Godown masters empty', async () => {
  try {
    assert.equal(db.isPostgres, false);
    assert.equal(path.basename(db.getDbPath(1)), 'company_1.db');
    assert.equal(path.basename(db.getDbPath(2)), 'company_2.db');
    assert.notEqual(db.getDbPath(1), db.getDbPath(2));

    const companyOne = db.forCompany(1);
    const companyTwo = db.forCompany(2);
    await companyOne.run('CREATE TABLE tenant_isolation_test (value TEXT)');
    await companyTwo.run('CREATE TABLE tenant_isolation_test (value TEXT)');
    await companyOne.run('INSERT INTO tenant_isolation_test (value) VALUES (?)', ['company-one']);
    await companyTwo.run('INSERT INTO tenant_isolation_test (value) VALUES (?)', ['company-two']);

    const rowsOne = await companyOne.all('SELECT value FROM tenant_isolation_test');
    const rowsTwo = await companyTwo.all('SELECT value FROM tenant_isolation_test');
    assert.deepEqual(rowsOne, [{ value: 'company-one' }]);
    assert.deepEqual(rowsTwo, [{ value: 'company-two' }]);

    await db.master.run(
      'INSERT INTO companies (id, name, status) VALUES (?, ?, ?)',
      [1, 'Company One', 'Active']
    );
    await db.master.run(
      'INSERT INTO companies (id, name, status) VALUES (?, ?, ?)',
      [2, 'Company Two', 'Active']
    );
    const user = await db.master.run(
      'INSERT INTO users (username, password_hash, role, company_id, status) VALUES (?, ?, ?, ?, ?)',
      ['audit-user', 'test-hash', 'SuperAdmin', 1, 'Active']
    );
    const userId = user.lastID || user.lastInsertRowid;
    await db.master.run(
      'INSERT INTO user_company_access (user_id, company_id) VALUES (?, ?)',
      [userId, 2]
    );
    assert.equal(await hasCompanyAccess(userId, 1), true);
    assert.equal(await hasCompanyAccess(userId, 2), true);
    assert.equal(await hasCompanyAccess(userId, 3), false);

    const companyA = db.forCompany(101);
    const companyB = db.forCompany(102);
    const companyC = db.forCompany(103);
    await companyA.run('INSERT INTO godown_master (godown_name, status) VALUES (?, ?)', ['A1', 'Active']);
    await companyA.run('INSERT INTO godown_master (godown_name, status) VALUES (?, ?)', ['A2', 'Active']);
    await companyB.run('INSERT INTO godown_master (godown_name, status) VALUES (?, ?)', ['B1', 'Active']);
    await companyB.run('INSERT INTO godown_master (godown_name, status) VALUES (?, ?)', ['B2', 'Active']);
    assert.deepEqual(await companyC.all('SELECT id FROM godown_master'), []);

    for (const companyId of [101, 102, 103]) {
      await db.asyncLocalStorage.run({ companyId }, () => rebuildStockLedger());
    }

    const godownNames = async (tenant) => (
      (await tenant.all('SELECT godown_name FROM godown_master ORDER BY id')).map(row => row.godown_name)
    );
    assert.deepEqual(await godownNames(companyA), ['A1', 'A2']);
    assert.deepEqual(await godownNames(companyB), ['B1', 'B2']);
    assert.deepEqual(await godownNames(companyC), []);
  } finally {
    await db.closeSqliteConnections();
    fs.rmSync(databaseDirectory, { recursive: true, force: true });
  }
});
