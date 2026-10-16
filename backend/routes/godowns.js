const express = require('express');
const router = express.Router();
const db = require('../config/database');
const recycleBinService = require('../services/RecycleBinService');

const getBillingSettings = (body) => {
  const storageDuration = Number(body.storage_duration || 10);
  const minBillableDays = Number(body.min_billable_days || storageDuration);
  let ratePerKg = Number(body.rate_per_kg || 0);
  let ratePerTon = Number(body.rate_per_ton || 0);
  const billingBasis = body.billing_basis || 'Per KG';
  const billingMethod = body.billing_method || 'Fixed Period';
  const durationUnit = body.duration_unit || 'Days';
  const isColdStorage = String(body.godown_type || '').toLowerCase() === 'cold storage';

  if (isColdStorage && (
    !Number.isFinite(storageDuration) || storageDuration <= 0 ||
    !Number.isFinite(minBillableDays) || minBillableDays <= 0 ||
    !Number.isFinite(ratePerKg) || ratePerKg < 0 ||
    !Number.isFinite(ratePerTon) || ratePerTon < 0 ||
    !['Per KG', 'Per Ton'].includes(billingBasis) ||
    !['Days', 'Months'].includes(durationUnit) ||
    !['Fixed Period', 'Per Day'].includes(billingMethod)
  )) {
    return { error: 'Cold storage duration, billing basis, method, and rates must be valid.' };
  }

  if (billingBasis === 'Per KG' && ratePerKg > 0) {
    ratePerTon = Number((ratePerKg * 1000).toFixed(6));
  } else if (billingBasis === 'Per Ton' && ratePerTon > 0) {
    ratePerKg = Number((ratePerTon / 1000).toFixed(6));
  }

  return {
    storage_duration: storageDuration,
    duration_unit: durationUnit,
    rate_per_kg: ratePerKg,
    rate_per_ton: ratePerTon,
    billing_basis: billingBasis,
    billing_method: billingMethod,
    min_billable_days: minBillableDays,
    cold_storage_remarks: body.cold_storage_remarks || null
  };
};

const enrichGodown = (row) => {
  if (!row || typeof row !== 'object') return row;
  const copy = { ...row };
  if (!copy.name && copy.godown_name) copy.name = copy.godown_name;
  if (!copy.godown_name && copy.name) copy.godown_name = copy.name;
  if (!copy.print_name && copy.printname) copy.print_name = copy.printname;
  if (!copy.printname && copy.print_name) copy.printname = copy.print_name;
  if (!copy.address && copy.address1) copy.address = copy.address1;
  if (!copy.address1 && copy.address) copy.address1 = copy.address;
  if (!copy.mobile1 && copy.mobile) copy.mobile1 = copy.mobile;
  if (!copy.mobile && copy.mobile1) copy.mobile = copy.mobile1;
  if (!copy.phone_off && copy.phone) copy.phone_off = copy.phone;
  if (!copy.phone && copy.phone_off) copy.phone = copy.phone_off;
  if (!copy.gst_number && copy.gst_no) copy.gst_number = copy.gst_no;
  if (!copy.gst_no && copy.gst_number) copy.gst_no = copy.gst_number;
  if (!copy.area && copy.location) copy.area = copy.location;
  if (!copy.location && copy.area) copy.location = copy.area;
  return copy;
};

// GET /api/godowns - Fetch list of all godowns
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM godown_master ORDER BY id ASC');
    let list = (result.rows || []).map(enrichGodown);
    if (list.length === 0) {
      list = [
        { id: 1, godown_name: 'Main Godown', name: 'Main Godown', area: 'Factory Premises', location: 'Factory Premises', address: 'Factory Premises', address1: 'Factory Premises', godown_type: 'Normal', storage_location: 'Inside Factory', status: 'Active' },
        { id: 2, godown_name: 'Finished Goods', name: 'Finished Goods', area: 'Unit 1 Storage', location: 'Unit 1 Storage', address: 'Unit 1 Storage', address1: 'Unit 1 Storage', godown_type: 'Normal', storage_location: 'Inside Factory', status: 'Active' },
        { id: 3, godown_name: 'Raw Materials', name: 'Raw Materials', area: 'RM Warehouse', location: 'RM Warehouse', address: 'RM Warehouse', address1: 'RM Warehouse', godown_type: 'Normal', storage_location: 'Inside Factory', status: 'Active' },
        { id: 4, godown_name: 'Packing Store', name: 'Packing Store', area: 'Store Room', location: 'Store Room', address: 'Store Room', address1: 'Store Room', godown_type: 'Normal', storage_location: 'Inside Factory', status: 'Active' }
      ];
    }
    // Return both formats for full compatibility with frontend callers
    if (req.query.format === 'object' || req.headers['x-requested-format'] === 'object') {
      res.json({ success: true, data: list });
    } else {
      res.json(list);
    }
  } catch (err) {
    console.error('Error fetching godowns:', err);
    res.status(500).json({ success: false, message: 'Error fetching godowns', error: err.message });
  }
});

// GET /api/godowns/:id - Fetch single godown
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM godown_master WHERE id = ? OR godown_name = ?', [id, id]);
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Godown not found' });
    }
    const item = enrichGodown(result.rows[0]);
    res.json({ success: true, data: item });
  } catch (err) {
    console.error('Error fetching godown:', err);
    res.status(500).json({ success: false, message: 'Error fetching godown', error: err.message });
  }
});

// POST /api/godowns - Create or update godown
router.post('/', async (req, res) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }

    if (!body || typeof body !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid request body' });
    }

    const godown_name = (body.godown_name || body.name || '').trim();
    if (!godown_name) {
      return res.status(400).json({ success: false, message: 'Godown / Cold Storage Name is required' });
    }

    const print_name = body.print_name || body.printname || godown_name;
    const godown_type = body.godown_type || 'Normal';
    const storage_location = body.storage_location || 'Inside Factory';
    const external_company = body.external_company || null;
    const capacity = parseFloat(body.capacity || 0) || 0;
    const capacity_unit = body.capacity_unit || 'KG';
    const temperature_range = body.temperature_range || null;
    const contact_person = body.contact_person || null;
    const address = body.address || body.address1 || null;
    const address1 = body.address1 || body.address || null;
    const phone_off = body.phone_off || body.phone || null;
    const phone = body.phone || body.phone_off || null;
    const mobile1 = body.mobile1 || body.mobile || null;
    const mobile = body.mobile || body.mobile1 || null;
    const email = body.email || null;
    const website = body.website || null;
    const area = body.area || body.location || null;
    const location = body.location || body.area || null;
    const gst_number = body.gst_number || body.gst_no || null;
    const gst_no = body.gst_no || body.gst_number || null;
    const status = body.status || 'Active';

    // Cold storage specific fields
    const billingSettings = getBillingSettings(body);
    if (billingSettings.error) return res.status(400).json({ success: false, message: billingSettings.error });
    const { storage_duration, duration_unit, rate_per_kg, rate_per_ton, billing_basis, billing_method, min_billable_days, cold_storage_remarks } = billingSettings;

    // If ID provided, update existing
    if (body.id) {
      await db.run(`
        UPDATE godown_master SET 
          godown_name = ?, print_name = ?, godown_type = ?, storage_location = ?, external_company = ?,
          capacity = ?, capacity_unit = ?, temperature_range = ?, contact_person = ?, address = ?,
          phone_off = ?, mobile1 = ?, email = ?, website = ?, area = ?, gst_number = ?, status = ?,
          storage_duration = ?, duration_unit = ?, rate_per_kg = ?, rate_per_ton = ?,
          billing_basis = ?, billing_method = ?, min_billable_days = ?, cold_storage_remarks = ?
        WHERE id = ?
      `, [
        godown_name, print_name, godown_type, storage_location, external_company,
        capacity, capacity_unit, temperature_range, contact_person, address,
        phone_off, mobile1, email, website, area, gst_number, status,
        storage_duration, duration_unit, rate_per_kg, rate_per_ton,
        billing_basis, billing_method, min_billable_days, cold_storage_remarks,
        body.id
      ]);

      const updated = enrichGodown({ id: body.id, ...body, godown_name, print_name, godown_type, storage_location, external_company, capacity, capacity_unit, temperature_range, contact_person, address, address1, phone_off, mobile1, email, website, area, gst_number, status, storage_duration, duration_unit, rate_per_kg, rate_per_ton, billing_basis, billing_method, min_billable_days, cold_storage_remarks });
      return res.json({ success: true, id: body.id, data: updated, message: 'Godown updated successfully' });
    }

    // Check if duplicate name
    const existing = await db.query('SELECT id FROM godown_master WHERE LOWER(TRIM(godown_name)) = LOWER(TRIM(?))', [godown_name]);
    if (existing.rows && existing.rows.length > 0) {
      const existingId = existing.rows[0].id;
      await db.run(`
        UPDATE godown_master SET 
          print_name = ?, godown_type = ?, storage_location = ?, external_company = ?,
          capacity = ?, capacity_unit = ?, temperature_range = ?, contact_person = ?, address = ?,
          phone_off = ?, mobile1 = ?, email = ?, website = ?, area = ?, gst_number = ?, status = ?,
          storage_duration = ?, duration_unit = ?, rate_per_kg = ?, rate_per_ton = ?,
          billing_basis = ?, billing_method = ?, min_billable_days = ?, cold_storage_remarks = ?
        WHERE id = ?
      `, [
        print_name, godown_type, storage_location, external_company,
        capacity, capacity_unit, temperature_range, contact_person, address,
        phone_off, mobile1, email, website, area, gst_number, status,
        storage_duration, duration_unit, rate_per_kg, rate_per_ton,
        billing_basis, billing_method, min_billable_days, cold_storage_remarks,
        existingId
      ]);
      const updated = enrichGodown({ id: existingId, ...body, godown_name, print_name, godown_type, storage_location, external_company, capacity, capacity_unit, temperature_range, contact_person, address, address1, phone_off, mobile1, email, website, area, gst_number, status, storage_duration, duration_unit, rate_per_kg, rate_per_ton, billing_basis, billing_method, min_billable_days, cold_storage_remarks });
      return res.json({ success: true, id: existingId, data: updated, message: 'Godown updated successfully' });
    }

    // Insert new godown
    const insertRes = await db.run(`
      INSERT INTO godown_master (
        godown_name, print_name, godown_type, storage_location, external_company,
        capacity, capacity_unit, temperature_range, contact_person, address,
        phone_off, mobile1, email, website, area, gst_number, status,
        storage_duration, duration_unit, rate_per_kg, rate_per_ton,
        billing_basis, billing_method, min_billable_days, cold_storage_remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      godown_name, print_name, godown_type, storage_location, external_company,
      capacity, capacity_unit, temperature_range, contact_person, address,
      phone_off, mobile1, email, website, area, gst_number, status,
      storage_duration, duration_unit, rate_per_kg, rate_per_ton,
      billing_basis, billing_method, min_billable_days, cold_storage_remarks
    ]);

    const newId = insertRes.lastID || insertRes.lastInsertRowid || insertRes.rows?.[0]?.id;
    const created = enrichGodown({ id: newId, godown_name, print_name, godown_type, storage_location, external_company, capacity, capacity_unit, temperature_range, contact_person, address, address1, phone_off, mobile1, email, website, area, gst_number, status, storage_duration, duration_unit, rate_per_kg, rate_per_ton, billing_basis, billing_method, min_billable_days, cold_storage_remarks });

    res.json({ success: true, id: newId, data: created, message: 'Godown saved successfully' });
  } catch (err) {
    console.error('Error saving godown:', err);
    res.status(500).json({ success: false, message: 'Error saving godown: ' + err.message, error: err.message });
  }
});

// PUT /api/godowns/:id - Update existing godown
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }

    if (!body || typeof body !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid request body' });
    }

    const godown_name = (body.godown_name || body.name || '').trim();
    if (!godown_name) {
      return res.status(400).json({ success: false, message: 'Godown / Cold Storage Name is required' });
    }

    const print_name = body.print_name || body.printname || godown_name;
    const godown_type = body.godown_type || 'Normal';
    const storage_location = body.storage_location || 'Inside Factory';
    const external_company = body.external_company || null;
    const capacity = parseFloat(body.capacity || 0) || 0;
    const capacity_unit = body.capacity_unit || 'KG';
    const temperature_range = body.temperature_range || null;
    const contact_person = body.contact_person || null;
    const address = body.address || body.address1 || null;
    const address1 = body.address1 || body.address || null;
    const phone_off = body.phone_off || body.phone || null;
    const mobile1 = body.mobile1 || body.mobile || null;
    const email = body.email || null;
    const website = body.website || null;
    const area = body.area || body.location || null;
    const gst_number = body.gst_number || body.gst_no || null;
    const status = body.status || 'Active';
    const billingSettings = getBillingSettings(body);
    if (billingSettings.error) return res.status(400).json({ success: false, message: billingSettings.error });
    const { storage_duration, duration_unit, rate_per_kg, rate_per_ton, billing_basis, billing_method, min_billable_days, cold_storage_remarks } = billingSettings;

    await db.run(`
      UPDATE godown_master SET 
        godown_name = ?, print_name = ?, godown_type = ?, storage_location = ?, external_company = ?,
        capacity = ?, capacity_unit = ?, temperature_range = ?, contact_person = ?, address = ?,
        phone_off = ?, mobile1 = ?, email = ?, website = ?, area = ?, gst_number = ?, status = ?,
        storage_duration = ?, duration_unit = ?, rate_per_kg = ?, rate_per_ton = ?,
        billing_basis = ?, billing_method = ?, min_billable_days = ?, cold_storage_remarks = ?
      WHERE id = ?
    `, [
      godown_name, print_name, godown_type, storage_location, external_company,
      capacity, capacity_unit, temperature_range, contact_person, address,
      phone_off, mobile1, email, website, area, gst_number, status,
      storage_duration, duration_unit, rate_per_kg, rate_per_ton,
      billing_basis, billing_method, min_billable_days, cold_storage_remarks,
      id
    ]);

    const updated = enrichGodown({ id: parseInt(id), ...body, godown_name, print_name, godown_type, storage_location, external_company, capacity, capacity_unit, temperature_range, contact_person, address, address1, phone_off, mobile1, email, website, area, gst_number, status, ...billingSettings });
    res.json({ success: true, id: parseInt(id), data: updated, message: 'Godown updated successfully' });
  } catch (err) {
    console.error('Error updating godown:', err);
    res.status(500).json({ success: false, message: 'Error updating godown: ' + err.message, error: err.message });
  }
});

// DELETE /api/godowns/:id - Delete godown
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const gRes = await db.query('SELECT * FROM godown_master WHERE id = ?', [id]);
    if (gRes.rows && gRes.rows.length > 0) {
      const gRow = gRes.rows[0];
      try {
        await recycleBinService.saveToRecycleBin({
          moduleName: 'Godown / Cold Storage',
          recordId: id,
          title: `Godown / Cold Storage #${gRow.godown_name || id}`,
          recordData: {
            tableName: 'godown_master',
            record: gRow
          },
          deletedBy: req.user?.username || 'admin'
        });
      } catch (e) {
        console.warn('Recycle bin save error in godown delete:', e.message);
      }
    }
    await db.run('DELETE FROM godown_master WHERE id = ?', [id]);
    res.json({ success: true, message: 'Godown deleted successfully' });
  } catch (err) {
    console.error('Error deleting godown:', err);
    res.status(500).json({ success: false, message: 'Error deleting godown: ' + err.message, error: err.message });
  }
});

module.exports = router;
