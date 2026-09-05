const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Initialize database schema for Work Orders
const initSchema = async () => {
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS work_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        work_order_no TEXT UNIQUE,
        work_unit TEXT NOT NULL,
        flour_mill_id INTEGER,
        product TEXT NOT NULL,
        product_id INTEGER,
        date DATE NOT NULL,
        status TEXT DEFAULT 'ISSUED',
        expected_output_qty REAL DEFAULT 0,
        expected_output_wt REAL DEFAULT 0,
        actual_output_qty REAL DEFAULT 0,
        actual_output_wt REAL DEFAULT 0,
        rejection_wt REAL DEFAULT 0,
        elevator_wt REAL DEFAULT 0,
        waste_flour_wt REAL DEFAULT 0,
        sieve_flour_wt REAL DEFAULT 0,
        other_wastage_wt REAL DEFAULT 0,
        grind_id INTEGER,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS work_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        work_order_id INTEGER NOT NULL,
        lot_no TEXT,
        supplier TEXT,
        item_name TEXT NOT NULL,
        item_id INTEGER,
        weight REAL DEFAULT 0,
        input_qty REAL DEFAULT 0,
        kgs REAL DEFAULT 0,
        rate REAL DEFAULT 0,
        output_item TEXT,
        output_qty REAL DEFAULT 0,
        output_weight REAL DEFAULT 0,
        output_kgs REAL DEFAULT 0,
        fg_lot_no TEXT,
        rejection_wt REAL DEFAULT 0,
        elevator_wt REAL DEFAULT 0,
        waste_flour_wt REAL DEFAULT 0,
        sieve_flour_wt REAL DEFAULT 0,
        wastage_category TEXT,
        wastage_qty REAL DEFAULT 0,
        wastage_wt REAL DEFAULT 0,
        wastage_lot_no TEXT,
        FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS work_order_outputs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        work_order_id INTEGER NOT NULL,
        output_item TEXT NOT NULL,
        item_id INTEGER,
        fg_lot_no TEXT,
        weight REAL DEFAULT 0,
        expected_qty REAL DEFAULT 0,
        output_kgs REAL DEFAULT 0,
        rate REAL DEFAULT 0,
        remarks TEXT,
        FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS work_order_wastages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        work_order_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        item_name TEXT,
        lot_no TEXT,
        weight REAL DEFAULT 1,
        qty REAL DEFAULT 0,
        total_wt REAL DEFAULT 0,
        remarks TEXT,
        FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE
      )
    `);

    // Add work_order_id column to grains if not exists
    try {
      await db.run("ALTER TABLE grains ADD COLUMN work_order_id INTEGER");
    } catch (e) {
      // already exists
    }

    try {
      await db.run("ALTER TABLE grains ADD COLUMN work_order_no TEXT");
    } catch (e) {
      // already exists
    }

    console.log("Work orders schema initialized successfully.");
  } catch (err) {
    console.error("Failed to initialize work orders schema:", err.message);
  }
};
initSchema();

// Generate next sequential Work Order number (e.g. WO-0001)
const generateNextWorkOrderNo = async () => {
  try {
    const res = await db.query(`
      SELECT work_order_no FROM work_orders ORDER BY id DESC LIMIT 1
    `);
    if (res.rows.length === 0 || !res.rows[0].work_order_no) {
      return 'WO-0001';
    }
    const lastNo = res.rows[0].work_order_no;
    const match = lastNo.match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10) + 1;
      return `WO-${String(num).padStart(4, '0')}`;
    }
    return `WO-${Date.now().toString().slice(-4)}`;
  } catch (err) {
    return `WO-${Date.now().toString().slice(-4)}`;
  }
};

// GET next Work Order number
router.get('/next-number', async (req, res) => {
  try {
    const nextNo = await generateNextWorkOrderNo();
    res.json({ success: true, workOrderNo: nextNo });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET all work orders with item counts and summary
router.get('/', async (req, res) => {
  try {
    const { status, search, fromDate, toDate } = req.query;
    let query = `
      SELECT 
        wo.*,
        COUNT(woi.id) as item_count,
        COALESCE(SUM(woi.input_qty), 0) as total_input_qty,
        COALESCE(SUM(woi.kgs), 0) as total_input_kgs,
        COALESCE(SUM(woi.output_qty), 0) as total_output_qty,
        COALESCE(SUM(woi.output_kgs), 0) as total_output_kgs
      FROM work_orders wo
      LEFT JOIN work_order_items woi ON woi.work_order_id = wo.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'ALL') {
      query += ` AND wo.status = ?`;
      params.push(status);
    }
    if (fromDate) {
      query += ` AND wo.date >= ?`;
      params.push(fromDate);
    }
    if (toDate) {
      query += ` AND wo.date <= ?`;
      params.push(toDate);
    }
    if (search) {
      query += ` AND (wo.work_order_no LIKE ? OR wo.work_unit LIKE ? OR wo.product LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` GROUP BY wo.id ORDER BY wo.id DESC`;

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows || [] });
  } catch (err) {
    console.error('Error fetching work orders:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET pending/open work orders for Grind creation dropdown
router.get('/pending', async (req, res) => {
  try {
    const query = `
      SELECT 
        wo.*,
        COALESCE(SUM(woi.input_qty), 0) as total_input_qty,
        COALESCE(SUM(woi.kgs), 0) as total_input_kgs
      FROM work_orders wo
      LEFT JOIN work_order_items woi ON woi.work_order_id = wo.id
      WHERE wo.status IN ('ISSUED', 'IN_PROCESS')
      GROUP BY wo.id
      ORDER BY wo.id DESC
    `;
    const result = await db.query(query);
    res.json({ success: true, data: result.rows || [] });
  } catch (err) {
    console.error('Error fetching pending work orders:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET single work order by ID with all items, outputs, and wastages
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const woRes = await db.query(`SELECT * FROM work_orders WHERE id = ?`, [id]);
    if (!woRes.rows || woRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Work Order Slip not found' });
    }
    const workOrder = woRes.rows[0];

    // Input items
    const itemsRes = await db.query(`
      SELECT * FROM work_order_items WHERE work_order_id = ? ORDER BY id ASC
    `, [id]);
    const inputItems = itemsRes.rows || [];

    // Output items
    let outputItems = [];
    try {
      const outRes = await db.query(`
        SELECT * FROM work_order_outputs WHERE work_order_id = ? ORDER BY id ASC
      `, [id]);
      outputItems = outRes.rows || [];
    } catch (e) {
      outputItems = [];
    }

    // If outputItems is empty, fallback from input items or header
    if (outputItems.length === 0) {
      const distinctOutputs = [];
      inputItems.forEach(it => {
        if (it.output_item || it.fg_lot_no || it.output_qty > 0) {
          distinctOutputs.push({
            output_item: it.output_item || workOrder.product || '',
            fg_lot_no: it.fg_lot_no || '',
            weight: it.output_weight || it.weight || 0,
            expected_qty: it.output_qty || 0,
            output_kgs: it.output_kgs || ((it.output_weight || it.weight || 0) * (it.output_qty || 0)),
            rate: it.rate || 0
          });
        }
      });
      if (distinctOutputs.length > 0) {
        outputItems = distinctOutputs;
      } else {
        outputItems = [{
          output_item: workOrder.product || '',
          fg_lot_no: '',
          weight: 50,
          expected_qty: workOrder.expected_output_qty || 0,
          output_kgs: workOrder.expected_output_wt || 0,
          rate: 0
        }];
      }
    }

    // Wastage items
    let wastageItems = [];
    try {
      const wasteRes = await db.query(`
        SELECT * FROM work_order_wastages WHERE work_order_id = ? ORDER BY id ASC
      `, [id]);
      wastageItems = wasteRes.rows || [];
    } catch (e) {
      wastageItems = [];
    }

    // If wastageItems empty, construct from header totals
    if (wastageItems.length === 0) {
      if (parseFloat(workOrder.rejection_wt) > 0) {
        wastageItems.push({
          category: 'Rejection',
          item_name: 'Rejection Waste Flour',
          lot_no: 'REJ-01',
          weight: 1,
          qty: parseFloat(workOrder.rejection_wt),
          total_wt: parseFloat(workOrder.rejection_wt)
        });
      }
      if (parseFloat(workOrder.elevator_wt) > 0) {
        wastageItems.push({
          category: 'Elevator',
          item_name: 'Elevator Cleaning Waste',
          lot_no: 'ELE-01',
          weight: 1,
          qty: parseFloat(workOrder.elevator_wt),
          total_wt: parseFloat(workOrder.elevator_wt)
        });
      }
      if (parseFloat(workOrder.waste_flour_wt) > 0) {
        wastageItems.push({
          category: 'Waste Flour',
          item_name: 'Milling Waste Flour',
          lot_no: 'WF-01',
          weight: 1,
          qty: parseFloat(workOrder.waste_flour_wt),
          total_wt: parseFloat(workOrder.waste_flour_wt)
        });
      }
      if (parseFloat(workOrder.sieve_flour_wt) > 0) {
        wastageItems.push({
          category: 'Sieve Flour',
          item_name: 'Sieve Screen Flour',
          lot_no: 'SF-01',
          weight: 1,
          qty: parseFloat(workOrder.sieve_flour_wt),
          total_wt: parseFloat(workOrder.sieve_flour_wt)
        });
      }
      if (parseFloat(workOrder.other_wastage_wt) > 0) {
        wastageItems.push({
          category: 'Other Wastage',
          item_name: 'General Milling Dust / Loss',
          lot_no: 'OTH-01',
          weight: 1,
          qty: parseFloat(workOrder.other_wastage_wt),
          total_wt: parseFloat(workOrder.other_wastage_wt)
        });
      }
    }

    res.json({
      success: true,
      data: {
        ...workOrder,
        items: inputItems,
        input_items: inputItems,
        output_items: outputItems,
        wastage_items: wastageItems
      }
    });
  } catch (err) {
    console.error('Error fetching work order by ID:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST create new Work Order Slip
router.post('/', async (req, res) => {
  try {
    const {
      work_order_no,
      work_unit,
      flour_mill_id,
      product,
      product_id,
      date,
      status = 'ISSUED',
      expected_output_qty = 0,
      expected_output_wt = 0,
      actual_output_qty = 0,
      actual_output_wt = 0,
      rejection_wt = 0,
      elevator_wt = 0,
      waste_flour_wt = 0,
      sieve_flour_wt = 0,
      other_wastage_wt = 0,
      remarks = '',
      items = [],
      input_items = [],
      output_items = [],
      wastage_items = []
    } = req.body;

    if (!work_unit || !work_unit.trim()) {
      return res.status(400).json({ success: false, message: 'Work Unit is required' });
    }
    if (!product || !product.trim()) {
      return res.status(400).json({ success: false, message: 'Product is required' });
    }

    let woNumber = work_order_no;
    if (!woNumber || !woNumber.trim()) {
      woNumber = await generateNextWorkOrderNo();
    }

    // Determine final raw material input items
    const rawItems = (Array.isArray(input_items) && input_items.length > 0) ? input_items : items;
    const finalOutputItems = Array.isArray(output_items) ? output_items : [];
    const finalWastageItems = Array.isArray(wastage_items) ? wastage_items : [];

    // Calculate aggregated expected output
    let calcOutputQty = parseFloat(expected_output_qty) || 0;
    let calcOutputWt = parseFloat(expected_output_wt) || 0;
    if (finalOutputItems.length > 0) {
      calcOutputQty = finalOutputItems.reduce((sum, o) => sum + (parseFloat(o.expected_qty || o.qty || o.output_qty) || 0), 0);
      calcOutputWt = finalOutputItems.reduce((sum, o) => sum + (parseFloat(o.output_kgs || o.total_wt) || ((parseFloat(o.weight) || 0) * (parseFloat(o.expected_qty || o.qty || o.output_qty) || 0))), 0);
    }

    // Calculate breakdown for standard wastage categories
    let rejWt = parseFloat(rejection_wt) || 0;
    let eleWt = parseFloat(elevator_wt) || 0;
    let wfWt = parseFloat(waste_flour_wt) || 0;
    let sfWt = parseFloat(sieve_flour_wt) || 0;
    let othWt = parseFloat(other_wastage_wt) || 0;

    if (finalWastageItems.length > 0) {
      finalWastageItems.forEach(w => {
        const cat = (w.category || '').toLowerCase();
        const wt = parseFloat(w.total_wt) || ((parseFloat(w.weight) || 1) * (parseFloat(w.qty) || 0));
        if (cat.includes('rejection')) rejWt = wt;
        else if (cat.includes('elevator')) eleWt = wt;
        else if (cat.includes('waste flour') || cat.includes('flour waste')) wfWt = wt;
        else if (cat.includes('sieve')) sfWt = wt;
        else othWt += wt;
      });
    }

    const woResult = await db.run(`
      INSERT INTO work_orders (
        work_order_no, work_unit, flour_mill_id, product, product_id,
        date, status, expected_output_qty, expected_output_wt,
        actual_output_qty, actual_output_wt, rejection_wt, elevator_wt,
        waste_flour_wt, sieve_flour_wt, other_wastage_wt, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      woNumber,
      work_unit.trim(),
      flour_mill_id || null,
      product.trim(),
      product_id || null,
      date || new Date().toISOString().split('T')[0],
      status,
      calcOutputQty,
      calcOutputWt,
      parseFloat(actual_output_qty) || 0,
      parseFloat(actual_output_wt) || 0,
      rejWt,
      eleWt,
      wfWt,
      sfWt,
      othWt,
      remarks || ''
    ]);

    const workOrderId = woResult.lastID;

    // Insert Raw Material input items
    if (Array.isArray(rawItems) && rawItems.length > 0) {
      for (const it of rawItems) {
        if (!it.item_name && !it.lot_no) continue;
        const weight = parseFloat(it.weight) || 0;
        const inputQty = parseFloat(it.input_qty || it.qty) || 0;
        const kgs = parseFloat(it.kgs) || (weight * inputQty);

        await db.run(`
          INSERT INTO work_order_items (
            work_order_id, lot_no, supplier, item_name, item_id,
            weight, input_qty, kgs, rate, output_item, output_qty,
            output_weight, output_kgs, fg_lot_no, rejection_wt,
            elevator_wt, waste_flour_wt, sieve_flour_wt, wastage_category,
            wastage_qty, wastage_wt, wastage_lot_no
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          workOrderId,
          it.lot_no || '',
          it.supplier || '',
          it.item_name || '',
          it.item_id || null,
          weight,
          inputQty,
          kgs,
          parseFloat(it.rate) || 0,
          it.output_item || product || '',
          parseFloat(it.output_qty) || 0,
          parseFloat(it.output_weight) || 0,
          parseFloat(it.output_kgs) || 0,
          it.fg_lot_no || '',
          rejWt,
          eleWt,
          wfWt,
          sfWt,
          it.wastage_category || '',
          parseFloat(it.wastage_qty) || 0,
          parseFloat(it.wastage_wt) || 0,
          it.wastage_lot_no || ''
        ]);
      }
    }

    // Insert Output Items
    if (finalOutputItems.length > 0) {
      for (const o of finalOutputItems) {
        if (!o.output_item && !o.item_name && !o.fg_lot_no) continue;
        const oName = o.output_item || o.item_name || product;
        const oLot = o.fg_lot_no || o.lot_no || '';
        const oWt = parseFloat(o.weight || o.output_weight) || 0;
        const oQty = parseFloat(o.expected_qty || o.qty || o.output_qty) || 0;
        const oKgs = parseFloat(o.output_kgs || o.total_wt) || (oWt * oQty);

        await db.run(`
          INSERT INTO work_order_outputs (
            work_order_id, output_item, item_id, fg_lot_no, weight,
            expected_qty, output_kgs, rate, remarks
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          workOrderId,
          oName,
          o.item_id || null,
          oLot,
          oWt,
          oQty,
          oKgs,
          parseFloat(o.rate) || 0,
          o.remarks || ''
        ]);
      }
    }

    // Insert Wastage Items
    if (finalWastageItems.length > 0) {
      for (const w of finalWastageItems) {
        if (!w.category && !w.item_name && !parseFloat(w.total_wt) && !parseFloat(w.qty)) continue;
        const cat = w.category || 'Other Wastage';
        const wName = w.item_name || `${cat} Wastage`;
        const wLot = w.lot_no || '';
        const wWt = parseFloat(w.weight) || 1;
        const wQty = parseFloat(w.qty) || 0;
        const wTotal = parseFloat(w.total_wt) || (wWt * wQty);

        await db.run(`
          INSERT INTO work_order_wastages (
            work_order_id, category, item_name, lot_no, weight, qty, total_wt, remarks
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          workOrderId,
          cat,
          wName,
          wLot,
          wWt,
          wQty,
          wTotal,
          w.remarks || ''
        ]);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Work Order Slip created successfully',
      id: workOrderId,
      work_order_no: woNumber
    });
  } catch (err) {
    console.error('Error creating work order slip:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT update Work Order Slip
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      work_order_no,
      work_unit,
      flour_mill_id,
      product,
      product_id,
      date,
      status,
      expected_output_qty = 0,
      expected_output_wt = 0,
      actual_output_qty = 0,
      actual_output_wt = 0,
      rejection_wt = 0,
      elevator_wt = 0,
      waste_flour_wt = 0,
      sieve_flour_wt = 0,
      other_wastage_wt = 0,
      grind_id,
      remarks = '',
      items = [],
      input_items = [],
      output_items = [],
      wastage_items = []
    } = req.body;

    const rawItems = (Array.isArray(input_items) && input_items.length > 0) ? input_items : items;
    const finalOutputItems = Array.isArray(output_items) ? output_items : [];
    const finalWastageItems = Array.isArray(wastage_items) ? wastage_items : [];

    // Calculate aggregated expected output
    let calcOutputQty = parseFloat(expected_output_qty) || 0;
    let calcOutputWt = parseFloat(expected_output_wt) || 0;
    if (finalOutputItems.length > 0) {
      calcOutputQty = finalOutputItems.reduce((sum, o) => sum + (parseFloat(o.expected_qty || o.qty || o.output_qty) || 0), 0);
      calcOutputWt = finalOutputItems.reduce((sum, o) => sum + (parseFloat(o.output_kgs || o.total_wt) || ((parseFloat(o.weight) || 0) * (parseFloat(o.expected_qty || o.qty || o.output_qty) || 0))), 0);
    }

    let rejWt = parseFloat(rejection_wt) || 0;
    let eleWt = parseFloat(elevator_wt) || 0;
    let wfWt = parseFloat(waste_flour_wt) || 0;
    let sfWt = parseFloat(sieve_flour_wt) || 0;
    let othWt = parseFloat(other_wastage_wt) || 0;

    if (finalWastageItems.length > 0) {
      finalWastageItems.forEach(w => {
        const cat = (w.category || '').toLowerCase();
        const wt = parseFloat(w.total_wt) || ((parseFloat(w.weight) || 1) * (parseFloat(w.qty) || 0));
        if (cat.includes('rejection')) rejWt = wt;
        else if (cat.includes('elevator')) eleWt = wt;
        else if (cat.includes('waste flour') || cat.includes('flour waste')) wfWt = wt;
        else if (cat.includes('sieve')) sfWt = wt;
        else othWt += wt;
      });
    }

    await db.run(`
      UPDATE work_orders SET
        work_order_no = COALESCE(?, work_order_no),
        work_unit = COALESCE(?, work_unit),
        flour_mill_id = COALESCE(?, flour_mill_id),
        product = COALESCE(?, product),
        product_id = COALESCE(?, product_id),
        date = COALESCE(?, date),
        status = COALESCE(?, status),
        expected_output_qty = ?,
        expected_output_wt = ?,
        actual_output_qty = ?,
        actual_output_wt = ?,
        rejection_wt = ?,
        elevator_wt = ?,
        waste_flour_wt = ?,
        sieve_flour_wt = ?,
        other_wastage_wt = ?,
        grind_id = COALESCE(?, grind_id),
        remarks = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      work_order_no,
      work_unit,
      flour_mill_id || null,
      product,
      product_id || null,
      date,
      status,
      calcOutputQty,
      calcOutputWt,
      parseFloat(actual_output_qty) || 0,
      parseFloat(actual_output_wt) || 0,
      rejWt,
      eleWt,
      wfWt,
      sfWt,
      othWt,
      grind_id || null,
      remarks || '',
      id
    ]);

    // Replace raw material items
    if (Array.isArray(rawItems)) {
      await db.run(`DELETE FROM work_order_items WHERE work_order_id = ?`, [id]);
      for (const it of rawItems) {
        if (!it.item_name && !it.lot_no) continue;
        const weight = parseFloat(it.weight) || 0;
        const inputQty = parseFloat(it.input_qty || it.qty) || 0;
        const kgs = parseFloat(it.kgs) || (weight * inputQty);

        await db.run(`
          INSERT INTO work_order_items (
            work_order_id, lot_no, supplier, item_name, item_id,
            weight, input_qty, kgs, rate, output_item, output_qty,
            output_weight, output_kgs, fg_lot_no, rejection_wt,
            elevator_wt, waste_flour_wt, sieve_flour_wt, wastage_category,
            wastage_qty, wastage_wt, wastage_lot_no
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          id,
          it.lot_no || '',
          it.supplier || '',
          it.item_name || '',
          it.item_id || null,
          weight,
          inputQty,
          kgs,
          parseFloat(it.rate) || 0,
          it.output_item || product || '',
          parseFloat(it.output_qty) || 0,
          parseFloat(it.output_weight) || 0,
          parseFloat(it.output_kgs) || 0,
          it.fg_lot_no || '',
          rejWt,
          eleWt,
          wfWt,
          sfWt,
          it.wastage_category || '',
          parseFloat(it.wastage_qty) || 0,
          parseFloat(it.wastage_wt) || 0,
          it.wastage_lot_no || ''
        ]);
      }
    }

    // Replace output items
    if (Array.isArray(output_items)) {
      try {
        await db.run(`DELETE FROM work_order_outputs WHERE work_order_id = ?`, [id]);
        for (const o of finalOutputItems) {
          if (!o.output_item && !o.item_name && !o.fg_lot_no) continue;
          const oName = o.output_item || o.item_name || product;
          const oLot = o.fg_lot_no || o.lot_no || '';
          const oWt = parseFloat(o.weight || o.output_weight) || 0;
          const oQty = parseFloat(o.expected_qty || o.qty || o.output_qty) || 0;
          const oKgs = parseFloat(o.output_kgs || o.total_wt) || (oWt * oQty);

          await db.run(`
            INSERT INTO work_order_outputs (
              work_order_id, output_item, item_id, fg_lot_no, weight,
              expected_qty, output_kgs, rate, remarks
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            id,
            oName,
            o.item_id || null,
            oLot,
            oWt,
            oQty,
            oKgs,
            parseFloat(o.rate) || 0,
            o.remarks || ''
          ]);
        }
      } catch (e) {
        console.error('Error replacing work order outputs:', e);
      }
    }

    // Replace wastage items
    if (Array.isArray(wastage_items)) {
      try {
        await db.run(`DELETE FROM work_order_wastages WHERE work_order_id = ?`, [id]);
        for (const w of finalWastageItems) {
          if (!w.category && !w.item_name && !parseFloat(w.total_wt) && !parseFloat(w.qty)) continue;
          const cat = w.category || 'Other Wastage';
          const wName = w.item_name || `${cat} Wastage`;
          const wLot = w.lot_no || '';
          const wWt = parseFloat(w.weight) || 1;
          const wQty = parseFloat(w.qty) || 0;
          const wTotal = parseFloat(w.total_wt) || (wWt * wQty);

          await db.run(`
            INSERT INTO work_order_wastages (
              work_order_id, category, item_name, lot_no, weight, qty, total_wt, remarks
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            id,
            cat,
            wName,
            wLot,
            wWt,
            wQty,
            wTotal,
            w.remarks || ''
          ]);
        }
      } catch (e) {
        console.error('Error replacing work order wastages:', e);
      }
    }

    res.json({ success: true, message: 'Work Order Slip updated successfully' });
  } catch (err) {
    console.error('Error updating work order slip:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE Work Order Slip
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.run(`DELETE FROM work_order_items WHERE work_order_id = ?`, [id]);
    await db.run(`DELETE FROM work_orders WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Work Order Slip deleted successfully' });
  } catch (err) {
    console.error('Error deleting work order slip:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Link Work Order to Grind & Complete
router.post('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { grind_id, actual_output_qty, actual_output_wt, rejection_wt, elevator_wt, waste_flour_wt, sieve_flour_wt } = req.body;

    await db.run(`
      UPDATE work_orders SET
        status = 'COMPLETED',
        grind_id = COALESCE(?, grind_id),
        actual_output_qty = COALESCE(?, actual_output_qty),
        actual_output_wt = COALESCE(?, actual_output_wt),
        rejection_wt = COALESCE(?, rejection_wt),
        elevator_wt = COALESCE(?, elevator_wt),
        waste_flour_wt = COALESCE(?, waste_flour_wt),
        sieve_flour_wt = COALESCE(?, sieve_flour_wt),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [grind_id || null, actual_output_qty, actual_output_wt, rejection_wt, elevator_wt, waste_flour_wt, sieve_flour_wt, id]);

    res.json({ success: true, message: 'Work Order marked as completed' });
  } catch (err) {
    console.error('Error completing work order:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
