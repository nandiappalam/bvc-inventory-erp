import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReceiptDraftFromPurchaseOrder } from './poToReceipt.mjs';

test('buildReceiptDraftFromPurchaseOrder maps a PO to receipt draft fields', () => {
  const order = {
    id: 42,
    orderNo: 'PO-1001',
    supplier: 'ABC Suppliers',
    supplierId: '17',
    supplierAddress: 'Main Road',
    date: '2026-07-01',
    remarks: 'Need quality check',
    items: [
      { itemName: 'Urad', qty: 100, rate: 80, perUnitWeight: 0.5 },
      { itemName: 'Rice', qty: 50, rate: 45, perUnitWeight: 1 },
    ],
  };

  const draft = buildReceiptDraftFromPurchaseOrder(order);

  assert.equal(draft.formData.supplier_id, '17');
  assert.equal(draft.formData.supplier_details, 'Main Road');
  assert.equal(draft.formData.remarks, 'Need quality check');
  assert.equal(draft.tableData.length, 2);
  assert.deepEqual(draft.tableData[0], {
    item_name: 'Urad',
    qty: 100,
    rate: 80,
    per_unit_weight: 0.5,
    total_weight: 50,
    amount: 8000,
    disc_percent: 0,
    tax_rate: 0,
    lot_no: '',
  });
  assert.equal(draft.sourcePurchaseOrderId, 42);
});
