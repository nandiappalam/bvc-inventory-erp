const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { rebuildStockLedger } = require('../utils/stockRebuilder');
const { ensureMovementPassesSchema } = require('../utils/movementPassesSchema');
const { resolveFlourMillInfo, enrichRecordsWithMillNames, isNumericId } = require('../utils/millResolver');

// Ensure tables exist on request
router.use(async (req, res, next) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    await ensureMovementPassesSchema(activeCompanyId);
  } catch (_) {}
  next();
});

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

    await enrichRecordsWithMillNames(outpasses, activeCompanyId);

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

    // Attach items count and pending weights
    for (const op of outpasses) {
      const itemsRes = await db.query(`SELECT * FROM outpass_items WHERE outpass_id = ?`, [op.id], activeCompanyId);
      op.items = itemsRes.rows || [];
      op.pending_weight = Math.max(0, (parseFloat(op.total_weight) || 0) - (parseFloat(op.returned_weight) || 0));
      op.pending_qty = Math.max(0, (parseFloat(op.total_qty) || 0) - (parseFloat(op.returned_qty) || 0));
    }

    await enrichRecordsWithMillNames(outpasses, activeCompanyId);

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
    await enrichRecordsWithMillNames([outpass], activeCompanyId);

    // Fetch linked inpasses
    const inpassesRes = await db.query(`SELECT * FROM inpasses WHERE outpass_id = ? OR outpass_no = ?`, [outpass.id, outpass.outpass_no], activeCompanyId);
    outpass.inpasses = await enrichRecordsWithMillNames(inpassesRes.rows || [], activeCompanyId);

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

    let fromGodownId = Number(formData.from_godown_id);
    if (!Number.isSafeInteger(fromGodownId) || fromGodownId <= 0) {
      const firstItemGodownId = Number(activeItems[0]?.godown_id || activeItems[0]?.godownId);
      if (Number.isSafeInteger(firstItemGodownId) && firstItemGodownId > 0) {
        fromGodownId = firstItemGodownId;
      } else if (formData.from_godown_name) {
        const gByName = await db.query(
          `SELECT id FROM godown_master WHERE LOWER(TRIM(godown_name)) = LOWER(TRIM(?)) OR LOWER(TRIM(COALESCE(print_name, ''))) = LOWER(TRIM(?)) LIMIT 1`,
          [formData.from_godown_name, formData.from_godown_name],
          activeCompanyId
        );
        if (gByName.rows?.[0]?.id) {
          fromGodownId = Number(gByName.rows[0].id);
        }
      }
      if (!Number.isSafeInteger(fromGodownId) || fromGodownId <= 0) {
        const defaultGodown = await db.query(
          'SELECT id FROM godown_master ORDER BY id ASC LIMIT 1',
          [],
          activeCompanyId
        );
        if (defaultGodown.rows?.[0]?.id) {
          fromGodownId = Number(defaultGodown.rows[0].id);
        }
      }
    }
    if (!Number.isSafeInteger(fromGodownId) || fromGodownId <= 0) {
      return res.status(400).json({ success: false, message: 'A valid company Godown is required' });
    }
    const godownsById = new Map();
    for (const item of activeItems) {
      const itemGodownId = Number(item.godown_id || item.godownId || fromGodownId);
      if (!Number.isSafeInteger(itemGodownId) || itemGodownId <= 0) {
        return res.status(400).json({ success: false, message: 'Each Outpass item must use a valid company Godown' });
      }
      if (!godownsById.has(itemGodownId)) {
        const godownResult = await db.query(
          'SELECT id, godown_name FROM godown_master WHERE id = ?',
          [itemGodownId],
          activeCompanyId
        );
        if (!godownResult.rows || godownResult.rows.length === 0) {
          return res.status(400).json({ success: false, message: 'Selected Godown does not exist in this company' });
        }
        godownsById.set(itemGodownId, godownResult.rows[0]);
      }
    }
    if (!godownsById.has(fromGodownId)) {
      const godownResult = await db.query(
        'SELECT id, godown_name FROM godown_master WHERE id = ?',
        [fromGodownId],
        activeCompanyId
      );
      if (!godownResult.rows || godownResult.rows.length === 0) {
        return res.status(400).json({ success: false, message: 'Selected Godown does not exist in this company' });
      }
      godownsById.set(fromGodownId, godownResult.rows[0]);
    }

    const totalQty = activeItems.reduce((sum, it) => sum + (parseFloat(it.qty) || 0), 0);
    const totalWeight = activeItems.reduce((sum, it) => {
      const wt = parseFloat(it.total_weight || it.totalWeight) || ((parseFloat(it.qty) || 0) * (parseFloat(it.weight) || 50));
      return sum + wt;
    }, 0);

    const rawPartyRef = formData.party_name || formData.partyName || formData.flour_mill || '';
    const millInfo = await resolveFlourMillInfo(rawPartyRef, activeCompanyId, {
      partyId: formData.party_id,
      destination: formData.destination
    });
    const resolvedPartyId = formData.party_id || millInfo.id || null;
    const resolvedPartyName = (!isNumericId(millInfo.millName) && millInfo.millName)
      ? millInfo.millName
      : ((!isNumericId(rawPartyRef) && rawPartyRef) ? rawPartyRef : (millInfo.millName || rawPartyRef));
    const resolvedDestination = (!isNumericId(formData.destination) && formData.destination)
      ? formData.destination
      : (millInfo.areaName || millInfo.resolvedDestination || resolvedPartyName || '');
    const resolvedAreaName = millInfo.areaName || (!isNumericId(resolvedDestination) ? resolvedDestination : '') || '-';

    const processingRate = parseFloat(formData.processing_rate_kg || formData.processingRateKg) || 0;
    const estimatedCharges = Number((totalWeight * processingRate).toFixed(2));

    const txRes = await db.forCompany(activeCompanyId).withTransaction(async () => {
      // Validate available stock in stock_lots for lot-tracked items
      for (const it of activeItems) {
        const lotNo = String(it.lot_no || it.lotNo || '').trim();
        const qty = parseFloat(it.qty) || 0;
        if (lotNo && qty > 0) {
          const lotCheck = await db.query(
            `SELECT id, remaining_quantity FROM stock_lots WHERE UPPER(TRIM(lot_no)) = UPPER(TRIM(?)) LIMIT 1`,
            [lotNo],
            activeCompanyId
          );
          if (lotCheck.rows && lotCheck.rows.length > 0) {
            const avail = Number(lotCheck.rows[0].remaining_quantity || 0);
            if (qty > avail + 1e-6) {
              const err = new Error(`Insufficient stock in lot ${lotNo} (available: ${avail}, requested: ${qty})`);
              err.statusCode = 400;
              throw err;
            }
          }
        }
      }

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
        resolvedPartyId,
        resolvedPartyName,
        formData.from_location || 'Inside Factory',
        fromGodownId,
        godownsById.get(fromGodownId).godown_name,
        resolvedDestination,
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

      const createdOutpassId = insRes.lastID || insRes.lastInsertRowid;

      for (const it of activeItems) {
        const itemName = it.item_name || it.itemName;
        const lotNo = it.lot_no || it.lotNo || '';
        const qty = parseFloat(it.qty) || 0;
        const unitWt = parseFloat(it.weight) || (qty > 0 ? (parseFloat(it.total_weight) || 0) / qty : 50);
        const totWt = parseFloat(it.total_weight || it.totalWeight) || (qty * unitWt);
        const uom = it.uom || 'KG';
        const rate = parseFloat(it.rate) || 0;
        const amt = parseFloat(it.amount) || (qty * rate);
        const godownId = Number(it.godown_id || it.godownId || fromGodownId);
        const godownName = godownsById.get(godownId).godown_name;

        await db.run(`
          INSERT INTO outpass_items (
            outpass_id, outpass_no, item_id, item_name, lot_no, godown_id, godown_name,
            qty, weight, total_weight, uom, rate, amount, returned_qty, returned_weight,
            status, reason, remarks
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'OUTSIDE_PROCESSING', ?, ?)
        `, [
          createdOutpassId,
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
          createdOutpassId,
          godownName,
          godownId,
          `Outpass #${outpassNo} to ${resolvedPartyName || 'Outside Mill'} (${formData.purpose || 'Outside Processing'})`
        ], activeCompanyId);

        if (lotNo) {
          await db.run(`
            UPDATE stock_lots
            SET remaining_quantity = MAX(0, remaining_quantity - ?),
                outside_processing_qty = COALESCE(outside_processing_qty, 0) + ?,
                custody_status = 'OUTSIDE_PROCESSING'
            WHERE UPPER(TRIM(lot_no)) = UPPER(TRIM(?))
          `, [qty, qty, lotNo], activeCompanyId);
        }
      }

      if (formData.reference_type === 'Grind' && formData.reference_id) {
        try {
          await db.run(`
            UPDATE grains SET
              outpass_id = ?,
              outpass_no = ?,
              process_mode = 'OUTSIDE_MILL',
              mill_type = 'Outside Mill',
              external_mill_id = COALESCE(?, external_mill_id),
              external_mill_name = ?,
              status = 'Outpassed',
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [createdOutpassId, outpassNo, resolvedPartyId, resolvedPartyName || 'External Mill', formData.reference_id], activeCompanyId);
        } catch (gErr) {
          console.warn('Error updating linked grind from outpass:', gErr.message);
        }
      }

      return { outpassId: createdOutpassId };
    });

    const outpassId = txRes.outpassId;

    try {
      await rebuildStockLedger(activeCompanyId);
    } catch (e) {}

    // Create linked operational charges if provided in request
    if (Array.isArray(req.body.operational_charges) && req.body.operational_charges.length > 0) {
      const engine = require('../services/operationalChargeEngine');
      for (const ch of req.body.operational_charges) {
        try {
          await engine.createOperationalCharge(activeCompanyId, {
            ...ch,
            source_module: 'OUTPASS',
            source_transaction_type: 'OUTPASS',
            source_transaction_id: outpassId,
            source_transaction_no: outpassNo,
            charge_date: formData.date || new Date().toISOString().slice(0, 10),
            item_name: activeItems[0]?.item_name || 'Goods',
            lot_no: activeItems[0]?.lot_no || '',
            from_location: formData.from_godown_name || formData.from_location || 'Inside Factory',
            to_location: formData.destination || formData.party_name || 'External Mill',
            vehicle_no: ch.vehicle_no || formData.vehicle_no || '',
            driver_name: ch.driver_name || formData.driver_name || '',
            quantity: ch.quantity !== undefined ? ch.quantity : totalWeight
          });
        } catch (chErr) {
          console.warn('[Outpass Operational Charge Error]:', chErr.message);
        }
      }
    }

    // Trigger Central Notification & WhatsApp Alert
    try {
      const { triggerTransactionNotification } = require('../utils/transactionNotifier');
      const totalBags = items.reduce((s, it) => s + (parseFloat(it.qty) || 0), 0);
      const firstItem = items[0] || {};
      const refCode = formData.reference_no || (formData.reference_type === 'Grind' ? `GRIND-${formData.reference_id}` : '-');

      await triggerTransactionNotification({
        moduleName: 'OUTPASS',
        referenceNo: outpassNo,
        title: `🚚 OUTPASS CREATED – ${outpassNo}`,
        message: `Outpass: ${outpassNo} | Purpose: ${formData.purpose || 'Outside Processing'} | Item: ${firstItem.item_name || 'Goods'} | Lot: ${firstItem.lot_no || '-'} | Qty: ${totalWeight.toLocaleString()} KG (${totalBags} Bags) | Destination: ${resolvedPartyName || 'External Mill'} (${resolvedAreaName}) | Vehicle: ${formData.vehicle_no || 'N/A'} | Status: OUTPASSED`,
        severity: 'INFO',
        referenceId: outpassId,
        companyId: activeCompanyId,
        details: {
          outpass_no: outpassNo,
          date: formData.date,
          purpose: formData.purpose || 'Outside Grind',
          reference: refCode,
          item_name: firstItem.item_name || 'Material Item',
          lot_no: firstItem.lot_no || '-',
          quantity: `${totalWeight.toLocaleString()} KG`,
          bags: totalBags,
          party_id: resolvedPartyId,
          external_mill: resolvedPartyName || 'External Mill',
          area: resolvedAreaName || '-',
          vehicle: formData.vehicle_no || 'N/A',
          expected_return: formData.expected_return_date || '-',
          status: 'OUTPASSED',
          created_by: req.user?.username || 'Factory Operator'
        }
      });
    } catch (notifErr) {
      console.warn('Error triggering outpass notification:', notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: `Outpass ${outpassNo} created successfully! Material dispatched for outside processing.`,
      data: { id: outpassId, outpass_no: outpassNo }
    });
  } catch (err) {
    console.error('Error creating outpass:', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
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

    const existingRes = await db.query('SELECT * FROM outpasses WHERE id = ? LIMIT 1', [id], activeCompanyId);
    const existing = existingRes.rows?.[0];
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Outpass not found' });
    }

    const rawPartyRef = formData.party_name || formData.partyName || formData.flour_mill || existing.party_name;
    const millInfo = await resolveFlourMillInfo(rawPartyRef, activeCompanyId, {
      partyId: formData.party_id || existing.party_id,
      destination: formData.destination !== undefined ? formData.destination : existing.destination
    });
    const resolvedPartyName = (!isNumericId(millInfo.millName) && millInfo.millName) ? millInfo.millName : existing.party_name;
    const resolvedDest = (formData.destination && !isNumericId(formData.destination))
      ? formData.destination
      : (millInfo.areaName || (!isNumericId(existing.destination) ? existing.destination : '') || resolvedPartyName);

    await db.run(`
      UPDATE outpasses SET
        date = COALESCE(?, date),
        purpose = COALESCE(?, purpose),
        party_id = COALESCE(?, party_id),
        party_name = COALESCE(?, party_name),
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
      formData.date || null,
      formData.purpose || null,
      formData.party_id || millInfo.id || null,
      resolvedPartyName || null,
      formData.vehicle_no !== undefined ? formData.vehicle_no : null,
      formData.driver_name !== undefined ? formData.driver_name : null,
      formData.driver_phone !== undefined ? formData.driver_phone : null,
      formData.transporter !== undefined ? formData.transporter : null,
      resolvedDest || null,
      formData.expected_return_date !== undefined ? formData.expected_return_date : null,
      formData.status || null,
      formData.remarks !== undefined ? formData.remarks : null,
      id
    ], activeCompanyId);

    try {
      const { triggerTransactionNotification } = require('../utils/transactionNotifier');
      const updatedRes = await db.query('SELECT * FROM outpasses WHERE id = ? LIMIT 1', [id], activeCompanyId);
      const updatedOp = updatedRes.rows?.[0] || existing;
      await enrichRecordsWithMillNames([updatedOp], activeCompanyId);
      const itemsRes = await db.query('SELECT * FROM outpass_items WHERE outpass_id = ?', [id], activeCompanyId);
      const opItems = itemsRes.rows || [];
      const firstItem = opItems[0] || {};
      const totalWt = parseFloat(updatedOp.total_weight) || 0;
      const totalBags = parseFloat(updatedOp.total_qty) || 0;
      const resolvedArea = updatedOp.mill_area || updatedOp.destination || '-';

      await triggerTransactionNotification({
        eventType: 'OUTPASS_UPDATED',
        isUpdate: true,
        moduleName: 'OUTPASS',
        referenceNo: updatedOp.outpass_no,
        referenceId: updatedOp.id,
        companyId: activeCompanyId,
        title: `✏️ OUTPASS UPDATED – ${updatedOp.outpass_no}`,
        message: `Outpass ${updatedOp.outpass_no} updated | Mill: ${updatedOp.party_name || 'External Mill'} (${resolvedArea}) | Qty: ${totalWt.toLocaleString()} KG (${totalBags} Bags) | Vehicle: ${updatedOp.vehicle_no || 'N/A'} | Status: ${updatedOp.status}`,
        severity: 'INFO',
        details: {
          outpass_no: updatedOp.outpass_no,
          date: updatedOp.date,
          purpose: updatedOp.purpose || 'Outside Processing',
          reference: updatedOp.reference_no || '-',
          item_name: firstItem.item_name || 'Material Item',
          lot_no: firstItem.lot_no || '-',
          quantity: `${totalWt.toLocaleString()} KG`,
          bags: totalBags,
          party_id: updatedOp.party_id,
          external_mill: updatedOp.party_name || 'External Mill',
          area: resolvedArea,
          vehicle: updatedOp.vehicle_no || 'N/A',
          expected_return: updatedOp.expected_return_date || '-',
          status: updatedOp.status || 'OUTPASSED',
          updated_by: req.user?.username || 'Factory Operator'
        }
      });
    } catch (notifErr) {
      console.warn('Error triggering outpass update notification:', notifErr.message);
    }

    res.json({ success: true, message: 'Outpass updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE cancel outpass (reverses stock atomically)
router.delete('/:id', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const { id } = req.params;

    await db.forCompany(activeCompanyId).withTransaction(async () => {
      const checkInpass = await db.query(`SELECT id, inpass_no FROM inpasses WHERE outpass_id = ?`, [id], activeCompanyId);
      if (checkInpass.rows && checkInpass.rows.length > 0) {
        const err = new Error(`Cannot delete Outpass because Inpass ${checkInpass.rows[0].inpass_no} has already been received against it.`);
        err.statusCode = 400;
        throw err;
      }

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

      await db.run(`DELETE FROM stock WHERE type = 'Outpass Issue' AND reference_id = ?`, [id], activeCompanyId);

      await db.run(`
        UPDATE grains SET outpass_id = NULL, outpass_no = NULL, status = 'Draft'
        WHERE outpass_id = ?
      `, [id], activeCompanyId);

      await db.run(`DELETE FROM outpass_items WHERE outpass_id = ?`, [id], activeCompanyId);
      await db.run(`DELETE FROM outpasses WHERE id = ?`, [id], activeCompanyId);
    });

    try {
      await rebuildStockLedger(activeCompanyId);
    } catch (e) {}

    res.json({ success: true, message: 'Outpass deleted and stock restored successfully' });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

// GET operational charges for an outpass
router.get('/:id/charges', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const engine = require('../services/operationalChargeEngine');
    const result = await engine.getOperationalTraceability(activeCompanyId, {
      sourceModule: 'OUTPASS',
      sourceTransactionId: req.params.id
    });
    res.json({ success: true, charges: result.charges || [], traceability: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
