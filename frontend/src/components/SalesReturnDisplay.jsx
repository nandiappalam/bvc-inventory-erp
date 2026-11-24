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
  const s = String(val).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return s.slice(0, 10) || '—';
};

const formatINR = (val) =>
  `₹${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatWt = (val) => {
  const n = Number(val || 0);
  if (n <= 0) return '0 kg';
  return `${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })} kg`;
};

const filterControlStyle = {
  height: '34px',
  minHeight: '34px',
  lineHeight: '1.35',
  padding: '5px 10px',
  border: '1px solid #cbd5e1',
  borderRadius: '5px',
  fontSize: '12px',
  backgroundColor: '#ffffff',
  color: '#0f172a',
  boxSizing: 'border-box'
};

const badgeStyle = (bg, color) => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: '4px',
  backgroundColor: bg,
  color,
  fontSize: '11px',
  fontWeight: 700,
  whiteSpace: 'nowrap'
});

const getQcBadge = (st) => {
  const s = String(st || 'Pending');
  if (s === 'Approved') return badgeStyle('#dcfce7', '#166534');
  if (s === 'Rejected') return badgeStyle('#fee2e2', '#991b1b');
  if (s === 'Reprocess') return badgeStyle('#ede9fe', '#5b21b6');
  return badgeStyle('#fef3c7', '#92400e');
};

const getStockBadge = (st) => {
  const s = String(st || 'Hold');
  if (s === 'Resalable') return badgeStyle('#dcfce7', '#166534');
  if (s === 'Reprocess') return badgeStyle('#ede9fe', '#5b21b6');
  if (s === 'Wastage') return badgeStyle('#fee2e2', '#991b1b');
  return badgeStyle('#fef3c7', '#92400e');
};

const getSettlementBadge = (st) => {
  const s = String(st || 'Pending');
  if (s === 'Adjusted' || s === 'Refunded' || s === 'Replaced') return badgeStyle('#dcfce7', '#166534');
  if (s === 'Cancelled') return badgeStyle('#f1f5f9', '#64748b');
  if (s === 'No Adjustment') return badgeStyle('#e0f2fe', '#0369a1');
  return badgeStyle('#fef3c7', '#92400e');
};

const SalesReturnDisplay = () => {
  const navigate = useNavigate();
  const { user, selectedCompany, financialYear, isAdmin, hasPermission } = useAuth();

  const canAuthorize = useMemo(() => {
    const role = String(user?.role || '').toLowerCase();
    return Boolean(isAdmin || ['admin', 'super_admin', 'superadmin', 'manager', 'supervisor', 'owner'].includes(role));
  }, [user, isAdmin]);

  const canCreate = useMemo(
    () =>
      Boolean(
        isAdmin ||
          hasPermission('Sales Return', 'Display', 'can_create') ||
          hasPermission('Sales Return', 'Create', 'can_create') ||
          hasPermission('Sales Return', 'can_create')
      ),
    [isAdmin, hasPermission]
  );

  const canEdit = useMemo(
    () =>
      Boolean(
        isAdmin ||
          hasPermission('Sales Return', 'Display', 'can_edit') ||
          hasPermission('Sales Return', 'Create', 'can_edit') ||
          hasPermission('Sales Return', 'can_edit')
      ),
    [isAdmin, hasPermission]
  );

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState({ type: '', text: '' });
  const [godowns, setGodowns] = useState([]);
  const [banks, setBanks] = useState([]);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filterReason, setFilterReason] = useState('');
  const [filterQc, setFilterQc] = useState('');
  const [filterStock, setFilterStock] = useState('');
  const [filterSettlement, setFilterSettlement] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  // Modals
  const [viewModal, setViewModal] = useState({ open: false, loading: false, data: null });
  const [approveModal, setApproveModal] = useState({ open: false, row: null, saving: false });
  const [approveForm, setApproveForm] = useState({
    qc_status: 'Approved',
    inspection_date: new Date().toISOString().slice(0, 10),
    inspected_by: user?.username || 'QC Manager',
    qc_remarks: '',
    goods_condition: 'Good / Resalable',
    stock_disposition: 'Resalable',
    destination_godown_id: '',
    destination_godown_name: '',
    settlement_type: 'Credit Note',
    credit_note_no: '',
    credit_note_date: new Date().toISOString().slice(0, 10),
    refund_amount: '',
    refund_mode: 'Bank',
    refund_bank_name: '',
    refund_ref_no: '',
    replacement_amount: '',
    replacement_ref_no: '',
    no_adjustment_reason: '',
    approval_remarks: '',
    close_return: false
  });
  const [cancelModal, setCancelModal] = useState({ open: false, row: null, mode: 'cancel', reason: '', saving: false });

  const showNotice = useCallback((type, text) => {
    setBanner({ type, text });
    if (type === 'success') {
      setTimeout(() => setBanner((prev) => (prev.text === text ? { type: '', text: '' } : prev)), 4000);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, lookupRes] = await Promise.all([
        api('/sales-returns'),
        api('/sales-returns/form-lookups').catch(() => null)
      ]);
      const data = Array.isArray(listRes) ? listRes : (listRes?.data || []);
      setRows(data);
      if (lookupRes?.data) {
        setGodowns(lookupRes.data.godowns || []);
        setBanks(lookupRes.data.banks || []);
      }
    } catch (err) {
      console.error('Error fetching sales returns:', err);
      showNotice('error', err.message || 'Failed to load Sales Return register');
    } finally {
      setLoading(false);
    }
  }, [showNotice]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const reasonOptions = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      if (r.return_reason_category) set.add(r.return_reason_category);
    });
    return Array.from(set).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return rows.filter((r) => {
      if (fromDate && r.date && String(r.date).slice(0, 10) < fromDate) return false;
      if (toDate && r.date && String(r.date).slice(0, 10) > toDate) return false;
      if (filterReason && r.return_reason_category !== filterReason) return false;
      if (filterQc && (r.qc_status || 'Pending') !== filterQc) return false;
      if (filterStock && (r.stock_status || 'Hold') !== filterStock) return false;
      if (filterSettlement && (r.settlement_status || 'Pending') !== filterSettlement) return false;
      if (q) {
        const hay = `${r.return_no || ''} ${r.original_invoice_no || ''} ${r.customer || ''} ${r.item_name || ''} ${r.lot_no || ''} ${r.return_reason_category || ''} ${r.credit_note_no || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, searchTerm, fromDate, toDate, filterReason, filterQc, filterStock, filterSettlement]);

  const kpi = useMemo(() => {
    const active = filteredRows.filter((r) => String(r.approval_status || '').toUpperCase() !== 'CANCELLED');
    const totalQty = active.reduce((s, r) => s + Number(r.total_qty || 0), 0);
    const totalWt = active.reduce((s, r) => s + Number(r.total_return_weight || r.total_wt || 0), 0);
    const totalVal = active.reduce((s, r) => s + Number(r.grand_total || r.total_amt || 0), 0);
    const inHold = active.filter((r) => (r.stock_status || 'Hold') === 'Hold');
    const inHoldWt = inHold.reduce((s, r) => s + Number(r.total_return_weight || r.total_wt || 0), 0);
    const settled = active.filter((r) => ['Adjusted', 'Refunded', 'Replaced'].includes(r.settlement_status));
    const settledAmt = settled.reduce((s, r) => s + Number(r.grand_total || r.total_amt || 0), 0);
    return {
      count: active.length,
      totalQty,
      totalWt,
      totalVal,
      holdCount: inHold.length,
      inHoldWt,
      settledCount: settled.length,
      settledAmt
    };
  }, [filteredRows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, fromDate, toDate, filterReason, filterQc, filterStock, filterSettlement, pageSize]);

  const handleOpenView = async (row) => {
    setViewModal({ open: true, loading: true, data: row });
    try {
      const full = await api(`/sales-returns/${row.id}`);
      setViewModal({ open: true, loading: false, data: full || row });
    } catch (_) {
      setViewModal({ open: true, loading: false, data: row });
    }
  };

  const handleOpenApprove = (row) => {
    const defaultGodown = godowns.find((g) => String(g.id) === String(row.destination_godown_id)) || godowns[0];
    setApproveForm({
      qc_status: row.qc_status && row.qc_status !== 'Pending' ? row.qc_status : 'Approved',
      inspection_date: row.inspection_date || new Date().toISOString().slice(0, 10),
      inspected_by: row.inspected_by || user?.username || 'QC Manager',
      qc_remarks: row.qc_remarks || '',
      goods_condition: row.goods_condition && row.goods_condition !== 'Under Investigation' ? row.goods_condition : 'Good / Resalable',
      stock_disposition: row.stock_disposition && row.stock_disposition !== 'Hold' ? row.stock_disposition : 'Resalable',
      destination_godown_id: row.destination_godown_id ? String(row.destination_godown_id) : (defaultGodown?.id ? String(defaultGodown.id) : ''),
      destination_godown_name: row.destination_godown_name || defaultGodown?.godown_name || '',
      settlement_type: row.settlement_type || 'Credit Note',
      credit_note_no: row.credit_note_no || '',
      credit_note_date: row.credit_note_date || new Date().toISOString().slice(0, 10),
      refund_amount: String(row.refund_amount || row.grand_total || row.total_amt || ''),
      refund_mode: row.refund_mode || 'Bank',
      refund_bank_name: row.refund_bank_name || '',
      refund_ref_no: row.refund_ref_no || '',
      replacement_amount: String(row.replacement_amount || ''),
      replacement_ref_no: row.replacement_ref_no || '',
      no_adjustment_reason: row.no_adjustment_reason || '',
      approval_remarks: row.approval_remarks || '',
      close_return: false
    });
    setApproveModal({ open: true, row, saving: false });
  };

  const handleSubmitApprove = async () => {
    if (!approveModal.row?.id) return;
    if (approveForm.settlement_type === 'No Financial Adjustment' && !String(approveForm.no_adjustment_reason || approveForm.approval_remarks || '').trim()) {
      showNotice('error', 'Authorization reason is required for "No Financial Adjustment".');
      return;
    }
    setApproveModal((p) => ({ ...p, saving: true }));
    try {
      const res = await api(`/sales-returns/${approveModal.row.id}/approve`, {
        method: 'POST',
        body: approveForm
      });
      if (res && res.success !== false) {
        setApproveModal({ open: false, row: null, saving: false });
        showNotice('success', res.message || 'Sales Return approved.');
        fetchData();
      } else {
        showNotice('error', res?.message || 'Approval failed');
        setApproveModal((p) => ({ ...p, saving: false }));
      }
    } catch (err) {
      showNotice('error', err.message || 'Approval failed');
      setApproveModal((p) => ({ ...p, saving: false }));
    }
  };

  const handleConfirmCancelOrDelete = async () => {
    if (!cancelModal.row?.id) return;
    setCancelModal((p) => ({ ...p, saving: true }));
    try {
      const id = cancelModal.row.id;
      const res = cancelModal.mode === 'delete'
        ? await api(`/sales-returns/${id}`, { method: 'DELETE' })
        : await api(`/sales-returns/${id}/cancel`, { method: 'POST', body: { reason: cancelModal.reason || 'Cancelled' } });
      if (res && res.success !== false) {
        setCancelModal({ open: false, row: null, mode: 'cancel', reason: '', saving: false });
        showNotice('success', res.message || 'Completed cleanly.');
        fetchData();
      } else {
        showNotice('error', res?.message || 'Action failed');
        setCancelModal((p) => ({ ...p, saving: false }));
      }
    } catch (err) {
      showNotice('error', err.message || 'Action failed');
      setCancelModal((p) => ({ ...p, saving: false }));
    }
  };

  const handlePrintRecord = async (row) => {
    let rec = row;
    try {
      const fetched = await api(`/sales-returns/${row.id}`);
      if (fetched) rec = fetched;
    } catch (_) {}

    const compName = selectedCompany?.name || 'BVC Exports Pvt Ltd';
    const items = Array.isArray(rec.items) ? rec.items : [];
    const rowsHtml = items.map((it, idx) => `
      <tr>
        <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">${idx + 1}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;font-weight:700;">${escHtml(it.item_name)}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;font-family:monospace;">${escHtml(it.lot_no || '—')}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;text-align:right;">${Number(it.original_sold_qty || 0)}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;text-align:right;font-weight:700;">${Number(it.qty || 0)} ${escHtml(it.uom || 'Bags')}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;text-align:right;">${formatWt(it.return_weight || it.total_wt)}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;text-align:right;">${formatINR(it.rate)}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;text-align:right;">${Number(it.tax_perc || 0)}%</td>
        <td style="border:1px solid #cbd5e1;padding:6px;text-align:right;font-weight:700;">${formatINR(it.total_amt)}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; color:#0f172a; padding:12px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #1f4fb2;padding-bottom:8px;margin-bottom:12px;">
          <div>
            <h2 style="margin:0;color:#1f4fb2;font-size:18px;">${escHtml(compName)}</h2>
            <div style="font-size:11px;color:#475569;">SALES RETURN &amp; CREDIT NOTE DOSSIER</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:15px;font-weight:800;color:#1e3a8a;">${escHtml(rec.return_no || `SR-${rec.s_no || rec.id}`)}</div>
            <div style="font-size:11px;color:#475569;">Return Date: <strong>${escHtml(formatDateDMY(rec.date))}</strong> | CN No: <strong>${escHtml(rec.credit_note_no || 'Pending')}</strong></div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:12px;">
          <tr>
            <td style="border:1px solid #cbd5e1;padding:7px;width:50%;vertical-align:top;">
              <strong>Customer:</strong> ${escHtml(rec.customer || '')}<br/>
              <strong>GSTIN:</strong> ${escHtml(rec.customer_gstin || '—')} | <strong>State:</strong> ${escHtml(rec.customer_state || '—')}<br/>
              <strong>Address:</strong> ${escHtml(rec.customer_address || rec.address || '—')}
            </td>
            <td style="border:1px solid #cbd5e1;padding:7px;width:50%;vertical-align:top;">
              <strong>Original Invoice:</strong> ${escHtml(rec.original_invoice_no || '—')} (${escHtml(formatDateDMY(rec.original_invoice_date))})<br/>
              <strong>SO / Outpass:</strong> ${escHtml(rec.sales_order_no || '—')} / ${escHtml(rec.delivery_challan_no || rec.outpass_no || '—')}<br/>
              <strong>Reason:</strong> ${escHtml(rec.return_reason_category || '—')} (${escHtml(rec.return_reason_detail || '—')})
            </td>
          </tr>
        </table>
        <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:12px;">
          <thead>
            <tr style="background:#1f4fb2;color:#fff;">
              <th style="border:1px solid #1e3a8a;padding:6px;">#</th>
              <th style="border:1px solid #1e3a8a;padding:6px;text-align:left;">Item Name</th>
              <th style="border:1px solid #1e3a8a;padding:6px;text-align:left;">FG Lot No.</th>
              <th style="border:1px solid #1e3a8a;padding:6px;text-align:right;">Orig Sold</th>
              <th style="border:1px solid #1e3a8a;padding:6px;text-align:right;">Return Qty</th>
              <th style="border:1px solid #1e3a8a;padding:6px;text-align:right;">Return Wt</th>
              <th style="border:1px solid #1e3a8a;padding:6px;text-align:right;">Rate</th>
              <th style="border:1px solid #1e3a8a;padding:6px;text-align:right;">GST %</th>
              <th style="border:1px solid #1e3a8a;padding:6px;text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody>${rowsHtml || '<tr><td colspan="9" style="text-align:center;padding:10px;">No items</td></tr>'}</tbody>
        </table>
        <div style="display:flex;justify-content:space-between;font-size:11px;border-top:1px solid #cbd5e1;padding-top:10px;">
          <div>
            <strong>QC Status:</strong> ${escHtml(rec.qc_status || 'Pending')} | <strong>Condition:</strong> ${escHtml(rec.goods_condition || '—')}<br/>
            <strong>Stock Status:</strong> ${escHtml(rec.stock_status || 'Hold')} | <strong>Settlement:</strong> ${escHtml(rec.settlement_type || 'Credit Note')} (${escHtml(rec.settlement_status || 'Pending')})<br/>
            <strong>Vehicle / Transporter:</strong> ${escHtml(rec.return_vehicle_no || '—')} / ${escHtml(rec.transporter_name || '—')}
          </div>
          <div style="text-align:right;">
            <div>Taxable Value: <strong>${formatINR(rec.bill_amt)}</strong></div>
            <div>GST Adjustment: <strong>${formatINR(rec.tax_amt)}</strong></div>
            <div style="font-size:14px;font-weight:800;color:#dc2626;margin-top:4px;">Net Return Amount: ${formatINR(rec.grand_total || rec.total_amt)}</div>
          </div>
        </div>
      </div>
    `;
    printHtml(html, `Sales_Return_${rec.return_no || rec.id}`);
  };

  const handleExportExcel = () => {
    if (!filteredRows.length) {
      showNotice('error', 'No matching sales return records to export.');
      return;
    }
    const cols = [
      { key: 'sno', title: 'S.No.', render: (_v, _r, idx) => idx + 1 },
      { key: 'return_no', title: 'Return No.', render: (_v, r) => r.return_no },
      { key: 'date', title: 'Return Date', render: (_v, r) => formatDateDMY(r.date) },
      { key: 'original_invoice_no', title: 'Original Invoice No.', render: (_v, r) => r.original_invoice_no || '—' },
      { key: 'customer', title: 'Customer', render: (_v, r) => r.customer || '—' },
      { key: 'item_name', title: 'Item Name', render: (_v, r) => r.item_name || '—' },
      { key: 'lot_no', title: 'FG Lot No.', render: (_v, r) => r.lot_no || '—' },
      { key: 'total_qty', title: 'Return Qty', render: (_v, r) => Number(r.total_qty || 0) },
      { key: 'total_wt', title: 'Return Weight (Kg)', render: (_v, r) => Number(r.total_return_weight || r.total_wt || 0) },
      { key: 'return_reason_category', title: 'Return Reason', render: (_v, r) => r.return_reason_category || '—' },
      { key: 'qc_status', title: 'QC Status', render: (_v, r) => r.qc_status || 'Pending' },
      { key: 'stock_status', title: 'Stock Status', render: (_v, r) => r.stock_status || 'Hold' },
      { key: 'credit_note_no', title: 'Credit Note No.', render: (_v, r) => r.credit_note_no || '—' },
      { key: 'grand_total', title: 'Return Amount', render: (_v, r) => Number(r.grand_total || r.total_amt || 0) },
      { key: 'settlement_status', title: 'Settlement Status', render: (_v, r) => r.settlement_status || 'Pending' }
    ];
    exportToExcel(filteredRows, 'Sales_Return_Register', cols, 'Sales_Returns');
  };

  const handlePrintList = () => {
    if (!filteredRows.length) {
      showNotice('error', 'No matching sales return records to print.');
      return;
    }
    const tbody = filteredRows.map((r, idx) => `
      <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;">${idx + 1}</td>
        <td style="border:1px solid #cbd5e1;padding:5px;font-weight:700;">${escHtml(r.return_no)}</td>
        <td style="border:1px solid #cbd5e1;padding:5px;">${escHtml(formatDateDMY(r.date))}</td>
        <td style="border:1px solid #cbd5e1;padding:5px;">${escHtml(r.original_invoice_no || '—')}</td>
        <td style="border:1px solid #cbd5e1;padding:5px;">${escHtml(r.customer || '—')}</td>
        <td style="border:1px solid #cbd5e1;padding:5px;">${escHtml(r.item_name || '—')}</td>
        <td style="border:1px solid #cbd5e1;padding:5px;">${escHtml(r.lot_no || '—')}</td>
        <td style="border:1px solid #cbd5e1;padding:5px;text-align:right;">${Number(r.total_qty || 0)}</td>
        <td style="border:1px solid #cbd5e1;padding:5px;text-align:right;">${formatWt(r.total_return_weight || r.total_wt)}</td>
        <td style="border:1px solid #cbd5e1;padding:5px;">${escHtml(r.return_reason_category || '—')}</td>
        <td style="border:1px solid #cbd5e1;padding:5px;">${escHtml(r.qc_status || 'Pending')}</td>
        <td style="border:1px solid #cbd5e1;padding:5px;">${escHtml(r.stock_status || 'Hold')}</td>
        <td style="border:1px solid #cbd5e1;padding:5px;">${escHtml(r.credit_note_no || '—')}</td>
        <td style="border:1px solid #cbd5e1;padding:5px;text-align:right;font-weight:700;">${formatINR(r.grand_total || r.total_amt)}</td>
        <td style="border:1px solid #cbd5e1;padding:5px;">${escHtml(r.settlement_status || 'Pending')}</td>
      </tr>
    `).join('');

    const html = `
      <style>@page { size: A4 landscape; margin: 8mm; }</style>
      <div style="font-family:Arial,sans-serif;font-size:10px;color:#0f172a;">
        <div style="display:flex;justify-content:space-between;border-bottom:2px solid #1f4fb2;padding-bottom:6px;margin-bottom:8px;">
          <div>
            <strong style="font-size:16px;color:#1f4fb2;">${escHtml(selectedCompany?.name || 'BVC Exports Pvt Ltd')}</strong><br/>
            <span>FY ${escHtml(financialYear || '2026-2027')}</span>
          </div>
          <div style="text-align:right;">
            <strong style="font-size:14px;color:#1e3a8a;">SALES RETURN REGISTER</strong><br/>
            <span>Total Records: ${filteredRows.length} | Total Return Value: ${formatINR(kpi.totalVal)}</span>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#1f4fb2;color:#fff;">
              <th style="border:1px solid #1e3a8a;padding:5px;">S.No.</th>
              <th style="border:1px solid #1e3a8a;padding:5px;">Return No.</th>
              <th style="border:1px solid #1e3a8a;padding:5px;">Return Date</th>
              <th style="border:1px solid #1e3a8a;padding:5px;">Orig Inv No.</th>
              <th style="border:1px solid #1e3a8a;padding:5px;">Customer</th>
              <th style="border:1px solid #1e3a8a;padding:5px;">Item Name</th>
              <th style="border:1px solid #1e3a8a;padding:5px;">FG Lot No.</th>
              <th style="border:1px solid #1e3a8a;padding:5px;">Return Qty</th>
              <th style="border:1px solid #1e3a8a;padding:5px;">Return Wt</th>
              <th style="border:1px solid #1e3a8a;padding:5px;">Return Reason</th>
              <th style="border:1px solid #1e3a8a;padding:5px;">QC Status</th>
              <th style="border:1px solid #1e3a8a;padding:5px;">Stock Status</th>
              <th style="border:1px solid #1e3a8a;padding:5px;">Credit Note No.</th>
              <th style="border:1px solid #1e3a8a;padding:5px;">Return Amount</th>
              <th style="border:1px solid #1e3a8a;padding:5px;">Settlement</th>
            </tr>
          </thead>
          <tbody>${tbody}</tbody>
        </table>
      </div>
    `;
    printHtml(html, 'Sales Return Register');
  };

  return (
    <div style={{ padding: '14px 16px', backgroundColor: '#f1f5f9', minHeight: '100vh' }}>
      {/* Blue ERP Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1f4fb2 0%, #2a5ea0 100%)',
          color: '#ffffff',
          padding: '12px 18px',
          borderRadius: '8px 8px 0 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          boxShadow: '0 2px 6px rgba(30, 58, 138, 0.18)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              backgroundColor: '#ffffff',
              color: '#1e293b',
              border: '1px solid #cbd5e1',
              borderRadius: '5px',
              padding: '5px 12px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            ← Back
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>Sales Return Display</h2>
            <div style={{ fontSize: '11px', color: '#dbeafe', marginTop: '1px' }}>
              {selectedCompany?.name || 'BVC Exports Pvt Ltd'} · FY {financialYear || '2026-2027'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={fetchData}
            style={{ backgroundColor: '#ffffff', color: '#1e3a8a', border: 'none', borderRadius: '5px', padding: '7px 13px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
          >
            ↻ Refresh
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            style={{ backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '5px', padding: '7px 13px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
          >
            📊 Export Excel
          </button>
          <button
            type="button"
            onClick={handlePrintList}
            style={{ backgroundColor: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '5px', padding: '7px 13px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
          >
            🖨 Print List
          </button>
          {canCreate && (
            <button
              type="button"
              onClick={() => navigate('/entry/sales-return-create')}
              style={{ backgroundColor: '#f59e0b', color: '#0f172a', border: 'none', borderRadius: '5px', padding: '7px 14px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
            >
              + Create New Sales Return
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: '12px',
          backgroundColor: '#ffffff',
          padding: '14px 16px',
          borderLeft: '1px solid #cbd5e1',
          borderRight: '1px solid #cbd5e1',
          borderBottom: '1px solid #e2e8f0'
        }}
      >
        <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase' }}>Total Returns</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{kpi.count}</div>
          <div style={{ fontSize: '11px', color: '#475569' }}>{kpi.totalQty.toLocaleString('en-IN')} qty · {formatWt(kpi.totalWt)}</div>
        </div>
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>Total Return Amount</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>{formatINR(kpi.totalVal)}</div>
          <div style={{ fontSize: '11px', color: '#475569' }}>Credit Note &amp; GST reversal value</div>
        </div>
        <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#92400e', textTransform: 'uppercase' }}>In Quality Hold</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#b45309', fontVariantNumeric: 'tabular-nums' }}>{kpi.holdCount}</div>
          <div style={{ fontSize: '11px', color: '#475569' }}>{formatWt(kpi.inHoldWt)} awaiting QC clearance</div>
        </div>
        <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>Settled / Approved</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#16a34a', fontVariantNumeric: 'tabular-nums' }}>{kpi.settledCount}</div>
          <div style={{ fontSize: '11px', color: '#475569' }}>{formatINR(kpi.settledAmt)} settled</div>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          backgroundColor: '#ffffff',
          padding: '12px 16px',
          borderLeft: '1px solid #cbd5e1',
          borderRight: '1px solid #cbd5e1',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center'
        }}
      >
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search Return No, Invoice No, Customer, Item, Lot, CN No..."
          style={{ ...filterControlStyle, flex: '1 1 230px' }}
        />
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={filterControlStyle} title="From Date" />
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={filterControlStyle} title="To Date" />
        <select value={filterReason} onChange={(e) => setFilterReason(e.target.value)} style={{ ...filterControlStyle, minWidth: '150px' }}>
          <option value="">All Reasons</option>
          {reasonOptions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={filterQc} onChange={(e) => setFilterQc(e.target.value)} style={{ ...filterControlStyle, minWidth: '125px' }}>
          <option value="">All QC Status</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Hold">Hold</option>
          <option value="Reprocess">Reprocess</option>
          <option value="Rejected">Rejected</option>
        </select>
        <select value={filterStock} onChange={(e) => setFilterStock(e.target.value)} style={{ ...filterControlStyle, minWidth: '130px' }}>
          <option value="">All Stock Status</option>
          <option value="Hold">Hold</option>
          <option value="Resalable">Resalable</option>
          <option value="Reprocess">Reprocess</option>
          <option value="Wastage">Wastage</option>
        </select>
        <select value={filterSettlement} onChange={(e) => setFilterSettlement(e.target.value)} style={{ ...filterControlStyle, minWidth: '145px' }}>
          <option value="">All Settlement</option>
          <option value="Pending">Pending</option>
          <option value="Adjusted">Adjusted</option>
          <option value="Refunded">Refunded</option>
          <option value="Replaced">Replaced</option>
          <option value="No Adjustment">No Adjustment</option>
        </select>
        <button
          type="button"
          onClick={() => {
            setSearchTerm('');
            setFromDate('');
            setToDate('');
            setFilterReason('');
            setFilterQc('');
            setFilterStock('');
            setFilterSettlement('');
          }}
          style={{ ...filterControlStyle, backgroundColor: '#fef2f2', color: '#dc2626', borderColor: '#fecaca', fontWeight: 700, cursor: 'pointer' }}
        >
          ✕ Clear
        </button>
      </div>

      {banner.text && (
        <div
          style={{
            marginTop: '10px',
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 700,
            backgroundColor: banner.type === 'error' ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${banner.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
            color: banner.type === 'error' ? '#991b1b' : '#166534'
          }}
        >
          {banner.text}
        </div>
      )}

      {/* 16-Column Main Sales Return Register Table */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #cbd5e1',
          borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          overflow: 'hidden'
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '1550px', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ backgroundColor: '#1f4fb2', color: '#ffffff' }}>
                <th style={{ padding: '9px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>S.No.</th>
                <th style={{ padding: '9px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>Return No.</th>
                <th style={{ padding: '9px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>Return Date</th>
                <th style={{ padding: '9px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>Original Invoice No.</th>
                <th style={{ padding: '9px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>Customer</th>
                <th style={{ padding: '9px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>Item Name</th>
                <th style={{ padding: '9px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>FG Lot No.</th>
                <th style={{ padding: '9px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>Return Qty</th>
                <th style={{ padding: '9px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>Return Weight</th>
                <th style={{ padding: '9px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>Return Reason</th>
                <th style={{ padding: '9px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>QC Status</th>
                <th style={{ padding: '9px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>Stock Status</th>
                <th style={{ padding: '9px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>Credit Note No.</th>
                <th style={{ padding: '9px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>Return Amount</th>
                <th style={{ padding: '9px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>Settlement Status</th>
                <th style={{ padding: '9px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={16} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                    Loading sales returns...
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={16} style={{ padding: '28px', textAlign: 'center', color: '#64748b' }}>
                    No sales return records found.{' '}
                    {canCreate && (
                      <button
                        type="button"
                        onClick={() => navigate('/entry/sales-return-create')}
                        style={{ marginLeft: '8px', backgroundColor: '#1f4fb2', color: '#fff', border: 'none', borderRadius: '4px', padding: '5px 12px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        + Create First Sales Return
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, idx) => {
                  const isCancelled = String(row.approval_status || '').toUpperCase() === 'CANCELLED';
                  const serial = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr
                      key={row.id}
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        backgroundColor: isCancelled ? '#f8fafc' : (idx % 2 === 0 ? '#ffffff' : '#f8fafc'),
                        opacity: isCancelled ? 0.65 : 1
                      }}
                    >
                      <td style={{ padding: '8px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{serial}</td>
                      <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenView(row)}
                          style={{ background: 'none', border: 'none', padding: 0, color: '#1f4fb2', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'monospace', fontSize: '12px' }}
                        >
                          {row.return_no}
                        </button>
                      </td>
                      <td style={{ padding: '8px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatDateDMY(row.date)}</td>
                      <td style={{ padding: '8px', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                        <div>{row.original_invoice_no || '—'}</div>
                        {row.complaint_no && (
                          <div style={{ fontSize: '10px', fontWeight: 700, color: '#92400e', backgroundColor: '#fef3c7', padding: '1px 5px', borderRadius: '3px', display: 'inline-block', marginTop: '2px' }}>
                            CMP: {row.complaint_no}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '8px', fontWeight: 700, color: '#0f172a' }}>{row.customer || '—'}</td>
                      <td style={{ padding: '8px' }}>{row.item_summary || row.item_name || '—'}</td>
                      <td style={{ padding: '8px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{row.lot_no || '—'}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {Number(row.total_qty || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {formatWt(row.total_return_weight || row.total_wt)}
                      </td>
                      <td style={{ padding: '8px' }}>
                        <div style={{ fontWeight: 700, color: '#1e293b' }}>{row.return_reason_category || '—'}</div>
                        {row.return_reason_detail && (
                          <div style={{ fontSize: '11px', color: '#64748b', maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.return_reason_detail}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <span style={getQcBadge(row.qc_status)}>{row.qc_status || 'Pending'}</span>
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <span style={getStockBadge(row.stock_status)}>{row.stock_status || 'Hold'}</span>
                      </td>
                      <td style={{ padding: '8px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {row.credit_note_no || '—'}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 800, color: '#dc2626', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {formatINR(row.grand_total || row.total_amt)}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <span style={getSettlementBadge(row.settlement_status)}>{row.settlement_status || 'Pending'}</span>
                      </td>
                      <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenView(row)}
                            style={{ backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            View
                          </button>
                          {!isCancelled && canEdit && (
                            <button
                              type="button"
                              onClick={() => navigate(`/entry/sales-return-create?id=${row.id}`)}
                              style={{ backgroundColor: '#1f4fb2', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                            >
                              Update
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handlePrintRecord(row)}
                            style={{ backgroundColor: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Print
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/entry/capa-create?sales_return_id=${row.id}`)}
                            style={{ backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            + CAPA
                          </button>
                          {!isCancelled && canAuthorize && (
                            <button
                              type="button"
                              onClick={() => handleOpenApprove(row)}
                              style={{ backgroundColor: row.approval_status === 'APPROVED' ? '#f59e0b' : '#10b981', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                            >
                              {row.approval_status === 'APPROVED' ? 'Re-Disp' : 'Approve'}
                            </button>
                          )}
                          {!isCancelled && canAuthorize && (
                            <button
                              type="button"
                              onClick={() => setCancelModal({ open: true, row, mode: 'cancel', reason: '', saving: false })}
                              style={{ backgroundColor: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                            >
                              Cancel
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

        {/* Pagination Footer */}
        <div style={{ padding: '10px 16px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', fontSize: '12px' }}>
          <div style={{ fontWeight: 700, color: '#334155' }}>
            Total Records: {filteredRows.length}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              style={{ ...filterControlStyle, height: '30px', minHeight: '30px', padding: '3px 8px' }}
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              style={{ ...filterControlStyle, height: '30px', minHeight: '30px', cursor: currentPage <= 1 ? 'not-allowed' : 'pointer' }}
            >
              Prev
            </button>
            <span style={{ fontWeight: 700 }}>Page {currentPage} / {totalPages}</span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              style={{ ...filterControlStyle, height: '30px', minHeight: '30px', cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer' }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* READ-ONLY VIEW MODAL */}
      {viewModal.open && viewModal.data && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: '14px' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '100%', maxWidth: '880px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 35px rgba(0,0,0,0.28)' }}>
            <div style={{ padding: '12px 18px', backgroundColor: '#1f4fb2', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '16px' }}>Sales Return Dossier · {viewModal.data.return_no}</div>
                <div style={{ fontSize: '11px', color: '#dbeafe' }}>
                  Original Invoice: {viewModal.data.original_invoice_no || '—'} · Date: {formatDateDMY(viewModal.data.date)}
                </div>
              </div>
              <button type="button" onClick={() => setViewModal({ open: false, loading: false, data: null })} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '16px', fontSize: '12px' }}>
              {viewModal.loading && <div style={{ color: '#64748b', marginBottom: '10px' }}>Loading full dossier...</div>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px', marginBottom: '14px' }}>
                <div style={{ padding: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <div style={{ fontWeight: 800, color: '#1e3a8a', marginBottom: '4px' }}>A. Customer &amp; Original Sales</div>
                  <div><strong>Customer:</strong> {viewModal.data.customer}</div>
                  <div><strong>GSTIN:</strong> {viewModal.data.customer_gstin || '—'}</div>
                  <div><strong>Orig Inv:</strong> {viewModal.data.original_invoice_no || '—'} ({formatDateDMY(viewModal.data.original_invoice_date)})</div>
                  <div><strong>Complaint Ref:</strong> {viewModal.data.complaint_no || '—'} {Number(viewModal.data.complaint_qty || 0) > 0 ? `(Compl Qty: ${viewModal.data.complaint_qty})` : ''}</div>
                  <div><strong>SO / Outpass:</strong> {viewModal.data.sales_order_no || '—'} / {viewModal.data.delivery_challan_no || viewModal.data.outpass_no || '—'}</div>
                </div>
                <div style={{ padding: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <div style={{ fontWeight: 800, color: '#1e3a8a', marginBottom: '4px' }}>C &amp; D. QC &amp; Stock Disposition</div>
                  <div><strong>Reason:</strong> {viewModal.data.return_reason_category || '—'}</div>
                  <div><strong>Detail:</strong> {viewModal.data.return_reason_detail || '—'}</div>
                  <div><strong>QC Status:</strong> {viewModal.data.qc_status || 'Pending'} ({viewModal.data.inspected_by || 'Uninspected'})</div>
                  <div><strong>Condition / Stock:</strong> {viewModal.data.goods_condition || '—'} → <strong>{viewModal.data.stock_status || 'Hold'}</strong></div>
                </div>
                <div style={{ padding: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <div style={{ fontWeight: 800, color: '#1e3a8a', marginBottom: '4px' }}>E &amp; F. Settlement &amp; Transport</div>
                  <div><strong>Settlement:</strong> {viewModal.data.settlement_type || 'Credit Note'} ({viewModal.data.settlement_status || 'Pending'})</div>
                  <div><strong>Credit Note:</strong> {viewModal.data.credit_note_no || '—'}</div>
                  <div><strong>Return Value:</strong> <strong style={{ color: '#dc2626' }}>{formatINR(viewModal.data.grand_total || viewModal.data.total_amt)}</strong></div>
                  <div><strong>Vehicle / Trans:</strong> {viewModal.data.return_vehicle_no || '—'} / {viewModal.data.transporter_name || '—'}</div>
                </div>
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '6px', marginBottom: '12px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#1f4fb2', color: '#fff' }}>
                      <th style={{ padding: '7px', textAlign: 'left' }}>Item</th>
                      <th style={{ padding: '7px', textAlign: 'left' }}>FG Lot</th>
                      <th style={{ padding: '7px', textAlign: 'right' }}>Orig Sold</th>
                      <th style={{ padding: '7px', textAlign: 'right' }}>Return Qty</th>
                      <th style={{ padding: '7px', textAlign: 'right' }}>Return Wt</th>
                      <th style={{ padding: '7px', textAlign: 'left' }}>Godown</th>
                      <th style={{ padding: '7px', textAlign: 'left' }}>Disposition</th>
                      <th style={{ padding: '7px', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewModal.data.items || []).map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '6px', fontWeight: 700 }}>{it.item_name}</td>
                        <td style={{ padding: '6px', fontFamily: 'monospace' }}>{it.lot_no || '—'}</td>
                        <td style={{ padding: '6px', textAlign: 'right' }}>{Number(it.original_sold_qty || 0)}</td>
                        <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700 }}>{Number(it.qty || 0)} {it.uom || 'Bags'}</td>
                        <td style={{ padding: '6px', textAlign: 'right' }}>{formatWt(it.return_weight || it.total_wt)}</td>
                        <td style={{ padding: '6px' }}>{it.destination_godown_name || '—'}</td>
                        <td style={{ padding: '6px' }}>{it.stock_disposition || viewModal.data.stock_status || 'Hold'}</td>
                        <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700 }}>{formatINR(it.total_amt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {Array.isArray(viewModal.data.audit_logs) && viewModal.data.audit_logs.length > 0 && (
                <div style={{ padding: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <div style={{ fontWeight: 800, color: '#1e3a8a', marginBottom: '6px' }}>Workflow Audit Trail</div>
                  {viewModal.data.audit_logs.map((lg) => (
                    <div key={lg.id} style={{ fontSize: '11px', padding: '3px 0', borderBottom: '1px dashed #cbd5e1' }}>
                      <strong>{lg.action}</strong> by {lg.performed_by} · {lg.new_value} {lg.reason ? `(${lg.reason})` : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding: '10px 18px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  const srId = viewModal.data.id;
                  setViewModal({ open: false, loading: false, data: null });
                  navigate(`/entry/capa-create?sales_return_id=${srId}`);
                }}
                style={{ padding: '6px 14px', borderRadius: '5px', border: 'none', backgroundColor: '#16a34a', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                + Generate CAPA
              </button>
              <button type="button" onClick={() => handlePrintRecord(viewModal.data)} style={{ padding: '6px 14px', borderRadius: '5px', border: 'none', backgroundColor: '#0284c7', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Print Credit Note</button>
              <button type="button" onClick={() => setViewModal({ open: false, loading: false, data: null })} style={{ padding: '6px 14px', borderRadius: '5px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontWeight: 700, cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* AUTHORIZED QC & DISPOSITION APPROVAL MODAL */}
      {approveModal.open && approveModal.row && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: '14px' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '100%', maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 35px rgba(0,0,0,0.28)' }}>
            <div style={{ padding: '12px 18px', backgroundColor: '#1f4fb2', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '15px' }}>
                QC Inspection &amp; Authorized Approval · {approveModal.row.return_no}
              </span>
              <button type="button" onClick={() => setApproveModal({ open: false, row: null, saving: false })} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
              <div>
                <label style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>QC Test Result</label>
                <select value={approveForm.qc_status} onChange={(e) => setApproveForm((p) => ({ ...p, qc_status: e.target.value }))} style={{ ...filterControlStyle, width: '100%' }}>
                  <option value="Approved">Approved</option>
                  <option value="Hold">Hold</option>
                  <option value="Reprocess">Reprocess</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              <div>
                <label style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>Inspected By</label>
                <input type="text" value={approveForm.inspected_by} onChange={(e) => setApproveForm((p) => ({ ...p, inspected_by: e.target.value }))} style={{ ...filterControlStyle, width: '100%' }} />
              </div>
              <div>
                <label style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>Stock Disposition (Physical Routing)</label>
                <select value={approveForm.stock_disposition} onChange={(e) => setApproveForm((p) => ({ ...p, stock_disposition: e.target.value }))} style={{ ...filterControlStyle, width: '100%' }}>
                  <option value="Resalable">Resalable (Inward to Approved FG Stock)</option>
                  <option value="Hold">Hold (Keep in Quality Quarantine)</option>
                  <option value="Reprocess">Reprocess (Route for Reprocessing)</option>
                  <option value="Wastage">Wastage (Record Wastage / Disposal)</option>
                </select>
              </div>
              <div>
                <label style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>Destination Godown</label>
                <select
                  value={approveForm.destination_godown_id}
                  onChange={(e) => {
                    const g = godowns.find((gd) => String(gd.id) === String(e.target.value));
                    setApproveForm((p) => ({ ...p, destination_godown_id: e.target.value, destination_godown_name: g?.godown_name || '' }));
                  }}
                  style={{ ...filterControlStyle, width: '100%' }}
                >
                  <option value="">-- Select Godown --</option>
                  {godowns.map((g) => <option key={g.id} value={g.id}>{g.godown_name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>Settlement Type (Financial)</label>
                <select value={approveForm.settlement_type} onChange={(e) => setApproveForm((p) => ({ ...p, settlement_type: e.target.value }))} style={{ ...filterControlStyle, width: '100%' }}>
                  <option value="Credit Note">Credit Note</option>
                  <option value="Refund">Refund</option>
                  <option value="Replacement">Replacement</option>
                  <option value="No Financial Adjustment">No Financial Adjustment</option>
                </select>
              </div>
              <div>
                <label style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>Credit Note Date</label>
                <input type="date" value={approveForm.credit_note_date} onChange={(e) => setApproveForm((p) => ({ ...p, credit_note_date: e.target.value }))} style={{ ...filterControlStyle, width: '100%' }} />
              </div>
              {approveForm.settlement_type === 'Refund' && (
                <>
                  <div>
                    <label style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>Refund Amount (₹)</label>
                    <input type="number" value={approveForm.refund_amount} onChange={(e) => setApproveForm((p) => ({ ...p, refund_amount: e.target.value }))} style={{ ...filterControlStyle, width: '100%' }} />
                  </div>
                  <div>
                    <label style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>Refund Mode &amp; Bank</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <select value={approveForm.refund_mode} onChange={(e) => setApproveForm((p) => ({ ...p, refund_mode: e.target.value }))} style={{ ...filterControlStyle, width: '90px' }}>
                        <option value="Bank">Bank</option>
                        <option value="Cash">Cash</option>
                      </select>
                      {approveForm.refund_mode === 'Bank' && (
                        <select value={approveForm.refund_bank_name} onChange={(e) => setApproveForm((p) => ({ ...p, refund_bank_name: e.target.value }))} style={{ ...filterControlStyle, flex: 1 }}>
                          <option value="">-- Bank --</option>
                          {banks.map((b) => <option key={b.id} value={b.ledger_name}>{b.ledger_name}</option>)}
                        </select>
                      )}
                    </div>
                  </div>
                </>
              )}
              {approveForm.settlement_type === 'No Financial Adjustment' && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>Mandatory Authorization Reason *</label>
                  <input type="text" value={approveForm.no_adjustment_reason} onChange={(e) => setApproveForm((p) => ({ ...p, no_adjustment_reason: e.target.value }))} style={{ ...filterControlStyle, width: '100%' }} />
                </div>
              )}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>Approval / QC Remarks</label>
                <textarea
                  value={approveForm.approval_remarks}
                  onChange={(e) => setApproveForm((p) => ({ ...p, approval_remarks: e.target.value }))}
                  style={{ ...filterControlStyle, width: '100%', height: '60px' }}
                />
              </div>
            </div>
            <div style={{ padding: '12px 18px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setApproveModal({ open: false, row: null, saving: false })} style={{ padding: '7px 14px', borderRadius: '5px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button type="button" disabled={approveModal.saving} onClick={handleSubmitApprove} style={{ padding: '7px 16px', borderRadius: '5px', border: 'none', backgroundColor: '#10b981', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
                {approveModal.saving ? 'Posting...' : 'Approve & Route Disposition'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL CONFIRM MODAL */}
      {cancelModal.open && cancelModal.row && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '92%', maxWidth: '440px', overflow: 'hidden', boxShadow: '0 20px 30px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '12px 16px', backgroundColor: '#dc2626', color: '#fff', fontWeight: 800, fontSize: '14px' }}>
              Cancel Sales Return · {cancelModal.row.return_no}
            </div>
            <div style={{ padding: '16px', fontSize: '13px', color: '#334155' }}>
              <p style={{ marginTop: 0 }}>This will reverse any approved FG stock entries and Credit Note / Refund vouchers for this return.</p>
              <label style={{ fontWeight: 700, display: 'block', marginBottom: '4px', fontSize: '12px' }}>Cancellation Reason</label>
              <input
                type="text"
                value={cancelModal.reason}
                onChange={(e) => setCancelModal((p) => ({ ...p, reason: e.target.value }))}
                placeholder="Reason for cancelling..."
                style={{ ...filterControlStyle, width: '100%' }}
              />
            </div>
            <div style={{ padding: '10px 16px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setCancelModal({ open: false, row: null, mode: 'cancel', reason: '', saving: false })} style={{ padding: '6px 12px', borderRadius: '5px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontWeight: 700, cursor: 'pointer' }}>Keep Record</button>
              <button type="button" disabled={cancelModal.saving} onClick={handleConfirmCancelOrDelete} style={{ padding: '6px 14px', borderRadius: '5px', border: 'none', backgroundColor: '#dc2626', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                {cancelModal.saving ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesReturnDisplay;
