import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './FlourOutCreation.css';
import api from '../utils/api';

// Import modular entry components
import { EntryTopFrame, EntryItemsTable, EntryTotalsRow, EntryActions, EntrySection } from './entry'

const FlourOutCreation = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    sNo: '',
    date: new Date().toISOString().split('T')[0],
    papad_company: '',
    address: '',
    remarks: ''
  })

  const [items, setItems] = useState([
    { item_name: '', lot_no: '', weight: 0, qty: 0, total_wt: 0, papad_kg: 0, wages_bag: 0, wages: 0 }
  ])

  const [totals, setTotals] = useState({
    totalQty: 0,
    totalWeight: 0,
    totalWages: 0
  })

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  const queryParams = new URLSearchParams(window.location.search);
  const editId = queryParams.get('id');

  useEffect(() => {
    if (editId) {
      const fetchRecord = async () => {
        setLoading(true);
        try {
          const res = await api(`/flour-out/${editId}`);
          console.log('Fetched edit record details:', res);
          const data = res?.data || res;
          if (data) {
            setFormData({
              sNo: data.sNo || data.s_no || '',
              date: data.date ? data.date.substring(0, 10) : new Date().toISOString().split('T')[0],
              papad_company: data.papadCompany || data.papad_company || '',
              address: data.address || '',
              remarks: data.remarks || ''
            });

            if (data.items && data.items.length > 0) {
              const formattedItems = data.items.map(item => {
                const weight = parseFloat(item.weight) || 0;
                const qty = parseFloat(item.qty) || 0;
                const totalWt = weight * qty;
                const papadKg = parseFloat(item.papadKg || item.papad_kg) || 0;
                const wagesBag = parseFloat(item.wagesBag || item.wages_bag) || 0;
                const wages = papadKg * wagesBag;

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
  }, [editId]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }

  const handleItemChange = (index, field, value) => {
    setItems(prevItems => {
      const newItems = [...prevItems];
      if (field === '__batch__' && typeof value === 'object') {
        newItems[index] = { ...newItems[index], ...value };
      } else {
        newItems[index] = { ...newItems[index], [field]: value };
      }

      // Auto-calculate total weight
      if (field === 'weight' || field === 'qty' || (field === '__batch__' && ('weight' in value || 'qty' in value))) {
        const weight = parseFloat(newItems[index].weight) || 0;
        const qty = parseFloat(newItems[index].qty) || 0;
        newItems[index].total_wt = weight * qty;
      }

      // Auto-calculate wages
      if (field === 'papad_kg' || field === 'wages_bag' || (field === '__batch__' && ('papad_kg' in value || 'wages_bag' in value))) {
        const papadKg = parseFloat(newItems[index].papad_kg) || 0;
        const wagesBag = parseFloat(newItems[index].wages_bag) || 0;
        newItems[index].wages = papadKg * wagesBag;
      }

      calculateTotals(newItems);
      return newItems;
    });
  }

  const calculateTotals = (currentItems) => {
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
  }

  const addItem = () => {
    setItems(prev => [...prev, { item_name: '', lot_no: '', weight: 0, qty: 0, total_wt: 0, papad_kg: 0, wages_bag: 0, wages: 0 }]);
  }

  const removeItem = (index) => {
    setItems(prev => {
      if (prev.length <= 1) return prev;
      const newItems = prev.filter((_, i) => i !== index);
      calculateTotals(newItems);
      return newItems;
    });
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.date || !formData.papad_company) {
      setMessage('Date and papad company are required');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      let result;
      if (editId) {
        result = await api.updateFlourOut(editId, formData, items);
      } else {
        result = await api.createFlourOut(formData, items);
      }

      if (result && (result.success || result.success === undefined)) {
        setMessage(editId ? 'Flour out updated successfully!' : 'Flour out saved successfully!');
        setMessageType('success');
        if (!editId) {
          setFormData({
            sNo: '',
            date: new Date().toISOString().split('T')[0],
            papad_company: '',
            address: '',
            remarks: ''
          });
          setItems([{ item_name: '', lot_no: '', weight: 0, qty: 0, total_wt: 0, papad_kg: 0, wages_bag: 0, wages: 0 }]);
          setTotals({ totalQty: 0, totalWeight: 0, totalWages: 0 });
        }
        setTimeout(() => {
          setMessage('');
          navigate('/entry/flour-out-display');
        }, 1500);
      } else {
        setMessage(result?.message || 'Error saving flour out');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error saving flour out:', error);
      setMessage('Error saving flour out: ' + error.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const topFrameFields = [
    { name: 'sNo', label: 'S.No', value: formData.sNo, col: 1 },
    { name: 'date', label: 'Date', type: 'date', value: formData.date, col: 1 },
    { name: 'remarks', label: 'Remarks', value: formData.remarks, col: 2 },
    { name: 'papad_company', label: 'Papad Company', masterType: 'papad_companies', value: formData.papad_company, col: 3 },
    { name: 'address', label: 'Address', type: 'textarea', value: formData.address || '', col: 3 },
  ];

  const itemColumns = [
    { key: 'item_name', title: 'Item Name', type: 'masterSelect', masterType: 'items' },
    { key: 'lot_no', title: 'Lot No', type: 'lotSelect' },
    { key: 'weight', title: 'Weight', type: 'masterSelect', masterType: 'weights' },
    { key: 'qty', title: 'Qty', type: 'number' },
    { key: 'total_wt', title: 'Total Wt', readOnly: true },
    { key: 'papad_kg', title: 'Papad Kg', type: 'number' },
    { key: 'wages_bag', title: 'Wages/Bag', type: 'number' },
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
      <div className="screen-title">{editId ? 'Flour Out Update' : 'Flour Out Creation'}</div>

      {message && <div className={`message ${messageType}`}>{message}</div>}

      <EntryTopFrame 
        fields={topFrameFields} 
        data={formData} 
        onChange={handleFormChange}
        nextSnoEndpoint="/flour-out/next-sno"
      />

      <EntrySection title="Items">
        <EntryItemsTable 
          columns={itemColumns}
          data={items}
          onRowChange={handleRowChange}
          onAddRow={addItem}
          onDeleteRow={removeItem}
          showActions={true}
          lotMode="select"
        />
      </EntrySection>

      <EntryTotalsRow totals={totalsArr} />

      <EntryActions 
        onSave={handleSubmit}
        saving={loading}
        saveText={editId ? 'Update' : 'Save'}
      />
    </div>
  );
};

export default FlourOutCreation;
