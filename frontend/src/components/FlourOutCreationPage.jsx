import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { EntryTopFrame, EntryItemsTable, EntryTotalsRow, EntryBottomSummary, EntryActions } from './entry';
import MasterDropdown from './MasterDropdown';
import './FlourOutCreationPage.css';

const FlourOutCreationPage = () => {
  const [formData, setFormData] = useState({
    sNo: 1,
    date: new Date().toISOString().slice(0, 10),
    papadCompany: '',
    remarks: ''
  });

  const [rows, setRows] = useState([{}]);

  const [totals, setTotals] = useState({
    totalQty: 0,
    totalWeight: 0,
    totalWages: 0
  });

const columns = [

    { key: 'item_name', title: 'Item Name', type: 'masterSelect', masterType: 'items' },
    { key: 'lot_no', title: 'Lot No', type: 'lotSelect' },
    { key: 'weight', title: 'Weight', type: 'number' },
    { key: 'qty', title: 'Qty', type: 'number' },
    { key: 'total_wt', title: 'Total Wt', readOnly: true },
    { key: 'papad_kg', title: 'Papad Kg', type: 'number' },
    { key: 'wages_per_bag', title: 'Wages/Bag', type: 'number' },
    { key: 'wages', title: 'Wages', readOnly: true }
  ];

const topFields = [
    { name: 'date', label: 'Date', type: 'date' },
    { name: 'papad_company', label: 'Papad Company', type: 'masterSelect', masterType: 'papad_companies' },
    { name: 'remarks', label: 'Remarks', type: 'text' }
  ];

  const handleFormChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleRowChange = useCallback((index, field, value) => {
    setRows(prev => {
      const newRows = [...prev];
      if (field === '__batch__' && typeof value === 'object') {
        newRows[index] = { ...newRows[index], ...value };
      } else {
        newRows[index] = { ...newRows[index], [field]: value };
      }
      
      // Recalculate
      const weight = parseFloat(newRows[index].weight) || 0;
      const qty = parseFloat(newRows[index].qty) || 0;
      newRows[index].total_wt = (weight * qty).toFixed(2);
      
      const papadKg = parseFloat(newRows[index].papad_kg) || 0;
      const wagesPerBag = parseFloat(newRows[index].wages_per_bag) || 0;
      newRows[index].wages = (papadKg * wagesPerBag).toFixed(2);
      
      return newRows;
    });
  }, []);

  const addRow = useCallback((newRow = {}) => {
    setRows(prev => [...prev, newRow]);
  }, []);

  const deleteRow = useCallback((index) => {
    setRows(prev => prev.filter((_, i) => i !== index));
  }, []);

  const calculateTotals = useCallback((currentRows) => {
    const totalQty = currentRows.reduce((sum, row) => sum + (parseFloat(row.qty) || 0), 0);
    const totalWeight = currentRows.reduce((sum, row) => sum + (parseFloat(row.totalWt) || 0), 0);
    const totalWages = currentRows.reduce((sum, row) => sum + (parseFloat(row.wages) || 0), 0);
    setTotals({ totalQty, totalWeight, totalWages });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.date) return alert('Date required');
    if (!formData.papadCompany) return alert('Papad Company required');
    if (rows.some(r => !r.itemName || r.qty <= 0)) return alert('Fill all items');

    try {
      const result = await api.createFlourOut(formData, rows.map(r => ({
        itemName: r.itemName,
        lotNo: r.lotNo,
        weight: r.weight,
        qty: r.qty,
        totalWt: r.totalWt,
        papadKg: r.papadKg,
        wagesPerBag: r.wagesPerBag,
        wages: r.wages
      })));

      if (result.success) {
        alert('Flour Out saved!');
        // Reset
        setFormData({ sNo: formData.sNo + 1, date: '', papadCompany: '', remarks: '' });
        setRows([{ sNo: 1, itemName: '', lotNo: '', weight: 0, qty: 0, totalWt: 0, papadKg: 0, wagesPerBag: 0, wages: 0 }]);
      } else {
        alert(result.message || 'Save failed');
      }
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  useEffect(() => {
    if (rows.length === 0) {
      setRows([{}]);
    }
  }, []);

  useEffect(() => {
    calculateTotals(rows);
  }, [rows, calculateTotals]);

  return (
    <div style={{ margin: 0, fontFamily: 'Calibri, sans-serif', background: 'white' }}>
      <div style={{ background: '#66B4E3', padding: '8px 15px', borderBottom: '2px solid #999', fontWeight: 'bold', fontSize: '17px' }}>
        Flour Out Creation
      </div>

      <form onSubmit={handleSubmit}>
        <EntryTopFrame fields={topFields} data={formData} onChange={handleFormChange} />

        <EntryItemsTable
          columns={columns}
          data={rows}
          onRowChange={handleRowChange}
          onAddRow={addRow}
          onDeleteRow={deleteRow}
          lotMode="select"
          itemColumnKey="item_name"
          sectionTitle="Items"
        />

        <div style={{ background: '#66B4E3', padding: '10px', display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #999' }}>
          <div style={{ fontSize: '17px', fontWeight: 'bold' }}>Total Qty: {totals.totalQty.toFixed(2)}</div>
          <div style={{ fontSize: '17px', fontWeight: 'bold' }}>Total Weight: {totals.totalWeight.toFixed(2)}</div>
          <div style={{ fontSize: '17px', fontWeight: 'bold' }}>Total Wages: ₹{totals.totalWages.toFixed(2)}</div>
        </div>

        <EntryActions onSave={handleSubmit} saveText="Save Flour Out" />
      </form>
    </div>
  );
};

export default FlourOutCreationPage;

