import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../services/api.js';
import { getMasters } from '../services/masterservice.js';
import './WorkOrderSlipCreate.css';

const WASTAGE_CATEGORIES = [
  { value: 'Rejection', label: 'Rejection (Milling Rejection)', defaultLot: 'REJ-01' },
  { value: 'Elevator', label: 'Elevator (Elevator Waste)', defaultLot: 'ELE-01' },
  { value: 'Waste Flour', label: 'Waste Flour (Floor Sweep / Waste)', defaultLot: 'WF-01' },
  { value: 'Sieve Flour', label: 'Sieve Flour (Sieve Screen Residue)', defaultLot: 'SF-01' },
  { value: 'Destoner / Stones', label: 'Destoner / Stones & Heavy Waste', defaultLot: 'DST-01' },
  { value: 'Dust / Husk', label: 'Dust / Husk (Aspiration Chaff)', defaultLot: 'DST-02' },
  { value: 'Broken Grain', label: 'Broken Grain (Undersized Grains)', defaultLot: 'BG-01' },
  { value: 'Other Wastage', label: 'Other Wastage / Process Loss', defaultLot: 'WST-01' }
];

const WorkOrderSlipCreate = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const today = new Date().toISOString().split('T')[0];

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [printModalOpen, setPrintModalOpen] = useState(false);

  // Master options
  const [flourMills, setFlourMills] = useState([]);
  const [itemsList, setItemsList] = useState([]);
  const [availableRmLots, setAvailableRmLots] = useState([]);
  const [loadingLots, setLoadingLots] = useState(false);

  // Header Data State
  const [workOrderData, setWorkOrderData] = useState({
    id: null,
    work_order_no: '',
    work_unit: '',
    flour_mill_id: '',
    product: '',
    product_id: '',
    date: today,
    status: 'ISSUED',
    remarks: '',
    rejection_wt: 0,
    elevator_wt: 0,
    waste_flour_wt: 0,
    sieve_flour_wt: 0,
    other_wastage_wt: 0
  });

  // Section 1: Raw Material Input Items
  const [inputItems, setInputItems] = useState([
    {
      lot_no: '',
      supplier: '',
      item_name: '',
      item_id: '',
      weight: '50',
      input_qty: '',
      kgs: 0,
      rate: 0
    }
  ]);

  // Section 2: Expected Finished Goods (FG) Output Items
  const [outputItems, setOutputItems] = useState([
    {
      output_item: '',
      item_id: '',
      fg_lot_no: '',
      weight: '50',
      expected_qty: '',
      output_kgs: 0,
      rate: 0,
      remarks: ''
    }
  ]);

  // Section 3: Wastage & Rejection Breakdown
  const [wastageItems, setWastageItems] = useState([
    {
      category: 'Rejection',
      item_name: 'Rejection Waste Flour',
      lot_no: 'REJ-01',
      weight: '1',
      qty: '0',
      total_wt: 0,
      remarks: ''
    },
    {
      category: 'Elevator',
      item_name: 'Elevator Cleaning Waste',
      lot_no: 'ELE-01',
      weight: '1',
      qty: '0',
      total_wt: 0,
      remarks: ''
    },
    {
      category: 'Waste Flour',
      item_name: 'Milling Waste Flour',
      lot_no: 'WF-01',
      weight: '1',
      qty: '0',
      total_wt: 0,
      remarks: ''
    },
    {
      category: 'Sieve Flour',
      item_name: 'Sieve Screen Flour',
      lot_no: 'SF-01',
      weight: '1',
      qty: '0',
      total_wt: 0,
      remarks: ''
    }
  ]);

  // Load masters on mount
  useEffect(() => {
    const fetchMasters = async () => {
      try {
        const [millsRes, itemsRes] = await Promise.all([
          getMasters('flour_mills'),
          getMasters('items')
        ]);

        const mills = Array.isArray(millsRes?.data || millsRes) ? (millsRes.data || millsRes) : [];
        const items = Array.isArray(itemsRes?.data || itemsRes) ? (itemsRes.data || itemsRes) : [];
        setFlourMills(mills);
        setItemsList(items);

        if (mills.length > 0 && !id) {
          setWorkOrderData(prev => ({
            ...prev,
            work_unit: prev.work_unit || mills[0].name || mills[0].mill_name || 'Main Flour Mill',
            flour_mill_id: prev.flour_mill_id || mills[0].id
          }));
        }
      } catch (err) {
        console.error('Error fetching masters for Work Order Slip:', err);
      }
    };

    fetchMasters();
  }, [id]);

  // Fetch available stock lots
  useEffect(() => {
    const fetchLots = async () => {
      setLoadingLots(true);
      try {
        const [lotsRes, availRes] = await Promise.all([
          api('/stock/lots').catch(() => []),
          api('/stock/available-lots').catch(() => [])
        ]);

        const lotsData = Array.isArray(lotsRes) ? lotsRes : (lotsRes?.data || []);
        const availData = Array.isArray(availRes) ? availRes : (availRes?.data || []);

        const mergedLots = [...availData];
        lotsData.forEach(l => {
          if (!mergedLots.some(m => m.lot_no === l.lot_no)) {
            mergedLots.push(l);
          }
        });
        setAvailableRmLots(mergedLots.filter(l => (l.remaining_quantity || l.available_qty || l.qty || 0) > 0 || l.lot_no));
      } catch (err) {
        console.error('Error fetching stock lots:', err);
      } finally {
        setLoadingLots(false);
      }
    };

    fetchLots();
  }, []);

  // Load next WO number if new
  useEffect(() => {
    if (!id) {
      api('/work-orders/next-number')
        .then(res => {
          if (res?.success && res.workOrderNo) {
            setWorkOrderData(prev => ({ ...prev, work_order_no: res.workOrderNo }));
          }
        })
        .catch(err => console.error('Error getting next WO number:', err));
    }
  }, [id]);

  // Load existing work order if edit mode
  useEffect(() => {
    if (id) {
      setLoading(true);
      api(`/work-orders/${id}`)
        .then(res => {
          if (res?.success && res.data) {
            const data = res.data;
            setWorkOrderData({
              id: data.id,
              work_order_no: data.work_order_no || `WO-${data.id}`,
              work_unit: data.work_unit || '',
              flour_mill_id: data.flour_mill_id || '',
              product: data.product || '',
              product_id: data.product_id || '',
              date: data.date ? data.date.split('T')[0] : today,
              status: data.status || 'ISSUED',
              remarks: data.remarks || '',
              rejection_wt: data.rejection_wt || 0,
              elevator_wt: data.elevator_wt || 0,
              waste_flour_wt: data.waste_flour_wt || 0,
              sieve_flour_wt: data.sieve_flour_wt || 0,
              other_wastage_wt: data.other_wastage_wt || 0
            });

            // Populate input items
            const rawList = (Array.isArray(data.input_items) && data.input_items.length > 0)
              ? data.input_items
              : (Array.isArray(data.items) && data.items.length > 0 ? data.items : []);

            if (rawList.length > 0) {
              setInputItems(rawList.map(it => ({
                lot_no: it.lot_no || '',
                supplier: it.supplier || '',
                item_name: it.item_name || '',
                item_id: it.item_id || '',
                weight: it.weight !== undefined && it.weight !== null ? String(it.weight) : '50',
                input_qty: it.input_qty !== undefined && it.input_qty !== null ? String(it.input_qty) : (it.qty ? String(it.qty) : ''),
                kgs: parseFloat(it.kgs) || ((parseFloat(it.weight) || 0) * (parseFloat(it.input_qty || it.qty) || 0)),
                rate: parseFloat(it.rate) || 0
              })));
            }

            // Populate output items
            if (Array.isArray(data.output_items) && data.output_items.length > 0) {
              setOutputItems(data.output_items.map(o => ({
                output_item: o.output_item || o.item_name || data.product || '',
                item_id: o.item_id || '',
                fg_lot_no: o.fg_lot_no || o.lot_no || '',
                weight: o.weight !== undefined && o.weight !== null ? String(o.weight) : '50',
                expected_qty: o.expected_qty !== undefined && o.expected_qty !== null ? String(o.expected_qty) : (o.qty ? String(o.qty) : ''),
                output_kgs: parseFloat(o.output_kgs || o.total_wt) || ((parseFloat(o.weight) || 0) * (parseFloat(o.expected_qty || o.qty) || 0)),
                rate: parseFloat(o.rate) || 0,
                remarks: o.remarks || ''
              })));
            } else if (rawList.length > 0 && rawList.some(r => r.fg_lot_no || r.output_qty)) {
              setOutputItems(rawList.map(r => ({
                output_item: r.output_item || data.product || '',
                item_id: '',
                fg_lot_no: r.fg_lot_no || '',
                weight: r.output_weight !== undefined && r.output_weight !== null ? String(r.output_weight) : '50',
                expected_qty: r.output_qty !== undefined && r.output_qty !== null ? String(r.output_qty) : '',
                output_kgs: parseFloat(r.output_kgs) || ((parseFloat(r.output_weight) || 0) * (parseFloat(r.output_qty) || 0)),
                rate: 0,
                remarks: ''
              })));
            } else {
              setOutputItems([{
                output_item: data.product || '',
                item_id: '',
                fg_lot_no: '',
                weight: '50',
                expected_qty: data.expected_output_qty ? String(data.expected_output_qty) : '',
                output_kgs: parseFloat(data.expected_output_wt) || 0,
                rate: 0,
                remarks: ''
              }]);
            }

            // Populate wastage items
            if (Array.isArray(data.wastage_items) && data.wastage_items.length > 0) {
              setWastageItems(data.wastage_items.map(w => ({
                category: w.category || 'Rejection',
                item_name: w.item_name || `${w.category || 'Rejection'} Waste`,
                lot_no: w.lot_no || 'WST-01',
                weight: w.weight !== undefined && w.weight !== null ? String(w.weight) : '1',
                qty: w.qty !== undefined && w.qty !== null ? String(w.qty) : (w.total_wt ? String(w.total_wt) : '0'),
                total_wt: parseFloat(w.total_wt) || ((parseFloat(w.weight) || 1) * (parseFloat(w.qty) || 0)),
                remarks: w.remarks || ''
              })));
            }
          }
        })
        .catch(err => {
          console.error('Error loading work order:', err);
          setMessage('Error loading work order: ' + err.message);
          setMessageType('error');
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  // Handle header field changes
  const handleHeaderChange = (e) => {
    const { name, value } = e.target;
    setWorkOrderData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'work_unit') {
        const matched = flourMills.find(m => (m.name || m.mill_name) === value);
        if (matched) updated.flour_mill_id = matched.id;
      }
      if (name === 'product') {
        const matched = itemsList.find(it => (it.item_name || it.name) === value);
        if (matched) updated.product_id = matched.id;

        // Auto sync first output item name with target product if empty
        setOutputItems(prevOut => prevOut.map((oRow, idx) => {
          if (idx === 0 && (!oRow.output_item || oRow.output_item === prev.product)) {
            return { ...oRow, output_item: value };
          }
          return oRow;
        }));
      }
      return updated;
    });
  };

  // Helper to generate a new sequential FG lot number (LOT0001 format)
  const generateFGLotNumber = async (index) => {
    try {
      const lotRes = await api('/stock/next-lot-no').catch(() => null);
      const suggestedLot = (lotRes && (lotRes.lot_no || lotRes.next_lot_no)) ? (lotRes.lot_no || lotRes.next_lot_no) : 'LOT0001';
      handleOutputRowChange(index, 'fg_lot_no', suggestedLot);
    } catch (e) {
      console.error('Error creating FG lot number:', e);
      handleOutputRowChange(index, 'fg_lot_no', 'LOT0001');
    }
  };

  // --- RAW MATERIAL INPUT ROW HANDLERS ---
  const handleInputRowChange = async (index, field, value) => {
    const updated = [...inputItems];
    const currentRow = { ...updated[index], [field]: value };

    // When LOT NO selected, auto-fill supplier, item, weight, rate
    if (field === 'lot_no' && value) {
      const matched = availableRmLots.find(l => l.lot_no === value);
      if (matched) {
        currentRow.item_name = matched.item_name || currentRow.item_name;
        currentRow.item_id = matched.item_id || currentRow.item_id;
        currentRow.supplier = matched.supplier_name || matched.supplier || currentRow.supplier;
        const wt = parseFloat(matched.per_unit_weight || matched.weight || 0);
        if (wt > 0) currentRow.weight = String(wt);
        const avQty = parseFloat(matched.available_qty || matched.remaining_quantity || matched.qty || 0);
        if (avQty > 0 && !currentRow.input_qty) currentRow.input_qty = String(avQty);
        currentRow.rate = parseFloat(matched.rate || matched.purchase_rate || 0);
      }
    }

    if (field === 'item_name' && value) {
      const matchedItem = itemsList.find(it => (it.item_name || it.name) === value);
      if (matchedItem) {
        currentRow.item_id = matchedItem.id;
      }
    }

    const wtVal = parseFloat(currentRow.weight) || 0;
    const inQtyVal = parseFloat(currentRow.input_qty) || 0;
    currentRow.kgs = Math.round(wtVal * inQtyVal * 100) / 100;

    updated[index] = currentRow;
    setInputItems(updated);
  };

  const addInputRow = () => {
    setInputItems(prev => [
      ...prev,
      {
        lot_no: '',
        supplier: '',
        item_name: '',
        item_id: '',
        weight: '50',
        input_qty: '',
        kgs: 0,
        rate: 0
      }
    ]);
  };

  const deleteInputRow = (index) => {
    if (inputItems.length > 1) {
      setInputItems(prev => prev.filter((_, idx) => idx !== index));
    }
  };

  // --- OUTPUT (FINISHED GOODS) ROW HANDLERS ---
  const handleOutputRowChange = (index, field, value) => {
    const updated = [...outputItems];
    const currentRow = { ...updated[index], [field]: value };

    if (field === 'output_item' && value) {
      const matched = itemsList.find(it => (it.item_name || it.name) === value);
      if (matched) {
        currentRow.item_id = matched.id;
      }
    }

    const wtVal = parseFloat(currentRow.weight) || 0;
    const expQtyVal = parseFloat(currentRow.expected_qty) || 0;
    currentRow.output_kgs = Math.round(wtVal * expQtyVal * 100) / 100;

    updated[index] = currentRow;
    setOutputItems(updated);
  };

  const addOutputRow = () => {
    setOutputItems(prev => [
      ...prev,
      {
        output_item: workOrderData.product || '',
        item_id: '',
        fg_lot_no: '',
        weight: '50',
        expected_qty: '',
        output_kgs: 0,
        rate: 0,
        remarks: ''
      }
    ]);
  };

  const deleteOutputRow = (index) => {
    if (outputItems.length > 1) {
      setOutputItems(prev => prev.filter((_, idx) => idx !== index));
    }
  };

  // --- WASTAGE & REJECTION ROW HANDLERS ---
  const handleWastageRowChange = (index, field, value) => {
    const updated = [...wastageItems];
    const currentRow = { ...updated[index], [field]: value };

    if (field === 'category') {
      const preset = WASTAGE_CATEGORIES.find(c => c.value === value);
      if (preset && !currentRow.lot_no) {
        currentRow.lot_no = preset.defaultLot;
      }
      if (!currentRow.item_name || currentRow.item_name.includes('Waste')) {
        currentRow.item_name = `${value} Waste`;
      }
    }

    const wtVal = parseFloat(currentRow.weight) || 1;
    const qtyVal = parseFloat(currentRow.qty) || 0;
    currentRow.total_wt = Math.round(wtVal * qtyVal * 100) / 100;

    updated[index] = currentRow;
    setWastageItems(updated);

    // Sync 4 classic category weight totals into workOrderData
    let rej = 0, ele = 0, wf = 0, sf = 0, oth = 0;
    updated.forEach(w => {
      const cat = (w.category || '').toLowerCase();
      const wTotal = parseFloat(w.total_wt) || 0;
      if (cat.includes('rejection')) rej += wTotal;
      else if (cat.includes('elevator')) ele += wTotal;
      else if (cat.includes('waste flour') || cat.includes('flour waste')) wf += wTotal;
      else if (cat.includes('sieve')) sf += wTotal;
      else oth += wTotal;
    });

    setWorkOrderData(prev => ({
      ...prev,
      rejection_wt: rej,
      elevator_wt: ele,
      waste_flour_wt: wf,
      sieve_flour_wt: sf,
      other_wastage_wt: oth
    }));
  };

  const addWastageRow = (categoryName = 'Other Wastage') => {
    const preset = WASTAGE_CATEGORIES.find(c => c.value === categoryName) || WASTAGE_CATEGORIES[0];
    setWastageItems(prev => [
      ...prev,
      {
        category: preset.value,
        item_name: `${preset.value} Waste`,
        lot_no: preset.defaultLot,
        weight: '1',
        qty: '0',
        total_wt: 0,
        remarks: ''
      }
    ]);
  };

  const deleteWastageRow = (index) => {
    if (wastageItems.length > 1) {
      const updated = wastageItems.filter((_, idx) => idx !== index);
      setWastageItems(updated);
    }
  };

  // --- AGGREGATED TOTALS & MASS BALANCE METRICS ---
  const totalInputBags = inputItems.reduce((sum, it) => sum + (parseFloat(it.input_qty) || 0), 0);
  const totalInputKgs = inputItems.reduce((sum, it) => sum + (parseFloat(it.kgs) || 0), 0);

  const totalOutputBags = outputItems.reduce((sum, o) => sum + (parseFloat(o.expected_qty) || 0), 0);
  const totalOutputKgs = outputItems.reduce((sum, o) => sum + (parseFloat(o.output_kgs) || 0), 0);

  const totalWastageBags = wastageItems.reduce((sum, w) => sum + (parseFloat(w.qty) || 0), 0);
  const totalWastageKgs = wastageItems.reduce((sum, w) => sum + (parseFloat(w.total_wt) || 0), 0);

  const massBalanceDifference = Math.round((totalInputKgs - (totalOutputKgs + totalWastageKgs)) * 100) / 100;
  const expectedYieldPercent = totalInputKgs > 0 ? ((totalOutputKgs / totalInputKgs) * 100).toFixed(1) : '0.0';
  const wastageRatioPercent = totalInputKgs > 0 ? ((totalWastageKgs / totalInputKgs) * 100).toFixed(1) : '0.0';

  // --- SAVE WORK ORDER SLIP ---
  const handleSave = async (andProceedToGrind = false) => {
    if (!workOrderData.work_unit || !workOrderData.work_unit.trim()) {
      setMessage('Please select or enter Work Unit (Flour Mill).');
      setMessageType('error');
      return;
    }
    if (!workOrderData.product || !workOrderData.product.trim()) {
      setMessage('Please enter or select Target Product.');
      setMessageType('error');
      return;
    }

    const validInputs = inputItems.filter(it => it.item_name || it.lot_no);
    if (validInputs.length === 0) {
      setMessage('Please enter at least one Raw Material input item or lot.');
      setMessageType('error');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const payload = {
        work_order_no: workOrderData.work_order_no,
        work_unit: workOrderData.work_unit,
        flour_mill_id: workOrderData.flour_mill_id,
        product: workOrderData.product,
        product_id: workOrderData.product_id,
        date: workOrderData.date,
        status: workOrderData.status,
        expected_output_qty: totalOutputBags,
        expected_output_wt: totalOutputKgs,
        rejection_wt: parseFloat(workOrderData.rejection_wt) || 0,
        elevator_wt: parseFloat(workOrderData.elevator_wt) || 0,
        waste_flour_wt: parseFloat(workOrderData.waste_flour_wt) || 0,
        sieve_flour_wt: parseFloat(workOrderData.sieve_flour_wt) || 0,
        other_wastage_wt: parseFloat(workOrderData.other_wastage_wt) || 0,
        remarks: workOrderData.remarks,
        input_items: validInputs.map(it => ({
          lot_no: it.lot_no,
          supplier: it.supplier,
          item_name: it.item_name,
          item_id: it.item_id,
          weight: parseFloat(it.weight) || 0,
          input_qty: parseFloat(it.input_qty) || 0,
          kgs: parseFloat(it.kgs) || ((parseFloat(it.weight) || 0) * (parseFloat(it.input_qty) || 0)),
          rate: parseFloat(it.rate) || 0
        })),
        output_items: outputItems.filter(o => o.output_item || o.fg_lot_no).map(o => ({
          output_item: o.output_item || workOrderData.product,
          item_id: o.item_id,
          fg_lot_no: o.fg_lot_no,
          weight: parseFloat(o.weight) || 0,
          expected_qty: parseFloat(o.expected_qty) || 0,
          output_kgs: parseFloat(o.output_kgs) || ((parseFloat(o.weight) || 0) * (parseFloat(o.expected_qty) || 0)),
          rate: parseFloat(o.rate) || 0,
          remarks: o.remarks || ''
        })),
        wastage_items: wastageItems.filter(w => w.category || w.item_name || parseFloat(w.total_wt) > 0).map(w => ({
          category: w.category,
          item_name: w.item_name,
          lot_no: w.lot_no,
          weight: parseFloat(w.weight) || 1,
          qty: parseFloat(w.qty) || 0,
          total_wt: parseFloat(w.total_wt) || ((parseFloat(w.weight) || 1) * (parseFloat(w.qty) || 0)),
          remarks: w.remarks || ''
        }))
      };

      const endpoint = id ? `/work-orders/${id}` : '/work-orders';
      const method = id ? 'PUT' : 'POST';
      const res = await api(endpoint, { method, body: payload });

      if (res?.success) {
        const savedId = res.id || id;
        setMessage('Work Order Slip saved successfully!');
        setMessageType('success');

        if (andProceedToGrind) {
          setTimeout(() => {
            navigate(`/entry/grind-create?work_order_id=${savedId}`);
          }, 600);
        } else {
          setTimeout(() => {
            navigate('/entry/work-order-slip-display');
          }, 1200);
        }
      } else {
        setMessage(res?.message || res?.error || 'Failed to save Work Order Slip');
        setMessageType('error');
      }
    } catch (err) {
      console.error('Error saving Work Order Slip:', err);
      setMessage('Error saving: ' + err.message);
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="work-order-container">
      {/* Title & Actions Bar */}
      <div className="wo-header-bar">
        <div className="wo-title-section">
          <h2>WORK ORDER SLIP</h2>
          <span className="wo-subtitle">Production Material Authorization, Output Specifications & Wastage Tracking</span>
        </div>
        <div className="wo-actions-group">
          <button 
            type="button" 
            className="btn btn-outline"
            onClick={() => navigate('/entry/work-order-slip-display')}
          >
            📋 Work Orders Register
          </button>
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={() => setPrintModalOpen(true)}
          >
            🖨️ Print Slip Preview
          </button>
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={() => handleSave(false)}
            disabled={saving}
          >
            {saving ? 'Saving...' : '💾 Save Slip'}
          </button>
          <button 
            type="button" 
            className="btn btn-success"
            onClick={() => handleSave(true)}
            disabled={saving}
          >
            ⚙️ Save & Process in Grind
          </button>
        </div>
      </div>

      {message && <div className={`wo-alert ${messageType}`}>{message}</div>}

      {/* Main Slip Layout (Card Container) */}
      <div className="wo-paper-card">
        <div className="wo-slip-header-title">
          <h3>WORK ORDER SLIP</h3>
          <div className="wo-badge">{workOrderData.work_order_no || 'NEW SLIP'}</div>
        </div>

        {/* Header Information Grid */}
        <div className="wo-form-header-grid">
          <div className="wo-field-group">
            <label>Work Unit :</label>
            <div className="wo-input-combo">
              <input
                type="text"
                name="work_unit"
                list="flour_mill_list"
                value={workOrderData.work_unit}
                onChange={handleHeaderChange}
                placeholder="e.g. Flour Mill 1 / Grinding Unit"
                className="wo-input"
                required
              />
              <datalist id="flour_mill_list">
                {flourMills.map((m, idx) => (
                  <option key={idx} value={m.name || m.mill_name || m.flour_mill_name}>
                    {m.name || m.mill_name}
                  </option>
                ))}
              </datalist>
            </div>
          </div>

          <div className="wo-field-group">
            <label>Date :</label>
            <input
              type="date"
              name="date"
              value={workOrderData.date}
              onChange={handleHeaderChange}
              className="wo-input"
              required
            />
          </div>

          <div className="wo-field-group full-width">
            <label>Target Product :</label>
            <div className="wo-input-combo">
              <input
                type="text"
                name="product"
                list="product_items_list"
                value={workOrderData.product}
                onChange={handleHeaderChange}
                placeholder="Target FG Product (e.g. Urad Flour, Wheat Flour, Maida, Gram Flour)"
                className="wo-input"
                required
              />
              <datalist id="product_items_list">
                {itemsList.map((it, idx) => (
                  <option key={idx} value={it.item_name || it.name}>
                    {it.item_name || it.name}
                  </option>
                ))}
              </datalist>
            </div>
          </div>
        </div>

        {/* SECTION 1: RAW MATERIAL (INPUT) DETAILS */}
        <div className="wo-section-card">
          <div className="wo-section-header">
            <div className="wo-section-title-wrap">
              <span className="wo-section-num">1</span>
              <h4>RAW MATERIAL (INPUT) AUTHORIZATION</h4>
            </div>
            <span className="wo-section-badge input-badge">
              Total Input: {totalInputBags.toFixed(1)} Bags | {totalInputKgs.toFixed(2)} KG
            </span>
          </div>

          <div className="wo-table-wrapper">
            <table className="wo-slip-table">
              <thead>
                <tr>
                  <th style={{ width: '18%' }}>LOT NO</th>
                  <th style={{ width: '22%' }}>SUPPLIER</th>
                  <th style={{ width: '22%' }}>RAW ITEM</th>
                  <th style={{ width: '12%' }}>WT / BAG (KG)</th>
                  <th style={{ width: '12%' }}>INPUT QTY (BAGS)</th>
                  <th style={{ width: '10%' }}>TOTAL (KG)</th>
                  <th style={{ width: '4%' }} className="no-print"></th>
                </tr>
              </thead>
              <tbody>
                {inputItems.map((row, index) => (
                  <tr key={index}>
                    {/* LOT NO */}
                    <td>
                      <input
                        type="text"
                        list={`input_lot_options_${index}`}
                        value={row.lot_no}
                        onChange={(e) => handleInputRowChange(index, 'lot_no', e.target.value)}
                        placeholder="Select / Type Lot"
                        className="wo-table-input lot-input"
                      />
                      <datalist id={`input_lot_options_${index}`}>
                        {availableRmLots.map((l, lIdx) => (
                          <option key={lIdx} value={l.lot_no}>
                            {l.lot_no} - {l.item_name} (Stock: {l.remaining_quantity || l.available_qty} bags | {l.supplier_name || l.supplier || 'Direct'})
                          </option>
                        ))}
                      </datalist>
                    </td>

                    {/* SUPPLIER */}
                    <td>
                      <input
                        type="text"
                        value={row.supplier}
                        onChange={(e) => handleInputRowChange(index, 'supplier', e.target.value)}
                        placeholder="Supplier Name"
                        className="wo-table-input"
                      />
                    </td>

                    {/* RAW ITEM */}
                    <td>
                      <input
                        type="text"
                        list="raw_items_list"
                        value={row.item_name}
                        onChange={(e) => handleInputRowChange(index, 'item_name', e.target.value)}
                        placeholder="RM Item Name"
                        className="wo-table-input"
                      />
                    </td>

                    {/* WT / BAG (KG) */}
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={row.weight}
                        onChange={(e) => handleInputRowChange(index, 'weight', e.target.value)}
                        placeholder="50"
                        className="wo-table-input text-center"
                      />
                    </td>

                    {/* INPUT QTY */}
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={row.input_qty}
                        onChange={(e) => handleInputRowChange(index, 'input_qty', e.target.value)}
                        placeholder="Bags"
                        className="wo-table-input bold-number"
                      />
                    </td>

                    {/* TOTAL (KG) */}
                    <td className="text-right font-bold text-slate-800">
                      {row.kgs.toFixed(2)} Kg
                    </td>

                    {/* Delete Action */}
                    <td className="no-print text-center">
                      <button
                        type="button"
                        onClick={() => deleteInputRow(index)}
                        className="wo-btn-delete"
                        title="Remove Input Item"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="4" className="text-right font-bold">TOTAL RAW MATERIAL INPUT:</td>
                  <td className="font-bold text-center">{totalInputBags.toFixed(2)} Bags</td>
                  <td className="font-bold text-right">{totalInputKgs.toFixed(2)} KG</td>
                  <td className="no-print text-center">
                    <button type="button" onClick={addInputRow} className="wo-btn-add" title="Add Input Item">
                      + Add
                    </button>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* SECTION 2: FINISHED GOODS (OUTPUT) EXPECTED DETAILS */}
        <div className="wo-section-card">
          <div className="wo-section-header">
            <div className="wo-section-title-wrap">
              <span className="wo-section-num">2</span>
              <h4>EXPECTED FINISHED GOODS (OUTPUT) PLAN</h4>
            </div>
            <span className="wo-section-badge output-badge">
              Expected Output: {totalOutputBags.toFixed(1)} Bags | {totalOutputKgs.toFixed(2)} KG
            </span>
          </div>

          <div className="wo-table-wrapper">
            <table className="wo-slip-table">
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>OUTPUT ITEM NAME</th>
                  <th style={{ width: '22%' }}>FG LOT.NO</th>
                  <th style={{ width: '12%' }}>UNIT WT (KG)</th>
                  <th style={{ width: '15%' }}>EXPECTED / NEEDED QTY</th>
                  <th style={{ width: '12%' }}>TOTAL (KG)</th>
                  <th style={{ width: '10%' }}>REMARKS</th>
                  <th style={{ width: '4%' }} className="no-print"></th>
                </tr>
              </thead>
              <tbody>
                {outputItems.map((row, index) => (
                  <tr key={index}>
                    {/* OUTPUT ITEM NAME */}
                    <td>
                      <input
                        type="text"
                        list="product_items_list"
                        value={row.output_item}
                        onChange={(e) => handleOutputRowChange(index, 'output_item', e.target.value)}
                        placeholder="Output Item (e.g. Flour 50kg)"
                        className="wo-table-input"
                      />
                    </td>

                    {/* FG LOT.NO */}
                    <td>
                      <div className="wo-lot-gen-wrap">
                        <input
                          type="text"
                          value={row.fg_lot_no}
                          onChange={(e) => handleOutputRowChange(index, 'fg_lot_no', e.target.value)}
                          placeholder="Allocated FG Lot No"
                          className="wo-table-input fg-lot-input"
                        />
                        <button
                          type="button"
                          className="wo-lot-gen-btn no-print"
                          title="Generate Unique FG Lot No"
                          onClick={() => generateFGLotNumber(index)}
                        >
                          ⚡ Auto
                        </button>
                      </div>
                    </td>

                    {/* UNIT WT (KG) */}
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={row.weight}
                        onChange={(e) => handleOutputRowChange(index, 'weight', e.target.value)}
                        placeholder="50"
                        className="wo-table-input text-center"
                      />
                    </td>

                    {/* EXPECTED / NEEDED QTY */}
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={row.expected_qty}
                        onChange={(e) => handleOutputRowChange(index, 'expected_qty', e.target.value)}
                        placeholder="Needed Bags"
                        className="wo-table-input bold-number text-success"
                      />
                    </td>

                    {/* TOTAL (KG) */}
                    <td className="text-right font-bold text-emerald-800">
                      {row.output_kgs.toFixed(2)} Kg
                    </td>

                    {/* REMARKS */}
                    <td>
                      <input
                        type="text"
                        value={row.remarks}
                        onChange={(e) => handleOutputRowChange(index, 'remarks', e.target.value)}
                        placeholder="Grade / Notes"
                        className="wo-table-input"
                      />
                    </td>

                    {/* Delete Action */}
                    <td className="no-print text-center">
                      <button
                        type="button"
                        onClick={() => deleteOutputRow(index)}
                        className="wo-btn-delete"
                        title="Remove Output Item"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="3" className="text-right font-bold">TOTAL EXPECTED OUTPUT:</td>
                  <td className="font-bold text-center">{totalOutputBags.toFixed(2)} Bags</td>
                  <td className="font-bold text-right text-emerald-800">{totalOutputKgs.toFixed(2)} KG</td>
                  <td colSpan="2" className="no-print text-center">
                    <button type="button" onClick={addOutputRow} className="wo-btn-add" title="Add Output Item">
                      + Add FG
                    </button>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* SECTION 3: WASTAGE & REJECTION DETAILS */}
        <div className="wo-section-card">
          <div className="wo-section-header">
            <div className="wo-section-title-wrap">
              <span className="wo-section-num">3</span>
              <h4>REJECTION & WASTAGE SPECIFICATIONS</h4>
            </div>
            <span className="wo-section-badge wastage-badge">
              Total Wastage: {totalWastageBags.toFixed(1)} Units | {totalWastageKgs.toFixed(2)} KG
            </span>
          </div>

          <div className="wo-table-wrapper">
            <table className="wo-slip-table">
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>WASTE CATEGORY</th>
                  <th style={{ width: '25%' }}>WASTAGE ITEM NAME</th>
                  <th style={{ width: '15%' }}>WASTE LOT NO</th>
                  <th style={{ width: '10%' }}>UNIT WT (KG)</th>
                  <th style={{ width: '12%' }}>QTY (UNITS/BAGS)</th>
                  <th style={{ width: '12%' }}>TOTAL (KG)</th>
                  <th style={{ width: '4%' }} className="no-print"></th>
                </tr>
              </thead>
              <tbody>
                {wastageItems.map((row, index) => (
                  <tr key={index}>
                    {/* WASTE CATEGORY */}
                    <td>
                      <select
                        value={row.category}
                        onChange={(e) => handleWastageRowChange(index, 'category', e.target.value)}
                        className="wo-table-input select"
                      >
                        {WASTAGE_CATEGORIES.map((c, cIdx) => (
                          <option key={cIdx} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* WASTAGE ITEM NAME */}
                    <td>
                      <input
                        type="text"
                        value={row.item_name}
                        onChange={(e) => handleWastageRowChange(index, 'item_name', e.target.value)}
                        placeholder="e.g. Sieve Rejection"
                        className="wo-table-input"
                      />
                    </td>

                    {/* WASTE LOT NO */}
                    <td>
                      <input
                        type="text"
                        value={row.lot_no}
                        onChange={(e) => handleWastageRowChange(index, 'lot_no', e.target.value)}
                        placeholder="Lot No (e.g. REJ-01)"
                        className="wo-table-input text-center text-amber-900 font-semibold"
                      />
                    </td>

                    {/* UNIT WT (KG) */}
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={row.weight}
                        onChange={(e) => handleWastageRowChange(index, 'weight', e.target.value)}
                        placeholder="1"
                        className="wo-table-input text-center"
                      />
                    </td>

                    {/* QTY */}
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={row.qty}
                        onChange={(e) => handleWastageRowChange(index, 'qty', e.target.value)}
                        placeholder="0.00"
                        className="wo-table-input bold-number text-amber-800"
                      />
                    </td>

                    {/* TOTAL (KG) */}
                    <td className="text-right font-bold text-amber-900">
                      {row.total_wt.toFixed(2)} Kg
                    </td>

                    {/* Delete Action */}
                    <td className="no-print text-center">
                      <button
                        type="button"
                        onClick={() => deleteWastageRow(index)}
                        className="wo-btn-delete"
                        title="Remove Wastage Item"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="4" className="text-right font-bold">TOTAL WASTAGE & REJECTIONS:</td>
                  <td className="font-bold text-center">{totalWastageBags.toFixed(2)} Units</td>
                  <td className="font-bold text-right text-amber-900">{totalWastageKgs.toFixed(2)} KG</td>
                  <td className="no-print text-center">
                    <button type="button" onClick={() => addWastageRow('Other Wastage')} className="wo-btn-add" title="Add Wastage Row">
                      + Add
                    </button>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Quick 4-Box Classic Physical Slip Rejection Cards */}
          <div className="wo-classic-wastage-grid">
            <div className="wo-classic-card">
              <span className="card-label">Rejection:</span>
              <span className="card-val">{workOrderData.rejection_wt || 0} Kg</span>
            </div>
            <div className="wo-classic-card">
              <span className="card-label">Elevator:</span>
              <span className="card-val">{workOrderData.elevator_wt || 0} Kg</span>
            </div>
            <div className="wo-classic-card">
              <span className="card-label">Waste Flour:</span>
              <span className="card-val">{workOrderData.waste_flour_wt || 0} Kg</span>
            </div>
            <div className="wo-classic-card">
              <span className="card-label">Sieve Flour:</span>
              <span className="card-val">{workOrderData.sieve_flour_wt || 0} Kg</span>
            </div>
          </div>
        </div>

        {/* Remarks and Status */}
        <div className="wo-footer-details">
          <div className="wo-field-group" style={{ flex: 1 }}>
            <label>Process Instructions / Remarks:</label>
            <input
              type="text"
              name="remarks"
              value={workOrderData.remarks}
              onChange={handleHeaderChange}
              placeholder="e.g. 100 Mesh sieve grind, inspect magnetic separator, check moisture"
              className="wo-input"
            />
          </div>
          <div className="wo-field-group" style={{ width: '220px' }}>
            <label>Status:</label>
            <select
              name="status"
              value={workOrderData.status}
              onChange={handleHeaderChange}
              className="wo-input select"
            >
              <option value="ISSUED">ISSUED (Ready for Mill)</option>
              <option value="IN_PROCESS">IN_PROCESS</option>
              <option value="COMPLETED">COMPLETED (Grind Done)</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
        </div>

        {/* Metrics Summary & Mass Balance Strip */}
        <div className="wo-summary-strip">
          <div className="wo-stat-box">
            <span className="label">Total RM Input</span>
            <span className="val">{totalInputBags} Bags / {totalInputKgs.toFixed(2)} Kg</span>
          </div>
          <div className="wo-stat-box">
            <span className="label">Expected FG Output</span>
            <span className="val text-success">{totalOutputBags} Bags / {totalOutputKgs.toFixed(2)} Kg</span>
          </div>
          <div className="wo-stat-box">
            <span className="label">Total Waste / Rejection</span>
            <span className="val text-amber-700">{totalWastageKgs.toFixed(2)} Kg</span>
          </div>
          <div className="wo-stat-box">
            <span className="label">Milling Balance (Diff)</span>
            <span className={`val ${Math.abs(massBalanceDifference) < 0.01 ? 'text-success' : 'text-amber-600'}`}>
              {massBalanceDifference > 0 ? `+${massBalanceDifference}` : massBalanceDifference} Kg
            </span>
          </div>
          <div className="wo-stat-box">
            <span className="label">Estimated Yield</span>
            <span className="val highlight">{expectedYieldPercent}%</span>
          </div>
          <div className="wo-stat-box">
            <span className="label">Wastage Ratio</span>
            <span className="val text-slate-700">{wastageRatioPercent}%</span>
          </div>
        </div>
      </div>

      {/* Datalists for Global Lookup */}
      <datalist id="raw_items_list">
        {itemsList.map((it, idx) => (
          <option key={idx} value={it.item_name || it.name}>
            {it.item_name || it.name}
          </option>
        ))}
      </datalist>

      {/* Printable Modal matching factory slip */}
      {printModalOpen && (
        <div className="wo-modal-overlay">
          <div className="wo-modal-content">
            <div className="wo-modal-header no-print">
              <h3>Work Order Slip Print Preview</h3>
              <div className="wo-modal-actions">
                <button type="button" className="btn btn-primary" onClick={handlePrint}>
                  🖨️ Print Now
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setPrintModalOpen(false)}>
                  Close
                </button>
              </div>
            </div>

            {/* Exact Paper Slip Print Layout */}
            <div className="printable-slip-wrapper" id="printable-slip">
              <div className="slip-outer-box">
                <div className="slip-title-header">
                  <u>WORK ORDER SLIP</u>
                </div>

                <div className="slip-meta-row">
                  <div className="slip-meta-left">
                    <strong>Work Unit :</strong> <span className="underline-text">{workOrderData.work_unit || '_________________'}</span>
                  </div>
                  <div className="slip-meta-right">
                    <strong>Date :</strong> <span className="underline-text">{workOrderData.date || '____________'}</span>
                  </div>
                </div>

                <div className="slip-meta-row">
                  <div className="slip-meta-left">
                    <strong>Product :</strong> <span className="underline-text">{workOrderData.product || '_________________'}</span>
                  </div>
                  <div className="slip-meta-right">
                    <strong>WO No :</strong> <span className="underline-text">{workOrderData.work_order_no || '______'}</span>
                  </div>
                </div>

                {/* Section 1: Raw Material Input Table */}
                <div className="slip-table-section-title">1. RAW MATERIAL INPUT DETAILS</div>
                <table className="slip-print-table">
                  <thead>
                    <tr>
                      <th style={{ width: '18%' }}>LOT NO</th>
                      <th style={{ width: '25%' }}>SUPPLIER</th>
                      <th style={{ width: '25%' }}>ITEM NAME</th>
                      <th style={{ width: '12%' }}>WT/BAG</th>
                      <th style={{ width: '10%' }}>INPUT QTY</th>
                      <th style={{ width: '10%' }}>TOTAL KG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inputItems.map((it, idx) => (
                      <tr key={idx} style={{ height: '32px' }}>
                        <td>{it.lot_no || '-'}</td>
                        <td>{it.supplier || '-'}</td>
                        <td>{it.item_name || '-'}</td>
                        <td>{it.weight ? `${it.weight} kg` : '-'}</td>
                        <td className="text-center font-bold">{it.input_qty || '-'}</td>
                        <td className="text-right font-bold">{it.kgs ? `${it.kgs} kg` : '-'}</td>
                      </tr>
                    ))}
                    <tr className="slip-subtotal-row">
                      <td colSpan="4" className="text-right font-bold">Total Input:</td>
                      <td className="text-center font-bold">{totalInputBags.toFixed(1)} Bags</td>
                      <td className="text-right font-bold">{totalInputKgs.toFixed(1)} Kg</td>
                    </tr>
                  </tbody>
                </table>

                {/* Section 2: Finished Goods Expected Output Table */}
                <div className="slip-table-section-title mt-2">2. FINISHED GOODS (OUTPUT) EXPECTED DETAILS</div>
                <table className="slip-print-table">
                  <thead>
                    <tr>
                      <th style={{ width: '30%' }}>OUTPUT ITEM NAME</th>
                      <th style={{ width: '25%' }}>FG LOT NO</th>
                      <th style={{ width: '15%' }}>UNIT WT (KG)</th>
                      <th style={{ width: '15%' }}>EXPECTED QTY</th>
                      <th style={{ width: '15%' }}>TOTAL OUTPUT (KG)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outputItems.map((o, idx) => (
                      <tr key={idx} style={{ height: '32px' }}>
                        <td>{o.output_item || workOrderData.product || '-'}</td>
                        <td className="font-bold">{o.fg_lot_no || '-'}</td>
                        <td>{o.weight ? `${o.weight} kg` : '-'}</td>
                        <td className="text-center font-bold">{o.expected_qty || '-'} Bags</td>
                        <td className="text-right font-bold">{o.output_kgs ? `${o.output_kgs} kg` : '-'}</td>
                      </tr>
                    ))}
                    <tr className="slip-subtotal-row">
                      <td colSpan="3" className="text-right font-bold">Total Expected Output:</td>
                      <td className="text-center font-bold">{totalOutputBags.toFixed(1)} Bags</td>
                      <td className="text-right font-bold">{totalOutputKgs.toFixed(1)} Kg</td>
                    </tr>
                  </tbody>
                </table>

                {/* Section 3: Wastage & Rejections Table */}
                <div className="slip-table-section-title mt-2">3. WASTAGE & REJECTION SPECIFICATIONS</div>
                <table className="slip-print-table">
                  <thead>
                    <tr>
                      <th style={{ width: '25%' }}>CATEGORY</th>
                      <th style={{ width: '30%' }}>WASTAGE ITEM NAME</th>
                      <th style={{ width: '15%' }}>LOT NO</th>
                      <th style={{ width: '15%' }}>QTY (UNITS)</th>
                      <th style={{ width: '15%' }}>TOTAL KG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wastageItems.map((w, idx) => (
                      <tr key={idx} style={{ height: '30px' }}>
                        <td>{w.category || '-'}</td>
                        <td>{w.item_name || '-'}</td>
                        <td>{w.lot_no || '-'}</td>
                        <td className="text-center">{w.qty || '-'}</td>
                        <td className="text-right font-bold">{w.total_wt ? `${w.total_wt} kg` : '0 kg'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Bottom Rejection Box */}
                <div className="slip-print-wastage mt-2">
                  <div className="slip-wastage-item">
                    <span>Rejection :</span>
                    <span className="slip-fill-line">{workOrderData.rejection_wt ? `${workOrderData.rejection_wt} kg` : ''}</span>
                  </div>
                  <div className="slip-wastage-item">
                    <span>Elevator :</span>
                    <span className="slip-fill-line">{workOrderData.elevator_wt ? `${workOrderData.elevator_wt} kg` : ''}</span>
                  </div>
                  <div className="slip-wastage-item">
                    <span>Waste Flour :</span>
                    <span className="slip-fill-line">{workOrderData.waste_flour_wt ? `${workOrderData.waste_flour_wt} kg` : ''}</span>
                  </div>
                  <div className="slip-wastage-item">
                    <span>Sieve Flour :</span>
                    <span className="slip-fill-line">{workOrderData.sieve_flour_wt ? `${workOrderData.sieve_flour_wt} kg` : ''}</span>
                  </div>
                </div>

                {/* Mass balance summary row */}
                <div className="slip-mass-balance-row">
                  <span><strong>Total Input:</strong> {totalInputKgs.toFixed(1)} Kg</span>
                  <span><strong>Expected Output:</strong> {totalOutputKgs.toFixed(1)} Kg</span>
                  <span><strong>Total Wastage:</strong> {totalWastageKgs.toFixed(1)} Kg</span>
                  <span><strong>Expected Yield:</strong> {expectedYieldPercent}%</span>
                </div>

                {/* Signatures */}
                <div className="slip-signatures">
                  <div className="sig-block">
                    <div className="sig-line"></div>
                    <span>Issued By</span>
                  </div>
                  <div className="sig-block">
                    <div className="sig-line"></div>
                    <span>Mill Operator / Incharge</span>
                  </div>
                  <div className="sig-block">
                    <div className="sig-line"></div>
                    <span>Quality Inspector</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkOrderSlipCreate;
