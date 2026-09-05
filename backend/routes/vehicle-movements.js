const express = require('express')
const router = express.Router()
const db = require('../config/database')

// Ensure columns exist on startup
const initColumns = async () => {
  const columnsToAdd = [
    { name: 'item_name', type: 'TEXT' },
    { name: 'qty', type: 'REAL DEFAULT 0' },
    { name: 'weight', type: 'REAL DEFAULT 0' },
    { name: 'party_name', type: 'TEXT' },
    { name: 'lot_no', type: 'TEXT' },
    { name: 'analyzing_team', type: 'TEXT' },
    { name: 'analyzing_area', type: 'TEXT' }
  ];
  for (const col of columnsToAdd) {
    try {
      await db.run(`ALTER TABLE vehicle_movements ADD COLUMN ${col.name} ${col.type}`);
    } catch (e) {
      // ignore if already exists
    }
  }
};
initColumns();

// GET /api/vehicle-movements/reference-options/:type
router.get('/reference-options/:type', async (req, res) => {
  try {
    const type = req.params.type.toUpperCase()
    if (type === 'PURCHASE') {
      // Return purchases with invoice/party details
      const result = await db.query(`
        SELECT p.id, p.inv_no as reference_id, s.name as party_name,
               pi.item_name, pi.qty, pi.per_unit_weight as weight, pi.lot_no
        FROM purchases p
        LEFT JOIN supplier_master s ON (CAST(s.id AS TEXT) = CAST(p.supplier AS TEXT) OR s.name = p.supplier OR s.print_name = p.supplier)
        LEFT JOIN purchase_items pi ON CAST(pi.purchase_id AS TEXT) = CAST(p.id AS TEXT)
      `)
      return res.json(result.rows)
    } else if (type === 'SALES') {
      // Return sales with bill/party details
      const result = await db.query(`
        SELECT s.id, s.s_no as reference_id, c.name as party_name,
               si.item_name, si.qty, si.weight, si.lot_no
        FROM sales s
        LEFT JOIN customer_master c ON (CAST(c.id AS TEXT) = CAST(s.customer AS TEXT) OR c.name = s.customer OR c.print_name = s.customer)
        LEFT JOIN sales_items si ON CAST(si.sales_id AS TEXT) = CAST(s.id AS TEXT)
      `)
      return res.json(result.rows)
    } else {
      return res.json([])
    }
  } catch (error) {
    console.error('Error fetching reference options:', error)
    res.status(500).json({ error: error.message })
  }
})

// Dynamic status tracker helper
async function autoTrackMovementStatus(db, movement) {
  let computedStatus = movement.status || 'IN';
  let computedOperationType = movement.operation_type || 'UNLOAD';
  let statusDetails = '';
  let qcStatus = '';

  let details = {
    party_name: movement.party_name || '',
    item_name: movement.item_name || '',
    qty: movement.qty || 0,
    weight: movement.weight || 0,
    lot_no: movement.lot_no || ''
  };

  const gross = parseFloat(movement.gross_weight) || 0;
  const tare = parseFloat(movement.tare_weight) || 0;

  if (movement.reference_type === 'PURCHASE' && movement.reference_id) {
    // Check purchase details
    let pRes;
    const lotToMatch = movement.lot_no || details.lot_no;
    if (lotToMatch) {
      pRes = await db.query(`
        SELECT p.id as purchase_id, p.inv_no, COALESCE(s.print_name, s.name, p.supplier) as party_name,
               pi.item_name, pi.qty, pi.per_unit_weight as weight, pi.lot_no
        FROM purchases p
        LEFT JOIN supplier_master s ON (CAST(s.id AS TEXT) = CAST(p.supplier AS TEXT) OR s.name = p.supplier OR s.print_name = p.supplier)
        LEFT JOIN purchase_items pi ON CAST(pi.purchase_id AS TEXT) = CAST(p.id AS TEXT)
        WHERE (p.inv_no = ? OR CAST(p.id AS TEXT) = ? OR CAST(p.s_no AS TEXT) = ?) AND pi.lot_no = ?
      `, [String(movement.reference_id), String(movement.reference_id), String(movement.reference_id), lotToMatch]);
    }

    // Fallback if no specific lot row found or if no lot was provided
    if (!pRes || pRes.rows.length === 0) {
      pRes = await db.query(`
        SELECT p.id as purchase_id, p.inv_no, COALESCE(s.print_name, s.name, p.supplier) as party_name,
               pi.item_name, pi.qty, pi.per_unit_weight as weight, pi.lot_no
        FROM purchases p
        LEFT JOIN supplier_master s ON (CAST(s.id AS TEXT) = CAST(p.supplier AS TEXT) OR s.name = p.supplier OR s.print_name = p.supplier)
        LEFT JOIN purchase_items pi ON CAST(pi.purchase_id AS TEXT) = CAST(p.id AS TEXT)
        WHERE p.inv_no = ? OR CAST(p.id AS TEXT) = ? OR CAST(p.s_no AS TEXT) = ?
      `, [String(movement.reference_id), String(movement.reference_id), String(movement.reference_id)]);
    }

    if (pRes.rows.length > 0) {
      const row = pRes.rows[0];
      details.party_name = row.party_name || details.party_name;
      details.item_name = row.item_name || details.item_name;
      details.qty = row.qty || details.qty;
      details.weight = row.weight || details.weight;
      if (!details.lot_no) {
        details.lot_no = row.lot_no || '';
      }
    }

    const activeLotNo = details.lot_no || movement.lot_no;
    const refId = movement.reference_id;

    // 1. Check if used in grinding (grain_input_items)
    let grindRes = { rows: [] };
    if (activeLotNo) {
      try {
        grindRes = await db.query(`SELECT id FROM grain_input_items WHERE lot_no = ?`, [activeLotNo]);
      } catch (e) {
        console.error('Grind check error:', e);
      }
    }

    // 2. Check if QC passed or rejected
    let qcRes = { rows: [] };
    try {
      qcRes = await db.query(`
        SELECT overall_result as status FROM qc_inspections 
        WHERE (rm_lot_no IS NOT NULL AND rm_lot_no != '' AND UPPER(rm_lot_no) = UPPER(?))
           OR (purchase_id IS NOT NULL AND (CAST(purchase_id AS TEXT) = CAST(? AS TEXT) OR purchase_id IN (SELECT id FROM purchases WHERE inv_no = ? OR CAST(id AS TEXT) = ?)))
      `, [activeLotNo || '', refId || '', refId || '', refId || '']);
    } catch (e) {
      console.error('QC check error:', e);
    }

    // 3. Check if unloaded in stock_lots
    let isUnloadedInStock = false;
    if (activeLotNo) {
      try {
        const stockRes = await db.query(`SELECT id FROM stock_lots WHERE lot_no = ? AND unloading_status = 'UNLOADED'`, [activeLotNo]);
        if (stockRes.rows.length > 0) isUnloadedInStock = true;
      } catch (e) {
        console.error('Stock check error:', e);
      }
    }

    // 4. Check if returned in purchase_returns, purchase_return_items, or stock_lots
    let isReturned = false;
    try {
      let retRows = [];
      try {
        const retRes = await db.query(`
          SELECT id FROM purchase_returns 
          WHERE (lot_no IS NOT NULL AND lot_no != '' AND UPPER(lot_no) = UPPER(?))
             OR (purchase_id IS NOT NULL AND (CAST(purchase_id AS TEXT) = CAST(? AS TEXT) OR purchase_id IN (SELECT id FROM purchases WHERE inv_no = ? OR CAST(id AS TEXT) = ?)))
        `, [activeLotNo || '', refId || '', refId || '', refId || '']);
        retRows = retRes.rows || [];
      } catch (e1) {
        // Fallback check on purchase_returns if lot_no or purchase_id columns differ
      }

      let priRows = [];
      try {
        const priRes = await db.query(`
          SELECT id FROM purchase_return_items WHERE lot_no IS NOT NULL AND lot_no != '' AND UPPER(lot_no) = UPPER(?)
        `, [activeLotNo || '']);
        priRows = priRes.rows || [];
      } catch (e2) {}

      let stockRetRows = [];
      try {
        const stockRetRes = await db.query(`
          SELECT id FROM stock_lots 
          WHERE (lot_no IS NOT NULL AND lot_no != '' AND UPPER(lot_no) = UPPER(?))
            AND (unloading_status = 'RETURNED' OR qc_status = 'REJECTED' OR approval_status = 'REJECTED')
        `, [activeLotNo || '']);
        stockRetRows = stockRetRes.rows || [];
      } catch (e3) {}

      if (retRows.length > 0 || priRows.length > 0 || stockRetRows.length > 0) {
        isReturned = true;
      }
    } catch (e) {
      console.error('Purchase return check error:', e);
    }

    const hasGrind = grindRes.rows.length > 0;
    const isQcPassed = qcRes.rows.some(r => {
      const s = String(r.status || '').toUpperCase();
      return s === 'PASSED' || s === 'APPROVED' || s === 'SUCCESS' || s === 'COMPLETED' || s === 'VERIFIED' || s === 'ACCEPTED';
    });
    const isQcRejected = qcRes.rows.some(r => {
      const s = String(r.status || '').toUpperCase();
      return s === 'REJECTED' || s === 'FAILED' || s === 'FAIL' || s === 'RETURN' || s === 'RETURNED';
    });

    if (isQcRejected) qcStatus = 'REJECTED';
    else if (isQcPassed) qcStatus = 'PASSED';

    const isExplicitReturn = (
      isReturned || 
      isQcRejected || 
      String(movement.status || '').toUpperCase() === 'RETURNED' || 
      String(movement.status || '').toUpperCase() === 'REJECTED' || 
      String(movement.status || '').toUpperCase() === 'RETURN' ||
      String(movement.operation_type || '').toUpperCase() === 'RETURN'
    );

    if (isExplicitReturn) {
      computedStatus = 'RETURNED';
      computedOperationType = 'RETURN';
      statusDetails = 'REJECTED & RETURNED';
      if (isQcRejected) statusDetails += ' (QC Rejected)';
      if (isReturned) statusDetails += ' (Purchase Return Issued)';
    } else if (hasGrind || isUnloadedInStock || String(movement.status || '').toUpperCase() === 'UNLOADED') {
      computedStatus = 'UNLOADED';
      computedOperationType = 'UNLOAD';
      statusDetails = 'UNLOADED (In Stock)';
    } else if (String(movement.status || '').toUpperCase() === 'UNLOAD') {
      computedStatus = 'UNLOAD';
      computedOperationType = 'UNLOAD';
      statusDetails = isQcPassed ? 'QC Passed - Approved for Unloading' : 'Approved for Unloading';
    } else if ((gross > 0 && tare > 0) || (movement.gate_out_time && String(movement.gate_out_time).trim() !== '') || String(movement.status || '').toUpperCase() === 'OUT') {
      computedStatus = 'OUT';
      computedOperationType = movement.operation_type || 'UNLOAD';
      statusDetails = 'Vehicle Exited';
    } else {
      computedStatus = movement.status || 'IN';
      computedOperationType = movement.operation_type || 'UNLOAD';
      statusDetails = isQcPassed ? 'QC Passed (Vehicle Gate In)' : 'Vehicle Gate In';
    }
  } else if (movement.reference_type === 'SALES' && movement.reference_id) {
    // Check sales details
    const sRes = await db.query(`
      SELECT s.id, s.s_no as reference_id, COALESCE(c.print_name, c.name, s.customer) as party_name,
             si.item_name, si.qty, si.weight, si.lot_no
      FROM sales s
      LEFT JOIN customer_master c ON (CAST(c.id AS TEXT) = CAST(s.customer AS TEXT) OR c.name = s.customer OR c.print_name = s.customer)
      LEFT JOIN sales_items si ON CAST(si.sales_id AS TEXT) = CAST(s.id AS TEXT)
      WHERE s.s_no = ? OR CAST(s.id AS TEXT) = ?
    `, [String(movement.reference_id), String(movement.reference_id)]);

    if (sRes.rows.length > 0) {
      const row = sRes.rows[0];
      details.party_name = row.party_name || details.party_name;
      details.item_name = row.item_name || details.item_name;
      details.qty = row.qty || details.qty;
      details.weight = row.weight || details.weight;
      if (!details.lot_no) {
        details.lot_no = row.lot_no || '';
      }
    }

    const activeLotNo = details.lot_no || movement.lot_no;
    if (activeLotNo) {
      let salesRes = { rows: [] };
      try {
        salesRes = await db.query(`SELECT id FROM sales_items WHERE lot_no = ?`, [activeLotNo]);
      } catch (e) {}

      if (String(movement.status || '').toUpperCase() === 'LOADED') {
        computedStatus = 'LOADED';
        computedOperationType = 'LOAD';
        statusDetails = 'LOADED';
      } else if (String(movement.status || '').toUpperCase() === 'LOAD') {
        computedStatus = 'LOAD';
        computedOperationType = 'LOAD';
        statusDetails = 'Approved for Loading';
      } else if ((gross > 0 && tare > 0) || (movement.gate_out_time && String(movement.gate_out_time).trim() !== '') || String(movement.status || '').toUpperCase() === 'OUT') {
        computedStatus = 'OUT';
        computedOperationType = movement.operation_type || 'LOAD';
        statusDetails = 'Vehicle Exited';
      } else {
        computedStatus = movement.status || 'IN';
        computedOperationType = movement.operation_type || 'LOAD';
        statusDetails = 'Vehicle Gate In';
      }
    }
  } else {
    // General movement without reference
    const isExplicitReturn = (
      String(movement.status || '').toUpperCase() === 'RETURNED' || 
      String(movement.status || '').toUpperCase() === 'REJECTED' || 
      String(movement.status || '').toUpperCase() === 'RETURN' ||
      String(movement.operation_type || '').toUpperCase() === 'RETURN'
    );
    if (isExplicitReturn) {
      computedStatus = 'RETURNED';
      computedOperationType = 'RETURN';
      statusDetails = 'REJECTED & RETURNED';
    } else if ((gross > 0 && tare > 0) || (movement.gate_out_time && String(movement.gate_out_time).trim() !== '') || String(movement.status || '').toUpperCase() === 'OUT') {
      computedStatus = 'OUT';
      computedOperationType = movement.operation_type || 'UNLOAD';
      statusDetails = 'Vehicle Exited';
    } else {
      computedStatus = movement.status || 'IN';
      computedOperationType = movement.operation_type || 'UNLOAD';
      statusDetails = 'Vehicle Gate In';
    }
  }

  // Update DB if changes detected so it persists
  if (movement.id && (computedStatus !== movement.status || 
      computedOperationType !== movement.operation_type ||
      details.party_name !== movement.party_name || 
      details.item_name !== movement.item_name ||
      details.lot_no !== movement.lot_no ||
      details.qty !== movement.qty ||
      details.weight !== movement.weight)) {
    try {
      await db.run(`
        UPDATE vehicle_movements
        SET status = ?, operation_type = ?, party_name = ?, item_name = ?, qty = ?, weight = ?, lot_no = ?
        WHERE id = ?
      `, [computedStatus, computedOperationType, details.party_name, details.item_name, details.qty, details.weight, details.lot_no || movement.lot_no, movement.id]);
    } catch (e) {
      console.error('Error auto-updating vehicle_movements db row:', e);
    }
  }

  return {
    ...movement,
    status: computedStatus,
    operation_type: computedOperationType,
    operationType: computedOperationType,
    status_details: statusDetails,
    qc_status: qcStatus,
    party_name: details.party_name,
    item_name: details.item_name,
    qty: details.qty,
    weight: details.weight,
    lot_no: details.lot_no || movement.lot_no
  };
}

// GET /api/vehicle-movements/track-status - Auto-track status by lot_no or purchase invoice
router.get('/track-status', async (req, res) => {
  try {
    const { reference_type, reference_id, lot_no } = req.query;
    const mockMovement = {
      reference_type,
      reference_id,
      lot_no,
      status: 'IN',
      party_name: '',
      item_name: '',
      qty: 0,
      weight: 0,
      gross_weight: 0,
      tare_weight: 0,
      gate_out_time: ''
    };
    const tracked = await autoTrackMovementStatus(db, mockMovement);
    res.json({
      success: true,
      status: tracked.status,
      details: {
        party_name: tracked.party_name,
        item_name: tracked.item_name,
        qty: tracked.qty,
        weight: tracked.weight,
        lot_no: tracked.lot_no
      }
    });
  } catch (error) {
    console.error('Error in track-status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
})

// GET /api/vehicle-movements - List all with transporter join
router.get('/', async (req, res) => {
  try {
    try {
      await db.run("ALTER TABLE vehicle_movements ADD COLUMN transporter_name TEXT");
    } catch (e) {}

    const result = await db.query(`
      SELECT vm.*, 
             COALESCE(tm.name, '') as transporter_name
      FROM vehicle_movements vm 
      LEFT JOIN transport_master tm ON (CAST(tm.id AS TEXT) = CAST(vm.transporter_id AS TEXT) OR tm.name = CAST(vm.transporter_id AS TEXT))
      ORDER BY vm.created_at DESC
    `)
    
    // Auto-track and update status for all retrieved movements
    const trackedRows = []
    for (const row of result.rows) {
      const tracked = await autoTrackMovementStatus(db, row)
      trackedRows.push(tracked)
    }
    
    res.json(trackedRows)
  } catch (error) {
    console.error('GET vehicle-movements error:', error)
    res.status(500).json({ error: error.message })
  }
})

// GET /api/vehicle-movements/:id
router.get('/:id', async (req, res) => {
  try {
    try {
      await db.run("ALTER TABLE vehicle_movements ADD COLUMN transporter_name TEXT");
    } catch (e) {}

    const result = await db.query(`
      SELECT vm.*, 
             COALESCE(tm.name, '') as transporter_name
      FROM vehicle_movements vm 
      LEFT JOIN transport_master tm ON (CAST(tm.id AS TEXT) = CAST(vm.transporter_id AS TEXT) OR tm.name = CAST(vm.transporter_id AS TEXT))
      WHERE CAST(vm.id AS TEXT) = ?
    `, [String(req.params.id)])
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Vehicle movement not found' })
    }
    
    const tracked = await autoTrackMovementStatus(db, result.rows[0])
    res.json(tracked)
  } catch (error) {
    console.error('GET vehicle-movements/:id error:', error)
    res.status(500).json({ error: error.message })
  }
})

// POST /api/vehicle-movements - Create new
router.post('/', async (req, res) => {
  // Early check - ensure body exists
  const body = req.body || {}
  console.log('POST vehicle-movements body:', JSON.stringify(body))
  console.log('Request headers:', req.headers['content-type'])
  
  const vehicle_no = body?.vehicle_no || body?.vehicleNo

  // Validation - at minimum vehicle_no required
  if (!vehicle_no) {
    return res.status(400).json({ 
      error: 'Vehicle No is required' 
    })
  }

  try {
    console.log('Inserting with vehicle_no:', vehicle_no)
    
    // Use explicit values with fallbacks
    const refType = body?.reference_type || body?.referenceType || null
    const refId = body?.reference_id || body?.referenceId || null
    const movType = body?.movement_type || body?.movementType || null
    const opType = body?.operation_type || body?.operationType || null
    const driver = body?.driver_name || body?.driverName || null
    const transporter = body?.transporter_id || body?.transporterId || null
    const gateIn = body?.gate_in_time || body?.gateInTime || null
    const gateOut = body?.gate_out_time || body?.gateOutTime || null
    const grossWt = parseFloat(body?.gross_weight || body?.grossWeight || 0) || 0
    const tareWt = parseFloat(body?.tare_weight || body?.tareWeight || 0) || 0
    const netWt = parseFloat(body?.net_weight || body?.netWeight || 0) || 0
    const stat = body?.status || 'IN'
    const itemName = body?.item_name || body?.itemName || null
    const qty = parseFloat(body?.qty || 0) || 0
    const weight = parseFloat(body?.weight || 0) || 0
    const partyName = body?.party_name || body?.partyName || null
    const lotNo = body?.lot_no || body?.lotNo || null
    const analyzingTeam = body?.analyzing_team || body?.analyzingTeam || null
    const analyzingArea = body?.analyzing_area || body?.analyzingArea || null
    
    console.log('Parsed values:', { refType, refId, movType, opType, vehicle_no, driver, transporter, grossWt, tareWt, netWt, stat, itemName, qty, weight, partyName, lotNo, analyzingTeam, analyzingArea })
    
    const result = await db.run(`
      INSERT INTO vehicle_movements (
        reference_type, reference_id, movement_type, operation_type,
        vehicle_no, driver_name, transporter_id,
        gate_in_time, gate_out_time,
        gross_weight, tare_weight, net_weight, status,
        item_name, qty, weight, party_name,
        lot_no, analyzing_team, analyzing_area
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      refType, refId, movType, opType,
      vehicle_no, driver, transporter,
      gateIn, gateOut,
      grossWt, tareWt, netWt, stat,
      itemName, qty, weight, partyName,
      lotNo, analyzingTeam, analyzingArea
    ])

    console.log('Insert result:', result)

    res.status(201).json({ 
      success: true, 
      id: result.lastID,
      message: 'Vehicle movement created successfully'
    })
  } catch (error) {
    console.error('POST vehicle-movements error:', error)
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/vehicle-movements/:id - Update (status, weights, times)
router.put('/:id', async (req, res) => {
  const updates = req.body
  const allowedFields = [
    'reference_type', 'reference_id',
    'movement_type', 'operation_type', 'vehicle_no', 'driver_name', 
    'transporter_id', 'gate_in_time', 'gate_out_time', 
    'gross_weight', 'tare_weight', 'net_weight', 'status',
    'item_name', 'qty', 'weight', 'party_name',
    'lot_no', 'analyzing_team', 'analyzing_area'
  ]
  
  const setClause = Object.keys(updates)
    .filter(key => allowedFields.includes(key))
    .map(key => `${key} = ?`)
    .join(', ')
  
  if (setClause === '') {
    return res.status(400).json({ error: 'No valid fields to update' })
  }

  try {
    const values = Object.values(updates).filter((_, i) => allowedFields.includes(Object.keys(updates)[i]))
    values.push(req.params.id)
    
    const result = await db.run(`
      UPDATE vehicle_movements 
      SET ${setClause} 
      WHERE id = ?
    `, values)

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Vehicle movement not found' })
    }

    res.json({ success: true, message: 'Vehicle movement updated' })
  } catch (error) {
    console.error('PUT vehicle-movements/:id error:', error)
    res.status(500).json({ error: error.message })
  }
})

// DELETE /api/vehicle-movements/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.run('DELETE FROM vehicle_movements WHERE id = ?', [req.params.id])
    
    if (result.changes === 0) {
      return res.status(404).json({ message: 'Vehicle movement not found' })
    }
    
    res.json({ success: true, message: 'Vehicle movement deleted' })
  } catch (error) {
    console.error('DELETE vehicle-movements/:id error:', error)
    res.status(500).json({ error: error.message })
  }
})

module.exports = router

