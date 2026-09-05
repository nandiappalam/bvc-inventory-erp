import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EntryDisplay } from './entry';
import { printHtml } from '../utils/printHelper';
import api from '../utils/api';

// Column definitions for Papad In Display showing both Papad and Flour details
const columns = [
  { key: 'sno', title: 'S.No', render: (_val, row, idx) => idx !== undefined ? idx + 1 : (row.s_no || row.sNo || '') },
  { key: 'date', title: 'Date' },
  { key: 'papad_company', title: 'Papad Company', render: (val, row) => val || row.papadCompany || '' },
  { key: 'item_name', title: 'Papad Item', render: (val, row) => val || row.itemName || '' },
  { key: 'lot_no', title: 'Lot No', render: (val, row) => val || row.lotNo || '' },
  { key: 'total_wt', title: 'Papad Wt', render: (val, row) => {
    const num = parseFloat(val || row.totalWt || row.weight || row.qty || 0);
    return num ? `${num.toFixed(3)} Kg` : '0.000 Kg';
  }},
  { key: 'flour_details', title: 'Flour Details', render: (_val, row) => {
    const kg = parseFloat(row.kg || row.papadKg || row.papad_kg || 0);
    return kg ? `${kg.toFixed(3)} Kg` : '-';
  }},
];

// Handle print
const handlePrint = (row) => {
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2 style="color: #1f4fb2; border-bottom: 2px solid #1f4fb2; padding-bottom: 10px;">Papad In Details</h2>
      <table style="border-collapse: collapse; width: 100%; margin-top: 15px;">
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">S.No</th><td style="border: 1px solid #ccc; padding: 10px;">${row.s_no||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Date</th><td style="border: 1px solid #ccc; padding: 10px;">${row.date||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Papad Company</th><td style="border: 1px solid #ccc; padding: 10px;">${row.papad_company||row.papadCompany||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Papad Item</th><td style="border: 1px solid #ccc; padding: 10px;">${row.item_name||row.itemName||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Lot No</th><td style="border: 1px solid #ccc; padding: 10px;">${row.lot_no||row.lotNo||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Papad Wt</th><td style="border: 1px solid #ccc; padding: 10px;">${row.total_wt||0} Kg</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Flour Kg</th><td style="border: 1px solid #ccc; padding: 10px;">${row.kg||row.papadKg||0} Kg</td></tr>
      </table>
    </div>
  `;
  printHtml(html, `Papad_In_${row.lot_no || row.id}`);
};

const PapadInDisplay = () => {
  const navigate = useNavigate();

  const handleEdit = (row) => {
    navigate(`/entry/papad-in-create?id=${row.id}`);
  };

  const handleDelete = async (id, refresh, showConfirm, showAlert) => {
    if (!id) {
      if (showAlert) showAlert('Error', 'Cannot delete: missing record id');
      else alert('Cannot delete: missing record id');
      return;
    }

    const doDelete = async () => {
      try {
        const res = await api(`/papad-in/${id}`, { method: 'DELETE' });
        if (res && res.success !== false) {
          if (showAlert) showAlert('Success', 'Record deleted successfully', refresh);
          else { alert('Record deleted successfully'); if (refresh) refresh(); }
        } else {
          if (showAlert) showAlert('Error', res?.message || 'Delete failed');
          else alert(res?.message || 'Delete failed');
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
      title="Papad In Display"
      apiEndpoint="/papad-in"
      columns={columns}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onPrint={handlePrint}
      addNewLink="/entry/papad-in-create"
    />
  );
};

export default PapadInDisplay;
