import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './StockAdjustCreate.css';
import api from "../services/api.js";
import { EntryTopFrame, EntryItemsTable, EntryActions, EntrySection } from './entry';

const StockAdjustCreate = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    sNo: '',
    type: 'Addition',
    papadComp: '',
    date: new Date().toISOString().split('T')[0],
    flourMill: '',
    remarks: ''
  });

  const [items, setItems] = useState([
    { item_name: '', lot_no: '', weight: '', type: 'Addition', qty: '', totWt: '', rate: '', remarks: '' }
  ]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  const searchParams = new URLSearchParams(window.location.search);
  const editId = searchParams.get('id');

  // Fetch next sequential S.No or edit record on load
  useEffect(() => {
    const initData = async () => {
      try {
        if (editId) {
          const res = await api(`/stock-adjust/${editId}`);
          if (res) {
            setFormData({
              sNo: String(res.s_no || res.sNo || ''),
              type: res.type || 'Urad',
              papadComp: res.papad_comp || res.papadComp || '',
              date: res.date ? res.date.substring(0, 10) : new Date().toISOString().split('T')[0],
              flourMill: res.flour_mill || res.flourMill || '',
              remarks: res.remarks || ''
            });
            if (Array.isArray(res.items) && res.items.length > 0) {
              setItems(res.items.map(it => ({
                item_name: it.item_name || '',
                lot_no: it.lot_no || '',
                weight: it.weight !== undefined ? String(it.weight) : '',
                type: it.type || 'Addition',
                qty: it.qty !== undefined ? String(it.qty) : '',
                totWt: it.tot_wt !== undefined ? String(it.tot_wt) : '',
                rate: it.rate !== undefined ? String(it.rate) : '',
                remarks: it.remarks || ''
              })));
            }
          }
        } else {
          const result = await api('/stock-adjust/next-sno');
          if (result && result.success) {
            setFormData(prev => ({ ...prev, sNo: String(result.next_s_no) }));
          }
        }
      } catch (err) {
        console.error('Failed to init stock adjust:', err);
      }
    };
    initData();
  }, [editId]);

  const handleFormChange = (nameOrEvent, maybeValue) => {
    if (nameOrEvent && nameOrEvent.target) {
      const { name, value } = nameOrEvent.target;
      setFormData(prev => ({ ...prev, [name]: value }));
    } else {
      setFormData(prev => ({ ...prev, [nameOrEvent]: maybeValue }));
    }
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
      newItems[index].totWt = (weight * qty).toFixed(2);

      return newItems;
    });
  };

  const addItemRow = () => {
    setItems(prev => [...prev, { item_name: '', lot_no: '', weight: '', type: 'Addition', qty: '', totWt: '', rate: '', remarks: '' }]);
  };

  const removeItemRow = (index) => {
    setItems(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!formData.date) {
      setMessage('Date is required');
      setMessageType('error');
      return;
    }

    const validItems = items.filter(item => {
      const name = typeof item.item_name === 'object' ? (item.item_name?.name || item.item_name?.item_name || '') : (item.item_name || '');
      return name.trim() !== '' && parseFloat(item.qty) > 0;
    }).map(item => ({
      ...item,
      item_name: typeof item.item_name === 'object' ? (item.item_name?.name || item.item_name?.item_name || '') : (item.item_name || ''),
      weight: parseFloat(item.weight) || 0,
      qty: parseFloat(item.qty) || 0,
      totWt: parseFloat(item.totWt) || 0,
      rate: parseFloat(item.rate) || 0
    }));

    if (validItems.length === 0) {
      setMessage('At least one item with name and quantity is required');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const payload = {
        formData,
        items: validItems
      };

      let result;
      if (editId) {
        result = await api(`/stock-adjust/${editId}`, {
          method: 'PUT',
          body: payload
        });
      } else {
        result = await api('/stock-adjust', {
          method: 'POST',
          body: payload
        });
      }

      if (result && result.success) {
        setMessage(editId ? 'Stock Adjust updated successfully!' : 'Stock Adjust saved successfully!');
        setMessageType('success');
        setFormData({
          sNo: '',
          type: 'Addition',
          papadComp: '',
          date: new Date().toISOString().split('T')[0],
          flourMill: '',
          remarks: ''
        });
        setItems([
          { item_name: '', lot_no: '', weight: '', type: 'Addition', qty: '', totWt: '', rate: '', remarks: '' }
        ]);

        // Re-fetch next S.No after save
        const nextResult = await api('/stock-adjust/next-sno');
        if (nextResult && nextResult.success) {
          setFormData(prev => ({ ...prev, sNo: String(nextResult.next_s_no) }));
        }

        setTimeout(() => {
          setMessage('');
          navigate('/entry/stock-adjust-display');
        }, 1500);
      } else {
        setMessage(result?.message || 'Error saving stock adjustment');
        setMessageType('error');
      }
    } catch (error) {
      setMessage('Error saving stock adjust: ' + error.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const topFrameFields = [
    { name: 'sNo', label: 'S.No', type: 'text', readOnly: true, value: formData.sNo, col: 1 },
    { name: 'date', label: 'Date', type: 'date', value: formData.date, col: 1 },
    { name: 'type', label: 'Type', type: 'select', options: [
      { value: 'Urad', label: 'Urad' },
      { value: 'Flour', label: 'Flour' },
      { value: 'Papad', label: 'Papad' },
      { value: 'Packing Material', label: 'Packing Material' },
      { value: 'Others', label: 'Others' }
    ], value: formData.type, col: 2 },
    { name: 'papadComp', label: 'Papad Comp', type: 'masterSelect', masterType: 'papad_companies', value: formData.papadComp, col: 2 },
    { name: 'flourMill', label: 'Flour Mill', type: 'masterSelect', masterType: 'flour_mills', value: formData.flourMill, col: 3 },
    { name: 'remarks', label: 'Remarks', value: formData.remarks, col: 3 }
  ];

  const itemColumns = [
    { key: 'item_name', title: 'Item Name', type: 'masterSelect', masterType: 'items' },
    { key: 'lot_no', title: 'Lot No', type: 'lotSelect' },
    { key: 'weight', title: 'Weight', type: 'number' },
    { key: 'type', title: 'Type', type: 'select', options: [
      { value: 'Addition', label: 'Addition' },
      { value: 'Deduction', label: 'Deduction' },
      { value: 'Reduction', label: 'Reduction' },
      { value: 'Issue', label: 'Issue' },
      { value: 'Receive', label: 'Receive' },
      { value: 'Damage', label: 'Damage' },
      { value: 'Wastage', label: 'Wastage' }
    ] },
    { key: 'qty', title: 'Qty', type: 'number' },
    { key: 'totWt', title: 'Tot Wt', readOnly: true },
    { key: 'rate', title: 'Rate', type: 'number' },
    { key: 'remarks', title: 'Remarks' }
  ];

  const handleRowChange = (rowIndex, key, value) => {
    handleItemChange(rowIndex, key, value);
  };

  return (
    <div className="window">
      <div className="screen-title">Stock Adjust Creation</div>

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
          onAddRow={addItemRow}
          onDeleteRow={removeItemRow}
          showActions={true}
          lotMode="select"
        />
      </EntrySection>

      <EntryActions 
        onSave={handleSubmit}
        saving={loading}
        saveText="Save"
      />
    </div>
  );
};

export default StockAdjustCreate;
