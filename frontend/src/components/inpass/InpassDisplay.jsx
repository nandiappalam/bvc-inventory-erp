import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { printHtml } from '../../utils/printHelper';

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
    if (!window.confirm(`Are you sure you want to cancel and reverse Inpass ${inpassNo}?\n\nThis will revert received processed goods from factory stock and reopen the linked Outpass.`)) {
      return;
    }

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
    const items = ip.items || [];
    const rowsHtml = items.map((it, idx) => `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="border: 1px solid #cbd5e1; padding: 7px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px; font-weight: bold; color: #1e293b;">${it.item_name}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px; font-size: 11px; text-transform: uppercase; color: #047857; font-weight: 600;">${it.output_type}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px; font-family: monospace; color: #2563eb;">${it.lot_no || '-'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px; text-align: right; font-weight: bold;">${it.qty || 0}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px; text-align: right; font-weight: bold; color: #047857;">${(parseFloat(it.total_weight) || 0).toFixed(2)} kg</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px; color: #475569;">${it.godown_name || 'PJ'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px; text-align: center;"><span style="color: #047857; font-weight: bold;">${it.qc_status || 'PASS'}</span></td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b; max-width: 900px; margin: 0 auto;">
        <!-- Header -->
        <div style="text-align: center; border-bottom: 2px solid #1f4fb2; padding-bottom: 12px; margin-bottom: 14px;">
          <h1 style="margin: 0; color: #1f4fb2; font-size: 24px; text-transform: uppercase; letter-spacing: 0.5px;">BHARANI VEL CHEMICALS / BVC AGRO</h1>
          <p style="margin: 3px 0; font-size: 13px; color: #475569;">Factory Inward Goods Receipt • External Mill Return System</p>
          <div style="display: inline-block; background: #1f4fb2; color: #ffffff; padding: 4px 20px; border-radius: 4px; font-weight: bold; font-size: 14px; margin-top: 6px; letter-spacing: 1px;">
            MATERIAL GATE INPASS / PROCESSED INWARD NOTE
          </div>
        </div>

        <!-- Metadata Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; font-size: 13px;">
          <div>
            <p style="margin: 3px 0;"><strong>Inpass No:</strong> <span style="font-family: monospace; font-size: 15px; font-weight: bold; color: #1f4fb2;">${ip.inpass_no}</span></p>
            <p style="margin: 3px 0;"><strong>Date:</strong> ${ip.date}</p>
            <p style="margin: 3px 0;"><strong>Linked Outpass:</strong> <span style="font-family: monospace; font-weight: bold; color: #2563eb;">${ip.outpass_no || 'N/A'}</span></p>
            <p style="margin: 3px 0;"><strong>Reference Module:</strong> ${ip.reference_type} (${ip.reference_no || `#${ip.reference_id || '-'}`})</p>
            <p style="margin: 3px 0;"><strong>Receiving Godown:</strong> ${ip.to_godown_name || 'PJ Main Factory Godown'}</p>
          </div>
          <div>
            <p style="margin: 3px 0;"><strong>External Mill / Party:</strong> <strong style="color: #0f172a; font-size: 14px;">${ip.party_name}</strong></p>
            ${ip.mill_area ? `<p style="margin: 3px 0; color: #475569;"><strong>Mill Area / City:</strong> ${ip.mill_area}</p>` : ''}
            <p style="margin: 3px 0;"><strong>Vehicle No:</strong> <span style="font-family: monospace; font-weight: bold; background: #f1f5f9; padding: 1px 6px; border-radius: 3px;">${ip.vehicle_no || 'N/A'}</span></p>
            <p style="margin: 3px 0;"><strong>Driver:</strong> ${ip.driver_name || '-'}</p>
            <p style="margin: 3px 0;"><strong>Received By:</strong> ${ip.received_by || 'Admin'}</p>
          </div>
        </div>

        <!-- Mass Balance Card -->
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px; margin-bottom: 15px; font-size: 12px;">
          <h4 style="margin: 0 0 8px 0; color: #065f46; font-size: 13px; text-transform: uppercase;">Mass-Balance & Yield Verification</h4>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
            <div><span style="color: #64748b;">Dispatched Input:</span> <strong style="display: block; font-size: 14px;">${(parseFloat(ip.input_weight) || 0).toFixed(2)} kg</strong></div>
            <div><span style="color: #64748b;">Processed FG:</span> <strong style="display: block; font-size: 14px; color: #047857;">${(parseFloat(ip.output_weight) || 0).toFixed(2)} kg</strong></div>
            <div><span style="color: #64748b;">By-product:</span> <strong style="display: block; font-size: 14px; color: #2563eb;">${(parseFloat(ip.byproduct_weight) || 0).toFixed(2)} kg</strong></div>
            <div><span style="color: #64748b;">Milling Yield:</span> <strong style="display: block; font-size: 14px; color: #047857;">${ip.yield_percent}%</strong></div>
          </div>
          ${parseFloat(ip.discrepancy_weight) > 0 ? `
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #cbd5e1; color: #b91c1c;">
              <strong>Unaccounted Shortage:</strong> ${ip.discrepancy_weight} kg — <em>Reason: ${ip.discrepancy_reason || 'N/A'}</em>
            </div>
          ` : ''}
        </div>

        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 15px;">
          <thead>
            <tr style="background: #1f4fb2; color: #ffffff;">
              <th style="border: 1px solid #cbd5e1; padding: 8px; width: 40px; text-align: center;">S.No</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Received Material</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Category</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left; width: 110px;">Allocated Lot</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 65px;">Bags</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 95px;">Weight</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left; width: 80px;">Godown</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; width: 70px;">QC Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="8" style="text-align: center; padding: 10px;">No items registered</td></tr>'}
          </tbody>
        </table>

        ${parseFloat(ip.total_processing_charges) > 0 ? `
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 10px; margin-bottom: 15px; font-size: 12px; display: flex; justify-content: space-between;">
            <span><strong>Processing Fee Rate:</strong> ₹${ip.processing_charge_per_kg}/kg</span>
            <span><strong>Total Processing Charges Payable:</strong> ₹${parseFloat(ip.total_processing_charges).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        ` : ''}

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center; font-size: 11px; margin-top: 40px;">
          <div style="border-top: 1px solid #64748b; padding-top: 5px;">Security Gate Inward</div>
          <div style="border-top: 1px solid #64748b; padding-top: 5px;">QC Verification Officer</div>
          <div style="border-top: 1px solid #64748b; padding-top: 5px;">Godown In-Charge Receipt</div>
        </div>
      </div>
    `;

    printHtml(html, `Inpass - ${ip.inpass_no}`);
  };

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
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, minWidth: '260px', maxWidth: '520px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Inpass No, Outpass No, Mill, Item, Lot..."
              style={{ width: '100%', padding: '7px 10px 7px 30px', border: '1px solid #7fa1d6', borderRadius: '4px', fontSize: '13px', backgroundColor: '#ffffff' }}
            />
            <SearchIcon style={{ position: 'absolute', left: '7px', top: '7px', fontSize: '18px', color: '#64748b' }} />
          </div>
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
            ) : inpasses.length === 0 ? (
              <tr>
                <td colSpan="13" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                  No Inpass records found. Click <strong>"+ Receive New Inpass"</strong> to record returned material.
                </td>
              </tr>
            ) : (
              inpasses.map((row, idx) => {
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
