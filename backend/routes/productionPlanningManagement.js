const express = require('express');
const router = express.Router();
const ppService = require('../services/productionPlanningManagementService');

// GET all production plans
router.get('/plans', async (req, res, next) => {
  try {
    const list = await ppService.getProductionPlans(req.query);
    res.json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
});

// GET single plan by id
router.get('/plans/:id', async (req, res, next) => {
  try {
    const plan = await ppService.getProductionPlanById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Production plan not found' });
    res.json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
});

// POST create plan
router.post('/plans', async (req, res, next) => {
  try {
    const plan = await ppService.createProductionPlan(req.body);
    res.json({ success: true, data: plan, message: 'Production plan created successfully' });
  } catch (err) {
    next(err);
  }
});

// PUT update plan
router.put('/plans/:id', async (req, res, next) => {
  try {
    const plan = await ppService.updateProductionPlan(req.params.id, req.body);
    res.json({ success: true, data: plan, message: 'Production plan updated successfully' });
  } catch (err) {
    next(err);
  }
});

// GET calculate plan requirements and stock shortage
router.get('/plans/:id/shortages', async (req, res, next) => {
  try {
    const shortages = await ppService.calculatePlanRequirementsAndShortages(req.params.id);
    res.json({ success: true, data: shortages });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
