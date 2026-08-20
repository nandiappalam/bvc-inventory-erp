import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './PapadInCreate.css';
import api, { getMasters } from '../utils/api';
import { 
  EntryTopFrame, 
  EntryItemsTable, 
  EntryTotalsRow, 
  EntryActions,
  EntrySection
} from './entry';

const getNextLotString = (currentLot) => {
  if (!currentLot) return 'LOT0001';
  const match = currentLot.match(/^([A-Za-z]+)(\d+)$/);
  if (match) {
    const prefix = match[1];
    const num = parseInt(match[2], 10) + 1;
    const padLen = Math.max(4, match[2].length);
    return `${prefix}${String(num).padStart(padLen, '0')}`;
  }
  return 'LOT0001';
};

const PapadInCreate = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');

  const [formData, setFormData] = useState({
    sNo: '',
    date: new Date().toISOString().slice(0, 10),
    wt_scale: 'No',
    papadCompany: '',
    remarks: '',
  });

  // Table 1: Papad Details with multi-row popup details support
  const [papadRows, setPapadRows] = useState([
    { 
      s_no: 1, 
      item_name: '', 
      item_id: '',
      lot_no: 'LOT0001', 
      box_papad: '', 
      wt_papad: '', 
      box_empty: '', 
      wt_empty: '', 
      tot_wt: '',
      papad_details: [], // Sub-rows for Box (Papad) & Wt (Papad)
      empty_details: []  // Sub-rows for Box (Empty) & Wt (Empty)
    }
  ]);

  // Table 2: Flour Details
  const [flourRows, setFlourRows] = useState([
    { s_no: 1, item_name: '', kg: '' }
  ]);

  // Master items list for dropdown
  const [itemOptions, setItemOptions] = useState([]);
  
  // Modal State for multi-row Pop Up window entry
  // activeModal: null OR { rowIndex: number, type: 'papad' | 'empty', tempRows: Array<{ box: '', wt: '' }> }
  const [activeModal, setActiveModal] = useState(null);

  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch Item Masters
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await getMasters('items');
        const list = res?.data || res || [];
        setItemOptions(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error('Failed to load items master:', err);
      }
    };
    fetchItems();
  }, []);

  // Fetch next SNo and next Lot No on mount if creating new
  useEffect(() => {
    if (!editId) {
      const initNew = async () => {
        try {
          const res = await api('/papad-in');
          const list = res || [];
          let max = 0;
          list.forEach(item => {
            const val = parseInt(item.s_no || item.sNo || item.sno) || 0;
            if (val > max) max = val;
          });
          setFormData(prev => ({ ...prev, sNo: String(max + 1) }));

          const lotRes = await api('/stock/next-lot-no').catch(() => null);
          const startLot = (lotRes && lotRes.lot_no) ? lotRes.lot_no : 'LOT0001';
          setPapadRows([
            { 
              s_no: 1, 
              item_name: '', 
              item_id: '',
              lot_no: startLot, 
              box_papad: '', 
              wt_papad: '', 
              box_empty: '', 
              wt_empty: '', 
              tot_wt: '',
              papad_details: [],
              empty_details: []
            }
          ]);
        } catch (err) {
          console.error(err);
        }
      };
      initNew();
    }
  }, [editId]);

  // Load existing data if editId
  useEffect(() => {
    if (editId) {
      const loadRecord = async () => {
        setLoading(true);
        try {
          const data = await api(`/papad-in/${editId}`);
          if (data) {
            setFormData({
              sNo: data.s_no || data.sNo || '',
              date: data.date || '',
              wt_scale: data.wt_scale || 'No',
              remarks: data.remarks || '',
              papadCompany: data.papad_company || data.papadCompany || '',
            });

            let items = [];
            if (typeof data.items === 'string') {
              try { items = JSON.parse(data.items); } catch(e) {}
            } else if (Array.isArray(data.items)) {
              items = data.items;
            }

            if (items && items.length > 0) {
              setPapadRows(items.map((it, idx) => {
                let pDetails = [];
                let eDetails = [];
                if (typeof it.papad_details === 'string') {
                  try { pDetails = JSON.parse(it.papad_details); } catch(e) {}
                } else if (Array.isArray(it.papad_details)) {
                  pDetails = it.papad_details;
                }

                if (typeof it.empty_details === 'string') {
                  try { eDetails = JSON.parse(it.empty_details); } catch(e) {}
                } else if (Array.isArray(it.empty_details)) {
                  eDetails = it.empty_details;
                }

                return {
                  s_no: idx + 1,
                  item_name: it.itemName || it.item_name || '',
                  item_id: it.item_id || '',
                  lot_no: it.lotNo || it.lot_no || `LOT-PAP-${data.s_no || data.sNo || '1'}-${idx + 1}`,
                  box_papad: it.box_papad || it.boxPapad || it.qty || '',
                  wt_papad: it.wt_papad || it.wtPapad || it.weight || '',
                  box_empty: it.box_empty || it.boxEmpty || '',
                  wt_empty: it.wt_empty || it.wtEmpty || '',
                  tot_wt: it.tot_wt || it.totWt || it.totalWt || '',
                  papad_details: pDetails,
                  empty_details: eDetails
                };
              }));

              setFlourRows(items.map((it, idx) => ({
                s_no: idx + 1,
                item_name: it.itemName || it.item_name || '',
                kg: it.papadKg || it.kg || ''
              })));
            }
          }
        } catch (err) {
          console.error('Error loading papad-in record:', err);
        } finally {
          setLoading(false);
        }
      };
      loadRecord();
    }
  }, [editId]);

  const topFrameFields = [
    { name: 'sNo', label: 'S.No', type: 'text', readOnly: true },
    { name: 'date', label: 'Date', type: 'date' },
    { name: 'wt_scale', label: 'Wt Scale', type: 'select', options: [
      { value: 'No', label: 'No' },
      { value: 'Yes', label: 'Yes' }
    ]},
    { name: 'papadCompany', label: 'Papad Company', type: 'masterSelect', masterType: 'papad_companies' },
    { name: 'remarks', label: 'Remarks', type: 'text' }
  ];

  // Column config for Flour Details table
  const flourColumns = [
    { key: 's_no', title: 'S.No', readOnly: true },
    { key: 'item_name', title: 'Item Name', type: 'masterSelect', masterType: 'items' },
    { key: 'kg', title: 'Kg', type: 'number' }
  ];

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Open Pop Up Window for Papad Box/Wt
  const openPapadModal = (rowIndex) => {
    const row = papadRows[rowIndex];
    const existingDetails = Array.isArray(row.papad_details) && row.papad_details.length > 0 
      ? row.papad_details 
      : [{ box: row.box_papad || '', wt: row.wt_papad || '' }, { box: '', wt: '' }];

    setActiveModal({
      rowIndex,
      type: 'papad',
      tempRows: JSON.parse(JSON.stringify(existingDetails))
    });
  };

  // Open Pop Up Window for Empty Box/Wt
  const openEmptyModal = (rowIndex) => {
    const row = papadRows[rowIndex];
    const existingDetails = Array.isArray(row.empty_details) && row.empty_details.length > 0 
      ? row.empty_details 
      : [{ box: row.box_empty || '', wt: row.wt_empty || '' }];

    setActiveModal({
      rowIndex,
      type: 'empty',
      tempRows: JSON.parse(JSON.stringify(existingDetails))
    });
  };

  // Close Modal
  const closeModal = () => {
    setActiveModal(null);
  };

  // Modal handlers
  const handleModalRowChange = (index, field, value) => {
    if (!activeModal) return;
    const newTempRows = [...activeModal.tempRows];
    newTempRows[index] = { ...newTempRows[index], [field]: value };
    setActiveModal({ ...activeModal, tempRows: newTempRows });
  };

  const addModalRow = () => {
    if (!activeModal) return;
    setActiveModal({
      ...activeModal,
      tempRows: [...activeModal.tempRows, { box: '', wt: '' }]
    });
  };

  const deleteModalRow = (index) => {
    if (!activeModal) return;
    if (activeModal.tempRows.length <= 1) return;
    const newTempRows = activeModal.tempRows.filter((_, i) => i !== index);
    setActiveModal({ ...activeModal, tempRows: newTempRows });
  };

  // Save Modal Entries back to main Papad Details row
  const saveModalEntries = () => {
    if (!activeModal) return;
    const { rowIndex, type, tempRows } = activeModal;

    // Filter valid non-empty rows
    const validRows = tempRows.filter(r => (parseFloat(r.box) > 0 || parseFloat(r.wt) > 0));

    setPapadRows(prevRows => {
      const newRows = [...prevRows];
      const targetRow = { ...newRows[rowIndex] };

      let totalBoxes = 0;
      let totalWt = 0;

      validRows.forEach(r => {
        const b = parseFloat(r.box) || 0;
        const w = parseFloat(r.wt) || 0;
        totalBoxes += b;
        totalWt += (b > 0 ? (b * w) : w);
      });

      if (type === 'papad') {
        targetRow.box_papad = totalBoxes || (validRows.length > 0 ? validRows[0].box : '');
        targetRow.wt_papad = totalWt || (validRows.length > 0 ? validRows[0].wt : '');
        targetRow.papad_details = validRows;
      } else {
        targetRow.box_empty = totalBoxes || (validRows.length > 0 ? validRows[0].box : '');
        targetRow.wt_empty = totalWt || (validRows.length > 0 ? validRows[0].wt : '');
        targetRow.empty_details = validRows;
      }

      // Re-calculate Net Tot Wt
      let papadTotalWt = 0;
      if (targetRow.papad_details && targetRow.papad_details.length > 0) {
        papadTotalWt = targetRow.papad_details.reduce((acc, r) => {
          const b = parseFloat(r.box) || 0;
          const w = parseFloat(r.wt) || 0;
          return acc + (b > 0 ? b * w : w);
        }, 0);
      } else {
        const b = parseFloat(targetRow.box_papad) || 0;
        const w = parseFloat(targetRow.wt_papad) || 0;
        papadTotalWt = b > 0 ? b * w : w;
      }

      let emptyTotalWt = 0;
      if (targetRow.empty_details && targetRow.empty_details.length > 0) {
        emptyTotalWt = targetRow.empty_details.reduce((acc, r) => {
          const b = parseFloat(r.box) || 0;
          const w = parseFloat(r.wt) || 0;
          return acc + (b > 0 ? b * w : w);
        }, 0);
      } else {
        const b = parseFloat(targetRow.box_empty) || 0;
        const w = parseFloat(targetRow.wt_empty) || 0;
        emptyTotalWt = b > 0 ? b * w : w;
      }

      const calculatedTot = papadTotalWt - emptyTotalWt;
      targetRow.tot_wt = calculatedTot > 0 ? calculatedTot.toFixed(3) : (papadTotalWt > 0 ? papadTotalWt.toFixed(3) : '0.000');

      newRows[rowIndex] = targetRow;
      return newRows;
    });

    // If saving papad details and empty details not entered yet, prompt / auto-open Empty Modal
    const rowToUpdate = papadRows[rowIndex];
    if (type === 'papad' && (!rowToUpdate.empty_details || rowToUpdate.empty_details.length === 0)) {
      setActiveModal(null);
      setTimeout(() => {
        openEmptyModal(rowIndex);
      }, 150);
    } else {
      setActiveModal(null);
    }
  };

  // Handle direct row change in main Papad Details table
  const handlePapadRowChange = (index, field, value) => {
    setPapadRows(prevRows => {
      const newRows = [...prevRows];
      const targetRow = { ...newRows[index] };

      if (field === 'item_name') {
        const selectedOpt = itemOptions.find(opt => 
          String(opt.id) === String(value) || 
          (opt.item_name || opt.name || '').toLowerCase() === String(value).toLowerCase()
        );
        targetRow.item_name = selectedOpt?.item_name || selectedOpt?.name || value;
        targetRow.item_id = selectedOpt?.id || value;

        if (!targetRow.lot_no) {
          const prevLot = index > 0 ? newRows[index - 1].lot_no : '';
          targetRow.lot_no = getNextLotString(prevLot);
        }

        // Auto trigger Papad Box / Wt Pop Up Modal on new Item selection if sub-details empty
        if (!targetRow.papad_details || targetRow.papad_details.length === 0) {
          setTimeout(() => {
            openPapadModal(index);
          }, 100);
        }
      } else {
        targetRow[field] = value;
      }

      // Auto calculate tot_wt if numbers typed directly
      const boxP = parseFloat(targetRow.box_papad) || 0;
      const wtP = parseFloat(targetRow.wt_papad) || 0;
      const boxE = parseFloat(targetRow.box_empty) || 0;
      const wtE = parseFloat(targetRow.wt_empty) || 0;

      const papadWt = targetRow.papad_details?.length > 0
        ? targetRow.papad_details.reduce((a, r) => a + ((parseFloat(r.box)||0) > 0 ? (parseFloat(r.box)||0)*(parseFloat(r.wt)||0) : (parseFloat(r.wt)||0)), 0)
        : (boxP > 0 ? boxP * wtP : wtP);

      const emptyWt = targetRow.empty_details?.length > 0
        ? targetRow.empty_details.reduce((a, r) => a + ((parseFloat(r.box)||0) > 0 ? (parseFloat(r.box)||0)*(parseFloat(r.wt)||0) : (parseFloat(r.wt)||0)), 0)
        : (boxE > 0 ? boxE * wtE : wtE);

      const calculatedTot = papadWt - emptyWt;
      targetRow.tot_wt = calculatedTot > 0 ? calculatedTot.toFixed(3) : (papadWt > 0 ? papadWt.toFixed(3) : '0.000');

      newRows[index] = targetRow;
      return newRows;
    });
  };

  const addPapadRow = () => {
    setPapadRows(prev => {
      const lastLot = prev.length > 0 ? prev[prev.length - 1].lot_no : '';
      const nextLot = getNextLotString(lastLot);
      return [
        ...prev,
        { 
          s_no: prev.length + 1, 
          item_name: '', 
          item_id: '',
          lot_no: nextLot, 
          box_papad: '', 
          wt_papad: '', 
          box_empty: '', 
          wt_empty: '', 
          tot_wt: '',
          papad_details: [],
          empty_details: []
        }
      ];
    });
  };

  const deletePapadRow = (index) => {
    setPapadRows(prev => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((_, i) => i !== index);
      let currentLot = filtered[0]?.lot_no || 'LOT0001';
      return filtered.map((it, idx) => {
        const lot = idx === 0 ? currentLot : getNextLotString(currentLot);
        currentLot = lot;
        return { ...it, s_no: idx + 1, lot_no: lot };
      });
    });
  };

  const handleFlourRowChange = useCallback((index, field, value) => {
    setFlourRows(prevRows => {
      const newRows = [...prevRows];
      if (field === '__batch__' && typeof value === 'object') {
        newRows[index] = { ...newRows[index], ...value };
      } else {
        newRows[index] = { ...newRows[index], [field]: value };
      }
      return newRows;
    });
  }, []);

  const addFlourRow = useCallback(() => {
    setFlourRows(prev => [
      ...prev,
      { s_no: prev.length + 1, item_name: '', kg: '' }
    ]);
  }, []);

  const deleteFlourRow = useCallback((index) => {
    setFlourRows(prev => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.map((it, idx) => ({ ...it, s_no: idx + 1 }));
    });
  }, []);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (!formData.date || !formData.papadCompany) {
        setMessage('Date and Papad Company are required');
        setMessageType('error');
        setLoading(false);
        return;
      }

      const validPapadItems = papadRows.filter(r => r.item_name);
      if (validPapadItems.length === 0) {
        setMessage('Please add at least one item in Papad Details');
        setMessageType('error');
        setLoading(false);
        return;
      }

      // Combine papad items and flour items
      const itemsPayload = validPapadItems.map((papadItem, idx) => {
        const flourItem = flourRows[idx] || {};
        const generatedLot = papadItem.lot_no || papadItem.lotNo || `LOT${String(idx + 1).padStart(4, '0')}`;
        return {
          itemName: papadItem.item_name,
          item_id: papadItem.item_id,
          lotNo: generatedLot,
          lot_no: generatedLot,
          box_papad: parseFloat(papadItem.box_papad) || 0,
          wt_papad: parseFloat(papadItem.wt_papad) || 0,
          box_empty: parseFloat(papadItem.box_empty) || 0,
          wt_empty: parseFloat(papadItem.wt_empty) || 0,
          totalWt: parseFloat(papadItem.tot_wt) || 0,
          papadKg: parseFloat(flourItem.kg) || parseFloat(papadItem.tot_wt) || 0,
          qty: parseFloat(papadItem.box_papad) || 0,
          weight: parseFloat(papadItem.wt_papad) || 0,
          papad_details: papadItem.papad_details || [],
          empty_details: papadItem.empty_details || []
        };
      });

      const totalQty = itemsPayload.reduce((acc, r) => acc + (parseFloat(r.qty) || 0), 0);
      const totalWeight = itemsPayload.reduce((acc, r) => acc + (parseFloat(r.totalWt) || 0), 0);

      const payload = {
        formData,
        items: itemsPayload,
        totals: {
          totalQty,
          totalWeight,
          totalWages: 0
        }
      };

      const endpoint = editId ? `/papad-in/${editId}` : '/papad-in';
      const method = editId ? 'PUT' : 'POST';

      const result = await api(endpoint, {
        method,
        body: payload
      });

      if (result && (result.success || result.id || result.message?.includes('successfully'))) {
        setMessage(editId ? 'Papad In updated successfully!' : 'Papad In saved successfully!');
        setMessageType('success');
        setTimeout(() => {
          setMessage('');
          navigate('/entry/papad-in-display');
        }, 1500);
      } else {
        setMessage(result?.message || 'Error saving Papad In');
        setMessageType('error');
      }
    } catch (err) {
      console.error(err);
      setMessage('Error saving Papad In: ' + err.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const totalTotWt = papadRows.reduce((acc, r) => acc + (parseFloat(r.tot_wt) || 0), 0);

  // Active modal calculations
  let modalTotalBoxes = 0;
  let modalTotalWt = 0;
  if (activeModal) {
    activeModal.tempRows.forEach(r => {
      const b = parseFloat(r.box) || 0;
      const w = parseFloat(r.wt) || 0;
      modalTotalBoxes += b;
      modalTotalWt += (b > 0 ? b * w : w);
    });
  }

  const activeRow = activeModal ? papadRows[activeModal.rowIndex] : null;

  return (
    <div className="window">
      <div className="screen-title">{editId ? 'Papad In Modification' : 'Papad In Creation'}</div>

      {message && (
        <div className={`message ${messageType}`} style={{ margin: '15px' }}>
          {message}
        </div>
      )}

      {loading && !editId ? (
        <div style={{ padding: '20px', textAlign: 'center' }}>Saving...</div>
      ) : (
        <form onSubmit={handleSubmit}>
          <EntryTopFrame 
            fields={topFrameFields}
            data={formData}
            onChange={handleFieldChange}
          />

          <EntrySection title="Papad Details :">
            <div style={{ overflowX: 'auto', padding: '10px' }}>
              <table className="data-grid" style={{ width: '100%', marginBottom: '15px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>S.No</th>
                    <th style={{ minWidth: '170px' }}>Item Name</th>
                    <th style={{ width: '110px' }}>Lot No (Auto)</th>
                    <th style={{ width: '145px' }}>Box (Papad)</th>
                    <th style={{ width: '145px' }}>Wt (Papad) Kg</th>
                    <th style={{ width: '145px' }}>Box (Empty)</th>
                    <th style={{ width: '145px' }}>Wt (Empty) Kg</th>
                    <th style={{ width: '120px' }}>Tot Wt (Kg)</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>Pop Up Action</th>
                    <th style={{ width: '50px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {papadRows.map((row, index) => {
                    const hasPapadDetails = Array.isArray(row.papad_details) && row.papad_details.length > 0;
                    const hasEmptyDetails = Array.isArray(row.empty_details) && row.empty_details.length > 0;

                    return (
                      <React.Fragment key={index}>
                        <tr>
                          <td align="center" style={{ fontWeight: 'bold' }}>{index + 1}</td>
                          
                          {/* Item Name Master Select */}
                          <td style={{ padding: '4px' }}>
                            <select
                              value={row.item_id || row.item_name || ''}
                              onChange={(e) => handlePapadRowChange(index, 'item_name', e.target.value)}
                              style={{ width: '100%', padding: '5px', border: '1px solid #ccc', borderRadius: '4px' }}
                            >
                              <option value="">-- Select Item --</option>
                              {itemOptions.map((opt, i) => (
                                <option key={i} value={opt.id || opt.item_name || opt.name}>
                                  {opt.item_name || opt.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Lot No (Auto) */}
                          <td style={{ padding: '4px' }}>
                            <input
                              type="text"
                              value={row.lot_no || ''}
                              readOnly
                              style={{ background: '#f0f8ff', fontWeight: 'bold', textAlign: 'center' }}
                            />
                          </td>

                          {/* Box (Papad) */}
                          <td style={{ padding: '4px', position: 'relative' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', width: '100%' }}>
                              <input
                                type="number"
                                value={row.box_papad !== undefined && row.box_papad !== null ? row.box_papad : ''}
                                onChange={(e) => handlePapadRowChange(index, 'box_papad', e.target.value)}
                                placeholder="Qty"
                                style={{ flex: 1, minWidth: '55px', width: '100%', padding: '5px 6px', fontSize: '13px', fontWeight: 'bold', boxSizing: 'border-box' }}
                              />
                              <button
                                type="button"
                                onClick={() => openPapadModal(index)}
                                title="Open Multi-Row Box (Papad) & Wt Pop Up Window"
                                className="btn-popup-trigger"
                                style={{ padding: '3px 5px', fontSize: '12px', flexShrink: 0 }}
                              >
                                📝
                              </button>
                            </div>
                          </td>

                          {/* Wt (Papad) */}
                          <td style={{ padding: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', width: '100%' }}>
                              <input
                                type="number"
                                step="0.001"
                                value={row.wt_papad !== undefined && row.wt_papad !== null ? row.wt_papad : ''}
                                onChange={(e) => handlePapadRowChange(index, 'wt_papad', e.target.value)}
                                placeholder="Kg"
                                style={{ flex: 1, minWidth: '55px', width: '100%', padding: '5px 6px', fontSize: '13px', fontWeight: 'bold', boxSizing: 'border-box' }}
                              />
                              <button
                                type="button"
                                onClick={() => openPapadModal(index)}
                                title="Open Multi-Row Box (Papad) & Wt Pop Up Window"
                                className="btn-popup-trigger"
                                style={{ padding: '3px 5px', fontSize: '12px', flexShrink: 0 }}
                              >
                                📝
                              </button>
                            </div>
                          </td>

                          {/* Box (Empty) */}
                          <td style={{ padding: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', width: '100%' }}>
                              <input
                                type="number"
                                value={row.box_empty !== undefined && row.box_empty !== null ? row.box_empty : ''}
                                onChange={(e) => handlePapadRowChange(index, 'box_empty', e.target.value)}
                                placeholder="Qty"
                                style={{ flex: 1, minWidth: '55px', width: '100%', padding: '5px 6px', fontSize: '13px', fontWeight: 'bold', boxSizing: 'border-box' }}
                              />
                              <button
                                type="button"
                                onClick={() => openEmptyModal(index)}
                                title="Open Multi-Row Box (Empty) & Wt Pop Up Window"
                                className="btn-popup-trigger"
                                style={{ padding: '3px 5px', fontSize: '12px', flexShrink: 0 }}
                              >
                                📝
                              </button>
                            </div>
                          </td>

                          {/* Wt (Empty) */}
                          <td style={{ padding: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', width: '100%' }}>
                              <input
                                type="number"
                                step="0.001"
                                value={row.wt_empty !== undefined && row.wt_empty !== null ? row.wt_empty : ''}
                                onChange={(e) => handlePapadRowChange(index, 'wt_empty', e.target.value)}
                                placeholder="Kg"
                                style={{ flex: 1, minWidth: '55px', width: '100%', padding: '5px 6px', fontSize: '13px', fontWeight: 'bold', boxSizing: 'border-box' }}
                              />
                              <button
                                type="button"
                                onClick={() => openEmptyModal(index)}
                                title="Open Multi-Row Box (Empty) & Wt Pop Up Window"
                                className="btn-popup-trigger"
                                style={{ padding: '3px 5px', fontSize: '12px', flexShrink: 0 }}
                              >
                                📝
                              </button>
                            </div>
                          </td>

                          {/* Tot Wt */}
                          <td style={{ padding: '4px' }}>
                            <input
                              type="text"
                              value={row.tot_wt || '0.000'}
                              readOnly
                              style={{ background: '#e2e8f0', fontWeight: 'bold', color: '#1e3a8a', textAlign: 'right' }}
                            />
                          </td>

                          {/* Pop Up Action */}
                          <td align="center" style={{ padding: '4px' }}>
                            <button
                              type="button"
                              onClick={() => openPapadModal(index)}
                              className="btn-popup-trigger"
                              style={{ padding: '4px 8px', fontSize: '11px', background: '#3b82f6', color: '#fff' }}
                            >
                              📋 Enter Pop Up
                            </button>
                          </td>

                          {/* Delete Row */}
                          <td align="center">
                            <button 
                              type="button"
                              onClick={() => deletePapadRow(index)}
                              style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>

                        {/* Row-wise breakdown display under single Item Name */}
                        {(hasPapadDetails || hasEmptyDetails) && (
                          <tr key={`breakdown-${index}`} style={{ background: '#f8fafc' }}>
                            <td colSpan="10" style={{ padding: '6px 12px', borderBottom: '2px solid #cbd5e1' }}>
                              <div className="sub-row-panel">
                                {hasPapadDetails && (
                                  <div className="sub-row-group">
                                    <span className="sub-row-group-title">📦 Box (Papad) Sub-Entries: </span>
                                    {row.papad_details.map((sub, sIdx) => {
                                      const boxCount = parseFloat(sub.box) || 0;
                                      const boxWt = parseFloat(sub.wt) || 0;
                                      const tot = boxCount > 0 ? boxCount * boxWt : boxWt;
                                      return (
                                        <span key={sIdx} className="sub-row-item">
                                          Row {sIdx + 1}: <strong>{boxCount} Box</strong> × {boxWt.toFixed(3)} Kg = <strong>{tot.toFixed(3)} Kg</strong>
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}

                                {hasEmptyDetails && (
                                  <div className="sub-row-group" style={{ marginTop: '4px' }}>
                                    <span className="sub-row-group-title" style={{ color: '#92400e' }}>🗑️ Box (Empty) Sub-Entries: </span>
                                    {row.empty_details.map((sub, sIdx) => {
                                      const boxCount = parseFloat(sub.box) || 0;
                                      const boxWt = parseFloat(sub.wt) || 0;
                                      const tot = boxCount > 0 ? boxCount * boxWt : boxWt;
                                      return (
                                        <span key={sIdx} className="sub-row-item sub-row-item-empty">
                                          Row {sIdx + 1}: <strong>{boxCount} Empty Box</strong> × {boxWt.toFixed(3)} Kg = <strong>{tot.toFixed(3)} Kg</strong>
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>

              <button
                type="button"
                onClick={addPapadRow}
                style={{
                  padding: '8px 16px',
                  background: '#1976d2',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                + Add Item Row
              </button>
            </div>
          </EntrySection>

          <EntrySection title="Flour Details :">
            <EntryItemsTable
              columns={flourColumns}
              data={flourRows}
              onRowChange={handleFlourRowChange}
              onAddRow={addFlourRow}
              onDeleteRow={deleteFlourRow}
              showActions={true}
            />
          </EntrySection>

          <EntryTotalsRow totals={[
            { label: 'Total Weight (Kg)', value: totalTotWt.toFixed(3) }
          ]} />

          <EntryActions 
            onSave={handleSubmit}
            showSave={true}
            saving={loading}
            saveText={editId ? 'Update' : 'Save'}
          />
        </form>
      )}

      {/* POP UP WINDOW MODAL for Box & Wt Multi-Row Entry */}
      {activeModal && (
        <div className="papad-modal-overlay">
          <div className="papad-modal-content">
            <div className="papad-modal-header">
              <h3>
                {activeModal.type === 'papad' ? '📦 Papad Box & Weight Entries (Pop Up)' : '🗑️ Empty Box & Weight Entries (Pop Up)'}
                {activeRow ? ` — Item: ${activeRow.item_name || 'Select Item'} (Lot: ${activeRow.lot_no})` : ''}
              </h3>
              <button type="button" onClick={closeModal} className="papad-modal-close-btn">✕</button>
            </div>

            <div className="papad-modal-body">
              <div className="papad-modal-info">
                <strong>Multi-Row Field Entry:</strong> Enter two or more rows of box quantity and per-box weight below. Total boxes and total weight will calculate automatically.
              </div>

              <table className="papad-modal-table">
                <thead>
                  <tr>
                    <th style={{ width: '50px', textAlign: 'center' }}>S.No</th>
                    <th>{activeModal.type === 'papad' ? 'Box (Papad) Qty' : 'Box (Empty) Qty'}</th>
                    <th>{activeModal.type === 'papad' ? 'Wt per Box (Kg)' : 'Wt per Empty Box (Kg)'}</th>
                    <th>Total Weight (Kg)</th>
                    <th style={{ width: '60px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeModal.tempRows.map((mRow, mIdx) => {
                    const bCount = parseFloat(mRow.box) || 0;
                    const bWt = parseFloat(mRow.wt) || 0;
                    const rowTot = bCount > 0 ? bCount * bWt : bWt;

                    return (
                      <tr key={mIdx}>
                        <td align="center" style={{ fontWeight: 'bold' }}>{mIdx + 1}</td>
                        <td>
                          <input
                            type="number"
                            value={mRow.box !== undefined && mRow.box !== null ? mRow.box : ''}
                            onChange={(e) => handleModalRowChange(mIdx, 'box', e.target.value)}
                            placeholder="Enter Box Qty"
                            autoFocus={mIdx === 0}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.001"
                            value={mRow.wt !== undefined && mRow.wt !== null ? mRow.wt : ''}
                            onChange={(e) => handleModalRowChange(mIdx, 'wt', e.target.value)}
                            placeholder="Enter Wt (Kg)"
                          />
                        </td>
                        <td style={{ fontWeight: 'bold', color: '#1e3a8a', textAlign: 'right' }}>
                          {rowTot.toFixed(3)} Kg
                        </td>
                        <td align="center">
                          <button
                            type="button"
                            onClick={() => deleteModalRow(mIdx)}
                            style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', padding: '3px 7px', cursor: 'pointer' }}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <button
                type="button"
                onClick={addModalRow}
                className="papad-modal-add-btn"
              >
                + Add Entry Row
              </button>
            </div>

            <div className="papad-modal-footer">
              <div className="papad-modal-totals">
                Total Boxes: <span style={{ color: '#2563eb' }}>{modalTotalBoxes}</span> | Total Wt: <span style={{ color: '#16a34a' }}>{modalTotalWt.toFixed(3)} Kg</span>
              </div>
              <div className="papad-modal-actions">
                <button type="button" onClick={closeModal} className="papad-modal-cancel-btn">
                  Cancel
                </button>
                <button type="button" onClick={saveModalEntries} className="papad-modal-save-btn">
                  Save & Apply Entries
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PapadInCreate;
