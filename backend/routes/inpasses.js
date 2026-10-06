const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { rebuildStockLedger } = require('../utils/stockRebuilder');

// Auto-generate sequential inpass number: IP-00001
async function generateNextInpassNo(companyId = 1) {
  try {
    const res = await db.query(
      `SELECT inpass_no FROM inpasses ORDER BY id DESC LIMIT 1`,
      [],
      companyId
    );
    let lastNum = 0;
    if (res.rows && res.rows.length > 0) {
      const match = String(res.rows[0].inpass_no || '').match(/\d+/);
      if (match) lastNum = parseInt(match[0], 10);
    }
    return `IP-${String(lastNum + 1).padStart(5, '0')}`;
  } catch (err) {
    return 'IP-00001';
  }
}

// Auto-generate sequential lot number if not provided
async function generateNextFgLotNo(prefix = 'LOT') {
  try {
    const res = await db.query(`
      SELECT MAX(CAST(REPLACE(lot_no, '${prefix}', '') AS INTEGER)) AS maxNum
      FROM stock_lots
      WHERE lot_no LIKE '${prefix}%'
    `);
    const num = parseInt(res.rows[0]?.maxNum, 10) || 0;
    return `${prefix}${String(num + 1).padStart(4, '0')}`;
  } catch (e) {
    return `${prefix}0001`;
  }
}

// GET next inpass number
router.get('/next-no', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const nextNo = await generateNextInpassNo(activeCompanyId);
    res.json({ success: true, inpass_no: nextNo });
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
        SUM(input_weight) as total_input_weight,
        SUM(output_weight) as total_output_weight,
        SUM(byproduct_weight) as total_byproduct_weight,
        SUM(loss_weight) as total_loss_weight,
        SUM(discrepancy_weight) as total_discrepancy_weight,
        AVG(CASE WHEN yield_percent > 0 THEN yield_percent ELSE NULL END) as avg_yield_percent,
        AVG(CASE WHEN loss_percent > 0 THEN loss_percent ELSE NULL END) as avg_loss_percent,
        SUM(total_processing_charges) as total_processing_charges
      FROM inpasses
    `, [], activeCompanyId);

    res.json({ success: true, data: statsRes.rows?.[0] || {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET all inpasses with optional filtering
router.get('/', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const { outpass_id, outpass_no, reference_type, party_name, search, date_from, date_to } = req.query;

    let query = `SELECT * FROM inpasses WHERE 1=1`;
    const params = [];

    if (outpass_id) {
      query += ` AND outpass_id = ?`;
      params.push(outpass_id);
    }
    if (outpass_no) {
      query += ` AND outpass_no = ?`;
      params.push(outpass_no);
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
      query += ` AND (inpass_no LIKE ? OR outpass_no LIKE ? OR party_name LIKE ? OR vehicle_no LIKE ? OR reference_no LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }

    query += ` ORDER BY date DESC, id DESC`;

    const result = await db.query(query, params, activeCompanyId);
    const inpasses = result.rows || [];

    for (const ip of inpasses) {
      const itemsRes = await db.query(`SELECT * FROM inpass_items WHERE inpass_id = ?`, [ip.id], activeCompanyId);
      ip.items = itemsRes.rows || [];

      // Resolve mill details
      if (ip.party_name) {
        try {
          const millRes = await db.query(
            `SELECT area, address1, address2, address3 FROM flour_mill_master WHERE flourmill = ? OR print_name = ? OR name = ? LIMIT 1`,
            [ip.party_name, ip.party_name, ip.party_name],
            activeCompanyId
          );
          if (millRes.rows && millRes.rows.length > 0) {
            ip.mill_area = millRes.rows[0].area || '';
            ip.mill_address = [millRes.rows[0].address1, millRes.rows[0].address2, millRes.rows[0].area].filter(Boolean).join(', ');
          }
        } catch (e) {}
      }
    }

    res.json({ success: true, data: inpasses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single inpass by ID
router.get('/:id', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const { id } = req.params;

    const ipRes = await db.query(`SELECT * FROM inpasses WHERE id = ? OR inpass_no = ?`, [id, id], activeCompanyId);
    if (!ipRes.rows || ipRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Inpass not found' });
    }

    const inpass = ipRes.rows[0];
    const itemsRes = await db.query(`SELECT * FROM inpass_items WHERE inpass_id = ?`, [inpass.id], activeCompanyId);
    inpass.items = itemsRes.rows || [];

    // Attach linked outpass
    if (inpass.outpass_id || inpass.outpass_no) {
      const opRes = await db.query(
        `SELECT * FROM outpasses WHERE id = ? OR outpass_no = ?`,
        [inpass.outpass_id, inpass.outpass_no],
        activeCompanyId
      );
      if (opRes.rows && opRes.rows.length > 0) {
        inpass.outpass = opRes.rows[0];
        const opItemsRes = await db.query(`SELECT * FROM outpass_items WHERE outpass_id = ?`, [inpass.outpass.id], activeCompanyId);
        inpass.outpass.items = opItemsRes.rows || [];
      }
    }

    res.json({ success: true, data: inpass });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST create new inpass
router.post('/', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const { formData, items } = req.body;

    if (!formData) {
      return res.status(400).json({ success: false, message: 'Form data is required' });
    }

    let inpassNo = formData.inpass_no || formData.inpassNo;
    if (!inpassNo) {
      inpassNo = await generateNextInpassNo(activeCompanyId);
    }

    const activeItems = (items || []).filter(it => (it.item_name || it.itemName));
    if (activeItems.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one item is required for Inpass' });
    }

    // Retrieve Outpass if linked
    let linkedOutpass = null;
    let outpassItems = [];
    if (formData.outpass_id || formData.outpass_no) {
      const opRes = await db.query(
        `SELECT * FROM outpasses WHERE id = ? OR outpass_no = ?`,
        [formData.outpass_id, formData.outpass_no],
        activeCompanyId
      );
      if (opRes.rows && opRes.rows.length > 0) {
        linkedOutpass = opRes.rows[0];
        const opiRes = await db.query(`SELECT * FROM outpass_items WHERE outpass_id = ?`, [linkedOutpass.id], activeCompanyId);
        outpassItems = opiRes.rows || [];
      }
    }

    // Mass-Balance Calculation
    const inputWeight = parseFloat(formData.input_weight || formData.inputWeight) ||
      (linkedOutpass ? parseFloat(linkedOutpass.total_weight) : 0);

    let outputWeight = 0;
    let byproductWeight = 0;
    let lossWeight = 0;
    let totalOutputQty = 0;

    for (const it of activeItems) {
      const outType = (it.output_type || it.outputType || 'PROCESSED_OUTPUT').toUpperCase();
      const wt = parseFloat(it.total_weight || it.totalWeight) ||
        ((parseFloat(it.qty) || 0) * (parseFloat(it.weight) || 50));
      const q = parseFloat(it.qty) || 0;

      if (outType === 'PROCESSED_OUTPUT' || outType === 'OUTPUT' || outType === 'FG') {
        outputWeight += wt;
        totalOutputQty += q;
      } else if (outType === 'BYPRODUCT' || outType === 'BY_PRODUCT') {
        byproductWeight += wt;
      } else {
        lossWeight += wt;
      }
    }

    // Any discrepancy between input weight and recorded weights
    const recordedTotalWeight = outputWeight + byproductWeight + lossWeight;
    let discrepancyWeight = parseFloat(formData.discrepancy_weight || formData.discrepancyWeight);
    if (isNaN(discrepancyWeight)) {
      discrepancyWeight = Math.max(0, inputWeight - recordedTotalWeight);
    }

    const yieldPercent = inputWeight > 0 ? Number(((outputWeight / inputWeight) * 100).toFixed(2)) : 0;
    const lossPercent = inputWeight > 0 ? Number((((lossWeight + discrepancyWeight) / inputWeight) * 100).toFixed(2)) : 0;

    const chargeRate = parseFloat(formData.processing_charge_per_kg || formData.processingChargePerKg) ||
      (linkedOutpass ? parseFloat(linkedOutpass.processing_rate_kg) : 0);
    const totalProcessingCharges = Number((outputWeight * chargeRate).toFixed(2));

    const insRes = await db.run(`
      INSERT INTO inpasses (
        inpass_no, date, outpass_id, outpass_no, reference_type, reference_id, reference_no,
        party_id, party_name, vehicle_no, driver_name, received_by, to_godown_id, to_godown_name,
        qc_required, qc_status, input_weight, output_weight, byproduct_weight, loss_weight,
        discrepancy_weight, discrepancy_reason, yield_percent, loss_percent,
        processing_charge_per_kg, total_processing_charges, status, remarks, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      inpassNo,
      formData.date || new Date().toISOString().slice(0, 10),
      linkedOutpass ? linkedOutpass.id : (formData.outpass_id || null),
      linkedOutpass ? linkedOutpass.outpass_no : (formData.outpass_no || ''),
      formData.reference_type || (linkedOutpass ? linkedOutpass.reference_type : 'Grind'),
      formData.reference_id || (linkedOutpass ? linkedOutpass.reference_id : null),
      formData.reference_no || (linkedOutpass ? linkedOutpass.reference_no : ''),
      formData.party_id || (linkedOutpass ? linkedOutpass.party_id : null),
      formData.party_name || formData.partyName || (linkedOutpass ? linkedOutpass.party_name : ''),
      formData.vehicle_no || '',
      formData.driver_name || '',
      formData.received_by || 'Admin',
      formData.to_godown_id || null,
      formData.to_godown_name || formData.toGodownName || 'PJ Main Factory Godown',
      formData.qc_required !== undefined ? (formData.qc_required ? 1 : 0) : 1,
      formData.qc_status || 'QC_PENDING',
      inputWeight,
      outputWeight,
      byproductWeight,
      lossWeight,
      discrepancyWeight,
      formData.discrepancy_reason || formData.discrepancyReason || '',
      yieldPercent,
      lossPercent,
      chargeRate,
      totalProcessingCharges,
      'RECEIVED',
      formData.remarks || '',
      formData.created_by || 'Admin'
    ], activeCompanyId);

    const inpassId = insRes.lastID || insRes.lastInsertRowid;

    // Process each Inpass Item
    for (const it of activeItems) {
      const itemName = it.item_name || it.itemName;
      let lotNo = it.lot_no || it.lotNo || '';
      const outType = (it.output_type || it.outputType || 'PROCESSED_OUTPUT').toUpperCase();
      const qty = parseFloat(it.qty) || 0;
      const unitWt = parseFloat(it.weight) || (qty > 0 ? (parseFloat(it.total_weight) || 0) / qty : 50);
      const totWt = parseFloat(it.total_weight || it.totalWeight) || (qty * unitWt);
      const uom = it.uom || 'KG';
      const rate = parseFloat(it.rate) || 0;
      const amt = parseFloat(it.amount) || (qty * rate);
      const godownId = it.godown_id || it.godownId || formData.to_godown_id || 1;
      const godownName = it.godown_name || it.godownName || formData.to_godown_name || 'PJ';
      const originalItemName = it.original_item_name || (outpassItems[0]?.item_name || '');
      const originalLotNo = it.original_lot_no || (outpassItems[0]?.lot_no || '');

      if (!lotNo && (outType === 'PROCESSED_OUTPUT' || outType === 'BYPRODUCT')) {
        lotNo = await generateNextFgLotNo(outType === 'BYPRODUCT' ? 'WST' : 'LOT');
      }

      await db.run(`
        INSERT INTO inpass_items (
          inpass_id, inpass_no, outpass_item_id, original_item_name, original_lot_no,
          item_id, item_name, lot_no, output_type, qty, weight, total_weight,
          uom, rate, amount, qc_status, godown_id, godown_name, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        inpassId,
        inpassNo,
        it.outpass_item_id || null,
        originalItemName,
        originalLotNo,
        it.item_id || null,
        itemName,
        lotNo,
        outType,
        qty,
        unitWt,
        totWt,
        uom,
        rate,
        amt,
        it.qc_status || 'PASS',
        godownId,
        godownName,
        it.remarks || ''
      ], activeCompanyId);

      // Add to Factory Stock if Processed Output or Byproduct
      if (outType === 'PROCESSED_OUTPUT' || outType === 'BYPRODUCT') {
        try {
          await db.run(`
            INSERT INTO stock (item_id, item_name, lot_no, qty, weight, rate, amount, date, type, reference_id, godown, godown_id, remarks)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Inpass Receipt', ?, ?, ?, ?)
          `, [
            it.item_id || null,
            itemName,
            lotNo,
            qty,
            totWt,
            rate,
            amt,
            formData.date || new Date().toISOString().slice(0, 10),
            inpassId,
            godownName,
            godownId,
            `Inpass #${inpassNo} from ${formData.party_name || 'Outside Mill'} (Yield: ${yieldPercent}%)`
          ], activeCompanyId);

          // Insert or update stock_lots
          const existingLot = await db.query(
            `SELECT id, remaining_quantity FROM stock_lots WHERE item_name = ? AND lot_no = ?`,
            [itemName, lotNo],
            activeCompanyId
          );
          if (existingLot.rows && existingLot.rows.length > 0) {
            await db.run(`
              UPDATE stock_lots
              SET remaining_quantity = remaining_quantity + ?,
                  custody_status = 'AVAILABLE',
                  qc_status = 'ACCEPTED'
              WHERE id = ?
            `, [qty, existingLot.rows[0].id], activeCompanyId);
          } else {
            await db.run(`
              INSERT INTO stock_lots (
                item_id, item_name, lot_no, purchase_id, quantity, remaining_quantity,
                rate, qc_status, usable_for_production, approval_status, unloading_status,
                custody_status, godown_name
              ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACCEPTED', 1, 'APPROVED', 'UNLOADED', 'AVAILABLE', ?)
            `, [
              it.item_id || null,
              itemName,
              lotNo,
              inpassId,
              qty,
              qty,
              rate,
              godownName
            ], activeCompanyId);
          }
        } catch (stkErr) {
          console.warn('Error adding inpass output to stock:', stkErr.message);
        }
      }
    }

    // Update Outpass Status & Clear Outside Processing stock from original RM lot
    if (linkedOutpass) {
      const newReturnedWeight = (parseFloat(linkedOutpass.returned_weight) || 0) + recordedTotalWeight;
      const newReturnedQty = (parseFloat(linkedOutpass.returned_qty) || 0) + totalOutputQty;
      const isFullyClosed = newReturnedWeight >= (parseFloat(linkedOutpass.total_weight) || 0) - 1.0; // 1kg tolerance

      await db.run(`
        UPDATE outpasses SET
          returned_weight = ?,
          returned_qty = ?,
          status = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        newReturnedWeight,
        newReturnedQty,
        isFullyClosed ? 'CLOSED' : 'PARTIAL_RECEIVED',
        linkedOutpass.id
      ], activeCompanyId);

      // Deduct outside_processing_qty on original outpassed lots
      for (const opi of outpassItems) {
        if (opi.lot_no) {
          try {
            await db.run(`
              UPDATE stock_lots
              SET outside_processing_qty = MAX(0, COALESCE(outside_processing_qty, 0) - ?),
                  custody_status = CASE 
                    WHEN COALESCE(outside_processing_qty, 0) - ? <= 0 AND COALESCE(remaining_quantity, 0) <= 0 THEN 'CONSUMED'
                    ELSE custody_status 
                  END
              WHERE UPPER(TRIM(lot_no)) = UPPER(TRIM(?))
            `, [opi.qty, opi.qty, opi.lot_no], activeCompanyId);
          } catch (lotErr) {
            console.warn('Error updating original lot custody for inpass:', lotErr.message);
          }
        }
      }
    }

    // Update Linked Grind if reference_type === 'Grind'
    const grindRefId = formData.reference_id || (linkedOutpass ? linkedOutpass.reference_id : null);
    if (grindRefId && (formData.reference_type === 'Grind' || (linkedOutpass && linkedOutpass.reference_type === 'Grind'))) {
      try {
        await db.run(`
          UPDATE grains SET
            inpass_id = ?,
            inpass_no = ?,
            status = 'Completed',
            processing_charge_per_kg = ?,
            total_processing_charges = ?,
            discrepancy_kg = ?,
            discrepancy_reason = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [
          inpassId,
          inpassNo,
          chargeRate,
          totalProcessingCharges,
          discrepancyWeight,
          formData.discrepancy_reason || '',
          grindRefId
        ], activeCompanyId);

        // If grain_output_items is empty for this grind, populate with inpass processed outputs
        const checkOut = await db.query(`SELECT id FROM grain_output_items WHERE grain_id = ?`, [grindRefId], activeCompanyId);
        if (!checkOut.rows || checkOut.rows.length === 0) {
          for (const it of activeItems) {
            const outType = (it.output_type || it.outputType || 'PROCESSED_OUTPUT').toUpperCase();
            if (outType === 'PROCESSED_OUTPUT' || outType === 'OUTPUT' || outType === 'FG') {
              await db.run(`
                INSERT INTO grain_output_items (grain_id, item_name, lot_no, weight, qty, total_wt)
                VALUES (?, ?, ?, ?, ?, ?)
              `, [
                grindRefId,
                it.item_name || it.itemName,
                it.lot_no || it.lotNo || inpassNo,
                parseFloat(it.weight) || 50,
                parseFloat(it.qty) || 0,
                parseFloat(it.total_weight || it.totalWeight) || 0
              ], activeCompanyId);
            } else if (outType === 'BYPRODUCT' || outType === 'PROCESS_LOSS') {
              await db.run(`
                INSERT INTO grain_wastage_items (grain_id, item_name, lot_no, weight, qty, total_wt, category)
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `, [
                grindRefId,
                it.item_name || it.itemName,
                it.lot_no || it.lotNo || 'WST-OUT',
                parseFloat(it.weight) || 1,
                parseFloat(it.qty) || 0,
                parseFloat(it.total_weight || it.totalWeight) || 0,
                outType === 'BYPRODUCT' ? 'By-product (External Mill)' : 'Process Loss'
              ], activeCompanyId);
            }
          }
        }
      } catch (gErr) {
        console.warn('Error updating linked grind from inpass:', gErr.message);
      }
    }

    try {
      await rebuildStockLedger();
    } catch (e) {}

    res.status(201).json({
      success: true,
      message: `Inpass ${inpassNo} recorded successfully! Processed material received into factory stock.`,
      data: {
        id: inpassId,
        inpass_no: inpassNo,
        yield_percent: yieldPercent,
        loss_percent: lossPercent,
        discrepancy_weight: discrepancyWeight,
        total_processing_charges: totalProcessingCharges
      }
    });
  } catch (err) {
    console.error('Error creating inpass:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update inpass details
router.put('/:id', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const { id } = req.params;
    const { formData } = req.body;

    if (!formData) {
      return res.status(400).json({ success: false, message: 'Form data is required' });
    }

    await db.run(`
      UPDATE inpasses SET
        date = COALESCE(?, date),
        vehicle_no = COALESCE(?, vehicle_no),
        driver_name = COALESCE(?, driver_name),
        received_by = COALESCE(?, received_by),
        qc_status = COALESCE(?, qc_status),
        discrepancy_reason = COALESCE(?, discrepancy_reason),
        remarks = COALESCE(?, remarks),
        status = COALESCE(?, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      formData.date,
      formData.vehicle_no,
      formData.driver_name,
      formData.received_by,
      formData.qc_status,
      formData.discrepancy_reason,
      formData.remarks,
      formData.status,
      id
    ], activeCompanyId);

    res.json({ success: true, message: 'Inpass updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE cancel inpass (reverses stock and restores outpass)
router.delete('/:id', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const { id } = req.params;

    const ipRes = await db.query(`SELECT * FROM inpasses WHERE id = ?`, [id], activeCompanyId);
    if (!ipRes.rows || ipRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Inpass not found' });
    }
    const inpass = ipRes.rows[0];

    // Fetch inpass items to reverse stock
    const itemsRes = await db.query(`SELECT * FROM inpass_items WHERE inpass_id = ?`, [id], activeCompanyId);
    for (const it of (itemsRes.rows || [])) {
      if (it.lot_no) {
        await db.run(`
          UPDATE stock_lots
          SET remaining_quantity = MAX(0, remaining_quantity - ?)
          WHERE item_name = ? AND lot_no = ?
        `, [it.qty, it.item_name, it.lot_no], activeCompanyId);
      }
    }

    // Delete stock records
    await db.run(`DELETE FROM stock WHERE type = 'Inpass Receipt' AND reference_id = ?`, [id], activeCompanyId);

    // Revert Outpass returned quantities
    if (inpass.outpass_id) {
      const recordedTotal = (parseFloat(inpass.output_weight) || 0) + (parseFloat(inpass.byproduct_weight) || 0) + (parseFloat(inpass.loss_weight) || 0);
      await db.run(`
        UPDATE outpasses SET
          returned_weight = MAX(0, returned_weight - ?),
          returned_qty = MAX(0, returned_qty - ?),
          status = 'OUTPASSED'
        WHERE id = ?
      `, [recordedTotal, inpass.output_weight > 0 ? 1 : 0, inpass.outpass_id], activeCompanyId);

      // Restore outside_processing_qty on outpass items
      const opItems = await db.query(`SELECT * FROM outpass_items WHERE outpass_id = ?`, [inpass.outpass_id], activeCompanyId);
      for (const opi of (opItems.rows || [])) {
        if (opi.lot_no) {
          await db.run(`
            UPDATE stock_lots
            SET outside_processing_qty = outside_processing_qty + ?,
                custody_status = 'OUTSIDE_PROCESSING'
            WHERE UPPER(TRIM(lot_no)) = UPPER(TRIM(?))
          `, [opi.qty, opi.lot_no], activeCompanyId);
        }
      }
    }

    // Revert Grind if linked
    if (inpass.reference_id && inpass.reference_type === 'Grind') {
      await db.run(`
        UPDATE grains SET inpass_id = NULL, inpass_no = NULL, status = 'Outpassed'
        WHERE id = ?
      `, [inpass.reference_id], activeCompanyId);
    }

    await db.run(`DELETE FROM inpass_items WHERE inpass_id = ?`, [id], activeCompanyId);
    await db.run(`DELETE FROM inpasses WHERE id = ?`, [id], activeCompanyId);

    try {
      await rebuildStockLedger();
    } catch (e) {}

    res.json({ success: true, message: 'Inpass cancelled and stock reversed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
