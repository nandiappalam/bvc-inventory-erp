const db = require('../config/database');
const { ensureStockRegisterSchema } = require('./StockRegisterSchema');
const { backfillCompanyMovements } = require('./BackfillAndReconciliationService');
const { matchesCategoryFilter, STOCK_CATEGORIES, STORAGE_TYPES } = require('./CategoryResolverService');
const { resolveFinancialYear, normalizeIsoDate, getPreviousDate } = require('./FinancialYearResolver');
const { buildPostingKey, buildStockIdentityKey, formatBagBreakdown, mergeBagBreakdowns, round3 } = require('./StockIdentityHelper');
const { postMovement, computeActiveReservations, buildNavRoute } = require('./InventoryService');
const { loadPartyDirectory, resolveSupplierFromDirectory, resolvePartyFromDirectory } = require('./PartyNameResolver');
const { resolveLotGenealogy } = require('./LotService');

const normalizedCompaniesSet = new Set();

function requireCompanyId(companyId) {
  const cId = parseInt(companyId, 10);
  if (!Number.isSafeInteger(cId) || cId <= 0) {
    throw new Error(`Explicit positive companyId is required (got: ${companyId})`);
  }
  return cId;
}

function normalizeTime(timeInput, defaultVal = '23:59:59') {
  if (!timeInput || !String(timeInput).trim()) return defaultVal;
  const s = String(timeInput).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return defaultVal;
  return `${m[1].padStart(2, '0')}:${m[2].padStart(2, '0')}:${(m[3] || '00').padStart(2, '0')}`;
}

async function ensureMovementsNormalizedAndCleaned(companyId, runner) {
  const cId = Number(companyId);
  if (normalizedCompaniesSet.has(cId)) return;
  try {
    // 1. Mark auto-mirrored Cold Storage duplicate movements as non-physical & reversed cleanly (without touching stock or stock_lots)
    try {
      const autoCsRows = await runner.all(`
        SELECT sm.id
        FROM stock_movements sm
        JOIN cold_storage_vouchers csv ON csv.id = sm.source_id
        WHERE sm.company_id = ?
          AND sm.source_module = 'COLD_STORAGE'
          AND COALESCE(sm.is_reversed, 0) = 0
          AND (
            LOWER(COALESCE(csv.remarks, '')) LIKE '%auto-sync from stock lot%'
            OR LOWER(COALESCE(csv.remarks, '')) LIKE '%auto-inward from purchase%'
            OR LOWER(COALESCE(csv.remarks, '')) LIKE '%auto-created from%'
          )
      `, [cId]);
      if (autoCsRows && autoCsRows.length > 0) {
        const ids = autoCsRows.map(r => r.id);
        const ph = ids.map(() => '?').join(',');
        await runner.run(
          `UPDATE stock_movements
           SET is_reversed = 1, is_physical_stock = 0,
               reversal_reason = 'Deduplicated auto-mirrored Cold Storage entry'
           WHERE id IN (${ph})`,
          ids
        );
      }
    } catch (_) {}

    // 2. Fix Cold Storage OUT movements where cold_storage_lot_no has no CS IN (direct CS purchase) or CS transfer OUT missing CS- prefix
    try {
      const csOutMovs = await runner.all(`
        SELECT sm.*
        FROM stock_movements sm
        JOIN godown_master gm ON (gm.id = sm.godown_id OR LOWER(TRIM(gm.godown_name)) = LOWER(TRIM(COALESCE(sm.godown_name, ''))))
        WHERE sm.company_id = ?
          AND COALESCE(sm.is_reversed, 0) = 0 AND COALESCE(sm.is_reversal, 0) = 0
          AND sm.direction = 'OUT'
          AND (COALESCE(gm.is_cold_storage, 0) = 1 OR LOWER(COALESCE(sm.godown_name, '')) LIKE '%cold%' OR LOWER(COALESCE(sm.godown_name, '')) LIKE '%bts%')
      `, [cId]);
      for (const m of (csOutMovs || [])) {
        const lot = String(m.lot_no || '').trim();
        const pLot = String(m.parent_lot_no || '').trim();
        let targetLot = null;

        if (lot && lot.toUpperCase().startsWith('CS-') && pLot && lot.toUpperCase() !== pLot.toUpperCase()) {
          // Check if CS lot has any active IN in this CS godown; if 0 and parent lot has IN, switch OUT to parent lot
          const csIn = await runner.get(
            `SELECT COALESCE(SUM(qty), 0) as q FROM stock_movements
             WHERE company_id = ? AND COALESCE(is_reversed, 0) = 0 AND COALESCE(is_reversal, 0) = 0
               AND direction = 'IN' AND LOWER(TRIM(lot_no)) = LOWER(TRIM(?))
               AND LOWER(TRIM(godown_name)) = LOWER(TRIM(?))`,
            [cId, lot, m.godown_name || '']
          );
          if (parseFloat(csIn?.q || 0) <= 0) {
            const pIn = await runner.get(
              `SELECT COALESCE(SUM(qty), 0) as q FROM stock_movements
               WHERE company_id = ? AND COALESCE(is_reversed, 0) = 0 AND COALESCE(is_reversal, 0) = 0
                 AND direction = 'IN' AND LOWER(TRIM(lot_no)) = LOWER(TRIM(?))
                 AND LOWER(TRIM(godown_name)) = LOWER(TRIM(?))`,
              [cId, pLot, m.godown_name || '']
            );
            if (parseFloat(pIn?.q || 0) > 0) targetLot = pLot;
          }
        } else if (lot && !lot.toUpperCase().startsWith('CS-')) {
          const ownIn = await runner.get(
            `SELECT COALESCE(SUM(qty), 0) as q FROM stock_movements
             WHERE company_id = ? AND COALESCE(is_reversed, 0) = 0 AND COALESCE(is_reversal, 0) = 0
               AND direction = 'IN' AND LOWER(TRIM(lot_no)) = LOWER(TRIM(?))
               AND LOWER(TRIM(godown_name)) = LOWER(TRIM(?))`,
            [cId, lot, m.godown_name || '']
          );
          if (parseFloat(ownIn?.q || 0) <= 0) {
            const csPref = `CS-${lot}`;
            const csIn = await runner.get(
              `SELECT COALESCE(SUM(qty), 0) as q FROM stock_movements
               WHERE company_id = ? AND COALESCE(is_reversed, 0) = 0 AND COALESCE(is_reversal, 0) = 0
                 AND direction = 'IN' AND LOWER(TRIM(lot_no)) = LOWER(TRIM(?))
                 AND LOWER(TRIM(godown_name)) = LOWER(TRIM(?))`,
              [cId, csPref, m.godown_name || '']
            );
            if (parseFloat(csIn?.q || 0) > 0) targetLot = csPref;
          }
        }

        if (targetLot) {
          const newKey = buildStockIdentityKey({
            companyId: cId,
            financialYear: m.financial_year,
            stockCategory: m.stock_category,
            storageType: m.storage_type,
            itemId: m.item_id,
            itemName: m.item_name,
            lotNo: targetLot,
            rmLotNo: m.rm_lot_no,
            fgLotNo: m.fg_lot_no,
            godownId: m.godown_id,
            godownName: m.godown_name
          });
          await runner.run(
            `UPDATE stock_movements SET lot_no = ?, identity_key = ? WHERE id = ?`,
            [targetLot, newKey, m.id]
          );
        }
      }
    } catch (_) {}

    // 3. Re-run idempotent backfill once to pick up any previously missed godown_transfers (e.g. same-day separate s_no)
    await backfillCompanyMovements(cId, runner);

    // 4. Repair numeric supplier_name / party_name and legacy nav_route values in stock_movements
    const partyDir = await loadPartyDirectory(cId, runner);
    const allMovs = await runner.all(
      `SELECT id, supplier_id, supplier_name, party_name, source_module, source_id, source_ref_no, nav_route FROM stock_movements WHERE company_id = ?`,
      [cId]
    );
    for (const m of (allMovs || [])) {
      const resolvedParty = resolvePartyFromDirectory(partyDir, {
        supplierName: m.supplier_name || '',
        supplierId: m.supplier_id || null,
        partyName: m.party_name || '',
        sourceModule: m.source_module || ''
      });
      const correctRoute = buildNavRoute(m.source_module, m.source_id, m.source_ref_no);
      const needsPartyFix = (resolvedParty.supplierName && resolvedParty.supplierName !== (m.supplier_name || '')) ||
        (resolvedParty.partyName && resolvedParty.partyName !== (m.party_name || '')) ||
        (resolvedParty.supplierId && !m.supplier_id);
      const needsRouteFix = correctRoute && correctRoute !== (m.nav_route || '');
      if (needsPartyFix || needsRouteFix) {
        await runner.run(
          `UPDATE stock_movements
           SET supplier_id = COALESCE(?, supplier_id),
               supplier_name = COALESCE(NULLIF(?, ''), supplier_name),
               party_name = COALESCE(NULLIF(?, ''), party_name),
               nav_route = ?
           WHERE id = ?`,
          [resolvedParty.supplierId, resolvedParty.supplierName, resolvedParty.partyName, correctRoute, m.id]
        );
      }
    }

    normalizedCompaniesSet.add(cId);
  } catch (err) {
    console.warn('Notice during ensureMovementsNormalizedAndCleaned:', err.message);
  }
}

async function ensureBackfilledIfEmpty(companyId, runner) {
  const cntRow = await runner.get(
    `SELECT COUNT(*) as cnt FROM stock_movements WHERE company_id = ?`,
    [companyId]
  );
  const cnt = parseInt(cntRow?.cnt || cntRow?.count || 0, 10);
  if (cnt === 0) {
    await backfillCompanyMovements(companyId, runner);
  }
  await ensureMovementsNormalizedAndCleaned(companyId, runner);
}

function enrichRowsWithResolvedParty(rows, partyDir) {
  if (!Array.isArray(rows) || !partyDir) return rows;
  return rows.map(r => {
    const supRaw = String(r.supplier_name || '').trim();
    const res = resolveSupplierFromDirectory(partyDir, supRaw, r.supplier_id || null);
    if (res && res.name && res.name !== supRaw) {
      return { ...r, supplier_id: res.id || r.supplier_id || null, supplier_name: res.name };
    }
    return r;
  });
}

async function logAudit(runner, { companyId, financialYear, entityType, entityId = null, entityRef = null, action, oldValue = null, newValue = null, performedBy = 'admin', reason = '' }) {
  try {
    await runner.run(
      `INSERT INTO stock_audit_logs (company_id, financial_year, entity_type, entity_id, entity_ref, action, old_value, new_value, performed_by, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        financialYear || null,
        entityType,
        entityId,
        entityRef,
        action,
        oldValue ? JSON.stringify(oldValue) : null,
        newValue ? JSON.stringify(newValue) : null,
        performedBy || 'admin',
        reason || ''
      ]
    );
  } catch (_) {}
}

function applyRegisterFilters(rows, filters = {}) {
  let out = rows;
  if (filters.stockCategory && filters.stockCategory !== 'ALL') {
    out = out.filter(r => matchesCategoryFilter(r, filters.stockCategory));
  }
  if (filters.search && String(filters.search).trim()) {
    const q = String(filters.search).trim().toLowerCase();
    out = out.filter(r =>
      String(r.item_name || '').toLowerCase().includes(q) ||
      String(r.item_code || '').toLowerCase().includes(q) ||
      String(r.lot_no || '').toLowerCase().includes(q) ||
      String(r.rm_lot_no || '').toLowerCase().includes(q) ||
      String(r.fg_lot_no || '').toLowerCase().includes(q) ||
      String(r.parent_lot_no || '').toLowerCase().includes(q) ||
      String(r.supplier_name || '').toLowerCase().includes(q)
    );
  }
  if (filters.supplierName && String(filters.supplierName).trim()) {
    const sup = String(filters.supplierName).trim().toLowerCase();
    out = out.filter(r => String(r.supplier_name || '').toLowerCase().includes(sup));
  }
  if (filters.rmLotNo && String(filters.rmLotNo).trim()) {
    const rl = String(filters.rmLotNo).trim().toLowerCase();
    out = out.filter(r => String(r.rm_lot_no || r.lot_no || '').toLowerCase().includes(rl));
  }
  if (filters.fgLotNo && String(filters.fgLotNo).trim()) {
    const fl = String(filters.fgLotNo).trim().toLowerCase();
    out = out.filter(r => String(r.fg_lot_no || '').toLowerCase().includes(fl));
  }
  if (filters.parentLotNo && String(filters.parentLotNo).trim()) {
    const pl = String(filters.parentLotNo).trim().toLowerCase();
    out = out.filter(r => String(r.parent_lot_no || '').toLowerCase().includes(pl));
  }
  if (filters.godownId && Number(filters.godownId) > 0) {
    out = out.filter(r => Number(r.godown_id) === Number(filters.godownId));
  } else if (filters.godownName && String(filters.godownName).trim() && filters.godownName !== 'ALL') {
    const gn = String(filters.godownName).trim().toLowerCase();
    out = out.filter(r => String(r.godown_name || '').toLowerCase() === gn);
  }
  if (filters.stockStatus && filters.stockStatus !== 'ALL') {
    const st = String(filters.stockStatus).trim().toLowerCase();
    out = out.filter(r => String(r.stock_status || 'Available').toLowerCase() === st);
  }
  if (filters.closingStatus && filters.closingStatus !== 'ALL') {
    const cs = String(filters.closingStatus).trim().toLowerCase();
    out = out.filter(r => String(r.line_status || r.closing_status || '').toLowerCase() === cs);
  }
  if (filters.varianceOnly) {
    out = out.filter(r => Math.abs(Number(r.variance_qty || 0)) > 0.001 || Math.abs(Number(r.variance_weight || 0)) > 0.001);
  }
  if (!filters.includeZeroRows) {
    // Keep rows that had activity, non-zero balance, opening, reservation, or variance
    out = out.filter(r =>
      Math.abs(Number(r.opening_qty || 0)) > 0.0001 ||
      Math.abs(Number(r.opening_weight || 0)) > 0.0001 ||
      Math.abs(Number(r.total_in_qty || 0)) > 0.0001 ||
      Math.abs(Number(r.total_out_qty || 0)) > 0.0001 ||
      Math.abs(Number(r.current_balance_qty || 0)) > 0.0001 ||
      Math.abs(Number(r.system_closing_qty || 0)) > 0.0001 ||
      Math.abs(Number(r.final_closing_qty || 0)) > 0.0001 ||
      Math.abs(Number(r.reserved_qty || 0)) > 0.0001 ||
      Math.abs(Number(r.variance_qty || 0)) > 0.0001
    );
  }
  return out;
}

function summarizeCategories(rows, qtyField, weightField) {
  const sum = (list) => ({
    qty: round3(list.reduce((s, r) => s + (Number(r[qtyField]) || 0), 0)),
    weight: round3(list.reduce((s, r) => s + (Number(r[weightField]) || 0), 0)),
    count: list.length
  });
  return {
    all: sum(rows),
    rm: sum(rows.filter(r => r.stock_category === STOCK_CATEGORIES.RM)),
    fg: sum(rows.filter(r => r.stock_category === STOCK_CATEGORIES.FG)),
    bagMaterial: sum(rows.filter(r => r.stock_category === STOCK_CATEGORIES.BAG)),
    vacuumMaterial: sum(rows.filter(r => r.stock_category === STOCK_CATEGORIES.VACUUM)),
    wastage: sum(rows.filter(r => r.stock_category === STOCK_CATEGORIES.WASTAGE)),
    coldStorage: sum(rows.filter(r => r.storage_type === STORAGE_TYPES.COLD_STORAGE))
  };
}

function createEmptyIdentityBucket(m) {
  return {
    identity_key: m.identity_key,
    stock_category: m.stock_category,
    storage_type: m.storage_type || STORAGE_TYPES.FACTORY,
    display_category: m.storage_type === STORAGE_TYPES.COLD_STORAGE ? `Cold Storage (${m.stock_category})` : m.stock_category,
    item_id: m.item_id || null,
    item_code: m.item_code || '',
    item_name: m.item_name,
    supplier_id: m.supplier_id || null,
    supplier_name: m.supplier_name || '',
    supplier_invoice_no: m.supplier_invoice_no || '',
    lot_no: m.lot_no || '',
    rm_lot_no: m.rm_lot_no || '',
    fg_lot_no: m.fg_lot_no || '',
    parent_lot_no: m.parent_lot_no || '',
    godown_id: m.godown_id || null,
    godown_name: m.godown_name || 'Main Godown',
    uom: m.uom || 'Bags',
    unit_weight: Number(m.unit_weight || 0),
    stock_status: m.stock_status || 'Available',
    arrival_date: '',
    processing_start_date: '',
    processing_completion_date: '',
    last_movement_at: '',
    source_module: m.source_module || '',
    source_ref_no: m.source_ref_no || '',
    remarks: m.remarks || '',
    bag_breakdown: []
  };
}

function mergeIdentityMetadata(target, m) {
  if (!target.item_code && m.item_code) target.item_code = m.item_code;
  if (!target.supplier_name && m.supplier_name) target.supplier_name = m.supplier_name;
  if (!target.supplier_invoice_no && m.supplier_invoice_no) target.supplier_invoice_no = m.supplier_invoice_no;
  if (!target.rm_lot_no && m.rm_lot_no) target.rm_lot_no = m.rm_lot_no;
  if (!target.fg_lot_no && m.fg_lot_no) target.fg_lot_no = m.fg_lot_no;
  if (!target.parent_lot_no && m.parent_lot_no) target.parent_lot_no = m.parent_lot_no;
  if (!target.arrival_date && (m.movement_type === 'PURCHASE_IN' || m.movement_type === 'OPENING')) {
    target.arrival_date = m.movement_date;
  }
  if (!target.processing_start_date && m.movement_type === 'PRODUCTION_ISSUE') {
    target.processing_start_date = m.movement_date;
  }
  if (m.movement_type === 'PRODUCTION_OUTPUT' || m.movement_type === 'INPASS_IN') {
    target.processing_completion_date = m.movement_date;
  }
  if (m.movement_timestamp && (!target.last_movement_at || m.movement_timestamp >= target.last_movement_at)) {
    target.last_movement_at = m.movement_timestamp;
    target.source_module = m.source_module || target.source_module;
    target.source_ref_no = m.source_ref_no || target.source_ref_no;
  }
  if (m.bag_breakdown_json) {
    target.bag_breakdown = mergeBagBreakdowns(target.bag_breakdown, m.bag_breakdown_json, m.direction);
  }
}

/**
 * Resolves Opening Stock Baseline for a given stockDate and financialYear:
 * Priority:
 *  1) Existing APPROVED_LOCKED snapshot in daily_stock_opening
 *  2) Previous day's APPROVED_LOCKED closing in daily_stock_closing + daily_stock_closing_lines + same-day opening adjustments
 *  3) Provisional calculation from prior movements inside this FY (+ explicit carry-forward / open baseline) + same-day opening adjustments
 *     setting isProvisional = true and warning banner.
 */
async function computeOpeningState(companyId, { stockDate, financialYear }, runner) {
  const cId = requireCompanyId(companyId);
  const targetDate = normalizeIsoDate(stockDate);
  const fyInfo = await resolveFinancialYear(cId, { date: targetDate, financialYear }, runner);
  const fy = fyInfo.financialYear;
  const prevDate = getPreviousDate(targetDate);

  // Check if an opening snapshot already exists for this date & FY
  const snapshotRows = await runner.all(
    `SELECT * FROM daily_stock_opening
     WHERE company_id = ? AND financial_year = ? AND stock_date = ?
     ORDER BY stock_category ASC, item_name ASC, id ASC`,
    [cId, fy, targetDate]
  );

  const hasApprovedSnapshot = (snapshotRows || []).some(r => r.status === 'APPROVED_LOCKED');
  if (hasApprovedSnapshot) {
    const partyDir = await loadPartyDirectory(cId, runner);
    const formatted = enrichRowsWithResolvedParty(snapshotRows.map((r, idx) => ({
      ...r,
      sno: idx + 1,
      display_category: r.storage_type === STORAGE_TYPES.COLD_STORAGE ? `Cold Storage (${r.stock_category})` : r.stock_category,
      bag_breakdown_display: formatBagBreakdown(r.bag_breakdown_json)
    })), partyDir);
    const anyProv = formatted.some(r => Number(r.is_provisional || 0) === 1);
    return {
      financialYear: fy,
      fyInfo,
      stockDate: targetDate,
      prevDate,
      status: 'APPROVED_LOCKED',
      isLocked: true,
      isProvisional: anyProv,
      provisionalWarning: anyProv ? 'PROVISIONAL OPENING — PREVIOUS DAY CLOSING NOT APPROVED' : null,
      rows: formatted
    };
  }

  // Check previous day's closing status
  const prevClosing = await runner.get(
    `SELECT * FROM daily_stock_closing
     WHERE company_id = ? AND financial_year = ? AND closing_date = ?
     LIMIT 1`,
    [cId, fy, prevDate]
  );

  const prevApproved = Boolean(prevClosing && prevClosing.status === 'APPROVED_LOCKED');
  let isProvisional = !prevApproved;
  const bucketMap = new Map();

  if (prevApproved) {
    const prevLines = await runner.all(
      `SELECT * FROM daily_stock_closing_lines WHERE closing_id = ? ORDER BY id ASC`,
      [prevClosing.id]
    );
    for (const l of (prevLines || [])) {
      const fQty = round3(l.final_closing_qty || 0);
      const fWt = round3(l.final_closing_weight || 0);
      if (Math.abs(fQty) <= 0.0001 && Math.abs(fWt) <= 0.0001) continue;
      bucketMap.set(l.identity_key, {
        company_id: cId,
        financial_year: fy,
        stock_date: targetDate,
        identity_key: l.identity_key,
        stock_category: l.stock_category,
        storage_type: l.storage_type || STORAGE_TYPES.FACTORY,
        display_category: l.storage_type === STORAGE_TYPES.COLD_STORAGE ? `Cold Storage (${l.stock_category})` : l.stock_category,
        item_id: l.item_id,
        item_code: l.item_code || '',
        item_name: l.item_name,
        supplier_id: null,
        supplier_name: l.supplier_name || '',
        supplier_invoice_no: l.supplier_invoice_no || '',
        lot_no: l.lot_no || '',
        rm_lot_no: l.rm_lot_no || '',
        fg_lot_no: l.fg_lot_no || '',
        parent_lot_no: l.parent_lot_no || '',
        godown_id: l.godown_id,
        godown_name: l.godown_name || 'Main Godown',
        uom: l.uom || 'Bags',
        unit_weight: Number(l.unit_weight || 0),
        prev_closing_qty: fQty,
        prev_closing_weight: fWt,
        opening_adjustment_qty: 0,
        opening_adjustment_weight: 0,
        opening_qty: fQty,
        opening_weight: fWt,
        bag_breakdown: l.bag_breakdown_json ? JSON.parse(l.bag_breakdown_json) : [],
        stock_status: l.stock_status || 'Available',
        is_provisional: 0,
        is_first_day_fy: fyInfo.isFirstDayOfFy ? 1 : 0,
        status: 'DRAFT',
        source_closing_id: prevClosing.id,
        remarks: `Carried forward from ${prevDate} approved closing`,
        prepared_by: 'System',
        last_updated: prevClosing.approved_at || prevClosing.updated_at || new Date().toISOString()
      });
    }
  } else {
    // Check if there is a previous FY approved closing when on Day 1 of FY
    let prevFyApprovedLines = [];
    if (fyInfo.isFirstDayOfFy) {
      const prevFyClosing = await runner.get(
        `SELECT * FROM daily_stock_closing
         WHERE company_id = ? AND closing_date = ? AND status = 'APPROVED_LOCKED'
         ORDER BY id DESC LIMIT 1`,
        [cId, prevDate]
      );
      if (prevFyClosing) {
        prevFyApprovedLines = await runner.all(
          `SELECT * FROM daily_stock_closing_lines WHERE closing_id = ?`,
          [prevFyClosing.id]
        );
        if (prevFyApprovedLines.length > 0) {
          isProvisional = false;
          for (const l of prevFyApprovedLines) {
            const fQty = round3(l.final_closing_qty || 0);
            const fWt = round3(l.final_closing_weight || 0);
            if (Math.abs(fQty) <= 0.0001 && Math.abs(fWt) <= 0.0001) continue;
            bucketMap.set(l.identity_key, {
              company_id: cId,
              financial_year: fy,
              stock_date: targetDate,
              identity_key: l.identity_key,
              stock_category: l.stock_category,
              storage_type: l.storage_type || STORAGE_TYPES.FACTORY,
              display_category: l.storage_type === STORAGE_TYPES.COLD_STORAGE ? `Cold Storage (${l.stock_category})` : l.stock_category,
              item_id: l.item_id,
              item_code: l.item_code || '',
              item_name: l.item_name,
              supplier_id: null,
              supplier_name: l.supplier_name || '',
              supplier_invoice_no: l.supplier_invoice_no || '',
              lot_no: l.lot_no || '',
              rm_lot_no: l.rm_lot_no || '',
              fg_lot_no: l.fg_lot_no || '',
              parent_lot_no: l.parent_lot_no || '',
              godown_id: l.godown_id,
              godown_name: l.godown_name || 'Main Godown',
              uom: l.uom || 'Bags',
              unit_weight: Number(l.unit_weight || 0),
              prev_closing_qty: fQty,
              prev_closing_weight: fWt,
              opening_adjustment_qty: 0,
              opening_adjustment_weight: 0,
              opening_qty: fQty,
              opening_weight: fWt,
              bag_breakdown: l.bag_breakdown_json ? JSON.parse(l.bag_breakdown_json) : [],
              stock_status: l.stock_status || 'Available',
              is_provisional: 0,
              is_first_day_fy: 1,
              status: 'DRAFT',
              source_closing_id: prevFyClosing.id,
              remarks: 'FY Opening Carry-Forward from prior FY approved closing',
              prepared_by: 'System',
              last_updated: prevFyClosing.approved_at || new Date().toISOString()
            });
          }
        }
      }
    }

    // Provisional accumulation of physical movements strictly prior to targetDate within FY (and prior open baseline)
    if (prevFyApprovedLines.length === 0) {
      const priorMovs = await runner.all(
        `SELECT * FROM stock_movements
         WHERE company_id = ?
           AND financial_year = ?
           AND movement_date < ?
           AND COALESCE(is_reversed, 0) = 0
           AND COALESCE(is_reversal, 0) = 0
           AND COALESCE(is_physical_stock, 1) = 1
         ORDER BY movement_timestamp ASC, id ASC`,
        [cId, fy, targetDate]
      );
      for (const m of (priorMovs || [])) {
        if (!bucketMap.has(m.identity_key)) {
          bucketMap.set(m.identity_key, {
            company_id: cId,
            financial_year: fy,
            stock_date: targetDate,
            ...createEmptyIdentityBucket(m),
            prev_closing_qty: 0,
            prev_closing_weight: 0,
            opening_adjustment_qty: 0,
            opening_adjustment_weight: 0,
            opening_qty: 0,
            opening_weight: 0,
            is_provisional: 1,
            is_first_day_fy: fyInfo.isFirstDayOfFy ? 1 : 0,
            status: 'DRAFT',
            source_closing_id: prevClosing ? prevClosing.id : null,
            remarks: prevClosing ? `Provisional (D-1 closing status: ${prevClosing.status})` : 'Provisional (No approved previous day closing)',
            prepared_by: 'System',
            last_updated: m.created_at || m.movement_timestamp
          });
        }
        const entry = bucketMap.get(m.identity_key);
        mergeIdentityMetadata(entry, m);
        const sign = m.direction === 'OUT' ? -1 : 1;
        entry.prev_closing_qty = round3(entry.prev_closing_qty + sign * (Number(m.qty) || 0));
        entry.prev_closing_weight = round3(entry.prev_closing_weight + sign * (Number(m.weight) || 0));
        entry.opening_qty = entry.prev_closing_qty;
        entry.opening_weight = entry.prev_closing_weight;
        entry.last_updated = m.created_at || m.movement_timestamp;
      }
    }
  }

  // Add same-day Opening Stock Entries (`movement_type = 'OPENING'` or `source_module = 'OPEN'`) on targetDate
  const dayOpeningMovs = await runner.all(
    `SELECT * FROM stock_movements
     WHERE company_id = ?
       AND financial_year = ?
       AND movement_date = ?
       AND (movement_type = 'OPENING' OR source_module = 'OPEN')
       AND COALESCE(is_reversed, 0) = 0
       AND COALESCE(is_reversal, 0) = 0
       AND COALESCE(is_physical_stock, 1) = 1
     ORDER BY movement_timestamp ASC, id ASC`,
    [cId, fy, targetDate]
  );

  for (const m of (dayOpeningMovs || [])) {
    if (!bucketMap.has(m.identity_key)) {
      bucketMap.set(m.identity_key, {
        company_id: cId,
        financial_year: fy,
        stock_date: targetDate,
        ...createEmptyIdentityBucket(m),
        prev_closing_qty: 0,
        prev_closing_weight: 0,
        opening_adjustment_qty: 0,
        opening_adjustment_weight: 0,
        opening_qty: 0,
        opening_weight: 0,
        is_provisional: fyInfo.isFirstDayOfFy ? 0 : (prevApproved ? 0 : 1),
        is_first_day_fy: fyInfo.isFirstDayOfFy ? 1 : 0,
        status: 'DRAFT',
        source_closing_id: prevClosing ? prevClosing.id : null,
        remarks: m.remarks || 'Opening Stock Entry',
        prepared_by: m.created_by || 'admin',
        last_updated: m.created_at || m.movement_timestamp
      });
    }
    const entry = bucketMap.get(m.identity_key);
    mergeIdentityMetadata(entry, m);
    const sign = m.direction === 'OUT' ? -1 : 1;
    entry.opening_adjustment_qty = round3(entry.opening_adjustment_qty + sign * (Number(m.qty) || 0));
    entry.opening_adjustment_weight = round3(entry.opening_adjustment_weight + sign * (Number(m.weight) || 0));
    entry.opening_qty = round3(entry.prev_closing_qty + entry.opening_adjustment_qty);
    entry.opening_weight = round3(entry.prev_closing_weight + entry.opening_adjustment_weight);
    entry.last_updated = m.created_at || m.movement_timestamp;
  }

  // On First Day of FY, if explicit opening movements exist with no previous closing required, clear provisional flag only if opening entries exist
  if (fyInfo.isFirstDayOfFy && (dayOpeningMovs || []).length > 0 && isProvisional) {
    isProvisional = false;
    for (const r of bucketMap.values()) {
      r.is_provisional = 0;
    }
  }

  const partyDir = await loadPartyDirectory(cId, runner);
  const rows = enrichRowsWithResolvedParty(
    Array.from(bucketMap.values())
      .map((r, idx) => ({
        ...r,
        sno: idx + 1,
        bag_breakdown_json: r.bag_breakdown && r.bag_breakdown.length > 0 ? JSON.stringify(r.bag_breakdown) : null,
        bag_breakdown_display: formatBagBreakdown(r.bag_breakdown)
      }))
      .sort((a, b) => a.stock_category.localeCompare(b.stock_category) || a.item_name.localeCompare(b.item_name)),
    partyDir
  );

  rows.forEach((r, i) => { r.sno = i + 1; });

  return {
    financialYear: fy,
    fyInfo,
    stockDate: targetDate,
    prevDate,
    status: (snapshotRows && snapshotRows.length > 0) ? snapshotRows[0].status : 'DRAFT',
    isLocked: false,
    isProvisional,
    provisionalWarning: isProvisional ? 'PROVISIONAL OPENING — PREVIOUS DAY CLOSING NOT APPROVED' : null,
    rows
  };
}

async function getDailyOpeningRegister(companyId, filters = {}) {
  const cId = requireCompanyId(companyId);
  const runner = db.forCompany(cId);
  await ensureStockRegisterSchema(cId, runner);
  await ensureBackfilledIfEmpty(cId, runner);

  const stockDate = normalizeIsoDate(filters.stockDate || new Date().toISOString().slice(0, 10));
  const state = await computeOpeningState(cId, { stockDate, financialYear: filters.financialYear }, runner);
  const filteredRows = applyRegisterFilters(state.rows, { ...filters, includeZeroRows: false });
  filteredRows.forEach((r, idx) => { r.sno = idx + 1; });

  const summary = summarizeCategories(filteredRows, 'opening_qty', 'opening_weight');

  return {
    reportTitle: 'DAILY OPENING STOCK REGISTER',
    companyId: cId,
    financialYear: state.financialYear,
    stockDate: state.stockDate,
    previousDate: state.prevDate,
    isFirstDayOfFy: state.fyInfo.isFirstDayOfFy,
    status: state.status,
    isLocked: state.isLocked,
    isProvisional: state.isProvisional,
    provisionalWarning: state.provisionalWarning,
    summaryCards: {
      totalRmOpening: summary.rm,
      totalFgOpening: summary.fg,
      totalBagOpening: summary.bagMaterial,
      totalVacuumOpening: summary.vacuumMaterial,
      totalWastageOpening: summary.wastage,
      totalColdStorageOpening: summary.coldStorage,
      totalAllOpening: summary.all
    },
    rows: filteredRows
  };
}

async function generateOpeningSnapshot(companyId, { stockDate, financialYear = null, approve = false, preparedBy = 'admin', remarks = '' } = {}) {
  const cId = requireCompanyId(companyId);
  const runner = db.forCompany(cId);
  await ensureStockRegisterSchema(cId, runner);
  await ensureBackfilledIfEmpty(cId, runner);

  const targetDate = normalizeIsoDate(stockDate);
  const fyInfo = await resolveFinancialYear(cId, { date: targetDate, financialYear }, runner);
  const fy = fyInfo.financialYear;

  return runner.withTransaction(async (tx) => {
    const existingLocked = await tx.get(
      `SELECT id FROM daily_stock_opening
       WHERE company_id = ? AND financial_year = ? AND stock_date = ? AND status = 'APPROVED_LOCKED'
       LIMIT 1`,
      [cId, fy, targetDate]
    );
    if (existingLocked) {
      const err = new Error(`Opening stock snapshot for ${targetDate} (${fy}) is already APPROVED_LOCKED and cannot be overwritten.`);
      err.statusCode = 409;
      throw err;
    }

    const state = await computeOpeningState(cId, { stockDate: targetDate, financialYear: fy }, tx);

    // Clear only DRAFT rows for this company + fy + date before inserting clean snapshot
    await tx.run(
      `DELETE FROM daily_stock_opening WHERE company_id = ? AND financial_year = ? AND stock_date = ? AND status != 'APPROVED_LOCKED'`,
      [cId, fy, targetDate]
    );

    const nextStatus = approve ? 'APPROVED_LOCKED' : 'DRAFT';
    const nowIso = new Date().toISOString();

    for (const r of state.rows) {
      await tx.run(
        `INSERT INTO daily_stock_opening (
          company_id, financial_year, stock_date, identity_key,
          stock_category, storage_type, item_id, item_code, item_name,
          supplier_id, supplier_name, supplier_invoice_no,
          lot_no, rm_lot_no, fg_lot_no, parent_lot_no,
          godown_id, godown_name, uom, unit_weight,
          prev_closing_qty, prev_closing_weight, opening_adjustment_qty, opening_adjustment_weight,
          opening_qty, opening_weight, bag_breakdown_json, stock_status,
          is_provisional, is_first_day_fy, status, source_closing_id, remarks,
          prepared_by, approved_by, approved_at, last_updated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cId, fy, targetDate, r.identity_key,
          r.stock_category, r.storage_type, r.item_id || null, r.item_code || '', r.item_name,
          r.supplier_id || null, r.supplier_name || '', r.supplier_invoice_no || '',
          r.lot_no || '', r.rm_lot_no || '', r.fg_lot_no || '', r.parent_lot_no || '',
          r.godown_id || null, r.godown_name || 'Main Godown', r.uom || 'Bags', Number(r.unit_weight || 0),
          round3(r.prev_closing_qty || 0), round3(r.prev_closing_weight || 0),
          round3(r.opening_adjustment_qty || 0), round3(r.opening_adjustment_weight || 0),
          round3(r.opening_qty || 0), round3(r.opening_weight || 0),
          r.bag_breakdown_json || null, r.stock_status || 'Available',
          r.is_provisional ? 1 : 0, fyInfo.isFirstDayOfFy ? 1 : 0, nextStatus, r.source_closing_id || null,
          remarks || r.remarks || '', preparedBy,
          approve ? preparedBy : null, approve ? nowIso : null, nowIso
        ]
      );
    }

    await logAudit(tx, {
      companyId: cId,
      financialYear: fy,
      entityType: 'OPENING',
      entityRef: `${fy}/${targetDate}`,
      action: approve ? 'APPROVE_AND_LOCK_OPENING' : 'GENERATE_OPENING_DRAFT',
      newValue: { rowCount: state.rows.length, status: nextStatus, isProvisional: state.isProvisional },
      performedBy: preparedBy,
      reason: remarks
    });

    return getDailyOpeningRegister(cId, { stockDate: targetDate, financialYear: fy });
  });
}

function accumulateDayMovementIntoRow(row, m) {
  const q = round3(m.qty || 0);
  const w = round3(m.weight || 0);
  const mt = String(m.movement_type || '').toUpperCase();

  if (m.direction === 'IN') {
    if (mt === 'PURCHASE_IN' || mt === 'QC_ACCEPT') {
      row.purchase_in_qty = round3(row.purchase_in_qty + q);
      row.purchase_in_weight = round3(row.purchase_in_weight + w);
    } else if (mt === 'PRODUCTION_OUTPUT' || mt === 'PACKING_IN' || mt === 'WEIGHT_CONVERSION_IN' || mt === 'INPASS_IN' || mt === 'PAPAD_IN' || mt === 'WASTAGE_RECOVERY') {
      row.production_in_qty = round3(row.production_in_qty + q);
      row.production_in_weight = round3(row.production_in_weight + w);
    } else if (mt === 'SALES_RETURN') {
      row.sales_return_in_qty = round3(row.sales_return_in_qty + q);
      row.sales_return_in_weight = round3(row.sales_return_in_weight + w);
    } else if (mt === 'TRANSFER_IN' || mt === 'COLD_STORAGE_IN') {
      row.transfer_in_qty = round3(row.transfer_in_qty + q);
      row.transfer_in_weight = round3(row.transfer_in_weight + w);
    } else if (mt === 'ADJUSTMENT_IN' || mt === 'CLOSING_ADJUSTMENT_IN') {
      row.adjustment_in_qty = round3(row.adjustment_in_qty + q);
      row.adjustment_in_weight = round3(row.adjustment_in_weight + w);
    } else {
      row.other_in_qty = round3(row.other_in_qty + q);
      row.other_in_weight = round3(row.other_in_weight + w);
    }
    row.total_in_qty = round3(row.total_in_qty + q);
    row.total_in_weight = round3(row.total_in_weight + w);
  } else {
    if (mt === 'PRODUCTION_ISSUE' || mt === 'OUTPASS_OUT') {
      row.production_out_qty = round3(row.production_out_qty + q);
      row.production_out_weight = round3(row.production_out_weight + w);
    } else if (mt === 'WEIGHT_CONVERSION_OUT' || mt === 'PACKING_OUT') {
      row.material_used_qty = round3(row.material_used_qty + q);
      row.material_used_weight = round3(row.material_used_weight + w);
    } else if (mt === 'PACKING_MATERIAL_OUT') {
      row.packing_material_used_qty = round3(row.packing_material_used_qty + q);
      row.packing_material_used_weight = round3(row.packing_material_used_weight + w);
    } else if (mt === 'SALES_DISPATCH') {
      row.sales_out_qty = round3(row.sales_out_qty + q);
      row.sales_out_weight = round3(row.sales_out_weight + w);
    } else if (mt === 'PURCHASE_RETURN') {
      row.purchase_return_out_qty = round3(row.purchase_return_out_qty + q);
      row.purchase_return_out_weight = round3(row.purchase_return_out_weight + w);
    } else if (mt === 'TRANSFER_OUT' || mt === 'COLD_STORAGE_OUT') {
      row.transfer_out_qty = round3(row.transfer_out_qty + q);
      row.transfer_out_weight = round3(row.transfer_out_weight + w);
    } else if (mt === 'WASTAGE_DISPOSAL') {
      row.wastage_disposal_qty = round3(row.wastage_disposal_qty + q);
      row.wastage_disposal_weight = round3(row.wastage_disposal_weight + w);
    } else if (mt === 'ADJUSTMENT_OUT' || mt === 'CLOSING_ADJUSTMENT_OUT') {
      row.adjustment_out_qty = round3(row.adjustment_out_qty + q);
      row.adjustment_out_weight = round3(row.adjustment_out_weight + w);
    } else {
      row.other_out_qty = round3(row.other_out_qty + q);
      row.other_out_weight = round3(row.other_out_weight + w);
    }
    row.total_out_qty = round3(row.total_out_qty + q);
    row.total_out_weight = round3(row.total_out_weight + w);
  }
}

function initDailyPositionRow(base) {
  return {
    identity_key: base.identity_key,
    stock_category: base.stock_category,
    storage_type: base.storage_type || STORAGE_TYPES.FACTORY,
    display_category: base.storage_type === STORAGE_TYPES.COLD_STORAGE ? `Cold Storage (${base.stock_category})` : base.stock_category,
    item_id: base.item_id || null,
    item_code: base.item_code || '',
    item_name: base.item_name,
    supplier_name: base.supplier_name || '',
    supplier_invoice_no: base.supplier_invoice_no || '',
    lot_no: base.lot_no || '',
    rm_lot_no: base.rm_lot_no || '',
    fg_lot_no: base.fg_lot_no || '',
    parent_lot_no: base.parent_lot_no || '',
    godown_id: base.godown_id || null,
    godown_name: base.godown_name || 'Main Godown',
    uom: base.uom || 'Bags',
    unit_weight: Number(base.unit_weight || 0),
    stock_status: base.stock_status || 'Available',
    opening_qty: round3(base.opening_qty || 0),
    opening_weight: round3(base.opening_weight || 0),
    purchase_in_qty: 0,
    purchase_in_weight: 0,
    production_in_qty: 0,
    production_in_weight: 0,
    sales_return_in_qty: 0,
    sales_return_in_weight: 0,
    transfer_in_qty: 0,
    transfer_in_weight: 0,
    adjustment_in_qty: 0,
    adjustment_in_weight: 0,
    other_in_qty: 0,
    other_in_weight: 0,
    total_in_qty: 0,
    total_in_weight: 0,
    total_available_qty: round3(base.opening_qty || 0),
    total_available_weight: round3(base.opening_weight || 0),
    production_out_qty: 0,
    production_out_weight: 0,
    material_used_qty: 0,
    material_used_weight: 0,
    packing_material_used_qty: 0,
    packing_material_used_weight: 0,
    sales_out_qty: 0,
    sales_out_weight: 0,
    purchase_return_out_qty: 0,
    purchase_return_out_weight: 0,
    transfer_out_qty: 0,
    transfer_out_weight: 0,
    wastage_disposal_qty: 0,
    wastage_disposal_weight: 0,
    adjustment_out_qty: 0,
    adjustment_out_weight: 0,
    other_out_qty: 0,
    other_out_weight: 0,
    total_out_qty: 0,
    total_out_weight: 0,
    current_balance_qty: round3(base.opening_qty || 0),
    current_balance_weight: round3(base.opening_weight || 0),
    reserved_qty: 0,
    reserved_weight: 0,
    available_stock_qty: round3(base.opening_qty || 0),
    available_stock_weight: round3(base.opening_weight || 0),
    arrival_date: base.arrival_date || '',
    processing_start_date: base.processing_start_date || '',
    processing_completion_date: base.processing_completion_date || '',
    last_movement_at: base.last_movement_at || base.last_updated || '',
    source_module: base.source_module || '',
    source_ref_no: base.source_ref_no || '',
    remarks: base.remarks || '',
    bag_breakdown: base.bag_breakdown_json ? (() => { try { return JSON.parse(base.bag_breakdown_json); } catch (_) { return []; } })() : (base.bag_breakdown || [])
  };
}

/**
 * Current / Live Stock Position Report (with exact Date + As-Of Time cutoff and non-physical Reservations)
 */
async function getCurrentLiveStockReport(companyId, filters = {}) {
  const cId = requireCompanyId(companyId);
  const runner = db.forCompany(cId);
  await ensureStockRegisterSchema(cId, runner);
  await ensureBackfilledIfEmpty(cId, runner);

  const stockDate = normalizeIsoDate(filters.stockDate || new Date().toISOString().slice(0, 10));
  const asOfTime = normalizeTime(filters.asOfTime, '23:59:59');
  const cutoffTs = `${stockDate} ${asOfTime}`;

  const openingState = await computeOpeningState(cId, { stockDate, financialYear: filters.financialYear }, runner);
  const fy = openingState.financialYear;

  const rowMap = new Map();
  for (const op of openingState.rows) {
    rowMap.set(op.identity_key, initDailyPositionRow(op));
  }

  // Same-day movements up to cutoffTs (excluding OPENING which is already in opening_qty)
  const dayMovs = await runner.all(
    `SELECT * FROM stock_movements
     WHERE company_id = ?
       AND financial_year = ?
       AND movement_date = ?
       AND movement_timestamp <= ?
       AND COALESCE(is_reversed, 0) = 0
       AND COALESCE(is_reversal, 0) = 0
       AND COALESCE(is_physical_stock, 1) = 1
       AND movement_type != 'OPENING'
       AND source_module != 'OPEN'
     ORDER BY movement_timestamp ASC, id ASC`,
    [cId, fy, stockDate, cutoffTs]
  );

  for (const m of (dayMovs || [])) {
    if (!rowMap.has(m.identity_key)) {
      rowMap.set(m.identity_key, initDailyPositionRow(createEmptyIdentityBucket(m)));
    }
    const row = rowMap.get(m.identity_key);
    mergeIdentityMetadata(row, m);
    accumulateDayMovementIntoRow(row, m);
  }

  // Compute physical totals
  const rowsList = Array.from(rowMap.values());
  for (const r of rowsList) {
    r.total_available_qty = round3(r.opening_qty + r.total_in_qty);
    r.total_available_weight = round3(r.opening_weight + r.total_in_weight);
    r.current_balance_qty = round3(r.total_available_qty - r.total_out_qty);
    r.current_balance_weight = round3(r.total_available_weight - r.total_out_weight);
    r.available_stock_qty = r.current_balance_qty;
    r.available_stock_weight = r.current_balance_weight;
    r.bag_breakdown_display = formatBagBreakdown(r.bag_breakdown);
  }

  // Compute Active Reservations (Work Orders + Sales Orders + Export Orders) without deducting physical stock
  const reservations = await computeActiveReservations(cId, { cutoffDate: stockDate }, runner);
  for (const resv of reservations) {
    const resItem = String(resv.itemName || '').trim().toLowerCase();
    const resLot = String(resv.lotNo || '').trim().toLowerCase();
    let matched = rowsList.find(r =>
      String(r.item_name || '').trim().toLowerCase() === resItem &&
      (!resLot || String(r.lot_no || '').trim().toLowerCase() === resLot) &&
      (!resv.godownId || Number(r.godown_id) === Number(resv.godownId))
    );
    if (!matched && resLot) {
      matched = rowsList.find(r =>
        String(r.lot_no || '').trim().toLowerCase() === resLot ||
        String(r.rm_lot_no || '').trim().toLowerCase() === resLot
      );
    }
    if (matched) {
      matched.reserved_qty = round3(matched.reserved_qty + (resv.qty || 0));
      matched.reserved_weight = round3(matched.reserved_weight + (resv.weight || 0));
      matched.available_stock_qty = round3(matched.current_balance_qty - matched.reserved_qty);
      matched.available_stock_weight = round3(matched.current_balance_weight - matched.reserved_weight);
    }
  }

  for (const r of rowsList) {
    r.is_negative_physical = r.current_balance_qty < -0.001 || r.current_balance_weight < -0.001;
    r.is_over_reserved = r.available_stock_qty < -0.001 || r.available_stock_weight < -0.001;
    r.warning_flag = r.is_negative_physical ? 'NEGATIVE_STOCK' : (r.is_over_reserved ? 'OVER_RESERVED' : null);
  }

  const partyDir = await loadPartyDirectory(cId, runner);
  const enrichedRows = enrichRowsWithResolvedParty(rowsList, partyDir);
  const filtered = applyRegisterFilters(enrichedRows, filters);
  filtered.forEach((r, idx) => { r.sno = idx + 1; });

  const catPhysical = summarizeCategories(filtered, 'current_balance_qty', 'current_balance_weight');
  const totalReservedQty = round3(filtered.reduce((s, r) => s + r.reserved_qty, 0));
  const totalReservedWt = round3(filtered.reduce((s, r) => s + r.reserved_weight, 0));
  const totalAvailQty = round3(filtered.reduce((s, r) => s + r.available_stock_qty, 0));
  const totalAvailWt = round3(filtered.reduce((s, r) => s + r.available_stock_weight, 0));

  return {
    reportTitle: 'CURRENT STOCK POSITION REPORT',
    companyId: cId,
    financialYear: fy,
    stockDate,
    asOfTime,
    cutoffTimestamp: cutoffTs,
    isProvisionalOpening: openingState.isProvisional,
    provisionalWarning: openingState.provisionalWarning,
    summaryCards: {
      totalPhysicalStock: catPhysical.all,
      totalReservedStock: { qty: totalReservedQty, weight: totalReservedWt },
      totalAvailableStock: { qty: totalAvailQty, weight: totalAvailWt },
      totalRmStock: catPhysical.rm,
      totalFgStock: catPhysical.fg,
      totalPackagingMaterial: {
        qty: round3(catPhysical.bagMaterial.qty + catPhysical.vacuumMaterial.qty),
        weight: round3(catPhysical.bagMaterial.weight + catPhysical.vacuumMaterial.weight)
      },
      totalWastage: catPhysical.wastage,
      totalColdStorage: catPhysical.coldStorage,
      negativeWarningsCount: filtered.filter(r => r.is_negative_physical).length,
      overReservedWarningsCount: filtered.filter(r => r.is_over_reserved).length
    },
    rows: filtered
  };
}

function buildClosingSummary(header, lines) {
  const totalSystemQty = round3(lines.reduce((s, r) => s + (Number(r.system_closing_qty) || 0), 0));
  const totalSystemWt = round3(lines.reduce((s, r) => s + (Number(r.system_closing_weight) || 0), 0));
  const countedLines = lines.filter(r => r.physical_count_qty !== null && r.physical_count_qty !== undefined && r.physical_count_qty !== '');
  const totalPhysQty = round3(countedLines.reduce((s, r) => s + (Number(r.physical_count_qty) || 0), 0));
  const totalPhysWt = round3(countedLines.reduce((s, r) => s + (Number(r.physical_count_weight) || 0), 0));
  const totalShortageQty = round3(lines.filter(r => Number(r.variance_qty || 0) < 0).reduce((s, r) => s + Math.abs(Number(r.variance_qty)), 0));
  const totalShortageWt = round3(lines.filter(r => Number(r.variance_weight || 0) < 0).reduce((s, r) => s + Math.abs(Number(r.variance_weight)), 0));
  const totalExcessQty = round3(lines.filter(r => Number(r.variance_qty || 0) > 0).reduce((s, r) => s + Number(r.variance_qty), 0));
  const totalExcessWt = round3(lines.filter(r => Number(r.variance_weight || 0) > 0).reduce((s, r) => s + Number(r.variance_weight), 0));

  return {
    totalSystemClosing: { qty: totalSystemQty, weight: totalSystemWt },
    totalPhysicalCount: { qty: totalPhysQty, weight: totalPhysWt, countedRows: countedLines.length },
    totalShortage: { qty: totalShortageQty, weight: totalShortageWt },
    totalExcess: { qty: totalExcessQty, weight: totalExcessWt },
    pendingVerification: header?.status === 'DRAFT' ? lines.length : 0,
    pendingApproval: header?.status === 'VERIFIED' ? lines.length : 0
  };
}

/**
 * Daily Closing Stock Register (read live/draft OR locked snapshot)
 */
async function getDailyClosingRegister(companyId, filters = {}) {
  const cId = requireCompanyId(companyId);
  const runner = db.forCompany(cId);
  await ensureStockRegisterSchema(cId, runner);
  await ensureBackfilledIfEmpty(cId, runner);

  const closingDate = normalizeIsoDate(filters.closingDate || filters.stockDate || new Date().toISOString().slice(0, 10));
  const fyInfo = await resolveFinancialYear(cId, { date: closingDate, financialYear: filters.financialYear }, runner);
  const fy = fyInfo.financialYear;

  const header = await runner.get(
    `SELECT * FROM daily_stock_closing WHERE company_id = ? AND financial_year = ? AND closing_date = ? LIMIT 1`,
    [cId, fy, closingDate]
  );

  let lines = [];
  if (header) {
    const storedLines = await runner.all(
      `SELECT * FROM daily_stock_closing_lines WHERE closing_id = ? ORDER BY stock_category ASC, item_name ASC, id ASC`,
      [header.id]
    );
    if (header.status === 'APPROVED_LOCKED' || storedLines.length > 0) {
      const partyDir = await loadPartyDirectory(cId, runner);
      lines = enrichRowsWithResolvedParty(storedLines.map((l, idx) => ({
        ...l,
        sno: idx + 1,
        display_category: l.storage_type === STORAGE_TYPES.COLD_STORAGE ? `Cold Storage (${l.stock_category})` : l.stock_category,
        closing_status: header.status,
        prepared_by: header.prepared_by,
        verified_by: header.verified_by,
        approved_by: header.approved_by,
        closing_datetime: header.approved_at || header.verified_at || header.updated_at,
        bag_breakdown_display: formatBagBreakdown(l.bag_breakdown_json)
      })), partyDir);
    }
  }

  if (lines.length === 0) {
    // Live calculation preview matching exact cutoff
    const live = await getCurrentLiveStockReport(cId, {
      stockDate: closingDate,
      financialYear: fy,
      asOfTime: filters.cutoffTime || '23:59:59'
    });
    lines = live.rows.map((r, idx) => ({
      sno: idx + 1,
      closing_id: header ? header.id : null,
      identity_key: r.identity_key,
      stock_category: r.stock_category,
      storage_type: r.storage_type,
      display_category: r.display_category,
      item_id: r.item_id,
      item_code: r.item_code,
      item_name: r.item_name,
      supplier_name: r.supplier_name,
      supplier_invoice_no: r.supplier_invoice_no,
      lot_no: r.lot_no,
      rm_lot_no: r.rm_lot_no,
      fg_lot_no: r.fg_lot_no,
      parent_lot_no: r.parent_lot_no,
      godown_id: r.godown_id,
      godown_name: r.godown_name,
      uom: r.uom,
      unit_weight: r.unit_weight,
      opening_qty: r.opening_qty,
      opening_weight: r.opening_weight,
      purchase_in_qty: r.purchase_in_qty,
      purchase_in_weight: r.purchase_in_weight,
      production_in_qty: r.production_in_qty,
      production_in_weight: r.production_in_weight,
      sales_return_in_qty: r.sales_return_in_qty,
      sales_return_in_weight: r.sales_return_in_weight,
      transfer_in_qty: r.transfer_in_qty,
      transfer_in_weight: r.transfer_in_weight,
      adjustment_in_qty: r.adjustment_in_qty,
      adjustment_in_weight: r.adjustment_in_weight,
      other_in_qty: r.other_in_qty,
      other_in_weight: r.other_in_weight,
      total_in_qty: r.total_in_qty,
      total_in_weight: r.total_in_weight,
      production_out_qty: r.production_out_qty,
      production_out_weight: r.production_out_weight,
      material_used_qty: r.material_used_qty,
      material_used_weight: r.material_used_weight,
      packing_material_used_qty: r.packing_material_used_qty,
      packing_material_used_weight: r.packing_material_used_weight,
      sales_out_qty: r.sales_out_qty,
      sales_out_weight: r.sales_out_weight,
      purchase_return_out_qty: r.purchase_return_out_qty,
      purchase_return_out_weight: r.purchase_return_out_weight,
      transfer_out_qty: r.transfer_out_qty,
      transfer_out_weight: r.transfer_out_weight,
      wastage_disposal_qty: r.wastage_disposal_qty,
      wastage_disposal_weight: r.wastage_disposal_weight,
      adjustment_out_qty: r.adjustment_out_qty,
      adjustment_out_weight: r.adjustment_out_weight,
      other_out_qty: r.other_out_qty,
      other_out_weight: r.other_out_weight,
      total_out_qty: r.total_out_qty,
      total_out_weight: r.total_out_weight,
      system_closing_qty: r.current_balance_qty,
      system_closing_weight: r.current_balance_weight,
      physical_count_qty: null,
      physical_count_weight: null,
      variance_qty: 0,
      variance_weight: 0,
      variance_reason: '',
      approved_adjustment_qty: 0,
      approved_adjustment_weight: 0,
      final_closing_qty: r.current_balance_qty,
      final_closing_weight: r.current_balance_weight,
      bag_breakdown_display: r.bag_breakdown_display,
      stock_status: r.stock_status,
      line_status: header ? header.status : 'PREVIEW',
      closing_status: header ? header.status : 'PREVIEW',
      prepared_by: header?.prepared_by || '',
      verified_by: header?.verified_by || '',
      approved_by: header?.approved_by || '',
      closing_datetime: header?.updated_at || ''
    }));
  }

  const filtered = applyRegisterFilters(lines, filters);
  filtered.forEach((r, idx) => { r.sno = idx + 1; });

  return {
    reportTitle: 'DAILY CLOSING STOCK REGISTER',
    companyId: cId,
    financialYear: fy,
    closingDate,
    header: header || { id: null, closing_date: closingDate, financial_year: fy, status: 'PREVIEW', is_locked: 0 },
    status: header ? header.status : 'PREVIEW',
    isLocked: Boolean(header && header.status === 'APPROVED_LOCKED'),
    summaryCards: buildClosingSummary(header, filtered),
    rows: filtered
  };
}

async function createOrRefreshClosingDraft(companyId, { closingDate, financialYear = null, cutoffTime = '23:59:59', preparedBy = 'admin', remarks = '' } = {}) {
  const cId = requireCompanyId(companyId);
  const runner = db.forCompany(cId);
  await ensureStockRegisterSchema(cId, runner);
  await ensureBackfilledIfEmpty(cId, runner);

  const targetDate = normalizeIsoDate(closingDate);
  const cutoff = normalizeTime(cutoffTime, '23:59:59');
  const fyInfo = await resolveFinancialYear(cId, { date: targetDate, financialYear }, runner);
  const fy = fyInfo.financialYear;

  const livePos = await getCurrentLiveStockReport(cId, {
    stockDate: targetDate,
    financialYear: fy,
    asOfTime: cutoff
  });

  return runner.withTransaction(async (tx) => {
    const existing = await tx.get(
      `SELECT * FROM daily_stock_closing WHERE company_id = ? AND financial_year = ? AND closing_date = ? LIMIT 1`,
      [cId, fy, targetDate]
    );
    if (existing && (existing.status === 'APPROVED_LOCKED' || Number(existing.is_locked) === 1)) {
      const err = new Error(`Closing register for ${targetDate} (${fy}) is APPROVED_LOCKED and cannot be edited or regenerated.`);
      err.statusCode = 409;
      throw err;
    }

    const nowIso = new Date().toISOString();
    let closingId = existing ? existing.id : null;
    const prevPhysicalByIdentity = new Map();

    if (existing) {
      const oldLines = await tx.all(`SELECT * FROM daily_stock_closing_lines WHERE closing_id = ?`, [existing.id]);
      for (const ol of (oldLines || [])) {
        if (ol.physical_count_qty !== null && ol.physical_count_qty !== undefined) {
          prevPhysicalByIdentity.set(ol.identity_key, {
            physical_count_qty: Number(ol.physical_count_qty),
            physical_count_weight: ol.physical_count_weight !== null ? Number(ol.physical_count_weight) : null,
            variance_reason: ol.variance_reason || ''
          });
        }
      }
      await tx.run(
        `UPDATE daily_stock_closing
         SET cutoff_time = ?, status = 'DRAFT', prepared_by = ?, prepared_at = ?, remarks = ?, updated_at = ?
         WHERE id = ?`,
        [cutoff, preparedBy, nowIso, remarks || existing.remarks || '', nowIso, existing.id]
      );
      await tx.run(`DELETE FROM daily_stock_closing_lines WHERE closing_id = ?`, [existing.id]);
    } else {
      const ins = await tx.run(
        `INSERT INTO daily_stock_closing (
          company_id, financial_year, closing_date, cutoff_time, status, is_locked, prepared_by, prepared_at, remarks, updated_at
        ) VALUES (?, ?, ?, ?, 'DRAFT', 0, ?, ?, ?, ?)`,
        [cId, fy, targetDate, cutoff, preparedBy, nowIso, remarks || '', nowIso]
      );
      closingId = ins.lastInsertRowid;
    }

    const insertedLines = [];
    for (const r of livePos.rows) {
      const prevPhys = prevPhysicalByIdentity.get(r.identity_key);
      const sysQty = round3(r.current_balance_qty);
      const sysWt = round3(r.current_balance_weight);
      const physQty = prevPhys ? prevPhys.physical_count_qty : null;
      const physWt = prevPhys ? prevPhys.physical_count_weight : null;
      const varQty = physQty !== null ? round3(physQty - sysQty) : 0;
      const varWt = physWt !== null ? round3(physWt - sysWt) : 0;
      const varReason = prevPhys ? prevPhys.variance_reason : '';

      const lineObj = {
        system_closing_qty: sysQty,
        system_closing_weight: sysWt,
        physical_count_qty: physQty,
        physical_count_weight: physWt,
        variance_qty: varQty,
        variance_weight: varWt
      };
      insertedLines.push(lineObj);

      await tx.run(
        `INSERT INTO daily_stock_closing_lines (
          closing_id, company_id, financial_year, closing_date, identity_key,
          stock_category, storage_type, item_id, item_code, item_name,
          supplier_name, supplier_invoice_no, lot_no, rm_lot_no, fg_lot_no, parent_lot_no,
          godown_id, godown_name, uom, unit_weight,
          opening_qty, opening_weight,
          purchase_in_qty, purchase_in_weight, production_in_qty, production_in_weight,
          sales_return_in_qty, sales_return_in_weight, transfer_in_qty, transfer_in_weight,
          adjustment_in_qty, adjustment_in_weight, other_in_qty, other_in_weight,
          total_in_qty, total_in_weight,
          production_out_qty, production_out_weight, material_used_qty, material_used_weight,
          packing_material_used_qty, packing_material_used_weight, sales_out_qty, sales_out_weight,
          purchase_return_out_qty, purchase_return_out_weight, transfer_out_qty, transfer_out_weight,
          wastage_disposal_qty, wastage_disposal_weight, adjustment_out_qty, adjustment_out_weight,
          other_out_qty, other_out_weight, total_out_qty, total_out_weight,
          system_closing_qty, system_closing_weight,
          physical_count_qty, physical_count_weight, variance_qty, variance_weight, variance_reason,
          approved_adjustment_qty, approved_adjustment_weight, final_closing_qty, final_closing_weight,
          bag_breakdown_json, stock_status, line_status, remarks, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, 'DRAFT', ?, ?)`,
        [
          closingId, cId, fy, targetDate, r.identity_key,
          r.stock_category, r.storage_type, r.item_id || null, r.item_code || '', r.item_name,
          r.supplier_name || '', r.supplier_invoice_no || '', r.lot_no || '', r.rm_lot_no || '', r.fg_lot_no || '', r.parent_lot_no || '',
          r.godown_id || null, r.godown_name || 'Main Godown', r.uom || 'Bags', Number(r.unit_weight || 0),
          r.opening_qty, r.opening_weight,
          r.purchase_in_qty, r.purchase_in_weight, r.production_in_qty, r.production_in_weight,
          r.sales_return_in_qty, r.sales_return_in_weight, r.transfer_in_qty, r.transfer_in_weight,
          r.adjustment_in_qty, r.adjustment_in_weight, r.other_in_qty, r.other_in_weight,
          r.total_in_qty, r.total_in_weight,
          r.production_out_qty, r.production_out_weight, r.material_used_qty, r.material_used_weight,
          r.packing_material_used_qty, r.packing_material_used_weight, r.sales_out_qty, r.sales_out_weight,
          r.purchase_return_out_qty, r.purchase_return_out_weight, r.transfer_out_qty, r.transfer_out_weight,
          r.wastage_disposal_qty, r.wastage_disposal_weight, r.adjustment_out_qty, r.adjustment_out_weight,
          r.other_out_qty, r.other_out_weight, r.total_out_qty, r.total_out_weight,
          sysQty, sysWt,
          physQty, physWt, varQty, varWt, varReason,
          sysQty, sysWt,
          r.bag_breakdown && r.bag_breakdown.length > 0 ? JSON.stringify(r.bag_breakdown) : null,
          r.stock_status || 'Available',
          r.remarks || '', nowIso
        ]
      );
    }

    const totSysQty = round3(insertedLines.reduce((s, l) => s + l.system_closing_qty, 0));
    const totSysWt = round3(insertedLines.reduce((s, l) => s + l.system_closing_weight, 0));
    await tx.run(
      `UPDATE daily_stock_closing
       SET total_system_qty = ?, total_system_weight = ?, total_final_qty = ?, total_final_weight = ?
       WHERE id = ?`,
      [totSysQty, totSysWt, totSysQty, totSysWt, closingId]
    );

    await logAudit(tx, {
      companyId: cId,
      financialYear: fy,
      entityType: 'CLOSING',
      entityId: closingId,
      entityRef: `${fy}/${targetDate}`,
      action: existing ? 'REFRESH_CLOSING_DRAFT' : 'CREATE_CLOSING_DRAFT',
      newValue: { lineCount: insertedLines.length, totalSystemQty: totSysQty, totalSystemWeight: totSysWt },
      performedBy: preparedBy,
      reason: remarks
    });

    return closingId;
  }).then(() => getDailyClosingRegister(cId, { closingDate: targetDate, financialYear: fy }));
}

async function savePhysicalCounts(companyId, closingId, { lines = [], performedBy = 'admin', remarks = '' } = {}) {
  const cId = requireCompanyId(companyId);
  const runner = db.forCompany(cId);
  await ensureStockRegisterSchema(cId, runner);

  return runner.withTransaction(async (tx) => {
    const header = await tx.get(`SELECT * FROM daily_stock_closing WHERE id = ? AND company_id = ? LIMIT 1`, [Number(closingId), cId]);
    if (!header) {
      const err = new Error('Daily closing record not found.');
      err.statusCode = 404;
      throw err;
    }
    if (header.status === 'APPROVED_LOCKED' || Number(header.is_locked) === 1) {
      const err = new Error('Closing register is APPROVED_LOCKED and physical counts cannot be modified.');
      err.statusCode = 409;
      throw err;
    }

    const nowIso = new Date().toISOString();
    const verNo = `PV-${header.closing_date.replace(/-/g, '')}-${header.id}`;
    const verIns = await tx.run(
      `INSERT INTO physical_stock_verification (company_id, financial_year, verification_no, verification_date, closing_id, status, counted_by, remarks)
       VALUES (?, ?, ?, ?, ?, 'SUBMITTED', ?, ?)`,
      [cId, header.financial_year, verNo, header.closing_date, header.id, performedBy, remarks || '']
    );
    const verificationId = verIns.lastInsertRowid;

    for (const item of lines) {
      const lineRow = item.line_id
        ? await tx.get(`SELECT * FROM daily_stock_closing_lines WHERE id = ? AND closing_id = ? LIMIT 1`, [Number(item.line_id), header.id])
        : await tx.get(`SELECT * FROM daily_stock_closing_lines WHERE closing_id = ? AND identity_key = ? LIMIT 1`, [header.id, item.identity_key]);
      if (!lineRow) continue;

      const hasPhysQty = item.physical_count_qty !== null && item.physical_count_qty !== undefined && item.physical_count_qty !== '';
      const physQty = hasPhysQty ? round3(Number(item.physical_count_qty)) : null;
      const physWt = (item.physical_count_weight !== null && item.physical_count_weight !== undefined && item.physical_count_weight !== '')
        ? round3(Number(item.physical_count_weight))
        : (physQty !== null ? round3(physQty * (Number(lineRow.unit_weight) || (lineRow.system_closing_qty > 0 ? lineRow.system_closing_weight / lineRow.system_closing_qty : 0))) : null);

      const varQty = physQty !== null ? round3(physQty - Number(lineRow.system_closing_qty || 0)) : 0;
      const varWt = physWt !== null ? round3(physWt - Number(lineRow.system_closing_weight || 0)) : 0;
      const varReason = String(item.variance_reason || '').trim();

      await tx.run(
        `UPDATE daily_stock_closing_lines
         SET physical_count_qty = ?, physical_count_weight = ?,
             variance_qty = ?, variance_weight = ?, variance_reason = ?,
             updated_at = ?
         WHERE id = ?`,
        [physQty, physWt, varQty, varWt, varReason, nowIso, lineRow.id]
      );

      if (physQty !== null) {
        await tx.run(
          `INSERT INTO physical_stock_verification_items (
            verification_id, closing_line_id, identity_key, stock_category, storage_type,
            item_id, item_code, item_name, lot_no, rm_lot_no, fg_lot_no, parent_lot_no,
            godown_id, godown_name, system_qty, system_weight, physical_qty, physical_weight,
            variance_qty, variance_weight, variance_reason
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            verificationId, lineRow.id, lineRow.identity_key, lineRow.stock_category, lineRow.storage_type,
            lineRow.item_id, lineRow.item_code, lineRow.item_name, lineRow.lot_no, lineRow.rm_lot_no, lineRow.fg_lot_no, lineRow.parent_lot_no,
            lineRow.godown_id, lineRow.godown_name, lineRow.system_closing_qty, lineRow.system_closing_weight,
            physQty, physWt || 0, varQty, varWt, varReason
          ]
        );
      }
    }

    // Recompute header physical & variance aggregates
    const allLines = await tx.all(`SELECT * FROM daily_stock_closing_lines WHERE closing_id = ?`, [header.id]);
    const stats = buildClosingSummary(header, allLines);
    await tx.run(
      `UPDATE daily_stock_closing
       SET total_physical_qty = ?, total_physical_weight = ?,
           total_shortage_qty = ?, total_shortage_weight = ?,
           total_excess_qty = ?, total_excess_weight = ?,
           status = 'DRAFT', updated_at = ?
       WHERE id = ?`,
      [
        stats.totalPhysicalCount.qty, stats.totalPhysicalCount.weight,
        stats.totalShortage.qty, stats.totalShortage.weight,
        stats.totalExcess.qty, stats.totalExcess.weight,
        nowIso, header.id
      ]
    );

    await logAudit(tx, {
      companyId: cId,
      financialYear: header.financial_year,
      entityType: 'PHYSICAL_VERIFICATION',
      entityId: verificationId,
      entityRef: verNo,
      action: 'SAVE_PHYSICAL_COUNTS',
      newValue: stats,
      performedBy,
      reason: remarks
    });

    return header;
  }).then((header) => getDailyClosingRegister(cId, { closingDate: header.closing_date, financialYear: header.financial_year }));
}

async function verifyClosing(companyId, closingId, { verifiedBy = 'supervisor', remarks = '' } = {}) {
  const cId = requireCompanyId(companyId);
  const runner = db.forCompany(cId);
  await ensureStockRegisterSchema(cId, runner);

  const header = await runner.withTransaction(async (tx) => {
    const h = await tx.get(`SELECT * FROM daily_stock_closing WHERE id = ? AND company_id = ? LIMIT 1`, [Number(closingId), cId]);
    if (!h) {
      const err = new Error('Closing register not found.');
      err.statusCode = 404;
      throw err;
    }
    if (h.status === 'APPROVED_LOCKED' || Number(h.is_locked) === 1) {
      const err = new Error('Closing register is already APPROVED_LOCKED.');
      err.statusCode = 409;
      throw err;
    }

    // Check if any line has variance without reason
    const missingReasons = await tx.all(
      `SELECT item_name, lot_no FROM daily_stock_closing_lines
       WHERE closing_id = ? AND (ABS(COALESCE(variance_qty, 0)) > 0.001 OR ABS(COALESCE(variance_weight, 0)) > 0.001)
         AND TRIM(COALESCE(variance_reason, '')) = ''`,
      [h.id]
    );
    if (missingReasons && missingReasons.length > 0) {
      const err = new Error(`Variance reason is required before verification for: ${missingReasons.map(x => x.item_name).slice(0, 3).join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    const nowIso = new Date().toISOString();
    await tx.run(
      `UPDATE daily_stock_closing
       SET status = 'VERIFIED', verified_by = ?, verified_at = ?, variance_summary = COALESCE(?, variance_summary), updated_at = ?
       WHERE id = ?`,
      [verifiedBy, nowIso, remarks || null, nowIso, h.id]
    );
    await tx.run(
      `UPDATE daily_stock_closing_lines SET line_status = 'VERIFIED', updated_at = ? WHERE closing_id = ?`,
      [nowIso, h.id]
    );

    await logAudit(tx, {
      companyId: cId,
      financialYear: h.financial_year,
      entityType: 'CLOSING',
      entityId: h.id,
      entityRef: `${h.financial_year}/${h.closing_date}`,
      action: 'VERIFY_CLOSING',
      oldValue: { status: h.status },
      newValue: { status: 'VERIFIED', verifiedBy },
      performedBy: verifiedBy,
      reason: remarks
    });

    return h;
  });

  return getDailyClosingRegister(cId, { closingDate: header.closing_date, financialYear: header.financial_year });
}

async function approveAndLockClosing(companyId, closingId, { approvedBy = 'admin', remarks = '' } = {}) {
  const cId = requireCompanyId(companyId);
  const runner = db.forCompany(cId);
  await ensureStockRegisterSchema(cId, runner);

  const header = await runner.withTransaction(async (tx) => {
    const h = await tx.get(`SELECT * FROM daily_stock_closing WHERE id = ? AND company_id = ? LIMIT 1`, [Number(closingId), cId]);
    if (!h) {
      const err = new Error('Closing register not found.');
      err.statusCode = 404;
      throw err;
    }
    if (h.status === 'APPROVED_LOCKED' || Number(h.is_locked) === 1) {
      const err = new Error('Closing register is already APPROVED_LOCKED.');
      err.statusCode = 409;
      throw err;
    }
    if (h.status !== 'VERIFIED') {
      const err = new Error(`Closing register must be VERIFIED before Approve & Lock (current status: ${h.status}).`);
      err.statusCode = 400;
      throw err;
    }

    const lines = await tx.all(`SELECT * FROM daily_stock_closing_lines WHERE closing_id = ? ORDER BY id ASC`, [h.id]);
    const nowIso = new Date().toISOString();
    let totAdjQty = 0;
    let totAdjWt = 0;
    let totFinalQty = 0;
    let totFinalWt = 0;

    for (const l of lines) {
      const hasPhys = l.physical_count_qty !== null && l.physical_count_qty !== undefined;
      const adjQty = hasPhys ? round3(l.variance_qty || 0) : 0;
      const adjWt = hasPhys ? round3(l.variance_weight || 0) : 0;
      const finalQty = round3(Number(l.system_closing_qty || 0) + adjQty);
      const finalWt = round3(Number(l.system_closing_weight || 0) + adjWt);

      if (Math.abs(adjQty) > 0.0001 || Math.abs(adjWt) > 0.0001) {
        const isExcess = adjQty > 0 || (adjQty === 0 && adjWt > 0);
        const mvType = isExcess ? 'CLOSING_ADJUSTMENT_IN' : 'CLOSING_ADJUSTMENT_OUT';
        const pk = buildPostingKey({
          companyId: cId,
          sourceModule: 'DAILY_CLOSING',
          sourceId: h.id,
          sourceLineId: l.id,
          direction: isExcess ? 'IN' : 'OUT',
          movementType: mvType
        });

        await postMovement(cId, {
          postingKey: pk,
          financialYear: h.financial_year,
          movementDate: h.closing_date,
          movementTime: h.cutoff_time || '23:59:59',
          itemId: l.item_id,
          itemCode: l.item_code,
          itemName: l.item_name,
          stockCategory: l.stock_category,
          storageType: l.storage_type,
          lotNo: l.lot_no,
          rmLotNo: l.rm_lot_no,
          fgLotNo: l.fg_lot_no,
          parentLotNo: l.parent_lot_no,
          godownId: l.godown_id,
          godownName: l.godown_name,
          supplierName: l.supplier_name,
          supplierInvoiceNo: l.supplier_invoice_no,
          uom: l.uom,
          unitWeight: l.unit_weight,
          direction: isExcess ? 'IN' : 'OUT',
          movementType: mvType,
          qty: Math.abs(adjQty),
          weight: Math.abs(adjWt),
          sourceModule: 'DAILY_CLOSING',
          sourceTable: 'daily_stock_closing_lines',
          sourceId: h.id,
          sourceLineId: l.id,
          sourceRefNo: `CLS-${h.closing_date}`,
          remarks: `Closing Variance (${isExcess ? 'Excess' : 'Shortage'}): ${l.variance_reason || 'Approved physical count adjustment'}`,
          createdBy: approvedBy,
          approvedBy
        }, tx);
      }

      totAdjQty = round3(totAdjQty + adjQty);
      totAdjWt = round3(totAdjWt + adjWt);
      totFinalQty = round3(totFinalQty + finalQty);
      totFinalWt = round3(totFinalWt + finalWt);

      await tx.run(
        `UPDATE daily_stock_closing_lines
         SET approved_adjustment_qty = ?, approved_adjustment_weight = ?,
             final_closing_qty = ?, final_closing_weight = ?,
             line_status = 'APPROVED_LOCKED', updated_at = ?
         WHERE id = ?`,
        [adjQty, adjWt, finalQty, finalWt, nowIso, l.id]
      );
    }

    await tx.run(
      `UPDATE daily_stock_closing
       SET status = 'APPROVED_LOCKED', is_locked = 1,
           total_adjustment_qty = ?, total_adjustment_weight = ?,
           total_final_qty = ?, total_final_weight = ?,
           approved_by = ?, approved_at = ?, remarks = COALESCE(?, remarks), updated_at = ?
       WHERE id = ?`,
      [totAdjQty, totAdjWt, totFinalQty, totFinalWt, approvedBy, nowIso, remarks || null, nowIso, h.id]
    );

    await logAudit(tx, {
      companyId: cId,
      financialYear: h.financial_year,
      entityType: 'CLOSING',
      entityId: h.id,
      entityRef: `${h.financial_year}/${h.closing_date}`,
      action: 'APPROVE_AND_LOCK_CLOSING',
      oldValue: { status: h.status },
      newValue: { status: 'APPROVED_LOCKED', totAdjQty, totFinalQty, totFinalWt, approvedBy },
      performedBy: approvedBy,
      reason: remarks
    });

    return h;
  });

  return getDailyClosingRegister(cId, { closingDate: header.closing_date, financialYear: header.financial_year });
}

/**
 * Shared Row-Level Stock Movement Drill-Down (Date-wise vs Full-Lot-History)
 */
async function getRowMovementDrilldown(companyId, query = {}) {
  const cId = requireCompanyId(companyId);
  const runner = db.forCompany(cId);
  await ensureStockRegisterSchema(cId, runner);
  await ensureBackfilledIfEmpty(cId, runner);

  const viewMode = String(query.viewMode || 'date').toLowerCase() === 'full_lot' ? 'full_lot' : 'date';
  const stockDate = query.stockDate ? normalizeIsoDate(query.stockDate) : null;
  const asOfTime = query.asOfTime ? normalizeTime(query.asOfTime, '23:59:59') : '23:59:59';

  const whereParts = [`company_id = ?`];
  const params = [cId];

  if (viewMode === 'full_lot' && (query.lotNo || query.rmLotNo || query.fgLotNo)) {
    const targetLot = String(query.lotNo || query.fgLotNo || query.rmLotNo).trim();
    whereParts.push(`(LOWER(TRIM(lot_no)) = LOWER(TRIM(?)) OR LOWER(TRIM(rm_lot_no)) = LOWER(TRIM(?)) OR LOWER(TRIM(fg_lot_no)) = LOWER(TRIM(?)) OR LOWER(TRIM(parent_lot_no)) = LOWER(TRIM(?)))`);
    params.push(targetLot, targetLot, targetLot, targetLot);
  } else if (query.identityKey && String(query.identityKey).trim()) {
    whereParts.push(`identity_key = ?`);
    params.push(String(query.identityKey).trim());
  } else {
    if (query.itemName) {
      whereParts.push(`LOWER(TRIM(item_name)) = LOWER(TRIM(?))`);
      params.push(String(query.itemName).trim());
    }
    if (query.lotNo) {
      whereParts.push(`LOWER(TRIM(COALESCE(lot_no, ''))) = LOWER(TRIM(?))`);
      params.push(String(query.lotNo).trim());
    }
    if (query.godownName) {
      whereParts.push(`LOWER(TRIM(COALESCE(godown_name, ''))) = LOWER(TRIM(?))`);
      params.push(String(query.godownName).trim());
    }
  }

  if (query.financialYear && viewMode !== 'full_lot') {
    whereParts.push(`financial_year = ?`);
    params.push(String(query.financialYear).trim());
  }

  if (stockDate && viewMode === 'date') {
    whereParts.push(`movement_timestamp <= ?`);
    params.push(`${stockDate} ${asOfTime}`);
  }

  const movs = await runner.all(
    `SELECT * FROM stock_movements
     WHERE ${whereParts.join(' AND ')}
     ORDER BY movement_timestamp ASC, id ASC`,
    params
  );

  const partyDir = await loadPartyDirectory(cId, runner);
  let runningQty = 0;
  let runningWeight = 0;
  let totalInQty = 0;
  let totalInWeight = 0;
  let totalOutQty = 0;
  let totalOutWeight = 0;
  let headerMeta = null;

  const formattedMovements = (movs || []).map(m => {
    const resolvedParty = resolvePartyFromDirectory(partyDir, {
      supplierName: m.supplier_name || '',
      supplierId: m.supplier_id || null,
      partyName: m.party_name || '',
      sourceModule: m.source_module || ''
    });

    if (!headerMeta) {
      headerMeta = {
        item_name: m.item_name,
        item_code: m.item_code || '',
        stock_category: m.stock_category,
        storage_type: m.storage_type,
        supplier_name: resolvedParty.supplierName || '',
        rm_lot_no: m.rm_lot_no || '',
        fg_lot_no: m.fg_lot_no || '',
        parent_lot_no: m.parent_lot_no || '',
        godown_name: m.godown_name || ''
      };
    } else {
      if (!headerMeta.supplier_name && resolvedParty.supplierName) {
        headerMeta.supplier_name = resolvedParty.supplierName;
      }
      if (!headerMeta.rm_lot_no && m.rm_lot_no) headerMeta.rm_lot_no = m.rm_lot_no;
      if (!headerMeta.fg_lot_no && m.fg_lot_no) headerMeta.fg_lot_no = m.fg_lot_no;
      if (!headerMeta.parent_lot_no && m.parent_lot_no) headerMeta.parent_lot_no = m.parent_lot_no;
    }
    const isRev = Number(m.is_reversed || 0) === 1;
    const isRevEntry = Number(m.is_reversal || 0) === 1;
    const isPhys = Number(m.is_physical_stock ?? 1) === 1;
    const q = round3(m.qty || 0);
    const w = round3(m.weight || 0);

    // Only active non-reversed physical movements advance running balance
    if (!isRev && !isRevEntry && isPhys) {
      if (m.direction === 'IN') {
        runningQty = round3(runningQty + q);
        runningWeight = round3(runningWeight + w);
        totalInQty = round3(totalInQty + q);
        totalInWeight = round3(totalInWeight + w);
      } else {
        runningQty = round3(runningQty - q);
        runningWeight = round3(runningWeight - w);
        totalOutQty = round3(totalOutQty + q);
        totalOutWeight = round3(totalOutWeight + w);
      }
    }

    return {
      id: m.id,
      date: m.movement_date,
      time: m.movement_time,
      timestamp: m.movement_timestamp,
      movement_type: m.movement_type,
      source_ref_no: m.source_ref_no || `${m.source_module}-${m.source_id || m.id}`,
      source_module: m.source_module,
      source_id: m.source_id,
      nav_route: buildNavRoute(m.source_module, m.source_id, m.source_ref_no),
      party_or_godown: resolvedParty.partyName || resolvedParty.supplierName || m.godown_name || '-',
      supplier_name: resolvedParty.supplierName || '',
      godown_name: m.godown_name,
      lot_no: m.lot_no,
      direction: m.direction,
      qty_in: m.direction === 'IN' ? q : 0,
      qty_out: m.direction === 'OUT' ? q : 0,
      weight_in: m.direction === 'IN' ? w : 0,
      weight_out: m.direction === 'OUT' ? w : 0,
      running_balance_qty: runningQty,
      running_balance_weight: runningWeight,
      is_physical_stock: isPhys,
      created_by: m.created_by || 'admin',
      reversal_status: isRev ? 'Reversed' : (isRevEntry ? 'Reversal Entry' : 'Active'),
      remarks: m.remarks || ''
    };
  });

  if (headerMeta && !headerMeta.supplier_name) {
    const lotLookup = headerMeta.parent_lot_no || headerMeta.rm_lot_no || query.parentLotNo || query.rmLotNo || query.lotNo || '';
    if (lotLookup) {
      const gen = await resolveLotGenealogy(cId, { lotNo: lotLookup, itemName: headerMeta.item_name }, runner).catch(() => null);
      if (gen?.supplierName) headerMeta.supplier_name = gen.supplierName;
    }
  }
  if (!headerMeta && query.supplierName) {
    const supRes = resolveSupplierFromDirectory(partyDir, query.supplierName, null);
    query.supplierName = supRes?.name || query.supplierName;
  }

  return {
    viewMode,
    header: headerMeta || {
      item_name: query.itemName || '',
      stock_category: query.stockCategory || '',
      supplier_name: query.supplierName || '',
      rm_lot_no: query.rmLotNo || '',
      fg_lot_no: query.fgLotNo || '',
      parent_lot_no: query.parentLotNo || '',
      godown_name: query.godownName || ''
    },
    totals: {
      totalInQty,
      totalInWeight,
      totalOutQty,
      totalOutWeight,
      currentBalanceQty: runningQty,
      currentBalanceWeight: runningWeight
    },
    movements: formattedMovements
  };
}

/**
 * Generates flat export columns + rows matching exact on-screen totals for Excel/PDF/Print.
 */
async function buildExportData(companyId, { type = 'current', ...filters } = {}) {
  let report;
  if (type === 'opening') {
    report = await getDailyOpeningRegister(companyId, filters);
  } else if (type === 'closing') {
    report = await getDailyClosingRegister(companyId, filters);
  } else {
    report = await getCurrentLiveStockReport(companyId, filters);
  }
  return report;
}

module.exports = {
  getDailyOpeningRegister,
  generateOpeningSnapshot,
  getCurrentLiveStockReport,
  getDailyClosingRegister,
  createOrRefreshClosingDraft,
  savePhysicalCounts,
  verifyClosing,
  approveAndLockClosing,
  getRowMovementDrilldown,
  buildExportData
};
