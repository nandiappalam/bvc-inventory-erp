import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from "../services/api.js";
import { printHtml } from '../utils/printHelper';
import './StockAdjustDisplay.css';

const StockAdjustDisplay = () => {
  const navigate = useNavigate();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const loadStockAdjustments = async () => {
    try {
      setLoading(true);
      const data = await api('/stock-adjust');
      if (Array.isArray(data)) {
        setRecords(data);
      } else {
        setRecords([]);
      }
    } catch (error) {
      console.error('Error loading stock adjustments:', error);
      setMessage('Error loading stock adjustments: ' + error.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStockAdjustments();
  }, []);

  const handlePrintEntry = (adjustRecord) => {
    const rowsHtml = (adjustRecord.items || []).map((item, idx) => `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px;">${item.item_name || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-family: monospace;">${item.lot_no || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">${item.weight || 0}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${item.type || 'Addition'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">${item.qty || 0}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">${item.tot_wt || (parseFloat(item.weight) * parseFloat(item.qty)).toFixed(2)}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 25px; color: #1e293b;">
        <div style="border-bottom: 2px solid #1f4fb2; padding-bottom: 10px; margin-bottom: 20px;">
          <h1 style="color: #1f4fb2; margin: 0;">A.S.MOORTHY & CO</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: bold;">Stock Adjustment Voucher</p>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; font-size: 14px;">
          <div><strong>S.No:</strong> ${adjustRecord.s_no || adjustRecord.sNo}</div>
          <div><strong>Date:</strong> ${adjustRecord.date}</div>
          <div><strong>Type:</strong> ${adjustRecord.type || 'N/A'}</div>
          <div><strong>Papad Comp:</strong> ${adjustRecord.papad_company_name || adjustRecord.papad_comp || 'N/A'}</div>
          <div><strong>Flour Mill:</strong> ${adjustRecord.flour_mill_name || adjustRecord.flour_mill || 'N/A'}</div>
          <div><strong>Remarks:</strong> ${adjustRecord.remarks || 'N/A'}</div>
        </div>
        <table style="border-collapse: collapse; width: 100%; margin-top: 15px;">
          <thead>
            <tr style="background-color: #1f4fb2; color: white;">
              <th style="border: 1px solid #cbd5e1; padding: 10px;">#</th>
              <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: left;">Item Name</th>
              <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: left;">Lot No</th>
              <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: right;">Weight</th>
              <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">Type</th>
              <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: right;">Qty</th>
              <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: right;">Tot Wt</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colSpan="7" style="text-align:center; padding:15px;">No items</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
    printHtml(html, `StockAdjust_${adjustRecord.s_no || adjustRecord.id}`);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;

    try {
      const result = await api(`/stock-adjust/${deleteConfirmId}`, {
        method: 'DELETE'
      });

      if (result && result.success) {
        setMessage('Stock adjustment deleted successfully!');
        setMessageType('success');
        loadStockAdjustments();
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(result?.message || 'Failed to delete record');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error deleting stock adjustment:', error);
      setMessage('Error deleting stock adjustment: ' + error.message);
      setMessageType('error');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const flattenedRows = [];
  records.forEach(adjust => {
    const isDateMatch = (!dateFrom || adjust.date >= dateFrom) && (!dateTo || adjust.date <= dateTo);
    if (!isDateMatch) return;

    if (adjust.items && adjust.items.length > 0) {
      adjust.items.forEach((item, index) => {
        flattenedRows.push({
          id: adjust.id,
          s_no: adjust.s_no || adjust.sNo,
          date: adjust.date,
          remarks: adjust.remarks || item.remarks || '',
          papad_company: adjust.papad_company_name || adjust.papad_comp || '',
          flour_mill: adjust.flour_mill_name || adjust.flour_mill || '',
          item_name: item.item_name,
          lot_no: item.lot_no,
          weight: item.weight,
          type: item.type || adjust.type || '',
          qty: item.qty,
          tot_wt: item.tot_wt || item.total_wt || (parseFloat(item.weight) * parseFloat(item.qty)).toFixed(2),
          isFirstRow: index === 0,
          fullRecord: adjust
        });
      });
    } else {
      flattenedRows.push({
        id: adjust.id,
        s_no: adjust.s_no || adjust.sNo,
        date: adjust.date,
        remarks: adjust.remarks || '',
        papad_company: adjust.papad_company_name || adjust.papad_comp || '',
        flour_mill: adjust.flour_mill_name || adjust.flour_mill || '',
        item_name: '',
        lot_no: '',
        weight: '',
        type: adjust.type || '',
        qty: '',
        tot_wt: '',
        isFirstRow: true,
        fullRecord: adjust
      });
    }
  });

  return (
    <div>
      <div className="screen-title">Stock Adjust Display</div>
      
      <div className="window">
        {message && <div className={`message ${messageType}`}>{message}</div>}

        {/* FILTER BAR */}
        <div className="filter-bar" style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '15px' }}>
          <label style={{ fontWeight: 'bold' }}>From Date:</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <label style={{ fontWeight: 'bold' }}>To Date:</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <button onClick={loadStockAdjustments} style={{ padding: '4px 12px', cursor: 'pointer' }}>Refresh</button>
        </div>

        {/* GRID */}
        <div className="grid">
          <table>
            <thead>
              <tr>
                <th style={{ width: '60px' }}>S.No</th>
                <th style={{ width: '100px' }}>Date</th>
                <th>Papad Comp</th>
                <th>Flour Mill</th>
                <th>Item Name</th>
                <th style={{ width: '80px' }}>Lot No</th>
                <th style={{ width: '80px' }}>Weight</th>
                <th style={{ width: '90px' }}>Type</th>
                <th style={{ width: '80px' }}>Qty</th>
                <th style={{ width: '100px' }}>Tot Wt</th>
                <th style={{ width: '150px' }} className="no-print">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="11" style={{ textAlign: 'center', padding: '20px' }}>Loading stock adjustments...</td>
                </tr>
              ) : flattenedRows.length === 0 ? (
                <tr>
                  <td colSpan="11" style={{ textAlign: 'center', padding: '20px' }}>No records found</td>
                </tr>
              ) : (
                flattenedRows.map((row, idx) => (
                  <tr key={`${row.id}-${idx}`}>
                    <td>{row.isFirstRow ? row.s_no : ''}</td>
                    <td>{row.isFirstRow ? row.date : ''}</td>
                    <td>{row.isFirstRow ? row.papad_company : ''}</td>
                    <td>{row.isFirstRow ? row.flour_mill : ''}</td>
                    <td>{row.item_name}</td>
                    <td style={{ fontFamily: 'monospace' }}>{row.lot_no}</td>
                    <td>{row.weight}</td>
                    <td>
                      <span className={`badge ${['addition', 'receive'].includes(row.type?.toLowerCase()) ? 'badge-add' : 'badge-sub'}`}>
                        {row.type}
                      </span>
                    </td>
                    <td>{row.qty}</td>
                    <td>{row.tot_wt}</td>
                    <td className="no-print">
                      {row.isFirstRow && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button 
                            onClick={() => navigate(`/entry/stock-adjust-create?id=${row.id}`)}
                            style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => handlePrintEntry(row.fullRecord)}
                            style={{ backgroundColor: '#059669', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                          >
                            Print
                          </button>
                          <button 
                            onClick={() => setDeleteConfirmId(row.id)} 
                            style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* BOTTOM BAR */}
        <div className="bottom-bar" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px' }}>
          <div className="btn-group">
            <button onClick={() => window.print()} className="no-print">Print Screen</button>
          </div>
          <div className="status" style={{ fontWeight: 'bold' }}>
            Total Items: {flattenedRows.length} &nbsp;|&nbsp; Unique Records: {records.length}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', maxWidth: '400px', width: '100%', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
            <h3 style={{ marginTop: 0, color: '#1e293b' }}>Confirm Delete</h3>
            <p style={{ color: '#475569' }}>Are you sure you want to delete this stock adjustment record?</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button 
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#f1f5f9', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleDeleteConfirm}
                style={{ padding: '8px 16px', border: 'none', borderRadius: '4px', backgroundColor: '#dc2626', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockAdjustDisplay;
