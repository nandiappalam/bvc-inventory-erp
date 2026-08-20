import React from 'react';

/**
 * MasterActions - Action buttons for Master forms
 * Standardized button styling
 * Blue & White theme (#1976d2)
 * 
 * @param {Function} onSave - Save handler
 * @param {Function} onCancel - Cancel handler
 * @param {Boolean} showSave - Show save button
 * @param {Boolean} saving - Is saving in progress
 * @param {String} mode - 'create' or 'update'
 */
export const MasterActions = ({
  onSave = () => {},
  onCancel = () => {},
  showSave = true,
  saving = false,
  mode = 'create',
}) => {
  const buttonContainerStyle = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '24px',
    paddingTop: '16px',
    borderTop: '1px solid #e0e0e0',
  };

  const buttonStyle = {
    padding: '10px 18px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
  };

  const saveButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#1976d2',
    color: 'white',
  };

  const cancelButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#9e9e9e',
    color: 'white',
  };

  return (
    <div style={buttonContainerStyle}>
      <button
        type="button"
        onClick={onCancel}
        style={cancelButtonStyle}
        className="action-btn"
      >
        Cancel
      </button>
      {showSave && (
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          style={saveButtonStyle}
          className="primary-btn"
        >
          {saving ? 'Saving...' : mode === 'create' ? 'Save' : 'Update'}
        </button>
      )}
    </div>
  );
};

export default MasterActions;
