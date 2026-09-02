import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './FlourOutReturnCreation.css';
import api from '../utils/api';

// Import modular entry components
import { EntryTopFrame, EntryItemsTable, EntryTotalsRow, EntryActions, EntrySection } from './entry'

const FlourOutReturnCreation = () => {
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const editId = searchParams.get('id');

  const [formData, setFormData] = useState({
    sno: 1,
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

  // Load existing record if editId is provided
  useEffect(() => {
    if (editId) {
      const fetchRecord = async () => {
        try {
          const res = await fetch(`/api/flour-out-return/${editId}`);
          if (res.ok) {
            const data = await res.json();
            setFormData({
              sno: data.s_no || data.sno || editId,
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
                  wages: wages.toFixed(2)
                };
              });
              setItems(loadedItems);
              updateTotals(loadedItems);
            }
          }
        } catch (err) {
          console.error('Error fetching flour out return for editing:', err);
        }
      };
      fetchRecord();
    }
  }, [editId]);

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

      const weight = parseFloat(newItems[index].weight) || 0;
      const qty = parseFloat(newItems[index].qty) || 0;
      const papadKg = parseFloat(newItems[index].papad_kg) || 0;
      const cost = parseFloat(newItems[index].cost) || 0;
      const wagesBag = parseFloat(newItems[index].wages_per_bag) || 0;

      newItems[index].total_wt = (weight * qty).toFixed(2);
      
      let calcWages = qty * wagesBag;
      if (!calcWages && papadKg && cost) {
        calcWages = papadKg * cost;
      }
      newItems[index].wages = calcWages.toFixed(2);

      updateTotals(newItems);
      return newItems;
    });
  };

  const updateTotals = (itemsList) => {
    const qty = itemsList.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
    const weight = itemsList.reduce((sum, item) => sum + (parseFloat(item.total_wt) || 0), 0);
    const wages = itemsList.reduce((sum, item) => sum + (parseFloat(item.wages) || 0), 0);
    setTotals({ totalQty: qty, totalWeight: weight, totalWages: wages });
  }

  const addRow = () => {
    setItems(prev => [...prev, { 
      no: prev.length + 1, 
      item_name: '', 
      lot_no: '', 
      weight: '', 
      qty: '', 
      total_wt: '', 
      papad_kg: '', 
      cost: '', 
      wages_per_bag: '', 
      wages: '' 
    }]);
  }

  const deleteRow = (index) => {
    setItems(prev => {
      if (prev.length <= 1) return prev;
      const newItems = prev.filter((_, i) => i !== index);
      updateTotals(newItems);
      return newItems;
    });
  }

  const handleSave = async () => {
    setLoading(true);
    setMessage('');

    try {
      const data = {
        formData,
        items,
        totals,
        totalQty: totals.totalQty,
        totalWeight: totals.totalWeight,
        totalWages: totals.totalWages
      };

      let result;
      if (editId) {
        const res = await fetch(`/api/flour-out-return/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        result = await res.json();
      } else {
        result = await api.createFlourOutReturn(data);
      }

      if (result && (result.success || result.message)) {
        setMessage(editId ? 'Flour out return updated successfully!' : 'Flour out return saved successfully!');
        setMessageType('success');
        setTimeout(() => {
          setMessage('');
          navigate('/entry/flour-out-return-display');
        }, 1500);
      } else {
        setMessage(result?.message || 'Error saving flour out return');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error saving flour out return:', error);
      setMessage('Error saving flour out return: ' + error.message);
      setMessageType('error');
    }
    setLoading(false);
  };

  const topFrameFields = [
    { name: 'sno', label: 'S.No', value: formData.sno, readOnly: true },
    { name: 'date', label: 'Date', type: 'date', value: formData.date },
    { name: 'papadCompany', label: 'Papad Company', type: 'masterSelect', masterType: 'papad_companies', value: formData.papadCompany },
    { name: 'taxType', label: 'Tax Type', type: 'select', options: [
      { value: 'Exclusive', label: 'Exclusive' },
      { value: 'Inclusive', label: 'Inclusive' },
      { value: 'Without Tax', label: 'Without Tax' }
    ], value: formData.taxType },
    { name: 'remarks', label: 'Remarks', value: formData.remarks },
  ];

  const itemColumns = [
    { key: 'item_name', title: 'Item Name', type: 'masterSelect', masterType: 'items' },
    { key: 'lot_no', title: 'Lot No', type: 'lotSelect' },
    { key: 'weight', title: 'Weight', type: 'masterSelect', masterType: 'weights' },
    { key: 'qty', title: 'Qty', type: 'number' },
    { key: 'total_wt', title: 'Total Wt', readOnly: true },
    { key: 'papad_kg', title: 'Papad Kg', type: 'number' },
    { key: 'cost', title: 'Cost', type: 'number' },
    { key: 'wages_per_bag', title: 'Wages/Bag', type: 'number' },
    { key: 'wages', title: 'Wages', readOnly: true },
  ];

  const totalsArr = [
    { name: 'totalQty', label: 'Total Qty', value: totals.totalQty.toFixed(2) },
    { name: 'totalWeight', label: 'Total Weight', value: totals.totalWeight.toFixed(2) },
    { name: 'totalWages', label: 'Total Wages', value: totals.totalWages.toFixed(2) },
  ];

  const handleRowChange = (rowIndex, key, value) => {
    handleItemChange(rowIndex, key, value);
  };

  return (
    <div className="window">
      <div className="screen-title">Flour Out Return Creation</div>

      {message && <div className={`message ${messageType}`}>{message}</div>}

      <EntryTopFrame 
        fields={topFrameFields} 
        data={formData} 
        onChange={handleFormChange}
      />

      <EntrySection title="Items">
        <EntryItemsTable 
          columns={itemColumns}
          data={items}
          onRowChange={handleRowChange}
          onAddRow={addRow}
          onDeleteRow={deleteRow}
          showActions={true}
          lotMode="select"
        />
      </EntrySection>

      <EntryTotalsRow totals={totalsArr} />

      <EntryActions 
        onSave={handleSave}
        saving={loading}
        saveText="Save"
      />
    </div>
  );
};

export default FlourOutReturnCreation;
