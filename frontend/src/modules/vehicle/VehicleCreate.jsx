import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SmartField from '../../components/master/SmartField';
import { safeArray } from '../../utils/safeArray.js';
import './VehicleCreate.css';

const VehicleCreate = () => {
  const navigate = useNavigate();

  const queryParams = new URLSearchParams(window.location.search);
  const movementId = queryParams.get('id');

  const [formData, setFormData] = useState({
    id: '',
    reference_type: '',
    reference_id: '',
    vehicle_no: '',
    driver_name: '',
    transporter_id: '',
    status: 'IN',
    gross_weight: '',
    tare_weight: '',
    net_weight: '',
    gate_in_time: '',
    gate_out_time: '',
    item_name: '',
    qty: '',
    weight: '',
    party_name: '',
    movement_type: 'INWARD',
    operation_type: 'UNLOAD',
    lot_no: '',
    analyzing_team: '',
    analyzing_area: ''
  });

  const [refOptions, setRefOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  // Load existing record if editing or prefill from query params
  useEffect(() => {
    if (movementId) {
      const fetchMovement = async () => {
        try {
          const res = await fetch(`/api/vehicle-movements/${movementId}`);
          const data = await res.json();
          if (data) {
            setFormData({
              id: data.id || '',
              reference_type: data.reference_type || '',
              reference_id: data.reference_id || '',
              vehicle_no: data.vehicle_no || '',
              driver_name: data.driver_name || '',
              transporter_id: data.transporter_id || '',
              status: data.status || 'IN',
              gross_weight: data.gross_weight !== null ? data.gross_weight : '',
              tare_weight: data.tare_weight !== null ? data.tare_weight : '',
              net_weight: data.net_weight !== null ? data.net_weight : '',
              gate_in_time: data.gate_in_time ? data.gate_in_time.substring(0, 16) : '',
              gate_out_time: data.gate_out_time ? data.gate_out_time.substring(0, 16) : '',
              item_name: data.item_name || '',
              qty: data.qty !== null ? data.qty : '',
              weight: data.weight !== null ? data.weight : '',
              party_name: data.party_name || '',
              movement_type: data.movement_type || 'INWARD',
              operation_type: data.operation_type || 'UNLOAD',
              lot_no: data.lot_no || '',
              analyzing_team: data.analyzing_team || '',
              analyzing_area: data.analyzing_area || ''
            });
          }
        } catch (err) {
          console.error('Fetch movement failed:', err);
        }
      };
      fetchMovement();
    } else {
      // Create mode: set gate_in_time to now
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      const purchaseId = queryParams.get('purchaseId');
      const lotNo = queryParams.get('lotNo');
      setFormData(prev => ({
        ...prev,
        gate_in_time: now.toISOString().substring(0, 16),
        status: 'IN',
        reference_type: purchaseId ? 'PURCHASE' : '',
        reference_id: purchaseId || '',
        lot_no: lotNo || ''
      }));
    }
  }, [movementId]);

  // Load reference options when reference_type changes
  useEffect(() => {
    if (!formData.reference_type) {
      setRefOptions([]);
      return;
    }
    const fetchRefOptions = async () => {
      try {
        const res = await fetch(`/api/vehicle-movements/reference-options/${formData.reference_type}`);
        const data = await res.json();
        const options = safeArray(data);
        setRefOptions(options);

        // If we are in CREATE mode and have prefilled reference_id, let's select and populate its details!
        if (!movementId && formData.reference_id) {
          const targetLotNo = String(formData.lot_no || '').toUpperCase().trim();
          let selectedOpt = null;
          if (targetLotNo) {
            selectedOpt = options.find(opt => 
              (String(opt.id) === String(formData.reference_id) || String(opt.reference_id) === String(formData.reference_id)) &&
              String(opt.lot_no || '').toUpperCase().trim() === targetLotNo
            );
          }
          if (!selectedOpt) {
            selectedOpt = options.find(opt => String(opt.id) === String(formData.reference_id) || String(opt.reference_id) === String(formData.reference_id));
          }

          if (selectedOpt) {
            setFormData(prev => ({
              ...prev,
              reference_id: selectedOpt.reference_id || selectedOpt.id,
              party_name: selectedOpt.party_name || '',
              item_name: selectedOpt.item_name || '',
              qty: selectedOpt.qty !== undefined && selectedOpt.qty !== null ? selectedOpt.qty : '',
              weight: selectedOpt.weight !== undefined && selectedOpt.weight !== null ? selectedOpt.weight : '',
              lot_no: prev.lot_no || selectedOpt.lot_no || ''
            }));
          }
        }
      } catch (err) {
        console.error('Fetch ref options failed:', err);
      }
    };
    fetchRefOptions();
  }, [formData.reference_type]);

  // Auto-track status and details lot-wise / purchase-wise
  useEffect(() => {
    if (!formData.reference_type || !formData.reference_id) return;
    
    const trackStatus = async () => {
      try {
        const qp = new URLSearchParams({
          reference_type: formData.reference_type,
          reference_id: formData.reference_id,
          lot_no: formData.lot_no || ''
        });
        const res = await fetch(`/api/vehicle-movements/track-status?${qp.toString()}`);
        const data = await res.json();
        if (data && data.success) {
          setFormData(prev => {
            let finalStatus = data.status || prev.status;
            
            // Check if both weights are non-zero, auto transition to OUT
            const gross = parseFloat(prev.gross_weight) || 0;
            const tare = parseFloat(prev.tare_weight) || 0;
            if (gross > 0 && tare > 0) {
              finalStatus = 'OUT';
            }
            
            return {
              ...prev,
              status: finalStatus,
              party_name: data.details?.party_name || prev.party_name,
              item_name: data.details?.item_name || prev.item_name,
              qty: data.details?.qty !== undefined && data.details?.qty !== 0 ? data.details?.qty : prev.qty,
              weight: data.details?.weight !== undefined && data.details?.weight !== 0 ? data.details?.weight : prev.weight,
              lot_no: data.details?.lot_no || prev.lot_no
            };
          });
        }
      } catch (err) {
        console.error('Error tracking status automatically:', err);
      }
    };
    
    const timer = setTimeout(trackStatus, 500);
    return () => clearTimeout(timer);
  }, [formData.reference_type, formData.reference_id, formData.lot_no]);

  // Calculate Net Weight and automatically mark OUT if gross & tare weights are set
  useEffect(() => {
    const gross = parseFloat(formData.gross_weight) || 0;
    const tare = parseFloat(formData.tare_weight) || 0;
    const net = Math.max(0, gross - tare);
    if (parseFloat(formData.net_weight) !== net) {
      setFormData(prev => ({ ...prev, net_weight: net }));
    }
    
    if (gross > 0 && tare > 0 && formData.status !== 'OUT') {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      setFormData(prev => ({
        ...prev,
        status: 'OUT',
        gate_out_time: prev.gate_out_time || now.toISOString().substring(0, 16)
      }));
    }
  }, [formData.gross_weight, formData.tare_weight]);

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRefIdChange = (value) => {
    if (!value) {
      setFormData(prev => ({
        ...prev,
        reference_id: '',
        party_name: '',
        item_name: '',
        qty: '',
        weight: '',
        lot_no: ''
      }));
      return;
    }
    const [refId, itemName] = value.split('||');
    const selectedOpt = refOptions.find(opt => String(opt.reference_id) === String(refId) && (!itemName || opt.item_name === itemName));
    if (selectedOpt) {
      setFormData(prev => ({
        ...prev,
        reference_id: refId,
        party_name: selectedOpt.party_name || '',
        item_name: selectedOpt.item_name || '',
        qty: selectedOpt.qty !== undefined && selectedOpt.qty !== null ? selectedOpt.qty : '',
        weight: selectedOpt.weight !== undefined && selectedOpt.weight !== null ? selectedOpt.weight : '',
        lot_no: selectedOpt.lot_no || ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        reference_id: refId
      }));
    }
  };

  const getReferenceLabel = () => {
    switch (formData.reference_type) {
      case 'PURCHASE': return 'Purchase Invoice No';
      case 'SALES': return 'Sales Bill No';
      case 'PURCHASE_RETURN': return 'Purchase Return No';
      case 'SALES_RETURN': return 'Sales Return No';
      default: return 'Reference ID';
    }
  };

  const handleRefresh = async () => {
    if (movementId) {
      setLoading(true);
      try {
        const res = await fetch(`/api/vehicle-movements/${movementId}`);
        const data = await res.json();
        if (data) {
          setFormData(prev => ({
            ...prev,
            ...data,
            gate_in_time: data.gate_in_time ? data.gate_in_time.substring(0, 16) : '',
            gate_out_time: data.gate_out_time ? data.gate_out_time.substring(0, 16) : ''
          }));
        }
      } catch (err) {
        console.error('Refresh failed:', err);
      } finally {
        setLoading(false);
      }
    } else {
      // Reload reference options
      if (formData.reference_type) {
        try {
          const res = await fetch(`/api/vehicle-movements/reference-options/${formData.reference_type}`);
          const data = await res.json();
          setRefOptions(safeArray(data));
        } catch (err) {
          console.error('Refresh ref options failed:', err);
        }
      }
    }
  };

  const validate = () => {
    if (!formData.vehicle_no?.trim()) {
      setMessage('Vehicle No is required');
      setMessageType('error');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setMessage('');

    const url = movementId ? `/api/vehicle-movements/${movementId}` : '/api/vehicle-movements';
    const method = movementId ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (result.success) {
        setMessage(movementId ? 'Vehicle Movement updated successfully! Redirecting...' : 'Vehicle Movement saved successfully! Redirecting...');
        setMessageType('success');
        setTimeout(() => {
          navigate('/entry/vehicle-movement-display');
        }, 1500);
      } else {
        setMessage('Error: ' + (result.message || 'Unknown error'));
        setMessageType('error');
      }
    } catch (error) {
      console.error('Save error:', error);
      setMessage('Error saving vehicle movement');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate(-1);
  };

  return (
    <div className="vehicle-create-page">
      {/* Header */}
      <div className="vehicle-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button className="btn-nav" onClick={() => navigate(-1)} style={{ background: '#f1f5f9', color: '#1e293b' }}>
            ← Back
          </button>
          <h2>{movementId ? 'Edit Vehicle Movement' : 'Vehicle Movement Creation'}</h2>
        </div>
        <div className="vehicle-nav">
          <button className="btn-nav" onClick={() => navigate('/entry/vehicle-movement-display')}>
            Go To Vehicle Movement List
          </button>
          <button className="btn-nav" onClick={handleRefresh} style={{ background: '#e2e8f0', color: '#334155' }}>
            Refresh ↻
          </button>
        </div>
      </div>

      {message && <div className={`message ${messageType}`}>{message}</div>}

      <form onSubmit={handleSubmit} className="vehicle-form-container">
        {/* Left Panel - Vehicle Details */}
        <div className="vehicle-left-panel">
          <div className="panel-title">Vehicle Details</div>
          <div className="section-fields">
            {/* Reference Type selection */}
            <div className="field-group">
              <label className="field-label">Reference Type</label>
              <select
                className="uniform-input"
                value={formData.reference_type}
                onChange={(e) => handleChange('reference_type', e.target.value)}
              >
                <option value="">Select Reference Type</option>
                <option value="PURCHASE">Purchase</option>
                <option value="SALES">Sales</option>
                <option value="PURCHASE_RETURN">Purchase Return</option>
                <option value="SALES_RETURN">Sales Return</option>
              </select>
            </div>

            {/* Reference ID linked select or textbox */}
            {formData.reference_type ? (
              <div className="field-group">
                <label className="field-label">{getReferenceLabel()}</label>
                <select
                  className="uniform-input"
                  value={formData.reference_id ? `${formData.reference_id}||${formData.item_name}` : ""}
                  onChange={(e) => handleRefIdChange(e.target.value)}
                >
                  <option value="">Select Reference</option>
                  {refOptions.map((opt, idx) => (
                    <option key={opt.id ? `${opt.id}-${idx}` : idx} value={`${opt.reference_id}||${opt.item_name}`}>
                      #{opt.reference_id} ({opt.party_name} - {opt.item_name || 'No Item'})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="field-group">
                <label className="field-label">Reference ID</label>
                <input
                  type="text"
                  className="uniform-input"
                  disabled
                  placeholder="Select Reference Type first"
                />
              </div>
            )}

            {/* Vehicle No */}
            <div className="field-group">
              <label className="field-label">Vehicle No *</label>
              <input
                type="text"
                className="uniform-input"
                required
                value={formData.vehicle_no}
                onChange={(e) => handleChange('vehicle_no', e.target.value)}
                placeholder="Enter vehicle no"
              />
            </div>

            {/* Driver Name */}
            <div className="field-group">
              <label className="field-label">Driver Name</label>
              <input
                type="text"
                className="uniform-input"
                value={formData.driver_name}
                onChange={(e) => handleChange('driver_name', e.target.value)}
                placeholder="Enter driver name"
              />
            </div>

            {/* Transporter */}
            <SmartField
              field={{ name: 'transporter_id', label: 'Transporter', type: 'masterSelect', masterType: 'transports' }}
              value={formData.transporter_id}
              onChange={handleChange}
            />

            {/* Movement and Operation Types */}
            <div className="field-group">
              <label className="field-label">Movement Type</label>
              <select
                className="uniform-input"
                value={formData.movement_type}
                onChange={(e) => handleChange('movement_type', e.target.value)}
              >
                <option value="INWARD">INWARD</option>
                <option value="OUTWARD">OUTWARD</option>
              </select>
            </div>

            <div className="field-group">
              <label className="field-label">Operation Type</label>
              <select
                className="uniform-input"
                value={formData.operation_type}
                onChange={(e) => handleChange('operation_type', e.target.value)}
              >
                <option value="UNLOAD">UNLOAD</option>
                <option value="LOAD">LOAD</option>
              </select>
            </div>
          </div>

          {/* Auto-filled details */}
          <div className="vehicle-details-section" style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
            <div className="panel-title" style={{ fontSize: '15px', color: '#475569', marginBottom: '10px' }}>
              Reference Details
            </div>
            <div className="section-fields">
              <div className="field-group">
                <label className="field-label">Party Name</label>
                <input
                  type="text"
                  className="uniform-input"
                  value={formData.party_name}
                  onChange={(e) => handleChange('party_name', e.target.value)}
                  placeholder="Enter party name"
                />
              </div>
              <div className="field-group">
                <label className="field-label">Item Name</label>
                <input
                  type="text"
                  className="uniform-input"
                  value={formData.item_name}
                  onChange={(e) => handleChange('item_name', e.target.value)}
                  placeholder="Enter item name"
                />
              </div>
              <div className="field-group">
                <label className="field-label">Qty</label>
                <input
                  type="number"
                  step="any"
                  className="uniform-input"
                  value={formData.qty}
                  onChange={(e) => handleChange('qty', e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="field-group">
                <label className="field-label">Weight</label>
                <input
                  type="number"
                  step="any"
                  className="uniform-input"
                  value={formData.weight}
                  onChange={(e) => handleChange('weight', e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="field-group">
                <label className="field-label">Lot No Wise Tracking</label>
                <input
                  type="text"
                  className="uniform-input"
                  value={formData.lot_no}
                  onChange={(e) => handleChange('lot_no', e.target.value)}
                  placeholder="Enter or select lot no"
                />
              </div>
              <div className="field-group">
                <label className="field-label">Analyzing Team</label>
                <input
                  type="text"
                  className="uniform-input"
                  value={formData.analyzing_team}
                  onChange={(e) => handleChange('analyzing_team', e.target.value)}
                  placeholder="e.g. QC Team, Lab Team A"
                />
              </div>
              <div className="field-group">
                <label className="field-label">Analyzing Area</label>
                <input
                  type="text"
                  className="uniform-input"
                  value={formData.analyzing_area}
                  onChange={(e) => handleChange('analyzing_area', e.target.value)}
                  placeholder="e.g. Main Silo, Storage A"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Weights, Times & Process Flow */}
        <div className="vehicle-right-panel">
          <div className="panel-title">Weights & Times</div>
          <div className="section-fields">
            {/* Gross, Tare, Net */}
            <div className="field-group">
              <label className="field-label">Gross Weight</label>
              <input
                type="number"
                step="any"
                className="uniform-input"
                value={formData.gross_weight}
                onChange={(e) => handleChange('gross_weight', e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="field-group">
              <label className="field-label">Tare Weight</label>
              <input
                type="number"
                step="any"
                className="uniform-input"
                value={formData.tare_weight}
                onChange={(e) => handleChange('tare_weight', e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="field-group">
              <label className="field-label">Net Weight</label>
              <input
                type="number"
                step="any"
                className="uniform-input readonly-field"
                style={{ background: '#f8fafc', fontWeight: 'bold' }}
                value={formData.net_weight}
                readOnly
                placeholder="0.00"
              />
            </div>

            {/* Times */}
            <div className="field-group">
              <label className="field-label">Gate In Time</label>
              <input
                type="datetime-local"
                className="uniform-input"
                value={formData.gate_in_time}
                onChange={(e) => handleChange('gate_in_time', e.target.value)}
              />
            </div>

            <div className="field-group">
              <label className="field-label">Gate Out Time</label>
              <input
                type="datetime-local"
                className="uniform-input"
                value={formData.gate_out_time}
                onChange={(e) => handleChange('gate_out_time', e.target.value)}
              />
            </div>
          </div>

          {/* Process Flow Panel */}
          <div className="process-flow-section" style={{ marginTop: '25px', borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
            <div className="panel-title" style={{ fontSize: '15px', color: '#475569', marginBottom: '10px' }}>
              Process & Status Workflow
            </div>
            <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '14px', marginBottom: '12px' }}>
                Current Status: <span style={{ fontWeight: 'bold', color: '#2563eb', background: '#dbeafe', padding: '3px 8px', borderRadius: '4px' }}>{formData.status || 'IN'}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {formData.status === 'IN' && (
                  <button
                    type="button"
                    style={{ background: '#2563eb', color: '#fff', padding: '10px', borderRadius: '4px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
                    onClick={() => handleChange('status', formData.operation_type === 'LOAD' ? 'LOAD' : 'UNLOAD')}
                  >
                    {formData.operation_type === 'LOAD' ? 'QC Pass & Load Approval (→ LOAD)' : 'QC Pass & Unload Approval (→ UNLOAD)'}
                  </button>
                )}

                {(formData.status === 'UNLOAD' || formData.status === 'LOAD') && (
                  <button
                    type="button"
                    style={{ background: '#d97706', color: '#fff', padding: '10px', borderRadius: '4px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
                    onClick={() => handleChange('status', formData.status === 'LOAD' ? 'LOADED' : 'UNLOADED')}
                  >
                    {formData.status === 'LOAD' ? 'Confirm Production Loaded (→ LOADED)' : 'Confirm Production Unloaded (→ UNLOADED)'}
                  </button>
                )}

                {(formData.status === 'UNLOADED' || formData.status === 'LOADED') && (
                  <button
                    type="button"
                    style={{ background: '#16a34a', color: '#fff', padding: '10px', borderRadius: '4px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
                    onClick={() => {
                      const now = new Date();
                      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                      setFormData(prev => ({
                        ...prev,
                        status: 'OUT',
                        gate_out_time: now.toISOString().substring(0, 16)
                      }));
                    }}
                  >
                    Issue Gate Outpass / Exit (→ OUT)
                  </button>
                )}

                {formData.status === 'OUT' && (
                  <div style={{ background: '#dcfce7', color: '#15803d', fontWeight: 'bold', padding: '10px', borderRadius: '4px', textAlign: 'center', border: '1px solid #bbf7d0' }}>
                    ✓ Vehicle Out & Gate Pass Issued
                  </div>
                )}

                {formData.status !== 'OUT' && (
                  <button
                    type="button"
                    style={{ background: '#dc2626', color: '#fff', padding: '10px', borderRadius: '4px', fontWeight: 'bold', border: 'none', cursor: 'pointer', marginTop: '5px' }}
                    onClick={async () => {
                      if (window.confirm('Mark this vehicle movement as REJECTED / RETURNED (ICR Not Accepted) and navigate to Purchase Return?')) {
                        setLoading(true);
                        const url = movementId ? `/api/vehicle-movements/${movementId}` : '/api/vehicle-movements';
                        const method = movementId ? 'PUT' : 'POST';
                        const finalFormData = { ...formData, status: 'RETURNED' };
                        
                        try {
                          const response = await fetch(url, {
                            method,
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(finalFormData)
                          });
                          const result = await response.json();
                          if (result.success) {
                            const qp = new URLSearchParams({
                              partyName: formData.party_name || '',
                              itemName: formData.item_name || '',
                              qty: formData.qty || '',
                              weight: formData.weight || '',
                              lotNo: formData.lot_no || '',
                              referenceId: formData.reference_id || ''
                            });
                            navigate(`/entry/purchase-return-create?${qp.toString()}`);
                          } else {
                            alert('Error: ' + (result.message || 'Unknown error'));
                          }
                        } catch (err) {
                          console.error('Error auto saving return:', err);
                          alert('Error saving return: ' + err.message);
                        } finally {
                          setLoading(false);
                        }
                      }
                    }}
                  >
                    Reject & Return (ICR Not Accepted)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="vehicle-footer-actions">
          <button type="button" className="btn-cancel" onClick={handleCancel}>
            Cancel
          </button>
          <button type="submit" className="btn-save" disabled={loading}>
            {loading ? 'Saving...' : (movementId ? 'Update Vehicle Movement' : 'Save Vehicle Movement')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default VehicleCreate;
