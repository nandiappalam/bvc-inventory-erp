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

        try {
            const { triggerTransactionNotification } = require('../utils/transactionNotifier');
            const poNo = newPurchaseOrder.inv_no || formData.inv_no || formData.invNo || `PO-${newPurchaseOrder.s_no || newPurchaseOrder.id}`;
            const supplierName = formData.supplier_name || formData.supplierName || formData.supplier || 'Supplier';
            const itemDesc = items.filter(i => i.item_name || i.itemName).map(i => `${i.qty || 0} ${i.item_name || i.itemName}`).slice(0, 3).join(', ') || 'Ordered Goods';
            const totalQty = items.reduce((s, i) => s + (parseFloat(i.qty) || 0), 0);
            const totalAmt = parseFloat(formData.total_amt || formData.totAmt || formData.amount || 0);
            await triggerTransactionNotification({
                eventType: 'ORDER_CREATED',
                moduleName: 'PURCHASE_ORDER',
                referenceNo: poNo,
                referenceId: newPurchaseOrder.id,
                companyId: req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1),
                title: `📋 PURCHASE ORDER CREATED – ${poNo}`,
                message: `Supplier: ${supplierName} | ${itemDesc} | Qty: ${totalQty} | Amount: ₹${totalAmt}`,
                severity: 'INFO',
                details: {
                    reference_no: poNo,
                    action_label: 'PURCHASE ORDER',
                    party_name: supplierName,
                    item_summary: itemDesc,
                    quantity: `${totalQty} Bags`,
                    amount: totalAmt,
                    status: 'ISSUED',
                    created_by: req.user?.username || 'Purchase Desk',
                    date: formData.po_date || formData.poDate || formData.date
                }
            });
        } catch (notifErr) {
            console.warn('Notification warning (Purchase Order):', notifErr.message);
        }

        res.status(201).json({ success: true, message: 'Purchase Order created successfully', data: newPurchaseOrder });
    } catch (error) {
        console.error('Error creating Purchase Order:', error);
        res.status(500).json({ success: false, message: 'Failed to create Purchase Order', error: error.message });
    }
};

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
        try {
            const { triggerTransactionNotification } = require('../utils/transactionNotifier');
            const poNo = updatedPurchaseOrder.inv_no || formData.inv_no || formData.invNo || `PO-${updatedPurchaseOrder.s_no || id}`;
            const supplierName = formData.supplier_name || formData.supplierName || formData.supplier || 'Supplier';
            const itemDesc = items.filter(i => i.item_name || i.itemName).map(i => `${i.qty || 0} ${i.item_name || i.itemName}`).slice(0, 3).join(', ') || 'Ordered Goods';
            const totalQty = items.reduce((s, i) => s + (parseFloat(i.qty) || 0), 0);
            const totalAmt = parseFloat(formData.total_amt || formData.totAmt || formData.amount || 0);
            await triggerTransactionNotification({
                eventType: 'ORDER_UPDATED',
                isUpdate: true,
                moduleName: 'PURCHASE_ORDER',
                referenceNo: poNo,
                referenceId: updatedPurchaseOrder.id || id,
                companyId: req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1),
                title: `✏️ PURCHASE ORDER UPDATED – ${poNo}`,
                message: `Updated PO | Supplier: ${supplierName} | ${itemDesc} | Qty: ${totalQty} | Amount: ₹${totalAmt}`,
                severity: 'INFO',
                details: {
                    reference_no: poNo,
                    action_label: 'PURCHASE ORDER',
                    party_name: supplierName,
                    item_summary: itemDesc,
                    quantity: `${totalQty} Bags`,
                    amount: totalAmt,
                    status: 'UPDATED',
                    updated_by: req.user?.username || 'Purchase Desk',
                    created_by: req.user?.username || 'Purchase Desk',
                    date: formData.po_date || formData.poDate || formData.date
                }
            });
        } catch (notifErr) {
            console.warn('Notification warning (Purchase Order Update):', notifErr.message);
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