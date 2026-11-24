import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext';
import { exportToExcel } from '../utils/exportHelper';
import { printHtml } from '../utils/printHelper';
import { buildFormalCapaPrintHtml } from './CapaCreate';

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

const getStatusBadge = (st) => {
  if (st === 'Closed') return badge('#dcfce7', '#166534', 'Closed');
  if (st === 'Verification') return badge('#e0f2fe', '#0369a1', 'Verification');
  if (st === 'In Progress') return badge('#fef3c7', '#92400e', 'In Progress');
  return badge('#fee2e2', '#991b1b', st || 'Open');
};

const getEffBadge = (eff) => {
  if (eff === 'Effective') return badge('#dcfce7', '#166534', 'Effective');
  if (eff === 'Not Effective') return badge('#fee2e2', '#991b1b', 'Not Effective');
  return badge('#f1f5f9', '#475569', eff || 'Pending');
};

const CapaDisplay = () => {
  const navigate = useNavigate();
  const { user, selectedCompany, financialYear, isAdmin } = useAuth();
  const todayIso = new Date().toISOString().split('T')[0];

  const canApprove = useMemo(() => {
    const role = String(user?.role || '').toLowerCase();
    return Boolean(isAdmin || ['admin', 'super_admin', 'superadmin', 'manager', 'quality manager', 'supervisor', 'owner'].includes(role));
  }, [user, isAdmin]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState({ type: '', text: '' });

  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterEffectiveness, setFilterEffectiveness] = useState('');
  const [filterSource, setFilterSource] = useState('');

  const [printingId, setPrintingId] = useState(null);
  const [viewModal, setViewModal] = useState({ open: false, loading: false, data: null });
  const [approveModal, setApproveModal] = useState({
    open: false,
    row: null,
    waive_verification: false,
    waiver_reason: '',
    quality_manager: '',
    closure_date: todayIso,
    final_remarks: '',
    saving: false,
    error: ''
  });

  const loadCapas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api('/capa');
      setRows(res?.data || []);
    } catch (err) {
      setBanner({ type: 'error', text: err.message || 'Failed to load CAPA register' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCapas();
  }, [loadCapas]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (fromDate && r.capa_date && String(r.capa_date).slice(0, 10) < fromDate) return false;
      if (toDate && r.capa_date && String(r.capa_date).slice(0, 10) > toDate) return false;
      if (filterStatus && r.capa_status !== filterStatus) return false;
      if (filterEffectiveness && r.effectiveness_status !== filterEffectiveness) return false;
      if (filterSource && r.capa_source !== filterSource) return false;
      if (q) {
        const hay = `${r.capa_no} ${r.complaint_no} ${r.sales_return_no} ${r.customer_name} ${r.item_name} ${r.lot_no} ${r.complaint_reason} ${r.identified_root_cause} ${r.responsible_person}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, fromDate, toDate, filterStatus, filterEffectiveness, filterSource]);

  const kpi = useMemo(() => {
    const open = filteredRows.filter((r) => r.capa_status === 'Open' || r.capa_status === 'In Progress').length;
    const verification = filteredRows.filter((r) => r.capa_status === 'Verification').length;
    const closed = filteredRows.filter((r) => r.capa_status === 'Closed').length;
    const overdue = filteredRows.filter((r) => r.capa_status !== 'Closed' && r.target_date && r.target_date < todayIso).length;
    const effective = filteredRows.filter((r) => r.effectiveness_status === 'Effective').length;
    return { total: filteredRows.length, open, verification, closed, overdue, effective };
  }, [filteredRows, todayIso]);

  const handleOpenView = async (row) => {
    setViewModal({ open: true, loading: true, data: row });
    try {
      const res = await api(`/capa/${row.id}`);
      setViewModal({ open: true, loading: false, data: res?.data || row });
    } catch (_) {
      setViewModal({ open: true, loading: false, data: row });
    }
  };

  const handlePrintFormalRow = async (row) => {
    if (!row || printingId === row.id) return;
    setPrintingId(row.id);
    try {
      const res = await api(`/capa/${row.id}`);
      const fullDoc = res?.success !== false && res?.data ? res.data : row;
      const html = buildFormalCapaPrintHtml(fullDoc, selectedCompany?.name || 'BVC Exports Pvt Ltd');
      printHtml(html, `CAPA Report - ${fullDoc.capa_no || row.capa_no || 'Document'}`);
    } catch (_) {
      const html = buildFormalCapaPrintHtml(row, selectedCompany?.name || 'BVC Exports Pvt Ltd');
      printHtml(html, `CAPA Report - ${row.capa_no || 'Document'}`);
    } finally {
      setTimeout(() => setPrintingId(null), 600);
    }
  };

  const handleOpenApprove = (row) => {
    setApproveModal({
      open: true,
      row,
      waive_verification: false,
      waiver_reason: '',
      quality_manager: row.quality_manager || user?.username || 'Quality Manager',
      closure_date: todayIso,
      final_remarks: row.final_remarks || '',
      saving: false,
      error: ''
    });
  };

  const handleSubmitApprove = async () => {
    if (!approveModal.row) return;
    setApproveModal((p) => ({ ...p, saving: true, error: '' }));
    try {
      const res = await api(`/capa/${approveModal.row.id}/approve-close`, {
        method: 'POST',
        body: {
          waive_verification: approveModal.waive_verification,
          waiver_reason: approveModal.waiver_reason,
          quality_manager: approveModal.quality_manager,
          closure_date: approveModal.closure_date,
          final_remarks: approveModal.final_remarks
        }
      });
      if (res && res.success !== false) {
        setApproveModal((p) => ({ ...p, open: false, saving: false }));
        setBanner({ type: 'success', text: res.message || 'CAPA closed cleanly.' });
        loadCapas();
      } else {
        setApproveModal((p) => ({ ...p, saving: false, error: res?.message || 'Approval failed' }));
      }
    } catch (err) {
      setApproveModal((p) => ({ ...p, saving: false, error: err.message || 'Approval blocked' }));
    }
  };

  const handleExport = () => {
    const out = filteredRows.map((r, idx) => ({
      'S.No.': idx + 1,
      'CAPA No.': r.capa_no,
      'CAPA Date': formatDateDMY(r.capa_date),
      'Complaint No.': r.complaint_no || '—',
      'Sales Return No.': r.sales_return_no || '—',
      Customer: r.customer_name || '—',
      'Item Name': r.item_name || '—',
      'FG Lot No.': r.lot_no || '—',
      'Complaint Reason': r.complaint_reason || '—',
      'Root Cause': r.identified_root_cause || '—',
      'Responsible Person': r.responsible_person || '—',
      'Target Date': formatDateDMY(r.target_date),
      'CAPA Status': r.capa_status,
      Effectiveness: r.effectiveness_status
    }));
    exportToExcel(out, 'CAPA_Register');
  };

  const handlePrintList = () => {
    const trs = filteredRows
      .map(
        (r, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${escHtml(r.capa_no)}</strong></td>
        <td>${escHtml(formatDateDMY(r.capa_date))}</td>
        <td>${escHtml(r.complaint_no || '—')}</td>
        <td>${escHtml(r.sales_return_no || '—')}</td>
        <td>${escHtml(r.customer_name || '—')}</td>
        <td>${escHtml(r.item_name || '—')}</td>
        <td>${escHtml(r.lot_no || '—')}</td>
        <td>${escHtml(r.complaint_reason || '—')}</td>
        <td>${escHtml(r.identified_root_cause || '—')}</td>
        <td>${escHtml(r.responsible_person || '—')}</td>
        <td>${escHtml(formatDateDMY(r.target_date))}</td>
        <td>${escHtml(r.capa_status)}</td>
        <td>${escHtml(r.effectiveness_status)}</td>
      </tr>`
      )
      .join('');

    printHtml(
      `<div style="font-family:Arial,sans-serif;font-size:11px;">
        <h2 style="color:#1e3a8a;margin-bottom:6px;">${escHtml(selectedCompany?.name || 'BVC ERP')} — CAPA Display Register</h2>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#1f4fb2;color:#fff;">
              <th style="padding:5px;border:1px solid #cbd5e1;">S.No</th>
              <th style="padding:5px;border:1px solid #cbd5e1;">CAPA No</th>
              <th style="padding:5px;border:1px solid #cbd5e1;">Date</th>
              <th style="padding:5px;border:1px solid #cbd5e1;">Complaint</th>
              <th style="padding:5px;border:1px solid #cbd5e1;">Return</th>
              <th style="padding:5px;border:1px solid #cbd5e1;">Customer</th>
              <th style="padding:5px;border:1px solid #cbd5e1;">Item</th>
              <th style="padding:5px;border:1px solid #cbd5e1;">FG Lot</th>
              <th style="padding:5px;border:1px solid #cbd5e1;">Reason</th>
              <th style="padding:5px;border:1px solid #cbd5e1;">Root Cause</th>
              <th style="padding:5px;border:1px solid #cbd5e1;">Owner</th>
              <th style="padding:5px;border:1px solid #cbd5e1;">Target</th>
              <th style="padding:5px;border:1px solid #cbd5e1;">Status</th>
              <th style="padding:5px;border:1px solid #cbd5e1;">Effectiveness</th>
            </tr>
          </thead>
          <tbody>${trs}</tbody>
        </table>
      </div>`,
      'CAPA Display Register'
    );
  };

  return (
    <div style={{ padding: '14px 16px 32px', backgroundColor: '#f1f5f9', minHeight: '100vh', fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>
      {/* Header Bar */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1f4fb2 0%, #1e3a8a 100%)',
          color: '#ffffff',
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
            onClick={() => navigate(-1)}
            style={{ backgroundColor: '#fff', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '5px', padding: '6px 12px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
          >
            ← Back
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 800 }}>CAPA Display Register</h2>
            <div style={{ fontSize: '11px', color: '#dbeafe' }}>
              {selectedCompany?.name || 'BVC Company'} · FY {financialYear} · Corrective &amp; Preventive Action Tracking
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" onClick={loadCapas} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: 'none', borderRadius: '5px', padding: '7px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
            ↻ Refresh
          </button>
          <button type="button" onClick={() => navigate('/reports/capa')} style={{ backgroundColor: '#6366f1', color: '#ffffff', border: 'none', borderRadius: '5px', padding: '7px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
            CAPA Reports
          </button>
          <button type="button" onClick={handleExport} style={{ backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '5px', padding: '7px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
            Export Excel
          </button>
          <button type="button" onClick={handlePrintList} style={{ backgroundColor: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '5px', padding: '7px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
            Print List
          </button>
          <button type="button" onClick={() => navigate('/entry/capa-create')} style={{ backgroundColor: '#f59e0b', color: '#0f172a', border: 'none', borderRadius: '5px', padding: '7px 15px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>
            + New CAPA Entry
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', padding: '14px 16px', backgroundColor: '#fff', borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total CAPA Documents</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#1e3a8a' }}>{kpi.total}</div>
          <div style={{ fontSize: '11px', color: '#475569' }}>Linked to complaints &amp; returns</div>
        </div>
        <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#92400e', textTransform: 'uppercase' }}>Open / In Progress</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#b45309' }}>{kpi.open}</div>
          <div style={{ fontSize: '11px', color: '#475569' }}>{kpi.overdue} overdue target date(s)</div>
        </div>
        <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>Awaiting Verification</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#1d4ed8' }}>{kpi.verification}</div>
          <div style={{ fontSize: '11px', color: '#475569' }}>Pending effectiveness check</div>
        </div>
        <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>Closed &amp; Effective</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#16a34a' }}>{kpi.closed}</div>
          <div style={{ fontSize: '11px', color: '#475569' }}>{kpi.effective} verified effective</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ backgroundColor: '#ffffff', padding: '12px 16px', borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search CAPA No, Complaint, Return, Customer, Item, Lot, Root Cause, Owner..."
          style={{ ...filterControlStyle, flex: '1 1 240px' }}
        />
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={filterControlStyle} />
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={filterControlStyle} />
        <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} style={{ ...filterControlStyle, minWidth: '140px' }}>
          <option value="">All Sources</option>
          <option value="Customer Complaint">Customer Complaint</option>
          <option value="Sales Return">Sales Return</option>
          <option value="Internal QC">Internal QC</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ ...filterControlStyle, minWidth: '130px' }}>
          <option value="">All Status</option>
          <option value="Open">Open</option>
          <option value="In Progress">In Progress</option>
          <option value="Verification">Verification</option>
          <option value="Closed">Closed</option>
        </select>
        <select value={filterEffectiveness} onChange={(e) => setFilterEffectiveness(e.target.value)} style={{ ...filterControlStyle, minWidth: '140px' }}>
          <option value="">All Effectiveness</option>
          <option value="Pending">Pending</option>
          <option value="Effective">Effective</option>
          <option value="Not Effective">Not Effective</option>
        </select>
        <button
          type="button"
          onClick={() => {
            setSearch('');
            setFromDate('');
            setToDate('');
            setFilterSource('');
            setFilterStatus('');
            setFilterEffectiveness('');
          }}
          style={{ ...filterControlStyle, backgroundColor: '#fef2f2', color: '#dc2626', borderColor: '#fecaca', fontWeight: 700, cursor: 'pointer' }}
        >
          ✕ Clear
        </button>
      </div>

      {banner.text && (
        <div style={{ marginTop: '10px', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: banner.type === 'error' ? '#fef2f2' : '#f0fdf4', border: `1px solid ${banner.type === 'error' ? '#fecaca' : '#bbf7d0'}`, color: banner.type === 'error' ? '#991b1b' : '#166534' }}>
          {banner.text}
        </div>
      )}

      {/* 15-Column CAPA Display Register Table */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '1620px', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ backgroundColor: '#1f4fb2', color: '#fff' }}>
                <th style={{ padding: '9px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>S.No.</th>
                <th style={{ padding: '9px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>CAPA No.</th>
                <th style={{ padding: '9px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>CAPA Date</th>
                <th style={{ padding: '9px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>Complaint No.</th>
                <th style={{ padding: '9px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>Sales Return No.</th>
                <th style={{ padding: '9px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>Customer</th>
                <th style={{ padding: '9px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>Item Name</th>
                <th style={{ padding: '9px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>FG Lot No.</th>
                <th style={{ padding: '9px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>Complaint Reason</th>
                <th style={{ padding: '9px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>Root Cause</th>
                <th style={{ padding: '9px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>Responsible Person</th>
                <th style={{ padding: '9px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>Target Date</th>
                <th style={{ padding: '9px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>CAPA Status</th>
                <th style={{ padding: '9px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>Effectiveness</th>
                <th style={{ padding: '9px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={15} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>Loading CAPA documents...</td></tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={15} style={{ padding: '28px', textAlign: 'center', color: '#64748b' }}>
                    No CAPA documents found.{' '}
                    <button type="button" onClick={() => navigate('/entry/capa-create')} style={{ marginLeft: '8px', backgroundColor: '#1f4fb2', color: '#fff', border: 'none', borderRadius: '4px', padding: '5px 12px', fontWeight: 700, cursor: 'pointer' }}>
                      + Create First CAPA
                    </button>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const isOverdue = row.capa_status !== 'Closed' && row.target_date && row.target_date < todayIso;
                  return (
                    <tr key={row.id} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                      <td style={{ padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>
                        <button type="button" onClick={() => handleOpenView(row)} style={{ background: 'none', border: 'none', padding: 0, color: '#1f4fb2', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'monospace' }}>
                          {row.capa_no}
                        </button>
                      </td>
                      <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{formatDateDMY(row.capa_date)}</td>
                      <td style={{ padding: '8px', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{row.complaint_no || '—'}</td>
                      <td style={{ padding: '8px', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{row.sales_return_no || '—'}</td>
                      <td style={{ padding: '8px', fontWeight: 700 }}>{row.customer_name || '—'}</td>
                      <td style={{ padding: '8px' }}>{row.item_name || '—'}</td>
                      <td style={{ padding: '8px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{row.lot_no || '—'}</td>
                      <td style={{ padding: '8px', maxWidth: '170px' }}>
                        <div style={{ fontWeight: 700 }}>{row.complaint_category || 'Quality'}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.reported_problem || '—'}</div>
                      </td>
                      <td style={{ padding: '8px', maxWidth: '180px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.identified_root_cause || ''}>
                          {row.identified_root_cause || '—'}
                        </div>
                      </td>
                      <td style={{ padding: '8px' }}>{row.responsible_person || '—'}</td>
                      <td style={{ padding: '8px', whiteSpace: 'nowrap', color: isOverdue ? '#dc2626' : '#0f172a', fontWeight: isOverdue ? 800 : 400 }}>
                        {formatDateDMY(row.target_date)} {isOverdue ? '!' : ''}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>{getStatusBadge(row.capa_status)}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>{getEffBadge(row.effectiveness_status)}</td>
                      <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button type="button" onClick={() => handleOpenView(row)} style={{ backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                            View
                          </button>
                          <button type="button" onClick={() => navigate(`/entry/capa-create?id=${row.id}`)} style={{ backgroundColor: '#1f4fb2', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                            Update
                          </button>
                          <button type="button" disabled={printingId === row.id} onClick={() => handlePrintFormalRow(row)} style={{ backgroundColor: printingId === row.id ? '#94a3b8' : '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: 700, cursor: printingId === row.id ? 'wait' : 'pointer' }}>
                            {printingId === row.id ? 'Printing...' : 'Print'}
                          </button>
                          {row.capa_status !== 'Closed' && canApprove && (
                            <button type="button" onClick={() => handleOpenApprove(row)} style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                              Approve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 16px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 700, color: '#334155' }}>
          Total Records: {filteredRows.length}
        </div>
      </div>

      {/* VIEW DOSSIER MODAL */}
      {viewModal.open && viewModal.data && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: '14px' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '100%', maxWidth: '920px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 35px rgba(0,0,0,0.28)' }}>
            <div style={{ padding: '12px 18px', backgroundColor: '#1f4fb2', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '16px' }}>CAPA Dossier · {viewModal.data.capa_no}</div>
                <div style={{ fontSize: '11px', color: '#dbeafe' }}>
                  Source: {viewModal.data.capa_source} · Status: {viewModal.data.capa_status} · Effectiveness: {viewModal.data.effectiveness_status}
                </div>
              </div>
              <button type="button" onClick={() => setViewModal({ open: false, loading: false, data: null })} style={{ backgroundColor: 'rgba(255, 255, 255, 0.25)', border: '1px solid rgba(255, 255, 255, 0.4)', borderRadius: '6px', color: '#fff', fontSize: '16px', fontWeight: 900, width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Close">✕</button>
            </div>
            <div style={{ padding: '16px', fontSize: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px', marginBottom: '12px' }}>
                <div style={{ padding: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <div style={{ fontWeight: 800, color: '#1e3a8a', marginBottom: '4px' }}>A &amp; B. Reference &amp; Customer</div>
                  <div><strong>Customer:</strong> {viewModal.data.customer_name || '—'}</div>
                  <div><strong>Complaint:</strong> {viewModal.data.complaint_no || '—'}</div>
                  <div><strong>Sales Return:</strong> {viewModal.data.sales_return_no || '—'}</div>
                  <div><strong>Original Inv:</strong> {viewModal.data.original_invoice_no || '—'}</div>
                </div>
                <div style={{ padding: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <div style={{ fontWeight: 800, color: '#1e3a8a', marginBottom: '4px' }}>D. Root Cause ({viewModal.data.rca_method || '5 Why'})</div>
                  <div><strong>Root Cause:</strong> {viewModal.data.identified_root_cause || '—'}</div>
                  <div><strong>Findings:</strong> {viewModal.data.investigation_findings || '—'}</div>
                </div>
                <div style={{ padding: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <div style={{ fontWeight: 800, color: '#1e3a8a', marginBottom: '4px' }}>E, F, G. Actions &amp; Closure</div>
                  <div><strong>CA:</strong> {viewModal.data.corrective_status || 'Pending'} ({viewModal.data.corrective_person || '—'})</div>
                  <div><strong>PA:</strong> {viewModal.data.preventive_status || 'Pending'} ({viewModal.data.preventive_person || '—'})</div>
                  <div><strong>Approved:</strong> {viewModal.data.approved_by || 'Pending'}</div>
                </div>
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '6px', marginBottom: '12px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#1f4fb2', color: '#fff' }}>
                      <th style={{ padding: '6px', textAlign: 'left' }}>Product</th>
                      <th style={{ padding: '6px', textAlign: 'left' }}>FG Lot</th>
                      <th style={{ padding: '6px', textAlign: 'right' }}>Inv Qty</th>
                      <th style={{ padding: '6px', textAlign: 'right' }}>Compl Qty</th>
                      <th style={{ padding: '6px', textAlign: 'right' }}>Ret Qty</th>
                      <th style={{ padding: '6px', textAlign: 'left' }}>Mfg Batch</th>
                      <th style={{ padding: '6px', textAlign: 'left' }}>RM Parent Lots</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewModal.data.items || []).map((it, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '6px', fontWeight: 700 }}>{it.product_name}</td>
                        <td style={{ padding: '6px', fontFamily: 'monospace' }}>{it.lot_no || '—'}</td>
                        <td style={{ padding: '6px', textAlign: 'right' }}>{it.invoice_qty || 0}</td>
                        <td style={{ padding: '6px', textAlign: 'right' }}>{it.complaint_qty || 0}</td>
                        <td style={{ padding: '6px', textAlign: 'right' }}>{it.returned_qty || 0}</td>
                        <td style={{ padding: '6px' }}>{it.batch_no || '—'}</td>
                        <td style={{ padding: '6px' }}>{it.rm_lot_nos || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div style={{ padding: '10px 18px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => navigate(`/entry/capa-create?id=${viewModal.data.id}`)} style={{ padding: '6px 14px', borderRadius: '5px', border: 'none', backgroundColor: '#1f4fb2', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Open Full Form</button>
              <button type="button" onClick={() => handlePrintFormalRow(viewModal.data)} style={{ padding: '6px 14px', borderRadius: '5px', border: 'none', backgroundColor: '#0284c7', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Print Formal CAPA</button>
              <button type="button" onClick={() => setViewModal({ open: false, loading: false, data: null })} style={{ padding: '6px 14px', borderRadius: '5px', border: '1px solid #1577ef', backgroundColor: '#4585e4', fontWeight: 700, cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK APPROVE & CLOSE MODAL */}
      {approveModal.open && approveModal.row && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: '14px' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '100%', maxWidth: '540px', overflow: 'hidden', boxShadow: '0 20px 35px rgba(0,0,0,0.28)' }}>
            <div style={{ padding: '12px 18px', backgroundColor: '#1f4fb2', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '15px' }}>Approve &amp; Close · {approveModal.row.capa_no}</span>
              <button type="button" onClick={() => setApproveModal((p) => ({ ...p, open: false }))} style={{ backgroundColor: 'rgba(255, 255, 255, 0.25)', border: '1px solid rgba(255, 255, 255, 0.4)', borderRadius: '6px', color: '#fff', fontSize: '16px', fontWeight: 900, width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Close">✕</button>
            </div>
            <div style={{ padding: '16px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {approveModal.error && (
                <div style={{ padding: '8px 10px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '5px', color: '#991b1b', fontWeight: 700 }}>
                  {approveModal.error}
                </div>
              )}
              <div>
                <label style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>Quality Manager</label>
                <input type="text" value={approveModal.quality_manager} onChange={(e) => setApproveModal((p) => ({ ...p, quality_manager: e.target.value }))} style={{ ...filterControlStyle, width: '100%' }} />
              </div>
              <div>
                <label style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>Closure Date</label>
                <input type="date" value={approveModal.closure_date} onChange={(e) => setApproveModal((p) => ({ ...p, closure_date: e.target.value }))} style={{ ...filterControlStyle, width: '100%' }} />
              </div>
              <div>
                <label style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>Final Closure Remarks</label>
                <textarea value={approveModal.final_remarks} onChange={(e) => setApproveModal((p) => ({ ...p, final_remarks: e.target.value }))} style={{ ...filterControlStyle, width: '100%', height: '60px' }} />
              </div>
              <div style={{ padding: '10px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#991b1b', cursor: 'pointer' }}>
                  <input type="checkbox" checked={approveModal.waive_verification} onChange={(e) => setApproveModal((p) => ({ ...p, waive_verification: e.target.checked }))} />
                  Authorize Verification Waiver (if effectiveness check is pending)
                </label>
                {approveModal.waive_verification && (
                  <input
                    type="text"
                    value={approveModal.waiver_reason}
                    onChange={(e) => setApproveModal((p) => ({ ...p, waiver_reason: e.target.value }))}
                    placeholder="Mandatory waiver justification..."
                    style={{ ...filterControlStyle, width: '100%', marginTop: '8px' }}
                  />
                )}
              </div>
            </div>
            <div style={{ padding: '12px 18px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setApproveModal((p) => ({ ...p, open: false }))} style={{ padding: '7px 14px', borderRadius: '5px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button type="button" disabled={approveModal.saving} onClick={handleSubmitApprove} style={{ padding: '7px 16px', borderRadius: '5px', border: 'none', backgroundColor: '#10b981', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
                {approveModal.saving ? 'Closing...' : 'Approve & Close CAPA'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CapaDisplay;
