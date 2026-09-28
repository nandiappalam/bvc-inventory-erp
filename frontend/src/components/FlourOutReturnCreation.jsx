import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './FlourOutReturnCreation.css';
import api from '../utils/api';
import { EntryTopFrame, EntryItemsTable, EntryTotalsRow, EntryActions } from './entry';

const FlourOutReturnCreation = () => {
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const editId = searchParams.get('id');

  const [formData, setFormData] = useState({
    sno: '',
    sNo: '',
    date: new Date().toISOString().slice(0, 10),
    papadCompany: '',
    taxType: '',
    remarks: ''
  });

  const [items, setItems] = useState([
    { no: 1, item_name: '', lot_no: '', weight: '', qty: '', total_wt: '', papad_kg: '', cost: '', wages_per_bag: '', wages: '' }
  ]);

  const [totals, setTotals] = useState({
    totalQty: 0,
    totalWeight: 0,
    totalWages: 0
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  const updateTotals = useCallback((newItems) => {
    let tQty = 0;
    let tWeight = 0;
    let tWages = 0;

    newItems.forEach(it => {
      tQty += parseFloat(it.qty) || 0;
      tWeight += parseFloat(it.total_wt) || 0;
      tWages += parseFloat(it.wages) || 0;
    });

    setTotals({
      totalQty: tQty,
      totalWeight: tWeight,
      totalWages: tWages
    });
  }, []);

  // Fetch next S.No when creating new entry
  useEffect(() => {
    if (!editId) {
      const fetchNextSno = async () => {
        try {
          const res = await api('/flour-out-return/next-sno');
          const sno = res?.next_s_no ?? res?.next_sno ?? res?.s_no ?? res?.sno ?? res?.data?.s_no;
          if (sno) {
            setFormData(prev => ({ ...prev, sno: String(sno), sNo: String(sno) }));
          } else {
            const fallback = await api.getNextSNo('/flour-out-return');
            setFormData(prev => ({ ...prev, sno: String(fallback), sNo: String(fallback) }));
          }
        } catch (err) {
          console.error('Error fetching next S.No for Flour Out Return:', err);
        }
      };
      fetchNextSno();
    }
  }, [editId]);

  // Load existing record if editId is provided
  useEffect(() => {
    if (editId) {
      const fetchRecord = async () => {
        setLoading(true);
        try {
          const data = await api(`/flour-out-return/${editId}`);
          if (data) {
            setFormData({
              sno: String(data.s_no || data.sno || data.sNo || editId),
              sNo: String(data.s_no || data.sno || data.sNo || editId),
              date: data.date ? data.date.substring(0, 10) : new Date().toISOString().slice(0, 10),
              papadCompany: String(data.papad_company || data.papadCompany || ''),
              taxType: data.tax_type || data.taxType || '',
              remarks: data.remarks || ''
            });

            if (Array.isArray(data.items) && data.items.length > 0) {
              const loadedItems = data.items.map((it, idx) => {
                const w = parseFloat(it.weight) || 0;
                const q = parseFloat(it.qty) || 0;
                const totWt = (w * q).toFixed(2);
                const wagesBag = parseFloat(it.wages_bag || it.wages_per_bag || it.wagesBag) || 0;
                const papadKg = parseFloat(it.papad_kg || it.papadKg) || 0;
                const cost = parseFloat(it.cost) || 0;
                let wages = q * wagesBag;
                if (!wages && papadKg && cost) wages = papadKg * cost;

                return {
                  no: idx + 1,
                  item_name: it.item_name || it.itemName || '',
                  lot_no: it.lot_no || it.lotNo || '',
                  weight: String(w || ''),
                  qty: String(q || ''),
                  total_wt: String(totWt),
                  papad_kg: String(papadKg || ''),
                  cost: String(cost || ''),
                  wages_per_bag: String(wagesBag || ''),
                  wages: wages ? wages.toFixed(2) : '0.00'
                };
              });
              setItems(loadedItems);
              updateTotals(loadedItems);
            }
          }
        } catch (err) {
          console.error('Error fetching flour out return for editing:', err);
          setMessage('Error fetching record details');
          setMessageType('error');
        } finally {
          setLoading(false);
        }
      };
      fetchRecord();
    }
  }, [editId, updateTotals]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, field, value) => {
    setItems(prevItems => {
      const newItems = [...prevItems];
      if (!newItems[index]) return prevItems;

      if (field === '__batch__' && typeof value === 'object') {
        newItems[index] = { ...newItems[index], ...value };
      } else {
        newItems[index] = { ...newItems[index], [field]: value };
      }

      const w = parseFloat(newItems[index].weight) || 0;
      const q = parseFloat(newItems[index].qty) || 0;
      const wagesBag = parseFloat(newItems[index].wages_per_bag || newItems[index].wages_bag) || 0;
      const papadKg = parseFloat(newItems[index].papad_kg) || 0;
      const cost = parseFloat(newItems[index].cost) || 0;

      // Auto-calc Total Wt
      if (w > 0 && q > 0) {
        newItems[index].total_wt = (w * q).toFixed(2);
      }

      // Auto-calc Wages
      let wages = q * wagesBag;
      if (!wages && papadKg && cost) wages = papadKg * cost;
      if (wages > 0) {
        newItems[index].wages = wages.toFixed(2);
      }

      updateTotals(newItems);
      return newItems;
    });
  };

  const addItem = (newRow) => {
    setItems(prev => {
      const nextNo = prev.length + 1;
      return [
        ...prev,
        (newRow && typeof newRow === 'object' && (newRow.item_name !== undefined || newRow.sno !== undefined))
          ? {
              no: nextNo,
              item_name: newRow.item_name || '',
              lot_no: newRow.lot_no || '',
              weight: newRow.weight || '',
              qty: newRow.qty || '',
              total_wt: newRow.total_wt || '',
              papad_kg: newRow.papad_kg || '',
              cost: newRow.cost || '',
              wages_per_bag: newRow.wages_per_bag || newRow.wages_bag || '',
              wages: newRow.wages || ''
            }
          : { no: nextNo, item_name: '', lot_no: '', weight: '', qty: '', total_wt: '', papad_kg: '', cost: '', wages_per_bag: '', wages: '' }
      ];
    });
  };

  const removeItem = (index) => {
    setItems(prev => {
      if (prev.length <= 1) return prev;
      const newItems = prev.filter((_, i) => i !== index).map((it, idx) => ({ ...it, no: idx + 1 }));
      updateTotals(newItems);
      return newItems;
    });
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!formData.papadCompany) {
      setMessage('Papad Company is required');
      setMessageType('error');
      return;
    }

    const validItems = items.filter(it => it.item_name && parseFloat(it.qty) > 0);
    if (validItems.length === 0) {
      setMessage('Please add at least one item with valid quantity');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const endpoint = editId ? `/flour-out-return/${editId}` : '/flour-out-return';
      const method = editId ? 'PUT' : 'POST';

      const payload = {
        formData: {
          sNo: formData.sno || formData.sNo,
          s_no: formData.sno || formData.sNo,
          date: formData.date,
          papadCompany: formData.papadCompany,
          taxType: formData.taxType,
          remarks: formData.remarks
        },
        items: items.map(it => ({
          itemName: it.item_name,
          item_name: it.item_name,
          lotNo: it.lot_no,
          lot_no: it.lot_no,
          weight: parseFloat(it.weight) || 0,
          qty: parseFloat(it.qty) || 0,
          totalWt: parseFloat(it.total_wt) || 0,
          total_wt: parseFloat(it.total_wt) || 0,
          papadKg: parseFloat(it.papad_kg) || 0,
          papad_kg: parseFloat(it.papad_kg) || 0,
          cost: parseFloat(it.cost) || 0,
          wagesBag: parseFloat(it.wages_per_bag) || 0,
          wages_bag: parseFloat(it.wages_per_bag) || 0,
          wages: parseFloat(it.wages) || 0
        })),
        totals
      };

      const res = await api(endpoint, { method, body: payload });
      if (res && (res.success || res.id || res.message)) {
        setMessage(editId ? 'Flour Out Return updated successfully!' : 'Flour Out Return saved successfully!');
        setMessageType('success');
        setTimeout(() => {
          navigate('/entry/flour-out-return-display');
        }, 1200);
      } else {
        setMessage(res?.message || 'Failed to save Flour Out Return');
        setMessageType('error');
      }
    } catch (err) {
      console.error(err);
      setMessage(err.message || 'Error saving Flour Out Return');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const topFields = [
    { name: 'sno', label: 'S.No.', type: 'text', readOnly: true, col: 1 },
    { name: 'date', label: 'Date', type: 'date', col: 1 },
    { name: 'papadCompany', label: 'Papad Company', type: 'masterSelect', masterType: 'papad_companies', col: 2 },
    { name: 'taxType', label: 'Tax Type', type: 'select', options: [{ value: '', label: 'Select Tax Type' }, { value: 'SGST/CGST', label: 'SGST/CGST' }, { value: 'IGST', label: 'IGST' }, { value: 'Exempted', label: 'Exempted' }], col: 2 },
    { name: 'remarks', label: 'Remarks', type: 'text', col: 3 }
  ];

  const itemColumns = [
    { key: 'item_name', title: 'Item Name', type: 'masterSelect', masterType: 'items' },
    { key: 'lot_no', title: 'Lot No', type: 'text' },
    { key: 'weight', title: 'Weight', type: 'number' },
    { key: 'qty', title: 'Qty', type: 'number' },
    { key: 'total_wt', title: 'Total Wt', type: 'number', readOnly: true },
    { key: 'papad_kg', title: 'Papad (Kg)', type: 'number' },
    { key: 'cost', title: 'Cost', type: 'number' },
    { key: 'wages_per_bag', title: 'Wages / Bag', type: 'number' },
    { key: 'wages', title: 'Wages', type: 'number', readOnly: true }
  ];

  const totalsData = [
    { label: 'Total Qty', value: totals.totalQty },
    { label: 'Total Weight', value: totals.totalWeight.toFixed(2) },
    { label: 'Total Wages', value: `₹${totals.totalWages.toFixed(2)}` }
  ];

  return (
    <div className="window flour-out-return-window">
      <div className="screen-title">{editId ? 'Flour Out Return Update' : 'Flour Out Return Creation'}</div>
      {message && <div className={`message ${messageType}`}>{message}</div>}

      <form onSubmit={handleSubmit}>
        <EntryTopFrame
          fields={topFields}
          data={formData}
          onChange={handleFormChange}
        />

        <div style={{ marginTop: '15px' }}>
          <EntryItemsTable
            columns={itemColumns}
            data={items}
            items={items}
            onRowChange={handleItemChange}
            onItemChange={handleItemChange}
            onAddRow={addItem}
            onAddItem={addItem}
            onDeleteRow={removeItem}
            onRemoveItem={removeItem}
            showActions={true}
            editable={true}
            lotMode="select"
          />
        </div>

        <div style={{ marginTop: '15px' }}>
          <EntryTotalsRow totals={totalsData} />
        </div>

        <div style={{ marginTop: '20px' }}>
          <EntryActions
            onSave={handleSubmit}
            onCancel={() => navigate('/entry/flour-out-return-display')}
            saving={loading}
            saveText={editId ? 'Update' : 'Save'}
          />
        </div>
      </form>
    </div>
  );
};

export default FlourOutReturnCreation;
