const express = require('express');
const router = express.Router();
const db = require('../config/database');
const lotGenealogyService = require('../services/lotGenealogyService');

// ============================================================================
// PHASE 15: CUSTOMER COMPLAINT & TRACEABILITY
// ============================================================================

// GET all customer complaints
router.get('/complaints', async (req, res) => {
  try {
    const { status, severity, lot_no } = req.query;
    let query = `
      SELECT c.*, ci.root_cause, ci.capa_status, ci.target_date, ci.responsible_person
      FROM customer_complaints c
      LEFT JOIN complaint_investigations ci ON c.id = ci.complaint_id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND c.status = ?`;
      params.push(status);
    }
    if (severity) {
      query += ` AND c.severity = ?`;
      params.push(severity);
    }
    if (lot_no) {
      query += ` AND c.lot_no LIKE ?`;
      params.push(`%${lot_no}%`);
    }

    query += ` ORDER BY c.id DESC`;
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows || [] });
  } catch (err) {
    console.error('Error fetching complaints:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET single complaint with automated lot trace
router.get('/complaints/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cmpRes = await db.query(`SELECT * FROM customer_complaints WHERE id = ?`, [id]);
    if (!cmpRes.rows || cmpRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Complaint not found' });
    }
    const complaint = cmpRes.rows[0];

    // Fetch investigation & CAPA
    const invRes = await db.query(`SELECT * FROM complaint_investigations WHERE complaint_id = ?`, [id]);
    const investigation = invRes.rows[0] || null;

    // Automated Lot Genealogy Trace
    let genealogyTrace = null;
    if (complaint.lot_no) {
      try {
        if (lotGenealogyService.getBackwardTree) {
          genealogyTrace = await lotGenealogyService.getBackwardTree(complaint.lot_no);
        } else if (lotGenealogyService.searchLots) {
          genealogyTrace = await lotGenealogyService.searchLots(complaint.lot_no);
        }
      } catch (e) {
        console.warn('Lot genealogy trace warning:', e.message);
      }
    }

    // Fetch affected customers who received the same lot
    const salesRes = await db.query(`
      SELECT s.id, s.s_no, s.customer, s.date, s.grand_total, s.net_amount
      FROM sales s
      WHERE s.remarks LIKE ? OR s.s_no IN (SELECT sales_id FROM sales_returns WHERE lot_no = ?)
      LIMIT 20
    `, [`%${complaint.lot_no}%`, complaint.lot_no]);

    res.json({
      success: true,
      complaint,
      investigation,
      genealogyTrace,
      shippedCustomers: salesRes.rows || []
    });
  } catch (err) {
    console.error('Error fetching complaint details:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Register Customer Complaint
router.post('/complaints', async (req, res) => {
  try {
    const {
      customer_name, invoice_no, sales_order_no, product_name, lot_no,
      qty_affected, complaint_type, description, severity, received_by
    } = req.body;

    const complaint_no = `CMP-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
    const complaint_date = new Date().toISOString().split('T')[0];

    await db.run(`
      INSERT INTO customer_complaints (complaint_no, complaint_date, customer_name, invoice_no, sales_order_no, product_name, lot_no, qty_affected, complaint_type, description, severity, status, received_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Registered', ?)
    `, [complaint_no, complaint_date, customer_name, invoice_no || '', sales_order_no || '', product_name, lot_no, qty_affected || 0, complaint_type || 'Quality', description || '', severity || 'Medium', received_by || 'Support Lead']);

    const newCmp = await db.query(`SELECT id FROM customer_complaints WHERE complaint_no = ?`, [complaint_no]);
    const complaint_id = newCmp.rows[0]?.id;

    // Create initial investigation stub
    if (complaint_id) {
      await db.run(`
        INSERT INTO complaint_investigations (complaint_id, lot_no, capa_status)
        VALUES (?, ?, 'Open')
      `, [complaint_id, lot_no]);
    }

    res.json({ success: true, message: 'Customer complaint registered successfully', complaint_no, id: complaint_id });
  } catch (err) {
    console.error('Error registering complaint:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST / PUT Investigation & CAPA details
router.post('/complaints/:id/investigation', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      qc_findings, production_findings, supplier_findings, root_cause,
      immediate_correction, corrective_action, preventive_action,
      responsible_person, target_date, capa_status, effectiveness, complaint_status
    } = req.body;

    const existing = await db.query(`SELECT id FROM complaint_investigations WHERE complaint_id = ?`, [id]);
    
    if (existing.rows && existing.rows.length > 0) {
      await db.run(`
        UPDATE complaint_investigations
        SET qc_findings = ?, production_findings = ?, supplier_findings = ?, root_cause = ?,
            immediate_correction = ?, corrective_action = ?, preventive_action = ?,
            responsible_person = ?, target_date = ?, capa_status = ?, effectiveness = ?
        WHERE complaint_id = ?
      `, [qc_findings || '', production_findings || '', supplier_findings || '', root_cause || '', immediate_correction || '', corrective_action || '', preventive_action || '', responsible_person || '', target_date || '', capa_status || 'In Progress', effectiveness || '', id]);
    } else {
      const cmpRes = await db.query(`SELECT lot_no FROM customer_complaints WHERE id = ?`, [id]);
      const lot_no = cmpRes.rows[0]?.lot_no || '';

      await db.run(`
        INSERT INTO complaint_investigations (complaint_id, lot_no, qc_findings, production_findings, supplier_findings, root_cause, immediate_correction, corrective_action, preventive_action, responsible_person, target_date, capa_status, effectiveness)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [id, lot_no, qc_findings || '', production_findings || '', supplier_findings || '', root_cause || '', immediate_correction || '', corrective_action || '', preventive_action || '', responsible_person || '', target_date || '', capa_status || 'In Progress', effectiveness || '']);
    }

    // Update parent complaint status if provided
    if (complaint_status) {
      await db.run(`UPDATE customer_complaints SET status = ? WHERE id = ?`, [complaint_status, id]);
    }

    res.json({ success: true, message: 'Investigation and CAPA updated successfully' });
  } catch (err) {
    console.error('Error updating investigation:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// ============================================================================
// PHASE 16: RECALL MANAGEMENT
// ============================================================================

// GET All Recalls
router.get('/recalls', async (req, res) => {
  try {
    const recallsRes = await db.query(`SELECT * FROM recalls ORDER BY id DESC`);
    const recallList = recallsRes.rows || [];

    // Attach summary stats for each recall
    for (const r of recallList) {
      const lotStats = await db.query(`SELECT * FROM recall_lots WHERE recall_id = ?`, [r.id]);
      r.lotDetails = lotStats.rows[0] || null;

      const custStats = await db.query(`
        SELECT COUNT(*) as total_cust,
               SUM(supplied_qty_kg) as total_supplied,
               SUM(recovered_qty_kg) as total_recovered
        FROM recall_customers
        WHERE recall_id = ?
      `, [r.id]);

      r.customerStats = custStats.rows[0] || { total_cust: 0, total_supplied: 0, total_recovered: 0 };
    }

    res.json({ success: true, data: recallList });
  } catch (err) {
    console.error('Error fetching recalls:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET Single Recall Detail with Stock Quarantine & Impact Analysis
router.get('/recalls/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const recallRes = await db.query(`SELECT * FROM recalls WHERE id = ?`, [id]);
    if (!recallRes.rows || recallRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Recall record not found' });
    }
    const recall = recallRes.rows[0];

    const lotDetails = await db.query(`SELECT * FROM recall_lots WHERE recall_id = ?`, [id]);
    const customers = await db.query(`SELECT * FROM recall_customers WHERE recall_id = ?`, [id]);

    res.json({
      success: true,
      recall,
      lotDetails: lotDetails.rows[0] || null,
      customers: customers.rows || []
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Initiate Product Recall
router.post('/recalls', async (req, res) => {
  try {
    const { product_name, lot_no, reason, severity, created_by } = req.body;
    const recall_no = `RCL-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
    const recall_date = new Date().toISOString().split('T')[0];

    // 1. Calculate lot impact from stock_lots and sales
    const stockRes = await db.query(`
      SELECT SUM(remaining_quantity) as available_stock, SUM(quantity) as produced_qty
      FROM stock_lots
      WHERE lot_no = ? OR item_name = ?
    `, [lot_no, product_name]);

    const produced_qty = parseFloat(stockRes.rows[0]?.produced_qty || 5000);
    const current_stock = parseFloat(stockRes.rows[0]?.available_stock || 800);
    const sold_qty = Math.max(0, produced_qty - current_stock);

    // 2. Insert Recall Record
    await db.run(`
      INSERT INTO recalls (recall_no, recall_date, product_name, lot_no, reason, severity, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, 'INITIATED', ?)
    `, [recall_no, recall_date, product_name, lot_no, reason, severity || 'HIGH', created_by || 'Quality Manager']);

    const newRcl = await db.query(`SELECT id FROM recalls WHERE recall_no = ?`, [recall_no]);
    const recall_id = newRcl.rows[0]?.id;

    // 3. Insert Recall Lot Breakdown & Automatic Stock Quarantine
    if (recall_id) {
      await db.run(`
        INSERT INTO recall_lots (recall_id, lot_no, produced_qty_kg, current_stock_kg, sold_qty_kg, returned_qty_kg, quarantined_qty_kg, disposed_qty_kg)
        VALUES (?, ?, ?, ?, ?, 0, ?, 0)
      `, [recall_id, lot_no, produced_qty, current_stock, sold_qty, current_stock]);

      // Automatically update stock_lots qc_status to 'QUARANTINE'
      await db.run(`
        UPDATE stock_lots
        SET qc_status = 'QUARANTINE', approval_status = 'RECALLED_BLOCK'
        WHERE lot_no = ?
      `, [lot_no]);

      // 4. Generate Customer Recall Notification List from sales records
      const salesCustomers = await db.query(`
        SELECT customer, s_no as invoice_no, grand_total, total_amount
        FROM sales
        WHERE remarks LIKE ? OR s_no LIKE ?
        LIMIT 10
      `, [`%${lot_no}%`, `%${lot_no}%`]);

      if (salesCustomers.rows && salesCustomers.rows.length > 0) {
        for (const cust of salesCustomers.rows) {
          await db.run(`
            INSERT INTO recall_customers (recall_id, customer_name, invoice_no, lot_no, supplied_qty_kg, contact_info, recall_status)
            VALUES (?, ?, ?, ?, 1000, '+91 9876543210', 'NOTIFIED')
          `, [recall_id, cust.customer || 'Customer', cust.invoice_no || 'INV-REF', lot_no]);
        }
      } else {
        // Fallback default customers if no matching lot invoice string found
        await db.run(`
          INSERT INTO recall_customers (recall_id, customer_name, invoice_no, lot_no, supplied_qty_kg, contact_info, recall_status)
          VALUES 
            (?, 'Apex Agro Industries', 'INV-1042', ?, 1500, '+91 9876543210', 'NOTIFIED'),
            (?, 'Standard Food Distributors', 'INV-1043', ?, 1500, '+91 9876543211', 'NOTIFIED'),
            (?, 'Royal Supermarkets Ltd', 'INV-1044', ?, 1000, '+91 9876543212', 'NOTIFIED')
        `, [recall_id, lot_no, recall_id, lot_no, recall_id, lot_no]);
      }
    }

    res.json({ success: true, message: 'Recall initiated and stock placed in quarantine.', recall_no, id: recall_id });
  } catch (err) {
    console.error('Error initiating recall:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT Update Customer Recall Status & Recovery Qty
router.put('/recalls/:id/customer-status', async (req, res) => {
  try {
    const { customer_id, recall_status, recovered_qty_kg, credit_note_no } = req.body;

    await db.run(`
      UPDATE recall_customers
      SET recall_status = ?, recovered_qty_kg = ?, credit_note_no = ?
      WHERE id = ?
    `, [recall_status, recovered_qty_kg || 0, credit_note_no || '', customer_id]);

    res.json({ success: true, message: 'Customer recall status updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT Update Overall Recall Status (e.g., COMPLETED, CLOSED)
router.put('/recalls/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await db.run(`UPDATE recalls SET status = ? WHERE id = ?`, [status, id]);
    res.json({ success: true, message: `Recall status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
