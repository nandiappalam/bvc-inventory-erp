import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const TallyBalanceSheetPage = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBS();
  }, []);

  const fetchBS = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api('/accounting/dashboard');
      const data = res?.data || res;
      setMetrics(data);
    } catch (err) {
      console.error('Error fetching Balance Sheet:', err);
      setError('Failed to compute Balance Sheet statement.');
    } finally {
      setLoading(false);
    }
  };

  const cash = metrics?.cash_balance || 0;
  const bank = metrics?.bank_balance || 0;
  const debtors = metrics?.customer_outstanding || 0;
  const gstInput = metrics?.gst_input_credit || 0;
  const totalAssets = cash + bank + debtors + gstInput;

  const creditors = metrics?.supplier_outstanding || 0;
  const gstOutput = metrics?.gst_output_tax || 0;
  const sales = metrics?.sales_total || 0;
  const purchases = metrics?.purchase_total || 0;
  const exp = (metrics?.direct_expenses || 0) + (metrics?.indirect_expenses || 0);
  const netProfit = sales - purchases - exp;
  const totalLiabilities = creditors + gstOutput + (netProfit > 0 ? netProfit : 0);

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Header Banner */}
      <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #1e3a8a 100%)', color: '#ffffff', padding: '18px 24px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
            🏛️
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#ffffff' }}>Financial Balance Sheet Statement</h1>
            <p style={{ fontSize: '12px', color: '#93c5fd', margin: '3px 0 0 0', fontWeight: '500' }}>
              Tally Accounting Balance Sheet · Capital & Liabilities vs Assets & Receivables
            </p>
          </div>
        </div>

        <button
          onClick={fetchBS}
          style={{ padding: '8px 16px', backgroundColor: '#ffffff', color: '#1e3a8a', fontWeight: '700', borderRadius: '6px', border: 'none', fontSize: '12px', cursor: 'pointer' }}
        >
          🔄 Refresh Statement
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid #1e3a8a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <p style={{ marginTop: '12px', fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Computing assets, receivables, capital & liabilities...</p>
        </div>
      ) : error ? (
        <div style={{ padding: '16px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: '8px', fontSize: '12px', fontWeight: '600' }}>
          ⚠️ {error}
        </div>
      ) : metrics ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          
          {/* Capital & Liabilities Column (Left) */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #cbd5e1', boxShadow: '0 2px 6px rgba(0,0,0,0.04)', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ padding: '14px 20px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#78350f', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Capital & Liabilities
              </h3>
            </div>

            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#fffbeb', borderRadius: '6px', border: '1px solid #fde68a' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#78350f' }}>Sundry Creditors (Trade Payables)</span>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#78350f' }}>₹{creditors.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Duties & Taxes Payable (Output GST)</span>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>₹{gstOutput.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              {netProfit > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#ecfdf5', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#065f46' }}>Net Profit Reserve (Retained)</span>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: '#047857' }}>₹{netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>

            <div style={{ padding: '14px 20px', backgroundColor: '#f1f5f9', borderTop: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#475569', uppercase: 'true' }}>Total Liabilities:</span>
              <span style={{ fontSize: '16px', fontWeight: '800', color: '#78350f' }}>₹{totalLiabilities.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Fixed & Current Assets Column (Right) */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #cbd5e1', boxShadow: '0 2px 6px rgba(0,0,0,0.04)', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ padding: '14px 20px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#1e40af', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Assets & Receivables
              </h3>
            </div>

            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e40af' }}>Sundry Debtors (Trade Receivables)</span>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#1e3a8a' }}>₹{debtors.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Cash & Bank Balances</span>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>₹{(cash + bank).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Input GST Credit Reserve</span>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>₹{gstInput.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div style={{ padding: '14px 20px', backgroundColor: '#f1f5f9', borderTop: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#475569', uppercase: 'true' }}>Total Assets:</span>
              <span style={{ fontSize: '16px', fontWeight: '800', color: '#1e3a8a' }}>₹{totalAssets.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

        </div>
      ) : null}
    </div>
  );
};

export default TallyBalanceSheetPage;
