const express = require('express');
const router = express.Router();
const service = require('../services/barcodeQrService');

function resolveCompanyId(req) {
  const raw = req.companyId || req.headers['x-company-id'] || req.query.company_id || 1;
  const id = parseInt(raw, 10);
  return Number.isSafeInteger(id) && id > 0 ? id : 1;
}

// 360° Universal Code Resolver
router.get('/lookup/:code', async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    const data = await service.lookupCode(req.params.code, companyId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Register / Generate Code
router.post('/register', async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    const result = await service.registerCode(req.body, companyId);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Get all registered codes
router.get('/all', async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    const list = await service.getAllCodes(companyId);
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
