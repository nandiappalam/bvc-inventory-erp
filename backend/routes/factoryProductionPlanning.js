const express = require('express');
const router = express.Router();
const service = require('../services/factoryProductionPlanningService');

/**
 * GET /api/factory-production-planning/dashboard-summary
 * Answers: "What should the factory work on now?"
 */
router.get('/dashboard-summary', async (req, res) => {
  try {
    const data = await service.getProductionDashboardSummary();
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/factory-production-planning/queue
 */
router.get('/queue', async (req, res) => {
  try {
    const data = await service.getProductionQueue(req.query);
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/factory-production-planning/queue
 */
router.post('/queue', async (req, res) => {
  try {
    const data = await service.addToQueue(req.body);
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/factory-production-planning/customer-demand & /demand-forecast
 */
router.get(['/customer-demand', '/demand-forecast'], async (req, res) => {
  try {
    const data = await service.getCustomerDemandAndForecast();
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/factory-production-planning/approve-mts & /approve-forecast
 */
router.post(['/approve-mts', '/approve-forecast'], async (req, res) => {
  try {
    const { forecastId, plannerName } = req.body;
    if (!forecastId) {
      return res.status(400).json({ success: false, error: 'forecastId is required' });
    }
    const data = await service.approveForecastRecommendation(forecastId, plannerName);
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/factory-production-planning/material-availability & /material-atp
 */
router.get(['/material-availability', '/material-atp'], async (req, res) => {
  try {
    const data = await service.getMaterialAvailabilityATP(req.query.productName);
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/factory-production-planning/units
 */
router.get('/units', async (req, res) => {
  try {
    const data = await service.getUnitOperations();
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/factory-production-planning/advance-job
 */
router.post('/advance-job', async (req, res) => {
  try {
    const { queueId, action, payload } = req.body;
    if (!queueId || !action) {
      return res.status(400).json({ success: false, error: 'queueId and action are required' });
    }
    const data = await service.advanceJob(queueId, action, payload || {});
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/factory-production-planning/cleaning-orders
 */
router.get('/cleaning-orders', async (req, res) => {
  try {
    const data = await service.getCleaningOrders();
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/factory-production-planning/outputs & /production-outputs
 */
router.get(['/outputs', '/production-outputs'], async (req, res) => {
  try {
    const data = await service.getProductionOutputs();
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/factory-production-planning/traceability & /traceability/:key
 */
router.get(['/traceability', '/traceability/:key'], async (req, res) => {
  try {
    const key = req.params.key || req.query.key || 'PO-2026-0045';
    const data = await service.getTraceabilityGraph(key);
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
