import React from 'react';

/**
 * InputField - Standardized input component
 */
export const InputField = ({
  label,
  name,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  required = false,
  disabled = false,
  error = '',
  className = '',
  style = {}
}) => {
  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '15px',
    ...style
  };

  const labelStyle = {
    color: '#1565C0',
    fontWeight: 'bold',
    fontSize: '14px',
    marginBottom: '6px',
  };

  const inputStyle = {
    padding: '10px 12px',
    border: error ? '2px solid #f44336' : '1px solid #7fa1d6',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    backgroundColor: disabled ? '#f5f5f5' : '#ffffff',
    ...(error ? {} : {}),
  };

  const errorStyle = {
    color: '#f44336',
    fontSize: '12px',
    marginTop: '4px',
  };

  return (
    <div style={containerStyle} className={className}>
      <label style={labelStyle}>
        {label}
        {required && <span style={{ color: '#f44336' }}> *</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        style={inputStyle}
        onFocus={(e) => {
          e.target.style.borderColor = '#1565C0';
          e.target.style.boxShadow = '0 0 4px rgba(21, 101, 192, 0.3)';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = error ? '#f44336' : '#7fa1d6';
          e.target.style.boxShadow = 'none';
        }}
      />
      {error && <span style={errorStyle}>{error}</span>}
    </div>
  );
};

/**
 * SelectField - Standardized select component
 */
export const SelectField = ({
  label,
  name,
  value,
  onChange,
  options = [],
  placeholder = 'Select option',
  required = false,
  disabled = false,
  error = '',
  className = '',
  style = {}
}) => {
  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '15px',
    ...style
  };

  const labelStyle = {
    color: '#1565C0',
    fontWeight: 'bold',
    fontSize: '14px',
    marginBottom: '6px',
  };

  const selectStyle = {
    padding: '10px 12px',
    border: error ? '2px solid #f44336' : '1px solid #7fa1d6',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    backgroundColor: disabled ? '#f5f5f5' : '#ffffff',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };

  const errorStyle = {
    color: '#f44336',
    fontSize: '12px',
    marginTop: '4px',
  };

  return (
    <div style={containerStyle} className={className}>
      <label style={labelStyle}>
        {label}
        {required && <span style={{ color: '#f44336' }}> *</span>}
      </label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        style={selectStyle}
        onFocus={(e) => {
          e.target.style.borderColor = '#1565C0';
          e.target.style.boxShadow = '0 0 4px rgba(21, 101, 192, 0.3)';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = error ? '#f44336' : '#7fa1d6';
          e.target.style.boxShadow = 'none';
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <span style={errorStyle}>{error}</span>}
    </div>
  );
};

/**
 * TextAreaField - Standardized textarea component
 */
export const TextAreaField = ({
  label,
  name,
  value,
  onChange,
  placeholder = '',
  rows = 4,
  required = false,
  disabled = false,
  error = '',
  className = '',
  style = {}
}) => {
  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '15px',
    ...style
  };

  const labelStyle = {
    color: '#1565C0',
    fontWeight: 'bold',
    fontSize: '14px',
    marginBottom: '6px',
  };

  const textareaStyle = {
    padding: '10px 12px',
    border: error ? '2px solid #f44336' : '1px solid #7fa1d6',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'inherit',
    outline: 'none',
    resize: 'vertical',
    minHeight: '80px',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    backgroundColor: disabled ? '#f5f5f5' : '#ffffff',
  };

  const errorStyle = {
    color: '#f44336',
    fontSize: '12px',
    marginTop: '4px',
  };

  return (
    <div style={containerStyle} className={className}>
      <label style={labelStyle}>
        {label}
        {required && <span style={{ color: '#f44336' }}> *</span>}
      </label>
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        required={required}
        style={textareaStyle}
        onFocus={(e) => {
          e.target.style.borderColor = '#1565C0';
          e.target.style.boxShadow = '0 0 4px rgba(21, 101, 192, 0.3)';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = error ? '#f44336' : '#7fa1d6';
          e.target.style.boxShadow = 'none';
        }}
      />
      {error && <span style={errorStyle}>{error}</span>}
    </div>
  );
};

export default {
  InputField,
  SelectField,
  TextAreaField
};
