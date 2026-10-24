const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { emitTransactionEvent, retryDeliveryLog, ensureNotificationEngineTables, maskPhoneNumber } = require('../services/transactionNotificationEngine');

// Ensure tables exist on load
ensureNotificationEngineTables();

// 1. GET live notifications & summary metrics for notification bell & dashboard
router.get('/live', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);

    // 1. Saved system notifications
    let alerts = [];
    try {
      const saved = await db.query(`
        SELECT * FROM system_notifications 
        WHERE company_id = ?
        ORDER BY id DESC 
        LIMIT 50
      `, [activeCompanyId]);
      alerts = saved.rows || [];
    } catch (_) {
      alerts = [];
    }

    // 2. Dynamic live alerts (Cold storage temp warnings)
    try {
      const tempAlerts = await db.query(`
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

    // 3. Overdue Outside Mill Processing alerts (> expected_return_date and not closed)
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const overdueOps = await db.query(`
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
          title: `⚠️ Outside Mill Return Overdue: ${op.outpass_no}`,
          message: `${op.party_name} has ${pendingKg.toLocaleString()} KG pending. Expected Return was ${op.expected_return_date}.`,
          severity: 'WARNING',
          reference_module: 'OUTPASS',
          reference_id: op.outpass_no,
          is_read: 0,
          created_at: new Date().toISOString()
        });
      });
    } catch (_) {}

    // Unread count
    const unreadCount = alerts.filter(a => !a.is_read).length;
    const pendingConfirmations = alerts.filter(a => !a.acknowledged && (a.reference_module === 'OUTPASS' || a.reference_module === 'INPASS' || a.reference_module === 'PURCHASE' || a.reference_module === 'SALES')).length;

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

// 2. GET Factory Live Activity Feed (Chronological operations stream)
router.get('/live-activity', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);

    const logs = await db.query(`
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

// 3. POST Acknowledge / Confirm a transaction from Notification Center
router.post('/acknowledge/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { acknowledged_by = 'Manager', remarks = '' } = req.body;
    const nowStr = new Date().toISOString();

    if (!id.startsWith('dyn-')) {
      await db.run(`
        UPDATE system_notifications 
        SET acknowledged = 1,
            acknowledged_by = ?,
            acknowledged_at = ?,
            is_read = 1
        WHERE id = ?
      `, [acknowledged_by, nowStr, parseInt(id, 10)]);

      // Also update delivery logs
      await db.run(`
        UPDATE notification_delivery_logs
        SET acknowledged = 1,
            acknowledged_by = ?,
            acknowledged_at = ?
        WHERE notification_id = ?
      `, [acknowledged_by, nowStr, parseInt(id, 10)]);
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
    const { id } = req.params;
    if (!id.startsWith('dyn-')) {
      await db.run('UPDATE system_notifications SET is_read = 1 WHERE id = ?', [parseInt(id, 10)]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. POST Mark all notifications as read
router.post('/mark-all-read', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    await db.run('UPDATE system_notifications SET is_read = 1 WHERE company_id = ?', [activeCompanyId]);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. GET Audit Delivery History Logs (WhatsApp, SMS, Email, In-App)
router.get('/delivery-logs', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
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
    params.push(parseInt(limit, 10));

    const result = await db.query(sql, params);
    const logs = (result.rows || []).map(log => {
      const rawContact = log.recipient_contact || '';
      const rawDigits = rawContact.replace(/\D/g, '');
      let dynamicUrl = log.delivery_url;
      if (!dynamicUrl && rawDigits.length >= 10) {
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
        recipient_contact: unmask === 'true' ? rawContact : maskPhoneNumber(rawContact)
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
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
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
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const { unmask } = req.query;
    const result = await db.query(`SELECT * FROM notification_recipients WHERE company_id = ? ORDER BY id ASC`, [activeCompanyId]);
    const recipients = (result.rows || []).map(r => ({
      ...r,
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
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const {
      name, role, phone, email, whatsapp_enabled, sms_enabled, email_enabled, in_app_enabled,
      notify_purchase, notify_sales, notify_outpass, notify_inpass, notify_qc, notify_vehicle_loading
    } = req.body;
    
    if (!name || !role) {
      return res.status(400).json({ success: false, message: 'Name and Role are required' });
    }

    const savedPhone = phone && phone.trim() !== '' ? phone.trim() : '+91 98XXX XXXXX';

    const ins = await db.run(`
      INSERT INTO notification_recipients 
      (company_id, name, role, phone, email, whatsapp_enabled, sms_enabled, email_enabled, in_app_enabled, notify_purchase, notify_sales, notify_outpass, notify_inpass, notify_qc, notify_vehicle_loading)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      activeCompanyId, name, role, savedPhone, email || '',
      whatsapp_enabled ? 1 : 0,
      sms_enabled ? 1 : 0,
      email_enabled ? 1 : 0,
      in_app_enabled ? 1 : 0,
      notify_purchase ? 1 : 0,
      notify_sales ? 1 : 0,
      notify_outpass ? 1 : 0,
      notify_inpass ? 1 : 0,
      notify_qc ? 1 : 0,
      notify_vehicle_loading ? 1 : 0
    ]);

    res.status(201).json({ success: true, message: 'Recipient contact created', id: ins.lastID });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/recipients/:id', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const { id } = req.params;
    const {
      name, role, phone, email, whatsapp_enabled, sms_enabled, email_enabled, in_app_enabled,
      notify_purchase, notify_sales, notify_outpass, notify_inpass, notify_qc, notify_vehicle_loading, is_active
    } = req.body;

    await db.run(`
      UPDATE notification_recipients SET
        name = ?,
        role = ?,
        phone = COALESCE(?, phone),
        email = ?,
        whatsapp_enabled = ?,
        sms_enabled = ?,
        email_enabled = ?,
        in_app_enabled = ?,
        notify_purchase = ?,
        notify_sales = ?,
        notify_outpass = ?,
        notify_inpass = ?,
        notify_qc = ?,
        notify_vehicle_loading = ?,
        is_active = ?
      WHERE id = ? AND company_id = ?
    `, [
      name, role, phone, email || '',
      whatsapp_enabled ? 1 : 0,
      sms_enabled ? 1 : 0,
      email_enabled ? 1 : 0,
      in_app_enabled ? 1 : 0,
      notify_purchase ? 1 : 0,
      notify_sales ? 1 : 0,
      notify_outpass ? 1 : 0,
      notify_inpass ? 1 : 0,
      notify_qc ? 1 : 0,
      notify_vehicle_loading ? 1 : 0,
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
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const { id } = req.params;
    await db.run(`DELETE FROM notification_recipients WHERE id = ? AND company_id = ?`, [id, activeCompanyId]);
    res.json({ success: true, message: 'Recipient removed' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Direct test alert for a single recipient
router.post('/recipients/:id/test-alert', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const { id } = req.params;
    const { moduleName = 'OUTPASS', referenceNo } = req.body;

    const rCheck = await db.query(`SELECT * FROM notification_recipients WHERE id = ? AND company_id = ?`, [id, activeCompanyId]);
    if (!rCheck.rows || rCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Recipient contact not found' });
    }
    const recipient = rCheck.rows[0];
    const ref = referenceNo || `${moduleName.slice(0, 2).toUpperCase()}-TEST-${Math.floor(1000 + Math.random() * 9000)}`;

    const eventResult = await emitTransactionEvent({
      moduleName,
      referenceNo: ref,
      companyId: activeCompanyId,
      isTest: true,
      forceDispatch: true,
      targetRecipientId: recipient.id,
      details: {
        outpass_no: ref,
        purchase_no: ref,
        sales_no: ref,
        inpass_no: ref,
        supplier: 'ABC Traders',
        customer: 'XYZ Foods',
        item_name: 'Raw Rice / Broken Rice',
        item_summary: 'Raw Rice 50 KG (100 Bags)',
        quantity: '5,000 KG',
        bags: '100',
        total_weight: '5,000 KG',
        external_mill: 'ABC Rice Mill',
        vehicle: 'TN64FF2321',
        purpose: 'Outside Grind',
        expected_return: new Date().toISOString().slice(0, 10),
        qc_status: 'PENDING'
      }
    });

    res.json({
      success: true,
      message: `Test alert successfully sent to ${recipient.name} (${recipient.role}) via enabled channels!`,
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
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const result = await db.query(`SELECT * FROM notification_templates WHERE company_id = ? ORDER BY event_type, channel`, [activeCompanyId]);
    res.json({ success: true, templates: result.rows || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/templates/:id', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const { id } = req.params;
    const { template_body, is_active } = req.body;

    await db.run(`
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
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const result = await db.query(`SELECT id, company_id, channel, provider_name, api_endpoint, sender_id, is_active, test_mode, updated_at FROM notification_channel_settings WHERE company_id = ?`, [activeCompanyId]);
    res.json({ success: true, channels: result.rows || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/channels/:id', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
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

    await db.run(sql, params);
    res.json({ success: true, message: 'Channel provider configuration saved' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11. Test simulation endpoint
router.post('/test-send', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const { moduleName = 'OUTPASS', referenceNo, details = {} } = req.body;
    const ref = referenceNo || `${moduleName.slice(0, 2).toUpperCase()}-TEST-${Math.floor(1000 + Math.random() * 9000)}`;

    const eventResult = await emitTransactionEvent({
      moduleName,
      referenceNo: ref,
      companyId: activeCompanyId,
      isTest: true,
      forceDispatch: true,
      details: {
        ...details,
        outpass_no: ref,
        purchase_no: ref,
        sales_no: ref,
        inpass_no: ref,
        supplier: details.supplier || 'ABC Traders',
        customer: details.customer || 'XYZ Foods',
        item_name: details.item_name || 'Broken Rice',
        item_summary: details.item_summary || 'Broken Rice (100 Bags)',
        quantity: details.quantity || '5,000 KG',
        bags: details.bags || '100',
        external_mill: details.external_mill || 'ABC Rice Mill',
        vehicle: details.vehicle || 'TN64FF2321',
        purpose: details.purpose || 'Outside Grind',
        expected_return: details.expected_return || new Date().toISOString().slice(0, 10),
        qc_status: 'PENDING'
      }
    });

    res.json({
      success: true,
      message: `Test notification event dispatched for ${moduleName} ${ref}`,
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
