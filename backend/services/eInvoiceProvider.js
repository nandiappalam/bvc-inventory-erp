/**
 * GST e-Invoice and E-Way Bill Integration Abstraction
 * Handles JSON payload creation, GST compliance validation, schema generation,
 * and interface adapters for authorized IRP (Invoice Registration Portal) APIs.
 */
class EInvoiceProvider {
  /**
   * Validates document readiness for GST e-Invoicing
   */
  validateInvoicePayload(invoiceData) {
    const errors = [];
    if (!invoiceData.docNo) errors.push('Document Number is missing');
    if (!invoiceData.date) errors.push('Document Date is missing');
    if (!invoiceData.supplierGstin) errors.push('Supplier GSTIN is required');
    if (!invoiceData.recipientGstin) errors.push('Recipient GSTIN is required for B2B e-Invoice');
    if (!invoiceData.items || invoiceData.items.length === 0) errors.push('At least one line item is required');
    
    // Check line items HSN
    (invoiceData.items || []).forEach((item, idx) => {
      if (!item.hsn && !item.hsn_code) {
        errors.push(`Item #${idx + 1} (${item.item_name || 'Item'}) missing HSN code`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generates GST standard e-Invoice JSON schema for IRP submission
   */
  generateIRPPayload({
    documentNo,
    documentDate,
    supplyType = 'B2B',
    sellerDetails = {},
    buyerDetails = {},
    itemList = [],
    taxDetails = {},
    valueDetails = {}
  }) {
    return {
      Version: '1.1',
      TranDtls: {
        TaxSch: 'GST',
        SupTyp: supplyType,
        RegRev: 'N',
        EcmGstin: null,
        IgstOnIntra: 'N'
      },
      DocDtls: {
        Typ: 'INV',
        No: documentNo,
        Dt: (documentDate || new Date().toISOString().split('T')[0]).split('-').reverse().join('/')
      },
      SellerDtls: {
        Gstin: sellerDetails.gstin || '33AABCB1234A1Z5',
        LglNm: sellerDetails.legalName || 'BVC EXPORTS PRIVATE LIMITED',
        TrdNm: sellerDetails.tradeName || 'BVC EXPORTS',
        Addr1: sellerDetails.address || 'Industrial Area',
        Loc: sellerDetails.city || 'Madurai',
        Pin: parseInt(sellerDetails.pincode || 625001),
        Stcd: '33'
      },
      BuyerDtls: {
        Gstin: buyerDetails.gstin || 'URP',
        LglNm: buyerDetails.legalName || 'RECIPIENT TRADERS',
        TrdNm: buyerDetails.tradeName || buyerDetails.legalName || 'RECIPIENT TRADERS',
        Pos: buyerDetails.pos || '33',
        Addr1: buyerDetails.address || 'Main Road',
        Loc: buyerDetails.city || 'Chennai',
        Pin: parseInt(buyerDetails.pincode || 600001),
        Stcd: buyerDetails.stateCode || '33'
      },
      ItemList: (itemList || []).map((item, idx) => ({
        SlNo: String(idx + 1),
        PrdDesc: item.item_name || 'Agri Commodity',
        IsServc: 'N',
        HsnCd: String(item.hsn_code || item.hsn || '07133100'),
        Qty: parseFloat(item.qty || 0),
        Unit: item.unit || 'KGS',
        UnitPrice: parseFloat(item.rate || 0),
        TotAmt: parseFloat(item.amount || (item.qty * item.rate) || 0),
        Discount: parseFloat(item.discount || 0),
        AssAmt: parseFloat(item.taxable_value || item.amount || 0),
        GstRt: parseFloat(item.tax_rate || item.tax_percent || 5),
        CgstAmt: parseFloat(item.cgst_amount || 0),
        SgstAmt: parseFloat(item.sgst_amount || 0),
        IgstAmt: parseFloat(item.igst_amount || 0),
        TotItemVal: parseFloat(item.total_item_value || item.amount || 0)
      })),
      ValDtls: {
        AssVal: parseFloat(valueDetails.taxableAmount || 0),
        CgstVal: parseFloat(valueDetails.cgstAmount || 0),
        SgstVal: parseFloat(valueDetails.sgstAmount || 0),
        IgstVal: parseFloat(valueDetails.igstAmount || 0),
        TotInvVal: parseFloat(valueDetails.grandTotal || 0)
      }
    };
  }
}

module.exports = new EInvoiceProvider();
