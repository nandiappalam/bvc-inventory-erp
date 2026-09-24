/**
 * purchasePrintHelper.js - Professional Purchase Invoice & Goods Inward Receipt (GRN) Print Generator
 * Produces clean, crystal-clear, structured tabular printable vouchers for ERP Purchase module.
 */

// Number to Indian Currency Words Helper
function numberToWords(num) {
  if (isNaN(num) || num === null || num === undefined) return '';
  const n = Math.round(Number(num));
  if (n === 0) return 'Zero Rupees Only';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(val) {
    let str = '';
    if (val > 99) {
      str += a[Math.floor(val / 100)] + ' Hundred ';
      val %= 100;
    }
    if (val > 19) {
      str += b[Math.floor(val / 10)] + (val % 10 !== 0 ? ' ' + a[val % 10] : '') + ' ';
    } else if (val > 0) {
      str += a[val] + ' ';
    }
    return str.trim();
  }

  let words = '';
  let crore = Math.floor(n / 10000000);
  let rem = n % 10000000;
  let lakh = Math.floor(rem / 100000);
  rem %= 100000;
  let thousand = Math.floor(rem / 1000);
  rem %= 1000;
  let hundred = rem;

  if (crore > 0) words += inWords(crore) + ' Crore ';
  if (lakh > 0) words += inWords(lakh) + ' Lakh ';
  if (thousand > 0) words += inWords(thousand) + ' Thousand ';
  if (hundred > 0) words += inWords(hundred);

  return 'Rupees ' + words.trim() + ' Only';
}

function formatDate(val) {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
  } catch {}
  return String(val);
}

function formatCurrency(val) {
  if (val === undefined || val === null || isNaN(Number(val))) return '0.00';
  return Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function generatePurchasePrintHtml(purchase = {}, company = {}) {
  const companyName = company?.name || company?.print_name || 'BVC EXPORTS PRIVATE LIMITED';
  const companyAddress = company?.address || company?.address1 || 'Factory & Processing Plant, Industrial Estate, Tamil Nadu';
  const companyGst = company?.gst_number || company?.gst_no || '33AAAAA0000A1Z5';
  const companyPhone = company?.phone_off || company?.mobile1 || company?.phone || '+91 98765 43210';
  const companyEmail = company?.email || 'accounts@bvcexports.com';

  const invNo = purchase.inv_no || purchase.invoice_no || '—';
  const voucherNo = purchase.s_no ? `PUR-${String(purchase.s_no).padStart(4, '0')}` : (purchase.id ? `PUR-${String(purchase.id).padStart(4, '0')}` : '—');
  const invDate = formatDate(purchase.date || purchase.invoice_date);
  const poNo = purchase.po_no || purchase.source_order_no || 'Direct Purchase';
  const godown = purchase.godown_name || purchase.godown || 'Main Raw Material Godown';
  const paymentMode = purchase.payment_mode || 'Credit';
  const vehicleNo = purchase.vehicle_no || purchase.lorry_no || '—';
  const driverName = purchase.driver_name || purchase.driver || '—';
  const driverPhone = purchase.driver_phone || '—';
  const transport = purchase.transport || purchase.transporter || '—';

  const supplierName = purchase.supplier_name || purchase.supplier_print_name || purchase.supplier || '—';
  const supplierAddress = purchase.address || purchase.supplier_address || '—';
  const supplierGst = purchase.supplier_gstin || purchase.gst_no || purchase.gst_number || '—';
  const supplierPhone = purchase.supplier_phone || purchase.mobile1 || purchase.phone || '—';

  // Normalize items array
  let items = [];
  if (Array.isArray(purchase.items) && purchase.items.length > 0) {
    items = purchase.items;
  } else {
    // Single item from purchase list row
    items = [{
      item_name: purchase.item_name || purchase.item || 'Item',
      lot_no: purchase.lot_no || '—',
      qty: purchase.qty ?? 1,
      weight: purchase.per_unit_weight ?? purchase.weight ?? 0,
      total_weight: purchase.total_weight ?? (Number(purchase.qty || 1) * Number(purchase.weight || 0)),
      rate: purchase.rate ?? 0,
      base_amount: purchase.base_amount ?? ((purchase.qty || 1) * (purchase.rate || 0)),
      tax_percent: purchase.tax_percent ?? purchase.tax_rate ?? purchase.tax ?? 0,
      tax_amount: purchase.tax_amount ?? 0,
      amount: purchase.grand_total ?? purchase.amount ?? 0
    }];
  }

  // Deductions if any
  const deductions = Array.isArray(purchase.deductions) ? purchase.deductions : [];
  let totalDeductionAmt = 0;
  deductions.forEach(d => {
    totalDeductionAmt += parseFloat(d.amount || d.deduction_amount || 0);
  });

  // Calculate totals
  let totalQty = 0;
  let totalGrossWt = 0;
  let totalTaxable = 0;
  let totalTax = 0;
  let grandTotal = 0;

  const itemRowsHtml = items.map((item, idx) => {
    const qty = parseFloat(item.qty || 0);
    const unitWt = parseFloat(item.per_unit_weight || item.weight || 0);
    const totWt = parseFloat(item.total_weight || (qty * unitWt) || 0);
    const rate = parseFloat(item.rate || 0);
    const taxableVal = item.base_amount !== undefined ? parseFloat(item.base_amount) : (qty * rate);
    const taxPct = parseFloat(item.tax_percent || item.tax_rate || 0);
    const taxAmt = item.tax_amount !== undefined ? parseFloat(item.tax_amount) : ((taxableVal * taxPct) / 100);
    const rowTotal = item.amount !== undefined ? parseFloat(item.amount) : (taxableVal + taxAmt);

    totalQty += qty;
    totalGrossWt += totWt;
    totalTaxable += taxableVal;
    totalTax += taxAmt;
    grandTotal += rowTotal;

    return `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 12px;">
        <td style="padding: 8px; text-align: center; border: 1px solid #cbd5e1; font-weight: 600;">${idx + 1}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1;">
          <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${item.item_name || '—'}</div>
        </td>
        <td style="padding: 8px; text-align: center; border: 1px solid #cbd5e1; font-family: 'Courier New', monospace; font-weight: 700; color: #1e40af; background: #eff6ff;">
          ${item.lot_no || '—'}
        </td>
        <td style="padding: 8px; text-align: right; border: 1px solid #cbd5e1; font-weight: 700;">
          ${qty.toLocaleString('en-IN')}
        </td>
        <td style="padding: 8px; text-align: right; border: 1px solid #cbd5e1;">
          ${unitWt > 0 ? unitWt.toFixed(2) + ' kg' : '—'}
        </td>
        <td style="padding: 8px; text-align: right; border: 1px solid #cbd5e1; font-weight: 600;">
          ${totWt > 0 ? totWt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kg' : '—'}
        </td>
        <td style="padding: 8px; text-align: right; border: 1px solid #cbd5e1;">
          ₹${formatCurrency(rate)}
        </td>
        <td style="padding: 8px; text-align: right; border: 1px solid #cbd5e1; font-weight: 600;">
          ₹${formatCurrency(taxableVal)}
        </td>
        <td style="padding: 8px; text-align: right; border: 1px solid #cbd5e1;">
          ${taxPct > 0 ? `${taxPct}% (₹${formatCurrency(taxAmt)})` : '0%'}
        </td>
        <td style="padding: 8px; text-align: right; border: 1px solid #cbd5e1; font-weight: 700; color: #0f172a;">
          ₹${formatCurrency(rowTotal)}
        </td>
      </tr>
    `;
  }).join('');

  const finalPayable = Math.max(0, grandTotal - totalDeductionAmt);
  const amountInWords = numberToWords(finalPayable);

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; max-width: 900px; margin: 0 auto; padding: 16px; line-height: 1.4; background: #ffffff;">
      
      <!-- HEADER -->
      <div style="border-bottom: 2.5px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #1e3a8a; letter-spacing: 0.5px; text-transform: uppercase;">
            ${companyName}
          </h1>
          <div style="font-size: 12px; color: #475569; margin-top: 3px; max-width: 550px;">
            ${companyAddress}
          </div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
            <strong>GSTIN:</strong> ${companyGst} &nbsp;|&nbsp; <strong>Phone:</strong> ${companyPhone} &nbsp;|&nbsp; <strong>Email:</strong> ${companyEmail}
          </div>
        </div>
        <div style="text-align: right;">
          <div style="background: #1e3a8a; color: #ffffff; padding: 6px 14px; border-radius: 4px; font-weight: 700; font-size: 13px; letter-spacing: 0.8px; text-transform: uppercase; display: inline-block;">
            PURCHASE INWARD VOUCHER
          </div>
          <div style="font-size: 11px; color: #64748b; margin-top: 5px; font-weight: 600;">
            Goods Receipt Note (GRN)
          </div>
        </div>
      </div>

      <!-- 2-COLUMN VENDOR & VOUCHER DETAILS -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
        <tr>
          <!-- Column 1: Supplier / Vendor -->
          <td style="width: 50%; vertical-align: top; padding: 12px; border-right: 1px solid #cbd5e1; background: #f8fafc;">
            <div style="font-size: 11px; font-weight: 700; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px;">
              SUPPLIER / VENDOR DETAILS
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <tr>
                <td style="padding: 3px 0; width: 32%; color: #64748b; font-weight: 600;">Supplier Name:</td>
                <td style="padding: 3px 0; font-weight: 700; color: #0f172a; font-size: 13px;">${supplierName}</td>
              </tr>
              <tr>
                <td style="padding: 3px 0; color: #64748b; font-weight: 600;">Address:</td>
                <td style="padding: 3px 0; color: #334155;">${supplierAddress || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 3px 0; color: #64748b; font-weight: 600;">GSTIN:</td>
                <td style="padding: 3px 0; font-weight: 700; color: #0f172a; font-family: monospace;">${supplierGst}</td>
              </tr>
              <tr>
                <td style="padding: 3px 0; color: #64748b; font-weight: 600;">Contact / Phone:</td>
                <td style="padding: 3px 0; color: #334155;">${supplierPhone}</td>
              </tr>
              <tr>
                <td style="padding: 3px 0; color: #64748b; font-weight: 600;">Transport / Vehicle:</td>
                <td style="padding: 3px 0; color: #334155; font-weight: 600;">${vehicleNo} ${transport !== '—' ? `(${transport})` : ''}</td>
              </tr>
            </table>
          </td>

          <!-- Column 2: Invoice & Inward Meta -->
          <td style="width: 50%; vertical-align: top; padding: 12px; background: #f8fafc;">
            <div style="font-size: 11px; font-weight: 700; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px;">
              INVOICE &amp; INWARD METADATA
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <tr>
                <td style="padding: 3px 0; width: 38%; color: #64748b; font-weight: 600;">Voucher / S.No:</td>
                <td style="padding: 3px 0; font-weight: 700; color: #1e40af; font-size: 13px;">${voucherNo}</td>
              </tr>
              <tr>
                <td style="padding: 3px 0; color: #64748b; font-weight: 600;">Supplier Invoice No:</td>
                <td style="padding: 3px 0; font-weight: 700; color: #0f172a; font-size: 13px; font-family: monospace;">${invNo}</td>
              </tr>
              <tr>
                <td style="padding: 3px 0; color: #64748b; font-weight: 600;">Invoice / Inward Date:</td>
                <td style="padding: 3px 0; font-weight: 700; color: #0f172a;">${invDate}</td>
              </tr>
              <tr>
                <td style="padding: 3px 0; color: #64748b; font-weight: 600;">Purchase Order Ref:</td>
                <td style="padding: 3px 0; color: #334155; font-weight: 600;">${poNo}</td>
              </tr>
              <tr>
                <td style="padding: 3px 0; color: #64748b; font-weight: 600;">Destination Godown:</td>
                <td style="padding: 3px 0; color: #0f172a; font-weight: 600;">${godown}</td>
              </tr>
              <tr>
                <td style="padding: 3px 0; color: #64748b; font-weight: 600;">Payment Mode:</td>
                <td style="padding: 3px 0; color: #334155;">${paymentMode}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- MAIN ITEM DETAILS TABLE -->
      <div style="font-size: 12px; font-weight: 700; color: #1e3a8a; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">
        PURCHASED ITEMS &amp; WEIGHT PARTICULARS
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; border: 1px solid #cbd5e1;">
        <thead>
          <tr style="background-color: #1e3a8a; color: #ffffff; font-size: 12px;">
            <th style="padding: 8px 6px; border: 1px solid #1e3a8a; text-align: center; width: 35px;">#</th>
            <th style="padding: 8px 10px; border: 1px solid #1e3a8a; text-align: left;">Item Description / Material</th>
            <th style="padding: 8px 10px; border: 1px solid #1e3a8a; text-align: center; width: 100px;">Lot No</th>
            <th style="padding: 8px 8px; border: 1px solid #1e3a8a; text-align: right; width: 75px;">Qty (Bags)</th>
            <th style="padding: 8px 8px; border: 1px solid #1e3a8a; text-align: right; width: 85px;">Unit Wt</th>
            <th style="padding: 8px 8px; border: 1px solid #1e3a8a; text-align: right; width: 95px;">Total Net Wt</th>
            <th style="padding: 8px 8px; border: 1px solid #1e3a8a; text-align: right; width: 85px;">Rate (₹)</th>
            <th style="padding: 8px 8px; border: 1px solid #1e3a8a; text-align: right; width: 95px;">Taxable (₹)</th>
            <th style="padding: 8px 8px; border: 1px solid #1e3a8a; text-align: right; width: 95px;">Tax Amount</th>
            <th style="padding: 8px 8px; border: 1px solid #1e3a8a; text-align: right; width: 105px;">Total (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${itemRowsHtml}
        </tbody>
        <tfoot>
          <tr style="background-color: #f1f5f9; font-weight: 700; font-size: 12px; border-top: 2px solid #94a3b8;">
            <td colspan="3" style="padding: 8px; text-align: right; border: 1px solid #cbd5e1;">TOTALS:</td>
            <td style="padding: 8px; text-align: right; border: 1px solid #cbd5e1; font-weight: 800; color: #1e3a8a;">${totalQty.toLocaleString('en-IN')}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #cbd5e1;">—</td>
            <td style="padding: 8px; text-align: right; border: 1px solid #cbd5e1; font-weight: 800; color: #1e3a8a;">${totalGrossWt > 0 ? totalGrossWt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kg' : '—'}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #cbd5e1;">—</td>
            <td style="padding: 8px; text-align: right; border: 1px solid #cbd5e1; font-weight: 800;">₹${formatCurrency(totalTaxable)}</td>
            <td style="padding: 8px; text-align: right; border: 1px solid #cbd5e1; font-weight: 800;">₹${formatCurrency(totalTax)}</td>
            <td style="padding: 8px; text-align: right; border: 1px solid #cbd5e1; font-weight: 800; color: #1e3a8a; font-size: 13px;">₹${formatCurrency(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>

      <!-- SUMMARY & AMOUNT IN WORDS -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <tr>
          <!-- Left: Amount in Words & Notes -->
          <td style="width: 60%; vertical-align: top; padding-right: 14px;">
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 10px 12px; margin-bottom: 10px;">
              <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Amount in Words:</div>
              <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 2px;">
                ${amountInWords}
              </div>
            </div>

            ${purchase.remarks ? `
              <div style="font-size: 11px; color: #475569; padding: 6px 10px; background: #fffbeb; border: 1px solid #fef08a; border-radius: 4px;">
                <strong>Inward Remarks:</strong> ${purchase.remarks}
              </div>
            ` : ''}
          </td>

          <!-- Right: Detailed Totals Box -->
          <td style="width: 40%; vertical-align: top;">
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; background: #ffffff; font-size: 12px;">
              <tr>
                <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Subtotal (Taxable Value):</td>
                <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600;">₹${formatCurrency(totalTaxable)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Total GST / Tax:</td>
                <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600;">₹${formatCurrency(totalTax)}</td>
              </tr>
              ${totalDeductionAmt > 0 ? `
                <tr>
                  <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; color: #dc2626;">Deductions:</td>
                  <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #dc2626;">-₹${formatCurrency(totalDeductionAmt)}</td>
                </tr>
              ` : ''}
              <tr style="background: #a9afbf; color: #ffffff; font-size: 14px; font-weight: 800;">
                <td style="padding: 8px 10px;">GRAND TOTAL:</td>
                <td style="padding: 8px 10px; text-align: right;">₹${formatCurrency(finalPayable)}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- SIGNATURE BLOCKS -->
      <div style="margin-top: 28px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; text-align: center; font-size: 11px;">
        <div style="border-top: 1.5px dashed #94a3b8; padding-top: 8px;">
          <div style="font-weight: 700; color: #0f172a;">STORE / INWARD IN-CHARGE</div>
          <div style="color: #64748b; font-size: 10px; margin-top: 2px;">Received &amp; Weighed Goods</div>
        </div>
        <div style="border-top: 1.5px dashed #94a3b8; padding-top: 8px;">
          <div style="font-weight: 700; color: #0f172a;">QC LAB INSPECTOR</div>
          <div style="color: #64748b; font-size: 10px; margin-top: 2px;">Quality Checked &amp; Sampled</div>
        </div>
        <div style="border-top: 1.5px dashed #94a3b8; padding-top: 8px;">
          <div style="font-weight: 700; color: #0f172a;">AUTHORIZED SIGNATORY</div>
          <div style="color: #64748b; font-size: 10px; margin-top: 2px;">Accounts / Purchase Dept</div>
        </div>
      </div>

      <!-- FOOTER TIMESTAMP -->
      <div style="margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 6px; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between;">
        <span>System Generated Purchase Inward Voucher &bull; BVC Inventory ERP</span>
        <span>Printed On: ${new Date().toLocaleString('en-IN')}</span>
      </div>

    </div>
  `;
}
