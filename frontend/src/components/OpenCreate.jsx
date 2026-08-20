import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import './OpenCreate.css';

const OpenCreate = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');

  const [formData, setFormData] = useState({
    s_no: '',
    date: new Date().toISOString().split('T')[0],
    type: 'Others',
    papad_comp: '',
    remarks: '',
  });

  const [items, setItems] = useState([
    { lot_no: '', item_name: '', weight: '', qty: '', tot_wt: '', rate: '' }
  ]);

  const [masterItems, setMasterItems] = useState([]);
  const [masterPapadCompanies, setMasterPapadCompanies] = useState([]);
  const [masterWeights, setMasterWeights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  // Fetch all required masters and details
  useEffect(() => {
    const fetchMasters = async () => {
      setLoading(true);
      try {
        const [itemsRes, compRes, weightRes] = await Promise.all([
          api('/masters/items'),
          api('/masters/papad_companies'),
          api('/masters/weights')
        ]);

        if (itemsRes) setMasterItems(Array.isArray(itemsRes) ? itemsRes : itemsRes.data || []);
        if (compRes) setMasterPapadCompanies(Array.isArray(compRes) ? compRes : compRes.data || []);
        if (weightRes) setMasterWeights(Array.isArray(weightRes) ? weightRes : weightRes.data || []);
        
        if (editId) {
          // Fetch existing record for edit mode
          const recordRes = await api(`/open/${editId}`);
          if (recordRes) {
            setFormData({
              s_no: recordRes.s_no || '',
              date: recordRes.date || new Date().toISOString().split('T')[0],
              type: recordRes.type || 'Others',
              papad_comp: recordRes.papad_comp || '',
              remarks: recordRes.remarks || '',
            });
            if (recordRes.items && recordRes.items.length > 0) {
              setItems(recordRes.items.map(item => ({
                lot_no: item.lot_no || '',
                item_name: item.item_name || '',
                weight: item.weight || '',
                qty: item.qty || '',
                tot_wt: item.tot_wt || '',
                rate: item.rate || item.cost || '',
              })));
            }
          }
        } else {
          // Fetch next S.No for creation mode
          const snoRes = await api('/open/next-sno');
          if (snoRes && snoRes.success) {
            setFormData(prev => ({ ...prev, s_no: String(snoRes.next_sno) }));
          }
        }
      } catch (err) {
        console.error('Error fetching masters or record:', err);
        setMessage('Failed to load initial master lists or record details.');
        setMessageType('error');
      } finally {
        setLoading(false);
      }
    };

    fetchMasters();
  }, [editId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const getWeightFactor = (weightName) => {
    const match = masterWeights.find(w => w.name === weightName || w.printname === weightName);
    if (match && match.weight !== undefined) return parseFloat(match.weight);
    
    if (!weightName) return 1;
    const num = parseFloat(weightName);
    if (isNaN(num)) return 1;
    if (weightName.toLowerCase().includes('gm') && !weightName.toLowerCase().includes('kg')) {
      return num / 1000;
    }
    return num;
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...items];
    updatedItems[index][field] = value;

    // Auto-calculate Tot Wt when qty or weight changes
    if (field === 'qty' || field === 'weight') {
      const qty = parseFloat(updatedItems[index].qty) || 0;
      const weightFactor = getWeightFactor(updatedItems[index].weight);
      updatedItems[index].tot_wt = (qty * weightFactor).toFixed(2);
    }

    setItems(updatedItems);
  };

  const addRow = () => {
    setItems(prev => [...prev, { lot_no: '', item_name: '', weight: '', qty: '', tot_wt: '', rate: '' }]);
  };

  const removeRow = (index) => {
    if (items.length === 1) {
      setItems([{ lot_no: '', item_name: '', weight: '', qty: '', tot_wt: '', rate: '' }]);
    } else {
      setItems(prev => prev.filter((_, idx) => idx !== index));
    }
  };

  const handleSave = async () => {
    if (!formData.s_no) {
      setMessage('S.No is required.');
      setMessageType('error');
      return;
    }
    if (!formData.date) {
      setMessage('Date is required.');
      setMessageType('error');
      return;
    }

    // Filter out rows with empty item_name
    const validItems = items.filter(i => i.item_name.trim() !== '');
    if (validItems.length === 0) {
      setMessage('At least one item with a valid name is required.');
      setMessageType('error');
      return;
    }

    setSaveLoading(true);
    setMessage('');

    try {
      const payload = {
        ...formData,
        items: validItems.map(item => ({
          ...item,
          qty: parseFloat(item.qty) || 0,
          tot_wt: parseFloat(item.tot_wt) || 0,
          rate: parseFloat(item.rate) || 0
        }))
      };

      let result;
      if (editId) {
        result = await api(`/open/${editId}`, {
          method: 'PUT',
          body: payload
        });
      } else {
        result = await api('/open', {
          method: 'POST',
          body: payload
        });
      }

      if (result && (result.success || result.id || result.message?.includes('successfully'))) {
        setMessage(editId ? 'Opening Entry updated successfully!' : 'Opening Entry created successfully!');
        setMessageType('success');
        setTimeout(() => {
          navigate('/entry/open-display');
        }, 1500);
      } else {
        setMessage(result?.message || 'Error saving Opening Entry');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error saving Opening Entry:', error);
      setMessage('Error saving Opening Entry: ' + error.message);
      setMessageType('error');
    } finally {
      setSaveLoading(false);
    }
  };

  // Grand totals
  const totalQty = items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
  const totalWeight = items.reduce((sum, item) => sum + (parseFloat(item.tot_wt) || 0), 0);

  if (loading) {
    return (
      <div className="window" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f4fb2' }}>Loading Opening Entry Details...</div>
      </div>
    );
  }

  return (
    <div className="window">
      <div className="window-box">
        {/* Header Title Bar */}
        <div className="screen-title">{editId ? 'Opening Entry Modification' : 'Opening Creation'}</div>

        {/* Alerts */}
        {message && (
          <div className={`message ${messageType === 'success' ? 'success' : 'error'}`}>
            <span>{messageType === 'success' ? '✓' : '⚠'}</span>
            <span>{message}</span>
          </div>
        )}

        <div className="section-container">
          {/* Top Frame Grid Fields */}
          <div className="info-bar">
            <div className="column">
              <div className="field-group">
                <label>S.No</label>
                <input
                  type="text"
                  name="s_no"
                  value={formData.s_no}
                  onChange={handleChange}
                  disabled
                />
              </div>
            </div>

            <div className="column">
              <div className="field-group">
                <label>Type</label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                >
                  <option value="Others">Others</option>
                  <option value="Urad">Urad</option>
                  <option value="Moong">Moong</option>
                  <option value="Chana">Chana</option>
                  <option value="Toor">Toor</option>
                </select>
              </div>
            </div>

            <div className="column">
              <div className="field-group">
                <label>Papad Company</label>
                <select
                  name="papad_comp"
                  value={formData.papad_comp}
                  onChange={handleChange}
                >
                  <option value="">-- Select Company --</option>
                  {masterPapadCompanies.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="column">
              <div className="field-group">
                <label>Date</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          {/* Grid / Items Table */}
          <div style={{ marginTop: '20px' }}>
            <div className="grid-header-row">
              <span className="grid-title">Item Details Grid</span>
              <button
                type="button"
                onClick={addRow}
                className="btn-add-row"
              >
                + Add Item
              </button>
            </div>

            <div className="table-wrapper">
              <table className="data-grid">
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                    <th style={{ width: '120px' }}>Lot No</th>
                    <th>Item Name</th>
                    <th style={{ width: '130px' }}>Weight</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>Qty</th>
                    <th style={{ width: '120px', textAlign: 'right' }}>Tot Wt (KG)</th>
                    <th style={{ width: '120px', textAlign: 'right' }}>Cost / Rate</th>
                    <th style={{ width: '60px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index}>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#64748b' }}>
                        {index + 1}
                      </td>

                      <td>
                        <input
                          type="text"
                          value={item.lot_no}
                          onChange={(e) => handleItemChange(index, 'lot_no', e.target.value)}
                          placeholder="e.g. 39"
                        />
                      </td>

                      <td>
                        <select
                          value={item.item_name}
                          onChange={(e) => handleItemChange(index, 'item_name', e.target.value)}
                        >
                          <option value="">-- Select Item --</option>
                          {masterItems.map((mi) => (
                            <option key={mi.id} value={mi.item_name}>{mi.item_name}</option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <select
                          value={item.weight}
                          onChange={(e) => handleItemChange(index, 'weight', e.target.value)}
                        >
                          <option value="">-- Weight --</option>
                          {masterWeights.map((w) => (
                            <option key={w.id} value={w.name}>{w.name}</option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <input
                          type="number"
                          value={item.qty}
                          onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                          placeholder="0.00"
                          step="any"
                          style={{ textAlign: 'right' }}
                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          value={item.tot_wt}
                          onChange={(e) => handleItemChange(index, 'tot_wt', e.target.value)}
                          placeholder="0.00"
                          step="any"
                          style={{ textAlign: 'right' }}
                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          value={item.rate}
                          onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                          placeholder="0.00"
                          step="any"
                          style={{ textAlign: 'right' }}
                        />
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => removeRow(index)}
                          className="btn-delete-row"
                          title="Remove row"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Grid Totals Display */}
          <div className="totals-summary-bar">
            <div className="totals-group">
              <div className="total-item">
                <span className="total-label">Total Quantity</span>
                <span className="total-val">{totalQty.toFixed(2)}</span>
              </div>
              <div className="total-item" style={{ borderLeft: '1px solid #cbd5e1', paddingLeft: '30px' }}>
                <span className="total-label">Total Weight (KG)</span>
                <span className="total-val weight">{totalWeight.toFixed(2)} kg</span>
              </div>
            </div>
          </div>

          {/* Remarks Bottom Field */}
          <div className="remarks-section">
            <label>Remarks / Particulars</label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              rows="2"
              placeholder="Enter optional description or particulars about this opening entry..."
            />
          </div>

          {/* Actions Save & Cancel */}
          <div className="footer-actions">
            <button
              type="button"
              onClick={() => navigate('/entry/open-display')}
              className="btn-cancel"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saveLoading}
              className="btn-save"
            >
              {saveLoading ? 'Saving...' : editId ? 'Update Opening Entry' : 'Save Opening Entry'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OpenCreate;
