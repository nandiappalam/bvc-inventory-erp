const express = require('express');
const router = express.Router();
const jobworkService = require('../services/jobworkControlService');

// GET dashboard statistics
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await jobworkService.getJobworkDashboardStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

// GET contractors
router.get('/contractors', async (req, res, next) => {
  try {
    const contractors = await jobworkService.getContractors(req.query);
    res.json({ success: true, data: contractors });
  } catch (err) {
    next(err);
  }
});

// POST save contractor
router.post('/contractors', async (req, res, next) => {
  try {
    const saved = await jobworkService.saveContractor(req.body);
    res.json({ success: true, data: saved, message: 'Contractor saved successfully' });
  } catch (err) {
    next(err);
  }
});

// GET jobwork orders
router.get('/orders', async (req, res, next) => {
  try {
    const orders = await jobworkService.getJobworkOrders(req.query);
    res.json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
});

// GET single order by id
router.get('/orders/:id', async (req, res, next) => {
  try {
    const order = await jobworkService.getJobworkOrderById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Jobwork order not found' });
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
});

// POST create jobwork order
router.post('/orders', async (req, res, next) => {
  try {
    const order = await jobworkService.createJobworkOrder(req.body);
    res.json({ success: true, data: order, message: 'Jobwork order created successfully' });
  } catch (err) {
    next(err);
  }
});

// POST record jobwork receipt with QC
router.post('/receipts', async (req, res, next) => {
  try {
    const receipt = await jobworkService.recordJobworkReceipt(req.body);
    res.json({ success: true, data: receipt, message: 'Jobwork receipt recorded successfully' });
  } catch (err) {
    next(err);
  }
});

// GET contractor material and financial ledger
router.get('/contractors/:name/ledger', async (req, res, next) => {
  try {
    const ledger = await jobworkService.getContractorLedger(req.params.name);
    res.json({ success: true, data: ledger });
  } catch (err) {
    next(err);
  }
});

// GET contractor performance scorecards
router.get('/scorecards', async (req, res, next) => {
  try {
    const scorecards = await jobworkService.getContractorScorecards();
    res.json({ success: true, data: scorecards });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
