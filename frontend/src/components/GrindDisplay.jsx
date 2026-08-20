import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EntryDisplay } from './entry';
import { printHtml } from '../utils/printHelper';

// Column definitions for Grind Display
const columns = [
  { key: 'date', title: 'Date' },
  { key: 'item_name', title: 'Item Name' },
  { key: 'lot_no', title: 'Lot No' },
  { key: 'weight', title: 'Weight' },
  { key: 'qty', title: 'Qty' },
  { key: 'total_wt', title: 'Total Wt' },
  { key: 'wages', title: 'Wages' },
];

// Handle print
const handlePrint = (row) => {
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2 style="color: #1f4fb2; border-bottom: 2px solid #1f4fb2; padding-bottom: 10px;">Grind Details</h2>
      <table style="border-collapse: collapse; width: 100%; margin-top: 15px;">
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Date</th><td style="border: 1px solid #ccc; padding: 10px;">${row.date||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Item Name</th><td style="border: 1px solid #ccc; padding: 10px;">${row.item_name||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Lot No</th><td style="border: 1px solid #ccc; padding: 10px;">${row.lot_no||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Weight</th><td style="border: 1px solid #ccc; padding: 10px;">${row.weight||0}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Qty</th><td style="border: 1px solid #ccc; padding: 10px;">${row.qty||0}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Total Wt</th><td style="border: 1px solid #ccc; padding: 10px;">${row.total_wt||0}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Wages</th><td style="border: 1px solid #ccc; padding: 10px;">${row.wages||0}</td></tr>
      </table>
    </div>
  `;
  printHtml(html, `Grind_${row.lot_no || row.id}`);
};

// Custom actions for Grind
const GrindDisplay = () => {
  const navigate = useNavigate();

  const handleEdit = (row) => {
    navigate(`/entry/grind-create?id=${row.id}`);
  };

  const handleDelete = async (id, refresh, showConfirm, showAlert) => {
    if (!id) {
      if (showAlert) showAlert('Error', 'Cannot delete: missing record id');
      else alert('Cannot delete: missing record id');
      return;
    }

    const doDelete = async () => {
      try {
        const res = await fetch(`/api/grind/${id}`, { method: 'DELETE' });
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
      title="Grind Display"
      apiEndpoint="/api/grind"
      columns={columns}
      onEdit={handleEdit}
      onPrint={handlePrint}
      addNewLink="/entry/grind-create"
    />
  );
};

export default GrindDisplay;
