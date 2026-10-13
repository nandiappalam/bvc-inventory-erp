import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { printHtml } from '../../utils/printHelper';
import { printOutpassDocument } from '../../utils/movementPrintTemplates';

// Standard MUI Icons consistent with BVC ERP theme
import RefreshIcon from '@mui/icons-material/Refresh';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import CallReceivedIcon from '@mui/icons-material/CallReceived';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SearchIcon from '@mui/icons-material/Search';
import PrintIcon from '@mui/icons-material/Print';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';

const OutpassDisplay = () => {
  const navigate = useNavigate();
  const [outpasses, setOutpasses] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [purposeFilter, setPurposeFilter] = useState('ALL');

  // Modals
  const [selectedOutpass, setSelectedOutpass] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    id: '',
    outpass_no: '',
    date: '',
    purpose: '',
    party_name: '',
    vehicle_no: '',
    driver_name: '',
    driver_phone: '',
    transporter: '',
    destination: '',
    expected_return_date: '',
    status: '',
    remarks: ''
  });

  const fetchOutpasses = async () => {
    setLoading(true);
    try {
      const res = await api('/outpasses', {
        params: {
          search: searchTerm || undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          purpose: purposeFilter !== 'ALL' ? purposeFilter : undefined
        }
      });
      if (res?.success) {
        setOutpasses(res.data || []);
      }

      const sumRes = await api('/outpasses/report/summary');
      if (sumRes?.success) {
        setSummary(sumRes.data || {});
      }
    } catch (err) {
      console.error('Error fetching outpasses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutpasses();
  }, [statusFilter, purposeFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchOutpasses();
  };

  const handleDelete = async (id, outpassNo) => {
    const confirmed = window.__appConfirm ? await window.__appConfirm({
      title: 'Confirm Outpass Deletion',
      message: `Are you sure you want to delete and cancel Outpass ${outpassNo}?\n\nThis will restore the dispatched materials back to factory Available Stock and unlink related Grinds.`,
      confirmText: 'Delete Outpass',
      confirmColor: 'error'
    }) : window.confirm(`Are you sure you want to delete and cancel Outpass ${outpassNo}?`);
    if (!confirmed) return;

    try {
      const res = await api(`/outpasses/${id}`, { method: 'DELETE' });
      if (res && res.success !== false) {
        alert(res.message || 'Outpass deleted and stock restored successfully');
        fetchOutpasses();
      } else {
        alert(res?.message || 'Error deleting outpass');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleOpenEdit = (op) => {
    setEditFormData({
      id: op.id,
      outpass_no: op.outpass_no,
      date: op.date || '',
      purpose: op.purpose || 'Outside Processing',
      party_name: op.party_name || '',
      vehicle_no: op.vehicle_no || '',
      driver_name: op.driver_name || '',
      driver_phone: op.driver_phone || '',
      transporter: op.transporter || '',
      destination: op.destination || '',
      expected_return_date: op.expected_return_date || '',
      status: op.status || 'OUTPASSED',
      remarks: op.remarks || ''
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      const res = await api(`/outpasses/${editFormData.id}`, {
        method: 'PUT',
        data: { formData: editFormData }
      });
      if (res && res.success !== false) {
        alert('Outpass updated successfully');
        setEditModalOpen(false);
        fetchOutpasses();
      } else {
        alert(res?.message || 'Failed to update Outpass');
      }
    } catch (err) {
      alert('Error updating outpass: ' + err.message);
    }
  };

  const handlePrint = (op) => {
    printOutpassDocument(op, 'ORIGINAL STORE COPY');
  };

  const filteredOutpasses = outpasses.filter(row => {
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
          <LocalShippingIcon style={{ fontSize: '24px' }} />
          <span>Material Gate Outpass Display</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="action-btn"
            style={{ backgroundColor: '#ffffff', color: '#1f4fb2', fontWeight: 'bold' }}
            onClick={() => navigate('/entry/inpass-display')}
          >
            <CallReceivedIcon style={{ fontSize: '15px', marginRight: '4px' }} /> Inpass Receipts
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
            onClick={() => navigate('/entry/outpass-create')}
          >
            <AddCircleIcon style={{ fontSize: '15px', marginRight: '4px' }} /> + Issue New Outpass
          </button>
        </div>
      </div>

      {/* KPI Stats Tiles in theme style */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px', marginBottom: '14px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderLeft: '5px solid #1f4fb2', borderRadius: '4px', padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Total Outpasses Issued</div>
          <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#1f4fb2', marginTop: '2px' }}>
            {summary.total_count || outpasses.length}
          </div>
          <div style={{ fontSize: '11px', color: '#2563eb', marginTop: '2px' }}>
            {summary.processing_count || 0} Outside Processing
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderLeft: '5px solid #0288d1', borderRadius: '4px', padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Total Dispatched Material</div>
          <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#0288d1', marginTop: '2px' }}>
            {(parseFloat(summary.total_weight) || 0).toFixed(0)} <span style={{ fontSize: '13px' }}>KG</span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            {summary.total_qty || 0} Total Bags Sent
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderLeft: '5px solid #2e7d32', borderRadius: '4px', padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Returned via Inpass</div>
          <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#2e7d32', marginTop: '2px' }}>
            {(parseFloat(summary.total_returned_weight) || 0).toFixed(0)} <span style={{ fontSize: '13px' }}>KG</span>
          </div>
          <div style={{ fontSize: '11px', color: '#166534', marginTop: '2px' }}>
            Credited into Factory Stock
          </div>
        </div>

        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderLeft: '5px solid #d97706', borderRadius: '4px', padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '12px', color: '#92400e', fontWeight: 600 }}>Outside Mill Stock Pending</div>
          <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#b45309', marginTop: '2px' }}>
            {(parseFloat(summary.total_pending_weight) || 0).toFixed(0)} <span style={{ fontSize: '13px' }}>KG</span>
          </div>
          <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 'bold', marginTop: '2px' }}>
            Awaiting Return Inpass
          </div>
        </div>
      </div>

      {/* Filter Section Toolbar */}
      <div style={{ background: '#e9eef7', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #9fb6dd', marginBottom: '14px', borderRadius: '4px', flexWrap: 'wrap', gap: '10px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, minWidth: '260px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Outpass No, Mill, Item, Lot, Vehicle..."
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

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '7px 10px', border: '1px solid #7fa1d6', borderRadius: '4px', fontSize: '13px', backgroundColor: '#ffffff' }}
          >
            <option value="ALL">All Status</option>
            <option value="OUTPASSED">Outpassed (Pending Return)</option>
            <option value="PARTIAL_RECEIVED">Partial Received</option>
            <option value="CLOSED">Closed (Completed)</option>
          </select>

          <select
            value={purposeFilter}
            onChange={(e) => setPurposeFilter(e.target.value)}
            style={{ padding: '7px 10px', border: '1px solid #7fa1d6', borderRadius: '4px', fontSize: '13px', backgroundColor: '#ffffff' }}
          >
            <option value="ALL">All Purposes</option>
            <option value="Outside Processing">Outside Processing</option>
            <option value="Job Work">Job Work</option>
            <option value="Repair">Repair</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Sample">Sample</option>
            <option value="Customer Return">Customer Return</option>
            <option value="Supplier Return">Supplier Return</option>
          </select>

          <button
            type="button"
            className="action-btn"
            style={{ backgroundColor: '#1f4fb2', color: '#ffffff', padding: '7px 12px' }}
            onClick={fetchOutpasses}
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
              <th style={{ padding: '10px 12px', border: '1px solid #9fb6dd', width: '110px' }}>Outpass No</th>
              <th style={{ padding: '10px 12px', border: '1px solid #9fb6dd', width: '95px' }}>Date</th>
              <th style={{ padding: '10px 12px', border: '1px solid #9fb6dd' }}>External Mill / Party</th>
              <th style={{ padding: '10px 12px', border: '1px solid #9fb6dd' }}>Mill Area / Dest</th>
              <th style={{ padding: '10px 12px', border: '1px solid #9fb6dd' }}>Dispatched Items & Lots</th>
              <th style={{ padding: '10px 12px', border: '1px solid #9fb6dd', textAlign: 'right', width: '95px' }}>Total Wt</th>
              <th style={{ padding: '10px 12px', border: '1px solid #9fb6dd', textAlign: 'right', width: '95px' }}>Returned</th>
              <th style={{ padding: '10px 12px', border: '1px solid #9fb6dd', textAlign: 'right', width: '95px' }}>Pending</th>
              <th style={{ padding: '10px 12px', border: '1px solid #9fb6dd', width: '90px' }}>Vehicle</th>
              <th style={{ padding: '10px 12px', border: '1px solid #9fb6dd', width: '100px', textAlign: 'center' }}>Status</th>
              <th style={{ padding: '10px 12px', border: '1px solid #9fb6dd', textAlign: 'center', width: '220px' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="12" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                  Loading Outpass movement records...
                </td>
              </tr>
            ) : filteredOutpasses.length === 0 ? (
              <tr>
                <td colSpan="12" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                  No Outpass records found. Click <strong>"+ Issue New Outpass"</strong> to create a dispatch.
                </td>
              </tr>
            ) : (
              filteredOutpasses.map((row, idx) => {
                const totalWt = parseFloat(row.total_weight) || 0;
                const retWt = parseFloat(row.returned_weight) || 0;
                const pendingWt = Math.max(0, totalWt - retWt);
                const isClosed = row.status === 'CLOSED' || pendingWt <= 0.1;
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
                      {row.outpass_no}
                      <span style={{ display: 'block', fontSize: '10px', color: '#64748b', fontWeight: 'normal' }}>
                        {row.purpose}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', border: '1px solid #c0c8da', whiteSpace: 'nowrap' }}>
                      {row.date}
                    </td>
                    <td style={{ padding: '8px 10px', border: '1px solid #c0c8da', fontWeight: 600, color: '#0f172a' }}>
                      {row.party_name}
                      {row.reference_no && (
                        <span style={{ display: 'block', fontSize: '11px', color: '#475569', fontWeight: 'normal' }}>
                          Ref: {row.reference_type} #{row.reference_no}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '8px 10px', border: '1px solid #c0c8da', color: '#475569', fontSize: '12px' }}>
                      {row.mill_area || row.destination || '-'}
                    </td>
                    <td style={{ padding: '8px 10px', border: '1px solid #c0c8da', fontSize: '12px' }}>
                      {items.length === 0 ? (
                        <span style={{ color: '#94a3b8' }}>-</span>
                      ) : (
                        items.map((it, i) => (
                          <div key={i} style={{ borderBottom: i < items.length - 1 ? '1px dashed #e2e8f0' : 'none', paddingBottom: '2px', marginBottom: '2px' }}>
                            <strong style={{ color: '#1e293b' }}>{it.item_name}</strong>
                            {it.lot_no && (
                              <span style={{ marginLeft: '6px', fontFamily: 'monospace', color: '#2563eb', background: '#eff6ff', padding: '1px 4px', borderRadius: '3px', fontSize: '11px' }}>
                                {it.lot_no}
                              </span>
                            )}
                            <div style={{ color: '#64748b', fontSize: '11px' }}>
                              {it.qty} bags • {(parseFloat(it.total_weight) || 0).toFixed(1)} kg
                            </div>
                          </div>
                        ))
                      )}
                    </td>
                    <td style={{ padding: '8px 10px', border: '1px solid #c0c8da', textAlign: 'right', fontWeight: 'bold', color: '#1f4fb2', whiteSpace: 'nowrap' }}>
                      {totalWt.toFixed(2)} kg
                      <span style={{ display: 'block', fontSize: '10px', color: '#64748b', fontWeight: 'normal' }}>
                        {row.total_qty || 0} bags
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', border: '1px solid #c0c8da', textAlign: 'right', fontWeight: 'bold', color: '#2e7d32', whiteSpace: 'nowrap' }}>
                      {retWt.toFixed(2)} kg
                    </td>
                    <td style={{ padding: '8px 10px', border: '1px solid #c0c8da', textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                      <span style={{ color: pendingWt > 0 ? '#b45309' : '#94a3b8' }}>
                        {pendingWt.toFixed(2)} kg
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', border: '1px solid #c0c8da', whiteSpace: 'nowrap', fontSize: '12px' }}>
                      {row.vehicle_no ? (
                        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{row.vehicle_no}</span>
                      ) : '-'}
                      {row.driver_name && (
                        <span style={{ display: 'block', fontSize: '10px', color: '#64748b' }}>{row.driver_name}</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 10px', border: '1px solid #c0c8da', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        backgroundColor: isClosed ? '#dcfce7' : (retWt > 0 ? '#fef3c7' : '#dbeafe'),
                        color: isClosed ? '#15803d' : (retWt > 0 ? '#92400e' : '#1e40af'),
                        border: `1px solid ${isClosed ? '#86efac' : (retWt > 0 ? '#fde68a' : '#bfdbfe')}`
                      }}>
                        {row.status}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', border: '1px solid #c0c8da', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                        {!isClosed && (
                          <button
                            type="button"
                            className="action-btn success"
                            style={{ backgroundColor: '#2e7d32', padding: '4px 8px', fontSize: '11px' }}
                            onClick={() => navigate(`/entry/inpass-create?outpass_id=${row.id}`)}
                            title="Receive processed items via Inpass"
                          >
                            <CallReceivedIcon style={{ fontSize: '13px', marginRight: '2px' }} /> Inpass
                          </button>
                        )}
                        <button
                          type="button"
                          className="action-btn print-btn"
                          style={{ backgroundColor: '#0288d1', padding: '4px 8px', fontSize: '11px' }}
                          onClick={() => handlePrint(row)}
                          title="Print Gate Pass"
                        >
                          <PrintIcon style={{ fontSize: '13px', marginRight: '2px' }} /> Print
                        </button>
                        <button
                          type="button"
                          className="action-btn update-btn"
                          style={{ backgroundColor: '#1976d2', padding: '4px 8px', fontSize: '11px' }}
                          onClick={() => handleOpenEdit(row)}
                          title="Update Outpass details"
                        >
                          <EditIcon style={{ fontSize: '13px', marginRight: '2px' }} /> Update
                        </button>
                        <button
                          type="button"
                          className="action-btn danger"
                          style={{ backgroundColor: '#d32f2f', padding: '4px 8px', fontSize: '11px' }}
                          onClick={() => handleDelete(row.id, row.outpass_no)}
                          disabled={retWt > 0}
                          title={retWt > 0 ? 'Cannot delete: Material already received via Inpass' : 'Delete Outpass and restore stock'}
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
        <div>Total Outpass Records: <strong>{outpasses.length}</strong></div>
        <div style={{ fontSize: '12px' }}>BVC Agro Security & Outside Processing Gate System</div>
      </div>

      {/* Edit Outpass Modal */}
      {editModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#ffffff', borderRadius: '6px', maxWidth: '600px', width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(135deg, #1f4fb2 0%, #2a5ea0 100%)', color: '#fff', padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '16px' }}>Update Outpass: {editFormData.outpass_no}</strong>
              <button onClick={() => setEditModalOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                <CloseIcon />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} style={{ padding: '18px', fontSize: '13px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Outpass Date</label>
                  <input
                    type="date"
                    value={editFormData.date}
                    onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                    style={{ width: '100%', padding: '7px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Purpose</label>
                  <select
                    value={editFormData.purpose}
                    onChange={(e) => setEditFormData({ ...editFormData, purpose: e.target.value })}
                    style={{ width: '100%', padding: '7px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  >
                    <option value="Outside Processing">Outside Processing</option>
                    <option value="Job Work">Job Work</option>
                    <option value="Repair">Repair</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Sample">Sample</option>
                    <option value="Customer Return">Customer Return</option>
                    <option value="Supplier Return">Supplier Return</option>
                    <option value="Other">Other</option>
                  </select>
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
                  <label style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Driver Phone</label>
                  <input
                    type="text"
                    value={editFormData.driver_phone}
                    onChange={(e) => setEditFormData({ ...editFormData, driver_phone: e.target.value })}
                    style={{ width: '100%', padding: '7px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Transporter</label>
                  <input
                    type="text"
                    value={editFormData.transporter}
                    onChange={(e) => setEditFormData({ ...editFormData, transporter: e.target.value })}
                    style={{ width: '100%', padding: '7px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Destination</label>
                  <input
                    type="text"
                    value={editFormData.destination}
                    onChange={(e) => setEditFormData({ ...editFormData, destination: e.target.value })}
                    style={{ width: '100%', padding: '7px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Status</label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    style={{ width: '100%', padding: '7px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  >
                    <option value="OUTPASSED">OUTPASSED</option>
                    <option value="AT_EXTERNAL_MILL">AT_EXTERNAL_MILL</option>
                    <option value="PARTIAL_RECEIVED">PARTIAL_RECEIVED</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
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

export default OutpassDisplay;
