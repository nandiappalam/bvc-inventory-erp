const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { rebuildStockLedger } = require('../utils/stockRebuilder');

// Initialize cold storage tables if not created
const initTables = async () => {
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS cold_storage_vouchers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        voucher_no TEXT UNIQUE NOT NULL,
        voucher_type TEXT NOT NULL,
        voucher_date TEXT NOT NULL,
        cold_storage_id INTEGER,
        cold_storage_name TEXT NOT NULL,
        source_godown_id INTEGER,
        source_godown_name TEXT,
        destination_godown_id INTEGER,
        destination_godown_name TEXT,
        remarks TEXT,
        total_qty REAL DEFAULT 0,
        total_wt REAL DEFAULT 0,
        created_by TEXT DEFAULT 'Admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS cold_storage_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        voucher_id INTEGER NOT NULL,
        voucher_no TEXT NOT NULL,
        item_id INTEGER,
        item_name TEXT NOT NULL,
        purchase_lot_no TEXT NOT NULL,
        cold_storage_lot_no TEXT NOT NULL,
        quantity REAL DEFAULT 0,
        weight REAL DEFAULT 0,
        total_wt REAL DEFAULT 0,
        unit TEXT DEFAULT 'KG',
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (voucher_id) REFERENCES cold_storage_vouchers(id) ON DELETE CASCADE
      )
    `);
  } catch (err) {
    console.error('Error initializing cold storage tables:', err.message);
  }
};
initTables();

// Ensure all cold storage transfers reflect in the stock table for reports and ledgers
const syncColdStorageStock = async (dbInstance = db) => {
  try {
    const vouchersRes = await dbInstance.query(`SELECT * FROM cold_storage_vouchers ORDER BY voucher_date ASC, id ASC`);
    const vouchers = vouchersRes.rows || [];
    if (vouchers.length === 0) return;

    for (const v of vouchers) {
      // Check if stock has entries for this voucher
      const existingStock = await dbInstance.query(`
        SELECT COUNT(*) as count FROM stock 
        WHERE reference_id = ? AND (type LIKE 'Cold Storage%' OR type LIKE 'CS %')
      `, [v.id]);

      const count = parseInt(existingStock.rows?.[0]?.count || 0, 10);
      if (count > 0) continue; // already recorded

      const itemsRes = await dbInstance.query(`
        SELECT * FROM cold_storage_items WHERE voucher_id = ?
      `, [v.id]);
      const items = itemsRes.rows || [];

      for (const itm of items) {
        const qty = parseFloat(itm.quantity || 0);
        const wt = parseFloat(itm.weight || 1);
        const totWt = parseFloat(itm.total_wt || (qty * wt));
        const lotNo = itm.purchase_lot_no && itm.purchase_lot_no !== 'N/A' ? itm.purchase_lot_no : itm.cold_storage_lot_no;

        if (v.voucher_type === 'IN') {
          let srcGodownName = v.source_godown_name;
          let srcGodownId = v.source_godown_id;

          if (!srcGodownName || srcGodownName === 'Main Godown') {
            try {
              const pLookup = await dbInstance.query(`
                SELECT COALESCE(g.godown_name, p.godown) as godown_name, COALESCE(g.id, 3) as godown_id
                FROM purchases p
                JOIN purchase_items pi ON pi.purchase_id = p.id
                LEFT JOIN godown_master g ON (CAST(p.godown AS TEXT) = CAST(g.id AS TEXT) OR LOWER(TRIM(p.godown)) = LOWER(TRIM(g.godown_name)))
                WHERE pi.lot_no = ?
                ORDER BY p.id DESC LIMIT 1
              `, [itm.purchase_lot_no]);
              if (pLookup.rows && pLookup.rows.length > 0 && pLookup.rows[0].godown_name) {
                srcGodownName = pLookup.rows[0].godown_name;
                srcGodownId = pLookup.rows[0].godown_id;
              }
            } catch (e) {}
          }
          if (!srcGodownName) srcGodownName = 'Raw Material Godown';

          // 1. Outward from source godown
          await dbInstance.run(`
            INSERT INTO stock (date, item_id, item_name, lot_no, type, qty, weight, rate, amount, godown, godown_id, reference_id, remarks)
            VALUES (?, ?, ?, ?, 'Cold Storage Transfer Out', ?, ?, 0, 0, ?, ?, ?, ?)
          `, [
            v.voucher_date,
            itm.item_id || null,
            itm.item_name,
            lotNo,
            -Math.abs(qty),
            -Math.abs(totWt),
            srcGodownName,
            srcGodownId || null,
            v.id,
            `[${v.voucher_no}] Transferred to Cold Storage: ${v.cold_storage_name || 'Cold Storage'} (CS Lot: ${itm.cold_storage_lot_no || ''})`
          ]);

          // 2. Inward to Cold Storage godown
          await dbInstance.run(`
            INSERT INTO stock (date, item_id, item_name, lot_no, type, qty, weight, rate, amount, godown, godown_id, reference_id, remarks)
            VALUES (?, ?, ?, ?, 'Cold Storage In', ?, ?, 0, 0, ?, ?, ?, ?)
          `, [
            v.voucher_date,
            itm.item_id || null,
            itm.item_name,
            lotNo,
            Math.abs(qty),
            Math.abs(totWt),
            v.cold_storage_name || 'Cold Storage',
            v.cold_storage_id || null,
            v.id,
            `[${v.voucher_no}] Received in Cold Storage from ${srcGodownName} (CS Lot: ${itm.cold_storage_lot_no || ''})`
          ]);
        } else if (v.voucher_type === 'OUT') {
          let destGodownName = v.destination_godown_name || 'Main Godown';
          let destGodownId = v.destination_godown_id;
          if (!destGodownId) {
            try {
              const gLookup = await dbInstance.query(`SELECT id FROM godown_master WHERE LOWER(TRIM(godown_name)) = LOWER(TRIM(?)) LIMIT 1`, [destGodownName]);
              if (gLookup.rows && gLookup.rows.length > 0) {
                destGodownId = gLookup.rows[0].id;
              }
            } catch (e) {}
          }

          // 1. Outward from Cold Storage godown
          await dbInstance.run(`
            INSERT INTO stock (date, item_id, item_name, lot_no, type, qty, weight, rate, amount, godown, godown_id, reference_id, remarks)
            VALUES (?, ?, ?, ?, 'Cold Storage Transfer Out', ?, ?, 0, 0, ?, ?, ?, ?)
          `, [
            v.voucher_date,
            itm.item_id || null,
            itm.item_name,
            lotNo,
            -Math.abs(qty),
            -Math.abs(totWt),
            v.cold_storage_name || 'Cold Storage',
            v.cold_storage_id || null,
            v.id,
            `[${v.voucher_no}] Transferred from Cold Storage to ${destGodownName} (CS Lot: ${itm.cold_storage_lot_no || ''})`
          ]);

          // 2. Inward to Destination godown
          await dbInstance.run(`
            INSERT INTO stock (date, item_id, item_name, lot_no, type, qty, weight, rate, amount, godown, godown_id, reference_id, remarks)
            VALUES (?, ?, ?, ?, 'Cold Storage Transfer In', ?, ?, 0, 0, ?, ?, ?, ?)
          `, [
            v.voucher_date,
            itm.item_id || null,
            itm.item_name,
            lotNo,
            Math.abs(qty),
            Math.abs(totWt),
            destGodownName,
            destGodownId || null,
            v.id,
            `[${v.voucher_no}] Received from Cold Storage: ${v.cold_storage_name || 'Cold Storage'} (CS Lot: ${itm.cold_storage_lot_no || ''})`
          ]);
        }
      }
    }
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
    const result = await db.query(
      `SELECT * FROM godown_master WHERE (godown_type = 'Cold Storage' OR storage_location = 'Outside Factory' OR LOWER(godown_name) LIKE '%cold%') AND status = 'Active'`
    );
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
          COALESCE(g.godown_name, p.godown, 'Raw Material Godown') AS current_godown,
          COALESCE(g.id, p.godown_id, 3) AS current_godown_id,
          SUM(pi.qty) AS purchased_qty,
          SUM(COALESCE(pi.total_wt, pi.qty * COALESCE(pi.weight, 0), pi.qty)) AS total_weight,
          COALESCE(NULLIF(MAX(pi.weight), 0), NULLIF(MAX(pi.per_unit_weight), 0), 1) AS weight,
          COALESCE(NULLIF(MAX(pi.weight), 0), NULLIF(MAX(pi.per_unit_weight), 0), 1) AS per_weight,
          COALESCE(pi.unit, 'KG') AS unit
        FROM purchase_items pi
        LEFT JOIN purchases p ON pi.purchase_id = p.id
        LEFT JOIN godown_master g ON (CAST(p.godown AS TEXT) = CAST(g.id AS TEXT) OR LOWER(TRIM(p.godown)) = LOWER(TRIM(g.godown_name)))
        WHERE pi.lot_no IS NOT NULL AND pi.lot_no != ''
        GROUP BY pi.item_name, pi.lot_no, g.godown_name, p.godown, g.id, p.godown_id, pi.unit
        ORDER BY pi.item_name, pi.lot_no
      `);
    } catch (colErr) {
      console.warn('Fallback available-lots query due to schema discrepancy:', colErr.message);
      try {
        result = await db.query(`
          SELECT 
            pi.item_name,
            pi.lot_no AS purchase_lot_no,
            'Raw Material Godown' AS current_godown,
            3 AS current_godown_id,
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
    const { cold_storage_id, item_name, search } = req.query;

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
        csi.unit
      FROM cold_storage_items csi
      JOIN cold_storage_vouchers csv ON csi.voucher_id = csv.id
      WHERE 1=1
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

    const stock = (result.rows || []).map(r => {
      const inQty = parseFloat(r.in_qty || 0);
      const outQty = parseFloat(r.out_qty || 0);
      const availQty = inQty - outQty;
      const inWt = parseFloat(r.in_wt || 0);
      const outWt = parseFloat(r.out_wt || 0);
      const availWt = inWt - outWt;
      const perWt = parseFloat(r.weight || (availQty > 0 ? availWt / availQty : 1)) || 1;

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
      };
    }).filter(r => {
      if (search) {
        const s = search.toLowerCase();
        return (
          r.item_name.toLowerCase().includes(s) ||
          r.purchase_lot_no.toLowerCase().includes(s) ||
          r.cold_storage_lot_no.toLowerCase().includes(s) ||
          r.cold_storage_name.toLowerCase().includes(s)
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
        SUM(CASE WHEN csv.voucher_type = 'IN' THEN csi.quantity ELSE 0 END) - 
        SUM(CASE WHEN csv.voucher_type = 'OUT' THEN csi.quantity ELSE 0 END) AS available_qty,
        SUM(CASE WHEN csv.voucher_type = 'IN' THEN csi.total_wt ELSE 0 END) - 
        SUM(CASE WHEN csv.voucher_type = 'OUT' THEN csi.total_wt ELSE 0 END) AS available_wt,
        COALESCE(NULLIF(MAX(csi.weight), 0), 1) AS weight,
        COALESCE(NULLIF(MAX(csi.weight), 0), 1) AS per_weight,
        csi.unit
      FROM cold_storage_items csi
      JOIN cold_storage_vouchers csv ON csi.voucher_id = csv.id
      WHERE csv.cold_storage_id = ? OR CAST(csv.cold_storage_id AS TEXT) = ?
      GROUP BY csi.item_name, csi.purchase_lot_no, csi.cold_storage_lot_no, csv.cold_storage_id, csv.cold_storage_name, csi.unit
      HAVING (SUM(CASE WHEN csv.voucher_type = 'IN' THEN csi.quantity ELSE 0 END) - SUM(CASE WHEN csv.voucher_type = 'OUT' THEN csi.quantity ELSE 0 END)) > 0
      ORDER BY csi.item_name, csi.cold_storage_lot_no
    `;

    const result = await db.query(query, [cold_storage_id, String(cold_storage_id)]);
    const formatted = (result.rows || []).map(r => {
      const availQty = parseFloat(r.available_qty || 0);
      const availWt = parseFloat(r.available_wt || 0);
      const perWt = parseFloat(r.weight || r.per_weight || (availQty > 0 ? (availWt / availQty) : 1)) || 1;
      return {
        ...r,
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

    const voucherRes = await db.query(`
      INSERT INTO cold_storage_vouchers 
      (voucher_no, voucher_type, voucher_date, cold_storage_id, cold_storage_name, source_godown_id, source_godown_name, remarks, total_qty, total_wt, created_by)
      VALUES (?, 'IN', ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      createdBy
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
      if (!csLotNo) {
        csLotNo = `CS-${String(nextCsNum).padStart(4, '0')}`;
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
            SELECT COALESCE(g.godown_name, p.godown) as godown_name, COALESCE(g.id, p.godown_id, 3) as godown_id
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
      if (!actualSrcGodownName) actualSrcGodownName = 'Raw Material Godown';

      const lotNo = item.purchase_lot_no && item.purchase_lot_no !== 'N/A' ? item.purchase_lot_no : csLotNo;

      // 1. Outward from source godown
      await db.run(`
        INSERT INTO stock (date, item_id, item_name, lot_no, type, qty, weight, rate, amount, godown, godown_id, reference_id, remarks)
        VALUES (?, ?, ?, ?, 'Cold Storage Transfer Out', ?, ?, 0, 0, ?, ?, ?, ?)
      `, [
        voucher_date || new Date().toISOString().split('T')[0],
        item.item_id || null,
        item.item_name,
        lotNo,
        -Math.abs(qty),
        -Math.abs(totWt),
        actualSrcGodownName,
        actualSrcGodownId || null,
        voucher_id,
        `[${voucher_no}] Transferred to Cold Storage: ${cold_storage_name} (CS Lot: ${csLotNo})`
      ]);

      // 2. Inward to Cold Storage godown
      await db.run(`
        INSERT INTO stock (date, item_id, item_name, lot_no, type, qty, weight, rate, amount, godown, godown_id, reference_id, remarks)
        VALUES (?, ?, ?, ?, 'Cold Storage In', ?, ?, 0, 0, ?, ?, ?, ?)
      `, [
        voucher_date || new Date().toISOString().split('T')[0],
        item.item_id || null,
        item.item_name,
        lotNo,
        Math.abs(qty),
        Math.abs(totWt),
        cold_storage_name,
        cold_storage_id || null,
        voucher_id,
        `[${voucher_no}] Received in Cold Storage from ${actualSrcGodownName} (CS Lot: ${csLotNo})`
      ]);
    }

    try {
      await rebuildStockLedger();
    } catch (rErr) {
      console.warn('Rebuild ledger after CS IN warning:', rErr.message);
    }

    res.json({ success: true, message: `Cold Storage IN Voucher ${voucher_no} saved successfully`, voucher_no, id: voucher_id });
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

    const voucherRes = await db.query(`
      INSERT INTO cold_storage_vouchers 
      (voucher_no, voucher_type, voucher_date, cold_storage_id, cold_storage_name, destination_godown_id, destination_godown_name, remarks, total_qty, total_wt, created_by)
      VALUES (?, 'OUT', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      voucher_no,
      voucher_date || new Date().toISOString().split('T')[0],
      cold_storage_id || null,
      cold_storage_name || 'Cold Storage',
      destination_godown_id || null,
      destination_godown_name || 'Production / Main Godown',
      remarks || '',
      total_qty,
      total_wt,
      createdBy
    ]);

    let voucher_id = voucherRes.rows?.[0]?.id || voucherRes.lastID || voucherRes.lastInsertRowid;
    if (!voucher_id) {
      const vLookup = await db.query(`SELECT id FROM cold_storage_vouchers WHERE voucher_no = ?`, [voucher_no]);
      voucher_id = vLookup.rows?.[0]?.id || 1;
    }

    for (const item of items) {
      const qty = parseFloat(item.quantity || 0);
      const wt = parseFloat(item.weight || 1);
      const totWt = parseFloat(item.total_wt || (qty * wt));

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
        item.cold_storage_lot_no,
        qty,
        wt,
        totWt,
        item.unit || 'KG',
        item.remarks || ''
      ]);

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

      const lotNo = item.purchase_lot_no && item.purchase_lot_no !== 'N/A' ? item.purchase_lot_no : item.cold_storage_lot_no;

      // 1. Outward from Cold Storage godown
      await db.run(`
        INSERT INTO stock (date, item_id, item_name, lot_no, type, qty, weight, rate, amount, godown, godown_id, reference_id, remarks)
        VALUES (?, ?, ?, ?, 'Cold Storage Transfer Out', ?, ?, 0, 0, ?, ?, ?, ?)
      `, [
        voucher_date || new Date().toISOString().split('T')[0],
        item.item_id || null,
        item.item_name,
        lotNo,
        -Math.abs(qty),
        -Math.abs(totWt),
        cold_storage_name,
        cold_storage_id || null,
        voucher_id,
        `[${voucher_no}] Transferred from Cold Storage to ${actualDestGodownName} (CS Lot: ${item.cold_storage_lot_no || ''})`
      ]);

      // 2. Inward to Destination godown
      await db.run(`
        INSERT INTO stock (date, item_id, item_name, lot_no, type, qty, weight, rate, amount, godown, godown_id, reference_id, remarks)
        VALUES (?, ?, ?, ?, 'Cold Storage Transfer In', ?, ?, 0, 0, ?, ?, ?, ?)
      `, [
        voucher_date || new Date().toISOString().split('T')[0],
        item.item_id || null,
        item.item_name,
        lotNo,
        Math.abs(qty),
        Math.abs(totWt),
        actualDestGodownName,
        actualDestGodownId || null,
        voucher_id,
        `[${voucher_no}] Received from Cold Storage: ${cold_storage_name} (CS Lot: ${item.cold_storage_lot_no || ''})`
      ]);
    }

    try {
      await rebuildStockLedger();
    } catch (rErr) {
      console.warn('Rebuild ledger after CS OUT warning:', rErr.message);
    }

    res.json({ success: true, message: `Cold Storage OUT Voucher ${voucher_no} issued successfully`, voucher_no, id: voucher_id });
  } catch (err) {
    console.error('Error saving Cold Storage OUT:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET list of Cold Storage vouchers
router.get('/vouchers', async (req, res) => {
  try {
    const { voucher_type, date_from, date_to, cold_storage_id } = req.query;
    let query = `SELECT * FROM cold_storage_vouchers WHERE 1=1`;
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

router.post('/sync-stock', async (req, res) => {
  try {
    await syncColdStorageStock(db);
    res.json({ success: true, message: 'Cold Storage stock entries synchronized successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
module.exports.syncColdStorageStock = syncColdStorageStock;
