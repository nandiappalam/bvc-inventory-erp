import React from 'react';

/**
 * EntryActions - Action buttons for Entry pages
 * Standard Save, Cancel, Print, Refresh buttons
 * Styled with Blue & White theme
 * 
 * @param {Function} onSave - Save handler
 * @param {Function} onCancel - Cancel handler
 * @param {Function} onPrint - Print handler
 * @param {Function} onRefresh - Refresh handler
 * @param {Boolean} showSave - Show save button
 * @param {Boolean} showCancel - Show cancel button
 * @param {Boolean} showPrint - Show print button
 * @param {Boolean} showRefresh - Show refresh button
 * @param {Boolean} saving - Loading state for save
 * @param {String} saveText - Custom save button text
 */
export const EntryActions = ({
  onSave = () => {},
  onCancel = () => {},
  onPrint = () => {},
  onRefresh = () => {},
  showSave = true,
  showCancel = false,
  showPrint = false,
  showRefresh = false,
  saving = false,
  saveText = 'Save',
}) => {
  const buttonStyle = {
    padding: '10px 24px',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginLeft: '10px',
    transition: 'all 0.2s ease',
  };

  return (
    <div className="window-footer" style={styles.footer}>
      <div style={styles.buttonGroup}>
        {showCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{ ...buttonStyle, backgroundColor: '#9e9e9e', color: '#fff' }}
          >
            Cancel
          </button>
        )}
        {showPrint && (
          <button
            type="button"
            onClick={onPrint}
            style={{ ...buttonStyle, backgroundColor: '#2196F3', color: '#fff' }}
          >
            Print
          </button>
        )}
        {showRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            style={{ ...buttonStyle, backgroundColor: '#FF9800', color: '#fff' }}
          >
            Refresh
          </button>
        )}
        {showSave && (
          <button
            type="submit"
            onClick={onSave}
            disabled={saving}
            style={{ ...buttonStyle, backgroundColor: '#1f4fb2', color: '#fff' }}
          >
            {saving ? 'Saving...' : saveText}
          </button>
        )}
      </div>
    </div>
  );
};

const styles = {
  footer: {
    background: '#dbe7fb',
    padding: '15px 20px',
    textAlign: 'right',
    borderTop: '2px solid #9fb6dd',
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  buttonGroup: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
  },
};

export default EntryActions;
