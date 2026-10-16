
const express = require('express')
const router = express.Router()
const db = require('../config/database')
const { createPurchaseLedgerEntries, deleteLedgerEntries } = require('../utils/ledgerHelper')
const { rebuildStockLedger } = require('../utils/stockRebuilder')
const { reserveNextLotNumber, recordLotNumber } = require('../utils/lotHelper')
const { calculateLineTax, calculateInvoiceTax } = require('../services/taxEngine')

const calculatePurchaseTotals = (formData = {}, items = [], deductions = []) => calculateInvoiceTax({
  items: items.map((item) => {
    const calculationItem = { ...item };
    delete calculationItem.disc_amount;
    delete calculationItem.discAmount;
    return calculationItem;
  }),
  deductions: Array.isArray(deductions) ? deductions : [],
  taxMode: formData.tax_mode || formData.taxType || formData.tax_type || 'Exclusive',
  companyState: formData.company_state || formData.companyState || 'Tamil Nadu',
  partyState: formData.supplier_state || formData.party_state || 'Tamil Nadu',
  companyStateCode: formData.company_state_code || '33',
  partyStateCode: formData.supplier_state_code || formData.party_state_code || '33'
})

const validatePurchaseLines = (items, deductions) => {
  if (!Array.isArray(items) || items.length === 0) {
    return 'At least one purchase item is required.';
  }
  const invalidItem = items.find((item) => {
    const qty = Number(item.qty);
    const rate = Number(item.rate);
    const discountPercent = Number(item.disc_percent ?? item.discPercent ?? 0);
    const taxRate = Number(item.tax_percent ?? item.tax_rate ?? item.gst_rate ?? 0);
    return !item.item_name || !Number.isFinite(qty) || qty <= 0 ||
      !Number.isFinite(rate) || rate <= 0 ||
      !Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100 ||
      !Number.isFinite(taxRate) || taxRate < 0;
  });
  if (invalidItem) {
    return 'Each item must have a name, positive quantity and rate, valid discount, and non-negative tax rate.';
  }
  if (Array.isArray(deductions) && deductions.some((deduction) =>
    !Number.isFinite(Number(deduction.amount)) || Number(deduction.amount) < 0
  )) {
    return 'Purchase deduction and addition amounts must be valid non-negative numbers.';
  }
  return null;
};

const getPurchaseWeights = (formData = {}) => {
  const grossInput = formData.gross_weight ?? formData.cross_weight;
  const tareInput = formData.tare_weight;
  const grossWeight = grossInput === '' || grossInput === null || grossInput === undefined ? 0 : Number(grossInput);
  const tareWeight = tareInput === '' || tareInput === null || tareInput === undefined ? 0 : Number(tareInput);
  if (!Number.isFinite(grossWeight) || !Number.isFinite(tareWeight) || grossWeight < 0 || tareWeight < 0) {
    return { error: 'Cross Weight and Tare Weight must be valid non-negative numbers.' };
  }
  const netWeight = Number((grossWeight - tareWeight).toFixed(2));
  if (netWeight < 0) {
    return { error: 'Tare Weight cannot exceed Cross Weight.' };
  }
  const suppliedNet = formData.net_weight;
  if (suppliedNet !== '' && suppliedNet !== null && suppliedNet !== undefined &&
      (!Number.isFinite(Number(suppliedNet)) || Math.abs(Number(suppliedNet) - netWeight) > 0.01)) {
    return { error: 'Net Weight must equal Cross Weight minus Tare Weight.' };
  }
  return { grossWeight, tareWeight, netWeight };
};
 
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
// IMPORTANT: must be registered BEFORE router.get('/:id')
router.get('/next-sno', async (req, res) => {
  try {
    const pResult = await db.query('SELECT MAX(s_no) as maxSno, MAX(id) as maxId, COUNT(*) as count FROM purchases');
    const piResult = await db.query('SELECT COUNT(*) as itemCount, MAX(id) as maxItemId FROM purchase_items');
    
    // Check total records listed on purchase display UI
    const listRes = await db.query(`
      SELECT COUNT(*) as totalListRecords 
      FROM purchases p
      LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
    `);
    const totalListRecords = parseInt(listRes.rows[0]?.totalListRecords) || 0;
    
    const maxVal = Math.max(
      parseInt(pResult.rows[0]?.maxSno) || 0,
      parseInt(pResult.rows[0]?.maxId) || 0,
      parseInt(pResult.rows[0]?.count) || 0,
      parseInt(piResult.rows[0]?.itemCount) || 0,
      totalListRecords
    );
    const nextSno = maxVal + 1;
    res.json({ success: true, data: { s_no: nextSno }, next_sno: nextSno, s_no: nextSno });
  } catch (error) {
    console.error('Error getting next s_no:', error.message);
    res.status(500).json({ success: false, message: 'Error getting next s_no', error: error.message });
  }
});
 
// GET purchase list for UI (ERP-grade join)
router.get('/purchase-list', async (req, res) => {
  try {
    const sql = `SELECT
      p.id,
      COALESCE(p.s_no, p.id) AS s_no,
      p.inv_no AS invoice_no,
      p.inv_no,
      COALESCE(p.source_order_no, p.po_no, '') AS po_no,
      p.date AS invoice_date,
      p.date,
      COALESCE(s.name, s.print_name, p.supplier) AS supplier_name,
      COALESCE(s.print_name, s.name, p.supplier) AS supplier_print_name,
      COALESCE(s.address1, p.address, '') AS address,
      COALESCE(s.gst_number, '') AS supplier_gstin,
      COALESCE(s.phone_off, s.mobile1, '') AS supplier_phone,
      COALESCE(s.contact_person, p.contact_person, '') AS supplier_contact_person,
      COALESCE(im.item_name, pi.item_name, '') AS item_name,
      pi.item_id,
      pi.lot_no,
      COALESCE(pi.qty, 1) AS qty,
      COALESCE(pi.per_unit_weight, pi.weight, 0) AS weight,
      COALESCE(pi.per_unit_weight, pi.weight, 0) AS per_unit_weight,
      COALESCE(pi.total_weight, (pi.qty * COALESCE(pi.per_unit_weight, pi.weight, 1)), 0) AS total_weight,
      pi.rate,
      (COALESCE(pi.qty, 1) * COALESCE(pi.rate, 0)) AS base_amount,
      pi.disc_percent,
      pi.disc_amount,
      pi.tax_percent,
      pi.tax_amount,
      pi.amount,
      0 AS total_deduction,
      COALESCE(pi.amount, (COALESCE(pi.qty, 1) * COALESCE(pi.rate, 0)), 0) AS grand_total,
      p.payment_mode,
      p.tax_type,
      COALESCE(p.tax_percent, 5) AS purchase_tax_percent,
      COALESCE(p.stock_type, 'RM') AS stock_type,
      COALESCE(p.gross_weight, p.total_weight, 0) AS gross_weight,
      COALESCE(p.tare_weight, 0) AS tare_weight,
      COALESCE(p.net_weight, p.total_weight, 0) AS net_weight,
      p.vehicle_no,
      p.driver_name,
      p.driver_phone,
      p.transport,
      COALESCE(tm.print_name, tm.name, p.transporter, p.transport, '') AS transporter,
      COALESCE(tm.print_name, tm.name, p.transporter, p.transport, '') AS transporter_name,
      p.lr_no,
      p.lr_date,
      p.remarks,
      COALESCE(gm.godown_name, p.godown, 'Main Godown') AS godown_name,
      COALESCE(qi.id, (SELECT id FROM qc_inspections WHERE rm_lot_no = pi.lot_no OR CAST(purchase_id AS TEXT) = CAST(p.id AS TEXT) LIMIT 1)) AS qc_id
    FROM purchases p
    LEFT JOIN supplier_master s ON (CAST(s.id AS TEXT) = CAST(p.supplier AS TEXT) OR s.name = CAST(p.supplier AS TEXT) OR s.print_name = CAST(p.supplier AS TEXT))
    LEFT JOIN purchase_items pi ON CAST(pi.purchase_id AS TEXT) = CAST(p.id AS TEXT)
    LEFT JOIN item_master im ON (CAST(im.id AS TEXT) = CAST(pi.item_id AS TEXT) OR im.item_name = CAST(pi.item_name AS TEXT))
    LEFT JOIN godown_master gm ON (CAST(gm.id AS TEXT) = CAST(p.godown AS TEXT) OR gm.godown_name = CAST(p.godown AS TEXT))
    LEFT JOIN transport_master tm ON (CAST(tm.id AS TEXT) = CAST(p.transporter AS TEXT) OR CAST(tm.id AS TEXT) = CAST(p.transport AS TEXT) OR tm.name = CAST(p.transporter AS TEXT) OR tm.name = CAST(p.transport AS TEXT))
    LEFT JOIN qc_inspections qi ON (qi.rm_lot_no = pi.lot_no OR CAST(qi.purchase_id AS TEXT) = CAST(p.id AS TEXT) OR CAST(qi.purchase_id AS TEXT) = ('PUR-' || CAST(p.id AS TEXT)))
    ORDER BY p.id DESC`;
 
    const result = await db.query(sql);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching purchase list:', error.message);
    res.status(500).json({ message: 'Error fetching purchase list', error: error.message });
  }
});
 
router.get('/:id', async (req, res) => {
  try {
    const rawId = req.params.id;
    const isNum = !isNaN(Number(rawId)) && String(rawId).trim() !== '';
    const numVal = isNum ? Number(rawId) : null;

    const purchaseResult = await db.query(
      `SELECT * FROM purchases WHERE id = ? OR inv_no = ? ${isNum ? 'OR s_no = ?' : ''}`,
      isNum ? [numVal, rawId, numVal] : [rawId, rawId]
    );

    if (!purchaseResult.rows || purchaseResult.rows.length === 0) {
      return res.status(404).json({ message: 'Purchase not found' });
    }
    const purchaseData = purchaseResult.rows[0];
    const actualId = purchaseData.id;
    const sNo = purchaseData.s_no;

    const itemsResult = await db.query(
      `SELECT pi.*, COALESCE(im.item_name, pi.item_name) as item_name
       FROM purchase_items pi
       LEFT JOIN item_master im ON CAST(pi.item_id AS TEXT) = CAST(im.id AS TEXT)
       WHERE pi.purchase_id = ? OR pi.purchase_id = ?`,
      [actualId, sNo]
    );

    let deductionsResult = [];
    try {
      const d = await db.query(
        'SELECT * FROM purchase_deductions WHERE purchase_id = ? OR purchase_id = ?',
        [actualId, sNo]
      );
      deductionsResult = d.rows || [];
    } catch (e) {
      deductionsResult = [];
    }

    let supplierName = purchaseData.supplier_name;
    let supplierDetails = {};
    if (purchaseData.supplier) {
      try {
        const sRes = await db.query(
          `SELECT name, print_name, contact_person, address1, address2, address3, address4,
                  gst_number, phone_off, phone_res, mobile1, mobile2, email, state, state_code
           FROM supplier_master
           WHERE CAST(id AS TEXT) = ? OR name = ? OR print_name = ?
           LIMIT 1`,
          [String(purchaseData.supplier), String(purchaseData.supplier), String(purchaseData.supplier)]
        );
        supplierDetails = sRes.rows?.[0] || {};
        supplierName = supplierName || supplierDetails.print_name || supplierDetails.name;
      } catch (e) {
        console.error('Could not resolve purchase supplier details:', e.message);
      }
    }

    let transporterName = '';
    const transporterRef = purchaseData.transporter || purchaseData.transport;
    if (transporterRef) {
      try {
        const tRes = await db.query(
          `SELECT name, print_name FROM transport_master
           WHERE CAST(id AS TEXT) = ? OR name = ? OR print_name = ?
           LIMIT 1`,
          [String(transporterRef), String(transporterRef), String(transporterRef)]
        );
        transporterName = tRes.rows?.[0]?.print_name || tRes.rows?.[0]?.name || '';
      } catch (e) {
        console.error('Could not resolve purchase transporter:', e.message);
      }
    }

    let godownName = purchaseData.godown_name;
    if (!godownName && purchaseData.godown) {
      try {
        const gRes = await db.query('SELECT godown_name FROM godown_master WHERE id = ?', [purchaseData.godown]);
        if (gRes.rows.length > 0) {
          godownName = gRes.rows[0].godown_name;
        }
      } catch (e) {}
    }

    purchaseData.supplier_name = supplierName || purchaseData.supplier;
    purchaseData.godown_name = godownName || purchaseData.godown;
    purchaseData.supplier_gstin = supplierDetails.gst_number || purchaseData.gst_no || '';
    purchaseData.supplier_contact_person = supplierDetails.contact_person || purchaseData.contact_person || '';
    purchaseData.supplier_phone = supplierDetails.phone_off || supplierDetails.mobile1 || supplierDetails.phone_res || '';
    purchaseData.supplier_email = supplierDetails.email || purchaseData.email || '';
    purchaseData.transporter_name = transporterName || (typeof transporterRef === 'string' && !/^\d+$/.test(transporterRef) ? transporterRef : '');

    const purchase = {
      ...purchaseData,
      items: itemsResult.rows || [],
      deductions: deductionsResult
    };

    res.json(purchase);

  } catch (error) {
    console.error('Error fetching purchase:', error);
    res.status(500).json({ message: 'Error fetching purchase: ' + error.message });
  }
});
 
// POST create new purchase
router.post('/', async (req, res) => {
  try {
    const { formData, items, deductions } = req.body
 
    // Validation
    if (!formData?.date || !formData?.supplier) {
      return res.status(400).json({ message: 'Date, supplier, and at least one item are required' })
    }

    const lineValidationError = validatePurchaseLines(items, deductions);
    if (lineValidationError) return res.status(400).json({ message: lineValidationError });
    const purchaseWeights = getPurchaseWeights(formData);
    if (purchaseWeights.error) return res.status(400).json({ message: purchaseWeights.error });

    const calculatedTotals = calculatePurchaseTotals(formData, items, deductions);
 
    const rawGodown = formData.godown || formData.godown_id || '';
    let resolvedGodownId = null;
    let resolvedGodownName = '';
    let isColdStorage = false;

    if (rawGodown) {
      try {
        const gRes = await db.query(
          `SELECT id, godown_name, godown_type, storage_location FROM godown_master 
           WHERE id = ? OR CAST(id AS TEXT) = ? OR LOWER(godown_name) = LOWER(?) LIMIT 1`,
          [rawGodown, String(rawGodown), String(rawGodown)]
        );
        if (gRes.rows && gRes.rows.length > 0) {
          resolvedGodownId = gRes.rows[0].id;
          resolvedGodownName = gRes.rows[0].godown_name;
          const gType = (gRes.rows[0].godown_type || '').toLowerCase();
          const sLoc = (gRes.rows[0].storage_location || '').toLowerCase();
          const gName = resolvedGodownName.toLowerCase();
          isColdStorage = gType.includes('cold') || sLoc.includes('outside') || gName.includes('cold');
        } else {
          resolvedGodownName = rawGodown;
        }
      } catch (gErr) {
        resolvedGodownName = rawGodown;
      }
    }
    if (!resolvedGodownName) {
      try {
        const defG = await db.query(`SELECT id, godown_name FROM godown_master ORDER BY id ASC LIMIT 1`);
        if (defG.rows && defG.rows.length > 0) {
          resolvedGodownId = defG.rows[0].id;
          resolvedGodownName = defG.rows[0].godown_name;
        }
      } catch (_) {}
      if (!resolvedGodownName) resolvedGodownName = 'Main Godown';
    }

    const grossWt = purchaseWeights.grossWeight;
    const tareWt = purchaseWeights.tareWeight;
    const netWt = purchaseWeights.netWeight;
    const stockType = formData.stock_type || formData.stockType || 'RM';
    const transporterVal = formData.transporter || formData.transport || '';
    const vehicleNoVal = formData.vehicle_no || formData.lorry_no || '';
    const driverNameVal = formData.driver_name || formData.driver || '';

    const insertValues = [
      parseInt(formData.sno) || 1,
      formData.date || new Date().toISOString().slice(0, 10),
      formData.invNo || formData.inv_no || '',
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
      formData.tax_percent !== undefined ? formData.tax_percent : (formData.tax_rate || 0),
      resolvedGodownName,
      resolvedGodownId,
      formData.remarks || '',
      calculatedTotals.totalQty,
      calculatedTotals.totalWeight,
      Number(calculatedTotals.items.reduce((sum, item) => sum + item.classifiedAmount, 0).toFixed(2)),
      calculatedTotals.grossAmount,
      calculatedTotals.discAmount,
      calculatedTotals.taxAmount,
      calculatedTotals.netAmount,
      Number((calculatedTotals.grandTotal - calculatedTotals.netAmount).toFixed(2)),
      calculatedTotals.grandTotal,
      grossWt,
      tareWt,
      netWt,
      stockType,
      transporterVal,
      transporterVal,
      vehicleNoVal,
      vehicleNoVal,
      driverNameVal,
      formData.company_state || formData.companyState || 'Tamil Nadu',
      formData.supplier_state || formData.party_state || 'Tamil Nadu',
      formData.company_state_code || '33',
      formData.supplier_state_code || formData.party_state_code || '33',
      formData.tax_mode || formData.taxType || formData.tax_type || 'Exclusive',
      calculatedTotals.cgstAmount,
      calculatedTotals.sgstAmount,
      calculatedTotals.igstAmount,
      calculatedTotals.cessAmount
    ];
 
    const purchaseResult = await db.run(`
      INSERT INTO purchases (
        s_no, date, inv_no, supplier, pay_type, inv_date, type, contact_person, address, area, phone, gst_no, email, tax_type, tax_percent, godown, godown_id, remarks, total_qty, total_weight, total_amount, base_amount, disc_amount, tax_amount, net_amount, deduction_amount, grand_total,
        gross_weight, tare_weight, net_weight, stock_type, transporter, transport, vehicle_no, lorry_no, driver_name,
        company_state, party_state, company_state_code, party_state_code, tax_mode, cgst_amount, sgst_amount, igst_amount, cess_amount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, insertValues)
 
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
 
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);

    for (const item of items) {
      const qty = parseFloat(item.qty) || 0
      const rate = parseFloat(item.rate) || 0
      const discPercent = parseFloat(item.disc_percent) || 0
      const taxPercent = parseFloat(item.gst_rate ?? item.tax_rate ?? item.tax_percent) || 0
      const perUnitWeight = parseFloat(item.per_unit_weight) || 0
      const totalWt = Number((parseFloat(item.total_weight) || qty * perUnitWeight).toFixed(3));

      const lineTax = calculateLineTax({
        qty,
        rate,
        discPercent,
        taxType: item.tax_type || item.taxType,
        taxMode: formData.tax_mode || formData.taxType || formData.tax_type || 'Exclusive',
        gstRate: taxPercent,
        cessRate: item.cess_rate || 0,
        hsnCode: item.hsn_code || '',
        companyState: formData.company_state || formData.companyState || 'Tamil Nadu',
        partyState: formData.supplier_state || formData.party_state || 'Tamil Nadu',
        companyStateCode: formData.company_state_code || '33',
        partyStateCode: formData.supplier_state_code || formData.party_state_code
      });
      const discountAmount = lineTax.discAmount;
      const lineAmount = lineTax.classifiedAmount;

      let lotNo = item.lot_no || item.lotNo || '';
      if (!lotNo) {
        lotNo = await reserveNextLotNumber(activeCompanyId);
      } else {
        await recordLotNumber(lotNo, activeCompanyId);
      }

      console.log(`[LOT-GEN] Item: ${item.item_name}, Lot: "${lotNo}"`)
 
      await db.run(`
        INSERT INTO purchase_items (
          purchase_id, item_id, item_name, lot_no, per_unit_weight, qty, total_weight, rate,
          disc_percent, disc_amount, tax_percent, tax_amount, amount, hsn_code, tax_type, gst_rate,
          cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount, cess_rate, cess_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        purchaseId, item.item_id, item.item_name, lotNo, perUnitWeight, qty, totalWt,
        rate, discPercent, discountAmount, lineTax.gstRate, lineTax.totalTax, lineAmount,
        lineTax.hsnCode, lineTax.taxType, lineTax.gstRate,
        lineTax.cgstRate, lineTax.cgstAmount, lineTax.sgstRate, lineTax.sgstAmount,
        lineTax.igstRate, lineTax.igstAmount, lineTax.cessRate, lineTax.cessAmount
      ])
 
      // Resolve item_id if not numeric
      let itemId = item.item_id
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
 
      // Insert into stock_lots with accurate godown
      await db.run(`
        INSERT INTO stock_lots (godown_id, godown_name, item_id, item_name, lot_no, purchase_id, quantity, remaining_quantity, rate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [resolvedGodownId, resolvedGodownName, itemId, item.item_name, lotNo, purchaseId, qty, qty, rate])
 
      // Insert into stock with accurate godown
      await db.run(`
        INSERT INTO stock (date, item_id, item_name, lot_no, qty, weight, rate, amount, type, reference_id, godown, godown_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Purchase', ?, ?, ?)
      `, [formData.date, itemId, item.item_name, lotNo, qty, totalWt, rate, Number(lineAmount.toFixed(2)), purchaseId, resolvedGodownName, resolvedGodownId])
    }

    // If destination godown is a Cold Storage, automatically generate Cold Storage IN (CSI) voucher
    if (isColdStorage) {
      try {
        let supplierName = '';
        if (formData.supplier) {
          try {
            const sRes = await db.query(
              `SELECT name FROM supplier_master WHERE id = ? OR CAST(id AS TEXT) = ? OR name = ? LIMIT 1`,
              [formData.supplier, String(formData.supplier), String(formData.supplier)]
            );
            if (sRes.rows && sRes.rows.length > 0) {
              supplierName = sRes.rows[0].name;
            }
          } catch (_) {}
        }

        let nextVoucherNo = 'CSI-000001';
        try {
          const csVRes = await db.query(`SELECT voucher_no FROM cold_storage_vouchers WHERE voucher_type = 'IN' ORDER BY id DESC LIMIT 1`);
          if (csVRes.rows && csVRes.rows.length > 0) {
            const num = parseInt(String(csVRes.rows[0].voucher_no || '').replace(/\D/g, ''), 10);
            if (!isNaN(num)) {
              nextVoucherNo = `CSI-${String(num + 1).padStart(6, '0')}`;
            }
          }
        } catch (_) {}

        const csVoucherRes = await db.run(`
          INSERT INTO cold_storage_vouchers 
          (voucher_no, voucher_type, voucher_date, cold_storage_id, cold_storage_name, source_godown_id, source_godown_name, remarks, total_qty, total_wt, created_by)
          VALUES (?, 'IN', ?, ?, ?, NULL, ?, ?, ?, ?, ?)
        `, [
          nextVoucherNo,
          formData.date || new Date().toISOString().slice(0, 10),
          resolvedGodownId,
          resolvedGodownName,
          supplierName ? `Direct Inward - Supplier: ${supplierName}` : 'Direct Purchase Inward',
          `Auto-inward from Purchase #${formData.invNo || formData.inv_no || purchaseId}${supplierName ? ` | Supplier: ${supplierName}` : ''}`,
          calculatedTotals.totalQty,
          calculatedTotals.totalWeight,
          formData.createdBy || 'System / Purchase Auto-Inward'
        ]);

        const csVoucherId = csVoucherRes.lastID;

        // Fetch inserted purchase items to get generated lot numbers
        const pItemsRes = await db.query(`SELECT * FROM purchase_items WHERE purchase_id = ?`, [purchaseId]);
        for (const pIt of (pItemsRes.rows || [])) {
          const pLot = pIt.lot_no || 'LOT-GEN';
          const csLot = (pLot && pLot.startsWith('CS-')) ? pLot : `CS-${pLot}`;
          const qty = parseFloat(pIt.qty) || 0;
          const wt = parseFloat(pIt.per_unit_weight) || 50;
          const totWt = parseFloat(pIt.total_weight) || (qty * wt);

          await db.run(`
            INSERT INTO cold_storage_items 
            (voucher_id, voucher_no, item_id, item_name, purchase_lot_no, cold_storage_lot_no, quantity, weight, total_wt, unit, remarks)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            csVoucherId,
            nextVoucherNo,
            pIt.item_id || null,
            pIt.item_name,
            pLot,
            csLot,
            qty,
            wt,
            totWt,
            'KG',
            `Auto from Purchase #${formData.invNo || formData.inv_no || purchaseId}`
          ]);
        }
        console.log(`[COLD-STORAGE] Automatically created CSI Voucher ${nextVoucherNo} for Purchase #${purchaseId} in ${resolvedGodownName}`);
      } catch (csErr) {
        console.error('Error auto-creating Cold Storage voucher for purchase:', csErr.message);
      }
    }
 
    // Insert purchase deductions
    for (const ded of (deductions || [])) {
      await db.run(`
        INSERT INTO purchase_deductions (
          purchase_id, deduction_id, deduction_name, type, calculation_type, percentage, amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        purchaseId, ded.deduction_id, ded.deduction_name, ded.type, ded.calculation_type, ded.percentage, ded.amount
      ])
    }
 
    // Create ledger entries
    try {
      await createPurchaseLedgerEntries({
        supplier: formData.supplier,
        date: formData.date,
        invNo: formData.invNo || formData.inv_no || '',
        purchaseId: purchaseId,
        baseAmount: calculatedTotals.grossAmount,
        taxAmount: calculatedTotals.taxAmount,
        discAmount: calculatedTotals.discAmount,
        netAmount: calculatedTotals.grandTotal
      })
      console.log('Ledger entries created for purchase:', purchaseId)
    } catch (ledgerError) {
      console.error('Error creating ledger entries:', ledgerError)
    }
 
    try {
      await rebuildStockLedger();
    } catch (e) {
      console.error('Error rebuilding stock after purchase:', e);
    }

    // Create linked operational charges if provided in request
    if (Array.isArray(req.body.operational_charges) && req.body.operational_charges.length > 0) {
      const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
      const engine = require('../services/operationalChargeEngine');
      for (const ch of req.body.operational_charges) {
        try {
          await engine.createOperationalCharge(activeCompanyId, {
            ...ch,
            source_module: 'PURCHASE',
            source_transaction_type: 'PURCHASE',
            source_transaction_id: purchaseId,
            source_transaction_no: formData.invNo || formData.inv_no || `PUR-${purchaseId}`,
            charge_date: formData.date || new Date().toISOString().slice(0, 10),
            item_name: items[0]?.item_name || 'Raw Material',
            lot_no: items[0]?.lot_no || '',
            from_location: formData.supplier || 'Supplier Facility',
            to_location: resolvedGodownName || 'Main Godown',
            vehicle_no: ch.vehicle_no || formData.lorry_no || formData.vehicle_no || '',
            driver_name: ch.driver_name || formData.driver || '',
            quantity: ch.quantity !== undefined ? ch.quantity : calculatedTotals.totalWeight
          });
        } catch (chErr) {
          console.warn('[Purchase Operational Charge Error]:', chErr.message);
        }
      }
    }

    // Trigger Central Notification & WhatsApp Alert
    try {
      const { triggerTransactionNotification } = require('../utils/transactionNotifier');
      const invNum = formData.invNo || formData.inv_no || `PUR-${purchaseId}`;
      await triggerTransactionNotification({
        moduleName: 'PURCHASE',
        referenceNo: invNum,
        title: `🔵 BVC ERP – New Purchase Arrived`,
        message: `Purchase invoice ${invNum} from supplier ${formData.supplier || 'N/A'} successfully loaded into ${resolvedGodownName}. Total Weight: ${calculatedTotals.totalWeight.toLocaleString()} KG, Amount: ₹${calculatedTotals.grandTotal.toLocaleString()}.`,
        severity: 'INFO',
        referenceId: purchaseId,
        companyId: req.companyId || 1
      });
    } catch (notifErr) {
      console.warn('Error triggering purchase notification:', notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Purchase saved successfully!',
      id: purchaseId
    })
  } catch (error) {
    console.error('Error saving purchase:', error)
    res.status(500).json({ success: false, message: 'Error saving purchase', error: error.message })
  }
})
 
// PUT update purchase
router.put('/:id', async (req, res) => {
  try {
    const { formData, items, deductions } = req.body
    const routeId = String(req.params.id || '');
    let purchaseId = routeId;
    const purchaseById = await db.query('SELECT id FROM purchases WHERE CAST(id AS TEXT) = ? LIMIT 1', [routeId]);
    if (purchaseById.rows?.length) {
      purchaseId = purchaseById.rows[0].id;
    } else {
      const purchaseByReference = await db.query(
        'SELECT id FROM purchases WHERE CAST(s_no AS TEXT) = ? OR inv_no = ? LIMIT 1',
        [routeId, routeId]
      );
      if (!purchaseByReference.rows?.length) {
        return res.status(404).json({ success: false, message: 'Purchase not found' });
      }
      purchaseId = purchaseByReference.rows[0].id;
    }
    if (!formData || !formData.date || !formData.supplier) {
      return res.status(400).json({ message: 'Purchase details and at least one item are required' });
    }
    const lineValidationError = validatePurchaseLines(items, deductions);
    if (lineValidationError) return res.status(400).json({ message: lineValidationError });
    const purchaseWeights = getPurchaseWeights(formData);
    if (purchaseWeights.error) return res.status(400).json({ message: purchaseWeights.error });
    const calculatedTotals = calculatePurchaseTotals(formData, items, deductions);

    const rawGodown = formData.godown || formData.godown_id || '';
    let resolvedGodownId = null;
    let resolvedGodownName = '';
    let isColdStorage = false;

    if (rawGodown) {
      try {
        const gRes = await db.query(
          `SELECT id, godown_name, godown_type, storage_location FROM godown_master 
           WHERE id = ? OR CAST(id AS TEXT) = ? OR LOWER(godown_name) = LOWER(?) LIMIT 1`,
          [rawGodown, String(rawGodown), String(rawGodown)]
        );
        if (gRes.rows && gRes.rows.length > 0) {
          resolvedGodownId = gRes.rows[0].id;
          resolvedGodownName = gRes.rows[0].godown_name;
          const gType = (gRes.rows[0].godown_type || '').toLowerCase();
          const sLoc = (gRes.rows[0].storage_location || '').toLowerCase();
          const gName = resolvedGodownName.toLowerCase();
          isColdStorage = gType.includes('cold') || sLoc.includes('outside') || gName.includes('cold');
        } else {
          resolvedGodownName = rawGodown;
        }
      } catch (gErr) {
        resolvedGodownName = rawGodown;
      }
    }
    if (!resolvedGodownName) {
      try {
        const defG = await db.query(`SELECT id, godown_name FROM godown_master ORDER BY id ASC LIMIT 1`);
        if (defG.rows && defG.rows.length > 0) {
          resolvedGodownId = defG.rows[0].id;
          resolvedGodownName = defG.rows[0].godown_name;
        }
      } catch (_) {}
      if (!resolvedGodownName) resolvedGodownName = 'Main Godown';
    }
 
    const grossWt = purchaseWeights.grossWeight;
    const tareWt = purchaseWeights.tareWeight;
    const netWt = purchaseWeights.netWeight;
    const stockType = formData.stock_type || formData.stockType || 'RM';
    const transporterVal = formData.transporter || formData.transport || '';
    const vehicleNoVal = formData.vehicle_no || formData.lorry_no || '';
    const driverNameVal = formData.driver_name || formData.driver || '';

    const purchaseUpdate = await db.run(`
      UPDATE purchases SET
        s_no = ?, date = ?, inv_no = ?, supplier = ?, pay_type = ?,
        inv_date = ?, type = ?, contact_person = ?, address = ?, area = ?, phone = ?, gst_no = ?, email = ?, tax_type = ?, tax_percent = ?, godown = ?, godown_id = ?,
        remarks = ?, total_qty = ?, total_weight = ?, total_amount = ?,
        base_amount = ?, disc_amount = ?, tax_amount = ?, net_amount = ?,
        deduction_amount = ?, grand_total = ?,
        gross_weight = ?, tare_weight = ?, net_weight = ?, stock_type = ?,
        transporter = ?, transport = ?, vehicle_no = ?, lorry_no = ?, driver_name = ?,
        company_state = ?, party_state = ?, company_state_code = ?, party_state_code = ?, tax_mode = ?,
        cgst_amount = ?, sgst_amount = ?, igst_amount = ?, cess_amount = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      formData.sno || formData.s_no, formData.date, formData.invNo || formData.inv_no, formData.supplier || formData.supplier_id, formData.payType || formData.pay_type,
      formData.invDate || formData.inv_date, formData.type, formData.contact_person, formData.address, formData.area, formData.phone, formData.gst_no, formData.email,
      formData.taxType || formData.tax_type, formData.tax_percent !== undefined ? formData.tax_percent : (formData.tax_rate || 0), resolvedGodownName, resolvedGodownId,
      formData.remarks, calculatedTotals.totalQty, calculatedTotals.totalWeight,
      Number(calculatedTotals.items.reduce((sum, item) => sum + item.classifiedAmount, 0).toFixed(2)),
      calculatedTotals.grossAmount, calculatedTotals.discAmount, calculatedTotals.taxAmount, calculatedTotals.netAmount,
      Number((calculatedTotals.grandTotal - calculatedTotals.netAmount).toFixed(2)), calculatedTotals.grandTotal,
      grossWt, tareWt, netWt, stockType,
      transporterVal, transporterVal, vehicleNoVal, vehicleNoVal, driverNameVal,
      formData.company_state || formData.companyState || 'Tamil Nadu',
      formData.supplier_state || formData.party_state || 'Tamil Nadu',
      formData.company_state_code || '33',
      formData.supplier_state_code || formData.party_state_code || '33',
      formData.tax_mode || formData.taxType || formData.tax_type || 'Exclusive',
      calculatedTotals.cgstAmount,
      calculatedTotals.sgstAmount,
      calculatedTotals.igstAmount,
      calculatedTotals.cessAmount,
      purchaseId
    ])
    if (purchaseUpdate?.changes === 0) {
      return res.status(404).json({ success: false, message: 'Purchase was not updated because it no longer exists' });
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

    // Delete existing items and stock entries
    await db.run('DELETE FROM stock_lots WHERE purchase_id = ?', [purchaseId]);
    await db.run('DELETE FROM stock WHERE reference_id = ? AND type = ?', [purchaseId, 'Purchase']);
    await db.run('DELETE FROM purchase_items WHERE purchase_id = ?', [purchaseId])
    await db.run('DELETE FROM purchase_deductions WHERE purchase_id = ?', [purchaseId]);
 
    // Get highest existing lot number
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);

    for (const item of items) {
      const qty = parseFloat(item.qty) || 0
      const rate = parseFloat(item.rate) || 0
      const discPercent = parseFloat(item.disc_percent) || 0
      const taxPercent = parseFloat(item.tax_percent ?? item.tax_rate ?? item.gst_rate) || 0
      const perUnitWeight = parseFloat(item.per_unit_weight) || 0
      const totalWt = parseFloat(item.total_weight || qty * perUnitWeight) || qty * perUnitWeight

      const lineTax = calculateLineTax({
        qty,
        rate,
        discPercent,
        taxType: item.tax_type || item.taxType,
        taxMode: formData.tax_mode || formData.taxType || formData.tax_type || 'Exclusive',
        gstRate: taxPercent,
        cessRate: item.cess_rate || 0,
        hsnCode: item.hsn_code || '',
        companyState: formData.company_state || formData.companyState || 'Tamil Nadu',
        partyState: formData.supplier_state || formData.party_state || 'Tamil Nadu',
        companyStateCode: formData.company_state_code || '33',
        partyStateCode: formData.supplier_state_code || formData.party_state_code
      });
      const discountAmount = lineTax.discAmount;
      const lineAmount = lineTax.classifiedAmount;

      let lotNo = item.lot_no || item.lotNo || '';
      if (!lotNo) {
        lotNo = await reserveNextLotNumber(activeCompanyId);
      } else {
        await recordLotNumber(lotNo, activeCompanyId);
      }
 
      await db.run(`
        INSERT INTO purchase_items (
          purchase_id, item_id, item_name, lot_no, per_unit_weight, qty, total_weight, rate,
          disc_percent, disc_amount, tax_percent, tax_amount, amount, hsn_code, tax_type, gst_rate,
          cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount, cess_rate, cess_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        purchaseId, item.item_id, item.item_name, lotNo, perUnitWeight, qty, totalWt,
        rate, discPercent, discountAmount, lineTax.gstRate, lineTax.totalTax, lineAmount,
        lineTax.hsnCode, lineTax.taxType, lineTax.gstRate,
        lineTax.cgstRate, lineTax.cgstAmount, lineTax.sgstRate, lineTax.sgstAmount,
        lineTax.igstRate, lineTax.igstAmount, lineTax.cessRate, lineTax.cessAmount
      ])
 
      let itemId = item.item_id
      if (isNaN(parseInt(itemId))) {
        try {
          const itemResult = await db.query('SELECT id FROM item_master WHERE item_name = ?', [item.item_name])
          if (itemResult.rows.length > 0) itemId = itemResult.rows[0].id
        } catch (e) {
          console.log('Item not found in master:', item.item_name)
        }
      }
 
      await db.run(`
        INSERT INTO stock_lots (godown_id, godown_name, item_id, item_name, lot_no, purchase_id, quantity, remaining_quantity, rate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [resolvedGodownId, resolvedGodownName, itemId, item.item_name, lotNo, purchaseId, qty, qty, rate])

      // Re-apply preserved status if this lot number already existed
      const key = lotNo.toUpperCase();
      if (preservedStatuses[key]) {
        const p = preservedStatuses[key];
        try {
          await db.run(`
            UPDATE stock_lots SET 
              qc_status = ?, unloading_status = ?, godown_id = ?, godown_name = ?,
              usable_for_production = ?, approval_status = ?, approval_date = ?
            WHERE purchase_id = ? AND lot_no = ?
          `, [
            p.qc_status || 'QC_PENDING',
            p.unloading_status || 'PENDING_DECISION',
            p.godown_id || resolvedGodownId,
            p.godown_name || resolvedGodownName,
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
        INSERT INTO stock (date, item_id, item_name, lot_no, qty, weight, rate, amount, type, reference_id, godown, godown_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Purchase', ?, ?, ?)
      `, [formData.date, itemId, item.item_name, lotNo, qty, totalWt, rate, Number(lineAmount.toFixed(2)), purchaseId, resolvedGodownName, resolvedGodownId])
    }

    // If destination godown is a Cold Storage, automatically generate or update Cold Storage IN (CSI) voucher
    if (isColdStorage) {
      try {
        let supplierName = '';
        if (formData.supplier || formData.supplier_id) {
          try {
            const sSup = formData.supplier || formData.supplier_id;
            const sRes = await db.query(
              `SELECT name FROM supplier_master WHERE id = ? OR CAST(id AS TEXT) = ? OR name = ? LIMIT 1`,
              [sSup, String(sSup), String(sSup)]
            );
            if (sRes.rows && sRes.rows.length > 0) {
              supplierName = sRes.rows[0].name;
            }
          } catch (_) {}
        }

        // Check if CSI voucher already exists for this purchase
        const existingCsV = await db.query(
          `SELECT id, voucher_no FROM cold_storage_vouchers WHERE remarks LIKE ? OR remarks LIKE ? LIMIT 1`,
          [`%Purchase #${purchaseId}%`, `%Purchase #${formData.invNo || formData.inv_no}%`]
        );

        let csVoucherId = existingCsV.rows?.[0]?.id;
        let csVoucherNo = existingCsV.rows?.[0]?.voucher_no;

        if (!csVoucherId) {
          csVoucherNo = 'CSI-000001';
          try {
            const csVRes = await db.query(`SELECT voucher_no FROM cold_storage_vouchers WHERE voucher_type = 'IN' ORDER BY id DESC LIMIT 1`);
            if (csVRes.rows && csVRes.rows.length > 0) {
              const num = parseInt(String(csVRes.rows[0].voucher_no || '').replace(/\D/g, ''), 10);
              if (!isNaN(num)) {
                csVoucherNo = `CSI-${String(num + 1).padStart(6, '0')}`;
              }
            }
          } catch (_) {}

          const csVoucherRes = await db.run(`
            INSERT INTO cold_storage_vouchers 
            (voucher_no, voucher_type, voucher_date, cold_storage_id, cold_storage_name, source_godown_id, source_godown_name, remarks, total_qty, total_wt, created_by)
            VALUES (?, 'IN', ?, ?, ?, NULL, ?, ?, ?, ?, ?)
          `, [
            csVoucherNo,
            formData.date || new Date().toISOString().slice(0, 10),
            resolvedGodownId,
            resolvedGodownName,
            supplierName ? `Direct Inward - Supplier: ${supplierName}` : 'Direct Purchase Inward',
            `Auto-inward from Purchase #${formData.invNo || formData.inv_no || purchaseId}${supplierName ? ` | Supplier: ${supplierName}` : ''}`,
            calculatedTotals.totalQty,
            calculatedTotals.totalWeight,
            formData.createdBy || 'System / Purchase Auto-Inward'
          ]);
          csVoucherId = csVoucherRes.lastID;
        } else {
          await db.run(`
            UPDATE cold_storage_vouchers SET
              voucher_date = ?, cold_storage_id = ?, cold_storage_name = ?,
              total_qty = ?, total_wt = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [
            formData.date || new Date().toISOString().slice(0, 10),
            resolvedGodownId,
            resolvedGodownName,
            calculatedTotals.totalQty,
            calculatedTotals.totalWeight,
            csVoucherId
          ]);
          await db.run(`DELETE FROM cold_storage_items WHERE voucher_id = ?`, [csVoucherId]);
        }

        const pItemsRes = await db.query(`SELECT * FROM purchase_items WHERE purchase_id = ?`, [purchaseId]);
        for (const pIt of (pItemsRes.rows || [])) {
          const pLot = pIt.lot_no || 'LOT-GEN';
          const csLot = (pLot && pLot.startsWith('CS-')) ? pLot : `CS-${pLot}`;
          const qty = parseFloat(pIt.qty) || 0;
          const wt = parseFloat(pIt.per_unit_weight) || 50;
          const totWt = parseFloat(pIt.total_weight) || (qty * wt);

          await db.run(`
            INSERT INTO cold_storage_items 
            (voucher_id, voucher_no, item_id, item_name, purchase_lot_no, cold_storage_lot_no, quantity, weight, total_wt, unit, remarks)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            csVoucherId,
            csVoucherNo,
            pIt.item_id || null,
            pIt.item_name,
            pLot,
            csLot,
            qty,
            wt,
            totWt,
            'KG',
            `Auto from Purchase #${formData.invNo || formData.inv_no || purchaseId}`
          ]);
        }
      } catch (csErr) {
        console.error('Error auto-managing Cold Storage voucher on update purchase:', csErr.message);
      }
    }
 
    for (const ded of (deductions || [])) {
      await db.run(`
        INSERT INTO purchase_deductions (purchase_id, deduction_id, deduction_name, type, calculation_type, percentage, amount)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [purchaseId, ded.deduction_id, ded.deduction_name, ded.type, ded.calculation_type, ded.percentage, ded.amount])
    }
 
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
        message: `Cannot delete purchase - lots have been used in Grind (Flour Out) records. Please delete Grind records first. Reference: ${flourCheck.rows[0]?.s_no || 'Multiple'}`
      })
    }
 
    await db.run('DELETE FROM stock_lots WHERE purchase_id = ?', [purchaseId])
    await db.run('DELETE FROM stock WHERE reference_id = ? AND type = ?', [purchaseId, 'Purchase'])

    try {
      await deleteLedgerEntries(purchaseId)
    } catch (ledgerError) {
      console.error('Error deleting purchase ledger entries:', ledgerError)
    }
 
    await db.run('DELETE FROM purchase_deductions WHERE purchase_id = ?', [purchaseId]);
    await db.run('DELETE FROM purchase_items WHERE purchase_id = ?', [purchaseId])
    await db.run('DELETE FROM purchases WHERE id = ?', [purchaseId])

    try {
      await rebuildStockLedger();
    } catch (e) {
      console.error('Error rebuilding stock after deleting purchase:', e);
    }

    res.json({ message: 'Purchase deleted successfully' })
  } catch (error) {
    console.error('Error deleting purchase:', error)
    res.status(500).json({ message: 'Error deleting purchase', error: error.message })
  }
});
 
// GET operational charges for a purchase
router.get('/:id/charges', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const engine = require('../services/operationalChargeEngine');
    const result = await engine.getOperationalTraceability(activeCompanyId, {
      sourceModule: 'PURCHASE',
      sourceTransactionId: req.params.id
    });
    res.json({ success: true, charges: result.charges || [], traceability: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
 