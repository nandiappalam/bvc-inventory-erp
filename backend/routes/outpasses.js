const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { rebuildStockLedger } = require('../utils/stockRebuilder');

// Auto-generate sequential outpass number: OP-00001
async function generateNextOutpassNo(companyId = 1) {
  try {
    const res = await db.query(
      `SELECT outpass_no FROM outpasses ORDER BY id DESC LIMIT 1`,
      [],
      companyId
    );
    let lastNum = 0;
    if (res.rows && res.rows.length > 0) {
      const match = String(res.rows[0].outpass_no || '').match(/\d+/);
      if (match) lastNum = parseInt(match[0], 10);
    }
    return `OP-${String(lastNum + 1).padStart(5, '0')}`;
  } catch (err) {
    return 'OP-00001';
  }
}

// GET next outpass number
router.get('/next-no', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const nextNo = await generateNextOutpassNo(activeCompanyId);
    res.json({ success: true, outpass_no: nextNo });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET pending-return outpasses (for Inpass selection)
router.get('/pending-return', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const result = await db.query(`
      SELECT o.*,
             (o.total_weight - COALESCE(o.returned_weight, 0)) as pending_weight,
             (o.total_qty - COALESCE(o.returned_qty, 0)) as pending_qty
      FROM outpasses o
      WHERE o.status NOT IN ('CLOSED', 'CANCELLED')
      ORDER BY o.date DESC, o.id DESC
    `, [], activeCompanyId);

    const outpasses = result.rows || [];
    for (const op of outpasses) {
      const itemsRes = await db.query(`
        SELECT * FROM outpass_items WHERE outpass_id = ?
      `, [op.id], activeCompanyId);
      op.items = itemsRes.rows || [];
    }

    res.json({ success: true, data: outpasses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET summary statistics & reports
router.get('/report/summary', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const statsRes = await db.query(`
      SELECT 
        COUNT(*) as total_count,
        SUM(total_qty) as total_qty,
        SUM(total_weight) as total_weight,
        SUM(returned_qty) as total_returned_qty,
        SUM(returned_weight) as total_returned_weight,
        SUM(CASE WHEN status = 'OUTPASSED' OR status = 'AT_EXTERNAL_MILL' THEN 1 ELSE 0 END) as active_count,
        SUM(CASE WHEN purpose = 'Outside Processing' THEN 1 ELSE 0 END) as processing_count,
        SUM(CASE WHEN purpose = 'Job Work' THEN 1 ELSE 0 END) as jobwork_count,
        SUM(CASE WHEN purpose = 'Repair' OR purpose = 'Maintenance' THEN 1 ELSE 0 END) as repair_count,
        SUM(CASE WHEN status != 'CLOSED' AND status != 'CANCELLED' THEN (total_weight - COALESCE(returned_weight, 0)) ELSE 0 END) as total_pending_weight
      FROM outpasses
    `, [], activeCompanyId);

    res.json({ success: true, data: statsRes.rows?.[0] || {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET all outpasses
router.get('/', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const { status, purpose, reference_type, party_name, search, date_from, date_to } = req.query;

    let query = `SELECT * FROM outpasses WHERE 1=1`;
    const params = [];

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }
    if (purpose) {
      query += ` AND purpose = ?`;
      params.push(purpose);
    }
    if (reference_type) {
      query += ` AND reference_type = ?`;
      params.push(reference_type);
    }
    if (party_name) {
      query += ` AND LOWER(party_name) LIKE LOWER(?)`;
      params.push(`%${party_name}%`);
    }
    if (date_from) {
      query += ` AND date >= ?`;
      params.push(date_from);
    }
    if (date_to) {
      query += ` AND date <= ?`;
      params.push(date_to);
    }
    if (search) {
      query += ` AND (outpass_no LIKE ? OR party_name LIKE ? OR reference_no LIKE ? OR vehicle_no LIKE ? OR destination LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }

    query += ` ORDER BY date DESC, id DESC`;

    const result = await db.query(query, params, activeCompanyId);
    const outpasses = result.rows || [];

    // Attach items count and items, plus mill area if available
    for (const op of outpasses) {
      const itemsRes = await db.query(`SELECT * FROM outpass_items WHERE outpass_id = ?`, [op.id], activeCompanyId);
      op.items = itemsRes.rows || [];
      op.pending_weight = Math.max(0, (parseFloat(op.total_weight) || 0) - (parseFloat(op.returned_weight) || 0));
      op.pending_qty = Math.max(0, (parseFloat(op.total_qty) || 0) - (parseFloat(op.returned_qty) || 0));

      // Resolve mill details like area/city
      if (op.party_name) {
        try {
          const millRes = await db.query(
            `SELECT area, address1, address2, address3 FROM flour_mill_master WHERE flourmill = ? OR print_name = ? OR name = ? LIMIT 1`,
            [op.party_name, op.party_name, op.party_name],
            activeCompanyId
          );
          if (millRes.rows && millRes.rows.length > 0) {
            op.mill_area = millRes.rows[0].area || '';
            op.mill_address = [millRes.rows[0].address1, millRes.rows[0].address2, millRes.rows[0].area].filter(Boolean).join(', ');
          }
        } catch (e) {}
      }
    }

    res.json({ success: true, data: outpasses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single outpass by ID
router.get('/:id', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const { id } = req.params;

    const opRes = await db.query(`SELECT * FROM outpasses WHERE id = ? OR outpass_no = ?`, [id, id], activeCompanyId);
    if (!opRes.rows || opRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Outpass not found' });
    }

    const outpass = opRes.rows[0];
    const itemsRes = await db.query(`SELECT * FROM outpass_items WHERE outpass_id = ?`, [outpass.id], activeCompanyId);
    outpass.items = itemsRes.rows || [];

    // Fetch linked inpasses
    const inpassesRes = await db.query(`SELECT * FROM inpasses WHERE outpass_id = ? OR outpass_no = ?`, [outpass.id, outpass.outpass_no], activeCompanyId);
    outpass.inpasses = inpassesRes.rows || [];

    res.json({ success: true, data: outpass });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST create new outpass
router.post('/', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const { formData, items } = req.body;

    if (!formData) {
      return res.status(400).json({ success: false, message: 'Form data is required' });
    }

    let outpassNo = formData.outpass_no || formData.outpassNo;
    if (!outpassNo) {
      outpassNo = await generateNextOutpassNo(activeCompanyId);
    }

    const activeItems = (items || []).filter(it => (it.item_name || it.itemName));
    if (activeItems.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one item is required for Outpass' });
    }

    const totalQty = activeItems.reduce((sum, it) => sum + (parseFloat(it.qty) || 0), 0);
    const totalWeight = activeItems.reduce((sum, it) => {
      const wt = parseFloat(it.total_weight || it.totalWeight) || ((parseFloat(it.qty) || 0) * (parseFloat(it.weight) || 50));
      return sum + wt;
    }, 0);

    const processingRate = parseFloat(formData.processing_rate_kg || formData.processingRateKg) || 0;
    const estimatedCharges = Number((totalWeight * processingRate).toFixed(2));

    const insRes = await db.run(`
      INSERT INTO outpasses (
        outpass_no, date, purpose, item_type, reference_type, reference_id, reference_no,
        party_type, party_id, party_name, from_location, from_godown_id, from_godown_name,
        destination, vehicle_no, driver_name, driver_phone, transporter, expected_return_date,
        status, total_qty, total_weight, returned_qty, returned_weight,
        processing_rate_kg, estimated_charges, remarks, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)
    `, [
      outpassNo,
      formData.date || new Date().toISOString().slice(0, 10),
      formData.purpose || 'Outside Processing',
      formData.item_type || 'RM',
      formData.reference_type || 'Grind',
      formData.reference_id || null,
      formData.reference_no || '',
      formData.party_type || 'Flour Mill',
      formData.party_id || null,
      formData.party_name || formData.partyName || formData.flour_mill || '',
      formData.from_location || 'Inside Factory',
      formData.from_godown_id || null,
      formData.from_godown_name || formData.fromGodownName || 'PJ Main Factory Godown',
      formData.destination || formData.party_name || '',
      formData.vehicle_no || '',
      formData.driver_name || '',
      formData.driver_phone || '',
      formData.transporter || '',
      formData.expected_return_date || '',
      'OUTPASSED',
      totalQty,
      totalWeight,
      processingRate,
      estimatedCharges,
      formData.remarks || '',
      formData.created_by || 'Admin'
    ], activeCompanyId);

    const outpassId = insRes.lastID || insRes.lastInsertRowid;

    // Insert outpass items and update stock custody
    for (const it of activeItems) {
      const itemName = it.item_name || it.itemName;
      const lotNo = it.lot_no || it.lotNo || '';
      const qty = parseFloat(it.qty) || 0;
      const unitWt = parseFloat(it.weight) || (qty > 0 ? (parseFloat(it.total_weight) || 0) / qty : 50);
      const totWt = parseFloat(it.total_weight || it.totalWeight) || (qty * unitWt);
      const uom = it.uom || 'KG';
      const rate = parseFloat(it.rate) || 0;
      const amt = parseFloat(it.amount) || (qty * rate);
      const godownId = it.godown_id || it.godownId || formData.from_godown_id || 1;
      const godownName = it.godown_name || it.godownName || formData.from_godown_name || 'PJ';

      await db.run(`
        INSERT INTO outpass_items (
          outpass_id, outpass_no, item_id, item_name, lot_no, godown_id, godown_name,
          qty, weight, total_weight, uom, rate, amount, returned_qty, returned_weight,
          status, reason, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'OUTSIDE_PROCESSING', ?, ?)
      `, [
        outpassId,
        outpassNo,
        it.item_id || it.itemId || null,
        itemName,
        lotNo,
        godownId,
        godownName,
        qty,
        unitWt,
        totWt,
        uom,
        rate,
        amt,
        it.reason || formData.purpose || 'Outside Processing',
        it.remarks || ''
      ], activeCompanyId);

      // Stock Movement: Move from Available factory stock to Outside Processing
      // Deduct from factory stock ledger so it is not consumed, but not available in factory
      try {
        await db.run(`
          INSERT INTO stock (item_id, item_name, lot_no, qty, weight, rate, amount, date, type, reference_id, godown, godown_id, remarks)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Outpass Issue', ?, ?, ?, ?)
        `, [
          it.item_id || null,
          itemName,
          lotNo,
          -qty,
          -totWt,
          rate,
          -amt,
          formData.date || new Date().toISOString().slice(0, 10),
          outpassId,
          godownName,
          godownId,
          `Outpass #${outpassNo} to ${formData.party_name || 'Outside Mill'} (${formData.purpose || 'Outside Processing'})`
        ], activeCompanyId);

        // Update stock_lots: move from available to outside_processing_qty
        if (lotNo) {
          await db.run(`
            UPDATE stock_lots
            SET remaining_quantity = MAX(0, remaining_quantity - ?),
                outside_processing_qty = COALESCE(outside_processing_qty, 0) + ?,
                custody_status = 'OUTSIDE_PROCESSING'
            WHERE UPPER(TRIM(lot_no)) = UPPER(TRIM(?))
          `, [qty, qty, lotNo], activeCompanyId);
        }
      } catch (stkErr) {
        console.warn('Error adjusting stock for outpass:', stkErr.message);
      }
    }

    // Link with Grind / Grains if applicable
    if (formData.reference_type === 'Grind' && formData.reference_id) {
      try {
        await db.run(`
          UPDATE grains SET
            outpass_id = ?,
            outpass_no = ?,
            process_mode = 'OUTSIDE_MILL',
            mill_type = 'Outside Mill',
            external_mill_name = ?,
            status = 'Outpassed',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [outpassId, outpassNo, formData.party_name || 'External Mill', formData.reference_id], activeCompanyId);
      } catch (gErr) {
        console.warn('Error updating linked grind from outpass:', gErr.message);
      }
    }

    try {
      await rebuildStockLedger();
    } catch (e) {}

    res.status(201).json({
      success: true,
      message: `Outpass ${outpassNo} created successfully! Material dispatched for outside processing.`,
      data: { id: outpassId, outpass_no: outpassNo }
    });
  } catch (err) {
    console.error('Error creating outpass:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update outpass
router.put('/:id', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const { id } = req.params;
    const { formData } = req.body;

    if (!formData) {
      return res.status(400).json({ success: false, message: 'Form data required' });
    }

    await db.run(`
      UPDATE outpasses SET
        date = COALESCE(?, date),
        purpose = COALESCE(?, purpose),
        vehicle_no = COALESCE(?, vehicle_no),
        driver_name = COALESCE(?, driver_name),
        driver_phone = COALESCE(?, driver_phone),
        transporter = COALESCE(?, transporter),
        destination = COALESCE(?, destination),
        expected_return_date = COALESCE(?, expected_return_date),
        status = COALESCE(?, status),
        remarks = COALESCE(?, remarks),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      formData.date,
      formData.purpose,
      formData.vehicle_no,
      formData.driver_name,
      formData.driver_phone,
      formData.transporter,
      formData.destination,
      formData.expected_return_date,
      formData.status,
      formData.remarks,
      id
    ], activeCompanyId);

    res.json({ success: true, message: 'Outpass updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE cancel outpass (reverses stock)
router.delete('/:id', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const { id } = req.params;

    // Check if any inpass is already received against this outpass
    const checkInpass = await db.query(`SELECT id, inpass_no FROM inpasses WHERE outpass_id = ?`, [id], activeCompanyId);
    if (checkInpass.rows && checkInpass.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete Outpass because Inpass ${checkInpass.rows[0].inpass_no} has already been received against it.`
      });
    }

    // Fetch outpass items to restore stock
    const itemsRes = await db.query(`SELECT * FROM outpass_items WHERE outpass_id = ?`, [id], activeCompanyId);
    for (const it of (itemsRes.rows || [])) {
      if (it.lot_no) {
        await db.run(`
          UPDATE stock_lots
          SET remaining_quantity = remaining_quantity + ?,
              outside_processing_qty = MAX(0, COALESCE(outside_processing_qty, 0) - ?),
              custody_status = 'AVAILABLE'
          WHERE UPPER(TRIM(lot_no)) = UPPER(TRIM(?))
        `, [it.qty, it.qty, it.lot_no], activeCompanyId);
      }
    }

    // Delete stock movements
    await db.run(`DELETE FROM stock WHERE type = 'Outpass Issue' AND reference_id = ?`, [id], activeCompanyId);

    // Unlink grind if any
    await db.run(`
      UPDATE grains SET outpass_id = NULL, outpass_no = NULL, status = 'Draft'
      WHERE outpass_id = ?
    `, [id], activeCompanyId);

    await db.run(`DELETE FROM outpass_items WHERE outpass_id = ?`, [id], activeCompanyId);
    await db.run(`DELETE FROM outpasses WHERE id = ?`, [id], activeCompanyId);

    try {
      await rebuildStockLedger();
    } catch (e) {}

    res.json({ success: true, message: 'Outpass deleted and stock restored successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
