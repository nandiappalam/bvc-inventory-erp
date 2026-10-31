import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const TallyGroupLedgerStatementPage = () => {
  const navigate = useNavigate();
  const [treeData, setTreeData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedGroups, setExpandedGroups] = useState({});

  useEffect(() => {
    fetchGroupStatement();
  }, []);

  const fetchGroupStatement = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api('/accounting/group-statement');
      const data = res?.data || res || [];
      setTreeData(data);
      // Expand groups by default if they contain ledgers
      const exp = {};
      if (Array.isArray(data)) {
        data.forEach(g => {
          if (g.ledgers && g.ledgers.length > 0) {
            exp[g.id || g.group_name] = true;
          }
        });
      }
      setExpandedGroups(exp);
    } catch (err) {
      console.error('Error fetching group-statement:', err);
      setError('Failed to load group-wise ledger statement.');
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Header Banner */}
      <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)', color: '#ffffff', padding: '18px 24px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
            🗂️
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#ffffff' }}>Group-Wise Ledger Summary Statement</h1>
            <p style={{ fontSize: '12px', color: '#93c5fd', margin: '3px 0 0 0', fontWeight: '500' }}>
              Hierarchical Account Group Summaries · Consolidated Balances · Tally Classification Architecture
            </p>
          </div>
        </div>

        <button
          onClick={fetchGroupStatement}
          style={{ padding: '8px 16px', backgroundColor: '#ffffff', color: '#0f172a', fontWeight: '700', borderRadius: '6px', border: 'none', fontSize: '12px', cursor: 'pointer' }}
        >
          🔄 Refresh Summary
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid #1e3a8a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <p style={{ marginTop: '12px', fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Aggregating group-wise account balances...</p>
        </div>
      ) : error ? (
        <div style={{ padding: '16px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: '8px', fontSize: '12px', fontWeight: '600' }}>
          ⚠️ {error}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {treeData.map((group) => {
            const isExpanded = Boolean(expandedGroups[group.id || group.group_name]);
            const ledgerCount = group.ledgers ? group.ledgers.length : 0;

            return (
              <div 
                key={group.id || group.group_name}
                style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}
              >
                {/* Group Header Row */}
                <div 
                  onClick={() => toggleGroup(group.id || group.group_name)}
                  style={{
                    padding: '14px 20px',
                    backgroundColor: isExpanded ? '#f8fafc' : '#ffffff',
                    borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '14px', color: '#1e3a8a', fontWeight: 'bold' }}>{isExpanded ? '▼' : '▶'}</span>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                          {group.group_name}
                        </h3>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', backgroundColor: '#e2e8f0', color: '#334155', fontWeight: '700' }}>
                          {ledgerCount} {ledgerCount === 1 ? 'Ledger' : 'Ledgers'}
                        </span>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', backgroundColor: '#eff6ff', color: '#1d4ed8', fontWeight: '700', border: '1px solid #bfdbfe' }}>
                          {group.account_nature || 'General'}
                        </span>
                      </div>
                      {group.parent_group_name && (
                        <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '2px' }}>
                          Subgroup of: <strong>{group.parent_group_name}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', display: 'block' }}>
                      Group Closing Balance
                    </span>
                    <span style={{ fontSize: '16px', fontWeight: '800', color: '#1e3a8a' }}>
                      ₹{Number(group.closing_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}{' '}
                      <span style={{ fontSize: '12px', color: '#2563eb' }}>({group.closing_balance_type || 'Dr'})</span>
                    </span>
                  </div>
                </div>

                {/* Sub-Ledgers List Table */}
                {isExpanded && (
                  <div style={{ padding: '0 16px 16px 16px', backgroundColor: '#f8fafc' }}>
                    {ledgerCount > 0 ? (
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px', marginTop: '10px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#e2e8f0', color: '#334155', fontWeight: '800', textTransform: 'uppercase', fontSize: '11px' }}>
                            <th style={{ padding: '8px 12px' }}>Ledger Account Name</th>
                            <th style={{ padding: '8px 12px' }}>GSTIN / Ref</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>Opening Balance</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>Period Debit (Dr)</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>Period Credit (Cr)</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>Closing Balance</th>
                            <th style={{ padding: '8px 12px', textAlign: 'center', width: '100px' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.ledgers.map((l, lIdx) => (
                            <tr 
                              key={lIdx}
                              style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}
                            >
                              <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0f172a' }}>
                                {l.ledger_name}
                              </td>
                              <td style={{ padding: '10px 12px', color: '#64748b', fontFamily: 'monospace' }}>
                                {l.gst_no || '—'}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>
                                ₹{Number(l.opening_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({l.opening_balance_type || 'Dr'})
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#047857' }}>
                                {Number(l.debit_total || 0) > 0 ? `₹${Number(l.debit_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#b45309' }}>
                                {Number(l.credit_total || 0) > 0 ? `₹${Number(l.credit_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '800', color: '#1e3a8a' }}>
                                ₹{Number(l.closing_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}{' '}
                                <span style={{ fontSize: '11px', color: '#2563eb' }}>({l.closing_balance_type || 'Dr'})</span>
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <button
                                  onClick={() => navigate(`/accounting/ledger-statement?ledger_id=${l.id}&ledger_name=${encodeURIComponent(l.ledger_name)}`)}
                                  style={{ padding: '4px 10px', backgroundColor: '#1d4ed8', color: '#ffffff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                                >
                                  Statement →
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div style={{ padding: '16px', textStyle: 'italic', color: '#94a3b8', fontSize: '12px' }}>
                        No ledgers currently configured under {group.group_name}.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TallyGroupLedgerStatementPage;
