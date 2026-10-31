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
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      
      {/* Top Header Bar */}
      <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#ffffff', padding: '20px 28px', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
            📑
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#ffffff', letterSpacing: '-0.02em' }}>Professional Ledger Statement</h1>
              <span style={{ fontSize: '11px', padding: '2px 10px', borderRadius: '12px', backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', fontWeight: '700', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                Tally Double-Entry
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0', fontWeight: '500' }}>
              Complete chronological running balances, party liabilities & voucher audit trails
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate('/accounting/dashboard')}
            style={{ padding: '8px 16px', backgroundColor: 'rgba(255,255,255,0.1)', color: '#ffffff', fontWeight: '700', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>📊</span>
            <span>Accounts Dashboard</span>
          </button>
          <button
            onClick={handlePrint}
            style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: '#ffffff', fontWeight: '700', borderRadius: '8px', border: 'none', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }}
          >
            <span>🖨️</span>
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Advanced Filter & Selection Card */}
      <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', marginBottom: '24px', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '16px', alignItems: 'end' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Select Ledger Account *</label>
          <select
            value={selectedLedgerId}
            onChange={handleLedgerChange}
            style={{ width: '100%', height: '40px', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: '700', color: '#0f172a', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
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
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={{ width: '100%', height: '40px', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', color: '#0f172a', boxSizing: 'border-box', backgroundColor: '#ffffff' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={{ width: '100%', height: '40px', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', color: '#0f172a', boxSizing: 'border-box', backgroundColor: '#ffffff' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Voucher Type</label>
          <select
            value={voucherType}
            onChange={(e) => setVoucherType(e.target.value)}
            style={{ width: '100%', height: '40px', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', color: '#0f172a', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
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

        <div>
          <button
            onClick={fetchStatement}
            style={{ width: '100%', height: '40px', backgroundColor: '#1d4ed8', color: '#ffffff', fontWeight: '700', borderRadius: '8px', border: 'none', fontSize: '12px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
          >
            🔍 Search & Filter
          </button>
        </div>
      </div>

      {/* Main Statement Content View */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'inline-block', width: '36px', height: '36px', border: '3px solid #1d4ed8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <p style={{ marginTop: '14px', fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Computing account ledger statement & running balances...</p>
        </div>
      ) : error ? (
        <div style={{ padding: '16px 20px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: '10px', fontSize: '13px', fontWeight: '600' }}>
          ⚠️ {error}
        </div>
      ) : statement ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Account Summary Metrics Top Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '16px' }}>
            <div style={{ backgroundColor: '#ffffff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Opening Balance</span>
              <div style={{ marginTop: '8px' }}>
                <span style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a' }}>
                  ₹{Number(statement.opening_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span style={{ display: 'inline-block', marginLeft: '6px', fontSize: '12px', fontWeight: '700', color: '#2563eb' }}>
                  ({statement.opening_balance_type || 'Dr'})
                </span>
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Period Total Debit (Dr)</span>
              <div style={{ marginTop: '8px' }}>
                <span style={{ fontSize: '22px', fontWeight: '800', color: '#047857' }}>
                  ₹{Number(statement.period_debit_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span style={{ display: 'block', fontSize: '11px', color: '#059669', fontWeight: '600', marginTop: '2px' }}>Total Inflows / Expenses</span>
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Period Total Credit (Cr)</span>
              <div style={{ marginTop: '8px' }}>
                <span style={{ fontSize: '22px', fontWeight: '800', color: '#b45309' }}>
                  ₹{Number(statement.period_credit_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span style={{ display: 'block', fontSize: '11px', color: '#d97706', fontWeight: '600', marginTop: '2px' }}>Total Outflows / Income</span>
              </div>
            </div>

            <div style={{ backgroundColor: '#eff6ff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #bfdbfe', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Closing Balance</span>
              <div style={{ marginTop: '8px' }}>
                <span style={{ fontSize: '22px', fontWeight: '800', color: '#1e3a8a' }}>
                  ₹{Number(statement.closing_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span style={{ display: 'inline-block', marginLeft: '6px', fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>
                  ({statement.closing_balance_type || 'Cr'})
                </span>
              </div>
            </div>
          </div>

          {/* Ledger Transactions Table Component */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                  {statement.ledger?.ledger_name} <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>({statement.ledger?.group_name || 'General Group'})</span>
                </h3>
              </div>
              <span style={{ fontSize: '11px', fontWeight: '700', padding: '4px 12px', borderRadius: '12px', backgroundColor: '#e2e8f0', color: '#334155' }}>
                {statement.transactions?.length || 0} Posted Entries
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', color: '#334155', borderBottom: '1px solid #cbd5e1', fontWeight: '800', textTransform: 'uppercase', fontSize: '11px' }}>
                    <th style={{ padding: '12px 16px', width: '50px', textAlign: 'center' }}>S.No</th>
                    <th style={{ padding: '12px 16px', width: '100px' }}>Date</th>
                    <th style={{ padding: '12px 16px', width: '130px' }}>Voucher No</th>
                    <th style={{ padding: '12px 16px', width: '120px' }}>Voucher Type</th>
                    <th style={{ padding: '12px 16px' }}>Particulars / Transaction Trace</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', width: '130px' }}>Debit (Dr)</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', width: '130px' }}>Credit (Cr)</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', width: '160px' }}>Running Balance</th>
                    <th style={{ padding: '12px 16px', width: '90px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Opening Balance Row */}
                  <tr style={{ backgroundColor: '#f8fafc', fontWeight: '700', borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: '#94a3b8' }}>-</td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>-</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#475569' }}>OPENING</td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>Opening</td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>Opening Balance brought forward</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>-</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>-</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#0f172a' }}>
                      ₹{Number(statement.opening_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({statement.opening_balance_type})
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>-</td>
                  </tr>

                  {/* Transactions Rows */}
                  {statement.transactions && statement.transactions.length > 0 ? (
                    statement.transactions.map((r, idx) => (
                      <tr 
                        key={idx}
                        style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}
                      >
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>{r.s_no}</td>
                        <td style={{ padding: '12px 16px', color: '#334155', fontWeight: '600' }}>{r.date}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <button
                            onClick={() => {
                              setActiveVoucherId(r.voucher_id || r.voucher_no);
                              setVoucherModalOpen(true);
                            }}
                            style={{ background: 'none', border: 'none', color: '#1d4ed8', fontWeight: '700', fontFamily: 'monospace', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                          >
                            {r.voucher_no}
                          </button>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '6px', backgroundColor: '#eff6ff', color: '#1e40af', fontWeight: '700', border: '1px solid #bfdbfe' }}>
                            {r.voucher_type}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#0f172a', fontWeight: '600' }}>
                          {r.particulars}
                          {r.narration && <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'normal', marginTop: '3px' }}>Note: {r.narration}</span>}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', color: '#047857' }}>
                          {r.debit > 0 ? `₹${r.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', color: '#b45309' }}>
                          {r.credit > 0 ? `₹${r.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>
                          ₹{r.running_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}{' '}
                          <span style={{ fontSize: '11px', color: '#2563eb' }}>({r.running_balance_type})</span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <button
                            onClick={() => {
                              setActiveVoucherId(r.voucher_id || r.voucher_no);
                              setVoucherModalOpen(true);
                            }}
                            style={{ padding: '6px 12px', backgroundColor: '#e2e8f0', color: '#1e293b', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                          >
                            View Journal
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                        No transactions recorded for this ledger account in the selected period.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: '800' }}>
                    <td colSpan={5} style={{ padding: '14px 16px', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Period Totals & Closing Balance:
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: '#34d399', fontSize: '13px' }}>
                      ₹{Number(statement.period_debit_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: '#fcd34d', fontSize: '13px' }}>
                      ₹{Number(statement.period_credit_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: '#ffffff', fontSize: '14px' }}>
                      ₹{Number(statement.closing_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({statement.closing_balance_type})
                    </td>
                    <td style={{ padding: '14px 16px' }}></td>
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
