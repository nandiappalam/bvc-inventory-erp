import React from 'react';
import './master.css';

/**
 * MasterFormLayout - Reusable layout for ALL master create pages
 * Centered 1100px container with 2-column grid
 * Title + sections + actions footer
 */
export const MasterFormLayout = ({ 
  children, 
  title = '', 
  moduleName = '', 
  onSave, 
  onCancel, 
  saving = false,
  onBack,
  onRefresh,
}) => {
  const displayTitle = title || (moduleName ? `${moduleName.toUpperCase()} CREATION` : '');

  return (
    <div className="standard-display master-form-container">
      <div className="screen-header">
        <button 
          type="button" 
          className="header-btn back-btn" 
          onClick={() => {
            if (typeof onBack === 'function') {
              onBack();
            } else {
              window.history.back();
            }
          }}
          title="Go Back"
          disabled={saving}
        >
          <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          Back
        </button>

        <span className="screen-title-text">{displayTitle}</span>

        <button 
          type="button" 
          className="header-btn refresh-btn" 
          onClick={() => {
            if (typeof onRefresh === 'function') {
              onRefresh();
            } else {
              window.location.reload();
            }
          }}
          title="Refresh Form"
          disabled={saving}
        >
          <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18"></path>
          </svg>
          Refresh
        </button>
      </div>
      
      <div className="master-grid">
        {children}
      </div>
      
      <div className="master-actions">
        <button className="btn btn-secondary" onClick={onCancel} type="button" disabled={saving}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={onSave} type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
};

export default MasterFormLayout;
