const db = require('../config/database');
const { logEvent } = require('./AuditService');

class WarehouseOpsService {
  /**
   * Mobile Dashboard Overview
   */
  async getDashboardData() {
    const godownsRes = await db.query('SELECT * FROM godown_master ORDER BY godown_name ASC');
    const godowns = godownsRes.rows || [];

    const stockSumRes = await db.query('SELECT SUM(COALESCE(weight, qty, 0)) as tot_qty, COUNT(DISTINCT item_id) as tot_items FROM stock');
    const totalStockKg = parseFloat(stockSumRes.rows[0]?.tot_qty || 0);

    const pendingFulfillRes = await db.query("SELECT COUNT(*) as cnt FROM customer_order_fulfillment WHERE status IN ('READY_FOR_DISPATCH', 'PACKING_PENDING')");
    const pendingDispatches = parseInt(pendingFulfillRes.rows[0]?.cnt || 0, 10);

    const recentLogsRes = await db.query('SELECT * FROM warehouse_mobile_logs ORDER BY id DESC LIMIT 10');

    return {
      godowns,
      totalStockKg,
      totalStockMT: Number((totalStockKg / 1000).toFixed(2)),
      totalItemsInStock: parseInt(stockSumRes.rows[0]?.tot_items || 0, 10),
      pendingDispatches,
      recentLogs: recentLogsRes.rows || []
    };
  }

  /**
   * Process Stock Receive
   */
  async processReceive(data) {
    const {
      itemName,
      lotNo,
      qty,
      uom = 'KG',
      godownName = 'Main Godown',
      locationCode = 'G1-R1-P1',
      operatorName = 'Operator 1',
      remarks = ''
    } = data;

    if (!itemName || !qty || !lotNo) {
      throw new Error('Item name, Lot number, and Quantity are required.');
    }

    const quantity = parseFloat(qty);

    // Record operational log
    const res = await db.run(`
      INSERT INTO warehouse_mobile_logs (
        transaction_type, item_name, lot_no, qty, uom, dest_godown, location_code, operator_name, remarks
      ) VALUES ('RECEIVE', ?, ?, ?, ?, ?, ?, ?, ?)
    `, [itemName, lotNo, quantity, uom, godownName, locationCode, operatorName, remarks]);

    // Audit log
    await logEvent({
      entityType: 'WAREHOUSE_OPS',
      entityId: String(res.lastID),
      action: 'RECEIVE',
      details: `Received ${quantity} ${uom} of ${itemName} (Lot: ${lotNo}) at ${godownName} [${locationCode}]`,
      createdBy: operatorName
    });

    return { success: true, id: res.lastID };
  }

  /**
   * Process Stock Issue
   */
  async processIssue(data) {
    const {
      lotNo,
      itemName,
      qty,
      uom = 'KG',
      sourceGodown = 'Main Godown',
      purpose = 'Production Grinding',
      operatorName = 'Operator 1',
      remarks = ''
    } = data;

    if (!lotNo || !qty) {
      throw new Error('Lot number and Quantity are required.');
    }

    const quantity = parseFloat(qty);

    const res = await db.run(`
      INSERT INTO warehouse_mobile_logs (
        transaction_type, item_name, lot_no, qty, uom, source_godown, purpose, operator_name, remarks
      ) VALUES ('ISSUE', ?, ?, ?, ?, ?, ?, ?, ?)
    `, [itemName || 'Raw Material', lotNo, quantity, uom, sourceGodown, purpose, operatorName, remarks]);

    await logEvent({
      entityType: 'WAREHOUSE_OPS',
      entityId: String(res.lastID),
      action: 'ISSUE',
      details: `Issued ${quantity} ${uom} of Lot ${lotNo} for ${purpose} from ${sourceGodown}`,
      createdBy: operatorName
    });

    return { success: true, id: res.lastID };
  }

  /**
   * Process Stock Transfer between Godowns / Locations
   */
  async processTransfer(data) {
    const {
      lotNo,
      itemName,
      qty,
      uom = 'KG',
      sourceGodown,
      destGodown,
      locationCode = '',
      operatorName = 'Operator 1',
      remarks = ''
    } = data;

    if (!lotNo || !qty || !destGodown) {
      throw new Error('Lot number, Quantity, and Destination Godown are required.');
    }

    const quantity = parseFloat(qty);

    const res = await db.run(`
      INSERT INTO warehouse_mobile_logs (
        transaction_type, item_name, lot_no, qty, uom, source_godown, dest_godown, location_code, operator_name, remarks
      ) VALUES ('TRANSFER', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [itemName || 'Transferred Item', lotNo, quantity, uom, sourceGodown || 'Main Godown', destGodown, locationCode, operatorName, remarks]);

    await logEvent({
      entityType: 'WAREHOUSE_OPS',
      entityId: String(res.lastID),
      action: 'TRANSFER',
      details: `Transferred ${quantity} ${uom} of Lot ${lotNo} from ${sourceGodown} to ${destGodown}`,
      createdBy: operatorName
    });

    return { success: true, id: res.lastID };
  }

  /**
   * Quick Stock Lookup by Query
   */
  async stockLookup(query) {
    if (!query) return [];

    const searchStr = `%${query.trim()}%`;
    const stockLots = await db.query(`
      SELECT 
        sl.lot_no,
        sl.quantity,
        sl.unit,
        sl.qc_status,
        sl.godown_id,
        COALESCE(g.godown_name, 'Main Godown') as godown_name,
        COALESCE(i.item_name, sl.lot_no) as item_name
      FROM stock_lots sl
      LEFT JOIN godown_master g ON sl.godown_id = g.id
      LEFT JOIN item_master i ON sl.item_id = i.id
      WHERE sl.lot_no LIKE ? OR i.item_name LIKE ? OR g.godown_name LIKE ?
      LIMIT 25
    `, [searchStr, searchStr, searchStr]);

    return stockLots.rows || [];
  }

  /**
   * Process Dispatch
   */
  async processDispatch(data) {
    const {
      orderId,
      vehicleNo,
      driverName,
      driverPhone = '',
      dispatchNotes = '',
      operatorName = 'Operator 1'
    } = data;

    if (!vehicleNo) throw new Error('Vehicle number is required for dispatch.');

    if (orderId) {
      // Update customer_order_fulfillment
      await db.run(`
        UPDATE customer_order_fulfillment
        SET dispatch_vehicle_no = ?, driver_name = ?, driver_phone = ?, status = 'DISPATCHED', progress_pct = 90
        WHERE id = ?
      `, [vehicleNo, driverName, driverPhone, orderId]);

      // Complete stage
      await db.run(`
        UPDATE order_fulfillment_stages
        SET is_completed = 1, completed_at = CURRENT_TIMESTAMP, completed_by = ?, remarks = ?
        WHERE order_id = ? AND stage_key = 'DISPATCHED'
      `, [operatorName, `Vehicle ${vehicleNo} assigned`, orderId]);
    }

    const res = await db.run(`
      INSERT INTO warehouse_mobile_logs (
        transaction_type, item_name, lot_no, qty, uom, dest_godown, operator_name, remarks
      ) VALUES ('DISPATCH', 'Order Dispatch', ?, 0, 'ORDERS', ?, ?, ?)
    `, [orderId ? `Order #${orderId}` : 'Adhoc', vehicleNo, operatorName, dispatchNotes]);

    return { success: true, id: res.lastID };
  }
}

module.exports = new WarehouseOpsService();
