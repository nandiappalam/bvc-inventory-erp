import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const TallyTrialBalancePage = () => {
  const navigate = useNavigate();
  const [tbData, setTbData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTrialBalance();
  }, []);

  const fetchTrialBalance = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api('/accounting/trial-balance');
      const data = res?.data || res;
      setTbData(data);
    } catch (err) {
      console.error('Error fetching Trial Balance:', err);
      setError('Failed to calculate Trial Balance.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Header Banner */}
      <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #0f172a 100%)', color: '#ffffff', padding: '18px 24px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
            ⚖️
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#ffffff' }}>Double-Entry Trial Balance Statement</h1>
            <p style={{ fontSize: '12px', color: '#c7d2fe', margin: '3px 0 0 0', fontWeight: '500' }}>
              Tally-Style Account Ledger Verification · Automated Debit & Credit Equality Check
            </p>
          </div>
        </div>

        <button
          onClick={fetchTrialBalance}
          style={{ padding: '8px 16px', backgroundColor: '#ffffff', color: '#1e1b4b', fontWeight: '700', borderRadius: '6px', border: 'none', fontSize: '12px', cursor: 'pointer' }}
        >
          🔄 Re-calculate
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid #312e81', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <p style={{ marginTop: '12px', fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Computing debit and credit balances for all active ledgers...</p>
        </div>
      ) : error ? (
        <div style={{ padding: '16px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: '8px', fontSize: '12px', fontWeight: '600' }}>
          ⚠️ {error}
        </div>
      ) : tbData ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Status Indicator */}
          <div style={{
            backgroundColor: tbData.is_balanced ? '#ecfdf5' : '#fff1f2',
            border: `1px solid ${tbData.is_balanced ? '#6ee7b7' : '#fda4af'}`,
            padding: '14px 20px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>{tbData.is_balanced ? '✅' : '⚠️'}</span>
              <div>
                <span style={{ fontSize: '14px', fontWeight: '800', color: tbData.is_balanced ? '#065f46' : '#9f1239' }}>
                  {tbData.is_balanced ? 'Trial Balance is Fully Reconciled (Debit = Credit)' : 'Trial Balance Out of Balance'}
                </span>
                <span style={{ display: 'block', fontSize: '12px', color: tbData.is_balanced ? '#047857' : '#be123c', fontWeight: '500' }}>
                  Total Debits: ₹{tbData.grand_debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })} · Total Credits: ₹{tbData.grand_credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <span style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '12px', backgroundColor: '#ffffff', color: '#334155', fontWeight: '700', border: '1px solid #cbd5e1' }}>
              Double-Entry Standard
            </span>
          </div>

          {/* Trial Balance Table */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #cbd5e1', boxShadow: '0 2px 6px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                Particulars (Ledger Accounts & Groups)
              </h3>
              <span style={{ fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '12px', backgroundColor: '#e2e8f0', color: '#334155' }}>
                {tbData.rows?.length || 0} Accounts
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', color: '#334155', borderBottom: '1px solid #cbd5e1', fontWeight: '800', textTransform: 'uppercase', fontSize: '11px' }}>
                    <th style={{ padding: '10px 12px', width: '50px', textAlign: 'center' }}>S.No</th>
                    <th style={{ padding: '10px 12px' }}>Ledger Account Name</th>
                    <th style={{ padding: '10px 12px', width: '180px' }}>Parent Group</th>
                    <th style={{ padding: '10px 12px', width: '130px' }}>Account Nature</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', width: '160px' }}>Debit Amount (Dr)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', width: '160px' }}>Credit Amount (Cr)</th>
                    <th style={{ padding: '10px 12px', width: '90px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tbData.rows && tbData.rows.length > 0 ? (
                    tbData.rows.map((row, idx) => (
                      <tr 
                        key={idx}
                        style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}
                      >
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>{idx + 1}</td>
                        <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0f172a' }}>
                          {row.ledger_name}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#475569', fontWeight: '500' }}>
                          {row.group_name || 'General'}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#eff6ff', color: '#1e40af', fontWeight: '700', border: '1px solid #bfdbfe' }}>
                            {row.account_nature || 'Expense'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#047857' }}>
                          {row.debit_amount > 0 ? `₹${row.debit_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#b45309' }}>
                          {row.credit_amount > 0 ? `₹${row.credit_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <button
                            onClick={() => navigate(`/accounting/ledger-statement?ledger_id=${row.id}&ledger_name=${encodeURIComponent(row.ledger_name)}`)}
                            style={{ padding: '4px 8px', backgroundColor: '#1d4ed8', color: '#ffffff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                          >
                            Statement
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                        No trial balance rows available.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: '800' }}>
                    <td colSpan={4} style={{ padding: '12px', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Grand Total (Trial Balance):
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#34d399', fontSize: '14px' }}>
                      ₹{tbData.grand_debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#fcd34d', fontSize: '14px' }}>
                      ₹{tbData.grand_credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', color: tbData.is_balanced ? '#34d399' : '#fca5a5' }}>
                      {tbData.is_balanced ? '✅ OK' : '⚠️ Diff'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

        </div>
      ) : null}
    </div>
  );
};

export default TallyTrialBalancePage;
