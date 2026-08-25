const express = require('express')
const cors = require('cors')
const path = require('path')
const https = require('https')
const crypto = require('crypto')
const fs = require('fs')
const db = require('./config/database')
const jwt = require('jsonwebtoken')
const tenantContext = require('./config/tenantContext')
const masterDb = require('./config/masterDatabase')
const { getCompanyDatabase } = require('./config/companyDatabase')
const JWT_SECRET = process.env.JWT_SECRET || 'bvc-development-secret-change-me'

const app = express()
// AI Studio requires port 3000 strictly, but we allow configuration in dev
const PORT = process.env.PORT || 3001
let actualPort = PORT

// Process-level crash protection (prevents 502s from uncaught errors)
process.on('uncaughtException', (err) => {
  console.error('🔥 UNCAUGHT EXCEPTION:', err.stack || err)
})
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 UNHANDLED REJECTION at:', promise, 'reason:', reason)
})

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'https://bvc-inventory-ilakkiya.onrender.com',
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.onrender.com')) {
      return callback(null, true);
    }
    callback(null, true); // permissive during development
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
}));

// Explicitly handle OPTIONS preflight for all routes
app.options('*', cors());

app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))
app.use('/api', async (req, res, next) => {
  if (req.path === '/health' || (req.path.startsWith('/companies') && req.method === 'GET') || req.path === '/auth/login') return next()
  const authorization = req.get('Authorization') || ''
  if (!authorization.startsWith('Bearer ')) return res.status(401).json({ message: 'Authentication required' })
  try {
    const claims = jwt.verify(authorization.slice(7), JWT_SECRET)
    const result = await masterDb.query('SELECT * FROM companies WHERE id = ? AND LOWER(status) = \'active\'', [claims.companyId])
    if (!result.rows[0]) return res.status(401).json({ message: 'Company is inactive or not found' })
    const companyDb = await getCompanyDatabase(result.rows[0])
    req.user = claims
    tenantContext.run(companyDb, () => next())
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired authentication token' })
  }
})
const frontendPath = path.join(__dirname, '../frontend/dist')

// Serve static frontend files
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath, {
  index: false
}));
}
// API routes FIRST
// (your existing routes here)

// React fallback ONLY for non-API routes
/*app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ message: 'API route not found' });
  }

  const indexPath = path.join(frontendPath, 'index.html');

  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send('Frontend not built. API is running.');
  }
});*/
app.use('/Entry', express.static(path.join(__dirname, '../Entry')))

// Routes
const purchasesRouter = require('./routes/purchases_fixed')
const purchaseSummaryRouter = require('./routes/purchaseSummary')
const entriesRouter = require('./routes/entries')

app.use('/api/purchases', purchasesRouter)
app.use('/api/purchase-requests', require('./routes/purchaseRequests'))
app.use('/api/purchases', purchaseSummaryRouter)
app.use('/api/entries', entriesRouter)

const purchaseReturnsRouter = require('./routes/purchaseReturns')


const grainsRouter = require('./routes/grains')
const flourOutRouter = require('./routes/flourOut')
const flourOutReturnsRouter = require('./routes/flourOutReturns')
const salesRouter = require('./routes/sales')
const salesReturnsRouter = require('./routes/salesReturns')
const mastersRouter = require('./routes/masters')
const advancesRouter = require('./routes/advances')
const papadInRouter = require('./routes/papadIn')
const stockRouter = require('./routes/stock')
const reportsRouter = require('./routes/reports')
const weightConversionRouter = require('./routes/weightConversion')
const salesExportOrdersRouter = require('./routes/salesExportOrders')
const openRouter = require('./routes/open')
const companiesRouter = require('./routes/companies')
const authRouter = require('./routes/auth')
const dbRouter = require('./routes/db')
const vehicleMovementsRouter = require('./routes/vehicle-movements')
const papadCompaniesRouter = require('./routes/papadCompanies')
const lotsRouter = require('./routes/lots')
const dashboardRouter = require('./routes/dashboard')
const workOrdersRouter = require('./routes/workOrders')
const stockAlertsRouter = require('./routes/stockAlerts')
app.use('/api/dashboard', dashboardRouter)
app.use('/api/work-orders', workOrdersRouter)
app.use('/api/work-order', workOrdersRouter)
app.use('/api/stock-alerts', stockAlertsRouter)
app.use('/api/stock-alert', stockAlertsRouter)
app.use('/api/purchases', purchasesRouter)
app.use('/api/lots', lotsRouter)
app.use('/api/purchase-returns', purchaseReturnsRouter)
app.use('/api/grains', grainsRouter)
app.use('/api/grind', grainsRouter)
app.use('/api/flour-out', flourOutRouter)
app.use('/api/flour-out-returns', flourOutReturnsRouter)
// Alias for flour-out-return (without 's') - used by some frontend components
app.use('/api/flour-out-return', flourOutReturnsRouter)
app.use('/api/sales', salesRouter)
app.use('/api/sales-order', salesRouter)
app.use('/api/sales-orders', salesRouter)
app.use('/api/sales-display', salesRouter)
app.use('/api/sales-returns', salesReturnsRouter)
app.use('/api/masters', mastersRouter)
app.use('/api/taxes', require('./routes/taxMaster'))
app.use('/api/tax-master', require('./routes/taxMaster'))
app.use('/api/advances', advancesRouter)
// Alias for advance (without 's') - used by some frontend components
app.use('/api/advance', advancesRouter)
app.use('/api/papad-in', papadInRouter)
app.use('/api/papad-return', require('./routes/papadReturn'))
app.use('/api/papad-returns', require('./routes/papadReturn'))
app.use('/api/cheque-printing', require('./routes/chequePrinting'))

app.use('/api/stock', stockRouter)
app.use('/api/godowns', require('./routes/godowns'))
app.use('/api/item-transfers', require('./routes/itemTransfers'))
app.use('/api/godown-transfers', require('./routes/godownTransfers'))
app.use('/api/reports', reportsRouter)
app.use('/api/weight-conversion', weightConversionRouter)
app.use('/api/stock-adjust', require('./routes/stockAdjust'))
app.use('/api/packing', require('./routes/packing'))
app.use('/api/sales-export-orders', salesExportOrdersRouter)
app.use('/api/quotations', require('./routes/quotations'))
app.use('/api', require('./routes/purchaseOrderRoutes'))
app.use('/api/open', openRouter)

// Accounts Reports API - Mounted under /api/accounts
app.use('/api/accounts', reportsRouter)

// Companies, Auth and Features API
app.use('/api/companies', companiesRouter)
app.use('/api/auth', authRouter)
app.use('/api/features', require('./routes/features'))
app.use('/api/financial-years', require('./routes/financialYears'))

// Database query API (for Tauri-style queries)
app.use('/api/vouchers', require('./routes/vouchers'))
app.use('/api/db', dbRouter)
app.use('/api/vehicle-movements', vehicleMovementsRouter)
app.use('/api/papad-companies', papadCompaniesRouter)
app.use('/api/recycle-bin', require('./routes/recycleBin'))
app.use('/api/qc', require('./routes/qc'))
app.use('/api/quality', require('./routes/qc'))
app.use('/api/compliance', require('./routes/compliance'))
app.use('/api/documents', require('./routes/compliance'))

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'BVC Purchase Management API is running' })
})

// Serve React app for any unmatched routes
/*app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../frontend/dist/index.html')

  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath)
  } else {
    res.send('Frontend not built. API is running.')
  }
})*/

// Ensure any unmatched /api route returns JSON 404 for all HTTP methods (placed before static files)
app.all(['/api', '/api/*'], (req, res) => {
  res.status(404).json({ success: false, message: `API route not found: ${req.method} ${req.originalUrl}` });
});

app.use(express.static(frontendPath));

// Serve React app for any unmatched non-API frontend routes
app.get('*', (req, res) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ success: false, message: `API route not found: ${req.method} ${req.originalUrl}` });
  }
  const indexPath = path.join(frontendPath, 'index.html');

  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }

  res.send('Frontend not built. API is running.');
});
  // Let static files pass through (IMPORTANT)
 /* const filePath = path.join(frontendPath, req.path);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  // React fallback
  const indexPath = path.join(frontendPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }*/

 // res.send('Frontend not built. API is running.');

// Global error handling middleware (catches all unhandled route errors)
app.use((err, req, res, next) => {
  console.error('🔥 GLOBAL ERROR HANDLER:', err.stack || err)
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
    path: req.path
  })
})

// Initialize master tables on startup
async function initializeMasterTables() {
  console.log('Initializing master tables...')
  
  const tables = [
    {
      name: 'item_master',
      sql: `CREATE TABLE IF NOT EXISTS item_master (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_code TEXT UNIQUE,
        item_name TEXT,
        print_name TEXT,
        item_group TEXT,
        type TEXT,
        tax REAL DEFAULT 0,
        hsn_code TEXT,
        status TEXT DEFAULT 'Active'
      )`
    },
    {
      name: 'item_groups',
      sql: `CREATE TABLE IF NOT EXISTS item_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_code TEXT UNIQUE,
        group_name TEXT,
        print_name TEXT,
        tax REAL
      )`
    },
    {
      name: 'customer_master',
      sql: `CREATE TABLE IF NOT EXISTS customer_master (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        print_name TEXT,
        contact_person TEXT,
        address1 TEXT,
        phone_res TEXT,
        phone_off TEXT,
        mobile1 TEXT,
        email TEXT,
        gst_number TEXT,
        area TEXT,
        transport TEXT,
        limit_days INTEGER,
        limit_amount REAL,
        opening_balance REAL DEFAULT 0,
        balance_type TEXT DEFAULT 'Dr',
        status TEXT DEFAULT 'Active'
      )`
    },
    {
      name: 'supplier_master',
      sql: `CREATE TABLE IF NOT EXISTS supplier_master (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        print_name TEXT,
        contact_person TEXT,
        address1 TEXT,
        phone_res TEXT,
        phone_off TEXT,
        mobile1 TEXT,
        email TEXT,
        gst_number TEXT,
        area TEXT,
        transport TEXT,
        limit_days INTEGER,
        limit_amount REAL,
        opening_balance REAL DEFAULT 0,
        balance_type TEXT DEFAULT 'Dr',
        status TEXT DEFAULT 'Active'
      )`
    },
    {
      name: 'area_master',
      sql: `CREATE TABLE IF NOT EXISTS area_master (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        print_name TEXT,
        status TEXT DEFAULT 'Active'
      )`
    },
    {
      name: 'city_master',
      sql: `CREATE TABLE IF NOT EXISTS city_master (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        print_name TEXT,
        status TEXT DEFAULT 'Active'
      )`
    },
    {
      name: 'transport_master',
      sql: `CREATE TABLE IF NOT EXISTS transport_master (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        print_name TEXT,
        status TEXT DEFAULT 'Active'
      )`
    },
    {
      name: 'weightmaster',
      sql: `CREATE TABLE IF NOT EXISTS weightmaster (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        printname TEXT,
        weight REAL,
        status TEXT DEFAULT 'Active'
      )`
    },
    {
      name: 'ledgergroupmaster',
      sql: `CREATE TABLE IF NOT EXISTS ledgergroupmaster (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        printname TEXT,
        under TEXT,
        status TEXT DEFAULT 'Active'
      )`
    },
    {
      name: 'ledgermaster',
      sql: `CREATE TABLE IF NOT EXISTS ledgermaster (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        printname TEXT,
        alias_name TEXT,
        under TEXT,
        openingbalance REAL DEFAULT 0,
        opening_type TEXT DEFAULT 'Dr',
        ledger_type TEXT DEFAULT 'General',
        status TEXT DEFAULT 'Active'
      )`
    },
    {
      name: 'deduction_sales',
      sql: `CREATE TABLE IF NOT EXISTS deduction_sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ded_code TEXT UNIQUE,
        ded_name TEXT,
        print_name TEXT,
        adjust_with_sales TEXT,
        account_head TEXT,
        ded_type TEXT,
        calc_type TEXT,
        ded_value REAL DEFAULT 0,
        status TEXT DEFAULT 'Active'
      )`
    },
    {
      name: 'deduction_purchase',
      sql: `CREATE TABLE IF NOT EXISTS deduction_purchase (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ded_code TEXT UNIQUE,
        ded_name TEXT,
        print_name TEXT,
        affect_cost_of_goods TEXT DEFAULT 'No',
        type TEXT DEFAULT 'Add',
        debit_side_adjust TEXT DEFAULT 'None',
        account_head TEXT,
        credit_adjust TEXT,
        deduction_type TEXT DEFAULT 'Add',
        calculation_type TEXT DEFAULT 'Percentage',
        status TEXT DEFAULT 'Active'
      )`
    },
    {
      name: 'flour_mill_master',
      sql: `CREATE TABLE IF NOT EXISTS flour_mill_master (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        flourmill TEXT UNIQUE,
        print_name TEXT,
        contact_person TEXT,
        address1 TEXT,
        address2 TEXT,
        address3 TEXT,
        address4 TEXT,
        gst_number TEXT,
        phone_off TEXT,
        phone_res TEXT,
        mobile1 TEXT,
        mobile2 TEXT,
        area TEXT,
        wages_kg REAL DEFAULT 0,
        opening_balance REAL DEFAULT 0,
        opening_balance_type TEXT DEFAULT 'Cr',
        tin_no TEXT,
        status TEXT DEFAULT 'Active'
      )`
    },
    {
      name: 'papad_company_master',
      sql: `CREATE TABLE IF NOT EXISTS papad_company_master (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        print_name TEXT,
        contact_person TEXT,
        address TEXT,
        address1 TEXT,
        address2 TEXT,
        address3 TEXT,
        address4 TEXT,
        gst_no TEXT,
        phone_off TEXT,
        phone_res TEXT,
        mobile TEXT,
        mobile1 TEXT,
        mobile2 TEXT,
        area TEXT,
        wages_kg REAL DEFAULT 0,
        opening_balance REAL DEFAULT 0,
        opening_advance REAL DEFAULT 0,
        status TEXT DEFAULT 'Active'
      )`
    },
    {
      name: 'consignee_group_master',
      sql: `CREATE TABLE IF NOT EXISTS consignee_group_master (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        print_name TEXT,
        contact_person TEXT,
        address TEXT,
        area TEXT,
        phone_res TEXT,
        phone_off TEXT,
        mobile TEXT,
        tin_no TEXT,
        status TEXT DEFAULT 'Active'
      )`
    },
    {
      name: 'sender_group_master',
      sql: `CREATE TABLE IF NOT EXISTS sender_group_master (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        print_name TEXT,
        contact_person TEXT,
        address TEXT,
        area TEXT,
        phone_res TEXT,
        phone_off TEXT,
        mobile TEXT,
        tin_no TEXT,
        status TEXT DEFAULT 'Active'
      )`
    },
    {
      name: 'ptrans_master',
      sql: `CREATE TABLE IF NOT EXISTS ptrans_master (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        print_name TEXT,
        status TEXT DEFAULT 'Active'
      )`
    },
    {
      name: 'godown_master',
      sql: `CREATE TABLE IF NOT EXISTS godown_master (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        godown_name TEXT UNIQUE,
        print_name TEXT,
        location TEXT,
        contact_person TEXT,
        address TEXT,
        phone_off TEXT,
        area TEXT,
        status TEXT DEFAULT 'Active'
      )`
    },
    {
      name: 'stock',
      sql: `CREATE TABLE IF NOT EXISTS stock (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        item_id INTEGER,
        item_name TEXT,
        lot_no TEXT,
        qty REAL DEFAULT 0,
        weight REAL DEFAULT 0,
        rate REAL DEFAULT 0,
        amount REAL DEFAULT 0,
        type TEXT DEFAULT 'Purchase',
        reference_id INTEGER,
        status TEXT DEFAULT 'Active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'companies',
      sql: `CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT,
        gst_number TEXT,
        contact TEXT,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    },
{
      name: 'users',
      sql: `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        company_id INTEGER,
        status TEXT DEFAULT 'Active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(username, company_id)
      )`
    },
    {
      name: 'vehicle_movements',
      sql: `CREATE TABLE IF NOT EXISTS vehicle_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reference_type TEXT NOT NULL,
        reference_id INTEGER,
        movement_type TEXT,
        operation_type TEXT,
        vehicle_no TEXT NOT NULL,
        driver_name TEXT,
        transporter_id INTEGER,
        gate_in_time DATETIME,
        gate_out_time DATETIME,
        gross_weight REAL DEFAULT 0,
        tare_weight REAL DEFAULT 0,
        net_weight REAL DEFAULT 0,
        status TEXT DEFAULT 'IN',
        item_name TEXT,
        qty REAL DEFAULT 0,
        weight REAL DEFAULT 0,
        party_name TEXT,
        lot_no TEXT,
        analyzing_team TEXT,
        analyzing_area TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'stock_alert_config',
      sql: `CREATE TABLE IF NOT EXISTS stock_alert_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER,
        item_name TEXT NOT NULL,
        godown_id INTEGER,
        godown_name TEXT NOT NULL DEFAULT 'All Godowns',
        minimum_qty REAL DEFAULT 0,
        reorder_level REAL DEFAULT 0,
        critical_level REAL DEFAULT 0,
        alert_enabled INTEGER DEFAULT 1,
        in_app_enabled INTEGER DEFAULT 1,
        email_enabled INTEGER DEFAULT 1,
        sms_enabled INTEGER DEFAULT 0,
        whatsapp_enabled INTEGER DEFAULT 0,
        offline_enabled INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'stock_alert_contacts',
      sql: `CREATE TABLE IF NOT EXISTS stock_alert_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_name TEXT NOT NULL,
        department TEXT DEFAULT 'Purchase',
        phone TEXT,
        email TEXT,
        active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'stock_alert_config_contacts',
      sql: `CREATE TABLE IF NOT EXISTS stock_alert_config_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        config_id INTEGER NOT NULL,
        contact_id INTEGER NOT NULL,
        is_primary INTEGER DEFAULT 0,
        is_cc INTEGER DEFAULT 1,
        FOREIGN KEY (config_id) REFERENCES stock_alert_config(id) ON DELETE CASCADE,
        FOREIGN KEY (contact_id) REFERENCES stock_alert_contacts(id) ON DELETE CASCADE
      )`
    },
    {
      name: 'stock_alerts',
      sql: `CREATE TABLE IF NOT EXISTS stock_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        config_id INTEGER,
        item_id INTEGER,
        item_name TEXT NOT NULL,
        godown_id INTEGER,
        godown_name TEXT NOT NULL DEFAULT 'Main Godown',
        alert_type TEXT NOT NULL,
        current_qty REAL DEFAULT 0,
        minimum_qty REAL DEFAULT 0,
        reorder_level REAL DEFAULT 0,
        critical_level REAL DEFAULT 0,
        status TEXT DEFAULT 'OPEN',
        triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME,
        resolved_reason TEXT
      )`
    },
    {
      name: 'stock_alert_notifications',
      sql: `CREATE TABLE IF NOT EXISTS stock_alert_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alert_id INTEGER,
        contact_id INTEGER,
        contact_name TEXT,
        contact_email TEXT,
        contact_phone TEXT,
        channel TEXT NOT NULL,
        message TEXT,
        status TEXT DEFAULT 'PENDING',
        sent_at DATETIME,
        failure_reason TEXT,
        retry_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    }
  ]

  for (const table of tables) {
    try {
      await db.run(table.sql)
      console.log(`✓ Table '${table.name}' is ready`)
    } catch (error) {
      console.log(`✗ Error creating table '${table.name}':`, error.message)
    }
  }

  // Auto-migrations: safely add columns that may be missing in older DBs
  await require('./autoMigrate')()

  // Verify tables
  try {
    const result = await db.query("SELECT name FROM sqlite_master WHERE type='table'")
    console.log('Available tables:', result.rows.map(r => r.name).join(', '))
  } catch (error) {
    console.log('Error verifying tables:', error.message)
  }

  // Seed default ledgers on startup
  const defaultLedgers = [
    { name: 'Cash', under: 'Cash', type: 'Cash' },
    { name: 'Petty Cash', under: 'Cash', type: 'Cash' },
    { name: 'Indian Bank', under: 'Bank Accounts', type: 'Bank' },
    { name: 'Purchase Account', under: 'Purchase', type: 'Purchase' },
    { name: 'Sales Account', under: 'Sales', type: 'Sales' },
    { name: 'Input Tax', under: 'Duties & Taxes', type: 'Tax' },
    { name: 'Output Tax', under: 'Duties & Taxes', type: 'Tax' }
  ];

  for (const led of defaultLedgers) {
    try {
      const existing = await db.query('SELECT id FROM ledgermaster WHERE TRIM(name) = ?', [led.name.trim()]);
      if (existing.rows.length === 0) {
        await db.run(
          'INSERT INTO ledgermaster (name, printname, under, ledger_type, openingbalance, status) VALUES (?, ?, ?, ?, ?, ?)',
          [led.name, led.name, led.under, led.type, 0, 'Active']
        );
        console.log(`Auto-created startup default ledger: ${led.name}`);
      } else {
        // Safe migration update of existing ledger type
        await db.run(
          'UPDATE ledgermaster SET ledger_type = ?, under = ? WHERE id = ?',
          [led.type, led.under, existing.rows[0].id]
        );
        console.log(`Verified startup default ledger: ${led.name} type/under corrected`);
      }
    } catch (err) {
      console.error(`Error seeding default ledger ${led.name} on startup:`, err.message);
    }
  }
}

// Start server after initialization
const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`HTTP Server is running on port ${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/api/health`)
  console.log(`Network access: http://0.0.0.0:${PORT}/api/health`)
  
  // Run full database initialization (including purchases, sales, etc.)
  try {
    const initDatabase = require('./init_db')
    await initDatabase()
    console.log('✓ Full database initialization complete on startup')
    
    // Ensure voucher tables (voucher, voucher_entry, ledger_entries) exist and sync
    const { ensureVoucherTables, syncAllLedgers } = require('./utils/ledgerHelper')
    await ensureVoucherTables()
    console.log('✓ Voucher tables initialized successfully on startup')
    await syncAllLedgers()
    console.log('✓ Ledger sync and rebuild successfully completed on startup')

    // Rebuild and synchronize stock lots and stock ledger
    const { rebuildStockLedger } = require('./utils/stockRebuilder')
    await rebuildStockLedger()
    console.log('✓ Stock lots & stock ledger re-synchronized on startup')
  } catch (err) {
    console.error('⚠️ Database initialization error on startup:', err.message)
  }

  // Initialize master tables
  await initializeMasterTables()
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is already in use by active server instance.`)
  } else {
    console.error('Server startup error:', err)
  }
})

module.exports = app
