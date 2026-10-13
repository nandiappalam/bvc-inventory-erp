import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { printHtml } from '../../utils/printHelper';
import { printInpassDocument } from '../../utils/movementPrintTemplates';

// Standard MUI Icons consistent with BVC ERP theme
import RefreshIcon from '@mui/icons-material/Refresh';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import CallReceivedIcon from '@mui/icons-material/CallReceived';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SearchIcon from '@mui/icons-material/Search';
import PrintIcon from '@mui/icons-material/Print';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloseIcon from '@mui/icons-material/Close';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';

const InpassDisplay = () => {
  const navigate = useNavigate();
  const [inpasses, setInpasses] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Modals
  const [selectedInpass, setSelectedInpass] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    id: '',
    inpass_no: '',
    date: '',
    vehicle_no: '',
    driver_name: '',
    received_by: '',
    qc_status: 'PASS',
    discrepancy_reason: '',
    remarks: '',
    status: 'RECEIVED'
  });

  const fetchInpasses = async () => {
    setLoading(true);
    try {
      const res = await api('/inpasses', {
        params: {
          search: searchTerm || undefined
        }
      });
      if (res?.success) {
        setInpasses(res.data || []);
      }

      const sumRes = await api('/inpasses/report/summary');
      if (sumRes?.success) {
        setSummary(sumRes.data || {});
      }
    } catch (err) {
      console.error('Error fetching inpasses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInpasses();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchInpasses();
  };

  const handleDelete = async (id, inpassNo) => {
    const confirmed = window.__appConfirm ? await window.__appConfirm({
      title: 'Confirm Inpass Reversal',
      message: `Are you sure you want to cancel and reverse Inpass ${inpassNo}?\n\nThis will revert received processed goods from factory stock and reopen the linked Outpass.`,
      confirmText: 'Delete Inpass',
      confirmColor: 'error'
    }) : window.confirm(`Are you sure you want to cancel and reverse Inpass ${inpassNo}?`);
    if (!confirmed) return;

    try {
      const res = await api(`/inpasses/${id}`, { method: 'DELETE' });
      if (res && res.success !== false) {
        alert(res.message || 'Inpass reversed and stock adjusted successfully');
        fetchInpasses();
      } else {
        alert(res?.message || 'Error deleting inpass');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleOpenEdit = (ip) => {
    setEditFormData({
      id: ip.id,
      inpass_no: ip.inpass_no,
      date: ip.date || '',
      vehicle_no: ip.vehicle_no || '',
      driver_name: ip.driver_name || '',
      received_by: ip.received_by || 'Admin',
      qc_status: ip.qc_status || 'PASS',
      discrepancy_reason: ip.discrepancy_reason || '',
      remarks: ip.remarks || '',
      status: ip.status || 'RECEIVED'
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      const res = await api(`/inpasses/${editFormData.id}`, {
        method: 'PUT',
        data: { formData: editFormData }
      });
      if (res && res.success !== false) {
        alert('Inpass updated successfully');
        setEditModalOpen(false);
        fetchInpasses();
      } else {
        alert(res?.message || 'Failed to update Inpass');
      }
    } catch (err) {
      alert('Error updating inpass: ' + err.message);
    }
  };

  const handlePrint = (ip) => {
    printInpassDocument(ip, 'ORIGINAL STORE COPY');
  };

  const filteredInpasses = inpasses.filter(row => {
    if (fromDate || toDate) {
      const rowDateStr = row.date || row.created_at || '';
      if (rowDateStr) {
        const rowDateOnly = String(rowDateStr).substring(0, 10);
        if (fromDate && rowDateOnly < fromDate) return false;
        if (toDate && rowDateOnly > toDate) return false;
      }
    }
    return true;
  });

  return (
    <div className="erp-display-page" style={{ padding: '16px', background: '#f0f6ff', minHeight: '100vh', fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif" }}>
      {/* Universal Page Title Header */}
      <div className="screen-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CallReceivedIcon style={{ fontSize: '24px' }} />
          <span>Material Gate Inpass Register</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="action-btn"
            style={{ backgroundColor: '#ffffff', color: '#1f4fb2', fontWeight: 'bold' }}
            onClick={() => navigate('/entry/outpass-display')}
          >
            <LocalShippingIcon style={{ fontSize: '15px', marginRight: '4px' }} /> Outpass Dispatches
          </button>
          <button
            type="button"
            className="action-btn"
            style={{ backgroundColor: '#2a5ea0', color: '#ffffff' }}
            onClick={() => navigate('/reports/outside-processing')}
          >
            <AssessmentIcon style={{ fontSize: '15px', marginRight: '4px' }} /> Outside Mill Report
          </button>
          <button
            type="button"
            className="action-btn"
            style={{ backgroundColor: '#ffffff', color: '#1f4fb2', fontWeight: 'bold' }}
            onClick={() => navigate('/entry/inpass-create')}
          >
            <AddCircleIcon style={{ fontSize: '15px', marginRight: '4px' }} /> + Receive New Inpass
          </button>
        </div>
      </div>

      {/* KPI Stats Tiles in theme style */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px', marginBottom: '14px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderLeft: '5px solid #1f4fb2', borderRadius: '4px', padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Total Inpasses Recorded</div>
          <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#1f4fb2', marginTop: '2px' }}>
            {summary.total_count || inpasses.length}
          </div>
          <div style={{ fontSize: '11px', color: '#2563eb', marginTop: '2px' }}>
            External Processing Receipts
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderLeft: '5px solid #2e7d32', borderRadius: '4px', padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Total Received Output</div>
          <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#2e7d32', marginTop: '2px' }}>
            {(parseFloat(summary.total_output_weight) || 0).toFixed(0)} <span style={{ fontSize: '13px' }}>KG</span>
          </div>
          <div style={{ fontSize: '11px', color: '#166534', marginTop: '2px' }}>
            Credited into Factory Godown
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderLeft: '5px solid #0288d1', borderRadius: '4px', padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Average Milling Yield</div>
          <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#0288d1', marginTop: '2px' }}>
            {(parseFloat(summary.avg_yield_percent) || 0).toFixed(1)}%
          </div>
          <div style={{ fontSize: '11px', color: '#0369a1', marginTop: '2px' }}>
            Flour Conversion Efficiency
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderLeft: '5px solid #4f46e5', borderRadius: '4px', padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Total Processing Fees</div>
          <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#4f46e5', marginTop: '2px' }}>
            ₹{(parseFloat(summary.total_processing_charges) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '11px', color: '#4338ca', marginTop: '2px' }}>
            External Mill Payables
          </div>
        </div>
      </div>

      {/* Filter Section Toolbar */}
      <div style={{ background: '#e9eef7', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #9fb6dd', marginBottom: '14px', borderRadius: '4px', flexWrap: 'wrap', gap: '10px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, minWidth: '260px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Inpass No, Outpass No, Mill, Item, Lot..."
              style={{ width: '100%', padding: '7px 10px 7px 30px', border: '1px solid #7fa1d6', borderRadius: '4px', fontSize: '13px', backgroundColor: '#ffffff' }}
            />
            <SearchIcon style={{ position: 'absolute', left: '7px', top: '7px', fontSize: '18px', color: '#64748b' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#333' }}>
            <span>From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{ padding: '6px', border: '1px solid #7fa1d6', borderRadius: '4px', fontSize: '13px', backgroundColor: '#fff' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#333' }}>
            <span>To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={{ padding: '6px', border: '1px solid #7fa1d6', borderRadius: '4px', fontSize: '13px', backgroundColor: '#fff' }}
            />
          </div>
          {(fromDate || toDate) && (
            <button
              type="button"
              onClick={() => { setFromDate(''); setToDate(''); }}
              style={{ padding: '6px 10px', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
            >
              Clear
            </button>
          )}
          <button type="submit" className="action-btn update-btn" style={{ padding: '7px 14px' }}>
            Search
          </button>
        </form>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className="action-btn"
            style={{ backgroundColor: '#1f4fb2', color: '#ffffff', padding: '7px 12px' }}
            onClick={fetchInpasses}
            title="Refresh records"
          >
            <RefreshIcon style={{ fontSize: '16px', marginRight: '4px' }} /> Refresh
          </button>
        </div>
      </div>

      {/* Main Table Wrapper */}
      <div style={{ background: '#ffffff', border: '1px solid #c0c8da', borderRadius: '4px', overflowX: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#1f4fb2', color: '#ffffff' }}>
              <th style={{ padding: '10px 12px', border: '1px solid #9fb6dd', width: '50px', textAlign: 'center' }}>S.No</th>
              <th style={{ padding: '10px 12px', border: '1px solid #9fb6dd', width: '110px' }}>Inpass No</th>
              <th style={{ padding: '10px 12px', border: '1px solid #9fb6dd', width: '95px' }}>Date</th>
              <th style={{ padding: '10px 12px', border: '1px solid #9fb6dd', width: '110px' }}>Linked Outpass</th>
              <th style={{ padding: '10px 12px', border: '1px solid #9fb6dd' }}>External Mill / Party</th>
              <th style={{ padding: '10px 12px', border: '1px solid #9fb6dd' }}>Mill Area</th>
              <th style={{ padding: '10px 12px', border: '1px solid #9fb6dd' }}>Received Output Items</th>
              <th style={{ padding: '10px 12px', border: '1px solid #9fb6dd', textAlign: 'right', width: '95px' }}>Input Wt</th>
              <th style={{ padding: '10px 12px', border: '1px solid #9fb6dd', textAlign: 'right', width: '95px' }}>Output FG</th>
              <th style={{ padding: '10px 12px', border: '1px solid #9fb6dd', textAlign: 'right', width: '85px' }}>Yield %</th>
              <th style={{ padding: '10px 12px', border: '1px solid #9fb6dd', textAlign: 'right', width: '90px' }}>Processing Fee</th>
              <th style={{ padding: '10px 12px', border: '1px solid #9fb6dd', width: '80px', textAlign: 'center' }}>QC Status</th>
              <th style={{ padding: '10px 12px', border: '1px solid #9fb6dd', textAlign: 'center', width: '200px' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="13" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                  Loading Inpass receipt records...
                </td>
              </tr>
            ) : filteredInpasses.length === 0 ? (
              <tr>
                <td colSpan="13" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                  No Inpass records found. Click <strong>"+ Receive New Inpass"</strong> to record returned material.
                </td>
              </tr>
            ) : (
              filteredInpasses.map((row, idx) => {
                const inWt = parseFloat(row.input_weight) || 0;
                const outWt = parseFloat(row.output_weight) || 0;
                const charges = parseFloat(row.total_processing_charges) || 0;
                const items = row.items || [];

                return (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom: '1px solid #e2e8f0',
                      backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc'
                    }}
                  >
                    <td style={{ padding: '8px 10px', border: '1px solid #c0c8da', textAlign: 'center' }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: '8px 10px', border: '1px solid #c0c8da', fontFamily: 'monospace', fontWeight: 'bold', color: '#1f4fb2' }}>
                      {row.inpass_no}
                      <span style={{ display: 'block', fontSize: '10px', color: '#64748b', fontWeight: 'normal' }}>
                        {row.vehicle_no || 'No Vehicle'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', border: '1px solid #c0c8da', whiteSpace: 'nowrap' }}>
                      {row.date}
                    </td>
                    <td style={{ padding: '8px 10px', border: '1px solid #c0c8da', fontFamily: 'monospace', fontWeight: 'bold', color: '#2563eb' }}>
                      {row.outpass_no || '-'}
                      {row.reference_no && (
                        <span style={{ display: 'block', fontSize: '10px', color: '#64748b', fontWeight: 'normal' }}>
                          Ref: #{row.reference_no}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '8px 10px', border: '1px solid #c0c8da', fontWeight: 600, color: '#0f172a' }}>
                      {row.party_name}
                    </td>
                    <td style={{ padding: '8px 10px', border: '1px solid #c0c8da', color: '#475569', fontSize: '12px' }}>
                      {row.mill_area || '-'}
                    </td>
                    <td style={{ padding: '8px 10px', border: '1px solid #c0c8da', fontSize: '12px' }}>
                      {items.length === 0 ? (
                        <span style={{ color: '#94a3b8' }}>-</span>
                      ) : (
                        items.map((it, i) => (
                          <div key={i} style={{ borderBottom: i < items.length - 1 ? '1px dashed #e2e8f0' : 'none', paddingBottom: '2px', marginBottom: '2px' }}>
                            <strong style={{ color: '#1e293b' }}>{it.item_name}</strong>
                            {it.lot_no && (
                              <span style={{ marginLeft: '6px', fontFamily: 'monospace', color: '#059669', background: '#ecfdf5', padding: '1px 4px', borderRadius: '3px', fontSize: '11px' }}>
                                {it.lot_no}
                              </span>
                            )}
                            <div style={{ color: '#64748b', fontSize: '11px' }}>
                              {it.qty} bags • {(parseFloat(it.total_weight) || 0).toFixed(1)} kg ({it.output_type})
                            </div>
                          </div>
                        ))
                      )}
                    </td>
                    <td style={{ padding: '8px 10px', border: '1px solid #c0c8da', textAlign: 'right', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>
                      {inWt.toFixed(2)} kg
                    </td>
                    <td style={{ padding: '8px 10px', border: '1px solid #c0c8da', textAlign: 'right', fontWeight: 'bold', color: '#2e7d32', whiteSpace: 'nowrap' }}>
                      {outWt.toFixed(2)} kg
                    </td>
                    <td style={{ padding: '8px 10px', border: '1px solid #c0c8da', textAlign: 'right', fontWeight: 'bold', color: '#1f4fb2', whiteSpace: 'nowrap' }}>
                      {row.yield_percent}%
                    </td>
                    <td style={{ padding: '8px 10px', border: '1px solid #c0c8da', textAlign: 'right', fontWeight: 'bold', color: '#4f46e5', whiteSpace: 'nowrap' }}>
                      ₹{charges.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ padding: '8px 10px', border: '1px solid #c0c8da', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        backgroundColor: '#dcfce7',
                        color: '#15803d',
                        border: '1px solid #86efac'
                      }}>
                        {row.qc_status || 'PASS'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', border: '1px solid #c0c8da', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="action-btn print-btn"
                          style={{ backgroundColor: '#0288d1', padding: '4px 8px', fontSize: '11px' }}
                          onClick={() => handlePrint(row)}
                          title="Print Inpass receipt note"
                        >
                          <PrintIcon style={{ fontSize: '13px', marginRight: '2px' }} /> Print
                        </button>
                        <button
                          type="button"
                          className="action-btn update-btn"
                          style={{ backgroundColor: '#1976d2', padding: '4px 8px', fontSize: '11px' }}
                          onClick={() => handleOpenEdit(row)}
                          title="Update Inpass record"
                        >
                          <EditIcon style={{ fontSize: '13px', marginRight: '2px' }} /> Update
                        </button>
                        <button
                          type="button"
                          className="action-btn danger"
                          style={{ backgroundColor: '#d32f2f', padding: '4px 8px', fontSize: '11px' }}
                          onClick={() => handleDelete(row.id, row.inpass_no)}
                          title="Delete / cancel Inpass and reverse stock"
                        >
                          <DeleteOutlineIcon style={{ fontSize: '13px', marginRight: '2px' }} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: '13px', color: '#475569' }}>
        <div>Total Inpass Records: <strong>{inpasses.length}</strong></div>
        <div style={{ fontSize: '12px' }}>BVC Agro External Processing & Material Return Registry</div>
      </div>

      {/* Edit Inpass Modal */}
      {editModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#ffffff', borderRadius: '6px', maxWidth: '580px', width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(135deg, #1f4fb2 0%, #2a5ea0 100%)', color: '#fff', padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '16px' }}>Update Inpass: {editFormData.inpass_no}</strong>
              <button onClick={() => setEditModalOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                <CloseIcon />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} style={{ padding: '18px', fontSize: '13px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Inpass Date</label>
                  <input
                    type="date"
                    value={editFormData.date}
                    onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                    style={{ width: '100%', padding: '7px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Vehicle No</label>
                  <input
                    type="text"
                    value={editFormData.vehicle_no}
                    onChange={(e) => setEditFormData({ ...editFormData, vehicle_no: e.target.value })}
                    style={{ width: '100%', padding: '7px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Driver Name</label>
                  <input
                    type="text"
                    value={editFormData.driver_name}
                    onChange={(e) => setEditFormData({ ...editFormData, driver_name: e.target.value })}
                    style={{ width: '100%', padding: '7px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Received By</label>
                  <input
                    type="text"
                    value={editFormData.received_by}
                    onChange={(e) => setEditFormData({ ...editFormData, received_by: e.target.value })}
                    style={{ width: '100%', padding: '7px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>QC Status</label>
                  <select
                    value={editFormData.qc_status}
                    onChange={(e) => setEditFormData({ ...editFormData, qc_status: e.target.value })}
                    style={{ width: '100%', padding: '7px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  >
                    <option value="PASS">PASS</option>
                    <option value="QC_PENDING">QC_PENDING</option>
                    <option value="FAIL">FAIL</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Status</label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    style={{ width: '100%', padding: '7px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  >
                    <option value="RECEIVED">RECEIVED</option>
                    <option value="QC_PASSED">QC_PASSED</option>
                    <option value="COMPLETED">COMPLETED</option>
                  </select>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Shortage / Discrepancy Reason</label>
                  <input
                    type="text"
                    value={editFormData.discrepancy_reason}
                    onChange={(e) => setEditFormData({ ...editFormData, discrepancy_reason: e.target.value })}
                    style={{ width: '100%', padding: '7px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                    placeholder="If actual output weight was less than input weight"
                  />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Remarks</label>
                  <textarea
                    rows="2"
                    value={editFormData.remarks}
                    onChange={(e) => setEditFormData({ ...editFormData, remarks: e.target.value })}
                    style={{ width: '100%', padding: '7px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  style={{ padding: '7px 16px', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="action-btn update-btn"
                  style={{ padding: '7px 20px', fontWeight: 'bold' }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InpassDisplay;
