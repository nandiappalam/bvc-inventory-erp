const express = require('express');
const router = express.Router();
const db = require('../config/database');

// ============================================================================
// DATABASE SCHEMA INITIALIZATION (IDEMPOTENT & THREAD-SAFE)
// ============================================================================
let initPromise = null;

const ensureStockAlertTables = async () => {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // 1. Stock Alert Configurations Table (Item + Godown thresholds)
      await db.run(`
        CREATE TABLE IF NOT EXISTS stock_alert_config (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          item_id INTEGER,
          item_name TEXT NOT NULL,
          godown_id INTEGER,
          godown_name TEXT NOT NULL DEFAULT 'All Godowns',
          minimum_qty REAL DEFAULT 0,
          reorder_level REAL DEFAULT 0,
          critical_level REAL DEFAULT 0,
          alert_enabled INTEGER DEFAULT 1,
          in_app_enabled INTEGER DEFAULT 1,
          email_enabled INTEGER DEFAULT 1,
          sms_enabled INTEGER DEFAULT 0,
          whatsapp_enabled INTEGER DEFAULT 0,
          offline_enabled INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Ensure item_master has the alert threshold columns
      try {
        const imColsRes = await db.query(`PRAGMA table_info(item_master)`);
        const imCols = new Set((imColsRes.rows || []).map(c => c.name));
        if (!imCols.has('minimum_qty')) await db.run(`ALTER TABLE item_master ADD COLUMN minimum_qty REAL DEFAULT 0`);
        if (!imCols.has('reorder_level')) await db.run(`ALTER TABLE item_master ADD COLUMN reorder_level REAL DEFAULT 0`);
        if (!imCols.has('critical_level')) await db.run(`ALTER TABLE item_master ADD COLUMN critical_level REAL DEFAULT 0`);
        if (!imCols.has('alert_enabled')) await db.run(`ALTER TABLE item_master ADD COLUMN alert_enabled INTEGER DEFAULT 1`);
      } catch (e) {
        // item_master might not exist during earliest init step
      }

      // 2. Alert Contacts Master Table
      await db.run(`
        CREATE TABLE IF NOT EXISTS stock_alert_contacts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          contact_name TEXT NOT NULL,
          department TEXT DEFAULT 'Purchase',
          phone TEXT,
          email TEXT,
          active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 3. Mapping: Alert Config <-> Contacts (Multi-contact mapping)
      await db.run(`
        CREATE TABLE IF NOT EXISTS stock_alert_config_contacts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          config_id INTEGER NOT NULL,
          contact_id INTEGER NOT NULL,
          is_primary INTEGER DEFAULT 0,
          is_cc INTEGER DEFAULT 1,
          FOREIGN KEY (config_id) REFERENCES stock_alert_config(id) ON DELETE CASCADE,
          FOREIGN KEY (contact_id) REFERENCES stock_alert_contacts(id) ON DELETE CASCADE
        )
      `);

      // 4. Stock Alerts (Active & Historical alert records)
      await db.run(`
        CREATE TABLE IF NOT EXISTS stock_alerts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          config_id INTEGER,
          item_id INTEGER,
          item_name TEXT NOT NULL,
          godown_id INTEGER,
          godown_name TEXT NOT NULL DEFAULT 'Main Godown',
          alert_type TEXT NOT NULL, -- 'CRITICAL', 'LOW', 'REORDER'
          current_qty REAL DEFAULT 0,
          minimum_qty REAL DEFAULT 0,
          reorder_level REAL DEFAULT 0,
          critical_level REAL DEFAULT 0,
          status TEXT DEFAULT 'OPEN', -- 'OPEN', 'RESOLVED', 'ACKNOWLEDGED'
          triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          resolved_at DATETIME,
          resolved_reason TEXT
        )
      `);

      // 5. Stock Alert Notification Queue (In-App, Email, SMS, WhatsApp, Offline)
      await db.run(`
        CREATE TABLE IF NOT EXISTS stock_alert_notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          alert_id INTEGER,
          contact_id INTEGER,
          contact_name TEXT,
          contact_email TEXT,
          contact_phone TEXT,
          channel TEXT NOT NULL, -- 'IN_APP', 'EMAIL', 'SMS', 'WHATSAPP', 'OFFLINE'
          message TEXT,
          status TEXT DEFAULT 'PENDING', -- 'PENDING', 'SENT', 'FAILED', 'RESOLVED'
          sent_at DATETIME,
          failure_reason TEXT,
          retry_count INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create helpful indexes
      try {
        await db.run(`CREATE INDEX IF NOT EXISTS idx_stock_alert_cfg ON stock_alert_config(item_name, godown_name)`);
        await db.run(`CREATE INDEX IF NOT EXISTS idx_stock_alerts_status ON stock_alerts(status, alert_type)`);
      } catch (idxErr) {}

      // Seed default contacts if empty
      try {
        const contactsCheck = await db.query('SELECT COUNT(*) as count FROM stock_alert_contacts');
        if (!contactsCheck.rows || contactsCheck.rows[0].count === 0) {
          await db.run(`
            INSERT INTO stock_alert_contacts (contact_name, department, phone, email, active)
            VALUES 
              ('Purchase Manager', 'Purchase', '+91 98765 43210', 'purchase@bvcerp.com', 1),
              ('Store Manager', 'Stores & Godown', '+91 98765 43211', 'stores@bvcerp.com', 1),
              ('Production Head', 'Production', '+91 98765 43212', 'production@bvcerp.com', 1),
              ('General Accounts', 'Accounts', '+91 98765 43213', 'accounts@bvcerp.com', 1)
          `);
          console.log('Stock alert default contacts seeded.');
        }
      } catch (cSeedErr) {}

      // Seed initial default configurations for standard items if table is empty
      try {
        const configCheck = await db.query('SELECT COUNT(*) as count FROM stock_alert_config');
        if (!configCheck.rows || configCheck.rows[0].count === 0) {
          const sampleItems = await db.query('SELECT id, item_name, type FROM item_master LIMIT 10');
          if (sampleItems.rows && sampleItems.rows.length > 0) {
            for (const itm of sampleItems.rows) {
              const nameLower = (itm.item_name || '').toLowerCase();
              let minQ = 500, reorderQ = 1000, critQ = 200;
              if (nameLower.includes('flour') || nameLower.includes('atta')) {
                minQ = 300; reorderQ = 700; critQ = 100;
              } else if (nameLower.includes('papad') || nameLower.includes('pack')) {
                minQ = 200; reorderQ = 500; critQ = 50;
              }

              await db.run(`
                INSERT INTO stock_alert_config 
                (item_id, item_name, godown_id, godown_name, minimum_qty, reorder_level, critical_level, alert_enabled, in_app_enabled, email_enabled, offline_enabled)
                VALUES (?, ?, NULL, 'All Godowns', ?, ?, ?, 1, 1, 1, 1)
              `, [itm.id, itm.item_name, minQ, reorderQ, critQ]);
            }
            console.log('Stock alert default item configs seeded.');
          }
        }
      } catch (cfgSeedErr) {}

      console.log('Stock Alert Engine database tables ready.');
    } catch (err) {
      console.error('Error initializing Stock Alert tables:', err);
      initPromise = null; // Reset so retry can happen
      throw err;
    }
  })();

  return initPromise;
};

// Guarantee tables are ready for every router endpoint
router.use(async (req, res, next) => {
  try {
    await ensureStockAlertTables();
    next();
  } catch (err) {
    console.error('Stock Alert Middleware Table Init Error:', err);
    next();
  }
});

// Trigger background initialization
ensureStockAlertTables().catch(() => {});

// ============================================================================
// HELPER: CALCULATE ACCURATE LIVE STOCK (GODOWN-WISE & ITEM-WISE)
// ============================================================================
async function calculateLiveStock() {
  await ensureStockAlertTables();
  const stockMap = new Map();
  const itemTotalMap = new Map();

  function addStockEntry(itemName, godownName, lotNo, qty, rate, unitWeight = 50) {
    if (!itemName) return;
    const normItem = itemName.trim();
    const normGodown = (godownName && godownName.trim()) ? godownName.trim() : 'Main Godown';
    const pairKey = `${normItem.toLowerCase()}:::${normGodown.toLowerCase()}`;
    const itemKey = normItem.toLowerCase();
    const numericQty = parseFloat(qty) || 0;
    const numericRate = parseFloat(rate) || 0;

    // 1. Pair map (Item + Godown)
    if (!stockMap.has(pairKey)) {
      stockMap.set(pairKey, {
        item_name: normItem,
        godown_name: normGodown,
        available_qty: 0,
        rate: numericRate,
        unit_weight: unitWeight,
        lots: []
      });
    }
    const pairEntry = stockMap.get(pairKey);
    pairEntry.available_qty += numericQty;

    if (lotNo && String(lotNo).trim() !== '' && numericQty > 0) {
      const cleanLot = String(lotNo).trim();
      const existingLot = pairEntry.lots.find(l => l.lot_no.toLowerCase() === cleanLot.toLowerCase());
      if (existingLot) {
        existingLot.qty += numericQty;
        if (numericRate > 0) existingLot.rate = numericRate;
      } else {
        pairEntry.lots.push({
          lot_no: cleanLot,
          godown: normGodown,
          qty: numericQty,
          rate: numericRate
        });
      }
    }

    // 2. Global Item total map
    if (!itemTotalMap.has(itemKey)) {
      itemTotalMap.set(itemKey, {
        item_name: normItem,
        available_qty: 0,
        godowns: new Set(),
        lots: []
      });
    }
    const itemEntry = itemTotalMap.get(itemKey);
    itemEntry.available_qty += numericQty;
    itemEntry.godowns.add(normGodown);

    if (lotNo && String(lotNo).trim() !== '' && numericQty > 0) {
      const cleanLot = String(lotNo).trim();
      const existingGlobalLot = itemEntry.lots.find(
        l => l.lot_no.toLowerCase() === cleanLot.toLowerCase() && l.godown.toLowerCase() === normGodown.toLowerCase()
      );
      if (existingGlobalLot) {
        existingGlobalLot.qty += numericQty;
        if (numericRate > 0) existingGlobalLot.rate = numericRate;
      } else {
        itemEntry.lots.push({
          lot_no: cleanLot,
          godown: normGodown,
          qty: numericQty,
          rate: numericRate
        });
      }
    }
  }

  // Query stock ledger aggregated by item_name, godown name, and lot_no
  try {
    const res = await db.query(`
      SELECT 
        TRIM(s.item_name) as item_name,
        COALESCE(NULLIF(TRIM(s.godown), ''), 'Main Godown') as godown_name,
        TRIM(s.lot_no) as lot_no,
        SUM(COALESCE(s.qty, 0)) as available_qty,
        MAX(COALESCE(s.rate, 0)) as rate,
        AVG(COALESCE(s.weight, 50)) as unit_weight
      FROM stock s
      WHERE s.item_name IS NOT NULL AND TRIM(s.item_name) != ''
      GROUP BY TRIM(s.item_name), COALESCE(NULLIF(TRIM(s.godown), ''), 'Main Godown'), TRIM(s.lot_no)
    `);

    if (res.rows && res.rows.length > 0) {
      for (const r of res.rows) {
        addStockEntry(r.item_name, r.godown_name, r.lot_no, r.available_qty, r.rate, r.unit_weight);
      }
    } else {
      // Fallback to stock_lots if stock table is empty
      const lotRes = await db.query(`
        SELECT 
          TRIM(sl.item_name) as item_name,
          COALESCE(NULLIF(TRIM(g.godown_name), ''), 'Main Godown') as godown_name,
          TRIM(sl.lot_no) as lot_no,
          sl.remaining_quantity as available_qty,
          sl.rate
        FROM stock_lots sl
        LEFT JOIN godown_master g ON sl.godown_id = g.id
        WHERE sl.item_name IS NOT NULL AND TRIM(sl.item_name) != ''
      `);
      if (lotRes.rows) {
        for (const r of lotRes.rows) {
          addStockEntry(r.item_name, r.godown_name, r.lot_no, r.available_qty, r.rate);
        }
      }
    }
  } catch (err) {
    console.error('Error in calculateLiveStock:', err);
  }

  return { stockMap, itemTotalMap };
}

// ============================================================================
// CORE STOCK ALERT ENGINE - EVALUATION & DE-DUPLICATION
// ============================================================================
async function runEvaluationCore() {
  const { stockMap, itemTotalMap } = await calculateLiveStock();

  // 1. Fetch all configurations
  const configRes = await db.query(`
    SELECT sac.*, im.id as master_item_id, im.type as item_type, im.unit as item_unit
    FROM stock_alert_config sac
    LEFT JOIN item_master im ON LOWER(TRIM(sac.item_name)) = LOWER(TRIM(im.item_name))
    WHERE sac.alert_enabled = 1
  `);
  const configs = configRes.rows || [];

  // Also check if there are items in item_master with explicit thresholds not yet in stock_alert_config
  try {
    const itemMasterWithLimits = await db.query(`
      SELECT id, item_name, minimum_qty, reorder_level, critical_level, alert_enabled
      FROM item_master 
      WHERE (minimum_qty > 0 OR reorder_level > 0 OR critical_level > 0)
    `);
    if (itemMasterWithLimits.rows) {
      for (const im of itemMasterWithLimits.rows) {
        const exists = configs.some(c => c.item_name.toLowerCase().trim() === im.item_name.toLowerCase().trim());
        if (!exists && im.alert_enabled !== 0 && im.alert_enabled !== '0') {
          configs.push({
            id: null,
            item_id: im.id,
            item_name: im.item_name,
            godown_id: null,
            godown_name: 'All Godowns',
            minimum_qty: parseFloat(im.minimum_qty) || 0,
            reorder_level: parseFloat(im.reorder_level) || 0,
            critical_level: parseFloat(im.critical_level) || 0,
            alert_enabled: 1,
            in_app_enabled: 1,
            email_enabled: 1,
            offline_enabled: 1
          });
        }
      }
    }
  } catch (e) {}

  // 2. Fetch all contacts
  const contactsRes = await db.query('SELECT * FROM stock_alert_contacts WHERE active = 1');
  const allContacts = contactsRes.rows || [];

  // 3. Fetch contacts mapping for configs
  const mappingRes = await db.query(`
    SELECT sac_c.*, c.contact_name, c.email, c.phone, c.department
    FROM stock_alert_config_contacts sac_c
    JOIN stock_alert_contacts c ON sac_c.contact_id = c.id
    WHERE c.active = 1
  `);
  const configContactsMap = new Map();
  if (mappingRes.rows) {
    for (const m of mappingRes.rows) {
      if (!configContactsMap.has(m.config_id)) {
        configContactsMap.set(m.config_id, []);
      }
      configContactsMap.get(m.config_id).push(m);
    }
  }

  // 4. Fetch all active alerts (OPEN and ACKNOWLEDGED) to manage lifecycle & prevent duplicate insertions
  const activeAlertsRes = await db.query(`SELECT * FROM stock_alerts WHERE status IN ('OPEN', 'ACKNOWLEDGED')`);
  const activeAlertsMap = new Map();
  if (activeAlertsRes.rows) {
    for (const a of activeAlertsRes.rows) {
      const key = `${a.item_name.toLowerCase().trim()}:::${(a.godown_name || 'All Godowns').toLowerCase().trim()}`;
      activeAlertsMap.set(key, a);
    }
  }

  const evaluationResults = [];

  // 5. Evaluate each configuration
  for (const cfg of configs) {
    const itemName = cfg.item_name.trim();
    const godownName = (cfg.godown_name && cfg.godown_name.trim()) ? cfg.godown_name.trim() : 'All Godowns';
    const isGlobal = !godownName || godownName === 'All Godowns';

    // Determine current stock
    let currentQty = 0;
    let lots = [];
    let godownsInvolved = [];

    if (isGlobal) {
      const itemData = itemTotalMap.get(itemName.toLowerCase());
      if (itemData) {
        currentQty = itemData.available_qty;
        lots = itemData.lots || [];
        godownsInvolved = Array.from(itemData.godowns || []);
      }
    } else {
      const pairKey = `${itemName.toLowerCase()}:::${godownName.toLowerCase()}`;
      const pairData = stockMap.get(pairKey);
      if (pairData) {
        currentQty = pairData.available_qty;
        lots = pairData.lots || [];
        godownsInvolved = [godownName];
      }
    }

    const minQ = parseFloat(cfg.minimum_qty) || 0;
    const reorderQ = parseFloat(cfg.reorder_level) || 0;
    const critQ = parseFloat(cfg.critical_level) || 0;

    // Determine status & alert type
    let alertType = null;
    let statusLabel = 'NORMAL';

    if (critQ > 0 && currentQty <= critQ) {
      alertType = 'CRITICAL';
      statusLabel = 'CRITICAL';
    } else if (minQ > 0 && currentQty <= minQ) {
      alertType = 'LOW';
      statusLabel = 'LOW';
    } else if (reorderQ > 0 && currentQty <= reorderQ) {
      alertType = 'REORDER';
      statusLabel = 'REORDER';
    } else {
      statusLabel = 'NORMAL';
    }

    const alertKey = `${itemName.toLowerCase()}:::${godownName.toLowerCase()}`;
    const existingActiveAlert = activeAlertsMap.get(alertKey);

    // Get assigned contacts
    let contacts = cfg.id ? (configContactsMap.get(cfg.id) || []) : [];
    if (contacts.length === 0) {
      contacts = allContacts;
    }

    if (alertType) {
      // Alert condition MET: CRITICAL / LOW / REORDER
      if (existingActiveAlert) {
        // If alert is already recorded (OPEN or ACKNOWLEDGED):
        if (existingActiveAlert.alert_type !== alertType) {
          // Severity changed (e.g. from REORDER to LOW or CRITICAL)
          await db.run(`
            UPDATE stock_alerts 
            SET alert_type = ?, current_qty = ?, status = 'OPEN', triggered_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [alertType, currentQty, existingActiveAlert.id]);

          // Create notification for severity transition
          const msg = `⚠️ ${alertType} STOCK ALERT: ${itemName} stock at ${godownName} is now ${currentQty.toFixed(1)} Kg (Critical: ${critQ} Kg, Min: ${minQ} Kg, Reorder: ${reorderQ} Kg).`;
          for (const c of contacts) {
            if (cfg.in_app_enabled) {
              await db.run(`
                INSERT INTO stock_alert_notifications (alert_id, contact_id, contact_name, contact_email, contact_phone, channel, message, status, sent_at)
                VALUES (?, ?, ?, ?, ?, 'IN_APP', ?, 'SENT', CURRENT_TIMESTAMP)
              `, [existingActiveAlert.id, c.contact_id || c.id, c.contact_name, c.email, c.phone, msg]);
            }
            if (cfg.email_enabled && c.email) {
              await db.run(`
                INSERT INTO stock_alert_notifications (alert_id, contact_id, contact_name, contact_email, contact_phone, channel, message, status, sent_at)
                VALUES (?, ?, ?, ?, ?, 'EMAIL', ?, 'SENT', CURRENT_TIMESTAMP)
              `, [existingActiveAlert.id, c.contact_id || c.id, c.contact_name, c.email, c.phone, msg]);
            }
          }
        } else {
          // Keep existing alert record updated with current quantity without creating duplicate rows
          await db.run(`
            UPDATE stock_alerts 
            SET current_qty = ?, minimum_qty = ?, reorder_level = ?, critical_level = ?
            WHERE id = ?
          `, [currentQty, minQ, reorderQ, critQ, existingActiveAlert.id]);
        }
      } else {
        // Create new OPEN alert only when no active alert exists for this item + godown
        const insRes = await db.run(`
          INSERT INTO stock_alerts 
          (config_id, item_id, item_name, godown_id, godown_name, alert_type, current_qty, minimum_qty, reorder_level, critical_level, status, triggered_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', CURRENT_TIMESTAMP)
        `, [cfg.id, cfg.item_id, itemName, cfg.godown_id, godownName, alertType, currentQty, minQ, reorderQ, critQ]);

        const newAlertId = insRes.lastID;

        // Generate notifications across configured channels
        const msg = `⚠️ ${alertType} STOCK ALERT: ${itemName} at ${godownName} has reached ${currentQty.toFixed(1)} Kg (Minimum: ${minQ} Kg, Reorder: ${reorderQ} Kg). Please arrange replenishment.`;
        for (const c of contacts) {
          if (cfg.in_app_enabled) {
            await db.run(`
              INSERT INTO stock_alert_notifications (alert_id, contact_id, contact_name, contact_email, contact_phone, channel, message, status, sent_at)
              VALUES (?, ?, ?, ?, ?, 'IN_APP', ?, 'SENT', CURRENT_TIMESTAMP)
            `, [newAlertId, c.contact_id || c.id, c.contact_name, c.email, c.phone, msg]);
          }
          if (cfg.email_enabled && c.email) {
            await db.run(`
              INSERT INTO stock_alert_notifications (alert_id, contact_id, contact_name, contact_email, contact_phone, channel, message, status, sent_at)
              VALUES (?, ?, ?, ?, ?, 'EMAIL', ?, 'SENT', CURRENT_TIMESTAMP)
            `, [newAlertId, c.contact_id || c.id, c.contact_name, c.email, c.phone, msg]);
          }
          if (cfg.offline_enabled) {
            await db.run(`
              INSERT INTO stock_alert_notifications (alert_id, contact_id, contact_name, contact_email, contact_phone, channel, message, status, sent_at)
              VALUES (?, ?, ?, ?, ?, 'OFFLINE', ?, 'SENT', CURRENT_TIMESTAMP)
            `, [newAlertId, c.contact_id || c.id, c.contact_name, c.email, c.phone, msg]);
          }
        }
      }
    } else {
      // Stock is NORMAL: If an active alert previously existed, auto-resolve it!
      if (existingActiveAlert) {
        await db.run(`
          UPDATE stock_alerts 
          SET status = 'RESOLVED', current_qty = ?, resolved_at = CURRENT_TIMESTAMP, resolved_reason = ?
          WHERE id = ?
        `, [currentQty, `Stock replenished to ${currentQty.toFixed(1)} Kg (above Reorder Level: ${reorderQ} Kg)`, existingActiveAlert.id]);

        // Auto-resolve notifications
        await db.run(`
          UPDATE stock_alert_notifications 
          SET status = 'RESOLVED' 
          WHERE alert_id = ? AND status = 'PENDING'
        `, [existingActiveAlert.id]);
      }
    }

    evaluationResults.push({
      config_id: cfg.id,
      item_name: itemName,
      godown_name: godownName,
      current_qty: currentQty,
      minimum_qty: minQ,
      reorder_level: reorderQ,
      critical_level: critQ,
      status: statusLabel,
      alert_type: alertType,
      lots: lots,
      godowns: godownsInvolved,
      contacts: contacts,
      alert_enabled: cfg.alert_enabled,
      channels: {
        in_app: cfg.in_app_enabled,
        email: cfg.email_enabled,
        sms: cfg.sms_enabled,
        whatsapp: cfg.whatsapp_enabled,
        offline: cfg.offline_enabled
      }
    });
  }

  return evaluationResults;
}

let evalPromise = null;
let cachedEvalResults = null;
let lastEvalTimestamp = 0;
const EVAL_CACHE_TTL = 10000; // 10 seconds cache

async function evaluateStockAlerts(force = false) {
  const now = Date.now();
  if (!force && cachedEvalResults && (now - lastEvalTimestamp < EVAL_CACHE_TTL)) {
    return cachedEvalResults;
  }
  if (evalPromise) {
    return evalPromise;
  }

  evalPromise = (async () => {
    try {
      await ensureStockAlertTables();
      const results = await runEvaluationCore();
      cachedEvalResults = results;
      lastEvalTimestamp = Date.now();
      return results;
    } catch (err) {
      console.error('Error during evaluateStockAlerts:', err.message);
      if (cachedEvalResults) return cachedEvalResults;
      return [];
    } finally {
      evalPromise = null;
    }
  })();

  return evalPromise;
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

// 1. GET /api/stock-alerts/dashboard - Full Dashboard Metrics & Items
router.get('/dashboard', async (req, res) => {
  try {
    const items = await evaluateStockAlerts(true);

    // Summaries
    const totalConfigured = items.length;
    const criticalCount = items.filter(i => i.status === 'CRITICAL').length;
    const lowStockCount = items.filter(i => i.status === 'LOW').length;
    const reorderCount = items.filter(i => i.status === 'REORDER').length;
    const normalCount = items.filter(i => i.status === 'NORMAL').length;

    // Recent triggered and resolved alerts history
    const historyRes = await db.query(`
      SELECT sa.*, sac.minimum_qty as cfg_min, sac.reorder_level as cfg_reorder
      FROM stock_alerts sa
      LEFT JOIN stock_alert_config sac ON sa.config_id = sac.id
      ORDER BY sa.triggered_at DESC
      LIMIT 50
    `);

    // Notification summary
    const notifRes = await db.query(`
      SELECT san.*, sa.item_name, sa.godown_name, sa.alert_type
      FROM stock_alert_notifications san
      JOIN stock_alerts sa ON san.alert_id = sa.id
      ORDER BY san.created_at DESC
      LIMIT 30
    `);

    res.json({
      success: true,
      summary: {
        totalConfigured,
        criticalCount,
        lowStockCount,
        reorderCount,
        normalCount,
        totalAlerts: criticalCount + lowStockCount + reorderCount
      },
      items,
      history: historyRes.rows || [],
      notifications: notifRes.rows || []
    });
  } catch (err) {
    console.error('Error fetching stock alert dashboard:', err);
    res.status(500).json({ success: false, message: 'Failed to evaluate stock alerts', error: err.message });
  }
});

// 2. GET /api/stock-alerts/active-count - Header Notification Bell (Fast & Lightweight)
router.get('/active-count', async (req, res) => {
  try {
    const items = await evaluateStockAlerts();
    const activeAlerts = (items || []).filter(i => i && i.status !== 'NORMAL');
    const criticalCount = activeAlerts.filter(i => i.status === 'CRITICAL').length;
    const lowCount = activeAlerts.filter(i => i.status === 'LOW').length;
    const reorderCount = activeAlerts.filter(i => i.status === 'REORDER').length;

    res.json({
      success: true,
      count: activeAlerts.length,
      criticalCount,
      lowCount,
      reorderCount,
      alerts: activeAlerts.slice(0, 10)
    });
  } catch (err) {
    console.error('Error fetching active stock alerts count:', err.message);
    res.json({
      success: true,
      count: 0,
      criticalCount: 0,
      lowCount: 0,
      reorderCount: 0,
      alerts: []
    });
  }
});

// 3. POST /api/stock-alerts/evaluate - Trigger manual re-evaluation
router.post('/evaluate', async (req, res) => {
  try {
    const items = await evaluateStockAlerts(true);
    res.json({ success: true, message: 'Stock alert evaluation completed successfully', itemsCount: items.length });
  } catch (err) {
    console.error('Error evaluating stock alerts:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. GET /api/stock-alerts/config - List all configurations
router.get('/config', async (req, res) => {
  try {
    const query = `
      SELECT sac.*, 
        GROUP_CONCAT(c.contact_name, ', ') as assigned_contacts,
        GROUP_CONCAT(c.id, ',') as contact_ids
      FROM stock_alert_config sac
      LEFT JOIN stock_alert_config_contacts sac_c ON sac.id = sac_c.config_id
      LEFT JOIN stock_alert_contacts c ON sac_c.contact_id = c.id
      GROUP BY sac.id
      ORDER BY sac.item_name ASC, sac.godown_name ASC
    `;
    const result = await db.query(query);
    res.json({ success: true, configs: result.rows || [] });
  } catch (err) {
    console.error('Error fetching stock alert configs:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. POST /api/stock-alerts/config - Create or upsert configuration
router.post('/config', async (req, res) => {
  try {
    const {
      item_id,
      item_name,
      godown_id,
      godown_name = 'All Godowns',
      minimum_qty = 0,
      reorder_level = 0,
      critical_level = 0,
      alert_enabled = 1,
      in_app_enabled = 1,
      email_enabled = 1,
      sms_enabled = 0,
      whatsapp_enabled = 0,
      offline_enabled = 1,
      contact_ids = []
    } = req.body;

    if (!item_name) {
      return res.status(400).json({ success: false, message: 'Item name is required' });
    }

    // Check if configuration already exists for this item + godown
    const existing = await db.query(
      'SELECT id FROM stock_alert_config WHERE LOWER(item_name) = LOWER(?) AND LOWER(godown_name) = LOWER(?)',
      [item_name, godown_name]
    );

    let configId;
    if (existing.rows && existing.rows.length > 0) {
      configId = existing.rows[0].id;
      await db.run(`
        UPDATE stock_alert_config
        SET item_id = ?, minimum_qty = ?, reorder_level = ?, critical_level = ?,
            alert_enabled = ?, in_app_enabled = ?, email_enabled = ?, sms_enabled = ?,
            whatsapp_enabled = ?, offline_enabled = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [item_id, minimum_qty, reorder_level, critical_level, alert_enabled, in_app_enabled, email_enabled, sms_enabled, whatsapp_enabled, offline_enabled, configId]);
    } else {
      const ins = await db.run(`
        INSERT INTO stock_alert_config
        (item_id, item_name, godown_id, godown_name, minimum_qty, reorder_level, critical_level, alert_enabled, in_app_enabled, email_enabled, sms_enabled, whatsapp_enabled, offline_enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [item_id, item_name, godown_id, godown_name, minimum_qty, reorder_level, critical_level, alert_enabled, in_app_enabled, email_enabled, sms_enabled, whatsapp_enabled, offline_enabled]);
      configId = ins.lastID;
    }

    // Update contacts mapping
    await db.run('DELETE FROM stock_alert_config_contacts WHERE config_id = ?', [configId]);
    if (Array.isArray(contact_ids) && contact_ids.length > 0) {
      for (let i = 0; i < contact_ids.length; i++) {
        const cId = contact_ids[i];
        await db.run(`
          INSERT INTO stock_alert_config_contacts (config_id, contact_id, is_primary, is_cc)
          VALUES (?, ?, ?, ?)
        `, [configId, cId, i === 0 ? 1 : 0, i > 0 ? 1 : 0]);
      }
    }

    // Re-evaluate immediately
    await evaluateStockAlerts();

    res.json({ success: true, message: 'Stock alert configuration saved successfully', configId });
  } catch (err) {
    console.error('Error saving stock alert config:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. PUT /api/stock-alerts/config/:id - Update configuration
router.put('/config/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      minimum_qty,
      reorder_level,
      critical_level,
      alert_enabled,
      in_app_enabled,
      email_enabled,
      sms_enabled,
      whatsapp_enabled,
      offline_enabled,
      contact_ids
    } = req.body;

    await db.run(`
      UPDATE stock_alert_config
      SET minimum_qty = ?, reorder_level = ?, critical_level = ?,
          alert_enabled = ?, in_app_enabled = ?, email_enabled = ?, sms_enabled = ?,
          whatsapp_enabled = ?, offline_enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [minimum_qty, reorder_level, critical_level, alert_enabled, in_app_enabled, email_enabled, sms_enabled, whatsapp_enabled, offline_enabled, id]);

    if (Array.isArray(contact_ids)) {
      await db.run('DELETE FROM stock_alert_config_contacts WHERE config_id = ?', [id]);
      for (let i = 0; i < contact_ids.length; i++) {
        await db.run(`
          INSERT INTO stock_alert_config_contacts (config_id, contact_id, is_primary, is_cc)
          VALUES (?, ?, ?, ?)
        `, [id, contact_ids[i], i === 0 ? 1 : 0, i > 0 ? 1 : 0]);
      }
    }

    // Re-evaluate immediately
    await evaluateStockAlerts();

    res.json({ success: true, message: 'Stock alert configuration updated successfully' });
  } catch (err) {
    console.error('Error updating stock alert config:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. DELETE /api/stock-alerts/config/:id - Delete configuration
router.delete('/config/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM stock_alert_config_contacts WHERE config_id = ?', [id]);
    await db.run('DELETE FROM stock_alert_config WHERE id = ?', [id]);
    await evaluateStockAlerts();
    res.json({ success: true, message: 'Configuration deleted successfully' });
  } catch (err) {
    console.error('Error deleting stock alert config:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. GET /api/stock-alerts/contacts - Get all contacts
router.get('/contacts', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM stock_alert_contacts ORDER BY id ASC');
    res.json({ success: true, contacts: result.rows || [] });
  } catch (err) {
    console.error('Error fetching contacts:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. POST /api/stock-alerts/contacts - Create contact
router.post('/contacts', async (req, res) => {
  try {
    const { contact_name, department = 'Purchase', phone, email, active = 1 } = req.body;
    if (!contact_name) {
      return res.status(400).json({ success: false, message: 'Contact name is required' });
    }
    const ins = await db.run(`
      INSERT INTO stock_alert_contacts (contact_name, department, phone, email, active)
      VALUES (?, ?, ?, ?, ?)
    `, [contact_name, department, phone, email, active]);

    res.json({ success: true, message: 'Contact created successfully', contactId: ins.lastID });
  } catch (err) {
    console.error('Error creating contact:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. PUT /api/stock-alerts/contacts/:id - Update contact
router.put('/contacts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { contact_name, department, phone, email, active } = req.body;
    await db.run(`
      UPDATE stock_alert_contacts
      SET contact_name = ?, department = ?, phone = ?, email = ?, active = ?
      WHERE id = ?
    `, [contact_name, department, phone, email, active, id]);

    res.json({ success: true, message: 'Contact updated successfully' });
  } catch (err) {
    console.error('Error updating contact:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11. DELETE /api/stock-alerts/contacts/:id - Delete contact
router.delete('/contacts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM stock_alert_config_contacts WHERE contact_id = ?', [id]);
    await db.run('DELETE FROM stock_alert_contacts WHERE id = ?', [id]);
    res.json({ success: true, message: 'Contact deleted successfully' });
  } catch (err) {
    console.error('Error deleting contact:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 12. POST /api/stock-alerts/resolve/:id - Manually resolve / acknowledge alert
router.post('/resolve/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const todayStr = new Date().toLocaleDateString('en-IN');
    const { reason = `Manually verified and marked as reviewed on ${todayStr}` } = req.body;
    await db.run(`
      UPDATE stock_alerts
      SET status = 'ACKNOWLEDGED', resolved_at = CURRENT_TIMESTAMP, resolved_reason = ?
      WHERE id = ?
    `, [reason, id]);

    res.json({ success: true, message: 'Alert marked as reviewed successfully' });
  } catch (err) {
    console.error('Error resolving alert:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 13. POST /api/stock-alerts/sync-offline - Sync offline pending notifications
router.post('/sync-offline', async (req, res) => {
  try {
    await db.run(`
      UPDATE stock_alert_notifications
      SET status = 'SENT', sent_at = CURRENT_TIMESTAMP
      WHERE status = 'PENDING'
    `);
    res.json({ success: true, message: 'Offline notifications synchronized' });
  } catch (err) {
    console.error('Error syncing offline notifications:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.evaluateStockAlerts = evaluateStockAlerts;
router.calculateLiveStock = calculateLiveStock;
module.exports = router;
module.exports.evaluateStockAlerts = evaluateStockAlerts;
module.exports.calculateLiveStock = calculateLiveStock;
