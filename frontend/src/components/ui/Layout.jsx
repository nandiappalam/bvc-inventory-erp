import React from 'react';

/**
 * EntryLayout - Layout wrapper for Entry pages
 * Properly handles flexbox, scroll, and all page sections
 */
export const EntryLayout = ({ 
  children, 
  title = 'Entry',
  style = {},
  className = '' 
}) => {
  const layoutStyle = {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: '#ffffff',
    fontFamily: 'Segoe UI, Arial, sans-serif',
    overflowY: 'auto',
    ...style
  };

  return (
    <div style={layoutStyle} className={className}>
      {children}
    </div>
  );
};

/**
 * EntryHeader - Header for Entry pages (Blue background)
 */
export const EntryHeader = ({ 
  title = '',
  style = {},
  className = ''
}) => {
  const headerStyle = {
    background: 'linear-gradient(135deg, #1565C0 0%, #1976D2 100%)',
    color: '#ffffff',
    padding: '12px 24px',
    fontSize: '18px',
    fontWeight: 'bold',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    ...style
  };

  return (
    <div style={headerStyle} className={className}>
      {title}
    </div>
  );
};

/**
 * EntryContentWrapper - Content container for Entry pages
 * Handles scrolling and proper flex layout
 */
export const EntryContentWrapper = ({ 
  children, 
  style = {},
  className = ''
}) => {
  const wrapperStyle = {
    flex: 1,
    padding: '20px',
    overflowY: 'auto',
    maxWidth: '100%',
    ...style
  };

  return (
    <div style={wrapperStyle} className={className}>
      {children}
    </div>
  );
};

/**
 * FormSection - Wrapper for form fields (used in Create pages)
 */
export const FormSection = ({ 
  children, 
  title = '',
  style = {},
  className = ''
}) => {
  const sectionStyle = {
    marginBottom: '20px',
    backgroundColor: '#ffffff',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    ...style
  };

  const titleStyle = {
    color: '#1565C0',
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '15px',
    paddingBottom: '8px',
    borderBottom: '1px solid #e0e0e0',
  };

  return (
    <div style={sectionStyle} className={className}>
      {title && <div style={titleStyle}>{title}</div>}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '15px' 
      }}>
        {children}
      </div>
    </div>
  );
};

/**
 * TableSection - Wrapper for table content (used in Display pages)
 */
export const TableSection = ({ 
  children, 
  title = '',
  style = {},
  className = ''
}) => {
  const sectionStyle = {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    overflow: 'hidden',
    marginBottom: '20px',
    ...style
  };

  const titleStyle = {
    color: '#1565C0',
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '15px',
    paddingBottom: '8px',
    borderBottom: '1px solid #e0e0e0',
  };

  return (
    <div style={sectionStyle} className={className}>
      {title && <div style={titleStyle}>{title}</div>}
      <div style={{ overflowX: 'auto' }}>
        {children}
      </div>
    </div>
  );
};

/**
 * FooterSection - Wrapper for footer fields (totals, etc.)
 */
export const FooterSection = ({ 
  children, 
  style = {},
  className = ''
}) => {
  const sectionStyle = {
    backgroundColor: '#f5f5f5',
    padding: '15px 20px',
    borderRadius: '8px',
    marginTop: '20px',
    ...style
  };

  return (
    <div style={sectionStyle} className={className}>
      {children}
    </div>
  );
};

/**
 * EntryActionSection - Action buttons for Entry pages
 */
export const EntryActionSection = ({ 
  type = 'create',
  onSave,
  onCancel,
  onPrint,
  onRefresh,
  saveText = 'Save',
  cancelText = 'Cancel',
  printText = 'Print',
  refreshText = 'Refresh',
  showSave = true,
  showCancel = false,
  showPrint = false,
  showRefresh = false,
  saving = false,
  style = {},
  className = ''
}) => {
  const containerStyle = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '20px',
    borderTop: '1px solid #e0e0e0',
    backgroundColor: '#ffffff',
    position: 'sticky',
    bottom: 0,
    zIndex: 10,
    ...style
  };

  const buttonBaseStyle = {
    padding: '10px 24px',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.2s ease',
    minWidth: '100px',
  };

  const getButtonStyle = (variant) => {
    const variants = {
      save: { backgroundColor: '#1565C0', color: '#ffffff' },
      cancel: { backgroundColor: '#757575', color: '#ffffff' },
      print: { backgroundColor: '#9E9E9E', color: '#ffffff' },
      refresh: { backgroundColor: '#2196F3', color: '#ffffff' },
    };
    return { ...buttonBaseStyle, ...variants[variant] };
  };

  const getHoverStyle = (variant) => {
    const hoverStyles = {
      save: { backgroundColor: '#0D47A1' },
      cancel: { backgroundColor: '#616161' },
      print: { backgroundColor: '#757575' },
      refresh: { backgroundColor: '#1976D2' },
    };
    return hoverStyles[variant];
  };

  return (
    <div style={containerStyle} className={className}>
      {showCancel && (
        <button 
          style={getButtonStyle('cancel')} 
          onClick={onCancel}
          disabled={saving}
          onMouseOver={(e) => Object.assign(e.target.style, getHoverStyle('cancel'))}
          onMouseOut={(e) => Object.assign(e.target.style, getButtonStyle('cancel'))}
        >
          {cancelText}
        </button>
      )}
      {showPrint && (
        <button 
          style={getButtonStyle('print')} 
          onClick={onPrint}
          onMouseOver={(e) => Object.assign(e.target.style, getHoverStyle('print'))}
          onMouseOut={(e) => Object.assign(e.target.style, getButtonStyle('print'))}
        >
          {printText}
        </button>
      )}
      {showRefresh && (
        <button 
          style={getButtonStyle('refresh')} 
          onClick={onRefresh}
          onMouseOver={(e) => Object.assign(e.target.style, getHoverStyle('refresh'))}
          onMouseOut={(e) => Object.assign(e.target.style, getButtonStyle('refresh'))}
        >
          {refreshText}
        </button>
      )}
      {showSave && (
        <button 
          style={getButtonStyle('save')} 
          onClick={onSave}
          disabled={saving}
          onMouseOver={(e) => Object.assign(e.target.style, getHoverStyle('save'))}
          onMouseOut={(e) => Object.assign(e.target.style, getButtonStyle('save'))}
        >
          {saving ? 'Saving...' : saveText}
        </button>
      )}
    </div>
  );
};

/**
 * EntryFooter - Footer for Entry pages
 */
export const EntryFooter = ({ 
  children,
  rowCount = 0,
  date = '',
  style = {},
  className = ''
}) => {
  const footerStyle = {
    backgroundColor: '#f5f5f5',
    borderTop: '1px solid #e0e0e0',
    padding: '12px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '14px',
    color: '#666666',
    ...style
  };

  return (
    <div style={footerStyle} className={className}>
      {children || (
        <>
          <span>Rows: {rowCount}</span>
          <span>{date || new Date().toLocaleDateString()}</span>
        </>
      )}
    </div>
  );
};

/**
 * MasterLayout - Layout wrapper for Master pages
 */
export const MasterLayout = ({ 
  children, 
  title = 'Master',
  style = {},
  className = '' 
}) => {
  const layoutStyle = {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: '#ffffff',
    fontFamily: 'Segoe UI, Arial, sans-serif',
    overflowY: 'auto',
    ...style
  };

  return (
    <div style={layoutStyle} className={className}>
      {children}
    </div>
  );
};

/**
 * MasterHeader - Header for Master pages (Blue background)
 */
export const MasterHeader = ({ 
  title = '',
  style = {},
  className = ''
}) => {
  const headerStyle = {
    background: 'linear-gradient(135deg, #1565C0 0%, #1976D2 100%)',
    color: '#ffffff',
    padding: '12px 24px',
    fontSize: '18px',
    fontWeight: 'bold',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    ...style
  };

  return (
    <div style={headerStyle} className={className}>
      {title}
    </div>
  );
};

/**
 * MasterContentWrapper - Content container for Master pages
 */
export const MasterContentWrapper = ({ 
  children, 
  style = {},
  className = ''
}) => {
  const wrapperStyle = {
    flex: 1,
    padding: '20px',
    overflowY: 'auto',
    maxWidth: '100%',
    ...style
  };

  return (
    <div style={wrapperStyle} className={className}>
      {children}
    </div>
  );
};

/**
 * MasterActionSection - Action buttons for Master pages
 */
export const MasterActionSection = ({ 
  type = 'display',
  onSave,
  onCancel,
  onPrint,
  onRefresh,
  onAddNew,
  saveText = 'Save',
  cancelText = 'Cancel',
  printText = 'Print',
  refreshText = 'Refresh',
  addNewText = 'Add New',
  showSave = false,
  showCancel = false,
  showPrint = false,
  showRefresh = false,
  showAddNew = false,
  saving = false,
  style = {},
  className = ''
}) => {
  const containerStyle = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '20px',
    borderTop: '1px solid #e0e0e0',
    backgroundColor: '#ffffff',
    position: 'sticky',
    bottom: 0,
    zIndex: 10,
    ...style
  };

  const buttonBaseStyle = {
    padding: '10px 24px',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.2s ease',
    minWidth: '100px',
  };

  const getButtonStyle = (variant) => {
    const variants = {
      save: { backgroundColor: '#1565C0', color: '#ffffff' },
      cancel: { backgroundColor: '#757575', color: '#ffffff' },
      print: { backgroundColor: '#9E9E9E', color: '#ffffff' },
      refresh: { backgroundColor: '#2196F3', color: '#ffffff' },
      addNew: { backgroundColor: '#4CAF50', color: '#ffffff' },
      update: { backgroundColor: '#4CAF50', color: '#ffffff' },
      delete: { backgroundColor: '#f44336', color: '#ffffff' },
    };
    return { ...buttonBaseStyle, ...variants[variant] };
  };

  const getHoverStyle = (variant) => {
    const hoverStyles = {
      save: { backgroundColor: '#0D47A1' },
      cancel: { backgroundColor: '#616161' },
      print: { backgroundColor: '#757575' },
      refresh: { backgroundColor: '#1976D2' },
      addNew: { backgroundColor: '#388E3C' },
      update: { backgroundColor: '#388E3C' },
      delete: { backgroundColor: '#D32F2F' },
    };
    return hoverStyles[variant];
  };

  return (
    <div style={containerStyle} className={className}>
      {showCancel && (
        <button 
          style={getButtonStyle('cancel')} 
          onClick={onCancel}
          disabled={saving}
          onMouseOver={(e) => Object.assign(e.target.style, getHoverStyle('cancel'))}
          onMouseOut={(e) => Object.assign(e.target.style, getButtonStyle('cancel'))}
        >
          {cancelText}
        </button>
      )}
      {showPrint && (
        <button 
          style={getButtonStyle('print')} 
          onClick={onPrint}
          onMouseOver={(e) => Object.assign(e.target.style, getHoverStyle('print'))}
          onMouseOut={(e) => Object.assign(e.target.style, getButtonStyle('print'))}
        >
          {printText}
        </button>
      )}
      {showRefresh && (
        <button 
          style={getButtonStyle('refresh')} 
          onClick={onRefresh}
          onMouseOver={(e) => Object.assign(e.target.style, getHoverStyle('refresh'))}
          onMouseOut={(e) => Object.assign(e.target.style, getButtonStyle('refresh'))}
        >
          {refreshText}
        </button>
      )}
      {showAddNew && (
        <button 
          style={getButtonStyle('addNew')} 
          onClick={onAddNew}
          onMouseOver={(e) => Object.assign(e.target.style, getHoverStyle('addNew'))}
          onMouseOut={(e) => Object.assign(e.target.style, getButtonStyle('addNew'))}
        >
          {addNewText}
        </button>
      )}
      {showSave && (
        <button 
          style={getButtonStyle('save')} 
          onClick={onSave}
          disabled={saving}
          onMouseOver={(e) => Object.assign(e.target.style, getHoverStyle('save'))}
          onMouseOut={(e) => Object.assign(e.target.style, getButtonStyle('save'))}
        >
          {saving ? 'Saving...' : saveText}
        </button>
      )}
    </div>
  );
};

/**
 * MasterFooter - Footer for Master pages
 */
export const MasterFooter = ({ 
  children,
  rowCount = 0,
  date = '',
  style = {},
  className = ''
}) => {
  const footerStyle = {
    backgroundColor: '#f5f5f5',
    borderTop: '1px solid #e0e0e0',
    padding: '12px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '14px',
    color: '#666666',
    ...style
  };

  return (
    <div style={footerStyle} className={className}>
      {children || (
        <>
          <span>Rows: {rowCount}</span>
          <span>{date || new Date().toLocaleDateString()}</span>
        </>
      )}
    </div>
  );
};

/**
 * SearchBar - Standardized search component
 */
export const SearchBar = ({ 
  value,
  onChange,
  placeholder = 'Search...',
  style = {},
  className = ''
}) => {
  const containerStyle = {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: '16px',
    ...style
  };

  const inputStyle = {
    padding: '10px 16px',
    border: '1px solid #7fa1d6',
    borderRadius: '4px',
    fontSize: '14px',
    width: '300px',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  };

  return (
    <div style={containerStyle} className={className}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
        onFocus={(e) => {
          e.target.style.borderColor = '#1565C0';
          e.target.style.boxShadow = '0 0 4px rgba(21, 101, 192, 0.3)';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = '#7fa1d6';
          e.target.style.boxShadow = 'none';
        }}
      />
    </div>
  );
};

/**
 * FormRow - Single row in form (label + input)
 */
export const FormRow = ({ 
  label, 
  children, 
  required = false,
  style = {},
  className = ''
}) => {
  const rowStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    ...style
  };

  const labelStyle = {
    color: '#1565C0',
    fontSize: '14px',
    fontWeight: 'bold',
  };

  return (
    <div style={rowStyle} className={className}>
      <label style={labelStyle}>
        {label}
        {required && <span style={{ color: '#f44336' }}> *</span>}
      </label>
      {children}
    </div>
  );
};

export default {
  // Entry components
  EntryLayout,
  EntryHeader,
  EntryContentWrapper,
  EntryActionSection,
  EntryFooter,
  // Master components
  MasterLayout,
  MasterHeader,
  MasterContentWrapper,
  MasterActionSection,
  MasterFooter,
  // Utility components
  SearchBar,
  FormSection,
  FormRow,
  TableSection,
  FooterSection,
};
