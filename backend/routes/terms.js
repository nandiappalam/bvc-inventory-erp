const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET all terms (with optional filtering)
router.get('/', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const { category, status, search } = req.query;

    let sql = 'SELECT * FROM terms_master WHERE 1=1';
    const params = [];

    if (category) {
      sql += ' AND LOWER(category) = LOWER(?)';
      params.push(category);
    }
    if (status) {
      sql += ' AND LOWER(status) = LOWER(?)';
      params.push(status);
    }
    if (search) {
      sql += ' AND (LOWER(name) LIKE LOWER(?) OR LOWER(term_code) LIKE LOWER(?) OR LOWER(category) LIKE LOWER(?) OR LOWER(description) LIKE LOWER(?))';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    sql += ' ORDER BY id ASC';

    const result = await db.query(sql, params, activeCompanyId);
    const list = result.rows || [];

    // Return in standard formats
    if (req.query.format === 'object' || req.headers['x-requested-format'] === 'object') {
      res.json({ success: true, data: list });
    } else {
      res.json(list);
    }
  } catch (err) {
    console.error('Error fetching terms:', err);
    res.status(500).json({ success: false, message: 'Error fetching terms', error: err.message });
  }
});

// GET next term code (e.g. TRM-005)
router.get('/next-code', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const result = await db.query('SELECT term_code FROM terms_master ORDER BY id DESC LIMIT 1', [], activeCompanyId);
    let lastNum = 0;
    if (result.rows && result.rows.length > 0) {
      const match = String(result.rows[0].term_code || '').match(/\d+/);
      if (match) lastNum = parseInt(match[0], 10);
    }
    const nextCode = `TRM-${String(lastNum + 1).padStart(3, '0')}`;
    res.json({ success: true, term_code: nextCode, next_code: nextCode });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single term by ID
router.get('/:id', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const { id } = req.params;
    const result = await db.query(
      'SELECT * FROM terms_master WHERE id = ? OR term_code = ?',
      [id, id],
      activeCompanyId
    );
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Term not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error fetching term:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST create term
router.post('/', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const body = req.body || {};

    const name = (body.name || body.term_name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: 'Term Name is required' });
    }

    let termCode = (body.term_code || '').trim();
    if (!termCode) {
      const last = await db.query('SELECT term_code FROM terms_master ORDER BY id DESC LIMIT 1', [], activeCompanyId);
      let lastNum = 0;
      if (last.rows && last.rows.length > 0) {
        const match = String(last.rows[0].term_code || '').match(/\d+/);
        if (match) lastNum = parseInt(match[0], 10);
      }
      termCode = `TRM-${String(lastNum + 1).padStart(3, '0')}`;
    }

    // Check duplicate code or name
    const dupCheck = await db.query(
      'SELECT id FROM terms_master WHERE (LOWER(term_code) = LOWER(?) OR LOWER(name) = LOWER(?))',
      [termCode, name],
      activeCompanyId
    );
    if (dupCheck.rows && dupCheck.rows.length > 0) {
      return res.status(400).json({ success: false, message: `Term with code '${termCode}' or name '${name}' already exists` });
    }

    const category = body.category || 'Payment Terms';
    const term_type = body.term_type || 'Commercial';
    const description = body.description || null;
    const credit_days = parseInt(body.credit_days, 10) || 0;
    const due_days = parseInt(body.due_days, 10) || 0;
    const payment_terms = body.payment_terms || null;
    const delivery_terms = body.delivery_terms || null;
    const storage_terms = body.storage_terms || null;
    const business_conditions = body.business_conditions || null;
    const remarks = body.remarks || null;
    const status = body.status || 'Active';

    const insertRes = await db.run(`
      INSERT INTO terms_master (
        term_code, name, term_name, category, term_type, description,
        credit_days, due_days, payment_terms, delivery_terms, storage_terms,
        business_conditions, remarks, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      termCode, name, name, category, term_type, description,
      credit_days, due_days, payment_terms, delivery_terms, storage_terms,
      business_conditions, remarks, status
    ], activeCompanyId);

    const newId = insertRes.lastID || insertRes.lastInsertRowid || insertRes.rows?.[0]?.id;

    res.status(201).json({
      success: true,
      id: newId,
      message: 'Term created successfully',
      data: {
        id: newId,
        term_code: termCode,
        name,
        term_name: name,
        category,
        term_type,
        credit_days,
        due_days,
        status
      }
    });
  } catch (err) {
    console.error('Error creating term:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update term
router.put('/:id', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const { id } = req.params;
    const body = req.body || {};

    const name = (body.name || body.term_name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: 'Term Name is required' });
    }

    const existing = await db.query('SELECT id, term_code FROM terms_master WHERE id = ?', [id], activeCompanyId);
    if (!existing.rows?.length) {
      return res.status(404).json({ success: false, message: 'Term not found' });
    }
    const termCode = (body.term_code || existing.rows[0].term_code || '').trim();
    const duplicate = await db.query(
      'SELECT id FROM terms_master WHERE id <> ? AND (LOWER(term_code) = LOWER(?) OR LOWER(name) = LOWER(?)) LIMIT 1',
      [id, termCode, name],
      activeCompanyId
    );
    if (duplicate.rows?.length) {
      return res.status(409).json({ success: false, message: `Term with code '${termCode}' or name '${name}' already exists` });
    }
    const category = body.category || 'Payment Terms';
    const term_type = body.term_type || 'Commercial';
    const description = body.description || null;
    const credit_days = parseInt(body.credit_days, 10) || 0;
    const due_days = parseInt(body.due_days, 10) || 0;
    const payment_terms = body.payment_terms || null;
    const delivery_terms = body.delivery_terms || null;
    const storage_terms = body.storage_terms || null;
    const business_conditions = body.business_conditions || null;
    const remarks = body.remarks || null;
    const status = body.status || 'Active';

    const updateResult = await db.run(`
      UPDATE terms_master SET
        term_code = COALESCE(?, term_code),
        name = ?,
        term_name = ?,
        category = ?,
        term_type = ?,
        description = ?,
        credit_days = ?,
        due_days = ?,
        payment_terms = ?,
        delivery_terms = ?,
        storage_terms = ?,
        business_conditions = ?,
        remarks = ?,
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      termCode || null, name, name, category, term_type, description,
      credit_days, due_days, payment_terms, delivery_terms, storage_terms,
      business_conditions, remarks, status,
      id
    ], activeCompanyId);

    if (updateResult.changes === 0) {
      return res.status(404).json({ success: false, message: 'Term not found' });
    }
    res.json({ success: true, message: 'Term updated successfully' });
  } catch (err) {
    console.error('Error updating term:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE / Deactivate term
router.delete('/:id', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const { id } = req.params;
    const result = await db.run(
      "UPDATE terms_master SET status = 'Inactive', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [id],
      activeCompanyId
    );
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Term not found' });
    }
    res.json({ success: true, message: 'Term deactivated successfully' });
  } catch (err) {
    console.error('Error deleting term:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
