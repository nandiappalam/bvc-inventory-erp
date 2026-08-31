import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EntryDisplay } from './entry';
import { printHtml } from '../utils/printHelper';

// Column definitions for Flour Out Return Display
const columns = [
  { key: 'sno', title: 'S.No', render: (_val, row, idx) => idx !== undefined ? idx + 1 : (row.s_no || row.sno || row.id || '') },
  { key: 'date', title: 'Date' },
  { key: 'papad_company', title: 'Papad Company', render: (val, row) => val || row.flour_mill || row.papadCompany || '' },
  { key: 'item_name', title: 'Item Name', render: (val, row) => val || row.itemName || '' },
  { key: 'lot_no', title: 'Lot No', render: (val, row) => val || row.lotNo || '' },
  { key: 'weight', title: 'Weight', render: (val, row) => val !== undefined && val !== null ? val : '' },
  { key: 'qty', title: 'Qty', render: (val, row) => val !== undefined && val !== null ? val : '' },
  { key: 'total_wt', title: 'Total Wt', render: (val, row) => val || row.totalWt || '' },
  { key: 'wages_per_kg', title: 'Wages / Bag', render: (val, row) => val || row.wages_bag || row.wagesBag || '' },
  { key: 'wages', title: 'Wages', render: (val, row) => val !== undefined && val !== null ? val : '' },
];

// Handle print
const handlePrint = (row) => {
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2 style="color: #1f4fb2; border-bottom: 2px solid #1f4fb2; padding-bottom: 10px;">Flour Out Return Details</h2>
      <table style="border-collapse: collapse; width: 100%; margin-top: 15px;">
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Date</th><td style="border: 1px solid #ccc; padding: 10px;">${row.date||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Flour Mill</th><td style="border: 1px solid #ccc; padding: 10px;">${row.flour_mill||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Item Name</th><td style="border: 1px solid #ccc; padding: 10px;">${row.item_name||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Lot No</th><td style="border: 1px solid #ccc; padding: 10px;">${row.lot_no||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Qty</th><td style="border: 1px solid #ccc; padding: 10px;">${row.qty||0}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Total Weight</th><td style="border: 1px solid #ccc; padding: 10px;">${row.total_wt||0}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Wages</th><td style="border: 1px solid #ccc; padding: 10px;">₹${row.wages||0}</td></tr>
      </table>
    </div>
  `;
  printHtml(html, `Flour_Out_Return_${row.lot_no || row.id}`);
};

// Custom actions for Flour Out Return
const FlourOutReturnDisplay = () => {
  const navigate = useNavigate();

  const handleEdit = (row) => {
    navigate(`/entry/flour-out-return-create?id=${row.id}`);
  };

  const handleDelete = async (id, refresh, showConfirm, showAlert) => {
    if (!id) {
      if (showAlert) showAlert('Error', 'Cannot delete: missing record id');
      else alert('Cannot delete: missing record id');
      return;
    }

    const doDelete = async () => {
      try {
        const res = await fetch(`/api/flour-out-return/${id}`, { method: 'DELETE' });
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
      title="Flour Out Return Display"
      apiEndpoint="/api/flour-out-return"
      columns={columns}
      onEdit={handleEdit}
      onPrint={handlePrint}
      addNewLink="/entry/flour-out-return-create"
    />
  );
};

export default FlourOutReturnDisplay;
