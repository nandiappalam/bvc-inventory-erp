const fs = require('fs');

const content = `import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MASTER_CONFIG } from '../utils/masterConfig.js';
import { safeArray } from '../utils/safeArray.js';
import SmartField from './master/SmartField';
import './PapadCompanyCreate.css';

const defaultEntry = {
  from_date: '',
  to_date: '',
  papad_per_bag: 0,
  wages_per_bag: 0,
  advance_deduction_per_bag: 0
};

const PapadCompanyCreate = () => {
  const navigate = useNavigate();
  const config = MASTER_CONFIG.papad_company;
  const sections = safeArray(config.sections);

  const [formData, setFormData] = useState({});
  const [entries, setEntries] = useState([{ ...defaultEntry }]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  const getResetData = () => {
    const resetData = {};
    sections.forEach(section => {
      safeArray(section.fields).forEach(field => {
        resetData[field.name] = field.defaultValue !== undefined ? field.defaultValue : '';
      });
    });
    return resetData;
  };

  useEffect(() => {
    setFormData(getResetData());
  }, []);

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEntryChange = (index, field, value) => {
    setEntries(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addEntryRow = () => {
    setEntries(prev => [...prev, { ...defaultEntry }]);
  };

  const deleteEntryRow = (index) => {
    setEntries(prev => prev.filter((_, i) => i !== index));
  };

  const validate = () => {
    if (!formData.name?.trim()) {
      setMessage('Company Name is required');
      setMessageType('error');
      return false;
    }
    if (entries.length === 0) {
      setMessage('At least one entry is required');
      setMessageType('error');
      return false;
    }
    for (const entry of entries) {
      if (entry.from_date && entry.to_date && entry.from_date > entry.to_date) {
        setMessage('From Date must be before To Date');
        setMessageType('error');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setMessage('');

    const payload = {
      ...formData,
      opening_advance: Number(formData.opening_advance) || 0,
      opening_balance: Number(formData.opening_balance) || 0,
      entries: entries.map(e => ({
        ...e,
        papad_per_bag: Number(e.papad_per_bag) || 0,
        wages_per_bag: Number(e.wages_per_bag) || 0,
        advance_deduction_per_bag: Number(e.advance_deduction_per_bag) || 0
      }))
    };

    try {
      const response = await fetch('/api/papad-companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.success) {
        setMessage('Papad Company saved successfully!');
        setMessageType('success');
        setFormData(getResetData());
        setEntries([{ ...defaultEntry }]);
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Error: ' + (result.message || 'Unknown error'));
        setMessageType('error');
      }
    } catch (error) {
      console.error('Save error:', error);
      setMessage('Error saving papad company');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData(getResetData());
    setEntries([{ ...defaultEntry }]);
    setMessage('');
  };

  return (
    <div className="papad-company-page">
      {/* Header */}
      <div className="papad-header">
        <h2>Papad Company Creation</h2>
        <div className="papad-nav">
          <button className="btn-nav" onClick={() => navigate('/papad-company-list')}>
            Go To Papad Company List Page
          </button>
          <button className="btn-nav" onClick={() => navigate(-1)}>
            Back
          </button>
        </div>

      {message && <div className={\`message \${messageType}\`}>{message}</div>}

      <form onSubmit={handleSubmit} className="papad-form-container">
        {/* Left Panel - Company Details */}
        <div className="papad-left-panel">
          <div className="panel-title">Company Details</div>
          <div className="section-fields">
            {sections.flatMap(section => safeArray(section.fields)).map((field, fieldIndex) => (
              <SmartField
                key={fieldIndex}
                field={field}
                value={formData[field.name]}
                onChange={handleChange}
              />
            ))}
          </div>

        {/* Right Panel - Entry Table */}
        <div className="papad-right-panel">
          <div className="panel-title">Wages Entry</div>
          <div className="entry-table-container">
            <table className="entry-table">
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>From Date</th>
                  <th>To Date</th>
                  <th>Papad/bag</th>
                  <th>Wages/bag</th>
                  <th>Adv.Ded/bag</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>
                      <input
                        type="date"
                        value={entry.from_date}
                        onChange={(e) => handleEntryChange(index, 'from_date', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={entry.to_date}
                        onChange={(e) => handleEntryChange(index, 'to_date', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={entry.papad_per_bag}
                        onChange={(e) => handleEntryChange(index, 'papad_per_bag', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={entry.wages_per_bag}
                        onChange={(e) => handleEntryChange(index, 'wages_per_bag', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={entry.advance_deduction_per_bag}
                        onChange={(e) => handleEntryChange(index, 'advance_deduction_per_bag', e.target.value)}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-delete-row"
                        onClick={() => deleteEntryRow(index)}
                        disabled={entries.length === 1}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" className="btn-add-row" onClick={addEntryRow}>
              + Add Row
            </button>
          </div>
      </form>

      {/* Footer Actions */}
      <div className="papad-footer-actions">
        <button type="button" className="btn-save" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Saving...' : 'Save'}
        </button>
        <button type="button" className="btn-cancel" onClick={handleCancel}>
          Cancel
        </button>
      </div>
  );
};

export default PapadCompanyCreate;
`;

fs.writeFileSync('frontend/src/components/PapadCompanyCreate.jsx', content);
console.log('File written successfully');
`;

content = content.replace(/\\`/g, '`');
fs.writeFileSync('tmp_fix_papad.js', content);
