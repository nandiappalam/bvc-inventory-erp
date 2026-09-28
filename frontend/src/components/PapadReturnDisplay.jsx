import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EntryDisplay } from './entry';
import api from '../services/api';
import { printHtml } from '../utils/printHelper';

const columns = [
  { key: 's_no', title: 'S.No', render: (_val, row, idx) => idx !== undefined ? idx + 1 : (row.s_no || row.sNo || '') },
  { key: 'date', title: 'Date', render: (val, row) => (val || row?.date) ? String(val || row?.date).substring(0, 10) : '' },
  { key: 's_no', title: 'Return No', render: (val, row) => val || row?.s_no || row?.sNo || '' },
  { key: 'papad_company', title: 'Papad Company', render: (val, row) => val || row?.papad_company || row?.papadCompany || '' },
  { key: 'papad_balance', title: 'Papad Bal (Kg)', render: (val, row) => parseFloat(val || row?.papad_balance || row?.papadBalance || 0).toFixed(2) },
  { key: 'payment_balance', title: 'Pymt Bal (₹)', render: (val, row) => parseFloat(val || row?.payment_balance || row?.paymentBalance || 0).toFixed(2) },
  { key: 'type', title: 'Type', render: (val, row) => val || row?.type || 'Less' },
  { key: 'papad_less', title: 'Papad Less (Kg)', render: (val, row) => parseFloat(val || row?.papad_less || row?.papadLess || 0).toFixed(2) },
  { key: 'payment_less', title: 'Payment Less (₹)', render: (val, row) => parseFloat(val || row?.payment_less || row?.paymentLess || 0).toFixed(2) },
  { key: 'remarks', title: 'Remarks', render: (val, row) => val || row?.remarks || '-' }
];

const PapadReturnDisplay = () => {
  const navigate = useNavigate();

  const handleEdit = (row) => {
    navigate(`/entry/papad-return-create?id=${row.id}`);
  };

  const handleDelete = async (id, refresh, showConfirm, showAlert) => {
    if (!id) {
      if (showAlert) showAlert('Error', 'Cannot delete: missing record id');
      else alert('Cannot delete: missing record id');
      return;
    }
    const doDelete = async () => {
      try {
        const res = await api(`/papad-returns/${id}`, { method: 'DELETE' });
        if (res && (res.success || res.success === undefined || res.message)) {
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
      showConfirm('Delete Record', 'Are you sure you want to delete this Papad Return record?', doDelete);
    } else {
      if (window.confirm('Delete this record?')) {
        doDelete();
      }
    }
  };

  const handlePrint = (row) => {
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #1f4fb2; border-bottom: 2px solid #1f4fb2; padding-bottom: 10px;">Papad Return Details</h2>
        <table style="border-collapse: collapse; width: 100%; margin-top: 15px;">
          <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">S.No</th><td style="border: 1px solid #ccc; padding: 10px;">${row.s_no || ''}</td></tr>
          <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Date</th><td style="border: 1px solid #ccc; padding: 10px;">${row.date ? String(row.date).substring(0, 10) : ''}</td></tr>
          <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Papad Company</th><td style="border: 1px solid #ccc; padding: 10px;">${row.papad_company || row.papadCompany || ''}</td></tr>
          <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Papad Balance</th><td style="border: 1px solid #ccc; padding: 10px;">${parseFloat(row.papad_balance || row.papadBalance || 0).toFixed(2)} Kg</td></tr>
          <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Payment Balance</th><td style="border: 1px solid #ccc; padding: 10px;">₹${parseFloat(row.payment_balance || row.paymentBalance || 0).toFixed(2)}</td></tr>
          <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Type</th><td style="border: 1px solid #ccc; padding: 10px;">${row.type || 'Less'}</td></tr>
          <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Papad Less</th><td style="border: 1px solid #ccc; padding: 10px;">${parseFloat(row.papad_less || row.papadLess || 0).toFixed(2)} Kg</td></tr>
          <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Payment Less</th><td style="border: 1px solid #ccc; padding: 10px;">₹${parseFloat(row.payment_less || row.paymentLess || 0).toFixed(2)}</td></tr>
          <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Remarks</th><td style="border: 1px solid #ccc; padding: 10px;">${row.remarks || ''}</td></tr>
        </table>
      </div>
    `;
    printHtml(html, `Papad_Return_${row.s_no || row.id}`);
  };

  return (
    <div className="window">
      <EntryDisplay
        title="Papad Return Display"
        apiEndpoint="/papad-returns"
        columns={columns}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onPrint={handlePrint}
        addNewLink="/entry/papad-return-create"
      />
    </div>
  );
};

export default PapadReturnDisplay;
