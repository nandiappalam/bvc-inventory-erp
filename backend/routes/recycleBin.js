const express = require('express');
const router = express.Router();
const recycleBinService = require('../services/RecycleBinService');

// Get all deleted items in Recycle Bin
router.get('/', async (req, res) => {
  try {
    const items = await recycleBinService.getRecycleBinItems();
    res.json({ success: true, items });
  } catch (error) {
    console.error('Error fetching recycle bin:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Restore a deleted item
router.post('/restore/:id', async (req, res) => {
  try {
    const result = await recycleBinService.restoreFromRecycleBin(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Error restoring item:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Empty entire recycle bin
router.post('/empty', async (req, res) => {
  try {
    await recycleBinService.emptyRecycleBin();
    res.json({ success: true, message: 'Recycle bin emptied successfully' });
  } catch (error) {
    console.error('Error emptying recycle bin:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete permanently a single item
router.delete('/:id', async (req, res) => {
  try {
    await recycleBinService.deletePermanently(req.params.id);
    res.json({ success: true, message: 'Item permanently deleted' });
  } catch (error) {
    console.error('Error deleting item permanently:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
