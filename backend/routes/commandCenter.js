const express = require('express');
const router = express.Router();
const commandCenterService = require('../services/commandCenterService');
const db = require('../config/database');

/**
 * Helper to check permission for a user from database or fallback if admin
 */
async function checkUserSectionPermission(user, sectionKey) {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();
  if (role === 'admin' || role === 'manager' || role === 'owner') {
    return true;
  }

  // Map command center section to module names in user_permissions
  const sectionModuleMap = {
    purchase: ['Purchase', 'Purchase Order', 'Purchase Request'],
    inventory: ['Stock Report', 'Stock Status', 'Godown', 'Item'],
    production: ['Grind', 'Flour Out', 'Papad In', 'Work Order'],
    sales: ['Sales', 'Sales Order', 'Sales Export', 'Quotation'],
    accounts: ['General Ledger', 'Day Book', 'Trial Balance', 'Balance Sheet', 'Profit & Loss', 'Voucher Register'],
    quality: ['Quality Control', 'Quality Dashboard', 'Purchase Lab Entry', 'Incoming Quality'],
    approvals: ['Purchase Request', 'Purchase Order', 'Voucher', 'Quality Control'],
    alerts: ['Stock Report', 'Stock Status', 'Setup']
  };

  const allowedModules = sectionModuleMap[sectionKey] || [];
  if (allowedModules.length === 0) return true;

  try {
    const placeholders = allowedModules.map(() => '?').join(',');
    const permRes = await db.query(`
      SELECT can_view, can_create, can_edit, can_delete 
      FROM user_permissions 
      WHERE user_id = ? AND module_name IN (${placeholders})
    `, [user.id, ...allowedModules]);

    const rows = permRes.rows || [];
    return rows.some(r => r.can_view === 1 || r.can_create === 1 || r.can_edit === 1);
  } catch (err) {
    // In case of query failure, grant view for basic non-financial sections to prevent breakdown
    if (sectionKey === 'accounts') return false;
    return true;
  }
}

/**
 * GET /api/command-center/summary
 * Returns aggregated operational metrics for authorized sections only.
 */
router.get('/summary', async (req, res) => {
  try {
    const companyId = req.companyId || req.user?.company_id || 1;
    const financialYear = req.financialYear || req.query.financial_year || null;
    const user = req.user || { id: 1, role: 'Admin', username: 'admin' };

    // Check authorization per section
    const [
      canViewPurchase,
      canViewInventory,
      canViewProduction,
      canViewSales,
      canViewAccounts,
      canViewQuality,
      canViewApprovals,
      canViewAlerts
    ] = await Promise.all([
      checkUserSectionPermission(user, 'purchase'),
      checkUserSectionPermission(user, 'inventory'),
      checkUserSectionPermission(user, 'production'),
      checkUserSectionPermission(user, 'sales'),
      checkUserSectionPermission(user, 'accounts'),
      checkUserSectionPermission(user, 'quality'),
      checkUserSectionPermission(user, 'approvals'),
      checkUserSectionPermission(user, 'alerts')
    ]);

    // Aggregate with safe error boundary per section
    const result = {};

    if (canViewPurchase) {
      try {
        result.purchase = await commandCenterService.getPurchaseSummary(companyId, financialYear);
      } catch (err) {
        console.error('Error in getPurchaseSummary:', err);
        result.purchase = { pendingPR: 0, pendingPO: 0, pendingQC: 0, todayPurchase: 0, error: true };
      }
    }

    if (canViewInventory) {
      try {
        result.inventory = await commandCenterService.getInventorySummary(companyId, financialYear);
      } catch (err) {
        console.error('Error in getInventorySummary:', err);
        result.inventory = { totalStock: 0, totalStockMT: 0, lowStock: 0, expiringLots: 0, coldStorage: 0, error: true };
      }
    }

    if (canViewProduction) {
      try {
        result.production = await commandCenterService.getProductionSummary(companyId, financialYear);
      } catch (err) {
        console.error('Error in getProductionSummary:', err);
        result.production = { todayProduction: 0, yieldPercent: 0, pendingProduction: 0, error: true };
      }
    }

    if (canViewSales) {
      try {
        result.sales = await commandCenterService.getSalesSummary(companyId, financialYear);
      } catch (err) {
        console.error('Error in getSalesSummary:', err);
        result.sales = { todaySales: 0, pendingOrders: 0, dispatchPending: 0, error: true };
      }
    }

    if (canViewAccounts) {
      try {
        result.accounts = await commandCenterService.getAccountsSummary(companyId, financialYear);
      } catch (err) {
        console.error('Error in getAccountsSummary:', err);
        result.accounts = { receivable: 0, payable: 0, cash: 0, bank: 0, error: true };
      }
    }

    if (canViewQuality) {
      try {
        result.quality = await commandCenterService.getQualitySummary(companyId, financialYear);
      } catch (err) {
        console.error('Error in getQualitySummary:', err);
        result.quality = { qcPending: 0, qcFailed: 0, quarantineStock: 0, quarantineStockMT: 0, error: true };
      }
    }

    if (canViewApprovals) {
      try {
        result.approvals = await commandCenterService.getApprovalSummary(companyId, financialYear);
      } catch (err) {
        console.error('Error in getApprovalSummary:', err);
        result.approvals = { prPending: 0, poPending: 0, paymentPending: 0, qcPending: 0, error: true };
      }
    }

    if (canViewAlerts) {
      try {
        result.alerts = await commandCenterService.getAlertSummary(companyId, financialYear);
      } catch (err) {
        console.error('Error in getAlertSummary:', err);
        result.alerts = { lowStock: 0, expiry: 0, paymentDue: 0, productionDelay: 0, error: true };
      }
    }

    res.json({
      success: true,
      data: result,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Command Center API Top-level error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load Command Center summary',
      error: error.message
    });
  }
});

module.exports = router;
