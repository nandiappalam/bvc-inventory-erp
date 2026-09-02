const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Ensure tables exist
async function ensureFeaturesTables() {
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS user_activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_name TEXT NOT NULL,
        activity_type TEXT NOT NULL,
        activity_date TEXT NOT NULL,
        activity_time TEXT NOT NULL,
        remarks TEXT,
        company_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS weight_machine_setup (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER UNIQUE,
        port_no TEXT DEFAULT '0',
        baud_rate TEXT DEFAULT '0',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS general_setup (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER UNIQUE,
        current_date TEXT,
        auto_backup TEXT DEFAULT 'Yes',
        backup_subfolder TEXT DEFAULT 'Yes',
        backup_path TEXT DEFAULT '',
        printer_path TEXT DEFAULT 'CutePDF Writer',
        select_theme TEXT DEFAULT 'Gray',
        credit_debit_instead TEXT DEFAULT 'No',
        manual_voucher_no TEXT DEFAULT 'No',
        use_voucher_print TEXT DEFAULT 'No',
        date_locked_upto TEXT DEFAULT '31-03-2017',
        reset_version_no TEXT DEFAULT 'No',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure table exists without adding hardcoded reference data
    await db.run(`DELETE FROM user_activities WHERE user_name IN ('RANI', 'KALESWARI')`);
  } catch (err) {
    console.error('Error handling features tables:', err.message);
  }
}

ensureFeaturesTables();

// GET User Activities (combines user_activities table, login_history, and module creation records)
router.get('/activities', async (req, res) => {
  try {
    const { startDate, endDate, user } = req.query;
    let rows = [];

    // 1. Explicit user_activities table
    try {
      let query = `SELECT id, activity_date as date, activity_time as time, user_name as user, activity_type as activities, remarks, created_at FROM user_activities WHERE 1=1`;
      const params = [];
      if (user) {
        query += ` AND LOWER(user_name) LIKE LOWER(?)`;
        params.push(`%${user}%`);
      }
      const actRes = await db.query(query, params);
      (actRes.rows || []).forEach(r => {
        rows.push({
          id: `ua-${r.id}`,
          date: r.date,
          time: r.time,
          user: r.user || 'admin',
          activities: r.activities,
          remarks: r.remarks || '',
          created_at: r.created_at
        });
      });
    } catch (e) {
      console.error('Error fetching user_activities table:', e.message);
    }

    // Helper to format date/time
    const parseFormat = (dtVal, fallbackDate) => {
      let dt = dtVal ? new Date(dtVal) : null;
      if (!dt || isNaN(dt.getTime())) {
        if (fallbackDate && fallbackDate.length >= 8) {
          if (fallbackDate.includes('-')) {
            const parts = fallbackDate.split('-');
            if (parts[0].length === 4) dt = new Date(fallbackDate);
            else if (parts[2] && parts[2].length === 4) dt = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
          }
        }
      }
      if (!dt || isNaN(dt.getTime())) dt = new Date();
      const day = String(dt.getDate()).padStart(2, '0');
      const month = String(dt.getMonth() + 1).padStart(2, '0');
      const year = dt.getFullYear();
      const dateStr = `${day}-${month}-${year}`;
      const timeStr = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
      return { dateStr, timeStr, iso: dt.toISOString() };
    };

    // 2. Purchases module creations
    try {
      const purRes = await db.query(`SELECT id, s_no, date, supplier, inv_no, created_at FROM purchases ORDER BY id DESC LIMIT 100`);
      (purRes.rows || []).forEach(p => {
        const { dateStr, timeStr, iso } = parseFormat(p.created_at, p.date);
        rows.push({
          id: `pur-${p.id}`,
          date: dateStr,
          time: timeStr,
          user: 'admin',
          activities: 'Purchase Creation',
          remarks: `S.No: ${p.s_no || ''}, Supplier: ${p.supplier || ''}, Inv No: ${p.inv_no || ''}`,
          created_at: p.created_at || iso
        });
      });
    } catch (e) { /* ignore */ }

    // 3. Sales module creations
    try {
      const salesRes = await db.query(`SELECT id, s_no, date, customer, inv_no, created_at FROM sales ORDER BY id DESC LIMIT 100`);
      (salesRes.rows || []).forEach(s => {
        const { dateStr, timeStr, iso } = parseFormat(s.created_at, s.date);
        rows.push({
          id: `sale-${s.id}`,
          date: dateStr,
          time: timeStr,
          user: 'admin',
          activities: 'Sales Creation',
          remarks: `S.No: ${s.s_no || ''}, Customer: ${s.customer || ''}, Inv No: ${s.inv_no || ''}`,
          created_at: s.created_at || iso
        });
      });
    } catch (e) { /* ignore */ }

    // 4. Open / Opening Creation module
    try {
      const openRes = await db.query(`SELECT id, s_no, date, description, type, papad_comp, created_at FROM open ORDER BY id DESC LIMIT 100`);
      (openRes.rows || []).forEach(o => {
        const { dateStr, timeStr, iso } = parseFormat(o.created_at, o.date);
        rows.push({
          id: `open-${o.id}`,
          date: dateStr,
          time: timeStr,
          user: 'admin',
          activities: 'Opening Creation',
          remarks: `S.No: ${o.s_no || ''}, Type: ${o.type || ''}, Papad Co: ${o.papad_comp || ''}`,
          created_at: o.created_at || iso
        });
      });
    } catch (e) { /* ignore */ }

    // 5. Stock Adjustments module
    try {
      const saRes = await db.query(`SELECT id, s_no, date, type, papad_comp, flour_mill, created_at FROM stock_adjustments ORDER BY id DESC LIMIT 100`);
      (saRes.rows || []).forEach(sa => {
        const { dateStr, timeStr, iso } = parseFormat(sa.created_at, sa.date);
        rows.push({
          id: `sa-${sa.id}`,
          date: dateStr,
          time: timeStr,
          user: 'admin',
          activities: 'Stock Adjustment Creation',
          remarks: `S.No: ${sa.s_no || ''}, Type: ${sa.type || ''}, Papad Co: ${sa.papad_comp || ''}`,
          created_at: sa.created_at || iso
        });
      });
    } catch (e) { /* ignore */ }

    // 6. Papad In module
    try {
      const piRes = await db.query(`SELECT id, s_no, date, papad_company, item_name, created_at FROM papad_in ORDER BY id DESC LIMIT 100`);
      (piRes.rows || []).forEach(pi => {
        const { dateStr, timeStr, iso } = parseFormat(pi.created_at, pi.date);
        rows.push({
          id: `pi-${pi.id}`,
          date: dateStr,
          time: timeStr,
          user: 'admin',
          activities: 'Papad In Entry',
          remarks: `S.No: ${pi.s_no || ''}, Company: ${pi.papad_company || ''}, Item: ${pi.item_name || ''}`,
          created_at: pi.created_at || iso
        });
      });
    } catch (e) { /* ignore */ }

    // 7. Flour Out (Grind) module
    try {
      const foRes = await db.query(`SELECT id, s_no, date, papad_company, created_at FROM flour_out ORDER BY id DESC LIMIT 100`);
      (foRes.rows || []).forEach(fo => {
        const { dateStr, timeStr, iso } = parseFormat(fo.created_at, fo.date);
        rows.push({
          id: `fo-${fo.id}`,
          date: dateStr,
          time: timeStr,
          user: 'admin',
          activities: 'Flour Out (Grind) Entry',
          remarks: `S.No: ${fo.s_no || ''}, Company: ${fo.papad_company || ''}`,
          created_at: fo.created_at || iso
        });
      });
    } catch (e) { /* ignore */ }

    // 8. Advances module
    try {
      const advRes = await db.query(`SELECT id, s_no, date, papad_company, amount, created_at FROM advances ORDER BY id DESC LIMIT 100`);
      (advRes.rows || []).forEach(a => {
        const { dateStr, timeStr, iso } = parseFormat(a.created_at, a.date);
        rows.push({
          id: `adv-${a.id}`,
          date: dateStr,
          time: timeStr,
          user: 'admin',
          activities: 'Advance Payment Entry',
          remarks: `S.No: ${a.s_no || ''}, Company: ${a.papad_company || ''}, Amount: ₹${a.amount || 0}`,
          created_at: a.created_at || iso
        });
      });
    } catch (e) { /* ignore */ }

    // 9. Vouchers module
    try {
      const vRes = await db.query(`SELECT id, voucher_no, voucher_type, date, party_name, created_at FROM voucher ORDER BY id DESC LIMIT 100`);
      (vRes.rows || []).forEach(v => {
        const { dateStr, timeStr, iso } = parseFormat(v.created_at, v.date);
        rows.push({
          id: `v-${v.id}`,
          date: dateStr,
          time: timeStr,
          user: 'admin',
          activities: 'Voucher Entry',
          remarks: `Voucher No: ${v.voucher_no || ''}, Type: ${v.voucher_type || ''}, Party: ${v.party_name || ''}`,
          created_at: v.created_at || iso
        });
      });
    } catch (e) { /* ignore */ }

    // 10. Packing module
    try {
      const pkRes = await db.query(`SELECT id, s_no, date, type, papad_comp, created_at FROM packing ORDER BY id DESC LIMIT 100`);
      (pkRes.rows || []).forEach(pk => {
        const { dateStr, timeStr, iso } = parseFormat(pk.created_at, pk.date);
        rows.push({
          id: `pk-${pk.id}`,
          date: dateStr,
          time: timeStr,
          user: 'admin',
          activities: 'Packing Entry',
          remarks: `S.No: ${pk.s_no || ''}, Type: ${pk.type || ''}, Papad Co: ${pk.papad_comp || ''}`,
          created_at: pk.created_at || iso
        });
      });
    } catch (e) { /* ignore */ }

    // 11. Grains module
    try {
      const gRes = await db.query(`SELECT id, s_no, date, flour_mill, created_at FROM grains ORDER BY id DESC LIMIT 100`);
      (gRes.rows || []).forEach(g => {
        const { dateStr, timeStr, iso } = parseFormat(g.created_at, g.date);
        rows.push({
          id: `g-${g.id}`,
          date: dateStr,
          time: timeStr,
          user: 'admin',
          activities: 'Grains Entry',
          remarks: `S.No: ${g.s_no || ''}, Mill: ${g.flour_mill || ''}`,
          created_at: g.created_at || iso
        });
      });
    } catch (e) { /* ignore */ }

    // 12. Masters (Supplier, Customer, Item, Papad Co, Flour Mill)
    try {
      const masterQueries = [
        { table: 'supplier_master', name: 'Supplier Master Creation' },
        { table: 'customer_master', name: 'Customer Master Creation' },
        { table: 'item_master', name: 'Item Master Creation' },
        { table: 'papad_company_master', name: 'Papad Co. Master Creation' },
        { table: 'flour_mill_master', name: 'Flour Mill Master Creation' }
      ];
      for (const mq of masterQueries) {
        try {
          const mRes = await db.query(`SELECT id, name, created_at FROM ${mq.table} ORDER BY id DESC LIMIT 50`);
          (mRes.rows || []).forEach(m => {
            const { dateStr, timeStr, iso } = parseFormat(m.created_at, null);
            rows.push({
              id: `${mq.table}-${m.id}`,
              date: dateStr,
              time: timeStr,
              user: 'admin',
              activities: mq.name,
              remarks: `Name: ${m.name || ''}`,
              created_at: m.created_at || iso
            });
          });
        } catch (e) { /* ignore */ }
      }
    } catch (e) { /* ignore */ }

    // 13. System Login / Logout entries from login_history
    try {
      const loginRes = await db.query(`
        SELECT lh.id, lh.login_time, lh.logout_time, u.username
        FROM login_history lh
        LEFT JOIN users u ON lh.user_id = u.id
        ORDER BY lh.id DESC LIMIT 50
      `);

      loginRes.rows.forEach(lh => {
        if (lh.username) {
          if (lh.login_time) {
            const { dateStr, timeStr } = parseFormat(lh.login_time, null);
            rows.push({
              id: `lh-in-${lh.id}`,
              date: dateStr,
              time: timeStr,
              user: lh.username,
              activities: 'User Login',
              remarks: 'System Login',
              created_at: lh.login_time
            });
          }
          if (lh.logout_time) {
            const { dateStr, timeStr } = parseFormat(lh.logout_time, null);
            rows.push({
              id: `lh-out-${lh.id}`,
              date: dateStr,
              time: timeStr,
              user: lh.username,
              activities: 'User Logout',
              remarks: 'System Logout',
              created_at: lh.logout_time
            });
          }
        }
      });
    } catch (e) {
      console.error('Error fetching login history for activities:', e.message);
    }

    // Sort all gathered activities by created_at descending (most recent first)
    rows.sort((a, b) => {
      const dtA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dtB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dtB - dtA;
    });

    // Normalize date conversion helper
    const toIsoDate = (str) => {
      if (!str) return '';
      if (str.includes('-')) {
        const parts = str.split('-');
        if (parts[0].length === 4) return str; // YYYY-MM-DD
        if (parts[2] && parts[2].length === 4) {
          return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
      return str;
    };

    // Filter by user if filter query parameter provided
    if (user) {
      const uLower = user.toLowerCase();
      rows = rows.filter(r =>
        (r.user && r.user.toLowerCase().includes(uLower)) ||
        (r.activities && r.activities.toLowerCase().includes(uLower)) ||
        (r.remarks && r.remarks.toLowerCase().includes(uLower))
      );
    }

    // Filter by date range if provided
    if (startDate && endDate) {
      const isoStart = toIsoDate(startDate);
      const isoEnd = toIsoDate(endDate);
      rows = rows.filter(r => {
        const rIso = toIsoDate(r.date);
        return !rIso || (rIso >= isoStart && rIso <= isoEnd);
      });
    }

    res.json(rows);
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ message: 'Error fetching activities', error: error.message });
  }
});

// POST Record User Activity
router.post('/activities', async (req, res) => {
  try {
    const { user_name, activity_type, remarks, company_id } = req.body;
    const now = new Date();
    const activity_date = now.toLocaleDateString('en-GB').replace(/\//g, '-'); // DD-MM-YYYY
    const activity_time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });

    await db.run(
      `INSERT INTO user_activities (user_name, activity_type, activity_date, activity_time, remarks, company_id) VALUES (?, ?, ?, ?, ?, ?)`,
      [user_name || 'ADMIN', activity_type || 'System Action', activity_date, activity_time, remarks || '', company_id || 1]
    );

    res.json({ success: true, message: 'Activity recorded' });
  } catch (error) {
    console.error('Error logging activity:', error);
    res.status(500).json({ message: 'Error logging activity', error: error.message });
  }
});

// GET Weight Machine Setup
router.get('/weight-machine-setup', async (req, res) => {
  try {
    const { company_id } = req.query;
    const companyId = company_id || 1;
    const result = await db.query(`SELECT port_no, baud_rate FROM weight_machine_setup WHERE company_id = ?`, [companyId]);

    if (result.rows.length === 0) {
      return res.json({ port_no: '0', baud_rate: '0' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching weight machine setup:', error);
    res.json({ port_no: '0', baud_rate: '0' });
  }
});

// POST Weight Machine Setup
router.post('/weight-machine-setup', async (req, res) => {
  try {
    const { company_id, port_no, baud_rate } = req.body;
    const companyId = company_id || 1;

    await db.run(`
      INSERT INTO weight_machine_setup (company_id, port_no, baud_rate, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(company_id) DO UPDATE SET
        port_no = excluded.port_no,
        baud_rate = excluded.baud_rate,
        updated_at = CURRENT_TIMESTAMP
    `, [companyId, String(port_no || '0'), String(baud_rate || '0')]);

    res.json({ success: true, message: 'Weight Machine Setup saved successfully' });
  } catch (error) {
    console.error('Error saving weight machine setup:', error);
    res.status(500).json({ message: 'Failed to save Weight Machine Setup', error: error.message });
  }
});

// GET General Setup
router.get('/general-setup', async (req, res) => {
  try {
    const { company_id } = req.query;
    const companyId = company_id || 1;
    const result = await db.query(`SELECT * FROM general_setup WHERE company_id = ?`, [companyId]);

    const defaultDate = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    const defaults = {
      current_date: defaultDate,
      auto_backup: 'Yes',
      backup_subfolder: 'Yes',
      backup_path: '',
      printer_path: 'CutePDF Writer',
      select_theme: 'Gray',
      credit_debit_instead: 'No',
      manual_voucher_no: 'No',
      use_voucher_print: 'No',
      date_locked_upto: '31-03-2017',
      reset_version_no: 'No'
    };

    if (result.rows.length === 0) {
      return res.json(defaults);
    }
    res.json({ ...defaults, ...result.rows[0] });
  } catch (error) {
    console.error('Error fetching general setup:', error);
    res.status(500).json({ message: 'Error fetching general setup', error: error.message });
  }
});

// POST General Setup
router.post('/general-setup', async (req, res) => {
  try {
    const {
      company_id,
      current_date,
      auto_backup,
      backup_subfolder,
      backup_path,
      printer_path,
      select_theme,
      credit_debit_instead,
      manual_voucher_no,
      use_voucher_print,
      date_locked_upto,
      reset_version_no
    } = req.body;

    const companyId = company_id || 1;

    await db.run(`
      INSERT INTO general_setup (
        company_id, current_date, auto_backup, backup_subfolder, backup_path,
        printer_path, select_theme, credit_debit_instead, manual_voucher_no,
        use_voucher_print, date_locked_upto, reset_version_no, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(company_id) DO UPDATE SET
        current_date = excluded.current_date,
        auto_backup = excluded.auto_backup,
        backup_subfolder = excluded.backup_subfolder,
        backup_path = excluded.backup_path,
        printer_path = excluded.printer_path,
        select_theme = excluded.select_theme,
        credit_debit_instead = excluded.credit_debit_instead,
        manual_voucher_no = excluded.manual_voucher_no,
        use_voucher_print = excluded.use_voucher_print,
        date_locked_upto = excluded.date_locked_upto,
        reset_version_no = excluded.reset_version_no,
        updated_at = CURRENT_TIMESTAMP
    `, [
      companyId, current_date || '', auto_backup || 'Yes', backup_subfolder || 'Yes',
      backup_path || '', printer_path || 'CutePDF Writer', select_theme || 'Gray',
      credit_debit_instead || 'No', manual_voucher_no || 'No', use_voucher_print || 'No',
      date_locked_upto || '31-03-2017', reset_version_no || 'No'
    ]);

    res.json({ success: true, message: 'General Setup saved successfully' });
  } catch (error) {
    console.error('Error saving general setup:', error);
    res.status(500).json({ message: 'Failed to save General Setup', error: error.message });
  }
});

// POST User Change Password
router.post('/change-password', async (req, res) => {
  try {
    const { userId, username, oldPassword, newPassword, confirmPassword } = req.body;

    if (!newPassword || newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'New password and repeat password do not match' });
    }

    const bcrypt = require('bcryptjs');
    let user;

    if (userId) {
      const uRes = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
      user = uRes.rows[0];
    } else if (username) {
      const uRes = await db.query('SELECT * FROM users WHERE username = ?', [username]);
      user = uRes.rows[0];
    } else {
      // Default to first user if not passed
      const uRes = await db.query('SELECT * FROM users LIMIT 1');
      user = uRes.rows[0];
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (oldPassword && user.password_hash) {
      let isMatch = false;
      if (user.password_hash.startsWith('$2')) {
        isMatch = await bcrypt.compare(oldPassword, user.password_hash);
      } else {
        isMatch = (oldPassword === user.password_hash);
      }

      if (!isMatch) {
        return res.status(400).json({ message: 'Old password is incorrect' });
      }
    }

    const saltRounds = 10;
    const newHash = await bcrypt.hash(newPassword, saltRounds);

    await db.run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newHash, user.id]);

    res.json({ success: true, message: 'Password changed successfully!' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ message: 'Failed to change password', error: error.message });
  }
});

module.exports = router;
