import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * EntryActions - Action buttons for Entry / Create / Edit pages
 * Standard Back, Cancel, Refresh, Print, Save buttons
 * Styled with Blue & White theme
 * 
 * @param {Function} onBack - Back button handler (defaults to history back)
 * @param {Function} onCancel - Cancel handler (cancel current entry / reset)
 * @param {Function} onRefresh - Refresh handler (clear/reload data)
 * @param {Function} onPrint - Print handler
 * @param {Function} onSave - Save handler
 * @param {Boolean} showBack - Show Back button (default true)
 * @param {Boolean} showCancel - Show Cancel button (default true)
 * @param {Boolean} showRefresh - Show Refresh button (default true)
 * @param {Boolean} showPrint - Show Print button (default false)
 * @param {Boolean} showSave - Show Save button (default true)
 * @param {Boolean} saving - Loading state for save
 * @param {String} saveText - Custom save button text
 */
export const EntryActions = ({
  onBack,
  onCancel = () => {},
  onPrint = () => {},
  onRefresh = () => {},
  onSave = () => {},
  showBack = true,
  showCancel = true,
  showRefresh = true,
  showPrint = false,
  showSave = true,
  saving = false,
  saveText = 'Save',
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  const buttonStyle = {
    padding: '8px 20px',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s ease',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  };

  return (
    <div className="window-footer" style={styles.footer}>
      <div style={styles.leftGroup}>
        {showBack && (
          <button
            type="button"
            onClick={handleBack}
            style={{ 
              ...buttonStyle, 
              backgroundColor: '#475569', 
              color: '#ffffff' 
            }}
            title="Go to previous page"
          >
            ← Back
          </button>
        )}
      </div>

      <div style={styles.buttonGroup}>
        {showCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{ 
              ...buttonStyle, 
              backgroundColor: '#ef4444', 
              color: '#ffffff' 
            }}
            title="Cancel entries"
          >
            ✕ Cancel
          </button>
        )}
        {showRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            style={{ 
              ...buttonStyle, 
              backgroundColor: '#f59e0b', 
              color: '#ffffff' 
            }}
            title="Clear / Refresh page data"
          >
            ↻ Refresh
          </button>
        )}
        {showPrint && (
          <button
            type="button"
            onClick={onPrint}
            style={{ 
              ...buttonStyle, 
              backgroundColor: '#0284c7', 
              color: '#ffffff' 
            }}
            title="Print record"
          >
            🖨 Print
          </button>
        )}
        {showSave && (
          <button
            type="submit"
            onClick={onSave}
            disabled={saving}
            style={{ 
              ...buttonStyle, 
              backgroundColor: '#1f4fb2', 
              color: '#ffffff',
              opacity: saving ? 0.7 : 1,
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
            title="Save record"
          >
            {saving ? '⏳ Saving...' : `💾 ${saveText}`}
          </button>
        )}
      </div>
    </div>
  );
};

const styles = {
  footer: {
    background: '#dbe7fb',
    padding: '12px 20px',
    borderTop: '2px solid #9fb6dd',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxSizing: 'border-box',
    marginTop: '15px'
  },
  leftGroup: {
    display: 'flex',
    alignItems: 'center',
  },
  buttonGroup: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '10px',
  },
};

export default EntryActions;
