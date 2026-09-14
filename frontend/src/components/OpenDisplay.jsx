import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { printHtml } from '../utils/printHelper';
import { useAuth } from '../context/AuthContext';
import './OpenDisplay.css';

const OpenDisplay = () => {
  const navigate = useNavigate();
  const { isAdmin, hasPermission } = useAuth();
  const canEdit = isAdmin || hasPermission('Open', 'Display', 'can_edit') || hasPermission('Open', 'can_edit');
  const canDelete = isAdmin || hasPermission('Open', 'Display', 'can_delete') || hasPermission('Open', 'can_delete');
  const canPrint = isAdmin || hasPermission('Open', 'Display', 'can_print') || hasPermission('Open', 'can_print');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  // Filters
  const todayStr = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const fetchEntries = async () => {
    setLoading(true);
    setMessage('');
    try {
      const data = await api('/open');
      setEntries(Array.isArray(data) ? data : data?.data || []);
    } catch (err) {
      console.error('Error fetching opening entries:', err);
      setMessage('Failed to load opening entries.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  const handleDelete = async (parentId) => {
    try {
      const res = await api(`/open/${parentId}`, { method: 'DELETE' });
      if (res && res.success) {
        setMessage('Opening entry deleted successfully!');
        setMessageType('success');
        fetchEntries();
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(res?.message || 'Failed to delete opening entry.');
        setMessageType('error');
      }
    } catch (err) {
      console.error('Error deleting entry:', err);
      setMessage('Error deleting entry: ' + err.message);
      setMessageType('error');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handlePrint = (entry) => {
    const rowsHtml = (entry.items || []).map((item, idx) => `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-family: monospace;">${item.lot_no || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px;">${item.item_name || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px;">${item.weight || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">${item.qty || 0}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">${(parseFloat(item.tot_wt) || 0).toFixed(2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">${(parseFloat(item.rate) || 0).toFixed(2)}</td>
      </tr>
    `).join('');

    const totalQty = (entry.items || []).reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
    const totalWt = (entry.items || []).reduce((sum, item) => sum + (parseFloat(item.tot_wt) || 0), 0);

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 30px; color: #334155;">
        <div style="border-bottom: 2px solid #1f4fb2; padding-bottom: 10px; margin-bottom: 20px;">
          <h1 style="color: #1f4fb2; margin: 0;">A.S.MOORTHY & CO</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Opening Stock Entry Statement</p>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px;">
          <div><strong>S.No:</strong> ${entry.s_no}</div>
          <div><strong>Date:</strong> ${entry.date}</div>
          <div><strong>Type:</strong> ${entry.type}</div>
          <div><strong>Papad Company:</strong> ${entry.papad_comp || 'N/A'}</div>
          <div><strong>Remarks:</strong> ${entry.remarks || 'N/A'}</div>
        </div>
        <table style="border-collapse: collapse; width: 100%; margin-top: 20px;">
          <thead>
            <tr>
              <th style="background-color: #1f4fb2; color: white; border: 1px solid #cbd5e1; padding: 10px; text-align: left;">#</th>
              <th style="background-color: #1f4fb2; color: white; border: 1px solid #cbd5e1; padding: 10px; text-align: left;">Lot No</th>
              <th style="background-color: #1f4fb2; color: white; border: 1px solid #cbd5e1; padding: 10px; text-align: left;">Item Name</th>
              <th style="background-color: #1f4fb2; color: white; border: 1px solid #cbd5e1; padding: 10px; text-align: left;">Weight</th>
              <th style="background-color: #1f4fb2; color: white; border: 1px solid #cbd5e1; padding: 10px; text-align: right;">Qty</th>
              <th style="background-color: #1f4fb2; color: white; border: 1px solid #cbd5e1; padding: 10px; text-align: right;">Tot Wt (KG)</th>
              <th style="background-color: #1f4fb2; color: white; border: 1px solid #cbd5e1; padding: 10px; text-align: right;">Rate</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr style="font-weight: bold; background-color: #f8fafc;">
              <td colspan="4" style="text-align: right;">Grand Totals:</td>
              <td style="text-align: right;">${totalQty.toFixed(2)}</td>
              <td style="text-align: right;">${totalWt.toFixed(2)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
    printHtml(html, `Opening Entry S.No ${entry.s_no}`);
  };

  // Filter logic: Filter by search and date range
  const filteredRows = [];
  entries.forEach(entry => {
    // Check Date filter
    const matchesDate = (!fromDate || entry.date >= fromDate) && (!toDate || entry.date <= toDate);
    if (!matchesDate) return;

    // Search filter across parent fields
    const textToSearch = `${entry.s_no} ${entry.type} ${entry.papad_comp || ''} ${entry.remarks || ''}`.toLowerCase();
    
    // Flat map parent and items to display exactly like reference image
    (entry.items || []).forEach((item, itemIdx) => {
      const itemText = `${item.lot_no || ''} ${item.item_name || ''} ${item.weight || ''}`.toLowerCase();
      const matchesSearch = !searchTerm || textToSearch.includes(searchTerm.toLowerCase()) || itemText.includes(searchTerm.toLowerCase());

      if (matchesSearch) {
        filteredRows.push({
          parentId: entry.id,
          parentSNo: entry.s_no,
          parentDate: entry.date,
          parentType: entry.type,
          parentComp: entry.papad_comp,
          remarks: entry.remarks,
          isFirstOfParent: itemIdx === 0,
          itemCountOfParent: entry.items.length,
          fullParent: entry,
          // Item details
          itemId: item.id,
          lotNo: item.lot_no,
          itemName: item.item_name,
          weight: item.weight,
          qty: item.qty,
          totWt: item.tot_wt,
          rate: item.rate || item.cost
        });
      }
    });
  });

  // Calculate totals
  const totalQty = filteredRows.reduce((sum, row) => sum + (parseFloat(row.qty) || 0), 0);
  const totalWeight = filteredRows.reduce((sum, row) => sum + (parseFloat(row.totWt) || 0), 0);

  return (
    <div className="window">
      <div className="window-box">
        
        {/* Title Bar and Search/Date Filter Panel */}
        <div className="display-header">
          <div className="display-title-group">
            <h1>Opening Display</h1>
            <p>Explore, Print, and Modify Opening Balance Entries</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
            <div className="filter-bar">
              <span className="filter-label">Date :</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
              <span style={{ color: '#dbe7fb' }}>-</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
              <button 
                type="button" 
                onClick={() => { setFromDate(''); setToDate(''); }} 
                className="btn-clear-date"
                title="Clear date filter"
              >
                ✕
              </button>
            </div>

            <button
              type="button"
              onClick={() => navigate('/entry/open-create')}
              className="btn-create-new"
            >
              + Create New
            </button>
          </div>
        </div>

        {/* Action / Search Panel */}
        <div className="search-panel">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by S.No, Type, Papad Company, Lot No or Item Name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          {message && (
            <div className={`alert-pill ${messageType === 'success' ? 'success' : 'error'}`}>
              {message}
            </div>
          )}
        </div>

        {/* Display Table */}
        <div className="table-wrapper">
          {loading ? (
            <div className="empty-state">
              <div className="empty-state-icon" style={{ animation: 'spin 1s linear infinite' }}>⏳</div>
              <p>Fetching opening balances...</p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">📭</span>
              <p>No opening entries found for the selected criteria.</p>
              <button
                type="button"
                onClick={() => navigate('/entry/open-create')}
                className="btn-add-first"
              >
                Add First Entry
              </button>
            </div>
          ) : (
            <table className="display-table">
              <thead>
                <tr>
                  <th style={{ width: '60px', textAlign: 'center' }}>S.No</th>
                  <th style={{ width: '100px' }}>Date</th>
                  <th style={{ width: '120px' }}>Type</th>
                  <th>Papad Comp</th>
                  <th style={{ width: '100px' }}>Lotno</th>
                  <th>Item Name</th>
                  <th style={{ width: '120px' }}>Weight</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>Qty</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Tot Wt (KG)</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Rate</th>
                  <th style={{ width: '160px', textAlign: 'center' }}>Options</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => (
                  <tr 
                    key={index} 
                    className={row.isFirstOfParent ? 'parent-row-start' : ''}
                  >
                    {/* Parent cell: S.No */}
                    <td className="td-sno">
                      {row.isFirstOfParent ? row.parentSNo : ''}
                    </td>

                    {/* Parent cell: Date */}
                    <td className="td-date">
                      {row.isFirstOfParent ? row.parentDate : ''}
                    </td>

                    {/* Parent cell: Type */}
                    <td>
                      {row.isFirstOfParent ? (
                        <span className={`td-badge ${row.parentType.toLowerCase() === 'urad' ? 'urad' : 'others'}`}>
                          {row.parentType}
                        </span>
                      ) : ''}
                    </td>

                    {/* Parent cell: Papad Company */}
                    <td>
                      {row.isFirstOfParent ? (row.parentComp || '—') : ''}
                    </td>

                    {/* Item cell: Lotno */}
                    <td className="td-lot">
                      {row.lotNo || '—'}
                    </td>

                    {/* Item cell: Item Name */}
                    <td className="td-item-name">
                      {row.itemName}
                    </td>

                    {/* Item cell: Weight */}
                    <td>
                      {row.weight || '—'}
                    </td>

                    {/* Item cell: Qty */}
                    <td className="td-qty">
                      {(parseFloat(row.qty) || 0).toFixed(2)}
                    </td>

                    {/* Item cell: Tot Wt */}
                    <td className="td-weight">
                      {(parseFloat(row.totWt) || 0).toFixed(2)}
                    </td>

                    {/* Item cell: Rate */}
                    <td className="td-rate">
                      ₹{(parseFloat(row.rate) || 0).toFixed(2)}
                    </td>

                    {/* Action buttons (only show once per parent block for clean display) */}
                    <td className="options-cell">
                      {row.isFirstOfParent ? (
                        <div className="options-btn-group">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => navigate(`/entry/open-create?id=${row.parentId}`)}
                              className="btn-option edit"
                              title="Edit this opening entry"
                            >
                              Edit
                            </button>
                          )}
                          {canPrint && (
                            <button
                              type="button"
                              onClick={() => handlePrint(row.fullParent)}
                              className="btn-option print"
                              title="Print Statement"
                            >
                              Print
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(row.parentId)}
                              className="btn-option delete"
                              title="Delete entry"
                            >
                              ✕
                            </button>
                          )}
                          {!canEdit && !canPrint && !canDelete && (
                            <span style={{ color: '#888', fontSize: '12px' }}>-</span>
                          )}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer Totals Status Bar */}
        <div className="display-footer">
          <div className="display-footer-left">
            Showing <span>{filteredRows.length}</span> rows matching selection criteria
          </div>
          <div className="display-footer-right">
            <div className="display-total-item">
              <span className="display-total-label">Total Qty</span>
              <span className="display-total-val">{totalQty.toFixed(2)}</span>
            </div>
            <div className="display-total-item" style={{ borderLeft: '1px solid #cbd5e1', paddingLeft: '30px' }}>
              <span className="display-total-label">Total Wt (KG)</span>
              <span className="display-total-val weight">{totalWeight.toFixed(2)} kg</span>
            </div>
          </div>
        </div>

      </div>

      {deleteConfirmId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', maxWidth: '400px', width: '100%', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
            <h3 style={{ marginTop: 0, color: '#1e293b' }}>Confirm Delete</h3>
            <p style={{ color: '#475569' }}>Are you sure you want to delete this opening entry and all its items?</p>
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
                onClick={() => handleDelete(deleteConfirmId)}
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

export default OpenDisplay;
