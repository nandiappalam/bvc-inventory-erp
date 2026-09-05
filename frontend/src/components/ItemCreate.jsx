import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api.js';

import { MASTER_CONFIG } from '../utils/masterConfig.js';
import { safeArray } from '../utils/safeArray.js';
import { printHtml } from '../utils/printHelper.js';
import { buildItemPrintHtml } from '../utils/itemPrintHelper.js';
import MasterFormLayout from './master/MasterFormLayout';
import { FormSection, SmartField } from './master';
import MasterActions from './master/MasterActions';
import './ItemCreate.css';
import './master/master.css';

console.log("ITEM CREATE ACTIVE - CONFIG DRIVEN");

const ItemCreate = () => {
  const config = MASTER_CONFIG.item || {};
  const sections = safeArray(config.sections);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [searchParams] = useSearchParams();
  const editReference = searchParams.get('edit');

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    if (editReference) {
      api(`/masters/record/item_master/${encodeURIComponent(editReference)}`)
        .then((result) => setFormData(result?.data || result || {}))
        .catch((err) => {
          console.error('Item load failed', err);
          setMessage('Unable to load item for editing');
          setMessageType('error');
        });
      return;
    }

    // Generate next item code
    api('/masters/items').then((res) => {
      const count = Array.isArray(res?.data) ? res.data.length : 0;
      const nextCode = `ITM${String(count + 1).padStart(3, '0')}`;
      handleChange('item_code', nextCode);
    }).catch(err => console.log('Item code gen failed', err));

    // Init form with defaults
    const initialData = {};
    sections.forEach(section => {
      safeArray(section.fields).forEach(field => {
        if (field.defaultValue !== undefined) {
          initialData[field.name] = field.defaultValue;
        }
      });
    });
    setFormData(initialData);
  }, [editReference]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.item_name?.trim()) {
      setMessage('Item Name is required');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      const endpoint = editReference
        ? `/masters/item_master/${encodeURIComponent(editReference)}`
        : '/masters/item_master';
      const result = await api(endpoint, { method: editReference ? 'PUT' : 'POST', body: formData });

      if (!result) {
        console.error("❌ API failed (null response)");
        setMessage('Server error - check console');
        setMessageType('error');
        return;
      }
      if (result.success) {
        setMessage(editReference ? 'Item updated successfully!' : 'Item saved successfully!');
        setMessageType('success');
        // Reset form
        const resetData = {};
        sections.forEach(section => {
          safeArray(section.fields).forEach(field => {
            if (field.defaultValue !== undefined) {
              resetData[field.name] = field.defaultValue;
            } else {
              resetData[field.name] = '';
            }
          });
        });
        setFormData(resetData);
        setTimeout(() => setMessage(''), 3000);
      } else {
        console.error('FULL SAVE RESULT:', result);
        setMessage('Error: ' + (result.message || 'Unknown error'));
        setMessageType('error');
      }
    } catch (error) {
      console.error('FULL SAVE ERROR:', error);
      setMessage('Error saving item');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    const resetData = {};
    sections.forEach(section => {
      safeArray(section.fields).forEach(field => {
        if (field.defaultValue !== undefined) {
          resetData[field.name] = field.defaultValue;
        } else {
          resetData[field.name] = '';
        }
      });
    });
    setFormData(resetData);
    setMessage('');
  };

  const handlePrintPreview = () => {
    const html = buildItemPrintHtml(formData, formData.item_group || formData.group_name || '');
    printHtml(html, `Item - ${formData.item_name || formData.item_code || 'Preview'}`);
  };

  return (
    <MasterFormLayout title="Item Creation" onSave={handleSubmit} onCancel={handleCancel}>
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
        onPrint={handlePrintPreview}
        showPrint={true}
        showSave={true}
        saving={loading}
        mode={editReference ? 'update' : 'create'}
      />
    </MasterFormLayout>
  );
};

export default ItemCreate;

