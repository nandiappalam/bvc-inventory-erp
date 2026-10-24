const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { rebuildStockLedger } = require('../utils/stockRebuilder');
const recycleBinService = require('../services/RecycleBinService');
const { calculateStorageDays, calculateSlabStorageCharge, calculateLabourCharge, getColdStorageTariff, calculateBill, createOrUpdateColdStorageBill } = require('../services/ColdStorageBillingService');
const { syncGodownTransfersToColdStorage } = require('../services/coldStorageTransferSync');

const { ensureColdStorageSchema } = require('../utils/coldStorageSchema');

// Middleware to guarantee cold storage tables & columns exist for every request's active company
router.use(async (req, res, next) => {
  try {
    const cId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    await ensureColdStorageSchema(cId);
  } catch (err) {
    console.warn('[coldStorage] Schema verification notice:', err.message);
  }
  next();
});

// Initialize cold storage tables on startup
const initTables = async () => {
  try {
    await ensureColdStorageSchema(1);
  } catch (err) {
    console.error('Error initializing cold storage tables:', err.message);
  }
};
initTables();

// Ensure all cold storage transfers reflect in the stock table for reports and ledgers
const syncColdStorageStock = async (dbInstance = db, companyId = 1) => {
  try {
    const cId = parseInt(companyId, 10) || 1;
    const coldLots = await db.query(`
      SELECT sl.*, p.date as pur_date, p.inv_no, g.id as g_id, g.godown_name as g_name
      FROM stock_lots sl
      LEFT JOIN purchases p ON sl.purchase_id = p.id
      LEFT JOIN godown_master g ON sl.godown_id = g.id OR LOWER(sl.godown_name) = LOWER(g.godown_name)
      WHERE (
        LOWER(COALESCE(sl.godown_name, '')) LIKE '%cold%'
        OR sl.godown_id = 2
        OR LOWER(COALESCE(g.godown_type, '')) LIKE '%cold%'
        OR LOWER(COALESCE(g.storage_location, '')) LIKE '%outside%'
      )
        AND UPPER(COALESCE(sl.lot_no, '')) NOT LIKE 'CS-%'
    `, [], cId);

    const sourceLots = (coldLots.rows || []).filter(lot => !String(lot.lot_no || '').toUpperCase().startsWith('CS-'));

    for (const lot of sourceLots) {
      const lotNo = lot.lot_no;
      if (!lotNo) continue;

      const existingCs = await db.query(`
        SELECT csi.id FROM cold_storage_items csi 
        WHERE UPPER(TRIM(csi.purchase_lot_no)) = UPPER(TRIM(?))
           OR UPPER(TRIM(csi.cold_storage_lot_no)) = UPPER(TRIM(?))
           OR UPPER(TRIM(csi.cold_storage_lot_no)) = UPPER(TRIM(?))
      `, [lotNo, lotNo, `CS-${lotNo}`], cId);

      if (!existingCs.rows || existingCs.rows.length === 0) {
        let gId = lot.godown_id || lot.g_id || 2;
        let gName = lot.godown_name || lot.g_name || 'BTS Cold Storage';

        let nextVoucherNo = 'CSI-000001';
        try {
          const csVRes = await db.query(`SELECT voucher_no FROM cold_storage_vouchers WHERE voucher_type = 'IN' ORDER BY id DESC LIMIT 1`, [], cId);
          if (csVRes.rows && csVRes.rows.length > 0) {
            const num = parseInt(String(csVRes.rows[0].voucher_no || '').replace(/\D/g, ''), 10);
            if (!isNaN(num)) nextVoucherNo = `CSI-${String(num + 1).padStart(6, '0')}`;
          }
        } catch (_) {}

        const csVoucherRes = await db.run(`
          INSERT INTO cold_storage_vouchers 
          (voucher_no, voucher_type, voucher_date, cold_storage_id, cold_storage_name, source_godown_id, source_godown_name, remarks, total_qty, total_wt, created_by)
          VALUES (?, 'IN', ?, ?, ?, NULL, NULL, ?, ?, ?, ?)
        `, [
          nextVoucherNo,
          lot.pur_date || new Date().toISOString().slice(0, 10),
          gId,
          gName,
          `Auto-sync from Stock Lot ${lotNo}`,
          parseFloat(lot.quantity || lot.remaining_quantity) || 0,
          (parseFloat(lot.quantity || lot.remaining_quantity) || 0) * 50,
          'System / Auto-Sync Cold Storage'
        ], cId);

        const csVoucherId = csVoucherRes.lastID || csVoucherRes.lastInsertRowid;
        const csLot = lotNo.startsWith('CS-') ? lotNo : `CS-${lotNo}`;

        await db.run(`
          INSERT INTO cold_storage_items 
          (voucher_id, voucher_no, item_id, item_name, purchase_lot_no, cold_storage_lot_no, quantity, weight, total_wt, unit, remarks)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          csVoucherId,
          nextVoucherNo,
          lot.item_id || null,
          lot.item_name || 'Material',
          lotNo,
          csLot,
          parseFloat(lot.quantity || lot.remaining_quantity) || 0,
          50,
          (parseFloat(lot.quantity || lot.remaining_quantity) || 0) * 50,
          'KG',
          `Auto-synced from Stock Lot ${lotNo}`
        ], cId);
      }
    }

    await rebuildStockLedger();
  } catch (err) {
    console.warn('Notice in syncColdStorageStock:', err.message);
  }
};
// Initial sync
setTimeout(() => {
  syncColdStorageStock().catch(e => console.warn('Init sync cold storage stock error:', e.message));
}, 1000);

// Helper: Get next voucher number
const getNextVoucherNo = async (type) => {
  const prefix = type === 'IN' ? 'CSI' : 'CSO';
  try {
    const res = await db.query(
      `SELECT voucher_no FROM cold_storage_vouchers WHERE voucher_type = ? ORDER BY id DESC LIMIT 1`,
      [type]
    );
    let lastNum = 0;
    if (res.rows && res.rows.length > 0) {
      const val = String(res.rows[0].voucher_no || '').replace(/\D/g, '');
      const num = parseInt(val, 10);
      if (!isNaN(num)) lastNum = num;
    }
    const nextNum = String(lastNum + 1).padStart(6, '0');
    return `${prefix}-${nextNum}`;
  } catch (err) {
    return `${prefix}-000001`;
  }
};

// GET next voucher number
router.get('/next-voucher-no', async (req, res) => {
  try {
    const type = (req.query.type || 'IN').toUpperCase();
    const nextNo = await getNextVoucherNo(type);
    res.json({ success: true, voucher_no: nextNo });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET Cold Storage Godowns
router.get('/storages', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT g.*, 
        COALESCE(s.name, g.operator_name, g.external_company) AS resolved_operator_name,
        COALESCE(s.contact_person, g.contact_person) AS resolved_contact_person,
        COALESCE(s.phone_off, s.mobile1, g.phone_off, g.mobile1) AS resolved_phone,
        COALESCE(s.gst_number, g.gst_number) AS resolved_gst
      FROM godown_master g
      LEFT JOIN supplier_master s ON (g.operator_id = s.id OR LOWER(TRIM(g.operator_name)) = LOWER(TRIM(s.name)))
      WHERE (g.godown_type = 'Cold Storage' OR g.storage_location = 'Outside Factory' OR LOWER(g.godown_name) LIKE '%cold%') AND g.status = 'Active'
    `);
    let list = result.rows || [];
    if (list.length === 0) {
      // Fallback if none marked cold storage yet
      const allGodowns = await db.query(`SELECT * FROM godown_master`);
      list = allGodowns.rows || [];
    }
    res.json({ success: true, data: list });
  } catch (err) {
    try {
      // If godown_type or storage_location column does not exist, fallback to select all
      const fallback = await db.query(`SELECT * FROM godown_master`);
      res.json({ success: true, data: fallback.rows || [] });
    } catch (err2) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
});

// GET all Godowns for source/destination selection
router.get('/all-godowns', async (req, res) => {
  try {
    const result = await db.query(`SELECT id, godown_name, print_name, godown_type, storage_location FROM godown_master ORDER BY godown_name ASC`);
    res.json({ success: true, data: result.rows || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET active purchase lots for Cold Storage IN
router.get('/available-lots', async (req, res) => {
  try {
    // Get purchase items with available stock safely with COALESCE and standard GROUP BY
    let result;
    try {
      result = await db.query(`
        SELECT 
          pi.item_name,
          pi.lot_no AS purchase_lot_no,
          COALESCE(g.godown_name, p.godown, (SELECT godown_name FROM godown_master ORDER BY id ASC LIMIT 1)) AS current_godown,
          COALESCE(g.id, (SELECT id FROM godown_master ORDER BY id ASC LIMIT 1)) AS current_godown_id,
          SUM(pi.qty) AS purchased_qty,
          SUM(COALESCE(pi.total_wt, pi.qty * COALESCE(pi.weight, 0), pi.qty)) AS total_weight,
          COALESCE(NULLIF(MAX(pi.weight), 0), NULLIF(MAX(pi.per_unit_weight), 0), 1) AS weight,
          COALESCE(NULLIF(MAX(pi.weight), 0), NULLIF(MAX(pi.per_unit_weight), 0), 1) AS per_weight,
          COALESCE(pi.unit, 'KG') AS unit
        FROM purchase_items pi
        LEFT JOIN purchases p ON pi.purchase_id = p.id
        LEFT JOIN godown_master g ON (CAST(p.godown AS TEXT) = CAST(g.id AS TEXT) OR LOWER(TRIM(p.godown)) = LOWER(TRIM(g.godown_name)))
        WHERE pi.lot_no IS NOT NULL AND pi.lot_no != ''
        GROUP BY pi.item_name, pi.lot_no, g.godown_name, p.godown, g.id, pi.unit
        ORDER BY pi.item_name, pi.lot_no
      `);
    } catch (colErr) {
      console.warn('Fallback available-lots query due to schema discrepancy:', colErr.message);
      try {
        result = await db.query(`
          SELECT 
            pi.item_name,
            pi.lot_no AS purchase_lot_no,
            (SELECT godown_name FROM godown_master ORDER BY id ASC LIMIT 1) AS current_godown,
            (SELECT id FROM godown_master ORDER BY id ASC LIMIT 1) AS current_godown_id,
            SUM(pi.qty) AS purchased_qty,
            SUM(pi.qty) AS total_weight,
            1 AS weight,
            1 AS per_weight,
            'KG' AS unit
          FROM purchase_items pi
          WHERE pi.lot_no IS NOT NULL AND pi.lot_no != ''
          GROUP BY pi.item_name, pi.lot_no
          ORDER BY pi.item_name, pi.lot_no
        `);
      } catch (err2) {
        result = { rows: [] };
      }
    }

    // Calculate CS IN quantity for each lot to know how much is already moved
    let csInMap = {};
    try {
      const csInRes = await db.query(`
        SELECT 
          item_name,
          purchase_lot_no,
          SUM(quantity) AS in_qty
        FROM cold_storage_items csi
        JOIN cold_storage_vouchers csv ON csi.voucher_id = csv.id
        WHERE csv.voucher_type = 'IN'
        GROUP BY item_name, purchase_lot_no
      `);

      (csInRes.rows || []).forEach(r => {
        const key = `${r.item_name}_${r.purchase_lot_no}`;
        csInMap[key] = parseFloat(r.in_qty || 0);
      });
    } catch (csErr) {
      console.warn('Notice querying cs_items in available-lots:', csErr.message);
    }

    const items = (result.rows || []).map(r => {
      const key = `${r.item_name}_${r.purchase_lot_no}`;
      const movedToCS = csInMap[key] || 0;
      const total = parseFloat(r.purchased_qty || 0);
      const availInMain = Math.max(0, total - movedToCS);
      const perWt = parseFloat(r.weight || r.per_weight || (r.total_weight && total ? (r.total_weight / total) : 1)) || 1;
      return {
        ...r,
        weight: perWt,
        per_weight: perWt,
        moved_to_cs_qty: movedToCS,
        available_qty: availInMain
      };
    });

    res.json({ success: true, data: items });
  } catch (err) {
    console.error('Error in /available-lots:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET Cold Storage Stock (Lot breakdown in Cold Storages)
router.get('/stock', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    await syncGodownTransfersToColdStorage();
    await syncColdStorageStock(db, activeCompanyId);

    const { cold_storage_id, item_name, search, as_of_date } = req.query;

    let query = `
      SELECT 
        csi.item_name,
        csi.purchase_lot_no,
        csi.cold_storage_lot_no,
        csv.cold_storage_id,
        csv.cold_storage_name,
        SUM(CASE WHEN csv.voucher_type = 'IN' THEN csi.quantity ELSE 0 END) AS in_qty,
        SUM(CASE WHEN csv.voucher_type = 'OUT' THEN csi.quantity ELSE 0 END) AS out_qty,
        SUM(CASE WHEN csv.voucher_type = 'IN' THEN csi.total_wt ELSE 0 END) AS in_wt,
        SUM(CASE WHEN csv.voucher_type = 'OUT' THEN csi.total_wt ELSE 0 END) AS out_wt,
        COALESCE(NULLIF(MAX(csi.weight), 0), 1) AS weight,
        COALESCE(NULLIF(MAX(csi.weight), 0), 1) AS per_weight,
        csi.unit,
        MIN(CASE WHEN csv.voucher_type = 'IN' THEN csv.voucher_date END) AS inward_date,
        MAX(CASE WHEN csv.voucher_type = 'OUT' THEN csv.voucher_date END) AS last_outward_date,
        MAX(COALESCE(csv.chamber_no, 'Chamber 1')) AS chamber_no,
        MAX(csv.operator_name) AS operator_name,
        gm.rate_per_bag,
        gm.rate_per_kg,
        gm.rate_per_ton,
        gm.inward_handling_rate,
        gm.outward_handling_rate,
        gm.insurance_rate,
        gm.mamool_rate,
        gm.gst_rate,
        gm.billing_basis,
        gm.billing_method,
        gm.storage_duration,
        gm.min_billable_days,
        gm.operator_id AS gm_operator_id,
        gm.operator_name AS gm_operator_name
      FROM cold_storage_items csi
      JOIN cold_storage_vouchers csv ON csi.voucher_id = csv.id
      LEFT JOIN godown_master gm ON (gm.id = csv.cold_storage_id OR LOWER(TRIM(gm.godown_name)) = LOWER(TRIM(csv.cold_storage_name)))
      WHERE COALESCE(csv.remarks, '') NOT LIKE 'Auto-sync from Stock Lot CS-%'
    `;
    const params = [];

    if (cold_storage_id) {
      params.push(cold_storage_id);
      query += ` AND (csv.cold_storage_id = ? OR CAST(csv.cold_storage_id AS TEXT) = ?)`;
      params.push(String(cold_storage_id));
    }
    if (item_name) {
      params.push(item_name);
      query += ` AND csi.item_name = ?`;
    }

    query += `
      GROUP BY csi.item_name, csi.purchase_lot_no, csi.cold_storage_lot_no, csv.cold_storage_id, csv.cold_storage_name, csi.unit
      ORDER BY csv.cold_storage_name, csi.item_name, csi.cold_storage_lot_no
    `;

    const result = await db.query(query, params);
    const todayStr = as_of_date || new Date().toISOString().split('T')[0];

    const tariffsCache = {};
    const stockUnfiltered = await Promise.all((result.rows || []).map(async (r) => {
      const inQty = parseFloat(r.in_qty || 0);
      const outQty = parseFloat(r.out_qty || 0);
      const availQty = Math.max(0, inQty - outQty);
      const inWt = parseFloat(r.in_wt || 0);
      const outWt = parseFloat(r.out_wt || 0);
      const availWt = Math.max(0, inWt - outWt);
      const perWt = parseFloat(r.weight || (availQty > 0 ? availWt / availQty : 1)) || 1;

      const csId = r.cold_storage_id || 2;
      if (!tariffsCache[csId]) {
        tariffsCache[csId] = await getColdStorageTariff(csId, activeCompanyId);
      }
      const tariff = tariffsCache[csId];

      // Storage Duration calculation: inclusive calendar days (outward - inward + 1)
      const inDate = r.inward_date || todayStr;
      const endDate = (availQty <= 0 && r.last_outward_date) ? r.last_outward_date : todayStr;
      const { calendarDays, billableDays } = calculateStorageDays(
        inDate,
        endDate,
        tariff.freeDays || r.free_storage_days || 0,
        tariff.minDays || r.min_billable_days || 1
      );

      // Storage charge calculation for the available remaining stock (or total if completely outwarded)
      const calcWeightKg = availQty > 0 ? availWt : inWt;
      const storageCalc = calculateSlabStorageCharge({
        qtyKg: calcWeightKg,
        billableDays,
        slabs: tariff.storageSlabs,
        calculationType: tariff.calculationType
      });
      const accruedRent = storageCalc.totalCharge;

      // Inward Unloading charges (actual kg * rate/kg)
      const inwardLabour = calculateLabourCharge({
        qtyKg: inWt,
        ratePerKg: tariff.inwardUnloadingRate || r.inward_handling_rate || 0.50
      });

      // Outward Loading charges (actual kg * rate/kg)
      const outwardLabour = calculateLabourCharge({
        qtyKg: outWt,
        ratePerKg: tariff.outwardLoadingRate || r.outward_handling_rate || 0.50
      });

      // Daily ongoing storage cost for remaining quantity (e.g. 600kg * Rs 0.20/kg/day = Rs 120/day)
      const firstSlabRate = parseFloat(tariff.storageSlabs[0]?.rate) || 0.20;
      const remainingDailyRate = availWt > 0 ? Number((availWt * firstSlabRate).toFixed(2)) : 0;

      const totalAccrued = accruedRent + inwardLabour.totalCharge + outwardLabour.totalCharge;

      return {
        ...r,
        in_qty: inQty,
        out_qty: outQty,
        available_qty: availQty,
        in_wt: inWt,
        out_wt: outWt,
        available_wt: availWt,
        weight: perWt,
        per_weight: perWt,
        inward_date: inDate,
        last_outward_date: r.last_outward_date || null,
        storage_days: calendarDays,
        billable_days: billableDays,
        billing_method: tariff.calculationType,
        slab_breakdown: storageCalc.breakdown,
        rate_per_kg: firstSlabRate,
        inward_unloading_rate: tariff.inwardUnloadingRate,
        outward_loading_rate: tariff.outwardLoadingRate,
        accrued_storage_cost: Number(accruedRent.toFixed(2)),
        accrued_unloading_cost: inwardLabour.totalCharge,
        accrued_loading_cost: outwardLabour.totalCharge,
        accrued_handling_cost: Number((inwardLabour.totalCharge + outwardLabour.totalCharge).toFixed(2)),
        remaining_daily_rate: remainingDailyRate,
        total_accrued_cost: Number(totalAccrued.toFixed(2)),
        status: availQty > 0 ? 'In Storage' : 'Fully Released',
        operator_name: r.gm_operator_name || r.operator_name || tariff.operatorName || 'AgroCold Services',
        operator_id: r.gm_operator_id || r.operator_id || tariff.operatorId || null,
        chamber_no: r.chamber_no || 'Chamber 1'
      };
    }));

    const stock = stockUnfiltered.filter(r => {
      if (search) {
        const s = search.toLowerCase();
        return (
          r.item_name.toLowerCase().includes(s) ||
          r.purchase_lot_no.toLowerCase().includes(s) ||
          r.cold_storage_lot_no.toLowerCase().includes(s) ||
          r.cold_storage_name.toLowerCase().includes(s) ||
          (r.operator_name && r.operator_name.toLowerCase().includes(s))
        );
      }
      return true;
    });

    res.json({ success: true, data: stock });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET available Cold Storage Lots for a specific Cold Storage (for Cold Storage OUT selection)
router.get('/cs-lots', async (req, res) => {
  try {
    const { cold_storage_id } = req.query;
    if (!cold_storage_id) {
      return res.status(400).json({ success: false, message: 'cold_storage_id is required' });
    }

    const query = `
      SELECT 
        csi.item_name,
        csi.purchase_lot_no,
        csi.cold_storage_lot_no,
        csv.cold_storage_id,
        csv.cold_storage_name,
        MIN(CASE WHEN csv.voucher_type = 'IN' THEN csv.voucher_date END) AS inward_date,
        MIN(CASE WHEN csv.voucher_type = 'IN' THEN csv.voucher_no END) AS inward_voucher_no,
        MIN(CASE WHEN csv.voucher_type = 'IN' THEN csv.purchase_id END) AS purchase_id,
        SUM(CASE WHEN csv.voucher_type = 'IN' THEN csi.quantity ELSE 0 END) AS original_in_qty,
        SUM(CASE WHEN csv.voucher_type = 'IN' THEN csi.total_wt ELSE 0 END) AS original_in_wt,
        SUM(CASE WHEN csv.voucher_type = 'OUT' THEN csi.quantity ELSE 0 END) AS previously_outward_qty,
        SUM(CASE WHEN csv.voucher_type = 'OUT' THEN csi.total_wt ELSE 0 END) AS previously_outward_wt,
        SUM(CASE WHEN csv.voucher_type = 'IN' THEN csi.quantity ELSE 0 END) - 
        SUM(CASE WHEN csv.voucher_type = 'OUT' THEN csi.quantity ELSE 0 END) AS available_qty,
        SUM(CASE WHEN csv.voucher_type = 'IN' THEN csi.total_wt ELSE 0 END) - 
        SUM(CASE WHEN csv.voucher_type = 'OUT' THEN csi.total_wt ELSE 0 END) AS available_wt,
        COALESCE(NULLIF(MAX(csi.weight), 0), 1) AS weight,
        COALESCE(NULLIF(MAX(csi.weight), 0), 1) AS per_weight,
        csi.unit
      FROM cold_storage_items csi
      JOIN cold_storage_vouchers csv ON csi.voucher_id = csv.id
      WHERE (csv.cold_storage_id = ? OR CAST(csv.cold_storage_id AS TEXT) = ?)
        AND COALESCE(csv.remarks, '') NOT LIKE 'Auto-sync from Stock Lot CS-%'
      GROUP BY csi.item_name, csi.purchase_lot_no, csi.cold_storage_lot_no, csv.cold_storage_id, csv.cold_storage_name, csi.unit
      HAVING (SUM(CASE WHEN csv.voucher_type = 'IN' THEN csi.quantity ELSE 0 END) - SUM(CASE WHEN csv.voucher_type = 'OUT' THEN csi.quantity ELSE 0 END)) > 0
      ORDER BY csi.item_name, csi.cold_storage_lot_no
    `;

    const result = await db.query(query, [cold_storage_id, String(cold_storage_id)]);
    const todayStr = new Date().toISOString().split('T')[0];

    const formatted = (result.rows || []).map(r => {
      const availQty = parseFloat(r.available_qty || 0);
      const availWt = parseFloat(r.available_wt || 0);
      const perWt = parseFloat(r.weight || r.per_weight || (availQty > 0 ? (availWt / availQty) : 1)) || 1;
      const inDate = r.inward_date || todayStr;
      const daysInfo = calculateStorageDays(inDate, todayStr, 0, 1);

      return {
        ...r,
        inward_date: inDate,
        storage_days_today: daysInfo.calendarDays,
        original_in_qty: parseFloat(r.original_in_qty || 0),
        original_in_wt: parseFloat(r.original_in_wt || 0),
        previously_outward_qty: parseFloat(r.previously_outward_qty || 0),
        previously_outward_wt: parseFloat(r.previously_outward_wt || 0),
        available_qty: availQty,
        available_wt: availWt,
        weight: perWt,
        per_weight: perWt
      };
    });
    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST Cold Storage IN voucher
router.post('/in', async (req, res) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }
    body = body || {};

    let {
      voucher_date,
      cold_storage_id,
      cold_storage_name,
      source_godown_id,
      source_godown_name,
      remarks,
      items
    } = body;

    // Resolve cold storage name if only ID provided or vice versa
    if (!cold_storage_name && cold_storage_id) {
      try {
        const csRow = await db.query('SELECT godown_name FROM godown_master WHERE id = ?', [cold_storage_id]);
        if (csRow.rows && csRow.rows.length > 0) {
          cold_storage_name = csRow.rows[0].godown_name;
        }
      } catch (e) {}
    }

    if (!cold_storage_id && cold_storage_name) {
      try {
        const csRow = await db.query('SELECT id FROM godown_master WHERE godown_name = ?', [cold_storage_name]);
        if (csRow.rows && csRow.rows.length > 0) {
          cold_storage_id = csRow.rows[0].id;
        }
      } catch (e) {}
    }

    if (!cold_storage_name && !cold_storage_id) {
      return res.status(400).json({ success: false, message: 'Cold Storage location is required' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one item is required' });
    }

    const voucher_no = await getNextVoucherNo('IN');
    let total_qty = 0;
    let total_wt = 0;

    items.forEach(it => {
      total_qty += parseFloat(it.quantity || 0);
      total_wt += parseFloat(it.total_wt || (parseFloat(it.quantity || 0) * parseFloat(it.weight || 1)));
    });

    const createdBy = body.created_by || (req.user && req.user.username) || 'Admin';

    let operator_id = body.operator_id || null;
    let operator_name = body.operator_name || null;
    let inward_source_type = body.inward_source_type || 'Factory Godown';
    let vehicle_no = body.vehicle_no || body.lorry_no || '';
    let driver_name = body.driver_name || '';
    let driver_phone = body.driver_phone || '';
    let transporter_name = body.transporter_name || body.transporter || '';
    let lr_no = body.lr_no || '';
    let lr_date = body.lr_date || null;
    let gate_pass_no = body.gate_pass_no || body.operator_gate_pass || '';
    let chamber_no = body.chamber_no || 'Chamber 1';
    let floor_no = body.floor_no || '';
    let rack_no = body.rack_no || '';
    let handling_rate = parseFloat(body.handling_rate || 0);
    let storage_rate = parseFloat(body.storage_rate || 0);
    let storage_basis = body.storage_basis || 'Per Bag';

    if (cold_storage_id && (!operator_name || handling_rate === 0)) {
      try {
        const gmRow = await db.query('SELECT operator_id, operator_name, inward_handling_rate, rate_per_bag, rate_per_kg, billing_basis, default_chamber FROM godown_master WHERE id = ?', [cold_storage_id]);
        if (gmRow.rows && gmRow.rows.length > 0) {
          const g = gmRow.rows[0];
          if (!operator_id) operator_id = g.operator_id;
          if (!operator_name) operator_name = g.operator_name;
          if (handling_rate === 0) handling_rate = parseFloat(g.inward_handling_rate || 0);
          if (storage_rate === 0) storage_rate = parseFloat(g.rate_per_bag || g.rate_per_kg || 0);
          if (!storage_basis) storage_basis = g.billing_basis || 'Per Bag';
          if (!chamber_no || chamber_no === 'Chamber 1') chamber_no = g.default_chamber || 'Chamber 1';
        }
      } catch (_) {}
    }
    const handling_amount = parseFloat(body.handling_amount || (total_qty * handling_rate));

    const voucherRes = await db.query(`
      INSERT INTO cold_storage_vouchers 
      (voucher_no, voucher_type, voucher_date, cold_storage_id, cold_storage_name, source_godown_id, source_godown_name, remarks, total_qty, total_wt, created_by,
       operator_id, operator_name, inward_source_type, vehicle_no, driver_name, driver_phone, transporter_name, lr_no, lr_date, gate_pass_no, chamber_no, floor_no, rack_no, handling_rate, handling_amount, storage_rate, storage_basis)
      VALUES (?, 'IN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      voucher_no,
      voucher_date || new Date().toISOString().split('T')[0],
      cold_storage_id || null,
      cold_storage_name || 'Cold Storage',
      source_godown_id || null,
      source_godown_name || 'Main Godown',
      remarks || '',
      total_qty,
      total_wt,
      createdBy,
      operator_id,
      operator_name,
      inward_source_type,
      vehicle_no,
      driver_name,
      driver_phone,
      transporter_name,
      lr_no,
      lr_date,
      gate_pass_no,
      chamber_no,
      floor_no,
      rack_no,
      handling_rate,
      handling_amount,
      storage_rate,
      storage_basis
    ]);

    let voucher_id = voucherRes.rows?.[0]?.id || voucherRes.lastID || voucherRes.lastInsertRowid;
    if (!voucher_id) {
      const vLookup = await db.query(`SELECT id FROM cold_storage_vouchers WHERE voucher_no = ?`, [voucher_no]);
      voucher_id = vLookup.rows?.[0]?.id || 1;
    }

    // Generate CS lot number prefix
    const csLotRes = await db.query(`SELECT COUNT(*) as count FROM cold_storage_items WHERE cold_storage_lot_no IS NOT NULL`);
    let nextCsNum = parseInt((csLotRes.rows[0] || {}).count || 0, 10) + 1;

    for (const item of items) {
      const qty = parseFloat(item.quantity || 0);
      const wt = parseFloat(item.weight || 1);
      const totWt = parseFloat(item.total_wt || (qty * wt));
      
      // Generate unique cold_storage_lot_no if not supplied
      let csLotNo = item.cold_storage_lot_no;
      if (!csLotNo || csLotNo === item.purchase_lot_no) {
        csLotNo = (item.purchase_lot_no && item.purchase_lot_no !== 'N/A')
          ? (item.purchase_lot_no.startsWith('CS-') ? item.purchase_lot_no : `CS-${item.purchase_lot_no}`)
          : `CS-${String(nextCsNum).padStart(4, '0')}`;
        nextCsNum++;
      }

      await db.query(`
        INSERT INTO cold_storage_items 
        (voucher_id, voucher_no, item_id, item_name, purchase_lot_no, cold_storage_lot_no, quantity, weight, total_wt, unit, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        voucher_id,
        voucher_no,
        item.item_id || null,
        item.item_name,
        item.purchase_lot_no || 'N/A',
        csLotNo,
        qty,
        wt,
        totWt,
        item.unit || 'KG',
        item.remarks || ''
      ]);

      // Resolve source godown for this item/lot if not accurately provided
      let actualSrcGodownName = source_godown_name;
      let actualSrcGodownId = source_godown_id;
      if (!actualSrcGodownName || actualSrcGodownName === 'Main Godown') {
        try {
          const pLookup = await db.query(`
            SELECT COALESCE(g.godown_name, p.godown) as godown_name, COALESCE(g.id, 3) as godown_id
            FROM purchases p
            JOIN purchase_items pi ON pi.purchase_id = p.id
            LEFT JOIN godown_master g ON (CAST(p.godown AS TEXT) = CAST(g.id AS TEXT) OR LOWER(TRIM(p.godown)) = LOWER(TRIM(g.godown_name)))
            WHERE pi.lot_no = ?
            ORDER BY p.id DESC LIMIT 1
          `, [item.purchase_lot_no]);
          if (pLookup.rows && pLookup.rows.length > 0 && pLookup.rows[0].godown_name) {
            actualSrcGodownName = pLookup.rows[0].godown_name;
            actualSrcGodownId = pLookup.rows[0].godown_id;
          }
        } catch (e) {}
      }
      if (!actualSrcGodownName) {
        try {
          const defG = await db.query('SELECT id, godown_name FROM godown_master ORDER BY id ASC LIMIT 1');
          if (defG.rows && defG.rows[0]) {
            actualSrcGodownName = defG.rows[0].godown_name;
            actualSrcGodownId = defG.rows[0].id;
          }
        } catch (_) {}
      }
      if (!actualSrcGodownName) actualSrcGodownName = 'PJ';

      const actualCsLot = csLotNo;
      const srcLotNo = (item.purchase_lot_no && item.purchase_lot_no !== 'N/A') ? item.purchase_lot_no : actualCsLot.replace(/^CS-/, '');

      // 1. Outward from source godown (e.g. LOT0003 from PJ)
      await db.run(`
        INSERT INTO stock (date, item_id, item_name, lot_no, type, qty, weight, rate, amount, godown, godown_id, reference_id, remarks)
        VALUES (?, ?, ?, ?, 'Cold Storage Transfer Out', ?, ?, 0, 0, ?, ?, ?, ?)
      `, [
        voucher_date || new Date().toISOString().split('T')[0],
        item.item_id || null,
        item.item_name,
        srcLotNo,
        -Math.abs(qty),
        -Math.abs(totWt),
        actualSrcGodownName,
        actualSrcGodownId || null,
        voucher_id,
        `[${voucher_no}] Transferred to Cold Storage: ${cold_storage_name} (CS Lot: ${actualCsLot})`
      ]);

      // 2. Inward to Cold Storage godown (e.g. LOT0006 in BTS Cold Storage)
      await db.run(`
        INSERT INTO stock (date, item_id, item_name, lot_no, type, qty, weight, rate, amount, godown, godown_id, reference_id, remarks)
        VALUES (?, ?, ?, ?, 'Cold Storage In', ?, ?, 0, 0, ?, ?, ?, ?)
      `, [
        voucher_date || new Date().toISOString().split('T')[0],
        item.item_id || null,
        item.item_name,
        actualCsLot,
        Math.abs(qty),
        Math.abs(totWt),
        cold_storage_name,
        cold_storage_id || null,
        voucher_id,
        `[${voucher_no}] Received in Cold Storage from ${actualSrcGodownName} (Source Lot: ${srcLotNo})`
      ]);
    }

    try {
      await rebuildStockLedger();
    } catch (rErr) {
      console.warn('Rebuild ledger after CS IN warning:', rErr.message);
    }

    let billInfo = null;
    try {
      const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
      const inBillItems = items.map(it => ({
        item_name: it.item_name,
        purchase_lot_no: it.purchase_lot_no || 'N/A',
        cold_storage_lot_no: it.cold_storage_lot_no,
        quantity: parseFloat(it.quantity || 0),
        weight: parseFloat(it.weight || 1),
        total_wt: parseFloat(it.total_wt || (parseFloat(it.quantity || 0) * parseFloat(it.weight || 1))),
        inward_date: voucher_date || new Date().toISOString().split('T')[0],
        handling_charges: parseFloat(body.handling_amount || (parseFloat(it.quantity || 0) * handling_rate))
      }));

      billInfo = await createOrUpdateColdStorageBill({
        billType: 'INWARD',
        voucherId: voucher_id,
        voucherNo: voucher_no,
        voucherDate: voucher_date || new Date().toISOString().split('T')[0],
        coldStorageId: cold_storage_id,
        coldStorageName: cold_storage_name,
        operatorId: operator_id,
        operatorName: operator_name,
        vehicleNo: vehicle_no,
        driverName: driver_name,
        driverPhone: driver_phone,
        transporterName: transporter_name,
        loadmanName: driver_name || 'Inward Unloading Team',
        loadmanCharges: handling_amount,
        storageCharges: 0,
        handlingCharges: handling_amount,
        totalQty: total_qty,
        totalWeight: total_wt,
        items: inBillItems,
        remarks: remarks || `Inward CSI Voucher ${voucher_no}`,
        createdBy: createdBy,
        companyId: activeCompanyId
      });
    } catch (billErr) {
      console.warn('Auto bill generation warning for CS IN:', billErr.message);
    }

    res.json({ 
      success: true, 
      message: `Cold Storage IN Voucher ${voucher_no} saved successfully`, 
      voucher_no, 
      id: voucher_id,
      bill_id: billInfo?.billId || null,
      bill_no: billInfo?.billNo || null,
      bill_grand_total: billInfo?.grandTotal || 0
    });
  } catch (err) {
    console.error('Error saving Cold Storage IN:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST Cold Storage OUT voucher
router.post('/out', async (req, res) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }
    body = body || {};

    let {
      voucher_date,
      cold_storage_id,
      cold_storage_name,
      destination_godown_id,
      destination_godown_name,
      remarks,
      items
    } = body;

    // Resolve cold storage name if only ID provided or vice versa
    if (!cold_storage_name && cold_storage_id) {
      try {
        const csRow = await db.query('SELECT godown_name FROM godown_master WHERE id = ?', [cold_storage_id]);
        if (csRow.rows && csRow.rows.length > 0) {
          cold_storage_name = csRow.rows[0].godown_name;
        }
      } catch (e) {}
    }

    if (!cold_storage_id && cold_storage_name) {
      try {
        const csRow = await db.query('SELECT id FROM godown_master WHERE godown_name = ?', [cold_storage_name]);
        if (csRow.rows && csRow.rows.length > 0) {
          cold_storage_id = csRow.rows[0].id;
        }
      } catch (e) {}
    }

    if (!cold_storage_name && !cold_storage_id) {
      return res.status(400).json({ success: false, message: 'Cold Storage location is required' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one item is required' });
    }

    // STRICT VALIDATION: Check available stock in Cold Storage for each item & CS Lot!
    for (const item of items) {
      const reqQty = parseFloat(item.quantity || 0);
      
      const stockRes = await db.query(`
        SELECT 
          SUM(CASE WHEN csv.voucher_type = 'IN' THEN csi.quantity ELSE 0 END) - 
          SUM(CASE WHEN csv.voucher_type = 'OUT' THEN csi.quantity ELSE 0 END) AS available_qty
        FROM cold_storage_items csi
        JOIN cold_storage_vouchers csv ON csi.voucher_id = csv.id
        WHERE (csv.cold_storage_id = ? OR csv.cold_storage_name = ?)
          AND csi.item_name = ? 
          AND csi.cold_storage_lot_no = ?
          AND COALESCE(csv.remarks, '') NOT LIKE 'Auto-sync from Stock Lot CS-%'
      `, [cold_storage_id || 0, cold_storage_name || '', item.item_name, item.cold_storage_lot_no]);

      const availQty = parseFloat((stockRes.rows[0] || {}).available_qty || 0);

      if (reqQty > availQty) {
        return res.status(400).json({
          success: false,
          message: `Insufficient Cold Storage Stock for ${item.item_name} (CS Lot: ${item.cold_storage_lot_no}). Available: ${availQty} ${item.unit || 'KG'}, Requested: ${reqQty} ${item.unit || 'KG'}.`
        });
      }
    }

    const voucher_no = await getNextVoucherNo('OUT');
    let total_qty = 0;
    let total_wt = 0;

    items.forEach(it => {
      total_qty += parseFloat(it.quantity || 0);
      total_wt += parseFloat(it.total_wt || (parseFloat(it.quantity || 0) * parseFloat(it.weight || 1)));
    });

    const createdBy = body.created_by || (req.user && req.user.username) || 'Admin';

    let outward_dest_type = body.outward_dest_type || (body.customer_id || body.customer_name ? 'Customer Dispatch' : 'Internal Godown');
    let customer_id = body.customer_id || null;
    let customer_name = body.customer_name || body.customer || '';
    let sales_order_ref = body.sales_order_ref || body.sales_ref || '';
    let vehicle_no = body.vehicle_no || body.lorry_no || '';
    let driver_name = body.driver_name || '';
    let driver_phone = body.driver_phone || '';
    let transporter_name = body.transporter_name || body.transporter || '';
    let lr_no = body.lr_no || '';
    let lr_date = body.lr_date || null;
    let gate_pass_no = body.gate_pass_no || body.operator_gate_pass || '';
    let handling_rate = parseFloat(body.handling_rate || 0);

    if (cold_storage_id && handling_rate === 0) {
      try {
        const gmRow = await db.query('SELECT outward_handling_rate FROM godown_master WHERE id = ?', [cold_storage_id]);
        if (gmRow.rows && gmRow.rows.length > 0) {
          handling_rate = parseFloat(gmRow.rows[0].outward_handling_rate || 0);
        }
      } catch (_) {}
    }
    const handling_amount = parseFloat(body.handling_amount || (total_qty * handling_rate));

    const voucherRes = await db.query(`
      INSERT INTO cold_storage_vouchers 
      (voucher_no, voucher_type, voucher_date, cold_storage_id, cold_storage_name, destination_godown_id, destination_godown_name, remarks, total_qty, total_wt, created_by,
       outward_dest_type, customer_id, customer_name, sales_order_ref, vehicle_no, driver_name, driver_phone, transporter_name, lr_no, lr_date, gate_pass_no, handling_rate, handling_amount)
      VALUES (?, 'OUT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      voucher_no,
      voucher_date || new Date().toISOString().split('T')[0],
      cold_storage_id || null,
      cold_storage_name || 'Cold Storage',
      outward_dest_type === 'Customer Dispatch' ? null : (destination_godown_id || null),
      outward_dest_type === 'Customer Dispatch' ? `Customer: ${customer_name}` : (destination_godown_name || 'Production / Main Godown'),
      remarks || '',
      total_qty,
      total_wt,
      createdBy,
      outward_dest_type,
      customer_id,
      customer_name,
      sales_order_ref,
      vehicle_no,
      driver_name,
      driver_phone,
      transporter_name,
      lr_no,
      lr_date,
      gate_pass_no,
      handling_rate,
      handling_amount
    ]);

    let voucher_id = voucherRes.rows?.[0]?.id || voucherRes.lastID || voucherRes.lastInsertRowid;
    if (!voucher_id) {
      const vLookup = await db.query(`SELECT id FROM cold_storage_vouchers WHERE voucher_no = ?`, [voucher_no]);
      voucher_id = vLookup.rows?.[0]?.id || 1;
    }

    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const tariff = await getColdStorageTariff(cold_storage_id || 2, activeCompanyId);
    let totalStorageCharges = 0;
    let totalOutwardLoadingCharges = 0;
    const outwardBillItems = [];

    for (const item of items) {
      const qty = parseFloat(item.quantity || 0);
      const wt = parseFloat(item.weight || 1);
      const totWt = parseFloat(item.total_wt || (qty * wt));

      // 1. Fetch original inward lot details
      let inRow = null;
      try {
        const inLookup = await db.query(`
          SELECT csi.*, csv.voucher_date as inward_date, csv.purchase_id
          FROM cold_storage_items csi
          JOIN cold_storage_vouchers csv ON csi.voucher_id = csv.id
          WHERE csv.voucher_type = 'IN'
            AND (csi.cold_storage_lot_no = ? OR csi.purchase_lot_no = ?)
            AND (csv.cold_storage_id = ? OR csv.cold_storage_name = ?)
          ORDER BY csi.id ASC LIMIT 1
        `, [item.cold_storage_lot_no, item.purchase_lot_no, cold_storage_id || 0, cold_storage_name || ''], activeCompanyId);
        if (inLookup.rows && inLookup.rows.length > 0) {
          inRow = inLookup.rows[0];
        }
      } catch (_) {}

      // 2. Storage Days calculation (inclusive calendar days: outward - inward + 1)
      const inDate = inRow?.inward_date || voucher_date;
      const { calendarDays, billableDays } = calculateStorageDays(inDate, voucher_date, tariff.freeDays, tariff.minDays);

      // 3. Storage charges for the released quantity
      const storageCalc = calculateSlabStorageCharge({
        qtyKg: totWt,
        billableDays,
        slabs: tariff.storageSlabs,
        calculationType: tariff.calculationType
      });
      const lineStorageCharge = storageCalc.totalCharge;
      totalStorageCharges += lineStorageCharge;

      // 4. Outward Loading Labour Charge (handled kg * rate/kg)
      const outLoadingRate = parseFloat(handling_rate || tariff.outwardLoadingRate || 0.50);
      const loadingCalc = calculateLabourCharge({
        qtyKg: totWt,
        ratePerKg: outLoadingRate,
        additionalCharges: 0
      });
      const lineLoadingCharge = loadingCalc.totalCharge;
      totalOutwardLoadingCharges += lineLoadingCharge;

      outwardBillItems.push({
        item_name: item.item_name,
        purchase_lot_no: item.purchase_lot_no || inRow?.purchase_lot_no || 'N/A',
        cold_storage_lot_no: item.cold_storage_lot_no,
        quantity: qty,
        weight: wt,
        total_wt: totWt,
        billable_units: qty,
        inward_date: inDate,
        outward_date: voucher_date,
        storage_days: calendarDays,
        billable_days: billableDays,
        storage_charges: lineStorageCharge,
        handling_charges: lineLoadingCharge,
        total_charges: Number((lineStorageCharge + lineLoadingCharge).toFixed(2)),
        vehicle_no: vehicle_no || '',
        driver_name: driver_name || '',
        transporter_name: transporter_name || '',
        loadman_name: driver_name || 'Outward Loading Team'
      });

      await db.run(`
        INSERT INTO cold_storage_items 
        (voucher_id, voucher_no, item_id, item_name, purchase_lot_no, cold_storage_lot_no, quantity, weight, total_wt, unit, remarks,
         purchase_id, inward_voucher_id, inward_item_id, inward_date, outward_date, storage_days, storage_charge, labour_charge)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        voucher_id,
        voucher_no,
        item.item_id || inRow?.item_id || null,
        item.item_name,
        item.purchase_lot_no || inRow?.purchase_lot_no || 'N/A',
        item.cold_storage_lot_no,
        qty,
        wt,
        totWt,
        item.unit || 'KG',
        item.remarks || '',
        inRow?.purchase_id || null,
        inRow?.voucher_id || null,
        inRow?.id || null,
        inDate,
        voucher_date,
        calendarDays,
        lineStorageCharge,
        lineLoadingCharge
      ], activeCompanyId);

      // Update remaining quantity on original inward item
      if (inRow?.id) {
        await db.run(`
          UPDATE cold_storage_items SET
            remaining_quantity = MAX(0, COALESCE(remaining_quantity, quantity) - ?),
            remaining_weight = MAX(0, COALESCE(remaining_weight, total_wt) - ?)
          WHERE id = ?
        `, [qty, totWt, inRow.id], activeCompanyId);
      }

      // Also deduct from stock_lots if present
      try {
        await db.run(`
          UPDATE stock_lots SET 
            remaining_quantity = MAX(0, remaining_quantity - ?)
          WHERE (lot_no = ? OR lot_no = ?) AND (godown_id = ? OR godown_name = ?)
        `, [qty, item.cold_storage_lot_no, item.purchase_lot_no, cold_storage_id || 0, cold_storage_name || ''], activeCompanyId);
      } catch (_) {}

      let csLotNo = item.cold_storage_lot_no;
      let destLotNo = item.purchase_lot_no;
      if (!destLotNo || destLotNo === 'N/A' || destLotNo === csLotNo) {
        destLotNo = csLotNo ? csLotNo.replace(/^CS-/, '') : 'LOT-TRANSFER';
      }

      if (outward_dest_type === 'Customer Dispatch') {
        // Direct dispatch to customer - Deducts from Cold Storage without adding to Factory Godown
        await db.run(`
          INSERT INTO stock (date, item_id, item_name, lot_no, type, qty, weight, rate, amount, godown, godown_id, reference_id, remarks)
          VALUES (?, ?, ?, ?, 'Cold Storage Direct Dispatch', ?, ?, 0, 0, ?, ?, ?, ?)
        `, [
          voucher_date || new Date().toISOString().split('T')[0],
          item.item_id || null,
          item.item_name,
          csLotNo,
          -Math.abs(qty),
          -Math.abs(totWt),
          cold_storage_name,
          cold_storage_id || null,
          voucher_id,
          `[${voucher_no}] Dispatched directly to Customer: ${customer_name || 'Customer'} (Ref: ${sales_order_ref || 'Direct'}) (CS Lot: ${csLotNo})`
        ]);
      } else {
        // Internal transfer back to factory/destination godown
        let actualDestGodownName = destination_godown_name || 'Main Godown';
        let actualDestGodownId = destination_godown_id;
        if (!actualDestGodownId) {
          try {
            const gLookup = await db.query(`SELECT id FROM godown_master WHERE LOWER(TRIM(godown_name)) = LOWER(TRIM(?)) LIMIT 1`, [actualDestGodownName]);
            if (gLookup.rows && gLookup.rows.length > 0) {
              actualDestGodownId = gLookup.rows[0].id;
            }
          } catch (e) {}
        }

        // 1. Outward from Cold Storage godown (deducts csLotNo, e.g. LOT0006, from cold_storage_name)
        await db.run(`
          INSERT INTO stock (date, item_id, item_name, lot_no, type, qty, weight, rate, amount, godown, godown_id, reference_id, remarks)
          VALUES (?, ?, ?, ?, 'Cold Storage Transfer Out', ?, ?, 0, 0, ?, ?, ?, ?)
        `, [
          voucher_date || new Date().toISOString().split('T')[0],
          item.item_id || null,
          item.item_name,
          csLotNo,
          -Math.abs(qty),
          -Math.abs(totWt),
          cold_storage_name,
          cold_storage_id || null,
          voucher_id,
          `[${voucher_no}] Transferred from Cold Storage to ${actualDestGodownName} (CS Lot: ${csLotNo})`
        ]);

        // 2. Inward to Destination godown (receives destLotNo, e.g. LOT0003, in actualDestGodownName)
        await db.run(`
          INSERT INTO stock (date, item_id, item_name, lot_no, type, qty, weight, rate, amount, godown, godown_id, reference_id, remarks)
          VALUES (?, ?, ?, ?, 'Cold Storage Transfer In', ?, ?, 0, 0, ?, ?, ?, ?)
        `, [
          voucher_date || new Date().toISOString().split('T')[0],
          item.item_id || null,
          item.item_name,
          destLotNo,
          Math.abs(qty),
          Math.abs(totWt),
          actualDestGodownName,
          actualDestGodownId || null,
          voucher_id,
          `[${voucher_no}] Received from Cold Storage: ${cold_storage_name} (CS Lot: ${csLotNo})`
        ]);
      }
    }

    // Update voucher with calculated totals
    await db.run(`
      UPDATE cold_storage_vouchers SET
        storage_charges = ?,
        handling_amount = ?,
        charge_snapshot_json = ?
      WHERE id = ?
    `, [totalStorageCharges, totalOutwardLoadingCharges, JSON.stringify(tariff), voucher_id], activeCompanyId);

    // Link outward loading labour charge to operational_charges
    try {
      await db.run(`
        INSERT INTO operational_charges (
          company_id, charge_no, charge_type, source_module, source_transaction_type, source_transaction_id, source_transaction_no,
          charge_date, party_name, item_name, lot_no, from_location, to_location, vehicle_no, driver_name,
          quantity, rate, base_amount, total_amount, payment_status, remarks, created_by
        ) VALUES (?, ?, 'LOADING', 'COLD_STORAGE', 'CSO', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
      `, [
        activeCompanyId,
        `CHG-LOAD-${voucher_id}`,
        voucher_id,
        voucher_no,
        voucher_date,
        driver_name || 'Outward Loading Team',
        items[0]?.item_name || 'Commodity Outward',
        items[0]?.cold_storage_lot_no || '',
        cold_storage_name,
        outward_dest_type === 'Customer Dispatch' ? (customer_name || 'Customer') : (destination_godown_name || 'Main Godown'),
        vehicle_no || '',
        driver_name || '',
        total_wt,
        parseFloat(handling_rate || tariff.outwardLoadingRate || 0.50),
        totalOutwardLoadingCharges,
        totalOutwardLoadingCharges,
        `Outward Loading Labour for CSO Voucher #${voucher_no} (${cold_storage_name})`,
        createdBy
      ]);
    } catch (opErr) {
      console.warn('[Operational Charge CSO Link Notice]:', opErr.message);
    }

    try {
      await rebuildStockLedger();
    } catch (rErr) {
      console.warn('Rebuild ledger after CS OUT warning:', rErr.message);
    }

    let billInfo = null;
    try {
      billInfo = await createOrUpdateColdStorageBill({
        billType: 'OUTWARD',
        voucherId: voucher_id,
        voucherNo: voucher_no,
        voucherDate: voucher_date || new Date().toISOString().split('T')[0],
        coldStorageId: cold_storage_id,
        coldStorageName: cold_storage_name,
        operatorId: body.operator_id || null,
        operatorName: body.operator_name || null,
        vehicleNo: vehicle_no || '',
        driverName: driver_name || '',
        driverPhone: driver_phone || '',
        transporterName: transporter_name || '',
        loadmanName: driver_name || 'Outward Loading Team',
        loadmanCharges: totalOutwardLoadingCharges,
        storageCharges: totalStorageCharges,
        handlingCharges: totalOutwardLoadingCharges,
        totalQty: total_qty,
        totalWeight: total_wt,
        items: outwardBillItems,
        remarks: remarks || `Outward CSO Voucher ${voucher_no}`,
        createdBy: createdBy,
        companyId: activeCompanyId
      });
    } catch (billErr) {
      console.warn('Auto bill generation warning for CS OUT:', billErr.message);
    }

    res.json({ 
      success: true, 
      message: `Cold Storage OUT Voucher ${voucher_no} issued successfully`, 
      voucher_no, 
      id: voucher_id,
      bill_id: billInfo?.billId || null,
      bill_no: billInfo?.billNo || null,
      bill_grand_total: billInfo?.grandTotal || 0
    });
  } catch (err) {
    console.error('Error saving Cold Storage OUT:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET list of Cold Storage vouchers
router.get('/vouchers', async (req, res) => {
  try {
    await syncGodownTransfersToColdStorage();
    const { voucher_type, date_from, date_to, cold_storage_id } = req.query;
    let query = `SELECT * FROM cold_storage_vouchers WHERE COALESCE(remarks, '') NOT LIKE 'Auto-sync from Stock Lot CS-%'`;
    const params = [];

    if (voucher_type) {
      params.push(voucher_type.toUpperCase());
      query += ` AND voucher_type = ?`;
    }
    if (cold_storage_id) {
      params.push(cold_storage_id);
      query += ` AND cold_storage_id = ?`;
    }
    if (date_from) {
      params.push(date_from);
      query += ` AND voucher_date >= ?`;
    }
    if (date_to) {
      params.push(date_to);
      query += ` AND voucher_date <= ?`;
    }

    query += ` ORDER BY id DESC`;

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single Cold Storage voucher with items
router.get('/vouchers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const vRes = await db.query(`SELECT * FROM cold_storage_vouchers WHERE id = ?`, [id]);
    if (!vRes.rows || vRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Voucher not found' });
    }

    const itemsRes = await db.query(`SELECT * FROM cold_storage_items WHERE voucher_id = ?`, [id]);

    res.json({
      success: true,
      data: {
        ...vRes.rows[0],
        items: itemsRes.rows || []
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE Cold Storage voucher
router.delete('/vouchers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const vRes = await db.query('SELECT * FROM cold_storage_vouchers WHERE id = ?', [id]);
    if (vRes.rows && vRes.rows.length > 0) {
      const vRow = vRes.rows[0];
      try {
        const itemsRes = await db.query('SELECT * FROM cold_storage_items WHERE voucher_id = ?', [id]);
        await recycleBinService.saveToRecycleBin({
          moduleName: 'Cold Storage Voucher',
          recordId: id,
          title: `Cold Storage Voucher #${vRow.voucher_no || id} (${vRow.voucher_type || 'IN/OUT'})`,
          recordData: {
            tableName: 'cold_storage_vouchers',
            record: vRow,
            subRecords: [
              { tableName: 'cold_storage_items', records: itemsRes.rows || [] }
            ]
          },
          deletedBy: req.user?.username || 'admin'
        });
      } catch (e) {
        console.warn('Recycle bin save error in cold storage:', e.message);
      }
    }

    await db.query(`DELETE FROM stock WHERE reference_id = ? AND (type LIKE 'Cold Storage%' OR type LIKE 'CS %')`, [id]);
    await db.query(`DELETE FROM cold_storage_items WHERE voucher_id = ?`, [id]);
    await db.query(`DELETE FROM cold_storage_vouchers WHERE id = ?`, [id]);
    try {
      await rebuildStockLedger();
    } catch (rErr) {
      console.warn('Rebuild ledger after CS delete warning:', rErr.message);
    }
    res.json({ success: true, message: 'Voucher deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET Cold Storage Movement Ledger
router.get('/ledger', async (req, res) => {
  try {
    await syncGodownTransfersToColdStorage();
    const { item_name, cold_storage_id, purchase_lot_no, cold_storage_lot_no, date_from, date_to } = req.query;

    let query = `
      SELECT 
        csv.id AS voucher_id,
        csv.voucher_no,
        csv.voucher_type,
        csv.voucher_date,
        csv.cold_storage_name,
        csv.source_godown_name,
        csv.destination_godown_name,
        csi.item_name,
        csi.purchase_lot_no,
        csi.cold_storage_lot_no,
        csi.quantity,
        csi.total_wt,
        csi.unit,
        csi.remarks
      FROM cold_storage_items csi
      JOIN cold_storage_vouchers csv ON csi.voucher_id = csv.id
      WHERE 1=1
    `;
    const params = [];

    if (item_name) {
      params.push(item_name);
      query += ` AND csi.item_name = ?`;
    }
    if (cold_storage_id) {
      params.push(cold_storage_id);
      query += ` AND csv.cold_storage_id = ?`;
    }
    if (purchase_lot_no) {
      params.push(purchase_lot_no);
      query += ` AND csi.purchase_lot_no = ?`;
    }
    if (cold_storage_lot_no) {
      params.push(cold_storage_lot_no);
      query += ` AND csi.cold_storage_lot_no = ?`;
    }
    if (date_from) {
      params.push(date_from);
      query += ` AND csv.voucher_date >= ?`;
    }
    if (date_to) {
      params.push(date_to);
      query += ` AND csv.voucher_date <= ?`;
    }

    query += ` ORDER BY csv.voucher_date ASC, csv.id ASC`;

    const result = await db.query(query, params);

    let runningBal = 0;
    const ledger = (result.rows || []).map(r => {
      const qty = parseFloat(r.quantity || 0);
      if (r.voucher_type === 'IN') {
        runningBal += qty;
      } else {
        runningBal -= qty;
      }
      return {
        ...r,
        running_balance: runningBal
      };
    });

    res.json({ success: true, data: ledger });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET Complete Lot Traceability across Main Godown, Cold Storage, Vouchers & Production
router.get('/traceability', async (req, res) => {
  try {
    const { query: searchQuery } = req.query;

    if (!searchQuery) {
      return res.json({ success: true, data: [] });
    }

    const q = `%${searchQuery.trim()}%`;

    // 1. Fetch Purchase Lot Entries safely with fallback
    let purchaseRes;
    try {
      purchaseRes = await db.query(`
        SELECT 
          p.id AS purchase_id,
          COALESCE(p.voucher_no, CAST(p.id AS TEXT)) AS voucher_no,
          p.date AS purchase_date,
          COALESCE(sm.print_name, sm.name, CAST(p.supplier AS TEXT), 'Supplier') AS supplier_name,
          COALESCE(p.godown, 'Main Godown') AS main_godown,
          pi.item_name,
          pi.lot_no AS purchase_lot_no,
          pi.qty AS purchased_qty,
          COALESCE(pi.weight, 0) AS per_unit_wt,
          COALESCE(pi.total_wt, pi.qty * COALESCE(pi.weight, 1), pi.qty) AS purchased_total_wt,
          COALESCE(pi.unit, 'KG') AS unit
        FROM purchase_items pi
        JOIN purchases p ON pi.purchase_id = p.id
        LEFT JOIN supplier_master sm ON (CAST(sm.id AS TEXT) = CAST(p.supplier AS TEXT) OR sm.name = CAST(p.supplier AS TEXT) OR sm.print_name = CAST(p.supplier AS TEXT))
        WHERE pi.lot_no LIKE ? OR pi.item_name LIKE ?
        ORDER BY p.date DESC
      `, [q, q]);
    } catch (pErr) {
      console.warn('Fallback traceability purchase query:', pErr.message);
      try {
        purchaseRes = await db.query(`
          SELECT 
            p.id AS purchase_id,
            CAST(p.id AS TEXT) AS voucher_no,
            p.date AS purchase_date,
            'Supplier' AS supplier_name,
            'Main Godown' AS main_godown,
            pi.item_name,
            pi.lot_no AS purchase_lot_no,
            pi.qty AS purchased_qty,
            0 AS per_unit_wt,
            pi.qty AS purchased_total_wt,
            'KG' AS unit
          FROM purchase_items pi
          JOIN purchases p ON pi.purchase_id = p.id
          WHERE pi.lot_no LIKE ? OR pi.item_name LIKE ?
          ORDER BY p.date DESC
        `, [q, q]);
      } catch (pErr2) {
        purchaseRes = { rows: [] };
      }
    }

    // 2. Fetch Cold Storage Movements for matching lots
    const csRes = await db.query(`
      SELECT 
        csv.voucher_no,
        csv.voucher_type,
        csv.voucher_date,
        csv.cold_storage_name,
        csv.source_godown_name,
        csv.destination_godown_name,
        csi.item_name,
        csi.purchase_lot_no,
        csi.cold_storage_lot_no,
        csi.quantity,
        csi.total_wt,
        csi.unit
      FROM cold_storage_items csi
      JOIN cold_storage_vouchers csv ON csi.voucher_id = csv.id
      WHERE csi.purchase_lot_no LIKE ? OR csi.cold_storage_lot_no LIKE ? OR csi.item_name LIKE ?
      ORDER BY csv.voucher_date ASC
    `, [q, q, q]);

    // Build comprehensive traceability maps
    const traceMap = {};

    (purchaseRes.rows || []).forEach(p => {
      const key = `${p.item_name}_${p.purchase_lot_no}`;
      if (!traceMap[key]) {
        traceMap[key] = {
          item_name: p.item_name,
          purchase_lot_no: p.purchase_lot_no,
          supplier_name: p.supplier_name,
          purchase_voucher: p.voucher_no,
          purchase_date: p.purchase_date,
          main_godown: p.main_godown,
          purchased_qty: 0,
          purchased_total_wt: 0,
          unit: p.unit || 'KG',
          cold_storage_in_qty: 0,
          cold_storage_out_qty: 0,
          cold_storage_lots: {},
          movements: []
        };
      }
      traceMap[key].purchased_qty += parseFloat(p.purchased_qty || 0);
      traceMap[key].purchased_total_wt += parseFloat(p.purchased_total_wt || 0);
    });

    (csRes.rows || []).forEach(c => {
      const key = `${c.item_name}_${c.purchase_lot_no}`;
      if (!traceMap[key]) {
        traceMap[key] = {
          item_name: c.item_name,
          purchase_lot_no: c.purchase_lot_no,
          supplier_name: 'N/A',
          purchase_voucher: 'N/A',
          purchase_date: 'N/A',
          main_godown: c.source_godown_name || 'Main Godown',
          purchased_qty: 0,
          purchased_total_wt: 0,
          unit: c.unit || 'KG',
          cold_storage_in_qty: 0,
          cold_storage_out_qty: 0,
          cold_storage_lots: {},
          movements: []
        };
      }

      const qty = parseFloat(c.quantity || 0);
      if (c.voucher_type === 'IN') {
        traceMap[key].cold_storage_in_qty += qty;
      } else {
        traceMap[key].cold_storage_out_qty += qty;
      }

      // CS Lot breakdown
      const csLotKey = c.cold_storage_lot_no;
      if (!traceMap[key].cold_storage_lots[csLotKey]) {
        traceMap[key].cold_storage_lots[csLotKey] = {
          cold_storage_lot_no: csLotKey,
          cold_storage_name: c.cold_storage_name,
          in_qty: 0,
          out_qty: 0,
          current_balance: 0
        };
      }
      if (c.voucher_type === 'IN') {
        traceMap[key].cold_storage_lots[csLotKey].in_qty += qty;
      } else {
        traceMap[key].cold_storage_lots[csLotKey].out_qty += qty;
      }
      traceMap[key].cold_storage_lots[csLotKey].current_balance = 
        traceMap[key].cold_storage_lots[csLotKey].in_qty - traceMap[key].cold_storage_lots[csLotKey].out_qty;

      traceMap[key].movements.push(c);
    });

    const resultList = Object.values(traceMap).map(t => {
      const csCurrentBal = t.cold_storage_in_qty - t.cold_storage_out_qty;
      const mainGodownBal = Math.max(0, t.purchased_qty - t.cold_storage_in_qty);
      return {
        ...t,
        main_godown_balance: mainGodownBal,
        cold_storage_current_balance: csCurrentBal,
        issued_to_production_qty: t.cold_storage_out_qty,
        cold_storage_lots_list: Object.values(t.cold_storage_lots)
      };
    });

    res.json({ success: true, data: resultList });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================================================
// COLD STORAGE OPERATOR BILLING & RECONCILIATION ENGINE
// ============================================================================

// POST /calculate-bill - Calculate expected cold storage charges for an operator / cold storage
router.post('/calculate-bill', async (req, res) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }
    body = body || {};

    let { cold_storage_id, operator_id, period_from, period_to, operator_invoice_amount } = body;
    if (!cold_storage_id) {
      return res.status(400).json({ success: false, message: 'cold_storage_id is required' });
    }

    const csRes = await db.query('SELECT * FROM godown_master WHERE id = ?', [cold_storage_id]);
    if (!csRes.rows || csRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Cold Storage facility not found' });
    }
    const cs = csRes.rows[0];

    // Resolve operator
    let opId = operator_id || cs.operator_id;
    let opName = cs.operator_name || cs.external_company || 'Cold Storage Operator';
    if (opId) {
      try {
        const supRes = await db.query('SELECT id, name, print_name FROM supplier_master WHERE id = ?', [opId]);
        if (supRes.rows && supRes.rows.length > 0) {
          opName = supRes.rows[0].print_name || supRes.rows[0].name;
        }
      } catch (_) {}
    }

    const fromDate = period_from || '2000-01-01';
    const toDate = period_to || new Date().toISOString().split('T')[0];

    // Pull lots in this cold storage
    const itemsRes = await db.query(`
      SELECT 
        csi.item_name,
        csi.purchase_lot_no,
        csi.cold_storage_lot_no,
        csv.cold_storage_id,
        csv.cold_storage_name,
        SUM(CASE WHEN csv.voucher_type = 'IN' THEN csi.quantity ELSE 0 END) AS in_qty,
        SUM(CASE WHEN csv.voucher_type = 'OUT' THEN csi.quantity ELSE 0 END) AS out_qty,
        SUM(CASE WHEN csv.voucher_type = 'IN' THEN csi.total_wt ELSE 0 END) AS in_wt,
        SUM(CASE WHEN csv.voucher_type = 'OUT' THEN csi.total_wt ELSE 0 END) AS out_wt,
        COALESCE(NULLIF(MAX(csi.weight), 0), 1) AS weight,
        csi.unit,
        MIN(CASE WHEN csv.voucher_type = 'IN' THEN csv.voucher_date END) AS inward_date,
        MAX(CASE WHEN csv.voucher_type = 'OUT' THEN csv.voucher_date END) AS last_outward_date,
        MAX(COALESCE(csv.chamber_no, 'Chamber 1')) AS chamber_no
      FROM cold_storage_items csi
      JOIN cold_storage_vouchers csv ON csi.voucher_id = csv.id
      WHERE (csv.cold_storage_id = ? OR csv.cold_storage_name = ?)
        AND csv.voucher_date <= ?
      GROUP BY csi.item_name, csi.purchase_lot_no, csi.cold_storage_lot_no, csv.cold_storage_id, csv.cold_storage_name, csi.unit
    `, [cs.id, cs.godown_name, toDate]);

    // --- Use Billing Service ---
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const billData = await calculateBill(cold_storage_id, fromDate, toDate, operator_invoice_amount, activeCompanyId);
    
    // --- Map service result to existing frontend-expected structure ---
    const auditedItems = billData.items.map((it, idx) => ({
      id: idx + 1,
      item_name: it.item_name,
      purchase_lot_no: it.purchase_lot_no,
      cold_storage_lot_no: it.cold_storage_lot_no,
      inward_date: it.inward_date,
      in_qty: parseFloat(it.quantity || 0),
      out_qty: parseFloat(it.out_qty || 0),
      balance_qty: parseFloat(it.quantity || 0) - parseFloat(it.out_qty || 0),
      storage_days: it.calendar_days,
      billable_days: it.billable_days,
      slab_breakdown: it.slab_breakdown,
      rent_amount: it.storage_charge,
      unloading_charge: it.unloading_charge,
      total_amount: it.total_amount
    }));

    res.json({
      success: true,
      data: {
        cold_storage_id: cs.id,
        cold_storage_name: cs.godown_name,
        operator_id: opId,
        operator_name: opName,
        period_from: fromDate,
        period_to: toDate,
        billing_basis: 'Per KG/Day',
        billing_method: billData.tariff.calculationType,
        storage_duration: billData.tariff.minDays,
        rates: {
          rate_per_bag: (billData.tariff.storageSlabs[0]?.rate || 0.20) * 50,
          rate_per_kg: billData.tariff.storageSlabs[0]?.rate || 0.20,
          rate_per_ton: (billData.tariff.storageSlabs[0]?.rate || 0.20) * 1000,
          inward_handling_rate: billData.tariff.inwardUnloadingRate,
          outward_handling_rate: billData.tariff.outwardLoadingRate,
          insurance_rate: 0,
          mamool_rate: 0,
          gst_rate: billData.tax_rate
        },
        items: auditedItems,
        summary: {
          total_stored_qty: auditedItems.reduce((s, it) => s + it.in_qty, 0),
          storage_charges: billData.total_storage_charges,
          inward_handling_charges: billData.total_unloading_charges,
          outward_handling_charges: 0,
          handling_charges: billData.total_unloading_charges,
          insurance_charges: 0,
          mamool_charges: 0,
          taxable_amount: billData.taxable_amount,
          tax_rate: billData.tax_rate,
          cgst_amount: billData.cgst_amount,
          sgst_amount: billData.sgst_amount,
          igst_amount: billData.igst_amount,
          total_tax: billData.total_tax,
          grand_total: billData.grand_total,
          operator_invoice_amount: billData.operator_invoice_amount,
          variance_amount: billData.variance_amount,
          is_matched: billData.is_matched
        }
      }
    });
  } catch (err) {
    console.error('Error calculating cold storage bill:', err);
    res.status(500).json({ success: false, message: 'Calculation error: ' + err.message });
  }
});

// POST /bills - Save Cold Storage Operator Bill
router.post('/bills', async (req, res) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }
    body = body || {};

    const {
      cold_storage_id,
      cold_storage_name,
      operator_id,
      operator_name,
      period_from,
      period_to,
      operator_invoice_no,
      operator_invoice_date,
      operator_invoice_amount,
      erp_calculated_amount,
      variance_amount,
      storage_charges,
      handling_charges,
      insurance_charges,
      mamool_charges,
      other_charges,
      taxable_amount,
      tax_rate,
      cgst_amount,
      sgst_amount,
      igst_amount,
      total_tax,
      grand_total,
      remarks,
      items
    } = body;

    if (!cold_storage_id && !cold_storage_name) {
      return res.status(400).json({ success: false, message: 'Cold Storage facility is required' });
    }

    // Generate Bill No CSB-000001
    const countRes = await db.query('SELECT COUNT(*) as cnt FROM cold_storage_bills');
    const nextNum = parseInt(countRes.rows?.[0]?.cnt || 0, 10) + 1;
    const bill_no = `CSB-${String(nextNum).padStart(6, '0')}`;
    const today = new Date().toISOString().split('T')[0];

    const insertRes = await db.run(`
      INSERT INTO cold_storage_bills (
        bill_no, bill_date, operator_id, operator_name, cold_storage_id, cold_storage_name,
        period_from, period_to, operator_invoice_no, operator_invoice_date,
        operator_invoice_amount, erp_calculated_amount, variance_amount,
        storage_charges, handling_charges, insurance_charges, mamool_charges, other_charges,
        taxable_amount, tax_rate, cgst_amount, sgst_amount, igst_amount, total_tax, grand_total,
        status, remarks, items_json, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?)
    `, [
      bill_no,
      today,
      operator_id || null,
      operator_name || 'Operator',
      cold_storage_id || null,
      cold_storage_name || 'Cold Storage',
      period_from || null,
      period_to || null,
      operator_invoice_no || '',
      operator_invoice_date || null,
      parseFloat(operator_invoice_amount || 0),
      parseFloat(erp_calculated_amount || grand_total || 0),
      parseFloat(variance_amount || 0),
      parseFloat(storage_charges || 0),
      parseFloat(handling_charges || 0),
      parseFloat(insurance_charges || 0),
      parseFloat(mamool_charges || 0),
      parseFloat(other_charges || 0),
      parseFloat(taxable_amount || 0),
      parseFloat(tax_rate || 18),
      parseFloat(cgst_amount || 0),
      parseFloat(sgst_amount || 0),
      parseFloat(igst_amount || 0),
      parseFloat(total_tax || 0),
      parseFloat(grand_total || operator_invoice_amount || 0),
      remarks || '',
      JSON.stringify(items || []),
      req.user?.username || 'Admin'
    ]);

    const newId = insertRes.lastID || insertRes.lastInsertRowid;
    res.json({ success: true, message: `Operator Bill ${bill_no} created successfully`, id: newId, bill_no });
  } catch (err) {
    console.error('Error saving cold storage bill:', err);
    res.status(500).json({ success: false, message: 'Error saving bill: ' + err.message });
  }
});

// POST /bills/:id/approve - Approve Operator Bill and post to Accounts Ledger
router.post('/bills/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const billRes = await db.query('SELECT * FROM cold_storage_bills WHERE id = ?', [id]);
    if (!billRes.rows || billRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }
    const bill = billRes.rows[0];
    if (bill.status === 'Approved') {
      return res.status(400).json({ success: false, message: 'Bill is already approved' });
    }

    const { resolveLedgerId } = require('../utils/ledgerHelper');

    // 1. Resolve Operator Supplier Ledger
    let operatorLedgerId = await resolveLedgerId(bill.operator_name, 'Supplier');
    if (!operatorLedgerId) {
      operatorLedgerId = 202; // Fallback
    }

    // 2. Resolve Expense Ledger "Cold Storage Rent & Handling Charges"
    let expenseLedgerId = 201;
    try {
      const expRow = await db.query("SELECT id FROM ledgermaster WHERE LOWER(name) LIKE '%cold storage%' LIMIT 1");
      if (expRow.rows && expRow.rows.length > 0) {
        expenseLedgerId = expRow.rows[0].id;
      }
    } catch (_) {}

    // 3. Resolve Input GST Ledgers
    let cgstInputId = 8;
    let sgstInputId = 9;
    let igstInputId = 10;
    try {
      const cRow = await db.query("SELECT id FROM ledgermaster WHERE LOWER(name) = 'cgst input' LIMIT 1");
      if (cRow.rows && cRow.rows.length > 0) cgstInputId = cRow.rows[0].id;
      const sRow = await db.query("SELECT id FROM ledgermaster WHERE LOWER(name) = 'sgst input' LIMIT 1");
      if (sRow.rows && sRow.rows.length > 0) sgstInputId = sRow.rows[0].id;
      const iRow = await db.query("SELECT id FROM ledgermaster WHERE LOWER(name) = 'igst input' LIMIT 1");
      if (iRow.rows && iRow.rows.length > 0) igstInputId = iRow.rows[0].id;
    } catch (_) {}

    const grandTotal = parseFloat(bill.grand_total || bill.operator_invoice_amount || 0);
    const taxableAmt = parseFloat(bill.taxable_amount || 0);
    const cgstAmt = parseFloat(bill.cgst_amount || 0);
    const sgstAmt = parseFloat(bill.sgst_amount || 0);
    const igstAmt = parseFloat(bill.igst_amount || 0);

    // Generate Journal Voucher No: VOC...
    const countResult = await db.query('SELECT COUNT(*) as count FROM voucher');
    const vNum = (countResult.rows?.[0]?.count || 0) + 1;
    const voucherNo = `VOC${vNum.toString().padStart(3, '0')}`;
    const vDate = bill.bill_date || new Date().toISOString().split('T')[0];
    const narration = `Cold Storage Charges for ${bill.cold_storage_name} (Inv #${bill.operator_invoice_no || bill.bill_no}) from ${bill.operator_name}`;

    // Insert into voucher
    const vInsert = await db.run(`
      INSERT INTO voucher (voucher_no, voucher_type, date, reference_no, narration, status, posted)
      VALUES (?, 'Journal', ?, ?, ?, 'Approved', 1)
    `, [voucherNo, vDate, bill.bill_no, narration]);
    const voucherId = vInsert.lastID || vInsert.lastInsertRowid;

    // Entries:
    // DR Cold Storage Expense (taxable amount)
    await db.run(`
      INSERT INTO voucher_entry (voucher_id, type, ledger_id, ledger_name, debit, credit, remarks)
      VALUES (?, 'Dr', ?, 'Cold Storage Rent & Handling Charges', ?, 0, ?)
    `, [voucherId, expenseLedgerId, taxableAmt, `Storage Rent & Handling (${bill.bill_no})`]);

    await db.run(`
      INSERT INTO ledger_entries (ledger_id, ledger_name, date, voucher_type, voucher_no, debit, credit, particulars, voucher_id)
      VALUES (?, 'Cold Storage Rent & Handling Charges', ?, 'Journal', ?, ?, 0, ?, ?)
    `, [expenseLedgerId, vDate, voucherNo, taxableAmt, narration, voucherId]);

    // DR CGST Input & SGST Input (if any)
    if (cgstAmt > 0) {
      await db.run(`
        INSERT INTO voucher_entry (voucher_id, type, ledger_id, ledger_name, debit, credit, remarks)
        VALUES (?, 'Dr', ?, 'CGST Input', ?, 0, 'CGST Input for Cold Storage')
      `, [voucherId, cgstInputId, cgstAmt]);
      await db.run(`
        INSERT INTO ledger_entries (ledger_id, ledger_name, date, voucher_type, voucher_no, debit, credit, particulars, voucher_id)
        VALUES (?, 'CGST Input', ?, 'Journal', ?, ?, 0, 'CGST Input for Cold Storage', ?)
      `, [cgstInputId, vDate, voucherNo, cgstAmt, voucherId]);
    }
    if (sgstAmt > 0) {
      await db.run(`
        INSERT INTO voucher_entry (voucher_id, type, ledger_id, ledger_name, debit, credit, remarks)
        VALUES (?, 'Dr', ?, 'SGST Input', ?, 0, 'SGST Input for Cold Storage')
      `, [voucherId, sgstInputId, sgstAmt]);
      await db.run(`
        INSERT INTO ledger_entries (ledger_id, ledger_name, date, voucher_type, voucher_no, debit, credit, particulars, voucher_id)
        VALUES (?, 'SGST Input', ?, 'Journal', ?, ?, 0, 'SGST Input for Cold Storage', ?)
      `, [sgstInputId, vDate, voucherNo, sgstAmt, voucherId]);
    }
    if (igstAmt > 0) {
      await db.run(`
        INSERT INTO voucher_entry (voucher_id, type, ledger_id, ledger_name, debit, credit, remarks)
        VALUES (?, 'Dr', ?, 'IGST Input', ?, 0, 'IGST Input for Cold Storage')
      `, [voucherId, igstInputId, igstAmt]);
      await db.run(`
        INSERT INTO ledger_entries (ledger_id, ledger_name, date, voucher_type, voucher_no, debit, credit, particulars, voucher_id)
        VALUES (?, 'IGST Input', ?, 'Journal', ?, ?, 0, 'IGST Input for Cold Storage', ?)
      `, [igstInputId, vDate, voucherNo, igstAmt, voucherId]);
    }

    // CR Operator Supplier Ledger (grand total)
    await db.run(`
      INSERT INTO voucher_entry (voucher_id, type, ledger_id, ledger_name, debit, credit, remarks)
      VALUES (?, 'Cr', ?, ?, 0, ?, ?)
    `, [voucherId, operatorLedgerId, bill.operator_name, grandTotal, `Payable for Cold Storage Bill ${bill.bill_no}`]);

    await db.run(`
      INSERT INTO ledger_entries (ledger_id, ledger_name, date, voucher_type, voucher_no, debit, credit, particulars, voucher_id)
      VALUES (?, ?, ?, 'Journal', ?, 0, ?, ?, ?)
    `, [operatorLedgerId, bill.operator_name, vDate, voucherNo, grandTotal, narration, voucherId]);

    // Update bill
    await db.run(`
      UPDATE cold_storage_bills 
      SET status = 'Approved', voucher_id = ?, voucher_no = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [voucherId, voucherNo, id]);

    res.json({
      success: true,
      message: `Bill #${bill.bill_no} approved and Accounts Voucher ${voucherNo} posted successfully!`,
      voucher_id: voucherId,
      voucher_no: voucherNo
    });
  } catch (err) {
    console.error('Error approving cold storage bill:', err);
    res.status(500).json({ success: false, message: 'Approval error: ' + err.message });
  }
});

// GET /bills - List all cold storage operator bills
router.get('/bills', async (req, res) => {
  try {
    await syncGodownTransfersToColdStorage();
    const { cold_storage_id, operator_id, status } = req.query;
    let query = 'SELECT * FROM cold_storage_bills WHERE 1=1';
    const params = [];
    if (cold_storage_id) {
      query += ' AND (cold_storage_id = ? OR CAST(cold_storage_id AS TEXT) = ?)';
      params.push(cold_storage_id, String(cold_storage_id));
    }
    if (operator_id) {
      query += ' AND (operator_id = ? OR CAST(operator_id AS TEXT) = ?)';
      params.push(operator_id, String(operator_id));
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    query += ' ORDER BY id DESC';
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /bills/:id - Fetch single bill details
router.get('/bills/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM cold_storage_bills WHERE id = ? OR bill_no = ?', [id, id]);
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }
    const bill = result.rows[0];
    try {
      bill.items = JSON.parse(bill.items_json || '[]');
    } catch (_) {
      bill.items = [];
    }
    res.json({ success: true, data: bill });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /bills/:id - Delete unapproved bill
router.delete('/bills/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const billRes = await db.query('SELECT * FROM cold_storage_bills WHERE id = ?', [id]);
    if (!billRes.rows || billRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }
    if (billRes.rows[0].status === 'Approved') {
      return res.status(400).json({ success: false, message: 'Cannot delete approved bill with posted accounts vouchers' });
    }
    await db.run('DELETE FROM cold_storage_bills WHERE id = ?', [id]);
    res.json({ success: true, message: 'Bill deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /operator-ledger - Returns ledger of bills and payments for cold storage operators
router.get('/operator-ledger', async (req, res) => {
  try {
    const { operator_name } = req.query;
    let query = `
      SELECT 
        le.id,
        le.date,
        le.voucher_type,
        le.voucher_no,
        le.debit,
        le.credit,
        le.particulars,
        le.ledger_name
      FROM ledger_entries le
      WHERE (
        LOWER(le.ledger_name) LIKE '%cold%' 
        OR LOWER(le.particulars) LIKE '%cold storage%'
        ${operator_name ? `OR LOWER(le.ledger_name) = LOWER(?)` : ''}
      )
      ORDER BY le.date ASC, le.id ASC
    `;
    const params = operator_name ? [operator_name] : [];
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/sync-stock', async (req, res) => {
  try {
    await syncColdStorageStock(db);
    res.json({ success: true, message: 'Cold Storage stock entries synchronized successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- Charge Master CRUD ---
router.get('/charges', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM cold_storage_charge_master WHERE status = "Active"');
    res.json({ success: true, data: result.rows || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- Tariff Configuration Endpoints ---
router.get('/tariff/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const tariff = await getColdStorageTariff(id, activeCompanyId);
    res.json({ success: true, data: tariff });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/tariff/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const {
      calculationType = 'Progressive',
      freeDays = 0,
      minDays = 1,
      inwardUnloadingRate = 0.50,
      outwardLoadingRate = 0.50,
      storageSlabs = []
    } = req.body || {};

    // 1. Update godown_master
    await db.run(`
      UPDATE godown_master SET
        slab_calculation_type = ?,
        billing_method = ?,
        free_storage_days = ?,
        min_billable_days = ?,
        inward_unloading_rate = ?,
        inward_handling_rate = ?,
        outward_loading_rate = ?,
        outward_handling_rate = ?
      WHERE id = ? OR CAST(id AS TEXT) = ?
    `, [
      calculationType,
      calculationType,
      parseInt(freeDays, 10) || 0,
      parseInt(minDays, 10) || 1,
      parseFloat(inwardUnloadingRate) || 0.50,
      parseFloat(inwardUnloadingRate) || 0.50,
      parseFloat(outwardLoadingRate) || 0.50,
      parseFloat(outwardLoadingRate) || 0.50,
      id,
      String(id)
    ]);

    // 2. Mark old slabs as Inactive
    await db.run(`
      UPDATE cold_storage_charge_master SET status = 'Inactive'
      WHERE (cold_storage_id = ? OR CAST(cold_storage_id AS TEXT) = ?)
    `, [id, String(id)]);

    // 3. Insert new storage slabs
    if (Array.isArray(storageSlabs) && storageSlabs.length > 0) {
      for (const slab of storageSlabs) {
        const start = parseInt(slab.slab_start_day, 10) || 1;
        const end = slab.slab_end_day ? parseInt(slab.slab_end_day, 10) : 99999;
        const rate = parseFloat(slab.rate) || 0;
        await db.run(`
          INSERT INTO cold_storage_charge_master 
          (cold_storage_id, charge_name, charge_type, slab_start_day, slab_end_day, rate, billing_basis, billing_method, slab_calculation_type, status)
          VALUES (?, ?, 'Storage', ?, ?, ?, 'Per KG/Day', ?, ?, 'Active')
        `, [
          id,
          `Storage Rent (Days ${start}–${end === 99999 ? 'Beyond' : end})`,
          start,
          end,
          rate,
          calculationType,
          calculationType
        ]);
      }
    }

    // 4. Insert Labour handling rates
    await db.run(`
      INSERT INTO cold_storage_charge_master 
      (cold_storage_id, charge_name, charge_type, slab_start_day, slab_end_day, rate, billing_basis, billing_method, slab_calculation_type, status)
      VALUES (?, 'Inward Unloading Labour', 'Inward Unloading', 0, 0, ?, 'Per KG', 'Per Operation', 'Fixed', 'Active')
    `, [id, parseFloat(inwardUnloadingRate) || 0.50]);

    await db.run(`
      INSERT INTO cold_storage_charge_master 
      (cold_storage_id, charge_name, charge_type, slab_start_day, slab_end_day, rate, billing_basis, billing_method, slab_calculation_type, status)
      VALUES (?, 'Outward Loading Labour', 'Outward Loading', 0, 0, ?, 'Per KG', 'Per Operation', 'Fixed', 'Active')
    `, [id, parseFloat(outwardLoadingRate) || 0.50]);

    const updated = await getColdStorageTariff(id, activeCompanyId);
    res.json({ success: true, message: 'Cold Storage tariff and day slabs updated successfully', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /purchase-statement/:purchaseId - Detailed Cold Storage Purchase Bill Statement
router.get('/purchase-statement/:purchaseId', async (req, res) => {
  try {
    const { purchaseId } = req.params;
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);

    // 1. Fetch Purchase record
    const pRes = await db.query(`
      SELECT p.*,
        sm.name as supplier_name, sm.phone_off as supplier_phone, sm.gst_number as supplier_gst,
        COALESCE(tm.print_name, tm.name, p.transporter, p.transport, '') as resolved_transporter_name
      FROM purchases p
      LEFT JOIN supplier_master sm ON (CAST(sm.id AS TEXT) = CAST(p.supplier AS TEXT) OR sm.name = p.supplier OR sm.print_name = p.supplier)
      LEFT JOIN transport_master tm ON (CAST(tm.id AS TEXT) = CAST(p.transporter AS TEXT) OR CAST(tm.id AS TEXT) = CAST(p.transport AS TEXT) OR tm.name = p.transporter OR tm.print_name = p.transporter)
      WHERE p.id = ? OR p.inv_no = ?
    `, [purchaseId, purchaseId], activeCompanyId);

    if (!pRes.rows || pRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Purchase record not found' });
    }
    const purchase = pRes.rows[0];

    // Resolve transporter name if numeric ID stored
    let finalTransporterName = purchase.resolved_transporter_name || purchase.transporter || purchase.transport || 'N/A';
    if (/^\d+$/.test(String(finalTransporterName).trim())) {
      try {
        const tmRes = await db.query('SELECT print_name, name FROM transport_master WHERE id = ?', [finalTransporterName], activeCompanyId);
        if (tmRes.rows && tmRes.rows[0]) {
          finalTransporterName = tmRes.rows[0].print_name || tmRes.rows[0].name;
        }
      } catch (_) {}
    }
    if (!finalTransporterName || /^\d+$/.test(String(finalTransporterName).trim())) {
      finalTransporterName = 'Self / Direct Transport';
    }

    // 2. Fetch purchase items
    const piRes = await db.query(`
      SELECT pi.*, COALESCE(pi.total_wt, pi.qty * COALESCE(pi.weight, 50)) as calculated_total_wt
      FROM purchase_items pi
      WHERE pi.purchase_id = ?
    `, [purchase.id], activeCompanyId);
    const purchaseItems = piRes.rows || [];

    // 3. Resolve Cold Storage Godown & Tariff
    let csGodownId = 2; // Default BTS Cold Storage
    if (purchase.godown) {
      try {
        const gRes = await db.query(`SELECT id FROM godown_master WHERE id = ? OR LOWER(godown_name) = LOWER(?)`, [purchase.godown, purchase.godown]);
        if (gRes.rows && gRes.rows[0]) csGodownId = gRes.rows[0].id;
      } catch (_) {}
    }
    const tariff = await getColdStorageTariff(csGodownId, activeCompanyId);

    // 4. Fetch linked Cold Storage Bill
    const billRes = await db.query(`
      SELECT * FROM cold_storage_bills 
      WHERE purchase_id = ? OR (purchase_id IS NULL AND operator_invoice_no = ?)
      ORDER BY id DESC LIMIT 1
    `, [purchase.id, purchase.inv_no || purchase.invoice_no || ''], activeCompanyId);
    const linkedBill = (billRes.rows && billRes.rows[0]) ? billRes.rows[0] : null;

    const loadmanName = linkedBill?.loadman_name || purchase.loadman_name || 'Inward Unloading Team';
    const loadmanChargesVal = linkedBill?.loadman_charges !== undefined ? parseFloat(linkedBill.loadman_charges) : null;
    const insuranceChargesVal = linkedBill?.insurance_charges !== undefined ? parseFloat(linkedBill.insurance_charges) : parseFloat(purchase.insurance_charges || 0);

    // 5. Build Itemized Charges & Stored Days
    const todayStr = new Date().toISOString().split('T')[0];
    const itemizedDetails = purchaseItems.map(pi => {
      const qty = parseFloat(pi.qty || 0);
      const perWt = parseFloat(pi.weight || pi.per_unit_weight || 50);
      const totalWt = parseFloat(pi.calculated_total_wt || (qty * perWt));
      const inwardDate = purchase.date || todayStr;

      const daysInfo = calculateStorageDays(inwardDate, todayStr, tariff.freeDays, tariff.minDays);
      const storageCalc = calculateSlabStorageCharge({
        qtyKg: totalWt,
        billableDays: daysInfo.billableDays,
        slabs: tariff.storageSlabs,
        calculationType: tariff.calculationType
      });
      const labourCalc = calculateLabourCharge({
        qtyKg: totalWt,
        ratePerKg: tariff.inwardUnloadingRate
      });

      return {
        item_name: pi.item_name,
        purchase_lot_no: pi.lot_no || purchase.s_no,
        cold_storage_lot_no: pi.lot_no ? (pi.lot_no.startsWith('CS-') ? pi.lot_no : `CS-${pi.lot_no}`) : `CS-${purchase.s_no}`,
        qty,
        per_unit_weight: perWt,
        total_weight: totalWt,
        inward_date: inwardDate,
        storage_days: daysInfo.calendarDays,
        billable_days: daysInfo.billableDays,
        unloading_rate: tariff.inwardUnloadingRate,
        unloading_charge: labourCalc.totalCharge,
        storage_charge: storageCalc.totalCharge,
        total_item_charge: Number((labourCalc.totalCharge + storageCalc.totalCharge).toFixed(2))
      };
    });

    const calculatedUnloading = itemizedDetails.reduce((s, i) => s + i.unloading_charge, 0);
    const totalUnloading = loadmanChargesVal !== null && loadmanChargesVal > 0 ? loadmanChargesVal : calculatedUnloading;
    const totalStorage = itemizedDetails.reduce((s, i) => s + i.storage_charge, 0);
    const totalInsurance = insuranceChargesVal || 0;
    const taxableAmt = totalUnloading + totalStorage + totalInsurance;
    const taxRate = tariff.gst_rate || 18;
    const totalTax = Number((taxableAmt * (taxRate / 100)).toFixed(2));
    const grandTotal = Number((taxableAmt + totalTax).toFixed(2));

    res.json({
      success: true,
      data: {
        purchase_id: purchase.id,
        inv_no: purchase.inv_no || purchase.invoice_no || `PUR-${purchase.id}`,
        purchase_date: purchase.date,
        supplier_name: purchase.supplier_name || purchase.supplier,
        supplier_phone: purchase.supplier_phone || '',
        supplier_gst: purchase.supplier_gst || '',
        vehicle_no: purchase.lorry_no || purchase.vehicle_no || 'N/A',
        driver_name: purchase.driver_name || purchase.driver || 'N/A',
        driver_phone: purchase.driver_phone || '',
        transporter_name: finalTransporterName,
        loadman_name: loadmanName,
        loadman_charges: Number(totalUnloading.toFixed(2)),
        insurance_charges: Number(totalInsurance.toFixed(2)),
        lr_no: purchase.lr_no || 'N/A',
        gate_pass_no: purchase.gate_pass_no || 'N/A',
        cold_storage_id: tariff.coldStorageId,
        cold_storage_name: tariff.godownName,
        operator_id: tariff.operatorId,
        operator_name: tariff.operatorName,
        tariff_terms: {
          calculation_type: tariff.calculationType,
          free_days: tariff.freeDays,
          min_days: tariff.minDays,
          inward_unloading_rate: tariff.inwardUnloadingRate,
          outward_loading_rate: tariff.outwardLoadingRate,
          storage_slabs: tariff.storageSlabs
        },
        items: itemizedDetails,
        financial_summary: {
          unloading_charges: Number(totalUnloading.toFixed(2)),
          accrued_storage_charges: Number(totalStorage.toFixed(2)),
          insurance_charges: Number(totalInsurance.toFixed(2)),
          taxable_amount: Number(taxableAmt.toFixed(2)),
          tax_rate: taxRate,
          cgst_amount: Number((totalTax / 2).toFixed(2)),
          sgst_amount: Number((totalTax / 2).toFixed(2)),
          igst_amount: 0,
          total_tax: totalTax,
          grand_total: grandTotal
        },
        linked_bill: linkedBill ? {
          bill_id: linkedBill.id,
          bill_no: linkedBill.bill_no,
          bill_date: linkedBill.bill_date,
          status: linkedBill.status,
          paid_amount: linkedBill.paid_amount || 0,
          balance_amount: linkedBill.balance_amount || linkedBill.grand_total || grandTotal,
          voucher_no: linkedBill.voucher_no || 'Pending'
        } : null
      }
    });
  } catch (err) {
    console.error('Error fetching statement:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /transfer-statement/:id - Fetch Cold Storage Transfer Bill Statement details for a Godown Transfer
router.get('/transfer-statement/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);

    // 1. Trigger transfer sync to ensure vouchers and bills exist
    try {
      const { syncGodownTransfersToColdStorage } = require('../services/coldStorageTransferSync');
      await syncGodownTransfersToColdStorage(activeCompanyId);
    } catch (e) {
      console.warn('Sync notice in transfer-statement:', e.message);
    }

    // 2. Fetch transfer entry from godown_transfers or item_transfers
    let transferRes = await db.query('SELECT * FROM godown_transfers WHERE id = ? OR s_no = ?', [id, id], activeCompanyId);
    let transfer = transferRes.rows?.[0];
    if (!transfer) {
      const itRes = await db.query('SELECT * FROM item_transfers WHERE id = ? OR transfer_no = ?', [id, id], activeCompanyId);
      const itRow = itRes.rows?.[0];
      if (itRow) {
        transfer = {
          id: itRow.id,
          s_no: itRow.transfer_no || `TRF-${itRow.id}`,
          transfer_date: itRow.date,
          from_godown_id: itRow.from_godown_id,
          from_godown_name: itRow.from_godown_name,
          to_godown_id: itRow.to_godown_id,
          to_godown_name: itRow.to_godown_name,
          item_name: itRow.item_name,
          lot_no: itRow.lot_no,
          qty: itRow.transfer_qty || itRow.qty,
          weight: itRow.weight ? itRow.weight * (itRow.transfer_qty || 1) : 0,
          vehicle_no: itRow.vehicle_no || '',
          driver_name: itRow.driver_name || '',
          driver_phone: itRow.driver_phone || '',
          transporter_name: itRow.transporter_name || '',
          loadman_name: itRow.loadman_name || '',
          loadman_charges: itRow.loadman_charges || 0,
          handling_amount: itRow.handling_amount || 0,
          storage_rate: itRow.storage_rate || 0,
          insurance_charges: itRow.insurance_charges || 0,
          remarks: itRow.remarks || ''
        };
      }
    }

    if (!transfer) {
      return res.status(404).json({ success: false, message: 'Transfer record not found' });
    }

    // 3. Resolve Godown & tariff
    let csGodownId = transfer.from_godown_id;
    let transferType = 'OUTWARD';
    const fromGodownRes = await db.query(
      'SELECT id, godown_name, godown_type, storage_location, is_cold_storage FROM godown_master WHERE id = ? OR LOWER(godown_name) = LOWER(?) LIMIT 1',
      [transfer.from_godown_id, transfer.from_godown_name],
      activeCompanyId
    );
    const toGodownRes = await db.query(
      'SELECT id, godown_name, godown_type, storage_location, is_cold_storage FROM godown_master WHERE id = ? OR LOWER(godown_name) = LOWER(?) LIMIT 1',
      [transfer.to_godown_id, transfer.to_godown_name],
      activeCompanyId
    );

    const fromGodown = fromGodownRes.rows?.[0];
    const toGodown = toGodownRes.rows?.[0];

    const isFromCS = fromGodown && (
      (fromGodown.godown_type && fromGodown.godown_type.toLowerCase().includes('cold')) ||
      (fromGodown.godown_name && fromGodown.godown_name.toLowerCase().includes('cold')) ||
      fromGodown.is_cold_storage === 1 || String(fromGodown.id) === '2'
    );
    const isToCS = toGodown && (
      (toGodown.godown_type && toGodown.godown_type.toLowerCase().includes('cold')) ||
      (toGodown.godown_name && toGodown.godown_name.toLowerCase().includes('cold')) ||
      toGodown.is_cold_storage === 1 || String(toGodown.id) === '2'
    );

    if (isToCS && !isFromCS) {
      csGodownId = transfer.to_godown_id;
      transferType = 'INWARD';
    } else if (isFromCS) {
      csGodownId = transfer.from_godown_id;
      transferType = 'OUTWARD';
    }

    const tariff = await getColdStorageTariff(csGodownId, activeCompanyId);

    // 4. Find matching Cold Storage Voucher and Bill
    const remarksSearch = `Auto-created from Godown Transfer ${transfer.s_no} (ID ${transfer.id})`;
    const voucherRes = await db.query(
      'SELECT * FROM cold_storage_vouchers WHERE remarks = ? OR remarks LIKE ? LIMIT 1',
      [remarksSearch, `%Transfer ${transfer.s_no}%`],
      activeCompanyId
    );
    const voucher = voucherRes.rows?.[0];

    let billRes = null;
    if (voucher) {
      billRes = await db.query(
        'SELECT * FROM cold_storage_bills WHERE voucher_id = ? OR voucher_no = ? LIMIT 1',
        [voucher.id, voucher.voucher_no],
        activeCompanyId
      );
    }
    const linkedBill = billRes?.rows?.[0] || null;

    // 5. Transporter name lookup
    let finalTransporterName = transfer.transporter_name || voucher?.transporter_name || '';
    if (/^\d+$/.test(String(finalTransporterName).trim())) {
      try {
        const tmRes = await db.query('SELECT print_name, name FROM transport_master WHERE id = ?', [finalTransporterName], activeCompanyId);
        if (tmRes.rows && tmRes.rows[0]) {
          finalTransporterName = tmRes.rows[0].print_name || tmRes.rows[0].name;
        }
      } catch (_) {}
    }

    // 6. Calculate stored days & charges
    const trfDate = transfer.transfer_date || new Date().toISOString().split('T')[0];
    let inwardDate = trfDate;

    if (transferType === 'OUTWARD') {
      try {
        const rawLot = String(transfer.lot_no || '').replace(/^CS-/, '');
        const inLookup = await db.query(`
          SELECT csi.inward_date, csv.voucher_date
          FROM cold_storage_items csi
          JOIN cold_storage_vouchers csv ON csi.voucher_id = csv.id
          WHERE csv.voucher_type = 'IN'
            AND (LOWER(TRIM(csi.cold_storage_lot_no)) = LOWER(TRIM(?)) OR LOWER(TRIM(csi.purchase_lot_no)) = LOWER(TRIM(?)))
          ORDER BY csi.id DESC LIMIT 1
        `, [rawLot, rawLot], activeCompanyId);
        if (inLookup.rows && inLookup.rows[0]) {
          inwardDate = inLookup.rows[0].inward_date || inLookup.rows[0].voucher_date || trfDate;
        }
      } catch (_) {}
    }

    const { calendarDays, billableDays } = calculateStorageDays(inwardDate, trfDate, tariff.freeDays, tariff.minDays);
    const quantity = Number(transfer.qty) || 0;
    const totalWeight = Number(transfer.weight) || (quantity * 50);
    const perUnitWeight = quantity > 0 ? totalWeight / quantity : 50;

    const storageCalc = calculateSlabStorageCharge({
      qtyKg: totalWeight,
      billableDays: transferType === 'OUTWARD' ? billableDays : 0,
      slabs: tariff.storageSlabs,
      calculationType: tariff.calculationType
    });

    const handlingRate = transferType === 'INWARD' ? (tariff.inwardUnloadingRate || 0.50) : (tariff.outwardLoadingRate || 0.50);
    const defaultHandling = Number((totalWeight * handlingRate).toFixed(2));
    
    const loadmanChargesVal = parseFloat(transfer.handling_amount || transfer.loadman_charges || voucher?.loadman_charges || linkedBill?.loadman_charges || defaultHandling);
    const storageChargesVal = parseFloat(voucher?.storage_charges || linkedBill?.storage_charges || storageCalc.totalCharge);
    const insuranceChargesVal = parseFloat(transfer.insurance_charges || voucher?.additional_charges || linkedBill?.insurance_charges || 0);

    const taxableAmt = loadmanChargesVal + storageChargesVal + insuranceChargesVal;
    const taxRate = tariff.gstRate || 18;
    const totalTax = Number((taxableAmt * (taxRate / 100)).toFixed(2));
    const grandTotal = Number((taxableAmt + totalTax).toFixed(2));

    res.json({
      success: true,
      data: {
        transfer_id: transfer.id,
        s_no: transfer.s_no,
        transfer_date: trfDate,
        transfer_type: transferType,
        from_godown_name: transfer.from_godown_name,
        to_godown_name: transfer.to_godown_name,
        cold_storage_id: tariff.coldStorageId,
        cold_storage_name: tariff.godownName,
        operator_id: tariff.operatorId,
        operator_name: tariff.operatorName,
        vehicle_no: transfer.vehicle_no || voucher?.vehicle_no || 'N/A',
        driver_name: transfer.driver_name || voucher?.driver_name || 'N/A',
        driver_phone: transfer.driver_phone || voucher?.driver_phone || '',
        transporter_name: finalTransporterName || voucher?.transporter_name || 'N/A',
        loadman_name: transfer.loadman_name || voucher?.loadman_name || 'Handling Team',
        tariff_terms: {
          calculation_type: tariff.calculationType,
          free_days: tariff.freeDays,
          min_days: tariff.minDays,
          inward_unloading_rate: tariff.inwardUnloadingRate,
          outward_loading_rate: tariff.outwardLoadingRate,
          storage_slabs: tariff.storageSlabs
        },
        items: [{
          item_name: transfer.item_name,
          lot_no: transfer.lot_no,
          cold_storage_lot_no: transfer.lot_no ? (transfer.lot_no.startsWith('CS-') ? transfer.lot_no : `CS-${transfer.lot_no}`) : `CS-${transfer.s_no}`,
          qty: quantity,
          per_unit_weight: perUnitWeight,
          total_weight: totalWeight,
          inward_date: inwardDate,
          outward_date: trfDate,
          storage_days: calendarDays,
          billable_days: billableDays,
          unloading_charge: loadmanChargesVal,
          storage_charge: storageChargesVal,
          total_item_charge: loadmanChargesVal + storageChargesVal
        }],
        financial_summary: {
          handling_charges: Number(loadmanChargesVal.toFixed(2)),
          storage_charges: Number(storageChargesVal.toFixed(2)),
          insurance_charges: Number(insuranceChargesVal.toFixed(2)),
          taxable_amount: Number(taxableAmt.toFixed(2)),
          tax_rate: taxRate,
          cgst_amount: Number((totalTax / 2).toFixed(2)),
          sgst_amount: Number((totalTax / 2).toFixed(2)),
          igst_amount: 0,
          total_tax: totalTax,
          grand_total: grandTotal
        },
        linked_bill: linkedBill ? {
          bill_id: linkedBill.id,
          bill_no: linkedBill.bill_no,
          bill_date: linkedBill.bill_date,
          status: linkedBill.status,
          paid_amount: linkedBill.paid_amount || 0,
          balance_amount: linkedBill.balance_amount || linkedBill.grand_total || grandTotal,
          voucher_no: linkedBill.voucher_no || voucher?.voucher_no || 'Pending'
        } : (voucher ? {
          bill_id: null,
          bill_no: `CSB-${voucher.voucher_no}`,
          bill_date: voucher.voucher_date,
          status: 'Generated',
          paid_amount: 0,
          balance_amount: grandTotal,
          voucher_no: voucher.voucher_no
        } : null)
      }
    });
  } catch (err) {
    console.error('Error fetching cold storage transfer statement:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
module.exports.syncColdStorageStock = syncColdStorageStock;
