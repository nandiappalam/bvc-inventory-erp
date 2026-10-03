const crypto = require('crypto');
const db = require('../config/database');

/**
 * Payment Integration & UPI Dynamic QR Provider Abstraction
 * Generates standards-compliant UPI payment intent strings, QR payloads,
 * tracks lifecycle statuses (UNPAID -> PENDING -> PAID / FAILED), and logs digital receipts.
 */
class PaymentProvider {
  /**
   * Generates UPI payment intent URI
   */
  generateUpiIntent({
    vpa = 'bvc@upi',
    payeeName = 'BVC Exports Pvt Ltd',
    amount = 0,
    docNo = 'ERP-DOC',
    notes = 'BVC ERP Invoice Payment'
  }) {
    const cleanAmount = (parseFloat(amount) || 0).toFixed(2);
    const cleanDoc = encodeURIComponent(docNo);
    const cleanPayee = encodeURIComponent(payeeName);
    const cleanNotes = encodeURIComponent(notes);

    return `upi://pay?pa=${vpa}&pn=${cleanPayee}&am=${cleanAmount}&tr=${cleanDoc}&tn=${cleanNotes}&cu=INR`;
  }

  /**
   * Records digital payment receipt and connects to document
   */
  async recordPayment({
    companyId = 1,
    token = null,
    documentNo,
    partyName = '',
    amount,
    paymentMode = 'UPI',
    transactionRef = '',
    vpaId = '',
    notes = '',
    recordedBy = 'Public / User'
  }) {
    if (!documentNo || !amount) {
      throw new Error('documentNo and amount are required');
    }

    const cleanAmount = parseFloat(amount) || 0;
    const cleanRef = transactionRef || `UPI-${Date.now().toString(36).toUpperCase()}`;

    await db.run(
      `INSERT INTO digital_payment_records 
       (token, document_no, party_name, amount, payment_mode, transaction_ref, vpa_id, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?)`,
      [token, documentNo, partyName, cleanAmount, paymentMode, cleanRef, vpaId, notes]
    );

    // Update document access token status if token provided
    if (token) {
      await db.run(
        `UPDATE document_access_tokens SET status = 'PAID' WHERE token = ?`,
        [token]
      ).catch(() => {});
    }

    return {
      success: true,
      receiptNo: `REC-${Date.now().toString().slice(-6)}`,
      documentNo,
      partyName,
      amount: cleanAmount,
      transactionRef: cleanRef,
      paymentMode,
      status: 'COMPLETED',
      paidAt: new Date().toISOString()
    };
  }

  /**
   * Fetches payment history for a document
   */
  async getDocumentPayments(documentNo) {
    const res = await db.query(
      `SELECT * FROM digital_payment_records WHERE document_no = ? ORDER BY paid_at DESC, id DESC`,
      [documentNo]
    );
    return res.rows || [];
  }
}

module.exports = new PaymentProvider();
