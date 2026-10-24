const db = require('../config/database');
const { ensureColdStorageSchema } = require('../utils/coldStorageSchema');

/**
 * Calculate calendar storage days inclusive of both inward and outward calendar dates.
 * Example: inward 2026-10-01 and outward 2026-10-10 -> 10 calendar days.
 * If inward and outward are the same day -> 1 calendar day.
 */
function calculateStorageDays(inwardDateStr, outwardDateStr, freeDays = 0, minDays = 1) {
  if (!inwardDateStr) return 1;
  const inDate = new Date(inwardDateStr.slice(0, 10));
  const outDate = outwardDateStr ? new Date(outwardDateStr.slice(0, 10)) : new Date();

  // Normalize to UTC midnight to avoid DST/timezone issues
  const inUtc = Date.UTC(inDate.getFullYear(), inDate.getMonth(), inDate.getDate());
  const outUtc = Date.UTC(outDate.getFullYear(), outDate.getMonth(), outDate.getDate());

  const diffMs = Math.max(0, outUtc - inUtc);
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  
  // Confirmed rule: Count both inward and outward calendar dates (inclusive)
  const calendarDays = diffDays + 1;
  
  // Apply free days
  const netDays = Math.max(0, calendarDays - (parseInt(freeDays, 10) || 0));
  
  // Apply minimum billable days
  const billableDays = Math.max(netDays, parseInt(minDays, 10) || 1);

  return {
    calendarDays,
    freeDays: parseInt(freeDays, 10) || 0,
    minDays: parseInt(minDays, 10) || 1,
    billableDays
  };
}

/**
 * Calculate storage charges based on day slabs.
 * Supports:
 *  - 'Progressive': Days 1-15 @ rate1, Days 16-30 @ rate2, etc.
 *  - 'Whole Duration': The rate for the attained slab applies to all billable days.
 * 
 * Default fallback slabs if none configured:
 *  - Days 1-15: ₹0.20/kg/day
 *  - Days 16-30: ₹0.30/kg/day
 *  - Days 31-9999: ₹0.40/kg/day
 */
function calculateSlabStorageCharge({
  qtyKg,
  billableDays,
  slabs = [],
  calculationType = 'Progressive',
  minCharge = 0
}) {
  const weightKg = parseFloat(qtyKg) || 0;
  const days = Math.max(0, parseInt(billableDays, 10) || 0);

  if (weightKg <= 0 || days <= 0) {
    return {
      totalCharge: 0,
      breakdown: [],
      calculationType
    };
  }

  // Ensure active slabs sorted by slab_start_day ASC
  let activeSlabs = (slabs || [])
    .filter(s => s && (s.status === undefined || s.status === 'Active'))
    .sort((a, b) => (parseInt(a.slab_start_day, 10) || 1) - (parseInt(b.slab_start_day, 10) || 1));

  // If no slabs provided, use standard BVC default slabs
  if (activeSlabs.length === 0) {
    activeSlabs = [
      { slab_start_day: 1, slab_end_day: 15, rate: 0.20 },
      { slab_start_day: 16, slab_end_day: 30, rate: 0.30 },
      { slab_start_day: 31, slab_end_day: 99999, rate: 0.40 }
    ];
  }

  const isWholeDuration = String(calculationType).toLowerCase().includes('whole');
  const breakdown = [];
  let totalCharge = 0;

  if (isWholeDuration) {
    // Find matching slab for total billable days
    let matchedSlab = activeSlabs[activeSlabs.length - 1];
    for (const slab of activeSlabs) {
      const start = parseInt(slab.slab_start_day, 10) || 1;
      const end = slab.slab_end_day ? parseInt(slab.slab_end_day, 10) : 999999;
      if (days >= start && days <= end) {
        matchedSlab = slab;
        break;
      }
    }
    const rate = parseFloat(matchedSlab.rate) || 0;
    totalCharge = weightKg * rate * days;
    breakdown.push({
      slab_start_day: matchedSlab.slab_start_day,
      slab_end_day: matchedSlab.slab_end_day,
      daysInSlab: days,
      rate,
      charge: totalCharge
    });
  } else {
    // Progressive Slabs: each day is charged at the rate of the slab it falls into
    let daysRemaining = days;
    for (const slab of activeSlabs) {
      if (daysRemaining <= 0) break;
      const start = parseInt(slab.slab_start_day, 10) || 1;
      const end = slab.slab_end_day ? parseInt(slab.slab_end_day, 10) : 999999;
      const slabSpan = Math.max(0, end - start + 1);

      const daysInThisSlab = Math.min(daysRemaining, slabSpan);
      if (daysInThisSlab > 0) {
        const rate = parseFloat(slab.rate) || 0;
        const slabCharge = weightKg * rate * daysInThisSlab;
        totalCharge += slabCharge;
        breakdown.push({
          slab_start_day: start,
          slab_end_day: end === 999999 ? 'Beyond' : end,
          daysInSlab: daysInThisSlab,
          rate,
          charge: slabCharge
        });
        daysRemaining -= daysInThisSlab;
      }
    }

    // Any remaining days beyond configured slabs
    if (daysRemaining > 0 && activeSlabs.length > 0) {
      const lastRate = parseFloat(activeSlabs[activeSlabs.length - 1].rate) || 0.40;
      const extraCharge = weightKg * lastRate * daysRemaining;
      totalCharge += extraCharge;
      breakdown.push({
        slab_start_day: 'Extra',
        slab_end_day: 'Extra',
        daysInSlab: daysRemaining,
        rate: lastRate,
        charge: extraCharge
      });
    }
  }

  if (minCharge && totalCharge < parseFloat(minCharge)) {
    totalCharge = parseFloat(minCharge);
  }

  return {
    totalCharge: Number(totalCharge.toFixed(2)),
    breakdown,
    calculationType: isWholeDuration ? 'Whole Duration Slab' : 'Progressive Slab'
  };
}

/**
 * Calculate labour/handling charge (Inward Unloading or Outward Loading)
 * Unloading charge = handled kg * rate per kg + additional charges
 */
function calculateLabourCharge({ qtyKg, ratePerKg = 0.50, additionalCharges = 0 }) {
  const weightKg = parseFloat(qtyKg) || 0;
  const rate = parseFloat(ratePerKg) || 0;
  const addl = parseFloat(additionalCharges) || 0;
  const baseCharge = weightKg * rate;
  const total = baseCharge + addl;
  return {
    handledKg: weightKg,
    ratePerKg: rate,
    baseCharge: Number(baseCharge.toFixed(2)),
    additionalCharges: Number(addl.toFixed(2)),
    totalCharge: Number(total.toFixed(2))
  };
}

/**
 * Fetch effective tariff configuration for a Cold Storage Godown
 */
async function getColdStorageTariff(coldStorageId, companyId = 1) {
  try {
    const cId = parseInt(companyId, 10) || 1;
    await ensureColdStorageSchema(cId);
    // 1. Fetch godown master configuration
    const gmRes = await db.query(
      `SELECT * FROM godown_master WHERE id = ? OR CAST(id AS TEXT) = ? LIMIT 1`,
      [coldStorageId, String(coldStorageId)],
      cId
    );
    const godown = (gmRes.rows && gmRes.rows[0]) ? gmRes.rows[0] : {};

    // 2. Fetch charge master slabs and rates
    const cmRes = await db.query(
      `SELECT * FROM cold_storage_charge_master 
       WHERE (cold_storage_id = ? OR CAST(cold_storage_id AS TEXT) = ?) AND status = 'Active'
       ORDER BY slab_start_day ASC`,
      [coldStorageId, String(coldStorageId)],
      cId
    );
    const chargeRows = cmRes.rows || [];

    const storageSlabs = chargeRows
      .filter(c => !c.charge_type || c.charge_type === 'Storage')
      .map(c => ({
        slab_start_day: parseInt(c.slab_start_day, 10) || 1,
        slab_end_day: c.slab_end_day ? parseInt(c.slab_end_day, 10) : null,
        rate: parseFloat(c.rate) || 0,
        billing_basis: c.billing_basis || 'Per KG/Day',
        billing_method: c.billing_method || godown.billing_method || 'Progressive'
      }));

    // Find configured labour rates
    const inwardUnloadCharge = chargeRows.find(c => c.charge_type === 'Inward Unloading');
    const outwardLoadCharge = chargeRows.find(c => c.charge_type === 'Outward Loading');

    const inwardUnloadingRate = inwardUnloadCharge
      ? parseFloat(inwardUnloadCharge.rate)
      : parseFloat(godown.inward_handling_rate || 0.50);

    const outwardLoadingRate = outwardLoadCharge
      ? parseFloat(outwardLoadCharge.rate)
      : parseFloat(godown.outward_handling_rate || 0.50);

    const calculationType = (storageSlabs[0]?.billing_method || godown.billing_method || 'Progressive')
      .toLowerCase().includes('whole') ? 'Whole Duration' : 'Progressive';

    return {
      coldStorageId,
      godownName: godown.godown_name || 'BTS Cold Storage',
      operatorId: godown.operator_id || null,
      operatorName: godown.operator_name || 'AgroCold Services',
      calculationType,
      freeDays: parseInt(godown.free_storage_days || 0, 10),
      minDays: parseInt(godown.min_billable_days || 1, 10),
      inwardUnloadingRate,
      outwardLoadingRate,
      storageSlabs: storageSlabs.length > 0 ? storageSlabs : [
        { slab_start_day: 1, slab_end_day: 15, rate: 0.20 },
        { slab_start_day: 16, slab_end_day: 30, rate: 0.30 },
        { slab_start_day: 31, slab_end_day: 99999, rate: 0.40 }
      ]
    };
  } catch (err) {
    console.warn('[ColdStorageBillingService] Error fetching tariff:', err.message);
    return {
      coldStorageId,
      calculationType: 'Progressive',
      freeDays: 0,
      minDays: 1,
      inwardUnloadingRate: 0.50,
      outwardLoadingRate: 0.50,
      storageSlabs: [
        { slab_start_day: 1, slab_end_day: 15, rate: 0.20 },
        { slab_start_day: 16, slab_end_day: 30, rate: 0.30 },
        { slab_start_day: 31, slab_end_day: 99999, rate: 0.40 }
      ]
    };
  }
}

/**
 * Reconcile operator bill against actual stored days and rates
 */
const calculateBill = async (coldStorageId, fromDate, toDate, operatorInvoiceAmount = 0, companyId = 1) => {
  const tariff = await getColdStorageTariff(coldStorageId, companyId);
  const cId = parseInt(companyId, 10) || 1;

  const itemsRes = await db.query(`
    SELECT 
      csi.*,
      csv.voucher_date as inward_date,
      csv.vehicle_no, csv.driver_name, csv.loadman_name,
      csv.loadman_rate_per_kg, csv.loadman_charges, csv.additional_charges,
      csv.handling_rate, csv.handling_amount
    FROM cold_storage_items csi
    JOIN cold_storage_vouchers csv ON csi.voucher_id = csv.id
    WHERE (csv.cold_storage_id = ? OR CAST(csv.cold_storage_id AS TEXT) = ?)
      AND csv.voucher_type = 'IN'
      AND csv.voucher_date <= ?
  `, [coldStorageId, String(coldStorageId), toDate], cId);

  const processedItems = (itemsRes.rows || []).map((row) => {
    const qtyKg = parseFloat(row.total_wt || (parseFloat(row.quantity || 0) * parseFloat(row.weight || 50))) || 0;
    const { calendarDays, freeDays, minDays, billableDays } = calculateStorageDays(
      row.inward_date || fromDate,
      toDate,
      tariff.freeDays,
      tariff.minDays
    );

    const chargeResult = calculateSlabStorageCharge({
      qtyKg,
      billableDays,
      slabs: tariff.storageSlabs,
      calculationType: tariff.calculationType
    });

    const unloading = parseFloat(row.loadman_charges || row.handling_amount || (qtyKg * tariff.inwardUnloadingRate) || 0);

    return {
      ...row,
      qty_kg: qtyKg,
      calendar_days: calendarDays,
      free_days: freeDays,
      min_days: minDays,
      billable_days: billableDays,
      storage_charge: chargeResult.totalCharge,
      unloading_charge: unloading,
      slab_breakdown: chargeResult.breakdown,
      calculation_type: tariff.calculationType,
      total_amount: Number((chargeResult.totalCharge + unloading).toFixed(2))
    };
  });

  const totalStorage = processedItems.reduce((sum, it) => sum + (it.storage_charge || 0), 0);
  const totalUnloading = processedItems.reduce((sum, it) => sum + (it.unloading_charge || 0), 0);
  const taxableAmount = totalStorage + totalUnloading;
  const taxRate = 18;
  const totalTax = Number((taxableAmount * (taxRate / 100)).toFixed(2));
  const grandTotal = Number((taxableAmount + totalTax).toFixed(2));
  const opInvAmt = parseFloat(operatorInvoiceAmount || 0);
  const variance = opInvAmt > 0 ? Number((opInvAmt - grandTotal).toFixed(2)) : 0;

  return {
    cold_storage_id: coldStorageId,
    tariff,
    total_storage_charges: Number(totalStorage.toFixed(2)),
    total_unloading_charges: Number(totalUnloading.toFixed(2)),
    handling_charges: Number(totalUnloading.toFixed(2)),
    taxable_amount: Number(taxableAmount.toFixed(2)),
    tax_rate: taxRate,
    cgst_amount: Number((totalTax / 2).toFixed(2)),
    sgst_amount: Number((totalTax / 2).toFixed(2)),
    igst_amount: 0,
    total_tax: totalTax,
    grand_total: grandTotal,
    operator_invoice_amount: opInvAmt,
    variance_amount: variance,
    is_matched: Math.abs(variance) < 1,
    items: processedItems
  };
};

/**
 * Automatically generate or update a linked Cold Storage Bill record
 * for Inward (Purchase / CSI) or Outward (CSO).
 */
async function createOrUpdateColdStorageBill({
  billType = 'INWARD', // 'INWARD' | 'OUTWARD'
  voucherId,
  voucherNo,
  voucherDate,
  coldStorageId,
  coldStorageName,
  operatorId = null,
  operatorName = null,
  purchaseId = null,
  purchaseInvNo = '',
  vehicleNo = '',
  driverName = '',
  driverPhone = '',
  transporterName = '',
  loadmanName = '',
  loadmanQtyKg = 0,
  loadmanRatePerKg = 0,
  loadmanCharges = 0,
  storageDays = 0,
  totalQty = 0,
  totalWeight = 0,
  storageCharges = 0,
  handlingCharges = 0,
  insuranceCharges = 0,
  mamoolCharges = 0,
  otherCharges = 0,
  taxRate = 18,
  operatorInvoiceNo = '',
  operatorInvoiceDate = null,
  operatorInvoiceAmount = 0,
  items = [],
  remarks = '',
  createdBy = 'Admin',
  companyId = 1
}) {
  const cId = parseInt(companyId, 10) || 1;
  await ensureColdStorageSchema(cId);

  // 1. Resolve operator if not provided
  let opId = operatorId;
  let opName = operatorName;
  if (!opName && coldStorageId) {
    try {
      const gRes = await db.query(
        `SELECT operator_id, operator_name, external_company, gst_rate FROM godown_master WHERE id = ? OR CAST(id AS TEXT) = ? LIMIT 1`,
        [coldStorageId, String(coldStorageId)],
        cId
      );
      if (gRes.rows && gRes.rows.length > 0) {
        opId = opId || gRes.rows[0].operator_id;
        opName = opName || gRes.rows[0].operator_name || gRes.rows[0].external_company || 'Cold Storage Operator';
        if (!taxRate && gRes.rows[0].gst_rate) {
          taxRate = parseFloat(gRes.rows[0].gst_rate);
        }
      }
    } catch (_) {}
  }
  if (!opName) opName = coldStorageName || 'Cold Storage Operator';

  // 2. Compute financial breakdown
  const sCharges = Number((parseFloat(storageCharges) || 0).toFixed(2));
  const hCharges = Number((parseFloat(handlingCharges || loadmanCharges) || 0).toFixed(2));
  const iCharges = Number((parseFloat(insuranceCharges) || 0).toFixed(2));
  const mCharges = Number((parseFloat(mamoolCharges) || 0).toFixed(2));
  const oCharges = Number((parseFloat(otherCharges) || 0).toFixed(2));

  const taxableAmount = Number((sCharges + hCharges + iCharges + mCharges + oCharges).toFixed(2));
  const rate = parseFloat(taxRate) || 18;
  const halfRate = rate / 2;
  const cgstAmount = Number(((taxableAmount * halfRate) / 100).toFixed(2));
  const sgstAmount = Number(((taxableAmount * halfRate) / 100).toFixed(2));
  const totalTax = Number((cgstAmount + sgstAmount).toFixed(2));
  const grandTotal = Number((taxableAmount + totalTax).toFixed(2));

  const opInvAmt = parseFloat(operatorInvoiceAmount) || grandTotal;
  const variance = Number((opInvAmt - grandTotal).toFixed(2));

  // 3. Check for existing bill for this voucher or purchase
  let existingBill = null;
  try {
    if (voucherId || voucherNo || purchaseId) {
      const bRes = await db.query(
        `SELECT * FROM cold_storage_bills 
         WHERE (voucher_id IS NOT NULL AND voucher_id = ?) 
            OR (voucher_no IS NOT NULL AND voucher_no = ?)
            OR (purchase_id IS NOT NULL AND purchase_id = ?)
         LIMIT 1`,
        [voucherId || -1, voucherNo || '', purchaseId || -1],
        cId
      );
      if (bRes.rows && bRes.rows.length > 0) {
        existingBill = bRes.rows[0];
      }
    }
  } catch (_) {}

  let billId = null;
  let billNo = '';

  const dateStr = voucherDate || new Date().toISOString().slice(0, 10);
  const itemsJsonStr = typeof items === 'string' ? items : JSON.stringify(items || []);

  if (existingBill) {
    billId = existingBill.id;
    billNo = existingBill.bill_no;

    await db.run(
      `UPDATE cold_storage_bills SET
        bill_date = ?,
        operator_id = ?,
        operator_name = ?,
        cold_storage_id = ?,
        cold_storage_name = ?,
        period_from = COALESCE(period_from, ?),
        period_to = ?,
        operator_invoice_no = COALESCE(NULLIF(?, ''), operator_invoice_no),
        operator_invoice_date = COALESCE(?, operator_invoice_date),
        operator_invoice_amount = ?,
        erp_calculated_amount = ?,
        variance_amount = ?,
        storage_charges = ?,
        handling_charges = ?,
        insurance_charges = ?,
        mamool_charges = ?,
        other_charges = ?,
        taxable_amount = ?,
        tax_rate = ?,
        cgst_amount = ?,
        sgst_amount = ?,
        total_tax = ?,
        grand_total = ?,
        voucher_id = ?,
        voucher_no = ?,
        purchase_id = ?,
        vehicle_no = ?,
        driver_name = ?,
        transporter_name = ?,
        loadman_name = ?,
        loadman_charges = ?,
        storage_days = ?,
        total_qty = ?,
        total_weight = ?,
        bill_type = ?,
        remarks = ?,
        items_json = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        dateStr,
        opId,
        opName,
        coldStorageId,
        coldStorageName,
        dateStr,
        dateStr,
        operatorInvoiceNo || purchaseInvNo || '',
        operatorInvoiceDate || dateStr,
        opInvAmt,
        grandTotal,
        variance,
        sCharges,
        hCharges,
        iCharges,
        mCharges,
        oCharges,
        taxableAmount,
        rate,
        cgstAmount,
        sgstAmount,
        totalTax,
        grandTotal,
        voucherId || null,
        voucherNo || '',
        purchaseId || null,
        vehicleNo || '',
        driverName || '',
        transporterName || '',
        loadmanName || '',
        parseFloat(loadmanCharges) || hCharges,
        parseInt(storageDays, 10) || 0,
        parseFloat(totalQty) || 0,
        parseFloat(totalWeight) || 0,
        billType,
        remarks,
        itemsJsonStr,
        billId
      ],
      cId
    );
  } else {
    // Generate next Bill Number CSB-000001
    let nextNum = 1;
    try {
      const cntRes = await db.query(`SELECT bill_no FROM cold_storage_bills ORDER BY id DESC LIMIT 1`, [], cId);
      if (cntRes.rows && cntRes.rows.length > 0) {
        const lastNo = cntRes.rows[0].bill_no || '';
        const parsed = parseInt(lastNo.replace(/\D/g, ''), 10);
        if (!isNaN(parsed)) nextNum = parsed + 1;
      }
    } catch (_) {}
    billNo = `CSB-${String(nextNum).padStart(6, '0')}`;

    const insRes = await db.run(
      `INSERT INTO cold_storage_bills (
        bill_no, bill_date, operator_id, operator_name, cold_storage_id, cold_storage_name,
        period_from, period_to, operator_invoice_no, operator_invoice_date,
        operator_invoice_amount, erp_calculated_amount, variance_amount,
        storage_charges, handling_charges, insurance_charges, mamool_charges, other_charges,
        taxable_amount, tax_rate, cgst_amount, sgst_amount, igst_amount, total_tax, grand_total,
        status, voucher_id, voucher_no, purchase_id, vehicle_no, driver_name, transporter_name,
        loadman_name, loadman_charges, storage_days, total_qty, total_weight, bill_type,
        remarks, items_json, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'Pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        billNo,
        dateStr,
        opId,
        opName,
        coldStorageId,
        coldStorageName,
        dateStr,
        dateStr,
        operatorInvoiceNo || purchaseInvNo || '',
        operatorInvoiceDate || dateStr,
        opInvAmt,
        grandTotal,
        variance,
        sCharges,
        hCharges,
        iCharges,
        mCharges,
        oCharges,
        taxableAmount,
        rate,
        cgstAmount,
        sgstAmount,
        totalTax,
        grandTotal,
        voucherId || null,
        voucherNo || '',
        purchaseId || null,
        vehicleNo || '',
        driverName || '',
        transporterName || '',
        loadmanName || '',
        parseFloat(loadmanCharges) || hCharges,
        parseInt(storageDays, 10) || 0,
        parseFloat(totalQty) || 0,
        parseFloat(totalWeight) || 0,
        billType,
        remarks,
        itemsJsonStr,
        createdBy
      ],
      cId
    );
    billId = insRes.lastID || insRes.lastInsertRowid;
  }

  // Update voucher with linked bill_id and billed_status
  if (voucherId) {
    try {
      await db.run(
        `UPDATE cold_storage_vouchers SET bill_id = ?, billed_status = 'Billed' WHERE id = ?`,
        [billId, voucherId],
        cId
      );
    } catch (_) {}
  }

  return {
    success: true,
    billId,
    billNo,
    grandTotal,
    taxableAmount,
    totalTax,
    variance
  };
}

module.exports = {
  calculateStorageDays,
  calculateSlabStorageCharge,
  calculateLabourCharge,
  getColdStorageTariff,
  calculateBill,
  createOrUpdateColdStorageBill
};
