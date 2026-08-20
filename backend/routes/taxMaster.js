const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { calculateLineTax, calculateInvoiceTax, round2 } = require('../services/taxEngine');

// ============================================================================
// TAX MASTER TABLE CREATION & AUTO-SEED
// ============================================================================
const initTaxMasterTable = async () => {
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS tax_master (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tax_name TEXT NOT NULL,
        hsn_code TEXT NOT NULL,
        tax_type TEXT DEFAULT 'Taxable',
        description TEXT,
        gst_rate REAL DEFAULT 0,
        cgst_rate REAL DEFAULT 0,
        sgst_rate REAL DEFAULT 0,
        igst_rate REAL DEFAULT 0,
        cess_rate REAL DEFAULT 0,
        calc_type TEXT DEFAULT 'Exclusive',
        effective_from TEXT,
        effective_to TEXT,
        status TEXT DEFAULT 'Active',
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed default Indian Food Factory GST configurations if empty
    const countRes = await db.query('SELECT COUNT(*) as cnt FROM tax_master');
    if (!countRes.rows[0]?.cnt) {
      console.log('🌱 Seeding default Indian Food Factory Tax Master records...');
      const defaultTaxes = [
        {
          tax_name: 'Urad & Pulses (5% Pre-packaged)',
          hsn_code: '0713',
          tax_type: 'Taxable',
          description: 'Dried leguminous vegetables, urad dal, moong, chana pre-packaged & labelled',
          gst_rate: 5,
          cgst_rate: 2.5,
          sgst_rate: 2.5,
          igst_rate: 5,
          cess_rate: 0,
          calc_type: 'Exclusive',
          status: 'Active',
          remarks: 'CBIC standard rate for pre-packaged & labelled pulses'
        },
        {
          tax_name: 'Urad & Pulses (Nil Rated / Non-Packaged)',
          hsn_code: '0713',
          tax_type: 'Nil Rated',
          description: 'Urad dal, pulses other than pre-packaged and labelled',
          gst_rate: 0,
          cgst_rate: 0,
          sgst_rate: 0,
          igst_rate: 0,
          cess_rate: 0,
          calc_type: 'Exclusive',
          status: 'Active',
          remarks: 'Nil GST under CBIC classification'
        },
        {
          tax_name: 'Wheat Flour / Maida / Atta (5%)',
          hsn_code: '1101',
          tax_type: 'Taxable',
          description: 'Wheat flour, maida, atta pre-packaged and labelled',
          gst_rate: 5,
          cgst_rate: 2.5,
          sgst_rate: 2.5,
          igst_rate: 5,
          cess_rate: 0,
          calc_type: 'Exclusive',
          status: 'Active',
          remarks: '5% GST for pre-packaged flour'
        },
        {
          tax_name: 'Cereal / Rice Flour (5%)',
          hsn_code: '1102',
          tax_type: 'Taxable',
          description: 'Cereal flours other than wheat or meslin (e.g. rice flour)',
          gst_rate: 5,
          cgst_rate: 2.5,
          sgst_rate: 2.5,
          igst_rate: 5,
          cess_rate: 0,
          calc_type: 'Exclusive',
          status: 'Active',
          remarks: '5% GST'
        },
        {
          tax_name: 'Urad Flour / Pulse Flour (5%)',
          hsn_code: '1106',
          tax_type: 'Taxable',
          description: 'Flour, meal and powder of dried leguminous vegetables / pulses',
          gst_rate: 5,
          cgst_rate: 2.5,
          sgst_rate: 2.5,
          igst_rate: 5,
          cess_rate: 0,
          calc_type: 'Exclusive',
          status: 'Active',
          remarks: 'Urad flour manufactured in mill'
        },
        {
          tax_name: 'Papad (Nil / 0% Exempt)',
          hsn_code: '1905',
          tax_type: 'Nil Rated',
          description: 'Papad by whatever name called',
          gst_rate: 0,
          cgst_rate: 0,
          sgst_rate: 0,
          igst_rate: 0,
          cess_rate: 0,
          calc_type: 'Exclusive',
          status: 'Active',
          remarks: 'CBIC 0% GST classification for papad'
        },
        {
          tax_name: 'Spices & Masala (5%)',
          hsn_code: '0910',
          tax_type: 'Taxable',
          description: 'Ginger, saffron, turmeric, thyme, bay leaves, curry and other spices',
          gst_rate: 5,
          cgst_rate: 2.5,
          sgst_rate: 2.5,
          igst_rate: 5,
          cess_rate: 0,
          calc_type: 'Exclusive',
          status: 'Active',
          remarks: 'Spices 5%'
        },
        {
          tax_name: 'Pepper / Chilli Whole (5%)',
          hsn_code: '0904',
          tax_type: 'Taxable',
          description: 'Pepper of the genus Piper; dried or crushed or ground fruits',
          gst_rate: 5,
          cgst_rate: 2.5,
          sgst_rate: 2.5,
          igst_rate: 5,
          cess_rate: 0,
          calc_type: 'Exclusive',
          status: 'Active',
          remarks: '5% GST'
        },
        {
          tax_name: 'Packing Pouches & Films (18%)',
          hsn_code: '3923',
          tax_type: 'Taxable',
          description: 'Articles for the conveyance or packing of goods, of plastics',
          gst_rate: 18,
          cgst_rate: 9,
          sgst_rate: 9,
          igst_rate: 18,
          cess_rate: 0,
          calc_type: 'Exclusive',
          status: 'Active',
          remarks: 'Plastic packing materials'
        },
        {
          tax_name: 'Corrugated Cartons / Boxes (12%)',
          hsn_code: '4819',
          tax_type: 'Taxable',
          description: 'Cartons, boxes and cases, of corrugated paper or paperboard',
          gst_rate: 12,
          cgst_rate: 6,
          sgst_rate: 6,
          igst_rate: 12,
          cess_rate: 0,
          calc_type: 'Exclusive',
          status: 'Active',
          remarks: 'Packing corrugated boxes'
        },
        {
          tax_name: 'Standard GST 18%',
          hsn_code: '9999',
          tax_type: 'Taxable',
          description: 'General taxable rate for commercial items and services',
          gst_rate: 18,
          cgst_rate: 9,
          sgst_rate: 9,
          igst_rate: 18,
          cess_rate: 0,
          calc_type: 'Exclusive',
          status: 'Active',
          remarks: 'General GST 18%'
        },
        {
          tax_name: 'Exempt Goods (0%)',
          hsn_code: '0000',
          tax_type: 'Exempt',
          description: 'Goods completely exempt from GST under notifications',
          gst_rate: 0,
          cgst_rate: 0,
          sgst_rate: 0,
          igst_rate: 0,
          cess_rate: 0,
          calc_type: 'Exclusive',
          status: 'Active',
          remarks: 'Exempt'
        },
        {
          tax_name: 'Zero Rated / SEZ Supplies (0%)',
          hsn_code: '0001',
          tax_type: 'Zero Rated',
          description: 'Exports of goods/services or supplies to SEZ developer/unit',
          gst_rate: 0,
          cgst_rate: 0,
          sgst_rate: 0,
          igst_rate: 0,
          cess_rate: 0,
          calc_type: 'Exclusive',
          status: 'Active',
          remarks: 'Zero Rated Export/SEZ'
        },
        {
          tax_name: 'Non-GST Goods (0%)',
          hsn_code: '0002',
          tax_type: 'Non-GST',
          description: 'Supplies outside the purview of GST Act',
          gst_rate: 0,
          cgst_rate: 0,
          sgst_rate: 0,
          igst_rate: 0,
          cess_rate: 0,
          calc_type: 'Exclusive',
          status: 'Active',
          remarks: 'Non-GST'
        }
      ];

      for (const t of defaultTaxes) {
        await db.run(`
          INSERT INTO tax_master (
            tax_name, hsn_code, tax_type, description, gst_rate, cgst_rate, sgst_rate, igst_rate, 
            cess_rate, calc_type, status, remarks
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          t.tax_name, t.hsn_code, t.tax_type, t.description, t.gst_rate, t.cgst_rate, t.sgst_rate, t.igst_rate,
          t.cess_rate, t.calc_type, t.status, t.remarks
        ]);
      }
      console.log('✓ Successfully seeded default Tax Master records');
    }
  } catch (err) {
    console.error('Error initializing tax_master table:', err);
  }
};

// Initialize on module load
initTaxMasterTable();

// ============================================================================
// API ROUTES
// ============================================================================

// GET all tax configurations
router.get('/', async (req, res) => {
  try {
    const { status, tax_type, search } = req.query;
    let query = 'SELECT * FROM tax_master WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }
    if (tax_type) {
      query += ' AND tax_type = ?';
      params.push(tax_type);
    }
    if (search) {
      query += ' AND (tax_name LIKE ? OR hsn_code LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY tax_type ASC, gst_rate ASC, tax_name ASC';

    const result = await db.query(query, params);
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching tax configurations:', error);
    res.status(500).json({ success: false, message: 'Error fetching tax configurations', error: error.message });
  }
});

// GET single tax configuration by ID
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM tax_master WHERE id = ?', [req.params.id]);
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tax configuration not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching tax configuration by ID:', error);
    res.status(500).json({ success: false, message: 'Error fetching tax configuration', error: error.message });
  }
});

// POST create new tax configuration
router.post('/', async (req, res) => {
  try {
    const {
      tax_name,
      hsn_code,
      tax_type = 'Taxable',
      description = '',
      gst_rate = 0,
      cess_rate = 0,
      calc_type = 'Exclusive',
      effective_from = null,
      effective_to = null,
      status = 'Active',
      remarks = ''
    } = req.body;

    if (!tax_name || !hsn_code) {
      return res.status(400).json({ success: false, message: 'Tax Name and HSN Code are required' });
    }

    const rate = parseFloat(gst_rate) || 0;
    const cess = parseFloat(cess_rate) || 0;
    const cgst = round2(rate / 2);
    const sgst = round2(rate / 2);
    const igst = rate;

    const result = await db.run(`
      INSERT INTO tax_master (
        tax_name, hsn_code, tax_type, description, gst_rate, cgst_rate, sgst_rate, igst_rate,
        cess_rate, calc_type, effective_from, effective_to, status, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tax_name.trim(),
      hsn_code.trim(),
      tax_type,
      description,
      rate,
      cgst,
      sgst,
      igst,
      cess,
      calc_type,
      effective_from,
      effective_to,
      status,
      remarks
    ]);

    const created = await db.query('SELECT * FROM tax_master WHERE id = ?', [result.lastID]);

    res.status(201).json({
      success: true,
      message: 'Tax configuration created successfully',
      data: created.rows[0]
    });
  } catch (error) {
    console.error('Error creating tax configuration:', error);
    res.status(500).json({ success: false, message: 'Error creating tax configuration', error: error.message });
  }
});

// PUT update tax configuration
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      tax_name,
      hsn_code,
      tax_type,
      description,
      gst_rate,
      cess_rate,
      calc_type,
      effective_from,
      effective_to,
      status,
      remarks
    } = req.body;

    const existing = await db.query('SELECT * FROM tax_master WHERE id = ?', [id]);
    if (!existing.rows || existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tax configuration not found' });
    }

    const current = existing.rows[0];
    const rate = gst_rate !== undefined ? (parseFloat(gst_rate) || 0) : current.gst_rate;
    const cess = cess_rate !== undefined ? (parseFloat(cess_rate) || 0) : current.cess_rate;
    const cgst = round2(rate / 2);
    const sgst = round2(rate / 2);
    const igst = rate;

    await db.run(`
      UPDATE tax_master SET
        tax_name = ?,
        hsn_code = ?,
        tax_type = ?,
        description = ?,
        gst_rate = ?,
        cgst_rate = ?,
        sgst_rate = ?,
        igst_rate = ?,
        cess_rate = ?,
        calc_type = ?,
        effective_from = ?,
        effective_to = ?,
        status = ?,
        remarks = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      tax_name !== undefined ? tax_name.trim() : current.tax_name,
      hsn_code !== undefined ? hsn_code.trim() : current.hsn_code,
      tax_type || current.tax_type,
      description !== undefined ? description : current.description,
      rate,
      cgst,
      sgst,
      igst,
      cess,
      calc_type || current.calc_type,
      effective_from !== undefined ? effective_from : current.effective_from,
      effective_to !== undefined ? effective_to : current.effective_to,
      status || current.status,
      remarks !== undefined ? remarks : current.remarks,
      id
    ]);

    const updated = await db.query('SELECT * FROM tax_master WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Tax configuration updated successfully',
      data: updated.rows[0]
    });
  } catch (error) {
    console.error('Error updating tax configuration:', error);
    res.status(500).json({ success: false, message: 'Error updating tax configuration', error: error.message });
  }
});

// POST toggle activate / deactivate
router.post('/:id/activate', async (req, res) => {
  try {
    await db.run('UPDATE tax_master SET status = "Active", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Tax configuration activated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/deactivate', async (req, res) => {
  try {
    await db.run('UPDATE tax_master SET status = "Inactive", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Tax configuration deactivated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST calculate tax preview (central calculation endpoint)
router.post('/calculate', async (req, res) => {
  try {
    const payload = req.body;
    if (Array.isArray(payload.items)) {
      const invoiceCalc = calculateInvoiceTax(payload);
      return res.json({ success: true, data: invoiceCalc });
    } else {
      const lineCalc = calculateLineTax(payload);
      return res.json({ success: true, data: lineCalc });
    }
  } catch (error) {
    console.error('Tax calculation error:', error);
    res.status(500).json({ success: false, message: 'Calculation failed', error: error.message });
  }
});

// POST validate tax configuration
router.post('/validate', async (req, res) => {
  try {
    const { tax_type, gst_rate, hsn_code } = req.body;
    const errors = [];

    if (!hsn_code) errors.push('HSN Code is required');
    if (!['Taxable', 'Exempt', 'Nil Rated', 'Zero Rated', 'Non-GST'].includes(tax_type)) {
      errors.push('Invalid Tax Type classification');
    }
    if (tax_type === 'Taxable' && (gst_rate === undefined || gst_rate === null || parseFloat(gst_rate) < 0)) {
      errors.push('Valid GST Rate is required for Taxable items');
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, valid: false, errors });
    }

    res.json({ success: true, valid: true, message: 'Tax configuration is valid' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET resolve tax config by Item ID or HSN
router.get('/resolve/item/:itemId', async (req, res) => {
  try {
    const itemRes = await db.query('SELECT * FROM item_master WHERE id = ?', [req.params.itemId]);
    if (!itemRes.rows || itemRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    const item = itemRes.rows[0];
    let taxConfig = null;

    if (item.tax_master_id) {
      const taxRes = await db.query('SELECT * FROM tax_master WHERE id = ?', [item.tax_master_id]);
      if (taxRes.rows?.length > 0) {
        taxConfig = taxRes.rows[0];
      }
    }

    if (!taxConfig && item.hsn_code) {
      const taxRes = await db.query('SELECT * FROM tax_master WHERE hsn_code = ? AND status = "Active" ORDER BY id ASC LIMIT 1', [item.hsn_code]);
      if (taxRes.rows?.length > 0) {
        taxConfig = taxRes.rows[0];
      }
    }

    res.json({
      success: true,
      data: {
        item_id: item.id,
        item_name: item.item_name,
        hsn_code: taxConfig?.hsn_code || item.hsn_code || '',
        tax_type: taxConfig?.tax_type || item.tax_type || 'Taxable',
        gst_rate: taxConfig?.gst_rate !== undefined ? taxConfig.gst_rate : (item.tax || 5),
        cgst_rate: taxConfig?.cgst_rate !== undefined ? taxConfig.cgst_rate : round2((item.tax || 5) / 2),
        sgst_rate: taxConfig?.sgst_rate !== undefined ? taxConfig.sgst_rate : round2((item.tax || 5) / 2),
        igst_rate: taxConfig?.igst_rate !== undefined ? taxConfig.igst_rate : (item.tax || 5),
        tax_master: taxConfig
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET GST register reports data (for Purchase and Sales)
router.get('/reports/gst-summary', async (req, res) => {
  try {
    const { from_date, to_date, type = 'sales' } = req.query;
    const isSales = type === 'sales';
    const tableName = isSales ? 'sales' : 'purchases';
    const itemsTable = isSales ? 'sales_items' : 'purchase_items';
    const foreignKey = isSales ? 'sales_id' : 'purchase_id';

    let dateFilter = '';
    const params = [];
    if (from_date && to_date) {
      dateFilter = ' AND m.date BETWEEN ? AND ?';
      params.push(from_date, to_date);
    }

    const query = `
      SELECT 
        m.id,
        m.s_no,
        m.date,
        m.${isSales ? 'customer' : 'supplier'} as party_name,
        COALESCE(m.tax_type, 'Exclusive') as tax_mode,
        COALESCE(m.cgst_amount, 0) as cgst_amount,
        COALESCE(m.sgst_amount, 0) as sgst_amount,
        COALESCE(m.igst_amount, 0) as igst_amount,
        COALESCE(m.cess_amount, 0) as cess_amount,
        COALESCE(m.tax_amount, 0) as tax_amount,
        COALESCE(m.base_amount, 0) as taxable_amount,
        COALESCE(m.grand_total, m.total_amt, 0) as grand_total,
        i.item_name,
        COALESCE(i.hsn_code, '') as hsn_code,
        COALESCE(i.tax_type, 'Taxable') as item_tax_type,
        COALESCE(i.gst_rate, i.tax_percent, i.tax_perc, 5) as gst_rate,
        COALESCE(i.qty, 0) as qty,
        COALESCE(i.rate, 0) as rate,
        COALESCE(i.amount, i.total_amt, 0) as item_amount
      FROM ${tableName} m
      LEFT JOIN ${itemsTable} i ON i.${foreignKey} = m.id
      WHERE 1=1 ${dateFilter}
      ORDER BY m.date DESC, m.id DESC
    `;

    const result = await db.query(query, params);
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    console.error('Error fetching GST summary report:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch GST report data', error: error.message });
  }
});

module.exports = router;
