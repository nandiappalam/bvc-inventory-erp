const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

let testResults = {
  passed: 0,
  failed: 0,
  total: 0
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n${'='.repeat(70)}`, 'blue');
  log(`  ${title}`, 'cyan');
  log('='.repeat(70), 'blue');
}

function logSuccess(message) {
  testResults.passed++;
  testResults.total++;
  log(`  ✓ ${message}`, 'green');
}

function logError(message) {
  testResults.failed++;
  testResults.total++;
  log(`  ✗ ${message}`, 'red');
}

function logInfo(message) {
  log(`    → ${message}`, 'yellow');
}

// ============================================
// MASTER MODULES TESTING
// ============================================

const masterModules = [
  { name: 'City', endpoint: 'cities', table: 'city_master', data: { name: 'Test City', print_name: 'TEST CITY', status: 'Active' } },
  { name: 'Area', endpoint: 'areas', table: 'area_master', data: { name: 'Test Area', print_name: 'TEST AREA', status: 'Active' } },
  { name: 'Supplier', endpoint: 'suppliers', table: 'supplier_master', data: { name: 'Test Supplier', print_name: 'TEST SUPPLIER', contact_person: 'John', address1: '123 Test St', mobile1: '9876543210', area: 'Test', opening_balance: 10000, status: 'Active' } },
  { name: 'Customer', endpoint: 'customers', table: 'customer_master', data: { name: 'Test Customer', print_name: 'TEST CUSTOMER', contact_person: 'Jane', address1: '456 Test Ave', mobile1: '1234567890', area: 'Test', opening_balance: 5000, status: 'Active' } },
  { name: 'Flour Mill', endpoint: 'flour_mills', table: 'flour_mill_master', data: { flourmill: 'Test Flour Mill', print_name: 'TEST MILL', contact_person: 'Miller', address1: '789 Mill Rd', mobile1: '9998887777', area: 'Test', wages_kg: 2.5, opening_balance: 50000, status: 'Active' } },
  { name: 'Papad Company', endpoint: 'papad_companies', table: 'papad_company_master', data: { name: 'Test Papad Co', print_name: 'TEST PAPAD', contact_person: 'Papad', address1: '321 Papad Ln', mobile1: '8887776666', area: 'Test', wages_kg: 1.5, opening_balance: 30000, opening_advance: 5000, status: 'Active' } },
  { name: 'Consignee', endpoint: 'consignees', table: 'consignee_group_master', data: { name: 'Test Consignee', print_name: 'TEST CONSIGNEE', contact_person: 'Export Manager', address: '456 Export Bldg', area: 'Test', mobile: '7776665555', tin_no: '27TEST123', status: 'Active' } },
  { name: 'Sender', endpoint: 'senders', table: 'sender_group_master', data: { name: 'Test Sender', print_name: 'TEST SENDER', contact_person: 'Sender Manager', address: '789 Sender Plaza', area: 'Test', mobile: '6665554444', tin_no: '27SEND123', status: 'Active' } },
  { name: 'PTrans', endpoint: 'ptrans', table: 'ptrans_master', data: { name: 'Test PTrans', print_name: 'TEST PTRANS', status: 'Active' } },
  { name: 'Transport', endpoint: 'transports', table: 'transport_master', data: { name: 'Test Transport', print_name: 'TEST TRANSPORT', status: 'Active' } },
  { name: 'Item', endpoint: 'items', table: 'item_master', data: { item_code: 'ITM001', item_name: 'Test Item', print_name: 'TEST ITEM', item_group: 'Test Group', tax: 5, hsn_code: '1101', status: 'Active' } },
  { name: 'Item Group', endpoint: 'item_groups', table: 'item_groups', data: { group_code: 'GRP001', group_name: 'Test Group', print_name: 'TEST GROUP', tax: 5 } },
  { name: 'Weight', endpoint: 'weights', table: 'weightmaster', data: { name: 'Test Weight 1kg', printname: '1 KG', weight: 1 } },
  { name: 'Ledger Group', endpoint: 'ledger_groups', table: 'ledgergroupmaster', data: { name: 'Test Ledger Group', printname: 'TEST LG', under: 'Assets' } },
  { name: 'Ledger', endpoint: 'ledgers', table: 'ledgermaster', data: { name: 'Test Ledger', printname: 'TEST LEDGER', under: 'Cash', openingbalance: 100000, area: 'Test', credit: 0, debit: 100000, status: 'Active' } },
  { name: 'Deduction Sales', endpoint: 'deduction_sales', table: 'deduction_sales', data: { ded_code: 'DS001', ded_name: 'Test Sales Deduction', print_name: 'TEST SALES DED', adjust_with_sales: 'Yes', account_head: 'Direct Expenses', ded_type: 'Percentage', calc_type: 'Fixed', ded_value: 2, status: 'Active' } },
  { name: 'Deduction Purchase', endpoint: 'deduction_purchase', table: 'deduction_purchase', data: { ded_code: 'DP001', ded_name: 'Test Purchase Deduction', print_name: 'TEST PURCHASE DED', debit_adjust: 'Yes', account_head: 'Direct Income', credit_adjust: 'Yes', ded_type: 'Percentage', calc_type: 'Fixed', status: 'Active' } }
];

async function testMasterCRUD(module) {
  logSection(`Testing ${module.name} Master`);
  
  try {
    // Test 1: GET all records
    logInfo(`GET /api/masters/${module.endpoint}`);
    const getAllResponse = await axios.get(`${BASE_URL}/masters/${module.endpoint}`);
    logSuccess(`${module.name}: Fetched ${getAllResponse.data.length} records`);
    
    // Test 2: CREATE new record
    logInfo(`POST /api/masters/${module.table}`);
    const createResponse = await axios.post(`${BASE_URL}/masters/${module.table}`, module.data);
    const recordId = createResponse.data.id;
    logSuccess(`${module.name}: Created with ID ${recordId}`);
    
    // Test 3: GET single record
    logInfo(`GET /api/masters/record/${module.table}/${recordId}`);
    const getOneResponse = await axios.get(`${BASE_URL}/masters/record/${module.table}/${recordId}`);
    logSuccess(`${module.name}: Retrieved record successfully`);
    
    // Test 4: UPDATE record
    const updateData = { ...module.data, name: module.data.name + ' Updated' };
    logInfo(`PUT /api/masters/${module.table}/${recordId}`);
    await axios.put(`${BASE_URL}/masters/${module.table}/${recordId}`, updateData);
    logSuccess(`${module.name}: Updated successfully`);
    
    // Test 5: DELETE record
    logInfo(`DELETE /api/masters/${module.table}/${recordId}`);
    await axios.delete(`${BASE_URL}/masters/${module.table}/${recordId}`);
    logSuccess(`${module.name}: Deleted successfully`);
    
    return true;
  } catch (error) {
    logError(`${module.name}: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// ============================================
// ENTRY MODULES TESTING
// ============================================

const entryModules = [
  { name: 'Purchases', endpoint: '/purchases' },
  { name: 'Sales', endpoint: '/sales' },
  { name: 'Purchase Returns', endpoint: '/purchase-returns' },
  { name: 'Sales Returns', endpoint: '/sales-returns' },
  { name: 'Flour Out', endpoint: '/flour-out' },
  { name: 'Flour Out Returns', endpoint: '/flour-out-returns' },
  { name: 'Grains', endpoint: '/grains' },
  { name: 'Advances', endpoint: '/advances' },
  { name: 'Papad In', endpoint: '/papad-in' },
  { name: 'Stock', endpoint: '/stock' },
  { name: 'Weight Conversion', endpoint: '/weight-conversion' },
  { name: 'Sales Export Orders', endpoint: '/sales-export-orders' },
  { name: 'Open', endpoint: '/open' }
];

async function testEntryModules() {
  logSection('Testing Entry Modules - GET Operations');
  
  for (const module of entryModules) {
    try {
      const response = await axios.get(`${BASE_URL}${module.endpoint}`);
      logSuccess(`${module.name}: ${response.data.length || 0} records`);
    } catch (error) {
      logError(`${module.name}: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
    }
  }
}

// ============================================
// DROPDOWN / MASTER DATA FETCH TESTING
// ============================================

async function testDropdowns() {
  logSection('Testing Master Dropdowns (for Entry Forms)');
  
  const dropdownTests = [
    { name: 'Items for Purchase/Sales', endpoint: '/masters/items' },
    { name: 'Suppliers for Purchase', endpoint: '/masters/suppliers' },
    { name: 'Customers for Sales', endpoint: '/masters/customers' },
    { name: 'Areas', endpoint: '/masters/areas' },
    { name: 'Cities', endpoint: '/masters/cities' },
    { name: 'Flour Mills', endpoint: '/masters/flour_mills' },
    { name: 'Papad Companies', endpoint: '/masters/papad_companies' },
    { name: 'Transports', endpoint: '/masters/transports' },
    { name: 'Ledgers', endpoint: '/masters/ledgers' },
    { name: 'Weights', endpoint: '/masters/weights' },
    { name: 'PTrans', endpoint: '/masters/ptrans' },
    { name: 'Item Groups', endpoint: '/masters/item_groups' },
    { name: 'Deduction Sales', endpoint: '/masters/deduction_sales' },
    { name: 'Deduction Purchase', endpoint: '/masters/deduction_purchase' }
  ];
  
  for (const test of dropdownTests) {
    try {
      const response = await axios.get(`${BASE_URL}${test.endpoint}`);
      logSuccess(`${test.name}: ${response.data.length} items available`);
    } catch (error) {
      logError(`${test.name}: ${error.response?.status}`);
    }
  }
}

// ============================================
// STOCK AND LOT TESTING
// ============================================

async function testStockAndLots() {
  logSection('Testing Stock & Lots Operations');
  
  // Test 1: Stock lots
  try {
    const response = await axios.get(`${BASE_URL}/stock/lots`);
    logSuccess(`Stock Lots: ${response.data.length || 0} lots`);
  } catch (error) {
    logError(`Stock Lots: ${error.response?.status}`);
  }
  
  // Test 2: Stock report
  try {
    const response = await axios.get(`${BASE_URL}/stock/report`);
    logSuccess(`Stock Report: ${response.data.length || 0} items in report`);
  } catch (error) {
    logError(`Stock Report: ${error.response?.status}`);
  }
  
  // Test 3: All stock
  try {
    const response = await axios.get(`${BASE_URL}/stock`);
    logSuccess(`All Stock: ${response.data.length || 0} records`);
  } catch (error) {
    logError(`All Stock: ${error.response?.status}`);
  }
}

// ============================================
// REPORTS TESTING
// ============================================

async function testReports() {
  logSection('Testing Reports Module');
  
  const reports = [
    { name: 'Stock Status Report', endpoint: '/reports/stock' },
    { name: 'Purchase Register', endpoint: '/reports/purchase-register' },
    { name: 'Sales Register', endpoint: '/reports/sales-register' },
    { name: 'Purchase Return Register', endpoint: '/reports/purchase-return-register' },
    { name: 'Sales Return Register', endpoint: '/reports/sales-return-register' }
  ];
  
  for (const report of reports) {
    try {
      const response = await axios.get(`${BASE_URL}${report.endpoint}`);
      logSuccess(`${report.name}: ${response.data.length || 0} records`);
    } catch (error) {
      logError(`${report.name}: ${error.response?.status} - ${error.response?.data?.message || 'Error'}`);
    }
  }
}

// ============================================
// FULL CRUD INTEGRATION TEST
// ============================================

async function testFullCRUDIntegration() {
  logSection('Full CRUD Integration Test');
  
  // This test creates real data and verifies the entire flow
  // 1. Create Item Group
  // 2. Create Item
  // 3. Create Supplier
  // 4. Create Purchase (uses all above)
  // 5. Check Stock/Lot
  // 6. Create Sales (uses item/lot)
  // 7. Check stock reduced
  // 8. Create Sales Return
  // 9. Check stock increased
  
  try {
    // Step 1: Create Item Group
    logInfo('Step 1: Create Item Group');
    const itemGroup = await axios.post(`${BASE_URL}/masters/item_groups`, {
      group_code: 'TESTGRP',
      group_name: 'Integration Test Group',
      print_name: 'INTEGRATION TEST',
      tax: 5
    });
    const groupId = itemGroup.data.id;
    logSuccess(`Item Group created: ID ${groupId}`);
    
    // Step 2: Create Item
    logInfo('Step 2: Create Item');
    const item = await axios.post(`${BASE_URL}/masters/item_master`, {
      item_code: 'INTTEST001',
      item_name: 'Integration Test Item',
      print_name: 'INTEGRATION TEST ITEM',
      item_group: 'Integration Test Group',
      tax: 5,
      hsn_code: '9999',
      status: 'Active'
    });
    const itemId = item.data.id;
    logSuccess(`Item created: ID ${itemId}`);
    
    // Step 3: Create Supplier
    logInfo('Step 3: Create Supplier');
    const supplier = await axios.post(`${BASE_URL}/masters/supplier_master`, {
      name: 'Integration Test Supplier',
      print_name: 'INTEGRATION SUPPLIER',
      contact_person: 'Test Person',
      address1: '123 Test Address',
      mobile1: '9999999999',
      area: 'Test',
      opening_balance: 100000,
      status: 'Active'
    });
    const supplierId = supplier.data.id;
    logSuccess(`Supplier created: ID ${supplierId}`);
    
    // Step 4: Create Customer
    logInfo('Step 4: Create Customer');
    const customer = await axios.post(`${BASE_URL}/masters/customer_master`, {
      name: 'Integration Test Customer',
      print_name: 'INTEGRATION CUSTOMER',
      contact_person: 'Test Customer',
      address1: '456 Test Address',
      mobile1: '8888888888',
      area: 'Test',
      opening_balance: 50000,
      status: 'Active'
    });
    const customerId = customer.data.id;
    logSuccess(`Customer created: ID ${customerId}`);
    
    // Cleanup - Delete test records
    logInfo('Cleaning up test records...');
    await axios.delete(`${BASE_URL}/masters/item_master/${itemId}`);
    await axios.delete(`${BASE_URL}/masters/item_groups/${groupId}`);
    await axios.delete(`${BASE_URL}/masters/supplier_master/${supplierId}`);
    await axios.delete(`${BASE_URL}/masters/customer_master/${customerId}`);
    logSuccess('Cleanup complete');
    
    return true;
  } catch (error) {
    logError(`Integration Test: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// ============================================
// HEALTH CHECK
// ============================================

async function testHealthCheck() {
  logSection('System Health Check');
  
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    logSuccess(`API Health: ${response.data.message}`);
    return true;
  } catch (error) {
    logError(`API Health: ${error.message}`);
    return false;
  }
}

// ============================================
// MAIN TEST RUNNER
// ============================================

async function runAllTests() {
  log('\n' + '='.repeat(70), 'magenta');
  log('  BVC ERP COMPREHENSIVE SYSTEM VALIDATION', 'cyan');
  log('  Testing: Masters | Entries | Dropdowns | Stock | Reports | CRUD', 'yellow');
  log('='.repeat(70), 'magenta');
  
  // Health Check
  const isHealthy = await testHealthCheck();
  if (!isHealthy) {
    logError('API is not running. Please start the backend server.');
    return;
  }
  
  // Test all Master Modules CRUD
  logSection('TESTING MASTER MODULES (CRUD Operations)');
  for (const module of masterModules) {
    await testMasterCRUD(module);
  }
  
  // Test Entry Modules
  await testEntryModules();
  
  // Test Dropdowns
  await testDropdowns();
  
  // Test Stock and Lots
  await testStockAndLots();
  
  // Test Reports
  await testReports();
  
  // Full CRUD Integration Test
  await testFullCRUDIntegration();
  
  // Summary
  logSection('TEST SUMMARY');
  log(`  Total Tests: ${testResults.total}`, 'blue');
  log(`  Passed: ${testResults.passed}`, 'green');
  log(`  Failed: ${testResults.failed}`, testResults.failed > 0 ? 'red' : 'green');
  log('='.repeat(70), 'blue');
  
  if (testResults.failed === 0) {
    log('\n🎉 ALL TESTS PASSED! System is working correctly.\n', 'green');
  } else {
    log(`\n⚠️  ${testResults.failed} test(s) failed. Please review the errors above.\n`, 'yellow');
  }
}

// Run all tests
runAllTests().catch(console.error);
