/**
 * Ledger Entry Helper Module
<<<<<<< HEAD
 * Provides voucher-aware ledger entry creation for ERP transactions.
=======
 * Provides functions to create ledger entries for various transactions
>>>>>>> origin/main
 */

const db = require('../config/database')

<<<<<<< HEAD
async function ensureVoucherTables() {
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS voucher (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        voucher_type TEXT NOT NULL,
        voucher_no TEXT UNIQUE NOT NULL,
        date TEXT NOT NULL,
        reference_no TEXT,
        narration TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await db.run(`
      CREATE TABLE IF NOT EXISTS voucher_entry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        voucher_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        ledger_id INTEGER,
        ledger_name TEXT,
        debit REAL DEFAULT 0,
        credit REAL DEFAULT 0,
        remarks TEXT,
        FOREIGN KEY (voucher_id) REFERENCES voucher(id) ON DELETE CASCADE
      )
    `)
    await db.run(`
      CREATE TABLE IF NOT EXISTS ledger_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        voucher_id INTEGER,
        transaction_id INTEGER,
        transaction_type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ledger_id) REFERENCES ledgermaster(id)
      )
    `)
  } catch (error) {
    console.error('Error ensuring voucher tables:', error)
  }

  try {
    const tableInfo = await db.query('PRAGMA table_info(ledger_entries)')
    const columns = new Set((tableInfo.rows || []).map((row) => row.name))
    if (!columns.has('reference_type')) {
      await db.run('ALTER TABLE ledger_entries ADD COLUMN reference_type TEXT')
    }
    if (!columns.has('voucher_id')) {
      await db.run('ALTER TABLE ledger_entries ADD COLUMN voucher_id INTEGER')
    }
    if (!columns.has('transaction_id')) {
      await db.run('ALTER TABLE ledger_entries ADD COLUMN transaction_id INTEGER')
    }
    if (!columns.has('transaction_type')) {
      await db.run('ALTER TABLE ledger_entries ADD COLUMN transaction_type TEXT')
    }
  } catch (error) {
    console.error('Error ensuring ledger entry columns:', error)
  }

  try {
    await db.run('CREATE INDEX IF NOT EXISTS idx_voucher_reference_no ON voucher(reference_no)')
    await db.run('CREATE INDEX IF NOT EXISTS idx_voucher_entry_voucher_id ON voucher_entry(voucher_id)')
    await db.run('CREATE INDEX IF NOT EXISTS idx_ledger_entries_voucher ON ledger_entries(voucher_type, voucher_no)')
  } catch (error) {
    console.error('Error creating voucher indexes:', error)
  }
}

ensureVoucherTables()

/**
 * Get next voucher number for a given prefix.
=======
/**
 * Get next voucher number for a given prefix
>>>>>>> origin/main
 * @param {string} prefix - Voucher type prefix (e.g., 'PUR', 'SAL', 'ADV')
 * @returns {string} - Formatted voucher number
 */
async function getNextVoucherNumber(prefix) {
  try {
<<<<<<< HEAD
    const normalizedPrefix = String(prefix || '').toUpperCase()
    const prefixMap = {
      PURCHASE: 'PUR',
      PUR: 'PUR',
      SALES: 'SAL',
      SAL: 'SAL',
      ADVANCE: 'ADV',
      ADV: 'ADV',
      PAYMENT: 'PAY',
      PAY: 'PAY',
      RECEIPT: 'REC',
      REC: 'REC',
      JOURNAL: 'JNL',
      JNL: 'JNL',
      CONTRA: 'CON',
      CON: 'CON',
    }
    const voucherPrefix = prefixMap[normalizedPrefix] || normalizedPrefix

    const result = await db.query(`
      SELECT voucher_no FROM voucher
      WHERE voucher_no LIKE ? OR UPPER(voucher_type) = ? OR UPPER(voucher_type) = ?
      ORDER BY id DESC LIMIT 50
    `, [`${voucherPrefix}%`, normalizedPrefix, voucherPrefix])

    let maxNum = 0
    if (result.rows && result.rows.length > 0) {
      for (const row of result.rows) {
        const vNo = String(row.voucher_no || '')
        const match = vNo.match(/(\d+)$/)
        if (match) {
          const num = parseInt(match[1], 10)
          if (!isNaN(num) && num > maxNum) {
            maxNum = num
          }
        }
      }
    }

    let nextNum = maxNum + 1
    let candidate = `${voucherPrefix}${String(nextNum).padStart(5, '0')}`

    while (true) {
      const check = await db.query('SELECT id FROM voucher WHERE voucher_no = ? LIMIT 1', [candidate])
      if (!check.rows || check.rows.length === 0) {
        break
      }
      nextNum++
      candidate = `${voucherPrefix}${String(nextNum).padStart(5, '0')}`
    }

    return candidate
  } catch (error) {
    console.error('Error generating voucher number:', error)
    return `${String(prefix || 'VOC').toUpperCase()}${Date.now().toString().slice(-5)}`
  }
}

async function getPartyName(partyVal, preferredType = null) {
  if (!partyVal) return 'Unknown Party';
  if (!isNaN(partyVal) && Number.isInteger(Number(partyVal))) {
    const id = parseInt(partyVal, 10);
    const type = preferredType ? preferredType.toLowerCase() : null;

    if (type === 'supplier') {
      try {
        const res = await db.query('SELECT name FROM supplier_master WHERE id = ?', [id]);
        if (res.rows && res.rows.length > 0 && res.rows[0].name) {
          return res.rows[0].name;
        }
      } catch (e) {}
    } else if (type === 'customer') {
      try {
        const res = await db.query('SELECT name FROM customer_master WHERE id = ?', [id]);
        if (res.rows && res.rows.length > 0 && res.rows[0].name) {
          return res.rows[0].name;
        }
      } catch (e) {}
    } else if (type === 'papad_company' || type === 'papad company') {
      try {
        const res = await db.query('SELECT name FROM papad_company_master WHERE id = ?', [id]);
        if (res.rows && res.rows.length > 0 && res.rows[0].name) {
          return res.rows[0].name;
        }
      } catch (e) {}
    } else if (type === 'flour_mill' || type === 'flour mill') {
      try {
        const res = await db.query('SELECT flourmill FROM flour_mill_master WHERE id = ?', [id]);
        if (res.rows && res.rows.length > 0 && res.rows[0].flourmill) {
          return res.rows[0].flourmill;
        }
      } catch (e) {}
    }

    // Fallbacks
    // 1. Try supplier_master
    try {
      const res = await db.query('SELECT name FROM supplier_master WHERE id = ?', [id]);
      if (res.rows && res.rows.length > 0 && res.rows[0].name) {
        return res.rows[0].name;
      }
    } catch (e) {}
    // 2. Try customer_master
    try {
      const res = await db.query('SELECT name FROM customer_master WHERE id = ?', [id]);
      if (res.rows && res.rows.length > 0 && res.rows[0].name) {
        return res.rows[0].name;
      }
    } catch (e) {}
    // 3. Try papad_company_master
    try {
      const res = await db.query('SELECT name FROM papad_company_master WHERE id = ?', [id]);
      if (res.rows && res.rows.length > 0 && res.rows[0].name) {
        return res.rows[0].name;
      }
    } catch (e) {}
    // 4. Try flour_mill_master
    try {
      const res = await db.query('SELECT flourmill FROM flour_mill_master WHERE id = ?', [id]);
      if (res.rows && res.rows.length > 0 && res.rows[0].flourmill) {
        return res.rows[0].flourmill;
      }
    } catch (e) {}
  }
  return String(partyVal);
}

async function resolveLedgerId(ledgerName, ledgerType = null) {
  if (!ledgerName) return null

  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS ledgermaster (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      )
    `)
  } catch (error) {
    console.warn('Ledger master table setup skipped:', error.message)
  }

  try {
    let existing;
    if (ledgerType) {
      // First try exact name and ledger_type
      existing = await db.query('SELECT id FROM ledgermaster WHERE name = ? AND ledger_type = ? LIMIT 1', [ledgerName, ledgerType])
      if (existing.rows.length === 0) {
        // Try trimming/starting with and matching type
        existing = await db.query('SELECT id FROM ledgermaster WHERE (TRIM(name) = ? OR name LIKE ?) AND ledger_type = ? LIMIT 1', [ledgerName.trim(), ledgerName.trim() + '%', ledgerType])
      }
    }
    
    if (!existing || existing.rows.length === 0) {
      // Fallback: name match
      existing = await db.query('SELECT id FROM ledgermaster WHERE name = ? LIMIT 1', [ledgerName])
      if (existing.rows.length === 0) {
        existing = await db.query('SELECT id FROM ledgermaster WHERE TRIM(name) = ? LIMIT 1', [ledgerName.trim()])
      }
    }

    if (existing && existing.rows.length > 0) {
      return existing.rows[0].id
    }

    const tableInfo = await db.query('PRAGMA table_info(ledgermaster)')
    const columns = new Set((tableInfo.rows || []).map((row) => row.name))

    const fields = ['name']
    const values = [ledgerName]

    if (columns.has('print_name')) {
      fields.push('print_name')
      values.push(ledgerName)
    }
    if (columns.has('status')) {
      fields.push('status')
      values.push('Active')
    }
    if (columns.has('ledger_type') && ledgerType) {
      fields.push('ledger_type')
      values.push(ledgerType)
    }

    const placeholders = fields.map(() => '?').join(', ')
    const insertSql = `INSERT INTO ledgermaster (${fields.join(', ')}) VALUES (${placeholders})`

    const insertResult = await db.run(insertSql, values)
    return insertResult.lastInsertRowid
  } catch (error) {
    const message = String(error.message || '')
    if (message.includes('UNIQUE constraint failed') || message.includes('already exists')) {
      let existing;
      if (ledgerType) {
        existing = await db.query('SELECT id FROM ledgermaster WHERE name = ? AND ledger_type = ? LIMIT 1', [ledgerName, ledgerType])
        if (existing.rows.length === 0) {
          existing = await db.query('SELECT id FROM ledgermaster WHERE (TRIM(name) = ? OR name LIKE ?) AND ledger_type = ? LIMIT 1', [ledgerName.trim(), ledgerName.trim() + '%', ledgerType])
        }
      }
      if (!existing || existing.rows.length === 0) {
        existing = await db.query('SELECT id FROM ledgermaster WHERE name = ? LIMIT 1', [ledgerName])
      }
      return existing.rows[0]?.id || null
    }
    console.warn('Ledger lookup skipped:', error.message)
    return null
=======
    const result = await db.query(`
      SELECT voucher_no FROM ledger_entries 
      WHERE voucher_type = ? 
      ORDER BY id DESC LIMIT 1
    `, [prefix])
    
    if (result.rows.length > 0) {
      const lastNo = parseInt(result.rows[0].voucher_no.replace(prefix, '')) || 0
      return `${prefix}${String(lastNo + 1).padStart(5, '0')}`
    }
    return `${prefix}00001`
  } catch (error) {
    console.error('Error generating voucher number:', error)
    return `${prefix}00001`
>>>>>>> origin/main
  }
}

/**
<<<<<<< HEAD
 * Create a single ledger entry.
 * @param {object} params - Ledger entry parameters
 */
async function createLedgerEntry({
  ledgerName,
  date,
  voucherType,
  voucherNo,
  debit = 0,
  credit = 0,
  referenceId = null,
  referenceType = null,
  particulars = '',
  voucherId = null,
  transactionId = null,
  transactionType = null,
  ledgerType = null,
}) {
  try {
    const ledgerId = await resolveLedgerId(ledgerName, ledgerType)

    await db.run(`
      INSERT INTO ledger_entries (
        ledger_id, ledger_name, date, voucher_type, voucher_no, debit, credit,
        reference_id, reference_type, particulars, voucher_id, transaction_id, transaction_type
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      ledgerId,
      ledgerName,
      date,
      voucherType,
      voucherNo,
      debit,
      credit,
      referenceId,
      referenceType,
      particulars,
      voucherId,
      transactionId,
      transactionType,
    ])

=======
 * Create a single ledger entry
 * @param {object} params - Ledger entry parameters
 */
async function createLedgerEntry({ 
  ledgerName, 
  date, 
  voucherType, 
  voucherNo, 
  debit = 0, 
  credit = 0, 
  referenceId = null, 
  particulars = '' 
}) {
  try {
    // Get ledger ID from ledgermaster
    let ledgerId = null
    try {
      const ledgerResult = await db.query('SELECT id FROM ledgermaster WHERE name = ?', [ledgerName])
      ledgerId = ledgerResult.rows.length > 0 ? ledgerResult.rows[0].id : null
    } catch (e) {
      console.log('Ledger not found:', ledgerName)
    }
    
    await db.run(`
      INSERT INTO ledger_entries (ledger_id, ledger_name, date, voucher_type, voucher_no, debit, credit, reference_id, particulars)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [ledgerId, ledgerName, date, voucherType, voucherNo, debit, credit, referenceId, particulars])
    
>>>>>>> origin/main
    return true
  } catch (error) {
    console.error('Error creating ledger entry:', error)
    return false
  }
}

<<<<<<< HEAD
async function createPurchaseVoucherChain(purchaseData) {
  await ensureVoucherTables()

  const {
    supplier,
    date,
    invNo,
    purchaseId,
    baseAmount = 0,
    taxAmount = 0,
    discAmount = 0,
    netAmount = 0,
    narration = '',
    deductions = [],
  } = purchaseData

  if (purchaseId) {
    await deletePurchaseVoucherChain(purchaseId)
  }

  const resolvedSupplier = await getPartyName(supplier, 'supplier')

  const voucherDate = date || new Date().toISOString().slice(0, 10)
  const voucherNo = await getNextVoucherNumber('Purchase')

  const voucherResult = await db.run(`
    INSERT INTO voucher (voucher_type, voucher_no, date, reference_no, narration)
    VALUES (?, ?, ?, ?, ?)
  `, ['Purchase', voucherNo, voucherDate, String(purchaseId || ''), narration || `Purchase ${invNo || purchaseId}`])
  const voucherId = voucherResult.lastInsertRowid

  const ledgerEntries = []
  const particulars = `Purchase Invoice #${invNo || purchaseId}`


  const voucherEntryRows = []

  if (resolvedSupplier) {

    voucherEntryRows.push({
      ledgerName: resolvedSupplier,
      debit: 0,
      credit: Number(netAmount || 0),
      remarks: particulars,
    })
    ledgerEntries.push(
      createLedgerEntry({
        ledgerName: resolvedSupplier,
        date: voucherDate,
        voucherType: 'Purchase',
        voucherNo,
        debit: 0,
        credit: Number(netAmount || 0),
        referenceId: purchaseId,
        referenceType: 'purchase',
        particulars,
        voucherId,
        transactionId: purchaseId,
        transactionType: 'purchase',
        ledgerType: 'Supplier',
      })
    )
  }

  if (Number(baseAmount || 0) > 0) {
    voucherEntryRows.push({
      ledgerName: 'Purchase Account',
      debit: Number(baseAmount || 0),
      credit: 0,
      remarks: particulars,
    })
    ledgerEntries.push(
      createLedgerEntry({
        ledgerName: 'Purchase Account',
        date: voucherDate,
        voucherType: 'Purchase',
        voucherNo,
        debit: Number(baseAmount || 0),
        credit: 0,
        referenceId: purchaseId,
        referenceType: 'purchase',
        particulars,
        voucherId,
        transactionId: purchaseId,
        transactionType: 'purchase',
      })
    )
  }

  // Enhanced GST tax posting (CGST/SGST/IGST split or aggregate)
  const cgst = Number(purchaseData.cgstAmount || 0);
  const sgst = Number(purchaseData.sgstAmount || 0);
  const igst = Number(purchaseData.igstAmount || 0);

  if (cgst > 0 || sgst > 0 || igst > 0) {
    if (cgst > 0) {
      voucherEntryRows.push({ ledgerName: 'Input CGST', debit: cgst, credit: 0, remarks: `CGST on ${particulars}` });
      ledgerEntries.push(createLedgerEntry({ ledgerName: 'Input CGST', date: voucherDate, voucherType: 'Purchase', voucherNo, debit: cgst, credit: 0, referenceId: purchaseId, referenceType: 'purchase', particulars: `CGST on ${particulars}`, voucherId, transactionId: purchaseId, transactionType: 'purchase' }));
    }
    if (sgst > 0) {
      voucherEntryRows.push({ ledgerName: 'Input SGST', debit: sgst, credit: 0, remarks: `SGST on ${particulars}` });
      ledgerEntries.push(createLedgerEntry({ ledgerName: 'Input SGST', date: voucherDate, voucherType: 'Purchase', voucherNo, debit: sgst, credit: 0, referenceId: purchaseId, referenceType: 'purchase', particulars: `SGST on ${particulars}`, voucherId, transactionId: purchaseId, transactionType: 'purchase' }));
    }
    if (igst > 0) {
      voucherEntryRows.push({ ledgerName: 'Input IGST', debit: igst, credit: 0, remarks: `IGST on ${particulars}` });
      ledgerEntries.push(createLedgerEntry({ ledgerName: 'Input IGST', date: voucherDate, voucherType: 'Purchase', voucherNo, debit: igst, credit: 0, referenceId: purchaseId, referenceType: 'purchase', particulars: `IGST on ${particulars}`, voucherId, transactionId: purchaseId, transactionType: 'purchase' }));
    }
  } else if (Number(taxAmount || 0) > 0) {
    voucherEntryRows.push({
      ledgerName: 'Input Tax',
      debit: Number(taxAmount || 0),
      credit: 0,
      remarks: `Tax on ${particulars}`,
    })
    ledgerEntries.push(
      createLedgerEntry({
        ledgerName: 'Input Tax',
        date: voucherDate,
        voucherType: 'Purchase',
        voucherNo,
        debit: Number(taxAmount || 0),
        credit: 0,
        referenceId: purchaseId,
        referenceType: 'purchase',
        particulars: `Tax on ${particulars}`,
        voucherId,
        transactionId: purchaseId,
        transactionType: 'purchase',
      })
    )
  }

  if (Number(discAmount || 0) > 0) {
    voucherEntryRows.push({
      ledgerName: 'Discount Received',
      debit: 0,
      credit: Number(discAmount || 0),
      remarks: `Discount on ${particulars}`,
    })
    ledgerEntries.push(
      createLedgerEntry({
        ledgerName: 'Discount Received',
        date: voucherDate,
        voucherType: 'Purchase',
        voucherNo,
        debit: 0,
        credit: Number(discAmount || 0),
        referenceId: purchaseId,
        referenceType: 'purchase',
        particulars: `Discount on ${particulars}`,
        voucherId,
        transactionId: purchaseId,
        transactionType: 'purchase',
      })
    )
  }

  if (deductions && deductions.length > 0) {
    for (const d of deductions) {
      const dAmount = Number(d.amount || 0);
      if (dAmount > 0) {
        const dName = d.deduction_name || d.name || 'Purchase Deduction';
        const isLess = !d.type || String(d.type).toUpperCase() === 'LESS';
        
        const debit = isLess ? 0 : dAmount;
        const credit = isLess ? dAmount : 0;
        
        voucherEntryRows.push({
          ledgerName: dName,
          debit: debit,
          credit: credit,
          remarks: `${dName} on ${particulars}`,
        });
        
        ledgerEntries.push(
          createLedgerEntry({
            ledgerName: dName,
            date: voucherDate,
            voucherType: 'Purchase',
            voucherNo,
            debit: debit,
            credit: credit,
            referenceId: purchaseId,
            referenceType: 'purchase',
            particulars: `${dName} on ${particulars}`,
            voucherId,
            transactionId: purchaseId,
            transactionType: 'purchase',
          })
        );
      }
    }
  }

  for (const entry of voucherEntryRows) {
    const ledgerId = await resolveLedgerId(entry.ledgerName)
    try {
      await db.run(`
        INSERT INTO voucher_entry (voucher_id, type, ledger_id, ledger_name, debit, credit, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [voucherId, 'Ledger', ledgerId, entry.ledgerName, entry.debit || 0, entry.credit || 0, entry.remarks || ''])
    } catch (error) {
      const message = String(error.message || '')
      if (message.includes('no such column: ledger_name') || message.includes('table voucher_entry has no column named ledger_name')) {
        await db.run(`
          INSERT INTO voucher_entry (voucher_id, type, ledger_id, debit, credit, remarks)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [voucherId, 'Ledger', ledgerId ?? 0, entry.debit || 0, entry.credit || 0, entry.remarks || ''])
      } else if (message.includes('NOT NULL constraint failed: voucher_entry.ledger_id')) {
        await db.run(`
          INSERT INTO voucher_entry (voucher_id, type, ledger_id, debit, credit, remarks)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [voucherId, 'Ledger', ledgerId ?? 0, entry.debit || 0, entry.credit || 0, entry.remarks || ''])
      } else {
        throw error
      }
    }
  }

  await Promise.all(ledgerEntries)

  return { voucherId, voucherNo, voucherType: 'Purchase' }
}

/**
 * Create purchase ledger entries.
=======
/**
 * Create purchase ledger entries
>>>>>>> origin/main
 * Creates entries for:
 * - Supplier (Credit) - Net amount
 * - Purchase Account (Debit) - Base amount
 * - Tax/Ledger (Debit) - Tax amount
 * - Discount (Credit) - Discount amount
 */
async function createPurchaseLedgerEntries(purchaseData) {
<<<<<<< HEAD
  return createPurchaseVoucherChain(purchaseData)
}

/**
 * Create sales voucher chain and ledger entries
=======
  const { 
    supplier, 
    date, 
    invNo, 
    purchaseId, 
    baseAmount = 0, 
    taxAmount = 0, 
    discAmount = 0, 
    netAmount = 0 
  } = purchaseData

  const voucherNo = await getNextVoucherNumber('PUR')
  
  try {
    // Supplier Account - Credit (Payable)
    await createLedgerEntry({
      ledgerName: supplier,
      date,
      voucherType: 'Purchase',
      voucherNo,
      debit: 0,
      credit: netAmount,
      referenceId: purchaseId,
      particulars: `Purchase Inv: ${invNo}`
    })

    // Purchase Account - Debit
    if (baseAmount > 0) {
      await createLedgerEntry({
        ledgerName: 'Purchase Account',
        date,
        voucherType: 'Purchase',
        voucherNo,
        debit: baseAmount,
        credit: 0,
        referenceId: purchaseId,
        particulars: `Purchase Inv: ${invNo}`
      })
    }

    // Tax Account - Debit
    if (taxAmount > 0) {
      await createLedgerEntry({
        ledgerName: 'Input Tax',
        date,
        voucherType: 'Purchase',
        voucherNo,
        debit: taxAmount,
        credit: 0,
        referenceId: purchaseId,
        particulars: `Tax on Purchase Inv: ${invNo}`
      })
    }

    // Discount Received - Credit
    if (discAmount > 0) {
      await createLedgerEntry({
        ledgerName: 'Discount Received',
        date,
        voucherType: 'Purchase',
        voucherNo,
        debit: 0,
        credit: discAmount,
        referenceId: purchaseId,
        particulars: `Discount on Purchase Inv: ${invNo}`
      })
    }

    return true
  } catch (error) {
    console.error('Error creating purchase ledger entries:', error)
    return false
  }
}

/**
 * Create sales ledger entries
>>>>>>> origin/main
 * Creates entries for:
 * - Customer (Debit) - Receivable
 * - Sales Account (Credit) - Revenue
 * - Tax (Credit) - Output tax
 */
<<<<<<< HEAD
async function createSalesVoucherChain(salesData) {
  await ensureVoucherTables()

  const {
    customer,
    date,
    invNo,
    salesId,
    totalAmount = 0,
    taxAmount = 0,
    discAmount = 0,
    baseAmount = 0,
    deductions = []
  } = salesData

  if (salesId) {
    await deleteSalesVoucherChain(salesId)
  }

  const resolvedCustomer = await getPartyName(customer, 'customer')

  const voucherDate = date || new Date().toISOString().slice(0, 10)
  const voucherNo = await getNextVoucherNumber('Sales')

  // Support baseAmount if not explicitly passed
  const resolvedBaseAmount = baseAmount || (totalAmount - taxAmount + discAmount)

  const voucherResult = await db.run(`
    INSERT INTO voucher (voucher_type, voucher_no, date, reference_no, narration)
    VALUES (?, ?, ?, ?, ?)
  `, ['Sales', voucherNo, voucherDate, String(salesId || ''), `Sales Invoice #${invNo || salesId}`])
  const voucherId = voucherResult.lastInsertRowid

  const ledgerEntries = []
  const particulars = `Sales Invoice #${invNo || salesId}`
  const voucherEntryRows = []

  // Customer Debit (A/C Receivable)
  if (resolvedCustomer) {
    voucherEntryRows.push({
      ledgerName: resolvedCustomer,
      debit: Number(totalAmount || 0),
      credit: 0,
      remarks: particulars,
    })
    ledgerEntries.push(
      createLedgerEntry({
        ledgerName: resolvedCustomer,
        date: voucherDate,
        voucherType: 'Sales',
        voucherNo,
        debit: Number(totalAmount || 0),
        credit: 0,
        referenceId: salesId,
        referenceType: 'sales',
        particulars,
        voucherId,
        transactionId: salesId,
        transactionType: 'sales',
        ledgerType: 'Customer',
      })
    )
  }

  // Sales Credit (Revenue Account)
  if (Number(resolvedBaseAmount || 0) > 0) {
    voucherEntryRows.push({
      ledgerName: 'Sales Account',
      debit: 0,
      credit: Number(resolvedBaseAmount || 0),
      remarks: particulars,
    })
    ledgerEntries.push(
      createLedgerEntry({
        ledgerName: 'Sales Account',
        date: voucherDate,
        voucherType: 'Sales',
        voucherNo,
        debit: 0,
        credit: Number(resolvedBaseAmount || 0),
        referenceId: salesId,
        referenceType: 'sales',
        particulars,
        voucherId,
        transactionId: salesId,
        transactionType: 'sales',
      })
    )
  }

  // Output Tax Credit (CGST/SGST/IGST split or aggregate)
  const cgst = Number(salesData.cgstAmount || 0);
  const sgst = Number(salesData.sgstAmount || 0);
  const igst = Number(salesData.igstAmount || 0);

  if (cgst > 0 || sgst > 0 || igst > 0) {
    if (cgst > 0) {
      voucherEntryRows.push({ ledgerName: 'Output CGST', debit: 0, credit: cgst, remarks: `CGST on ${particulars}` });
      ledgerEntries.push(createLedgerEntry({ ledgerName: 'Output CGST', date: voucherDate, voucherType: 'Sales', voucherNo, debit: 0, credit: cgst, referenceId: salesId, referenceType: 'sales', particulars: `CGST on ${particulars}`, voucherId, transactionId: salesId, transactionType: 'sales' }));
    }
    if (sgst > 0) {
      voucherEntryRows.push({ ledgerName: 'Output SGST', debit: 0, credit: sgst, remarks: `SGST on ${particulars}` });
      ledgerEntries.push(createLedgerEntry({ ledgerName: 'Output SGST', date: voucherDate, voucherType: 'Sales', voucherNo, debit: 0, credit: sgst, referenceId: salesId, referenceType: 'sales', particulars: `SGST on ${particulars}`, voucherId, transactionId: salesId, transactionType: 'sales' }));
    }
    if (igst > 0) {
      voucherEntryRows.push({ ledgerName: 'Output IGST', debit: 0, credit: igst, remarks: `IGST on ${particulars}` });
      ledgerEntries.push(createLedgerEntry({ ledgerName: 'Output IGST', date: voucherDate, voucherType: 'Sales', voucherNo, debit: 0, credit: igst, referenceId: salesId, referenceType: 'sales', particulars: `IGST on ${particulars}`, voucherId, transactionId: salesId, transactionType: 'sales' }));
    }
  } else if (Number(taxAmount || 0) > 0) {
    voucherEntryRows.push({
      ledgerName: 'Output Tax',
      debit: 0,
      credit: Number(taxAmount || 0),
      remarks: `Tax on ${particulars}`,
    })
    ledgerEntries.push(
      createLedgerEntry({
        ledgerName: 'Output Tax',
        date: voucherDate,
        voucherType: 'Sales',
        voucherNo,
        debit: 0,
        credit: Number(taxAmount || 0),
        referenceId: salesId,
        referenceType: 'sales',
        particulars: `Tax on ${particulars}`,
        voucherId,
        transactionId: salesId,
        transactionType: 'sales',
      })
    )
  }

  // Discount Debit
  if (Number(discAmount || 0) > 0) {
    voucherEntryRows.push({
      ledgerName: 'Discount Allowed',
      debit: Number(discAmount || 0),
      credit: 0,
      remarks: `Discount on ${particulars}`,
    })
    ledgerEntries.push(
      createLedgerEntry({
        ledgerName: 'Discount Allowed',
        date: voucherDate,
        voucherType: 'Sales',
        voucherNo,
        debit: Number(discAmount || 0),
        credit: 0,
        referenceId: salesId,
        referenceType: 'sales',
        particulars: `Discount on ${particulars}`,
        voucherId,
        transactionId: salesId,
        transactionType: 'sales',
      })
    )
  }

  // Deductions processing
  if (deductions && deductions.length > 0) {
    for (const d of deductions) {
      const dAmount = Number(d.amount || d.deduction_amount || 0);
      if (dAmount > 0) {
        const dName = d.deduction_name || d.name || d.deduction || 'Sales Deduction';
        const isLess = d.type === undefined || String(d.type).toUpperCase() === 'LESS';
        
        const debit = isLess ? dAmount : 0;
        const credit = isLess ? 0 : dAmount;
        
        voucherEntryRows.push({
          ledgerName: dName,
          debit: debit,
          credit: credit,
          remarks: `${dName} on ${particulars}`,
        });
        
        ledgerEntries.push(
          createLedgerEntry({
            ledgerName: dName,
            date: voucherDate,
            voucherType: 'Sales',
            voucherNo,
            debit: debit,
            credit: credit,
            referenceId: salesId,
            referenceType: 'sales',
            particulars: `${dName} on ${particulars}`,
            voucherId,
            transactionId: salesId,
            transactionType: 'sales',
          })
        );
      }
    }
  }

  for (const entry of voucherEntryRows) {
    const ledgerId = await resolveLedgerId(entry.ledgerName)
    try {
      await db.run(`
        INSERT INTO voucher_entry (voucher_id, type, ledger_id, ledger_name, debit, credit, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [voucherId, 'Ledger', ledgerId, entry.ledgerName, entry.debit || 0, entry.credit || 0, entry.remarks || ''])
    } catch (error) {
      const message = String(error.message || '')
      if (message.includes('no such column: ledger_name') || message.includes('table voucher_entry has no column named ledger_name')) {
        await db.run(`
          INSERT INTO voucher_entry (voucher_id, type, ledger_id, debit, credit, remarks)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [voucherId, 'Ledger', ledgerId ?? 0, entry.debit || 0, entry.credit || 0, entry.remarks || ''])
      } else {
        console.error('Error inserting sales voucher entry:', error)
      }
    }
  }

  await Promise.all(ledgerEntries)
  return true
}

async function createSalesLedgerEntries(salesData) {
  return createSalesVoucherChain(salesData)
=======
async function createSalesLedgerEntries(salesData) {
  const { 
    customer, 
    date, 
    invNo, 
    salesId, 
    totalAmount = 0, 
    taxAmount = 0, 
    discAmount = 0 
  } = salesData

  const voucherNo = await getNextVoucherNumber('SAL')
  
  try {
    // Customer Account - Debit (Receivable)
    await createLedgerEntry({
      ledgerName: customer,
      date,
      voucherType: 'Sales',
      voucherNo,
      debit: totalAmount,
      credit: 0,
      referenceId: salesId,
      particulars: `Sales Inv: ${invNo}`
    })

    // Sales Account - Credit
    const salesAmount = totalAmount - taxAmount
    if (salesAmount > 0) {
      await createLedgerEntry({
        ledgerName: 'Sales Account',
        date,
        voucherType: 'Sales',
        voucherNo,
        debit: 0,
        credit: salesAmount,
        referenceId: salesId,
        particulars: `Sales Inv: ${invNo}`
      })
    }

    // Output Tax - Credit
    if (taxAmount > 0) {
      await createLedgerEntry({
        ledgerName: 'Output Tax',
        date,
        voucherType: 'Sales',
        voucherNo,
        debit: 0,
        credit: taxAmount,
        referenceId: salesId,
        particulars: `Tax on Sales Inv: ${invNo}`
      })
    }

    // Discount Allowed - Debit
    if (discAmount > 0) {
      await createLedgerEntry({
        ledgerName: 'Discount Allowed',
        date,
        voucherType: 'Sales',
        voucherNo,
        debit: discAmount,
        credit: 0,
        referenceId: salesId,
        particulars: `Discount on Sales Inv: ${invNo}`
      })
    }

    return true
  } catch (error) {
    console.error('Error creating sales ledger entries:', error)
    return false
  }
>>>>>>> origin/main
}

/**
 * Create advance payment ledger entries
 */
async function createAdvanceLedgerEntries(advanceData) {
<<<<<<< HEAD
  const {
    papadCompany,
    date,
    sNo,
    advanceId,
    amount = 0,
  } = advanceData

  const resolvedPapadCompany = await getPartyName(papadCompany, 'papad_company')

  const voucherNo = await getNextVoucherNumber('Advance')

  try {
=======
  const { 
    papadCompany, 
    date, 
    sNo, 
    advanceId, 
    amount = 0 
  } = advanceData

  const voucherNo = await getNextVoucherNumber('ADV')
  
  try {
    // Cash/Bank - Credit (money going out)
>>>>>>> origin/main
    await createLedgerEntry({
      ledgerName: 'Cash',
      date,
      voucherType: 'Advance',
      voucherNo,
      debit: 0,
      credit: amount,
      referenceId: advanceId,
<<<<<<< HEAD
      referenceType: 'advance',
      particulars: `Advance to: ${resolvedPapadCompany}, Ref: ${sNo}`,
    })

    await createLedgerEntry({
      ledgerName: resolvedPapadCompany,
=======
      particulars: `Advance to: ${papadCompany}, Ref: ${sNo}`
    })

    // Advance to Party - Debit
    await createLedgerEntry({
      ledgerName: papadCompany,
>>>>>>> origin/main
      date,
      voucherType: 'Advance',
      voucherNo,
      debit: amount,
      credit: 0,
      referenceId: advanceId,
<<<<<<< HEAD
      referenceType: 'advance',
      particulars: `Advance Given, Ref: ${sNo}`,
=======
      particulars: `Advance Given, Ref: ${sNo}`
>>>>>>> origin/main
    })

    return true
  } catch (error) {
    console.error('Error creating advance ledger entries:', error)
    return false
  }
}

<<<<<<< HEAD
async function deletePurchaseVoucherChain(referenceId) {
  try {
    const voucherRows = await db.query(
      'SELECT id, voucher_no FROM voucher WHERE reference_no = ? AND voucher_type = ?',
      [String(referenceId), 'Purchase']
    )

    for (const voucher of voucherRows.rows || []) {
      await db.run('DELETE FROM voucher_entry WHERE voucher_id = ?', [voucher.id])
      await db.run('DELETE FROM ledger_entries WHERE voucher_id = ? OR (reference_id = ? AND voucher_type = ? AND voucher_no = ?)', [
        voucher.id,
        referenceId,
        'Purchase',
        voucher.voucher_no,
      ])
      await db.run('DELETE FROM voucher WHERE id = ?', [voucher.id])
    }

    return true
  } catch (error) {
    console.error('Error deleting purchase voucher chain:', error)
    return false
  }
}

async function deleteSalesVoucherChain(referenceId) {
  try {
    const voucherRows = await db.query(
      'SELECT id, voucher_no FROM voucher WHERE reference_no = ? AND voucher_type = ?',
      [String(referenceId), 'Sales']
    )

    for (const voucher of voucherRows.rows || []) {
      await db.run('DELETE FROM voucher_entry WHERE voucher_id = ?', [voucher.id])
      await db.run('DELETE FROM ledger_entries WHERE voucher_id = ? OR (reference_id = ? AND voucher_type = ? AND voucher_no = ?)', [
        voucher.id,
        referenceId,
        'Sales',
        voucher.voucher_no,
      ])
      await db.run('DELETE FROM voucher WHERE id = ?', [voucher.id])
    }

    return true
  } catch (error) {
    console.error('Error deleting sales voucher chain:', error)
    return false
  }
}

/**
 * Delete ledger entries for a reference.
 */
async function deleteLedgerEntries(referenceId) {
  try {
    await deletePurchaseVoucherChain(referenceId)
    await deleteSalesVoucherChain(referenceId)
=======
/**
 * Delete ledger entries for a reference
 */
async function deleteLedgerEntries(referenceId) {
  try {
>>>>>>> origin/main
    await db.run('DELETE FROM ledger_entries WHERE reference_id = ?', [referenceId])
    return true
  } catch (error) {
    console.error('Error deleting ledger entries:', error)
    return false
  }
}

<<<<<<< HEAD
async function syncAllLedgers() {
  await ensureVoucherTables()

  console.log('--- STARTING LEDGER SYNCHRONIZATION ---')
  try {
    // 1. Disable foreign key constraints temporarily
    await db.run('PRAGMA foreign_keys = OFF')

    // 2. Clear current voucher & ledger_entries tables
    await db.run('DELETE FROM ledger_entries')
    await db.run('DELETE FROM voucher_entry')
    await db.run('DELETE FROM voucher')

    // Reset sqlite sequence
    try {
      await db.run("UPDATE sqlite_sequence SET seq = 0 WHERE name IN ('ledger_entries', 'voucher_entry', 'voucher')")
    } catch (e) {}

    // 3. Rebuild Sales ledgers
    const sales = await db.query('SELECT * FROM sales')
    console.log(`Rebuilding ledger entries for ${sales.rows?.length || 0} sales...`)
    for (const sale of sales.rows || []) {
      try {
        await createSalesVoucherChain({
          customer: sale.customer_id || sale.customer,
          date: sale.date,
          invNo: sale.s_no,
          salesId: sale.id,
          totalAmount: sale.total_amt || sale.grand_total,
          taxAmount: sale.tax_amt || 0,
          discAmount: 0,
          baseAmount: sale.bill_amt || sale.total_amt,
        })
      } catch (err) {
        console.error(`Error syncing sale #${sale.id}:`, err)
      }
    }

    // 4. Rebuild Purchase ledgers
    const purchases = await db.query('SELECT * FROM purchases')
    console.log(`Rebuilding ledger entries for ${purchases.rows?.length || 0} purchases...`)
    for (const pur of purchases.rows || []) {
      try {
        await createPurchaseVoucherChain({
          supplier: pur.supplier_id || pur.supplier,
          date: pur.date,
          invNo: pur.s_no,
          purchaseId: pur.id,
          totalAmount: pur.total_amt || pur.grand_total,
          baseAmount: pur.bill_amt || pur.total_amt,
          taxAmount: pur.tax_amt || 0,
          discAmount: 0,
          netAmount: pur.total_amt || pur.grand_total,
        })
      } catch (err) {
        console.error(`Error syncing purchase #${pur.id}:`, err)
      }
    }

    // 5. Rebuild Advances ledgers
    const advances = await db.query('SELECT * FROM advances')
    console.log(`Rebuilding ledger entries for ${advances.rows?.length || 0} advances...`)
    for (const adv of advances.rows || []) {
      try {
        await createAdvanceLedgerEntries({
          papadCompany: adv.papad_company_id || adv.papad_company,
          date: adv.date,
          sNo: adv.s_no,
          advanceId: adv.id,
          amount: adv.amount || 0,
        })
      } catch (err) {
        console.error(`Error syncing advance #${adv.id}:`, err)
      }
    }

    console.log('--- LEDGER SYNCHRONIZATION COMPLETED SUCCESSFULLY ---')
  } catch (error) {
    console.error('CRITICAL: Ledger synchronization failed:', error)
  } finally {
    // Re-enable foreign key constraints
    await db.run('PRAGMA foreign_keys = ON')
  }
}

=======
>>>>>>> origin/main
module.exports = {
  getNextVoucherNumber,
  createLedgerEntry,
  createPurchaseLedgerEntries,
<<<<<<< HEAD
  createPurchaseVoucherChain,
  createSalesLedgerEntries,
  createAdvanceLedgerEntries,
  deleteLedgerEntries,
  deletePurchaseVoucherChain,
  resolveLedgerId,
  ensureVoucherTables,
  syncAllLedgers,
=======
  createSalesLedgerEntries,
  createAdvanceLedgerEntries,
  deleteLedgerEntries
>>>>>>> origin/main
}
