/**
 * BVC Inventory ERP - Test Company Fixture
 */

import { masterDb, queryDb, runDb } from '../helpers/database';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = require('../../backend/config/database');

export interface TestCompany {
  id: number;
  code: string;
  name: string;
}

export async function createTestCompany(prefix = 'ISO'): Promise<TestCompany> {
  const stamp = Date.now().toString(36).toUpperCase();
  const code = `TEST_${prefix}_${stamp}`;
  const name = `Test Enterprise ${prefix} ${Date.now()}`;

  const compResult = await masterDb.run(
    `INSERT INTO companies (code, name, status) VALUES (?, ?, 'Active')`,
    [code, name]
  );

  const companyId = compResult.lastInsertRowid || compResult.lastID;
  await db.createCompanyDatabase(companyId, code);

  return {
    id: companyId,
    code,
    name
  };
}

export async function deleteTestCompany(companyId: number) {
  try {
    await masterDb.run(`DELETE FROM companies WHERE id = ?`, [companyId]);
    await masterDb.run(`DELETE FROM database_registry WHERE company_id = ?`, [companyId]);
  } catch (err: any) {
    console.warn(`Failed to cleanup company ${companyId}:`, err.message);
  }
}
