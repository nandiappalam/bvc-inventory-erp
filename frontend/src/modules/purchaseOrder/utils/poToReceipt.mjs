export const buildReceiptDraftFromPurchaseOrder = (order = {}) => {
  const items = Array.isArray(order.items) ? order.items : [];

  return {
    sourcePurchaseOrderId: Number(order.id || 0) || null,
    formData: {
      supplier_id: order.supplierId || order.supplier_id || order.supplier || '',
      supplier_details: order.address || order.supplierAddress || '',
      address: order.address || order.supplierAddress || '',
      date: order.date || new Date().toISOString().split('T')[0],
      inv_date: order.inv_date || order.invDate || '',
      pay_type: order.pay_type || order.payType || 'Cash',
      tax_type: order.tax_type || order.taxType || 'Exclusive',
      tax_rate: order.tax_percent || order.tax_rate || 5,
      type: order.type || 'Urad',
      godown_id: order.godown_id || order.godownId || '',
      remarks: order.remarks || '',
      source_order_no: order.inv_no || order.invNo || order.orderNo || '',
      source_order_id: Number(order.id || 0) || '',
      purchase_order_id: Number(order.id || 0) || '',
      po_no: order.inv_no || order.invNo || order.orderNo || ''
    },
    tableData: items.map((item, idx) => {
      const qty = Number(item.qty || 0);
      const rate = Number(item.rate || item.purc_rate || 0);
      const weight = Number(item.weight || item.per_unit_weight || item.perUnitWeight || 0);
      const totWt = Number(item.tot_wt || item.total_weight || (qty * (weight || 1)));
      const disc = Number(item.discount_percent || item.disc_percent || 0);
      const tax = Number(item.tax_percent ?? order.tax_percent ?? order.tax_rate ?? 5);
      const baseAmt = qty * rate;
      const discAmt = baseAmt * (disc / 100);
      const taxable = baseAmt - discAmt;
      const taxAmt = (taxable * tax) / 100;
      const finalAmt = Number(item.amount) || (taxable + taxAmt);

      return {
        item_id: item.item_id || item.itemId || item.item_name || item.itemName || '',
        item_name: item.item_name || item.itemName || '',
        item_label: item.item_name || item.itemName || '',
        qty: qty,
        rate: rate,
        purc_rate: rate,
        weight: weight,
        weight_id: item.weight_id || '',
        per_unit_wt: weight,
        per_unit_weight: weight,
        tot_wt: totWt,
        total_wt: totWt,
        total_weight: totWt,
        base_amount: baseAmt,
        disc_amount: discAmt,
        tax_amount: taxAmt,
        amount: finalAmt.toFixed(2),
        disc: disc,
        disc_percent: disc,
        tax_rate: tax,
        tax_percent: tax,
        lot_no: item.lot_no || '',
        lot_status: 'reserved'
      };
    }),
    selectedDeductions: (order.deductions || []).map(d => ({
      id: d.deduction_id || d.id || '',
      deduction_id: d.deduction_id || d.id || '',
      name: d.deduction || d.deduction_name || d.name || '',
      deduction: d.deduction || d.deduction_name || d.name || '',
      amount: parseFloat(d.amount) || 0,
      type: (d.type || 'LESS').toUpperCase(),
      calculation_type: d.calculation_type || 'Percentage',
      percentage: parseFloat(d.percent || d.percentage || d.value || 0),
      percent: parseFloat(d.percent || d.percentage || d.value || 0),
      remarks: d.remarks || ''
    }))
  };
};
