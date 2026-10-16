const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { syncGodownTransfersToColdStorage } = require('../services/coldStorageTransferSync');

// Ensure godown_transfers table exists
const initTable = async () => {
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS godown_transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        s_no TEXT,
        transfer_date TEXT,
        from_godown_id INTEGER,
        from_godown_name TEXT,
        to_godown_id INTEGER,
        to_godown_name TEXT,
        item_name TEXT,
        lot_no TEXT,
        qty REAL DEFAULT 0,
        weight REAL DEFAULT 0,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (err) {
    console.error('Error creating godown_transfers table:', err.message);
  }
};
initTable();

// GET next sequential transfer number starting from TRF-1
router.get('/next-sno', async (req, res) => {
  try {
    const res1 = await db.query('SELECT s_no FROM godown_transfers');
    const res2 = await db.query('SELECT transfer_no FROM item_transfers');
    
    let maxNum = 0;
    (res1.rows || []).forEach(r => {
      const val = String(r.s_no || '').replace(/\D/g, '');
      const num = parseInt(val, 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    });
    (res2.rows || []).forEach(r => {
      const val = String(r.transfer_no || '').replace(/\D/g, '');
      const num = parseInt(val, 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    });

    const nextVal = `TRF-${maxNum + 1}`;
    res.json({ next_s_no: nextVal, next_transfer_no: nextVal });
  } catch (err) {
    res.json({ next_s_no: 'TRF-1', next_transfer_no: 'TRF-1' });
  }
});

// GET all godown transfer records
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM godown_transfers ORDER BY id DESC');
    res.json(result.rows || []);
  } catch (err) {
    console.error('Error fetching godown transfers:', err);
    res.status(500).json({ message: 'Error fetching godown transfers', error: err.message });
  }
});

// GET items available in a specific godown
router.get('/godown-items/:godownId', async (req, res) => {
  try {
    const godownId = req.params.godownId;

    const godownResult = await db.query(
      'SELECT id, godown_name FROM godown_master WHERE CAST(id AS TEXT) = ? OR LOWER(godown_name) = LOWER(?) LIMIT 1',
      [godownId, godownId]
    );
    const godown = godownResult.rows[0];
    if (!godown) return res.status(404).json({ message: 'Godown not found' });

    const lotResult = await db.query(`
      SELECT
        sl.item_name,
        sl.lot_no,
        SUM(COALESCE(sl.remaining_quantity, 0)) AS balance_qty,
        MAX(COALESCE(sl.rate, 0)) AS rate,
        MAX(COALESCE(NULLIF((
          SELECT pi.per_unit_weight
          FROM purchase_items pi
          WHERE CAST(pi.purchase_id AS TEXT) = CAST(sl.purchase_id AS TEXT)
            AND LOWER(TRIM(pi.lot_no)) = LOWER(TRIM(sl.lot_no))
            AND LOWER(TRIM(pi.item_name)) = LOWER(TRIM(sl.item_name))
          ORDER BY pi.id LIMIT 1
        ), 0), NULLIF(im.weight, 0), 1)) AS unit_weight,
        MAX(im.item_group) AS item_group
      FROM stock_lots sl
      LEFT JOIN item_master im ON LOWER(TRIM(sl.item_name)) = LOWER(TRIM(im.item_name))
      WHERE (
        CAST(sl.godown_id AS TEXT) = ?
        OR (sl.godown_id IS NULL AND LOWER(TRIM(COALESCE(sl.godown_name, ''))) = LOWER(TRIM(?)))
        OR (? = '1' AND sl.godown_id IS NULL AND (sl.godown_name IS NULL OR TRIM(sl.godown_name) = ''))
      )
      AND sl.lot_no IS NOT NULL AND TRIM(sl.lot_no) <> ''
      GROUP BY LOWER(TRIM(sl.item_name)), LOWER(TRIM(sl.lot_no)), sl.item_name, sl.lot_no
      HAVING SUM(COALESCE(sl.remaining_quantity, 0)) > 0
      ORDER BY sl.item_name, sl.lot_no
    `, [String(godown.id), godown.godown_name, String(godown.id)]);

    const items = (lotResult.rows || []).map(row => {
      const qty = Number(row.balance_qty) || 0;
      const unitWeight = Number(row.unit_weight) || 1;
      return {
        item_name: row.item_name,
        lot_no: row.lot_no,
        balance_qty: qty,
        unit_weight: unitWeight,
        total_weight: qty * unitWeight,
        rate: Number(row.rate) || 0,
        item_group: row.item_group || 'General'
      };
    });

    res.json({ godown_name: godown.godown_name, items });
  } catch (err) {
    console.error('Error fetching godown items:', err);
    res.status(500).json({ message: 'Error fetching godown items', error: err.message });
  }
});

// POST create new godown transfer
router.post('/', async (req, res) => {
  try {
    const {
      s_no,
      transfer_date,
      from_godown_id,
      from_godown_name,
      to_godown_id,
      to_godown_name,
      item_name,
      lot_no,
      qty,
      weight,
      remarks
    } = req.body;

    if (!item_name || !from_godown_id || !to_godown_id || !lot_no) {
      return res.status(400).json({ message: 'From Godown, To Godown, Item Name, and Lot Number are required.' });
    }

    const transferQty = parseFloat(qty) || 0;
    const transferWt = parseFloat(weight) || 0;
    if (transferQty <= 0 || transferWt < 0) {
      return res.status(400).json({ message: 'Transfer quantity must be positive and weight cannot be negative.' });
    }
    if (String(from_godown_id) === String(to_godown_id)) {
      return res.status(400).json({ message: 'From Godown and To Godown cannot be the same.' });
    }

    const sourceGodownResult = await db.query(
      'SELECT id, godown_name FROM godown_master WHERE CAST(id AS TEXT) = ? LIMIT 1',
      [String(from_godown_id)]
    );
    const destinationGodownResult = await db.query(
      'SELECT id, godown_name FROM godown_master WHERE CAST(id AS TEXT) = ? LIMIT 1',
      [String(to_godown_id)]
    );
    const sourceGodown = sourceGodownResult.rows[0];
    const destinationGodown = destinationGodownResult.rows[0];
    if (!sourceGodown || !destinationGodown) {
      return res.status(400).json({ message: 'Select valid source and destination godowns.' });
    }

    let sourceLots = await db.query(`
      SELECT id, remaining_quantity
      FROM stock_lots
      WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?))
        AND LOWER(TRIM(lot_no)) = LOWER(TRIM(?))
        AND COALESCE(remaining_quantity, 0) > 0
        AND (
          CAST(godown_id AS TEXT) = ?
          OR (godown_id IS NULL AND LOWER(TRIM(COALESCE(godown_name, ''))) = LOWER(TRIM(?)))
          OR (? = '1' AND godown_id IS NULL AND (godown_name IS NULL OR TRIM(godown_name) = ''))
        )
      ORDER BY id
    `, [item_name, lot_no, String(sourceGodown.id), sourceGodown.godown_name, String(sourceGodown.id)]);
    const sourceAvailable = sourceLots.rows.reduce((sum, row) => sum + (Number(row.remaining_quantity) || 0), 0);
    if (transferQty > sourceAvailable) {
      return res.status(400).json({
        message: `Insufficient stock for ${item_name} (Lot ${lot_no}) in ${sourceGodown.godown_name}. Available: ${sourceAvailable}, requested: ${transferQty}.`
      });
    }

    let finalSNo = s_no;
    if (!finalSNo || finalSNo.startsWith('TRF-')) {
      try {
        const checkRes = await db.query('SELECT s_no FROM godown_transfers');
        let maxNum = 0;
        (checkRes.rows || []).forEach(r => {
          const val = String(r.s_no || '').replace(/\D/g, '');
          const num = parseInt(val, 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        });
        finalSNo = String(maxNum + 1);
      } catch (err) {
        finalSNo = '1';
      }
    }

    const transaction = await db.getConnection();
    let transferId;
    try {
      await transaction.beginTransaction();
      sourceLots = await transaction.query(`
        SELECT id, remaining_quantity
        FROM stock_lots
        WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?))
          AND LOWER(TRIM(lot_no)) = LOWER(TRIM(?))
          AND COALESCE(remaining_quantity, 0) > 0
          AND (
            CAST(godown_id AS TEXT) = ?
            OR (godown_id IS NULL AND LOWER(TRIM(COALESCE(godown_name, ''))) = LOWER(TRIM(?)))
            OR (? = '1' AND godown_id IS NULL AND (godown_name IS NULL OR TRIM(godown_name) = ''))
          )
        ORDER BY id
      `, [item_name, lot_no, String(sourceGodown.id), sourceGodown.godown_name, String(sourceGodown.id)]);
      const currentSourceAvailable = sourceLots.rows.reduce((sum, row) => sum + (Number(row.remaining_quantity) || 0), 0);
      if (transferQty > currentSourceAvailable) {
        const insufficientStockError = new Error(
          `Insufficient stock for ${item_name} (Lot ${lot_no}) in ${sourceGodown.godown_name}. Available: ${currentSourceAvailable}, requested: ${transferQty}.`
        );
        insufficientStockError.statusCode = 400;
        throw insufficientStockError;
      }

      const result = await transaction.run(`
        INSERT INTO godown_transfers (
          s_no, transfer_date, from_godown_id, from_godown_name, to_godown_id, to_godown_name,
          item_name, lot_no, qty, weight, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        finalSNo,
        transfer_date || new Date().toISOString().split('T')[0],
        sourceGodown.id,
        sourceGodown.godown_name,
        destinationGodown.id,
        destinationGodown.godown_name,
        item_name,
        lot_no,
        transferQty,
        transferWt,
        remarks || ''
      ]);
      transferId = result.lastID;

      await transaction.run(`
        INSERT INTO stock (date, item_name, lot_no, type, qty, weight, godown, godown_id, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        transfer_date || new Date().toISOString().split('T')[0],
        item_name,
        lot_no,
        'Godown Transfer Out',
        -Math.abs(transferQty),
        -Math.abs(transferWt),
        sourceGodown.godown_name,
        sourceGodown.id,
        `Transferred to ${destinationGodown.godown_name}. ${remarks || ''}`
      ]);
      await transaction.run(`
        INSERT INTO stock (date, item_name, lot_no, type, qty, weight, godown, godown_id, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        transfer_date || new Date().toISOString().split('T')[0],
        item_name,
        lot_no,
        'Godown Transfer In',
        Math.abs(transferQty),
        Math.abs(transferWt),
        destinationGodown.godown_name,
        destinationGodown.id,
        `Transferred from ${sourceGodown.godown_name}. ${remarks || ''}`
      ]);

      let remainingToDeduct = transferQty;
      for (const sourceLot of sourceLots.rows) {
        if (remainingToDeduct <= 0) break;
        const sourceLotQty = Number(sourceLot.remaining_quantity) || 0;
        const deduction = Math.min(sourceLotQty, remainingToDeduct);
        await transaction.run(
          'UPDATE stock_lots SET remaining_quantity = remaining_quantity - ? WHERE id = ?',
          [deduction, sourceLot.id]
        );
        remainingToDeduct -= deduction;
      }

      const destLotResult = await transaction.query(`
        SELECT id FROM stock_lots
        WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?))
          AND LOWER(TRIM(lot_no)) = LOWER(TRIM(?))
          AND CAST(godown_id AS TEXT) = ?
        ORDER BY id LIMIT 1
      `, [item_name, lot_no, String(destinationGodown.id)]);
      if (destLotResult.rows[0]) {
        await transaction.run(`
          UPDATE stock_lots
          SET quantity = COALESCE(quantity, 0) + ?, remaining_quantity = COALESCE(remaining_quantity, 0) + ?
          WHERE id = ?
        `, [transferQty, transferQty, destLotResult.rows[0].id]);
      } else {
        const itemResult = await transaction.query(
          'SELECT id FROM item_master WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?)) LIMIT 1',
          [item_name]
        );
        const sourceLotInfo = sourceLots.rows[0];
        const purchaseResult = await transaction.query(
          'SELECT purchase_id, rate FROM stock_lots WHERE id = ?',
          [sourceLotInfo.id]
        );
        await transaction.run(`
          INSERT INTO stock_lots (
            item_id, item_name, lot_no, purchase_id, quantity, remaining_quantity,
            rate, godown_id, godown_name, qc_status, usable_for_production,
            approval_status, unloading_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACCEPTED', 1, 'APPROVED', 'UNLOADED')
        `, [
          itemResult.rows[0]?.id || null,
          item_name,
          lot_no,
          purchaseResult.rows[0]?.purchase_id || null,
          transferQty,
          transferQty,
          purchaseResult.rows[0]?.rate || 0,
          destinationGodown.id,
          destinationGodown.godown_name
        ]);
      }
      await transaction.commit();
    } catch (transactionError) {
      await transaction.rollback();
      throw transactionError;
    } finally {
      transaction.release();
    }

    // Create linked operational charges if provided in request
    const chargesCreated = [];
    if (Array.isArray(req.body.operational_charges) && req.body.operational_charges.length > 0) {
      const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
      const engine = require('../services/operationalChargeEngine');
      for (const ch of req.body.operational_charges) {
        try {
          const chRes = await engine.createOperationalCharge(activeCompanyId, {
            ...ch,
            source_module: 'GODOWN_TRANSFER',
            source_transaction_type: 'GODOWN_TRANSFER',
            source_transaction_id: transferId,
            source_transaction_no: finalSNo,
            charge_date: transfer_date || new Date().toISOString().split('T')[0],
            item_name,
            lot_no: lot_no || 'LOT-TRANSFER',
            from_location: from_godown_name || '',
            to_location: to_godown_name || '',
            vehicle_no: ch.vehicle_no || req.body.vehicle_no || '',
            driver_name: ch.driver_name || req.body.driver_name || '',
            quantity: ch.quantity !== undefined ? ch.quantity : transferQty
          });
          chargesCreated.push(chRes);
        } catch (chErr) {
          console.warn('[Transfer Operational Charge Error]:', chErr.message);
        }
      }
    }

    let coldStorageSyncWarning;
    try {
      await syncGodownTransfersToColdStorage();
    } catch (syncError) {
      coldStorageSyncWarning = syncError.message;
      console.error('Godown transfer saved, but cold-storage voucher sync failed:', syncError);
    }

    res.status(201).json({
      message: coldStorageSyncWarning
        ? `Transfer saved. Cold-storage voucher sync is pending: ${coldStorageSyncWarning}`
        : 'Godown transfer saved successfully',
      id: transferId,
      ...(coldStorageSyncWarning ? { warning: coldStorageSyncWarning } : {})
    });
  } catch (err) {
    console.error('Error creating godown transfer:', err);
    res.status(err.statusCode || 500).json({ message: 'Error creating godown transfer', error: err.message });
  }
});

// DELETE godown transfer
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM godown_transfers WHERE id = ?', [id]);
    res.json({ message: 'Godown transfer deleted successfully' });
  } catch (err) {
    console.error('Error deleting godown transfer:', err);
    res.status(500).json({ message: 'Error deleting godown transfer', error: err.message });
  }
});

// GET operational charges for a godown transfer
router.get('/:id/charges', async (req, res) => {
  try {
    const activeCompanyId = req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
    const engine = require('../services/operationalChargeEngine');
    const result = await engine.getOperationalTraceability(activeCompanyId, {
      sourceModule: 'GODOWN_TRANSFER',
      sourceTransactionId: req.params.id
    });
    res.json({ success: true, charges: result.charges || [], traceability: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
