const purchaseOrderService = require('./purchaseOrderService');

exports.getNextPurchaseOrderSNo = async (req, res) => {
    try {
        const nextSNo = await purchaseOrderService.generateNextPurchaseOrderSNo();
        res.status(200).json({ success: true, next_sno: nextSNo });
    } catch (error) {
        console.error('Error getting next Purchase Order S.No:', error);
        res.status(500).json({ success: false, message: 'Failed to get next Purchase Order S.No', error: error.message });
    }
};

exports.createPurchaseOrder = async (req, res) => {
    try {
        const { formData, items, deductions } = req.body;
        if (!formData || !items || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Missing form data or items' });
        }
        const newPurchaseOrder = await purchaseOrderService.createPurchaseOrder(formData, items, deductions);
        res.status(201).json({ success: true, message: 'Purchase Order created successfully', data: newPurchaseOrder });
    } catch (error) {
        console.error('Error creating Purchase Order:', error);
        res.status(500).json({ success: false, message: 'Failed to create Purchase Order', error: error.message });
    }
};

const db = require('../config/database');

async function createPurchaseOrder(req, res) {
  const companyId = req.companyId || req.body.company_id;
  
  if (!companyId) {
    return res.status(400).json({ success: false, message: 'Company context is required.' });
  }

  const { po_number, supplier_id, order_date, total_amount, items, pr_id } = req.body;

  try {
    // 1. Insert Parent Purchase Order
    const parentSql = `
      INSERT INTO purchase_orders (company_id, po_number, supplier_id, order_date, total_amount, purchase_request_id)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    const parentParams = [companyId, po_number, supplier_id, order_date, total_amount, pr_id || null];

    // CRITICAL FIX: Use insertAndGetId to capture the REAL numeric database primary key
    const poId = await db.insertAndGetId(parentSql, parentParams, 'id');

    // 2. Insert Line Items using the valid poId
    if (items && items.length > 0) {
      for (const item of items) {
        const itemSql = `
          INSERT INTO purchase_order_items (purchase_order_id, item_id, quantity, unit_price, line_total)
          VALUES ($1, $2, $3, $4, $5)
        `;
        await db.query(itemSql, [poId, item.item_id, item.quantity, item.unit_price, item.line_total]);
      }
    }

    // 3. Return HTTP 201 with created PO ID
    return res.status(201).json({
      success: true,
      message: 'Purchase Order created successfully',
      data: { id: poId, po_number }
    });

  } catch (error) {
    console.error('[PO Create Error]:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
}
exports.getPurchaseOrders = async (req, res) => {
    try {
        const { id } = req.params;
        let purchaseOrders;
        if (id) {
            purchaseOrders = await purchaseOrderService.getPurchaseOrderById(id);
            if (!purchaseOrders) {
                return res.status(404).json({ success: false, message: 'Purchase Order not found' });
            }
        } else {
            purchaseOrders = await purchaseOrderService.getAllPurchaseOrders();
        }
        res.status(200).json({ success: true, data: purchaseOrders });
    } catch (error) {
        console.error('Error fetching Purchase Orders:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch Purchase Orders', error: error.message });
    }
};
async function getPurchaseOrders(req, res) {
  const companyId = req.companyId || req.query.company_id;

  try {
    const sql = `
      SELECT po.*, s.supplier_name 
      FROM purchase_orders po
      LEFT JOIN supplier_master s ON po.supplier_id = s.id
      WHERE po.company_id = $1
      ORDER BY po.id DESC
    `;
    const orders = await db.query(sql, [companyId]);

    return res.status(200).json({
      success: true,
      data: orders
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
exports.updatePurchaseOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { formData, items, deductions } = req.body;
        if (!formData || !items || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Missing form data or items' });
        }
        const updatedPurchaseOrder = await purchaseOrderService.updatePurchaseOrder(id, formData, items, deductions);
        if (!updatedPurchaseOrder) {
            return res.status(404).json({ success: false, message: 'Purchase Order not found' });
        }
        res.status(200).json({ success: true, message: 'Purchase Order updated successfully', data: updatedPurchaseOrder });
    } catch (error) {
        console.error('Error updating Purchase Order:', error);
        res.status(500).json({ success: false, message: 'Failed to update Purchase Order', error: error.message });
    }
};

exports.deletePurchaseOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await purchaseOrderService.deletePurchaseOrder(id);
        if (!deleted) return res.status(404).json({ success: false, message: 'Purchase Order not found' });
        res.status(200).json({ success: true, message: 'Purchase Order deleted successfully' });
    } catch (error) {
        console.error('Error deleting Purchase Order:', error);
        res.status(500).json({ success: false, message: 'Failed to delete Purchase Order', error: error.message });
    }
};