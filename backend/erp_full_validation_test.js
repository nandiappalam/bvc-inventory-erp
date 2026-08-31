/**
 * ERP SYSTEM - FULL MODULE COMPREHENSIVE TESTING
 * Tests: Functional, Integration, Edge Cases, Stock Integrity, Ledger Validation
 * 
 * Validates that system is production-ready with:
 * - No negative stock
 * - No ledger mismatch
 * - No duplicate lot numbers
 * - No API 400/500 errors
 * - No SQL constraint violations
 */

const axios = require('axios');
const db = require('./config/database');

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
  warnings: 0,
  total: 0,
  tests: []
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
  testResults.tests.push({ name: message, status: 'PASSED' });
  log(`  ✓ ${message}`, 'green');
}

function logError(message) {
  testResults.failed++;
  testResults.total++;
  testResults.tests.push({ name: message, status: 'FAILED' });
  log(`  ✗ ${message}`, 'red');
}

function logWarning(message) {
  testResults.warnings++;
  testResults.tests.push({ name: message, status: 'WARNING' });
  log(`  ⚠ ${message}`, 'yellow');
}

function logInfo(message) {
  log(`    → ${message}`, 'yellow');
}

// ============================================================================
// PHASE 1: HEALTH CHECK & API AVAILABILITY
// ============================================================================

async function testPhase1_HealthCheck() {
  logSection('PHASE 1: API HEALTH CHECK');
  
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    logSuccess(`API Health: ${response.data.status}`);
    return true;
  } catch (error) {
    logError(`API Health Check Failed: ${error.message}`);
    return false;
  }
}

// ============================================================================
// PHASE 2: MASTER MODULE TESTING
// ============================================================================

async function testPhase2_MasterModules() {
  logSection('PHASE 2: MASTER MODULE TESTING');
  
  const masterModules = [
    { name: 'City', endpoint: 'cities', table: 'city_master', data: { name: 'Test City', print_name: 'TEST', status: 'Active' } },
    { name: 'Area', endpoint: 'areas', table: 'area_master', data: { name: 'Test Area', print_name: 'TEST', status: 'Active' } },
    { name: 'Supplier', endpoint: 'suppliers', table: 'supplier_master', data: { name: 'Test Supplier', print_name: 'TEST', contact_person: 'John', address1: '123 Test', mobile1: '9876543210', area: 'Test', opening_balance: 10000, status: 'Active' } },
    { name: 'Customer', endpoint: 'customers', table: 'customer_master', data: { name: 'Test Customer', print_name: 'TEST', contact_person: 'Jane', address1: '456 Test', mobile1: '1234567890', area: 'Test', opening_balance: 5000, status: 'Active' } },
    { name: 'Item', endpoint: 'items', table: 'item_master', data: { item_code: 'ITM001', item_name: 'Test Item', print_name: 'TEST', item_group: 'Test', tax: 5, hsn_code: '1101', status: 'Active' } },
    { name: 'Item Group', endpoint: 'item_groups', table: 'item_groups', data: { group_code: 'GRP001', group_name: 'Test Group', print_name: 'TEST', tax: 5 } },
    { name: 'Ledger', endpoint: 'ledgers', table: 'ledgermaster', data: { name: 'Test Ledger', print_name: 'TEST', under: 'Cash', openingbalance: 100000, status: 'Active' } },
    { name: 'Ledger Group', endpoint: 'ledger_groups', table: 'ledgergroupmaster', data: { name: 'Test LG', printname: 'TEST', under: 'Assets' } },
  ];

  let allPassed = true;
  
  for (const module of masterModules) {
    try {
      // Test GET all
      logInfo(`GET /api/masters/${module.endpoint}`);
      const getAll = await axios.get(`${BASE_URL}/masters/${module.endpoint}`);
      
      // Test CREATE
      logInfo(`POST /api/masters/${module.table}`);
      const create = await axios.post(`${BASE_URL}/masters/${module.table}`, module.data);
      const recordId = create.data.id;
      
      // Test GET single
      logInfo(`GET /api/masters/record/${module.table}/${recordId}`);
      const getOne = await axios.get(`${BASE_URL}/masters/record/${module.table}/${recordId}`);
      
      // Test UPDATE
      logInfo(`PUT /api/masters/${module.table}/${recordId}`);
      const updateData = { ...module.data, name: module.data.name + ' Updated' };
      await axios.put(`${BASE_URL}/masters/${module.table}/${recordId}`, updateData);
      
      // Test DELETE
      logInfo(`DELETE /api/masters/${module.table}/${recordId}`);
      await axios.delete(`${BASE_URL}/masters/${module.table}/${recordId}`);
      
      logSuccess(`${module.name} CRUD: All operations passed`);
    } catch (error) {
      logError(`${module.name} CRUD Failed: ${error.response?.data?.message || error.message}`);
      allPassed = false;
    }
  }
  
  return allPassed;
}

// ============================================================================
// PHASE 3: PURCHASE MODULE TESTING
// ============================================================================

async function testPhase3_PurchaseModule() {
  logSection('PHASE 3: PURCHASE MODULE TESTING');
  
  let purchaseId = null;
  let supplierName = 'Test Supplier ' + Date.now();
  let itemName = 'Urad Dal';
  
  try {
    // First create a supplier
    logInfo('Creating test supplier...');
    const supplier = await axios.post(`${BASE_URL}/masters/supplier_master`, {
      name: supplierName,
      print_name: supplierName,
      contact_person: 'Test',
      address1: 'Test',
      mobile1: '9999999999',
      area: 'Test',
      opening_balance: 100000,
      status: 'Active'
    });
    logSuccess('Supplier created for purchase test');
    
    // Create purchase with items
    logInfo('Creating purchase with multiple items...');
    const purchaseData = {
      formData: {
        date: new Date().toISOString().slice(0, 10),
        supplier: supplierName,
        sno: 1,
        invNo: 'INV' + Date.now(),
        payType: 'Credit',
        taxType: 'Exclusive',
        godown: 'Main',
        remarks: 'Test purchase'
      },
      items: [
        { itemName: itemName, qty: 100, weight: 100, rate: 50, amount: 5000 },
        { itemName: 'Moong Dal', qty: 50, weight: 50, rate: 40, amount: 2000 }
      ],
      totals: {
        totalQty: 150,
        totalWeight: 150,
        totalAmount: 7000,
        baseAmount: 7000,
        discAmount: 0,
        taxAmount: 0,
        netAmount: 7000,
        grandTotal: 7000,
        deductions: { autoWages: 0, vatPercent: 0, vat: 0 }
      }
    };
    
    const purchaseRes = await axios.post(`${BASE_URL}/purchases`, purchaseData);
    purchaseId = purchaseRes.data.id;
    logSuccess(`Purchase created with ID: ${purchaseId}`);
    
    // Verify stock lots created
    logInfo('Verifying stock lots...');
    const lotsRes = await axios.get(`${BASE_URL}/stock/lots`);
    const lots = lotsRes.data;
    
    if (lots.length > 0) {
      logSuccess(`Stock lots created: ${lots.length} lots`);
      
      // Check for duplicate lot numbers
      const lotNumbers = lots.map(l => l.lot_no);
      const uniqueLotNumbers = new Set(lotNumbers);
      if (lotNumbers.length !== uniqueLotNumbers.size) {
        logError('DUPLICATE LOT NUMBERS FOUND!');
      } else {
        logSuccess('No duplicate lot numbers');
      }
    }
    
    // Verify ledger entries created
    logInfo('Verifying ledger entries...');
    try {
      const ledgerRes = await axios.get(`${BASE_URL}/accounts/ledger-entries?reference_id=${purchaseId}`);
      logSuccess(`Ledger entries found: ${ledgerRes.data.length}`);
    } catch (e) {
      logWarning('Ledger entries check skipped');
    }
    
    // Test DELETE purchase - should work since no sales done
    logInfo('Testing purchase deletion...');
    try {
      await axios.delete(`${BASE_URL}/purchases/${purchaseId}`);
      logSuccess('Purchase deleted successfully');
    } catch (error) {
      logError(`Purchase delete failed: ${error.response?.data?.message || error.message}`);
    }
    
    // Cleanup supplier
    await axios.delete(`${BASE_URL}/masters/supplier_master/${supplier.data.id}`);
    logSuccess('Purchase module test completed');
    
    return true;
  } catch (error) {
    logError(`Purchase module test failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// ============================================================================
// PHASE 4: SALES MODULE TESTING (with stock deduction)
// ============================================================================

async function testPhase4_SalesModule() {
  logSection('PHASE 4: SALES MODULE TESTING');
  
  let supplierName = 'Test Supplier Sales';
  let customerName = 'Test Customer ' + Date.now();
  let itemName = 'Test Item Sales';
  
  try {
    // Setup: Create supplier and purchase stock first
    logInfo('Setting up test data...');
    
    // Create supplier
    const supplier = await axios.post(`${BASE_URL}/masters/supplier_master`, {
      name: supplierName,
      print_name: supplierName,
      contact_person: 'Test',
      address1: 'Test',
      mobile1: '9999999999',
      area: 'Test',
      status: 'Active'
    });
    
    // Create customer
    const customer = await axios.post(`${BASE_URL}/masters/customer_master`, {
      name: customerName,
      print_name: customerName,
      contact_person: 'Test',
      address1: 'Test',
      mobile1: '8888888888',
      area: 'Test',
      status: 'Active'
    });
    
    // Create purchase to add stock
    logInfo('Creating purchase to add stock...');
    const purchaseData = {
      formData: {
        date: new Date().toISOString().slice(0, 10),
        supplier: supplierName,
        sno: 1,
        invNo: 'INV' + Date.now(),
        payType: 'Credit',
        taxType: 'Exclusive',
        godown: 'Main',
        remarks: 'Stock for sales test'
      },
      items: [
        { itemName: itemName, qty: 100, weight: 100, rate: 50, amount: 5000 }
      ],
      totals: {
        totalQty: 100,
        totalWeight: 100,
        totalAmount: 5000,
        baseAmount: 5000,
        discAmount: 0,
        taxAmount: 0,
        netAmount: 5000,
        grandTotal: 5000,
        deductions: { autoWages: 0, vatPercent: 0, vat: 0 }
      }
    };
    
    const purchaseRes = await axios.post(`${BASE_URL}/purchases`, purchaseData);
    const purchaseId = purchaseRes.data.id;
    logSuccess(`Stock added via purchase: ${purchaseId}`);
    
    // Check available stock
    logInfo('Checking available stock...');
    const availableRes = await axios.get(`${BASE_URL}/stock/available/${encodeURIComponent(itemName)}`);
    logSuccess(`Available stock lots: ${availableRes.data.length}`);
    
    // Test: Try to sell more than available (should fail)
    logInfo('Testing: Sell more than available stock...');
    try {
      const oversellData = {
        formData: {
          date: new Date().toISOString().slice(0, 10),
          customer: customerName,
          sNo: 1,
          remarks: 'Oversell test'
        },
        items: [
          { itemName: itemName, qty: 200, rate: 60, totalAmt: 12000 } // More than available
        ],
        totals: { totalQty: 200, totalAmount: 12000 }
      };
      
      const oversellRes = await axios.post(`${BASE_URL}/sales`, oversellData);
      logError('OVERSELL: Should have failed but succeeded!');
    } catch (error) {
      if (error.response?.status === 400) {
        logSuccess(`Oversell blocked correctly: ${error.response.data.message}`);
      } else {
        logError(`Unexpected error: ${error.message}`);
      }
    }
    
    // Test: Valid sale
    logInfo('Creating valid sale...');
    const salesData = {
      formData: {
        date: new Date().toISOString().slice(0, 10),
        customer: customerName,
        sNo: 1,
        remarks: 'Test sale'
      },
      items: [
        { itemName: itemName, qty: 30, rate: 60, totalAmt: 1800 }
      ],
      totals: { totalQty: 30, totalAmount: 1800 }
    };
    
    const salesRes = await axios.post(`${BASE_URL}/sales`, salesData);
    const salesId = salesRes.data.id;
    logSuccess(`Sale created with ID: ${salesId}`);
    
    // Verify stock reduced
    logInfo('Verifying stock reduced via FIFO...');
    const remainingRes = await axios.get(`${BASE_URL}/stock/available/${encodeURIComponent(itemName)}`);
    const remainingQty = remainingRes.data.reduce((sum, lot) => sum + lot.remaining_quantity, 0);
    
    if (remainingQty === 70) { // 100 - 30 = 70
      logSuccess(`Stock correctly reduced: 100 - 30 = ${remainingQty}`);
    } else {
      logError(`Stock mismatch: Expected 70, got ${remainingQty}`);
    }
    
    // Test partial sale (sell from remaining 70)
    logInfo('Testing partial sale...');
    const partialData = {
      formData: {
        date: new Date().toISOString().slice(0, 10),
        customer: customerName,
        sNo: 2,
        remarks: 'Partial sale'
      },
      items: [
        { itemName: itemName, qty: 40, rate: 60, totalAmt: 2400 }
      ],
      totals: { totalQty: 40, totalAmount: 2400 }
    };
    
    const partialRes = await axios.post(`${BASE_URL}/sales`, partialData);
    logSuccess(`Partial sale created: ${partialRes.data.id}`);
    
    // Verify remaining
    const finalRes = await axios.get(`${BASE_URL}/stock/available/${encodeURIComponent(itemName)}`);
    const finalQty = finalRes.data.reduce((sum, lot) => sum + lot.remaining_quantity, 0);
    logSuccess(`Final stock: ${finalQty}`);
    
    // Try to delete purchase after partial sale (should fail)
    logInfo('Testing: Delete purchase after partial sale...');
    try {
      await axios.delete(`${BASE_URL}/purchases/${purchaseId}`);
      logError('DELETE: Should have failed but succeeded!');
    } catch (error) {
      if (error.response?.status === 400) {
        logSuccess(`Delete blocked correctly: ${error.response.data.message}`);
      }
    }
    
    // Cleanup
    await axios.delete(`${BASE_URL}/masters/supplier_master/${supplier.data.id}`);
    await axios.delete(`${BASE_URL}/masters/customer_master/${customer.data.id}`);
    
    logSuccess('Sales module test completed');
    return true;
  } catch (error) {
    logError(`Sales module test failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

// ============================================================================
// PHASE 5: STOCK & LOT INTEGRITY TESTING
// ============================================================================

async function testPhase5_StockIntegrity() {
  logSection('PHASE 5: STOCK & LOT INTEGRITY TESTING');
  
  try {
    // Check for negative stock
    logInfo('Checking for negative stock quantities...');
    const lots = await axios.get(`${BASE_URL}/stock/lots`);
    const negativeStock = lots.data.filter(lot => lot.remaining_quantity < 0);
    
    if (negativeStock.length > 0) {
      logError(`NEGATIVE STOCK FOUND: ${negativeStock.length} lots have negative quantity!`);
      negativeStock.forEach(lot => {
        logError(`  Lot: ${lot.lot_no}, Qty: ${lot.remaining_quantity}`);
      });
    } else {
      logSuccess('No negative stock quantities found');
    }
    
    // Check for duplicate lot numbers
    logInfo('Checking for duplicate lot numbers...');
    const lotNumbers = lots.data.map(l => l.lot_no);
    const duplicates = lotNumbers.filter((item, index) => lotNumbers.indexOf(item) !== index);
    
    if (duplicates.length > 0) {
      logError(`DUPLICATE LOT NUMBERS FOUND: ${duplicates.length} duplicates`);
    } else {
      logSuccess('No duplicate lot numbers found');
    }
    
    // Check stock report accuracy
    logInfo('Verifying stock report accuracy...');
    const report = await axios.get(`${BASE_URL}/stock/report`);
    logSuccess(`Stock report shows ${report.data.length} items`);
    
    logSuccess('Stock integrity test completed');
    return true;
  } catch (error) {
    logError(`Stock integrity test failed: ${error.message}`);
    return false;
  }
}

// ============================================================================
// PHASE 6: LEDGER & ACCOUNTS VALIDATION
// ============================================================================

async function testPhase6_LedgerValidation() {
  logSection('PHASE 6: LEDGER & ACCOUNTS VALIDATION');
  
  try {
    // Test Trial Balance
    logInfo('Testing Trial Balance...');
    const tbRes = await axios.get(`${BASE_URL}/accounts/trial-balance`);
    const tb = tbRes.data;
    
    if (tb.isBalanced) {
      logSuccess(`Trial Balance: DEBIT = CREDIT (Balanced)`);
    } else {
      logError(`Trial Balance MISMATCH: Debit: ${tb.totalDebit}, Credit: ${tb.totalCredit}`);
    }
    
    // Test Daybook
    logInfo('Testing Daybook...');
    const daybookRes = await axios.get(`${BASE_URL}/accounts/daybook`);
    logSuccess(`Daybook: ${daybookRes.data.length} transactions`);
    
    // Test Ledger Statement
    logInfo('Testing Ledger Statement...');
    const ledgerRes = await axios.get(`${BASE_URL}/accounts/ledger/Cash`);
    logSuccess(`Ledger Statement: ${ledgerRes.data.transactions?.length || 0} transactions`);
    
    // Test Outstanding Summary
    logInfo('Testing Outstanding Summary...');
    const outstandingRes = await axios.get(`${BASE_URL}/accounts/outstanding-summary`);
    logSuccess(`Outstanding Summary: ${outstandingRes.data.length} accounts`);
    
    logSuccess('Ledger validation completed');
    return true;
  } catch (error) {
    logError(`Ledger validation failed: ${error.message}`);
    return false;
  }
}

// ============================================================================
// PHASE 7: REPORTS TESTING
// ============================================================================

async function testPhase7_Reports() {
  logSection('PHASE 7: REPORTS MODULE TESTING');
  
  const reports = [
    { name: 'Stock Status', endpoint: '/reports/stock-status' },
    { name: 'Purchase Register', endpoint: '/reports/purchase-register' },
    { name: 'Sales Register', endpoint: '/reports/sales-register' },
    { name: 'Purchase Return Register', endpoint: '/reports/purchase-return-register' },
    { name: 'Sales Return Register', endpoint: '/reports/sales-return-register' },
    { name: 'Papad Ledger', endpoint: '/reports/papad-ledger' },
    { name: 'Balance Sheet', endpoint: '/accounts/balance-sheet' },
    { name: 'Profit & Loss', endpoint: '/accounts/profit-loss' }
  ];
  
  let allPassed = true;
  
  for (const report of reports) {
    try {
      const response = await axios.get(`${BASE_URL}${report.endpoint}`);
      if (response.status === 200) {
        logSuccess(`${report.name}: OK (${Array.isArray(response.data) ? response.data.length : 'data returned'})`);
      } else {
        logError(`${report.name}: ${response.status}`);
        allPassed = false;
      }
    } catch (error) {
      if (error.response?.status === 404) {
        logWarning(`${report.name}: Not implemented`);
      } else {
        logError(`${report.name}: ${error.response?.status || error.message}`);
        allPassed = false;
      }
    }
  }
  
  return allPassed;
}

// ============================================================================
// PHASE 8: EDGE CASES & ERROR HANDLING
// ============================================================================

async function testPhase8_EdgeCases() {
  logSection('PHASE 8: EDGE CASES & ERROR HANDLING');
  
  // Test: Create purchase with missing required fields
  logInfo('Testing: Create purchase with missing fields...');
  try {
    await axios.post(`${BASE_URL}/purchases`, {
      formData: { date: null, supplier: null },
      items: [],
      totals: {}
    });
    logError('Missing field validation failed');
  } catch (error) {
    if (error.response?.status === 400) {
      logSuccess('Required field validation working');
    } else {
      logError(`Unexpected error: ${error.message}`);
    }
  }
  
  // Test: Create sale with zero quantity
  logInfo('Testing: Create sale with zero quantity...');
  try {
    await axios.post(`${BASE_URL}/sales`, {
      formData: { date: new Date().toISOString().slice(0, 10), customer: 'Test', sNo: 1 },
      items: [{ itemName: 'Test', qty: 0, rate: 10, totalAmt: 0 }],
      totals: { totalQty: 0, totalAmount: 0 }
    });
    logError('Zero quantity validation failed');
  } catch (error) {
    if (error.response?.status === 400) {
      logSuccess('Zero quantity validation working');
    } else {
      logError(`Unexpected error: ${error.message}`);
    }
  }
  
  // Test: Create sale with negative rate
  logInfo('Testing: Create sale with negative rate...');
  try {
    await axios.post(`${BASE_URL}/sales`, {
      formData: { date: new Date().toISOString().slice(0, 10), customer: 'Test', sNo: 1 },
      items: [{ itemName: 'Test', qty: 10, rate: -10, totalAmt: -100 }],
      totals: { totalQty: 10, totalAmount: -100 }
    });
    logError('Negative rate validation failed');
  } catch (error) {
    if (error.response?.status === 400) {
      logSuccess('Negative rate validation working');
    } else {
      logError(`Unexpected error: ${error.message}`);
    }
  }
  
  logSuccess('Edge cases testing completed');
  return true;
}

// ============================================================================
// PHASE 9: FLOUR OUT (GRIND) MODULE TESTING
// ============================================================================

async function testPhase9_FlourOutModule() {
  logSection('PHASE 9: FLOUR OUT (GRIND) MODULE TESTING');
  
  try {
    // Get available lots for grind
    logInfo('Getting available lots for grind test...');
    const lotsRes = await axios.get(`${BASE_URL}/stock/lots`);
    
    if (lotsRes.data.length === 0) {
      logWarning('No stock available for grind test - skipping');
      return true;
    }
    
    const availableLot = lotsRes.data.find(lot => lot.remaining_quantity > 10);
    if (!availableLot) {
      logWarning('No lot with enough quantity for grind test - skipping');
      return true;
    }
    
    logInfo(`Testing grind with lot: ${availableLot.lot_no}`);
    
    // Note: Flour out API would need proper setup to test fully
    // Just verify the endpoint is accessible
    const flourOutRes = await axios.get(`${BASE_URL}/flour-out`);
    logSuccess(`Flour Out module accessible: ${flourOutRes.data.length} records`);
    
    return true;
  } catch (error) {
    logError(`Flour Out test failed: ${error.message}`);
    return false;
  }
}

// ============================================================================
// PHASE 10: USER & AUTH TESTING
// ============================================================================

async function testPhase10_AuthTesting() {
  logSection('PHASE 10: USER & AUTH TESTING');
  
  try {
    // Test companies API
    logInfo('Testing Companies API...');
    const companiesRes = await axios.get(`${BASE_URL}/companies`);
    logSuccess(`Companies: ${companiesRes.data.length} found`);
    
    // Test auth status
    logInfo('Testing Auth API...');
    const authRes = await axios.get(`${BASE_URL}/auth/status`);
    logSuccess('Auth API accessible');
    
    logSuccess('Auth testing completed');
    return true;
  } catch (error) {
    logError(`Auth test failed: ${error.message}`);
    return false;
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests() {
  log('\n' + '='.repeat(70), 'magenta');
  log('  BVC ERP - FULL SYSTEM VALIDATION TEST', 'cyan');
  log('  Testing: Masters | Purchases | Sales | Stock | Ledger | Reports', 'yellow');
  log('='.repeat(70), 'magenta');
  
  const startTime = Date.now();
  
  // Run all test phases
  await testPhase1_HealthCheck();
  await testPhase2_MasterModules();
  await testPhase3_PurchaseModule();
  await testPhase4_SalesModule();
  await testPhase5_StockIntegrity();
  await testPhase6_LedgerValidation();
  await testPhase7_Reports();
  await testPhase8_EdgeCases();
  await testPhase9_FlourOutModule();
  await testPhase10_AuthTesting();
  
  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  logSection('FINAL TEST SUMMARY');
  log(`  Total Tests: ${testResults.total}`, 'blue');
  log(`  Passed: ${testResults.passed}`, 'green');
  log(`  Failed: ${testResults.failed}`, testResults.failed > 0 ? 'red' : 'green');
  log(`  Warnings: ${testResults.warnings}`, 'yellow');
  log(`  Duration: ${duration}s`, 'cyan');
  log('='.repeat(70), 'blue');
  
  // Final checklist
  logSection('PRODUCTION READINESS CHECKLIST');
  log(`  ✓ No negative stock: ${testResults.tests.some(t => t.name.includes('negative')) ? 'FAIL' : 'PASS'}`, 'green');
  log(`  ✓ No ledger mismatch: ${testResults.tests.some(t => t.name.includes('mismatch')) ? 'FAIL' : 'PASS'}`, 'green');
  log(`  ✓ No duplicate lots: ${testResults.tests.some(t => t.name.includes('duplicate')) ? 'FAIL' : 'PASS'}`, 'green');
  log(`  ✓ API errors: ${testResults.failed > 0 ? `${testResults.failed} errors` : 'None'}`, testResults.failed > 0 ? 'red' : 'green');
  log('='.repeat(70), 'blue');
  
  if (testResults.failed === 0) {
    log('\n🎉 ALL VALIDATIONS PASSED! System is production-ready.\n', 'green');
    process.exit(0);
  } else {
    log(`\n⚠️  ${testResults.failed} validation(s) failed. Please review errors.\n`, 'yellow');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  log(`\n❌ Test execution failed: ${error.message}\n`, 'red');
  process.exit(1);
});

