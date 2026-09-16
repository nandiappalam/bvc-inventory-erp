const express = require('express');
const router = express.Router();
const procurementPlanningService = require('../services/procurementPlanningService');

/**
 * GET /api/procurement-planning/summary
 * Retrieves high-level KPI metrics for Procurement Planning
 */
router.get('/summary', async (req, res) => {
  try {
    const companyId = req.companyId || req.headers['x-company-id'] || 1;
    const horizon = req.query.horizon || '30d';
    const summary = await procurementPlanningService.getProcurementPlanningSummary(companyId, horizon);
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Procurement planning summary API error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch procurement planning summary' });
  }
});

/**
 * GET /api/procurement-planning/items
 * Retrieves planning matrix for all items (Supply, Demand, Projected Stock, Shortages)
 */
router.get('/items', async (req, res) => {
  try {
    const companyId = req.companyId || req.headers['x-company-id'] || 1;
    const horizon = req.query.horizon || '30d';
    const search = req.query.search || '';
    const filter = req.query.filter || 'all';

    const items = await procurementPlanningService.getProcurementPlanningItems(companyId, horizon, search, filter);
    res.json({ success: true, count: items.length, data: items });
  } catch (error) {
    console.error('Procurement planning items API error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch procurement planning items' });
  }
});

/**
 * GET /api/procurement-planning/items/:itemName
 * Retrieves single item breakdown with full transaction sources
 */
router.get('/items/:itemName', async (req, res) => {
  try {
    const companyId = req.companyId || req.headers['x-company-id'] || 1;
    const horizon = req.query.horizon || '30d';
    const itemName = req.params.itemName;

    const items = await procurementPlanningService.getProcurementPlanningItems(companyId, horizon, itemName, 'all');
    const matched = items.find(it => it.itemName.toLowerCase() === itemName.toLowerCase()) || items[0];

    if (!matched) {
      return res.status(404).json({ success: false, message: `Item ${itemName} not found in planning matrix` });
    }

    res.json({ success: true, data: matched });
  } catch (error) {
    console.error('Procurement planning single item API error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch item details' });
  }
});

/**
 * GET /api/procurement-planning/suggestions
 * Generates recommended purchase suggestions for management review
 */
router.get('/suggestions', async (req, res) => {
  try {
    const companyId = req.companyId || req.headers['x-company-id'] || 1;
    const horizon = req.query.horizon || '30d';

    const suggestions = await procurementPlanningService.getPurchaseSuggestions(companyId, horizon);
    res.json({ success: true, count: suggestions.length, data: suggestions });
  } catch (error) {
    console.error('Procurement planning suggestions API error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to generate purchase suggestions' });
  }
});

/**
 * POST /api/procurement-planning/create-pr
 * Creates a formal Purchase Request (PR) from selected purchase suggestions
 */
router.post('/create-pr', async (req, res) => {
  try {
    const companyId = req.companyId || req.headers['x-company-id'] || 1;
    const user = req.user || { username: 'Procurement User' };
    const { items, remarks } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide at least one item to create Purchase Request' });
    }

    const result = await procurementPlanningService.createPRFromSuggestions(companyId, user, items, remarks);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Procurement planning create PR API error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create Purchase Request' });
  }
});

module.exports = router;
