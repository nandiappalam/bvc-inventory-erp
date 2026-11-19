const db = require('../config/database');
const { formatPhoneNumber, sendEmailAlert } = require('./notificationService');
const whatsappServerService = require('./whatsappServerService');
const { resolveFlourMillInfo, isNumericId } = require('../utils/millResolver');
const { resolveCustomerName } = require('../utils/customerResolver');

const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';

function formatDateInTimeZone(dateObj = new Date(), timeZone = APP_TIMEZONE) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(dateObj);
  } catch (_) {
    return dateObj.toISOString().slice(0, 10);
  }
}

function formatTimeInTimeZone(dateObj = new Date(), timeZone = APP_TIMEZONE) {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(dateObj);
  } catch (_) {
    return dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
}

const ensuredNotificationCompanies = new Set();
if (typeof db.registerCacheInvalidator === 'function') {
  db.registerCacheInvalidator((companyId) => {
    if (companyId) {
      ensuredNotificationCompanies.delete(Number(companyId));
    } else {
      ensuredNotificationCompanies.clear();
    }
  });
}

/**
 * DEFAULT TEMPLATES FOR BVC ERP TRANSACTION NOTIFICATIONS
 */
const DEFAULT_TEMPLATES = {
  PURCHASE_CREATED: {
    WHATSAPP: `{{company_name}}

🟢 *PURCHASE CREATED*

Purchase No: {{purchase_no}}
Date: {{date}}
Supplier: {{supplier}}
Invoice No: {{invoice_no}}

Items: {{item_summary}}
Quantity: {{quantity}}
Bags: {{bags}}
Amount: {{amount_display}}

Vehicle: {{vehicle}}
Godown: {{godown}}

QC Status: {{qc_status}}
IQR Status: {{iqr_status}}

Created By: {{created_by}}
Time: {{time}}`,
    SMS: `{{company_name}}: PURCHASE {{purchase_no}} created. {{supplier}} | {{item_summary}} | Qty: {{quantity}} | Amt: {{amount_display}}.`,
    EMAIL_SUBJECT: `{{company_name}} – Purchase Created: {{purchase_no}} ({{supplier}})`
  },
  SALES_CREATED: {
    WHATSAPP: `{{company_name}}

🔵 *SALES CREATED*

Sales Invoice: {{sales_no}}
Date: {{date}}
Customer: {{customer}}

Items: {{item_summary}}
Quantity: {{quantity}}
Total Weight: {{total_weight}}
Amount: {{amount_display}}

Vehicle: {{vehicle}}
Godown: {{godown}}
Loading Status: {{loading_status}}
Dispatch Status: {{dispatch_status}}

Created By: {{created_by}}
Time: {{time}}`,
    SMS: `{{company_name}}: SALES {{sales_no}} created. Customer: {{customer}} | Total: {{total_weight}} | Amt: {{amount_display}}.`,
    EMAIL_SUBJECT: `{{company_name}} – Sales Created: {{sales_no}} ({{customer}})`
  },
  PURCHASE_RETURN_CREATED: {
    WHATSAPP: `{{company_name}}

🟠 *PURCHASE RETURN CREATED*

Return No: {{reference_no}}
Date: {{date}}
Supplier: {{supplier}}
Against Invoice: {{invoice_no}}

Items: {{item_summary}}
Quantity: {{quantity}}
Amount: {{amount_display}}
Reason/Remarks: {{remarks}}

Created By: {{created_by}}
Time: {{time}}`,
    SMS: `{{company_name}}: PURCHASE RETURN {{reference_no}} to {{supplier}}. {{item_summary}} | Qty: {{quantity}} | Amt: {{amount_display}}.`,
    EMAIL_SUBJECT: `{{company_name}} – Purchase Return: {{reference_no}} ({{supplier}})`
  },
  SALES_RETURN_CREATED: {
    WHATSAPP: `{{company_name}}

🟡 *SALES RETURN CREATED*

Return No: {{reference_no}}
Date: {{date}}
Customer: {{customer}}
Against Invoice: {{invoice_no}}

Items: {{item_summary}}
Quantity: {{quantity}}
Amount: {{amount_display}}
Reason/Remarks: {{remarks}}

Created By: {{created_by}}
Time: {{time}}`,
    SMS: `{{company_name}}: SALES RETURN {{reference_no}} from {{customer}}. {{item_summary}} | Qty: {{quantity}} | Amt: {{amount_display}}.`,
    EMAIL_SUBJECT: `{{company_name}} – Sales Return: {{reference_no}} ({{customer}})`
  },
  GODOWN_TRANSFER_CREATED: {
    WHATSAPP: `{{company_name}}

🔄 *GODOWN / STOCK TRANSFER*

Transfer No: {{reference_no}}
Date: {{date}}
From Godown: {{from_location}}
To Godown: {{to_location}}

Items: {{item_summary}}
Quantity: {{quantity}}
Vehicle: {{vehicle}}
Remarks: {{remarks}}

Created By: {{created_by}}
Time: {{time}}`,
    SMS: `{{company_name}}: TRANSFER {{reference_no}} from {{from_location}} to {{to_location}}. {{item_summary}} | Qty: {{quantity}}.`,
    EMAIL_SUBJECT: `{{company_name}} – Godown Transfer: {{reference_no}} ({{from_location}} -> {{to_location}})`
  },
  PRODUCTION_CREATED: {
    WHATSAPP: `{{company_name}}

⚙️ *{{action_label}} RECORDED*

Ref No: {{reference_no}}
Date: {{date}}
Module: {{module_label}}
Party / Mill: {{party_name}}

Items: {{item_summary}}
Quantity: {{quantity}}
Godown: {{godown}}
Status: {{status}}

Created By: {{created_by}}
Time: {{time}}`,
    SMS: `{{company_name}}: {{module_label}} {{reference_no}} recorded. {{item_summary}} | Qty: {{quantity}} | Status: {{status}}.`,
    EMAIL_SUBJECT: `{{company_name}} – {{module_label}}: {{reference_no}}`
  },
  COLD_STORAGE_CREATED: {
    WHATSAPP: `{{company_name}}

❄️ *COLD STORAGE ENTRY*

Voucher No: {{reference_no}}
Type: {{action_label}}
Date: {{date}}
Chamber: {{godown}}

Items: {{item_summary}}
Quantity: {{quantity}}
Party: {{party_name}}
Remarks: {{remarks}}

Created By: {{created_by}}
Time: {{time}}`,
    SMS: `{{company_name}}: COLD STORAGE {{action_label}} {{reference_no}} at {{godown}}. {{item_summary}} | Qty: {{quantity}}.`,
    EMAIL_SUBJECT: `{{company_name}} – Cold Storage {{action_label}}: {{reference_no}}`
  },
  STOCK_ADJUST_CREATED: {
    WHATSAPP: `{{company_name}}

📊 *STOCK ADJUSTMENT / OPENING*

Ref No: {{reference_no}}
Date: {{date}}
Godown: {{godown}}
Type: {{action_label}}

Items: {{item_summary}}
Quantity: {{quantity}}
Remarks: {{remarks}}

Created By: {{created_by}}
Time: {{time}}`,
    SMS: `{{company_name}}: STOCK ADJUSTMENT {{reference_no}} ({{action_label}}). {{item_summary}} | Qty: {{quantity}}.`,
    EMAIL_SUBJECT: `{{company_name}} – Stock Adjustment: {{reference_no}}`
  },
  VOUCHER_CREATED: {
    WHATSAPP: `{{company_name}}

💳 *ACCOUNTING / VOUCHER ENTRY*

Voucher No: {{reference_no}}
Type: {{action_label}}
Date: {{date}}
Party / Account: {{party_name}}
Mode: {{payment_mode}}

Amount: {{amount_display}}
Narration: {{remarks}}

Created By: {{created_by}}
Time: {{time}}`,
    SMS: `{{company_name}}: {{action_label}} {{reference_no}} for {{party_name}} | Amt: {{amount_display}} | Mode: {{payment_mode}}.`,
    EMAIL_SUBJECT: `{{company_name}} – {{action_label}}: {{reference_no}} ({{amount_display}})`
  },
  ORDER_CREATED: {
    WHATSAPP: `{{company_name}}

📋 *{{action_label}} CREATED*

Ref No: {{reference_no}}
Date: {{date}}
Party: {{party_name}}

Items: {{item_summary}}
Quantity: {{quantity}}
Amount: {{amount_display}}
Status: {{status}}

Created By: {{created_by}}
Time: {{time}}`,
    SMS: `{{company_name}}: {{action_label}} {{reference_no}} for {{party_name}}. {{item_summary}} | Qty: {{quantity}} | Amt: {{amount_display}}.`,
    EMAIL_SUBJECT: `{{company_name}} – {{action_label}}: {{reference_no}}`
  },
  OUTPASS_CREATED: {
    WHATSAPP: `{{company_name}}

🚚 *OUTPASS CREATED*

Outpass No: {{outpass_no}}
Date: {{date}}
Purpose: {{purpose}}
Reference: {{reference}}

Input Item: {{item_name}}
Lot: {{lot_no}}
Quantity: {{quantity}}
Bags: {{bags}}

External Mill: {{external_mill}}
Area: {{area}}
Vehicle: {{vehicle}}
Expected Return: {{expected_return}}

Status: {{status}}
Created By: {{created_by}}
Time: {{time}}`,
    SMS: `{{company_name}}: OUTPASS {{outpass_no}} created. {{item_name}} {{quantity}} sent to {{external_mill}}. Vehicle: {{vehicle}}.`,
    EMAIL_SUBJECT: `{{company_name}} – Material Outpass: {{outpass_no}} to {{external_mill}}`
  },
  INPASS_CREATED: {
    WHATSAPP: `{{company_name}}

🟢 *INPASS RECEIVED*

Inpass No: {{inpass_no}}
Against Outpass: {{outpass_no}}
Reference: {{reference}}
External Mill: {{external_mill}}

Original Input: {{original_input}}
Received Date: {{received_date}}
Received Output: {{received_output}}
By Product: {{by_product}}
Process Loss: {{loss}}
Mass Balance: {{mass_balance}}

QC Status: {{qc_status}}
Receiving Godown: {{receiving_godown}}
Received By: {{received_by}}
Status: {{status}}
Time: {{time}}`,
    SMS: `{{company_name}}: INPASS {{inpass_no}} received against {{outpass_no}} from {{external_mill}}. Output: {{received_output}} | QC: {{qc_status}}.`,
    EMAIL_SUBJECT: `{{company_name}} – Inpass Received: {{inpass_no}} against {{outpass_no}}`
  },
  LOADING_CHARGE_CREATED: {
    WHATSAPP: `{{company_name}}

🏗️ *LOADING OPERATION RECORDED*

Charge No: {{charge_no}}
Source: {{source_module}} {{source_transaction_no}}
Date: {{date}}

Vehicle: {{vehicle}}
Item: {{item_name}}
Quantity: {{quantity}} {{uom}}

Workers/Loadmen: {{party_name}}
Loading Rate: ₹{{rate}} ({{calc_basis}})
Total Loading Charge: ₹{{amount}}

Status: {{status}}
Recorded By: {{created_by}}
Time: {{time}}`,
    SMS: `{{company_name}}: LOADING {{charge_no}} on {{vehicle}} for {{source_transaction_no}}. Loadmen: {{party_name}} | Charge: Rs.{{amount}}.`,
    EMAIL_SUBJECT: `{{company_name}} – Loading Charge: {{charge_no}} for {{vehicle}} (Rs.{{amount}})`
  },
  UNLOADING_CHARGE_CREATED: {
    WHATSAPP: `{{company_name}}

📦 *UNLOADING OPERATION RECORDED*

Charge No: {{charge_no}}
Source: {{source_module}} {{source_transaction_no}}
Date: {{date}}

Vehicle: {{vehicle}}
Item: {{item_name}}
Quantity: {{quantity}} {{uom}}
Godown: {{to_location}}

Workers: {{party_name}}
Unloading Rate: ₹{{rate}} ({{calc_basis}})
Total Unloading Charge: ₹{{amount}}

Status: {{status}}
Recorded By: {{created_by}}
Time: {{time}}`,
    SMS: `{{company_name}}: UNLOADING {{charge_no}} on {{vehicle}} at {{to_location}}. Workers: {{party_name}} | Charge: Rs.{{amount}}.`,
    EMAIL_SUBJECT: `{{company_name}} – Unloading Charge: {{charge_no}} for {{vehicle}} (Rs.{{amount}})`
  },
  DRIVER_CHARGE_CREATED: {
    WHATSAPP: `{{company_name}}

🚚 *DRIVER TRIP CHARGE RECORDED*

Charge No: {{charge_no}}
Source: {{source_module}} {{source_transaction_no}}
Date: {{date}}

Driver: {{driver_name}}
Vehicle: {{vehicle}}
Trip: {{from_location}} -> {{to_location}}

Charge Type: {{charge_type}}
Rate: ₹{{rate}} ({{calc_basis}})
Total Amount: ₹{{amount}}

Status: {{status}}
Recorded By: {{created_by}}
Time: {{time}}`,
    SMS: `{{company_name}}: DRIVER CHARGE {{charge_no}} for {{driver_name}} ({{vehicle}}). Amount: Rs.{{amount}}.`,
    EMAIL_SUBJECT: `{{company_name}} – Driver Charge: {{charge_no}} for {{driver_name}} (Rs.{{amount}})`
  },
  TRANSFER_CHARGE_CREATED: {
    WHATSAPP: `{{company_name}}

🔄 *GODOWN TRANSFER CHARGES RECORDED*

Transfer No: {{source_transaction_no}}
Date: {{date}}
From: {{from_location}} -> To: {{to_location}}

Item: {{item_name}}
Quantity: {{quantity}} {{uom}}

Charges: {{charge_summary}}
Total Operational Cost: ₹{{amount}}

Status: {{status}}
Time: {{time}}`,
    SMS: `{{company_name}}: TRANSFER CHARGES on {{source_transaction_no}} ({{from_location}} to {{to_location}}). Total: Rs.{{amount}}.`,
    EMAIL_SUBJECT: `{{company_name}} – Godown Transfer Charges for {{source_transaction_no}} (Rs.{{amount}})`
  },
  OPERATIONAL_PAYMENT_COMPLETED: {
    WHATSAPP: `{{company_name}}

💰 *WORKER / DRIVER PAYMENT ISSUED*

Receipt No: {{payment_no}}
Date: {{date}}
Recipient: {{party_name}} ({{party_category}})

Paid Amount: ₹{{paid_amount}}
Payment Method: {{payment_mode}}
Ref / Trx: {{reference_no}}

Allocated Charges: {{allocated_charges}}

Disbursed By: {{paid_by}}
Status: PAID
Time: {{time}}`,
    SMS: `{{company_name}}: PAYMENT {{payment_no}} of Rs.{{paid_amount}} paid to {{party_name}} via {{payment_mode}}.`,
    EMAIL_SUBJECT: `{{company_name}} – Payment Receipt {{payment_no}} to {{party_name}} (Rs.{{paid_amount}})`
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
  if (trimmed.includes('X') || trimmed.includes('x') || trimmed.includes('*') || trimmed === '' || trimmed === '-') {
    return { valid: true, isPlaceholder: true, formatted: trimmed || '+91 98XXX XXXXX' };
  }
  let digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.startsWith('00')) {
    digitsOnly = digitsOnly.slice(2);
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    digitsOnly = `91${digitsOnly.slice(1)}`;
  } else if (digitsOnly.length === 10) {
    digitsOnly = `91${digitsOnly}`;
  }
  if (digitsOnly.length >= 11 && digitsOnly.length <= 15) {
    return { valid: true, isPlaceholder: false, formatted: `+${digitsOnly}` };
  }
  return { valid: false, isPlaceholder: false, formatted: trimmed };
}

/**
 * Replace placeholders in template text with actual data
 */
function renderTemplate(templateStr, data = {}) {
  if (!templateStr) return '';
  return templateStr.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    return data[key] !== undefined && data[key] !== null && data[key] !== '' ? String(data[key]) : '-';
  });
}

function resolveSubscriptionColumn(moduleName) {
  const mod = String(moduleName || '').toUpperCase();
  if (mod === 'PURCHASE') return 'notify_purchase';
  if (mod === 'PURCHASE_RETURN') return 'notify_purchase_return';
  if (mod === 'SALES' || mod === 'EXPORT_ORDER') return 'notify_sales';
  if (mod === 'SALES_RETURN') return 'notify_sales_return';
  if (mod === 'GODOWN_TRANSFER' || mod === 'ITEM_TRANSFER') return 'notify_godown_transfer';
  if (['PRODUCTION', 'GRIND', 'FLOUR_OUT', 'FLOUR_OUT_RETURN', 'PAPAD_IN', 'PAPAD_RETURN', 'PACKING', 'WORK_ORDER', 'COLD_STORAGE', 'STOCK_ADJUST', 'WEIGHT_CONVERSION'].includes(mod)) {
    return 'notify_production';
  }
  if (['VOUCHER', 'ADVANCE', 'QUOTATION', 'PURCHASE_ORDER', 'PURCHASE_REQUEST'].includes(mod)) {
    return 'notify_vouchers';
  }
  if (mod === 'OUTPASS') return 'notify_outpass';
  if (mod === 'INPASS') return 'notify_inpass';
  if (mod === 'QC' || mod === 'QUALITY') return 'notify_qc';
  if (['VEHICLE', 'LOADING', 'UNLOADING', 'DRIVER', 'OPERATIONAL_PAYMENT'].includes(mod)) {
    return 'notify_vehicle_loading';
  }
  return 'notify_all';
}

/**
 * Ensure database tables exist and are properly schema-migrated for a given company
 */
async function ensureNotificationEngineTables(companyId = 1) {
  const cId = parseInt(companyId, 10) || 1;
  if (ensuredNotificationCompanies.has(cId)) {
    return;
  }

  const compDb = db.forCompany(cId);

  try {
    // 1. system_notifications
    await compDb.run(`
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
      `ALTER TABLE system_notifications ADD COLUMN recipients TEXT DEFAULT 'Owner,Manager,Factory In-charge'`,
      `ALTER TABLE system_notifications ADD COLUMN channel TEXT DEFAULT 'ERP,WHATSAPP'`,
      `ALTER TABLE system_notifications ADD COLUMN status TEXT DEFAULT 'SENT'`,
      'ALTER TABLE system_notifications ADD COLUMN acknowledged INTEGER DEFAULT 0',
      'ALTER TABLE system_notifications ADD COLUMN acknowledged_by TEXT',
      'ALTER TABLE system_notifications ADD COLUMN acknowledged_at DATETIME'
    ];
    for (const sql of notifCols) {
      try { await compDb.run(sql); } catch (_) {}
    }

    // 2. notification_recipients / contacts (with description & granular entry subscriptions)
    await compDb.run(`
      CREATE TABLE IF NOT EXISTS notification_recipients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER DEFAULT 1,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        description TEXT,
        phone TEXT,
        email TEXT,
        whatsapp_enabled INTEGER DEFAULT 1,
        sms_enabled INTEGER DEFAULT 1,
        email_enabled INTEGER DEFAULT 0,
        in_app_enabled INTEGER DEFAULT 1,
        notify_purchase INTEGER DEFAULT 1,
        notify_purchase_return INTEGER DEFAULT 1,
        notify_sales INTEGER DEFAULT 1,
        notify_sales_return INTEGER DEFAULT 1,
        notify_godown_transfer INTEGER DEFAULT 1,
        notify_production INTEGER DEFAULT 1,
        notify_vouchers INTEGER DEFAULT 1,
        notify_outpass INTEGER DEFAULT 1,
        notify_inpass INTEGER DEFAULT 1,
        notify_qc INTEGER DEFAULT 1,
        notify_vehicle_loading INTEGER DEFAULT 1,
        notify_all INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const recipientCols = [
      'ALTER TABLE notification_recipients ADD COLUMN description TEXT',
      'ALTER TABLE notification_recipients ADD COLUMN email TEXT',
      'ALTER TABLE notification_recipients ADD COLUMN email_enabled INTEGER DEFAULT 0',
      'ALTER TABLE notification_recipients ADD COLUMN notify_purchase_return INTEGER DEFAULT 1',
      'ALTER TABLE notification_recipients ADD COLUMN notify_sales_return INTEGER DEFAULT 1',
      'ALTER TABLE notification_recipients ADD COLUMN notify_godown_transfer INTEGER DEFAULT 1',
      'ALTER TABLE notification_recipients ADD COLUMN notify_production INTEGER DEFAULT 1',
      'ALTER TABLE notification_recipients ADD COLUMN notify_vouchers INTEGER DEFAULT 1',
      'ALTER TABLE notification_recipients ADD COLUMN notify_all INTEGER DEFAULT 0'
    ];
    for (const sql of recipientCols) {
      try { await compDb.run(sql); } catch (_) {}
    }

    // 3. notification_templates
    await compDb.run(`
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
    await compDb.run(`
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
        delivery_url TEXT,
        idempotency_key TEXT,
        retry_count INTEGER DEFAULT 0,
        error_message TEXT,
        acknowledged INTEGER DEFAULT 0,
        acknowledged_by TEXT,
        acknowledged_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const logCols = [
      'ALTER TABLE notification_delivery_logs ADD COLUMN idempotency_key TEXT',
      'ALTER TABLE notification_delivery_logs ADD COLUMN retry_count INTEGER DEFAULT 0',
      'ALTER TABLE notification_delivery_logs ADD COLUMN error_message TEXT',
      'ALTER TABLE notification_delivery_logs ADD COLUMN provider_message_id TEXT',
      'ALTER TABLE notification_delivery_logs ADD COLUMN recipient_id INTEGER',
      'ALTER TABLE notification_delivery_logs ADD COLUMN reference_id TEXT',
      'ALTER TABLE notification_delivery_logs ADD COLUMN delivery_url TEXT'
    ];
    for (const sql of logCols) {
      try { await compDb.run(sql); } catch (_) {}
    }

    // 5. notification_channel_settings
    await compDb.run(`
      CREATE TABLE IF NOT EXISTS notification_channel_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER DEFAULT 1,
        channel TEXT NOT NULL,
        provider_name TEXT NOT NULL,
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

    // Remove any previously auto-seeded placeholder rows while preserving all user-configured contacts
    try {
      await compDb.run(`
        DELETE FROM notification_recipients
        WHERE company_id = ?
          AND (phone LIKE '+91 98XXX%' OR email LIKE '%@bvcexports.com')
          AND name IN ('Factory Owner', 'General Manager', 'Factory In-charge', 'Purchase Officer', 'Dispatch & Sales Head', 'Senior QC Chemist')
      `, [cId]);
    } catch (_) {}

    // Seed default channel settings if empty for this company
    const checkSettings = await compDb.query(`SELECT COUNT(*) as cnt FROM notification_channel_settings WHERE company_id = ?`, [cId]);
    const settingsCount = Number(checkSettings.rows?.[0]?.cnt ?? 0);
    if (settingsCount === 0) {
      await compDb.run(`
        INSERT INTO notification_channel_settings
        (company_id, channel, provider_name, api_endpoint, sender_id, is_active, test_mode)
        VALUES
        (?, 'WHATSAPP', 'Server WhatsApp + Meta Cloud API', 'https://graph.facebook.com/v19.0/messages', '', 1, 1),
        (?, 'SMS', 'SMS Gateway', '', '', 1, 1),
        (?, 'EMAIL', 'SMTP Mail Service', '', '', 1, 1)
      `, [cId, cId, cId]);
    }

    // Seed any missing default templates for this company
    const existingTemplatesRes = await compDb.query(
      `SELECT event_type, channel FROM notification_templates WHERE company_id = ?`,
      [cId]
    );
    const existingSet = new Set(
      (existingTemplatesRes.rows || []).map((r) => `${r.event_type}::${r.channel}`)
    );

    for (const [evt, chans] of Object.entries(DEFAULT_TEMPLATES)) {
      if (chans.WHATSAPP && !existingSet.has(`${evt}::WHATSAPP`)) {
        await compDb.run(`
          INSERT INTO notification_templates (company_id, event_type, channel, template_name, template_body)
          VALUES (?, ?, 'WHATSAPP', ?, ?)
        `, [cId, evt, `${evt} WhatsApp Template`, chans.WHATSAPP]);
      }
      if (chans.SMS && !existingSet.has(`${evt}::SMS`)) {
        await compDb.run(`
          INSERT INTO notification_templates (company_id, event_type, channel, template_name, template_body)
          VALUES (?, ?, 'SMS', ?, ?)
        `, [cId, evt, `${evt} SMS Template`, chans.SMS]);
      }
    }

    ensuredNotificationCompanies.add(cId);
  } catch (err) {
    console.warn(`[Notification Tables Init Warning (company ${cId})]:`, err.message);
  }
}

async function resolveCompanyDisplayName(companyId = 1) {
  const cId = parseInt(companyId, 10) || 1;
  try {
    const res = await db.master.query(`SELECT name FROM companies WHERE id = ? LIMIT 1`, [cId]);
    if (res.rows && res.rows[0] && res.rows[0].name) {
      return res.rows[0].name;
    }
  } catch (_) {}
  return 'BVC ERP';
}

function resolveBaseCreatedEventType(evtType) {
  const upper = String(evtType || '').toUpperCase();
  if (DEFAULT_TEMPLATES[upper]) return upper;
  const candidate = upper.replace(/_(UPDATED|EDITED|MODIFIED)$/i, '_CREATED');
  if (DEFAULT_TEMPLATES[candidate]) return candidate;

  if (upper.includes('PURCHASE_RETURN')) return 'PURCHASE_RETURN_CREATED';
  if (upper.includes('SALES_RETURN')) return 'SALES_RETURN_CREATED';
  if (upper.includes('PURCHASE_ORDER') || upper.includes('PURCHASE_REQUEST') || upper.includes('QUOTATION') || upper.includes('WORK_ORDER') || upper.includes('EXPORT_ORDER') || upper.includes('ORDER')) {
    return 'ORDER_CREATED';
  }
  if (upper.includes('PURCHASE')) return 'PURCHASE_CREATED';
  if (upper.includes('SALES')) return 'SALES_CREATED';
  if (upper.includes('GODOWN_TRANSFER') || upper.includes('ITEM_TRANSFER')) return 'GODOWN_TRANSFER_CREATED';
  if (upper.includes('OUTPASS')) return 'OUTPASS_CREATED';
  if (upper.includes('INPASS')) return 'INPASS_CREATED';
  if (upper.includes('COLD_STORAGE')) return 'COLD_STORAGE_CREATED';
  if (upper.includes('STOCK_ADJUST')) return 'STOCK_ADJUST_CREATED';
  if (upper.includes('VOUCHER') || upper.includes('ADVANCE')) return 'VOUCHER_CREATED';
  if (upper.includes('PRODUCTION') || upper.includes('GRIND') || upper.includes('FLOUR') || upper.includes('PAPAD') || upper.includes('PACKING')) {
    return 'PRODUCTION_CREATED';
  }
  return candidate;
}

function adaptTemplateForUpdate(templateText, channel) {
  if (!templateText) return '';
  if (channel === 'WHATSAPP') {
    let updated = templateText
      .replace(/(?:🟢|🔵|🟠|🟡|🔄|⚙️|❄️|📊|💳|📋|🚚|🏗️|📦|💰)\s*\*([^*]+?)\s*(CREATED|RECORDED|RECEIVED)\*/i, '✏️ *$1 UPDATED*')
      .replace(/\*COLD STORAGE ENTRY\*/i, '✏️ *COLD STORAGE ENTRY UPDATED*')
      .replace(/\*GODOWN \/ STOCK TRANSFER\*/i, '✏️ *GODOWN / STOCK TRANSFER UPDATED*')
      .replace(/\*STOCK ADJUSTMENT \/ OPENING\*/i, '✏️ *STOCK ADJUSTMENT UPDATED*')
      .replace(/\*ACCOUNTING \/ VOUCHER ENTRY\*/i, '✏️ *VOUCHER ENTRY UPDATED*')
      .replace(/(Created By|Recorded By):/gi, 'Updated By:');
    if (!updated.includes('UPDATED*')) {
      updated = updated.replace(/\*([^*]+)\*/i, '✏️ *$1 UPDATED*');
    }
    return updated;
  }
  if (channel === 'SMS') {
    return templateText
      .replace(/\b(created|recorded|received)\b/i, 'updated');
  }
  if (channel === 'EMAIL_SUBJECT') {
    if (/\b(Created|Recorded|Received)\b/i.test(templateText)) {
      return templateText.replace(/\b(Created|Recorded|Received)\b/gi, 'Updated');
    }
    return `${templateText} (Updated)`;
  }
  return templateText;
}

/**
 * Fetch active template body for event and channel, with fallback and *_UPDATED derivation
 */
async function getTemplateBody(eventType, channel, companyId = 1, isUpdateEvent = false) {
  const cId = parseInt(companyId, 10) || 1;
  const compDb = db.forCompany(cId);
  const evtUpper = String(eventType || '').toUpperCase();

  try {
    const tRes = await compDb.query(`
      SELECT template_body FROM notification_templates
      WHERE company_id = ? AND event_type = ? AND channel = ? AND is_active = 1
      ORDER BY id DESC LIMIT 1
    `, [cId, evtUpper, channel]);
    if (tRes.rows && tRes.rows.length > 0 && tRes.rows[0].template_body) {
      return tRes.rows[0].template_body;
    }
  } catch (_) {}

  const directDefaults = DEFAULT_TEMPLATES[evtUpper];
  if (directDefaults && directDefaults[channel]) {
    return directDefaults[channel];
  }

  const baseEvtType = resolveBaseCreatedEventType(evtUpper);
  let baseBody = '';

  try {
    const baseRes = await compDb.query(`
      SELECT template_body FROM notification_templates
      WHERE company_id = ? AND event_type = ? AND channel = ? AND is_active = 1
      ORDER BY id DESC LIMIT 1
    `, [cId, baseEvtType, channel]);
    if (baseRes.rows && baseRes.rows.length > 0 && baseRes.rows[0].template_body) {
      baseBody = baseRes.rows[0].template_body;
    }
  } catch (_) {}

  if (!baseBody && DEFAULT_TEMPLATES[baseEvtType] && DEFAULT_TEMPLATES[baseEvtType][channel]) {
    baseBody = DEFAULT_TEMPLATES[baseEvtType][channel];
  }

  if (baseBody && (isUpdateEvent || /_(UPDATED|EDITED|MODIFIED)$/i.test(evtUpper))) {
    return adaptTemplateForUpdate(baseBody, channel);
  }

  return baseBody;
}

/**
 * Provider Abstraction: Dispatch WhatsApp message
 * Priority:
 *   1. Sandbox placeholder numbers (+91 98XXX XXXXX) -> DELIVERED (SANDBOX)
 *   2. Connected Main Company Server WhatsApp (Baileys) -> DELIVERED (SERVER WHATSAPP)
 *   3. Meta WhatsApp Cloud API / Custom HTTP Gateway -> DELIVERED (LIVE API)
 *   4. 1-Click WhatsApp Web link fallback -> DELIVERED (1-CLICK READY)
 */
async function dispatchWhatsApp({ phone, messageText, companyId = 1 }) {
  const phoneCheck = validateAndFormatPhone(phone);
  if (!phoneCheck.valid && !phoneCheck.isPlaceholder) {
    return { success: false, status: 'FAILED', error: 'Invalid recipient phone number format' };
  }

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
  let serverError = null;

  // 1. Primary Automated Dispatch via Main Company Server WhatsApp Session
  if (whatsappServerService.isConnected(whatsappServerService.DEFAULT_SESSION_KEY)) {
    const srvRes = await whatsappServerService.sendMessage({
      to: cleanPhone,
      text: messageText,
      sessionKey: whatsappServerService.DEFAULT_SESSION_KEY
    });
    if (srvRes.success) {
      return {
        success: true,
        status: 'DELIVERED (SERVER WHATSAPP)',
        providerMessageId: srvRes.messageId,
        senderPhone: srvRes.senderPhone,
        whatsappUrl
      };
    }
    serverError = srvRes.error || 'Server WhatsApp send failed';
    console.warn('[WhatsApp Server Send Warning]:', serverError);
  }

  // 2. Fallback: Check channel settings for live Meta WhatsApp Cloud API / HTTP Gateway
  const cId = parseInt(companyId, 10) || 1;
  const compDb = db.forCompany(cId);
  try {
    const setRes = await compDb.query(`
      SELECT * FROM notification_channel_settings
      WHERE channel = 'WHATSAPP' AND company_id = ? AND is_active = 1
      LIMIT 1
    `, [cId]);
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
            error: resData.error?.message || serverError || 'Gateway warning'
          };
        }
      } catch (httpErr) {
        console.warn('[WhatsApp Live Gateway HTTP Warning]:', httpErr.message);
      }
    }
  } catch (_) {}

  // 3. Direct 1-Click WhatsApp Delivery Fallback
  return {
    success: true,
    status: 'DELIVERED (1-CLICK READY)',
    providerMessageId: `wamid_sim_${Date.now()}_${rawDigits.slice(-4)}`,
    whatsappUrl,
    ...(serverError ? { error: serverError } : {})
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

  const cId = parseInt(companyId, 10) || 1;
  const compDb = db.forCompany(cId);
  try {
    const setRes = await compDb.query(`
      SELECT * FROM notification_channel_settings
      WHERE channel = 'SMS' AND company_id = ? AND is_active = 1
      LIMIT 1
    `, [cId]);
    const setting = setRes.rows?.[0];

    const authToken = setting?.auth_token || process.env.SMS_API_KEY || process.env.FAST2SMS_API_KEY;
    const isLive = Boolean(authToken && (!setting || !setting.test_mode));

    if (isLive) {
      const provider = (setting?.provider_name || '').toLowerCase();

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
  const cId = parseInt(companyId, 10) || 1;
  const compDb = db.forCompany(cId);

  try {
    const setRes = await compDb.query(`
      SELECT * FROM notification_channel_settings
      WHERE channel = 'EMAIL' AND company_id = ? AND is_active = 1
      LIMIT 1
    `, [cId]);
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
  eventType,
  moduleName,
  referenceNo,
  referenceId,
  companyId = 1,
  details = {},
  title,
  message,
  severity = 'INFO',
  isTest = false,
  forceDispatch = false,
  targetRecipientId = null,
  isUpdate = false
}) {
  try {
    const cId = parseInt(companyId, 10) || 1;
    await ensureNotificationEngineTables(cId);
    const compDb = db.forCompany(cId);

    const modUpper = String(moduleName || 'GENERAL').toUpperCase();
    const isUpdateEvent = Boolean(isUpdate || /_(UPDATED|EDITED|MODIFIED)$/i.test(String(eventType || '')));
    const evtType = eventType || `${modUpper}_${isUpdateEvent ? 'UPDATED' : 'CREATED'}`;
    const refNum = String(referenceNo || referenceId || '');
    const refId = String(referenceId || referenceNo || '');
    const companyName = details.company_name || await resolveCompanyDisplayName(cId);

    const now = new Date();
    const nowIso = now.toISOString();
    const tenMinAgoIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const fiveSecAgoIso = new Date(Date.now() - 5 * 1000).toISOString();
    const dateStr = (details.date && String(details.date).trim()) ? String(details.date).trim() : formatDateInTimeZone(now);
    const timeStr = (details.time && String(details.time).trim()) ? String(details.time).trim() : formatTimeInTimeZone(now);

    // Resolve any numeric mill / area IDs in details so WhatsApp & In-App alerts always display human names
    let resolvedMillName = details.external_mill || details.party_name || '';
    let resolvedAreaName = details.area || details.destination || '';
    if (['OUTPASS', 'INPASS', 'GRIND', 'PRODUCTION'].includes(modUpper)) {
      const candidateMill = details.external_mill || details.party_name || details.flour_mill || details.party_id;
      if (candidateMill && (isNumericId(candidateMill) || isNumericId(resolvedAreaName) || !resolvedAreaName || resolvedAreaName === '-')) {
        try {
          const millInfo = await resolveFlourMillInfo(candidateMill, cId, {
            partyId: details.party_id,
            destination: details.area || details.destination
          });
          if (millInfo.millName && !isNumericId(millInfo.millName)) {
            resolvedMillName = millInfo.millName;
          }
          if (millInfo.areaName && !isNumericId(millInfo.areaName)) {
            resolvedAreaName = millInfo.areaName;
          }
        } catch (_) {}
      }
    }

    // Resolve any numeric customer IDs / names into human-readable customer names
    let resolvedCustomerName = details.customer || details.party_name || details.consignee || details.exporter || '';
    const custCandidate = details.customer_id || details.customer || details.party_id || details.party_name || details.consignee || details.exporter;
    if (custCandidate) {
      try {
        const custInfo = await resolveCustomerName(custCandidate, cId, { customerId: details.customer_id || details.party_id });
        if (custInfo.customerName && !isNumericId(custInfo.customerName)) {
          resolvedCustomerName = custInfo.customerName;
        }
      } catch (_) {}
    }

    const rawAmount = details.amount ?? details.total_amount ?? details.grand_total ?? details.net_amount ?? details.paid_amount;
    const numericAmount = rawAmount !== undefined && rawAmount !== null && rawAmount !== '' ? Number(rawAmount) : null;
    const amountDisplay = numericAmount !== null && !Number.isNaN(numericAmount)
      ? `₹${numericAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : (details.amount_display || '-');

    const safePartyName = (resolvedMillName && !isNumericId(resolvedMillName))
      ? resolvedMillName
      : (details.party_name || details.worker_name || details.supplier || details.customer || '-');
    const safeCustomerName = (resolvedCustomerName && !isNumericId(resolvedCustomerName))
      ? resolvedCustomerName
      : (details.customer || details.party_name || details.consignee || details.exporter || '-');
    const safeAreaName = (resolvedAreaName && !isNumericId(resolvedAreaName))
      ? resolvedAreaName
      : ((details.area && !isNumericId(details.area)) ? details.area : '-');

    const templateData = {
      company_name: companyName,
      reference_no: refNum,
      purchase_no: details.purchase_no || refNum,
      sales_no: details.sales_no || refNum,
      outpass_no: details.outpass_no || refNum,
      inpass_no: details.inpass_no || refNum,
      reference: details.reference || details.reference_no || (refNum ? `REF-${refNum}` : '-'),
      supplier: details.supplier || details.vendor || safePartyName || safeCustomerName || '-',
      customer: safeCustomerName || safePartyName || '-',
      invoice_no: details.invoice_no || details.invNo || refNum,
      item_name: details.item_name || details.item || details.item_summary || '-',
      item_summary: details.item_summary || details.item_name || '-',
      lot_no: details.lot_no || '-',
      quantity: details.quantity || (details.total_weight ? `${details.total_weight} KG` : '-'),
      bags: details.bags || details.total_qty || '-',
      total_weight: details.total_weight ? `${details.total_weight} KG` : (details.quantity || '-'),
      external_mill: safePartyName || '-',
      area: safeAreaName || '-',
      vehicle: details.vehicle || details.vehicle_no || details.lorry_no || '-',
      godown: details.godown || details.godown_name || details.to_location || '-',
      receiving_godown: details.receiving_godown || details.to_godown_name || details.godown || '-',
      purpose: details.purpose || '-',
      expected_return: details.expected_return || details.expected_return_date || dateStr,
      received_date: details.received_date || dateStr,
      original_input: details.original_input ? `${details.original_input} KG` : '-',
      received_output: details.received_output ? `${details.received_output} KG` : '-',
      by_product: details.by_product ? `${details.by_product} KG` : '-',
      loss: details.loss ? `${details.loss} KG` : '-',
      mass_balance: details.mass_balance || (details.discrepancy_weight ? `⚠ ${details.discrepancy_weight} KG DISCREPANCY` : 'BALANCED'),
      qc_status: details.qc_status || 'PENDING',
      iqr_status: details.iqr_status || 'PENDING',
      loading_status: details.loading_status || 'PENDING',
      dispatch_status: details.dispatch_status || 'PENDING',
      created_by: details.updated_by || details.created_by || 'ERP Operator',
      received_by: details.received_by || details.updated_by || details.created_by || 'Store Operator',
      status: details.status || `${modUpper.replace(/_/g, ' ')} ${isUpdateEvent ? 'UPDATED' : 'CREATED'}`,
      action_label: details.action_label || modUpper.replace(/_/g, ' '),
      module_label: details.module_label || modUpper.replace(/_/g, ' '),
      remarks: details.remarks || details.narration || details.reason || '-',
      date: dateStr,
      time: timeStr,
      charge_no: details.charge_no || refNum,
      source_module: details.source_module || modUpper,
      source_transaction_no: details.source_transaction_no || refNum,
      party_name: safePartyName || '-',
      party_category: details.party_category || 'WORKER',
      driver_name: details.driver_name || details.driver || '-',
      from_location: details.from_location || details.from_godown || '-',
      to_location: details.to_location || details.to_godown || '-',
      rate: details.rate || '0.00',
      calc_basis: details.calculation_basis || details.calc_basis || 'PER_KG',
      uom: details.uom || 'KG',
      amount: numericAmount !== null && !Number.isNaN(numericAmount) ? numericAmount.toLocaleString('en-IN') : (details.amount || '0'),
      amount_display: amountDisplay,
      charge_type: details.charge_type || 'LOADING',
      charge_summary: details.charge_summary || `Charges: ${amountDisplay}`,
      payment_no: details.payment_no || refNum,
      paid_amount: details.paid_amount || details.amount || '0',
      payment_mode: details.payment_mode || details.payment_method || 'CASH',
      paid_by: details.paid_by || details.created_by || 'Admin',
      allocated_charges: details.allocated_charges || details.charge_no || refNum
    };

    const whatsappTemplate = await getTemplateBody(evtType, 'WHATSAPP', cId, isUpdateEvent);
    const smsTemplate = await getTemplateBody(evtType, 'SMS', cId, isUpdateEvent);
    const baseEvt = resolveBaseCreatedEventType(evtType);
    const rawEmailSubjectTpl = (DEFAULT_TEMPLATES[evtType] && DEFAULT_TEMPLATES[evtType].EMAIL_SUBJECT)
      || (DEFAULT_TEMPLATES[baseEvt] && DEFAULT_TEMPLATES[baseEvt].EMAIL_SUBJECT)
      || `${companyName}: ${evtType} – ${refNum}`;
    const emailSubjectTemplate = isUpdateEvent ? adaptTemplateForUpdate(rawEmailSubjectTpl, 'EMAIL_SUBJECT') : rawEmailSubjectTpl;

    const actionVerb = isUpdateEvent ? 'updated' : 'recorded';
    let formattedWhatsAppMsg = renderTemplate(whatsappTemplate, templateData) || message || `${companyName}: ${modUpper.replace(/_/g, ' ')} ${refNum} ${actionVerb} (${templateData.item_summary}).`;
    if (formattedWhatsAppMsg && !/^time\s*:/mi.test(formattedWhatsAppMsg)) {
      formattedWhatsAppMsg = `${formattedWhatsAppMsg.trimEnd()}\nTime: ${timeStr}`;
    }

    const formattedSmsMsg = renderTemplate(smsTemplate, templateData) || `${companyName}: ${modUpper.replace(/_/g, ' ')} ${refNum} ${actionVerb}.`;
    const formattedEmailSubject = renderTemplate(emailSubjectTemplate, templateData);

    const notifTitle = title || `${companyName} – ${modUpper.replace(/_/g, ' ')} ${isUpdateEvent ? 'UPDATED ' : ''}(${refNum})`;
    const notifMsg = message || formattedSmsMsg;

    const insRes = await compDb.run(`
      INSERT INTO system_notifications (
        alert_type, event_type, title, message, severity,
        reference_module, module_name, reference_id, reference_no,
        company_id, is_read, whatsapp_sent, sms_sent,
        recipients, channel, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, 1, 'Configured Recipients', 'ERP,WHATSAPP,SMS', 'SENT', ?)
    `, [
      evtType, evtType, notifTitle, notifMsg, severity,
      modUpper, modUpper, refId, refNum, cId, nowIso
    ]);

    const notificationId = insRes.lastID || insRes.lastInsertRowid;

    let recipients = [];
    if (targetRecipientId) {
      const recRes = await compDb.query(`
        SELECT * FROM notification_recipients
        WHERE id = ? AND company_id = ?
      `, [targetRecipientId, cId]);
      recipients = recRes.rows || [];
    } else {
      const eventColumn = resolveSubscriptionColumn(modUpper);
      const filterSql = eventColumn === 'notify_all'
        ? `COALESCE(notify_all, 0) = 1`
        : `(${eventColumn} = 1 OR COALESCE(notify_all, 0) = 1)`;

      const recRes = await compDb.query(`
        SELECT * FROM notification_recipients
        WHERE company_id = ? AND is_active = 1 AND ${filterSql}
      `, [cId]);
      recipients = recRes.rows || [];
    }

    const deliveryResults = [];

    for (const rec of recipients) {
      const nowEpoch = Date.now();
      const recipientLabel = rec.description ? `${rec.name} (${rec.description})` : rec.name;
      const updateSuffix = isUpdateEvent ? `_upd_${Math.floor(nowEpoch / 1000)}` : '';

      // A. IN-APP Channel
      if (rec.in_app_enabled) {
        const inAppKey = isTest || forceDispatch ? `test_${nowEpoch}_${cId}_${evtType}_${refNum}_${rec.id}_IN_APP` : `${cId}_${evtType}_${refNum}_${rec.id}_IN_APP${updateSuffix}`;
        let shouldSend = true;
        if (!isTest && !forceDispatch) {
          if (isUpdateEvent) {
            const dupCheck = await compDb.query(`
              SELECT id FROM notification_delivery_logs
              WHERE company_id = ? AND event_type = ? AND reference_no = ? AND recipient_id = ? AND channel = 'IN_APP'
              AND message_body = ? AND created_at >= ?
            `, [cId, evtType, refNum, rec.id, notifMsg, fiveSecAgoIso]);
            if (dupCheck.rows && dupCheck.rows.length > 0) shouldSend = false;
          } else {
            const dupCheck = await compDb.query(`
              SELECT id FROM notification_delivery_logs
              WHERE idempotency_key = ? AND delivery_status = 'DELIVERED'
              AND created_at >= ?
            `, [inAppKey, tenMinAgoIso]);
            if (dupCheck.rows && dupCheck.rows.length > 0) shouldSend = false;
          }
        }

        if (shouldSend) {
          await compDb.run(`
            INSERT INTO notification_delivery_logs
            (company_id, notification_id, event_type, module_name, reference_no, reference_id, recipient_id, recipient_name, recipient_role, channel, recipient_contact, message_body, delivery_status, idempotency_key, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'IN_APP', 'ERP Portal', ?, 'DELIVERED', ?, ?)
          `, [
            cId, notificationId, evtType, modUpper, refNum, refId,
            rec.id, recipientLabel, rec.role, notifMsg, inAppKey, nowIso
          ]);
          deliveryResults.push({ channel: 'IN_APP', recipient: rec.name, description: rec.description || '', status: 'DELIVERED' });
        }
      }

      // B. WHATSAPP Channel
      if (rec.whatsapp_enabled) {
        const waKey = isTest || forceDispatch ? `test_${nowEpoch}_${cId}_${evtType}_${refNum}_${rec.id}_WHATSAPP` : `${cId}_${evtType}_${refNum}_${rec.id}_WHATSAPP${updateSuffix}`;
        let shouldSend = true;
        if (!isTest && !forceDispatch) {
          if (isUpdateEvent) {
            const dupCheck = await compDb.query(`
              SELECT id FROM notification_delivery_logs
              WHERE company_id = ? AND event_type = ? AND reference_no = ? AND recipient_id = ? AND channel = 'WHATSAPP'
              AND message_body = ? AND created_at >= ?
            `, [cId, evtType, refNum, rec.id, formattedWhatsAppMsg, fiveSecAgoIso]);
            if (dupCheck.rows && dupCheck.rows.length > 0) shouldSend = false;
          } else {
            const dupCheck = await compDb.query(`
              SELECT id FROM notification_delivery_logs
              WHERE idempotency_key = ? AND delivery_status LIKE 'DELIVERED%'
              AND created_at >= ?
            `, [waKey, tenMinAgoIso]);
            if (dupCheck.rows && dupCheck.rows.length > 0) shouldSend = false;
          }
        }

        if (shouldSend) {
          const waBody = formattedWhatsAppMsg;

          const waResult = await dispatchWhatsApp({ phone: rec.phone, messageText: waBody, companyId: cId });
          await compDb.run(`
            INSERT INTO notification_delivery_logs
            (company_id, notification_id, event_type, module_name, reference_no, reference_id, recipient_id, recipient_name, recipient_role, channel, recipient_contact, message_body, delivery_status, provider_message_id, delivery_url, idempotency_key, error_message, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'WHATSAPP', ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            cId, notificationId, evtType, modUpper, refNum, refId,
            rec.id, recipientLabel, rec.role, rec.phone || '', waBody,
            waResult.status, waResult.providerMessageId || null, waResult.whatsappUrl || null, waKey, waResult.error || null, nowIso
          ]);
          deliveryResults.push({
            channel: 'WHATSAPP',
            recipient: rec.name,
            description: rec.description || '',
            phone: rec.phone,
            status: waResult.status,
            senderPhone: waResult.senderPhone || null,
            message: waBody,
            whatsappUrl: waResult.whatsappUrl
          });
        }
      }

      // C. SMS Channel
      if (rec.sms_enabled) {
        const smsKey = isTest || forceDispatch ? `test_${nowEpoch}_${cId}_${evtType}_${refNum}_${rec.id}_SMS` : `${cId}_${evtType}_${refNum}_${rec.id}_SMS${updateSuffix}`;
        let shouldSend = true;
        if (!isTest && !forceDispatch) {
          if (isUpdateEvent) {
            const dupCheck = await compDb.query(`
              SELECT id FROM notification_delivery_logs
              WHERE company_id = ? AND event_type = ? AND reference_no = ? AND recipient_id = ? AND channel = 'SMS'
              AND message_body = ? AND created_at >= ?
            `, [cId, evtType, refNum, rec.id, formattedSmsMsg, fiveSecAgoIso]);
            if (dupCheck.rows && dupCheck.rows.length > 0) shouldSend = false;
          } else {
            const dupCheck = await compDb.query(`
              SELECT id FROM notification_delivery_logs
              WHERE idempotency_key = ? AND delivery_status LIKE 'SENT%'
              AND created_at >= ?
            `, [smsKey, tenMinAgoIso]);
            if (dupCheck.rows && dupCheck.rows.length > 0) shouldSend = false;
          }
        }

        if (shouldSend) {
          const smsResult = await dispatchSMS({ phone: rec.phone, messageText: formattedSmsMsg, companyId: cId });
          await compDb.run(`
            INSERT INTO notification_delivery_logs
            (company_id, notification_id, event_type, module_name, reference_no, reference_id, recipient_id, recipient_name, recipient_role, channel, recipient_contact, message_body, delivery_status, provider_message_id, delivery_url, idempotency_key, error_message, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SMS', ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            cId, notificationId, evtType, modUpper, refNum, refId,
            rec.id, recipientLabel, rec.role, rec.phone || '+91 98XXX XXXXX', formattedSmsMsg,
            smsResult.status, smsResult.providerMessageId || null, smsResult.smsUrl || null, smsKey, smsResult.error || null, nowIso
          ]);
          deliveryResults.push({
            channel: 'SMS',
            recipient: rec.name,
            description: rec.description || '',
            phone: rec.phone,
            status: smsResult.status,
            message: formattedSmsMsg,
            smsUrl: smsResult.smsUrl
          });
        }
      }

      // D. EMAIL Channel
      if (rec.email_enabled && rec.email) {
        const emailKey = isTest || forceDispatch ? `test_${nowEpoch}_${cId}_${evtType}_${refNum}_${rec.id}_EMAIL` : `${cId}_${evtType}_${refNum}_${rec.id}_EMAIL${updateSuffix}`;
        let shouldSend = true;
        if (!isTest && !forceDispatch) {
          if (isUpdateEvent) {
            const dupCheck = await compDb.query(`
              SELECT id FROM notification_delivery_logs
              WHERE company_id = ? AND event_type = ? AND reference_no = ? AND recipient_id = ? AND channel = 'EMAIL'
              AND message_body = ? AND created_at >= ?
            `, [cId, evtType, refNum, rec.id, formattedWhatsAppMsg, fiveSecAgoIso]);
            if (dupCheck.rows && dupCheck.rows.length > 0) shouldSend = false;
          } else {
            const dupCheck = await compDb.query(`
              SELECT id FROM notification_delivery_logs
              WHERE idempotency_key = ? AND (delivery_status LIKE 'SENT%' OR delivery_status LIKE 'DELIVERED%')
              AND created_at >= ?
            `, [emailKey, tenMinAgoIso]);
            if (dupCheck.rows && dupCheck.rows.length > 0) shouldSend = false;
          }
        }

        if (shouldSend) {
          const emailResult = await dispatchEmail({
            email: rec.email,
            subject: formattedEmailSubject,
            messageText: formattedWhatsAppMsg,
            companyId: cId
          });
          await compDb.run(`
            INSERT INTO notification_delivery_logs
            (company_id, notification_id, event_type, module_name, reference_no, reference_id, recipient_id, recipient_name, recipient_role, channel, recipient_contact, message_body, delivery_status, provider_message_id, idempotency_key, error_message, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'EMAIL', ?, ?, ?, ?, ?, ?, ?)
          `, [
            cId, notificationId, evtType, modUpper, refNum, refId,
            rec.id, recipientLabel, rec.role, rec.email, formattedWhatsAppMsg,
            emailResult.status, emailResult.providerMessageId || null, emailKey, emailResult.error || null, nowIso
          ]);
          deliveryResults.push({ channel: 'EMAIL', recipient: rec.name, description: rec.description || '', email: rec.email, status: emailResult.status });
        }
      }
    }

    console.log(`[Notification Engine] Dispatched ${evtType} ${refNum} (Company ${cId}) to ${recipients.length} configured recipients.`);
    return {
      success: true,
      notificationId,
      recipientCount: recipients.length,
      formattedWhatsAppMsg,
      formattedSmsMsg,
      deliveryResults
    };
  } catch (err) {
    console.error('[Notification Engine Silent Catch]:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Retry a failed or pending notification delivery log
 */
async function retryDeliveryLog(logId, companyId = 1) {
  try {
    const cId = parseInt(companyId, 10) || 1;
    await ensureNotificationEngineTables(cId);
    const compDb = db.forCompany(cId);

    const lRes = await compDb.query(`SELECT * FROM notification_delivery_logs WHERE id = ? AND company_id = ?`, [logId, cId]);
    if (!lRes.rows || lRes.rows.length === 0) {
      return { success: false, message: 'Delivery log not found' };
    }
    const log = lRes.rows[0];
    if (log.retry_count >= 3) {
      return { success: false, message: 'Maximum retry limit (3 attempts) reached for this message' };
    }

    let result = { status: 'DELIVERED' };
    if (log.channel === 'WHATSAPP') {
      result = await dispatchWhatsApp({ phone: log.recipient_contact, messageText: log.message_body, companyId: cId });
    } else if (log.channel === 'SMS') {
      result = await dispatchSMS({ phone: log.recipient_contact, messageText: log.message_body, companyId: cId });
    } else if (log.channel === 'EMAIL') {
      result = await dispatchEmail({ email: log.recipient_contact, messageText: log.message_body, companyId: cId });
    }

    await compDb.run(`
      UPDATE notification_delivery_logs
      SET delivery_status = ?,
          retry_count = retry_count + 1,
          provider_message_id = COALESCE(?, provider_message_id),
          error_message = ?
      WHERE id = ? AND company_id = ?
    `, [result.status, result.providerMessageId || null, result.error || null, logId, cId]);

    return { success: true, status: result.status, message: `Notification retried via ${log.channel}: ${result.status}` };
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
  resolveSubscriptionColumn,
  dispatchWhatsApp,
  DEFAULT_TEMPLATES
};
