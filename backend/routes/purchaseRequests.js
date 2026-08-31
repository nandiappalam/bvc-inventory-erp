const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Initialize Purchase Request tables
const initTables = async () => {
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS purchase_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pr_no TEXT UNIQUE NOT NULL,
        request_date TEXT,
        required_date TEXT,
        department TEXT,
        department_id INTEGER,
        requested_by TEXT,
        supplier_id INTEGER,
        supplier_name TEXT,
        godown_id INTEGER,
        godown_name TEXT,
        priority TEXT DEFAULT 'Medium',
        status TEXT DEFAULT 'Draft',
        remarks TEXT,
        approved_by TEXT,
        approved_date TEXT,
        approval_remarks TEXT,
        converted_to_po_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS purchase_request_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_request_id INTEGER NOT NULL,
        item_id INTEGER,
        item_code TEXT,
        item_name TEXT NOT NULL,
        weight TEXT,
        description TEXT,
        requested_qty REAL DEFAULT 0,
        approved_qty REAL DEFAULT 0,
        unit TEXT DEFAULT 'kg',
        current_stock REAL DEFAULT 0,
        current_stock_rm REAL DEFAULT 0,
        current_stock_fg REAL DEFAULT 0,
        minimum_stock REAL DEFAULT 0,
        suggested_qty REAL DEFAULT 0,
        estimated_rate REAL DEFAULT 0,
        estimated_amount REAL DEFAULT 0,
        remarks TEXT,
        FOREIGN KEY (purchase_request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE
      )
    `);

    // Column migrations for backward compatibility
    try { await db.run("ALTER TABLE purchase_request_items ADD COLUMN weight TEXT"); } catch (e) {}
    try { await db.run("ALTER TABLE purchase_request_items ADD COLUMN current_stock_rm REAL DEFAULT 0"); } catch (e) {}
    try { await db.run("ALTER TABLE purchase_request_items ADD COLUMN current_stock_fg REAL DEFAULT 0"); } catch (e) {}

    await db.run(`
      CREATE TABLE IF NOT EXISTS purchase_request_approval_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_request_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        performed_by TEXT,
        remarks TEXT,
        performed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (purchase_request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE
      )
    `);

    console.log('Purchase Request tables initialized successfully');
  } catch (err) {
    console.error('Error initializing purchase_requests tables:', err.message);
  }
};
let tablesPromise = null;
const ensureTables = () => {
  if (!tablesPromise) {
    tablesPromise = initTables();
  }
  return tablesPromise;
};
ensureTables();

router.use(async (req, res, next) => {
  try {
    await ensureTables();
    next();
  } catch (err) {
    next(err);
  }
});

// Helper to generate next PR Number
const getNextPrNo = async () => {
  try {
    const res = await db.query(`
      SELECT pr_no, id FROM purchase_requests
    `);
    let maxNum = res.rows ? res.rows.length : 0;
    if (res.rows && res.rows.length > 0) {
      for (const row of res.rows) {
        if (row.pr_no) {
          const numPart = parseInt(row.pr_no.replace(/[^0-9]/g, ''), 10);
          if (!isNaN(numPart) && numPart > maxNum) {
            maxNum = numPart;
          }
        }
        if (row.id && row.id > maxNum) {
          maxNum = row.id;
        }
      }
    }
    return `PR${String(maxNum + 1).padStart(6, '0')}`;
  } catch (e) {
    return 'PR000001';
  }
};

// GET Next PR Number
router.get('/next-pr-no', async (req, res) => {
  try {
    const prNo = await getNextPrNo();
    res.json({ next_pr_no: prNo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Item RM & FG stock
router.get('/item-stock/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    let itemName = '';
    let stockFromMaster = 0;
    const itemRes = await db.query('SELECT id, item_name, name, stock_qty, item_group FROM item_master WHERE id = ? OR LOWER(item_name) = LOWER(?)', [itemId, itemId]);
    if (itemRes.rows && itemRes.rows.length > 0) {
      itemName = itemRes.rows[0].item_name || itemRes.rows[0].name;
      stockFromMaster = parseFloat(itemRes.rows[0].stock_qty || 0);
    } else {
      itemName = itemId;
    }
    
    // Sum stock from stock_lots for RM and FG
    const lotRes = await db.query(`
      SELECT sl.remaining_quantity, sl.lot_no, sl.item_name, im.item_group
      FROM stock_lots sl
      LEFT JOIN item_master im ON (sl.item_id = im.id OR LOWER(sl.item_name) = LOWER(im.item_name))
      WHERE (sl.item_id = ? OR LOWER(TRIM(sl.item_name)) = LOWER(TRIM(?)) OR sl.item_name LIKE ?) AND sl.remaining_quantity > 0
    `, [itemId, itemName, `%${itemName}%`]);

    let rmStock = 0;
    let fgStock = 0;

    for (const lot of (lotRes.rows || [])) {
      const rem = parseFloat(lot.remaining_quantity) || 0;
      const lotLower = (lot.lot_no || '').toLowerCase();
      const isFg = lotLower.startsWith('fg') || lotLower.includes('fg-');
      const isRm = lotLower.startsWith('rm') || lotLower.includes('rm-');
      
      if (isFg) {
        fgStock += rem;
      } else if (isRm) {
        rmStock += rem;
      } else {
        // Check group / name
        const grp = (lot.item_group || '').toLowerCase();
        const name = (lot.item_name || '').toLowerCase();
        if (grp.includes('finished') || grp.includes('fg') || name.includes('papad') || name.includes('atta') || name.includes('flour') || name.includes('bgf') || name.includes('brf')) {
          fgStock += rem;
        } else {
          rmStock += rem;
        }
      }
    }

    if (rmStock === 0 && fgStock === 0 && stockFromMaster > 0) {
      rmStock = stockFromMaster;
    }

    res.json({
      success: true,
      current_stock: rmStock,
      current_stock_rm: rmStock,
      current_stock_fg: fgStock,
      item_name: itemName
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET Approved PRs for PO creation/linking
router.get('/approved-list', async (req, res) => {
  try {
    const prs = await db.query(`
      SELECT 
        pr.*,
        COALESCE(sm.name, pr.supplier_name) as supplier_name,
        sm.address1 as supplier_address,
        COALESCE(sm.mobile1, sm.phone_off) as supplier_phone,
        sm.gst_number as supplier_gst,
        COALESCE(pri_agg.total_items, 0) as total_items,
        COALESCE(pri_agg.total_qty, 0) as total_qty,
        COALESCE(pri_agg.total_amount, 0) as total_amount,
        pri_agg.item_names
      FROM purchase_requests pr
      LEFT JOIN supplier_master sm ON pr.supplier_id = sm.id
      LEFT JOIN (
        SELECT purchase_request_id, COUNT(*) as total_items, SUM(requested_qty) as total_qty, SUM(estimated_amount) as total_amount, GROUP_CONCAT(item_name, ', ') as item_names
        FROM purchase_request_items GROUP BY purchase_request_id
      ) pri_agg ON pr.id = pri_agg.purchase_request_id
      WHERE LOWER(COALESCE(pr.status, 'approved')) IN ('approved', 'partially converted', 'converted', 'pending po', 'submitted', 'active')
      ORDER BY pr.id DESC
    `);
    
    // Also attach items to each PR for instant client-side autofill
    for (const pr of (prs.rows || [])) {
      const itemsRes = await db.query(`
        SELECT 
          pri.*,
          COALESCE(im.item_name, pri.item_name) as resolved_item_name,
          im.hsn_code,
          im.tax_type,
          COALESCE(im.tax, im.gst_rate) as tax_rate,
          im.weight as master_weight
        FROM purchase_request_items pri
        LEFT JOIN item_master im ON pri.item_id = im.id
        WHERE pri.purchase_request_id = ?
        ORDER BY pri.id ASC
      `, [pr.id]);
      pr.items = itemsRes.rows || [];
    }

    res.json(prs.rows || []);
  } catch (err) {
    console.error('Error fetching approved PR list:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET Dashboard metrics
const getDashboardMetricsHandler = async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const monthPrefix = todayStr.substring(0, 7);

    const todayReqRes = await db.query(`SELECT COUNT(*) as count FROM purchase_requests WHERE request_date LIKE ?`, [`${todayStr}%`]);
    const pendingRes = await db.query(`SELECT COUNT(*) as count FROM purchase_requests WHERE status = 'Submitted'`);
    const approvedTodayRes = await db.query(`SELECT COUNT(*) as count FROM purchase_requests WHERE status = 'Approved' AND (approved_date LIKE ? OR updated_at LIKE ?)`, [`${todayStr}%`, `${todayStr}%`]);
    const rejectedTodayRes = await db.query(`SELECT COUNT(*) as count FROM purchase_requests WHERE status = 'Rejected' AND updated_at LIKE ?`, [`${todayStr}%`]);
    const urgentRes = await db.query(`SELECT COUNT(*) as count FROM purchase_requests WHERE status = 'Submitted' AND priority IN ('High', 'Urgent')`);
    const monthlyRes = await db.query(`SELECT COUNT(*) as count FROM purchase_requests WHERE request_date LIKE ?`, [`${monthPrefix}%`]);

    const monthlyValRes = await db.query(`
      SELECT COALESCE(SUM(pri.estimated_amount), 0) as total_value
      FROM purchase_requests pr
      JOIN purchase_request_items pri ON pr.id = pri.purchase_request_id
      WHERE pr.request_date LIKE ?
    `, [`${monthPrefix}%`]);

    const deptRes = await db.query(`
      SELECT COALESCE(pr.department, 'General') as department, COUNT(DISTINCT pr.id) as request_count, COALESCE(SUM(pri.estimated_amount), 0) as total_amount
      FROM purchase_requests pr
      LEFT JOIN purchase_request_items pri ON pr.id = pri.purchase_request_id
      GROUP BY COALESCE(pr.department, 'General')
    `);

    const recentRes = await db.query(`
      SELECT pr.*, 
        (SELECT COUNT(*) FROM purchase_request_items WHERE purchase_request_id = pr.id) as total_items,
        (SELECT COALESCE(SUM(requested_qty), 0) FROM purchase_request_items WHERE purchase_request_id = pr.id) as total_qty,
        (SELECT COALESCE(SUM(estimated_amount), 0) FROM purchase_request_items WHERE purchase_request_id = pr.id) as total_amount,
        (SELECT GROUP_CONCAT(item_name, ', ') FROM purchase_request_items WHERE purchase_request_id = pr.id) as item_names
      FROM purchase_requests pr
      ORDER BY pr.id DESC
      LIMIT 10
    `);

    const metricsObj = {
      today_requests: todayReqRes.rows[0]?.count || 0,
      pending_approvals: pendingRes.rows[0]?.count || 0,
      urgent_pending: urgentRes.rows[0]?.count || 0,
      approved_today: approvedTodayRes.rows[0]?.count || 0,
      rejected_today: rejectedTodayRes.rows[0]?.count || 0,
      monthly_total: monthlyRes.rows[0]?.count || 0,
      monthly_value: monthlyValRes.rows[0]?.total_value || 0
    };

    res.json({
      metrics: metricsObj,
      recent_requests: recentRes.rows || [],
      department_stats: deptRes.rows || []
    });
  } catch (err) {
    console.error('Error fetching PR dashboard metrics:', err);
    res.status(500).json({ error: err.message });
  }
};

router.get('/dashboard', getDashboardMetricsHandler);
router.get('/dashboard/metrics', getDashboardMetricsHandler);

// GET Reports
router.get('/reports', async (req, res) => {
  try {
    const { reportType = 'summary', dateFrom, dateTo, department, status, priority, item_id, supplier_id } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (dateFrom) {
      whereClause += ' AND pr.request_date >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      whereClause += ' AND pr.request_date <= ?';
      params.push(dateTo);
    }
    if (department) {
      whereClause += ' AND LOWER(pr.department) = LOWER(?)';
      params.push(department);
    }
    if (status) {
      whereClause += ' AND LOWER(pr.status) = LOWER(?)';
      params.push(status);
    }
    if (priority) {
      whereClause += ' AND LOWER(pr.priority) = LOWER(?)';
      params.push(priority);
    }
    if (supplier_id) {
      whereClause += ' AND pr.supplier_id = ?';
      params.push(supplier_id);
    }

    if (reportType === 'item' || item_id) {
      let itemWhere = whereClause;
      if (item_id) {
        itemWhere += ' AND pri.item_id = ?';
        params.push(item_id);
      }
      const itemSql = `
        SELECT 
          pri.item_name,
          pri.item_code,
          pri.unit,
          pr.pr_no,
          pr.request_date,
          pr.department,
          pr.requested_by,
          pr.priority,
          pr.status,
          pri.requested_qty,
          pri.approved_qty,
          pri.estimated_rate,
          pri.estimated_amount
        FROM purchase_request_items pri
        JOIN purchase_requests pr ON pri.purchase_request_id = pr.id
        ${itemWhere}
        ORDER BY pr.request_date DESC, pr.id DESC
      `;
      const result = await db.query(itemSql, params);
      return res.json({ reportType, rows: result.rows || [] });
    }

    if (reportType === 'department') {
      const sql = `
        SELECT 
          COALESCE(pr.department, 'Unassigned') as department,
          COUNT(pr.id) as total_requests,
          SUM(CASE WHEN pr.status = 'Approved' THEN 1 ELSE 0 END) as approved_count,
          SUM(CASE WHEN pr.status = 'Submitted' THEN 1 ELSE 0 END) as pending_count,
          SUM(CASE WHEN pr.status = 'Rejected' THEN 1 ELSE 0 END) as rejected_count,
          COALESCE(SUM(pri_agg.total_items), 0) as total_items,
          COALESCE(SUM(pri_agg.total_qty), 0) as total_qty,
          COALESCE(SUM(pri_agg.total_amount), 0) as total_amount
        FROM purchase_requests pr
        LEFT JOIN (
          SELECT purchase_request_id, COUNT(*) as total_items, SUM(requested_qty) as total_qty, SUM(estimated_amount) as total_amount
          FROM purchase_request_items GROUP BY purchase_request_id
        ) pri_agg ON pr.id = pri_agg.purchase_request_id
        ${whereClause}
        GROUP BY COALESCE(pr.department, 'Unassigned')
      `;
      const result = await db.query(sql, params);
      return res.json({ reportType, rows: result.rows || [] });
    }

    if (reportType === 'approval_status') {
      const sql = `
        SELECT 
          pr.status,
          COUNT(pr.id) as count,
          COALESCE(SUM(pri_agg.total_amount), 0) as total_value
        FROM purchase_requests pr
        LEFT JOIN (
          SELECT purchase_request_id, SUM(estimated_amount) as total_amount
          FROM purchase_request_items GROUP BY purchase_request_id
        ) pri_agg ON pr.id = pri_agg.purchase_request_id
        ${whereClause}
        GROUP BY pr.status
      `;
      const result = await db.query(sql, params);
      return res.json({ reportType, rows: result.rows || [] });
    }

    if (reportType === 'priority') {
      const sql = `
        SELECT 
          pr.priority,
          COUNT(pr.id) as count,
          COALESCE(SUM(pri_agg.total_amount), 0) as total_value
        FROM purchase_requests pr
        LEFT JOIN (
          SELECT purchase_request_id, SUM(estimated_amount) as total_amount
          FROM purchase_request_items GROUP BY purchase_request_id
        ) pri_agg ON pr.id = pri_agg.purchase_request_id
        ${whereClause}
        GROUP BY pr.priority
      `;
      const result = await db.query(sql, params);
      return res.json({ reportType, rows: result.rows || [] });
    }

    // Default: summary / list report
    const sql = `
      SELECT 
        pr.*,
        COALESCE(pri_agg.total_items, 0) as total_items,
        COALESCE(pri_agg.total_qty, 0) as total_qty,
        COALESCE(pri_agg.total_amount, 0) as total_amount,
        pri_agg.item_names as item_names
      FROM purchase_requests pr
      LEFT JOIN (
        SELECT purchase_request_id, COUNT(*) as total_items, SUM(requested_qty) as total_qty, SUM(estimated_amount) as total_amount, GROUP_CONCAT(item_name, ', ') as item_names
        FROM purchase_request_items GROUP BY purchase_request_id
      ) pri_agg ON pr.id = pri_agg.purchase_request_id
      ${whereClause}
      ORDER BY pr.request_date DESC, pr.id DESC
    `;
    const result = await db.query(sql, params);
    res.json({ reportType, rows: result.rows || [] });
  } catch (err) {
    console.error('Error in purchase-requests reports:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET All Purchase Requests (with filters)
router.get('/', async (req, res) => {
  try {
    const { dateFrom, dateTo, department, requested_by, status, priority, item, supplier_id, search } = req.query;

    let query = `
      SELECT 
        pr.*,
        COALESCE(pri_agg.total_items, 0) as total_items,
        COALESCE(pri_agg.total_qty, 0) as total_qty,
        COALESCE(pri_agg.total_amount, 0) as total_amount,
        pri_agg.item_names as item_names,
        pri_agg.descriptions as descriptions
      FROM purchase_requests pr
      LEFT JOIN (
        SELECT purchase_request_id, COUNT(*) as total_items, SUM(requested_qty) as total_qty, SUM(estimated_amount) as total_amount, GROUP_CONCAT(item_name, ', ') as item_names, GROUP_CONCAT(NULLIF(description, ''), ', ') as descriptions
        FROM purchase_request_items GROUP BY purchase_request_id
      ) pri_agg ON pr.id = pri_agg.purchase_request_id
      WHERE 1=1
    `;
    const params = [];

    if (dateFrom) {
      query += ` AND pr.request_date >= ?`;
      params.push(dateFrom);
    }
    if (dateTo) {
      query += ` AND pr.request_date <= ?`;
      params.push(dateTo);
    }
    if (department) {
      query += ` AND LOWER(pr.department) = LOWER(?)`;
      params.push(department);
    }
    if (requested_by) {
      query += ` AND LOWER(pr.requested_by) LIKE LOWER(?)`;
      params.push(`%${requested_by}%`);
    }
    if (status) {
      query += ` AND LOWER(pr.status) = LOWER(?)`;
      params.push(status);
    }
    if (priority) {
      query += ` AND LOWER(pr.priority) = LOWER(?)`;
      params.push(priority);
    }
    if (supplier_id) {
      query += ` AND pr.supplier_id = ?`;
      params.push(supplier_id);
    }
    if (search) {
      query += ` AND (LOWER(pr.pr_no) LIKE LOWER(?) OR LOWER(pr.department) LIKE LOWER(?) OR LOWER(pr.requested_by) LIKE LOWER(?) OR LOWER(pr.supplier_name) LIKE LOWER(?))`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    query += ` ORDER BY pr.id DESC`;

    const result = await db.query(query, params);
    res.json(result.rows || []);
  } catch (err) {
    console.error('Error fetching purchase requests:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET Single Purchase Request by ID or PR Number
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const prRes = await db.query(`
      SELECT 
        pr.*,
        COALESCE(sm.name, pr.supplier_name) as supplier_name,
        sm.address1 as supplier_address,
        COALESCE(sm.mobile1, sm.phone_off) as supplier_phone,
        sm.gst_number as supplier_gst
      FROM purchase_requests pr
      LEFT JOIN supplier_master sm ON pr.supplier_id = sm.id
      WHERE pr.id = ? OR pr.pr_no = ?
    `, [id, id]);

    if (!prRes.rows || prRes.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase Request not found' });
    }

    const pr = prRes.rows[0];

    const itemsRes = await db.query(`
      SELECT 
        pri.*,
        im1.hsn_code,
        im1.tax_type,
        COALESCE(im1.tax, im1.gst_rate) as tax_rate,
        im1.weight as master_weight,
        COALESCE(
          NULLIF(im1.item_name, ''),
          NULLIF(im2.item_name, ''),
          pri.item_name
        ) as resolved_item_name
      FROM purchase_request_items pri
      LEFT JOIN item_master im1 ON pri.item_id = im1.id
      LEFT JOIN item_master im2 ON (pri.item_name GLOB '*[0-9]*' AND CAST(pri.item_name AS INTEGER) = im2.id)
      WHERE pri.purchase_request_id = ? 
      ORDER BY pri.id ASC
    `, [pr.id]);

    const formattedItems = (itemsRes.rows || []).map(it => {
      let displayName = it.resolved_item_name || it.item_name;
      if (displayName && !isNaN(displayName)) {
        displayName = it.item_code ? `Item (${it.item_code})` : `Item #${displayName}`;
      }
      return {
        ...it,
        item_name: displayName || 'Unspecified Item'
      };
    });

    const historyRes = await db.query(`
      SELECT * FROM purchase_request_approval_history 
      WHERE purchase_request_id = ? 
      ORDER BY id DESC
    `, [pr.id]);

    res.json({
      ...pr,
      items: formattedItems,
      approval_history: historyRes.rows || []
    });
  } catch (err) {
    console.error('Error fetching purchase request:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST Create Purchase Request
router.post('/', async (req, res) => {
  try {
    const {
      pr_no,
      request_date,
      required_date,
      department,
      department_id,
      requested_by,
      supplier_id,
      supplier_name,
      godown_id,
      godown_name,
      priority = 'Medium',
      status = 'Draft',
      remarks,
      items = []
    } = req.body;

    const prNumber = pr_no || (await getNextPrNo());
    const reqDate = request_date || new Date().toISOString().split('T')[0];

    const prResult = await db.run(`
      INSERT INTO purchase_requests (
        pr_no, request_date, required_date, department, department_id,
        requested_by, supplier_id, supplier_name, godown_id, godown_name,
        priority, status, remarks, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      prNumber, reqDate, required_date, department, department_id,
      requested_by || 'Admin', supplier_id, supplier_name, godown_id, godown_name,
      priority, status, remarks
    ]);

    const prId = prResult.lastID || prResult.lastInsertRowid;

    // Insert Items
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        if (!item.item_name && !item.item_id) continue;
        let finalItemName = item.item_name || '';
        
        // If finalItemName is missing or numeric, resolve real item name from db
        if (!finalItemName || !isNaN(finalItemName)) {
          const lookupId = item.item_id || finalItemName;
          if (lookupId) {
            try {
              const imCheck = await db.query(`SELECT item_name, name FROM item_master WHERE id = ? OR LOWER(item_name) = LOWER(?) LIMIT 1`, [lookupId, lookupId]);
              if (imCheck.rows && imCheck.rows.length > 0) {
                finalItemName = imCheck.rows[0].item_name || imCheck.rows[0].name || finalItemName;
              } else {
                const itCheck = await db.query(`SELECT item_name, name FROM items WHERE id = ? LIMIT 1`, [lookupId]);
                if (itCheck.rows && itCheck.rows.length > 0) {
                  finalItemName = itCheck.rows[0].item_name || itCheck.rows[0].name || finalItemName;
                }
              }
            } catch (e) {
              console.log('Lookup error for item:', e.message);
            }
          }
        }

        const reqQty = parseFloat(item.requested_qty) || 0;
        const appQty = item.approved_qty !== undefined ? parseFloat(item.approved_qty) : reqQty;
        const estRate = parseFloat(item.estimated_rate) || 0;
        const estAmount = parseFloat(item.estimated_amount) || (reqQty * estRate);
        const curStockRm = parseFloat(item.current_stock_rm !== undefined ? item.current_stock_rm : item.current_stock) || 0;
        const curStockFg = parseFloat(item.current_stock_fg) || 0;

        await db.run(`
          INSERT INTO purchase_request_items (
            purchase_request_id, item_id, item_code, item_name, weight, description,
            requested_qty, approved_qty, unit, current_stock, current_stock_rm, current_stock_fg, minimum_stock,
            suggested_qty, estimated_rate, estimated_amount, remarks
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          prId,
          item.item_id,
          item.item_code,
          finalItemName || 'Item',
          item.weight || '',
          item.description,
          reqQty,
          appQty,
          item.unit || 'kg',
          curStockRm,
          curStockRm,
          curStockFg,
          parseFloat(item.minimum_stock) || 0,
          parseFloat(item.suggested_qty) || 0,
          estRate,
          estAmount,
          item.remarks
        ]);
      }
    }

    // Insert Approval History Entry
    const initialAction = status === 'Submitted' ? 'Submitted' : 'Created';
    await db.run(`
      INSERT INTO purchase_request_approval_history (
        purchase_request_id, action, performed_by, remarks
      ) VALUES (?, ?, ?, ?)
    `, [prId, initialAction, requested_by || 'Admin', remarks || `PR ${initialAction}`]);

    res.status(201).json({
      success: true,
      id: prId,
      pr_no: prNumber,
      message: `Purchase Request ${prNumber} created successfully as ${status}`
    });
  } catch (err) {
    console.error('Error creating purchase request:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT Update Purchase Request (Draft or Returned)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      request_date,
      required_date,
      department,
      department_id,
      requested_by,
      supplier_id,
      supplier_name,
      godown_id,
      godown_name,
      priority,
      status,
      remarks,
      items = []
    } = req.body;

    // Check existing
    const existing = await db.query(`SELECT * FROM purchase_requests WHERE id = ?`, [id]);
    if (!existing.rows || existing.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase Request not found' });
    }

    const currentStatus = existing.rows[0].status;
    if (currentStatus === 'Approved' || currentStatus === 'Converted') {
      return res.status(400).json({ error: `Cannot modify a Purchase Request that is already ${currentStatus}` });
    }

    const newStatus = status || currentStatus;

    await db.run(`
      UPDATE purchase_requests SET
        request_date = COALESCE(?, request_date),
        required_date = COALESCE(?, required_date),
        department = COALESCE(?, department),
        department_id = COALESCE(?, department_id),
        requested_by = COALESCE(?, requested_by),
        supplier_id = COALESCE(?, supplier_id),
        supplier_name = COALESCE(?, supplier_name),
        godown_id = COALESCE(?, godown_id),
        godown_name = COALESCE(?, godown_name),
        priority = COALESCE(?, priority),
        status = ?,
        remarks = COALESCE(?, remarks),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      request_date, required_date, department, department_id,
      requested_by, supplier_id, supplier_name, godown_id, godown_name,
      priority, newStatus, remarks, id
    ]);

    // Replace items
    await db.run(`DELETE FROM purchase_request_items WHERE purchase_request_id = ?`, [id]);

    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        if (!item.item_name && !item.item_id) continue;
        let finalItemName = item.item_name || '';

        if (!finalItemName || !isNaN(finalItemName)) {
          const lookupId = item.item_id || finalItemName;
          if (lookupId) {
            try {
              const imCheck = await db.query(`SELECT item_name, name FROM item_master WHERE id = ? OR LOWER(item_name) = LOWER(?) LIMIT 1`, [lookupId, lookupId]);
              if (imCheck.rows && imCheck.rows.length > 0) {
                finalItemName = imCheck.rows[0].item_name || imCheck.rows[0].name || finalItemName;
              } else {
                const itCheck = await db.query(`SELECT item_name, name FROM items WHERE id = ? LIMIT 1`, [lookupId]);
                if (itCheck.rows && itCheck.rows.length > 0) {
                  finalItemName = itCheck.rows[0].item_name || itCheck.rows[0].name || finalItemName;
                }
              }
            } catch (e) {
              console.log('Lookup error in PUT item:', e.message);
            }
          }
        }

        const reqQty = parseFloat(item.requested_qty) || 0;
        const appQty = item.approved_qty !== undefined ? parseFloat(item.approved_qty) : reqQty;
        const estRate = parseFloat(item.estimated_rate) || 0;
        const estAmount = parseFloat(item.estimated_amount) || (reqQty * estRate);
        const curStockRm = parseFloat(item.current_stock_rm !== undefined ? item.current_stock_rm : item.current_stock) || 0;
        const curStockFg = parseFloat(item.current_stock_fg) || 0;

        await db.run(`
          INSERT INTO purchase_request_items (
            purchase_request_id, item_id, item_code, item_name, weight, description,
            requested_qty, approved_qty, unit, current_stock, current_stock_rm, current_stock_fg, minimum_stock,
            suggested_qty, estimated_rate, estimated_amount, remarks
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          id,
          item.item_id,
          item.item_code,
          finalItemName || 'Item',
          item.weight || '',
          item.description,
          reqQty,
          appQty,
          item.unit || 'kg',
          curStockRm,
          curStockRm,
          curStockFg,
          parseFloat(item.minimum_stock) || 0,
          parseFloat(item.suggested_qty) || 0,
          estRate,
          estAmount,
          item.remarks
        ]);
      }
    }

    // Add history
    const actionName = newStatus === 'Submitted' ? 'Submitted' : 'Updated';
    await db.run(`
      INSERT INTO purchase_request_approval_history (
        purchase_request_id, action, performed_by, remarks
      ) VALUES (?, ?, ?, ?)
    `, [id, actionName, requested_by || 'Admin', remarks || `PR ${actionName}`]);

    res.json({ success: true, message: `Purchase Request updated successfully (${newStatus})` });
  } catch (err) {
    console.error('Error updating purchase request:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE Purchase Request (Only Draft / Returned)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.query(`SELECT * FROM purchase_requests WHERE id = ?`, [id]);
    if (!existing.rows || existing.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase Request not found' });
    }

    const currentStatus = existing.rows[0].status;
    if (currentStatus !== 'Draft' && currentStatus !== 'Returned') {
      return res.status(400).json({ error: `Cannot delete Purchase Request with status ${currentStatus}. Only Draft or Returned requests can be deleted.` });
    }

    await db.run(`DELETE FROM purchase_request_items WHERE purchase_request_id = ?`, [id]);
    await db.run(`DELETE FROM purchase_request_approval_history WHERE purchase_request_id = ?`, [id]);
    await db.run(`DELETE FROM purchase_requests WHERE id = ?`, [id]);

    res.json({ success: true, message: 'Purchase Request deleted successfully' });
  } catch (err) {
    console.error('Error deleting purchase request:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST Submit for Approval
router.post('/:id/submit', async (req, res) => {
  try {
    const { id } = req.params;
    const { submitted_by, remarks } = req.body;

    const existing = await db.query(`SELECT * FROM purchase_requests WHERE id = ?`, [id]);
    if (!existing.rows || existing.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase Request not found' });
    }

    await db.run(`
      UPDATE purchase_requests 
      SET status = 'Submitted', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [id]);

    await db.run(`
      INSERT INTO purchase_request_approval_history (
        purchase_request_id, action, performed_by, remarks
      ) VALUES (?, 'Submitted', ?, ?)
    `, [id, submitted_by || 'Admin', remarks || 'Submitted for approval']);

    res.json({ success: true, message: 'Purchase Request submitted for manager approval' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Approve Purchase Request
router.post('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { approved_by = 'Manager', approval_remarks, item_approvals } = req.body;

    const existing = await db.query(`SELECT * FROM purchase_requests WHERE id = ?`, [id]);
    if (!existing.rows || existing.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase Request not found' });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    await db.run(`
      UPDATE purchase_requests 
      SET status = 'Approved', approved_by = ?, approved_date = ?, approval_remarks = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [approved_by, todayStr, approval_remarks || 'Approved', id]);

    // Optional per-item approved Qty update
    if (Array.isArray(item_approvals) && item_approvals.length > 0) {
      for (const itemApp of item_approvals) {
        if (itemApp.id && itemApp.approved_qty !== undefined) {
          await db.run(`
            UPDATE purchase_request_items 
            SET approved_qty = ?, estimated_amount = (? * estimated_rate)
            WHERE id = ? AND purchase_request_id = ?
          `, [parseFloat(itemApp.approved_qty) || 0, parseFloat(itemApp.approved_qty) || 0, itemApp.id, id]);
        }
      }
    } else {
      // Set approved_qty = requested_qty for items where approved_qty is 0
      await db.run(`
        UPDATE purchase_request_items 
        SET approved_qty = requested_qty 
        WHERE purchase_request_id = ? AND (approved_qty IS NULL OR approved_qty = 0)
      `, [id]);
    }

    await db.run(`
      INSERT INTO purchase_request_approval_history (
        purchase_request_id, action, performed_by, remarks
      ) VALUES (?, 'Approved', ?, ?)
    `, [id, approved_by, approval_remarks || 'Approved by manager']);

    res.json({ success: true, message: 'Purchase Request approved successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Reject Purchase Request
router.post('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { rejected_by = 'Manager', remarks } = req.body;

    if (!remarks || !remarks.trim()) {
      return res.status(400).json({ error: 'Rejection remarks are mandatory' });
    }

    const existing = await db.query(`SELECT * FROM purchase_requests WHERE id = ?`, [id]);
    if (!existing.rows || existing.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase Request not found' });
    }

    await db.run(`
      UPDATE purchase_requests 
      SET status = 'Rejected', approval_remarks = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [remarks, id]);

    await db.run(`
      INSERT INTO purchase_request_approval_history (
        purchase_request_id, action, performed_by, remarks
      ) VALUES (?, 'Rejected', ?, ?)
    `, [id, rejected_by, remarks]);

    res.json({ success: true, message: 'Purchase Request rejected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Return to Requester
router.post('/:id/return', async (req, res) => {
  try {
    const { id } = req.params;
    const { returned_by = 'Manager', remarks } = req.body;

    if (!remarks || !remarks.trim()) {
      return res.status(400).json({ error: 'Remarks are mandatory when returning to requester' });
    }

    const existing = await db.query(`SELECT * FROM purchase_requests WHERE id = ?`, [id]);
    if (!existing.rows || existing.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase Request not found' });
    }

    await db.run(`
      UPDATE purchase_requests 
      SET status = 'Returned', approval_remarks = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [remarks, id]);

    await db.run(`
      INSERT INTO purchase_request_approval_history (
        purchase_request_id, action, performed_by, remarks
      ) VALUES (?, 'Returned', ?, ?)
    `, [id, returned_by, remarks]);

    res.json({ success: true, message: 'Purchase Request returned to requester for clarification' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Copy PR (Duplicate PR)
router.post('/:id/copy', async (req, res) => {
  try {
    const { id } = req.params;
    const { requested_by = 'Admin' } = req.body;

    const existingRes = await db.query(`SELECT * FROM purchase_requests WHERE id = ?`, [id]);
    if (!existingRes.rows || existingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Original Purchase Request not found' });
    }
    const origPr = existingRes.rows[0];

    const itemsRes = await db.query(`SELECT * FROM purchase_request_items WHERE purchase_request_id = ?`, [id]);
    const origItems = itemsRes.rows || [];

    const newPrNo = await getNextPrNo();
    const todayStr = new Date().toISOString().split('T')[0];

    const prResult = await db.run(`
      INSERT INTO purchase_requests (
        pr_no, request_date, required_date, department, department_id,
        requested_by, supplier_id, supplier_name, godown_id, godown_name,
        priority, status, remarks, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      newPrNo, todayStr, origPr.required_date || todayStr, origPr.department, origPr.department_id,
      requested_by, origPr.supplier_id, origPr.supplier_name, origPr.godown_id, origPr.godown_name,
      origPr.priority, `Copied from ${origPr.pr_no}. ${origPr.remarks || ''}`.trim()
    ]);

    const newPrId = prResult.lastID || prResult.lastInsertRowid;

    for (const item of origItems) {
      await db.run(`
        INSERT INTO purchase_request_items (
          purchase_request_id, item_id, item_code, item_name, description,
          requested_qty, approved_qty, unit, current_stock, minimum_stock,
          suggested_qty, estimated_rate, estimated_amount, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        newPrId, item.item_id, item.item_code, item.item_name, item.description,
        item.requested_qty, item.requested_qty, item.unit, item.current_stock,
        item.minimum_stock, item.suggested_qty, item.estimated_rate, item.estimated_amount, item.remarks
      ]);
    }

    await db.run(`
      INSERT INTO purchase_request_approval_history (
        purchase_request_id, action, performed_by, remarks
      ) VALUES (?, 'Created', ?, ?)
    `, [newPrId, requested_by, `Copied from PR ${origPr.pr_no}`]);

    res.status(201).json({
      success: true,
      id: newPrId,
      pr_no: newPrNo,
      message: `Copied Purchase Request successfully as ${newPrNo}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
