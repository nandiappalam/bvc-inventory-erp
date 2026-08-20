import React from 'react';

/**
 * PrimaryButton - Blue (#1565C0)
 * Used for Save and main actions
 */
export const PrimaryButton = ({ 
  children, 
  onClick, 
  type = 'button', 
  disabled = false,
  loading = false,
  className = '',
  style = {}
}) => {
  const buttonStyle = {
    backgroundColor: '#1565C0',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled || loading ? 0.6 : 1,
    transition: 'all 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    minHeight: '38px',
    ...style
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={className}
      style={buttonStyle}
      onMouseOver={(e) => {
        if (!disabled && !loading) {
          e.target.style.backgroundColor = '#0D47A1';
          e.target.style.transform = 'translateY(-2px)';
          e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
        }
      }}
      onMouseOut={(e) => {
        e.target.style.backgroundColor = '#1565C0';
        e.target.style.transform = 'translateY(0)';
        e.target.style.boxShadow = 'none';
      }}
    >
      {loading ? 'Loading...' : children}
    </button>
  );
};

/**
 * SecondaryButton - Grey
 * Used for Cancel and secondary actions
 */
export const SecondaryButton = ({ 
  children, 
  onClick, 
  type = 'button', 
  disabled = false,
  loading = false,
  className = '',
  style = {}
}) => {
  const buttonStyle = {
    backgroundColor: '#757575',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled || loading ? 0.6 : 1,
    transition: 'all 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    minHeight: '38px',
    ...style
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={className}
      style={buttonStyle}
      onMouseOver={(e) => {
        if (!disabled && !loading) {
          e.target.style.backgroundColor = '#616161';
          e.target.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseOut={(e) => {
        e.target.style.backgroundColor = '#757575';
        e.target.style.transform = 'translateY(0)';
      }}
    >
      {loading ? 'Loading...' : children}
    </button>
  );
};

/**
 * UpdateButton - Green
 * Used for Update actions
 */
export const UpdateButton = ({ 
  children = 'Update', 
  onClick, 
  disabled = false,
  className = '',
  style = {}
}) => {
  const buttonStyle = {
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 'bold',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'all 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    minHeight: '32px',
    ...style
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={buttonStyle}
      onMouseOver={(e) => {
        if (!disabled) {
          e.target.style.backgroundColor = '#388E3C';
          e.target.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseOut={(e) => {
        e.target.style.backgroundColor = '#4CAF50';
        e.target.style.transform = 'translateY(0)';
      }}
    >
      {children}
    </button>
  );
};

/**
 * DeleteButton - Red
 * Used for Delete actions
 */
export const DeleteButton = ({ 
  children = 'Delete', 
  onClick, 
  disabled = false,
  className = '',
  style = {}
}) => {
  const buttonStyle = {
    backgroundColor: '#f44336',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 'bold',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'all 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    minHeight: '32px',
    ...style
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={buttonStyle}
      onMouseOver={(e) => {
        if (!disabled) {
          e.target.style.backgroundColor = '#D32F2F';
          e.target.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseOut={(e) => {
        e.target.style.backgroundColor = '#f44336';
        e.target.style.transform = 'translateY(0)';
      }}
    >
      {children}
    </button>
  );
};

/**
 * PrintButton - Grey
 * Used for Print actions
 */
export const PrintButton = ({ 
  children = 'Print', 
  onClick, 
  disabled = false,
  className = '',
  style = {}
}) => {
  const buttonStyle = {
    backgroundColor: '#9E9E9E',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 'bold',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'all 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    minHeight: '32px',
    ...style
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={buttonStyle}
      onMouseOver={(e) => {
        if (!disabled) {
          e.target.style.backgroundColor = '#757575';
          e.target.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseOut={(e) => {
        e.target.style.backgroundColor = '#9E9E9E';
        e.target.style.transform = 'translateY(0)';
      }}
    >
      {children}
    </button>
  );
};

export default {
  PrimaryButton,
  SecondaryButton,
  UpdateButton,
  DeleteButton,
  PrintButton
};
