export const MASTER_CONFIG = {
  ledger: {
    table: 'ledgermaster',
    sections: [
      {
        title: 'Basic Information',
        fields: [
          { name: 'name', label: 'Ledger Name', type: 'text', required: true },
          { name: 'printname', label: 'Print Name', type: 'text' },
          { name: 'alias_name', label: 'Alias Name', type: 'text' },
          { name: 'under', label: 'Group Under', type: 'masterSelect', masterType: 'ledger_groups' },
        ]
      },
      {
        title: 'Opening Balance',
        fields: [
          { name: 'openingbalance', label: 'Opening Balance', type: 'number' },
          { name: 'opening_type', label: 'Opening Type', type: 'select', options: [{ label: 'Dr', value: 'Dr' }, { label: 'Cr', value: 'Cr' }], defaultValue: 'Dr' },
        ]
      },
      {
        title: 'Ledger Type',
        fields: [
          { name: 'ledger_type', label: 'Ledger Type', type: 'select', options: [{ label: 'Customer', value: 'Customer' }, { label: 'Supplier', value: 'Supplier' }, { label: 'Cash', value: 'Cash' }, { label: 'Bank', value: 'Bank' }, { label: 'Purchase', value: 'Purchase' }, { label: 'Sales', value: 'Sales' }, { label: 'Tax', value: 'Tax' }, { label: 'Expense', value: 'Expense' }, { label: 'Income', value: 'Income' }, { label: 'General', value: 'General' }], defaultValue: 'General' },
        ]
      },
      {
        title: 'Status',
        fields: [
          { name: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }], defaultValue: 'Active' }
        ]
      }
    ]
  },
  ledger_group: {
    table: 'ledgergroupmaster',
    sections: [
      {
        title: 'Basic Information',
        fields: [
          { name: 'name', label: 'Group Name', type: 'text', required: true },
          { name: 'printname', label: 'Print Name', type: 'text' },
        ]
      },
      {
        title: 'Status',
        fields: [
          { name: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }], defaultValue: 'Active' }
        ]
      }
    ]
  },
  area: {
    table: 'area_master',
    sections: [
      {
        title: 'Basic Information',
        fields: [
          { name: 'name', label: 'Area Name', type: 'text', required: true },
          { name: 'print_name', label: 'Print Name', type: 'text' },
        ]
      },
      {
        title: 'Status',
        fields: [
          { name: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }], defaultValue: 'Active' }
        ]
      }
    ]
  },
  city: {
    table: 'city_master',
    sections: [
      {
        title: 'Basic Information',
        fields: [
          { name: 'name', label: 'City Name', type: 'text', required: true },
          { name: 'print_name', label: 'Print Name', type: 'text' },
        ]
      },
      {
        title: 'Status',
        fields: [
          { name: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }], defaultValue: 'Active' }
        ]
      }
    ]
  },
  transport: {
    table: 'transport_master',
    sections: [
      {
        title: 'Basic Information',
        fields: [
          { name: 'name', label: 'Transport Name', type: 'text', required: true },
          { name: 'print_name', label: 'Print Name', type: 'text' },
        ]
      },
      {
        title: 'Status',
        fields: [
          { name: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }], defaultValue: 'Active' }
        ]
      }
    ]
  },
  p_trans: {
    table: 'ptrans_master',
    sections: [
      {
        title: 'Basic Information',
        fields: [
          { name: 'name', label: 'P.Trans Name', type: 'text', required: true },
          { name: 'print_name', label: 'Print Name', type: 'text' },
        ]
      },
      {
        title: 'Status',
        fields: [
          { name: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }], defaultValue: 'Active' }
        ]
      }
    ]
  },
  sender: {
    table: 'sender_group_master',
    sections: [
      {
        title: 'Basic Information',
        fields: [
          { name: 'name', label: 'Sender Name', type: 'text', required: true },
          { name: 'print_name', label: 'Print Name', type: 'text' },
        ]
      },
      {
        title: 'Contact Information',
        fields: [
          { name: 'contact_person', label: 'Contact Person', type: 'text' },
          { name: 'phone_res', label: 'Phone (Res)', type: 'text' },
          { name: 'phone_off', label: 'Phone (Off)', type: 'text' },
          { name: 'mobile1', label: 'Mobile', type: 'text' },
        ]
      },
      {
        title: 'Address',
        fields: [
          { name: 'address1', label: 'Address', type: 'textarea' },
          { name: 'area', label: 'Area', type: 'masterSelect', masterType: 'area' },
        ]
      },
      {
        title: 'Tax',
        fields: [
          { name: 'tin_no', label: 'TIN No', type: 'text' },
        ]
      },
      {
        title: 'Status',
        fields: [
          { name: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }], defaultValue: 'Active' }
        ]
      }
    ]
  },
  consignee: {
    table: 'consignee_group_master',
    sections: [
      {
        title: 'Basic Information',
        fields: [
          { name: 'name', label: 'Consignee Name', type: 'text', required: true },
          { name: 'print_name', label: 'Print Name', type: 'text' },
        ]
      },
      {
        title: 'Contact Information',
        fields: [
          { name: 'contact_person', label: 'Contact Person', type: 'text' },
          { name: 'phone_res', label: 'Phone (Res)', type: 'text' },
          { name: 'phone_off', label: 'Phone (Off)', type: 'text' },
          { name: 'mobile1', label: 'Mobile', type: 'text' },
        ]
      },
      {
        title: 'Address',
        fields: [
          { name: 'address1', label: 'Address', type: 'textarea' },
          { name: 'area', label: 'Area', type: 'masterSelect', masterType: 'area' },
        ]
      },
      {
        title: 'Tax',
        fields: [
          { name: 'tin_no', label: 'TIN No', type: 'text' },
        ]
      },
      {
        title: 'Status',
        fields: [
          { name: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }], defaultValue: 'Active' }
        ]
      }
    ]
  },
  godown: {
    table: 'godown_master',
    sections: [
      {
        title: 'Basic Information',
        fields: [
          { name: 'godown_name', label: 'Godown Name', type: 'text', required: true },
          { name: 'print_name', label: 'Print Name', type: 'text' },
        ]
      },
      {
        title: 'Contact & Address',
        fields: [
          { name: 'contact_person', label: 'Contact Person', type: 'text' },
          { name: 'address1', label: 'Address', type: 'textarea' },
          { name: 'phone_off', label: 'Phone (Off)', type: 'text' },
          { name: 'mobile1', label: 'Mobile', type: 'text' },
          { name: 'email', label: 'Email', type: 'email' },
          { name: 'website', label: 'Web', type: 'text' },
          { name: 'area', label: 'Area', type: 'masterSelect', masterType: 'area' },
        ]
      },
      {
        title: 'Tax',
        fields: [
          { name: 'gst_number', label: 'GST No', type: 'text' },
        ]
      },
      {
        title: 'Status',
        fields: [
          { name: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }], defaultValue: 'Active' }
        ]
      }
    ]
  },
  customer: {
    table: 'customer_master',
    sections: [
      {
        title: 'Basic Information',
        fields: [
          { name: 'name', label: 'Customer Name', type: 'text', required: true },
          { name: 'print_name', label: 'Print Name', type: 'text' },
          { name: 'contact_person', label: 'Contact Person', type: 'text' },
        ]
      },
      {
        title: 'Address',
        fields: [
          { name: 'address1', label: 'Address', type: 'textarea' },
          { name: 'area', label: 'Area', type: 'masterSelect', masterType: 'area' },
        ]
      },
      {
        title: 'Contact',
        fields: [
          { name: 'phone_res', label: 'Phone (Res)', type: 'text' },
          { name: 'phone_off', label: 'Phone (Off)', type: 'text' },
          { name: 'mobile1', label: 'Mobile', type: 'text' },
          { name: 'email', label: 'Email', type: 'email' },
        ]
      },
      {
        title: 'Tax & Financial',
        fields: [
          { name: 'gst_number', label: 'GST Number', type: 'text' },
          { name: 'transport', label: 'Transport', type: 'masterSelect', masterType: 'transports' },
          { name: 'limit_days', label: 'Limit Days', type: 'number' },
          { name: 'limit_amount', label: 'Limit Amount', type: 'number' },
          { name: 'opening_balance', label: 'Opening Balance', type: 'number' },
          { name: 'balance_type', label: 'Balance Type', type: 'select', options: [{ label: 'Dr', value: 'Dr' }, { label: 'Cr', value: 'Cr' }], defaultValue: 'Dr' },
        ]
      },
      {
        title: 'Status',
        fields: [
          { name: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }], defaultValue: 'Active' }
        ]
      }
    ]
  },
  supplier: {
    table: 'supplier_master',
    sections: [
      {
        title: 'Basic Information',
        fields: [
          { name: 'name', label: 'Supplier Name', type: 'text', required: true },
          { name: 'print_name', label: 'Print Name', type: 'text' },
          { name: 'contact_person', label: 'Contact Person', type: 'text' },
        ]
      },
      {
        title: 'Address',
        fields: [
          { name: 'address1', label: 'Address', type: 'textarea' },
          { name: 'area', label: 'Area', type: 'masterSelect', masterType: 'area' },
        ]
      },
      {
        title: 'Contact',
        fields: [
          { name: 'phone_res', label: 'Phone (Res)', type: 'text' },
          { name: 'phone_off', label: 'Phone (Off)', type: 'text' },
          { name: 'mobile1', label: 'Mobile', type: 'text' },
          { name: 'email', label: 'Email', type: 'email' },
        ]
      },
      {
        title: 'Tax & Financial',
        fields: [
          { name: 'gst_number', label: 'GST Number', type: 'text' },
          { name: 'transport', label: 'Transport', type: 'masterSelect', masterType: 'transports' },
          { name: 'limit_days', label: 'Limit Days', type: 'number' },
          { name: 'limit_amount', label: 'Limit Amount', type: 'number' },
          { name: 'opening_balance', label: 'Opening Balance', type: 'number' },
          { name: 'balance_type', label: 'Balance Type', type: 'select', options: [{ label: 'Dr', value: 'Dr' }, { label: 'Cr', value: 'Cr' }], defaultValue: 'Dr' },
        ]
      },
      {
        title: 'Status',
        fields: [
          { name: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }], defaultValue: 'Active' }
        ]
      }
    ]
  },
  flour_mill: {
    table: 'flour_mill_master',
    sections: [
      {
        title: 'Basic Information',
        fields: [
          { name: 'flourmill', label: 'Flour Mill Name', type: 'text', required: true },
          { name: 'print_name', label: 'Print Name', type: 'text' },
          { name: 'contact_person', label: 'Contact Person', type: 'text' },
        ]
      },
      {
        title: 'Address',
        fields: [
          { name: 'address1', label: 'Address', type: 'textarea' },
          { name: 'area', label: 'Area', type: 'masterSelect', masterType: 'area' },
        ]
      },
      {
        title: 'Contact',
        fields: [
          { name: 'phone_res', label: 'Phone (Res)', type: 'text' },
          { name: 'phone_off', label: 'Phone (Off)', type: 'text' },
          { name: 'mobile1', label: 'Mobile', type: 'text' },
        ]
      },
      {
        title: 'Tax & Financial',
        fields: [
          { name: 'tin_no', label: 'TIN No', type: 'text' },
          { name: 'wages_kg', label: 'Wages per Kg', type: 'number' },
          { name: 'opening_balance', label: 'Opening Balance', type: 'number' },
          { name: 'opening_balance_type', label: 'Opening Balance Type', type: 'select', options: [{ label: 'Dr', value: 'Dr' }, { label: 'Cr', value: 'Cr' }], defaultValue: 'Dr' },
        ]
      },
      {
        title: 'Status',
        fields: [
          { name: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }], defaultValue: 'Active' }
        ]
      }
    ]
  },
  papad_company: {
    table: 'papad_company_master',
    sections: [
      {
        title: 'Basic Information',
        fields: [
          { name: 'name', label: 'Company Name', type: 'text', required: true },
          { name: 'print_name', label: 'Print Name', type: 'text' },
          { name: 'contact_person', label: 'Contact Person', type: 'text' },
        ]
      },
      {
        title: 'Address',
        fields: [
          { name: 'address1', label: 'Address', type: 'textarea' },
          { name: 'area', label: 'Area', type: 'masterSelect', masterType: 'area' },
        ]
      },
      {
        title: 'Contact',
        fields: [
          { name: 'phone_off', label: 'Phone (Off)', type: 'text' },
          { name: 'phone_res', label: 'Phone (Res)', type: 'text' },
          { name: 'mobile1', label: 'Mobile', type: 'text' },
          { name: 'email', label: 'Email', type: 'email' },
        ]
      },
      {
        title: 'Financial',
        fields: [
          { name: 'opening_advance', label: 'Opening Advance', type: 'number', defaultValue: 0 },
          { name: 'opening_balance', label: 'Opening Balance', type: 'number', defaultValue: 0 },
        ]
      },
      {
        title: 'Status',
        fields: [
          { name: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }], defaultValue: 'Active' }
        ]
      }
    ]
  },
  weight: {
    table: 'weightmaster',
    sections: [
      {
        title: 'Basic Information',
        fields: [
          { name: 'name', label: 'Weight Name', type: 'text', required: true },
          { name: 'printname', label: 'Print Name', type: 'text' },
        ]
      },
      {
        title: 'Details',
        fields: [
          { name: 'weight', label: 'Weight Value', type: 'number' },
        ]
      },
      {
        title: 'Status',
        fields: [
          { name: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }], defaultValue: 'Active' }
        ]
      }
    ]
  },
  item_group: {
    table: 'item_groups',
    sections: [
      {
        title: 'Basic Information',
        fields: [
          { name: 'group_code', label: 'Group Code', type: 'text' },
          { name: 'group_name', label: 'Group Name', type: 'text', required: true },
          { name: 'print_name', label: 'Print Name', type: 'text' },
        ]
      },
      {
        title: 'Tax',
        fields: [
          { name: 'tax', label: 'Tax %', type: 'number' },
        ]
      },
      {
        title: 'Status',
        fields: [
          { name: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }], defaultValue: 'Active' }
        ]
      }
    ]
  },
  item: {
    table: 'item_master',
    sections: [
      {
        title: 'Basic Information',
        fields: [
          { name: 'item_code', label: 'Item Code', type: 'text' },
          { name: 'item_name', label: 'Item Name', type: 'text', required: true },
          { name: 'print_name', label: 'Print Name', type: 'text' },
        ]
      },
      {
        title: 'Classification',
        fields: [
          { name: 'item_group', label: 'Item Group', type: 'masterSelect', masterType: 'item_groups' },
          { name: 'type', label: 'Type', type: 'select', options: [{ label: 'Urad', value: 'Urad' }, { label: 'Rice', value: 'Rice' }, { label: 'Flour', value: 'Flour' }, { label: 'Suji', value: 'Suji' }, { label: 'Papad', value: 'Papad' }, { label: 'Packaging', value: 'Packaging' }, { label: 'General', value: 'General' }], defaultValue: 'Urad' },
        ]
      },
      {
        title: 'GST & Tax Configuration',
        fields: [
          { name: 'hsn_code', label: 'HSN / SAC Code', type: 'text' },
          { name: 'tax_type', label: 'Tax Classification', type: 'select', options: [{ label: 'Taxable', value: 'Taxable' }, { label: 'Exempt', value: 'Exempt' }, { label: 'Nil Rated', value: 'Nil Rated' }, { label: 'Zero Rated', value: 'Zero Rated' }, { label: 'Non-GST', value: 'Non-GST' }], defaultValue: 'Taxable' },
          { name: 'tax', label: 'GST Rate %', type: 'number' },
          { name: 'tax_id', label: 'Tax Master Linked', type: 'masterSelect', masterType: 'taxes' },
        ]
      },
      {
        title: 'Stock Alert Configuration',
        fields: [
          { name: 'minimum_qty', label: 'Minimum Stock Qty (Kg)', type: 'number', defaultValue: 500 },
          { name: 'reorder_level', label: 'Reorder Level (Kg)', type: 'number', defaultValue: 1000 },
          { name: 'critical_level', label: 'Critical Stock Level (Kg)', type: 'number', defaultValue: 200 },
          { name: 'alert_enabled', label: 'Enable Low Stock Alert', type: 'select', options: [{ label: 'Yes', value: '1' }, { label: 'No', value: '0' }], defaultValue: '1' },
        ]
      },
      {
        title: 'Status',
        fields: [
          { name: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }], defaultValue: 'Active' }
        ]
      }
    ]
  },
  tax: {
    table: 'tax_master',
    sections: [
      {
        title: 'Basic Information',
        fields: [
          { name: 'tax_name', label: 'Tax Name / Commodity', type: 'text', required: true },
          { name: 'hsn_code', label: 'HSN Code', type: 'text', required: true },
          { name: 'tax_type', label: 'Tax Classification', type: 'select', options: [{ label: 'Taxable', value: 'Taxable' }, { label: 'Exempt', value: 'Exempt' }, { label: 'Nil Rated', value: 'Nil Rated' }, { label: 'Zero Rated', value: 'Zero Rated' }, { label: 'Non-GST', value: 'Non-GST' }], defaultValue: 'Taxable' },
          { name: 'gst_rate', label: 'GST Rate (%)', type: 'number', defaultValue: 5 },
          { name: 'calc_type', label: 'Calculation Type', type: 'select', options: [{ label: 'Exclusive', value: 'Exclusive' }, { label: 'Inclusive', value: 'Inclusive' }, { label: 'Without Tax', value: 'Without Tax' }], defaultValue: 'Exclusive' },
        ]
      },
      {
        title: 'Description & Notes',
        fields: [
          { name: 'description', label: 'Description', type: 'textarea' },
          { name: 'remarks', label: 'Remarks', type: 'textarea' },
        ]
      },
      {
        title: 'Status',
        fields: [
          { name: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }], defaultValue: 'Active' }
        ]
      }
    ]
  },
  deduction_sales: {
    table: 'deduction_sales',
    sections: [
      {
        title: 'Basic Information',
        fields: [
          { name: 'ded_code', label: 'Deduction Code', type: 'text', required: true },
          { name: 'ded_name', label: 'Deduction Name', type: 'text', required: true },
          { name: 'print_name', label: 'Print Name', type: 'text' },
        ]
      },
      {
        title: 'Account Settings',
        fields: [
          { name: 'adjust_with_sales', label: 'Adjust With Sales', type: 'text' },
          { name: 'account_head', label: 'Account Head', type: 'text' },
          { name: 'ded_type', label: 'Deduction Type', type: 'select', options: [{ label: 'Percentage', value: 'Percentage' }, { label: 'Fixed', value: 'Fixed' }], defaultValue: 'Percentage' },
        ]
      },
      {
        title: 'Calculation',
        fields: [
          { name: 'calc_type', label: 'Calculation Type', type: 'select', options: [{ label: 'Percentage', value: 'Percentage' }, { label: 'Fixed', value: 'Fixed' }], defaultValue: 'Percentage' },
          { name: 'ded_value', label: 'Deduction Value', type: 'number' },
          { name: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }], defaultValue: 'Active' },
        ]
      }
    ]
  },
  deduction_purchase: {
    table: 'deduction_purchase',
    sections: [
      {
        title: 'Basic Information',
        fields: [
          { name: 'ded_code', label: 'Deduction Code', type: 'text', required: true },
          { name: 'ded_name', label: 'Deduction Name', type: 'text', required: true },
          { name: 'print_name', label: 'Print Name', type: 'text' },
        ]
      },
      {
        title: 'Settings',
        fields: [
          { name: 'affect_cost_of_goods', label: 'Affect Cost of Goods', type: 'select', options: [{ label: 'Yes', value: 'Yes' }, { label: 'No', value: 'No' }], defaultValue: 'No' },
          { name: 'type', label: 'Type', type: 'select', options: [{ label: 'Add', value: 'Add' }, { label: 'Less', value: 'Less' }], defaultValue: 'Add' },
          { name: 'debit_side_adjust', label: 'Debit Side Adjust', type: 'select', options: [{ label: 'Supplier', value: 'Supplier' }, { label: 'A/c Head', value: 'A/c Head' }, { label: 'None', value: 'None' }], defaultValue: 'None' },
          { name: 'account_head', label: 'Account Head', type: 'text' },
          { name: 'credit_adjust', label: 'Credit Side Adjust', type: 'select', options: [{ label: 'Supplier', value: 'Supplier' }, { label: 'A/c Head', value: 'A/c Head' }, { label: 'None', value: 'None' }], defaultValue: 'None' },
        ]
      },
      {
        title: 'Calculation',
        fields: [
          { name: 'deduction_type', label: 'Deduction Type', type: 'select', options: [{ label: 'Add', value: 'Add' }, { label: 'Less', value: 'Less' }], defaultValue: 'Add' },
          { name: 'calculation_type', label: 'Deduction Calculation Type', type: 'select', options: [{ label: 'Percentage', value: 'Percentage' }, { label: 'Amount', value: 'Amount' }], defaultValue: 'Percentage' },
          { name: 'deduction_value', label: 'Deduction Value', type: 'number', defaultValue: 0 },
          { name: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }], defaultValue: 'Active' },
        ]
      }
    ]
  }
};

