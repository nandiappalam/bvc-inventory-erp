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

function formatNumClean(val) {
  const n = parseFloat(val);
  if (!Number.isFinite(n)) return '0';
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

function formatNotificationItemLine(item, options = {}) {
  if (!item || typeof item !== 'object') return '';
  const name = (
    item.item_name ||
    item.itemName ||
    item.output_item ||
    item.material ||
    item.product ||
    options.fallbackName ||
    'Item'
  ).toString().trim();

  const lot = (
    item.lot_no ||
    item.lotNo ||
    item.fg_lot_no ||
    item.wastage_lot_no ||
    ''
  ).toString().trim();

  const rawQty = item.input_qty ?? item.expected_qty ?? item.output_qty ?? item.qty ?? item.total_packet ?? item.box_papad ?? item.quantity ?? 0;
  const qty = parseFloat(rawQty) || 0;
  const unitWt = parseFloat(item.weight ?? item.output_weight ?? item.per_unit_weight ?? 0) || 0;
  const rawTotWt = item.total_wt ?? item.totalWt ?? item.tot_wt ?? item.totWt ?? item.kgs ?? item.output_kgs ?? item.wt_papad ?? item.total_weight;
  const totWt = (rawTotWt !== undefined && rawTotWt !== null && rawTotWt !== '')
    ? (parseFloat(rawTotWt) || 0)
    : (qty * unitWt);

  const singular = options.singularUnit || 'Bag';
  const plural = options.pluralUnit || 'Bags';
  const unitLabel = qty === 1 ? singular : plural;

  const lotTag = lot ? ` (Lot: ${lot})` : '';
  const catTag = (options.includeCategory && item.category) ? `[${item.category}] ` : '';

  if (qty > 0 && unitWt > 0 && totWt > 0) {
    return `${catTag}${name}${lotTag} - ${formatNumClean(qty)} ${unitLabel} × ${formatNumClean(unitWt)} KG = ${formatNumClean(totWt)} KG`;
  }
  if (qty > 0 && totWt > 0) {
    return `${catTag}${name}${lotTag} - ${formatNumClean(qty)} ${unitLabel} / ${formatNumClean(totWt)} KG`;
  }
  if (totWt > 0) {
    return `${catTag}${name}${lotTag} - ${formatNumClean(totWt)} KG`;
  }
  if (qty > 0) {
    return `${catTag}${name}${lotTag} - ${formatNumClean(qty)} ${unitLabel}`;
  }
  return `${catTag}${name}${lotTag}`;
}

function formatNotificationItems(items = [], options = {}) {
  const list = Array.isArray(items) ? items : [];
  const maxItems = options.maxItems || 10;
  const lines = list
    .map((it) => formatNotificationItemLine(it, options))
    .filter(Boolean);

  if (lines.length === 0) return options.emptyFallback || '';
  if (lines.length <= maxItems) return lines.join('; ');
  return `${lines.slice(0, maxItems).join('; ')} (+${lines.length - maxItems} more)`;
}

function formatProductionItemSummary({
  targetProduct = '',
  inputItems = [],
  outputItems = [],
  wastageItems = [],
  fallbackOutputQty = 0,
  fallbackOutputWt = 0,
  inputOptions = {},
  outputOptions = {},
  wastageOptions = {}
} = {}) {
  const parts = [];
  if (targetProduct) {
    parts.push(`Target: ${targetProduct}`);
  }
  const inText = formatNotificationItems(inputItems, inputOptions);
  if (inText) {
    parts.push(`${parts.length > 0 ? '• ' : ''}Input: ${inText}`);
  }
  let outText = formatNotificationItems(outputItems, outputOptions);
  if (!outText && targetProduct && (fallbackOutputQty > 0 || fallbackOutputWt > 0)) {
    const qtyPart = fallbackOutputQty > 0 ? `${formatNumClean(fallbackOutputQty)} ${fallbackOutputQty === 1 ? 'Bag' : 'Bags'}` : '';
    const wtPart = fallbackOutputWt > 0 ? `${formatNumClean(fallbackOutputWt)} KG` : '';
    const metrics = [qtyPart, wtPart].filter(Boolean).join(' / ');
    outText = metrics ? `${targetProduct} - ${metrics}` : targetProduct;
  }
  if (outText) {
    parts.push(`${parts.length > 0 ? '• ' : ''}Output: ${outText}`);
  }
  const wstText = formatNotificationItems(wastageItems, { includeCategory: true, ...wastageOptions });
  if (wstText) {
    parts.push(`${parts.length > 0 ? '• ' : ''}Wastage: ${wstText}`);
  }
  return parts.join('\n') || targetProduct || 'Production Items';
}

module.exports = {
  triggerTransactionNotification,
  emitTransactionEvent,
  initNotificationSystemTables: ensureNotificationEngineTables,
  formatNumClean,
  formatNotificationItemLine,
  formatNotificationItems,
  formatProductionItemSummary
};
