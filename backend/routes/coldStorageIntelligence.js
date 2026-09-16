const express = require('express');
const router = express.Router();
const service = require('../services/coldStorageIntelligenceService');

// Control Center Stats & Overview
router.get('/control-center-stats', async (req, res) => {
  try {
    const stats = await service.getControlCenterStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Facilities, Chambers, Racks
router.get('/facilities-master', async (req, res) => {
  try {
    const master = await service.getFacilitiesMaster();
    res.json({ success: true, data: master });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Inward CSI
router.post('/inward-csi', async (req, res) => {
  try {
    const result = await service.recordInwardCSI(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Outward CSO
router.post('/outward-cso', async (req, res) => {
  try {
    const result = await service.recordOutwardCSO(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Temperature Logs
router.get('/temperature-logs', async (req, res) => {
  try {
    const { chamberId } = req.query;
    const logs = await service.getTemperatureLogs(chamberId ? parseInt(chamberId, 10) : null);
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/temperature-logs', async (req, res) => {
  try {
    const result = await service.recordTemperatureLog(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Chamber Inventory
router.get('/chamber-inventory/:chamberId', async (req, res) => {
  try {
    const lots = await service.getChamberInventory(parseInt(req.params.chamberId, 10));
    res.json({ success: true, data: lots });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
