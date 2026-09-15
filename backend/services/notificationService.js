/**
 * Notification Service for BVC ERP Stock Alerts
 * Handles Automated Email (via SMTP / Nodemailer), SMS, and WhatsApp alerts
 */
let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  // Graceful fallback if nodemailer is not installed locally
  nodemailer = null;
}

// Helper to format phone number for WhatsApp / SMS
function formatPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.length === 10) {
    // Default to India country code 91 if 10 digits
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

// Helper to check and create SMTP transporter
function getSmtpTransporter() {
  if (!nodemailer) {
    return null;
  }

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const service = process.env.SMTP_SERVICE; // e.g. 'gmail'

  if (!user && !host) {
    return null;
  }

  try {
    if (service) {
      return nodemailer.createTransport({
        service,
        auth: {
          user,
          pass
        }
      });
    }

    return nodemailer.createTransport({
      host: host || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
      auth: user && pass ? { user, pass } : undefined,
      tls: {
        rejectUnauthorized: false
      }
    });
  } catch (err) {
    console.warn('[NotificationService] Failed to initialize SMTP Transporter:', err.message);
    return null;
  }
}

/**
 * Send real email alert
 */
async function sendEmailAlert({ to, subject, text, html }) {
  if (!to) {
    return { success: false, reason: 'Recipient email is missing' };
  }

  const transporter = getSmtpTransporter();
  const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text || '')}`;

  if (!transporter) {
    console.log(`[NotificationService] SMTP credentials not set in .env. Prepared client dispatch for: ${to}`);
    return {
      success: true,
      delivered: false,
      smtpConfigured: false,
      method: 'CLIENT_DISPATCH',
      recipient: to,
      mailtoUrl,
      note: 'SMTP not configured in server environment. Use Direct Client Dispatch or set SMTP_USER / SMTP_PASS.'
    };
  }

  const fromAddress = process.env.SMTP_FROM || `"BVC ERP Stock Alerts" <${process.env.SMTP_USER}>`;

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text,
      html: html || `<p>${text}</p>`
    });

    console.log(`[NotificationService] Email sent successfully to ${to}, MessageId: ${info.messageId}`);
    return {
      success: true,
      delivered: true,
      smtpConfigured: true,
      method: 'SMTP',
      messageId: info.messageId,
      recipient: to,
      mailtoUrl
    };
  } catch (err) {
    console.error(`[NotificationService] Error sending email to ${to}:`, err.message);
    return {
      success: false,
      delivered: false,
      smtpConfigured: true,
      method: 'SMTP_FAILED',
      error: err.message,
      recipient: to,
      mailtoUrl
    };
  }
}

/**
 * Generate Phone / SMS / WhatsApp Dispatch Details
 */
function preparePhoneAlert({ phone, text }) {
  if (!phone) {
    return { success: false, reason: 'Phone number is missing' };
  }

  const cleanPhone = formatPhoneNumber(phone);
  const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
  const smsUrl = `sms:${cleanPhone}?body=${encodeURIComponent(text)}`;

  return {
    success: true,
    phone,
    cleanPhone,
    whatsappUrl,
    smsUrl,
    text
  };
}

module.exports = {
  getSmtpTransporter,
  sendEmailAlert,
  preparePhoneAlert,
  formatPhoneNumber
};
