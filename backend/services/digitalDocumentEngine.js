const crypto = require('crypto');
const db = require('../config/database');

class DigitalDocumentEngine {
  /**
   * Document Prefix Mapping
   */
  static PREFIXES = {
    PURCHASE_ORDER: 'PO',
    PURCHASE: 'PUR',
    PURCHASE_RETURN: 'PRT',
    SALES_ORDER: 'SO',
    SALES_INVOICE: 'SI',
    SALES: 'SI',
    SALES_RETURN: 'SRT',
    DELIVERY_CHALLAN: 'DC',
    PAYMENT_RECEIPT: 'REC',
    PAYMENT_VOUCHER: 'VCH',
    STOCK_TRANSFER: 'TRF',
    QC_REPORT: 'QC',
    IQR_REPORT: 'IQR',
    LAB_REPORT: 'LAB',
    FLOUR_OUT: 'FO',
    FLOUR_OUT_RETURN: 'FOR',
    PAPAD_IN: 'PI',
    PAPAD_RETURN: 'PR',
    WORK_ORDER: 'WO',
    PRODUCTION: 'PRD',
    OTHER: 'DOC'
  };

  /**
   * Ensure required document tables exist
   */
  async ensureTables() {
    try {
      await db.run(`
        CREATE TABLE IF NOT EXISTS document_audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          company_id INTEGER DEFAULT 1,
          document_type TEXT NOT NULL,
          document_no TEXT NOT NULL,
          action TEXT NOT NULL,
          user_name TEXT,
          user_role TEXT,
          details TEXT,
          ip_address TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).catch(() => {});

      await db.run(`
        CREATE TABLE IF NOT EXISTS document_sequences (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          company_id INTEGER DEFAULT 1,
          financial_year TEXT NOT NULL,
          document_type TEXT NOT NULL,
          prefix TEXT NOT NULL,
          current_sequence INTEGER DEFAULT 0,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).catch(() => {});
    } catch (_) {}
  }

  /**
   * Generates standardized document number with company & financial year isolation
   */
  async getNextDocumentNumber(companyId = 1, financialYear = '2026-2027', docType = 'SALES_INVOICE') {
    await this.ensureTables();
    const normalizedType = docType.toUpperCase().replace(/\s+/g, '_');
    const prefix = DigitalDocumentEngine.PREFIXES[normalizedType] || 'DOC';
    const yearShort = (financialYear || '2026-2027').split('-')[0] || '2026';

    try {
      // Check sequence table
      const seqRes = await db.query(
        `SELECT current_sequence FROM document_sequences 
         WHERE company_id = ? AND financial_year = ? AND document_type = ? LIMIT 1`,
        [companyId, financialYear, normalizedType]
      );

      let nextSeq = 1;
      if (seqRes.rows && seqRes.rows.length > 0) {
        nextSeq = (seqRes.rows[0].current_sequence || 0) + 1;
        await db.run(
          `UPDATE document_sequences SET current_sequence = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE company_id = ? AND financial_year = ? AND document_type = ?`,
          [nextSeq, companyId, financialYear, normalizedType]
        );
      } else {
        await db.run(
          `INSERT INTO document_sequences (company_id, financial_year, document_type, prefix, current_sequence)
           VALUES (?, ?, ?, ?, 1)`,
          [companyId, financialYear, normalizedType, prefix]
        );
      }

      const paddedSeq = String(nextSeq).padStart(6, '0');
      return `${prefix}-${yearShort}-${paddedSeq}`;
    } catch (e) {
      const fallbackSeq = String(Date.now()).slice(-6);
      return `${prefix}-${yearShort}-${fallbackSeq}`;
    }
  }

  /**
   * Generate secure public document token
   */
  generateSecureToken(docType = 'DOC', docNo = '') {
    const prefix = (docType || 'DOC').replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
    const randomHex = crypto.randomBytes(6).toString('hex').toUpperCase();
    return `BVC-${prefix}-${randomHex}`;
  }

  /**
   * Record an audit log entry for any document operation
   */
  async logDocumentAction({
    companyId = 1,
    documentType = 'DOCUMENT',
    documentNo = '',
    action = 'CREATE',
    userName = 'System',
    userRole = 'Staff',
    details = '',
    ipAddress = '127.0.0.1'
  }) {
    await this.ensureTables();
    try {
      await db.run(
        `INSERT INTO document_audit_logs 
         (company_id, document_type, document_no, action, user_name, user_role, details, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [companyId, documentType, documentNo, action, userName, userRole, details, ipAddress]
      );
    } catch (e) {
      console.warn('Notice: Could not write document audit log:', e.message);
    }
  }

  /**
   * Get complete document audit trail
   */
  async getAuditTrail(documentNo, companyId = 1) {
    await this.ensureTables();
    try {
      const res = await db.query(
        `SELECT * FROM document_audit_logs 
         WHERE document_no = ? AND company_id = ? 
         ORDER BY created_at DESC, id DESC`,
        [documentNo, companyId]
      );
      return res.rows || [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Build Document Relationship Graph
   * (e.g. Purchase <-> QC <-> IQR <-> Purchase Return, Sales <-> Delivery Challan <-> Payment Receipt)
   */
  async getDocumentRelationships(docType, docNo, companyId = 1) {
    const relationships = {
      parent: null,
      children: [],
      related: []
    };

    try {
      const cleanType = (docType || '').toUpperCase();

      if (cleanType.includes('PURCHASE_RETURN') || cleanType.includes('DEBIT_NOTE')) {
        // Find original purchase and QC/IQR from purchase_returns and purchase_return_items
        const prRes = await db.query(
          `SELECT 
             pr.purchase_inv_no, 
             pr.purchase_id,
             pri.qc_no as qc_no, 
             pri.iqr_no as iqr_no, 
             pri.lot_no, 
             pr.supplier
           FROM purchase_returns pr
           LEFT JOIN purchase_return_items pri ON pri.purchase_return_id = pr.id
           WHERE pr.return_inv_no = ? OR CAST(pr.s_no AS TEXT) = ? OR pr.id = ?
           LIMIT 1`,
          [docNo, docNo, docNo],
          companyId
        );
        if (prRes.rows?.[0]) {
          const r = prRes.rows[0];
          const parentInvNo = r.purchase_inv_no || (r.purchase_id ? `PUR-${r.purchase_id}` : null);
          if (parentInvNo) {
            relationships.parent = { type: 'PURCHASE', document_no: parentInvNo, label: 'Original Purchase Invoice' };
          }
          if (r.qc_no) {
            relationships.related.push({ type: 'QC_REPORT', document_no: r.qc_no, label: 'Quality Inspection' });
          }
          if (r.iqr_no) {
            relationships.related.push({ type: 'IQR_REPORT', document_no: r.iqr_no, label: 'Incoming Quality Report' });
          }
        }
      } else if (cleanType.includes('PURCHASE')) {
        // Find downstream QC, IQR, Returns
        const qcRes = await db.query(
          `SELECT q.qc_no, q.inspection_date, q.overall_result 
           FROM qc_inspections q
           JOIN purchases p ON q.purchase_id = p.id
           WHERE p.inv_no = ? OR CAST(p.s_no AS TEXT) = ? OR p.id = ?`,
          [docNo, docNo, docNo],
          companyId
        );
        (qcRes.rows || []).forEach(q => {
          relationships.children.push({ type: 'QC_REPORT', document_no: q.qc_no, status: q.overall_result, label: 'QC Inspection' });
        });

        const prRes = await db.query(
          `SELECT DISTINCT pr.return_inv_no, pr.date, pr.status
           FROM purchase_returns pr
           LEFT JOIN purchases p ON (pr.purchase_id = p.id OR pr.purchase_inv_no = p.inv_no)
           WHERE pr.purchase_inv_no = ? OR p.inv_no = ? OR CAST(p.s_no AS TEXT) = ? OR CAST(p.id AS TEXT) = ?`,
          [docNo, docNo, docNo, docNo],
          companyId
        );
        (prRes.rows || []).forEach(pr => {
          relationships.children.push({ type: 'PURCHASE_RETURN', document_no: pr.return_inv_no, status: pr.status, label: 'Purchase Return (Debit Note)' });
        });
      } else if (cleanType.includes('SALES')) {
        // Find receipts and returns
        const payRes = await db.query(
          `SELECT * FROM digital_payment_records WHERE document_no = ?`,
          [docNo]
        );
        (payRes.rows || []).forEach(p => {
          relationships.children.push({ type: 'PAYMENT_RECEIPT', document_no: p.transaction_ref, status: p.status, amount: p.amount, label: 'UPI Payment Receipt' });
        });
      }
    } catch (err) {
      console.warn('Notice: Error computing document relationships:', err.message);
    }

    return relationships;
  }
}

module.exports = new DigitalDocumentEngine();
