const express = require('express')
const router = express.Router()
const db = require('../config/database')

<<<<<<< HEAD
// Ensure is_order column exists in sales_export_orders
async function ensureExportColumns() {
  try {
    await db.run("ALTER TABLE sales_export_orders ADD COLUMN is_order INTEGER DEFAULT 0")
  } catch (err) {}
}

// GET all sales export orders / invoices
router.get('/', async (req, res) => {
  try {
    await ensureExportColumns();
    const isOrderQuery = req.query.is_order;
    
    let query = `
      SELECT s.*, 
             COALESCE(sgm.name, s.sender) AS sender_name,
             COALESCE(cgm.name, s.consignee) AS consignee_name,
             COALESCE(egm.name, s.exporter) AS exporter_name,
             COALESCE(ctgm.name, s.consigned_to) AS consigned_to_name
      FROM sales_export_orders s
      LEFT JOIN sender_group_master sgm ON s.sender = sgm.id OR s.sender = CAST(sgm.id AS TEXT) OR s.sender = sgm.name
      LEFT JOIN consignee_group_master cgm ON s.consignee = cgm.id OR s.consignee = CAST(cgm.id AS TEXT) OR s.consignee = cgm.name
      LEFT JOIN sender_group_master egm ON s.exporter = egm.id OR s.exporter = CAST(egm.id AS TEXT) OR s.exporter = egm.name
      LEFT JOIN consignee_group_master ctgm ON s.consigned_to = ctgm.id OR s.consigned_to = CAST(ctgm.id AS TEXT) OR s.consigned_to = ctgm.name
    `;
    const params = [];
    
    if (isOrderQuery !== undefined) {
      query += ' WHERE COALESCE(s.is_order, 0) = ?';
      params.push(parseInt(isOrderQuery) || 0);
    }
    
    query += ' ORDER BY s.id DESC';
    
    const result = await db.query(query, params)
    
=======
// GET all sales export orders
router.get('/', async (req, res) => {
  try {
    // First get all sales export orders
    const result = await db.query(`
      SELECT * FROM sales_export_orders ORDER BY id DESC
    `)
    
    // Then get items for each order
>>>>>>> origin/main
    const exportOrders = []
    for (const order of result.rows) {
      const itemsResult = await db.query(
        'SELECT * FROM sales_export_order_items WHERE sales_export_order_id = ?',
        [order.id]
      )
      exportOrders.push({
        ...order,
        items: itemsResult.rows
      })
    }
    
    res.json(exportOrders)
  } catch (error) {
    console.error('Error fetching sales export orders:', error)
    res.status(500).json({ message: 'Error fetching sales export orders', error: error.message })
  }
})

<<<<<<< HEAD
// GET next sequential bill_no for sales export orders
router.get('/next-sno', async (req, res) => {
  try {
    const maxRes = await db.query("SELECT COALESCE(MAX(CAST(bill_no AS INTEGER)), 0) + 1 AS next_sno FROM sales_export_orders");
    const nextSno = maxRes.rows[0]?.next_sno || 1;
    res.json({ success: true, next_sno: String(nextSno) });
  } catch (error) {
    console.error('Error fetching next sales export s_no:', error);
    res.status(500).json({ success: false, message: 'Error fetching next sales export s_no', error: error.message });
  }
});

// GET sales export order by ID
router.get('/:id', async (req, res) => {
  try {
    await ensureExportColumns();
    const exportOrderResult = await db.query('SELECT * FROM sales_export_orders WHERE id = ?', [req.params.id])
    if (exportOrderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Sales export record not found' })
=======
// GET sales export order by ID
router.get('/:id', async (req, res) => {
  try {
    const exportOrderResult = await db.query('SELECT * FROM sales_export_orders WHERE id = ?', [req.params.id])
    if (exportOrderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Sales export order not found' })
>>>>>>> origin/main
    }

    const itemsResult = await db.query('SELECT * FROM sales_export_order_items WHERE sales_export_order_id = ?', [req.params.id])

    const exportOrder = {
      ...exportOrderResult.rows[0],
      items: itemsResult.rows
    }

    res.json(exportOrder)
  } catch (error) {
<<<<<<< HEAD
    console.error('Error fetching sales export record:', error)
    res.status(500).json({ message: 'Error fetching sales export record' })
  }
})

// POST create new sales export order / invoice
router.post('/', async (req, res) => {
  try {
    await ensureExportColumns();
=======
    console.error('Error fetching sales export order:', error)
    res.status(500).json({ message: 'Error fetching sales export order record' })
  }
})

// POST create new sales export order
router.post('/', async (req, res) => {
  try {
>>>>>>> origin/main
    const { formData, items } = req.body

    // Validation
    if (!formData.date || !formData.billNo || !items || items.length === 0) {
      return res.status(400).json({ message: 'Date, bill number, and at least one item are required' })
    }

<<<<<<< HEAD
    // Filter out rows that don't have a valid description or item name
    const validItems = items.filter(item => {
      const name = item.description || item.itemName || item.item_name;
      return name && String(name).trim() !== '';
    });

    if (validItems.length === 0) {
      return res.status(400).json({ message: 'At least one item with a valid description/name is required.' });
    }

    // Calculate totals
    const totalQty = validItems.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0)
    const totalUsdAmt = validItems.reduce((sum, item) => sum + (parseFloat(item.usd_amt || item.usdAmt) || 0), 0)
    const totalInrAmt = validItems.reduce((sum, item) => sum + (parseFloat(item.inr_amt || item.inrAmt) || 0), 0)
    const isOrderValue = formData.is_order ? 1 : 0;

    // Insert sales export order/invoice
=======
    if (items.some(item => !item.container_no || item.qty <= 0)) {
      return res.status(400).json({ message: 'All items must have container number and positive quantity' })
    }

    // Calculate totals
    const totalQty = items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0)
    const totalUsdAmt = items.reduce((sum, item) => sum + (parseFloat(item.usd_amt) || 0), 0)
    const totalInrAmt = items.reduce((sum, item) => sum + (parseFloat(item.inr_amt) || 0), 0)

    // Insert sales export order
>>>>>>> origin/main
    const exportOrderResult = await db.run(`
      INSERT INTO sales_export_orders (bill_no, date, order_no_dt, dis_port, dest_country, final_destin, sender,
                                      net_wt, advance, exporter, consignee, buyer_other, other_ref, pre_carriage,
                                      vessel_flt_no, consigned_to, gross_wt, sign, place_of_rcpt, loading_port,
                                      origin_country, delivery_terms, payment_terms, pur_transport, driver,
<<<<<<< HEAD
                                      lorry_no, remarks, total_qty, total_usd_amt, total_inr_amt, is_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
=======
                                      lorry_no, remarks, total_qty, total_usd_amt, total_inr_amt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
>>>>>>> origin/main
    `, [formData.billNo, formData.date, formData.orderNoDt, formData.disPort, formData.destCountry,
         formData.finalDestin, formData.sender, formData.netWt, formData.advance, formData.exporter,
         formData.consignee, formData.buyerOther, formData.otherRef, formData.preCarriage,
         formData.vesselFltNo, formData.consignedTo, formData.grossWt, formData.sign,
         formData.placeOfRcpt, formData.loadingPort, formData.originCountry, formData.deliveryTerms,
         formData.paymentTerms, formData.purTransport, formData.driver, formData.lorryNo,
<<<<<<< HEAD
         formData.remarks, totalQty, totalUsdAmt, totalInrAmt, isOrderValue])

    const exportOrderId = exportOrderResult.lastID

    // Insert items and adjust stock if NOT an order
    for (const item of validItems) {
      const containerNo = item.containerNo || item.container_no || '';
      const kindOfPackage = item.kindOfPackage || item.kind_of_package || '';
      const description = item.description || '';
      const qtyInKg = parseFloat(item.qtyInKg || item.qty_in_kg) || 0;
      const mfdExpDt = item.mfdExpDt || item.mfd_exp_dt || '';
      const lotNo = item.lotNo || item.lot_no || '';
      const qty = parseFloat(item.qty) || 0;
      const usdRate = parseFloat(item.usdRate || item.usd_rate) || 0;
      const convRate = parseFloat(item.convRate || item.conv_rate) || 0;
      const usdAmt = parseFloat(item.usdAmt || item.usd_amt) || (qty * usdRate);
      const inrAmt = parseFloat(item.inrAmt || item.inr_amt) || (usdAmt * convRate);

=======
         formData.remarks, totalQty, totalUsdAmt, totalInrAmt])

    const exportOrderId = exportOrderResult.lastID

    // Insert sales export order items
    for (const item of items) {
>>>>>>> origin/main
      await db.run(`
        INSERT INTO sales_export_order_items (sales_export_order_id, container_no, kind_of_package, description,
                                             qty_in_kg, mfd_exp_dt, lot_no, qty, usd_rate, conv_rate, usd_amt, inr_amt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
<<<<<<< HEAD
      `, [exportOrderId, containerNo, kindOfPackage, description, qtyInKg,
           mfdExpDt, lotNo, qty, usdRate, convRate, usdAmt, inrAmt])

      // Deduct from stock only if it is a Sales Export Invoice (not an Order)
      if (isOrderValue === 0) {
        let remainingToDeduct = qty;
        const itemName = description;

        if (lotNo && itemName) {
          // 1. Try exact lot deduction first if lotNo is provided
          const lotResult = await db.query(`
            SELECT id, remaining_quantity 
            FROM stock_lots 
            WHERE item_name = ? AND lot_no = ? AND remaining_quantity > 0
          `, [itemName, lotNo]);

          if (lotResult.rows.length > 0) {
            const lot = lotResult.rows[0];
            const deduct = Math.min(lot.remaining_quantity, remainingToDeduct);
            await db.run(`
              UPDATE stock_lots 
              SET remaining_quantity = MAX(0, remaining_quantity - ?)
              WHERE id = ?
            `, [deduct, lot.id]);
            remainingToDeduct -= deduct;
          }
        }

        // 2. Fallback to FIFO
        if (remainingToDeduct > 0 && itemName) {
          const availableLots = await db.query(`
            SELECT id, remaining_quantity 
            FROM stock_lots 
            WHERE item_name = ? AND remaining_quantity > 0
            ORDER BY created_at ASC
          `, [itemName]);

          for (const lot of availableLots.rows) {
            if (remainingToDeduct <= 0) break;
            const deduct = Math.min(lot.remaining_quantity, remainingToDeduct);
            await db.run(`
              UPDATE stock_lots 
              SET remaining_quantity = MAX(0, remaining_quantity - ?)
              WHERE id = ?
            `, [deduct, lot.id]);
            remainingToDeduct -= deduct;
          }
        }

        // Insert negative stock entry for tracking
        if (itemName) {
          await db.run(`
            INSERT INTO stock (date, item_name, lot_no, qty, rate, type, status)
            VALUES (?, ?, ?, ?, ?, 'Sale Export', 'Active')
          `, [formData.date || new Date().toISOString().split('T')[0], itemName, lotNo || '', -qty, usdRate]);
        }
      }
    }

    res.status(201).json({
      success: true,
      message: isOrderValue === 1 ? 'Sales export order saved successfully!' : 'Export Sales saved successfully!',
      id: exportOrderId
    })
  } catch (error) {
    console.error('Error saving sales export:', error)
    res.status(500).json({ success: false, message: 'Error saving record', error: error.message })
  }
})

// PUT update sales export
router.put('/:id', async (req, res) => {
  try {
    await ensureExportColumns();
=======
      `, [exportOrderId, item.containerNo, item.kindOfPackage, item.description, item.qtyInKg,
           item.mfdExpDt, item.lotNo, item.qty, item.usdRate, item.convRate, item.usdAmt, item.inrAmt])
    }

    res.status(201).json({
      message: 'Sales export order saved successfully!',
      id: exportOrderId
    })
  } catch (error) {
    console.error('Error saving sales export order:', error)
    res.status(500).json({ message: 'Error saving sales export order', error: error.message })
  }
})

// PUT update sales export order
router.put('/:id', async (req, res) => {
  try {
>>>>>>> origin/main
    const { formData, items } = req.body
    const exportOrderId = req.params.id

    // Calculate totals
    const totalQty = items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0)
<<<<<<< HEAD
    const totalUsdAmt = items.reduce((sum, item) => sum + (parseFloat(item.usd_amt || item.usdAmt) || 0), 0)
    const totalInrAmt = items.reduce((sum, item) => sum + (parseFloat(item.inr_amt || item.inrAmt) || 0), 0)
    const isOrderValue = formData.is_order ? 1 : 0;

    // Update sales export main
=======
    const totalUsdAmt = items.reduce((sum, item) => sum + (parseFloat(item.usd_amt) || 0), 0)
    const totalInrAmt = items.reduce((sum, item) => sum + (parseFloat(item.inr_amt) || 0), 0)

    // Update sales export order
>>>>>>> origin/main
    await db.run(`
      UPDATE sales_export_orders SET bill_no = ?, date = ?, order_no_dt = ?, dis_port = ?, dest_country = ?,
                                     final_destin = ?, sender = ?, net_wt = ?, advance = ?, exporter = ?,
                                     consignee = ?, buyer_other = ?, other_ref = ?, pre_carriage = ?,
                                     vessel_flt_no = ?, consigned_to = ?, gross_wt = ?, sign = ?,
                                     place_of_rcpt = ?, loading_port = ?, origin_country = ?,
                                     delivery_terms = ?, payment_terms = ?, pur_transport = ?, driver = ?,
                                     lorry_no = ?, remarks = ?, total_qty = ?, total_usd_amt = ?, total_inr_amt = ?,
<<<<<<< HEAD
                                     is_order = ?, updated_at = CURRENT_TIMESTAMP
=======
                                     updated_at = CURRENT_TIMESTAMP
>>>>>>> origin/main
      WHERE id = ?
    `, [formData.billNo, formData.date, formData.orderNoDt, formData.disPort, formData.destCountry,
         formData.finalDestin, formData.sender, formData.netWt, formData.advance, formData.exporter,
         formData.consignee, formData.buyerOther, formData.otherRef, formData.preCarriage,
         formData.vesselFltNo, formData.consignedTo, formData.grossWt, formData.sign,
         formData.placeOfRcpt, formData.loadingPort, formData.originCountry, formData.deliveryTerms,
         formData.paymentTerms, formData.purTransport, formData.driver, formData.lorryNo,
<<<<<<< HEAD
         formData.remarks, totalQty, totalUsdAmt, totalInrAmt, isOrderValue, exportOrderId])
=======
         formData.remarks, totalQty, totalUsdAmt, totalInrAmt, exportOrderId])
>>>>>>> origin/main

    // Delete existing items
    await db.run('DELETE FROM sales_export_order_items WHERE sales_export_order_id = ?', [exportOrderId])

    // Insert updated items
    for (const item of items) {
<<<<<<< HEAD
      const containerNo = item.containerNo || item.container_no || '';
      const kindOfPackage = item.kindOfPackage || item.kind_of_package || '';
      const description = item.description || '';
      const qtyInKg = parseFloat(item.qtyInKg || item.qty_in_kg) || 0;
      const mfdExpDt = item.mfdExpDt || item.mfd_exp_dt || '';
      const lotNo = item.lotNo || item.lot_no || '';
      const qty = parseFloat(item.qty) || 0;
      const usdRate = parseFloat(item.usdRate || item.usd_rate) || 0;
      const convRate = parseFloat(item.convRate || item.conv_rate) || 0;
      const usdAmt = parseFloat(item.usdAmt || item.usd_amt) || (qty * usdRate);
      const inrAmt = parseFloat(item.inrAmt || item.inr_amt) || (usdAmt * convRate);

=======
>>>>>>> origin/main
      await db.run(`
        INSERT INTO sales_export_order_items (sales_export_order_id, container_no, kind_of_package, description,
                                             qty_in_kg, mfd_exp_dt, lot_no, qty, usd_rate, conv_rate, usd_amt, inr_amt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
<<<<<<< HEAD
      `, [exportOrderId, containerNo, kindOfPackage, description, qtyInKg,
           mfdExpDt, lotNo, qty, usdRate, convRate, usdAmt, inrAmt])
    }

    res.json({ success: true, message: 'Record updated successfully!' })
  } catch (error) {
    console.error('Error updating record:', error)
    res.status(500).json({ success: false, message: 'Error updating record' })
  }
})

// DELETE sales export
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM sales_export_order_items WHERE sales_export_order_id = ?', [req.params.id])
    await db.run('DELETE FROM sales_export_orders WHERE id = ?', [req.params.id])
    res.json({ success: true, message: 'Record deleted successfully' })
  } catch (error) {
    console.error('Error deleting record:', error)
    res.status(500).json({ success: false, message: 'Error deleting record' })
=======
      `, [exportOrderId, item.containerNo, item.kindOfPackage, item.description, item.qtyInKg,
           item.mfdExpDt, item.lotNo, item.qty, item.usdRate, item.convRate, item.usdAmt, item.inrAmt])
    }

    res.json({ message: 'Sales export order updated successfully!' })
  } catch (error) {
    console.error('Error updating sales export order:', error)
    res.status(500).json({ message: 'Error updating sales export order' })
  }
})

// DELETE sales export order
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM sales_export_orders WHERE id = ?', [req.params.id])
    res.json({ message: 'Sales export order deleted successfully' })
  } catch (error) {
    console.error('Error deleting sales export order:', error)
    res.status(500).json({ message: 'Error deleting sales export order' })
>>>>>>> origin/main
  }
})

module.exports = router
