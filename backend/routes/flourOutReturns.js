const express = require('express')
const router = express.Router()
const db = require('../config/database')

// GET next sequential S.No for flour out return
router.get('/next-sno', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        MAX(CAST(s_no AS INTEGER)) as max_sno,
        MAX(id) as max_id,
        COUNT(*) as total_count 
      FROM flour_out_returns
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
    console.error('Error fetching next flour out return S.No:', error);
    res.status(500).json({ success: false, message: 'Error fetching next S.No', error: error.message });
  }
});

// GET all flour out returns
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        foret.id,
        foret.s_no as s_no,
        foret.s_no as sno,
        foret.s_no as sNo,
        foret.date,
        COALESCE(pcm.name, foret.papad_company) as papad_company,
        COALESCE(pcm.name, foret.papad_company) as papadCompany,
        COALESCE(pcm.name, foret.papad_company) as flour_mill,
        foret.tax_type,
        foret.tax_type as taxType,
        foret.remarks,
        foret.total_qty as total_qty,
        foret.total_qty as totalQty,
        foret.total_weight as total_weight,
        foret.total_weight as totalWeight,
        foret.total_wages as total_wages,
        foret.total_wages as totalWages,
        fori.id as item_id,
        fori.id as itemId,
        fori.item_name as item_name,
        fori.item_name as itemName,
        fori.lot_no as lot_no,
        fori.lot_no as lotNo,
        fori.weight,
        fori.qty,
        fori.total_wt as total_wt,
        fori.total_wt as totalWt,
        fori.papad_kg as papad_kg,
        fori.papad_kg as papadKg,
        fori.cost,
        fori.wages_bag as wages_per_bag,
        fori.wages_bag as wagesBag,
        fori.wages
      FROM flour_out_returns foret
      LEFT JOIN papad_company_master pcm ON (CAST(pcm.id AS TEXT) = CAST(foret.papad_company AS TEXT) OR pcm.name = foret.papad_company)
      LEFT JOIN flour_out_return_items fori ON foret.id = fori.flour_out_return_id
      ORDER BY foret.id DESC, fori.id ASC
    `);
    
    const rows = (result.rows || []).map(r => ({
      id: r.id,
      s_no: r.s_no || r.sno || '',
      sno: r.sno || r.s_no || '',
      sNo: r.sNo || r.s_no || '',
      date: r.date ? r.date.substring(0, 10) : '',
      papad_company: r.papad_company || '',
      papadCompany: r.papadCompany || r.papad_company || '',
      flour_mill: r.flour_mill || '',
      tax_type: r.tax_type || '',
      taxType: r.taxType || r.tax_type || '',
      remarks: r.remarks || '',
      total_qty: parseFloat(r.total_qty || 0) || 0,
      totalQty: parseFloat(r.totalQty || r.total_qty || 0) || 0,
      total_weight: parseFloat(r.total_weight || 0) || 0,
      totalWeight: parseFloat(r.totalWeight || r.total_weight || 0) || 0,
      total_wages: parseFloat(r.total_wages || 0) || 0,
      totalWages: parseFloat(r.totalWages || r.total_wages || 0) || 0,
      item_id: r.item_id || r.itemId,
      itemId: r.itemId || r.item_id,
      item_name: r.item_name || r.itemName || '',
      itemName: r.itemName || r.item_name || '',
      lot_no: r.lot_no || r.lotNo || '',
      lotNo: r.lotNo || r.lot_no || '',
      weight: parseFloat(r.weight || 0) || 0,
      qty: parseFloat(r.qty || 0) || 0,
      total_wt: parseFloat(r.total_wt || r.totalWt || 0) || 0,
      totalWt: parseFloat(r.totalWt || r.total_wt || 0) || 0,
      papad_kg: parseFloat(r.papad_kg || r.papadKg || 0) || 0,
      papadKg: parseFloat(r.papadKg || r.papad_kg || 0) || 0,
      cost: parseFloat(r.cost || 0) || 0,
      wages_per_bag: parseFloat(r.wages_per_bag || r.wagesBag || 0) || 0,
      wagesBag: parseFloat(r.wagesBag || r.wages_per_bag || 0) || 0,
      wages: parseFloat(r.wages || 0) || 0
    }));

    res.json(rows);
  } catch (error) {
    console.error('Error fetching flour out returns:', error);
    res.status(500).json({ message: 'Error fetching flour out returns', error: error.message });
  }
});

// GET flour out return by ID
router.get('/:id', async (req, res) => {
  try {
    const flourOutReturnResult = await db.query('SELECT * FROM flour_out_returns WHERE id = ?', [req.params.id]);
    if (flourOutReturnResult.rows.length === 0) {
      return res.status(404).json({ message: 'Flour out return not found' });
    }
    const itemsResult = await db.query('SELECT * FROM flour_out_return_items WHERE flour_out_return_id = ? ORDER BY id ASC', [req.params.id]);
    const raw = flourOutReturnResult.rows[0];
    const flourOutReturn = {
      ...raw,
      sNo: raw.s_no,
      sno: raw.s_no,
      papadCompany: raw.papad_company,
      taxType: raw.tax_type,
      items: (itemsResult.rows || []).map(it => ({
        ...it,
        itemName: it.item_name,
        lotNo: it.lot_no,
        totalWt: it.total_wt,
        papadKg: it.papad_kg,
        wagesBag: it.wages_bag,
        wages_per_bag: it.wages_bag
      }))
    };
    res.json(flourOutReturn);
  } catch (error) {
    console.error('Error fetching flour out return:', error);
    res.status(500).json({ message: 'Error fetching flour out return' });
  }
});

// POST create new flour out return
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const fd = body.formData || body;
    const items = body.items || [];
    const totals = body.totals || {
      totalQty: body.totalQty || 0,
      totalWeight: body.totalWeight || 0,
      totalWages: body.totalWages || 0
    };

    let sNo = fd.sNo || fd.s_no || fd.sno || '';
    if (!sNo || sNo === '1') {
      const maxSnoRes = await db.query('SELECT COALESCE(MAX(CAST(s_no AS INTEGER)), 0) as maxSno FROM flour_out_returns');
      sNo = String((maxSnoRes.rows[0]?.maxSno || 0) + 1);
    }

    const date = fd.date || new Date().toISOString().slice(0, 10);
    const papadCompany = fd.papadCompany || fd.papad_company || fd.company || '';
    const taxType = fd.taxType || fd.tax_type || '';
    const remarks = fd.remarks || '';

    // Insert flour out return
    const flourOutReturnResult = await db.run(`
      INSERT INTO flour_out_returns (s_no, date, papad_company, tax_type, remarks, total_qty, total_weight, total_wages)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [sNo, date, papadCompany, taxType, remarks, 
        totals.totalQty || 0, totals.totalWeight || 0, totals.totalWages || 0]);

    const flourOutReturnId = flourOutReturnResult.lastID;

    // Insert flour out return items
    for (const item of items) {
      const itemName = item.itemName || item.item_name || '';
      const lotNo = item.lotNo || item.lot_no || '';
      const weight = parseFloat(item.weight) || 0;
      const qty = parseFloat(item.qty) || 0;
      const totalWt = parseFloat(item.totalWt || item.total_wt) || (weight * qty);
      const papadKg = parseFloat(item.papadKg || item.papad_kg) || 0;
      const cost = parseFloat(item.cost) || 0;
      const wagesBag = parseFloat(item.wagesBag || item.wages_bag || item.wages_per_bag) || 0;
      const wages = parseFloat(item.wages) || (qty * wagesBag);

      if (itemName) {
        await db.run(`
          INSERT INTO flour_out_return_items (flour_out_return_id, item_name, lot_no, weight, qty, total_wt, papad_kg, cost, wages_bag, wages)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [flourOutReturnId, itemName, lotNo, weight, qty, totalWt, papadKg, cost, wagesBag, wages]);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Flour out return saved successfully!',
      id: flourOutReturnId
    });
  } catch (error) {
    console.error('Error saving flour out return:', error);
    res.status(500).json({ success: false, message: 'Error saving flour out return', error: error.message });
  }
});

// PUT update flour out return
router.put('/:id', async (req, res) => {
  try {
    const body = req.body || {};
    const fd = body.formData || body;
    const items = body.items || [];
    const totals = body.totals || {
      totalQty: body.totalQty || 0,
      totalWeight: body.totalWeight || 0,
      totalWages: body.totalWages || 0
    };
    const flourOutReturnId = req.params.id;
    const sNo = fd.sNo || fd.s_no || fd.sno || '1';
    const date = fd.date || new Date().toISOString().slice(0, 10);
    const papadCompany = fd.papadCompany || fd.papad_company || fd.company || '';
    const taxType = fd.taxType || fd.tax_type || '';
    const remarks = fd.remarks || '';

    // Update flour out return
    await db.run(`
      UPDATE flour_out_returns SET s_no = ?, date = ?, papad_company = ?, tax_type = ?, remarks = ?,
                                  total_qty = ?, total_weight = ?, total_wages = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [sNo, date, papadCompany, taxType, remarks, 
        totals.totalQty || 0, totals.totalWeight || 0, totals.totalWages || 0, flourOutReturnId]);

    // Delete existing items
    await db.run('DELETE FROM flour_out_return_items WHERE flour_out_return_id = ?', [flourOutReturnId]);

    // Insert updated items
    for (const item of items) {
      const itemName = item.itemName || item.item_name || '';
      const lotNo = item.lotNo || item.lot_no || '';
      const weight = parseFloat(item.weight) || 0;
      const qty = parseFloat(item.qty) || 0;
      const totalWt = parseFloat(item.totalWt || item.total_wt) || (weight * qty);
      const papadKg = parseFloat(item.papadKg || item.papad_kg) || 0;
      const cost = parseFloat(item.cost) || 0;
      const wagesBag = parseFloat(item.wagesBag || item.wages_bag || item.wages_per_bag) || 0;
      const wages = parseFloat(item.wages) || (qty * wagesBag);

      if (itemName) {
        await db.run(`
          INSERT INTO flour_out_return_items (flour_out_return_id, item_name, lot_no, weight, qty, total_wt, papad_kg, cost, wages_bag, wages)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [flourOutReturnId, itemName, lotNo, weight, qty, totalWt, papadKg, cost, wagesBag, wages]);
      }
    }

    res.json({ success: true, message: 'Flour out return updated successfully!' });
  } catch (error) {
    console.error('Error updating flour out return:', error);
    res.status(500).json({ success: false, message: 'Error updating flour out return', error: error.message });
  }
});

// DELETE flour out return
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM flour_out_return_items WHERE flour_out_return_id = ?', [req.params.id]);
    await db.run('DELETE FROM flour_out_returns WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Flour out return deleted successfully' });
  } catch (error) {
    console.error('Error deleting flour out return:', error);
    res.status(500).json({ success: false, message: 'Error deleting flour out return' });
  }
});

module.exports = router;
