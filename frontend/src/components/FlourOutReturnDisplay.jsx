import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EntryDisplay } from './entry';
import api from '../services/api';
import { printHtml } from '../utils/printHelper';

// Column definitions for Flour Out Return Display
const columns = [
  { key: 'sno', title: 'S.No', render: (_val, row, idx) => idx !== undefined ? idx + 1 : (row.s_no || row.sno || row.sNo || '') },
  { key: 'date', title: 'Date', render: (val, row) => (val || row?.date) ? String(val || row?.date).substring(0, 10) : '' },
  { key: 's_no', title: 'Flour Out Return No', render: (val, row) => val || row?.s_no || row?.sno || row?.sNo || '' },
  { key: 'papad_company', title: 'Papad Company', render: (val, row) => val || row?.papad_company || row?.papadCompany || '' },
  { key: 'item_name', title: 'Item Name', render: (val, row) => val || row?.item_name || row?.itemName || '-' },
  { key: 'lot_no', title: 'Lot No', render: (val, row) => val || row?.lot_no || row?.lotNo || '-' },
  { key: 'weight', title: 'Weight', render: (val, row) => parseFloat(val || row?.weight || 0) || 0 },
  { key: 'qty', title: 'Qty', render: (val, row) => parseFloat(val || row?.qty || 0) || 0 },
  { key: 'total_wt', title: 'Total Wt', render: (val, row) => parseFloat(val || row?.total_wt || row?.totalWt || 0) || 0 },
  { key: 'papad_kg', title: 'Papad Kg', render: (val, row) => parseFloat(val || row?.papad_kg || row?.papadKg || 0) || 0 },
];

const FlourOutReturnDisplay = () => {
  const navigate = useNavigate();

  const handleEdit = (row) => {
    const editId = row.id || row.flour_out_return_id;
    navigate(`/entry/flour-out-return-create?id=${editId}`);
  };

  const handleDelete = async (id, refresh, showConfirm, showAlert) => {
    if (!id) {
      if (showAlert) showAlert('Error', 'Cannot delete: missing record id');
      else alert('Cannot delete: missing record id');
      return;
    }
    const doDelete = async () => {
      try {
        const res = await api(`/flour-out-return/${id}`, { method: 'DELETE' });
        if (res && (res.success || res.success === undefined || res.message)) {
          if (showAlert) showAlert('Success', 'Record deleted successfully', refresh);
          else { alert('Record deleted successfully'); if (refresh) refresh(); }
        } else {
          if (showAlert) showAlert('Error', res?.message || 'Delete failed');
          else alert(res?.message || 'Delete failed');
        }
      } catch (err) {
        console.error('Delete error:', err);
        if (showAlert) showAlert('Error', 'Delete failed');
        else alert('Delete failed');
      }
    };

    if (showConfirm) {
      showConfirm('Delete Record', 'Are you sure you want to delete this Flour Out Return record?', doDelete);
    } else {
      if (window.confirm('Delete this record?')) {
        doDelete();
      }
    }
  };

  const handlePrint = (row) => {
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #1f4fb2; border-bottom: 2px solid #1f4fb2; padding-bottom: 10px;">Flour Out Return Details</h2>
        <table style="border-collapse: collapse; width: 100%; margin-top: 15px;">
          <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">S.No</th><td style="border: 1px solid #ccc; padding: 10px;">${row.s_no || row.sno || ''}</td></tr>
          <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Date</th><td style="border: 1px solid #ccc; padding: 10px;">${row.date ? String(row.date).substring(0, 10) : ''}</td></tr>
          <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Papad Company</th><td style="border: 1px solid #ccc; padding: 10px;">${row.papad_company || row.papadCompany || ''}</td></tr>
          <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Item Name</th><td style="border: 1px solid #ccc; padding: 10px;">${row.item_name || row.itemName || ''}</td></tr>
          <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Lot No</th><td style="border: 1px solid #ccc; padding: 10px;">${row.lot_no || row.lotNo || ''}</td></tr>
          <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Qty</th><td style="border: 1px solid #ccc; padding: 10px;">${row.qty || 0}</td></tr>
          <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Total Weight</th><td style="border: 1px solid #ccc; padding: 10px;">${row.total_wt || row.totalWt || 0}</td></tr>
          <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Wages</th><td style="border: 1px solid #ccc; padding: 10px;">₹${row.wages || 0}</td></tr>
        </table>
      </div>
    `;
    printHtml(html, `Flour_Out_Return_${row.lot_no || row.id}`);
  };

  return (
    <EntryDisplay
      title="Flour Out Return Display"
      apiEndpoint="/flour-out-return"
      columns={columns}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onPrint={handlePrint}
      addNewLink="/entry/flour-out-return-create"
    />
  );
};

export default FlourOutReturnDisplay;
