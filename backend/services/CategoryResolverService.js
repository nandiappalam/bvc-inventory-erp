const db = require('../config/database');

const STOCK_CATEGORIES = {
  RM: 'RM',
  FG: 'FG',
  BAG: 'Bag Material',
  VACUUM: 'Vacuum Material',
  WASTAGE: 'Wastage'
};

const STORAGE_TYPES = {
  FACTORY: 'Factory',
  COLD_STORAGE: 'Cold Storage',
  OUTSIDE_PROCESSING: 'Outside Processing'
};

const WASTAGE_SUBTYPES = {
  RECOVERABLE: 'RECOVERABLE',
  PROCESS_LOSS: 'PROCESS_LOSS'
};

function normalizeToken(val) {
  return String(val || '').trim().toLowerCase();
}

function normalizeCategoryInput(raw) {
  const t = normalizeToken(raw);
  if (!t) return null;
  if (t === 'all') return 'ALL';
  if (t === 'rm' || t === 'rm stock' || t === 'raw material') return STOCK_CATEGORIES.RM;
  if (t === 'fg' || t === 'fg stock' || t === 'finished goods' || t === 'finished good') return STOCK_CATEGORIES.FG;
  if (t === 'bag' || t === 'bag material' || t === 'bag material stock' || t === 'bags') return STOCK_CATEGORIES.BAG;
  if (t === 'vacuum' || t === 'vacuum material' || t === 'vacuum material stock' || t === 'vacuum bag') return STOCK_CATEGORIES.VACUUM;
  if (t === 'wastage' || t === 'wastage stock' || t === 'rejection') return STOCK_CATEGORIES.WASTAGE;
  if (t === 'cold storage' || t === 'cold storage stock' || t === 'cold') return 'Cold Storage';
  return null;
}

function isFinishedFoodCommodity(nameLower, grpLower) {
  // Distinguish "Vacuum GN" (finished food product) from "Vacuum Bag" / "Vacuum Pouch" (packaging material)
  if (nameLower.includes('vacuum gn') || nameLower.includes('vacuum ground') || nameLower.includes('gn vacuum')) {
    return true;
  }
  if (
    (grpLower.includes('finished') || grpLower === 'fg' || grpLower.includes('papad') || grpLower.includes('flour')) &&
    !nameLower.includes('bag') &&
    !nameLower.includes('pouch') &&
    !nameLower.includes('roll') &&
    !nameLower.includes('film')
  ) {
    return true;
  }
  return false;
}

function classifyWastageSubtype({ itemName, itemGroup, category, lotNo } = {}) {
  const txt = `${normalizeToken(itemName)} ${normalizeToken(itemGroup)} ${normalizeToken(category)} ${normalizeToken(lotNo)}`;
  if (
    txt.includes('process loss') ||
    txt.includes('invisible') ||
    txt.includes('moisture loss') ||
    txt.includes('drying loss') ||
    txt.includes('weight loss') ||
    txt === 'loss' ||
    /\bloss\b/.test(txt)
  ) {
    return WASTAGE_SUBTYPES.PROCESS_LOSS;
  }
  return WASTAGE_SUBTYPES.RECOVERABLE;
}

async function resolveItemMeta(runner, { itemId = null, itemCode = null, itemName = '' } = {}) {
  try {
    if (itemId && Number(itemId) > 0) {
      const byId = await runner.get(
        `SELECT id, item_code, item_name, item_group, type, unit, weight, stock_category FROM item_master WHERE id = ? LIMIT 1`,
        [Number(itemId)]
      );
      if (byId) return byId;
    }
    if (itemCode && String(itemCode).trim()) {
      const byCode = await runner.get(
        `SELECT id, item_code, item_name, item_group, type, unit, weight, stock_category FROM item_master WHERE LOWER(item_code) = LOWER(?) LIMIT 1`,
        [String(itemCode).trim()]
      );
      if (byCode) return byCode;
    }
    if (itemName && String(itemName).trim()) {
      const byName = await runner.get(
        `SELECT id, item_code, item_name, item_group, type, unit, weight, stock_category FROM item_master WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?)) LIMIT 1`,
        [String(itemName).trim()]
      );
      if (byName) return byName;
    }
  } catch (_) {}
  return null;
}

async function resolveGodownMeta(runner, { godownId = null, godownName = '' } = {}) {
  try {
    if (godownId && Number(godownId) > 0) {
      const byId = await runner.get(
        `SELECT id, godown_name, godown_type, storage_location, is_cold_storage FROM godown_master WHERE id = ? LIMIT 1`,
        [Number(godownId)]
      );
      if (byId) return byId;
    }
    if (godownName && String(godownName).trim()) {
      const byName = await runner.get(
        `SELECT id, godown_name, godown_type, storage_location, is_cold_storage FROM godown_master WHERE LOWER(TRIM(godown_name)) = LOWER(TRIM(?)) LIMIT 1`,
        [String(godownName).trim()]
      );
      if (byName) return byName;
    }
  } catch (_) {}
  return null;
}

function classifyCategorySync({
  itemMeta = null,
  itemName = '',
  itemGroup = '',
  itemType = '',
  explicitCategory = null,
  sourceModule = '',
  lineType = '',
  lotNo = '',
  godownMeta = null,
  godownName = '',
  explicitStorageType = null
} = {}) {
  const resolvedName = String(itemMeta?.item_name || itemName || '').trim();
  const resolvedGroup = String(itemMeta?.item_group || itemGroup || '').trim();
  const resolvedType = String(itemMeta?.type || itemType || '').trim();
  const nameLower = normalizeToken(resolvedName);
  const grpLower = normalizeToken(resolvedGroup);
  const typeLower = normalizeToken(resolvedType);
  const modUpper = String(sourceModule || '').trim().toUpperCase();
  const lineLower = normalizeToken(lineType);
  const lotUpper = String(lotNo || '').trim().toUpperCase();

  // Determine storage_type independently so Cold Storage preserves material category
  let storageType = STORAGE_TYPES.FACTORY;
  if (explicitStorageType && Object.values(STORAGE_TYPES).includes(explicitStorageType)) {
    storageType = explicitStorageType;
  } else {
    const gType = normalizeToken(godownMeta?.godown_type);
    const gLoc = normalizeToken(godownMeta?.storage_location);
    const gName = normalizeToken(godownMeta?.godown_name || godownName);
    if (
      Number(godownMeta?.is_cold_storage || 0) === 1 ||
      gType.includes('cold') ||
      gLoc.includes('cold') ||
      gName.includes('cold') ||
      gName.includes('bts')
    ) {
      storageType = STORAGE_TYPES.COLD_STORAGE;
    } else if (
      modUpper === 'OUTPASS' ||
      modUpper === 'OUTSIDE_PROCESSING' ||
      gLoc.includes('outside')
    ) {
      storageType = STORAGE_TYPES.OUTSIDE_PROCESSING;
    }
  }

  // Determine underlying 5 material categories
  let stockCategory = null;
  let wastageSubtype = null;

  const masterCat = normalizeCategoryInput(itemMeta?.stock_category);
  if (masterCat && masterCat !== 'ALL' && masterCat !== 'Cold Storage') {
    stockCategory = masterCat;
  }

  const explicitNorm = normalizeCategoryInput(explicitCategory);
  if (!stockCategory && explicitNorm && explicitNorm !== 'ALL' && explicitNorm !== 'Cold Storage') {
    stockCategory = explicitNorm;
  }

  // 1. Vacuum Material vs Vacuum GN (FG)
  if (!stockCategory) {
    if (isFinishedFoodCommodity(nameLower, grpLower)) {
      stockCategory = STOCK_CATEGORIES.FG;
    } else if (
      nameLower.includes('vacuum bag') ||
      nameLower.includes('vaccum bag') ||
      nameLower.includes('vacuum pouch') ||
      nameLower.includes('vaccum pouch') ||
      nameLower.includes('vacuum roll') ||
      nameLower.includes('vacuum film') ||
      grpLower.includes('vacuum') ||
      ((grpLower.includes('packing material') || grpLower.includes('packaging')) &&
        (nameLower.includes('vacuum') || nameLower.includes('vaccum') || nameLower.includes('pouch')))
    ) {
      stockCategory = STOCK_CATEGORIES.VACUUM;
    }
  }

  // 2. Wastage
  if (!stockCategory) {
    const isFoodException =
      nameLower.includes('broken rice') ||
      nameLower.includes('chana dal') ||
      nameLower.includes('urad') ||
      nameLower.includes('ground nut') ||
      nameLower.includes('groundnut') ||
      nameLower.includes('papad') ||
      nameLower.includes('flour');

    if (
      lineLower === 'wastage' ||
      modUpper === 'GRAIN_WASTAGE' ||
      lotUpper.startsWith('WST') ||
      lotUpper.startsWith('WAST') ||
      grpLower.includes('wastage') ||
      grpLower.includes('reject') ||
      grpLower.includes('scrap') ||
      grpLower.includes('loss') ||
      (!isFoodException && (
        nameLower.includes('wastage') ||
        nameLower.includes('rejection') ||
        nameLower.includes('reject') ||
        nameLower.includes('husk') ||
        nameLower.includes('chuni') ||
        nameLower.includes('bran') ||
        nameLower.includes('dust') ||
        nameLower.includes('scrap') ||
        nameLower.includes('process loss')
      ))
    ) {
      stockCategory = STOCK_CATEGORIES.WASTAGE;
      wastageSubtype = classifyWastageSubtype({ itemName: resolvedName, itemGroup: resolvedGroup, lotNo: lotUpper });
    }
  }

  // 3. Bag Material
  if (!stockCategory) {
    const bagGroup =
      grpLower.includes('bag') ||
      grpLower.includes('packing material') ||
      grpLower.includes('packaging') ||
      grpLower.includes('gunny') ||
      grpLower.includes('consumable');

    const bagName =
      nameLower.includes('blu bag') ||
      nameLower.includes('blue bag') ||
      nameLower.includes('brown bag') ||
      nameLower.includes('green bag') ||
      nameLower.includes('white bag') ||
      nameLower.includes('yellow bag') ||
      nameLower.includes('red bag') ||
      nameLower.includes('pp bag') ||
      nameLower.includes('hdpe bag') ||
      nameLower.includes('gunny bag') ||
      nameLower.includes('jute bag') ||
      nameLower.includes('bopp bag') ||
      /\bbags?\b/.test(nameLower);

    if (bagGroup || (bagName && !grpLower.includes('raw') && !grpLower.includes('finished'))) {
      stockCategory = STOCK_CATEGORIES.BAG;
    }
  }

  // 4. Item Group / Type based RM vs FG
  if (!stockCategory) {
    if (
      grpLower.includes('finished') ||
      grpLower === 'fg' ||
      grpLower.includes('papad') ||
      grpLower.includes('flour') ||
      grpLower.includes('masala') ||
      typeLower === 'finished' ||
      typeLower === 'fg'
    ) {
      stockCategory = STOCK_CATEGORIES.FG;
    } else if (
      grpLower.includes('raw') ||
      grpLower === 'rm' ||
      grpLower.includes('urad') ||
      grpLower.includes('grain') ||
      grpLower.includes('pulse') ||
      grpLower.includes('nut') ||
      grpLower.includes('commodity') ||
      typeLower === 'raw' ||
      typeLower === 'rm'
    ) {
      stockCategory = STOCK_CATEGORIES.RM;
    }
  }

  // 5. Source Module & Lot prefix fallback
  if (!stockCategory) {
    if (
      lineLower === 'output' ||
      modUpper === 'GRAIN_OUTPUT' ||
      modUpper === 'PACKING_TO' ||
      modUpper === 'WEIGHT_CONVERSION_TO' ||
      modUpper === 'INPASS_OUTPUT' ||
      modUpper === 'PAPAD_IN' ||
      modUpper === 'SALES' ||
      modUpper === 'SALES_RETURN' ||
      lotUpper.startsWith('FG') ||
      lotUpper.startsWith('PK') ||
      lotUpper.startsWith('WC')
    ) {
      stockCategory = STOCK_CATEGORIES.FG;
    } else if (lineLower === 'material' || modUpper === 'PACKING_MATERIAL') {
      stockCategory = nameLower.includes('vacuum') || nameLower.includes('pouch') ? STOCK_CATEGORIES.VACUUM : STOCK_CATEGORIES.BAG;
    } else {
      stockCategory = STOCK_CATEGORIES.RM;
    }
  }

  if (stockCategory === STOCK_CATEGORIES.WASTAGE && !wastageSubtype) {
    wastageSubtype = classifyWastageSubtype({ itemName: resolvedName, itemGroup: resolvedGroup, lotNo: lotUpper });
  }

  return {
    stockCategory,
    storageType,
    wastageSubtype,
    displayCategory: storageType === STORAGE_TYPES.COLD_STORAGE ? `Cold Storage (${stockCategory})` : stockCategory,
    itemMeta
  };
}

async function resolveCategory(companyId, opts = {}, conn = null) {
  const runner = conn || db.forCompany(companyId);
  const itemMeta = opts.itemMeta || await resolveItemMeta(runner, {
    itemId: opts.itemId,
    itemCode: opts.itemCode,
    itemName: opts.itemName
  });
  const godownMeta = opts.godownMeta || await resolveGodownMeta(runner, {
    godownId: opts.godownId,
    godownName: opts.godownName
  });
  return classifyCategorySync({ ...opts, itemMeta, godownMeta });
}

function matchesCategoryFilter(row, filterCategory) {
  if (!filterCategory || filterCategory === 'ALL') return true;
  const norm = normalizeCategoryInput(filterCategory);
  if (!norm || norm === 'ALL') return true;
  if (norm === 'Cold Storage') {
    return String(row.storage_type || '').toLowerCase() === 'cold storage';
  }
  return String(row.stock_category || '').toLowerCase() === norm.toLowerCase();
}

module.exports = {
  STOCK_CATEGORIES,
  STORAGE_TYPES,
  WASTAGE_SUBTYPES,
  normalizeCategoryInput,
  classifyCategorySync,
  classifyWastageSubtype,
  resolveItemMeta,
  resolveGodownMeta,
  resolveCategory,
  matchesCategoryFilter
};
