.dbconfig defensive off
BEGIN;
PRAGMA writable_schema = on;
PRAGMA foreign_keys = off;
PRAGMA encoding = 'UTF-8';
PRAGMA page_size = '4096';
PRAGMA auto_vacuum = '0';
PRAGMA user_version = '0';
PRAGMA application_id = '0';
CREATE TABLE sqlite_sequence(name,seq);
CREATE TABLE advances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        s_no TEXT NOT NULL UNIQUE,
        date DATE NOT NULL,
        papad_company TEXT NOT NULL,
        amount REAL NOT NULL,
        pay_mode TEXT,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      , dr_cr TEXT DEFAULT 'Dr');
CREATE TABLE voucher (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        voucher_type TEXT NOT NULL,
        voucher_no TEXT UNIQUE NOT NULL,
        date TEXT NOT NULL,
        reference_no TEXT,
        narration TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      , status TEXT DEFAULT 'Approved', posted INTEGER DEFAULT 1);
CREATE TABLE work_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        work_order_no TEXT UNIQUE,
        work_unit TEXT NOT NULL,
        flour_mill_id INTEGER,
        product TEXT NOT NULL,
        product_id INTEGER,
        date DATE NOT NULL,
        status TEXT DEFAULT 'ISSUED',
        expected_output_qty REAL DEFAULT 0,
        expected_output_wt REAL DEFAULT 0,
        actual_output_qty REAL DEFAULT 0,
        actual_output_wt REAL DEFAULT 0,
        rejection_wt REAL DEFAULT 0,
        elevator_wt REAL DEFAULT 0,
        waste_flour_wt REAL DEFAULT 0,
        sieve_flour_wt REAL DEFAULT 0,
        other_wastage_wt REAL DEFAULT 0,
        grind_id INTEGER,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
CREATE TABLE stock_alert_config (
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
        );
CREATE TABLE tax_master (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tax_name TEXT NOT NULL,
        hsn_code TEXT NOT NULL,
        tax_type TEXT DEFAULT 'Taxable',
        description TEXT,
        gst_rate REAL DEFAULT 0,
        cgst_rate REAL DEFAULT 0,
        sgst_rate REAL DEFAULT 0,
        igst_rate REAL DEFAULT 0,
        cess_rate REAL DEFAULT 0,
        calc_type TEXT DEFAULT 'Exclusive',
        effective_from TEXT,
        effective_to TEXT,
        status TEXT DEFAULT 'Active',
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
CREATE TABLE item_transfers (
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
      );
CREATE TABLE godown_transfers (
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
      );
CREATE TABLE packing (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        s_no TEXT,
        date TEXT,
        type TEXT,
        papad_comp TEXT,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
CREATE TABLE user_activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_name TEXT NOT NULL,
        activity_type TEXT NOT NULL,
        activity_date TEXT NOT NULL,
        activity_time TEXT NOT NULL,
        remarks TEXT,
        company_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
CREATE TABLE compliance_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doc_code TEXT NOT NULL, -- D1 to D11 or Custom
        doc_type TEXT NOT NULL, -- WORK_INSTRUCTION, HAZARD_PLAN, MTR_SPEC, TRAINING, SOP, RCCA, MEDICAL, FOSTAC, RECALL, HALAL, PROCESS_FLOW
        doc_number TEXT NOT NULL,
        title TEXT NOT NULL,
        department TEXT,
        process_stage TEXT,
        version TEXT DEFAULT '1.0',
        status TEXT DEFAULT 'APPROVED', -- DRAFT, UNDER_REVIEW, APPROVED, OBSOLETE
        effective_date TEXT,
        review_date TEXT,
        prepared_by TEXT,
        approved_by TEXT,
        verified_by TEXT,
        item_id INTEGER,
        item_name TEXT,
        item_group TEXT,
        lot_no TEXT,
        supplier_id INTEGER,
        supplier_name TEXT,
        employee_id INTEGER,
        employee_name TEXT,
        details_json TEXT, -- JSON for specialized fields (hazards, parameters, steps, 5-why, recall data, etc.)
        remarks TEXT,
        attachment_url TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
CREATE TABLE purchase_return_deductions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_return_id INTEGER,
        deduction_id INTEGER,
        deduction_name TEXT,
        type TEXT,
        calculation_type TEXT,
        percentage REAL DEFAULT 0,
        amount REAL DEFAULT 0
      );
CREATE TABLE purchase_deductions (
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, ded_type TEXT DEFAULT 'LESS', rate REAL DEFAULT 0, deduction_id INTEGER,
        FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
      );
CREATE TABLE purchase_requests (
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
      , po_no TEXT);
CREATE TABLE stock_lots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER,
        item_name TEXT NOT NULL,
        lot_no TEXT NOT NULL,
        purchase_id INTEGER,
        quantity REAL DEFAULT 0,
        remaining_quantity REAL DEFAULT 0,
        rate REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      , godown_id INTEGER DEFAULT 1, qc_status TEXT DEFAULT 'QC_PENDING', usable_for_production INTEGER DEFAULT 0, ledger_posted INTEGER DEFAULT 0, approval_status TEXT DEFAULT 'PENDING_APPROVAL', approval_date TEXT, approved_by TEXT, hold_reason TEXT, rejection_reason TEXT, unloading_status TEXT DEFAULT 'PENDING_DECISION');
CREATE TABLE grain_wastage_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grain_id INTEGER,
        item_name TEXT NOT NULL,
        lot_no TEXT,
        weight REAL DEFAULT 0,
        qty REAL DEFAULT 0,
        total_wt REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, category TEXT,
        FOREIGN KEY (grain_id) REFERENCES grains(id) ON DELETE CASCADE
      );
CREATE TABLE voucher_entry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        voucher_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        ledger_id INTEGER,
        ledger_name TEXT,
        debit REAL DEFAULT 0,
        credit REAL DEFAULT 0,
        remarks TEXT,
        FOREIGN KEY (voucher_id) REFERENCES voucher(id) ON DELETE CASCADE
      );
CREATE TABLE work_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        work_order_id INTEGER NOT NULL,
        lot_no TEXT,
        supplier TEXT,
        item_name TEXT NOT NULL,
        item_id INTEGER,
        weight REAL DEFAULT 0,
        input_qty REAL DEFAULT 0,
        kgs REAL DEFAULT 0,
        rate REAL DEFAULT 0,
        output_item TEXT,
        output_qty REAL DEFAULT 0,
        output_weight REAL DEFAULT 0,
        output_kgs REAL DEFAULT 0,
        fg_lot_no TEXT,
        rejection_wt REAL DEFAULT 0,
        elevator_wt REAL DEFAULT 0,
        waste_flour_wt REAL DEFAULT 0,
        sieve_flour_wt REAL DEFAULT 0,
        wastage_category TEXT,
        wastage_qty REAL DEFAULT 0,
        wastage_wt REAL DEFAULT 0,
        wastage_lot_no TEXT,
        FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE
      );
CREATE TABLE purchase_request_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_request_id INTEGER NOT NULL,
        item_id INTEGER,
        item_code TEXT,
        item_name TEXT NOT NULL,
        weight TEXT,
        description TEXT,
        requested_qty REAL DEFAULT 0,
        approved_qty REAL DEFAULT 0,
        unit TEXT DEFAULT 'kg',
        current_stock REAL DEFAULT 0,
        current_stock_rm REAL DEFAULT 0,
        current_stock_fg REAL DEFAULT 0,
        minimum_stock REAL DEFAULT 0,
        suggested_qty REAL DEFAULT 0,
        estimated_rate REAL DEFAULT 0,
        estimated_amount REAL DEFAULT 0,
        remarks TEXT,
        FOREIGN KEY (purchase_request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE
      );
CREATE TABLE weight_machine_setup (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER UNIQUE,
        port_no TEXT DEFAULT '0',
        baud_rate TEXT DEFAULT '0',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
CREATE TABLE ledger_entries (
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
      );
CREATE TABLE work_order_outputs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        work_order_id INTEGER NOT NULL,
        output_item TEXT NOT NULL,
        item_id INTEGER,
        fg_lot_no TEXT,
        weight REAL DEFAULT 0,
        expected_qty REAL DEFAULT 0,
        output_kgs REAL DEFAULT 0,
        rate REAL DEFAULT 0,
        remarks TEXT,
        FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE
      );
CREATE TABLE general_setup (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER UNIQUE,
        current_date TEXT,
        auto_backup TEXT DEFAULT 'Yes',
        backup_subfolder TEXT DEFAULT 'Yes',
        backup_path TEXT DEFAULT '',
        printer_path TEXT DEFAULT 'CutePDF Writer',
        select_theme TEXT DEFAULT 'Gray',
        credit_debit_instead TEXT DEFAULT 'No',
        manual_voucher_no TEXT DEFAULT 'No',
        use_voucher_print TEXT DEFAULT 'No',
        date_locked_upto TEXT DEFAULT '31-03-2017',
        reset_version_no TEXT DEFAULT 'No',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
CREATE TABLE compliance_cleaning_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_code TEXT NOT NULL, -- C1 to C10
        record_type TEXT NOT NULL, -- AREA_CLEANING, PALLET_CONTROL, GLASS_PLASTIC, PEST_CONTROL, VEHICLE_INSPECTION, TOILET_CLEANING, VISITOR_DECLARATION, PM_INSPECTION, HYGIENE, MACHINERY
        record_no TEXT NOT NULL,
        record_date TEXT NOT NULL,
        area_location TEXT,
        frequency TEXT NOT NULL, -- Daily, 15 Days Once, Monthly Once, Loading, PM Receiving
        company_name TEXT DEFAULT 'BVC Exports Pvt. Ltd.',
        financial_year TEXT DEFAULT '2026-2027',
        supervisor_name TEXT,
        inspector_name TEXT,
        prepared_by TEXT,
        verified_by TEXT,
        customer_name TEXT,
        supplier_name TEXT,
        vehicle_no TEXT,
        status TEXT DEFAULT 'COMPLETED', -- DRAFT, COMPLETED, VERIFIED
        overall_status TEXT DEFAULT 'PASS', -- PASS, FAIL, ACTION_REQUIRED
        checklist_json TEXT, -- Key-value / list of checkpoints & observations
        corrective_action TEXT,
        completion_date TEXT,
        remarks TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      , entity_type TEXT, entity_id INTEGER, entity_code TEXT, entity_name TEXT, shift TEXT, time TEXT);
CREATE TABLE stock_alert_contacts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          contact_name TEXT NOT NULL,
          department TEXT DEFAULT 'Purchase',
          phone TEXT,
          email TEXT,
          active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
CREATE TABLE work_order_wastages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        work_order_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        item_name TEXT,
        lot_no TEXT,
        weight REAL DEFAULT 1,
        qty REAL DEFAULT 0,
        total_wt REAL DEFAULT 0,
        remarks TEXT,
        FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE
      );
CREATE TABLE purchase_request_approval_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_request_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        performed_by TEXT,
        remarks TEXT,
        performed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (purchase_request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE
      );
CREATE TABLE stock_alert_config_contacts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          config_id INTEGER NOT NULL,
          contact_id INTEGER NOT NULL,
          is_primary INTEGER DEFAULT 0,
          is_cc INTEGER DEFAULT 1,
          FOREIGN KEY (config_id) REFERENCES stock_alert_config(id) ON DELETE CASCADE,
          FOREIGN KEY (contact_id) REFERENCES stock_alert_contacts(id) ON DELETE CASCADE
        );
CREATE TABLE stock_alerts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          config_id INTEGER,
          item_id INTEGER,
          item_name TEXT NOT NULL,
          godown_id INTEGER,
          godown_name TEXT NOT NULL DEFAULT 'Main Godown',
          alert_type TEXT NOT NULL, -- 'CRITICAL', 'LOW', 'REORDER'
          current_qty REAL DEFAULT 0,
          minimum_qty REAL DEFAULT 0,
          reorder_level REAL DEFAULT 0,
          critical_level REAL DEFAULT 0,
          status TEXT DEFAULT 'OPEN', -- 'OPEN', 'RESOLVED', 'ACKNOWLEDGED'
          triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          resolved_at DATETIME,
          resolved_reason TEXT
        );
CREATE TABLE stock_alert_notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          alert_id INTEGER,
          contact_id INTEGER,
          contact_name TEXT,
          contact_email TEXT,
          contact_phone TEXT,
          channel TEXT NOT NULL, -- 'IN_APP', 'EMAIL', 'SMS', 'WHATSAPP', 'OFFLINE'
          message TEXT,
          status TEXT DEFAULT 'PENDING', -- 'PENDING', 'SENT', 'FAILED', 'RESOLVED'
          sent_at DATETIME,
          failure_reason TEXT,
          retry_count INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
CREATE TABLE area_master (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        print_name TEXT,
        status TEXT DEFAULT 'Active'
      );
CREATE TABLE cheque_printing (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bank_name TEXT,
        ac_name TEXT,
        chq_date TEXT,
        chq_amount REAL DEFAULT 0,
        ac_payee TEXT DEFAULT 'Yes',
        auth_sign TEXT DEFAULT 'Yes',
        no_of_copies INTEGER DEFAULT 1,
        ac_no TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
CREATE TABLE city_master (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        print_name TEXT,
        status TEXT DEFAULT 'Active'
      );
CREATE TABLE companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT,
        gst_number TEXT,
        contact TEXT,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      , state TEXT DEFAULT "Tamil Nadu", state_code TEXT DEFAULT "33", tax_reg_type TEXT DEFAULT "Regular");
CREATE TABLE consignee_group_master (
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
      );
CREATE TABLE customer_master (
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
      , email TEXT, transport TEXT, limit_days INTEGER, limit_amount REAL, balance_type TEXT DEFAULT 'Dr', state TEXT DEFAULT "Tamil Nadu", state_code TEXT DEFAULT "33", tax_reg_type TEXT DEFAULT "Regular");
CREATE TABLE deduction_purchase (
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
      , affect_cost_of_goods TEXT DEFAULT 'No', type TEXT DEFAULT 'Add', debit_side_adjust TEXT DEFAULT 'None', deduction_type TEXT DEFAULT 'Add', calculation_type TEXT DEFAULT 'Percentage', deduction_value REAL DEFAULT 0);
CREATE TABLE deduction_sales (
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
      );
CREATE TABLE employee_master (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        print_name TEXT,
        designation TEXT,
        phone TEXT,
        address TEXT,
        status TEXT DEFAULT 'Active'
      );
CREATE TABLE flour_mill_master (
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
      , tin_no TEXT, opening_balance_type TEXT DEFAULT 'Cr');
CREATE TABLE flour_out (
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
      , address TEXT, mill_id INTEGER, mill_name TEXT, vehicle_no TEXT);
CREATE TABLE flour_out_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        flour_out_id INTEGER,
        item_name TEXT,
        lot_no TEXT,
        weight REAL DEFAULT 0,
        qty REAL DEFAULT 0,
        total_wt REAL DEFAULT 0,
        papad_kg REAL DEFAULT 0,
        wages_bag REAL DEFAULT 0,
        wages REAL DEFAULT 0, box_papad REAL DEFAULT 0, wt_papad REAL DEFAULT 0, box_empty REAL DEFAULT 0, wt_empty REAL DEFAULT 0, papad_details TEXT, empty_details TEXT,
        FOREIGN KEY (flour_out_id) REFERENCES flour_out(id)
      );
CREATE TABLE flour_out_return_items (
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, lot_no TEXT,
        FOREIGN KEY (flour_out_return_id) REFERENCES flour_out_returns(id) ON DELETE CASCADE
      );
CREATE TABLE flour_out_returns (
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
      , papad_company TEXT);
CREATE TABLE godown_master (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        godown_name TEXT UNIQUE,
        print_name TEXT,
        location TEXT,
        contact_person TEXT,
        address TEXT,
        phone_off TEXT,
        area TEXT,
        status TEXT DEFAULT 'Active'
      , mobile1 TEXT, email TEXT, website TEXT, gst_number TEXT, name TEXT);
CREATE TABLE grain_input_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grain_id INTEGER,
        item_name TEXT NOT NULL,
        lot_no TEXT,
        weight REAL DEFAULT 0,
        qty REAL DEFAULT 0,
        total_wt REAL DEFAULT 0,
        wages_kg REAL DEFAULT 0,
        total_wages REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, rate REAL DEFAULT 0, supplier_name TEXT,
        FOREIGN KEY (grain_id) REFERENCES grains(id) ON DELETE CASCADE
      );
CREATE TABLE grain_output_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grain_id INTEGER,
        item_name TEXT NOT NULL,
        lot_no TEXT,
        weight REAL DEFAULT 0,
        qty REAL DEFAULT 0,
        total_wt REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (grain_id) REFERENCES grains(id) ON DELETE CASCADE
      );
CREATE TABLE grains (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        s_no INTEGER NOT NULL,
        flour_mill TEXT,
        date DATE NOT NULL,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      , work_order_id INTEGER, work_order_no TEXT, total_input_kg REAL DEFAULT 0, total_output_kg REAL DEFAULT 0, total_wastage_kg REAL DEFAULT 0, recovery_percent REAL DEFAULT 0, operator TEXT, machine_no TEXT, shift TEXT);
CREATE TABLE grind_ccp_monitoring (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grind_id INTEGER NOT NULL,
        voucher_number TEXT,
        lot_number TEXT,
        ccp_required INTEGER DEFAULT 1,
        ccp_category TEXT,
        critical_limit TEXT,
        actual_reading REAL DEFAULT 0,
        unit TEXT DEFAULT 'g/MT',
        status TEXT DEFAULT 'Pass',
        corrective_action TEXT,
        checked_by TEXT,
        checked_date_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (grind_id) REFERENCES grains(id) ON DELETE CASCADE
      );
CREATE TABLE grind_operator_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grind_id INTEGER NOT NULL,
        voucher_number TEXT,
        lot_number TEXT,
        operator TEXT,
        shift TEXT,
        action TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
CREATE TABLE grind_oprp_monitoring (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grind_id INTEGER NOT NULL,
        voucher_number TEXT,
        date TEXT,
        material TEXT,
        rm_fg TEXT DEFAULT 'RM',
        lot_number TEXT,
        quantity REAL DEFAULT 0,
        alp INTEGER DEFAULT 0,
        g INTEGER DEFAULT 0,
        checked_by TEXT,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, alp_gram REAL DEFAULT 0,
        FOREIGN KEY (grind_id) REFERENCES grains(id) ON DELETE CASCADE
      );
CREATE TABLE grind_production_verification (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grind_id INTEGER NOT NULL,
        voucher_number TEXT,
        operator TEXT,
        shift TEXT DEFAULT 'Shift-1',
        production_incharge TEXT,
        qc_technologist TEXT,
        qa_manager TEXT,
        final_approval TEXT DEFAULT 'APPROVED',
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (grind_id) REFERENCES grains(id) ON DELETE CASCADE
      );
CREATE TABLE incoming_quality_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        iqr_no TEXT UNIQUE,
        qc_id INTEGER NOT NULL,
        rm_lot_no TEXT NOT NULL,
        report_file TEXT,
        uploaded_date TEXT,
        uploaded_by TEXT,
        version INTEGER DEFAULT 1,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (qc_id) REFERENCES qc_inspections(id) ON DELETE CASCADE
      );
CREATE TABLE item_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_code TEXT UNIQUE,
        group_name TEXT,
        print_name TEXT,
        tax REAL DEFAULT 0
      , status TEXT DEFAULT 'Active');
CREATE TABLE item_master (
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
      , lab_parameters TEXT, minimum_qty REAL DEFAULT 0, reorder_level REAL DEFAULT 0, critical_level REAL DEFAULT 0, alert_enabled INTEGER DEFAULT 1, weight REAL DEFAULT 1, unit TEXT DEFAULT 'kg', tax_master_id INTEGER, tax_type TEXT DEFAULT "Taxable", gst_rate REAL DEFAULT 5);
CREATE TABLE ledgergroupmaster (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        printname TEXT,
        under TEXT
      , status TEXT DEFAULT 'Active');
CREATE TABLE ledgermaster (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        printname TEXT,
        under TEXT,
        openingbalance REAL DEFAULT 0,
        area TEXT,
        credit REAL DEFAULT 0,
        debit REAL DEFAULT 0,
        status TEXT DEFAULT 'Active'
      , alias_name TEXT, opening_type TEXT DEFAULT 'Dr', ledger_type TEXT DEFAULT 'General');
CREATE TABLE login_history (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, company_id INTEGER, login_time DATETIME DEFAULT CURRENT_TIMESTAMP, logout_time DATETIME, ip_address TEXT);
CREATE TABLE lot_sequence(
        id INTEGER PRIMARY KEY,
        last_lot_no INTEGER NOT NULL
      );
CREATE TABLE open (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        s_no TEXT,
        date TEXT,
        description TEXT,
        amount REAL DEFAULT 0,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      , type TEXT, papad_comp TEXT);
CREATE TABLE open_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        open_id INTEGER NOT NULL,
        lot_no TEXT,
        item_name TEXT,
        weight TEXT,
        qty REAL DEFAULT 0,
        tot_wt REAL DEFAULT 0,
        rate REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (open_id) REFERENCES open(id) ON DELETE CASCADE
      );
CREATE TABLE papad_company_entry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      from_date TEXT,
      to_date TEXT,
      papad_per_bag REAL DEFAULT 0,
      wages_per_bag REAL DEFAULT 0,
      advance_deduction_per_bag REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES papad_company_master(id) ON DELETE CASCADE
    );
CREATE TABLE papad_company_master (
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
        mobile1 TEXT,
        mobile2 TEXT,
        area TEXT,
        wages_kg REAL DEFAULT 0,
        opening_balance REAL DEFAULT 0,
        opening_advance REAL DEFAULT 0,
        status TEXT DEFAULT 'Active'
      , email TEXT, mobile TEXT);
CREATE TABLE papad_in (
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
      );
CREATE TABLE papad_return (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        s_no TEXT,
        date TEXT,
        papad_company TEXT,
        papad_balance REAL DEFAULT 0,
        payment_balance REAL DEFAULT 0,
        type TEXT DEFAULT 'Less',
        papad_less REAL DEFAULT 0,
        payment_less REAL DEFAULT 0,
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
CREATE TABLE person_master (
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
      );
CREATE TABLE ptrans_master (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        print_name TEXT,
        status TEXT DEFAULT 'Active'
      );
CREATE TABLE purchase_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_id INTEGER,
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
        amount REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, hsn_code TEXT, tax_type TEXT DEFAULT "Taxable", gst_rate REAL DEFAULT 0, cgst_rate REAL DEFAULT 0, cgst_amount REAL DEFAULT 0, sgst_rate REAL DEFAULT 0, sgst_amount REAL DEFAULT 0, igst_rate REAL DEFAULT 0, igst_amount REAL DEFAULT 0, cess_rate REAL DEFAULT 0, cess_amount REAL DEFAULT 0,
        FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
      );
CREATE TABLE purchase_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_order_id INTEGER NOT NULL,
        item_id INTEGER,
        qty REAL NOT NULL,
        rate REAL NOT NULL,
        amount REAL NOT NULL,
        uom TEXT,
        weight_id INTEGER,
        weight REAL,
        discount_percent REAL,
        tax_percent REAL, item_name TEXT, tot_wt REAL DEFAULT 0, ed_percent REAL DEFAULT 0,
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
      );
CREATE TABLE purchase_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        s_no INTEGER NOT NULL UNIQUE,
        supplier_id INTEGER,
        date TEXT NOT NULL,
        inv_no TEXT,
        inv_date TEXT,
        godown_id INTEGER,
        pay_type TEXT,
        tax_type TEXT,
        tax_rate REAL,
        type TEXT,
        remarks TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      , supplier_name TEXT, po_date TEXT, terms TEXT, fob TEXT, ship_via TEXT, sign TEXT, address TEXT, sender TEXT, tax_percent REAL DEFAULT 0, amount REAL DEFAULT 0, bill_amt REAL DEFAULT 0, tax_amt REAL DEFAULT 0, total_amt REAL DEFAULT 0, status TEXT DEFAULT 'Active', purchase_request_id INTEGER, pr_no TEXT, inward_purchase_id INTEGER);
CREATE TABLE purchase_return_items (
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, hsn_code TEXT, tax_type TEXT DEFAULT "Taxable", gst_rate REAL DEFAULT 0, cgst_amount REAL DEFAULT 0, sgst_amount REAL DEFAULT 0, igst_amount REAL DEFAULT 0,
        FOREIGN KEY (purchase_return_id) REFERENCES purchase_returns(id) ON DELETE CASCADE
      );
CREATE TABLE purchase_returns (
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
      , lot_no TEXT, purchase_id TEXT, company_state TEXT DEFAULT "Tamil Nadu", party_state TEXT DEFAULT "Tamil Nadu", cgst_amount REAL DEFAULT 0, sgst_amount REAL DEFAULT 0, igst_amount REAL DEFAULT 0, cess_amount REAL DEFAULT 0);
CREATE TABLE purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        s_no INTEGER NOT NULL,
        date DATE NOT NULL,
        inv_no TEXT,
        supplier TEXT,
        pay_type TEXT DEFAULT 'Credit',
        inv_date DATE,
        type TEXT DEFAULT 'Urad',
        contact_person TEXT,
        address TEXT,
        area TEXT,
        phone TEXT,
        gst_no TEXT,
        email TEXT,
        tax_type TEXT DEFAULT 'Exclusive',
        tax_percent REAL DEFAULT 0,
        godown TEXT,
        remarks TEXT,
        total_qty REAL DEFAULT 0,
        total_weight REAL DEFAULT 0,
        total_amount REAL DEFAULT 0,
        base_amount REAL DEFAULT 0,
        disc_amount REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        net_amount REAL DEFAULT 0,
        deduction_amount REAL DEFAULT 0,
        auto_wages REAL DEFAULT 0,
        vat_percent REAL DEFAULT 0,
        vat REAL DEFAULT 0,
        grand_total REAL DEFAULT 0,
        transport TEXT,
        lorry_no TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      , purchase_order_id INTEGER, po_no TEXT, source_order_id INTEGER, source_order_no TEXT, company_state TEXT DEFAULT "Tamil Nadu", party_state TEXT DEFAULT "Tamil Nadu", company_state_code TEXT DEFAULT "33", party_state_code TEXT DEFAULT "33", tax_mode TEXT DEFAULT "Exclusive", cgst_amount REAL DEFAULT 0, sgst_amount REAL DEFAULT 0, igst_amount REAL DEFAULT 0, cess_amount REAL DEFAULT 0, sub_total REAL DEFAULT 0, total_deductions REAL DEFAULT 0, round_off REAL DEFAULT 0, gross_weight REAL DEFAULT 0, tare_weight REAL DEFAULT 0, net_weight REAL DEFAULT 0);
CREATE TABLE qc_approval_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        qc_id INTEGER NOT NULL,
        approval_level TEXT NOT NULL,
        approved_by TEXT,
        approved_date TEXT,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (qc_id) REFERENCES qc_inspections(id) ON DELETE CASCADE
      );
CREATE TABLE qc_inspection_params (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        qc_id INTEGER NOT NULL,
        param_key TEXT NOT NULL,
        param_value TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (qc_id) REFERENCES qc_inspections(id) ON DELETE CASCADE
      );
CREATE TABLE qc_inspections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        qc_no TEXT UNIQUE,
        purchase_id INTEGER,
        purchase_item_id INTEGER,
        rm_lot_no TEXT NOT NULL,
        inspection_date TEXT,
        inspector TEXT,
        overall_result TEXT,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
CREATE TABLE quotation_items (
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
      );
CREATE TABLE quotations (
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
      );
CREATE TABLE sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        s_no INTEGER NOT NULL,
        date DATE NOT NULL,
        customer TEXT,
        remarks TEXT,
        total_qty REAL DEFAULT 0,
        total_wt REAL DEFAULT 0,
        total_amt REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      , pay_type TEXT, tax_type TEXT, lorry_no TEXT, p_o_no TEXT, driver TEXT, pur_trans TEXT, customer_id INTEGER, address TEXT, phone TEXT, sender_id INTEGER, consignee_id INTEGER, godown_from_id INTEGER, bill_amt REAL DEFAULT 0, tax_amt REAL DEFAULT 0, base_amt REAL DEFAULT 0, grand_total REAL DEFAULT 0, deduction TEXT, deduction_remarks TEXT, is_order INTEGER DEFAULT 0, deductions_json TEXT, deduction_amount REAL DEFAULT 0, company_state TEXT DEFAULT "Tamil Nadu", party_state TEXT DEFAULT "Tamil Nadu", company_state_code TEXT DEFAULT "33", party_state_code TEXT DEFAULT "33", tax_mode TEXT DEFAULT "Exclusive", cgst_amount REAL DEFAULT 0, sgst_amount REAL DEFAULT 0, igst_amount REAL DEFAULT 0, cess_amount REAL DEFAULT 0, total_amount REAL DEFAULT 0, total_weight REAL DEFAULT 0, po_no TEXT, sub_total REAL DEFAULT 0, tax_amount REAL DEFAULT 0, round_off REAL DEFAULT 0);
CREATE TABLE vehicle_movements (
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
      );
CREATE TABLE weight_conversion (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        s_no INTEGER,
        date TEXT,
        remarks TEXT,
        type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
CREATE TABLE weight_conversion_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        weight_conversion_id INTEGER,
        s_no INTEGER,
        item_name TEXT,
        lot_no TEXT,
        weight REAL,
        qty REAL,
        total_wt REAL, type TEXT DEFAULT 'input',
        FOREIGN KEY (weight_conversion_id) REFERENCES weight_conversion(id) ON DELETE CASCADE
      );
CREATE TABLE weightmaster (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        printname TEXT,
        weight REAL DEFAULT 0
      , status TEXT DEFAULT 'Active');
CREATE TABLE "financial_years" (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL DEFAULT 1, financial_year TEXT NOT NULL, year_name TEXT, start_date TEXT NOT NULL, end_date TEXT NOT NULL, status TEXT DEFAULT 'Active', is_active INTEGER DEFAULT 0, is_current INTEGER DEFAULT 0, is_locked INTEGER DEFAULT 0, remarks TEXT, created_by TEXT DEFAULT 'admin', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_by TEXT, updated_at DATETIME, closed_by TEXT, closed_at DATETIME);
CREATE TABLE purchase_order_deductions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    purchase_order_id INTEGER NOT NULL,
                    deduction_name TEXT,
                    type TEXT DEFAULT 'less',
                    value REAL DEFAULT 0,
                    amount REAL DEFAULT 0,
                    remarks TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
                );
INSERT OR IGNORE INTO 'stock_alert_config'('id', 'item_id', 'item_name', 'godown_id', 'godown_name', 'minimum_qty', 'reorder_level', 'critical_level', 'alert_enabled', 'in_app_enabled', 'email_enabled', 'sms_enabled', 'whatsapp_enabled', 'offline_enabled', 'created_at', 'updated_at') VALUES (1, 1, 'Urad Dal', NULL, 'All Godowns', 500, 1000, 200, 1, 1, 1, 0, 0, 1, '2026-08-27 09:44:14', '2026-08-27 09:44:14');
INSERT OR IGNORE INTO 'stock_alert_config'('id', 'item_id', 'item_name', 'godown_id', 'godown_name', 'minimum_qty', 'reorder_level', 'critical_level', 'alert_enabled', 'in_app_enabled', 'email_enabled', 'sms_enabled', 'whatsapp_enabled', 'offline_enabled', 'created_at', 'updated_at') VALUES (2, 2, 'Moong Dal', NULL, 'All Godowns', 500, 1000, 200, 1, 1, 1, 0, 0, 1, '2026-08-27 09:44:14', '2026-08-27 09:44:14');
INSERT OR IGNORE INTO 'stock_alert_config'('id', 'item_id', 'item_name', 'godown_id', 'godown_name', 'minimum_qty', 'reorder_level', 'critical_level', 'alert_enabled', 'in_app_enabled', 'email_enabled', 'sms_enabled', 'whatsapp_enabled', 'offline_enabled', 'created_at', 'updated_at') VALUES (3, 3, 'Masur Dal', NULL, 'All Godowns', 500, 1000, 200, 1, 1, 1, 0, 0, 1, '2026-08-27 09:44:14', '2026-08-27 09:44:14');
INSERT OR IGNORE INTO 'stock_alert_config'('id', 'item_id', 'item_name', 'godown_id', 'godown_name', 'minimum_qty', 'reorder_level', 'critical_level', 'alert_enabled', 'in_app_enabled', 'email_enabled', 'sms_enabled', 'whatsapp_enabled', 'offline_enabled', 'created_at', 'updated_at') VALUES (4, 4, 'Toor Dal', NULL, 'All Godowns', 500, 1000, 200, 1, 1, 1, 0, 0, 1, '2026-08-27 09:44:14', '2026-08-27 09:44:14');
INSERT OR IGNORE INTO 'stock_alert_config'('id', 'item_id', 'item_name', 'godown_id', 'godown_name', 'minimum_qty', 'reorder_level', 'critical_level', 'alert_enabled', 'in_app_enabled', 'email_enabled', 'sms_enabled', 'whatsapp_enabled', 'offline_enabled', 'created_at', 'updated_at') VALUES (5, 5, 'Chana Dal', NULL, 'All Godowns', 500, 1000, 200, 1, 1, 1, 0, 0, 1, '2026-08-27 09:44:14', '2026-08-27 09:44:14');
INSERT OR IGNORE INTO 'stock_alert_config'('id', 'item_id', 'item_name', 'godown_id', 'godown_name', 'minimum_qty', 'reorder_level', 'critical_level', 'alert_enabled', 'in_app_enabled', 'email_enabled', 'sms_enabled', 'whatsapp_enabled', 'offline_enabled', 'created_at', 'updated_at') VALUES (6, 6, 'Papad Masala', NULL, 'All Godowns', 200, 500, 50, 1, 1, 1, 0, 0, 1, '2026-08-27 09:44:14', '2026-08-27 09:44:14');
INSERT OR IGNORE INTO 'stock_alert_config'('id', 'item_id', 'item_name', 'godown_id', 'godown_name', 'minimum_qty', 'reorder_level', 'critical_level', 'alert_enabled', 'in_app_enabled', 'email_enabled', 'sms_enabled', 'whatsapp_enabled', 'offline_enabled', 'created_at', 'updated_at') VALUES (7, 7, 'Red Chilli Powder', NULL, 'All Godowns', 500, 1000, 200, 1, 1, 1, 0, 0, 1, '2026-08-27 09:44:14', '2026-08-27 09:44:14');
INSERT OR IGNORE INTO 'stock_alert_config'('id', 'item_id', 'item_name', 'godown_id', 'godown_name', 'minimum_qty', 'reorder_level', 'critical_level', 'alert_enabled', 'in_app_enabled', 'email_enabled', 'sms_enabled', 'whatsapp_enabled', 'offline_enabled', 'created_at', 'updated_at') VALUES (8, 8, 'Black Pepper Powder', NULL, 'All Godowns', 500, 1000, 200, 1, 1, 1, 0, 0, 1, '2026-08-27 09:44:14', '2026-08-27 09:44:14');
INSERT OR IGNORE INTO 'stock_alert_config'('id', 'item_id', 'item_name', 'godown_id', 'godown_name', 'minimum_qty', 'reorder_level', 'critical_level', 'alert_enabled', 'in_app_enabled', 'email_enabled', 'sms_enabled', 'whatsapp_enabled', 'offline_enabled', 'created_at', 'updated_at') VALUES (9, 9, 'Hing (Asafoetida)', NULL, 'All Godowns', 500, 1000, 200, 1, 1, 1, 0, 0, 1, '2026-08-27 09:44:14', '2026-08-27 09:44:14');
INSERT OR IGNORE INTO 'stock_alert_config'('id', 'item_id', 'item_name', 'godown_id', 'godown_name', 'minimum_qty', 'reorder_level', 'critical_level', 'alert_enabled', 'in_app_enabled', 'email_enabled', 'sms_enabled', 'whatsapp_enabled', 'offline_enabled', 'created_at', 'updated_at') VALUES (10, 10, 'Jeera Powder', NULL, 'All Godowns', 500, 1000, 200, 1, 1, 1, 0, 0, 1, '2026-08-27 09:44:14', '2026-08-27 09:44:14');
INSERT OR IGNORE INTO 'tax_master'('id', 'tax_name', 'hsn_code', 'tax_type', 'description', 'gst_rate', 'cgst_rate', 'sgst_rate', 'igst_rate', 'cess_rate', 'calc_type', 'effective_from', 'effective_to', 'status', 'remarks', 'created_at', 'updated_at') VALUES (1, 'Urad & Pulses (5% Pre-packaged)', '0713', 'Taxable', 'Dried leguminous vegetables, urad dal, moong, chana pre-packaged & labelled', 5, 2.5, 2.5, 5, 0, 'Exclusive', NULL, NULL, 'Active', 'CBIC standard rate for pre-packaged & labelled pulses', '2026-08-27 09:43:28', '2026-08-27 09:43:28');
INSERT OR IGNORE INTO 'tax_master'('id', 'tax_name', 'hsn_code', 'tax_type', 'description', 'gst_rate', 'cgst_rate', 'sgst_rate', 'igst_rate', 'cess_rate', 'calc_type', 'effective_from', 'effective_to', 'status', 'remarks', 'created_at', 'updated_at') VALUES (2, 'Urad & Pulses (Nil Rated / Non-Packaged)', '0713', 'Nil Rated', 'Urad dal, pulses other than pre-packaged and labelled', 0, 0, 0, 0, 0, 'Exclusive', NULL, NULL, 'Active', 'Nil GST under CBIC classification', '2026-08-27 09:43:28', '2026-08-27 09:43:28');
INSERT OR IGNORE INTO 'tax_master'('id', 'tax_name', 'hsn_code', 'tax_type', 'description', 'gst_rate', 'cgst_rate', 'sgst_rate', 'igst_rate', 'cess_rate', 'calc_type', 'effective_from', 'effective_to', 'status', 'remarks', 'created_at', 'updated_at') VALUES (3, 'Wheat Flour / Maida / Atta (5%)', '1101', 'Taxable', 'Wheat flour, maida, atta pre-packaged and labelled', 5, 2.5, 2.5, 5, 0, 'Exclusive', NULL, NULL, 'Active', '5% GST for pre-packaged flour', '2026-08-27 09:43:28', '2026-08-27 09:43:28');
INSERT OR IGNORE INTO 'tax_master'('id', 'tax_name', 'hsn_code', 'tax_type', 'description', 'gst_rate', 'cgst_rate', 'sgst_rate', 'igst_rate', 'cess_rate', 'calc_type', 'effective_from', 'effective_to', 'status', 'remarks', 'created_at', 'updated_at') VALUES (4, 'Cereal / Rice Flour (5%)', '1102', 'Taxable', 'Cereal flours other than wheat or meslin (e.g. rice flour)', 5, 2.5, 2.5, 5, 0, 'Exclusive', NULL, NULL, 'Active', '5% GST', '2026-08-27 09:43:28', '2026-08-27 09:43:28');
INSERT OR IGNORE INTO 'tax_master'('id', 'tax_name', 'hsn_code', 'tax_type', 'description', 'gst_rate', 'cgst_rate', 'sgst_rate', 'igst_rate', 'cess_rate', 'calc_type', 'effective_from', 'effective_to', 'status', 'remarks', 'created_at', 'updated_at') VALUES (5, 'Urad Flour / Pulse Flour (5%)', '1106', 'Taxable', 'Flour, meal and powder of dried leguminous vegetables / pulses', 5, 2.5, 2.5, 5, 0, 'Exclusive', NULL, NULL, 'Active', 'Urad flour manufactured in mill', '2026-08-27 09:43:28', '2026-08-27 09:43:28');
INSERT OR IGNORE INTO 'tax_master'('id', 'tax_name', 'hsn_code', 'tax_type', 'description', 'gst_rate', 'cgst_rate', 'sgst_rate', 'igst_rate', 'cess_rate', 'calc_type', 'effective_from', 'effective_to', 'status', 'remarks', 'created_at', 'updated_at') VALUES (6, 'Papad (Nil / 0% Exempt)', '1905', 'Nil Rated', 'Papad by whatever name called', 0, 0, 0, 0, 0, 'Exclusive', NULL, NULL, 'Active', 'CBIC 0% GST classification for papad', '2026-08-27 09:43:28', '2026-08-27 09:43:28');
INSERT OR IGNORE INTO 'tax_master'('id', 'tax_name', 'hsn_code', 'tax_type', 'description', 'gst_rate', 'cgst_rate', 'sgst_rate', 'igst_rate', 'cess_rate', 'calc_type', 'effective_from', 'effective_to', 'status', 'remarks', 'created_at', 'updated_at') VALUES (7, 'Spices & Masala (5%)', '0910', 'Taxable', 'Ginger, saffron, turmeric, thyme, bay leaves, curry and other spices', 5, 2.5, 2.5, 5, 0, 'Exclusive', NULL, NULL, 'Active', 'Spices 5%', '2026-08-27 09:43:28', '2026-08-27 09:43:28');
INSERT OR IGNORE INTO 'tax_master'('id', 'tax_name', 'hsn_code', 'tax_type', 'description', 'gst_rate', 'cgst_rate', 'sgst_rate', 'igst_rate', 'cess_rate', 'calc_type', 'effective_from', 'effective_to', 'status', 'remarks', 'created_at', 'updated_at') VALUES (8, 'Pepper / Chilli Whole (5%)', '0904', 'Taxable', 'Pepper of the genus Piper; dried or crushed or ground fruits', 5, 2.5, 2.5, 5, 0, 'Exclusive', NULL, NULL, 'Active', '5% GST', '2026-08-27 09:43:28', '2026-08-27 09:43:28');
INSERT OR IGNORE INTO 'tax_master'('id', 'tax_name', 'hsn_code', 'tax_type', 'description', 'gst_rate', 'cgst_rate', 'sgst_rate', 'igst_rate', 'cess_rate', 'calc_type', 'effective_from', 'effective_to', 'status', 'remarks', 'created_at', 'updated_at') VALUES (9, 'Packing Pouches & Films (18%)', '3923', 'Taxable', 'Articles for the conveyance or packing of goods, of plastics', 18, 9, 9, 18, 0, 'Exclusive', NULL, NULL, 'Active', 'Plastic packing materials', '2026-08-27 09:43:28', '2026-08-27 09:43:28');
INSERT OR IGNORE INTO 'tax_master'('id', 'tax_name', 'hsn_code', 'tax_type', 'description', 'gst_rate', 'cgst_rate', 'sgst_rate', 'igst_rate', 'cess_rate', 'calc_type', 'effective_from', 'effective_to', 'status', 'remarks', 'created_at', 'updated_at') VALUES (10, 'Corrugated Cartons / Boxes (12%)', '4819', 'Taxable', 'Cartons, boxes and cases, of corrugated paper or paperboard', 12, 6, 6, 12, 0, 'Exclusive', NULL, NULL, 'Active', 'Packing corrugated boxes', '2026-08-27 09:43:28', '2026-08-27 09:43:28');
INSERT OR IGNORE INTO 'tax_master'('id', 'tax_name', 'hsn_code', 'tax_type', 'description', 'gst_rate', 'cgst_rate', 'sgst_rate', 'igst_rate', 'cess_rate', 'calc_type', 'effective_from', 'effective_to', 'status', 'remarks', 'created_at', 'updated_at') VALUES (11, 'Standard GST 18%', '9999', 'Taxable', 'General taxable rate for commercial items and services', 18, 9, 9, 18, 0, 'Exclusive', NULL, NULL, 'Active', 'General GST 18%', '2026-08-27 09:43:28', '2026-08-27 09:43:28');
INSERT OR IGNORE INTO 'tax_master'('id', 'tax_name', 'hsn_code', 'tax_type', 'description', 'gst_rate', 'cgst_rate', 'sgst_rate', 'igst_rate', 'cess_rate', 'calc_type', 'effective_from', 'effective_to', 'status', 'remarks', 'created_at', 'updated_at') VALUES (12, 'Exempt Goods (0%)', '0000', 'Exempt', 'Goods completely exempt from GST under notifications', 0, 0, 0, 0, 0, 'Exclusive', NULL, NULL, 'Active', 'Exempt', '2026-08-27 09:43:28', '2026-08-27 09:43:28');
INSERT OR IGNORE INTO 'tax_master'('id', 'tax_name', 'hsn_code', 'tax_type', 'description', 'gst_rate', 'cgst_rate', 'sgst_rate', 'igst_rate', 'cess_rate', 'calc_type', 'effective_from', 'effective_to', 'status', 'remarks', 'created_at', 'updated_at') VALUES (13, 'Zero Rated / SEZ Supplies (0%)', '0001', 'Zero Rated', 'Exports of goods/services or supplies to SEZ developer/unit', 0, 0, 0, 0, 0, 'Exclusive', NULL, NULL, 'Active', 'Zero Rated Export/SEZ', '2026-08-27 09:43:28', '2026-08-27 09:43:28');
INSERT OR IGNORE INTO 'tax_master'('id', 'tax_name', 'hsn_code', 'tax_type', 'description', 'gst_rate', 'cgst_rate', 'sgst_rate', 'igst_rate', 'cess_rate', 'calc_type', 'effective_from', 'effective_to', 'status', 'remarks', 'created_at', 'updated_at') VALUES (14, 'Non-GST Goods (0%)', '0002', 'Non-GST', 'Supplies outside the purview of GST Act', 0, 0, 0, 0, 0, 'Exclusive', NULL, NULL, 'Active', 'Non-GST', '2026-08-27 09:43:28', '2026-08-27 09:43:28');
INSERT OR IGNORE INTO 'compliance_documents'('id', 'doc_code', 'doc_type', 'doc_number', 'title', 'department', 'process_stage', 'version', 'status', 'effective_date', 'review_date', 'prepared_by', 'approved_by', 'verified_by', 'item_id', 'item_name', 'item_group', 'lot_no', 'supplier_id', 'supplier_name', 'employee_id', 'employee_name', 'details_json', 'remarks', 'attachment_url', 'created_at', 'updated_at') VALUES (8, 'D8', 'FOSTAC', 'FOSTAC-FSSAI-88912', 'FOSTAC Food Safety Supervisor Certification - Manufacturing Level 2', 'Quality Assurance', NULL, '1.0', 'APPROVED', '2025-09-15', '2027-09-14', 'FSSAI Training Partner', 'Managing Director', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Kavitha M', '{"cert_number":"FSSAI/FOSTAC/ADV-MFG/88912","course_name":"Advanced Manufacturing Food Safety Supervisor (Pulses, Grains & Flours)","training_agency":"National Food Safety Training Institute","valid_till":"2027-09-14"}', 'Designated certified Food Safety Supervisor on site.', NULL, '2026-08-27 09:43:28', '2026-08-27 09:43:28');
INSERT OR IGNORE INTO 'compliance_documents'('id', 'doc_code', 'doc_type', 'doc_number', 'title', 'department', 'process_stage', 'version', 'status', 'effective_date', 'review_date', 'prepared_by', 'approved_by', 'verified_by', 'item_id', 'item_name', 'item_group', 'lot_no', 'supplier_id', 'supplier_name', 'employee_id', 'employee_name', 'details_json', 'remarks', 'attachment_url', 'created_at', 'updated_at') VALUES (9, 'D9', 'RECALL', 'REC-MOCK-2026-01', 'Mock Product Recall & Rapid Traceability Simulation Record', 'Quality & Crisis Mgmt', NULL, '1.0', 'APPROVED', '2026-08-01', NULL, 'Recall Coordinator', 'Managing Director', NULL, NULL, 'Broken Rice', NULL, 'LOT0014', NULL, NULL, NULL, NULL, '{"recall_classification":"Class II (Mock Recall Exercise)","reason":"Bi-annual mock recall to test rapid backward and forward traceability speed and recovery percentage.","inward_details":{"lot_no":"LOT0014","supplier":"Sri Amman Traders","purchase_invoice":"PI-2026-009","inward_qty_kg":540},"production_usage":{"milled_to":"BRF Flour & Packaged Broken Rice","process_order":"WO-2026-006"},"stock_distribution":{"factory_godown_stock_kg":400,"dispatched_sales_kg":140,"affected_customers":["M/s Royal Foods (Inv #SAL-0104 - 100 Kg)","M/s Lakshmi Stores (Inv #SAL-0109 - 40 Kg)"]},"reconciliation_rate":"100% (140 Kg locked in transit / retailer hold + 400 Kg in-house)","execution_time_minutes":42,"fssai_benchmark_met":true}', 'Mock recall completed in 42 minutes exceeding the 2-hour FSSAI benchmark.', NULL, '2026-08-27 09:43:28', '2026-08-27 09:43:28');
INSERT OR IGNORE INTO 'compliance_documents'('id', 'doc_code', 'doc_type', 'doc_number', 'title', 'department', 'process_stage', 'version', 'status', 'effective_date', 'review_date', 'prepared_by', 'approved_by', 'verified_by', 'item_id', 'item_name', 'item_group', 'lot_no', 'supplier_id', 'supplier_name', 'employee_id', 'employee_name', 'details_json', 'remarks', 'attachment_url', 'created_at', 'updated_at') VALUES (10, 'D10', 'HALAL', 'HALAL-DEC-2026', 'Halal Compliance & Non-Contamination Product Declaration', 'Export QA', NULL, '1.0', 'APPROVED', '2026-01-01', '2026-12-31', 'Quality Manager', 'Managing Director', NULL, NULL, 'All Flour & Pulse Products', NULL, NULL, NULL, NULL, NULL, NULL, '{"products_covered":["Urad Dal","Moong Dal","Toor Dal","Chana Dal","Rice Flour (BRF)","Plain Papad","Black Gram Flour (BGF)"],"source_materials":"100% Plant-derived pure grains and pulses. Zero animal fats, enzymes, or alcohol additives used.","line_segregation":"Plant exclusively processes grains, flours, and pulses with strict allergen and contamination controls.","halal_certification_ref":"HCT-IND-994821","certifying_body":"Halal Certification Trust of India"}', 'Annual Halal declaration for domestic and export dispatches.', NULL, '2026-08-27 09:43:28', '2026-08-27 09:43:28');
INSERT OR IGNORE INTO 'compliance_documents'('id', 'doc_code', 'doc_type', 'doc_number', 'title', 'department', 'process_stage', 'version', 'status', 'effective_date', 'review_date', 'prepared_by', 'approved_by', 'verified_by', 'item_id', 'item_name', 'item_group', 'lot_no', 'supplier_id', 'supplier_name', 'employee_id', 'employee_name', 'details_json', 'remarks', 'attachment_url', 'created_at', 'updated_at') VALUES (11, 'D11', 'PROCESS_FLOW', 'PFC-MFG-001', 'Grain Receiving, Milling, Sifting & Packing Process Flow Diagram', 'Engineering & QA', 'End-to-End Milling Flow', '3.0', 'APPROVED', '2026-01-01', '2027-01-01', 'Process Engineer', 'Plant Head', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{"stages":[{"stage_no":1,"name":"Raw Material Inward & QC Check (P1)","type":"Receiving","ccp_type":"OPRP-1","parameters":"Moisture, Weevils, Foreign Matter"},{"stage_no":2,"name":"Pre-Cleaning & Rotary Sieve","type":"Cleaning","ccp_type":"PRP","parameters":"Coarse chaff and dust separation"},{"stage_no":3,"name":"Gravity Destoner & Rare Earth Magnet","type":"Destoning","ccp_type":"CCP-1","parameters":"Stones removal (0% pass), Magnet ΓëÑ 10,000 Gauss"},{"stage_no":4,"name":"Hammer Milling & Micro-Pulverizing","type":"Grinding","ccp_type":"PRP","parameters":"Milling temp < 45┬░C, sieve mesh check"},{"stage_no":5,"name":"Vibratory Flour Sifter (P3)","type":"Sifting","ccp_type":"CCP-2","parameters":"60 mesh wire integrity, coarse rejection"},{"stage_no":6,"name":"Automated Bagging & Metal Detection (P4)","type":"Packing","ccp_type":"CCP-3","parameters":"Ferrous 1.5mm, Non-Fe 2.0mm, SS 2.5mm"},{"stage_no":7,"name":"Finished Goods Storage & Quarantine","type":"Storage","ccp_type":"PRP","parameters":"Wooden pallet spacing, 18 inch wall clearance"},{"stage_no":8,"name":"Vehicle Inspection & Terminal Dispatch (P2, P6, P7)","type":"Dispatch","ccp_type":"OPRP-2","parameters":"Fumigation check, COA release, truck hygiene"}]}', 'Official engineering process flow diagram with embedded CCP/OPRP control gates.', NULL, '2026-08-27 09:43:28', '2026-08-27 09:43:28');
INSERT OR IGNORE INTO 'compliance_documents'('id', 'doc_code', 'doc_type', 'doc_number', 'title', 'department', 'process_stage', 'version', 'status', 'effective_date', 'review_date', 'prepared_by', 'approved_by', 'verified_by', 'item_id', 'item_name', 'item_group', 'lot_no', 'supplier_id', 'supplier_name', 'employee_id', 'employee_name', 'details_json', 'remarks', 'attachment_url', 'created_at', 'updated_at') VALUES (1, 'D1', 'WORK_INSTRUCTION', 'WI-GRD-001', 'Urad & Pulses Cleaning, Destoning and Milling Work Instruction', 'Production', 'Milling & Destoning', '2.0', 'APPROVED', '2026-01-01', '2026-12-31', 'Quality Supervisor', 'Plant Manager', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{"objective":"Ensure uniform grain feeding, continuous stone separation, and target mesh output without foreign matter.","safety_precautions":["Safety shoes and hair net mandatory","Lock-out tag-out before hopper cleaning","Check magnetic separator every 2 hours"],"steps":[{"step_no":1,"action":"Inward Grain Inspection","control":"Moisture Γëñ 12%, Foreign matter Γëñ 1%"},{"step_no":2,"action":"Pre-Cleaner Vibratory Screen","control":"Screen mesh 3.5mm clean and undamaged"},{"step_no":3,"action":"Destoning & Gravity Separation","control":"Airflow velocity balanced, zero stone pass"},{"step_no":4,"action":"Hammer Mill Grinding","control":"Output temperature < 45┬░C, sieve 0.8mm"},{"step_no":5,"action":"Packaging & Sifting","control":"Check 1000 Gauss magnet at final spout"}]}', 'Standard factory operational work instruction for pulse milling.', NULL, '2026-08-27 09:43:28', '2026-08-27 09:43:28');
INSERT OR IGNORE INTO 'compliance_documents'('id', 'doc_code', 'doc_type', 'doc_number', 'title', 'department', 'process_stage', 'version', 'status', 'effective_date', 'review_date', 'prepared_by', 'approved_by', 'verified_by', 'item_id', 'item_name', 'item_group', 'lot_no', 'supplier_id', 'supplier_name', 'employee_id', 'employee_name', 'details_json', 'remarks', 'attachment_url', 'created_at', 'updated_at') VALUES (2, 'D2', 'HAZARD_PLAN', 'HACCP-BVC-001', 'HACCP / CCP / OPRP / VACCP Food Safety Plan', 'Quality Assurance', 'Entire Plant', '3.1', 'APPROVED', '2026-01-15', '2027-01-14', 'HACCP Lead', 'Managing Director', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{"hazards":[{"process_step":"Raw Material Receiving","hazard_type":"Chemical / Biological","hazard_desc":"Mycotoxins / Pesticide residue / Infestation","control_category":"OPRP-1","critical_limit":"Aflatoxin < 10 ppb, Moisture < 14%","monitoring_freq":"Every RM Lot","corrective_action":"Reject consignment if out of spec"},{"process_step":"Destoning & Magnet Stage","hazard_type":"Physical","hazard_desc":"Ferrous particles, stones, glass","control_category":"CCP-1","critical_limit":"Rare earth magnet ΓëÑ 10,000 Gauss; Destoner stone pass: 0%","monitoring_freq":"Every 2 Hours","corrective_action":"Halt line, segregate batch from last good check, recalibrate"},{"process_step":"Finished Flour Sifting","hazard_type":"Physical","hazard_desc":"Damaged screen wires / Foreign mesh debris","control_category":"CCP-2","critical_limit":"Sieve mesh intact (no tears, mesh size 60)","monitoring_freq":"Every Batch Start & End","corrective_action":"Quarantine and re-sift lot if mesh damaged"},{"process_step":"Packing & Sealing","hazard_type":"Physical / Allergen","hazard_desc":"Bag contamination / Cross-contact","control_category":"OPRP-2","critical_limit":"Food grade bag compliance, seal hermetic","monitoring_freq":"Every 30 Mins","corrective_action":"Repack damaged bags"}]}', 'Master FSMS HACCP & VACCP Food Safety Plan.', NULL, '2026-08-27 09:43:28', '2026-08-27 09:43:28');
INSERT OR IGNORE INTO 'compliance_documents'('id', 'doc_code', 'doc_type', 'doc_number', 'title', 'department', 'process_stage', 'version', 'status', 'effective_date', 'review_date', 'prepared_by', 'approved_by', 'verified_by', 'item_id', 'item_name', 'item_group', 'lot_no', 'supplier_id', 'supplier_name', 'employee_id', 'employee_name', 'details_json', 'remarks', 'attachment_url', 'created_at', 'updated_at') VALUES (3, 'D3', 'MTR_SPEC', 'MTR-URD-2026', 'MTR Material Technical Requirement & Signed Specification - Urad Dal', 'Quality', NULL, '1.0', 'APPROVED', '2026-02-01', '2027-01-31', 'QA Executive', 'Quality Head', NULL, NULL, 'Urad Dal', NULL, NULL, NULL, NULL, NULL, NULL, '{"item_code":"URD001","standard":"FSSAI Food Safety and Standards (Food Products Standards) Regulations","parameters":[{"parameter":"Moisture","standard_limit":"Max 12.0 %","test_method":"IS 4333 (Part 2)","category":"Physical"},{"parameter":"Foreign Matter","standard_limit":"Max 1.0 % (Inorganic < 0.1%)","test_method":"IS 4333 (Part 1)","category":"Physical"},{"parameter":"Weeviled Grains","standard_limit":"Max 1.0 %","test_method":"IS 4333 (Part 3)","category":"Physical"},{"parameter":"Damaged / Discolored","standard_limit":"Max 3.0 %","test_method":"IS 4333 (Part 1)","category":"Physical"},{"parameter":"Protein (Dry Basis)","standard_limit":"Min 22.0 %","test_method":"IS 7219","category":"Chemical"},{"parameter":"Total Ash","standard_limit":"Max 3.5 %","test_method":"IS 1155","category":"Chemical"},{"parameter":"Uric Acid","standard_limit":"Max 100 mg/kg","test_method":"IS 4333 (Part 5)","category":"Chemical"},{"parameter":"Aflatoxin (B1+B2+G1+G2)","standard_limit":"Max 10 ┬╡g/kg","test_method":"AOAC 991.31","category":"Microbiology"}],"packaging_spec":"25kg / 50kg HDPE laminated woven sacks with food-grade inner liner."}', 'Controlled MTR customer & regulatory quality specification.', NULL, '2026-08-27 09:43:28', '2026-08-27 09:43:28');
INSERT OR IGNORE INTO 'compliance_documents'('id', 'doc_code', 'doc_type', 'doc_number', 'title', 'department', 'process_stage', 'version', 'status', 'effective_date', 'review_date', 'prepared_by', 'approved_by', 'verified_by', 'item_id', 'item_name', 'item_group', 'lot_no', 'supplier_id', 'supplier_name', 'employee_id', 'employee_name', 'details_json', 'remarks', 'attachment_url', 'created_at', 'updated_at') VALUES (4, 'D4', 'TRAINING', 'TRN-2026-004', 'Good Manufacturing Practices (GMP) & Personal Hygiene Refresher', 'Human Resources & QA', NULL, '1.0', 'APPROVED', '2026-08-10', NULL, 'QA Trainer', 'Plant HR Head', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{"trainer":"Dr. R. Sundaram (FOSTAC Certified Lead)","topic":"GMP, Cross-Contamination Prevention, Allergen Protocol & Hand Hygiene","duration_hours":4,"attendees":[{"employee_name":"Murugan K","emp_id":"EMP-012","designation":"Milling Operator","evaluation_score":"92%","status":"Passed"},{"employee_name":"Suresh P","emp_id":"EMP-019","designation":"Packer","evaluation_score":"88%","status":"Passed"},{"employee_name":"Anand R","emp_id":"EMP-023","designation":"Loader","evaluation_score":"85%","status":"Passed"},{"employee_name":"Kavitha M","emp_id":"EMP-031","designation":"QC Assistant","evaluation_score":"96%","status":"Passed"}]}', 'Annual mandatory food handler GMP training record.', NULL, '2026-08-27 09:43:28', '2026-08-27 09:43:28');
INSERT OR IGNORE INTO 'compliance_documents'('id', 'doc_code', 'doc_type', 'doc_number', 'title', 'department', 'process_stage', 'version', 'status', 'effective_date', 'review_date', 'prepared_by', 'approved_by', 'verified_by', 'item_id', 'item_name', 'item_group', 'lot_no', 'supplier_id', 'supplier_name', 'employee_id', 'employee_name', 'details_json', 'remarks', 'attachment_url', 'created_at', 'updated_at') VALUES (5, 'D5', 'SOP', 'SOP-SAN-003', 'Standard Operating Procedure for Production Line Sanitation & Allergen Clean-out', 'Sanitation', 'Cleaning & Sanitation', '4.0', 'APPROVED', '2026-01-01', '2027-01-01', 'Sanitation Head', 'Technical Director', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{"scope":"All pulse milling machinery, conveyers, elevators, storage bins, and floor areas.","frequency":"Daily post-shift, between product changeovers, and deep cleaning every 15 days.","chemicals_permitted":["Food Grade Sanitizer (Chlorine 100ppm / Quat 200ppm)","Hot Water rinse (65┬░C)"],"procedure_steps":["Dry sweep and vacuum residue from elevators and milling chambers","Dismantle sifter screens and clean with nylon brushes","Wipe down external stainless steel surfaces with approved food-grade sanitizer","Inspect for pest harborage or water pooling","Record in C1 Production Area Cleaning checklist before line release"]}', 'Master controlled sanitation standard operating procedure.', NULL, '2026-08-27 09:43:28', '2026-08-27 09:43:28');
INSERT OR IGNORE INTO 'compliance_documents'('id', 'doc_code', 'doc_type', 'doc_number', 'title', 'department', 'process_stage', 'version', 'status', 'effective_date', 'review_date', 'prepared_by', 'approved_by', 'verified_by', 'item_id', 'item_name', 'item_group', 'lot_no', 'supplier_id', 'supplier_name', 'employee_id', 'employee_name', 'details_json', 'remarks', 'attachment_url', 'created_at', 'updated_at') VALUES (6, 'D6', 'RCCA', 'RCCA-2026-002', 'Root Cause Corrective & Preventive Action - Sieve Mesh Wear on Line 2', 'Quality & Maintenance', NULL, '1.0', 'APPROVED', '2026-08-05', NULL, 'Maintenance Engineer', 'QA Manager', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{"issue_source":"In-Process Quality Check (P3)","problem_desc":"Higher percentage of coarse flour grains observed during batch LOT0014 grinding.","five_why_analysis":["Why 1: Coarse flour entered bagging bin? -> Sifter screen mesh had a minor tear.","Why 2: Why did screen tear? -> Mesh wire fatigued after exceeding 450 operating hours.","Why 3: Why was it not replaced? -> Replacement schedule was not flagged in preventive maintenance log.","Why 4: Why not flagged? -> Manual hour tracking was delayed.","Why 5 (Root Cause): Lack of automated operating-hour alert for wear components."],"immediate_correction":"Halted line, replaced with certified 60-mesh screen, quarantined and re-sifted 30 bags.","corrective_action":"Updated screen inspection to daily C10 checklist and set 350-hour replacement threshold.","preventive_action":"Instituted pre-shift screen light-table inspection protocol.","target_date":"2026-08-10","completion_date":"2026-08-08","verified_by":"QA Head"}', 'Resolved and closed RCCA quality record.', NULL, '2026-08-27 09:43:28', '2026-08-27 09:43:28');
INSERT OR IGNORE INTO 'compliance_documents'('id', 'doc_code', 'doc_type', 'doc_number', 'title', 'department', 'process_stage', 'version', 'status', 'effective_date', 'review_date', 'prepared_by', 'approved_by', 'verified_by', 'item_id', 'item_name', 'item_group', 'lot_no', 'supplier_id', 'supplier_name', 'employee_id', 'employee_name', 'details_json', 'remarks', 'attachment_url', 'created_at', 'updated_at') VALUES (7, 'D7', 'MEDICAL', 'MED-2026-012', 'Annual Medical Fitness Certificate - Food Handlers Batch A', 'Occupational Health', NULL, '1.0', 'APPROVED', '2026-03-01', '2027-02-28', 'Occupational Physician', 'Plant HR', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Murugan K (and 15 staff)', '{"clinic":"City Occupational Health & Diagnostic Center, Madurai","tests_conducted":["Typhoid (Widal/Vaccination)","Tuberculosis (Chest X-Ray / Sputum)","Skin & Nail infectious disease screening","Deworming & Eye test"],"fit_for_food_handling":true,"expiry_date":"2027-02-28"}', 'All food handlers screened and certified fit under FSSAI Schedule 4.', NULL, '2026-08-27 09:43:28', '2026-08-27 09:43:28');
INSERT OR IGNORE INTO 'stock_alert_contacts'('id', 'contact_name', 'department', 'phone', 'email', 'active', 'created_at') VALUES (1, 'Purchase Manager', 'Purchase', '+91 98765 43210', 'purchase@bvcerp.com', 1, '2026-08-27 09:43:28');
INSERT OR IGNORE INTO 'stock_alert_contacts'('id', 'contact_name', 'department', 'phone', 'email', 'active', 'created_at') VALUES (2, 'Store Manager', 'Stores & Godown', '+91 98765 43211', 'stores@bvcerp.com', 1, '2026-08-27 09:43:28');
INSERT OR IGNORE INTO 'stock_alert_contacts'('id', 'contact_name', 'department', 'phone', 'email', 'active', 'created_at') VALUES (3, 'Production Head', 'Production', '+91 98765 43212', 'production@bvcerp.com', 1, '2026-08-27 09:43:28');
INSERT OR IGNORE INTO 'stock_alert_contacts'('id', 'contact_name', 'department', 'phone', 'email', 'active', 'created_at') VALUES (4, 'General Accounts', 'Accounts', '+91 98765 43213', 'accounts@bvcerp.com', 1, '2026-08-27 09:43:28');
INSERT OR IGNORE INTO 'stock_alerts'('id', 'config_id', 'item_id', 'item_name', 'godown_id', 'godown_name', 'alert_type', 'current_qty', 'minimum_qty', 'reorder_level', 'critical_level', 'status', 'triggered_at', 'resolved_at', 'resolved_reason') VALUES (1, 1, 1, 'Urad Dal', NULL, 'All Godowns', 'CRITICAL', 0, 500, 1000, 200, 'OPEN', '2026-08-27 09:44:15', NULL, NULL);
INSERT OR IGNORE INTO 'stock_alerts'('id', 'config_id', 'item_id', 'item_name', 'godown_id', 'godown_name', 'alert_type', 'current_qty', 'minimum_qty', 'reorder_level', 'critical_level', 'status', 'triggered_at', 'resolved_at', 'resolved_reason') VALUES (2, 2, 2, 'Moong Dal', NULL, 'All Godowns', 'CRITICAL', 0, 500, 1000, 200, 'OPEN', '2026-08-27 09:44:15', NULL, NULL);
INSERT OR IGNORE INTO 'stock_alerts'('id', 'config_id', 'item_id', 'item_name', 'godown_id', 'godown_name', 'alert_type', 'current_qty', 'minimum_qty', 'reorder_level', 'critical_level', 'status', 'triggered_at', 'resolved_at', 'resolved_reason') VALUES (3, 3, 3, 'Masur Dal', NULL, 'All Godowns', 'CRITICAL', 0, 500, 1000, 200, 'OPEN', '2026-08-27 09:44:15', NULL, NULL);
INSERT OR IGNORE INTO 'stock_alerts'('id', 'config_id', 'item_id', 'item_name', 'godown_id', 'godown_name', 'alert_type', 'current_qty', 'minimum_qty', 'reorder_level', 'critical_level', 'status', 'triggered_at', 'resolved_at', 'resolved_reason') VALUES (4, 4, 4, 'Toor Dal', NULL, 'All Godowns', 'CRITICAL', 0, 500, 1000, 200, 'OPEN', '2026-08-27 09:44:15', NULL, NULL);
INSERT OR IGNORE INTO 'stock_alerts'('id', 'config_id', 'item_id', 'item_name', 'godown_id', 'godown_name', 'alert_type', 'current_qty', 'minimum_qty', 'reorder_level', 'critical_level', 'status', 'triggered_at', 'resolved_at', 'resolved_reason') VALUES (5, 5, 5, 'Chana Dal', NULL, 'All Godowns', 'CRITICAL', 0, 500, 1000, 200, 'OPEN', '2026-08-27 09:44:15', NULL, NULL);
INSERT OR IGNORE INTO 'stock_alerts'('id', 'config_id', 'item_id', 'item_name', 'godown_id', 'godown_name', 'alert_type', 'current_qty', 'minimum_qty', 'reorder_level', 'critical_level', 'status', 'triggered_at', 'resolved_at', 'resolved_reason') VALUES (6, 6, 6, 'Papad Masala', NULL, 'All Godowns', 'CRITICAL', 0, 200, 500, 50, 'OPEN', '2026-08-27 09:44:15', NULL, NULL);
INSERT OR IGNORE INTO 'stock_alerts'('id', 'config_id', 'item_id', 'item_name', 'godown_id', 'godown_name', 'alert_type', 'current_qty', 'minimum_qty', 'reorder_level', 'critical_level', 'status', 'triggered_at', 'resolved_at', 'resolved_reason') VALUES (7, 7, 7, 'Red Chilli Powder', NULL, 'All Godowns', 'CRITICAL', 0, 500, 1000, 200, 'OPEN', '2026-08-27 09:44:15', NULL, NULL);
INSERT OR IGNORE INTO 'stock_alerts'('id', 'config_id', 'item_id', 'item_name', 'godown_id', 'godown_name', 'alert_type', 'current_qty', 'minimum_qty', 'reorder_level', 'critical_level', 'status', 'triggered_at', 'resolved_at', 'resolved_reason') VALUES (8, 8, 8, 'Black Pepper Powder', NULL, 'All Godowns', 'CRITICAL', 0, 500, 1000, 200, 'OPEN', '2026-08-27 09:44:15', NULL, NULL);
INSERT OR IGNORE INTO 'stock_alerts'('id', 'config_id', 'item_id', 'item_name', 'godown_id', 'godown_name', 'alert_type', 'current_qty', 'minimum_qty', 'reorder_level', 'critical_level', 'status', 'triggered_at', 'resolved_at', 'resolved_reason') VALUES (9, 9, 9, 'Hing (Asafoetida)', NULL, 'All Godowns', 'CRITICAL', 0, 500, 1000, 200, 'OPEN', '2026-08-27 09:44:15', NULL, NULL);
INSERT OR IGNORE INTO 'stock_alerts'('id', 'config_id', 'item_id', 'item_name', 'godown_id', 'godown_name', 'alert_type', 'current_qty', 'minimum_qty', 'reorder_level', 'critical_level', 'status', 'triggered_at', 'resolved_at', 'resolved_reason') VALUES (10, 10, 10, 'Jeera Powder', NULL, 'All Godowns', 'CRITICAL', 0, 500, 1000, 200, 'OPEN', '2026-08-27 09:44:15', NULL, NULL);
INSERT OR IGNORE INTO 'area_master'('id', 'name', 'print_name', 'status') VALUES (1, 'Station Road', 'STATION ROAD', 'Active');
INSERT OR IGNORE INTO 'area_master'('id', 'name', 'print_name', 'status') VALUES (2, 'Ring Road', 'RING ROAD', 'Active');
INSERT OR IGNORE INTO 'area_master'('id', 'name', 'print_name', 'status') VALUES (3, 'MG Road', 'MG ROAD', 'Active');
INSERT OR IGNORE INTO 'city_master'('id', 'name', 'print_name', 'status') VALUES (1, 'Mumbai', 'MUMBAI', 'Active');
INSERT OR IGNORE INTO 'city_master'('id', 'name', 'print_name', 'status') VALUES (2, 'Delhi', 'DELHI', 'Active');
INSERT OR IGNORE INTO 'city_master'('id', 'name', 'print_name', 'status') VALUES (3, 'Surat', 'SURAT', 'Active');
INSERT OR IGNORE INTO 'city_master'('id', 'name', 'print_name', 'status') VALUES (4, 'Ahmedabad', 'AHMEDABAD', 'Active');
INSERT OR IGNORE INTO 'customer_master'('id', 'name', 'print_name', 'contact_person', 'address1', 'address2', 'address3', 'address4', 'gst_number', 'phone_off', 'phone_res', 'mobile1', 'mobile2', 'area', 'opening_balance', 'status', 'email', 'transport', 'limit_days', 'limit_amount', 'balance_type', 'state', 'state_code', 'tax_reg_type') VALUES (1, 'Customer A', 'CUSTOMER A', 'Alice', '789 Customer St', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Station Road', 0, 'Active', NULL, NULL, NULL, NULL, 'Dr', 'Tamil Nadu', '33', 'Regular');
INSERT OR IGNORE INTO 'customer_master'('id', 'name', 'print_name', 'contact_person', 'address1', 'address2', 'address3', 'address4', 'gst_number', 'phone_off', 'phone_res', 'mobile1', 'mobile2', 'area', 'opening_balance', 'status', 'email', 'transport', 'limit_days', 'limit_amount', 'balance_type', 'state', 'state_code', 'tax_reg_type') VALUES (2, 'Customer B', 'CUSTOMER B', 'Bob', '321 Buyer Ave', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Ring Road', 0, 'Active', NULL, NULL, NULL, NULL, 'Dr', 'Tamil Nadu', '33', 'Regular');
INSERT OR IGNORE INTO 'customer_master'('id', 'name', 'print_name', 'contact_person', 'address1', 'address2', 'address3', 'address4', 'gst_number', 'phone_off', 'phone_res', 'mobile1', 'mobile2', 'area', 'opening_balance', 'status', 'email', 'transport', 'limit_days', 'limit_amount', 'balance_type', 'state', 'state_code', 'tax_reg_type') VALUES (3, 'Customer C', 'CUSTOMER C', 'Charlie', '654 Shop Lane', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'MG Road', 0, 'Active', NULL, NULL, NULL, NULL, 'Dr', 'Tamil Nadu', '33', 'Regular');
INSERT OR IGNORE INTO 'deduction_purchase'('id', 'ded_code', 'ded_name', 'print_name', 'debit_adjust', 'account_head', 'credit_adjust', 'ded_type', 'calc_type', 'status', 'affect_cost_of_goods', 'type', 'debit_side_adjust', 'deduction_type', 'calculation_type', 'deduction_value') VALUES (1, 'TDS', 'TDS on Purchase', 'TDS ON PURCHASE', NULL, NULL, NULL, 'Percentage', 'Percentage', 'Active', 'No', 'Add', 'None', 'Add', 'Percentage', 0);
INSERT OR IGNORE INTO 'deduction_purchase'('id', 'ded_code', 'ded_name', 'print_name', 'debit_adjust', 'account_head', 'credit_adjust', 'ded_type', 'calc_type', 'status', 'affect_cost_of_goods', 'type', 'debit_side_adjust', 'deduction_type', 'calculation_type', 'deduction_value') VALUES (2, 'ROFF', 'Round Off', 'ROUND OFF', NULL, NULL, NULL, 'Fixed', 'Fixed', 'Active', 'No', 'Add', 'None', 'Add', 'Percentage', 0);
INSERT OR IGNORE INTO 'deduction_sales'('id', 'ded_code', 'ded_name', 'print_name', 'adjust_with_sales', 'account_head', 'ded_type', 'calc_type', 'ded_value', 'status') VALUES (1, 'TCS', 'TCS on Sales', 'TCS ON SALES', NULL, NULL, 'Percentage', 'Percentage', 0.1, 'Active');
INSERT OR IGNORE INTO 'deduction_sales'('id', 'ded_code', 'ded_name', 'print_name', 'adjust_with_sales', 'account_head', 'ded_type', 'calc_type', 'ded_value', 'status') VALUES (2, 'ROFF', 'Round Off', 'ROUND OFF', NULL, NULL, 'Fixed', 'Fixed', 0, 'Active');
INSERT OR IGNORE INTO 'flour_mill_master'('id', 'flourmill', 'print_name', 'contact_person', 'address1', 'address2', 'address3', 'address4', 'gst_number', 'phone_off', 'phone_res', 'mobile1', 'mobile2', 'area', 'wages_kg', 'opening_balance', 'status', 'tin_no', 'opening_balance_type') VALUES (1, 'Premium Flour Mill', 'PREMIUM FLOUR MILL', 'Mr. Kumar', '50 Mill Road', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 'Active', NULL, 'Cr');
INSERT OR IGNORE INTO 'flour_mill_master'('id', 'flourmill', 'print_name', 'contact_person', 'address1', 'address2', 'address3', 'address4', 'gst_number', 'phone_off', 'phone_res', 'mobile1', 'mobile2', 'area', 'wages_kg', 'opening_balance', 'status', 'tin_no', 'opening_balance_type') VALUES (2, 'Shakti Atta', 'SHAKTI ATTA', 'Mr. Singh', '100 Industry Ave', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 'Active', NULL, 'Cr');
INSERT OR IGNORE INTO 'godown_master'('id', 'godown_name', 'print_name', 'location', 'contact_person', 'address', 'phone_off', 'area', 'status', 'mobile1', 'email', 'website', 'gst_number', 'name') VALUES (1, 'Main Godown', 'MAIN GODOWN', NULL, NULL, NULL, NULL, 'Main Factory', 'Active', NULL, NULL, NULL, NULL, NULL);
INSERT OR IGNORE INTO 'godown_master'('id', 'godown_name', 'print_name', 'location', 'contact_person', 'address', 'phone_off', 'area', 'status', 'mobile1', 'email', 'website', 'gst_number', 'name') VALUES (2, 'Godown 1', 'GODOWN 1', NULL, NULL, NULL, NULL, 'Unit 1', 'Active', NULL, NULL, NULL, NULL, NULL);
INSERT OR IGNORE INTO 'godown_master'('id', 'godown_name', 'print_name', 'location', 'contact_person', 'address', 'phone_off', 'area', 'status', 'mobile1', 'email', 'website', 'gst_number', 'name') VALUES (3, 'Raw Material Godown', 'RM GODOWN', NULL, NULL, NULL, NULL, 'Storage', 'Active', NULL, NULL, NULL, NULL, NULL);
INSERT OR IGNORE INTO 'godown_master'('id', 'godown_name', 'print_name', 'location', 'contact_person', 'address', 'phone_off', 'area', 'status', 'mobile1', 'email', 'website', 'gst_number', 'name') VALUES (4, 'Finished Goods Godown', 'FG GODOWN', NULL, NULL, NULL, NULL, 'Warehouse', 'Active', NULL, NULL, NULL, NULL, NULL);
INSERT OR IGNORE INTO 'item_groups'('id', 'group_code', 'group_name', 'print_name', 'tax', 'status') VALUES (1, 'PLS', 'Pulses', 'PULSES', 5, 'Active');
INSERT OR IGNORE INTO 'item_groups'('id', 'group_code', 'group_name', 'print_name', 'tax', 'status') VALUES (2, 'GRM', 'Grains', 'GRAINS', 0, 'Active');
INSERT OR IGNORE INTO 'item_groups'('id', 'group_code', 'group_name', 'print_name', 'tax', 'status') VALUES (3, 'SPT', 'Spices', 'SPICES', 5, 'Active');
INSERT OR IGNORE INTO 'item_groups'('id', 'group_code', 'group_name', 'print_name', 'tax', 'status') VALUES (4, 'MSL', 'Masala', 'MASALA', 5, 'Active');
INSERT OR IGNORE INTO 'item_master'('id', 'item_code', 'item_name', 'print_name', 'item_group', 'type', 'tax', 'hsn_code', 'ed_percent', 'status', 'lab_parameters', 'minimum_qty', 'reorder_level', 'critical_level', 'alert_enabled', 'weight', 'unit', 'tax_master_id', 'tax_type', 'gst_rate') VALUES (1, 'URD001', 'Urad Dal', 'URAD DAL', 'Pulses', NULL, 5, '071390', 0, 'Active', NULL, 0, 0, 0, 1, 1, 'kg', NULL, 'Taxable', 5);
INSERT OR IGNORE INTO 'item_master'('id', 'item_code', 'item_name', 'print_name', 'item_group', 'type', 'tax', 'hsn_code', 'ed_percent', 'status', 'lab_parameters', 'minimum_qty', 'reorder_level', 'critical_level', 'alert_enabled', 'weight', 'unit', 'tax_master_id', 'tax_type', 'gst_rate') VALUES (2, 'MOO001', 'Moong Dal', 'MOONG DAL', 'Pulses', NULL, 5, '071390', 0, 'Active', NULL, 0, 0, 0, 1, 1, 'kg', NULL, 'Taxable', 5);
INSERT OR IGNORE INTO 'item_master'('id', 'item_code', 'item_name', 'print_name', 'item_group', 'type', 'tax', 'hsn_code', 'ed_percent', 'status', 'lab_parameters', 'minimum_qty', 'reorder_level', 'critical_level', 'alert_enabled', 'weight', 'unit', 'tax_master_id', 'tax_type', 'gst_rate') VALUES (3, 'MAS001', 'Masur Dal', 'MASUR DAL', 'Pulses', NULL, 5, '071390', 0, 'Active', NULL, 0, 0, 0, 1, 1, 'kg', NULL, 'Taxable', 5);
INSERT OR IGNORE INTO 'item_master'('id', 'item_code', 'item_name', 'print_name', 'item_group', 'type', 'tax', 'hsn_code', 'ed_percent', 'status', 'lab_parameters', 'minimum_qty', 'reorder_level', 'critical_level', 'alert_enabled', 'weight', 'unit', 'tax_master_id', 'tax_type', 'gst_rate') VALUES (4, 'TOO001', 'Toor Dal', 'TOOR DAL', 'Pulses', NULL, 5, '071390', 0, 'Active', NULL, 0, 0, 0, 1, 1, 'kg', NULL, 'Taxable', 5);
INSERT OR IGNORE INTO 'item_master'('id', 'item_code', 'item_name', 'print_name', 'item_group', 'type', 'tax', 'hsn_code', 'ed_percent', 'status', 'lab_parameters', 'minimum_qty', 'reorder_level', 'critical_level', 'alert_enabled', 'weight', 'unit', 'tax_master_id', 'tax_type', 'gst_rate') VALUES (5, 'CHB001', 'Chana Dal', 'CHANA DAL', 'Pulses', NULL, 5, '071390', 0, 'Active', NULL, 0, 0, 0, 1, 1, 'kg', NULL, 'Taxable', 5);
INSERT OR IGNORE INTO 'item_master'('id', 'item_code', 'item_name', 'print_name', 'item_group', 'type', 'tax', 'hsn_code', 'ed_percent', 'status', 'lab_parameters', 'minimum_qty', 'reorder_level', 'critical_level', 'alert_enabled', 'weight', 'unit', 'tax_master_id', 'tax_type', 'gst_rate') VALUES (6, 'MSL001', 'Papad Masala', 'PAPAD MASALA', 'Masala', 'Masala', 5, '210390', 0, 'Active', NULL, 0, 0, 0, 1, 1, 'kg', NULL, 'Taxable', 5);
INSERT OR IGNORE INTO 'item_master'('id', 'item_code', 'item_name', 'print_name', 'item_group', 'type', 'tax', 'hsn_code', 'ed_percent', 'status', 'lab_parameters', 'minimum_qty', 'reorder_level', 'critical_level', 'alert_enabled', 'weight', 'unit', 'tax_master_id', 'tax_type', 'gst_rate') VALUES (7, 'MSL002', 'Red Chilli Powder', 'RED CHILLI POWDER', 'Masala', 'Masala', 5, '090422', 0, 'Active', NULL, 0, 0, 0, 1, 1, 'kg', NULL, 'Taxable', 5);
INSERT OR IGNORE INTO 'item_master'('id', 'item_code', 'item_name', 'print_name', 'item_group', 'type', 'tax', 'hsn_code', 'ed_percent', 'status', 'lab_parameters', 'minimum_qty', 'reorder_level', 'critical_level', 'alert_enabled', 'weight', 'unit', 'tax_master_id', 'tax_type', 'gst_rate') VALUES (8, 'MSL003', 'Black Pepper Powder', 'BLACK PEPPER POWDER', 'Masala', 'Masala', 5, '090412', 0, 'Active', NULL, 0, 0, 0, 1, 1, 'kg', NULL, 'Taxable', 5);
INSERT OR IGNORE INTO 'item_master'('id', 'item_code', 'item_name', 'print_name', 'item_group', 'type', 'tax', 'hsn_code', 'ed_percent', 'status', 'lab_parameters', 'minimum_qty', 'reorder_level', 'critical_level', 'alert_enabled', 'weight', 'unit', 'tax_master_id', 'tax_type', 'gst_rate') VALUES (9, 'MSL004', 'Hing (Asafoetida)', 'HING (ASAFOETIDA)', 'Masala', 'Masala', 5, '130190', 0, 'Active', NULL, 0, 0, 0, 1, 1, 'kg', NULL, 'Taxable', 5);
INSERT OR IGNORE INTO 'item_master'('id', 'item_code', 'item_name', 'print_name', 'item_group', 'type', 'tax', 'hsn_code', 'ed_percent', 'status', 'lab_parameters', 'minimum_qty', 'reorder_level', 'critical_level', 'alert_enabled', 'weight', 'unit', 'tax_master_id', 'tax_type', 'gst_rate') VALUES (10, 'MSL005', 'Jeera Powder', 'JEERA POWDER', 'Masala', 'Masala', 5, '090932', 0, 'Active', NULL, 0, 0, 0, 1, 1, 'kg', NULL, 'Taxable', 5);
INSERT OR IGNORE INTO 'ledgermaster'('id', 'name', 'printname', 'under', 'openingbalance', 'area', 'credit', 'debit', 'status', 'alias_name', 'opening_type', 'ledger_type') VALUES (1, 'Cash in Hand', 'CASH IN HAND', 'Cash-in-hand', 0, NULL, 0, 0, 'Active', NULL, 'Dr', 'Asset');
INSERT OR IGNORE INTO 'ledgermaster'('id', 'name', 'printname', 'under', 'openingbalance', 'area', 'credit', 'debit', 'status', 'alias_name', 'opening_type', 'ledger_type') VALUES (2, 'Bank Account', 'BANK ACCOUNT', 'Bank Accounts', 0, NULL, 0, 0, 'Active', NULL, 'Dr', 'Asset');
INSERT OR IGNORE INTO 'ledgermaster'('id', 'name', 'printname', 'under', 'openingbalance', 'area', 'credit', 'debit', 'status', 'alias_name', 'opening_type', 'ledger_type') VALUES (3, 'Purchase Account', 'PURCHASE ACCOUNT', 'Purchase', 0, NULL, 0, 0, 'Active', NULL, 'Dr', 'Purchase');
INSERT OR IGNORE INTO 'ledgermaster'('id', 'name', 'printname', 'under', 'openingbalance', 'area', 'credit', 'debit', 'status', 'alias_name', 'opening_type', 'ledger_type') VALUES (4, 'Sales Account', 'SALES ACCOUNT', 'Sales', 0, NULL, 0, 0, 'Active', NULL, 'Dr', 'Sales');
INSERT OR IGNORE INTO 'ledgermaster'('id', 'name', 'printname', 'under', 'openingbalance', 'area', 'credit', 'debit', 'status', 'alias_name', 'opening_type', 'ledger_type') VALUES (5, 'CGST Output', 'CGST OUTPUT', 'Duties & Taxes', 0, NULL, 0, 0, 'Active', NULL, 'Dr', 'Liability');
INSERT OR IGNORE INTO 'ledgermaster'('id', 'name', 'printname', 'under', 'openingbalance', 'area', 'credit', 'debit', 'status', 'alias_name', 'opening_type', 'ledger_type') VALUES (6, 'SGST Output', 'SGST OUTPUT', 'Duties & Taxes', 0, NULL, 0, 0, 'Active', NULL, 'Dr', 'Liability');
INSERT OR IGNORE INTO 'ledgermaster'('id', 'name', 'printname', 'under', 'openingbalance', 'area', 'credit', 'debit', 'status', 'alias_name', 'opening_type', 'ledger_type') VALUES (7, 'IGST Output', 'IGST OUTPUT', 'Duties & Taxes', 0, NULL, 0, 0, 'Active', NULL, 'Dr', 'Liability');
INSERT OR IGNORE INTO 'ledgermaster'('id', 'name', 'printname', 'under', 'openingbalance', 'area', 'credit', 'debit', 'status', 'alias_name', 'opening_type', 'ledger_type') VALUES (8, 'CGST Input', 'CGST INPUT', 'Duties & Taxes', 0, NULL, 0, 0, 'Active', NULL, 'Dr', 'Asset');
INSERT OR IGNORE INTO 'ledgermaster'('id', 'name', 'printname', 'under', 'openingbalance', 'area', 'credit', 'debit', 'status', 'alias_name', 'opening_type', 'ledger_type') VALUES (9, 'SGST Input', 'SGST INPUT', 'Duties & Taxes', 0, NULL, 0, 0, 'Active', NULL, 'Dr', 'Asset');
INSERT OR IGNORE INTO 'ledgermaster'('id', 'name', 'printname', 'under', 'openingbalance', 'area', 'credit', 'debit', 'status', 'alias_name', 'opening_type', 'ledger_type') VALUES (10, 'IGST Input', 'IGST INPUT', 'Duties & Taxes', 0, NULL, 0, 0, 'Active', NULL, 'Dr', 'Asset');
INSERT OR IGNORE INTO 'ledgermaster'('id', 'name', 'printname', 'under', 'openingbalance', 'area', 'credit', 'debit', 'status', 'alias_name', 'opening_type', 'ledger_type') VALUES (11, 'Freight & Transport Charges', 'FREIGHT CHARGES', 'Direct Expenses', 0, NULL, 0, 0, 'Active', NULL, 'Dr', 'Expense');
INSERT OR IGNORE INTO 'ledgermaster'('id', 'name', 'printname', 'under', 'openingbalance', 'area', 'credit', 'debit', 'status', 'alias_name', 'opening_type', 'ledger_type') VALUES (12, 'Wages & Milling Charges', 'WAGES CHARGES', 'Direct Expenses', 0, NULL, 0, 0, 'Active', NULL, 'Dr', 'Expense');
INSERT OR IGNORE INTO 'ledgermaster'('id', 'name', 'printname', 'under', 'openingbalance', 'area', 'credit', 'debit', 'status', 'alias_name', 'opening_type', 'ledger_type') VALUES (13, 'Discount on Purchase', 'DISCOUNT ON PURCHASE', 'Direct Income', 0, NULL, 0, 0, 'Active', NULL, 'Dr', 'Income');
INSERT OR IGNORE INTO 'ledgermaster'('id', 'name', 'printname', 'under', 'openingbalance', 'area', 'credit', 'debit', 'status', 'alias_name', 'opening_type', 'ledger_type') VALUES (14, 'Discount on Sales', 'DISCOUNT ON SALES', 'Direct Expenses', 0, NULL, 0, 0, 'Active', NULL, 'Dr', 'Expense');
INSERT OR IGNORE INTO 'ledgermaster'('id', 'name', 'printname', 'under', 'openingbalance', 'area', 'credit', 'debit', 'status', 'alias_name', 'opening_type', 'ledger_type') VALUES (15, 'Round Off Account', 'ROUND OFF', 'Indirect Expenses', 0, NULL, 0, 0, 'Active', NULL, 'Dr', 'Expense');
INSERT OR IGNORE INTO 'ledgermaster'('id', 'name', 'printname', 'under', 'openingbalance', 'area', 'credit', 'debit', 'status', 'alias_name', 'opening_type', 'ledger_type') VALUES (16, 'Input CGST', 'Input CGST', 'Duties & Taxes', 0, NULL, 0, 0, 'Active', NULL, 'Dr', 'Tax');
INSERT OR IGNORE INTO 'ledgermaster'('id', 'name', 'printname', 'under', 'openingbalance', 'area', 'credit', 'debit', 'status', 'alias_name', 'opening_type', 'ledger_type') VALUES (17, 'Input SGST', 'Input SGST', 'Duties & Taxes', 0, NULL, 0, 0, 'Active', NULL, 'Dr', 'Tax');
INSERT OR IGNORE INTO 'ledgermaster'('id', 'name', 'printname', 'under', 'openingbalance', 'area', 'credit', 'debit', 'status', 'alias_name', 'opening_type', 'ledger_type') VALUES (18, 'Input IGST', 'Input IGST', 'Duties & Taxes', 0, NULL, 0, 0, 'Active', NULL, 'Dr', 'Tax');
INSERT OR IGNORE INTO 'ledgermaster'('id', 'name', 'printname', 'under', 'openingbalance', 'area', 'credit', 'debit', 'status', 'alias_name', 'opening_type', 'ledger_type') VALUES (19, 'Output CGST', 'Output CGST', 'Duties & Taxes', 0, NULL, 0, 0, 'Active', NULL, 'Dr', 'Tax');
INSERT OR IGNORE INTO 'ledgermaster'('id', 'name', 'printname', 'under', 'openingbalance', 'area', 'credit', 'debit', 'status', 'alias_name', 'opening_type', 'ledger_type') VALUES (20, 'Output SGST', 'Output SGST', 'Duties & Taxes', 0, NULL, 0, 0, 'Active', NULL, 'Dr', 'Tax');
INSERT OR IGNORE INTO 'ledgermaster'('id', 'name', 'printname', 'under', 'openingbalance', 'area', 'credit', 'debit', 'status', 'alias_name', 'opening_type', 'ledger_type') VALUES (21, 'Output IGST', 'Output IGST', 'Duties & Taxes', 0, NULL, 0, 0, 'Active', NULL, 'Dr', 'Tax');
INSERT OR IGNORE INTO 'ledgermaster'('id', 'name', 'printname', 'under', 'openingbalance', 'area', 'credit', 'debit', 'status', 'alias_name', 'opening_type', 'ledger_type') VALUES (22, 'Cash', 'Cash', 'Cash', 0, NULL, 0, 0, 'Active', NULL, 'Dr', 'Cash');
INSERT OR IGNORE INTO 'ledgermaster'('id', 'name', 'printname', 'under', 'openingbalance', 'area', 'credit', 'debit', 'status', 'alias_name', 'opening_type', 'ledger_type') VALUES (23, 'Petty Cash', 'Petty Cash', 'Cash', 0, NULL, 0, 0, 'Active', NULL, 'Dr', 'Cash');
INSERT OR IGNORE INTO 'ledgermaster'('id', 'name', 'printname', 'under', 'openingbalance', 'area', 'credit', 'debit', 'status', 'alias_name', 'opening_type', 'ledger_type') VALUES (24, 'Indian Bank', 'Indian Bank', 'Bank Accounts', 0, NULL, 0, 0, 'Active', NULL, 'Dr', 'Bank');
INSERT OR IGNORE INTO 'ledgermaster'('id', 'name', 'printname', 'under', 'openingbalance', 'area', 'credit', 'debit', 'status', 'alias_name', 'opening_type', 'ledger_type') VALUES (25, 'Input Tax', 'Input Tax', 'Duties & Taxes', 0, NULL, 0, 0, 'Active', NULL, 'Dr', 'Tax');
INSERT OR IGNORE INTO 'ledgermaster'('id', 'name', 'printname', 'under', 'openingbalance', 'area', 'credit', 'debit', 'status', 'alias_name', 'opening_type', 'ledger_type') VALUES (26, 'Output Tax', 'Output Tax', 'Duties & Taxes', 0, NULL, 0, 0, 'Active', NULL, 'Dr', 'Tax');
INSERT OR IGNORE INTO 'papad_company_master'('id', 'name', 'print_name', 'contact_person', 'address', 'address1', 'address2', 'address3', 'address4', 'gst_no', 'phone_off', 'phone_res', 'mobile1', 'mobile2', 'area', 'wages_kg', 'opening_balance', 'opening_advance', 'status', 'email', 'mobile') VALUES (1, 'Shree Papad', 'SHREE PAPAD', 'Mr. Patel', NULL, '100 Industrial Area', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 0, 'Active', NULL, NULL);
INSERT OR IGNORE INTO 'papad_company_master'('id', 'name', 'print_name', 'contact_person', 'address', 'address1', 'address2', 'address3', 'address4', 'gst_no', 'phone_off', 'phone_res', 'mobile1', 'mobile2', 'area', 'wages_kg', 'opening_balance', 'opening_advance', 'status', 'email', 'mobile') VALUES (2, 'Amul Papad', 'AMUL PAPAD', 'Mr. Shah', NULL, '200 Food Park', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 0, 'Active', NULL, NULL);
INSERT OR IGNORE INTO 'papad_company_master'('id', 'name', 'print_name', 'contact_person', 'address', 'address1', 'address2', 'address3', 'address4', 'gst_no', 'phone_off', 'phone_res', 'mobile1', 'mobile2', 'area', 'wages_kg', 'opening_balance', 'opening_advance', 'status', 'email', 'mobile') VALUES (3, 'Bikaneri Papad', 'BIKANERI PAPAD', 'Mr. Gupta', NULL, '300 Market Road', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 0, 'Active', NULL, NULL);
INSERT OR IGNORE INTO 'ptrans_master'('id', 'name', 'print_name', 'status') VALUES (1, 'Rail', 'RAIL', 'Active');
INSERT OR IGNORE INTO 'ptrans_master'('id', 'name', 'print_name', 'status') VALUES (2, 'Road', 'ROAD', 'Active');
INSERT OR IGNORE INTO 'ptrans_master'('id', 'name', 'print_name', 'status') VALUES (3, 'Air', 'AIR', 'Active');
DELETE FROM sqlite_sequence;
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (1, 'tax_master', 14);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (2, 'stock_alert_contacts', 4);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (3, 'compliance_documents', 11);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (4, 'compliance_production_records', 3);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (5, 'ledgermaster', 86);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (6, 'city_master', 40);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (7, 'area_master', 30);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (8, 'item_groups', 40);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (9, 'item_master', 55);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (10, 'supplier_master', 30);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (11, 'customer_master', 30);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (12, 'papad_company_master', 30);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (13, 'flour_mill_master', 20);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (14, 'transport_master', 30);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (15, 'ptrans_master', 30);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (16, 'weightmaster', 50);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (17, 'deduction_sales', 20);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (18, 'deduction_purchase', 20);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (19, 'godown_master', 4);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (20, 'stock_alert_config', 10);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (21, 'stock_alerts', 10);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (22, 'stock_alert_notifications', 120);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (23, 'financial_years', 1);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (24, 'purchase_orders', 1);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (25, 'purchase_order_items', 2);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (26, 'purchase_order_deductions', 2);
CREATE TABLE lost_and_found(rootpgno INTEGER, pgno INTEGER, nfield INTEGER, id INTEGER, c0, c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13, c14, c15, c16, c17, c18, c19, c20, c21, c22, c23, c24);
INSERT INTO lost_and_found VALUES(28, 28, 25, 1, NULL, 'P1', 'INCOMING_QUALITY', 'P1-2026-001', '2026-08-16', 'RM Receiving', NULL, 'Urad Gotta', 'LOT0003', NULL, NULL, NULL, NULL, NULL, 'Sri Amman Traders', NULL, NULL, 'COMPLETED', 'Kavitha M', NULL, NULL, '{"moisture":"10.8%","foreign_matter":"0.4%","broken_grain":"1.2%","weevils":"0%","decision":"PASSED"}', NULL, 'Sample conforms to MTR-URD-2026 specification.', '2026-08-27 09:43:28');
INSERT INTO lost_and_found VALUES(28, 28, 25, 2, NULL, 'P2', 'FUMIGATION', 'P2-2026-001', '2026-08-01', 'Loading', NULL, 'Raw Broken Rice & Urad Stacks', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'KNJ Godown (Godown 2)', 'COMPLETED', 'Certified Pest Control Agency', NULL, NULL, '{"no":"P2-2026-001","godown":"KNJ Godown (Godown 2)","item":"Raw Broken Rice & Urad Stacks","date":"2026-08-01","chem":"Aluminium Phosphide (AlP 56%)","dose":"3 Tablets / Ton (9g/MT)","exp":"7 Days airtight tarp","aer":"24 Hours forced aeration","residue":"0.01 ppm (Limit <0.1 ppm)","cert":"PASS / FREE FROM INFESTATION"}', NULL, 'Fumigation treatment completed with Aluminium Phosphide (AlP 56%). Safety clearance signed.', '2026-08-27 09:44:14');
INSERT INTO lost_and_found VALUES(28, 28, 25, 3, NULL, 'P2', 'FUMIGATION', 'P2-2026-002', '2026-07-20', 'Loading', NULL, 'Pulse Whole Grain Stacks', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'KTH Godown (Godown 1)', 'COMPLETED', 'Certified Pest Control Agency', NULL, NULL, '{"no":"P2-2026-002","godown":"KTH Godown (Godown 1)","item":"Pulse Whole Grain Stacks","date":"2026-07-20","chem":"Aluminium Phosphide","dose":"3 Tablets / Ton","exp":"7 Days","aer":"24 Hours","residue":"0.00 ppm","cert":"PASS / CLEARED"}', NULL, 'Fumigation treatment completed with Aluminium Phosphide. Safety clearance signed.', '2026-08-27 09:44:14');
CREATE INDEX idx_voucher_reference_no ON voucher(reference_no);
CREATE INDEX idx_voucher_entry_voucher_id ON voucher_entry(voucher_id);
CREATE INDEX idx_ledger_entries_voucher ON ledger_entries(voucher_type, voucher_no);
CREATE INDEX idx_stock_alert_cfg ON stock_alert_config(item_name, godown_name);
CREATE INDEX idx_stock_alerts_status ON stock_alerts(status, alert_type);
CREATE INDEX idx_stock_lots_lot ON stock_lots(lot_no);
CREATE INDEX idx_stock_lots_item ON stock_lots(item_name);
CREATE INDEX idx_stock_lots_purchase ON stock_lots(purchase_id);
PRAGMA writable_schema = off;
COMMIT;
