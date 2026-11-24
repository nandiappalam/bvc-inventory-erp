import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext';
import { exportToExcel } from '../utils/exportHelper';
import { printHtml } from '../utils/printHelper';

const escHtml = (val) =>
  String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatDateDMY = (val) => {
  if (!val) return '—';
  const m = String(val).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : String(val).slice(0, 10) || '—';
};

const CapaReports = () => {
  const navigate = useNavigate();
  const { selectedCompany, financialYear } = useAuth();

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState({
    kpis: {},
    monthlyTrends: [],
    categoryBreakdown: [],
    rcaMethodBreakdown: [],
    topRootCauses: [],
    ownerPerformance: [],
    productDefects: [],
    overdueList: []
  });

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      if (fromDate) qs.set('from_date', fromDate);
      if (toDate) qs.set('to_date', toDate);
      const res = await api(`/capa/reports/summary${qs.toString() ? `?${qs.toString()}` : ''}`);
      if (res?.data) setReport(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load CAPA analytics');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const kpis = report.kpis || {};
  const maxTrendVal = Math.max(1, ...(report.monthlyTrends || []).map((m) => Math.max(m.complaints || 0, m.capas || 0)));

  const handleExport = () => {
    const out = (report.ownerPerformance || []).map((o) => ({
      'Action Owner': o.person,
      'Total CAPAs': o.total,
      Open: o.open,
      Closed: o.closed,
      Effective: o.effective,
      Overdue: o.overdue
    }));
    exportToExcel(out, 'CAPA_Analytics_Report');
  };

  const handlePrint = () => {
    const trendRows = (report.monthlyTrends || [])
      .map((m) => `<tr><td>${escHtml(m.month)}</td><td>${m.complaints}</td><td>${m.capas}</td><td>${m.closed}</td><td>${m.effective}</td></tr>`)
      .join('');
    const rcRows = (report.topRootCauses || [])
      .map((r) => `<tr><td>${escHtml(r.root_cause)}</td><td>${r.count}</td><td>${r.closed}</td><td>${r.effective}</td></tr>`)
      .join('');
    printHtml(
      `<div style="font-family:Arial,sans-serif;font-size:12px;">
        <h2 style="color:#1e3a8a;">${escHtml(selectedCompany?.name || 'BVC ERP')} — CAPA &amp; Complaint Analytics Report</h2>
        <p>Complaints: <strong>${kpis.total_complaints || 0}</strong> · Total CAPAs: <strong>${kpis.total_capas || 0}</strong> · Closed: <strong>${kpis.closed_capas || 0}</strong> · Effectiveness Rate: <strong>${kpis.effectiveness_rate || 0}%</strong></p>
        <h3>Monthly Trends</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:14px;" border="1" cellpadding="5">
          <tr style="background:#1f4fb2;color:#fff;"><th>Month</th><th>Complaints</th><th>CAPAs</th><th>Closed</th><th>Effective</th></tr>
          ${trendRows || '<tr><td colspan="5">No data</td></tr>'}
        </table>
        <h3>Top Root Causes</h3>
        <table style="width:100%;border-collapse:collapse;" border="1" cellpadding="5">
          <tr style="background:#1f4fb2;color:#fff;"><th>Root Cause</th><th>Count</th><th>Closed</th><th>Effective</th></tr>
          ${rcRows || '<tr><td colspan="4">No root causes recorded</td></tr>'}
        </table>
      </div>`,
      { title: 'CAPA & Complaint Analytics Report' }
    );
  };

  return (
    <div style={{ padding: '14px 16px 32px', backgroundColor: '#f1f5f9', minHeight: '100vh', fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1f4fb2 0%, #1e3a8a 100%)', color: '#fff', padding: '12px 18px', borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button type="button" onClick={() => navigate(-1)} style={{ backgroundColor: '#fff', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '5px', padding: '6px 12px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
            ← Back
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 800 }}>CAPA Reports &amp; Quality Analytics</h2>
            <div style={{ fontSize: '11px', color: '#dbeafe' }}>
              {selectedCompany?.name || 'BVC Company'} · FY {financialYear} · Complaint Trends, Root Causes &amp; Action Effectiveness
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ height: '32px', padding: '4px 8px', borderRadius: '5px', border: 'none', fontSize: '12px' }} />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ height: '32px', padding: '4px 8px', borderRadius: '5px', border: 'none', fontSize: '12px' }} />
          <button type="button" onClick={loadReport} style={{ backgroundColor: '#fff', color: '#1e293b', border: 'none', borderRadius: '5px', padding: '7px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
            ↻ Refresh
          </button>
          <button type="button" onClick={handleExport} style={{ backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '5px', padding: '7px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
            Export Excel
          </button>
          <button type="button" onClick={handlePrint} style={{ backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '5px', padding: '7px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
            Print Report
          </button>
          <button type="button" onClick={() => navigate('/entry/capa-display')} style={{ backgroundColor: '#f59e0b', color: '#0f172a', border: 'none', borderRadius: '5px', padding: '7px 14px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>
            CAPA Register
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', padding: '14px 16px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
        <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Customer Complaints</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#1e3a8a' }}>{kpis.total_complaints || 0}</div>
          <div style={{ fontSize: '11px', color: '#475569' }}>{kpis.open_complaints || 0} open / under investigation</div>
        </div>
        <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>Total CAPA Documents</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#1d4ed8' }}>{kpis.total_capas || 0}</div>
          <div style={{ fontSize: '11px', color: '#475569' }}>Open: {kpis.open_capas || 0} · In Prog: {kpis.in_progress_capas || 0} · Verif: {kpis.verification_capas || 0}</div>
        </div>
        <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>Effectiveness Rate</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#16a34a' }}>{kpis.effectiveness_rate || 0}%</div>
          <div style={{ fontSize: '11px', color: '#475569' }}>{kpis.effective_capas || 0} Effective / {kpis.closed_capas || 0} Closed</div>
        </div>
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>Overdue CAPA Actions</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#dc2626' }}>{kpis.overdue_capas || 0}</div>
          <div style={{ fontSize: '11px', color: '#475569' }}>Target date passed &amp; not closed</div>
        </div>
      </div>

      {error && (
        <div style={{ marginTop: '10px', padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontWeight: 700 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>Computing CAPA analytics...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '14px' }}>
          {/* Monthly Trends */}
          <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1', fontWeight: 800, color: '#1e3a8a', fontSize: '13px' }}>
              1. Monthly Complaint &amp; CAPA Trend
            </div>
            <div style={{ padding: '12px 14px' }}>
              {(report.monthlyTrends || []).length === 0 ? (
                <div style={{ color: '#64748b', fontSize: '12px' }}>No trend data available for selected period.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#1f4fb2', color: '#fff' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Month</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Complaints</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>CAPAs</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Closed</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Effective</th>
                      <th style={{ padding: '6px 8px', width: '120px' }}>Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.monthlyTrends.map((m) => (
                      <tr key={m.month} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 700 }}>{m.month}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{m.complaints}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{m.capas}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#166534' }}>{m.closed}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#0369a1' }}>{m.effective}</td>
                        <td style={{ padding: '6px 8px' }}>
                          <div style={{ backgroundColor: '#e2e8f0', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.round(((m.complaints + m.capas) / (maxTrendVal * 2)) * 100)}%`, backgroundColor: '#1f4fb2', height: '100%' }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Complaint Categories & RCA Methods */}
          <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1', fontWeight: 800, color: '#1e3a8a', fontSize: '13px' }}>
              2. Complaint Category &amp; RCA Method Distribution
            </div>
            <div style={{ padding: '12px 14px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1f4fb2', color: '#fff' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>Category</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Complaints</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Return Req</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>CAPAs</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.categoryBreakdown || []).length === 0 ? (
                    <tr><td colSpan={4} style={{ padding: '8px', color: '#64748b' }}>No category data yet.</td></tr>
                  ) : (
                    report.categoryBreakdown.map((c) => (
                      <tr key={c.category} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 700 }}>{c.category}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{c.complaints}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{c.return_required}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{c.capas}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>RCA Methods Used</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {(report.rcaMethodBreakdown || []).map((rm) => (
                  <span key={rm.method} style={{ padding: '4px 10px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '5px', fontSize: '12px', fontWeight: 700, color: '#1e3a8a' }}>
                    {rm.method}: {rm.count}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Top Root Causes */}
          <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1', fontWeight: 800, color: '#1e3a8a', fontSize: '13px' }}>
              3. Top Identified Root Causes
            </div>
            <div style={{ padding: '12px 14px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1f4fb2', color: '#fff' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>Root Cause</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Count</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Closed</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Effective</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.topRootCauses || []).length === 0 ? (
                    <tr><td colSpan={4} style={{ padding: '10px', color: '#64748b' }}>No root causes documented yet.</td></tr>
                  ) : (
                    report.topRootCauses.map((rc, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 600 }}>{rc.root_cause}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{rc.count}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{rc.closed}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#166534', fontWeight: 700 }}>{rc.effective}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Owner Effectiveness */}
          <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1', fontWeight: 800, color: '#1e3a8a', fontSize: '13px' }}>
              4. Action Owner Performance &amp; Effectiveness
            </div>
            <div style={{ padding: '12px 14px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1f4fb2', color: '#fff' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>Responsible Person</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Total</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Open</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Closed</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Effective</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.ownerPerformance || []).length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: '10px', color: '#64748b' }}>No CAPA owners recorded yet.</td></tr>
                  ) : (
                    report.ownerPerformance.map((ow, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 700 }}>{ow.person}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{ow.total}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{ow.open}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#166534' }}>{ow.closed}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#0369a1', fontWeight: 700 }}>{ow.effective}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: ow.overdue > 0 ? '#dc2626' : '#64748b', fontWeight: ow.overdue > 0 ? 800 : 400 }}>{ow.overdue}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Product Defect Concentration */}
          <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1', fontWeight: 800, color: '#1e3a8a', fontSize: '13px' }}>
              5. Product Defect &amp; Return Concentration
            </div>
            <div style={{ padding: '12px 14px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1f4fb2', color: '#fff' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>Product Name</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>CAPAs</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Complaint Qty</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Returned Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.productDefects || []).length === 0 ? (
                    <tr><td colSpan={4} style={{ padding: '10px', color: '#64748b' }}>No product defect lines recorded yet.</td></tr>
                  ) : (
                    report.productDefects.map((p, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 700 }}>{p.product_name}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{p.capas}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{p.complaint_qty}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{p.returned_qty}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Overdue Actions List */}
          <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', borderBottom: '1px solid #fecaca', fontWeight: 800, color: '#991b1b', fontSize: '13px' }}>
              6. Overdue CAPA Actions Requiring Escalation
            </div>
            <div style={{ padding: '12px 14px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#991b1b', color: '#fff' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>CAPA No.</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>Customer</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>Owner</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>Target Date</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.overdueList || []).length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: '10px', color: '#166534', fontWeight: 700 }}>No overdue CAPA actions!</td></tr>
                  ) : (
                    report.overdueList.map((o) => (
                      <tr key={o.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '6px 8px' }}>
                          <button type="button" onClick={() => navigate(`/entry/capa-create?id=${o.id}`)} style={{ background: 'none', border: 'none', padding: 0, color: '#1f4fb2', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'monospace' }}>
                            {o.capa_no}
                          </button>
                        </td>
                        <td style={{ padding: '6px 8px' }}>{o.customer_name || '—'}</td>
                        <td style={{ padding: '6px 8px' }}>{o.corrective_person || '—'}</td>
                        <td style={{ padding: '6px 8px', color: '#dc2626', fontWeight: 700 }}>{formatDateDMY(o.target_date)}</td>
                        <td style={{ padding: '6px 8px' }}>{o.capa_status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CapaReports;
