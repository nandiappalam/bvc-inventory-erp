import React, { useState, useEffect } from 'react';
import api from '../../services/api.js';
import { MASTER_CONFIG } from '../../utils/masterConfig.js';
import { safeArray } from '../../utils/safeArray.js';
import MasterFormLayout from './MasterFormLayout';
import { FormSection } from './FormSection';
import SmartField from './SmartField';
import './master.css';

import { createMaster, invalidateMasterCache } from '../../services/masterservice.js';

const LoadmanCreate = () => {
  const config = MASTER_CONFIG.loadman || {};
  const sections = safeArray(config.sections);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    const initialData = {};
    sections.forEach(section => {
      safeArray(section.fields).forEach(field => {
        initialData[field.name] = field.defaultValue || '';
      });
    });
    setFormData(initialData);

    // Generate Loadman code
    api.getMasters('loadman').then((res) => {
      const list = Array.isArray(res) ? res : (res?.data || []);
      const count = list.length;
      const nextCode = `LM-${String(count + 1).padStart(3, '0')}`;
      setFormData(prev => ({
        ...prev,
        party_code: nextCode
      }));
    }).catch(err => console.log('Loadman code gen failed', err));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      setMessage('Loadman Name is required');
      setMessageType('error');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...formData,
        category: 'LOADMAN',
        party_category: 'LOADMAN',
        phone: formData.mobile || formData.phone,
        from_date: formData.from_date || formData.effective_from || '',
        till_date: formData.till_date || formData.effective_to || '',
        effective_from: formData.from_date || formData.effective_from || '',
        effective_to: formData.till_date || formData.effective_to || '',
        per_kg_amount: parseFloat(formData.per_kg_amount || 0),
        period_duration: formData.period_duration || '',
        is_active: formData.is_active !== undefined && formData.is_active !== '' ? Number(formData.is_active) : 1
      };
      const result = await createMaster('operational_parties', payload);
      if (result && (result.success !== false || result.id)) {
        invalidateMasterCache('loadman');
        invalidateMasterCache('workers');
        invalidateMasterCache('operational_parties');
        setMessage('Loadman saved successfully!');
        setMessageType('success');
        setFormData({});
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Error: ' + (result?.message || result?.error || 'Unknown error'));
        setMessageType('error');
      }
    } catch (err) {
      setMessage('Error saving loadman: ' + (err.message || 'Unknown error'));
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MasterFormLayout title="Loadman Creation" onSave={handleSubmit} onCancel={() => setFormData({})}>
      {message && <div className={`message ${messageType}`}>{message}</div>}
      {sections.map((section, secIndex) => (
        <FormSection key={secIndex} title={section.title}>
          {safeArray(section.fields).map((field, fieldIndex) => (
            <SmartField key={fieldIndex} field={field} value={formData[field.name]} onChange={handleChange} />
          ))}
        </FormSection>
      ))}
    </MasterFormLayout>
  );
};

export default LoadmanCreate;
