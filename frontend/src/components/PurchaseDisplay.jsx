import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EntryDisplay } from './entry';
import { deletePurchase } from '../utils/api';
import { printHtml } from '../utils/printHelper';
import { generateVehicleInPassHtml } from '../utils/vehiclePassPrint';
import { useAuth } from '../context/AuthContext';
import './PurchaseDisplay.css';

// Classic ERP Column definitions for Purchase Display
const columns = [
  { key: 's_no', title: 'S.No', render: (val, row, idx) => (idx !== undefined ? idx + 1 : (row.s_no || row.id || '')) },
  { key: 'inv_no', title: 'Invoice No', render: (val, row) => row.inv_no || row.invoice_no || '—' },
  { 
    key: 'date', 
    title: 'Date', 
    render: (val, row) => {
      const d = val || row.date || row.invoice_date;
      if (!d) return '—';
      try {
        const dt = new Date(d);
        if (!isNaN(dt.getTime())) {
          return dt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
      } catch {}
      return String(d);
    }
  },
  { key: 'supplier_name', title: 'Supplier Name', render: (val, row) => row.supplier_name || row.supplier || '—' },
  { key: 'item_name', title: 'Item Name', render: (val, row) => row.item_name || row.item || '—' },
  { key: 'lot_no', title: 'Lot No', render: (val, row) => row.lot_no || '—' },
  { key: 'weight', title: 'Qty / Wt', render: (val, row) => row.weight ?? row.qty ?? '—' },
  { key: 'rate', title: 'Rate', render: (val, row) => (row.rate !== undefined && row.rate !== null ? `₹${row.rate}` : '—') },
  { key: 'amount', title: 'Amount', render: (val, row) => (row.amount !== undefined && row.amount !== null ? `₹${Number(row.amount).toLocaleString('en-IN')}` : '—') },
  { key: 'tax_amount', title: 'Tax Amt', render: (val, row) => (row.tax_amount !== undefined && row.tax_amount !== null ? `₹${Number(row.tax_amount).toLocaleString('en-IN')}` : '0') },
  { key: 'grand_total', title: 'Total', render: (val, row) => {
    const tot = row.grand_total ?? row.amount;
    return tot !== undefined && tot !== null ? `₹${Number(tot).toLocaleString('en-IN')}` : '—';
  }}
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

// Handle standard Purchase Invoice print
const handlePrint = (row) => {
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2 style="color: #1f4fb2; border-bottom: 2px solid #1f4fb2; padding-bottom: 10px;">Purchase Receipt</h2>
      <table style="border-collapse: collapse; width: 100%; margin-top: 15px;">
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white; font-weight: bold; width: 150px;">S.No</th><td style="border: 1px solid #ccc; padding: 10px;">${row.s_no || row.id || ''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white; font-weight: bold;">Invoice No</th><td style="border: 1px solid #ccc; padding: 10px;">${row.inv_no || row.invoice_no || ''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white; font-weight: bold;">Date</th><td style="border: 1px solid #ccc; padding: 10px;">${row.date || row.invoice_date || ''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white; font-weight: bold;">Supplier</th><td style="border: 1px solid #ccc; padding: 10px;">${row.supplier_name || row.supplier || ''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white; font-weight: bold;">Item</th><td style="border: 1px solid #ccc; padding: 10px;">${row.item_name || row.item || ''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white; font-weight: bold;">Lot No</th><td style="border: 1px solid #ccc; padding: 10px;">${row.lot_no || ''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white; font-weight: bold;">Qty / Wt</th><td style="border: 1px solid #ccc; padding: 10px;">${row.weight || row.qty || ''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white; font-weight: bold;">Rate</th><td style="border: 1px solid #ccc; padding: 10px;">${row.rate || ''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white; font-weight: bold;">Amount</th><td style="border: 1px solid #ccc; padding: 10px;">${row.amount || ''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white; font-weight: bold;">Tax</th><td style="border: 1px solid #ccc; padding: 10px;">${row.tax_amount || '0'}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white; font-weight: bold;">Total</th><td style="border: 1px solid #ccc; padding: 10px;">${row.grand_total || row.amount || ''}</td></tr>
      </table>
    </div>
  `;
  printHtml(html, `Purchase - ${row.inv_no || row.invoice_no || 'Receipt'}`);
};

// Handle In-Pass Print for Vehicle Gate Entry with full Vehicle / Driver / Lot details
const handleInPassPrint = (row, selectedCompany) => {
  const html = generateVehicleInPassHtml(row, selectedCompany);
  printHtml(html, `Vehicle_InPass_${row.vehicle_no || row.lorry_no || row.lot_no || 'GatePass'}`);
};

// Handle edit (navigate)
const handleEdit = (row, navigate) => {
  if (!row?.id) {
    alert('Cannot edit: missing row.id');
    return;
  }
  navigate(`/purchase/edit/${row.id}`);
};

// Custom actions for Purchase
const PurchaseDisplay = () => {
  const navigate = useNavigate();
  const { isAdmin, hasPermission, selectedCompany } = useAuth();

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
      {/* In-Pass Print Action Button */}
      <button 
        className="action-btn inpass-btn" 
        style={{ backgroundColor: '#0f766e', color: '#ffffff', border: 'none', padding: '5px 11px', borderRadius: '4px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
        onClick={() => handleInPassPrint(row, selectedCompany)}
        title="Print Vehicle In-Pass Gate Slip"
      >
        InPass
      </button>
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

