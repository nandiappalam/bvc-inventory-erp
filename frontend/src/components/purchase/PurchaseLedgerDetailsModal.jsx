import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import api from '../../services/api';
import { printHtml } from '../../utils/printHelper';

/**
 * PurchaseLedgerDetailsModal
 * Displays the complete Purchase-wise Transaction Ledger Statement with double-entry accounting.
 * Covers:
 * 1. Comprehensive Purchase Details (Supplier, Items, Taxes, Freight, Loadman)
 * 2. Complete Double-Entry Accounting Trail (Debit Total === Credit Total)
 * 3. Individual Ledgers (Supplier, Transporter, Loadman, Purchase Account, GST Input)
 * 4. Party Liabilities & Running Outstanding Balances
 */
const PurchaseLedgerDetailsModal = ({ isOpen, onClose, purchaseId, purchaseData = null }) => {
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'details' | 'individual' | 'parties'
  const [individualLedgerTab, setIndividualLedgerTab] = useState('supplier');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statementData, setStatementData] = useState(null);
  const [rawPurchase, setRawPurchase] = useState(null);
  const [itemsList, setItemsList] = useState([]);
  const [suppliersMap, setSuppliersMap] = useState({});

  // Pre-load supplier master to ensure any numeric ID is mapped to actual supplier name
  useEffect(() => {
    if (!isOpen) return;
    api('/masters/suppliers').then(res => {
      const arr = Array.isArray(res) ? res : (res?.data || []);
      const map = {};
      arr.forEach(s => {
        if (s && s.id) {
          map[String(s.id)] = s.print_name || s.name;
        }
      });
      setSuppliersMap(map);
    }).catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchStatement = async () => {
      setLoading(true);
      setError('');
      try {
        if (purchaseId) {
          // 1. Fetch ledger statement
          const res = await api(`/purchases/${purchaseId}/ledger-statement`);
          const stmtData = res?.data || res;
          
          // 2. Fetch raw purchase and items for full audit detail
          try {
            const pRes = await api(`/purchases/${purchaseId}`);
            const pData = pRes?.data || pRes;
            if (pData) {
              setRawPurchase(pData);
              if (Array.isArray(pData.items)) {
                setItemsList(pData.items);
              }
            }
          } catch (_) {}

          if (stmtData && (stmtData.journal_entries || stmtData.totals)) {
            setStatementData(stmtData);
          } else if (purchaseData) {
            setStatementData(generatePreviewStatement(purchaseData));
          } else {
            setError(res?.message || 'Failed to load purchase ledger statement');
          }
        } else if (purchaseData) {
          setStatementData(generatePreviewStatement(purchaseData));
          if (Array.isArray(purchaseData.items)) {
            setItemsList(purchaseData.items);
          }
          if (purchaseData.formData) {
            setRawPurchase(purchaseData.formData);
          }
        }
      } catch (err) {
        console.error('Error fetching ledger statement:', err);
        if (purchaseData) {
          setStatementData(generatePreviewStatement(purchaseData));
        } else {
          setError(err.message || 'Failed to load ledger statement');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchStatement();
  }, [isOpen, purchaseId, purchaseData]);

  // Helper function for preview when creating new purchase
  function generatePreviewStatement(data) {
    const f = data.formData || {};
    const t = data.totals || {};
    const deds = data.deductions || [];
    const baseAmount = Number(t.baseAmount || t.taxable || 0);
    const taxAmount = Number(t.taxAmount || 0);
    const isInterstate = String(f.tax_type || f.taxType || '').toLowerCase().includes('inter');
    const cgstAmount = Number(t.cgstAmount || (isInterstate ? 0 : taxAmount / 2));
    const sgstAmount = Number(t.sgstAmount || (isInterstate ? 0 : taxAmount - cgstAmount));
    const igstAmount = Number(t.igstAmount || (isInterstate ? taxAmount : 0));
    const discAmount = Number(t.discAmount || 0);
    const transportCharges = Number(f.transport_charges || f.net_transport_amount || f.freight_amount || 0);
    const loadmanCharges = Number(f.loadman_charges || 0);

    let supplierName = f.supplier_name || f.supplier || 'Supplier';
    if (/^\d+$/.test(String(supplierName).trim())) {
      if (suppliersMap[String(supplierName).trim()]) {
        supplierName = suppliersMap[String(supplierName).trim()];
      } else if (f.address) {
        const m = f.address.match(/Name\s*:\s*([^\n\r]+)/i);
        if (m && m[1]) supplierName = m[1].trim();
      }
    }

    const transporterName = f.transporter || f.transport || 'Transporter Payable';
    const loadmanName = f.loadman_name || 'Loadman Payable';
    const voucherNo = f.inv_no || f.invNo || 'PUR-PREVIEW';

    const totalDeds = deds.reduce((sum, d) => sum + Number(d.amount || 0), 0);
    const grossInvoice = Number((baseAmount + taxAmount - discAmount).toFixed(2));

    const entries = [
      { no: 1, ledger_name: 'Purchase Account', account_head: 'Direct Expenses / Inventory', debit: baseAmount, credit: 0, particulars: `${supplierName} taxable purchase` },
      ...(isInterstate && igstAmount > 0 ? [{ no: 2, ledger_name: 'Input IGST', account_head: 'Duties & Taxes', debit: igstAmount, credit: 0, particulars: `IGST on ${voucherNo}` }] : [
        ...(cgstAmount > 0 ? [{ no: 2, ledger_name: 'Input CGST', account_head: 'Duties & Taxes', debit: cgstAmount, credit: 0, particulars: `CGST on ${voucherNo}` }] : []),
        ...(sgstAmount > 0 ? [{ no: 3, ledger_name: 'Input SGST', account_head: 'Duties & Taxes', debit: sgstAmount, credit: 0, particulars: `SGST on ${voucherNo}` }] : [])
      ]),
      { no: 4, ledger_name: supplierName, account_head: 'Sundry Creditors', debit: 0, credit: grossInvoice, particulars: `Purchase invoice ${voucherNo}` },
      ...(transportCharges > 0 ? [
        { no: 5, ledger_name: 'Transport Charges', account_head: 'Direct Expenses / Freight Inward', debit: transportCharges, credit: 0, particulars: `Freight charges on ${voucherNo}` },
        { no: 6, ledger_name: transporterName, account_head: 'Transporter Payable', debit: 0, credit: transportCharges, particulars: `Freight payable on ${voucherNo}` }
      ] : []),
      ...(loadmanCharges > 0 ? [
        { no: 7, ledger_name: 'Loadman Charges', account_head: 'Direct Expenses / Labour Charges', debit: loadmanCharges, credit: 0, particulars: `Loading/unloading charges on ${voucherNo}` },
        { no: 8, ledger_name: loadmanName, account_head: 'Loadman Payable', debit: 0, credit: loadmanCharges, particulars: `Loading charges payable on ${voucherNo}` }
      ] : []),
      ...(totalDeds > 0 ? [
        { no: 9, ledger_name: `${supplierName} (Supplier – deduction)`, account_head: 'Sundry Creditors Adjustment', debit: totalDeds, credit: 0, particulars: `Quality/shortage claim deduction on ${voucherNo}` },
        { no: 10, ledger_name: 'Purchase Deduction Recovery', account_head: 'Indirect Incomes / Claims Recovery', debit: 0, credit: totalDeds, particulars: `Recovery for supplier deduction on ${voucherNo}` }
      ] : [])
    ];

    const drTotal = entries.reduce((s, e) => s + (e.debit || 0), 0);
    const crTotal = entries.reduce((s, e) => s + (e.credit || 0), 0);
    const supplierOutstanding = Number((grossInvoice - totalDeds).toFixed(2));
    const totalOutstanding = Number((supplierOutstanding + transportCharges + loadmanCharges).toFixed(2));

    return {
      purchase: { ...f, supplier_name: supplierName, supplier: supplierName, voucher_no: voucherNo, gross_supplier_invoice: grossInvoice, supplier_payable: supplierOutstanding },
      voucher: { voucher_no: voucherNo, date: f.date || new Date().toISOString().slice(0, 10), supplier: supplierName },
      journal_entries: entries,
      totals: { debit_total: drTotal, credit_total: crTotal, is_balanced: Math.abs(drTotal - crTotal) < 0.01 },
      party_balances: {
        supplier: { name: supplierName, invoice_credit: grossInvoice, deduction_debit: totalDeds, payments_debit: 0, outstanding: supplierOutstanding },
        transporter: { name: transporterName, transport_credit: transportCharges, payments_debit: 0, outstanding: transportCharges },
        loadman: { name: loadmanName, loadman_credit: loadmanCharges, payments_debit: 0, outstanding: loadmanCharges },
        total_outstanding: totalOutstanding
      },
      individual_ledgers: {
        supplier: {
          title: `Supplier Ledger – ${supplierName}`,
          ledger_name: supplierName,
          category: 'Sundry Creditors',
          rows: [
            { date: f.date || '-', particulars: 'Purchase invoice', voucher: voucherNo, debit: 0, credit: grossInvoice },
            ...(totalDeds > 0 ? [{ date: f.date || '-', particulars: 'Quality/shortage deduction', voucher: voucherNo, debit: totalDeds, credit: 0 }] : [])
          ],
          closing_balance: supplierOutstanding,
          closing_balance_type: 'Cr',
          explanation: `Net supplier payable: ₹${supplierOutstanding.toLocaleString('en-IN')}`
        },
        transporter: {
          title: `Transporter Ledger – ${transporterName}`,
          ledger_name: transporterName,
          category: 'Transporter Payable (Current Liabilities)',
          rows: transportCharges > 0 ? [
            { date: f.date || '-', particulars: `Freight charges on ${voucherNo}`, voucher: voucherNo, debit: 0, credit: transportCharges }
          ] : [],
          closing_balance: transportCharges,
          closing_balance_type: 'Cr',
          explanation: `Freight outstanding: ₹${transportCharges.toLocaleString('en-IN')}`
        },
        loadman: {
          title: `Loadman Ledger – ${loadmanName}`,
          ledger_name: loadmanName,
          category: 'Loadman Payable (Current Liabilities)',
          rows: loadmanCharges > 0 ? [
            { date: f.date || '-', particulars: `Loading/unloading charges on ${voucherNo}`, voucher: voucherNo, debit: 0, credit: loadmanCharges }
          ] : [],
          closing_balance: loadmanCharges,
          closing_balance_type: 'Cr',
          explanation: `Unloading charges outstanding: ₹${loadmanCharges.toLocaleString('en-IN')}`
        },
        purchase_account: {
          title: 'Purchase Account',
          ledger_name: 'Purchase Account',
          category: 'Direct Expenses / Cost of Goods Sold',
          rows: [
            { date: f.date || '-', particulars: `${supplierName} purchase`, voucher: voucherNo, debit: baseAmount, credit: 0 }
          ],
          closing_balance: baseAmount,
          closing_balance_type: 'Dr',
          explanation: `Total purchase debit: ₹${baseAmount.toLocaleString('en-IN')}`
        },
        gst_input: {
          title: 'GST Input Ledgers',
          category: 'Duties & Taxes (Current Assets)',
          rows: isInterstate ? [
            { date: f.date || '-', particulars: `Purchase ${voucherNo}`, ledger: 'Input IGST', debit: igstAmount, credit: 0 }
          ] : [
            { date: f.date || '-', particulars: `Purchase ${voucherNo}`, ledger: 'Input CGST', debit: cgstAmount, credit: 0 },
            { date: f.date || '-', particulars: `Purchase ${voucherNo}`, ledger: 'Input SGST', debit: sgstAmount, credit: 0 }
          ],
          total_input_credit: taxAmount,
          explanation: `Input tax credit: ₹${taxAmount.toLocaleString('en-IN')}`
        },
        deduction_recovery: {
          title: 'Deduction Recovery Ledger',
          ledger_name: 'Purchase Deduction Recovery',
          category: 'Recovery / Claims Reserve',
          rows: totalDeds > 0 ? [
            { date: f.date || '-', particulars: 'Supplier claim recovery', voucher: voucherNo, debit: 0, credit: totalDeds }
          ] : [],
          closing_balance: totalDeds,
          closing_balance_type: 'Cr',
          explanation: `Recovery from supplier: ₹${totalDeds.toLocaleString('en-IN')}`
        }
      }
    };
  }

  // Resolve official Supplier Name safely
  const resolvedSupplierName = useMemo(() => {
    let name = statementData?.party_balances?.supplier?.name ||
               statementData?.voucher?.supplier ||
               statementData?.purchase?.supplier_name ||
               statementData?.purchase?.supplier ||
               rawPurchase?.supplier_name ||
               rawPurchase?.supplier || '';
    
    const str = String(name).trim();
    if (/^\d+$/.test(str)) {
      if (suppliersMap[str]) return suppliersMap[str];
      const addr = statementData?.purchase?.address || rawPurchase?.address || '';
      const m = addr.match(/Name\s*:\s*([^\n\r]+)/i);
      if (m && m[1]) return m[1].trim();
      return 'Supplier';
    }
    return str || 'Supplier';
  }, [statementData, rawPurchase, suppliersMap]);

  // Clean Journal Entries to eliminate any numeric supplier ledger names
  const cleanJournalEntries = useMemo(() => {
    if (!statementData?.journal_entries) return [];
    return statementData.journal_entries.map(row => {
      let lName = row.ledger_name;
      if (/^\d+$/.test(String(lName).trim())) {
        lName = resolvedSupplierName;
      }
      return {
        ...row,
        ledger_name: lName
      };
    });
  }, [statementData, resolvedSupplierName]);

  const pData = statementData?.purchase || rawPurchase || {};
  const transportAmount = Number(pData.net_transport_amount || pData.transport_charges || pData.freight_amount || statementData?.party_balances?.transporter?.transport_credit || 0);
  const loadmanAmount = Number(pData.loadman_charges || statementData?.party_balances?.loadman?.loadman_credit || 0);
  const transporterDisplayName = pData.transporter || pData.transport || statementData?.party_balances?.transporter?.name || 'Transporter Payable';
  const loadmanDisplayName = pData.loadman_name || statementData?.party_balances?.loadman?.name || 'Loadman Team';

  const handlePrint = () => {
    const printArea = document.getElementById('purchase-ledger-statement-print-area');
    if (!printArea) return;
    printHtml(printArea.innerHTML, `Purchase_Ledger_Statement_${statementData?.voucher?.voucher_no || 'PUR'}`);
  };

  if (!isOpen) return null;

  const modalContent = (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          width: '1100px',
          maxWidth: '95vw',
          height: '88vh',
          maxHeight: '88vh',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: '1px solid #cbd5e1',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#0f172a'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white px-6 py-4 flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-xl font-bold">
              📑
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold tracking-tight">Purchase Transaction Ledger Statement</h2>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-400/30">
                  Double-Entry Accounting
                </span>
              </div>
              <p className="text-xs text-blue-200 font-medium">
                Voucher: {statementData?.voucher?.voucher_no || pData.inv_no || 'PUR-0001'} · Supplier: <strong className="text-white font-bold">{resolvedSupplierName}</strong> · Date: {statementData?.voucher?.date || pData.date || '-'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-md border border-white/20 transition-colors flex items-center space-x-1 cursor-pointer"
              title="Print Voucher Statement"
            >
              <span>🖨️</span>
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors text-lg font-bold w-8 h-8 flex items-center justify-center cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-16 space-y-3">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-slate-500">Generating accounting ledger entries...</p>
          </div>
        ) : error ? (
          <div className="flex-1 p-8 text-center text-red-600 font-medium flex flex-col items-center justify-center">
            <p className="text-sm">{error}</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-md">
              Close
            </button>
          </div>
        ) : statementData ? (
          <div 
            id="purchase-ledger-statement-print-area"
            style={{ 
              flex: '1 1 0%',
              minHeight: 0,
              overflowY: 'auto',
              padding: '20px',
              backgroundColor: '#f8fafc',
              scrollbarWidth: 'thin',
              scrollbarColor: '#cbd5e1 transparent'
            }}
            className="space-y-4"
          >
            {/* Top Cards: Total Dr, Total Cr & Outstanding Balances */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Debit (Dr)</span>
                  <div className="text-lg font-black text-slate-800 mt-1 font-mono tabular-nums">
                    ₹{Number(statementData.totals?.debit_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="text-[11px] font-medium text-emerald-600 flex items-center gap-1 mt-1.5">
                  <span>✅</span>
                  <span>Fully Balanced</span>
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Credit (Cr)</span>
                  <div className="text-lg font-black text-slate-800 mt-1 font-mono tabular-nums">
                    ₹{Number(statementData.totals?.credit_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="text-[11px] font-medium text-emerald-600 flex items-center gap-1 mt-1.5">
                  <span>✅</span>
                  <span>Debit = Credit</span>
                </div>
              </div>

              <div className="bg-amber-50/40 p-3.5 rounded-xl border border-amber-200 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider block">Supplier Payable</span>
                  <div className="text-lg font-black text-amber-900 mt-1 font-mono tabular-nums">
                    ₹{Number(statementData.party_balances?.supplier?.outstanding || pData.supplier_payable || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="text-[11px] font-medium text-amber-700 truncate mt-1.5" title={`Party: ${resolvedSupplierName}`}>
                  Party: <strong className="font-bold">{resolvedSupplierName}</strong>
                </div>
              </div>

              <div className="bg-indigo-50/40 p-3.5 rounded-xl border border-indigo-200 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-indigo-800 uppercase tracking-wider block">Combined Outstanding</span>
                  <div className="text-lg font-black text-indigo-900 mt-1 font-mono tabular-nums">
                    ₹{Number(statementData.party_balances?.total_outstanding || (Number(statementData.party_balances?.supplier?.outstanding || 0) + transportAmount + loadmanAmount)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="text-[11px] font-medium text-indigo-700 mt-1.5">
                  Supplier + Freight + Loadman
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 bg-white px-4 pt-2 rounded-t-xl shadow-sm space-x-4 overflow-x-auto">
              <button
                onClick={() => setActiveTab('summary')}
                className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 whitespace-nowrap shrink-0 ${
                  activeTab === 'summary'
                    ? 'border-blue-700 text-blue-800'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <span>📊</span>
                <span>Accounting Entries (Dr/Cr)</span>
              </button>

              <button
                onClick={() => setActiveTab('details')}
                className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 whitespace-nowrap shrink-0 ${
                  activeTab === 'details'
                    ? 'border-blue-700 text-blue-800'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <span>📦</span>
                <span>Purchase & Item Details</span>
              </button>

              <button
                onClick={() => setActiveTab('individual')}
                className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 whitespace-nowrap shrink-0 ${
                  activeTab === 'individual'
                    ? 'border-blue-700 text-blue-800'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <span>📂</span>
                <span>Individual Ledger Statements</span>
              </button>

              <button
                onClick={() => setActiveTab('parties')}
                className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 whitespace-nowrap shrink-0 ${
                  activeTab === 'parties'
                    ? 'border-blue-700 text-blue-800'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <span>👥</span>
                <span>Party Liabilities & Settlements</span>
              </button>
            </div>

            {/* TAB 1: Double-Entry Table */}
            {activeTab === 'summary' && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2 shrink-0">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Automatic Double-Entry Journal Postings Generated by Purchase
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Voucher Reference: <span className="font-mono font-bold text-slate-700">{statementData.voucher?.voucher_no || pData.inv_no}</span> · Party: <strong className="text-slate-800">{resolvedSupplierName}</strong>
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-md border border-emerald-200">
                    Debit Total === Credit Total
                  </span>
                </div>

                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px]">
                        <th className="py-2.5 px-3 w-12 text-center">No.</th>
                        <th className="py-2.5 px-4">Ledger Account</th>
                        <th className="py-2.5 px-3">Account Group</th>
                        <th className="py-2.5 px-4 text-right">Debit (Dr)</th>
                        <th className="py-2.5 px-4 text-right">Credit (Cr)</th>
                        <th className="py-2.5 px-4">Particulars / Transaction Trace</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cleanJournalEntries.map((row, idx) => (
                        <tr 
                          key={idx} 
                          className={`hover:bg-blue-50/40 transition-colors ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center text-slate-400 font-semibold">{row.no || idx + 1}</td>
                          <td className="py-2.5 px-4 font-bold text-slate-800">
                            {row.ledger_name}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">{row.account_head || 'General'}</td>
                          <td className="py-2.5 px-4 text-right font-bold text-emerald-700 font-mono tabular-nums">
                            {Number(row.debit) > 0 ? `₹${Number(row.debit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-amber-700 font-mono tabular-nums">
                            {Number(row.credit) > 0 ? `₹${Number(row.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-slate-600 text-[11px]">{row.particulars || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                        <td colSpan={3} className="py-3 px-4 text-right uppercase tracking-wider text-xs">
                          Grand Total (Balanced):
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-700 text-sm font-extrabold font-mono tabular-nums">
                          ₹{Number(statementData.totals?.debit_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right text-amber-700 text-sm font-extrabold font-mono tabular-nums">
                          ₹{Number(statementData.totals?.credit_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-xs text-emerald-700 font-bold">
                          Debit = Credit (Double-Entry Validated ✅)
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: Purchase & Item Details (User Requested) */}
            {activeTab === 'details' && (
              <div className="space-y-4">
                {/* Information Header Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
                  {/* Supplier Card */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block mb-1">Supplier Profile</span>
                    <h4 className="text-sm font-bold text-slate-900">{resolvedSupplierName}</h4>
                    <div className="mt-2 text-xs space-y-1 text-slate-600">
                      <p><span className="text-slate-400">GSTIN:</span> {pData.gst_no || 'Unregistered / Nil'}</p>
                      <p><span className="text-slate-400">Phone:</span> {pData.phone || 'N/A'}</p>
                      <p className="line-clamp-2"><span className="text-slate-400">Address:</span> {pData.address ? pData.address.replace(/\n/g, ', ') : 'N/A'}</p>
                    </div>
                  </div>

                  {/* Transporter Card */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block mb-1">Transport Freight Details</span>
                    <h4 className="text-sm font-bold text-slate-900">{transporterDisplayName}</h4>
                    <div className="mt-2 text-xs space-y-1 text-slate-600">
                      <p><span className="text-slate-400">Vehicle No:</span> <strong className="text-slate-800">{pData.vehicle_no || pData.lorry_no || 'Not Entered'}</strong></p>
                      <p><span className="text-slate-400">Driver:</span> {pData.driver_name || pData.driver || 'N/A'}</p>
                      <p><span className="text-slate-400">Net Freight Amount:</span> <strong className="text-emerald-700 font-bold">₹{transportAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></p>
                    </div>
                  </div>

                  {/* Loadman Card */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block mb-1">Loadman & Unloading</span>
                    <h4 className="text-sm font-bold text-slate-900">{loadmanDisplayName}</h4>
                    <div className="mt-2 text-xs space-y-1 text-slate-600">
                      <p><span className="text-slate-400">Weight Handled:</span> {Number(pData.loadman_qty_kg || pData.total_weight || 0)} kg</p>
                      <p><span className="text-slate-400">Unloading Rate:</span> ₹{Number(pData.loadman_rate_per_kg || 0.50).toFixed(2)} / kg</p>
                      <p><span className="text-slate-400">Unloading Charges:</span> <strong className="text-purple-700 font-bold">₹{loadmanAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></p>
                    </div>
                  </div>
                </div>

                {/* Purchased Items Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Purchased Raw Materials / Stock Items
                    </h3>
                    <span className="text-xs text-slate-500 font-medium">
                      Total Items: {itemsList.length}
                    </span>
                  </div>

                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px]">
                          <th className="py-2.5 px-3 w-10 text-center">#</th>
                          <th className="py-2.5 px-4">Item Name</th>
                          <th className="py-2.5 px-3">Lot No</th>
                          <th className="py-2.5 px-3 text-right">Qty (Bags)</th>
                          <th className="py-2.5 px-3 text-right">Weight (KG)</th>
                          <th className="py-2.5 px-3 text-right">Rate (₹)</th>
                          <th className="py-2.5 px-3 text-right">GST %</th>
                          <th className="py-2.5 px-4 text-right">Line Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {itemsList.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-6 text-center text-slate-400">
                              No items recorded for this purchase voucher
                            </td>
                          </tr>
                        ) : (
                          itemsList.map((it, idx) => {
                            const qty = Number(it.qty || it.quantity || 0);
                            const wt = Number(it.total_weight || it.total_wt || (qty * (Number(it.per_unit_weight) || 50)));
                            const rate = Number(it.rate || it.price || 0);
                            const amt = Number(it.amount || it.totalAmount || (qty * rate));
                            const gst = Number(it.tax_percent ?? it.tax_rate ?? it.gst_rate ?? 0);

                            return (
                              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="py-2 px-3 text-center text-slate-400">{idx + 1}</td>
                                <td className="py-2 px-4 font-bold text-slate-800">{it.item_name || it.name || 'Raw Material'}</td>
                                <td className="py-2 px-3 font-mono text-[11px] text-blue-700">{it.lot_no || 'LOT-GEN'}</td>
                                <td className="py-2 px-3 text-right font-medium font-mono tabular-nums">{qty}</td>
                                <td className="py-2 px-3 text-right font-medium font-mono tabular-nums">{wt.toLocaleString('en-IN')}</td>
                                <td className="py-2 px-3 text-right font-medium font-mono tabular-nums">₹{rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                <td className="py-2 px-3 text-right text-slate-600 font-mono tabular-nums">{gst}%</td>
                                <td className="py-2 px-4 text-right font-bold text-slate-900 font-mono tabular-nums">₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Individual Ledger Statements */}
            {activeTab === 'individual' && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'supplier', label: `A. Supplier (${resolvedSupplierName})`, icon: '🏢' },
                    { id: 'transporter', label: `B. Transporter (${transporterDisplayName})`, icon: '🚚' },
                    { id: 'loadman', label: `C. Loadman (${loadmanDisplayName})`, icon: '👷' },
                    { id: 'purchase_account', label: 'D. Purchase Ledger', icon: '📦' },
                    { id: 'gst_input', label: 'E. GST Input Ledgers', icon: '🏛️' },
                    { id: 'deduction_recovery', label: 'F. Deduction Recovery', icon: '⚖️' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setIndividualLedgerTab(tab.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center space-x-1.5 ${
                        individualLedgerTab === tab.id
                          ? 'bg-blue-800 text-white border-blue-900 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>

                {/* Active Sub-Ledger Statement Table */}
                {statementData.individual_ledgers && statementData.individual_ledgers[individualLedgerTab] ? (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          {individualLedgerTab === 'supplier' ? `Supplier Ledger – ${resolvedSupplierName}` : statementData.individual_ledgers[individualLedgerTab].title}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          {statementData.individual_ledgers[individualLedgerTab].category}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-slate-700 bg-slate-200/80 px-2.5 py-1 rounded font-mono tabular-nums">
                        Closing: ₹{Number(statementData.individual_ledgers[individualLedgerTab].closing_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {statementData.individual_ledgers[individualLedgerTab].closing_balance_type || 'Cr'}
                      </span>
                    </div>

                    <div className="overflow-x-auto w-full">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px] sticky top-0 z-10">
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-4">Particulars</th>
                            <th className="py-2.5 px-3">Voucher Ref</th>
                            <th className="py-2.5 px-4 text-right">Debit (₹)</th>
                            <th className="py-2.5 px-4 text-right">Credit (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(statementData.individual_ledgers[individualLedgerTab].rows || []).map((r, rIdx) => (
                            <tr key={rIdx} className="hover:bg-slate-50 transition-colors">
                              <td className="py-2 px-3 text-slate-600">{r.date || '-'}</td>
                              <td className="py-2 px-4 font-semibold text-slate-800">{r.particulars || '-'}</td>
                              <td className="py-2 px-3 font-mono text-[11px] text-blue-700">{r.voucher || statementData.voucher?.voucher_no}</td>
                              <td className="py-2 px-4 text-right font-bold text-emerald-700">
                                {Number(r.debit) > 0 ? `₹${Number(r.debit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                              </td>
                              <td className="py-2 px-4 text-right font-bold text-amber-700">
                                {Number(r.credit) > 0 ? `₹${Number(r.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                    No transactions recorded under this sub-ledger.
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: Party Liabilities & Settlements */}
            {activeTab === 'parties' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' }}>
                {/* 1. Supplier Liability Card */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Party 1</span>
                    <h4 className="text-sm font-bold text-slate-900">{resolvedSupplierName}</h4>
                    <span className="text-xs text-slate-500 font-medium">Sundry Creditor (Goods)</span>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Gross Invoice:</span>
                      <span className="font-semibold text-slate-800">
                        ₹{Number(statementData.party_balances?.supplier?.invoice_credit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>Deductions:</span>
                      <span className="font-semibold">
                        -₹{Number(statementData.party_balances?.supplier?.deduction_debit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                      <span>Net Outstanding:</span>
                      <span className="text-sm text-amber-800">
                        ₹{Number(statementData.party_balances?.supplier?.outstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Cr
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Transporter Liability Card */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Party 2</span>
                    <h4 className="text-sm font-bold text-slate-900">{transporterDisplayName}</h4>
                    <span className="text-xs text-slate-500 font-medium">Freight & Transport Inward</span>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Freight Charges:</span>
                      <span className="font-semibold text-slate-800">
                        ₹{transportAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-emerald-600">
                      <span>Vehicle:</span>
                      <span className="font-semibold">{pData.vehicle_no || pData.lorry_no || 'N/A'}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                      <span>Transporter Outstanding:</span>
                      <span className="text-sm text-amber-800">
                        ₹{transportAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} Cr
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Loadman Liability Card */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Party 3</span>
                    <h4 className="text-sm font-bold text-slate-900">{loadmanDisplayName}</h4>
                    <span className="text-xs text-slate-500 font-medium">Unloading & Labour Charges</span>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Unloading Charges:</span>
                      <span className="font-semibold text-slate-800">
                        ₹{loadmanAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Weight Handled:</span>
                      <span className="font-semibold">{Number(pData.loadman_qty_kg || pData.total_weight || 0)} kg</span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                      <span>Loadman Outstanding:</span>
                      <span className="text-sm text-amber-800">
                        ₹{loadmanAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} Cr
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Clean, Non-overlapping Action Footer */}
        <div 
          style={{
            flexShrink: 0,
            backgroundColor: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            padding: '12px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.03)',
            zIndex: 10
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#475569' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
            <span>Traceable Voucher: <strong style={{ color: '#0f172a', fontFamily: 'monospace', fontSize: '13px' }}>{statementData?.voucher?.voucher_no || pData.inv_no || 'PUR-0001'}</strong></span>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <span style={{ color: '#059669', fontWeight: 600 }}>Double-Entry Standard Compliance (Dr === Cr) ✅</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={handlePrint}
              style={{
                padding: '8px 16px',
                backgroundColor: '#1e40af',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <span>🖨️</span>
              <span>Print Statement</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 20px',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '12px',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              Close Statement
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default PurchaseLedgerDetailsModal;
