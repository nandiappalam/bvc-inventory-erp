import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EntryDisplay } from '../../../components/entry';
import { printHtml } from '../../../utils/printHelper';
import { api } from '../../../services/api';

const columns = [
  { key: 's_no', title: 'S.No', render: (_val, row, idx) => idx !== undefined ? idx + 1 : (row.s_no || row.sNo || '') },
  { key: 'pr_no', title: 'PR Ref', render: (val, row) => (val || row.pr_no) ? (
    <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px' }}>
      {val || row.pr_no}
    </span>
  ) : <span style={{ color: '#94a3b8' }}>—</span> },
  { key: 'date', title: 'Date' },
  { key: 'inv_no', title: 'PO / Inv. No', render: (val, row) => val || row.invNo || row.orderNo || '' },
  { key: 'supplier_name', title: 'Supplier', render: (val, row) => val || row.supplierName || '-' },
  { key: 'item_name', title: 'Item Name', render: (val, row) => val || row.itemName || (row.items && row.items.map(i => i.item_name || i.itemName).filter(Boolean).join(', ')) || row.type || '-' },
  { key: 'qty', title: 'Qty', render: (val, row) => val || row.totalQty || (row.items && row.items.reduce((s, i) => s + (parseFloat(i.qty) || 0), 0)) || '0' },
  { key: 'rate', title: 'Rate', render: (val, row) => val || row.purc_rate || (row.items && row.items[0]?.purc_rate) || (row.items && row.items[0]?.rate) || '0.00' },
  { key: 'amount', title: 'Amount', render: (val, row) => `₹${parseFloat(val || row.billAmt || row.bill_amt || 0).toFixed(2)}` },
  { key: 'tax_amt', title: 'Tax Amt', render: (val, row) => `₹${parseFloat(val || row.taxAmt || row.tax_amt || 0).toFixed(2)}` },
  { key: 'total_amt', title: 'Total Amount', render: (val, row) => `₹${parseFloat(val || row.totAmt || row.total_amt || 0).toFixed(2)}` },
  { key: 'status', title: 'Status', render: (val, row) => {
    const st = val || row.status || (row.inward_purchase_id ? 'Received' : 'Ordered');
    const isReceived = st === 'Received' || Boolean(row.inward_purchase_id);
    return (
      <span style={{ 
        backgroundColor: isReceived ? '#dcfce7' : '#fef9c3', 
        color: isReceived ? '#15803d' : '#854d0e',
        padding: '2px 6px',
        borderRadius: '4px',
        fontWeight: 'bold',
        fontSize: '11px'
      }}>
        {isReceived ? 'Received' : 'Ordered'}
      </span>
    );
  }}
];

const handlePrintPurchaseOrder = async (row) => {
  try {
    let fullPo = row;
    try {
      const res = await api(`/purchase-orders/${row.id}`);
      if (res) fullPo = res.data || res;
    } catch (e) {
      console.warn('Fallback using row data for PO print:', e);
    }

    const items = fullPo.items || [];
    const deductions = fullPo.deductions || [];
    const suppName = fullPo.supplier_name || fullPo.supplierName || fullPo.supplier || '-';
    const suppAddr = fullPo.address || fullPo.supplier_address || fullPo.supplierAddress || '';

    const itemsRows = items.length > 0 ? items.map((it, idx) => {
      const qty = parseFloat(it.qty || 0);
      const wt = parseFloat(it.weight || it.per_unit_weight || 0);
      const totWt = parseFloat(it.tot_wt || it.total_weight || (qty * wt) || 0);
      const rate = parseFloat(it.rate || it.purc_rate || 0);
      const disc = parseFloat(it.disc_percent || it.discount_percent || 0);
      const tax = parseFloat(it.tax_percent || it.tax_rate || fullPo.tax_percent || 5);
      const baseAmt = qty * rate;
      const discAmt = baseAmt * (disc / 100);
      const taxable = baseAmt - discAmt;
      const taxAmt = (taxable * tax) / 100;
      const amt = parseFloat(it.amount || (taxable + taxAmt));

      return `
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${idx + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">${it.item_name || it.itemName || '-'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${wt ? `${wt} KG` : '—'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold;">${qty}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">${totWt ? `${totWt.toFixed(2)} KG` : '—'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">₹${rate.toFixed(2)}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">${disc > 0 ? `${disc.toFixed(1)}%` : '0%'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">${tax}%</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold;">₹${amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
      `;
    }).join('') : `<tr><td colspan="9" style="border: 1px solid #cbd5e1; padding: 12px; text-align: center; color: #64748b;">No items in Purchase Order</td></tr>`;

    const deductionsRows = deductions.length > 0 ? deductions.map(d => `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">${d.name || d.deduction_name || d.deduction || 'Deduction'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center;">${(d.type || 'LESS').toUpperCase()}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right;">${parseFloat(d.percentage || d.percent || 0) > 0 ? `${parseFloat(d.percentage || d.percent).toFixed(2)}%` : '—'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right; font-weight: bold;">₹${parseFloat(d.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join('') : '';

    const billAmt = parseFloat(fullPo.bill_amt || fullPo.billAmt || fullPo.base_amt || fullPo.amount || 0);
    const taxAmt = parseFloat(fullPo.tax_amt || fullPo.taxAmt || 0);
    const totAmt = parseFloat(fullPo.total_amt || fullPo.totAmt || fullPo.grand_total || (billAmt + taxAmt));

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 25px; color: #0f172a; max-width: 900px; margin: 0 auto; background: #ffffff;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1f4fb2; padding-bottom: 15px; margin-bottom: 20px;">
          <div>
            <h1 style="margin: 0; color: #1f4fb2; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">BVC INVENTORY SYSTEM</h1>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #475569; font-weight: 600;">PURCHASE ORDER VOUCHER</p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 16px; font-weight: bold; color: #0f172a;">PO No: ${fullPo.inv_no || fullPo.invNo || fullPo.orderNo || '-'}</div>
            <div style="font-size: 13px; color: #64748b; margin-top: 3px;">Date: ${fullPo.date || '-'}</div>
            ${fullPo.pr_no ? `<div style="font-size: 12px; color: #0284c7; font-weight: bold; margin-top: 3px;">PR Ref: ${fullPo.pr_no}</div>` : ''}
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; font-size: 13px;">
          <div style="border: 1px solid #cbd5e1; padding: 12px; border-radius: 6px; background: #f8fafc;">
            <div style="font-weight: bold; color: #1f4fb2; margin-bottom: 6px; font-size: 14px; text-transform: uppercase;">Vendor / Supplier Details:</div>
            <div style="font-size: 14px; font-weight: bold; color: #0f172a;">${suppName}</div>
            ${suppAddr ? `<pre style="font-family: inherit; margin: 6px 0 0 0; white-space: pre-wrap; font-size: 12px; color: #475569;">${suppAddr}</pre>` : ''}
          </div>
          <div style="border: 1px solid #cbd5e1; padding: 12px; border-radius: 6px; background: #f8fafc;">
            <div style="font-weight: bold; color: #1f4fb2; margin-bottom: 6px; font-size: 14px; text-transform: uppercase;">Order Specifications:</div>
            <table style="width: 100%; font-size: 12px; line-height: 1.6;">
              <tr><td style="color: #64748b; width: 100px;">Pay Type:</td><td style="font-weight: 600;">${fullPo.pay_type || 'Cash'}</td></tr>
              <tr><td style="color: #64748b;">Tax Type:</td><td style="font-weight: 600;">${fullPo.tax_type || 'Exclusive'}</td></tr>
              <tr><td style="color: #64748b;">Godown:</td><td style="font-weight: 600;">${fullPo.godown_name || fullPo.godown || 'Main Godown'}</td></tr>
              ${fullPo.remarks ? `<tr><td style="color: #64748b;">Remarks:</td><td style="font-weight: 600;">${fullPo.remarks}</td></tr>` : ''}
            </table>
          </div>
        </div>

        <div style="font-weight: bold; font-size: 15px; margin-bottom: 8px; color: #0f172a;">Order Items Breakdown</div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px;">
          <thead>
            <tr style="background: #1f4fb2; color: #ffffff;">
              <th style="border: 1px solid #1f4fb2; padding: 8px; text-align: center; width: 40px;">S.No</th>
              <th style="border: 1px solid #1f4fb2; padding: 8px; text-align: left;">Item Name</th>
              <th style="border: 1px solid #1f4fb2; padding: 8px; text-align: center;">Per Unit Wt</th>
              <th style="border: 1px solid #1f4fb2; padding: 8px; text-align: right;">Qty</th>
              <th style="border: 1px solid #1f4fb2; padding: 8px; text-align: right;">Total Wt</th>
              <th style="border: 1px solid #1f4fb2; padding: 8px; text-align: right;">Rate (₹)</th>
              <th style="border: 1px solid #1f4fb2; padding: 8px; text-align: right;">Disc %</th>
              <th style="border: 1px solid #1f4fb2; padding: 8px; text-align: right;">Tax %</th>
              <th style="border: 1px solid #1f4fb2; padding: 8px; text-align: right;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        ${deductions.length > 0 ? `
          <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px; color: #0f172a;">Deductions & Adjustments</div>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px;">
            <thead>
              <tr style="background: #f1f5f9; color: #334155;">
                <th style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left;">Deduction Name</th>
                <th style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; width: 80px;">Type</th>
                <th style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right; width: 80px;">Rate %</th>
                <th style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right; width: 120px;">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${deductionsRows}
            </tbody>
          </table>
        ` : ''}

        <div style="display: flex; justify-content: flex-end; margin-top: 15px; margin-bottom: 30px;">
          <div style="width: 320px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; background: #f8fafc;">
            <div style="display: flex; justify-content: space-between; padding: 8px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">
              <span style="color: #64748b;">Base Amount:</span>
              <span style="font-weight: 600;">₹${billAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">
              <span style="color: #64748b;">Tax Amount:</span>
              <span style="font-weight: 600;">₹${taxAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 10px 14px; background: #1f4fb2; color: #ffffff; font-size: 15px; font-weight: bold;">
              <span>Grand Total:</span>
              <span>₹${totAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; margin-top: 60px; padding-top: 20px; border-top: 1px solid #cbd5e1; font-size: 12px; color: #475569;">
          <div style="text-align: center; width: 200px;">
            <div style="border-top: 1px dashed #94a3b8; margin-bottom: 6px;"></div>
            <div>Prepared By</div>
          </div>
          <div style="text-align: center; width: 200px;">
            <div style="border-top: 1px dashed #94a3b8; margin-bottom: 6px;"></div>
            <div>Verified By</div>
          </div>
          <div style="text-align: center; width: 200px;">
            <div style="border-top: 1px dashed #94a3b8; margin-bottom: 6px;"></div>
            <div>Authorized Signatory</div>
          </div>
        </div>
      </div>
    `;

    printHtml(html, `Purchase Order - ${fullPo.inv_no || fullPo.id}`);
  } catch (err) {
    console.error('Error printing PO:', err);
    alert('Error preparing print preview: ' + err.message);
  }
};

const PurchaseOrderList = () => {
  const navigate = useNavigate();

  return (
    <div className="window">
      <EntryDisplay
        title="Purchase Order Display"
        apiEndpoint="/purchase-orders"
        columns={columns}
        onEdit={(row) => navigate(`/entry/purchase-order-create?id=${row.id}`)}
        addNewLink="/entry/purchase-order-create"
        customActions={(row, onSuccess, showConfirm, showAlert) => (
          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => navigate(`/entry/purchase-order-create?id=${row.id}`)}
              title="Edit / Update Purchase Order"
              style={{
                padding: '4px 8px',
                backgroundColor: '#1976d2',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '11px'
              }}
            >
              Update
            </button>
            <button
              type="button"
              onClick={() => handlePrintPurchaseOrder(row)}
              title="Print Purchase Order Voucher"
              style={{
                padding: '4px 8px',
                backgroundColor: '#0288d1',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '11px'
              }}
            >
              Print
            </button>
            <button
              type="button"
              onClick={() => {
                const doDelete = async () => {
                  try {
                    const res = await api(`/purchase-orders/${row.id}`, { method: 'DELETE' });
                    if (res?.success !== false) {
                      if (showAlert) showAlert('Purchase Order deleted successfully', 'success');
                      if (onSuccess) onSuccess();
                    } else {
                      if (showAlert) showAlert(res?.message || 'Delete failed', 'error');
                    }
                  } catch (e) {
                    if (showAlert) showAlert('Delete failed: ' + e.message, 'error');
                  }
                };

                if (showConfirm) {
                  showConfirm('Delete Purchase Order', `Are you sure you want to delete PO #${row.inv_no || row.invNo || row.id}?`, doDelete);
                } else if (window.confirm(`Are you sure you want to delete PO #${row.inv_no || row.invNo || row.id}?`)) {
                  doDelete();
                }
              }}
              title="Delete Purchase Order"
              style={{
                padding: '4px 8px',
                backgroundColor: '#d32f2f',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '11px'
              }}
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => navigate(`/entry/purchase-create?sourcePurchaseOrderId=${row.id}`)}
              title="Convert to Inward Purchase"
              style={{
                padding: '4px 8px',
                backgroundColor: '#16a34a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '3px'
              }}
            >
              📦 Inward ➔
            </button>
          </div>
        )}
      />
    </div>
  );
};

export default PurchaseOrderList;

