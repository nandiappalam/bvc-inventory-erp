const db = require('../config/database');

async function loadPartyDirectory(companyId, conn = null) {
  const cId = parseInt(companyId, 10);
  if (!Number.isSafeInteger(cId) || cId <= 0) {
    return {
      suppliersById: new Map(),
      suppliersByKey: new Map(),
      customersById: new Map(),
      customersByKey: new Map()
    };
  }
  const runner = conn || db.forCompany(cId);

  const suppliersById = new Map();
  const suppliersByKey = new Map();
  const customersById = new Map();
  const customersByKey = new Map();

  try {
    const suppliers = await runner.all(`SELECT id, name, print_name FROM supplier_master ORDER BY id ASC`);
    for (const s of (suppliers || [])) {
      const displayName = String(s.print_name || s.name || '').trim() || `Supplier #${s.id}`;
      const record = { id: Number(s.id), name: displayName, rawName: String(s.name || '').trim(), type: 'SUPPLIER' };
      suppliersById.set(String(s.id), record);
      if (s.name) suppliersByKey.set(String(s.name).trim().toLowerCase(), record);
      if (s.print_name) suppliersByKey.set(String(s.print_name).trim().toLowerCase(), record);
    }
  } catch (_) {}

  try {
    const customers = await runner.all(`SELECT id, name, print_name FROM customer_master ORDER BY id ASC`);
    for (const c of (customers || [])) {
      const displayName = String(c.print_name || c.name || '').trim() || `Customer #${c.id}`;
      const record = { id: Number(c.id), name: displayName, rawName: String(c.name || '').trim(), type: 'CUSTOMER' };
      customersById.set(String(c.id), record);
      if (c.name) customersByKey.set(String(c.name).trim().toLowerCase(), record);
      if (c.print_name) customersByKey.set(String(c.print_name).trim().toLowerCase(), record);
    }
  } catch (_) {}

  return {
    suppliersById,
    suppliersByKey,
    customersById,
    customersByKey
  };
}

function resolveSupplierFromDirectory(dir, rawVal, idVal = null) {
  if (!dir) return { id: idVal || null, name: String(rawVal || '').trim() };
  if (idVal !== null && idVal !== undefined && String(idVal).trim() !== '') {
    const m = dir.suppliersById.get(String(idVal).trim());
    if (m) return m;
  }
  const raw = String(rawVal || '').trim();
  if (!raw) return { id: null, name: '' };
  if (/^\d+$/.test(raw)) {
    const m = dir.suppliersById.get(raw);
    if (m) return m;
  }
  const byKey = dir.suppliersByKey.get(raw.toLowerCase());
  if (byKey) return byKey;
  return { id: null, name: raw };
}

function resolveCustomerFromDirectory(dir, rawVal, idVal = null) {
  if (!dir) return { id: idVal || null, name: String(rawVal || '').trim() };
  if (idVal !== null && idVal !== undefined && String(idVal).trim() !== '') {
    const m = dir.customersById.get(String(idVal).trim());
    if (m) return m;
  }
  const raw = String(rawVal || '').trim();
  if (!raw) return { id: null, name: '' };
  if (/^\d+$/.test(raw)) {
    const m = dir.customersById.get(raw);
    if (m) return m;
  }
  const byKey = dir.customersByKey.get(raw.toLowerCase());
  if (byKey) return byKey;
  return { id: null, name: raw };
}

function resolvePartyFromDirectory(dir, { supplierName = '', supplierId = null, partyName = '', sourceModule = '' } = {}) {
  const mod = String(sourceModule || '').toUpperCase();
  const isSales = mod === 'SALES' || mod === 'SALES_RETURN' || mod === 'SALES_EXPORT_ORDER';

  const sup = resolveSupplierFromDirectory(dir, supplierName, supplierId);
  let resolvedParty = String(partyName || '').trim();

  if (isSales) {
    const cust = resolveCustomerFromDirectory(dir, resolvedParty || supplierName, null);
    if (cust.name) resolvedParty = cust.name;
  } else if (mod === 'PURCHASE' || mod === 'PURCHASE_RETURN' || mod === 'COLD_STORAGE' || mod === 'OPEN') {
    if (!resolvedParty || /^\d+$/.test(resolvedParty)) {
      const s2 = resolveSupplierFromDirectory(dir, resolvedParty || sup.name, sup.id);
      if (s2.name) resolvedParty = s2.name;
    }
  } else if (resolvedParty && /^\d+$/.test(resolvedParty)) {
    const s2 = resolveSupplierFromDirectory(dir, resolvedParty);
    if (s2.id) {
      resolvedParty = s2.name;
    } else {
      const c2 = resolveCustomerFromDirectory(dir, resolvedParty);
      if (c2.id) resolvedParty = c2.name;
    }
  }

  return {
    supplierId: sup.id || supplierId || null,
    supplierName: sup.name || '',
    partyName: resolvedParty || sup.name || ''
  };
}

async function resolveSupplierName(companyId, rawVal, idVal = null, conn = null) {
  const dir = await loadPartyDirectory(companyId, conn);
  return resolveSupplierFromDirectory(dir, rawVal, idVal);
}

async function resolveCustomerName(companyId, rawVal, idVal = null, conn = null) {
  const dir = await loadPartyDirectory(companyId, conn);
  return resolveCustomerFromDirectory(dir, rawVal, idVal);
}

module.exports = {
  loadPartyDirectory,
  resolveSupplierFromDirectory,
  resolveCustomerFromDirectory,
  resolvePartyFromDirectory,
  resolveSupplierName,
  resolveCustomerName
};
