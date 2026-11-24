const express = require('express');
const router = express.Router();
const SalesService = require('../services/SalesService');

const getCompanyId = (req) => req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);

// POST create new sales record from SalesCreate.jsx (delegates to unified SalesService)
router.post('/sale', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const result = await SalesService.createSale(activeCompanyId, req.body, req.user);
    const isOrderFlag = Boolean(Number(req.body?.formData?.is_order) === 1);
    return res.status(201).json({
      ...result,
      message: isOrderFlag ? 'Sales Order saved successfully!' : 'Sales record saved successfully!'
    });
  } catch (err) {
    console.error('Error saving sales entry:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Error saving sales entry'
    });
  }
});

module.exports = router;

