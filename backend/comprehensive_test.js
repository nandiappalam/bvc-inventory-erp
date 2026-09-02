const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(title, 'cyan');
  log('='.repeat(60), 'blue');
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logInfo(message) {
  log(`  ${message}`, 'yellow');
}

// Sample test data for each master type
const masterTestData = {
  city_master: { name: 'Test City Mumbai', print_name: 'MUMBAI', status: 'Active' },
  area_master: { name: 'Test Area Andheri', print_name: 'ANDHERI', status: 'Active' },
  supplier_master: { 
    name: 'Test Supplier ABC', 
    print_name: 'ABC SUPPLIERS PVT LTD', 
    contact_person: 'John Doe',
    address1: '123 Test Road',
    phone_off: '022-12345678',
    mobile1: '9876543210',
    area: 'Andheri',
    opening_balance: 50000,
    status: 'Active'
  },
  customer_master: { 
    name: 'Test Customer XYZ', 
    print_name: 'XYZ CUSTOMERS PVT LTD', 
    contact_person: 'Jane Smith',
    address1: '456 Customer Street',
    phone_off: '022-87654321',
    mobile1: '1234567890',
    area: 'Andheri',
    opening_balance: 25000,
    status: 'Active'
  },
  flour_mill_master: { 
    flourmill: 'Test Flour Mill Premium', 
    print_name: 'PREMIUM FLOUR MILLS', 
    contact_person: 'Miller Singh',
    address1: '789 Mill Road',
    phone_off: '022-11112222',
    mobile1: '9999888877',
    area: 'Andheri',
    wages_kg: 2.5,
    opening_balance: 100000,
    status: 'Active'
  },
  papad_company_master: { 
    name: 'Test Papad Company Yummy', 
    print_name: 'YUMMY PAPAD COMPANY', 
    contact_person: 'Papad Kumar',
    address1: '321 Papad Lane',
    phone_off: '022-33334444',
    mobile1: '8888777666',
    area: 'Andheri',
    wages_kg: 1.5,
    opening_balance: 75000,
    opening_advance: 10000,
    status: 'Active'
  },
  consignee_group_master: { 
    name: 'Test Consignee Export', 
    print_name: 'EXPORT CONSIGNEE GROUP', 
    contact_person: 'Export Manager',
    address: '456 Export Building',
    area: 'Andheri',
    phone_off: '022-55556666',
    mobile: '7777666555',
    tin_no: '27AABCU9603R1ZM',
    status: 'Active'
  },
  sender_group_master: { 
    name: 'Test Sender Mumbai', 
    print_name: 'MUMBAI SENDER GROUP', 
    contact_person: 'Sender Manager',
    address: '789 Sender Plaza',
    area: 'Andheri',
    phone_off: '022-77778888',
    mobile: '6666555444',
    tin_no: '27AABCT1234R1ZM',
    status: 'Active'
  },
  ptrans_master: { name: 'Test PTrans Fast', print_name: 'FAST PTRANSPORT', status: 'Active' },
  transport_master: { name: 'Test Transport India', print_name: 'INDIA TRANSPORT', status: 'Active' },
  item_master: { 
    item_code: 'ITM001', 
    item_name: 'Test Item Wheat Flour', 
    print_name: 'WHEAT FLOUR PREMIUM', 
    item_group: 'Flour',
    tax: 5,
    hsn_code: '11010010',
    status: 'Active'
  },
  item_groups: { 
    group_code: 'GRP001', 
    group_name: 'Test Group Flour', 
    print_name: 'FLOUR GROUP', 
    tax: 5 
  },
  weightmaster: { name: 'Test Weight 1kg', printname: '1 KG', weight: 1 },
  ledgergroupmaster: { name: 'Test Ledger Group Assets', printname: 'ASSETS', under: 'Assets' },
  ledgermaster: { 
    name: 'Test Ledger Cash', 
    printname: 'CASH ACCOUNT', 
    under: 'Cash',
    openingbalance: 100000,
    area: 'Andheri',
    credit: 0,
    debit: 100000,
    status: 'Active'
  },
  deduction_sales: {
    ded_code: 'DS001',
    ded_name: 'Test Sales Deduction',
    print_name: 'SALES DEDUCTION TEST',
    adjust_with_sales: 'Yes',
    account_head: 'Direct Expenses',
    ded_type: 'Percentage',
    calc_type: 'Fixed',
    ded_value: 2,
    status: 'Active'
  },
  deduction_purchase: {
    ded_code: 'DP001',
    ded_name: 'Test Purchase Deduction',
    print_name: 'PURCHASE DEDUCTION TEST',
    debit_adjust: 'Yes',
    account_head: 'Direct Income',
    credit_adjust: 'Yes',
    ded_type: 'Percentage',
    calc_type: 'Fixed',
    status: 'Active'
  }
};

// Test master APIs
async function testMasterAPI(type, tableName) {
  logSection(`Testing Master: ${type}`);
  
  const sampleData = masterTestData[tableName];
  if (!sampleData) {
    logError(`No test data defined for ${tableName}`);
    return null;
  }

  try {
    // Test GET - Fetch all records
    logInfo(`GET /api/masters/${type}`);
    const getResponse = await axios.get(`${BASE_URL}/masters/${type}`);
    logSuccess(`Fetched ${getResponse.data.length} records`);
    
    // Test POST - Create new record
    logInfo(`POST /api/masters/${tableName}`);
    const postResponse = await axios.post(`${BASE_URL}/masters/${tableName}`, sampleData);
    logSuccess(`Created record with ID: ${postResponse.data.id}`);
    
    const recordId = postResponse.data.id;
    
    // Test GET - Fetch the created record
    logInfo(`GET /api/masters/record/${tableName}/${recordId}`);
    const getOneResponse = await axios.get(`${BASE_URL}/masters/record/${tableName}/${recordId}`);
    logSuccess(`Fetched created record: ${getOneResponse.data.name || getOneResponse.data.item_name || getOneResponse.data.flourmill}`);
    
    // Test PUT - Update the record
    const updateData = { ...sampleData, name: sampleData.name + ' Updated' };
    logInfo(`PUT /api/masters/${tableName}/${recordId}`);
    const putResponse = await axios.put(`${BASE_URL}/masters/${tableName}/${recordId}`, updateData);
    logSuccess('Record updated successfully');
    
    // Test DELETE - Delete the record
    logInfo(`DELETE /api/masters/${tableName}/${recordId}`);
    const deleteResponse = await axios.delete(`${BASE_URL}/masters/${tableName}/${recordId}`);
    logSuccess('Record deleted successfully');
    
    return { success: true, message: 'All CRUD operations passed' };
  } catch (error) {
    logError(`Error: ${error.response?.data?.message || error.message}`);
    return { success: false, message: error.response?.data?.message || error.message };
  }
}

// Test Entry APIs
async function testEntryAPI() {
  logSection('Testing Entry APIs');
  
  const entryEndpoints = [
    { name: 'Purchases', path: '/purchases' },
    { name: 'Sales', path: '/sales' },
    { name: 'Purchase Returns', path: '/purchase-returns' },
    { name: 'Sales Returns', path: '/sales-returns' },
    { name: 'Flour Out', path: '/flour-out' },
    { name: 'Flour Out Returns', path: '/flour-out-returns' },
    { name: 'Grains', path: '/grains' },
    { name: 'Advances', path: '/advances' },
    { name: 'Papad In', path: '/papad-in' },
    { name: 'Stock', path: '/stock' },
    { name: 'Weight Conversion', path: '/weight-conversion' },
    { name: 'Sales Export Orders', path: '/sales-export-orders' },
    { name: 'Open', path: '/open' }
  ];

  for (const endpoint of entryEndpoints) {
    try {
      logInfo(`Testing ${endpoint.name}: GET ${endpoint.path}`);
      const response = await axios.get(`${BASE_URL}${endpoint.path}`);
      logSuccess(`${endpoint.name}: ${response.data.length || 0} records`);
    } catch (error) {
      logError(`${endpoint.name}: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
    }
  }
}

// Test Reports APIs
async function testReportsAPI() {
  logSection('Testing Reports APIs');
  
  const reportEndpoints = [
    { name: 'Stock Report', path: '/reports/stock' },
    { name: 'Purchase Register', path: '/reports/purchase-register' },
    { name: 'Sales Register', path: '/reports/sales-register' },
    { name: 'Purchase Return Register', path: '/reports/purchase-return-register' },
    { name: 'Sales Return Register', path: '/reports/sales-return-register' }
  ];

  for (const endpoint of reportEndpoints) {
    try {
      logInfo(`Testing ${endpoint.name}: GET ${endpoint.path}`);
      const response = await axios.get(`${BASE_URL}${endpoint.path}`);
      logSuccess(`${endpoint.name}: ${response.data.length || 0} records`);
    } catch (error) {
      logError(`${endpoint.name}: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
    }
  }
}

// Main test function
async function runAllTests() {
  log('='.repeat(60), 'blue');
  log('BVC ERP COMPREHENSIVE API TESTING', 'cyan');
  log('='.repeat(60), 'blue');
  
  // Test health check
  logSection('Health Check');
  try {
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    logSuccess(`API Status: ${healthResponse.data.message}`);
  } catch (error) {
    logError('API is not responding');
    return;
  }

  // Test all Master APIs
  const masterTypes = [
    { type: 'cities', table: 'city_master' },
    { type: 'areas', table: 'area_master' },
    { type: 'suppliers', table: 'supplier_master' },
    { type: 'customers', table: 'customer_master' },
    { type: 'flour_mills', table: 'flour_mill_master' },
    { type: 'papad_companies', table: 'papad_company_master' },
    { type: 'consignees', table: 'consignee_group_master' },
    { type: 'senders', table: 'sender_group_master' },
    { type: 'ptrans', table: 'ptrans_master' },
    { type: 'transports', table: 'transport_master' },
    { type: 'items', table: 'item_master' },
    { type: 'item_groups', table: 'item_groups' },
    { type: 'weights', table: 'weightmaster' },
    { type: 'ledger_groups', table: 'ledgergroupmaster' },
    { type: 'ledgers', table: 'ledgermaster' },
    { type: 'deduction_sales', table: 'deduction_sales' },
    { type: 'deduction_purchase', table: 'deduction_purchase' }
  ];

  for (const master of masterTypes) {
    await testMasterAPI(master.type, master.table);
  }

  // Test Entry APIs
  await testEntryAPI();

  // Test Reports APIs
  await testReportsAPI();

  logSection('All Tests Completed');
  log('='.repeat(60), 'blue');
}

runAllTests().catch(console.error);
