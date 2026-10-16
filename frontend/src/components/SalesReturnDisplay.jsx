import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EntryDisplay } from './entry';
import { printFormalSalesBill } from '../utils/formalBillPrinter';
import { useAuth } from '../context/AuthContext';
import api from '../services/api.js';

// Column definitions for Sales Return Display
const columns = [
  { key: 'sno', title: 'S.No', render: (_val, row, idx) => idx !== undefined ? idx + 1 : (row.s_no || '') },
  { key: 's_no', title: 'Return No', render: (val, row) => row.bill_no || row.s_no || val || '' },
  { key: 'date', title: 'Date', render: (val) => val ? String(val).substring(0, 10) : '' },
  { key: 'customer', title: 'Customer', render: (val, row) => row.customer_name || row.customer || val || '' },
  { key: 'total_qty', title: 'Total Qty', render: (val) => val ? Number(val).toLocaleString() : '0' },
  { key: 'bill_amt', title: 'Taxable Amt', render: (val) => `₹${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
  { 
    key: 'tax_percent', 
    title: 'Tax %',
    render: (val, row) => {
      const rate = parseFloat(val !== undefined && val !== null ? val : (row.tax_rate || row.tax_perc || 0));
      if (!rate) return '0%';
      const half = (rate / 2).toFixed(1).replace(/\.0$/, '');
      return `${rate}% (${half}%+${half}%)`;
    }
  },
  { key: 'tax_amt', title: 'Tax Amt', render: (val) => `₹${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
  { 
    key: 'total_amt', 
    title: 'Return Value', 
    render: (val, row) => {
      const amt = parseFloat(val || row.grand_total || 0);
      return (
        <span style={{ fontWeight: '800', color: '#dc2626' }}>
          ₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      );
    }
  },
];

const SalesReturnDisplay = () => {
  const navigate = useNavigate();
  const { selectedCompany } = useAuth();

  const handleEdit = (row) => {
    navigate(`/entry/sales-return-create?id=${row.id}`);
  };

  const handlePrint = async (row) => {
    try {
      let fullRecord = row;
      if (!row.items || row.items.length === 0) {
        const fetched = await api(`/sales-returns/${row.id}`).catch(() => null);
        if (fetched) fullRecord = fetched;
      }
      printFormalSalesBill({
        documentType: 'SALES RETURN',
        record: fullRecord,
        company: selectedCompany,
        items: fullRecord.items || []
      });
    } catch (e) {
      console.error('Print sales return error:', e);
      printFormalSalesBill({
        documentType: 'SALES RETURN',
        record: row,
        company: selectedCompany,
        items: row.items || []
      });
    }
  };

  const handleDelete = async (rowOrId, refresh, showConfirm, showAlert) => {
    const id = typeof rowOrId === 'object' ? rowOrId.id : rowOrId;
    if (!id) {
      if (showAlert) showAlert('Error', 'Cannot delete: missing record id');
      else alert('Cannot delete: missing record id');
      return;
    }

    const doDelete = async () => {
      try {
        const res = await api(`/sales-returns/${id}`, { method: 'DELETE' });
        if (res && res.success !== false) {
          if (showAlert) showAlert('Success', 'Record deleted successfully', refresh);
          else {
            alert('Record deleted successfully');
            if (refresh) refresh();
          }
        } else {
          if (showAlert) showAlert('Error', 'Delete failed: ' + (res?.message || 'Unknown error'));
          else alert('Delete failed: ' + (res?.message || 'Unknown error'));
        }
      } catch (err) {
        console.error(err);
        if (showAlert) showAlert('Error', 'Delete failed: ' + err.message);
        else alert('Delete failed: ' + err.message);
      }
    };

    if (showConfirm) {
      showConfirm('Delete Record', 'Delete this sales return record?', doDelete);
    } else if (window.confirm('Delete this sales return record?')) {
      doDelete();
    }
  };

  return (
    <EntryDisplay
      title="Sales Return Display"
      apiEndpoint="/api/sales-returns"
      columns={columns}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onPrint={handlePrint}
      addNewLink="/entry/sales-return-create"
    />
  );
};

export default SalesReturnDisplay;
