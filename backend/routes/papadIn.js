const express = require('express')
const router = express.Router()
const db = require('../config/database')
const { addPapadInStock, revertPapadInStock } = require('../utils/stockSync')
const { rebuildStockLedger } = require('../utils/stockRebuilder')

// Helper to determine if a record is Papad In
// Note: Papad In is identified in flour_out by having papad items or box_papad/wt_papad or remarks/papad_company
// GET next sequential S.No for papad in
router.get('/next-sno', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        MAX(CAST(fo.s_no AS INTEGER)) as max_sno,
        MAX(fo.id) as max_id,
        COUNT(DISTINCT fo.id) as total_count 
      FROM flour_out fo
      WHERE fo.papad_company IS NOT NULL AND fo.papad_company != ''
    `);
    const maxVal = Math.max(
      parseInt(result.rows[0]?.max_sno, 10) || 0,
      parseInt(result.rows[0]?.max_id, 10) || 0,
      parseInt(result.rows[0]?.total_count, 10) || 0
    );
    const nextSNo = maxVal + 1;
    res.json({ 
      success: true, 
      next_s_no: String(nextSNo), 
      next_sno: nextSNo, 
      s_no: nextSNo, 
      sNo: nextSNo,
      sno: nextSNo,
      data: { s_no: nextSNo } 
    });
  } catch (error) {
    console.error('Error fetching next Papad In S.No:', error);
    res.status(500).json({ success: false, message: 'Error fetching next S.No', error: error.message });
  }
});

// GET all papad in records
router.get('/', async (req, res) => {
  try {
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
        foi.papad_kg as kg,
        foi.papad_kg as papad_kg,
        foi.papad_kg as papadKg,
        foi.wages_bag as wages_bag,
        foi.wages_bag as wagesBag,
        foi.wages,
        foi.box_papad,
        foi.wt_papad,
        foi.box_empty,
        foi.wt_empty,
        foi.papad_details,
        foi.empty_details
      FROM flour_out fo
      LEFT JOIN papad_company_master pcm ON (CAST(pcm.id AS TEXT) = CAST(fo.papad_company AS TEXT) OR pcm.name = fo.papad_company)
      LEFT JOIN flour_out_items foi ON fo.id = foi.flour_out_id
      WHERE fo.papad_company IS NOT NULL AND fo.papad_company != ''
      ORDER BY fo.id DESC, foi.id ASC
    `);
    
    // Map to support both snake_case and camelCase so frontend Display components work smoothly
    const flatData = (result.rows || []).map(row => ({
      ...row,
      id: row.id,
      sNo: row.s_no || row.sNo || '',
      s_no: row.s_no || row.sNo || '',
      sno: row.sno || row.sNo || '',
      papadCompany: row.papad_company || row.papadCompany || '',
      papad_company: row.papad_company || row.papadCompany || '',
      itemName: row.item_name || row.itemName || '',
      item_name: row.item_name || row.itemName || '',
      lotNo: row.lot_no || row.lotNo || '',
      lot_no: row.lot_no || row.lotNo || '',
      totalWt: parseFloat(row.total_wt || row.totalWt || row.wt_papad || 0) || 0,
      total_wt: parseFloat(row.total_wt || row.totalWt || row.wt_papad || 0) || 0,
      kg: parseFloat(row.kg || row.papad_kg || row.papadKg || 0) || 0,
      papadKg: parseFloat(row.papadKg || row.papad_kg || 0) || 0,
      papad_kg: parseFloat(row.papad_kg || row.papadKg || 0) || 0,
      qty: parseFloat(row.qty || row.box_papad || 0) || 0,
      box_papad: parseFloat(row.box_papad || row.qty || 0) || 0,
      wt_papad: parseFloat(row.wt_papad || row.total_wt || 0) || 0,
      box_empty: parseFloat(row.box_empty || 0) || 0,
      wt_empty: parseFloat(row.wt_empty || 0) || 0
    }));

    res.json(flatData);
  } catch (error) {
    console.error('Error fetching papad in list:', error);
    res.status(500).json({ message: 'Error fetching papad in records', error: error.message });
  }
});

// GET papad in by ID
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || id === 'undefined' || id === 'null' || isNaN(Number(id))) {
      return res.status(404).json({ message: 'Papad in record not found' });
    }

    const header = await db.query(`
      SELECT 
        fo.id,
        fo.s_no,
        fo.date,
        fo.papad_company,
        COALESCE(pcm.name, fo.papad_company) as papad_company_name,
        fo.remarks,
        fo.total_qty,
        fo.total_weight,
        fo.total_wages
      FROM flour_out fo
      LEFT JOIN papad_company_master pcm ON (CAST(pcm.id AS TEXT) = CAST(fo.papad_company AS TEXT) OR pcm.name = fo.papad_company)
      WHERE fo.id = ?
    `, [id]);

    if (header.rows.length === 0) {
      return res.status(404).json({ message: 'Papad in record not found' });
    }

    const items = await db.query(`
      SELECT 
        id,
        flour_out_id,
        item_name,
        lot_no,
        weight,
        qty,
        total_wt,
        papad_kg,
        wages_bag,
        wages,
        box_papad,
        wt_papad,
        box_empty,
        wt_empty,
        papad_details,
        empty_details
      FROM flour_out_items
      WHERE flour_out_id = ?
      ORDER BY id ASC
    `, [id]);

    const result = {
      ...header.rows[0],
      sNo: header.rows[0].s_no,
      papadCompany: header.rows[0].papad_company,
      items: items.rows.map(it => ({
        ...it,
        itemName: it.item_name,
        lotNo: it.lot_no,
        totalWt: it.total_wt,
        papadKg: it.papad_kg,
        wagesBag: it.wages_bag
      }))
    };

    res.json(result);
  } catch (error) {
    console.error('Error fetching papad in record by ID:', error);
    res.status(500).json({ message: 'Error fetching record', error: error.message });
  }
});

// POST create new papad in record
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const formData = body.formData || body;
    const items = body.items || [];
    const flourItems = body.flourItems || [];
    const totals = body.totals || {};

    let sNo = formData.sNo || formData.s_no || formData.sno || '';
    if (!sNo || sNo === '1') {
      const maxSnoRes = await db.query('SELECT COALESCE(MAX(CAST(s_no AS INTEGER)), 0) as maxSno FROM flour_out WHERE papad_company IS NOT NULL AND papad_company != ""');
      sNo = String((maxSnoRes.rows[0]?.maxSno || 0) + 1);
    }

    const date = formData.date || new Date().toISOString().split('T')[0];
    const papadCompany = formData.papadCompany || formData.papad_company || formData.company || '';
    const remarks = formData.remarks || '';

    const totalQty = totals.totalQty !== undefined ? parseFloat(totals.totalQty) : items.reduce((acc, it) => acc + (parseFloat(it.qty || it.box_papad) || 0), 0);
    const totalWeight = totals.totalWeight !== undefined ? parseFloat(totals.totalWeight) : items.reduce((acc, it) => acc + (parseFloat(it.totalWt || it.tot_wt || it.wt_papad || it.weight) || 0), 0);
    const totalWages = totals.totalWages !== undefined ? parseFloat(totals.totalWages) : items.reduce((acc, it) => acc + (parseFloat(it.wages) || 0), 0);

    // Check if papad company exists in master, if not insert
    if (papadCompany) {
      try {
        const existingComp = await db.query('SELECT id FROM papad_company_master WHERE name = ? OR CAST(id AS TEXT) = ?', [papadCompany, String(papadCompany)]);
        if (existingComp.rows.length === 0) {
          await db.run('INSERT INTO papad_company_master (name, status) VALUES (?, ?)', [papadCompany, 'Active']);
        }
      } catch (e) {}
    }

    // Insert papad in header (stored in flour_out table)
    const result = await db.run(`
      INSERT INTO flour_out (s_no, date, papad_company, remarks, total_qty, total_weight, total_wages)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      sNo, 
      date, 
      papadCompany, 
      remarks, 
      totalQty || 0, 
      totalWeight || 0, 
      totalWages || 0
    ]);

    const flourOutId = result.lastID;

    // Insert items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemName = item.itemName || item.item_name || '';
      const flourItem = flourItems[i] || {};
      const flourKg = parseFloat(flourItem.kg || item.papadKg || item.kg) || 0;

      if (itemName) {
        try {
          const existingItem = await db.query('SELECT id, item_group FROM item_master WHERE item_name = ?', [itemName]);
          if (existingItem.rows.length === 0) {
            // Set item_group to 'Papad' as requested!
            await db.run('INSERT INTO item_master (item_name, status, item_group) VALUES (?, ?, ?)', [itemName, 'Active', 'Papad']);
          } else if (!existingItem.rows[0].item_group || existingItem.rows[0].item_group === 'General') {
            await db.run('UPDATE item_master SET item_group = ? WHERE id = ?', ['Papad', existingItem.rows[0].id]);
          }
        } catch (e) {}
      }

      await db.run(`
        INSERT INTO flour_out_items (
          flour_out_id, item_name, lot_no, weight, qty, total_wt, papad_kg, wages_bag, wages, 
          box_papad, wt_papad, box_empty, wt_empty, papad_details, empty_details
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        flourOutId, 
        itemName, 
        item.lotNo || item.lot_no || '', 
        parseFloat(item.weight) || 0, 
        parseFloat(item.qty || item.box_papad) || 0, 
        parseFloat(item.totalWt || item.tot_wt || item.total_wt || item.wt_papad) || 0, 
        flourKg, 
        parseFloat(item.wagesBag || item.wages_bag) || 0, 
        parseFloat(item.wages) || 0,
        parseFloat(item.box_papad) || 0,
        parseFloat(item.wt_papad || item.tot_wt || item.total_wt) || 0,
        parseFloat(item.box_empty) || 0,
        parseFloat(item.wt_empty) || 0,
        typeof item.papad_details === 'string' ? item.papad_details : JSON.stringify(item.papad_details || []),
        typeof item.empty_details === 'string' ? item.empty_details : JSON.stringify(item.empty_details || [])
      ]);
    }

    // Add stock movement and stock lot for Papad In under Papad Item group
    await addPapadInStock(flourOutId, date, items);
    
    try {
      await rebuildStockLedger();
    } catch (e) {
      console.error('Error rebuilding stock after papad in:', e);
    }

    res.status(201).json({
      success: true,
      message: 'Papad In record saved successfully!',
      id: flourOutId
    });
  } catch (error) {
    console.error('Error saving papad in record:', error);
    res.status(500).json({ success: false, message: 'Error saving papad in record', error: error.message });
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

// PUT update papad in record
router.put('/:id', async (req, res) => {
  try {
    const body = req.body || {};
    const formData = body.formData || body;
    const items = body.items || [];
    const flourItems = body.flourItems || [];
    const totals = body.totals || {};
    const flourOutId = req.params.id;

    const sNo = formData.sNo || formData.s_no || formData.sno || '1';
    const date = sanitizeDate(formData.date) || new Date().toISOString().split('T')[0];
    const papadCompany = formData.papadCompany || formData.papad_company || formData.company || '';
    const remarks = formData.remarks || '';

    const totalQty = totals.totalQty !== undefined ? parseFloat(totals.totalQty) : items.reduce((acc, it) => acc + (parseFloat(it.qty || it.box_papad) || 0), 0);
    const totalWeight = totals.totalWeight !== undefined ? parseFloat(totals.totalWeight) : items.reduce((acc, it) => acc + (parseFloat(it.totalWt || it.tot_wt || it.wt_papad || it.weight) || 0), 0);
    const totalWages = totals.totalWages !== undefined ? parseFloat(totals.totalWages) : items.reduce((acc, it) => acc + (parseFloat(it.wages) || 0), 0);

    // Update flour_out
    await db.run(`
      UPDATE flour_out SET s_no = ?, date = ?, papad_company = ?, remarks = ?, 
      total_qty = ?, total_weight = ?, total_wages = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      sNo, 
      date, 
      papadCompany, 
      remarks, 
      totalQty || 0, 
      totalWeight || 0, 
      totalWages || 0, 
      flourOutId
    ]);

    // Revert old stock
    await revertPapadInStock(flourOutId);

    // Delete existing items
    await db.run('DELETE FROM flour_out_items WHERE flour_out_id = ?', [flourOutId]);

    // Insert updated items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemName = item.itemName || item.item_name || '';
      const flourItem = flourItems[i] || {};
      const flourKg = parseFloat(flourItem.kg || item.papadKg || item.kg) || 0;

      if (itemName) {
        const existingItem = await db.query('SELECT id, item_group FROM item_master WHERE item_name = ?', [itemName]);
        if (existingItem.rows.length === 0) {
          await db.run('INSERT INTO item_master (item_name, status, item_group) VALUES (?, ?, ?)', [itemName, 'Active', 'Papad']);
        } else if (!existingItem.rows[0].item_group || existingItem.rows[0].item_group === 'General') {
          await db.run('UPDATE item_master SET item_group = ? WHERE id = ?', ['Papad', existingItem.rows[0].id]);
        }
      }

      await db.run(`
        INSERT INTO flour_out_items (
          flour_out_id, item_name, lot_no, weight, qty, total_wt, papad_kg, wages_bag, wages, 
          box_papad, wt_papad, box_empty, wt_empty, papad_details, empty_details
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        flourOutId, 
        itemName, 
        item.lotNo || item.lot_no || '', 
        parseFloat(item.weight) || 0, 
        parseFloat(item.qty || item.box_papad) || 0, 
        parseFloat(item.totalWt || item.tot_wt || item.total_wt || item.wt_papad) || 0, 
        flourKg, 
        parseFloat(item.wagesBag || item.wages_bag) || 0, 
        parseFloat(item.wages) || 0,
        parseFloat(item.box_papad) || 0,
        parseFloat(item.wt_papad || item.tot_wt || item.total_wt) || 0,
        parseFloat(item.box_empty) || 0,
        parseFloat(item.wt_empty) || 0,
        typeof item.papad_details === 'string' ? item.papad_details : JSON.stringify(item.papad_details || []),
        typeof item.empty_details === 'string' ? item.empty_details : JSON.stringify(item.empty_details || [])
      ]);
    }

    // Add updated stock under Papad Item group
    await addPapadInStock(flourOutId, date, items);
    
    try {
      await rebuildStockLedger();
    } catch (e) {
      console.error('Error rebuilding stock after updating papad in:', e);
    }

    res.json({ success: true, message: 'Papad In record updated successfully!' });
  } catch (error) {
    console.error('Error updating papad in record:', error);
    res.status(500).json({ success: false, message: 'Error updating papad in record', error: error.message });
  }
});

// DELETE papad in record
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await revertPapadInStock(id);
    await db.run('DELETE FROM flour_out_items WHERE flour_out_id = ?', [id]);
    await db.run('DELETE FROM flour_out WHERE id = ?', [id]);
    try {
      await rebuildStockLedger();
    } catch (e) {
      console.error('Error rebuilding stock after deleting papad in:', e);
    }
    res.json({ success: true, message: 'Papad In record deleted successfully' });
  } catch (error) {
    console.error('Error deleting papad in record:', error);
    res.status(500).json({ success: false, message: 'Error deleting papad in record', error: error.message });
  }
});

module.exports = router;
