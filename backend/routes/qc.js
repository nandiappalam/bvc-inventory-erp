const express = require('express');
const router = express.Router();
const db = require('../config/database');

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// GET /api/qc/pending or /api/quality/pending
router.get('/pending', asyncHandler(async (req, res) => {
  const showAll = req.query.all === 'true';
  
  // Ensure unloading_status, rate, and qc_status columns exist in SQLite
  try {
    await db.run("ALTER TABLE stock_lots ADD COLUMN unloading_status TEXT DEFAULT 'PENDING_DECISION'");
  } catch (e) {
    // Column already exists
  }
  try {
    await db.run("ALTER TABLE stock_lots ADD COLUMN rate REAL DEFAULT 0");
  } catch (e) {
    // Column already exists
  }
  try {
    await db.run("ALTER TABLE stock_lots ADD COLUMN qc_status TEXT DEFAULT 'QC_PENDING'");
  } catch (e) {
    // Column already exists
  }
  try {
    await db.run("ALTER TABLE stock_lots ADD COLUMN purchase_id INTEGER");
  } catch (e) {
    // Column already exists
  }

  let queryStr = `
    SELECT 
      sl.id as stock_lot_id,
      sl.lot_no,
      sl.item_name,
      sl.quantity as received_qty,
      sl.rate,
      sl.qc_status,
      COALESCE(sl.unloading_status, 'PENDING_DECISION') as unloading_status,
      COALESCE(p.id, pi.purchase_id, sl.purchase_id) as purchase_id,
      COALESCE(p.s_no, p.id, pi.purchase_id, sl.purchase_id) as receipt_no,
      p.date as receipt_date,
      p.inv_date as invoice_date,
      COALESCE(sm.print_name, sm.name, p.supplier, '') as supplier_name,
      COALESCE(pi.per_unit_weight, 50) as unit_weight,
      COALESCE(pi.total_weight, (sl.quantity * COALESCE(pi.per_unit_weight, 50))) as total_weight
    FROM stock_lots sl
    LEFT JOIN purchase_items pi ON sl.lot_no = pi.lot_no
    LEFT JOIN purchases p ON (
      CAST(p.id AS TEXT) = CAST(pi.purchase_id AS TEXT) 
      OR CAST(p.id AS TEXT) = CAST(sl.purchase_id AS TEXT) 
      OR ('PUR-' || CAST(p.id AS TEXT)) = CAST(sl.purchase_id AS TEXT) 
      OR ('PUR-' || CAST(p.s_no AS TEXT)) = CAST(sl.purchase_id AS TEXT)
    )
    LEFT JOIN supplier_master sm ON (CAST(sm.id AS TEXT) = CAST(p.supplier AS TEXT) OR sm.name = CAST(p.supplier AS TEXT) OR sm.print_name = CAST(p.supplier AS TEXT))
  `;

  if (!showAll) {
    queryStr += ` WHERE (sl.qc_status = 'QC_PENDING' OR sl.qc_status IS NULL OR sl.qc_status = '') AND sl.lot_no NOT IN (SELECT rm_lot_no FROM qc_inspections) `;
  }

  queryStr += ` ORDER BY COALESCE(p.date, sl.created_at) DESC `;

  const pendingLots = await db.query(queryStr);
  res.json({ success: true, data: pendingLots.rows });
}));

// GET /api/qc/history or /api/quality/purchase-lab-testing
router.get(['/history', '/purchase-lab-testing'], asyncHandler(async (req, res) => {
  const history = await db.query(`
    SELECT 
      qi.id,
      qi.id as qcId,
      qi.qc_no,
      COALESCE(p.id, qi.purchase_id) as purchaseId,
      qi.rm_lot_no as lotNo,
      qi.inspection_date as inspectionDate,
      qi.inspector as analyst,
      qi.overall_result as overallResult,
      qi.remarks,
      COALESCE(sl.item_name, pi.item_name, '') as item,
      COALESCE(sl.quantity, pi.qty, 0) as quantity,
      p.date as receiptDate,
      COALESCE(sm.print_name, sm.name, p.supplier, '') as supplier
    FROM qc_inspections qi
    LEFT JOIN stock_lots sl ON qi.rm_lot_no = sl.lot_no
    LEFT JOIN purchase_items pi ON qi.rm_lot_no = pi.lot_no
    LEFT JOIN purchases p ON (
      CAST(p.id AS TEXT) = CAST(pi.purchase_id AS TEXT) 
      OR CAST(p.id AS TEXT) = CAST(qi.purchase_id AS TEXT) 
      OR ('PUR-' || CAST(p.id AS TEXT)) = CAST(qi.purchase_id AS TEXT) 
      OR ('PUR-' || CAST(p.s_no AS TEXT)) = CAST(qi.purchase_id AS TEXT)
      OR CAST(p.id AS TEXT) = CAST(sl.purchase_id AS TEXT)
    )
    LEFT JOIN supplier_master sm ON (CAST(sm.id AS TEXT) = CAST(p.supplier AS TEXT) OR sm.name = CAST(p.supplier AS TEXT) OR sm.print_name = CAST(p.supplier AS TEXT))
    ORDER BY qi.inspection_date DESC, qi.id DESC
  `);
  res.json({ success: true, data: history.rows });
}));

// GET /api/quality/registers
router.get('/registers', asyncHandler(async (req, res) => {
  // Defensive column checks
  try {
    await db.run("ALTER TABLE stock_lots ADD COLUMN unloading_status TEXT DEFAULT 'PENDING_DECISION'");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE stock_lots ADD COLUMN godown_id INTEGER");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE stock_lots ADD COLUMN godown_name TEXT");
  } catch (e) {}

  const qcList = await db.query(`
    SELECT 
      qi.id,
      qi.qc_no,
      COALESCE(p.id, qi.purchase_id) as purchase_id,
      p.inv_no as invoice_no,
      COALESCE(p.s_no, p.id, qi.purchase_id) as receipt_no,
      qi.rm_lot_no,
      qi.inspection_date,
      qi.overall_result,
      COALESCE(sl.item_name, pi.item_name, '') as item_name,
      COALESCE(sl.quantity, pi.qty, 0) as quantity,
      COALESCE(sl.unloading_status, 'PENDING_DECISION') as unloading_status,
      sl.godown_id,
      g.godown_name,
      COALESCE(sm.print_name, sm.name, p.supplier, '') as supplier_name
    FROM qc_inspections qi
    LEFT JOIN stock_lots sl ON qi.rm_lot_no = sl.lot_no
    LEFT JOIN purchase_items pi ON qi.rm_lot_no = pi.lot_no
    LEFT JOIN purchases p ON (
      CAST(p.id AS TEXT) = CAST(pi.purchase_id AS TEXT) 
      OR CAST(p.id AS TEXT) = CAST(qi.purchase_id AS TEXT) 
      OR ('PUR-' || CAST(p.id AS TEXT)) = CAST(qi.purchase_id AS TEXT) 
      OR ('PUR-' || CAST(p.s_no AS TEXT)) = CAST(qi.purchase_id AS TEXT)
      OR CAST(p.id AS TEXT) = CAST(sl.purchase_id AS TEXT)
    )
    LEFT JOIN supplier_master sm ON (CAST(sm.id AS TEXT) = CAST(p.supplier AS TEXT) OR sm.name = CAST(p.supplier AS TEXT) OR sm.print_name = CAST(p.supplier AS TEXT))
    LEFT JOIN godown_master g ON (CAST(g.id AS TEXT) = CAST(sl.godown_id AS TEXT) OR g.godown_name = CAST(sl.godown_id AS TEXT))
    ORDER BY qi.inspection_date DESC, qi.id DESC
  `);

  for (let row of qcList.rows) {
    const isReturned = await db.query(`
      SELECT pr.id, pr.return_inv_no 
      FROM purchase_return_items pri
      INNER JOIN purchase_returns pr ON CAST(pri.purchase_return_id AS TEXT) = CAST(pr.id AS TEXT)
      WHERE pri.lot_no = ?
    `, [row.rm_lot_no]);
    
    if (isReturned.rows && isReturned.rows.length > 0) {
      row.unloading_status = 'RETURNED';
      row.return_registered = true;
      row.return_inv_no = isReturned.rows[0].return_inv_no;
    }

    const allocs = await db.query(`
      SELECT sl.id, sl.godown_id, sl.quantity, sl.remaining_quantity, sl.unloading_status, g.godown_name
      FROM stock_lots sl
      LEFT JOIN godown_master g ON (CAST(g.id AS TEXT) = CAST(sl.godown_id AS TEXT) OR g.godown_name = CAST(sl.godown_id AS TEXT))
      WHERE sl.lot_no = ?
    `, [row.rm_lot_no]);
    row.allocations = allocs.rows || [];
    if (allocs.rows && allocs.rows.length > 0) {
      const isUnloaded = allocs.rows.some(a => a.unloading_status === 'UNLOADED');
      if (isUnloaded) {
        row.unloading_status = 'UNLOADED';
      }
      const isRet = allocs.rows.some(a => a.unloading_status === 'RETURNED');
      if (isRet) {
        row.unloading_status = 'RETURNED';
      }
      const totalAllocQty = allocs.rows.reduce((sum, a) => sum + (parseFloat(a.quantity) || 0), 0);
      if (totalAllocQty > 0) {
        row.quantity = totalAllocQty;
      }
    }
  }

  const iqrList = await db.query(`
    SELECT 
      iqr.id,
      iqr.iqr_no,
      iqr.qc_id,
      iqr.rm_lot_no,
      iqr.uploaded_date,
      iqr.remarks,
      qi.overall_result,
      COALESCE(sl.item_name, pi.item_name, '') as item_name,
      COALESCE(sl.unloading_status, 'PENDING_DECISION') as unloading_status,
      COALESCE(sm.print_name, sm.name, p.supplier, '') as supplier_name
    FROM incoming_quality_reports iqr
    LEFT JOIN qc_inspections qi ON CAST(iqr.qc_id AS TEXT) = CAST(qi.id AS TEXT)
    LEFT JOIN stock_lots sl ON iqr.rm_lot_no = sl.lot_no
    LEFT JOIN purchase_items pi ON (iqr.rm_lot_no = pi.lot_no OR (qi.rm_lot_no IS NOT NULL AND qi.rm_lot_no = pi.lot_no))
    LEFT JOIN purchases p ON (
      CAST(p.id AS TEXT) = CAST(pi.purchase_id AS TEXT) 
      OR CAST(p.id AS TEXT) = CAST(qi.purchase_id AS TEXT) 
      OR ('PUR-' || CAST(p.id AS TEXT)) = CAST(qi.purchase_id AS TEXT) 
      OR ('PUR-' || CAST(p.s_no AS TEXT)) = CAST(qi.purchase_id AS TEXT)
      OR CAST(p.id AS TEXT) = CAST(sl.purchase_id AS TEXT)
    )
    LEFT JOIN supplier_master sm ON (CAST(sm.id AS TEXT) = CAST(p.supplier AS TEXT) OR sm.name = CAST(p.supplier AS TEXT) OR sm.print_name = CAST(p.supplier AS TEXT))
    ORDER BY iqr.uploaded_date DESC, iqr.id DESC
  `);

  res.json({ 
    success: true, 
    data: {
      qc: qcList.rows,
      iqr: iqrList.rows
    }
  });
}));

// GET /api/qc/inspection/:id or /api/quality/purchase-lab-testing/:id
router.get(['/inspection/:id', '/purchase-lab-testing/:id'], asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    await db.run("ALTER TABLE stock_lots ADD COLUMN godown_id INTEGER");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE stock_lots ADD COLUMN godown_name TEXT");
  } catch (e) {}

  const inspectionResult = await db.query(`
    SELECT 
      qi.id,
      qi.id as qcId,
      qi.qc_no,
      COALESCE(p.id, qi.purchase_id) as purchaseId,
      qi.rm_lot_no as lotNo,
      qi.inspection_date as inspectionDate,
      qi.inspector as analyst,
      qi.overall_result as overallResult,
      qi.remarks,
      COALESCE(sl.item_name, pi.item_name, '') as item,
      COALESCE(sl.quantity, pi.qty, 0) as quantity,
      COALESCE(sl.unloading_status, 'PENDING_DECISION') as unloadingStatus,
      COALESCE(sl.unloading_status, 'PENDING_DECISION') as unloading_status,
      sl.godown_id,
      g.godown_name,
      COALESCE(sm.print_name, sm.name, p.supplier, '') as supplier,
      p.date as receipt_date,
      p.inv_date as invoice_date,
      COALESCE(pi.per_unit_weight, 50) as unit_weight,
      COALESCE(pi.total_weight, (COALESCE(sl.quantity, pi.qty, 0) * COALESCE(pi.per_unit_weight, 50))) as total_weight,
      p.inv_no as invoice_no
    FROM qc_inspections qi
    LEFT JOIN stock_lots sl ON qi.rm_lot_no = sl.lot_no
    LEFT JOIN purchase_items pi ON qi.rm_lot_no = pi.lot_no
    LEFT JOIN purchases p ON (
      CAST(p.id AS TEXT) = CAST(pi.purchase_id AS TEXT) 
      OR CAST(p.id AS TEXT) = CAST(qi.purchase_id AS TEXT) 
      OR ('PUR-' || CAST(p.id AS TEXT)) = CAST(qi.purchase_id AS TEXT) 
      OR ('PUR-' || CAST(p.s_no AS TEXT)) = CAST(qi.purchase_id AS TEXT)
      OR CAST(p.id AS TEXT) = CAST(sl.purchase_id AS TEXT)
    )
    LEFT JOIN supplier_master sm ON (CAST(sm.id AS TEXT) = CAST(p.supplier AS TEXT) OR sm.name = CAST(p.supplier AS TEXT) OR sm.print_name = CAST(p.supplier AS TEXT))
    LEFT JOIN godown_master g ON (CAST(sl.godown_id AS TEXT) = CAST(g.id AS TEXT) OR g.godown_name = CAST(sl.godown_id AS TEXT))
    WHERE qi.id = ? OR qi.qc_no = ?
  `, [id, id]);

  if (inspectionResult.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Inspection not found' });
  }

  const rowData = inspectionResult.rows[0];
  if (rowData.lotNo) {
    try {
      const returnCheck = await db.query(`
        SELECT pr.id, pr.return_inv_no 
        FROM purchase_return_items pri
        INNER JOIN purchase_returns pr ON pri.purchase_return_id = pr.id
        WHERE pri.lot_no = ?
      `, [rowData.lotNo]);

      if (returnCheck.rows && returnCheck.rows.length > 0) {
        rowData.unloadingStatus = 'RETURNED';
        rowData.unloading_status = 'RETURNED';
        rowData.return_registered = true;
        rowData.return_inv_no = returnCheck.rows[0].return_inv_no;
      }
    } catch (e) {}
  }

  const paramsResult = await db.query(`
    SELECT param_key, param_value 
    FROM qc_inspection_params 
    WHERE qc_id = ?
  `, [id]);

  // Decode params
  const qcResults = paramsResult.rows.map(row => {
    try {
      return JSON.parse(row.param_value);
    } catch (e) {
      return {
        parameterKey: row.param_key,
        actualResult: row.param_value,
        status: 'PENDING'
      };
    }
  });

  const iqrResult = await db.query(`
    SELECT iqr_no, uploaded_date, remarks
    FROM incoming_quality_reports
    WHERE qc_id = ?
  `, [id]);

  res.json({ 
    success: true, 
    data: {
      ...inspectionResult.rows[0],
      qcResults,
      iqr: iqrResult.rows[0] || null
    }
  });
}));

// POST /api/qc/submit or /api/quality/purchase-lab-testing
router.post(['/submit', '/purchase-lab-testing'], asyncHandler(async (req, res) => {
  const { qcHeader, summary } = req.body;
  if (!qcHeader || !qcHeader.lotNo) {
    return res.status(400).json({ success: false, message: 'qcHeader with lotNo is required.' });
  }

  const {
    qcId,
    purchaseId,
    lotNo,
    supplier,
    item,
    batch,
    analyst,
    remarks,
    qcResults = []
  } = qcHeader;

  const overallResult = summary?.overallResult || qcHeader.status || 'ACCEPTED';

  // Use a transaction
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Update or Insert stock_lots table in the database
    let usable_for_production = 0;
    let approval_status = 'PENDING_APPROVAL';

    if (overallResult === 'ACCEPTED' || overallResult === 'PASS') {
      usable_for_production = 1;
      approval_status = 'APPROVED';
    } else if (overallResult === 'REJECTED' || overallResult === 'FAIL') {
      usable_for_production = 0;
      approval_status = 'REJECTED';
    } else if (overallResult === 'HOLD') {
      usable_for_production = 0;
      approval_status = 'ON_HOLD';
    }

    // Ensure columns exist in SQLite database
    try {
      await connection.run("ALTER TABLE stock_lots ADD COLUMN usable_for_production INTEGER DEFAULT 0");
    } catch (e) {}
    try {
      await connection.run("ALTER TABLE stock_lots ADD COLUMN approval_status TEXT DEFAULT 'PENDING_APPROVAL'");
    } catch (e) {}
    try {
      await connection.run("ALTER TABLE stock_lots ADD COLUMN approval_date TEXT");
    } catch (e) {}
    try {
      await connection.run("ALTER TABLE stock_lots ADD COLUMN unloading_status TEXT DEFAULT 'PENDING_DECISION'");
    } catch (e) {}

    // Check if lot exists
    const lotCheck = await connection.query("SELECT id FROM stock_lots WHERE lot_no = ?", [lotNo]);
    if (lotCheck.rows.length === 0) {
      // Manual entry: insert stock lot automatically
      const autoQty = qcHeader.quantity ? Number(qcHeader.quantity) : 100;
      await connection.run(
        `INSERT INTO stock_lots (item_name, lot_no, purchase_id, quantity, remaining_quantity, rate, qc_status, usable_for_production, approval_status, approval_date, unloading_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_DECISION')`,
        [
          item || 'Manual Material',
          lotNo,
          purchaseId ? Number(purchaseId) : null,
          autoQty,
          autoQty,
          qcHeader.rate ? Number(qcHeader.rate) : 0,
          overallResult,
          usable_for_production,
          approval_status,
          new Date().toISOString().split('T')[0]
        ]
      );
    } else {
      await connection.run(
        `UPDATE stock_lots 
         SET qc_status = ?, usable_for_production = ?, approval_status = ?, approval_date = ?
         WHERE lot_no = ?`,
        [overallResult, usable_for_production, approval_status, new Date().toISOString().split('T')[0], lotNo]
      );
    }

    let savedQcId = qcId;

    if (qcId) {
      // Update existing qc_inspections record
      await connection.run(
        `UPDATE qc_inspections 
         SET purchase_id = ?, rm_lot_no = ?, inspection_date = ?, inspector = ?, overall_result = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [purchaseId, lotNo, new Date().toISOString().split('T')[0], analyst, overallResult, remarks, qcId]
      );

      // Clear existing params to rewrite them
      await connection.run(`DELETE FROM qc_inspection_params WHERE qc_id = ?`, [qcId]);
    } else {
      // Insert new qc_inspections record
      const qc_no = `QC-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 8)}-${Math.floor(1000 + Math.random() * 9000)}`;
      const result = await connection.run(
        `INSERT INTO qc_inspections (qc_no, purchase_id, rm_lot_no, inspection_date, inspector, overall_result, remarks)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [qc_no, purchaseId, lotNo, new Date().toISOString().split('T')[0], analyst || 'QC Engineer', overallResult, remarks]
      );
      savedQcId = result.lastID;
    }

    // 2. Insert params
    for (const resItem of qcResults) {
      const key = resItem.parameterKey || resItem.id || resItem.parameter;
      // Serialize full param result details into param_value to avoid data duplication
      const serializedValue = JSON.stringify({
        parameterKey: key,
        parameterName: resItem.parameter || resItem.parameterName || key,
        category: resItem.category || '',
        actualResult: resItem.actualResult !== undefined ? resItem.actualResult : (resItem.actual || ''),
        status: resItem.status || 'PENDING',
        remarks: resItem.remarks || '',
        unit: resItem.unit || '',
        method: resItem.method || '',
        min: resItem.min,
        max: resItem.max,
        specification: resItem.specification || ''
      });

      await connection.run(
        `INSERT INTO qc_inspection_params (qc_id, param_key, param_value) VALUES (?, ?, ?)`,
        [savedQcId, key, serializedValue]
      );
    }

    await connection.commit();
    res.status(201).json({ 
      success: true, 
      message: 'QC inspection saved successfully', 
      data: { qcId: savedQcId, overallResult } 
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error submitting QC:', error);
    res.status(500).json({ success: false, message: 'Failed to submit QC inspection.', error: error.message });
  } finally {
    connection.release();
  }
}));

// POST /api/quality/iqr/generate
router.post('/iqr/generate', asyncHandler(async (req, res) => {
  const { qcId } = req.body;
  if (!qcId) {
    const queryQcId = req.query.qcId;
    if (!queryQcId) {
      return res.status(400).json({ success: false, message: 'qcId is required.' });
    }
  }

  const targetQcId = qcId || req.query.qcId;

  // Retrieve inspection details to get lot number
  const inspection = await db.query(`SELECT rm_lot_no FROM qc_inspections WHERE id = ?`, [targetQcId]);
  if (inspection.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'QC inspection not found' });
  }

  const lotNo = inspection.rows[0].rm_lot_no;
  const iqr_no = `IQR-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 8)}-${targetQcId}`;

  // Insert or update report
  const existingReport = await db.query(`SELECT id FROM incoming_quality_reports WHERE qc_id = ?`, [targetQcId]);
  
  if (existingReport.rows.length > 0) {
    res.json({ 
      success: true, 
      message: 'IQR already exists for this inspection', 
      data: { iqrId: existingReport.rows[0].id, iqrNo: iqr_no } 
    });
  } else {
    const result = await db.run(
      `INSERT INTO incoming_quality_reports (iqr_no, qc_id, rm_lot_no, uploaded_date, uploaded_by, remarks)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [iqr_no, targetQcId, lotNo, new Date().toISOString().split('T')[0], 'QC System', 'Autogenerated IQR from QC Master Record']
    );

    res.status(201).json({ 
      success: true, 
      message: 'Incoming Quality Report (IQR) generated successfully', 
      data: { iqrId: result.lastID, iqrNo: iqr_no } 
    });
  }
}));

// POST /api/quality/coa/generate
router.post('/coa/generate', asyncHandler(async (req, res) => {
  const { qcId } = req.body;
  const targetQcId = qcId || req.query.qcId;
  if (!targetQcId) {
    return res.status(400).json({ success: false, message: 'qcId is required.' });
  }

  // Retrieve inspection details to confirm it exists
  const inspection = await db.query(`SELECT rm_lot_no, qc_no FROM qc_inspections WHERE id = ?`, [targetQcId]);
  if (inspection.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'QC inspection not found' });
  }

  const coaNo = `COA-${inspection.rows[0].qc_no || targetQcId}`;
  res.json({ 
    success: true, 
    message: 'Certificate of Analysis (COA) generated successfully', 
    data: { coaNo, qcId: targetQcId } 
  });
}));

// POST /api/qc/unload or /api/quality/unload
router.post('/unload', asyncHandler(async (req, res) => {
  const { lotNo, status } = req.body;
  if (!lotNo || !status) {
    return res.status(400).json({ success: false, message: 'lotNo and status are required' });
  }

  // Ensure columns exist in SQLite
  try {
    await db.run("ALTER TABLE stock_lots ADD COLUMN unloading_status TEXT DEFAULT 'PENDING_DECISION'");
  } catch (e) {}

  if (status === 'RETURNED') {
    await db.run(
      `UPDATE stock_lots 
       SET unloading_status = 'RETURNED', qc_status = 'REJECTED', usable_for_production = 0, approval_status = 'REJECTED' 
       WHERE lot_no = ?`,
      [lotNo]
    );

    try {
      await db.run(
        `UPDATE qc_inspections 
         SET overall_result = 'REJECTED' 
         WHERE rm_lot_no = ?`,
        [lotNo]
      );
    } catch (e) {}

    try {
      await db.run(
        `UPDATE vehicle_movements 
         SET status = 'RETURNED', operation_type = 'RETURN', gate_out_time = datetime('now', 'localtime') 
         WHERE UPPER(lot_no) = UPPER(?) 
            OR reference_id IN (SELECT CAST(purchase_id AS TEXT) FROM stock_lots WHERE lot_no = ?)`,
        [lotNo, lotNo]
      );
    } catch (e) {}

    // Remove any existing stock entries for this lot
    try {
      await db.run("DELETE FROM stock WHERE lot_no = ? AND type = 'Purchase'", [lotNo]);
    } catch (e) {}
  } else {
    await db.run(
      `UPDATE stock_lots 
       SET unloading_status = ? 
       WHERE lot_no = ?`,
      [status, lotNo]
    );
  }

  // Gather details for return data prefill
  let returnData = {};
  try {
    const lotRes = await db.query(
      `SELECT sl.*, p.id as pur_id, p.inv_no, p.supplier as supplier_id, p.lorry_no 
       FROM stock_lots sl 
       LEFT JOIN purchases p ON sl.purchase_id = p.id 
       WHERE sl.lot_no = ? LIMIT 1`, 
      [lotNo]
    );
    if (lotRes.rows.length > 0) {
      const lRow = lotRes.rows[0];
      let partyName = '';
      let itemName = lRow.item_name || '';
      let qty = lRow.quantity || 0;
      let weight = 0;
      let rate = lRow.rate || 0;
      let purchaseId = lRow.purchase_id || '';
      let vehicleNo = lRow.lorry_no || '';

      if (lRow.supplier_id) {
        try {
          const supRes = await db.query(`SELECT print_name, name FROM supplier_master WHERE id = ? OR name = ?`, [lRow.supplier_id, lRow.supplier_id]);
          if (supRes.rows.length > 0) partyName = supRes.rows[0].print_name || supRes.rows[0].name || '';
        } catch (e) {}
      }

      let invNo = lRow.inv_no || '';
      if (!invNo && lRow.purchase_id) {
        try {
          const pInvRes = await db.query(`SELECT inv_no FROM purchases WHERE id = ?`, [lRow.purchase_id]);
          if (pInvRes.rows.length > 0) invNo = pInvRes.rows[0].inv_no || '';
        } catch (e) {}
      }

      let disc = 0;
      let tax = 0;

      try {
        const piRes = await db.query(`SELECT weight, per_unit_weight, qty, rate, item_name, disc_percent, tax_percent FROM purchase_items WHERE lot_no = ? OR purchase_id = ? LIMIT 1`, [lotNo, purchaseId]);
        if (piRes.rows.length > 0) {
          const pi = piRes.rows[0];
          if (!itemName) itemName = pi.item_name;
          if (!qty) qty = pi.qty;
          if (!rate) rate = pi.rate;
          weight = pi.weight || pi.per_unit_weight || 0;
          disc = pi.disc_percent || 0;
          tax = pi.tax_percent || 0;
        }
      } catch (e) {}

      try {
        const vmRes = await db.query(`SELECT vehicle_no, party_name FROM vehicle_movements WHERE UPPER(lot_no) = UPPER(?) OR reference_id = ? LIMIT 1`, [lotNo, String(purchaseId)]);
        if (vmRes.rows.length > 0) {
          if (!vehicleNo) vehicleNo = vmRes.rows[0].vehicle_no || '';
          if (!partyName) partyName = vmRes.rows[0].party_name || '';
        }
      } catch (e) {}

      returnData = {
        partyName,
        itemName,
        qty,
        weight,
        lotNo,
        purchaseId,
        invNo,
        rate,
        disc,
        tax,
        vehicleNo
      };
    }
  } catch (e) {
    console.error('Error compiling returnData in /qc/unload:', e);
  }

  res.json({ 
    success: true, 
    message: `Lot status updated to ${status}.`,
    returnData
  });
}));

// POST /api/qc/confirm-disposal
router.post('/confirm-disposal', asyncHandler(async (req, res) => {
  const { lotNo, godownId, unloadedQty, purchaseId, allocations } = req.body;

  let finalAllocations = [];
  if (Array.isArray(allocations) && allocations.length > 0) {
    finalAllocations = allocations.map(a => ({
      godownId: parseInt(a.godownId),
      qty: parseFloat(a.qty) || 0
    })).filter(a => a.godownId && a.qty > 0);
  } else if (lotNo && godownId && unloadedQty !== undefined) {
    finalAllocations = [{ godownId: parseInt(godownId), qty: parseFloat(unloadedQty) }];
  }

  if (!lotNo || finalAllocations.length === 0) {
    return res.status(400).json({ success: false, message: 'lotNo and valid godown allocations are required' });
  }

  // Ensure columns exist
  try {
    await db.run("ALTER TABLE stock_lots ADD COLUMN unloading_status TEXT DEFAULT 'PENDING_DECISION'");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE stock_lots ADD COLUMN godown_id INTEGER");
  } catch (e) {}

  // 1. Get base info for this lot
  const lotCheck = await db.query('SELECT * FROM stock_lots WHERE lot_no = ? LIMIT 1', [lotNo]);
  const baseLot = lotCheck.rows[0] || {};
  let finalPurchaseId = purchaseId || baseLot.purchase_id || null;

  let itemId = baseLot.item_id || null;
  let itemName = baseLot.item_name || '';
  let rate = baseLot.rate || 0;
  let unitWeight = 50;

  if (finalPurchaseId) {
    const pItems = await db.query('SELECT item_id, item_name, rate, per_unit_weight FROM purchase_items WHERE lot_no = ? LIMIT 1', [lotNo]);
    if (pItems.rows.length > 0) {
      if (!itemId) itemId = pItems.rows[0].item_id;
      if (!itemName) itemName = pItems.rows[0].item_name;
      if (!rate) rate = pItems.rows[0].rate;
      if (pItems.rows[0].per_unit_weight) unitWeight = parseFloat(pItems.rows[0].per_unit_weight) || 50;
    }
  }

  // 2. Re-create stock_lots records for each godown allocation
  await db.run('DELETE FROM stock_lots WHERE lot_no = ?', [lotNo]);

  const todayStr = new Date().toISOString().split('T')[0];
  for (const alloc of finalAllocations) {
    await db.run(
      `INSERT INTO stock_lots (
         item_id, item_name, lot_no, purchase_id, godown_id, quantity, remaining_quantity, 
         rate, qc_status, usable_for_production, approval_status, approval_date, unloading_status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'APPROVED', ?, 'UNLOADED')`,
      [
        itemId,
        itemName,
        lotNo,
        finalPurchaseId,
        alloc.godownId,
        alloc.qty,
        alloc.qty,
        rate,
        baseLot.qc_status || 'ACCEPTED',
        todayStr
      ]
    );
  }

  // 3. Update stock table entries for each allocated godown
  try {
    await db.run("DELETE FROM stock WHERE lot_no = ? AND type = 'Purchase'", [lotNo]);
    for (const alloc of finalAllocations) {
      const godownRes = await db.query('SELECT godown_name FROM godown_master WHERE id = ?', [alloc.godownId]);
      const godownName = godownRes.rows[0]?.godown_name || `Godown ${alloc.godownId}`;
      const totalWeight = alloc.qty * unitWeight;
      const totalAmount = alloc.qty * rate;

      await db.run(
        `INSERT INTO stock (
           date, item_id, item_name, lot_no, qty, weight, rate, amount, type, reference_id, godown, godown_id, status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Purchase', ?, ?, ?, 'Active')`,
        [
          todayStr,
          itemId,
          itemName,
          lotNo,
          alloc.qty,
          totalWeight,
          rate,
          totalAmount,
          finalPurchaseId,
          godownName,
          alloc.godownId
        ]
      );
    }
  } catch (err) {
    console.error('Error updating stock table for confirm-disposal:', err);
  }

  // 4. Find and update the associated vehicle movement to 'UNLOADED' with a gate-out timestamp
  let invNo = null;
  if (finalPurchaseId) {
    const pResult = await db.query('SELECT inv_no FROM purchases WHERE id = ?', [finalPurchaseId]);
    if (pResult.rows.length > 0) {
      invNo = pResult.rows[0].inv_no;
    }
  }

  if (lotNo) {
    // First, try to update by specific lot_no
    const updateLotResult = await db.run(
      `UPDATE vehicle_movements 
       SET status = 'UNLOADED', 
           gate_out_time = datetime('now', 'localtime')
       WHERE UPPER(lot_no) = UPPER(?) 
         AND UPPER(reference_type) = 'PURCHASE' 
         AND status = 'IN'`,
      [lotNo]
    );
    
    // If we didn't find/update any by lot_no, fall back to purchase reference
    if (updateLotResult.changes === 0 && (finalPurchaseId || invNo)) {
      await db.run(
        `UPDATE vehicle_movements 
         SET status = 'UNLOADED', 
             gate_out_time = datetime('now', 'localtime')
         WHERE (reference_id = ? OR reference_id = ?) 
           AND UPPER(reference_type) = 'PURCHASE' 
           AND status = 'IN'`,
        [String(finalPurchaseId || ''), String(invNo || '')]
      );
    }
  } else if (finalPurchaseId || invNo) {
    await db.run(
      `UPDATE vehicle_movements 
       SET status = 'UNLOADED', 
           gate_out_time = datetime('now', 'localtime')
       WHERE (reference_id = ? OR reference_id = ?) 
         AND UPPER(reference_type) = 'PURCHASE' 
         AND status = 'IN'`,
      [String(finalPurchaseId || ''), String(invNo || '')]
    );
  }

  res.json({ 
    success: true, 
    message: 'Plant disposal and multi-godown unloading verified successfully. Vehicle gate-pass issued (marked UNLOADED).' 
  });
}));

// POST /api/qc/override-approve
router.post('/override-approve', asyncHandler(async (req, res) => {
  const { lotNo } = req.body;
  if (!lotNo) {
    return res.status(400).json({ success: false, message: 'lotNo is required' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Update qc_inspections overall_result
    await connection.run(
      `UPDATE qc_inspections 
       SET overall_result = 'ACCEPTED', remarks = COALESCE(remarks, '') || ' (Overridden to Approved)'
       WHERE rm_lot_no = ?`,
      [lotNo]
    );

    // Update stock_lots
    await connection.run(
      `UPDATE stock_lots 
       SET qc_status = 'ACCEPTED', usable_for_production = 1, approval_status = 'APPROVED', approval_date = ?
       WHERE lot_no = ?`,
      [new Date().toISOString().split('T')[0], lotNo]
    );

    await connection.commit();
    res.json({ success: true, message: `Lot ${lotNo} successfully approved for unloading.` });
  } catch (error) {
    await connection.rollback();
    console.error('Error during override approval:', error);
    res.status(500).json({ success: false, message: 'Error during override approval', error: error.message });
  }
}));

module.exports = router;
