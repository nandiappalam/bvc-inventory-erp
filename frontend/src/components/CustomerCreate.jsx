import React, { useState, useEffect } from 'react';
import api from '../utils/api.js';
import { MASTER_CONFIG } from '../utils/masterConfig.js';
import { safeArray } from '../utils/safeArray.js';
import MasterFormLayout from './master/MasterFormLayout';
import { FormSection, SmartField } from './master';
import MasterActions from './master/MasterActions';
import './CustomerCreate.css';
import './master/master.css';

const CustomerCreate = () => {
  const config = MASTER_CONFIG.customer || {};
  const sections = safeArray(config.sections);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    // Generate next customer code
    api.getMasters(config.table).then((res) => {
      const count = (res.data || []).length;
      const nextCode = `CUST${String(count + 1).padStart(3, '0')}`;
      handleChange('customer_code', nextCode);
    }).catch(err => console.log('Customer code gen failed', err));

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
    if (!formData.name?.trim()) {
      setMessage('Customer name is required');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      const result = await api.createMaster(config.table, formData);

      if (result.success) {
        setMessage('Customer saved successfully!');
        setMessageType('success');
        // Reset
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
      console.error('Save error:', error);
      setMessage('Error saving customer');
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
    <MasterFormLayout title="Customer Creation" onSave={handleSubmit} onCancel={handleCancel}>
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

      <MasterActions
        onSave={handleSubmit}
        onCancel={handleCancel}
        showSave={true}
        saving={loading}
        mode="create"
      />
    </MasterFormLayout>
  );
};

export default CustomerCreate;
