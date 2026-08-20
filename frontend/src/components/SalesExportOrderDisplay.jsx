import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EntryDisplay } from './entry';
import { printHtml } from '../utils/printHelper';

// Column definitions matching the database schema
const columns = [
  { key: 'bill_no', title: 'Bill No' },
  { key: 'date', title: 'Date' },
  { key: 'order_no_dt', title: 'Order No/Dt' },
  { key: 'dis_port', title: 'Dis Port' },
  { key: 'dest_country', title: 'Dest Country' },
  { key: 'sender', title: 'Sender' },
  { key: 'consignee', title: 'Consignee' },
  { key: 'total_qty', title: 'Total Qty' },
  { key: 'total_usd_amt', title: 'Total USD' },
  { key: 'total_inr_amt', title: 'Total INR' },
];

const handlePrint = (row) => {
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2 style="color: #1f4fb2; border-bottom: 2px solid #1f4fb2; padding-bottom: 10px;">Sales Export Order Details</h2>
      <table style="border-collapse: collapse; width: 100%; margin-top: 15px;">
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Bill No</th><td style="border: 1px solid #ccc; padding: 10px;">${row.bill_no||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Date</th><td style="border: 1px solid #ccc; padding: 10px;">${row.date||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Sender</th><td style="border: 1px solid #ccc; padding: 10px;">${row.sender||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Consignee</th><td style="border: 1px solid #ccc; padding: 10px;">${row.consignee||''}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Total Qty (Bxs)</th><td style="border: 1px solid #ccc; padding: 10px;">${row.total_qty||0}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Total USD</th><td style="border: 1px solid #ccc; padding: 10px;">$${row.total_usd_amt||0}</td></tr>
        <tr><th style="border: 1px solid #ccc; padding: 10px; text-align: left; background: #1f4fb2; color: white;">Total Amount (INR)</th><td style="border: 1px solid #ccc; padding: 10px;">₹${row.total_inr_amt||0}</td></tr>
      </table>
    </div>
  `;
  printHtml(html, `Sales_Export_Order_${row.bill_no || row.id}`);
};

const SalesExportOrderDisplay = () => {
  const navigate = useNavigate();

  const handleEdit = (row) => {
    navigate(`/entry/sales-export-order-create?id=${row.id}`);
  };

  const handleDelete = async (id, refresh, showConfirm, showAlert) => {
    if (!id) {
      if (showAlert) showAlert('Error', 'Cannot delete: missing record id');
      return;
    }

    const doDelete = async () => {
      try {
        const res = await fetch(`/api/sales-export-orders/${id}`, { method: 'DELETE' });
        if (res.ok) {
          if (showAlert) showAlert('Success', 'Record deleted successfully', refresh);
          else if (refresh) refresh();
        } else {
          if (showAlert) showAlert('Error', 'Delete failed');
        }
      } catch (err) {
        console.error(err);
        if (showAlert) showAlert('Error', 'Delete failed');
      }
    };

    if (showConfirm) {
      showConfirm('Delete Record', 'Delete this record?', doDelete);
    } else if (window.confirm('Delete this record?')) {
      doDelete();
    }
  };

  return (
    <EntryDisplay
      title="Sales Export Order Display"
      apiEndpoint="/api/sales-export-orders?is_order=1"
      columns={columns}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onPrint={handlePrint}
      addNewLink="/entry/sales-export-order-create"
    />
  );
};

export default SalesExportOrderDisplay;
