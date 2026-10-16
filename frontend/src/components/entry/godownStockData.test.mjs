import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterGodownStockRows,
  getPurchaseLotNumber,
  getRowsForGodown,
  getStockCategory
} from './godownStockData.mjs';

const report = (godownId, items) => ({ godown_id: godownId, items });

test('getRowsForGodown selects only the requested godown and normalizes available quantities', () => {
  const rows = getRowsForGodown({
    success: true,
    data: [
      report(1, [{ godown_id: 1, item_name: 'Rice', qty: 8 }]),
      report(2, [
        { godown_id: 2, item_name: 'Dal', item_code: 'DAL1', lot_no: 'LOT2', available_qty: '12', unit: 'kg' },
        { godown_id: 1, item_name: 'Other godown row', qty: 80 }
      ])
    ]
  }, '2');

  assert.deepEqual(rows, [{
    godown_id: 2,
    item_name: 'Dal',
    item_code: 'DAL1',
    lot_no: 'LOT2',
    stock_category: 'RM',
    available_qty: 12,
    unit: 'kg'
  }]);
});

test('getRowsForGodown returns an empty list for a selected godown with no report rows', () => {
  assert.deepEqual(getRowsForGodown([report(1, [])], 1), []);
});

test('getRowsForGodown surfaces API errors and invalid responses', () => {
  assert.throws(() => getRowsForGodown({ success: false, message: 'Report unavailable' }, 1), /Report unavailable/);
  assert.throws(() => getRowsForGodown({ data: null }, 1), /invalid response/);
});

test('filterGodownStockRows searches item name, item code, and lot and hides zero stock by default', () => {
  const rows = [
    { item_name: 'Broken Rice', item_code: 'BR01', lot_no: 'LOT10', available_qty: 5 },
    { item_name: 'Chana Dal', item_code: 'CD02', lot_no: 'LOT20', available_qty: 0 }
  ];

  assert.deepEqual(filterGodownStockRows(rows, 'cd02', false), []);
  assert.equal(filterGodownStockRows(rows, 'cd02', true).length, 1);
  assert.equal(filterGodownStockRows(rows, 'lot10', false).length, 1);
  assert.equal(filterGodownStockRows(rows, 'broken', false).length, 1);
});

test('getStockCategory separates vacuum, waste, finished goods, and raw materials', () => {
  assert.equal(getStockCategory({ item_name: 'Vaccum Pack', category: 'FG' }), 'Vacuum');
  assert.equal(getStockCategory({ item_name: 'Vacuum GN', has_processed_record: true }), 'Vacuum');
  assert.equal(getStockCategory({ item_name: 'Rice Husk', category: 'RM' }), 'Waste');
  assert.equal(getStockCategory({ item_name: 'Elevator Waste', category: 'Wastage' }), 'Waste');
  assert.equal(getStockCategory({ item_name: 'Papad', category: 'FG' }), 'FG');
  assert.equal(getStockCategory({ item_name: 'Processed Broken Rice', category: 'FG' }), 'FG');
  assert.equal(getStockCategory({ item_name: 'Processed Broken Rice', has_processed_record: true }), 'FG');
  assert.equal(getStockCategory({ item_name: 'Elevator Waste', has_waste_record: true }), 'Waste');
  assert.equal(getStockCategory({ item_name: 'Broken Rice', category: 'RM' }), 'RM');
});

test('getPurchaseLotNumber prefers the purchase lot and resolves cold-storage lot prefixes', () => {
  assert.equal(getPurchaseLotNumber({
    purchase_lot_no: 'LOT0014',
    lot_no: 'CS-LOT0014',
    stock_location_type: 'cold-storage'
  }), 'LOT0014');
  assert.equal(getPurchaseLotNumber({
    lot_no: 'CS-LOT0014',
    stock_location_type: 'cold-storage'
  }), 'LOT0014');
  assert.equal(getPurchaseLotNumber({ lot_no: 'LOT0014' }), null);
});

test('filterGodownStockRows filters rows by the selected stock category', () => {
  const rows = [
    { item_name: 'Rice Husk', stock_category: 'Waste', available_qty: 2 },
    { item_name: 'Papad', stock_category: 'FG', available_qty: 3 }
  ];
  assert.deepEqual(filterGodownStockRows(rows, '', false, 'Waste'), [rows[0]]);
  assert.deepEqual(filterGodownStockRows(rows, '', false, 'FG'), [rows[1]]);
});
