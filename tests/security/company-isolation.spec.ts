import { test, expect } from '@playwright/test';
import { createTestCompany, deleteTestCompany } from '../fixtures/company';
import { getTestItem } from '../fixtures/test-data';
import { forCompany } from '../helpers/database';

test.describe('🔒 Security: Strict Multi-Company Data & Tenant Isolation', () => {
  let companyA: any;
  let companyB: any;

  test.beforeAll(async () => {
    // Provision 2 completely isolated test companies
    companyA = await createTestCompany('ISOL_A');
    companyB = await createTestCompany('ISOL_B');
  });

  test.afterAll(async () => {
    if (companyA?.id) await deleteTestCompany(companyA.id);
    if (companyB?.id) await deleteTestCompany(companyB.id);
  });

  test('1. Master item created in Company A is strictly INVISIBLE in Company B', async () => {
    const itemA = getTestItem('_COMP_A');
    const compDbA = forCompany(companyA.id);
    const compDbB = forCompany(companyB.id);

    // Insert item into Company A
    await compDbA.run(
      `INSERT INTO item_master (item_code, item_name, print_name, type, status) VALUES (?, ?, ?, ?, 'Active')`,
      [itemA.item_code, itemA.item_name, itemA.print_name, itemA.type]
    );

    // Verify item exists in Company A
    const resA = await compDbA.query(`SELECT * FROM item_master WHERE item_code = ?`, [itemA.item_code]);
    expect(resA.rows.length).toBe(1);
    expect(resA.rows[0].item_name).toBe(itemA.item_name);

    // Verify item DOES NOT EXIST in Company B (Zero cross-tenant leakage)
    const resB = await compDbB.query(`SELECT * FROM item_master WHERE item_code = ?`, [itemA.item_code]);
    expect(resB.rows.length).toBe(0);
  });

  test('2. Transactions created in Company A do not leak into Company B stock or purchases', async () => {
    const compDbA = forCompany(companyA.id);
    const compDbB = forCompany(companyB.id);

    const testLotA = `LOT_ISOL_${Date.now()}`;
    await compDbA.run(
      `INSERT INTO stock_lots (lot_no, item_name, received_qty, available_qty, rate, status) VALUES (?, ?, ?, ?, ?, 'Active')`,
      [testLotA, 'Isolated Raw Material', 500, 500, 45]
    );

    // Company A has 1 lot
    const lotA = await compDbA.query(`SELECT * FROM stock_lots WHERE lot_no = ?`, [testLotA]);
    expect(lotA.rows.length).toBe(1);

    // Company B has 0 lots for testLotA
    const lotB = await compDbB.query(`SELECT * FROM stock_lots WHERE lot_no = ?`, [testLotA]);
    expect(lotB.rows.length).toBe(0);
  });

  test('3. Company B cannot update or delete records belonging to Company A', async () => {
    const compDbA = forCompany(companyA.id);
    const compDbB = forCompany(companyB.id);

    const testItem = getTestItem('_IMMUTABLE');
    await compDbA.run(
      `INSERT INTO item_master (item_code, item_name, print_name, type, status) VALUES (?, ?, ?, ?, 'Active')`,
      [testItem.item_code, testItem.item_name, testItem.print_name, testItem.type]
    );

    // Company B attempts to delete Company A's item
    const deleteResult = await compDbB.run(`DELETE FROM item_master WHERE item_code = ?`, [testItem.item_code]);
    // changes in Company B should be 0
    expect(deleteResult.changes || 0).toBe(0);

    // Company A's item remains intact
    const verifyA = await compDbA.query(`SELECT * FROM item_master WHERE item_code = ?`, [testItem.item_code]);
    expect(verifyA.rows.length).toBe(1);
  });
});
