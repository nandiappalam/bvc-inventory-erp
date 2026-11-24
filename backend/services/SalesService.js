const db = require('../config/database');
const recycleBinService = require('./RecycleBinService');
const {
  createSalesVoucherChain,
  createSalesReceiptVoucher,
  createSalesFreightVoucher,
  deleteSalesVoucherChain,
  sanitizeDate
} = require('../utils/ledgerHelper');
const { syncDocumentMovements, deleteDocumentMovements } = require('./SourceMovementSync');
const { ensureMovementPassesSchema } = require('../utils/movementPassesSchema');
const { resolveCustomerName } = require('../utils/customerResolver');
const { resolveFinancialYear, deriveIndianFyFromDate } = require('./FinancialYearResolver');
const AccountingEngine = require('./AccountingEngine');

const STATE_CODE_MAP = {
  'tamil nadu': '33',
  tamilnadu: '33',
  tn: '33',
  karnataka: '29',
  ka: '29',
  kerala: '32',
  kl: '32',
  'andhra pradesh': '37',
  ap: '37',
  telangana: '36',
  ts: '36',
  maharashtra: '27',
  mh: '27',
  gujarat: '24',
  gj: '24',
  delhi: '07',
  dl: '07',
  'west bengal': '19',
  wb: '19',
  rajasthan: '08',
  rj: '08',
  'madhya pradesh': '23',
  mp: '23',
  'uttar pradesh': '09',
  up: '09',
  punjab: '03',
  pb: '03',
  haryana: '06',
  hr: '06',
  bihar: '10',
  br: '10',
  odisha: '21',
  orissa: '21',
  assam: '18'
};

const _ensuredSalesCompanies = new Set();

function round2(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function round3(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

function normalizeStateCode(val, fallback = '33') {
  if (!val) return fallback;
  const s = String(val).trim().toLowerCase();
  if (/^\d{2}$/.test(s)) return s;
  return STATE_CODE_MAP[s] || fallback;
}

function computeIsInterstate({ companyState, companyStateCode, partyState, partyStateCode, placeOfSupply, gstin }) {
  const cCode = normalizeStateCode(companyStateCode || companyState, '33');
  let pCode = '';
  if (partyStateCode && /^\d{2}$/.test(String(partyStateCode).trim())) {
    pCode = String(partyStateCode).trim();
  } else if (gstin && /^\d{2}/.test(String(gstin).trim())) {
    pCode = String(gstin).trim().slice(0, 2);
  } else if (partyState) {
    pCode = normalizeStateCode(partyState, '');
  } else if (placeOfSupply) {
    const posStr = String(placeOfSupply).trim();
    const m = posStr.match(/(\d{2})/);
    if (m) pCode = m[1];
    else pCode = normalizeStateCode(posStr, '');
  }
  if (!pCode) return false;
  return String(cCode) !== String(pCode);
}

function addDaysToIso(dateStr, days) {
  const base = sanitizeDate(dateStr) || new Date().toISOString().slice(0, 10);
  const d = new Date(`${base}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return base;
  d.setUTCDate(d.getUTCDate() + (parseInt(days, 10) || 0));
  return d.toISOString().slice(0, 10);
}

function parseTermsDays(terms) {
  const s = String(terms || '').toLowerCase();
  if (s.includes('immediate') || s.includes('cash') || s === '0') return 0;
  const m = s.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function normalizeSalesDeductions(rawSelected, formData = {}) {
  let list = [];
  if (Array.isArray(rawSelected)) {
    list = rawSelected;
  } else if (typeof rawSelected === 'string' && rawSelected.trim()) {
    try {
      const parsed = JSON.parse(rawSelected);
      if (Array.isArray(parsed)) list = parsed;
    } catch (_) {}
  }

  const normalized = list
    .map((d) => {
      const amt = parseFloat(d?.amount || d?.deduction_amount || 0);
      if (!(amt > 0)) return null;
      const rawType = String(d?.type || d?.ded_type || d?.deduction_type || '').trim().toUpperCase();
      const isAdd = rawType === 'ADD' || rawType === '+' || rawType === 'ADDITION' || rawType === 'PLUS';
      return {
        deduction_id: d?.deduction_id || d?.id || null,
        name: (d?.deduction_name || d?.name || d?.deduction || '').trim() || (isAdd ? 'Other Charges' : 'Sales Deduction'),
        type: isAdd ? 'ADD' : 'LESS',
        percent: d?.percent !== undefined && d?.percent !== null && d?.percent !== '' ? Number(d.percent) : '',
        amount: round2(amt),
        remarks: d?.remarks || ''
      };
    })
    .filter(Boolean);

  const customManualDed = parseFloat(formData.deduction) || 0;
  if (customManualDed > 0) {
    normalized.push({
      name: 'Manual Deduction',
      type: 'LESS',
      amount: round2(customManualDed),
      remarks: formData.deduction_remarks || ''
    });
  } else if (normalized.length === 0 && formData.deduction_amount) {
    const rawDedAmt = parseFloat(formData.deduction_amount) || 0;
    if (rawDedAmt !== 0) {
      const isAdd = rawDedAmt < 0;
      normalized.push({
        name: (formData.deduction && isNaN(Number(formData.deduction)))
          ? String(formData.deduction).trim()
          : (isAdd ? 'Other Charges' : 'Sales Deduction'),
        type: isAdd ? 'ADD' : 'LESS',
        amount: round2(Math.abs(rawDedAmt)),
        remarks: formData.deduction_remarks || ''
      });
    }
  }
  return normalized;
}

async function getTableColumns(runner, tableName) {
  try {
    const res = await runner.query(`PRAGMA table_info("${tableName}")`);
    return new Set((res.rows || []).map((r) => String(r.name || '').toLowerCase()));
  } catch (_) {
    return new Set();
  }
}

async function ensureColumns(runner, tableName, colDefs) {
  const existing = await getTableColumns(runner, tableName);
  for (const [colName, colDef] of colDefs) {
    if (!existing.has(colName.toLowerCase())) {
      try {
        await runner.run(`ALTER TABLE "${tableName}" ADD COLUMN ${colName} ${colDef}`);
        existing.add(colName.toLowerCase());
      } catch (err) {
        const msg = String(err?.message || '').toLowerCase();
        if (!msg.includes('duplicate') && !msg.includes('already exists')) {
          console.warn(`[SalesService] ALTER ${tableName}.${colName}:`, err.message);
        }
      }
    }
  }
}

async function ensureSalesSchema(companyId = 1) {
  const cId = parseInt(companyId, 10) || 1;
  const runner = db.forCompany(cId);

  await ensureMovementPassesSchema(cId);

  await ensureColumns(runner, 'sales', [
    ['is_order', 'INTEGER DEFAULT 0'],
    ['voucher_no', 'TEXT'],
    ['deductions_json', 'TEXT'],
    ['customer_code', 'TEXT'],
    ['customer_type', 'TEXT'],
    ['customer_gstin', 'TEXT'],
    ['billing_address', 'TEXT'],
    ['shipping_address', 'TEXT'],
    ['contact_person', 'TEXT'],
    ['email', 'TEXT'],
    ['credit_limit', 'REAL DEFAULT 0'],
    ['customer_outstanding', 'REAL DEFAULT 0'],
    ['financial_year', 'TEXT'],
    ['sales_category', "TEXT DEFAULT 'Domestic'"],
    ['sales_order_ref', 'TEXT'],
    ['sales_order_id', 'INTEGER'],
    ['customer_po_no', 'TEXT'],
    ['payment_terms', 'TEXT'],
    ['due_date', 'TEXT'],
    ['delivery_date', 'TEXT'],
    ['sales_person', 'TEXT'],
    ['place_of_supply', 'TEXT'],
    ['stock_type', "TEXT DEFAULT 'FG'"],
    ['pack_type', "TEXT DEFAULT 'Pack'"],
    ['company_state', 'TEXT'],
    ['party_state', 'TEXT'],
    ['company_state_code', 'TEXT'],
    ['party_state_code', 'TEXT'],
    ['tax_mode', 'TEXT'],
    ['tax_percent', 'REAL DEFAULT 5'],
    ['cgst_amt', 'REAL DEFAULT 0'],
    ['sgst_amt', 'REAL DEFAULT 0'],
    ['igst_amt', 'REAL DEFAULT 0'],
    ['cgst_amount', 'REAL DEFAULT 0'],
    ['sgst_amount', 'REAL DEFAULT 0'],
    ['igst_amount', 'REAL DEFAULT 0'],
    ['gross_amt', 'REAL DEFAULT 0'],
    ['disc_percent', 'REAL DEFAULT 0'],
    ['disc_amount', 'REAL DEFAULT 0'],
    ['weighment_mode', "TEXT DEFAULT 'Manual Weighment'"],
    ['vehicle_gross_weight', 'REAL DEFAULT 0'],
    ['vehicle_tare_weight', 'REAL DEFAULT 0'],
    ['net_load_weight', 'REAL DEFAULT 0'],
    ['package_tare_weight', 'REAL DEFAULT 0'],
    ['product_net_weight', 'REAL DEFAULT 0'],
    ['weighment_date', 'TEXT'],
    ['weighment_time', 'TEXT'],
    ['weighbridge_name', 'TEXT'],
    ['weighment_slip_no', 'TEXT'],
    ['weighed_by', 'TEXT'],
    ['auto_outpass', 'INTEGER DEFAULT 1'],
    ['outpass_id', 'INTEGER'],
    ['outpass_no', 'TEXT'],
    ['outpass_status', 'TEXT'],
    ['loading_location', 'TEXT'],
    ['delivery_location', 'TEXT'],
    ['godown_from_name', 'TEXT'],
    ['transport_mode', "TEXT DEFAULT 'Third Party'"],
    ['transporter_id', 'INTEGER'],
    ['transporter_gstin', 'TEXT'],
    ['vehicle_type', 'TEXT'],
    ['driver_mobile', 'TEXT'],
    ['lr_no', 'TEXT'],
    ['lr_date', 'TEXT'],
    ['expected_delivery_date', 'TEXT'],
    ['actual_delivery_date', 'TEXT'],
    ['loadman_name', 'TEXT'],
    ['loadman_worker_id', 'INTEGER'],
    ['loadman_rate_per_kg', 'REAL DEFAULT 0.5'],
    ['loadman_charges', 'REAL DEFAULT 0'],
    ['freight_type', "TEXT DEFAULT 'Fixed'"],
    ['freight_rate', 'REAL DEFAULT 0'],
    ['freight_amount', 'REAL DEFAULT 0'],
    ['freight_paid_by', "TEXT DEFAULT 'Buyer'"],
    ['recover_freight_on_invoice', 'INTEGER DEFAULT 0'],
    ['freight_payment_status', "TEXT DEFAULT 'Pending'"],
    ['freight_voucher_no', 'TEXT'],
    ['freight_recovery_amt', 'REAL DEFAULT 0'],
    ['loading_charges_amt', 'REAL DEFAULT 0'],
    ['other_charges', 'REAL DEFAULT 0'],
    ['tcs_amount', 'REAL DEFAULT 0'],
    ['round_off', 'REAL DEFAULT 0'],
    ['payment_mode', "TEXT DEFAULT 'Credit'"],
    ['received_amount', 'REAL DEFAULT 0'],
    ['advance_adjusted', 'REAL DEFAULT 0'],
    ['balance_receivable', 'REAL DEFAULT 0'],
    ['bank_account_id', 'INTEGER'],
    ['bank_account_name', 'TEXT'],
    ['transaction_ref', 'TEXT'],
    ['payment_date', 'TEXT'],
    ['receipt_voucher_no', 'TEXT'],
    ['dispatch_no', 'TEXT'],
    ['dispatch_datetime', 'TEXT'],
    ['dispatch_status', "TEXT DEFAULT 'Invoice Created'"],
    ['delivery_challan_no', 'TEXT'],
    ['eway_bill_no', 'TEXT'],
    ['eway_bill_validity', 'TEXT'],
    ['irn_no', 'TEXT'],
    ['ack_no', 'TEXT'],
    ['received_by', 'TEXT'],
    ['delivery_remarks', 'TEXT'],
    ['sign', 'TEXT']
  ]);

  await ensureColumns(runner, 'sales_items', [
    ['item_id', 'INTEGER'],
    ['product_code', 'TEXT'],
    ['category', 'TEXT'],
    ['parent_rm_lot_no', 'TEXT'],
    ['godown_id', 'INTEGER'],
    ['godown_name', 'TEXT'],
    ['package_type', 'TEXT'],
    ['package_tare_wt', 'REAL DEFAULT 0'],
    ['uom', "TEXT DEFAULT 'KG'"],
    ['rate_type', "TEXT DEFAULT 'Per Kg'"],
    ['allocated_load_wt', 'REAL DEFAULT 0'],
    ['net_product_wt', 'REAL DEFAULT 0'],
    ['disc_amount', 'REAL DEFAULT 0'],
    ['taxable_amount', 'REAL DEFAULT 0'],
    ['tax_amount', 'REAL DEFAULT 0'],
    ['hsn_code', 'TEXT'],
    ['tax_type', 'TEXT'],
    ['gst_rate', 'REAL DEFAULT 0'],
    ['cgst_rate', 'REAL DEFAULT 0'],
    ['cgst_amount', 'REAL DEFAULT 0'],
    ['sgst_rate', 'REAL DEFAULT 0'],
    ['sgst_amount', 'REAL DEFAULT 0'],
    ['igst_rate', 'REAL DEFAULT 0'],
    ['igst_amount', 'REAL DEFAULT 0'],
    ['tax_rate', 'REAL DEFAULT 0'],
    ['disc', 'REAL DEFAULT 0'],
    ['box', 'REAL DEFAULT 0']
  ]);

  await ensureColumns(runner, 'outpasses', [
    ['vehicle_gross_weight', 'REAL DEFAULT 0'],
    ['vehicle_tare_weight', 'REAL DEFAULT 0'],
    ['net_load_weight', 'REAL DEFAULT 0'],
    ['weighment_slip_no', 'TEXT'],
    ['lr_no', 'TEXT'],
    ['lr_date', 'TEXT'],
    ['transport_mode', 'TEXT'],
    ['freight_amount', 'REAL DEFAULT 0'],
    ['freight_paid_by', 'TEXT']
  ]);

  _ensuredSalesCompanies.add(cId);
}

async function getNextOutpassNo(companyId = 1, runnerOverride = null) {
  await ensureSalesSchema(companyId);
  const runner = runnerOverride || db.forCompany(companyId);
  const res = await runner.query(`SELECT outpass_no FROM outpasses ORDER BY id DESC LIMIT 100`);
  let maxNum = 0;
  for (const row of res.rows || []) {
    const m = String(row.outpass_no || '').match(/(\d+)/);
    if (m) {
      const val = parseInt(m[1], 10);
      if (val > maxNum) maxNum = val;
    }
  }
  let candidate = `OP-${String(maxNum + 1).padStart(5, '0')}`;
  // Ensure uniqueness
  for (let i = 0; i < 20; i++) {
    const check = await runner.query(`SELECT id FROM outpasses WHERE outpass_no = ? LIMIT 1`, [candidate]);
    if (!check.rows || check.rows.length === 0) break;
    maxNum += 1;
    candidate = `OP-${String(maxNum + 1).padStart(5, '0')}`;
  }
  return candidate;
}

async function getNextSalesNo(companyId = 1, isOrder = false, runnerOverride = null) {
  const runner = runnerOverride || db.forCompany(companyId);
  const res = await runner.query(
    `SELECT COALESCE(MAX(CAST(NULLIF(s_no, '') AS INTEGER)), 0) AS max_sno FROM sales WHERE COALESCE(is_order, 0) = ?`,
    [isOrder ? 1 : 0]
  );
  return String((parseInt(res.rows?.[0]?.max_sno, 10) || 0) + 1);
}

async function getCompanyProfile(companyId = 1) {
  try {
    const cRes = await db.master.query(
      `SELECT id, name, state, state_code, gst_number, address, phone, email FROM companies WHERE id = ? LIMIT 1`,
      [parseInt(companyId, 10) || 1]
    );
    if (cRes.rows && cRes.rows[0]) {
      const c = cRes.rows[0];
      return {
        ...c,
        gstin: c.gst_number || '',
        state: c.state || 'Tamil Nadu',
        state_code: c.state_code || normalizeStateCode(c.state, '33')
      };
    }
  } catch (_) {}
  return {
    id: parseInt(companyId, 10) || 1,
    name: 'BVC Exports Pvt Ltd',
    state: 'Tamil Nadu',
    state_code: '33',
    gst_number: '',
    gstin: ''
  };
}

async function getFormLookups(companyId = 1) {
  await ensureSalesSchema(companyId);
  const runner = db.forCompany(companyId);

  const [
    company,
    customersRes,
    itemsRes,
    godownsRes,
    transportsRes,
    workersRes,
    weightsRes,
    ledgersRes,
    deductionsRes,
    nextOutpassNo,
    nextSalesNo,
    nextOrderNo
  ] = await Promise.all([
    getCompanyProfile(companyId),
    runner.query(`SELECT id, name, print_name, contact_person, address1, address2, address3, address4, city, state, state_code, gst_number, mobile1, mobile2, phone_off, email, transport, limit_days, limit_amount, opening_balance, balance_type, tax_reg_type, status FROM customer_master WHERE COALESCE(status, 'Active') != 'Inactive' ORDER BY name ASC`),
    runner.query(`SELECT id, item_code, item_name, print_name, item_group, type, tax, hsn_code, weight, unit, tax_type, gst_rate, stock_category, status FROM item_master WHERE COALESCE(status, 'Active') != 'Inactive' ORDER BY item_name ASC`),
    runner.query(`SELECT id, godown_name, print_name, location, godown_type, is_cold_storage, status FROM godown_master WHERE COALESCE(status, 'Active') != 'Inactive' ORDER BY id ASC`),
    runner.query(`SELECT id, name, print_name, status FROM transport_master WHERE COALESCE(status, 'Active') != 'Inactive' ORDER BY name ASC`),
    runner.query(`SELECT * FROM operational_parties ORDER BY id ASC`).catch(() => ({ rows: [] })),
    runner.query(`SELECT * FROM weightmaster ORDER BY id ASC`).catch(() => ({ rows: [] })),
    runner.query(`SELECT id, name, group_name, under, opening_balance, opening_balance_type FROM ledgermaster WHERE LOWER(COALESCE(group_name, under, '')) IN ('cash-in-hand', 'bank accounts', 'bank account', 'cash') AND COALESCE(TRIM(name), '') != '' ORDER BY group_name ASC, name ASC`),
    runner.query(`SELECT * FROM deduction_sales ORDER BY id ASC`).catch(() => ({ rows: [] })),
    getNextOutpassNo(companyId, runner),
    getNextSalesNo(companyId, false, runner),
    getNextSalesNo(companyId, true, runner)
  ]);

  const cashBankLedgers = ledgersRes.rows || [];
  if (!cashBankLedgers.some((l) => String(l.name || '').toLowerCase() === 'cash in hand')) {
    cashBankLedgers.unshift({ id: 'cash', name: 'Cash in Hand', group_name: 'Cash-in-hand' });
  }
  if (!cashBankLedgers.some((l) => String(l.group_name || '').toLowerCase().includes('bank'))) {
    cashBankLedgers.push({ id: 'bank', name: 'Bank Account', group_name: 'Bank Accounts' });
  }

  return {
    company,
    customers: customersRes.rows || [],
    items: itemsRes.rows || [],
    godowns: godownsRes.rows || [],
    transports: transportsRes.rows || [],
    workers: workersRes.rows || [],
    weights: weightsRes.rows || [],
    cashBankLedgers,
    deductions: deductionsRes.rows || [],
    nextOutpassNo,
    nextSalesNo,
    nextOrderNo
  };
}

async function getCustomerContext(companyId = 1, customerKey = '') {
  await ensureSalesSchema(companyId);
  const runner = db.forCompany(companyId);
  const raw = String(customerKey || '').trim();
  if (!raw) return null;

  const custRes = await runner.query(
    `SELECT * FROM customer_master
     WHERE TRIM(CAST(id AS TEXT)) = ?
        OR LOWER(TRIM(COALESCE(name, ''))) = LOWER(TRIM(?))
        OR LOWER(TRIM(COALESCE(print_name, ''))) = LOWER(TRIM(?))
     LIMIT 1`,
    [raw, raw, raw]
  );
  const cust = custRes.rows?.[0] || null;
  if (!cust) return null;

  const nameCandidates = [cust.name, cust.print_name].filter((v) => v && String(v).trim()).map((v) => String(v).trim().toLowerCase());
  let ledgerOutstanding = 0;
  try {
    if (nameCandidates.length > 0) {
      const placeholders = nameCandidates.map(() => '?').join(',');
      const leRes = await runner.query(
        `SELECT COALESCE(SUM(debit), 0) AS dr, COALESCE(SUM(credit), 0) AS cr
         FROM ledger_entries
         WHERE COALESCE(is_reversed, 0) = 0
           AND LOWER(TRIM(ledger_name)) IN (${placeholders})`,
        nameCandidates
      );
      ledgerOutstanding = round2((Number(leRes.rows?.[0]?.dr || 0)) - (Number(leRes.rows?.[0]?.cr || 0)));
    }
  } catch (_) {}

  let openingBal = Number(cust.opening_balance || 0);
  if (String(cust.balance_type || '').toLowerCase() === 'cr') {
    openingBal = -openingBal;
  }
  // Check if ledgermaster already has opening balance reflected via ledger_entries
  const currentOutstanding = round2(ledgerOutstanding + openingBal);
  const creditLimit = Number(cust.limit_amount || 0);
  const availableCredit = creditLimit > 0 ? round2(creditLimit - currentOutstanding) : null;

  const fullAddress = [cust.address1, cust.address2, cust.address3, cust.address4, cust.city, cust.state]
    .filter((v) => v && String(v).trim())
    .join(', ');

  return {
    id: cust.id,
    customer_code: `CUST-${String(cust.id).padStart(4, '0')}`,
    name: cust.name,
    print_name: cust.print_name || cust.name,
    customer_type: cust.tax_reg_type || 'Regular',
    gst_number: cust.gst_number || '',
    state: cust.state || 'Tamil Nadu',
    state_code: cust.state_code || normalizeStateCode(cust.state, '33'),
    billing_address: fullAddress,
    shipping_address: fullAddress,
    contact_person: cust.contact_person || '',
    mobile: cust.mobile1 || cust.mobile2 || cust.phone_off || '',
    email: cust.email || '',
    transport: cust.transport || '',
    limit_days: Number(cust.limit_days || 0),
    credit_limit: creditLimit,
    current_outstanding: currentOutstanding,
    available_credit: availableCredit
  };
}

async function getAvailableLots(companyId = 1, filters = {}) {
  await ensureSalesSchema(companyId);
  const runner = db.forCompany(companyId);
  const { item_id, item_name, godown_id, stock_type } = filters;

  const smParams = [companyId];
  let smWhere = `sm.company_id = ? AND COALESCE(sm.is_reversed, 0) = 0 AND COALESCE(sm.is_reversal, 0) = 0 AND COALESCE(sm.is_physical_stock, 1) = 1`;
  if (godown_id) {
    smWhere += ` AND CAST(sm.godown_id AS TEXT) = ?`;
    smParams.push(String(godown_id));
  }
  if (stock_type && stock_type.toUpperCase() !== 'ALL') {
    const st = stock_type.toUpperCase();
    if (st === 'VACUUM') {
      smWhere += ` AND (UPPER(COALESCE(sm.stock_category, '')) = 'VACUUM' OR LOWER(sm.item_name) LIKE '%vacuum%')`;
    } else {
      smWhere += ` AND UPPER(COALESCE(sm.stock_category, '')) = ?`;
      smParams.push(st);
    }
  }
  if (item_name) {
    smWhere += ` AND LOWER(TRIM(sm.item_name)) = LOWER(TRIM(?))`;
    smParams.push(String(item_name));
  } else if (item_id) {
    smWhere += ` AND (CAST(sm.item_id AS TEXT) = ? OR LOWER(TRIM(sm.item_name)) = (SELECT LOWER(TRIM(item_name)) FROM item_master WHERE CAST(id AS TEXT) = ? LIMIT 1))`;
    smParams.push(String(item_id), String(item_id));
  }

  const smRowsRes = await runner.query(
    `SELECT
       sm.item_id,
       sm.item_name,
       sm.lot_no,
       COALESCE(NULLIF(TRIM(MAX(sm.parent_lot_no)), ''), NULLIF(TRIM(MAX(sm.rm_lot_no)), ''), '') AS parent_rm_lot_no,
       sm.godown_id,
       COALESCE(MAX(sm.godown_name), '') AS godown_name,
       MAX(sm.stock_category) AS stock_category,
       MAX(sm.uom) AS uom,
       MAX(sm.unit_weight) AS unit_weight,
       MAX(sm.rate) AS rate,
       SUM(CASE WHEN sm.direction = 'IN' THEN COALESCE(sm.qty, 0) ELSE -COALESCE(sm.qty, 0) END) AS available_qty,
       SUM(CASE WHEN sm.direction = 'IN' THEN COALESCE(sm.weight, 0) ELSE -COALESCE(sm.weight, 0) END) AS available_weight
     FROM stock_movements sm
     WHERE ${smWhere}
     GROUP BY sm.item_name, sm.lot_no, sm.godown_id
     HAVING available_qty > 0.0001 OR available_weight > 0.0001
     ORDER BY sm.item_name ASC, sm.lot_no ASC`,
    smParams
  );

  // Fetch item_master map & stock_lots metadata
  const [itemsRes, lotsRes] = await Promise.all([
    runner.query(`SELECT id, item_code, item_name, hsn_code, tax, gst_rate, stock_category, weight, unit FROM item_master`),
    runner.query(`SELECT item_id, item_name, lot_no, parent_lot_no, godown_id, godown_name, remaining_quantity, rate, qc_status, created_at FROM stock_lots`)
  ]);

  const itemMap = new Map();
  for (const im of itemsRes.rows || []) {
    itemMap.set(String(im.item_name || '').trim().toLowerCase(), im);
  }
  const lotMetaMap = new Map();
  for (const sl of lotsRes.rows || []) {
    const key = `${String(sl.item_name || '').trim().toLowerCase()}::${String(sl.lot_no || '').trim().toLowerCase()}`;
    lotMetaMap.set(key, sl);
  }

  const seenKeys = new Set();
  const results = [];

  for (const r of smRowsRes.rows || []) {
    const itemKey = String(r.item_name || '').trim().toLowerCase();
    const lotKey = `${itemKey}::${String(r.lot_no || '').trim().toLowerCase()}`;
    const fullKey = `${lotKey}::${r.godown_id || 0}`;
    seenKeys.add(lotKey);

    const im = itemMap.get(itemKey);
    const meta = lotMetaMap.get(lotKey);
    const availQty = round3(r.available_qty);
    const availWt = round3(r.available_weight);
    const unitWt = parseFloat(r.unit_weight) || (availQty > 0 ? round3(availWt / availQty) : (parseFloat(im?.weight) || 50));

    results.push({
      item_id: r.item_id || im?.id || meta?.item_id || null,
      product_code: im?.item_code || '',
      item_name: r.item_name,
      category: r.stock_category || im?.stock_category || 'FG',
      hsn_code: im?.hsn_code || '',
      gst_rate: Number(im?.gst_rate ?? im?.tax ?? 5),
      lot_no: r.lot_no || '',
      parent_rm_lot_no: r.parent_rm_lot_no || meta?.parent_lot_no || '',
      godown_id: r.godown_id || meta?.godown_id || null,
      godown_name: r.godown_name || meta?.godown_name || 'Main Godown',
      uom: r.uom || im?.unit || 'KG',
      unit_weight: unitWt,
      available_qty: availQty,
      available_weight: availWt > 0 ? availWt : round3(availQty * unitWt),
      rate: Number(r.rate || meta?.rate || 0),
      qc_status: meta?.qc_status || 'ACCEPTED'
    });
  }

  // Include stock_lots that have remaining_quantity > 0 but haven't appeared in stock_movements yet
  for (const sl of lotsRes.rows || []) {
    if (Number(sl.remaining_quantity || 0) <= 0) continue;
    const itemKey = String(sl.item_name || '').trim().toLowerCase();
    const lotKey = `${itemKey}::${String(sl.lot_no || '').trim().toLowerCase()}`;
    if (seenKeys.has(lotKey)) continue;

    const im = itemMap.get(itemKey);
    if (item_name && itemKey !== String(item_name).trim().toLowerCase()) continue;
    if (item_id && String(sl.item_id || im?.id || '') !== String(item_id)) continue;
    if (godown_id && String(sl.godown_id || '') !== String(godown_id)) continue;

    const cat = String(im?.stock_category || 'RM').toUpperCase();
    if (stock_type && stock_type.toUpperCase() !== 'ALL' && cat !== stock_type.toUpperCase()) continue;

    const unitWt = parseFloat(im?.weight) || 50;
    const remQty = round3(sl.remaining_quantity);

    results.push({
      item_id: sl.item_id || im?.id || null,
      product_code: im?.item_code || '',
      item_name: sl.item_name,
      category: cat,
      hsn_code: im?.hsn_code || '',
      gst_rate: Number(im?.gst_rate ?? im?.tax ?? 5),
      lot_no: sl.lot_no || '',
      parent_rm_lot_no: sl.parent_lot_no || '',
      godown_id: sl.godown_id || null,
      godown_name: sl.godown_name || 'Main Godown',
      uom: im?.unit || 'KG',
      unit_weight: unitWt,
      available_qty: remQty,
      available_weight: round3(remQty * unitWt),
      rate: Number(sl.rate || 0),
      qc_status: sl.qc_status || 'ACCEPTED'
    });
  }

  return results;
}

async function resolveGodownInfo(runner, godownId, godownName) {
  if (godownId) {
    const res = await runner.query(`SELECT id, godown_name FROM godown_master WHERE id = ? LIMIT 1`, [Number(godownId)]);
    if (res.rows?.[0]) return res.rows[0];
  }
  if (godownName) {
    const res = await runner.query(
      `SELECT id, godown_name FROM godown_master WHERE LOWER(TRIM(godown_name)) = LOWER(TRIM(?)) LIMIT 1`,
      [String(godownName)]
    );
    if (res.rows?.[0]) return res.rows[0];
  }
  const def = await runner.query(`SELECT id, godown_name FROM godown_master ORDER BY id ASC LIMIT 1`);
  return def.rows?.[0] || { id: null, godown_name: 'Main Godown' };
}

async function resolveTransporterName(runner, transporterVal, transporterIdVal) {
  const key = transporterIdVal || transporterVal;
  if (!key) return '';
  if (/^\d+$/.test(String(key).trim())) {
    const res = await runner.query(
      `SELECT id, name, print_name FROM transport_master WHERE id = ? LIMIT 1`,
      [parseInt(String(key).trim(), 10)]
    );
    if (res.rows?.[0]) return res.rows[0].print_name || res.rows[0].name || '';
  }
  return String(transporterVal || '').trim();
}

async function revertSalesStock(salesId, runner) {
  const stockEntries = await runner.query(
    `SELECT item_name, lot_no, qty FROM stock WHERE reference_id = ? AND type = 'Sale'`,
    [salesId]
  );

  for (const entry of stockEntries.rows || []) {
    const restoredQty = Math.abs(parseFloat(entry.qty) || 0);
    if (restoredQty > 0) {
      const result = await runner.run(
        `UPDATE stock_lots SET remaining_quantity = remaining_quantity + ?
         WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?)) AND LOWER(TRIM(COALESCE(lot_no, ''))) = LOWER(TRIM(?))`,
        [restoredQty, entry.item_name, entry.lot_no || '']
      );
      if (result && result.changes === 0) {
        const firstLot = await runner.query(
          `SELECT id FROM stock_lots WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?)) ORDER BY created_at ASC LIMIT 1`,
          [entry.item_name]
        );
        if (firstLot.rows?.[0]?.id) {
          await runner.run(
            `UPDATE stock_lots SET remaining_quantity = remaining_quantity + ? WHERE id = ?`,
            [restoredQty, firstLot.rows[0].id]
          );
        }
      }
    }
  }

  await runner.run(`DELETE FROM stock WHERE reference_id = ? AND type = 'Sale'`, [salesId]);
}

async function validateAndDeductSalesStock({ companyId, runner, salesId, saleDate, item }) {
  const itName = String(item.item_name || item.itemName || '').trim();
  const itLot = String(item.lot_no || item.lotNo || '').trim();
  const qtyToDeduct = parseFloat(item.qty) || 0;
  if (qtyToDeduct <= 0) return;

  const godownId = item.godown_id ? parseInt(item.godown_id, 10) : null;
  const godownName = item.godown_name || '';

  if (itLot) {
    // Check stock_movements physical balance first (supports multi-godown & FG production lots)
    let smQty = null;
    if (godownId) {
      const smRes = await runner.query(
        `SELECT SUM(CASE WHEN direction = 'IN' THEN qty ELSE -qty END) AS bal, COUNT(*) AS cnt
         FROM stock_movements
         WHERE company_id = ? AND COALESCE(is_reversed, 0) = 0 AND COALESCE(is_reversal, 0) = 0
           AND COALESCE(is_physical_stock, 1) = 1
           AND LOWER(TRIM(item_name)) = LOWER(TRIM(?))
           AND LOWER(TRIM(COALESCE(lot_no, ''))) = LOWER(TRIM(?))
           AND godown_id = ?`,
        [companyId, itName, itLot, godownId]
      );
      if (Number(smRes.rows?.[0]?.cnt || 0) > 0) {
        smQty = parseFloat(smRes.rows[0].bal) || 0;
      }
    }
    if (smQty === null) {
      const smAnyRes = await runner.query(
        `SELECT SUM(CASE WHEN direction = 'IN' THEN qty ELSE -qty END) AS bal, COUNT(*) AS cnt
         FROM stock_movements
         WHERE company_id = ? AND COALESCE(is_reversed, 0) = 0 AND COALESCE(is_reversal, 0) = 0
           AND COALESCE(is_physical_stock, 1) = 1
           AND LOWER(TRIM(item_name)) = LOWER(TRIM(?))
           AND LOWER(TRIM(COALESCE(lot_no, ''))) = LOWER(TRIM(?))`,
        [companyId, itName, itLot]
      );
      if (Number(smAnyRes.rows?.[0]?.cnt || 0) > 0) {
        smQty = parseFloat(smAnyRes.rows[0].bal) || 0;
      }
    }

    const slRes = await runner.query(
      `SELECT id, item_id, lot_no, remaining_quantity
       FROM stock_lots
       WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?))
         AND LOWER(TRIM(COALESCE(lot_no, ''))) = LOWER(TRIM(?))
       ORDER BY id ASC`,
      [itName, itLot]
    );
    const slRows = slRes.rows || [];
    const slTotal = slRows.reduce((s, l) => s + (parseFloat(l.remaining_quantity) || 0), 0);

    const effectiveAvailable = smQty !== null ? smQty : slTotal;
    if (effectiveAvailable + 1e-6 < qtyToDeduct) {
      const err = new Error(
        `Insufficient stock for ${itName} (Lot ${itLot}${godownName ? ` @ ${godownName}` : ''}). Available: ${round3(effectiveAvailable)}, Requested: ${qtyToDeduct}`
      );
      err.statusCode = 400;
      throw err;
    }

    // Deduct matching stock_lots row(s) without letting remaining_quantity drop below 0
    let rem = qtyToDeduct;
    for (const lot of slRows) {
      if (rem <= 0) break;
      const avail = parseFloat(lot.remaining_quantity) || 0;
      if (avail <= 0) continue;
      const take = Math.min(avail, rem);
      await runner.run(`UPDATE stock_lots SET remaining_quantity = MAX(0, remaining_quantity - ?) WHERE id = ?`, [take, lot.id]);
      rem -= take;
    }

    await runner.run(
      `INSERT INTO stock (item_id, item_name, lot_no, qty, weight, rate, amount, date, type, reference_id, godown, godown_id, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Sale', ?, ?, ?, ?)`,
      [
        item.item_id || slRows[0]?.item_id || null,
        itName,
        itLot,
        -qtyToDeduct,
        -Math.abs(parseFloat(item.net_product_wt || item.total_wt) || (qtyToDeduct * (parseFloat(item.weight) || 0))),
        parseFloat(item.rate) || 0,
        -Math.abs(parseFloat(item.total_amt) || 0),
        saleDate,
        salesId,
        godownName || null,
        godownId || null,
        `Sales #${salesId} Lot ${itLot}`
      ]
    );
    return;
  }

  // FIFO fallback when no lot_no was specified
  const availableLotsRes = await runner.query(
    `SELECT * FROM stock_lots
     WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?)) AND remaining_quantity > 0
     ORDER BY created_at ASC, id ASC`,
    [itName]
  );
  const availableLots = availableLotsRes.rows || [];
  const totalAvailable = availableLots.reduce((sum, lot) => sum + (parseFloat(lot.remaining_quantity) || 0), 0);
  if (totalAvailable + 1e-6 < qtyToDeduct) {
    const err = new Error(`Insufficient stock for ${itName}. Available: ${round3(totalAvailable)}, Requested: ${qtyToDeduct}`);
    err.statusCode = 400;
    throw err;
  }

  let remainingToDeduct = qtyToDeduct;
  const totalItemWt = Math.abs(parseFloat(item.net_product_wt || item.total_wt) || (qtyToDeduct * (parseFloat(item.weight) || 0)));
  const totalItemAmt = Math.abs(parseFloat(item.total_amt) || 0);

  for (const lot of availableLots) {
    if (remainingToDeduct <= 0) break;
    const deductFromThis = Math.min(parseFloat(lot.remaining_quantity) || 0, remainingToDeduct);
    const ratio = qtyToDeduct > 0 ? deductFromThis / qtyToDeduct : 0;

    await runner.run(`UPDATE stock_lots SET remaining_quantity = MAX(0, remaining_quantity - ?) WHERE id = ?`, [deductFromThis, lot.id]);
    await runner.run(
      `INSERT INTO stock (item_id, item_name, lot_no, qty, weight, rate, amount, date, type, reference_id, godown, godown_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Sale', ?, ?, ?)`,
      [
        item.item_id || lot.item_id || null,
        itName,
        lot.lot_no,
        -deductFromThis,
        -round3(totalItemWt * ratio),
        parseFloat(item.rate) || 0,
        -round2(totalItemAmt * ratio),
        saleDate,
        salesId,
        godownName || lot.godown_name || null,
        godownId || lot.godown_id || null
      ]
    );
    remainingToDeduct -= deductFromThis;
  }
}

async function prepareNormalizedPayload(companyId, runner, payload = {}, existingSale = null) {
  const { formData = {}, items = [], totals = {} } = payload;

  const validItems = (items || []).filter((item) => {
    const name = item?.itemName || item?.item_name;
    return name && String(name).trim() !== '';
  });
  if (validItems.length === 0) {
    const err = new Error('At least one item with a valid name is required.');
    err.statusCode = 400;
    throw err;
  }

  const isOrder = Boolean(Number(formData.is_order ?? payload.is_order ?? existingSale?.is_order ?? 0) === 1);
  const saleDate = sanitizeDate(formData.date) || existingSale?.date || new Date().toISOString().slice(0, 10);
  const resolvedFy = await resolveFinancialYear(companyId, { date: saleDate, financialYear: formData.financial_year }, runner);
  const financialYear = formData.financial_year || resolvedFy?.financialYear || deriveIndianFyFromDate(saleDate).financialYear;

  const custKey = formData.customer_id || formData.customer || formData.customer_name || existingSale?.customer_id || existingSale?.customer || '';
  if (!custKey) {
    const err = new Error('Customer is required.');
    err.statusCode = 400;
    throw err;
  }
  const custInfo = await resolveCustomerName(formData.customer || formData.customer_name || custKey, companyId, {
    customerId: formData.customer_id
  });
  const resolvedCustName = custInfo.customerName || String(custKey);
  const resolvedCustId = custInfo.id || (Number.isFinite(Number(formData.customer_id)) ? Number(formData.customer_id) : null);
  const custCtx = await getCustomerContext(companyId, resolvedCustId || resolvedCustName);
  const companyProfile = await getCompanyProfile(companyId);

  const partyState = formData.party_state || custCtx?.state || companyProfile.state;
  const partyStateCode = formData.party_state_code || custCtx?.state_code || normalizeStateCode(partyState, companyProfile.state_code);
  const placeOfSupply = formData.place_of_supply || `${partyState} (${partyStateCode})`;
  const taxType = formData.tax_type || 'Exclusive';
  const isWithoutTax = String(taxType).toLowerCase().includes('without');
  const isInclusive = !isWithoutTax && String(taxType).toLowerCase().includes('inclusive');

  const isInterState = computeIsInterstate({
    companyState: companyProfile.state,
    companyStateCode: companyProfile.state_code,
    partyState,
    partyStateCode,
    placeOfSupply,
    gstin: formData.customer_gstin || custCtx?.gst_number
  });

  const defaultGodown = await resolveGodownInfo(runner, formData.godown_from_id, formData.godown_from_name);

  // Weighment values
  const weighmentMode = formData.weighment_mode || 'Manual Weighment';
  const vehicleGrossWeight = Math.max(0, parseFloat(formData.vehicle_gross_weight) || 0);
  const vehicleTareWeight = Math.max(0, parseFloat(formData.vehicle_tare_weight) || 0);
  const netLoadWeight = (vehicleGrossWeight > 0 || vehicleTareWeight > 0)
    ? round3(Math.max(0, vehicleGrossWeight - vehicleTareWeight))
    : Math.max(0, parseFloat(formData.net_load_weight) || 0);

  // Normalize items
  let totalQty = 0;
  let totalProductNetWt = 0;
  let totalPkgTareWt = 0;
  let sumGross = 0;
  let sumDisc = 0;
  let sumTaxable = 0;
  let sumCgst = 0;
  let sumSgst = 0;
  let sumIgst = 0;
  let sumTax = 0;
  let sumItemsTotal = 0;

  const normalizedItems = [];
  for (const rawIt of validItems) {
    const itName = String(rawIt.itemName || rawIt.item_name || '').trim();
    const qty = Math.max(0, parseFloat(rawIt.qty) || 0);
    const unitWt = Math.max(0, parseFloat(rawIt.weight ?? rawIt.per_unit_wt ?? rawIt.perUnitWt) || 0);
    const pkgTarePerUnit = Math.max(0, parseFloat(rawIt.package_tare_wt) || 0);
    const linePkgTare = round3(qty * pkgTarePerUnit);
    const explicitNetWt = parseFloat(rawIt.net_product_wt ?? rawIt.totalWt ?? rawIt.total_wt ?? rawIt.total_weight);
    const netProductWt = Number.isFinite(explicitNetWt) && explicitNetWt >= 0
      ? round3(explicitNetWt)
      : round3(qty * unitWt);

    const rate = Math.max(0, parseFloat(rawIt.rate) || 0);
    const rateType = rawIt.rate_type || rawIt.rateType || (unitWt > 0 && Math.abs(netProductWt - qty) > 0.001 && rawIt.rate_by_weight ? 'Per Kg' : 'Per Kg');
    const billUnits = (String(rateType).toLowerCase() === 'per kg' && netProductWt > 0) ? netProductWt : qty;

    const discPerc = Math.max(0, parseFloat(rawIt.discPerc ?? rawIt.disc_perc ?? rawIt.disc) || 0);
    const taxPerc = isWithoutTax ? 0 : Math.max(0, parseFloat(rawIt.taxPerc ?? rawIt.tax_perc ?? rawIt.tax_rate ?? rawIt.tax ?? formData.tax_percent) || 0);

    // If caller explicitly passed line amount/totalAmt (e.g. legacy frontend qty * rate formula) and did NOT pass taxable_amount, respect explicit caller calculation
    let lineGross = round2(billUnits * rate);
    if (rawIt.rate_type === undefined && rawIt.net_product_wt === undefined && rawIt.amount !== undefined && parseFloat(rawIt.amount) > 0) {
      // Legacy caller compatibility: qty * rate may have been used
      const legacyGross = round2(qty * rate);
      const legacyAfterDisc = round2(legacyGross * (1 - discPerc / 100));
      const legacyWithTax = isInclusive ? legacyAfterDisc : round2(legacyAfterDisc * (1 + taxPerc / 100));
      if (Math.abs(parseFloat(rawIt.amount) - legacyWithTax) < 2) {
        lineGross = legacyGross;
      }
    }

    const lineDiscAmt = round2(rawIt.disc_amount !== undefined && rawIt.disc_amount !== '' ? parseFloat(rawIt.disc_amount) : (lineGross * discPerc) / 100);
    const afterDisc = round2(Math.max(0, lineGross - lineDiscAmt));

    let taxableAmt = afterDisc;
    let taxAmt = 0;
    let lineTotalAmt = afterDisc;

    if (!isWithoutTax && taxPerc > 0) {
      if (isInclusive) {
        taxableAmt = round2(afterDisc / (1 + taxPerc / 100));
        taxAmt = round2(afterDisc - taxableAmt);
        lineTotalAmt = afterDisc;
      } else {
        taxableAmt = afterDisc;
        taxAmt = round2((taxableAmt * taxPerc) / 100);
        lineTotalAmt = round2(taxableAmt + taxAmt);
      }
    }

    const cgstRate = isInterState || isWithoutTax ? 0 : round2(taxPerc / 2);
    const sgstRate = isInterState || isWithoutTax ? 0 : round2(taxPerc / 2);
    const igstRate = isInterState && !isWithoutTax ? taxPerc : 0;

    const cgstAmt = isInterState ? 0 : round2(taxAmt / 2);
    const sgstAmt = isInterState ? 0 : round2(taxAmt - cgstAmt);
    const igstAmt = isInterState ? taxAmt : 0;

    const itemGodown = await resolveGodownInfo(runner, rawIt.godown_id || formData.godown_from_id, rawIt.godown_name);

    totalQty += qty;
    totalProductNetWt += netProductWt;
    totalPkgTareWt += linePkgTare;
    sumGross += lineGross;
    sumDisc += lineDiscAmt;
    sumTaxable += taxableAmt;
    sumCgst += cgstAmt;
    sumSgst += sgstAmt;
    sumIgst += igstAmt;
    sumTax += taxAmt;
    sumItemsTotal += lineTotalAmt;

    normalizedItems.push({
      item_id: rawIt.item_id || rawIt.itemId || null,
      product_code: rawIt.product_code || rawIt.item_code || '',
      item_name: itName,
      category: rawIt.category || formData.stock_type || 'FG',
      hsn_code: rawIt.hsn_code || rawIt.hsn || '',
      lot_no: String(rawIt.lotNo || rawIt.lot_no || '').trim(),
      parent_rm_lot_no: String(rawIt.parent_rm_lot_no || rawIt.parent_lot_no || '').trim(),
      godown_id: itemGodown.id,
      godown_name: itemGodown.godown_name,
      package_type: rawIt.package_type || 'Bag',
      package_tare_wt: pkgTarePerUnit,
      uom: rawIt.uom || 'KG',
      weight: unitWt,
      qty,
      total_wt: netProductWt,
      net_product_wt: netProductWt,
      allocated_load_wt: parseFloat(rawIt.allocated_load_wt) || 0,
      rate,
      rate_type: rateType,
      disc_perc: discPerc,
      disc_amount: lineDiscAmt,
      taxable_amount: taxableAmt,
      tax_perc: taxPerc,
      tax_amount: taxAmt,
      tax_type: rawIt.tax_type || 'Taxable',
      gst_rate: taxPerc,
      cgst_rate: cgstRate,
      cgst_amount: cgstAmt,
      sgst_rate: sgstRate,
      sgst_amount: sgstAmt,
      igst_rate: igstRate,
      igst_amount: igstAmt,
      total_amt: lineTotalAmt,
      box: parseFloat(rawIt.box) || 0
    });
  }

  // Allocate weighbridge net load weight proportionally if requested or left 0 while netLoadWeight > 0
  if (netLoadWeight > 0 && normalizedItems.every((it) => !it.allocated_load_wt)) {
    const baseWt = totalProductNetWt > 0 ? totalProductNetWt : totalQty;
    if (baseWt > 0) {
      let running = 0;
      normalizedItems.forEach((it, idx) => {
        if (idx === normalizedItems.length - 1) {
          it.allocated_load_wt = round3(Math.max(0, netLoadWeight - running));
        } else {
          const share = ((totalProductNetWt > 0 ? it.net_product_wt : it.qty) / baseWt) * netLoadWeight;
          it.allocated_load_wt = round3(share);
          running += it.allocated_load_wt;
        }
      });
    }
  }

  const deductions = normalizeSalesDeductions(formData.selectedDeductions || payload.selectedDeductions, formData);
  const addDedSum = deductions.filter((d) => d.type === 'ADD').reduce((s, d) => s + Number(d.amount || 0), 0);
  const lessDedSum = deductions.filter((d) => d.type === 'LESS').reduce((s, d) => s + Number(d.amount || 0), 0);

  const freightAmount = Math.max(0, parseFloat(formData.freight_amount) || 0);
  const freightPaidBy = formData.freight_paid_by === 'Seller' ? 'Seller' : 'Buyer';
  const recoverFreight = (freightPaidBy === 'Seller' && Boolean(Number(formData.recover_freight_on_invoice) === 1 || formData.recover_freight_on_invoice === true));
  const freightRecoveryAmt = recoverFreight ? round2(freightAmount) : 0;

  const loadingChargesAmt = Math.max(0, parseFloat(formData.loading_charges_amt) || 0);
  const otherCharges = Math.max(0, parseFloat(formData.other_charges) || 0);
  const tcsAmount = Math.max(0, parseFloat(formData.tcs_amount) || 0);
  const roundOff = round2(parseFloat(formData.round_off) || 0);

  const billAmt = round2(sumTaxable || parseFloat(formData.bill_amt) || parseFloat(totals?.baseAmount) || 0);
  const taxAmt = isWithoutTax ? 0 : round2(sumTax || parseFloat(formData.tax_amt) || 0);
  const cgstAmt = isWithoutTax || isInterState ? 0 : round2(sumCgst || taxAmt / 2);
  const sgstAmt = isWithoutTax || isInterState ? 0 : round2(sumSgst || (taxAmt - cgstAmt));
  const igstAmt = isWithoutTax || !isInterState ? 0 : round2(sumIgst || taxAmt);

  const computedTotalAmt = round2(billAmt + taxAmt);
  const computedGrandTotal = round2(Math.max(
    0,
    computedTotalAmt + freightRecoveryAmt + loadingChargesAmt + otherCharges + tcsAmount + addDedSum - lessDedSum + roundOff
  ));

  const grandTotal = computedGrandTotal;
  const receivedAmount = isOrder ? 0 : Math.max(0, round2(parseFloat(formData.received_amount) || 0));
  const advanceAdjusted = isOrder ? 0 : Math.max(0, round2(parseFloat(formData.advance_adjusted) || 0));
  const balanceReceivable = round2(Math.max(0, grandTotal - receivedAmount - advanceAdjusted));

  const transporterName = await resolveTransporterName(runner, formData.pur_trans || formData.transporter_name, formData.transporter_id);
  const paymentTerms = formData.payment_terms || (formData.pay_type === 'Cash' ? 'Immediate' : `${custCtx?.limit_days || 15} Days`);
  const dueDate = sanitizeDate(formData.due_date) || addDaysToIso(saleDate, parseTermsDays(paymentTerms));

  const autoOutpass = isOrder ? 0 : (formData.auto_outpass === undefined ? 1 : (Number(formData.auto_outpass) === 1 || formData.auto_outpass === true ? 1 : 0));

  return {
    isOrder,
    saleDate,
    financialYear,
    companyProfile,
    custCtx,
    resolvedCustId,
    resolvedCustName,
    customerCode: formData.customer_code || custCtx?.customer_code || (resolvedCustId ? `CUST-${String(resolvedCustId).padStart(4, '0')}` : ''),
    customerType: formData.customer_type || custCtx?.customer_type || 'Regular',
    customerGstin: formData.customer_gstin || custCtx?.gst_number || '',
    billingAddress: formData.billing_address || formData.address || custCtx?.billing_address || custInfo.address || '',
    shippingAddress: formData.shipping_address || formData.delivery_location || formData.billing_address || formData.address || custCtx?.shipping_address || '',
    contactPerson: formData.contact_person || custCtx?.contact_person || '',
    phone: formData.phone || custCtx?.mobile || custInfo.phone || '',
    email: formData.email || custCtx?.email || '',
    creditLimit: parseFloat(formData.credit_limit) || custCtx?.credit_limit || 0,
    customerOutstanding: parseFloat(formData.customer_outstanding) || custCtx?.current_outstanding || 0,
    partyState,
    partyStateCode,
    placeOfSupply,
    isInterState,
    taxType,
    isWithoutTax,
    defaultGodown,
    transporterName,
    paymentTerms,
    dueDate,
    normalizedItems,
    deductions,
    deductionsJson: JSON.stringify(deductions),
    totalQty: round3(totalQty),
    totalProductNetWt: round3(totalProductNetWt),
    totalPkgTareWt: round3(totalPkgTareWt),
    weighmentMode,
    vehicleGrossWeight,
    vehicleTareWeight,
    netLoadWeight,
    grossAmt: round2(sumGross),
    discAmt: round2(sumDisc),
    billAmt,
    taxAmt,
    cgstAmt,
    sgstAmt,
    igstAmt,
    totalAmt: computedTotalAmt,
    freightAmount: round2(freightAmount),
    freightPaidBy,
    recoverFreight: recoverFreight ? 1 : 0,
    freightRecoveryAmt,
    loadingChargesAmt,
    otherCharges,
    tcsAmount,
    roundOff,
    netDeductionAmount: round2(lessDedSum - addDedSum),
    grandTotal,
    receivedAmount,
    advanceAdjusted,
    balanceReceivable,
    autoOutpass
  };
}

async function upsertLinkedOutpass({ companyId, runner, salesId, billNo, existingOutpassId, existingOutpassNo, formData, norm, username }) {
  const shouldHaveOutpass = !norm.isOrder && norm.autoOutpass === 1;
  if (!shouldHaveOutpass) {
    if (existingOutpassId) {
      await runner.run(`DELETE FROM outpass_items WHERE outpass_id = ?`, [existingOutpassId]);
      await runner.run(`DELETE FROM outpasses WHERE id = ?`, [existingOutpassId]);
    }
    return { outpassId: null, outpassNo: null, outpassStatus: null };
  }

  let outpassId = existingOutpassId || null;
  let outpassNo = existingOutpassNo || formData.outpass_no || '';
  if (!outpassNo) {
    outpassNo = await getNextOutpassNo(companyId, runner);
  }

  const outpassStatus = (formData.dispatch_status === 'Delivered' || formData.actual_delivery_date)
    ? 'DELIVERED'
    : 'OUTPASSED';
  const vehicleNo = formData.lorry_no || formData.vehicle_no || '';
  const destination = norm.shippingAddress || formData.delivery_location || '';
  const loadingLocation = formData.loading_location || norm.defaultGodown.godown_name || 'Main Godown';

  if (outpassId) {
    await runner.run(
      `UPDATE outpasses SET
         date = ?, purpose = 'Sales Dispatch', item_type = ?, reference_type = 'SALES', reference_id = ?, reference_no = ?,
         party_type = 'Customer', party_id = ?, party_name = ?, from_location = ?, from_godown_id = ?, from_godown_name = ?,
         destination = ?, vehicle_no = ?, driver_name = ?, driver_phone = ?, transporter = ?, expected_return_date = ?,
         status = ?, total_qty = ?, total_weight = ?, vehicle_gross_weight = ?, vehicle_tare_weight = ?, net_load_weight = ?,
         weighment_slip_no = ?, lr_no = ?, lr_date = ?, transport_mode = ?, freight_amount = ?, freight_paid_by = ?,
         remarks = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        norm.saleDate,
        formData.stock_type || 'FG',
        salesId,
        billNo,
        norm.resolvedCustId,
        norm.resolvedCustName,
        loadingLocation,
        norm.defaultGodown.id,
        norm.defaultGodown.godown_name,
        destination,
        vehicleNo,
        formData.driver || '',
        formData.driver_mobile || '',
        norm.transporterName,
        sanitizeDate(formData.expected_delivery_date) || '',
        outpassStatus,
        norm.totalQty,
        norm.totalProductNetWt,
        norm.vehicleGrossWeight,
        norm.vehicleTareWeight,
        norm.netLoadWeight,
        formData.weighment_slip_no || '',
        formData.lr_no || '',
        sanitizeDate(formData.lr_date) || '',
        formData.transport_mode || 'Third Party',
        norm.freightAmount,
        norm.freightPaidBy,
        formData.remarks || `Auto-generated for Sales #${billNo}`,
        outpassId
      ]
    );
    await runner.run(`DELETE FROM outpass_items WHERE outpass_id = ?`, [outpassId]);
  } else {
    const ins = await runner.run(
      `INSERT INTO outpasses (
         outpass_no, date, purpose, item_type, reference_type, reference_id, reference_no,
         party_type, party_id, party_name, from_location, from_godown_id, from_godown_name,
         destination, vehicle_no, driver_name, driver_phone, transporter, expected_return_date,
         status, total_qty, total_weight, returned_qty, returned_weight,
         vehicle_gross_weight, vehicle_tare_weight, net_load_weight, weighment_slip_no,
         lr_no, lr_date, transport_mode, freight_amount, freight_paid_by,
         remarks, created_by
       ) VALUES (?, ?, 'Sales Dispatch', ?, 'SALES', ?, ?, 'Customer', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        outpassNo,
        norm.saleDate,
        formData.stock_type || 'FG',
        salesId,
        billNo,
        norm.resolvedCustId,
        norm.resolvedCustName,
        loadingLocation,
        norm.defaultGodown.id,
        norm.defaultGodown.godown_name,
        destination,
        vehicleNo,
        formData.driver || '',
        formData.driver_mobile || '',
        norm.transporterName,
        sanitizeDate(formData.expected_delivery_date) || '',
        outpassStatus,
        norm.totalQty,
        norm.totalProductNetWt,
        norm.vehicleGrossWeight,
        norm.vehicleTareWeight,
        norm.netLoadWeight,
        formData.weighment_slip_no || '',
        formData.lr_no || '',
        sanitizeDate(formData.lr_date) || '',
        formData.transport_mode || 'Third Party',
        norm.freightAmount,
        norm.freightPaidBy,
        formData.remarks || `Auto-generated for Sales #${billNo}`,
        username || 'admin'
      ]
    );
    outpassId = ins.lastID || ins.lastInsertRowid;
  }

  for (const it of norm.normalizedItems) {
    await runner.run(
      `INSERT INTO outpass_items (
         outpass_id, outpass_no, item_id, item_name, lot_no, godown_id, godown_name,
         qty, weight, total_weight, uom, rate, amount, returned_qty, returned_weight,
         status, reason, remarks
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'SALES_DISPATCH', 'Sales Dispatch', ?)`,
      [
        outpassId,
        outpassNo,
        it.item_id,
        it.item_name,
        it.lot_no,
        it.godown_id,
        it.godown_name,
        it.qty,
        it.weight,
        it.net_product_wt,
        it.uom,
        it.rate,
        it.total_amt,
        it.parent_rm_lot_no ? `Parent RM: ${it.parent_rm_lot_no}` : ''
      ]
    );
  }

  return { outpassId, outpassNo, outpassStatus };
}

async function postSalesAccounting({ companyId, runner, salesId, billNo, formData, norm, existingSale = null }) {
  if (norm.isOrder) {
    await deleteSalesVoucherChain(salesId, companyId);
    return { voucherNo: null, freightVoucherNo: null, receiptVoucherNo: null };
  }

  let voucherNo = existingSale?.voucher_no || null;
  let freightVoucherNo = existingSale?.freight_voucher_no || null;
  let receiptVoucherNo = existingSale?.receipt_voucher_no || null;

  const customerRef = norm.resolvedCustName || norm.resolvedCustId;

  if (norm.grandTotal > 0) {
    const vRes = await createSalesVoucherChain({
      conn: runner,
      companyId,
      customer: customerRef,
      date: norm.saleDate,
      invNo: billNo,
      salesId,
      totalAmount: norm.grandTotal,
      baseAmount: norm.billAmt,
      taxAmount: norm.taxAmt,
      cgstAmount: norm.cgstAmt,
      sgstAmount: norm.sgstAmt,
      igstAmount: norm.igstAmt,
      isInterstate: norm.isInterState,
      discAmount: 0,
      freightRecoveryAmount: norm.freightRecoveryAmt,
      loadingChargesRecoverable: norm.loadingChargesAmt,
      otherCharges: norm.otherCharges,
      tcsAmount: norm.tcsAmount,
      roundOff: norm.roundOff,
      deductions: norm.deductions,
      existingVoucherNo: voucherNo
    });
    voucherNo = vRes?.voucherNo || voucherNo;
  } else {
    await AccountingEngine.deleteVoucherBySource({ conn: runner, companyId, sourceModule: 'sales', sourceId: Number(salesId) });
    voucherNo = null;
  }

  if (norm.freightPaidBy === 'Seller' && norm.freightAmount > 0) {
    const fRes = await createSalesFreightVoucher({
      conn: runner,
      companyId,
      salesId,
      invNo: billNo,
      date: norm.saleDate,
      freightAmount: norm.freightAmount,
      freightPaidBy: norm.freightPaidBy,
      freightPaymentStatus: formData.freight_payment_status || 'Pending',
      transporter: norm.transporterName || formData.pur_trans || '',
      vehicleNo: formData.lorry_no || formData.vehicle_no || '',
      existingVoucherNo: freightVoucherNo
    });
    freightVoucherNo = fRes?.voucherNo || freightVoucherNo;
  } else {
    await AccountingEngine.deleteVoucherBySource({ conn: runner, companyId, sourceModule: 'sales_freight', sourceId: Number(salesId) });
    freightVoucherNo = null;
  }

  if (norm.receivedAmount > 0) {
    const rRes = await createSalesReceiptVoucher({
      conn: runner,
      companyId,
      customer: customerRef,
      date: norm.saleDate,
      paymentDate: formData.payment_date || norm.saleDate,
      invNo: billNo,
      salesId,
      receivedAmount: norm.receivedAmount,
      paymentMode: formData.payment_mode || formData.pay_type || 'Cash',
      bankAccountName: formData.bank_account_name || '',
      transactionRef: formData.transaction_ref || '',
      existingVoucherNo: receiptVoucherNo
    });
    receiptVoucherNo = rRes?.voucherNo || receiptVoucherNo;
  } else {
    await AccountingEngine.deleteVoucherBySource({ conn: runner, companyId, sourceModule: 'sales_receipt', sourceId: Number(salesId) });
    receiptVoucherNo = null;
  }

  return { voucherNo, freightVoucherNo, receiptVoucherNo };
}

async function createSale(companyId = 1, payload = {}, user = null) {
  const cId = parseInt(companyId, 10) || 1;
  await ensureSalesSchema(cId);
  const runner = db.forCompany(cId);
  const username = user?.username || payload?.formData?.created_by || 'admin';
  const formData = payload.formData || {};

  const norm = await prepareNormalizedPayload(cId, runner, payload, null);

  let billNo = String(formData.sNo || formData.s_no || formData.bill_no || '').trim();
  if (!billNo) {
    billNo = await getNextSalesNo(cId, norm.isOrder, runner);
  }

  const txResult = await runner.withTransaction(async () => {
    const insRes = await runner.run(
      `INSERT INTO sales (
         s_no, inv_no, date, financial_year, customer, customer_id, customer_code, customer_type, customer_gstin,
         address, billing_address, shipping_address, contact_person, phone, email, credit_limit, customer_outstanding,
         pay_type, tax_type, tax_mode, tax_percent, company_state, company_state_code, party_state, party_state_code, place_of_supply,
         stock_type, pack_type, sales_category, sales_order_ref, sales_order_id, customer_po_no, p_o_no,
         payment_terms, due_date, delivery_date, sales_person,
         sender_id, consignee_id, godown_from_id, godown_from_name,
         lorry_no, driver, driver_mobile, pur_trans, transport_mode, transporter_id, transporter_gstin, vehicle_type,
         lr_no, lr_date, expected_delivery_date, actual_delivery_date,
         loadman_name, loadman_worker_id, loadman_rate_per_kg, loadman_charges,
         weighment_mode, vehicle_gross_weight, vehicle_tare_weight, net_load_weight, package_tare_weight, product_net_weight,
         weighment_date, weighment_time, weighbridge_name, weighment_slip_no, weighed_by,
         auto_outpass, loading_location, delivery_location,
         freight_type, freight_rate, freight_amount, freight_paid_by, recover_freight_on_invoice, freight_payment_status,
         freight_recovery_amt, loading_charges_amt, other_charges, tcs_amount, round_off,
         total_qty, total_wt, total_weight, gross_amt, disc_percent, disc_amount,
         bill_amt, sub_total, base_amt, tax_amt, tax_amount,
         cgst_amt, sgst_amt, igst_amt, cgst_amount, sgst_amount, igst_amount,
         total_amt, total_amount, grand_total, deduction, deduction_remarks, deduction_amount, deductions_json,
         payment_mode, received_amount, advance_adjusted, balance_receivable, bank_account_id, bank_account_name, transaction_ref, payment_date,
         dispatch_no, dispatch_datetime, dispatch_status, delivery_challan_no, eway_bill_no, eway_bill_validity, irn_no, ack_no, received_by, delivery_remarks,
         remarks, sign, is_order
       ) VALUES (${new Array(127).fill('?').join(', ')})`,
      [
        billNo, formData.inv_no || billNo, norm.saleDate, norm.financialYear, norm.resolvedCustName, norm.resolvedCustId, norm.customerCode, norm.customerType, norm.customerGstin,
        norm.billingAddress, norm.billingAddress, norm.shippingAddress, norm.contactPerson, norm.phone, norm.email, norm.creditLimit, norm.customerOutstanding,
        formData.pay_type || (norm.receivedAmount >= norm.grandTotal && norm.grandTotal > 0 ? 'Cash' : 'Credit'),
        norm.taxType, norm.taxType, parseFloat(formData.tax_percent) || 5,
        norm.companyProfile.state, norm.companyProfile.state_code, norm.partyState, norm.partyStateCode, norm.placeOfSupply,
        formData.stock_type || 'FG', formData.pack_type || formData.type || 'Pack', formData.sales_category || 'Domestic',
        formData.sales_order_ref || '', formData.sales_order_id || null, formData.customer_po_no || formData.p_o_no || '', formData.p_o_no || formData.customer_po_no || '',
        norm.paymentTerms, norm.dueDate, sanitizeDate(formData.delivery_date) || '', formData.sales_person || '',
        formData.sender_id || null, formData.consignee_id || null, norm.defaultGodown.id, norm.defaultGodown.godown_name,
        formData.lorry_no || formData.vehicle_no || '', formData.driver || '', formData.driver_mobile || '', norm.transporterName, formData.transport_mode || 'Third Party', formData.transporter_id || null, formData.transporter_gstin || '', formData.vehicle_type || '',
        formData.lr_no || '', sanitizeDate(formData.lr_date) || '', sanitizeDate(formData.expected_delivery_date) || '', sanitizeDate(formData.actual_delivery_date) || '',
        formData.loadman_name || '', formData.loadman_worker_id || null, parseFloat(formData.loadman_rate_per_kg) || 0.5, parseFloat(formData.loadman_charges) || 0,
        norm.weighmentMode, norm.vehicleGrossWeight, norm.vehicleTareWeight, norm.netLoadWeight, norm.totalPkgTareWt, norm.totalProductNetWt,
        sanitizeDate(formData.weighment_date) || norm.saleDate, formData.weighment_time || '', formData.weighbridge_name || '', formData.weighment_slip_no || '', formData.weighed_by || '',
        norm.autoOutpass, formData.loading_location || norm.defaultGodown.godown_name, formData.delivery_location || norm.shippingAddress,
        formData.freight_type || 'Fixed', parseFloat(formData.freight_rate) || 0, norm.freightAmount, norm.freightPaidBy, norm.recoverFreight, formData.freight_payment_status || 'Pending',
        norm.freightRecoveryAmt, norm.loadingChargesAmt, norm.otherCharges, norm.tcsAmount, norm.roundOff,
        norm.totalQty, norm.totalProductNetWt, norm.totalProductNetWt, norm.grossAmt, parseFloat(formData.disc_percent) || 0, norm.discAmt,
        norm.billAmt, norm.billAmt, norm.billAmt, norm.taxAmt, norm.taxAmt,
        norm.cgstAmt, norm.sgstAmt, norm.igstAmt, norm.cgstAmt, norm.sgstAmt, norm.igstAmt,
        norm.totalAmt, norm.grandTotal, norm.grandTotal, formData.deduction || '', formData.deduction_remarks || '', norm.netDeductionAmount, norm.deductionsJson,
        formData.payment_mode || formData.pay_type || 'Credit', norm.receivedAmount, norm.advanceAdjusted, norm.balanceReceivable, formData.bank_account_id || null, formData.bank_account_name || '', formData.transaction_ref || '', sanitizeDate(formData.payment_date) || norm.saleDate,
        formData.dispatch_no || '', formData.dispatch_datetime || '', formData.dispatch_status || (norm.isOrder ? 'Sales Order' : (norm.autoOutpass ? 'Loaded' : 'Invoice Created')),
        formData.delivery_challan_no || '', formData.eway_bill_no || '', sanitizeDate(formData.eway_bill_validity) || '', formData.irn_no || '', formData.ack_no || '', formData.received_by || '', formData.delivery_remarks || '',
        formData.remarks || '', formData.sign || '', norm.isOrder ? 1 : 0
      ]
    );

    const salesId = insRes.lastID || insRes.lastInsertRowid;

    for (const it of norm.normalizedItems) {
      await runner.run(
        `INSERT INTO sales_items (
           sales_id, item_id, product_code, item_name, category, hsn_code, lot_no, parent_rm_lot_no,
           godown_id, godown_name, package_type, package_tare_wt, uom, weight, qty, total_wt, net_product_wt, allocated_load_wt,
           rate, rate_type, disc_perc, disc, disc_amount, taxable_amount, tax_perc, tax_rate, gst_rate, tax_type, tax_amount,
           cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount, total_amt, amount, total_amount, box
         ) VALUES (${new Array(39).fill('?').join(', ')})`,
        [
          salesId, it.item_id, it.product_code, it.item_name, it.category, it.hsn_code, it.lot_no, it.parent_rm_lot_no,
          it.godown_id, it.godown_name, it.package_type, it.package_tare_wt, it.uom, it.weight, it.qty, it.total_wt, it.net_product_wt, it.allocated_load_wt,
          it.rate, it.rate_type, it.disc_perc, it.disc_perc, it.disc_amount, it.taxable_amount, it.tax_perc, it.tax_perc, it.gst_rate, it.tax_type, it.tax_amount,
          it.cgst_rate, it.cgst_amount, it.sgst_rate, it.sgst_amount, it.igst_rate, it.igst_amount, it.total_amt, it.total_amt, it.total_amt, it.box
        ]
      );

      if (!norm.isOrder) {
        await validateAndDeductSalesStock({ companyId: cId, runner, salesId, saleDate: norm.saleDate, item: it });
      }
    }

    const opRes = await upsertLinkedOutpass({
      companyId: cId,
      runner,
      salesId,
      billNo,
      existingOutpassId: null,
      existingOutpassNo: null,
      formData,
      norm,
      username
    });

    const accRes = await postSalesAccounting({
      companyId: cId,
      runner,
      salesId,
      billNo,
      formData,
      norm,
      existingSale: null
    });

    await runner.run(
      `UPDATE sales SET outpass_id = ?, outpass_no = ?, outpass_status = ?, voucher_no = ?, freight_voucher_no = ?, receipt_voucher_no = ?, delivery_challan_no = COALESCE(NULLIF(delivery_challan_no, ''), ?) WHERE id = ?`,
      [opRes.outpassId, opRes.outpassNo, opRes.outpassStatus, accRes.voucherNo, accRes.freightVoucherNo, accRes.receiptVoucherNo, opRes.outpassNo || '', salesId]
    );

    if (!norm.isOrder && (formData.lorry_no || formData.vehicle_no)) {
      const vNo = formData.lorry_no || formData.vehicle_no;
      await runner.run(
        `INSERT INTO vehicle_movements (
           reference_type, reference_id, movement_type, operation_type, vehicle_no, driver_name,
           gate_in_time, gate_out_time, status, item_name, qty, weight, party_name, lot_no, created_at
         ) VALUES ('SALES', ?, 'OUTWARD', 'Sales Dispatch / Loading', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'OUT', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [billNo || salesId, vNo, formData.driver || '', norm.normalizedItems[0]?.item_name || '', norm.totalQty, norm.totalProductNetWt, norm.resolvedCustName, norm.normalizedItems[0]?.lot_no || '']
      ).catch(() => {});
    }

    if (Array.isArray(payload.operational_charges) && payload.operational_charges.length > 0) {
      const engine = require('./operationalChargeEngine');
      for (const ch of payload.operational_charges) {
        await engine.createOperationalCharge(cId, {
          ...ch,
          source_module: 'SALES',
          source_transaction_type: 'SALES',
          source_transaction_id: salesId,
          source_transaction_no: billNo || `SI-${salesId}`,
          charge_date: norm.saleDate,
          item_name: norm.normalizedItems[0]?.item_name || 'Goods',
          lot_no: norm.normalizedItems[0]?.lot_no || '',
          from_location: norm.defaultGodown.godown_name,
          to_location: norm.resolvedCustName || 'Customer Destination',
          vehicle_no: ch.vehicle_no || formData.lorry_no || formData.vehicle_no || '',
          driver_name: ch.driver_name || formData.driver || '',
          quantity: ch.quantity !== undefined ? ch.quantity : norm.totalProductNetWt
        });
      }
    }

    return {
      salesId,
      billNo,
      ...opRes,
      ...accRes,
      norm
    };
  });

  if (!txResult.norm.isOrder) {
    try {
      await syncDocumentMovements(cId, 'SALES', txResult.salesId, username);
    } catch (e) {
      console.error('Error syncing stock movements after sale:', e);
    }
  }

  try {
    const { triggerTransactionNotification } = require('../utils/transactionNotifier');
    const billNum = txResult.billNo || `SI-${String(txResult.salesId).padStart(5, '0')}`;
    const itemsSummary = `${txResult.norm.normalizedItems.length} items (${txResult.norm.normalizedItems[0]?.item_name || 'Goods'}${txResult.norm.normalizedItems.length > 1 ? '...' : ''})`;
    await triggerTransactionNotification({
      moduleName: txResult.norm.isOrder ? 'EXPORT_ORDER' : 'SALES',
      referenceNo: billNum,
      title: `🔵 BVC ERP – ${txResult.norm.isOrder ? 'Sales Order' : 'Sales'} Created (${billNum})`,
      message: `Customer: ${txResult.norm.resolvedCustName} | Items: ${itemsSummary} | Qty: ${txResult.norm.totalQty} (${txResult.norm.totalProductNetWt} KG)${txResult.outpassNo ? ` | Outpass: ${txResult.outpassNo}` : ''} | Vehicle: ${formData.lorry_no || 'N/A'}`,
      severity: 'INFO',
      referenceId: txResult.salesId,
      companyId: cId,
      details: {
        sales_no: billNum,
        outpass_no: txResult.outpassNo || '',
        date: txResult.norm.saleDate,
        customer: txResult.norm.resolvedCustName,
        item_summary: itemsSummary,
        quantity: `${txResult.norm.totalQty} Bags`,
        bags: txResult.norm.totalQty,
        total_weight: `${txResult.norm.totalProductNetWt} KG`,
        amount: txResult.norm.grandTotal,
        godown: txResult.norm.defaultGodown.godown_name,
        vehicle: formData.lorry_no || 'N/A',
        created_by: username,
        status: txResult.norm.isOrder ? 'ORDER CREATED' : 'SALES CREATED'
      }
    });
  } catch (notifErr) {
    console.warn('Error triggering sales notification:', notifErr.message);
  }

  return {
    success: true,
    id: txResult.salesId,
    s_no: txResult.billNo,
    voucher_no: txResult.voucherNo,
    freight_voucher_no: txResult.freightVoucherNo,
    receipt_voucher_no: txResult.receiptVoucherNo,
    outpass_id: txResult.outpassId,
    outpass_no: txResult.outpassNo,
    grand_total: txResult.norm.grandTotal,
    balance_receivable: txResult.norm.balanceReceivable
  };
}

async function updateSale(companyId = 1, salesId, payload = {}, user = null) {
  const cId = parseInt(companyId, 10) || 1;
  await ensureSalesSchema(cId);
  const runner = db.forCompany(cId);
  const username = user?.username || payload?.formData?.updated_by || 'admin';
  const formData = payload.formData || {};

  const existingRes = await runner.query(`SELECT * FROM sales WHERE id = ? LIMIT 1`, [salesId]);
  const existingSale = existingRes.rows?.[0];
  if (!existingSale) {
    const err = new Error('Sales record not found');
    err.statusCode = 404;
    throw err;
  }

  const norm = await prepareNormalizedPayload(cId, runner, payload, existingSale);
  const billNo = String(formData.sNo || formData.bill_no || formData.s_no || existingSale.s_no || salesId).trim();

  const txResult = await runner.withTransaction(async () => {
    await revertSalesStock(salesId, runner);

    await runner.run(
      `UPDATE sales SET
         s_no = ?, inv_no = ?, date = ?, financial_year = ?, customer = ?, customer_id = ?, customer_code = ?, customer_type = ?, customer_gstin = ?,
         address = ?, billing_address = ?, shipping_address = ?, contact_person = ?, phone = ?, email = ?, credit_limit = ?, customer_outstanding = ?,
         pay_type = ?, tax_type = ?, tax_mode = ?, tax_percent = ?, company_state = ?, company_state_code = ?, party_state = ?, party_state_code = ?, place_of_supply = ?,
         stock_type = ?, pack_type = ?, sales_category = ?, sales_order_ref = ?, sales_order_id = ?, customer_po_no = ?, p_o_no = ?,
         payment_terms = ?, due_date = ?, delivery_date = ?, sales_person = ?,
         sender_id = ?, consignee_id = ?, godown_from_id = ?, godown_from_name = ?,
         lorry_no = ?, driver = ?, driver_mobile = ?, pur_trans = ?, transport_mode = ?, transporter_id = ?, transporter_gstin = ?, vehicle_type = ?,
         lr_no = ?, lr_date = ?, expected_delivery_date = ?, actual_delivery_date = ?,
         loadman_name = ?, loadman_worker_id = ?, loadman_rate_per_kg = ?, loadman_charges = ?,
         weighment_mode = ?, vehicle_gross_weight = ?, vehicle_tare_weight = ?, net_load_weight = ?, package_tare_weight = ?, product_net_weight = ?,
         weighment_date = ?, weighment_time = ?, weighbridge_name = ?, weighment_slip_no = ?, weighed_by = ?,
         auto_outpass = ?, loading_location = ?, delivery_location = ?,
         freight_type = ?, freight_rate = ?, freight_amount = ?, freight_paid_by = ?, recover_freight_on_invoice = ?, freight_payment_status = ?,
         freight_recovery_amt = ?, loading_charges_amt = ?, other_charges = ?, tcs_amount = ?, round_off = ?,
         total_qty = ?, total_wt = ?, total_weight = ?, gross_amt = ?, disc_percent = ?, disc_amount = ?,
         bill_amt = ?, sub_total = ?, base_amt = ?, tax_amt = ?, tax_amount = ?,
         cgst_amt = ?, sgst_amt = ?, igst_amt = ?, cgst_amount = ?, sgst_amount = ?, igst_amount = ?,
         total_amt = ?, total_amount = ?, grand_total = ?, deduction = ?, deduction_remarks = ?, deduction_amount = ?, deductions_json = ?,
         payment_mode = ?, received_amount = ?, advance_adjusted = ?, balance_receivable = ?, bank_account_id = ?, bank_account_name = ?, transaction_ref = ?, payment_date = ?,
         dispatch_no = ?, dispatch_datetime = ?, dispatch_status = ?, delivery_challan_no = ?, eway_bill_no = ?, eway_bill_validity = ?, irn_no = ?, ack_no = ?, received_by = ?, delivery_remarks = ?,
         remarks = ?, sign = ?, is_order = ?
       WHERE id = ?`,
      [
        billNo, formData.inv_no || billNo, norm.saleDate, norm.financialYear, norm.resolvedCustName, norm.resolvedCustId, norm.customerCode, norm.customerType, norm.customerGstin,
        norm.billingAddress, norm.billingAddress, norm.shippingAddress, norm.contactPerson, norm.phone, norm.email, norm.creditLimit, norm.customerOutstanding,
        formData.pay_type || existingSale.pay_type || 'Credit',
        norm.taxType, norm.taxType, parseFloat(formData.tax_percent) || 5,
        norm.companyProfile.state, norm.companyProfile.state_code, norm.partyState, norm.partyStateCode, norm.placeOfSupply,
        formData.stock_type || existingSale.stock_type || 'FG', formData.pack_type || formData.type || existingSale.pack_type || 'Pack', formData.sales_category || existingSale.sales_category || 'Domestic',
        formData.sales_order_ref || '', formData.sales_order_id || null, formData.customer_po_no || formData.p_o_no || '', formData.p_o_no || formData.customer_po_no || '',
        norm.paymentTerms, norm.dueDate, sanitizeDate(formData.delivery_date) || '', formData.sales_person || '',
        formData.sender_id || null, formData.consignee_id || null, norm.defaultGodown.id, norm.defaultGodown.godown_name,
        formData.lorry_no || formData.vehicle_no || '', formData.driver || '', formData.driver_mobile || '', norm.transporterName, formData.transport_mode || 'Third Party', formData.transporter_id || null, formData.transporter_gstin || '', formData.vehicle_type || '',
        formData.lr_no || '', sanitizeDate(formData.lr_date) || '', sanitizeDate(formData.expected_delivery_date) || '', sanitizeDate(formData.actual_delivery_date) || '',
        formData.loadman_name || '', formData.loadman_worker_id || null, parseFloat(formData.loadman_rate_per_kg) || 0.5, parseFloat(formData.loadman_charges) || 0,
        norm.weighmentMode, norm.vehicleGrossWeight, norm.vehicleTareWeight, norm.netLoadWeight, norm.totalPkgTareWt, norm.totalProductNetWt,
        sanitizeDate(formData.weighment_date) || norm.saleDate, formData.weighment_time || '', formData.weighbridge_name || '', formData.weighment_slip_no || '', formData.weighed_by || '',
        norm.autoOutpass, formData.loading_location || norm.defaultGodown.godown_name, formData.delivery_location || norm.shippingAddress,
        formData.freight_type || 'Fixed', parseFloat(formData.freight_rate) || 0, norm.freightAmount, norm.freightPaidBy, norm.recoverFreight, formData.freight_payment_status || 'Pending',
        norm.freightRecoveryAmt, norm.loadingChargesAmt, norm.otherCharges, norm.tcsAmount, norm.roundOff,
        norm.totalQty, norm.totalProductNetWt, norm.totalProductNetWt, norm.grossAmt, parseFloat(formData.disc_percent) || 0, norm.discAmt,
        norm.billAmt, norm.billAmt, norm.billAmt, norm.taxAmt, norm.taxAmt,
        norm.cgstAmt, norm.sgstAmt, norm.igstAmt, norm.cgstAmt, norm.sgstAmt, norm.igstAmt,
        norm.totalAmt, norm.grandTotal, norm.grandTotal, formData.deduction || '', formData.deduction_remarks || '', norm.netDeductionAmount, norm.deductionsJson,
        formData.payment_mode || formData.pay_type || 'Credit', norm.receivedAmount, norm.advanceAdjusted, norm.balanceReceivable, formData.bank_account_id || null, formData.bank_account_name || '', formData.transaction_ref || '', sanitizeDate(formData.payment_date) || norm.saleDate,
        formData.dispatch_no || '', formData.dispatch_datetime || '', formData.dispatch_status || existingSale.dispatch_status || 'Invoice Created',
        formData.delivery_challan_no || '', formData.eway_bill_no || '', sanitizeDate(formData.eway_bill_validity) || '', formData.irn_no || '', formData.ack_no || '', formData.received_by || '', formData.delivery_remarks || '',
        formData.remarks || '', formData.sign || '', norm.isOrder ? 1 : 0,
        salesId
      ]
    );

    await runner.run(`DELETE FROM sales_items WHERE sales_id = ?`, [salesId]);

    for (const it of norm.normalizedItems) {
      await runner.run(
        `INSERT INTO sales_items (
           sales_id, item_id, product_code, item_name, category, hsn_code, lot_no, parent_rm_lot_no,
           godown_id, godown_name, package_type, package_tare_wt, uom, weight, qty, total_wt, net_product_wt, allocated_load_wt,
           rate, rate_type, disc_perc, disc, disc_amount, taxable_amount, tax_perc, tax_rate, gst_rate, tax_type, tax_amount,
           cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount, total_amt, amount, total_amount, box
         ) VALUES (${new Array(39).fill('?').join(', ')})`,
        [
          salesId, it.item_id, it.product_code, it.item_name, it.category, it.hsn_code, it.lot_no, it.parent_rm_lot_no,
          it.godown_id, it.godown_name, it.package_type, it.package_tare_wt, it.uom, it.weight, it.qty, it.total_wt, it.net_product_wt, it.allocated_load_wt,
          it.rate, it.rate_type, it.disc_perc, it.disc_perc, it.disc_amount, it.taxable_amount, it.tax_perc, it.tax_perc, it.gst_rate, it.tax_type, it.tax_amount,
          it.cgst_rate, it.cgst_amount, it.sgst_rate, it.sgst_amount, it.igst_rate, it.igst_amount, it.total_amt, it.total_amt, it.total_amt, it.box
        ]
      );

      if (!norm.isOrder) {
        await validateAndDeductSalesStock({ companyId: cId, runner, salesId, saleDate: norm.saleDate, item: it });
      }
    }

    const opRes = await upsertLinkedOutpass({
      companyId: cId,
      runner,
      salesId,
      billNo,
      existingOutpassId: existingSale.outpass_id,
      existingOutpassNo: existingSale.outpass_no,
      formData,
      norm,
      username
    });

    const accRes = await postSalesAccounting({
      companyId: cId,
      runner,
      salesId,
      billNo,
      formData,
      norm,
      existingSale
    });

    await runner.run(
      `UPDATE sales SET outpass_id = ?, outpass_no = ?, outpass_status = ?, voucher_no = ?, freight_voucher_no = ?, receipt_voucher_no = ? WHERE id = ?`,
      [opRes.outpassId, opRes.outpassNo, opRes.outpassStatus, accRes.voucherNo, accRes.freightVoucherNo, accRes.receiptVoucherNo, salesId]
    );

    return { salesId, billNo, ...opRes, ...accRes, norm };
  });

  try {
    if (txResult.norm.isOrder) {
      await deleteDocumentMovements(cId, 'SALES', salesId, 'Converted/Saved as Sales Order', username);
    } else {
      await syncDocumentMovements(cId, 'SALES', salesId, username);
    }
  } catch (e) {
    console.error('Error syncing stock movements after updateSale:', e);
  }

  return {
    success: true,
    id: Number(salesId),
    s_no: txResult.billNo,
    voucher_no: txResult.voucherNo,
    freight_voucher_no: txResult.freightVoucherNo,
    receipt_voucher_no: txResult.receiptVoucherNo,
    outpass_id: txResult.outpassId,
    outpass_no: txResult.outpassNo,
    grand_total: txResult.norm.grandTotal,
    balance_receivable: txResult.norm.balanceReceivable
  };
}

async function deleteSale(companyId = 1, salesId, user = null) {
  const cId = parseInt(companyId, 10) || 1;
  await ensureSalesSchema(cId);
  const runner = db.forCompany(cId);
  const username = user?.username || 'admin';

  await runner.withTransaction(async () => {
    const sRes = await runner.query(`SELECT * FROM sales WHERE id = ? LIMIT 1`, [salesId]);
    if (!sRes.rows || sRes.rows.length === 0) {
      const err = new Error('Sales record not found');
      err.statusCode = 404;
      throw err;
    }
    const sRow = sRes.rows[0];
    const sItems = await runner.query(`SELECT * FROM sales_items WHERE sales_id = ?`, [salesId]);

    try {
      await recycleBinService.saveToRecycleBin({
        moduleName: 'Sales',
        recordId: salesId,
        title: `Sales Invoice #${sRow.inv_no || sRow.s_no || salesId} - ${sRow.customer || 'Customer'}`,
        recordData: {
          tableName: 'sales',
          record: sRow,
          subRecords: [{ tableName: 'sales_items', records: sItems.rows || [] }]
        },
        deletedBy: username
      });
    } catch (e) {
      console.warn('Recycle bin save error in sales:', e.message);
    }

    await revertSalesStock(salesId, runner);

    if (sRow.outpass_id) {
      await runner.run(`DELETE FROM outpass_items WHERE outpass_id = ?`, [sRow.outpass_id]);
      await runner.run(`DELETE FROM outpasses WHERE id = ?`, [sRow.outpass_id]);
    } else {
      const linkedOp = await runner.query(`SELECT id FROM outpasses WHERE reference_type = 'SALES' AND reference_id = ?`, [salesId]);
      for (const op of linkedOp.rows || []) {
        await runner.run(`DELETE FROM outpass_items WHERE outpass_id = ?`, [op.id]);
        await runner.run(`DELETE FROM outpasses WHERE id = ?`, [op.id]);
      }
    }

    await deleteSalesVoucherChain(salesId, cId);
    await runner.run(`DELETE FROM sales_items WHERE sales_id = ?`, [salesId]);
    await runner.run(`DELETE FROM sales WHERE id = ?`, [salesId]);
  });

  try {
    await deleteDocumentMovements(cId, 'SALES', salesId, 'Sales record deleted', username);
  } catch (e) {
    console.error('Error reversing stock movements after deleting sale:', e);
  }

  return { success: true, message: 'Sales record deleted successfully' };
}

module.exports = {
  ensureSalesSchema,
  getNextOutpassNo,
  getNextSalesNo,
  getFormLookups,
  getCustomerContext,
  getAvailableLots,
  normalizeSalesDeductions,
  createSale,
  updateSale,
  deleteSale
};
