import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { createTax, updateTax, getTaxById, TAX_CLASSIFICATIONS, round2 } from '../../services/taxService';
import MasterFormLayout from '../master/MasterFormLayout';
import '../master/master.css';

const TaxMasterCreate = () => {
  const navigate = useNavigate();
  const { id: paramId } = useParams();
  const [searchParams] = useSearchParams();
  const id = paramId || searchParams.get('edit');
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    tax_name: '',
    hsn_code: '',
    tax_type: 'Taxable',
    description: '',
    gst_rate: 5,
    cess_rate: 0,
    calc_type: 'Exclusive',
    status: 'Active',
    remarks: ''
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  useEffect(() => {
    if (id) {
      loadTaxConfig();
    }
  }, [id]);

  const loadTaxConfig = async () => {
    try {
      setLoading(true);
      const res = await getTaxById(id);
      if (res?.success && res.data) {
        setFormData({
          tax_name: res.data.tax_name || '',
          hsn_code: res.data.hsn_code || '',
          tax_type: res.data.tax_type || 'Taxable',
          description: res.data.description || '',
          gst_rate: res.data.gst_rate !== undefined ? res.data.gst_rate : 5,
          cess_rate: res.data.cess_rate || 0,
          calc_type: res.data.calc_type || 'Exclusive',
          status: res.data.status || 'Active',
          remarks: res.data.remarks || ''
        });
      }
    } catch (err) {
      setMessage('Failed to load tax configuration: ' + err.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (name, value) => {
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'tax_type' && value !== 'Taxable') {
        next.gst_rate = 0;
        next.cess_rate = 0;
      }
      return next;
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    handleChange(name, value);
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setMessage('');

    if (!formData.tax_name.trim() || !formData.hsn_code.trim()) {
      setMessage('Tax / Commodity Name and HSN Code are required.');
      setMessageType('error');
      return;
    }

    try {
      setSaving(true);
      if (isEdit) {
        await updateTax(id, formData);
        setMessage('Tax configuration updated successfully!');
        setMessageType('success');
      } else {
        await createTax(formData);
        setMessage('Tax configuration saved successfully!');
        setMessageType('success');
        setFormData({
          tax_name: '',
          hsn_code: '',
          tax_type: 'Taxable',
          description: '',
          gst_rate: 5,
          cess_rate: 0,
          calc_type: 'Exclusive',
          status: 'Active',
          remarks: ''
        });
      }
      setTimeout(() => {
        navigate('/master/tax-display');
      }, 1000);
    } catch (err) {
      setMessage(err.message || 'Failed to save tax configuration.');
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/master/tax-display');
  };

  const gstRateNum = parseFloat(formData.gst_rate) || 0;
  const cgstRate = round2(gstRateNum / 2);
  const sgstRate = round2(gstRateNum / 2);
  const igstRate = gstRateNum;

  return (
    <MasterFormLayout
      title={isEdit ? 'TAX MASTER EDIT' : 'TAX MASTER CREATION'}
      onSave={handleSubmit}
      onCancel={handleCancel}
      saving={saving}
      onBack={() => navigate('/master/tax-display')}
      onRefresh={() => {
        if (id) loadTaxConfig();
        else {
          setFormData({
            tax_name: '',
            hsn_code: '',
            tax_type: 'Taxable',
            description: '',
            gst_rate: 5,
            cess_rate: 0,
            calc_type: 'Exclusive',
            status: 'Active',
            remarks: ''
          });
          setMessage('');
        }
      }}
    >
      {message && (
        <div className={`full-span message ${messageType}`} style={{
          padding: '8px 12px',
          marginBottom: '12px',
          borderRadius: '4px',
          fontSize: '13px',
          fontWeight: '500',
          backgroundColor: messageType === 'error' ? '#fee2e2' : '#dcfce7',
          color: messageType === 'error' ? '#991b1b' : '#166534',
          border: `1px solid ${messageType === 'error' ? '#f87171' : '#86efac'}`
        }}>
          {message}
        </div>
      )}

      {/* Section 1: Basic Information */}
      <div className="form-section full-span">
        <div className="section-title">Tax & GST Basic Details</div>
        <div className="master-grid" style={{ gap: '12px 16px' }}>
          <div className="field-group">
            <label className="field-label">Tax / Commodity Name *</label>
            <input
              type="text"
              name="tax_name"
              value={formData.tax_name}
              onChange={handleInputChange}
              placeholder="e.g. Urad Dal (5% Pre-packaged), Papad (Nil Rated)"
              className="uniform-input"
              required
            />
          </div>

          <div className="field-group">
            <label className="field-label">HSN / SAC Code *</label>
            <input
              type="text"
              name="hsn_code"
              value={formData.hsn_code}
              onChange={handleInputChange}
              placeholder="e.g. 0713, 1101, 1106, 1905"
              className="uniform-input"
              required
            />
          </div>

          <div className="field-group">
            <label className="field-label">Tax Classification *</label>
            <select
              name="tax_type"
              value={formData.tax_type}
              onChange={handleInputChange}
              className="uniform-input"
            >
              {TAX_CLASSIFICATIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label className="field-label">GST Rate (%)</label>
            <input
              type="number"
              name="gst_rate"
              value={formData.gst_rate}
              onChange={handleInputChange}
              disabled={formData.tax_type !== 'Taxable'}
              step="0.01"
              min="0"
              max="100"
              className={`uniform-input ${formData.tax_type !== 'Taxable' ? 'readonly-field' : ''}`}
            />
          </div>

          <div className="field-group">
            <label className="field-label">Calculation Mode</label>
            <select
              name="calc_type"
              value={formData.calc_type}
              onChange={handleInputChange}
              className="uniform-input"
            >
              <option value="Exclusive">Exclusive (Base + Tax)</option>
              <option value="Inclusive">Inclusive (Tax included)</option>
              <option value="Without Tax">Without Tax</option>
            </select>
          </div>

          <div className="field-group">
            <label className="field-label">Status</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              className="uniform-input"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Section 2: Rate Split Preview */}
      <div className="form-section full-span">
        <div className="section-title">GST Rate Split Breakdown</div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          background: '#f8fafc',
          padding: '12px',
          borderRadius: '4px',
          border: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <div style={{ background: '#fff', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>CGST (Intra-State)</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', marginTop: '2px' }}>{cgstRate}%</div>
          </div>
          <div style={{ background: '#fff', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>SGST (Intra-State)</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', marginTop: '2px' }}>{sgstRate}%</div>
          </div>
          <div style={{ background: '#fff', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>IGST (Inter-State)</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1976d2', marginTop: '2px' }}>{igstRate}%</div>
          </div>
        </div>
      </div>

      {/* Section 3: Description & Remarks */}
      <div className="form-section full-span">
        <div className="section-title">Description & Remarks</div>
        <div className="master-grid" style={{ gap: '12px 16px' }}>
          <div className="field-group">
            <label className="field-label">Description / HSN Commodity Notes</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows="2"
              placeholder="e.g. Pre-packaged pulses and grain items under GST schedule"
              className="uniform-input"
              style={{ height: '56px', resize: 'vertical' }}
            />
          </div>

          <div className="field-group">
            <label className="field-label">Remarks</label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleInputChange}
              rows="2"
              placeholder="Internal tax classification notes"
              className="uniform-input"
              style={{ height: '56px', resize: 'vertical' }}
            />
          </div>
        </div>
      </div>
    </MasterFormLayout>
  );
};

export default TaxMasterCreate;
