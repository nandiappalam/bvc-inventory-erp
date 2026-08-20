import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EntryDisplay } from '../../../components/entry';

const columns = [
  { key: 's_no', title: 'S.No', render: (_val, row, idx) => idx !== undefined ? idx + 1 : (row.s_no || row.sNo || '') },
  { key: 'date', title: 'Date' },
  { key: 'inv_no', title: 'Inv. No', render: (val, row) => val || row.invNo || row.orderNo || '' },
  { key: 'inv_date', title: 'Inv. Date', render: (val, row) => val || row.invDate || row.date || '' },
  { key: 'pay_type', title: 'Pay Type', render: (val, row) => val || row.payType || row.paymentTerms || 'Cash' },
  { key: 'type', title: 'Type', render: (val, row) => val || row.type || '' },
  { key: 'item_name', title: 'Item Name', render: (val, row) => val || row.itemName || (row.items && row.items.map(i => i.item_name || i.itemName).filter(Boolean).join(', ')) || row.type || '-' },
  { key: 'qty', title: 'Qty', render: (val, row) => val || row.totalQty || (row.items && row.items.reduce((s, i) => s + (parseFloat(i.qty) || 0), 0)) || '0' },
  { key: 'rate', title: 'Rate', render: (val, row) => val || row.purc_rate || (row.items && row.items[0]?.purc_rate) || (row.items && row.items[0]?.rate) || '0.00' },
  { key: 'amount', title: 'Amount', render: (val, row) => `₹${parseFloat(val || row.billAmt || row.bill_amt || 0).toFixed(2)}` },
  { key: 'tax_percent', title: 'Tax %', render: (val, row) => `${val || row.taxPercent || row.tax_percent || 0}%` },
  { key: 'tax_amt', title: 'Tax Amt', render: (val, row) => `₹${parseFloat(val || row.taxAmt || row.tax_amt || 0).toFixed(2)}` },
  { key: 'total_amt', title: 'Total Amount', render: (val, row) => `₹${parseFloat(val || row.totAmt || row.total_amt || 0).toFixed(2)}` },
  { key: 'terms', title: 'Terms', render: (val, row) => val || row.terms || '' },
  { key: 'fob', title: 'F.O.B.', render: (val, row) => val || row.fob || '' }
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
      />
    </div>
  );
};

export default PurchaseOrderList;
