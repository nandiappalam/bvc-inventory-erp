const express = require('express');
const router = express.Router();
const inventoryIntelligenceService = require('../services/inventoryIntelligenceService');

/**
 * GET /api/inventory-intelligence/summary
 * Retrieves overall Inventory Intelligence summary, physical vs available vs quarantine split, and health metrics
 */
router.get('/summary', async (req, res) => {
  try {
    const companyId = req.companyId || req.headers['x-company-id'] || 1;
    const summary = await inventoryIntelligenceService.getInventorySummary(companyId);
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Inventory intelligence summary API error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch inventory summary' });
  }
});

/**
 * GET /api/inventory-intelligence/stock-health
 * Retrieves detailed stock health status counts and indicators
 */
router.get('/stock-health', async (req, res) => {
  try {
    const companyId = req.companyId || req.headers['x-company-id'] || 1;
    const health = await inventoryIntelligenceService.getStockHealthCategories(companyId);
    res.json({ success: true, data: health });
  } catch (error) {
    console.error('Inventory intelligence stock health API error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch stock health' });
  }
});

/**
 * GET /api/inventory-intelligence/aging
 * Retrieves multi-bucket stock aging (0-30d, 31-60d, 61-90d, 91-180d, 180+d)
 */
router.get('/aging', async (req, res) => {
  try {
    const companyId = req.companyId || req.headers['x-company-id'] || 1;
    const viewType = req.query.view || 'item';
    const aging = await inventoryIntelligenceService.getInventoryAging(companyId, viewType);
    res.json({ success: true, data: aging });
  } catch (error) {
    console.error('Inventory intelligence aging API error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch inventory aging' });
  }
});

/**
 * GET /api/inventory-intelligence/dead-stock
 * Retrieves dead stock items (no movement for X days)
 */
router.get('/dead-stock', async (req, res) => {
  try {
    const companyId = req.companyId || req.headers['x-company-id'] || 1;
    const thresholdDays = parseInt(req.query.days || 120, 10);
    const deadStock = await inventoryIntelligenceService.getDeadStock(companyId, thresholdDays);
    res.json({ success: true, data: deadStock });
  } catch (error) {
    console.error('Inventory intelligence dead stock API error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch dead stock' });
  }
});

/**
 * GET /api/inventory-intelligence/slow-moving
 * Retrieves slow-moving items (no movement between 60 to 120 days)
 */
router.get('/slow-moving', async (req, res) => {
  try {
    const companyId = req.companyId || req.headers['x-company-id'] || 1;
    const slowMoving = await inventoryIntelligenceService.getSlowMovingStock(companyId);
    res.json({ success: true, data: slowMoving });
  } catch (error) {
    console.error('Inventory intelligence slow moving API error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch slow moving stock' });
  }
});

/**
 * GET /api/inventory-intelligence/excess-stock
 * Retrieves excess stock items where available stock exceeds reorder level / max capacity
 */
router.get('/excess-stock', async (req, res) => {
  try {
    const companyId = req.companyId || req.headers['x-company-id'] || 1;
    const excessStock = await inventoryIntelligenceService.getExcessStock(companyId);
    res.json({ success: true, data: excessStock });
  } catch (error) {
    console.error('Inventory intelligence excess stock API error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch excess stock' });
  }
});

/**
 * GET /api/inventory-intelligence/lots/:lotNo
 * Retrieves deep lot-level traceability & QC audit details
 */
router.get('/lots/:lotNo', async (req, res) => {
  try {
    const companyId = req.companyId || req.headers['x-company-id'] || 1;
    const lotNo = req.params.lotNo;
    const lotDetails = await inventoryIntelligenceService.getLotDetails(companyId, lotNo);
    res.json({ success: true, data: lotDetails });
  } catch (error) {
    console.error('Inventory intelligence lot drilldown API error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch lot details' });
  }
});

module.exports = router;
