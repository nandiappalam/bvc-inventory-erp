import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import api from '../../services/api';
import { printHtml } from '../../utils/printHelper';

const escHtml = (val) => String(val ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const SalesLedgerDetailsModal = ({ isOpen, onClose, salesId, salesData = null }) => {
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'details' | 'individual' | 'parties'
  const [individualLedgerTab, setIndividualLedgerTab] = useState('customer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statementData, setStatementData] = useState(null);
  const [rawSale, setRawSale] = useState(null);
  const [itemsList, setItemsList] = useState([]);
  const [customersMap, setCustomersMap] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    api('/masters/customers')
      .then((cRes) => {
        const cArr = Array.isArray(cRes) ? cRes : (cRes?.data || []);
        const cMap = {};
        cArr.forEach((c) => {
          if (c && c.id) cMap[String(c.id)] = c.print_name || c.name;
        });
        setCustomersMap(cMap);
      })
      .catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchStatement = async () => {
      setLoading(true);
      setError('');
      try {
        if (salesId) {
          const res = await api(`/sales/${salesId}/ledger-statement`);
          const stmtData = res?.data || res;
          if (stmtData && (stmtData.journal_entries || stmtData.totals)) {
            setStatementData(stmtData);
            if (stmtData.sales) setRawSale(stmtData.sales);
            if (Array.isArray(stmtData.items)) setItemsList(stmtData.items);
          } else {
            setError('Failed to load sales ledger statement');
          }
        } else if (salesData) {
          setRawSale(salesData);
          setItemsList(Array.isArray(salesData.items) ? salesData.items : []);
          setError('Sales ID missing');
        }
      } catch (err) {
        console.error('Error fetching sales ledger statement:', err);
        setError(err.message || 'Failed to load sales ledger statement');
      } finally {
        setLoading(false);
      }
    };

    fetchStatement();
  }, [isOpen, salesId, salesData]);

  const resolvedCustomerName = useMemo(() => {
    const raw = statementData?.party_balances?.customer?.name
      || statementData?.voucher?.customer
      || statementData?.sales?.customer_name
      || statementData?.sales?.customer
      || rawSale?.customer_name
      || rawSale?.customer
      || '';
    const str = String(raw).trim();
    if (/^\d+$/.test(str)) {
      if (customersMap[str]) return customersMap[str];
      const addr = statementData?.sales?.address || rawSale?.address || '';
      const m = addr.match(/Name\s*:\s*([^\n\r]+)/i);
      if (m && m[1]) return m[1].trim();
      return 'Customer';
    }
    return str || 'Customer';
  }, [statementData, rawSale, customersMap]);

  const cleanJournalEntries = useMemo(() => {
    if (!statementData?.journal_entries) return [];
    return statementData.journal_entries.map((row) => {
      let lName = row.ledger_name;
      if (/^\d+$/.test(String(lName).trim())) {
        lName = resolvedCustomerName;
      }
      return { ...row, ledger_name: lName };
    });
  }, [statementData, resolvedCustomerName]);

  const sData = statementData?.sales || rawSale || {};
  const loadmanAmount = Number(sData.loadman_charges || statementData?.party_balances?.loadman?.loadman_charges || 0);
  const transporterDisplayName = sData.transporter_name || sData.pur_trans || statementData?.party_balances?.transporter?.name || 'Transport / Logistics';
  const loadmanDisplayName = sData.loadman_name || statementData?.party_balances?.loadman?.name || 'Loadman Team';
  const docLabel = statementData?.voucher?.voucher_no || (sData.s_no ? `SI-${sData.s_no}` : `SI-${sData.id || ''}`);

  const handlePrint = () => {
    if (!statementData) return;
    const rowsHtml = cleanJournalEntries.map((row, idx) => `
      <tr>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:center;">${escHtml(row.no || idx + 1)}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;font-weight:700;">${escHtml(row.ledger_name)}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;">${escHtml(row.account_head || 'General')}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:right;font-family:monospace;">${Number(row.debit) > 0 ? `₹${Number(row.debit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:right;font-family:monospace;">${Number(row.credit) > 0 ? `₹${Number(row.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;">${escHtml(row.particulars || '-')}</td>
      </tr>
    `).join('');

    const itemRowsHtml = itemsList.map((it, idx) => {
      const qty = Number(it.qty || 0);
      const wt = Number(it.total_wt || it.totalWt || (qty * Number(it.weight || 0)));
      const rate = Number(it.rate || 0);
      const amt = Number(it.total_amt || it.totalAmt || (qty * rate));
      return `
        <tr>
          <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:center;">${idx + 1}</td>
          <td style="padding:5px 8px;border:1px solid #cbd5e1;font-weight:700;">${escHtml(it.item_name || it.itemName)}</td>
          <td style="padding:5px 8px;border:1px solid #cbd5e1;font-family:monospace;">${escHtml(it.lot_no || it.lotNo || '-')}</td>
          <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:right;">${qty}</td>
          <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:right;">${wt.toLocaleString('en-IN')} KG</td>
          <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:right;">₹${rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:right;font-weight:700;">₹${amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <div style="font-family:Arial,sans-serif;color:#0f172a;padding:12px;">
        <div style="border-bottom:2px solid #1e3a8a;padding-bottom:8px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:flex-end;">
          <div>
            <h2 style="margin:0;color:#1e3a8a;font-size:18px;">SALES TRANSACTION LEDGER STATEMENT</h2>
            <div style="font-size:11px;color:#475569;margin-top:4px;">
              Voucher: <strong>${escHtml(docLabel)}</strong> · Customer: <strong>${escHtml(resolvedCustomerName)}</strong> · Date: <strong>${escHtml(sData.date || '-')}</strong>
            </div>
          </div>
          <div style="text-align:right;font-size:12px;">
            Net Receivable: <strong style="color:#059669;">₹${Number(statementData.party_balances?.customer?.outstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Dr</strong>
          </div>
        </div>
        <h4 style="margin:8px 0 4px;font-size:12px;color:#1e3a8a;">Double-Entry Journal Entries</h4>
        <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:14px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:6px 8px;border:1px solid #cbd5e1;">No</th>
              <th style="padding:6px 8px;border:1px solid #cbd5e1;text-align:left;">Ledger Account</th>
              <th style="padding:6px 8px;border:1px solid #cbd5e1;text-align:left;">Account Group</th>
              <th style="padding:6px 8px;border:1px solid #cbd5e1;text-align:right;">Debit (Dr)</th>
              <th style="padding:6px 8px;border:1px solid #cbd5e1;text-align:right;">Credit (Cr)</th>
              <th style="padding:6px 8px;border:1px solid #cbd5e1;text-align:left;">Particulars</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr style="background:#f8fafc;font-weight:700;">
              <td colspan="3" style="padding:6px 8px;border:1px solid #cbd5e1;text-align:right;">TOTAL</td>
              <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:right;">₹${Number(statementData.totals?.debit_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:right;">₹${Number(statementData.totals?.credit_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td style="padding:6px 8px;border:1px solid #cbd5e1;">${statementData.totals?.is_balanced ? 'Balanced' : 'Check Balance'}</td>
            </tr>
          </tfoot>
        </table>
        <h4 style="margin:8px 0 4px;font-size:12px;color:#1e3a8a;">Dispatched Items</h4>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:5px 8px;border:1px solid #cbd5e1;">#</th>
              <th style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;">Item Name</th>
              <th style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;">Lot No</th>
              <th style="padding:5px 8px;border:1px solid #cbd5e1;text-align:right;">Qty</th>
              <th style="padding:5px 8px;border:1px solid #cbd5e1;text-align:right;">Weight</th>
              <th style="padding:5px 8px;border:1px solid #cbd5e1;text-align:right;">Rate</th>
              <th style="padding:5px 8px;border:1px solid #cbd5e1;text-align:right;">Amount</th>
            </tr>
          </thead>
          <tbody>${itemRowsHtml || '<tr><td colspan="7" style="text-align:center;padding:8px;">No items</td></tr>'}</tbody>
        </table>
      </div>
    `;
    printHtml(html, `Sales_Ledger_Statement_${docLabel}`);
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
        <div className="bg-gradient-to-r from-indigo-900 via-blue-900 to-slate-900 text-white px-6 py-4 flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center text-xl font-bold">
              📑
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold tracking-tight">Sales Transaction Ledger Statement</h2>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-400/30">
                  Double-Entry Accounting
                </span>
              </div>
              <p className="text-xs text-blue-200 font-medium">
                Voucher: {docLabel} · Customer: <strong className="text-white font-bold">{resolvedCustomerName}</strong> · Date: {statementData?.voucher?.date || (sData.date ? String(sData.date).slice(0, 10) : '-')}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-md border border-white/20 transition-colors flex items-center space-x-1 cursor-pointer"
              title="Print Sales Ledger Statement"
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
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-slate-500">Loading sales accounting ledger statement...</p>
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
            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Debit (Dr)</span>
                  <div className="text-lg font-black text-slate-800 mt-1 font-mono tabular-nums">
                    ₹{Number(statementData.totals?.debit_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="text-[11px] font-medium text-emerald-600 flex items-center gap-1 mt-1.5">
                  <span>{statementData.totals?.is_balanced ? '✅' : '⚠️'}</span>
                  <span>{statementData.totals?.is_balanced ? 'Fully Balanced' : 'Out of Balance'}</span>
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

              <div className="bg-emerald-50/40 p-3.5 rounded-xl border border-emerald-200 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">Customer Receivable</span>
                  <div className="text-lg font-black text-emerald-900 mt-1 font-mono tabular-nums">
                    ₹{Number(statementData.party_balances?.customer?.outstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="text-[11px] font-medium text-emerald-700 truncate mt-1.5" title={`Party: ${resolvedCustomerName}`}>
                  Party: <strong className="font-bold">{resolvedCustomerName}</strong>
                </div>
              </div>

              <div className="bg-indigo-50/40 p-3.5 rounded-xl border border-indigo-200 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-indigo-800 uppercase tracking-wider block">Receipts Settled</span>
                  <div className="text-lg font-black text-indigo-900 mt-1 font-mono tabular-nums">
                    ₹{Number(statementData.party_balances?.customer?.receipts_credit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="text-[11px] font-medium text-indigo-700 mt-1.5">
                  Pay Mode: {sData.pay_type || 'Credit'} · Loadman: ₹{loadmanAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 bg-white px-4 pt-2 rounded-t-xl shadow-sm space-x-4 overflow-x-auto">
              {[
                { id: 'summary', icon: '📊', label: 'Accounting Entries (Dr/Cr)' },
                { id: 'details', icon: '📦', label: 'Sales & Item Details' },
                { id: 'individual', icon: '📂', label: 'Individual Ledger Statements' },
                { id: 'parties', icon: '👥', label: 'Customer & Dispatch Summary' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                    activeTab === tab.id
                      ? 'border-indigo-700 text-indigo-800'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* TAB 1: Double-Entry Journal Table */}
            {activeTab === 'summary' && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2 shrink-0">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Double-Entry Journal Postings Generated by Sales
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Voucher Reference: <span className="font-mono font-bold text-slate-700">{docLabel}</span> · Party: <strong className="text-slate-800">{resolvedCustomerName}</strong>
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-md border border-emerald-200">
                    {statementData.totals?.is_balanced ? 'Debit Total === Credit Total' : 'Preview Entry'}
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
                          <td className="py-2.5 px-4 font-bold text-slate-800">{row.ledger_name}</td>
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
                          Grand Total:
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-700 text-sm font-extrabold font-mono tabular-nums">
                          ₹{Number(statementData.totals?.debit_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right text-amber-700 text-sm font-extrabold font-mono tabular-nums">
                          ₹{Number(statementData.totals?.credit_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-xs text-emerald-700 font-bold">
                          {statementData.totals?.is_balanced ? 'Debit = Credit (Validated ✅)' : 'Check Totals'}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: Sales & Item Details */}
            {activeTab === 'details' && (
              <div className="space-y-4">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block mb-1">Customer Profile</span>
                    <h4 className="text-sm font-bold text-slate-900">{resolvedCustomerName}</h4>
                    <div className="mt-2 text-xs space-y-1 text-slate-600">
                      <p><span className="text-slate-400">GSTIN:</span> {sData.customer_gstin || sData.gst_no || 'Unregistered / Nil'}</p>
                      <p><span className="text-slate-400">Phone:</span> {sData.customer_phone || sData.phone || 'N/A'}</p>
                      <p><span className="text-slate-400">Payment Mode:</span> {sData.pay_type || 'Credit'} ({sData.tax_type || 'Exclusive'})</p>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block mb-1">Dispatch & Transport</span>
                    <h4 className="text-sm font-bold text-slate-900">{transporterDisplayName}</h4>
                    <div className="mt-2 text-xs space-y-1 text-slate-600">
                      <p><span className="text-slate-400">Vehicle No:</span> <strong className="text-slate-800">{sData.lorry_no || 'Not Entered'}</strong></p>
                      <p><span className="text-slate-400">Driver / LR No:</span> {sData.driver || 'N/A'}{sData.lr_no ? ` · LR: ${sData.lr_no}` : ''}</p>
                      <p><span className="text-slate-400">Outpass / PO:</span> {sData.outpass_no || '—'} · {sData.customer_po_no || sData.p_o_no || 'N/A'}</p>
                      {(Number(sData.net_load_weight) > 0 || Number(sData.freight_amount) > 0) && (
                        <p>
                          <span className="text-slate-400">Load / Freight:</span>{' '}
                          {Number(sData.net_load_weight || 0).toLocaleString('en-IN')} kg · ₹{Number(sData.freight_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({sData.freight_paid_by || 'Buyer'})
                        </p>
                      )}
                      {statementData?.linked_vouchers && (
                        <p className="text-[11px] text-indigo-700 font-medium pt-1">
                          {statementData.linked_vouchers.receipt_voucher_no ? `REC: ${statementData.linked_vouchers.receipt_voucher_no}` : ''}
                          {statementData.linked_vouchers.receipt_voucher_no && statementData.linked_vouchers.freight_voucher_no ? ' · ' : ''}
                          {statementData.linked_vouchers.freight_voucher_no ? `JNL Freight: ${statementData.linked_vouchers.freight_voucher_no}` : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block mb-1">Loadman & Loading</span>
                    <h4 className="text-sm font-bold text-slate-900">{loadmanDisplayName}</h4>
                    <div className="mt-2 text-xs space-y-1 text-slate-600">
                      <p><span className="text-slate-400">Total Net Weight:</span> {Number(sData.product_net_weight || sData.total_wt || 0).toLocaleString('en-IN')} kg</p>
                      <p><span className="text-slate-400">Loading Rate:</span> ₹{Number(sData.loadman_rate_per_kg || 0).toFixed(2)} / kg</p>
                      <p><span className="text-slate-400">Loading Charges:</span> <strong className="text-purple-700 font-bold">₹{loadmanAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Sold Items & Lot Dispatch</h3>
                    <span className="text-xs text-slate-500 font-medium">Total Items: {itemsList.length}</span>
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
                            <td colSpan={8} className="py-6 text-center text-slate-400">No items recorded for this sales invoice</td>
                          </tr>
                        ) : (
                          itemsList.map((it, idx) => {
                            const qty = Number(it.qty || 0);
                            const wt = Number(it.total_wt || it.totalWt || (qty * Number(it.weight || 0)));
                            const rate = Number(it.rate || 0);
                            const amt = Number(it.total_amt || it.totalAmt || (qty * rate));
                            const gst = Number(it.tax_perc ?? it.tax_rate ?? it.gst_rate ?? 0);
                            return (
                              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="py-2 px-3 text-center text-slate-400">{idx + 1}</td>
                                <td className="py-2 px-4 font-bold text-slate-800">{it.item_name || it.itemName || 'Finished Good'}</td>
                                <td className="py-2 px-3 font-mono text-[11px] text-indigo-700">{it.lot_no || it.lotNo || '-'}</td>
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
                    { id: 'customer', label: `A. Customer (${resolvedCustomerName})`, icon: '🏢' },
                    { id: 'sales_account', label: 'B. Sales Account', icon: '📦' },
                    { id: 'gst_output', label: 'C. GST Output Ledgers', icon: '🏛️' },
                    { id: 'deductions_charges', label: 'D. TCS / Charges / Deductions', icon: '⚖️' },
                    { id: 'loadman', label: `E. Loadman (${loadmanDisplayName})`, icon: '👷' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setIndividualLedgerTab(tab.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center space-x-1.5 cursor-pointer ${
                        individualLedgerTab === tab.id
                          ? 'bg-indigo-800 text-white border-indigo-900 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>

                {statementData.individual_ledgers && statementData.individual_ledgers[individualLedgerTab] ? (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          {statementData.individual_ledgers[individualLedgerTab].title}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          {statementData.individual_ledgers[individualLedgerTab].category}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-slate-700 bg-slate-200/80 px-2.5 py-1 rounded font-mono tabular-nums">
                        Closing: ₹{Number(statementData.individual_ledgers[individualLedgerTab].closing_balance ?? statementData.individual_ledgers[individualLedgerTab].total_output_tax ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {statementData.individual_ledgers[individualLedgerTab].closing_balance_type || 'Cr'}
                      </span>
                    </div>

                    <div className="overflow-x-auto w-full">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px]">
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-4">Particulars / Ledger</th>
                            <th className="py-2.5 px-3">Voucher Ref</th>
                            <th className="py-2.5 px-4 text-right">Debit (₹)</th>
                            <th className="py-2.5 px-4 text-right">Credit (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(statementData.individual_ledgers[individualLedgerTab].rows || []).length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-6 text-center text-slate-400">No entries recorded under this sub-ledger for this invoice.</td>
                            </tr>
                          ) : (
                            (statementData.individual_ledgers[individualLedgerTab].rows || []).map((r, rIdx) => (
                              <tr key={rIdx} className="hover:bg-slate-50 transition-colors">
                                <td className="py-2 px-3 text-slate-600">{r.date || '-'}</td>
                                <td className="py-2 px-4 font-semibold text-slate-800">{r.ledger ? `${r.ledger} — ${r.particulars || ''}` : (r.particulars || '-')}</td>
                                <td className="py-2 px-3 font-mono text-[11px] text-indigo-700">{r.voucher || docLabel}</td>
                                <td className="py-2 px-4 text-right font-bold text-emerald-700">
                                  {Number(r.debit) > 0 ? `₹${Number(r.debit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                                </td>
                                <td className="py-2 px-4 text-right font-bold text-amber-700">
                                  {Number(r.credit) > 0 ? `₹${Number(r.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                                </td>
                              </tr>
                            ))
                          )}
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

            {/* TAB 4: Customer & Dispatch Summary */}
            {activeTab === 'parties' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' }}>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Party 1</span>
                    <h4 className="text-sm font-bold text-slate-900">{resolvedCustomerName}</h4>
                    <span className="text-xs text-slate-500 font-medium">Sundry Debtor (Customer)</span>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Invoice Receivable:</span>
                      <span className="font-semibold text-slate-800">
                        ₹{Number(statementData.party_balances?.customer?.invoice_debit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-emerald-600">
                      <span>Receipts Received:</span>
                      <span className="font-semibold">
                        -₹{Number(statementData.party_balances?.customer?.receipts_credit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                      <span>Net Receivable:</span>
                      <span className="text-sm text-indigo-800">
                        ₹{Number(statementData.party_balances?.customer?.outstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Dr
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Logistics</span>
                    <h4 className="text-sm font-bold text-slate-900">{transporterDisplayName}</h4>
                    <span className="text-xs text-slate-500 font-medium">Outward Dispatch Transport</span>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Vehicle No:</span>
                      <span className="font-semibold text-slate-800">{sData.lorry_no || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Driver:</span>
                      <span className="font-semibold text-slate-800">{sData.driver || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Labour</span>
                    <h4 className="text-sm font-bold text-slate-900">{loadmanDisplayName}</h4>
                    <span className="text-xs text-slate-500 font-medium">Loading & Dispatch Team</span>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Loading Charges:</span>
                      <span className="font-semibold text-slate-800">₹{loadmanAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Weight Handled:</span>
                      <span className="font-semibold">{Number(sData.total_wt || 0).toLocaleString('en-IN')} kg</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Footer */}
        <div
          style={{
            flexShrink: 0,
            backgroundColor: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            padding: '12px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#475569' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
            <span>Traceable Voucher: <strong style={{ color: '#0f172a', fontFamily: 'monospace', fontSize: '13px' }}>{docLabel}</strong></span>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <span style={{ color: '#059669', fontWeight: 600 }}>Double-Entry Standard (Dr === Cr)</span>
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
                cursor: 'pointer'
              }}
            >
              🖨️ Print Statement
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
                cursor: 'pointer'
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

export default SalesLedgerDetailsModal;
