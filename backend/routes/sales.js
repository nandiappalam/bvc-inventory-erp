const express = require('express');
const router = express.Router();
const db = require('../config/database');
const SalesService = require('../services/SalesService');
const { resolveCustomerName } = require('../utils/customerResolver');

const getCompanyId = (req) => req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);

router.use(async (req, _res, next) => {
  try {
    await SalesService.ensureSalesSchema(getCompanyId(req));
  } catch (err) {
    console.warn('[SalesRoute] schema ensure warning:', err.message);
  }
  next();
});

// GET consolidated lookups for Sales Create/Edit form
router.get('/form-lookups', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const lookups = await SalesService.getFormLookups(activeCompanyId);
    res.json({ success: true, data: lookups });
  } catch (error) {
    console.error('Error fetching sales form lookups:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET customer credit, outstanding, GSTIN, billing/shipping context
router.get('/customer-context/:customerKey', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const ctx = await SalesService.getCustomerContext(activeCompanyId, req.params.customerKey);
    if (!ctx) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    res.json({ success: true, data: ctx });
  } catch (error) {
    console.error('Error fetching customer context:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET available FG/RM/Vacuum lots per godown
router.get('/available-lots', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const lots = await SalesService.getAvailableLots(activeCompanyId, req.query || {});
    res.json({ success: true, data: lots });
  } catch (error) {
    console.error('Error fetching available sales lots:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET next auto Outpass No
router.get('/next-outpass-no', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const outpass_no = await SalesService.getNextOutpassNo(activeCompanyId);
    res.json({ success: true, outpass_no });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET next sequential s_no (Bill No / Order No) for sales
router.get('/next-sno', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const isOrder = req.query.is_order !== undefined ? (parseInt(req.query.is_order, 10) === 1) : false;
    const nextSno = await SalesService.getNextSalesNo(activeCompanyId, isOrder);
    const nextNum = parseInt(nextSno, 10) || 1;
    res.json({ success: true, next_sno: nextSno, s_no: nextNum, next_s_no: nextSno, data: { s_no: nextNum } });
  } catch (error) {
    console.error('Error fetching next sales s_no:', error);
    res.status(500).json({ success: false, message: 'Error fetching next sales s_no', error: error.message });
  }
});

// Helper: verify authorized Admin / Manager or explicit can_delete permission for controlled sales cancellation
async function requireSalesCancelPermission(req, res, next) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const role = String(req.user.role || '').trim().toLowerCase();
    if (['admin', 'manager', 'superadmin'].includes(role)) {
      return next();
    }
    if (db.master && typeof db.master.query === 'function') {
      const permRes = await db.master.query(
        `SELECT can_delete FROM user_permissions
         WHERE user_id = ?
           AND LOWER(TRIM(COALESCE(module_name, ''))) IN ('sales', 'sales order', 'sales_order', 'all')
           AND COALESCE(can_delete, 0) = 1
         LIMIT 1`,
        [req.user.id]
      );
      if (permRes.rows && permRes.rows.length > 0) {
        return next();
      }
    }
    return res.status(403).json({
      success: false,
      message: 'Only Admin or authorized users can cancel a posted sales record.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Authorization check failed' });
  }
}

function round2Num(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function deriveSalesRegisterFields({
  sale,
  items = [],
  outpass = null,
  outpassItemsAgg = null,
  stockMoveAgg = null,
  receiptEntries = [],
  linkedReceiptVouchers = [],
  qcMap = new Map(),
  customerRow = null,
  transporterRow = null,
  godownRow = null
}) {
  const isOrder = Number(sale.is_order || 0) === 1;
  const resolvedCustomerName =
    (customerRow && (customerRow.name || customerRow.print_name)) ||
    (!/^\d+$/.test(String(sale.customer || '').trim()) ? sale.customer : '') ||
    'Customer';

  const resolvedGstin = sale.customer_gstin || customerRow?.gst_number || '';
  const resolvedState = sale.party_state || customerRow?.state || '';
  const resolvedStateCode = sale.party_state_code || customerRow?.state_code || '';

  const resolvedTransporterName =
    (transporterRow && (transporterRow.print_name || transporterRow.name)) ||
    (sale.pur_trans && !/^\d+$/.test(String(sale.pur_trans).trim()) ? sale.pur_trans : '') ||
    (outpass?.transporter && !/^\d+$/.test(String(outpass.transporter).trim()) ? outpass.transporter : '') ||
    '';

  const resolvedGodownName =
    sale.godown_from_name ||
    godownRow?.godown_name ||
    items.find((i) => i.godown_name)?.godown_name ||
    outpass?.from_godown_name ||
    '';

  const mappedItems = items.map((i) => {
    const lotKey = String(i.lot_no || '').trim().toUpperCase();
    const parentLotKey = String(i.parent_rm_lot_no || '').trim().toUpperCase();
    const matchedQc = qcMap.get(lotKey) || qcMap.get(parentLotKey) || null;
    return {
      id: i.id,
      item_id: i.item_id,
      product_code: i.product_code || '',
      itemName: i.item_name,
      item_name: i.item_name,
      category: i.category || sale.stock_type || 'FG',
      hsn_code: i.hsn_code || '',
      lotNo: i.lot_no || '',
      lot_no: i.lot_no || '',
      parent_rm_lot_no: i.parent_rm_lot_no || '',
      godown_id: i.godown_id,
      godown_name: i.godown_name || resolvedGodownName || '',
      package_type: i.package_type || 'Bag',
      package_tare_wt: Number(i.package_tare_wt || 0),
      uom: i.uom || 'KG',
      weight: Number(i.weight || 0),
      qty: Number(i.qty || 0),
      totalWt: Number(i.total_wt || 0),
      total_wt: Number(i.total_wt || 0),
      net_product_wt: Number(i.net_product_wt || i.total_wt || 0),
      allocated_load_wt: Number(i.allocated_load_wt || 0),
      rate: Number(i.rate || 0),
      rate_type: i.rate_type || 'Per Kg',
      discPerc: Number(i.disc_perc || 0),
      disc_perc: Number(i.disc_perc || 0),
      disc_amount: Number(i.disc_amount || 0),
      taxable_amount: Number(i.taxable_amount || 0),
      taxPerc: Number(i.tax_perc || 0),
      tax_perc: Number(i.tax_perc || 0),
      gst_rate: Number(i.gst_rate ?? i.tax_perc ?? 0),
      tax_type: i.tax_type || 'Taxable',
      cgst_rate: Number(i.cgst_rate || 0),
      cgst_amount: Number(i.cgst_amount || 0),
      sgst_rate: Number(i.sgst_rate || 0),
      sgst_amount: Number(i.sgst_amount || 0),
      igst_rate: Number(i.igst_rate || 0),
      igst_amount: Number(i.igst_amount || 0),
      totalAmt: Number(i.total_amt || 0),
      total_amt: Number(i.total_amt || 0),
      box: Number(i.box || 0),
      qc_id: matchedQc?.id || null,
      qc_no: matchedQc?.qc_no || null
    };
  });

  const itemNames = mappedItems.map((i) => i.item_name).filter(Boolean);
  const uniqueLots = Array.from(new Set(mappedItems.map((i) => String(i.lot_no || '').trim()).filter(Boolean)));
  const primaryQc = mappedItems.find((i) => i.qc_id) || null;

  const totalQty = mappedItems.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);
  const invoiceNetWeight = round2Num(
    Number(sale.product_net_weight || 0) > 0
      ? Number(sale.product_net_weight)
      : mappedItems.reduce((sum, i) => sum + (Number(i.net_product_wt || i.total_wt) || 0), 0)
  );
  const invoiceTotal = round2Num(
    sale.grand_total !== undefined && sale.grand_total !== null && Number(sale.grand_total) > 0
      ? Number(sale.grand_total)
      : (Number(sale.total_amt || 0) > 0
          ? Number(sale.total_amt)
          : mappedItems.reduce((sum, i) => sum + (Number(i.total_amt) || 0), 0))
  );

  // Confirmed dispatch weight (ONLY from non-cancelled Outpasses in dispatched/outpassed/delivered/closed state or active outward stock movements)
  const rawOpStatus = String(outpass?.status || sale.outpass_status || '').trim().toUpperCase();
  const isOutpassCancelled = rawOpStatus === 'CANCELLED';
  const isOutpassDispatched = !isOutpassCancelled && ['OUTPASSED', 'DISPATCHED', 'DELIVERED', 'CLOSED', 'IN_TRANSIT'].includes(rawOpStatus);
  const outpassWt = isOutpassDispatched
    ? round2Num(Math.max(Number(outpass?.total_weight || 0), Number(outpassItemsAgg?.op_wt || 0)))
    : 0;
  const movementWt = round2Num(Number(stockMoveAgg?.out_wt || 0));

  let confirmedDispatchedWeight = 0;
  if (!isOrder) {
    if (outpassWt > 0) {
      confirmedDispatchedWeight = outpassWt;
    } else if (movementWt > 0) {
      confirmedDispatchedWeight = movementWt;
    }
  }

  // Honest Dispatch Status derivation
  const rawSaleDispatch = String(sale.dispatch_status || '').trim();
  const rawDispatchLower = rawSaleDispatch.toLowerCase();
  const isSaleCancelled = rawDispatchLower === 'cancelled' || isOutpassCancelled;
  let computedDispatchStatus = 'Pending';
  if (isOrder) {
    computedDispatchStatus = isSaleCancelled ? 'Cancelled' : 'Open Order';
  } else if (isSaleCancelled) {
    computedDispatchStatus = 'Cancelled';
  } else if (sale.actual_delivery_date || rawDispatchLower.includes('delivered') || rawOpStatus === 'DELIVERED') {
    computedDispatchStatus = 'Delivered';
  } else if (
    isOutpassDispatched ||
    rawDispatchLower === 'dispatched' ||
    rawDispatchLower === 'in transit' ||
    (movementWt > 0 && (invoiceNetWeight <= 0 || movementWt + 0.01 >= invoiceNetWeight))
  ) {
    computedDispatchStatus = 'Dispatched';
  } else if (movementWt > 0 && invoiceNetWeight > 0 && movementWt + 0.01 < invoiceNetWeight) {
    computedDispatchStatus = 'Partially Dispatched';
  } else {
    computedDispatchStatus = 'Pending';
  }

  // Honest Customer Receipt & Payment Status derivation
  const voucherNo = sale.voucher_no || (sale.is_order ? '' : `SAL-${String(sale.s_no || sale.id).padStart(5, '0')}`);
  const custLower = resolvedCustomerName.trim().toLowerCase();
  const receiptVnoUpper = String(sale.receipt_voucher_no || '').trim().toUpperCase();
  const salVoucherUpper = String(voucherNo || '').trim().toUpperCase();
  const billNoUpper = String(sale.inv_no || sale.s_no || '').trim().toUpperCase();

  const matchedReceipts = [];
  const seenReceiptKeys = new Set();
  for (const le of receiptEntries) {
    if (String(le.ledger_name || '').trim().toLowerCase() !== custLower) continue;
    const refMatch = String(le.reference_id || '').trim() === String(sale.id);
    const vnoUpper = String(le.voucher_no || '').trim().toUpperCase();
    const recVnoMatch = Boolean(receiptVnoUpper && vnoUpper === receiptVnoUpper);
    const partUpper = String(le.particulars || '').toUpperCase();
    const partMatch = Boolean(
      (salVoucherUpper && partUpper.includes(salVoucherUpper)) ||
      (billNoUpper && partUpper.includes(`INV #${billNoUpper}`))
    );
    if (refMatch || recVnoMatch || partMatch) {
      const uniq = `${le.voucher_no || ''}_${le.date || ''}_${le.credit || 0}`;
      if (!seenReceiptKeys.has(uniq)) {
        seenReceiptKeys.add(uniq);
        matchedReceipts.push({
          voucher_no: le.voucher_no || '',
          voucher_type: le.voucher_type || 'Receipt',
          date: le.date || '',
          amount: round2Num(le.credit || 0),
          particulars: le.particulars || ''
        });
      }
    }
  }
  for (const lv of linkedReceiptVouchers) {
    const vno = lv.voucher_no || '';
    const exists = matchedReceipts.some((r) => String(r.voucher_no || '').toUpperCase() === String(vno).toUpperCase());
    if (!exists && Number(lv.total_credit || lv.total_debit || 0) > 0) {
      matchedReceipts.push({
        voucher_no: vno,
        voucher_type: lv.voucher_type || 'Receipt',
        date: lv.date || '',
        amount: round2Num(lv.total_credit || lv.total_debit || 0),
        particulars: lv.narration || 'Linked Receipt Voucher'
      });
    }
  }

  const ledgerReceiptsTotal = round2Num(matchedReceipts.reduce((s, r) => s + Number(r.amount || 0), 0));
  const storedReceived = round2Num(sale.received_amount || 0);
  const advanceAdjusted = round2Num(sale.advance_adjusted || 0);
  const effectiveReceipts = ledgerReceiptsTotal > 0 ? ledgerReceiptsTotal : storedReceived;
  const actualReceivedAmount = isOrder ? 0 : round2Num(effectiveReceipts + advanceAdjusted);
  const actualBalanceDue = isOrder ? invoiceTotal : round2Num(Math.max(0, invoiceTotal - actualReceivedAmount));

  let computedPaymentStatus = 'Order';
  if (!isOrder) {
    if (isSaleCancelled) {
      computedPaymentStatus = 'Cancelled';
    } else if (invoiceTotal > 0 && actualBalanceDue <= 0.01) {
      computedPaymentStatus = 'Paid';
    } else if (actualReceivedAmount > 0.009) {
      computedPaymentStatus = 'Partially Paid';
    } else {
      computedPaymentStatus = 'Unpaid';
    }
  }

  return {
    ...sale,
    customer: resolvedCustomerName,
    customer_name: resolvedCustomerName,
    customer_gstin: resolvedGstin,
    master_customer_gstin: customerRow?.gst_number || '',
    party_state: resolvedState,
    party_state_code: resolvedStateCode,
    transporter_name: resolvedTransporterName,
    pur_trans: resolvedTransporterName || sale.pur_trans || '',
    godown_from_name: resolvedGodownName,
    godown_name: resolvedGodownName,
    outpass_id: sale.outpass_id || outpass?.id || null,
    outpass_no: sale.outpass_no || outpass?.outpass_no || '',
    outpass_status: outpass?.status || sale.outpass_status || '',
    outpass_date: outpass?.date || '',
    items: mappedItems,
    item_count: mappedItems.length,
    primary_item_name: itemNames[0] || 'Sale Item',
    item_summary: itemNames.length > 1 ? `${itemNames[0]} + ${itemNames.length - 1} more` : (itemNames[0] || 'Sale Item'),
    item_name: itemNames.join(', ') || 'Sale Item',
    unique_lots: uniqueLots,
    primary_lot_no: uniqueLots[0] || '',
    lot_summary: uniqueLots.length > 1 ? `${uniqueLots.length} Lots (${uniqueLots.join(', ')})` : (uniqueLots[0] || ''),
    lot_no: uniqueLots.join(', ') || '',
    qty: totalQty,
    weight: mappedItems[0]?.weight || 0,
    total_wt: invoiceNetWeight,
    product_net_weight: invoiceNetWeight,
    confirmed_dispatched_weight: confirmedDispatchedWeight,
    computed_dispatch_status: computedDispatchStatus,
    rate: mappedItems[0]?.rate || 0,
    disc_perc: mappedItems[0]?.disc_perc || 0,
    tax_perc: mappedItems[0]?.tax_perc || 0,
    total_amt: invoiceTotal,
    grand_total: invoiceTotal,
    actual_received_amount: actualReceivedAmount,
    actual_balance_due: actualBalanceDue,
    payment_status: computedPaymentStatus,
    receipt_vouchers: matchedReceipts,
    qc_id: primaryQc?.qc_id || null,
    qc_no: primaryQc?.qc_no || null,
    deductions: SalesService.normalizeSalesDeductions(sale.deductions_json, sale),
    created_by: sale.created_by || outpass?.created_by || stockMoveAgg?.created_by || '',
    updated_at: sale.updated_at || outpass?.updated_at || '',
    is_cancelled: isSaleCancelled
  };
}

// GET all sales (strictly read-only enriched register)
router.get(['/', '/list'], async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const runner = db.forCompany(activeCompanyId);
    const isOrderQuery = req.query.is_order;
    const fyQuery = req.query.financial_year;

    let query = `SELECT * FROM sales WHERE 1=1`;
    const params = [];
    if (isOrderQuery !== undefined) {
      query += ` AND COALESCE(is_order, 0) = ?`;
      params.push(parseInt(isOrderQuery, 10) || 0);
    }
    if (fyQuery && String(fyQuery).toUpperCase() !== 'ALL') {
      query += ` AND financial_year = ?`;
      params.push(String(fyQuery).trim());
    }
    query += ` ORDER BY date DESC, id DESC`;

    const salesRes = await runner.query(query, params);
    const salesRows = salesRes.rows || [];
    if (salesRows.length === 0) {
      return res.json([]);
    }

    const [
      customersRes,
      transportsRes,
      godownsRes,
      outpassesRes,
      outpassItemsRes,
      salesItemsRes,
      stockMovesRes,
      qcRes,
      receiptLedgerRes,
      receiptVouchersRes
    ] = await Promise.all([
      runner.query(`SELECT id, name, print_name, gst_number, state, state_code, mobile1 FROM customer_master`).catch(() => ({ rows: [] })),
      runner.query(`SELECT id, name, print_name FROM transport_master`).catch(() => ({ rows: [] })),
      runner.query(`SELECT id, godown_name FROM godown_master`).catch(() => ({ rows: [] })),
      runner.query(`SELECT id, outpass_no, date, reference_type, reference_id, status, total_qty, total_weight, net_load_weight, transporter, from_godown_name, created_by, updated_at FROM outpasses WHERE reference_type = 'SALES' ORDER BY id DESC`).catch(() => ({ rows: [] })),
      runner.query(`SELECT outpass_id, COALESCE(SUM(qty), 0) AS op_qty, COALESCE(SUM(total_weight), 0) AS op_wt FROM outpass_items GROUP BY outpass_id`).catch(() => ({ rows: [] })),
      runner.query(`SELECT * FROM sales_items ORDER BY id ASC`).catch(() => ({ rows: [] })),
      runner.query(`SELECT source_id, SUM(CASE WHEN direction = 'OUT' THEN COALESCE(qty, 0) ELSE 0 END) AS out_qty, SUM(CASE WHEN direction = 'OUT' THEN COALESCE(weight, 0) ELSE 0 END) AS out_wt, MAX(created_by) AS created_by FROM stock_movements WHERE source_module = 'SALES' AND COALESCE(is_reversed, 0) = 0 GROUP BY source_id`).catch(() => ({ rows: [] })),
      runner.query(`SELECT id, qc_no, rm_lot_no, overall_result FROM qc_inspections ORDER BY id DESC`).catch(() => ({ rows: [] })),
      runner.query(`SELECT ledger_name, voucher_no, voucher_type, date, particulars, credit, reference_id FROM ledger_entries WHERE COALESCE(is_reversed, 0) = 0 AND voucher_type IN ('Receipt', 'REC', 'Bank Receipt', 'Cash Receipt', 'Advance')`).catch(() => ({ rows: [] })),
      runner.query(`SELECT source_id, voucher_no, voucher_type, date, total_debit, total_credit, narration FROM voucher WHERE COALESCE(is_reversed, 0) = 0 AND source_module = 'sales_receipt'`).catch(() => ({ rows: [] }))
    ]);

    const customerById = new Map();
    const customerByName = new Map();
    for (const c of customersRes.rows || []) {
      customerById.set(String(c.id), c);
      if (c.name) customerByName.set(String(c.name).trim().toLowerCase(), c);
      if (c.print_name) customerByName.set(String(c.print_name).trim().toLowerCase(), c);
    }

    const transportById = new Map((transportsRes.rows || []).map((t) => [String(t.id), t]));
    const godownById = new Map((godownsRes.rows || []).map((g) => [String(g.id), g]));

    const outpassById = new Map();
    const outpassBySaleId = new Map();
    for (const op of outpassesRes.rows || []) {
      outpassById.set(String(op.id), op);
      if (op.reference_id && !outpassBySaleId.has(String(op.reference_id))) {
        outpassBySaleId.set(String(op.reference_id), op);
      }
    }
    const opItemsByOpId = new Map((outpassItemsRes.rows || []).map((r) => [String(r.outpass_id), r]));

    const itemsBySaleId = new Map();
    for (const it of salesItemsRes.rows || []) {
      const k = String(it.sales_id);
      if (!itemsBySaleId.has(k)) itemsBySaleId.set(k, []);
      itemsBySaleId.get(k).push(it);
    }

    const stockMoveBySaleId = new Map((stockMovesRes.rows || []).map((r) => [String(r.source_id), r]));

    const qcMap = new Map();
    for (const q of qcRes.rows || []) {
      const lk = String(q.rm_lot_no || '').trim().toUpperCase();
      if (lk && !qcMap.has(lk)) qcMap.set(lk, q);
    }

    const linkedRecVouchersBySaleId = new Map();
    for (const v of receiptVouchersRes.rows || []) {
      const k = String(v.source_id);
      if (!linkedRecVouchersBySaleId.has(k)) linkedRecVouchersBySaleId.set(k, []);
      linkedRecVouchersBySaleId.get(k).push(v);
    }

    const enrichedList = salesRows.map((sale) => {
      const custRow =
        customerById.get(String(sale.customer_id || '')) ||
        customerById.get(String(sale.customer || '')) ||
        customerByName.get(String(sale.customer || '').trim().toLowerCase()) ||
        null;
      const transRow = transportById.get(String(sale.transporter_id || '')) || null;
      const gdRow = godownById.get(String(sale.godown_from_id || '')) || null;
      const opRow =
        (sale.outpass_id ? outpassById.get(String(sale.outpass_id)) : null) ||
        outpassBySaleId.get(String(sale.id)) ||
        null;
      const opItemsAgg = opRow ? opItemsByOpId.get(String(opRow.id)) : null;

      return deriveSalesRegisterFields({
        sale,
        items: itemsBySaleId.get(String(sale.id)) || [],
        outpass: opRow,
        outpassItemsAgg: opItemsAgg,
        stockMoveAgg: stockMoveBySaleId.get(String(sale.id)) || null,
        receiptEntries: receiptLedgerRes.rows || [],
        linkedReceiptVouchers: linkedRecVouchersBySaleId.get(String(sale.id)) || [],
        qcMap,
        customerRow: custRow,
        transporterRow: transRow,
        godownRow: gdRow
      });
    });

    res.json(enrichedList);
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ message: 'Error fetching sales', error: error.message });
  }
});

// GET sales by ID (enriched read-only single record)
router.get('/:id', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const runner = db.forCompany(activeCompanyId);
    const id = req.params.id;
    if (!id || id === 'undefined' || id === 'null' || isNaN(Number(id))) {
      return res.status(404).json({ message: 'Sales record not found' });
    }
    const salesResult = await runner.query('SELECT * FROM sales WHERE id = ?', [id]);
    if (salesResult.rows.length === 0) {
      return res.status(404).json({ message: 'Sales record not found' });
    }

    const salesRow = salesResult.rows[0];
    const itemsResult = await runner.query('SELECT * FROM sales_items WHERE sales_id = ? ORDER BY id ASC', [id]);
    const items = itemsResult.rows || [];

    let outpass = null;
    let outpassItemsAgg = null;
    try {
      if (salesRow.outpass_id) {
        const opRes = await runner.query('SELECT * FROM outpasses WHERE id = ? LIMIT 1', [salesRow.outpass_id]);
        outpass = opRes.rows?.[0] || null;
      } else {
        const opRes = await runner.query("SELECT * FROM outpasses WHERE reference_type = 'SALES' AND reference_id = ? LIMIT 1", [id]);
        outpass = opRes.rows?.[0] || null;
      }
      if (outpass) {
        const opItems = await runner.query('SELECT * FROM outpass_items WHERE outpass_id = ?', [outpass.id]);
        outpass.items = opItems.rows || [];
        outpassItemsAgg = {
          op_qty: (opItems.rows || []).reduce((s, r) => s + Number(r.qty || 0), 0),
          op_wt: (opItems.rows || []).reduce((s, r) => s + Number(r.total_weight || 0), 0)
        };
      }
    } catch (_) {}

    let customerRow = null;
    try {
      const cKey = String(salesRow.customer_id || salesRow.customer || '').trim();
      if (cKey) {
        const cRes = await runner.query(
          `SELECT id, name, print_name, gst_number, state, state_code, mobile1
           FROM customer_master
           WHERE CAST(id AS TEXT) = ? OR LOWER(TRIM(name)) = LOWER(TRIM(?)) OR LOWER(TRIM(COALESCE(print_name, ''))) = LOWER(TRIM(?))
           LIMIT 1`,
          [cKey, String(salesRow.customer || ''), String(salesRow.customer || '')]
        );
        customerRow = cRes.rows?.[0] || null;
      }
    } catch (_) {}

    let transporterRow = null;
    try {
      if (salesRow.transporter_id) {
        const tRes = await runner.query('SELECT id, name, print_name FROM transport_master WHERE id = ? LIMIT 1', [salesRow.transporter_id]);
        transporterRow = tRes.rows?.[0] || null;
      }
    } catch (_) {}

    let godownRow = null;
    try {
      if (salesRow.godown_from_id) {
        const gRes = await runner.query('SELECT id, godown_name FROM godown_master WHERE id = ? LIMIT 1', [salesRow.godown_from_id]);
        godownRow = gRes.rows?.[0] || null;
      }
    } catch (_) {}

    const [stockMoveRes, qcRes, recLedgerRes, recVoucherRes] = await Promise.all([
      runner.query(`SELECT SUM(CASE WHEN direction = 'OUT' THEN COALESCE(qty, 0) ELSE 0 END) AS out_qty, SUM(CASE WHEN direction = 'OUT' THEN COALESCE(weight, 0) ELSE 0 END) AS out_wt, MAX(created_by) AS created_by FROM stock_movements WHERE source_module = 'SALES' AND source_id = ? AND COALESCE(is_reversed, 0) = 0`, [id]).catch(() => ({ rows: [] })),
      runner.query(`SELECT id, qc_no, rm_lot_no, overall_result FROM qc_inspections ORDER BY id DESC`).catch(() => ({ rows: [] })),
      runner.query(`SELECT ledger_name, voucher_no, voucher_type, date, particulars, credit, reference_id FROM ledger_entries WHERE COALESCE(is_reversed, 0) = 0 AND voucher_type IN ('Receipt', 'REC', 'Bank Receipt', 'Cash Receipt', 'Advance')`).catch(() => ({ rows: [] })),
      runner.query(`SELECT source_id, voucher_no, voucher_type, date, total_debit, total_credit, narration FROM voucher WHERE COALESCE(is_reversed, 0) = 0 AND source_module = 'sales_receipt' AND source_id = ?`, [id]).catch(() => ({ rows: [] }))
    ]);

    const qcMap = new Map();
    for (const q of qcRes.rows || []) {
      const lk = String(q.rm_lot_no || '').trim().toUpperCase();
      if (lk && !qcMap.has(lk)) qcMap.set(lk, q);
    }

    const enriched = deriveSalesRegisterFields({
      sale: salesRow,
      items,
      outpass,
      outpassItemsAgg,
      stockMoveAgg: stockMoveRes.rows?.[0] || null,
      receiptEntries: recLedgerRes.rows || [],
      linkedReceiptVouchers: recVoucherRes.rows || [],
      qcMap,
      customerRow,
      transporterRow,
      godownRow
    });

    res.json({
      ...enriched,
      outpass
    });
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ message: 'Error fetching sales' });
  }
});

// POST create new sales
router.post('/', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const result = await SalesService.createSale(activeCompanyId, req.body, req.user);
    res.status(201).json({
      ...result,
      message: req.body?.formData?.is_order ? 'Sales Order saved successfully!' : 'Sales record saved successfully!'
    });
  } catch (error) {
    console.error('Error saving sales:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Error saving sales',
      error: error.message
    });
  }
});

// PUT update sales
router.put('/:id', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const result = await SalesService.updateSale(activeCompanyId, req.params.id, req.body, req.user);
    res.json({
      ...result,
      message: 'Sales record updated successfully!'
    });
  } catch (error) {
    console.error('Error updating sales:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Error updating sales',
      error: error.message
    });
  }
});

// POST controlled cancellation for posted sales (Admin / authorized users)
router.post('/:id/cancel', requireSalesCancelPermission, async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const id = parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid sales record ID' });
    }
    const result = await SalesService.deleteSale(activeCompanyId, id, {
      ...(req.user || {}),
      cancel_reason: String(req.body?.reason || '').trim()
    });
    res.json({
      ...result,
      message: 'Sales record cancelled; stock, outpass, and accounting entries reversed cleanly (archived to Recycle Bin).'
    });
  } catch (error) {
    console.error('Error cancelling sales:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Error cancelling sales record'
    });
  }
});

// DELETE sales (role-gated, reverts stock/outpass/vouchers cleanly)
router.delete('/:id', requireSalesCancelPermission, async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const id = parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid sales record ID' });
    }
    const result = await SalesService.deleteSale(activeCompanyId, id, req.user);
    res.json(result);
  } catch (error) {
    console.error('Error deleting sales:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Error deleting sales'
    });
  }
});

// GET operational charges for a sale
router.get('/:id/charges', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const engine = require('../services/operationalChargeEngine');
    const result = await engine.getOperationalTraceability(activeCompanyId, {
      sourceModule: 'SALES',
      sourceTransactionId: req.params.id
    });
    res.json({ success: true, charges: result.charges || [], traceability: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/sales/:id/ledger-statement - Complete Sales-wise Transaction Ledger Statement
router.get('/:id/ledger-statement', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const runner = db.forCompany(activeCompanyId);
    const rawId = String(req.params.id || '').trim();

    let saleRes = { rows: [] };
    if (/^\d+$/.test(rawId)) {
      saleRes = await runner.query('SELECT * FROM sales WHERE id = ? LIMIT 1', [parseInt(rawId, 10)]);
    }
    if (!saleRes.rows || saleRes.rows.length === 0) {
      saleRes = await runner.query(
        'SELECT * FROM sales WHERE UPPER(TRIM(COALESCE(voucher_no, \'\'))) = UPPER(TRIM(?)) OR CAST(s_no AS TEXT) = ? LIMIT 1',
        [rawId, rawId]
      );
    }
    const sale = saleRes.rows && saleRes.rows[0];
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sales record not found' });
    }
    const salesId = sale.id;

    let items = [];
    try {
      const iRes = await runner.query('SELECT * FROM sales_items WHERE sales_id = ? ORDER BY id ASC', [salesId]);
      items = iRes.rows || [];
    } catch (_) {}

    // Resolve official customer details
    let customerName = sale.customer_name || sale.customer || 'Customer';
    let customerPhone = sale.phone || '';
    let customerGstin = '';
    if (sale.customer_id || sale.customer) {
      try {
        const cKey = String(sale.customer_id || sale.customer).trim();
        const cRes = await runner.query(
          `SELECT id, name, print_name, mobile1, phone_off, gst_number
           FROM customer_master
           WHERE TRIM(CAST(id AS TEXT)) = ? OR LOWER(TRIM(name)) = LOWER(?) OR LOWER(TRIM(COALESCE(print_name, ''))) = LOWER(?)
           LIMIT 1`,
          [cKey, String(sale.customer || '').trim(), String(sale.customer || '').trim()]
        );
        if (cRes.rows && cRes.rows[0]) {
          customerName = cRes.rows[0].print_name || cRes.rows[0].name || customerName;
          customerPhone = customerPhone || cRes.rows[0].mobile1 || cRes.rows[0].phone_off || '';
          customerGstin = cRes.rows[0].gst_number || '';
        }
      } catch (_) {}
    }

    if (/^\d+$/.test(String(customerName).trim())) {
      try {
        const resolved = await resolveCustomerName(sale.customer_id || sale.customer, activeCompanyId);
        if (resolved) customerName = resolved;
      } catch (_) {}
    }

    let transporterName = sale.pur_trans || 'Transport / Logistics';
    if (sale.pur_trans && /^\d+$/.test(String(sale.pur_trans).trim())) {
      try {
        const tRes = await runner.query(
          'SELECT name, print_name FROM transport_master WHERE TRIM(CAST(id AS TEXT)) = ? LIMIT 1',
          [String(sale.pur_trans).trim()]
        );
        if (tRes.rows && tRes.rows[0]) {
          transporterName = tRes.rows[0].print_name || tRes.rows[0].name || transporterName;
        }
      } catch (_) {}
    }

    let loadmanName = sale.loadman_name || 'Loadman Team';
    if (sale.loadman_worker_id) {
      try {
        const lmRes = await runner.query(
          'SELECT name, worker_name FROM operational_parties WHERE TRIM(CAST(id AS TEXT)) = ? LIMIT 1',
          [String(sale.loadman_worker_id).trim()]
        );
        if (lmRes.rows && lmRes.rows[0]) {
          loadmanName = lmRes.rows[0].name || lmRes.rows[0].worker_name || loadmanName;
        }
      } catch (_) {}
    }

    let voucherNo = sale.voucher_no || `SAL-${String(sale.s_no || salesId).padStart(5, '0')}`;
    let voucherId = null;
    let rawVEntries = [];

    try {
      const vRes = await runner.query(
        `SELECT * FROM voucher
         WHERE COALESCE(is_reversed, 0) = 0
           AND (
             (LOWER(COALESCE(source_module, '')) = 'sales' AND source_id = ?)
             OR (UPPER(TRIM(COALESCE(voucher_no, ''))) = UPPER(TRIM(?)) AND ? != '')
             OR (reference_no IN (?, ?) AND voucher_type IN ('Sales', 'SAL'))
           )
         ORDER BY id DESC LIMIT 1`,
        [Number(salesId), String(sale.voucher_no || ''), String(sale.voucher_no || ''), String(salesId), `SAL-${salesId}`]
      );
      if (vRes.rows && vRes.rows[0]) {
        voucherId = vRes.rows[0].id;
        voucherNo = vRes.rows[0].voucher_no || voucherNo;
        const veRes = await runner.query('SELECT * FROM voucher_entry WHERE voucher_id = ? ORDER BY id ASC', [voucherId]);
        rawVEntries = veRes.rows || [];
      }
    } catch (vErr) {
      console.warn('Notice checking voucher for sales ledger-statement:', vErr.message);
    }

    const computedBaseFromItems = items.reduce((s, it) => s + (Number(it.qty || 0) * Number(it.rate || 0)), 0);
    const computedTaxFromItems = items.reduce((s, it) => {
      const lineAmt = Number(it.total_amt || 0);
      const qtyRate = Number(it.qty || 0) * Number(it.rate || 0);
      return s + (Number(it.cgst_amount || 0) + Number(it.sgst_amount || 0) + Number(it.igst_amount || 0) || Math.max(0, lineAmt - qtyRate));
    }, 0);

    const baseAmount = Number(sale.base_amt || sale.bill_amt || computedBaseFromItems || 0);
    const taxAmount = Number(sale.tax_amt || sale.tax_amount || computedTaxFromItems || 0);
    const isInterstate = String(sale.tax_type || '').toLowerCase().includes('inter') || Number(sale.igst_amt || sale.igst_amount || 0) > 0;
    const rawCgst = Number(sale.cgst_amt || sale.cgst_amount || 0);
    const rawSgst = Number(sale.sgst_amt || sale.sgst_amount || 0);
    const rawIgst = Number(sale.igst_amt || sale.igst_amount || 0);
    const cgstAmount = rawCgst > 0 ? rawCgst : (isInterstate ? 0 : Number((taxAmount / 2).toFixed(2)));
    const sgstAmount = rawSgst > 0 ? rawSgst : (isInterstate ? 0 : Number((taxAmount - cgstAmount).toFixed(2)));
    const igstAmount = rawIgst > 0 ? rawIgst : (isInterstate ? taxAmount : 0);

    const deductions = SalesService.normalizeSalesDeductions(sale.deductions_json, sale);
    const addDeductionsTotal = deductions.filter((d) => d.type === 'ADD').reduce((s, d) => s + Number(d.amount || 0), 0);
    const lessDeductionsTotal = deductions.filter((d) => d.type === 'LESS').reduce((s, d) => s + Number(d.amount || 0), 0);

    const grandTotal = Number(
      (sale.grand_total && Number(sale.grand_total) > 0)
        ? Number(sale.grand_total)
        : (sale.total_amt && Number(sale.total_amt) > 0)
          ? Number(sale.total_amt)
          : (baseAmount + taxAmount + addDeductionsTotal - lessDeductionsTotal).toFixed(2)
    );

    const classifyAccountHead = (ledgerName, veType) => {
      const l = String(ledgerName || '').toLowerCase();
      if (l === String(customerName).toLowerCase()) return 'Sundry Debtors (Customer)';
      if (l.includes('sales')) return 'Direct Income / Sales';
      if (l.includes('cgst') || l.includes('sgst') || l.includes('igst') || l.includes('tcs') || l.includes('gst')) return 'Duties & Taxes';
      if (l.includes('freight') || l.includes('loading')) return 'Transport & Charges';
      if (l.includes('round')) return 'Indirect Expense / Income';
      return veType === 'Dr' ? 'Debit Account' : 'Credit Account';
    };

    let journalEntries = [];
    if (rawVEntries.length > 0) {
      journalEntries = rawVEntries.map((ve, idx) => {
        const lName = /^\d+$/.test(String(ve.ledger_name || '').trim()) ? customerName : (ve.ledger_name || 'Ledger Account');
        return {
          no: idx + 1,
          ledger_name: lName,
          account_head: classifyAccountHead(lName, ve.type),
          debit: Number(ve.debit || 0),
          credit: Number(ve.credit || 0),
          particulars: ve.remarks || `${voucherNo}`
        };
      });
    } else {
      let idx = 1;
      journalEntries.push({
        no: idx++,
        ledger_name: customerName,
        account_head: 'Sundry Debtors (Customer)',
        debit: grandTotal,
        credit: 0,
        particulars: `Sales Invoice ${voucherNo}`
      });
      if (baseAmount > 0) {
        journalEntries.push({
          no: idx++,
          ledger_name: 'Sales Account',
          account_head: 'Direct Income / Sales',
          debit: 0,
          credit: baseAmount,
          particulars: `${customerName} taxable sales`
        });
      }
      if (cgstAmount > 0) {
        journalEntries.push({ no: idx++, ledger_name: 'Output CGST', account_head: 'Duties & Taxes', debit: 0, credit: cgstAmount, particulars: `CGST on ${voucherNo}` });
      }
      if (sgstAmount > 0) {
        journalEntries.push({ no: idx++, ledger_name: 'Output SGST', account_head: 'Duties & Taxes', debit: 0, credit: sgstAmount, particulars: `SGST on ${voucherNo}` });
      }
      if (igstAmount > 0) {
        journalEntries.push({ no: idx++, ledger_name: 'Output IGST', account_head: 'Duties & Taxes', debit: 0, credit: igstAmount, particulars: `IGST on ${voucherNo}` });
      }
      if (Number(sale.freight_recovery_amt || 0) > 0) {
        journalEntries.push({ no: idx++, ledger_name: 'Freight Recovery', account_head: 'Transport & Charges', debit: 0, credit: Number(sale.freight_recovery_amt), particulars: `Freight recovered on ${voucherNo}` });
      }
      if (Number(sale.loading_charges_amt || 0) > 0) {
        journalEntries.push({ no: idx++, ledger_name: 'Loading & Unloading Recovery', account_head: 'Transport & Charges', debit: 0, credit: Number(sale.loading_charges_amt), particulars: `Loading recovered on ${voucherNo}` });
      }
      if (Number(sale.other_charges || 0) > 0) {
        journalEntries.push({ no: idx++, ledger_name: 'Other Sales Charges', account_head: 'Transport & Charges', debit: 0, credit: Number(sale.other_charges), particulars: `Other charges on ${voucherNo}` });
      }
      if (Number(sale.tcs_amount || 0) > 0) {
        journalEntries.push({ no: idx++, ledger_name: 'TCS on Sales', account_head: 'Duties & Taxes', debit: 0, credit: Number(sale.tcs_amount), particulars: `TCS on ${voucherNo}` });
      }
      for (const d of deductions) {
        journalEntries.push({
          no: idx++,
          ledger_name: d.name,
          account_head: d.type === 'ADD' ? 'Duties / Additional Charges' : 'Sales Deductions / Rebates',
          debit: d.type === 'LESS' ? Number(d.amount) : 0,
          credit: d.type === 'ADD' ? Number(d.amount) : 0,
          particulars: `${d.name} on ${voucherNo}`
        });
      }
    }

    const debitTotal = Number(journalEntries.reduce((s, j) => s + Number(j.debit || 0), 0).toFixed(2));
    const creditTotal = Number(journalEntries.reduce((s, j) => s + Number(j.credit || 0), 0).toFixed(2));
    const isBalanced = Math.abs(debitTotal - creditTotal) < 0.01;

    // Fetch linked Receipt & Freight vouchers
    let linkedVouchers = [];
    try {
      const lvRes = await runner.query(
        `SELECT id, voucher_no, voucher_type, date, total_debit, total_credit, narration, source_module
         FROM voucher
         WHERE COALESCE(is_reversed, 0) = 0
           AND source_module IN ('sales_receipt', 'sales_freight')
           AND source_id = ?
         ORDER BY id ASC`,
        [Number(salesId)]
      );
      for (const v of lvRes.rows || []) {
        const veRes = await runner.query('SELECT ledger_name, type, debit, credit, remarks FROM voucher_entry WHERE voucher_id = ? ORDER BY id ASC', [v.id]);
        linkedVouchers.push({ ...v, entries: veRes.rows || [] });
      }
    } catch (_) {}

    // Check customer receipts against this invoice
    let customerReceipts = 0;
    let receiptRows = [];
    try {
      const recRes = await runner.query(
        `SELECT date, voucher_no, particulars, credit
         FROM ledger_entries
         WHERE COALESCE(is_reversed, 0) = 0
           AND voucher_type IN ('Receipt', 'REC', 'Bank Receipt', 'Cash Receipt', 'Advance')
           AND LOWER(TRIM(ledger_name)) = LOWER(TRIM(?))
           AND (reference_id = ? OR voucher_no = ? OR particulars LIKE ?)`,
        [customerName, String(salesId), String(sale.receipt_voucher_no || ''), `%${voucherNo}%`]
      );
      receiptRows = recRes.rows || [];
      customerReceipts = receiptRows.reduce((s, r) => s + Number(r.credit || 0), 0);
    } catch (_) {}

    if (customerReceipts === 0 && Number(sale.received_amount || 0) > 0) {
      customerReceipts = Number(sale.received_amount || 0);
    }
    const advanceAdj = Number(sale.advance_adjusted || 0);
    const customerOutstanding = Number(Math.max(0, grandTotal - customerReceipts - advanceAdj).toFixed(2));
    const loadmanCharges = Number(sale.loadman_charges || 0);

    const individualLedgers = {
      customer: {
        title: `Customer Ledger – ${customerName}`,
        ledger_name: customerName,
        category: 'Sundry Debtors',
        rows: [
          { date: sale.date, particulars: `Sales invoice ${voucherNo}`, voucher: voucherNo, debit: grandTotal, credit: 0 },
          ...receiptRows.map((rr) => ({
            date: rr.date,
            particulars: rr.particulars || 'Receipt received',
            voucher: rr.voucher_no || sale.receipt_voucher_no || voucherNo,
            debit: 0,
            credit: Number(rr.credit || 0)
          })),
          ...(advanceAdj > 0 ? [{
            date: sale.date,
            particulars: 'Advance adjusted',
            voucher: voucherNo,
            debit: 0,
            credit: advanceAdj
          }] : [])
        ],
        closing_balance: Math.abs(customerOutstanding),
        closing_balance_type: customerOutstanding >= 0 ? 'Dr' : 'Cr'
      },
      sales_account: {
        title: 'Sales Account Ledger',
        ledger_name: 'Sales Account',
        category: 'Direct Income / Revenue',
        rows: [
          { date: sale.date, particulars: `Sales to ${customerName}`, voucher: voucherNo, debit: 0, credit: baseAmount }
        ],
        closing_balance: baseAmount,
        closing_balance_type: 'Cr'
      },
      gst_output: {
        title: 'GST Output Tax Ledgers',
        category: 'Duties & Taxes (Current Liabilities)',
        rows: isInterstate ? (
          igstAmount > 0 ? [{ date: sale.date, ledger: 'Output IGST', particulars: `Sales ${voucherNo}`, voucher: voucherNo, debit: 0, credit: igstAmount }] : []
        ) : [
          ...(cgstAmount > 0 ? [{ date: sale.date, ledger: 'Output CGST', particulars: `Sales ${voucherNo}`, voucher: voucherNo, debit: 0, credit: cgstAmount }] : []),
          ...(sgstAmount > 0 ? [{ date: sale.date, ledger: 'Output SGST', particulars: `Sales ${voucherNo}`, voucher: voucherNo, debit: 0, credit: sgstAmount }] : [])
        ],
        total_output_tax: Number((cgstAmount + sgstAmount + igstAmount).toFixed(2)),
        closing_balance: Number((cgstAmount + sgstAmount + igstAmount).toFixed(2)),
        closing_balance_type: 'Cr'
      },
      deductions_charges: {
        title: 'TCS / Charges & Deductions',
        category: 'Statutory / Sales Adjustments',
        rows: deductions.map((d) => ({
          date: sale.date,
          ledger: d.name,
          particulars: d.remarks || `${d.name} (${d.type})`,
          voucher: voucherNo,
          debit: d.type === 'LESS' ? Number(d.amount) : 0,
          credit: d.type === 'ADD' ? Number(d.amount) : 0
        })),
        closing_balance: Math.abs(addDeductionsTotal - lessDeductionsTotal),
        closing_balance_type: addDeductionsTotal >= lessDeductionsTotal ? 'Cr' : 'Dr'
      },
      loadman: {
        title: `Loadman Details – ${loadmanName}`,
        ledger_name: loadmanName,
        category: 'Loading / Dispatch Handling',
        rows: loadmanCharges > 0 ? [
          { date: sale.date, particulars: `Loading charges on ${voucherNo}`, voucher: voucherNo, debit: 0, credit: loadmanCharges }
        ] : [],
        closing_balance: loadmanCharges,
        closing_balance_type: 'Cr'
      }
    };

    res.json({
      success: true,
      data: {
        sales: {
          ...sale,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_gstin: customerGstin || sale.customer_gstin || '',
          transporter_name: transporterName,
          loadman_name: loadmanName,
          voucher_no: voucherNo,
          net_receivable: grandTotal
        },
        voucher: {
          voucher_no: voucherNo,
          voucher_type: sale.is_order ? 'Sales Order' : 'Sales',
          date: sale.date,
          s_no: sale.s_no,
          customer: customerName
        },
        linked_vouchers: linkedVouchers,
        items,
        journal_entries: journalEntries,
        totals: {
          debit_total: debitTotal,
          credit_total: creditTotal,
          is_balanced: isBalanced
        },
        party_balances: {
          customer: {
            name: customerName,
            invoice_debit: grandTotal,
            receipts_credit: customerReceipts,
            advance_adjusted: advanceAdj,
            outstanding: customerOutstanding
          },
          transporter: {
            name: transporterName,
            vehicle_no: sale.lorry_no || '',
            freight_amount: Number(sale.freight_amount || 0),
            freight_paid_by: sale.freight_paid_by || 'Buyer',
            freight_voucher_no: sale.freight_voucher_no || ''
          },
          loadman: {
            name: loadmanName,
            loadman_charges: loadmanCharges
          },
          total_receivable: customerOutstanding
        },
        individual_ledgers: individualLedgers
      }
    });
  } catch (error) {
    console.error('Error generating sales ledger statement:', error);
    res.status(500).json({ success: false, message: 'Error generating sales ledger statement', error: error.message });
  }
});

module.exports = router;
