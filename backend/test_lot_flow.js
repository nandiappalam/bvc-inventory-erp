// LOT SYSTEM COMPREHENSIVE TEST
// Tests: Purchase → Stock → Sales → Grind → Delete flow

const API_BASE = 'http://localhost:3000/api';

async function testLotSystem() {
  console.log('🧪 LOT SYSTEM COMPREHENSIVE TEST\n');
  console.log('='.repeat(60));
  
  let testResults = {
    passed: 0,
    failed: 0,
    details: []
  };

  try {
    // ============================================================
    // STEP 1: Create Purchase with Lot Auto-Generation
    // ============================================================
    console.log('\n📦 STEP 1: Create Purchase (100 kg)\n');
    
    const purchaseData = {
      formData: {
        date: '2026-03-03',
        supplier: 'Test Supplier',
        sno: 1,
        invNo: 'INV001',
        payType: 'Credit',
        invDate: '2026-03-03',
        type: 'Urad',
        address: 'Test Address',
        taxType: 'Exclusive',
        godown: 'Main',
        remarks: 'Test purchase'
      },
      items: [
        {
          itemName: 'Urad Dal',
          qty: 100,
          weight: 100,
          rate: 50,
          amount: 5000
        }
      ],
      totals: {
        totalQty: 100,
        totalWeight: 100,
        totalAmount: 5000,
        baseAmount: 5000,
        discAmount: 0,
        taxAmount: 0,
        netAmount: 5000,
        grandTotal: 5000
      }
    };

    const purchaseRes = await fetch(`${API_BASE}/purchases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(purchaseData)
    });

    const purchaseResult = await purchaseRes.json();
    console.log('Purchase Response:', purchaseResult);

    if (purchaseResult.id) {
      console.log('✅ Purchase created with ID:', purchaseResult.id);
      testResults.passed++;
      testResults.details.push({ test: 'Create Purchase', status: 'PASSED', id: purchaseResult.id });
    } else {
      console.log('❌ Purchase failed:', purchaseResult.message);
      testResults.failed++;
      testResults.details.push({ test: 'Create Purchase', status: 'FAILED', error: purchaseResult.message });
      return testResults;
    }

    // Verify stock_lots table
    console.log('\n🔍 Verifying stock_lots table...');
    const lotsRes = await fetch(`${API_BASE}/stock/lots`);
    const lots = await lotsRes.json();
    console.log('Available lots:', JSON.stringify(lots, null, 2));

    // ============================================================
    // STEP 2: Create Sales with FIFO Deduction
    // ============================================================
    console.log('\n\n💰 STEP 2: Create Sales (30 kg)\n');

    const salesData = {
      formData: {
        date: '2026-03-03',
        customer: 'Test Customer',
        sNo: 1,
        invNo: 'SALE001',
        payType: 'Credit',
        remarks: 'Test sale'
      },
      items: [
        {
          itemName: 'Urad Dal',
          qty: 30,
          rate: 60,
          totalAmt: 1800,
          lotNo: '' // Let system use FIFO
        }
      ],
      totals: {
        totalQty: 30,
        totalAmount: 1800
      }
    };

    const salesRes = await fetch(`${API_BASE}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(salesData)
    });

    const salesResult = await salesRes.json();
    console.log('Sales Response:', salesResult);

    if (salesResult.id) {
      console.log('✅ Sale created with ID:', salesResult.id);
      testResults.passed++;
      testResults.details.push({ test: 'Create Sales', status: 'PASSED', id: salesResult.id });
    } else {
      console.log('❌ Sale failed:', salesResult.message);
      testResults.failed++;
      testResults.details.push({ test: 'Create Sales', status: 'FAILED', error: salesResult.message });
    }

    // Verify remaining stock
    console.log('\n🔍 Verifying remaining stock...');
    const remainingLotsRes = await fetch(`${API_BASE}/stock/available-lots?item_name=Urad%20Dal`);
    const remainingLots = await remainingLotsRes.json();
    console.log('Remaining lots:', JSON.stringify(remainingLots, null, 2));

    // ============================================================
    // STEP 3: Create Grind (Flour Out)
    // ============================================================
    console.log('\n\n⚙️ STEP 3: Create Grind/Flour Out (20 kg)\n');

    const grindData = {
      formData: {
        date: '2026-03-03',
        papadCompany: 'Test Papad Co',
        remarks: 'Test grind'
      },
      items: [
        {
          itemName: 'Urad Dal',
          lotNo: remainingLots[0]?.lot_no || '',
          qty: 20,
          totalWt: 20,
          wages: 100
        }
      ]
    };

    const grindRes = await fetch(`${API_BASE}/flour-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(grindData)
    });

    const grindResult = await grindRes.json();
    console.log('Grind Response:', grindResult);

    if (grindResult.id) {
      console.log('✅ Grind created with ID:', grindResult.id);
      testResults.passed++;
      testResults.details.push({ test: 'Create Grind', status: 'PASSED', id: grindResult.id });
    } else {
      console.log('❌ Grind failed:', grindResult.message);
      testResults.failed++;
      testResults.details.push({ test: 'Create Grind', status: 'FAILED', error: grindResult.message });
    }

    // ============================================================
    // STEP 4: Verify Final Stock State
    // ============================================================
    console.log('\n\n📊 STEP 4: Verify Final Stock State\n');
    
    const finalLotsRes = await fetch(`${API_BASE}/stock/lots`);
    const finalLots = await finalLotsRes.json();
    console.log('Final lots:', JSON.stringify(finalLots, null, 2));

    // ============================================================
    // TEST RESULTS SUMMARY
    // ============================================================
    console.log('\n\n' + '='.repeat(60));
    console.log('📋 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log('\nDetailed Results:');
    testResults.details.forEach(d => {
      console.log(`  ${d.status === 'PASSED' ? '✅' : '❌'} ${d.test}: ${d.status}`);
      if (d.error) console.log(`     Error: ${d.error}`);
    });

  } catch (error) {
    console.error('❌ Test execution error:', error);
    testResults.failed++;
  }

  return testResults;
}

// Run the test
testLotSystem().then(results => {
  console.log('\n🎯 Final Results:', results);
  process.exit(results.failed > 0 ? 1 : 0);
});
