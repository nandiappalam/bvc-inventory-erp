import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api.js';
import { printElement } from '../utils/printHelper';
import './WorkOrderSlipDisplay.css';

const WorkOrderSlipDisplay = () => {
  const navigate = useNavigate();
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [selectedSlipForPrint, setSelectedSlipForPrint] = useState(null);

  const fetchWorkOrders = async () => {
    setLoading(true);
    try {
      let url = '/work-orders';
      const params = [];
      if (statusFilter !== 'ALL') params.push(`status=${encodeURIComponent(statusFilter)}`);
      if (searchTerm) params.push(`search=${encodeURIComponent(searchTerm)}`);
      if (params.length > 0) url += `?${params.join('&')}`;

      const res = await api(url);
      if (res?.success) {
        setWorkOrders(res.data || []);
      }
    } catch (err) {
      console.error('Error fetching work orders:', err);
      setMessage('Error loading work orders: ' + err.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchWorkOrders();
  };

  const handleDelete = async (id, woNo) => {
    if (!window.confirm(`Are you sure you want to delete Work Order Slip "${woNo}"?`)) return;

    try {
      const res = await api(`/work-orders/${id}`, { method: 'DELETE' });
      if (res?.success) {
        setMessage(`Work Order Slip ${woNo} deleted successfully.`);
        setMessageType('success');
        fetchWorkOrders();
      }
    } catch (err) {
      setMessage('Error deleting: ' + err.message);
      setMessageType('error');
    }
  };

  const handlePrintSlip = async (id) => {
    try {
      const res = await api(`/work-orders/${id}`);
      if (res?.success && res.data) {
        setSelectedSlipForPrint(res.data);
      }
    } catch (err) {
      alert('Failed to load slip for printing: ' + err.message);
    }
  };

  const executePrint = () => {
    printElement('#printable-slip', `Work Order Slip - ${selectedSlipForPrint?.work_order_no || ''}`);
  };

  return (
    <div className="wo-display-container">
      {/* Header Bar */}
      <div className="wo-display-header">
        <div className="wo-display-title">
          <h2>Work Order Slips Register</h2>
          <span className="subtitle">Pre-Grind Production Orders & Rejection Tracking</span>
        </div>
        <div className="wo-display-actions">
          <Link to="/entry/work-order-slip-create" className="btn btn-primary">
            + New Work Order Slip
          </Link>
          <Link to="/entry/grind-create" className="btn btn-outline">
            Go to Grind Entry
          </Link>
        </div>
      </div>

      {message && <div className={`wo-alert ${messageType}`}>{message}</div>}

      {/* Filter and Search Bar */}
      <div className="wo-filter-card">
        <form onSubmit={handleSearchSubmit} className="wo-filter-form">
          <div className="filter-group">
            <label>Search:</label>
            <input
              type="text"
              placeholder="Search by Slip No, Product, Unit..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label>Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="ALL">All Statuses</option>
              <option value="ISSUED">ISSUED (Ready to Grind)</option>
              <option value="IN_PROCESS">IN_PROCESS</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          <button type="submit" className="btn btn-secondary">
            🔍 Filter
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => { setSearchTerm(''); setStatusFilter('ALL'); }}
          >
            Reset
          </button>
        </form>
      </div>

      {/* Work Orders Table */}
      <div className="wo-table-card">
        {loading ? (
          <div className="wo-loading">Loading Work Order Slips...</div>
        ) : workOrders.length === 0 ? (
          <div className="wo-empty-state">
            <div className="empty-icon">📋</div>
            <h4>No Work Order Slips Found</h4>
            <p>Create a Work Order Slip before raw material grinding to track expected outputs and wastage categories.</p>
            <Link to="/entry/work-order-slip-create" className="btn btn-primary mt-3">
              + Create First Slip
            </Link>
          </div>
        ) : (
          <table className="wo-list-table">
            <thead>
              <tr>
                <th>Slip No</th>
                <th>Date</th>
                <th>Work Unit</th>
                <th>Target Product</th>
                <th>Total Input</th>
                <th>Expected Output</th>
                <th>Wastage (Kg)</th>
                <th>Status</th>
                <th>Grind Ref</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {workOrders.map((wo) => {
                const totalWaste = (wo.rejection_wt || 0) + (wo.elevator_wt || 0) + (wo.waste_flour_wt || 0) + (wo.sieve_flour_wt || 0);
                return (
                  <tr key={wo.id} className={`status-row-${(wo.status || '').toLowerCase()}`}>
                    <td className="font-bold text-primary">{wo.work_order_no || `WO-${wo.id}`}</td>
                    <td>{wo.date}</td>
                    <td><span className="unit-tag">{wo.work_unit}</span></td>
                    <td className="font-semibold">{wo.product}</td>
                    <td>
                      <div className="qty-cell">
                        <span className="bold">{wo.total_input_qty || 0} Bags</span>
                        <span className="sub">{parseFloat(wo.total_input_kgs || 0).toFixed(1)} Kg</span>
                      </div>
                    </td>
                    <td>
                      <div className="qty-cell">
                        <span className="bold">{wo.expected_output_qty || wo.total_output_qty || 0} Bags</span>
                        {wo.actual_output_qty > 0 && (
                          <span className="sub text-success">Actual: {wo.actual_output_qty} Bags</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="waste-badge" title={`Rejection: ${wo.rejection_wt}kg, Elevator: ${wo.elevator_wt}kg, Waste Flour: ${wo.waste_flour_wt}kg, Sieve: ${wo.sieve_flour_wt}kg`}>
                        {totalWaste > 0 ? `${totalWaste.toFixed(1)} Kg` : '-'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge-status status-${(wo.status || 'issued').toLowerCase()}`}>
                        {wo.status || 'ISSUED'}
                      </span>
                    </td>
                    <td>
                      {wo.grind_id ? (
                        <Link to={`/entry/grind-create?id=${wo.grind_id}`} className="grind-link" title="Open Grind Record">
                          🔗 Grind #{wo.grind_id}
                        </Link>
                      ) : (
                        <span className="text-muted">Pending</span>
                      )}
                    </td>
                    <td>
                      <div className="action-buttons-group">
                        <button
                          type="button"
                          className="action-btn print-btn"
                          title="Print Factory Slip"
                          onClick={() => handlePrintSlip(wo.id)}
                        >
                          🖨️ Print
                        </button>

                        {wo.status !== 'COMPLETED' ? (
                          <button
                            type="button"
                            className="action-btn process-btn"
                            title="Process in Grind Creation"
                            onClick={() => navigate(`/entry/grind-create?work_order_id=${wo.id}`)}
                          >
                            ⚙️ Grind
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="action-btn view-btn"
                            title="Edit / View Details"
                            onClick={() => navigate(`/entry/work-order-slip-create?id=${wo.id}`)}
                          >
                            ✏️ Edit
                          </button>
                        )}

                        <button
                          type="button"
                          className="action-btn delete-btn"
                          title="Delete Slip"
                          onClick={() => handleDelete(wo.id, wo.work_order_no)}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Quick Print Modal */}
      {selectedSlipForPrint && (
        <div className="wo-modal-overlay">
          <div className="wo-modal-content">
            <div className="wo-modal-header no-print">
              <h3>Work Order Slip - {selectedSlipForPrint.work_order_no}</h3>
              <div className="wo-modal-actions">
                <button type="button" className="btn btn-primary" onClick={executePrint}>
                  🖨️ Print Slip
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setSelectedSlipForPrint(null)}>
                  Close
                </button>
              </div>
            </div>

            <div className="printable-slip-wrapper" id="printable-slip">
              <div className="slip-outer-box">
                <div className="slip-title-header">
                  <u>WORK ORDER SLIP</u>
                </div>

                <div className="slip-meta-row">
                  <div className="slip-meta-left">
                    <strong>Work Unit :</strong> <span className="underline-text">{selectedSlipForPrint.work_unit || '_________________'}</span>
                  </div>
                  <div className="slip-meta-right">
                    <strong>Date :</strong> <span className="underline-text">{selectedSlipForPrint.date || '____________'}</span>
                  </div>
                </div>

                <div className="slip-meta-row">
                  <div className="slip-meta-left">
                    <strong>Product :</strong> <span className="underline-text">{selectedSlipForPrint.product || '_________________'}</span>
                  </div>
                  <div className="slip-meta-right">
                    <strong>WO No :</strong> <span className="underline-text">{selectedSlipForPrint.work_order_no || '______'}</span>
                  </div>
                </div>

                {/* Section 1: Raw Material Input Details */}
                <div style={{ fontWeight: 'bold', fontSize: '13px', marginTop: '10px', marginBottom: '4px', textTransform: 'uppercase' }}>
                  1. RAW MATERIAL INPUT DETAILS
                </div>
                <table className="slip-print-table">
                  <thead>
                    <tr>
                      <th style={{ width: '18%' }}>LOT NO</th>
                      <th style={{ width: '25%' }}>SUPPLIER</th>
                      <th style={{ width: '25%' }}>ITEM</th>
                      <th style={{ width: '12%' }}>WT / BAG</th>
                      <th style={{ width: '10%' }}>INPUT QTY</th>
                      <th style={{ width: '10%' }}>TOTAL KG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {((selectedSlipForPrint.input_items && selectedSlipForPrint.input_items.length > 0)
                      ? selectedSlipForPrint.input_items
                      : (selectedSlipForPrint.items || [])).map((it, idx) => (
                      <tr key={idx} style={{ height: '30px' }}>
                        <td>{it.lot_no || '-'}</td>
                        <td>{it.supplier || '-'}</td>
                        <td>{it.item_name || '-'}</td>
                        <td>{it.weight ? `${it.weight} kg` : '-'}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{it.input_qty || it.qty || '-'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{it.kgs ? `${it.kgs} kg` : (it.total_wt ? `${it.total_wt} kg` : '-')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Section 2: Finished Goods (Output) Details */}
                <div style={{ fontWeight: 'bold', fontSize: '13px', marginTop: '12px', marginBottom: '4px', textTransform: 'uppercase' }}>
                  2. FINISHED GOODS (OUTPUT) EXPECTED DETAILS
                </div>
                <table className="slip-print-table">
                  <thead>
                    <tr>
                      <th style={{ width: '30%' }}>OUTPUT ITEM NAME</th>
                      <th style={{ width: '25%' }}>FG LOT NO</th>
                      <th style={{ width: '15%' }}>UNIT WT (KG)</th>
                      <th style={{ width: '15%' }}>EXPECTED QTY</th>
                      <th style={{ width: '15%' }}>TOTAL OUTPUT (KG)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedSlipForPrint.output_items && selectedSlipForPrint.output_items.length > 0) ? (
                      selectedSlipForPrint.output_items.map((o, idx) => (
                        <tr key={idx} style={{ height: '30px' }}>
                          <td>{o.output_item || o.item_name || selectedSlipForPrint.product || '-'}</td>
                          <td style={{ fontWeight: 'bold' }}>{o.fg_lot_no || '-'}</td>
                          <td>{o.weight ? `${o.weight} kg` : '-'}</td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{o.expected_qty || o.qty || '-'} Bags</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{o.output_kgs || o.total_wt ? `${o.output_kgs || o.total_wt} kg` : '-'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr style={{ height: '30px' }}>
                        <td>{selectedSlipForPrint.product || '-'}</td>
                        <td style={{ fontWeight: 'bold' }}>{selectedSlipForPrint.fg_lot_no || '-'}</td>
                        <td>-</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{selectedSlipForPrint.expected_output_qty || selectedSlipForPrint.total_output_qty || '-'} Bags</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{selectedSlipForPrint.expected_output_wt || selectedSlipForPrint.total_output_kgs || '-'} kg</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Section 3: Wastage & Rejections */}
                {(selectedSlipForPrint.wastage_items && selectedSlipForPrint.wastage_items.length > 0) && (
                  <>
                    <div style={{ fontWeight: 'bold', fontSize: '13px', marginTop: '12px', marginBottom: '4px', textTransform: 'uppercase' }}>
                      3. WASTAGE & REJECTION SPECIFICATIONS
                    </div>
                    <table className="slip-print-table">
                      <thead>
                        <tr>
                          <th style={{ width: '25%' }}>CATEGORY</th>
                          <th style={{ width: '30%' }}>WASTAGE ITEM NAME</th>
                          <th style={{ width: '15%' }}>LOT NO</th>
                          <th style={{ width: '15%' }}>QTY</th>
                          <th style={{ width: '15%' }}>TOTAL KG</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSlipForPrint.wastage_items.map((w, idx) => (
                          <tr key={idx} style={{ height: '28px' }}>
                            <td>{w.category || '-'}</td>
                            <td>{w.item_name || '-'}</td>
                            <td>{w.lot_no || '-'}</td>
                            <td style={{ textAlign: 'center' }}>{w.qty || '-'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{w.total_wt ? `${w.total_wt} kg` : '0 kg'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                {/* Bottom Rejection Box */}
                <div className="slip-print-wastage" style={{ marginTop: '12px', marginBottom: '12px' }}>
                  <div className="slip-wastage-item">
                    <span>Rejection :</span>
                    <span className="slip-fill-line">{selectedSlipForPrint.rejection_wt ? `${selectedSlipForPrint.rejection_wt} kg` : ''}</span>
                  </div>
                  <div className="slip-wastage-item">
                    <span>Elevator :</span>
                    <span className="slip-fill-line">{selectedSlipForPrint.elevator_wt ? `${selectedSlipForPrint.elevator_wt} kg` : ''}</span>
                  </div>
                  <div className="slip-wastage-item">
                    <span>Waste Flour :</span>
                    <span className="slip-fill-line">{selectedSlipForPrint.waste_flour_wt ? `${selectedSlipForPrint.waste_flour_wt} kg` : ''}</span>
                  </div>
                  <div className="slip-wastage-item">
                    <span>Sieve Flour :</span>
                    <span className="slip-fill-line">{selectedSlipForPrint.sieve_flour_wt ? `${selectedSlipForPrint.sieve_flour_wt} kg` : ''}</span>
                  </div>
                </div>

                {/* Signatures */}
                <div className="slip-signatures">
                  <div className="sig-block">
                    <div className="sig-line"></div>
                    <span>Issued By</span>
                  </div>
                  <div className="sig-block">
                    <div className="sig-line"></div>
                    <span>Mill Operator / Incharge</span>
                  </div>
                  <div className="sig-block">
                    <div className="sig-line"></div>
                    <span>Quality Inspector</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkOrderSlipDisplay;
