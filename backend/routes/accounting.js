const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { getNextVoucherNumber } = require('../utils/ledgerHelper');

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

initAccountingTables(1).catch(err => console.warn('[accounting] Initial startup migration notice:', err.message));

router.use(async (req, res, next) => {
  try {
    const cId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    await initAccountingTables(cId);
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
    // Total Debits & Credits from ledger_entries
    const totalsRes = await db.query(`
      SELECT 
        COALESCE(SUM(le.debit), 0) as total_debits,
        COALESCE(SUM(le.credit), 0) as total_credits
      FROM ledger_entries le
    `);

    // Cash Balance
    const cashRes = await db.query(`
      SELECT 
        COALESCE(SUM(le.debit) - SUM(le.credit), 0) as balance
      FROM ledger_entries le
      JOIN ledgermaster lm ON le.ledger_id = lm.id OR LOWER(TRIM(le.ledger_name)) = LOWER(TRIM(COALESCE(lm.ledger_name, lm.name, '')))
      WHERE COALESCE(lm.group_name, lm.under) = 'Cash-in-hand' OR le.ledger_name LIKE '%Cash%'
    `);

    // Bank Balance
    const bankRes = await db.query(`
      SELECT 
        COALESCE(SUM(le.debit) - SUM(le.credit), 0) as balance
      FROM ledger_entries le
      JOIN ledgermaster lm ON le.ledger_id = lm.id OR LOWER(TRIM(le.ledger_name)) = LOWER(TRIM(COALESCE(lm.ledger_name, lm.name, '')))
      WHERE COALESCE(lm.group_name, lm.under) = 'Bank Accounts' OR le.ledger_name LIKE '%Bank%'
    `);

    // Supplier Outstanding (Sundry Creditors)
    const supplierRes = await db.query(`
      SELECT 
        COALESCE(SUM(le.credit) - SUM(le.debit), 0) as outstanding
      FROM ledger_entries le
      JOIN ledgermaster lm ON le.ledger_id = lm.id OR LOWER(TRIM(le.ledger_name)) = LOWER(TRIM(COALESCE(lm.ledger_name, lm.name, '')))
      WHERE COALESCE(lm.group_name, lm.under) = 'Sundry Creditors' OR lm.linked_party_type = 'supplier'
    `);

    // Customer Outstanding (Sundry Debtors)
    const customerRes = await db.query(`
      SELECT 
        COALESCE(SUM(le.debit) - SUM(le.credit), 0) as outstanding
      FROM ledger_entries le
      JOIN ledgermaster lm ON le.ledger_id = lm.id OR LOWER(TRIM(le.ledger_name)) = LOWER(TRIM(COALESCE(lm.ledger_name, lm.name, '')))
      WHERE COALESCE(lm.group_name, lm.under) = 'Sundry Debtors' OR lm.linked_party_type = 'customer'
    `);

    // Purchases & Sales Totals
    const purchaseRes = await db.query(`
      SELECT COALESCE(SUM(le.debit), 0) as total FROM ledger_entries le WHERE LOWER(le.ledger_name) LIKE '%purchase%'
    `);
    const salesRes = await db.query(`
      SELECT COALESCE(SUM(le.credit), 0) as total FROM ledger_entries le WHERE LOWER(le.ledger_name) LIKE '%sales%'
    `);

    // Direct Expenses & Indirect Expenses
    const directExpRes = await db.query(`
      SELECT COALESCE(SUM(le.debit - le.credit), 0) as total
      FROM ledger_entries le
      LEFT JOIN ledgermaster lm ON le.ledger_id = lm.id OR LOWER(TRIM(le.ledger_name)) = LOWER(TRIM(COALESCE(lm.ledger_name, lm.name, '')))
      LEFT JOIN ledger_groups lg ON lm.group_id = lg.id
      WHERE lg.group_name = 'Direct Expenses' OR le.ledger_name IN ('Transport Charges', 'Loadman Charges')
    `);

    const indirectExpRes = await db.query(`
      SELECT COALESCE(SUM(le.debit - le.credit), 0) as total
      FROM ledger_entries le
      LEFT JOIN ledgermaster lm ON le.ledger_id = lm.id OR LOWER(TRIM(le.ledger_name)) = LOWER(TRIM(COALESCE(lm.ledger_name, lm.name, '')))
      LEFT JOIN ledger_groups lg ON lm.group_id = lg.id
      WHERE lg.group_name = 'Indirect Expenses'
    `);

    // Input GST & Output GST
    const inputGstRes = await db.query(`
      SELECT COALESCE(SUM(le.debit), 0) as total FROM ledger_entries le WHERE LOWER(le.ledger_name) LIKE 'input %'
    `);
    const outputGstRes = await db.query(`
      SELECT COALESCE(SUM(le.credit), 0) as total FROM ledger_entries le WHERE LOWER(le.ledger_name) LIKE 'output %'
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
    const result = await db.query(`
      SELECT lg.*
      FROM ledger_groups lg
      ORDER BY lg.account_nature ASC, lg.group_name ASC
    `);

    const ledgersRes = await db.query(`
      SELECT lm.*,
        COALESCE(lm.ledger_name, lm.name) AS ledger_name,
        COALESCE(lm.group_name, lm.under) AS group_name
      FROM ledgermaster lm
      ORDER BY COALESCE(lm.ledger_name, lm.name) ASC
    `);

    const allLedgers = ledgersRes.rows || [];

    // Aggregate all debit/credit transactions from ledger_entries (and fallback voucher_entry)
    const ledgerTotalsById = new Map();
    const ledgerTotalsByName = new Map();
    const seenEntryKeys = new Set();

    const leRes = await db.query(`
      SELECT ledger_id, ledger_name, voucher_no,
        COALESCE(debit, 0) AS debit,
        COALESCE(credit, 0) AS credit
      FROM ledger_entries
    `);

    const ledgerById = new Map();
    const ledgerByName = new Map();
    allLedgers.forEach((l) => {
      if (l.id !== undefined && l.id !== null) {
        ledgerById.set(Number(l.id), l);
      }
      const candidates = [l.ledger_name, l.name, l.printname, l.alias_name];
      candidates.forEach((c) => {
        const norm = String(c || '').trim().toLowerCase();
        if (norm && !ledgerByName.has(norm)) {
          ledgerByName.set(norm, l);
        }
      });
    });

    const addPosting = (row, allowDuplicateVoucherKey) => {
      const dr = Number(row.debit || 0);
      const cr = Number(row.credit || 0);
      if (dr === 0 && cr === 0) return;

      const normName = String(row.ledger_name || '').trim().toLowerCase();
      const vNo = String(row.voucher_no || '').trim().toLowerCase();
      const key = `${vNo}|${normName}|${dr.toFixed(2)}|${cr.toFixed(2)}`;
      if (!allowDuplicateVoucherKey && vNo && seenEntryKeys.has(key)) {
        return;
      }
      if (allowDuplicateVoucherKey && vNo) {
        seenEntryKeys.add(key);
      }

      const matchedByName = normName ? ledgerByName.get(normName) : null;
      const matchedById = !matchedByName && row.ledger_id ? ledgerById.get(Number(row.ledger_id)) : null;
      const matched = matchedByName || matchedById;

      if (matched) {
        const prev = ledgerTotalsById.get(matched.id) || { debit: 0, credit: 0 };
        prev.debit += dr;
        prev.credit += cr;
        ledgerTotalsById.set(matched.id, prev);
      } else if (normName) {
        const prev = ledgerTotalsByName.get(normName) || {
          displayName: String(row.ledger_name || '').trim(),
          debit: 0,
          credit: 0
        };
        prev.debit += dr;
        prev.credit += cr;
        ledgerTotalsByName.set(normName, prev);
      }
    };

    for (const row of leRes.rows || []) {
      addPosting(row, true);
    }

    try {
      const veRes = await db.query(`
        SELECT ve.ledger_id,
          COALESCE(NULLIF(TRIM(ve.ledger_name), ''), lm.ledger_name, lm.name, '') AS ledger_name,
          v.voucher_no,
          COALESCE(ve.debit, 0) AS debit,
          COALESCE(ve.credit, 0) AS credit
        FROM voucher_entry ve
        JOIN voucher v ON v.id = ve.voucher_id
        LEFT JOIN ledgermaster lm ON lm.id = ve.ledger_id
      `);
      for (const row of veRes.rows || []) {
        addPosting(row, false);
      }
    } catch (_) {
      // voucher_entry may not exist in older schemas
    }

    const formatLedgerItem = (l, resolvedGroupName) => {
      const totals = ledgerTotalsById.get(l.id) || { debit: 0, credit: 0 };
      const openBal = Number(l.opening_balance ?? l.openingbalance ?? 0);
      const openType = (l.opening_balance_type || l.opening_type || 'Dr').trim() === 'Cr' ? 'Cr' : 'Dr';
      const totalDebit = Number(totals.debit.toFixed(2));
      const totalCredit = Number(totals.credit.toFixed(2));

      let closing = openType === 'Dr' ? (openBal + totalDebit - totalCredit) : (openBal + totalCredit - totalDebit);
      let closingType = openType;
      if (closing < 0) {
        closing = Math.abs(closing);
        closingType = openType === 'Dr' ? 'Cr' : 'Dr';
      }

      return {
        id: l.id,
        name: l.ledger_name || l.name,
        ledger_name: l.ledger_name || l.name,
        code: l.ledger_code || l.alias_name || '',
        opening_balance: Number(openBal.toFixed(2)),
        opening_balance_type: openType,
        total_debit: totalDebit,
        total_credit: totalCredit,
        closing_balance: Number(closing.toFixed(2)),
        closing_balance_type: closingType,
        group_name: resolvedGroupName,
        status: l.status || 'Active'
      };
    };

    const assignedLedgerIds = new Set();

    const groups = (result.rows || []).map(g => {
      const normGName = String(g.group_name || '').toLowerCase().trim();
      const groupLedgers = allLedgers.filter(l => {
        if (assignedLedgerIds.has(l.id)) return false;
        if (l.group_id && Number(l.group_id) === Number(g.id)) {
          assignedLedgerIds.add(l.id);
          return true;
        }
        const normLGroup = String(l.group_name || l.under || '').toLowerCase().trim();
        if (normLGroup === normGName) {
          assignedLedgerIds.add(l.id);
          return true;
        }
        if (normGName.includes('purchase') && normLGroup.includes('purchase')) {
          assignedLedgerIds.add(l.id);
          return true;
        }
        if (normGName.includes('sales') && normLGroup.includes('sales')) {
          assignedLedgerIds.add(l.id);
          return true;
        }
        if (normGName.includes('cash') && normLGroup.includes('cash')) {
          assignedLedgerIds.add(l.id);
          return true;
        }
        if (normGName.includes('bank') && normLGroup.includes('bank')) {
          assignedLedgerIds.add(l.id);
          return true;
        }
        if (normGName.includes('duties') && (normLGroup.includes('tax') || normLGroup.includes('gst'))) {
          assignedLedgerIds.add(l.id);
          return true;
        }
        return false;
      }).map(l => formatLedgerItem(l, g.group_name));

      return {
        ...g,
        name: g.group_name,
        ledger_count: groupLedgers.length,
        ledgers: groupLedgers
      };
    });

    // Attach any unassigned ledgermaster records to fallback group
    const unassigned = allLedgers.filter(l => !assignedLedgerIds.has(l.id));
    if (unassigned.length > 0) {
      const generalGroup = groups.find(g => g.group_name === 'Direct Expenses' || g.group_name === 'Current Liabilities');
      if (generalGroup) {
        unassigned.forEach(l => {
          generalGroup.ledgers.push(formatLedgerItem(l, generalGroup.group_name));
        });
        generalGroup.ledger_count = generalGroup.ledgers.length;
      }
    }

    // Attach any active ledger_entries heads missing from ledgermaster to best-matching group
    if (ledgerTotalsByName.size > 0) {
      for (const [normName, info] of ledgerTotalsByName.entries()) {
        let targetGroupName = 'Direct Expenses';
        if (normName.includes('purchase')) targetGroupName = 'Purchase Accounts';
        else if (normName.includes('sales')) targetGroupName = 'Sales Accounts';
        else if (normName.includes('cgst') || normName.includes('sgst') || normName.includes('igst') || normName.includes('gst')) targetGroupName = 'Duties & Taxes';
        else if (normName.includes('cash')) targetGroupName = 'Cash-in-hand';
        else if (normName.includes('bank')) targetGroupName = 'Bank Accounts';

        const targetGroup = groups.find(g => g.group_name === targetGroupName) || groups[0];
        if (targetGroup) {
          const totalDebit = Number(info.debit.toFixed(2));
          const totalCredit = Number(info.credit.toFixed(2));
          const diff = totalDebit - totalCredit;
          targetGroup.ledgers.push({
            id: null,
            name: info.displayName,
            ledger_name: info.displayName,
            code: '',
            opening_balance: 0,
            opening_balance_type: 'Dr',
            total_debit: totalDebit,
            total_credit: totalCredit,
            closing_balance: Number(Math.abs(diff).toFixed(2)),
            closing_balance_type: diff >= 0 ? 'Dr' : 'Cr',
            group_name: targetGroup.group_name,
            status: 'Active'
          });
          targetGroup.ledger_count = targetGroup.ledgers.length;
        }
      }
    }

    // Roll up accurate group_debit, group_credit, and net closing_balance from all member ledgers
    const finalGroups = groups.map(g => {
      const groupDebit = g.ledgers.reduce((sum, l) => sum + Number(l.total_debit || 0), 0);
      const groupCredit = g.ledgers.reduce((sum, l) => sum + Number(l.total_credit || 0), 0);
      const netSigned = g.ledgers.reduce((sum, l) => {
        const bal = Number(l.closing_balance || 0);
        return sum + (l.closing_balance_type === 'Cr' ? -bal : bal);
      }, 0);

      return {
        ...g,
        group_debit: Number(groupDebit.toFixed(2)),
        group_credit: Number(groupCredit.toFixed(2)),
        closing_balance: Number(Math.abs(netSigned).toFixed(2)),
        closing_balance_type: netSigned >= 0 ? 'Dr' : 'Cr'
      };
    });

    res.json({ success: true, data: finalGroups });
  } catch (err) {
    console.error('Error fetching ledger groups:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/groups', async (req, res) => {
  try {
    const { group_name, parent_group_id, account_nature, financial_statement, normal_balance, description } = req.body;
    if (!group_name) return res.status(400).json({ success: false, message: 'Group name is required' });

    let parentName = null;
    if (parent_group_id) {
      const pRes = await db.query("SELECT group_name FROM ledger_groups WHERE id = ?", [parent_group_id]);
      if (pRes.rows[0]) parentName = pRes.rows[0].group_name;
    }

    const ins = await db.run(`
      INSERT INTO ledger_groups (group_name, parent_group_id, parent_group_name, account_nature, financial_statement, normal_balance, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [group_name.trim(), parent_group_id || null, parentName, account_nature || 'Expense', financial_statement || 'Profit & Loss', normal_balance || 'Dr', description || '']);

    res.json({ success: true, message: 'Ledger group created successfully', id: ins.lastID });
  } catch (err) {
    console.error('Error creating ledger group:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put('/groups/:id', async (req, res) => {
  try {
    const { group_name, parent_group_id, account_nature, financial_statement, normal_balance, description, status } = req.body;
    const { id } = req.params;

    let parentName = null;
    if (parent_group_id) {
      const pRes = await db.query("SELECT group_name FROM ledger_groups WHERE id = ?", [parent_group_id]);
      if (pRes.rows[0]) parentName = pRes.rows[0].group_name;
    }

    await db.run(`
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
    const { id } = req.params;
    const checkLedgers = await db.query("SELECT id FROM ledgermaster WHERE group_id = ? LIMIT 1", [id]);
    if (checkLedgers.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete group that contains active ledgers.' });
    }

    await db.run("DELETE FROM ledger_groups WHERE id = ?", [id]);
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
    const result = await db.query(`
      SELECT lm.*,
        COALESCE(lm.ledger_name, lm.name) AS ledger_name,
        COALESCE(lm.group_name, lm.under) AS group_name,
        lg.account_nature,
        lg.financial_statement,
        COALESCE((SELECT SUM(debit) FROM ledger_entries le WHERE le.ledger_id = lm.id OR LOWER(TRIM(le.ledger_name)) = LOWER(TRIM(COALESCE(lm.ledger_name, lm.name)))), 0) as total_debit,
        COALESCE((SELECT SUM(credit) FROM ledger_entries le WHERE le.ledger_id = lm.id OR LOWER(TRIM(le.ledger_name)) = LOWER(TRIM(COALESCE(lm.ledger_name, lm.name)))), 0) as total_credit
      FROM ledgermaster lm
      LEFT JOIN ledger_groups lg ON lm.group_id = lg.id OR LOWER(TRIM(COALESCE(lm.group_name, lm.under))) = LOWER(TRIM(lg.group_name))
      ORDER BY COALESCE(lm.ledger_name, lm.name) ASC
    `);

    const rows = (result.rows || []).map(r => {
      const openBal = Number(r.opening_balance || 0);
      const openType = r.opening_balance_type || 'Dr';
      const totDr = Number(r.total_debit || 0);
      const totCr = Number(r.total_credit || 0);

      // Compute closing balance
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
    const { ledger_name, ledger_code, group_id, group_name, opening_balance, opening_balance_type, opening_date, linked_party_type, linked_party_id, gst_no, contact_person, phone, email, credit_period } = req.body;
    if (!ledger_name) return res.status(400).json({ success: false, message: 'Ledger name is required' });

    let finalGroupName = group_name;
    if (group_id && !finalGroupName) {
      const gRes = await db.query("SELECT group_name FROM ledger_groups WHERE id = ?", [group_id]);
      if (gRes.rows[0]) finalGroupName = gRes.rows[0].group_name;
    }

    const ins = await db.run(`
      INSERT INTO ledgermaster (ledger_name, ledger_code, group_id, group_name, opening_balance, opening_balance_type, opening_date, linked_party_type, linked_party_id, gst_no, contact_person, phone, email, credit_period)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      ledger_name.trim(),
      ledger_code || ledger_name.toUpperCase().replace(/\s+/g, '_'),
      group_id || null,
      finalGroupName || 'General',
      parseFloat(opening_balance || 0),
      opening_balance_type || 'Dr',
      opening_date || new Date().toISOString().slice(0, 10),
      linked_party_type || null,
      linked_party_id || null,
      gst_no || '',
      contact_person || '',
      phone || '',
      email || '',
      parseInt(credit_period || 30, 10)
    ]);

    res.json({ success: true, message: 'Ledger created successfully', id: ins.lastID });
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
    const { ledger_id, ledger_name, from_date, to_date, voucher_type, search } = req.query;

    let targetLedger = null;
    if (ledger_id) {
      const lRes = await db.query("SELECT * FROM ledgermaster WHERE id = ? OR CAST(id AS TEXT) = ? LIMIT 1", [ledger_id, ledger_id]);
      targetLedger = lRes.rows[0];
    }
    if (!targetLedger && ledger_name) {
      const lRes = await db.query("SELECT * FROM ledgermaster WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) OR LOWER(TRIM(printname)) = LOWER(TRIM(?)) LIMIT 1", [ledger_name, ledger_name]);
      targetLedger = lRes.rows[0];
    }

    // Fallback if ledger doesn't exist in ledgermaster
    if (!targetLedger) {
      const name = ledger_name || `Ledger #${ledger_id}`;
      targetLedger = {
        id: ledger_id || 0,
        name: name,
        ledger_name: name,
        group_name: name.toLowerCase().includes('supplier') || name.toLowerCase().includes('traders') ? 'Sundry Creditors' : 'General',
        opening_balance: 0,
        opening_balance_type: 'Dr'
      };
    }

    const lName = targetLedger.name || targetLedger.ledger_name;
    const lId = targetLedger.id;

    // Ensure all Purchase Transporter and Loadman entries are reconciled
    try {
      const vouchersRoute = require('./vouchers');
      if (vouchersRoute && vouchersRoute.reconcilePurchaseTransporterAndLoadmanEntries) {
        await vouchersRoute.reconcilePurchaseTransporterAndLoadmanEntries();
      }
    } catch (_) {}

    // Opening Balance calculation before from_date
    let openingVal = Number(targetLedger.opening_balance || 0);
    let openingType = targetLedger.opening_balance_type || 'Dr';

    if (from_date) {
      const preTxRes = await db.query(`
        SELECT COALESCE(SUM(debit), 0) as pre_dr, COALESCE(SUM(credit), 0) as pre_cr
        FROM ledger_entries
        WHERE (ledger_id = ? OR LOWER(TRIM(ledger_name)) = LOWER(TRIM(?)))
        AND date < ?
      `, [lId, lName, from_date]);

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

    // Query period transactions
    let whereClauses = ["(le.ledger_id = ? OR LOWER(TRIM(le.ledger_name)) = LOWER(TRIM(?)))"];
    let queryParams = [lId, lName];

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
      whereClauses.push("(le.voucher_no LIKE ? OR le.particulars LIKE ?)");
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    const txRes = await db.query(`
      SELECT le.*, v.narration, v.reference_no
      FROM ledger_entries le
      LEFT JOIN voucher v ON le.voucher_id = v.id OR le.voucher_no = v.voucher_no
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY le.date ASC, le.id ASC
    `, queryParams);

    // Compute running balance chronologically
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

      return {
        s_no: idx + 1,
        id: row.id,
        date: row.date,
        voucher_no: row.voucher_no || row.reference_id || `VOC-${row.id}`,
        voucher_type: row.voucher_type || 'Journal',
        particulars: row.particulars || row.ledger_name || 'Voucher Posting',
        narration: row.narration || row.remarks || '',
        debit: dr,
        credit: cr,
        running_balance: Number(runningVal.toFixed(2)),
        running_balance_type: runningType,
        voucher_id: row.voucher_id || row.reference_id
      };
    });

    res.json({
      success: true,
      data: {
        ledger: {
          id: lId,
          ledger_name: lName,
          group_name: targetLedger.group_name || 'General',
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
    const groupsRes = await db.query(`
      SELECT lg.*,
        (SELECT COUNT(*) FROM ledgermaster lm WHERE lm.group_id = lg.id OR LOWER(TRIM(COALESCE(lm.group_name, lm.under))) = LOWER(TRIM(lg.group_name))) as total_ledgers
      FROM ledger_groups lg
      ORDER BY lg.account_nature ASC, lg.group_name ASC
    `);

    const ledgersRes = await db.query(`
      SELECT lm.*,
        COALESCE(lm.ledger_name, lm.name) AS ledger_name,
        COALESCE(lm.group_name, lm.under) AS group_name,
        COALESCE((SELECT SUM(debit) FROM ledger_entries le WHERE le.ledger_id = lm.id OR LOWER(TRIM(le.ledger_name)) = LOWER(TRIM(COALESCE(lm.ledger_name, lm.name)))), 0) as debit_total,
        COALESCE((SELECT SUM(credit) FROM ledger_entries le WHERE le.ledger_id = lm.id OR LOWER(TRIM(le.ledger_name)) = LOWER(TRIM(COALESCE(lm.ledger_name, lm.name)))), 0) as credit_total
      FROM ledgermaster lm
      ORDER BY COALESCE(lm.ledger_name, lm.name) ASC
    `);

    const ledgersByGroup = {};
    for (const l of ledgersRes.rows || []) {
      const gKey = l.group_name || l.under || 'General';
      if (!ledgersByGroup[gKey]) ledgersByGroup[gKey] = [];

      const openVal = Number(l.opening_balance || 0);
      const openType = l.opening_balance_type || 'Dr';
      const dr = Number(l.debit_total || 0);
      const cr = Number(l.credit_total || 0);

      let closing = openType === 'Dr' ? (openVal + dr - cr) : (openVal + cr - dr);
      let closingType = openType;
      if (closing < 0) {
        closing = Math.abs(closing);
        closingType = openType === 'Dr' ? 'Cr' : 'Dr';
      }

      ledgersByGroup[gKey].push({
        ...l,
        closing_balance: Number(closing.toFixed(2)),
        closing_balance_type: closingType
      });
    }

    const resultTree = (groupsRes.rows || []).map(g => {
      const itemizedLedgers = ledgersByGroup[g.group_name] || [];
      const groupClosing = itemizedLedgers.reduce((sum, item) => {
        return sum + (item.closing_balance_type === 'Dr' ? item.closing_balance : -item.closing_balance);
      }, 0);

      return {
        ...g,
        closing_balance: Math.abs(Number(groupClosing.toFixed(2))),
        closing_balance_type: groupClosing >= 0 ? 'Dr' : 'Cr',
        ledgers: itemizedLedgers
      };
    });

    res.json({ success: true, data: resultTree });
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
    const { date, from_date, to_date } = req.query;
    let whereClauses = [];
    let queryParams = [];

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
      SELECT le.*, v.narration
      FROM ledger_entries le
      LEFT JOIN voucher v ON le.voucher_id = v.id OR le.voucher_no = v.voucher_no
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY le.date DESC, le.id DESC
    `;

    const txs = await db.query(query, queryParams);
    res.json({ success: true, data: txs.rows || [] });
  } catch (err) {
    console.error('Error fetching Day Book:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/trial-balance', async (req, res) => {
  try {
    const ledgersRes = await db.query(`
      SELECT lm.id, COALESCE(lm.ledger_name, lm.name) AS ledger_name, COALESCE(lm.group_name, lm.under) AS group_name, lm.opening_balance, lm.opening_balance_type,
        lg.account_nature, lg.financial_statement,
        COALESCE((SELECT SUM(debit) FROM ledger_entries le WHERE le.ledger_id = lm.id OR LOWER(TRIM(le.ledger_name)) = LOWER(TRIM(COALESCE(lm.ledger_name, lm.name)))), 0) as total_debit,
        COALESCE((SELECT SUM(credit) FROM ledger_entries le WHERE le.ledger_id = lm.id OR LOWER(TRIM(le.ledger_name)) = LOWER(TRIM(COALESCE(lm.ledger_name, lm.name)))), 0) as total_credit
      FROM ledgermaster lm
      LEFT JOIN ledger_groups lg ON lm.group_id = lg.id OR LOWER(TRIM(COALESCE(lm.group_name, lm.under))) = LOWER(TRIM(lg.group_name))
      ORDER BY COALESCE(lm.group_name, lm.under) ASC, COALESCE(lm.ledger_name, lm.name) ASC
    `);

    let grandDr = 0;
    let grandCr = 0;

    const rows = (ledgersRes.rows || []).map(l => {
      const openVal = Number(l.opening_balance || 0);
      const openType = l.opening_balance_type || 'Dr';
      const dr = Number(l.total_debit || 0);
      const cr = Number(l.total_credit || 0);

      let closing = openType === 'Dr' ? (openVal + dr - cr) : (openVal + cr - dr);
      let closingType = openType;
      if (closing < 0) {
        closing = Math.abs(closing);
        closingType = openType === 'Dr' ? 'Cr' : 'Dr';
      }

      let drAmount = 0;
      let crAmount = 0;

      if (closingType === 'Dr') {
        drAmount = closing;
        grandDr += closing;
      } else {
        crAmount = closing;
        grandCr += closing;
      }

      return {
        ...l,
        debit_amount: Number(drAmount.toFixed(2)),
        credit_amount: Number(crAmount.toFixed(2))
      };
    });

    res.json({
      success: true,
      data: {
        rows,
        grand_debit: Number(grandDr.toFixed(2)),
        grand_credit: Number(grandCr.toFixed(2)),
        is_balanced: Math.abs(grandDr - grandCr) < 0.01
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
    const groups = await db.query("SELECT * FROM ledger_groups");
    const ledgers = await db.query("SELECT * FROM ledgermaster");
    const vouchers = await db.query("SELECT * FROM voucher ORDER BY id DESC LIMIT 200");

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<ENVELOPE>\n  <HEADER>\n    <TALLYREQUEST>Import Data</TALLYREQUEST>\n  </HEADER>\n  <BODY>\n    <IMPORTDATA>\n      <REQUESTDESC>\n        <REPORTNAME>All Masters</REPORTNAME>\n      </REQUESTDESC>\n      <REQUESTDATA>\n`;

    // Ledger Groups XML
    for (const g of groups.rows || []) {
      xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n          <GROUP NAME="${g.group_name}" RESERVEDNAME="">\n            <PARENT>${g.parent_group_name || ''}</PARENT>\n            <NATURE>${g.account_nature || 'Expense'}</NATURE>\n          </GROUP>\n        </TALLYMESSAGE>\n`;
    }

    // Ledgers XML
    for (const l of ledgers.rows || []) {
      xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n          <LEDGER NAME="${l.ledger_name}" RESERVEDNAME="">\n            <PARENT>${l.group_name || 'General'}</PARENT>\n            <OPENINGBALANCE>${l.opening_balance_type === 'Cr' ? '-' : ''}${l.opening_balance || 0}</OPENINGBALANCE>\n          </LEDGER>\n        </TALLYMESSAGE>\n`;
    }

    // Vouchers XML
    for (const v of vouchers.rows || []) {
      xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n          <VOUCHER VCHTYPE="${v.voucher_type}" ACTION="Create">\n            <DATE>${v.date ? v.date.replace(/-/g, '') : ''}</DATE>\n            <VOUCHERNUMBER>${v.voucher_no}</VOUCHERNUMBER>\n            <NARRATION>${v.narration || ''}</NARRATION>\n          </VOUCHER>\n        </TALLYMESSAGE>\n`;
    }

    xml += `      </REQUESTDATA>\n    </IMPORTDATA>\n  </BODY>\n</ENVELOPE>`;

    res.setHeader('Content-Type', 'text/xml');
    res.setHeader('Content-Disposition', 'attachment; filename=bvc_erp_tally_data.xml');
    res.send(xml);
  } catch (err) {
    console.error('Error generating Tally XML:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
