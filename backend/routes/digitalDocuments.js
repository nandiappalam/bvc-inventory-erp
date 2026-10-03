const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const QRCode = require('qrcode');
const db = require('../config/database');
const docEngine = require('../services/digitalDocumentEngine');
const eSignProvider = require('../services/eSignProvider');
const paymentProvider = require('../services/paymentProvider');
const eInvoiceProvider = require('../services/eInvoiceProvider');

/**
 * Generate unique URL-safe token
 */
function generateDocumentToken(docType, docNo) {
  return docEngine.generateSecureToken(docType, docNo);
}

/**
 * Generate Dynamic UPI Payment URI
 */
function generateUpiUri({ vpa = 'bvc@upi', payeeName = 'BVC Exports Pvt Ltd', amount, docNo }) {
  return paymentProvider.generateUpiIntent({ vpa, payeeName, amount, docNo });
}

/**
 * GET /api/documents/next-number
 * Generates standardized sequential document number for company and financial year
 */
router.get('/next-number', async (req, res) => {
  try {
    const { document_type, financial_year } = req.query;
    const cId = req.companyId || req.headers['x-company-id'] || 1;
    const nextNumber = await docEngine.getNextDocumentNumber(cId, financial_year || '2026-2027', document_type || 'SALES_INVOICE');
    res.json({ success: true, documentNumber: nextNumber });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error generating next document number', error: error.message });
  }
});

/**
 * POST /api/documents/generate-token
 * Generates or retrieves a secure digital document access token + dynamic QR + UPI payment link
 */
router.post('/generate-token', async (req, res) => {
  try {
    const {
      document_type,
      document_id,
      document_no,
      party_name,
      total_amount,
      date,
      item_summary,
      status
    } = req.body;

    if (!document_type || !document_no) {
      return res.status(400).json({ success: false, message: 'document_type and document_no are required' });
    }

    const cId = req.companyId || req.headers['x-company-id'] || 1;

    // Check if token already exists
    const existing = await db.query(
      `SELECT * FROM document_access_tokens WHERE document_type = ? AND document_no = ? AND company_id = ? LIMIT 1`,
      [document_type, document_no, cId]
    ).catch(() => ({ rows: [] }));

    let token;
    let docRow;

    // Determine origin for public URL (prefer client-provided origin so QR opens web app)
    let origin = req.body?.origin || req.headers['origin'];
    if (!origin && req.headers['referer']) {
      try {
        const refUrl = new URL(req.headers['referer']);
        origin = refUrl.origin;
      } catch (e) {}
    }
    if (!origin) {
      let host = req.get('host') || 'localhost:3000';
      if (host.includes(':3001')) {
        host = host.replace(':3001', ':3000');
      }
      const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      origin = `${protocol}://${host}`;
    }

    const upiLink = generateUpiUri({
      vpa: 'bvc@upi',
      payeeName: 'BVC Exports Pvt Ltd',
      amount: total_amount || 0,
      docNo: document_no
    });

    let resolvedPartyName = party_name || '';
    if (!resolvedPartyName || !isNaN(Number(resolvedPartyName))) {
      const sm = await db.query(
        `SELECT print_name, name FROM supplier_master WHERE CAST(id AS TEXT) = ? OR name = ? LIMIT 1`,
        [String(party_name), String(party_name)],
        cId
      ).catch(() => ({ rows: [] }));
      if (sm.rows?.[0]) {
        resolvedPartyName = sm.rows[0].print_name || sm.rows[0].name;
      } else {
        const cm = await db.query(
          `SELECT print_name, name FROM customer_master WHERE CAST(id AS TEXT) = ? OR name = ? LIMIT 1`,
          [String(party_name), String(party_name)],
          cId
        ).catch(() => ({ rows: [] }));
        if (cm.rows?.[0]) {
          resolvedPartyName = cm.rows[0].print_name || cm.rows[0].name;
        }
      }
    }

    if (existing.rows && existing.rows.length > 0) {
      docRow = existing.rows[0];
      token = docRow.token;
      // Update amount or status if changed
      await db.run(
        `UPDATE document_access_tokens 
         SET total_amount = ?, party_name = COALESCE(?, party_name), status = COALESCE(?, status), upi_payment_link = ?
         WHERE id = ?`,
        [total_amount || docRow.total_amount, resolvedPartyName || party_name, status, upiLink, docRow.id]
      );
    } else {
      token = generateDocumentToken(document_type, document_no);
      await db.run(
        `INSERT INTO document_access_tokens 
         (token, document_type, document_id, document_no, company_id, party_name, date, total_amount, status, upi_payment_link, item_summary)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          token,
          document_type,
          String(document_id || ''),
          document_no,
          cId,
          resolvedPartyName || party_name || '',
          date || new Date().toISOString().split('T')[0],
          parseFloat(total_amount) || 0,
          status || 'VALID',
          upiLink,
          item_summary || ''
        ]
      );

      // Audit Log
      await docEngine.logDocumentAction({
        companyId: cId,
        documentType: document_type,
        documentNo: document_no,
        action: 'QR_GENERATED',
        userName: req.user?.username || 'User',
        details: `Generated digital token ${token}`
      });
    }

    const verificationUrl = `${origin}/v/${token}`;
    
    // Generate QR Code Data URLs
    const docQrDataUrl = await QRCode.toDataURL(verificationUrl, {
      margin: 1,
      width: 280,
      color: { dark: '#0f172a', light: '#ffffff' }
    });

    const upiQrDataUrl = (parseFloat(total_amount) > 0) ? await QRCode.toDataURL(upiLink, {
      margin: 1,
      width: 280,
      color: { dark: '#15803d', light: '#ffffff' }
    }) : null;

    res.json({
      success: true,
      token,
      verificationUrl,
      docQrDataUrl,
      upiLink,
      upiQrDataUrl,
      document: {
        document_type,
        document_no,
        party_name,
        total_amount: parseFloat(total_amount) || 0,
        status: status || 'VALID',
        date
      }
    });
  } catch (error) {
    console.error('Error in generate-token:', error);
    res.status(500).json({ success: false, message: 'Error generating document token', error: error.message });
  }
});

/**
 * GET /api/documents/public/:token
 * Public Document Verification & Mobile E-Bill View Endpoint (No internal authentication required)
 */
router.get('/public/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const tokenRes = await db.query(
      `SELECT * FROM document_access_tokens WHERE token = ? LIMIT 1`,
      [token]
    );

    if (!tokenRes.rows || tokenRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired document verification token'
      });
    }

    const docMeta = tokenRes.rows[0];
    const cId = docMeta.company_id || 1;

    // Increment views count asynchronously
    db.run(`UPDATE document_access_tokens SET views_count = views_count + 1 WHERE id = ?`, [docMeta.id]).catch(() => {});

    // Company Information
    let companyInfo = {
      name: 'BVC Exports Pvt Ltd',
      address: '123 Main Industrial Area, Madurai, Tamil Nadu - 625001',
      gstin: '33AABCB1234A1Z5',
      phone: '+91 98765 43210',
      email: 'billing@bvcexports.com',
      bankName: 'State Bank of India',
      accountNo: '39482910482',
      ifsc: 'SBIN0001234',
      upiVpa: 'bvc@upi'
    };

    try {
      const compRes = await db.query(`SELECT * FROM companies WHERE id = ? LIMIT 1`, [cId]);
      if (compRes.rows?.[0]) {
        const c = compRes.rows[0];
        companyInfo.name = c.name || companyInfo.name;
        companyInfo.address = c.address || companyInfo.address;
        companyInfo.gstin = c.gst_number || companyInfo.gstin;
        companyInfo.phone = c.contact || companyInfo.phone;
        companyInfo.email = c.email || companyInfo.email;
      }
    } catch (e) {}

    // Fetch Full Underlying Transaction Details based on document_type
    let documentDetails = {
      document_type: docMeta.document_type,
      document_no: docMeta.document_no,
      date: docMeta.date,
      party_name: docMeta.party_name,
      total_amount: docMeta.total_amount,
      status: docMeta.status,
      items: [],
      subtotal: docMeta.total_amount,
      tax_amount: 0,
      grand_total: docMeta.total_amount,
      remarks: '',
      transport: '',
      vehicle_no: '',
      billing_address: '',
      shipping_address: '',
      payment_status: docMeta.status === 'PAID' ? 'PAID' : 'UNPAID'
    };

    const docTypeUpper = (docMeta.document_type || '').toUpperCase();
    const numOnly = (docMeta.document_no || '').replace(/[^0-9]/g, '');
    const cleanNum = numOnly ? parseInt(numOnly, 10) : 0;
    const docNoStr = String(docMeta.document_no || '');

    if (docTypeUpper.includes('SALES') && !docTypeUpper.includes('RETURN') && !docTypeUpper.includes('EXPORT')) {
      const sRes = await db.query(
        `SELECT * FROM sales 
         WHERE CAST(id AS TEXT) = ? OR CAST(s_no AS TEXT) = ? OR p_o_no = ? OR id = ? OR s_no = ?
         LIMIT 1`,
        [docNoStr, docNoStr, docNoStr, docMeta.document_id || cleanNum, cleanNum],
        cId
      ).catch(() => ({ rows: [] }));

      if (sRes.rows?.[0]) {
        const s = sRes.rows[0];
        documentDetails.date = s.date || documentDetails.date;
        documentDetails.party_name = s.customer || documentDetails.party_name;
        documentDetails.remarks = s.remarks || '';
        documentDetails.vehicle_no = s.vehicle_no || s.lorry_no || '';
        documentDetails.transport = s.transport || s.transporter || s.pur_trans || '';
        documentDetails.subtotal = s.base_amt || s.sub_total || s.base_amount || (s.grand_total - (s.tax_amt || s.tax_amount || 0));
        documentDetails.tax_amount = s.tax_amt || s.tax_amount || (s.cgst_amount || 0) + (s.sgst_amount || 0) + (s.igst_amount || 0);
        documentDetails.grand_total = s.grand_total || s.total_amt || s.bill_amt || docMeta.total_amount;
        documentDetails.cgst = s.cgst_amount || 0;
        documentDetails.sgst = s.sgst_amount || 0;
        documentDetails.igst = s.igst_amount || 0;

        // Customer Master lookup
        const cmRes = await db.query(
          `SELECT * FROM customer_master WHERE CAST(id AS TEXT) = ? OR name = ? OR print_name = ? LIMIT 1`,
          [String(s.customer || s.customer_id || ''), String(s.customer || ''), String(s.customer || '')],
          cId
        ).catch(() => ({ rows: [] }));

        if (cmRes.rows?.[0]) {
          const cm = cmRes.rows[0];
          documentDetails.party_name = cm.print_name || cm.name || s.customer;
          documentDetails.billing_address = [cm.address1, cm.address2, cm.city, cm.state].filter(Boolean).join(', ') || s.address || '';
          documentDetails.gstin = cm.gst_number || cm.gst_no || '';
          documentDetails.phone = cm.phone_off || cm.mobile1 || s.phone || '';
        } else if (s.address) {
          documentDetails.billing_address = s.address;
        }

        const itemsRes = await db.query(`SELECT * FROM sales_items WHERE sales_id = ?`, [s.id], cId).catch(() => ({ rows: [] }));
        documentDetails.items = (itemsRes.rows || []).map(i => ({
          item_name: i.item_name,
          lot_no: i.lot_no || '—',
          qty: i.qty || 0,
          weight: i.weight || 0,
          total_weight: i.total_wt || (i.qty * i.weight) || 0,
          rate: i.rate || 0,
          amount: i.total_amt || i.amount || (i.qty * i.rate) || 0,
          tax_percent: i.tax_perc || i.tax_rate || 0
        }));
      }
    } else if (docTypeUpper.includes('PURCHASE') && !docTypeUpper.includes('RETURN') && !docTypeUpper.includes('ORDER') && !docTypeUpper.includes('REQUEST')) {
      const pRes = await db.query(
        `SELECT * FROM purchases 
         WHERE inv_no = ? OR voucher_no = ? OR po_no = ? OR CAST(s_no AS TEXT) = ? OR CAST(id AS TEXT) = ? OR s_no = ? OR id = ?
         LIMIT 1`,
        [docNoStr, docNoStr, docNoStr, docNoStr, docNoStr, cleanNum, docMeta.document_id || cleanNum],
        cId
      ).catch(() => ({ rows: [] }));

      if (pRes.rows?.[0]) {
        const p = pRes.rows[0];
        documentDetails.date = p.date || documentDetails.date;
        documentDetails.party_name = p.supplier || documentDetails.party_name;
        documentDetails.remarks = p.remarks || '';
        documentDetails.vehicle_no = p.vehicle_no || p.lorry_no || '';
        documentDetails.transport = p.transport || p.transporter || '';
        documentDetails.subtotal = p.base_amount || p.sub_total || p.total_amount || docMeta.total_amount;
        documentDetails.tax_amount = p.tax_amount || (p.cgst_amount || 0) + (p.sgst_amount || 0) + (p.igst_amount || 0);
        documentDetails.grand_total = p.grand_total || p.net_amount || p.total_amount || docMeta.total_amount;

        // Supplier Master lookup
        const smRes = await db.query(
          `SELECT * FROM supplier_master WHERE CAST(id AS TEXT) = ? OR name = ? OR print_name = ? LIMIT 1`,
          [String(p.supplier || ''), String(p.supplier || ''), String(p.supplier || '')],
          cId
        ).catch(() => ({ rows: [] }));

        if (smRes.rows?.[0]) {
          const sm = smRes.rows[0];
          documentDetails.party_name = sm.print_name || sm.name || p.supplier;
          documentDetails.billing_address = [sm.address1, sm.address2, sm.city, sm.state].filter(Boolean).join(', ') || p.address || '';
          documentDetails.gstin = sm.gst_number || sm.gst_no || p.gst_no || '';
          documentDetails.phone = sm.phone_res || sm.mobile1 || sm.phone_off || p.phone || '';
        } else if (p.address) {
          if (p.address.includes('Name :')) {
            const nameMatch = p.address.match(/Name\s*:\s*([^\n]+)/i);
            const addrMatch = p.address.match(/Address\s*:\s*([^\n]+)/i);
            const phoneMatch = p.address.match(/Phone\s*:\s*([^\n]+)/i);
            if (nameMatch && nameMatch[1]) documentDetails.party_name = nameMatch[1].trim();
            if (addrMatch && addrMatch[1]) documentDetails.billing_address = addrMatch[1].trim();
            if (phoneMatch && phoneMatch[1]) documentDetails.phone = phoneMatch[1].trim();
          } else {
            documentDetails.billing_address = p.address;
          }
        }

        const itemsRes = await db.query(`SELECT * FROM purchase_items WHERE purchase_id = ?`, [p.id], cId).catch(() => ({ rows: [] }));
        documentDetails.items = (itemsRes.rows || []).map(i => ({
          item_name: i.item_name,
          lot_no: i.lot_no || '—',
          qty: i.qty || 0,
          weight: i.weight || i.per_unit_weight || 0,
          total_weight: i.total_weight || i.total_wt || (i.qty * i.weight) || 0,
          rate: i.rate || 0,
          amount: i.amount || (i.qty * i.rate) || 0
        }));
      }
    } else if (docTypeUpper.includes('PURCHASE_RETURN') || docTypeUpper.includes('PURCHASE RETURN') || docTypeUpper.includes('DEBIT NOTE')) {
      const prRes = await db.query(
        `SELECT * FROM purchase_returns 
         WHERE return_inv_no = ? OR CAST(s_no AS TEXT) = ? OR CAST(id AS TEXT) = ? OR s_no = ? OR id = ?
         LIMIT 1`,
        [docNoStr, docNoStr, docNoStr, cleanNum, docMeta.document_id || cleanNum],
        cId
      ).catch(() => ({ rows: [] }));

      if (prRes.rows?.[0]) {
        const pr = prRes.rows[0];
        documentDetails.date = pr.date || documentDetails.date;
        documentDetails.party_name = pr.supplier || documentDetails.party_name;
        documentDetails.remarks = pr.reason || pr.remarks || '';
        documentDetails.grand_total = pr.grand_total || pr.total_amount || docMeta.total_amount;

        const smRes = await db.query(
          `SELECT * FROM supplier_master WHERE CAST(id AS TEXT) = ? OR name = ? OR print_name = ? LIMIT 1`,
          [String(pr.supplier || ''), String(pr.supplier || ''), String(pr.supplier || '')],
          cId
        ).catch(() => ({ rows: [] }));

        if (smRes.rows?.[0]) {
          const sm = smRes.rows[0];
          documentDetails.party_name = sm.print_name || sm.name || pr.supplier;
          documentDetails.billing_address = [sm.address1, sm.address2, sm.city, sm.state].filter(Boolean).join(', ');
          documentDetails.gstin = sm.gst_number || sm.gst_no || '';
          documentDetails.phone = sm.phone_res || sm.mobile1 || '';
        }

        const itemsRes = await db.query(`SELECT * FROM purchase_return_items WHERE purchase_return_id = ?`, [pr.id], cId).catch(() => ({ rows: [] }));
        documentDetails.items = (itemsRes.rows || []).map(i => ({
          item_name: i.item_name,
          lot_no: i.lot_no || '—',
          qty: i.qty || 0,
          weight: i.weight || 0,
          total_weight: i.total_wt || (i.qty * i.weight) || 0,
          rate: i.rate || 0,
          amount: i.amount || (i.qty * i.rate) || 0,
          iqr_no: i.iqr_no,
          qc_no: i.qc_no,
          reason: i.reason
        }));
      }
    } else if (docTypeUpper.includes('PURCHASE_ORDER') || docTypeUpper.includes('PURCHASE ORDER')) {
      const poRes = await db.query(
        `SELECT * FROM purchase_orders 
         WHERE po_no = ? OR inv_no = ? OR CAST(s_no AS TEXT) = ? OR CAST(id AS TEXT) = ? OR s_no = ? OR id = ?
         LIMIT 1`,
        [docNoStr, docNoStr, docNoStr, docNoStr, cleanNum, docMeta.document_id || cleanNum],
        cId
      ).catch(() => ({ rows: [] }));

      if (poRes.rows?.[0]) {
        const po = poRes.rows[0];
        documentDetails.date = po.po_date || po.date || documentDetails.date;
        documentDetails.party_name = po.supplier_name || documentDetails.party_name;
        documentDetails.grand_total = po.total_amt || po.amount || po.bill_amt || docMeta.total_amount;
        documentDetails.remarks = po.remarks || po.terms || '';

        const smRes = await db.query(
          `SELECT * FROM supplier_master WHERE CAST(id AS TEXT) = ? OR name = ? OR print_name = ? LIMIT 1`,
          [String(po.supplier_id || po.supplier_name || ''), String(po.supplier_name || ''), String(po.supplier_name || '')],
          cId
        ).catch(() => ({ rows: [] }));

        if (smRes.rows?.[0]) {
          const sm = smRes.rows[0];
          documentDetails.party_name = sm.print_name || sm.name || po.supplier_name;
          documentDetails.billing_address = [sm.address1, sm.address2, sm.city, sm.state].filter(Boolean).join(', ') || po.address || '';
          documentDetails.gstin = sm.gst_number || sm.gst_no || '';
          documentDetails.phone = sm.phone_res || sm.mobile1 || '';
        }

        const itemsRes = await db.query(`SELECT * FROM purchase_order_items WHERE purchase_order_id = ? OR po_id = ?`, [po.id, po.id], cId).catch(() => ({ rows: [] }));
        documentDetails.items = (itemsRes.rows || []).map(i => ({
          item_name: i.item_name,
          lot_no: i.lot_no || '—',
          qty: i.quantity || i.qty || 0,
          weight: i.weight || 0,
          rate: i.rate || 0,
          amount: i.amount || ((i.quantity || i.qty || 0) * (i.rate || 0))
        }));
      }
    } else if (docTypeUpper.includes('QUOTATION')) {
      const qRes = await db.query(
        `SELECT * FROM quotations 
         WHERE bill_no = ? OR CAST(s_no AS TEXT) = ? OR CAST(id AS TEXT) = ? OR s_no = ? OR id = ?
         LIMIT 1`,
        [docNoStr, docNoStr, docNoStr, cleanNum, docMeta.document_id || cleanNum],
        cId
      ).catch(() => ({ rows: [] }));

      if (qRes.rows?.[0]) {
        const q = qRes.rows[0];
        documentDetails.date = q.date || documentDetails.date;
        documentDetails.party_name = q.customer || documentDetails.party_name;
        documentDetails.grand_total = q.total_amt || q.amount || q.bill_amt || docMeta.total_amount;
        documentDetails.remarks = q.remarks || '';

        const itemsRes = await db.query(`SELECT * FROM quotation_items WHERE quotation_id = ?`, [q.id], cId).catch(() => ({ rows: [] }));
        documentDetails.items = (itemsRes.rows || []).map(i => ({
          item_name: i.item_name,
          qty: i.qty || 0,
          rate: i.rate || 0,
          amount: i.amount || (i.qty * i.rate) || 0
        }));
      }
    } else if (docTypeUpper.includes('QC') || docTypeUpper.includes('QUALITY')) {
      const qcRes = await db.query(
        `SELECT * FROM qc_inspections 
         WHERE qc_no = ? OR CAST(id AS TEXT) = ? OR rm_lot_no = ? OR id = ?
         LIMIT 1`,
        [docNoStr, docNoStr, docNoStr, docMeta.document_id || cleanNum],
        cId
      ).catch(() => ({ rows: [] }));

      if (qcRes.rows?.[0]) {
        const q = qcRes.rows[0];
        documentDetails.date = q.inspection_date || documentDetails.date;
        documentDetails.party_name = q.supplier || documentDetails.party_name;
        documentDetails.remarks = `Inspector: ${q.inspector || 'QC Team'} | Result: ${q.overall_result || 'PASSED'}`;
        documentDetails.items = [{
          item_name: q.item_name || 'Quality Inspected Raw Material',
          lot_no: q.rm_lot_no,
          qty: q.sample_size || 1,
          rate: 0,
          amount: 0
        }];
      }
    } else if (docTypeUpper.includes('IQR')) {
      const iqrRes = await db.query(
        `SELECT * FROM incoming_quality_reports 
         WHERE iqr_no = ? OR CAST(id AS TEXT) = ? OR rm_lot_no = ? OR id = ?
         LIMIT 1`,
        [docNoStr, docNoStr, docNoStr, docMeta.document_id || cleanNum],
        cId
      ).catch(() => ({ rows: [] }));

      if (iqrRes.rows?.[0]) {
        const iqr = iqrRes.rows[0];
        documentDetails.date = iqr.uploaded_date || documentDetails.date;
        documentDetails.remarks = `IQR Ref: ${iqr.iqr_no} | Lot: ${iqr.rm_lot_no} | ${iqr.remarks || ''}`;
        documentDetails.items = [{
          item_name: 'Raw Grain Lab Sample Verification',
          lot_no: iqr.rm_lot_no,
          qty: 1,
          rate: 0,
          amount: 0
        }];
      }
    }

    // Fallback line item if none resolved
    if (documentDetails.items.length === 0) {
      documentDetails.items = [{
        item_name: docMeta.item_summary || `${docMeta.document_type} - ${docMeta.document_no}`,
        qty: 1,
        rate: docMeta.total_amount,
        amount: docMeta.total_amount
      }];
    }

    // Check payment records
    const payHistory = await paymentProvider.getDocumentPayments(docMeta.document_no);
    if (payHistory.length > 0) {
      documentDetails.payment_status = 'PAID';
      documentDetails.payments = payHistory;
    }

    // Fetch Digital Signatures & Approval Stages
    const sigRes = await db.query(
      `SELECT stage, signed_by_name, signed_by_role, signature_hash, signed_at, certificate_ref 
       FROM document_signatures 
       WHERE document_no = ? 
       ORDER BY id ASC`,
      [docMeta.document_no]
    ).catch(() => ({ rows: [] }));

    const signatures = sigRes.rows || [];

    // Fetch Digital Acknowledgements (Delivery Proofs)
    const ackRes = await db.query(
      `SELECT received_status, received_by, quantity_received, condition, remarks, acknowledged_at, signature_data
       FROM digital_acknowledgements 
       WHERE token = ? OR document_no = ? 
       ORDER BY id DESC LIMIT 1`,
      [token, docMeta.document_no]
    ).catch(() => ({ rows: [] }));

    const latestAcknowledgement = ackRes.rows?.[0] || null;

    // Fetch Document Relationships
    const relationships = await docEngine.getDocumentRelationships(docMeta.document_type, docMeta.document_no, cId);

    // Generate Verification URL & QR
    let origin = req.headers.origin || req.headers.referer;
    if (origin) {
      origin = origin.replace(/\/+$/, '');
      if (origin.includes('/v/')) origin = origin.split('/v/')[0];
      if (origin.includes('/verify-document/')) origin = origin.split('/verify-document/')[0];
    } else {
      let host = req.get('host') || 'localhost:3000';
      if (host.includes(':3001')) host = host.replace(':3001', ':3000');
      const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      origin = `${protocol}://${host}`;
    }

    const verificationUrl = `${origin}/v/${token}`;
    const docQrDataUrl = await QRCode.toDataURL(verificationUrl, {
      margin: 1,
      width: 260,
      color: { dark: '#0f172a', light: '#ffffff' }
    });

    // Generate UPI Payment Link & QR
    const upiLink = generateUpiUri({
      vpa: companyInfo.upiVpa,
      payeeName: companyInfo.name,
      amount: documentDetails.grand_total,
      docNo: docMeta.document_no
    });

    const upiQrDataUrl = (parseFloat(documentDetails.grand_total) > 0) ? await QRCode.toDataURL(upiLink, {
      margin: 1,
      width: 260,
      color: { dark: '#15803d', light: '#ffffff' }
    }) : null;

    res.json({
      success: true,
      token,
      company: companyInfo,
      document: documentDetails,
      signatures,
      acknowledgement: latestAcknowledgement,
      relationships,
      upiLink,
      upiQrDataUrl,
      docQrDataUrl,
      verificationUrl,
      verified: true,
      verifiedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in public document fetch:', error);
    res.status(500).json({ success: false, message: 'Error retrieving verified document', error: error.message });
  }
});

/**
 * POST /api/documents/public/acknowledge/:token
 * Public Endpoint for Customer/Transporter to confirm delivery receipt (Proof of Delivery)
 */
router.post('/public/acknowledge/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const {
      received_status = 'YES',
      received_by,
      quantity_received,
      condition = 'Good',
      remarks,
      signature_data,
      device_info
    } = req.body;

    const tokenRes = await db.query(`SELECT * FROM document_access_tokens WHERE token = ? LIMIT 1`, [token]);
    if (!tokenRes.rows || tokenRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invalid document token' });
    }

    const doc = tokenRes.rows[0];
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

    await db.run(
      `INSERT INTO digital_acknowledgements 
       (token, document_no, received_status, received_by, quantity_received, condition, remarks, signature_data, device_info, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        token,
        doc.document_no,
        received_status,
        received_by || 'Customer Representative',
        quantity_received || '',
        condition,
        remarks || '',
        signature_data || null,
        device_info || req.headers['user-agent'] || '',
        ip
      ]
    );

    // Audit Log
    await docEngine.logDocumentAction({
      companyId: doc.company_id || 1,
      documentType: doc.document_type,
      documentNo: doc.document_no,
      action: 'DELIVERY_ACKNOWLEDGED',
      userName: received_by || 'Customer',
      details: `Proof of delivery signed (${condition})`
    });

    res.json({
      success: true,
      message: 'Digital delivery acknowledgement confirmed and recorded successfully!',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error recording acknowledgement:', error);
    res.status(500).json({ success: false, message: 'Error recording delivery acknowledgement', error: error.message });
  }
});

/**
 * POST /api/documents/public/record-payment/:token
 * Records payment confirmation for an invoice
 */
router.post('/public/record-payment/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { transaction_ref, vpa_id, amount, notes } = req.body;

    const tokenRes = await db.query(`SELECT * FROM document_access_tokens WHERE token = ? LIMIT 1`, [token]);
    if (!tokenRes.rows || tokenRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invalid document token' });
    }

    const doc = tokenRes.rows[0];
    const paidAmount = parseFloat(amount) || doc.total_amount;

    const receipt = await paymentProvider.recordPayment({
      companyId: doc.company_id || 1,
      token,
      documentNo: doc.document_no,
      partyName: doc.party_name,
      amount: paidAmount,
      paymentMode: 'UPI',
      transactionRef: transaction_ref,
      vpaId: vpa_id,
      notes
    });

    // Audit log
    await docEngine.logDocumentAction({
      companyId: doc.company_id || 1,
      documentType: doc.document_type,
      documentNo: doc.document_no,
      action: 'PAYMENT_CONFIRMED',
      userName: 'Payment System',
      details: `Paid ₹${paidAmount} via UPI Ref ${transaction_ref || 'N/A'}`
    });

    res.json({
      success: true,
      message: `Payment of ₹${paidAmount.toLocaleString('en-IN')} verified and logged! Document status updated to PAID.`,
      status: 'PAID',
      receipt
    });
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({ success: false, message: 'Error recording payment', error: error.message });
  }
});

/**
 * POST /api/documents/sign
 * Internal E-Signature Approval Workflow (Prepared By, Checked By, Approved By)
 */
router.post('/sign', async (req, res) => {
  try {
    const {
      document_type,
      document_id,
      document_no,
      stage = 'APPROVED',
      signed_by_name,
      signed_by_role,
      remarks
    } = req.body;

    const cId = req.companyId || req.headers['x-company-id'] || 1;

    const result = await eSignProvider.signDocument({
      companyId: cId,
      documentType: document_type || 'Document',
      documentId: document_id,
      documentNo: document_no,
      stage,
      signedByName: signed_by_name,
      signedByRole: signed_by_role || 'Authorized Signatory',
      remarks
    });

    // Audit log
    await docEngine.logDocumentAction({
      companyId: cId,
      documentType: document_type,
      documentNo: document_no,
      action: 'SIGNED',
      userName: signed_by_name,
      userRole: signed_by_role,
      details: `Digitally signed (${stage}) - Cert: ${result.certificateRef}`
    });

    res.json({
      success: true,
      message: `Document ${document_no} successfully signed (${stage}) by ${signed_by_name}`,
      signature: result
    });
  } catch (error) {
    console.error('Error signing document:', error);
    res.status(500).json({ success: false, message: 'Error signing document', error: error.message });
  }
});

/**
 * GET /api/documents/signatures/:documentNo
 * Fetches all e-signatures for a document
 */
router.get('/signatures/:documentNo', async (req, res) => {
  try {
    const { documentNo } = req.params;
    const verification = await eSignProvider.verifyDocumentSignatures(documentNo);
    res.json({ success: true, ...verification });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching signatures', error: error.message });
  }
});

/**
 * GET /api/documents/audit/:documentNo
 * Fetches audit trail for a document
 */
router.get('/audit/:documentNo', async (req, res) => {
  try {
    const { documentNo } = req.params;
    const cId = req.companyId || req.headers['x-company-id'] || 1;
    const auditLogs = await docEngine.getAuditTrail(documentNo, cId);
    res.json({ success: true, auditLogs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching audit logs', error: error.message });
  }
});

/**
 * GET /api/documents/relationships/:documentNo
 * Fetches connected workflow graph for a document
 */
router.get('/relationships/:documentNo', async (req, res) => {
  try {
    const { documentNo } = req.params;
    const { document_type } = req.query;
    const cId = req.companyId || req.headers['x-company-id'] || 1;
    const relationships = await docEngine.getDocumentRelationships(document_type, documentNo, cId);
    res.json({ success: true, relationships });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching relationships', error: error.message });
  }
});

/**
 * GET /api/documents/barcode-labels
 * Returns printable barcode / QR label payloads for warehouse items & lots
 */
router.get('/barcode-labels', async (req, res) => {
  try {
    const { lot_no, item_name } = req.query;
    const cId = req.companyId || req.headers['x-company-id'] || 1;

    let lotQuery = `SELECT * FROM stock_lots WHERE 1=1`;
    const params = [];
    if (lot_no) {
      lotQuery += ` AND lot_no = ?`;
      params.push(lot_no);
    }
    if (item_name) {
      lotQuery += ` AND item_name = ?`;
      params.push(item_name);
    }
    lotQuery += ` ORDER BY id DESC LIMIT 50`;

    const lotRes = await db.query(lotQuery, params, cId).catch(() => ({ rows: [] }));
    const labels = await Promise.all((lotRes.rows || []).map(async (l) => {
      const qrData = `BVC-LOT|${l.lot_no}|${l.item_name}|${l.remaining_quantity || l.quantity}|${l.godown_name || 'PJ'}`;
      const qrCodeUrl = await QRCode.toDataURL(qrData, { width: 180, margin: 1 });
      return {
        id: l.id,
        lot_no: l.lot_no,
        item_name: l.item_name,
        godown_name: l.godown_name || 'PJ Godown',
        quantity: l.quantity,
        remaining_quantity: l.remaining_quantity,
        rate: l.rate,
        qc_status: l.qc_status || 'ACCEPTED',
        barcode_value: `LOT${(l.lot_no || '').replace(/[^0-9]/g, '').padStart(6, '0')}`,
        qr_code_url: qrCodeUrl
      };
    }));

    res.json({ success: true, labels });
  } catch (error) {
    console.error('Error generating barcode labels:', error);
    res.status(500).json({ success: false, message: 'Error generating barcode labels', error: error.message });
  }
});

module.exports = router;
