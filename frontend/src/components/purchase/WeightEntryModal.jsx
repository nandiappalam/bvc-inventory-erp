import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

/**
 * WeightEntryModal
 * Controlled weight-update pop-up for recording Tare Weight after unloading.
 * Calculates: Net Weight = Gross Weight - Tare Weight.
 * Prevents direct editing of invoice totals or supplier tax entries.
 */
const WeightEntryModal = ({
  isOpen,
  onClose,
  onSave,
  voucherNo = 'PUR-NEW',
  purchaseId = null,
  initialData = {}
}) => {
  const [data, setData] = useState({
    gross_weight: 0,
    tare_weight: 0,
    net_weight: 0,
    weighbridge_location: 'Main Factory',
    unloading_date: new Date().toISOString().slice(0, 10),
    unloading_time: new Date().toTimeString().slice(0, 5),
    weighment_ref_no: '',
    operator_name: '',
    remarks: ''
  });

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const gross = parseFloat(initialData.gross_weight || initialData.total_weight || 0);
    const tare = parseFloat(initialData.tare_weight || 0);
    const net = gross > 0 && tare > 0 ? gross - tare : parseFloat(initialData.net_weight || 0);

    setData({
      gross_weight: gross,
      tare_weight: tare,
      net_weight: net,
      weighbridge_location: initialData.weighbridge_location || 'Main Factory',
      unloading_date: initialData.unloading_date || new Date().toISOString().slice(0, 10),
      unloading_time: initialData.unloading_time || new Date().toTimeString().slice(0, 5),
      weighment_ref_no: initialData.weighment_ref_no || `WM-${Math.floor(100000 + Math.random() * 900000)}`,
      operator_name: initialData.operator_name || 'Weighbridge Operator',
      remarks: initialData.weight_remarks || ''
    });
    setErrorMsg('');
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const gross = parseFloat(data.gross_weight) || 0;
  const tare = parseFloat(data.tare_weight) || 0;
  const netWeight = gross > 0 && tare >= 0 ? Math.max(0, gross - tare) : 0;
  const weightStatus = tare > 0 ? 'COMPLETED' : 'TARE_PENDING';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setData(prev => ({ ...prev, [name]: value }));
  };

  const handleTareChange = (e) => {
    const val = e.target.value === '' ? '' : parseFloat(e.target.value) || 0;
    setData(prev => ({
      ...prev,
      tare_weight: val,
      net_weight: gross > 0 && val !== '' ? Math.max(0, gross - parseFloat(val) || 0) : 0
    }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (tare < 0) {
      setErrorMsg('Tare weight cannot be negative.');
      return;
    }
    if (tare > gross && gross > 0) {
      setErrorMsg('Tare weight cannot exceed Gross Weight.');
      return;
    }

    const payload = {
      ...data,
      gross_weight: gross,
      tare_weight: tare,
      net_weight: netWeight,
      weight_status: weightStatus
    };

    if (purchaseId) {
      try {
        setSaving(true);
        setErrorMsg('');
        const res = await fetch(`/api/purchases/${purchaseId}/weight-update`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Failed to update weight details');
        
        onSave(result.purchase || payload);
        onClose();
      } catch (err) {
        setErrorMsg(err.message);
      } finally {
        setSaving(false);
      }
    } else {
      onSave(payload);
      onClose();
    }
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
        padding: '16px',
        backdropFilter: 'blur(4px)'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          width: '760px',
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
        {/* Modal Header */}
        <div style={{ background: 'linear-gradient(135deg, #065f46 0%, #064e3b 50%, #0f172a 100%)', color: '#ffffff', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #047857' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
              ⚖️
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: '#ffffff' }}>Record Tare Weight (Post-Unloading)</h2>
                <span style={{ fontSize: '11px', padding: '2px 10px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.2)', color: '#a7f3d0', fontWeight: '700' }}>
                  {voucherNo}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#a7f3d0', margin: '3px 0 0 0' }}>
                Enter Tare weight recorded at factory weighbridge after vehicle unloading
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
        <form onSubmit={handleFormSubmit} style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px', backgroundColor: '#f8fafc' }}>
          {errorMsg && (
            <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: '8px', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section A: Weight Calculation Display Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
            {/* Gross Weight (Read-Only) */}
            <div style={{ backgroundColor: '#ffffff', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>
                  Gross Weight
                </span>
                <span style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>
                  {gross.toLocaleString('en-IN')} <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>kg</span>
                </span>
              </div>
              <span style={{ fontSize: '10px', color: '#94a3b8', marginTop: '8px', display: 'block' }}>
                🔒 Inward Gross Weight (Fixed)
              </span>
            </div>

            {/* Tare Weight (Editable) */}
            <div style={{ backgroundColor: '#ecfdf5', padding: '14px', borderRadius: '10px', border: '2px solid #34d399', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#064e3b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  Tare Weight (kg) *
                </label>
                <input
                  type="number"
                  name="tare_weight"
                  step="0.01"
                  min="0"
                  value={data.tare_weight}
                  onChange={handleTareChange}
                  placeholder="Enter Tare Weight"
                  autoFocus
                  style={{ width: '100%', height: '38px', padding: '6px 12px', border: '1px solid #10b981', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', color: '#064e3b', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
                />
              </div>
              <span style={{ fontSize: '10px', color: '#047857', marginTop: '6px', display: 'block', fontWeight: '500' }}>
                Recorded after unloading
              </span>
            </div>

            {/* Net Weight (Auto-calculated) */}
            <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #064e3b 100%)', color: '#ffffff', padding: '14px', borderRadius: '10px', boxShadow: '0 2px 6px rgba(0,0,0,0.15)', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#a7f3d0', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>
                  Calculated Net Weight
                </span>
                <span style={{ fontSize: '20px', fontWeight: '800', color: '#34d399' }}>
                  {netWeight > 0 ? netWeight.toLocaleString('en-IN') : '0'}{' '}
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#a7f3d0' }}>kg</span>
                </span>
              </div>
              <span style={{ fontSize: '10px', color: '#cbd5e1', marginTop: '8px', display: 'block' }}>
                Formula: Gross ({gross}) - Tare ({tare})
              </span>
            </div>
          </div>

          {/* Section B: Weighbridge & Audit Details */}
          <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Weighbridge & Inspection Audit Log
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Weighbridge / Location</label>
                <input
                  type="text"
                  name="weighbridge_location"
                  value={data.weighbridge_location}
                  onChange={handleChange}
                  placeholder="e.g. Main Factory Weighbridge"
                  style={{ width: '100%', height: '36px', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', color: '#0f172a', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Weighment Ref / Slip No.</label>
                <input
                  type="text"
                  name="weighment_ref_no"
                  value={data.weighment_ref_no}
                  onChange={handleChange}
                  placeholder="e.g. WM-88492"
                  style={{ width: '100%', height: '36px', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', color: '#0f172a', fontFamily: 'monospace', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Unloading Date</label>
                <input
                  type="date"
                  name="unloading_date"
                  value={data.unloading_date}
                  onChange={handleChange}
                  style={{ width: '100%', height: '36px', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', color: '#0f172a', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Unloading Time</label>
                <input
                  type="time"
                  name="unloading_time"
                  value={data.unloading_time}
                  onChange={handleChange}
                  style={{ width: '100%', height: '36px', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', color: '#0f172a', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Weighbridge Operator / Inspector</label>
                <input
                  type="text"
                  name="operator_name"
                  value={data.operator_name}
                  onChange={handleChange}
                  placeholder="Operator Name"
                  style={{ width: '100%', height: '36px', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', color: '#0f172a', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Weighment Status</label>
                <div style={{ paddingTop: '4px' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: '700',
                    border: '1px solid',
                    backgroundColor: weightStatus === 'COMPLETED' ? '#d1fae5' : '#fef3c7',
                    color: weightStatus === 'COMPLETED' ? '#065f46' : '#92400e',
                    borderColor: weightStatus === 'COMPLETED' ? '#6ee7b7' : '#fcd34d'
                  }}>
                    {weightStatus === 'COMPLETED' ? '✅ Weight Completed' : '⏳ Tare Pending'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Audit Remarks / Quality Notes</label>
              <textarea
                name="remarks"
                value={data.remarks}
                onChange={handleChange}
                rows={2}
                placeholder="Notes regarding weighment or quality..."
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', color: '#0f172a', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{ padding: '8px 16px', backgroundColor: '#e2e8f0', color: '#334155', fontWeight: 'bold', borderRadius: '6px', border: 'none', fontSize: '12px', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{ padding: '8px 20px', backgroundColor: '#047857', color: '#ffffff', fontWeight: 'bold', borderRadius: '6px', border: 'none', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', opacity: saving ? 0.7 : 1 }}
            >
              <span>{saving ? '⏳' : '💾'}</span>
              <span>{saving ? 'Saving...' : 'Save Tare Weight'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default WeightEntryModal;
