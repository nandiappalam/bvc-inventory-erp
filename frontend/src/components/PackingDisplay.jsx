import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { printHtml } from '../utils/printHelper';
import { useAuth } from '../context/AuthContext';
import './PackingDisplay.css';

const PackingDisplay = () => {
  const navigate = useNavigate();
  const { isAdmin, hasPermission } = useAuth();
  const canEdit = isAdmin || hasPermission('Packing', 'Display', 'can_edit') || hasPermission('Packing', 'can_edit');
  const canDelete = isAdmin || hasPermission('Packing', 'Display', 'can_delete') || hasPermission('Packing', 'can_delete');
  const canPrint = isAdmin || hasPermission('Packing', 'Display', 'can_print') || hasPermission('Packing', 'can_print');
  const canCreate = isAdmin || hasPermission('Packing', 'Display', 'can_create') || hasPermission('Packing', 'Create', 'can_create') || hasPermission('Packing', 'can_create');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const [startDate, setStartDate] = useState('2023-01-07');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchEntries = async () => {
    setLoading(true);
    setMessage('');
    try {
      const data = await api('/packing');
      setEntries(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching packing entries:', err);
      setMessage('Failed to load packing entries.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    try {
      const res = await api(`/packing/${deleteConfirmId}`, { method: 'DELETE' });
      if (res && res.success) {
        setMessage('Packing entry deleted successfully!');
        setMessageType('success');
        fetchEntries();
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(res?.message || 'Failed to delete packing entry.');
        setMessageType('error');
      }
    } catch (err) {
      console.error('Error deleting packing entry:', err);
      setMessage('Error deleting entry: ' + err.message);
      setMessageType('error');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handlePrint = (entry) => {
    const items = entry.items || [];
    const fromItems = items.filter(i => i.remarks && i.remarks.includes('section:from'));
    const matItems = items.filter(i => i.remarks && i.remarks.includes('section:material'));
    const toItems = items.filter(i => !i.remarks || i.remarks.includes('section:to'));

    const fromRowsHtml = fromItems.map((item, idx) => `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px;">${item.item_name || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-family: monospace;">${item.lot_no || '-'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: bold;">${item.qty || item.weight || 0}</td>
      </tr>
    `).join('');

    const matRowsHtml = matItems.map((item, idx) => `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px;">${item.item_name || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-family: monospace;">${item.lot_no || '-'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: bold;">${item.qty || item.weight || 0}</td>
      </tr>
    `).join('');

    const toRowsHtml = toItems.map((item, idx) => {
      const box = item.box || 0;
      const packet = item.packet || 0;
      const totPacket = item.total_packet || item.qty || (box * packet) || 0;
      const rate = item.rate || 0;
      const totWt = item.tot_wt || (rate * totPacket) || 0;

      return `
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${idx + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: 600;">${item.item_name || ''}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-family: monospace;">${item.lot_no || '-'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px;">${item.employee_name || '-'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">${rate}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">${box}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">${packet}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: bold; color: #1e40af;">${totPacket}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: bold; color: #15803d;">${totWt > 0 ? totWt.toFixed(2) : '0.00'}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 25px; color: #1e293b; max-width: 900px; margin: 0 auto;">
        <div style="border-bottom: 2px solid #1f4fb2; padding-bottom: 10px; margin-bottom: 20px;">
          <h1 style="color: #1f4fb2; margin: 0; font-size: 24px;">A.S.MOORTHY & CO</h1>
          <p style="margin: 5px 0 0 0; font-size: 15px; font-weight: bold; color: #475569;">Packing Display Statement</p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; font-size: 13px; background: #f8fafc; padding: 12px; border: 1px solid #e2e8f0; border-radius: 4px;">
          <div><strong>S.No:</strong> ${entry.s_no || entry.id}</div>
          <div><strong>Date:</strong> ${entry.date ? entry.date.substring(0, 10) : ''}</div>
          <div><strong>Remarks:</strong> ${entry.remarks || 'N/A'}</div>
        </div>

        <!-- Section 1: Packing From -->
        <div style="margin-bottom: 20px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #1f4fb2; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">1. Packing From (Papad Input)</h3>
          <table style="border-collapse: collapse; width: 100%; font-size: 12px;">
            <thead>
              <tr style="background-color: #3f6fc0; color: white;">
                <th style="border: 1px solid #cbd5e1; padding: 8px; width: 40px;">S.No</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Item Name</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left; width: 150px;">Lot No</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 120px;">Qty</th>
              </tr>
            </thead>
            <tbody>
              ${fromRowsHtml || '<tr><td colSpan="4" style="text-align:center; padding:8px; color:#64748b;">No Packing From items</td></tr>'}
            </tbody>
          </table>
        </div>

        <!-- Section 2: Packing Material -->
        <div style="margin-bottom: 20px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #1f4fb2; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">2. Packing Material Used</h3>
          <table style="border-collapse: collapse; width: 100%; font-size: 12px;">
            <thead>
              <tr style="background-color: #3f6fc0; color: white;">
                <th style="border: 1px solid #cbd5e1; padding: 8px; width: 40px;">S.No</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Item Name</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left; width: 150px;">Lot No</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 120px;">Qty</th>
              </tr>
            </thead>
            <tbody>
              ${matRowsHtml || '<tr><td colSpan="4" style="text-align:center; padding:8px; color:#64748b;">No Packing Material items</td></tr>'}
            </tbody>
          </table>
        </div>

        <!-- Section 3: Packing To Item (FG) -->
        <div style="margin-bottom: 20px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #1f4fb2; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">3. Packing To Item (Finished Goods)</h3>
          <table style="border-collapse: collapse; width: 100%; font-size: 12px;">
            <thead>
              <tr style="background-color: #3f6fc0; color: white;">
                <th style="border: 1px solid #cbd5e1; padding: 8px; width: 40px;">S.No</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">FG Item Name</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left; width: 120px;">Lot No</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Employee Name</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 70px;">Wages</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 60px;">Box</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 60px;">Packet</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 90px;">Total Pkt</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 100px;">Total Wages</th>
              </tr>
            </thead>
            <tbody>
              ${toRowsHtml || '<tr><td colSpan="9" style="text-align:center; padding:8px; color:#64748b;">No Packing To items</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
    printHtml(html, `Packing_${entry.s_no || entry.id}`);
  };

  // Filter entries by date range
  const filteredEntries = entries.filter(e => {
    if (!e.date) return true;
    const d = e.date.substring(0, 10);
    return d >= startDate && d <= endDate;
  });

  return (
    <div className="window">
      <div style={{ background: '#103275', color: '#fff', padding: '8px 12px', fontWeight: 'bold', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Packing Display</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
          <span>Date :</span>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '2px 5px', color: '#000' }} />
          <span>-</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '2px 5px', color: '#000' }} />
          <button style={{ background: '#d32f2f', color: '#fff', border: 'none', padding: '2px 8px', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => navigate('/entry/packing-create')}>X</button>
        </div>
      </div>

      {message && <div className={`message ${messageType}`}>{message}</div>}

      <div style={{ padding: '10px', background: '#d0d7e5', minHeight: '400px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', fontSize: '12px', border: '1px solid #7f9db9' }}>
          <thead>
            <tr style={{ background: '#3f6fc0', color: '#fff', textAlign: 'left' }}>
              <th style={{ width: '50px', padding: '6px', border: '1px solid #7f9db9', textAlign: 'center' }}>S.No</th>
              <th style={{ width: '90px', padding: '6px', border: '1px solid #7f9db9' }}>Date</th>
              <th style={{ padding: '6px', border: '1px solid #7f9db9' }}>Packing From</th>
              <th style={{ padding: '6px', border: '1px solid #7f9db9' }}>Packing Material</th>
              <th style={{ padding: '6px', border: '1px solid #7f9db9' }}>Packing To Item (FG)</th>
              <th style={{ padding: '6px', border: '1px solid #7f9db9' }}>Employee Name</th>
              <th style={{ width: '60px', padding: '6px', border: '1px solid #7f9db9', textAlign: 'right' }}>Box</th>
              <th style={{ width: '60px', padding: '6px', border: '1px solid #7f9db9', textAlign: 'right' }}>Packet</th>
              <th style={{ width: '80px', padding: '6px', border: '1px solid #7f9db9', textAlign: 'right' }}>Total Pkt</th>
              <th style={{ width: '90px', padding: '6px', border: '1px solid #7f9db9', textAlign: 'right' }}>Total Wages</th>
              <th style={{ width: '130px', padding: '6px', border: '1px solid #7f9db9', textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="11" style={{ textAlign: 'center', padding: '20px' }}>Loading...</td></tr>
            ) : filteredEntries.length === 0 ? (
              <tr><td colSpan="11" style={{ textAlign: 'center', padding: '20px' }}>No records found</td></tr>
            ) : (
              filteredEntries.map((entry, idx) => {
                const items = entry.items || [];
                const fromItems = items.filter(i => i.remarks && i.remarks.includes('section:from'));
                const matItems = items.filter(i => i.remarks && i.remarks.includes('section:material'));
                const toItems = items.filter(i => !i.remarks || i.remarks.includes('section:to'));

                const fromStr = fromItems.map(i => `${i.item_name} (${i.lot_no || 'No Lot'}) - ${i.qty || 0}`).join(', ') || '-';
                const matStr = matItems.map(i => `${i.item_name} - ${i.qty || 0}`).join(', ') || '-';
                const toItemNames = toItems.map(i => `${i.item_name} (${i.lot_no || ''})`).join(', ') || '-';
                const empNames = Array.from(new Set(toItems.map(i => i.employee_name).filter(Boolean))).join(', ') || '-';

                const totalBox = toItems.reduce((acc, i) => acc + (parseFloat(i.box) || 0), 0);
                const totalPacket = toItems.reduce((acc, i) => acc + (parseFloat(i.packet) || 0), 0);
                const grandTotalPacket = toItems.reduce((acc, i) => acc + (parseFloat(i.total_packet || i.qty) || 0), 0);
                const totalWages = toItems.reduce((acc, i) => acc + (parseFloat(i.tot_wt) || 0), 0);

                return (
                  <tr key={entry.id || idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f0f4f9' }}>
                    <td style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 'bold' }}>{entry.s_no || entry.id}</td>
                    <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}>{entry.date ? entry.date.substring(0, 10) : ''}</td>
                    <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}>{fromStr}</td>
                    <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}>{matStr}</td>
                    <td style={{ padding: '6px', border: '1px solid #cbd5e1', fontWeight: '500' }}>{toItemNames}</td>
                    <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}>{empNames}</td>
                    <td style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{totalBox || '-'}</td>
                    <td style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{totalPacket || '-'}</td>
                    <td style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 'bold' }}>{grandTotalPacket}</td>
                    <td style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 'bold', color: '#1e40af' }}>{totalWages > 0 ? totalWages.toFixed(2) : '-'}</td>
                    <td style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                      {canEdit && (
                        <button
                          onClick={() => navigate(`/entry/packing-create?id=${entry.id}`)}
                          style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '2px 8px', borderRadius: '3px', cursor: 'pointer', marginRight: '4px' }}
                        >
                          Edit
                        </button>
                      )}
                      {canPrint && (
                        <button
                          onClick={() => handlePrint(entry)}
                          style={{ background: '#059669', color: '#fff', border: 'none', padding: '2px 8px', borderRadius: '3px', cursor: 'pointer', marginRight: '4px' }}
                        >
                          Print
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => setDeleteConfirmId(entry.id)}
                          style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '2px 8px', borderRadius: '3px', cursor: 'pointer' }}
                        >
                          Delete
                        </button>
                      )}
                      {!canEdit && !canPrint && !canDelete && (
                        <span style={{ color: '#888', fontSize: '12px' }}>-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div style={{ background: '#d0d7e5', padding: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #7f9db9' }}>
        <button onClick={() => window.print()} style={{ padding: '4px 15px', background: '#3f6fc0', color: '#fff', border: 'none', cursor: 'pointer' }}>Print</button>
        <span style={{ fontWeight: 'bold', fontSize: '12px' }}>Row(s) : {filteredEntries.length}</span>
        {canCreate && (
          <button onClick={() => navigate('/entry/packing-create')} style={{ padding: '4px 15px', background: '#3f6fc0', color: '#fff', border: 'none', cursor: 'pointer' }}>Add Packing</button>
        )}
      </div>

      {deleteConfirmId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '5px', minWidth: '300px' }}>
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete this packing entry?</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '15px' }}>
              <button onClick={() => setDeleteConfirmId(null)} style={{ padding: '5px 15px', background: '#64748b', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleDeleteConfirm} style={{ padding: '5px 15px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PackingDisplay;
