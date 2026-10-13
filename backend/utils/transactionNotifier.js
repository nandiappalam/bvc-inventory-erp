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
  eventType
}) {
  return emitTransactionEvent({
    moduleName,
    referenceNo,
    title,
    message,
    severity,
    referenceId,
    companyId,
    details,
    eventType: eventType || `${moduleName}_CREATED`
  });
}

module.exports = {
  triggerTransactionNotification,
  emitTransactionEvent,
  initNotificationSystemTables: ensureNotificationEngineTables
};
