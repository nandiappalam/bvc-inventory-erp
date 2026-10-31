const db = require('../config/database');
const VoucherService = require('./VoucherService');
const { emitTransactionEvent } = require('./transactionNotificationEngine');

/**
 * Enterprise Operational Charge -> Payment -> Accounting Engine
 * Serves Purchase, Sales, Inpass, Outpass, Godown Transfer, Outside Grind, Vehicle Movement, etc.
 */

// Helper to sanitize table names for multi-tenant company prefix
function getPrefix(companyId) {
  return (companyId && companyId > 1) ? `c${companyId}_` : '';
}

/**
 * Ensure all operational charge tables exist for this company schema
 */
async function ensureOperationalTables(companyId = 1) {
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

  for (const sql of queries) {
    try {
      await db.run(sql);
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
      await db.run(altSql);
    } catch (_) {
      // Column already exists, ignore error
    }
  }

  // Column value sync for backward compatibility (safely isolated per query)
  try {
    await db.run(`UPDATE ${pfx}operational_parties SET party_code = 'OPP-GEN-' || id WHERE party_code IS NULL OR party_code = ''`);
  } catch (_) {}
  try {
    await db.run(`UPDATE ${pfx}operational_parties SET category = COALESCE(category, party_category, 'LOADMAN') WHERE category IS NULL OR category = ''`);
  } catch (_) {}
  try {
    await db.run(`UPDATE ${pfx}operational_parties SET party_category = COALESCE(party_category, category, 'LOADMAN') WHERE party_category IS NULL OR party_category = ''`);
  } catch (_) {}
  try {
    await db.run(`UPDATE ${pfx}operational_parties SET default_payment_mode = COALESCE(default_payment_mode, payment_mode, 'CASH') WHERE default_payment_mode IS NULL OR default_payment_mode = ''`);
  } catch (_) {}
  try {
    await db.run(`UPDATE ${pfx}operational_parties SET payment_mode = COALESCE(payment_mode, default_payment_mode, 'CASH') WHERE payment_mode IS NULL OR payment_mode = ''`);
  } catch (_) {}

  try {
    await db.run(`UPDATE ${pfx}operational_charges SET date = COALESCE(date, charge_date, CURRENT_DATE) WHERE date IS NULL`);
  } catch (_) {}
  try {
    await db.run(`UPDATE ${pfx}operational_charges SET final_amount = COALESCE(final_amount, total_amount, amount, 0.00) WHERE final_amount IS NULL OR final_amount = 0`);
  } catch (_) {}
  try {
    await db.run(`UPDATE ${pfx}operational_charges SET payment_status = COALESCE(payment_status, status, 'UNPAID') WHERE payment_status IS NULL OR payment_status = ''`);
  } catch (_) {}
  try {
    await db.run(`UPDATE ${pfx}operational_charges SET operation_type = COALESCE(operation_type, charge_type, 'LOADING') WHERE operation_type IS NULL OR operation_type = ''`);
  } catch (_) {}
  try {
    await db.run(`UPDATE ${pfx}operational_charges SET charge_category = COALESCE(charge_category, party_category, 'LABOUR') WHERE charge_category IS NULL OR charge_category = ''`);
  } catch (_) {}
  try {
    await db.run(`UPDATE ${pfx}operational_charges SET party_category = COALESCE(party_category, charge_category, 'LABOUR') WHERE party_category IS NULL OR party_category = ''`);
  } catch (_) {}
  try {
    await db.run(`UPDATE ${pfx}operational_charges SET rate_basis = COALESCE(rate_basis, calculation_basis, 'PER_BAG') WHERE rate_basis IS NULL OR rate_basis = ''`);
  } catch (_) {}
  try {
    await db.run(`UPDATE ${pfx}operational_charges SET rate_per_unit = COALESCE(rate_per_unit, rate, 0.00) WHERE rate_per_unit IS NULL OR rate_per_unit = 0`);
  } catch (_) {}

  // Seed default rate masters and default parties if empty
  await seedDefaultRateMasters(companyId);
  await seedDefaultParties(companyId);
}

/**
 * Seed default parties if empty
 */
async function seedDefaultParties(companyId = 1) {
  const pfx = getPrefix(companyId);
  try {
    const existing = await db.get(`SELECT id FROM ${pfx}operational_parties WHERE id = 1 OR party_code = 'OPP-GEN-0001' LIMIT 1`);
    if (!existing) {
      const isPostgres = db.isPostgres;
      if (isPostgres) {
        await db.run(
          `INSERT INTO ${pfx}operational_parties (id, party_code, name, category, party_category, default_payment_mode, payment_mode, is_active)
           VALUES (1, 'OPP-GEN-0001', 'General Labour Pool', 'LOADMAN', 'LOADMAN', 'CASH', 'CASH', 1)
           ON CONFLICT (id) DO NOTHING`
        );
      } else {
        await db.run(
          `INSERT OR IGNORE INTO ${pfx}operational_parties (id, party_code, name, category, party_category, default_payment_mode, payment_mode, is_active)
           VALUES (1, 'OPP-GEN-0001', 'General Labour Pool', 'LOADMAN', 'LOADMAN', 'CASH', 'CASH', 1)`
        );
      }
    }
  } catch (err) {
    console.warn('[operationalChargeEngine] seedDefaultParties non-fatal:', err.message);
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
    const row = await db.get(`SELECT COUNT(id) as cnt FROM ${table}`);
    let nextNum = (row?.cnt || 0) + 1;
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
async function resolveOperationalLedgers(companyId = 1) {
  const pfx = getPrefix(companyId);
  let expenseLedger = null;
  let payableLedger = null;
  let cashLedger = null;

  try {
    // 1. Expense Ledger: Loading & Unloading Charges / Direct Expenses
    expenseLedger = await db.get(
      `SELECT id, name FROM ${pfx}ledgermaster WHERE UPPER(name) LIKE '%LOADING%' OR UPPER(name) LIKE '%FREIGHT%' OR UPPER(name) LIKE '%DIRECT EXPENSES%' OR UPPER(name) LIKE '%WAGES%' LIMIT 1`
    );
    if (!expenseLedger) {
      const insExp = await db.run(
        `INSERT INTO ${pfx}ledgermaster (name, printname, under, ledger_type, openingbalance, status)
         VALUES ('Loading & Operational Charges', 'LOADING & OPERATIONAL CHARGES', 'Direct Expenses', 'Expense', 0, 'Active')`
      );
      expenseLedger = { id: insExp.lastID, name: 'Loading & Operational Charges' };
    }

    // 2. Payable Ledger: Operational Charges Payable / Current Liabilities
    payableLedger = await db.get(
      `SELECT id, name FROM ${pfx}ledgermaster WHERE UPPER(name) LIKE '%OPERATIONAL CHARGES PAYABLE%' OR UPPER(name) LIKE '%LABOUR CHARGES PAYABLE%' OR UPPER(name) LIKE '%SUNDRY CREDITORS%' LIMIT 1`
    );
    if (!payableLedger) {
      const insPay = await db.run(
        `INSERT INTO ${pfx}ledgermaster (name, printname, under, ledger_type, openingbalance, status)
         VALUES ('Operational Charges Payable', 'OPERATIONAL CHARGES PAYABLE', 'Current Liabilities', 'Liability', 0, 'Active')`
      );
      payableLedger = { id: insPay.lastID, name: 'Operational Charges Payable' };
    }

    // 3. Cash Ledger: Cash in Hand
    cashLedger = await db.get(
      `SELECT id, name FROM ${pfx}ledgermaster WHERE UPPER(name) LIKE '%CASH%' LIMIT 1`
    );
  } catch (err) {
    console.warn('[operationalChargeEngine] resolveOperationalLedgers:', err.message);
  }

  return { expenseLedger, payableLedger, cashLedger };
}

/**
 * Create an Operational Charge record from any module (Purchase, Sales, Inpass, Outpass, Godown Transfer, Vehicle Movement)
 */
async function recordOperationalCharge(params = {}) {
  const companyId = params.companyId || params.company_id || 1;
  await ensureOperationalTables(companyId);
  const pfx = getPrefix(companyId);

  const sourceModule = params.sourceModule || params.source_module || 'General';
  const sourceTransactionNo = params.sourceTransactionNo || params.source_transaction_no || null;
  const sourceTransactionId = params.sourceTransactionId || params.source_transaction_id || null;
  const date = params.date || new Date().toISOString().split('T')[0];
  const operationType = params.operationType || params.operation_type || params.charge_type || 'LOADING';
  const chargeCategory = params.chargeCategory || params.charge_category || params.party_category || 'LABOUR';
  let partyId = params.partyId || params.party_id || null;
  let partyName = params.partyName || params.party_name || null;
  let partyCategory = params.partyCategory || params.party_category || 'LOADMEN';
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

  // If partyId is provided but partyName is not, query party
  if (partyId && !partyName) {
    const party = await db.get(`SELECT name, category FROM ${pfx}operational_parties WHERE id = ?`, [partyId]);
    if (party) {
      partyName = party.name;
      partyCategory = party.category;
    }
  }

  if (!partyId && partyName) {
    const existingParty = await db.get(`SELECT id, category FROM ${pfx}operational_parties WHERE name = ?`, [partyName]);
    if (existingParty) {
      partyId = existingParty.id;
      partyCategory = existingParty.category || partyCategory;
    }
  }

  // Calculate base & final amount
  const explicitAmount = params.amount !== undefined && params.amount !== '' ? Number(params.amount) : null;
  const baseAmount = (explicitAmount !== null && !isNaN(explicitAmount) && explicitAmount > 0)
    ? explicitAmount
    : (ratePerUnit * quantity);
  const finalAmount = Math.max(0, baseAmount + adjustmentAmount);
  const chargeNo = params.charge_no || params.chargeNo || await generateNumber(companyId, 'CHARGE');
  const chargeDate = date;

  // Resolve ledgers
  const { expenseLedger, payableLedger } = await resolveOperationalLedgers(companyId);

  let accrualVoucherId = null;
  let accrualVoucherNo = null;
  let isPosted = 0;

  // Auto-post Accrual Journal/Payment Voucher to Accounting if enabled and finalAmount > 0
  if (autoPostToAccounts && finalAmount > 0 && expenseLedger && payableLedger) {
    try {
      const voucherRes = await VoucherService.createVoucher({
        companyId,
        voucher_type: 'Journal',
        voucher_date: chargeDate,
        reference_no: chargeNo,
        narration: `Accrual of ${operationType} charge for ${sourceModule} ${sourceTransactionNo || ''} - Party: ${partyName || 'Labour Team'}`,
        entries: [
          {
            ledger_id: expenseLedger.id,
            ledger_name: expenseLedger.name,
            debit: finalAmount,
            credit: 0,
            remarks: `${operationType} expense (${quantity} ${uom} @ ₹${ratePerUnit})`
          },
          {
            ledger_id: payableLedger.id,
            ledger_name: payableLedger.name,
            debit: 0,
            credit: finalAmount,
            remarks: `Payable to ${partyName || 'Party'} for ${chargeNo}`
          }
        ],
        created_by: createdBy
      });

      if (voucherRes && (voucherRes.id || voucherRes.voucher_id || voucherRes.voucher_no)) {
        accrualVoucherId = voucherRes.id || voucherRes.voucher_id;
        accrualVoucherNo = voucherRes.voucher_no || voucherRes.voucherNo;
        isPosted = 1;
      }
    } catch (accErr) {
      console.warn('[operationalChargeEngine] Accounting journal accrual warning:', accErr.message);
    }
  }

  // Insert into operational_charges
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
    operationType, operationType, chargeCategory, partyId || 1, partyName || 'General Labour Pool', partyCategory,
    rateBasis, rateBasis, ratePerUnit, ratePerUnit, quantity, uom, baseAmount, adjustmentAmount,
    finalAmount, finalAmount, finalAmount, 0.00, finalAmount, 'UNPAID', 'UNPAID', 'APPROVED',
    isPosted, accrualVoucherId, accrualVoucherNo,
    expenseLedger ? expenseLedger.id : null, payableLedger ? payableLedger.id : null,
    fromLocation, toLocation, vehicleNo, driverName, notes, notes, createdBy
  ];

  const res = await db.run(insertSql, chargeParams);
  const chargeId = res.lastID;

  // Insert line items if present
  if (Array.isArray(lines) && lines.length > 0) {
    let lineIdx = 1;
    for (const l of lines) {
      const lineAmt = Number(l.line_amount ?? l.lineAmount ?? l.amount ?? 0);
      const bagCount = Number(l.bag_count ?? l.bagCount ?? 0);
      const weightKg = Number(l.weight_kg ?? l.weightKg ?? 0);
      const unitRate = Number(l.unit_rate ?? l.unitRate ?? ratePerUnit);
      await db.run(
        `INSERT INTO ${pfx}operational_charge_lines (charge_id, line_no, item_name, lot_no, bag_count, weight_kg, unit_rate, line_amount, remarks)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          chargeId, lineIdx++, l.item_name || l.party_name || l.worker_role || 'Worker', l.lot_no || '',
          bagCount, weightKg, unitRate, lineAmt, l.remarks || l.worker_role || ''
        ]
      );
    }
  }

  // Audit Log
  await logOperationalAudit(companyId, 'CHARGE', chargeId, chargeNo, 'CREATED', createdBy, {
    sourceModule, sourceTransactionNo, finalAmount, partyName, operationType
  });

  // Emit Notification Event
  try {
    let notifEvent = 'LOADING_CHARGE_CREATED';
    if (operationType === 'UNLOADING') notifEvent = 'UNLOADING_CHARGE_CREATED';
    else if (operationType === 'GODOWN_TRANSFER' || sourceModule === 'GodownTransfer') notifEvent = 'TRANSFER_CHARGE_CREATED';
    else if (chargeCategory === 'DRIVER_BATTA') notifEvent = 'DRIVER_CHARGE_CREATED';

    emitTransactionEvent(companyId, notifEvent, chargeNo, chargeId, {
      charge_no: chargeNo,
      source_module: sourceModule,
      source_transaction_no: sourceTransactionNo || '',
      operation_type: operationType,
      party_name: partyName || 'Labour Pool',
      party_category: partyCategory,
      rate_basis: rateBasis,
      rate_per_unit: ratePerUnit,
      quantity,
      uom,
      final_amount: finalAmount,
      balance_amount: finalAmount,
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
    id: chargeId,
    charge_no: chargeNo,
    final_amount: finalAmount,
    balance_amount: finalAmount,
    accrual_voucher_no: accrualVoucherNo,
    is_posted_to_accounts: isPosted
  };
}

/**
 * Record a payment against an operational party and allocate against pending charges
 */
async function recordOperationalPayment(params = {}) {
  const companyId = params.companyId || params.company_id || 1;
  await ensureOperationalTables(companyId);
  const pfx = getPrefix(companyId);

  let partyId = params.partyId || params.party_id;
  let partyName = params.partyName || params.party_name;
  const paymentDate = params.paymentDate || params.payment_date || params.date || new Date().toISOString().split('T')[0];
  const paymentMode = params.paymentMode || params.payment_mode || params.payment_method || 'CASH';
  const paidAmount = Number(params.paidAmount ?? params.paid_amount ?? 0);
  const referenceNo = params.referenceNo || params.reference_no || '';
  const paidFromLedgerId = params.paidFromLedgerId || params.paid_from_ledger_id;
  const rawAllocations = params.allocations || [];
  const notes = params.notes || params.remarks || '';
  const createdBy = params.createdBy || params.created_by || params.paid_by || 'Cashier';
  const autoPostToAccounts = params.autoPostToAccounts !== false;

  if (partyId && !partyName) {
    const party = await db.get(`SELECT name FROM ${pfx}operational_parties WHERE id = ?`, [partyId]);
    if (party) partyName = party.name;
  }

  if (!partyId && partyName && String(partyName).trim()) {
    const cleanName = String(partyName).trim();
    let party = await db.get(`SELECT id, name FROM ${pfx}operational_parties WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))`, [cleanName]);
    if (party) {
      partyId = party.id;
      partyName = party.name;
    } else {
      // Auto-create in master operational_parties so it permanently displays in Master table!
      try {
        const cRow = await db.get(`SELECT COUNT(id) as cnt FROM ${pfx}operational_parties`);
        const pCode = `OPP-${String((cRow?.cnt || 0) + 1).padStart(4, '0')}`;
        const pCat = params.party_category || params.category || 'LOADMAN';
        const pMode = paymentMode || 'CASH';
        const pIns = await db.run(
          `INSERT INTO ${pfx}operational_parties (party_code, name, category, default_payment_mode, is_active) VALUES (?, ?, ?, ?, 1)`,
          [pCode, cleanName, pCat, pMode]
        );
        partyId = pIns.lastID;
        partyName = cleanName;
      } catch (pErr) {
        console.warn('[recordOperationalPayment] Could not insert operational party:', pErr.message);
      }
    }
  }

  if (!partyId && !partyName) {
    partyId = 1;
    partyName = 'General Labour Pool';
  }

  if (paidAmount <= 0) {
    throw new Error('Payment amount must be greater than 0');
  }

  const paymentNo = await generateNumber(companyId, 'PAYMENT');
  const payDate = paymentDate;

  const { payableLedger, cashLedger } = await resolveOperationalLedgers(companyId);
  const fromLedgerId = paidFromLedgerId || (cashLedger ? cashLedger.id : null);

  let paymentVoucherId = null;
  let paymentVoucherNo = null;

  // Post Payment Voucher to Accounts: Debit Operational Charges Payable, Credit Cash / Bank
  if (autoPostToAccounts && payableLedger && fromLedgerId) {
    try {
      let fromLedgerName = 'Cash in Hand';
      try {
        const fl = await db.get(`SELECT name FROM ${pfx}ledgermaster WHERE id = ?`, [fromLedgerId]);
        if (fl) fromLedgerName = fl.name;
      } catch (e) {}

      const voucherRes = await VoucherService.createVoucher({
        companyId,
        voucher_type: 'Payment',
        voucher_date: payDate,
        reference_no: paymentNo,
        narration: `Operational Labour/Transport Payment to ${partyName || 'Party'} - Ref: ${referenceNo || paymentNo}`,
        entries: [
          {
            ledger_id: payableLedger.id,
            ledger_name: payableLedger.name,
            debit: paidAmount,
            credit: 0,
            remarks: `Clearing operational dues for ${partyName}`
          },
          {
            ledger_id: fromLedgerId,
            ledger_name: fromLedgerName,
            debit: 0,
            credit: paidAmount,
            remarks: `Paid via ${paymentMode}`
          }
        ],
        created_by: createdBy
      });

      if (voucherRes && (voucherRes.id || voucherRes.voucher_id || voucherRes.voucher_no)) {
        paymentVoucherId = voucherRes.id || voucherRes.voucher_id;
        paymentVoucherNo = voucherRes.voucher_no || voucherRes.voucherNo;
      }
    } catch (accErr) {
      console.warn('[operationalChargeEngine] Payment voucher creation warning:', accErr.message);
    }
  }

  // Insert operational_payments
  const payIns = await db.run(
    `INSERT INTO ${pfx}operational_payments (
      payment_no, payment_date, party_id, party_name, party_category, payment_mode, payment_method, paid_amount,
      reference_no, voucher_id, voucher_no, paid_from_ledger_id, payable_ledger_id,
      notes, remarks, created_by, paid_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      paymentNo, payDate, partyId || 1, partyName || 'General Labour Pool', 'LOADMEN', paymentMode, paymentMode, paidAmount,
      referenceNo, paymentVoucherId, paymentVoucherNo, fromLedgerId, payableLedger ? payableLedger.id : null,
      notes, notes, createdBy, createdBy
    ]
  );
  const paymentId = payIns.lastID;

  // Also ensure party ledger entry is created for General Ledger Statement visibility
  try {
    const { resolveLedgerId } = require('../utils/ledgerHelper');
    const pLedgerId = await resolveLedgerId(partyName || 'General Labour Pool', 'Worker');
    if (pLedgerId) {
      await db.run(`
        INSERT INTO ledger_entries (
          ledger_id, ledger_name, date, voucher_type, voucher_no, debit, credit,
          reference_id, reference_type, particulars, voucher_id, transaction_id, transaction_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        pLedgerId,
        partyName || 'General Labour Pool',
        payDate,
        'Payment',
        paymentNo,
        paidAmount,
        0,
        paymentId,
        'operational_payment',
        `Operational Payment to ${partyName || 'Party'} - Ref: ${referenceNo || paymentNo}`,
        paymentVoucherId,
        paymentId,
        'operational_payment'
      ]);
    }
  } catch (leErr) {
    console.warn('[recordOperationalPayment] Party ledger entry creation warning:', leErr.message);
  }

  // Normalize Allocations
  const allocations = (Array.isArray(rawAllocations) ? rawAllocations : []).map(a => ({
    charge_id: a.charge_id || a.chargeId,
    amount: Number(a.amount ?? a.allocated_amount ?? a.allocatedAmount ?? 0)
  }));

  // Process Allocations
  let remainingToAllocate = paidAmount;

  // If specific allocations provided, honor them
  if (allocations.length > 0) {
    for (const alloc of allocations) {
      const allocAmt = Math.min(Number(alloc.amount || 0), remainingToAllocate);
      if (allocAmt > 0 && alloc.charge_id) {
        await applyChargeAllocation(companyId, paymentId, alloc.charge_id, allocAmt);
        remainingToAllocate -= allocAmt;
      }
    }
  }

  // If remaining balance exists and no specific allocation, FIFO allocate to oldest unpaid charges for this party
  if (remainingToAllocate > 0) {
    const pendingCharges = await db.all(
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
        remainingToAllocate -= canPay;
      }
    }
  }

  // Audit Log
  await logOperationalAudit(companyId, 'PAYMENT', paymentId, paymentNo, 'COMPLETED', createdBy, {
    partyName, paidAmount, paymentMode, voucherNo: paymentVoucherNo
  });

  // Emit Notification Event
  try {
    emitTransactionEvent(companyId, 'OPERATIONAL_PAYMENT_COMPLETED', paymentNo, paymentId, {
      payment_no: paymentNo,
      party_name: partyName,
      paid_amount: paidAmount,
      payment_mode: paymentMode,
      reference_no: referenceNo || paymentNo,
      voucher_no: paymentVoucherNo || '',
      date: payDate,
      status: 'PAID'
    }, createdBy);
  } catch (notifErr) {
    console.warn('[operationalChargeEngine] Notification dispatch error:', notifErr.message);
  }

  return {
    id: paymentId,
    payment_no: paymentNo,
    paid_amount: paidAmount,
    voucher_no: paymentVoucherNo,
    remaining_unallocated: remainingToAllocate
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
