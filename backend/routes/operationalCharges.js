const express = require('express');
const router = express.Router();
const db = require('../config/database');
const {
  ensureOperationalTables,
  recordOperationalCharge,
  recordOperationalPayment,
  resolveOperationalLedgers
} = require('../services/operationalChargeEngine');

// Helper for multi-tenant prefix
function getPrefix(companyId) {
  return (companyId && companyId > 1) ? `c${companyId}_` : '';
}

// Middleware to ensure company isolation and tables
router.use(async (req, res, next) => {
  try {
    const companyId = parseInt(req.headers['x-company-id'] || req.query.company_id || req.body?.company_id || 1, 10);
    req.companyId = companyId;
    await ensureOperationalTables(companyId);
    next();
  } catch (err) {
    console.error('Error ensuring operational tables:', err);
    next();
  }
});

// -----------------------------------------------------------------------------
// 1. DASHBOARD & SUMMARY METRICS
// -----------------------------------------------------------------------------
const handleSummary = async (req, res) => {
  try {
    const pfx = getPrefix(req.companyId);
    const summary = await db.get(`
      SELECT
        COUNT(id) as total_charges,
        COALESCE(SUM(final_amount), 0) as total_amount,
        COALESCE(SUM(paid_amount), 0) as total_paid,
        COALESCE(SUM(balance_amount), 0) as total_payable,
        COUNT(CASE WHEN payment_status = 'UNPAID' THEN 1 END) as unpaid_count,
        COUNT(CASE WHEN payment_status = 'PARTIAL' THEN 1 END) as partial_count,
        COUNT(CASE WHEN payment_status = 'PAID' THEN 1 END) as paid_count
      FROM ${pfx}operational_charges
    `);

    const byModule = await db.all(`
      SELECT source_module, COUNT(id) as count, COALESCE(SUM(final_amount), 0) as total_amount
      FROM ${pfx}operational_charges
      GROUP BY source_module
    `);

    const byCategory = await db.all(`
      SELECT charge_category, COUNT(id) as count, COALESCE(SUM(final_amount), 0) as total_amount
      FROM ${pfx}operational_charges
      GROUP BY charge_category
    `);

    const stats = {
      totalCharges: summary?.total_charges || 0,
      totalAmount: summary?.total_amount || 0,
      totalPaid: summary?.total_paid || 0,
      totalPayable: summary?.total_payable || 0,
      unpaidCount: summary?.unpaid_count || 0,
      partialCount: summary?.partial_count || 0,
      paidCount: summary?.paid_count || 0
    };

    res.json({
      success: true,
      stats,
      data: {
        summary: summary || {},
        byModule: byModule || [],
        byCategory: byCategory || []
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

router.get('/metrics', handleSummary);
router.get('/summary', handleSummary);

// -----------------------------------------------------------------------------
// 2. OPERATIONAL PARTIES (WORKERS / DRIVERS / LOADMEN / TRANSPORTERS)
// -----------------------------------------------------------------------------
router.get('/parties', async (req, res) => {
  try {
    const pfx = getPrefix(req.companyId);
    const { category, search, activeOnly } = req.query;
    let sql = `
      SELECT p.*,
        COALESCE((SELECT SUM(c.balance_amount) FROM ${pfx}operational_charges c WHERE c.party_id = p.id), 0) as outstanding_balance,
        COALESCE((SELECT COUNT(c.id) FROM ${pfx}operational_charges c WHERE c.party_id = p.id), 0) as total_trips_or_jobs
      FROM ${pfx}operational_parties p
      WHERE 1=1
    `;
    const params = [];

    if (category) {
      sql += ' AND (p.category = ? OR p.party_category = ?)';
      params.push(category, category);
    }
    if (activeOnly === 'true') {
      sql += ' AND p.is_active = 1';
    }
    if (search) {
      sql += ' AND (p.name LIKE ? OR p.phone LIKE ? OR p.party_code LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY p.name ASC';
    const parties = await db.all(sql, params) || [];

    // Also include transporters from transport_master if not already present
    const seenNames = new Set(parties.map(p => (p.name || '').toLowerCase().trim()));
    try {
      const tmRows = await db.query('SELECT * FROM transport_master', []);
      for (const t of tmRows.rows || []) {
        const tName = (t.name || '').trim();
        if (tName && !seenNames.has(tName.toLowerCase())) {
          seenNames.add(tName.toLowerCase());
          parties.push({
            id: `TM_${t.id}`,
            party_code: `TRP-${String(t.id).padStart(3, '0')}`,
            name: tName,
            category: 'TRANSPORTER',
            party_category: 'TRANSPORTER',
            phone: t.contact_no || t.phone || '',
            payment_mode: 'CASH',
            is_active: 1,
            outstanding_balance: 0,
            total_trips_or_jobs: 0
          });
        }
      }
    } catch (e) {
      console.warn('Transport master fetch in /parties:', e.message);
    }

    res.json({ success: true, parties, data: parties });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/parties', async (req, res) => {
  try {
    const pfx = getPrefix(req.companyId);
    const name = req.body.name;
    const category = req.body.category || req.body.party_category || 'LOADMAN';
    const phone = req.body.phone || '';
    const whatsapp_number = req.body.whatsapp_number || req.body.phone || '';
    const email = req.body.email || '';
    const default_payment_mode = req.body.default_payment_mode || req.body.payment_mode || 'CASH';
    const bank_name = req.body.bank_name || '';
    const account_no = req.body.account_no || '';
    const ifsc_code = req.body.ifsc_code || '';
    const upi_id = req.body.upi_id || '';
    const notes = req.body.notes || '';
    const is_active = req.body.is_active !== undefined ? (req.body.is_active ? 1 : 0) : 1;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    const countRow = await db.get(`SELECT COUNT(id) as cnt FROM ${pfx}operational_parties`);
    const party_code = `OPP-${category.substring(0, 3).toUpperCase()}-${String((countRow?.cnt || 0) + 1).padStart(4, '0')}`;

    const ins = await db.run(`
      INSERT INTO ${pfx}operational_parties (
        party_code, name, category, party_category, phone, whatsapp_number, email, default_payment_mode, payment_mode,
        bank_name, account_no, ifsc_code, upi_id, notes, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      party_code, name, category, category, phone, whatsapp_number, email,
      default_payment_mode, default_payment_mode, bank_name, account_no,
      ifsc_code, upi_id, notes, is_active
    ]);

    const created = await db.get(`SELECT * FROM ${pfx}operational_parties WHERE id = ?`, [ins.lastID]);
    res.json({ success: true, data: created, message: 'Party registered successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/parties/:id', async (req, res) => {
  try {
    const pfx = getPrefix(req.companyId);
    const { id } = req.params;
    const name = req.body.name;
    const category = req.body.category || req.body.party_category || 'LOADMAN';
    const phone = req.body.phone || '';
    const whatsapp_number = req.body.whatsapp_number || '';
    const email = req.body.email || '';
    const default_payment_mode = req.body.default_payment_mode || req.body.payment_mode || 'CASH';
    const bank_name = req.body.bank_name || '';
    const account_no = req.body.account_no || '';
    const ifsc_code = req.body.ifsc_code || '';
    const upi_id = req.body.upi_id || '';
    const notes = req.body.notes || '';
    const is_active = req.body.is_active !== undefined ? (req.body.is_active ? 1 : 0) : 1;

    await db.run(`
      UPDATE ${pfx}operational_parties
      SET name = ?, category = ?, party_category = ?, phone = ?, whatsapp_number = ?, email = ?,
          default_payment_mode = ?, payment_mode = ?, bank_name = ?, account_no = ?, ifsc_code = ?,
          upi_id = ?, notes = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      name, category, category, phone, whatsapp_number, email,
      default_payment_mode, default_payment_mode, bank_name, account_no, ifsc_code,
      upi_id, notes, is_active, id
    ]);

    const updated = await db.get(`SELECT * FROM ${pfx}operational_parties WHERE id = ?`, [id]);
    res.json({ success: true, data: updated, message: 'Party updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/parties/:id', async (req, res) => {
  try {
    const pfx = getPrefix(req.companyId);
    const { id } = req.params;
    await db.run(`DELETE FROM ${pfx}operational_parties WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Operational party deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// 3. OPERATIONAL RATE MASTERS
// -----------------------------------------------------------------------------
router.get('/rates', async (req, res) => {
  try {
    const pfx = getPrefix(req.companyId);
    const { includeInactive } = req.query;
    const whereClause = includeInactive === 'true' ? '' : 'WHERE is_active = 1';
    const rates = await db.all(`SELECT * FROM ${pfx}operational_rate_masters ${whereClause} ORDER BY operation_type ASC, rate_code ASC`);
    const normalizedRates = (rates || []).map(r => ({
      ...r,
      charge_type: r.operation_type || r.charge_type || 'LOADING',
      party_category: r.charge_category || r.party_category || 'LABOUR',
      calculation_basis: r.rate_basis || r.calculation_basis || 'PER_BAG',
      rate: Number(r.rate_per_unit ?? r.rate ?? 0),
      rate_per_unit: Number(r.rate_per_unit ?? r.rate ?? 0),
      uom: r.uom || (r.rate_basis === 'PER_KG' ? 'KG' : r.rate_basis === 'PER_TONNE' ? 'MT' : r.rate_basis === 'PER_BAG' ? 'BAG' : 'TRIP'),
      notes: r.description || r.notes || ''
    }));
    res.json({ success: true, rates: normalizedRates, data: normalizedRates });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/rates', async (req, res) => {
  try {
    const pfx = getPrefix(req.companyId);
    const operation_type = req.body.operation_type || req.body.charge_type || 'LOADING';
    const charge_category = req.body.charge_category || req.body.party_category || 'LABOUR';
    const rate_basis = req.body.rate_basis || req.body.calculation_basis || 'PER_BAG';
    const rate_per_unit = req.body.rate_per_unit !== undefined ? req.body.rate_per_unit : (req.body.rate !== undefined ? req.body.rate : 0);
    const min_charge = req.body.min_charge || 0;
    const description = req.body.description || req.body.notes || '';
    const uom = req.body.uom || (rate_basis === 'PER_KG' ? 'KG' : rate_basis === 'PER_TONNE' ? 'MT' : rate_basis === 'PER_BAG' ? 'BAG' : 'TRIP');

    const countRow = await db.get(`SELECT COUNT(id) as cnt FROM ${pfx}operational_rate_masters`);
    const rate_code = `RATE-${operation_type.substring(0, 4).toUpperCase()}-${String((countRow?.cnt || 0) + 1).padStart(3, '0')}`;

    const ins = await db.run(`
      INSERT INTO ${pfx}operational_rate_masters (
        rate_code, operation_type, charge_category, rate_basis, rate_per_unit, min_charge, description, uom, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [
      rate_code, operation_type, charge_category, rate_basis,
      Number(rate_per_unit || 0), Number(min_charge || 0), description, uom
    ]);

    const created = await db.get(`SELECT * FROM ${pfx}operational_rate_masters WHERE id = ?`, [ins.lastID]);
    const normalized = {
      ...created,
      charge_type: created.operation_type,
      party_category: created.charge_category,
      calculation_basis: created.rate_basis,
      rate: Number(created.rate_per_unit || 0),
      rate_per_unit: Number(created.rate_per_unit || 0),
      uom: created.uom || uom,
      notes: created.description || ''
    };
    res.json({ success: true, data: normalized, message: 'Rate master created' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/rates/:id', async (req, res) => {
  try {
    const pfx = getPrefix(req.companyId);
    const { id } = req.params;
    const numId = parseInt(id, 10);
    const targetId = !isNaN(numId) ? numId : id;
    const operation_type = req.body.operation_type || req.body.charge_type || 'LOADING';
    const charge_category = req.body.charge_category || req.body.party_category || 'LABOUR';
    const rate_basis = req.body.rate_basis || req.body.calculation_basis || 'PER_BAG';
    const rate_per_unit = req.body.rate_per_unit !== undefined ? req.body.rate_per_unit : (req.body.rate !== undefined ? req.body.rate : 0);
    const min_charge = req.body.min_charge !== undefined ? req.body.min_charge : 0;
    const description = req.body.description || req.body.notes || '';
    const is_active = req.body.is_active !== undefined ? (req.body.is_active ? 1 : 0) : 1;
    const uom = req.body.uom || (rate_basis === 'PER_KG' ? 'KG' : rate_basis === 'PER_TONNE' ? 'MT' : rate_basis === 'PER_BAG' ? 'BAG' : 'TRIP');

    await db.run(`
      UPDATE ${pfx}operational_rate_masters
      SET operation_type = ?, charge_category = ?, rate_basis = ?,
          rate_per_unit = ?, min_charge = ?, description = ?, is_active = ?, uom = ?
      WHERE id = ? OR id = ?
    `, [
      operation_type, charge_category, rate_basis,
      Number(rate_per_unit || 0), Number(min_charge || 0), description,
      is_active, uom, targetId, id
    ]);

    // Also sync operational_rates if present
    try {
      await db.run(`
        UPDATE ${pfx}operational_rates
        SET charge_type = ?, party_category = ?, calculation_basis = ?,
            rate = ?, notes = ?, is_active = ?, uom = ?
        WHERE id = ? OR id = ?
      `, [
        operation_type, charge_category, rate_basis,
        Number(rate_per_unit || 0), description, is_active, uom, targetId, id
      ]);
    } catch (_) {}

    const updated = await db.get(`SELECT * FROM ${pfx}operational_rate_masters WHERE id = ? OR id = ?`, [targetId, id]);
    const normalized = updated ? {
      ...updated,
      charge_type: updated.operation_type,
      party_category: updated.charge_category,
      calculation_basis: updated.rate_basis,
      rate: Number(updated.rate_per_unit || 0),
      rate_per_unit: Number(updated.rate_per_unit || 0),
      uom: updated.uom || uom,
      notes: updated.description || ''
    } : null;

    res.json({ success: true, data: normalized, message: 'Rate updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Toggle Active / Inactive for Rate Card
router.post('/rates/:id/toggle-active', async (req, res) => {
  try {
    const pfx = getPrefix(req.companyId);
    const { id } = req.params;
    const current = await db.get(`SELECT id, is_active FROM ${pfx}operational_rate_masters WHERE id = ?`, [id]);
    if (!current) {
      return res.status(404).json({ success: false, error: 'Rate card not found' });
    }
    const newStatus = current.is_active ? 0 : 1;
    await db.run(`UPDATE ${pfx}operational_rate_masters SET is_active = ? WHERE id = ?`, [newStatus, id]);
    try {
      await db.run(`UPDATE ${pfx}operational_rates SET is_active = ? WHERE id = ?`, [newStatus, id]);
    } catch (_) {}
    res.json({ success: true, is_active: newStatus, message: `Rate ${newStatus ? 'activated' : 'deactivated'} successfully` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Clean up / Purge inactive or unwanted rates
router.post('/rates/cleanup-inactive', async (req, res) => {
  try {
    const pfx = getPrefix(req.companyId);
    const del1 = await db.run(`DELETE FROM ${pfx}operational_rate_masters WHERE is_active = 0`);
    try {
      await db.run(`DELETE FROM ${pfx}operational_rates WHERE is_active = 0`);
    } catch (_) {}
    res.json({ success: true, deletedCount: del1.changes || 0, message: 'Inactive rates purged successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/rates/:id', async (req, res) => {
  try {
    const pfx = getPrefix(req.companyId);
    const { id } = req.params;
    const numId = parseInt(id, 10);
    const targetId = !isNaN(numId) ? numId : id;
    await db.run(`DELETE FROM ${pfx}operational_rate_masters WHERE id = ? OR id = ?`, [targetId, id]);
    try {
      await db.run(`DELETE FROM ${pfx}operational_rates WHERE id = ? OR id = ?`, [targetId, id]);
    } catch (_) {}
    res.json({ success: true, message: 'Rate master deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/payments/:id', async (req, res) => {
  try {
    const pfx = getPrefix(req.companyId);
    const { id } = req.params;
    try {
      await db.run(`DELETE FROM ${pfx}operational_payment_allocations WHERE payment_id = ?`, [id]);
    } catch (_) {}
    await db.run(`DELETE FROM ${pfx}operational_payments WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Payment record deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// 4. OPERATIONAL CHARGES (CRUD & UTILITIES)
// -----------------------------------------------------------------------------
router.get('/next-number', async (req, res) => {
  try {
    const pfx = getPrefix(req.companyId);
    const countRow = await db.get(`SELECT COUNT(id) as cnt FROM ${pfx}operational_charges`);
    const next_charge_no = `OC-${String((countRow?.cnt || 0) + 1).padStart(5, '0')}`;
    res.json({ success: true, next_charge_no });
  } catch (err) {
    res.json({ success: true, next_charge_no: `OC-${Date.now().toString().slice(-5)}` });
  }
});

router.post('/calculate', async (req, res) => {
  try {
    const { charge_type, calculation_basis, quantity } = req.body;
    const pfx = getPrefix(req.companyId);
    const rateMaster = await db.get(
      `SELECT * FROM ${pfx}operational_rate_masters WHERE operation_type = ? OR charge_category = ? ORDER BY id DESC LIMIT 1`,
      [charge_type || '', charge_type || '']
    );
    const rate = rateMaster?.rate_per_unit || 0.50;
    const basis = calculation_basis || rateMaster?.rate_basis || 'PER_KG';
    const qty = Number(quantity || 0);
    const amount = rate * qty;
    res.json({
      success: true,
      calculation: {
        rate,
        calculation_basis: basis,
        amount
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const handleGetCharges = async (req, res) => {
  try {
    const pfx = getPrefix(req.companyId);
    const {
      source_module,
      operation_type,
      payment_status,
      party_id,
      from_date,
      to_date,
      search,
      charge_type,
      status
    } = req.query;

    let sql = `SELECT * FROM ${pfx}operational_charges WHERE 1=1`;
    const params = [];

    const mod = source_module;
    const opt = operation_type || charge_type;
    const st = payment_status || status;

    if (mod) {
      sql += ' AND source_module = ?';
      params.push(mod);
    }
    if (opt) {
      sql += ' AND (operation_type = ? OR charge_category = ?)';
      params.push(opt, opt);
    }
    if (st) {
      sql += ' AND payment_status = ?';
      params.push(st);
    }
    if (party_id) {
      sql += ' AND party_id = ?';
      params.push(party_id);
    }
    if (from_date) {
      sql += ' AND date >= ?';
      params.push(from_date);
    }
    if (to_date) {
      sql += ' AND date <= ?';
      params.push(to_date);
    }
    if (search) {
      sql += ' AND (charge_no LIKE ? OR source_transaction_no LIKE ? OR party_name LIKE ? OR vehicle_no LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY date DESC, id DESC';
    const charges = await db.all(sql, params);

    res.json({ success: true, charges: charges || [], data: charges || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

router.get('/', handleGetCharges);
router.get('/charges', handleGetCharges);

router.get('/traceability', async (req, res) => {
  try {
    const pfx = getPrefix(req.companyId);
    const { charge_id } = req.query;
    const charge = await db.get(`SELECT * FROM ${pfx}operational_charges WHERE id = ?`, [charge_id]);
    const payments = await db.all(
      `SELECT p.*, a.allocated_amount FROM ${pfx}operational_payment_allocations a JOIN ${pfx}operational_payments p ON a.payment_id = p.id WHERE a.charge_id = ?`,
      [charge_id]
    );
    const logs = await db.all(
      `SELECT * FROM ${pfx}operational_audit_logs WHERE charge_id = ? ORDER BY id ASC`,
      [charge_id]
    );
    res.json({
      success: true,
      traceability: {
        charge,
        payments: payments || [],
        logs: logs || []
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/reports', async (req, res) => {
  try {
    const pfx = getPrefix(req.companyId);
    const { report_type } = req.query;
    const type = (report_type || 'SUMMARY').toUpperCase();

    let data = [];
    if (type === 'WORKER_WISE') {
      data = await db.all(`
        SELECT party_name, party_category, COUNT(id) as total_operations,
               SUM(final_amount) as total_charges, SUM(paid_amount) as total_paid, SUM(balance_amount) as total_balance
        FROM ${pfx}operational_charges
        GROUP BY party_name, party_category
        ORDER BY total_charges DESC
      `) || [];
    } else if (type === 'DRIVER_WISE') {
      data = await db.all(`
        SELECT driver_name, vehicle_no, COUNT(id) as total_trips,
               SUM(final_amount) as total_charges, SUM(paid_amount) as total_paid, SUM(balance_amount) as total_balance
        FROM ${pfx}operational_charges
        WHERE driver_name IS NOT NULL AND driver_name != ''
        GROUP BY driver_name, vehicle_no
        ORDER BY total_charges DESC
      `) || [];
    } else if (type === 'VEHICLE_WISE') {
      data = await db.all(`
        SELECT vehicle_no, COUNT(id) as total_trips,
               SUM(CASE WHEN operation_type = 'LOADING' THEN final_amount ELSE 0 END) as loading_cost,
               SUM(CASE WHEN operation_type = 'UNLOADING' THEN final_amount ELSE 0 END) as unloading_cost,
               SUM(CASE WHEN charge_category = 'DRIVER_BATTA' THEN final_amount ELSE 0 END) as driver_cost,
               SUM(CASE WHEN charge_category = 'TRANSPORT' THEN final_amount ELSE 0 END) as transport_cost,
               SUM(final_amount) as total_operational_cost
        FROM ${pfx}operational_charges
        WHERE vehicle_no IS NOT NULL AND vehicle_no != ''
        GROUP BY vehicle_no
        ORDER BY total_operational_cost DESC
      `) || [];
    } else if (type === 'GODOWN_WISE') {
      data = await db.all(`
        SELECT from_location, to_location, COUNT(id) as transfers,
               SUM(CASE WHEN operation_type = 'LOADING' THEN final_amount ELSE 0 END) as loading_cost,
               SUM(CASE WHEN operation_type = 'UNLOADING' THEN final_amount ELSE 0 END) as unloading_cost,
               SUM(final_amount) as total_transfer_cost
        FROM ${pfx}operational_charges
        WHERE from_location IS NOT NULL AND to_location IS NOT NULL
        GROUP BY from_location, to_location
        ORDER BY total_transfer_cost DESC
      `) || [];
    } else {
      data = await db.all(`
        SELECT charge_category, COUNT(id) as count, SUM(final_amount) as total_amount, SUM(balance_amount) as total_balance
        FROM ${pfx}operational_charges
        GROUP BY charge_category
      `) || [];
    }

    const charges = await db.all(`SELECT * FROM ${pfx}operational_charges ORDER BY date DESC`);
    const payments = await db.all(`SELECT * FROM ${pfx}operational_payments ORDER BY payment_date DESC`);
    res.json({
      success: true,
      report_type: type,
      data: data || [],
      charges: charges || [],
      payments: payments || []
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// 5. OPERATIONAL PAYMENTS & DISBURSEMENTS
// -----------------------------------------------------------------------------
router.get('/payments', async (req, res) => {
  try {
    const pfx = getPrefix(req.companyId);
    const { party_id, from_date, to_date, search } = req.query;

    let sql = `
      SELECT p.*,
        (SELECT COUNT(a.id) FROM ${pfx}operational_payment_allocations a WHERE a.payment_id = p.id) as allocated_charges_count
      FROM ${pfx}operational_payments p
      WHERE 1=1
    `;
    const params = [];

    if (party_id) {
      sql += ' AND p.party_id = ?';
      params.push(party_id);
    }
    if (from_date) {
      sql += ' AND p.payment_date >= ?';
      params.push(from_date);
    }
    if (to_date) {
      sql += ' AND p.payment_date <= ?';
      params.push(to_date);
    }
    if (search) {
      sql += ' AND (p.payment_no LIKE ? OR p.party_name LIKE ? OR p.voucher_no LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY p.payment_date DESC, p.id DESC';
    const payments = await db.all(sql, params);

    for (const p of payments || []) {
      const allocs = await db.all(
        `SELECT a.*, c.charge_no FROM ${pfx}operational_payment_allocations a LEFT JOIN ${pfx}operational_charges c ON a.charge_id = c.id WHERE a.payment_id = ?`,
        [p.id]
      ).catch(() => []);
      p.allocations = allocs || [];
    }

    res.json({ success: true, payments: payments || [], data: payments || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/payments', async (req, res) => {
  try {
    const result = await recordOperationalPayment({
      companyId: req.companyId,
      ...req.body
    });
    res.json({ success: true, data: result, message: 'Payment recorded & accounts updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// 6. OUTSTANDING DUES BY WORKER/DRIVER/PARTY
// -----------------------------------------------------------------------------
router.get('/pending-dues', async (req, res) => {
  try {
    const pfx = getPrefix(req.companyId);
    const dues = await db.all(`
      SELECT
        p.id as party_id,
        p.name as party_name,
        p.category as party_category,
        p.phone,
        p.whatsapp_number,
        p.default_payment_mode,
        COUNT(c.id) as unpaid_charge_count,
        SUM(c.balance_amount) as total_payable_balance
      FROM ${pfx}operational_parties p
      JOIN ${pfx}operational_charges c ON c.party_id = p.id
      WHERE c.balance_amount > 0 AND c.approval_status = 'APPROVED'
      GROUP BY p.id, p.name, p.category, p.phone, p.whatsapp_number, p.default_payment_mode
      HAVING SUM(c.balance_amount) > 0
      ORDER BY total_payable_balance DESC
    `);
    res.json({ success: true, dues: dues || [], data: dues || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// 7. AUDIT TRAIL LOGS
// -----------------------------------------------------------------------------
router.get('/audit-logs', async (req, res) => {
  try {
    const pfx = getPrefix(req.companyId);
    const logs = await db.all(`
      SELECT * FROM ${pfx}operational_audit_logs
      ORDER BY created_at DESC, id DESC
      LIMIT 100
    `);
    res.json({ success: true, logs: logs || [], data: logs || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/print', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) return next();
    const pfx = getPrefix(req.companyId);
    const charge = await db.get(`SELECT * FROM ${pfx}operational_charges WHERE id = ?`, [id]);
    const lines = await db.all(`SELECT * FROM ${pfx}operational_charge_lines WHERE charge_id = ?`, [id]);
    res.json({
      success: true,
      title: 'OPERATIONAL CHARGE VOUCHER',
      charge,
      lines: lines || []
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) return next();
    const pfx = getPrefix(req.companyId);
    const charge = await db.get(`SELECT * FROM ${pfx}operational_charges WHERE id = ?`, [id]);
    if (!charge) return res.status(404).json({ success: false, error: 'Charge not found' });

    const lines = await db.all(`SELECT * FROM ${pfx}operational_charge_lines WHERE charge_id = ? ORDER BY line_no ASC`, [id]);
    const allocations = await db.all(`
      SELECT a.*, p.payment_no, p.payment_date, p.payment_mode, p.voucher_no
      FROM ${pfx}operational_payment_allocations a
      JOIN ${pfx}operational_payments p ON a.payment_id = p.id
      WHERE a.charge_id = ?
      ORDER BY p.payment_date DESC
    `, [id]);

    res.json({
      success: true,
      data: {
        ...charge,
        lines: lines || [],
        paymentAllocations: allocations || []
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const result = await recordOperationalCharge({
      companyId: req.companyId,
      ...req.body
    });
    res.json({ success: true, data: result, message: 'Operational charge recorded & posted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/charges', async (req, res) => {
  try {
    const result = await recordOperationalCharge({
      companyId: req.companyId,
      ...req.body
    });
    res.json({ success: true, data: result, message: 'Operational charge recorded & posted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const pfx = getPrefix(req.companyId);
    const { id } = req.params;
    await db.run(
      `UPDATE ${pfx}operational_charges SET approval_status = 'APPROVED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );
    res.json({ success: true, message: 'Operational charge approved' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    const pfx = getPrefix(req.companyId);
    const { id } = req.params;
    const { reason } = req.body;
    await db.run(
      `UPDATE ${pfx}operational_charges SET approval_status = 'CANCELLED', notes = COALESCE(notes, '') || ' [Cancelled: ' || ? || ']', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [reason || 'User cancelled', id]
    );
    res.json({ success: true, message: 'Operational charge cancelled' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
