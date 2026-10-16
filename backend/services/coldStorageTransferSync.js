const db = require('../config/database');

const transferReference = transfer =>
  `Auto-created from Godown Transfer ${transfer.s_no} (ID ${transfer.id})`;

const createVoucherForTransfer = async transfer => {
  const remarks = transferReference(transfer);
  const existing = await db.query(
    'SELECT id FROM cold_storage_vouchers WHERE remarks = ? LIMIT 1',
    [remarks]
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const lastVoucher = await db.query(
    "SELECT voucher_no FROM cold_storage_vouchers WHERE voucher_type = 'IN' ORDER BY id DESC LIMIT 1"
  );
  const lastNumber = Number(String(lastVoucher.rows[0]?.voucher_no || '').replace(/\D/g, '')) || 0;
  const voucherNo = `CSI-${String(lastNumber + 1).padStart(6, '0')}`;
  const quantity = Number(transfer.qty) || 0;
  const totalWeight = Number(transfer.weight) || 0;
  const perUnitWeight = quantity > 0 ? totalWeight / quantity : 0;
  const itemResult = await db.query(
    'SELECT id, unit FROM item_master WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?)) LIMIT 1',
    [transfer.item_name]
  );
  const item = itemResult.rows[0];
  const lotNo = transfer.lot_no || 'LOT-TRANSFER';
  const coldStorageLot = lotNo.startsWith('CS-') ? lotNo : `CS-${lotNo}`;
  const voucherResult = await db.run(`
    INSERT INTO cold_storage_vouchers (
      voucher_no, voucher_type, voucher_date, cold_storage_id, cold_storage_name,
      source_godown_id, source_godown_name, remarks, total_qty, total_wt
    ) VALUES (?, 'IN', ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    voucherNo,
    transfer.transfer_date || new Date().toISOString().split('T')[0],
    transfer.to_godown_id,
    transfer.resolved_to_godown_name || transfer.to_godown_name,
    transfer.from_godown_id,
    transfer.resolved_from_godown_name || transfer.from_godown_name || '',
    remarks,
    quantity,
    totalWeight
  ]);

  let voucherId = voucherResult.rows?.[0]?.id || voucherResult.lastID || voucherResult.lastInsertRowid;
  if (!voucherId) {
    const lookup = await db.query('SELECT id FROM cold_storage_vouchers WHERE voucher_no = ?', [voucherNo]);
    voucherId = lookup.rows[0]?.id;
  }
  if (!voucherId) throw new Error(`Cold-storage transfer voucher ${voucherNo} was not saved.`);

  await db.run(`
    INSERT INTO cold_storage_items (
      voucher_id, voucher_no, item_id, item_name, purchase_lot_no, cold_storage_lot_no,
      quantity, weight, total_wt, unit, remarks
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    voucherId,
    voucherNo,
    item?.id || null,
    transfer.item_name,
    lotNo,
    coldStorageLot,
    quantity,
    perUnitWeight,
    totalWeight,
    item?.unit || 'KG',
    `Godown Transfer ${transfer.s_no}`
  ]);
  return voucherId;
};

const syncGodownTransfersToColdStorage = async () => {
  const result = await db.query(`
    SELECT gt.*,
      COALESCE(NULLIF(destination.godown_name, ''), gt.to_godown_name) AS resolved_to_godown_name,
      COALESCE(NULLIF(source.godown_name, ''), gt.from_godown_name) AS resolved_from_godown_name
    FROM godown_transfers gt
    LEFT JOIN godown_master destination ON CAST(destination.id AS TEXT) = CAST(gt.to_godown_id AS TEXT)
    LEFT JOIN godown_master source ON CAST(source.id AS TEXT) = CAST(gt.from_godown_id AS TEXT)
    WHERE (
      LOWER(COALESCE(destination.godown_name, gt.to_godown_name, '')) LIKE '%cold%'
      OR LOWER(COALESCE(destination.godown_type, '')) LIKE '%cold%'
      OR LOWER(COALESCE(destination.storage_location, '')) LIKE '%outside%'
    )
    AND NOT EXISTS (
      SELECT 1 FROM cold_storage_vouchers csv
      WHERE csv.remarks = 'Auto-created from Godown Transfer ' || gt.s_no || ' (ID ' || gt.id || ')'
    )
    ORDER BY gt.id
  `);

  for (const transfer of result.rows || []) {
    await createVoucherForTransfer(transfer);
  }
};

module.exports = { createVoucherForTransfer, syncGodownTransfersToColdStorage };
