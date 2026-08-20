import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EntryDisplay } from './entry';
import { printHtml } from '../utils/printHelper';

// Column definitions for Purchase Return Display
const columns = [
  { key: 'sno', title: 'S.No', render: (_val, row, idx) => idx !== undefined ? idx + 1 : (row.s_no || '') },
  { key: 'date', title: 'Date' },
  { key: 'return_inv_no', title: 'Return Inv No' },
  { 
    key: 'supplier', 
    title: 'Supplier', 
    render: (_val, row) => row.supplier_print_name || row.supplier_master_name || row.supplier || '-' 
  },
  { 
    key: 'item_names', 
    title: 'Item Name', 
    render: (_val, row) => row.item_names || row.item_name || '-' 
  },
  { 
    key: 'item_weights', 
    title: 'Weight', 
    render: (_val, row) => row.item_weights || row.weight || '-' 
  },
  { key: 'type', title: 'Type' },
  { key: 'total_qty', title: 'Total Qty' },
  { key: 'total_weight', title: 'Total Weight' },
  { key: 'total_amount', title: 'Total Amount' },
  { 
    key: 'deduction_amount', 
    title: 'Ded Amount', 
    render: (_val, row) => {
      let da = parseFloat(row.deduction_amount);
      if (isNaN(da) || da === undefined) {
        da = (parseFloat(row.grand_total || 0) - parseFloat(row.total_amount || 0));
      }
      return da.toFixed(2);
    } 
  },
  { key: 'grand_total', title: 'Grand Total' },
];

// Handle print with full detailed voucher
const handlePrint = async (row) => {
  try {
    let fullData = row;
    try {
      const res = await fetch(`/api/purchase-returns/${row.id}`);
      if (res.ok) {
        fullData = await res.json();
      }
    } catch (e) {
      console.error('Error fetching full purchase return for print:', e);
    }

    const items = fullData.items || [];
    const deductions = fullData.deductions || [];
    const suppName = fullData.supplier_print_name || fullData.supplier_name || row.supplier_print_name || row.supplier_master_name || fullData.supplier || row.supplier || '-';
    const suppAddr = fullData.supplier_address || fullData.address || '';

    const itemsRows = items.length > 0 ? items.map((it, idx) => `
      <tr>
        <td style="border: 1px solid #ccc; padding: 6px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #ccc; padding: 6px; font-weight: bold;">${it.item_name || '-'}</td>
        <td style="border: 1px solid #ccc; padding: 6px; text-align: center;">${it.lot_no || '-'}</td>
        <td style="border: 1px solid #ccc; padding: 6px; text-align: right;">${parseFloat(it.weight || 0).toFixed(2)}</td>
        <td style="border: 1px solid #ccc; padding: 6px; text-align: right;">${parseFloat(it.qty || 0).toFixed(2)}</td>
        <td style="border: 1px solid #ccc; padding: 6px; text-align: right;">${parseFloat(it.total_wt || it.totalWt || 0).toFixed(2)}</td>
        <td style="border: 1px solid #ccc; padding: 6px; text-align: right;">${parseFloat(it.rate || 0).toFixed(2)}</td>
        <td style="border: 1px solid #ccc; padding: 6px; text-align: right;">${parseFloat(it.disc_percent || it.disc || 0).toFixed(2)}%</td>
        <td style="border: 1px solid #ccc; padding: 6px; text-align: right;">${parseFloat(it.tax_percent || it.tax || 0).toFixed(2)}%</td>
        <td style="border: 1px solid #ccc; padding: 6px; text-align: right; font-weight: bold;">₹${parseFloat(it.amount || 0).toFixed(2)}</td>
      </tr>
    `).join('') : `<tr><td colspan="10" style="border: 1px solid #ccc; padding: 8px; text-align: center;">No item details</td></tr>`;

    const deductionsRows = deductions.length > 0 ? deductions.map((d) => `
      <tr>
        <td style="border: 1px solid #ccc; padding: 6px;">${d.deduction_name || d.name || 'Deduction'}</td>
        <td style="border: 1px solid #ccc; padding: 6px; text-align: center;">${(d.type || 'LESS').toUpperCase()}</td>
        <td style="border: 1px solid #ccc; padding: 6px; text-align: right;">${parseFloat(d.percentage || d.percent || 0).toFixed(2)}%</td>
        <td style="border: 1px solid #ccc; padding: 6px; text-align: right; font-weight: bold;">₹${parseFloat(d.amount || 0).toFixed(2)}</td>
      </tr>
    `).join('') : '';

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 850px; margin: 0 auto; color: #333;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1f4fb2; padding-bottom: 12px; margin-bottom: 15px;">
          <div>
            <h2 style="margin: 0; color: #1f4fb2; font-size: 22px;">PURCHASE RETURN DEBIT NOTE</h2>
            <div style="font-size: 12px; color: #666; margin-top: 4px;">Return Voucher / Goods Return Document</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 14px; font-weight: bold;">Inv No: ${fullData.return_inv_no || row.return_inv_no || '-'}</div>
            <div style="font-size: 12px; color: #555;">Date: ${fullData.date || row.date || '-'}</div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; gap: 20px; margin-bottom: 20px; font-size: 13px;">
          <div style="flex: 1; border: 1px solid #d0d7de; padding: 10px; border-radius: 4px; background: #f8fafc;">
            <div style="font-weight: bold; color: #1f4fb2; margin-bottom: 6px;">SUPPLIER DETAILS</div>
            <div style="font-weight: bold; font-size: 14px;">${suppName}</div>
            ${suppAddr ? `<div style="color: #555; margin-top: 4px;">${suppAddr}</div>` : ''}
            ${fullData.supplier_gstin ? `<div style="color: #555; margin-top: 4px;">GSTIN: ${fullData.supplier_gstin}</div>` : ''}
          </div>

          <div style="flex: 1; border: 1px solid #d0d7de; padding: 10px; border-radius: 4px; background: #f8fafc;">
            <div style="font-weight: bold; color: #1f4fb2; margin-bottom: 6px;">VOUCHER DETAILS</div>
            <div><strong>Original Inv Date:</strong> ${fullData.inv_date || '-'}</div>
            <div><strong>Pay Type:</strong> ${fullData.pay_type || '-'}</div>
            <div><strong>Tax Type:</strong> ${fullData.tax_type || '-'}</div>
            <div><strong>Remarks:</strong> ${fullData.remarks || '-'}</div>
          </div>
        </div>

        <div style="margin-bottom: 20px;">
          <div style="font-weight: bold; color: #1f4fb2; font-size: 14px; margin-bottom: 8px;">RETURNED ITEM DETAILS</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background-color: #1f4fb2; color: white;">
                <th style="border: 1px solid #ccc; padding: 8px;">S.No</th>
                <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Item Name</th>
                <th style="border: 1px solid #ccc; padding: 8px;">Lot No</th>
                <th style="border: 1px solid #ccc; padding: 8px; text-align: right;">Unit Wt</th>
                <th style="border: 1px solid #ccc; padding: 8px; text-align: right;">Qty</th>
                <th style="border: 1px solid #ccc; padding: 8px; text-align: right;">Total Wt</th>
                <th style="border: 1px solid #ccc; padding: 8px; text-align: right;">Rate</th>
                <th style="border: 1px solid #ccc; padding: 8px; text-align: right;">Disc %</th>
                <th style="border: 1px solid #ccc; padding: 8px; text-align: right;">Tax %</th>
                <th style="border: 1px solid #ccc; padding: 8px; text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>
        </div>

        ${deductions.length > 0 ? `
          <div style="margin-bottom: 20px;">
            <div style="font-weight: bold; color: #1f4fb2; font-size: 14px; margin-bottom: 8px;">PURCHASE DEDUCTIONS</div>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr style="background-color: #4a6572; color: white;">
                  <th style="border: 1px solid #ccc; padding: 6px; text-align: left;">Deduction Name</th>
                  <th style="border: 1px solid #ccc; padding: 6px;">Type</th>
                  <th style="border: 1px solid #ccc; padding: 6px; text-align: right;">% / Rate</th>
                  <th style="border: 1px solid #ccc; padding: 6px; text-align: right;">Deduction Amount</th>
                </tr>
              </thead>
              <tbody>
                ${deductionsRows}
              </tbody>
            </table>
          </div>
        ` : ''}

        <div style="display: flex; justify-content: flex-end; margin-top: 15px;">
          <table style="border-collapse: collapse; width: 320px; font-size: 13px;">
            <tr>
              <td style="padding: 6px; border: 1px solid #ddd;"><strong>Total Qty:</strong></td>
              <td style="padding: 6px; border: 1px solid #ddd; text-align: right;">${parseFloat(fullData.total_qty || row.total_qty || 0).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 6px; border: 1px solid #ddd;"><strong>Total Weight:</strong></td>
              <td style="padding: 6px; border: 1px solid #ddd; text-align: right;">${parseFloat(fullData.total_weight || row.total_weight || 0).toFixed(2)} kg</td>
            </tr>
            <tr>
              <td style="padding: 6px; border: 1px solid #ddd;"><strong>Items Total:</strong></td>
              <td style="padding: 6px; border: 1px solid #ddd; text-align: right;">₹${parseFloat(fullData.total_amount || row.total_amount || 0).toFixed(2)}</td>
            </tr>
            ${fullData.base_amount ? `
              <tr>
                <td style="padding: 6px; border: 1px solid #ddd;"><strong>Base Amount:</strong></td>
                <td style="padding: 6px; border: 1px solid #ddd; text-align: right;">₹${parseFloat(fullData.base_amount || 0).toFixed(2)}</td>
              </tr>
            ` : ''}
            <tr style="background-color: #eef2f7; font-size: 15px; font-weight: bold; color: #1f4fb2;">
              <td style="padding: 8px; border: 2px solid #1f4fb2;">GRAND TOTAL:</td>
              <td style="padding: 8px; border: 2px solid #1f4fb2; text-align: right;">₹${parseFloat(fullData.grand_total || row.grand_total || 0).toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px; color: #555;">
          <div style="border-top: 1px solid #aaa; width: 180px; text-align: center; padding-top: 4px;">Prepared By</div>
          <div style="border-top: 1px solid #aaa; width: 180px; text-align: center; padding-top: 4px;">Verified By</div>
          <div style="border-top: 1px solid #aaa; width: 180px; text-align: center; padding-top: 4px;">Authorized Signature</div>
        </div>
      </div>
    `;

    printHtml(html, `Purchase_Return_${fullData.return_inv_no || row.return_inv_no || row.id}`);
  } catch (err) {
    console.error('Print generation error:', err);
  }
};

// Custom actions for Purchase Return
const PurchaseReturnDisplay = () => {
  const navigate = useNavigate();

  const handleEdit = (row) => {
    navigate(`/entry/purchase-return-create?id=${row.id}`);
  };

  const handleDelete = async (id, refresh, showConfirm, showAlert) => {
    if (!id) {
      if (showAlert) showAlert('Error', 'Cannot delete: missing record id');
      else alert('Cannot delete: missing record id');
      return;
    }

    const doDelete = async () => {
      try {
        const res = await fetch(`/api/purchase-returns/${id}`, { method: 'DELETE' });
        if (res.ok) {
          if (showAlert) showAlert('Success', 'Record deleted successfully', refresh);
          else { alert('Record deleted successfully'); if (refresh) refresh(); }
        } else {
          if (showAlert) showAlert('Error', 'Delete failed');
          else alert('Delete failed');
        }
      } catch (err) {
        console.error(err);
        if (showAlert) showAlert('Error', 'Delete failed');
        else alert('Delete failed');
      }
    };

    if (showConfirm) {
      showConfirm('Delete Record', 'Delete this record?', doDelete);
    } else {
      if (window.confirm('Delete this record?')) {
        doDelete();
      }
    }
  };

  return (
    <EntryDisplay
      title="Purchase Return Display"
      apiEndpoint="/api/purchase-returns"
      columns={columns}
      onEdit={handleEdit}
      onPrint={handlePrint}
      addNewLink="/entry/purchase-return-create"
    />
  );
};

export default PurchaseReturnDisplay;
