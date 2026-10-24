const db = require('../config/database');
const {
  getColdStorageTariff,
  calculateStorageDays,
  calculateSlabStorageCharge,
  calculateLabourCharge,
  createOrUpdateColdStorageBill
} = require('./ColdStorageBillingService');

const transferReference = transfer =>
  `Auto-created from Godown Transfer ${transfer.s_no} (ID ${transfer.id})`;

// Handle Transfers INTO Cold Storage (Inward / CSI)
const createVoucherForTransfer = async (transfer, companyId = 1) => {
  const cId = parseInt(companyId, 10) || 1;
  const remarks = transferReference(transfer);
  const existing = await db.query(
    'SELECT id, voucher_no FROM cold_storage_vouchers WHERE remarks = ? LIMIT 1',
    [remarks],
    cId
  );
  let voucherId = existing.rows?.[0]?.id;
  let voucherNo = existing.rows?.[0]?.voucher_no;

  const toGodownId = transfer.to_godown_id;
  let tariff = null;
  try {
    tariff = await getColdStorageTariff(toGodownId, cId);
  } catch (_) {}

  if (!voucherNo) {
    const lastVoucher = await db.query(
      "SELECT voucher_no FROM cold_storage_vouchers WHERE voucher_type = 'IN' ORDER BY id DESC LIMIT 1",
      [],
      cId
    );
    const lastNumber = Number(String(lastVoucher.rows?.[0]?.voucher_no || '').replace(/\D/g, '')) || 0;
    voucherNo = `CSI-${String(lastNumber + 1).padStart(6, '0')}`;
  }
  const quantity = Number(transfer.qty) || 0;
  const totalWeight = Number(transfer.weight) || (quantity * 50);
  const perUnitWeight = quantity > 0 ? totalWeight / quantity : 50;

  const itemResult = await db.query(
    'SELECT id, unit FROM item_master WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?)) LIMIT 1',
    [transfer.item_name],
    cId
  );
  const item = itemResult.rows?.[0];
  const lotNo = transfer.lot_no || 'LOT-TRANSFER';
  const coldStorageLot = lotNo.startsWith('CS-') ? lotNo : `CS-${lotNo}`;

  const vehicleNo = transfer.vehicle_no || transfer.lorry_no || '';
  const driverName = transfer.driver_name || transfer.driver || '';
  const driverPhone = transfer.driver_phone || '';
  let transporterName = transfer.transporter_name || transfer.transporter || '';
  if (/^\d+$/.test(String(transporterName).trim())) {
    try {
      const tmRes = await db.query('SELECT print_name, name FROM transport_master WHERE id = ?', [transporterName], cId);
      if (tmRes.rows && tmRes.rows[0]) {
        transporterName = tmRes.rows[0].print_name || tmRes.rows[0].name;
      }
    } catch (_) {}
  }
  const loadmanName = transfer.loadman_name || transfer.worker_name || 'Inward Loadman Team';
  const loadmanCharges = parseFloat(transfer.loadman_charges || 0);
  const handlingRate = tariff?.inwardUnloadingRate || 0.50;
  const handlingAmount = parseFloat(transfer.handling_amount) > 0 ? parseFloat(transfer.handling_amount) : (loadmanCharges > 0 ? loadmanCharges : Number((totalWeight * handlingRate).toFixed(2)));
  const storageRate = parseFloat(transfer.storage_rate) > 0 ? parseFloat(transfer.storage_rate) : (tariff?.storageSlabs?.[0]?.rate || 0.20);
  const storageBasis = 'Per KG/Day';

  if (voucherId) {
    await db.run(`
      UPDATE cold_storage_vouchers SET
        vehicle_no = ?, driver_name = ?, driver_phone = ?, transporter_name = ?,
        loadman_name = ?, loadman_charges = ?, handling_amount = ?, storage_rate = ?,
        total_qty = ?, total_wt = ?
      WHERE id = ?
    `, [
      vehicleNo, driverName, driverPhone, transporterName,
      loadmanName, loadmanCharges, handlingAmount, storageRate,
      quantity, totalWeight, voucherId
    ], cId);

    await db.run(`
      UPDATE cold_storage_items SET
        quantity = ?, weight = ?, total_wt = ?, labour_charge = ?
      WHERE voucher_id = ?
    `, [quantity, perUnitWeight, totalWeight, handlingAmount, voucherId], cId);
  } else {
    const voucherResult = await db.run(`
      INSERT INTO cold_storage_vouchers (
        voucher_no, voucher_type, voucher_date, cold_storage_id, cold_storage_name,
        source_godown_id, source_godown_name, remarks, total_qty, total_wt,
        operator_id, operator_name, inward_source_type, handling_rate, handling_amount,
        storage_rate, storage_basis, vehicle_no, driver_name, driver_phone,
        transporter_name, loadman_name, loadman_charges, status
      ) VALUES (?, 'IN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Godown Transfer', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Confirmed')
    `, [
      voucherNo,
      transfer.transfer_date || new Date().toISOString().split('T')[0],
      transfer.to_godown_id,
      transfer.resolved_to_godown_name || transfer.to_godown_name,
      transfer.from_godown_id,
      transfer.resolved_from_godown_name || transfer.from_godown_name || '',
      remarks,
      quantity,
      totalWeight,
      tariff?.operatorId || null,
      tariff?.operatorName || 'Cold Storage Operator',
      handlingRate,
      handlingAmount,
      storageRate,
      storageBasis,
      vehicleNo,
      driverName,
      driverPhone,
      transporterName,
      loadmanName,
      handlingAmount
    ], cId);

    voucherId = voucherResult.rows?.[0]?.id || voucherResult.lastID || voucherResult.lastInsertRowid;
    if (!voucherId) {
      const lookup = await db.query('SELECT id FROM cold_storage_vouchers WHERE voucher_no = ?', [voucherNo], cId);
      voucherId = lookup.rows?.[0]?.id;
    }
    if (!voucherId) throw new Error(`Cold-storage transfer voucher ${voucherNo} was not saved.`);

    await db.run(`
      INSERT INTO cold_storage_items (
        voucher_id, voucher_no, item_id, item_name, purchase_lot_no, cold_storage_lot_no,
        quantity, weight, total_wt, unit, remarks,
        inward_date, remaining_quantity, remaining_weight, labour_charge
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      `Godown Transfer ${transfer.s_no}`,
      transfer.transfer_date || new Date().toISOString().split('T')[0],
      quantity,
      totalWeight,
      handlingAmount
    ], cId);
  }

  // Auto-generate INWARD Cold Storage Bill
  try {
    await createOrUpdateColdStorageBill({
      billType: 'INWARD',
      voucherId: voucherId,
      voucherNo: voucherNo,
      voucherDate: transfer.transfer_date || new Date().toISOString().split('T')[0],
      coldStorageId: transfer.to_godown_id,
      coldStorageName: transfer.resolved_to_godown_name || transfer.to_godown_name,
      operatorId: tariff?.operatorId || null,
      operatorName: tariff?.operatorName || 'Cold Storage Operator',
      loadmanCharges: handlingAmount,
      storageCharges: 0,
      handlingCharges: handlingAmount,
      totalQty: quantity,
      totalWeight: totalWeight,
      vehicleNo,
      driverName,
      driverPhone,
      transporterName,
      loadmanName,
      taxRate: tariff?.gstRate || 18,
      items: [{
        item_name: transfer.item_name,
        purchase_lot_no: lotNo,
        cold_storage_lot_no: coldStorageLot,
        quantity,
        weight: perUnitWeight,
        total_wt: totalWeight,
        inward_date: transfer.transfer_date,
        handling_charges: handlingAmount,
        vehicle_no: vehicleNo,
        driver_name: driverName,
        transporter_name: transporterName,
        loadman_name: loadmanName
      }],
      remarks,
      companyId: cId
    });
  } catch (bErr) {
    console.warn('Inward transfer auto bill warning:', bErr.message);
  }

  return voucherId;
};

// Handle Transfers OUT OF Cold Storage to Factory Godown (Outward / CSO)
const createOutwardVoucherForTransfer = async (transfer, companyId = 1) => {
  const cId = parseInt(companyId, 10) || 1;
  const remarks = transferReference(transfer);
  const existing = await db.query(
    'SELECT id, voucher_no FROM cold_storage_vouchers WHERE remarks = ? LIMIT 1',
    [remarks],
    cId
  );
  let voucherId = existing.rows?.[0]?.id;
  let voucherNo = existing.rows?.[0]?.voucher_no;

  const fromGodownId = transfer.from_godown_id;
  let tariff = null;
  try {
    tariff = await getColdStorageTariff(fromGodownId, cId);
  } catch (_) {}

  if (!voucherNo) {
    const lastVoucher = await db.query(
      "SELECT voucher_no FROM cold_storage_vouchers WHERE voucher_type = 'OUT' ORDER BY id DESC LIMIT 1",
      [],
      cId
    );
    const lastNumber = Number(String(lastVoucher.rows?.[0]?.voucher_no || '').replace(/\D/g, '')) || 0;
    voucherNo = `CSO-${String(lastNumber + 1).padStart(6, '0')}`;
  }
  const quantity = Number(transfer.qty) || 0;
  const totalWeight = Number(transfer.weight) || (quantity * 50);
  const perUnitWeight = quantity > 0 ? totalWeight / quantity : 50;

  const itemResult = await db.query(
    'SELECT id, unit FROM item_master WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?)) LIMIT 1',
    [transfer.item_name],
    cId
  );
  const item = itemResult.rows?.[0];
  const lotNo = transfer.lot_no || 'LOT-TRANSFER';
  const coldStorageLot = lotNo.startsWith('CS-') ? lotNo : `CS-${lotNo}`;

  // Vehicle, driver, transport, loadman & insurance details
  const vehicleNo = transfer.vehicle_no || transfer.lorry_no || '';
  const driverName = transfer.driver_name || transfer.driver || '';
  const driverPhone = transfer.driver_phone || '';
  let transporterName = transfer.transporter_name || transfer.transporter || '';
  if (/^\d+$/.test(String(transporterName).trim())) {
    try {
      const tmRes = await db.query('SELECT print_name, name FROM transport_master WHERE id = ?', [transporterName], cId);
      if (tmRes.rows && tmRes.rows[0]) {
        transporterName = tmRes.rows[0].print_name || tmRes.rows[0].name;
      }
    } catch (_) {}
  }
  const loadmanName = transfer.loadman_name || transfer.worker_name || 'Outward Loading Team';
  const loadmanInput = parseFloat(transfer.loadman_charges || 0);

  // Find original inward record to compute actual storage days
  let inwardDate = transfer.transfer_date || new Date().toISOString().split('T')[0];
  let inRow = null;
  try {
    const rawLot = String(lotNo || '').replace(/^CS-/, '');
    const csLot = `CS-${rawLot}`;
    const inLookup = await db.query(`
      SELECT csi.*, csv.voucher_date as inward_date, csv.purchase_id
      FROM cold_storage_items csi
      JOIN cold_storage_vouchers csv ON csi.voucher_id = csv.id
      WHERE csv.voucher_type = 'IN'
        AND (
          LOWER(TRIM(csi.cold_storage_lot_no)) = LOWER(TRIM(?))
          OR LOWER(TRIM(csi.purchase_lot_no)) = LOWER(TRIM(?))
          OR LOWER(TRIM(csi.cold_storage_lot_no)) = LOWER(TRIM(?))
          OR LOWER(TRIM(csi.purchase_lot_no)) = LOWER(TRIM(?))
          OR LOWER(TRIM(csi.item_name)) = LOWER(TRIM(?))
        )
        AND (csv.cold_storage_id = ? OR CAST(csv.cold_storage_id AS TEXT) = ?)
      ORDER BY csi.id DESC LIMIT 1
    `, [csLot, rawLot, rawLot, csLot, transfer.item_name, fromGodownId, String(fromGodownId)], cId);

    if (inLookup.rows && inLookup.rows.length > 0) {
      inRow = inLookup.rows[0];
      if (inRow.inward_date) inwardDate = inRow.inward_date;
    }
  } catch (_) {}

  // Fallback lookup in purchase items if inward record not found in vouchers
  if (inwardDate === (transfer.transfer_date || new Date().toISOString().split('T')[0])) {
    try {
      const rawLot = String(lotNo || '').replace(/^CS-/, '');
      const pLookup = await db.query(`
        SELECT p.date as pur_date, p.id as pur_id
        FROM purchases p
        JOIN purchase_items pi ON pi.purchase_id = p.id
        WHERE (LOWER(TRIM(pi.lot_no)) = LOWER(TRIM(?)) OR LOWER(TRIM(pi.lot_no)) = LOWER(TRIM(?)) OR LOWER(TRIM(pi.item_name)) = LOWER(TRIM(?)))
        ORDER BY p.id DESC LIMIT 1
      `, [rawLot, `CS-${rawLot}`, transfer.item_name], cId);
      if (pLookup.rows && pLookup.rows[0] && pLookup.rows[0].pur_date) {
        inwardDate = pLookup.rows[0].pur_date;
      }
    } catch (_) {}
  }

  const trfDate = transfer.transfer_date || new Date().toISOString().split('T')[0];
  const { calendarDays, freeDays, minDays, billableDays } = calculateStorageDays(
    inwardDate,
    trfDate,
    tariff?.freeDays || 0,
    tariff?.minDays || 1
  );

  const storageCalc = calculateSlabStorageCharge({
    qtyKg: totalWeight,
    billableDays,
    slabs: tariff?.storageSlabs || [],
    calculationType: tariff?.calculationType || 'Progressive'
  });

  const loadingCalc = calculateLabourCharge({
    qtyKg: totalWeight,
    ratePerKg: tariff?.outwardLoadingRate || 0.50,
    additionalCharges: loadmanInput
  });

  const customStorageRate = parseFloat(transfer.storage_rate) || 0;
  const storageCharges = customStorageRate > 0 ? Number((totalWeight * customStorageRate * billableDays).toFixed(2)) : storageCalc.totalCharge;
  const loadingCharges = parseFloat(transfer.handling_amount) > 0 ? parseFloat(transfer.handling_amount) : (loadmanInput > 0 ? loadmanInput : loadingCalc.totalCharge);
  const insuranceCharges = parseFloat(transfer.insurance_charges || 0);

  if (voucherId) {
    await db.run(`
      UPDATE cold_storage_vouchers SET
        vehicle_no = ?, driver_name = ?, driver_phone = ?, transporter_name = ?,
        loadman_name = ?, loadman_charges = ?, handling_amount = ?,
        storage_days = ?, storage_charges = ?, additional_charges = ?,
        total_qty = ?, total_wt = ?
      WHERE id = ?
    `, [
      vehicleNo, driverName, driverPhone, transporterName,
      loadmanName, loadingCharges, loadingCharges,
      calendarDays, storageCharges, insuranceCharges,
      quantity, totalWeight, voucherId
    ], cId);

    await db.run(`
      UPDATE cold_storage_items SET
        quantity = ?, weight = ?, total_wt = ?,
        storage_days = ?, storage_charge = ?, labour_charge = ?
      WHERE voucher_id = ?
    `, [quantity, perUnitWeight, totalWeight, calendarDays, storageCharges, loadingCharges, voucherId], cId);
  } else {
    const voucherResult = await db.run(`
      INSERT INTO cold_storage_vouchers (
        voucher_no, voucher_type, voucher_date, cold_storage_id, cold_storage_name,
        destination_godown_id, destination_godown_name, remarks, total_qty, total_wt,
        operator_id, operator_name, outward_dest_type, handling_rate, handling_amount,
        storage_days, storage_charges, vehicle_no, driver_name, driver_phone,
        transporter_name, loadman_name, loadman_charges, additional_charges, status
      ) VALUES (?, 'OUT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Internal Godown', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Confirmed')
    `, [
      voucherNo,
      trfDate,
      transfer.from_godown_id,
      transfer.resolved_from_godown_name || transfer.from_godown_name,
      transfer.to_godown_id,
      transfer.resolved_to_godown_name || transfer.to_godown_name || 'Main Godown',
      remarks,
      quantity,
      totalWeight,
      tariff?.operatorId || null,
      tariff?.operatorName || 'Cold Storage Operator',
      tariff?.outwardLoadingRate || 0.50,
      loadingCharges,
      calendarDays,
      storageCharges,
      vehicleNo,
      driverName,
      driverPhone,
      transporterName,
      loadmanName,
      loadingCharges,
      insuranceCharges
    ], cId);

    voucherId = voucherResult.rows?.[0]?.id || voucherResult.lastID || voucherResult.lastInsertRowid;
    if (!voucherId) {
      const lookup = await db.query('SELECT id FROM cold_storage_vouchers WHERE voucher_no = ?', [voucherNo], cId);
      voucherId = lookup.rows?.[0]?.id;
    }
    if (!voucherId) throw new Error(`Cold-storage transfer voucher ${voucherNo} was not saved.`);

    await db.run(`
      INSERT INTO cold_storage_items (
        voucher_id, voucher_no, item_id, item_name, purchase_lot_no, cold_storage_lot_no,
        quantity, weight, total_wt, unit, remarks,
        inward_date, outward_date, storage_days, storage_charge, labour_charge
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      `Godown Transfer ${transfer.s_no}`,
      inwardDate,
      trfDate,
      calendarDays,
      storageCharges,
      loadingCharges
    ], cId);
  }

  // Update remaining quantity on original inward item
  if (inRow?.id) {
    try {
      await db.run(`
        UPDATE cold_storage_items SET
          remaining_quantity = MAX(0, COALESCE(remaining_quantity, quantity) - ?),
          remaining_weight = MAX(0, COALESCE(remaining_weight, total_wt) - ?)
        WHERE id = ?
      `, [quantity, totalWeight, inRow.id], cId);
    } catch (_) {}
  }

  // Auto-generate OUTWARD Cold Storage Bill
  try {
    const billRes = await createOrUpdateColdStorageBill({
      billType: 'OUTWARD',
      voucherId: voucherId,
      voucherNo: voucherNo,
      voucherDate: trfDate,
      coldStorageId: transfer.from_godown_id,
      coldStorageName: transfer.resolved_from_godown_name || transfer.from_godown_name,
      operatorId: tariff?.operatorId || null,
      operatorName: tariff?.operatorName || 'Cold Storage Operator',
      loadmanCharges: loadingCharges,
      storageCharges: storageCharges,
      handlingCharges: loadingCharges,
      insuranceCharges: insuranceCharges,
      totalQty: quantity,
      totalWeight: totalWeight,
      storageDays: calendarDays,
      vehicleNo,
      driverName,
      driverPhone,
      transporterName,
      loadmanName,
      taxRate: tariff?.gstRate || 18,
      items: [{
        item_name: transfer.item_name,
        purchase_lot_no: lotNo,
        cold_storage_lot_no: coldStorageLot,
        quantity,
        weight: perUnitWeight,
        total_wt: totalWeight,
        billable_units: quantity,
        inward_date: inwardDate,
        outward_date: trfDate,
        storage_days: calendarDays,
        billable_days: billableDays,
        storage_charges: storageCharges,
        handling_charges: loadingCharges,
        insurance_charges: insuranceCharges,
        total_charges: Number((storageCharges + loadingCharges + insuranceCharges).toFixed(2)),
        vehicle_no: vehicleNo,
        driver_name: driverName,
        transporter_name: transporterName,
        loadman_name: loadmanName
      }],
      remarks: `Outward Bill for Transfer #${transfer.s_no} to ${transfer.resolved_to_godown_name || transfer.to_godown_name} | Stored: ${calendarDays} days | Vehicle: ${vehicleNo || 'N/A'}`,
      companyId: cId
    });

    console.log(`✅ [ColdStorage] Successfully created linked OUTWARD Bill ${billRes.billNo} (₹${billRes.grandTotal}) for Transfer #${transfer.s_no}`);
  } catch (bErr) {
    console.warn('[ColdStorage] Outward transfer auto bill warning:', bErr.message);
  }

  return voucherId;
};

const syncGodownTransfersToColdStorage = async (companyId = 1) => {
  const cId = parseInt(companyId, 10) || 1;

  // 1. Sync Transfers INTO Cold Storage (Inward)
  const inwardResult = await db.query(`
    SELECT gt.*,
      COALESCE(NULLIF(destination.godown_name, ''), gt.to_godown_name) AS resolved_to_godown_name,
      COALESCE(NULLIF(source.godown_name, ''), gt.from_godown_name) AS resolved_from_godown_name
    FROM godown_transfers gt
    LEFT JOIN godown_master destination ON (CAST(destination.id AS TEXT) = CAST(gt.to_godown_id AS TEXT) OR LOWER(TRIM(destination.godown_name)) = LOWER(TRIM(gt.to_godown_name)))
    LEFT JOIN godown_master source ON (CAST(source.id AS TEXT) = CAST(gt.from_godown_id AS TEXT) OR LOWER(TRIM(source.godown_name)) = LOWER(TRIM(gt.from_godown_name)))
    WHERE (
      LOWER(COALESCE(destination.godown_type, '')) LIKE '%cold%'
      OR LOWER(COALESCE(destination.storage_location, '')) LIKE '%outside%'
      OR LOWER(COALESCE(destination.godown_name, gt.to_godown_name, '')) LIKE '%cold%'
      OR CAST(destination.id AS TEXT) = '2'
      OR CAST(gt.to_godown_id AS TEXT) = '2'
    )
    ORDER BY gt.id
  `, [], cId);

  for (const transfer of inwardResult.rows || []) {
    try {
      await createVoucherForTransfer(transfer, cId);
    } catch (err) {
      console.warn('Notice syncing inward transfer to cold storage:', err.message);
    }
  }

  // 2. Sync Transfers OUT OF Cold Storage (Outward)
  const outwardResult = await db.query(`
    SELECT gt.*,
      COALESCE(NULLIF(destination.godown_name, ''), gt.to_godown_name) AS resolved_to_godown_name,
      COALESCE(NULLIF(source.godown_name, ''), gt.from_godown_name) AS resolved_from_godown_name
    FROM godown_transfers gt
    LEFT JOIN godown_master source ON (CAST(source.id AS TEXT) = CAST(gt.from_godown_id AS TEXT) OR LOWER(TRIM(source.godown_name)) = LOWER(TRIM(gt.from_godown_name)))
    LEFT JOIN godown_master destination ON (CAST(destination.id AS TEXT) = CAST(gt.to_godown_id AS TEXT) OR LOWER(TRIM(destination.godown_name)) = LOWER(TRIM(gt.to_godown_name)))
    WHERE (
      LOWER(COALESCE(source.godown_type, '')) LIKE '%cold%'
      OR LOWER(COALESCE(source.storage_location, '')) LIKE '%outside%'
      OR LOWER(COALESCE(source.godown_name, gt.from_godown_name, '')) LIKE '%cold%'
      OR CAST(source.id AS TEXT) = '2'
      OR CAST(gt.from_godown_id AS TEXT) = '2'
    )
    ORDER BY gt.id
  `, [], cId);

  for (const transfer of outwardResult.rows || []) {
    try {
      await createOutwardVoucherForTransfer(transfer, cId);
    } catch (err) {
      console.warn('Notice syncing outward transfer from cold storage:', err.message);
    }
  }
};

module.exports = { createVoucherForTransfer, createOutwardVoucherForTransfer, syncGodownTransfersToColdStorage };
