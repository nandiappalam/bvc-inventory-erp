const express = require('express');
const router = express.Router();
const service = require('../services/orderFulfillmentService');

// Dashboard Stats
router.get(['/stats', '/dashboard-stats'], async (req, res) => {
  try {
    const data = await service.getDashboardStats();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// All Orders / Orders Pipeline
router.get(['/orders', '/orders-pipeline'], async (req, res) => {
  try {
    const data = await service.getOrderList();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Exception Alerts
router.get(['/exceptions', '/exception-alerts'], async (req, res) => {
  try {
    const data = await service.getExceptionAlerts ? service.getExceptionAlerts() : [];
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create Order
router.post('/orders', async (req, res) => {
  try {
    const result = await service.createOrder(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Update Status
router.post('/orders/:id/status', async (req, res) => {
  try {
    const { status, remarks, user } = req.body;
    const result = await service.updateStatus(parseInt(req.params.id, 10), status, remarks, user);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Complete Pipeline Stage
router.post('/orders/:id/complete-stage', async (req, res) => {
  try {
    const { stageKey, user, remarks } = req.body;
    const result = await service.completeStage(parseInt(req.params.id, 10), stageKey, user, remarks);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Reserve Stock
router.post('/orders/:id/reserve-stock', async (req, res) => {
  try {
    const { itemName, lotNo, qtyKg, uom } = req.body;
    const result = await service.reserveStock(parseInt(req.params.id, 10), itemName, lotNo, qtyKg, uom);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Release Reservation
router.post('/reservations/:id/release', async (req, res) => {
  try {
    const result = await service.releaseReservation(parseInt(req.params.id, 10));
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
