const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, tenantMiddleware } = require('../middleware/authMiddleware');
const { ensureStockRegisterSchema } = require('../services/StockRegisterSchema');
const { listFinancialYears } = require('../services/FinancialYearResolver');
const { backfillCompanyMovements, getReconciliationReport } = require('../services/BackfillAndReconciliationService');
const StockRegisterService = require('../services/StockRegisterService');

router.use(authenticateToken);
router.use(tenantMiddleware);

// Enforce explicit valid req.companyId with zero fallback to Company 1
function enforceExplicitCompanyId(req, res, next) {
  const cId = parseInt(req.companyId, 10);
  if (!Number.isSafeInteger(cId) || cId <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Valid company context (companyId) is required for Stock Reports.'
    });
  }
  req.verifiedCompanyId = cId;
  next();
}

router.use(enforceExplicitCompanyId);

function isValidIsoDate(val) {
  if (!val) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(val).trim());
}

function isValidTimeStr(val) {
  if (!val) return true;
  return /^\d{1,2}:\d{2}(:\d{2})?$/.test(String(val).trim());
}

function requireApprovalAuthority(req, res, actionLabel = 'approve/lock') {
  const role = String(req.user?.role || '').toLowerCase();
  const allowed = ['admin', 'super_admin', 'superadmin', 'manager', 'supervisor', 'owner'];
  if (!allowed.includes(role)) {
    res.status(403).json({
      success: false,
      message: `Insufficient permissions to ${actionLabel} stock register. Required role: Supervisor, Manager, or Admin.`
    });
    return false;
  }
  return true;
}

// GET /api/stock-reports/filters — active company metadata, FYs, godowns, suppliers, 6 categories
router.get('/filters', async (req, res) => {
  try {
    const cId = req.verifiedCompanyId;
    const runner = db.forCompany(cId);
    await ensureStockRegisterSchema(cId, runner);

    let companyName = `Company ${cId}`;
    try {
      const compRow = await db.master.query(`SELECT name FROM companies WHERE id = ? LIMIT 1`, [cId]);
      if (compRow.rows && compRow.rows[0]?.name) {
        companyName = compRow.rows[0].name;
      }
    } catch (_) {}

    const financialYears = await listFinancialYears(cId, runner);
    let godowns = [];
    try {
      godowns = await runner.all(`SELECT id, godown_name, godown_type, storage_location, is_cold_storage FROM godown_master WHERE COALESCE(status, 'Active') = 'Active' ORDER BY godown_name ASC`);
    } catch (_) {}

    let suppliers = [];
    try {
      suppliers = await runner.all(`SELECT id, name FROM supplier_master WHERE COALESCE(status, 'Active') = 'Active' ORDER BY name ASC`);
    } catch (_) {}

    res.json({
      success: true,
      company: { id: cId, name: companyName },
      financialYears,
      godowns,
      suppliers,
      categories: [
        { id: 'ALL', label: 'All Stock' },
        { id: 'RM', label: 'RM Stock' },
        { id: 'FG', label: 'FG Stock' },
        { id: 'Bag Material', label: 'Bag Material' },
        { id: 'Vacuum Material', label: 'Vacuum Material' },
        { id: 'Wastage', label: 'Wastage Stock' },
        { id: 'Cold Storage', label: 'Cold Storage Stock' }
      ]
    });
  } catch (err) {
    console.error('[stockReports/filters] Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/stock-reports/opening
router.get('/opening', async (req, res) => {
  try {
    const cId = req.verifiedCompanyId;
    const stockDate = req.query.stockDate || req.query.date || new Date().toISOString().slice(0, 10);
    if (!isValidIsoDate(stockDate)) {
      return res.status(400).json({ success: false, message: 'Invalid stockDate format (expected YYYY-MM-DD).' });
    }
    const data = await StockRegisterService.getDailyOpeningRegister(cId, {
      stockDate,
      financialYear: req.query.financialYear || null,
      stockCategory: req.query.stockCategory || 'ALL',
      search: req.query.search || '',
      supplierName: req.query.supplierName || '',
      rmLotNo: req.query.rmLotNo || '',
      fgLotNo: req.query.fgLotNo || '',
      godownId: req.query.godownId || null,
      godownName: req.query.godownName || '',
      stockStatus: req.query.stockStatus || 'ALL'
    });
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('[stockReports/opening] Error:', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

// POST /api/stock-reports/opening/generate
router.post('/opening/generate', async (req, res) => {
  try {
    const cId = req.verifiedCompanyId;
    const { stockDate, financialYear = null, approve = false, remarks = '' } = req.body || {};
    const targetDate = stockDate || new Date().toISOString().slice(0, 10);
    if (!isValidIsoDate(targetDate)) {
      return res.status(400).json({ success: false, message: 'Invalid stockDate format.' });
    }
    if (approve && !requireApprovalAuthority(req, res, 'approve and lock opening stock')) return;

    const preparedBy = req.user?.username || 'admin';
    const data = await StockRegisterService.generateOpeningSnapshot(cId, {
      stockDate: targetDate,
      financialYear,
      approve: Boolean(approve),
      preparedBy,
      remarks
    });
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('[stockReports/opening/generate] Error:', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

// GET /api/stock-reports/current
router.get('/current', async (req, res) => {
  try {
    const cId = req.verifiedCompanyId;
    const stockDate = req.query.stockDate || req.query.date || new Date().toISOString().slice(0, 10);
    const asOfTime = req.query.asOfTime || '23:59:59';
    if (!isValidIsoDate(stockDate) || !isValidTimeStr(asOfTime)) {
      return res.status(400).json({ success: false, message: 'Invalid stockDate or asOfTime format.' });
    }
    const data = await StockRegisterService.getCurrentLiveStockReport(cId, {
      stockDate,
      asOfTime,
      financialYear: req.query.financialYear || null,
      stockCategory: req.query.stockCategory || 'ALL',
      search: req.query.search || '',
      supplierName: req.query.supplierName || '',
      rmLotNo: req.query.rmLotNo || '',
      fgLotNo: req.query.fgLotNo || '',
      parentLotNo: req.query.parentLotNo || '',
      godownId: req.query.godownId || null,
      godownName: req.query.godownName || '',
      stockStatus: req.query.stockStatus || 'ALL'
    });
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('[stockReports/current] Error:', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

// GET /api/stock-reports/closing
router.get('/closing', async (req, res) => {
  try {
    const cId = req.verifiedCompanyId;
    const closingDate = req.query.closingDate || req.query.stockDate || new Date().toISOString().slice(0, 10);
    if (!isValidIsoDate(closingDate)) {
      return res.status(400).json({ success: false, message: 'Invalid closingDate format.' });
    }
    const data = await StockRegisterService.getDailyClosingRegister(cId, {
      closingDate,
      cutoffTime: req.query.cutoffTime || '23:59:59',
      financialYear: req.query.financialYear || null,
      stockCategory: req.query.stockCategory || 'ALL',
      search: req.query.search || '',
      supplierName: req.query.supplierName || '',
      rmLotNo: req.query.rmLotNo || '',
      fgLotNo: req.query.fgLotNo || '',
      godownId: req.query.godownId || null,
      godownName: req.query.godownName || '',
      closingStatus: req.query.closingStatus || 'ALL',
      varianceOnly: String(req.query.varianceOnly || '').toLowerCase() === 'true'
    });
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('[stockReports/closing] Error:', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

// POST /api/stock-reports/closing/draft
router.post('/closing/draft', async (req, res) => {
  try {
    const cId = req.verifiedCompanyId;
    const { closingDate, financialYear = null, cutoffTime = '23:59:59', remarks = '' } = req.body || {};
    const targetDate = closingDate || new Date().toISOString().slice(0, 10);
    if (!isValidIsoDate(targetDate) || !isValidTimeStr(cutoffTime)) {
      return res.status(400).json({ success: false, message: 'Invalid closingDate or cutoffTime format.' });
    }
    const data = await StockRegisterService.createOrRefreshClosingDraft(cId, {
      closingDate: targetDate,
      financialYear,
      cutoffTime,
      preparedBy: req.user?.username || 'admin',
      remarks
    });
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('[stockReports/closing/draft] Error:', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

// POST /api/stock-reports/closing/:id/physical-count
router.post('/closing/:id/physical-count', async (req, res) => {
  try {
    const cId = req.verifiedCompanyId;
    const closingId = parseInt(req.params.id, 10);
    const { lines = [], remarks = '' } = req.body || {};
    if (!Array.isArray(lines)) {
      return res.status(400).json({ success: false, message: 'lines array is required.' });
    }
    const data = await StockRegisterService.savePhysicalCounts(cId, closingId, {
      lines,
      performedBy: req.user?.username || 'admin',
      remarks
    });
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('[stockReports/closing/physical-count] Error:', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

// POST /api/stock-reports/closing/:id/verify
router.post('/closing/:id/verify', async (req, res) => {
  try {
    if (!requireApprovalAuthority(req, res, 'verify closing stock')) return;
    const cId = req.verifiedCompanyId;
    const closingId = parseInt(req.params.id, 10);
    const { remarks = '' } = req.body || {};
    const data = await StockRegisterService.verifyClosing(cId, closingId, {
      verifiedBy: req.user?.username || 'supervisor',
      remarks
    });
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('[stockReports/closing/verify] Error:', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

// POST /api/stock-reports/closing/:id/approve
router.post('/closing/:id/approve', async (req, res) => {
  try {
    if (!requireApprovalAuthority(req, res, 'approve and lock closing stock')) return;
    const cId = req.verifiedCompanyId;
    const closingId = parseInt(req.params.id, 10);
    const { remarks = '' } = req.body || {};
    const data = await StockRegisterService.approveAndLockClosing(cId, closingId, {
      approvedBy: req.user?.username || 'admin',
      remarks
    });
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('[stockReports/closing/approve] Error:', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

// GET /api/stock-reports/movements (row-level drill-down)
router.get('/movements', async (req, res) => {
  try {
    const cId = req.verifiedCompanyId;
    const data = await StockRegisterService.getRowMovementDrilldown(cId, {
      identityKey: req.query.identityKey || '',
      itemName: req.query.itemName || '',
      lotNo: req.query.lotNo || '',
      rmLotNo: req.query.rmLotNo || '',
      fgLotNo: req.query.fgLotNo || '',
      parentLotNo: req.query.parentLotNo || '',
      godownName: req.query.godownName || '',
      stockCategory: req.query.stockCategory || '',
      supplierName: req.query.supplierName || '',
      financialYear: req.query.financialYear || null,
      stockDate: req.query.stockDate || null,
      asOfTime: req.query.asOfTime || '23:59:59',
      viewMode: req.query.viewMode || 'date'
    });
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('[stockReports/movements] Error:', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

// GET /api/stock-reports/reconciliation
router.get('/reconciliation', async (req, res) => {
  try {
    const cId = req.verifiedCompanyId;
    const runner = db.forCompany(cId);
    await ensureStockRegisterSchema(cId, runner);
    const cntRow = await runner.get(`SELECT COUNT(*) as cnt FROM stock_movements WHERE company_id = ?`, [cId]);
    if (parseInt(cntRow?.cnt || cntRow?.count || 0, 10) === 0) {
      await backfillCompanyMovements(cId, runner);
    }
    const data = await getReconciliationReport(cId, {
      financialYear: req.query.financialYear || null,
      varianceOnly: String(req.query.varianceOnly || '').toLowerCase() === 'true',
      search: req.query.search || '',
      godownName: req.query.godownName || ''
    }, runner);
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('[stockReports/reconciliation] Error:', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

// POST /api/stock-reports/reconciliation/sync
router.post('/reconciliation/sync', async (req, res) => {
  try {
    const cId = req.verifiedCompanyId;
    const syncSummary = await backfillCompanyMovements(cId);
    const recon = await getReconciliationReport(cId, { financialYear: req.body?.financialYear || null });
    res.json({ success: true, syncSummary, ...recon });
  } catch (err) {
    console.error('[stockReports/reconciliation/sync] Error:', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

// GET /api/stock-reports/export
router.get('/export', async (req, res) => {
  try {
    const cId = req.verifiedCompanyId;
    const type = String(req.query.type || 'current').toLowerCase();
    const format = String(req.query.format || 'json').toLowerCase();
    const report = await StockRegisterService.buildExportData(cId, {
      type,
      stockDate: req.query.stockDate || req.query.closingDate || new Date().toISOString().slice(0, 10),
      closingDate: req.query.closingDate || req.query.stockDate || new Date().toISOString().slice(0, 10),
      asOfTime: req.query.asOfTime || '23:59:59',
      financialYear: req.query.financialYear || null,
      stockCategory: req.query.stockCategory || 'ALL',
      search: req.query.search || '',
      supplierName: req.query.supplierName || '',
      rmLotNo: req.query.rmLotNo || '',
      fgLotNo: req.query.fgLotNo || '',
      godownId: req.query.godownId || null,
      godownName: req.query.godownName || '',
      stockStatus: req.query.stockStatus || 'ALL',
      varianceOnly: String(req.query.varianceOnly || '').toLowerCase() === 'true'
    });

    if (format === 'csv') {
      const rows = report.rows || [];
      const headers = type === 'opening'
        ? ['S.No', 'Stock Category', 'Item Code', 'Item Name', 'Supplier Name', 'Supplier Invoice No', 'RM Lot No', 'FG Lot No', 'Parent Lot No', 'Godown', 'UOM', 'Prev Closing Qty', 'Prev Closing Weight', 'Opening Adj Qty', 'Opening Adj Weight', 'Opening Qty', 'Opening Weight', 'Stock Status', 'Remarks']
        : type === 'closing'
          ? ['S.No', 'Stock Category', 'Item Code', 'Item Name', 'Supplier', 'RM Lot No', 'FG Lot No', 'Parent Lot No', 'Godown', 'UOM', 'Opening Qty', 'Total In Qty', 'Total Out Qty', 'System Closing Qty', 'System Closing Weight', 'Physical Count Qty', 'Physical Count Weight', 'Variance Qty', 'Variance Weight', 'Variance Reason', 'Approved Adj Qty', 'Final Closing Qty', 'Final Closing Weight', 'Closing Status']
          : ['S.No', 'Stock Category', 'Item Code', 'Item Name', 'Supplier', 'Invoice No', 'RM Lot No', 'FG Lot No', 'Parent Lot No', 'Godown', 'UOM', 'Opening Qty', 'Total Available Qty', 'Total Out Qty', 'Current Balance Qty', 'Current Balance Weight', 'Reserved Qty', 'Available Stock Qty', 'Stock Status'];

      const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csvLines = [headers.map(esc).join(',')];
      for (const r of rows) {
        const vals = type === 'opening'
          ? [r.sno, r.display_category, r.item_code, r.item_name, r.supplier_name, r.supplier_invoice_no, r.rm_lot_no, r.fg_lot_no, r.parent_lot_no, r.godown_name, r.uom, r.prev_closing_qty, r.prev_closing_weight, r.opening_adjustment_qty, r.opening_adjustment_weight, r.opening_qty, r.opening_weight, r.stock_status, r.remarks]
          : type === 'closing'
            ? [r.sno, r.display_category, r.item_code, r.item_name, r.supplier_name, r.rm_lot_no, r.fg_lot_no, r.parent_lot_no, r.godown_name, r.uom, r.opening_qty, r.total_in_qty, r.total_out_qty, r.system_closing_qty, r.system_closing_weight, r.physical_count_qty ?? '', r.physical_count_weight ?? '', r.variance_qty, r.variance_weight, r.variance_reason, r.approved_adjustment_qty, r.final_closing_qty, r.final_closing_weight, r.line_status || r.closing_status]
            : [r.sno, r.display_category, r.item_code, r.item_name, r.supplier_name, r.supplier_invoice_no, r.rm_lot_no, r.fg_lot_no, r.parent_lot_no, r.godown_name, r.uom, r.opening_qty, r.total_available_qty, r.total_out_qty, r.current_balance_qty, r.current_balance_weight, r.reserved_qty, r.available_stock_qty, r.stock_status];
        csvLines.push(vals.map(esc).join(','));
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="stock_${type}_${report.stockDate || report.closingDate}.csv"`);
      return res.send(csvLines.join('\n'));
    }

    res.json({ success: true, ...report });
  } catch (err) {
    console.error('[stockReports/export] Error:', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

module.exports = router;
