const express = require('express');
const router = express.Router();
const service = require('../services/partyIntelligenceService');

router.get('/dashboard-summary', async (req, res) => {
  try {
    const data = await service.getDashboardSummary();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get(['/suppliers', '/suppliers-intelligence'], async (req, res) => {
  try {
    const data = await service.getSupplierList();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get(['/supplier-360', '/supplier-360/:name'], async (req, res) => {
  try {
    const name = req.params.name || req.query.name;
    if (!name) return res.status(400).json({ success: false, error: 'Supplier name required' });
    const data = await service.getSupplier360(decodeURIComponent(name));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get(['/customers', '/customers-intelligence'], async (req, res) => {
  try {
    const data = await service.getCustomerList();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get(['/customer-360', '/customer-360/:name'], async (req, res) => {
  try {
    const name = req.params.name || req.query.name;
    if (!name) return res.status(400).json({ success: false, error: 'Customer name required' });
    const data = await service.getCustomer360(decodeURIComponent(name));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

