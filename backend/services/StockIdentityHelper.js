function cleanSeg(val, fallback = 'NA') {
  if (val === undefined || val === null) return fallback;
  const s = String(val).trim();
  if (!s) return fallback;
  return s.toUpperCase().replace(/\s+/g, '_').replace(/\|/g, '/');
}

/**
 * Builds stable composite identity key using IDs when available (and canonical uppercase names as fallback),
 * ensuring lot transfers across godowns or storage types maintain separate stock identities without collision.
 */
function buildStockIdentityKey({
  companyId,
  financialYear,
  stockCategory,
  storageType = 'Factory',
  itemId = null,
  itemName = '',
  lotNo = '',
  rmLotNo = '',
  fgLotNo = '',
  godownId = null,
  godownName = ''
}) {
  const cId = parseInt(companyId, 10);
  if (!Number.isSafeInteger(cId) || cId <= 0) {
    throw new Error(`Valid companyId required in buildStockIdentityKey (got: ${companyId})`);
  }
  const fySeg = cleanSeg(financialYear, 'DEFAULT');
  const catSeg = cleanSeg(stockCategory, 'RM');
  const storSeg = cleanSeg(storageType, 'FACTORY');
  const itemSeg = itemId && Number(itemId) > 0 ? `ID:${Number(itemId)}` : `NM:${cleanSeg(itemName, 'UNKNOWN')}`;
  const effectiveLot = String(lotNo || fgLotNo || rmLotNo || '').trim();
  const lotSeg = effectiveLot ? `LOT:${cleanSeg(effectiveLot)}` : 'LOT:NONE';
  const gdwSeg = godownId && Number(godownId) > 0
    ? `GID:${Number(godownId)}`
    : `GNM:${cleanSeg(godownName, 'MAIN')}`;

  return `${cId}|${fySeg}|${catSeg}|${storSeg}|${itemSeg}|${lotSeg}|${gdwSeg}`;
}

function buildPostingKey({
  companyId,
  sourceModule,
  sourceId,
  sourceLineId = 0,
  direction = 'IN',
  movementType = '',
  role = 'MAIN'
}) {
  return [
    `C${companyId}`,
    cleanSeg(sourceModule, 'MOD'),
    sourceId !== undefined && sourceId !== null ? String(sourceId) : '0',
    sourceLineId !== undefined && sourceLineId !== null ? String(sourceLineId) : '0',
    cleanSeg(direction, 'IN'),
    cleanSeg(movementType || role, 'MV')
  ].join(':');
}

function round3(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 1000) / 1000;
}

function normalizeBagBreakdown(breakdownInput, fallbackQty = 0, fallbackUnitWeight = 0, fallbackTotalWeight = 0) {
  if (Array.isArray(breakdownInput) && breakdownInput.length > 0) {
    const cleaned = breakdownInput
      .map(b => ({
        qty: round3(b.qty || b.bags || 0),
        unit_weight: round3(b.unit_weight || b.weight || 0)
      }))
      .filter(b => b.qty > 0 && b.unit_weight > 0);
    if (cleaned.length > 0) return cleaned;
  }
  if (typeof breakdownInput === 'string' && breakdownInput.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(breakdownInput);
      return normalizeBagBreakdown(parsed, fallbackQty, fallbackUnitWeight, fallbackTotalWeight);
    } catch (_) {}
  }

  const q = Math.abs(round3(fallbackQty));
  const w = Math.abs(round3(fallbackTotalWeight));
  const uw = Math.abs(round3(fallbackUnitWeight));

  if (q > 0 && w > 0 && uw > 0) {
    const expected = round3(q * uw);
    if (Math.abs(expected - w) < 0.01) {
      return [{ qty: q, unit_weight: uw }];
    }
    // Check if there is an integer standard-bag count + 1 partial bag remainder (e.g. 99x50 + 1x45)
    const fullBags = Math.floor(w / uw);
    const remainder = round3(w - fullBags * uw);
    if (fullBags > 0 && remainder > 0.001 && Math.abs((fullBags + 1) - q) < 0.01) {
      return [
        { qty: fullBags, unit_weight: uw },
        { qty: 1, unit_weight: remainder }
      ];
    }
  }
  if (q > 0 && (uw > 0 || w > 0)) {
    return [{ qty: q, unit_weight: uw > 0 ? uw : round3(w / q) }];
  }
  return [];
}

function mergeBagBreakdowns(existingJsonOrArr, deltaJsonOrArr, direction = 'IN') {
  const map = new Map();
  const addItems = (items, sign) => {
    const arr = normalizeBagBreakdown(items);
    for (const row of arr) {
      const key = String(round3(row.unit_weight));
      const next = round3((map.get(key) || 0) + sign * row.qty);
      if (Math.abs(next) < 0.0005) {
        map.delete(key);
      } else {
        map.set(key, next);
      }
    }
  };
  addItems(existingJsonOrArr, 1);
  addItems(deltaJsonOrArr, direction === 'OUT' ? -1 : 1);

  return Array.from(map.entries())
    .map(([uw, qty]) => ({ qty: round3(qty), unit_weight: round3(uw) }))
    .filter(x => x.qty !== 0)
    .sort((a, b) => b.unit_weight - a.unit_weight);
}

function formatBagBreakdown(breakdownInput) {
  const arr = normalizeBagBreakdown(breakdownInput);
  if (arr.length === 0) return '';
  return arr.map(b => `${b.qty}×${b.unit_weight}kg`).join(' + ');
}

module.exports = {
  buildStockIdentityKey,
  buildPostingKey,
  normalizeBagBreakdown,
  mergeBagBreakdowns,
  formatBagBreakdown,
  round3
};
