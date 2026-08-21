const express = require('express')
const router = express.Router()
const db = require('../config/database')
const { addPapadInStock, revertPapadInStock } = require('../utils/stockSync')
const { rebuildStockLedger } = require('../utils/stockRebuilder')

// Papad In is stored in flour_out / flour_out_items table where papad_company IS NOT NULL AND NOT EMPTY

// GET all papad in records
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        fo.id,
        fo.s_no as s_no,
        fo.date,
        COALESCE(pcm.name, fo.papad_company) as papad_company,
        fo.remarks,
        fo.total_qty as total_qty,
        fo.total_weight as total_weight,
        fo.total_wages as total_wages,
        fo.created_at as created_at,
        fo.updated_at as updated_at,
        foi.id as itemId,
        foi.item_name as item_name,
        foi.lot_no as lot_no,
        foi.weight,
        foi.qty,
        foi.total_wt as total_wt,
        foi.papad_kg as kg,
        foi.wages_bag as wages_bag,
        foi.wages,
        foi.box_papad,
        foi.wt_papad,
        foi.box_empty,
        foi.wt_empty,
        foi.papad_details,
        foi.empty_details
      FROM flour_out fo
      LEFT JOIN papad_company_master pcm ON (pcm.id = CAST(fo.papad_company AS INTEGER) OR pcm.name = fo.papad_company)
      LEFT JOIN flour_out_items foi ON fo.id = foi.flour_out_id
      WHERE fo.papad_company IS NOT NULL AND fo.papad_company != ''
      ORDER BY fo.created_at DESC, foi.id ASC
    `)
    
    // Map to support both snake_case and camelCase so that frontend Display components work perfectly
    const flatData = result.rows.map(row => ({
      ...row,
      sNo: row.s_no,
      papadCompany: row.papad_company,
      itemName: row.item_name,
      lotNo: row.lot_no,
      totalWt: row.total_wt,
      papadKg: row.kg,
      wagesBag: row.wages_bag
    }))
    
    res.json(flatData)
  } catch (error) {
    console.error('Error fetching papad in records:', error)
    res.status(500).json({ message: 'Error fetching papad in records', error: error.message })
  }
})

// GET papad in by ID
router.get('/:id', async (req, res) => {
  try {
    const parentResult = await db.query('SELECT * FROM flour_out WHERE id = ?', [req.params.id])
    if (parentResult.rows.length === 0) {
      return res.status(404).json({ message: 'Papad In record not found' })
    }

    const itemsResult = await db.query('SELECT * FROM flour_out_items WHERE flour_out_id = ?', [req.params.id])
    
    // Map items so they support both camelCase and snake_case for the creation form
    const mappedItems = itemsResult.rows.map(item => ({
      ...item,
      itemName: item.item_name,
      lotNo: item.lot_no,
      totalWt: item.total_wt,
      papadKg: item.papad_kg,
      wagesBag: item.wages_bag
    }))

    const data = {
      ...parentResult.rows[0],
      sNo: parentResult.rows[0].s_no,
      papadCompany: parentResult.rows[0].papad_company,
      items: mappedItems
    }

    res.json(data)
  } catch (error) {
    console.error('Error fetching papad in record:', error)
    res.status(500).json({ message: 'Error fetching papad in record', error: error.message })
  }
})

// POST create new papad in record
router.post('/', async (req, res) => {
  try {
    const { formData, items, totals } = req.body

    // Insert papad in (stored in flour_out table)
    const result = await db.run(`
      INSERT INTO flour_out (s_no, date, papad_company, remarks, total_qty, total_weight, total_wages)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      formData.sNo, 
      formData.date, 
      formData.papadCompany || formData.company, 
      formData.remarks, 
      totals.totalQty, 
      totals.totalWeight, 
      totals.totalWages
    ])

    const flourOutId = result.lastID

    // Insert items
    for (const item of items) {
      // Check if item exists in item_master, if not, create it
      const itemName = item.itemName || item.item_name || '';
      if (itemName) {
        const existingItem = await db.query('SELECT id FROM item_master WHERE item_name = ?', [itemName])
        if (existingItem.rows.length === 0) {
          await db.run('INSERT INTO item_master (item_name, status) VALUES (?, ?)', [itemName, 'Active'])
        }
      }

      await db.run(`
        INSERT INTO flour_out_items (flour_out_id, item_name, lot_no, weight, qty, total_wt, papad_kg, wages_bag, wages, box_papad, wt_papad, box_empty, wt_empty, papad_details, empty_details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        flourOutId, 
        itemName, 
        item.lotNo || item.lot_no || '', 
        parseFloat(item.weight) || 0, 
        parseFloat(item.qty) || 0, 
        parseFloat(item.totalWt || item.total_wt) || 0, 
        parseFloat(item.papadKg || item.kg) || 0, 
        parseFloat(item.wagesBag || item.wages_bag) || 0, 
        parseFloat(item.wages) || 0,
        parseFloat(item.box_papad) || 0,
        parseFloat(item.wt_papad) || 0,
        parseFloat(item.box_empty) || 0,
        parseFloat(item.wt_empty) || 0,
        typeof item.papad_details === 'string' ? item.papad_details : JSON.stringify(item.papad_details || []),
        typeof item.empty_details === 'string' ? item.empty_details : JSON.stringify(item.empty_details || [])
      ])
    }

    // Add stock movement and stock lot for Papad In
    await addPapadInStock(flourOutId, formData.date, items)

    try {
      await rebuildStockLedger();
    } catch (e) {
      console.error('Error rebuilding stock after papad in:', e);
    }

    res.status(201).json({
      success: true,
      message: 'Papad In record saved successfully!',
      id: flourOutId
    })
  } catch (error) {
    console.error('Error saving papad in record:', error)
    res.status(500).json({ success: false, message: 'Error saving papad in record', error: error.message })
  }
})

// PUT update papad in record
router.put('/:id', async (req, res) => {
  try {
    const { formData, items, totals } = req.body
    const flourOutId = req.params.id

    // Update flour_out
    await db.run(`
      UPDATE flour_out SET s_no = ?, date = ?, papad_company = ?, remarks = ?, 
      total_qty = ?, total_weight = ?, total_wages = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      formData.sNo, 
      formData.date, 
      formData.papadCompany || formData.company, 
      formData.remarks, 
      totals.totalQty, 
      totals.totalWeight, 
      totals.totalWages, 
      flourOutId
    ])

    // Revert old stock
    await revertPapadInStock(flourOutId)

    // Delete existing items
    await db.run('DELETE FROM flour_out_items WHERE flour_out_id = ?', [flourOutId])

    // Insert updated items
    for (const item of items) {
      const itemName = item.itemName || item.item_name || '';
      if (itemName) {
        const existingItem = await db.query('SELECT id FROM item_master WHERE item_name = ?', [itemName])
        if (existingItem.rows.length === 0) {
          await db.run('INSERT INTO item_master (item_name, status) VALUES (?, ?)', [itemName, 'Active'])
        }
      }

      await db.run(`
        INSERT INTO flour_out_items (flour_out_id, item_name, lot_no, weight, qty, total_wt, papad_kg, wages_bag, wages, box_papad, wt_papad, box_empty, wt_empty, papad_details, empty_details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        flourOutId, 
        itemName, 
        item.lotNo || item.lot_no || '', 
        parseFloat(item.weight) || 0, 
        parseFloat(item.qty) || 0, 
        parseFloat(item.totalWt || item.total_wt) || 0, 
        parseFloat(item.papadKg || item.kg) || 0, 
        parseFloat(item.wagesBag || item.wages_bag) || 0, 
        parseFloat(item.wages) || 0,
        parseFloat(item.box_papad) || 0,
        parseFloat(item.wt_papad) || 0,
        parseFloat(item.box_empty) || 0,
        parseFloat(item.wt_empty) || 0,
        typeof item.papad_details === 'string' ? item.papad_details : JSON.stringify(item.papad_details || []),
        typeof item.empty_details === 'string' ? item.empty_details : JSON.stringify(item.empty_details || [])
      ])
    }

    // Add updated stock
    await addPapadInStock(flourOutId, formData.date, items)

    try {
      await rebuildStockLedger();
    } catch (e) {
      console.error('Error rebuilding stock after updating papad in:', e);
    }

    res.json({ success: true, message: 'Papad In record updated successfully!' })
  } catch (error) {
    console.error('Error updating papad in record:', error)
    res.status(500).json({ success: false, message: 'Error updating papad in record', error: error.message })
  }
})

// DELETE papad in record
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await revertPapadInStock(id);
    await db.run('DELETE FROM flour_out_items WHERE flour_out_id = ?', [id])
    await db.run('DELETE FROM flour_out WHERE id = ?', [id])

    try {
      await rebuildStockLedger();
    } catch (e) {
      console.error('Error rebuilding stock after deleting papad in:', e);
    }

    res.json({ success: true, message: 'Papad In record deleted successfully' })
  } catch (error) {
    console.error('Error deleting papad in record:', error)
    res.status(500).json({ success: false, message: 'Error deleting papad in record', error: error.message })
  }
})

module.exports = router
