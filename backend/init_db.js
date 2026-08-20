const sqlite3 = require('sqlite3').verbose()
const path = require('path')

const dbPath = path.join(__dirname, '../database/bvc.db')
<<<<<<< HEAD
let db

async function initializeDatabase() {
  console.log('Initializing database schema...\n')
  db = new sqlite3.Database(dbPath)
=======
const db = new sqlite3.Database(dbPath)

async function initializeDatabase() {
  console.log('Initializing database schema...\n')
>>>>>>> origin/main

  // Master tables with their schemas
  const masterTables = [
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
        ed_percent REAL DEFAULT 0,
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
        tax REAL DEFAULT 0
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
        address2 TEXT,
        address3 TEXT,
        address4 TEXT,
        gst_number TEXT,
        phone_off TEXT,
        phone_res TEXT,
        mobile1 TEXT,
        mobile2 TEXT,
        area TEXT,
        opening_balance REAL DEFAULT 0,
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
        address2 TEXT,
        address3 TEXT,
        address4 TEXT,
        gst_number TEXT,
        phone_off TEXT,
        phone_res TEXT,
        mobile1 TEXT,
        mobile2 TEXT,
        area TEXT,
        opening_balance REAL DEFAULT 0,
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
        weight REAL DEFAULT 0
      )`
    },
    {
      name: 'ledgergroupmaster',
      sql: `CREATE TABLE IF NOT EXISTS ledgergroupmaster (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        printname TEXT,
        under TEXT
      )`
    },
    {
      name: 'ledgermaster',
      sql: `CREATE TABLE IF NOT EXISTS ledgermaster (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        printname TEXT,
        under TEXT,
        openingbalance REAL DEFAULT 0,
        area TEXT,
        credit REAL DEFAULT 0,
        debit REAL DEFAULT 0,
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
        debit_adjust TEXT,
        account_head TEXT,
        credit_adjust TEXT,
        ded_type TEXT,
        calc_type TEXT,
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
<<<<<<< HEAD
        address TEXT,
=======
>>>>>>> origin/main
        address1 TEXT,
        address2 TEXT,
        address3 TEXT,
        address4 TEXT,
        gst_no TEXT,
        phone_off TEXT,
        phone_res TEXT,
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
      name: 'person_master',
      sql: `CREATE TABLE IF NOT EXISTS person_master (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        print_name TEXT,
        contact_person TEXT,
        address TEXT,
        area TEXT,
        phone_res TEXT,
        phone_off TEXT,
        mobile TEXT,
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
      name: 'purchases',
      sql: `CREATE TABLE IF NOT EXISTS purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        s_no INTEGER NOT NULL,
        date DATE NOT NULL,
        inv_no TEXT,
        supplier TEXT,
        pay_type TEXT DEFAULT 'Credit',
        inv_date DATE,
        type TEXT DEFAULT 'Urad',
<<<<<<< HEAD
        contact_person TEXT,
        address TEXT,
        area TEXT,
        phone TEXT,
        gst_no TEXT,
        email TEXT,
        tax_type TEXT DEFAULT 'Exclusive',
        tax_percent REAL DEFAULT 0,
=======
        address TEXT,
        tax_type TEXT DEFAULT 'Exclusive',
>>>>>>> origin/main
        godown TEXT,
        remarks TEXT,
        total_qty REAL DEFAULT 0,
        total_weight REAL DEFAULT 0,
        total_amount REAL DEFAULT 0,
        base_amount REAL DEFAULT 0,
        disc_amount REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        net_amount REAL DEFAULT 0,
<<<<<<< HEAD
        deduction_amount REAL DEFAULT 0,
=======
>>>>>>> origin/main
        auto_wages REAL DEFAULT 0,
        vat_percent REAL DEFAULT 0,
        vat REAL DEFAULT 0,
        grand_total REAL DEFAULT 0,
        transport TEXT,
        lorry_no TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'purchase_items',
      sql: `CREATE TABLE IF NOT EXISTS purchase_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_id INTEGER,
<<<<<<< HEAD
        item_id INTEGER,
        item_name TEXT NOT NULL,
        lot_no TEXT,
        weight REAL DEFAULT 0,
        per_unit_weight REAL DEFAULT 0,
        qty REAL DEFAULT 0,
        total_wt REAL DEFAULT 0,
        total_weight REAL DEFAULT 0,
        rate REAL DEFAULT 0,
        disc_percent REAL DEFAULT 0,
        disc_amount REAL DEFAULT 0,
        tax_percent REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
=======
        item_name TEXT NOT NULL,
        lot_no TEXT,
        weight REAL DEFAULT 0,
        qty REAL DEFAULT 0,
        total_wt REAL DEFAULT 0,
        rate REAL DEFAULT 0,
        disc_percent REAL DEFAULT 0,
        tax_percent REAL DEFAULT 0,
>>>>>>> origin/main
        amount REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
      )`
    },
    {
<<<<<<< HEAD
      name: 'purchase_deductions',
      sql: `CREATE TABLE IF NOT EXISTS purchase_deductions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_id INTEGER,
        deduction_purchase_id INTEGER,
        deduction_name TEXT,
        type TEXT,
        calc_type TEXT,
        value REAL DEFAULT 0,
        amount REAL DEFAULT 0,
        affect_cost_of_goods TEXT,
        debit_side_adjust TEXT,
        account_head_id INTEGER,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
      )`
    },
    {
      name: 'purchase_requests',
      sql: `CREATE TABLE IF NOT EXISTS purchase_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pr_no TEXT UNIQUE NOT NULL,
        request_date TEXT,
        required_date TEXT,
        department TEXT,
        department_id INTEGER,
        requested_by TEXT,
        supplier_id INTEGER,
        supplier_name TEXT,
        godown_id INTEGER,
        godown_name TEXT,
        priority TEXT DEFAULT 'Medium',
        status TEXT DEFAULT 'Draft',
        remarks TEXT,
        approved_by TEXT,
        approved_date TEXT,
        approval_remarks TEXT,
        converted_to_po_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'purchase_request_items',
      sql: `CREATE TABLE IF NOT EXISTS purchase_request_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_request_id INTEGER NOT NULL,
        item_id INTEGER,
        item_code TEXT,
        item_name TEXT NOT NULL,
        description TEXT,
        requested_qty REAL DEFAULT 0,
        approved_qty REAL DEFAULT 0,
        unit TEXT DEFAULT 'kg',
        current_stock REAL DEFAULT 0,
        minimum_stock REAL DEFAULT 0,
        suggested_qty REAL DEFAULT 0,
        estimated_rate REAL DEFAULT 0,
        estimated_amount REAL DEFAULT 0,
        remarks TEXT,
        FOREIGN KEY (purchase_request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE
      )`
    },
    {
      name: 'purchase_request_approval_history',
      sql: `CREATE TABLE IF NOT EXISTS purchase_request_approval_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_request_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        performed_by TEXT,
        remarks TEXT,
        performed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (purchase_request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE
      )`
    },
    {
=======
>>>>>>> origin/main
      name: 'sales',
      sql: `CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        s_no INTEGER NOT NULL,
        date DATE NOT NULL,
        customer TEXT,
        remarks TEXT,
        total_qty REAL DEFAULT 0,
        total_wt REAL DEFAULT 0,
        total_amt REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'sales_items',
      sql: `CREATE TABLE IF NOT EXISTS sales_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sales_id INTEGER,
        item_name TEXT NOT NULL,
        lot_no TEXT,
        weight REAL DEFAULT 0,
        qty REAL DEFAULT 0,
        total_wt REAL DEFAULT 0,
        rate REAL DEFAULT 0,
        disc_perc REAL DEFAULT 0,
        tax_perc REAL DEFAULT 0,
        total_amt REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sales_id) REFERENCES sales(id)
      )`
    },
    {
      name: 'stock',
      sql: `CREATE TABLE IF NOT EXISTS stock (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER,
        item_name TEXT,
        lot_no TEXT,
        qty REAL DEFAULT 0,
        weight REAL DEFAULT 0,
        rate REAL DEFAULT 0,
        amount REAL DEFAULT 0,
        date TEXT,
        type TEXT DEFAULT 'Purchase',
        reference_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'stock_lots',
      sql: `CREATE TABLE IF NOT EXISTS stock_lots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER,
        item_name TEXT,
        lot_no TEXT,
        purchase_id INTEGER,
        quantity REAL DEFAULT 0,
        remaining_quantity REAL DEFAULT 0,
        rate REAL DEFAULT 0,
<<<<<<< HEAD
        qc_status TEXT DEFAULT 'QC_PENDING',
        usable_for_production INTEGER DEFAULT 0,
        ledger_posted INTEGER DEFAULT 0,
        approval_status TEXT DEFAULT 'PENDING_APPROVAL',
        approval_date TEXT,
        approved_by TEXT,
        hold_reason TEXT,
        rejection_reason TEXT,
        unloading_status TEXT DEFAULT 'PENDING_DECISION',
=======
>>>>>>> origin/main
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'advances',
      sql: `CREATE TABLE IF NOT EXISTS advances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        s_no TEXT NOT NULL UNIQUE,
        date DATE NOT NULL,
        papad_company TEXT NOT NULL,
        amount REAL NOT NULL,
        pay_mode TEXT,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'grains',
      sql: `CREATE TABLE IF NOT EXISTS grains (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        s_no INTEGER NOT NULL,
        flour_mill TEXT,
        date DATE NOT NULL,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'grain_input_items',
      sql: `CREATE TABLE IF NOT EXISTS grain_input_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grain_id INTEGER,
        item_name TEXT NOT NULL,
        lot_no TEXT,
        weight REAL DEFAULT 0,
        qty REAL DEFAULT 0,
        total_wt REAL DEFAULT 0,
        wages_kg REAL DEFAULT 0,
        total_wages REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (grain_id) REFERENCES grains(id) ON DELETE CASCADE
      )`
    },
    {
      name: 'grain_output_items',
      sql: `CREATE TABLE IF NOT EXISTS grain_output_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grain_id INTEGER,
        item_name TEXT NOT NULL,
<<<<<<< HEAD
        lot_no TEXT,
        weight REAL DEFAULT 0,
        qty REAL DEFAULT 0,
        total_wt REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (grain_id) REFERENCES grains(id) ON DELETE CASCADE
      )`
    },
    {
      name: 'grain_wastage_items',
      sql: `CREATE TABLE IF NOT EXISTS grain_wastage_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grain_id INTEGER,
        item_name TEXT NOT NULL,
        lot_no TEXT,
=======
>>>>>>> origin/main
        weight REAL DEFAULT 0,
        qty REAL DEFAULT 0,
        total_wt REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (grain_id) REFERENCES grains(id) ON DELETE CASCADE
      )`
    },
    {
      name: 'flour_out',
      sql: `CREATE TABLE IF NOT EXISTS flour_out (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        s_no TEXT,
        date TEXT,
        papad_company TEXT,
        remarks TEXT,
        total_qty REAL DEFAULT 0,
        total_weight REAL DEFAULT 0,
        total_wages REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'flour_out_items',
      sql: `CREATE TABLE IF NOT EXISTS flour_out_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        flour_out_id INTEGER,
        item_name TEXT,
        lot_no TEXT,
        weight REAL DEFAULT 0,
        qty REAL DEFAULT 0,
        total_wt REAL DEFAULT 0,
        papad_kg REAL DEFAULT 0,
        wages_bag REAL DEFAULT 0,
        wages REAL DEFAULT 0,
        FOREIGN KEY (flour_out_id) REFERENCES flour_out(id)
      )`
    },
    {
      name: 'flour_out_returns',
      sql: `CREATE TABLE IF NOT EXISTS flour_out_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        s_no INTEGER NOT NULL,
        date DATETIME NOT NULL,
        tax_type TEXT DEFAULT 'Cash',
        remarks TEXT,
        total_qty REAL DEFAULT 0,
        total_weight REAL DEFAULT 0,
        total_wages REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'flour_out_return_items',
      sql: `CREATE TABLE IF NOT EXISTS flour_out_return_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        flour_out_return_id INTEGER,
        item_name TEXT NOT NULL,
        weight REAL DEFAULT 0,
        qty REAL DEFAULT 0,
        total_wt REAL DEFAULT 0,
        papad_kg REAL DEFAULT 0,
        cost REAL DEFAULT 0,
        wages_bag REAL DEFAULT 0,
        wages REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (flour_out_return_id) REFERENCES flour_out_returns(id) ON DELETE CASCADE
      )`
    },
    {
<<<<<<< HEAD
      name: 'purchase_orders',
      sql: `CREATE TABLE IF NOT EXISTS purchase_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        s_no INTEGER NOT NULL UNIQUE,
        supplier_id INTEGER,
        supplier_name TEXT,
        date TEXT NOT NULL,
        inv_no TEXT,
        inv_date TEXT,
        po_date TEXT,
        godown_id INTEGER,
        pay_type TEXT,
        tax_type TEXT,
        tax_rate REAL,
        type TEXT,
        terms TEXT,
        fob TEXT,
        ship_via TEXT,
        sign TEXT,
        address TEXT,
        sender TEXT,
        remarks TEXT,
        tax_percent REAL DEFAULT 0,
        amount REAL DEFAULT 0,
        bill_amt REAL DEFAULT 0,
        tax_amt REAL DEFAULT 0,
        total_amt REAL DEFAULT 0,
        status TEXT DEFAULT 'Active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'purchase_order_items',
      sql: `CREATE TABLE IF NOT EXISTS purchase_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_order_id INTEGER NOT NULL,
        item_id INTEGER,
        item_name TEXT,
        qty REAL NOT NULL,
        rate REAL NOT NULL,
        amount REAL NOT NULL,
        uom TEXT,
        weight_id INTEGER,
        weight REAL,
        tot_wt REAL DEFAULT 0,
        discount_percent REAL,
        tax_percent REAL,
        ed_percent REAL DEFAULT 0,
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
      )`
    },
    {
=======
>>>>>>> origin/main
      name: 'papad_in',
      sql: `CREATE TABLE IF NOT EXISTS papad_in (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        s_no INTEGER NOT NULL,
        date DATE NOT NULL,
        papad_company TEXT,
        lot_no TEXT,
        item_name TEXT,
        qty REAL DEFAULT 0,
        weight REAL DEFAULT 0,
        rate REAL DEFAULT 0,
        amount REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'purchase_returns',
      sql: `CREATE TABLE IF NOT EXISTS purchase_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        s_no INTEGER NOT NULL,
        date DATE NOT NULL,
        return_inv_no TEXT,
        supplier TEXT,
        pay_type TEXT DEFAULT 'Credit',
        inv_date DATE,
        type TEXT DEFAULT 'Urad',
        address TEXT,
        tax_type TEXT DEFAULT 'Exclusive',
        godown TEXT,
        remarks TEXT,
        total_qty REAL DEFAULT 0,
        total_weight REAL DEFAULT 0,
        total_amount REAL DEFAULT 0,
        base_amount REAL DEFAULT 0,
        disc_amount REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        net_amount REAL DEFAULT 0,
        auto_wages REAL DEFAULT 0,
        vat_percent REAL DEFAULT 0,
        vat REAL DEFAULT 0,
        grand_total REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'purchase_return_items',
      sql: `CREATE TABLE IF NOT EXISTS purchase_return_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_return_id INTEGER,
        lot_no TEXT,
        item_name TEXT NOT NULL,
        weight REAL DEFAULT 0,
        qty REAL DEFAULT 0,
        total_wt REAL DEFAULT 0,
        rate REAL DEFAULT 0,
        disc_percent REAL DEFAULT 0,
        tax_percent REAL DEFAULT 0,
        amount REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (purchase_return_id) REFERENCES purchase_returns(id) ON DELETE CASCADE
      )`
    },
    {
<<<<<<< HEAD
      name: 'sales_return',
      sql: `CREATE TABLE IF NOT EXISTS sales_return (
=======
      name: 'sales_returns',
      sql: `CREATE TABLE IF NOT EXISTS sales_returns (
>>>>>>> origin/main
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        s_no INTEGER NOT NULL,
        date DATE NOT NULL,
        customer TEXT,
<<<<<<< HEAD
        pay_type TEXT,
        tax_type TEXT,
        address TEXT,
=======
>>>>>>> origin/main
        remarks TEXT,
        total_qty REAL DEFAULT 0,
        total_wt REAL DEFAULT 0,
        total_amt REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'sales_return_items',
      sql: `CREATE TABLE IF NOT EXISTS sales_return_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sales_return_id INTEGER,
        item_name TEXT NOT NULL,
        lot_no TEXT,
        weight REAL DEFAULT 0,
        qty REAL DEFAULT 0,
        total_wt REAL DEFAULT 0,
        rate REAL DEFAULT 0,
        disc_perc REAL DEFAULT 0,
        tax_perc REAL DEFAULT 0,
        total_amt REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
<<<<<<< HEAD
        FOREIGN KEY (sales_return_id) REFERENCES sales_return(id)
=======
        FOREIGN KEY (sales_return_id) REFERENCES sales_returns(id)
>>>>>>> origin/main
      )`
    },
    {
      name: 'open',
      sql: `CREATE TABLE IF NOT EXISTS open (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        s_no TEXT,
        date TEXT,
        description TEXT,
        amount REAL DEFAULT 0,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
<<<<<<< HEAD
    },
    {
      name: 'quotations',
      sql: `CREATE TABLE IF NOT EXISTS quotations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        s_no TEXT,
        date TEXT,
        customer TEXT,
        item_name TEXT,
        lot_no TEXT,
        qty REAL DEFAULT 0,
        amount REAL DEFAULT 0,
        bill_no TEXT,
        pay_type TEXT,
        tax_type TEXT,
        type TEXT,
        remarks TEXT,
        address TEXT,
        tax_percent REAL DEFAULT 0,
        bill_amt REAL DEFAULT 0,
        tax_amt REAL DEFAULT 0,
        total_amt REAL DEFAULT 0,
        deduction REAL DEFAULT 0,
        percent REAL DEFAULT 0,
        deduction_amount REAL DEFAULT 0,
        deduction_remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'quotation_items',
      sql: `CREATE TABLE IF NOT EXISTS quotation_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quotation_id INTEGER,
        item_name TEXT,
        qty REAL DEFAULT 0,
        box REAL DEFAULT 0,
        rate REAL DEFAULT 0,
        disc REAL DEFAULT 0,
        tax REAL DEFAULT 0,
        amount REAL DEFAULT 0,
        FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
      )`
    },
    {
      name: 'stock_adjustments',
      sql: `CREATE TABLE IF NOT EXISTS stock_adjustments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        s_no TEXT NOT NULL UNIQUE,
        date DATE NOT NULL,
        type TEXT,
        papad_comp TEXT,
        flour_mill TEXT,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'stock_adjustment_items',
      sql: `CREATE TABLE IF NOT EXISTS stock_adjustment_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_adjustment_id INTEGER,
        s_no INTEGER,
        item_name TEXT NOT NULL,
        lot_no TEXT,
        weight REAL DEFAULT 0,
        type TEXT,
        qty REAL DEFAULT 0,
        tot_wt REAL DEFAULT 0,
        rate REAL DEFAULT 0,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (stock_adjustment_id) REFERENCES stock_adjustments(id) ON DELETE CASCADE
      )`
    },
    {
      name: 'weight_conversion',
      sql: `CREATE TABLE IF NOT EXISTS weight_conversion (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        s_no INTEGER,
        date TEXT,
        remarks TEXT,
        type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'weight_conversion_items',
      sql: `CREATE TABLE IF NOT EXISTS weight_conversion_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        weight_conversion_id INTEGER,
        s_no INTEGER,
        item_name TEXT,
        lot_no TEXT,
        weight REAL,
        qty REAL,
        total_wt REAL,
        type TEXT DEFAULT 'input',
        FOREIGN KEY (weight_conversion_id) REFERENCES weight_conversion(id) ON DELETE CASCADE
      )`
    },
    {
      name: 'sales_export_orders',
      sql: `CREATE TABLE IF NOT EXISTS sales_export_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bill_no TEXT,
        date TEXT,
        order_no_dt TEXT,
        dis_port TEXT,
        dest_country TEXT,
        final_destin TEXT,
        sender TEXT,
        net_wt REAL,
        advance REAL,
        exporter TEXT,
        consignee TEXT,
        buyer_other TEXT,
        other_ref TEXT,
        pre_carriage TEXT,
        vessel_flt_no TEXT,
        consigned_to TEXT,
        gross_wt REAL,
        sign TEXT,
        place_of_rcpt TEXT,
        loading_port TEXT,
        origin_country TEXT,
        delivery_terms TEXT,
        payment_terms TEXT,
        pur_transport TEXT,
        driver TEXT,
        lorry_no TEXT,
        remarks TEXT,
        total_qty REAL,
        total_usd_amt REAL,
        total_inr_amt REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'sales_export_order_items',
      sql: `CREATE TABLE IF NOT EXISTS sales_export_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sales_export_order_id INTEGER,
        container_no TEXT,
        kind_of_package TEXT,
        description TEXT,
        qty_in_kg REAL,
        mfd_exp_dt TEXT,
        lot_no TEXT,
        qty REAL,
        usd_rate REAL,
        conv_rate REAL,
        usd_amt REAL,
        inr_amt REAL,
        FOREIGN KEY (sales_export_order_id) REFERENCES sales_export_orders(id) ON DELETE CASCADE
      )`
    },
    {
      name: 'item_transfers',
      sql: `CREATE TABLE IF NOT EXISTS item_transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transfer_no TEXT,
        date TEXT,
        from_godown_id INTEGER,
        from_godown_name TEXT,
        to_godown_id INTEGER,
        to_godown_name TEXT,
        item_id INTEGER,
        item_code TEXT,
        item_name TEXT,
        lot_no TEXT,
        weight REAL DEFAULT 0,
        unit TEXT DEFAULT 'kg',
        available_qty REAL DEFAULT 0,
        transfer_qty REAL DEFAULT 0,
        rate REAL DEFAULT 0,
        amount REAL DEFAULT 0,
        remarks TEXT,
        created_by TEXT DEFAULT 'Admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'godown_transfers',
      sql: `CREATE TABLE IF NOT EXISTS godown_transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        s_no TEXT,
        transfer_date TEXT,
        from_godown_id INTEGER,
        from_godown_name TEXT,
        to_godown_id INTEGER,
        to_godown_name TEXT,
        item_name TEXT,
        lot_no TEXT,
        qty REAL DEFAULT 0,
        weight REAL DEFAULT 0,
        remarks TEXT,
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
=======
>>>>>>> origin/main
    }
  ]

  // Create all tables
  for (const table of masterTables) {
    try {
      await new Promise((resolve, reject) => {
        db.run(table.sql, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })
      console.log(`✓ Table '${table.name}' created/verified`)
    } catch (error) {
      console.log(`✗ Error creating table '${table.name}': ${error.message}`)
    }
  }

  // Insert sample data
  console.log('\nInserting sample data...')
  
  const sampleData = [
    // Cities
    { table: 'city_master', data: { name: 'Mumbai', print_name: 'MUMBAI', status: 'Active' } },
    { table: 'city_master', data: { name: 'Delhi', print_name: 'DELHI', status: 'Active' } },
    { table: 'city_master', data: { name: 'Surat', print_name: 'SURAT', status: 'Active' } },
    { table: 'city_master', data: { name: 'Ahmedabad', print_name: 'AHMEDABAD', status: 'Active' } },
    
    // Areas
    { table: 'area_master', data: { name: 'Station Road', print_name: 'STATION ROAD', status: 'Active' } },
    { table: 'area_master', data: { name: 'Ring Road', print_name: 'RING ROAD', status: 'Active' } },
    { table: 'area_master', data: { name: 'MG Road', print_name: 'MG ROAD', status: 'Active' } },
    
    // Item Groups
    { table: 'item_groups', data: { group_code: 'PLS', group_name: 'Pulses', print_name: 'PULSES', tax: 5 } },
    { table: 'item_groups', data: { group_code: 'GRM', group_name: 'Grains', print_name: 'GRAINS', tax: 0 } },
    { table: 'item_groups', data: { group_code: 'SPT', group_name: 'Spices', print_name: 'SPICES', tax: 5 } },
    
    // Items
    { table: 'item_master', data: { item_code: 'URD001', item_name: 'Urad Dal', print_name: 'URAD DAL', item_group: 'Pulses', tax: 5, hsn_code: '071390', status: 'Active' } },
    { table: 'item_master', data: { item_code: 'MOO001', item_name: 'Moong Dal', print_name: 'MOONG DAL', item_group: 'Pulses', tax: 5, hsn_code: '071390', status: 'Active' } },
    { table: 'item_master', data: { item_code: 'MAS001', item_name: 'Masur Dal', print_name: 'MASUR DAL', item_group: 'Pulses', tax: 5, hsn_code: '071390', status: 'Active' } },
    { table: 'item_master', data: { item_code: 'TOO001', item_name: 'Toor Dal', print_name: 'TOOR DAL', item_group: 'Pulses', tax: 5, hsn_code: '071390', status: 'Active' } },
    { table: 'item_master', data: { item_code: 'CHB001', item_name: 'Chana Dal', print_name: 'CHANA DAL', item_group: 'Pulses', tax: 5, hsn_code: '071390', status: 'Active' } },
    
    // Suppliers
    { table: 'supplier_master', data: { name: 'ABC Traders', print_name: 'ABC TRADERS', contact_person: 'John Doe', address1: '123 Main St', area: 'Station Road', status: 'Active' } },
    { table: 'supplier_master', data: { name: 'XYZ Suppliers', print_name: 'XYZ SUPPLIERS', contact_person: 'Jane Smith', address1: '456 Market Rd', area: 'Ring Road', status: 'Active' } },
    { table: 'supplier_master', data: { name: 'Premium Grains', print_name: 'PREMIUM GRAINS', contact_person: 'Raj Patel', address1: '789 Trade Centre', area: 'MG Road', status: 'Active' } },
    
    // Customers
    { table: 'customer_master', data: { name: 'Customer A', print_name: 'CUSTOMER A', contact_person: 'Alice', address1: '789 Customer St', area: 'Station Road', status: 'Active' } },
    { table: 'customer_master', data: { name: 'Customer B', print_name: 'CUSTOMER B', contact_person: 'Bob', address1: '321 Buyer Ave', area: 'Ring Road', status: 'Active' } },
    { table: 'customer_master', data: { name: 'Customer C', print_name: 'CUSTOMER C', contact_person: 'Charlie', address1: '654 Shop Lane', area: 'MG Road', status: 'Active' } },
    
    // Papad Companies
    { table: 'papad_company_master', data: { name: 'Shree Papad', print_name: 'SHREE PAPAD', contact_person: 'Mr. Patel', address1: '100 Industrial Area', status: 'Active' } },
    { table: 'papad_company_master', data: { name: 'Amul Papad', print_name: 'AMUL PAPAD', contact_person: 'Mr. Shah', address1: '200 Food Park', status: 'Active' } },
    { table: 'papad_company_master', data: { name: 'Bikaneri Papad', print_name: 'BIKANERI PAPAD', contact_person: 'Mr. Gupta', address1: '300 Market Road', status: 'Active' } },
    
    // Flour Mills
    { table: 'flour_mill_master', data: { flourmill: 'Premium Flour Mill', print_name: 'PREMIUM FLOUR MILL', contact_person: 'Mr. Kumar', address1: '50 Mill Road', status: 'Active' } },
    { table: 'flour_mill_master', data: { flourmill: 'Shakti Atta', print_name: 'SHAKTI ATTA', contact_person: 'Mr. Singh', address1: '100 Industry Ave', status: 'Active' } },
    
    // Transport
    { table: 'transport_master', data: { name: 'Gujarat Transport', print_name: 'GUJARAT TRANSPORT', status: 'Active' } },
    { table: 'transport_master', data: { name: 'Speedy Cargo', print_name: 'SPEEDY CARGO', status: 'Active' } },
    { table: 'transport_master', data: { name: 'Express Logistics', print_name: 'EXPRESS LOGISTICS', status: 'Active' } },
    
    // PTrans
    { table: 'ptrans_master', data: { name: 'Rail', print_name: 'RAIL', status: 'Active' } },
    { table: 'ptrans_master', data: { name: 'Road', print_name: 'ROAD', status: 'Active' } },
    { table: 'ptrans_master', data: { name: 'Air', print_name: 'AIR', status: 'Active' } },
    
    // Weights
    { table: 'weightmaster', data: { name: '1 KG', printname: '1 KG', weight: 1 } },
    { table: 'weightmaster', data: { name: '500 GM', printname: '500 GM', weight: 0.5 } },
    { table: 'weightmaster', data: { name: '1 GM', printname: '1 GM', weight: 0.001 } },
    { table: 'weightmaster', data: { name: '25 KG', printname: '25 KG', weight: 25 } },
    { table: 'weightmaster', data: { name: '50 KG', printname: '50 KG', weight: 50 } },
    
    // Deduction Sales
    { table: 'deduction_sales', data: { ded_code: 'TCS', ded_name: 'TCS on Sales', print_name: 'TCS ON SALES', ded_type: 'Percentage', calc_type: 'Percentage', ded_value: 0.1, status: 'Active' } },
    { table: 'deduction_sales', data: { ded_code: 'ROFF', ded_name: 'Round Off', print_name: 'ROUND OFF', ded_type: 'Fixed', calc_type: 'Fixed', ded_value: 0, status: 'Active' } },
    
    // Deduction Purchase
    { table: 'deduction_purchase', data: { ded_code: 'TDS', ded_name: 'TDS on Purchase', print_name: 'TDS ON PURCHASE', ded_type: 'Percentage', calc_type: 'Percentage', status: 'Active' } },
    { table: 'deduction_purchase', data: { ded_code: 'ROFF', ded_name: 'Round Off', print_name: 'ROUND OFF', ded_type: 'Fixed', calc_type: 'Fixed', status: 'Active' } }
  ]
  
  for (const item of sampleData) {
    try {
      const fields = Object.keys(item.data)
      const values = Object.values(item.data)
      const placeholders = fields.map(() => '?').join(', ')
      
      await new Promise((resolve, reject) => {
        db.run(`INSERT OR IGNORE INTO ${item.table} (${fields.join(', ')}) VALUES (${placeholders})`, values, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })
      console.log(`✓ Inserted into ${item.table}: ${item.data.name || item.data.item_name || item.data.flourmill || item.data.group_code || item.data.ded_name}`)
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        console.log(`- Already exists in ${item.table}`)
      } else {
        console.log(`✗ Error inserting into ${item.table}: ${error.message}`)
      }
    }
  }

  // Verify tables
  console.log('\n=== Database Tables ===')
  await new Promise((resolve, reject) => {
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
      if (err) reject(err)
      else {
        rows.forEach(r => console.log(`  - ${r.name}`))
        resolve()
      }
    })
  })

  console.log('\n✓ Database initialization complete!')
<<<<<<< HEAD
  if (require.main === module) {
    await new Promise((resolve) => {
      db.close((err) => {
        if (err) console.error('Error closing database:', err.message);
        resolve();
      });
    });
  }
}

if (require.main === module) {
  initializeDatabase()
    .then(() => {
      process.exit(0)
    })
    .catch(err => {
      console.error('Error:', err)
      process.exit(1)
    })
} else {
  module.exports = initializeDatabase;
}
=======
}

initializeDatabase()
  .then(() => {
    db.close()
    process.exit(0)
  })
  .catch(err => {
    console.error('Error:', err)
    db.close()
    process.exit(1)
  })
>>>>>>> origin/main
