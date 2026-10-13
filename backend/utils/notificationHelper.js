/**
 * notificationHelper.js - Central Transaction Notification & Confirmation Engine for BVC ERP
 * Handles event-driven notifications across Purchase, Sales, Outpass, Inpass, QC, and Live Operations.
 */

const db = require('../config/database');

/**
 * Trigger a central notification across ERP Bell, simulated WhatsApp, and SMS channels.
 * @param {Object} opts
 * @param {String} opts.eventType - e.g. 'PURCHASE_CREATED', 'OUTPASS_CREATED', 'INPASS_RECEIVED', 'SALES_CREATED', 'VEHICLE_LOADED'
 * @param {String} opts.moduleName - e.g. 'PURCHASE', 'SALES', 'OUTPASS', 'INPASS'
 * @param {String} opts.referenceNo - e.g. 'OP-00021', 'INV-1025', 'SI-00251'
 * @param {Number} opts.referenceId - Transaction ID
 * @param {String} opts.title - Notification title
 * @param {String} opts.message - Detailed notification message
 * @param {String} opts.severity - 'INFO', 'SUCCESS', 'WARNING', 'CRITICAL'
 * @param {String} opts.recipients - Comma separated roles (e.g. 'Owner,Manager,Factory In-charge,Purchase')
 */
const triggerNotification = async ({
  eventType,
  moduleName,
  referenceNo,
  referenceId,
  title,
  message,
  severity = 'INFO',
  recipients = 'Owner,Manager,Factory In-charge'
}) => {
  try {
    // Ensure table exists
    await db.run(`
      CREATE TABLE IF NOT EXISTS system_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        module_name TEXT NOT NULL,
        reference_no TEXT,
        reference_id INTEGER,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        recipients TEXT DEFAULT 'Owner,Manager,Factory In-charge',
        channel TEXT DEFAULT 'ERP,WHATSAPP',
        severity TEXT DEFAULT 'INFO',
        status TEXT DEFAULT 'SENT',
        is_read INTEGER DEFAULT 0,
        acknowledged INTEGER DEFAULT 0,
        acknowledged_by TEXT,
        acknowledged_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert notification record
    const insertSql = `
      INSERT INTO system_notifications (
        event_type, module_name, reference_no, reference_id, title, message, recipients, channel, severity, status, is_read, acknowledged
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ERP,WHATSAPP,SMS', ?, 'SENT', 0, 0)
    `;

    await db.run(insertSql, [
      eventType || 'TRANSACTION_EVENT',
      moduleName || 'GENERAL',
      referenceNo || '',
      referenceId || null,
      title || 'Factory Notification',
      message || '',
      recipients,
      severity
    ]);

    console.log(`[Notification Engine] Triggered [${eventType}] for ${moduleName} ref: ${referenceNo}`);
  } catch (err) {
    console.error('[Notification Engine Error]:', err.message);
  }
};

module.exports = {
  triggerNotification
};
