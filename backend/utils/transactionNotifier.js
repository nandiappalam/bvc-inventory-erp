const { emitTransactionEvent, ensureNotificationEngineTables } = require('../services/transactionNotificationEngine');

/**
 * Backward compatibility adapter for triggerTransactionNotification
 */
async function triggerTransactionNotification({
  moduleName,
  referenceNo,
  title,
  message,
  severity = 'INFO',
  referenceId,
  companyId = 1,
  details = {},
  eventType,
  isUpdate = false
}) {
  const modUpper = String(moduleName || 'GENERAL').toUpperCase();
  const isUpd = Boolean(isUpdate || /_(UPDATED|EDITED|MODIFIED)$/i.test(String(eventType || '')));
  return emitTransactionEvent({
    moduleName,
    referenceNo,
    title,
    message,
    severity,
    referenceId,
    companyId,
    details,
    isUpdate: isUpd,
    eventType: eventType || `${modUpper}_${isUpd ? 'UPDATED' : 'CREATED'}`
  });
}

module.exports = {
  triggerTransactionNotification,
  emitTransactionEvent,
  initNotificationSystemTables: ensureNotificationEngineTables
};
