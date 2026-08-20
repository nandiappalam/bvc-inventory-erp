import React, { useState, useEffect } from 'react';
import { api } from '../services/masterservice.js';
import { safeArray } from '../utils/safeArray.js';
import { useMasterData } from '../hooks/useMasterData.js';

/**
 * MasterDropdown - Reusable dropdown for master data selection
 * Uses useMasterData hook for optimized caching/fetching
 */
const MasterDropdown = ({ 
  label = 'Select', 
  masterType, 
  value, 
  onChange, 
  required = false,
  name,
  className = ''
}) => {
  // Use hook for caching + auto-refresh
  const { data: options, loading, error, refresh } = useMasterData(masterType);
  
  // Debug logging
  useEffect(() => {
    if (masterType) {
      console.log(`🔍 MasterDropdown [${masterType}]:`, {
        count: options?.length || 0,
        first: options?.[0],
        loading,
        error: error?.message
      });
    }
  }, [masterType, options, loading, error]);

  const handleChange = (e) => {
    const selectedValue = e.target.value;
    console.log(`📝 Selected ${masterType}:`, selectedValue);
    
    if (onChange) {
      onChange({
        target: {
          name: name || masterType,
          value: selectedValue
        }
      });
    }
  };

  if (loading) {
    return (
      <div className={`form-group ${className}`}>
        <label>{label}{required && ' *'}</label>
        <select className="uniform-input" disabled>
          <option>Loading {label}...</option>
        </select>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`form-group ${className}`}>
        <label>{label}{required && ' *'}</label>
        <select className="uniform-input" disabled title={error}>
          <option>Error loading {label}</option>
        </select>
      </div>
    );
  }

  return (
    <div className={`form-group ${className}`}>
      <label>{label}{required && ' *'}</label>
      <select
        className="uniform-input"
        value={value || ''}
        onChange={handleChange}
        name={name || masterType}
        required={required}
      >
        <option value="">{`-- Select ${label} --`}</option>
        {safeArray(options).map((option, idx) => (
          <option key={`${option.id || 'opt'}-${idx}`} value={option.id}>
            {option.name || option.label || String(option.id)}
          </option>
        ))}
      </select>
      {options?.length === 0 && (
        <small style={{color: '#f44336'}}>No {label.toLowerCase()} found</small>
      )}
    </div>
  );
};

export default MasterDropdown;

