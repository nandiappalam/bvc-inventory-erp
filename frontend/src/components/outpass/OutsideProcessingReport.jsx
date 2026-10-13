import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { printHtml } from '../../utils/printHelper';
import { printOutpassDocument, printInpassDocument } from '../../utils/movementPrintTemplates';

// MUI Icons
import AssessmentIcon from '@mui/icons-material/Assessment';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CallReceivedIcon from '@mui/icons-material/CallReceived';
import RefreshIcon from '@mui/icons-material/Refresh';
import FactoryIcon from '@mui/icons-material/Factory';
import PrintIcon from '@mui/icons-material/Print';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloseIcon from '@mui/icons-material/Close';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';

const OutsideProcessingReport = () => {
  const navigate = useNavigate();
  const [outpasses, setOutpasses] = useState([]);
  const [inpasses, setInpasses] = useState([]);
  const [grains, setGrains] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters & Search
  const [activeTab, setActiveTab] = useState('ALL_MOVEMENTS'); // 'ALL_MOVEMENTS', 'PENDING_ARRIVALS', 'ARRIVED', 'MILL_SUMMARY'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMillFilter, setSelectedMillFilter] = useState('ALL');

  // Edit Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    id: '',
    outpass_no: '',
    date: '',
    purpose: 'Outside Processing',
    party_name: '',
    vehicle_no: '',
    driver_name: '',
    driver_phone: '',
    transporter: '',
    destination: '',
    expected_return_date: '',
    status: 'OUTPASSED',
    remarks: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [opRes, ipRes, gRes] = await Promise.all([
        api('/outpasses'),
        api('/inpasses'),
        api('/grains')
      ]);

      if (opRes?.success) setOutpasses(opRes.data || []);
      else if (Array.isArray(opRes)) setOutpasses(opRes);

      if (ipRes?.success) setInpasses(ipRes.data || []);
      else if (Array.isArray(ipRes)) setInpasses(ipRes);

      if (Array.isArray(gRes)) setGrains(gRes);
      else if (gRes?.data && Array.isArray(gRes.data)) setGrains(gRes.data);
    } catch (e) {
      console.error('Error fetching outside processing tracking data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeleteOutpass = async (id, outpassNo) => {
    const confirmed = window.__appConfirm ? await window.__appConfirm({
      title: 'Confirm Outpass Cancellation',
      message: `Are you sure you want to cancel and delete Outpass ${outpassNo}?\n\nDispatched materials will be restored back into Factory Available Stock.`,
      confirmText: 'Delete Outpass',
      confirmColor: 'error'
    }) : window.confirm(`Are you sure you want to cancel and delete Outpass ${outpassNo}?`);
    if (!confirmed) return;
    try {
      const res = await api(`/outpasses/${id}`, { method: 'DELETE' });
      if (res && res.success !== false) {
        alert(res.message || 'Outpass cancelled and stock restored successfully');
        fetchData();
      } else {
        alert(res?.message || 'Failed to delete outpass');
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
        alert('Outpass details updated successfully');
        setEditModalOpen(false);
        fetchData();
      } else {
        alert(res?.message || 'Failed to update Outpass');
      }
    } catch (err) {
      alert('Error updating outpass: ' + err.message);
    }
  };

  const handlePrintOutpass = (op) => {
    printOutpassDocument(op, 'ORIGINAL STORE COPY');
  };

  const handlePrintInpass = (ip) => {
    printInpassDocument(ip, 'ORIGINAL STORE COPY');
  };

  // Map Outpass to its associated Inpass
  const inpassMapByOutpassId = {};
  inpasses.forEach(ip => {
    if (ip.outpass_id) {
      inpassMapByOutpassId[ip.outpass_id] = ip;
    }
  });

  // Extract list of unique mills for filter
  const allMills = Array.from(new Set(outpasses.map(op => op.party_name).filter(Boolean)));

  // Filter Outpasses based on search and tab
  const filteredOutpasses = outpasses.filter(op => {
    const totalWt = parseFloat(op.total_weight) || 0;
    const retWt = parseFloat(op.returned_weight) || 0;
    const pendingWt = Math.max(0, totalWt - retWt);
    const isArrived = op.status === 'CLOSED' || pendingWt <= 0.1;

    if (activeTab === 'PENDING_ARRIVALS' && isArrived) return false;
    if (activeTab === 'ARRIVED' && !isArrived) return false;

    if (selectedMillFilter !== 'ALL' && op.party_name !== selectedMillFilter) return false;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchOpNo = (op.outpass_no || '').toLowerCase().includes(term);
      const matchParty = (op.party_name || '').toLowerCase().includes(term);
      const matchArea = (op.mill_area || op.destination || '').toLowerCase().includes(term);
      const matchVeh = (op.vehicle_no || '').toLowerCase().includes(term);
      const matchItems = (op.items || []).some(it => (it.item_name || '').toLowerCase().includes(term) || (it.lot_no || '').toLowerCase().includes(term));
      return matchOpNo || matchParty || matchArea || matchVeh || matchItems;
    }
    return true;
  });

  // KPI Calculations
  const totalDispatchedKg = outpasses.reduce((s, op) => s + (parseFloat(op.total_weight) || 0), 0);
  const totalReturnedKg = outpasses.reduce((s, op) => s + (parseFloat(op.returned_weight) || 0), 0);
  const totalPendingKg = Math.max(0, totalDispatchedKg - totalReturnedKg);
  const totalProcessingFees = outpasses.reduce((s, op) => s + (parseFloat(op.estimated_charges) || 0), 0);
  const pendingCount = outpasses.filter(op => (parseFloat(op.total_weight) || 0) - (parseFloat(op.returned_weight) || 0) > 0.1).length;

  return (
    <div className="erp-display-page" style={{ padding: '16px', background: '#f0f6ff', minHeight: '100vh', fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif" }}>
      {/* Universal Page Title Header */}
      <div className="screen-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AssessmentIcon style={{ fontSize: '24px' }} />
          <span>Outside Mill Processing & Movement Tracking Dashboard</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="action-btn"
            style={{ backgroundColor: '#1f4fb2', color: '#ffffff', fontWeight: 'bold' }}
            onClick={() => navigate('/entry/outpass-create')}
          >
            <AddCircleIcon style={{ fontSize: '15px', marginRight: '4px' }} /> + Issue Outpass
          </button>
          <button
            type="button"
            className="action-btn"
            style={{ backgroundColor: '#2e7d32', color: '#ffffff', fontWeight: 'bold' }}
            onClick={() => navigate('/entry/inpass-create')}
          >
            <CallReceivedIcon style={{ fontSize: '15px', marginRight: '4px' }} /> + Receive Inpass
          </button>
          <button
            type="button"
            className="action-btn"
            style={{ backgroundColor: '#ffffff', color: '#1f4fb2', fontWeight: 'bold' }}
            onClick={fetchData}
            title="Refresh dashboard"
          >
            <RefreshIcon style={{ fontSize: '15px', marginRight: '4px' }} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Stats Tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '14px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderLeft: '5px solid #1f4fb2', borderRadius: '4px', padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Total RM Dispatched</div>
          <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#1f4fb2', marginTop: '2px' }}>
            {totalDispatchedKg.toFixed(0)} <span style={{ fontSize: '13px' }}>KG</span>
          </div>
          <div style={{ fontSize: '11px', color: '#2563eb', marginTop: '2px' }}>
            {outpasses.length} Total Outpass Dispatches
          </div>
        </div>

        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderLeft: '5px solid #d97706', borderRadius: '4px', padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '12px', color: '#92400e', fontWeight: 600 }}>Outside Mill Stock (Pending)</div>
          <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#b45309', marginTop: '2px' }}>
            {totalPendingKg.toFixed(0)} <span style={{ fontSize: '13px' }}>KG</span>
          </div>
          <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 'bold', marginTop: '2px' }}>
            {pendingCount} Movements Outstanding
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderLeft: '5px solid #2e7d32', borderRadius: '4px', padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Processed Goods Returned</div>
          <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#2e7d32', marginTop: '2px' }}>
            {totalReturnedKg.toFixed(0)} <span style={{ fontSize: '13px' }}>KG</span>
          </div>
          <div style={{ fontSize: '11px', color: '#166534', marginTop: '2px' }}>
            {totalDispatchedKg > 0 ? ((totalReturnedKg / totalDispatchedKg) * 100).toFixed(1) : 0}% Overall Recovery Yield
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderLeft: '5px solid #4f46e5', borderRadius: '4px', padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Processing Fees Agred</div>
          <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#4f46e5', marginTop: '2px' }}>
            ₹{totalProcessingFees.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '11px', color: '#4338ca', marginTop: '2px' }}>
            External Contractor Payable
          </div>
        </div>
      </div>

      {/* Tabs & Search Toolbar */}
      <div style={{ background: '#e9eef7', padding: '12px 16px', borderBottom: '2px solid #9fb6dd', marginBottom: '14px', borderRadius: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: '6px', backgroundColor: '#ffffff', padding: '3px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
            <button
              type="button"
              onClick={() => setActiveTab('ALL_MOVEMENTS')}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 'bold',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: activeTab === 'ALL_MOVEMENTS' ? '#1f4fb2' : 'transparent',
                color: activeTab === 'ALL_MOVEMENTS' ? '#ffffff' : '#475569'
              }}
            >
              All Movements ({outpasses.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('PENDING_ARRIVALS')}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 'bold',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: activeTab === 'PENDING_ARRIVALS' ? '#d97706' : 'transparent',
                color: activeTab === 'PENDING_ARRIVALS' ? '#ffffff' : '#92400e'
              }}
            >
              Pending Returns ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ARRIVED')}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 'bold',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: activeTab === 'ARRIVED' ? '#2e7d32' : 'transparent',
                color: activeTab === 'ARRIVED' ? '#ffffff' : '#166534'
              }}
            >
              Arrived & Received ({outpasses.length - pendingCount})
            </button>
          </div>

          {/* Search & Mill Filter */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, maxWidth: '520px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search Product, Lot, Mill, City, Vehicle, Outpass..."
                style={{ width: '100%', padding: '6px 10px 6px 28px', border: '1px solid #7fa1d6', borderRadius: '4px', fontSize: '13px', backgroundColor: '#ffffff' }}
              />
              <SearchIcon style={{ position: 'absolute', left: '6px', top: '6px', fontSize: '18px', color: '#64748b' }} />
            </div>

            <select
              value={selectedMillFilter}
              onChange={(e) => setSelectedMillFilter(e.target.value)}
              style={{ padding: '6px 10px', border: '1px solid #7fa1d6', borderRadius: '4px', fontSize: '13px', backgroundColor: '#ffffff', minWidth: '150px' }}
            >
              <option value="ALL">All External Mills</option>
              {allMills.map((m, idx) => (
                <option key={idx} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Movement Tracking Table */}
      <div style={{ background: '#ffffff', border: '1px solid #c0c8da', borderRadius: '4px', overflowX: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#1f4fb2', color: '#ffffff' }}>
              <th style={{ padding: '10px 8px', border: '1px solid #9fb6dd', width: '45px', textAlign: 'center' }}>S.No</th>
              <th style={{ padding: '10px 8px', border: '1px solid #9fb6dd', width: '110px' }}>Outpass & Date</th>
              <th style={{ padding: '10px 8px', border: '1px solid #9fb6dd' }}>External Mill & Area</th>
              <th style={{ padding: '10px 8px', border: '1px solid #9fb6dd' }}>Input Item & Quantity</th>
              <th style={{ padding: '10px 8px', border: '1px solid #9fb6dd', textAlign: 'center', width: '140px' }}>Arrival Status</th>
              <th style={{ padding: '10px 8px', border: '1px solid #9fb6dd' }}>Arrived Output & Qty</th>
              <th style={{ padding: '10px 8px', border: '1px solid #9fb6dd', textAlign: 'right', width: '80px' }}>Yield %</th>
              <th style={{ padding: '10px 8px', border: '1px solid #9fb6dd', textAlign: 'center', width: '220px' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                  Loading outside mill movement tracking records...
                </td>
              </tr>
            ) : filteredOutpasses.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                  No outside mill processing movements found matching filters.
                </td>
              </tr>
            ) : (
              filteredOutpasses.map((op, idx) => {
                const totalWt = parseFloat(op.total_weight) || 0;
                const retWt = parseFloat(op.returned_weight) || 0;
                const pendingWt = Math.max(0, totalWt - retWt);
                const isArrived = op.status === 'CLOSED' || pendingWt <= 0.1;
                const linkedInpass = inpassMapByOutpassId[op.id] || (op.inpasses && op.inpasses[0]);
                const items = op.items || [];

                return (
                  <tr
                    key={op.id}
                    style={{
                      borderBottom: '1px solid #e2e8f0',
                      backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc'
                    }}
                  >
                    <td style={{ padding: '8px', border: '1px solid #c0c8da', textAlign: 'center' }}>
                      {idx + 1}
                    </td>

                    {/* Outpass & Date */}
                    <td style={{ padding: '8px', border: '1px solid #c0c8da', fontFamily: 'monospace' }}>
                      <strong style={{ color: '#1f4fb2', fontSize: '13px', display: 'block' }}>{op.outpass_no}</strong>
                      <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Sent: {op.date}</span>
                      {op.reference_no && (
                        <span style={{ fontSize: '10px', color: '#475569', display: 'block' }}>
                          Ref: #{op.reference_no}
                        </span>
                      )}
                    </td>

                    {/* Mill Name & Area */}
                    <td style={{ padding: '8px', border: '1px solid #c0c8da' }}>
                      <strong style={{ color: '#0f172a', fontSize: '13px', display: 'block' }}>{op.party_name}</strong>
                      <span style={{ fontSize: '11px', color: '#475569', display: 'block' }}>
                        📍 {op.mill_area || op.destination || 'External Mill Premises'}
                      </span>
                      {op.vehicle_no && (
                        <span style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
                          🚛 Vehicle: {op.vehicle_no}
                        </span>
                      )}
                    </td>

                    {/* Input Item & Qty */}
                    <td style={{ padding: '8px', border: '1px solid #c0c8da' }}>
                      {items.length === 0 ? (
                        <span style={{ color: '#94a3b8' }}>-</span>
                      ) : (
                        items.map((it, i) => (
                          <div key={i} style={{ marginBottom: i < items.length - 1 ? '3px' : 0 }}>
                            <strong style={{ color: '#1e293b' }}>{it.item_name}</strong>
                            {it.lot_no && (
                              <span style={{ marginLeft: '4px', fontFamily: 'monospace', color: '#2563eb', background: '#eff6ff', padding: '1px 4px', borderRadius: '3px', fontSize: '10px' }}>
                                {it.lot_no}
                              </span>
                            )}
                            <div style={{ color: '#1e40af', fontWeight: 'bold', fontSize: '11px' }}>
                              {it.qty} bags • {(parseFloat(it.total_weight) || 0).toFixed(1)} kg
                            </div>
                          </div>
                        ))
                      )}
                    </td>

                    {/* Arrival Status */}
                    <td style={{ padding: '8px', border: '1px solid #c0c8da', textAlign: 'center' }}>
                      {isArrived ? (
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 'extrabold', backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }}>
                            <CheckCircleIcon style={{ fontSize: '12px', verticalAlign: 'middle', marginRight: '2px' }} /> ARRIVED
                          </span>
                          {linkedInpass?.date && (
                            <span style={{ fontSize: '10px', color: '#166534', fontWeight: 600 }}>
                              Recd: {linkedInpass.date}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 'extrabold', backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                            <PendingIcon style={{ fontSize: '12px', verticalAlign: 'middle', marginRight: '2px' }} /> NOT ARRIVED
                          </span>
                          <span style={{ fontSize: '10px', color: '#b45309', fontWeight: 'bold' }}>
                            Pending: {pendingWt.toFixed(1)} kg
                          </span>
                          {op.expected_return_date && (
                            <span style={{ fontSize: '9px', color: '#64748b' }}>
                              Due: {op.expected_return_date}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Arrived Output & Qty */}
                    <td style={{ padding: '8px', border: '1px solid #c0c8da' }}>
                      {isArrived && linkedInpass ? (
                        <div>
                          <strong style={{ color: '#047857', display: 'block', fontSize: '12px' }}>
                            Inpass: {linkedInpass.inpass_no}
                          </strong>
                          <div style={{ fontSize: '11px', color: '#065f46', fontWeight: 600 }}>
                            FG Output: {(parseFloat(linkedInpass.output_weight) || 0).toFixed(1)} kg
                          </div>
                          {parseFloat(linkedInpass.byproduct_weight) > 0 && (
                            <div style={{ fontSize: '10px', color: '#2563eb' }}>
                              By-product: {(parseFloat(linkedInpass.byproduct_weight) || 0).toFixed(1)} kg
                            </div>
                          )}
                          {parseFloat(linkedInpass.loss_weight) > 0 && (
                            <div style={{ fontSize: '10px', color: '#dc2626' }}>
                              Process Loss: {(parseFloat(linkedInpass.loss_weight) || 0).toFixed(1)} kg
                            </div>
                          )}
                        </div>
                      ) : retWt > 0 ? (
                        <div style={{ color: '#2e7d32', fontWeight: 'bold' }}>
                          Partial Return: {retWt.toFixed(1)} kg
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', italic: 'true' }}>Awaiting External Milling...</span>
                      )}
                    </td>

                    {/* Yield % */}
                    <td style={{ padding: '8px', border: '1px solid #c0c8da', textAlign: 'right', fontWeight: 'bold', color: '#1f4fb2', fontSize: '13px' }}>
                      {linkedInpass?.yield_percent ? `${linkedInpass.yield_percent}%` : (totalWt > 0 ? `${((retWt / totalWt) * 100).toFixed(1)}%` : '0%')}
                    </td>

                    {/* Clear Action Methods */}
                    <td style={{ padding: '8px', border: '1px solid #c0c8da', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                        {!isArrived && (
                          <button
                            type="button"
                            className="action-btn success"
                            style={{ backgroundColor: '#2e7d32', padding: '4px 8px', fontSize: '11px' }}
                            onClick={() => navigate(`/entry/inpass-create?outpass_id=${op.id}`)}
                            title="Receive processed material via Inpass"
                          >
                            <CallReceivedIcon style={{ fontSize: '13px', marginRight: '2px' }} /> + Inpass
                          </button>
                        )}

                        <button
                          type="button"
                          className="action-btn print-btn"
                          style={{ backgroundColor: '#0288d1', padding: '4px 7px', fontSize: '11px' }}
                          onClick={() => handlePrintOutpass(op)}
                          title="Print Outpass Delivery Challan"
                        >
                          <PrintIcon style={{ fontSize: '13px', marginRight: '2px' }} /> OP Print
                        </button>

                        {linkedInpass && (
                          <button
                            type="button"
                            className="action-btn print-btn"
                            style={{ backgroundColor: '#047857', padding: '4px 7px', fontSize: '11px' }}
                            onClick={() => handlePrintInpass(linkedInpass)}
                            title="Print Inpass Goods Note"
                          >
                            <PrintIcon style={{ fontSize: '13px', marginRight: '2px' }} /> IP Print
                          </button>
                        )}

                        <button
                          type="button"
                          className="action-btn update-btn"
                          style={{ backgroundColor: '#1976d2', padding: '4px 7px', fontSize: '11px' }}
                          onClick={() => handleOpenEdit(op)}
                          title="Update Outpass info"
                        >
                          <EditIcon style={{ fontSize: '13px', marginRight: '2px' }} /> Edit
                        </button>

                        <button
                          type="button"
                          className="action-btn danger"
                          style={{ backgroundColor: '#d32f2f', padding: '4px 7px', fontSize: '11px' }}
                          onClick={() => handleDeleteOutpass(op.id, op.outpass_no)}
                          disabled={retWt > 0}
                          title={retWt > 0 ? 'Cannot delete: Material already received via Inpass' : 'Cancel Outpass and restore stock'}
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
                  <input
                    type="text"
                    value={editFormData.purpose}
                    onChange={(e) => setEditFormData({ ...editFormData, purpose: e.target.value })}
                    style={{ width: '100%', padding: '7px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
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
                  <label style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Destination</label>
                  <input
                    type="text"
                    value={editFormData.destination}
                    onChange={(e) => setEditFormData({ ...editFormData, destination: e.target.value })}
                    style={{ width: '100%', padding: '7px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Expected Return Date</label>
                  <input
                    type="date"
                    value={editFormData.expected_return_date}
                    onChange={(e) => setEditFormData({ ...editFormData, expected_return_date: e.target.value })}
                    style={{ width: '100%', padding: '7px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
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

export default OutsideProcessingReport;
