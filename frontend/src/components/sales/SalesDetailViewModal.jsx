import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import api from '../../services/api';

const fmtCurrency = (val) => {
  const n = Number(val || 0);
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtWeight = (val, showZero = false) => {
  const n = Number(val || 0);
  if (n <= 0) return showZero ? '0 kg' : '—';
  return `${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })} kg`;
};

const fmtDate = (val) => {
  if (!val) return '—';
  const s = String(val).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return s.substring(0, 10) || '—';
};

const fmtDateTime = (val) => {
  if (!val) return '—';
  const s = String(val).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}:\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]} ${m[4]}`;
  return fmtDate(s);
};

const valOrDash = (v) => {
  if (v === undefined || v === null) return '—';
  const s = String(v).trim();
  return s || '—';
};

const SectionCard = ({ title, subtitle, accent = '#1f4fb2', children }) => (
  <div
    style={{
      border: '1px solid #cbd5e1',
      borderRadius: '8px',
      backgroundColor: '#ffffff',
      overflow: 'hidden',
      marginBottom: '14px'
    }}
  >
    <div
      style={{
        backgroundColor: '#f0f6ff',
        borderBottom: '1px solid #bfdbfe',
        borderLeft: `4px solid ${accent}`,
        padding: '9px 14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px'
      }}
    >
      <div style={{ fontWeight: 800, fontSize: '13px', color: '#1e3a8a', letterSpacing: '0.2px' }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>{subtitle}</div>
      )}
    </div>
    <div style={{ padding: '12px 14px' }}>{children}</div>
  </div>
);

const FieldGrid = ({ fields }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
      gap: '10px 14px'
    }}
  >
    {fields.map((f, idx) => (
      <div
        key={`${f.label}-${idx}`}
        style={{
          backgroundColor: f.highlight ? '#eff6ff' : '#f8fafc',
          border: `1px solid ${f.highlight ? '#93c5fd' : '#e2e8f0'}`,
          borderRadius: '6px',
          padding: '7px 10px'
        }}
      >
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>
          {f.label}
        </div>
        <div
          style={{
            fontSize: '12px',
            fontWeight: f.bold ? 800 : 600,
            color: f.color || '#0f172a',
            wordBreak: 'break-word',
            fontFamily: f.mono ? 'monospace' : 'inherit'
          }}
        >
          {f.value}
        </div>
      </div>
    ))}
  </div>
);

const SalesDetailViewModal = ({ isOpen, onClose, record, isOrder = false, onPrint }) => {
  const [detail, setDetail] = useState(record || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !record) return;
    setDetail(record);
    if (record.id) {
      setLoading(true);
      api(`/sales/${record.id}`)
        .then((res) => {
          const data = res?.data || res;
          if (data && data.id) {
            setDetail(data);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [isOpen, record]);

  if (!isOpen || !detail) return null;

  const r = detail;
  const items = Array.isArray(r.items) ? r.items : [];
  const deductions = Array.isArray(r.deductions) ? r.deductions : [];
  const receipts = Array.isArray(r.receipt_vouchers) ? r.receipt_vouchers : [];

  const docNo = r.inv_no || r.s_no || r.voucher_no || r.id || '—';
  const grossWt = Number(r.vehicle_gross_weight || 0);
  const tareWt = Number(r.vehicle_tare_weight || 0);
  const netLoadWt = Number(r.net_load_weight || (grossWt > 0 ? Math.max(0, grossWt - tareWt) : 0));
  const pkgTareWt = Number(r.package_tare_weight || 0);
  const prodNetWt = Number(r.product_net_weight || r.total_wt || 0);
  const expectedTotalWt = prodNetWt + pkgTareWt;
  const wtVariance = netLoadWt > 0 ? netLoadWt - expectedTotalWt : 0;

  const grossAmt = Number(r.gross_amt || 0);
  const discAmt = Number(r.disc_amount || 0);
  const taxableBillAmt = Number(r.bill_amt || r.base_amt || 0);
  const cgstAmt = Number(r.cgst_amt || r.cgst_amount || 0);
  const sgstAmt = Number(r.sgst_amt || r.sgst_amount || 0);
  const igstAmt = Number(r.igst_amt || r.igst_amount || 0);
  const taxAmt = Number(r.tax_amt || r.tax_amount || (cgstAmt + sgstAmt + igstAmt));
  const freightRecoveryAmt = Number(r.freight_recovery_amt || 0);
  const loadingChargesAmt = Number(r.loading_charges_amt || 0);
  const otherChargesAmt = Number(r.other_charges || 0);
  const tcsAmt = Number(r.tcs_amount || 0);
  const roundOffAmt = Number(r.round_off || 0);
  const grandTotal = Number(r.grand_total || r.total_amt || 0);

  const actualReceived = Number(r.actual_received_amount ?? (Number(r.received_amount || 0) + Number(r.advance_adjusted || 0)));
  const balanceDue = Number(r.actual_balance_due ?? Math.max(0, grandTotal - actualReceived));
  const payStatus = r.payment_status || (isOrder ? 'Order' : balanceDue <= 0.01 && grandTotal > 0 ? 'Paid' : actualReceived > 0 ? 'Partially Paid' : 'Unpaid');
  const dispStatus = r.computed_dispatch_status || r.dispatch_status || (isOrder ? 'Open Order' : 'Pending');

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10500,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '18px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1180px',
          maxHeight: '92vh',
          backgroundColor: '#f1f5f9',
          borderRadius: '10px',
          border: '1px solid #94a3b8',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1f4fb2 0%, #1e3a8a 100%)',
            color: '#ffffff',
            padding: '13px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '17px', fontWeight: 800 }}>
                {isOrder ? `Sales Order Details — #${docNo}` : `Sales Invoice Details — #${docNo}`}
              </span>
              {r.voucher_no && (
                <span
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.18)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    fontWeight: 700
                  }}
                >
                  {r.voucher_no}
                </span>
              )}
              <span
                style={{
                  backgroundColor: payStatus === 'Paid' ? '#16a34a' : payStatus === 'Partially Paid' ? '#d97706' : '#0284c7',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700
                }}
              >
                {payStatus}
              </span>
              <span
                style={{
                  backgroundColor: dispStatus === 'Dispatched' || dispStatus === 'Delivered' ? '#0d9488' : '#334155',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700
                }}
              >
                {dispStatus}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#dbeafe', marginTop: '3px' }}>
              Customer: <strong>{r.customer_name || r.customer || '—'}</strong> | Date: <strong>{fmtDate(r.date)}</strong>
              {loading ? ' | Refreshing live details...' : ''}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {onPrint && (
              <button
                type="button"
                onClick={() => onPrint(r)}
                style={{
                  backgroundColor: '#ffffff',
                  color: '#1e3a8a',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '7px 14px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                🖨 Print {isOrder ? 'Order' : 'Invoice'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{
                backgroundColor: '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '7px 14px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
          {/* Section A: Customer & Invoice Details */}
          <SectionCard
            title="A. Customer & Invoice Details"
            subtitle={`FY: ${r.financial_year || '—'} | Tax Mode: ${r.tax_mode || r.tax_type || '—'}`}
          >
            <FieldGrid
              fields={[
                { label: isOrder ? 'Order No.' : 'Invoice / Doc No.', value: docNo, bold: true, highlight: true },
                { label: 'Document Date', value: fmtDate(r.date), bold: true },
                { label: 'Financial Year', value: valOrDash(r.financial_year) },
                { label: 'Customer Name', value: valOrDash(r.customer_name || r.customer), bold: true },
                { label: 'Customer Code', value: valOrDash(r.customer_code), mono: true },
                { label: 'Customer Type', value: valOrDash(r.customer_type) },
                { label: 'Customer GSTIN', value: valOrDash(r.customer_gstin), mono: true },
                { label: 'State & Place of Supply', value: valOrDash(r.place_of_supply || (r.party_state ? `${r.party_state}${r.party_state_code ? ` (${r.party_state_code})` : ''}` : '')) },
                { label: 'Contact Person / Phone', value: [r.contact_person, r.phone].filter(Boolean).join(' / ') || '—' },
                { label: 'Sales Category', value: valOrDash(r.sales_category) },
                { label: 'Tax Mode', value: valOrDash(r.tax_mode || r.tax_type) },
                { label: 'Sales Order / PO Ref', value: valOrDash(r.sales_order_ref || r.customer_po_no || r.p_o_no || r.po_no) },
                { label: 'Payment Terms / Due Date', value: `${valOrDash(r.payment_terms || r.pay_type)}${r.due_date ? ` (Due: ${fmtDate(r.due_date)})` : ''}` },
                { label: 'Expected Delivery Date', value: fmtDate(r.delivery_date || r.expected_delivery_date) },
                { label: 'Salesperson', value: valOrDash(r.sales_person) },
                { label: 'Default Godown', value: valOrDash(r.godown_from_name || r.godown_name) },
                { label: 'Billing Address', value: valOrDash(r.billing_address || r.address) },
                { label: 'Shipping Address', value: valOrDash(r.shipping_address || r.delivery_location) },
                { label: 'Remarks', value: valOrDash(r.remarks) }
              ]}
            />
          </SectionCard>

          {/* Section B: Item & Lot Details */}
          <SectionCard
            title="B. Item & Lot Details"
            subtitle={`${items.length} Line Item(s) | Total Qty: ${Number(r.qty || r.total_qty || 0).toLocaleString('en-IN')} | Product Net Wt: ${fmtWeight(prodNetWt, true)}`}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '980px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1e3a8a', color: '#ffffff' }}>
                    {['#', 'Item / Code / HSN', 'Godown', 'Lot No.', 'Parent RM Lot', 'Qty / Pkg', 'Unit Wt', 'Pkg Tare/U', 'Net Prod Wt', 'Rate & Type', 'Disc %', 'Taxable ₹', 'GST % / Tax', 'Load Wt', 'Line Total ₹'].map((h) => (
                      <th key={h} style={{ padding: '7px 8px', border: '1px solid #3b82f6', textAlign: 'left', fontSize: '11px', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={15} style={{ padding: '14px', textAlign: 'center', color: '#64748b', border: '1px solid #cbd5e1' }}>
                        No line item records found.
                      </td>
                    </tr>
                  ) : (
                    items.map((it, idx) => (
                      <tr key={it.id || idx} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                        <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 700 }}>{idx + 1}</td>
                        <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{it.item_name || it.itemName || '—'}</div>
                          <div style={{ fontSize: '10px', color: '#64748b' }}>
                            {it.product_code ? `Code: ${it.product_code}` : ''}{it.hsn_code ? ` | HSN: ${it.hsn_code}` : ''}
                          </div>
                        </td>
                        <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1' }}>{valOrDash(it.godown_name)}</td>
                        <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1', fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8' }}>{valOrDash(it.lot_no || it.lotNo)}</td>
                        <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1', fontFamily: 'monospace', fontSize: '11px' }}>{valOrDash(it.parent_rm_lot_no)}</td>
                        <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>
                          <strong>{Number(it.qty || 0).toLocaleString('en-IN')}</strong> {it.package_type || it.uom || ''}
                        </td>
                        <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{fmtWeight(it.weight)}</td>
                        <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{fmtWeight(it.package_tare_wt)}</td>
                        <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 700 }}>{fmtWeight(it.net_product_wt || it.total_wt)}</td>
                        <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>
                          {fmtCurrency(it.rate)} <span style={{ fontSize: '10px', color: '#64748b' }}>({it.rate_type || 'Per Kg'})</span>
                        </td>
                        <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{Number(it.disc_perc || 0)}%</td>
                        <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{fmtCurrency(it.taxable_amount)}</td>
                        <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>
                          {Number(it.gst_rate ?? it.tax_perc ?? 0)}%
                          <div style={{ fontSize: '10px', color: '#64748b' }}>
                            {fmtCurrency(Number(it.cgst_amount || 0) + Number(it.sgst_amount || 0) + Number(it.igst_amount || 0))}
                          </div>
                        </td>
                        <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{fmtWeight(it.allocated_load_wt)}</td>
                        <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 800, color: '#1e3a8a' }}>{fmtCurrency(it.total_amt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* Section C: Weighment Details */}
          <SectionCard
            title="C. Weighment Details"
            subtitle={`Mode: ${valOrDash(r.weighment_mode)} | Vehicle Net Load vs Material Net Weight`}
            accent="#0284c7"
          >
            <FieldGrid
              fields={[
                { label: 'Weighment Mode', value: valOrDash(r.weighment_mode) },
                { label: 'Vehicle Gross Weight', value: fmtWeight(grossWt, true) },
                { label: 'Vehicle Tare Weight', value: fmtWeight(tareWt, true) },
                { label: 'Vehicle Net Load (Gross - Tare)', value: fmtWeight(netLoadWt, true), bold: true, highlight: true, color: '#0369a1' },
                { label: 'Material Product Net Wt', value: fmtWeight(prodNetWt, true), bold: true },
                { label: 'Package / Bag Tare Wt', value: fmtWeight(pkgTareWt, true) },
                { label: 'Expected Total (Prod + Pkg Tare)', value: fmtWeight(expectedTotalWt, true) },
                {
                  label: 'Weighbridge Variance',
                  value: netLoadWt > 0 ? `${wtVariance >= 0 ? '+' : ''}${wtVariance.toFixed(2)} kg` : '—',
                  color: Math.abs(wtVariance) > 5 ? '#b45309' : '#15803d',
                  bold: true
                },
                { label: 'Weighment Slip No.', value: valOrDash(r.weighment_slip_no), mono: true },
                { label: 'Weighbridge Name', value: valOrDash(r.weighbridge_name) },
                { label: 'Weighed By', value: valOrDash(r.weighed_by) },
                { label: 'Weighment Date / Time', value: `${fmtDate(r.weighment_date)}${r.weighment_time ? ` ${r.weighment_time}` : ''}` }
              ]}
            />
          </SectionCard>

          {/* Section D: Transport & Freight Details */}
          <SectionCard
            title="D. Transport & Freight Details"
            subtitle={`Vehicle: ${valOrDash(r.lorry_no)} | Transporter: ${valOrDash(r.transporter_name || r.pur_trans)}`}
            accent="#0f766e"
          >
            <FieldGrid
              fields={[
                { label: 'Transport Mode', value: valOrDash(r.transport_mode) },
                { label: 'Transporter Name', value: valOrDash(r.transporter_name || r.pur_trans), bold: true },
                { label: 'Transporter GSTIN', value: valOrDash(r.transporter_gstin), mono: true },
                { label: 'Vehicle / Lorry No.', value: valOrDash(r.lorry_no), bold: true, mono: true, highlight: true },
                { label: 'Vehicle Type', value: valOrDash(r.vehicle_type) },
                { label: 'Driver Name & Mobile', value: [r.driver, r.driver_mobile].filter(Boolean).join(' / ') || '—' },
                { label: 'LR / GR No. & Date', value: r.lr_no ? `${r.lr_no}${r.lr_date ? ` (${fmtDate(r.lr_date)})` : ''}` : '—' },
                { label: 'Loading Location', value: valOrDash(r.loading_location || r.godown_from_name) },
                { label: 'Delivery Location', value: valOrDash(r.delivery_location) },
                { label: 'Freight Type / Rate', value: `${valOrDash(r.freight_type)}${Number(r.freight_rate || 0) > 0 ? ` @ ${fmtCurrency(r.freight_rate)}` : ''}` },
                { label: 'Freight Amount', value: fmtCurrency(r.freight_amount), bold: true },
                { label: 'Freight Paid By / Recovery', value: `${valOrDash(r.freight_paid_by)}${Number(r.recover_freight_on_invoice) === 1 ? ' (Recovered on Invoice)' : ''}` },
                { label: 'Freight Status / Voucher', value: `${valOrDash(r.freight_payment_status)}${r.freight_voucher_no ? ` (${r.freight_voucher_no})` : ''}` },
                { label: 'Loadman Team / Charges', value: `${valOrDash(r.loadman_name)}${Number(r.loadman_charges || 0) > 0 ? ` — ${fmtCurrency(r.loadman_charges)}` : ''}` }
              ]}
            />
          </SectionCard>

          {/* Section E: Tax & Amount Summary */}
          <SectionCard
            title="E. Tax & Amount Summary"
            subtitle={`Grand Total: ${fmtCurrency(grandTotal)}`}
            accent="#1e3a8a"
          >
            <FieldGrid
              fields={[
                { label: 'Gross Amount', value: fmtCurrency(grossAmt) },
                { label: 'Total Discount', value: fmtCurrency(discAmt) },
                { label: 'Taxable Bill Amount', value: fmtCurrency(taxableBillAmt), bold: true },
                { label: 'CGST', value: fmtCurrency(cgstAmt) },
                { label: 'SGST', value: fmtCurrency(sgstAmt) },
                { label: 'IGST', value: fmtCurrency(igstAmt) },
                { label: 'Total GST Tax', value: fmtCurrency(taxAmt), bold: true },
                { label: 'Freight Recovery', value: fmtCurrency(freightRecoveryAmt) },
                { label: 'Loading Charges', value: fmtCurrency(loadingChargesAmt) },
                { label: 'Other Charges', value: fmtCurrency(otherChargesAmt) },
                { label: 'TCS Amount', value: fmtCurrency(tcsAmt) },
                { label: 'Round Off', value: fmtCurrency(roundOffAmt) },
                { label: 'Grand Total', value: fmtCurrency(grandTotal), bold: true, highlight: true, color: '#1e3a8a' }
              ]}
            />
            {deductions.length > 0 && (
              <div style={{ marginTop: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Master Deductions / Additions
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {deductions.map((d, idx) => (
                    <span
                      key={idx}
                      style={{
                        backgroundColor: d.type === 'LESS' ? '#fef2f2' : '#f0fdf4',
                        border: `1px solid ${d.type === 'LESS' ? '#fecaca' : '#bbf7d0'}`,
                        color: d.type === 'LESS' ? '#991b1b' : '#166534',
                        borderRadius: '5px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: 700
                      }}
                    >
                      {d.type === 'LESS' ? '−' : '+'} {d.name}: {fmtCurrency(d.amount)}
                      {d.remarks ? ` (${d.remarks})` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>

          {/* Section F: Payment Details */}
          <SectionCard
            title="F. Payment Details & Linked Receipt Vouchers"
            subtitle={`Status: ${payStatus} | Balance Due: ${fmtCurrency(balanceDue)}`}
            accent="#15803d"
          >
            <FieldGrid
              fields={[
                { label: 'Invoice / Order Total', value: fmtCurrency(grandTotal), bold: true },
                { label: 'Sales Type / Payment Mode', value: `${valOrDash(r.pay_type)} / ${valOrDash(r.payment_mode)}` },
                { label: 'Advance Adjusted', value: fmtCurrency(r.advance_adjusted) },
                { label: 'Actual Received Total', value: fmtCurrency(actualReceived), bold: true, color: '#15803d' },
                { label: 'Balance Due', value: fmtCurrency(balanceDue), bold: true, highlight: true, color: balanceDue > 0.01 ? '#b91c1c' : '#15803d' },
                { label: 'Payment Status', value: payStatus, bold: true },
                { label: 'Bank Account / Txn Ref', value: [r.bank_account_name, r.transaction_ref].filter(Boolean).join(' — ') || '—' },
                { label: 'Payment Date / Receipt Vch', value: `${fmtDate(r.payment_date)}${r.receipt_voucher_no ? ` (${r.receipt_voucher_no})` : ''}` }
              ]}
            />
            {receipts.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Linked Receipt Vouchers / Ledger Receipts
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#dcfce7', color: '#14532d' }}>
                      <th style={{ padding: '5px 8px', border: '1px solid #bbf7d0', textAlign: 'left' }}>Voucher No.</th>
                      <th style={{ padding: '5px 8px', border: '1px solid #bbf7d0', textAlign: 'left' }}>Type</th>
                      <th style={{ padding: '5px 8px', border: '1px solid #bbf7d0', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: '5px 8px', border: '1px solid #bbf7d0', textAlign: 'left' }}>Particulars</th>
                      <th style={{ padding: '5px 8px', border: '1px solid #bbf7d0', textAlign: 'right' }}>Amount ₹</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipts.map((rv, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: '5px 8px', border: '1px solid #e2e8f0', fontFamily: 'monospace', fontWeight: 700 }}>{rv.voucher_no || '—'}</td>
                        <td style={{ padding: '5px 8px', border: '1px solid #e2e8f0' }}>{rv.voucher_type || 'Receipt'}</td>
                        <td style={{ padding: '5px 8px', border: '1px solid #e2e8f0' }}>{fmtDate(rv.date)}</td>
                        <td style={{ padding: '5px 8px', border: '1px solid #e2e8f0' }}>{rv.particulars || '—'}</td>
                        <td style={{ padding: '5px 8px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 700 }}>{fmtCurrency(rv.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Section G: Dispatch, Compliance & Audit Summary */}
          <SectionCard
            title="G. Dispatch, Documents & Audit Summary"
            subtitle={`Outpass: ${valOrDash(r.outpass_no)} | Dispatch Status: ${dispStatus}`}
            accent="#4338ca"
          >
            <FieldGrid
              fields={[
                { label: 'Outpass No. & Status', value: r.outpass_no ? `${r.outpass_no} (${valOrDash(r.outpass_status)})` : '—', bold: true, mono: true },
                { label: 'Outpass Date', value: fmtDate(r.outpass_date) },
                { label: 'Confirmed Net Dispatched Wt', value: fmtWeight(r.confirmed_dispatched_weight, true), bold: true, highlight: true, color: '#1d4ed8' },
                { label: 'Dispatch Status', value: dispStatus, bold: true },
                { label: 'Dispatch No. & Datetime', value: [r.dispatch_no, fmtDateTime(r.dispatch_datetime)].filter((x) => x && x !== '—').join(' / ') || '—' },
                { label: 'Delivery Challan No.', value: valOrDash(r.delivery_challan_no), mono: true },
                { label: 'E-Way Bill No. & Validity', value: r.eway_bill_no ? `${r.eway_bill_no}${r.eway_bill_validity ? ` (Valid: ${fmtDate(r.eway_bill_validity)})` : ''}` : '—', mono: true },
                { label: 'IRN & Ack No.', value: [r.irn_no, r.ack_no].filter(Boolean).join(' / ') || '—', mono: true },
                { label: 'Actual Delivery Date', value: fmtDate(r.actual_delivery_date) },
                { label: 'Received By (POD)', value: valOrDash(r.received_by) },
                { label: 'Delivery Remarks', value: valOrDash(r.delivery_remarks) },
                { label: 'Created At / Created By', value: `${fmtDateTime(r.created_at)}${r.created_by ? ` (${r.created_by})` : ''}` },
                { label: 'Updated At', value: fmtDateTime(r.updated_at) }
              ]}
            />
          </SectionCard>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default SalesDetailViewModal;
