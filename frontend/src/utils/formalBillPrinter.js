import { printHtml } from './printHelper';

/**
 * Converts a numeric amount to Indian currency words
 */
export function numberToIndianWords(amount) {
  const num = Math.round(Math.abs(Number(amount) || 0));
  if (num === 0) return 'Zero Rupees Only';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(n) {
    if (n < 20) return a[n];
    const digit = n % 10;
    if (n < 100) return b[Math.floor(n / 10)] + (digit ? ' ' + a[digit] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + inWords(n % 100) : '');
    return '';
  }

  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const remainder = num % 1000;

  let str = '';
  if (crore > 0) str += inWords(crore) + ' Crore ';
  if (lakh > 0) str += inWords(lakh) + ' Lakh ';
  if (thousand > 0) str += inWords(thousand) + ' Thousand ';
  if (remainder > 0) str += inWords(remainder);

  return str.trim() + ' Rupees Only';
}

/**
 * Format Indian currency number
 */
export function formatINR(val) {
  const num = Number(val) || 0;
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Universal Formal Sales & Distribution Bill Generator & Printer
 */
export function printFormalSalesBill({
  documentType = 'TAX INVOICE', // 'QUOTATION' | 'SALES ORDER' | 'TAX INVOICE' | 'EXPORT ORDER' | 'EXPORT INVOICE' | 'SALES RETURN'
  record = {},
  company = null,
  items = [],
  totals = {}
}) {
  const compName = company?.name || 'BVC AGRO & FOODS PVT LTD';
  const compGstin = company?.gstin || company?.gst_no || '33AABCB1234F1Z8';
  const compState = company?.state || 'Tamil Nadu';
  const compStateCode = company?.state_code || '33';
  const compAddress = company?.address || '124, Industrial Estate, CMP, Madurai Highway, Tamil Nadu - 625001';
  const compPhone = company?.phone || company?.mobile || '+91 98420 12345';
  const compEmail = company?.email || 'accounts@bvcerp.com';

  const docNo = record.bill_no || record.s_no || record.sNo || record.inv_no || record.id || '---';
  const docDate = record.date ? String(record.date).substring(0, 10) : new Date().toISOString().split('T')[0];
  const customerName = record.customer_name || record.customer || record.consignee || record.buyer_other || 'Valued Customer';
  const customerAddress = record.address || record.customer_address || 'As per Master Registry';
  const customerGstin = record.gst_no || record.gst_number || record.customer_gstin || 'Unregistered / Consumer';
  const payType = record.pay_type || record.paymentTerms || 'Cash';
  const taxType = record.tax_type || 'Exclusive';
  const isWithoutTax = String(taxType).toLowerCase().includes('without');
  const isInterState = Boolean(
    record.is_interstate || 
    (record.address && !record.address.toLowerCase().includes('tamil nadu') && !record.address.toLowerCase().includes('tn'))
  );

  // Normalize line items
  let lineItems = [];
  if (Array.isArray(items) && items.length > 0) {
    lineItems = items;
  } else if (Array.isArray(record.items) && record.items.length > 0) {
    lineItems = record.items;
  } else if (record.item_name) {
    lineItems = [{
      item_name: record.item_name,
      lot_no: record.lot_no || '',
      qty: record.qty || 1,
      rate: record.rate || record.amount || 0,
      disc: record.disc_perc || record.disc || 0,
      tax: record.tax_perc || record.tax_rate || record.tax_percent || 5,
      amount: record.total_amt || record.amount || 0
    }];
  }

  // Calculate row financial values
  let grossTotal = 0;
  let totalDiscount = 0;
  let totalTaxable = 0;
  let totalTax = 0;

  const processedRows = lineItems.map((it, idx) => {
    const qty = parseFloat(it.qty) || 0;
    const rate = parseFloat(it.rate) || 0;
    const gross = qty * rate;
    const discPct = parseFloat(it.disc ?? it.disc_percent ?? 0) || 0;
    const discAmt = gross * (discPct / 100);
    const taxable = Math.max(0, gross - discAmt);
    const taxRate = isWithoutTax ? 0 : (parseFloat(it.tax ?? it.tax_rate ?? record.tax_percent ?? 5) || 0);
    const rowTax = taxable * (taxRate / 100);
    const rowTotal = taxable + rowTax;

    grossTotal += gross;
    totalDiscount += discAmt;
    totalTaxable += taxable;
    totalTax += rowTax;

    return {
      sno: idx + 1,
      name: it.item_name || it.description || 'Commodity Item',
      hsn: it.hsn_code || it.hsn || '0713',
      lotNo: it.lot_no || it.lotNo || record.lot_no || '---',
      qty: qty,
      unit: it.unit || 'KG',
      rate: rate,
      gross: gross,
      discPct: discPct,
      discAmt: discAmt,
      taxable: taxable,
      taxRate: taxRate,
      rowTax: rowTax,
      rowTotal: rowTotal
    };
  });

  // Totals reconciliation
  const billAmt = parseFloat(record.bill_amt) || totalTaxable;
  const taxAmt = parseFloat(record.tax_amt) || totalTax;
  const primaryTaxRate = parseFloat(record.tax_percent) || (processedRows[0]?.taxRate || 5);
  const deductionsAmt = parseFloat(record.deduction_amount) || 0;
  const grandTotal = parseFloat(record.total_amt || record.grand_total) || (billAmt + taxAmt - deductionsAmt);

  const halfRate = (primaryTaxRate / 2).toFixed(1).replace(/\.0$/, '');
  const cgstAmt = !isInterState && !isWithoutTax ? (taxAmt / 2) : 0;
  const sgstAmt = !isInterState && !isWithoutTax ? (taxAmt / 2) : 0;
  const igstAmt = isInterState && !isWithoutTax ? taxAmt : 0;

  const titleBadge = documentType.toUpperCase();

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; max-width: 900px; margin: 0 auto; padding: 20px; font-size: 12px; line-height: 1.4;">
      
      <!-- Top Title & Badge -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1f4fb2; padding-bottom: 12px; margin-bottom: 14px;">
        <div>
          <h1 style="margin: 0; color: #1f4fb2; font-size: 22px; font-weight: 800; letter-spacing: 0.5px;">${compName}</h1>
          <div style="color: #64748b; font-size: 11px; margin-top: 2px;">${compAddress}</div>
          <div style="color: #475569; font-size: 11px;"><strong>GSTIN:</strong> ${compGstin} | <strong>State:</strong> ${compState} (Code: ${compStateCode}) | <strong>Ph:</strong> ${compPhone}</div>
        </div>
        <div style="text-align: right;">
          <div style="display: inline-block; background-color: #1f4fb2; color: #ffffff; padding: 5px 14px; border-radius: 4px; font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">
            ${titleBadge}
          </div>
          <div style="font-size: 10px; color: #64748b; margin-top: 4px; font-weight: bold;">ORIGINAL FOR RECIPIENT</div>
        </div>
      </div>

      <!-- Document Reference & Customer Grid -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; border: 1px solid #cbd5e1;">
        <tbody>
          <tr style="background-color: #f8fafc;">
            <td style="width: 50%; padding: 10px; border-right: 1px solid #cbd5e1; vertical-align: top;">
              <div style="font-size: 11px; color: #1f4fb2; font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">Billed To / Customer Details</div>
              <div style="font-size: 14px; font-weight: 700; color: #0f172a;">${customerName}</div>
              <div style="color: #475569; margin-top: 3px; white-space: pre-line;">${customerAddress}</div>
              <div style="margin-top: 5px;"><strong>GSTIN / UIN:</strong> ${customerGstin}</div>
              <div><strong>Place of Supply:</strong> ${isInterState ? 'Other State' : compState} (Code: ${isInterState ? 'Other' : compStateCode})</div>
            </td>
            <td style="width: 50%; padding: 10px; vertical-align: top;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 3px 0; font-weight: bold; color: #475569; width: 45%;">${titleBadge} No:</td>
                  <td style="padding: 3px 0; font-weight: 800; color: #1f4fb2; font-size: 13px;">${docNo}</td>
                </tr>
                <tr>
                  <td style="padding: 3px 0; font-weight: bold; color: #475569;">Date:</td>
                  <td style="padding: 3px 0; font-weight: 700;">${docDate}</td>
                </tr>
                <tr>
                  <td style="padding: 3px 0; font-weight: bold; color: #475569;">Payment Mode / Terms:</td>
                  <td style="padding: 3px 0;">${payType}</td>
                </tr>
                <tr>
                  <td style="padding: 3px 0; font-weight: bold; color: #475569;">Tax Classification:</td>
                  <td style="padding: 3px 0; font-weight: 600;">${isWithoutTax ? 'Tax Exempt' : (isInterState ? 'Inter-State IGST' : 'Intra-State CGST+SGST')}</td>
                </tr>
                ${record.lorry_no ? `
                <tr>
                  <td style="padding: 3px 0; font-weight: bold; color: #475569;">Vehicle / Transport:</td>
                  <td style="padding: 3px 0;">${record.lorry_no}</td>
                </tr>` : ''}
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Itemized Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 11px;">
        <thead>
          <tr style="background-color: #1f4fb2; color: #ffffff;">
            <th style="border: 1px solid #1f4fb2; padding: 7px 5px; text-align: center; width: 35px;">#</th>
            <th style="border: 1px solid #1f4fb2; padding: 7px 8px; text-align: left;">Item Description</th>
            <th style="border: 1px solid #1f4fb2; padding: 7px 6px; text-align: center; width: 55px;">HSN</th>
            <th style="border: 1px solid #1f4fb2; padding: 7px 6px; text-align: center; width: 65px;">Lot No</th>
            <th style="border: 1px solid #1f4fb2; padding: 7px 6px; text-align: right; width: 60px;">Qty</th>
            <th style="border: 1px solid #1f4fb2; padding: 7px 6px; text-align: right; width: 65px;">Rate (₹)</th>
            <th style="border: 1px solid #1f4fb2; padding: 7px 6px; text-align: right; width: 75px;">Gross (₹)</th>
            <th style="border: 1px solid #1f4fb2; padding: 7px 6px; text-align: right; width: 65px;">Disc %</th>
            <th style="border: 1px solid #1f4fb2; padding: 7px 6px; text-align: right; width: 80px;">Taxable (₹)</th>
            <th style="border: 1px solid #1f4fb2; padding: 7px 6px; text-align: right; width: 60px;">GST %</th>
            <th style="border: 1px solid #1f4fb2; padding: 7px 8px; text-align: right; width: 85px;">Total (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${processedRows.map(row => `
            <tr style="border-bottom: 1px solid #cbd5e1;">
              <td style="border: 1px solid #cbd5e1; padding: 6px 5px; text-align: center;">${row.sno}</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: 600; color: #0f172a;">${row.name}</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 6px; text-align: center; color: #64748b;">${row.hsn}</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 6px; text-align: center;">${row.lotNo}</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 6px; text-align: right; font-weight: 700;">${row.qty.toLocaleString()} ${row.unit}</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 6px; text-align: right;">${row.rate.toFixed(2)}</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 6px; text-align: right;">${row.gross.toFixed(2)}</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 6px; text-align: right; color: ${row.discAmt > 0 ? '#dc2626' : '#64748b'};">
                ${row.discPct > 0 ? `${row.discPct}%` : '-'}
              </td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 6px; text-align: right; font-weight: 600;">${row.taxable.toFixed(2)}</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 6px; text-align: right; color: #1f4fb2; font-weight: 700;">
                ${isWithoutTax ? '0%' : (isInterState ? `IGST ${row.taxRate}%` : `${row.taxRate}%`)}
              </td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; font-weight: 700; color: #0f172a;">${row.rowTotal.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- Split Layout: Tax Analysis Table (Left) + Bill Calculation Summary (Right) -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <tbody>
          <tr>
            <!-- Left: Tax Breakdown Box -->
            <td style="width: 55%; vertical-align: top; padding-right: 12px;">
              <div style="border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden;">
                <div style="background-color: #f1f5f9; padding: 6px 10px; font-weight: 700; color: #1e293b; font-size: 11px; border-bottom: 1px solid #cbd5e1;">
                  GST TAX RATE ANALYSIS & BREAKUP
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                  <thead>
                    <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                      <th style="padding: 5px; text-align: left;">HSN/SAC</th>
                      <th style="padding: 5px; text-align: right;">Taxable (₹)</th>
                      ${!isInterState ? `
                        <th style="padding: 5px; text-align: right;">CGST (${halfRate}%)</th>
                        <th style="padding: 5px; text-align: right;">SGST (${halfRate}%)</th>
                      ` : `
                        <th style="padding: 5px; text-align: right;">IGST (${primaryTaxRate}%)</th>
                      `}
                      <th style="padding: 5px; text-align: right;">Tax Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style="padding: 6px 5px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">0713</td>
                      <td style="padding: 6px 5px; border-bottom: 1px solid #e2e8f0; text-align: right;">${totalTaxable.toFixed(2)}</td>
                      ${!isInterState ? `
                        <td style="padding: 6px 5px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #0369a1;">${cgstAmt.toFixed(2)}</td>
                        <td style="padding: 6px 5px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #0369a1;">${sgstAmt.toFixed(2)}</td>
                      ` : `
                        <td style="padding: 6px 5px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #0369a1;">${igstAmt.toFixed(2)}</td>
                      `}
                      <td style="padding: 6px 5px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700;">${taxAmt.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Bank Details -->
              <div style="border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px 10px; margin-top: 10px; background-color: #f8fafc; font-size: 11px;">
                <div style="font-weight: 700; color: #1f4fb2; margin-bottom: 3px;">COMPANY BANK SETTLEMENT DETAILS</div>
                <div><strong>Bank:</strong> State Bank of India | <strong>A/C:</strong> 384729104829</div>
                <div><strong>IFSC Code:</strong> SBIN0001234 | <strong>Branch:</strong> Commercial Banking Branch</div>
              </div>
            </td>

            <!-- Right: Bill Summary Totals Box -->
            <td style="width: 45%; vertical-align: top;">
              <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; font-size: 12px;">
                <tbody>
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 6px 10px; color: #475569;">Gross Item Total:</td>
                    <td style="padding: 6px 10px; text-align: right; font-weight: 600;">${formatINR(grossTotal)}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 6px 10px; color: #dc2626;">Trade Discount (-):</td>
                    <td style="padding: 6px 10px; text-align: right; color: #dc2626; font-weight: 600;">-${formatINR(totalDiscount)}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #cbd5e1; background-color: #f8fafc;">
                    <td style="padding: 6px 10px; font-weight: 700; color: #0f172a;">Taxable Bill Amount:</td>
                    <td style="padding: 6px 10px; text-align: right; font-weight: 700; color: #0f172a;">${formatINR(billAmt)}</td>
                  </tr>
                  ${!isWithoutTax && !isInterState ? `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 5px 10px; color: #0369a1;">CGST (${halfRate}%):</td>
                      <td style="padding: 5px 10px; text-align: right; color: #0369a1;">${formatINR(cgstAmt)}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 5px 10px; color: #0369a1;">SGST (${halfRate}%):</td>
                      <td style="padding: 5px 10px; text-align: right; color: #0369a1;">${formatINR(sgstAmt)}</td>
                    </tr>
                  ` : ''}
                  ${!isWithoutTax && isInterState ? `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 5px 10px; color: #0369a1;">IGST (${primaryTaxRate}%):</td>
                      <td style="padding: 5px 10px; text-align: right; color: #0369a1;">${formatINR(igstAmt)}</td>
                    </tr>
                  ` : ''}
                  <tr style="border-bottom: 1px solid #cbd5e1;">
                    <td style="padding: 6px 10px; font-weight: 600; color: #0284c7;">Total GST Tax:</td>
                    <td style="padding: 6px 10px; text-align: right; font-weight: 700; color: #0284c7;">${formatINR(taxAmt)}</td>
                  </tr>
                  ${deductionsAmt !== 0 ? `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 5px 10px; color: #64748b;">Other Charges / Deductions:</td>
                      <td style="padding: 5px 10px; text-align: right;">${deductionsAmt > 0 ? `-${formatINR(deductionsAmt)}` : `+${formatINR(Math.abs(deductionsAmt))}`}</td>
                    </tr>
                  ` : ''}
                  <tr style="background-color: #1f4fb2; color: #ffffff;">
                    <td style="padding: 9px 10px; font-weight: 800; font-size: 13px;">GRAND TOTAL:</td>
                    <td style="padding: 9px 10px; text-align: right; font-weight: 800; font-size: 14px;">${formatINR(grandTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Amount in Words -->
      <div style="border: 1px dashed #94a3b8; background-color: #f8fafc; padding: 8px 12px; border-radius: 4px; margin-bottom: 16px;">
        <span style="font-weight: bold; color: #475569;">Amount in Words: </span>
        <span style="font-weight: 800; color: #1e293b;">${numberToIndianWords(grandTotal)}</span>
      </div>

      <!-- Terms & Signature Footer -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 24px;">
        <tbody>
          <tr>
            <td style="width: 55%; vertical-align: top; font-size: 10px; color: #64748b; padding-right: 15px;">
              <div style="font-weight: bold; color: #334155; margin-bottom: 4px;">TERMS & CONDITIONS:</div>
              <div>1. All disputes are subject to local jurisdiction.</div>
              <div>2. Goods once sold will not be returned without authorized authorization.</div>
              <div>3. Certified that the particulars given above are true and correct.</div>
            </td>
            <td style="width: 45%; text-align: center; vertical-align: bottom;">
              <div style="font-weight: 700; color: #0f172a; margin-bottom: 45px;">For ${compName}</div>
              <div style="border-top: 1px solid #94a3b8; width: 80%; margin: 0 auto; padding-top: 4px; font-weight: 600; font-size: 11px;">
                Authorized Signatory
              </div>
            </td>
          </tr>
        </tbody>
      </table>

    </div>
  `;

  printHtml(html, `${documentType.replace(/\s+/g, '_')}_${docNo}`);
}
