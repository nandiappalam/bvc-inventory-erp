const express = require('express');
const router = express.Router();
const yieldService = require('../services/yieldIntelligenceService');

// GET yield dashboard statistics
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await yieldService.getYieldDashboardStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

// GET list of batches with mass balance and yield metrics
router.get('/batches', async (req, res, next) => {
  try {
    const list = await yieldService.getBatchYieldList(req.query);
    res.json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
});

// GET yield trends
router.get('/trends', async (req, res, next) => {
  try {
    const trends = await yieldService.getYieldTrends();
    res.json({ success: true, data: trends });
  } catch (err) {
    next(err);
  }
});

// GET yield standards
router.get('/standards', async (req, res, next) => {
  try {
    const standards = await yieldService.getYieldStandards();
    res.json({ success: true, data: standards });
  } catch (err) {
    next(err);
  }
});

// POST save yield standard
router.post('/standards', async (req, res, next) => {
  try {
    const saved = await yieldService.saveYieldStandard(req.body);
    res.json({ success: true, data: saved, message: 'Yield standard saved successfully' });
  } catch (err) {
    next(err);
  }
});

// GET production exceptions
router.get('/exceptions', async (req, res, next) => {
  try {
    const exceptions = await yieldService.getProductionExceptions();
    res.json({ success: true, data: exceptions });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
