import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EntryDisplay } from './entry';
import { deletePurchase } from '../utils/api';
import { printHtml } from '../utils/printHelper';
import { useAuth } from '../context/AuthContext';
import './PurchaseDisplay.css';

// Column definitions for Purchase Display
const columns = [
  { key: 'sno', title: 'S.No', render: (_val, row, idx) => idx !== undefined ? idx + 1 : (row.s_no || '') },
  { key: 'invoice_no', title: 'Invoice' },
  { key: 'po_no', title: 'P.O. No', render: (val, row) => {
    const poDisplay = val || row.po_no || row.source_order_no || (row.purchase_order_id ? `PO-${row.purchase_order_id}` : '');
    return poDisplay ? (
      <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px' }}>
        {poDisplay}
      </span>
    ) : <span style={{ color: '#94a3b8' }}>—</span>;
  } },
  { key: 'invoice_date', title: 'Date' },
  { key: 'supplier_name', title: 'Supplier' },

  { key: 'item_name', title: 'Item' },
  { key: 'lot_no', title: 'Lot No' },

  { key: 'weight', title: 'Weight' },
  { key: 'total_weight', title: 'Total Wt' },

  { key: 'rate', title: 'Rate' },

  { key: 'base_amount', title: 'Base Amt' },

  { key: 'disc_percent', title: 'Disc%' },
  { key: 'disc_amount', title: 'Disc Amt' },

  { key: 'tax_percent', title: 'Tax%' },
  { key: 'tax_amount', title: 'Tax Amt' },

  { key: 'amount', title: 'Amount' },
];

// Handle delete - using standard API
const handleDelete = async (id, onSuccess) => {
  if (!id) {
    alert('Cannot delete: missing record id');
    return;
  }
  if (!window.confirm('Are you sure you want to delete this purchase record? This will restore stock levels and revert ledger transactions.')) return;
  try {
    const result = await deletePurchase(id);
    if (result && result.success !== false) {
      alert(result.message || 'Record deleted successfully');
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
      <h2 style="color: #1f4fb2; border-bottom: 2px solid #1f4fb2; padding-bottom: 10px;">Purchase Receipt</h2>
      <table style="border-collapse: collapse; width: 100%; margin-top: 15px;">
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white; font-weight: bold; width: 150px;">S.No</th><td style="border: 1px solid #ccc; padding: 10px;">${row.s_no || ''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white; font-weight: bold;">Invoice No</th><td style="border: 1px solid #ccc; padding: 10px;">${row.inv_no || ''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white; font-weight: bold;">Date</th><td style="border: 1px solid #ccc; padding: 10px;">${row.date || ''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white; font-weight: bold;">Supplier</th><td style="border: 1px solid #ccc; padding: 10px;">${row.supplier_name || ''}</td></tr>

        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white; font-weight: bold;">Item</th><td style="border: 1px solid #ccc; padding: 10px;">${row.item_name || ''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white; font-weight: bold;">Lot No</th><td style="border: 1px solid #ccc; padding: 10px;">${row.lot_no || ''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white; font-weight: bold;">Qty</th><td style="border: 1px solid #ccc; padding: 10px;">${row.weight || ''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white; font-weight: bold;">Rate</th><td style="border: 1px solid #ccc; padding: 10px;">${row.rate || ''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white; font-weight: bold;">Amount</th><td style="border: 1px solid #ccc; padding: 10px;">${row.amount || ''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white; font-weight: bold;">Tax</th><td style="border: 1px solid #ccc; padding: 10px;">${row.tax_amount || ''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white; font-weight: bold;">Total</th><td style="border: 1px solid #ccc; padding: 10px;">${row.grand_total || row.amount || ''}</td></tr>
      </table>
    </div>
  `;
  printHtml(html, `Purchase - ${row.inv_no || 'Receipt'}`);
};

// Handle edit (navigate)
const handleEdit = (row, navigate) => {
  console.log('UPDATE ROW', row);

  if (!row?.id) {
    alert('Cannot edit: missing row.id');
    return;
  }

  navigate(`/purchase/edit/${row.id}`);
};

// Custom actions for Purchase
const PurchaseDisplay = () => {
  const navigate = useNavigate();
  const { isAdmin, hasPermission } = useAuth();

  const canEdit = isAdmin || hasPermission('Purchase', 'Display', 'can_edit') || hasPermission('Purchase', 'can_edit');
  const canDelete = isAdmin || hasPermission('Purchase', 'Display', 'can_delete') || hasPermission('Purchase', 'can_delete');
  const canPrint = isAdmin || hasPermission('Purchase', 'Display', 'can_print') || hasPermission('Purchase', 'can_print');

  const customActions = (row, onSuccess, showConfirm, showAlert) => (
    <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
      {canEdit && (
        <button 
          className="action-btn update-btn" 
          style={{ backgroundColor: '#1976d2', color: '#ffffff', border: 'none', padding: '5px 11px', borderRadius: '4px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
          onClick={() => handleEdit(row, navigate)}
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
      {row.qc_id ? (
        <>
          <button 
            className="action-btn success" 
            style={{ backgroundColor: '#2e7d32', color: '#ffffff', border: 'none', padding: '5px 11px', borderRadius: '4px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }} 
            onClick={() => navigate(`/quality/coa-display/${row.qc_id}`)}
          >
            Lab Report
          </button>
          <button 
            className="action-btn warning" 
            style={{ backgroundColor: '#ed6c02', color: '#ffffff', border: 'none', padding: '5px 11px', borderRadius: '4px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }} 
            onClick={() => navigate(`/quality/iqr-display/${row.qc_id}`)}
          >
            IC Report
          </button>
        </>
      ) : (
        row.lot_no && (
          <button 
            className="action-btn" 
            style={{ backgroundColor: '#00838f', color: '#ffffff', border: 'none', padding: '5px 11px', borderRadius: '4px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }} 
            onClick={() => navigate(`/entry/quality-control-create?lotNo=${row.lot_no}`)}
          >
            Create QC
          </button>
        )
      )}
      <button 
        className="action-btn" 
        style={{ backgroundColor: '#ff9800', color: '#ffffff', border: 'none', padding: '5px 11px', borderRadius: '4px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }} 
        onClick={() => navigate(`/entry/vehicle-movement-create?purchaseId=${row.id}&lotNo=${row.lot_no || ''}`)}
      >
        Vehicle Movement
      </button>
      {canDelete && (
        <button 
          className="action-btn delete-btn danger" 
          style={{ backgroundColor: '#d32f2f', color: '#ffffff', border: 'none', padding: '5px 11px', borderRadius: '4px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
          onClick={() => {
            if (!row.id) {
              if (showAlert) showAlert('Delete Error', 'Cannot delete: missing record id');
              return;
            }
            const doDelete = async () => {
              try {
                const result = await deletePurchase(row.id);
                if (result && result.success !== false) {
                  if (showAlert) showAlert('Success', result.message || 'Record deleted successfully');
                  if (onSuccess) onSuccess();
                } else {
                  if (showAlert) showAlert('Delete Failed', 'Delete failed: ' + (result?.message || 'Unknown error'));
                }
              } catch (err) {
                console.error('Delete error:', err);
                if (showAlert) showAlert('Delete Error', 'Delete failed: ' + err.message);
              }
            };

            if (showConfirm) {
              showConfirm(
                'Confirm Delete',
                'Are you sure you want to delete this purchase record? This will restore stock levels and revert ledger transactions.',
                doDelete
              );
            } else {
              if (window.confirm('Are you sure you want to delete this purchase record? This will restore stock levels and revert ledger transactions.')) {
                doDelete();
              }
            }
          }}
        >
          Delete
        </button>
      )}
      {!canEdit && !canPrint && !canDelete && (
        <span style={{ color: '#888', fontSize: '12px' }}>-</span>
      )}
    </div>
  );


  return (
    <EntryDisplay
      title="Purchase Display"
      apiEndpoint="/api/purchases/purchase-list"
      columns={columns}
      customActions={customActions}
    />
  );
};

export default PurchaseDisplay;

