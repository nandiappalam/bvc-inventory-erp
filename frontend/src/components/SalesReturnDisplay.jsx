import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EntryDisplay } from './entry';
import { printHtml } from '../utils/printHelper';
import api from '../services/api.js';

// Column definitions for Sales Return Display
const columns = [
  { key: 'sno', title: 'S.No', render: (_val, row, idx) => idx !== undefined ? idx + 1 : (row.s_no || '') },
  { key: 'date', title: 'Date' },
  { key: 'customer', title: 'Customer' },
  { key: 'total_qty', title: 'Total Qty' },
  { key: 'total_amt', title: 'Total Amount' },
];

// Handle delete
const handleDelete = async (id, refresh) => {
  if (!id) {
    alert('Cannot delete: missing record id');
    return;
  }
  if (!window.confirm('Delete this record?')) return;
  try {
    const res = await api(`/sales-returns/${id}`, { method: 'DELETE' });
    if (res && res.success !== false) {
      alert('Record deleted successfully');
      if (refresh) {
        refresh();
      } else {
        window.location.reload();
      }
    } else {
      alert('Delete failed: ' + (res?.message || 'Unknown error'));
    }
  } catch (err) {
    console.error(err);
    alert('Delete failed: ' + err.message);
  }
};

// Handle print
const handlePrint = (row) => {
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2 style="color: #1f4fb2; border-bottom: 2px solid #1f4fb2; padding-bottom: 10px;">Sales Return Details</h2>
      <table style="border-collapse: collapse; width: 100%; margin-top: 15px;">
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">S.No</th><td style="border: 1px solid #ccc; padding: 10px;">${row.s_no||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Date</th><td style="border: 1px solid #ccc; padding: 10px;">${row.date||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Customer</th><td style="border: 1px solid #ccc; padding: 10px;">${row.customer||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Total Qty</th><td style="border: 1px solid #ccc; padding: 10px;">${row.total_qty||0}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Total Amount</th><td style="border: 1px solid #ccc; padding: 10px;">₹${row.total_amt||0}</td></tr>
      </table>
    </div>
  `;
  printHtml(html, `Sales_Return_${row.s_no || row.id}`);
};

// Custom actions for Sales Return
const SalesReturnDisplay = () => {
  const navigate = useNavigate();

  const handleEdit = (row) => {
    navigate(`/entry/sales-return-create?id=${row.id}`);
  };

  return (
    <EntryDisplay
      title="Sales Return Display"
      apiEndpoint="/api/sales-returns"
      columns={columns}
      onEdit={handleEdit}
      onPrint={handlePrint}
      addNewLink="/entry/sales-return-create"
    />
  );
};

export default SalesReturnDisplay;
