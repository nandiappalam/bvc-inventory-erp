import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EntryDisplay } from './entry';
import { printHtml } from '../utils/printHelper';

// Column definitions for Advance Display
const columns = [
  { key: 's_no', title: 'Adv No' },
  { key: 'date', title: 'Date' },
  { key: 'papad_company_name', title: 'Papad Company' },
  { key: 'amount', title: 'Amount' },
  { key: 'dr_cr', title: 'Type' },
  { key: 'pay_mode', title: 'Pay Mode' },
  { key: 'remarks', title: 'Remarks' },
];

// Handle print
const handlePrint = (row) => {
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2 style="color: #1f4fb2; border-bottom: 2px solid #1f4fb2; padding-bottom: 10px;">Advance Payment Details</h2>
      <table style="border-collapse: collapse; width: 100%; margin-top: 15px;">
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Adv No</th><td style="border: 1px solid #ccc; padding: 10px;">${row.s_no||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Date</th><td style="border: 1px solid #ccc; padding: 10px;">${row.date||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Papad Company</th><td style="border: 1px solid #ccc; padding: 10px;">${row.papad_company_name || row.papad_company||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Amount</th><td style="border: 1px solid #ccc; padding: 10px;">₹${row.amount||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Type</th><td style="border: 1px solid #ccc; padding: 10px;">${row.dr_cr||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Pay Mode</th><td style="border: 1px solid #ccc; padding: 10px;">${row.pay_mode||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Remarks</th><td style="border: 1px solid #ccc; padding: 10px;">${row.remarks||''}</td></tr>
      </table>
    </div>
  `;
  printHtml(html, `Advance_${row.s_no || row.id}`);
};

// Custom actions for Advance
const AdvanceDisplay = () => {
  const navigate = useNavigate();

  const handleEdit = (row) => {
    navigate(`/entry/advance-create?id=${row.id}`);
  };

  const handleDelete = async (id, refresh, showConfirm, showAlert) => {
    if (!id) {
      if (showAlert) showAlert('Error', 'Cannot delete: missing record id');
      else alert('Cannot delete: missing record id');
      return;
    }

    const doDelete = async () => {
      try {
        const res = await fetch(`/api/advances/${id}`, { method: 'DELETE' });
        if (res.ok) {
          if (showAlert) showAlert('Success', 'Record deleted successfully', refresh);
          else { alert('Record deleted successfully'); if (refresh) refresh(); }
        } else {
          const data = await res.json();
          if (showAlert) showAlert('Error', data.message || 'Delete failed');
          else alert(data.message || 'Delete failed');
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
      title="Advance Display"
      apiEndpoint="/api/advances"
      columns={columns}
      onEdit={handleEdit}
      onPrint={handlePrint}
      addNewLink="/entry/advance-create"
    />
  );
};

export default AdvanceDisplay;
