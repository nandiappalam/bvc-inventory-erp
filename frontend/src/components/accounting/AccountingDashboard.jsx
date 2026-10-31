import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const AccountingDashboard = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api('/accounting/dashboard');
      const data = res?.data || res;
      setMetrics(data);
    } catch (err) {
      console.error('Error loading accounting dashboard:', err);
      setError('Failed to load accounting metrics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top Header Banner */}
      <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #1e3a8a 50%, #0f172a 100%)', color: '#ffffff', padding: '20px 24px', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyBetween: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
              📊
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: '800', margin: 0, tracking: '-0.02em', color: '#ffffff' }}>Accounts & Finance Command Center</h1>
              <p style={{ fontSize: '13px', color: '#93c5fd', margin: '4px 0 0 0', fontWeight: '500' }}>
                Tally-Style Accounting System · Automated Double-Entry Ledger Engine · Real-time Financial Statements
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => navigate('/accounting/ledger-statement')}
            style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: '#ffffff', fontWeight: '700', borderRadius: '8px', border: 'none', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }}
          >
            <span>📑</span>
            <span>Ledger Statement</span>
          </button>
          <button
            onClick={() => navigate('/accounting/day-book')}
            style={{ padding: '8px 16px', backgroundColor: '#059669', color: '#ffffff', fontWeight: '700', borderRadius: '8px', border: 'none', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }}
          >
            <span>📖</span>
            <span>Day Book</span>
          </button>
          <button
            onClick={fetchDashboard}
            style={{ padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.15)', color: '#ffffff', fontWeight: '700', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', fontSize: '12px', cursor: 'pointer' }}
            title="Refresh Accounting Data"
          >
            🔄
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'inline-block', width: '36px', height: '36px', border: '3px solid #1e3a8a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <p style={{ marginTop: '12px', fontSize: '14px', color: '#64748b', fontWeight: '600' }}>Computing accounting ledger totals & trial balances...</p>
        </div>
      ) : error ? (
        <div style={{ padding: '16px 20px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: '10px', fontSize: '13px', fontWeight: '600', marginBottom: '20px' }}>
          ⚠️ {error}
        </div>
      ) : metrics ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Trial Balance Status Indicator Banner */}
          <div style={{
            backgroundColor: metrics.is_balanced ? '#ecfdf5' : '#fff1f2',
            border: `1px solid ${metrics.is_balanced ? '#6ee7b7' : '#fda4af'}`,
            padding: '14px 20px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>{metrics.is_balanced ? '✅' : '⚠️'}</span>
              <div>
                <span style={{ fontSize: '14px', fontWeight: '800', color: metrics?.is_balanced ? '#065f46' : '#9f1239' }}>
                  {metrics?.is_balanced ? 'Tally Double-Entry Trial Balance: FULLY BALANCED' : 'Trial Balance Imbalance Detected'}
                </span>
                <span style={{ display: 'block', fontSize: '12px', color: metrics?.is_balanced ? '#047857' : '#be123c', fontWeight: '500' }}>
                  Total Debits: ₹{Number(metrics?.total_debits || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} · Total Credits: ₹{Number(metrics?.total_credits || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <button
              onClick={() => navigate('/accounting/trial-balance')}
              style={{ padding: '6px 14px', backgroundColor: metrics?.is_balanced ? '#047857' : '#be123c', color: '#ffffff', fontWeight: '700', borderRadius: '6px', border: 'none', fontSize: '12px', cursor: 'pointer' }}
            >
              Open Trial Balance →
            </button>
          </div>

          {/* Key Metric Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '16px' }}>
            <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', justifyBetween: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cash-In-Hand</span>
              <div style={{ marginTop: '8px' }}>
                <span style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a' }}>₹{Number(metrics?.cash_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                <span style={{ display: 'block', fontSize: '11px', color: '#10b981', fontWeight: '600', marginTop: '2px' }}>Liquid Cash Ledger</span>
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', justifyBetween: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bank Accounts</span>
              <div style={{ marginTop: '8px' }}>
                <span style={{ fontSize: '22px', fontWeight: '800', color: '#1e3a8a' }}>₹{Number(metrics?.bank_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                <span style={{ display: 'block', fontSize: '11px', color: '#2563eb', fontWeight: '600', marginTop: '2px' }}>Bank Books & Clearings</span>
              </div>
            </div>

            <div style={{ backgroundColor: '#fffbeb', padding: '16px', borderRadius: '10px', border: '1px solid #fde68a', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', justifyBetween: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Supplier Payable (Sundry Creditors)</span>
              <div style={{ marginTop: '8px' }}>
                <span style={{ fontSize: '22px', fontWeight: '800', color: '#78350f' }}>₹{Number(metrics?.supplier_outstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                <span style={{ display: 'block', fontSize: '11px', color: '#b45309', fontWeight: '600', marginTop: '2px' }}>Total Outstanding Liability</span>
              </div>
            </div>

            <div style={{ backgroundColor: '#eff6ff', padding: '16px', borderRadius: '10px', border: '1px solid #bfdbfe', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', justifyBetween: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customer Receivable (Sundry Debtors)</span>
              <div style={{ marginTop: '8px' }}>
                <span style={{ fontSize: '22px', fontWeight: '800', color: '#1e3a8a' }}>₹{Number(metrics?.customer_outstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                <span style={{ display: 'block', fontSize: '11px', color: '#1d4ed8', fontWeight: '600', marginTop: '2px' }}>Total Trade Receivables</span>
              </div>
            </div>
          </div>

          {/* Operational Accounts Breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' }}>
            {/* Purchase vs Sales */}
            <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '800', color: '#1e293b', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trading Accounts</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>Purchase Total (Dr):</span>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>₹{Number(metrics?.purchase_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>Sales Total (Cr):</span>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: '#047857' }}>₹{Number(metrics?.sales_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Direct & Indirect Expenses */}
            <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '800', color: '#1e293b', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Expense Accounts</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>Direct Expenses (Freight/Loading):</span>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: '#b91c1c' }}>₹{Number(metrics?.direct_expenses || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>Indirect Expenses:</span>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: '#c2410c' }}>₹{Number(metrics?.indirect_expenses || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* GST Duties & Taxes */}
            <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '800', color: '#1e293b', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duties & Taxes (GST)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: '#ecfdf5', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                  <span style={{ fontSize: '12px', color: '#065f46', fontWeight: '600' }}>Input GST Credit (Dr):</span>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: '#047857' }}>₹{Number(metrics?.gst_input_credit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: '#fffbe1', borderRadius: '6px', border: '1px solid #fef08a' }}>
                  <span style={{ fontSize: '12px', color: '#854d0e', fontWeight: '600' }}>Output GST Payable (Cr):</span>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: '#a16207' }}>₹{Number(metrics?.gst_output_tax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Access Accounting Tools */}
          <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 style={{ fontSize: '13px', fontWeight: '800', color: '#1e293b', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Financial Navigation & Tally Modules
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px' }}>
              {[
                { title: 'Ledger Group Master', desc: 'Category & Subgroup Tree', icon: '📂', path: '/master/ledger-group-display' },
                { title: 'Ledger Master', desc: 'Account Ledgers & Parties', icon: '👤', path: '/master/ledger-display' },
                { title: 'Individual Ledger Statement', desc: 'Running Balance & Transactions', icon: '📑', path: '/accounting/ledger-statement' },
                { title: 'Group-Wise Ledger Statement', desc: 'Hierarchical Group Balances', icon: '🗂️', path: '/accounting/group-statement' },
                { title: 'Day Book', desc: 'Daily Voucher Register', icon: '📖', path: '/accounting/day-book' },
                { title: 'Trial Balance', desc: 'Dr = Cr Reconciliation', icon: '⚖️', path: '/accounting/trial-balance' },
                { title: 'Profit & Loss Statement', desc: 'Income vs Expense Report', icon: '📈', path: '/accounting/profit-loss' },
                { title: 'Balance Sheet', desc: 'Assets & Liabilities Statement', icon: '🏛️', path: '/accounting/balance-sheet' },
                { title: 'Tally Import / Export', desc: 'TallyPrime XML Exchange', icon: '⇄', path: '/accounting/tally-exchange' }
              ].map((m, idx) => (
                <div
                  key={idx}
                  onClick={() => navigate(m.path)}
                  style={{
                    backgroundColor: '#f8fafc',
                    padding: '14px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                >
                  <div style={{ fontSize: '20px' }}>{m.icon}</div>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', display: 'block' }}>{m.title}</span>
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{m.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      ) : null}
    </div>
  );
};

export default AccountingDashboard;
