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
      lot_no: '', 
      box_papad: '', 
      wt_papad: '', 
      box_empty: '', 
      wt_empty: '', 
      tot_wt: '',
      papad_details: [],
      empty_details: []
    }
  ]);

  // Table 2: Flour Details
  const [flourRows, setFlourRows] = useState([
    { s_no: 1, item_name: '', kg: '' }
  ]);

  // Master items list for dropdown
  const [itemOptions, setItemOptions] = useState([]);
  
  // Modal State for multi-row Pop Up window entry
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
          let nextSno = 1;
          try {
            const snoRes = await api('/papad-in/next-sno');
            const sno = snoRes?.next_s_no ?? snoRes?.next_sno ?? snoRes?.s_no ?? snoRes?.sNo ?? snoRes?.data?.s_no;
            if (sno) nextSno = parseInt(sno, 10);
            else nextSno = await api.getNextSNo('/papad-in');
          } catch (e) {
            nextSno = await api.getNextSNo('/papad-in');
          }

          setFormData(prev => ({ ...prev, sNo: String(nextSno) }));

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
              sNo: String(data.s_no || data.sNo || editId),
              date: data.date ? data.date.substring(0, 10) : '',
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
                  tot_wt: it.tot_wt || it.totWt || it.total_wt || it.totalWt || '',
                  papad_details: pDetails,
                  empty_details: eDetails
                };
              }));

              setFlourRows(items.map((it, idx) => ({
                s_no: idx + 1,
                item_name: it.itemName || it.item_name || '',
                kg: it.papadKg || it.papad_kg || it.kg || ''
              })));
            }
          }
        } catch (err) {
          console.error('Error loading papad-in record:', err);
          setMessage('Error loading record');
          setMessageType('error');
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
  const openPapadModal = (index) => {
    const currRow = papadRows[index];
    const initialList = (currRow.papad_details && currRow.papad_details.length > 0) 
      ? [...currRow.papad_details] 
      : [{ box: currRow.box_papad || '', wt: currRow.wt_papad || '' }];
    
    setActiveModal({
      rowIndex: index,
      type: 'papad',
      title: `Papad Details - Row #${index + 1}`,
      tempRows: initialList
    });
  };

  // Open Pop Up Window for Empty Box/Wt
  const openEmptyModal = (index) => {
    const currRow = papadRows[index];
    const initialList = (currRow.empty_details && currRow.empty_details.length > 0) 
      ? [...currRow.empty_details] 
      : [{ box: currRow.box_empty || '', wt: currRow.wt_empty || '' }];
    
    setActiveModal({
      rowIndex: index,
      type: 'empty',
      title: `Empty Details - Row #${index + 1}`,
      tempRows: initialList
    });
  };

  const handleModalRowChange = (mIdx, field, val) => {
    if (!activeModal) return;
    const updated = [...activeModal.tempRows];
    updated[mIdx] = { ...updated[mIdx], [field]: val };
    setActiveModal({ ...activeModal, tempRows: updated });
  };

  const addModalRow = () => {
    if (!activeModal) return;
    setActiveModal({
      ...activeModal,
      tempRows: [...activeModal.tempRows, { box: '', wt: '' }]
    });
  };

  const removeModalRow = (mIdx) => {
    if (!activeModal || activeModal.tempRows.length <= 1) return;
    const updated = activeModal.tempRows.filter((_, i) => i !== mIdx);
    setActiveModal({ ...activeModal, tempRows: updated });
  };

  const applyModalSave = () => {
    if (!activeModal) return;
    const { rowIndex, type, tempRows } = activeModal;
    
    let totalBoxes = 0;
    let totalWt = 0;

    tempRows.forEach(r => {
      const b = parseFloat(r.box) || 0;
      const w = parseFloat(r.wt) || 0;
      totalBoxes += b;
      totalWt += w;
    });

    setPapadRows(prev => {
      const copy = [...prev];
      const target = { ...copy[rowIndex] };

      if (type === 'papad') {
        target.box_papad = totalBoxes ? String(totalBoxes) : '';
        target.wt_papad = totalWt ? String(totalWt.toFixed(2)) : '';
        target.papad_details = tempRows.filter(r => r.box || r.wt);
      } else {
        target.box_empty = totalBoxes ? String(totalBoxes) : '';
        target.wt_empty = totalWt ? String(totalWt.toFixed(2)) : '';
        target.empty_details = tempRows.filter(r => r.box || r.wt);
      }

      // Recompute Net Tot Wt
      const wtPapadVal = parseFloat(target.wt_papad) || 0;
      const wtEmptyVal = parseFloat(target.wt_empty) || 0;
      const net = Math.max(0, wtPapadVal - wtEmptyVal);
      target.tot_wt = net ? String(net.toFixed(2)) : '';

      copy[rowIndex] = target;
      return copy;
    });

    setActiveModal(null);
  };

  const handlePapadRowChange = (index, field, value) => {
    setPapadRows(prev => {
      const updated = [...prev];
      const row = { ...updated[index] };

      if (field === '__batch__' && typeof value === 'object') {
        Object.assign(row, value);
      } else {
        row[field] = value;
      }

      const wtPapad = parseFloat(row.wt_papad) || 0;
      const wtEmpty = parseFloat(row.wt_empty) || 0;
      const net = Math.max(0, wtPapad - wtEmpty);
      row.tot_wt = net > 0 ? String(net.toFixed(2)) : '';

      updated[index] = row;
      return updated;
    });
  };

  const addPapadRow = () => {
    setPapadRows(prev => {
      const lastLot = prev[prev.length - 1]?.lot_no || '';
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

  const removePapadRow = (index) => {
    if (papadRows.length <= 1) return;
    const filtered = papadRows.filter((_, i) => i !== index);
    setPapadRows(filtered.map((r, i) => ({ ...r, s_no: i + 1 })));
  };

  const handleFlourRowChange = (index, field, value) => {
    setFlourRows(prev => {
      const updated = [...prev];
      if (field === '__batch__' && typeof value === 'object') {
        updated[index] = { ...updated[index], ...value };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  };

  const addFlourRow = () => {
    setFlourRows(prev => [
      ...prev,
      { s_no: prev.length + 1, item_name: '', kg: '' }
    ]);
  };

  const removeFlourRow = (index) => {
    if (flourRows.length <= 1) return;
    const filtered = flourRows.filter((_, i) => i !== index);
    setFlourRows(filtered.map((r, i) => ({ ...r, s_no: i + 1 })));
  };

  // Totals calculations
  const totalBoxPapad = papadRows.reduce((acc, r) => acc + (parseFloat(r.box_papad) || 0), 0);
  const totalWtPapad = papadRows.reduce((acc, r) => acc + (parseFloat(r.wt_papad) || 0), 0);
  const totalBoxEmpty = papadRows.reduce((acc, r) => acc + (parseFloat(r.box_empty) || 0), 0);
  const totalWtEmpty = papadRows.reduce((acc, r) => acc + (parseFloat(r.wt_empty) || 0), 0);
  const totalNetWt = papadRows.reduce((acc, r) => acc + (parseFloat(r.tot_wt) || 0), 0);
  const totalFlourKg = flourRows.reduce((acc, r) => acc + (parseFloat(r.kg) || 0), 0);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!formData.papadCompany) {
      setMessage('Papad Company is required');
      setMessageType('error');
      return;
    }

    const validPapadItems = papadRows.filter(r => r.item_name);
    if (validPapadItems.length === 0) {
      setMessage('Please enter at least one Papad item');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const payload = {
        formData,
        items: papadRows.map(r => ({
          itemName: r.item_name,
          item_name: r.item_name,
          lotNo: r.lot_no,
          lot_no: r.lot_no,
          box_papad: parseFloat(r.box_papad) || 0,
          wt_papad: parseFloat(r.wt_papad) || 0,
          box_empty: parseFloat(r.box_empty) || 0,
          wt_empty: parseFloat(r.wt_empty) || 0,
          tot_wt: parseFloat(r.tot_wt) || 0,
          totalWt: parseFloat(r.tot_wt) || 0,
          total_wt: parseFloat(r.tot_wt) || 0,
          qty: parseFloat(r.box_papad) || 1,
          weight: parseFloat(r.tot_wt) || parseFloat(r.wt_papad) || 0,
          papad_details: r.papad_details,
          empty_details: r.empty_details
        })),
        flourItems: flourRows.map(r => ({
          itemName: r.item_name,
          item_name: r.item_name,
          kg: parseFloat(r.kg) || 0,
          papadKg: parseFloat(r.kg) || 0
        })),
        totals: {
          totalQty: totalBoxPapad,
          totalWeight: totalNetWt,
          totalWages: 0
        }
      };

      const endpoint = editId ? `/papad-in/${editId}` : '/papad-in';
      const method = editId ? 'PUT' : 'POST';
      const res = await api(endpoint, { method, body: payload });

      if (res && (res.success || res.id || res.message)) {
        setMessage(editId ? 'Papad In updated successfully!' : 'Papad In saved successfully!');
        setMessageType('success');
        setTimeout(() => {
          navigate('/entry/papad-in-display');
        }, 1200);
      } else {
        setMessage(res?.message || 'Error saving Papad In record');
        setMessageType('error');
      }
    } catch (err) {
      console.error('Error saving papad in record:', err);
      setMessage(err.message || 'Error saving Papad In');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="window papad-in-window">
      <div className="screen-title">{editId ? 'Papad In Update' : 'Papad In Creation'}</div>

      {message && <div className={`message ${messageType}`}>{message}</div>}

      <form onSubmit={handleSave}>
        {/* Top Header Section */}
        <EntryTopFrame
          fields={topFrameFields}
          data={formData}
          onChange={handleFieldChange}
        />

        {/* 1. Papad Details Table */}
        <div style={{ marginTop: '16px' }}>
          <EntrySection title="Papad Details">
            <div className="entry-items-table-container">
              <table className="entry-items-table">
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>S.No</th>
                    <th>Item Name</th>
                    <th>Lot No</th>
                    <th>Box (Papad)</th>
                    <th>Wt (Papad)</th>
                    <th>Box (Empty)</th>
                    <th>Wt (Empty)</th>
                    <th>Tot Wt (Net)</th>
                    <th style={{ width: '80px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {papadRows.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: 'center' }}>{row.s_no}</td>
                      <td>
                        <select
                          className="uniform-input"
                          value={row.item_name}
                          onChange={(e) => handlePapadRowChange(idx, 'item_name', e.target.value)}
                        >
                          <option value="">-- Select Papad Item --</option>
                          {itemOptions.map((opt, i) => (
                            <option key={opt.id || i} value={opt.item_name || opt.name}>
                              {opt.item_name || opt.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="uniform-input"
                          value={row.lot_no}
                          onChange={(e) => handlePapadRowChange(idx, 'lot_no', e.target.value)}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <input
                            type="number"
                            className="uniform-input"
                            value={row.box_papad}
                            onChange={(e) => handlePapadRowChange(idx, 'box_papad', e.target.value)}
                            placeholder="0"
                          />
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '2px 6px', fontSize: '11px' }}
                            title="Multiple Box Popup"
                            onClick={() => openPapadModal(idx)}
                          >
                            ...
                          </button>
                        </div>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className="uniform-input"
                          value={row.wt_papad}
                          onChange={(e) => handlePapadRowChange(idx, 'wt_papad', e.target.value)}
                          placeholder="0.00"
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <input
                            type="number"
                            className="uniform-input"
                            value={row.box_empty}
                            onChange={(e) => handlePapadRowChange(idx, 'box_empty', e.target.value)}
                            placeholder="0"
                          />
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '2px 6px', fontSize: '11px' }}
                            title="Multiple Empty Box Popup"
                            onClick={() => openEmptyModal(idx)}
                          >
                            ...
                          </button>
                        </div>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className="uniform-input"
                          value={row.wt_empty}
                          onChange={(e) => handlePapadRowChange(idx, 'wt_empty', e.target.value)}
                          placeholder="0.00"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className="uniform-input font-bold"
                          value={row.tot_wt}
                          readOnly
                          style={{ background: '#f8fafc', fontWeight: 'bold', color: '#1f4fb2' }}
                          placeholder="0.00"
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn-danger-icon"
                          onClick={() => removePapadRow(idx)}
                          disabled={papadRows.length <= 1}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: '8px' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addPapadRow}>
                  + Add Papad Row
                </button>
              </div>
            </div>
          </EntrySection>
        </div>

        {/* Papad Details Totals */}
        <div style={{ marginTop: '10px' }}>
          <EntryTotalsRow totals={[
            { label: 'Total Box (Papad)', value: totalBoxPapad },
            { label: 'Total Wt (Papad)', value: totalWtPapad.toFixed(2) },
            { label: 'Total Box (Empty)', value: totalBoxEmpty },
            { label: 'Total Wt (Empty)', value: totalWtEmpty.toFixed(2) },
            { label: 'Net Total Wt', value: `${totalNetWt.toFixed(2)} Kg` }
          ]} />
        </div>

        {/* 2. Flour Details Section */}
        <div style={{ marginTop: '16px' }}>
          <EntrySection title="Flour Details">
            <EntryItemsTable
              columns={flourColumns}
              data={flourRows}
              items={flourRows}
              onRowChange={handleFlourRowChange}
              onItemChange={handleFlourRowChange}
              onAddRow={addFlourRow}
              onAddItem={addFlourRow}
              onDeleteRow={removeFlourRow}
              onRemoveItem={removeFlourRow}
            />
          </EntrySection>
        </div>

        {/* Flour Details Totals */}
        <div style={{ marginTop: '10px' }}>
          <EntryTotalsRow totals={[
            { label: 'Total Flour (Kg)', value: `${totalFlourKg.toFixed(2)} Kg` }
          ]} />
        </div>

        {/* Actions Bar */}
        <div style={{ marginTop: '20px' }}>
          <EntryActions
            onSave={handleSave}
            onCancel={() => navigate('/entry/papad-in-display')}
            saving={loading}
            saveText={editId ? 'Update' : 'Save'}
          />
        </div>
      </form>

      {/* Multi-Row Modal Pop Up for Detailed Entries */}
      {activeModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 10000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '20px',
            minWidth: '380px',
            maxWidth: '500px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#1f4fb2', borderBottom: '2px solid #1f4fb2', paddingBottom: '6px' }}>
              {activeModal.title}
            </h3>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Box</th>
                  <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Wt (Kg)</th>
                  <th style={{ width: '40px', padding: '6px', border: '1px solid #cbd5e1' }}></th>
                </tr>
              </thead>
              <tbody>
                {activeModal.tempRows.map((r, mIdx) => (
                  <tr key={mIdx}>
                    <td style={{ padding: '4px', border: '1px solid #cbd5e1' }}>
                      <input
                        type="number"
                        className="uniform-input"
                        value={r.box}
                        onChange={(e) => handleModalRowChange(mIdx, 'box', e.target.value)}
                        placeholder="Box qty"
                      />
                    </td>
                    <td style={{ padding: '4px', border: '1px solid #cbd5e1' }}>
                      <input
                        type="number"
                        step="0.01"
                        className="uniform-input"
                        value={r.wt}
                        onChange={(e) => handleModalRowChange(mIdx, 'wt', e.target.value)}
                        placeholder="Weight in kg"
                      />
                    </td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>
                      <button
                        type="button"
                        className="btn-danger-icon"
                        onClick={() => removeModalRow(mIdx)}
                        disabled={activeModal.tempRows.length <= 1}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addModalRow}>
                + Add Sub Row
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={applyModalSave}>
                  Apply Totals
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
