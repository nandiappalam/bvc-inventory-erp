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
  assert.equal(draft.tableData[0].item_name, 'Urad');
  assert.equal(draft.tableData[0].qty, 100);
  assert.equal(draft.tableData[0].rate, 80);
  assert.equal(draft.tableData[0].per_unit_weight, 0.5);
  assert.equal(draft.tableData[0].total_weight, 50);
  assert.equal(draft.tableData[0].amount, '8000.00');
  assert.equal(draft.tableData[0].disc_percent, 0);
  assert.equal(draft.tableData[0].tax_rate, 0);
  assert.equal(draft.tableData[0].lot_no, '');
  assert.equal(draft.sourcePurchaseOrderId, 42);
});

test('buildReceiptDraftFromPurchaseOrder prefers approved quantity and preserves zero tax', () => {
  const draft = buildReceiptDraftFromPurchaseOrder({
    id: 7,
    tax_percent: 0,
    tax_rate: 5,
    items: [{
      item_name: 'Urad',
      requested_qty: 100,
      approved_qty: 40,
      qty: 100,
      rate: 80,
    }],
  });

  assert.equal(draft.tableData[0].qty, 40);
  assert.equal(draft.tableData[0].tax_rate, 0);
  assert.equal(draft.formData.tax_rate, 0);
});
