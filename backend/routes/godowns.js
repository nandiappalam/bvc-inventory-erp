const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /api/godowns - Fetch list of all godowns
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM godown_master ORDER BY id ASC');
    let list = result.rows || [];
    if (list.length === 0) {
      list = [
        { id: 1, godown_name: 'Main Godown', area: 'Factory Premises', address: 'Factory Premises' },
        { id: 2, godown_name: 'Finished Goods', area: 'Unit 1 Storage', address: 'Unit 1 Storage' },
        { id: 3, godown_name: 'Raw Materials', area: 'RM Warehouse', address: 'RM Warehouse' },
        { id: 4, godown_name: 'Packing Store', area: 'Store Room', address: 'Store Room' }
      ];
    }
    res.json(list);
  } catch (err) {
    console.error('Error fetching godowns:', err);
    res.status(500).json({ message: 'Error fetching godowns', error: err.message });
  }
});

module.exports = router;
