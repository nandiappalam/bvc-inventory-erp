import React from 'react';

/**
 * MasterFieldGroup - Label + input wrapper for Master forms
 * Standardized field styling with uniform-input class
 * Blue & White theme (#1976d2)
 * 
 * @param {String} label - Field label
 * @param {String} name - Input name
 * @param {String} type - Input type (text, number, select, textarea)
 * @param {Object} value - Current value
 * @param {Function} onChange - Change handler
 * @param {Array} options - Options for select inputs
 * @param {Boolean} required - Is field required
 * @param {String} placeholder - Input placeholder
 * @param {Boolean} fullWidth - Span full width
 */
export const MasterFieldGroup = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  options = [],
  required = false,
  placeholder = '',
  fullWidth = false,
}) => {
  const handleChange = (e) => {
    onChange({ target: { name, value: e.target.value } });
  };

  const fieldStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    gridColumn: fullWidth ? 'span 2' : 'auto',
  };

  const labelStyle = {
    color: '#1976d2',
    fontSize: '14px',
    fontWeight: 'bold',
  };

  // Uniform input styling - matches .uniform-input CSS class
  const inputStyle = {
    width: '100%',
    height: '34px',
    padding: '4px 10px',
    border: '1px solid #1976d2',
    borderRadius: '4px',
    fontSize: '13px',
    backgroundColor: '#fff',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    outline: 'none',
  };

  return (
    <div style={fieldStyle}>
      <label style={labelStyle}>
        {label}
        {required && <span style={{ color: '#f44336' }}> *</span>}
      </label>
      {type === 'select' ? (
        <select
          name={name}
          value={value || ''}
          onChange={handleChange}
          style={inputStyle}
          className="uniform-input"
        >
          <option value="">Select {label}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          name={name}
          value={value || ''}
          onChange={handleChange}
          placeholder={placeholder}
          rows={3}
          style={{ ...inputStyle, height: 'auto', resize: 'vertical' }}
          className="uniform-input"
        />
      ) : (
        <input
          type={type}
          name={name}
          value={value || ''}
          onChange={handleChange}
          placeholder={placeholder}
          style={inputStyle}
          className="uniform-input"
          required={required}
        />
      )}
    </div>
  );
};

export default MasterFieldGroup;
