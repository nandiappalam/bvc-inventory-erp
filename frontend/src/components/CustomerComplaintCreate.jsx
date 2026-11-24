import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext';
import './SalesReturnCreate.css';

const EMPTY_ITEM = {
  original_sales_id: null,
  original_sales_item_id: null,
  item_id: '',
  item_name: '',
  product_code: '',
  lot_no: '',
  mfg_date: '',
  exp_date: '',
  uom: 'Bags',
  weight_per_unit: '50',
  invoice_qty: 0,
  complaint_qty: '',
  complaint_weight: '',
  issue_notes: ''
};

const CATEGORIES = ['Quality', 'Packaging', 'Weight', 'Delivery', 'Other'];
const SEVERITIES = ['Critical', 'Major', 'Minor'];
const STATUSES = ['Open', 'Under Investigation', 'Resolved'];

const round2 = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : 0;
};

const CustomerComplaintCreate = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const { user, selectedCompany, financialYear } = useAuth();
  const todayIso = new Date().toISOString().split('T')[0];

  const [initializing, setInitializing] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState({ type: '', text: '' });

  const [customers, setCustomers] = useState([]);
  const [itemMaster, setItemMaster] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [invoiceSearch, setInvoiceSearch] = useState('');

  const [formData, setFormData] = useState({
    complaint_no: '',
    complaint_date: todayIso,
    customer_id: '',
    customer_name: '',
    customer_gstin: '',
    customer_phone: '',
    customer_email: '',
    customer_address: '',
    original_sales_id: '',
    original_invoice_no: '',
    original_invoice_date: '',
    sales_order_no: '',
    customer_complaint_ref: '',
    complaint_category: 'Quality',
    severity: 'Major',
    return_required: false,
    investigation_status: 'Open',
    complaint_description: '',
    customer_communication: '',
    received_by: user?.username || 'admin',
    assigned_to: 'Quality Manager'
  });

  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [evidence, setEvidence] = useState([]);
  const [linkDraft, setLinkDraft] = useState({ name: '', url: '', notes: '' });
  const [linkedInfo, setLinkedInfo] = useState({ sales_returns: [], capas: [] });

  const showNotice = useCallback((type, text) => {
    setBanner({ type, text });
    if (type === 'success') {
      setTimeout(() => setBanner((p) => (p.text === text ? { type: '', text: '' } : p)), 4500);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const init = async () => {
      setInitializing(true);
      try {
        const lookupRes = await api('/complaints/form-lookups').catch(() => null);
        if (!active) return;
        const lData = lookupRes?.data || {};
        setCustomers(lData.customers || []);
        setItemMaster(lData.items || []);
        setInvoices(lData.invoices || []);

        if (editId) {
          const detailRes = await api(`/complaints/${editId}`);
          const rec = detailRes?.data;
          if (!active || !rec) return;

          setFormData({
            complaint_no: rec.complaint_no || '',
            complaint_date: rec.complaint_date ? String(rec.complaint_date).slice(0, 10) : todayIso,
            customer_id: rec.customer_id ? String(rec.customer_id) : '',
            customer_name: rec.customer_name || '',
            customer_gstin: rec.customer_gstin || '',
            customer_phone: rec.customer_phone || '',
            customer_email: rec.customer_email || '',
            customer_address: rec.customer_address || '',
            original_sales_id: rec.original_sales_id ? String(rec.original_sales_id) : '',
            original_invoice_no: rec.original_invoice_no || '',
            original_invoice_date: rec.original_invoice_date ? String(rec.original_invoice_date).slice(0, 10) : '',
            sales_order_no: rec.sales_order_no || '',
            customer_complaint_ref: rec.customer_complaint_ref || '',
            complaint_category: rec.complaint_category || 'Quality',
            severity: rec.severity || 'Major',
            return_required: Boolean(rec.return_required),
            investigation_status: rec.investigation_status || 'Open',
            complaint_description: rec.complaint_description || rec.description || '',
            customer_communication: rec.customer_communication || '',
            received_by: rec.received_by || user?.username || 'admin',
            assigned_to: rec.assigned_to || 'Quality Manager'
          });

          if (Array.isArray(rec.items) && rec.items.length > 0) {
            setItems(
              rec.items.map((it) => ({
                ...EMPTY_ITEM,
                ...it,
                weight_per_unit: String(it.weight_per_unit || 50),
                complaint_qty: it.complaint_qty !== undefined ? String(it.complaint_qty) : '',
                complaint_weight: it.complaint_weight !== undefined ? String(it.complaint_weight) : ''
              }))
            );
          }
          setEvidence(Array.isArray(rec.evidence) ? rec.evidence : []);
          setLinkedInfo({
            sales_returns: rec.linked_sales_returns || [],
            capas: rec.linked_capas || []
          });
        } else {
          const nextRes = await api('/complaints/next-no').catch(() => null);
          if (!active) return;
          setFormData((prev) => ({
            ...prev,
            complaint_no: nextRes?.complaint_no || 'CMP-00001'
          }));
        }
      } catch (err) {
        if (active) showNotice('error', err.message || 'Failed to load Customer Complaint form');
      } finally {
        if (active) setInitializing(false);
      }
    };
    init();
    return () => {
      active = false;
    };
  }, [editId, todayIso, user?.username, showNotice]);

  const filteredInvoices = useMemo(() => {
    const q = invoiceSearch.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((inv) =>
      `${inv.inv_no} ${inv.customer_name} ${inv.sales_order_no} ${(inv.items || []).map((i) => `${i.item_name} ${i.lot_no}`).join(' ')}`
        .toLowerCase()
        .includes(q)
    );
  }, [invoices, invoiceSearch]);

  const totals = useMemo(() => {
    const totalQty = round2(items.reduce((s, it) => s + Number(it.complaint_qty || 0), 0));
    const totalWt = round2(items.reduce((s, it) => s + Number(it.complaint_weight || 0), 0));
    const lotCount = new Set(items.map((i) => String(i.lot_no || '').trim()).filter(Boolean)).size;
    return { totalQty, totalWt, lineCount: items.length, lotCount };
  }, [items]);

  const handleInvoiceSelect = (salesIdStr) => {
    if (!salesIdStr) {
      setFormData((prev) => ({ ...prev, original_sales_id: '', original_invoice_no: '', original_invoice_date: '' }));
      return;
    }
    const inv = invoices.find((x) => String(x.id) === String(salesIdStr));
    if (!inv) return;

    setFormData((prev) => ({
      ...prev,
      original_sales_id: String(inv.id),
      original_invoice_no: inv.inv_no || '',
      original_invoice_date: inv.date || '',
      sales_order_no: inv.sales_order_no || prev.sales_order_no,
      customer_id: inv.customer_id ? String(inv.customer_id) : prev.customer_id,
      customer_name: inv.customer_name || prev.customer_name,
      customer_gstin: inv.customer_gstin || prev.customer_gstin,
      customer_phone: inv.customer_phone || prev.customer_phone,
      customer_email: inv.customer_email || prev.customer_email,
      customer_address: inv.customer_address || prev.customer_address
    }));

    if (Array.isArray(inv.items) && inv.items.length > 0) {
      setItems(
        inv.items.map((si) => ({
          ...EMPTY_ITEM,
          original_sales_id: inv.id,
          original_sales_item_id: si.original_sales_item_id || null,
          item_id: si.item_id ? String(si.item_id) : '',
          item_name: si.item_name || '',
          product_code: si.product_code || '',
          lot_no: si.lot_no || '',
          mfg_date: si.mfg_date || '',
          exp_date: si.exp_date || '',
          uom: si.uom || 'Bags',
          weight_per_unit: String(si.weight_per_unit || 50),
          invoice_qty: round2(si.invoice_qty || 0),
          complaint_qty: String(si.invoice_qty || ''),
          complaint_weight: String(round2((si.invoice_qty || 0) * (si.weight_per_unit || 50))),
          issue_notes: ''
        }))
      );
      showNotice('success', `Loaded ${inv.items.length} item / FG lot line(s) from Invoice ${inv.inv_no}.`);
    }
  };

  const handleCustomerSelect = (custId) => {
    const c = customers.find((x) => String(x.id) === String(custId));
    setFormData((prev) => ({
      ...prev,
      customer_id: custId,
      customer_name: c ? (c.name || c.print_name) : prev.customer_name,
      customer_gstin: c?.gst_number || prev.customer_gstin,
      customer_phone: c?.mobile1 || c?.phone_off || prev.customer_phone,
      customer_email: c?.email || prev.customer_email,
      customer_address: c ? [c.address1, c.address2].filter(Boolean).join(', ') : prev.customer_address
    }));
  };

  const handleItemChange = (idx, field, val) => {
    setItems((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        const next = { ...row, [field]: val };
        if (field === 'item_name') {
          const im = itemMaster.find((m) => m.item_name === val);
          if (im) {
            next.item_id = String(im.id);
            next.product_code = im.item_code || '';
          }
        }
        if (field === 'complaint_qty' || field === 'weight_per_unit') {
          const q = Number(field === 'complaint_qty' ? val : next.complaint_qty) || 0;
          const wt = Number(field === 'weight_per_unit' ? val : next.weight_per_unit) || 50;
          next.complaint_weight = String(round2(q * wt));
        }
        return next;
      })
    );
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.slice(0, 6).forEach((file) => {
      if (file.size > 3 * 1024 * 1024) {
        showNotice('error', `File "${file.name}" exceeds 3 MB limit.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        const kind = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : 'document';
        setEvidence((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: file.name,
            kind,
            mime: file.type,
            size: file.size,
            url: dataUrl,
            notes: '',
            uploaded_at: todayIso
          }
        ]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleAddExternalEvidence = () => {
    if (!linkDraft.name.trim() && !linkDraft.url.trim()) return;
    setEvidence((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: linkDraft.name.trim() || 'Document Reference',
        kind: 'document',
        mime: '',
        size: 0,
        url: linkDraft.url.trim(),
        notes: linkDraft.notes.trim(),
        uploaded_at: todayIso
      }
    ]);
    setLinkDraft({ name: '', url: '', notes: '' });
  };

  const saveComplaint = async (afterAction = null) => {
    if (!formData.customer_name.trim()) {
      showNotice('error', 'Customer Name is required.');
      return;
    }
    if (!formData.complaint_description.trim()) {
      showNotice('error', 'Complaint Description is required.');
      return;
    }
    const validItems = items.filter((it) => String(it.item_name || '').trim() !== '');
    if (validItems.length === 0) {
      showNotice('error', 'Add at least one affected product / FG lot row.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        return_required: formData.return_required ? 1 : 0,
        items: validItems,
        evidence
      };
      let savedId = editId;
      if (editId) {
        await api(`/complaints/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
        showNotice('success', `Customer Complaint ${formData.complaint_no} updated.`);
      } else {
        const res = await api('/complaints', { method: 'POST', body: JSON.stringify(payload) });
        savedId = res?.id;
        showNotice('success', res?.message || 'Customer Complaint registered.');
      }

      if (afterAction === 'capa' && savedId) {
        navigate(`/entry/capa-create?complaint_id=${savedId}`);
      } else if (afterAction === 'return' && savedId) {
        navigate(`/entry/sales-return-create?complaint_id=${savedId}`);
      } else if (!editId && savedId) {
        navigate(`/entry/customer-complaint-create?id=${savedId}`, { replace: true });
      }
    } catch (err) {
      showNotice('error', err.message || 'Failed to save customer complaint');
    } finally {
      setSaving(false);
    }
  };

  if (initializing) {
    return (
      <div className="sr-page">
        <div style={{ padding: '40px', textAlign: 'center', fontWeight: 700, color: '#1e3a8a' }}>
          Loading Customer Complaint Workspace...
        </div>
      </div>
    );
  }

  return (
    <div className="sr-page">
      {/* Header Bar */}
      <div className="sr-header-bar">
        <div className="sr-header-left">
          <button
            type="button"
            className="sr-back-btn"
            onClick={() => navigate('/entry/customer-complaint-display')}
          >
            ← Back
          </button>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span>{editId ? `Customer Complaint · ${formData.complaint_no}` : 'Register Customer Complaint'}</span>
              <span
                className="sr-badge-pill"
                style={{
                  backgroundColor: formData.severity === 'Critical' ? '#fee2e2' : formData.severity === 'Major' ? '#fef3c7' : '#e0f2fe',
                  color: formData.severity === 'Critical' ? '#991b1b' : formData.severity === 'Major' ? '#92400e' : '#0369a1'
                }}
              >
                {formData.severity} Severity
              </span>
              <span
                className="sr-badge-pill"
                style={{
                  backgroundColor: formData.investigation_status === 'Resolved' ? '#dcfce7' : '#e0f2fe',
                  color: formData.investigation_status === 'Resolved' ? '#166534' : '#1e40af'
                }}
              >
                {formData.investigation_status}
              </span>
              <span className="sr-badge-pill" style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                {formData.return_required ? 'Return Required: Yes' : 'Return Required: No (CAPA Eligible)'}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#dbeafe', marginTop: '2px' }}>
              {selectedCompany?.name || 'BVC Company'} · FY {financialYear} · Independent Complaint Registration linked to Invoices, Returns &amp; CAPA
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="sr-back-btn"
            onClick={() => navigate('/entry/customer-complaint-display')}
          >
            Complaint Register
          </button>
          {editId && (
            <button
              type="button"
              onClick={() => navigate(`/entry/sales-return-create?complaint_id=${editId}`)}
              style={{
                backgroundColor: '#0284c7',
                color: '#fff',
                border: 'none',
                borderRadius: '5px',
                padding: '7px 12px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              + Create Sales Return
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={() => saveComplaint('capa')}
            style={{
              backgroundColor: '#16a34a',
              color: '#fff',
              border: 'none',
              borderRadius: '5px',
              padding: '7px 14px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            {saving ? 'Saving...' : 'Save & Generate CAPA'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => saveComplaint(null)}
            style={{
              backgroundColor: '#f59e0b',
              color: '#0f172a',
              border: 'none',
              borderRadius: '5px',
              padding: '7px 16px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            {saving ? 'Saving...' : editId ? 'Update Complaint' : 'Save Complaint'}
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="sr-kpi-grid">
        <div className="sr-kpi-card">
          <div className="sr-kpi-label">Complaint Reference</div>
          <div className="sr-kpi-value">{formData.complaint_no || 'CMP-NEW'}</div>
          <div className="sr-kpi-sub">Inv: {formData.original_invoice_no || 'Not Linked'}</div>
        </div>
        <div className="sr-kpi-card">
          <div className="sr-kpi-label">Affected Products &amp; Lots</div>
          <div className="sr-kpi-value">{totals.lineCount} Line(s) · {totals.lotCount} Lot(s)</div>
          <div className="sr-kpi-sub">Multi-product &amp; multi-FG lot traceable</div>
        </div>
        <div className="sr-kpi-card">
          <div className="sr-kpi-label">Complaint Qty &amp; Weight</div>
          <div className="sr-kpi-value">{totals.totalQty} Units</div>
          <div className="sr-kpi-sub">{totals.totalWt.toLocaleString('en-IN')} kg claimed affected</div>
        </div>
        <div className="sr-kpi-card">
          <div className="sr-kpi-label">Linked Returns &amp; CAPAs</div>
          <div className="sr-kpi-value">
            {linkedInfo.sales_returns.length} Return(s) · {linkedInfo.capas.length} CAPA(s)
          </div>
          <div className="sr-kpi-sub">
            {formData.return_required ? 'Physical return expected' : 'No physical return required'}
          </div>
        </div>
      </div>

      {banner.text && (
        <div
          style={{
            marginTop: '12px',
            padding: '10px 14px',
            borderRadius: '6px',
            fontWeight: 700,
            fontSize: '13px',
            backgroundColor: banner.type === 'error' ? '#fee2e2' : '#dcfce7',
            color: banner.type === 'error' ? '#991b1b' : '#166534',
            border: `1px solid ${banner.type === 'error' ? '#fca5a5' : '#86efac'}`
          }}
        >
          {banner.text}
        </div>
      )}

      {/* SECTION A: COMPLAINT IDENTIFICATION & INVOICE TRACE */}
      <div className="sr-section-card" style={{ marginTop: '12px' }}>
        <div className="sr-section-header">
          <span className="sr-section-title">1. Complaint Identification, Customer &amp; Original Sales Invoice Reference</span>
          <span style={{ fontSize: '12px', color: '#475569' }}>
            Select a posted Sales Invoice to auto-fill customer, products, and FG lots
          </span>
        </div>
        <div className="sr-section-body">
          <div className="sr-form-grid">
            <div className="sr-field">
              <label className="sr-label">Filter Sales Invoices</label>
              <input
                type="text"
                className="sr-input"
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                placeholder="Search invoice, customer, lot..."
              />
            </div>
            <div className="sr-field span-2">
              <label className="sr-label">Link Original Sales Invoice (Auto-Fill)</label>
              <select
                className="sr-select"
                value={formData.original_sales_id}
                onChange={(e) => handleInvoiceSelect(e.target.value)}
              >
                <option value="">-- Optional: Select Posted Sales Invoice --</option>
                {filteredInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.inv_no} · {inv.date} · {inv.customer_name} ({(inv.items || []).length} items)
                  </option>
                ))}
              </select>
            </div>
            <div className="sr-field">
              <label className="sr-label">Complaint No.</label>
              <input
                type="text"
                className="sr-input"
                value={formData.complaint_no}
                onChange={(e) => setFormData((p) => ({ ...p, complaint_no: e.target.value }))}
                style={{ fontWeight: 700, backgroundColor: '#f8fafc' }}
              />
            </div>

            <div className="sr-field">
              <label className="sr-label">Complaint Date <span className="sr-req">*</span></label>
              <input
                type="date"
                className="sr-input"
                value={formData.complaint_date}
                onChange={(e) => setFormData((p) => ({ ...p, complaint_date: e.target.value }))}
              />
            </div>
            <div className="sr-field">
              <label className="sr-label">Customer Name <span className="sr-req">*</span></label>
              <select
                className="sr-select"
                value={formData.customer_id}
                onChange={(e) => handleCustomerSelect(e.target.value)}
              >
                <option value="">{formData.customer_name ? `${formData.customer_name} (Selected)` : '-- Select Customer --'}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name || c.print_name}</option>
                ))}
              </select>
            </div>
            <div className="sr-field">
              <label className="sr-label">Customer Complaint Ref.</label>
              <input
                type="text"
                className="sr-input"
                value={formData.customer_complaint_ref}
                onChange={(e) => setFormData((p) => ({ ...p, customer_complaint_ref: e.target.value }))}
                placeholder="Email / Letter / PO Ref..."
              />
            </div>
            <div className="sr-field">
              <label className="sr-label">Original Invoice No.</label>
              <input
                type="text"
                className="sr-input"
                value={formData.original_invoice_no}
                onChange={(e) => setFormData((p) => ({ ...p, original_invoice_no: e.target.value }))}
                placeholder="SAL-00001"
              />
            </div>

            <div className="sr-field">
              <label className="sr-label">Complaint Category <span className="sr-req">*</span></label>
              <select
                className="sr-select"
                value={formData.complaint_category}
                onChange={(e) => setFormData((p) => ({ ...p, complaint_category: e.target.value }))}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="sr-field">
              <label className="sr-label">Severity</label>
              <select
                className="sr-select"
                value={formData.severity}
                onChange={(e) => setFormData((p) => ({ ...p, severity: e.target.value }))}
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="sr-field">
              <label className="sr-label">Physical Return Required?</label>
              <select
                className="sr-select"
                value={formData.return_required ? '1' : '0'}
                onChange={(e) => setFormData((p) => ({ ...p, return_required: e.target.value === '1' }))}
              >
                <option value="0">No (Investigate &amp; CAPA Only)</option>
                <option value="1">Yes (Customer Returning Goods)</option>
              </select>
            </div>
            <div className="sr-field">
              <label className="sr-label">Investigation Status</label>
              <select
                className="sr-select"
                value={formData.investigation_status}
                onChange={(e) => setFormData((p) => ({ ...p, investigation_status: e.target.value }))}
              >
                {STATUSES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            <div className="sr-field span-2">
              <label className="sr-label">Complaint Description <span className="sr-req">*</span></label>
              <textarea
                className="sr-textarea"
                value={formData.complaint_description}
                onChange={(e) => setFormData((p) => ({ ...p, complaint_description: e.target.value }))}
                placeholder="Describe reported product defect, moisture/packaging issue, customer observation..."
              />
            </div>
            <div className="sr-field span-2">
              <label className="sr-label">Customer Communication Details</label>
              <textarea
                className="sr-textarea"
                value={formData.customer_communication}
                onChange={(e) => setFormData((p) => ({ ...p, customer_communication: e.target.value }))}
                placeholder="Phone call / email summary, customer representative name, immediate commitment..."
              />
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: MULTI-PRODUCT & FG LOT TABLE */}
      <div className="sr-section-card">
        <div className="sr-section-header">
          <span className="sr-section-title">2. Affected Products &amp; Finished-Goods Lots (Multi-Item / Multi-Lot Traceable)</span>
          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, { ...EMPTY_ITEM }])}
            style={{
              backgroundColor: '#1f4fb2',
              color: '#fff',
              border: 'none',
              borderRadius: '5px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            + Add Product / Lot Row
          </button>
        </div>
        <div className="sr-section-body">
          <div className="sr-table-wrap">
            <table className="sr-items-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th style={{ minWidth: '190px' }}>Item Name *</th>
                  <th style={{ minWidth: '95px' }}>Code</th>
                  <th style={{ minWidth: '125px' }}>FG Lot No.</th>
                  <th style={{ minWidth: '115px' }}>Mfg Date</th>
                  <th style={{ minWidth: '115px' }}>Exp Date</th>
                  <th style={{ minWidth: '85px' }}>UOM</th>
                  <th style={{ minWidth: '85px', textAlign: 'right' }}>Inv Qty</th>
                  <th style={{ minWidth: '105px', textAlign: 'right' }}>Complaint Qty</th>
                  <th style={{ minWidth: '80px', textAlign: 'right' }}>Wt/Unit</th>
                  <th style={{ minWidth: '110px', textAlign: 'right' }}>Complaint Wt (Kg)</th>
                  <th style={{ minWidth: '180px' }}>Line Issue Notes</th>
                  <th style={{ width: '48px', textAlign: 'center' }}>Del</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{idx + 1}</td>
                    <td>
                      <select
                        className="sr-tbl-select"
                        value={row.item_name || ''}
                        onChange={(e) => handleItemChange(idx, 'item_name', e.target.value)}
                      >
                        <option value="">-- Select Product --</option>
                        {itemMaster.map((im) => (
                          <option key={im.id} value={im.item_name}>{im.item_name}</option>
                        ))}
                        {row.item_name && !itemMaster.some((m) => m.item_name === row.item_name) && (
                          <option value={row.item_name}>{row.item_name}</option>
                        )}
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="sr-tbl-input"
                        value={row.product_code || ''}
                        onChange={(e) => handleItemChange(idx, 'product_code', e.target.value)}
                        placeholder="SKU"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="sr-tbl-input"
                        value={row.lot_no || ''}
                        onChange={(e) => handleItemChange(idx, 'lot_no', e.target.value)}
                        placeholder="FG LOT..."
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        className="sr-tbl-input"
                        value={row.mfg_date || ''}
                        onChange={(e) => handleItemChange(idx, 'mfg_date', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        className="sr-tbl-input"
                        value={row.exp_date || ''}
                        onChange={(e) => handleItemChange(idx, 'exp_date', e.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        className="sr-tbl-select"
                        value={row.uom || 'Bags'}
                        onChange={(e) => handleItemChange(idx, 'uom', e.target.value)}
                      >
                        <option value="Bags">Bags</option>
                        <option value="Kg">Kg</option>
                        <option value="Nos">Nos</option>
                        <option value="Boxes">Boxes</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        className="sr-tbl-input sr-num"
                        value={row.invoice_qty || 0}
                        onChange={(e) => handleItemChange(idx, 'invoice_qty', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        className="sr-tbl-input sr-num"
                        style={{ fontWeight: 700, borderColor: '#1f4fb2' }}
                        value={row.complaint_qty}
                        onChange={(e) => handleItemChange(idx, 'complaint_qty', e.target.value)}
                        placeholder="0"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        className="sr-tbl-input sr-num"
                        value={row.weight_per_unit}
                        onChange={(e) => handleItemChange(idx, 'weight_per_unit', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        className="sr-tbl-input sr-num"
                        value={row.complaint_weight}
                        onChange={(e) => handleItemChange(idx, 'complaint_weight', e.target.value)}
                        placeholder="0"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="sr-tbl-input"
                        value={row.issue_notes || ''}
                        onChange={(e) => handleItemChange(idx, 'issue_notes', e.target.value)}
                        placeholder="Lot defect observation..."
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        disabled={items.length <= 1}
                        onClick={() => setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev))}
                        style={{
                          backgroundColor: items.length <= 1 ? '#e2e8f0' : '#dc2626',
                          color: items.length <= 1 ? '#94a3b8' : '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          width: '28px',
                          height: '28px',
                          fontWeight: 700,
                          cursor: items.length <= 1 ? 'not-allowed' : 'pointer'
                        }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SECTION 3: EVIDENCE (IMAGES, VIDEOS, DOCUMENTS) */}
      <div className="sr-section-card">
        <div className="sr-section-header">
          <span className="sr-section-title">3. Complaint Evidence (Images, Videos, Lab Reports &amp; Documents)</span>
          <label
            style={{
              backgroundColor: '#1f4fb2',
              color: '#fff',
              padding: '6px 12px',
              borderRadius: '5px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            + Upload Photo / Video / PDF
            <input
              type="file"
              accept="image/*,video/mp4,video/webm,application/pdf"
              multiple
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </label>
        </div>
        <div className="sr-section-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr auto', gap: '10px', alignItems: 'end', marginBottom: '12px' }}>
            <div className="sr-field">
              <label className="sr-label">Document / Photo Title</label>
              <input
                type="text"
                className="sr-input"
                value={linkDraft.name}
                onChange={(e) => setLinkDraft((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g., Customer Email / Lab Report"
              />
            </div>
            <div className="sr-field">
              <label className="sr-label">Attachment URL / File Ref (Optional)</label>
              <input
                type="text"
                className="sr-input"
                value={linkDraft.url}
                onChange={(e) => setLinkDraft((p) => ({ ...p, url: e.target.value }))}
                placeholder="https://... or /uploads/..."
              />
            </div>
            <div className="sr-field">
              <label className="sr-label">Notes</label>
              <input
                type="text"
                className="sr-input"
                value={linkDraft.notes}
                onChange={(e) => setLinkDraft((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Evidence context..."
              />
            </div>
            <button
              type="button"
              onClick={handleAddExternalEvidence}
              style={{
                height: '36px',
                backgroundColor: '#0f766e',
                color: '#fff',
                border: 'none',
                borderRadius: '5px',
                padding: '0 14px',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              + Add Reference
            </button>
          </div>

          {evidence.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#64748b', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
              No photographic, video, or document evidence attached yet. Upload files or add document references above.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
              {evidence.map((ev) => (
                <div key={ev.id} style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px', backgroundColor: '#fff' }}>
                  {ev.kind === 'image' && ev.url && (
                    <img
                      src={ev.url}
                      alt={ev.name}
                      style={{ width: '100%', height: '110px', objectFit: 'cover', borderRadius: '4px', marginBottom: '6px' }}
                    />
                  )}
                  <div style={{ fontWeight: 700, fontSize: '12px', color: '#0f172a', wordBreak: 'break-word' }}>{ev.name}</div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    {ev.kind.toUpperCase()} {ev.uploaded_at ? `· ${ev.uploaded_at}` : ''}
                  </div>
                  {ev.notes && <div style={{ fontSize: '11px', color: '#334155', marginTop: '4px' }}>{ev.notes}</div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                    {ev.url && ev.url.startsWith('http') ? (
                      <a href={ev.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#1f4fb2', fontWeight: 700 }}>
                        Open Link
                      </a>
                    ) : <span />}
                    <button
                      type="button"
                      onClick={() => setEvidence((prev) => prev.filter((x) => x.id !== ev.id))}
                      style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* LINKED RETURNS & CAPA HISTORY (When editing existing complaint) */}
      {editId && (
        <div className="sr-section-card">
          <div className="sr-section-header">
            <span className="sr-section-title">4. Connected Sales Returns &amp; CAPA Documents (Independent Records)</span>
          </div>
          <div className="sr-section-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '6px', color: '#1e3a8a' }}>
                Linked Sales Returns ({linkedInfo.sales_returns.length})
              </div>
              {linkedInfo.sales_returns.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#64748b' }}>No physical sales returns recorded for this complaint.</div>
              ) : (
                linkedInfo.sales_returns.map((sr) => (
                  <div
                    key={sr.id}
                    style={{ padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '5px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '12px' }}>{sr.return_no || `SR-${sr.s_no}`} · {sr.date}</div>
                      <div style={{ fontSize: '11px', color: '#475569' }}>
                        Returned Qty: {sr.total_qty} | QC: {sr.qc_status} | Stock: {sr.stock_status}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/entry/sales-return-create?id=${sr.id}`)}
                      style={{ backgroundColor: '#eff6ff', color: '#1f4fb2', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Open Return
                    </button>
                  </div>
                ))
              )}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '6px', color: '#1e3a8a' }}>
                Linked CAPA Documents ({linkedInfo.capas.length})
              </div>
              {linkedInfo.capas.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#64748b' }}>No CAPA generated yet. Use &ldquo;Save &amp; Generate CAPA&rdquo; above.</div>
              ) : (
                linkedInfo.capas.map((cp) => (
                  <div
                    key={cp.id}
                    style={{ padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '5px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '12px' }}>{cp.capa_no} · {cp.capa_date}</div>
                      <div style={{ fontSize: '11px', color: '#475569' }}>
                        Status: {cp.capa_status} | Effectiveness: {cp.effectiveness_status}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/entry/capa-create?id=${cp.id}`)}
                      style={{ backgroundColor: '#ecfdf5', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Open CAPA
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerComplaintCreate;
