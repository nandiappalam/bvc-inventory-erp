const express = require('express');
const router = express.Router();
const service = require('../services/warehouseOpsService');

// Mobile Dashboard Data
router.get(['/dashboard', '/dashboard-data'], async (req, res) => {
  try {
    const data = await service.getDashboardData();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Process Receive
router.post('/receive', async (req, res) => {
  try {
    const result = await service.processReceive(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Process Issue
router.post('/issue', async (req, res) => {
  try {
    const result = await service.processIssue(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Process Transfer
router.post('/transfer', async (req, res) => {
  try {
    const result = await service.processTransfer(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Stock Lookup
router.get('/lookup', async (req, res) => {
  try {
    const { q } = req.query;
    const data = await service.stockLookup(q || '');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Process Dispatch
router.post('/dispatch', async (req, res) => {
  try {
    const result = await service.processDispatch(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
