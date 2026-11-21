const db = require('../config/database');

function normalizeIsoDate(dateInput) {
  if (!dateInput) return new Date().toISOString().slice(0, 10);
  const s = String(dateInput).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

function deriveIndianFyFromDate(dateStr) {
  const iso = normalizeIsoDate(dateStr);
  const year = parseInt(iso.slice(0, 4), 10);
  const month = parseInt(iso.slice(5, 7), 10);
  const startYear = month >= 4 ? year : year - 1;
  const endYear = startYear + 1;
  return {
    financialYear: `${startYear}-${endYear}`,
    yearName: `${startYear}-${String(endYear).slice(-2)}`,
    startDate: `${startYear}-04-01`,
    endDate: `${endYear}-03-31`,
    isLocked: false
  };
}

function getPreviousDate(dateStr) {
  const iso = normalizeIsoDate(dateStr);
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function resolveFinancialYear(companyId, { date = null, financialYear = null } = {}, conn = null) {
  const cId = parseInt(companyId, 10);
  if (!Number.isSafeInteger(cId) || cId <= 0) {
    throw new Error(`Valid companyId required in FinancialYearResolver (got ${companyId})`);
  }
  const runner = conn || db.forCompany(cId);
  const isoDate = date ? normalizeIsoDate(date) : new Date().toISOString().slice(0, 10);

  try {
    const rows = await runner.all(
      `SELECT id, financial_year, year_name, start_date, end_date, status, is_active, is_current, is_locked
       FROM financial_years
       ORDER BY COALESCE(is_current, 0) DESC, COALESCE(is_active, 0) DESC, id DESC`
    );

    if (financialYear && String(financialYear).trim()) {
      const target = String(financialYear).trim().toLowerCase();
      const matchedFy = (rows || []).find(r =>
        String(r.financial_year || '').toLowerCase() === target ||
        String(r.year_name || '').toLowerCase() === target
      );
      if (matchedFy) {
        return {
          financialYear: matchedFy.financial_year || matchedFy.year_name,
          yearName: matchedFy.year_name || matchedFy.financial_year,
          startDate: normalizeIsoDate(matchedFy.start_date),
          endDate: normalizeIsoDate(matchedFy.end_date),
          isLocked: Number(matchedFy.is_locked || 0) === 1 || String(matchedFy.status || '').toLowerCase() === 'closed',
          isFirstDayOfFy: isoDate === normalizeIsoDate(matchedFy.start_date),
          source: 'financial_years'
        };
      }
    }

    const byDate = (rows || []).find(r => {
      const sd = normalizeIsoDate(r.start_date);
      const ed = normalizeIsoDate(r.end_date);
      return isoDate >= sd && isoDate <= ed;
    });

    if (byDate) {
      return {
        financialYear: byDate.financial_year || byDate.year_name,
        yearName: byDate.year_name || byDate.financial_year,
        startDate: normalizeIsoDate(byDate.start_date),
        endDate: normalizeIsoDate(byDate.end_date),
        isLocked: Number(byDate.is_locked || 0) === 1 || String(byDate.status || '').toLowerCase() === 'closed',
        isFirstDayOfFy: isoDate === normalizeIsoDate(byDate.start_date),
        source: 'financial_years'
      };
    }
  } catch (_) {}

  const derived = deriveIndianFyFromDate(isoDate);
  if (financialYear && String(financialYear).trim()) {
    const fyMatch = String(financialYear).trim().match(/^(\d{4})-(\d{2,4})$/);
    if (fyMatch) {
      const sy = parseInt(fyMatch[1], 10);
      const ey = fyMatch[2].length === 2 ? parseInt(`${String(sy).slice(0, 2)}${fyMatch[2]}`, 10) : parseInt(fyMatch[2], 10);
      return {
        financialYear: `${sy}-${ey}`,
        yearName: `${sy}-${String(ey).slice(-2)}`,
        startDate: `${sy}-04-01`,
        endDate: `${ey}-03-31`,
        isLocked: false,
        isFirstDayOfFy: isoDate === `${sy}-04-01`,
        source: 'requested'
      };
    }
  }

  return {
    ...derived,
    isFirstDayOfFy: isoDate === derived.startDate,
    source: 'derived'
  };
}

async function listFinancialYears(companyId, conn = null) {
  const cId = parseInt(companyId, 10);
  if (!Number.isSafeInteger(cId) || cId <= 0) return [];
  const runner = conn || db.forCompany(cId);
  try {
    const rows = await runner.all(
      `SELECT id, financial_year, year_name, start_date, end_date, status, is_active, is_current, is_locked
       FROM financial_years
       ORDER BY start_date DESC, id DESC`
    );
    if (rows && rows.length > 0) return rows;
  } catch (_) {}
  const def = deriveIndianFyFromDate(new Date().toISOString().slice(0, 10));
  return [{
    id: 0,
    financial_year: def.financialYear,
    year_name: def.yearName,
    start_date: def.startDate,
    end_date: def.endDate,
    status: 'Active',
    is_active: 1,
    is_current: 1,
    is_locked: 0
  }];
}

module.exports = {
  normalizeIsoDate,
  deriveIndianFyFromDate,
  getPreviousDate,
  resolveFinancialYear,
  listFinancialYears
};
