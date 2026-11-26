import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import voucherAPI from './voucherService.js';
import { printHtml } from '../../utils/printHelper.js';

function numberToIndianWords(num) {
  const n = Math.round(Math.abs(Number(num) || 0));
  if (n === 0) return 'Rupees Zero Only';

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const twoDigits = (x) => {
    if (x < 20) return ones[x];
    return tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : '');
  };

  const threeDigits = (x) => {
    const h = Math.floor(x / 100);
    const rem = x % 100;
    return (h ? ones[h] + ' Hundred' + (rem ? ' ' : '') : '') + (rem ? twoDigits(rem) : '');
  };

  let val = n;
  const crore = Math.floor(val / 10000000);
  val %= 10000000;
  const lakh = Math.floor(val / 100000);
  val %= 100000;
  const thousand = Math.floor(val / 1000);
  val %= 1000;

  const parts = [];
  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (val) parts.push(threeDigits(val));

  return `Rupees ${parts.join(' ')} Only`;
}

function formatDateDisplay(d) {
  if (!d) return '-';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-GB');
}

function formatCurrency(val) {
  return Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const VoucherSlipModal = ({
  isOpen,
  onClose,
  voucherId = null,
  voucherNo = '',
  voucherType = '',
  rowData = null,
  individualLedgerOnly = false,
  selectedLedgerName = ''
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [voucher, setVoucher] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const loadVoucherSlip = async () => {
      setLoading(true);
      setError('');
      try {
        const key = voucherId || voucherNo;
        if (!key) {
          throw new Error('Voucher identifier is missing');
        }
        let data = null;
        try {
          data = await voucherAPI.get(key);
        } catch (_) {
          if (voucherNo) {
            const lookupRes = await voucherAPI.lookup(voucherNo);
            if (lookupRes && lookupRes.voucher) {
              data = {
                ...lookupRes.voucher,
                entries: lookupRes.entries || [],
                linked_purchase: lookupRes.purchase || null
              };
            }
          }
        }
        if (!cancelled) {
          if (data && data.voucher_no) {
            setVoucher(data);
          } else {
            setError('Could not load voucher slip details.');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load voucher slip');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadVoucherSlip();
    return () => { cancelled = true; };
  }, [isOpen, voucherId, voucherNo]);

  const slipMeta = useMemo(() => {
    const v = voucher || {};
    const vType = String(v.voucher_type || voucherType || 'Payment').trim();
    const tLower = vType.toLowerCase();
    const allEntries = Array.isArray(v.entries) ? v.entries : [];

    const norm = (val) => String(val || '').trim().toLowerCase();
    const isIndividualMode = Boolean(individualLedgerOnly && selectedLedgerName);
    const targetNames = new Set([norm(selectedLedgerName), norm(rowData?.ledger_name)].filter(Boolean));
    const filteredEntries = isIndividualMode
      ? allEntries.filter((e) => targetNames.has(norm(e.ledger_name)))
      : allEntries;

    const entries = isIndividualMode
      ? (filteredEntries.length > 0
          ? filteredEntries
          : (rowData && (Number(rowData.debit || 0) > 0 || Number(rowData.credit || 0) > 0)
              ? [{
                  ledger_name: rowData.ledger_name || selectedLedgerName,
                  group_name: rowData.group_name || 'Ledger Account',
                  debit: Number(rowData.debit || 0),
                  credit: Number(rowData.credit || 0),
                  remarks: rowData.particulars || rowData.remarks || v.narration || ''
                }]
              : []))
      : allEntries;

    const drEntries = allEntries.filter(e => Number(e.debit || 0) > 0);
    const crEntries = allEntries.filter(e => Number(e.credit || 0) > 0);

    const totalDebit = entries.reduce((s, e) => s + Number(e.debit || 0), 0) || (!isIndividualMode ? Number(v.total_debit || 0) : Number(rowData?.debit || 0));
    const totalCredit = entries.reduce((s, e) => s + Number(e.credit || 0), 0) || (!isIndividualMode ? Number(v.total_credit || 0) : Number(rowData?.credit || 0));
    const netSigned = totalDebit - totalCredit;
    const netAmount = Math.abs(netSigned);
    const netType = netSigned >= 0 ? 'Dr' : 'Cr';
    const primaryAmount = isIndividualMode ? (netAmount || Math.max(totalDebit, totalCredit)) : Math.max(totalDebit, totalCredit);

    let slipTitle = isIndividualMode ? `INDIVIDUAL LEDGER SLIP – ${selectedLedgerName}` : 'VOUCHER SLIP';
    let partyLabel = isIndividualMode ? 'Selected Ledger' : 'Party / Account';
    let modeLabel = 'Counter Account';
    let partyValue = isIndividualMode
      ? selectedLedgerName
      : (drEntries.map(e => e.ledger_name).filter(Boolean).join(', ') || rowData?.ledger_name || '-');
    let modeValue = crEntries.map(e => e.ledger_name).filter(Boolean).join(', ') || '-';
    let accentGradient = 'linear-gradient(135deg, #1e3a8a 0%, #312e81 100%)';

    if (tLower.includes('payment') || tLower.includes('advance')) {
      slipTitle = isIndividualMode ? `PAYMENT LEDGER DETAILS – ${selectedLedgerName}` : 'PAYMENT VOUCHER SLIP';
      if (!isIndividualMode) {
        partyLabel = 'Paid To (Receiver)';
        modeLabel = 'Paid From (Cash / Bank)';
        partyValue = drEntries.map(e => e.ledger_name).filter(Boolean).join(', ') || rowData?.ledger_name || '-';
        modeValue = crEntries.map(e => e.ledger_name).filter(Boolean).join(', ') || '-';
      } else {
        modeLabel = 'Voucher Type';
        modeValue = vType;
      }
      accentGradient = 'linear-gradient(135deg, #1e3a8a 0%, #4338ca 100%)';
    } else if (tLower.includes('receipt')) {
      slipTitle = isIndividualMode ? `RECEIPT LEDGER DETAILS – ${selectedLedgerName}` : 'RECEIPT VOUCHER SLIP';
      if (!isIndividualMode) {
        partyLabel = 'Received From';
        modeLabel = 'Deposited Into (Cash / Bank)';
        partyValue = crEntries.map(e => e.ledger_name).filter(Boolean).join(', ') || '-';
        modeValue = drEntries.map(e => e.ledger_name).filter(Boolean).join(', ') || '-';
      } else {
        modeLabel = 'Voucher Type';
        modeValue = vType;
      }
      accentGradient = 'linear-gradient(135deg, #065f46 0%, #047857 100%)';
    } else if (tLower.includes('contra')) {
      slipTitle = isIndividualMode ? `CONTRA LEDGER DETAILS – ${selectedLedgerName}` : 'CONTRA VOUCHER SLIP';
      if (!isIndividualMode) {
        partyLabel = 'Transferred / Deposited To';
        modeLabel = 'Withdrawn / From Account';
      } else {
        modeLabel = 'Voucher Type';
        modeValue = vType;
      }
    } else if (tLower.includes('journal')) {
      slipTitle = isIndividualMode ? `JOURNAL LEDGER DETAILS – ${selectedLedgerName}` : 'JOURNAL VOUCHER SLIP';
      if (!isIndividualMode) {
        partyLabel = 'Debit Accounts';
        modeLabel = 'Credit Accounts';
      } else {
        modeLabel = 'Voucher Type';
        modeValue = vType;
      }
    } else if (isIndividualMode) {
      modeLabel = 'Voucher Type';
      modeValue = vType;
    }

    const invoiceRef = v.linked_purchase?.inv_no || v.reference_no || rowData?.inv_no || rowData?.reference_no || '-';

    return {
      vType,
      isIndividualMode,
      slipTitle,
      partyLabel,
      modeLabel,
      partyValue,
      modeValue,
      accentGradient,
      entries,
      totalDebit,
      totalCredit,
      netAmount,
      netType,
      primaryAmount,
      invoiceRef
    };
  }, [voucher, voucherType, rowData, individualLedgerOnly, selectedLedgerName]);

  const handlePrintSlip = () => {
    if (!voucher) return;
    const rowsHtml = slipMeta.entries.map((e, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'};">
        <td style="padding:7px 10px; border:1px solid #cbd5e1; text-align:center; font-weight:700; color:${Number(e.debit) > 0 ? '#b91c1c' : '#15803d'};">${Number(e.debit) > 0 ? 'Dr' : 'Cr'}</td>
        <td style="padding:7px 10px; border:1px solid #cbd5e1; font-weight:700; color:#0f172a;">${e.ledger_name || '-'}</td>
        <td style="padding:7px 10px; border:1px solid #cbd5e1; color:#475569;">${e.group_name || e.ledger_type || 'General'}</td>
        <td style="padding:7px 10px; border:1px solid #cbd5e1; text-align:right; font-weight:700; color:#b91c1c;">${Number(e.debit) > 0 ? `₹${formatCurrency(e.debit)}` : '—'}</td>
        <td style="padding:7px 10px; border:1px solid #cbd5e1; text-align:right; font-weight:700; color:#15803d;">${Number(e.credit) > 0 ? `₹${formatCurrency(e.credit)}` : '—'}</td>
        <td style="padding:7px 10px; border:1px solid #cbd5e1; color:#475569;">${e.remarks || '—'}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family:'Segoe UI', Arial, sans-serif; color:#0f172a; padding:18px; border:2px solid #1e3a8a; border-radius:8px; max-width:850px; margin:0 auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #1e3a8a; padding-bottom:12px; margin-bottom:14px;">
          <div>
            <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#475569; font-weight:700;">Enterprise Accounting & Ledger System</div>
            <h2 style="margin:2px 0 0 0; color:#1e3a8a; font-size:20px; letter-spacing:0.5px;">${slipMeta.slipTitle}</h2>
          </div>
          <div style="text-align:right;">
            <div style="font-size:15px; font-weight:800; color:#1e3a8a;">Voucher No: ${voucher.voucher_no}</div>
            <div style="font-size:12px; color:#475569; margin-top:2px;">Date: <strong>${formatDateDisplay(voucher.date)}</strong> | Status: <strong>${voucher.status || 'Approved'}</strong></div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1.5fr 1fr; gap:12px; margin-bottom:14px;">
          <div style="border:1px solid #cbd5e1; border-radius:6px; padding:10px 12px; background:#f8fafc;">
            <div style="margin-bottom:6px; font-size:12px;"><span style="color:#64748b; font-weight:600;">${slipMeta.partyLabel}:</span> <strong style="color:#0f172a; font-size:13px;">${slipMeta.partyValue}</strong></div>
            <div style="margin-bottom:6px; font-size:12px;"><span style="color:#64748b; font-weight:600;">${slipMeta.modeLabel}:</span> <strong style="color:#0f172a;">${slipMeta.modeValue}</strong></div>
            <div style="font-size:12px;"><span style="color:#64748b; font-weight:600;">Reference / Purchase Invoice No:</span> <strong style="color:#1d4ed8;">${slipMeta.invoiceRef !== '-' ? `#${slipMeta.invoiceRef}` : 'N/A'}</strong></div>
          </div>
          <div style="border:1px solid #bfdbfe; border-radius:6px; padding:10px 12px; background:#eff6ff; text-align:right; display:flex; flex-direction:column; justify-content:center;">
            <div style="font-size:11px; text-transform:uppercase; font-weight:700; color:#1e40af;">Total Voucher Amount</div>
            <div style="font-size:22px; font-weight:800; color:#1e3a8a; margin:3px 0;">₹${formatCurrency(slipMeta.primaryAmount)}</div>
            <div style="font-size:11px; color:#334155; font-style:italic;">${numberToIndianWords(slipMeta.primaryAmount)}</div>
          </div>
        </div>

        <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:14px;">
          <thead>
            <tr style="background:#1e3a8a; color:#ffffff;">
              <th style="padding:7px 10px; border:1px solid #1e3a8a; text-align:center; width:60px;">Dr/Cr</th>
              <th style="padding:7px 10px; border:1px solid #1e3a8a; text-align:left;">Ledger Account</th>
              <th style="padding:7px 10px; border:1px solid #1e3a8a; text-align:left;">Account Group</th>
              <th style="padding:7px 10px; border:1px solid #1e3a8a; text-align:right; width:120px;">Debit (₹)</th>
              <th style="padding:7px 10px; border:1px solid #1e3a8a; text-align:right; width:120px;">Credit (₹)</th>
              <th style="padding:7px 10px; border:1px solid #1e3a8a; text-align:left;">Remarks / Inv Ref</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr style="background:#f1f5f9; font-weight:800;">
              <td colspan="3" style="padding:8px 10px; border:1px solid #cbd5e1; text-align:right;">TOTAL:</td>
              <td style="padding:8px 10px; border:1px solid #cbd5e1; text-align:right; color:#b91c1c;">₹${formatCurrency(slipMeta.totalDebit)}</td>
              <td style="padding:8px 10px; border:1px solid #cbd5e1; text-align:right; color:#15803d;">₹${formatCurrency(slipMeta.totalCredit)}</td>
              <td style="padding:8px 10px; border:1px solid #cbd5e1; color:#15803d;">${slipMeta.isIndividualMode ? `Net: ₹${formatCurrency(slipMeta.netAmount)} ${slipMeta.netType}` : 'Balanced ✔'}</td>
            </tr>
          </tfoot>
        </table>

        <div style="border:1px solid #cbd5e1; border-radius:6px; padding:10px 12px; background:#ffffff; margin-bottom:26px; font-size:12px;">
          <strong style="color:#475569; text-transform:uppercase; font-size:10px; display:block; margin-bottom:3px;">Narration / Settlement Details:</strong>
          <span>${voucher.narration || 'No narration recorded.'}</span>
        </div>

        <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:16px; text-align:center; padding-top:24px; font-size:11px; color:#475569; font-weight:700;">
          <div style="border-top:1px solid #94a3b8; padding-top:6px;">Prepared By</div>
          <div style="border-top:1px solid #94a3b8; padding-top:6px;">Verified / Accounts</div>
          <div style="border-top:1px solid #94a3b8; padding-top:6px;">Authorised Signatory</div>
          <div style="border-top:1px solid #94a3b8; padding-top:6px;">Receiver's Signature</div>
        </div>
      </div>
    `;

    printHtml(html, `${slipMeta.vType}_Voucher_Slip_${voucher.voucher_no}`);
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(900px, 95vw)',
          maxWidth: '95vw',
          maxHeight: '92vh',
          height: 'auto',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: '1px solid #cbd5e1',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#0f172a'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Banner */}
        <div
          style={{
            background: slipMeta.accentGradient,
            color: '#ffffff',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255,255,255,0.16)',
              border: '1px solid rgba(255,255,255,0.28)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px'
            }}>
              🧾
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, letterSpacing: '0.3px' }}>
                  {slipMeta.slipTitle}
                </h2>
                <span style={{
                  fontSize: '11px',
                  padding: '2px 10px',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(16, 185, 129, 0.22)',
                  color: '#a7f3d0',
                  fontWeight: 700,
                  border: '1px solid rgba(52, 211, 153, 0.4)'
                }}>
                  {voucher?.status || 'Approved'}
                </span>
                {voucher && voucher.posted !== 0 && (
                  <span style={{
                    fontSize: '11px',
                    padding: '2px 10px',
                    borderRadius: '999px',
                    backgroundColor: 'rgba(255, 255, 255, 0.16)',
                    color: '#e0e7ff',
                    fontWeight: 700,
                    border: '1px solid rgba(255, 255, 255, 0.3)'
                  }}>
                    Posted in Ledger
                  </span>
                )}
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#dbeafe', fontWeight: 500 }}>
                Voucher No: <strong style={{ color: '#ffffff' }}>{voucher?.voucher_no || voucherNo}</strong> · Date: <strong style={{ color: '#ffffff' }}>{formatDateDisplay(voucher?.date || rowData?.date)}</strong>
                {slipMeta.invoiceRef !== '-' && (
                  <> · Inv / Ref: <strong style={{ color: '#fde68a' }}>#{slipMeta.invoiceRef}</strong></>
                )}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {voucher && (
              <button
                onClick={handlePrintSlip}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  backgroundColor: 'rgba(255,255,255,0.16)',
                  color: '#ffffff',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.3)',
                  cursor: 'pointer'
                }}
              >
                🖨️ Print Slip
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.12)',
                border: 'none',
                color: '#ffffff',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                fontSize: '16px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title="Close Voucher Slip"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#64748b', fontSize: '13px', fontWeight: 600 }}>
            Loading voucher slip details...
          </div>
        ) : error ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#b91c1c' }}>
            <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '14px' }}>{error}</p>
            <button
              onClick={onClose}
              style={{ padding: '8px 18px', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        ) : voucher ? (
          <div style={{ padding: '16px 20px', overflowY: 'auto', flex: '1 1 auto', minHeight: 0, backgroundColor: '#f8fafc', display: 'block' }}>
            {/* Top Slip Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px', marginBottom: '14px' }}>
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed #e2e8f0', paddingBottom: '5px', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{slipMeta.partyLabel}</span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', textAlign: 'right' }}>{slipMeta.partyValue}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed #e2e8f0', paddingBottom: '5px', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{slipMeta.modeLabel}</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', textAlign: 'right' }}>{slipMeta.modeValue}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Reference / Purchase Inv No</span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#1d4ed8', backgroundColor: '#eff6ff', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
                    {slipMeta.invoiceRef !== '-' ? `#${slipMeta.invoiceRef}` : 'N/A'}
                  </span>
                </div>
                {voucher.linked_purchase && (
                  <div style={{ fontSize: '11px', color: '#475569', backgroundColor: '#f1f5f9', padding: '5px 10px', borderRadius: '6px', marginTop: '2px' }}>
                    Linked Bill: <strong>{voucher.linked_purchase.voucher_no || `PUR#${voucher.linked_purchase.id}`}</strong>
                    {voucher.linked_purchase.date ? ` · Date: ${formatDateDisplay(voucher.linked_purchase.date)}` : ''}
                    {voucher.linked_purchase.grand_total ? ` · Bill Total: ₹${formatCurrency(voucher.linked_purchase.grand_total)}` : ''}
                  </div>
                )}
              </div>

              <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end', textAlign: 'right' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Amount Paid / Settled
                </span>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#1e3a8a', fontFamily: 'monospace', margin: '3px 0' }}>
                  ₹{formatCurrency(slipMeta.primaryAmount)}
                </div>
                <span style={{ fontSize: '11px', color: '#334155', fontStyle: 'italic', fontWeight: 600 }}>
                  {numberToIndianWords(slipMeta.primaryAmount)}
                </span>
              </div>
            </div>

            {/* Double-Entry Account Postings Table */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', marginBottom: '14px' }}>
              <div style={{ padding: '9px 14px', backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1', borderTopLeftRadius: '9px', borderTopRightRadius: '9px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {slipMeta.isIndividualMode ? `Individual Ledger Entry – ${selectedLedgerName}` : 'Double-Entry Accounting Postings'}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: slipMeta.isIndividualMode ? '#1e40af' : '#047857', backgroundColor: slipMeta.isIndividualMode ? '#dbeafe' : '#dcfce7', padding: '2px 8px', borderRadius: '4px', border: `1px solid ${slipMeta.isIndividualMode ? '#93c5fd' : '#86efac'}` }}>
                  {slipMeta.isIndividualMode ? 'Individual Ledger View' : 'Debit = Credit (Balanced ✔)'}
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#1e3a8a', color: '#ffffff' }}>
                      <th style={{ padding: '7px 10px', textAlign: 'center', width: '60px' }}>Dr/Cr</th>
                      <th style={{ padding: '7px 12px', textAlign: 'left' }}>Particulars (Ledger Account)</th>
                      <th style={{ padding: '7px 12px', textAlign: 'left' }}>Account Group</th>
                      <th style={{ padding: '7px 12px', textAlign: 'right', width: '120px' }}>Debit (₹)</th>
                      <th style={{ padding: '7px 12px', textAlign: 'right', width: '120px' }}>Credit (₹)</th>
                      <th style={{ padding: '7px 12px', textAlign: 'left' }}>Remarks / Inv Ref</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slipMeta.entries.length > 0 ? slipMeta.entries.map((entry, idx) => {
                      const isDr = Number(entry.debit || 0) > 0;
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                          <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 800,
                              backgroundColor: isDr ? '#fee2e2' : '#dcfce7',
                              color: isDr ? '#b91c1c' : '#15803d'
                            }}>
                              {isDr ? 'Dr' : 'Cr'}
                            </span>
                          </td>
                          <td style={{ padding: '7px 12px', fontWeight: 700, color: '#0f172a' }}>
                            {entry.ledger_name || '-'}
                          </td>
                          <td style={{ padding: '7px 12px', color: '#64748b', fontSize: '11px' }}>
                            {entry.group_name || entry.ledger_type || 'General'}
                          </td>
                          <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: isDr ? '#b91c1c' : '#94a3b8', fontFamily: 'monospace' }}>
                            {isDr ? `₹${formatCurrency(entry.debit)}` : '—'}
                          </td>
                          <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: !isDr ? '#15803d' : '#94a3b8', fontFamily: 'monospace' }}>
                            {!isDr ? `₹${formatCurrency(entry.credit)}` : '—'}
                          </td>
                          <td style={{ padding: '7px 12px', color: '#475569', fontSize: '11px' }}>
                            {entry.remarks || '—'}
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan={6} style={{ padding: '14px', textAlign: 'center', color: '#64748b' }}>
                          No double-entry accounting lines recorded for this voucher.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: '#f1f5f9', borderTop: '2px solid #cbd5e1', fontWeight: 800 }}>
                      <td colSpan={3} style={{ padding: '8px 12px', textAlign: 'right', textTransform: 'uppercase', fontSize: '11px', color: '#334155' }}>
                        TOTAL:
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#b91c1c', fontFamily: 'monospace', fontSize: '13px' }}>
                        ₹{formatCurrency(slipMeta.totalDebit)}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#15803d', fontFamily: 'monospace', fontSize: '13px' }}>
                        ₹{formatCurrency(slipMeta.totalCredit)}
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: '11px', color: slipMeta.isIndividualMode ? '#1e40af' : '#047857' }}>
                        {slipMeta.isIndividualMode ? `Net: ₹${formatCurrency(slipMeta.netAmount)} ${slipMeta.netType}` : 'Balanced ✔'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Narration & Signature Preview */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 16px' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                Narration / Settlement Explanation
              </span>
              <p style={{ margin: 0, fontSize: '13px', color: '#0f172a', fontWeight: 500 }}>
                {voucher.narration || 'No narration recorded for this voucher.'}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginTop: '18px', paddingTop: '10px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
                <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '6px' }}>Prepared By</div>
                <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '6px' }}>Verified / Accounts</div>
                <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '6px' }}>Authorised Signatory</div>
                <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '6px' }}>Receiver's Signature</div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Footer Actions */}
        <div style={{ padding: '10px 18px', backgroundColor: '#f1f5f9', borderTop: '1px solid #cbd5e1', display: 'flex', justifyContent: 'flex-end', gap: '10px', flexShrink: 0 }}>
          {voucher && (
            <button
              onClick={handlePrintSlip}
              style={{
                padding: '7px 16px',
                backgroundColor: '#1d4ed8',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              🖨️ Print Voucher Slip
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              padding: '7px 18px',
              backgroundColor: '#334155',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default VoucherSlipModal;
