import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { getMasters } from '../../services/masterservice';

/**
 * TransportFreightDetailsModal
 * Interactive popup modal for managing transport freight, advance, mamool, weight cash, and additional charges.
 * 
 * Formula:
 * Total Deduction = Advance + Mamool + Other Deductions
 * Total Additional = Weight Cash + Other Additional Charges
 * Net Transport Amount = Freight Amount - Total Deduction + Total Additional
 */
const TransportFreightDetailsModal = ({
  isOpen,
  onClose,
  onSave,
  voucherNo = 'PUR-NEW',
  initialData = {}
}) => {
  const [transportersList, setTransportersList] = useState([]);
  const [data, setData] = useState({
    transporter: '',
    vehicle_no: '',
    driver_name: '',
    driver_mobile: '',
    transport_date: new Date().toISOString().slice(0, 10),
    freight_amount: 0,
    advance_amount: 0,
    mamool_amount: 0,
    weight_cash: 0,
    other_additional_charges: 0,
    other_deductions: 0,
    transport_payable_type: 'SEPARATE',
    remarks: ''
  });

  useEffect(() => {
    if (!isOpen) return;
    const loadTransporters = async () => {
      try {
        const res = await getMasters('transports');
        const list = Array.isArray(res?.data || res) ? (res?.data || res) : [];
        setTransportersList(list);
      } catch (err) {
        console.warn('Notice loading transporters list:', err.message);
      }
    };
    loadTransporters();

    setData({
      transporter: initialData.transporter || initialData.transport || '',
      vehicle_no: initialData.vehicle_no || initialData.lorry_no || '',
      driver_name: initialData.driver_name || initialData.driver || '',
      driver_mobile: initialData.driver_mobile || '',
      transport_date: initialData.transport_date || initialData.date || new Date().toISOString().slice(0, 10),
      freight_amount: parseFloat(initialData.freight_amount || initialData.transport_charges || 0),
      advance_amount: parseFloat(initialData.advance_amount || initialData.transport_advance || 0),
      mamool_amount: parseFloat(initialData.mamool_amount || 0),
      weight_cash: parseFloat(initialData.weight_cash || 0),
      other_additional_charges: parseFloat(initialData.other_additional_charges || 0),
      other_deductions: parseFloat(initialData.other_deductions || 0),
      transport_payable_type: initialData.transport_payable_type || 'SEPARATE',
      remarks: initialData.transport_remarks || initialData.remarks || ''
    });
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const freight = parseFloat(data.freight_amount) || 0;
  const advance = parseFloat(data.advance_amount) || 0;
  const mamool = parseFloat(data.mamool_amount) || 0;
  const otherDeductions = parseFloat(data.other_deductions) || 0;
  const weightCash = parseFloat(data.weight_cash) || 0;
  const otherAdditional = parseFloat(data.other_additional_charges) || 0;

  const totalDeduction = advance + mamool + otherDeductions;
  const totalAdditional = weightCash + otherAdditional;
  const netTransportAmount = Math.max(0, parseFloat((freight - totalDeduction + totalAdditional).toFixed(2)));

  const handleChange = (e) => {
    const { name, value } = e.target;
    setData(prev => ({ ...prev, [name]: value }));
  };

  const handleNumberChange = (e) => {
    const { name, value } = e.target;
    setData(prev => ({ ...prev, [name]: value === '' ? '' : parseFloat(value) || 0 }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    onSave({
      ...data,
      total_deduction: totalDeduction,
      total_additional: totalAdditional,
      net_transport_amount: netTransportAmount,
      transport_charges: freight,
      freight_amount: freight
    });
    onClose();
  };

  const modalContent = (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999999,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        backdropFilter: 'blur(4px)'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          width: '820px',
          maxWidth: '94vw',
          maxHeight: '90vh',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
          border: '1px solid #cbd5e1',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#0f172a'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1e1b4b 100%)', color: '#ffffff', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #334155' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
              🚚
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: '#ffffff' }}>Transport Freight Details</h2>
                <span style={{ fontSize: '11px', padding: '2px 10px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.2)', color: '#93c5fd', fontWeight: '700' }}>
                  {voucherNo}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#93c5fd', margin: '3px 0 0 0' }}>
                Manage freight amount, advance, mamool, weight cash & net payable
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            style={{ color: '#ffffff', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ✕
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSave} style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px', backgroundColor: '#f8fafc' }}>
          
          {/* Section A: Transport Information */}
          <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', marginBottom: '14px' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                A. Transport Information
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Transporter Name</label>
                <input
                  type="text"
                  name="transporter"
                  list="transporters-list"
                  value={data.transporter}
                  onChange={handleChange}
                  placeholder="Select or enter transporter name"
                  style={{ width: '100%', height: '36px', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', color: '#0f172a', boxSizing: 'border-box' }}
                />
                <datalist id="transporters-list">
                  {transportersList.map((t, idx) => (
                    <option key={idx} value={t.name || t.print_name || t.transporter} />
                  ))}
                </datalist>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Vehicle Number</label>
                <input
                  type="text"
                  name="vehicle_no"
                  value={data.vehicle_no}
                  onChange={handleChange}
                  placeholder="e.g. TN 58 AB 1234"
                  style={{ width: '100%', height: '36px', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', color: '#0f172a', textTransform: 'uppercase', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Driver Name</label>
                <input
                  type="text"
                  name="driver_name"
                  value={data.driver_name}
                  onChange={handleChange}
                  placeholder="Driver full name"
                  style={{ width: '100%', height: '36px', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', color: '#0f172a', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Driver Mobile Number</label>
                <input
                  type="text"
                  name="driver_mobile"
                  value={data.driver_mobile}
                  onChange={handleChange}
                  placeholder="10-digit mobile number"
                  style={{ width: '100%', height: '36px', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', color: '#0f172a', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Transport Date</label>
                <input
                  type="date"
                  name="transport_date"
                  value={data.transport_date}
                  onChange={handleChange}
                  style={{ width: '100%', height: '36px', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', color: '#0f172a', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Transport Settlement Option</label>
                <select
                  name="transport_payable_type"
                  value={data.transport_payable_type}
                  onChange={handleChange}
                  style={{ width: '100%', height: '36px', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', color: '#0f172a', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
                >
                  <option value="SEPARATE">Separately Payable to Transporter (Option B)</option>
                  <option value="SUPPLIER">Included in Supplier Bill (Option A)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section B: Freight Calculation */}
          <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', marginBottom: '14px' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                B. Freight Calculation
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{ backgroundColor: '#eff6ff', padding: '12px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '4px' }}>Freight Amount (₹)</label>
                <input
                  type="number"
                  name="freight_amount"
                  step="0.01"
                  min="0"
                  value={data.freight_amount}
                  onChange={handleNumberChange}
                  placeholder="0.00"
                  style={{ width: '100%', height: '36px', padding: '6px 12px', border: '1px solid #93c5fd', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', color: '#1e3a8a', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
                />
                <span style={{ fontSize: '11px', color: '#2563eb', marginTop: '4px', display: 'block' }}>Base agreed transport freight</span>
              </div>

              <div style={{ backgroundColor: '#fffbeb', padding: '12px', borderRadius: '8px', border: '1px solid #fde68a' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#78350f', marginBottom: '4px' }}>Advance Paid (₹)</label>
                <input
                  type="number"
                  name="advance_amount"
                  step="0.01"
                  min="0"
                  value={data.advance_amount}
                  onChange={handleNumberChange}
                  placeholder="0.00"
                  style={{ width: '100%', height: '36px', padding: '6px 12px', border: '1px solid #fcd34d', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', color: '#78350f', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
                />
                <span style={{ fontSize: '11px', color: '#b45309', marginTop: '4px', display: 'block' }}>Deducted from final transport bill</span>
              </div>

              <div style={{ backgroundColor: '#fffbeb', padding: '12px', borderRadius: '8px', border: '1px solid #fde68a' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#78350f', marginBottom: '4px' }}>Mamool Amount (₹)</label>
                <input
                  type="number"
                  name="mamool_amount"
                  step="0.01"
                  min="0"
                  value={data.mamool_amount}
                  onChange={handleNumberChange}
                  placeholder="0.00"
                  style={{ width: '100%', height: '36px', padding: '6px 12px', border: '1px solid #fcd34d', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', color: '#78350f', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
                />
                <span style={{ fontSize: '11px', color: '#b45309', marginTop: '4px', display: 'block' }}>Driver mamool deducted from freight</span>
              </div>

              <div style={{ backgroundColor: '#ecfdf5', padding: '12px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#064e3b', marginBottom: '4px' }}>Weight Cash Amount (₹)</label>
                <input
                  type="number"
                  name="weight_cash"
                  step="0.01"
                  min="0"
                  value={data.weight_cash}
                  onChange={handleNumberChange}
                  placeholder="0.00"
                  style={{ width: '100%', height: '36px', padding: '6px 12px', border: '1px solid #6ee7b7', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', color: '#064e3b', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
                />
                <span style={{ fontSize: '11px', color: '#047857', marginTop: '4px', display: 'block' }}>➕ Added to net transport amount</span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Other Additional Charges (₹)</label>
                <input
                  type="number"
                  name="other_additional_charges"
                  step="0.01"
                  min="0"
                  value={data.other_additional_charges}
                  onChange={handleNumberChange}
                  placeholder="0.00"
                  style={{ width: '100%', height: '36px', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', color: '#0f172a', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Other Deductions (₹)</label>
                <input
                  type="number"
                  name="other_deductions"
                  step="0.01"
                  min="0"
                  value={data.other_deductions}
                  onChange={handleNumberChange}
                  placeholder="0.00"
                  style={{ width: '100%', height: '36px', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', color: '#0f172a', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ marginTop: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Remarks / Narration</label>
              <textarea
                name="remarks"
                value={data.remarks}
                onChange={handleChange}
                rows={2}
                placeholder="Transport remarks or trip notes..."
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', color: '#0f172a', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Section C: Formula Breakdown Card */}
          <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', color: '#ffffff', padding: '16px', borderRadius: '10px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', pb: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Formula & Net Transport Summary
              </span>
              <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', backgroundColor: 'rgba(59,130,246,0.2)', color: '#bfdbfe', borderRadius: '4px', border: '1px solid rgba(59,130,246,0.3)' }}>
                Net = Freight - Advance - Mamool + Weight Cash
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div style={{ backgroundColor: 'rgba(255,255,255,0.06)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ color: '#94a3b8', display: 'block', fontSize: '11px' }}>Freight Amount:</span>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#ffffff' }}>₹{freight.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div style={{ backgroundColor: 'rgba(255,255,255,0.06)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ color: '#fcd34d', display: 'block', fontSize: '11px' }}>Total Deductions (-):</span>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#fcd34d' }}>-₹{totalDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                <span style={{ fontSize: '10px', color: '#fef3c7', display: 'block', marginTop: '2px' }}>Adv ₹{advance} + Mamool ₹{mamool} + Ded ₹{otherDeductions}</span>
              </div>

              <div style={{ backgroundColor: 'rgba(255,255,255,0.06)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ color: '#6ee7b7', display: 'block', fontSize: '11px' }}>Total Additional (+):</span>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#6ee7b7' }}>+₹{totalAdditional.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                <span style={{ fontSize: '10px', color: '#d1fae5', display: 'block', marginTop: '2px' }}>Weight Cash ₹{weightCash} + Addl ₹{otherAdditional}</span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '12px', color: '#bfdbfe', fontWeight: '600', display: 'block' }}>Net Transport Amount Payable:</span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  Calculated: ₹{freight.toLocaleString('en-IN')} - ₹{totalDeduction.toLocaleString('en-IN')} + ₹{totalAdditional.toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '22px', fontWeight: '800', color: '#4ade80' }}>
                  ₹{netTransportAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '8px 16px', backgroundColor: '#e2e8f0', color: '#334155', fontWeight: 'bold', borderRadius: '6px', border: 'none', fontSize: '12px', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ padding: '8px 20px', backgroundColor: '#1d4ed8', color: '#ffffff', fontWeight: 'bold', borderRadius: '6px', border: 'none', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
            >
              <span>💾</span>
              <span>Save Transport Details</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default TransportFreightDetailsModal;
