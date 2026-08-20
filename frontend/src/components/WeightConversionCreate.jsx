import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './WeightConversionCreate.css';
import { api } from "../utils/api.js";

const WeightConversionCreate = () => {
  const navigate = useNavigate();
  const [sNo, setSNo] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [type, setType] = useState('Standard');

  const [availableItems, setAvailableItems] = useState([]);
  const [availableWeights, setAvailableWeights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  // Dynamic rows of conversion items (Input - Top Table)
  const [rows, setRows] = useState([
    {
      item_name: '',
      lot_no: '',
      weight: '',
      qty: '',
      total_wt: '0.00',
      available_lots: [],
      loadingLots: false
    }
  ]);

  // Dynamic rows of converted items (Output - Bottom Table)
  const [outputRows, setOutputRows] = useState([
    {
      item_name: '',
      weight: '',
      qty: '',
      total_wt: '0.00'
    }
  ]);

  // Extract weight from item name string if present (e.g. "Urad Dhall 25 KG" -> 25)
  const extractWeightFromItemName = (name) => {
    if (!name) return 0;
    const str = String(name).trim();
    const match = str.match(/(\d+(?:\.\d+)?)\s*(-|_)?\s*(KG|GM|KGS|GMS)/i);
    if (match) {
      let val = parseFloat(match[1]);
      let unit = match[3].toUpperCase();
      if (unit.includes('GM')) return val / 1000;
      return val;
    }
    const lower = str.toLowerCase();
    if (lower.includes('bgf') || lower.includes('black gram flour') || lower.includes('bg flour') || lower.includes('b.g.f')) {
      return 30;
    }
    if (lower.includes('papad')) {
      return 25;
    }
    const numberMatch = str.match(/(?:^|\s|-|_)(100|50|30|25|20|10|5|1)(?:\s|-|_|$)/);
    if (numberMatch) {
      return parseFloat(numberMatch[1]);
    }
    return 0;
  };

  const parseWeightValue = (weightStr) => {
    if (!weightStr) return 0;
    const num = parseFloat(weightStr);
    if (isNaN(num)) return 0;
    if (weightStr.toUpperCase().includes('GM')) {
      return num / 1000; // Convert GM to KG
    }
    return num; // Default assumes KG
  };

  // Fetch next sequential S.No or load record if editing
  const queryParams = new URLSearchParams(window.location.search);
  const editId = queryParams.get('id');

  useEffect(() => {
    const initData = async () => {
      try {
        if (editId) {
          const res = await fetch(`/api/weight-conversion/${editId}`);
          if (res.ok) {
            const data = await res.json();
            setSNo(String(data.s_no || ''));
            setDate(data.date || new Date().toISOString().split('T')[0]);
            setRemarks(data.remarks || '');
            setType(data.type || 'Standard');

            const items = data.items || [];
            const inputItems = items.filter(i => (i.type || 'input') === 'input');
            const outputItems = items.filter(i => i.type === 'output');

            if (inputItems.length > 0) {
              const loadedInputRows = await Promise.all(inputItems.map(async (i) => {
                let lots = [];
                if (i.item_name) {
                  try {
                    const lotsRes = await api('db/query', {
                      method: 'POST',
                      body: {
                        sql: `
                          SELECT 
                            sl.id,
                            sl.item_name,
                            sl.lot_no,
                            sl.remaining_quantity,
                            sl.rate,
                            sl.created_at,
                            COALESCE(
                              (SELECT ROUND(ABS(s.weight) / ABS(s.qty), 2) FROM stock s WHERE s.lot_no = sl.lot_no AND COALESCE(s.qty, 0) != 0 AND COALESCE(s.weight, 0) != 0 LIMIT 1),
                              (SELECT ROUND(ABS(s.weight) / ABS(s.qty), 2) FROM stock s WHERE LOWER(s.item_name) = LOWER(sl.item_name) AND COALESCE(s.qty, 0) != 0 AND COALESCE(s.weight, 0) != 0 LIMIT 1),
                              (SELECT CASE WHEN COALESCE(oi.qty, 0) != 0 AND COALESCE(oi.weight, 0) > 0 THEN ROUND(oi.weight / oi.qty, 2) ELSE COALESCE(oi.weight, 0) END FROM open_items oi WHERE oi.lot_no = sl.lot_no OR LOWER(oi.item_name) = LOWER(sl.item_name) LIMIT 1),
                              (SELECT wci.weight FROM weight_conversion_items wci WHERE wci.lot_no = sl.lot_no AND wci.weight > 0 LIMIT 1),
                              (SELECT wm.weight FROM weightmaster wm WHERE (LOWER(sl.item_name) LIKE '%' || LOWER(wm.name) || '%' OR LOWER(wm.name) LIKE '%' || LOWER(sl.item_name) || '%') AND wm.weight > 0 LIMIT 1),
                              0
                            ) AS per_unit_weight
                          FROM stock_lots sl
                          WHERE sl.item_name = ?
                          GROUP BY sl.lot_no
                          ORDER BY sl.created_at ASC
                        `,
                        params: [i.item_name]
                      }
                    });
                    if (Array.isArray(lotsRes)) lots = lotsRes;
                  } catch (e) {
                    console.error('Error fetching lots for edit row:', e);
                  }
                }
                return {
                  item_name: i.item_name || '',
                  lot_no: i.lot_no || '',
                  weight: String(i.weight || ''),
                  qty: String(i.qty || ''),
                  total_wt: parseFloat(i.total_wt || 0).toFixed(2),
                  available_lots: lots,
                  loadingLots: false
                };
              }));
              setRows(loadedInputRows);
            }

            if (outputItems.length > 0) {
              setOutputRows(outputItems.map(i => ({
                item_name: i.item_name || '',
                weight: String(i.weight || ''),
                qty: String(i.qty || ''),
                total_wt: parseFloat(i.total_wt || 0).toFixed(2)
              })));
            }
          }
        } else {
          const result = await api('db/query', {
            method: 'POST',
            body: {
              sql: 'SELECT MAX(CAST(s_no AS INTEGER)) as max_sno FROM weight_conversion',
              params: []
            }
          });
          const maxSNo = (result && result[0] && result[0].max_sno) || 0;
          setSNo(String(parseInt(maxSNo) + 1));
        }

        const itemsRes = await api('db/query', {
          method: 'POST',
          body: {
            sql: `
              SELECT DISTINCT item_name FROM (
                SELECT item_name FROM item_master WHERE status = 'Active' OR status = 'active'
                UNION
                SELECT item_name FROM stock_lots WHERE remaining_quantity > 0
              ) ORDER BY item_name ASC
            `,
            params: []
          }
        });
        if (Array.isArray(itemsRes)) {
          setAvailableItems(itemsRes.map(r => r.item_name));
        }

        const weightsRes = await api('db/query', {
          method: 'POST',
          body: {
            sql: "SELECT name FROM weightmaster WHERE status = 'Active' OR status = 'active' ORDER BY name ASC",
            params: []
          }
        });
        if (Array.isArray(weightsRes)) {
          setAvailableWeights(weightsRes.map(r => r.name));
        } else {
          setAvailableWeights(['1 KG', '500 GM', '1 GM', '25 KG', '50 KG']);
        }
      } catch (err) {
        console.error('Failed to initialize data:', err);
      }
    };
    initData();
  }, [editId]);

  // Handle item name selection for a specific row
  const handleRowItemSelect = async (index, itemName) => {
    const updatedRows = [...rows];
    updatedRows[index].item_name = itemName;
    updatedRows[index].lot_no = '';
    updatedRows[index].weight = '';
    updatedRows[index].qty = '';
    updatedRows[index].total_wt = '0.00';
    updatedRows[index].available_lots = [];
    
    if (!itemName) {
      setRows(updatedRows);
      return;
    }

    updatedRows[index].loadingLots = true;
    setRows(updatedRows);

    try {
      let result = await api('db/query', {
        method: 'POST',
        body: {
          sql: `
            SELECT 
              sl.id,
              sl.item_name,
              sl.lot_no,
              sl.remaining_quantity,
              sl.rate,
              sl.created_at,
              COALESCE(
                (SELECT ROUND(ABS(s.weight) / ABS(s.qty), 2) FROM stock s WHERE s.lot_no = sl.lot_no AND COALESCE(s.qty, 0) != 0 AND COALESCE(s.weight, 0) != 0 LIMIT 1),
                (SELECT ROUND(ABS(s.weight) / ABS(s.qty), 2) FROM stock s WHERE LOWER(s.item_name) = LOWER(sl.item_name) AND COALESCE(s.qty, 0) != 0 AND COALESCE(s.weight, 0) != 0 LIMIT 1),
                (SELECT CASE WHEN COALESCE(oi.qty, 0) != 0 AND COALESCE(oi.weight, 0) > 0 THEN ROUND(oi.weight / oi.qty, 2) ELSE COALESCE(oi.weight, 0) END FROM open_items oi WHERE oi.lot_no = sl.lot_no OR LOWER(oi.item_name) = LOWER(sl.item_name) LIMIT 1),
                (SELECT wci.weight FROM weight_conversion_items wci WHERE wci.lot_no = sl.lot_no AND wci.weight > 0 LIMIT 1),
                (SELECT wm.weight FROM weightmaster wm WHERE (LOWER(sl.item_name) LIKE '%' || LOWER(wm.name) || '%' OR LOWER(wm.name) LIKE '%' || LOWER(sl.item_name) || '%') AND wm.weight > 0 LIMIT 1),
                0
              ) AS per_unit_weight
            FROM stock_lots sl
            WHERE (sl.item_name = ? OR sl.item_name LIKE ? OR LOWER(sl.item_name) = LOWER(?))
            GROUP BY sl.lot_no
            ORDER BY sl.created_at DESC
          `,
          params: [itemName, `%${itemName}%`, itemName]
        }
      });

      if (!result || !Array.isArray(result) || result.length === 0) {
        result = await api('db/query', {
          method: 'POST',
          body: {
            sql: `
              SELECT 
                sl.id,
                sl.item_name,
                sl.lot_no,
                sl.remaining_quantity,
                sl.rate,
                sl.created_at,
                0 AS per_unit_weight
              FROM stock_lots sl
              WHERE sl.lot_no IS NOT NULL AND sl.lot_no != ''
              GROUP BY sl.lot_no
              ORDER BY sl.created_at DESC
              LIMIT 50
            `,
            params: []
          }
        });
      }

      const freshRows = [...rows];
      if (Array.isArray(result)) {
        freshRows[index].available_lots = result;
      } else {
        freshRows[index].available_lots = [];
      }
      freshRows[index].loadingLots = false;
      setRows(freshRows);
    } catch (error) {
      console.error('Error fetching available lots for row:', error);
      const freshRows = [...rows];
      freshRows[index].loadingLots = false;
      setRows(freshRows);
    }
  };

  // Handle lot selection for a specific row - "fills the box"
  const handleRowLotSelect = (index, lotNo) => {
    const updatedRows = [...rows];
    const selectedLotObj = updatedRows[index].available_lots.find(l => l.lot_no === lotNo);
    
    if (selectedLotObj) {
      updatedRows[index].lot_no = lotNo;
      const dbWeight = parseFloat(selectedLotObj.per_unit_weight) || 0;
      const extractedWeight = extractWeightFromItemName(selectedLotObj.item_name) || extractWeightFromItemName(updatedRows[index].item_name) || extractWeightFromItemName(lotNo);
      let parsedWeight = dbWeight || extractedWeight || 0;
      if (!parsedWeight || parsedWeight === 0) {
        const lowerName = (selectedLotObj.item_name || updatedRows[index].item_name || '').toLowerCase();
        if (lowerName.includes('bgf') || lowerName.includes('black gram flour') || lowerName.includes('bg flour') || lowerName.includes('b.g.f')) {
          parsedWeight = 30;
        } else if (lowerName.includes('papad')) {
          parsedWeight = 25;
        } else {
          parsedWeight = 50;
        }
      }
      const parsedQty = parseFloat(selectedLotObj.remaining_quantity) || 0;
      
      updatedRows[index].weight = String(parsedWeight);
      updatedRows[index].qty = String(parsedQty);
      updatedRows[index].total_wt = (parsedQty * parsedWeight).toFixed(2);
    } else {
      updatedRows[index].lot_no = '';
      updatedRows[index].weight = '';
      updatedRows[index].qty = '';
      updatedRows[index].total_wt = '0.00';
    }
    setRows(updatedRows);
  };

  // Handle direct manual entry of weight or qty on a row
  const handleRowValueChange = (index, field, value) => {
    const updatedRows = [...rows];
    updatedRows[index][field] = value;

    const qty = parseFloat(updatedRows[index].qty) || 0;
    const weightNum = parseFloat(updatedRows[index].weight) || 0;
    updatedRows[index].total_wt = (qty * weightNum).toFixed(2);

    setRows(updatedRows);
  };

  // Row operations
  const addRow = () => {
    setRows([
      ...rows,
      {
        item_name: '',
        lot_no: '',
        weight: '',
        qty: '',
        total_wt: '0.00',
        available_lots: [],
        loadingLots: false
      }
    ]);
  };

  const deleteRow = (index) => {
    if (rows.length > 1) {
      setRows(rows.filter((_, idx) => idx !== index));
    } else {
      // Just clear the single row
      setRows([
        {
          item_name: '',
          lot_no: '',
          weight: '',
          qty: '',
          total_wt: '0.00',
          available_lots: [],
          loadingLots: false
        }
      ]);
    }
  };

  const addOutputRow = () => {
    setOutputRows([
      ...outputRows,
      {
        item_name: '',
        weight: '',
        qty: '',
        total_wt: '0.00'
      }
    ]);
  };

  const deleteOutputRow = (index) => {
    if (outputRows.length > 1) {
      setOutputRows(outputRows.filter((_, idx) => idx !== index));
    } else {
      setOutputRows([
        {
          item_name: '',
          weight: '',
          qty: '',
          total_wt: '0.00'
        }
      ]);
    }
  };

  const handleOutputRowChange = (index, field, value) => {
    const updatedOutputRows = [...outputRows];
    updatedOutputRows[index][field] = value;

    // Recalculate total weight
    const qty = parseFloat(updatedOutputRows[index].qty) || 0;
    const weightStr = updatedOutputRows[index].weight;
    const weightNum = parseWeightValue(weightStr);
    updatedOutputRows[index].total_wt = (qty * weightNum).toFixed(2);

    setOutputRows(updatedOutputRows);
  };

  const summaryQty = rows.reduce((sum, row) => sum + (parseFloat(row.qty) || 0), 0);
  const summaryTotWt = rows.reduce((sum, row) => sum + (parseFloat(row.total_wt) || 0), 0);

  const outputSummaryQty = outputRows.reduce((sum, row) => sum + (parseFloat(row.qty) || 0), 0);
  const outputSummaryTotWt = outputRows.reduce((sum, row) => sum + (parseFloat(row.total_wt) || 0), 0);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!date) {
      setMessage('Date is required');
      setMessageType('error');
      return;
    }

    const validItems = rows.filter(row => row.item_name && parseFloat(row.qty) > 0).map(row => ({
      item_name: row.item_name,
      lot_no: row.lot_no,
      weight: parseFloat(row.weight) || 0,
      qty: parseFloat(row.qty) || 0,
      total_wt: parseFloat(row.total_wt) || 0,
      type: 'input'
    }));

    const validOutputItems = outputRows.filter(row => row.item_name && parseFloat(row.qty) > 0).map(row => {
      const weightNum = parseWeightValue(row.weight);
      return {
        item_name: row.item_name,
        lot_no: '',
        weight: weightNum,
        qty: parseFloat(row.qty) || 0,
        total_wt: parseFloat(row.total_wt) || 0,
        type: 'output'
      };
    });

    const allItems = [...validItems, ...validOutputItems];

    if (allItems.length === 0) {
      setMessage('At least one input or output item with quantity greater than zero is required');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const payload = {
        formData: {
          sNo: sNo || null,
          date: date,
          remarks: remarks,
          type: type
        },
        items: allItems
      };

      const endpoint = editId ? `/weight-conversion/${editId}` : '/weight-conversion';
      const method = editId ? 'PUT' : 'POST';

      const result = await api(endpoint, {
        method: method,
        body: payload
      });

      if (result && (result.message || result.success !== false)) {
        setMessage(editId ? 'Weight conversion updated successfully!' : 'Weight conversion saved successfully!');
        setMessageType('success');
        
        // Reset state
        setRows([
          {
            item_name: '',
            lot_no: '',
            weight: '',
            qty: '',
            total_wt: '0.00',
            available_lots: [],
            loadingLots: false
          }
        ]);
        setOutputRows([
          {
            item_name: '',
            weight: '',
            qty: '',
            total_wt: '0.00'
          }
        ]);
        setRemarks('');
        setType('Standard');

        // Fetch next S.No
        const nextResult = await api('db/query', {
          method: 'POST',
          body: {
            sql: 'SELECT MAX(CAST(s_no AS INTEGER)) as max_sno FROM weight_conversion',
            params: []
          }
        });
        const maxSNo = (nextResult && nextResult[0] && nextResult[0].max_sno) || 0;
        setSNo(String(parseInt(maxSNo) + 1));

        setTimeout(() => {
          setMessage('');
          navigate('/entry/weight-conversion-display');
        }, 1500);
      }
    } catch (error) {
      setMessage('Error saving weight conversion: ' + error.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="window" id="weight-conversion-window">
      <div className="title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Weight Conversion Creation</span>
        <button id="close-conversion-btn" style={{ background: 'none', border: 'none', color: '#fff', fontSize: '18px', cursor: 'pointer', padding: 0 }} onClick={() => navigate('/entry/weight-conversion-display')}>X</button>
      </div>

      {message && <div className={`message ${messageType}`} style={{ padding: '10px', margin: '10px', borderRadius: '4px', background: messageType === 'success' ? '#def7ec' : '#fde8e8', color: messageType === 'success' ? '#03543f' : '#9b1c1c', border: `1px solid ${messageType === 'success' ? '#31c48d' : '#f98080'}` }}>{message}</div>}

      <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', padding: '15px', borderBottom: '1px solid #9bb4e0' }}>
        <div className="left-side">
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <label style={{ width: '80px', fontWeight: 'bold' }}>S.No :</label>
            <input type="text" value={sNo} readOnly style={{ flex: 1, height: '28px', padding: '4px', background: '#eef2f9', cursor: 'not-allowed', marginLeft: '10px' }} />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center' }}>
            <label style={{ width: '80px', fontWeight: 'bold' }}>Date :</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ flex: 1, height: '28px', padding: '4px', marginLeft: '10px' }} />
          </div>
        </div>
        <div className="right-side">
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <label style={{ width: '80px', fontWeight: 'bold' }}>Remarks :</label>
            <input type="text" value={remarks} onChange={(e) => setRemarks(e.target.value)} style={{ flex: 1, height: '28px', padding: '4px', marginLeft: '10px' }} />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center' }}>
            <label style={{ width: '80px', fontWeight: 'bold' }}>Type :</label>
            <input type="text" value={type} onChange={(e) => setType(e.target.value)} placeholder="e.g. Urad, Standard" style={{ flex: 1, height: '28px', padding: '4px', marginLeft: '10px' }} />
          </div>
        </div>
      </div>

      <div style={{ padding: '15px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '12px', fontSize: '18px', color: '#1f4fa3' }}>Conversion Item Details</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
          <thead>
            <tr style={{ background: '#3f6fc0', color: '#fff' }}>
              <th style={{ border: '1px solid #9bb4e0', padding: '10px', width: '50px', textAlign: 'center' }}>S.No</th>
              <th style={{ border: '1px solid #9bb4e0', padding: '10px', textAlign: 'left', minWidth: '180px' }}>Item Name</th>
              <th style={{ border: '1px solid #9bb4e0', padding: '10px', textAlign: 'left', minWidth: '220px' }}>Select Lot Details (Qty &amp; Wt)</th>
              <th style={{ border: '1px solid #9bb4e0', padding: '10px', width: '130px', textAlign: 'center' }}>Lot No</th>
              <th style={{ border: '1px solid #9bb4e0', padding: '10px', width: '100px', textAlign: 'center' }}>Weight (KG)</th>
              <th style={{ border: '1px solid #9bb4e0', padding: '10px', width: '100px', textAlign: 'center' }}>Qty (Bags)</th>
              <th style={{ border: '1px solid #9bb4e0', padding: '10px', width: '130px', textAlign: 'center' }}>Tot Wt (KG)</th>
              <th style={{ border: '1px solid #9bb4e0', padding: '10px', width: '80px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#f9fbff' }}>
                <td style={{ border: '1px solid #9bb4e0', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                
                {/* Item Name Dropdown */}
                <td style={{ border: '1px solid #9bb4e0', padding: '8px' }}>
                  <select 
                    value={row.item_name} 
                    onChange={(e) => handleRowItemSelect(idx, e.target.value)} 
                    style={{ width: '100%', height: '28px', padding: '2px', border: '1px solid #9bb4e0', borderRadius: '4px', outline: 'none' }}
                  >
                    <option value="">-- Select Item --</option>
                    {availableItems.map((item, itemIdx) => (
                      <option key={itemIdx} value={item}>{item}</option>
                    ))}
                  </select>
                </td>

                {/* Lot Selection with current Qty & Weight */}
                <td style={{ border: '1px solid #9bb4e0', padding: '8px' }}>
                  {row.item_name ? (
                    row.loadingLots ? (
                      <span style={{ fontSize: '12px', color: '#666' }}>Loading lots...</span>
                    ) : (
                      <select
                        value={row.lot_no}
                        onChange={(e) => handleRowLotSelect(idx, e.target.value)}
                        style={{ width: '100%', height: '28px', padding: '2px', border: '1px solid #9bb4e0', borderRadius: '4px', outline: 'none' }}
                      >
                        <option value="">-- Choose Lot (Available Lots) --</option>
                        {row.available_lots.map((lot, lotIdx) => {
                          let wt = parseFloat(lot.per_unit_weight) || extractWeightFromItemName(lot.item_name) || extractWeightFromItemName(row.item_name) || extractWeightFromItemName(lot.lot_no) || 0;
                          if (!wt || wt === 0) {
                            const lowerName = (lot.item_name || row.item_name || '').toLowerCase();
                            if (lowerName.includes('bgf') || lowerName.includes('black gram flour') || lowerName.includes('bg flour') || lowerName.includes('b.g.f')) {
                              wt = 30;
                            } else if (lowerName.includes('papad')) {
                              wt = 25;
                            } else {
                              wt = 50;
                            }
                          }
                          return (
                            <option key={lotIdx} value={lot.lot_no}>
                              {lot.lot_no} (Avail Qty: {lot.remaining_quantity} | Wt: {wt} KG)
                            </option>
                          );
                        })}
                      </select>
                    )
                  ) : (
                    <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>Select Item Name first</span>
                  )}
                </td>

                {/* Filled Lot No */}
                <td style={{ border: '1px solid #9bb4e0', padding: '8px', textAlign: 'center' }}>
                  <input 
                    type="text" 
                    value={row.lot_no} 
                    onChange={(e) => handleRowValueChange(idx, 'lot_no', e.target.value)}
                    placeholder="Lot No"
                    style={{ width: '90%', height: '26px', padding: '2px', textAlign: 'center', margin: 0, border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                </td>

                {/* Weight Input */}
                <td style={{ border: '1px solid #9bb4e0', padding: '8px', textAlign: 'center' }}>
                  <input 
                    type="number" 
                    step="any"
                    value={row.weight} 
                    onChange={(e) => handleRowValueChange(idx, 'weight', e.target.value)} 
                    style={{ width: '90%', height: '26px', padding: '2px', textAlign: 'center', margin: 0, border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                </td>

                {/* Qty Input */}
                <td style={{ border: '1px solid #9bb4e0', padding: '8px', textAlign: 'center' }}>
                  <input 
                    type="number" 
                    step="any"
                    value={row.qty} 
                    onChange={(e) => handleRowValueChange(idx, 'qty', e.target.value)} 
                    style={{ width: '90%', height: '26px', padding: '2px', textAlign: 'center', margin: 0, border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                </td>

                {/* Auto Total Weight */}
                <td style={{ border: '1px solid #9bb4e0', padding: '8px', textAlign: 'center', fontWeight: 'bold', color: '#1e3a8a' }}>
                  {row.total_wt}
                </td>

                {/* Delete row action button */}
                <td style={{ border: '1px solid #9bb4e0', padding: '8px', textAlign: 'center' }}>
                  <button 
                    type="button"
                    onClick={() => deleteRow(idx)}
                    style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Action Button Under Table */}
        <div style={{ marginBottom: '20px' }}>
          <button 
            type="button"
            onClick={addRow}
            style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '6px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            + Add New Item Row
          </button>
        </div>
      </div>

      {/* Converted/Output Items (Bottom Table) */}
      <div style={{ padding: '15px', borderTop: '2px solid #9bb4e0' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '12px', fontSize: '18px', color: '#16a34a' }}>Converted / Output Item Details</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
          <thead>
            <tr style={{ background: '#16a34a', color: '#fff' }}>
              <th style={{ border: '1px solid #9bb4e0', padding: '10px', width: '50px', textAlign: 'center' }}>S.No</th>
              <th style={{ border: '1px solid #9bb4e0', padding: '10px', textAlign: 'left', minWidth: '180px' }}>Item Name</th>
              <th style={{ border: '1px solid #9bb4e0', padding: '10px', width: '180px', textAlign: 'center' }}>Weight Dropdown</th>
              <th style={{ border: '1px solid #9bb4e0', padding: '10px', width: '150px', textAlign: 'center' }}>Qty (Bags)</th>
              <th style={{ border: '1px solid #9bb4e0', padding: '10px', width: '180px', textAlign: 'center' }}>Tot Wt (KG)</th>
              <th style={{ border: '1px solid #9bb4e0', padding: '10px', width: '80px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {outputRows.map((row, idx) => (
              <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#f4fbf7' }}>
                <td style={{ border: '1px solid #9bb4e0', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                
                {/* Item Name Dropdown */}
                <td style={{ border: '1px solid #9bb4e0', padding: '8px' }}>
                  <select 
                    value={row.item_name} 
                    onChange={(e) => handleOutputRowChange(idx, 'item_name', e.target.value)} 
                    style={{ width: '100%', height: '28px', padding: '2px', border: '1px solid #9bb4e0', borderRadius: '4px', outline: 'none' }}
                  >
                    <option value="">-- Select Item --</option>
                    {availableItems.map((item, itemIdx) => (
                      <option key={itemIdx} value={item}>{item}</option>
                    ))}
                  </select>
                </td>

                {/* Weight Dropdown */}
                <td style={{ border: '1px solid #9bb4e0', padding: '8px', textAlign: 'center' }}>
                  <select
                    value={row.weight}
                    onChange={(e) => handleOutputRowChange(idx, 'weight', e.target.value)}
                    style={{ width: '90%', height: '28px', padding: '2px', border: '1px solid #cbd5e1', borderRadius: '4px', outline: 'none' }}
                  >
                    <option value="">-- Select Weight --</option>
                    {availableWeights.map((w, wIdx) => (
                      <option key={wIdx} value={w}>{w}</option>
                    ))}
                  </select>
                </td>

                {/* Qty Input */}
                <td style={{ border: '1px solid #9bb4e0', padding: '8px', textAlign: 'center' }}>
                  <input 
                    type="number" 
                    step="any"
                    value={row.qty} 
                    onChange={(e) => handleOutputRowChange(idx, 'qty', e.target.value)} 
                    style={{ width: '90%', height: '26px', padding: '2px', textAlign: 'center', margin: 0, border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                </td>

                {/* Auto Total Weight */}
                <td style={{ border: '1px solid #9bb4e0', padding: '8px', textAlign: 'center', fontWeight: 'bold', color: '#166534' }}>
                  {row.total_wt}
                </td>

                {/* Delete row action button */}
                <td style={{ border: '1px solid #9bb4e0', padding: '8px', textAlign: 'center' }}>
                  <button 
                    type="button"
                    onClick={() => deleteOutputRow(idx)}
                    style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Action Button Under Table */}
        <div style={{ marginBottom: '20px' }}>
          <button 
            type="button"
            onClick={addOutputRow}
            style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '6px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            + Add New Output Row
          </button>
        </div>
      </div>

      {/* Totals Summary */}
      <div style={{ padding: '15px', borderTop: '1px dashed #9bb4e0', background: '#f8fafc' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '15px', fontWeight: 'bold' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '30px', color: '#1e3a8a' }}>
            <div>Total Input Qty: <span style={{ color: '#0f172a' }}>{summaryQty.toFixed(2)} Bags</span></div>
            <div>Total Input Weight: <span style={{ color: '#0f172a' }}>{summaryTotWt.toFixed(2)} KG</span></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '30px', color: '#166534' }}>
            <div>Total Output Qty: <span style={{ color: '#0f172a' }}>{outputSummaryQty.toFixed(2)} Bags</span></div>
            <div>Total Output Weight: <span style={{ color: '#0f172a' }}>{outputSummaryTotWt.toFixed(2)} KG</span></div>
          </div>
        </div>
      </div>

      <div className="save-bar" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '15px', borderTop: '1px solid #9bb4e0' }}>
        <button 
          onClick={() => navigate('/entry/weight-conversion-display')}
          style={{ padding: '8px 20px', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
        >
          Cancel
        </button>
        <button 
          onClick={handleSubmit} 
          disabled={loading}
          style={{ padding: '8px 25px', background: '#3f6fc0', color: '#fff', border: '1px solid #1f4fa3', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};

export default WeightConversionCreate;
