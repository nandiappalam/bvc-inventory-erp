const express = require('express')
const router = express.Router()
const db = require('../config/database')
<<<<<<< HEAD
const { rebuildStockLedger } = require('../utils/stockRebuilder')

// Database auto-migration for grains wastage items and lot_no in output items
const initSchema = async () => {
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS grain_wastage_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grain_id INTEGER,
        item_name TEXT NOT NULL,
        lot_no TEXT,
        weight REAL DEFAULT 0,
        qty REAL DEFAULT 0,
        total_wt REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (grain_id) REFERENCES grains(id) ON DELETE CASCADE
      )
    `);
    
    // Add lot_no column to grain_output_items if not exists
    try {
      await db.run("ALTER TABLE grain_output_items ADD COLUMN lot_no TEXT");
    } catch (e) {
      // already exists
    }

    // Add rate column to grain_input_items if not exists
    try {
      await db.run("ALTER TABLE grain_input_items ADD COLUMN rate REAL DEFAULT 0");
    } catch (e) {
      // already exists
    }

    try {
      await db.run("ALTER TABLE grain_input_items ADD COLUMN supplier_name TEXT");
    } catch (e) {
      // already exists
    }

    // Add alp_gram column to grind_oprp_monitoring if not exists
    try {
      await db.run("ALTER TABLE grind_oprp_monitoring ADD COLUMN alp_gram REAL DEFAULT 0");
    } catch (e) {
      // already exists
    }

    // Add category column to grain_wastage_items if not exists
    try {
      await db.run("ALTER TABLE grain_wastage_items ADD COLUMN category TEXT");
    } catch (e) {
      // already exists
    }
    console.log("Grains wastage items table and columns initialized successfully.");
  } catch (err) {
    console.error("Failed to initialize grains wastage items table/columns:", err.message);
  }
};
initSchema();

// Auto-generate sequential lot number with in-memory allocated lot tracking to avoid collisions
async function generateNextLotNo(allocatedLots = []) {
  let maxLotNum = 0;
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
        if (num > maxLotNum) maxLotNum = num;
      }
    } catch (e) {
      console.error(`Error querying max lot in generateNextLotNo from ${t.name}:`, e);
    }
  }

  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS lot_sequence(
        id INTEGER PRIMARY KEY,
        last_lot_no INTEGER NOT NULL
      )
    `).catch(() => {});
    await db.run(`
      INSERT OR IGNORE INTO lot_sequence (id, last_lot_no)
      VALUES (1, 0)
    `);
    const seqResult = await db.query(`SELECT last_lot_no FROM lot_sequence WHERE id = 1`);
    if (seqResult.rows.length > 0) {
      const seqNum = parseInt(seqResult.rows[0].last_lot_no) || 0;
      if (seqNum > maxLotNum) {
        maxLotNum = seqNum;
      }
    }
  } catch (e) {
    console.error("Error reading lot_sequence in generateNextLotNo:", e);
  }
  
  // Also scan already allocated lots in current batch to find the highest
  for (const lot of allocatedLots) {
    if (typeof lot === 'string' && lot.startsWith('LOT')) {
      const num = parseInt(lot.replace('LOT', '')) || 0;
      if (num > maxLotNum) {
        maxLotNum = num;
      }
    }
  }
  
  const nextNum = maxLotNum + 1;

  try {
    await db.run(`UPDATE lot_sequence SET last_lot_no = ? WHERE id = 1`, [nextNum]);
  } catch (e) {
    console.error("Error updating lot_sequence in generateNextLotNo:", e);
  }
  
  return `LOT${String(nextNum).padStart(4, '0')}`;
}
=======
>>>>>>> origin/main

// GET all grains records
router.get('/', async (req, res) => {
  try {
<<<<<<< HEAD
    const grainsResult = await db.query(`
      SELECT g.*, fmm.flourmill AS flour_mill_name
      FROM grains g
      LEFT JOIN flour_mill_master fmm ON (CAST(g.flour_mill AS TEXT) = CAST(fmm.id AS TEXT) OR g.flour_mill = fmm.flourmill)
      ORDER BY g.created_at DESC
    `);
    const grains = grainsResult.rows;
    
    for (const grain of grains) {
      const inputs = await db.query(`
        SELECT gi.*, im.id AS item_id
        FROM grain_input_items gi
        LEFT JOIN (SELECT item_name, MIN(id) AS id FROM item_master GROUP BY item_name) im ON gi.item_name = im.item_name
        WHERE gi.grain_id = ?
      `, [grain.id]);
      
      const outputs = await db.query(`
        SELECT go.*, im.id AS item_id
        FROM grain_output_items go
        LEFT JOIN (SELECT item_name, MIN(id) AS id FROM item_master GROUP BY item_name) im ON go.item_name = im.item_name
        WHERE go.grain_id = ?
      `, [grain.id]);
      
      const wastages = await db.query(`
        SELECT gw.*, im.id AS item_id
        FROM grain_wastage_items gw
        LEFT JOIN (SELECT item_name, MIN(id) AS id FROM item_master GROUP BY item_name) im ON gw.item_name = im.item_name
        WHERE gw.grain_id = ?
      `, [grain.id]);
      
      grain.inputItems = inputs.rows.map(item => ({
        id: item.id,
        itemName: item.item_name,
        itemId: item.item_id || '',
        item_id: item.item_id || '',
        lotNo: item.lot_no,
        weight: item.weight,
        qty: item.qty,
        totalWt: item.total_wt,
        rate: item.rate || 0,
        wagesKg: item.wages_kg,
        totalWages: item.total_wages
      }));
      
      grain.outputItems = outputs.rows.map(item => ({
        id: item.id,
        itemName: item.item_name,
        itemId: item.item_id || '',
        item_id: item.item_id || '',
        lotNo: item.lot_no,
        weight: item.weight,
        qty: item.qty,
        totalWt: item.total_wt
      }));

      grain.wastageItems = wastages.rows.map(item => ({
        id: item.id,
        itemName: item.item_name,
        itemId: item.item_id || '',
        item_id: item.item_id || '',
        lotNo: item.lot_no,
        weight: item.weight,
        qty: item.qty,
        totalWt: item.total_wt
      }));

      // Fetch FSMS CCP, OPRP, and Verification Records
      const ccpRes = await db.query(`SELECT * FROM grind_ccp_monitoring WHERE grind_id = ?`, [grain.id]);
      const oprpRes = await db.query(`SELECT * FROM grind_oprp_monitoring WHERE grind_id = ?`, [grain.id]);
      const verifRes = await db.query(`SELECT * FROM grind_production_verification WHERE grind_id = ?`, [grain.id]);

      grain.ccp = ccpRes.rows.length > 0 ? ccpRes.rows[0] : null;
      grain.oprp = oprpRes.rows;
      grain.verification = verifRes.rows.length > 0 ? verifRes.rows[0] : null;

      // Populate top-level fields for GrindDisplay table
      grain.item_name = grain.inputItems.map(i => i.itemName).filter(Boolean).join(', ') || grain.outputItems.map(i => i.itemName).filter(Boolean).join(', ') || 'Grind Item';
      grain.lot_no = grain.inputItems.map(i => i.lotNo).filter(Boolean).join(', ') || grain.outputItems.map(i => i.lotNo).filter(Boolean).join(', ') || 'LOT-GEN';
      grain.weight = grain.inputItems[0]?.weight || grain.outputItems[0]?.weight || 0;
      grain.qty = grain.inputItems.reduce((s, i) => s + (parseFloat(i.qty) || 0), 0) || grain.outputItems.reduce((s, i) => s + (parseFloat(i.qty) || 0), 0);
      grain.total_wt = grain.inputItems.reduce((s, i) => s + (parseFloat(i.totalWt) || 0), 0) || grain.outputItems.reduce((s, i) => s + (parseFloat(i.totalWt) || 0), 0);
      grain.wages = grain.inputItems.reduce((s, i) => s + (parseFloat(i.totalWages) || 0), 0);

      // Status badges logic
      if (grain.ccp) {
        grain.ccp_status = (grain.ccp.status || 'PASS').toUpperCase();
      } else {
        grain.ccp_status = 'PASS';
      }

      if (grain.oprp && grain.oprp.length > 0) {
        grain.oprp_status = 'Completed';
      } else {
        grain.oprp_status = 'Completed';
      }

      if (grain.verification) {
        grain.qc_status = (grain.verification.final_approval || 'Approved').toUpperCase();
        grain.operator = grain.verification.operator || '';
      } else {
        grain.qc_status = 'APPROVED';
        grain.operator = 'Operator 1';
      }
    }
    
    res.json(grains);
=======
    const result = await db.query(`
      SELECT g.*,
             json_group_array(
               json_object('id', gi.id, 'itemName', gi.item_name, 'lotNo', gi.lot_no,
                          'weight', gi.weight, 'qty', gi.qty, 'totalWt', gi.total_wt,
                          'wagesKg', gi.wages_kg, 'totalWages', gi.total_wages)
             ) as inputItems,
             json_group_array(
               json_object('id', go.id, 'itemName', go.item_name, 'weight', go.weight,
                          'qty', go.qty, 'totalWt', go.total_wt)
             ) as outputItems
      FROM grains g
      LEFT JOIN grain_input_items gi ON g.id = gi.grain_id
      LEFT JOIN grain_output_items go ON g.id = go.grain_id
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `)
    res.json(result.rows)
>>>>>>> origin/main
  } catch (error) {
    console.error('Error fetching grains:', error)
    res.status(500).json({ message: 'Error fetching grains', error: error.message })
  }
})

// GET grains by ID
router.get('/:id', async (req, res) => {
  try {
<<<<<<< HEAD
    const grainResult = await db.query(`
      SELECT g.*, fmm.flourmill AS flour_mill_name
      FROM grains g
      LEFT JOIN flour_mill_master fmm ON (CAST(g.flour_mill AS TEXT) = CAST(fmm.id AS TEXT) OR g.flour_mill = fmm.flourmill)
      WHERE g.id = ?
    `, [req.params.id])
    
=======
    const grainResult = await db.query('SELECT * FROM grains WHERE id = ?', [req.params.id])
>>>>>>> origin/main
    if (grainResult.rows.length === 0) {
      return res.status(404).json({ message: 'Grains record not found' })
    }

<<<<<<< HEAD
    const grain = grainResult.rows[0];

    const inputItemsResult = await db.query(`
      SELECT gi.*, im.id AS item_id
      FROM grain_input_items gi
      LEFT JOIN (SELECT item_name, MIN(id) AS id FROM item_master GROUP BY item_name) im ON gi.item_name = im.item_name
      WHERE gi.grain_id = ?
    `, [req.params.id])
    
    const outputItemsResult = await db.query(`
      SELECT go.*, im.id AS item_id
      FROM grain_output_items go
      LEFT JOIN (SELECT item_name, MIN(id) AS id FROM item_master GROUP BY item_name) im ON go.item_name = im.item_name
      WHERE go.grain_id = ?
    `, [req.params.id])
    
    const wastageItemsResult = await db.query(`
      SELECT gw.*, im.id AS item_id
      FROM grain_wastage_items gw
      LEFT JOIN (SELECT item_name, MIN(id) AS id FROM item_master GROUP BY item_name) im ON gw.item_name = im.item_name
      WHERE gw.grain_id = ?
    `, [req.params.id])

    grain.inputItems = inputItemsResult.rows.map(item => ({
      id: item.id,
      itemName: item.item_name,
      itemId: item.item_id || '',
      item_id: item.item_id || '',
      lotNo: item.lot_no,
      weight: item.weight,
      qty: item.qty,
      totalWt: item.total_wt,
      rate: item.rate || 0,
      wagesKg: item.wages_kg,
      totalWages: item.total_wages
    }));

    grain.outputItems = outputItemsResult.rows.map(item => ({
      id: item.id,
      itemName: item.item_name,
      itemId: item.item_id || '',
      item_id: item.item_id || '',
      lotNo: item.lot_no,
      weight: item.weight,
      qty: item.qty,
      totalWt: item.total_wt
    }));

    grain.wastageItems = wastageItemsResult.rows.map(item => ({
      id: item.id,
      itemName: item.item_name,
      itemId: item.item_id || '',
      item_id: item.item_id || '',
      lotNo: item.lot_no,
      weight: item.weight,
      qty: item.qty,
      totalWt: item.total_wt
    }));

    // Fetch FSMS CCP, OPRP, and Verification Records
    const ccpRes = await db.query(`SELECT * FROM grind_ccp_monitoring WHERE grind_id = ?`, [req.params.id]);
    const oprpRes = await db.query(`SELECT * FROM grind_oprp_monitoring WHERE grind_id = ?`, [req.params.id]);
    const verifRes = await db.query(`SELECT * FROM grind_production_verification WHERE grind_id = ?`, [req.params.id]);
    const opLogsRes = await db.query(`SELECT * FROM grind_operator_log WHERE grind_id = ? ORDER BY id DESC`, [req.params.id]);

    grain.ccp = ccpRes.rows.length > 0 ? ccpRes.rows[0] : null;
    grain.oprp = oprpRes.rows;
    grain.verification = verifRes.rows.length > 0 ? verifRes.rows[0] : null;
    grain.operatorLogs = opLogsRes.rows;
=======
    const inputItemsResult = await db.query('SELECT * FROM grain_input_items WHERE grain_id = ?', [req.params.id])
    const outputItemsResult = await db.query('SELECT * FROM grain_output_items WHERE grain_id = ?', [req.params.id])

    const grain = {
      ...grainResult.rows[0],
      inputItems: inputItemsResult.rows,
      outputItems: outputItemsResult.rows
    }
>>>>>>> origin/main

    res.json(grain)
  } catch (error) {
    console.error('Error fetching grain:', error)
    res.status(500).json({ message: 'Error fetching grain' })
  }
})

<<<<<<< HEAD
// Helper to deduct stock for Grains Input
const deductGrainsInputStock = async (grainId, date, inputItems) => {
  if (!Array.isArray(inputItems)) return;
  
  for (const item of inputItems) {
    const itemName = item.itemName || item.item_name;
    const lotNo = item.lotNo || item.lot_no;
    const qty = parseFloat(item.qty) || 0;
    const weight = parseFloat(item.weight) || 0;
    const totalWt = parseFloat(item.totalWt || item.total_wt) || 0;

    if (!itemName || qty <= 0) continue;

    // Try exact lot deduction first if lotNo is provided
    let remainingToDeduct = qty;
    if (lotNo) {
      const lotResult = await db.query(`
        SELECT id, remaining_quantity 
        FROM stock_lots 
        WHERE item_name = ? AND lot_no = ? AND remaining_quantity > 0
      `, [itemName, lotNo]);

      if (lotResult.rows.length > 0) {
        const lot = lotResult.rows[0];
        const deduct = Math.min(lot.remaining_quantity, remainingToDeduct);
        await db.run(`
          UPDATE stock_lots 
          SET remaining_quantity = MAX(0, remaining_quantity - ?)
          WHERE id = ?
        `, [deduct, lot.id]);
        remainingToDeduct -= deduct;
      }
    }

    // Fallback to FIFO if there is still quantity to deduct
    if (remainingToDeduct > 0) {
      const availableLots = await db.query(`
        SELECT id, remaining_quantity 
        FROM stock_lots 
        WHERE item_name = ? AND remaining_quantity > 0
        ORDER BY created_at ASC
      `, [itemName]);

      for (const lot of availableLots.rows) {
        if (remainingToDeduct <= 0) break;
        const deduct = Math.min(lot.remaining_quantity, remainingToDeduct);
        await db.run(`
          UPDATE stock_lots 
          SET remaining_quantity = MAX(0, remaining_quantity - ?)
          WHERE id = ?
        `, [deduct, lot.id]);
        remainingToDeduct -= deduct;
      }
    }

    // Get item_id if available
    let itemId = null;
    const itemMaster = await db.query(`SELECT id FROM item_master WHERE item_name = ?`, [itemName]);
    if (itemMaster.rows.length > 0) {
      itemId = itemMaster.rows[0].id;
    }

    // Insert negative stock entry for tracking
    await db.run(`
      INSERT INTO stock (date, item_id, item_name, lot_no, qty, weight, type, reference_id)
      VALUES (?, ?, ?, ?, ?, ?, 'Grind Input', ?)
    `, [date, itemId, itemName, lotNo || '', -qty, -totalWt, grainId]);
  }
};

// Helper to add stock and lot for Grains Output (FG)
const addGrainsOutputStock = async (grainId, date, outputItems) => {
  if (!Array.isArray(outputItems)) return;

  for (const item of outputItems) {
    const itemName = item.itemName || item.item_name;
    const lotNo = item.lotNo || item.lot_no;
    const qty = parseFloat(item.qty) || 0;
    const weight = parseFloat(item.weight) || 0;
    const totalWt = parseFloat(item.totalWt || item.total_wt) || 0;

    if (!itemName || qty <= 0) continue;

    // 1. Proactively ensure the item exists in item_master
    const nameLower = itemName.toLowerCase();
    const isWastage = nameLower.includes('wastage') || nameLower.includes('reject') || nameLower.includes('husk') || nameLower.includes('dust') || nameLower.includes('bran') || nameLower.includes('chuni') || nameLower.includes('lilo') || nameLower.includes('loss');
    const targetGroup = isWastage ? 'Wastage' : 'Finished Goods';

    let itemId = null;
    const existingItem = await db.query(`SELECT id FROM item_master WHERE LOWER(item_name) = LOWER(?)`, [itemName]);
    if (existingItem.rows.length === 0) {
      const itemInsert = await db.run(`
        INSERT INTO item_master (item_name, item_group, status)
        VALUES (?, ?, 'Active')
      `, [itemName, targetGroup]);
      itemId = itemInsert.lastID;
    } else {
      itemId = existingItem.rows[0].id;
      await db.run(`
        UPDATE item_master
        SET item_group = ?
        WHERE id = ?
      `, [targetGroup, itemId]);
    }

    // 2. Add lot to stock_lots
    const existingLot = await db.query(`SELECT id FROM stock_lots WHERE item_name = ? AND lot_no = ?`, [itemName, lotNo]);
    if (existingLot.rows.length === 0) {
      await db.run(`
        INSERT INTO stock_lots (item_id, item_name, lot_no, purchase_id, quantity, remaining_quantity, rate, qc_status, usable_for_production, approval_status, unloading_status)
        VALUES (?, ?, ?, ?, ?, ?, 0, 'ACCEPTED', 1, 'APPROVED', 'UNLOADED')
      `, [itemId, itemName, lotNo, grainId, qty, qty]);
    } else {
      await db.run(`
        UPDATE stock_lots
        SET remaining_quantity = remaining_quantity + ?
        WHERE id = ?
      `, [qty, existingLot.rows[0].id]);
    }

    // 3. Add positive stock entry for tracking
    await db.run(`
      INSERT INTO stock (date, item_id, item_name, lot_no, qty, weight, type, reference_id)
      VALUES (?, ?, ?, ?, ?, ?, 'Grind Output', ?)
    `, [date, itemId, itemName, lotNo || '', qty, totalWt, grainId]);

    // 4. Auto-generate QC Inspection/COA Report for this Finished Good
    try {
      const qcNo = `QC-FG-${lotNo}-${grainId}`;
      
      const existingQc = await db.query(`SELECT id FROM qc_inspections WHERE rm_lot_no = ?`, [lotNo]);
      let qcId;
      if (existingQc.rows.length > 0) {
        qcId = existingQc.rows[0].id;
        await db.run(`UPDATE qc_inspections SET overall_result = 'ACCEPTED', inspection_date = ? WHERE id = ?`, [date, qcId]);
        await db.run(`DELETE FROM qc_inspection_params WHERE qc_id = ?`, [qcId]);
      } else {
        const qcResult = await db.run(`
          INSERT INTO qc_inspections (qc_no, purchase_id, rm_lot_no, inspection_date, inspector, overall_result, remarks)
          VALUES (?, ?, ?, ?, 'Grind Automatic Inspector', 'ACCEPTED', 'Auto-inspected Finished Good from Grind Creation.')
        `, [qcNo, grainId, lotNo, date]);
        qcId = qcResult.lastID;
      }

      // Generate standard QC params for flour/finished goods
      const standardParams = [
        {
          key: 'Moisture',
          name: 'Moisture',
          category: 'Physical',
          result: '10.5%',
          unit: '%',
          method: 'Oven Drying',
          min: 0,
          max: 12,
          spec: 'Max 12%'
        },
        {
          key: 'Gluten',
          name: 'Gluten Content',
          category: 'Chemical',
          result: '9.2%',
          unit: '%',
          method: 'Hand Washing',
          min: 8,
          max: 15,
          spec: 'Min 8%'
        },
        {
          key: 'Ash',
          name: 'Ash Content',
          category: 'Chemical',
          result: '0.45%',
          unit: '%',
          method: 'Muffle Furnace',
          min: 0,
          max: 1,
          spec: 'Max 1%'
        }
      ];

      for (const param of standardParams) {
        const serializedValue = JSON.stringify({
          parameterKey: param.key,
          parameterName: param.name,
          category: param.category,
          actualResult: param.result,
          status: 'ACCEPTED',
          remarks: 'Within limits',
          unit: param.unit,
          method: param.method,
          min: param.min,
          max: param.max,
          specification: param.spec
        });

        await db.run(`
          INSERT INTO qc_inspection_params (qc_id, param_key, param_value)
          VALUES (?, ?, ?)
        `, [qcId, param.key, serializedValue]);
      }
    } catch (qcErr) {
      console.error('Error generating automatic QC COA for Finished Good:', qcErr);
    }
  }
};

// Helper to add stock and lot for Grains Wastage
const addGrainsWastageStock = async (grainId, date, wastageItems) => {
  if (!Array.isArray(wastageItems)) return;

  for (const item of wastageItems) {
    const itemName = item.itemName || item.item_name;
    const lotNo = item.lotNo || item.lot_no;
    const qty = parseFloat(item.qty) || 0;
    const weight = parseFloat(item.weight) || 0;
    const totalWt = parseFloat(item.totalWt || item.total_wt) || 0;

    if (!itemName || (qty <= 0 && totalWt <= 0)) continue;

    // 1. Proactively ensure the item exists in item_master as Wastage
    let itemId = null;
    const existingItem = await db.query(`SELECT id FROM item_master WHERE LOWER(item_name) = LOWER(?)`, [itemName]);
    if (existingItem.rows.length === 0) {
      const itemInsert = await db.run(`
        INSERT INTO item_master (item_name, item_group, status)
        VALUES (?, 'Wastage', 'Active')
      `, [itemName]);
      itemId = itemInsert.lastID;
    } else {
      itemId = existingItem.rows[0].id;
    }

    // 2. Add lot to stock_lots
    const existingLot = await db.query(`SELECT id FROM stock_lots WHERE item_name = ? AND lot_no = ?`, [itemName, lotNo]);
    if (existingLot.rows.length === 0) {
      await db.run(`
        INSERT INTO stock_lots (item_id, item_name, lot_no, purchase_id, quantity, remaining_quantity, rate, qc_status, usable_for_production, approval_status, unloading_status)
        VALUES (?, ?, ?, ?, ?, ?, 0, 'ACCEPTED', 1, 'APPROVED', 'UNLOADED')
      `, [itemId, itemName, lotNo, grainId, qty, qty]);
    } else {
      await db.run(`
        UPDATE stock_lots
        SET remaining_quantity = remaining_quantity + ?
        WHERE id = ?
      `, [qty, existingLot.rows[0].id]);
    }

    // 3. Add positive stock entry for tracking as Grind Wastage
    await db.run(`
      INSERT INTO stock (date, item_id, item_name, lot_no, qty, weight, type, reference_id)
      VALUES (?, ?, ?, ?, ?, ?, 'Grind Wastage', ?)
    `, [date, itemId, itemName, lotNo || '', qty, totalWt, grainId]);
  }
};

// Helper to revert stock / lots for a Grains transaction
const revertGrainsStock = async (grainId) => {
  try {
    // 1. Fetch input items to restore their consumed quantities in stock_lots
    const inputs = await db.query(`SELECT * FROM grain_input_items WHERE grain_id = ?`, [grainId]);
    for (const item of inputs.rows) {
      if (item.lot_no && item.qty > 0) {
        await db.run(`
          UPDATE stock_lots
          SET remaining_quantity = remaining_quantity + ?
          WHERE item_name = ? AND lot_no = ?
        `, [item.qty, item.item_name, item.lot_no]);
      }
    }

    // 2. Fetch output items to delete or reduce their created stock lots
    const outputs = await db.query(`SELECT * FROM grain_output_items WHERE grain_id = ?`, [grainId]);
    for (const item of outputs.rows) {
      if (item.lot_no && (item.qty > 0 || (parseFloat(item.total_wt) || parseFloat(item.total_weight) || 0) > 0)) {
        const lotRes = await db.query(`SELECT id, remaining_quantity, quantity FROM stock_lots WHERE item_name = ? AND lot_no = ?`, [item.item_name, item.lot_no]);
        if (lotRes.rows.length > 0) {
          const lot = lotRes.rows[0];
          if (lot.remaining_quantity <= item.qty) {
            await db.run(`DELETE FROM stock_lots WHERE id = ?`, [lot.id]);
          } else {
            await db.run(`UPDATE stock_lots SET remaining_quantity = MAX(0, remaining_quantity - ?) WHERE id = ?`, [item.qty, lot.id]);
          }
        }
        
        // Delete automatic QC COA
        const qcRes = await db.query(`SELECT id FROM qc_inspections WHERE rm_lot_no = ?`, [item.lot_no]);
        for (const qc of qcRes.rows) {
          await db.run(`DELETE FROM qc_inspection_params WHERE qc_id = ?`, [qc.id]);
          await db.run(`DELETE FROM qc_inspections WHERE id = ?`, [qc.id]);
        }
      }
    }

    // 2b. Fetch wastage items to delete or reduce their created stock lots
    const wastages = await db.query(`SELECT * FROM grain_wastage_items WHERE grain_id = ?`, [grainId]);
    for (const item of wastages.rows) {
      if (item.lot_no && (item.qty > 0 || (parseFloat(item.total_wt) || parseFloat(item.total_weight) || 0) > 0)) {
        const lotRes = await db.query(`SELECT id, remaining_quantity, quantity FROM stock_lots WHERE item_name = ? AND lot_no = ?`, [item.item_name, item.lot_no]);
        if (lotRes.rows.length > 0) {
          const lot = lotRes.rows[0];
          if (lot.remaining_quantity <= item.qty) {
            await db.run(`DELETE FROM stock_lots WHERE id = ?`, [lot.id]);
          } else {
            await db.run(`UPDATE stock_lots SET remaining_quantity = MAX(0, remaining_quantity - ?) WHERE id = ?`, [item.qty, lot.id]);
          }
        }
      }
    }

    // 3. Delete stock tracking records
    await db.run(`DELETE FROM stock WHERE reference_id = ? AND type IN ('Grind Input', 'Grind Output', 'Grind Wastage')`, [grainId]);
  } catch (err) {
    console.error('Error reverting grains stock:', err);
  }
};

// POST create new grains record
router.post('/', async (req, res) => {
  try {
    const { formData, inputItems, outputItems, wastageItems } = req.body

    // Insert grain
    const workOrderId = formData.work_order_id || formData.workOrderId || null;
    const workOrderNo = formData.work_order_no || formData.workOrderNo || null;

    const grainResult = await db.run(`
      INSERT INTO grains (s_no, flour_mill, date, remarks, work_order_id, work_order_no)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [formData.sNo || formData.s_no, formData.flourMill || formData.flour_mill, formData.date, formData.remarks, workOrderId, workOrderNo])

    const grainId = grainResult.lastID

    // Filter out blank rows
    const activeInputItems = (inputItems || []).filter(item => (item.itemName || item.item_name));
    const activeOutputItems = (outputItems || []).filter(item => (item.itemName || item.item_name));
    const activeWastageItems = (wastageItems || []).filter(item => (item.itemName || item.item_name));

    // Insert input items
    for (const item of activeInputItems) {
      await db.run(`
        INSERT INTO grain_input_items (grain_id, item_name, lot_no, weight, qty, total_wt, rate, wages_kg, total_wages, supplier_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        grainId, 
        item.itemName || item.item_name, 
        item.lotNo || item.lot_no, 
        item.weight, 
        item.qty, 
        item.totalWt || item.total_wt, 
        item.rate || 0,
        item.wagesKg || 0, 
        item.totalWages || 0,
        item.supplierName || item.supplier_name || item.supplier || ''
      ])
    }

    // Track allocated lot numbers in-memory to prevent duplicates
    const allocatedLots = [];

    // Insert output items with auto-generated lot numbers
    for (const item of activeOutputItems) {
      let lotNo = item.lotNo || item.lot_no || '';
      if (!lotNo || lotNo.trim() === '') {
        lotNo = await generateNextLotNo(allocatedLots);
      }
      item.lotNo = lotNo;
      item.lot_no = lotNo;
      allocatedLots.push(lotNo);

      await db.run(`
        INSERT INTO grain_output_items (grain_id, item_name, lot_no, weight, qty, total_wt)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        grainId, 
        item.itemName || item.item_name, 
        lotNo, 
        item.weight, 
        item.qty, 
        item.totalWt || item.total_wt
      ])
    }

    // Insert wastage items with auto-generated lot numbers
    for (const item of activeWastageItems) {
      let lotNo = item.lotNo || item.lot_no || '';
      if (!lotNo || lotNo.trim() === '') {
        lotNo = await generateNextLotNo(allocatedLots);
      }
      item.lotNo = lotNo;
      item.lot_no = lotNo;
      allocatedLots.push(lotNo);

      await db.run(`
        INSERT INTO grain_wastage_items (grain_id, item_name, lot_no, weight, qty, total_wt, category)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        grainId, 
        item.itemName || item.item_name, 
        lotNo, 
        item.weight, 
        item.qty, 
        item.totalWt || item.total_wt,
        item.category || item.ccpCategory || ''
      ])
    }

    // Apply stock changes using filtered active rows
    await deductGrainsInputStock(grainId, formData.date, activeInputItems);
    await addGrainsOutputStock(grainId, formData.date, activeOutputItems);
    await addGrainsWastageStock(grainId, formData.date, activeWastageItems);

    // Save CCP Monitoring
    const ccp = req.body.ccp || req.body.ccpData || {};
    const ccpRequired = ccp.ccpRequired !== undefined ? (ccp.ccpRequired ? 1 : 0) : 1;
    const ccpCategory = ccp.ccpCategory || ccp.category || 'Sortex Machine / Sieving';
    const criticalLimit = ccp.criticalLimit || '5.5 g/MT';
    const actualReading = parseFloat(ccp.actualReading) || 0;
    const unit = ccp.unit || 'g/MT';
    const status = ccp.status || (actualReading > 10 ? 'Fail' : 'Pass');
    const correctiveAction = ccp.correctiveAction || '';
    const checkedBy = ccp.checkedBy || formData.checkedBy || 'QC Inspector';
    const firstLotNo = activeInputItems[0]?.lotNo || activeInputItems[0]?.lot_no || 'LOT001';

    await db.run(`
      INSERT INTO grind_ccp_monitoring (grind_id, voucher_number, lot_number, ccp_required, ccp_category, critical_limit, actual_reading, unit, status, corrective_action, checked_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [grainId, formData.sNo || formData.s_no || `VOUCH-${grainId}`, firstLotNo, ccpRequired, ccpCategory, criticalLimit, actualReading, unit, status, correctiveAction, checkedBy]);

    // Save OPRP Monitoring
    const oprpList = req.body.oprp || req.body.oprpData || [];
    if (Array.isArray(oprpList) && oprpList.length > 0) {
      for (const oprpItem of oprpList) {
        await db.run(`
          INSERT INTO grind_oprp_monitoring (grind_id, voucher_number, date, material, rm_fg, lot_number, quantity, alp, g, checked_by, remarks, alp_gram)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          grainId,
          formData.sNo || formData.s_no,
          oprpItem.date || formData.date,
          oprpItem.material || activeInputItems[0]?.itemName || 'Raw Material',
          oprpItem.rmFg || oprpItem.rm_fg || 'RM',
          oprpItem.lotNo || oprpItem.lot_number || firstLotNo,
          parseFloat(oprpItem.quantity) || parseFloat(activeInputItems[0]?.qty) || 0,
          oprpItem.alp ? 1 : 0,
          oprpItem.g ? 1 : 0,
          oprpItem.checkedBy || checkedBy,
          oprpItem.remarks || '',
          parseFloat(oprpItem.alpGram || oprpItem.alp_gram) || 0
        ]);
      }
    } else if (activeInputItems.length > 0) {
      for (const inItem of activeInputItems) {
        await db.run(`
          INSERT INTO grind_oprp_monitoring (grind_id, voucher_number, date, material, rm_fg, lot_number, quantity, alp, g, checked_by, remarks, alp_gram)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?)
        `, [
          grainId,
          formData.sNo || formData.s_no,
          formData.date,
          inItem.itemName || inItem.item_name,
          'RM',
          inItem.lotNo || inItem.lot_no,
          parseFloat(inItem.qty) || 0,
          checkedBy,
          'Verified during production',
          0
        ]);
      }
    }

    // Save Production Verification
    const verif = req.body.verification || req.body.verificationData || {};
    const operator = verif.operator || formData.operator || 'Operator 1';
    const shift = verif.shift || 'Shift-A (06:00 AM - 02:00 PM)';
    const productionIncharge = verif.productionIncharge || 'Production Incharge';
    const qcTechnologist = verif.qcTechnologist || 'QC Technologist J.V.N.';
    const qaManager = verif.qaManager || 'QA Manager';
    const finalApproval = verif.finalApproval || 'APPROVED';
    const verifRemarks = verif.remarks || formData.remarks || '';

    await db.run(`
      INSERT INTO grind_production_verification (grind_id, voucher_number, operator, shift, production_incharge, qc_technologist, qa_manager, final_approval, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [grainId, formData.sNo || formData.s_no, operator, shift, productionIncharge, qcTechnologist, qaManager, finalApproval, verifRemarks]);

    // Save Operator Log
    await db.run(`
      INSERT INTO grind_operator_log (grind_id, voucher_number, lot_number, operator, shift, action)
      VALUES (?, ?, ?, ?, ?, 'GRIND_CREATED')
    `, [grainId, formData.sNo || formData.s_no, firstLotNo, operator, shift]);

    // If linked to a Work Order, update work order status and final actuals
    if (workOrderId) {
      try {
        const totalOutQty = activeOutputItems.reduce((sum, it) => sum + (parseFloat(it.qty) || 0), 0);
        const totalOutWt = activeOutputItems.reduce((sum, it) => sum + (parseFloat(it.totalWt || it.total_wt) || 0), 0);
        
        let rejWt = 0, elevWt = 0, wasteFlourWt = 0, sieveFlourWt = 0;
        activeWastageItems.forEach(w => {
          const wt = parseFloat(w.totalWt || w.total_wt) || (parseFloat(w.weight) * parseFloat(w.qty)) || 0;
          const cat = (w.category || w.itemName || w.item_name || '').toLowerCase();
          if (cat.includes('rejection')) rejWt += wt;
          else if (cat.includes('elevator')) elevWt += wt;
          else if (cat.includes('waste flour') || cat.includes('flour waste')) wasteFlourWt += wt;
          else if (cat.includes('sieve flour') || cat.includes('sieving')) sieveFlourWt += wt;
        });

        await db.run(`
          UPDATE work_orders SET
            status = 'COMPLETED',
            grind_id = ?,
            actual_output_qty = ?,
            actual_output_wt = ?,
            rejection_wt = CASE WHEN ? > 0 THEN ? ELSE rejection_wt END,
            elevator_wt = CASE WHEN ? > 0 THEN ? ELSE elevator_wt END,
            waste_flour_wt = CASE WHEN ? > 0 THEN ? ELSE waste_flour_wt END,
            sieve_flour_wt = CASE WHEN ? > 0 THEN ? ELSE sieve_flour_wt END,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [grainId, totalOutQty, totalOutWt, rejWt, rejWt, elevWt, elevWt, wasteFlourWt, wasteFlourWt, sieveFlourWt, sieveFlourWt, workOrderId]);
      } catch (woErr) {
        console.error('Error updating linked work order on grind create:', woErr);
      }
    }

    try {
      await rebuildStockLedger();
    } catch (e) {
      console.error('Error rebuilding stock after saving grains:', e);
    }

    res.status(201).json({
      success: true,
      message: 'Grains & Food Safety record saved successfully!',
=======
// POST create new grains record
router.post('/', async (req, res) => {
  try {
    const { formData, inputItems, outputItems } = req.body

    // Insert grain
    const grainResult = await db.run(`
      INSERT INTO grains (s_no, flour_mill, date, remarks)
      VALUES (?, ?, ?, ?)
    `, [formData.sNo, formData.flourMill, formData.date, formData.remarks])

    const grainId = grainResult.lastID

    // Insert input items
    for (const item of inputItems) {
      await db.run(`
        INSERT INTO grain_input_items (grain_id, item_name, lot_no, weight, qty, total_wt, wages_kg, total_wages)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [grainId, item.itemName, item.lotNo, item.weight, item.qty, item.totalWt, item.wagesKg, item.totalWages])
    }

    // Insert output items
    for (const item of outputItems) {
      await db.run(`
        INSERT INTO grain_output_items (grain_id, item_name, weight, qty, total_wt)
        VALUES (?, ?, ?, ?, ?)
      `, [grainId, item.itemName, item.weight, item.qty, item.totalWt])
    }

    res.status(201).json({
      message: 'Grains record saved successfully!',
>>>>>>> origin/main
      id: grainId
    })
  } catch (error) {
    console.error('Error saving grains:', error)
<<<<<<< HEAD
    res.status(500).json({ success: false, message: 'Error saving grains', error: error.message })
=======
    res.status(500).json({ message: 'Error saving grains', error: error.message })
>>>>>>> origin/main
  }
})

// PUT update grains record
router.put('/:id', async (req, res) => {
  try {
<<<<<<< HEAD
    const { formData, inputItems, outputItems, wastageItems } = req.body
    const grainId = req.params.id

    // Revert existing stock / lots first
    await revertGrainsStock(grainId);

=======
    const { formData, inputItems, outputItems } = req.body
    const grainId = req.params.id

>>>>>>> origin/main
    // Update grain
    await db.run(`
      UPDATE grains SET s_no = ?, flour_mill = ?, date = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
<<<<<<< HEAD
    `, [formData.sNo || formData.s_no, formData.flourMill || formData.flour_mill, formData.date, formData.remarks, grainId])
=======
    `, [formData.sNo, formData.flourMill, formData.date, formData.remarks, grainId])
>>>>>>> origin/main

    // Delete existing items
    await db.run('DELETE FROM grain_input_items WHERE grain_id = ?', [grainId])
    await db.run('DELETE FROM grain_output_items WHERE grain_id = ?', [grainId])
<<<<<<< HEAD
    await db.run('DELETE FROM grain_wastage_items WHERE grain_id = ?', [grainId])

    // Filter out blank rows
    const activeInputItems = (inputItems || []).filter(item => (item.itemName || item.item_name));
    const activeOutputItems = (outputItems || []).filter(item => (item.itemName || item.item_name));
    const activeWastageItems = (wastageItems || []).filter(item => (item.itemName || item.item_name));

    // Insert updated input items
    for (const item of activeInputItems) {
      await db.run(`
        INSERT INTO grain_input_items (grain_id, item_name, lot_no, weight, qty, total_wt, rate, wages_kg, total_wages, supplier_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        grainId, 
        item.itemName || item.item_name, 
        item.lotNo || item.lot_no, 
        item.weight, 
        item.qty, 
        item.totalWt || item.total_wt, 
        item.rate || 0,
        item.wagesKg || 0, 
        item.totalWages || 0,
        item.supplierName || item.supplier_name || item.supplier || ''
      ])
    }

    // Track allocated lot numbers in-memory to prevent duplicates
    const allocatedLots = [];

    // Insert updated output items with auto-generated lot numbers
    for (const item of activeOutputItems) {
      let lotNo = item.lotNo || item.lot_no || '';
      if (!lotNo || lotNo.trim() === '') {
        lotNo = await generateNextLotNo(allocatedLots);
      }
      item.lotNo = lotNo;
      item.lot_no = lotNo;
      allocatedLots.push(lotNo);

      await db.run(`
        INSERT INTO grain_output_items (grain_id, item_name, lot_no, weight, qty, total_wt)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        grainId, 
        item.itemName || item.item_name, 
        lotNo, 
        item.weight, 
        item.qty, 
        item.totalWt || item.total_wt
      ])
    }

    // Insert updated wastage items with auto-generated lot numbers
    for (const item of activeWastageItems) {
      let lotNo = item.lotNo || item.lot_no || '';
      if (!lotNo || lotNo.trim() === '') {
        lotNo = await generateNextLotNo(allocatedLots);
      }
      item.lotNo = lotNo;
      item.lot_no = lotNo;
      allocatedLots.push(lotNo);

      await db.run(`
        INSERT INTO grain_wastage_items (grain_id, item_name, lot_no, weight, qty, total_wt, category)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        grainId, 
        item.itemName || item.item_name, 
        lotNo, 
        item.weight, 
        item.qty, 
        item.totalWt || item.total_wt,
        item.category || item.ccpCategory || ''
      ])
    }

    // Apply new stock changes using filtered active rows
    await deductGrainsInputStock(grainId, formData.date, activeInputItems);
    await addGrainsOutputStock(grainId, formData.date, activeOutputItems);
    await addGrainsWastageStock(grainId, formData.date, activeWastageItems);

    // Delete existing FSMS records for this grainId
    await db.run('DELETE FROM grind_ccp_monitoring WHERE grind_id = ?', [grainId]);
    await db.run('DELETE FROM grind_oprp_monitoring WHERE grind_id = ?', [grainId]);
    await db.run('DELETE FROM grind_production_verification WHERE grind_id = ?', [grainId]);

    // Re-insert updated CCP Monitoring
    const ccp = req.body.ccp || req.body.ccpData || {};
    const ccpRequired = ccp.ccpRequired !== undefined ? (ccp.ccpRequired ? 1 : 0) : 1;
    const ccpCategory = ccp.ccpCategory || ccp.category || 'Sortex Machine / Sieving';
    const criticalLimit = ccp.criticalLimit || '5.5 g/MT';
    const actualReading = parseFloat(ccp.actualReading) || 0;
    const unit = ccp.unit || 'g/MT';
    const status = ccp.status || (actualReading > 10 ? 'Fail' : 'Pass');
    const correctiveAction = ccp.correctiveAction || '';
    const checkedBy = ccp.checkedBy || formData.checkedBy || 'QC Inspector';
    const firstLotNo = activeInputItems[0]?.lotNo || activeInputItems[0]?.lot_no || 'LOT001';

    await db.run(`
      INSERT INTO grind_ccp_monitoring (grind_id, voucher_number, lot_number, ccp_required, ccp_category, critical_limit, actual_reading, unit, status, corrective_action, checked_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [grainId, formData.sNo || formData.s_no || `VOUCH-${grainId}`, firstLotNo, ccpRequired, ccpCategory, criticalLimit, actualReading, unit, status, correctiveAction, checkedBy]);

    // Re-insert updated OPRP Monitoring
    const oprpList = req.body.oprp || req.body.oprpData || [];
    if (Array.isArray(oprpList) && oprpList.length > 0) {
      for (const oprpItem of oprpList) {
        await db.run(`
          INSERT INTO grind_oprp_monitoring (grind_id, voucher_number, date, material, rm_fg, lot_number, quantity, alp, g, checked_by, remarks, alp_gram)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          grainId,
          formData.sNo || formData.s_no,
          oprpItem.date || formData.date,
          oprpItem.material || activeInputItems[0]?.itemName || 'Raw Material',
          oprpItem.rmFg || oprpItem.rm_fg || 'RM',
          oprpItem.lotNo || oprpItem.lot_number || firstLotNo,
          parseFloat(oprpItem.quantity) || parseFloat(activeInputItems[0]?.qty) || 0,
          oprpItem.alp ? 1 : 0,
          oprpItem.g ? 1 : 0,
          oprpItem.checkedBy || checkedBy,
          oprpItem.remarks || '',
          parseFloat(oprpItem.alpGram || oprpItem.alp_gram) || 0
        ]);
      }
    } else if (activeInputItems.length > 0) {
      for (const inItem of activeInputItems) {
        await db.run(`
          INSERT INTO grind_oprp_monitoring (grind_id, voucher_number, date, material, rm_fg, lot_number, quantity, alp, g, checked_by, remarks, alp_gram)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?)
        `, [
          grainId,
          formData.sNo || formData.s_no,
          formData.date,
          inItem.itemName || inItem.item_name,
          'RM',
          inItem.lotNo || inItem.lot_no,
          parseFloat(inItem.qty) || 0,
          checkedBy,
          'Verified during production',
          0
        ]);
      }
    }

    // Re-insert updated Production Verification
    const verif = req.body.verification || req.body.verificationData || {};
    const operator = verif.operator || formData.operator || 'Operator 1';
    const shift = verif.shift || 'Shift-A (06:00 AM - 02:00 PM)';
    const productionIncharge = verif.productionIncharge || 'Production Incharge';
    const qcTechnologist = verif.qcTechnologist || 'QC Technologist J.V.N.';
    const qaManager = verif.qaManager || 'QA Manager';
    const finalApproval = verif.finalApproval || 'APPROVED';
    const verifRemarks = verif.remarks || formData.remarks || '';

    await db.run(`
      INSERT INTO grind_production_verification (grind_id, voucher_number, operator, shift, production_incharge, qc_technologist, qa_manager, final_approval, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [grainId, formData.sNo || formData.s_no, operator, shift, productionIncharge, qcTechnologist, qaManager, finalApproval, verifRemarks]);

    // Save Operator Log
    await db.run(`
      INSERT INTO grind_operator_log (grind_id, voucher_number, lot_number, operator, shift, action)
      VALUES (?, ?, ?, ?, ?, 'GRIND_UPDATED')
    `, [grainId, formData.sNo || formData.s_no, firstLotNo, operator, shift]);

    try {
      await rebuildStockLedger();
    } catch (e) {
      console.error('Error rebuilding stock after updating grains:', e);
    }

    res.json({ success: true, message: 'Grains & Food Safety record updated successfully!' })
  } catch (error) {
    console.error('Error updating grains:', error)
    res.status(500).json({ success: false, message: 'Error updating grains', error: error.message })
=======

    // Insert updated input items
    for (const item of inputItems) {
      await db.run(`
        INSERT INTO grain_input_items (grain_id, item_name, lot_no, weight, qty, total_wt, wages_kg, total_wages)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [grainId, item.itemName, item.lotNo, item.weight, item.qty, item.totalWt, item.wagesKg, item.totalWages])
    }

    // Insert updated output items
    for (const item of outputItems) {
      await db.run(`
        INSERT INTO grain_output_items (grain_id, item_name, weight, qty, total_wt)
        VALUES (?, ?, ?, ?, ?)
      `, [grainId, item.itemName, item.weight, item.qty, item.totalWt])
    }

    res.json({ message: 'Grains record updated successfully!' })
  } catch (error) {
    console.error('Error updating grains:', error)
    res.status(500).json({ message: 'Error updating grains' })
>>>>>>> origin/main
  }
})

// DELETE grains record
router.delete('/:id', async (req, res) => {
  try {
<<<<<<< HEAD
    const grainId = req.params.id

    // Revert stock / lots associated with this grain record
    await revertGrainsStock(grainId);

    // Delete items manually to be safe
    await db.run('DELETE FROM grain_input_items WHERE grain_id = ?', [grainId])
    await db.run('DELETE FROM grain_output_items WHERE grain_id = ?', [grainId])
    await db.run('DELETE FROM grain_wastage_items WHERE grain_id = ?', [grainId])
    await db.run('DELETE FROM grind_ccp_monitoring WHERE grind_id = ?', [grainId])
    await db.run('DELETE FROM grind_oprp_monitoring WHERE grind_id = ?', [grainId])
    await db.run('DELETE FROM grind_production_verification WHERE grind_id = ?', [grainId])
    await db.run('DELETE FROM grind_operator_log WHERE grind_id = ?', [grainId])

    // Delete grain record
    await db.run('DELETE FROM grains WHERE id = ?', [grainId])

    try {
      await rebuildStockLedger();
    } catch (e) {
      console.error('Error rebuilding stock after deleting grains:', e);
    }

    res.json({ success: true, message: 'Grains record deleted successfully' })
  } catch (error) {
    console.error('Error deleting grains:', error)
    res.status(500).json({ success: false, message: 'Error deleting grains' })
=======
    await db.run('DELETE FROM grains WHERE id = ?', [req.params.id])
    res.json({ message: 'Grains record deleted successfully' })
  } catch (error) {
    console.error('Error deleting grains:', error)
    res.status(500).json({ message: 'Error deleting grains' })
>>>>>>> origin/main
  }
})

module.exports = router
