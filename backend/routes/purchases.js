<<<<<<< HEAD

=======
>>>>>>> origin/main
const express = require('express')
const router = express.Router()
const db = require('../config/database')
const { createPurchaseLedgerEntries, deleteLedgerEntries } = require('../utils/ledgerHelper')
<<<<<<< HEAD
const { rebuildStockLedger } = require('../utils/stockRebuilder')
 
=======

>>>>>>> origin/main
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
<<<<<<< HEAD
 
// GET next s_no for purchase creation
// IMPORTANT: must be registered BEFORE router.get('/:id')
router.get('/next-sno', async (req, res) => {
=======

// GET next s_no for purchase creation
router.get('/next-sno', async (req, res) => { // Ensure this is registered BEFORE router.get('/:id')
>>>>>>> origin/main
  try {
    const result = await db.query('SELECT MAX(s_no) as maxSno FROM purchases')
    const nextSno = (result.rows[0]?.maxSno || 0) + 1
    res.json({ success: true, data: { s_no: nextSno } })
  } catch (error) {
    console.error('Error getting next s_no:', error.message)
    res.status(500).json({ success: false, message: 'Error getting next s_no', error: error.message })
  }
})
<<<<<<< HEAD
 
=======

>>>>>>> origin/main
// GET purchase list for UI (ERP-grade join)
router.get('/purchase-list', async (req, res) => {
  try {
    const sql = `SELECT
      p.id,
      p.inv_no AS invoice_no,
      p.date AS invoice_date,
      s.name AS supplier_name,
      COALESCE(s.address1, p.address, '') AS address,
      COALESCE(im.item_name, pi.item_name, '') AS item_name,
      pi.lot_no,
      pi.per_unit_weight AS weight,
      pi.total_weight,
      pi.rate,
      (pi.qty * pi.rate) AS base_amount,
      pi.disc_percent,
      pi.disc_amount,
      pi.tax_percent,
      pi.tax_amount,
      pi.amount,
<<<<<<< HEAD
      0 AS total_deduction,
      COALESCE(pi.amount, 0) AS grand_total
=======
      COALESCE(p.deduction_amount, 0) AS total_deduction,
      (COALESCE(pi.amount, 0) + COALESCE(p.deduction_amount, 0)) AS grand_total
>>>>>>> origin/main
    FROM purchases p
    LEFT JOIN supplier_master s ON s.id = p.supplier
    LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
    LEFT JOIN item_master im ON im.id = pi.item_id
    ORDER BY p.id DESC`;
<<<<<<< HEAD
 
=======

>>>>>>> origin/main
    const result = await db.query(sql);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching purchase list:', error.message);
    res.status(500).json({ message: 'Error fetching purchase list', error: error.message });
  }
});
<<<<<<< HEAD
 
=======

>>>>>>> origin/main
router.get('/:id', async (req, res) => {
  try {
    const purchaseResult = await db.query('SELECT * FROM purchases WHERE id = ?', [req.params.id]);
    if (purchaseResult.rows.length === 0) {
      return res.status(404).json({ message: 'Purchase not found' });
    }
    const purchaseData = purchaseResult.rows[0];
<<<<<<< HEAD
 
    const itemsResult = await db.query('SELECT * FROM purchase_items WHERE purchase_id = ?', [req.params.id])
    let deductionsResult = []
    try {
=======

    const itemsResult = await db.query('SELECT * FROM purchase_items WHERE purchase_id = ?', [req.params.id])
    let deductionsResult = []
    try {
      // optional: only if table exists
>>>>>>> origin/main
      const d = await db.query('SELECT * FROM purchase_deductions WHERE purchase_id = ?', [req.params.id])
      deductionsResult = d.rows
    } catch (e) {
      deductionsResult = []
    }
<<<<<<< HEAD
 
    const supplierName = purchaseData.supplier ? (await db.query('SELECT name FROM supplier_master WHERE id = ?', [purchaseData.supplier])).rows[0]?.name : purchaseData.supplier;
    const godownName = purchaseData.godown ? (await db.query('SELECT name FROM godown_master WHERE id = ?', [purchaseData.godown])).rows[0]?.name : purchaseData.godown;
 
    purchaseData.supplier_name = supplierName;
    purchaseData.godown_name = godownName;
 
=======
    
    // Fetch supplier and godown names for display if IDs are stored
    const supplierName = purchaseData.supplier ? (await db.query('SELECT name FROM supplier_master WHERE id = ?', [purchaseData.supplier])).rows[0]?.name : purchaseData.supplier;
    const godownName = purchaseData.godown ? (await db.query('SELECT name FROM godown_master WHERE id = ?', [purchaseData.godown])).rows[0]?.name : purchaseData.godown;

    purchaseData.supplier_name = supplierName;
    purchaseData.godown_name = godownName;

>>>>>>> origin/main
    const purchase = {
      ...purchaseData,
      items: itemsResult.rows,
      deductions: deductionsResult
    }
<<<<<<< HEAD
 
    res.json(purchase)
 
=======

    res.json(purchase)

>>>>>>> origin/main
  } catch (error) {
    console.error('Error fetching purchase:', error)
    res.status(500).json({ message: 'Error fetching purchase' })
  }
})
<<<<<<< HEAD
 
=======

>>>>>>> origin/main
// POST create new purchase
router.post('/', async (req, res) => {
  try {
    const { formData, items, totals, deductions } = req.body
<<<<<<< HEAD
 
=======

>>>>>>> origin/main
    // Validation
    if (!formData.date || !formData.supplier || !items || items.length === 0) {
      return res.status(400).json({ message: 'Date, supplier, and at least one item are required' })
    }
<<<<<<< HEAD
 
    const invalidItem = items.find(
      (item) => !item.item_name || Number(item.qty) <= 0 || Number(item.rate) <= 0
    );
 
=======

    if (items.some(item => !item.itemName || item.qty <= 0 || item.rate <= 0)) {
      return res.status(400).json({ message: 'All items must have a name, positive quantity, and positive rate' })
    }

    // Insert purchase
    console.log('Inserting purchase with data:', {
      s_no: formData.sno || 1,
      date: formData.date,
      supplier: formData.supplier,
      totalQty: totals.totalQty || 0
    })

    const invalidItem = items.find(
      (item) => !item.item_name || Number(item.qty) <= 0 || Number(item.rate) <= 0
    );

>>>>>>> origin/main
    if (invalidItem) {
      return res.status(400).json({
        message: "All items must have a name, positive quantity, and positive rate",
      });
    }
<<<<<<< HEAD
 
    const insertValues = [
      parseInt(formData.sno) || 1,
      formData.date || new Date().toISOString().slice(0, 10),
      formData.invNo || formData.inv_no || '',
      formData.supplier || '',
      formData.payType || formData.pay_type || 'Credit',
      formData.invDate || formData.inv_date || null,
=======

    const insertValues = [
      parseInt(formData.sno) || 1,
      formData.date || new Date().toISOString().slice(0, 10),
      formData.invNo || '',
      formData.supplier || '',
      formData.payType || 'Credit',
      formData.invDate || null,
>>>>>>> origin/main
      formData.type || 'Urad',
      formData.contact_person || '',
      formData.address || '',
      formData.area || '',
      formData.phone || '',
      formData.gst_no || '',
      formData.email || '',
<<<<<<< HEAD
      formData.taxType || formData.tax_type || 'Exclusive',
      formData.tax_percent || formData.tax_rate || 0,
=======
      formData.taxType || 'Exclusive',
      formData.tax_percent || 0,
>>>>>>> origin/main
      formData.godown || '',
      formData.remarks || '',
      parseFloat(totals.totalQty) || 0,
      parseFloat(totals.totalWeight) || 0,
      parseFloat(totals.totalAmount) || 0,
      parseFloat(totals.baseAmount) || 0,
      parseFloat(totals.discAmount) || 0,
      parseFloat(totals.taxAmount) || 0,
      parseFloat(totals.netAmount) || 0,
      parseFloat(totals.deductionAmount || totals.deduction_amount) || 0,
      parseFloat(totals.grandTotal) || 0
    ];
<<<<<<< HEAD
 
=======

>>>>>>> origin/main
    const purchaseResult = await db.run(`
      INSERT INTO purchases (
        s_no, date, inv_no, supplier, pay_type, inv_date, type, contact_person, address, area, phone, gst_no, email, tax_type, tax_percent, godown, remarks, total_qty, total_weight, total_amount, base_amount, disc_amount, tax_amount, net_amount, deduction_amount, grand_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, insertValues)
<<<<<<< HEAD
 
    const purchaseId = purchaseResult.lastID;
 
    // ─────────────────────────────────────────────────────────────────
    // LOT NUMBER GENERATION
    // Strategy: use the preview lot sent by the frontend if available.
    // If not (blank / "Generating..." / fallback), generate a fresh
    // incrementing lot number here from MAX(lot_no) in stock_lots.
    //
    // This means:
    //  - If frontend showed LOT0042 (preview), that same number is saved.
    //  - If frontend had no lot (blank form submit), backend generates it.
    //  - Each item in this purchase gets a unique, sequentially incrementing lot.
    // ─────────────────────────────────────────────────────────────────
 
    // Find the highest existing numeric lot number across ALL tables
    let maxLotNum = 0;
    try {
      const lotResult = await db.query(`
        SELECT MAX(CAST(REPLACE(lot_no, 'LOT', '') AS INTEGER)) AS maxLot
        FROM stock_lots
        WHERE lot_no LIKE 'LOT%'
      `);
      maxLotNum = parseInt(lotResult.rows[0]?.maxLot) || 0;
    } catch (e) {
      // Fallback: use purchase_items table
      try {
        const lotResult2 = await db.query(`
          SELECT MAX(CAST(REPLACE(lot_no, 'LOT', '') AS INTEGER)) AS maxLot
          FROM purchase_items
          WHERE lot_no LIKE 'LOT%'
        `);
        maxLotNum = parseInt(lotResult2.rows[0]?.maxLot) || 0;
      } catch (e2) {
        maxLotNum = 0;
      }
    }
 
    let nextLotSeq = maxLotNum + 1; // Start from MAX+1, increment per item
 
=======

    const purchaseId = purchaseResult.lastID;

    const maxItemIdResult = await db.query('SELECT MAX(id) AS maxId FROM purchase_items')
    let nextLotSeq = (maxItemIdResult.rows[0]?.maxId || 0) + 1

>>>>>>> origin/main
    for (const item of items) {
      const qty = parseFloat(item.qty) || 0
      const rate = parseFloat(item.rate) || 0
      const discPercent = parseFloat(item.disc_percent) || 0
      const taxPercent = parseFloat(item.tax_percent) || 0
      const perUnitWeight = parseFloat(item.per_unit_weight) || 0
      const totalWt = Number((item.total_weight || qty * perUnitWeight).toFixed(3));
<<<<<<< HEAD
 
      const baseAmount = Number((qty * rate).toFixed(2));
      const discountAmount = Number((item.disc_amount || (baseAmount * discPercent / 100)).toFixed(2));
      const taxableAmount = Number((baseAmount - discountAmount).toFixed(2));
      const taxMode = (formData.taxType || formData.tax_type || 'Without Tax');
      const effectiveTaxPercent = taxMode === 'Exclusive' ? taxPercent : 0;
      // If tax type is `Without Tax`, GST must be zero (even if frontend sends a tax_amount)
      const taxAmount = effectiveTaxPercent === 0 ? 0 : Number((item.tax_amount || (taxableAmount * effectiveTaxPercent / 100)).toFixed(2));
 
      // Use frontend's preview lot if it's a valid LOT#### format.
      // Otherwise generate a fresh sequential one.
      let lotNo =
  item.lot_no ||
  item.lotNo ||
  '';

if (!lotNo) {
  lotNo =
    `LOT${String(nextLotSeq).padStart(4, '0')}`;
}

nextLotSeq++; // always increment so each item in this purchase is unique
 
      console.log(`[LOT-GEN] Item: ${item.item_name}, Lot: "${lotNo}"`)
 
=======

      const baseAmount = Number((qty * rate).toFixed(2));
      const discountAmount = Number((item.disc_amount || (baseAmount * discPercent / 100)).toFixed(2));
      const taxableAmount = Number((baseAmount - discountAmount).toFixed(2));
      const taxAmount = Number((item.tax_amount || ((formData.taxType === 'Exclusive') ? (taxableAmount * taxPercent / 100) : 0)).toFixed(2));

      let lotNo = item.lotNo
      if (!lotNo || lotNo === '') {
        lotNo = `LOT${String(nextLotSeq++).padStart(4, '0')}`
      }
      
      console.log(`[LOT-GEN] Item: ${item.item_name}, Generated lotNo: "${lotNo}", nextLotSeq before: ${nextLotSeq - 1}`)

>>>>>>> origin/main
      await db.run(`
        INSERT INTO purchase_items (
          purchase_id, item_id, item_name, lot_no, per_unit_weight, qty, total_weight, rate, disc_percent, disc_amount, tax_percent, tax_amount, amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        purchaseId, item.item_id, item.item_name, lotNo, perUnitWeight, qty, totalWt,
        rate, discPercent, discountAmount, taxPercent, taxAmount, Number(taxableAmount.toFixed(2))
      ])
<<<<<<< HEAD
 
      // Resolve item_id if not numeric
      let itemId = item.item_id
=======
      
      // Get item_id from item_master (already have item.item_id from frontend)
      let itemId = item.item_id
      // If item_id is not numeric, try to find it from item_master
>>>>>>> origin/main
      if (isNaN(parseInt(itemId))) {
        try {
          const itemResult = await db.query('SELECT id FROM item_master WHERE item_name = ?', [item.item_name])
          if (itemResult.rows.length > 0) {
            itemId = itemResult.rows[0].id
          }
        } catch (e) {
          console.log('Item not found in master:', item.item_name)
        }
      }
<<<<<<< HEAD
 
      // Insert into stock_lots
=======
      
      // Insert into stock_lots table
>>>>>>> origin/main
      await db.run(`
        INSERT INTO stock_lots (item_id, item_name, lot_no, purchase_id, quantity, remaining_quantity, rate)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [itemId, item.item_name, lotNo, purchaseId, qty, qty, rate])
<<<<<<< HEAD
 
      // Insert into stock
=======
      
      // Also insert into stock table for tracking
>>>>>>> origin/main
      await db.run(`
        INSERT INTO stock (item_name, lot_no, qty, weight, rate, amount, date, type, reference_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Purchase', ?)
      `, [item.item_name, lotNo, qty, totalWt, rate, Number(taxableAmount.toFixed(2)), formData.date, purchaseId])
    }
<<<<<<< HEAD
 
    // Insert purchase deductions
    for (const ded of (deductions || [])) {
=======

    // Insert purchase deductions
    for (const ded of deductions) {
>>>>>>> origin/main
      await db.run(`
        INSERT INTO purchase_deductions (
          purchase_id, deduction_id, deduction_name, type, calculation_type, percentage, amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        purchaseId, ded.deduction_id, ded.deduction_name, ded.type, ded.calculation_type, ded.percentage, ded.amount
      ])
    }
<<<<<<< HEAD
 
    // Create ledger entries
=======


    // Create ledger entries for the purchase
>>>>>>> origin/main
    try {
      await createPurchaseLedgerEntries({
        supplier: formData.supplier,
        date: formData.date,
<<<<<<< HEAD
        invNo: formData.invNo || formData.inv_no || '',
=======
        invNo: formData.invNo || '',
>>>>>>> origin/main
        purchaseId: purchaseId,
        baseAmount: parseFloat(totals.baseAmount) || 0,
        taxAmount: parseFloat(totals.taxAmount) || 0,
        discAmount: parseFloat(totals.discAmount) || 0,
        netAmount: parseFloat(totals.grandTotal) || 0
      })
      console.log('Ledger entries created for purchase:', purchaseId)
    } catch (ledgerError) {
      console.error('Error creating ledger entries:', ledgerError)
    }
<<<<<<< HEAD
 
    try {
      await rebuildStockLedger();
    } catch (e) {
      console.error('Error rebuilding stock after purchase:', e);
    }

    res.status(201).json({
      success: true,
=======

    res.status(201).json({
>>>>>>> origin/main
      message: 'Purchase saved successfully!',
      id: purchaseId
    })
  } catch (error) {
    console.error('Error saving purchase:', error)
<<<<<<< HEAD
    res.status(500).json({ success: false, message: 'Error saving purchase', error: error.message })
  }
})
 
=======
    res.status(500).json({ message: 'Error saving purchase', error: error.message })
  }
})

>>>>>>> origin/main
// PUT update purchase
router.put('/:id', async (req, res) => {
  try {
    const { formData, items, totals, deductions } = req.body
    const purchaseId = req.params.id
<<<<<<< HEAD
 
    await db.run(`
      UPDATE purchases SET
        s_no = ?, date = ?, inv_no = ?, supplier = ?, pay_type = ?,
=======

    // Update purchase
    await db.run(`
      UPDATE purchases SET
        s_no = ?, date = ?, inv_no = ?, supplier = ?, pay_type = ?, 
>>>>>>> origin/main
        inv_date = ?, type = ?, contact_person = ?, address = ?, area = ?, phone = ?, gst_no = ?, email = ?, tax_type = ?, tax_percent = ?, godown = ?,
        remarks = ?, total_qty = ?, total_weight = ?, total_amount = ?,
        base_amount = ?, disc_amount = ?, tax_amount = ?, net_amount = ?,
        deduction_amount = ?, grand_total = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      formData.sno || formData.s_no, formData.date, formData.invNo || formData.inv_no, formData.supplier || formData.supplier_id, formData.payType || formData.pay_type,
<<<<<<< HEAD
      formData.invDate || formData.inv_date, formData.type, formData.contact_person, formData.address, formData.area, formData.phone, formData.gst_no, formData.email,
      formData.taxType || formData.tax_type, formData.tax_percent || formData.tax_rate || 0, formData.godown,
=======
      formData.invDate, formData.type, formData.contact_person, formData.address, formData.area, formData.phone, formData.gst_no, formData.email, formData.taxType, formData.tax_percent || 0, formData.godown,
>>>>>>> origin/main
      formData.remarks, totals.totalQty, totals.totalWeight, totals.totalAmount,
      totals.baseAmount, totals.discAmount, totals.taxAmount, totals.netAmount,
      totals.deductionAmount, totals.grandTotal, purchaseId
    ])
<<<<<<< HEAD
 
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

    // Delete existing items and stock entries
    await db.run('DELETE FROM stock_lots WHERE purchase_id = ?', [purchaseId]);
    await db.run('DELETE FROM stock WHERE reference_id = ? AND type = ?', [purchaseId, 'Purchase']);
    await db.run('DELETE FROM purchase_items WHERE purchase_id = ?', [purchaseId])
    await db.run('DELETE FROM purchase_deductions WHERE purchase_id = ?', [purchaseId]);
 
    // Get highest existing lot number
    let maxLotNum = 0;
    try {
      const lotResult = await db.query(`
        SELECT MAX(CAST(REPLACE(lot_no, 'LOT', '') AS INTEGER)) AS maxLot
        FROM stock_lots WHERE lot_no LIKE 'LOT%'
      `);
      maxLotNum = parseInt(lotResult.rows[0]?.maxLot) || 0;
    } catch (e) {
      try {
        const lotResult2 = await db.query(`
          SELECT MAX(CAST(REPLACE(lot_no, 'LOT', '') AS INTEGER)) AS maxLot
          FROM purchase_items WHERE lot_no LIKE 'LOT%'
        `);
        maxLotNum = parseInt(lotResult2.rows[0]?.maxLot) || 0;
      } catch (e2) {
        maxLotNum = 0;
      }
    }
 
    let nextLotSeq = maxLotNum + 1;
 
=======

    // Delete existing items
    await db.run('DELETE FROM stock_lots WHERE purchase_id = ?', [purchaseId]);
    await db.run('DELETE FROM stock WHERE reference_id = ? AND type = ?', [purchaseId, 'Purchase']);
    await db.run('DELETE FROM purchase_items WHERE purchase_id = ?', [purchaseId])
    // Delete existing deductions
    await db.run('DELETE FROM purchase_deductions WHERE purchase_id = ?', [purchaseId]);

    // Auto-generate lot numbers sequentially if frontend sends blank lot_no during update
    const maxItemIdResult = await db.query('SELECT MAX(id) AS maxId FROM purchase_items')
    let nextLotSeq = (maxItemIdResult.rows[0]?.maxId || 0) + 1

    // Insert updated items
>>>>>>> origin/main
    for (const item of items) {
      const qty = parseFloat(item.qty) || 0
      const rate = parseFloat(item.rate) || 0
      const discPercent = parseFloat(item.disc_percent) || 0
      const taxPercent = parseFloat(item.tax_percent) || 0
      const perUnitWeight = parseFloat(item.per_unit_weight) || 0
      const totalWt = parseFloat(item.total_weight || qty * perUnitWeight) || qty * perUnitWeight
<<<<<<< HEAD
 
      const baseAmount = qty * rate
      const discountAmount = item.disc_amount || (baseAmount * discPercent / 100)
      const taxableAmount = baseAmount - discountAmount
      // If tax type is `Without Tax`, GST must be zero (even if frontend sends tax_amount)
      const effectiveTaxPercent = (formData.taxType === 'Exclusive' || formData.tax_type === 'Exclusive') ? taxPercent : 0;
      const taxAmount = effectiveTaxPercent === 0 ? 0 : (item.tax_amount || (taxableAmount * effectiveTaxPercent / 100));
 
      let lotNo =
  item.lot_no ||
  item.lotNo ||
  '';

if (!lotNo) {
  lotNo =
    `LOT${String(nextLotSeq).padStart(4, '0')}`;
}

nextLotSeq++;
 
=======

      const baseAmount = qty * rate
      const discountAmount = item.disc_amount || (baseAmount * discPercent / 100)
      const taxableAmount = baseAmount - discountAmount
      const taxAmount = item.tax_amount || ((formData.taxType === 'Exclusive') ? (taxableAmount * taxPercent / 100) : 0);

      let lotNo = item.lotNo
      if (!lotNo || lotNo === '') {
        lotNo = `LOT${String(nextLotSeq++).padStart(4, '0')}`
      }

>>>>>>> origin/main
      await db.run(`
        INSERT INTO purchase_items (
          purchase_id, item_id, item_name, lot_no, per_unit_weight, qty, total_weight, rate, disc_percent, disc_amount, tax_percent, tax_amount, amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        purchaseId, item.item_id, item.item_name, lotNo, perUnitWeight, qty, totalWt,
        rate, discPercent, discountAmount, taxPercent, taxAmount, Number(taxableAmount.toFixed(2))
      ])
<<<<<<< HEAD
 
      let itemId = item.item_id
      if (isNaN(parseInt(itemId))) {
        try {
          const itemResult = await db.query('SELECT id FROM item_master WHERE item_name = ?', [item.item_name])
          if (itemResult.rows.length > 0) itemId = itemResult.rows[0].id
=======

      // Get item_id from item_master (already have item.item_id from frontend)
      let itemId = item.item_id
      // If item_id is not numeric, try to find it from item_master
      if (isNaN(parseInt(itemId))) {
        try {
          const itemResult = await db.query('SELECT id FROM item_master WHERE item_name = ?', [item.item_name])
          if (itemResult.rows.length > 0) {
            itemId = itemResult.rows[0].id
          }
>>>>>>> origin/main
        } catch (e) {
          console.log('Item not found in master:', item.item_name)
        }
      }
<<<<<<< HEAD
 
=======
      
      // Insert into stock_lots table
>>>>>>> origin/main
      await db.run(`
        INSERT INTO stock_lots (item_id, item_name, lot_no, purchase_id, quantity, remaining_quantity, rate)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [itemId, item.item_name, lotNo, purchaseId, qty, qty, rate])
<<<<<<< HEAD

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
 
=======
      
      // Also insert into stock table for tracking
>>>>>>> origin/main
      await db.run(`
        INSERT INTO stock (item_name, lot_no, qty, weight, rate, amount, date, type, reference_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Purchase', ?)
      `, [item.item_name, lotNo, qty, totalWt, rate, Number(taxableAmount.toFixed(2)), formData.date, purchaseId])
    }
<<<<<<< HEAD
 
    for (const ded of (deductions || [])) {
=======

    // Insert updated deductions
    for (const ded of deductions) {
>>>>>>> origin/main
      await db.run(`
        INSERT INTO purchase_deductions (purchase_id, deduction_id, deduction_name, type, calculation_type, percentage, amount)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [purchaseId, ded.deduction_id, ded.deduction_name, ded.type, ded.calculation_type, ded.percentage, ded.amount])
    }
<<<<<<< HEAD
 
    try {
      await rebuildStockLedger();
    } catch (e) {
      console.error('Error rebuilding stock after updating purchase:', e);
    }

    res.json({ success: true, message: 'Purchase updated successfully!' })
  } catch (error) {
    console.error('Error updating purchase:', error)
    res.status(500).json({ success: false, message: 'Error updating purchase', error: error.message })
  }
})
 
=======

    res.json({ message: 'Purchase updated successfully!' })
  } catch (error) {
    console.error('Error updating purchase:', error)
    res.status(500).json({ message: 'Error updating purchase', error: error.message })
  }
})

>>>>>>> origin/main
// DELETE purchase
router.delete('/:id', async (req, res) => {
  try {
    const purchaseId = req.params.id
<<<<<<< HEAD
 
    const lotCheck = await db.query(`
      SELECT * FROM stock_lots
      WHERE purchase_id = ? AND remaining_quantity < quantity
    `, [purchaseId])
 
    if (lotCheck.rows.length > 0) {
      return res.status(400).json({
        message: 'Cannot delete purchase - stock from this lot has been used in sales or grinding. Please reverse those transactions first.'
      })
    }
 
=======
    
    // Check if any stock lots from this purchase have been used
    const lotCheck = await db.query(`
      SELECT * FROM stock_lots 
      WHERE purchase_id = ? AND remaining_quantity < quantity
    `, [purchaseId])
    
    if (lotCheck.rows.length > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete purchase - stock from this lot has been used in sales or grinding. Please reverse those transactions first.' 
      })
    }
    
    // Also check if any flour_out items use lots from this purchase
>>>>>>> origin/main
    const flourCheck = await db.query(`
      SELECT fo.id, fo.s_no, fo.date, fo.papad_company
      FROM flour_out fo
      JOIN flour_out_items foi ON fo.id = foi.flour_out_id
      JOIN stock_lots sl ON foi.lot_no = sl.lot_no
      WHERE sl.purchase_id = ?
    `, [purchaseId])
<<<<<<< HEAD
 
    if (flourCheck.rows.length > 0) {
      return res.status(400).json({
        message: `Cannot delete purchase - lots have been used in Grind (Flour Out) records. Please delete Grind records first. Reference: ${flourCheck.rows[0]?.s_no || 'Multiple'}`
      })
    }
 
    await db.run('DELETE FROM stock_lots WHERE purchase_id = ?', [purchaseId])
    await db.run('DELETE FROM stock WHERE reference_id = ? AND type = ?', [purchaseId, 'Purchase'])

=======
    
    if (flourCheck.rows.length > 0) {
      return res.status(400).json({ 
        message: `Cannot delete purchase - lots have been used in Grind (Flour Out) records. Please delete Grind records first. Reference: ${flourCheck.rows[0]?.s_no || 'Multiple'}` 
      })
    }
    
    // Delete stock_lots entries first
    await db.run('DELETE FROM stock_lots WHERE purchase_id = ?', [purchaseId])
    
    // Delete ledger entries
>>>>>>> origin/main
    try {
      await deleteLedgerEntries(purchaseId)
    } catch (ledgerError) {
      console.error('Error deleting purchase ledger entries:', ledgerError)
    }
<<<<<<< HEAD
 
    await db.run('DELETE FROM purchase_deductions WHERE purchase_id = ?', [purchaseId]);
    await db.run('DELETE FROM purchase_items WHERE purchase_id = ?', [purchaseId])
    await db.run('DELETE FROM purchases WHERE id = ?', [purchaseId])

    try {
      await rebuildStockLedger();
    } catch (e) {
      console.error('Error rebuilding stock after deleting purchase:', e);
    }

=======
    
    // Delete purchase deductions
    await db.run('DELETE FROM purchase_deductions WHERE purchase_id = ?', [purchaseId]);

    // Delete purchase items
    await db.run('DELETE FROM purchase_items WHERE purchase_id = ?', [purchaseId])
    
    // Delete purchase
    await db.run('DELETE FROM purchases WHERE id = ?', [purchaseId])
    
>>>>>>> origin/main
    res.json({ message: 'Purchase deleted successfully' })
  } catch (error) {
    console.error('Error deleting purchase:', error)
    res.status(500).json({ message: 'Error deleting purchase', error: error.message })
  }
});
<<<<<<< HEAD
 
module.exports = router;
 
=======

module.exports = router;
>>>>>>> origin/main
