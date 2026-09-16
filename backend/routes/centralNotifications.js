const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/live', async (req, res) => {
  try {
    // 1. Saved system notifications
    const saved = await db.query('SELECT * FROM system_notifications ORDER BY is_read ASC, id DESC LIMIT 25');
    const alerts = saved.rows || [];

    // 2. Dynamic live alerts
    // Cold storage temp warnings
    const tempAlerts = await db.query(`
      SELECT c.id, c.chamber_name, c.current_temp, c.critical_temp, c.status
      FROM cs_chambers c
      WHERE c.status IN ('WARNING', 'CRITICAL')
    `);
    (tempAlerts.rows || []).forEach(ch => {
      alerts.unshift({
        id: `dyn-temp-${ch.id}`,
        alert_type: 'TEMP_ALERT',
        title: `Cold Storage Temp Alert: ${ch.chamber_name}`,
        message: `Chamber is running at ${ch.current_temp}°C (Critical Limit: ${ch.critical_temp}°C).`,
        severity: ch.status === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        reference_module: 'COLD_STORAGE',
        reference_id: String(ch.id),
        is_read: 0,
        created_at: new Date().toISOString()
      });
    });

    // Aging lots in Cold Storage (> 90 days)
    const agingCutoff = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
    const agingLots = await db.query(`
      SELECT inward_lot_no, item_name, inward_date, chamber_name
      FROM cs_inward_records
      WHERE inward_date <= ?
      LIMIT 5
    `, [agingCutoff]);
    (agingLots.rows || []).forEach(lot => {
      alerts.push({
        id: `dyn-aging-${lot.inward_lot_no}`,
        alert_type: 'AGING_LOT',
        title: `Aging Cold Storage Lot: ${lot.inward_lot_no}`,
        message: `Lot of ${lot.item_name} has been stored since ${lot.inward_date} in ${lot.chamber_name}. Consider rotation.`,
        severity: 'INFO',
        reference_module: 'COLD_STORAGE',
        reference_id: lot.inward_lot_no,
        is_read: 0,
        created_at: new Date().toISOString()
      });
    });

    // Unread count
    const unreadCount = alerts.filter(a => !a.is_read).length;

    res.json({ success: true, count: unreadCount, alerts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/mark-read/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.startsWith('dyn-')) {
      await db.run('UPDATE system_notifications SET is_read = 1 WHERE id = ?', [parseInt(id, 10)]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
