import React, { useState, useEffect } from "react";
import { getMasters } from "../../services/masterservice.js";
import { MASTER_FIELD_TYPES, FIELD_TYPES, safeArray } from "../../utils/masterFields.js";
import "./master.css";

export const SmartField = ({ 
  field, 
  value, 
  onChange, 
  className = "" 
}) => {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  const fieldType = field.type || FIELD_TYPES[field.name] || 'text';
  const resolvedMasterType = field.masterType || MASTER_FIELD_TYPES[field.name];
  const isInputType = ['number', 'text', 'textarea', 'date', 'email'].includes(field.type) || 
                      (!field.type && ['number', 'text', 'textarea', 'date', 'email'].includes(fieldType));
  const isSelect = !isInputType && (
    field.type === 'select' || 
    field.type === 'masterSelect' || 
    fieldType === 'select' || 
    fieldType === 'masterSelect' || 
    (typeof resolvedMasterType === 'string' && !['number', 'text', 'textarea', 'date', 'email'].includes(fieldType))
  );
  const isMaster = isSelect && typeof resolvedMasterType === 'string' ? resolvedMasterType : null;
  const isReadonly = field.readonly || false;
  const finalValue = value !== undefined && value !== null ? value : (field.defaultValue !== undefined ? field.defaultValue : '');

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!isMaster || isReadonly) return;
        setLoading(true);

        if (Array.isArray(MASTER_FIELD_TYPES[isMaster])) {
          const staticOptions = MASTER_FIELD_TYPES[isMaster].map((val) => ({
            id: val,
            name: val,
          }));
          setOptions(staticOptions);
          setLoading(false);
          return;
        }

        const data = await getMasters(isMaster === 'item' ? 'items' : isMaster);
        setOptions(safeArray(data));
      } catch (err) {
        console.error(`Failed to load ${isMaster}:`, err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isMaster]);

  const handleChange = (e) => {
    onChange(field.name, e.target.value);
  };

  const labelText = field.label || field.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  if (isReadonly) {
    return (
      <div className={`field-group full-span ${className}`}>
        <label className="field-label">
          {labelText} {field.required && <span style={{ color: '#f44336' }}> *</span>}
        </label>
        <div className="uniform-input readonly-field">{finalValue || '-'}</div>
      </div>
    );
  }

  const inputProps = {
    name: field.name,
    value: finalValue,
    onChange: handleChange,
    placeholder: field.placeholder || `Enter ${labelText.toLowerCase()}`,
    className: "uniform-input",
    required: field.required || false,
    disabled: loading,
  };

  return (
    <div className={`field-group ${field.fullWidth ? 'full-span' : ''} ${className}`}>
      <label className="field-label">
        {labelText} {field.required && <span style={{ color: '#f44336' }}> *</span>}
      </label>
      
      {loading ? (
        <div className="uniform-input" style={{ opacity: 0.6 }}>Loading...</div>
      ) : isSelect ? (
        <select {...inputProps}>
          <option value="">Select {labelText}</option>
          {safeArray(field.options || options).map((opt, index) => {
            const isString = typeof opt === 'string';
            const optValue = isString 
              ? opt 
              : (field.name.toLowerCase().endsWith('id') 
                  ? (opt.id !== undefined && opt.id !== null ? opt.id : (opt.value || opt.name || '')) 
                  : (field.masterType ? (opt.name || opt.id || '') : (opt.value || opt.id || '')));
            const optLabel = isString ? opt : (opt.label || opt.name || opt.value || opt.id || '');
            return (
              <option key={`${optValue}-${index}`} value={optValue}>
                {optLabel}
              </option>
            );
          })}
        </select>

      ) : fieldType === 'textarea' ? (
        <textarea {...inputProps} rows={3} />
      ) : fieldType === 'number' ? (
        <input type="number" step="0.01" {...inputProps} />
      ) : (
        <input type={fieldType} {...inputProps} />
      )}
    </div>
  );
};

export default SmartField;
