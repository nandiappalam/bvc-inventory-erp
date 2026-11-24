import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext';
import { printHtml } from '../utils/printHelper';
import './SalesReturnCreate.css';

const SECTIONS = [
  { id: 'all', label: 'All Sections (A–H)' },
  { id: 'A', label: 'A. CAPA ID' },
  { id: 'B', label: 'B. Product & Lots' },
  { id: 'C', label: 'C. Complaint & Evidence' },
  { id: 'D', label: 'D. Investigation & RCA' },
  { id: 'E', label: 'E. Corrective Action' },
  { id: 'F', label: 'F. Preventive Action' },
  { id: 'G', label: 'G. Effectiveness' },
  { id: 'H', label: 'H. Approval & Closure' }
];

const EMPTY_ITEM = {
  complaint_item_id: null,
  sales_return_item_id: null,
  item_id: '',
  product_name: '',
  product_code: '',
  lot_no: '',
  mfg_date: '',
  exp_date: '',
  invoice_qty: 0,
  complaint_qty: 0,
  returned_qty: 0,
  uom: 'Bags',
  batch_no: '',
  rm_lot_nos: '',
  qc_summary: ''
};

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

const round2 = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : 0;
};

export function buildFormalCapaPrintHtml(doc, companyName = 'BVC Exports Pvt Ltd') {
  const items = Array.isArray(doc.items) ? doc.items : [];
  const trace = Array.isArray(doc.batch_traceability) ? doc.batch_traceability : [];
  const itemRows =
    items.length > 0
      ? items
          .map(
            (it, idx) => `
          <tr>
            <td style="text-align:center;">${idx + 1}</td>
            <td><strong>${escHtml(it.product_name)}</strong>${it.product_code ? ` <span style="color:#64748b;">(${escHtml(it.product_code)})</span>` : ''}</td>
            <td style="font-family:monospace;">${escHtml(it.lot_no || '—')}</td>
            <td>${escHtml(formatDateDMY(it.mfg_date))}</td>
            <td>${escHtml(formatDateDMY(it.exp_date))}</td>
            <td style="text-align:right;">${round2(it.invoice_qty)}</td>
            <td style="text-align:right;">${round2(it.complaint_qty)}</td>
            <td style="text-align:right;">${round2(it.returned_qty)}</td>
            <td style="font-size:10px;">${escHtml(it.batch_no || '—')}</td>
            <td style="font-size:10px;">${escHtml(it.rm_lot_nos || '—')}</td>
          </tr>`
          )
          .join('')
      : '<tr><td colspan="10" style="text-align:center;color:#64748b;">No product lines linked</td></tr>';

  const traceHtml =
    trace.length > 0
      ? trace
          .map(
            (tr) => `
          <div style="border:1px solid #cbd5e1;padding:6px 8px;margin-bottom:6px;border-radius:4px;font-size:11px;">
            <strong>FG Lot: ${escHtml(tr.lot_no || '—')}</strong> (${escHtml(tr.item_name || '')}) ·
            Mfg: ${escHtml(formatDateDMY(tr.mfg_date))} · Exp: ${escHtml(formatDateDMY(tr.exp_date))} |
            <strong>Batches:</strong> ${escHtml((tr.manufacturing_batches || []).map((b) => b.batch_no).join(', ') || (tr.packing_batches || []).map((p) => p.packing_no).join(', ') || '—')} |
            <strong>RM Parent Lots:</strong> ${escHtml((tr.rm_parent_lots || []).map((r) => (r.supplier ? `${r.lot_no} (${r.supplier})` : r.lot_no)).join(', ') || '—')}
          </div>`
          )
          .join('')
      : '<div style="font-size:11px;color:#64748b;">No linked manufacturing batch / RM parent lot trace recorded.</div>';

  const evidenceList = Array.isArray(doc.evidence) ? doc.evidence : [];
  const evidenceHtml =
    evidenceList.length > 0
      ? evidenceList
          .map((ev, idx) => {
            const urlStr = String(ev?.url || '').trim();
            const mimeStr = String(ev?.mime_type || ev?.mime || ev?.type || '').toLowerCase();
            const kindStr = String(ev?.kind || '').toLowerCase();
            const nameStr = String(ev?.name || 'Reference File');
            const isDataUri = urlStr.startsWith('data:');
            const isImg =
              kindStr === 'image' ||
              mimeStr.startsWith('image/') ||
              urlStr.startsWith('data:image/') ||
              /\.(png|jpe?g|webp|gif|svg)$/i.test(nameStr);
            const isVid =
              !isImg &&
              (kindStr === 'video' ||
                mimeStr.startsWith('video/') ||
                urlStr.startsWith('data:video/') ||
                /\.(mp4|webm|mov|ogg)$/i.test(nameStr));
            const typeLabel = mimeStr || (isImg ? 'image' : isVid ? 'video' : 'document');
            const safeExternalUrl = !isDataUri && urlStr ? urlStr : '';

            return `
          <div style="border:1px solid #cbd5e1;padding:6px 8px;margin-bottom:6px;border-radius:4px;background:#f8fafc;page-break-inside:avoid;">
            <div style="font-weight:700;color:#1e3a8a;">#${idx + 1} · ${escHtml(nameStr)} <span style="font-size:10px;color:#64748b;font-weight:normal;">(${escHtml(typeLabel)})</span></div>
            ${ev?.notes ? '<div style="font-size:11px;color:#334155;margin-top:2px;">Notes: ' + escHtml(ev.notes) + '</div>' : ''}
            ${
              isImg && urlStr
                ? '<div style="margin-top:6px;"><img src="' + escHtml(urlStr) + '" alt="' + escHtml(nameStr) + '" style="max-width:220px;max-height:150px;object-fit:contain;border:1px solid #cbd5e1;border-radius:4px;background:#fff;" /></div>'
                : isVid
                ? '<div style="margin-top:5px;padding:6px 8px;background:#eff6ff;border:1px dashed #93c5fd;border-radius:4px;font-size:11px;color:#1e3a8a;"><strong>Video Reference Attached</strong>' +
                  (safeExternalUrl ? ` — <a href="${escHtml(safeExternalUrl)}" target="_blank" rel="noreferrer" style="color:#2563eb;word-break:break-all;">${escHtml(safeExternalUrl)}</a>` : ' (Stored in BVC ERP Quality Dossier)') +
                  '</div>'
                : '<div style="margin-top:5px;padding:5px 8px;background:#ffffff;border:1px dashed #cbd5e1;border-radius:4px;font-size:11px;color:#334155;">' +
                  (safeExternalUrl
                    ? `<a href="${escHtml(safeExternalUrl)}" target="_blank" rel="noreferrer" style="color:#2563eb;word-break:break-all;">${escHtml(safeExternalUrl)}</a>`
                    : 'Attached Document Reference (Stored in BVC ERP Quality Dossier)') +
                  '</div>'
            }
          </div>`;
          })
          .join('')
      : '<div style="font-size:11px;color:#64748b;">No reference images or videos attached.</div>';

  return `
    <div style="font-family:Arial,sans-serif;color:#0f172a;padding:10px;font-size:12px;line-height:1.4;">
      <div style="border:2px solid #1e3a8a;padding:12px 16px;margin-bottom:12px;background:#f8fafc;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:11px;font-weight:700;color:#1e3a8a;letter-spacing:0.8px;">${escHtml(companyName)}</div>
            <h1 style="margin:2px 0;font-size:16px;color:#0f172a;letter-spacing:0.3px;">BVC QUALITY MANAGEMENT — CORRECTIVE AND PREVENTIVE ACTION REPORT</h1>
          </div>
          <div style="text-align:right;font-size:11px;">
            <div><strong>CAPA No:</strong> ${escHtml(doc.capa_no)}</div>
            <div><strong>Date:</strong> ${escHtml(formatDateDMY(doc.capa_date))}</div>
            <div><strong>Status:</strong> ${escHtml(doc.capa_status || 'Open')} (${escHtml(doc.effectiveness_status || 'Pending')})</div>
          </div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:10px;font-size:11px;">
        <tr>
          <th colspan="4" style="background:#1e3a8a;color:#fff;text-align:left;padding:5px 8px;">SECTION A · CAPA IDENTIFICATION & SOURCE TRACEABILITY</th>
        </tr>
        <tr>
          <td style="border:1px solid #cbd5e1;padding:5px 8px;width:25%;"><strong>CAPA Source:</strong> ${escHtml(doc.capa_source || '—')}</td>
          <td style="border:1px solid #cbd5e1;padding:5px 8px;width:25%;"><strong>Customer Complaint No:</strong> ${escHtml(doc.complaint_no || '—')}</td>
          <td style="border:1px solid #cbd5e1;padding:5px 8px;width:25%;"><strong>Sales Return No:</strong> ${escHtml(doc.sales_return_no || '—')}</td>
          <td style="border:1px solid #cbd5e1;padding:5px 8px;width:25%;"><strong>Original Invoice No:</strong> ${escHtml(doc.original_invoice_no || '—')}</td>
        </tr>
        <tr>
          <td colspan="2" style="border:1px solid #cbd5e1;padding:5px 8px;"><strong>Customer Name:</strong> ${escHtml(doc.customer_name || '—')}</td>
          <td colspan="2" style="border:1px solid #cbd5e1;padding:5px 8px;"><strong>Customer Complaint Ref:</strong> ${escHtml(doc.customer_complaint_ref || '—')}</td>
        </tr>
      </table>

      <div style="font-weight:700;background:#1e3a8a;color:#fff;padding:5px 8px;font-size:11px;">SECTION B · AFFECTED PRODUCT & FINISHED GOODS LOT DETAILS</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:10px;font-size:11px;">
        <thead>
          <tr style="background:#e2e8f0;">
            <th style="border:1px solid #cbd5e1;padding:4px;">#</th>
            <th style="border:1px solid #cbd5e1;padding:4px;text-align:left;">Product</th>
            <th style="border:1px solid #cbd5e1;padding:4px;text-align:left;">FG Lot No.</th>
            <th style="border:1px solid #cbd5e1;padding:4px;text-align:left;">Mfg Date</th>
            <th style="border:1px solid #cbd5e1;padding:4px;text-align:left;">Exp Date</th>
            <th style="border:1px solid #cbd5e1;padding:4px;text-align:right;">Inv Qty</th>
            <th style="border:1px solid #cbd5e1;padding:4px;text-align:right;">Compl Qty</th>
            <th style="border:1px solid #cbd5e1;padding:4px;text-align:right;">Ret Qty</th>
            <th style="border:1px solid #cbd5e1;padding:4px;text-align:left;">Batch No</th>
            <th style="border:1px solid #cbd5e1;padding:4px;text-align:left;">RM Parent Lots</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <table style="width:100%;border-collapse:collapse;margin-bottom:10px;font-size:11px;">
        <tr><th colspan="2" style="background:#1e3a8a;color:#fff;text-align:left;padding:5px 8px;">SECTION C · COMPLAINT DESCRIPTION & COMMUNICATION</th></tr>
        <tr>
          <td style="border:1px solid #cbd5e1;padding:5px 8px;width:50%;"><strong>Category:</strong> ${escHtml(doc.complaint_category || '—')} · <strong>Date:</strong> ${escHtml(formatDateDMY(doc.complaint_date))}</td>
          <td style="border:1px solid #cbd5e1;padding:5px 8px;width:50%;"><strong>Condition of Affected Goods:</strong> ${escHtml(doc.affected_condition || '—')}</td>
        </tr>
        <tr><td colspan="2" style="border:1px solid #cbd5e1;padding:5px 8px;"><strong>Reported Problem:</strong> ${escHtml(doc.reported_problem || '—')}</td></tr>
        <tr><td colspan="2" style="border:1px solid #cbd5e1;padding:5px 8px;"><strong>Customer Communication:</strong> ${escHtml(doc.customer_communication || '—')}</td></tr>
      </table>

      <div style="font-weight:700;background:#1e3a8a;color:#fff;padding:5px 8px;font-size:11px;">SECTION D · INVESTIGATION, BATCH GENEALOGY & ROOT CAUSE ANALYSIS</div>
      <div style="border:1px solid #cbd5e1;border-top:none;padding:8px;margin-bottom:10px;font-size:11px;">
        <div style="margin-bottom:6px;"><strong>Investigation Findings:</strong> ${escHtml(doc.investigation_findings || '—')}</div>
        <div style="margin-bottom:6px;"><strong>QC Inspection Results:</strong> ${escHtml(doc.qc_inspection_results || '—')}</div>
        <div style="margin-bottom:6px;"><strong>Auto-Linked Batch &amp; RM Traceability:</strong></div>
        ${traceHtml}
        <div style="margin-top:6px;"><strong>RCA Method:</strong> ${escHtml(doc.rca_method || '5 Why')} · <strong>Identified Root Cause:</strong> ${escHtml(doc.identified_root_cause || '—')}</div>
        ${doc.rca_details ? `<div style="margin-top:4px;"><strong>RCA Details:</strong> ${escHtml(doc.rca_details)}</div>` : ''}
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:10px;font-size:11px;">
        <tr><th colspan="2" style="background:#1e3a8a;color:#fff;text-align:left;padding:5px 8px;">SECTION E · CORRECTIVE ACTION &nbsp;|&nbsp; SECTION F · PREVENTIVE ACTION</th></tr>
        <tr>
          <td style="border:1px solid #cbd5e1;padding:6px 8px;vertical-align:top;width:50%;">
            <div><strong>Immediate Containment:</strong> ${escHtml(doc.immediate_containment || '—')}</div>
            <div><strong>Correction of Existing Problem:</strong> ${escHtml(doc.existing_problem_correction || '—')}</div>
            <div><strong>Corrective Action:</strong> ${escHtml(doc.corrective_action_desc || '—')}</div>
            <div><strong>Dept / Person:</strong> ${escHtml(doc.corrective_dept || '—')} / ${escHtml(doc.corrective_person || '—')}</div>
            <div><strong>Target / Completed:</strong> ${escHtml(formatDateDMY(doc.corrective_target_date))} / ${escHtml(formatDateDMY(doc.corrective_completion_date))} (${escHtml(doc.corrective_status || 'Pending')})</div>
            <div><strong>Evidence:</strong> ${escHtml(doc.corrective_evidence || '—')}</div>
          </td>
          <td style="border:1px solid #cbd5e1;padding:6px 8px;vertical-align:top;width:50%;">
            <div><strong>Preventive Action:</strong> ${escHtml(doc.preventive_action_desc || '—')}</div>
            <div><strong>Process Improvement:</strong> ${escHtml(doc.process_improvement || '—')}</div>
            <div><strong>Training Required:</strong> ${doc.training_required ? `Yes (${escHtml(doc.training_details || 'Scheduled')})` : 'No'}</div>
            <div><strong>Inspection / Testing Improvement:</strong> ${escHtml(doc.inspection_testing_improvement || '—')}</div>
            <div><strong>Responsible Person:</strong> ${escHtml(doc.preventive_person || '—')}</div>
            <div><strong>Target / Completed:</strong> ${escHtml(formatDateDMY(doc.preventive_target_date))} / ${escHtml(formatDateDMY(doc.preventive_completion_date))} (${escHtml(doc.preventive_status || 'Pending')})</div>
          </td>
        </tr>
      </table>

      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:11px;">
        <tr><th colspan="3" style="background:#1e3a8a;color:#fff;text-align:left;padding:5px 8px;">SECTION G · EFFECTIVENESS VERIFICATION &nbsp;|&nbsp; SECTION H · APPROVAL & CLOSURE</th></tr>
        <tr>
          <td style="border:1px solid #cbd5e1;padding:5px 8px;"><strong>Verification Method:</strong> ${escHtml(doc.verification_method || '—')}</td>
          <td style="border:1px solid #cbd5e1;padding:5px 8px;"><strong>Verification Date:</strong> ${escHtml(formatDateDMY(doc.verification_date))}</td>
          <td style="border:1px solid #cbd5e1;padding:5px 8px;"><strong>Effectiveness Status:</strong> ${escHtml(doc.effectiveness_status || 'Pending')}</td>
        </tr>
        <tr>
          <td colspan="3" style="border:1px solid #cbd5e1;padding:5px 8px;"><strong>Follow-Up Inspection Results &amp; Evidence:</strong> ${escHtml(doc.followup_inspection_results || '—')} ${doc.effectiveness_evidence ? ` | Evidence: ${escHtml(doc.effectiveness_evidence)}` : ''}</td>
        </tr>
        ${
          doc.waived_verification
            ? `<tr><td colspan="3" style="border:1px solid #cbd5e1;padding:5px 8px;background:#fffbeb;"><strong>Authorized Waiver Applied:</strong> ${escHtml(doc.waiver_reason || '')} (By ${escHtml(doc.waived_by || '')})</td></tr>`
            : ''
        }
        <tr>
          <td colspan="3" style="border:1px solid #cbd5e1;padding:5px 8px;"><strong>Closure Date:</strong> ${escHtml(formatDateDMY(doc.closure_date))} · <strong>Final Remarks:</strong> ${escHtml(doc.final_remarks || '—')}</td>
        </tr>
      </table>

      <div style="margin-bottom: 12px; border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px; background: #f8fafc;">
        <div style="font-weight: 700; font-size: 11px; color: #1e3a8a; margin-bottom: 6px; text-transform: uppercase;">Attached Images, Videos &amp; Evidence References</div>
        ${evidenceHtml}
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:26px;font-size:11px;text-align:center;">
        <div style="border-top:1px solid #475569;padding-top:4px;"><strong>Prepared By</strong><br/>${escHtml(doc.prepared_by || '—')}</div>
        <div style="border-top:1px solid #475569;padding-top:4px;"><strong>Quality Manager</strong><br/>${escHtml(doc.quality_manager || '—')}</div>
        <div style="border-top:1px solid #475569;padding-top:4px;"><strong>Production Manager</strong><br/>${escHtml(doc.production_manager || '—')}</div>
        <div style="border-top:1px solid #475569;padding-top:4px;"><strong>Approved By</strong><br/>${escHtml(doc.approved_by || 'Pending')}</div>
      </div>
    </div>
  `;
}

const CapaCreate = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const complaintIdParam = searchParams.get('complaint_id');
  const salesReturnIdParam = searchParams.get('sales_return_id');
  const salesIdParam = searchParams.get('sales_id');
  const { user, selectedCompany, financialYear, isAdmin } = useAuth();
  const todayIso = new Date().toISOString().split('T')[0];

  const canApprove = useMemo(() => {
    const role = String(user?.role || '').toLowerCase();
    return Boolean(isAdmin || ['admin', 'super_admin', 'superadmin', 'manager', 'quality manager', 'supervisor', 'owner'].includes(role));
  }, [user, isAdmin]);

  const [activeSection, setActiveSection] = useState('all');
  const [initializing, setInitializing] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState({ type: '', text: '' });

  const [complaints, setComplaints] = useState([]);
  const [salesReturns, setSalesReturns] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [itemMaster, setItemMaster] = useState([]);

  const [formData, setFormData] = useState({
    capa_no: '',
    capa_date: todayIso,
    capa_source: 'Customer Complaint',
    capa_status: 'Open',
    complaint_id: '',
    complaint_no: '',
    sales_return_id: '',
    sales_return_no: '',
    original_sales_id: '',
    original_invoice_no: '',
    customer_id: '',
    customer_name: '',
    customer_complaint_ref: '',
    // Section C
    reported_problem: '',
    complaint_category: 'Quality',
    complaint_date: '',
    affected_condition: '',
    customer_communication: '',
    // Section D
    investigation_findings: '',
    qc_inspection_results: '',
    identified_root_cause: '',
    rca_method: '5 Why',
    rca_details: '',
    // Section E
    immediate_containment: '',
    existing_problem_correction: '',
    corrective_action_desc: '',
    corrective_dept: 'Production / QC',
    corrective_person: '',
    corrective_target_date: '',
    corrective_completion_date: '',
    corrective_evidence: '',
    corrective_status: 'Pending',
    // Section F
    preventive_action_desc: '',
    process_improvement: '',
    training_required: false,
    training_details: '',
    inspection_testing_improvement: '',
    preventive_person: '',
    preventive_target_date: '',
    preventive_completion_date: '',
    preventive_status: 'Pending',
    // Section G
    verification_method: '',
    verification_date: '',
    followup_inspection_results: '',
    effectiveness_evidence: '',
    effectiveness_status: 'Pending',
    further_action_required: false,
    further_action_notes: '',
    // Section H
    prepared_by: user?.username || 'admin',
    quality_manager: '',
    production_manager: '',
    approved_by: '',
    closure_date: '',
    final_remarks: '',
    waived_verification: false,
    waiver_reason: '',
    waived_by: ''
  });

  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [evidence, setEvidence] = useState([]);
  const [linkDraft, setLinkDraft] = useState({ name: '', url: '', notes: '' });
  const [batchTraceability, setBatchTraceability] = useState([]);
  const [linkedRecords, setLinkedRecords] = useState({ complaint: null, sales_returns: [], audit_logs: [] });

  const [closeModal, setCloseModal] = useState({
    open: false,
    waive_verification: false,
    waiver_reason: '',
    quality_manager: '',
    production_manager: '',
    closure_date: todayIso,
    final_remarks: '',
    submitting: false,
    error: ''
  });
  const [reopenModal, setReopenModal] = useState({ open: false, reason: '', submitting: false });

  const showNotice = useCallback((type, text) => {
    setBanner({ type, text });
    if (type === 'success') {
      setTimeout(() => setBanner((prev) => (prev.text === text ? { type: '', text: '' } : prev)), 4500);
    }
  }, []);

  const applyPrefillPayload = useCallback((p) => {
    if (!p) return;
    setFormData((prev) => ({
      ...prev,
      capa_source: p.capa_source || prev.capa_source,
      complaint_id: p.complaint_id ? String(p.complaint_id) : prev.complaint_id,
      complaint_no: p.complaint_no || prev.complaint_no,
      sales_return_id: p.sales_return_id ? String(p.sales_return_id) : prev.sales_return_id,
      sales_return_no: p.sales_return_no || prev.sales_return_no,
      original_sales_id: p.original_sales_id ? String(p.original_sales_id) : prev.original_sales_id,
      original_invoice_no: p.original_invoice_no || prev.original_invoice_no,
      customer_id: p.customer_id ? String(p.customer_id) : prev.customer_id,
      customer_name: p.customer_name || prev.customer_name,
      customer_complaint_ref: p.customer_complaint_ref || prev.customer_complaint_ref,
      reported_problem: p.reported_problem || prev.reported_problem,
      complaint_category: p.complaint_category || prev.complaint_category,
      complaint_date: p.complaint_date || prev.complaint_date,
      affected_condition: p.affected_condition || prev.affected_condition,
      customer_communication: p.customer_communication || prev.customer_communication,
      qc_inspection_results: p.qc_inspection_results || prev.qc_inspection_results
    }));
    if (Array.isArray(p.items) && p.items.length > 0) {
      setItems(p.items.map((it) => ({ ...EMPTY_ITEM, ...it })));
    }
    if (Array.isArray(p.evidence) && p.evidence.length > 0) {
      setEvidence(p.evidence);
    }
    if (Array.isArray(p.batch_traceability)) {
      setBatchTraceability(p.batch_traceability);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const init = async () => {
      setInitializing(true);
      try {
        const lookupRes = await api('/capa/form-lookups').catch(() => null);
        if (!active) return;
        const lData = lookupRes?.data || {};
        setComplaints(lData.complaints || []);
        setSalesReturns(lData.salesReturns || []);
        setCustomers(lData.customers || []);
        setItemMaster(lData.items || []);

        if (editId) {
          const detailRes = await api(`/capa/${editId}`);
          const doc = detailRes?.data;
          if (!active || !doc) return;

          setFormData({
            capa_no: doc.capa_no || '',
            capa_date: doc.capa_date ? String(doc.capa_date).slice(0, 10) : todayIso,
            capa_source: doc.capa_source || 'Customer Complaint',
            capa_status: doc.capa_status || 'Open',
            complaint_id: doc.complaint_id ? String(doc.complaint_id) : '',
            complaint_no: doc.complaint_no || '',
            sales_return_id: doc.sales_return_id ? String(doc.sales_return_id) : '',
            sales_return_no: doc.sales_return_no || '',
            original_sales_id: doc.original_sales_id ? String(doc.original_sales_id) : '',
            original_invoice_no: doc.original_invoice_no || '',
            customer_id: doc.customer_id ? String(doc.customer_id) : '',
            customer_name: doc.customer_name || '',
            customer_complaint_ref: doc.customer_complaint_ref || '',
            reported_problem: doc.reported_problem || '',
            complaint_category: doc.complaint_category || 'Quality',
            complaint_date: doc.complaint_date || '',
            affected_condition: doc.affected_condition || '',
            customer_communication: doc.customer_communication || '',
            investigation_findings: doc.investigation_findings || '',
            qc_inspection_results: doc.qc_inspection_results || '',
            identified_root_cause: doc.identified_root_cause || '',
            rca_method: doc.rca_method || '5 Why',
            rca_details: doc.rca_details || '',
            immediate_containment: doc.immediate_containment || '',
            existing_problem_correction: doc.existing_problem_correction || '',
            corrective_action_desc: doc.corrective_action_desc || '',
            corrective_dept: doc.corrective_dept || '',
            corrective_person: doc.corrective_person || '',
            corrective_target_date: doc.corrective_target_date || '',
            corrective_completion_date: doc.corrective_completion_date || '',
            corrective_evidence: doc.corrective_evidence || '',
            corrective_status: doc.corrective_status || 'Pending',
            preventive_action_desc: doc.preventive_action_desc || '',
            process_improvement: doc.process_improvement || '',
            training_required: Boolean(doc.training_required),
            training_details: doc.training_details || '',
            inspection_testing_improvement: doc.inspection_testing_improvement || '',
            preventive_person: doc.preventive_person || '',
            preventive_target_date: doc.preventive_target_date || '',
            preventive_completion_date: doc.preventive_completion_date || '',
            preventive_status: doc.preventive_status || 'Pending',
            verification_method: doc.verification_method || '',
            verification_date: doc.verification_date || '',
            followup_inspection_results: doc.followup_inspection_results || '',
            effectiveness_evidence: doc.effectiveness_evidence || '',
            effectiveness_status: doc.effectiveness_status || 'Pending',
            further_action_required: Boolean(doc.further_action_required),
            further_action_notes: doc.further_action_notes || '',
            prepared_by: doc.prepared_by || user?.username || 'admin',
            quality_manager: doc.quality_manager || '',
            production_manager: doc.production_manager || '',
            approved_by: doc.approved_by || '',
            closure_date: doc.closure_date || '',
            final_remarks: doc.final_remarks || '',
            waived_verification: Boolean(doc.waived_verification),
            waiver_reason: doc.waiver_reason || '',
            waived_by: doc.waived_by || ''
          });
          if (Array.isArray(doc.items) && doc.items.length > 0) {
            setItems(doc.items.map((it) => ({ ...EMPTY_ITEM, ...it })));
          }
          setEvidence(Array.isArray(doc.evidence) ? doc.evidence : []);
          setBatchTraceability(Array.isArray(doc.batch_traceability) ? doc.batch_traceability : []);
          setLinkedRecords({
            complaint: doc.linked_complaint || null,
            sales_returns: doc.linked_sales_returns || [],
            audit_logs: doc.audit_logs || []
          });
        } else {
          const nextRes = await api('/capa/next-no').catch(() => null);
          if (!active) return;
          setFormData((prev) => ({ ...prev, capa_no: nextRes?.capa_no || 'CAPA-00001' }));

          if (complaintIdParam || salesReturnIdParam || salesIdParam) {
            const qs = new URLSearchParams();
            if (complaintIdParam) qs.set('complaint_id', complaintIdParam);
            if (salesReturnIdParam) qs.set('sales_return_id', salesReturnIdParam);
            if (salesIdParam) qs.set('sales_id', salesIdParam);
            const preRes = await api(`/capa/prefill?${qs.toString()}`).catch(() => null);
            if (active && preRes?.data) {
              applyPrefillPayload(preRes.data);
              showNotice('success', 'Loaded linked Complaint / Sales Return & Batch Traceability into CAPA.');
            }
          }
        }
      } catch (err) {
        if (active) showNotice('error', err.message || 'Failed to load CAPA form');
      } finally {
        if (active) setInitializing(false);
      }
    };
    init();
    return () => { active = false; };
  }, [editId, complaintIdParam, salesReturnIdParam, salesIdParam, todayIso, user?.username, applyPrefillPayload, showNotice]);

  const handleLoadPrefill = async (params) => {
    try {
      const qs = new URLSearchParams(params).toString();
      const res = await api(`/capa/prefill?${qs}`);
      if (res?.data) {
        applyPrefillPayload(res.data);
        showNotice('success', 'Auto-populated customer, FG lots, QC findings & RM genealogy.');
      }
    } catch (err) {
      showNotice('error', err.message || 'Failed to load linked record');
    }
  };

  const handleFieldChange = (field, value) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'customer_id') {
        const c = customers.find((x) => String(x.id) === String(value));
        if (c) next.customer_name = c.name || c.print_name || '';
      }
      if (field === 'corrective_completion_date' && value && prev.corrective_status === 'Pending') {
        next.corrective_status = 'Completed';
      }
      if (field === 'preventive_completion_date' && value && prev.preventive_status === 'Pending') {
        next.preventive_status = 'Completed';
      }
      return next;
    });
  };

  const handleItemChange = (idx, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      const row = { ...next[idx], [field]: value };
      if (field === 'product_name') {
        const im = itemMaster.find((m) => String(m.item_name).toLowerCase() === String(value).toLowerCase());
        if (im) {
          row.item_id = im.id;
          row.product_code = im.item_code || '';
        }
      }
      next[idx] = row;
      return next;
    });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      showNotice('error', 'Evidence file must be under 4 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setEvidence((prev) => [
        ...prev,
        { name: file.name, mime_type: file.type || 'application/octet-stream', url: String(reader.result || ''), notes: 'Uploaded in CAPA' }
      ]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAddExternalLink = () => {
    const u = String(linkDraft.url || '').trim();
    if (!u || (!u.startsWith('https://') && !u.startsWith('http://') && !u.startsWith('/'))) {
      showNotice('error', 'Enter a valid http://, https://, or relative / document URL.');
      return;
    }
    setEvidence((prev) => [...prev, { name: linkDraft.name.trim() || 'Document Ref', mime_type: 'link', url: u, notes: linkDraft.notes.trim() }]);
    setLinkDraft({ name: '', url: '', notes: '' });
  };

  const handleSave = async () => {
    if (formData.capa_status === 'Closed') {
      showNotice('error', 'Closed CAPA cannot be edited directly. Reopen it first if changes are required.');
      return;
    }
    const validItems = items.filter((it) => String(it.product_name || '').trim() !== '');
    if (validItems.length === 0 && !String(formData.reported_problem || '').trim()) {
      showNotice('error', 'Please add at least one Affected Product/Lot row or Reported Problem description.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        items: validItems,
        evidence,
        batch_traceability: batchTraceability
      };
      const endpoint = editId ? `/capa/${editId}` : '/capa';
      const method = editId ? 'PUT' : 'POST';
      const res = await api(endpoint, { method, body: payload });
      if (res && res.success !== false) {
        showNotice('success', res.message || 'CAPA Document saved.');
        if (!editId && res.id) {
          navigate(`/entry/capa-create?id=${res.id}`, { replace: true });
        }
      } else {
        showNotice('error', res?.message || 'Failed to save CAPA');
      }
    } catch (err) {
      showNotice('error', err.message || 'Failed to save CAPA');
    } finally {
      setSaving(false);
    }
  };

  const missingGates = useMemo(() => {
    const m = [];
    if (!String(formData.identified_root_cause || '').trim()) m.push('Identified Root Cause (Section D)');
    if (!String(formData.corrective_action_desc || '').trim() || (formData.corrective_status !== 'Completed' && !formData.corrective_completion_date)) {
      m.push('Completed Corrective Action (Section E)');
    }
    if (!String(formData.preventive_action_desc || '').trim() || (formData.preventive_status !== 'Completed' && !formData.preventive_completion_date)) {
      m.push('Completed Preventive Action (Section F)');
    }
    if (formData.effectiveness_status !== 'Effective') {
      m.push(`Effectiveness Verification must be "Effective" (currently "${formData.effectiveness_status}")`);
    } else if (!formData.verification_date && !String(formData.followup_inspection_results || '').trim()) {
      m.push('Verification Date or Follow-up Inspection Results (Section G)');
    }
    return m;
  }, [formData]);

  const handleOpenCloseModal = () => {
    setCloseModal({
      open: true,
      waive_verification: false,
      waiver_reason: '',
      quality_manager: formData.quality_manager || user?.username || 'Quality Manager',
      production_manager: formData.production_manager || '',
      closure_date: formData.closure_date || todayIso,
      final_remarks: formData.final_remarks || '',
      submitting: false,
      error: ''
    });
  };

  const handleSubmitApproveClose = async () => {
    if (!editId) return;
    setCloseModal((p) => ({ ...p, submitting: true, error: '' }));
    try {
      // Save latest form changes first so backend gate sees current Section D-G inputs
      await api(`/capa/${editId}`, {
        method: 'PUT',
        body: {
          ...formData,
          items: items.filter((it) => String(it.product_name || '').trim() !== ''),
          evidence,
          batch_traceability: batchTraceability
        }
      });

      const res = await api(`/capa/${editId}/approve-close`, {
        method: 'POST',
        body: {
          waive_verification: closeModal.waive_verification,
          waiver_reason: closeModal.waiver_reason,
          quality_manager: closeModal.quality_manager,
          production_manager: closeModal.production_manager,
          closure_date: closeModal.closure_date,
          final_remarks: closeModal.final_remarks
        }
      });
      if (res && res.success !== false) {
        setCloseModal((p) => ({ ...p, open: false, submitting: false }));
        setFormData((p) => ({
          ...p,
          capa_status: 'Closed',
          closure_date: res.closure_date || closeModal.closure_date,
          approved_by: res.approved_by || user?.username || 'admin',
          quality_manager: closeModal.quality_manager,
          production_manager: closeModal.production_manager,
          final_remarks: closeModal.final_remarks,
          waived_verification: closeModal.waive_verification,
          waiver_reason: closeModal.waive_verification ? closeModal.waiver_reason : ''
        }));
        showNotice('success', res.message || 'CAPA approved and closed cleanly.');
      } else {
        setCloseModal((p) => ({ ...p, submitting: false, error: res?.message || 'Approval failed' }));
      }
    } catch (err) {
      setCloseModal((p) => ({ ...p, submitting: false, error: err.message || 'Approval blocked' }));
    }
  };

  const handleSubmitReopen = async () => {
    if (!editId || !String(reopenModal.reason || '').trim()) {
      showNotice('error', 'Reopen reason is required.');
      return;
    }
    setReopenModal((p) => ({ ...p, submitting: true }));
    try {
      const res = await api(`/capa/${editId}/reopen`, {
        method: 'POST',
        body: { reason: reopenModal.reason }
      });
      if (res && res.success !== false) {
        setReopenModal({ open: false, reason: '', submitting: false });
        setFormData((p) => ({ ...p, capa_status: 'In Progress', closure_date: '' }));
        showNotice('success', res.message || 'CAPA reopened.');
      }
    } catch (err) {
      setReopenModal((p) => ({ ...p, submitting: false }));
      showNotice('error', err.message || 'Failed to reopen CAPA');
    }
  };

  const handlePrintFormalCapa = () => {
    const html = buildFormalCapaPrintHtml(
      { ...formData, items, evidence, batch_traceability: batchTraceability },
      selectedCompany?.name || 'BVC Exports Pvt Ltd'
    );
    printHtml(html, `CAPA Report - ${formData.capa_no || 'Draft'}`);
  };

  const showSec = (k) => activeSection === 'all' || activeSection === k;
  const isClosed = formData.capa_status === 'Closed';

  if (initializing) {
    return (
      <div className="sr-page">
        <div style={{ padding: '40px', textAlign: 'center', fontWeight: 700, color: '#1e3a8a' }}>
          Loading CAPA Document Workspace...
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
            onClick={() => navigate('/entry/capa-display')}
          >
            ← Back
          </button>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span>{editId ? `CAPA Document · ${formData.capa_no}` : 'New Corrective & Preventive Action (CAPA)'}</span>
              <span
                className="sr-badge-pill"
                style={{
                  backgroundColor: isClosed ? '#dcfce7' : formData.capa_status === 'Verification' ? '#e0f2fe' : '#fef3c7',
                  color: isClosed ? '#166534' : formData.capa_status === 'Verification' ? '#0369a1' : '#92400e'
                }}
              >
                Status: {formData.capa_status}
              </span>
              <span
                className="sr-badge-pill"
                style={{
                  backgroundColor: formData.effectiveness_status === 'Effective' ? '#dcfce7' : formData.effectiveness_status === 'Not Effective' ? '#fee2e2' : '#f1f5f9',
                  color: formData.effectiveness_status === 'Effective' ? '#166534' : formData.effectiveness_status === 'Not Effective' ? '#991b1b' : '#334155'
                }}
              >
                Effectiveness: {formData.effectiveness_status}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#dbeafe', marginTop: '2px' }}>
              {selectedCompany?.name || 'BVC Company'} · FY {financialYear} · Quality Management (Sections A–H)
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" className="sr-back-btn" onClick={() => navigate('/entry/capa-display')}>
            CAPA Register
          </button>
          <button
            type="button"
            onClick={handlePrintFormalCapa}
            style={{ backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '5px', padding: '7px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
          >
            Print Formal CAPA
          </button>
          {editId && !isClosed && canApprove && (
            <button
              type="button"
              onClick={handleOpenCloseModal}
              style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '5px', padding: '7px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
            >
              ✓ Approve &amp; Close CAPA
            </button>
          )}
          {editId && isClosed && canApprove && (
            <button
              type="button"
              onClick={() => setReopenModal({ open: true, reason: '', submitting: false })}
              style={{ backgroundColor: '#f97316', color: '#fff', border: 'none', borderRadius: '5px', padding: '7px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
            >
              Reopen CAPA
            </button>
          )}
          {!isClosed && (
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              style={{ backgroundColor: '#f59e0b', color: '#0f172a', border: 'none', borderRadius: '5px', padding: '7px 16px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
            >
              {saving ? 'Saving...' : editId ? 'Update CAPA' : 'Save CAPA'}
            </button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="sr-kpi-grid">
        <div className="sr-kpi-card">
          <div className="sr-kpi-label">CAPA &amp; Source Trace</div>
          <div className="sr-kpi-value">{formData.capa_no || 'CAPA-NEW'}</div>
          <div className="sr-kpi-sub">
            {formData.complaint_no ? `CMP: ${formData.complaint_no}` : 'No Complaint'}{' '}
            {formData.sales_return_no ? `· SR: ${formData.sales_return_no}` : ''}
          </div>
        </div>
        <div className="sr-kpi-card">
          <div className="sr-kpi-label">Affected Products &amp; Lots</div>
          <div className="sr-kpi-value">{items.filter((i) => i.product_name).length} Line(s)</div>
          <div className="sr-kpi-sub">
            {batchTraceability.reduce((s, t) => s + (t.rm_parent_lots || []).length, 0)} RM Parent Lot(s) Traced
          </div>
        </div>
        <div className="sr-kpi-card">
          <div className="sr-kpi-label">RCA &amp; Action Status</div>
          <div className="sr-kpi-value" style={{ fontSize: '15px' }}>
            {formData.rca_method} · CA: {formData.corrective_status} / PA: {formData.preventive_status}
          </div>
          <div className="sr-kpi-sub">
            {formData.corrective_person || 'No Owner Assigned'}
          </div>
        </div>
        <div className="sr-kpi-card">
          <div className="sr-kpi-label">Closure Readiness Gate</div>
          <div className="sr-kpi-value" style={{ fontSize: '15px', color: isClosed ? '#166534' : missingGates.length === 0 ? '#0284c7' : '#b45309' }}>
            {isClosed ? `Closed (${formatDateDMY(formData.closure_date)})` : missingGates.length === 0 ? 'Ready for Approval' : `${missingGates.length} Gate(s) Pending`}
          </div>
          <div className="sr-kpi-sub">
            {formData.waived_verification ? `Waived: ${formData.waiver_reason}` : 'Requires Actions + Effective Verification'}
          </div>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="sr-tabs-bar">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`sr-tab-btn ${activeSection === s.id ? 'active' : ''}`}
            onClick={() => setActiveSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {banner.text && (
        <div className={`sr-notice-banner ${banner.type === 'error' ? 'sr-notice-red' : 'sr-notice-green'}`} style={{ marginTop: '12px' }}>
          {banner.text}
        </div>
      )}

      {isClosed && (
        <div className="sr-notice-banner sr-notice-green" style={{ marginTop: '12px' }}>
          This CAPA is Closed on {formatDateDMY(formData.closure_date)} by {formData.approved_by || 'Manager'}.{' '}
          {formData.waived_verification ? `Verification Waiver Reason: ${formData.waiver_reason}` : 'All corrective/preventive actions and effectiveness checks verified.'}
        </div>
      )}

      {/* SECTION A: CAPA IDENTIFICATION */}
      {showSec('A') && (
        <div className="sr-section-card">
          <div className="sr-section-header">
            <span className="sr-section-title">Section A · CAPA Identification &amp; Linked Reference Selection</span>
            <span style={{ fontSize: '12px', color: '#475569' }}>
              CAPA stays independent of Sales Return &amp; Complaint workflow statuses
            </span>
          </div>
          <div className="sr-section-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px', padding: '12px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px' }}>
              <div className="sr-field">
                <label className="sr-label">Auto-Fill from Customer Complaint</label>
                <select
                  className="sr-select"
                  disabled={isClosed}
                  value={formData.complaint_id}
                  onChange={(e) => {
                    const val = e.target.value;
                    handleFieldChange('complaint_id', val);
                    if (val) handleLoadPrefill({ complaint_id: val });
                  }}
                >
                  <option value="">-- Optional: Select Customer Complaint --</option>
                  {complaints.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.complaint_no} | {c.complaint_date} | {c.customer_name} | {c.complaint_category || c.complaint_type} ({c.severity})
                    </option>
                  ))}
                </select>
              </div>
              <div className="sr-field">
                <label className="sr-label">Auto-Fill from Sales Return</label>
                <select
                  className="sr-select"
                  disabled={isClosed}
                  value={formData.sales_return_id}
                  onChange={(e) => {
                    const val = e.target.value;
                    handleFieldChange('sales_return_id', val);
                    if (val) handleLoadPrefill({ sales_return_id: val });
                  }}
                >
                  <option value="">-- Optional: Select Sales Return --</option>
                  {salesReturns.map((sr) => (
                    <option key={sr.id} value={sr.id}>
                      {sr.return_no} | {sr.date} | {sr.customer} | QC: {sr.qc_status}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="sr-form-grid">
              <div className="sr-field">
                <label className="sr-label">CAPA Number</label>
                <input type="text" className="sr-input" value={formData.capa_no} readOnly />
              </div>
              <div className="sr-field">
                <label className="sr-label">CAPA Date <span className="sr-req">*</span></label>
                <input type="date" className="sr-input" disabled={isClosed} value={formData.capa_date} onChange={(e) => handleFieldChange('capa_date', e.target.value)} />
              </div>
              <div className="sr-field">
                <label className="sr-label">CAPA Source</label>
                <select className="sr-select" disabled={isClosed} value={formData.capa_source} onChange={(e) => handleFieldChange('capa_source', e.target.value)}>
                  <option value="Customer Complaint">Customer Complaint</option>
                  <option value="Sales Return">Sales Return</option>
                  <option value="Internal QC">Internal QC</option>
                </select>
              </div>
              <div className="sr-field">
                <label className="sr-label">CAPA Workflow Status</label>
                <select
                  className="sr-select"
                  disabled={isClosed}
                  value={formData.capa_status}
                  onChange={(e) => handleFieldChange('capa_status', e.target.value)}
                >
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Verification">Verification</option>
                  {isClosed && <option value="Closed">Closed</option>}
                </select>
              </div>
              <div className="sr-field">
                <label className="sr-label">Customer Complaint No.</label>
                <input type="text" className="sr-input" disabled={isClosed} value={formData.complaint_no} onChange={(e) => handleFieldChange('complaint_no', e.target.value)} />
              </div>
              <div className="sr-field">
                <label className="sr-label">Sales Return No.</label>
                <input type="text" className="sr-input" disabled={isClosed} value={formData.sales_return_no} onChange={(e) => handleFieldChange('sales_return_no', e.target.value)} />
              </div>
              <div className="sr-field">
                <label className="sr-label">Original Sales Invoice No.</label>
                <input type="text" className="sr-input" disabled={isClosed} value={formData.original_invoice_no} onChange={(e) => handleFieldChange('original_invoice_no', e.target.value)} />
              </div>
              <div className="sr-field">
                <label className="sr-label">Customer Complaint Ref.</label>
                <input type="text" className="sr-input" disabled={isClosed} value={formData.customer_complaint_ref} onChange={(e) => handleFieldChange('customer_complaint_ref', e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION B: CUSTOMER & PRODUCT DETAILS */}
      {showSec('B') && (
        <div className="sr-section-card">
          <div className="sr-section-header">
            <span className="sr-section-title">Section B · Customer &amp; Multi-Product / FG Lot Details</span>
            {!isClosed && (
              <button
                type="button"
                onClick={() => setItems((prev) => [...prev, { ...EMPTY_ITEM }])}
                style={{ backgroundColor: '#1f4fb2', color: '#fff', border: 'none', borderRadius: '5px', padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
              >
                + Add Product / Lot Row
              </button>
            )}
          </div>
          <div className="sr-section-body">
            <div className="sr-form-grid" style={{ marginBottom: '14px' }}>
              <div className="sr-field span-2">
                <label className="sr-label">Customer Master Lookup</label>
                <select className="sr-select" disabled={isClosed} value={formData.customer_id} onChange={(e) => handleFieldChange('customer_id', e.target.value)}>
                  <option value="">-- Select Customer (or type name directly) --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name || c.print_name}</option>
                  ))}
                </select>
              </div>
              <div className="sr-field span-2">
                <label className="sr-label">Customer Name</label>
                <input type="text" className="sr-input" disabled={isClosed} value={formData.customer_name} onChange={(e) => handleFieldChange('customer_name', e.target.value)} />
              </div>
            </div>

            <div className="sr-table-wrap">
              <table className="sr-items-table" style={{ minWidth: '1320px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>#</th>
                    <th style={{ minWidth: '185px' }}>Product Name</th>
                    <th style={{ minWidth: '100px' }}>Product Code</th>
                    <th style={{ minWidth: '115px' }}>FG Lot No.</th>
                    <th style={{ minWidth: '115px' }}>Mfg Date</th>
                    <th style={{ minWidth: '115px' }}>Expiry Date</th>
                    <th style={{ minWidth: '85px', textAlign: 'right' }}>Invoice Qty</th>
                    <th style={{ minWidth: '90px', textAlign: 'right' }}>Complaint Qty</th>
                    <th style={{ minWidth: '90px', textAlign: 'right' }}>Returned Qty</th>
                    <th style={{ minWidth: '115px' }}>Mfg Batch</th>
                    <th style={{ minWidth: '140px' }}>RM Parent Lot(s)</th>
                    <th style={{ width: '45px', textAlign: 'center' }}>Del</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{idx + 1}</td>
                      <td>
                        <select className="sr-tbl-select" disabled={isClosed} value={row.product_name} onChange={(e) => handleItemChange(idx, 'product_name', e.target.value)}>
                          <option value="">-- Select Product --</option>
                          {itemMaster.map((im) => <option key={im.id} value={im.item_name}>{im.item_name}</option>)}
                          {row.product_name && !itemMaster.some((im) => im.item_name === row.product_name) && (
                            <option value={row.product_name}>{row.product_name}</option>
                          )}
                        </select>
                      </td>
                      <td><input type="text" className="sr-tbl-input" disabled={isClosed} value={row.product_code || ''} onChange={(e) => handleItemChange(idx, 'product_code', e.target.value)} /></td>
                      <td><input type="text" className="sr-tbl-input" disabled={isClosed} value={row.lot_no || ''} onChange={(e) => handleItemChange(idx, 'lot_no', e.target.value)} placeholder="FG Lot..." /></td>
                      <td><input type="date" className="sr-tbl-input" disabled={isClosed} value={row.mfg_date || ''} onChange={(e) => handleItemChange(idx, 'mfg_date', e.target.value)} /></td>
                      <td><input type="date" className="sr-tbl-input" disabled={isClosed} value={row.exp_date || ''} onChange={(e) => handleItemChange(idx, 'exp_date', e.target.value)} /></td>
                      <td><input type="number" className="sr-tbl-input sr-num" disabled={isClosed} value={row.invoice_qty} onChange={(e) => handleItemChange(idx, 'invoice_qty', e.target.value)} /></td>
                      <td><input type="number" className="sr-tbl-input sr-num" disabled={isClosed} value={row.complaint_qty} onChange={(e) => handleItemChange(idx, 'complaint_qty', e.target.value)} /></td>
                      <td><input type="number" className="sr-tbl-input sr-num" disabled={isClosed} value={row.returned_qty} onChange={(e) => handleItemChange(idx, 'returned_qty', e.target.value)} /></td>
                      <td><input type="text" className="sr-tbl-input" disabled={isClosed} value={row.batch_no || ''} onChange={(e) => handleItemChange(idx, 'batch_no', e.target.value)} /></td>
                      <td><input type="text" className="sr-tbl-input" disabled={isClosed} value={row.rm_lot_nos || ''} onChange={(e) => handleItemChange(idx, 'rm_lot_nos', e.target.value)} /></td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          disabled={isClosed || items.length <= 1}
                          onClick={() => setItems((p) => (p.length > 1 ? p.filter((_, i) => i !== idx) : p))}
                          style={{ backgroundColor: isClosed || items.length <= 1 ? '#e2e8f0' : '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', width: '26px', height: '26px', cursor: 'pointer' }}
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
      )}

      {/* SECTION C: COMPLAINT DESCRIPTION */}
      {showSec('C') && (
        <div className="sr-section-card">
          <div className="sr-section-header">
            <span className="sr-section-title">Section C · Complaint Description, Photographic Evidence &amp; Customer Communication</span>
          </div>
          <div className="sr-section-body">
            <div className="sr-form-grid">
              <div className="sr-field">
                <label className="sr-label">Complaint Category</label>
                <select className="sr-select" disabled={isClosed} value={formData.complaint_category} onChange={(e) => handleFieldChange('complaint_category', e.target.value)}>
                  <option value="Quality">Quality</option>
                  <option value="Packaging">Packaging</option>
                  <option value="Weight">Weight</option>
                  <option value="Delivery">Delivery</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="sr-field">
                <label className="sr-label">Complaint Date</label>
                <input type="date" className="sr-input" disabled={isClosed} value={formData.complaint_date} onChange={(e) => handleFieldChange('complaint_date', e.target.value)} />
              </div>
              <div className="sr-field span-2">
                <label className="sr-label">Condition of Affected Goods</label>
                <input type="text" className="sr-input" disabled={isClosed} value={formData.affected_condition} onChange={(e) => handleFieldChange('affected_condition', e.target.value)} placeholder="Damaged packaging, moisture clumps, broken..." />
              </div>
              <div className="sr-field span-2">
                <label className="sr-label">Reported Problem</label>
                <textarea className="sr-textarea" disabled={isClosed} value={formData.reported_problem} onChange={(e) => handleFieldChange('reported_problem', e.target.value)} placeholder="Detailed problem statement reported by customer or QC..." />
              </div>
              <div className="sr-field span-2">
                <label className="sr-label">Customer Communication Summary</label>
                <textarea className="sr-textarea" disabled={isClosed} value={formData.customer_communication} onChange={(e) => handleFieldChange('customer_communication', e.target.value)} placeholder="Calls, emails, acknowledgement or replacement promise..." />
              </div>
            </div>

            {/* Evidence Attachments */}
            <div style={{ marginTop: '14px', padding: '12px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <strong style={{ fontSize: '12px', color: '#1e3a8a' }}>Photographic / Lab / Video Evidence ({evidence.length})</strong>
                {!isClosed && (
                  <label style={{ backgroundColor: '#1f4fb2', color: '#fff', padding: '5px 11px', borderRadius: '5px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                    + Upload Photo / PDF / Video
                    <input type="file" accept="image/*,application/pdf,video/mp4,video/webm" onChange={handleFileUpload} style={{ display: 'none' }} />
                  </label>
                )}
              </div>
              {!isClosed && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr 1fr auto', gap: '8px', marginBottom: '10px' }}>
                  <input type="text" className="sr-input" placeholder="Document Label" value={linkDraft.name} onChange={(e) => setLinkDraft((p) => ({ ...p, name: e.target.value }))} />
                  <input type="text" className="sr-input" placeholder="https://... or /uploads/..." value={linkDraft.url} onChange={(e) => setLinkDraft((p) => ({ ...p, url: e.target.value }))} />
                  <input type="text" className="sr-input" placeholder="Notes" value={linkDraft.notes} onChange={(e) => setLinkDraft((p) => ({ ...p, notes: e.target.value }))} />
                  <button type="button" onClick={handleAddExternalLink} style={{ backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '5px', padding: '0 12px', fontWeight: 700, cursor: 'pointer' }}>+ Add Link</button>
                </div>
              )}
              {evidence.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                  {evidence.map((ev, idx) => {
                    const mimeVal = String(ev.mime_type || ev.mime || '').toLowerCase();
                    const isImg = mimeVal.startsWith('image/') || ev.kind === 'image' || String(ev.url || '').startsWith('data:image/');
                    const isVid = !isImg && (mimeVal.startsWith('video/') || ev.kind === 'video' || String(ev.url || '').startsWith('data:video/'));
                    return (
                      <div key={idx} style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px', fontSize: '12px' }}>
                        {isImg && ev.url && (
                          <img src={ev.url} alt={ev.name} style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '4px', marginBottom: '6px' }} />
                        )}
                        {isVid && ev.url && (
                          <video src={ev.url} controls style={{ width: '100%', height: '100px', borderRadius: '4px', marginBottom: '6px', backgroundColor: '#0f172a' }} />
                        )}
                        <div style={{ fontWeight: 700, wordBreak: 'break-word' }}>{ev.name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{ev.notes || ev.mime_type || ev.mime || ev.kind || 'Attachment'}</div>
                        {!isClosed && (
                          <button type="button" onClick={() => setEvidence((p) => p.filter((_, i) => i !== idx))} style={{ marginTop: '4px', backgroundColor: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                            Remove
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION D: INVESTIGATION & ROOT CAUSE ANALYSIS */}
      {showSec('D') && (
        <div className="sr-section-card">
          <div className="sr-section-header">
            <span className="sr-section-title">Section D · Investigation, Batch &amp; RM Traceability &amp; Root Cause Analysis</span>
          </div>
          <div className="sr-section-body">
            {batchTraceability.length > 0 && (
              <div style={{ marginBottom: '14px', padding: '12px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px' }}>
                <div style={{ fontWeight: 800, fontSize: '12px', color: '#0369a1', marginBottom: '8px' }}>
                  Auto-Linked Manufacturing Batch &amp; Raw Material Parent Lot Traceability
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px', fontSize: '12px' }}>
                  {batchTraceability.map((tr, idx) => (
                    <div key={idx} style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px' }}>
                      <div style={{ fontWeight: 800, color: '#1e3a8a' }}>
                        FG Lot: <span style={{ fontFamily: 'monospace' }}>{tr.lot_no || '—'}</span> · {tr.item_name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#475569', marginTop: '3px' }}>
                        Mfg: {formatDateDMY(tr.mfg_date)} · Exp: {formatDateDMY(tr.exp_date)}
                      </div>
                      <div style={{ marginTop: '5px' }}>
                        <strong>Batches:</strong>{' '}
                        {(tr.manufacturing_batches || []).map((b) => b.batch_no).join(', ') ||
                          (tr.packing_batches || []).map((p) => p.packing_no).join(', ') ||
                          '—'}
                      </div>
                      <div>
                        <strong>RM Parent Lots:</strong>{' '}
                        {(tr.rm_parent_lots || []).map((r) => (r.supplier ? `${r.lot_no} (${r.supplier})` : r.lot_no)).join(', ') || '—'}
                      </div>
                      <div>
                        <strong>QC Records:</strong>{' '}
                        {(tr.qc_inspections || []).map((q) => `${q.qc_no}: ${q.overall_result}`).join('; ') || '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="sr-form-grid">
              <div className="sr-field span-2">
                <label className="sr-label">Investigation Findings</label>
                <textarea className="sr-textarea" disabled={isClosed} value={formData.investigation_findings} onChange={(e) => handleFieldChange('investigation_findings', e.target.value)} placeholder="Line audit, storage humidity check, packing seal test findings..." />
              </div>
              <div className="sr-field span-2">
                <label className="sr-label">QC Inspection Results Summary</label>
                <textarea className="sr-textarea" disabled={isClosed} value={formData.qc_inspection_results} onChange={(e) => handleFieldChange('qc_inspection_results', e.target.value)} placeholder="Moisture %, sensory, microbial, returned goods lab analysis..." />
              </div>
              <div className="sr-field">
                <label className="sr-label">Root Cause Analysis Method</label>
                <select className="sr-select" disabled={isClosed} value={formData.rca_method} onChange={(e) => handleFieldChange('rca_method', e.target.value)}>
                  <option value="5 Why">5 Why</option>
                  <option value="Fishbone">Fishbone (Ishikawa)</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="sr-field span-2" style={{ gridColumn: 'span 3' }}>
                <label className="sr-label">Identified Root Cause <span className="sr-req">* (Required for Closure)</span></label>
                <input type="text" className="sr-input" disabled={isClosed} value={formData.identified_root_cause} onChange={(e) => handleFieldChange('identified_root_cause', e.target.value)} placeholder="Clear statement of systemic root cause..." />
              </div>
              <div className="sr-field span-4">
                <label className="sr-label">Detailed RCA Breakdown ({formData.rca_method})</label>
                <textarea className="sr-textarea" disabled={isClosed} value={formData.rca_details} onChange={(e) => handleFieldChange('rca_details', e.target.value)} placeholder="Why 1 -> Why 2 -> Why 3 -> Why 4 -> Why 5 (or Man / Machine / Material / Method / Environment)..." />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION E: CORRECTIVE ACTION */}
      {showSec('E') && (
        <div className="sr-section-card">
          <div className="sr-section-header">
            <span className="sr-section-title">Section E · Immediate Containment &amp; Corrective Action</span>
          </div>
          <div className="sr-section-body">
            <div className="sr-form-grid">
              <div className="sr-field span-2">
                <label className="sr-label">Immediate Containment Action</label>
                <textarea className="sr-textarea" disabled={isClosed} value={formData.immediate_containment} onChange={(e) => handleFieldChange('immediate_containment', e.target.value)} placeholder="Quarantine remaining FG lot stock, notify customers..." />
              </div>
              <div className="sr-field span-2">
                <label className="sr-label">Correction of Existing Problem</label>
                <textarea className="sr-textarea" disabled={isClosed} value={formData.existing_problem_correction} onChange={(e) => handleFieldChange('existing_problem_correction', e.target.value)} placeholder="Rework, sort, replace affected consignment..." />
              </div>
              <div className="sr-field span-4">
                <label className="sr-label">Corrective Action Description <span className="sr-req">* (Required for Closure)</span></label>
                <textarea className="sr-textarea" disabled={isClosed} value={formData.corrective_action_desc} onChange={(e) => handleFieldChange('corrective_action_desc', e.target.value)} placeholder="Action taken to eliminate the root cause..." />
              </div>
              <div className="sr-field">
                <label className="sr-label">Responsible Department</label>
                <input type="text" className="sr-input" disabled={isClosed} value={formData.corrective_dept} onChange={(e) => handleFieldChange('corrective_dept', e.target.value)} />
              </div>
              <div className="sr-field">
                <label className="sr-label">Responsible Person</label>
                <input type="text" className="sr-input" disabled={isClosed} value={formData.corrective_person} onChange={(e) => handleFieldChange('corrective_person', e.target.value)} placeholder="Action Owner name" />
              </div>
              <div className="sr-field">
                <label className="sr-label">Target Completion Date</label>
                <input type="date" className="sr-input" disabled={isClosed} value={formData.corrective_target_date} onChange={(e) => handleFieldChange('corrective_target_date', e.target.value)} />
              </div>
              <div className="sr-field">
                <label className="sr-label">Actual Completion Date</label>
                <input type="date" className="sr-input" disabled={isClosed} value={formData.corrective_completion_date} onChange={(e) => handleFieldChange('corrective_completion_date', e.target.value)} />
              </div>
              <div className="sr-field">
                <label className="sr-label">Corrective Action Status</label>
                <select className="sr-select" disabled={isClosed} value={formData.corrective_status} onChange={(e) => handleFieldChange('corrective_status', e.target.value)}>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div className="sr-field span-2" style={{ gridColumn: 'span 3' }}>
                <label className="sr-label">Implementation Evidence Reference</label>
                <input type="text" className="sr-input" disabled={isClosed} value={formData.corrective_evidence} onChange={(e) => handleFieldChange('corrective_evidence', e.target.value)} placeholder="Calibration certificate, SOP revision, photo reference..." />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION F: PREVENTIVE ACTION */}
      {showSec('F') && (
        <div className="sr-section-card">
          <div className="sr-section-header">
            <span className="sr-section-title">Section F · Preventive Action, Process Improvement &amp; Training</span>
          </div>
          <div className="sr-section-body">
            <div className="sr-form-grid">
              <div className="sr-field span-2">
                <label className="sr-label">Preventive Action (Prevent Recurrence) <span className="sr-req">* (Required for Closure)</span></label>
                <textarea className="sr-textarea" disabled={isClosed} value={formData.preventive_action_desc} onChange={(e) => handleFieldChange('preventive_action_desc', e.target.value)} placeholder="Systemic controls across lines/shifts to prevent recurrence..." />
              </div>
              <div className="sr-field span-2">
                <label className="sr-label">Process / SOP Improvement</label>
                <textarea className="sr-textarea" disabled={isClosed} value={formData.process_improvement} onChange={(e) => handleFieldChange('process_improvement', e.target.value)} />
              </div>
              <div className="sr-field">
                <label className="sr-label">Training Required?</label>
                <select className="sr-select" disabled={isClosed} value={formData.training_required ? '1' : '0'} onChange={(e) => handleFieldChange('training_required', e.target.value === '1')}>
                  <option value="0">No</option>
                  <option value="1">Yes</option>
                </select>
              </div>
              <div className="sr-field span-2" style={{ gridColumn: 'span 3' }}>
                <label className="sr-label">Training Details / Attendance Ref</label>
                <input type="text" className="sr-input" disabled={isClosed} value={formData.training_details} onChange={(e) => handleFieldChange('training_details', e.target.value)} />
              </div>
              <div className="sr-field span-2">
                <label className="sr-label">Inspection / Testing Improvements</label>
                <input type="text" className="sr-input" disabled={isClosed} value={formData.inspection_testing_improvement} onChange={(e) => handleFieldChange('inspection_testing_improvement', e.target.value)} />
              </div>
              <div className="sr-field">
                <label className="sr-label">Preventive Action Owner</label>
                <input type="text" className="sr-input" disabled={isClosed} value={formData.preventive_person} onChange={(e) => handleFieldChange('preventive_person', e.target.value)} />
              </div>
              <div className="sr-field">
                <label className="sr-label">Target Date</label>
                <input type="date" className="sr-input" disabled={isClosed} value={formData.preventive_target_date} onChange={(e) => handleFieldChange('preventive_target_date', e.target.value)} />
              </div>
              <div className="sr-field">
                <label className="sr-label">Completion Date</label>
                <input type="date" className="sr-input" disabled={isClosed} value={formData.preventive_completion_date} onChange={(e) => handleFieldChange('preventive_completion_date', e.target.value)} />
              </div>
              <div className="sr-field">
                <label className="sr-label">Preventive Action Status</label>
                <select className="sr-select" disabled={isClosed} value={formData.preventive_status} onChange={(e) => handleFieldChange('preventive_status', e.target.value)}>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION G: EFFECTIVENESS VERIFICATION */}
      {showSec('G') && (
        <div className="sr-section-card">
          <div className="sr-section-header">
            <span className="sr-section-title">Section G · Effectiveness Verification</span>
          </div>
          <div className="sr-section-body">
            <div className="sr-form-grid">
              <div className="sr-field span-2">
                <label className="sr-label">Verification Method</label>
                <input type="text" className="sr-input" disabled={isClosed} value={formData.verification_method} onChange={(e) => handleFieldChange('verification_method', e.target.value)} placeholder="3 consecutive batch audit, lab re-test, customer feedback check..." />
              </div>
              <div className="sr-field">
                <label className="sr-label">Verification Date</label>
                <input type="date" className="sr-input" disabled={isClosed} value={formData.verification_date} onChange={(e) => handleFieldChange('verification_date', e.target.value)} />
              </div>
              <div className="sr-field">
                <label className="sr-label">Effectiveness Status <span className="sr-req">*</span></label>
                <select className="sr-select" disabled={isClosed} value={formData.effectiveness_status} onChange={(e) => handleFieldChange('effectiveness_status', e.target.value)}>
                  <option value="Pending">Pending</option>
                  <option value="Effective">Effective</option>
                  <option value="Not Effective">Not Effective</option>
                </select>
              </div>
              <div className="sr-field span-2">
                <label className="sr-label">Follow-Up Inspection Results</label>
                <textarea className="sr-textarea" disabled={isClosed} value={formData.followup_inspection_results} onChange={(e) => handleFieldChange('followup_inspection_results', e.target.value)} />
              </div>
              <div className="sr-field span-2">
                <label className="sr-label">Effectiveness Verification Evidence</label>
                <textarea className="sr-textarea" disabled={isClosed} value={formData.effectiveness_evidence} onChange={(e) => handleFieldChange('effectiveness_evidence', e.target.value)} />
              </div>
              <div className="sr-field">
                <label className="sr-label">Further Action Required?</label>
                <select className="sr-select" disabled={isClosed} value={formData.further_action_required ? '1' : '0'} onChange={(e) => handleFieldChange('further_action_required', e.target.value === '1')}>
                  <option value="0">No</option>
                  <option value="1">Yes</option>
                </select>
              </div>
              <div className="sr-field span-2" style={{ gridColumn: 'span 3' }}>
                <label className="sr-label">Further Action Notes</label>
                <input type="text" className="sr-input" disabled={isClosed} value={formData.further_action_notes} onChange={(e) => handleFieldChange('further_action_notes', e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION H: APPROVAL & CLOSURE */}
      {showSec('H') && (
        <div className="sr-section-card">
          <div className="sr-section-header">
            <span className="sr-section-title">Section H · Approval, Closure &amp; Audit History</span>
          </div>
          <div className="sr-section-body">
            <div className="sr-form-grid">
              <div className="sr-field">
                <label className="sr-label">Prepared By</label>
                <input type="text" className="sr-input" disabled={isClosed} value={formData.prepared_by} onChange={(e) => handleFieldChange('prepared_by', e.target.value)} />
              </div>
              <div className="sr-field">
                <label className="sr-label">Quality Manager</label>
                <input type="text" className="sr-input" disabled={isClosed} value={formData.quality_manager} onChange={(e) => handleFieldChange('quality_manager', e.target.value)} />
              </div>
              <div className="sr-field">
                <label className="sr-label">Production Manager</label>
                <input type="text" className="sr-input" disabled={isClosed} value={formData.production_manager} onChange={(e) => handleFieldChange('production_manager', e.target.value)} />
              </div>
              <div className="sr-field">
                <label className="sr-label">Approved By / Closure Date</label>
                <input type="text" className="sr-input" readOnly value={formData.approved_by ? `${formData.approved_by} (${formatDateDMY(formData.closure_date)})` : 'Pending Approval'} />
              </div>
              <div className="sr-field span-4">
                <label className="sr-label">Final Remarks</label>
                <textarea className="sr-textarea" disabled={isClosed} value={formData.final_remarks} onChange={(e) => handleFieldChange('final_remarks', e.target.value)} />
              </div>
            </div>

            {linkedRecords.audit_logs.length > 0 && (
              <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                <div style={{ fontWeight: 800, fontSize: '12px', color: '#1e3a8a', marginBottom: '6px' }}>CAPA Audit Trail</div>
                {linkedRecords.audit_logs.map((lg) => (
                  <div key={lg.id} style={{ fontSize: '11px', padding: '3px 0', borderBottom: '1px dashed #cbd5e1' }}>
                    <strong>{lg.action}</strong> ({lg.old_status || '—'} → {lg.new_status}) by {lg.performed_by} · {lg.remarks}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer Bar */}
      <div className="sr-footer-bar">
        <div style={{ fontSize: '12px', color: '#475569' }}>
          <strong>CAPA Status:</strong> {formData.capa_status} · <strong>Effectiveness:</strong> {formData.effectiveness_status}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => navigate('/entry/capa-display')} style={{ backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '5px', padding: '8px 14px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
            Back to Register
          </button>
          <button type="button" onClick={handlePrintFormalCapa} style={{ backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '5px', padding: '8px 14px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
            Print Formal CAPA
          </button>
          {!isClosed && (
            <button type="button" disabled={saving} onClick={handleSave} style={{ backgroundColor: '#1f4fb2', color: '#fff', border: 'none', borderRadius: '5px', padding: '8px 18px', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}>
              {saving ? 'Saving...' : editId ? 'Save Changes' : 'Save CAPA'}
            </button>
          )}
        </div>
      </div>

      {/* APPROVE & CLOSE MODAL */}
      {closeModal.open && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: '14px' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 35px rgba(0,0,0,0.28)' }}>
            <div style={{ padding: '12px 18px', backgroundColor: '#1f4fb2', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '15px' }}>Approve &amp; Close CAPA · {formData.capa_no}</span>
              <button type="button" onClick={() => setCloseModal((p) => ({ ...p, open: false }))} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '16px', fontSize: '12px' }}>
              {missingGates.length > 0 && (
                <div style={{ padding: '10px 12px', backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '6px', marginBottom: '12px', color: '#92400e' }}>
                  <strong>Verification Gate Check — Incomplete Items:</strong>
                  <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
                    {missingGates.map((g, i) => <li key={i}>{g}</li>)}
                  </ul>
                </div>
              )}

              {closeModal.error && (
                <div style={{ padding: '8px 12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', marginBottom: '12px', color: '#991b1b', fontWeight: 700 }}>
                  {closeModal.error}
                </div>
              )}

              <div className="sr-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="sr-field">
                  <label className="sr-label">Quality Manager</label>
                  <input type="text" className="sr-input" value={closeModal.quality_manager} onChange={(e) => setCloseModal((p) => ({ ...p, quality_manager: e.target.value }))} />
                </div>
                <div className="sr-field">
                  <label className="sr-label">Production Manager</label>
                  <input type="text" className="sr-input" value={closeModal.production_manager} onChange={(e) => setCloseModal((p) => ({ ...p, production_manager: e.target.value }))} />
                </div>
                <div className="sr-field">
                  <label className="sr-label">Closure Date</label>
                  <input type="date" className="sr-input" value={closeModal.closure_date} onChange={(e) => setCloseModal((p) => ({ ...p, closure_date: e.target.value }))} />
                </div>
                <div className="sr-field" style={{ gridColumn: '1 / -1' }}>
                  <label className="sr-label">Final Closure Remarks</label>
                  <textarea className="sr-textarea" value={closeModal.final_remarks} onChange={(e) => setCloseModal((p) => ({ ...p, final_remarks: e.target.value }))} />
                </div>
                {missingGates.length > 0 && (
                  <div style={{ gridColumn: '1 / -1', padding: '10px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, cursor: 'pointer', color: '#991b1b' }}>
                      <input type="checkbox" checked={closeModal.waive_verification} onChange={(e) => setCloseModal((p) => ({ ...p, waive_verification: e.target.checked }))} />
                      Authorize Formal Verification Waiver (Admin / Quality Manager Only)
                    </label>
                    {closeModal.waive_verification && (
                      <div style={{ marginTop: '8px' }}>
                        <label className="sr-label">Mandatory Waiver Justification <span className="sr-req">*</span></label>
                        <input
                          type="text"
                          className="sr-input"
                          value={closeModal.waiver_reason}
                          onChange={(e) => setCloseModal((p) => ({ ...p, waiver_reason: e.target.value }))}
                          placeholder="Reason for waiving standard effectiveness verification..."
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div style={{ padding: '12px 18px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setCloseModal((p) => ({ ...p, open: false }))} style={{ padding: '7px 14px', borderRadius: '5px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button type="button" disabled={closeModal.submitting} onClick={handleSubmitApproveClose} style={{ padding: '7px 16px', borderRadius: '5px', border: 'none', backgroundColor: '#10b981', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
                {closeModal.submitting ? 'Closing...' : 'Approve & Close CAPA'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REOPEN MODAL */}
      {reopenModal.open && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '92%', maxWidth: '440px', overflow: 'hidden', boxShadow: '0 20px 30px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '12px 16px', backgroundColor: '#f97316', color: '#fff', fontWeight: 800, fontSize: '14px' }}>
              Reopen Closed CAPA · {formData.capa_no}
            </div>
            <div style={{ padding: '16px', fontSize: '12px' }}>
              <label className="sr-label">Mandatory Reopen Reason <span className="sr-req">*</span></label>
              <input type="text" className="sr-input" value={reopenModal.reason} onChange={(e) => setReopenModal((p) => ({ ...p, reason: e.target.value }))} placeholder="Enter audit or recurrence reason..." />
            </div>
            <div style={{ padding: '10px 16px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setReopenModal({ open: false, reason: '', submitting: false })} style={{ padding: '6px 12px', borderRadius: '5px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button type="button" disabled={reopenModal.submitting} onClick={handleSubmitReopen} style={{ padding: '6px 14px', borderRadius: '5px', border: 'none', backgroundColor: '#f97316', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                {reopenModal.submitting ? 'Reopening...' : 'Confirm Reopen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CapaCreate;
