import api from '../../../services/api';

const toForm = (dbRow) => {
  if (!dbRow) return null;
  const sNo = dbRow.s_no || dbRow.sNo || '';
  return {
    id: dbRow.id,
    sNo: sNo,
    s_no: sNo,
    invNo: dbRow.inv_no || dbRow.invNo || `PO-${sNo}`,
    invDate: dbRow.inv_date || dbRow.invDate || '',
    poDate: dbRow.po_date || dbRow.poDate || dbRow.date || '',
    date: dbRow.date || new Date().toISOString().slice(0, 10),
    payType: dbRow.pay_type || dbRow.payType || 'Cash',
    type: dbRow.type || dbRow.purchaseType || '',
    item_name: dbRow.item_name || (dbRow.items && dbRow.items.map(i => i.item_name || i.itemName).filter(Boolean).join(', ')) || dbRow.type || '',
    itemName: dbRow.item_name || (dbRow.items && dbRow.items.map(i => i.item_name || i.itemName).filter(Boolean).join(', ')) || dbRow.type || '',
    taxType: dbRow.tax_type || 'Exclusive',
    terms: dbRow.terms || '',
    fob: dbRow.fob || '',
    shipVia: dbRow.ship_via || dbRow.shipVia || '',
    sign: dbRow.sign || '',
    supplierId: dbRow.supplier_id || dbRow.supplierId || '',
    supplierName: dbRow.supplier_name || dbRow.supplierName || dbRow.supplier || '',
    address: dbRow.address || '',
    sender: dbRow.sender || '',
    remarks: dbRow.remarks || dbRow.internalRemarks || '',
    purchase_request_id: dbRow.purchase_request_id || dbRow.purchaseRequestId || dbRow.pr_id || '',
    pr_no: dbRow.pr_no || dbRow.prNo || '',
    taxPercent: dbRow.tax_percent !== undefined ? String(dbRow.tax_percent) : (dbRow.tax_rate !== undefined ? String(dbRow.tax_rate) : ''),
    amount: dbRow.amount !== undefined ? String(dbRow.amount) : '0.00',
    billAmt: dbRow.bill_amt !== undefined ? String(dbRow.bill_amt) : '0.00',
    taxAmt: dbRow.tax_amt !== undefined ? String(dbRow.tax_amt) : '0.00',
    totAmt: dbRow.total_amt !== undefined ? String(dbRow.total_amt) : '0.00',
    items: (dbRow.items || []).map(it => ({
      item_id: it.item_id || it.itemId || '',
      item_name: it.item_name || it.itemName || '',
      weight: it.weight !== undefined ? it.weight : '',
      qty: it.qty !== undefined ? it.qty : '',
      tot_wt: it.tot_wt !== undefined ? it.tot_wt : (it.totWt || ''),
      purc_rate: it.rate !== undefined ? it.rate : (it.purc_rate || ''),
      disc_percent: it.discount_percent !== undefined ? it.discount_percent : (it.discountPercent || ''),
      tax_percent: it.tax_percent !== undefined ? it.tax_percent : (it.taxPercent || ''),
      ed_percent: it.ed_percent !== undefined ? it.ed_percent : (it.edPercent || ''),
      amount: it.amount !== undefined ? String(it.amount) : '0.00'
    })),
    deductions: (dbRow.deductions || []).map(d => ({
      deduction: d.deduction_name || d.deduction || '',
      type: d.type || 'less',
      percent: d.value !== undefined ? String(d.value) : (d.percent || ''),
      amount: d.amount !== undefined ? String(d.amount) : '',
      remarks: d.remarks || ''
    }))
  };
};

const toDb = (formPayload) => {
  const s_no = formPayload.sNo || formPayload.s_no;
  return {
    formData: {
      s_no: s_no,
      supplier_id: formPayload.supplierId || formPayload.supplier?.id || null,
      supplier_name: formPayload.supplierName || formPayload.supplier?.name || '',
      date: formPayload.date,
      inv_no: formPayload.invNo || formPayload.inv_no || `PO-${s_no}`,
      inv_date: formPayload.invDate || formPayload.inv_date || null,
      po_date: formPayload.poDate || formPayload.date,
      godown_id: formPayload.warehouseId || formPayload.godownId || formPayload.warehouse?.id || null,
      pay_type: formPayload.payType || formPayload.paymentTerms || 'Cash',
      tax_type: formPayload.taxType || 'Exclusive',
      tax_rate: parseFloat(formPayload.taxPercent || formPayload.tax_rate) || 0,
      type: formPayload.type || formPayload.purchaseType || null,
      terms: formPayload.terms || '',
      fob: formPayload.fob || '',
      ship_via: formPayload.shipVia || '',
      sign: formPayload.sign || '',
      address: formPayload.address || '',
      sender: formPayload.sender || '',
      remarks: formPayload.remarks || formPayload.internalRemarks || '',
      purchase_request_id: formPayload.purchase_request_id || formPayload.purchaseRequestId || formPayload.pr_id || null,
      pr_no: formPayload.pr_no || formPayload.prNo || null,
      tax_percent: parseFloat(formPayload.taxPercent) || 0,
      amount: parseFloat(formPayload.amount) || 0,
      bill_amt: parseFloat(formPayload.billAmt) || 0,
      tax_amt: parseFloat(formPayload.taxAmt) || 0,
      total_amt: parseFloat(formPayload.totAmt || formPayload.total_amt) || 0,
    },
    items: (formPayload.items || []).map(item => ({
      item_id: item.itemId || item.item_id || null,
      item_name: typeof item.itemName === 'object' ? item.itemName?.name || '' : (item.itemName || item.item_name || ''),
      weight: parseFloat(item.weight) || 0,
      qty: parseFloat(item.qty) || 0,
      tot_wt: parseFloat(item.totWt || item.tot_wt) || 0,
      rate: parseFloat(item.rate || item.purc_rate) || 0,
      discount_percent: parseFloat(item.discountPercent || item.disc_percent) || 0,
      tax_percent: parseFloat(item.taxPercent || item.tax_percent) || 0,
      ed_percent: parseFloat(item.edPercent || item.ed_percent) || 0,
      amount: parseFloat(item.amount) || 0,
      uom: item.uom || ''
    })),
    deductions: formPayload.deductions || []
  };
};

export const listPurchaseOrders = async () => {
  const result = await api('/purchase-orders');
  const data = result?.success ? result.data : [];
  return Array.isArray(data) ? data.map(toForm) : [];
};

export const getPurchaseOrder = async (id) => {
  const result = await api(`/purchase-orders/${id}`);
  return result?.success ? toForm(result.data) : null;
};

export const getNextSNo = async () => {
  const result = await api('/purchase-orders/next-sno');
  return result?.success ? result.next_sno : null;
};

export const createPurchaseOrder = async (payload) => {
  const formattedPayload = toDb(payload);
  const result = await api('/purchase-orders', {
    method: 'POST',
    body: formattedPayload
  });
  if (!result?.success || !result.data?.id) {
    throw new Error(result?.message || 'Purchase Order was not saved');
  }
  return toForm(result.data);
};

export const updatePurchaseOrder = async (id, payload) => {
  const formattedPayload = toDb(payload);
  const result = await api(`/purchase-orders/${id}`, {
    method: 'PUT',
    body: formattedPayload
  });
  return result?.success ? toForm(result.data) : null;
};

export const deletePurchaseOrder = async (id) => {
  const result = await api(`/purchase-orders/${id}`, {
    method: 'DELETE'
  });
  return result?.success || false;
};

export default {
  list: listPurchaseOrders,
  get: getPurchaseOrder,
  getNextSNo: getNextSNo,
  create: createPurchaseOrder,
  update: updatePurchaseOrder,
  delete: deletePurchaseOrder,
};
