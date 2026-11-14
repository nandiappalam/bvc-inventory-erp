const express = require('express');
const db = require('../config/database');
const recycleBinService = require('../services/RecycleBinService');

const router = express.Router();

// Prefix map for auto voucher number (common format)
const PREFIX_MAP = {
  'Payment': 'VOC',
  'Receipt': 'VOC',
  'Contra': 'VOC',
  'Journal': 'VOC'
};

// Validate voucher data
const validateVoucherData = (data) => {
  const { voucher_type, date, entries, reference_no, narration } = data;

  if (!voucher_type || !['Payment', 'Receipt', 'Contra', 'Journal'].includes(voucher_type)) {
    throw new Error('Invalid voucher_type. Must be Payment, Receipt, Contra, or Journal');
  }
  if (!date) throw new Error('Date is required');
  if (!entries || !Array.isArray(entries) || entries.length < 2) {
    throw new Error('At least 2 entries required');
  }

  let totalDebit = 0, totalCredit = 0;
  for (const entry of entries) {
    if (!entry.ledger_id || entry.ledger_id <= 0) throw new Error('ledger_id required for all entries');
    const debit = Number(entry.debit) || 0;
    const credit = Number(entry.credit) || 0;
    if (debit < 0 || credit < 0) throw new Error('Debit and Credit cannot be negative');
    if (debit > 0 && credit > 0) throw new Error('Only one of debit or credit allowed per entry');
    if (debit === 0 && credit === 0) throw new Error('Entry must have either debit or credit');
    totalDebit += debit;
    totalCredit += credit;
    if (entry.remarks && entry.remarks.length > 500) throw new Error('Remarks too long');
  }

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Totals do not balance: Debit ${totalDebit.toFixed(2)} != Credit ${totalCredit.toFixed(2)}`);
  }

  return true;
};

// Generate auto voucher number (robust, prefix-scoped & collision-free)
async function generateVoucherNo(voucher_type) {
  try {
    const prefix = PREFIX_MAP[voucher_type] || 'VOC';
    const existingRes = await db.query(
      'SELECT voucher_no FROM voucher WHERE voucher_no LIKE ? ORDER BY id DESC',
      [`${prefix}%`]
    );
    let maxNum = 0;
    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exactRegex = new RegExp(`^${escapedPrefix}-?(\\d+)$`, 'i');
    for (const row of existingRes.rows || []) {
      const vNo = String(row.voucher_no || '').trim();
      const match = vNo.match(exactRegex);
      if (match) {
        const parsed = parseInt(match[1], 10);
        if (!Number.isNaN(parsed) && parsed > maxNum) {
          maxNum = parsed;
        }
      }
    }
    let nextNum = maxNum + 1;
    while (true) {
      const candidate = `${prefix}${String(nextNum).padStart(3, '0')}`;
      const check = await db.query('SELECT id FROM voucher WHERE voucher_no = ? LIMIT 1', [candidate]);
      if (!check.rows || check.rows.length === 0) {
        return candidate;
      }
      nextNum++;
    }
  } catch (err) {
    console.error('generateVoucherNo ERROR:', err);
    return `${PREFIX_MAP[voucher_type] || 'VOC'}${Date.now().toString().slice(-5)}`;
  }
};

// Ensure tables exist (called on load)
async function initTables() {
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS voucher (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        voucher_type TEXT NOT NULL,
        voucher_no TEXT UNIQUE NOT NULL,
        date DATE NOT NULL,
        reference_no TEXT,
        narration TEXT,
        status TEXT DEFAULT 'Approved',
        posted INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ voucher table ready');
  } catch (err) {
    console.error('voucher table error:', err);
  }

  // Ensure columns exist on older tables
  try {
    await db.run("ALTER TABLE voucher ADD COLUMN status TEXT DEFAULT 'Approved'");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE voucher ADD COLUMN posted INTEGER DEFAULT 1");
  } catch (e) {}

  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS voucher_entry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        voucher_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        ledger_id INTEGER NOT NULL,
        debit REAL DEFAULT 0,
        credit REAL DEFAULT 0,
        remarks TEXT,
        FOREIGN KEY (voucher_id) REFERENCES voucher(id) ON DELETE CASCADE,
        FOREIGN KEY (ledger_id) REFERENCES ledgermaster(id)
      )
    `);
    console.log('✓ voucher_entry table ready');
  } catch (err) {
    console.error('voucher_entry table error:', err);
  }

  // Ensure tables exist safely without startup data mutations
}

async function healAllTransactions() {
  console.log('Running safe transaction sync...');
  const { createPurchaseVoucherChain, createSalesLedgerEntries, createAdvanceLedgerEntries } = require('../utils/ledgerHelper');
  
  try {
    // 1. Heal Purchases (Only if no voucher already exists with this reference)
    const purchases = await db.query('SELECT * FROM purchases', []);
    for (const p of purchases.rows || []) {
      const vResult = await db.query(
        "SELECT id FROM voucher WHERE reference_no = ? LIMIT 1",
        [String(p.id)]
      );
      if (!vResult.rows || vResult.rows.length === 0) {
        console.log(`Syncing missing Purchase ID ${p.id} to voucher/ledger...`);
        await createPurchaseVoucherChain({
          supplier: p.supplier,
          date: p.date,
          invNo: p.inv_no || p.s_no,
          purchaseId: p.id,
          baseAmount: p.base_amount || p.total_amount || p.grand_total,
          taxAmount: p.tax_amount || 0,
          discAmount: p.disc_amount || 0,
          netAmount: p.grand_total || p.net_amount || p.total_amount,
          narration: p.remarks || `Purchase Invoice #${p.inv_no || p.s_no}`
        });
      }
    }

    // 2. Heal Sales (Only if no voucher already exists with this reference)
    const sales = await db.query('SELECT * FROM sales', []);
    for (const s of sales.rows || []) {
      const vResult = await db.query(
        "SELECT id FROM voucher WHERE reference_no = ? LIMIT 1",
        [String(s.id)]
      );
      if (!vResult.rows || vResult.rows.length === 0) {
        console.log(`Syncing missing Sales ID ${s.id} to voucher/ledger...`);
        await createSalesLedgerEntries({
          customer: s.customer,
          date: s.date,
          invNo: s.s_no,
          salesId: s.id,
          totalAmount: s.grand_total || s.total_amt,
          taxAmount: s.tax_amt || 0,
          discAmount: 0,
          baseAmount: s.base_amt || s.total_amt
        });
      }
    }

    // 3. Heal Advances
    const advances = await db.query('SELECT * FROM advances', []);
    for (const a of advances.rows || []) {
      const leResult = await db.query(
        "SELECT id FROM ledger_entries WHERE reference_id = ? AND reference_type = 'advance' LIMIT 1",
        [a.id]
      );
      if (!leResult.rows || leResult.rows.length === 0) {
        console.log(`Syncing missing Advance ID ${a.id} to ledger...`);
        await createAdvanceLedgerEntries({
          papadCompany: a.papad_company,
          date: a.date,
          sNo: a.s_no,
          advanceId: a.id,
          amount: a.amount
        });
      }
    }

    // 4. Auto-correct any existing misallocated Customer/Supplier ledger entries (surgical line update only)
    const { resolveLedgerId } = require('../utils/ledgerHelper');
    const incorrectSalesEntries = await db.query(`
      SELECT le.id, le.ledger_name, le.voucher_id
      FROM ledger_entries le
      JOIN ledgermaster lm ON le.ledger_id = lm.id
      WHERE le.voucher_type = 'Sales' AND lm.ledger_type = 'Supplier'
    `, []);
    for (const entry of incorrectSalesEntries.rows || []) {
      const correctId = await resolveLedgerId(entry.ledger_name, 'Customer');
      if (correctId) {
        await db.run("UPDATE ledger_entries SET ledger_id = ? WHERE id = ?", [correctId, entry.id]);
        if (entry.voucher_id) {
          await db.run("UPDATE voucher_entry SET ledger_id = ?, ledger_name = ? WHERE voucher_id = ? AND (LOWER(TRIM(ledger_name)) = LOWER(TRIM(?)) OR ledger_id = ?)", [correctId, entry.ledger_name, entry.voucher_id, entry.ledger_name, entry.ledger_id]);
        }
        console.log(`✓ Corrected Sales entry id ${entry.id} "${entry.ledger_name}" to customer ledger id ${correctId}`);
      }
    }

    const incorrectPurchaseEntries = await db.query(`
      SELECT le.id, le.ledger_name, le.voucher_id
      FROM ledger_entries le
      JOIN ledgermaster lm ON le.ledger_id = lm.id
      WHERE le.voucher_type = 'Purchase' AND lm.ledger_type = 'Customer'
    `, []);
    for (const entry of incorrectPurchaseEntries.rows || []) {
      const correctId = await resolveLedgerId(entry.ledger_name, 'Supplier');
      if (correctId) {
        await db.run("UPDATE ledger_entries SET ledger_id = ? WHERE id = ?", [correctId, entry.id]);
        if (entry.voucher_id) {
          await db.run("UPDATE voucher_entry SET ledger_id = ?, ledger_name = ? WHERE voucher_id = ? AND (LOWER(TRIM(ledger_name)) = LOWER(TRIM(?)) OR ledger_id = ?)", [correctId, entry.ledger_name, entry.voucher_id, entry.ledger_name, entry.ledger_id]);
        }
        console.log(`✓ Corrected Purchase entry id ${entry.id} "${entry.ledger_name}" to supplier ledger id ${correctId}`);
      }
    }

    // 4. Ensure any vouchers in voucher_entry are present in ledger_entries
    try {
      const missingInLedger = await db.query(`
        SELECT v.id as v_id, v.voucher_no, v.voucher_type, v.date, ve.ledger_id, ve.ledger_name, ve.debit, ve.credit, ve.remarks
        FROM voucher_entry ve
        JOIN voucher v ON v.id = ve.voucher_id
        WHERE v.voucher_no NOT IN (SELECT DISTINCT voucher_no FROM ledger_entries WHERE voucher_no IS NOT NULL)
      `);
      for (const row of missingInLedger.rows || []) {
        await db.run(`
          INSERT INTO ledger_entries (ledger_id, ledger_name, date, voucher_type, voucher_no, debit, credit, particulars, voucher_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [row.ledger_id, row.ledger_name, row.date, row.voucher_type, row.voucher_no, row.debit || 0, row.credit || 0, row.remarks || '', row.v_id]);
      }
    } catch (e) {
      console.warn('Error syncing voucher_entry to ledger_entries:', e.message);
    }

    await healPurchaseAndSalesVouchers();
    await reconcilePurchaseTransporterAndLoadmanEntries();
    await reconcileUnbalancedVouchers();
    console.log('✓ healAllTransactions completed successfully');
  } catch (error) {
    console.error('Error during healAllTransactions:', error);
  }
}

// Reconcile and auto-post missing Credit entries for Transporters & Loadmen from Purchase transactions
async function reconcilePurchaseTransporterAndLoadmanEntries() {
  try {
    const { resolveLedgerId } = require('../services/LedgerService');
    const purchasesRes = await db.query(`
      SELECT 
        p.id,
        p.s_no,
        p.inv_no,
        p.voucher_no,
        COALESCE(p.inv_no, p.voucher_no, CAST(p.s_no AS TEXT), CAST(p.id AS TEXT)) as invoice_no,
        p.date,
        p.transporter,
        COALESCE(p.transport_charges, p.freight_amount, p.net_transport_amount, 0) as transport_charges,
        COALESCE(p.transport_payable_type, 'SEPARATE') as transport_payable_type,
        p.loadman_name,
        COALESCE(p.loadman_charges, 0) as loadman_charges,
        COALESCE(p.loadman_payable_type, 'SEPARATE') as loadman_payable_type
      FROM purchases p
      WHERE (COALESCE(p.transport_charges, p.freight_amount, p.net_transport_amount, 0) > 0 AND p.transporter IS NOT NULL AND p.transporter != '')
         OR (COALESCE(p.loadman_charges, 0) > 0 AND p.loadman_name IS NOT NULL AND p.loadman_name != '')
    `);

    for (const p of (purchasesRes.rows || [])) {
      const pId = p.id;
      const invNo = p.invoice_no;
      const dateVal = p.date || new Date().toISOString().slice(0, 10);
      
      let vNo = p.voucher_no;
      let vId = null;
      if (!vNo) {
        const vRes = await db.query(`SELECT id, voucher_no FROM voucher WHERE reference_no = ? OR narration LIKE ? LIMIT 1`, [String(pId), `%${invNo}%`]);
        if (vRes.rows && vRes.rows[0]) {
          vId = vRes.rows[0].id;
          vNo = vRes.rows[0].voucher_no;
        } else {
          vNo = `PUR${String(p.s_no || pId).padStart(5, '0')}`;
        }
      }

      // 1. Transporter Freight Credit Entry
      const transName = (p.transporter || '').trim();
      const transAmt = parseFloat(p.transport_charges || 0);
      const transPayType = String(p.transport_payable_type).toUpperCase();

      if (transAmt > 0 && transPayType !== 'SUPPLIER_INVOICE' && transName) {
        const check = await db.query(`
          SELECT id FROM ledger_entries 
          WHERE (ledger_id IN (SELECT id FROM ledgermaster WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))) OR LOWER(TRIM(ledger_name)) = LOWER(TRIM(?)))
            AND credit > 0
            AND (reference_id = ? OR particulars LIKE ? OR voucher_no = ?)
          LIMIT 1
        `, [transName, transName, pId, `%${invNo}%`, vNo]);

        if (!check.rows || check.rows.length === 0) {
          const transLedgerId = await resolveLedgerId(transName, 'Transporter');
          const expLedgerId = await resolveLedgerId('Transport Charges', 'Expense');

          const transParticulars = `Transport charges payable for Purchase Invoice #${invNo}`;
          const expParticulars = `Transport charges for Purchase Invoice #${invNo}`;

          await db.run(`
            INSERT INTO ledger_entries (
              ledger_id, ledger_name, date, voucher_type, voucher_no, debit, credit,
              reference_id, reference_type, particulars, voucher_id, transaction_id, transaction_type
            ) VALUES (?, ?, ?, 'Purchase', ?, 0, ?, ?, 'purchase', ?, ?, ?, 'purchase')
          `, [transLedgerId, transName, dateVal, vNo, transAmt, pId, transParticulars, vId, pId]);

          await db.run(`
            INSERT INTO ledger_entries (
              ledger_id, ledger_name, date, voucher_type, voucher_no, debit, credit,
              reference_id, reference_type, particulars, voucher_id, transaction_id, transaction_type
            ) VALUES (?, ?, ?, 'Purchase', ?, ?, 0, ?, 'purchase', ?, ?, ?, 'purchase')
          `, [expLedgerId, 'Transport Charges', dateVal, vNo, transAmt, pId, expParticulars, vId, pId]);

          if (vId) {
            await db.run(`INSERT INTO voucher_entry (voucher_id, type, ledger_id, ledger_name, debit, credit, remarks) VALUES (?, 'Ledger', ?, ?, 0, ?, ?)`, [vId, transLedgerId, transName, transAmt, transParticulars]);
            await db.run(`INSERT INTO voucher_entry (voucher_id, type, ledger_id, ledger_name, debit, credit, remarks) VALUES (?, 'Ledger', ?, 'Transport Charges', ?, 0, ?)`, [vId, expLedgerId, transAmt, expParticulars]);
          }
        }
      }

      // 2. Loadman Unloading Credit Entry
      const loadName = (p.loadman_name || '').trim();
      const loadAmt = parseFloat(p.loadman_charges || 0);
      const loadPayType = String(p.loadman_payable_type).toUpperCase();

      if (loadAmt > 0 && loadPayType !== 'SUPPLIER_INVOICE' && loadName) {
        const check = await db.query(`
          SELECT id FROM ledger_entries 
          WHERE (ledger_id IN (SELECT id FROM ledgermaster WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))) OR LOWER(TRIM(ledger_name)) = LOWER(TRIM(?)))
            AND credit > 0
            AND (reference_id = ? OR particulars LIKE ? OR voucher_no = ?)
          LIMIT 1
        `, [loadName, loadName, pId, `%${invNo}%`, vNo]);

        if (!check.rows || check.rows.length === 0) {
          const loadLedgerId = await resolveLedgerId(loadName, 'Worker');
          const expLedgerId = await resolveLedgerId('Loadman Charges', 'Expense');

          const loadParticulars = `Loading/unloading charges payable for Purchase Invoice #${invNo}`;
          const expParticulars = `Loading/unloading charges for Purchase Invoice #${invNo}`;

          await db.run(`
            INSERT INTO ledger_entries (
              ledger_id, ledger_name, date, voucher_type, voucher_no, debit, credit,
              reference_id, reference_type, particulars, voucher_id, transaction_id, transaction_type
            ) VALUES (?, ?, ?, 'Purchase', ?, 0, ?, ?, 'purchase', ?, ?, ?, 'purchase')
          `, [loadLedgerId, loadName, dateVal, vNo, loadAmt, pId, loadParticulars, vId, pId]);

          await db.run(`
            INSERT INTO ledger_entries (
              ledger_id, ledger_name, date, voucher_type, voucher_no, debit, credit,
              reference_id, reference_type, particulars, voucher_id, transaction_id, transaction_type
            ) VALUES (?, ?, ?, 'Purchase', ?, ?, 0, ?, 'purchase', ?, ?, ?, 'purchase')
          `, [expLedgerId, 'Loadman Charges', dateVal, vNo, loadAmt, pId, expParticulars, vId, pId]);

          if (vId) {
            await db.run(`INSERT INTO voucher_entry (voucher_id, type, ledger_id, ledger_name, debit, credit, remarks) VALUES (?, 'Ledger', ?, ?, 0, ?, ?)`, [vId, loadLedgerId, loadName, loadAmt, loadParticulars]);
            await db.run(`INSERT INTO voucher_entry (voucher_id, type, ledger_id, ledger_name, debit, credit, remarks) VALUES (?, 'Ledger', ?, 'Loadman Charges', ?, 0, ?)`, [vId, expLedgerId, loadAmt, expParticulars]);
          }
        }
      }
    }
  } catch (e) {
    console.warn('Error in reconcilePurchaseTransporterAndLoadmanEntries:', e.message);
  }
}

// Reconcile and balance any unbalanced journal or accounting vouchers
async function reconcileUnbalancedVouchers() {
  try {
    console.log('Running reconcileUnbalancedVouchers check...');
    const unbalanced = await db.query(`
      SELECT v.id, v.voucher_no, v.voucher_type, v.date, v.reference_no, v.narration,
             COALESCE(SUM(ve.debit), 0) as total_debit,
             COALESCE(SUM(ve.credit), 0) as total_credit
      FROM voucher v
      JOIN voucher_entry ve ON v.id = ve.voucher_id
      GROUP BY v.id, v.voucher_no, v.voucher_type, v.date, v.reference_no, v.narration
      HAVING ABS(COALESCE(SUM(ve.debit), 0) - COALESCE(SUM(ve.credit), 0)) > 0.01
    `);

    for (const row of unbalanced.rows || []) {
      const vId = row.id;
      const vNo = row.voucher_no;
      const diff = Math.round((Number(row.total_debit) - Number(row.total_credit)) * 100) / 100;
      console.log(`Reconciling unbalanced voucher ${vNo} (Debit: ${row.total_debit}, Credit: ${row.total_credit}, Diff: ${diff})`);

      if (diff > 0) {
        // Missing credit entry of diff
        let targetLedgerName = 'Operational Charges Payable';
        let targetLedgerType = 'Liability';
        let targetUnder = 'Current Liabilities';

        const existingEntries = await db.query('SELECT * FROM voucher_entry WHERE voucher_id = ?', [vId]);
        const entries = existingEntries.rows || [];
        const isOperational = entries.some(e => {
          const n = (e.ledger_name || '').toLowerCase();
          return n.includes('loading') || n.includes('operational') || n.includes('labour') || n.includes('freight');
        }) || (row.narration && row.narration.toLowerCase().includes('charge'));

        if (!isOperational) {
          targetLedgerName = 'Suspense & Adjustment Account';
          targetUnder = 'Current Liabilities';
        }

        let ledgerId = null;
        const lmCheck = await db.query('SELECT id FROM ledgermaster WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1', [targetLedgerName]);
        if (lmCheck.rows && lmCheck.rows.length > 0) {
          ledgerId = lmCheck.rows[0].id;
        } else {
          try {
            const ins = await db.run(
              'INSERT INTO ledgermaster (name, printname, under, ledger_type, status) VALUES (?, ?, ?, ?, ?)',
              [targetLedgerName, targetLedgerName.toUpperCase(), targetUnder, targetLedgerType, 'Active']
            );
            ledgerId = ins.lastInsertRowid || ins.lastID;
          } catch (_) {}
          if (!ledgerId) {
            const fallback = await db.query('SELECT id FROM ledgermaster WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1', [targetLedgerName]);
            ledgerId = fallback.rows?.[0]?.id || 1;
          }
        }

        const remarksText = `Balancing credit accrual for ${vNo}`;
        await db.run(
          'INSERT INTO voucher_entry (voucher_id, type, ledger_id, ledger_name, debit, credit, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [vId, 'Cr', ledgerId, targetLedgerName, 0, diff, remarksText]
        );

        await db.run(
          `INSERT INTO ledger_entries (ledger_id, ledger_name, date, voucher_type, voucher_no, debit, credit, particulars, voucher_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [ledgerId, targetLedgerName, row.date, row.voucher_type, vNo, 0, diff, row.narration || remarksText, vId]
        );
        console.log(`✓ Reconciled voucher ${vNo}: Added Credit entry of ₹${diff} to "${targetLedgerName}"`);

      } else if (diff < 0) {
        // Missing debit entry of Math.abs(diff)
        const missingDr = Math.abs(diff);
        let targetLedgerName = 'Loading & Operational Charges';
        let targetLedgerType = 'Expense';
        let targetUnder = 'Direct Expenses';

        let ledgerId = null;
        const lmCheck = await db.query('SELECT id FROM ledgermaster WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1', [targetLedgerName]);
        if (lmCheck.rows && lmCheck.rows.length > 0) {
          ledgerId = lmCheck.rows[0].id;
        } else {
          try {
            const ins = await db.run(
              'INSERT INTO ledgermaster (name, printname, under, ledger_type, status) VALUES (?, ?, ?, ?, ?)',
              [targetLedgerName, targetLedgerName.toUpperCase(), targetUnder, targetLedgerType, 'Active']
            );
            ledgerId = ins.lastInsertRowid || ins.lastID;
          } catch (_) {}
          if (!ledgerId) {
            const fallback = await db.query('SELECT id FROM ledgermaster WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1', [targetLedgerName]);
            ledgerId = fallback.rows?.[0]?.id || 1;
          }
        }

        const remarksText = `Balancing debit accrual for ${vNo}`;
        await db.run(
          'INSERT INTO voucher_entry (voucher_id, type, ledger_id, ledger_name, debit, credit, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [vId, 'Dr', ledgerId, targetLedgerName, missingDr, 0, remarksText]
        );

        await db.run(
          `INSERT INTO ledger_entries (ledger_id, ledger_name, date, voucher_type, voucher_no, debit, credit, particulars, voucher_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [ledgerId, targetLedgerName, row.date, row.voucher_type, vNo, missingDr, 0, row.narration || remarksText, vId]
        );
        console.log(`✓ Reconciled voucher ${vNo}: Added Debit entry of ₹${missingDr} to "${targetLedgerName}"`);
      }
    }
    console.log('✓ reconcileUnbalancedVouchers completed');
  } catch (err) {
    console.error('Error during reconcileUnbalancedVouchers:', err);
  }
}

async function healPurchaseAndSalesVouchers() {
  try {
    const ledgersRes = await db.query('SELECT id, name, ledger_type FROM ledgermaster');
    const supplierIds = new Set();
    const customerIds = new Set();
    (ledgersRes.rows || []).forEach(l => {
      if (l.ledger_type === 'Supplier') supplierIds.add(l.id);
      if (l.ledger_type === 'Customer') customerIds.add(l.id);
    });

    const sRes = await db.query('SELECT name FROM supplier_master');
    const cRes = await db.query('SELECT name FROM customer_master');
    const supplierNames = new Set((sRes.rows || []).map(r => r.name.trim().toLowerCase()));
    const customerNames = new Set((cRes.rows || []).map(r => r.name.trim().toLowerCase()));

    const vouchers = await db.query("SELECT * FROM voucher WHERE voucher_type IN ('Payment', 'Receipt')");
    for (const v of vouchers.rows || []) {
      const entries = await db.query('SELECT ve.*, lm.name as l_name, lm.ledger_type FROM voucher_entry ve LEFT JOIN ledgermaster lm ON ve.ledger_id = lm.id WHERE ve.voucher_id = ?', [v.id]);
      const entList = entries.rows || [];

      let isSupplierPayable = false;
      let isCustomerReceivable = false;

      if ((v.reference_no && v.reference_no.toUpperCase().startsWith('PUR')) || (v.narration && v.narration.toLowerCase().includes('purchase'))) {
        isSupplierPayable = true;
      } else if ((v.reference_no && v.reference_no.toUpperCase().startsWith('SAL')) || (v.narration && v.narration.toLowerCase().includes('sales'))) {
        isCustomerReceivable = true;
      }

      entList.forEach(e => {
        if (supplierIds.has(e.ledger_id) || (e.l_name && supplierNames.has(e.l_name.trim().toLowerCase()))) {
          isSupplierPayable = true;
        }
        if (customerIds.has(e.ledger_id) || (e.l_name && customerNames.has(e.l_name.trim().toLowerCase()))) {
          isCustomerReceivable = true;
        }
      });

      if (isSupplierPayable) {
        const newNarration = (v.narration || '').replace(/Sales Bill/gi, 'Purchase Invoice');
        await db.run('UPDATE voucher SET voucher_type = ?, narration = ? WHERE id = ?', ['Payment', newNarration, v.id]);
        await db.run('UPDATE ledger_entries SET voucher_type = ? WHERE voucher_no = ?', ['Payment', v.voucher_no]);

        // If party is not yet recognized as a supplier in the entries, try resolving from reference_no
        let suppLedgerId = null;
        let suppLedgerName = null;
        if (v.reference_no) {
          try {
            const cleanRef = String(v.reference_no).trim();
            const pRows = await db.query(
              "SELECT supplier FROM purchases WHERE s_no = ? OR s_no = ? OR inv_no = ? LIMIT 1",
              [cleanRef, cleanRef.replace(/^PUR-?/i, '').replace(/^0+/, '') || cleanRef, cleanRef]
            );
            if (pRows.rows && pRows.rows.length > 0) {
              const suppVal = pRows.rows[0].supplier;
              const sMaster = await db.query("SELECT id, name FROM supplier_master WHERE id = ? OR name = ? LIMIT 1", [suppVal, suppVal]);
              if (sMaster.rows && sMaster.rows.length > 0) {
                const sName = sMaster.rows[0].name;
                const lm = await db.query("SELECT id, name FROM ledgermaster WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1", [sName]);
                if (lm.rows && lm.rows.length > 0) {
                  suppLedgerId = lm.rows[0].id;
                  suppLedgerName = lm.rows[0].name;
                }
              }
            }
          } catch (err) {}
        }

        for (const e of entList) {
          const amt = parseFloat(e.debit || 0) || parseFloat(e.credit || 0);
          const isCashOrBank = (e.l_name && (e.l_name.toLowerCase().includes('cash') || e.l_name.toLowerCase().includes('bank'))) ||
                               e.ledger_type === 'Cash' || e.ledger_type === 'Bank' || e.ledger_id === 1 || e.ledger_id === 2;
          const isSupplier = !isCashOrBank && (supplierIds.has(e.ledger_id) || (e.l_name && supplierNames.has(e.l_name.trim().toLowerCase())) || !!suppLedgerId);
          
          if (isSupplier) {
            const targetLedgerId = suppLedgerId || e.ledger_id;
            const targetLedgerName = suppLedgerName || e.l_name || 'Supplier';
            await db.run("UPDATE voucher_entry SET type = 'Dr', debit = ?, credit = 0, ledger_id = ?, ledger_name = ? WHERE id = ?", [amt, targetLedgerId, targetLedgerName, e.id]);
            await db.run("UPDATE ledger_entries SET debit = ?, credit = 0, ledger_id = ?, ledger_name = ? WHERE voucher_no = ? AND (ledger_id = ? OR ledger_id = ?)", [amt, targetLedgerId, targetLedgerName, v.voucher_no, e.ledger_id, targetLedgerId]);
          } else {
            await db.run("UPDATE voucher_entry SET type = 'Cr', debit = 0, credit = ? WHERE id = ?", [amt, e.id]);
            await db.run("UPDATE ledger_entries SET debit = 0, credit = ? WHERE voucher_no = ? AND ledger_id = ?", [amt, v.voucher_no, e.ledger_id]);
          }
        }
      } else if (isCustomerReceivable) {
        const newNarration = (v.narration || '').replace(/Purchase Invoice/gi, 'Sales Bill');
        await db.run('UPDATE voucher SET voucher_type = ?, narration = ? WHERE id = ?', ['Receipt', newNarration, v.id]);
        await db.run('UPDATE ledger_entries SET voucher_type = ? WHERE voucher_no = ?', ['Receipt', v.voucher_no]);

        // If party is not yet recognized as a customer in the entries, try resolving from reference_no
        let custLedgerId = null;
        let custLedgerName = null;
        if (v.reference_no) {
          try {
            const cleanRef = String(v.reference_no).trim();
            const sRows = await db.query(
              "SELECT customer FROM sales WHERE s_no = ? OR s_no = ? LIMIT 1",
              [cleanRef, cleanRef.replace(/^SAL-?/i, '').replace(/^0+/, '') || cleanRef]
            );
            if (sRows.rows && sRows.rows.length > 0) {
              const custVal = sRows.rows[0].customer;
              const cMaster = await db.query("SELECT id, name FROM customer_master WHERE id = ? OR name = ? LIMIT 1", [custVal, custVal]);
              if (cMaster.rows && cMaster.rows.length > 0) {
                const cName = cMaster.rows[0].name;
                const lm = await db.query("SELECT id, name FROM ledgermaster WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1", [cName]);
                if (lm.rows && lm.rows.length > 0) {
                  custLedgerId = lm.rows[0].id;
                  custLedgerName = lm.rows[0].name;
                }
              }
            }
          } catch (err) {}
        }

        for (const e of entList) {
          const amt = parseFloat(e.debit || 0) || parseFloat(e.credit || 0);
          const isCashOrBank = (e.l_name && (e.l_name.toLowerCase().includes('cash') || e.l_name.toLowerCase().includes('bank'))) ||
                               e.ledger_type === 'Cash' || e.ledger_type === 'Bank' || e.ledger_id === 1 || e.ledger_id === 2;
          const isCustomer = !isCashOrBank && (customerIds.has(e.ledger_id) || (e.l_name && customerNames.has(e.l_name.trim().toLowerCase())) || !!custLedgerId);

          if (isCustomer) {
            const targetLedgerId = custLedgerId || e.ledger_id;
            const targetLedgerName = custLedgerName || e.l_name || 'Customer';
            await db.run("UPDATE voucher_entry SET type = 'Cr', debit = 0, credit = ?, ledger_id = ?, ledger_name = ? WHERE id = ?", [amt, targetLedgerId, targetLedgerName, e.id]);
            await db.run("UPDATE ledger_entries SET debit = 0, credit = ?, ledger_id = ?, ledger_name = ? WHERE voucher_no = ? AND (ledger_id = ? OR ledger_id = ?)", [amt, targetLedgerId, targetLedgerName, v.voucher_no, e.ledger_id, targetLedgerId]);
          } else {
            await db.run("UPDATE voucher_entry SET type = 'Dr', debit = ?, credit = 0 WHERE id = ?", [amt, e.id]);
            await db.run("UPDATE ledger_entries SET debit = ?, credit = 0 WHERE voucher_no = ? AND ledger_id = ?", [amt, v.voucher_no, e.ledger_id]);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error during healPurchaseAndSalesVouchers:', error);
  }
}

// Helper to resolve clean ledger name from entry or master tables
async function resolveLedgerName(entry, pfx = '') {
  if (entry && entry.ledger_name && typeof entry.ledger_name === 'string' && entry.ledger_name.trim() && entry.ledger_name.trim() !== 'Unknown') {
    return entry.ledger_name.replace(/\s*\([^)]*\)$/i, '').trim();
  }

  const id = entry ? entry.ledger_id : null;
  if (!id) return 'General Ledger';

  try {
    const lm = await db.query('SELECT name FROM ledgermaster WHERE id = ?', [id]);
    if (lm.rows && lm.rows[0]?.name) return lm.rows[0].name;

    const sm = await db.query('SELECT name FROM supplier_master WHERE id = ?', [id]);
    if (sm.rows && sm.rows[0]?.name) return sm.rows[0].name;

    const cm = await db.query('SELECT name FROM customer_master WHERE id = ?', [id]);
    if (cm.rows && cm.rows[0]?.name) return cm.rows[0].name;

    const pm = await db.query('SELECT name FROM papad_company_master WHERE id = ?', [id]);
    if (pm.rows && pm.rows[0]?.name) return pm.rows[0].name;

    const op = await db.all(`SELECT name FROM ${pfx}operational_parties WHERE id = ?`, [id]).catch(() => []);
    if (op && op[0]?.name) return op[0].name;

    const tm = await db.query('SELECT name FROM transport_master WHERE id = ?', [id]);
    if (tm.rows && tm.rows[0]?.name) return tm.rows[0].name;

    const fm = await db.query('SELECT flourmill FROM flour_mill_master WHERE id = ?', [id]);
    if (fm.rows && fm.rows[0]?.flourmill) return fm.rows[0].flourmill;
  } catch (err) {
    console.warn('resolveLedgerName error:', err.message);
  }

  return 'General Ledger';
}

async function healDatabaseVouchers() {
  console.log('Running healDatabaseVouchers migration...');
  try {
    // Backfill missing ledger_name in voucher_entry from ledger_entries or ledgermaster
    await db.run(`
      UPDATE voucher_entry
      SET ledger_name = (
        SELECT le.ledger_name
        FROM ledger_entries le
        WHERE le.voucher_id = voucher_entry.voucher_id
          AND le.ledger_id = voucher_entry.ledger_id
          AND le.ledger_name IS NOT NULL AND le.ledger_name != ''
        LIMIT 1
      )
      WHERE ledger_name IS NULL OR ledger_name = '' OR ledger_name = 'Unknown'
    `);

    await db.run(`
      UPDATE voucher_entry
      SET ledger_name = (
        SELECT lm.name
        FROM ledgermaster lm
        WHERE lm.id = voucher_entry.ledger_id
      )
      WHERE ledger_name IS NULL OR ledger_name = '' OR ledger_name = 'Unknown'
    `);

    const numericLedgers = await db.query("SELECT id, name FROM ledgermaster WHERE name GLOB '[0-9]*'", []);
    for (const row of numericLedgers.rows || []) {
      const ledgerId = row.id;
      const numericNameStr = row.name;
      
      if (!isNaN(numericNameStr) && Number.isInteger(Number(numericNameStr))) {
        const partyId = parseInt(numericNameStr, 10);
        let realName = null;

        try {
          const res = await db.query('SELECT name FROM supplier_master WHERE id = ?', [partyId]);
          if (res.rows && res.rows.length > 0) realName = res.rows[0].name;
        } catch (e) {}

        if (!realName) {
          try {
            const res = await db.query('SELECT name FROM customer_master WHERE id = ?', [partyId]);
            if (res.rows && res.rows.length > 0) realName = res.rows[0].name;
          } catch (e) {}
        }

        if (!realName) {
          try {
            const res = await db.query('SELECT name FROM papad_company_master WHERE id = ?', [partyId]);
            if (res.rows && res.rows.length > 0) realName = res.rows[0].name;
          } catch (e) {}
        }

        if (!realName) {
          try {
            const res = await db.query('SELECT flourmill FROM flour_mill_master WHERE id = ?', [partyId]);
            if (res.rows && res.rows.length > 0) realName = res.rows[0].flourmill;
          } catch (e) {}
        }

        if (realName) {
          console.log(`Healing ledger ID ${ledgerId} (name: "${numericNameStr}") to "${realName}"`);
          
          const existingLedger = await db.query('SELECT id FROM ledgermaster WHERE name = ? LIMIT 1', [realName]);
          if (existingLedger.rows && existingLedger.rows.length > 0) {
            const correctLedgerId = existingLedger.rows[0].id;
            await db.run('UPDATE voucher_entry SET ledger_id = ? WHERE ledger_id = ?', [correctLedgerId, ledgerId]);
            await db.run('UPDATE ledger_entries SET ledger_name = ? WHERE ledger_name = ?', [realName, numericNameStr]);
            await db.run('DELETE FROM ledgermaster WHERE id = ?', [ledgerId]);
            console.log(`Merged duplicate ledger "${numericNameStr}" into "${realName}" (ID ${correctLedgerId})`);
          } else {
            await db.run('UPDATE ledgermaster SET name = ? WHERE id = ?', [realName, ledgerId]);
            await db.run('UPDATE ledger_entries SET ledger_name = ? WHERE ledger_name = ?', [realName, numericNameStr]);
            console.log(`Renamed ledger "${numericNameStr}" to "${realName}"`);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error during healDatabaseVouchers migration:', error);
  }
}

const { resolveLedgerId } = require('../utils/ledgerHelper');

initTables().catch(console.error);

// GET /vouchers/ledgers - Get standard ledgers + parties
router.get('/ledgers', async (req, res) => {
  try {
    const combinedLedgers = [];
    const seenNames = new Set();

    // 1. Fetch ledgermaster
    try {
      const ledgers = await db.query(`
        SELECT 
          lm.id, 
          lm.name, 
          lm.under, 
          lm.ledger_type, 
          COALESCE(lgm.name, lm.under, lm.ledger_type, 'General') AS group_name
        FROM ledgermaster lm
        LEFT JOIN ledgergroupmaster lgm ON (CAST(lgm.id AS TEXT) = CAST(lm.under AS TEXT) OR LOWER(TRIM(lgm.name)) = LOWER(TRIM(lm.under)))
      `, []);
      for (const row of ledgers.rows || []) {
        if (row.name && !seenNames.has(row.name.toLowerCase())) {
          seenNames.add(row.name.toLowerCase());
          combinedLedgers.push({ 
            id: row.id, 
            name: row.name, 
            under: row.under || 'General',
            group_name: row.group_name || row.under || 'General',
            ledger_type: row.ledger_type || 'General' 
          });
        }
      }
    } catch (err) {
      console.warn('Error fetching standard ledgers:', err);
    }

    // 2. Fetch suppliers
    try {
      const suppliers = await db.query('SELECT name FROM supplier_master', []);
      for (const row of suppliers.rows || []) {
        const name = row.name;
        if (name && !seenNames.has(name.toLowerCase())) {
          seenNames.add(name.toLowerCase());
          const ledgerId = await resolveLedgerId(name, 'Supplier');
          combinedLedgers.push({ 
            id: ledgerId, 
            name: `${name} (Supplier)`, 
            under: 'Sundry Creditors',
            group_name: 'Sundry Creditors',
            ledger_type: 'Supplier' 
          });
        }
      }
    } catch (err) {
      console.warn('Error fetching suppliers:', err);
    }

    // 3. Fetch customers
    try {
      const customers = await db.query('SELECT name FROM customer_master', []);
      for (const row of customers.rows || []) {
        const name = row.name;
        if (name && !seenNames.has(name.toLowerCase())) {
          seenNames.add(name.toLowerCase());
          const ledgerId = await resolveLedgerId(name, 'Customer');
          combinedLedgers.push({ 
            id: ledgerId, 
            name: `${name} (Customer)`, 
            under: 'Sundry Debtors',
            group_name: 'Sundry Debtors',
            ledger_type: 'Customer' 
          });
        }
      }
    } catch (err) {
      console.warn('Error fetching customers:', err);
    }

    // 4. Fetch papad companies
    try {
      const papadCompanies = await db.query('SELECT name FROM papad_company_master', []);
      for (const row of papadCompanies.rows || []) {
        const name = row.name;
        if (name && !seenNames.has(name.toLowerCase())) {
          seenNames.add(name.toLowerCase());
          const ledgerId = await resolveLedgerId(name, 'Supplier');
          combinedLedgers.push({ 
            id: ledgerId, 
            name: `${name} (Papad Co)`, 
            under: 'Sundry Creditors',
            group_name: 'Sundry Creditors',
            ledger_type: 'Supplier' 
          });
        }
      }
    } catch (err) {
      console.warn('Error fetching papad companies:', err);
    }

    // 5. Fetch flourmills
    try {
      const flourMills = await db.query('SELECT flourmill FROM flour_mill_master', []);
      for (const row of flourMills.rows || []) {
        const name = row.flourmill;
        if (name && !seenNames.has(name.toLowerCase())) {
          seenNames.add(name.toLowerCase());
          const ledgerId = await resolveLedgerId(name, 'Supplier');
          combinedLedgers.push({ 
            id: ledgerId, 
            name: `${name} (Flour Mill)`, 
            under: 'Sundry Creditors',
            group_name: 'Sundry Creditors',
            ledger_type: 'Supplier' 
          });
        }
      }
    } catch (err) {
      console.warn('Error fetching flourmills:', err);
    }

    // 6. Fetch operational parties (Workers, Loadmen, Drivers, Helpers, Labour)
    try {
      const companyId = parseInt(req.headers['x-company-id'] || req.companyId || 1, 10) || 1;
      try {
        const { ensureOperationalTables } = require('../services/operationalChargeEngine');
        await ensureOperationalTables(companyId);
      } catch (_) {}
      const opParties = await db.all(`SELECT id, name, COALESCE(category, party_category, 'Worker') as cat FROM operational_parties WHERE is_active = 1`).catch(() => []);
      for (const row of opParties || []) {
        const name = row.name;
        if (name && !seenNames.has(name.toLowerCase())) {
          seenNames.add(name.toLowerCase());
          const ledgerId = await resolveLedgerId(name, 'Worker');
          combinedLedgers.push({ 
            id: ledgerId, 
            name: `${name} (${row.cat || 'Worker'})`, 
            under: 'Current Liabilities',
            group_name: 'Current Liabilities',
            ledger_type: 'Worker' 
          });
        }
      }
    } catch (err) {
      console.warn('Error fetching operational parties:', err);
    }

    // 7. Fetch transporters
    try {
      const transporters = await db.query('SELECT id, name FROM transport_master', []);
      for (const row of transporters.rows || []) {
        const name = row.name;
        if (name && !seenNames.has(name.toLowerCase())) {
          seenNames.add(name.toLowerCase());
          const ledgerId = await resolveLedgerId(name, 'Transporter');
          combinedLedgers.push({ 
            id: ledgerId, 
            name: `${name} (Transporter)`, 
            under: 'Current Liabilities',
            group_name: 'Current Liabilities',
            ledger_type: 'Transporter' 
          });
        }
      }
    } catch (err) {
      console.warn('Error fetching transporters:', err);
    }

    // Sort by name
    combinedLedgers.sort((a, b) => a.name.localeCompare(b.name));

    res.json(combinedLedgers);
  } catch (error) {
    console.error('Error fetching combined ledgers:', error);
    res.status(500).json({ error: error.message });
  }
});

// Format clean double-entry particulars for display in voucher registers
function formatVoucherParticulars(v, entries = []) {
  const vType = String(v.voucher_type || '').toLowerCase();
  let primary = '';
  let secondary = '';

  const drEntries = entries.filter(e => Number(e.debit) > 0);
  const crEntries = entries.filter(e => Number(e.credit) > 0);

  if (vType === 'purchase') {
    // Primary party is the Supplier (Credit side)
    const supplierEntry = crEntries.find(e => {
      const name = (e.ledger_name || '').toLowerCase();
      const type = (e.ledger_type || '').toLowerCase();
      return type === 'supplier' || (!name.includes('discount') && !name.includes('bank') && !name.includes('cash') && !name.includes('tax') && !name.includes('loadman') && !name.includes('freight'));
    }) || crEntries[0];

    primary = supplierEntry ? supplierEntry.ledger_name : (v.reference_no ? `Supplier (${v.reference_no})` : 'Purchase Account');

    const otherAccounts = entries
      .filter(e => e !== supplierEntry)
      .map(e => e.ledger_name)
      .filter(Boolean);
    const uniqueOthers = Array.from(new Set(otherAccounts));
    
    let refPart = v.reference_no ? `Ref: #${v.reference_no}` : '';
    let accountsPart = uniqueOthers.slice(0, 3).join(', ') + (uniqueOthers.length > 3 ? ` +${uniqueOthers.length - 3} more` : '');
    secondary = [accountsPart, refPart].filter(Boolean).join(' | ');

  } else if (vType === 'sales') {
    const custEntry = drEntries.find(e => {
      const name = (e.ledger_name || '').toLowerCase();
      const type = (e.ledger_type || '').toLowerCase();
      return type === 'customer' || (!name.includes('discount') && !name.includes('bank') && !name.includes('cash') && !name.includes('tax'));
    }) || drEntries[0];

    primary = custEntry ? custEntry.ledger_name : 'Customer Account';
    const otherAccounts = entries
      .filter(e => e !== custEntry)
      .map(e => e.ledger_name)
      .filter(Boolean);
    const uniqueOthers = Array.from(new Set(otherAccounts));
    secondary = uniqueOthers.slice(0, 3).join(', ') + (v.reference_no ? ` | Ref: #${v.reference_no}` : '');

  } else if (vType === 'payment') {
    const drNames = drEntries.map(e => e.ledger_name).filter(Boolean).join(', ');
    const crNames = crEntries.map(e => e.ledger_name).filter(Boolean).join(', ');
    primary = drNames || 'Party Payment';
    secondary = crNames ? `via ${crNames}` : '';

  } else if (vType === 'receipt') {
    const crNames = crEntries.map(e => e.ledger_name).filter(Boolean).join(', ');
    const drNames = drEntries.map(e => e.ledger_name).filter(Boolean).join(', ');
    primary = crNames || 'Customer Receipt';
    secondary = drNames ? `into ${drNames}` : '';

  } else if (vType === 'journal') {
    const drNames = drEntries.map(e => e.ledger_name).filter(Boolean).join(', ');
    const crNames = crEntries.map(e => e.ledger_name).filter(Boolean).join(', ');
    if (drNames && crNames) {
      primary = `${drNames} To ${crNames}`;
    } else {
      primary = drNames || crNames || 'Journal Adjustment';
    }
    secondary = v.narration || (v.reference_no ? `Ref: ${v.reference_no}` : '');

  } else if (vType === 'contra') {
    const drNames = drEntries.map(e => e.ledger_name).filter(Boolean).join(', ');
    const crNames = crEntries.map(e => e.ledger_name).filter(Boolean).join(', ');
    primary = `Deposit to ${drNames || 'Account'}`;
    secondary = crNames ? `from ${crNames}` : '';

  } else {
    primary = v.ledger_names || 'General Ledger';
    secondary = v.narration || '';
  }

  return { primary, secondary };
}

// GET /vouchers
router.get('/', async (req, res) => {
  try {
    let query = `
      SELECT v.*, 
      COALESCE(SUM(ve.debit), 0) as total_debit,
      COALESCE(SUM(ve.credit), 0) as total_credit,
      GROUP_CONCAT(DISTINCT COALESCE(NULLIF(ve.ledger_name, ''), lm.name, 'Party Account')) as ledger_names
      FROM voucher v 
      LEFT JOIN voucher_entry ve ON v.id = ve.voucher_id
      LEFT JOIN ledgermaster lm ON ve.ledger_id = lm.id
    `;
    let params = [];
    let conditions = [];
    
    if (req.query.from_date) {
      conditions.push('v.date >= ?');
      params.push(req.query.from_date);
    }
    if (req.query.to_date) {
      conditions.push('v.date <= ?');
      params.push(req.query.to_date);
    }
    if (req.query.voucher_type) {
      conditions.push('v.voucher_type = ?');
      params.push(req.query.voucher_type);
    }
    if (req.query.status) {
      conditions.push('v.status = ?');
      params.push(req.query.status);
    }
    if (req.query.ledger_id) {
      conditions.push('v.id IN (SELECT voucher_id FROM voucher_entry WHERE ledger_id = ?)');
      params.push(req.query.ledger_id);
    }
    if (req.query.search) {
      conditions.push('(v.voucher_no LIKE ? OR v.narration LIKE ? OR v.reference_no LIKE ?)');
      const s = `%${req.query.search}%`;
      params.push(s, s, s);
    }
    
    if (conditions.length) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' GROUP BY v.id ORDER BY v.date DESC, v.id DESC';
    
    const result = await db.query(query, params);
    const vouchers = result.rows || [];

    // Batch load entries for rich particulars and audit-compliant ledger formatting
    const voucherIds = vouchers.map(v => v.id).filter(Boolean);
    if (voucherIds.length > 0) {
      const placeholders = voucherIds.map(() => '?').join(',');
      const entriesRes = await db.query(`
        SELECT ve.*, COALESCE(NULLIF(ve.ledger_name, ''), lm.name, 'Party Account') as ledger_name,
               lm.ledger_type, lm.under
        FROM voucher_entry ve
        LEFT JOIN ledgermaster lm ON ve.ledger_id = lm.id
        WHERE ve.voucher_id IN (${placeholders})
        ORDER BY ve.id ASC
      `, voucherIds);

      const entriesByVoucher = new Map();
      for (const e of entriesRes.rows || []) {
        if (!entriesByVoucher.has(e.voucher_id)) {
          entriesByVoucher.set(e.voucher_id, []);
        }
        entriesByVoucher.get(e.voucher_id).push(e);
      }

      for (const v of vouchers) {
        const entList = entriesByVoucher.get(v.id) || [];
        const { primary, secondary } = formatVoucherParticulars(v, entList);
        v.primary_particular = primary;
        v.secondary_particular = secondary;
        v.particulars_display = primary + (secondary ? ` (${secondary})` : '');

        // Recalculate debit & credit directly from loaded entries for absolute precision
        if (entList.length > 0) {
          const calcDebit = entList.reduce((sum, e) => sum + (Number(e.debit) || 0), 0);
          const calcCredit = entList.reduce((sum, e) => sum + (Number(e.credit) || 0), 0);
          v.total_debit = calcDebit;
          v.total_credit = calcCredit;
          v.is_balanced = Math.abs(calcDebit - calcCredit) < 0.01;
          v.difference = Math.round((calcDebit - calcCredit) * 100) / 100;
        } else {
          v.is_balanced = true;
          v.difference = 0;
        }

        if (!v.ledger_names) {
          v.ledger_names = entList.map(e => e.ledger_name).filter(Boolean).join(', ');
        }
      }
    }

    res.json(vouchers);
  } catch (err) {
    console.error('GET /vouchers error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /vouchers/reconcile - Manual or automated trigger to balance any out-of-balance entries
router.post('/reconcile', async (req, res) => {
  try {
    await reconcileUnbalancedVouchers();
    res.json({ success: true, message: 'All vouchers checked and balanced successfully.' });
  } catch (err) {
    console.error('POST /vouchers/reconcile error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fixed duplicate POST removed

// POST /vouchers - Create
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    // Pre-resolve any string or non-numeric ledger_id (e.g. TM_1, custom names, etc.)
    const { resolveLedgerId } = require('../utils/ledgerHelper');
    const resolvedEntries = [];
    for (const entry of data.entries || []) {
      const nextEntry = { ...entry };
      if (!nextEntry.ledger_id || isNaN(Number(nextEntry.ledger_id)) || Number(nextEntry.ledger_id) <= 0) {
        const nameToResolve = nextEntry.ledger_name || (typeof nextEntry.ledger_id === 'string' && isNaN(Number(nextEntry.ledger_id)) ? nextEntry.ledger_id : 'General Account');
        const resolvedId = await resolveLedgerId(nameToResolve, data.voucher_type === 'Receipt' ? 'Customer' : 'Supplier');
        if (resolvedId) {
          nextEntry.ledger_id = resolvedId;
          nextEntry.ledger_name = nameToResolve;
        } else {
          nextEntry.ledger_id = 1;
        }
      }
      nextEntry.resolved_ledger_name = await resolveLedgerName(nextEntry, '');
      resolvedEntries.push(nextEntry);
    }

    validateVoucherData({ ...data, entries: resolvedEntries });

    // Auto generate voucher_no if not provided
    let voucher_no = data.voucher_no;
    if (!voucher_no) {
      voucher_no = await generateVoucherNo(data.voucher_type);
    }

    const conn = await db.getConnection();
    let voucherId = null;
    try {
      await conn.beginTransaction();

      // Insert voucher master
      const voucherResult = await conn.run(
        'INSERT INTO voucher (voucher_type, voucher_no, date, reference_no, narration, status, posted) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [data.voucher_type, voucher_no, data.date, data.reference_no || '', data.narration || '', data.status || 'Approved', data.posted !== undefined ? data.posted : 1]
      );
      voucherId = voucherResult.lastInsertRowid || voucherResult.lastID;

      // Insert entries & post to ledger_entries on same transactional connection
      for (const entry of resolvedEntries) {
        const entryType = entry.type || (Number(entry.debit) > 0 ? 'Dr' : 'Cr');
        const ledger_name = entry.resolved_ledger_name;

        await conn.run(
          'INSERT INTO voucher_entry (voucher_id, type, ledger_id, ledger_name, debit, credit, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [voucherId, entryType, entry.ledger_id, ledger_name, entry.debit || 0, entry.credit || 0, entry.remarks || '']
        );

        const particularsText = (entry.remarks && entry.remarks.trim())
          ? entry.remarks.trim()
          : ((data.reference_no && data.reference_no.trim())
              ? data.reference_no.trim()
              : (data.narration || ''));

        await conn.run(
          `INSERT INTO ledger_entries (ledger_id, ledger_name, date, voucher_type, voucher_no, debit, credit, particulars, voucher_id) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [entry.ledger_id, ledger_name, data.date, data.voucher_type, voucher_no, entry.debit || 0, entry.credit || 0, particularsText, voucherId]
        );
      }

      await conn.commit();
    } catch (txErr) {
      try { await conn.rollback(); } catch (_) {}
      throw txErr;
    } finally {
      await conn.release();
    }

    // Return created with details
    const created = await db.query(`
      SELECT v.*, SUM(ve.debit) total_debit, SUM(ve.credit) total_credit 
      FROM voucher v LEFT JOIN voucher_entry ve ON v.id = ve.voucher_id 
      WHERE v.id = ? GROUP BY v.id
    `, [voucherId]);
    res.status(201).json(created.rows[0]);
  } catch (err) {
    console.error('POST /vouchers error:', err);
    res.status(400).json({ error: err.message });
  }
});

// GET /vouchers/:id - Single with entries
router.get('/:id', async (req, res) => {
  try {
    const voucher = await db.query(`
      SELECT v.*, SUM(ve.debit) total_debit, SUM(ve.credit) total_credit 
      FROM voucher v LEFT JOIN voucher_entry ve ON v.id = ve.voucher_id 
      WHERE v.id = ? GROUP BY v.id
    `, [req.params.id]);
    
    if (voucher.rows.length === 0) return res.status(404).json({ error: 'Voucher not found' });

    const entries = await db.query(`
      SELECT ve.*, COALESCE(NULLIF(ve.ledger_name, ''), lm.name, 'General Ledger') as ledger_name 
      FROM voucher_entry ve 
      LEFT JOIN ledgermaster lm ON ve.ledger_id = lm.id 
      WHERE ve.voucher_id = ?
    `, [req.params.id]);

    res.json({ ...voucher.rows[0], entries: entries.rows });
  } catch (err) {
    console.error('GET /vouchers/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /vouchers/:id - Update atomically with full validation before mutating
router.put('/:id', async (req, res) => {
  try {
    const existingRes = await db.query('SELECT id, voucher_no FROM voucher WHERE id = ? LIMIT 1', [req.params.id]);
    if (!existingRes.rows || existingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Voucher not found' });
    }
    const existingVoucher = existingRes.rows[0];

    const data = req.body;
    const { resolveLedgerId } = require('../utils/ledgerHelper');
    const resolvedEntries = [];
    for (const entry of data.entries || []) {
      const nextEntry = { ...entry };
      if (!nextEntry.ledger_id || isNaN(Number(nextEntry.ledger_id)) || Number(nextEntry.ledger_id) <= 0) {
        const nameToResolve = nextEntry.ledger_name || (typeof nextEntry.ledger_id === 'string' && isNaN(Number(nextEntry.ledger_id)) ? nextEntry.ledger_id : 'General Account');
        const resolvedId = await resolveLedgerId(nameToResolve, data.voucher_type === 'Receipt' ? 'Customer' : 'Supplier');
        if (resolvedId) {
          nextEntry.ledger_id = resolvedId;
          nextEntry.ledger_name = nameToResolve;
        } else {
          nextEntry.ledger_id = 1;
        }
      }
      nextEntry.resolved_ledger_name = await resolveLedgerName(nextEntry, '');
      resolvedEntries.push(nextEntry);
    }

    // Validate BEFORE deleting any existing entries
    validateVoucherData({ ...data, entries: resolvedEntries });

    const voucher_no = data.voucher_no || existingVoucher.voucher_no || await generateVoucherNo(data.voucher_type);

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      await conn.run('DELETE FROM voucher_entry WHERE voucher_id = ?', [req.params.id]);
      await conn.run('DELETE FROM ledger_entries WHERE voucher_id = ? OR voucher_no = ?', [req.params.id, existingVoucher.voucher_no]);

      await conn.run(`
        UPDATE voucher SET voucher_type = ?, voucher_no = ?, date = ?, reference_no = ?, narration = ?, status = ?, posted = ? WHERE id = ?
      `, [data.voucher_type, voucher_no, data.date, data.reference_no || '', data.narration || '', data.status || 'Approved', data.posted !== undefined ? data.posted : 1, req.params.id]);

      for (const entry of resolvedEntries) {
        const entryType = entry.type || (Number(entry.debit) > 0 ? 'Dr' : 'Cr');
        const ledger_name = entry.resolved_ledger_name;

        await conn.run(
          'INSERT INTO voucher_entry (voucher_id, type, ledger_id, ledger_name, debit, credit, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [req.params.id, entryType, entry.ledger_id, ledger_name, entry.debit || 0, entry.credit || 0, entry.remarks || '']
        );

        const particularsText = (entry.remarks && entry.remarks.trim())
          ? entry.remarks.trim()
          : ((data.reference_no && data.reference_no.trim())
              ? data.reference_no.trim()
              : (data.narration || ''));

        await conn.run(
          `INSERT INTO ledger_entries (ledger_id, ledger_name, date, voucher_type, voucher_no, debit, credit, particulars, voucher_id) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [entry.ledger_id, ledger_name, data.date, data.voucher_type, voucher_no, entry.debit || 0, entry.credit || 0, particularsText, req.params.id]
        );
      }

      await conn.commit();
    } catch (txErr) {
      try { await conn.rollback(); } catch (_) {}
      throw txErr;
    } finally {
      await conn.release();
    }

    res.json({ message: 'Voucher updated successfully' });
  } catch (err) {
    console.error('PUT /vouchers/:id error:', err);
    res.status(400).json({ error: err.message });
  }
});

// Preview auto voucher number (for frontend)
router.post('/preview-no', async (req, res) => {
  try {
    const { voucher_type } = req.body;
    if (!voucher_type || !PREFIX_MAP[voucher_type]) {
      return res.status(400).json({ error: 'Valid voucher_type required' });
    }
    const voucher_no = await generateVoucherNo(voucher_type);
    res.json({ voucher_no });
  } catch (err) {
    console.error('Preview voucher-no error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /vouchers/:id
router.delete('/:id', async (req, res) => {
  try {
    const voucher = await db.query('SELECT * FROM voucher WHERE id = ?', [req.params.id]);
    if (voucher.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const vRow = voucher.rows[0];
    try {
      const vEntries = await db.query('SELECT * FROM voucher_entry WHERE voucher_id = ?', [req.params.id]);
      const lEntries = await db.query('SELECT * FROM ledger_entries WHERE voucher_no = ?', [vRow.voucher_no]);

      await recycleBinService.saveToRecycleBin({
        moduleName: 'Voucher',
        recordId: req.params.id,
        title: `Voucher #${vRow.voucher_no || req.params.id} (${vRow.voucher_type || 'General'})`,
        recordData: {
          tableName: 'voucher',
          record: vRow,
          subRecords: [
            { tableName: 'voucher_entry', records: vEntries.rows || [] },
            { tableName: 'ledger_entries', records: lEntries.rows || [] }
          ]
        },
        deletedBy: req.user?.username || 'admin'
      });
    } catch (e) {
      console.warn('Recycle bin save error in vouchers:', e.message);
    }

    await db.run('DELETE FROM voucher_entry WHERE voucher_id = ?', [req.params.id]);
    await db.run('DELETE FROM ledger_entries WHERE voucher_no = ?', [vRow.voucher_no]);
    await db.run('DELETE FROM voucher WHERE id = ?', [req.params.id]);
    res.json({ message: `Voucher ${vRow.voucher_no} deleted` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.healPurchaseAndSalesVouchers = healPurchaseAndSalesVouchers;
router.reconcilePurchaseTransporterAndLoadmanEntries = reconcilePurchaseTransporterAndLoadmanEntries;
router.healAllTransactions = healAllTransactions;
module.exports = router;

