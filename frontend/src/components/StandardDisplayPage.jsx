import React, { useState, useEffect } from 'react';
import { printHtml } from '../utils/printHelper';
import { useAuth } from '../context/AuthContext';
import { exportToExcel, printTableList } from '../utils/exportHelper';
import './StandardDisplayPage.css';

/**
 * StandardDisplayPage Template
 * 
 * Usage: This template should be customized for each module by:
 * 1. Changing component name
 * 2. Updating pageTitle
 * 3. Updating columns array with your table columns
 * 4. Updating the API endpoint in useEffect
 * 5. Updating form fields in the modal
 * 6. Creating a corresponding CSS file
 */

const StandardDisplayPage = ({ 
  pageTitle = 'Display Page', 
  apiEndpoint = '/api/masters/table',
  columns = ['S.No', 'Name', 'Status']
}) => {
  const { isAdmin, hasPermission, selectedCompany, financialYear } = useAuth();
  const cleanModule = pageTitle.replace(/ Display$/i, '').replace(/ Creation$/i, '').trim();
  const canEdit = isAdmin || hasPermission(cleanModule, 'Display', 'can_edit') || hasPermission(cleanModule, 'can_edit');
  const canDelete = isAdmin || hasPermission(cleanModule, 'Display', 'can_delete') || hasPermission(cleanModule, 'can_delete');
  const canPrint = isAdmin || hasPermission(cleanModule, 'Display', 'can_print') || hasPermission(cleanModule, 'can_print');

  const handleExportExcel = () => {
    const colObjects = columns.map(col => typeof col === 'string' ? { key: col.toLowerCase().replace(/\s+/g, '_').replace(/\./g, ''), title: col } : col);
    exportToExcel(filteredRecords, pageTitle, colObjects);
  };

  const handlePrintList = () => {
    const colObjects = columns.map(col => typeof col === 'string' ? { key: col.toLowerCase().replace(/\s+/g, '_').replace(/\./g, ''), title: col } : col);
    printTableList(pageTitle, colObjects, filteredRecords, {
      company: selectedCompany?.name || 'BVC Company',
      fy: financialYear || '2024-2025'
    });
  };
  // State Management
  const [records, setRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [searchText, setSearchText] = useState('');

  // Fetch records on component mount
  useEffect(() => {
    fetchRecords();
  }, []);

  // Filter records when search text changes
  useEffect(() => {
    if (searchText.trim() === '') {
      setFilteredRecords(records);
    } else {
      const filtered = records.filter(record =>
        Object.values(record).some(value =>
          String(value).toLowerCase().includes(searchText.toLowerCase())
        )
      );
      setFilteredRecords(filtered);
    }
  }, [searchText, records]);

  // Fetch records from API
  const fetchRecords = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiEndpoint}`);
      if (response.ok) {
        const data = await response.json();
        setRecords(Array.isArray(data) ? data : []);
        setFilteredRecords(Array.isArray(data) ? data : []);
      } else {
        setMessage('Error loading records');
        setMessageType('error');
        setRecords([]);
        setFilteredRecords([]);
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage('Network error loading records');
      setMessageType('error');
      setRecords([]);
      setFilteredRecords([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle Update action
  const handleUpdate = (record) => {
    setEditData(record);
    setShowModal(true);
  };

  // Handle Delete action with confirmation
  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      try {
        const response = await fetch(`${apiEndpoint}/${id}`, {
          method: 'DELETE'
        });
        if (response.ok) {
          setMessage('Record deleted successfully!');
          setMessageType('success');
          setTimeout(() => setMessage(''), 3000);
          fetchRecords();
        } else {
          setMessage('Error deleting record');
          setMessageType('error');
        }
      } catch (error) {
        console.error('Error:', error);
        setMessage('Network error deleting record');
        setMessageType('error');
      }
    }
  };

  // Handle Print action
  const handlePrint = (record) => {
    const html = `<pre>${JSON.stringify(record, null, 2)}</pre>`;
    printHtml(html, "Record Detail");
  };

  // Handle Save Update (Modal)
  const handleSaveUpdate = async () => {
    if (!editData.id && !editData._id) {
      setMessage('Record ID not found');
      setMessageType('error');
      return;
    }

    const recordId = editData.id || editData._id;
    try {
      const response = await fetch(`${apiEndpoint}/${recordId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editData)
      });

      if (response.ok) {
        setMessage('Record updated successfully!');
        setMessageType('success');
        setTimeout(() => setMessage(''), 3000);
        setShowModal(false);
        setEditData(null);
        fetchRecords();
      } else {
        setMessage('Error updating record');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage('Network error updating record');
      setMessageType('error');
    }
  };

  // Handle modal input change
  const handleModalChange = (e) => {
    const { name, value } = e.target;
    setEditData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="standard-display-container">
      {/* Top Bar */}
      

      {/* Page Title */}
      <div className="page-title">{pageTitle}</div>

      {/* Content Area */}
      <div className="content-wrapper">
        {/* Message Box */}
        {message && (
          <div className={`message-box ${messageType}`}>
            {message}
          </div>
        )}

        {/* Search Bar & Action Buttons */}
        <div className="search-bar" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1, minWidth: '280px' }}>
            <input
              type="text"
              placeholder="Search records..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="search-input"
            />
            <span className="record-count">Total Records: {filteredRecords.length}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button 
              onClick={handleExportExcel}
              style={{
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '13px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}
            >
              📊 Export Excel
            </button>
            <button 
              onClick={handlePrintList}
              style={{
                backgroundColor: '#1f4fb2',
                color: '#ffffff',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '13px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}
            >
              🖨 Print List
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className="table-wrapper">
          {loading ? (
            <div className="loading">Loading records...</div>
          ) : filteredRecords.length === 0 ? (
            <div className="empty-state">No records found</div>
          ) : (
            <table className="grid-table">
              <thead>
                <tr>
                  <th>S.No</th>
                  {columns.map((col, idx) => (
                    <th key={idx}>{col}</th>
                  ))}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record, idx) => (
                  <tr key={record.id || record._id || idx}>
                    <td>{idx + 1}</td>
                    {columns.map((col, cidx) => {
                      const key = col.toLowerCase().replace(/\s+/g, '_');
                      return <td key={cidx}>{record[key] || record[col] || '-'}</td>;
                    })}
                    <td className="actions-cell">
                      {canEdit && (
                        <button
                          className="action-btn update-btn"
                          onClick={() => handleUpdate(record)}
                          title="Update"
                        >
                          Update
                        </button>
                      )}
                      {canPrint && (
                        <button
                          className="action-btn print-btn"
                          onClick={() => handlePrint(record)}
                          title="Print"
                        >
                          Print
                        </button>
                      )}
                      {canDelete && (
                        <button
                          className="action-btn delete-btn"
                          onClick={() => handleDelete(record.id || record._id)}
                          title="Delete"
                        >
                          Delete
                        </button>
                      )}
                      {!canEdit && !canPrint && !canDelete && (
                        <span style={{ color: '#888', fontSize: '12px' }}>-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="footer-bar">
          <div className="footer-left">Rows: {filteredRecords.length}</div>
          <div className="footer-right">
            <button className="refresh-btn" onClick={fetchRecords}>Refresh</button>
          </div>
        </div>
      </div>

      {/* Modal for Update */}
      {showModal && editData && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Update Record</h3>
              <button 
                className="modal-close" 
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Name:</label>
                <input
                  type="text"
                  name="name"
                  value={editData.name || ''}
                  onChange={handleModalChange}
                />
              </div>

              <div className="form-group">
                <label>Status:</label>
                <select
                  name="status"
                  value={editData.status || 'Active'}
                  onChange={handleModalChange}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="modal-btn save-btn"
                onClick={handleSaveUpdate}
              >
                Save
              </button>
              <button
                className="modal-btn cancel-btn"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StandardDisplayPage;
