const express = require('express');
const router = express.Router();
const service = require('../services/partyIntelligenceService');

function resolveCompanyId(req) {
  const raw = req.companyId || req.headers['x-company-id'] || req.query.company_id || 1;
  const id = parseInt(raw, 10);
  return Number.isSafeInteger(id) && id > 0 ? id : 1;
}

router.get('/dashboard-summary', async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    const data = await service.getDashboardSummary(companyId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get(['/suppliers', '/suppliers-intelligence'], async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    const data = await service.getSupplierList(companyId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get(['/supplier-360', '/supplier-360/:name'], async (req, res) => {
  try {
    const name = req.params.name || req.query.name;
    if (!name) return res.status(400).json({ success: false, error: 'Supplier name required' });
    const companyId = resolveCompanyId(req);
    const data = await service.getSupplier360(decodeURIComponent(name), companyId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get(['/customers', '/customers-intelligence'], async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    const data = await service.getCustomerList(companyId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get(['/customer-360', '/customer-360/:name'], async (req, res) => {
  try {
    const name = req.params.name || req.query.name;
    if (!name) return res.status(400).json({ success: false, error: 'Customer name required' });
    const companyId = resolveCompanyId(req);
    const data = await service.getCustomer360(decodeURIComponent(name), companyId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
