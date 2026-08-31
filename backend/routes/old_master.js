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

  return filteredData;
};

// Master type aliases mapping
// hasStatus: true = table has status column and we filter by Active
// hasStatus: false = table doesn't have status column, return all records
// NOTE: Fixed hasStatus to correctly reflect which tables actually have status column
const masterTypeAliases = {
  // Type aliases (frontend-friendly names) -> { table, displayField, hasStatus }
  items: { table: 'item_master', displayField: 'item_name', hasStatus: true },
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
  item_master: { table: 'item_master', displayField: 'item_name', hasStatus: true },
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

// =====================================================================// GENERIC API: Get Active records only, ordered by name ASC
// Returns: [{ id: 1, name: "ABC" }]
// =====================================================================router.get('/:type', async (req, res) => {
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
      query = `
        SELECT 
          im.*,
          COALESCE(s.stock_qty, 0) as stock_qty
        FROM item_master im
        LEFT JOIN (
          SELECT item_name, SUM(qty) as stock_qty 
          FROM stock 
          GROUP BY item_name
        ) s ON LOWER(TRIM(s.item_name)) = LOWER(TRIM(im.item_name))
      `
      if (hasStatus) {
        query += ` WHERE (im.status = 'Active' OR im.status IS NULL OR im.status = '')`
      }
      query += ` ORDER BY im.item_group ASC, im.item_name ASC`
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

// =====================================================================// GET ALL RECORDS (Legacy - returns full records)
// =====================================================================router.get('/all/:table', async (req, res) => {
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

// =====================================================================// GET SINGLE RECORD BY ID
// =====================================================================router.get('/record/:table/:id', async (req, res) => {
  try {
    const tableNameParam = req.params.table
    const { tableName, tableConfig } = resolveTableConfig(tableNameParam)

    if (!tableName) {
      return res.status(400).json({ message: 'Invalid master table' })
    }

    let result = await db.query(`SELECT * FROM ${tableName} WHERE id = ?`, [req.params.id])

    if (result.rows.length === 0 && tableConfig?.uniqueField) {
      result = await db.query(`SELECT * FROM ${tableName} WHERE ${tableConfig.uniqueField} = ?`, [req.params.id])
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


// =====================================================================// POST CREATE NEW RECORD - Short form /:table (matches frontend call)
// =====================================================================router.post("/:table", async (req, res) => {
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

    try {
      const result = await db.run(query, values);
      res.json({
        success: true,
        id: result.lastID,
      });
    } catch (err) {
      console.error("❌ DB ERROR:", err);
      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  } catch (err) {
    console.error("❌ SERVER ERROR:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// =====================================================================// POST CREATE NEW RECORD - Legacy form /record/:table
// =====================================================================router.post('/record/:table', async (req, res) => {
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

    const placeholders = keys.map(() => '?').join(', ')
    const query = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`

    const result = await db.run(query, values)

    res.status(201).json({
      success: true,
      data: { id: result.lastID },
      message: 'Record created successfully'
    })
  } catch (error) {
    console.error("❌ DB INSERT ERROR:", error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
})

// =====================================================================// PUT UPDATE RECORD - Short form /:table/:id (matches frontend call)
// =====================================================================router.put('/:table/:id', async (req, res) => {
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
      res.json({ success: true, message: 'Record updated successfully' })
    } else {
      res.status(404).json({ success: false, message: 'Record not found' })
    }
  } catch (error) {
    console.error('Error updating master record:', error)
    res.status(500).json({ message: 'Error updating record', error: error.message })
  }
})

// =====================================================================// PUT UPDATE RECORD - Legacy form /record/:table/:id
// =====================================================================router.put('/record/:table/:id', async (req, res) => {
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

// =====================================================================// DELETE RECORD - Short form /:table/:id (matches frontend call)
// =====================================================================router.delete('/:table/:id', async (req, res) => {
  try {
    const tableNameParam = req.params.table
    const { tableName, tableConfig } = resolveTableConfig(tableNameParam)

    if (!tableName) {
      return res.status(400).json({ message: 'Invalid master table' })
    }

    const tableColumnsResult = await db.query(`PRAGMA table_info(${tableName})`);
    const actualColumns = new Set(tableColumnsResult.rows.map(col => col.name));
    
    let query = `DELETE FROM ${tableName} WHERE id = ?`;
    let pkCol = 'id';
    if (!actualColumns.has('id')) {
      pkCol = tableConfig?.uniqueField || (tableColumnsResult.rows.find(col => col.pk === 1)?.name) || tableColumnsResult.rows[0]?.name;
      if (pkCol) {
        query = `DELETE FROM ${tableName} WHERE ${pkCol} = ?`;
      }
    }

    try {
      const existingRes = await db.query(`SELECT * FROM ${tableName} WHERE ${pkCol} = ? OR id = ?`, [req.params.id, req.params.id]);
      if (existingRes.rows && existingRes.rows.length > 0) {
        const row = existingRes.rows[0];
        const titleName = row.name || row.item_name || row.group_name || row.supplier_name || row.customer_name || row.city_name || row.area_name || row.company_name || row.godown_name || `${tableName} #${req.params.id}`;
        await recycleBinService.saveToRecycleBin({
          moduleName: `${tableName.replace('_master', '').replace('_', ' ').toUpperCase()} Master`,
          recordId: req.params.id,
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

    let result = await db.run(query, [req.params.id])

    if (result.changes === 0 && tableConfig?.uniqueField) {
      const queryFallback = `DELETE FROM ${tableName} WHERE ${tableConfig.uniqueField} = ?`
      const resultFallback = await db.run(queryFallback, [req.params.id])
      if (resultFallback.changes > 0) {
        result = resultFallback
      }
    }

    if (result.changes > 0) {
      res.json({ success: true, message: 'Record deleted successfully' })
    } else {
      res.status(404).json({ success: false, message: 'Record not found' })
    }
  } catch (error) {
    console.error('Error deleting master record:', error)
    res.status(500).json({ message: 'Error deleting record', error: error.message })
  }
})

// =====================================================================// DELETE RECORD - Legacy form /record/:table/:id
// =====================================================================router.delete('/record/:table/:id', async (req, res) => {
  try {
    const tableNameParam = req.params.table
    const { tableName, tableConfig } = resolveTableConfig(tableNameParam)

    if (!tableName) {
      return res.status(400).json({ message: 'Invalid master table' })
    }

    const tableColumnsResult = await db.query(`PRAGMA table_info(${tableName})`);
    const actualColumns = new Set(tableColumnsResult.rows.map(col => col.name));
    
    let query = `DELETE FROM ${tableName} WHERE id = ?`;
    if (!actualColumns.has('id')) {
      const pkCol = tableConfig?.uniqueField || (tableColumnsResult.rows.find(col => col.pk === 1)?.name) || tableColumnsResult.rows[0]?.name;
      if (pkCol) {
        query = `DELETE FROM ${tableName} WHERE ${pkCol} = ?`;
      }
    }

    let result = await db.run(query, [req.params.id])

    if (result.changes === 0 && tableConfig?.uniqueField) {
      const queryFallback = `DELETE FROM ${tableName} WHERE ${tableConfig.uniqueField} = ?`
      const resultFallback = await db.run(queryFallback, [req.params.id])
      if (resultFallback.changes > 0) {
        result = resultFallback
      }
    }

    if (result.changes > 0) {
      res.json({ message: 'Record deleted successfully' })
    } else {
      res.status(404).json({ message: 'Record not found' })
    }
  } catch (error) {
    console.error('Error deleting master record:', error)
    res.status(500).json({ message: 'Error deleting record', error: error.message })
  }
})

// /lots/next - Lot generator returns sequential LOT numbers based on existing lots
// Required response shape: { lot_no: "LOT0007" }
router.get('/lots/next', async (req, res) => {
  try {
    let maxNum = 0;
    const tables = [
      { name: 'stock_lots', col: 'lot_no' },
      { name: 'purchase_items', col: 'lot_no' },
      { name: 'grain_input_items', col: 'lot_no' },
      { name: 'grain_output_items', col: 'lot_no' },
      { name: 'grain_wastage_items', col: 'lot_no' }
    ];

    for (const t of tables) {
      try {
        const check = await db.query(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [t.name]);
        if (check.rows.length > 0) {
          const resMax = await db.query(`
            SELECT MAX(CAST(REPLACE(${t.col}, 'LOT', '') AS INTEGER)) AS maxNum
            FROM ${t.name}
            WHERE ${t.col} LIKE 'LOT%'
          `);
          const num = parseInt(resMax.rows[0]?.maxNum) || 0;
          if (num > maxNum) maxNum = num;
        }
      } catch (e) {
        console.error(`Error querying max lot in /lots/next from ${t.name}:`, e);
      }
    }

    try {
      const seqCheck = await db.query(`SELECT name FROM sqlite_master WHERE type='table' AND name='lot_sequence'`);
      if (seqCheck.rows.length > 0) {
        const resSeq = await db.query(`SELECT last_lot_no FROM lot_sequence WHERE id = 1`);
        const num = parseInt(resSeq.rows[0]?.last_lot_no) || 0;
        if (num > maxNum) maxNum = num;
      }
    } catch (e) {
      console.error(`Error querying max lot in /lots/next from lot_sequence:`, e);
    }

    const nextLot = `LOT${String(maxNum + 1).padStart(4, '0')}`;
    return res.json({ lot_no: nextLot });
  } catch (err) {
    console.error('Error generating next lot number:', err)
    res.status(500).json({ error: err.message });
  }
});

module.exports = router


