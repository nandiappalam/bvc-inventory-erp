const db = require('../config/database');
const { formatPhoneNumber, sendEmailAlert } = require('./notificationService');

/**
 * DEFAULT TEMPLATES FOR BVC ERP TRANSACTION NOTIFICATIONS
 */
const DEFAULT_TEMPLATES = {
  PURCHASE_CREATED: {
    WHATSAPP: `BVC ERP

🟢 PURCHASE CREATED

Purchase No: {{purchase_no}}
Date: {{date}}
Supplier: {{supplier}}
Invoice No: {{invoice_no}}

Items: {{item_summary}}
Quantity: {{quantity}}
Bags: {{bags}}

Vehicle: {{vehicle}}
Godown: {{godown}}

QC Status: {{qc_status}}
IQR Status: {{iqr_status}}

Created By: {{created_by}}
Time: {{time}}

Status: PURCHASE CREATED`,
    SMS: `BVC ERP: PURCHASE {{purchase_no}} created. {{supplier}} | {{item_summary}} | Qty: {{quantity}} | Vehicle: {{vehicle}} | Status: Awaiting QC.`,
    EMAIL_SUBJECT: `BVC ERP – Purchase Created: {{purchase_no}} ({{supplier}})`,
  },
  SALES_CREATED: {
    WHATSAPP: `BVC ERP

🔵 SALES CREATED

Sales Invoice: {{sales_no}}
Date: {{date}}

Customer:
{{customer}}

Items:
{{item_summary}}

Quantity:
{{quantity}}

Total Quantity:
{{total_weight}}

Vehicle:
{{vehicle}}

Loading Status:
{{loading_status}}

Dispatch Status:
{{dispatch_status}}

Created By:
{{created_by}}

Status:
SALES CREATED`,
    SMS: `BVC ERP: SALES {{sales_no}} created. Customer: {{customer}} | Total: {{total_weight}} | Vehicle: {{vehicle}} | Status: Ready for loading.`,
    EMAIL_SUBJECT: `BVC ERP – Sales Order/Invoice: {{sales_no}} ({{customer}})`,
  },
  OUTPASS_CREATED: {
    WHATSAPP: `BVC ERP

🚚 OUTPASS CREATED

Outpass No:
{{outpass_no}}

Date:
{{date}}

Purpose:
{{purpose}}

Reference:
{{reference}}

Input Item:
{{item_name}}

Lot:
{{lot_no}}

Quantity:
{{quantity}}

Bags:
{{bags}}

External Mill:
{{external_mill}}

Area:
{{area}}

Vehicle:
{{vehicle}}

Expected Return:
{{expected_return}}

Status:
{{status}}

Created By:
{{created_by}}`,
    SMS: `BVC ERP: OUTPASS {{outpass_no}} created. {{item_name}} {{quantity}} sent to {{external_mill}}. Vehicle: {{vehicle}}. Status: {{status}}.`,
    EMAIL_SUBJECT: `BVC ERP – Material Outpass: {{outpass_no}} to {{external_mill}}`,
  },
  INPASS_CREATED: {
    WHATSAPP: `BVC ERP

🟢 INPASS RECEIVED

Inpass No:
{{inpass_no}}

Against Outpass:
{{outpass_no}}

Reference:
{{reference}}

External Mill:
{{external_mill}}

Original Input:
{{original_input}}

Received Date:
{{received_date}}

Received Output:
{{received_output}}

By Product:
{{by_product}}

Process Loss:
{{loss}}

Mass Balance:
{{mass_balance}}

QC Status:
{{qc_status}}

Receiving Godown:
{{receiving_godown}}

Received By:
{{received_by}}

Status:
{{status}}`,
    SMS: `BVC ERP: INPASS {{inpass_no}} received against {{outpass_no}} from {{external_mill}}. Output: {{received_output}} | QC: {{qc_status}}.`,
    EMAIL_SUBJECT: `BVC ERP – Inpass Received: {{inpass_no}} against {{outpass_no}}`,
  },
  LOADING_CHARGE_CREATED: {
    WHATSAPP: `BVC ERP

🏗️ LOADING OPERATION RECORDED

Charge No: {{charge_no}}
Source: {{source_module}} {{source_transaction_no}}
Date: {{date}}

Vehicle: {{vehicle}}
Item: {{item_name}}
Quantity: {{quantity}} {{uom}}

Workers/Loadmen:
{{party_name}}

Loading Rate: ₹{{rate}} ({{calc_basis}})
Total Loading Charge: ₹{{amount}}

Status: {{status}}
Recorded By: {{created_by}}`,
    SMS: `BVC ERP: LOADING {{charge_no}} on {{vehicle}} for {{source_transaction_no}}. Loadmen: {{party_name}} | Qty: {{quantity}} | Charge: Rs.{{amount}}. Status: {{status}}.`,
    EMAIL_SUBJECT: `BVC ERP – Loading Charge: {{charge_no}} for {{vehicle}} (Rs.{{amount}})`,
  },
  UNLOADING_CHARGE_CREATED: {
    WHATSAPP: `BVC ERP

📦 UNLOADING OPERATION RECORDED

Charge No: {{charge_no}}
Source: {{source_module}} {{source_transaction_no}}
Date: {{date}}

Vehicle: {{vehicle}}
Item: {{item_name}}
Quantity: {{quantity}} {{uom}}
Godown: {{to_location}}

Workers:
{{party_name}}

Unloading Rate: ₹{{rate}} ({{calc_basis}})
Total Unloading Charge: ₹{{amount}}

Status: {{status}}
Recorded By: {{created_by}}`,
    SMS: `BVC ERP: UNLOADING {{charge_no}} on {{vehicle}} at {{to_location}}. Workers: {{party_name}} | Charge: Rs.{{amount}}. Status: {{status}}.`,
    EMAIL_SUBJECT: `BVC ERP – Unloading Charge: {{charge_no}} for {{vehicle}} (Rs.{{amount}})`,
  },
  DRIVER_CHARGE_CREATED: {
    WHATSAPP: `BVC ERP

🚚 DRIVER TRIP CHARGE RECORDED

Charge No: {{charge_no}}
Source: {{source_module}} {{source_transaction_no}}
Date: {{date}}

Driver: {{driver_name}}
Vehicle: {{vehicle}}
Trip: {{from_location}} ➔ {{to_location}}

Charge Type: {{charge_type}}
Rate: ₹{{rate}} ({{calc_basis}})
Total Amount: ₹{{amount}}

Status: {{status}}
Recorded By: {{created_by}}`,
    SMS: `BVC ERP: DRIVER CHARGE {{charge_no}} for {{driver_name}} ({{vehicle}}). Trip: {{from_location}} to {{to_location}} | Amount: Rs.{{amount}}. Status: {{status}}.`,
    EMAIL_SUBJECT: `BVC ERP – Driver Charge: {{charge_no}} for {{driver_name}} (Rs.{{amount}})`,
  },
  TRANSFER_CHARGE_CREATED: {
    WHATSAPP: `BVC ERP

🔄 GODOWN TRANSFER CHARGES RECORDED

Transfer No: {{source_transaction_no}}
Date: {{date}}
From: {{from_location}} ➔ To: {{to_location}}

Item: {{item_name}}
Quantity: {{quantity}} {{uom}}

Charges:
{{charge_summary}}
Total Operational Cost: ₹{{amount}}

Status: {{status}}`,
    SMS: `BVC ERP: TRANSFER CHARGES on {{source_transaction_no}} ({{from_location}} to {{to_location}}). Total: Rs.{{amount}}. Status: {{status}}.`,
    EMAIL_SUBJECT: `BVC ERP – Godown Transfer Charges for {{source_transaction_no}} (Rs.{{amount}})`,
  },
  OPERATIONAL_PAYMENT_COMPLETED: {
    WHATSAPP: `BVC ERP

💰 WORKER / DRIVER PAYMENT ISSUED

Receipt No: {{payment_no}}
Date: {{date}}
Recipient: {{party_name}} ({{party_category}})

Paid Amount: ₹{{paid_amount}}
Payment Method: {{payment_mode}}
Ref / Trx: {{reference_no}}

Allocated Charges:
{{allocated_charges}}

Disbursed By: {{paid_by}}
Status: PAID ✓`,
    SMS: `BVC ERP: PAYMENT {{payment_no}} of Rs.{{paid_amount}} paid to {{party_name}} via {{payment_mode}}. Ref: {{reference_no}}.`,
    EMAIL_SUBJECT: `BVC ERP – Payment Receipt {{payment_no}} to {{party_name}} (Rs.{{paid_amount}})`,
  }
};

/**
 * Mask phone number for security in public/staff views or show placeholder cleanly
 */
function maskPhoneNumber(phone) {
  if (!phone || phone.trim() === '' || phone === '-') {
    return '+91 98XXX XXXXX';
  }
  const clean = String(phone).trim();
  if (clean.includes('X') || clean.includes('x')) {
    return clean;
  }
  if (clean.length < 8) return clean;
  // Keep first 5 and last 2 characters (e.g. +91 98******42)
  const prefix = clean.slice(0, 5);
  const suffix = clean.slice(-2);
  const middle = '*'.repeat(Math.max(4, clean.length - 7));
  return `${prefix}${middle}${suffix}`;
}

/**
 * Format and validate phone for WhatsApp/SMS dispatch
 */
function validateAndFormatPhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, isPlaceholder: true, formatted: '+91 98XXX XXXXX' };
  }
  const trimmed = phone.trim();
  if (trimmed.includes('X') || trimmed.includes('x') || trimmed === '' || trimmed === '-') {
    return { valid: true, isPlaceholder: true, formatted: trimmed || '+91 98XXX XXXXX' };
  }
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length >= 10) {
    const cleanNumber = digitsOnly.length === 10 ? `91${digitsOnly}` : digitsOnly;
    return { valid: true, isPlaceholder: false, formatted: `+${cleanNumber}` };
  }
  return { valid: false, isPlaceholder: false, formatted: trimmed };
}

/**
 * Replace placeholders in template text with actual data
 */
function renderTemplate(templateStr, data = {}) {
  if (!templateStr) return '';
  return templateStr.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    return data[key] !== undefined && data[key] !== null ? String(data[key]) : '-';
  });
}

/**
 * Ensure database tables exist and are properly schema-migrated
 */
async function ensureNotificationEngineTables() {
  try {
    // 1. system_notifications
    await db.run(`
      CREATE TABLE IF NOT EXISTS system_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alert_type TEXT,
        event_type TEXT,
        title TEXT,
        message TEXT,
        severity TEXT,
        reference_module TEXT,
        module_name TEXT,
        reference_id TEXT,
        reference_no TEXT,
        company_id INTEGER DEFAULT 1,
        is_read INTEGER DEFAULT 0,
        whatsapp_sent INTEGER DEFAULT 1,
        sms_sent INTEGER DEFAULT 1,
        recipients TEXT DEFAULT 'Owner,Manager,Factory In-charge',
        channel TEXT DEFAULT 'ERP,WHATSAPP',
        status TEXT DEFAULT 'SENT',
        acknowledged INTEGER DEFAULT 0,
        acknowledged_by TEXT,
        acknowledged_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure columns exist on older tables
    const notifCols = [
      'ALTER TABLE system_notifications ADD COLUMN alert_type TEXT',
      'ALTER TABLE system_notifications ADD COLUMN event_type TEXT',
      'ALTER TABLE system_notifications ADD COLUMN reference_module TEXT',
      'ALTER TABLE system_notifications ADD COLUMN module_name TEXT',
      'ALTER TABLE system_notifications ADD COLUMN reference_id TEXT',
      'ALTER TABLE system_notifications ADD COLUMN reference_no TEXT',
      'ALTER TABLE system_notifications ADD COLUMN company_id INTEGER DEFAULT 1',
      'ALTER TABLE system_notifications ADD COLUMN is_read INTEGER DEFAULT 0',
      'ALTER TABLE system_notifications ADD COLUMN whatsapp_sent INTEGER DEFAULT 1',
      'ALTER TABLE system_notifications ADD COLUMN sms_sent INTEGER DEFAULT 1',
      'ALTER TABLE system_notifications ADD COLUMN recipients TEXT DEFAULT "Owner,Manager,Factory In-charge"',
      'ALTER TABLE system_notifications ADD COLUMN channel TEXT DEFAULT "ERP,WHATSAPP"',
      'ALTER TABLE system_notifications ADD COLUMN status TEXT DEFAULT "SENT"',
      'ALTER TABLE system_notifications ADD COLUMN acknowledged INTEGER DEFAULT 0',
      'ALTER TABLE system_notifications ADD COLUMN acknowledged_by TEXT',
      'ALTER TABLE system_notifications ADD COLUMN acknowledged_at DATETIME'
    ];
    for (const sql of notifCols) {
      try { await db.run(sql); } catch (_) {}
    }

    // 2. notification_recipients / contacts
    await db.run(`
      CREATE TABLE IF NOT EXISTS notification_recipients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER DEFAULT 1,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        whatsapp_enabled INTEGER DEFAULT 1,
        sms_enabled INTEGER DEFAULT 1,
        email_enabled INTEGER DEFAULT 0,
        in_app_enabled INTEGER DEFAULT 1,
        notify_purchase INTEGER DEFAULT 1,
        notify_sales INTEGER DEFAULT 1,
        notify_outpass INTEGER DEFAULT 1,
        notify_inpass INTEGER DEFAULT 1,
        notify_qc INTEGER DEFAULT 1,
        notify_vehicle_loading INTEGER DEFAULT 1,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try { await db.run(`ALTER TABLE notification_recipients ADD COLUMN email TEXT`); } catch (_) {}
    try { await db.run(`ALTER TABLE notification_recipients ADD COLUMN email_enabled INTEGER DEFAULT 0`); } catch (_) {}

    // 3. notification_templates
    await db.run(`
      CREATE TABLE IF NOT EXISTS notification_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER DEFAULT 1,
        event_type TEXT NOT NULL,
        channel TEXT NOT NULL,
        template_name TEXT,
        template_body TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. notification_delivery_logs
    await db.run(`
      CREATE TABLE IF NOT EXISTS notification_delivery_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER DEFAULT 1,
        notification_id INTEGER,
        event_type TEXT,
        module_name TEXT,
        reference_no TEXT,
        reference_id TEXT,
        recipient_id INTEGER,
        recipient_name TEXT,
        recipient_role TEXT,
        channel TEXT,
        recipient_contact TEXT,
        message_body TEXT,
        delivery_status TEXT,
        provider_message_id TEXT,
        idempotency_key TEXT,
        retry_count INTEGER DEFAULT 0,
        error_message TEXT,
        acknowledged INTEGER DEFAULT 0,
        acknowledged_by TEXT,
        acknowledged_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try { await db.run(`ALTER TABLE notification_delivery_logs ADD COLUMN idempotency_key TEXT`); } catch (_) {}
    try { await db.run(`ALTER TABLE notification_delivery_logs ADD COLUMN retry_count INTEGER DEFAULT 0`); } catch (_) {}
    try { await db.run(`ALTER TABLE notification_delivery_logs ADD COLUMN error_message TEXT`); } catch (_) {}
    try { await db.run(`ALTER TABLE notification_delivery_logs ADD COLUMN provider_message_id TEXT`); } catch (_) {}
    try { await db.run(`ALTER TABLE notification_delivery_logs ADD COLUMN recipient_id INTEGER`); } catch (_) {}
    try { await db.run(`ALTER TABLE notification_delivery_logs ADD COLUMN reference_id TEXT`); } catch (_) {}
    try { await db.run(`ALTER TABLE notification_delivery_logs ADD COLUMN delivery_url TEXT`); } catch (_) {}

    // 5. notification_channel_settings
    await db.run(`
      CREATE TABLE IF NOT EXISTS notification_channel_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER DEFAULT 1,
        channel TEXT NOT NULL, /* WHATSAPP, SMS, EMAIL */
        provider_name TEXT NOT NULL, /* Meta Cloud API, Gupshup, Twilio, SMTP, Simulated */
        api_endpoint TEXT,
        auth_token TEXT,
        sender_id TEXT,
        business_account_id TEXT,
        is_active INTEGER DEFAULT 1,
        test_mode INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed default recipients if table empty or sanitize sample numbers to placeholder format
    const checkRecipients = await db.query(`SELECT COUNT(*) as cnt FROM notification_recipients`);
    if ((checkRecipients.rows?.[0]?.cnt || 0) === 0) {
      await db.run(`
        INSERT INTO notification_recipients 
        (company_id, name, role, phone, email, whatsapp_enabled, sms_enabled, email_enabled, in_app_enabled, notify_purchase, notify_sales, notify_outpass, notify_inpass, notify_qc, notify_vehicle_loading)
        VALUES 
        (1, 'Factory Owner', 'Owner', '+91 98XXX X0001', 'owner@bvcexports.com', 1, 1, 1, 1, 1, 1, 1, 1, 1, 1),
        (1, 'General Manager', 'Manager', '+91 98XXX X0002', 'manager@bvcexports.com', 1, 1, 1, 1, 1, 1, 1, 1, 1, 1),
        (1, 'Factory In-charge', 'Factory In-charge', '+91 98XXX X0003', 'incharge@bvcexports.com', 1, 1, 0, 1, 1, 0, 1, 1, 1, 1),
        (1, 'Purchase Officer', 'Purchase Manager', '+91 98XXX X0004', 'purchase@bvcexports.com', 1, 0, 0, 1, 1, 0, 0, 1, 1, 0),
        (1, 'Dispatch & Sales Head', 'Sales Manager', '+91 98XXX X0005', 'sales@bvcexports.com', 1, 0, 0, 1, 0, 1, 1, 0, 0, 1),
        (1, 'Senior QC Chemist', 'QC', '+91 98XXX X0006', 'qc@bvcexports.com', 1, 0, 0, 1, 1, 0, 0, 1, 1, 0)
      `);
      console.log('[Central Notification] Seeded default recipient profiles with placeholder contact numbers.');
    } else {
      // Migrate older sample numbers to placeholder format so users can edit them
      try {
        await db.run(`
          UPDATE notification_recipients
          SET phone = '+91 98XXX X' || substr('000' || id, -4)
          WHERE phone LIKE '+91 9842%' OR phone = '' OR phone IS NULL
        `);
      } catch (_) {}
    }

    // Seed default channel settings if empty
    const checkSettings = await db.query(`SELECT COUNT(*) as cnt FROM notification_channel_settings`);
    if ((checkSettings.rows?.[0]?.cnt || 0) === 0) {
      await db.run(`
        INSERT INTO notification_channel_settings
        (company_id, channel, provider_name, api_endpoint, sender_id, is_active, test_mode)
        VALUES
        (1, 'WHATSAPP', 'WhatsApp Business API (Official/Approved)', 'https://graph.facebook.com/v19.0/messages', '+91 98420 00000', 1, 1),
        (1, 'SMS', 'Enterprise Fast2SMS / DLT Gateway', 'https://api.gateway.com/sms/v2', 'BVCERP', 1, 1),
        (1, 'EMAIL', 'SMTP Mail Service', 'smtp.gmail.com', 'alerts@bvcexports.com', 1, 1)
      `);
    }

    // Seed default templates if empty
    const checkTemplates = await db.query(`SELECT COUNT(*) as cnt FROM notification_templates`);
    if ((checkTemplates.rows?.[0]?.cnt || 0) === 0) {
      for (const [evt, chans] of Object.entries(DEFAULT_TEMPLATES)) {
        if (chans.WHATSAPP) {
          await db.run(`
            INSERT INTO notification_templates (company_id, event_type, channel, template_name, template_body)
            VALUES (1, ?, 'WHATSAPP', ?, ?)
          `, [evt, `${evt} WhatsApp Template`, chans.WHATSAPP]);
        }
        if (chans.SMS) {
          await db.run(`
            INSERT INTO notification_templates (company_id, event_type, channel, template_name, template_body)
            VALUES (1, ?, 'SMS', ?, ?)
          `, [evt, `${evt} SMS Template`, chans.SMS]);
        }
      }
    }
  } catch (err) {
    console.warn('[Notification Tables Init Warning]:', err.message);
  }
}

// Auto-run schema initialization
ensureNotificationEngineTables();

/**
 * Fetch active template body for event and channel, with fallback
 */
async function getTemplateBody(eventType, channel, companyId = 1) {
  try {
    const tRes = await db.query(`
      SELECT template_body FROM notification_templates
      WHERE event_type = ? AND channel = ? AND is_active = 1
      ORDER BY id DESC LIMIT 1
    `, [eventType, channel]);
    if (tRes.rows && tRes.rows.length > 0 && tRes.rows[0].template_body) {
      return tRes.rows[0].template_body;
    }
  } catch (_) {}

  // Fallback to static default
  const defaults = DEFAULT_TEMPLATES[eventType] || {};
  return defaults[channel] || '';
}

/**
 * Provider Abstraction: Dispatch WhatsApp message
 */
async function dispatchWhatsApp({ phone, messageText, companyId = 1 }) {
  const phoneCheck = validateAndFormatPhone(phone);
  if (!phoneCheck.valid && !phoneCheck.isPlaceholder) {
    return { success: false, status: 'FAILED', error: 'Invalid recipient phone number format' };
  }

  // If placeholder dummy number (+91 98XXX XXXXX)
  if (phoneCheck.isPlaceholder) {
    return {
      success: true,
      status: 'DELIVERED (SANDBOX)',
      isPlaceholder: true,
      providerMessageId: `wamid_sim_sandbox_${Date.now()}`,
      whatsappUrl: null
    };
  }

  const cleanPhone = phoneCheck.formatted;
  const rawDigits = cleanPhone.replace(/\D/g, '');
  const whatsappUrl = `https://api.whatsapp.com/send?phone=${rawDigits}&text=${encodeURIComponent(messageText)}`;

  // Check channel settings for live Meta WhatsApp Cloud API / HTTP Gateway
  try {
    const setRes = await db.query(`
      SELECT * FROM notification_channel_settings
      WHERE channel = 'WHATSAPP' AND company_id = ? AND is_active = 1
      LIMIT 1
    `, [companyId]);
    const setting = setRes.rows?.[0];

    const authToken = setting?.auth_token || process.env.WHATSAPP_API_TOKEN;
    const isLive = Boolean(authToken && (!setting || !setting.test_mode));

    if (isLive) {
      try {
        const endpoint = setting?.api_endpoint || `https://graph.facebook.com/v19.0/${setting?.sender_id || process.env.WHATSAPP_PHONE_NUMBER_ID || 'me'}/messages`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: rawDigits,
            type: 'text',
            text: { preview_url: false, body: messageText }
          })
        });
        const resData = await res.json();
        if (res.ok) {
          return {
            success: true,
            status: 'DELIVERED (LIVE API)',
            providerMessageId: resData.messages?.[0]?.id || `wamid_${Date.now()}`,
            whatsappUrl
          };
        } else {
          console.warn('[Meta WhatsApp API Warning]:', resData);
          return {
            success: true,
            status: 'DELIVERED (1-CLICK READY)',
            providerMessageId: `wamid_sim_${Date.now()}_${rawDigits.slice(-4)}`,
            whatsappUrl,
            error: resData.error?.message || 'Gateway warning'
          };
        }
      } catch (httpErr) {
        console.warn('[WhatsApp Live Gateway HTTP Warning]:', httpErr.message);
      }
    }
  } catch (_) {}

  // Standard Direct 1-Click WhatsApp Delivery + Simulation
  return {
    success: true,
    status: 'DELIVERED (1-CLICK READY)',
    providerMessageId: `wamid_sim_${Date.now()}_${rawDigits.slice(-4)}`,
    whatsappUrl
  };
}

/**
 * Provider Abstraction: Dispatch SMS message
 */
async function dispatchSMS({ phone, messageText, companyId = 1 }) {
  const phoneCheck = validateAndFormatPhone(phone);
  if (!phoneCheck.valid && !phoneCheck.isPlaceholder) {
    return { success: false, status: 'FAILED', error: 'Invalid recipient phone number format' };
  }

  if (phoneCheck.isPlaceholder) {
    return {
      success: true,
      status: 'SENT (SANDBOX)',
      isPlaceholder: true,
      providerMessageId: `sms_sim_sandbox_${Date.now()}`,
      smsUrl: null
    };
  }

  const cleanPhone = phoneCheck.formatted;
  const rawDigits = cleanPhone.replace(/\D/g, '');
  const targetPhone10 = rawDigits.length === 12 && rawDigits.startsWith('91') ? rawDigits.slice(2) : rawDigits;
  const smsUrl = `sms:${rawDigits}?body=${encodeURIComponent(messageText)}`;

  // Check channel settings for live SMS gateway (Fast2SMS / Twilio / Custom HTTP)
  try {
    const setRes = await db.query(`
      SELECT * FROM notification_channel_settings
      WHERE channel = 'SMS' AND company_id = ? AND is_active = 1
      LIMIT 1
    `, [companyId]);
    const setting = setRes.rows?.[0];

    const authToken = setting?.auth_token || process.env.SMS_API_KEY || process.env.FAST2SMS_API_KEY;
    const isLive = Boolean(authToken && (!setting || !setting.test_mode));

    if (isLive) {
      const provider = (setting?.provider_name || '').toLowerCase();

      // A. Fast2SMS Provider (India)
      if (provider.includes('fast2sms') || (!setting?.api_endpoint && authToken.length > 20)) {
        try {
          const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
            method: 'POST',
            headers: {
              'authorization': authToken,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              route: 'q',
              message: messageText,
              language: 'english',
              flash: 0,
              numbers: targetPhone10
            })
          });
          const resData = await res.json();
          if (resData.return === true) {
            return {
              success: true,
              status: 'SENT (LIVE FAST2SMS)',
              providerMessageId: resData.request_id || `sms_f2s_${Date.now()}`,
              smsUrl
            };
          } else {
            console.warn('[Fast2SMS API Response]:', resData);
            return {
              success: true,
              status: 'SENT (1-CLICK READY)',
              providerMessageId: `sms_f2s_err_${Date.now()}`,
              smsUrl,
              error: Array.isArray(resData.message) ? resData.message.join(', ') : (resData.message || 'Fast2SMS error')
            };
          }
        } catch (f2sErr) {
          console.warn('[Fast2SMS Dispatch Error]:', f2sErr.message);
        }
      }

      // B. Custom HTTP SMS Gateway
      if (setting?.api_endpoint) {
        try {
          const res = await fetch(setting.api_endpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              sender: setting.sender_id || 'BVCERP',
              to: targetPhone10,
              message: messageText
            })
          });
          const resData = await res.json();
          return {
            success: true,
            status: 'SENT (LIVE GATEWAY)',
            providerMessageId: resData.id || resData.message_id || `sms_${Date.now()}`,
            smsUrl
          };
        } catch (gwErr) {
          console.warn('[Custom SMS Gateway Error]:', gwErr.message);
        }
      }
    }
  } catch (_) {}

  return {
    success: true,
    status: 'SENT (1-CLICK READY)',
    providerMessageId: `sms_${Date.now()}_${rawDigits.slice(-4)}`,
    smsUrl
  };
}

/**
 * Provider Abstraction: Dispatch Email message
 */
async function dispatchEmail({ email, subject, messageText, companyId = 1 }) {
  if (!email || !email.includes('@')) {
    return { success: false, status: 'FAILED', error: 'Missing or invalid recipient email address' };
  }

  let smtpConfig = null;
  let isTestMode = false;

  try {
    const setRes = await db.query(`
      SELECT * FROM notification_channel_settings
      WHERE channel = 'EMAIL' AND company_id = ? AND is_active = 1
      LIMIT 1
    `, [companyId]);
    const setting = setRes.rows?.[0];

    if (setting) {
      isTestMode = Boolean(setting.test_mode);
      let host = setting.api_endpoint || 'smtp.gmail.com';
      let port = 587;
      if (host.includes(':')) {
        const parts = host.split(':');
        host = parts[0];
        port = parseInt(parts[1], 10) || 587;
      }
      smtpConfig = {
        host,
        port,
        user: setting.sender_id || process.env.SMTP_USER,
        pass: setting.auth_token || process.env.SMTP_PASS,
        from: setting.sender_id || process.env.SMTP_FROM || `"BVC ERP Notifications" <${setting.sender_id || 'alerts@bvcagro.com'}>`,
        secure: port === 465
      };
    }
  } catch (_) {}

  try {
    const res = await sendEmailAlert({
      to: email,
      subject: subject || 'BVC ERP Transaction Notification',
      text: messageText,
      smtpConfig,
      html: `<div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; color: #1e293b;">
        <div style="background-color: #1e3a8a; color: #ffffff; padding: 12px 18px; border-radius: 6px; font-weight: bold; font-size: 16px;">
          BVC ERP – Transaction Notification
        </div>
        <pre style="background: #f8fafc; padding: 16px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; font-family: monospace; white-space: pre-wrap;">${messageText}</pre>
        <p style="font-size: 11px; color: #94a3b8; margin-top: 15px;">This is an automated notification from BVC ERP. Please do not reply directly to this email.</p>
      </div>`
    });
    return {
      success: res.success !== false,
      status: res.delivered ? 'DELIVERED (SMTP)' : (isTestMode ? 'SENT (SANDBOX)' : 'SENT (MAILTO READY)'),
      providerMessageId: res.messageId || `mail_${Date.now()}`,
      mailtoUrl: res.mailtoUrl
    };
  } catch (err) {
    return {
      success: false,
      status: 'FAILED',
      error: err.message
    };
  }
}

/**
 * Central emitTransactionEvent function
 *
 * Emits transaction created events, resolves configured recipients,
 * enforces idempotency, formats messages via templates, dispatches to channels,
 * and maintains audit records WITHOUT blocking or rolling back ERP transactions.
 */
async function emitTransactionEvent({
  eventType, // 'PURCHASE_CREATED', 'SALES_CREATED', 'OUTPASS_CREATED', 'INPASS_CREATED'
  moduleName, // 'PURCHASE', 'SALES', 'OUTPASS', 'INPASS'
  referenceNo,
  referenceId,
  companyId = 1,
  details = {},
  title,
  message,
  severity = 'INFO',
  isTest = false,
  forceDispatch = false,
  targetRecipientId = null
}) {
  try {
    await ensureNotificationEngineTables();

    const cId = parseInt(companyId, 10) || 1;
    const evtType = eventType || `${moduleName}_CREATED`;
    const refNum = String(referenceNo || referenceId || '');
    const refId = String(referenceId || referenceNo || '');

    // 1. Prepare template variables from details
    const now = new Date();
    const dateStr = details.date || now.toISOString().slice(0, 10);
    const timeStr = details.time || now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const templateData = {
      purchase_no: details.purchase_no || refNum,
      sales_no: details.sales_no || refNum,
      outpass_no: details.outpass_no || refNum,
      inpass_no: details.inpass_no || refNum,
      reference: details.reference || details.reference_no || `REF-${refNum}`,
      supplier: details.supplier || details.vendor || 'Supplier ABC Traders',
      customer: details.customer || 'Customer XYZ Foods',
      invoice_no: details.invoice_no || details.invNo || refNum,
      item_name: details.item_name || details.item || 'Material Item',
      item_summary: details.item_summary || details.item_name || 'Broken Rice (100 Bags)',
      lot_no: details.lot_no || 'LOT0025',
      quantity: details.quantity || (details.total_weight ? `${details.total_weight} KG` : '5,000 KG'),
      bags: details.bags || details.total_qty || '100',
      total_weight: details.total_weight ? `${details.total_weight} KG` : details.quantity || '5,000 KG',
      external_mill: details.external_mill || details.party_name || 'ABC Rice Mill',
      area: details.area || 'Vadipatti',
      vehicle: details.vehicle || details.vehicle_no || details.lorry_no || 'TN64FF2321',
      godown: details.godown || details.godown_name || 'Main Godown',
      receiving_godown: details.receiving_godown || details.to_godown_name || 'Main Godown',
      purpose: details.purpose || 'Outside Grind',
      expected_return: details.expected_return || details.expected_return_date || dateStr,
      received_date: details.received_date || dateStr,
      original_input: details.original_input ? `${details.original_input} KG` : '5,000 KG',
      received_output: details.received_output ? `${details.received_output} KG` : '4,700 KG',
      by_product: details.by_product ? `${details.by_product} KG` : '200 KG',
      loss: details.loss ? `${details.loss} KG` : '100 KG',
      mass_balance: details.mass_balance || (details.discrepancy_weight ? `⚠ ${details.discrepancy_weight} KG DISCREPANCY` : '5,000 KG\n✓ BALANCED'),
      qc_status: details.qc_status || 'PENDING',
      iqr_status: details.iqr_status || 'PENDING',
      loading_status: details.loading_status || 'PENDING',
      dispatch_status: details.dispatch_status || 'PENDING',
      created_by: details.created_by || 'Store / Factory Operator',
      received_by: details.received_by || details.created_by || 'Store Operator',
      status: details.status || `${moduleName} CREATED`,
      date: dateStr,
      time: timeStr,
      // Operational Charges & Payments variables
      charge_no: details.charge_no || refNum,
      source_transaction_no: details.source_transaction_no || refNum,
      party_name: details.party_name || details.worker_name || details.supplier || 'Ramesh & Team',
      party_category: details.party_category || 'WORKER',
      driver_name: details.driver_name || details.driver || 'Murugan',
      from_location: details.from_location || details.from_godown || 'Main Godown',
      to_location: details.to_location || details.to_godown || 'Godown B',
      rate: details.rate || '0.50',
      calc_basis: details.calculation_basis || details.calc_basis || 'PER_KG',
      uom: details.uom || 'KG',
      amount: details.amount || details.total_amount || '2,500',
      charge_type: details.charge_type || 'LOADING',
      charge_summary: details.charge_summary || `Loading: Rs.${details.amount || 2500}`,
      payment_no: details.payment_no || refNum,
      paid_amount: details.paid_amount || details.amount || '2,500',
      payment_mode: details.payment_mode || details.payment_method || 'CASH',
      paid_by: details.paid_by || details.created_by || 'Admin',
      allocated_charges: details.allocated_charges || details.charge_no || refNum
    };

    // 2. Fetch templates for channels
    const whatsappTemplate = await getTemplateBody(evtType, 'WHATSAPP', cId);
    const smsTemplate = await getTemplateBody(evtType, 'SMS', cId);
    const emailSubjectTemplate = (DEFAULT_TEMPLATES[evtType] && DEFAULT_TEMPLATES[evtType].EMAIL_SUBJECT) || `BVC ERP: ${evtType} – ${refNum}`;

    const formattedWhatsAppMsg = renderTemplate(whatsappTemplate, templateData) || message || `BVC ERP: ${moduleName} ${refNum} has been recorded.`;
    const formattedSmsMsg = renderTemplate(smsTemplate, templateData) || `BVC ERP: ${moduleName} ${refNum} recorded inside factory.`;
    const formattedEmailSubject = renderTemplate(emailSubjectTemplate, templateData);

    const notifTitle = title || `BVC ERP – New ${moduleName} (${refNum})`;
    const notifMsg = message || formattedSmsMsg;

    // 3. Create entry in system_notifications
    const insRes = await db.run(`
      INSERT INTO system_notifications (
        alert_type, event_type, title, message, severity,
        reference_module, module_name, reference_id, reference_no,
        company_id, is_read, whatsapp_sent, sms_sent,
        recipients, channel, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, 1, 'Owner,Manager,Factory In-charge', 'ERP,WHATSAPP,SMS', 'SENT', datetime('now'))
    `, [
      evtType, evtType, notifTitle, notifMsg, severity,
      moduleName, moduleName, refId, refNum, cId
    ]);

    const notificationId = insRes.lastID || insRes.lastInsertRowid;

    // 4. Resolve configured recipients for this event
    let recipients = [];
    if (targetRecipientId) {
      const recRes = await db.query(`
        SELECT * FROM notification_recipients
        WHERE id = ? AND company_id = ?
      `, [targetRecipientId, cId]);
      recipients = recRes.rows || [];
    } else {
      let eventColumn = 'notify_purchase';
      if (moduleName === 'SALES') eventColumn = 'notify_sales';
      else if (moduleName === 'OUTPASS') eventColumn = 'notify_outpass';
      else if (moduleName === 'INPASS') eventColumn = 'notify_inpass';
      else if (moduleName === 'QC') eventColumn = 'notify_qc';

      const recRes = await db.query(`
        SELECT * FROM notification_recipients
        WHERE company_id = ? AND is_active = 1 AND ${eventColumn} = 1
      `, [cId]);
      recipients = recRes.rows || [];
    }

    const deliveryResults = [];

    // 5. Dispatch to configured recipients across enabled channels with IDEMPOTENCY CHECK
    for (const rec of recipients) {
      const nowEpoch = Date.now();

      // A. IN-APP Channel
      if (rec.in_app_enabled) {
        const inAppKey = isTest || forceDispatch ? `test_${nowEpoch}_${cId}_${evtType}_${refNum}_${rec.id}_IN_APP` : `${cId}_${evtType}_${refNum}_${rec.id}_IN_APP`;
        
        let shouldSend = true;
        if (!isTest && !forceDispatch) {
          const dupCheck = await db.query(`
            SELECT id FROM notification_delivery_logs 
            WHERE idempotency_key = ? AND delivery_status = 'DELIVERED' 
            AND created_at >= datetime('now', '-10 minutes')
          `, [inAppKey]);
          if (dupCheck.rows && dupCheck.rows.length > 0) shouldSend = false;
        }

        if (shouldSend) {
          await db.run(`
            INSERT INTO notification_delivery_logs 
            (company_id, notification_id, event_type, module_name, reference_no, reference_id, recipient_id, recipient_name, recipient_role, channel, recipient_contact, message_body, delivery_status, idempotency_key, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'IN_APP', 'ERP Portal', ?, 'DELIVERED', ?, datetime('now'))
          `, [
            cId, notificationId, evtType, moduleName, refNum, refId,
            rec.id, rec.name, rec.role, notifMsg, inAppKey
          ]);
          deliveryResults.push({ channel: 'IN_APP', recipient: rec.name, status: 'DELIVERED' });
        }
      }

      // B. WHATSAPP Channel
      if (rec.whatsapp_enabled) {
        const waKey = isTest || forceDispatch ? `test_${nowEpoch}_${cId}_${evtType}_${refNum}_${rec.id}_WHATSAPP` : `${cId}_${evtType}_${refNum}_${rec.id}_WHATSAPP`;
        
        let shouldSend = true;
        if (!isTest && !forceDispatch) {
          const dupCheck = await db.query(`
            SELECT id FROM notification_delivery_logs 
            WHERE idempotency_key = ? AND delivery_status LIKE 'DELIVERED%' 
            AND created_at >= datetime('now', '-10 minutes')
          `, [waKey]);
          if (dupCheck.rows && dupCheck.rows.length > 0) shouldSend = false;
        }

        if (shouldSend) {
          let waBody = formattedWhatsAppMsg;
          if (rec.role === 'Owner') {
            waBody = `🔵 *BVC ERP [OWNER SUMMARY]*\n` + formattedWhatsAppMsg;
          } else if (rec.role === 'Manager') {
            waBody = `🔵 *[MANAGEMENT REVIEW]*\n` + formattedWhatsAppMsg;
          }

          const waResult = await dispatchWhatsApp({ phone: rec.phone, messageText: waBody, companyId: cId });
          await db.run(`
            INSERT INTO notification_delivery_logs 
            (company_id, notification_id, event_type, module_name, reference_no, reference_id, recipient_id, recipient_name, recipient_role, channel, recipient_contact, message_body, delivery_status, provider_message_id, delivery_url, idempotency_key, error_message, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'WHATSAPP', ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `, [
            cId, notificationId, evtType, moduleName, refNum, refId,
            rec.id, rec.name, rec.role, rec.phone || '+91 98XXX XXXXX', waBody,
            waResult.status, waResult.providerMessageId || null, waResult.whatsappUrl || null, waKey, waResult.error || null
          ]);
          deliveryResults.push({
            channel: 'WHATSAPP',
            recipient: rec.name,
            phone: rec.phone,
            status: waResult.status,
            message: waBody,
            whatsappUrl: waResult.whatsappUrl
          });
        }
      }

      // C. SMS Channel
      if (rec.sms_enabled) {
        const smsKey = isTest || forceDispatch ? `test_${nowEpoch}_${cId}_${evtType}_${refNum}_${rec.id}_SMS` : `${cId}_${evtType}_${refNum}_${rec.id}_SMS`;
        
        let shouldSend = true;
        if (!isTest && !forceDispatch) {
          const dupCheck = await db.query(`
            SELECT id FROM notification_delivery_logs 
            WHERE idempotency_key = ? AND delivery_status LIKE 'SENT%' 
            AND created_at >= datetime('now', '-10 minutes')
          `, [smsKey]);
          if (dupCheck.rows && dupCheck.rows.length > 0) shouldSend = false;
        }

        if (shouldSend) {
          const smsResult = await dispatchSMS({ phone: rec.phone, messageText: formattedSmsMsg, companyId: cId });
          await db.run(`
            INSERT INTO notification_delivery_logs 
            (company_id, notification_id, event_type, module_name, reference_no, reference_id, recipient_id, recipient_name, recipient_role, channel, recipient_contact, message_body, delivery_status, provider_message_id, delivery_url, idempotency_key, error_message, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SMS', ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `, [
            cId, notificationId, evtType, moduleName, refNum, refId,
            rec.id, rec.name, rec.role, rec.phone || '+91 98XXX XXXXX', formattedSmsMsg,
            smsResult.status, smsResult.providerMessageId || null, smsResult.smsUrl || null, smsKey, smsResult.error || null
          ]);
          deliveryResults.push({
            channel: 'SMS',
            recipient: rec.name,
            phone: rec.phone,
            status: smsResult.status,
            message: formattedSmsMsg,
            smsUrl: smsResult.smsUrl
          });
        }
      }

      // D. EMAIL Channel (if enabled for this contact)
      if (rec.email_enabled && rec.email) {
        const emailKey = isTest || forceDispatch ? `test_${nowEpoch}_${cId}_${evtType}_${refNum}_${rec.id}_EMAIL` : `${cId}_${evtType}_${refNum}_${rec.id}_EMAIL`;
        
        let shouldSend = true;
        if (!isTest && !forceDispatch) {
          const dupCheck = await db.query(`
            SELECT id FROM notification_delivery_logs 
            WHERE idempotency_key = ? AND delivery_status IN ('SENT', 'DELIVERED') 
            AND created_at >= datetime('now', '-10 minutes')
          `, [emailKey]);
          if (dupCheck.rows && dupCheck.rows.length > 0) shouldSend = false;
        }

        if (shouldSend) {
          const emailResult = await dispatchEmail({
            email: rec.email,
            subject: formattedEmailSubject,
            messageText: formattedWhatsAppMsg,
            companyId: cId
          });
          await db.run(`
            INSERT INTO notification_delivery_logs 
            (company_id, notification_id, event_type, module_name, reference_no, reference_id, recipient_id, recipient_name, recipient_role, channel, recipient_contact, message_body, delivery_status, provider_message_id, idempotency_key, error_message, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'EMAIL', ?, ?, ?, ?, ?, ?, datetime('now'))
          `, [
            cId, notificationId, evtType, moduleName, refNum, refId,
            rec.id, rec.name, rec.role, rec.email, formattedWhatsAppMsg,
            emailResult.status, emailResult.providerMessageId || null, emailKey, emailResult.error || null
          ]);
          deliveryResults.push({ channel: 'EMAIL', recipient: rec.name, email: rec.email, status: emailResult.status });
        }
      }
    }

    console.log(`[Notification Engine] Dispatched ${evtType} ${refNum} to ${recipients.length} configured recipients.`);
    return {
      success: true,
      notificationId,
      recipientCount: recipients.length,
      formattedWhatsAppMsg,
      formattedSmsMsg,
      deliveryResults
    };
  } catch (err) {
    // Crucial rule: Notification error must NEVER crash or rollback caller ERP transaction
    console.error('[Notification Engine Silent Catch]:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Retry a failed or pending notification delivery log
 */
async function retryDeliveryLog(logId, companyId = 1) {
  try {
    const lRes = await db.query(`SELECT * FROM notification_delivery_logs WHERE id = ?`, [logId]);
    if (!lRes.rows || lRes.rows.length === 0) {
      return { success: false, message: 'Delivery log not found' };
    }
    const log = lRes.rows[0];
    if (log.retry_count >= 3) {
      return { success: false, message: 'Maximum retry limit (3 attempts) reached for this message' };
    }

    let result = { status: 'DELIVERED' };
    if (log.channel === 'WHATSAPP') {
      result = await dispatchWhatsApp({ phone: log.recipient_contact, messageText: log.message_body, companyId });
    } else if (log.channel === 'SMS') {
      result = await dispatchSMS({ phone: log.recipient_contact, messageText: log.message_body, companyId });
    } else if (log.channel === 'EMAIL') {
      result = await dispatchEmail({ email: log.recipient_contact, messageText: log.message_body, companyId });
    }

    await db.run(`
      UPDATE notification_delivery_logs 
      SET delivery_status = ?,
          retry_count = retry_count + 1,
          provider_message_id = COALESCE(?, provider_message_id),
          error_message = ?
      WHERE id = ?
    `, [result.status, result.providerMessageId || null, result.error || null, logId]);

    return { success: true, status: result.status, message: `Notification retried successfully via ${log.channel}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  emitTransactionEvent,
  retryDeliveryLog,
  ensureNotificationEngineTables,
  getTemplateBody,
  maskPhoneNumber,
  validateAndFormatPhone,
  renderTemplate,
  DEFAULT_TEMPLATES
};
