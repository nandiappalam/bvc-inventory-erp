import { test, expect } from '@playwright/test';
import { forCompany } from '../helpers/database';

test.describe('Database: Transactions & Atomic Rollback', () => {
  test('1. Transaction Rollback removes partial operations atomically', async () => {
    const compDb = forCompany(1);
    const conn = await compDb.getConnection();

    const testItemCode = `ROLLBACK_TEST_${Date.now()}`;

    try {
      await conn.beginTransaction();

      await conn.run(
        `INSERT INTO item_master (item_code, item_name, print_name, type, status) VALUES (?, ?, ?, ?, 'Active')`,
        [testItemCode, 'Rollback Candidate Item', 'Rollback RM', 'Raw Material']
      );

      // Verify row exists inside the active uncommitted transaction
      const innerCheck = await conn.query(`SELECT * FROM item_master WHERE item_code = ?`, [testItemCode]);
      expect(innerCheck.rows.length).toBe(1);

      // Trigger intentional rollback
      await conn.rollback();
    } catch (err) {
      await conn.rollback();
    } finally {
      conn.release();
    }

    // Verify row DOES NOT exist in database after rollback
    const postRollbackCheck = await compDb.query(`SELECT * FROM item_master WHERE item_code = ?`, [testItemCode]);
    expect(postRollbackCheck.rows.length).toBe(0);
  });

  test('2. Transaction Commit persists atomic changes correctly', async () => {
    const compDb = forCompany(1);
    const conn = await compDb.getConnection();

    const testItemCode = `COMMIT_TEST_${Date.now()}`;

    try {
      await conn.beginTransaction();

      await conn.run(
        `INSERT INTO item_master (item_code, item_name, print_name, type, status) VALUES (?, ?, ?, ?, 'Active')`,
        [testItemCode, 'Commit Candidate Item', 'Commit RM', 'Raw Material']
      );

      await conn.commit();
    } finally {
      conn.release();
    }

    // Verify row EXISTS in database after commit
    const postCommitCheck = await compDb.query(`SELECT * FROM item_master WHERE item_code = ?`, [testItemCode]);
    expect(postCommitCheck.rows.length).toBe(1);

    // Cleanup
    await compDb.run(`DELETE FROM item_master WHERE item_code = ?`, [testItemCode]);
  });
});
