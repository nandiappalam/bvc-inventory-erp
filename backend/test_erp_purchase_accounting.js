const axios = require('axios');
const db = require('./config/database');

const API_BASE = 'http://localhost:3000/api';

async function testErpAccounting() {
  console.log('=== Testing Purchase Double-Entry Accounting (User Illustrative Scenario) ===\n');

  try {
    const purchasePayload = {
      formData: {
        sno: 999,
        date: '2026-10-31',
        invNo: 'PUR-0001-TEST',
        supplier: 'ABC Traders',
        payType: 'Credit',
        taxType: 'Exclusive',
        tax_percent: 5,
        type: 'Urad',
        godown: 'Main Godown',
        transporter: 'SRS Transports',
        transport_charges: 5000,
        transport_payable_type: 'SEPARATE',
        loadman_name: 'Murugan Loadman',
        loadman_charges: 1000,
        loadman_payable_type: 'SEPARATE',
        remarks: 'Test purchase matching user specifications'
      },
      items: [
        {
          item_name: 'Urad Whole',
          qty: 1000,
          weight: 100,
          total_wt: 1000,
          rate: 100,
          disc_percent: 0,
          tax_percent: 5,
          amount: 100000
        }
      ],
      totals: {
        totalQty: 1000,
        totalWeight: 1000,
        baseAmount: 100000,
        taxable: 100000,
        taxAmount: 5000,
        cgstAmount: 2500,
        sgstAmount: 2500,
        igstAmount: 0,
        discAmount: 0,
        netAmount: 105000,
        totalDeductions: 2000,
        grandTotal: 109000
      },
      deductions: [
        {
          deduction_name: 'Quality / Shortage Deduction',
          amount: 2000,
          type: 'LESS',
          calc_type: 'Fixed'
        }
      ]
    };

    console.log('1. Submitting Purchase PUR-0001...');
    const createRes = await axios.post(`${API_BASE}/purchases`, purchasePayload);
    const purchaseId = createRes.data.id;
    console.log(`   ✅ Purchase created successfully with ID: ${purchaseId}\n`);

    console.log('2. Fetching Purchase Ledger Statement (/api/purchases/:id/ledger-statement)...');
    const statementRes = await axios.get(`${API_BASE}/purchases/${purchaseId}/ledger-statement`);
    const stmt = statementRes.data.data;

    console.log(`\n--- VOUCHER: ${stmt.voucher.voucher_no} ---`);
    console.log(`Supplier: ${stmt.voucher.supplier} | Date: ${stmt.voucher.date}`);
    console.log(`Total Debit: ₹${stmt.totals.debit_total.toLocaleString('en-IN')}`);
    console.log(`Total Credit: ₹${stmt.totals.credit_total.toLocaleString('en-IN')}`);
    console.log(`Is Balanced (Dr == Cr): ${stmt.totals.is_balanced ? '✅ YES' : '❌ NO'}`);

    console.log('\n--- JOURNAL ENTRIES ---');
    stmt.journal_entries.forEach(entry => {
      const dr = entry.debit > 0 ? `₹${entry.debit.toLocaleString('en-IN')}` : '—';
      const cr = entry.credit > 0 ? `₹${entry.credit.toLocaleString('en-IN')}` : '—';
      console.log(`[${entry.no}] ${entry.ledger_name.padEnd(35)} | Dr: ${dr.padStart(10)} | Cr: ${cr.padStart(10)} | ${entry.particulars}`);
    });

    console.log('\n--- PARTY OUTSTANDING BALANCES ---');
    console.log(`Supplier (${stmt.party_balances.supplier.name}) Outstanding: ₹${stmt.party_balances.supplier.outstanding.toLocaleString('en-IN')} Cr`);
    console.log(`Transporter (${stmt.party_balances.transporter.name}) Outstanding: ₹${stmt.party_balances.transporter.outstanding.toLocaleString('en-IN')} Cr`);
    console.log(`Loadman (${stmt.party_balances.loadman.name}) Outstanding: ₹${stmt.party_balances.loadman.outstanding.toLocaleString('en-IN')} Cr`);
    console.log(`TOTAL OUTSTANDING: ₹${stmt.party_balances.total_outstanding.toLocaleString('en-IN')} Cr`);

    if (stmt.totals.is_balanced && stmt.party_balances.supplier.outstanding === 103000 && stmt.party_balances.total_outstanding === 109000) {
      console.log('\n🎉 ALL DOUBLE-ENTRY ACCOUNTING RULES PASSED PERFECTLY!');
    } else {
      console.log('\n⚠️ Check calculations: expected supplier 103000, total 109000');
    }

  } catch (error) {
    console.error('Test Failed:', error.response ? error.response.data : error.message);
  }
}

testErpAccounting();
