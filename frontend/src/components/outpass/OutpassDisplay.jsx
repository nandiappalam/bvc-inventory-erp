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
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';

const OutpassDisplay = () => {
  const navigate = useNavigate();
  const [outpasses, setOutpasses] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
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
    if (!window.confirm(`Are you sure you want to delete and cancel Outpass ${outpassNo}?\n\nThis will restore the dispatched materials back to factory Available Stock and unlink related Grinds.`)) {
      return;
    }

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
    const items = op.items || [];
    const rowsHtml = items.map((it, idx) => `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="border: 1px solid #cbd5e1; padding: 7px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px; font-weight: bold; color: #1e293b;">${it.item_name}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px; font-family: monospace; color: #2563eb;">${it.lot_no || '-'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px; text-align: right; font-weight: bold;">${it.qty || 0}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px; text-align: right;">${(parseFloat(it.weight) || 50).toFixed(2)} kg</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px; text-align: right; font-weight: bold; color: #1e3a8a;">${(parseFloat(it.total_weight) || 0).toFixed(2)} kg</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px; color: #475569;">${it.godown_name || 'PJ'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px;">${it.reason || op.purpose || 'Outside Processing'}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b; max-width: 900px; margin: 0 auto;">
        <!-- Header -->
        <div style="text-align: center; border-bottom: 2px solid #1f4fb2; padding-bottom: 12px; margin-bottom: 14px;">
          <h1 style="margin: 0; color: #1f4fb2; font-size: 24px; text-transform: uppercase; letter-spacing: 0.5px;">BHARANI VEL CHEMICALS / BVC AGRO</h1>
          <p style="margin: 3px 0; font-size: 13px; color: #475569;">Factory & Works • Material Movement & Security Gate Control</p>
          <div style="display: inline-block; background: #1f4fb2; color: #ffffff; padding: 4px 20px; border-radius: 4px; font-weight: bold; font-size: 14px; margin-top: 6px; letter-spacing: 1px;">
            MATERIAL GATE OUTPASS (DELIVERY CHALLAN)
          </div>
        </div>

        <!-- Metadata Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; font-size: 13px;">
          <div>
            <p style="margin: 3px 0;"><strong>Outpass No:</strong> <span style="font-family: monospace; font-size: 15px; font-weight: bold; color: #1f4fb2;">${op.outpass_no}</span></p>
            <p style="margin: 3px 0;"><strong>Date:</strong> ${op.date}</p>
            <p style="margin: 3px 0;"><strong>Purpose:</strong> <span style="background: #e0e7ff; color: #3730a3; padding: 2px 7px; border-radius: 4px; font-weight: bold;">${op.purpose}</span></p>
            <p style="margin: 3px 0;"><strong>Reference:</strong> ${op.reference_type} (${op.reference_no || `#${op.reference_id || '-'}`})</p>
            <p style="margin: 3px 0;"><strong>Dispatch From:</strong> ${op.from_godown_name || op.from_location || 'PJ Main Godown'}</p>
          </div>
          <div>
            <p style="margin: 3px 0;"><strong>External Mill / Party:</strong> <strong style="color: #0f172a; font-size: 14px;">${op.party_name}</strong></p>
            ${op.mill_area ? `<p style="margin: 3px 0; color: #475569;"><strong>Mill Area / City:</strong> ${op.mill_area}</p>` : ''}
            <p style="margin: 3px 0;"><strong>Destination:</strong> ${op.destination || op.mill_area || '-'}</p>
            <p style="margin: 3px 0;"><strong>Vehicle No:</strong> <span style="font-family: monospace; font-weight: bold; background: #f1f5f9; padding: 1px 6px; border-radius: 3px;">${op.vehicle_no || 'N/A'}</span></p>
            <p style="margin: 3px 0;"><strong>Driver:</strong> ${op.driver_name || '-'} ${op.driver_phone ? `(${op.driver_phone})` : ''}</p>
            <p style="margin: 3px 0;"><strong>Transporter:</strong> ${op.transporter || 'Self / Direct'}</p>
          </div>
        </div>

        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 15px;">
          <thead>
            <tr style="background: #1f4fb2; color: #ffffff;">
              <th style="border: 1px solid #cbd5e1; padding: 8px; width: 40px; text-align: center;">S.No</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Item Description</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left; width: 110px;">Lot / Batch No</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 70px;">Bags</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 80px;">Unit Wt</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 100px;">Total Weight</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left; width: 80px;">Godown</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Process Reason</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="8" style="text-align: center; padding: 10px;">No items registered</td></tr>'}
          </tbody>
          <tfoot>
            <tr style="background: #f1f5f9; font-weight: bold;">
              <td colspan="3" style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">TOTAL DISPATCHED:</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-size: 13px;">${op.total_qty || 0} Bags</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px;"></td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #1f4fb2; font-size: 14px;">${(parseFloat(op.total_weight) || 0).toFixed(2)} kg</td>
              <td colspan="2" style="border: 1px solid #cbd5e1; padding: 8px;"></td>
            </tr>
          </tfoot>
        </table>

        ${parseFloat(op.processing_rate_kg) > 0 ? `
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px; margin-bottom: 15px; font-size: 12px; display: flex; justify-content: space-between;">
            <span><strong>Processing Rate Agreed:</strong> ₹${op.processing_rate_kg}/kg</span>
            <span><strong>Estimated Processing Charges:</strong> ₹${(parseFloat(op.estimated_charges) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        ` : ''}

        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 8px 12px; font-size: 11px; color: #1e40af; margin-bottom: 25px;">
          <strong>Custody Declaration:</strong> Material is dispatched exclusively for outside processing / jobwork. Physical ownership remains strictly with BVC Agro. Processed goods, by-products, and loss reconciliation are mandatory via corresponding Inpass.
        </div>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; text-align: center; font-size: 11px; margin-top: 35px;">
          <div style="border-top: 1px solid #64748b; padding-top: 5px;">Prepared By (${op.created_by || 'Admin'})</div>
          <div style="border-top: 1px solid #64748b; padding-top: 5px;">Factory In-Charge</div>
          <div style="border-top: 1px solid #64748b; padding-top: 5px;">Security Gate Out</div>
          <div style="border-top: 1px solid #64748b; padding-top: 5px;">Driver / Receiver Signature</div>
        </div>
      </div>
    `;

    printHtml(html, `Outpass - ${op.outpass_no}`);
  };

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
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, minWidth: '260px', maxWidth: '520px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Outpass No, Mill, Item, Lot, Vehicle..."
              style={{ width: '100%', padding: '7px 10px 7px 30px', border: '1px solid #7fa1d6', borderRadius: '4px', fontSize: '13px', backgroundColor: '#ffffff' }}
            />
            <SearchIcon style={{ position: 'absolute', left: '7px', top: '7px', fontSize: '18px', color: '#64748b' }} />
          </div>
          <button type="submit" className="action-btn update-btn" style={{ padding: '7px 14px' }}>
            Search
          </button>
        </form>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
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
            ) : outpasses.length === 0 ? (
              <tr>
                <td colSpan="12" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                  No Outpass records found. Click <strong>"+ Issue New Outpass"</strong> to create a dispatch.
                </td>
              </tr>
            ) : (
              outpasses.map((row, idx) => {
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
