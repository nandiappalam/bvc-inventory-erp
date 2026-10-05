const express = require('express')
const router = express.Router()
const db = require('../config/database')
const { deductFlourOutStock, revertFlourOutStock } = require('../utils/stockSync')

// GET next sequential S.No for flour out
router.get('/next-sno', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        MAX(CAST(s_no AS INTEGER)) as max_sno,
        MAX(id) as max_id,
        COUNT(*) as total_count 
      FROM flour_out
    `);
    const maxVal = Math.max(
      parseInt(result.rows[0]?.max_sno, 10) || 0,
      parseInt(result.rows[0]?.max_id, 10) || 0,
      parseInt(result.rows[0]?.total_count, 10) || 0
    );
    const nextSno = maxVal + 1;
    res.json({ 
      success: true, 
      sNo: nextSno, 
      next_sno: nextSno, 
      next_s_no: String(nextSno), 
      s_no: nextSno, 
      data: { s_no: nextSno } 
    });
  } catch (error) {
    console.error('Error getting next s_no for flour-out:', error);
    res.status(500).json({ success: false, message: 'Error getting next s_no', error: error.message });
  }
});

// GET all flour out records (returns flat rows for Display pages)
router.get(['/', '/list'], async (req, res) => {
  try {
    // Dynamic sequence auto-repair if any s_no is null or empty
    try {
      const nullSnoCheck = await db.query('SELECT id FROM flour_out WHERE s_no IS NULL OR s_no = "" ORDER BY created_at ASC');
      if (nullSnoCheck.rows.length > 0) {
        const maxSnoRes = await db.query('SELECT COALESCE(MAX(CAST(s_no AS INTEGER)), 0) as maxSno FROM flour_out WHERE s_no IS NOT NULL AND s_no != ""');
        let currentMax = maxSnoRes.rows[0]?.maxSno || 0;
        for (const row of nullSnoCheck.rows) {
          currentMax++;
          await db.run('UPDATE flour_out SET s_no = ? WHERE id = ?', [String(currentMax), row.id]);
        }
      }
    } catch (migErr) {
      console.error('Error auto-repairing flour_out s_no:', migErr);
    }

    // Get all flour_out records with their items joined
    const result = await db.query(`
      SELECT 
        fo.id,
        fo.s_no as s_no,
        fo.s_no as sNo,
        fo.s_no as sno,
        fo.date,
        COALESCE(pcm.name, fo.papad_company) as papad_company,
        COALESCE(pcm.name, fo.papad_company) as papadCompany,
        fo.remarks,
        fo.total_qty as total_qty,
        fo.total_qty as totalQty,
        fo.total_weight as total_weight,
        fo.total_weight as totalWeight,
        fo.total_wages as total_wages,
        fo.total_wages as totalWages,
        fo.created_at as created_at,
        fo.created_at as createdAt,
        fo.updated_at as updated_at,
        fo.updated_at as updatedAt,
        foi.id as itemId,
        foi.id as item_id,
        foi.item_name as item_name,
        foi.item_name as itemName,
        foi.lot_no as lot_no,
        foi.lot_no as lotNo,
        foi.weight,
        foi.qty,
        foi.total_wt as total_wt,
        foi.total_wt as totalWt,
        foi.papad_kg as papad_kg,
        foi.papad_kg as papadKg,
        foi.wages_bag as wages_bag,
        foi.wages_bag as wagesBag,
        foi.wages
      FROM flour_out fo
      LEFT JOIN papad_company_master pcm ON (CAST(pcm.id AS TEXT) = CAST(fo.papad_company AS TEXT) OR pcm.name = fo.papad_company)
      LEFT JOIN flour_out_items foi ON fo.id = foi.flour_out_id
      ORDER BY fo.id DESC, foi.id ASC
    `);

    // Map rows ensuring no null values break UI rendering
    const flatRows = (result.rows || []).map(row => ({
      id: row.id,
      sNo: row.sNo || row.s_no || '',
      s_no: row.s_no || row.sNo || '',
      sno: row.sno || row.sNo || '',
      date: row.date ? row.date.substring(0, 10) : '',
      papadCompany: row.papadCompany || row.papad_company || '',
      papad_company: row.papad_company || row.papadCompany || '',
      remarks: row.remarks || '',
      totalQty: parseFloat(row.totalQty || row.total_qty || 0) || 0,
      total_qty: parseFloat(row.total_qty || row.totalQty || 0) || 0,
      totalWeight: parseFloat(row.totalWeight || row.total_weight || 0) || 0,
      total_weight: parseFloat(row.total_weight || row.totalWeight || 0) || 0,
      totalWages: parseFloat(row.totalWages || row.total_wages || 0) || 0,
      total_wages: parseFloat(row.total_wages || row.totalWages || 0) || 0,
      createdAt: row.createdAt || row.created_at,
      created_at: row.created_at || row.createdAt,
      updatedAt: row.updatedAt || row.updated_at,
      updated_at: row.updated_at || row.updatedAt,
      itemId: row.itemId || row.item_id,
      item_id: row.item_id || row.itemId,
      itemName: row.itemName || row.item_name || '',
      item_name: row.item_name || row.itemName || '',
      lotNo: row.lotNo || row.lot_no || '',
      lot_no: row.lot_no || row.lotNo || '',
      weight: parseFloat(row.weight || 0) || 0,
      qty: parseFloat(row.qty || 0) || 0,
      totalWt: parseFloat(row.totalWt || row.total_wt || 0) || 0,
      total_wt: parseFloat(row.total_wt || row.totalWt || 0) || 0,
      papadKg: parseFloat(row.papadKg || row.papad_kg || 0) || 0,
      papad_kg: parseFloat(row.papad_kg || row.papadKg || 0) || 0,
      wagesBag: parseFloat(row.wagesBag || row.wages_bag || 0) || 0,
      wages_bag: parseFloat(row.wages_bag || row.wagesBag || 0) || 0,
      wages: parseFloat(row.wages || 0) || 0
    }));

    res.json(flatRows);
  } catch (error) {
    console.error('Error fetching flour out list:', error);
    res.status(500).json({ message: 'Error fetching flour out list', error: error.message });
  }
});

// GET flour out by ID (for Update / Edit Page)
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || id === 'undefined' || id === 'null' || isNaN(Number(id))) {
      return res.status(404).json({ message: 'Flour out record not found' });
    }

    const flourOutResult = await db.query('SELECT * FROM flour_out WHERE id = ?', [id]);
    if (flourOutResult.rows.length === 0) {
      return res.status(404).json({ message: 'Flour out record not found' });
    }

    const itemsResult = await db.query('SELECT * FROM flour_out_items WHERE flour_out_id = ? ORDER BY id ASC', [id]);
    
    const raw = flourOutResult.rows[0];
    const flourOut = {
      ...raw,
      sNo: raw.s_no || '',
      s_no: raw.s_no || '',
      papadCompany: raw.papad_company || '',
      papad_company: raw.papad_company || '',
      items: (itemsResult.rows || []).map(item => ({
        ...item,
        itemName: item.item_name || '',
        item_name: item.item_name || '',
        lotNo: item.lot_no || '',
        lot_no: item.lot_no || '',
        totalWt: item.total_wt || 0,
        total_wt: item.total_wt || 0,
        papadKg: item.papad_kg || 0,
        papad_kg: item.papad_kg || 0,
        wagesBag: item.wages_bag || 0,
        wages_bag: item.wages_bag || 0
      }))
    };

    res.json(flourOut);
  } catch (error) {
    console.error('Error fetching flour out record:', error);
    res.status(500).json({ message: 'Error fetching flour out record', error: error.message });
  }
});

// POST create new flour out
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const formData = body.formData || body;
    const items = body.items || [];
    const activeItems = (items || []).filter(item => item.item_name || item.itemName);
    const rawComp = formData.papad_company || formData.papadCompany || formData.company || '';

    // Validation
    if (!formData.date || !rawComp || activeItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Date, papad company, and at least one item are required' });
    }

    // Calculate totals
    const totalQty = activeItems.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
    const totalWeight = activeItems.reduce((sum, item) => sum + (parseFloat(item.total_wt || item.totalWt) || 0), 0);
    const totalWages = activeItems.reduce((sum, item) => sum + (parseFloat(item.wages) || 0), 0);

    // Ensure papad_company exists in master
    let companyName = rawComp;
    const isId = /^\d+$/.test(String(rawComp));
    const existingCompany = isId
      ? await db.query('SELECT id, name FROM papad_company_master WHERE id = ?', [rawComp])
      : await db.query('SELECT id, name FROM papad_company_master WHERE name = ?', [rawComp]);

    if (existingCompany.rows.length > 0) {
      companyName = existingCompany.rows[0].name;
    } else if (!isId && rawComp.trim()) {
      await db.run('INSERT INTO papad_company_master (name, status) VALUES (?, ?)', [rawComp.trim(), 'Active']);
    }

    // Auto-generate S.No if not provided
    let sNoVal = formData.sNo || formData.s_no || formData.sno || '';
    if (!sNoVal || sNoVal === '1') {
      const maxSnoRes = await db.query('SELECT COALESCE(MAX(CAST(s_no AS INTEGER)), 0) as maxSno FROM flour_out');
      const nextNum = (maxSnoRes.rows[0]?.maxSno || 0) + 1;
      if (!sNoVal) sNoVal = String(nextNum);
    }

    // Insert flour out record
    const flourOutResult = await db.run(`
      INSERT INTO flour_out (s_no, date, papad_company, address, remarks, total_qty, total_weight, total_wages)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [sNoVal, formData.date, companyName, formData.address || '', formData.remarks || '', totalQty, totalWeight, totalWages]);

    const flourOutId = flourOutResult.lastID;

    try {
      // Insert items
      for (const item of activeItems) {
        const item_name = item.item_name || item.itemName;
        const lot_no = item.lot_no || item.lotNo || '';
        const weight = parseFloat(item.weight) || 0;
        const qty = parseFloat(item.qty) || 0;
        const total_wt = parseFloat(item.total_wt || item.totalWt) || (weight * qty);
        const papad_kg = parseFloat(item.papad_kg || item.papadKg) || 0;
        const wages_bag = parseFloat(item.wages_bag || item.wagesBag) || 0;
        const wages = parseFloat(item.wages) || (papad_kg * wages_bag);

        // Ensure item exists in item_master under Flour item_group
        const existingItem = await db.query('SELECT id, item_group FROM item_master WHERE item_name = ?', [item_name]);
        if (existingItem.rows.length === 0) {
          await db.run('INSERT INTO item_master (item_name, status, item_group) VALUES (?, ?, ?)', [item_name, 'Active', 'Flour']);
        } else if (!existingItem.rows[0].item_group) {
          await db.run('UPDATE item_master SET item_group = ? WHERE id = ?', ['Flour', existingItem.rows[0].id]);
        }

        await db.run(`
          INSERT INTO flour_out_items (flour_out_id, item_name, lot_no, weight, qty, total_wt, papad_kg, wages_bag, wages)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [flourOutId, item_name, lot_no, weight, qty, total_wt, papad_kg, wages_bag, wages]);
      }

      // Deduct stock
      await deductFlourOutStock(flourOutId, formData.date, activeItems);

      // Track vehicle movement if vehicle/lorry is provided
      if (formData.vehicle_no || formData.lorry_no) {
        try {
          const vNo = formData.vehicle_no || formData.lorry_no;
          await db.run(`
            INSERT INTO vehicle_movements (
              reference_type, reference_id, movement_type, operation_type, vehicle_no, driver_name,
              gate_in_time, gate_out_time, status, item_name, qty, weight, party_name, lot_no, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'OUT', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `, [
            'FLOUR_OUT',
            formData.s_no || flourOutId,
            'OUTWARD',
            'Flour Out Dispatched',
            vNo,
            formData.driver || '',
            activeItems[0]?.item_name || 'Flour',
            parseFloat(formData.total_qty) || 0,
            parseFloat(formData.total_weight) || 0,
            formData.papad_company || '',
            activeItems[0]?.lot_no || ''
          ]);
        } catch (vmErr) {
          console.error('Error inserting vehicle movement for flour out:', vmErr);
        }
      }

      res.status(201).json({
        success: true,
        message: 'Flour out record saved successfully!',
        id: flourOutId
      });
    } catch (error) {
      await db.run('DELETE FROM flour_out WHERE id = ?', [flourOutId]);
      throw error;
    }
  } catch (error) {
    console.error('Error saving flour out:', error);
    res.status(500).json({ success: false, message: 'Error saving flour out', error: error.message });
  }
});

function sanitizeDate(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (s === '' || s === 'null' || s === 'undefined') return null;
  const ddmmyyyy = s.match(/^(\d{1,2})\s*[-\/]\s*(\d{1,2})\s*[-\/]\s*(\d{4})$/);
  if (ddmmyyyy) {
    return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`;
  }
  return s;
}

// PUT update flour out
router.put('/:id', async (req, res) => {
  try {
    const flourOutId = req.params.id;
    const body = req.body || {};
    const formData = body.formData || body;
    const items = body.items || [];
    const activeItems = (items || []).filter(item => item.item_name || item.itemName);

    // Revert existing stock changes first
    await revertFlourOutStock(flourOutId);

    // Calculate totals
    const totalQty = activeItems.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
    const totalWeight = activeItems.reduce((sum, item) => sum + (parseFloat(item.total_wt || item.totalWt) || 0), 0);
    const totalWages = activeItems.reduce((sum, item) => sum + (parseFloat(item.wages) || 0), 0);

    const sNoVal = formData.sNo || formData.s_no || formData.sno || '';
    const compVal = formData.papad_company || formData.papadCompany || formData.company || '';
    const cleanDate = sanitizeDate(formData.date) || new Date().toISOString().slice(0, 10);

    // Update flour out header
    await db.run(`
      UPDATE flour_out 
      SET s_no = ?, date = ?, papad_company = ?, address = ?, remarks = ?, total_qty = ?, total_weight = ?, total_wages = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [sNoVal, cleanDate, compVal, formData.address || '', formData.remarks || '', totalQty, totalWeight, totalWages, flourOutId]);

    // Delete existing items
    await db.run('DELETE FROM flour_out_items WHERE flour_out_id = ?', [flourOutId]);

    // Insert updated items
    for (const item of activeItems) {
      const item_name = item.item_name || item.itemName;
      const lot_no = item.lot_no || item.lotNo || '';
      const weight = parseFloat(item.weight) || 0;
      const qty = parseFloat(item.qty) || 0;
      const total_wt = parseFloat(item.total_wt || item.totalWt) || (weight * qty);
      const papad_kg = parseFloat(item.papad_kg || item.papadKg) || 0;
      const wages_bag = parseFloat(item.wages_bag || item.wagesBag) || 0;
      const wages = parseFloat(item.wages) || (papad_kg * wages_bag);

      // Ensure item group is Flour
      const existingItem = await db.query('SELECT id, item_group FROM item_master WHERE item_name = ?', [item_name]);
      if (existingItem.rows.length === 0) {
        await db.run('INSERT INTO item_master (item_name, status, item_group) VALUES (?, ?, ?)', [item_name, 'Active', 'Flour']);
      } else if (!existingItem.rows[0].item_group) {
        await db.run('UPDATE item_master SET item_group = ? WHERE id = ?', ['Flour', existingItem.rows[0].id]);
      }

      await db.run(`
        INSERT INTO flour_out_items (flour_out_id, item_name, lot_no, weight, qty, total_wt, papad_kg, wages_bag, wages)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [flourOutId, item_name, lot_no, weight, qty, total_wt, papad_kg, wages_bag, wages]);
    }

    // Re-deduct stock for the updated items
    await deductFlourOutStock(flourOutId, formData.date, activeItems);

    res.json({ success: true, message: 'Flour out record updated successfully!' });
  } catch (error) {
    console.error('Error updating flour out:', error);
    res.status(500).json({ success: false, message: 'Error updating flour out', error: error.message });
  }
});

// DELETE flour out
router.delete('/:id', async (req, res) => {
  try {
    const flourOutId = req.params.id;
    await revertFlourOutStock(flourOutId);
    await db.run('DELETE FROM flour_out_items WHERE flour_out_id = ?', [flourOutId]);
    await db.run('DELETE FROM flour_out WHERE id = ?', [flourOutId]);
    res.json({ success: true, message: 'Flour out record deleted successfully' });
  } catch (error) {
    console.error('Error deleting flour out:', error);
    res.status(500).json({ success: false, message: 'Error deleting flour out' });
  }
});

module.exports = router;
