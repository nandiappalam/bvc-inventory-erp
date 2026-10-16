import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { EntryDisplay } from './entry';
import { printHtml } from '../utils/printHelper';
import { useAuth } from '../context/AuthContext';
import api from '../services/api.js';
import DigitalDocumentModal from './documents/DigitalDocumentModal';

import { printFormalSalesBill } from '../utils/formalBillPrinter';

// Column definitions for Sales Display
const columns = [
  { key: 'sno', title: 'S.No', render: (_val, row, idx) => idx !== undefined ? idx + 1 : (row.s_no || '') },
  { key: 's_no', title: 'Doc No', render: (val, row) => row.bill_no || row.s_no || val || '' },
  { key: 'date', title: 'Date', render: (val) => val ? String(val).substring(0, 10) : '' },
  { key: 'customer', title: 'Customer', render: (val, row) => row.customer_name || row.customer || val || '' },
  { key: 'item_name', title: 'Item Name' },
  { key: 'lot_no', title: 'Lot No' },
  { key: 'qty', title: 'Qty', render: (val) => val ? Number(val).toLocaleString() : '0' },
  { key: 'rate', title: 'Rate', render: (val) => val ? `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-' },
  { key: 'disc_perc', title: 'Disc %', render: (val) => val ? `${val}%` : '-' },
  { 
    key: 'tax_perc', 
    title: 'Tax %', 
    render: (val, row) => {
      const rate = parseFloat(val !== undefined && val !== null ? val : (row.tax_rate || row.tax_percent || 0));
      if (!rate) return '0%';
      const half = (rate / 2).toFixed(1).replace(/\.0$/, '');
      return `${rate}% (${half}%+${half}%)`;
    }
  },
  { 
    key: 'total_amt', 
    title: 'Total Amount', 
    render: (_val, row) => {
      const amt = (row.grand_total !== undefined && row.grand_total !== null && Number(row.grand_total) > 0) 
        ? Number(row.grand_total) 
        : Number(row.total_amt || 0);
      return (
        <span style={{ fontWeight: '800', color: '#1e3a8a' }}>
          ₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      );
    } 
  },
];

// Custom actions for Sales
const SalesDisplayPage = () => {
  const navigate = useNavigate();
  const isOrder = window.location.pathname.includes('order');
  const { isAdmin, hasPermission, selectedCompany } = useAuth();
  const [activeDoc, setActiveDoc] = useState(null);

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

  const handlePrint = async (row) => {
    try {
      let fullRecord = row;
      if (!row.items || row.items.length === 0) {
        const fetched = await api(`/sales/${row.id}`).catch(() => null);
        if (fetched) fullRecord = fetched;
      }
      printFormalSalesBill({
        documentType: isOrder ? 'SALES ORDER' : 'TAX INVOICE',
        record: fullRecord,
        company: selectedCompany,
        items: fullRecord.items || []
      });
    } catch (e) {
      console.error('Print sales error:', e);
      printFormalSalesBill({
        documentType: isOrder ? 'SALES ORDER' : 'TAX INVOICE',
        record: row,
        company: selectedCompany,
        items: row.items || []
      });
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
    const lotNo = firstItem.lotNo || firstItem.lot_no || row.lot_no || '';
    const qcId = firstItem.qc_id || row.qc_id;

    const amt = (row.grand_total !== undefined && row.grand_total !== null && Number(row.grand_total) > 0) 
      ? Number(row.grand_total) 
      : Number(row.total_amt || 0);

    const doDelete = async () => {
      try {
        const result = await api(`/sales/${row.id}`, { method: 'DELETE' });
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
        <button 
          className="action-btn" 
          style={{ backgroundColor: '#0f172a', color: '#ffffff', border: 'none', padding: '5px 11px', borderRadius: '4px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
          onClick={() => setActiveDoc({
            documentType: isOrder ? 'Sales Order' : 'Sales Invoice',
            documentId: row.id || row.s_no,
            documentNo: row.inv_no || (row.s_no ? `SI-${row.s_no}` : `SI-${row.id}`),
            partyName: row.customer || 'Valued Customer',
            totalAmount: amt,
            date: row.date ? row.date.substring(0, 10) : new Date().toISOString().split('T')[0],
            itemSummary: row.item_name ? `${row.item_name} (${row.qty || ''} bags)` : 'Sales Invoice Goods',
            status: 'VALID'
          })}
          title="Open Digital Document, BVC QR, PDF & UPI Payment"
        >
          Digital Doc
        </button>
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
    <>
      <EntryDisplay
        title={isOrder ? "Sales Order Display" : "Sales Display"}
        apiEndpoint={isOrder ? "/api/sales?is_order=1" : "/api/sales?is_order=0"}
        columns={columns}
        customActions={customActions}
        addNewLink={isOrder ? "/entry/sales-order-create" : "/entry/sales-create"}
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

export default SalesDisplayPage;
