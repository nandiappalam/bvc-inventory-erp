const db = require('../config/database');
const { logEvent } = require('./AuditService');

const DEFAULT_STAGES = [
  { key: 'ORDER_CONFIRMED', label: 'Order Confirmed', order: 1 },
  { key: 'STOCK_ALLOCATED', label: 'Stock Allocated / Reserved', order: 2 },
  { key: 'PRODUCTION_COMPLETED', label: 'Production Completed', order: 3 },
  { key: 'QC_PASSED', label: 'QC Inspection Passed', order: 4 },
  { key: 'PACKING_COMPLETED', label: 'Packing & Bagging Done', order: 5 },
  { key: 'VEHICLE_ASSIGNED', label: 'Vehicle & Driver Assigned', order: 6 },
  { key: 'DISPATCHED', label: 'Dispatched from Warehouse', order: 7 },
  { key: 'INVOICED', label: 'Tax Invoice Generated', order: 8 }
];

class OrderFulfillmentService {
  /**
   * Get Fulfillment Dashboard Summary & KPI metrics
   */
  async getDashboardStats() {
    const ordersRes = await db.query('SELECT * FROM customer_order_fulfillment ORDER BY id DESC');
    const orders = ordersRes.rows || [];

    const totalOrders = orders.length;
    const inProgressCount = orders.filter(o => !['COMPLETED', 'CANCELLED', 'DISPATCHED'].includes(o.status)).length;
    const readyForDispatchCount = orders.filter(o => o.status === 'READY_FOR_DISPATCH').length;
    const dispatchedCount = orders.filter(o => o.status === 'DISPATCHED' || o.status === 'COMPLETED').length;

    // Exception detection: Overdue dispatch or QC hold
    const nowStr = new Date().toISOString().split('T')[0];
    const exceptions = orders.filter(o => {
      const isOverdue = o.target_delivery_date < nowStr && !['COMPLETED', 'DISPATCHED', 'CANCELLED'].includes(o.status);
      const isQcHold = o.status === 'QC_HOLD';
      const isStockShortage = o.status === 'STOCK_PENDING';
      return isOverdue || isQcHold || isStockShortage;
    });

    // Stock reservations sum
    const resvSumRes = await db.query("SELECT SUM(reserved_qty_kg) as tot_resv FROM order_stock_reservations WHERE status = 'RESERVED'");
    const totalReservedKg = parseFloat(resvSumRes.rows[0]?.tot_resv || 0);

    return {
      totalOrders,
      inProgressCount,
      readyForDispatchCount,
      dispatchedCount,
      exceptionsCount: exceptions.length,
      totalReservedKg,
      totalReservedMT: Number((totalReservedKg / 1000).toFixed(2))
    };
  }

  /**
   * Get all Orders with Stages & Reservations
   */
  async getOrderList() {
    const ordersRes = await db.query('SELECT * FROM customer_order_fulfillment ORDER BY order_date DESC, id DESC');
    const orders = ordersRes.rows || [];

    const stagesRes = await db.query('SELECT * FROM order_fulfillment_stages ORDER BY stage_order ASC');
    const allStages = stagesRes.rows || [];

    const resvRes = await db.query("SELECT * FROM order_stock_reservations WHERE status = 'RESERVED'");
    const allReservations = resvRes.rows || [];

    const nowStr = new Date().toISOString().split('T')[0];

    return orders.map(ord => {
      const orderStages = allStages.filter(s => s.order_id === ord.id);
      const completedCount = orderStages.filter(s => s.is_completed === 1).length;
      const progress = orderStages.length > 0 ? Math.round((completedCount / orderStages.length) * 100) : (ord.progress_pct || 0);

      // Exceptions check
      const exceptions = [];
      if (ord.target_delivery_date < nowStr && !['COMPLETED', 'DISPATCHED', 'CANCELLED'].includes(ord.status)) {
        exceptions.push({ type: 'OVERDUE', message: 'Target delivery date exceeded' });
      }
      if (ord.status === 'QC_HOLD') {
        exceptions.push({ type: 'QC_HOLD', message: 'Held in quality quarantine' });
      }
      if (ord.status === 'STOCK_PENDING') {
        exceptions.push({ type: 'STOCK_SHORTAGE', message: 'Raw material stock shortage' });
      }

      return {
        id: ord.id,
        orderNo: ord.order_no,
        customerName: ord.customer_name,
        orderDate: ord.order_date,
        targetDeliveryDate: ord.target_delivery_date,
        totalAmount: parseFloat(ord.total_amount || 0),
        itemsSummary: ord.items_summary,
        status: ord.status,
        progressPct: progress,
        dispatchVehicleNo: ord.dispatch_vehicle_no,
        driverName: ord.driver_name,
        driverPhone: ord.driver_phone,
        invoiceNo: ord.invoice_no,
        notes: ord.notes,
        stages: orderStages,
        reservations: allReservations.filter(r => r.order_id === ord.id),
        exceptions,
        hasException: exceptions.length > 0
      };
    });
  }

  /**
   * Create New Customer Order for Fulfillment Tracking
   */
  async createOrder(data) {
    const {
      orderNo,
      customerName,
      orderDate,
      targetDeliveryDate,
      totalAmount = 0,
      itemsSummary = 'Urad Gotta FG - 100 Bags',
      notes = '',
      createdBy = 'Sales Coordinator'
    } = data;

    if (!customerName || !targetDeliveryDate) {
      throw new Error('Customer Name and Target Delivery Date are required.');
    }

    const generatedOrderNo = orderNo || `SO-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

    const res = await db.run(`
      INSERT INTO customer_order_fulfillment (
        order_no, customer_name, order_date, target_delivery_date, total_amount, items_summary,
        status, progress_pct, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMED', 12, ?, ?)
    `, [
      generatedOrderNo,
      customerName,
      orderDate || new Date().toISOString().split('T')[0],
      targetDeliveryDate,
      parseFloat(totalAmount || 0),
      itemsSummary,
      notes,
      createdBy
    ]);

    const orderId = res.lastID;

    // Initialize all 8 pipeline stages
    for (const stage of DEFAULT_STAGES) {
      const isFirst = stage.key === 'ORDER_CONFIRMED';
      await db.run(`
        INSERT INTO order_fulfillment_stages (
          order_id, stage_key, stage_label, stage_order, is_completed, completed_at, completed_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        orderId,
        stage.key,
        stage.label,
        stage.order,
        isFirst ? 1 : 0,
        isFirst ? new Date().toISOString() : null,
        isFirst ? createdBy : null
      ]);
    }

    // Audit log
    await logEvent({
      entityType: 'CUSTOMER_ORDER_FULFILLMENT',
      entityId: generatedOrderNo,
      action: 'CREATE',
      details: `New Customer Order registered for ${customerName} (Target: ${targetDeliveryDate})`,
      createdBy
    });

    return { id: orderId, orderNo: generatedOrderNo, success: true };
  }

  /**
   * Update Order Controlled Status
   */
  async updateStatus(orderId, newStatus, remarks = '', user = 'Sales Coordinator') {
    const validStatuses = [
      'DRAFT', 'CONFIRMED', 'STOCK_PENDING', 'PRODUCTION_PENDING',
      'PRODUCTION_IN_PROGRESS', 'QC_PENDING', 'QC_HOLD', 'PACKING_PENDING',
      'VEHICLE_PENDING', 'READY_FOR_DISPATCH', 'DISPATCHED', 'COMPLETED', 'CANCELLED'
    ];

    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status '${newStatus}'. Must be one of: ${validStatuses.join(', ')}`);
    }

    const currentRes = await db.query('SELECT * FROM customer_order_fulfillment WHERE id = ?', [orderId]);
    if (!currentRes.rows.length) throw new Error('Order not found');
    const prevStatus = currentRes.rows[0].status;

    await db.run(`
      UPDATE customer_order_fulfillment 
      SET status = ?, notes = CASE WHEN ? != '' THEN ? ELSE notes END, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [newStatus, remarks, remarks, orderId]);

    // Audit log
    await logEvent({
      entityType: 'CUSTOMER_ORDER_FULFILLMENT',
      entityId: currentRes.rows[0].order_no,
      action: 'STATUS_CHANGE',
      details: `Status updated from ${prevStatus} to ${newStatus}. ${remarks}`,
      createdBy: user
    });

    return { success: true, prevStatus, newStatus };
  }

  /**
   * Complete Pipeline Stage & Recalculate Progress %
   */
  async completeStage(orderId, stageKey, user = 'Operator', remarks = '') {
    await db.run(`
      UPDATE order_fulfillment_stages
      SET is_completed = 1, completed_at = CURRENT_TIMESTAMP, completed_by = ?, remarks = ?
      WHERE order_id = ? AND stage_key = ?
    `, [user, remarks, orderId, stageKey]);

    // Recalculate progress
    const stagesRes = await db.query('SELECT * FROM order_fulfillment_stages WHERE order_id = ?', [orderId]);
    const stages = stagesRes.rows || [];
    const completedCount = stages.filter(s => s.is_completed === 1).length;
    const progress = Math.round((completedCount / stages.length) * 100);

    // Auto-advance high level status based on completed stages
    let newStatus = 'PRODUCTION_IN_PROGRESS';
    if (stageKey === 'STOCK_ALLOCATED') newStatus = 'PRODUCTION_PENDING';
    if (stageKey === 'PRODUCTION_COMPLETED') newStatus = 'QC_PENDING';
    if (stageKey === 'QC_PASSED') newStatus = 'PACKING_PENDING';
    if (stageKey === 'PACKING_COMPLETED') newStatus = 'VEHICLE_PENDING';
    if (stageKey === 'VEHICLE_ASSIGNED') newStatus = 'READY_FOR_DISPATCH';
    if (stageKey === 'DISPATCHED') newStatus = 'DISPATCHED';
    if (stageKey === 'INVOICED' && progress === 100) newStatus = 'COMPLETED';

    await db.run(`
      UPDATE customer_order_fulfillment
      SET progress_pct = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [progress, newStatus, orderId]);

    return { success: true, stageKey, progress, newStatus };
  }

  /**
   * Order -> Stock Reservation Logic (Prevents double reservation)
   */
  async reserveStock(orderId, itemName, lotNo, qtyKg, uom = 'KG') {
    const qty = parseFloat(qtyKg);

    // 1. Check physical on-hand stock for this lot
    const lotStockRes = await db.query(`
      SELECT quantity FROM stock_lots WHERE lot_no = ?
    `, [lotNo]);
    const physicalStock = parseFloat(lotStockRes.rows[0]?.quantity || 5000);

    // 2. Check already reserved stock for this lot across all active orders
    const activeResvRes = await db.query(`
      SELECT SUM(reserved_qty_kg) as tot FROM order_stock_reservations 
      WHERE lot_no = ? AND status = 'RESERVED'
    `, [lotNo]);
    const alreadyReserved = parseFloat(activeResvRes.rows[0]?.tot || 0);

    const availableStock = Math.max(0, physicalStock - alreadyReserved);

    if (qty > availableStock) {
      throw new Error(`Reservation Failed: Available unreserved stock for lot '${lotNo}' is only ${availableStock} KG. You requested ${qty} KG.`);
    }

    const res = await db.run(`
      INSERT INTO order_stock_reservations (
        order_id, item_name, lot_no, reserved_qty_kg, uom, status
      ) VALUES (?, ?, ?, ?, ?, 'RESERVED')
    `, [orderId, itemName, lotNo, qty, uom]);

    // Automatically mark STAGE 2 (STOCK_ALLOCATED) as completed
    await this.completeStage(orderId, 'STOCK_ALLOCATED', 'Stock Controller', `Reserved ${qty} KG from Lot ${lotNo}`);

    return { id: res.lastID, success: true, reservedQty: qty, remainingAvailableStock: availableStock - qty };
  }

  /**
   * Release Stock Reservation
   */
  async releaseReservation(reservationId) {
    await db.run(`
      UPDATE order_stock_reservations 
      SET status = 'RELEASED' 
      WHERE id = ?
    `, [reservationId]);

    return { success: true };
  }
}

module.exports = new OrderFulfillmentService();
