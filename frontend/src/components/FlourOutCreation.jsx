import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './FlourOutCreation.css';
import api from '../utils/api';
import { EntryTopFrame, EntryItemsTable, EntryTotalsRow, EntryActions } from './entry';

const FlourOutCreation = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    sNo: '',
    date: new Date().toISOString().split('T')[0],
    papad_company: '',
    address: '',
    remarks: ''
  });

  const [items, setItems] = useState([
    { item_name: '', lot_no: '', weight: '', qty: '', total_wt: '', papad_kg: '', wages_bag: '', wages: '' }
  ]);

  const [totals, setTotals] = useState({
    totalQty: 0,
    totalWeight: 0,
    totalWages: 0
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  const queryParams = new URLSearchParams(window.location.search);
  const editId = queryParams.get('id');

  const calculateTotals = useCallback((currentItems) => {
    let totalQty = 0, totalWeight = 0, totalWages = 0;
    currentItems.forEach(item => {
      totalQty += parseFloat(item.qty) || 0;
      totalWeight += parseFloat(item.total_wt) || 0;
      totalWages += parseFloat(item.wages) || 0;
    });
    setTotals({
      totalQty,
      totalWeight,
      totalWages
    });
  }, []);

  // Fetch next S.No when creating new entry
  useEffect(() => {
    if (!editId) {
      const fetchNextSno = async () => {
        try {
          const res = await api('/flour-out/next-sno');
          const sno = res?.sNo ?? res?.next_s_no ?? res?.next_sno ?? res?.s_no ?? res?.data?.s_no;
          if (sno) {
            setFormData(prev => ({ ...prev, sNo: String(sno) }));
          } else {
            const fallback = await api.getNextSNo('/flour-out');
            setFormData(prev => ({ ...prev, sNo: String(fallback) }));
          }
        } catch (err) {
          console.error('Error fetching next SNo for Flour Out:', err);
        }
      };
      fetchNextSno();
    }
  }, [editId]);

  // Load existing record for editing
  useEffect(() => {
    if (editId) {
      const fetchRecord = async () => {
        setLoading(true);
        try {
          const res = await api(`/flour-out/${editId}`);
          const data = res?.data || res;
          if (data) {
            setFormData({
              sNo: String(data.sNo || data.s_no || editId),
              date: data.date ? data.date.substring(0, 10) : new Date().toISOString().split('T')[0],
              papad_company: data.papadCompany || data.papad_company || '',
              address: data.address || '',
              remarks: data.remarks || ''
            });

            if (data.items && data.items.length > 0) {
              const formattedItems = data.items.map(item => {
                const weight = parseFloat(item.weight) || 0;
                const qty = parseFloat(item.qty) || 0;
                const totalWt = parseFloat(item.totalWt || item.total_wt) || (weight * qty);
                const papadKg = parseFloat(item.papadKg || item.papad_kg) || 0;
                const wagesBag = parseFloat(item.wagesBag || item.wages_bag) || 0;
                const wages = parseFloat(item.wages) || (papadKg * wagesBag);

                return {
                  item_name: item.itemName || item.item_name || '',
                  lot_no: item.lotNo || item.lot_no || '',
                  weight,
                  qty,
                  total_wt: totalWt,
                  papad_kg: papadKg,
                  wages_bag: wagesBag,
                  wages
                };
              });
              setItems(formattedItems);
              calculateTotals(formattedItems);
            }
          }
        } catch (err) {
          console.error('Error fetching flour out edit details:', err);
          setMessage('Error fetching flour out details');
          setMessageType('error');
        } finally {
          setLoading(false);
        }
      };
      fetchRecord();
    }
  }, [editId, calculateTotals]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, field, value) => {
    setItems(prevItems => {
      const newItems = [...prevItems];
      if (field === '__batch__' && typeof value === 'object') {
        newItems[index] = { ...newItems[index], ...value };
      } else {
        newItems[index] = { ...newItems[index], [field]: value };
      }

      // Auto-calculate total weight
      const weight = parseFloat(newItems[index].weight) || 0;
      const qty = parseFloat(newItems[index].qty) || 0;
      if (weight > 0 && qty > 0) {
        newItems[index].total_wt = parseFloat((weight * qty).toFixed(2));
      }

      // Auto-calculate wages
      const papadKg = parseFloat(newItems[index].papad_kg) || 0;
      const wagesBag = parseFloat(newItems[index].wages_bag || newItems[index].wages_per_bag) || 0;
      if (papadKg > 0 && wagesBag > 0) {
        newItems[index].wages = parseFloat((papadKg * wagesBag).toFixed(2));
      }

      calculateTotals(newItems);
      return newItems;
    });
  };

  const addItem = (newRow) => {
    setItems(prev => [
      ...prev,
      (newRow && typeof newRow === 'object' && (newRow.item_name !== undefined || newRow.sno !== undefined))
        ? {
            item_name: newRow.item_name || '',
            lot_no: newRow.lot_no || '',
            weight: newRow.weight || '',
            qty: newRow.qty || '',
            total_wt: newRow.total_wt || '',
            papad_kg: newRow.papad_kg || '',
            wages_bag: newRow.wages_bag || newRow.wages_per_bag || '',
            wages: newRow.wages || ''
          }
        : { item_name: '', lot_no: '', weight: '', qty: '', total_wt: '', papad_kg: '', wages_bag: '', wages: '' }
    ]);
  };

  const removeItem = (index) => {
    setItems(prev => {
      if (prev.length <= 1) return prev;
      const newItems = prev.filter((_, i) => i !== index);
      calculateTotals(newItems);
      return newItems;
    });
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!formData.date || !formData.papad_company) {
      setMessage('Date and Papad Company are required');
      setMessageType('error');
      return;
    }

    const activeItems = items.filter(it => it.item_name && parseFloat(it.qty) > 0);
    if (activeItems.length === 0) {
      setMessage('Please enter at least one item with name and quantity');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const endpoint = editId ? `/flour-out/${editId}` : '/flour-out';
      const method = editId ? 'PUT' : 'POST';

      const res = await api(endpoint, {
        method,
        body: {
          formData: {
            ...formData,
            papadCompany: formData.papad_company
          },
          items
        }
      });

      if (res && (res.success || res.id || res.message)) {
        setMessage(editId ? 'Flour Out updated successfully!' : 'Flour Out saved successfully!');
        setMessageType('success');
        setTimeout(() => {
          navigate('/entry/flour-out-display');
        }, 1200);
      } else {
        setMessage(res?.message || 'Error saving Flour Out');
        setMessageType('error');
      }
    } catch (err) {
      console.error('Error submitting Flour Out:', err);
      setMessage(err.message || 'Error saving Flour Out');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const topFields = [
    { name: 'sNo', label: 'S.No.', type: 'text', readOnly: true, col: 1 },
    { name: 'date', label: 'Date', type: 'date', col: 1 },
    { name: 'papad_company', label: 'Papad Company', type: 'masterSelect', masterType: 'papad_companies', col: 2 },
    { name: 'address', label: 'Address', type: 'text', col: 2 },
    { name: 'remarks', label: 'Remarks', type: 'text', col: 3 }
  ];

  const itemColumns = [
    { key: 'item_name', title: 'Item Name', type: 'masterSelect', masterType: 'items' },
    { key: 'lot_no', title: 'Lot No', type: 'text' },
    { key: 'weight', title: 'Weight', type: 'number' },
    { key: 'qty', title: 'Qty', type: 'number' },
    { key: 'total_wt', title: 'Total Wt', type: 'number', readOnly: true },
    { key: 'papad_kg', title: 'Papad (Kg)', type: 'number' },
    { key: 'wages_bag', title: 'Wages / Bag', type: 'number' },
    { key: 'wages', title: 'Wages', type: 'number', readOnly: true }
  ];

  const totalFields = [
    { label: 'Total Qty', value: totals.totalQty },
    { label: 'Total Weight', value: totals.totalWeight },
    { label: 'Total Wages', value: totals.totalWages.toFixed(2) }
  ];

  return (
    <div className="window flour-out-window">
      <div className="screen-title">{editId ? 'Flour Out Update' : 'Flour Out Creation'}</div>
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
          <EntryTotalsRow totals={totalFields} />
        </div>

        <div style={{ marginTop: '20px' }}>
          <EntryActions
            onSave={handleSubmit}
            onCancel={() => navigate('/entry/flour-out-display')}
            saving={loading}
            saveText={editId ? 'Update' : 'Save'}
          />
        </div>
      </form>
    </div>
  );
};

export default FlourOutCreation;
