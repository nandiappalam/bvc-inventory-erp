const express = require('express')
const router = express.Router()
const db = require('../config/database')
const recycleBinService = require('../services/RecycleBinService')

// Helper function to check if table exists
async function tableExists(tableName) {
  try {
    const result = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
      [tableName]
    )
    return result.rows.length > 0
  } catch (error) {
    console.error(`Error checking if table '${tableName}' exists:`, error.message)
    return false
  }
}

// Helper function to check if column exists in a table
async function columnExists(tableName, columnName) {
  try {
    const result = await db.query(`PRAGMA table_info(${tableName})`)
    return result.rows.some(col => col.name === columnName)
  } catch (error) {
    console.error(`Error checking column '${columnName}' in '${tableName}':`, error.message)
    return false
  }
}

// Helper function to resolve alias to table name and configuration
const resolveTableConfig = (tableParam) => {
  const actualTable = masterTypeAliases[tableParam] ? masterTypeAliases[tableParam].table : tableParam;
  return {
    tableName: actualTable,
    tableConfig: masterTables[actualTable] || null
  };
};

const normalizeMasterData = async (tableName, rawData) => {
  const tableColumnsResult = await db.query(`PRAGMA table_info(${tableName})`);
  const actualColumns = new Set(tableColumnsResult.rows.map(col => col.name));

  const fieldSynonyms = {
    deduction_name: 'ded_name',
    deduction_type: 'ded_type',
    affect_cost: 'affect_cost_of_goods',
    debit_side_adjust: 'debit_adjust',
    calculation_type: 'calc_type',
    deduction_value: 'ded_value',
    address1: 'address',
    mobile1: 'mobile',
  };

  const filteredData = {};
  
  // First, copy exact columns
  for (const col of actualColumns) {
    if (rawData[col] !== undefined) {
      filteredData[col] = rawData[col];
    }
  }

  // Next, try mapping synonyms for columns that are still undefined
  for (const [syn, col] of Object.entries(fieldSynonyms)) {
    if (actualColumns.has(col) && filteredData[col] === undefined && rawData[syn] !== undefined) {
      filteredData[col] = rawData[syn];
    }
  }

  // Handle auto-generation of ded_code if table requires it
  if (actualColumns.has('ded_code') && (!filteredData.ded_code || String(filteredData.ded_code).trim() === '')) {
    const nameToUse = filteredData.ded_name || rawData.ded_name || rawData.deduction_name || 'DED';
    const cleanName = nameToUse.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    filteredData.ded_code = `${cleanName}${randomSuffix}`;
  }

  // Handle active status by default if table has status column and it's not set
  if (actualColumns.has('status') && filteredData.status === undefined) {
    filteredData.status = 'Active';
  }

  // ========================================================================
  // PostgreSQL Compatibility: Convert empty strings to NULL for numeric fields
  // This prevents "invalid input syntax for type numeric" errors
  // ========================================================================
  const isPg = typeof db.isPostgres === 'function' ? db.isPostgres() : db.isPostgres;
  if (isPg) {
    const numericFields = ['tax', 'gst_rate', 'rate', 'weight', 'qty', 'amount', 'value',
      'opening_balance', 'wages_kg', 'ed_percent', 'minimum_qty', 'reorder_level',
      'critical_level', 'limit_days', 'limit_amount', 'ded_value', 'deduction_value',
      'opening_advance', 'opening_balance_type'];
    
    for (const field of numericFields) {
      if (field in filteredData && filteredData[field] === '') {
        filteredData[field] = null;
      }
    }
  }

  return filteredData;
};

// Master type aliases mapping
// hasStatus: true = table has status column and we filter by Active
// hasStatus: false = table doesn't have status column, return all records
// NOTE: Fixed hasStatus to correctly reflect which tables actually have status column
const masterTypeAliases = {
  // Type aliases (frontend-friendly names) -> { table, displayField, hasStatus }
  item: { table: 'item_master', displayField: 'item_name', hasStatus: true },
  items: { table: 'item_master', displayField: 'item_name', hasStatus: true },
  item_master: { table: 'item_master', displayField: 'item_name', hasStatus: true },
  items_master: { table: 'item_master', displayField: 'item_name', hasStatus: true },
  group: { table: 'item_groups', displayField: 'group_name', hasStatus: false },
  groups: { table: 'item_groups', displayField: 'group_name', hasStatus: false },
  item_group: { table: 'item_groups', displayField: 'group_name', hasStatus: false },
  item_groups: { table: 'item_groups', displayField: 'group_name', hasStatus: false },
  deduction_sale: { table: 'deduction_sales', displayField: 'ded_name', hasStatus: false },
  deduction_sales: { table: 'deduction_sales', displayField: 'ded_name', hasStatus: false },
  deduction_purchase: { table: 'deduction_purchase', displayField: 'ded_name', hasStatus: false },
  customer: { table: 'customer_master', displayField: 'name', hasStatus: true },
  customers: { table: 'customer_master', displayField: 'name', hasStatus: true },
  supplier: { table: 'supplier_master', displayField: 'name', hasStatus: true },
  suppliers: { table: 'supplier_master', displayField: 'name', hasStatus: true },
  flour_mill: { table: 'flour_mill_master', displayField: 'flourmill', hasStatus: true },
  flour_mills: { table: 'flour_mill_master', displayField: 'flourmill', hasStatus: true },
  papad_company: { table: 'papad_company_master', displayField: 'name', hasStatus: true },
  papad_companies: { table: 'papad_company_master', displayField: 'name', hasStatus: true },
  weight: { table: 'weightmaster', displayField: 'name', hasStatus: true },
  weights: { table: 'weightmaster', displayField: 'name', hasStatus: true },
  ledger_group: { table: 'ledgergroupmaster', displayField: 'name', hasStatus: true },
  ledger_groups: { table: 'ledgergroupmaster', displayField: 'name', hasStatus: true },
  ledger: { table: 'ledgermaster', displayField: 'name', hasStatus: false },
  ledgers: { table: 'ledgermaster', displayField: 'name', hasStatus: false },
  area: { table: 'area_master', displayField: 'name', hasStatus: true },
  areas: { table: 'area_master', displayField: 'name', hasStatus: true },
  city: { table: 'city_master', displayField: 'name', hasStatus: true },
  cities: { table: 'city_master', displayField: 'name', hasStatus: true },
  consignee: { table: 'consignee_group_master', displayField: 'name', hasStatus: true },
  consignees: { table: 'consignee_group_master', displayField: 'name', hasStatus: true },
  ptrans: { table: 'ptrans_master', displayField: 'name', hasStatus: true },
  sender: { table: 'sender_group_master', displayField: 'name', hasStatus: true },
  senders: { table: 'sender_group_master', displayField: 'name', hasStatus: true },
  transport: { table: 'transport_master', displayField: 'name', hasStatus: true },
  transports: { table: 'transport_master', displayField: 'name', hasStatus: true },
  godown: { table: 'godown_master', displayField: 'godown_name', hasStatus: false },
  godowns: { table: 'godown_master', displayField: 'godown_name', hasStatus: false },
  employee: { table: 'employee_master', displayField: 'name', hasStatus: true },
  employees: { table: 'employee_master', displayField: 'name', hasStatus: true },
  employee_master: { table: 'employee_master', displayField: 'name', hasStatus: true },
  // Legacy table names also supported
  customer_master: { table: 'customer_master', displayField: 'name', hasStatus: true },
  supplier_master: { table: 'supplier_master', displayField: 'name', hasStatus: true },
  flour_mill_master: { table: 'flour_mill_master', displayField: 'flourmill', hasStatus: true },
  flourmill_master: { table: 'flour_mill_master', displayField: 'flourmill', hasStatus: true },
  papad_company_master: { table: 'papad_company_master', displayField: 'name', hasStatus: true },
  papadcompany_master: { table: 'papad_company_master', displayField: 'name', hasStatus: true },
  weightmaster: { table: 'weightmaster', displayField: 'name', hasStatus: false },
  weight_master: { table: 'weightmaster', displayField: 'name', hasStatus: false },
  ledgergroupmaster: { table: 'ledgergroupmaster', displayField: 'name', hasStatus: false },
  ledger_group_master: { table: 'ledgergroupmaster', displayField: 'name', hasStatus: false },
  ledgermaster: { table: 'ledgermaster', displayField: 'name', hasStatus: false },
  ledger_master: { table: 'ledgermaster', displayField: 'name', hasStatus: false },
  area_master: { table: 'area_master', displayField: 'name', hasStatus: true },
  city_master: { table: 'city_master', displayField: 'name', hasStatus: true },
  transport_master: { table: 'transport_master', displayField: 'name', hasStatus: true },
  consignee_master: { table: 'consignee_group_master', displayField: 'name', hasStatus: true },
  consignee_group_master: { table: 'consignee_group_master', displayField: 'name', hasStatus: true },
  sender_master: { table: 'sender_group_master', displayField: 'name', hasStatus: true },
  sender_group_master: { table: 'sender_group_master', displayField: 'name', hasStatus: true },
  person_master: { table: 'person_master', displayField: 'name', hasStatus: true },
  godown_master: { table: 'godown_master', displayField: 'godown_name', hasStatus: false },
  godown_creation: { table: 'godown_master', displayField: 'godown_name', hasStatus: false },
  purchase_orders: { table: 'purchase_orders', displayField: 'id', hasStatus: false },
  purchase_deduction_master: { table: 'deduction_purchase', displayField: 'ded_name', hasStatus: false },
  quotations: { table: 'quotations', displayField: 'customer', hasStatus: false },
  tax: { table: 'tax_master', displayField: 'tax_name', hasStatus: true },
  taxes: { table: 'tax_master', displayField: 'tax_name', hasStatus: true },
  tax_master: { table: 'tax_master', displayField: 'tax_name', hasStatus: true },
}

// Master tables mapping with fields
// NOTE: Fixed to match actual schema from database/schema.sql
const masterTables = {
  tax_master: {
    table: 'tax_master',
    fields: ['id', 'tax_name', 'hsn_code', 'tax_type', 'description', 'gst_rate', 'cgst_rate', 'sgst_rate', 'igst_rate', 'cess_rate', 'calc_type', 'effective_from', 'effective_to', 'status', 'remarks'],
    uniqueField: 'id',
    displayField: 'tax_name'
  },
  purchase_orders: {
    table: 'purchase_orders',
    fields: ['id', 's_no', 'supplier_id', 'date', 'inv_no', 'remarks'],
    uniqueField: 'id',
    displayField: 'id'
  },
  quotations: {
    table: 'quotations',
    fields: ['id', 's_no', 'date', 'customer', 'item_name', 'lot_no', 'qty', 'amount', 'bill_no', 'pay_type', 'tax_type', 'type', 'remarks', 'address', 'tax_percent', 'bill_amt', 'tax_amt', 'total_amt', 'deduction', 'percent', 'deduction_amount', 'deduction_remarks'],
    uniqueField: 'id',
    displayField: 'customer'
  },
  item_master: {
    table: 'item_master',
    fields: ['item_code', 'item_name', 'print_name', 'item_group', 'type', 'tax', 'hsn_code', 'status', 'lab_parameters'],
    uniqueField: 'item_code',
    displayField: 'item_name'
  },

  item_groups: {
    table: 'item_groups',
    fields: ['group_code', 'group_name', 'print_name', 'tax'],
    uniqueField: 'group_code',
    displayField: 'group_name'
  },
  deduction_sales: {
    table: 'deduction_sales',
    fields: ['ded_code', 'ded_name', 'print_name', 'adjust_with_sales', 'account_head', 'ded_type', 'calc_type', 'ded_value', 'status'],
    uniqueField: 'ded_code',
    displayField: 'ded_name'
  },
  deduction_purchase: {
    table: 'deduction_purchase',
    fields: ['ded_code', 'ded_name', 'print_name', 'debit_adjust', 'account_head', 'credit_adjust', 'ded_type', 'calc_type', 'status'],
    uniqueField: 'ded_code',
    displayField: 'ded_name'
  },
  customer_master: {
    table: 'customer_master',
    fields: ['name', 'print_name', 'contact_person', 'address1', 'phone_res', 'phone_off', 'mobile1', 'email', 'gst_number', 'area', 'transport', 'limit_days', 'limit_amount', 'opening_balance', 'balance_type', 'status'],
    uniqueField: 'name',
    displayField: 'name'
  },
  supplier_master: {
    table: 'supplier_master',
    fields: ['name', 'print_name', 'contact_person', 'address1', 'phone_res', 'phone_off', 'mobile1', 'email', 'gst_number', 'area', 'transport', 'limit_days', 'limit_amount', 'opening_balance', 'balance_type', 'status'],
    uniqueField: 'name',
    displayField: 'name'
  },
  flour_mill_master: {
    table: 'flour_mill_master',
    fields: ['flourmill', 'print_name', 'contact_person', 'address', 'area', 'phone_res', 'phone_off', 'mobile', 'tin_no', 'wages_kg', 'opening_balance', 'opening_balance_type', 'status'],
    uniqueField: 'flourmill',
    displayField: 'flourmill'
  },
  papad_company_master: {
    table: 'papad_company_master',
    fields: ['name', 'print_name', 'contact_person', 'address1', 'address2', 'address3', 'address4', 'gst_no', 'phone_off', 'phone_res', 'mobile1', 'mobile2', 'area', 'wages_kg', 'opening_balance', 'opening_advance', 'status'],
    uniqueField: 'name',
    displayField: 'name'
  },
  weightmaster: {
    table: 'weightmaster',
    fields: ['name', 'printname', 'weight', 'status'],
    uniqueField: 'name',
    displayField: 'name'
  },
  ledgergroupmaster: {
    table: 'ledgergroupmaster',
    fields: ['name', 'printname', 'under', 'status'],
    uniqueField: 'name',
    displayField: 'name'
  },
  ledgermaster: {
    table: 'ledgermaster',
    fields: ['name', 'printname', 'alias_name', 'under', 'openingbalance', 'opening_type', 'ledger_type', 'status'],
    uniqueField: 'name',
    displayField: 'name'
  },
  area_master: {
    table: 'area_master',
    fields: ['name', 'print_name', 'status'],
    uniqueField: 'name',
    displayField: 'name'
  },
  city_master: {
    table: 'city_master',
    fields: ['name', 'print_name', 'status'],
    uniqueField: 'name',
    displayField: 'name'
  },
  transport_master: {
    table: 'transport_master',
    fields: ['name', 'print_name', 'status'],
    uniqueField: 'name',
    displayField: 'name'
  },
  consignee_group_master: {
    table: 'consignee_group_master',
    fields: ['name', 'print_name', 'contact_person', 'address', 'area', 'phone_res', 'phone_off', 'mobile', 'tin_no', 'status'],
    uniqueField: 'name',
    displayField: 'name'
  },
  sender_group_master: {
    table: 'sender_group_master',
    fields: ['name', 'print_name', 'contact_person', 'address', 'area', 'phone_res', 'phone_off', 'mobile', 'tin_no', 'status'],
    uniqueField: 'name',
    displayField: 'name'
  },
  person_master: {
    table: 'person_master',
    fields: ['name', 'print_name', 'contact_person', 'address', 'area', 'phone_res', 'phone_off', 'mobile', 'status'],
    uniqueField: 'name',
    displayField: 'name'
  },
  ptrans_master: {
    table: 'ptrans_master',
    fields: ['name', 'print_name', 'status'],
    uniqueField: 'name',
    displayField: 'name'
  },
  godown_master: {
    table: 'godown_master',
    fields: ['godown_name', 'print_name', 'contact_person', 'address', 'phone_off', 'mobile1', 'email', 'website', 'area', 'gst_number', 'status'],
    uniqueField: 'godown_name',
    displayField: 'godown_name'
  }
}

// Validate master type to prevent SQL injection
const validateMasterType = (type) => {
  if (!type || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(type)) {
    return null
  }
  // First check if it's directly in aliases
  if (masterTypeAliases[type]) {
    return type
  }
  // Check if it's a table name directly
  if (masterTables[type]) {
    return type
  }
  return null
}

// Get display field name for a master type
const getDisplayField = (type) => {
  const config = masterTypeAliases[type] || masterTables[type]
  if (config && config.displayField) return config.displayField;
  if (config && config.uniqueField) return config.uniqueField;
  return 'name';
}

// Get table config for a master type
const getTableConfig = (type) => {
  return masterTypeAliases[type] || masterTables[type] || null
}

// ============================================================================
// GENERIC API: Get Active records only, ordered by name ASC
// Returns: [{ id: 1, name: "ABC" }]
// ============================================================================
router.get('/:type', async (req, res, next) => {
  // Let the more specific legacy routes below handle /all/* and /record/*.
  if (req.params.type === 'all' || req.params.type === 'record') {
    return next();
  }

  try {
    const type = validateMasterType(req.params.type)
    
    if (!type) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid master type.' 
      })
    }

    const config = getTableConfig(type)
    if (!config) {
      return res.status(400).json({ message: 'Master configuration not found' })
    }

    const tableName = config.table || type
    
    // Check if table exists
    const exists = await tableExists(tableName)
    if (!exists) {
      console.log(`Table '${tableName}' does not exist`)
      return res.json({ success: true, data: [] })
    }
    
    let displayField = getDisplayField(type)
    let hasStatus = config ? config.hasStatus : false
    if (hasStatus) {
      const colExists = await columnExists(tableName, 'status')
      if (!colExists) {
        hasStatus = false
      }
    }

    // Safely check if displayField exists in database table
    let orderClause = ''
    if (displayField && displayField !== 'undefined') {
      const colExists = await columnExists(tableName, displayField)
      if (colExists) {
        orderClause = ` ORDER BY ${displayField} ASC`
      } else {
        const nameExists = await columnExists(tableName, 'name')
        if (nameExists) {
          displayField = 'name'
          orderClause = ` ORDER BY name ASC`
        } else {
          const idExists = await columnExists(tableName, 'id')
          if (idExists) {
            displayField = 'id'
            orderClause = ` ORDER BY id ASC`
          }
        }
      }
    }

    // Build query - filter active only if table has status field
    let query = `SELECT * FROM ${tableName}`
    const params = []
    
    if (tableName === 'item_master') {
      // 1. Fetch base items from item_master with their current calculated stock
      const imQuery = `
        SELECT 
          im.id,
          im.item_code,
          im.item_name,
          COALESCE(im.print_name, im.item_name) as print_name,
          COALESCE(im.item_group, 'General') as item_group,
          COALESCE(im.type, 'Raw Material') as type,
          im.tax,
          im.hsn_code,
          im.status,
          im.lab_parameters,
          COALESCE(s.stock_qty, 0) as stock_qty
        FROM item_master im
        LEFT JOIN (
          SELECT item_name, SUM(qty) as stock_qty 
          FROM stock 
          GROUP BY item_name
        ) s ON LOWER(TRIM(s.item_name)) = LOWER(TRIM(im.item_name))
        WHERE (im.status = 'Active' OR im.status IS NULL OR im.status = '')
        ORDER BY im.item_group ASC, im.item_name ASC
      `
      const imRes = await db.query(imQuery, params)
      const itemMap = new Map()

      ;(imRes.rows || []).forEach(r => {
        const itemName = r.item_name || r.name || ''
        const key = String(itemName).trim().toLowerCase()
        if (key) {
          const isFG = key.includes('fg') || key.includes('finish') || key.includes('papad') || key.includes('pack')
          const isOpening = key.includes('opening') || key.includes('open')
          const isWastage = key.includes('wastage') || key.includes('reject') || key.includes('scrap')
          const itemType = isWastage ? 'Rejection / Wastage' : isFG ? 'Finished Goods' : isOpening ? 'Opening Stock' : (r.type || 'Raw Material')
          const itemGroup = isWastage ? 'Rejection / Wastage' : isFG ? 'Finished Goods' : isOpening ? 'Opening Stock' : (r.item_group || itemType)
          const typeKey = itemType.toLowerCase().replace(/[^a-z0-9]/g, '')
          const mapKey = `${key}_${typeKey}`

          if (!itemMap.has(mapKey)) {
            itemMap.set(mapKey, {
              ...r,
              id: r.id || r.item_code || `${key}_${typeKey}`,
              name: itemName,
              item_name: itemName,
              print_name: r.print_name || itemName,
              item_group: itemGroup,
              type: itemType,
              stock_qty: parseFloat(r.stock_qty || 0)
            })
          } else {
            const existing = itemMap.get(mapKey)
            existing.stock_qty = (existing.stock_qty || 0) + parseFloat(r.stock_qty || 0)
          }
        }
      })

      // 2. Scan stock_lots for any additional finished goods, opening stock, or lots by category and godown
      try {
        const slRes = await db.query(`
          SELECT 
            item_name, 
            category,
            godown,
            SUM(remaining_quantity) as total_qty
          FROM stock_lots 
          WHERE item_name IS NOT NULL AND TRIM(item_name) != ''
          GROUP BY item_name, category, godown
        `)
        ;(slRes.rows || []).forEach(sl => {
          const itemName = sl.item_name
          const cat = String(sl.category || '').toUpperCase()
          const godown = String(sl.godown || '').toLowerCase()
          const keyName = String(itemName).trim().toLowerCase()

          const isFG = cat === 'FG' || godown.includes('finished') || keyName.includes('fg') || keyName.includes('finish') || keyName.includes('papad')
          const isOpening = cat === 'OPEN' || cat === 'OS' || godown.includes('pj') || keyName.includes('opening') || keyName.includes('open')
          const isWastage = cat === 'WASTAGE' || cat === 'REJECT' || godown.includes('wastage') || keyName.includes('wastage') || keyName.includes('reject')

          const itemType = isWastage ? 'Rejection / Wastage' : isFG ? 'Finished Goods' : isOpening ? 'Opening Stock' : 'Raw Material'
          const itemGroup = itemType
          const qty = parseFloat(sl.total_qty || 0)
          const typeKey = itemType.toLowerCase().replace(/[^a-z0-9]/g, '')
          const mapKey = `${keyName}_${typeKey}`

          if (!itemMap.has(mapKey)) {
            itemMap.set(mapKey, {
              id: `lot_${keyName.replace(/[^a-z0-9]/g, '_')}_${typeKey}`,
              item_code: `${itemType.substring(0, 3).toUpperCase()}-${keyName.substring(0, 4).toUpperCase()}`,
              name: itemName,
              item_name: itemName,
              print_name: itemName,
              item_group: itemGroup,
              type: itemType,
              tax: 5,
              status: 'Active',
              stock_qty: qty
            })
          } else {
            const existing = itemMap.get(mapKey)
            existing.stock_qty = (existing.stock_qty || 0) + qty
          }
        })
      } catch (e) {}

      // 3. Scan open / open_items (Opening Stocks)
      try {
        const openRes = await db.query(`
          SELECT 
            COALESCE(oi.item_name, o.item_name, 'Opening Stock Item') as item_name,
            SUM(COALESCE(oi.qty, o.qty, 0)) as total_qty
          FROM open o
          LEFT JOIN open_items oi ON CAST(oi.open_id AS TEXT) = CAST(o.id AS TEXT)
          WHERE COALESCE(oi.item_name, o.item_name) IS NOT NULL
          GROUP BY COALESCE(oi.item_name, o.item_name)
        `)
        ;(openRes.rows || []).forEach(op => {
          const key = String(op.item_name).trim().toLowerCase()
          const typeKey = 'openingstock'
          const mapKey = `${key}_${typeKey}`
          if (!itemMap.has(mapKey)) {
            itemMap.set(mapKey, {
              id: `open_${key.replace(/\s+/g, '_')}`,
              item_code: `OPEN-${key.substring(0, 4).toUpperCase()}`,
              name: op.item_name,
              item_name: op.item_name,
              print_name: op.item_name,
              item_group: 'Opening Stock',
              type: 'Opening Stock',
              tax: 5,
              status: 'Active',
              stock_qty: parseFloat(op.total_qty || 0)
            })
          } else {
            const existing = itemMap.get(mapKey)
            if (existing.stock_qty === 0) existing.stock_qty = parseFloat(op.total_qty || 0)
          }
        })
      } catch (e) {}

      // 4. Scan papad_in / packing (Finished Goods)
      try {
        const papadRes = await db.query(`
          SELECT 
            COALESCE(pcm.name, pi.item_name, 'Finished Papad') as item_name,
            SUM(COALESCE(pi.qty, 0)) as total_qty
          FROM papad_in pi
          LEFT JOIN papad_company_master pcm ON (CAST(pcm.id AS TEXT) = CAST(pi.papad_company_id AS TEXT) OR pcm.name = pi.papad_company_id)
          GROUP BY COALESCE(pcm.name, pi.item_name, 'Finished Papad')
        `)
        ;(papadRes.rows || []).forEach(p => {
          const key = String(p.item_name).trim().toLowerCase()
          const typeKey = 'finishedgoods'
          const mapKey = `${key}_${typeKey}`
          if (!itemMap.has(mapKey)) {
            itemMap.set(mapKey, {
              id: `fg_${key.replace(/\s+/g, '_')}`,
              item_code: `FG-${key.substring(0, 4).toUpperCase()}`,
              name: p.item_name,
              item_name: p.item_name,
              print_name: p.item_name,
              item_group: 'Finished Goods',
              type: 'Finished Goods',
              tax: 5,
              status: 'Active',
              stock_qty: parseFloat(p.total_qty || 0)
            })
          } else {
            const existing = itemMap.get(mapKey)
            if (existing.stock_qty === 0) existing.stock_qty = parseFloat(p.total_qty || 0)
          }
        })
      } catch (e) {}

      // 5. Scan stock table directly
      try {
        const stockRes = await db.query(`
          SELECT 
            item_name,
            SUM(qty) as total_qty
          FROM stock
          WHERE item_name IS NOT NULL AND TRIM(item_name) != ''
          GROUP BY item_name
        `)
        ;(stockRes.rows || []).forEach(st => {
          const key = String(st.item_name).trim().toLowerCase()
          const isFG = key.includes('fg') || key.includes('finish') || key.includes('papad') || key.includes('pack')
          const isOpening = key.includes('open') || key.includes('opening')
          const isWastage = key.includes('waste') || key.includes('reject')
          const itemType = isWastage ? 'Rejection / Wastage' : isFG ? 'Finished Goods' : isOpening ? 'Opening Stock' : 'Raw Material'
          const itemGroup = itemType
          const typeKey = itemType.toLowerCase().replace(/[^a-z0-9]/g, '')
          const mapKey = `${key}_${typeKey}`

          if (!itemMap.has(mapKey)) {
            itemMap.set(mapKey, {
              id: `stock_${key.replace(/\s+/g, '_')}_${typeKey}`,
              item_code: `STK-${key.substring(0, 4).toUpperCase()}`,
              name: st.item_name,
              item_name: st.item_name,
              print_name: st.item_name,
              item_group: itemGroup,
              type: itemType,
              tax: 5,
              status: 'Active',
              stock_qty: parseFloat(st.total_qty || 0)
            })
          } else {
            const existing = itemMap.get(mapKey)
            if (existing.stock_qty === 0) {
              existing.stock_qty = parseFloat(st.total_qty || 0)
            }
          }
        })
      } catch (e) {}

      const allItemsList = Array.from(itemMap.values())
      return res.json({ success: true, data: allItemsList })
    } else {
      if (hasStatus) {
        query += ` WHERE (status = 'Active' OR status IS NULL OR status = '')`
      }
      query += orderClause
    }

    const result = await db.query(query, params)
    
    // Return simplified format [{ id, name }]
    const simplified = result.rows.map(row => ({
      ...row,
      id: row.id || row[displayField] || row.name || row.item_code || row.godown_name,
      godown_name: row.godown_name || row.name || row[displayField] || '',
      name: row[displayField] || row.name || row.item_name || row.godown_name || row.ded_name || row.flourmill || ''
    }))

    res.json({ success: true, data: simplified })
  } catch (error) {
    console.error('Error fetching master records:', error)
    res.json({ success: false, data: [], error: error.message })
  }
})

// ============================================================================
// GET ALL RECORDS (Legacy - returns full records)
// ============================================================================
router.get('/all/:table', async (req, res) => {
  try {
    const tableNameParam = req.params.table
    const { tableName, tableConfig } = resolveTableConfig(tableNameParam)

    if (!tableName) {
      return res.status(400).json({ message: 'Invalid master table' })
    }

    const result = await db.query(`SELECT * FROM ${tableName}`)
    res.json({ success: true, data: result.rows })
  } catch (error) {
    console.error('Error fetching master records:', error)
    res.status(500).json({ message: 'Error fetching records', error: error.message })
  }
})

// ============================================================================
// GET SINGLE RECORD BY ID
// ============================================================================
router.get('/record/:table/:id', async (req, res) => {
  try {
    const tableNameParam = req.params.table
    const { tableName, tableConfig } = resolveTableConfig(tableNameParam)

    if (!tableName) {
      return res.status(400).json({ message: 'Invalid master table' })
    }

    const paramId = req.params.id

    // Try finding by id (with cast), then by unique field or display field
    let result = { rows: [] }
    try {
      result = await db.query(`SELECT * FROM ${tableName} WHERE CAST(id AS TEXT) = ?`, [String(paramId)])
    } catch (e1) {}

    if (result.rows.length === 0 && tableConfig?.uniqueField && tableConfig.uniqueField !== 'id') {
      try {
        result = await db.query(`SELECT * FROM ${tableName} WHERE CAST(${tableConfig.uniqueField} AS TEXT) = ?`, [String(paramId)])
      } catch (e2) {}
    }

    if (result.rows.length === 0 && tableConfig?.displayField) {
      try {
        result = await db.query(`SELECT * FROM ${tableName} WHERE ${tableConfig.displayField} = ?`, [String(paramId)])
      } catch (e3) {}
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Record not found' })
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error('Error fetching master record:', error)
    res.status(500).json({ message: 'Error fetching record', error: error.message })
  }
})


// ============================================================================
// POST CREATE NEW RECORD - Short form /:table (matches frontend call)
// ============================================================================
router.post("/:table", async (req, res) => {
  try {
    const { table } = req.params;
    const data = req.body;

    console.log("📦 Incoming:", data);

    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Empty request body",
      });
    }

    const { tableName, tableConfig } = resolveTableConfig(table);
    if (!tableName) {
      return res.status(400).json({ message: 'Invalid master table' })
    }

    const filteredData = await normalizeMasterData(tableName, data);
    const keys = Object.keys(filteredData);
    const values = Object.values(filteredData);

    if (keys.length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields to insert" });
    }

    const placeholders = keys.map(() => "?").join(",");
    const query = `INSERT INTO ${tableName} (${keys.join(",")}) VALUES (${placeholders})`;

    // Check if record with unique field already exists (e.g. name, ledgermaster.name)
    const uniqueCol = tableConfig?.uniqueField || 'name';
    if (filteredData[uniqueCol]) {
      try {
        const checkQuery = `SELECT id FROM ${tableName} WHERE LOWER(TRIM(${uniqueCol})) = LOWER(TRIM(?)) LIMIT 1`;
        const existingCheck = await db.query(checkQuery, [String(filteredData[uniqueCol]).trim()]);
        if (existingCheck.rows && existingCheck.rows.length > 0) {
          const existingId = existingCheck.rows[0].id;
          const updateKeys = keys.filter(k => k !== 'id');
          const updateSet = updateKeys.map(k => `${k} = ?`).join(', ');
          const updateVals = updateKeys.map(k => filteredData[k]);
          await db.run(`UPDATE ${tableName} SET ${updateSet} WHERE id = ?`, [...updateVals, existingId]);
          return res.status(200).json({
            success: true,
            id: existingId,
            message: 'Record updated successfully'
          });
        }
      } catch (checkErr) {
        console.warn(`Notice checking existing ${uniqueCol} in ${tableName}:`, checkErr.message);
      }
    }

    try {
      const result = await db.run(query, values);
      res.json({
        success: true,
        id: result.lastID || result.lastInsertRowid || result.rows?.[0]?.id,
        message: 'Record created successfully'
      });
    } catch (err) {
      console.error("❌ DB ERROR:", err);
      const isDuplicate = err.code === '23505' || /unique constraint|duplicate key/i.test(err.message);
      if (isDuplicate) {
        return res.status(409).json({
          success: false,
          message: `A record with this ${uniqueCol} already exists in ${tableName}.`,
          error: `A record with this ${uniqueCol} already exists in ${tableName}.`
        });
      }
      return res.status(500).json({
        success: false,
        message: err.message,
        error: err.message,
      });
    }
  } catch (err) {
    console.error("❌ SERVER ERROR:", err);
    res.status(500).json({ success: false, message: err.message, error: err.message });
  }
});


// ============================================================================
// POST CREATE NEW RECORD - Legacy form /record/:table
// ============================================================================
router.post('/record/:table', async (req, res) => {
  try {
    const tableNameParam = req.params.table
    const { tableName, tableConfig } = resolveTableConfig(tableNameParam)

    if (!tableName) {
      return res.status(400).json({ message: 'Invalid master table' })
    }

    const data = req.body
    const filteredData = await normalizeMasterData(tableName, data);
    const keys = Object.keys(filteredData);
    const values = Object.values(filteredData);

    if (keys.length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields to insert" });
    }

    // Check if record with unique field already exists (e.g. name, ledgermaster.name)
    const uniqueCol = tableConfig?.uniqueField || 'name';
    if (filteredData[uniqueCol]) {
      try {
        const checkQuery = `SELECT id FROM ${tableName} WHERE LOWER(TRIM(${uniqueCol})) = LOWER(TRIM(?)) LIMIT 1`;
        const existingCheck = await db.query(checkQuery, [String(filteredData[uniqueCol]).trim()]);
        if (existingCheck.rows && existingCheck.rows.length > 0) {
          const existingId = existingCheck.rows[0].id;
          const updateKeys = keys.filter(k => k !== 'id');
          const updateSet = updateKeys.map(k => `${k} = ?`).join(', ');
          const updateVals = updateKeys.map(k => filteredData[k]);
          await db.run(`UPDATE ${tableName} SET ${updateSet} WHERE id = ?`, [...updateVals, existingId]);
          return res.status(200).json({
            success: true,
            data: { id: existingId },
            id: existingId,
            message: 'Record updated successfully'
          });
        }
      } catch (checkErr) {
        console.warn(`Notice checking existing ${uniqueCol} in ${tableName}:`, checkErr.message);
      }
    }

    const placeholders = keys.map(() => '?').join(', ')
    const query = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`

    try {
      const result = await db.run(query, values)
      res.status(201).json({
        success: true,
        data: { id: result.lastID || result.lastInsertRowid || result.rows?.[0]?.id },
        id: result.lastID || result.lastInsertRowid || result.rows?.[0]?.id,
        message: 'Record created successfully'
      })
    } catch (err) {
      console.error("❌ DB INSERT ERROR:", err.message);
      const isDuplicate = err.code === '23505' || /unique constraint|duplicate key/i.test(err.message);
      if (isDuplicate) {
        return res.status(409).json({
          success: false,
          message: `A record with this ${uniqueCol} already exists in ${tableName}.`,
          error: `A record with this ${uniqueCol} already exists in ${tableName}.`
        });
      }
      return res.status(500).json({
        success: false,
        message: err.message,
        error: err.message
      });
    }
  } catch (error) {
    console.error("❌ SERVER ERROR:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message,
      error: error.message
    });
  }
})

// ============================================================================
// PUT UPDATE RECORD - Short form /:table/:id (matches frontend call)
// ============================================================================
router.put('/:table/:id', async (req, res) => {
  try {
    const tableNameParam = req.params.table
    const { tableName, tableConfig } = resolveTableConfig(tableNameParam)

    if (!tableName) {
      return res.status(400).json({ message: 'Invalid master table' })
    }

    const data = req.body
    const filteredData = await normalizeMasterData(tableName, data);
    const keys = Object.keys(filteredData);
    const values = Object.values(filteredData);

    if (keys.length === 0) {
      return res.status(400).json({ success: false, message: "No fields to update" });
    }

    const setClause = keys.map(field => `${field} = ?`).join(', ')
    const reference = req.params.id
    const isNumericId = /^\d+$/.test(String(reference))
    let result
    if (isNumericId) {
      result = await db.run(`UPDATE ${tableName} SET ${setClause} WHERE id = ?`, [...values, Number(reference)])
    } else if (tableConfig?.uniqueField && tableConfig.uniqueField !== 'id') {
      result = await db.run(`UPDATE ${tableName} SET ${setClause} WHERE ${tableConfig.uniqueField} = ?`, [...values, reference])
    } else {
      return res.status(400).json({ success: false, message: 'A numeric record ID is required' })
    }

    if (result.changes > 0) {
      res.json({ success: true, message: 'Record updated successfully' })
    } else {
      res.status(404).json({ success: false, message: 'Record not found' })
    }
  } catch (error) {
    console.error('Error updating master record:', error)
    const duplicate = error.code === '23505' || /unique constraint|duplicate key/i.test(error.message)
    res.status(duplicate ? 409 : 500).json({ success: false, message: duplicate ? 'A record with this unique value already exists' : 'Error updating record', error: error.message })
  }
})

// ============================================================================
// PUT UPDATE RECORD - Legacy form /record/:table/:id
// ============================================================================
router.put('/record/:table/:id', async (req, res) => {
  try {
    const tableNameParam = req.params.table
    const { tableName, tableConfig } = resolveTableConfig(tableNameParam)

    if (!tableName) {
      return res.status(400).json({ message: 'Invalid master table' })
    }

    const data = req.body
    const filteredData = await normalizeMasterData(tableName, data);
    const keys = Object.keys(filteredData);
    const values = Object.values(filteredData);

    if (keys.length === 0) {
      return res.status(400).json({ success: false, message: "No fields to update" });
    }

    values.push(req.params.id) // Add ID for WHERE clause

    const setClause = keys.map(field => `${field} = ?`).join(', ')
    const query = `UPDATE ${tableName} SET ${setClause} WHERE id = ?`

    let result = await db.run(query, values)

    if (result.changes === 0 && tableConfig?.uniqueField) {
      const queryFallback = `UPDATE ${tableName} SET ${setClause} WHERE ${tableConfig.uniqueField} = ?`
      const resultFallback = await db.run(queryFallback, values)
      if (resultFallback.changes > 0) {
        result = resultFallback
      }
    }

    if (result.changes > 0) {
      res.json({ message: 'Record updated successfully' })
    } else {
      res.status(404).json({ message: 'Record not found' })
    }
  } catch (error) {
    console.error('Error updating master record:', error)
    res.status(500).json({ message: 'Error updating record', error: error.message })
  }
})

// ============================================================================
// DELETE RECORD - Short form /:table/:id (matches frontend call)
// ============================================================================
router.delete('/:table/:id', async (req, res) => {
  try {
    const tableNameParam = req.params.table;
    const { tableName, tableConfig } = resolveTableConfig(tableNameParam);

    if (!tableName) {
      return res.status(400).json({ success: false, message: 'Invalid master table' });
    }

    const tableColumnsResult = await db.query(`PRAGMA table_info(${tableName})`);
    const actualColumns = new Set(tableColumnsResult.rows.map(col => col.name));
    
    const rawId = String(req.params.id).trim();
    const isNumericId = /^\d+$/.test(rawId);

    // Determine target primary/unique key column for deletion
    let targetCol = null;
    let targetVal = rawId;

    if (isNumericId && actualColumns.has('id')) {
      targetCol = 'id';
      targetVal = parseInt(rawId, 10);
    } else if (tableConfig?.uniqueField && actualColumns.has(tableConfig.uniqueField)) {
      targetCol = tableConfig.uniqueField;
    } else if (actualColumns.has('item_code')) {
      targetCol = 'item_code';
    } else if (actualColumns.has('code')) {
      targetCol = 'code';
    } else if (actualColumns.has('id')) {
      targetCol = 'id';
      targetVal = parseInt(rawId, 10) || 0;
    }

    if (!targetCol) {
      targetCol = tableColumnsResult.rows[0]?.name || 'id';
    }

    // Save to recycle bin safely without causing type errors
    try {
      let existingRes;
      if (targetCol === 'id' && isNumericId) {
        existingRes = await db.query(`SELECT * FROM ${tableName} WHERE id = ? LIMIT 1`, [targetVal]);
      } else if (targetCol) {
        existingRes = await db.query(`SELECT * FROM ${tableName} WHERE ${targetCol} = ? LIMIT 1`, [targetVal]);
      }
      if (existingRes && existingRes.rows && existingRes.rows.length > 0) {
        const row = existingRes.rows[0];
        const titleName = row.name || row.item_name || row.group_name || row.supplier_name || row.customer_name || row.city_name || row.area_name || row.company_name || row.godown_name || `${tableName} #${rawId}`;
        await recycleBinService.saveToRecycleBin({
          moduleName: `${tableName.replace('_master', '').replace('_', ' ').toUpperCase()} Master`,
          recordId: rawId,
          title: titleName,
          recordData: {
            tableName,
            record: row
          },
          deletedBy: req.user?.username || 'admin'
        });
      }
    } catch (e) {
      console.warn('Recycle bin save error in masters:', e.message);
    }

    let result = await db.run(`DELETE FROM ${tableName} WHERE ${targetCol} = ?`, [targetVal]);

    // Fallback: If 0 changes, try alternative identifier (uniqueField vs id)
    if (result.changes === 0 && targetCol === 'id' && tableConfig?.uniqueField && actualColumns.has(tableConfig.uniqueField)) {
      const queryFallback = `DELETE FROM ${tableName} WHERE ${tableConfig.uniqueField} = ?`;
      const resultFallback = await db.run(queryFallback, [rawId]);
      if (resultFallback.changes > 0) {
        result = resultFallback;
      }
    } else if (result.changes === 0 && targetCol !== 'id' && actualColumns.has('id') && !isNumericId) {
      // Find id from uniqueField and delete by id
      const findRes = await db.query(`SELECT id FROM ${tableName} WHERE ${targetCol} = ? LIMIT 1`, [rawId]);
      if (findRes && findRes.rows && findRes.rows.length > 0) {
        const fallbackResult = await db.run(`DELETE FROM ${tableName} WHERE id = ?`, [findRes.rows[0].id]);
        if (fallbackResult.changes > 0) {
          result = fallbackResult;
        }
      }
    }

    if (result.changes > 0) {
      res.json({ success: true, message: 'Record deleted successfully' });
    } else {
      res.status(404).json({ success: false, message: 'Record not found' });
    }
  } catch (error) {
    console.error('Error deleting master record:', error);
    const isConstraint = error.code === '23503' || /foreign key|constraint|referenced/i.test(error.message);
    const statusCode = isConstraint ? 409 : 500;
    const msg = isConstraint 
      ? 'This record cannot be deleted because it is referenced in transactions or other master records.'
      : (error.message || 'Error deleting record');
    res.status(statusCode).json({ success: false, message: msg, error: error.message });
  }
});

// ============================================================================
// DELETE RECORD - Legacy form /record/:table/:id
// ============================================================================
router.delete('/record/:table/:id', async (req, res) => {
  try {
    const tableNameParam = req.params.table;
    const { tableName, tableConfig } = resolveTableConfig(tableNameParam);

    if (!tableName) {
      return res.status(400).json({ success: false, message: 'Invalid master table' });
    }

    const tableColumnsResult = await db.query(`PRAGMA table_info(${tableName})`);
    const actualColumns = new Set(tableColumnsResult.rows.map(col => col.name));
    
    const rawId = String(req.params.id).trim();
    const isNumericId = /^\d+$/.test(rawId);

    let targetCol = null;
    let targetVal = rawId;

    if (isNumericId && actualColumns.has('id')) {
      targetCol = 'id';
      targetVal = parseInt(rawId, 10);
    } else if (tableConfig?.uniqueField && actualColumns.has(tableConfig.uniqueField)) {
      targetCol = tableConfig.uniqueField;
    } else if (actualColumns.has('item_code')) {
      targetCol = 'item_code';
    } else if (actualColumns.has('code')) {
      targetCol = 'code';
    } else if (actualColumns.has('id')) {
      targetCol = 'id';
      targetVal = parseInt(rawId, 10) || 0;
    }

    if (!targetCol) {
      targetCol = tableColumnsResult.rows[0]?.name || 'id';
    }

    let result = await db.run(`DELETE FROM ${tableName} WHERE ${targetCol} = ?`, [targetVal]);

    if (result.changes === 0 && targetCol === 'id' && tableConfig?.uniqueField && actualColumns.has(tableConfig.uniqueField)) {
      const queryFallback = `DELETE FROM ${tableName} WHERE ${tableConfig.uniqueField} = ?`;
      const resultFallback = await db.run(queryFallback, [rawId]);
      if (resultFallback.changes > 0) {
        result = resultFallback;
      }
    } else if (result.changes === 0 && targetCol !== 'id' && actualColumns.has('id') && !isNumericId) {
      const findRes = await db.query(`SELECT id FROM ${tableName} WHERE ${targetCol} = ? LIMIT 1`, [rawId]);
      if (findRes && findRes.rows && findRes.rows.length > 0) {
        const fallbackResult = await db.run(`DELETE FROM ${tableName} WHERE id = ?`, [findRes.rows[0].id]);
        if (fallbackResult.changes > 0) {
          result = fallbackResult;
        }
      }
    }

    if (result.changes > 0) {
      res.json({ success: true, message: 'Record deleted successfully' });
    } else {
      res.status(404).json({ success: false, message: 'Record not found' });
    }
  } catch (error) {
    console.error('Error deleting master record:', error);
    const isConstraint = error.code === '23503' || /foreign key|constraint|referenced/i.test(error.message);
    const statusCode = isConstraint ? 409 : 500;
    const msg = isConstraint 
      ? 'This record cannot be deleted because it is referenced in transactions or other master records.'
      : (error.message || 'Error deleting record');
    res.status(statusCode).json({ success: false, message: msg, error: error.message });
  }
});

const { previewNextLotNumber } = require('../utils/lotHelper');

// /lots/next - Lot generator returns sequential LOT numbers based on existing lots
// Required response shape: { lot_no: "LOT0007" }
router.get('/lots/next', async (req, res) => {
  try {
    const cId = req.companyId || req.headers['x-company-id'] || req.query.company_id;
    const nextLot = await previewNextLotNumber(cId);
    return res.json({ lot_no: nextLot });
  } catch (err) {
    console.error('Error generating next lot number:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router


