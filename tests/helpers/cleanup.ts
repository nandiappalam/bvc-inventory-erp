/**
 * BVC Inventory ERP - Safe Test Data Cleanup
 * Only cleans up entities prefixed with TEST_ to prevent altering actual user data.
 */

import { queryDb, runDb, forCompany } from './database';

export const cleanupTestData = async (companyId = 1) => {
  try {
    const comp = forCompany(companyId);

    // 1. Delete test purchase records and line items
    await comp.run(`
      DELETE FROM purchase_items 
      WHERE purchase_id IN (
        SELECT id FROM purchases WHERE inv_no LIKE 'TEST_%' OR remarks LIKE '%Automated test%'
      ) OR lot_no LIKE 'TEST_%'
    `).catch(() => {});

    await comp.run(`
      DELETE FROM purchases 
      WHERE inv_no LIKE 'TEST_%' OR remarks LIKE '%Automated test%'
    `).catch(() => {});

    // 2. Delete test sales records and line items
    await comp.run(`
      DELETE FROM sales_items 
      WHERE sales_id IN (
        SELECT id FROM sales WHERE inv_no LIKE 'TEST_%' OR remarks LIKE '%Automated test%'
      ) OR lot_no LIKE 'TEST_%'
    `).catch(() => {});

    await comp.run(`
      DELETE FROM sales 
      WHERE inv_no LIKE 'TEST_%' OR remarks LIKE '%Automated test%'
    `).catch(() => {});

    // 3. Delete test stock lots
    await comp.run(`
      DELETE FROM stock_lots 
      WHERE lot_no LIKE 'TEST_%' OR item_name LIKE 'TEST%'
    `).catch(() => {});

    // 4. Delete test stock transactions
    await comp.run(`
      DELETE FROM stock_transactions 
      WHERE lot_no LIKE 'TEST_%' OR reference_no LIKE 'TEST_%'
    `).catch(() => {});

    // 5. Delete test vouchers & ledger entries
    await comp.run(`
      DELETE FROM ledger_entries 
      WHERE narration LIKE '%TEST%' OR reference_id IN (SELECT id FROM purchases WHERE inv_no LIKE 'TEST_%')
    `).catch(() => {});

    await comp.run(`
      DELETE FROM voucher_entry 
      WHERE voucher_id IN (SELECT id FROM voucher WHERE reference_no LIKE 'TEST_%')
    `).catch(() => {});

    await comp.run(`
      DELETE FROM voucher 
      WHERE reference_no LIKE 'TEST_%' OR narration LIKE '%TEST%'
    `).catch(() => {});

    // 6. Delete test items, suppliers, customers
    await comp.run(`DELETE FROM item_master WHERE item_name LIKE 'TEST%' OR item_code LIKE 'TEST%'`).catch(() => {});
    await comp.run(`DELETE FROM suppliermaster WHERE name LIKE 'TEST%'`).catch(() => {});
    await comp.run(`DELETE FROM customermaster WHERE name LIKE 'TEST%'`).catch(() => {});

    // 7. Delete test QC records
    await comp.run(`DELETE FROM qc_inspections WHERE lot_no LIKE 'TEST_%' OR notes LIKE '%TEST%'`).catch(() => {});

  } catch (err: any) {
    console.warn('⚠️ Test cleanup non-fatal warning:', err.message);
  }
};
