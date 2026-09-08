const express = require('express');
const db = require('../config/database');
const {
  ensureLotSequenceTable,
  getAbsoluteMaxLotNumber,
  previewNextLotNumber,
  reserveNextLotNumber,
  getAbsoluteMaxWastageLotNumber,
  previewNextWastageLotNumber
} = require('../utils/lotHelper');

const router = express.Router();

// Minimal health endpoint under /api/lots
router.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'lots router ready' });
});

// Preview next wastage lot number WITHOUT consuming sequence
router.get('/preview-wastage', async (req, res) => {
  try {
    const nextLot = await previewNextWastageLotNumber();
    res.json({
      success: true,
      lot_no: nextLot
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
    const nextLot = await previewNextLotNumber();
    res.json({
      success: true,
      lot_no: nextLot
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
    const nextLot = await reserveNextLotNumber();
    res.json({
      success: true,
      lot_no: nextLot
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
    const nextLot = await reserveNextLotNumber();
    res.json({
      success: true,
      lot_no: nextLot
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



