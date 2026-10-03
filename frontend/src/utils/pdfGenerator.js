import { jsPDF } from 'jspdf';

/**
 * Enterprise Unified PDF Document Engine for BVC Exports ERP
 * Supports standard Tax Invoices, Purchase Orders, Debit Notes, Payment Receipts, QC Certificates, Delivery Challans
 */
export const generateDocumentPDF = ({
  company = {},
  document = {},
  signatures = [],
  docQrDataUrl = null,
  upiQrDataUrl = null,
  verificationUrl = null,
  autoDownload = true,
  fileName = null
}) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - (margin * 2);

  let y = margin;

  // Helper for Indian Currency Formatting without special character encoding bugs
  const formatINR = (val) => {
    const num = parseFloat(val) || 0;
    return `Rs. ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // --- 1. HEADER SECTION ---
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, y, contentWidth, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(company.name || 'BVC EXPORTS PRIVATE LIMITED', margin + 6, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Agricultural Commodities • Premium Grains & Pulses Processing • Export Quality', margin + 6, y + 13.5);
  doc.text(`GSTIN: ${company.gstin || '33AABCB1234A1Z5'} | Email: ${company.email || 'billing@bvcexports.com'} | Tel: ${company.phone || '+91 98765 43210'}`, margin + 6, y + 18.5);

  y += 26;

  // --- 2. DOCUMENT TITLE & META BAR ---
  const docTitle = (document.document_type || 'DIGITAL DOCUMENT').toUpperCase();
  doc.setFillColor(241, 245, 249); // slate-100
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.rect(margin, y, contentWidth, 12, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(docTitle, margin + 4, y + 8);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Doc No: `, pageWidth - margin - 70, y + 5);
  doc.setFont('helvetica', 'bold');
  doc.text(`${document.document_no || 'ERP-DOC'}`, pageWidth - margin - 54, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.text(`Date: `, pageWidth - margin - 70, y + 10);
  doc.setFont('helvetica', 'bold');
  doc.text(`${document.date || new Date().toISOString().split('T')[0]}`, pageWidth - margin - 54, y + 10);

  y += 16;

  // --- 3. PARTY / BILLED TO & DISPATCH DETAILS ---
  const boxWidth = (contentWidth - 4) / 2;
  const boxHeight = 30;

  // Left Box: Party Details
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, boxWidth, boxHeight, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('BILLED / ISSUED TO:', margin + 4, y + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  const partyDisplayName = String(document.party_name || 'Valued Customer / Partner').substring(0, 36);
  doc.text(partyDisplayName, margin + 4, y + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  const addrStr = String(document.billing_address || 'Industrial Area / Registered Office').substring(0, 48);
  doc.text(`Address: ${addrStr}`, margin + 4, y + 16);
  doc.text(`State / Code: Tamil Nadu (33) | Place of Supply: 33`, margin + 4, y + 21);
  doc.text(`GSTIN: ${document.gstin || 'Unregistered / B2C'} | Phone: ${document.phone || 'N/A'}`, margin + 4, y + 26);

  // Right Box: Dispatch & Transport Details
  doc.roundedRect(margin + boxWidth + 4, y, boxWidth, boxHeight, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('DISPATCH & PAYMENT DETAILS:', margin + boxWidth + 8, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`Vehicle No: ${document.vehicle_no || 'Direct Inward / Outward'}`, margin + boxWidth + 8, y + 11);
  doc.text(`Transporter: ${document.transport || 'Internal Transport / Self'}`, margin + boxWidth + 8, y + 16);
  doc.text(`Status: ${document.status || 'VALID'} | Payment: ${document.payment_status || 'UNPAID'}`, margin + boxWidth + 8, y + 21);
  if (document.remarks) {
    doc.text(`Notes: ${String(document.remarks).substring(0, 40)}`, margin + boxWidth + 8, y + 26);
  }

  y += boxHeight + 5;

  // --- 4. LINE ITEMS TABLE ---
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(margin, y, contentWidth, 7, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);

  doc.text('#', margin + 2, y + 4.8);
  doc.text('ITEM DESCRIPTION', margin + 8, y + 4.8);
  doc.text('LOT NO', margin + 74, y + 4.8);
  doc.text('QTY / WT', margin + 104, y + 4.8);
  doc.text('RATE (Rs.)', margin + 138, y + 4.8);
  doc.text('AMOUNT (Rs.)', margin + contentWidth - 2, y + 4.8, { align: 'right' });

  y += 7;

  const items = (document.items && document.items.length > 0) ? document.items : [{
    item_name: document.item_summary || 'Agri Commodity Inward / Outward',
    qty: 1,
    rate: document.grand_total || document.total_amount || 0,
    amount: document.grand_total || document.total_amount || 0
  }];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  let rowHeight = 7;
  items.forEach((item, index) => {
    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, rowHeight, 'F');
    }

    doc.setTextColor(15, 23, 42);
    doc.text(String(index + 1), margin + 2, y + 4.8);
    doc.text(String(item.item_name || 'Agri Product').substring(0, 35), margin + 8, y + 4.8);
    doc.text(String(item.lot_no || '—'), margin + 74, y + 4.8);
    
    const qtyVal = item.qty !== undefined ? item.qty : 0;
    const qtyText = item.total_weight ? `${qtyVal} bags (${item.total_weight} kg)` : item.weight && item.weight > 1 ? `${qtyVal} (${item.weight} kg)` : `${qtyVal} bags`;
    doc.text(String(qtyText).substring(0, 20), margin + 104, y + 4.8);
    
    const rateVal = parseFloat(item.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    doc.text(rateVal, margin + 138, y + 4.8);

    const amtVal = parseFloat(item.amount || (item.qty * item.rate) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    doc.text(amtVal, margin + contentWidth - 2, y + 4.8, { align: 'right' });

    // Border bottom
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);

    y += rowHeight;
  });

  // Table Outer Frame
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, y - (items.length * rowHeight) - 7, contentWidth, (items.length * rowHeight) + 7);

  y += 4;

  // --- 5. TOTALS & SUMMARY ---
  const summaryBoxWidth = 85;
  const summaryX = pageWidth - margin - summaryBoxWidth;
  const grandTotal = parseFloat(document.grand_total || document.total_amount || 0);
  const taxAmount = parseFloat(document.tax_amount || 0);
  const subtotal = parseFloat(document.subtotal || (grandTotal - taxAmount) || grandTotal);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(summaryX, y, summaryBoxWidth, 24, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Sub Total:', summaryX + 4, y + 6);
  doc.text(formatINR(subtotal), summaryX + summaryBoxWidth - 4, y + 6, { align: 'right' });

  doc.text('Taxes (GST):', summaryX + 4, y + 12);
  doc.text(formatINR(taxAmount), summaryX + summaryBoxWidth - 4, y + 12, { align: 'right' });

  doc.setDrawColor(203, 213, 225);
  doc.line(summaryX + 4, y + 15, summaryX + summaryBoxWidth - 4, y + 15);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Grand Total:', summaryX + 4, y + 21);
  doc.text(formatINR(grandTotal), summaryX + summaryBoxWidth - 4, y + 21, { align: 'right' });

  // --- 6. QR CODES & DIGITAL VERIFICATION SECTION ---
  const qrBoxWidth = summaryX - margin - 4;
  doc.roundedRect(margin, y, qrBoxWidth, 24, 1.5, 1.5, 'FD');

  if (docQrDataUrl) {
    doc.addImage(docQrDataUrl, 'PNG', margin + 2, y + 2, 20, 20);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('BVC DIGITAL VERIFICATION QR', margin + 24, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Scan using phone camera to view, verify, download', margin + 24, y + 11);
  doc.text('or track digital delivery acknowledgement.', margin + 24, y + 15);
  if (verificationUrl) {
    doc.text(String(verificationUrl).substring(0, 52), margin + 24, y + 19);
  }

  y += 28;

  // --- 7. SIGNATURES & APPROVAL AUDIT BLOCK ---
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, y, contentWidth, 22, 1.5, 1.5, 'FD');

  const sigColWidth = contentWidth / 3;
  const stages = [
    { label: 'PREPARED BY', defaultSigner: 'ERP Operator' },
    { label: 'CHECKED & VERIFIED', defaultSigner: 'Quality / Store Incharge' },
    { label: 'AUTHORIZED SIGNATORY', defaultSigner: 'Managing Director / Manager' }
  ];

  stages.forEach((stage, sIdx) => {
    const sX = margin + (sIdx * sigColWidth);
    const matchedSig = signatures.find(s => (s.stage || '').toUpperCase() === stage.label.replace(/\s+/g, '_') || (s.stage || '').toUpperCase() === 'APPROVED');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(stage.label, sX + 4, y + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    const signerName = matchedSig?.signed_by_name || matchedSig?.signer || stage.defaultSigner;
    doc.text(String(signerName).substring(0, 25), sX + 4, y + 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    if (matchedSig?.signature_hash || matchedSig?.hash) {
      doc.text(`DSC Hash: ${(matchedSig.signature_hash || matchedSig.hash).substring(0, 16)}...`, sX + 4, y + 17);
      doc.text(`Signed: ${matchedSig.signed_at || matchedSig.signedAt || 'Verified'}`, sX + 4, y + 20);
    } else {
      doc.text('Digitally Authenticated in BVC ERP', sX + 4, y + 18);
    }

    if (sIdx < 2) {
      doc.setDrawColor(226, 232, 240);
      doc.line(sX + sigColWidth, y + 2, sX + sigColWidth, y + 20);
    }
  });

  y += 25;

  // --- 8. FOOTER ---
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('This is a secure computer generated digital document issued by BVC Exports Private Limited.', pageWidth / 2, pageHeight - 10, { align: 'center' });
  doc.text(`Generated on ${new Date().toLocaleString('en-IN')} • Page 1 of 1`, pageWidth / 2, pageHeight - 6, { align: 'center' });

  const finalFileName = fileName || `${docTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${document.document_no || 'Document'}.pdf`;

  if (autoDownload) {
    doc.save(finalFileName);
  }

  return doc;
};
