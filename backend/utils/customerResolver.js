const db = require('../config/database');
const { isNumericId } = require('./millResolver');

async function resolveCustomerName(custRef, companyId = 1, options = {}) {
  const { customerId = null } = options || {};
  const cId = parseInt(companyId, 10) || 1;
  let custRow = null;

  const candidates = [];
  if (customerId !== null && customerId !== undefined && String(customerId).trim() !== '') {
    candidates.push(customerId);
  }
  if (custRef !== null && custRef !== undefined && String(custRef).trim() !== '') {
    candidates.push(custRef);
  }

  for (const cand of candidates) {
    if (custRow) break;
    const raw = String(cand).trim();
    if (!raw) continue;

    try {
      if (isNumericId(raw)) {
        const res = await db.query(
          'SELECT id, name, print_name, address1, mobile1 FROM customer_master WHERE id = ? LIMIT 1',
          [parseInt(raw, 10)],
          cId
        );
        if (res.rows && res.rows.length > 0) {
          custRow = res.rows[0];
        }
      } else {
        const res = await db.query(
          `SELECT id, name, print_name, address1, mobile1
           FROM customer_master
           WHERE LOWER(TRIM(COALESCE(name, ''))) = LOWER(TRIM(?))
              OR LOWER(TRIM(COALESCE(print_name, ''))) = LOWER(TRIM(?))
           LIMIT 1`,
          [raw, raw],
          cId
        );
        if (res.rows && res.rows.length > 0) {
          custRow = res.rows[0];
        }
      }
    } catch (_) {}
  }

  const rawRefStr = custRef !== null && custRef !== undefined ? String(custRef).trim() : '';
  const customerName = custRow
    ? (custRow.name || custRow.print_name || rawRefStr).trim()
    : (isNumericId(rawRefStr) ? '' : rawRefStr);

  return {
    id: custRow ? custRow.id : (isNumericId(customerId) ? parseInt(customerId, 10) : (isNumericId(custRef) ? parseInt(custRef, 10) : null)),
    customerName: customerName || rawRefStr || 'Customer',
    address: custRow ? (custRow.address1 || '') : '',
    phone: custRow ? (custRow.mobile1 || '') : ''
  };
}

module.exports = {
  resolveCustomerName
};
