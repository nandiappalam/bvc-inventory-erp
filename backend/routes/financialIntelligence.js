const express = require('express');
const router = express.Router();
const service = require('../services/financialIntelligenceService');

// Financial Control Center Metrics
router.get(['/metrics', '/control-center-metrics'], async (req, res) => {
  try {
    const data = await service.getControlCenterMetrics();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Receivable Intelligence & Aging
router.get(['/receivables', '/receivable-aging'], async (req, res) => {
  try {
    const data = await service.getReceivableIntelligence();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Payable Intelligence & Aging
router.get(['/payables', '/payable-aging'], async (req, res) => {
  try {
    const data = await service.getPayableIntelligence();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Cash Flow Forecast
router.get('/cash-flow-forecast', async (req, res) => {
  try {
    const data = await service.getCashFlowForecast();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Payment Due Alerts
router.get('/payment-due-alerts', async (req, res) => {
  try {
    const data = await service.getPaymentDueAlerts();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Financial Drill Down
router.get('/drill-down', async (req, res) => {
  try {
    const { partyName, partyType } = req.query;
    if (!partyName) {
      return res.status(400).json({ success: false, error: 'partyName is required' });
    }
    const data = await service.getDrillDownDetails(partyName, partyType || 'SUPPLIER');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
