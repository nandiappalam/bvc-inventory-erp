import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { EntryTopFrame, EntryItemsTable, EntryActions } from './entry';
import './FlourOutCreationPage.css';

const FlourOutReturnCreationPage = () => {
  const [formData, setFormData] = useState({
    sNo: 1,
    date: new Date().toISOString().slice(0, 10),
    taxType: '',
    remarks: ''
  });

  const [rows, setRows] = useState([{}]);

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
    { name: 'taxType', label: 'Tax Type', type: 'text' },
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

  const addRow = useCallback(() => {
    setRows(prev => [...prev, {}]);
  }, []);

  const deleteRow = useCallback((index) => {
    setRows(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Flour Out Return Data:', { formData, rows });
    // TODO: API integration
    alert('Flour Out Return saved!');
  };

  return (
    <div style={{ margin: 0, fontFamily: 'Calibri, sans-serif', background: 'white' }}>
      <div style={{ background: '#66B4E3', padding: '8px 15px', borderBottom: '2px solid #999', fontWeight: 'bold', fontSize: '17px' }}>
        Flour Out Return Creation
      </div>

      <form onSubmit={handleSubmit}>
        <EntryTopFrame fields={topFields} data={formData} onChange={handleFormChange} />

        <EntryItemsTable
          columns={columns}
          data={rows}
          onRowChange={handleRowChange}
          onAddRow={addRow}
          onDeleteRow={deleteRow}
          autoLotMode={false}
          itemColumnKey="item_name"
          sectionTitle="Items"
        />

        <EntryActions onSave={handleSubmit} saveText="Save Flour Out Return" />
      </form>
    </div>
  );
};

export default FlourOutReturnCreationPage;

