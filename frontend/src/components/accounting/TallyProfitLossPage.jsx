import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const TallyProfitLossPage = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPL();
  }, []);

  const fetchPL = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api('/accounting/dashboard');
      const data = res?.data || res;
      setMetrics(data);
    } catch (err) {
      console.error('Error fetching P&L:', err);
      setError('Failed to compute Profit & Loss statement.');
    } finally {
      setLoading(false);
    }
  };

  const sales = metrics?.sales_total || 0;
  const purchases = metrics?.purchase_total || 0;
  const directExp = metrics?.direct_expenses || 0;
  const grossProfit = sales - purchases - directExp;

  const indirectExp = metrics?.indirect_expenses || 0;
  const netProfit = grossProfit - indirectExp;

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Header Banner */}
      <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #047857 100%)', color: '#ffffff', padding: '18px 24px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
            📈
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#ffffff' }}>Trading & Profit & Loss Statement</h1>
            <p style={{ fontSize: '12px', color: '#a7f3d0', margin: '3px 0 0 0', fontWeight: '500' }}>
              Tally Financial Statement · Gross Trading Profit · Net Operating Earnings
            </p>
          </div>
        </div>

        <button
          onClick={fetchPL}
          style={{ padding: '8px 16px', backgroundColor: '#ffffff', color: '#065f46', fontWeight: '700', borderRadius: '6px', border: 'none', fontSize: '12px', cursor: 'pointer' }}
        >
          🔄 Refresh P&L
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid #047857', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <p style={{ marginTop: '12px', fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Computing trading revenues, purchases & operational expenses...</p>
        </div>
      ) : error ? (
        <div style={{ padding: '16px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: '8px', fontSize: '12px', fontWeight: '600' }}>
          ⚠️ {error}
        </div>
      ) : metrics ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          
          {/* Trading & Operating Expenses Column (Left) */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #cbd5e1', boxShadow: '0 2px 6px rgba(0,0,0,0.04)', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ padding: '14px 20px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#991b1b', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                1. Expenses & Purchases (Debit)
              </h3>
            </div>

            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Raw Material Purchases</span>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>₹{purchases.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Direct Expenses (Freight/Loading)</span>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>₹{directExp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Indirect Expenses (Overheads)</span>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>₹{indirectExp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div style={{ padding: '14px 20px', backgroundColor: '#f1f5f9', borderTop: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#475569', uppercase: 'true' }}>Total Outgoings:</span>
              <span style={{ fontSize: '16px', fontWeight: '800', color: '#991b1b' }}>₹{(purchases + directExp + indirectExp).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Revenue & Gross Profit Column (Right) */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #cbd5e1', boxShadow: '0 2px 6px rgba(0,0,0,0.04)', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ padding: '14px 20px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#065f46', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                2. Incomes & Earnings (Credit)
              </h3>
            </div>

            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#ecfdf5', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#065f46' }}>Gross Sales Revenue</span>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#047857' }}>₹{sales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Gross Trading Profit</span>
                <span style={{ fontSize: '14px', fontWeight: '800', color: grossProfit >= 0 ? '#047857' : '#be123c' }}>
                  ₹{grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: netProfit >= 0 ? '#d1fae5' : '#fef2f2', borderRadius: '6px', border: `1px solid ${netProfit >= 0 ? '#6ee7b7' : '#fca5a5'}` }}>
                <span style={{ fontSize: '13px', fontWeight: '800', color: netProfit >= 0 ? '#065f46' : '#991b1b' }}>NET OPERATING PROFIT</span>
                <span style={{ fontSize: '16px', fontWeight: '800', color: netProfit >= 0 ? '#065f46' : '#991b1b' }}>
                  ₹{netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div style={{ padding: '14px 20px', backgroundColor: '#f1f5f9', borderTop: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#475569', uppercase: 'true' }}>Total Income:</span>
              <span style={{ fontSize: '16px', fontWeight: '800', color: '#047857' }}>₹{sales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

        </div>
      ) : null}
    </div>
  );
};

export default TallyProfitLossPage;
