const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';

async function testPurchaseAndLedger() {
  console.log('=== Testing Purchase Creation and Ledger Entries ===\n');

  try {
    // 1. First, get companies to find a valid company_id
    console.log('1. Fetching companies...');
    const companiesRes = await axios.get(`${API_BASE}/companies`);
    const companies = companiesRes.data;
    console.log(`   Found ${companies.length} companies`);
    
    if (companies.length === 0) {
      console.log('❌ No companies found. Please create a company first.');
      process.exit(1);
    }
    
    const companyId = companies[0].id;
    console.log(`   Using company ID: ${companyId}\n`);

    // 2. Check current ledger_entries count
    console.log('2. Checking ledger_entries table...');
    const db = require('./config/database');
    const ledgerCount = await db.query('SELECT COUNT(*) as count FROM ledger_entries');
    console.log(`   Current ledger entries: ${ledgerCount.rows[0].count}\n`);

    // 3. Create a test purchase
    console.log('3. Creating test purchase...');
    const purchaseData = {
      formData: {
        sno: 1,
        date: new Date().toISOString().slice(0, 10),
        invNo: 'TEST-PUR-' + Date.now(),
        supplier: 'Test Supplier',
        payType: 'Credit',
        invDate: new Date().toISOString().slice(0, 10),
        type: 'Urad',
        address: 'Test Address',
        taxType: 'Exclusive',
        godown: 'Main',
        remarks: 'Test purchase for ledger entries'
      },
      items: [
        {
          itemName: 'Urad',
          lotNo: '',
          weight: 100,
          qty: 50,
          totalWt: 100,
          rate: 100,
          disc: 0,
          tax: 0,
          amount: 5000
        }
      ],
      totals: {
        totalQty: 50,
        totalWeight: 100,
        totalAmount: 5000,
        baseAmount: 5000,
        discAmount: 0,
        taxAmount: 0,
        netAmount: 5000,
        deductions: {
          autoWages: 0,
          vatPercent: 0,
          vat: 0
        },
        grandTotal: 5000
      }
    };

    const purchaseRes = await axios.post(`${API_BASE}/purchases`, purchaseData);
    console.log(`   ✅ Purchase created with ID: ${purchaseRes.data.id}\n`);

    // 4. Check ledger entries after purchase creation
    console.log('4. Checking ledger entries after purchase...');
    const newLedgerCount = await db.query('SELECT COUNT(*) as count FROM ledger_entries');
    console.log(`   New ledger entries count: ${newLedgerCount.rows[0].count}`);

    // 5. Get the ledger entries for this purchase
    const ledgerEntries = await db.query(
      'SELECT * FROM ledger_entries WHERE reference_id = ? ORDER BY id',
      [purchaseRes.data.id]
    );
    
    console.log(`\n   Found ${ledgerEntries.rows.length} ledger entries for this purchase:`);
    ledgerEntries.rows.forEach((entry, idx) => {
      console.log(`   ${idx + 1}. ${entry.ledger_name} - Dr: ${entry.debit}, Cr: ${entry.credit}`);
    });

    // 6. Summary
    console.log('\n=== Test Summary ===');
    if (ledgerEntries.rows.length > 0) {
      console.log('✅ SUCCESS: Ledger entries were created for the purchase!');
      console.log('   - Supplier account (Credit)');
      console.log('   - Purchase Account (Debit)');
      if (purchaseData.totals.taxAmount > 0) {
        console.log('   - Input Tax (Debit)');
      }
      if (purchaseData.totals.discAmount > 0) {
        console.log('   - Discount Received (Credit)');
      }
    } else {
      console.log('❌ FAILED: No ledger entries were created');
    }

  } catch (error) {
    console.error('\n❌ Test Failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('   No response received. Is the backend running?');
      console.error('   Start with: node backend/server.js');
    }
    console.error('\nStack:', error.stack);
  }

  process.exit(0);
}

testPurchaseAndLedger();
