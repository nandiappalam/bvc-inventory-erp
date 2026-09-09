const express = require('express');
const db = require('../config/database');
const {
  ensureLotSequenceTable,
  getAbsoluteMaxLotNumber,
  previewNextLotNumber,
  reserveNextLotNumber,
  recordLotNumber,
  getAbsoluteMaxWastageLotNumber,
  previewNextWastageLotNumber
} = require('../utils/lotHelper');

const router = express.Router();

function getCompanyIdFromReq(req) {
  const cId = req.companyId || req.headers['x-company-id'] || req.query.company_id || req.body?.company_id;
  return cId ? parseInt(cId, 10) : 1;
}

// Minimal health endpoint under /api/lots
router.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'lots router ready' });
});

// Preview next wastage lot number WITHOUT consuming sequence
router.get('/preview-wastage', async (req, res) => {
  try {
    const cId = getCompanyIdFromReq(req);
    const nextLot = await previewNextWastageLotNumber(cId);
    res.json({
      success: true,
      lot_no: nextLot,
      company_id: cId
    });
  } catch (err) {
    console.error('Error previewing next wastage lot number:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// Preview next lot number WITHOUT consuming sequence
router.get('/preview', async (req, res) => {
  try {
    const cId = getCompanyIdFromReq(req);
    const nextLot = await previewNextLotNumber(cId);
    res.json({
      success: true,
      lot_no: nextLot,
      company_id: cId
    });
  } catch (err) {
    console.error('Error previewing next lot number:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// Reserve next lot number (CONSUMES sequence)
router.post('/reserve', async (req, res) => {
  try {
    const cId = getCompanyIdFromReq(req);
    const nextLot = await reserveNextLotNumber(cId);
    res.json({
      success: true,
      lot_no: nextLot,
      company_id: cId
    });
  } catch (err) {
    console.error('Error reserving next lot number:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// Backward compatible endpoint (old behavior)
router.get('/next', async (req, res) => {
  try {
    const cId = getCompanyIdFromReq(req);
    const nextLot = await reserveNextLotNumber(cId);
    res.json({
      success: true,
      lot_no: nextLot,
      company_id: cId
    });
  } catch (err) {
    console.error('Error generating next lot number:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

module.exports = router;
