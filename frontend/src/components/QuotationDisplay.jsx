import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EntryDisplay } from './entry';
import api from '../services/api.js';
import { printFormalSalesBill } from '../utils/formalBillPrinter';
import { useAuth } from '../context/AuthContext';

// Comprehensive Column definitions for Quotation Display
const columns = [
  { 
    key: 'sno', 
    title: 'S.No', 
    render: (_val, _row, idx) => (idx !== undefined ? idx + 1 : 1) 
  },
  { 
    key: 'bill_no', 
    title: 'Quotation No',
    render: (val, row) => row.bill_no || row.s_no || row.sNo || val || ''
  },
  { 
    key: 'date', 
    title: 'Date',
    render: (val) => val ? String(val).substring(0, 10) : ''
  },
  { 
    key: 'customer', 
    title: 'Customer Name', 
    render: (val, row) => row.customer_name || (val && isNaN(val) ? val : '') || row.customer || 'Customer'
  },
  { 
    key: 'item_name', 
    title: 'Item(s)', 
    render: (val, row) => {
      if (val) return val;
      if (Array.isArray(row.items) && row.items.length > 0) {
        return row.items.map(it => it.item_name).filter(Boolean).join(', ');
      }
      return '-';
    }
  },
  { 
    key: 'qty', 
    title: 'Total Qty',
    render: (val, row) => {
      const q = parseFloat(val || (Array.isArray(row.items) ? row.items.reduce((s, it) => s + (parseFloat(it.qty) || 0), 0) : 0));
      return q ? q.toLocaleString() : '0';
    }
  },
  { 
    key: 'bill_amt', 
    title: 'Taxable Amt', 
    render: (val) => {
      const num = parseFloat(val || 0);
      return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  },
  { 
    key: 'tax_percent', 
    title: 'Tax %',
    render: (val, row) => {
      const rate = parseFloat(val !== undefined && val !== null ? val : (row.tax_perc || 0));
      if (!rate) return '0% (Exempt)';
      const half = (rate / 2).toFixed(1).replace(/\.0$/, '');
      return `${rate}% (${half}% + ${half}%)`;
    }
  },
  { 
    key: 'tax_amt', 
    title: 'Tax Amt',
    render: (val) => {
      const num = parseFloat(val || 0);
      return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  },
  { 
    key: 'deduction_amount', 
    title: 'Disc / Ded',
    render: (val) => {
      const num = parseFloat(val || 0);
      return num > 0 ? `-₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00';
    }
  },
  { 
    key: 'total_amt', 
    title: 'Grand Total', 
    render: (val, row) => {
      const num = parseFloat(val || row.amount || row.grand_total || 0);
      return (
        <span style={{ fontWeight: '800', color: '#1e3a8a' }}>
          ₹{num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      );
    }
  },
  { 
    key: 'pay_type', 
    title: 'Payment Mode',
    render: (val) => val || 'Cash'
  }
];

const QuotationDisplay = () => {
  const navigate = useNavigate();
  const { selectedCompany } = useAuth();

  const handleEdit = (row) => {
    navigate(`/entry/quotation-create?id=${row.id}`);
  };

  const handlePrint = async (row) => {
    try {
      // Fetch full quotation record with items
      let fullRecord = row;
      if (!row.items || row.items.length === 0) {
        const fetched = await api(`/quotations/${row.id}`).catch(() => null);
        if (fetched) fullRecord = fetched;
      }
      printFormalSalesBill({
        documentType: 'QUOTATION',
        record: fullRecord,
        company: selectedCompany,
        items: fullRecord.items || []
      });
    } catch (err) {
      console.error('Print quotation error:', err);
      printFormalSalesBill({
        documentType: 'QUOTATION',
        record: row,
        company: selectedCompany,
        items: row.items || []
      });
    }
  };

  const handleDelete = async (row, refresh) => {
    const id = row?.id;
    if (!id) {
      alert('Cannot delete: missing record id');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete Quotation #${row.bill_no || row.s_no || id}?`)) return;
    try {
      const result = await api(`/quotations/${id}`, { method: 'DELETE' });
      if (result && result.success !== false) {
        alert('Quotation deleted successfully');
        if (refresh) refresh();
      } else {
        alert('Delete failed: ' + (result?.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Delete failed: ' + err.message);
    }
  };

  return (
    <EntryDisplay
      title="Quotation Display"
      apiEndpoint="/quotations"
      tableName="quotations"
      columns={columns}
      onEdit={handleEdit}
      onPrint={handlePrint}
      onDelete={handleDelete}
      addNewLink="/entry/quotation-create"
    />
  );
};

export default QuotationDisplay;
