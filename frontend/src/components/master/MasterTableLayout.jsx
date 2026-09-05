import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import '../CityDisplay.css';

/**
 * MasterTableLayout - Display table layout for Master pages
 * Standardized layout for master display pages
 * Blue & White theme (#1976d2)
 */
export const MasterTableLayout = ({
  columns = [],
  data = [],
  onEdit = () => {},
  onDelete = () => {},
  onPrint = null,
  onCreate = null,
  title = '',
  showActions = true,
  onBack,
  onRefresh,
  moduleName,
  extraFilters = null,
}) => {
  const { isAdmin, hasPermission } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirmRow, setDeleteConfirmRow] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [notification, setNotification] = useState(null);

  const cleanModule = moduleName || title.replace(/ Display$/i, '').replace(/ Creation$/i, '').trim();
  const canEdit = isAdmin || hasPermission(cleanModule, 'Display', 'can_edit') || hasPermission(cleanModule, 'can_edit');
  const canDelete = isAdmin || hasPermission(cleanModule, 'Display', 'can_delete') || hasPermission(cleanModule, 'can_delete');
  const canPrint = isAdmin || hasPermission(cleanModule, 'Display', 'can_print') || hasPermission(cleanModule, 'can_print');
  const canCreate = isAdmin || hasPermission(cleanModule, 'Display', 'can_create') || hasPermission(cleanModule, 'Create', 'can_create') || hasPermission(cleanModule, 'can_create');

  // Case-insensitive filtering of data rows matching searchTerm on any visible column or row property
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase().trim();
    return data.filter((row) => {
      // First, check displayed columns
      const inColumns = columns.some((col) => {
        const val = row[col.key];
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(term);
      });
      if (inColumns) return true;

      // Fallback: check all fields of the row object
      return Object.entries(row).some(([key, val]) => {
        if (val === null || val === undefined || typeof val === 'object') return false;
        return String(val).toLowerCase().includes(term);
      });
    });
  }, [data, searchTerm, columns]);

  return (
    <div className="standard-display">
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
        >
          <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          Back
        </button>

        <span className="screen-title-text">{title || 'MASTER DISPLAY'}</span>

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
          title="Refresh Data"
        >
          <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18"></path>
          </svg>
          Refresh
        </button>

        {canCreate && onCreate && (
          <button 
            type="button" 
            className="header-btn create-btn" 
            onClick={onCreate}
            title="Create New Record"
            style={{
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginLeft: '8px',
              fontSize: '13px',
              height: '36px',
              boxSizing: 'border-box'
            }}
          >
            <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ width: '16px', height: '16px', stroke: 'currentColor' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path>
            </svg>
            Create
          </button>
        )}
      </div>
      
      <div className="container">
        {notification && (
          <div 
            className={`notification-banner ${notification.type}`} 
            style={{
              padding: '12px 16px',
              marginBottom: '16px',
              borderRadius: '4px',
              fontWeight: '600',
              fontSize: '14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: notification.type === 'success' ? '#def7ec' : '#fde8e8',
              color: notification.type === 'success' ? '#03543f' : '#9b1c1c',
              border: `1px solid ${notification.type === 'success' ? '#bcf0da' : '#f8b4b4'}`,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <span>{notification.text}</span>
            <button 
              type="button"
              onClick={() => setNotification(null)} 
              style={{ 
                background: 'none', 
                border: 'none', 
                color: 'inherit', 
                cursor: 'pointer', 
                fontWeight: 'bold',
                fontSize: '16px',
                padding: '0 4px',
                marginLeft: '12px'
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Search Filter Bar */}
        <div className="search-filter-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 320px' }}>
            <div className="search-input-wrapper" style={{ flex: '1 1 260px', maxWidth: '400px' }}>
              <span className="search-icon">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ width: '16px', height: '16px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
              </span>
              <input
                type="text"
                placeholder={`Search ${title.toLowerCase()}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            {extraFilters}
          </div>
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="clear-search-btn"
            >
              Clear Search
            </button>
          )}
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
{columns.map((col, index) => (
                  <th key={`${col.key}_${index}`} style={col.width ? { width: col.width } : {}}>
                    {col.title}
                  </th>
                ))}

                {showActions && (
                  <th className="actions-header" style={{ width: onPrint ? '200px' : '140px', minWidth: onPrint ? '200px' : '140px' }}>Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (showActions ? 1 : 0)} style={{ textAlign: 'center', padding: '30px' }}>
                    No records found
                  </td>
                </tr>
              ) : (
                filteredData.map((row, index) => (
                  <tr key={index}>
                    {columns.map((col) => (
                      <td key={col.key}>
                        {col.render ? col.render(row[col.key], row, index) : row[col.key]}
                      </td>
                    ))}
                    {showActions && (
                      <td className="actions-cell">
                        {canPrint && onPrint && <button onClick={() => onPrint(row)} className="action-btn print-btn" disabled={deleting}>Print</button>}
                        {canEdit && <button onClick={() => onEdit(row)} className="action-btn update-btn" disabled={deleting}>Update</button>}
                        {canDelete && <button onClick={() => setDeleteConfirmRow(row)} className="action-btn delete-btn" disabled={deleting}>Delete</button>}
                        {!canEdit && !canPrint && !canDelete && <span style={{ color: '#888', fontSize: '12px' }}>-</span>}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Custom Confirmation Modal */}
      {deleteConfirmRow && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          fontFamily: 'inherit'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '6px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
            width: '90%',
            maxWidth: '440px',
            overflow: 'hidden',
            borderTop: '5px solid #dc2626',
            boxSizing: 'border-box'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ color: '#dc2626' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#1e293b', fontWeight: 700 }}>
                Confirm Deletion
              </h3>
            </div>
            
            <div style={{ padding: '20px', fontSize: '14px', color: '#334155', lineHeight: 1.5 }}>
              Are you sure you want to delete this {title ? title.toLowerCase() : 'record'}?
              {(() => {
                const nameVal = deleteConfirmRow.name || deleteConfirmRow.item_name || deleteConfirmRow.group_name || deleteConfirmRow.flourmill || deleteConfirmRow.godown_name || deleteConfirmRow.username;
                if (nameVal) {
                  return (
                    <div style={{ marginTop: '12px', padding: '10px 12px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '4px', fontWeight: 'bold', color: '#991b1b', wordBreak: 'break-all' }}>
                      "{nameVal}"
                    </div>
                  );
                }
                return null;
              })()}
              <div style={{ marginTop: '12px', fontSize: '12px', color: '#64748b' }}>
                This action is permanent and cannot be undone.
              </div>
            </div>

            <div style={{
              padding: '12px 20px',
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmRow(null)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const targetRow = deleteConfirmRow;
                  setDeleteConfirmRow(null);
                  setDeleting(true);
                  setNotification(null);
                  try {
                    await onDelete(targetRow);
                    setNotification({ text: `${title || 'Record'} deleted successfully.`, type: 'success' });
                    setTimeout(() => setNotification(null), 4000);
                  } catch (err) {
                    console.error("Delete error in layout:", err);
                    let errMsg = err?.message || 'Error deleting record';
                    if (errMsg.includes('SQLITE_CONSTRAINT') || errMsg.includes('foreign')) {
                      errMsg = "This record cannot be deleted because it is referenced by other transactions or master records.";
                    }
                    setNotification({ text: errMsg, type: 'error' });
                  } finally {
                    setDeleting(false);
                  }
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '4px',
                  border: 'none',
                  background: '#dc2626',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="footer-bar">
        Total Records: {filteredData.length}
      </div>
    </div>
  );
};

export default MasterTableLayout;
