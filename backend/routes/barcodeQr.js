const express = require('express');
const router = express.Router();
const service = require('../services/barcodeQrService');

// 360° Universal Code Resolver
router.get('/lookup/:code', async (req, res) => {
  try {
    const data = await service.lookupCode(req.params.code);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Register / Generate Code
router.post('/register', async (req, res) => {
  try {
    const result = await service.registerCode(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Get all registered codes
router.get('/all', async (req, res) => {
  try {
    const list = await service.getAllCodes();
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
