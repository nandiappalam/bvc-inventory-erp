import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EntryDisplay } from './entry';
import { api, deletePurchase } from '../utils/api';
import { printHtml } from '../utils/printHelper';
import { generateVehicleInPassHtml } from '../utils/vehiclePassPrint';
import { generatePurchasePrintHtml } from '../utils/purchasePrintHelper';
import { useAuth } from '../context/AuthContext';
import DigitalDocumentModal from './documents/DigitalDocumentModal';
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
  { key: 'stock_type', title: 'Stock Type', render: (val, row) => row.stock_type || row.stockType || 'RM' },
  { key: 'gross_weight', title: 'Cross Weight (KG)', render: (val, row) => row.gross_weight ?? row.cross_weight ?? '—' },
  { key: 'tare_weight', title: 'Tare Weight (KG)', render: (val, row) => row.tare_weight ?? '—' },
  { key: 'net_weight', title: 'Net Weight (KG)', render: (val, row) => row.net_weight ?? '—' },
  { key: 'item_name', title: 'Item Name', render: (val, row) => row.item_name || row.item || '—' },
  { key: 'lot_no', title: 'Lot No', render: (val, row) => row.lot_no || '—' },
  { key: 'weight', title: 'Qty / Wt', render: (val, row) => row.weight ?? row.qty ?? '—' },
  { key: 'rate', title: 'Rate', render: (val, row) => (row.rate !== undefined && row.rate !== null ? `₹${row.rate}` : '—') },
  { key: 'disc_percent', title: 'Disc %', render: (val, row) => `${row.disc_percent ?? 0}%` },
  { key: 'tax_percent', title: 'Tax Rate %', render: (val, row) => `${row.tax_percent ?? 0}%` },
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
  const confirmed = window.__appConfirm ? await window.__appConfirm({
    title: 'Confirm Purchase Deletion',
    message: 'Are you sure you want to delete this purchase record? This will restore stock levels and revert ledger transactions.',
    confirmText: 'Delete Purchase',
    confirmColor: 'error'
  }) : window.confirm('Are you sure you want to delete this purchase record? This will restore stock levels and revert ledger transactions.');
  if (!confirmed) return;
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

// Handle standard Purchase Invoice print with clear itemized table and voucher details
const handlePrint = async (row, selectedCompany) => {
  let fullData = { ...row };
  if (row.id) {
    try {
      const response = await api(`/purchases/${row.id}`);
      const fetched = response?.data || response;
      if (!fetched?.id) throw new Error('Purchase details were not returned by the server.');
      fullData = { ...row, ...fetched };
    } catch (error) {
      alert(`Could not load purchase details for printing: ${error.message}`);
      return;
    }
  }

  const html = generatePurchasePrintHtml(fullData, selectedCompany);
  printHtml(html, `Purchase_Invoice_${fullData.inv_no || fullData.invoice_no || fullData.s_no || 'Receipt'}`);
};

// Handle In-Pass Print for Vehicle Gate Entry with full Vehicle / Driver / Lot details
const handleInPassPrint = async (row, selectedCompany) => {
  let fullData = { ...row };
  if (row.id) {
    try {
      const response = await api(`/purchases/${row.id}`);
      const fetched = response?.data || response;
      if (!fetched?.id) throw new Error('Purchase details were not returned by the server.');
      fullData = { ...row, ...fetched };
    } catch (err) {
      alert(`Could not load purchase details for InPass: ${err.message}`);
      return;
    }
  }
  fullData.transporter_name = fullData.transporter_name || row.transporter_name || row.transporter;
  fullData.transporter = fullData.transporter_name || row.transporter_name || row.transporter || row.transport;
  const html = generateVehicleInPassHtml(fullData, selectedCompany);
  printHtml(html, `Vehicle_InPass_${fullData.vehicle_no || fullData.lorry_no || fullData.lot_no || 'GatePass'}`);
};

// Handle edit (navigate)
const handleEdit = (row, navigate) => {
  const targetId = row?.id || row?.s_no;
  if (!targetId) {
    alert('Cannot edit: missing record ID');
    return;
  }
  navigate(`/purchase/edit/${targetId}`);
};

// Custom actions for Purchase
const PurchaseDisplay = () => {
  const navigate = useNavigate();
  const { isAdmin, hasPermission, selectedCompany } = useAuth();
  const [activeDoc, setActiveDoc] = useState(null);

  const canEdit = isAdmin || hasPermission('Purchase', 'Display', 'can_edit') || hasPermission('Purchase', 'can_edit');
  const canDelete = isAdmin || hasPermission('Purchase', 'Display', 'can_delete') || hasPermission('Purchase', 'can_delete');
  const canPrint = isAdmin || hasPermission('Purchase', 'Display', 'can_print') || hasPermission('Purchase', 'can_print');

  const customActions = (row, onSuccess, showConfirm, showAlert) => (
    <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
      <button 
        className="action-btn" 
        style={{ backgroundColor: '#0f172a', color: '#ffffff', border: 'none', padding: '5px 11px', borderRadius: '4px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
        onClick={() => setActiveDoc({
          documentType: 'Purchase Invoice',
          documentId: row.id || row.s_no,
          documentNo: row.inv_no || row.invoice_no || `PUR-${row.s_no || row.id}`,
          partyName: row.supplier_name || row.supplier,
          totalAmount: parseFloat(row.grand_total || row.total_amount || 0),
          date: row.date || row.invoice_date,
          itemSummary: row.item_name ? `${row.item_name} (${row.qty || ''} bags)` : 'Raw Commodity Inward',
          status: 'VALID'
        })}
        title="Open Digital Document, BVC QR, PDF & Signatures"
      >
        Digital Doc
      </button>
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
          onClick={() => handlePrint(row, selectedCompany)}
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
            IQ Report
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
    <>
      <EntryDisplay
        title="Purchase Display"
        apiEndpoint="/api/purchases/purchase-list"
        columns={columns}
        customActions={customActions}
      />
      {activeDoc && (
        <DigitalDocumentModal
          open={Boolean(activeDoc)}
          onClose={() => setActiveDoc(null)}
          documentType={activeDoc.documentType}
          documentId={activeDoc.documentId}
          documentNo={activeDoc.documentNo}
          partyName={activeDoc.partyName}
          totalAmount={activeDoc.totalAmount}
          date={activeDoc.date}
          itemSummary={activeDoc.itemSummary}
          status={activeDoc.status}
        />
      )}
    </>
  );
};

export default PurchaseDisplay;
