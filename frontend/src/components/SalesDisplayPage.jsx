import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { EntryDisplay } from './entry';
import { printHtml } from '../utils/printHelper';
import { useAuth } from '../context/AuthContext';

// Column definitions for Sales Display
const columns = [
  { key: 'sno', title: 'S.No', render: (_val, row, idx) => idx !== undefined ? idx + 1 : (row.s_no || '') },
  { key: 's_no', title: 'Bill No' },
  { key: 'date', title: 'Date', render: (val) => val ? val.substring(0, 10) : '' },
  { key: 'customer', title: 'Customer' },
  { key: 'item_name', title: 'Item Name' },
  { key: 'lot_no', title: 'Lot No' },
  { key: 'qty', title: 'Qty' },
  { key: 'weight', title: 'Weight' },
  { key: 'total_wt', title: 'Total Wt' },
  { key: 'rate', title: 'Rate' },
  { key: 'disc_perc', title: 'Disc %' },
  { key: 'tax_perc', title: 'Tax %' },
  { 
    key: 'total_amt', 
    title: 'Amount', 
    render: (_val, row) => {
      const amt = (row.grand_total !== undefined && row.grand_total !== null && Number(row.grand_total) > 0) 
        ? Number(row.grand_total) 
        : Number(row.total_amt || 0);
      return `₹${amt.toLocaleString()}`;
    } 
  },
];

// Handle delete - using standard fetch API
const handleDelete = async (id, onSuccess) => {
  if (!id) {
    alert('Cannot delete: missing record id');
    return;
  }
  if (!window.confirm('Delete this record?')) return;
  try {
    const response = await fetch(`/api/sales/${id}`, { method: 'DELETE' });
    const result = await response.json();
    if (result && (result.success || result.message)) {
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
      <h2 style="color: #1f4fb2; border-bottom: 2px solid #1f4fb2; padding-bottom: 10px;">Sales Invoice Details</h2>
      <table style="border-collapse: collapse; width: 100%; margin-top: 15px;">
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white; width: 150px;">Bill No</th><td style="border: 1px solid #ccc; padding: 10px;">${row.s_no||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Date</th><td style="border: 1px solid #ccc; padding: 10px;">${row.date ? row.date.substring(0,10) : ''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Customer</th><td style="border: 1px solid #ccc; padding: 10px;">${row.customer||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Item Name</th><td style="border: 1px solid #ccc; padding: 10px;">${row.item_name||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Lot No</th><td style="border: 1px solid #ccc; padding: 10px;">${row.lot_no||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Qty</th><td style="border: 1px solid #ccc; padding: 10px;">${row.qty||0}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Weight</th><td style="border: 1px solid #ccc; padding: 10px;">${row.weight||0}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Rate</th><td style="border: 1px solid #ccc; padding: 10px;">${row.rate||0}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Total Amount</th><td style="border: 1px solid #ccc; padding: 10px;">₹${row.total_amt||0}</td></tr>
      </table>
    </div>
  `;
  printHtml(html, `Sales_${row.s_no || row.id}`);
};

// Custom actions for Sales
const SalesDisplayPage = () => {
  const navigate = useNavigate();
  const isOrder = window.location.pathname.includes('order');
  const { isAdmin, hasPermission } = useAuth();

  const moduleName = isOrder ? 'Sales Order' : 'Sales';
  const canEdit = isAdmin || hasPermission(moduleName, 'Display', 'can_edit') || hasPermission(moduleName, 'can_edit');
  const canDelete = isAdmin || hasPermission(moduleName, 'Display', 'can_delete') || hasPermission(moduleName, 'can_delete');
  const canPrint = isAdmin || hasPermission(moduleName, 'Display', 'can_print') || hasPermission(moduleName, 'can_print');

  const handleEdit = (row) => {
    if (isOrder) {
      navigate(`/entry/sales-order-create?id=${row.id}`);
    } else {
      navigate(`/entry/sales-create?id=${row.id}`);
    }
  };

  const customActions = (row, onSuccess, showConfirm, showAlert) => {
    // Parse items to extract lotNo and qc_id
    let items = [];
    try {
      items = typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || []);
    } catch (e) {
      console.error(e);
    }
    const firstItem = items[0] || {};
    const lotNo = firstItem.lotNo || firstItem.lot_no || '';
    const qcId = firstItem.qc_id;

    const doDelete = async () => {
      try {
        const response = await fetch(`/api/sales/${row.id}`, { method: 'DELETE' });
        const result = await response.json();
        if (result && (result.success || result.message)) {
          if (showAlert) showAlert('Success', 'Record deleted successfully');
          else alert('Record deleted successfully');
          if (onSuccess) onSuccess();
        } else {
          const errorMsg = result?.message || 'Unknown error';
          if (showAlert) showAlert('Error', 'Delete failed: ' + errorMsg);
          else alert('Delete failed: ' + errorMsg);
        }
      } catch (err) {
        console.error('Delete error:', err);
        if (showAlert) showAlert('Error', 'Delete failed: ' + err.message);
        else alert('Delete failed: ' + err.message);
      }
    };

    const handleDeleteClick = () => {
      if (!row.id) {
        if (showAlert) showAlert('Error', 'Cannot delete: missing record id');
        else alert('Cannot delete: missing record id');
        return;
      }
      if (showConfirm) {
        showConfirm(
          'Confirm Delete',
          'Are you sure you want to delete this sales record? This will restore stock levels.',
          doDelete
        );
      } else {
        if (window.confirm('Delete this record?')) {
          doDelete();
        }
      }
    };

    return (
      <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
        {canEdit && (
          <button 
            className="action-btn update-btn" 
            style={{ backgroundColor: '#1976d2', color: '#ffffff', border: 'none', padding: '5px 11px', borderRadius: '4px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
            onClick={() => handleEdit(row)}
          >
            Update
          </button>
        )}
        {canPrint && (
          <button 
            className="action-btn print-btn" 
            style={{ backgroundColor: '#0288d1', color: '#ffffff', border: 'none', padding: '5px 11px', borderRadius: '4px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
            onClick={() => handlePrint(row)}
          >
            Print
          </button>
        )}
        {qcId ? (
          <button 
            className="action-btn success" 
            style={{ backgroundColor: '#2e7d32', color: '#ffffff', border: 'none', padding: '5px 11px', borderRadius: '4px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }} 
            onClick={() => navigate(`/quality/coa-display/${qcId}`)}
          >
            COA Report
          </button>
        ) : (
          lotNo && (
            <button 
              className="action-btn" 
              style={{ backgroundColor: '#00838f', color: '#ffffff', border: 'none', padding: '5px 11px', borderRadius: '4px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }} 
              onClick={() => navigate(`/entry/quality-control-create?lotNo=${lotNo}`)}
            >
              QC Test
            </button>
          )
        )}
        {canDelete && (
          <button 
            className="action-btn delete-btn danger" 
            style={{ backgroundColor: '#d32f2f', color: '#ffffff', border: 'none', padding: '5px 11px', borderRadius: '4px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
            onClick={handleDeleteClick}
          >
            Delete
          </button>
        )}
        {!canEdit && !canPrint && !canDelete && <span style={{ color: '#888', fontSize: '12px' }}>-</span>}
      </div>
    );
  };

  return (
    <EntryDisplay
      title={isOrder ? "Sales Order Display" : "Sales Display"}
      apiEndpoint={isOrder ? "/api/sales?is_order=1" : "/api/sales?is_order=0"}
      columns={columns}
      customActions={customActions}
      addNewLink={isOrder ? "/entry/sales-order-create" : "/entry/sales-create"}
    />
  );
};

export default SalesDisplayPage;
