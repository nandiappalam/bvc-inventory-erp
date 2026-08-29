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

// Generate auto voucher number (robust)
async function generateVoucherNo(voucher_type) {
  try {
    const prefix = PREFIX_MAP[voucher_type];
    if (!prefix) throw new Error('Invalid voucher_type for numbering');
    const countResult = await db.query(
      'SELECT COUNT(*) as count FROM voucher',
      []
    );
    const nextNum = (countResult.rows[0].count || 0) + 1;
    return `${prefix}${nextNum.toString().padStart(3, '0')}`;
  } catch (err) {
    console.error('generateVoucherNo ERROR:', err);
    return `${PREFIX_MAP[voucher_type] || 'VOC'}001`;
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

  // Data healing is an explicit operator action, never an import-time startup mutation.
}

async function healAllTransactions() {
  console.log('Running healAllTransactions to sync purchases, sales, and advances to ledger...');
  const { createPurchaseVoucherChain, createSalesLedgerEntries, createAdvanceLedgerEntries } = require('../utils/ledgerHelper');
  
  try {
    // 1. Heal Purchases
    const purchases = await db.query('SELECT * FROM purchases', []);
    for (const p of purchases.rows || []) {
      // Check if purchase is already in voucher
      const vResult = await db.query(
        "SELECT id FROM voucher WHERE reference_no = ? AND voucher_type = 'Purchase' LIMIT 1",
        [String(p.id)]
      );
      if (vResult.rows.length === 0) {
        console.log(`Healing Purchase ID ${p.id} to ledger...`);
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

    // 2. Heal Sales
    const sales = await db.query('SELECT * FROM sales', []);
    for (const s of sales.rows || []) {
      const vResult = await db.query(
        "SELECT id FROM voucher WHERE reference_no = ? AND voucher_type = 'Sales' LIMIT 1",
        [String(s.id)]
      );
      if (vResult.rows.length === 0) {
        console.log(`Healing Sales ID ${s.id} to ledger...`);
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
      // For advances, check ledger_entries by reference_id and reference_type
      const leResult = await db.query(
        "SELECT id FROM ledger_entries WHERE reference_id = ? AND reference_type = 'advance' LIMIT 1",
        [a.id]
      );
      if (leResult.rows.length === 0) {
        console.log(`Healing Advance ID ${a.id} to ledger...`);
        await createAdvanceLedgerEntries({
          papadCompany: a.papad_company,
          date: a.date,
          sNo: a.s_no,
          advanceId: a.id,
          amount: a.amount
        });
      }
    }

    // 4. Auto-correct any existing misallocated Customer/Supplier ledger entries
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
          await db.run("UPDATE voucher_entry SET ledger_id = ? WHERE voucher_id = ? AND ledger_id != ?", [correctId, entry.voucher_id, correctId]);
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
          await db.run("UPDATE voucher_entry SET ledger_id = ? WHERE voucher_id = ? AND ledger_id != ?", [correctId, entry.voucher_id, correctId]);
        }
        console.log(`✓ Corrected Purchase entry id ${entry.id} "${entry.ledger_name}" to supplier ledger id ${correctId}`);
      }
    }

    await healPurchaseAndSalesVouchers();
    console.log('✓ healAllTransactions completed successfully');
  } catch (error) {
    console.error('Error during healAllTransactions:', error);
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

        for (const e of entList) {
          const amt = parseFloat(e.debit || 0) || parseFloat(e.credit || 0);
          const isSupplier = supplierIds.has(e.ledger_id) || (e.l_name && supplierNames.has(e.l_name.trim().toLowerCase()));
          if (isSupplier) {
            await db.run("UPDATE voucher_entry SET type = 'Dr', debit = ?, credit = 0 WHERE id = ?", [amt, e.id]);
            await db.run("UPDATE ledger_entries SET debit = ?, credit = 0 WHERE voucher_no = ? AND ledger_id = ?", [amt, v.voucher_no, e.ledger_id]);
          } else {
            await db.run("UPDATE voucher_entry SET type = 'Cr', debit = 0, credit = ? WHERE id = ?", [amt, e.id]);
            await db.run("UPDATE ledger_entries SET debit = 0, credit = ? WHERE voucher_no = ? AND ledger_id = ?", [amt, v.voucher_no, e.ledger_id]);
          }
        }
      } else if (isCustomerReceivable) {
        const newNarration = (v.narration || '').replace(/Purchase Invoice/gi, 'Sales Bill');
        await db.run('UPDATE voucher SET voucher_type = ?, narration = ? WHERE id = ?', ['Receipt', newNarration, v.id]);
        await db.run('UPDATE ledger_entries SET voucher_type = ? WHERE voucher_no = ?', ['Receipt', v.voucher_no]);

        for (const e of entList) {
          const amt = parseFloat(e.debit || 0) || parseFloat(e.credit || 0);
          const isCustomer = customerIds.has(e.ledger_id) || (e.l_name && customerNames.has(e.l_name.trim().toLowerCase()));
          if (isCustomer) {
            await db.run("UPDATE voucher_entry SET type = 'Cr', debit = 0, credit = ? WHERE id = ?", [amt, e.id]);
            await db.run("UPDATE ledger_entries SET debit = 0, credit = ? WHERE voucher_no = ? AND ledger_id = ?", [amt, v.voucher_no, e.ledger_id]);
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

async function healDatabaseVouchers() {
  console.log('Running healDatabaseVouchers migration...');
  try {
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

// GET /vouchers/ledgers - Get standard ledgers + parties
router.get('/ledgers', async (req, res) => {
  try {
    const combinedLedgers = [];
    const seenNames = new Set();

    // 1. Fetch ledgermaster
    try {
      const ledgers = await db.query('SELECT id, name, ledger_type FROM ledgermaster', []);
      for (const row of ledgers.rows || []) {
        if (row.name && !seenNames.has(row.name.toLowerCase())) {
          seenNames.add(row.name.toLowerCase());
          combinedLedgers.push({ id: row.id, name: row.name, ledger_type: row.ledger_type || 'General' });
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
          combinedLedgers.push({ id: ledgerId, name: `${name} (Supplier)`, ledger_type: 'Supplier' });
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
          combinedLedgers.push({ id: ledgerId, name: `${name} (Customer)`, ledger_type: 'Customer' });
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
          combinedLedgers.push({ id: ledgerId, name: `${name} (Papad Co)`, ledger_type: 'Supplier' });
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
          combinedLedgers.push({ id: ledgerId, name: `${name} (Flour Mill)`, ledger_type: 'Supplier' });
        }
      }
    } catch (err) {
      console.warn('Error fetching flourmills:', err);
    }

    // Sort by name
    combinedLedgers.sort((a, b) => a.name.localeCompare(b.name));

    res.json(combinedLedgers);
  } catch (error) {
    console.error('Error fetching combined ledgers:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /vouchers
router.get('/', async (req, res) => {
  try {
    let query = `
      SELECT v.*, 
      COALESCE(SUM(ve.debit), 0) as total_debit,
      COALESCE(SUM(ve.credit), 0) as total_credit,
      GROUP_CONCAT(lm.name, ', ') as ledger_names
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
    res.json(result.rows);
  } catch (err) {
    console.error('GET /vouchers error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Fixed duplicate POST removed

// POST /vouchers - Create
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    validateVoucherData(data);

    // Auto generate voucher_no if not provided
    let voucher_no = data.voucher_no;
    const autoGenerate = !voucher_no;
    if (autoGenerate) {
      voucher_no = await generateVoucherNo(data.voucher_type);
    }

    // Insert voucher master
    const voucherResult = await db.run(
      'INSERT INTO voucher (voucher_type, voucher_no, date, reference_no, narration, status, posted) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [data.voucher_type, voucher_no, data.date, data.reference_no || '', data.narration || '', data.status || 'Approved', data.posted !== undefined ? data.posted : 1]
    );
    const voucherId = voucherResult.lastInsertRowid;

    // Insert entries
    for (const entry of data.entries) {
      await db.run(
        'INSERT INTO voucher_entry (voucher_id, type, ledger_id, debit, credit, remarks) VALUES (?, ?, ?, ?, ?, ?)',
        [voucherId, entry.type, entry.ledger_id, entry.debit || 0, entry.credit || 0, entry.remarks || '']
      );
    }

    // Post to ledger_entries
    const ledgerEntries = [];
    for (const entry of data.entries) {
      const lmResult = await db.query('SELECT name FROM ledgermaster WHERE id = ?', [entry.ledger_id]);
      const ledger_name = lmResult.rows[0]?.name || 'Unknown';
      ledgerEntries.push(db.run(
        `INSERT INTO ledger_entries (ledger_id, ledger_name, date, voucher_type, voucher_no, debit, credit, particulars) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [entry.ledger_id, ledger_name, data.date, data.voucher_type, voucher_no, entry.debit || 0, entry.credit || 0, entry.remarks || '']
      ));
    }
    await Promise.all(ledgerEntries);

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
      SELECT ve.*, lm.name as ledger_name 
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

// PUT /vouchers/:id - Update (simplified)
router.put('/:id', async (req, res) => {
  try {
    // First delete existing
    await db.run('DELETE FROM voucher_entry WHERE voucher_id = ?', [req.params.id]);
    await db.run('DELETE FROM ledger_entries WHERE voucher_no = (SELECT voucher_no FROM voucher WHERE id = ?)', [req.params.id]);
    
    // Re-use POST logic (simplified)
    const data = req.body;
    const voucher_no = data.voucher_no || await generateVoucherNo(data.voucher_type);
    
    await db.run(`
      UPDATE voucher SET voucher_type = ?, voucher_no = ?, date = ?, reference_no = ?, narration = ?, status = ?, posted = ? WHERE id = ?
    `, [data.voucher_type, voucher_no, data.date, data.reference_no || '', data.narration || '', data.status || 'Approved', data.posted !== undefined ? data.posted : 1, req.params.id]);

    // Insert new entries
    const ledgerEntries = [];
    for (const entry of data.entries) {
      await db.run(
        'INSERT INTO voucher_entry (voucher_id, type, ledger_id, debit, credit, remarks) VALUES (?, ?, ?, ?, ?, ?)',
        [req.params.id, entry.type, entry.ledger_id, entry.debit || 0, entry.credit || 0, entry.remarks || '']
      );
      
      const lmResult = await db.query('SELECT name FROM ledgermaster WHERE id = ?', [entry.ledger_id]);
      const ledger_name = lmResult.rows[0]?.name || 'Unknown';
      ledgerEntries.push(db.run(
        `INSERT INTO ledger_entries (ledger_id, ledger_name, date, voucher_type, voucher_no, debit, credit, particulars) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [entry.ledger_id, ledger_name, data.date, data.voucher_type, voucher_no, entry.debit || 0, entry.credit || 0, entry.remarks || '']
      ));
    }
    await Promise.all(ledgerEntries);

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

module.exports = router;

