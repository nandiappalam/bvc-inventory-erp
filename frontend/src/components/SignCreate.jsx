import React, { useState, useEffect } from 'react';
import api from '../utils/api.js';
import { MASTER_CONFIG } from '../utils/masterConfig.js';
import { safeArray } from '../utils/safeArray.js';
import MasterFormLayout from './master/MasterFormLayout';
import { FormSection } from './master/FormSection';
import SmartField from './master/SmartField';

const SignCreate = () => {
  const config = MASTER_CONFIG.sign || {};
  const sections = safeArray(config.sections);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleChange('signature_image', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const getResetData = () => {
    const resetData = {};
    sections.forEach(section => {
      safeArray(section.fields).forEach(field => {
        resetData[field.name] = field.defaultValue || '';
      });
    });
    return resetData;
  };

  useEffect(() => {
    setFormData(getResetData());
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      setMessage('Signer Name is required');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      const result = await api.createMaster(config.table, formData);
      if (result && result.success) {
        setMessage('Signature saved successfully!');
        setMessageType('success');
        setFormData(getResetData());
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Error: ' + (result?.message || 'Unknown error'));
        setMessageType('error');
      }
    } catch (error) {
      console.error('Save error:', error);
      setMessage('Error saving signature');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData(getResetData());
    setMessage('');
  };

  return (
    <MasterFormLayout title="Signature Creation & Scanned Upload" onSave={handleSubmit} onCancel={handleCancel}>
      {message && <div className={`message ${messageType}`}>{message}</div>}
      {sections.map((section, secIndex) => (
        <FormSection key={secIndex} title={section.title}>
          {safeArray(section.fields).map((field, fieldIndex) => {
            if (field.name === 'signature_image') {
              return (
                <div key={fieldIndex} style={{ gridColumn: '1 / -1', marginBottom: '15px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px', color: '#1e293b' }}>
                    {field.label}
                  </label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleFileUpload}
                      style={{ padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }}
                    />
                    <span style={{ fontSize: '12px', color: '#64748b' }}>or paste Image URL / Base64 below</span>
                  </div>
                  <input 
                    type="text"
                    value={formData.signature_image || ''}
                    onChange={(e) => handleChange('signature_image', e.target.value)}
                    placeholder="https://... or data:image/png;base64,..."
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }}
                  />
                  {formData.signature_image && (
                    <div style={{ marginTop: '10px', padding: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', display: 'inline-block' }}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '4px' }}>Signature Preview:</span>
                      <img src={formData.signature_image} alt="Signature Preview" style={{ maxHeight: '60px', maxWidth: '200px', objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none'; }} />
                    </div>
                  )}
                </div>
              );
            }
            return (
              <SmartField 
                key={fieldIndex} 
                field={field} 
                value={formData[field.name]} 
                onChange={handleChange} 
              />
            );
          })}
        </FormSection>
      ))}
    </MasterFormLayout>
  );
};

export default SignCreate;
