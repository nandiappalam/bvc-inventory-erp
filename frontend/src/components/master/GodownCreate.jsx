import React, { useState, useEffect } from 'react';
import api from '../../utils/api.js';
import { MASTER_CONFIG } from '../../utils/masterConfig.js';
import { safeArray } from '../../utils/safeArray.js';
import MasterFormLayout from './MasterFormLayout';
import { FormSection } from './FormSection';
import SmartField from './SmartField';
import './master.css';

const GodownCreate = () => {
  const config = MASTER_CONFIG.godown || {};
  const sections = safeArray(config.sections);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    // Generate next godown code
    api.getMasters(config.table).then((res) => {
      const count = (res.data || []).length;
      const nextCode = `GODOWN${String(count + 1).padStart(3, '0')}`;
      handleChange('godown_name', nextCode);
    }).catch(err => console.log('Godown code gen failed', err));

    // Init form
    const initialData = {};
    sections.forEach(section => {
      safeArray(section.fields).forEach(field => {
        initialData[field.name] = field.defaultValue || '';
      });
    });
    setFormData(initialData);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.godown_name?.trim()) {
      setMessage('Godown Name is required');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      const result = await api.createMaster(config.table, formData);

      if (result.success) {
        setMessage('Godown saved successfully!');
        setMessageType('success');
        // Reset form
        const resetData = {};
        sections.forEach(section => {
          safeArray(section.fields).forEach(field => {
            resetData[field.name] = field.defaultValue || '';
          });
        });
        setFormData(resetData);
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Error: ' + (result.message || 'Unknown error'));
        setMessageType('error');
      }
    } catch (error) {
      console.error('FULL SAVE ERROR:', error);
      setMessage('Error saving godown');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    const resetData = {};
    sections.forEach(section => {
      safeArray(section.fields).forEach(field => {
        resetData[field.name] = field.defaultValue || '';
      });
    });
    setFormData(resetData);
    setMessage('');
  };

  return (
    <MasterFormLayout title="Godown Creation" onSave={handleSubmit} onCancel={handleCancel}>
      {message && <div className={`message ${messageType}`}>{message}</div>}

      {sections.map((section, secIndex) => (
        <FormSection key={secIndex} title={section.title}>
          {safeArray(section.fields).map((field, fieldIndex) => (
            <SmartField 
              key={fieldIndex} 
              field={field} 
              value={formData[field.name]} 
              onChange={handleChange} 
            />
          ))}
        </FormSection>
      ))}
    </MasterFormLayout>
  );
};

export default GodownCreate;
