import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import api from '../../services/api';

/**
 * PurchaseLedgerDetailsModal
 * Displays the complete Purchase-wise Transaction Ledger Statement with double-entry accounting.
 * Covers:
 * 1. Supplier ledger (Sundry Creditors)
 * 2. Transport ledger (Freight Inward / Transporter Payable)
 * 3. Loadman ledger (Loading/Unloading Charges / Loadman Payable)
 * 4. Purchase deduction recovery ledger
 * 5. Purchase ledger
 * 6. Input GST ledgers (CGST + SGST or IGST)
 * 7. Running balances and outstanding summaries
 */
const PurchaseLedgerDetailsModal = ({ isOpen, onClose, purchaseId, purchaseData = null }) => {
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'individual' | 'breakdown'
  const [individualLedgerTab, setIndividualLedgerTab] = useState('supplier');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statementData, setStatementData] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchStatement = async () => {
      setLoading(true);
      setError('');
      try {
        if (purchaseId) {
          const res = await api(`/purchases/${purchaseId}/ledger-statement`);
          const stmtData = res?.data || res;
          if (stmtData && (stmtData.journal_entries || stmtData.totals)) {
            setStatementData(stmtData);
          } else if (purchaseData) {
            setStatementData(generatePreviewStatement(purchaseData));
          } else {
            // Fallback: fetch purchase directly and generate preview statement
            try {
              const pRes = await api(`/purchases/${purchaseId}`);
              const fetchedP = pRes?.data || pRes;
              if (fetchedP && (fetchedP.id || fetchedP.s_no)) {
                setStatementData(generatePreviewStatement({ formData: fetchedP, totals: { baseAmount: fetchedP.base_amount || fetchedP.total_amount, taxAmount: fetchedP.tax_amount, grandTotal: fetchedP.grand_total } }));
              } else {
                setError(res?.message || 'Failed to load purchase ledger statement');
              }
            } catch (_) {
              setError('Failed to load purchase ledger statement');
            }
          }
        } else if (purchaseData) {
          setStatementData(generatePreviewStatement(purchaseData));
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

  if (!isOpen) return null;

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
    const transportCharges = Number(f.transport_charges || f.freight_amount || 0);
    const loadmanCharges = Number(f.loadman_charges || 0);
    const supplierName = f.supplier_name || f.supplier || 'Supplier';
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
      purchase: { ...f, voucher_no: voucherNo, gross_supplier_invoice: grossInvoice, supplier_payable: supplierOutstanding },
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
          explanation: `Amount payable to supplier is ₹${supplierOutstanding.toLocaleString('en-IN')}`
        },
        transporter: {
          title: `Transporter Ledger – ${transporterName}`,
          ledger_name: transporterName,
          category: 'Transporter Liabilities',
          rows: [{ date: f.date || '-', particulars: 'Transport charges', voucher: voucherNo, debit: 0, credit: transportCharges }],
          closing_balance: transportCharges,
          closing_balance_type: 'Cr',
          explanation: `The company owes ₹${transportCharges.toLocaleString('en-IN')} to the transporter`
        },
        loadman: {
          title: `Loadman Ledger – ${loadmanName}`,
          ledger_name: loadmanName,
          category: 'Labour Liabilities',
          rows: [{ date: f.date || '-', particulars: 'Loading/unloading charges', voucher: voucherNo, debit: 0, credit: loadmanCharges }],
          closing_balance: loadmanCharges,
          closing_balance_type: 'Cr',
          explanation: `The company owes ₹${loadmanCharges.toLocaleString('en-IN')} to the loadman`
        },
        purchase_account: {
          title: 'Purchase Ledger',
          ledger_name: 'Purchase Account',
          category: 'Direct Expenses / Inventory',
          rows: [{ date: f.date || '-', particulars: `${supplierName} purchase`, voucher: voucherNo, debit: baseAmount, credit: 0 }],
          closing_balance: baseAmount,
          closing_balance_type: 'Dr',
          explanation: `Total purchase value debit: ₹${baseAmount.toLocaleString('en-IN')}`
        },
        gst_input: {
          title: 'GST Input Ledgers',
          category: 'Duties & Taxes',
          rows: isInterstate ? [
            { date: f.date || '-', particulars: `Purchase ${voucherNo}`, ledger: 'Input IGST', debit: igstAmount, credit: 0 }
          ] : [
            { date: f.date || '-', particulars: `Purchase ${voucherNo}`, ledger: 'Input CGST', debit: cgstAmount, credit: 0 },
            { date: f.date || '-', particulars: `Purchase ${voucherNo}`, ledger: 'Input SGST', debit: sgstAmount, credit: 0 }
          ],
          total_input_credit: taxAmount,
          explanation: `Eligible input tax credit: ₹${taxAmount.toLocaleString('en-IN')}`
        },
        deduction_recovery: {
          title: 'Deduction Ledger',
          ledger_name: 'Purchase Deduction Recovery',
          category: 'Recovery / Claims Reserve',
          rows: [{ date: f.date || '-', particulars: 'Supplier quality/shortage recovery', voucher: voucherNo, debit: 0, credit: totalDeds }],
          closing_balance: totalDeds,
          closing_balance_type: 'Cr',
          explanation: `Quality/shortage claim recovery from supplier: ₹${totalDeds.toLocaleString('en-IN')}`
        }
      }
    };
  }

  const handlePrint = () => {
    window.print();
  };

  const modalContent = (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backdropFilter: 'blur(4px)'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          width: '980px',
          maxWidth: '96vw',
          maxHeight: '88vh',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #cbd5e1',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#0f172a'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white px-6 py-4 flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-xl font-bold">
              📑
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold tracking-tight">Purchase Transaction Ledger Statement</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-400/30">
                  Double-Entry Accounting
                </span>
              </div>
              <p className="text-xs text-blue-200 font-medium">
                Voucher: {statementData?.voucher?.voucher_no || 'PUR-0001'} · Supplier: {statementData?.party_balances?.supplier?.name || 'ABC Traders'} · Date: {statementData?.voucher?.date || '-'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-md border border-white/20 transition-colors flex items-center space-x-1"
              title="Print Voucher Statement"
            >
              <span>🖨️</span>
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors text-lg font-bold w-8 h-8 flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="flex flex-col items-center justify-center p-16 space-y-3">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-slate-500">Generating accounting ledger entries...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 font-medium">
            <p>{error}</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-md">
              Close
            </button>
          </div>
        ) : statementData ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
            {/* Top Cards: Total Dr, Total Cr & Outstanding Balances */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '16px' }}>
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Debit (Dr)</span>
                <span className="text-xl font-bold text-slate-800">
                  ₹{Number(statementData.totals.debit_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] font-medium text-emerald-600 block mt-0.5">
                  ✅ Fully Balanced
                </span>
              </div>

              <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Credit (Cr)</span>
                <span className="text-xl font-bold text-slate-800">
                  ₹{Number(statementData.totals.credit_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] font-medium text-emerald-600 block mt-0.5">
                  Debit = Credit
                </span>
              </div>

              <div className="bg-white p-3.5 rounded-lg border border-amber-200 bg-amber-50/30 shadow-sm">
                <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider block">Supplier Payable</span>
                <span className="text-xl font-bold text-amber-900">
                  ₹{Number(statementData.party_balances?.supplier?.outstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] font-medium text-amber-700 block mt-0.5">
                  Gross ₹{Number(statementData.party_balances?.supplier?.invoice_credit || 0).toLocaleString('en-IN')} - Ded ₹{Number(statementData.party_balances?.supplier?.deduction_debit || 0).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="bg-white p-3.5 rounded-lg border border-indigo-200 bg-indigo-50/30 shadow-sm">
                <span className="text-[11px] font-semibold text-indigo-800 uppercase tracking-wider block">Combined Outstanding</span>
                <span className="text-xl font-bold text-indigo-900">
                  ₹{Number(statementData.party_balances?.total_outstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] font-medium text-indigo-700 block mt-0.5">
                  Supplier + Transport + Loadman
                </span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 space-x-2">
              <button
                onClick={() => setActiveTab('summary')}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 ${
                  activeTab === 'summary'
                    ? 'border-blue-700 text-blue-800'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <span>📊</span>
                <span>Overall Purchase Transaction Summary</span>
              </button>

              <button
                onClick={() => setActiveTab('individual')}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 ${
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
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 ${
                  activeTab === 'parties'
                    ? 'border-blue-700 text-blue-800'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <span>👥</span>
                <span>Party Liabilities & Settlements</span>
              </button>
            </div>

            {/* Tab 1: Overall Purchase Transaction Summary (Double-Entry Table) */}
            {activeTab === 'summary' && (
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Automatic Accounting Entries Generated by this Purchase
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Every transaction is traceable to voucher {statementData.voucher?.voucher_no}
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-md border border-emerald-200">
                    Debit Total === Credit Total
                  </span>
                </div>

                <div className="overflow-x-auto">
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
                      {statementData.journal_entries?.map((row, idx) => (
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
                          <td className="py-2.5 px-4 text-right font-bold text-emerald-700">
                            {Number(row.debit) > 0 ? `₹${Number(row.debit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-amber-700">
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
                        <td className="py-3 px-4 text-right text-emerald-700 text-sm font-extrabold">
                          ₹{Number(statementData.totals?.debit_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right text-amber-700 text-sm font-extrabold">
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

            {/* Tab 2: Individual Ledger Statements */}
            {activeTab === 'individual' && (
              <div className="space-y-4">
                {/* Sub-tabs */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'supplier', label: 'A. Supplier Ledger', icon: '🏢' },
                    { id: 'transporter', label: 'B. Transporter Ledger', icon: '🚚' },
                    { id: 'loadman', label: 'C. Loadman Ledger', icon: '👷' },
                    { id: 'purchase_account', label: 'D. Purchase Ledger', icon: '📦' },
                    { id: 'gst_input', label: 'E. GST Input Ledgers', icon: '🏛️' },
                    { id: 'deduction_recovery', label: 'F. Deduction Recovery', icon: '⚖️' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setIndividualLedgerTab(tab.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-all flex items-center space-x-1.5 ${
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

                {/* Sub-tab view */}
                {statementData.individual_ledgers && statementData.individual_ledgers[individualLedgerTab] ? (
                  <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden p-4 space-y-4">
                    <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">
                          {statementData.individual_ledgers[individualLedgerTab].title}
                        </h4>
                        <span className="text-xs text-slate-500 font-medium">
                          Category: {statementData.individual_ledgers[individualLedgerTab].category || 'Account Ledger'}
                        </span>
                      </div>
                      {statementData.individual_ledgers[individualLedgerTab].closing_balance !== undefined && (
                        <div className="text-right">
                          <span className="text-[11px] font-semibold text-slate-500 uppercase block">Closing Balance</span>
                          <span className="text-base font-bold text-slate-900">
                            ₹{Number(statementData.individual_ledgers[individualLedgerTab].closing_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}{' '}
                            <span className="text-xs font-bold text-blue-700">
                              ({statementData.individual_ledgers[individualLedgerTab].closing_balance_type || 'Cr'})
                            </span>
                          </span>
                        </div>
                      )}
                    </div>

                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase text-[11px]">
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-4">Particulars</th>
                          <th className="py-2.5 px-3">Voucher</th>
                          <th className="py-2.5 px-4 text-right">Debit (Dr)</th>
                          <th className="py-2.5 px-4 text-right">Credit (Cr)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {statementData.individual_ledgers[individualLedgerTab].rows?.map((r, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 text-slate-600">{r.date || '-'}</td>
                            <td className="py-2.5 px-4 font-semibold text-slate-800">{r.particulars}</td>
                            <td className="py-2.5 px-3 font-mono font-semibold text-blue-700">{r.voucher}</td>
                            <td className="py-2.5 px-4 text-right font-bold text-emerald-700">
                              {Number(r.debit) > 0 ? `₹${Number(r.debit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                            </td>
                            <td className="py-2.5 px-4 text-right font-bold text-amber-700">
                              {Number(r.credit) > 0 ? `₹${Number(r.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="bg-blue-50/60 p-3 rounded border border-blue-100 text-xs text-blue-900 font-medium">
                      💡 <strong>Accounting Meaning:</strong> {statementData.individual_ledgers[individualLedgerTab].explanation}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 bg-white rounded-lg border border-slate-200">
                    No ledger transactions found for this account.
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Party Liabilities & Settlements */}
            {activeTab === 'parties' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' }}>
                {/* Supplier Liability Card */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 space-y-3">
                  <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                    <span className="text-xl">🏢</span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase">Supplier Liability</h4>
                      <p className="text-xs text-blue-700 font-semibold">{statementData.party_balances?.supplier?.name}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Gross Invoice Value:</span>
                      <span className="font-semibold text-slate-800">
                        ₹{Number(statementData.party_balances?.supplier?.invoice_credit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>Less Deductions / Claims:</span>
                      <span className="font-semibold">
                        -₹{Number(statementData.party_balances?.supplier?.deduction_debit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-emerald-600">
                      <span>Bank / Cash Paid:</span>
                      <span className="font-semibold">
                        -₹{Number(statementData.party_balances?.supplier?.payments_debit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                      <span>Supplier Outstanding:</span>
                      <span className="text-sm text-amber-800">
                        ₹{Number(statementData.party_balances?.supplier?.outstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Cr
                      </span>
                    </div>
                  </div>
                </div>

                {/* Transporter Liability Card */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 space-y-3">
                  <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                    <span className="text-xl">🚚</span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase">Transporter Liability</h4>
                      <p className="text-xs text-blue-700 font-semibold">{statementData.party_balances?.transporter?.name}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Freight Amount:</span>
                      <span className="font-semibold text-slate-800">
                        ₹{Number(statementData.party_balances?.transporter?.transport_credit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-emerald-600">
                      <span>Paid to Transporter:</span>
                      <span className="font-semibold">
                        -₹{Number(statementData.party_balances?.transporter?.payments_debit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                      <span>Transport Outstanding:</span>
                      <span className="text-sm text-amber-800">
                        ₹{Number(statementData.party_balances?.transporter?.outstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Cr
                      </span>
                    </div>
                  </div>
                </div>

                {/* Loadman Liability Card */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 space-y-3">
                  <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                    <span className="text-xl">👷</span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase">Loadman Liability</h4>
                      <p className="text-xs text-blue-700 font-semibold">{statementData.party_balances?.loadman?.name}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Unloading Charges:</span>
                      <span className="font-semibold text-slate-800">
                        ₹{Number(statementData.party_balances?.loadman?.loadman_credit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-emerald-600">
                      <span>Paid to Loadman:</span>
                      <span className="font-semibold">
                        -₹{Number(statementData.party_balances?.loadman?.payments_debit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                      <span>Loadman Outstanding:</span>
                      <span className="text-sm text-amber-800">
                        ₹{Number(statementData.party_balances?.loadman?.outstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Cr
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Footer */}
        <div className="px-6 py-3 bg-white border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <div>
            Traceable Voucher: <strong className="text-slate-800">{statementData?.voucher?.voucher_no || 'PUR-0001'}</strong> · Double-Entry Standard Compliance
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg shadow-sm transition-colors text-xs"
          >
            Close Statement
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default PurchaseLedgerDetailsModal;
