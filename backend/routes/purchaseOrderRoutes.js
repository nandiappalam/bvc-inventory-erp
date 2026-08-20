const express = require('express');
const router = express.Router();
const purchaseOrderController = require('./purchaseOrderController');

// Get next S.No for Purchase Order
router.get('/purchase-orders/next-sno', purchaseOrderController.getNextPurchaseOrderSNo);

// Create a new Purchase Order
router.post('/purchase-orders', purchaseOrderController.createPurchaseOrder);

// Get all Purchase Orders or a specific one
router.get('/purchase-orders/:id?', purchaseOrderController.getPurchaseOrders);

// Update a Purchase Order
router.put('/purchase-orders/:id', purchaseOrderController.updatePurchaseOrder);

// Delete a Purchase Order
router.delete('/purchase-orders/:id', purchaseOrderController.deletePurchaseOrder);

module.exports = router;