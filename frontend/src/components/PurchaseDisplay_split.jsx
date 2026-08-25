import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EntryDisplay } from './entry';
import { deletePurchase } from '../utils/api';
import { printHtml } from '../utils/printHelper';

// NOTE:
// This is an optional replacement component for PurchaseDisplay.jsx.
// It renders:
// 1) Items grid only (no deduction/totals per row)
// 2) Purchase invoice summary once via GET /api/purchases/:id/summary

const itemColumns = [
  { key: 'inv_no', title: 'Invoice' },
  { key: 'date', title: 'Date' },
  { key: 'supplier_name', title: 'Supplier' },
  {
    key: 'address',
    title: 'Address',
    render: (row) => row.address?.split('\n')[0] || '',
  },

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

  // amount here is taxable+tax in current ERP
  { key: 'amount', title: 'Amount' },
];

const handleDelete = async (id, onSuccess) => {
  if (!id) {
    alert('Cannot delete: missing record id');
    return;
  }
  if (!window.confirm('Delete this record?')) return;
  try {
    const result = await deletePurchase(id);
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

const handlePrint = (row) => {
  const html = `
    <html>
      <head>
        <title>Purchase - ${row.inv_no || ''}</title>
        <style>
          body { font-family: Arial; padding: 20px; }
          h2 { color: #1f4fb2; }
          table { border-collapse: collapse; width: 100%; margin-top: 15px; }
          th, td { border: 1px solid #ccc; padding: 10px; text-align: left; }
          th { background: #1f4fb2; color: white; font-weight: bold; }
          tr:nth-child(even) { background: #f0f6ff; }
        </style>
      </head>
      <body>
        <h2>Purchase Receipt</h2>
        <table>
          <tr><th>S.No</th><td>${row.s_no || ''}</td></tr>
          <tr><th>Invoice No</th><td>${row.inv_no || ''}</td></tr>
          <tr><th>Date</th><td>${row.date || ''}</td></tr>
          <tr><th>Supplier</th><td>${row.supplier_name || ''}</td></tr>
          <tr><th>Address</th><td>${row.address || ''}</td></tr>
          <tr><th>Item</th><td>${row.item_name || ''}</td></tr>
          <tr><th>Lot No</th><td>${row.lot_no || ''}</td></tr>
          <tr><th>Qty</th><td>${row.weight || ''}</td></tr>
          <tr><th>Rate</th><td>${row.rate || ''}</td></tr>
          <tr><th>Amount</th><td>${row.amount || ''}</td></tr>
          <tr><th>Tax</th><td>${row.tax_amount || ''}</td></tr>
        </table>
      </body>
    </html>
  `;

  printHtml(html, `Purchase - ${row.inv_no || ''}`)
};

const PurchaseDisplay_split = () => {
  const navigate = useNavigate();

  const [summaryByPurchaseId, setSummaryByPurchaseId] = useState({});
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Minimal: use the existing EntryDisplay’s row selection by reading last fetched table rows
  // This component assumes /purchase-list returns multiple rows per purchase.
  // We'll call summary endpoint for each unique id once.
  const fetchSummariesForRows = async (rows) => {
    const ids = Array.from(new Set((rows || []).map(r => r.id).filter(Boolean)));
    if (!ids.length) return;

    const toFetch = ids.filter(id => summaryByPurchaseId[id] == null);
    if (!toFetch.length) return;

    setSummaryLoading(true);
    try {
      const results = await Promise.all(
        toFetch.map(id => fetch(`/api/purchases/${id}/summary`).then(r => r.json()))
      );
      const next = { ...summaryByPurchaseId };
      results.forEach((res, i) => {
        const purchaseId = toFetch[i];
        next[purchaseId] = res;
      });
      setSummaryByPurchaseId(next);
    } catch (e) {
      console.error('summary fetch error', e);
    } finally {
      setSummaryLoading(false);
    }
  };

  const customActions = (row, onSuccess) => (
    <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', alignItems: 'center' }}>
      <button 
        className="action-btn update-btn" 
        style={{ backgroundColor: '#1976d2', color: '#ffffff', border: 'none', padding: '5px 11px', borderRadius: '4px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
        onClick={() => navigate(`/purchase/edit/${row.id}`)}
      >
        Update
      </button>
      <button 
        className="action-btn print-btn" 
        style={{ backgroundColor: '#0288d1', color: '#ffffff', border: 'none', padding: '5px 11px', borderRadius: '4px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
        onClick={() => handlePrint(row)}
      >
        Print
      </button>
      <button 
        className="action-btn delete-btn danger" 
        style={{ backgroundColor: '#d32f2f', color: '#ffffff', border: 'none', padding: '5px 11px', borderRadius: '4px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
        onClick={() => handleDelete(row.id, onSuccess)}
      >
        Delete
      </button>
    </div>
  );

  // We rely on EntryDisplay internals to provide rows via a callback isn't available.
  // Therefore: we just render the grid; summary must be integrated once EntryDisplay exposes data.
  // This file is a scaffold and not wired to EntryDisplay internals.

  const SummaryPlaceholder = useMemo(() => {
    return (
      <div style={{ marginTop: 12, color: '#666' }}>
        Invoice summary UI requires wiring into EntryDisplay row data.
        Use backend endpoint: GET /api/purchases/:id/summary
        {summaryLoading ? ' (loading...)' : ''}
      </div>
    );
  }, [summaryLoading]);

  return (
    <div>
      <EntryDisplay
        title="Purchase Display"
        apiEndpoint="/api/purchases/purchase-list"
        columns={itemColumns}
        customActions={customActions}
      />
      {SummaryPlaceholder}
    </div>
  );
};

export default PurchaseDisplay_split;

