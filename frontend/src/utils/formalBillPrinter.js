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
  items = []
}) {
  const compName = company?.name || 'BVC AGRO & FOODS PVT LTD';
  const compGstin = company?.gstin || company?.gst_no || '33AABCB1234F1Z8';
  const compState = company?.state || 'Tamil Nadu';
  const compStateCode = company?.state_code || '33';
  const compAddress = company?.address || '124, Industrial Estate, CMP, Madurai Highway, Tamil Nadu - 625001';
  const compPhone = company?.phone || company?.mobile || '+91 98420 12345';

  const docNo = record.bill_no || record.s_no || record.sNo || record.inv_no || record.id || '---';
  const docDate = record.date ? String(record.date).substring(0, 10) : new Date().toISOString().split('T')[0];
  const dueDate = record.due_date ? String(record.due_date).substring(0, 10) : '';
  const customerName = record.customer_name || record.customer || record.consignee || record.buyer_other || 'Valued Customer';
  const billingAddress = record.billing_address || record.address || record.customer_address || 'As per Master Registry';
  const shippingAddress = record.shipping_address || record.delivery_location || billingAddress;
  const customerGstin = record.customer_gstin || record.gst_no || record.gst_number || 'Unregistered / Consumer';
  const partyState = record.party_state || '';
  const partyStateCode = record.party_state_code || '';
  const payType = record.pay_type || record.paymentTerms || 'Credit';
  const taxType = record.tax_type || 'Exclusive';
  const isWithoutTax = String(taxType).toLowerCase().includes('without');
  const isInterState = Boolean(
    record.is_interstate ||
    (partyStateCode && String(partyStateCode) !== String(compStateCode)) ||
    (partyState && !partyState.toLowerCase().includes(compState.toLowerCase())) ||
    (!partyState && billingAddress && !billingAddress.toLowerCase().includes('tamil nadu') && !billingAddress.toLowerCase().includes('tn'))
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
      weight: record.weight || 50,
      net_product_wt: record.product_net_weight || record.total_wt || 0,
      rate: record.rate || record.amount || 0,
      rate_type: record.rate_type || 'Per Kg',
      disc: record.disc_perc || record.disc || 0,
      tax: record.tax_perc || record.tax_rate || record.tax_percent || 5,
      amount: record.total_amt || record.amount || 0
    }];
  }

  let grossTotal = 0;
  let totalDiscount = 0;
  let totalTaxable = 0;
  let totalTax = 0;
  let totalQtySum = 0;
  let totalNetWtSum = 0;

  const processedRows = lineItems.map((it, idx) => {
    const qty = parseFloat(it.qty) || 0;
    const unitWt = parseFloat(it.weight) || 0;
    const netProductWt = parseFloat(it.net_product_wt ?? it.total_wt ?? it.totalWt) || (qty * unitWt);
    const rate = parseFloat(it.rate) || 0;
    const rateType = it.rate_type || 'Per Kg';
    const billUnits = (rateType === 'Per Kg' && netProductWt > 0) ? netProductWt : qty;
    const gross = billUnits * rate;
    const discPct = parseFloat(it.disc ?? it.disc_perc ?? it.disc_percent ?? 0) || 0;
    const discAmt = gross * (discPct / 100);
    const netAfterDisc = Math.max(0, gross - discAmt);
    const taxRate = isWithoutTax ? 0 : (parseFloat(it.tax ?? it.gst_rate ?? it.tax_perc ?? it.tax_rate ?? record.tax_percent ?? 5) || 0);
    const isInclusive = String(taxType).toLowerCase().includes('inclusive');

    let taxable = netAfterDisc;
    let rowTax = 0;
    let rowTotal = netAfterDisc;
    if (!isWithoutTax && taxRate > 0) {
      if (isInclusive) {
        taxable = netAfterDisc / (1 + taxRate / 100);
        rowTax = netAfterDisc - taxable;
        rowTotal = netAfterDisc;
      } else {
        taxable = netAfterDisc;
        rowTax = taxable * (taxRate / 100);
        rowTotal = taxable + rowTax;
      }
    }

    totalQtySum += qty;
    totalNetWtSum += netProductWt;
    grossTotal += gross;
    totalDiscount += discAmt;
    totalTaxable += taxable;
    totalTax += rowTax;

    return {
      sno: idx + 1,
      name: it.item_name || it.description || 'Commodity Item',
      hsn: it.hsn_code || it.hsn || '0713',
      lotNo: it.lot_no || it.lotNo || record.lot_no || '---',
      godown: it.godown_name || '',
      qty,
      uom: it.uom || 'Bags',
      netProductWt,
      rate,
      rateType,
      gross,
      discPct,
      discAmt,
      taxable,
      taxRate,
      rowTax,
      rowTotal
    };
  });

  const billAmt = parseFloat(record.bill_amt) || totalTaxable;
  const taxAmt = isWithoutTax ? 0 : (parseFloat(record.tax_amt) || totalTax);
  const primaryTaxRate = parseFloat(record.tax_percent) || (processedRows[0]?.taxRate || 5);
  const halfRate = (primaryTaxRate / 2).toFixed(1).replace(/\.0$/, '');
  const cgstAmt = !isInterState && !isWithoutTax ? (parseFloat(record.cgst_amt) || (taxAmt / 2)) : 0;
  const sgstAmt = !isInterState && !isWithoutTax ? (parseFloat(record.sgst_amt) || (taxAmt / 2)) : 0;
  const igstAmt = isInterState && !isWithoutTax ? (parseFloat(record.igst_amt) || taxAmt) : 0;

  const freightAmt = parseFloat(record.freight_amount) || 0;
  const freightRecoveryAmt = parseFloat(record.freight_recovery_amt) ||
    ((record.freight_paid_by === 'Seller' && (record.recover_freight_on_invoice === 1 || record.recover_freight_on_invoice === true)) ? freightAmt : 0);
  const loadingChargesAmt = parseFloat(record.loading_charges_amt) || 0;
  const otherChargesAmt = parseFloat(record.other_charges) || 0;
  const tcsAmt = parseFloat(record.tcs_amount) || 0;
  const roundOffAmt = parseFloat(record.round_off) || 0;
  const deductionsAmt = parseFloat(record.deduction_amount) || 0;

  const computedGrand = billAmt + taxAmt + freightRecoveryAmt + loadingChargesAmt + otherChargesAmt + tcsAmt - deductionsAmt + roundOffAmt;
  const grandTotal = parseFloat(record.grand_total || record.total_amt) || computedGrand;

  const receivedAmt = parseFloat(record.received_amount) || 0;
  const advanceAdj = parseFloat(record.advance_adjusted) || 0;
  const balanceDue = Math.max(0, parseFloat(record.balance_receivable ?? (grandTotal - receivedAmt - advanceAdj)) || 0);

  const vGross = parseFloat(record.vehicle_gross_weight) || 0;
  const vTare = parseFloat(record.vehicle_tare_weight) || 0;
  const vNetLoad = parseFloat(record.net_load_weight) || (vGross > 0 ? Math.max(0, vGross - vTare) : 0);
  const pkgTare = parseFloat(record.package_tare_weight) || 0;

  const titleBadge = documentType.toUpperCase();

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; max-width: 920px; margin: 0 auto; padding: 18px; font-size: 12px; line-height: 1.4;">

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
          ${record.irn_no ? `<div style="font-size: 9px; color: #059669; margin-top: 2px; font-family: monospace;">IRN: ${record.irn_no}</div>` : ''}
        </div>
      </div>

      <!-- Document Reference & Billing/Shipping Grid -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; border: 1px solid #cbd5e1;">
        <tbody>
          <tr style="background-color: #f8fafc;">
            <td style="width: 34%; padding: 10px; border-right: 1px solid #cbd5e1; vertical-align: top;">
              <div style="font-size: 10px; color: #1f4fb2; font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">Billed To (Buyer)</div>
              <div style="font-size: 13px; font-weight: 700; color: #0f172a;">${customerName}</div>
              <div style="color: #475569; margin-top: 3px; white-space: pre-line; font-size: 11px;">${billingAddress}</div>
              <div style="margin-top: 4px; font-size: 11px;"><strong>GSTIN:</strong> ${customerGstin}</div>
              <div style="font-size: 11px;"><strong>Place of Supply:</strong> ${record.place_of_supply || `${partyState || (isInterState ? 'Other State' : compState)} (${partyStateCode || compStateCode})`}</div>
              ${record.phone ? `<div style="font-size: 11px;"><strong>Ph:</strong> ${record.phone}</div>` : ''}
            </td>
            <td style="width: 32%; padding: 10px; border-right: 1px solid #cbd5e1; vertical-align: top;">
              <div style="font-size: 10px; color: #0369a1; font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">Shipped To / Delivery</div>
              <div style="font-size: 12px; font-weight: 700; color: #0f172a;">${customerName}</div>
              <div style="color: #475569; margin-top: 3px; white-space: pre-line; font-size: 11px;">${shippingAddress}</div>
              ${record.eway_bill_no ? `<div style="margin-top: 5px; font-size: 11px;"><strong>E-Way Bill:</strong> ${record.eway_bill_no}</div>` : ''}
              ${record.delivery_challan_no ? `<div style="font-size: 11px;"><strong>Challan:</strong> ${record.delivery_challan_no}</div>` : ''}
            </td>
            <td style="width: 34%; padding: 10px; vertical-align: top;">
              <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <tr>
                  <td style="padding: 2px 0; font-weight: bold; color: #475569;">${titleBadge} No:</td>
                  <td style="padding: 2px 0; font-weight: 800; color: #1f4fb2; font-size: 13px;">${docNo}</td>
                </tr>
                <tr>
                  <td style="padding: 2px 0; font-weight: bold; color: #475569;">Date${dueDate ? ' / Due' : ''}:</td>
                  <td style="padding: 2px 0; font-weight: 700;">${docDate}${dueDate ? ` / ${dueDate}` : ''}</td>
                </tr>
                ${record.outpass_no ? `
                <tr>
                  <td style="padding: 2px 0; font-weight: bold; color: #475569;">Gate Outpass:</td>
                  <td style="padding: 2px 0; font-weight: 800; color: #0369a1; font-family: monospace;">${record.outpass_no}</td>
                </tr>` : ''}
                ${record.customer_po_no || record.p_o_no ? `
                <tr>
                  <td style="padding: 2px 0; font-weight: bold; color: #475569;">Customer PO:</td>
                  <td style="padding: 2px 0;">${record.customer_po_no || record.p_o_no}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding: 2px 0; font-weight: bold; color: #475569;">Pay / Terms:</td>
                  <td style="padding: 2px 0;">${payType}${record.payment_terms ? ` (${record.payment_terms})` : ''}</td>
                </tr>
                <tr>
                  <td style="padding: 2px 0; font-weight: bold; color: #475569;">Vehicle / Trans:</td>
                  <td style="padding: 2px 0;">${record.lorry_no || 'Direct'}${record.pur_trans ? ` (${record.pur_trans})` : ''}</td>
                </tr>
                ${record.lr_no ? `
                <tr>
                  <td style="padding: 2px 0; font-weight: bold; color: #475569;">LR / GR No:</td>
                  <td style="padding: 2px 0;">${record.lr_no}${record.lr_date ? ` (${String(record.lr_date).substring(0, 10)})` : ''}</td>
                </tr>` : ''}
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Weighment Summary Bar (shown when vehicle weighment or package tare recorded) -->
      ${(vGross > 0 || vNetLoad > 0 || pkgTare > 0) ? `
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px; padding: 8px 12px; margin-bottom: 12px; font-size: 11px;">
        <div><span style="color: #475569;">Vehicle Gross Wt:</span> <strong style="color: #0f172a;">${vGross.toLocaleString('en-IN')} kg</strong></div>
        <div><span style="color: #475569;">Vehicle Tare Wt:</span> <strong style="color: #0f172a;">${vTare.toLocaleString('en-IN')} kg</strong></div>
        <div><span style="color: #1e40af;">Net Load Weight:</span> <strong style="color: #1e3a8a;">${vNetLoad.toLocaleString('en-IN')} kg</strong></div>
        <div><span style="color: #475569;">Product Net / Pkg Tare:</span> <strong>${totalNetWtSum.toLocaleString('en-IN')} / ${pkgTare.toLocaleString('en-IN')} kg</strong></div>
      </div>` : ''}

      <!-- Itemized Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 11px;">
        <thead>
          <tr style="background-color: #1f4fb2; color: #ffffff;">
            <th style="border: 1px solid #1f4fb2; padding: 7px 5px; text-align: center; width: 30px;">#</th>
            <th style="border: 1px solid #1f4fb2; padding: 7px 8px; text-align: left;">Item Description</th>
            <th style="border: 1px solid #1f4fb2; padding: 7px 6px; text-align: center; width: 52px;">HSN</th>
            <th style="border: 1px solid #1f4fb2; padding: 7px 6px; text-align: center; width: 65px;">Lot No</th>
            <th style="border: 1px solid #1f4fb2; padding: 7px 6px; text-align: right; width: 55px;">Qty</th>
            <th style="border: 1px solid #1f4fb2; padding: 7px 6px; text-align: right; width: 65px;">Net Wt (kg)</th>
            <th style="border: 1px solid #1f4fb2; padding: 7px 6px; text-align: right; width: 72px;">Rate (₹)</th>
            <th style="border: 1px solid #1f4fb2; padding: 7px 6px; text-align: right; width: 52px;">Disc %</th>
            <th style="border: 1px solid #1f4fb2; padding: 7px 6px; text-align: right; width: 78px;">Taxable (₹)</th>
            <th style="border: 1px solid #1f4fb2; padding: 7px 6px; text-align: right; width: 55px;">GST %</th>
            <th style="border: 1px solid #1f4fb2; padding: 7px 8px; text-align: right; width: 82px;">Total (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${processedRows.map(row => `
            <tr style="border-bottom: 1px solid #cbd5e1;">
              <td style="border: 1px solid #cbd5e1; padding: 6px 5px; text-align: center;">${row.sno}</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: 600; color: #0f172a;">
                ${row.name}
                ${row.godown ? `<div style="font-size: 9px; color: #64748b; font-weight: normal;">Godown: ${row.godown}</div>` : ''}
              </td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 6px; text-align: center; color: #64748b;">${row.hsn}</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 6px; text-align: center; font-family: monospace;">${row.lotNo}</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 6px; text-align: right; font-weight: 700;">${row.qty.toLocaleString('en-IN')} ${row.uom}</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 6px; text-align: right;">${row.netProductWt.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 6px; text-align: right;">
                ${row.rate.toFixed(2)}
                <div style="font-size: 9px; color: #64748b;">${row.rateType}</div>
              </td>
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
        <tfoot>
          <tr style="background: #f8fafc; font-weight: 700;">
            <td colspan="4" style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right;">SUB-TOTAL</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">${totalQtySum.toLocaleString('en-IN')}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">${totalNetWtSum.toLocaleString('en-IN', { maximumFractionDigits: 2 })} kg</td>
            <td colspan="2" style="border: 1px solid #cbd5e1; padding: 6px;"></td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">${billAmt.toFixed(2)}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px;"></td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right;">${(billAmt + taxAmt).toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Split Layout: Tax Analysis Table (Left) + Bill Calculation Summary (Right) -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
        <tbody>
          <tr>
            <td style="width: 53%; vertical-align: top; padding-right: 12px;">
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
                      <td style="padding: 6px 5px; border-bottom: 1px solid #e2e8f0; text-align: right;">${billAmt.toFixed(2)}</td>
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

              <!-- Bank Details & Payment Status -->
              <div style="border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px 10px; margin-top: 10px; background-color: #f8fafc; font-size: 11px;">
                <div style="font-weight: 700; color: #1f4fb2; margin-bottom: 3px;">COMPANY BANK & PAYMENT STATUS</div>
                <div><strong>Bank:</strong> State Bank of India | <strong>A/C:</strong> 384729104829 | <strong>IFSC:</strong> SBIN0001234</div>
                ${(receivedAmt > 0 || advanceAdj > 0) ? `
                  <div style="margin-top: 5px; padding-top: 4px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between;">
                    <span><strong>Paid:</strong> ${formatINR(receivedAmt)}${advanceAdj > 0 ? ` + Adv ${formatINR(advanceAdj)}` : ''}</span>
                    <span style="color: ${balanceDue > 0 ? '#b91c1c' : '#15803d'}; font-weight: 700;">Balance Due: ${formatINR(balanceDue)}</span>
                  </div>
                ` : ''}
                ${freightAmt > 0 ? `
                  <div style="margin-top: 3px; color: #475569;">
                    <strong>Freight:</strong> ${formatINR(freightAmt)} (${record.freight_paid_by || 'Buyer'} Bear${freightRecoveryAmt > 0 ? ' • Recovered on Invoice' : ''})
                  </div>
                ` : ''}
              </div>
            </td>

            <td style="width: 47%; vertical-align: top;">
              <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; font-size: 12px;">
                <tbody>
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 5px 10px; color: #475569;">Gross Item Total:</td>
                    <td style="padding: 5px 10px; text-align: right; font-weight: 600;">${formatINR(grossTotal)}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 5px 10px; color: #dc2626;">Trade Discount (-):</td>
                    <td style="padding: 5px 10px; text-align: right; color: #dc2626; font-weight: 600;">-${formatINR(totalDiscount)}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #cbd5e1; background-color: #f8fafc;">
                    <td style="padding: 5px 10px; font-weight: 700; color: #0f172a;">Taxable Bill Amount:</td>
                    <td style="padding: 5px 10px; text-align: right; font-weight: 700; color: #0f172a;">${formatINR(billAmt)}</td>
                  </tr>
                  ${!isWithoutTax && !isInterState ? `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 4px 10px; color: #0369a1;">CGST (${halfRate}%):</td>
                      <td style="padding: 4px 10px; text-align: right; color: #0369a1;">${formatINR(cgstAmt)}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 4px 10px; color: #0369a1;">SGST (${halfRate}%):</td>
                      <td style="padding: 4px 10px; text-align: right; color: #0369a1;">${formatINR(sgstAmt)}</td>
                    </tr>
                  ` : ''}
                  ${!isWithoutTax && isInterState ? `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 4px 10px; color: #0369a1;">IGST (${primaryTaxRate}%):</td>
                      <td style="padding: 4px 10px; text-align: right; color: #0369a1;">${formatINR(igstAmt)}</td>
                    </tr>
                  ` : ''}
                  ${freightRecoveryAmt > 0 ? `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 4px 10px; color: #475569;">Freight Recovery (+):</td>
                      <td style="padding: 4px 10px; text-align: right;">${formatINR(freightRecoveryAmt)}</td>
                    </tr>` : ''}
                  ${loadingChargesAmt > 0 ? `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 4px 10px; color: #475569;">Loading / Handling (+):</td>
                      <td style="padding: 4px 10px; text-align: right;">${formatINR(loadingChargesAmt)}</td>
                    </tr>` : ''}
                  ${otherChargesAmt > 0 ? `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 4px 10px; color: #475569;">Other Charges (+):</td>
                      <td style="padding: 4px 10px; text-align: right;">${formatINR(otherChargesAmt)}</td>
                    </tr>` : ''}
                  ${tcsAmt > 0 ? `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 4px 10px; color: #475569;">TCS Collected (+):</td>
                      <td style="padding: 4px 10px; text-align: right;">${formatINR(tcsAmt)}</td>
                    </tr>` : ''}
                  ${deductionsAmt !== 0 ? `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 4px 10px; color: #64748b;">Deductions / Adjustments:</td>
                      <td style="padding: 4px 10px; text-align: right;">${deductionsAmt > 0 ? `-${formatINR(deductionsAmt)}` : `+${formatINR(Math.abs(deductionsAmt))}`}</td>
                    </tr>` : ''}
                  ${roundOffAmt !== 0 ? `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 4px 10px; color: #64748b;">Round Off:</td>
                      <td style="padding: 4px 10px; text-align: right;">${roundOffAmt >= 0 ? `+${formatINR(roundOffAmt)}` : `-${formatINR(Math.abs(roundOffAmt))}`}</td>
                    </tr>` : ''}
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
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <tbody>
          <tr>
            <td style="width: 55%; vertical-align: top; font-size: 10px; color: #64748b; padding-right: 15px;">
              <div style="font-weight: bold; color: #334155; margin-bottom: 4px;">TERMS & CONDITIONS:</div>
              <div>1. All disputes are subject to local jurisdiction.</div>
              <div>2. Goods once sold will not be returned without prior authorization.</div>
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
