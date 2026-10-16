import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EntryDisplay } from './entry';
import { printFormalSalesBill } from '../utils/formalBillPrinter';
import { useAuth } from '../context/AuthContext';
import api from '../services/api.js';

// Column definitions matching the database schema
const columns = [
  { key: 'bill_no', title: 'Export Invoice No' },
  { key: 'date', title: 'Date', render: (val) => val ? String(val).substring(0, 10) : '' },
  { key: 'order_no_dt', title: 'Order No/Dt' },
  { key: 'dis_port', title: 'Dis Port' },
  { key: 'dest_country', title: 'Dest Country' },
  { key: 'sender_name', title: 'Sender', render: (v, r) => v || r.sender || '-' },
  { key: 'consignee_name', title: 'Consignee', render: (v, r) => v || r.consignee || '-' },
  { key: 'total_qty', title: 'Total Qty (Bxs)' },
  { key: 'total_usd_amt', title: 'Total USD', render: (v) => v ? `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '$0.00' },
  { key: 'total_inr_amt', title: 'Total INR', render: (v) => (
    <span style={{ fontWeight: '800', color: '#1e3a8a' }}>
      ₹{Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
    </span>
  ) },
];

const SalesExportDisplay = () => {
  const navigate = useNavigate();
  const { selectedCompany } = useAuth();

  const handleEdit = (row) => {
    navigate(`/entry/sales-export-create?id=${row.id}`);
  };

  const handlePrint = async (row) => {
    try {
      let fullRecord = row;
      if (!row.items || row.items.length === 0) {
        const fetched = await api(`/sales-export-orders/${row.id}`).catch(() => null);
        if (fetched) fullRecord = fetched;
      }
      printFormalSalesBill({
        documentType: 'EXPORT INVOICE',
        record: fullRecord,
        company: selectedCompany,
        items: fullRecord.items || []
      });
    } catch (e) {
      console.error('Print export invoice error:', e);
      printFormalSalesBill({
        documentType: 'EXPORT INVOICE',
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
        const res = await api(`/sales-export-orders/${id}`, { method: 'DELETE' });
        if (res && res.success !== false) {
          if (showAlert) showAlert('Success', 'Record deleted successfully', refresh);
          else {
            alert('Record deleted successfully');
            if (refresh) refresh();
          }
        } else {
          if (showAlert) showAlert('Error', 'Delete failed');
          else alert('Delete failed');
        }
      } catch (err) {
        console.error(err);
        if (showAlert) showAlert('Error', 'Delete failed: ' + err.message);
        else alert('Delete failed: ' + err.message);
      }
    };

    if (showConfirm) {
      showConfirm('Delete Record', 'Delete this export sales record?', doDelete);
    } else if (window.confirm('Delete this export sales record?')) {
      doDelete();
    }
  };

  return (
    <EntryDisplay
      title="Sales Export Display"
      apiEndpoint="/api/sales-export-orders?is_order=0"
      columns={columns}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onPrint={handlePrint}
      addNewLink="/entry/sales-export-create"
    />
  );
};

export default SalesExportDisplay;
