const db = require('../config/database');

const VOUCHER_PREFIX_MAP = {
  PURCHASE: 'PUR',
  PURCHASES: 'PUR',
  SALES: 'SAL',
  SALE: 'SAL',
  PAYMENT: 'PAY',
  RECEIPT: 'REC',
  CONTRA: 'CON',
  JOURNAL: 'JNL',
  'DEBIT NOTE': 'DN',
  'PURCHASE RETURN': 'DN',
  PURCHASE_RETURN: 'DN',
  'CREDIT NOTE': 'CN',
  'SALES RETURN': 'CN',
  SALES_RETURN: 'CN',
  ADVANCE: 'ADV',
  'OPERATIONAL CHARGE': 'OPC',
  OPERATIONAL_CHARGE: 'OPC',
  'COLD STORAGE BILL': 'CSB',
  COLD_STORAGE_BILL: 'CSB',
};

const STANDARD_LEDGER_GROUPS = [
  { name: 'Capital Account', nature: 'Liability', statement: 'Balance Sheet', balance: 'Cr', parent: null },
  { name: 'Fixed Assets', nature: 'Asset', statement: 'Balance Sheet', balance: 'Dr', parent: null },
  { name: 'Current Assets', nature: 'Asset', statement: 'Balance Sheet', balance: 'Dr', parent: null },
  { name: 'Current Liabilities', nature: 'Liability', statement: 'Balance Sheet', balance: 'Cr', parent: null },
  { name: 'Sundry Debtors', nature: 'Asset', statement: 'Balance Sheet', balance: 'Dr', parent: 'Current Assets' },
  { name: 'Sundry Creditors', nature: 'Liability', statement: 'Balance Sheet', balance: 'Cr', parent: 'Current Liabilities' },
  { name: 'Bank Accounts', nature: 'Asset', statement: 'Balance Sheet', balance: 'Dr', parent: 'Current Assets' },
  { name: 'Cash-in-hand', nature: 'Asset', statement: 'Balance Sheet', balance: 'Dr', parent: 'Current Assets' },
  { name: 'Purchase Accounts', nature: 'Expense', statement: 'Trading Account', balance: 'Dr', parent: null },
  { name: 'Sales Accounts', nature: 'Income', statement: 'Trading Account', balance: 'Cr', parent: null },
  { name: 'Direct Expenses', nature: 'Expense', statement: 'Profit & Loss', balance: 'Dr', parent: null },
  { name: 'Indirect Expenses', nature: 'Expense', statement: 'Profit & Loss', balance: 'Dr', parent: null },
  { name: 'Direct Income', nature: 'Income', statement: 'Trading Account', balance: 'Cr', parent: null },
  { name: 'Indirect Income', nature: 'Income', statement: 'Profit & Loss', balance: 'Cr', parent: null },
  { name: 'Duties & Taxes', nature: 'Liability', statement: 'Balance Sheet', balance: 'Cr', parent: 'Current Liabilities' },
  { name: 'Loans & Borrowings', nature: 'Liability', statement: 'Balance Sheet', balance: 'Cr', parent: null },
  { name: 'Suspense Accounts', nature: 'Liability', statement: 'Balance Sheet', balance: 'Cr', parent: null },
];

function toPaise(val) {
  const num = Number(val);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}

function fromPaise(paise) {
  const num = Number(paise);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num) / 100;
}

function round2(val) {
  return fromPaise(toPaise(val));
}

function normalizeDateIso(dateInput) {
  if (!dateInput) return new Date().toISOString().slice(0, 10);
  const str = String(dateInput).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

function getActiveCompanyId(explicitCompanyId = null) {
  if (explicitCompanyId !== undefined && explicitCompanyId !== null && explicitCompanyId !== '') {
    const parsed = parseInt(explicitCompanyId, 10);
    if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
  }
  const store = db.asyncLocalStorage ? db.asyncLocalStorage.getStore() : null;
  if (store && store.companyId) {
    const parsed = parseInt(store.companyId, 10);
    if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
  }
  return 1;
}

function getRunner(conn, companyId) {
  if (conn && typeof conn.query === 'function' && typeof conn.run === 'function') {
    return conn;
  }
  const cId = getActiveCompanyId(companyId);
  return db.forCompany(cId);
}

function getPrefixForVoucherType(voucherType, customPrefix = null) {
  if (customPrefix && String(customPrefix).trim()) {
    return String(customPrefix).trim().toUpperCase();
  }
  const key = String(voucherType || 'Journal').trim().toUpperCase();
  return VOUCHER_PREFIX_MAP[key] || 'JNL';
}

function normalizeVoucherType(voucherType) {
  const raw = String(voucherType || 'Journal').trim();
  const upper = raw.toUpperCase();
  if (upper === 'PURCHASE' || upper === 'PURCHASES') return 'Purchase';
  if (upper === 'SALES' || upper === 'SALE') return 'Sales';
  if (upper === 'PAYMENT') return 'Payment';
  if (upper === 'RECEIPT') return 'Receipt';
  if (upper === 'CONTRA') return 'Contra';
  if (upper === 'JOURNAL') return 'Journal';
  if (upper === 'PURCHASE RETURN' || upper === 'PURCHASE_RETURN' || upper === 'DEBIT NOTE') return 'Debit Note';
  if (upper === 'SALES RETURN' || upper === 'SALES_RETURN' || upper === 'CREDIT NOTE') return 'Credit Note';
  if (upper === 'ADVANCE') return 'Advance';
  if (upper === 'OPERATIONAL CHARGE' || upper === 'OPERATIONAL_CHARGE') return 'Operational Charge';
  if (upper === 'COLD STORAGE BILL' || upper === 'COLD_STORAGE_BILL') return 'Cold Storage Bill';
  return raw;
}

const _schemaEnsuredCompanies = new Set();

function invalidateSchemaCache(companyId = null) {
  if (companyId === null || companyId === undefined) {
    _schemaEnsuredCompanies.clear();
  } else {
    _schemaEnsuredCompanies.delete(parseInt(companyId, 10) || 1);
  }
}

async function getTableColumns(runner, tableName, companyId) {
  try {
    if (db.isPostgres) {
      const schemaName = `company_${companyId}`;
      const res = await runner.query(
        `SELECT column_name FROM information_schema.columns WHERE (table_schema = ? OR table_schema = 'public') AND LOWER(table_name) = LOWER(?)`,
        [schemaName, tableName]
      );
      return new Set((res.rows || []).map((r) => String(r.column_name || r.name || '').toLowerCase()).filter(Boolean));
    }
    const res = await runner.query(`PRAGMA table_info("${tableName}")`, []);
    const rowList = Array.isArray(res) ? res : (res?.rows || []);
    return new Set(rowList.map((r) => String(r.name || r.column_name || '').toLowerCase()).filter(Boolean));
  } catch (_) {
    return new Set();
  }
}

async function addMissingColumns(runner, tableName, existingCols, colDefs) {
  for (const [colName, colType] of colDefs) {
    if (!existingCols.has(colName.toLowerCase())) {
      try {
        await runner.run(`ALTER TABLE "${tableName}" ADD COLUMN ${colName} ${colType}`);
        existingCols.add(colName.toLowerCase());
      } catch (err) {
        const msg = String(err?.message || '').toLowerCase();
        if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
          console.warn(`[AccountingEngine] Could not add ${tableName}.${colName}: ${err.message}`);
        } else {
          existingCols.add(colName.toLowerCase());
        }
      }
    }
  }
}

async function ensureAccountingSchema(runner, opts = {}) {
  const cId = typeof opts === 'number' ? opts : getActiveCompanyId(opts?.companyId);
  const force = Boolean(opts && typeof opts === 'object' && opts.force);
  if (!force && _schemaEnsuredCompanies.has(cId)) {
    return;
  }

  await runner.run(`
    CREATE TABLE IF NOT EXISTS voucher (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL DEFAULT 1,
      financial_year TEXT DEFAULT 'DEFAULT',
      voucher_type TEXT NOT NULL,
      voucher_no TEXT UNIQUE NOT NULL,
      date TEXT NOT NULL,
      reference_no TEXT,
      narration TEXT,
      source_module TEXT,
      source_id INTEGER,
      posting_key TEXT,
      status TEXT DEFAULT 'Approved',
      posted INTEGER DEFAULT 1,
      is_reversed INTEGER DEFAULT 0,
      reversed_voucher_id INTEGER,
      parent_voucher_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(() => {});

  await runner.run(`
    CREATE TABLE IF NOT EXISTS voucher_entry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voucher_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      ledger_id INTEGER,
      ledger_name TEXT,
      debit REAL DEFAULT 0,
      credit REAL DEFAULT 0,
      remarks TEXT
    )
  `).catch(() => {});

  await runner.run(`
    CREATE TABLE IF NOT EXISTS ledger_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL DEFAULT 1,
      financial_year TEXT DEFAULT 'DEFAULT',
      ledger_id INTEGER,
      ledger_name TEXT NOT NULL,
      date DATE NOT NULL,
      voucher_type TEXT NOT NULL,
      voucher_no TEXT,
      debit REAL DEFAULT 0,
      credit REAL DEFAULT 0,
      reference_id INTEGER,
      reference_type TEXT,
      particulars TEXT,
      counterparty_summary TEXT,
      voucher_id INTEGER,
      voucher_entry_id INTEGER,
      transaction_id INTEGER,
      transaction_type TEXT,
      posting_key TEXT,
      is_reversed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(() => {});

  await runner.run(`
    CREATE TABLE IF NOT EXISTS voucher_counters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL DEFAULT 1,
      financial_year TEXT NOT NULL DEFAULT 'DEFAULT',
      voucher_type TEXT NOT NULL,
      prefix TEXT NOT NULL,
      last_number INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(company_id, financial_year, voucher_type)
    )
  `).catch(() => {});

  // Migrate pre-existing tables lacking new columns
  const voucherCols = await getTableColumns(runner, 'voucher', cId);
  if (voucherCols.size > 0) {
    await addMissingColumns(runner, 'voucher', voucherCols, [
      ['company_id', 'INTEGER NOT NULL DEFAULT 1'],
      ['financial_year', "TEXT DEFAULT 'DEFAULT'"],
      ['source_module', 'TEXT'],
      ['source_id', 'INTEGER'],
      ['posting_key', 'TEXT'],
      ['status', "TEXT DEFAULT 'Approved'"],
      ['posted', 'INTEGER DEFAULT 1'],
      ['is_reversed', 'INTEGER DEFAULT 0'],
      ['reversed_voucher_id', 'INTEGER'],
      ['parent_voucher_id', 'INTEGER'],
    ]);
  }

  const veCols = await getTableColumns(runner, 'voucher_entry', cId);
  if (veCols.size > 0) {
    await addMissingColumns(runner, 'voucher_entry', veCols, [
      ['ledger_name', 'TEXT'],
      ['remarks', 'TEXT'],
    ]);
  }

  const leCols = await getTableColumns(runner, 'ledger_entries', cId);
  if (leCols.size > 0) {
    await addMissingColumns(runner, 'ledger_entries', leCols, [
      ['company_id', 'INTEGER NOT NULL DEFAULT 1'],
      ['financial_year', "TEXT DEFAULT 'DEFAULT'"],
      ['voucher_no', 'TEXT'],
      ['reference_id', 'INTEGER'],
      ['reference_type', 'TEXT'],
      ['particulars', 'TEXT'],
      ['counterparty_summary', 'TEXT'],
      ['voucher_id', 'INTEGER'],
      ['voucher_entry_id', 'INTEGER'],
      ['transaction_id', 'INTEGER'],
      ['transaction_type', 'TEXT'],
      ['posting_key', 'TEXT'],
      ['is_reversed', 'INTEGER DEFAULT 0'],
    ]);
  }

  const lmCols = await getTableColumns(runner, 'ledgermaster', cId);
  if (lmCols.size > 0) {
    await addMissingColumns(runner, 'ledgermaster', lmCols, [
      ['ledger_name', 'TEXT'],
      ['group_name', 'TEXT'],
      ['group_id', 'INTEGER'],
      ['ledger_code', 'TEXT'],
      ['opening_balance', 'REAL DEFAULT 0'],
      ['opening_balance_type', "TEXT DEFAULT 'Dr'"],
      ['ledger_type', 'TEXT'],
      ['linked_party_type', 'TEXT'],
      ['linked_party_id', 'INTEGER'],
      ['status', "TEXT DEFAULT 'Active'"],
    ]);
    if (lmCols.has('name')) {
      await runner.run(`UPDATE ledgermaster SET ledger_name = name WHERE ledger_name IS NULL OR TRIM(ledger_name) = ''`).catch(() => {});
    }
    if (lmCols.has('under')) {
      await runner.run(`UPDATE ledgermaster SET group_name = under WHERE group_name IS NULL OR TRIM(group_name) = ''`).catch(() => {});
    }
  }

  // Ensure accounting indexes exist cleanly after column migrations
  await runner.run(`CREATE INDEX IF NOT EXISTS idx_voucher_source ON voucher(source_module, source_id)`).catch(() => {});
  await runner.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_voucher_posting_key_active ON voucher(posting_key) WHERE posting_key IS NOT NULL AND COALESCE(is_reversed, 0) = 0`).catch(() => {});
  await runner.run(`CREATE INDEX IF NOT EXISTS idx_ledger_entries_voucher ON ledger_entries(voucher_id)`).catch(() => {});
  await runner.run(`CREATE INDEX IF NOT EXISTS idx_ledger_entries_posting_key ON ledger_entries(posting_key)`).catch(() => {});
  await runner.run(`CREATE INDEX IF NOT EXISTS idx_ledger_entries_ledger_date ON ledger_entries(ledger_id, date)`).catch(() => {});

  const verifiedVoucherCols = await getTableColumns(runner, 'voucher', cId);
  const verifiedLeCols = await getTableColumns(runner, 'ledger_entries', cId);
  if (verifiedVoucherCols.has('source_module') && verifiedVoucherCols.has('is_reversed') && verifiedLeCols.has('is_reversed')) {
    _schemaEnsuredCompanies.add(cId);
  }
}

async function getFinancialYearForDate(runner, dateStr, companyId) {
  const isoDate = normalizeDateIso(dateStr);
  try {
    const byRange = await runner.query(
      `SELECT financial_year FROM financial_years WHERE ? BETWEEN start_date AND end_date ORDER BY is_current DESC, id DESC LIMIT 1`,
      [isoDate]
    );
    if (byRange.rows && byRange.rows[0]?.financial_year) {
      return String(byRange.rows[0].financial_year).trim();
    }
    const currentRes = await runner.query(
      `SELECT financial_year FROM financial_years WHERE is_current = 1 OR is_active = 1 ORDER BY is_current DESC, id DESC LIMIT 1`
    );
    if (currentRes.rows && currentRes.rows[0]?.financial_year) {
      return String(currentRes.rows[0].financial_year).trim();
    }
  } catch (_) {
    // Fallback to date math if financial_years table isn't populated yet
  }
  const [yStr, mStr] = isoDate.split('-');
  const yr = parseInt(yStr, 10) || new Date().getFullYear();
  const mo = parseInt(mStr, 10) || 4;
  if (mo >= 4) return `${yr}-${yr + 1}`;
  return `${yr - 1}-${yr}`;
}

async function nextVoucherNumber({ conn = null, companyId = null, financialYear = null, voucherType = 'Journal', prefix = null, date = null, padLength = 5 }) {
  const cId = getActiveCompanyId(companyId);
  const runner = getRunner(conn, cId);
  await ensureAccountingSchema(runner, { companyId: cId });

  const canonicalType = normalizeVoucherType(voucherType);
  const vPrefix = getPrefixForVoucherType(canonicalType, prefix);
  const fy = financialYear || await getFinancialYearForDate(runner, date, cId);

  const escapedPrefix = vPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const suffixRegex = new RegExp(`^${escapedPrefix}-?(\\d+)$`, 'i');

  const computeSeedMax = async () => {
    const existingRes = await runner.query(
      `SELECT voucher_no FROM voucher WHERE UPPER(voucher_no) LIKE UPPER(?)`,
      [`${vPrefix}%`]
    );
    let maxNum = 0;
    for (const row of existingRes.rows || []) {
      const m = String(row.voucher_no || '').trim().match(suffixRegex);
      if (m) {
        const parsed = parseInt(m[1], 10);
        if (!Number.isNaN(parsed) && parsed > maxNum) {
          maxNum = parsed;
        }
      }
    }
    return maxNum;
  };

  let nextNum = null;
  const counterRes = await runner.query(
    `SELECT id, last_number FROM voucher_counters WHERE company_id = ? AND financial_year = ? AND voucher_type = ? LIMIT 1`,
    [cId, fy, canonicalType]
  );

  if (!counterRes.rows || counterRes.rows.length === 0) {
    const seedMax = await computeSeedMax();
    try {
      await runner.run(
        `INSERT INTO voucher_counters (company_id, financial_year, voucher_type, prefix, last_number) VALUES (?, ?, ?, ?, ?)`,
        [cId, fy, canonicalType, vPrefix, seedMax + 1]
      );
      nextNum = seedMax + 1;
    } catch (_) {
      // Another concurrent transaction inserted first
      await runner.run(
        `UPDATE voucher_counters SET last_number = last_number + 1, updated_at = CURRENT_TIMESTAMP WHERE company_id = ? AND financial_year = ? AND voucher_type = ?`,
        [cId, fy, canonicalType]
      );
      const reread = await runner.query(
        `SELECT last_number FROM voucher_counters WHERE company_id = ? AND financial_year = ? AND voucher_type = ? LIMIT 1`,
        [cId, fy, canonicalType]
      );
      nextNum = Number(reread.rows?.[0]?.last_number || seedMax + 1);
    }
  } else {
    await runner.run(
      `UPDATE voucher_counters SET last_number = last_number + 1, updated_at = CURRENT_TIMESTAMP WHERE company_id = ? AND financial_year = ? AND voucher_type = ?`,
      [cId, fy, canonicalType]
    );
    const updatedRes = await runner.query(
      `SELECT last_number FROM voucher_counters WHERE company_id = ? AND financial_year = ? AND voucher_type = ? LIMIT 1`,
      [cId, fy, canonicalType]
    );
    nextNum = Number(updatedRes.rows?.[0]?.last_number || 1);
  }

  // Ensure monotonically ahead of any unseeded manually entered voucher_no in DB
  while (true) {
    const candidate = `${vPrefix}${String(nextNum).padStart(padLength, '0')}`;
    const clash = await runner.query(`SELECT id FROM voucher WHERE UPPER(TRIM(voucher_no)) = UPPER(TRIM(?)) LIMIT 1`, [candidate]);
    if (!clash.rows || clash.rows.length === 0) {
      await runner.run(
        `UPDATE voucher_counters SET last_number = ?, updated_at = CURRENT_TIMESTAMP WHERE company_id = ? AND financial_year = ? AND voucher_type = ? AND last_number < ?`,
        [nextNum, cId, fy, canonicalType, nextNum]
      ).catch(() => {});
      return candidate;
    }
    nextNum += 1;
  }
}

async function previewVoucherNumber({ conn = null, companyId = null, financialYear = null, voucherType = 'Journal', prefix = null, date = null, padLength = 5 }) {
  const cId = getActiveCompanyId(companyId);
  const runner = getRunner(conn, cId);
  await ensureAccountingSchema(runner, { companyId: cId });

  const canonicalType = normalizeVoucherType(voucherType);
  const vPrefix = getPrefixForVoucherType(canonicalType, prefix);
  const fy = financialYear || await getFinancialYearForDate(runner, date, cId);

  const escapedPrefix = vPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const suffixRegex = new RegExp(`^${escapedPrefix}-?(\\d+)$`, 'i');

  const counterRes = await runner.query(
    `SELECT last_number FROM voucher_counters WHERE company_id = ? AND financial_year = ? AND voucher_type = ? LIMIT 1`,
    [cId, fy, canonicalType]
  );

  let nextNum = 1;
  if (counterRes.rows && counterRes.rows[0]) {
    nextNum = Number(counterRes.rows[0].last_number || 0) + 1;
  } else {
    const existingRes = await runner.query(
      `SELECT voucher_no FROM voucher WHERE UPPER(voucher_no) LIKE UPPER(?)`,
      [`${vPrefix}%`]
    );
    let maxNum = 0;
    for (const row of existingRes.rows || []) {
      const m = String(row.voucher_no || '').trim().match(suffixRegex);
      if (m) {
        const parsed = parseInt(m[1], 10);
        if (!Number.isNaN(parsed) && parsed > maxNum) {
          maxNum = parsed;
        }
      }
    }
    nextNum = maxNum + 1;
  }

  while (true) {
    const candidate = `${vPrefix}${String(nextNum).padStart(padLength, '0')}`;
    const clash = await runner.query(`SELECT id FROM voucher WHERE UPPER(TRIM(voucher_no)) = UPPER(TRIM(?)) LIMIT 1`, [candidate]);
    if (!clash.rows || clash.rows.length === 0) {
      return candidate;
    }
    nextNum += 1;
  }
}

function inferLedgerClassification(ledgerName, groupName = null, ledgerType = null) {
  const lower = String(ledgerName || '').trim().toLowerCase();
  const ltLower = String(ledgerType || '').trim().toLowerCase();
  const gl = String(groupName || '').trim().toLowerCase();
  if (gl && gl !== 'primary' && gl !== 'general') {
    let nature = ledgerType || 'Expense';
    if (!ledgerType || ['supplier', 'customer', 'worker', 'loadman', 'transporter', 'tax'].includes(ltLower)) {
      if (gl.includes('cash') || gl.includes('bank') || gl.includes('debtor') || gl.includes('asset')) nature = 'Asset';
      else if (gl.includes('creditor') || gl.includes('liabilit') || gl.includes('tax') || gl.includes('duties') || gl.includes('capital') || gl.includes('loan')) nature = 'Liability';
      else if (gl.includes('sales') || gl.includes('income')) nature = 'Income';
      else nature = 'Expense';
    }
    return { groupName, ledgerType: nature, openingType: (nature === 'Liability' || nature === 'Income') ? 'Cr' : 'Dr' };
  }

  if (lower.includes('cash')) return { groupName: 'Cash-in-hand', ledgerType: 'Asset', openingType: 'Dr' };
  if (lower.includes('bank')) return { groupName: 'Bank Accounts', ledgerType: 'Asset', openingType: 'Dr' };
  if (lower.includes('input cgst') || lower.includes('input sgst') || lower.includes('input igst') || lower.includes('cgst input') || lower.includes('sgst input') || lower.includes('igst input') || lower.includes('input tax') || lower.includes('vat input')) {
    return { groupName: 'Duties & Taxes', ledgerType: 'Asset', openingType: 'Dr' };
  }
  if (lower.includes('cgst') || lower.includes('sgst') || lower.includes('igst') || lower.includes('gst') || lower.includes('vat') || lower.includes('cess') || lower.includes('tax') || lower.includes('tds') || ltLower === 'tax') {
    return { groupName: 'Duties & Taxes', ledgerType: 'Liability', openingType: 'Cr' };
  }
  if (lower.includes('purchase return')) return { groupName: 'Purchase Accounts', ledgerType: 'Expense', openingType: 'Cr' };
  if (lower.includes('sales return')) return { groupName: 'Sales Accounts', ledgerType: 'Income', openingType: 'Dr' };
  if (lower.includes('purchase') && !ltLower.includes('supplier')) return { groupName: 'Purchase Accounts', ledgerType: 'Expense', openingType: 'Dr' };
  if (lower.includes('sales') && !ltLower.includes('customer')) return { groupName: 'Sales Accounts', ledgerType: 'Income', openingType: 'Cr' };
  if (lower.includes('discount received') || lower.includes('recovery') || lower.includes('rebate')) {
    return { groupName: 'Direct Income', ledgerType: 'Income', openingType: 'Cr' };
  }
  if (lower.includes('discount allowed') || lower.includes('discount on sales')) {
    return { groupName: 'Direct Expenses', ledgerType: 'Expense', openingType: 'Dr' };
  }
  if (lower.includes('round off')) return { groupName: 'Indirect Expenses', ledgerType: 'Expense', openingType: 'Dr' };
  if (ltLower === 'customer' || lower.includes('customer') || lower.includes('debtor')) {
    return { groupName: 'Sundry Debtors', ledgerType: 'Asset', openingType: 'Dr' };
  }
  if (ltLower === 'supplier' || ltLower === 'transporter' || lower.includes('supplier') || lower.includes('creditor') || lower.includes('transporter')) {
    return { groupName: 'Sundry Creditors', ledgerType: 'Liability', openingType: 'Cr' };
  }
  if (ltLower === 'worker' || ltLower === 'loadman' || lower.includes('worker') || lower.includes('loadman') || lower.includes('payable') || lower.includes('operator')) {
    return { groupName: 'Current Liabilities', ledgerType: 'Liability', openingType: 'Cr' };
  }
  if (ltLower === 'expense' || lower.includes('expense') || lower.includes('charges') || lower.includes('wages') || lower.includes('freight') || lower.includes('loading') || lower.includes('transport') || lower.includes('mamool') || lower.includes('rent')) {
    return { groupName: 'Direct Expenses', ledgerType: 'Expense', openingType: 'Dr' };
  }
  if (ltLower === 'income') {
    return { groupName: 'Direct Income', ledgerType: 'Income', openingType: 'Cr' };
  }
  return { groupName: 'Current Liabilities', ledgerType: 'Liability', openingType: 'Cr' };
}

async function ensureGroupExists(runner, groupName) {
  if (!groupName) return null;
  const gRes = await runner.query(
    `SELECT id, group_name FROM ledger_groups WHERE LOWER(TRIM(group_name)) = LOWER(TRIM(?)) LIMIT 1`,
    [groupName]
  );
  if (gRes.rows && gRes.rows[0]) {
    return gRes.rows[0];
  }
  const std = STANDARD_LEDGER_GROUPS.find((g) => g.name.toLowerCase() === String(groupName).trim().toLowerCase());
  if (!std) return null;
  let parentId = null;
  if (std.parent) {
    const parent = await ensureGroupExists(runner, std.parent);
    if (parent) parentId = parent.id;
  }
  try {
    const ins = await runner.run(
      `INSERT INTO ledger_groups (group_name, parent_group_id, parent_group_name, account_nature, financial_statement, normal_balance, status) VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
      [std.name, parentId, std.parent || null, std.nature, std.statement, std.balance]
    );
    return { id: ins.lastID || ins.lastInsertRowid, group_name: std.name };
  } catch (_) {
    const retry = await runner.query(
      `SELECT id, group_name FROM ledger_groups WHERE LOWER(TRIM(group_name)) = LOWER(TRIM(?)) LIMIT 1`,
      [std.name]
    );
    return retry.rows?.[0] || null;
  }
}

async function resolveOrCreateLedger({ conn = null, companyId = null, ledgerId = null, name = null, groupName = null, ledgerType = null, openingBalanceType = null, linkedPartyType = null, linkedPartyId = null }) {
  const cId = getActiveCompanyId(companyId);
  const runner = getRunner(conn, cId);

  if (ledgerId !== undefined && ledgerId !== null && Number(ledgerId) > 0) {
    const byId = await runner.query(
      `SELECT id, COALESCE(NULLIF(TRIM(ledger_name), ''), name) AS resolved_name, COALESCE(NULLIF(TRIM(group_name), ''), under) AS resolved_group, group_id, ledger_type FROM ledgermaster WHERE id = ? LIMIT 1`,
      [Number(ledgerId)]
    );
    if (byId.rows && byId.rows[0]) {
      return {
        id: Number(byId.rows[0].id),
        name: String(byId.rows[0].resolved_name || name || '').trim(),
        groupName: byId.rows[0].resolved_group || groupName,
        groupId: byId.rows[0].group_id || null,
        ledgerType: byId.rows[0].ledger_type || ledgerType,
      };
    }
    if (!name || !String(name).trim()) {
      throw new Error(`Ledger ID ${ledgerId} does not exist in company ${cId}`);
    }
  }

  let cleanName = String(name || '').trim();
  if (!cleanName) {
    throw new Error('Ledger name or valid ledger_id is required for accounting posting.');
  }

  // Canonicalize legacy 'Cash' -> 'Cash in Hand'
  if (cleanName.toLowerCase() === 'cash') {
    cleanName = 'Cash in Hand';
  }

  const byName = await runner.query(
    `SELECT id, COALESCE(NULLIF(TRIM(ledger_name), ''), name) AS resolved_name, COALESCE(NULLIF(TRIM(group_name), ''), under) AS resolved_group, group_id, ledger_type
       FROM ledgermaster
      WHERE LOWER(TRIM(COALESCE(name, ''))) = LOWER(TRIM(?))
         OR LOWER(TRIM(COALESCE(ledger_name, ''))) = LOWER(TRIM(?))
      LIMIT 1`,
    [cleanName, cleanName]
  );

  if (byName.rows && byName.rows[0]) {
    const row = byName.rows[0];
    return {
      id: Number(row.id),
      name: String(row.resolved_name || cleanName).trim(),
      groupName: row.resolved_group || groupName,
      groupId: row.group_id || null,
      ledgerType: row.ledger_type || ledgerType,
    };
  }

  const cls = inferLedgerClassification(cleanName, groupName, ledgerType);
  const groupRow = await ensureGroupExists(runner, cls.groupName);
  const openType = openingBalanceType || cls.openingType;
  const code = cleanName.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 48);

  try {
    const ins = await runner.run(
      `INSERT INTO ledgermaster (
        name, ledger_name, printname, under, group_name, group_id, ledger_code,
        openingbalance, opening_balance, opening_type, opening_balance_type,
        ledger_type, linked_party_type, linked_party_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, 'Active')`,
      [
        cleanName,
        cleanName,
        cleanName.toUpperCase(),
        cls.groupName,
        cls.groupName,
        groupRow ? groupRow.id : null,
        code,
        openType,
        openType,
        cls.ledgerType,
        linkedPartyType || null,
        linkedPartyId || null,
      ]
    );
    const newId = Number(ins.lastID || ins.lastInsertRowid);
    if (newId > 0) {
      return {
        id: newId,
        name: cleanName,
        groupName: cls.groupName,
        groupId: groupRow ? groupRow.id : null,
        ledgerType: cls.ledgerType,
      };
    }
  } catch (_) {
    // Handle concurrent insert race cleanly
  }

  const retry = await runner.query(
    `SELECT id, COALESCE(NULLIF(TRIM(ledger_name), ''), name) AS resolved_name, COALESCE(NULLIF(TRIM(group_name), ''), under) AS resolved_group, group_id, ledger_type
       FROM ledgermaster
      WHERE LOWER(TRIM(COALESCE(name, ''))) = LOWER(TRIM(?))
         OR LOWER(TRIM(COALESCE(ledger_name, ''))) = LOWER(TRIM(?))
      LIMIT 1`,
    [cleanName, cleanName]
  );
  if (!retry.rows || !retry.rows[0]) {
    throw new Error(`Failed to resolve or create ledger "${cleanName}" for company ${cId}`);
  }
  const r = retry.rows[0];
  return {
    id: Number(r.id),
    name: String(r.resolved_name || cleanName).trim(),
    groupName: r.resolved_group || cls.groupName,
    groupId: r.group_id || null,
    ledgerType: r.ledger_type || cls.ledgerType,
  };
}

function buildCounterpartySummary(line, allLines) {
  const isDebit = line.debitPaise > 0;
  const oppLines = allLines.filter((other) => (isDebit ? other.creditPaise > 0 : other.debitPaise > 0));
  const uniqueNames = [];
  for (const opp of oppLines) {
    if (opp.ledgerName && !uniqueNames.includes(opp.ledgerName)) {
      uniqueNames.push(opp.ledgerName);
    }
  }
  const prefix = isDebit ? 'To ' : 'By ';
  if (uniqueNames.length === 0) return line.particulars || line.remarks || line.ledgerName;
  if (uniqueNames.length === 1) return `${prefix}${uniqueNames[0]}`;
  if (uniqueNames.length === 2) return `${prefix}${uniqueNames[0]} & ${uniqueNames[1]}`;
  return `${prefix}${uniqueNames[0]} (+${uniqueNames.length - 1} more)`;
}

async function prepareAndValidateLines(runner, companyId, lines, defaultRefId = null, defaultRefType = null) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error('At least 2 non-zero balanced voucher lines are required.');
  }

  const prepared = [];
  let totalDrPaise = 0;
  let totalCrPaise = 0;

  for (const raw of lines) {
    const rawDr = raw.debit ?? raw.debit_amount ?? 0;
    const rawCr = raw.credit ?? raw.credit_amount ?? 0;
    const drPaise = toPaise(rawDr);
    const crPaise = toPaise(rawCr);

    if (drPaise < 0 || crPaise < 0) {
      throw new Error(`Negative debit/credit values are not allowed (ledger: ${raw.ledgerName || raw.ledger_name || raw.ledgerId}).`);
    }
    if (drPaise > 0 && crPaise > 0) {
      throw new Error(`Single voucher line cannot have both debit and credit > 0 (ledger: ${raw.ledgerName || raw.ledger_name || raw.ledgerId}).`);
    }
    if (drPaise === 0 && crPaise === 0) {
      continue;
    }

    const resolvedLedger = await resolveOrCreateLedger({
      conn: runner,
      companyId,
      ledgerId: raw.ledgerId ?? raw.ledger_id ?? null,
      name: raw.ledgerName || raw.ledger_name || null,
      groupName: raw.groupName || raw.group_name || null,
      ledgerType: raw.ledgerType || raw.ledger_type || null,
      linkedPartyType: raw.linkedPartyType || null,
      linkedPartyId: raw.linkedPartyId || null,
    });

    totalDrPaise += drPaise;
    totalCrPaise += crPaise;

    prepared.push({
      ledgerId: resolvedLedger.id,
      ledgerName: resolvedLedger.name,
      groupName: resolvedLedger.groupName,
      type: drPaise > 0 ? 'Dr' : 'Cr',
      debitPaise: drPaise,
      creditPaise: crPaise,
      debit: fromPaise(drPaise),
      credit: fromPaise(crPaise),
      remarks: raw.remarks || raw.narration || '',
      particulars: raw.particulars || '',
      referenceId: raw.referenceId ?? defaultRefId ?? null,
      referenceType: raw.referenceType || defaultRefType || null,
      transactionId: raw.transactionId ?? defaultRefId ?? null,
      transactionType: raw.transactionType || raw.referenceType || defaultRefType || null,
    });
  }

  if (prepared.length < 2) {
    throw new Error('At least 2 non-zero balanced voucher lines are required.');
  }
  if (totalDrPaise <= 0) {
    throw new Error('Total voucher amount must be greater than zero.');
  }
  if (totalDrPaise !== totalCrPaise) {
    throw new Error(
      `Unbalanced accounting entry: Total Debit (${fromPaise(totalDrPaise).toFixed(2)}) != Total Credit (${fromPaise(totalCrPaise).toFixed(2)})`
    );
  }

  // Enrich counterparty summary and clear dual-entry particulars
  for (const line of prepared) {
    line.counterpartySummary = buildCounterpartySummary(line, prepared);
    const detail = String(line.particulars || line.remarks || '').trim();
    if (!detail) {
      line.finalParticulars = line.counterpartySummary;
    } else if (detail.startsWith('To ') || detail.startsWith('By ')) {
      line.finalParticulars = detail;
    } else if (detail.toLowerCase().includes(line.counterpartySummary.replace(/^(To|By)\s+/i, '').toLowerCase())) {
      line.finalParticulars = detail;
    } else {
      line.finalParticulars = `${line.counterpartySummary} (${detail})`;
    }
  }

  return {
    lines: prepared,
    totalDrPaise,
    totalCrPaise,
    totalAmount: fromPaise(totalDrPaise),
  };
}

async function postVoucher({
  conn = null,
  companyId = null,
  voucherType = 'Journal',
  prefix = null,
  existingVoucherNo = null,
  date = null,
  referenceNo = null,
  narration = '',
  sourceModule = null,
  sourceId = null,
  postingKey = null,
  lines = [],
  allowUpdate = false,
  preserveVoucherNoOnUpdate = true,
  status = 'Approved',
  parentVoucherId = null,
}) {
  const cId = getActiveCompanyId(companyId);

  const execute = async (txConn) => {
    await ensureAccountingSchema(txConn, { companyId: cId });

    const canonicalType = normalizeVoucherType(voucherType);
    const isoDate = normalizeDateIso(date);
    const fy = await getFinancialYearForDate(txConn, isoDate, cId);
    const refStr = referenceNo !== undefined && referenceNo !== null ? String(referenceNo) : (sourceId !== null ? String(sourceId) : '');
    const resolvedSourceModule = sourceModule || canonicalType.toLowerCase().replace(/\s+/g, '_');
    const resolvedSourceId = sourceId !== undefined && sourceId !== null && sourceId !== '' ? Number(sourceId) : null;
    const resolvedPostingKey = postingKey || (resolvedSourceId ? `${resolvedSourceModule}:${resolvedSourceId}` : null);

    // Contra validation: both sides must be Cash or Bank ledgers, and cannot transfer to the exact same ledger
    if (canonicalType === 'Contra') {
      const preparedPreview = await prepareAndValidateLines(txConn, cId, lines, resolvedSourceId, resolvedSourceModule);
      const uniqueIds = new Set(preparedPreview.lines.map((l) => l.ledgerId));
      if (uniqueIds.size < 2) {
        throw new Error('Contra voucher requires distinct source and destination Cash/Bank accounts.');
      }
      for (const l of preparedPreview.lines) {
        const gLower = String(l.groupName || '').toLowerCase();
        const nLower = String(l.ledgerName || '').toLowerCase();
        const isCashOrBank = gLower.includes('cash') || gLower.includes('bank') || nLower.includes('cash') || nLower.includes('bank');
        if (!isCashOrBank) {
          throw new Error(`Contra voucher can only involve Cash or Bank accounts ("${l.ledgerName}" is under "${l.groupName || 'Unknown'}").`);
        }
      }
    }

    const validated = await prepareAndValidateLines(txConn, cId, lines, resolvedSourceId, resolvedSourceModule);

    // Check existing active (non-reversed) voucher for idempotency or update
    let existingVoucher = null;
    if (resolvedPostingKey) {
      const pkRes = await txConn.query(
        `SELECT * FROM voucher WHERE posting_key = ? AND COALESCE(is_reversed, 0) = 0 ORDER BY id DESC LIMIT 1`,
        [resolvedPostingKey]
      );
      existingVoucher = pkRes.rows?.[0] || null;
    }
    if (!existingVoucher && resolvedSourceId && allowUpdate) {
      const modLower = String(resolvedSourceModule || '').toLowerCase();
      const srcRes = await txConn.query(
        `SELECT * FROM voucher
          WHERE COALESCE(is_reversed, 0) = 0
            AND (
              (LOWER(COALESCE(source_module, '')) = ? AND source_id = ?)
              OR (UPPER(voucher_type) IN (UPPER(?), 'PUR') AND reference_no IN (?, ?))
            )
          ORDER BY id DESC LIMIT 1`,
        [modLower, resolvedSourceId, canonicalType, String(resolvedSourceId), `PUR-${resolvedSourceId}`]
      );
      existingVoucher = srcRes.rows?.[0] || null;
    }
    if (!existingVoucher && resolvedSourceId && allowUpdate) {
      const modLower = String(resolvedSourceModule || '').toLowerCase();
      const leLinkRes = await txConn.query(
        `SELECT v.*
           FROM voucher v
           JOIN ledger_entries le ON le.voucher_id = v.id
          WHERE le.reference_id = ?
            AND LOWER(COALESCE(le.reference_type, '')) = ?
            AND COALESCE(v.is_reversed, 0) = 0
          ORDER BY v.id DESC LIMIT 1`,
        [resolvedSourceId, modLower]
      );
      existingVoucher = leLinkRes.rows?.[0] || null;
    }
    if (!existingVoucher && existingVoucherNo && allowUpdate) {
      const byNoRes = await txConn.query(
        `SELECT * FROM voucher WHERE UPPER(TRIM(voucher_no)) = UPPER(TRIM(?)) AND COALESCE(is_reversed, 0) = 0 ORDER BY id DESC LIMIT 1`,
        [String(existingVoucherNo).trim()]
      );
      existingVoucher = byNoRes.rows?.[0] || null;
    }

    if (existingVoucher && !allowUpdate) {
      return {
        id: existingVoucher.id,
        voucherId: existingVoucher.id,
        voucherNo: existingVoucher.voucher_no,
        voucher_no: existingVoucher.voucher_no,
        voucherType: existingVoucher.voucher_type,
        financialYear: existingVoucher.financial_year || fy,
        totalAmount: validated.totalAmount,
        idempotent: true,
      };
    }

    let voucherId;
    let finalVoucherNo;

    if (existingVoucher && allowUpdate) {
      voucherId = existingVoucher.id;
      finalVoucherNo = (preserveVoucherNoOnUpdate && existingVoucher.voucher_no)
        ? existingVoucher.voucher_no
        : (existingVoucherNo || existingVoucher.voucher_no);

      await txConn.run(
        `UPDATE voucher
            SET company_id = ?, financial_year = ?, voucher_type = ?, voucher_no = ?, date = ?,
                reference_no = ?, narration = ?, source_module = ?, source_id = ?, posting_key = ?,
                status = ?, posted = 1
          WHERE id = ?`,
        [cId, fy, canonicalType, finalVoucherNo, isoDate, refStr, narration || '', resolvedSourceModule, resolvedSourceId, resolvedPostingKey, status, voucherId]
      );

      await txConn.run(`DELETE FROM ledger_entries WHERE voucher_id = ?`, [voucherId]);
      await txConn.run(`DELETE FROM voucher_entry WHERE voucher_id = ?`, [voucherId]);
    } else {
      finalVoucherNo = existingVoucherNo
        ? String(existingVoucherNo).trim()
        : await nextVoucherNumber({ conn: txConn, companyId: cId, financialYear: fy, voucherType: canonicalType, prefix, date: isoDate });

      const vIns = await txConn.run(
        `INSERT INTO voucher (
          company_id, financial_year, voucher_type, voucher_no, date, reference_no, narration,
          source_module, source_id, posting_key, status, posted, is_reversed, parent_voucher_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?)`,
        [cId, fy, canonicalType, finalVoucherNo, isoDate, refStr, narration || '', resolvedSourceModule, resolvedSourceId, resolvedPostingKey, status, parentVoucherId || null]
      );
      voucherId = vIns.lastID || vIns.lastInsertRowid;
    }

    for (const line of validated.lines) {
      const veIns = await txConn.run(
        `INSERT INTO voucher_entry (voucher_id, type, ledger_id, ledger_name, debit, credit, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [voucherId, line.type, line.ledgerId, line.ledgerName, line.debit, line.credit, line.remarks || line.finalParticulars]
      );
      const voucherEntryId = veIns.lastID || veIns.lastInsertRowid;

      await txConn.run(
        `INSERT INTO ledger_entries (
          company_id, financial_year, ledger_id, ledger_name, date, voucher_type, voucher_no,
          debit, credit, reference_id, reference_type, particulars, counterparty_summary,
          voucher_id, voucher_entry_id, transaction_id, transaction_type, posting_key, is_reversed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          cId,
          fy,
          line.ledgerId,
          line.ledgerName,
          isoDate,
          canonicalType,
          finalVoucherNo,
          line.debit,
          line.credit,
          line.referenceId,
          line.referenceType,
          line.finalParticulars,
          line.counterpartySummary,
          voucherId,
          voucherEntryId,
          line.transactionId,
          line.transactionType,
          resolvedPostingKey,
        ]
      );
    }

    return {
      id: voucherId,
      voucherId,
      voucherNo: finalVoucherNo,
      voucher_no: finalVoucherNo,
      voucherType: canonicalType,
      financialYear: fy,
      totalAmount: validated.totalAmount,
      idempotent: false,
    };
  };

  if (conn && typeof conn.query === 'function') {
    return execute(conn);
  }
  return db.withTransaction(execute, cId);
}

async function deleteVoucherBySource({ conn = null, companyId = null, sourceModule, sourceId, voucherTypes = null, referenceNo = null }) {
  const cId = getActiveCompanyId(companyId);

  const execute = async (txConn) => {
    await ensureAccountingSchema(txConn, { companyId: cId });
    const mod = String(sourceModule || '').trim().toLowerCase();
    const idNum = sourceId !== undefined && sourceId !== null && sourceId !== '' ? Number(sourceId) : null;
    const typesList = Array.isArray(voucherTypes) && voucherTypes.length > 0
      ? voucherTypes.map((t) => normalizeVoucherType(t))
      : null;

    let matchingVouchers = [];
    if (mod && idNum) {
      const res = await txConn.query(
        `SELECT id, voucher_no FROM voucher WHERE LOWER(COALESCE(source_module, '')) = ? AND source_id = ?`,
        [mod, idNum]
      );
      matchingVouchers = res.rows || [];
    }

    if (matchingVouchers.length === 0 && idNum && typesList) {
      const placeholders = typesList.map(() => '?').join(', ');
      const refCandidate = referenceNo !== null && referenceNo !== undefined ? String(referenceNo) : String(idNum);
      const res = await txConn.query(
        `SELECT id, voucher_no FROM voucher
          WHERE voucher_type IN (${placeholders})
            AND (reference_no = ? OR id IN (SELECT DISTINCT voucher_id FROM ledger_entries WHERE reference_id = ? AND LOWER(COALESCE(reference_type, '')) = ?))
            AND (source_module IS NULL OR LOWER(source_module) = ?)`,
        [...typesList, refCandidate, idNum, mod, mod]
      );
      matchingVouchers = res.rows || [];
    }

    for (const v of matchingVouchers) {
      await txConn.run(`DELETE FROM ledger_entries WHERE voucher_id = ?`, [v.id]);
      await txConn.run(`DELETE FROM voucher_entry WHERE voucher_id = ?`, [v.id]);
      await txConn.run(`DELETE FROM voucher WHERE id = ?`, [v.id]);
    }

    // Also remove any orphaned ledger_entries strictly scoped to this module + id
    if (mod && idNum) {
      await txConn.run(
        `DELETE FROM ledger_entries WHERE reference_id = ? AND LOWER(COALESCE(reference_type, '')) = ?`,
        [idNum, mod]
      );
    }

    return matchingVouchers.length;
  };

  if (conn && typeof conn.query === 'function') {
    return execute(conn);
  }
  return db.withTransaction(execute, cId);
}

async function deleteVoucherById({ conn = null, companyId = null, voucherId }) {
  const cId = getActiveCompanyId(companyId);
  const execute = async (txConn) => {
    await ensureAccountingSchema(txConn, { companyId: cId });
    const vRes = await txConn.query(`SELECT id, is_reversed FROM voucher WHERE id = ? LIMIT 1`, [voucherId]);
    if (!vRes.rows || !vRes.rows[0]) {
      return { deleted: false, notFound: true };
    }
    await txConn.run(`DELETE FROM ledger_entries WHERE voucher_id = ?`, [voucherId]);
    await txConn.run(`DELETE FROM voucher_entry WHERE voucher_id = ?`, [voucherId]);
    await txConn.run(`DELETE FROM voucher WHERE id = ?`, [voucherId]);
    return { deleted: true };
  };
  if (conn && typeof conn.query === 'function') {
    return execute(conn);
  }
  return db.withTransaction(execute, cId);
}

async function reverseVoucher({ conn = null, companyId = null, voucherId, reason = 'Voucher Reversal', date = null }) {
  const cId = getActiveCompanyId(companyId);

  const execute = async (txConn) => {
    await ensureAccountingSchema(txConn, { companyId: cId });
    const vRes = await txConn.query(`SELECT * FROM voucher WHERE id = ? LIMIT 1`, [voucherId]);
    const orig = vRes.rows?.[0];
    if (!orig) {
      throw new Error(`Voucher #${voucherId} not found.`);
    }
    if (Number(orig.is_reversed || 0) === 1 || String(orig.status || '').toUpperCase() === 'REVERSED') {
      throw new Error(`Voucher ${orig.voucher_no} has already been reversed.`);
    }

    const entriesRes = await txConn.query(`SELECT * FROM voucher_entry WHERE voucher_id = ? ORDER BY id ASC`, [orig.id]);
    const origLines = entriesRes.rows || [];
    if (origLines.length < 2) {
      throw new Error(`Cannot reverse voucher ${orig.voucher_no}: missing entry lines.`);
    }

    const swappedLines = origLines.map((line) => ({
      ledgerId: line.ledger_id,
      ledgerName: line.ledger_name,
      debit: Number(line.credit || 0),
      credit: Number(line.debit || 0),
      remarks: `Reversal of ${orig.voucher_no}${reason ? `: ${reason}` : ''}`,
      referenceId: orig.source_id || orig.id,
      referenceType: 'reversal',
      transactionId: orig.id,
      transactionType: 'reversal',
    }));

    const revResult = await postVoucher({
      conn: txConn,
      companyId: cId,
      voucherType: 'Journal',
      prefix: 'JNL',
      date: date || orig.date || new Date().toISOString().slice(0, 10),
      referenceNo: orig.voucher_no,
      narration: `Reversal of ${orig.voucher_type} ${orig.voucher_no}${reason ? ` — ${reason}` : ''}`,
      sourceModule: 'reversal',
      sourceId: orig.id,
      postingKey: `REVERSAL:${orig.id}`,
      lines: swappedLines,
      allowUpdate: false,
      status: 'Approved',
      parentVoucherId: orig.id,
    });

    await txConn.run(
      `UPDATE voucher SET is_reversed = 1, status = 'REVERSED', reversed_voucher_id = ? WHERE id = ?`,
      [revResult.voucherId, orig.id]
    );

    return {
      originalVoucherId: orig.id,
      originalVoucherNo: orig.voucher_no,
      reversalVoucherId: revResult.voucherId,
      reversalVoucherNo: revResult.voucherNo,
    };
  };

  if (conn && typeof conn.query === 'function') {
    return execute(conn);
  }
  return db.withTransaction(execute, cId);
}

async function getGroupSummaryAndTree(companyId = null, { fromDate = null, toDate = null } = {}) {
  const cId = getActiveCompanyId(companyId);
  const runner = getRunner(null, cId);
  await ensureAccountingSchema(runner, { companyId: cId });

  const groupsRes = await runner.query(`
    SELECT lg.*
    FROM ledger_groups lg
    ORDER BY lg.account_nature ASC, lg.group_name ASC
  `);

  const ledgersRes = await runner.query(`
    SELECT lm.*,
      COALESCE(NULLIF(TRIM(lm.ledger_name), ''), lm.name) AS resolved_ledger_name,
      COALESCE(NULLIF(TRIM(lm.group_name), ''), lm.under) AS resolved_group_name
    FROM ledgermaster lm
    ORDER BY COALESCE(NULLIF(TRIM(lm.ledger_name), ''), lm.name) ASC
  `);

  const allGroups = groupsRes.rows || [];
  const allLedgers = ledgersRes.rows || [];

  const dateConds = [];
  const dateParams = [];
  if (fromDate) {
    dateConds.push(`date >= ?`);
    dateParams.push(normalizeDateIso(fromDate));
  }
  if (toDate) {
    dateConds.push(`date <= ?`);
    dateParams.push(normalizeDateIso(toDate));
  }
  const whereClause = dateConds.length > 0 ? `WHERE ${dateConds.join(' AND ')}` : '';

  const leRes = await runner.query(
    `SELECT id, ledger_id, ledger_name, COALESCE(debit, 0) AS debit, COALESCE(credit, 0) AS credit FROM ledger_entries ${whereClause}`,
    dateParams
  );

  // Build exact ledger index
  const ledgerById = new Map();
  const ledgerByName = new Map();
  allLedgers.forEach((l) => {
    ledgerById.set(Number(l.id), l);
    [l.resolved_ledger_name, l.name, l.printname, l.alias_name].forEach((cand) => {
      const norm = String(cand || '').trim().toLowerCase();
      if (norm && !ledgerByName.has(norm)) {
        ledgerByName.set(norm, l);
      }
    });
  });

  const totalsById = new Map();
  const orphanByName = new Map();

  for (const row of leRes.rows || []) {
    const drPaise = toPaise(row.debit);
    const crPaise = toPaise(row.credit);
    if (drPaise === 0 && crPaise === 0) continue;

    const normName = String(row.ledger_name || '').trim().toLowerCase();
    const matched = (row.ledger_id && ledgerById.get(Number(row.ledger_id))) || (normName && ledgerByName.get(normName)) || null;
    if (matched) {
      const prev = totalsById.get(matched.id) || { drPaise: 0, crPaise: 0 };
      prev.drPaise += drPaise;
      prev.crPaise += crPaise;
      totalsById.set(matched.id, prev);
    } else if (normName) {
      const prev = orphanByName.get(normName) || { displayName: String(row.ledger_name).trim(), drPaise: 0, crPaise: 0 };
      prev.drPaise += drPaise;
      prev.crPaise += crPaise;
      orphanByName.set(normName, prev);
    }
  }

  const formatLedger = (l, resolvedGroupName) => {
    const totals = totalsById.get(l.id) || { drPaise: 0, crPaise: 0 };
    const openPaise = toPaise(l.opening_balance ?? l.openingbalance ?? 0);
    const openType = String(l.opening_balance_type || l.opening_type || 'Dr').trim().toUpperCase() === 'CR' ? 'Cr' : 'Dr';
    const openSignedPaise = openType === 'Dr' ? openPaise : -openPaise;
    const netSignedPaise = openSignedPaise + totals.drPaise - totals.crPaise;

    return {
      id: l.id,
      name: l.resolved_ledger_name,
      ledger_name: l.resolved_ledger_name,
      code: l.ledger_code || l.alias_name || '',
      gst_no: l.gst_no || '',
      opening_balance: fromPaise(openPaise),
      opening_balance_type: openType,
      debit_total: fromPaise(totals.drPaise),
      credit_total: fromPaise(totals.crPaise),
      total_debit: fromPaise(totals.drPaise),
      total_credit: fromPaise(totals.crPaise),
      closing_balance: fromPaise(Math.abs(netSignedPaise)),
      closing_balance_type: netSignedPaise >= 0 ? 'Dr' : 'Cr',
      _drPaise: totals.drPaise,
      _crPaise: totals.crPaise,
      _netSignedPaise: netSignedPaise,
      group_name: resolvedGroupName,
      status: l.status || 'Active',
    };
  };

  const assignedIds = new Set();
  const groupNodes = allGroups.map((g) => {
    const normG = String(g.group_name || '').trim().toLowerCase();
    const matchedLedgers = allLedgers.filter((l) => {
      if (assignedIds.has(l.id)) return false;
      if (l.group_id && Number(l.group_id) === Number(g.id)) {
        assignedIds.add(l.id);
        return true;
      }
      const normLG = String(l.resolved_group_name || '').trim().toLowerCase();
      if (normLG === normG) {
        assignedIds.add(l.id);
        return true;
      }
      if (normG.includes('cash') && (normLG === 'cash' || normLG === 'cash-in-hand' || normLG === 'cash in hand')) {
        assignedIds.add(l.id);
        return true;
      }
      if (normG.includes('bank') && normLG.includes('bank')) {
        assignedIds.add(l.id);
        return true;
      }
      if (normG.includes('creditor') && (normLG.includes('creditor') || normLG.includes('supplier') || normLG.includes('payable'))) {
        assignedIds.add(l.id);
        return true;
      }
      if (normG.includes('debtor') && (normLG.includes('debtor') || normLG.includes('customer'))) {
        assignedIds.add(l.id);
        return true;
      }
      if (normG.includes('purchase') && normLG.includes('purchase')) {
        assignedIds.add(l.id);
        return true;
      }
      if (normG.includes('sales') && normLG.includes('sales')) {
        assignedIds.add(l.id);
        return true;
      }
      if (normG.includes('duties') && (normLG.includes('tax') || normLG.includes('gst') || normLG.includes('duties'))) {
        assignedIds.add(l.id);
        return true;
      }
      return false;
    }).map((l) => formatLedger(l, g.group_name));

    return {
      ...g,
      name: g.group_name,
      ledgers: matchedLedgers,
      children: [],
    };
  });

  // Assign any remaining ledgers in ledgermaster based on inferred nature
  const unassigned = allLedgers.filter((l) => !assignedIds.has(l.id));
  for (const l of unassigned) {
    const cls = inferLedgerClassification(l.resolved_ledger_name, l.resolved_group_name, l.ledger_type);
    const target = groupNodes.find((g) => g.group_name.toLowerCase() === cls.groupName.toLowerCase()) ||
                   groupNodes.find((g) => g.group_name === 'Direct Expenses') ||
                   groupNodes[0];
    if (target) {
      target.ledgers.push(formatLedger(l, target.group_name));
    }
  }

  // Assign any orphaned ledger_entries rows missing from ledgermaster
  for (const [, info] of orphanByName.entries()) {
    const cls = inferLedgerClassification(info.displayName);
    const target = groupNodes.find((g) => g.group_name.toLowerCase() === cls.groupName.toLowerCase()) || groupNodes[0];
    if (target) {
      const netSigned = info.drPaise - info.crPaise;
      target.ledgers.push({
        id: null,
        name: info.displayName,
        ledger_name: info.displayName,
        code: '',
        gst_no: '',
        opening_balance: 0,
        opening_balance_type: 'Dr',
        debit_total: fromPaise(info.drPaise),
        credit_total: fromPaise(info.crPaise),
        total_debit: fromPaise(info.drPaise),
        total_credit: fromPaise(info.crPaise),
        closing_balance: fromPaise(Math.abs(netSigned)),
        closing_balance_type: netSigned >= 0 ? 'Dr' : 'Cr',
        _drPaise: info.drPaise,
        _crPaise: info.crPaise,
        _netSignedPaise: netSigned,
        group_name: target.group_name,
        status: 'Active',
      });
    }
  }

  // Build parent -> child rollup (no cycles)
  const byId = new Map(groupNodes.map((g) => [Number(g.id), g]));
  groupNodes.forEach((g) => {
    if (g.parent_group_id && byId.has(Number(g.parent_group_id)) && Number(g.parent_group_id) !== Number(g.id)) {
      byId.get(Number(g.parent_group_id)).children.push(g);
    } else if (g.parent_group_name) {
      const p = groupNodes.find((cand) => cand.group_name.toLowerCase() === String(g.parent_group_name).toLowerCase() && cand.id !== g.id);
      if (p) p.children.push(g);
    }
  });

  const computeRollup = (node, visited = new Set()) => {
    if (visited.has(node.id)) return { drPaise: 0, crPaise: 0, netSignedPaise: 0 };
    visited.add(node.id);

    let directDrPaise = 0;
    let directCrPaise = 0;
    let directNetSignedPaise = 0;
    for (const l of node.ledgers) {
      directDrPaise += l._drPaise;
      directCrPaise += l._crPaise;
      directNetSignedPaise += l._netSignedPaise;
    }

    let childDrPaise = 0;
    let childCrPaise = 0;
    let childNetSignedPaise = 0;
    for (const child of node.children) {
      const cTot = computeRollup(child, visited);
      childDrPaise += cTot.drPaise;
      childCrPaise += cTot.crPaise;
      childNetSignedPaise += cTot.netSignedPaise;
    }

    const totalDrPaise = directDrPaise + childDrPaise;
    const totalCrPaise = directCrPaise + childCrPaise;
    const totalNetSignedPaise = directNetSignedPaise + childNetSignedPaise;

    node._directDrPaise = directDrPaise;
    node._directCrPaise = directCrPaise;
    node._directNetSignedPaise = directNetSignedPaise;
    node._totalDrPaise = totalDrPaise;
    node._totalCrPaise = totalCrPaise;
    node._totalNetSignedPaise = totalNetSignedPaise;

    return { drPaise: totalDrPaise, crPaise: totalCrPaise, netSignedPaise: totalNetSignedPaise };
  };

  groupNodes.forEach((g) => {
    if (g._totalDrPaise === undefined) computeRollup(g);
  });

  let grandDrPaise = 0;
  let grandCrPaise = 0;
  const formattedGroups = groupNodes.map((g) => {
    grandDrPaise += g._directDrPaise;
    grandCrPaise += g._directCrPaise;

    const cleanLedgers = g.ledgers.map(({ _drPaise, _crPaise, _netSignedPaise, ...rest }) => rest);
    const { children, _directDrPaise, _directCrPaise, _directNetSignedPaise, _totalDrPaise, _totalCrPaise, _totalNetSignedPaise, ...gRest } = g;

    return {
      ...gRest,
      ledger_count: cleanLedgers.length,
      direct_debit: fromPaise(_directDrPaise),
      direct_credit: fromPaise(_directCrPaise),
      group_debit: fromPaise(_totalDrPaise),
      group_credit: fromPaise(_totalCrPaise),
      debit_total: fromPaise(_totalDrPaise),
      credit_total: fromPaise(_totalCrPaise),
      closing_balance: fromPaise(Math.abs(_totalNetSignedPaise)),
      closing_balance_type: _totalNetSignedPaise >= 0 ? 'Dr' : 'Cr',
      ledgers: cleanLedgers,
    };
  });

  return {
    groups: formattedGroups,
    totals: {
      total_debit: fromPaise(grandDrPaise),
      total_credit: fromPaise(grandCrPaise),
      is_balanced: grandDrPaise === grandCrPaise,
      difference: fromPaise(grandDrPaise - grandCrPaise),
    },
  };
}

async function getTrialBalance(companyId = null, filters = {}) {
  const { groups, totals } = await getGroupSummaryAndTree(companyId, filters);
  const rows = [];
  let totalOpeningDrPaise = 0;
  let totalOpeningCrPaise = 0;
  let totalPeriodDrPaise = 0;
  let totalPeriodCrPaise = 0;
  let totalClosingDrPaise = 0;
  let totalClosingCrPaise = 0;

  for (const g of groups) {
    for (const l of g.ledgers || []) {
      const openPaise = toPaise(l.opening_balance);
      const openDr = l.opening_balance_type === 'Dr' ? openPaise : 0;
      const openCr = l.opening_balance_type === 'Cr' ? openPaise : 0;
      const perDr = toPaise(l.total_debit);
      const perCr = toPaise(l.total_credit);
      const closePaise = toPaise(l.closing_balance);
      const closeDr = l.closing_balance_type === 'Dr' ? closePaise : 0;
      const closeCr = l.closing_balance_type === 'Cr' ? closePaise : 0;

      if (openPaise === 0 && perDr === 0 && perCr === 0 && closePaise === 0) continue;

      totalOpeningDrPaise += openDr;
      totalOpeningCrPaise += openCr;
      totalPeriodDrPaise += perDr;
      totalPeriodCrPaise += perCr;
      totalClosingDrPaise += closeDr;
      totalClosingCrPaise += closeCr;

      rows.push({
        ...l,
        account_nature: g.account_nature,
        opening_debit: fromPaise(openDr),
        opening_credit: fromPaise(openCr),
        period_debit: fromPaise(perDr),
        period_credit: fromPaise(perCr),
        closing_debit: fromPaise(closeDr),
        closing_credit: fromPaise(closeCr),
      });
    }
  }

  return {
    rows,
    totals: {
      opening_debit: fromPaise(totalOpeningDrPaise),
      opening_credit: fromPaise(totalOpeningCrPaise),
      period_debit: fromPaise(totalPeriodDrPaise),
      period_credit: fromPaise(totalPeriodCrPaise),
      closing_debit: fromPaise(totalClosingDrPaise),
      closing_credit: fromPaise(totalClosingCrPaise),
      is_balanced: totalPeriodDrPaise === totalPeriodCrPaise && totalClosingDrPaise === totalClosingCrPaise,
      ledger_totals: totals,
    },
  };
}

async function syncLegacyPurchaseVouchers(companyId = null) {
  const cId = getActiveCompanyId(companyId);
  const { createPurchaseVoucherChain } = require('../utils/ledgerHelper');

  return db.forCompany(cId).withTransaction(async (txConn) => {
    await ensureAccountingSchema(txConn, { companyId: cId });

    // Check if purchases table exists
    try {
      await txConn.query(`SELECT id FROM purchases LIMIT 1`);
    } catch (_) {
      return { synced: 0, linkedVouchers: 0 };
    }

    const allPurchasesRes = await txConn.query(`SELECT * FROM purchases ORDER BY id ASC`);
    const purchases = allPurchasesRes.rows || [];
    let linkedVouchers = 0;
    let repostedPurchases = 0;

    for (const p of purchases) {
      const pId = Number(p.id);
      const pk = `purchase:${pId}`;

      // Locate existing voucher for this purchase
      let vRow = null;
      const vBySource = await txConn.query(
        `SELECT * FROM voucher
          WHERE COALESCE(is_reversed, 0) = 0
            AND (
              posting_key = ?
              OR (LOWER(COALESCE(source_module, '')) = 'purchase' AND source_id = ?)
              OR (UPPER(voucher_type) IN ('PURCHASE', 'PUR') AND reference_no IN (?, ?))
            )
          ORDER BY id DESC LIMIT 1`,
        [pk, pId, String(pId), `PUR-${pId}`]
      );
      vRow = vBySource.rows?.[0] || null;

      if (!vRow) {
        const vByLe = await txConn.query(
          `SELECT v.*
             FROM voucher v
             JOIN ledger_entries le ON le.voucher_id = v.id
            WHERE le.reference_id = ?
              AND LOWER(COALESCE(le.reference_type, '')) = 'purchase'
              AND COALESCE(v.is_reversed, 0) = 0
            ORDER BY v.id DESC LIMIT 1`,
          [pId]
        );
        vRow = vByLe.rows?.[0] || null;
      }

      if (!vRow && p.voucher_no) {
        const vByNo = await txConn.query(
          `SELECT * FROM voucher WHERE UPPER(TRIM(voucher_no)) = UPPER(TRIM(?)) AND COALESCE(is_reversed, 0) = 0 LIMIT 1`,
          [String(p.voucher_no).trim()]
        );
        vRow = vByNo.rows?.[0] || null;
      }

      const resolvedVoucherNo = p.voucher_no || vRow?.voucher_no || null;

      // Link legacy voucher metadata cleanly
      if (vRow && (!vRow.source_module || !vRow.source_id || !vRow.posting_key)) {
        await txConn.run(
          `UPDATE voucher
              SET company_id = COALESCE(company_id, ?),
                  source_module = 'purchase',
                  source_id = ?,
                  posting_key = ?
            WHERE id = ?`,
          [cId, pId, pk, vRow.id]
        ).catch(() => {});
        await txConn.run(
          `UPDATE ledger_entries SET posting_key = ? WHERE voucher_id = ? AND (posting_key IS NULL OR posting_key = '')`,
          [pk, vRow.id]
        ).catch(() => {});
        linkedVouchers++;
      }

      // Backfill purchases.voucher_no if null/empty
      if (resolvedVoucherNo && (!p.voucher_no || String(p.voucher_no).trim() === '')) {
        await txConn.run(`UPDATE purchases SET voucher_no = ? WHERE id = ?`, [resolvedVoucherNo, pId]).catch(() => {});
      }

      // Inspect existing voucher entries for missing Transport, Loadman, or Deduction lines
      let needsRepost = false;
      const transportAmt = Number(p.net_transport_amount || p.transport_charges || p.freight_amount || 0);
      const loadmanAmt = Number(p.loadman_charges || 0);
      const transPayType = String(p.transport_payable_type || 'SEPARATE').toUpperCase();
      const loadmanPayType = String(p.loadman_payable_type || 'SEPARATE').toUpperCase();

      const dedRes = await txConn.query(`SELECT * FROM purchase_deductions WHERE purchase_id = ?`, [pId]).catch(() => ({ rows: [] }));
      const deductions = dedRes.rows || [];

      if (!vRow) {
        if (Number(p.grand_total || p.net_amount || p.base_amount || 0) > 0) {
          needsRepost = true;
        }
      } else {
        const veRes = await txConn.query(`SELECT ledger_name, debit, credit FROM voucher_entry WHERE voucher_id = ?`, [vRow.id]);
        const veRows = veRes.rows || [];
        if (veRows.length === 0) {
          needsRepost = true;
        } else {
          const namesLower = new Set(veRows.map((e) => String(e.ledger_name || '').trim().toLowerCase()));
          if (transportAmt > 0 && transPayType !== 'SUPPLIER_INVOICE' && !namesLower.has('transport charges')) {
            needsRepost = true;
          }
          if (loadmanAmt > 0 && loadmanPayType !== 'SUPPLIER_INVOICE' && !namesLower.has('loadman charges')) {
            needsRepost = true;
          }
          const hasLessDed = deductions.some((d) => (!d.type || String(d.type).toUpperCase() === 'LESS') && Number(d.amount || 0) > 0);
          if (hasLessDed && !namesLower.has('purchase deduction recovery') && !namesLower.has('mamool recovery')) {
            needsRepost = true;
          }
        }
      }

      if (needsRepost && resolvedVoucherNo) {
        const isInterstatePur = String(p.tax_type || '').toLowerCase().includes('inter') || Number(p.igst_amount || 0) > 0;
        const taxVal = Number(p.tax_amount || 0);
        const cgstVal = Number(p.cgst_amount || 0) || (isInterstatePur ? 0 : Number((taxVal / 2).toFixed(2)));
        const sgstVal = Number(p.sgst_amount || 0) || (isInterstatePur ? 0 : Number((taxVal - cgstVal).toFixed(2)));
        const igstVal = Number(p.igst_amount || 0) || (isInterstatePur ? taxVal : 0);

        try {
          await createPurchaseVoucherChain({
            conn: txConn,
            companyId: cId,
            supplier: p.supplier,
            date: p.date,
            invNo: p.inv_no || p.s_no || pId,
            purchaseId: pId,
            baseAmount: Number(p.base_amount || p.taxable_amount || 0) || Math.max(0, Number(p.net_amount || 0) - taxVal + Number(p.disc_amount || 0)),
            taxAmount: taxVal,
            cgstAmount: cgstVal,
            sgstAmount: sgstVal,
            igstAmount: igstVal,
            isInterstate: isInterstatePur,
            discAmount: Number(p.disc_amount || 0),
            netAmount: Number(p.grand_total || p.net_amount || 0),
            deductions,
            roundOff: Number(p.round_off || 0),
            mamoolAmount: Number(p.mamool_amount || 0),
            weightCashAmount: Number(p.weight_cash || p.weight_cash_amount || 0),
            otherAdditionalCharges: Number(p.other_additional_charges || 0),
            otherDeductions: Number(p.other_deductions || 0),
            transporter: p.transporter || p.transport || '',
            transportCharges: transportAmt,
            transportPayableType: transPayType,
            loadmanCharges: loadmanAmt,
            loadmanName: p.loadman_name || null,
            loadmanWorkerId: p.loadman_worker_id || null,
            loadmanPayableType: loadmanPayType,
            existingVoucherNo: resolvedVoucherNo,
          });
          repostedPurchases++;
        } catch (repostErr) {
          console.warn(`[AccountingEngine] Could not sync purchase #${pId}: ${repostErr.message}`);
        }
      }
    }

    return { synced: repostedPurchases, linkedVouchers };
  });
}

module.exports = {
  VOUCHER_PREFIX_MAP,
  STANDARD_LEDGER_GROUPS,
  toPaise,
  fromPaise,
  round2,
  normalizeDateIso,
  getActiveCompanyId,
  getPrefixForVoucherType,
  normalizeVoucherType,
  ensureAccountingSchema,
  invalidateSchemaCache,
  syncLegacyPurchaseVouchers,
  getFinancialYearForDate,
  nextVoucherNumber,
  previewVoucherNumber,
  resolveOrCreateLedger,
  postVoucher,
  deleteVoucherBySource,
  deleteVoucherById,
  reverseVoucher,
  getGroupSummaryAndTree,
  getTrialBalance,
};
