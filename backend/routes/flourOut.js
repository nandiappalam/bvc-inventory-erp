const express = require('express')
const router = express.Router()
const db = require('../config/database')
const { deductFlourOutStock, revertFlourOutStock } = require('../utils/stockSync')

// GET all flour out records
router.get(['/', '/list'], async (req, res) => {
  try {
    // Ensure entry_type and address columns exist
    try {
      await db.run('ALTER TABLE flour_out ADD COLUMN entry_type TEXT DEFAULT "Flour Out"');
    } catch (e) {}
    try {
      await db.run('ALTER TABLE flour_out ADD COLUMN address TEXT');
    } catch (e) {}

    // Backfill any existing records where entry_type is null
    try {
      await db.run(`
        UPDATE flour_out SET entry_type = 'Papad In'
        WHERE (entry_type IS NULL OR entry_type = '' OR entry_type = 'Flour Out')
        AND id IN (
          SELECT DISTINCT flour_out_id FROM flour_out_items 
          WHERE box_papad > 0 OR wt_papad > 0 OR papad_details IS NOT NULL OR item_name LIKE '%papad%'
        )
      `);
      await db.run(`
        UPDATE flour_out SET entry_type = 'Flour Out'
        WHERE entry_type IS NULL OR entry_type = ''
      `);
    } catch (e) {}

    // Dynamic sequence auto-repair if any s_no is null or empty
    try {
      const nullSnoCheck = await db.query('SELECT id FROM flour_out WHERE (entry_type = "Flour Out" OR entry_type IS NULL) AND (s_no IS NULL OR s_no = "") ORDER BY created_at ASC')
      if (nullSnoCheck.rows.length > 0) {
        console.log(`🔧 Found ${nullSnoCheck.rows.length} flour_out records with null/empty s_no. Repairing...`)
        const maxSnoRes = await db.query('SELECT COALESCE(MAX(CAST(s_no AS INTEGER)), 0) as maxSno FROM flour_out WHERE (entry_type = "Flour Out" OR entry_type IS NULL) AND s_no IS NOT NULL AND s_no != ""')
        let currentMax = maxSnoRes.rows[0]?.maxSno || 0
        for (const row of nullSnoCheck.rows) {
          currentMax++
          await db.run('UPDATE flour_out SET s_no = ? WHERE id = ?', [String(currentMax), row.id])
        }
      }
    } catch (migErr) {
      console.error('Error auto-repairing flour_out s_no:', migErr)
    }

    // Get flour_out records with their items joined (excluding Papad In entries)
    const result = await db.query(`
      SELECT 
        fo.id,
        fo.s_no as sNo,
        fo.s_no,
        fo.date,
        COALESCE(pcm.name, fo.papad_company) as papadCompany,
        COALESCE(pcm.name, fo.papad_company) as papad_company,
        COALESCE(pcm.name, fo.papad_company) as company_name,
        fo.address,
        fo.remarks,
        fo.total_qty as totalQty,
        fo.total_qty,
        fo.total_weight as totalWeight,
        fo.total_weight,
        fo.total_wages as totalWages,
        fo.total_wages,
        fo.created_at as createdAt,
        fo.updated_at as updatedAt,
        foi.id as itemId,
        foi.item_name as itemName,
        foi.item_name,
        foi.lot_no as lotNo,
        foi.lot_no,
        foi.weight,
        foi.qty,
        foi.total_wt as totalWt,
        foi.total_wt,
        foi.papad_kg as papadKg,
        foi.papad_kg,
        foi.wages_bag as wagesBag,
        foi.wages_bag,
        foi.wages
      FROM flour_out fo
      LEFT JOIN papad_company_master pcm ON (CAST(pcm.id AS TEXT) = CAST(fo.papad_company AS TEXT) OR pcm.name = fo.papad_company)
      LEFT JOIN flour_out_items foi ON fo.id = foi.flour_out_id
      WHERE (fo.entry_type = 'Flour Out' OR fo.entry_type IS NULL)
        AND (foi.box_papad IS NULL OR foi.box_papad = 0)
        AND (foi.wt_papad IS NULL OR foi.wt_papad = 0)
      ORDER BY fo.created_at DESC, foi.id ASC
    `)
    
    // Transform the flat rows into the format expected by frontend
    const flourOutMap = new Map()
    
    for (const row of result.rows) {
      if (!flourOutMap.has(row.id)) {
        flourOutMap.set(row.id, {
          id: row.id,
          sNo: row.sNo || row.s_no || String(row.id),
          s_no: row.s_no || row.sNo || String(row.id),
          sno: row.sNo || row.s_no || String(row.id),
          date: row.date,
          papadCompany: row.papadCompany || row.papad_company || '',
          papad_company: row.papad_company || row.papadCompany || '',
          company: row.papadCompany || '',
          address: row.address || '',
          remarks: row.remarks || '',
          totalQty: parseFloat(row.totalQty || row.total_qty || 0),
          total_qty: parseFloat(row.totalQty || row.total_qty || 0),
          totalWeight: parseFloat(row.totalWeight || row.total_weight || 0),
          total_weight: parseFloat(row.totalWeight || row.total_weight || 0),
          totalWages: parseFloat(row.totalWages || row.total_wages || 0),
          total_wages: parseFloat(row.totalWages || row.total_wages || 0),
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          items: []
        })
      }
      
      // Add item if it exists
      if (row.itemId || row.itemName || row.item_name) {
        flourOutMap.get(row.id).items.push({
          itemId: row.itemId,
          id: row.itemId,
          itemName: row.itemName || row.item_name || '',
          item_name: row.item_name || row.itemName || '',
          lotNo: row.lotNo || row.lot_no || '',
          lot_no: row.lot_no || row.lotNo || '',
          weight: parseFloat(row.weight || 0),
          qty: parseFloat(row.qty || 0),
          totalWt: parseFloat(row.totalWt || row.total_wt || 0),
          total_wt: parseFloat(row.total_wt || row.totalWt || 0),
          papadKg: parseFloat(row.papadKg || row.papad_kg || 0),
          papad_kg: parseFloat(row.papad_kg || row.papadKg || 0),
          wagesBag: parseFloat(row.wagesBag || row.wages_bag || 0),
          wages_bag: parseFloat(row.wages_bag || row.wagesBag || 0),
          wages: parseFloat(row.wages || 0)
        })
      }
    }
    
    // Convert map to array
    const flourOutArray = Array.from(flourOutMap.values())
    
    // Flatten for display: each item becomes a separate row
    const flatData = []
    for (const flourOut of flourOutArray) {
      if (flourOut.items.length === 0) {
        // No items, add a row with just the header info
        flatData.push({
          ...flourOut,
          itemId: null,
          itemName: '',
          item_name: '',
          lotNo: '',
          lot_no: '',
          weight: 0,
          qty: 0,
          totalWt: 0,
          total_wt: 0,
          papadKg: 0,
          papad_kg: 0,
          wagesBag: 0,
          wages_bag: 0,
          wages: 0
        })
      } else {
        // Add a row for each item
        for (const item of flourOut.items) {
          flatData.push({
            ...flourOut,
            itemId: item.itemId,
            itemName: item.itemName,
            item_name: item.item_name,
            lotNo: item.lotNo,
            lot_no: item.lot_no,
            weight: item.weight,
            qty: item.qty,
            totalWt: item.totalWt,
            total_wt: item.total_wt,
            papadKg: item.papadKg,
            papad_kg: item.papad_kg,
            wagesBag: item.wagesBag,
            wages_bag: item.wages_bag,
            wages: item.wages
          })
        }
      }
    }
    
    res.json(flatData)
  } catch (error) {
    console.error('Error fetching flour out:', error)
    res.status(500).json({ message: 'Error fetching flour out records', error: error.message })
  }
})

// GET next s_no for flour-out creation
router.get('/next-sno', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        MAX(CAST(s_no AS INTEGER)) as max_sno,
        MAX(id) as max_id,
        COUNT(*) as total_count 
      FROM flour_out
      WHERE (entry_type = 'Flour Out' OR entry_type IS NULL)
    `);
    const maxVal = Math.max(
      parseInt(result.rows[0]?.max_sno) || 0,
      parseInt(result.rows[0]?.max_id) || 0,
      parseInt(result.rows[0]?.total_count) || 0
    );
    const nextSno = maxVal + 1;
    res.json({ success: true, sNo: nextSno, next_sno: nextSno, next_s_no: String(nextSno), s_no: nextSno, data: { s_no: nextSno } })
  } catch (error) {
    console.error('Error getting next s_no for flour-out:', error)
    res.status(500).json({ success: false, message: 'Error getting next s_no', error: error.message })
  }
})

// GET flour out by ID
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || id === 'undefined' || id === 'null' || isNaN(Number(id))) {
      return res.status(404).json({ message: 'Flour out record not found' });
    }
    const flourOutResult = await db.query('SELECT * FROM flour_out WHERE id = ?', [id])
    if (flourOutResult.rows.length === 0) {
      return res.status(404).json({ message: 'Flour out record not found' })
    }

    const itemsResult = await db.query('SELECT * FROM flour_out_items WHERE flour_out_id = ?', [req.params.id])

    const rec = flourOutResult.rows[0];
    const flourOut = {
      ...rec,
      sNo: rec.s_no || String(rec.id),
      papadCompany: rec.papad_company || '',
      items: (itemsResult.rows || []).map(it => ({
        ...it,
        itemName: it.item_name,
        lotNo: it.lot_no,
        totalWt: it.total_wt,
        papadKg: it.papad_kg,
        wagesBag: it.wages_bag
      }))
    }

    res.json(flourOut)
  } catch (error) {
    console.error('Error fetching flour out:', error)
    res.status(500).json({ message: 'Error fetching flour out record' })
  }
})

// POST create new flour out
router.post('/', async (req, res) => {
  try {
    const { formData, items } = req.body

    const activeItems = (items || []).filter(item => item.item_name || item.itemName);

    const rawComp = formData.papad_company || formData.papadCompany || formData.company || '';

    // Validation
    if (!formData.date || !rawComp || activeItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Date, papad company, and at least one item are required' })
    }

    if (activeItems.some(item => !(item.item_name || item.itemName) || parseFloat(item.qty) <= 0)) {
      return res.status(400).json({ success: false, message: 'All items must have a name and positive quantity' })
    }

    // Calculate totals
    const totalQty = activeItems.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0)
    const totalWeight = activeItems.reduce((sum, item) => sum + (parseFloat(item.total_wt || item.totalWt) || 0), 0)
    const totalWages = activeItems.reduce((sum, item) => sum + (parseFloat(item.wages) || 0), 0)

    // Check if papad_company exists in papad_company_master, if not, create it
    let companyName = rawComp;
    const isId = /^\d+$/.test(String(rawComp));
    const existingCompany = isId
      ? await db.query('SELECT id, name FROM papad_company_master WHERE id = ?', [rawComp])
      : await db.query('SELECT id, name FROM papad_company_master WHERE name = ?', [rawComp]);

    if (existingCompany.rows.length > 0) {
      companyName = existingCompany.rows[0].name;
    } else if (!isId) {
      await db.run('INSERT INTO papad_company_master (name, status) VALUES (?, ?)', [rawComp, 'Active']);
    }

    // Safely try to add address column to flour_out table if it doesn't exist
    try {
      await db.run('ALTER TABLE flour_out ADD COLUMN IF NOT EXISTS address TEXT');
    } catch (err) {}
    try {
      await db.run('ALTER TABLE flour_out ADD COLUMN IF NOT EXISTS entry_type TEXT DEFAULT "Flour Out"');
    } catch (err) {}

    // Insert flour out first
    let sNoVal = formData.sNo || formData.s_no || formData.sno || '';
    if (!sNoVal || sNoVal === '1' || sNoVal === '') {
      const snoRes = await db.query(`
        SELECT COALESCE(MAX(CAST(s_no AS INTEGER)), 0) as max_sno 
        FROM flour_out 
        WHERE (entry_type = 'Flour Out' OR entry_type IS NULL)
      `);
      const nextNum = (parseInt(snoRes.rows[0]?.max_sno) || 0) + 1;
      sNoVal = String(nextNum);
    }

    const flourOutResult = await db.run(`
      INSERT INTO flour_out (s_no, date, papad_company, address, remarks, total_qty, total_weight, total_wages, entry_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Flour Out')
    `, [sNoVal, formData.date, companyName, formData.address || '', formData.remarks, totalQty, totalWeight, totalWages])

    const flourOutId = flourOutResult.lastID

    try {
      // Insert flour out items
      for (const item of activeItems) {
        const item_name = item.item_name || item.itemName;
        const lot_no = item.lot_no || item.lotNo || '';
        const weight = item.weight || 0;
        const qty = item.qty;
        const total_wt = item.total_wt || item.totalWt || 0;
        const papad_kg = item.papad_kg || item.papadKg || 0;
        const wages_bag = item.wages_bag || item.wagesBag || 0;
        const wages = item.wages || 0;

        // Check if item exists in item_master, ensure item_group is 'Flour'
        const existingItem = await db.query('SELECT id, item_group FROM item_master WHERE item_name = ?', [item_name])
        if (existingItem.rows.length === 0) {
          await db.run('INSERT INTO item_master (item_name, status, item_group, type) VALUES (?, ?, ?, ?)', [item_name, 'Active', 'Flour', 'Flour'])
        } else if (!existingItem.rows[0].item_group || existingItem.rows[0].item_group === 'Raw Material' || existingItem.rows[0].item_group === 'RM') {
          await db.run('UPDATE item_master SET item_group = "Flour", type = "Flour" WHERE id = ?', [existingItem.rows[0].id])
        }

        await db.run(`
          INSERT INTO flour_out_items (flour_out_id, item_name, lot_no, weight, qty, total_wt, papad_kg, wages_bag, wages)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [flourOutId, item_name, lot_no, weight, qty, total_wt, papad_kg, wages_bag, wages])
      }

      // Deduct stock / lots and create ledger tracking records
      await deductFlourOutStock(flourOutId, formData.date, activeItems);

      res.status(201).json({
        success: true,
        message: 'Flour out record saved successfully!',
        id: flourOutId,
        s_no: sNoVal,
        sNo: sNoVal
      })
    } catch (error) {
      // If items insert fails, delete the flour_out to clean up
      await db.run('DELETE FROM flour_out WHERE id = ?', [flourOutId])
      throw error
    }
  } catch (error) {
    console.error('Error saving flour out:', error)
    res.status(500).json({ success: false, message: 'Error saving flour out', error: error.message })
  }
})

// PUT update flour out
router.put('/:id', async (req, res) => {
  try {
    const { formData, items } = req.body
    const flourOutId = req.params.id

    const activeItems = (items || []).filter(item => item.item_name || item.itemName);

    // Revert existing stock changes first
    await revertFlourOutStock(flourOutId);

    // Calculate totals
    const totalQty = activeItems.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0)
    const totalWeight = activeItems.reduce((sum, item) => sum + (parseFloat(item.total_wt || item.totalWt) || 0), 0)
    const totalWages = activeItems.reduce((sum, item) => sum + (parseFloat(item.wages) || 0), 0)

    const sNoVal = formData.sNo || formData.s_no || '';
    const compVal = formData.papad_company || formData.papadCompany || formData.company || '';

    // Update flour out
    await db.run(`
      UPDATE flour_out SET s_no = ?, date = ?, papad_company = ?, address = ?, remarks = ?, total_qty = ?, total_weight = ?, total_wages = ?, entry_type = 'Flour Out', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [sNoVal, formData.date, compVal, formData.address || '', formData.remarks, totalQty, totalWeight, totalWages, flourOutId])

    // Delete existing items
    await db.run('DELETE FROM flour_out_items WHERE flour_out_id = ?', [flourOutId])

    // Insert updated items
    for (const item of activeItems) {
      const item_name = item.item_name || item.itemName;
      const lot_no = item.lot_no || item.lotNo || '';
      const weight = item.weight || 0;
      const qty = item.qty;
      const total_wt = item.total_wt || item.totalWt || 0;
      const papad_kg = item.papad_kg || item.papadKg || 0;
      const wages_bag = item.wages_bag || item.wagesBag || 0;
      const wages = item.wages || 0;

      // Ensure item_group is 'Flour'
      const existingItem = await db.query('SELECT id, item_group FROM item_master WHERE item_name = ?', [item_name])
      if (existingItem.rows.length === 0) {
        await db.run('INSERT INTO item_master (item_name, status, item_group, type) VALUES (?, ?, ?, ?)', [item_name, 'Active', 'Flour', 'Flour'])
      } else if (!existingItem.rows[0].item_group || existingItem.rows[0].item_group === 'Raw Material' || existingItem.rows[0].item_group === 'RM') {
        await db.run('UPDATE item_master SET item_group = "Flour", type = "Flour" WHERE id = ?', [existingItem.rows[0].id])
      }

      await db.run(`
        INSERT INTO flour_out_items (flour_out_id, item_name, lot_no, weight, qty, total_wt, papad_kg, wages_bag, wages)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [flourOutId, item_name, lot_no, weight, qty, total_wt, papad_kg, wages_bag, wages])
    }

    // Deduct stock for the new/updated items
    await deductFlourOutStock(flourOutId, formData.date, activeItems);

    res.json({ success: true, message: 'Flour out record updated successfully!' })
  } catch (error) {
    console.error('Error updating flour out:', error)
    res.status(500).json({ message: 'Error updating flour out' })
  }
})

// DELETE flour out
router.delete('/:id', async (req, res) => {
  try {
    const flourOutId = req.params.id;
    
    // Revert existing stock changes first
    await revertFlourOutStock(flourOutId);

    // Delete items manually to be safe
    await db.run('DELETE FROM flour_out_items WHERE flour_out_id = ?', [flourOutId])

    // Delete parent record
    await db.run('DELETE FROM flour_out WHERE id = ?', [flourOutId])

    res.json({ message: 'Flour out record deleted successfully' })
  } catch (error) {
    console.error('Error deleting flour out:', error)
    res.status(500).json({ message: 'Error deleting flour out' })
  }
})

module.exports = router
