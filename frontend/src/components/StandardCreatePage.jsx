import React, { useState } from 'react';
import './StandardCreatePage.css';

/**
 * StandardCreatePage Template
 * 
 * Usage: This template should be customized for each module by:
 * 1. Changing component name
 * 2. Updating pageTitle
 * 3. Adding form fields in the form-rows section
 * 4. Updating the API endpoint in handleSubmit
 * 5. Adding field validation logic
 * 6. Creating a corresponding CSS file
 */

const StandardCreatePage = ({ pageTitle = 'Create Page', apiEndpoint = '/api/masters/table' }) => {
  // State Management
  const [formData, setFormData] = useState({
    // Add your fields here
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' or 'error'

  // Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.name || formData.name.trim() === '') {
      setMessage('Name is required');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${apiEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setMessage('Record saved successfully!');
        setMessageType('success');
        // Reset form
        setFormData({});
        // Auto-clear message after 3 seconds
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Error saving record. Please try again.');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage('Network error. Please try again.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="standard-create-container">
      {/* Top Bar */}
      

      {/* Page Title */}
      <div className="page-title">{pageTitle}</div>

      {/* Form Container */}
      <div className="form-wrapper">
        <form className="entry-form" onSubmit={handleSubmit}>
          {/* Message Box */}
          {message && (
            <div className={`message-box ${messageType}`}>
              {message}
            </div>
          )}

          {/* Form Fields Example */}
          {/* Replace these with your actual fields */}
          <div className="row">
            <label>Name</label>
            <span>:</span>
            <input
              type="text"
              name="name"
              value={formData.name || ''}
              onChange={handleChange}
              placeholder="Enter name"
            />
          </div>

          <div className="row">
            <label>Description</label>
            <span>:</span>
            <input
              type="text"
              name="description"
              value={formData.description || ''}
              onChange={handleChange}
              placeholder="Enter description"
            />
          </div>

          <div className="row">
            <label>Status</label>
            <span>:</span>
            <select 
              name="status" 
              value={formData.status || 'Active'} 
              onChange={handleChange}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          {/* Save Button */}
          <div className="btn-row">
            <button 
              type="submit" 
              className="save-btn"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StandardCreatePage;
