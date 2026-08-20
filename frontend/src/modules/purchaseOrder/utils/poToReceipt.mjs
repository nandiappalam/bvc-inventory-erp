export const buildReceiptDraftFromPurchaseOrder = (order = {}) => {
  const items = Array.isArray(order.items) ? order.items : [];

  return {
    sourcePurchaseOrderId: Number(order.id || 0) || null,
    formData: {
      supplier_id: order.supplierId || order.supplier || '',
      supplier_details: order.supplierAddress || '',
      date: order.date || '',
      remarks: order.remarks || '',
      source_order_no: order.orderNo || '',
      source_order_id: Number(order.id || 0) || '',
    },
    tableData: items.map((item) => ({
      item_name: item.itemName || item.item_name || '',
      qty: Number(item.qty || 0),
      rate: Number(item.rate || 0),
      per_unit_weight: Number(item.perUnitWeight || item.per_unit_weight || 0),
      total_weight: Number((Number(item.qty || 0) * Number(item.perUnitWeight || item.per_unit_weight || 0)).toFixed(3)),
      amount: Number((Number(item.qty || 0) * Number(item.rate || 0)).toFixed(2)),
      disc_percent: 0,
      tax_rate: 0,
      lot_no: '',
    })),
  };
};
