import React, { useState, useEffect, useMemo, useCallback } from 'react';
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

const filterControlStyle = {
  height: '34px',
  minHeight: '34px',
  padding: '5px 10px',
  border: '1px solid #cbd5e1',
  borderRadius: '5px',
  fontSize: '12px',
  backgroundColor: '#ffffff',
  color: '#0f172a',
  boxSizing: 'border-box'
};

const badge = (bg, color, text) => (
  <span
    style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '4px',
      backgroundColor: bg,
      color,
      fontSize: '11px',
      fontWeight: 700,
      whiteSpace: 'nowrap'
    }}
  >
    {text}
  </span>
);

const CustomerComplaintDisplay = () => {
  const navigate = useNavigate();
  const { selectedCompany, financialYear } = useAuth();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState({ type: '', text: '' });
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [dossierModal, setDossierModal] = useState({ open: false, loading: false, data: null });

  const loadComplaints = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api('/complaints');
      setRows(res?.data || []);
    } catch (err) {
      setBanner({ type: 'error', text: err.message || 'Failed to fetch Customer Complaints' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadComplaints();
  }, [loadComplaints]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (fromDate && r.complaint_date && String(r.complaint_date).slice(0, 10) < fromDate) return false;
      if (toDate && r.complaint_date && String(r.complaint_date).slice(0, 10) > toDate) return false;
      if (filterCategory && r.complaint_category !== filterCategory) return false;
      if (filterSeverity && r.severity !== filterSeverity) return false;
      if (filterStatus && r.investigation_status !== filterStatus) return false;
      if (q) {
        const hay = `${r.complaint_no} ${r.customer_name} ${r.original_invoice_no} ${r.customer_complaint_ref || ''} ${r.item_names} ${r.lot_nos} ${r.complaint_description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, fromDate, toDate, filterCategory, filterSeverity, filterStatus]);

  const kpi = useMemo(() => {
    const open = filteredRows.filter((r) => r.investigation_status === 'Open').length;
    const inv = filteredRows.filter((r) => r.investigation_status === 'Under Investigation').length;
    const critical = filteredRows.filter((r) => r.severity === 'Critical').length;
    const withCapa = filteredRows.filter((r) => Number(r.linked_capas_count || 0) > 0).length;
    return { total: filteredRows.length, open, inv, critical, withCapa };
  }, [filteredRows]);

  const handleOpenDossier = async (row) => {
    setDossierModal({ open: true, loading: true, data: row });
    try {
      const res = await api(`/complaints/${row.id}`);
      setDossierModal({ open: true, loading: false, data: res?.data || row });
    } catch (_) {
      setDossierModal({ open: true, loading: false, data: row });
    }
  };

  const handleExport = () => {
    const out = filteredRows.map((r, i) => ({
      'S.No.': i + 1,
      'Complaint No.': r.complaint_no,
      Date: formatDateDMY(r.complaint_date),
      Customer: r.customer_name,
      'Original Invoice': r.original_invoice_no || '—',
      'Customer Ref.': r.customer_complaint_ref || '—',
      'Products': r.item_names || '—',
      'FG Lot Nos.': r.lot_nos || '—',
      Category: r.complaint_category,
      Severity: r.severity,
      'Complaint Qty': r.complaint_qty,
      'Return Required': r.return_required ? 'Yes' : 'No',
      'Linked Returns': r.linked_returns_count || 0,
      'Linked CAPAs': r.latest_capa_no || 'None',
      Status: r.investigation_status
    }));
    exportToExcel(out, 'Customer_Complaints_Register');
  };

  const handlePrintList = () => {
    const html = `
      <html><head><title>Customer Complaints Register</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; padding: 16px; color: #0f172a; }
        h2 { margin: 0 0 4px; color: #1e3a8a; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #cbd5e1; padding: 6px; text-align: left; }
        th { background: #eff6ff; font-weight: bold; }
      </style></head><body>
      <h2>${escHtml(selectedCompany?.name || 'BVC ERP')} — Customer Complaints Register</h2>
      <div>FY: ${escHtml(financialYear)} | Total Records: ${filteredRows.length}</div>
      <table>
        <thead>
          <tr>
            <th>S.No</th><th>Complaint No</th><th>Date</th><th>Customer</th><th>Invoice</th>
            <th>Items / FG Lots</th><th>Category</th><th>Severity</th><th>Qty</th><th>Return Req</th><th>CAPA</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${filteredRows.map((r, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td>${escHtml(r.complaint_no)}</td>
              <td>${escHtml(formatDateDMY(r.complaint_date))}</td>
              <td>${escHtml(r.customer_name)}</td>
              <td>${escHtml(r.original_invoice_no || '—')}</td>
              <td>${escHtml(r.item_names)} (${escHtml(r.lot_nos)})</td>
              <td>${escHtml(r.complaint_category)}</td>
              <td>${escHtml(r.severity)}</td>
              <td>${escHtml(r.complaint_qty)}</td>
              <td>${r.return_required ? 'Yes' : 'No'}</td>
              <td>${escHtml(r.latest_capa_no || '—')}</td>
              <td>${escHtml(r.investigation_status)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table></body></html>`;
    printHtml(html);
  };

  return (
    <div style={{ padding: '14px 16px', backgroundColor: '#f1f5f9', minHeight: '100vh', fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>
      {/* Blue Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1f4fb2 0%, #1e3a8a 100%)',
          color: '#fff',
          padding: '12px 18px',
          borderRadius: '8px 8px 0 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            style={{ backgroundColor: '#fff', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '5px', padding: '6px 12px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
          >
            ← Back
          </button>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 800 }}>Customer Complaints Register</div>
            <div style={{ fontSize: '12px', color: '#dbeafe' }}>
              {selectedCompany?.name || 'BVC Company'} · FY {financialYear} · Complaint Intake, Sales Return Link &amp; Direct CAPA Generation
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" onClick={loadComplaints} style={{ ...filterControlStyle, fontWeight: 700, cursor: 'pointer' }}>
            Refresh
          </button>
          <button type="button" onClick={handleExport} style={{ height: '34px', padding: '0 12px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>
            Export Excel
          </button>
          <button type="button" onClick={handlePrintList} style={{ height: '34px', padding: '0 12px', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>
            Print List
          </button>
          <button
            type="button"
            onClick={() => navigate('/entry/capa-display')}
            style={{ height: '34px', padding: '0 12px', backgroundColor: '#0f766e', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
          >
            CAPA Register
          </button>
          <button
            type="button"
            onClick={() => navigate('/entry/customer-complaint-create')}
            style={{ height: '34px', padding: '0 14px', backgroundColor: '#f59e0b', color: '#0f172a', border: 'none', borderRadius: '5px', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }}
          >
            + Register Complaint
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', padding: '14px 16px', backgroundColor: '#fff', borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>Total Complaints</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{kpi.total}</div>
        </div>
        <div style={{ backgroundColor: '#fef3c7', border: '1px solid #fde68a', borderRadius: '6px', padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#92400e', textTransform: 'uppercase' }}>Open / Investigating</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{kpi.open + kpi.inv}</div>
        </div>
        <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>Critical Severity</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{kpi.critical}</div>
        </div>
        <div style={{ backgroundColor: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>CAPA Linked</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{kpi.withCapa}</div>
        </div>
      </div>

      {banner.text && (
        <div style={{ margin: '10px 0', padding: '10px 14px', borderRadius: '6px', fontWeight: 700, fontSize: '12px', backgroundColor: banner.type === 'error' ? '#fee2e2' : '#dcfce7', color: banner.type === 'error' ? '#991b1b' : '#166534' }}>
          {banner.text}
        </div>
      )}

      {/* Filter Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px 16px', backgroundColor: '#fff', borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>
        <input
          type="text"
          style={{ ...filterControlStyle, flex: '1 1 240px' }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search Complaint No, Customer, Invoice, Item, FG Lot..."
        />
        <input type="date" style={filterControlStyle} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        <input type="date" style={filterControlStyle} value={toDate} onChange={(e) => setToDate(e.target.value)} />
        <select style={filterControlStyle} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="">All Categories</option>
          <option value="Quality">Quality</option>
          <option value="Packaging">Packaging</option>
          <option value="Weight">Weight</option>
          <option value="Delivery">Delivery</option>
          <option value="Other">Other</option>
        </select>
        <select style={filterControlStyle} value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}>
          <option value="">All Severities</option>
          <option value="Critical">Critical</option>
          <option value="Major">Major</option>
          <option value="Minor">Minor</option>
        </select>
        <select style={filterControlStyle} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="Open">Open</option>
          <option value="Under Investigation">Under Investigation</option>
          <option value="Resolved">Resolved</option>
        </select>
      </div>

      {/* Main Table */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderTop: 'none', borderRadius: '0 0 8px 8px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ backgroundColor: '#eff6ff', color: '#1e3a8a', borderBottom: '2px solid #bfdbfe' }}>
              <th style={{ padding: '9px 10px', textAlign: 'left' }}>S.No.</th>
              <th style={{ padding: '9px 10px', textAlign: 'left' }}>Complaint No.</th>
              <th style={{ padding: '9px 10px', textAlign: 'left' }}>Date</th>
              <th style={{ padding: '9px 10px', textAlign: 'left' }}>Customer</th>
              <th style={{ padding: '9px 10px', textAlign: 'left' }}>Invoice No.</th>
              <th style={{ padding: '9px 10px', textAlign: 'left' }}>Items &amp; FG Lots</th>
              <th style={{ padding: '9px 10px', textAlign: 'left' }}>Category</th>
              <th style={{ padding: '9px 10px', textAlign: 'left' }}>Severity</th>
              <th style={{ padding: '9px 10px', textAlign: 'right' }}>Complaint Qty</th>
              <th style={{ padding: '9px 10px', textAlign: 'center' }}>Return Req</th>
              <th style={{ padding: '9px 10px', textAlign: 'left' }}>Returns / CAPA</th>
              <th style={{ padding: '9px 10px', textAlign: 'left' }}>Status</th>
              <th style={{ padding: '9px 10px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={13} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>Loading complaints...</td></tr>
            ) : filteredRows.length === 0 ? (
              <tr><td colSpan={13} style={{ padding: '28px', textAlign: 'center', color: '#64748b' }}>No customer complaints found.</td></tr>
            ) : (
              filteredRows.map((r, idx) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px 10px' }}>{idx + 1}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 800, color: '#1f4fb2' }}>{r.complaint_no}</td>
                  <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{formatDateDMY(r.complaint_date)}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>{r.customer_name}</td>
                  <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{r.original_invoice_no || '—'}</td>
                  <td style={{ padding: '8px 10px' }}>
                    <div style={{ fontWeight: 600 }}>{r.item_names || '—'}</div>
                    <div style={{ fontSize: '11px', color: '#475569', fontFamily: 'monospace' }}>{r.lot_nos || '—'}</div>
                  </td>
                  <td style={{ padding: '8px 10px' }}>{r.complaint_category}</td>
                  <td style={{ padding: '8px 10px' }}>
                    {badge(
                      r.severity === 'Critical' ? '#fee2e2' : r.severity === 'Major' ? '#fef3c7' : '#e0f2fe',
                      r.severity === 'Critical' ? '#991b1b' : r.severity === 'Major' ? '#92400e' : '#0369a1',
                      r.severity
                    )}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>{r.complaint_qty || 0}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                    {r.return_required ? badge('#e0f2fe', '#0369a1', 'Yes') : badge('#f1f5f9', '#475569', 'No')}
                  </td>
                  <td style={{ padding: '8px 10px', fontSize: '11px' }}>
                    <div>Returns: <strong>{r.linked_returns_count || 0}</strong> ({r.total_returned_qty || 0} qty)</div>
                    <div>CAPA: <strong>{r.latest_capa_no || 'None'}</strong></div>
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    {badge(
                      r.investigation_status === 'Resolved' ? '#dcfce7' : r.investigation_status === 'Under Investigation' ? '#fef3c7' : '#fee2e2',
                      r.investigation_status === 'Resolved' ? '#166534' : r.investigation_status === 'Under Investigation' ? '#92400e' : '#991b1b',
                      r.investigation_status
                    )}
                  </td>
                  <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: '4px' }}>
                      <button type="button" onClick={() => handleOpenDossier(r)} style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 700, border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', cursor: 'pointer' }}>
                        View
                      </button>
                      <button type="button" onClick={() => navigate(`/entry/customer-complaint-create?id=${r.id}`)} style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 700, border: '1px solid #bfdbfe', borderRadius: '4px', backgroundColor: '#eff6ff', color: '#1f4fb2', cursor: 'pointer' }}>
                        Update
                      </button>
                      <button type="button" onClick={() => navigate(`/entry/sales-return-create?complaint_id=${r.id}`)} style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 700, border: 'none', borderRadius: '4px', backgroundColor: '#0284c7', color: '#fff', cursor: 'pointer' }}>
                        + Return
                      </button>
                      <button type="button" onClick={() => navigate(`/entry/capa-create?complaint_id=${r.id}`)} style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 700, border: 'none', borderRadius: '4px', backgroundColor: '#16a34a', color: '#fff', cursor: 'pointer' }}>
                        + CAPA
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Dossier Modal */}
      {dossierModal.open && dossierModal.data && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            zIndex: 1300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', maxWidth: '860px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
            <div style={{ background: '#1e3a8a', color: '#fff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '15px' }}>
                Complaint Dossier · {dossierModal.data.complaint_no} ({dossierModal.data.customer_name})
              </div>
              <button type="button" onClick={() => setDossierModal({ open: false, loading: false, data: null })} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '18px', fontWeight: 700, cursor: 'pointer' }}>
                ✕
              </button>
            </div>
            <div style={{ padding: '16px', fontSize: '12px' }}>
              {dossierModal.loading ? (
                <div style={{ padding: '24px', textAlign: 'center' }}>Loading traceability &amp; linked records...</div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '12px' }}>
                    <div><strong>Date:</strong> {formatDateDMY(dossierModal.data.complaint_date)}</div>
                    <div><strong>Invoice:</strong> {dossierModal.data.original_invoice_no || '—'}</div>
                    <div><strong>Cust Ref:</strong> {dossierModal.data.customer_complaint_ref || '—'}</div>
                    <div><strong>Category:</strong> {dossierModal.data.complaint_category}</div>
                    <div><strong>Severity:</strong> {dossierModal.data.severity}</div>
                    <div><strong>Return Required:</strong> {dossierModal.data.return_required ? 'Yes' : 'No'}</div>
                  </div>
                  <div style={{ padding: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', marginBottom: '12px' }}>
                    <strong>Complaint Description:</strong>
                    <div style={{ marginTop: '4px' }}>{dossierModal.data.complaint_description}</div>
                  </div>

                  <div style={{ fontWeight: 800, marginBottom: '6px', color: '#1e3a8a' }}>Affected Products &amp; FG Lots</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#eff6ff' }}>
                        <th style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'left' }}>Item</th>
                        <th style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'left' }}>FG Lot</th>
                        <th style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'right' }}>Invoice Qty</th>
                        <th style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'right' }}>Complaint Qty</th>
                        <th style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'right' }}>Weight (Kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(dossierModal.data.items || []).map((it, i) => (
                        <tr key={i}>
                          <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}>{it.item_name}</td>
                          <td style={{ padding: '6px', border: '1px solid #cbd5e1', fontFamily: 'monospace' }}>{it.lot_no || '—'}</td>
                          <td style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{it.invoice_qty || 0}</td>
                          <td style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 700 }}>{it.complaint_qty || 0}</td>
                          <td style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{it.complaint_weight || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {Array.isArray(dossierModal.data.traceability) && dossierModal.data.traceability.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontWeight: 800, marginBottom: '6px', color: '#1e3a8a' }}>Manufacturing Batch &amp; RM Lot Traceability</div>
                      {dossierModal.data.traceability.map((tr, i) => (
                        <div key={i} style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', marginBottom: '6px', backgroundColor: '#f8fafc' }}>
                          <div><strong>Lot {tr.lot_no}</strong> ({tr.item_name})</div>
                          <div>Batches: {(tr.manufacturing_batches || []).map((b) => `${b.batch_no} (${b.date})`).join(', ') || 'None found'}</div>
                          <div>RM Parent Lots: {(tr.rm_parent_lots || []).map((rm) => `${rm.lot_no}${rm.supplier ? ` [${rm.supplier}]` : ''}`).join(', ') || 'None found'}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
                    <button type="button" onClick={() => navigate(`/entry/sales-return-create?complaint_id=${dossierModal.data.id}`)} style={{ padding: '7px 12px', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 700, cursor: 'pointer' }}>
                      + Create Sales Return
                    </button>
                    <button type="button" onClick={() => navigate(`/entry/capa-create?complaint_id=${dossierModal.data.id}`)} style={{ padding: '7px 12px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 700, cursor: 'pointer' }}>
                      + Generate CAPA
                    </button>
                    <button type="button" onClick={() => setDossierModal({ open: false, loading: false, data: null })} style={{ padding: '7px 12px', backgroundColor: '#e2e8f0', color: '#0f172a', border: 'none', borderRadius: '5px', fontWeight: 700, cursor: 'pointer' }}>
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerComplaintDisplay;
