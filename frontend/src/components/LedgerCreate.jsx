import React, { useState, useEffect } from 'react';
import api from '../utils/api.js';
import { MASTER_CONFIG } from '../utils/masterConfig.js';
import MasterFormLayout from './master/MasterFormLayout';
import { safeArray } from '../utils/safeArray.js';
import { FormSection } from './master/FormSection';

import SmartField from './master/SmartField';
import './LedgerCreate.css';

const LedgerCreate = () => {
const config = MASTER_CONFIG?.ledger || {};
const sections = safeArray(config.sections);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  const handleChange = (name, value) => {
    setFormData(prev => {
      let updated = { ...prev, [name]: value };

      if (name === "name") {
        if (!prev.printname || prev.printname === prev.name) {
          updated.printname = value;
        }
      }

      return updated;
    });
  };




  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.ledger_name?.trim()) {
      setMessage('Ledger Name is required');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      const result = await api.createMaster(config.table, formData);
      if (result.success) {
        setMessage('Ledger saved successfully!');
        setMessageType('success');
        setFormData({});
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Error: ' + (result.message || 'Unknown error'));
        setMessageType('error');
      }
    } catch (error) {
      console.error('Save error:', error);
      setMessage('Error saving ledger');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({});
    setMessage('');
  };

  return (
    <MasterFormLayout title="Ledger Creation" onSave={handleSubmit} onCancel={handleCancel}>
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

export default LedgerCreate;
