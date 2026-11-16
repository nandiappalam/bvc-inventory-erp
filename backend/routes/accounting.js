const express = require('express');
const router = express.Router();
const db = require('../config/database');
const AccountingEngine = require('../services/AccountingEngine');
const { enrichStatementRow } = require('../utils/statementParticularsHelper');

// Initial standard Tally Ledger Groups
const INITIAL_LEDGER_GROUPS = [
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

async function initAccountingTables(companyId = null) {
  try {
    // 1. Ledger Groups table
    await db.run(`
      CREATE TABLE IF NOT EXISTS ledger_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_name TEXT UNIQUE NOT NULL,
        parent_group_id INTEGER,
        parent_group_name TEXT,
        account_nature TEXT NOT NULL DEFAULT 'Expense',
        financial_statement TEXT NOT NULL DEFAULT 'Profit & Loss',
        normal_balance TEXT NOT NULL DEFAULT 'Dr',
        description TEXT,
        status TEXT DEFAULT 'Active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, [], companyId);

    // 2. Ledger Master table
    await db.run(`
      CREATE TABLE IF NOT EXISTS ledgermaster (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ledger_name TEXT UNIQUE NOT NULL,
        ledger_code TEXT,
        group_id INTEGER,
        group_name TEXT,
        opening_balance REAL DEFAULT 0,
        opening_balance_type TEXT DEFAULT 'Dr',
        opening_date DATE,
        linked_party_type TEXT,
        linked_party_id INTEGER,
        gst_no TEXT,
        contact_person TEXT,
        phone TEXT,
        email TEXT,
        credit_period INTEGER DEFAULT 30,
        status TEXT DEFAULT 'Active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, [], companyId);

    // Check and migrate columns if ledgermaster existed with older/different schema
    try {
      const tableInfo = await db.query('PRAGMA table_info(ledgermaster)', [], companyId);
      const columns = new Set((tableInfo.rows || []).map(r => r.name));
      if (!columns.has('ledger_name')) {
        try { await db.run('ALTER TABLE ledgermaster ADD COLUMN ledger_name TEXT', [], companyId); } catch (e) {}
      }
      if (columns.has('name')) {
        try { await db.run("UPDATE ledgermaster SET ledger_name = name WHERE ledger_name IS NULL OR ledger_name = ''", [], companyId); } catch (e) {}
      }
      if (!columns.has('group_name')) {
        try { await db.run('ALTER TABLE ledgermaster ADD COLUMN group_name TEXT', [], companyId); } catch (e) {}
      }
      if (columns.has('under')) {
        try { await db.run("UPDATE ledgermaster SET group_name = under WHERE group_name IS NULL OR group_name = ''", [], companyId); } catch (e) {}
      }
      if (!columns.has('ledger_code')) { try { await db.run('ALTER TABLE ledgermaster ADD COLUMN ledger_code TEXT', [], companyId); } catch (e) {} }
      if (!columns.has('group_id')) { try { await db.run('ALTER TABLE ledgermaster ADD COLUMN group_id INTEGER', [], companyId); } catch (e) {} }
      if (!columns.has('opening_balance')) { try { await db.run('ALTER TABLE ledgermaster ADD COLUMN opening_balance REAL DEFAULT 0', [], companyId); } catch (e) {} }
      if (!columns.has('opening_balance_type')) { try { await db.run("ALTER TABLE ledgermaster ADD COLUMN opening_balance_type TEXT DEFAULT 'Dr'", [], companyId); } catch (e) {} }
      if (!columns.has('opening_date')) { try { await db.run('ALTER TABLE ledgermaster ADD COLUMN opening_date DATE', [], companyId); } catch (e) {} }
      if (!columns.has('linked_party_type')) { try { await db.run('ALTER TABLE ledgermaster ADD COLUMN linked_party_type TEXT', [], companyId); } catch (e) {} }
      if (!columns.has('linked_party_id')) { try { await db.run('ALTER TABLE ledgermaster ADD COLUMN linked_party_id INTEGER', [], companyId); } catch (e) {} }
      if (!columns.has('gst_no')) { try { await db.run('ALTER TABLE ledgermaster ADD COLUMN gst_no TEXT', [], companyId); } catch (e) {} }
      if (!columns.has('contact_person')) { try { await db.run('ALTER TABLE ledgermaster ADD COLUMN contact_person TEXT', [], companyId); } catch (e) {} }
      if (!columns.has('phone')) { try { await db.run('ALTER TABLE ledgermaster ADD COLUMN phone TEXT', [], companyId); } catch (e) {} }
      if (!columns.has('email')) { try { await db.run('ALTER TABLE ledgermaster ADD COLUMN email TEXT', [], companyId); } catch (e) {} }
      if (!columns.has('credit_period')) { try { await db.run('ALTER TABLE ledgermaster ADD COLUMN credit_period INTEGER DEFAULT 30', [], companyId); } catch (e) {} }
      if (!columns.has('status')) { try { await db.run("ALTER TABLE ledgermaster ADD COLUMN status TEXT DEFAULT 'Active'", [], companyId); } catch (e) {} }
    } catch (migErr) {
      console.warn('Migration check warning:', migErr.message);
    }

    // Seed Ledger Groups if table is empty
    const groupCountRes = await db.query("SELECT COUNT(*) as cnt FROM ledger_groups", [], companyId);
    const count = parseInt(groupCountRes?.rows?.[0]?.cnt || 0, 10) || 0;
    if (count === 0) {
      console.log('Seeding initial Tally Ledger Groups...');
      for (const g of INITIAL_LEDGER_GROUPS) {
        let parentId = null;
        if (g.parent) {
          const parentRes = await db.query("SELECT id FROM ledger_groups WHERE group_name = ? LIMIT 1", [g.parent], companyId);
          if (parentRes?.rows?.[0]) parentId = parentRes.rows[0].id;
        }
        await db.run(`
          INSERT INTO ledger_groups (group_name, parent_group_id, parent_group_name, account_nature, financial_statement, normal_balance)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [g.name, parentId, g.parent || null, g.nature, g.statement, g.balance], companyId);
      }
    }

    // Seed core system ledgers if missing
    const defaultLedgers = [
      { name: 'Purchase Account', group: 'Purchase Accounts', type: 'Dr' },
      { name: 'Sales Account', group: 'Sales Accounts', type: 'Cr' },
      { name: 'Input CGST', group: 'Duties & Taxes', type: 'Dr' },
      { name: 'Input SGST', group: 'Duties & Taxes', type: 'Dr' },
      { name: 'Input IGST', group: 'Duties & Taxes', type: 'Dr' },
      { name: 'Output CGST', group: 'Duties & Taxes', type: 'Cr' },
      { name: 'Output SGST', group: 'Duties & Taxes', type: 'Cr' },
      { name: 'Output IGST', group: 'Duties & Taxes', type: 'Cr' },
      { name: 'Transport Charges', group: 'Direct Expenses', type: 'Dr' },
      { name: 'Loadman Charges', group: 'Direct Expenses', type: 'Dr' },
      { name: 'Purchase Deduction Recovery', group: 'Indirect Income', type: 'Cr' },
      { name: 'Cash Account', group: 'Cash-in-hand', type: 'Dr' },
      { name: 'Bank Account', group: 'Bank Accounts', type: 'Dr' }
    ];

    for (const dl of defaultLedgers) {
      const checkRes = await db.query("SELECT id FROM ledgermaster WHERE LOWER(TRIM(COALESCE(ledger_name, name))) = LOWER(TRIM(?)) LIMIT 1", [dl.name], companyId);
      if (!checkRes?.rows?.length) {
        const groupRes = await db.query("SELECT id FROM ledger_groups WHERE group_name = ? LIMIT 1", [dl.group], companyId);
        const groupId = groupRes?.rows?.[0]?.id || null;
        await db.run(`
          INSERT INTO ledgermaster (ledger_name, ledger_code, group_id, group_name, opening_balance, opening_balance_type, status)
          VALUES (?, ?, ?, ?, 0, ?, 'Active')
        `, [dl.name, dl.name.toUpperCase().replace(/\s+/g, '_'), groupId, dl.group, dl.type], companyId);
      }
    }

  } catch (err) {
    console.error('Error initializing accounting tables:', err);
  }
}

const _accountingCompanyInit = new Set();

if (typeof db.registerCacheInvalidator === 'function') {
  db.registerCacheInvalidator((cId) => {
    if (cId === null || cId === undefined) _accountingCompanyInit.clear();
    else _accountingCompanyInit.delete(parseInt(cId, 10) || 1);
  });
}

function resolveCompanyId(req) {
  return parseInt(req.companyId || req.headers['x-company-id'] || req.query?.company_id || req.body?.company_id || 1, 10) || 1;
}

router.use(async (req, res, next) => {
  try {
    const cId = resolveCompanyId(req);
    req.companyId = cId;
    if (!_accountingCompanyInit.has(cId)) {
      await initAccountingTables(cId);
      await AccountingEngine.ensureAccountingSchema(db.forCompany(cId), { companyId: cId });
      _accountingCompanyInit.add(cId);
    }
  } catch (err) {
    console.warn('[accounting] Table initialization notice:', err.message);
  }
  next();
});

// -------------------------------------------------------------
// 1. ACCOUNTING DASHBOARD METRICS
// -------------------------------------------------------------
router.get('/dashboard', async (req, res) => {
  try {
    const cId = resolveCompanyId(req);
    const cDb = db.forCompany(cId);

    const totalsRes = await cDb.query(`
      SELECT 
        COALESCE(SUM(le.debit), 0) as total_debits,
        COALESCE(SUM(le.credit), 0) as total_credits
      FROM ledger_entries le
      WHERE COALESCE(le.is_reversed, 0) = 0
    `);

    const ledgerMatchJoin = `LEFT JOIN ledgermaster lm ON (le.ledger_id = lm.id OR LOWER(TRIM(le.ledger_name)) = LOWER(TRIM(COALESCE(lm.ledger_name, lm.name, ''))))`;

    const cashRes = await cDb.query(`
      SELECT COALESCE(SUM(le.debit) - SUM(le.credit), 0) as balance
      FROM ledger_entries le
      ${ledgerMatchJoin}
      WHERE COALESCE(le.is_reversed, 0) = 0
        AND (COALESCE(lm.group_name, lm.under) = 'Cash-in-hand' OR LOWER(le.ledger_name) LIKE '%cash%')
    `);

    const bankRes = await cDb.query(`
      SELECT COALESCE(SUM(le.debit) - SUM(le.credit), 0) as balance
      FROM ledger_entries le
      ${ledgerMatchJoin}
      WHERE COALESCE(le.is_reversed, 0) = 0
        AND (COALESCE(lm.group_name, lm.under) = 'Bank Accounts' OR LOWER(le.ledger_name) LIKE '%bank%')
    `);

    const supplierRes = await cDb.query(`
      SELECT COALESCE(SUM(le.credit) - SUM(le.debit), 0) as outstanding
      FROM ledger_entries le
      ${ledgerMatchJoin}
      WHERE COALESCE(le.is_reversed, 0) = 0
        AND (COALESCE(lm.group_name, lm.under) = 'Sundry Creditors' OR LOWER(COALESCE(lm.linked_party_type, lm.ledger_type, '')) = 'supplier')
    `);

    const customerRes = await cDb.query(`
      SELECT COALESCE(SUM(le.debit) - SUM(le.credit), 0) as outstanding
      FROM ledger_entries le
      ${ledgerMatchJoin}
      WHERE COALESCE(le.is_reversed, 0) = 0
        AND (COALESCE(lm.group_name, lm.under) = 'Sundry Debtors' OR LOWER(COALESCE(lm.linked_party_type, lm.ledger_type, '')) = 'customer')
    `);

    const purchaseRes = await cDb.query(`
      SELECT COALESCE(SUM(le.debit) - SUM(le.credit), 0) as total
      FROM ledger_entries le
      WHERE COALESCE(le.is_reversed, 0) = 0 AND LOWER(le.ledger_name) LIKE 'purchase account%'
    `);
    const salesRes = await cDb.query(`
      SELECT COALESCE(SUM(le.credit) - SUM(le.debit), 0) as total
      FROM ledger_entries le
      WHERE COALESCE(le.is_reversed, 0) = 0 AND LOWER(le.ledger_name) LIKE 'sales account%'
    `);

    const directExpRes = await cDb.query(`
      SELECT COALESCE(SUM(le.debit - le.credit), 0) as total
      FROM ledger_entries le
      ${ledgerMatchJoin}
      LEFT JOIN ledger_groups lg ON lm.group_id = lg.id
      WHERE COALESCE(le.is_reversed, 0) = 0
        AND (lg.group_name = 'Direct Expenses' OR COALESCE(lm.group_name, lm.under) = 'Direct Expenses' OR le.ledger_name IN ('Transport Charges', 'Loadman Charges'))
    `);

    const indirectExpRes = await cDb.query(`
      SELECT COALESCE(SUM(le.debit - le.credit), 0) as total
      FROM ledger_entries le
      ${ledgerMatchJoin}
      LEFT JOIN ledger_groups lg ON lm.group_id = lg.id
      WHERE COALESCE(le.is_reversed, 0) = 0
        AND (lg.group_name = 'Indirect Expenses' OR COALESCE(lm.group_name, lm.under) = 'Indirect Expenses')
    `);

    const inputGstRes = await cDb.query(`
      SELECT COALESCE(SUM(le.debit) - SUM(le.credit), 0) as total
      FROM ledger_entries le
      WHERE COALESCE(le.is_reversed, 0) = 0 AND LOWER(le.ledger_name) LIKE 'input %'
    `);
    const outputGstRes = await cDb.query(`
      SELECT COALESCE(SUM(le.credit) - SUM(le.debit), 0) as total
      FROM ledger_entries le
      WHERE COALESCE(le.is_reversed, 0) = 0 AND LOWER(le.ledger_name) LIKE 'output %'
    `);

    const totalDebits = Number(totalsRes.rows[0]?.total_debits || 0);
    const totalCredits = Number(totalsRes.rows[0]?.total_credits || 0);
    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

    res.json({
      success: true,
      data: {
        total_debits: totalDebits,
        total_credits: totalCredits,
        is_balanced: isBalanced,
        cash_balance: Number(cashRes.rows[0]?.balance || 0),
        bank_balance: Number(bankRes.rows[0]?.balance || 0),
        supplier_outstanding: Math.max(0, Number(supplierRes.rows[0]?.outstanding || 0)),
        customer_outstanding: Math.max(0, Number(customerRes.rows[0]?.outstanding || 0)),
        purchase_total: Number(purchaseRes.rows[0]?.total || 0),
        sales_total: Number(salesRes.rows[0]?.total || 0),
        direct_expenses: Number(directExpRes.rows[0]?.total || 0),
        indirect_expenses: Number(indirectExpRes.rows[0]?.total || 0),
        gst_input_credit: Number(inputGstRes.rows[0]?.total || 0),
        gst_output_tax: Number(outputGstRes.rows[0]?.total || 0)
      }
    });
  } catch (err) {
    console.error('Error fetching accounting dashboard:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 2. LEDGER GROUPS (CRUD & TREE)
// -------------------------------------------------------------
router.get('/groups', async (req, res) => {
  try {
    const cId = resolveCompanyId(req);
    const summary = await AccountingEngine.getGroupSummaryAndTree(cId, {
      fromDate: req.query.from_date || null,
      toDate: req.query.to_date || null,
    });
    res.json({
      success: true,
      data: summary.groups,
      groups: summary.groups,
      totals: summary.totals,
    });
  } catch (err) {
    console.error('Error fetching ledger groups:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/groups', async (req, res) => {
  try {
    const cId = resolveCompanyId(req);
    const cDb = db.forCompany(cId);
    const { group_name, parent_group_id, account_nature, financial_statement, normal_balance, description } = req.body;
    if (!group_name) return res.status(400).json({ success: false, message: 'Group name is required' });

    let parentName = null;
    if (parent_group_id) {
      const pRes = await cDb.query("SELECT group_name FROM ledger_groups WHERE id = ?", [parent_group_id]);
      if (pRes.rows[0]) parentName = pRes.rows[0].group_name;
    }

    const ins = await cDb.run(`
      INSERT INTO ledger_groups (group_name, parent_group_id, parent_group_name, account_nature, financial_statement, normal_balance, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [group_name.trim(), parent_group_id || null, parentName, account_nature || 'Expense', financial_statement || 'Profit & Loss', normal_balance || 'Dr', description || '']);

    res.json({ success: true, message: 'Ledger group created successfully', id: ins.lastID || ins.lastInsertRowid });
  } catch (err) {
    console.error('Error creating ledger group:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put('/groups/:id', async (req, res) => {
  try {
    const cId = resolveCompanyId(req);
    const cDb = db.forCompany(cId);
    const { group_name, parent_group_id, account_nature, financial_statement, normal_balance, description, status } = req.body;
    const { id } = req.params;

    let parentName = null;
    if (parent_group_id) {
      const pRes = await cDb.query("SELECT group_name FROM ledger_groups WHERE id = ?", [parent_group_id]);
      if (pRes.rows[0]) parentName = pRes.rows[0].group_name;
    }

    await cDb.run(`
      UPDATE ledger_groups 
      SET group_name = ?, parent_group_id = ?, parent_group_name = ?, account_nature = ?, financial_statement = ?, normal_balance = ?, description = ?, status = ?
      WHERE id = ?
    `, [group_name.trim(), parent_group_id || null, parentName, account_nature, financial_statement, normal_balance, description || '', status || 'Active', id]);

    res.json({ success: true, message: 'Ledger group updated successfully' });
  } catch (err) {
    console.error('Error updating ledger group:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete('/groups/:id', async (req, res) => {
  try {
    const cId = resolveCompanyId(req);
    const cDb = db.forCompany(cId);
    const { id } = req.params;
    const checkLedgers = await cDb.query("SELECT id FROM ledgermaster WHERE group_id = ? LIMIT 1", [id]);
    if (checkLedgers.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete group that contains active ledgers.' });
    }

    await cDb.run("DELETE FROM ledger_groups WHERE id = ?", [id]);
    res.json({ success: true, message: 'Ledger group deleted successfully' });
  } catch (err) {
    console.error('Error deleting ledger group:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// 3. LEDGER MASTER (CRUD)
// -------------------------------------------------------------
router.get('/ledgers', async (req, res) => {
  try {
    const cId = resolveCompanyId(req);
    const cDb = db.forCompany(cId);
    const result = await cDb.query(`
      SELECT lm.*,
        COALESCE(NULLIF(TRIM(lm.ledger_name), ''), lm.name) AS ledger_name,
        COALESCE(NULLIF(TRIM(lm.group_name), ''), lm.under) AS group_name,
        lg.account_nature,
        lg.financial_statement,
        COALESCE((SELECT SUM(le.debit) FROM ledger_entries le WHERE COALESCE(le.is_reversed, 0) = 0 AND (le.ledger_id = lm.id OR LOWER(TRIM(le.ledger_name)) = LOWER(TRIM(COALESCE(lm.ledger_name, lm.name))))), 0) as total_debit,
        COALESCE((SELECT SUM(le.credit) FROM ledger_entries le WHERE COALESCE(le.is_reversed, 0) = 0 AND (le.ledger_id = lm.id OR LOWER(TRIM(le.ledger_name)) = LOWER(TRIM(COALESCE(lm.ledger_name, lm.name))))), 0) as total_credit
      FROM ledgermaster lm
      LEFT JOIN ledger_groups lg ON lm.group_id = lg.id OR LOWER(TRIM(COALESCE(lm.group_name, lm.under))) = LOWER(TRIM(lg.group_name))
      ORDER BY COALESCE(NULLIF(TRIM(lm.ledger_name), ''), lm.name) ASC
    `);

    const rows = (result.rows || []).map(r => {
      const openBal = Number(r.opening_balance ?? r.openingbalance ?? 0);
      const openType = (r.opening_balance_type || r.opening_type || 'Dr').trim() === 'Cr' ? 'Cr' : 'Dr';
      const totDr = Number(r.total_debit || 0);
      const totCr = Number(r.total_credit || 0);

      let closing = openType === 'Dr' ? (openBal + totDr - totCr) : (openBal + totCr - totDr);
      let closingType = openType;
      if (closing < 0) {
        closing = Math.abs(closing);
        closingType = openType === 'Dr' ? 'Cr' : 'Dr';
      }

      return {
        ...r,
        closing_balance: Number(closing.toFixed(2)),
        closing_balance_type: closingType
      };
    });

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error fetching ledgers:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/ledgers', async (req, res) => {
  try {
    const cId = resolveCompanyId(req);
    const cDb = db.forCompany(cId);
    const { ledger_name, ledger_code, group_id, group_name, opening_balance, opening_balance_type, opening_date, linked_party_type, linked_party_id, gst_no, contact_person, phone, email, credit_period } = req.body;
    if (!ledger_name) return res.status(400).json({ success: false, message: 'Ledger name is required' });

    let finalGroupName = group_name;
    if (group_id && !finalGroupName) {
      const gRes = await cDb.query("SELECT group_name FROM ledger_groups WHERE id = ?", [group_id]);
      if (gRes.rows[0]) finalGroupName = gRes.rows[0].group_name;
    }

    const cleanName = ledger_name.trim();
    const openBal = parseFloat(opening_balance || 0);
    const openType = opening_balance_type || 'Dr';

    const ins = await cDb.run(`
      INSERT INTO ledgermaster (name, ledger_name, printname, ledger_code, group_id, under, group_name, openingbalance, opening_balance, opening_type, opening_balance_type, opening_date, linked_party_type, linked_party_id, gst_no, contact_person, phone, email, credit_period)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      cleanName,
      cleanName,
      cleanName.toUpperCase(),
      ledger_code || cleanName.toUpperCase().replace(/\s+/g, '_'),
      group_id || null,
      finalGroupName || 'General',
      finalGroupName || 'General',
      openBal,
      openBal,
      openType,
      openType,
      opening_date || new Date().toISOString().slice(0, 10),
      linked_party_type || null,
      linked_party_id || null,
      gst_no || '',
      contact_person || '',
      phone || '',
      email || '',
      parseInt(credit_period || 30, 10)
    ]);

    res.json({ success: true, message: 'Ledger created successfully', id: ins.lastID || ins.lastInsertRowid });
  } catch (err) {
    console.error('Error creating ledger:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// 4. TALLY-STYLE INDIVIDUAL LEDGER STATEMENT
// -------------------------------------------------------------
router.get('/ledger-statement', async (req, res) => {
  try {
    const cId = resolveCompanyId(req);
    const cDb = db.forCompany(cId);
    const { ledger_id, ledger_name, from_date, to_date, voucher_type, search } = req.query;

    let targetLedger = null;
    if (ledger_id && /^\d+$/.test(String(ledger_id).trim())) {
      const lRes = await cDb.query("SELECT * FROM ledgermaster WHERE id = ? LIMIT 1", [Number(ledger_id)]);
      targetLedger = lRes.rows?.[0] || null;
    }
    if (!targetLedger && ledger_name) {
      const lRes = await cDb.query(
        "SELECT * FROM ledgermaster WHERE LOWER(TRIM(COALESCE(ledger_name, name, ''))) = LOWER(TRIM(?)) OR LOWER(TRIM(COALESCE(name, ''))) = LOWER(TRIM(?)) OR LOWER(TRIM(COALESCE(printname, ''))) = LOWER(TRIM(?)) LIMIT 1",
        [ledger_name, ledger_name, ledger_name]
      );
      targetLedger = lRes.rows?.[0] || null;
    }

    if (!targetLedger) {
      const name = ledger_name || `Ledger #${ledger_id}`;
      targetLedger = {
        id: ledger_id && /^\d+$/.test(String(ledger_id)) ? Number(ledger_id) : 0,
        name: name,
        ledger_name: name,
        group_name: 'General',
        opening_balance: 0,
        opening_balance_type: 'Dr'
      };
    }

    const lName = targetLedger.ledger_name || targetLedger.name;
    const lId = targetLedger.id;

    let openingVal = Number(targetLedger.opening_balance ?? targetLedger.openingbalance ?? 0);
    let openingType = (targetLedger.opening_balance_type || targetLedger.opening_type || 'Dr').trim() === 'Cr' ? 'Cr' : 'Dr';

    const matchCond = lId && Number(lId) > 0
      ? '(le.ledger_id = ? OR LOWER(TRIM(le.ledger_name)) = LOWER(TRIM(?)))'
      : 'LOWER(TRIM(le.ledger_name)) = LOWER(TRIM(?))';
    const matchParams = lId && Number(lId) > 0 ? [Number(lId), lName] : [lName];

    if (from_date) {
      const preTxRes = await cDb.query(`
        SELECT COALESCE(SUM(le.debit), 0) as pre_dr, COALESCE(SUM(le.credit), 0) as pre_cr
        FROM ledger_entries le
        WHERE ${matchCond}
          AND COALESCE(le.is_reversed, 0) = 0
          AND le.date < ?
      `, [...matchParams, from_date]);

      const preDr = Number(preTxRes.rows[0]?.pre_dr || 0);
      const preCr = Number(preTxRes.rows[0]?.pre_cr || 0);

      if (openingType === 'Dr') {
        openingVal = openingVal + preDr - preCr;
      } else {
        openingVal = openingVal + preCr - preDr;
      }

      if (openingVal < 0) {
        openingVal = Math.abs(openingVal);
        openingType = openingType === 'Dr' ? 'Cr' : 'Dr';
      }
    }

    const whereClauses = [matchCond, 'COALESCE(le.is_reversed, 0) = 0'];
    const queryParams = [...matchParams];

    if (from_date) {
      whereClauses.push("le.date >= ?");
      queryParams.push(from_date);
    }
    if (to_date) {
      whereClauses.push("le.date <= ?");
      queryParams.push(to_date);
    }
    if (voucher_type && voucher_type !== 'ALL') {
      whereClauses.push("UPPER(le.voucher_type) = UPPER(?)");
      queryParams.push(voucher_type);
    }
    if (search) {
      whereClauses.push("(le.voucher_no LIKE ? OR le.particulars LIKE ? OR COALESCE(le.counterparty_summary, '') LIKE ?)");
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const txRes = await cDb.query(`
      SELECT le.*,
             le.particulars AS raw_particulars,
             v.narration AS voucher_narration,
             v.reference_no AS voucher_reference_no,
             v.source_module AS voucher_source_module,
             v.source_id AS voucher_source_id,
             v.is_reversed AS voucher_is_reversed,
             ve.remarks AS entry_remarks,
             p.id AS joined_purchase_id,
             p.inv_no AS purchase_inv_no,
             p.s_no AS purchase_s_no,
             p.vehicle_no AS purchase_vehicle_no,
             s.id AS joined_sales_id,
             s.s_no AS sales_s_no
      FROM ledger_entries le
      LEFT JOIN voucher v ON le.voucher_id = v.id
      LEFT JOIN voucher_entry ve ON ve.id = le.voucher_entry_id
      LEFT JOIN purchases p ON (
        (LOWER(COALESCE(le.reference_type, '')) = 'purchase' AND le.reference_id IS NOT NULL AND p.id = le.reference_id)
        OR (LOWER(COALESCE(v.source_module, '')) = 'purchase' AND v.source_id IS NOT NULL AND p.id = v.source_id)
      )
      LEFT JOIN sales s ON (
        (LOWER(COALESCE(le.reference_type, '')) = 'sales' AND le.reference_id IS NOT NULL AND s.id = le.reference_id)
        OR (LOWER(COALESCE(v.source_module, '')) = 'sales' AND v.source_id IS NOT NULL AND s.id = v.source_id)
      )
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY le.date ASC, le.id ASC
    `, queryParams);

    let runningVal = openingVal;
    let runningType = openingType;
    let periodDrTotal = 0;
    let periodCrTotal = 0;

    const rows = (txRes.rows || []).map((row, idx) => {
      const dr = Number(row.debit || 0);
      const cr = Number(row.credit || 0);
      periodDrTotal += dr;
      periodCrTotal += cr;

      if (runningType === 'Dr') {
        runningVal = runningVal + dr - cr;
      } else {
        runningVal = runningVal + cr - dr;
      }

      if (runningVal < 0) {
        runningVal = Math.abs(runningVal);
        runningType = runningType === 'Dr' ? 'Cr' : 'Dr';
      }

      const enriched = enrichStatementRow(row);

      return {
        s_no: idx + 1,
        id: row.id,
        date: row.date,
        voucher_no: row.voucher_no || row.reference_id || `VOC-${row.id}`,
        voucher_type: row.voucher_type || 'Journal',
        particulars: enriched.particulars,
        inv_no: enriched.inv_no,
        invoice_no: enriched.invoice_no,
        purchase_id: enriched.purchase_id,
        reference_id: enriched.purchase_id || row.reference_id || null,
        reference_type: row.reference_type || null,
        reference_no: enriched.reference_no,
        counterparty_summary: enriched.counterparty_summary,
        narration: enriched.narration,
        remarks: enriched.remarks,
        subtext: enriched.subtext,
        debit: dr,
        credit: cr,
        running_balance: Number(runningVal.toFixed(2)),
        running_balance_type: runningType,
        voucher_id: row.voucher_id || row.reference_id,
        is_reversed: Number(row.voucher_is_reversed || row.is_reversed || 0) === 1,
      };
    });

    res.json({
      success: true,
      data: {
        ledger: {
          id: lId,
          ledger_name: lName,
          group_name: targetLedger.group_name || targetLedger.under || 'General',
          gst_no: targetLedger.gst_no || '',
          contact_person: targetLedger.contact_person || ''
        },
        opening_balance: Number(openingVal.toFixed(2)),
        opening_balance_type: openingType,
        period_debit_total: Number(periodDrTotal.toFixed(2)),
        period_credit_total: Number(periodCrTotal.toFixed(2)),
        closing_balance: Number(runningVal.toFixed(2)),
        closing_balance_type: runningType,
        transactions: rows
      }
    });
  } catch (err) {
    console.error('Error in ledger-statement API:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 5. GROUP-WISE LEDGER STATEMENT
// -------------------------------------------------------------
router.get('/group-statement', async (req, res) => {
  try {
    const cId = resolveCompanyId(req);
    const summary = await AccountingEngine.getGroupSummaryAndTree(cId, {
      fromDate: req.query.from_date || null,
      toDate: req.query.to_date || null,
    });
    res.json({
      success: true,
      data: summary.groups,
      groups: summary.groups,
      totals: summary.totals,
    });
  } catch (err) {
    console.error('Error in group-statement API:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 6. DAY BOOK & TRIAL BALANCE
// -------------------------------------------------------------
router.get('/day-book', async (req, res) => {
  try {
    const cId = resolveCompanyId(req);
    const cDb = db.forCompany(cId);
    const { date, from_date, to_date } = req.query;
    const whereClauses = ['COALESCE(le.is_reversed, 0) = 0'];
    const queryParams = [];

    if (date) {
      whereClauses.push("le.date = ?");
      queryParams.push(date);
    } else if (from_date && to_date) {
      whereClauses.push("le.date >= ? AND le.date <= ?");
      queryParams.push(from_date, to_date);
    } else {
      whereClauses.push("le.date = CURRENT_DATE");
    }

    const query = `
      SELECT le.*, v.narration, v.reference_no
      FROM ledger_entries le
      LEFT JOIN voucher v ON le.voucher_id = v.id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY le.date DESC, le.id DESC
    `;

    const txs = await cDb.query(query, queryParams);
    res.json({ success: true, data: txs.rows || [] });
  } catch (err) {
    console.error('Error fetching Day Book:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/trial-balance', async (req, res) => {
  try {
    const cId = resolveCompanyId(req);
    const tb = await AccountingEngine.getTrialBalance(cId, {
      fromDate: req.query.from_date || null,
      toDate: req.query.to_date || null,
    });
    const rows = (tb.rows || []).map((r) => ({
      ...r,
      debit_amount: r.closing_debit,
      credit_amount: r.closing_credit,
    }));

    res.json({
      success: true,
      data: {
        rows,
        totals: tb.totals,
        grand_debit: tb.totals.closing_debit,
        grand_credit: tb.totals.closing_credit,
        is_balanced: tb.totals.is_balanced,
      }
    });
  } catch (err) {
    console.error('Error fetching Trial Balance:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 7. TALLY XML EXPORT & IMPORT
// -------------------------------------------------------------
router.get('/tally-export/xml', async (req, res) => {
  try {
    const cId = resolveCompanyId(req);
    const cDb = db.forCompany(cId);
    const groups = await cDb.query("SELECT * FROM ledger_groups");
    const ledgers = await cDb.query("SELECT * FROM ledgermaster");
    const vouchers = await cDb.query("SELECT * FROM voucher ORDER BY id DESC LIMIT 200");

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<ENVELOPE>\n  <HEADER>\n    <TALLYREQUEST>Import Data</TALLYREQUEST>\n  </HEADER>\n  <BODY>\n    <IMPORTDATA>\n      <REQUESTDESC>\n        <REPORTNAME>All Masters</REPORTNAME>\n      </REQUESTDESC>\n      <REQUESTDATA>\n';

    for (const g of (groups.rows || [])) {
      xml += '        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n';
      xml += '          <GROUP NAME="' + (g.group_name || '') + '" RESERVEDNAME="">\n';
      xml += '            <PARENT>' + (g.parent_group_name || '') + '</PARENT>\n';
      xml += '            <NATURE>' + (g.account_nature || 'Expense') + '</NATURE>\n';
      xml += '          </GROUP>\n';
      xml += '        </TALLYMESSAGE>\n';
    }

    for (const l of (ledgers.rows || [])) {
      xml += '        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n';
      xml += '          <LEDGER NAME="' + (l.ledger_name || l.name || '') + '" RESERVEDNAME="">\n';
      xml += '            <PARENT>' + (l.group_name || l.under || 'General') + '</PARENT>\n';
      xml += '            <OPENINGBALANCE>' + (l.opening_balance_type === 'Cr' ? '-' : '') + (l.opening_balance || 0) + '</OPENINGBALANCE>\n';
      xml += '          </LEDGER>\n';
      xml += '        </TALLYMESSAGE>\n';
    }

    for (const v of (vouchers.rows || [])) {
      const vDate = v.date ? String(v.date).replace(/-/g, '') : '';
      xml += '        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n';
      xml += '          <VOUCHER VCHTYPE="' + (v.voucher_type || '') + '" ACTION="Create">\n';
      xml += '            <DATE>' + vDate + '</DATE>\n';
      xml += '            <VOUCHERNUMBER>' + (v.voucher_no || '') + '</VOUCHERNUMBER>\n';
      xml += '            <NARRATION>' + (v.narration || '') + '</NARRATION>\n';
      xml += '          </VOUCHER>\n';
      xml += '        </TALLYMESSAGE>\n';
    }

    xml += '      </REQUESTDATA>\n    </IMPORTDATA>\n  </BODY>\n</ENVELOPE>';

    res.setHeader('Content-Type', 'text/xml');
    res.setHeader('Content-Disposition', 'attachment; filename=bvc_erp_tally_data.xml');
    res.send(xml);
  } catch (err) {
    console.error('Error generating Tally XML:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

