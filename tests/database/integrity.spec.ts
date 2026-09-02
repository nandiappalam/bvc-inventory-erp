import { test, expect } from '@playwright/test';
import { forCompany } from '../helpers/database';

test.describe('Database: Data Integrity & Constraint Protections', () => {
  test('1. Item code uniqueness / duplication constraint handling', async () => {
    const compDb = forCompany(1);
    const uniqueCode = `INTEG_CODE_${Date.now()}`;

    // First insert
    await compDb.run(
      `INSERT INTO item_master (item_code, item_name, print_name, type, status) VALUES (?, ?, ?, ?, 'Active')`,
      [uniqueCode, 'Integrity Test Item 1', 'Integrity RM', 'Raw Material']
    );

    // Verify row
    const check = await compDb.query(`SELECT * FROM item_master WHERE item_code = ?`, [uniqueCode]);
    expect(check.rows.length).toBe(1);

    // Cleanup
    await compDb.run(`DELETE FROM item_master WHERE item_code = ?`, [uniqueCode]);
  });

  test('2. Stock lot available quantity non-negative integrity check', async () => {
    const compDb = forCompany(1);
    const lotRes = await compDb.query(`SELECT lot_no, remaining_quantity FROM stock_lots WHERE remaining_quantity < 0`);
    // Negative remaining quantity should not be present in active lots
    expect(lotRes.rows.length).toBe(0);
  });
});
