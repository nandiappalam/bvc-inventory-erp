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
    tax_percent: Number(item.tax_percent ?? item.tax ?? 0) || 0,
    disc_amount: Number(item.disc_amount ?? item.discAmount ?? 0) || 0,
    tax_amount: Number(item.tax_amount ?? item.taxAmount ?? 0) || 0,
    amount: Number(item.amount ?? item.totalAmount ?? item.total ?? 0) || 0,
  }
}

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
      COALESCE(p.purchase_order_id, p.source_order_id, po.id) AS purchase_order_id,
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
      COALESCE(vm.gate_in_time, vm.created_at, 'Done') AS gate_in,
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
      pi.tax_amount,
      pi.tax_amount AS tax_amount,
      pi.amount,

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
        'SELECT print_name, address1 FROM supplier_master WHERE id = ?',
        [purchaseData.supplier]
      )).rows[0] || null
    }

    console.log('HEADER QUERY RESULT (supplier) =', supplierRow)

    const supplierName = purchaseData.supplier
      ? (supplierRow?.print_name ?? purchaseData.supplier)
      : purchaseData.supplier


    let godownRow = null
    if (purchaseData.godown) {
      godownRow = (await db.query(
        'SELECT godown_name, print_name, address, area FROM godown_master WHERE id = ?',
        [purchaseData.godown]
      )).rows[0]
    }

    console.log('HEADER QUERY RESULT (godown) =', godownRow)

    const godownName = purchaseData.godown
      ? (godownRow?.godown_name ?? godownRow?.print_name ?? purchaseData.godown)
      : purchaseData.godown




    purchaseData.supplier_name = supplierName
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

    const insertValues = [
      finalSno,
      formData.date || new Date().toISOString().slice(0, 10),
      finalInvNo,
      formData.supplier || '',
      formData.payType || formData.pay_type || 'Credit',
      formData.invDate || formData.inv_date || null,
      formData.type || 'Urad',
      formData.contact_person || '',
      formData.address || '',
      formData.area || '',
      formData.phone || '',
      formData.gst_no || '',
      formData.email || '',
      formData.taxType || formData.tax_type || 'Exclusive',
      formData.tax_percent || 0,
      formData.godown || '',
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
      purchase_order_id,
      po_no,
      purchase_order_id,
      po_no
    ]

    const purchaseResult = await db.run(`
      INSERT INTO purchases (
        s_no, date, inv_no, supplier, pay_type, inv_date, type, contact_person, address, area, phone, gst_no, email, tax_type, tax_percent, godown, remarks,
        transporter, transport, vehicle_no, lorry_no, driver_name, driver,
        total_qty, total_weight, total_amount, base_amount, disc_amount, tax_amount, net_amount, deduction_amount, grand_total,
        purchase_order_id, po_no, source_order_id, source_order_no
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

    const maxItemIdResult = await db.query('SELECT MAX(id) AS maxId FROM purchase_items')
    let nextLotSeq = (maxItemIdResult.rows[0]?.maxId || 0) + 1

    for (const item of items) {
      const normalizedItem = normalizePurchaseItem(item)
      const qty = normalizedItem.qty
      const rate = normalizedItem.rate
      const discPercent = normalizedItem.disc_percent
      const taxPercent = normalizedItem.tax_percent
      const perUnitWeight = normalizedItem.per_unit_weight
      const totalWt = Number((normalizedItem.total_weight || (qty * perUnitWeight)).toFixed(3));

      const baseAmount = Number((qty * rate).toFixed(2)); // Base amount is qty * rate
      const discountAmount = Number((normalizedItem.disc_amount || (baseAmount * discPercent / 100)).toFixed(2)); // Discount based on baseAmount
      const taxableAmount = Number((baseAmount - discountAmount).toFixed(2)); // Taxable is base - discount


      const taxAmount = normalizedItem.tax_amount
        ? Number(normalizedItem.tax_amount)
        : Number((((taxableAmount * taxPercent) / 100)).toFixed(2));

      const amount = Number((baseAmount + taxAmount).toFixed(2));
      const netAmount = amount;

      let lotNo = normalizedItem.lot_no
      if (!lotNo || lotNo === '') {
        lotNo = `LOT${String(nextLotSeq++).padStart(4, '0')}`
      }

      await db.run(`
        INSERT INTO purchase_items (
          purchase_id, item_id, item_name, lot_no, per_unit_weight, qty, total_weight, rate,
          disc_percent, disc_amount, tax_percent, tax_amount, amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        taxPercent,
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
        INSERT INTO stock_lots (item_id, item_name, lot_no, purchase_id, quantity, remaining_quantity, rate)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [itemId, normalizedItem.item_name, lotNo, purchaseId, qty, qty, rate])

      await db.run(`
        INSERT INTO stock (item_name, lot_no, qty, weight, rate, amount, date, type, reference_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Purchase', ?)
      `, [normalizedItem.item_name, lotNo, qty, totalWt, rate, amount, formData.date, purchaseId])
    }

    for (const ded of deductions) {
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
      await createPurchaseLedgerEntries({
        supplier: formData.supplier,
        date: formData.date,
        invNo: formData.invNo || '',
        purchaseId,
        baseAmount: parseFloat(totals.baseAmount) || 0,
        taxAmount: parseFloat(totals.taxAmount) || 0,
        discAmount: parseFloat(totals.discAmount) || 0,
        netAmount: parseFloat(totals.grandTotal) || 0,
        deductions: deductions || []
      })
    } catch (ledgerError) {
      console.error('Error creating ledger entries:', ledgerError)
    }

    res.status(201).json({ success: true, message: 'Purchase saved successfully!', id: purchaseId })
  } catch (error) {
    console.error('Error saving purchase:', error)
    res.status(500).json({ message: 'Error saving purchase', error: error.message })
  }
})

// PUT update purchase
router.put('/:id', async (req, res) => {
  try {
    const { formData, items, totals, deductions } = req.body
    const purchaseId = req.params.id

    const purchase_order_id = formData.purchase_order_id || formData.purchaseOrderId || formData.po_id || formData.source_order_id || null;
    const po_no = formData.po_no || formData.poNo || formData.source_order_no || null;
    const transporter = formData.transporter || formData.transport || '';
    const vehicle_no = formData.vehicle_no || formData.lorry_no || '';
    const driver_name = formData.driver_name || formData.driver || '';

    await db.run(`
      UPDATE purchases SET
        s_no = ?, date = ?, inv_no = ?, supplier = ?, pay_type = ?,
        inv_date = ?, type = ?, contact_person = ?, address = ?, area = ?, phone = ?, gst_no = ?, email = ?,
        tax_type = ?, tax_percent = ?, godown = ?,
        remarks = ?, transporter = ?, transport = ?, vehicle_no = ?, lorry_no = ?, driver_name = ?, driver = ?,
        total_qty = ?, total_weight = ?, total_amount = ?,
        base_amount = ?, disc_amount = ?, tax_amount = ?, net_amount = ?,
        deduction_amount = ?, grand_total = ?,
        purchase_order_id = ?, po_no = ?, source_order_id = ?, source_order_no = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      formData.sno || formData.s_no,
      formData.date,
      formData.invNo || formData.inv_no,
      formData.supplier || formData.supplier_id,
      formData.payType || formData.pay_type,
      formData.invDate,
      formData.type,
      formData.contact_person,
      formData.address,
      formData.area,
      formData.phone,
      formData.gst_no,
      formData.email,
      formData.taxType || formData.tax_type,
      formData.tax_percent || 0,
      formData.godown,
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
      purchase_order_id,
      po_no,
      purchase_order_id,
      po_no,
      purchaseId
    ])

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

    const maxItemIdResult = await db.query('SELECT MAX(id) AS maxId FROM purchase_items')
    let nextLotSeq = (maxItemIdResult.rows[0]?.maxId || 0) + 1

    for (const item of items) {
      const normalizedItem = normalizePurchaseItem(item)
      const qty = normalizedItem.qty
      const rate = normalizedItem.rate
      const discPercent = normalizedItem.disc_percent
      const taxPercent = normalizedItem.tax_percent
      const perUnitWeight = normalizedItem.per_unit_weight
      const totalWt = Number((normalizedItem.total_weight || (qty * perUnitWeight)).toFixed(3));

      const baseAmount = Number((qty * rate).toFixed(2));
      const discountAmount = Number((normalizedItem.disc_amount || (baseAmount * discPercent / 100)).toFixed(2));
      const taxableAmount = Number((baseAmount - discountAmount).toFixed(2));
      const taxAmount = normalizedItem.tax_amount
        ? Number(normalizedItem.tax_amount)
        : Number((((taxableAmount * taxPercent) / 100)).toFixed(2))
      const amount = Number((baseAmount + taxAmount).toFixed(2));


      let lotNo = normalizedItem.lot_no
      if (!lotNo || lotNo === '') lotNo = `LOT${String(nextLotSeq++).padStart(4, '0')}`

      await db.run(`
        INSERT INTO purchase_items (
          purchase_id, item_id, item_name, lot_no, per_unit_weight, qty, total_weight, rate,
          disc_percent, disc_amount, tax_percent, tax_amount, amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        taxPercent,
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
        INSERT INTO stock_lots (item_id, item_name, lot_no, purchase_id, quantity, remaining_quantity, rate)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [itemId, normalizedItem.item_name, lotNo, purchaseId, qty, qty, rate])

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
            p.godown_id || null,
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
        INSERT INTO stock (item_name, lot_no, qty, weight, rate, amount, date, type, reference_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Purchase', ?)
      `, [normalizedItem.item_name, lotNo, qty, totalWt, rate, amount, formData.date, purchaseId])
    }

    for (const ded of deductions) {
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
      await deleteLedgerEntries(purchaseId, 'Purchase')
      await createPurchaseLedgerEntries({
        supplier: formData.supplier,
        date: formData.date,
        invNo: formData.invNo || '',
        purchaseId,
        baseAmount: parseFloat(totals.baseAmount) || 0,
        taxAmount: parseFloat(totals.taxAmount) || 0,
        discAmount: parseFloat(totals.discAmount) || 0,
        netAmount: parseFloat(totals.grandTotal) || 0,
        deductions: deductions || []
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
