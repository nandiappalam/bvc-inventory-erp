import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './PackingCreate.css';
import { EntryTopFrame, EntryActions, EntrySection } from './entry';

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

const PackingCreate = () => {
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(window.location.search);
  const editId = queryParams.get('id');

  const [formData, setFormData] = useState({
    sno: '',
    date: new Date().toISOString().split('T')[0],
    remarks: ''
  });

  // Table 1: Packing From
  const [packingFromRows, setPackingFromRows] = useState([
    { s_no: 1, item_name: '', lot_no: '', qty: '' }
  ]);

  // Table 2: Packing Material
  const [packingMaterialRows, setPackingMaterialRows] = useState([
    { s_no: 1, item_name: '', lot_no: '', qty: '' }
  ]);

  // Table 3: Packing To (Employee Name, Wages, Box, Packet, Total Packet, Total Wages, Auto Lot No)
  const [packingToRows, setPackingToRows] = useState([
    { s_no: 1, item_name: '', lot_no: '', employee_name: '', wages: '', box: '', packet: '', total_packet: '', total_wages: '' }
  ]);

  const [itemList, setItemList] = useState([]);
  const [availableLotsMap, setAvailableLotsMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  // Filter FG (Finished Goods) items for Packing TO dropdown
  const fgItemList = itemList.filter(it => {
    const grp = (it.item_group || '').toLowerCase().trim();
    const name = (it.name || it.item_name || '').toLowerCase().trim();
    if (grp === 'packing material' || grp === 'raw material') return false;
    return (
      grp === 'fg' ||
      grp === 'finished goods' ||
      grp.includes('papad') ||
      grp.includes('finished') ||
      grp.includes('fg') ||
      name.includes('papad') ||
      name.includes('pack')
    );
  });
  const packingToItems = fgItemList.length > 0 ? fgItemList : itemList.filter(it => (it.item_group || '').toLowerCase() !== 'packing material');

  const fetchLotsForItem = useCallback(async (itemName) => {
    if (!itemName) return;
    try {
      const res = await api(`/stock/available-lots?item_name=${encodeURIComponent(itemName)}`);
      const list = Array.isArray(res) ? res : (res?.data || res?.rows || []);
      setAvailableLotsMap(prev => ({ ...prev, [itemName]: list }));
    } catch (err) {
      console.error('Error fetching lots for item:', err);
    }
  }, []);

  // Load masters for dropdowns
  useEffect(() => {
    const fetchMasters = async () => {
      try {
        const itemsRes = await api('/masters/items').catch(() => []);
        const items = Array.isArray(itemsRes) ? itemsRes : (itemsRes?.data || []);
        setItemList(items);
      } catch (err) {
        console.error('Failed to load masters for packing:', err);
      }
    };
    fetchMasters();
  }, []);

  useEffect(() => {
    const itemNames = new Set([
      ...packingFromRows.map(r => r.item_name),
      ...packingMaterialRows.map(r => r.item_name)
    ].filter(Boolean));

    itemNames.forEach(name => {
      if (!availableLotsMap[name]) {
        fetchLotsForItem(name);
      }
    });
  }, [packingFromRows, packingMaterialRows, fetchLotsForItem, availableLotsMap]);

  // Fetch next S.No or edit data
  useEffect(() => {
    const initData = async () => {
      try {
        if (editId) {
          const res = await api(`/packing/${editId}`);
          if (res) {
            setFormData({
              sno: String(res.s_no || res.sNo || ''),
              date: res.date ? res.date.substring(0, 10) : new Date().toISOString().split('T')[0],
              remarks: res.remarks || ''
            });

            if (Array.isArray(res.items) && res.items.length > 0) {
              const fromItems = [];
              const matItems = [];
              const toItems = [];

              res.items.forEach(it => {
                const sec = it.remarks ? (it.remarks.includes('section:') ? it.remarks.split('section:')[1].trim() : '') : '';
                if (sec === 'material') {
                  matItems.push({
                    s_no: matItems.length + 1,
                    item_name: it.item_name || '',
                    lot_no: it.lot_no || '',
                    qty: String(it.qty || it.weight || '')
                  });
                } else if (sec === 'to') {
                  const wages = it.rate || '';
                  const box = it.box || '';
                  const packet = it.packet || '';
                  const totPacket = it.total_packet || it.qty || (parseFloat(box) * parseFloat(packet) || '');
                  const totWages = it.tot_wt || (parseFloat(wages) * parseFloat(totPacket) || '');
                  toItems.push({
                    s_no: toItems.length + 1,
                    item_name: it.item_name || '',
                    lot_no: it.lot_no || '',
                    employee_name: it.employee_name || '',
                    wages: String(wages || ''),
                    box: String(box || ''),
                    packet: String(packet || ''),
                    total_packet: String(totPacket || ''),
                    total_wages: String(totWages || '')
                  });
                } else {
                  fromItems.push({
                    s_no: fromItems.length + 1,
                    item_name: it.item_name || '',
                    lot_no: it.lot_no || '',
                    qty: String(it.qty || it.weight || '')
                  });
                }
              });

              if (fromItems.length > 0) setPackingFromRows(fromItems);
              if (matItems.length > 0) setPackingMaterialRows(matItems);
              if (toItems.length > 0) setPackingToRows(toItems);
            }
          }
        } else {
          const snoRes = await api('/packing/next-sno');
          const lotRes = await api('/stock/next-lot-no').catch(() => null);
          const startLot = (lotRes && lotRes.lot_no) ? lotRes.lot_no : 'LOT0001';

          if (snoRes && snoRes.success) {
            const nextSno = String(snoRes.next_s_no);
            setFormData(prev => ({ ...prev, sno: nextSno }));
            
            // Generate auto lot no for initial Packing To row
            setPackingToRows([{
              s_no: 1,
              item_name: '',
              lot_no: startLot,
              employee_name: '',
              wages: '',
              box: '',
              packet: '',
              total_packet: '',
              total_wages: ''
            }]);
          } else {
            setPackingToRows([{
              s_no: 1,
              item_name: '',
              lot_no: startLot,
              employee_name: '',
              wages: '',
              box: '',
              packet: '',
              total_packet: '',
              total_wages: ''
            }]);
          }
        }
      } catch (err) {
        console.error('Error initializing packing form:', err);
      }
    };
    initData();
  }, [editId]);

  const handleChange = (nameOrEvent, value) => {
    if (nameOrEvent && nameOrEvent.target) {
      setFormData(prev => ({ ...prev, [nameOrEvent.target.name]: nameOrEvent.target.value }));
    } else {
      setFormData(prev => ({ ...prev, [nameOrEvent]: value }));
    }
  };

  // Packing From Handlers - Auto fill on Lot selection
  const handleFromChange = (idx, field, val) => {
    setPackingFromRows(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: val };
      if (field === 'item_name') {
        updated[idx].lot_no = '';
        fetchLotsForItem(val);
      } else if (field === 'lot_no') {
        const itemName = updated[idx].item_name;
        const lots = availableLotsMap[itemName] || [];
        const selectedLot = lots.find(l => l.lot_no === val);
        if (selectedLot) {
          updated[idx].qty = String(selectedLot.remaining_quantity ?? selectedLot.quantity ?? '');
        }
      }
      return updated;
    });
  };

  const addFromRow = () => {
    setPackingFromRows(prev => [...prev, { s_no: prev.length + 1, item_name: '', lot_no: '', qty: '' }]);
  };

  const deleteFromRow = (idx) => {
    setPackingFromRows(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx).map((r, i) => ({ ...r, s_no: i + 1 })));
  };

  // Packing Material Handlers - Auto fill on Lot selection
  const handleMaterialChange = (idx, field, val) => {
    setPackingMaterialRows(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: val };
      if (field === 'item_name') {
        updated[idx].lot_no = '';
        fetchLotsForItem(val);
      } else if (field === 'lot_no') {
        const itemName = updated[idx].item_name;
        const lots = availableLotsMap[itemName] || [];
        const selectedLot = lots.find(l => l.lot_no === val);
        if (selectedLot) {
          updated[idx].qty = String(selectedLot.remaining_quantity ?? selectedLot.quantity ?? '');
        }
      }
      return updated;
    });
  };

  const addMaterialRow = () => {
    setPackingMaterialRows(prev => [...prev, { s_no: prev.length + 1, item_name: '', lot_no: '', qty: '' }]);
  };

  const deleteMaterialRow = (idx) => {
    setPackingMaterialRows(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx).map((r, i) => ({ ...r, s_no: i + 1 })));
  };

  // Packing To Handlers (Box * Packet = Total Packet, Total Wages = Wages * Total Packet)
  const handleToChange = (idx, field, val) => {
    setPackingToRows(prev => {
      const updated = [...prev];
      const row = { ...updated[idx], [field]: val };

      const box = parseFloat(field === 'box' ? val : row.box) || 0;
      const packet = parseFloat(field === 'packet' ? val : row.packet) || 0;
      const wages = parseFloat(field === 'wages' ? val : row.wages) || 0;

      // Box * Packet = Total Packet
      let totalPacket = parseFloat(row.total_packet) || 0;
      if (field === 'box' || field === 'packet') {
        if (box > 0 && packet > 0) {
          totalPacket = box * packet;
        } else if (box > 0 && packet === 0) {
          totalPacket = box;
        } else if (packet > 0 && box === 0) {
          totalPacket = packet;
        } else {
          totalPacket = 0;
        }
        row.total_packet = totalPacket > 0 ? String(totalPacket) : '';
      } else if (field === 'total_packet') {
        totalPacket = parseFloat(val) || 0;
      }

      // Total Wages = Wages * Total Packet
      if (field === 'wages' || field === 'box' || field === 'packet' || field === 'total_packet') {
        if (wages > 0 && totalPacket > 0) {
          row.total_wages = (wages * totalPacket).toFixed(2);
        } else {
          row.total_wages = '';
        }
      }

      updated[idx] = row;
      return updated;
    });
  };

  const addToRow = () => {
    setPackingToRows(prev => {
      const nextIdx = prev.length + 1;
      const lastLot = prev.length > 0 ? prev[prev.length - 1].lot_no : '';
      const autoLot = getNextLotString(lastLot);
      return [...prev, { s_no: nextIdx, item_name: '', lot_no: autoLot, employee_name: '', wages: '', box: '', packet: '', total_packet: '', total_wages: '' }];
    });
  };

  const deleteToRow = (idx) => {
    setPackingToRows(prev => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((_, i) => i !== idx);
      let currentLot = filtered[0]?.lot_no || 'LOT0001';
      return filtered.map((r, i) => {
        const lot = i === 0 ? currentLot : getNextLotString(currentLot);
        currentLot = lot;
        return { ...r, s_no: i + 1, lot_no: lot };
      });
    });
  };

  const topFrameFields = [
    { name: 'sno', label: 'S.No', type: 'text', readOnly: true, value: formData.sno },
    { name: 'date', label: 'Date', type: 'date', value: formData.date },
    { name: 'remarks', label: 'Remarks', type: 'text', value: formData.remarks },
  ];

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const items = [];

      // Add Packing From items
      packingFromRows.forEach(r => {
        if (r.item_name) {
          items.push({
            item_name: r.item_name,
            lot_no: r.lot_no,
            qty: parseFloat(r.qty) || 0,
            weight: parseFloat(r.qty) || 0,
            remarks: 'section:from'
          });
        }
      });

      // Add Packing Material items
      packingMaterialRows.forEach(r => {
        if (r.item_name) {
          items.push({
            item_name: r.item_name,
            lot_no: r.lot_no,
            qty: parseFloat(r.qty) || 0,
            weight: parseFloat(r.qty) || 0,
            remarks: 'section:material'
          });
        }
      });

      // Add Packing To items
      packingToRows.forEach((r, idx) => {
        if (r.item_name) {
          const autoLot = r.lot_no || `PK-${formData.sno || '1'}-${idx + 1}`;
          const box = parseFloat(r.box) || 0;
          const packet = parseFloat(r.packet) || 0;
          const totPacket = parseFloat(r.total_packet) || (box * packet) || 0;
          const wages = parseFloat(r.wages) || 0;
          const totWages = parseFloat(r.total_wages) || (wages * totPacket) || 0;

          items.push({
            item_name: r.item_name,
            lot_no: autoLot,
            employee_name: r.employee_name || '',
            rate: wages,
            box: box,
            packet: packet,
            total_packet: totPacket,
            qty: totPacket,
            tot_wt: totWages,
            remarks: 'section:to'
          });
        }
      });

      if (items.length === 0) {
        setMessage('Please enter at least one item row');
        setMessageType('error');
        setLoading(false);
        return;
      }

      const payload = { formData, items };
      let res;
      if (editId) {
        res = await api(`/packing/${editId}`, { method: 'PUT', body: payload });
      } else {
        res = await api('/packing', { method: 'POST', body: payload });
      }

      if (res && res.success) {
        setMessage(editId ? 'Packing updated successfully!' : 'Packing saved successfully!');
        setMessageType('success');
        setTimeout(() => {
          navigate('/entry/packing-display');
        }, 1500);
      } else {
        setMessage(res?.message || 'Failed to save packing entry.');
        setMessageType('error');
      }
    } catch (err) {
      console.error('Error saving packing entry:', err);
      setMessage('Error: ' + err.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="window">
      <div className="screen-title">{editId ? 'Packing Edit' : 'Packing Creation'}</div>

      {message && <div className={`message ${messageType}`}>{message}</div>}

      <form onSubmit={handleSubmit}>
        <EntryTopFrame
          fields={topFrameFields}
          data={formData}
          onChange={handleChange}
        />

        {/* Section 1: Packing From */}
        <EntrySection title="Packing From">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', margin: '8px 0' }}>
            <thead>
              <tr style={{ background: '#3f6fc0', color: '#fff' }}>
                <th style={{ width: '50px', padding: '6px', border: '1px solid #2d589d' }}>No</th>
                <th style={{ padding: '6px', border: '1px solid #2d589d' }}>Item Name</th>
                <th style={{ padding: '6px', border: '1px solid #2d589d' }}>Lot No</th>
                <th style={{ padding: '6px', border: '1px solid #2d589d', width: '120px' }}>Qty</th>
                <th style={{ width: '50px', padding: '6px', border: '1px solid #2d589d' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {packingFromRows.map((row, idx) => (
                <tr key={idx}>
                  <td style={{ textAlign: 'center', padding: '4px', border: '1px solid #cbd5e1' }}>{idx + 1}</td>
                  <td style={{ padding: '4px', border: '1px solid #cbd5e1' }}>
                    <select
                      style={{ width: '100%', padding: '4px', borderRadius: '3px', border: '1px solid #ccc' }}
                      value={row.item_name}
                      onChange={(e) => handleFromChange(idx, 'item_name', e.target.value)}
                    >
                      <option value="">Select Item...</option>
                      {itemList.map((it, i) => (
                        <option key={i} value={it.name || it.item_name}>{it.name || it.item_name}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '4px', border: '1px solid #cbd5e1' }}>
                    <select
                      style={{ width: '100%', padding: '4px', borderRadius: '3px', border: '1px solid #ccc' }}
                      value={row.lot_no}
                      onChange={(e) => handleFromChange(idx, 'lot_no', e.target.value)}
                    >
                      <option value="">Select Lot...</option>
                      {row.lot_no && !(availableLotsMap[row.item_name] || []).some(l => l.lot_no === row.lot_no) && (
                        <option value={row.lot_no}>{row.lot_no}</option>
                      )}
                      {(availableLotsMap[row.item_name] || []).map((l, i) => (
                        <option key={i} value={l.lot_no}>
                          {l.display || `${l.lot_no} (${l.remaining_quantity || 0} avail)`}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '4px', border: '1px solid #cbd5e1' }}>
                    <input
                      type="number"
                      style={{ width: '100%', padding: '4px', borderRadius: '3px', border: '1px solid #ccc' }}
                      value={row.qty}
                      onChange={(e) => handleFromChange(idx, 'qty', e.target.value)}
                    />
                  </td>
                  <td style={{ textAlign: 'center', padding: '4px', border: '1px solid #cbd5e1' }}>
                    <button type="button" onClick={() => deleteFromRow(idx)} style={{ background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '3px', padding: '2px 6px', cursor: 'pointer' }}>X</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={addFromRow} style={{ background: '#3f6fc0', color: '#fff', border: 'none', borderRadius: '3px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px' }}>+ Add Row</button>
        </EntrySection>

        {/* Section 2: Packing Material */}
        <EntrySection title="Packing Material">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', margin: '8px 0' }}>
            <thead>
              <tr style={{ background: '#3f6fc0', color: '#fff' }}>
                <th style={{ width: '50px', padding: '6px', border: '1px solid #2d589d' }}>No</th>
                <th style={{ padding: '6px', border: '1px solid #2d589d' }}>Item Name</th>
                <th style={{ padding: '6px', border: '1px solid #2d589d' }}>Lot No</th>
                <th style={{ padding: '6px', border: '1px solid #2d589d', width: '120px' }}>Qty</th>
                <th style={{ width: '50px', padding: '6px', border: '1px solid #2d589d' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {packingMaterialRows.map((row, idx) => (
                <tr key={idx}>
                  <td style={{ textAlign: 'center', padding: '4px', border: '1px solid #cbd5e1' }}>{idx + 1}</td>
                  <td style={{ padding: '4px', border: '1px solid #cbd5e1' }}>
                    <select
                      style={{ width: '100%', padding: '4px', borderRadius: '3px', border: '1px solid #ccc' }}
                      value={row.item_name}
                      onChange={(e) => handleMaterialChange(idx, 'item_name', e.target.value)}
                    >
                      <option value="">Select Item...</option>
                      {itemList.map((it, i) => (
                        <option key={i} value={it.name || it.item_name}>{it.name || it.item_name}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '4px', border: '1px solid #cbd5e1' }}>
                    <select
                      style={{ width: '100%', padding: '4px', borderRadius: '3px', border: '1px solid #ccc' }}
                      value={row.lot_no}
                      onChange={(e) => handleMaterialChange(idx, 'lot_no', e.target.value)}
                    >
                      <option value="">Select Lot...</option>
                      {row.lot_no && !(availableLotsMap[row.item_name] || []).some(l => l.lot_no === row.lot_no) && (
                        <option value={row.lot_no}>{row.lot_no}</option>
                      )}
                      {(availableLotsMap[row.item_name] || []).map((l, i) => (
                        <option key={i} value={l.lot_no}>
                          {l.display || `${l.lot_no} (${l.remaining_quantity || 0} avail)`}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '4px', border: '1px solid #cbd5e1' }}>
                    <input
                      type="number"
                      style={{ width: '100%', padding: '4px', borderRadius: '3px', border: '1px solid #ccc' }}
                      value={row.qty}
                      onChange={(e) => handleMaterialChange(idx, 'qty', e.target.value)}
                    />
                  </td>
                  <td style={{ textAlign: 'center', padding: '4px', border: '1px solid #cbd5e1' }}>
                    <button type="button" onClick={() => deleteMaterialRow(idx)} style={{ background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '3px', padding: '2px 6px', cursor: 'pointer' }}>X</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={addMaterialRow} style={{ background: '#3f6fc0', color: '#fff', border: 'none', borderRadius: '3px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px' }}>+ Add Row</button>
        </EntrySection>

        {/* Section 3: Packing To */}
        <EntrySection title="Packing To">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', margin: '8px 0' }}>
            <thead>
              <tr style={{ background: '#3f6fc0', color: '#fff' }}>
                <th style={{ width: '40px', padding: '6px', border: '1px solid #2d589d' }}>No</th>
                <th style={{ padding: '6px', border: '1px solid #2d589d' }}>Item Name (FG)</th>
                <th style={{ padding: '6px', border: '1px solid #2d589d', width: '110px' }}>Lot No (Auto)</th>
                <th style={{ padding: '6px', border: '1px solid #2d589d' }}>Employee Name</th>
                <th style={{ padding: '6px', border: '1px solid #2d589d', width: '80px' }}>Wages</th>
                <th style={{ padding: '6px', border: '1px solid #2d589d', width: '80px' }}>Box</th>
                <th style={{ padding: '6px', border: '1px solid #2d589d', width: '80px' }}>Packet</th>
                <th style={{ padding: '6px', border: '1px solid #2d589d', width: '100px' }}>Total Packet</th>
                <th style={{ padding: '6px', border: '1px solid #2d589d', width: '100px' }}>Total Wages</th>
                <th style={{ width: '50px', padding: '6px', border: '1px solid #2d589d' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {packingToRows.map((row, idx) => (
                <tr key={idx}>
                  <td style={{ textAlign: 'center', padding: '4px', border: '1px solid #cbd5e1' }}>{idx + 1}</td>
                  <td style={{ padding: '4px', border: '1px solid #cbd5e1' }}>
                    <select
                      style={{ width: '100%', padding: '4px', borderRadius: '3px', border: '1px solid #ccc' }}
                      value={row.item_name}
                      onChange={(e) => handleToChange(idx, 'item_name', e.target.value)}
                    >
                      <option value="">Select Item...</option>
                      {itemList.map((it, i) => (
                        <option key={i} value={it.name || it.item_name}>{it.name || it.item_name}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '4px', border: '1px solid #cbd5e1' }}>
                    <input
                      type="text"
                      readOnly
                      style={{ width: '100%', padding: '4px', borderRadius: '3px', border: '1px solid #ccc', background: '#f1f5f9', fontWeight: 'bold' }}
                      value={row.lot_no || 'LOT0001'}
                    />
                  </td>
                  <td style={{ padding: '4px', border: '1px solid #cbd5e1' }}>
                    <input
                      type="text"
                      style={{ width: '100%', padding: '4px', borderRadius: '3px', border: '1px solid #ccc' }}
                      placeholder="Employee Name"
                      value={row.employee_name}
                      onChange={(e) => handleToChange(idx, 'employee_name', e.target.value)}
                    />
                  </td>
                  <td style={{ padding: '4px', border: '1px solid #cbd5e1' }}>
                    <input
                      type="number"
                      step="any"
                      style={{ width: '100%', padding: '4px', borderRadius: '3px', border: '1px solid #ccc' }}
                      placeholder="Wages"
                      value={row.wages}
                      onChange={(e) => handleToChange(idx, 'wages', e.target.value)}
                    />
                  </td>
                  <td style={{ padding: '4px', border: '1px solid #cbd5e1' }}>
                    <input
                      type="number"
                      step="any"
                      style={{ width: '100%', padding: '4px', borderRadius: '3px', border: '1px solid #ccc' }}
                      placeholder="Box"
                      value={row.box}
                      onChange={(e) => handleToChange(idx, 'box', e.target.value)}
                    />
                  </td>
                  <td style={{ padding: '4px', border: '1px solid #cbd5e1' }}>
                    <input
                      type="number"
                      step="any"
                      style={{ width: '100%', padding: '4px', borderRadius: '3px', border: '1px solid #ccc' }}
                      placeholder="Packet"
                      value={row.packet}
                      onChange={(e) => handleToChange(idx, 'packet', e.target.value)}
                    />
                  </td>
                  <td style={{ padding: '4px', border: '1px solid #cbd5e1' }}>
                    <input
                      type="number"
                      step="any"
                      style={{ width: '100%', padding: '4px', borderRadius: '3px', border: '1px solid #ccc', background: '#f8fafc', fontWeight: 'bold' }}
                      placeholder="Tot Pkt"
                      value={row.total_packet}
                      onChange={(e) => handleToChange(idx, 'total_packet', e.target.value)}
                    />
                  </td>
                  <td style={{ padding: '4px', border: '1px solid #cbd5e1' }}>
                    <input
                      type="text"
                      readOnly
                      style={{ width: '100%', padding: '4px', borderRadius: '3px', border: '1px solid #ccc', background: '#f8fafc', fontWeight: 'bold', textAlign: 'right' }}
                      value={row.total_wages}
                    />
                  </td>
                  <td style={{ textAlign: 'center', padding: '4px', border: '1px solid #cbd5e1' }}>
                    <button type="button" onClick={() => deleteToRow(idx)} style={{ background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '3px', padding: '2px 6px', cursor: 'pointer' }}>X</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={addToRow} style={{ background: '#3f6fc0', color: '#fff', border: 'none', borderRadius: '3px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px' }}>+ Add Row</button>
        </EntrySection>

        <EntryActions
          onSave={handleSubmit}
          saving={loading}
          saveText="Save"
        />
      </form>
    </div>
  );
};

export default PackingCreate;
