const db = require('../config/database');
const AccountingEngine = require('./AccountingEngine');
const { emitTransactionEvent } = require('./transactionNotificationEngine');

/**
 * Enterprise Operational Charge -> Payment -> Accounting Engine
 * Serves Purchase, Sales, Inpass, Outpass, Godown Transfer, Outside Grind, Vehicle Movement, etc.
 */

// Helper to sanitize table names for multi-tenant company prefix
function getPrefix(companyId) {
  return '';
}

// Track per-company operational schema initialization so repeated master lookups don't re-run 70 DDL statements
const ensuredOperationalCompanies = new Map();

function invalidateOperationalTablesCache(companyId = null) {
  if (companyId === null || companyId === undefined) {
    ensuredOperationalCompanies.clear();
    return;
  }
  ensuredOperationalCompanies.delete(parseInt(companyId, 10) || 1);
}

if (typeof db.registerCacheInvalidator === 'function') {
  db.registerCacheInvalidator(invalidateOperationalTablesCache);
}

/**
 * Ensure all operational charge tables exist for this company schema
 */
async function ensureOperationalTables(companyId = 1, force = false) {
  const activeCompanyId = parseInt(companyId, 10) || 1;
  if (!force && ensuredOperationalCompanies.has(activeCompanyId)) {
    return ensuredOperationalCompanies.get(activeCompanyId);
  }

  const runPromise = _ensureOperationalTablesImpl(activeCompanyId).catch((err) => {
    ensuredOperationalCompanies.delete(activeCompanyId);
    throw err;
  });
  ensuredOperationalCompanies.set(activeCompanyId, runPromise);
  return runPromise;
}

async function _ensureOperationalTablesImpl(companyId = 1) {
  const pfx = getPrefix(companyId);
  const isPostgres = db.isPostgres;
  const idCol = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';

  const queries = [
    `CREATE TABLE IF NOT EXISTS ${pfx}operational_parties (
      id ${idCol},
      party_code VARCHAR(50) UNIQUE,
      name VARCHAR(150) NOT NULL,
      print_name VARCHAR(150),
      contact_person VARCHAR(100),
      category VARCHAR(50) DEFAULT 'LOADMAN',
      party_category VARCHAR(50) DEFAULT 'LOADMAN',
      phone VARCHAR(30),
      phone_res VARCHAR(30),
      phone_off VARCHAR(30),
      whatsapp_number VARCHAR(30),
      email VARCHAR(100),
      default_payment_mode VARCHAR(30) DEFAULT 'CASH',
      payment_mode VARCHAR(30) DEFAULT 'CASH',
      address TEXT,
      area VARCHAR(100),
      bank_name VARCHAR(100),
      account_no VARCHAR(50),
      ifsc_code VARCHAR(30),
      upi_id VARCHAR(80),
      opening_balance NUMERIC(15,2) DEFAULT 0,
      opening_balance_date DATE,
      ledger_id INTEGER,
      linked_ledger_id INTEGER,
      linked_ledger_name TEXT,
      rate_configuration TEXT,
      bank_details_json TEXT,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      per_kg_amount NUMERIC(12,2) DEFAULT 0.00,
      period_duration VARCHAR(100),
      from_date DATE,
      till_date DATE,
      effective_from DATE,
      effective_to DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS ${pfx}operational_rate_masters (
      id ${idCol},
      rate_code VARCHAR(50) UNIQUE,
      operation_type VARCHAR(50) NOT NULL,
      charge_category VARCHAR(50) NOT NULL,
      rate_basis VARCHAR(30) NOT NULL,
      rate_per_unit NUMERIC(12,2) NOT NULL DEFAULT 0.00,
      min_charge NUMERIC(12,2) DEFAULT 0.00,
      description VARCHAR(255),
      uom VARCHAR(20) DEFAULT 'BAG',
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS ${pfx}operational_charges (
      id ${idCol},
      charge_no VARCHAR(50) NOT NULL UNIQUE,
      date DATE NOT NULL,
      source_module VARCHAR(50) NOT NULL,
      source_transaction_no VARCHAR(100),
      source_transaction_id INTEGER,
      operation_type VARCHAR(50) NOT NULL,
      charge_category VARCHAR(50) NOT NULL,
      party_id INTEGER NOT NULL,
      party_name VARCHAR(150),
      party_category VARCHAR(50),
      rate_basis VARCHAR(30) NOT NULL,
      rate_per_unit NUMERIC(12,2) NOT NULL DEFAULT 0.00,
      quantity NUMERIC(12,2) NOT NULL DEFAULT 0.00,
      uom VARCHAR(20) DEFAULT 'BAG',
      calculated_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
      adjustment_amount NUMERIC(12,2) DEFAULT 0.00,
      final_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
      paid_amount NUMERIC(12,2) DEFAULT 0.00,
      balance_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
      payment_status VARCHAR(30) DEFAULT 'UNPAID',
      approval_status VARCHAR(30) DEFAULT 'APPROVED',
      is_posted_to_accounts INTEGER DEFAULT 0,
      accrual_voucher_id INTEGER,
      accrual_voucher_no VARCHAR(50),
      expense_ledger_id INTEGER,
      payable_ledger_id INTEGER,
      from_location VARCHAR(100),
      to_location VARCHAR(100),
      vehicle_no VARCHAR(50),
      driver_name VARCHAR(100),
      notes TEXT,
      created_by VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS ${pfx}operational_charge_lines (
      id ${idCol},
      charge_id INTEGER NOT NULL,
      line_no INTEGER DEFAULT 1,
      item_name VARCHAR(150),
      lot_no VARCHAR(80),
      bag_count NUMERIC(10,2) DEFAULT 0.00,
      weight_kg NUMERIC(12,2) DEFAULT 0.00,
      unit_rate NUMERIC(12,2) DEFAULT 0.00,
      line_amount NUMERIC(12,2) DEFAULT 0.00,
      remarks VARCHAR(255)
    )`,

    `CREATE TABLE IF NOT EXISTS ${pfx}operational_payments (
      id ${idCol},
      payment_no VARCHAR(50) NOT NULL UNIQUE,
      payment_date DATE NOT NULL,
      party_id INTEGER NOT NULL,
      party_name VARCHAR(150),
      party_category VARCHAR(50) DEFAULT 'LOADMEN',
      payment_mode VARCHAR(30) NOT NULL DEFAULT 'CASH',
      payment_method VARCHAR(30) NOT NULL DEFAULT 'CASH',
      paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
      reference_no VARCHAR(100),
      voucher_id INTEGER,
      voucher_no VARCHAR(50),
      paid_from_ledger_id INTEGER,
      payable_ledger_id INTEGER,
      notes TEXT,
      remarks TEXT,
      created_by VARCHAR(100),
      paid_by VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS ${pfx}operational_payment_allocations (
      id ${idCol},
      payment_id INTEGER NOT NULL,
      charge_id INTEGER NOT NULL,
      allocated_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS ${pfx}operational_audit_logs (
      id ${idCol},
      entity_type VARCHAR(50) NOT NULL,
      entity_id INTEGER NOT NULL,
      entity_ref VARCHAR(80),
      action VARCHAR(50) NOT NULL,
      performed_by VARCHAR(100),
      details TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  const companyDb = typeof db.forCompany === 'function' ? db.forCompany(companyId) : db;

  for (const sql of queries) {
    try {
      await companyDb.run(sql);
    } catch (err) {
      console.warn(`[operationalChargeEngine] ensureOperationalTables non-fatal:`, err.message);
    }
  }

  // Safe ALTER TABLE column additions for existing schemas
  const safeAlterColumns = [
    // Parties table missing columns
    `ALTER TABLE ${pfx}operational_parties ADD COLUMN party_code VARCHAR(50)`,
    `ALTER TABLE ${pfx}operational_parties ADD COLUMN category VARCHAR(50)`,
    `ALTER TABLE ${pfx}operational_parties ADD COLUMN party_category VARCHAR(50)`,
    `ALTER TABLE ${pfx}operational_parties ADD COLUMN print_name VARCHAR(150)`,
    `ALTER TABLE ${pfx}operational_parties ADD COLUMN contact_person VARCHAR(100)`,
    `ALTER TABLE ${pfx}operational_parties ADD COLUMN area VARCHAR(100)`,
    `ALTER TABLE ${pfx}operational_parties ADD COLUMN phone_res VARCHAR(30)`,
    `ALTER TABLE ${pfx}operational_parties ADD COLUMN phone_off VARCHAR(30)`,
    `ALTER TABLE ${pfx}operational_parties ADD COLUMN opening_balance NUMERIC(15,2) DEFAULT 0`,
    `ALTER TABLE ${pfx}operational_parties ADD COLUMN opening_balance_date DATE`,
    `ALTER TABLE ${pfx}operational_parties ADD COLUMN default_payment_mode VARCHAR(30) DEFAULT 'CASH'`,
    `ALTER TABLE ${pfx}operational_parties ADD COLUMN payment_mode VARCHAR(30) DEFAULT 'CASH'`,
    `ALTER TABLE ${pfx}operational_parties ADD COLUMN address TEXT`,
    `ALTER TABLE ${pfx}operational_parties ADD COLUMN whatsapp_number VARCHAR(30)`,
    `ALTER TABLE ${pfx}operational_parties ADD COLUMN email VARCHAR(100)`,
    `ALTER TABLE ${pfx}operational_parties ADD COLUMN bank_name VARCHAR(100)`,
    `ALTER TABLE ${pfx}operational_parties ADD COLUMN account_no VARCHAR(50)`,
    `ALTER TABLE ${pfx}operational_parties ADD COLUMN ifsc_code VARCHAR(30)`,
    `ALTER TABLE ${pfx}operational_parties ADD COLUMN upi_id VARCHAR(80)`,
    `ALTER TABLE ${pfx}operational_parties ADD COLUMN ledger_id INTEGER`,
    `ALTER TABLE ${pfx}operational_parties ADD COLUMN linked_ledger_id INTEGER`,
    `ALTER TABLE ${pfx}operational_parties ADD COLUMN linked_ledger_name TEXT`,
    `ALTER TABLE ${pfx}operational_parties ADD COLUMN rate_configuration TEXT`,
    `ALTER TABLE ${pfx}operational_parties ADD COLUMN bank_details_json TEXT`,
    `ALTER TABLE ${pfx}operational_parties ADD COLUMN notes TEXT`,
    `ALTER TABLE ${pfx}operational_parties ADD COLUMN is_active INTEGER DEFAULT 1`,
    `ALTER TABLE ${pfx}operational_parties ADD COLUMN per_kg_amount NUMERIC(12,2) DEFAULT 0.00`,
    `ALTER TABLE ${pfx}operational_parties ADD COLUMN period_duration VARCHAR(100)`,
    `ALTER TABLE ${pfx}operational_parties ADD COLUMN from_date DATE`,
    `ALTER TABLE ${pfx}operational_parties ADD COLUMN till_date DATE`,
    `ALTER TABLE ${pfx}operational_parties ADD COLUMN effective_from DATE`,
    `ALTER TABLE ${pfx}operational_parties ADD COLUMN effective_to DATE`,

    // Rate Masters missing columns
    `ALTER TABLE ${pfx}operational_rate_masters ADD COLUMN uom VARCHAR(20) DEFAULT 'BAG'`,
    `ALTER TABLE ${pfx}operational_rate_masters ADD COLUMN min_charge NUMERIC(12,2) DEFAULT 0.00`,
    `ALTER TABLE ${pfx}operational_rate_masters ADD COLUMN is_active INTEGER DEFAULT 1`,
    `ALTER TABLE ${pfx}operational_rate_masters ADD COLUMN description VARCHAR(255)`,

    // Charges table missing columns
    `ALTER TABLE ${pfx}operational_charges ADD COLUMN party_category VARCHAR(50)`,
    `ALTER TABLE ${pfx}operational_charges ADD COLUMN charge_category VARCHAR(50)`,
    `ALTER TABLE ${pfx}operational_charges ADD COLUMN date DATE`,
    `ALTER TABLE ${pfx}operational_charges ADD COLUMN charge_date DATE`,
    `ALTER TABLE ${pfx}operational_charges ADD COLUMN calculated_amount NUMERIC(12,2) DEFAULT 0.00`,
    `ALTER TABLE ${pfx}operational_charges ADD COLUMN adjustment_amount NUMERIC(12,2) DEFAULT 0.00`,
    `ALTER TABLE ${pfx}operational_charges ADD COLUMN final_amount NUMERIC(12,2) DEFAULT 0.00`,
    `ALTER TABLE ${pfx}operational_charges ADD COLUMN amount NUMERIC(12,2) DEFAULT 0.00`,
    `ALTER TABLE ${pfx}operational_charges ADD COLUMN total_amount NUMERIC(12,2) DEFAULT 0.00`,
    `ALTER TABLE ${pfx}operational_charges ADD COLUMN payment_status VARCHAR(30) DEFAULT 'UNPAID'`,
    `ALTER TABLE ${pfx}operational_charges ADD COLUMN status VARCHAR(30) DEFAULT 'UNPAID'`,
    `ALTER TABLE ${pfx}operational_charges ADD COLUMN approval_status VARCHAR(30) DEFAULT 'APPROVED'`,
    `ALTER TABLE ${pfx}operational_charges ADD COLUMN rate_basis VARCHAR(30) DEFAULT 'PER_BAG'`,
    `ALTER TABLE ${pfx}operational_charges ADD COLUMN calculation_basis VARCHAR(30) DEFAULT 'PER_BAG'`,
    `ALTER TABLE ${pfx}operational_charges ADD COLUMN rate_per_unit NUMERIC(12,2) DEFAULT 0.00`,
    `ALTER TABLE ${pfx}operational_charges ADD COLUMN rate NUMERIC(12,2) DEFAULT 0.00`,
    `ALTER TABLE ${pfx}operational_charges ADD COLUMN operation_type VARCHAR(50) DEFAULT 'LOADING'`,
    `ALTER TABLE ${pfx}operational_charges ADD COLUMN charge_type VARCHAR(50) DEFAULT 'LOADING'`,
    `ALTER TABLE ${pfx}operational_charges ADD COLUMN is_posted_to_accounts INTEGER DEFAULT 0`,
    `ALTER TABLE ${pfx}operational_charges ADD COLUMN accrual_voucher_id INTEGER`,
    `ALTER TABLE ${pfx}operational_charges ADD COLUMN accrual_voucher_no VARCHAR(50)`,
    `ALTER TABLE ${pfx}operational_charges ADD COLUMN expense_ledger_id INTEGER`,
    `ALTER TABLE ${pfx}operational_charges ADD COLUMN payable_ledger_id INTEGER`,
    `ALTER TABLE ${pfx}operational_charges ADD COLUMN notes TEXT`,
    `ALTER TABLE ${pfx}operational_charges ADD COLUMN remarks TEXT`,

    // Payments
    `ALTER TABLE ${pfx}operational_payments ADD COLUMN party_category VARCHAR(50)`,
    `ALTER TABLE ${pfx}operational_payments ADD COLUMN payment_mode VARCHAR(30) DEFAULT 'CASH'`,
    `ALTER TABLE ${pfx}operational_payments ADD COLUMN payment_method VARCHAR(30) DEFAULT 'CASH'`,
    `ALTER TABLE ${pfx}operational_payments ADD COLUMN paid_from_ledger_id INTEGER`,
    `ALTER TABLE ${pfx}operational_payments ADD COLUMN payable_ledger_id INTEGER`,
    `ALTER TABLE ${pfx}operational_payments ADD COLUMN notes TEXT`,
    `ALTER TABLE ${pfx}operational_payments ADD COLUMN remarks TEXT`,
    `ALTER TABLE ${pfx}operational_payments ADD COLUMN created_by VARCHAR(100)`,
    `ALTER TABLE ${pfx}operational_payments ADD COLUMN paid_by VARCHAR(100)`,

    // Audit logs
    `ALTER TABLE ${pfx}operational_audit_logs ADD COLUMN entity_ref VARCHAR(80)`,
    `ALTER TABLE ${pfx}operational_audit_logs ADD COLUMN performed_by VARCHAR(100)`,
    `ALTER TABLE ${pfx}operational_audit_logs ADD COLUMN details TEXT`
  ];

  for (const altSql of safeAlterColumns) {
    try {
      await companyDb.run(altSql);
    } catch (_) {
      // Column already exists, ignore error
    }
  }

  // Column value sync for backward compatibility (safely isolated per query)
  try {
    await companyDb.run(`UPDATE ${pfx}operational_parties SET party_code = 'OPP-GEN-' || id WHERE party_code IS NULL OR party_code = ''`);
  } catch (_) {}
  try {
    await companyDb.run(`UPDATE ${pfx}operational_parties SET category = COALESCE(category, party_category, 'LOADMAN') WHERE category IS NULL OR category = ''`);
  } catch (_) {}
  try {
    await companyDb.run(`UPDATE ${pfx}operational_parties SET party_category = COALESCE(party_category, category, 'LOADMAN') WHERE party_category IS NULL OR party_category = ''`);
  } catch (_) {}
  try {
    await companyDb.run(`UPDATE ${pfx}operational_parties SET default_payment_mode = COALESCE(default_payment_mode, payment_mode, 'CASH') WHERE default_payment_mode IS NULL OR default_payment_mode = ''`);
  } catch (_) {}
  try {
    await companyDb.run(`UPDATE ${pfx}operational_parties SET payment_mode = COALESCE(payment_mode, default_payment_mode, 'CASH') WHERE payment_mode IS NULL OR payment_mode = ''`);
  } catch (_) {}

  try {
    await companyDb.run(`UPDATE ${pfx}operational_charges SET date = COALESCE(date, charge_date, CURRENT_DATE) WHERE date IS NULL`);
  } catch (_) {}
  try {
    await companyDb.run(`UPDATE ${pfx}operational_charges SET final_amount = COALESCE(final_amount, total_amount, amount, 0.00) WHERE final_amount IS NULL OR final_amount = 0`);
  } catch (_) {}
  try {
    await companyDb.run(`UPDATE ${pfx}operational_charges SET payment_status = COALESCE(payment_status, status, 'UNPAID') WHERE payment_status IS NULL OR payment_status = ''`);
  } catch (_) {}
  try {
    await companyDb.run(`UPDATE ${pfx}operational_charges SET operation_type = COALESCE(operation_type, charge_type, 'LOADING') WHERE operation_type IS NULL OR operation_type = ''`);
  } catch (_) {}
  try {
    await companyDb.run(`UPDATE ${pfx}operational_charges SET charge_category = COALESCE(charge_category, party_category, 'LABOUR') WHERE charge_category IS NULL OR charge_category = ''`);
  } catch (_) {}
  try {
    await companyDb.run(`UPDATE ${pfx}operational_charges SET party_category = COALESCE(party_category, charge_category, 'LABOUR') WHERE party_category IS NULL OR party_category = ''`);
  } catch (_) {}
  try {
    await companyDb.run(`UPDATE ${pfx}operational_charges SET rate_basis = COALESCE(rate_basis, calculation_basis, 'PER_BAG') WHERE rate_basis IS NULL OR rate_basis = ''`);
  } catch (_) {}
  try {
    await companyDb.run(`UPDATE ${pfx}operational_charges SET rate_per_unit = COALESCE(rate_per_unit, rate, 0.00) WHERE rate_per_unit IS NULL OR rate_per_unit = 0`);
  } catch (_) {}

  // Seed default rate masters and default parties if empty
  await seedDefaultRateMasters(companyId);
  await seedDefaultParties(companyId);
  await backfillMissingLoadmanParties(companyId);

  if (db.isPostgres && typeof db.ensurePostgresCompanySequences === 'function') {
    await db.ensurePostgresCompanySequences(companyId).catch(() => {});
  }
}

/**
 * Seed default parties if empty
 */
async function seedDefaultParties(companyId = 1) {
  const pfx = getPrefix(companyId);
  const companyDb = typeof db.forCompany === 'function' ? db.forCompany(companyId) : db;
  try {
    const existing = await companyDb.get(`SELECT id FROM ${pfx}operational_parties WHERE id = 1 OR party_code = 'OPP-GEN-0001' LIMIT 1`);
    if (!existing) {
      const isPostgres = db.isPostgres;
      if (isPostgres) {
        await companyDb.run(
          `INSERT INTO ${pfx}operational_parties (id, party_code, name, category, party_category, default_payment_mode, payment_mode, is_active)
           VALUES (1, 'OPP-GEN-0001', 'General Labour Pool', 'LOADMAN', 'LOADMAN', 'CASH', 'CASH', 1)
           ON CONFLICT (id) DO NOTHING`
        );
      } else {
        await companyDb.run(
          `INSERT OR IGNORE INTO ${pfx}operational_parties (id, party_code, name, category, party_category, default_payment_mode, payment_mode, is_active)
           VALUES (1, 'OPP-GEN-0001', 'General Labour Pool', 'LOADMAN', 'LOADMAN', 'CASH', 'CASH', 1)`
        );
      }
    }
    if (db.isPostgres) {
      await companyDb.run(
        `SELECT setval(pg_get_serial_sequence('${pfx}operational_parties', 'id'), COALESCE((SELECT MAX(id) FROM ${pfx}operational_parties), 1), true)`
      ).catch(() => {});
    }
  } catch (err) {
    console.warn('[operationalChargeEngine] seedDefaultParties non-fatal:', err.message);
  }
}

const EXCLUDED_LOADMAN_NAMES = new Set([
  '',
  'general labour pool',
  'loadman',
  'loadman charges',
  'loadman payable',
  'labour charges',
  'wages',
  'unloading charges',
  'loading charges',
  'inward loadman team',
  'outward loading team',
  'manual',
  'none',
  'null',
  'undefined',
  'n/a',
  'direct expenses',
  'indirect expenses',
  'current liabilities'
]);

function normalizeCandidateLoadmanName(rawName) {
  if (rawName === null || rawName === undefined) return '';
  const cleaned = String(rawName)
    .trim()
    .replace(/\s*\((Worker|Loadman|Loadmen|Labour|Driver|Helper|Artisan|Contractor)\)$/i, '')
    .trim();
  if (!cleaned) return '';
  if (/^\d+$/.test(cleaned)) return '';
  const lower = cleaned.toLowerCase();
  if (EXCLUDED_LOADMAN_NAMES.has(lower)) return '';
  if (/\b(charges|payable|expense|recovery|account|gst|cgst|sgst|igst|tds|vat|round off)\b/i.test(cleaned)) {
    return '';
  }
  return cleaned;
}

/**
 * Idempotently recover previously created or used Loadman masters into operational_parties
 * for companies whose operational_parties table only has the seeded General Labour Pool
 * (e.g., after schema sync, legacy person_master usage, or backup restores).
 */
async function backfillMissingLoadmanParties(companyId = 1) {
  const pfx = getPrefix(companyId);
  const companyDb = typeof db.forCompany === 'function' ? db.forCompany(companyId) : db;

  try {
    const existingRows = await companyDb.all(`SELECT name, party_code FROM ${pfx}operational_parties`).catch(() => []);
    const existingNames = new Set();
    const existingCodes = new Set();
    let maxLmNum = 0;

    for (const r of existingRows || []) {
      const n = String(r.name || '').trim().toLowerCase();
      if (n) existingNames.add(n);
      const code = String(r.party_code || '').trim();
      if (code) {
        existingCodes.add(code.toUpperCase());
        const m = code.match(/^LM-(\d+)$/i);
        if (m) maxLmNum = Math.max(maxLmNum, parseInt(m[1], 10) || 0);
      }
    }

    // Respect records intentionally deleted to Recycle Bin
    const deletedNames = new Set();
    try {
      const binRows = await companyDb.all(
        `SELECT title, record_data FROM recycle_bin WHERE LOWER(COALESCE(module_name, '')) LIKE '%operational%' OR LOWER(COALESCE(module_name, '')) LIKE '%loadman%'`
      );
      for (const b of binRows || []) {
        const t = String(b.title || '').trim().toLowerCase();
        if (t) deletedNames.add(t);
        if (b.record_data) {
          try {
            const parsed = typeof b.record_data === 'string' ? JSON.parse(b.record_data) : b.record_data;
            const recName = parsed?.record?.name || parsed?.name;
            if (recName) deletedNames.add(String(recName).trim().toLowerCase());
          } catch (_) {}
        }
      }
    } catch (_) {}

    const candidates = new Map();
    const upsertCandidate = (rawName, meta = {}) => {
      const cleanName = normalizeCandidateLoadmanName(rawName);
      if (!cleanName) return;
      const key = cleanName.toLowerCase();
      if (existingNames.has(key) || deletedNames.has(key)) return;

      const prev = candidates.get(key) || {
        name: cleanName,
        print_name: cleanName,
        contact_person: null,
        phone: null,
        phone_res: null,
        phone_off: null,
        address: null,
        area: null,
        opening_balance: 0,
        per_kg_amount: 0,
        ledger_id: null
      };

      candidates.set(key, {
        name: prev.name || cleanName,
        print_name: prev.print_name || meta.print_name || cleanName,
        contact_person: prev.contact_person || meta.contact_person || null,
        phone: prev.phone || meta.phone || null,
        phone_res: prev.phone_res || meta.phone_res || null,
        phone_off: prev.phone_off || meta.phone_off || null,
        address: prev.address || meta.address || null,
        area: prev.area || meta.area || null,
        opening_balance: prev.opening_balance || Number(meta.opening_balance || 0) || 0,
        per_kg_amount: prev.per_kg_amount > 0 ? prev.per_kg_amount : (Number(meta.per_kg_amount || 0) || 0),
        ledger_id: prev.ledger_id || meta.ledger_id || null
      });
    };

    // 1. Legacy person_master
    try {
      const persons = await companyDb.all(`SELECT * FROM person_master`);
      for (const p of persons || []) {
        const st = String(p.status || 'Active').trim().toLowerCase();
        if (st === 'inactive' || st === 'deleted' || st === '0' || st === 'false') continue;
        upsertCandidate(p.name, {
          print_name: p.print_name || p.name,
          contact_person: p.contact_person || null,
          address: p.address || null,
          area: p.area || null,
          phone: p.mobile || p.phone_off || p.phone_res || null,
          phone_res: p.phone_res || null,
          phone_off: p.phone_off || null
        });
      }
    } catch (_) {}

    // 2. Worker / Loadman ledgers in ledgermaster
    try {
      const lmRows = await companyDb.all(`
        SELECT id, COALESCE(NULLIF(TRIM(ledger_name), ''), name) AS name, printname,
               under, group_name, ledger_type,
               COALESCE(opening_balance, openingbalance, 0) AS opening_balance,
               status
        FROM ledgermaster
        WHERE LOWER(TRIM(COALESCE(ledger_type, ''))) IN ('worker', 'loadman', 'loadmen', 'labour', 'unload_worker')
           OR LOWER(TRIM(COALESCE(under, group_name, ''))) LIKE '%loadman%'
           OR LOWER(TRIM(COALESCE(under, group_name, ''))) LIKE '%worker%'
      `);
      for (const lm of lmRows || []) {
        const st = String(lm.status || 'Active').trim().toLowerCase();
        if (st === 'inactive' || st === 'deleted' || st === '0' || st === 'false') continue;
        upsertCandidate(lm.name, {
          print_name: lm.printname || lm.name,
          opening_balance: Number(lm.opening_balance || 0),
          ledger_id: lm.id || null
        });
      }
    } catch (_) {}

    // 3. Operational charges history
    try {
      const ocRows = await companyDb.all(`
        SELECT DISTINCT party_name
        FROM ${pfx}operational_charges
        WHERE UPPER(COALESCE(party_category, charge_category, '')) IN ('LOADMAN', 'LOADMEN', 'WORKER', 'UNLOAD_WORKER', 'HELPER', 'LABOUR')
          AND party_name IS NOT NULL AND TRIM(party_name) != ''
      `);
      for (const oc of ocRows || []) {
        upsertCandidate(oc.party_name);
      }
    } catch (_) {}

    // 4. Transaction tables referencing loadman_name
    for (const tbl of ['purchases', 'sales', 'flour_out', 'cold_storage_vouchers', 'quotations']) {
      try {
        let rows;
        try {
          rows = await companyDb.all(
            `SELECT TRIM(loadman_name) AS name, MAX(COALESCE(loadman_rate_per_kg, 0)) AS rate
             FROM ${tbl}
             WHERE loadman_name IS NOT NULL AND TRIM(loadman_name) != ''
             GROUP BY TRIM(loadman_name)`
          );
        } catch (_) {
          rows = await companyDb.all(
            `SELECT DISTINCT TRIM(loadman_name) AS name
             FROM ${tbl}
             WHERE loadman_name IS NOT NULL AND TRIM(loadman_name) != ''`
          );
        }
        for (const r of rows || []) {
          upsertCandidate(r.name, { per_kg_amount: Number(r.rate || 0) });
        }
      } catch (_) {}
    }

    if (candidates.size === 0) return 0;

    if (db.isPostgres) {
      await companyDb.run(
        `SELECT setval(pg_get_serial_sequence('${pfx}operational_parties', 'id'), COALESCE((SELECT MAX(id) FROM ${pfx}operational_parties), 1), true)`
      ).catch(() => {});
    }

    let insertedCount = 0;
    for (const [key, cand] of candidates.entries()) {
      let partyCode;
      do {
        maxLmNum += 1;
        partyCode = `LM-${String(maxLmNum).padStart(3, '0')}`;
      } while (existingCodes.has(partyCode.toUpperCase()));
      existingCodes.add(partyCode.toUpperCase());

      let ledgerId = cand.ledger_id;
      if (!ledgerId) {
        try {
          const lmMatch = await companyDb.get(
            `SELECT id FROM ledgermaster WHERE LOWER(TRIM(COALESCE(NULLIF(TRIM(ledger_name), ''), name))) = LOWER(TRIM(?)) LIMIT 1`,
            [cand.name]
          );
          if (lmMatch?.id) ledgerId = lmMatch.id;
        } catch (_) {}
      }

      try {
        await companyDb.run(
          `INSERT INTO ${pfx}operational_parties (
            party_code, name, print_name, contact_person, category, party_category,
            phone, phone_res, phone_off, address, area,
            default_payment_mode, payment_mode, opening_balance, per_kg_amount,
            ledger_id, linked_ledger_id, linked_ledger_name, is_active
          ) VALUES (?, ?, ?, ?, 'LOADMAN', 'LOADMAN', ?, ?, ?, ?, ?, 'CASH', 'CASH', ?, ?, ?, ?, ?, 1)`,
          [
            partyCode,
            cand.name,
            cand.print_name || cand.name,
            cand.contact_person || null,
            cand.phone || null,
            cand.phone_res || null,
            cand.phone_off || null,
            cand.address || null,
            cand.area || null,
            Number(cand.opening_balance || 0),
            Number(cand.per_kg_amount || 0),
            ledgerId || null,
            ledgerId || null,
            cand.name
          ]
        );
        existingNames.add(key);
        insertedCount += 1;
      } catch (insErr) {
        if (insErr.code !== '23505') {
          console.warn(`[operationalChargeEngine] backfill '${cand.name}' non-fatal:`, insErr.message);
        }
      }
    }

    if (insertedCount > 0) {
      if (db.isPostgres) {
        await companyDb.run(
          `SELECT setval(pg_get_serial_sequence('${pfx}operational_parties', 'id'), COALESCE((SELECT MAX(id) FROM ${pfx}operational_parties), 1), true)`
        ).catch(() => {});
      }
      console.log(`🔄 [operationalChargeEngine] Backfilled ${insertedCount} Loadman master(s) for company ${companyId}`);
    }
    return insertedCount;
  } catch (err) {
    console.warn('[operationalChargeEngine] backfillMissingLoadmanParties non-fatal:', err.message);
    return 0;
  }
}

/**
 * Seed default rates (per bag, per tonne, per trip) only once during initial setup
 */
async function seedDefaultRateMasters(companyId = 1) {
  const pfx = getPrefix(companyId);
  try {
    // Ensure operational_settings table exists
    await db.run(`
      CREATE TABLE IF NOT EXISTS ${pfx}operational_settings (
        setting_key TEXT PRIMARY KEY,
        setting_value TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Check if initial seeding was ever performed
    const initCheck = await db.get(`SELECT setting_value FROM ${pfx}operational_settings WHERE setting_key = 'op_rates_init_done'`);
    if (initCheck && initCheck.setting_value === '1') {
      return; // Already initialized once. Never re-seed or restore deleted rows!
    }

    const existing = await db.all(`SELECT id FROM ${pfx}operational_rate_masters LIMIT 1`);
    if (existing && existing.length > 0) {
      await db.run(`INSERT OR REPLACE INTO ${pfx}operational_settings (setting_key, setting_value) VALUES ('op_rates_init_done', '1')`);
      return;
    }

    const defaults = [
      { code: 'RATE-LOAD-BAG', op: 'LOADING', cat: 'LABOUR', basis: 'PER_BAG', rate: 2.50, min: 50, desc: 'Vehicle Loading - ₹2.50 per bag' },
      { code: 'RATE-UNLOAD-BAG', op: 'UNLOADING', cat: 'LABOUR', basis: 'PER_BAG', rate: 2.50, min: 50, desc: 'Vehicle Unloading - ₹2.50 per bag' },
      { code: 'RATE-INTRA-TRIP', op: 'GODOWN_TRANSFER', cat: 'TRANSPORT', basis: 'PER_TRIP', rate: 450.00, min: 450, desc: 'Intra-Godown Transfer - ₹450 per vehicle trip' },
      { code: 'RATE-OUTPASS-TON', op: 'OUTPASS_MILL', cat: 'TRANSPORT', basis: 'PER_TONNE', rate: 180.00, min: 500, desc: 'External Mill Outpass - ₹180 per MT' },
      { code: 'RATE-INPASS-TON', op: 'INPASS_RECEIPT', cat: 'LABOUR', basis: 'PER_TONNE', rate: 120.00, min: 300, desc: 'Processed Inpass Unloading - ₹120 per MT' },
      { code: 'RATE-DRIVER-TRIP', op: 'DRIVER_ALLOWANCE', cat: 'DRIVER_BATTA', basis: 'PER_TRIP', rate: 300.00, min: 300, desc: 'Local Driver Batta - ₹300 per trip' }
    ];

    for (const r of defaults) {
      const exists = await db.get(`SELECT id FROM ${pfx}operational_rate_masters WHERE rate_code = ?`, [r.code]);
      if (!exists) {
        const uom = r.basis === 'PER_BAG' ? 'BAG' : r.basis === 'PER_TONNE' ? 'MT' : 'TRIP';
        const isPostgres = db.isPostgres;
        if (isPostgres) {
          await db.run(
            `INSERT INTO ${pfx}operational_rate_masters (rate_code, operation_type, charge_category, rate_basis, rate_per_unit, min_charge, description, uom, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
             ON CONFLICT (rate_code) DO NOTHING`,
            [r.code, r.op, r.cat, r.basis, r.rate, r.min, r.desc, uom]
          );
        } else {
          await db.run(
            `INSERT OR IGNORE INTO ${pfx}operational_rate_masters (rate_code, operation_type, charge_category, rate_basis, rate_per_unit, min_charge, description, uom, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [r.code, r.op, r.cat, r.basis, r.rate, r.min, r.desc, uom]
          );
        }
      }
    }

    await db.run(`INSERT OR REPLACE INTO ${pfx}operational_settings (setting_key, setting_value) VALUES ('op_rates_init_done', '1')`);
  } catch (err) {
    console.warn('[operationalChargeEngine] seedDefaultRateMasters non-fatal:', err.message);
  }
}

/**
 * Generate sequential numbers for charges & payments
 */
async function generateNumber(companyId, type) {
  const pfx = getPrefix(companyId);
  const prefixCode = type === 'CHARGE' ? 'OPC' : 'OPP';
  const table = type === 'CHARGE' ? `${pfx}operational_charges` : `${pfx}operational_payments`;
  const col = type === 'CHARGE' ? 'charge_no' : 'payment_no';

  try {
    const rows = await db.all(`SELECT ${col} as code FROM ${table} WHERE ${col} LIKE ? ORDER BY id DESC`, [`${prefixCode}%`]);
    let maxNum = 0;
    const escaped = prefixCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^${escaped}-?(\\d+)$`, 'i');
    for (const r of rows || []) {
      const m = String(r.code || '').trim().match(regex);
      if (m) {
        const parsed = parseInt(m[1], 10);
        if (!Number.isNaN(parsed) && parsed > maxNum) {
          maxNum = parsed;
        }
      }
    }
    let nextNum = maxNum + 1;
    while (true) {
      const candidate = `${prefixCode}-${String(nextNum).padStart(5, '0')}`;
      const check = await db.get(`SELECT id FROM ${table} WHERE ${col} = ? LIMIT 1`, [candidate]);
      if (!check) return candidate;
      nextNum++;
    }
  } catch (e) {
    return `${prefixCode}-${Date.now().toString().slice(-5)}`;
  }
}

/**
 * Find or create ledgers for accounting integration
 */
async function resolveOperationalLedgers(companyId = 1, partyName = null, partyCategory = 'LOADMAN', paymentMode = 'CASH') {
  const cId = AccountingEngine.getActiveCompanyId(companyId);
  const cDb = db.forCompany(cId);

  const expenseLedger = await AccountingEngine.resolveOrCreateLedger({
    companyId: cId,
    name: 'Loading & Operational Charges',
    groupName: 'Direct Expenses',
    ledgerType: 'Expense',
  });

  const cleanPartyName = String(partyName || '').trim() || 'Operational Charges Payable';
  const isTransport = String(partyCategory || '').toUpperCase().includes('TRANSPORT');
  const payableLedger = await AccountingEngine.resolveOrCreateLedger({
    companyId: cId,
    name: cleanPartyName,
    ledgerType: isTransport ? 'Transporter' : 'Worker',
  });

  const modeLower = String(paymentMode || 'CASH').toLowerCase();
  const isBank = modeLower.includes('bank') || modeLower.includes('neft') || modeLower.includes('rtgs') || modeLower.includes('upi') || modeLower.includes('cheque');
  const cashLedger = await AccountingEngine.resolveOrCreateLedger({
    companyId: cId,
    name: isBank ? 'Bank Account' : 'Cash in Hand',
    groupName: isBank ? 'Bank Accounts' : 'Cash-in-hand',
    ledgerType: 'Asset',
  });

  // Verify ledger IDs exist inside this company schema
  await cDb.query(`SELECT id FROM ledgermaster WHERE id = ? LIMIT 1`, [expenseLedger.id]).catch(() => {});

  return { expenseLedger, payableLedger, cashLedger };
}

/**
 * Create an Operational Charge record from any module (Purchase, Sales, Inpass, Outpass, Godown Transfer, Vehicle Movement)
 */
async function recordOperationalCharge(params = {}) {
  const companyId = AccountingEngine.getActiveCompanyId(params.companyId || params.company_id);
  const cDb = db.forCompany(companyId);
  await ensureOperationalTables(companyId);
  const pfx = getPrefix(companyId);

  const sourceModule = params.sourceModule || params.source_module || 'General';
  const sourceTransactionNo = params.sourceTransactionNo || params.source_transaction_no || null;
  const sourceTransactionId = params.sourceTransactionId || params.source_transaction_id || null;
  const date = AccountingEngine.normalizeDateIso(params.date || new Date().toISOString().split('T')[0]);
  const operationType = params.operationType || params.operation_type || params.charge_type || 'LOADING';
  const chargeCategory = params.chargeCategory || params.charge_category || params.party_category || 'LABOUR';
  let partyId = params.partyId || params.party_id || null;
  let partyName = params.partyName || params.party_name || null;
  let partyCategory = params.partyCategory || params.party_category || 'LOADMAN';
  const rateBasis = params.rateBasis || params.rate_basis || params.calculation_basis || 'PER_BAG';
  const ratePerUnit = Number(params.ratePerUnit ?? params.rate_per_unit ?? params.rate ?? 0);
  const quantity = Number(params.quantity ?? 0);
  const uom = params.uom || 'BAG';
  const adjustmentAmount = Number(params.adjustmentAmount ?? params.adjustment_amount ?? 0);
  const fromLocation = params.fromLocation || params.from_location || '';
  const toLocation = params.toLocation || params.to_location || '';
  const vehicleNo = params.vehicleNo || params.vehicle_no || '';
  const driverName = params.driverName || params.driver_name || '';
  const lines = params.lines || params.workers || [];
  const notes = params.notes || params.remarks || '';
  const createdBy = params.createdBy || params.created_by || params.paid_by || 'System User';
  const autoPostToAccounts = params.autoPostToAccounts !== false;

  const resultObj = await cDb.withTransaction(async () => {
    if (partyId && !partyName) {
      const party = await cDb.get(`SELECT name, category FROM ${pfx}operational_parties WHERE id = ?`, [partyId]);
      if (party) {
        partyName = party.name;
        partyCategory = party.category || partyCategory;
      }
    }

    if (!partyId && partyName) {
      const existingParty = await cDb.get(`SELECT id, category FROM ${pfx}operational_parties WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))`, [partyName]);
      if (existingParty) {
        partyId = existingParty.id;
        partyCategory = existingParty.category || partyCategory;
      }
    }

    const resolvedPartyName = (partyName && String(partyName).trim()) ? String(partyName).trim() : 'General Labour Pool';

    const explicitAmount = params.amount !== undefined && params.amount !== '' ? Number(params.amount) : null;
    const baseAmount = (explicitAmount !== null && !isNaN(explicitAmount) && explicitAmount > 0)
      ? AccountingEngine.round2(explicitAmount)
      : AccountingEngine.round2(ratePerUnit * quantity);
    const finalAmount = AccountingEngine.round2(Math.max(0, baseAmount + adjustmentAmount));
    const chargeNo = params.charge_no || params.chargeNo || await generateNumber(companyId, 'CHARGE');
    const chargeDate = date;

    const { expenseLedger, payableLedger } = await resolveOperationalLedgers(companyId, resolvedPartyName, partyCategory);

    const insertSql = `
      INSERT INTO ${pfx}operational_charges (
        charge_no, date, charge_date, source_module, source_transaction_no, source_transaction_id,
        operation_type, charge_type, charge_category, party_id, party_name, party_category,
        rate_basis, calculation_basis, rate_per_unit, rate, quantity, uom, calculated_amount, adjustment_amount,
        final_amount, amount, total_amount, paid_amount, balance_amount, payment_status, status, approval_status,
        is_posted_to_accounts, accrual_voucher_id, accrual_voucher_no,
        expense_ledger_id, payable_ledger_id, from_location, to_location,
        vehicle_no, driver_name, notes, remarks, created_by
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `;

    const chargeParams = [
      chargeNo, chargeDate, chargeDate, sourceModule, sourceTransactionNo || null, sourceTransactionId || null,
      operationType, operationType, chargeCategory, partyId || 1, resolvedPartyName, partyCategory,
      rateBasis, rateBasis, ratePerUnit, ratePerUnit, quantity, uom, baseAmount, adjustmentAmount,
      finalAmount, finalAmount, finalAmount, 0.00, finalAmount, 'UNPAID', 'UNPAID', 'APPROVED',
      0, null, null,
      expenseLedger.id, payableLedger.id,
      fromLocation, toLocation, vehicleNo, driverName, notes, notes, createdBy
    ];

    const res = await cDb.run(insertSql, chargeParams);
    const chargeId = res.lastID || res.lastInsertRowid;

    if (Array.isArray(lines) && lines.length > 0) {
      let lineIdx = 1;
      for (const l of lines) {
        const lineAmt = Number(l.line_amount ?? l.lineAmount ?? l.amount ?? 0);
        const bagCount = Number(l.bag_count ?? l.bagCount ?? 0);
        const weightKg = Number(l.weight_kg ?? l.weightKg ?? 0);
        const unitRate = Number(l.unit_rate ?? l.unitRate ?? ratePerUnit);
        await cDb.run(
          `INSERT INTO ${pfx}operational_charge_lines (charge_id, line_no, item_name, lot_no, bag_count, weight_kg, unit_rate, line_amount, remarks)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            chargeId, lineIdx++, l.item_name || l.party_name || l.worker_role || 'Worker', l.lot_no || '',
            bagCount, weightKg, unitRate, lineAmt, l.remarks || l.worker_role || ''
          ]
        );
      }
    }

    let accrualVoucherId = null;
    let accrualVoucherNo = null;
    let isPosted = 0;

    // For Purchases, createPurchaseVoucherChain already includes loadman/unloading charges authoritatively in PUR voucher.
    const isPurchaseSource = String(sourceModule || '').toLowerCase().includes('purchase');

    if (autoPostToAccounts && !isPurchaseSource && finalAmount > 0) {
      const voucherRes = await AccountingEngine.postVoucher({
        companyId,
        voucherType: 'Operational Charge',
        prefix: 'OPC',
        date: chargeDate,
        referenceNo: chargeNo,
        narration: `Accrual of ${operationType} charge for ${sourceModule} ${sourceTransactionNo || ''} - Party: ${resolvedPartyName}`,
        sourceModule: 'operational_charge',
        sourceId: Number(chargeId),
        postingKey: `operational_charge:${chargeId}`,
        lines: [
          {
            ledgerId: expenseLedger.id,
            ledgerName: expenseLedger.name,
            debit: finalAmount,
            credit: 0,
            remarks: `${operationType} expense (${quantity} ${uom} @ ₹${ratePerUnit})`,
            referenceId: chargeId,
            referenceType: 'operational_charge',
            transactionId: chargeId,
            transactionType: 'operational_charge',
          },
          {
            ledgerId: payableLedger.id,
            ledgerName: payableLedger.name,
            debit: 0,
            credit: finalAmount,
            remarks: `Payable to ${resolvedPartyName} for ${chargeNo}`,
            referenceId: chargeId,
            referenceType: 'operational_charge',
            transactionId: chargeId,
            transactionType: 'operational_charge',
          }
        ],
        allowUpdate: true,
        preserveVoucherNoOnUpdate: true,
      });

      accrualVoucherId = voucherRes.voucherId;
      accrualVoucherNo = voucherRes.voucherNo;
      isPosted = 1;

      await cDb.run(
        `UPDATE ${pfx}operational_charges SET is_posted_to_accounts = 1, accrual_voucher_id = ?, accrual_voucher_no = ? WHERE id = ?`,
        [accrualVoucherId, accrualVoucherNo, chargeId]
      );
    }

    await logOperationalAudit(companyId, 'CHARGE', chargeId, chargeNo, 'CREATED', createdBy, {
      sourceModule, sourceTransactionNo, finalAmount, partyName: resolvedPartyName, operationType
    });

    return {
      id: chargeId,
      charge_no: chargeNo,
      final_amount: finalAmount,
      balance_amount: finalAmount,
      accrual_voucher_id: accrualVoucherId,
      accrual_voucher_no: accrualVoucherNo,
      is_posted_to_accounts: isPosted,
      partyName: resolvedPartyName,
      partyCategory,
    };
  });

  try {
    let notifEvent = 'LOADING_CHARGE_CREATED';
    if (operationType === 'UNLOADING') notifEvent = 'UNLOADING_CHARGE_CREATED';
    else if (operationType === 'GODOWN_TRANSFER' || sourceModule === 'GodownTransfer') notifEvent = 'TRANSFER_CHARGE_CREATED';
    else if (chargeCategory === 'DRIVER_BATTA') notifEvent = 'DRIVER_CHARGE_CREATED';

    emitTransactionEvent(companyId, notifEvent, resultObj.charge_no, resultObj.id, {
      charge_no: resultObj.charge_no,
      source_module: sourceModule,
      source_transaction_no: sourceTransactionNo || '',
      operation_type: operationType,
      party_name: resultObj.partyName,
      party_category: resultObj.partyCategory,
      rate_basis: rateBasis,
      rate_per_unit: ratePerUnit,
      quantity,
      uom,
      final_amount: resultObj.final_amount,
      balance_amount: resultObj.balance_amount,
      vehicle_no: vehicleNo || '',
      driver_name: driverName || '',
      from_location: fromLocation || '',
      to_location: toLocation || '',
      status: 'APPROVED / UNPAID'
    }, createdBy);
  } catch (notifErr) {
    console.warn('[operationalChargeEngine] Notification dispatch error:', notifErr.message);
  }

  return {
    id: resultObj.id,
    charge_no: resultObj.charge_no,
    final_amount: resultObj.final_amount,
    balance_amount: resultObj.balance_amount,
    accrual_voucher_no: resultObj.accrual_voucher_no,
    is_posted_to_accounts: resultObj.is_posted_to_accounts
  };
}

/**
 * Record a payment against an operational party and allocate against pending charges
 */
async function recordOperationalPayment(params = {}) {
  const companyId = AccountingEngine.getActiveCompanyId(params.companyId || params.company_id);
  const cDb = db.forCompany(companyId);
  await ensureOperationalTables(companyId);
  const pfx = getPrefix(companyId);

  let partyId = params.partyId || params.party_id;
  let partyName = params.partyName || params.party_name;
  let partyCategory = params.party_category || params.category || 'LOADMAN';
  const paymentDate = AccountingEngine.normalizeDateIso(params.paymentDate || params.payment_date || params.date || new Date().toISOString().split('T')[0]);
  const paymentMode = params.paymentMode || params.payment_mode || params.payment_method || 'CASH';
  const paidAmount = AccountingEngine.round2(Number(params.paidAmount ?? params.paid_amount ?? params.amount ?? 0));
  const referenceNo = params.referenceNo || params.reference_no || '';
  const paidFromLedgerId = params.paidFromLedgerId || params.paid_from_ledger_id;
  const rawAllocations = params.allocations || [];
  const notes = params.notes || params.remarks || '';
  const createdBy = params.createdBy || params.created_by || params.paid_by || 'Cashier';
  const autoPostToAccounts = params.autoPostToAccounts !== false;

  if (paidAmount <= 0) {
    throw new Error('Payment amount must be greater than 0');
  }

  const resultObj = await cDb.withTransaction(async () => {
    if (partyId && !partyName) {
      const party = await cDb.get(`SELECT name, category FROM ${pfx}operational_parties WHERE id = ?`, [partyId]);
      if (party) {
        partyName = party.name;
        partyCategory = party.category || partyCategory;
      }
    }

    if (!partyId && partyName && String(partyName).trim()) {
      const cleanName = String(partyName).trim();
      const party = await cDb.get(`SELECT id, name, category FROM ${pfx}operational_parties WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))`, [cleanName]);
      if (party) {
        partyId = party.id;
        partyName = party.name;
        partyCategory = party.category || partyCategory;
      } else {
        const existingCodes = await cDb.all(`SELECT party_code FROM ${pfx}operational_parties WHERE party_code LIKE 'OPP-%'`);
        let maxPartyNum = 0;
        for (const r of existingCodes || []) {
          const m = String(r.party_code || '').trim().match(/^OPP-(\d+)$/i);
          if (m) {
            const parsed = parseInt(m[1], 10);
            if (!Number.isNaN(parsed) && parsed > maxPartyNum) {
              maxPartyNum = parsed;
            }
          }
        }
        let nextPartyNum = maxPartyNum + 1;
        let pCode = '';
        while (true) {
          const candidate = `OPP-${String(nextPartyNum).padStart(4, '0')}`;
          const dup = await cDb.get(`SELECT id FROM ${pfx}operational_parties WHERE party_code = ? LIMIT 1`, [candidate]);
          if (!dup) {
            pCode = candidate;
            break;
          }
          nextPartyNum++;
        }
        const pMode = paymentMode || 'CASH';
        const pIns = await cDb.run(
          `INSERT INTO ${pfx}operational_parties (party_code, name, category, party_category, default_payment_mode, payment_mode, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
          [pCode, cleanName, partyCategory, partyCategory, pMode, pMode]
        );
        partyId = pIns.lastID || pIns.lastInsertRowid;
        partyName = cleanName;
      }
    }

    if (!partyId && !partyName) {
      partyId = 1;
      partyName = 'General Labour Pool';
    }

    const paymentNo = await generateNumber(companyId, 'PAYMENT');
    const payDate = paymentDate;

    const { payableLedger, cashLedger } = await resolveOperationalLedgers(companyId, partyName, partyCategory, paymentMode);
    let fromLedger = cashLedger;
    if (paidFromLedgerId) {
      fromLedger = await AccountingEngine.resolveOrCreateLedger({ companyId, ledgerId: paidFromLedgerId });
    }

    const payIns = await cDb.run(
      `INSERT INTO ${pfx}operational_payments (
        payment_no, payment_date, party_id, party_name, party_category, payment_mode, payment_method, paid_amount,
        reference_no, voucher_id, voucher_no, paid_from_ledger_id, payable_ledger_id,
        notes, remarks, created_by, paid_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        paymentNo, payDate, partyId || 1, partyName, partyCategory, paymentMode, paymentMode, paidAmount,
        referenceNo, null, null, fromLedger.id, payableLedger.id,
        notes, notes, createdBy, createdBy
      ]
    );
    const paymentId = payIns.lastID || payIns.lastInsertRowid;

    let paymentVoucherId = null;
    let paymentVoucherNo = null;

    if (autoPostToAccounts) {
      const voucherRes = await AccountingEngine.postVoucher({
        companyId,
        voucherType: 'Payment',
        prefix: 'PAY',
        date: payDate,
        referenceNo: paymentNo,
        narration: `Operational Payment to ${partyName} - Ref: ${referenceNo || paymentNo}`,
        sourceModule: 'operational_payment',
        sourceId: Number(paymentId),
        postingKey: `operational_payment:${paymentId}`,
        lines: [
          {
            ledgerId: payableLedger.id,
            ledgerName: payableLedger.name,
            debit: paidAmount,
            credit: 0,
            remarks: `Clearing operational dues for ${partyName} (${paymentNo})`,
            referenceId: paymentId,
            referenceType: 'operational_payment',
            transactionId: paymentId,
            transactionType: 'operational_payment',
          },
          {
            ledgerId: fromLedger.id,
            ledgerName: fromLedger.name,
            debit: 0,
            credit: paidAmount,
            remarks: `Paid via ${paymentMode}`,
            referenceId: paymentId,
            referenceType: 'operational_payment',
            transactionId: paymentId,
            transactionType: 'operational_payment',
          }
        ],
        allowUpdate: true,
        preserveVoucherNoOnUpdate: true,
      });

      paymentVoucherId = voucherRes.voucherId;
      paymentVoucherNo = voucherRes.voucherNo;

      await cDb.run(
        `UPDATE ${pfx}operational_payments SET voucher_id = ?, voucher_no = ? WHERE id = ?`,
        [paymentVoucherId, paymentVoucherNo, paymentId]
      );
    }

    const allocations = (Array.isArray(rawAllocations) ? rawAllocations : []).map(a => ({
      charge_id: a.charge_id || a.chargeId,
      amount: Number(a.amount ?? a.allocated_amount ?? a.allocatedAmount ?? 0)
    }));

    let remainingToAllocate = paidAmount;

    if (allocations.length > 0) {
      for (const alloc of allocations) {
        const allocAmt = Math.min(Number(alloc.amount || 0), remainingToAllocate);
        if (allocAmt > 0 && alloc.charge_id) {
          await applyChargeAllocation(companyId, paymentId, alloc.charge_id, allocAmt);
          remainingToAllocate = AccountingEngine.round2(remainingToAllocate - allocAmt);
        }
      }
    }

    if (remainingToAllocate > 0) {
      const pendingCharges = await cDb.all(
        `SELECT id, balance_amount FROM ${pfx}operational_charges
         WHERE party_id = ? AND balance_amount > 0 AND approval_status = 'APPROVED'
         ORDER BY date ASC, id ASC`,
        [partyId || 1]
      );

      for (const charge of (pendingCharges || [])) {
        if (remainingToAllocate <= 0) break;
        const canPay = Math.min(Number(charge.balance_amount), remainingToAllocate);
        if (canPay > 0) {
          await applyChargeAllocation(companyId, paymentId, charge.id, canPay);
          remainingToAllocate = AccountingEngine.round2(remainingToAllocate - canPay);
        }
      }
    }

    await logOperationalAudit(companyId, 'PAYMENT', paymentId, paymentNo, 'COMPLETED', createdBy, {
      partyName, paidAmount, paymentMode, voucherNo: paymentVoucherNo
    });

    return {
      id: paymentId,
      payment_no: paymentNo,
      paid_amount: paidAmount,
      voucher_no: paymentVoucherNo,
      remaining_unallocated: remainingToAllocate,
      partyName,
      payDate,
    };
  });

  try {
    emitTransactionEvent(companyId, 'OPERATIONAL_PAYMENT_COMPLETED', resultObj.payment_no, resultObj.id, {
      payment_no: resultObj.payment_no,
      party_name: resultObj.partyName,
      paid_amount: resultObj.paid_amount,
      payment_mode: paymentMode,
      reference_no: referenceNo || resultObj.payment_no,
      voucher_no: resultObj.voucher_no || '',
      date: resultObj.payDate,
      status: 'PAID'
    }, createdBy);
  } catch (notifErr) {
    console.warn('[operationalChargeEngine] Notification dispatch error:', notifErr.message);
  }

  return {
    id: resultObj.id,
    payment_no: resultObj.payment_no,
    paid_amount: resultObj.paid_amount,
    voucher_no: resultObj.voucher_no,
    remaining_unallocated: resultObj.remaining_unallocated
  };
}

/**
 * Apply allocation from payment to charge and update balance
 */
async function applyChargeAllocation(companyId, paymentId, chargeId, allocAmt) {
  const pfx = getPrefix(companyId);

  // Insert allocation record
  await db.run(
    `INSERT INTO ${pfx}operational_payment_allocations (payment_id, charge_id, allocated_amount)
     VALUES (?, ?, ?)`,
    [paymentId, chargeId, allocAmt]
  );

  // Update charge balances
  const charge = await db.get(
    `SELECT final_amount, paid_amount, balance_amount FROM ${pfx}operational_charges WHERE id = ?`,
    [chargeId]
  );

  if (charge) {
    const newPaid = Number(charge.paid_amount || 0) + Number(allocAmt);
    const newBal = Math.max(0, Number(charge.final_amount) - newPaid);
    const newStatus = newBal <= 0 ? 'PAID' : (newPaid > 0 ? 'PARTIAL' : 'UNPAID');

    await db.run(
      `UPDATE ${pfx}operational_charges
       SET paid_amount = ?, balance_amount = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newPaid, newBal, newStatus, chargeId]
    );
  }
}

/**
 * Internal Audit Logger
 */
async function logOperationalAudit(companyId, entityType, entityId, entityRef, action, performedBy, detailsObj) {
  const pfx = getPrefix(companyId);
  try {
    await db.run(
      `INSERT INTO ${pfx}operational_audit_logs (entity_type, entity_id, entity_ref, action, performed_by, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [entityType, entityId, entityRef, action, performedBy, JSON.stringify(detailsObj || {})]
    );
  } catch (e) {
    console.warn('[operationalChargeEngine] Audit log failure:', e.message);
  }
}

module.exports = {
  ensureOperationalTables,
  invalidateOperationalTablesCache,
  backfillMissingLoadmanParties,
  seedDefaultRateMasters,
  resolveOperationalLedgers,
  recordOperationalCharge,
  createOperationalCharge: async function(companyId, data) {
    if (typeof companyId === 'object' && !data) {
      return recordOperationalCharge(companyId);
    }
    return recordOperationalCharge({ companyId, ...data });
  },
  recordOperationalPayment,
  generateNumber,
  logOperationalAudit
};
