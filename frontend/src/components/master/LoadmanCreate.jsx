import React, { useState, useEffect } from 'react';
import api from '../../services/api.js';
import { MASTER_CONFIG } from '../../utils/masterConfig.js';
import { safeArray } from '../../utils/safeArray.js';
import MasterFormLayout from './MasterFormLayout';
import { FormSection } from './FormSection';
import SmartField from './SmartField';
import './master.css';

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
      const result = await api.post('/api/masters/table/operational_parties', { ...formData, category: 'LOADMAN', party_category: 'LOADMAN', is_active: formData.is_active || 1 });
      if (result.success !== false) {
        setMessage('Loadman saved successfully!');
        setMessageType('success');
        setFormData({});
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Error: ' + (result.message || 'Unknown error'));
        setMessageType('error');
      }
    } catch (err) {
      setMessage('Error saving loadman');
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
