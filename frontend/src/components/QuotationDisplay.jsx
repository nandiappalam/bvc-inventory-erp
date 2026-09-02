import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EntryDisplay } from './entry';
import api from '../utils/api';
import { printHtml } from '../utils/printHelper';

// Column definitions for Quotation Display
const columns = [
  { key: 'sno', title: 'S.No', render: (_val, row, idx) => idx !== undefined ? idx + 1 : (row.s_no || row.sNo || row.bill_no || '') },
  { key: 'date', title: 'Date' },
  { key: 'customer', title: 'Customer', render: (val, row) => row.customer_name || (val && isNaN(val) ? val : '') || row.customerName || row.party_name || row.name || '' },
  { key: 'item_name', title: 'Item Name', render: (val, row) => val || row.itemName || '' },
  { key: 'lot_no', title: 'Lot No', render: (val, row) => val || row.lotNo || '' },
  { key: 'qty', title: 'Qty' },
  { key: 'amount', title: 'Amount', render: (val, row) => {
    const num = parseFloat(val || row.total_amt || row.totAmt || 0);
    return num ? `₹${num.toFixed(2)}` : '₹0.00';
  }},
];

// Handle delete
const handleDelete = async (id, onSuccess) => {
  if (!id) {
    alert('Cannot delete: missing record id');
    return;
  }
  if (!window.confirm('Delete this record?')) return;
  try {
    const result = await api(`/quotations/${id}`, { method: 'DELETE' });
    if (result && (result.success !== false)) {
      alert('Record deleted successfully');
      if (onSuccess) onSuccess();
    } else {
      alert('Delete failed: ' + (result?.message || 'Unknown error'));
    }
  } catch (err) {
    console.error('Delete error:', err);
    alert('Delete failed: ' + err.message);
  }
};

// Handle print
const handlePrint = (row) => {
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2 style="color: #1f4fb2; border-bottom: 2px solid #1f4fb2; padding-bottom: 10px;">Quotation Details</h2>
      <table style="border-collapse: collapse; width: 100%; margin-top: 15px;">
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">S.No</th><td style="border: 1px solid #ccc; padding: 10px;">${row.s_no||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Date</th><td style="border: 1px solid #ccc; padding: 10px;">${row.date||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Customer</th><td style="border: 1px solid #ccc; padding: 10px;">${row.customer||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Item Name</th><td style="border: 1px solid #ccc; padding: 10px;">${row.item_name||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Lot No</th><td style="border: 1px solid #ccc; padding: 10px;">${row.lot_no||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Qty</th><td style="border: 1px solid #ccc; padding: 10px;">${row.qty||0}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Amount</th><td style="border: 1px solid #ccc; padding: 10px;">₹${row.amount||0}</td></tr>
      </table>
    </div>
  `;
  printHtml(html, `Quotation_${row.s_no || row.id}`);
};

// Custom actions for Quotation
const QuotationDisplay = () => {
  const navigate = useNavigate();

  const handleEdit = (row) => {
    navigate(`/entry/quotation-create?id=${row.id}`);
  };

  return (
    <EntryDisplay
      title="Quotation Display"
      apiEndpoint="/quotations"
      tableName="quotations"
      columns={columns}
      onEdit={handleEdit}
      onPrint={handlePrint}
      addNewLink="/entry/quotation-create"
    />
  );
};

export default QuotationDisplay;
