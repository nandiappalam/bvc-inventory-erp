const express = require('express');
const router = express.Router();
const bomService = require('../services/bomService');

// GET all BOMs
router.get('/', async (req, res, next) => {
  try {
    const list = await bomService.getBOMs(req.query);
    res.json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
});

// GET single BOM with components
router.get('/:id', async (req, res, next) => {
  try {
    const bom = await bomService.getBOMById(req.params.id);
    if (!bom) return res.status(404).json({ success: false, message: 'BOM not found' });
    res.json({ success: true, data: bom });
  } catch (err) {
    next(err);
  }
});

// POST create BOM
router.post('/', async (req, res, next) => {
  try {
    const created = await bomService.createBOM(req.body);
    res.json({ success: true, data: created, message: 'BOM created successfully' });
  } catch (err) {
    next(err);
  }
});

// PUT update BOM
router.put('/:id', async (req, res, next) => {
  try {
    const updated = await bomService.updateBOM(req.params.id, req.body);
    res.json({ success: true, data: updated, message: 'BOM updated successfully' });
  } catch (err) {
    next(err);
  }
});

// POST create new version/revision
router.post('/:id/version', async (req, res, next) => {
  try {
    const newVer = await bomService.createBOMVersion(req.params.id, req.body);
    res.json({ success: true, data: newVer, message: 'New BOM version created successfully' });
  } catch (err) {
    next(err);
  }
});

// GET explode material requirements for quantity
router.get('/calculate/requirements', async (req, res, next) => {
  try {
    const { product, bomId, quantity } = req.query;
    const target = bomId || product;
    if (!target) return res.status(400).json({ success: false, message: 'Product or bomId is required' });
    const result = await bomService.calculateMaterialRequirements(target, parseFloat(quantity) || 100);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// GET compare standard vs actual consumption for a work order
router.get('/compare/work-order/:workOrderId', async (req, res, next) => {
  try {
    const result = await bomService.compareStandardVsActual(req.params.workOrderId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
