const db = require('../config/database');

const isNumericId = (val) => {
  if (val === null || val === undefined) return false;
  const s = String(val).trim();
  return /^\d+$/.test(s);
};

/**
 * Resolve area_master ID or raw area string into human-readable area name.
 */
async function resolveAreaName(areaVal, companyId = 1) {
  if (areaVal === null || areaVal === undefined) return '';
  const raw = String(areaVal).trim();
  if (!raw) return '';

  if (isNumericId(raw)) {
    try {
      const res = await db.query(
        'SELECT name, print_name FROM area_master WHERE id = ? LIMIT 1',
        [parseInt(raw, 10)],
        companyId
      );
      if (res.rows && res.rows.length > 0) {
        return (res.rows[0].name || res.rows[0].print_name || raw).trim();
      }
    } catch (_) {}
  }

  return raw;
}

/**
 * Resolve flour mill ID / name and associated area / address safely.
 * Note: flour_mill_master has columns (id, flourmill, print_name, area, address1..4) — NO 'name' column.
 */
async function resolveFlourMillInfo(millRef, companyId = 1, options = {}) {
  const { partyId = null, destination = null } = options || {};
  const cId = parseInt(companyId, 10) || 1;
  let millRow = null;

  const lookupCandidates = [];
  if (partyId !== null && partyId !== undefined && String(partyId).trim() !== '') {
    lookupCandidates.push(partyId);
  }
  if (millRef !== null && millRef !== undefined && String(millRef).trim() !== '') {
    lookupCandidates.push(millRef);
  }

  for (const cand of lookupCandidates) {
    if (millRow) break;
    const raw = String(cand).trim();
    if (!raw) continue;

    try {
      if (isNumericId(raw)) {
        const res = await db.query(
          'SELECT id, flourmill, print_name, area, address1, address2, address3 FROM flour_mill_master WHERE id = ? LIMIT 1',
          [parseInt(raw, 10)],
          cId
        );
        if (res.rows && res.rows.length > 0) {
          millRow = res.rows[0];
        }
      } else {
        const res = await db.query(
          `SELECT id, flourmill, print_name, area, address1, address2, address3
           FROM flour_mill_master
           WHERE LOWER(TRIM(COALESCE(flourmill, ''))) = LOWER(TRIM(?))
              OR LOWER(TRIM(COALESCE(print_name, ''))) = LOWER(TRIM(?))
           LIMIT 1`,
          [raw, raw],
          cId
        );
        if (res.rows && res.rows.length > 0) {
          millRow = res.rows[0];
        }
      }
    } catch (_) {}
  }

  let areaName = '';
  if (millRow && millRow.area !== null && millRow.area !== undefined && String(millRow.area).trim() !== '') {
    areaName = await resolveAreaName(millRow.area, cId);
  }

  let cleanDest = destination !== null && destination !== undefined ? String(destination).trim() : '';
  if (cleanDest && isNumericId(cleanDest)) {
    // Destination might itself be an area_master ID or redundant flour_mill ID
    const destNum = parseInt(cleanDest, 10);
    if (millRow && Number(millRow.id) === destNum && areaName) {
      cleanDest = areaName;
    } else {
      const resolvedDestArea = await resolveAreaName(cleanDest, cId);
      if (resolvedDestArea && !isNumericId(resolvedDestArea)) {
        cleanDest = resolvedDestArea;
      } else if (areaName) {
        cleanDest = areaName;
      }
    }
  }

  const rawRefStr = millRef !== null && millRef !== undefined ? String(millRef).trim() : '';
  const millName = millRow
    ? (millRow.flourmill || millRow.print_name || rawRefStr).trim()
    : (isNumericId(rawRefStr) ? '' : rawRefStr);

  const address = millRow
    ? [millRow.address1, millRow.address2, millRow.address3, areaName].filter(Boolean).join(', ')
    : '';

  const resolvedDestination = areaName || (isNumericId(cleanDest) ? '' : cleanDest) || millName || '';

  return {
    id: millRow ? millRow.id : (isNumericId(partyId) ? parseInt(partyId, 10) : (isNumericId(millRef) ? parseInt(millRef, 10) : null)),
    millName: millName || rawRefStr || '',
    areaName: areaName || (isNumericId(cleanDest) ? '' : cleanDest) || '',
    address,
    resolvedDestination
  };
}

/**
 * Batch-enrich records (grains, outpasses, inpasses) so any numeric IDs in
 * party_name, external_mill_name, flour_mill, or destination are converted to real names + areas.
 */
async function enrichRecordsWithMillNames(records = [], companyId = 1) {
  if (!Array.isArray(records) || records.length === 0) return records;
  const cId = parseInt(companyId, 10) || 1;

  const areaById = new Map();
  const millById = new Map();
  const millByName = new Map();

  try {
    const areaRes = await db.query('SELECT id, name, print_name FROM area_master', [], cId);
    for (const a of areaRes.rows || []) {
      const label = (a.name || a.print_name || '').trim();
      if (label) areaById.set(String(a.id), label);
    }
  } catch (_) {}

  try {
    const millRes = await db.query(
      'SELECT id, flourmill, print_name, area, address1, address2, address3 FROM flour_mill_master',
      [],
      cId
    );
    for (const m of millRes.rows || []) {
      const millName = (m.flourmill || m.print_name || '').trim();
      const rawArea = m.area !== null && m.area !== undefined ? String(m.area).trim() : '';
      const resolvedArea = isNumericId(rawArea) ? (areaById.get(rawArea) || rawArea) : rawArea;
      const address = [m.address1, m.address2, m.address3, resolvedArea].filter(Boolean).join(', ');
      const info = {
        id: m.id,
        millName,
        resolvedArea,
        address
      };
      millById.set(String(m.id), info);
      if (m.flourmill) millByName.set(String(m.flourmill).trim().toLowerCase(), info);
      if (m.print_name) millByName.set(String(m.print_name).trim().toLowerCase(), info);
    }
  } catch (_) {}

  const findMill = (record) => {
    const candidates = [
      record.external_mill_id,
      record.party_id,
      record.flour_mill,
      record.external_mill_name,
      record.party_name
    ];
    for (const cand of candidates) {
      if (cand === null || cand === undefined) continue;
      const s = String(cand).trim();
      if (!s) continue;
      if (isNumericId(s) && millById.has(s)) {
        return millById.get(s);
      }
      const byName = millByName.get(s.toLowerCase());
      if (byName) return byName;
    }
    return null;
  };

  return records.map((rec) => {
    const mill = findMill(rec);
    const nonNumericFallback = [rec.flour_mill_name, rec.external_mill_name, rec.party_name, rec.flour_mill]
      .find((v) => v !== null && v !== undefined && String(v).trim() !== '' && !isNumericId(v));

    const resolvedMillName = mill?.millName || (nonNumericFallback ? String(nonNumericFallback).trim() : '') || rec.party_name || rec.external_mill_name || rec.flour_mill || '';

    let resolvedArea = mill?.resolvedArea || '';
    if (!resolvedArea && rec.destination !== null && rec.destination !== undefined) {
      const destStr = String(rec.destination).trim();
      if (isNumericId(destStr)) {
        resolvedArea = areaById.get(destStr) || '';
      } else if (destStr && destStr !== resolvedMillName) {
        resolvedArea = destStr;
      }
    }

    if (mill?.id && !rec.party_id && 'party_id' in rec) {
      rec.party_id = mill.id;
    }
    if (mill?.id && !rec.external_mill_id && 'external_mill_id' in rec) {
      rec.external_mill_id = mill.id;
    }

    if ('party_name' in rec && (isNumericId(rec.party_name) || !rec.party_name) && resolvedMillName) {
      rec.party_name = resolvedMillName;
    }
    if ('external_mill_name' in rec && (isNumericId(rec.external_mill_name) || !rec.external_mill_name) && resolvedMillName) {
      rec.external_mill_name = resolvedMillName;
    }
    if ('flour_mill_name' in rec || 'flour_mill' in rec) {
      if (!rec.flour_mill_name || isNumericId(rec.flour_mill_name)) {
        rec.flour_mill_name = resolvedMillName;
      }
    }
    if ('destination' in rec) {
      if (isNumericId(rec.destination) || !rec.destination) {
        rec.destination = resolvedArea || resolvedMillName || '';
      }
    }

    if (resolvedArea) {
      rec.mill_area = resolvedArea;
    } else if (!rec.mill_area && rec.destination && !isNumericId(rec.destination)) {
      rec.mill_area = rec.destination;
    } else if (isNumericId(rec.mill_area)) {
      rec.mill_area = areaById.get(String(rec.mill_area).trim()) || '';
    }

    if (mill?.address) {
      rec.mill_address = mill.address;
    }

    return rec;
  });
}

module.exports = {
  isNumericId,
  resolveAreaName,
  resolveFlourMillInfo,
  enrichRecordsWithMillNames
};
