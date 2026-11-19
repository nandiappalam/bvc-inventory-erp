const express = require('express');
const router = express.Router();
const db = require('../config/database');
const {
  emitTransactionEvent,
  retryDeliveryLog,
  ensureNotificationEngineTables,
  maskPhoneNumber
} = require('../services/transactionNotificationEngine');
const whatsappServerService = require('../services/whatsappServerService');

function getActiveCompanyId(req) {
  return req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1) || 1;
}

function buildTestSampleDetails(moduleName, ref, overrides = {}) {
  const mod = String(moduleName || 'PURCHASE').toUpperCase();
  const today = new Date().toISOString().slice(0, 10);
  const base = {
    outpass_no: ref,
    purchase_no: ref,
    sales_no: ref,
    inpass_no: ref,
    reference_no: ref,
    date: today,
    supplier: overrides.supplier || 'ABC Agro Traders',
    customer: overrides.customer || 'XYZ Foods Pvt Ltd',
    party_name: overrides.party_name || (mod.includes('SALES') ? 'XYZ Foods Pvt Ltd' : 'ABC Agro Traders'),
    invoice_no: overrides.invoice_no || `INV-${ref}`,
    item_name: overrides.item_name || 'Urad Whole / Broken Rice',
    item_summary: overrides.item_summary || 'Urad Whole Grade-A (100 Bags / 5,000 KG)',
    quantity: overrides.quantity || '5,000 KG',
    bags: overrides.bags || '100',
    total_weight: overrides.total_weight || '5,000 KG',
    amount: overrides.amount || 245000,
    external_mill: overrides.external_mill || 'Sri Murugan Rice & Flour Mill',
    godown: overrides.godown || 'Main Godown',
    from_location: overrides.from_location || 'Main Godown',
    to_location: overrides.to_location || 'Packing Godown B',
    vehicle: overrides.vehicle || 'TN64FF2321',
    purpose: overrides.purpose || 'Outside Grind',
    payment_mode: overrides.payment_mode || 'BANK / NEFT',
    expected_return: overrides.expected_return || today,
    qc_status: 'PENDING',
    remarks: overrides.remarks || 'Automated live WhatsApp verification test from ERP',
    created_by: overrides.created_by || 'Admin',
    action_label: overrides.action_label || mod.replace(/_/g, ' '),
    module_label: overrides.module_label || mod.replace(/_/g, ' '),
    ...overrides
  };

  let eventType = `${mod}_CREATED`;
  if (['GRIND', 'FLOUR_OUT', 'FLOUR_OUT_RETURN', 'PAPAD_IN', 'PAPAD_RETURN', 'PACKING', 'WORK_ORDER', 'WEIGHT_CONVERSION'].includes(mod)) {
    eventType = 'PRODUCTION_CREATED';
  } else if (mod === 'ITEM_TRANSFER' || mod === 'GODOWN_TRANSFER') {
    eventType = 'GODOWN_TRANSFER_CREATED';
  } else if (['QUOTATION', 'PURCHASE_ORDER', 'PURCHASE_REQUEST', 'EXPORT_ORDER'].includes(mod)) {
    eventType = 'ORDER_CREATED';
  } else if (mod === 'ADVANCE' || mod === 'VOUCHER') {
    eventType = 'VOUCHER_CREATED';
  }

  return { eventType, details: base };
}

// ============================================================================
// MAIN COMPANY SERVER WHATSAPP SESSION MANAGEMENT (QR / PAIRING CODE)
// ============================================================================

// GET Main Company Server WhatsApp status
router.get('/whatsapp/status', async (req, res) => {
  try {
    const status = await whatsappServerService.getSessionStatus(whatsappServerService.DEFAULT_SESSION_KEY);
    res.json({ success: true, ...status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Connect / Generate QR or 8-digit Pairing Code
router.post('/whatsapp/connect', async (req, res) => {
  try {
    const { mode = 'qr', phoneNumber = '', fresh = false } = req.body || {};
    const status = await whatsappServerService.connectSession({
      sessionKey: whatsappServerService.DEFAULT_SESSION_KEY,
      mode: mode === 'pairing' ? 'pairing' : 'qr',
      phoneNumber,
      fresh: Boolean(fresh)
    });
    res.json({ success: true, ...status });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST Disconnect / Logout Main Company Server WhatsApp
router.post('/whatsapp/disconnect', async (req, res) => {
  try {
    const status = await whatsappServerService.disconnectSession(whatsappServerService.DEFAULT_SESSION_KEY);
    res.json({ success: true, message: 'Server WhatsApp disconnected', ...status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Send Direct WhatsApp message from linked Server WhatsApp
router.post('/whatsapp/send-direct', async (req, res) => {
  try {
    const { phone, message } = req.body || {};
    if (!phone || !message) {
      return res.status(400).json({ success: false, error: 'Recipient phone number and message text are required' });
    }
    const result = await whatsappServerService.sendMessage({
      to: phone,
      text: message,
      sessionKey: whatsappServerService.DEFAULT_SESSION_KEY
    });
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// LIVE NOTIFICATIONS, ACTIVITY FEED & ACKNOWLEDGEMENT
// ============================================================================

// 1. GET live notifications & summary metrics for notification bell & dashboard
router.get('/live', async (req, res) => {
  try {
    const activeCompanyId = getActiveCompanyId(req);
    await ensureNotificationEngineTables(activeCompanyId);
    const compDb = db.forCompany(activeCompanyId);

    let alerts = [];
    try {
      const saved = await compDb.query(`
        SELECT * FROM system_notifications
        WHERE company_id = ?
        ORDER BY id DESC
        LIMIT 50
      `, [activeCompanyId]);
      alerts = saved.rows || [];
    } catch (_) {
      alerts = [];
    }

    try {
      const tempAlerts = await compDb.query(`
        SELECT c.id, c.chamber_name, c.current_temp, c.critical_temp, c.status
        FROM cs_chambers c
        WHERE c.status IN ('WARNING', 'CRITICAL')
      `);
      (tempAlerts.rows || []).forEach(ch => {
        alerts.unshift({
          id: `dyn-temp-${ch.id}`,
          alert_type: 'TEMP_ALERT',
          title: `Cold Storage Temp Alert: ${ch.chamber_name}`,
          message: `Chamber running at ${ch.current_temp}°C (Critical Limit: ${ch.critical_temp}°C).`,
          severity: ch.status === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
          reference_module: 'COLD_STORAGE',
          reference_id: String(ch.id),
          is_read: 0,
          created_at: new Date().toISOString()
        });
      });
    } catch (_) {}

    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const overdueOps = await compDb.query(`
        SELECT id, outpass_no, party_name, total_weight, returned_weight, expected_return_date
        FROM outpasses
        WHERE status NOT IN ('CLOSED', 'CANCELLED')
          AND expected_return_date IS NOT NULL
          AND expected_return_date != ''
          AND expected_return_date < ?
        LIMIT 5
      `, [todayStr]);
      (overdueOps.rows || []).forEach(op => {
        const pendingKg = (parseFloat(op.total_weight) || 0) - (parseFloat(op.returned_weight) || 0);
        alerts.unshift({
          id: `dyn-overdue-${op.id}`,
          alert_type: 'OUTSIDE_MILL_OVERDUE',
          title: `Outside Mill Return Overdue: ${op.outpass_no}`,
          message: `${op.party_name} has ${pendingKg.toLocaleString()} KG pending. Expected Return was ${op.expected_return_date}.`,
          severity: 'WARNING',
          reference_module: 'OUTPASS',
          reference_id: op.outpass_no,
          is_read: 0,
          created_at: new Date().toISOString()
        });
      });
    } catch (_) {}

    const unreadCount = alerts.filter(a => !a.is_read).length;
    const pendingConfirmations = alerts.filter(a => !a.acknowledged).length;

    res.json({
      success: true,
      count: unreadCount,
      pendingConfirmations,
      alerts
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. GET Factory Live Activity Feed
router.get('/live-activity', async (req, res) => {
  try {
    const activeCompanyId = getActiveCompanyId(req);
    await ensureNotificationEngineTables(activeCompanyId);
    const compDb = db.forCompany(activeCompanyId);

    const logs = await compDb.query(`
      SELECT
        sn.id,
        sn.alert_type,
        sn.event_type,
        sn.title,
        sn.message,
        sn.severity,
        sn.reference_module,
        sn.module_name,
        sn.reference_id,
        sn.reference_no,
        sn.is_read,
        sn.whatsapp_sent,
        sn.sms_sent,
        sn.acknowledged,
        sn.acknowledged_by,
        sn.acknowledged_at,
        sn.created_at
      FROM system_notifications sn
      WHERE sn.company_id = ?
      ORDER BY sn.id DESC
      LIMIT 100
    `, [activeCompanyId]);

    res.json({ success: true, activities: logs.rows || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. POST Acknowledge / Confirm a transaction
router.post('/acknowledge/:id', async (req, res) => {
  try {
    const activeCompanyId = getActiveCompanyId(req);
    await ensureNotificationEngineTables(activeCompanyId);
    const compDb = db.forCompany(activeCompanyId);
    const { id } = req.params;
    const { acknowledged_by = 'Manager' } = req.body || {};
    const nowStr = new Date().toISOString();

    if (!id.startsWith('dyn-')) {
      const notifId = parseInt(id, 10);
      await compDb.run(`
        UPDATE system_notifications
        SET acknowledged = 1,
            acknowledged_by = ?,
            acknowledged_at = ?,
            is_read = 1
        WHERE id = ? AND company_id = ?
      `, [acknowledged_by, nowStr, notifId, activeCompanyId]);

      await compDb.run(`
        UPDATE notification_delivery_logs
        SET acknowledged = 1,
            acknowledged_by = ?,
            acknowledged_at = ?
        WHERE notification_id = ? AND company_id = ?
      `, [acknowledged_by, nowStr, notifId, activeCompanyId]);
    }

    res.json({
      success: true,
      message: `Transaction acknowledged by ${acknowledged_by}`,
      acknowledged_by,
      acknowledged_at: nowStr
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. POST Mark notification as read
router.post('/mark-read/:id', async (req, res) => {
  try {
    const activeCompanyId = getActiveCompanyId(req);
    await ensureNotificationEngineTables(activeCompanyId);
    const compDb = db.forCompany(activeCompanyId);
    const { id } = req.params;
    if (!id.startsWith('dyn-')) {
      await compDb.run('UPDATE system_notifications SET is_read = 1 WHERE id = ? AND company_id = ?', [parseInt(id, 10), activeCompanyId]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. POST Mark all notifications as read
router.post('/mark-all-read', async (req, res) => {
  try {
    const activeCompanyId = getActiveCompanyId(req);
    await ensureNotificationEngineTables(activeCompanyId);
    const compDb = db.forCompany(activeCompanyId);
    await compDb.run('UPDATE system_notifications SET is_read = 1 WHERE company_id = ?', [activeCompanyId]);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. GET Audit Delivery History Logs (WhatsApp, SMS, Email, In-App)
router.get('/delivery-logs', async (req, res) => {
  try {
    const activeCompanyId = getActiveCompanyId(req);
    await ensureNotificationEngineTables(activeCompanyId);
    const compDb = db.forCompany(activeCompanyId);

    const { channel, module_name, limit = 100, unmask } = req.query;
    let sql = `SELECT * FROM notification_delivery_logs WHERE company_id = ?`;
    const params = [activeCompanyId];

    if (channel && channel !== 'ALL') {
      sql += ` AND channel = ?`;
      params.push(channel.toUpperCase());
    }
    if (module_name && module_name !== 'ALL') {
      sql += ` AND (module_name = ? OR event_type LIKE ?)`;
      params.push(module_name.toUpperCase(), `%${module_name.toUpperCase()}%`);
    }

    sql += ` ORDER BY id DESC LIMIT ?`;
    params.push(parseInt(limit, 10) || 100);

    const result = await compDb.query(sql, params);
    const logs = (result.rows || []).map(log => {
      const rawContact = log.recipient_contact || '';
      const rawDigits = rawContact.replace(/\D/g, '');
      let dynamicUrl = log.delivery_url;
      if (!dynamicUrl && rawDigits.length >= 10 && !rawContact.includes('X') && !rawContact.includes('*')) {
        if (log.channel === 'WHATSAPP') {
          dynamicUrl = `https://api.whatsapp.com/send?phone=${rawDigits}&text=${encodeURIComponent(log.message_body || '')}`;
        } else if (log.channel === 'SMS') {
          dynamicUrl = `sms:${rawDigits}?body=${encodeURIComponent(log.message_body || '')}`;
        }
      }

      return {
        ...log,
        delivery_url: dynamicUrl,
        raw_contact: rawContact,
        recipient_contact_masked: log.channel === 'IN_APP' ? rawContact : maskPhoneNumber(rawContact),
        recipient_contact: unmask === 'true' || log.channel === 'IN_APP' ? rawContact : maskPhoneNumber(rawContact)
      };
    });

    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. POST Retry delivery log
router.post('/retry/:id', async (req, res) => {
  try {
    const activeCompanyId = getActiveCompanyId(req);
    const { id } = req.params;
    const retryRes = await retryDeliveryLog(id, activeCompanyId);
    if (!retryRes.success) {
      return res.status(400).json(retryRes);
    }
    res.json(retryRes);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. GET / POST / PUT / DELETE Notification Recipients
router.get('/recipients', async (req, res) => {
  try {
    const activeCompanyId = getActiveCompanyId(req);
    await ensureNotificationEngineTables(activeCompanyId);
    const compDb = db.forCompany(activeCompanyId);

    const { unmask } = req.query;
    const result = await compDb.query(
      `SELECT * FROM notification_recipients WHERE company_id = ? ORDER BY id ASC`,
      [activeCompanyId]
    );
    const recipients = (result.rows || []).map(r => ({
      ...r,
      description: r.description || '',
      phone_raw: r.phone || '',
      phone_masked: maskPhoneNumber(r.phone),
      phone: unmask === 'true' ? (r.phone || '') : maskPhoneNumber(r.phone)
    }));
    res.json({ success: true, recipients });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/recipients', async (req, res) => {
  try {
    const activeCompanyId = getActiveCompanyId(req);
    await ensureNotificationEngineTables(activeCompanyId);
    const compDb = db.forCompany(activeCompanyId);

    const {
      name,
      role,
      description = '',
      phone,
      email,
      whatsapp_enabled = 1,
      sms_enabled = 0,
      email_enabled = 0,
      in_app_enabled = 1,
      notify_purchase = 1,
      notify_purchase_return = 1,
      notify_sales = 1,
      notify_sales_return = 1,
      notify_godown_transfer = 1,
      notify_production = 1,
      notify_vouchers = 1,
      notify_outpass = 1,
      notify_inpass = 1,
      notify_qc = 1,
      notify_vehicle_loading = 1,
      notify_all = 0
    } = req.body;

    if (!name || !role) {
      return res.status(400).json({ success: false, message: 'Name and Role are required' });
    }

    const savedPhone = phone && String(phone).trim() !== '' ? String(phone).trim() : '';
    if ((whatsapp_enabled || sms_enabled) && !savedPhone) {
      return res.status(400).json({ success: false, message: 'WhatsApp / Mobile number is required' });
    }

    const ins = await compDb.run(`
      INSERT INTO notification_recipients (
        company_id, name, role, description, phone, email,
        whatsapp_enabled, sms_enabled, email_enabled, in_app_enabled,
        notify_purchase, notify_purchase_return, notify_sales, notify_sales_return,
        notify_godown_transfer, notify_production, notify_vouchers,
        notify_outpass, notify_inpass, notify_qc, notify_vehicle_loading, notify_all
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      activeCompanyId,
      String(name).trim(),
      String(role).trim(),
      String(description || '').trim(),
      savedPhone,
      email || '',
      whatsapp_enabled ? 1 : 0,
      sms_enabled ? 1 : 0,
      email_enabled ? 1 : 0,
      in_app_enabled ? 1 : 0,
      notify_purchase ? 1 : 0,
      notify_purchase_return ? 1 : 0,
      notify_sales ? 1 : 0,
      notify_sales_return ? 1 : 0,
      notify_godown_transfer ? 1 : 0,
      notify_production ? 1 : 0,
      notify_vouchers ? 1 : 0,
      notify_outpass ? 1 : 0,
      notify_inpass ? 1 : 0,
      notify_qc ? 1 : 0,
      notify_vehicle_loading ? 1 : 0,
      notify_all ? 1 : 0
    ]);

    res.status(201).json({ success: true, message: 'Recipient contact created', id: ins.lastID });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/recipients/:id', async (req, res) => {
  try {
    const activeCompanyId = getActiveCompanyId(req);
    await ensureNotificationEngineTables(activeCompanyId);
    const compDb = db.forCompany(activeCompanyId);

    const { id } = req.params;
    const {
      name,
      role,
      description,
      phone,
      email,
      whatsapp_enabled,
      sms_enabled,
      email_enabled,
      in_app_enabled,
      notify_purchase,
      notify_purchase_return,
      notify_sales,
      notify_sales_return,
      notify_godown_transfer,
      notify_production,
      notify_vouchers,
      notify_outpass,
      notify_inpass,
      notify_qc,
      notify_vehicle_loading,
      notify_all,
      is_active
    } = req.body;

    // Never overwrite a real saved phone number with a UI-masked value
    const cleanPhone = phone && !String(phone).includes('*') && String(phone).trim() !== ''
      ? String(phone).trim()
      : null;

    await compDb.run(`
      UPDATE notification_recipients SET
        name = ?,
        role = ?,
        description = ?,
        phone = COALESCE(?, phone),
        email = ?,
        whatsapp_enabled = ?,
        sms_enabled = ?,
        email_enabled = ?,
        in_app_enabled = ?,
        notify_purchase = ?,
        notify_purchase_return = ?,
        notify_sales = ?,
        notify_sales_return = ?,
        notify_godown_transfer = ?,
        notify_production = ?,
        notify_vouchers = ?,
        notify_outpass = ?,
        notify_inpass = ?,
        notify_qc = ?,
        notify_vehicle_loading = ?,
        notify_all = ?,
        is_active = ?
      WHERE id = ? AND company_id = ?
    `, [
      name,
      role,
      description !== undefined ? String(description || '').trim() : '',
      cleanPhone,
      email || '',
      whatsapp_enabled ? 1 : 0,
      sms_enabled ? 1 : 0,
      email_enabled ? 1 : 0,
      in_app_enabled ? 1 : 0,
      notify_purchase ? 1 : 0,
      notify_purchase_return ? 1 : 0,
      notify_sales ? 1 : 0,
      notify_sales_return ? 1 : 0,
      notify_godown_transfer ? 1 : 0,
      notify_production ? 1 : 0,
      notify_vouchers ? 1 : 0,
      notify_outpass ? 1 : 0,
      notify_inpass ? 1 : 0,
      notify_qc ? 1 : 0,
      notify_vehicle_loading ? 1 : 0,
      notify_all ? 1 : 0,
      is_active !== undefined ? (is_active ? 1 : 0) : 1,
      id,
      activeCompanyId
    ]);

    res.json({ success: true, message: 'Recipient settings updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/recipients/:id', async (req, res) => {
  try {
    const activeCompanyId = getActiveCompanyId(req);
    await ensureNotificationEngineTables(activeCompanyId);
    const compDb = db.forCompany(activeCompanyId);
    const { id } = req.params;
    await compDb.run(`DELETE FROM notification_recipients WHERE id = ? AND company_id = ?`, [id, activeCompanyId]);
    res.json({ success: true, message: 'Recipient removed' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Direct test alert for a single recipient
router.post('/recipients/:id/test-alert', async (req, res) => {
  try {
    const activeCompanyId = getActiveCompanyId(req);
    await ensureNotificationEngineTables(activeCompanyId);
    const compDb = db.forCompany(activeCompanyId);

    const { id } = req.params;
    const { moduleName = 'PURCHASE', referenceNo } = req.body || {};

    const rCheck = await compDb.query(`SELECT * FROM notification_recipients WHERE id = ? AND company_id = ?`, [id, activeCompanyId]);
    if (!rCheck.rows || rCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Recipient contact not found' });
    }
    const recipient = rCheck.rows[0];
    const ref = referenceNo || `${moduleName.slice(0, 3).toUpperCase()}-TEST-${Math.floor(1000 + Math.random() * 9000)}`;
    const sample = buildTestSampleDetails(moduleName, ref);

    const eventResult = await emitTransactionEvent({
      eventType: sample.eventType,
      moduleName,
      referenceNo: ref,
      companyId: activeCompanyId,
      isTest: true,
      forceDispatch: true,
      targetRecipientId: recipient.id,
      details: sample.details
    });

    res.json({
      success: true,
      message: `Test alert processed for ${recipient.name} (${recipient.role})`,
      recipient: recipient.name,
      contact: recipient.phone,
      formattedWhatsAppMsg: eventResult.formattedWhatsAppMsg,
      formattedSmsMsg: eventResult.formattedSmsMsg,
      deliveryResults: eventResult.deliveryResults
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. GET / PUT Notification Templates
router.get('/templates', async (req, res) => {
  try {
    const activeCompanyId = getActiveCompanyId(req);
    await ensureNotificationEngineTables(activeCompanyId);
    const compDb = db.forCompany(activeCompanyId);

    const result = await compDb.query(`SELECT * FROM notification_templates WHERE company_id = ? ORDER BY event_type, channel`, [activeCompanyId]);
    res.json({ success: true, templates: result.rows || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/templates/:id', async (req, res) => {
  try {
    const activeCompanyId = getActiveCompanyId(req);
    await ensureNotificationEngineTables(activeCompanyId);
    const compDb = db.forCompany(activeCompanyId);
    const { id } = req.params;
    const { template_body, is_active } = req.body;

    await compDb.run(`
      UPDATE notification_templates SET
        template_body = ?,
        is_active = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND company_id = ?
    `, [template_body, is_active !== undefined ? (is_active ? 1 : 0) : 1, id, activeCompanyId]);

    res.json({ success: true, message: 'Notification template updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. GET / PUT Channel Provider Settings
router.get('/channels', async (req, res) => {
  try {
    const activeCompanyId = getActiveCompanyId(req);
    await ensureNotificationEngineTables(activeCompanyId);
    const compDb = db.forCompany(activeCompanyId);

    const result = await compDb.query(`SELECT id, company_id, channel, provider_name, api_endpoint, sender_id, is_active, test_mode, updated_at FROM notification_channel_settings WHERE company_id = ?`, [activeCompanyId]);
    res.json({ success: true, channels: result.rows || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/channels/:id', async (req, res) => {
  try {
    const activeCompanyId = getActiveCompanyId(req);
    await ensureNotificationEngineTables(activeCompanyId);
    const compDb = db.forCompany(activeCompanyId);
    const { id } = req.params;
    const { provider_name, api_endpoint, sender_id, auth_token, is_active, test_mode } = req.body;

    let sql = `
      UPDATE notification_channel_settings SET
        provider_name = ?,
        api_endpoint = ?,
        sender_id = ?,
        is_active = ?,
        test_mode = ?,
        updated_at = CURRENT_TIMESTAMP
    `;
    const params = [
      provider_name, api_endpoint, sender_id,
      is_active !== undefined ? (is_active ? 1 : 0) : 1,
      test_mode !== undefined ? (test_mode ? 1 : 0) : 1
    ];

    if (auth_token && auth_token.trim() !== '' && !auth_token.includes('****')) {
      sql += `, auth_token = ?`;
      params.push(auth_token);
    }

    sql += ` WHERE id = ? AND company_id = ?`;
    params.push(id, activeCompanyId);

    await compDb.run(sql, params);
    res.json({ success: true, message: 'Channel provider configuration saved' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11. Test simulation endpoint (dispatches across all subscribed recipients for module)
router.post('/test-send', async (req, res) => {
  try {
    const activeCompanyId = getActiveCompanyId(req);
    const { moduleName = 'PURCHASE', referenceNo, details = {} } = req.body || {};
    const ref = referenceNo || `${moduleName.slice(0, 3).toUpperCase()}-TEST-${Math.floor(1000 + Math.random() * 9000)}`;
    const sample = buildTestSampleDetails(moduleName, ref, details);

    const eventResult = await emitTransactionEvent({
      eventType: sample.eventType,
      moduleName,
      referenceNo: ref,
      companyId: activeCompanyId,
      isTest: true,
      forceDispatch: true,
      details: sample.details
    });

    res.json({
      success: true,
      message: `Notification event dispatched for ${moduleName} ${ref}`,
      recipientCount: eventResult.recipientCount,
      formattedWhatsAppMsg: eventResult.formattedWhatsAppMsg,
      formattedSmsMsg: eventResult.formattedSmsMsg,
      deliveryResults: eventResult.deliveryResults
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
