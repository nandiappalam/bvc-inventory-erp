import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import { printHtml } from '../utils/printHelper.js';
import { buildItemPrintHtml } from '../utils/itemPrintHelper.js';
import './ItemDisplay.css';

// Default laboratory parameters template
const DEFAULT_SPECS = {
  moisture: { parameter: 'Moisture', category: 'Physical', min: 9, max: 14, unit: '%', method: 'IS 4333' },
  weeviled_grains: { parameter: 'Weeviled Grains', category: 'Physical', min: 0, max: 1, unit: '%', method: '' },
  broken_grains: { parameter: 'Broken Grains', category: 'Physical', min: 0, max: 5, unit: '%', method: '' },
  foreign_matter: { parameter: 'Foreign Matter', category: 'Physical', min: 0, max: 2, unit: '%', method: '' },
  damaged_discolored: { parameter: 'Damaged/Discolored Grains', category: 'Physical', min: 0, max: 3, unit: '%', method: '' },
  gluten: { parameter: 'Gluten', category: 'Chemical', min: 8, max: 12, unit: '%', method: 'IS 1155' },
  protein: { parameter: 'Protein', category: 'Chemical', min: 10, max: 15, unit: '%', method: 'AOAC' },
  ash: { parameter: 'Total Ash', category: 'Chemical', min: 0, max: 1, unit: '%', method: '' },
  yeast_mold: { parameter: 'Yeast & Mold', category: 'Microbiology', min: 0, max: 100, unit: 'cfu/g', method: 'ISO' },
  e_coli: { parameter: 'E. Coli', category: 'Microbiology', min: 0, max: 0, unit: 'cfu/g', method: 'ISO' },
  salmonella: { parameter: 'Salmonella', category: 'Salmonella', min: 0, max: 0, unit: '25g', method: 'ISO' }
};

const ItemDisplay = () => {
  const navigate = useNavigate();

  // State Management
  const [items, setItems] = useState([]);
  const [itemGroups, setItemGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  // Filter & Search State (Top Head)
  const [searchText, setSearchText] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // Specs Modal State
  const [specModalOpen, setSpecModalOpen] = useState(false);
  const [currentEditingItem, setCurrentEditingItem] = useState(null);
  const [currentSpecs, setCurrentSpecs] = useState({});

  // Print Preview Modal State
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printItem, setPrintItem] = useState(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Load items and groups on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // Fetch full master list from all/item_master endpoint (guarantees full records)
      const itemsRes = await api('/masters/all/item_master');
      const groupsRes = await api('/masters/item_groups');

      if (itemsRes?.success) {
        setItems(itemsRes.data || []);
      } else if (Array.isArray(itemsRes)) {
        setItems(itemsRes);
      } else {
        setItems([]);
      }

      if (groupsRes?.success) {
        setItemGroups(groupsRes.data || []);
      } else if (Array.isArray(groupsRes)) {
        setItemGroups(groupsRes);
      } else {
        setItemGroups([]);
      }
    } catch (err) {
      console.error('Error loading item master display data:', err);
      showNotification('Error loading item master data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (text, type = 'success') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(''), 4000);
  };

  // Safe JSON Parse Helper
  const parseLabParameters = (paramStr) => {
    if (!paramStr) return { categories: [], specs: {} };
    try {
      return typeof paramStr === 'string' ? JSON.parse(paramStr) : paramStr;
    } catch (e) {
      return { categories: [], specs: {} };
    }
  };

  // Handle toggle of a category (Physical, Chemical, Microbiology) directly in each row
  const handleToggleCategory = async (item, category) => {
    const parsed = parseLabParameters(item.lab_parameters);
    let updatedCategories = [...(parsed.categories || [])];

    if (updatedCategories.includes(category)) {
      updatedCategories = updatedCategories.filter(c => c !== category);
    } else {
      updatedCategories.push(category);
    }

    // Populate default specifications for the enabled category
    const updatedSpecs = { ...(parsed.specs || {}) };
    if (updatedCategories.includes(category)) {
      Object.keys(DEFAULT_SPECS).forEach(key => {
        const spec = DEFAULT_SPECS[key];
        if (spec.category === category && !updatedSpecs[key]) {
          updatedSpecs[key] = { ...spec };
        }
      });
    } else {
      // Clean up specs for removed category
      Object.keys(updatedSpecs).forEach(key => {
        if (updatedSpecs[key]?.category === category) {
          delete updatedSpecs[key];
        }
      });
    }

    const updatedParamObj = {
      categories: updatedCategories,
      specs: updatedSpecs
    };

    const updatedItem = {
      ...item,
      lab_parameters: JSON.stringify(updatedParamObj)
    };

    try {
      const res = await api(`/masters/item_master/${item.item_code}`, {
        method: 'PUT',
        body: updatedItem
      });

      if (res && res.success) {
        showNotification(`Lab category "${category}" toggled for ${item.item_name}.`);
        setItems(prev => prev.map(it => it.item_code === item.item_code ? { ...it, lab_parameters: JSON.stringify(updatedParamObj) } : it));
      } else {
        showNotification(`Error saving category: ${res?.message || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      console.error('Error saving lab category toggle:', err);
      showNotification('Error updating lab parameters.', 'error');
    }
  };

  // Open specifications custom modal
  const handleOpenSpecsModal = (item) => {
    const parsed = parseLabParameters(item.lab_parameters);
    setCurrentEditingItem(item);
    
    const mergedSpecs = {};
    const categories = parsed.categories || [];
    
    Object.keys(DEFAULT_SPECS).forEach(key => {
      const defaultSpec = DEFAULT_SPECS[key];
      if (categories.includes(defaultSpec.category)) {
        mergedSpecs[key] = parsed.specs?.[key] || { ...defaultSpec };
      }
    });

    setCurrentSpecs(mergedSpecs);
    setSpecModalOpen(true);
  };

  const handleSpecFieldChange = (key, field, value) => {
    setCurrentSpecs(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }));
  };

  // Save customized laboratory specifications
  const handleSaveSpecs = async () => {
    if (!currentEditingItem) return;

    const parsed = parseLabParameters(currentEditingItem.lab_parameters);
    const updatedParamObj = {
      categories: parsed.categories || [],
      specs: currentSpecs
    };

    const updatedItem = {
      ...currentEditingItem,
      lab_parameters: JSON.stringify(updatedParamObj)
    };

    try {
      const res = await api(`/masters/item_master/${currentEditingItem.item_code}`, {
        method: 'PUT',
        body: updatedItem
      });

      if (res && res.success) {
        showNotification(`Specs updated for ${currentEditingItem.item_name}.`);
        setItems(prev => prev.map(it => it.item_code === currentEditingItem.item_code ? { ...it, lab_parameters: JSON.stringify(updatedParamObj) } : it));
        setSpecModalOpen(false);
        setCurrentEditingItem(null);
      } else {
        showNotification(`Error saving specs: ${res?.message || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      console.error('Error saving specs:', err);
      showNotification('Error updating specifications.', 'error');
    }
  };

  // Print Mode trigger (Modal display overlay, secure inside frames)
  const handleOpenPrintPreview = (item) => {
    setPrintItem(item);
    setPrintModalOpen(true);
    const html = buildItemPrintHtml(item, getGroupName(item.item_group));
    printHtml(html, `Item - ${item.item_name || item.item_code}`);
  };

  const handlePrintAction = () => {
    if (printItem) {
      const html = buildItemPrintHtml(printItem, getGroupName(printItem.item_group));
      printHtml(html, `Item - ${printItem.item_name || printItem.item_code}`);
    } else {
      window.print();
    }
  };

  // Robust delete handler with foreign key constraint checks
  const handleDeleteItem = async (item) => {
    setDeleting(true);
    try {
      // Direct raw fetch call allows us to read the error body when HTTP Status is 500
      const response = await fetch(`/api/masters/item_master/${item.item_code}`, { method: 'DELETE' });
      const result = await response.json();

      if (response.ok && result.success) {
        showNotification(`Item "${item.item_name}" deleted successfully.`);
        setItems(prev => prev.filter(it => it.item_code !== item.item_code));
      } else {
        let errMsg = result?.message || result?.error || 'Unknown error occurred';
        if (errMsg.includes('SQLITE_CONSTRAINT') || errMsg.includes('foreign')) {
          errMsg = 'This item cannot be deleted because it is referenced in transactions (such as Purchases, Stock, or Sales entries).';
        }
        showNotification(`Error deleting item: ${errMsg}`, 'error');
      }
    } catch (err) {
      console.error('Error deleting item:', err);
      showNotification('An unexpected error occurred during deletion.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Edit/Update navigation
  const handleEditItem = (item) => {
    navigate(`/master/item-create?edit=${item.item_code}`);
  };

  // Computed filtered list
  const filteredItems = items.filter(item => {
    if (!item) return false;
    const searchLower = searchText.toLowerCase().trim();
    
    // Check text search
    let matchesText = true;
    if (searchLower) {
      matchesText = Object.entries(item).some(([key, val]) => {
        if (val === null || val === undefined || typeof val === 'object') return false;
        return String(val).toLowerCase().includes(searchLower);
      });
    }

    // Check Group
    let matchesGroup = true;
    if (selectedGroup !== 'All') {
      const selectedGroupObj = itemGroups.find(g => String(g.group_code) === String(selectedGroup));
      matchesGroup = 
        String(item.item_group) === String(selectedGroup) ||
        (selectedGroupObj && (
          String(item.item_group) === String(selectedGroupObj.group_code) ||
          String(item.item_group).toLowerCase() === String(selectedGroupObj.group_code).toLowerCase() ||
          String(item.item_group).toLowerCase() === String(selectedGroupObj.group_name).toLowerCase()
        ));
    }

    // Check Type
    const matchesType = selectedType === 'All' || (item.type && String(item.type).toLowerCase() === selectedType.toLowerCase());

    // Check Status
    const matchesStatus = selectedStatus === 'All' || (item.status && String(item.status).toLowerCase() === selectedStatus.toLowerCase());

    return matchesText && matchesGroup && matchesType && matchesStatus;
  });

  // Get human-friendly Group Name
  const getGroupName = (groupId) => {
    const group = itemGroups.find(g => String(g.group_code) === String(groupId) || g.group_code === groupId);
    return group ? group.group_name : groupId || '-';
  };

  return (
    <div className="item-display-container">
      {/* Top Header Bar */}
      <div className="screen-header">
        <button 
          type="button" 
          className="header-btn back-btn" 
          onClick={() => navigate(-1)}
          title="Go Back"
        >
          <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          Back
        </button>

        <span className="screen-title-text" style={{ flex: 1, textAlign: 'center' }}>ITEM MASTER DISPLAY</span>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            type="button" 
            className="header-btn refresh-btn" 
            onClick={loadData}
            title="Refresh Data"
            disabled={loading}
          >
            <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18"></path>
            </svg>
            Refresh
          </button>
          
          <button 
            onClick={() => navigate('/master/item-create')}
            className="add-new-item-btn"
            style={{ margin: 0 }}
          >
            + Add New Item
          </button>
        </div>
      </div>

      {/* Top Head Search Filters */}
      <div className="filter-panel no-print">
        <div className="filter-title">Search &amp; Filter Console</div>
        
        {/* Keyword Search */}
        <div className="filter-group">
          <label>Search:</label>
          <input 
            type="text" 
            placeholder="Name, code, HSN..." 
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>

        {/* Group Filter */}
        <div className="filter-group">
          <label>Group:</label>
          <select 
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
          >
            <option value="All">All Groups</option>
            {itemGroups.map(g => (
              <option key={g.group_code} value={g.group_code}>{g.group_name}</option>
            ))}
          </select>
        </div>

        {/* Type Filter */}
        <div className="filter-group">
          <label>Type:</label>
          <select 
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="All">All Types</option>
            <option value="Urad">Urad</option>
            <option value="Rice">Rice</option>
            <option value="Flour">Flour</option>
            <option value="Suji">Suji</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="filter-group">
          <label>Status:</label>
          <select 
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Message Box */}
      {message && (
        <div className={`notification-banner ${messageType}`}>
          {message}
        </div>
      )}

      {/* Items List Area */}
      <div className="items-list-container">
        <div className="items-table-wrapper">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px', fontWeight: 'bold', color: '#1f4fb2' }}>
              Loading item database...
            </div>
          ) : filteredItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#777' }}>
              No matching items found.
            </div>
          ) : (
            <table className="items-data-table">
              <thead>
                <tr>
                  <th style={{ width: '50px', textAlign: 'center' }}>S.No</th>
                  <th style={{ width: '100px' }}>Code</th>
                  <th>Item Name</th>
                  <th>Print Name</th>
                  <th>Item Group</th>
                  <th style={{ width: '100px' }}>Type</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Tax %</th>
                  <th style={{ width: '100px' }}>HSN Code</th>
                  <th style={{ width: '360px' }}>Lab Parameters Selection &amp; Actions</th>
                  <th style={{ width: '220px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, index) => {
                  const parsed = parseLabParameters(item.lab_parameters);
                  const activeCategories = parsed.categories || [];

                  return (
                    <tr key={item.item_code}>
                      {/* S.No */}
                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#555' }}>{index + 1}</td>
                      
                      {/* Item Code */}
                      <td style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#1f4fb2' }}>{item.item_code || '-'}</td>
                      
                      {/* Item Name */}
                      <td style={{ fontWeight: 'bold' }}>{item.item_name}</td>
                      
                      {/* Print Name */}
                      <td style={{ italic: 'true', color: '#666' }}>{item.print_name || '-'}</td>
                      
                      {/* Item Group */}
                      <td>{getGroupName(item.item_group)}</td>
                      
                      {/* Type */}
                      <td>
                        <span className={`type-badge ${item.type || 'Urad'}`}>
                          {item.type || 'Urad'}
                        </span>
                      </td>
                      
                      {/* Tax */}
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{item.tax !== undefined ? `${item.tax}%` : '0%'}</td>
                      
                      {/* HSN Code */}
                      <td style={{ fontFamily: 'monospace' }}>{item.hsn_code || '-'}</td>
                      
                      {/* Inline Lab Categories Toggle */}
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
                          {['Physical', 'Chemical', 'Microbiology'].map(cat => {
                            const isActive = activeCategories.includes(cat);
                            return (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => handleToggleCategory(item, cat)}
                                className={`lab-badge ${isActive ? `active-${cat}` : ''}`}
                              >
                                {isActive ? '✓' : '+'} {cat}
                              </button>
                            );
                          })}
                          
                          {activeCategories.length > 0 && (
                            <button
                              type="button"
                              onClick={() => handleOpenSpecsModal(item)}
                              className="inline-specs-btn"
                              title="Set limits for active parameters"
                            >
                              ⚙ Specs
                            </button>
                          )}
                        </div>
                      </td>
                      
                      {/* Row Actions */}
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          onClick={() => handleOpenPrintPreview(item)}
                          className="action-btn print-btn"
                        >
                          Print
                        </button>
                        <button 
                          onClick={() => handleEditItem(item)}
                          className="action-btn update-btn"
                        >
                          Update
                        </button>
                        <button 
                          onClick={() => setDeleteConfirmItem(item)}
                          className="action-btn delete-btn"
                          disabled={deleting}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Footer statistics block */}
      <div className="footer-bar no-print" style={{ margin: '10px' }}>
        <div>Filtered Items: {filteredItems.length}</div>
        <div>Total Records: {items.length}</div>
      </div>

      {/* =========================================
          SPECIFICATIONS MODAL (EDITOR)
          ========================================= */}
      {specModalOpen && currentEditingItem && (
        <div className="custom-modal-overlay">
          <div className="custom-modal" style={{ width: '840px', maxHeight: '85vh' }}>
            <div className="custom-modal-header">
              <div>Configure Lab Quality Parameters for: {currentEditingItem.item_name}</div>
              <button onClick={() => setSpecModalOpen(false)}>&times;</button>
            </div>
            
            <div className="custom-modal-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ fontSize: '13px', color: '#666', fontWeight: '500' }}>
                  Define testing standards, category groups, reference ranges, units, and test methodologies.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const newKey = 'custom_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
                    setCurrentSpecs(prev => ({
                      ...prev,
                      [newKey]: {
                        parameter: 'New Parameter',
                        category: 'Physical',
                        min: '',
                        max: '',
                        unit: '',
                        method: ''
                      }
                    }));
                  }}
                  style={{
                    backgroundColor: '#1f4fb2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                >
                  + Add Parameter Row
                </button>
              </div>

              <div className="specs-grid-header" style={{ gridTemplateColumns: '2.5fr 1.5fr 1.2fr 1.2fr 1fr 1.8fr 0.6fr' }}>
                <div>Parameter Name</div>
                <div>Category</div>
                <div>Min Limit</div>
                <div>Max Limit</div>
                <div>Unit</div>
                <div>Method</div>
                <div style={{ textAlign: 'center' }}>Remove</div>
              </div>
              
              <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                {Object.keys(currentSpecs).map(key => {
                  const spec = currentSpecs[key];
                  return (
                    <div key={key} className="specs-grid-row" style={{ gridTemplateColumns: '2.5fr 1.5fr 1.2fr 1.2fr 1fr 1.8fr 0.6fr' }}>
                      <div>
                        <input 
                          type="text" 
                          value={spec.parameter || ''}
                          onChange={(e) => handleSpecFieldChange(key, 'parameter', e.target.value)}
                          placeholder="Parameter Name"
                          style={{ fontWeight: 'bold' }}
                        />
                      </div>
                      <div>
                        <select
                          value={spec.category || 'Physical'}
                          onChange={(e) => handleSpecFieldChange(key, 'category', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '4px 6px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            fontSize: '12px',
                            boxSizing: 'border-box',
                            backgroundColor: 'white'
                          }}
                        >
                          <option value="Physical">Physical</option>
                          <option value="Chemical">Chemical</option>
                          <option value="Microbiology">Microbiology</option>
                        </select>
                      </div>
                      <div>
                        <input 
                          type="number" 
                          step="any"
                          value={spec.min ?? ''}
                          onChange={(e) => handleSpecFieldChange(key, 'min', e.target.value === '' ? '' : parseFloat(e.target.value))}
                        />
                      </div>
                      <div>
                        <input 
                          type="number" 
                          step="any"
                          value={spec.max ?? ''}
                          onChange={(e) => handleSpecFieldChange(key, 'max', e.target.value === '' ? '' : parseFloat(e.target.value))}
                        />
                      </div>
                      <div>
                        <input 
                          type="text" 
                          value={spec.unit || ''}
                          onChange={(e) => handleSpecFieldChange(key, 'unit', e.target.value)}
                        />
                      </div>
                      <div>
                        <input 
                          type="text" 
                          value={spec.method || ''}
                          onChange={(e) => handleSpecFieldChange(key, 'method', e.target.value)}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentSpecs(prev => {
                              const copy = { ...prev };
                              delete copy[key];
                              return copy;
                            });
                          }}
                          style={{
                            background: '#ffebee',
                            color: '#c62828',
                            border: '1px solid #ffcdd2',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            padding: '2px 8px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="custom-modal-footer">
              <button 
                onClick={() => setSpecModalOpen(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveSpecs}
                className="btn-primary"
              >
                Save Specs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================
          PRINT PREVIEW MODAL
          ========================================= */}
      {printModalOpen && printItem && (
        <div className="custom-modal-overlay print-overlay">
          <div className="custom-modal" style={{ width: '800px', maxHeight: '90vh' }}>
            <div className="custom-modal-header no-print">
              <div>Lab Quality Specifications Document</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={handlePrintAction}
                  style={{ background: '#4caf50', border: '1px solid #3d8b40', padding: '4px 12px', fontSize: '12px', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}
                >
                  🖨 Print Sheet
                </button>
                <button onClick={() => setPrintModalOpen(false)} style={{ fontSize: '18px' }}>&times;</button>
              </div>
            </div>

            <div className="custom-modal-body">
              <div className="printable-content-box">
                {/* Company Logo Header */}
                <div className="printable-header">
                  <h1>BVC EXPORTS PVT LTD</h1>
                  <p>LABORATORY TESTING &amp; QUALITY STANDARDS DIVISION</p>
                  <p>Ref: BVC-QLT-STD-09 | ISO 9001:2015 CERTIFIED</p>
                </div>

                {/* Subtitle */}
                <div className="printable-section-title">
                  LABORATORY PARAMETER QUALITY SPECIFICATIONS SHEET
                </div>

                {/* Item Details */}
                <div className="printable-info-grid">
                  <div className="info-item">
                    <label>Item Code / Catalog ID</label>
                    <span>{printItem.item_code || '-'}</span>
                  </div>
                  <div className="info-item">
                    <label>Official Registered Name</label>
                    <span>{printItem.item_name}</span>
                  </div>
                  <div className="info-item">
                    <label>Invoice Label Name</label>
                    <span>{printItem.print_name || printItem.item_name}</span>
                  </div>
                  <div className="info-item">
                    <label>Commodity Group</label>
                    <span>{getGroupName(printItem.item_group)}</span>
                  </div>
                  <div className="info-item">
                    <label>Filing Category Type</label>
                    <span>{printItem.type || 'Urad'}</span>
                  </div>
                  <div className="info-item">
                    <label>Tax Rate &amp; HSN Code</label>
                    <span>{printItem.tax !== undefined ? `${printItem.tax}%` : '0%'} | HSN: {printItem.hsn_code || 'N/A'}</span>
                  </div>
                </div>

                {/* Parameters & Tolerances list */}
                <div>
                  <h3 style={{ fontSize: '12px', fontWeight: 'bold', margin: '15px 0 5px 0', textTransform: 'uppercase', color: '#333' }}>
                    Target Quality Bounds &amp; Reference Methods
                  </h3>
                  
                  {(() => {
                    const pObj = parseLabParameters(printItem.lab_parameters);
                    const specs = pObj.specs || {};
                    const specKeys = Object.keys(specs);

                    if (specKeys.length === 0) {
                      return (
                        <div style={{ textAlign: 'center', padding: '15px', border: '1px dashed #777', color: '#777', fontSize: '12px' }}>
                          No quality parameters or specification bounds have been configured for this item.
                        </div>
                      );
                    }

                    return (
                      <table className="print-table">
                        <thead>
                          <tr>
                            <th>Testing Parameter</th>
                            <th>Category</th>
                            <th style={{ textAlignment: 'center' }}>Min Bound</th>
                            <th style={{ textAlignment: 'center' }}>Max Bound</th>
                            <th style={{ textAlignment: 'center' }}>Unit</th>
                            <th>Reference Standard Method</th>
                          </tr>
                        </thead>
                        <tbody>
                          {specKeys.map(key => {
                            const s = specs[key];
                            return (
                              <tr key={key}>
                                <td style={{ fontWeight: 'bold' }}>{s.parameter}</td>
                                <td>{s.category}</td>
                                <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{s.min !== undefined && s.min !== '' ? s.min : '-'}</td>
                                <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{s.max !== undefined && s.max !== '' ? s.max : '-'}</td>
                                <td style={{ textAlign: 'center' }}>{s.unit || '-'}</td>
                                <td style={{ fontFamily: 'monospace', fontSize: '10px' }}>{s.method || '-'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>

                {/* Stamp & Verification signatures */}
                <div className="printable-signoffs">
                  <div className="signoff-box">
                    <div className="signoff-line"></div>
                    <span>Prepared By</span>
                  </div>
                  <div className="signoff-box">
                    <div className="signoff-line"></div>
                    <span>QC Analyst</span>
                  </div>
                  <div className="signoff-box">
                    <div className="signoff-line"></div>
                    <span>Authorized Quality Head</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="custom-modal-footer no-print">
              <button 
                onClick={() => setPrintModalOpen(false)}
                className="btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {deleteConfirmItem && (
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
              Are you sure you want to delete this item?
              {deleteConfirmItem.item_name && (
                <div style={{ marginTop: '12px', padding: '10px 12px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '4px', fontWeight: 'bold', color: '#991b1b', wordBreak: 'break-all' }}>
                  "{deleteConfirmItem.item_name}"
                </div>
              )}
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
                onClick={() => setDeleteConfirmItem(null)}
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
                  const targetItem = deleteConfirmItem;
                  setDeleteConfirmItem(null);
                  await handleDeleteItem(targetItem);
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
    </div>
  );
};

export default ItemDisplay;
