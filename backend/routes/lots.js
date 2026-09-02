const express = require('express');
const db = require('../config/database');

const router = express.Router();

// NOTE:
// This project mounts `app.use('/api/lots', lotsRouter)`.
// Your frontend currently uses:
//   - GET /api/stock/available/:itemId   (implemented in routes/stock.js)
//   - GET /api/masters/lots/next          (implemented in routes/masters.js)
//
// This file must export a valid Express router to prevent:
//   Router.use() requires a middleware function but got an Object

// Minimal health endpoint under /api/lots
router.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'lots router ready' });
});

// Helper function to scan ALL potential lot-no columns across ALL tables to get the absolute maximum
async function getAbsoluteMaxLotNo() {
  let maxNum = 0;
  const tables = [
    { name: 'stock_lots', col: 'lot_no' },
    { name: 'purchase_items', col: 'lot_no' },
    { name: 'grain_input_items', col: 'lot_no' },
    { name: 'grain_output_items', col: 'lot_no' },
    { name: 'grain_wastage_items', col: 'lot_no' }
  ];

  for (const t of tables) {
    try {
      const check = await db.query(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [t.name]);
      if (check.rows.length > 0) {
        const res = await db.query(`
          SELECT MAX(CAST(REPLACE(${t.col}, 'LOT', '') AS INTEGER)) AS maxNum
          FROM ${t.name}
          WHERE ${t.col} LIKE 'LOT%'
        `);
        const num = parseInt(res.rows[0]?.maxNum) || 0;
        if (num > maxNum) maxNum = num;
      }
    } catch (e) {
      console.error(`Error querying max lot from ${t.name}:`, e);
    }
  }

  try {
    const seqCheck = await db.query(`SELECT name FROM sqlite_master WHERE type='table' AND name='lot_sequence'`);
    if (seqCheck.rows.length > 0) {
      const res = await db.query(`SELECT last_lot_no FROM lot_sequence WHERE id = 1`);
      const num = parseInt(res.rows[0]?.last_lot_no) || 0;
      if (num > maxNum) maxNum = num;
    }
  } catch (e) {
    console.error(`Error querying max lot from lot_sequence:`, e);
  }

  return maxNum;
}

// Helper function to scan potential wastage lot-no columns across tables to get maximum WST lot number
async function getAbsoluteMaxWastageLotNo() {
  let maxNum = 0;
  const tables = [
    { name: 'grain_wastage_items', col: 'lot_no' },
    { name: 'stock_lots', col: 'lot_no' }
  ];

  for (const t of tables) {
    try {
      const check = await db.query(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [t.name]);
      if (check.rows.length > 0) {
        const res = await db.query(`SELECT ${t.col} FROM ${t.name} WHERE ${t.col} LIKE 'WST%'`);
        for (const row of res.rows) {
          if (row[t.col]) {
            const match = String(row[t.col]).match(/WST(?:-LOT)?(\d+)/i);
            if (match) {
              const num = parseInt(match[1], 10);
              if (num > maxNum) maxNum = num;
            }
          }
        }
      }
    } catch (e) {
      console.error(`Error querying max wastage lot from ${t.name}:`, e);
    }
  }

  return maxNum;
}

// Preview next wastage lot number WITHOUT consuming sequence
router.get('/preview-wastage', async (req, res) => {
  try {
    const absoluteMax = await getAbsoluteMaxWastageLotNo();
    const next = absoluteMax + 1;
    res.json({
      success: true,
      lot_no: `WST${String(next).padStart(4, '0')}`
    });
  } catch (err) {
    console.error('Error previewing next wastage lot number:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// Generate sequential LOT numbers for STOCK CREATION modules.
// SQLite-compatible (no MySQL transactions).
// Response: { success: true, lot_no: "LOT0001" }
// Preview next lot number WITHOUT consuming sequence
router.get('/preview', async (req, res) => {
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS lot_sequence(
        id INTEGER PRIMARY KEY,
        last_lot_no INTEGER NOT NULL
      )
    `).catch(() => {})

    await db.run(`
      INSERT OR IGNORE INTO lot_sequence (id, last_lot_no)
      VALUES (1, 0)
    `).catch(() => {})

    const absoluteMax = await getAbsoluteMaxLotNo();
    const next = absoluteMax + 1;

    // Keep lot_sequence synchronized with the actual max
    await db.run(`
      UPDATE lot_sequence
      SET last_lot_no = ?
      WHERE id = 1 AND last_lot_no < ?
    `, [absoluteMax, absoluteMax]).catch(() => {});

    res.json({
      success: true,
      lot_no: `LOT${String(next).padStart(4, '0')}`
    })
  } catch (err) {
    console.error('Error previewing next lot number:', err)
    res.status(500).json({
      success: false,
      message: err.message
    })
  }
})

// Reserve next lot number (CONSUMES sequence)
router.post('/reserve', async (req, res) => {
  try {
    // Ensure schema matches expected column name.
    await db.run(`
      CREATE TABLE IF NOT EXISTS lot_sequence(
        id INTEGER PRIMARY KEY,
        last_lot_no INTEGER NOT NULL
      )
    `).catch(() => {})

    // If older schema exists, migrate column name.
    await db.run(`
      ALTER TABLE lot_sequence RENAME COLUMN last_no TO last_lot_no
    `).catch(() => {})

    await db.run(`
      INSERT OR IGNORE INTO lot_sequence (id, last_lot_no)
      VALUES (1, 0)
    `).catch(() => {})

    const absoluteMax = await getAbsoluteMaxLotNo();
    const next = absoluteMax + 1;

    await db.run(`
      UPDATE lot_sequence
      SET last_lot_no = ?
      WHERE id = 1
    `, [next])

    res.json({
      success: true,
      lot_no: `LOT${String(next).padStart(4, '0')}`
    })
  } catch (err) {
    console.error('Error reserving next lot number:', err)
    res.status(500).json({
      success: false,
      message: err.message
    })
  }
})

// Backward compatible endpoint (old behavior). Avoid using from UI.
router.get('/next', async (req, res) => {
  console.log('LOT GENERATED', new Date().toISOString())
  try {
    // Ensure schema matches expected column name.
    // Some older DBs may have `last_no` instead of `last_lot_no`.
    await db.run(`
      CREATE TABLE IF NOT EXISTS lot_sequence(
        id INTEGER PRIMARY KEY,
        last_lot_no INTEGER NOT NULL
      )
    `).catch(() => {})

    // If older schema exists, migrate column name.
    await db.run(`
      ALTER TABLE lot_sequence RENAME COLUMN last_no TO last_lot_no
    `).catch(() => {})

    await db.run(`
      INSERT OR IGNORE INTO lot_sequence (id, last_lot_no)
      VALUES (1, 0)
    `).catch(() => {})

    const absoluteMax = await getAbsoluteMaxLotNo();
    const next = absoluteMax + 1;

    // Update sequence
    await db.run(`
      UPDATE lot_sequence
      SET last_lot_no = ?
      WHERE id = 1
    `, [next])

    res.json({
      success: true,
      lot_no: `LOT${String(next).padStart(4, '0')}`
    })
  } catch (err) {
    console.error('Error generating next lot number:', err)
    res.status(500).json({
      success: false,
      message: err.message
    })
  }
})

module.exports = router;


