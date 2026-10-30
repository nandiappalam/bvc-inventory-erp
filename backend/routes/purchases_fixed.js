// This file fixes the syntax error in backend/routes/purchases.js
// by removing duplicated trailing blocks after the main `module.exports = router`.
//
// IMPORTANT: If you use this file, update backend/server.js to require
// './routes/purchases_fixed' instead of './routes/purchases'.

const express = require('express')
const router = express.Router()
const db = require('../config/database')
const recycleBinService = require('../services/RecycleBinService')
const { createPurchaseLedgerEntries, deleteLedgerEntries } = require('../utils/ledgerHelper')
const { reserveNextLotNumber, recordLotNumber } = require('../utils/lotHelper')
const { calculateLineTax } = require('../services/taxEngine')
const { getColdStorageTariff, calculateLabourCharge, createOrUpdateColdStorageBill } = require('../services/ColdStorageBillingService')
const { ensureColdStorageSchema } = require('../utils/coldStorageSchema')
const OpChargeEngine = require('../services/operationalChargeEngine')

// Middleware to ensure cold storage schema exists for purchase auto-inward actions
router.use(async (req, res, next) => {
  try {
    const cId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    await ensureColdStorageSchema(cId);
  } catch (err) {
    console.warn('[purchases] Cold storage schema check notice:', err.message);
  }
  next();
});

const normalizePurchaseItem = (item) => {
  return {
    item_id: item.item_id || item.itemId || null,
    item_name: item.item_name || item.itemName || item.name || '',
    lot_no: item.lot_no || item.lotNo || '',
    per_unit_weight: Number(item.per_unit_weight ?? item.perUnitWeight ?? item.weight ?? 0) || 0,
    total_weight: Number(item.total_weight ?? item.totalWt ?? item.total_wt ?? 0) || 0,
    qty: Number(item.qty ?? item.quantity ?? 0) || 0,
    rate: Number(item.rate ?? item.price ?? 0) || 0,
    disc_percent: Number(item.disc_percent ?? item.disc ?? 0) || 0,
    tax_percent: Number(item.tax_percent ?? item.tax_rate ?? item.gst_rate ?? item.tax ?? 0) || 0,
    tax_type: item.tax_type || item.taxType || '',
    hsn_code: item.hsn_code || item.hsnCode || '',
    disc_amount: Number(item.disc_amount ?? item.discAmount ?? 0) || 0,
    tax_amount: Number(item.tax_amount ?? item.taxAmount ?? 0) || 0,
    amount: Number(item.amount ?? item.totalAmount ?? item.total ?? 0) || 0,
  }
}

const getPurchaseWeights = (formData = {}) => {
  const grossInput = formData.gross_weight ?? formData.cross_weight;
  const tareInput = formData.tare_weight;
  const grossWeight = grossInput === '' || grossInput === null || grossInput === undefined ? 0 : Number(grossInput);
  const tareWeight = tareInput === '' || tareInput === null || tareInput === undefined ? 0 : Number(tareInput);
  if (!Number.isFinite(grossWeight) || !Number.isFinite(tareWeight) || grossWeight < 0 || tareWeight < 0) {
    return { error: 'Cross Weight and Tare Weight must be valid non-negative numbers.' };
  }
  const netWeight = Number((grossWeight - tareWeight).toFixed(2));
  if (netWeight < 0) return { error: 'Tare Weight cannot exceed Cross Weight.' };
  return { grossWeight, tareWeight, netWeight };
};

// Ensure purchase deductions table and transport/vehicle columns exist for ERP purchase structure
const initializedCompanyDbs = new Set();
const ensurePurchaseDeductions = async (companyId = 1) => {
  const cId = parseInt(companyId, 10) || 1;
  if (initializedCompanyDbs.has(cId)) return;
  try {
    const compDb = db.forCompany ? db.forCompany(cId) : db;
    await compDb.run(`
      CREATE TABLE IF NOT EXISTS purchase_deductions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_id INTEGER,
        deduction_purchase_id INTEGER,
        deduction_name TEXT,
        type TEXT,
        calc_type TEXT,
        value REAL DEFAULT 0,
        amount REAL DEFAULT 0,
        affect_cost_of_goods TEXT,
        debit_side_adjust TEXT,
        account_head_id INTEGER,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure vehicle and transporter columns exist in purchases
    const extraCols = [
      'ALTER TABLE purchases ADD COLUMN transporter TEXT',
      'ALTER TABLE purchases ADD COLUMN transport TEXT',
      'ALTER TABLE purchases ADD COLUMN vehicle_no TEXT',
      'ALTER TABLE purchases ADD COLUMN lorry_no TEXT',
      'ALTER TABLE purchases ADD COLUMN driver_name TEXT',
      'ALTER TABLE purchases ADD COLUMN driver TEXT',
      'ALTER TABLE purchases ADD COLUMN gross_weight REAL DEFAULT 0',
      'ALTER TABLE purchases ADD COLUMN tare_weight REAL DEFAULT 0',
      'ALTER TABLE purchases ADD COLUMN net_weight REAL DEFAULT 0',
      'ALTER TABLE purchases ADD COLUMN stock_type TEXT',
      'ALTER TABLE purchases ADD COLUMN purchase_order_id INTEGER',
      'ALTER TABLE purchases ADD COLUMN po_no TEXT',
      'ALTER TABLE purchases ADD COLUMN source_order_id INTEGER',
      'ALTER TABLE purchases ADD COLUMN source_order_no TEXT',
      'ALTER TABLE purchases ADD COLUMN tax_percent REAL DEFAULT 0',
      'ALTER TABLE purchases ADD COLUMN deduction_amount REAL DEFAULT 0'
    ];
    for (const sql of extraCols) {
      try {
        await compDb.run(sql);
      } catch {
        // column may already exist
      }
    }
    for (const sql of [
      'ALTER TABLE purchase_items ADD COLUMN tax_type TEXT DEFAULT "Taxable"',
      'ALTER TABLE purchase_items ADD COLUMN gst_rate REAL DEFAULT 0',
      'ALTER TABLE purchase_items ADD COLUMN hsn_code TEXT'
    ]) {
      try {
        await compDb.run(sql);
      } catch {
        // column may already exist
      }
    }
    initializedCompanyDbs.add(cId);
  } catch (err) {
    console.error(`Error ensuring purchase_deductions table / columns for company ${cId}:`, err.message);
  }
};

router.use(async (req, res, next) => {
  try {
    const cId = req.headers['x-company-id'] || req.query.company_id || 1;
    await ensurePurchaseDeductions(cId);
    next();
  } catch (err) {
    next();
  }
});

// GET all purchases
router.get('/', async (req, res) => {
  try {
    console.log('Fetching purchases...')
    const result = await db.query(`
      SELECT * FROM purchases ORDER BY created_at DESC
    `)
    console.log('Purchases fetched:', result.rows.length)
    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching purchases:', error.message)
    console.error('Error stack:', error.stack)
    res.status(500).json({ message: 'Error fetching purchases', error: error.message })
  }
})

  // GET next s_no for purchase creation
router.get('/next-sno', async (req, res) => {
  try {
    const result = await db.query('SELECT COALESCE(MAX(s_no),0) + 1 AS next_sno FROM purchases')
    const next_sno = result.rows[0]?.next_sno || 1
    // Required: returns { next_sno: number }
    res.json({ success: true, next_sno, data: { s_no: next_sno } })
  } catch (error) {
    console.error('Error getting next s_no:', error.message)
    res.status(500).json({ success: false, message: 'Error getting next s_no', error: error.message })
  }
})

// GET purchase list for UI (ERP-grade join)
router.get(['/', '/list', '/purchase-list'], async (req, res) => {
  console.log('[debug] USING purchases_fixed.js /purchase-list')
  console.log('[/api/purchases/purchase-list] query running')

  try {
    const sql = `SELECT
      p.id,
      p.s_no AS s_no,
      p.inv_no AS inv_no,
      p.inv_no AS invoice_no,
      COALESCE(NULLIF(p.po_no, ''), NULLIF(p.source_order_no, ''), NULLIF(po.inv_no, ''), NULLIF(CAST(po.s_no AS TEXT), ''), CASE WHEN p.purchase_order_id IS NOT NULL THEN 'PO-' || CAST(p.purchase_order_id AS TEXT) ELSE '' END, '') AS po_no,
      COALESCE(NULLIF(CAST(p.purchase_order_id AS TEXT), ''), NULLIF(CAST(p.source_order_id AS TEXT), ''), CAST(po.id AS TEXT)) AS purchase_order_id,
      p.date AS purchase_date,
      p.date,
      p.date AS invoice_date,
      COALESCE(p.created_at, p.date) AS date_time,
      COALESCE(p.type, 'Standard') AS type,
      COALESCE(NULLIF(p.po_no, ''), NULLIF(p.source_order_no, ''), NULLIF(p.inv_no, ''), '') AS reference,
      COALESCE(s.print_name, s.name, p.supplier, '') AS party,
      COALESCE(s.print_name, s.name, p.supplier, '') AS supplier_name,
      COALESCE(s.address1, p.address, '') AS address,
      COALESCE(p.transporter, p.transport, '') AS transporter,
      COALESCE(p.transport, p.transporter, '') AS transport,
      COALESCE(p.vehicle_no, p.lorry_no, vm.vehicle_no, '') AS vehicle_no,
      COALESCE(p.lorry_no, p.vehicle_no, vm.vehicle_no, '') AS lorry_no,
      COALESCE(p.driver_name, p.driver, vm.driver_name, '') AS driver,
      COALESCE(p.driver_name, p.driver, vm.driver_name, '') AS driver_name,
      COALESCE(CAST(vm.gate_in_time AS TEXT), CAST(vm.created_at AS TEXT), 'Done') AS gate_in,
      COALESCE(p.godown, '') AS godown,

      COALESCE(im.item_name, pi.item_name, '') AS item,
      COALESCE(im.item_name, pi.item_name, '') AS item_name,
      pi.lot_no,

      pi.qty,
      pi.qty AS bag_qty,
      pi.per_unit_weight AS weight,
      pi.per_unit_weight AS bag_weight,
      pi.per_unit_weight,
      pi.total_weight,
      pi.total_weight AS total_wt,
      pi.rate,
      (pi.qty * pi.rate) AS base_amount,
      pi.disc_percent AS disc_percent,
      pi.disc_percent AS discount_percent,
      pi.disc_amount AS disc_amount,
      pi.disc_amount AS discount_amount,
      pi.tax_percent,
      pi.tax_type,
      COALESCE(pi.gst_rate, pi.tax_percent, 0) AS gst_rate,
      pi.tax_amount,
      pi.tax_amount AS tax_amount,
      pi.amount,
      COALESCE(NULLIF(p.gross_weight, 0), NULLIF(vm.gross_weight, 0)) AS gross_weight,
      COALESCE(NULLIF(p.tare_weight, 0), NULLIF(vm.tare_weight, 0)) AS tare_weight,
      COALESCE(NULLIF(p.net_weight, 0), NULLIF(vm.net_weight, 0)) AS net_weight,

      -- Deductions are stored in purchase_deductions table
      COALESCE(pad.add_deduction_amount, 0) AS add_deduction_amount,
      COALESCE(pad.less_deduction_amount, 0) AS less_deduction_amount,

      -- Canonical amounts
      pi.amount AS net_amount,
      p.grand_total AS grand_total,
      qci.id AS qc_id
    FROM purchases p
    LEFT JOIN purchase_orders po ON (CAST(po.id AS TEXT) = CAST(p.purchase_order_id AS TEXT) OR CAST(po.id AS TEXT) = CAST(p.source_order_id AS TEXT) OR (p.po_no IS NOT NULL AND CAST(p.po_no AS TEXT) != '' AND (po.inv_no = p.po_no OR CAST(po.s_no AS TEXT) = CAST(p.po_no AS TEXT))))
    LEFT JOIN supplier_master s ON (CAST(s.id AS TEXT) = CAST(p.supplier AS TEXT) OR s.name = CAST(p.supplier AS TEXT) OR s.print_name = CAST(p.supplier AS TEXT))
    LEFT JOIN purchase_items pi ON CAST(pi.purchase_id AS TEXT) = CAST(p.id AS TEXT)
    LEFT JOIN item_master im ON (CAST(im.id AS TEXT) = CAST(pi.item_id AS TEXT) OR im.item_name = CAST(pi.item_name AS TEXT))
    LEFT JOIN vehicle_movements vm ON (CAST(vm.reference_id AS TEXT) = CAST(p.id AS TEXT) OR CAST(vm.reference_id AS TEXT) = CAST(p.inv_no AS TEXT) OR (vm.lot_no IS NOT NULL AND CAST(vm.lot_no AS TEXT) != '' AND CAST(vm.lot_no AS TEXT) = CAST(pi.lot_no AS TEXT)))
    LEFT JOIN (
      SELECT 
        purchase_id,
        SUM(CASE WHEN UPPER(COALESCE(type, 'LESS')) = 'ADD' THEN amount ELSE 0 END) AS add_deduction_amount,
        SUM(CASE WHEN UPPER(COALESCE(type, 'LESS')) = 'LESS' THEN amount ELSE 0 END) AS less_deduction_amount
      FROM purchase_deductions
      GROUP BY purchase_id
    ) pad ON CAST(pad.purchase_id AS TEXT) = CAST(p.id AS TEXT)
    LEFT JOIN qc_inspections qci ON (CAST(qci.purchase_id AS TEXT) = CAST(p.id AS TEXT) OR ('PUR-' || CAST(p.id AS TEXT)) = CAST(qci.purchase_id AS TEXT) OR ('PUR-' || CAST(p.s_no AS TEXT)) = CAST(qci.purchase_id AS TEXT)) AND CAST(qci.rm_lot_no AS TEXT) = CAST(pi.lot_no AS TEXT)
    ORDER BY p.date DESC, p.id DESC`

    const rows = await db.query(sql)
    res.json(rows.rows)
  } catch (error) {
    console.error('Error fetching purchase list:', error.message)
    res.status(500).json({ message: 'Error fetching purchase list', error: error.message })
  }
})

// GET purchase by ID
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || id === 'undefined' || id === 'null' || isNaN(Number(id))) {
      return res.status(404).json({ message: 'Purchase not found' });
    }
    const purchaseResult = await db.query('SELECT * FROM purchases WHERE id = ?', [id])
    if (purchaseResult.rows.length === 0) {
      return res.status(404).json({ message: 'Purchase not found' })
    }

    const purchaseData = purchaseResult.rows[0]

    const itemsResult = await db.query('SELECT * FROM purchase_items WHERE purchase_id = ?', [req.params.id])
    let deductionsResult = []
    try {
      const d = await db.query('SELECT * FROM purchase_deductions WHERE purchase_id = ?', [req.params.id])
      deductionsResult = d.rows.map((row) => ({
        ...row,
        deduction_id: row.deduction_purchase_id || row.deduction_id,
        calculation_type: row.calc_type || row.calculation_type,
      }))
    } catch {
      deductionsResult = []
    }

    // Supplier / Godown display names
    // Schema columns in schema.sql:
    // - supplier_master: name
    // - godown_master: godown_name
    // Keep tolerant fallbacks for older migrations.

    console.log('PURCHASE EDIT ID =', req.params.id)

    let supplierRow = null
    if (purchaseData.supplier) {
      // ALWAYS select only columns known by your runtime schema migrations.
      // Some DBs may still be legacy and throw `no such column: name`.
      supplierRow = (await db.query(
        `SELECT name, print_name, address1, address2, address3, address4, gst_number,
                contact_person, phone_off, phone_res, mobile1, mobile2, email
         FROM supplier_master
         WHERE CAST(id AS TEXT) = ? OR name = ? OR print_name = ?
         LIMIT 1`,
        [String(purchaseData.supplier), purchaseData.supplier, purchaseData.supplier]
      )).rows[0] || null
    }

    console.log('HEADER QUERY RESULT (supplier) =', supplierRow)

    const supplierName = purchaseData.supplier
      ? (supplierRow?.print_name || supplierRow?.name || purchaseData.supplier)
      : purchaseData.supplier

    const rawTransporter = purchaseData.transporter || purchaseData.transport || ''
    let transporterRow = null
    if (rawTransporter) {
      transporterRow = (await db.query(
        `SELECT name, print_name FROM transport_master
         WHERE CAST(id AS TEXT) = ? OR name = ? OR print_name = ?
         LIMIT 1`,
        [String(rawTransporter), rawTransporter, rawTransporter]
      )).rows[0] || null
    }

    let godownRow = null
    if (purchaseData.godown) {
      godownRow = (await db.query(
        `SELECT godown_name, print_name, address, area FROM godown_master WHERE CAST(id AS TEXT) = ? OR godown_name = ? OR print_name = ? LIMIT 1`,
        [String(purchaseData.godown), String(purchaseData.godown), String(purchaseData.godown)]
      )).rows[0]
    }

    console.log('HEADER QUERY RESULT (godown) =', godownRow)

    const godownName = purchaseData.godown
      ? (godownRow?.godown_name ?? godownRow?.print_name ?? purchaseData.godown)
      : purchaseData.godown




    purchaseData.supplier_name = supplierName
    purchaseData.supplier_address = [
      supplierRow?.address1,
      supplierRow?.address2,
      supplierRow?.address3,
      supplierRow?.address4,
    ].filter(Boolean).join(', ')
    purchaseData.supplier_gstin = purchaseData.gst_no || supplierRow?.gst_number || ''
    purchaseData.supplier_contact_person = purchaseData.contact_person || supplierRow?.contact_person || ''
    purchaseData.supplier_phone = purchaseData.phone || supplierRow?.mobile1 || supplierRow?.phone_off || supplierRow?.phone_res || supplierRow?.mobile2 || ''
    purchaseData.supplier_email = purchaseData.email || supplierRow?.email || ''
    purchaseData.stock_type = purchaseData.stock_type || purchaseData.stockType || 'RM'
    purchaseData.transporter_name = transporterRow?.print_name || transporterRow?.name || rawTransporter
    purchaseData.godown_name = godownName
    purchaseData.transporter = purchaseData.transporter || purchaseData.transport || ''
    purchaseData.transport = purchaseData.transport || purchaseData.transporter || ''
    purchaseData.vehicle_no = purchaseData.vehicle_no || purchaseData.lorry_no || ''
    purchaseData.lorry_no = purchaseData.lorry_no || purchaseData.vehicle_no || ''
    purchaseData.driver_name = purchaseData.driver_name || purchaseData.driver || ''
    purchaseData.driver = purchaseData.driver || purchaseData.driver_name || ''

    res.json({
      ...purchaseData,
      items: itemsResult.rows,
      deductions: deductionsResult
    })
  } catch (error) {
    console.error('Error fetching purchase:', error)
    res.status(500).json({ message: 'Error fetching purchase', error: error.message })
  }
})

// POST create new purchase
router.post('/', async (req, res) => {
  try {
    const { formData, items, totals, deductions } = req.body

    if (!formData.date || !formData.supplier || !items || items.length === 0) {
      return res.status(400).json({ message: 'Date, supplier, and at least one item are required' })
    }

    const invalidItem = items.find((item) => {
      const name = item.item_name;
      const qty = Number(item.qty ?? item.quantity);
      const rate = Number(item.rate ?? item.price);
      return !name || qty <= 0 || rate <= 0;
    });

    if (invalidItem) {
      return res.status(400).json({
        message: "All items must have a name, positive quantity, and positive rate",
      });
    }
    const purchaseWeights = getPurchaseWeights(formData);
    if (purchaseWeights.error) {
      return res.status(400).json({ success: false, message: purchaseWeights.error });
    }

    const purchase_order_id = formData.purchase_order_id || formData.purchaseOrderId || formData.po_id || formData.source_order_id || null;
    const po_no = formData.po_no || formData.poNo || formData.source_order_no || null;
    const transporter = formData.transporter || formData.transport || '';
    const vehicle_no = formData.vehicle_no || formData.lorry_no || '';
    const driver_name = formData.driver_name || formData.driver || '';

    let finalSno = parseInt(formData.sno || formData.s_no, 10);
    if (!finalSno || isNaN(finalSno)) {
      try {
        const snoRes = await db.query('SELECT COALESCE(MAX(s_no), 0) + 1 AS next_sno FROM purchases');
        finalSno = parseInt(snoRes.rows[0]?.next_sno, 10) || 1;
      } catch (e) {
        finalSno = 1;
      }
    }

    let finalInvNo = (formData.invNo || formData.inv_no || '').trim();
    if (!finalInvNo) {
      finalInvNo = `PUR-${finalSno}`;
    }
    try {
      const invCheck = await db.query('SELECT id FROM purchases WHERE inv_no = ? LIMIT 1', [finalInvNo]);
      if (invCheck.rows && invCheck.rows.length > 0) {
        finalInvNo = `${finalInvNo}-${Date.now().toString().slice(-4)}`;
      }
    } catch (e) {}

    let resolvedGodownId = null;
    let resolvedGodownName = '';
    const rawGodown = formData.godown_id || formData.godownId || formData.godown_name || formData.godown || null;

    if (rawGodown !== null && rawGodown !== undefined && rawGodown !== '') {
      const rawStr = String(rawGodown).trim();
      if (/^\d+$/.test(rawStr)) {
        resolvedGodownId = parseInt(rawStr, 10);
      } else {
        resolvedGodownName = rawStr;
      }
    }
    if (!resolvedGodownName && formData.godown && !/^\d+$/.test(String(formData.godown))) {
      resolvedGodownName = String(formData.godown).trim();
    }

    try {
      if (resolvedGodownId) {
        const gRes = await db.query('SELECT godown_name FROM godown_master WHERE CAST(id AS TEXT) = ?', [String(resolvedGodownId)]);
        if (gRes.rows && gRes.rows[0]) resolvedGodownName = gRes.rows[0].godown_name;
      } else if (resolvedGodownName) {
        const gRes = await db.query('SELECT id, godown_name FROM godown_master WHERE LOWER(TRIM(godown_name)) = LOWER(TRIM(?))', [resolvedGodownName]);
        if (gRes.rows && gRes.rows[0]) {
          resolvedGodownId = gRes.rows[0].id;
          resolvedGodownName = gRes.rows[0].godown_name;
        }
      }
    } catch (e) {}

    if (!resolvedGodownName) {
      try {
        const defaultG = await db.query('SELECT id, godown_name FROM godown_master ORDER BY id ASC LIMIT 1');
        if (defaultG.rows && defaultG.rows[0]) {
          resolvedGodownId = defaultG.rows[0].id;
          resolvedGodownName = defaultG.rows[0].godown_name;
        }
      } catch (e) {}
    }
    if (!resolvedGodownName) {
      resolvedGodownName = 'Main Godown';
      resolvedGodownId = 1;
    }

    const insertValues = [
      finalSno,
      formData.date || new Date().toISOString().slice(0, 10),
      finalInvNo,
      formData.supplier || '',
      formData.payType || formData.pay_type || 'Credit',
      formData.invDate || formData.inv_date || null,
      formData.type || 'Urad',
      formData.stock_type || formData.stockType || 'RM',
      formData.contact_person || '',
      formData.address || '',
      formData.area || '',
      formData.phone || '',
      formData.gst_no || '',
      formData.email || '',
      formData.taxType || formData.tax_type || 'Exclusive',
      formData.tax_percent || 0,
      resolvedGodownName,
      formData.remarks || '',
      transporter,
      transporter,
      vehicle_no,
      vehicle_no,
      driver_name,
      driver_name,
      parseFloat(totals.totalQty) || 0,
      parseFloat(totals.totalWeight) || 0,
      parseFloat(totals.totalAmount) || 0,
      parseFloat(totals.baseAmount) || 0,
      parseFloat(totals.discAmount) || 0,
      parseFloat(totals.taxAmount) || 0,
      parseFloat(totals.netAmount) || 0,
      parseFloat(totals.deductionAmount || totals.deduction_amount) || 0,
      parseFloat(totals.grandTotal) || 0,
      purchaseWeights.grossWeight,
      purchaseWeights.tareWeight,
      purchaseWeights.netWeight,
      purchase_order_id,
      po_no,
      purchase_order_id,
      po_no
    ]

    const purchaseResult = await db.run(`
      INSERT INTO purchases (
        s_no, date, inv_no, supplier, pay_type, inv_date, type, stock_type, contact_person, address, area, phone, gst_no, email, tax_type, tax_percent, godown, remarks,
        transporter, transport, vehicle_no, lorry_no, driver_name, driver,
        total_qty, total_weight, total_amount, base_amount, disc_amount, tax_amount, net_amount, deduction_amount, grand_total,
        gross_weight, tare_weight, net_weight,
        purchase_order_id, po_no, source_order_id, source_order_no
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, insertValues)

    const purchaseId = purchaseResult.lastID

    // If linked to a Purchase Order, update the PO status to 'Received'
    if (purchase_order_id) {
      try {
        await db.run(`
          UPDATE purchase_orders
          SET status = 'Received', inward_purchase_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [purchaseId, purchase_order_id]);
      } catch (err) {
        console.error('Error updating purchase order status on inward:', err);
      }
    }

    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);

    for (const item of items) {
      const normalizedItem = normalizePurchaseItem(item)
      const qty = normalizedItem.qty
      const rate = normalizedItem.rate
      const discPercent = normalizedItem.disc_percent
      const taxPercent = normalizedItem.tax_percent
      const perUnitWeight = normalizedItem.per_unit_weight
      const totalWt = Number((normalizedItem.total_weight || (qty * perUnitWeight)).toFixed(3));

      const lineTax = calculateLineTax({
        qty,
        rate,
        discPercent,
        discAmount: normalizedItem.disc_amount,
        taxType: normalizedItem.tax_type || (taxPercent === 0 ? 'Nil Rated' : 'Taxable'),
        taxMode: formData.tax_mode || formData.taxType || formData.tax_type || 'Exclusive',
        gstRate: taxPercent,
        hsnCode: normalizedItem.hsn_code
      });
      const baseAmount = lineTax.grossAmount;
      const discountAmount = lineTax.discAmount;
      const taxAmount = lineTax.totalTax;
      const amount = lineTax.totalAmount;
      const netAmount = amount;

      let lotNo = normalizedItem.lot_no
      if (!lotNo || lotNo === '') {
        lotNo = await reserveNextLotNumber(activeCompanyId);
      } else {
        await recordLotNumber(lotNo, activeCompanyId);
      }

      await db.run(`
        INSERT INTO purchase_items (
          purchase_id, item_id, item_name, lot_no, per_unit_weight, qty, total_weight, rate,
          disc_percent, disc_amount, tax_percent, gst_rate, tax_type, hsn_code, tax_amount, amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        purchaseId,
        normalizedItem.item_id,
        normalizedItem.item_name,
        lotNo,
        perUnitWeight,
        qty,
        totalWt,
        rate,
        discPercent,
        discountAmount,
        lineTax.gstRate,
        lineTax.gstRate,
        lineTax.taxType,
        lineTax.hsnCode,
        taxAmount,
        amount
      ])

      let itemId = normalizedItem.item_id
      if (isNaN(parseInt(itemId))) {
        try {
          const itemResult = await db.query('SELECT id FROM item_master WHERE item_name = ?', [normalizedItem.item_name])
          if (itemResult.rows.length > 0) itemId = itemResult.rows[0].id
        } catch {
          // ignore
        }
      }

      await db.run(`
        INSERT INTO stock_lots (item_id, item_name, lot_no, purchase_id, quantity, remaining_quantity, rate, qc_status, unloading_status, godown_id, godown_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'QC_PENDING', 'PENDING_DECISION', ?, ?)
      `, [itemId, normalizedItem.item_name, lotNo, purchaseId, qty, qty, rate, resolvedGodownId, resolvedGodownName])

      await db.run(`
        INSERT INTO stock (item_id, item_name, lot_no, qty, weight, rate, amount, date, type, reference_id, godown, godown_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Purchase', ?, ?, ?)
      `, [itemId, normalizedItem.item_name, lotNo, qty, totalWt, rate, amount, formData.date, purchaseId, resolvedGodownName || 'Main Godown', resolvedGodownId || 1])
    }

    // Check if the target godown is Cold Storage and automatically create/update linked Cold Storage IN voucher & items
    // ------------------------------------------------------------------------
    // UNIVERSAL OPERATIONAL CHARGE RECORDING (LOADMAN / UNLOADING)
    // ------------------------------------------------------------------------
    const workerName = formData.loadman_name || formData.worker_name || null;
    if (workerName) {
      try {
        const handledKg = parseFloat(totals.totalWeight) || (parseFloat(totals.totalQty) * 50) || 0;
        const loadmanRate = parseFloat(formData.loadman_rate_per_kg ?? formData.unloading_rate ?? 0.50);
        const addlLabourCharges = parseFloat(formData.additional_labour_charges || formData.additional_charges || 0);
        
        await OpChargeEngine.recordOperationalCharge({
          companyId: activeCompanyId,
          sourceModule: 'PURCHASE',
          sourceTransactionId: purchaseId,
          sourceTransactionNo: finalInvNo,
          date: formData.date || new Date().toISOString().split('T')[0],
          operationType: 'UNLOADING',
          chargeCategory: 'LABOUR',
          partyId: formData.loadman_worker_id || null,
          partyName: workerName,
          rateBasis: 'PER_KG',
          ratePerUnit: loadmanRate,
          quantity: handledKg,
          uom: 'KG',
          adjustmentAmount: addlLabourCharges,
          vehicleNo: vehicle_no,
          driverName: driver_name,
          notes: `Auto-recorded from Purchase #${finalInvNo}`,
          createdBy: req.user?.username || 'System'
        });
        console.log(`✅ [OpCharge] Successfully recorded loadman charges for Purchase #${finalInvNo}`);
      } catch (opErr) {
        console.warn('⚠️ [OpCharge] Error recording loadman charges:', opErr.message);
      }
    }

    // Check if the target godown is Cold Storage and automatically create/update linked Cold Storage IN voucher & items
    const isColdStorage = (resolvedGodownName || '').toLowerCase().includes('cold') || String(resolvedGodownId) === '2';
    if (isColdStorage) {
      try {
        const csGodownId = resolvedGodownId || 2;
        const csGodownName = resolvedGodownName || 'BTS Cold Storage';
        await ensureColdStorageSchema(activeCompanyId);
        const tariff = await getColdStorageTariff(csGodownId, activeCompanyId);

        // Calculate Loadman / Unloading charges based on actual kilograms handled
        const handledKg = parseFloat(totals.totalWeight) || (parseFloat(totals.totalQty) * 50) || 0;
        const effectiveWorkerName = workerName || formData.driver_name || 'Inward Loadman Team';
        const loadmanRate = parseFloat(formData.loadman_rate_per_kg ?? formData.unloading_rate ?? tariff.inwardUnloadingRate ?? 0.50);
        const addlLabourCharges = parseFloat(formData.additional_labour_charges || formData.additional_charges || 0);

        const labourCalc = calculateLabourCharge({
          qtyKg: handledKg,
          ratePerKg: loadmanRate,
          additionalCharges: addlLabourCharges
        });
        const loadmanCharges = labourCalc.totalCharge;

        // Idempotency: Check if a CSI voucher already exists for this purchase
        const existingCsi = await db.query(
          `SELECT id, voucher_no FROM cold_storage_vouchers WHERE purchase_id = ? OR remarks LIKE ? LIMIT 1`,
          [purchaseId, `%Purchase #${formData.invNo || formData.inv_no || purchaseId}%`],
          activeCompanyId
        );

        let csVoucherId = null;
        let voucherNo = '';

        if (existingCsi.rows && existingCsi.rows.length > 0) {
          // Update existing voucher
          csVoucherId = existingCsi.rows[0].id;
          voucherNo = existingCsi.rows[0].voucher_no;

          await db.run(`
            UPDATE cold_storage_vouchers SET
              voucher_date = ?,
              cold_storage_id = ?,
              cold_storage_name = ?,
              remarks = ?,
              total_qty = ?,
              total_wt = ?,
              purchase_id = ?,
              purchase_inv_no = ?,
              supplier_id = ?,
              supplier_name = ?,
              vehicle_no = ?,
              driver_name = ?,
              transporter_name = ?,
              loadman_name = ?,
              loadman_qty_kg = ?,
              loadman_rate_per_kg = ?,
              loadman_charges = ?,
              additional_charges = ?,
              charge_snapshot_json = ?,
              status = 'Confirmed',
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [
            formData.date || new Date().toISOString().slice(0, 10),
            csGodownId,
            csGodownName,
            `Auto-inward from Purchase #${formData.invNo || formData.inv_no || purchaseId}`,
            parseFloat(totals.totalQty) || 0,
            handledKg,
            purchaseId,
            formData.invNo || formData.inv_no || '',
            formData.supplier || null,
            formData.supplier_name || '',
            vehicle_no || '',
            driver_name || '',
            transporter || '',
            effectiveWorkerName,
            handledKg,
            loadmanRate,
            loadmanCharges,
            addlLabourCharges,
            JSON.stringify(tariff),
            csVoucherId
          ], activeCompanyId);

          // Clear previous items to prevent duplicate line items
          await db.run(`DELETE FROM cold_storage_items WHERE voucher_id = ?`, [csVoucherId], activeCompanyId);
        } else {
          // Generate new CSI voucher number
          let nextVoucherNo = 'CSI-000001';
          try {
            const csVRes = await db.query(`SELECT voucher_no FROM cold_storage_vouchers WHERE voucher_type = 'IN' ORDER BY id DESC LIMIT 1`, [], activeCompanyId);
            if (csVRes.rows && csVRes.rows.length > 0) {
              const num = parseInt(String(csVRes.rows[0].voucher_no || '').replace(/\D/g, ''), 10);
              if (!isNaN(num)) {
                nextVoucherNo = `CSI-${String(num + 1).padStart(6, '0')}`;
              }
            }
          } catch (_) {}
          voucherNo = nextVoucherNo;

          const csVoucherRes = await db.run(`
            INSERT INTO cold_storage_vouchers 
            (voucher_no, voucher_type, voucher_date, cold_storage_id, cold_storage_name, source_godown_id, source_godown_name, remarks, total_qty, total_wt, created_by,
             purchase_id, purchase_inv_no, supplier_id, supplier_name, vehicle_no, driver_name, transporter_name,
             loadman_name, loadman_qty_kg, loadman_rate_per_kg, loadman_charges, additional_charges, charge_snapshot_json, status)
            VALUES (?, 'IN', ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Confirmed')
          `, [
            voucherNo,
            formData.date || new Date().toISOString().slice(0, 10),
            csGodownId,
            csGodownName,
            `Auto-inward from Purchase #${formData.invNo || formData.inv_no || purchaseId}`,
            parseFloat(totals.totalQty) || 0,
            handledKg,
            formData.createdBy || 'System / Purchase Auto-Inward',
            purchaseId,
            formData.invNo || formData.inv_no || '',
            formData.supplier || null,
            formData.supplier_name || '',
            vehicle_no || '',
            driver_name || '',
            transporter || '',
            effectiveWorkerName,
            handledKg,
            loadmanRate,
            loadmanCharges,
            addlLabourCharges,
            JSON.stringify(tariff)
          ], activeCompanyId);

          csVoucherId = csVoucherRes.lastID || csVoucherRes.lastInsertRowid;
        }

        // Insert linked items
        const pItemsRes = await db.query(`SELECT * FROM purchase_items WHERE purchase_id = ?`, [purchaseId], activeCompanyId);
        const totalPurchasedQty = (pItemsRes.rows || []).reduce((sum, it) => sum + (parseFloat(it.qty) || 0), 0) || 1;

        for (const pIt of (pItemsRes.rows || [])) {
          const pLot = pIt.lot_no || 'LOT-GEN';
          const csLot = (pLot && pLot.startsWith('CS-')) ? pLot : `CS-${pLot}`;
          const qty = parseFloat(pIt.qty) || 0;
          const wt = parseFloat(pIt.per_unit_weight) || 50;
          const totWt = parseFloat(pIt.total_weight) || (qty * wt);
          const lineLabourShare = Number(((qty / totalPurchasedQty) * loadmanCharges).toFixed(2));

          await db.run(`
            INSERT INTO cold_storage_items 
            (voucher_id, voucher_no, item_id, item_name, purchase_lot_no, cold_storage_lot_no, quantity, weight, total_wt, unit, remarks,
             purchase_id, purchase_item_id, inward_date, remaining_quantity, remaining_weight, labour_charge)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            csVoucherId,
            voucherNo,
            pIt.item_id || null,
            pIt.item_name,
            pLot,
            csLot,
            qty,
            wt,
            totWt,
            'KG',
            `Auto from Purchase #${formData.invNo || formData.inv_no || purchaseId}`,
            purchaseId,
            pIt.id || null,
            formData.date || new Date().toISOString().slice(0, 10),
            qty,
            totWt,
            lineLabourShare
          ], activeCompanyId);
        }

        // Automatically generate linked Cold Storage Inward Bill with all loadman, driver, vehicle, and payment calculations
        try {
          const billItems = (pItemsRes.rows || []).map(it => {
            const itQty = parseFloat(it.qty) || 0;
            const itWt = parseFloat(it.per_unit_weight) || 50;
            const itTotWt = parseFloat(it.total_weight) || (itQty * itWt);
            const lineLabour = Number(((itQty / totalPurchasedQty) * loadmanCharges).toFixed(2));
            return {
              item_name: it.item_name,
              purchase_lot_no: it.lot_no,
              cold_storage_lot_no: (it.lot_no && it.lot_no.startsWith('CS-')) ? it.lot_no : `CS-${it.lot_no}`,
              quantity: itQty,
              weight: itWt,
              total_wt: itTotWt,
              billable_units: itQty,
              storage_days: 0,
              storage_charges: 0,
              handling_charges: lineLabour,
              total_charges: lineLabour,
              vehicle_no: vehicle_no || '',
              driver_name: driver_name || '',
              transporter_name: transporter || '',
              loadman_name: workerName
            };
          });

          const billRes = await createOrUpdateColdStorageBill({
            billType: 'INWARD',
            voucherId: csVoucherId,
            voucherNo: voucherNo,
            voucherDate: formData.date || new Date().toISOString().slice(0, 10),
            coldStorageId: csGodownId,
            coldStorageName: csGodownName,
            operatorId: tariff.operatorId,
            operatorName: tariff.operatorName,
            purchaseId: purchaseId,
            purchaseInvNo: formData.invNo || formData.inv_no || '',
            vehicleNo: vehicle_no || '',
            driverName: driver_name || '',
            driverPhone: formData.driver_phone || '',
            transporterName: transporter || '',
            loadmanName: workerName,
            loadmanQtyKg: handledKg,
            loadmanRatePerKg: loadmanRate,
            loadmanCharges: loadmanCharges,
            storageDays: 0,
            totalQty: parseFloat(totals.totalQty) || 0,
            totalWeight: handledKg,
            storageCharges: 0,
            handlingCharges: loadmanCharges,
            insuranceCharges: 0,
            mamoolCharges: 0,
            otherCharges: addlLabourCharges,
            taxRate: tariff.gstRate || 18,
            operatorInvoiceNo: formData.invNo || formData.inv_no || '',
            operatorInvoiceDate: formData.date || new Date().toISOString().slice(0, 10),
            items: billItems,
            remarks: `Inward Bill for Purchase #${formData.invNo || formData.inv_no || purchaseId} | Godown: ${csGodownName} | Handled: ${handledKg} kg | Loadman: ${workerName} (₹${loadmanCharges}) | Vehicle: ${vehicle_no || 'N/A'}`,
            createdBy: formData.createdBy || 'System / Purchase Auto-Inward',
            companyId: activeCompanyId
          });

          console.log(`✅ [ColdStorage] Successfully created linked Inward Bill ${billRes.billNo} (₹${billRes.grandTotal}) for Purchase #${purchaseId}`);
        } catch (bErr) {
          console.warn('[ColdStorage] Inward bill creation notice:', bErr.message);
        }

        console.log(`✅ [ColdStorage] Successfully created linked CSI Voucher ${voucherNo} for Purchase #${purchaseId} with Loadman Unloading Charges: ₹${loadmanCharges}`);
      } catch (csErr) {
        console.warn('Error creating auto-inward cold storage voucher on purchase:', csErr.message);
      }
    }

    if (vehicle_no) {
      try {
        await db.run(`
          INSERT INTO vehicle_movements (
            reference_type, reference_id, movement_type, operation_type, vehicle_no, driver_name,
            gate_in_time, status, item_name, qty, weight, party_name, lot_no, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'IN', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
          'Purchase',
          purchaseId,
          'INWARD',
          'Purchase Inward',
          vehicle_no,
          driver_name || '',
          items[0]?.item_name || '',
          parseFloat(totals.totalQty) || 0,
          parseFloat(totals.totalWeight) || 0,
          formData.supplier || '',
          items[0]?.lot_no || ''
        ]);
      } catch (vmErr) {
        console.error('Error inserting vehicle movement for purchase:', vmErr);
      }
    }

    for (const ded of (deductions || [])) {
      await db.run(`
        INSERT INTO purchase_deductions (
          purchase_id, deduction_purchase_id, deduction_name, type, calc_type, value, amount, affect_cost_of_goods, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        purchaseId,
        ded.deduction_id || ded.deduction_purchase_id,
        ded.deduction_name,
        ded.type || ded.type?.toUpperCase() || 'LESS',
        ded.calculation_type || ded.calc_type || 'Fixed',
        ded.percentage || ded.value || 0,
        ded.amount || 0,
        ded.affect_cost_of_goods || 'No',
        ded.remarks || ''
      ])
    }

    try {
      const purTaxVal = parseFloat(totals.taxAmount) || 0;
      const isInterstatePur = String(formData.taxType || formData.tax_type || '').toLowerCase().includes('inter');
      const cgstPur = parseFloat(totals.cgstAmount || totals.cgst_amount) || (isInterstatePur ? 0 : Number((purTaxVal / 2).toFixed(2)));
      const sgstPur = parseFloat(totals.sgstAmount || totals.sgst_amount) || (isInterstatePur ? 0 : Number((purTaxVal - cgstPur).toFixed(2)));
      const igstPur = parseFloat(totals.igstAmount || totals.igst_amount) || (isInterstatePur ? purTaxVal : 0);

      await createPurchaseLedgerEntries({
        supplier: formData.supplier,
        date: formData.date,
        invNo: formData.invNo || '',
        purchaseId,
        baseAmount: parseFloat(totals.baseAmount) || 0,
        taxAmount: purTaxVal,
        cgstAmount: cgstPur,
        sgstAmount: sgstPur,
        igstAmount: igstPur,
        discAmount: parseFloat(totals.discAmount) || 0,
        netAmount: parseFloat(totals.grandTotal) || 0,
        deductions: deductions || [],
        loadmanCharges: parseFloat(formData.loadman_charges || formData.unloading_charges || 0),
        loadmanName: workerName,
        loadmanWorkerId: formData.loadman_worker_id || null
      })
    } catch (ledgerError) {
      console.error('Error creating ledger entries:', ledgerError)
    }

    // Trigger Central Notification & WhatsApp/SMS Alert
    try {
      const { triggerTransactionNotification } = require('../utils/transactionNotifier');
      const itemDesc = items && items.length > 0 ? items.map(i => `${i.qty || 0} ${i.item_name || 'Bags'}`).slice(0, 3).join(', ') : 'Raw Material';
      const purNo = formData.invNo || `PUR-${purchaseId}`;
      await triggerTransactionNotification({
        moduleName: 'PURCHASE',
        referenceNo: purNo,
        referenceId: purchaseId,
        companyId: activeCompanyId,
        title: `🟢 PURCHASE CREATED – ${purNo}`,
        message: `Supplier: ${formData.supplier || 'Vendor'} | Invoice: ${formData.invNo || purNo} | Items: ${itemDesc} | Total: ${totals.totalQty || 0} Bags (${totals.totalWeight || 0} KG) | Vehicle: ${vehicle_no || 'N/A'} | Status: Awaiting QC`,
        severity: 'INFO',
        details: {
          purchase_no: purNo,
          date: formData.date,
          supplier: formData.supplier,
          invoice_no: formData.invNo || purNo,
          item_summary: itemDesc,
          quantity: `${totals.totalWeight || 0} KG`,
          bags: totals.totalQty || 0,
          vehicle: vehicle_no || 'N/A',
          godown: resolvedGodownName || 'Main Godown',
          qc_status: 'PENDING',
          iqr_status: 'PENDING',
          created_by: req.user?.username || 'Store Operator',
          status: 'PURCHASE CREATED'
        }
      });
    } catch (notifErr) {
      console.warn('Central Notification Warning for Purchase:', notifErr.message);
    }

    res.status(201).json({ success: true, message: 'Purchase saved successfully!', id: purchaseId })
  } catch (error) {
    console.error('Error saving purchase:', error)
    res.status(500).json({ message: 'Error saving purchase', error: error.message })
  }
})

function sanitizeDate(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (s === '' || s === 'null' || s === 'undefined') return null;
  const ddmmyyyy = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (ddmmyyyy) {
    return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`;
  }
  return s;
}

// PUT update purchase
router.put('/:id', async (req, res) => {
  try {
    const { formData, items, totals, deductions } = req.body
    const purchaseId = req.params.id
    const safeDeductions = Array.isArray(deductions) ? deductions : [];

    const purchase_order_id = formData.purchase_order_id || formData.purchaseOrderId || formData.po_id || formData.source_order_id || null;
    const po_no = formData.po_no || formData.poNo || formData.source_order_no || null;
    const transporter = formData.transporter || formData.transport || '';
    const vehicle_no = formData.vehicle_no || formData.lorry_no || '';
    const driver_name = formData.driver_name || formData.driver || '';

    let resolvedGodownId = null;
    let resolvedGodownName = formData.godown || '';
    const rawGodown = formData.godown_id || formData.godownId || formData.godown || null;
    if (rawGodown && /^\d+$/.test(String(rawGodown))) {
      resolvedGodownId = parseInt(rawGodown, 10);
    }
    try {
      if (resolvedGodownId) {
        const gRes = await db.query('SELECT godown_name FROM godown_master WHERE CAST(id AS TEXT) = ?', [String(resolvedGodownId)]);
        if (gRes.rows && gRes.rows[0]) resolvedGodownName = gRes.rows[0].godown_name;
      } else if (resolvedGodownName) {
        const gRes = await db.query('SELECT id, godown_name FROM godown_master WHERE LOWER(godown_name) = LOWER(?)', [resolvedGodownName]);
        if (gRes.rows && gRes.rows[0]) {
          resolvedGodownId = gRes.rows[0].id;
          resolvedGodownName = gRes.rows[0].godown_name;
        }
      }
    } catch (e) {}

    const sanitizedDate = sanitizeDate(formData.date) || new Date().toISOString().slice(0, 10);
    const sanitizedInvDate = sanitizeDate(formData.invDate || formData.inv_date);
    const purchaseWeights = getPurchaseWeights(formData);
    if (purchaseWeights.error) {
      return res.status(400).json({ success: false, message: purchaseWeights.error });
    }

    const updateResult = await db.run(`
      UPDATE purchases SET
        s_no = ?, date = ?, inv_no = ?, supplier = ?, pay_type = ?,
        inv_date = ?, type = ?, stock_type = ?, contact_person = ?, address = ?, area = ?, phone = ?, gst_no = ?, email = ?,
        tax_type = ?, tax_percent = ?, godown = ?,
        remarks = ?, transporter = ?, transport = ?, vehicle_no = ?, lorry_no = ?, driver_name = ?, driver = ?,
        total_qty = ?, total_weight = ?, total_amount = ?,
        base_amount = ?, disc_amount = ?, tax_amount = ?, net_amount = ?,
        deduction_amount = ?, grand_total = ?,
        gross_weight = ?, tare_weight = ?, net_weight = ?,
        purchase_order_id = ?, po_no = ?, source_order_id = ?, source_order_no = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      formData.sno || formData.s_no,
      sanitizedDate,
      formData.invNo || formData.inv_no,
      formData.supplier || formData.supplier_id,
      formData.payType || formData.pay_type,
      sanitizedInvDate,
      formData.type,
      formData.stock_type || formData.stockType || 'RM',
      formData.contact_person,
      formData.address,
      formData.area,
      formData.phone,
      formData.gst_no,
      formData.email,
      formData.taxType || formData.tax_type,
      formData.tax_percent || 0,
      resolvedGodownName || formData.godown || '',
      formData.remarks,
      transporter,
      transporter,
      vehicle_no,
      vehicle_no,
      driver_name,
      driver_name,
      totals.totalQty,
      totals.totalWeight,
      totals.totalAmount,
      totals.baseAmount,
      totals.discAmount,
      totals.taxAmount,
      totals.netAmount,
      totals.deductionAmount || totals.deduction_amount,
      totals.grandTotal,
      purchaseWeights.grossWeight,
      purchaseWeights.tareWeight,
      purchaseWeights.netWeight,
      purchase_order_id,
      po_no,
      purchase_order_id,
      po_no,
      purchaseId
    ])
    if (updateResult?.changes === 0) {
      return res.status(404).json({ success: false, message: 'Purchase not found; no details were updated.' });
    }

    // Preserve existing stock lot statuses before deletion
    const existingLotsResult = await db.query(`
      SELECT lot_no, qc_status, unloading_status, godown_id, usable_for_production, approval_status, approval_date 
      FROM stock_lots 
      WHERE purchase_id = ?
    `, [purchaseId]);
    const preservedStatuses = {};
    for (const lot of existingLotsResult.rows) {
      if (lot.lot_no) {
        preservedStatuses[lot.lot_no.toUpperCase()] = lot;
      }
    }

    await db.run('DELETE FROM stock_lots WHERE purchase_id = ?', [purchaseId])
    await db.run('DELETE FROM stock WHERE reference_id = ? AND type = ?', [purchaseId, 'Purchase'])
    await db.run('DELETE FROM purchase_items WHERE purchase_id = ?', [purchaseId])
    await db.run('DELETE FROM purchase_deductions WHERE purchase_id = ?', [purchaseId])

    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);

    for (const item of items) {
      const normalizedItem = normalizePurchaseItem(item)
      const qty = normalizedItem.qty
      const rate = normalizedItem.rate
      const discPercent = normalizedItem.disc_percent
      const taxPercent = normalizedItem.tax_percent
      const perUnitWeight = normalizedItem.per_unit_weight
      const totalWt = Number((normalizedItem.total_weight || (qty * perUnitWeight)).toFixed(3));

      const lineTax = calculateLineTax({
        qty,
        rate,
        discPercent,
        discAmount: normalizedItem.disc_amount,
        taxType: normalizedItem.tax_type || (taxPercent === 0 ? 'Nil Rated' : 'Taxable'),
        taxMode: formData.tax_mode || formData.taxType || formData.tax_type || 'Exclusive',
        gstRate: taxPercent,
        hsnCode: normalizedItem.hsn_code
      });
      const baseAmount = lineTax.grossAmount;
      const discountAmount = lineTax.discAmount;
      const taxAmount = lineTax.totalTax;
      const amount = lineTax.totalAmount;


      let lotNo = normalizedItem.lot_no
      if (!lotNo || lotNo === '') {
        lotNo = await reserveNextLotNumber(activeCompanyId);
      } else {
        await recordLotNumber(lotNo, activeCompanyId);
      }

      await db.run(`
        INSERT INTO purchase_items (
          purchase_id, item_id, item_name, lot_no, per_unit_weight, qty, total_weight, rate,
          disc_percent, disc_amount, tax_percent, gst_rate, tax_type, hsn_code, tax_amount, amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        purchaseId,
        normalizedItem.item_id,
        normalizedItem.item_name,
        lotNo,
        perUnitWeight,
        qty,
        totalWt,
        rate,
        discPercent,
        discountAmount,
        lineTax.gstRate,
        lineTax.gstRate,
        lineTax.taxType,
        lineTax.hsnCode,
        taxAmount,
        amount
      ])

      let itemId = normalizedItem.item_id
      if (isNaN(parseInt(itemId))) {
        try {
          const itemResult = await db.query('SELECT id FROM item_master WHERE item_name = ?', [normalizedItem.item_name])
          if (itemResult.rows.length > 0) itemId = itemResult.rows[0].id
        } catch {
          // ignore
        }
      }

      await db.run(`
        INSERT INTO stock_lots (item_id, item_name, lot_no, purchase_id, quantity, remaining_quantity, rate, qc_status, unloading_status, godown_id, godown_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'QC_PENDING', 'PENDING_DECISION', ?, ?)
      `, [itemId, normalizedItem.item_name, lotNo, purchaseId, qty, qty, rate, resolvedGodownId, resolvedGodownName])

      // Re-apply preserved status if this lot number already existed
      const key = lotNo.toUpperCase();
      if (preservedStatuses[key]) {
        const p = preservedStatuses[key];
        try {
          await db.run(`
            UPDATE stock_lots SET 
              qc_status = ?, unloading_status = ?, godown_id = ?, 
              usable_for_production = ?, approval_status = ?, approval_date = ?
            WHERE purchase_id = ? AND lot_no = ?
          `, [
            p.qc_status || 'QC_PENDING',
            p.unloading_status || 'PENDING_DECISION',
            p.godown_id || resolvedGodownId,
            p.usable_for_production || 0,
            p.approval_status || 'PENDING_APPROVAL',
            p.approval_date || null,
            purchaseId,
            lotNo
          ]);
        } catch (e) {
          console.error('Error restoring preserved stock lot status:', e.message);
        }
      }

      await db.run(`
        INSERT INTO stock (item_id, item_name, lot_no, qty, weight, rate, amount, date, type, reference_id, godown, godown_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Purchase', ?, ?, ?)
      `, [itemId, normalizedItem.item_name, lotNo, qty, totalWt, rate, amount, sanitizedDate, purchaseId, resolvedGodownName || 'Main Godown', resolvedGodownId || 1])
    }

    for (const ded of safeDeductions) {
      await db.run(`
        INSERT INTO purchase_deductions (
          purchase_id, deduction_purchase_id, deduction_name, type, calc_type, value, amount, affect_cost_of_goods, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        purchaseId,
        ded.deduction_id || ded.deduction_purchase_id,
        ded.deduction_name,
        ded.type || ded.type?.toUpperCase() || 'LESS',
        ded.calculation_type || ded.calc_type || 'Fixed',
        ded.percentage || ded.value || 0,
        ded.amount || 0,
        ded.affect_cost_of_goods || 'No',
        ded.remarks || ''
      ])
    }

    try {
      const purTaxVal = parseFloat(totals?.taxAmount || 0) || 0;
      const isInterstatePur = String(formData.taxType || formData.tax_type || '').toLowerCase().includes('inter');
      const cgstPur = parseFloat(totals?.cgstAmount || totals?.cgst_amount) || (isInterstatePur ? 0 : Number((purTaxVal / 2).toFixed(2)));
      const sgstPur = parseFloat(totals?.sgstAmount || totals?.sgst_amount) || (isInterstatePur ? 0 : Number((purTaxVal - cgstPur).toFixed(2)));
      const igstPur = parseFloat(totals?.igstAmount || totals?.igst_amount) || (isInterstatePur ? purTaxVal : 0);

      await deleteLedgerEntries(purchaseId, 'Purchase')
      await createPurchaseLedgerEntries({
        supplier: formData.supplier,
        date: sanitizedDate,
        invNo: formData.invNo || '',
        purchaseId,
        baseAmount: parseFloat(totals?.baseAmount || totals?.totalAmount || 0) || 0,
        taxAmount: purTaxVal,
        cgstAmount: cgstPur,
        sgstAmount: sgstPur,
        igstAmount: igstPur,
        discAmount: parseFloat(totals?.discAmount || 0) || 0,
        netAmount: parseFloat(totals?.grandTotal || totals?.netAmount || 0) || 0,
        deductions: safeDeductions
      })
    } catch (ledgerError) {
      console.error('Error updating ledger entries for purchase:', ledgerError)
    }

    res.json({ success: true, message: 'Purchase updated successfully!' })
  } catch (error) {
    console.error('Error updating purchase:', error)
    res.status(500).json({ message: 'Error updating purchase', error: error.message })
  }
})

// DELETE purchase
router.delete('/:id', async (req, res) => {
  try {
    const purchaseId = req.params.id

    const lotCheck = await db.query(`
      SELECT * FROM stock_lots
      WHERE purchase_id = ? AND remaining_quantity < quantity
    `, [purchaseId])

    if (lotCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete purchase - stock from this lot has been used in sales or grinding. Please reverse those transactions first.'
      })
    }

    const flourCheck = await db.query(`
      SELECT fo.id, fo.s_no, fo.date, fo.papad_company
      FROM flour_out fo
      JOIN flour_out_items foi ON fo.id = foi.flour_out_id
      JOIN stock_lots sl ON foi.lot_no = sl.lot_no
      WHERE sl.purchase_id = ?
    `, [purchaseId])

    if (flourCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete purchase - lots have been used in Grind (Flour Out) records. Please delete Grind records first. Reference: ${flourCheck.rows[0]?.s_no || 'Multiple'}`
      })
    }

    try {
      const pRes = await db.query('SELECT * FROM purchases WHERE id = ?', [purchaseId]);
      if (pRes.rows && pRes.rows.length > 0) {
        const pRow = pRes.rows[0];
        const itemsRes = await db.query('SELECT * FROM purchase_items WHERE purchase_id = ?', [purchaseId]);
        const dedRes = await db.query('SELECT * FROM purchase_deductions WHERE purchase_id = ?', [purchaseId]);
        const lotsRes = await db.query('SELECT * FROM stock_lots WHERE purchase_id = ?', [purchaseId]);
        const stockRes = await db.query("SELECT * FROM stock WHERE reference_id = ? AND type = 'Purchase'", [purchaseId]);

        await recycleBinService.saveToRecycleBin({
          moduleName: 'Purchase',
          recordId: purchaseId,
          title: `Purchase #${pRow.inv_no || pRow.s_no || purchaseId} - ${pRow.supplier || 'Supplier'}`,
          recordData: {
            tableName: 'purchases',
            record: pRow,
            subRecords: [
              { tableName: 'purchase_items', records: itemsRes.rows || [] },
              { tableName: 'purchase_deductions', records: dedRes.rows || [] },
              { tableName: 'stock_lots', records: lotsRes.rows || [] },
              { tableName: 'stock', records: stockRes.rows || [] }
            ]
          },
          deletedBy: req.user?.username || 'admin'
        });
      }
    } catch (e) {
      console.warn('Recycle bin error in purchases:', e.message);
    }

    await db.run('DELETE FROM stock_lots WHERE purchase_id = ?', [purchaseId])
    await db.run("DELETE FROM stock WHERE reference_id = ? AND type = 'Purchase'", [purchaseId])

    try {
      await deleteLedgerEntries(purchaseId)
    } catch (ledgerError) {
      console.error('Error deleting purchase ledger entries:', ledgerError)
    }

    await db.run('DELETE FROM purchase_deductions WHERE purchase_id = ?', [purchaseId])
    await db.run('DELETE FROM purchase_items WHERE purchase_id = ?', [purchaseId])
    await db.run('DELETE FROM purchases WHERE id = ?', [purchaseId])

    res.json({ success: true, message: 'Purchase deleted successfully' })
  } catch (error) {
    console.error('Error deleting purchase:', error)
    res.status(500).json({ success: false, message: 'Error deleting purchase', error: error.message })
  }
})

module.exports = router
