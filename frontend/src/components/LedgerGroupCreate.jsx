import React, { useState, useEffect } from 'react';
import api from '../utils/api.js';
import { MASTER_CONFIG } from '../utils/masterConfig.js';

import MasterFormLayout from './master/MasterFormLayout';
import { safeArray } from '../utils/safeArray.js';
import { FormSection } from './master/FormSection';
import SmartField from './master/SmartField';
import './master/master.css';

const LedgerGroupCreate = () => {
  const config = MASTER_CONFIG.ledger_group || {};

  const sections = safeArray(config.sections);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const getResetData = () => {
    const resetData = {};
    safeArray(config.sections).forEach(section => {
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
    if (!formData.group_name?.trim()) {
      setMessage('Group Name is required');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      const result = await api.createMaster(config.table, formData);
      if (result.success) {
        setMessage('Ledger Group saved successfully!');
        setMessageType('success');
        setFormData(getResetData());
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Error: ' + (result.message || 'Unknown error'));
        setMessageType('error');
      }
    } catch (error) {
      console.error('Save error:', error);
      setMessage('Error saving ledger group');
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
    <MasterFormLayout title="Ledger Group Creation" onSave={handleSubmit} onCancel={handleCancel}>
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

export default LedgerGroupCreate;
