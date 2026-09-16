const express = require('express');
const router = express.Router();
const lotGenealogyService = require('../services/lotGenealogyService');

// GET search lots
router.get('/search', async (req, res, next) => {
  try {
    const { query } = req.query;
    const results = await lotGenealogyService.searchLots(query, req.query);
    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
});

// GET lot details
router.get('/details/:lotNo', async (req, res, next) => {
  try {
    const { lotNo } = req.params;
    const details = await lotGenealogyService.getLotDetails(lotNo);
    if (!details) {
      return res.status(404).json({ success: false, message: `Lot ${lotNo} not found` });
    }
    res.json({ success: true, data: details });
  } catch (err) {
    next(err);
  }
});

// GET forward trace tree
router.get('/forward/:lotNo', async (req, res, next) => {
  try {
    const { lotNo } = req.params;
    const tree = await lotGenealogyService.buildForwardTrace(lotNo);
    if (!tree) {
      return res.status(404).json({ success: false, message: `Trace tree for lot ${lotNo} not found` });
    }
    res.json({ success: true, data: tree });
  } catch (err) {
    next(err);
  }
});

// GET backward trace tree
router.get('/backward/:lotNo', async (req, res, next) => {
  try {
    const { lotNo } = req.params;
    const tree = await lotGenealogyService.buildBackwardTrace(lotNo);
    if (!tree) {
      return res.status(404).json({ success: false, message: `Backward trace for lot ${lotNo} not found` });
    }
    res.json({ success: true, data: tree });
  } catch (err) {
    next(err);
  }
});

// GET recall report
router.get('/recall/:lotNo', async (req, res, next) => {
  try {
    const { lotNo } = req.params;
    const report = await lotGenealogyService.generateRecallReport(lotNo);
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

// POST lot split
router.post('/split', async (req, res, next) => {
  try {
    const result = await lotGenealogyService.performLotSplit(req.body);
    res.json({ success: true, data: result, message: 'Lot split successfully completed' });
  } catch (err) {
    next(err);
  }
});

// POST lot merge
router.post('/merge', async (req, res, next) => {
  try {
    const result = await lotGenealogyService.performLotMerge(req.body);
    res.json({ success: true, data: result, message: 'Lots merged successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
