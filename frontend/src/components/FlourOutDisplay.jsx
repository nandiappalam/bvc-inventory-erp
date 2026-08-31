import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EntryDisplay } from './entry';
import api from '../services/api';
import { printHtml } from '../utils/printHelper';

// Column definitions for Flour Out Display
const columns = [
  { key: 'sno', title: 'S.No', render: (_val, row, idx) => idx !== undefined ? idx + 1 : (row.sNo || '') },
  { key: 'date', title: 'Date', render: (val) => val ? val.substring(0, 10) : '' },
  { key: 'sNo', title: 'Flour Out No' },
  { key: 'papadCompany', title: 'Papad Company' },
  { key: 'itemName', title: 'Item Name' },
  { key: 'lotNo', title: 'Lot No' },
  { key: 'weight', title: 'Weight' },
  { key: 'qty', title: 'Qty' },
  { key: 'totalWt', title: 'Total Wt' },
  { key: 'papadKg', title: 'Papad Kg' },
];

const FlourOutDisplay = () => {
  const navigate = useNavigate();

  // Handle delete
  const handleDelete = async (id, refresh, showConfirm, showAlert) => {
    if (!id) {
      if (showAlert) showAlert('Error', 'Cannot delete: missing record id');
      else alert('Cannot delete: missing record id');
      return;
    }

    const doDelete = async () => {
      try {
        const res = await api(`/flour-out/${id}`, { method: 'DELETE' });
        if (res && (res.success || res.success === undefined)) {
          if (showAlert) {
            showAlert('Success', 'Record deleted successfully', refresh);
          } else {
            alert('Record deleted successfully');
            if (refresh) refresh();
          }
        } else {
          if (showAlert) showAlert('Error', res?.message || 'Delete failed');
          else alert(res?.message || 'Delete failed');
        }
      } catch (err) {
        console.error('Delete error:', err);
        if (showAlert) showAlert('Error', 'Network error while deleting');
        else alert('Network error while deleting');
      }
    };

    if (showConfirm) {
      showConfirm('Delete Record', 'Are you sure you want to delete this Flour Out record?', doDelete);
    } else {
      if (window.confirm('Are you sure you want to delete this Flour Out record?')) {
        doDelete();
      }
    }
  };

  // Handle print
  const handlePrint = (row) => {
    const tableHtml = `
      <table style="border-collapse: collapse; width: 100%; margin-top: 20px; font-family: sans-serif;">
        <thead>
          <tr style="background-color: #1f4fb2; color: white;">
            <th style="border: 1px solid #ccc; padding: 10px; text-align: left;">Field</th>
            <th style="border: 1px solid #ccc; padding: 10px; text-align: left;">Detail</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th style="border: 1px solid #ccc; padding: 10px; text-align: left; background-color: #f5f5f5;">Date</th>
            <td style="border: 1px solid #ccc; padding: 10px;">${row.date ? row.date.substring(0, 10) : ''}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #ccc; padding: 10px; text-align: left; background-color: #f5f5f5;">S.No</th>
            <td style="border: 1px solid #ccc; padding: 10px;">${row.sNo || ''}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #ccc; padding: 10px; text-align: left; background-color: #f5f5f5;">Papad Company</th>
            <td style="border: 1px solid #ccc; padding: 10px;">${row.papadCompany || ''}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #ccc; padding: 10px; text-align: left; background-color: #f5f5f5;">Item Name</th>
            <td style="border: 1px solid #ccc; padding: 10px;">${row.itemName || ''}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #ccc; padding: 10px; text-align: left; background-color: #f5f5f5;">Lot No</th>
            <td style="border: 1px solid #ccc; padding: 10px;">${row.lotNo || ''}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #ccc; padding: 10px; text-align: left; background-color: #f5f5f5;">Weight</th>
            <td style="border: 1px solid #ccc; padding: 10px;">${row.weight || 0}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #ccc; padding: 10px; text-align: left; background-color: #f5f5f5;">Qty</th>
            <td style="border: 1px solid #ccc; padding: 10px;">${row.qty || 0}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #ccc; padding: 10px; text-align: left; background-color: #f5f5f5;">Total Wt</th>
            <td style="border: 1px solid #ccc; padding: 10px;">${row.totalWt || 0}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #ccc; padding: 10px; text-align: left; background-color: #f5f5f5;">Papad Kg</th>
            <td style="border: 1px solid #ccc; padding: 10px;">${row.papadKg || 0}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #ccc; padding: 10px; text-align: left; background-color: #f5f5f5;">Remarks</th>
            <td style="border: 1px solid #ccc; padding: 10px;">${row.remarks || ''}</td>
          </tr>
        </tbody>
      </table>
    `;

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #1f4fb2; border-bottom: 2px solid #1f4fb2; padding-bottom: 10px; margin: 0;">Flour Out Entry Details</h2>
        ${tableHtml}
      </div>
    `;
    printHtml(html, `Flour_Out_${row.sNo || row.id}`);
  };

  const handleEdit = (row) => {
    navigate(`/entry/flour-out-create?id=${row.id}`);
  };

  return (
    <EntryDisplay
      title="Flour Out Display"
      apiEndpoint="/api/flour-out"
      columns={columns}
      onEdit={handleEdit}
      onPrint={handlePrint}
      addNewLink="/entry/flour-out-create"
    />
  );
};

export default FlourOutDisplay;
