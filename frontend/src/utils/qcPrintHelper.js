/**
 * qcPrintHelper.js - Professional Certificate of Analysis (COA) & Incoming Quality Report (IQR) Print Generator
 */

const escHtml = (val) =>
  String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatDate = (val) => {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
  } catch {}
  return String(val);
};

export function generateQcPrintHtml(qcData = {}, company = {}, reportType = 'COA') {
  const companyName = company?.name || company?.print_name || 'BVC EXPORTS PRIVATE LIMITED';
  const companyAddress = company?.address || company?.address1 || 'Factory & Processing Plant, Industrial Estate, Tamil Nadu';
  const companyGst = company?.gst_number || company?.gst_no || '33AAAAA0000A1Z5';
  const companyPhone = company?.phone_off || company?.mobile1 || company?.phone || '+91 98765 43210';

  const title = reportType === 'IQR' ? 'INCOMING QUALITY REPORT (IQR)' : 'CERTIFICATE OF ANALYSIS (COA)';
  const qcNo = qcData.qc_no || qcData.qcNo || 'QC-00001';
  const qcDate = formatDate(qcData.qc_date || qcData.date || new Date());
  const moduleType = qcData.module_type || qcData.moduleType || 'Purchase';
  const referenceId = qcData.reference_id || qcData.referenceId || '—';
  const status = qcData.status || qcData.overall_result || 'PENDING';
  const remarks = qcData.remarks || 'Standard physical & chemical lab testing.';

  const params = Array.isArray(qcData.qcResults) && qcData.qcResults.length > 0
    ? qcData.qcResults.map(p => ({
        name: p.parameter || p.parameterName || p.parameterKey,
        status: p.status || 'PASS',
        detail: `${p.actualResult !== undefined ? p.actualResult : (p.actual || '-')} ${p.unit || ''} (Spec: ${p.specification || (p.min !== undefined && p.max !== undefined ? `${p.min}-${p.max}` : '-')})`
      }))
    : Array.isArray(qcData.params) && qcData.params.length > 0
    ? qcData.params
    : Array.isArray(qcData.checklist) && qcData.checklist.length > 0
    ? qcData.checklist
    : [
        { name: 'Moisture Content %', status: 'PASS', detail: '10.5% (Max 12%)' },
        { name: 'Foreign Matter %', status: 'PASS', detail: '0.2% (Max 1%)' },
        { name: 'Damaged / Broken Grains %', status: 'PASS', detail: '1.1% (Max 2%)' },
        { name: 'Odor & Appearance', status: 'PASS', detail: 'Normal & Clean' }
      ];

  const paramRows = params.map((p, idx) => `
    <tr style="border-bottom: 1px solid #cbd5e1; font-size: 12px;">
      <td style="padding: 6px 8px; text-align: center; border: 1px solid #cbd5e1; font-weight: 600;">${idx + 1}</td>
      <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 700; color: #0f172a;">${escHtml(p.name || p.param_key || 'Parameter')}</td>
      <td style="padding: 6px 8px; text-align: center; border: 1px solid #cbd5e1; font-weight: 800; color: ${String(p.status || '').toUpperCase() === 'FAIL' ? '#dc2626' : '#16a34a'};">${escHtml(p.status || 'PASS')}</td>
      <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 11px;">${escHtml(p.detail || p.param_value || 'Verified')}</td>
    </tr>
  `).join('');

  const evidenceList = Array.isArray(qcData.evidence) ? qcData.evidence : [];
  const evidenceHtml = evidenceList.length > 0
    ? `<div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(220px, 1fr));gap:10px;">` +
      evidenceList.map((ev, idx) => {
        const isImg = String(ev.mime_type || ev.type || '').startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(ev.url || ev.name || '');
        const isVid = String(ev.mime_type || ev.type || '').startsWith('video/') || /\.(mp4|webm|mov|ogg)$/i.test(ev.url || ev.name || '');
        return `
          <div style="border:1px solid #cbd5e1;padding:8px;border-radius:4px;background:#ffffff;box-sizing:border-box;">
            <div style="font-weight:700;font-size:11px;color:#1e3a8a;margin-bottom:4px;">
              #${idx + 1} · ${escHtml(ev.name || 'Physical Test Reference')}
              <span style="font-size:10px;color:#64748b;font-weight:normal;"> (${escHtml(ev.type || ev.mime_type || (isImg ? 'Photo' : isVid ? 'Video' : 'Document'))})</span>
            </div>
            ${ev.notes ? '<div style="font-size:11px;color:#334155;margin-bottom:6px;"><strong>Note:</strong> ' + escHtml(ev.notes) + '</div>' : ''}
            ${isImg ? '<div style="text-align:center;"><img src="' + escHtml(ev.url) + '" alt="' + escHtml(ev.name || 'Evidence') + '" style="max-width:100%;max-height:160px;object-fit:contain;border:1px solid #e2e8f0;border-radius:3px;" /></div>' : ''}
            ${isVid ? '<div style="text-align:center;"><video src="' + escHtml(ev.url) + '" controls style="max-width:100%;max-height:160px;border:1px solid #e2e8f0;border-radius:3px;"></video></div>' : ''}
            ${!isImg && !isVid ? '<div style="padding:8px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:3px;font-size:11px;text-align:center;"><span style="font-size:18px;">📄</span><br/><a href="' + escHtml(ev.url) + '" target="_blank" style="color:#2563eb;word-break:break-all;font-weight:bold;">View Document</a></div>' : ''}
          </div>
        `;
      }).join('') + `</div>`
    : '<div style="font-size:11px;color:#64748b;font-style:italic;">No physical test photos, videos or documents attached.</div>';

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; max-width: 900px; margin: 0 auto; padding: 16px; background: #ffffff; line-height: 1.4;">
      <div style="border-bottom: 2.5px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #1e3a8a; text-transform: uppercase;">${escHtml(companyName)}</h1>
          <div style="font-size: 11px; color: #475569; margin-top: 3px;">${escHtml(companyAddress)} | GSTIN: ${escHtml(companyGst)}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 14px; font-weight: 800; color: #1e40af; background: #eff6ff; padding: 4px 10px; border: 1px solid #bfdbfe; border-radius: 4px; display: inline-block;">${title}</div>
          <div style="font-size: 11px; color: #475569; margin-top: 4px;"><strong>QC No:</strong> ${escHtml(qcNo)}</div>
          <div style="font-size: 11px; color: #475569;"><strong>Date:</strong> ${escHtml(qcDate)}</div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 12px;">
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 6px 10px; width: 25%; background: #f8fafc;"><strong>Module Source:</strong></td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 10px; width: 25%;">${escHtml(moduleType)}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 10px; width: 25%; background: #f8fafc;"><strong>Reference ID / Inv:</strong></td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 10px; width: 25%; font-family: monospace;">${escHtml(referenceId)}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 6px 10px; background: #f8fafc;"><strong>Inspection Status:</strong></td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 800; color: ${status === 'APPROVE' || status === 'PASS' ? '#16a34a' : status === 'HOLD' ? '#d97706' : status === 'RETURN' ? '#dc2626' : '#2563eb'};">${escHtml(status)}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 10px; background: #f8fafc;"><strong>Tested By:</strong></td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">QC Laboratory Dept</td>
        </tr>
      </table>

      <div style="font-weight: 700; background: #1e3a8a; color: #fff; padding: 6px 10px; font-size: 12px; margin-bottom: 0;">PHYSICAL &amp; CHEMICAL TEST PARAMETERS</div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 12px;">
        <thead>
          <tr style="background: #e2e8f0;">
            <th style="border: 1px solid #cbd5e1; padding: 6px; width: 40px; text-align: center;">#</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">Test Parameter</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px; width: 100px; text-align: center;">Status</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">Result / Specification Details</th>
          </tr>
        </thead>
        <tbody>${paramRows}</tbody>
      </table>

      <div style="font-weight: 700; background: #1e3a8a; color: #fff; padding: 6px 10px; font-size: 12px; margin-bottom: 0;">INSPECTION REMARKS &amp; NOTES</div>
      <div style="border: 1px solid #cbd5e1; border-top: none; padding: 8px 10px; margin-bottom: 14px; font-size: 12px; background: #f8fafc;">
        ${escHtml(remarks)}
      </div>

      <div style="font-weight: 700; background: #1e3a8a; color: #fff; padding: 6px 10px; font-size: 12px; margin-bottom: 0;">ATTACHED PHYSICAL TEST PHOTOS, VIDEOS &amp; DOCUMENT REFERENCES</div>
      <div style="border: 1px solid #cbd5e1; border-top: none; padding: 8px 10px; margin-bottom: 20px; background: #f8fafc;">
        ${evidenceHtml}
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center; font-size: 11px; margin-top: 30px;">
        <div style="border-top: 1.5px dashed #94a3b8; padding-top: 8px;">
          <div style="font-weight: 700; color: #0f172a;">QC LAB ANALYST</div>
          <div style="color: #64748b; font-size: 10px; margin-top: 2px;">Tested &amp; Verified</div>
        </div>
        <div style="border-top: 1.5px dashed #94a3b8; padding-top: 8px;">
          <div style="font-weight: 700; color: #0f172a;">QUALITY MANAGER</div>
          <div style="color: #64748b; font-size: 10px; margin-top: 2px;">Approved / Verified</div>
        </div>
        <div style="border-top: 1.5px dashed #94a3b8; padding-top: 8px;">
          <div style="font-weight: 700; color: #0f172a;">AUTHORIZED SIGNATORY</div>
          <div style="color: #64748b; font-size: 10px; margin-top: 2px;">BVC Exports ERP</div>
        </div>
      </div>
    </div>
  `;
}
