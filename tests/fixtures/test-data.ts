/**
 * BVC Inventory ERP - Automated Test Data Fixtures
 * All entities use strict TEST_ prefixes for safe identification and cleanup.
 */

export const generateTestId = () => `TEST_${Date.now().toString(36).toUpperCase()}_${Math.floor(Math.random() * 1000)}`;

export const getTestItem = (suffix = '') => {
  const id = generateTestId();
  return {
    item_code: `TEST_ITEM_${id}${suffix}`,
    item_name: `TEST Item ${id}${suffix}`,
    print_name: `TEST Item ${id}${suffix}`,
    item_group: 'Raw Material',
    type: 'Raw Material',
    hsn_code: '1106',
    gst_rate: 5,
    tax_type: 'Taxable',
    unit: 'KGS',
    bag_size: 50,
    min_stock: 100,
    max_stock: 5000,
    opening_qty: 100,
    opening_rate: 45,
    opening_value: 4500,
    status: 'Active'
  };
};

export const getTestSupplier = (suffix = '') => {
  const id = generateTestId();
  return {
    name: `TEST_SUPPLIER_${id}${suffix}`,
    company_name: `TEST Supplier Enterprise ${id}${suffix}`,
    address1: '123 Test Industrial Estate',
    city: 'Chennai',
    state: 'Tamil Nadu',
    state_code: '33',
    pincode: '600001',
    gst_number: '33AAAAA0000A1Z5',
    phone: '9876543210',
    mobile1: '9876543210',
    email: `supplier_${id.toLowerCase()}@testbvc.com`,
    pan_number: 'AAAAA0000A',
    status: 'Active'
  };
};

export const getTestCustomer = (suffix = '') => {
  const id = generateTestId();
  return {
    name: `TEST_CUSTOMER_${id}${suffix}`,
    company_name: `TEST Customer Retail ${id}${suffix}`,
    address1: '456 Test Market Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    state_code: '29',
    pincode: '560001',
    gst_number: '29BBBBB1111B1Z2',
    phone: '9812345678',
    mobile1: '9812345678',
    email: `customer_${id.toLowerCase()}@testbvc.com`,
    status: 'Active'
  };
};

export const getTestPurchasePayload = (supplierName: string, itemName: string, lotNo?: string) => {
  const id = generateTestId();
  const lot = lotNo || `TEST_LOT_${id}`;
  const qty = 1000;
  const rate = 50;
  const gross = qty * rate;
  const tax = gross * 0.05;
  const net = gross + tax;

  const item = {
    item_name: itemName,
    lot_no: lot,
    bag_qty: 20,
    per_unit_weight: 50,
    total_weight: 1000,
    qty: qty,
    rate: rate,
    gross_amount: gross,
    disc_percent: 0,
    tax_percent: 5,
    tax_type: 'Exclusive',
    gst_rate: 5,
    cgst_rate: 2.5,
    cgst_amount: tax / 2,
    sgst_rate: 2.5,
    sgst_amount: tax / 2,
    igst_rate: 0,
    igst_amount: 0,
    tax_amount: tax,
    amount: net,
    total_amount: net,
    godown: 'Godown 1'
  };

  return {
    formData: {
      s_no: '1',
      date: new Date().toISOString().split('T')[0],
      inv_no: `TEST_INV_${id}`,
      supplier: supplierName,
      supplier_name: supplierName,
      pay_type: 'Credit',
      type: 'Urad',
      tax_type: 'Exclusive',
      tax_mode: 'Exclusive',
      godown: 'Godown 1',
      remarks: 'Automated test purchase transaction'
    },
    items: [item],
    totals: {
      totalQty: qty,
      totalWeight: 1000,
      totalAmount: gross,
      baseAmount: gross,
      discAmount: 0,
      taxAmount: tax,
      netAmount: net,
      grandTotal: net
    },
    deductions: [],
    // Legacy top-level fields for convenience
    date: new Date().toISOString().split('T')[0],
    inv_no: `TEST_INV_${id}`,
    supplier: supplierName,
    lot_no: lot
  };
};

export const getTestSalesPayload = (customerName: string, itemName: string, lotNo: string) => {
  const id = generateTestId();
  const qty = 10;
  const rate = 80;
  const gross = qty * rate;
  const tax = gross * 0.05;
  const net = gross + tax;

  const item = {
    item_name: itemName,
    itemName: itemName,
    lot_no: lotNo,
    lotNo: lotNo,
    qty: qty,
    weight: 50,
    total_wt: 500,
    totalWt: 500,
    rate: rate,
    disc_perc: 0,
    tax_perc: 5,
    total_amt: net,
    totalAmt: net,
    amount: net,
    godown: 'Godown 1'
  };

  return {
    formData: {
      s_no: '1',
      date: new Date().toISOString().split('T')[0],
      customer: customerName,
      customer_name: customerName,
      remarks: 'Automated test sales transaction',
      pay_type: 'Credit',
      tax_type: 'Exclusive',
      lorry_no: 'TN01AB1234',
      total_amt: net,
      grand_total: net
    },
    items: [item],
    totals: {
      totalQty: qty,
      totalWeight: 500,
      totalAmount: gross,
      netAmount: net,
      taxAmount: tax,
      grandTotal: net
    },
    // Top-level aliases
    date: new Date().toISOString().split('T')[0],
    inv_no: `TEST_SINV_${id}`,
    customer: customerName,
    lot_no: lotNo
  };
};

