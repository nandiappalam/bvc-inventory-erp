import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import PurchaseLedgerDetailsModal from '../purchase/PurchaseLedgerDetailsModal';

const TallyLedgerStatementPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialLedgerId = searchParams.get('ledger_id') || '';
  const initialLedgerName = searchParams.get('ledger_name') || '';

  const [ledgersList, setLedgersList] = useState([]);
  const [selectedLedgerId, setSelectedLedgerId] = useState(initialLedgerId);
  const [selectedLedgerName, setSelectedLedgerName] = useState(initialLedgerName || '');

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [voucherType, setVoucherType] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Voucher details modal state
  const [activeVoucherId, setActiveVoucherId] = useState(null);
  const [voucherModalOpen, setVoucherModalOpen] = useState(false);

  useEffect(() => {
    loadLedgersMaster();
  }, []);

  useEffect(() => {
    if (selectedLedgerId || selectedLedgerName) {
      fetchStatement();
    }
  }, [selectedLedgerId, selectedLedgerName, fromDate, toDate, voucherType]);

  const loadLedgersMaster = async () => {
    try {
      const res = await api('/accounting/ledgers');
      const list = res?.data || res || [];
      if (Array.isArray(list)) {
        setLedgersList(list);
        if (!selectedLedgerId && !selectedLedgerName && list.length > 0) {
          setSelectedLedgerId(list[0].id);
          setSelectedLedgerName(list[0].ledger_name);
        } else if (selectedLedgerId && !selectedLedgerName) {
          const found = list.find(l => String(l.id) === String(selectedLedgerId));
          if (found) setSelectedLedgerName(found.ledger_name);
        } else if (!selectedLedgerId && selectedLedgerName) {
          const found = list.find(l => l.ledger_name.toLowerCase() === selectedLedgerName.toLowerCase());
          if (found) setSelectedLedgerId(found.id);
        }
      }
    } catch (err) {
      console.warn('Notice loading ledgers list:', err);
    }
  };

  const fetchStatement = async () => {
    setLoading(true);
    setError('');
    try {
      let url = `/accounting/ledger-statement?`;
      if (selectedLedgerId) url += `ledger_id=${encodeURIComponent(selectedLedgerId)}&`;
      if (selectedLedgerName) url += `ledger_name=${encodeURIComponent(selectedLedgerName)}&`;
      if (fromDate) url += `from_date=${fromDate}&`;
      if (toDate) url += `to_date=${toDate}&`;
      if (voucherType && voucherType !== 'ALL') url += `voucher_type=${voucherType}&`;
      if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}&`;

      const res = await api(url);
      const data = res?.data || res;
      setStatement(data);
    } catch (err) {
      console.error('Error fetching ledger statement:', err);
      setError('Failed to load ledger statement transactions.');
    } finally {
      setLoading(false);
    }
  };

  const handleLedgerChange = (e) => {
    const val = e.target.value;
    const found = ledgersList.find(l => String(l.id) === String(val) || l.ledger_name === val);
    if (found) {
      setSelectedLedgerId(found.id);
      setSelectedLedgerName(found.ledger_name);
    } else {
      setSelectedLedgerName(val);
      setSelectedLedgerId('');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ padding: '12px 16px', maxWidth: '100%', margin: '0 auto', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      
      {/* Top Bar with Navigation & Actions */}
      <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#ffffff', padding: '10px 16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
            📑
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: '#ffffff', letterSpacing: '-0.01em' }}>Ledger Statement</h1>
              <span style={{ fontSize: '10px', padding: '1px 8px', borderRadius: '10px', backgroundColor: 'rgba(59, 130, 246, 0.25)', color: '#93c5fd', fontWeight: '700', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                Double-Entry Audit
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/accounting/dashboard');
              }
            }}
            style={{ padding: '6px 12px', backgroundColor: 'rgba(255,255,255,0.15)', color: '#ffffff', fontWeight: '700', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.25)', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <span>←</span>
            <span>Back</span>
          </button>
          <button
            onClick={() => navigate('/accounting/dashboard')}
            style={{ padding: '6px 12px', backgroundColor: 'rgba(255,255,255,0.1)', color: '#ffffff', fontWeight: '700', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <span>📊</span>
            <span>Dashboard</span>
          </button>
          <button
            onClick={handlePrint}
            style={{ padding: '6px 14px', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: '700', borderRadius: '6px', border: 'none', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <span>🖨️</span>
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Advanced Filter Bar - Compact Single Row */}
      <div style={{ backgroundColor: '#ffffff', padding: '10px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '12px', alignItems: 'center' }}>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>Select Ledger Account</label>
          <select
            value={selectedLedgerId}
            onChange={handleLedgerChange}
            style={{ width: '100%', height: '34px', padding: '4px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontWeight: '700', color: '#0f172a', backgroundColor: '#ffffff' }}
          >
            <option value="">-- Choose Account Ledger --</option>
            {ledgersList.map(l => (
              <option key={l.id} value={l.id}>
                {l.ledger_name} ({l.group_name || 'General'})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={{ width: '100%', height: '34px', padding: '4px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', color: '#0f172a', backgroundColor: '#ffffff' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={{ width: '100%', height: '34px', padding: '4px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', color: '#0f172a', backgroundColor: '#ffffff' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>Voucher Type</label>
          <select
            value={voucherType}
            onChange={(e) => setVoucherType(e.target.value)}
            style={{ width: '100%', height: '34px', padding: '4px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', color: '#0f172a', backgroundColor: '#ffffff' }}
          >
            <option value="ALL">All Vouchers</option>
            <option value="Purchase">Purchase</option>
            <option value="Sales">Sales</option>
            <option value="Payment">Payment</option>
            <option value="Receipt">Receipt</option>
            <option value="Contra">Contra</option>
            <option value="Journal">Journal</option>
          </select>
        </div>

        <div style={{ marginTop: '16px' }}>
          <button
            onClick={fetchStatement}
            style={{ height: '34px', padding: '0 16px', backgroundColor: '#1d4ed8', color: '#ffffff', fontWeight: '700', borderRadius: '6px', border: 'none', fontSize: '11px', cursor: 'pointer' }}
          >
            Search
          </button>
        </div>
      </div>

      {/* Main Statement Content View */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid #1d4ed8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <p style={{ marginTop: '12px', fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Computing ledger statement & running balances...</p>
        </div>
      ) : error ? (
        <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: '8px', fontSize: '12px', fontWeight: '600' }}>
          ⚠️ {error}
        </div>
      ) : statement ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
          
          {/* Sleek Ultra-Compact Horizontal Summary Bar */}
          <div style={{ backgroundColor: '#0f172a', color: '#ffffff', padding: '8px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#93c5fd', fontWeight: '700' }}>Account: </span>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#ffffff' }}>{statement.ledger?.ledger_name || selectedLedgerName}</span>
                <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '6px' }}>({statement.ledger?.group_name || 'General'})</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ backgroundColor: 'rgba(255,255,255,0.08)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.12)', fontSize: '12px' }}>
                <span style={{ fontSize: '10px', color: '#cbd5e1', fontWeight: '700', textTransform: 'uppercase' }}>Opening: </span>
                <span style={{ fontWeight: '800' }}>
                  ₹{Number(statement.opening_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({statement.opening_balance_type || 'Dr'})
                </span>
              </div>

              <div style={{ backgroundColor: 'rgba(255,255,255,0.08)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.12)', fontSize: '12px' }}>
                <span style={{ fontSize: '10px', color: '#cbd5e1', fontWeight: '700', textTransform: 'uppercase' }}>Total Dr: </span>
                <span style={{ fontWeight: '800', color: '#34d399' }}>
                  ₹{Number(statement.period_debit_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div style={{ backgroundColor: 'rgba(255,255,255,0.08)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.12)', fontSize: '12px' }}>
                <span style={{ fontSize: '10px', color: '#cbd5e1', fontWeight: '700', textTransform: 'uppercase' }}>Total Cr: </span>
                <span style={{ fontWeight: '800', color: '#fcd34d' }}>
                  ₹{Number(statement.period_credit_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.3)', padding: '4px 12px', borderRadius: '6px', border: '1px solid rgba(147, 197, 253, 0.4)', fontSize: '12px' }}>
                <span style={{ fontSize: '10px', color: '#bfdbfe', fontWeight: '700', textTransform: 'uppercase' }}>Closing: </span>
                <span style={{ fontWeight: '800', color: '#ffffff' }}>
                  ₹{Number(statement.closing_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({statement.closing_balance_type || 'Cr'})
                </span>
              </div>
            </div>
          </div>

          {/* Maximized High-Density Statement Table */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, maxHeight: 'calc(100vh - 180px)', minHeight: '400px' }}>
            <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, scrollbarWidth: 'thin' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', color: '#334155', borderBottom: '2px solid #cbd5e1', fontWeight: '800', textTransform: 'uppercase', fontSize: '11px', position: 'sticky', top: 0, zIndex: 10 }}>
                    <th style={{ padding: '8px 12px', width: '40px', textAlign: 'center', backgroundColor: '#f1f5f9' }}>#</th>
                    <th style={{ padding: '8px 12px', width: '90px', backgroundColor: '#f1f5f9' }}>Date</th>
                    <th style={{ padding: '8px 12px', width: '120px', backgroundColor: '#f1f5f9' }}>Voucher No</th>
                    <th style={{ padding: '8px 12px', width: '120px', backgroundColor: '#f1f5f9' }}>Voucher Type</th>
                    <th style={{ padding: '8px 12px', backgroundColor: '#f1f5f9' }}>Particulars & Voucher Audit Details</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', width: '130px', backgroundColor: '#f1f5f9' }}>Debit (Dr)</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', width: '130px', backgroundColor: '#f1f5f9' }}>Credit (Cr)</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', width: '150px', backgroundColor: '#f1f5f9' }}>Running Balance</th>
                    <th style={{ padding: '8px 12px', width: '90px', textAlign: 'center', backgroundColor: '#f1f5f9' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Opening Balance Row */}
                  <tr style={{ backgroundColor: '#f8fafc', fontWeight: '700', borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '6px 12px', textAlign: 'center', color: '#94a3b8' }}>-</td>
                    <td style={{ padding: '6px 12px', color: '#64748b' }}>-</td>
                    <td style={{ padding: '6px 12px' }}>
                      <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#e2e8f0', color: '#475569', fontFamily: 'monospace', fontWeight: '700' }}>OPENING</span>
                    </td>
                    <td style={{ padding: '6px 12px', color: '#64748b' }}>Opening Balance</td>
                    <td style={{ padding: '6px 12px', color: '#334155' }}>Opening Balance brought forward</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right' }}>-</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right' }}>-</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', color: '#0f172a', fontWeight: '800' }}>
                      ₹{Number(statement.opening_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({statement.opening_balance_type})
                    </td>
                    <td style={{ padding: '6px 12px', textAlign: 'center' }}>-</td>
                  </tr>

                  {/* Transactions Rows */}
                  {statement.transactions && statement.transactions.length > 0 ? (
                    statement.transactions.map((r, idx) => {
                      const getBadge = (vt) => {
                        const t = String(vt || '').toLowerCase();
                        if (t.includes('purchase') || t.includes('papad in')) return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
                        if (t.includes('sales') || t.includes('papad return')) return { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' };
                        if (t.includes('debit note') || t.includes('return')) return { bg: '#fef2f2', color: '#b91c1c', border: '#fca5a5' };
                        if (t.includes('credit note')) return { bg: '#fffbe3', color: '#b45309', border: '#fde68a' };
                        if (t.includes('payment') || t.includes('advance')) return { bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe' };
                        if (t.includes('receipt')) return { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' };
                        return { bg: '#f8fafc', color: '#334155', border: '#cbd5e1' };
                      };
                      const badge = getBadge(r.voucher_type);

                      return (
                        <tr 
                          key={idx}
                          style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}
                        >
                          <td style={{ padding: '6px 12px', textAlign: 'center', color: '#94a3b8', fontWeight: '600', fontSize: '11px' }}>{idx + 1}</td>
                          <td style={{ padding: '6px 12px', color: '#334155', fontWeight: '600' }}>{r.date}</td>
                          <td style={{ padding: '6px 12px' }}>
                            <button
                              onClick={() => {
                                setActiveVoucherId(r.voucher_id || r.voucher_no);
                                setVoucherModalOpen(true);
                              }}
                              style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontWeight: '700', fontFamily: 'monospace', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}
                            >
                              {r.voucher_no}
                            </button>
                          </td>
                          <td style={{ padding: '6px 12px' }}>
                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, fontWeight: '700', display: 'inline-block' }}>
                              {r.voucher_type}
                            </span>
                          </td>
                          <td style={{ padding: '6px 12px', color: '#0f172a', fontWeight: '600' }}>
                            {r.particulars}
                            {r.narration && <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'normal', marginTop: '2px' }}>Note: {r.narration}</span>}
                          </td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: '700', color: '#047857' }}>
                            {r.debit > 0 ? `₹${r.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: '700', color: '#b45309' }}>
                            {r.credit > 0 ? `₹${r.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>
                            ₹{r.running_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}{' '}
                            <span style={{ fontSize: '11px', color: r.running_balance >= 0 ? '#047857' : '#b45309' }}>({r.running_balance_type})</span>
                          </td>
                          <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                            <button
                              onClick={() => {
                                setActiveVoucherId(r.voucher_id || r.voucher_no);
                                setVoucherModalOpen(true);
                              }}
                              style={{ padding: '4px 10px', backgroundColor: '#e2e8f0', color: '#1e293b', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                        No transactions recorded for this ledger account in the selected period.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: '800', sticky: 'bottom' }}>
                    <td colSpan={5} style={{ padding: '8px 12px', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Period Totals & Closing Balance:
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#34d399', fontSize: '12px' }}>
                      ₹{Number(statement.period_debit_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#fcd34d', fontSize: '12px' }}>
                      ₹{Number(statement.period_credit_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#ffffff', fontSize: '13px' }}>
                      ₹{Number(statement.closing_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({statement.closing_balance_type})
                    </td>
                    <td style={{ padding: '8px 12px' }}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

        </div>
      ) : null}

      {/* Voucher Detail Journal Modal */}
      {voucherModalOpen && (
        <PurchaseLedgerDetailsModal
          isOpen={voucherModalOpen}
          onClose={() => setVoucherModalOpen(false)}
          purchaseId={activeVoucherId}
        />
      )}
    </div>
  );
};

export default TallyLedgerStatementPage;
