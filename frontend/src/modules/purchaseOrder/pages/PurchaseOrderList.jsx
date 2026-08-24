import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EntryDisplay } from '../../../components/entry';

const columns = [
  { key: 's_no', title: 'S.No', render: (_val, row, idx) => idx !== undefined ? idx + 1 : (row.s_no || row.sNo || '') },
  { key: 'pr_no', title: 'PR Ref', render: (val, row) => (val || row.pr_no) ? (
    <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px' }}>
      {val || row.pr_no}
    </span>
  ) : <span style={{ color: '#94a3b8' }}>—</span> },
  { key: 'date', title: 'Date' },
  { key: 'inv_no', title: 'PO / Inv. No', render: (val, row) => val || row.invNo || row.orderNo || '' },
  { key: 'supplier_name', title: 'Supplier', render: (val, row) => val || row.supplierName || '-' },
  { key: 'item_name', title: 'Item Name', render: (val, row) => val || row.itemName || (row.items && row.items.map(i => i.item_name || i.itemName).filter(Boolean).join(', ')) || row.type || '-' },
  { key: 'qty', title: 'Qty', render: (val, row) => val || row.totalQty || (row.items && row.items.reduce((s, i) => s + (parseFloat(i.qty) || 0), 0)) || '0' },
  { key: 'rate', title: 'Rate', render: (val, row) => val || row.purc_rate || (row.items && row.items[0]?.purc_rate) || (row.items && row.items[0]?.rate) || '0.00' },
  { key: 'amount', title: 'Amount', render: (val, row) => `₹${parseFloat(val || row.billAmt || row.bill_amt || 0).toFixed(2)}` },
  { key: 'tax_amt', title: 'Tax Amt', render: (val, row) => `₹${parseFloat(val || row.taxAmt || row.tax_amt || 0).toFixed(2)}` },
  { key: 'total_amt', title: 'Total Amount', render: (val, row) => `₹${parseFloat(val || row.totAmt || row.total_amt || 0).toFixed(2)}` },
  { key: 'status', title: 'Status', render: (val, row) => {
    const st = val || row.status || (row.inward_purchase_id ? 'Received' : 'Ordered');
    const isReceived = st === 'Received' || Boolean(row.inward_purchase_id);
    return (
      <span style={{ 
        backgroundColor: isReceived ? '#dcfce7' : '#fef9c3', 
        color: isReceived ? '#15803d' : '#854d0e',
        padding: '2px 6px',
        borderRadius: '4px',
        fontWeight: 'bold',
        fontSize: '11px'
      }}>
        {isReceived ? 'Received' : 'Ordered'}
      </span>
    );
  }}
];

const PurchaseOrderList = () => {
  const navigate = useNavigate();

  return (
    <div className="window">
      <EntryDisplay
        title="Purchase Order Display"
        apiEndpoint="/purchase-orders"
        columns={columns}
        onEdit={(row) => navigate(`/entry/purchase-order-create?id=${row.id}`)}
        addNewLink="/entry/purchase-order-create"
        customActions={(row) => (
          <button
            type="button"
            onClick={() => navigate(`/entry/purchase-create?sourcePurchaseOrderId=${row.id}`)}
            title="Convert to Inward Purchase"
            style={{
              padding: '3px 8px',
              backgroundColor: '#16a34a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            📦 Inward ➔
          </button>
        )}
      />
    </div>
  );
};

export default PurchaseOrderList;
