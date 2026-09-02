import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { EntryTopFrame, EntryItemsTable, EntryTotalsRow, EntryBottomSummary, EntryActions } from './entry';
import { calculateTotals } from '../utils/taxCalc';
import BackToHome from './BackToHome';
import MasterDropdown from './MasterDropdown';
import api from '../services/api';

const SalesCreationPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    sNo: '',
    customer: '',
    remarks: '',
    bill_no: '',
    date: new Date().toISOString().split('T')[0],
    pay_type: 'Credit',
    tax_type: 'Exclusive',
    tax_rate: 18,
    type: '',
    lorry_no: '',
    p_o_no: '',
    driver: '',
    pur_trans: '',
    customer_id: '',
    customer_name: '',
    address: '',
    phone: '',
    sender_id: '',
    consignee_id: '',
    godown_from_id: '',
    bill_amt: 0,
    tax_amt: 0,
    total_amt: 0,
    deduction: '',
    deduction_remarks: ''
  })

  const [items, setItems] = useState([
    {
      itemName: '',
      lotNo: '',
      weight: '',
      qty: '',
      totalWt: '',
      rate: '',
      discPerc: '',
      taxPerc: '',
      totalAmt: '',
    }
  ])
  
  const [currentTaxType, setCurrentTaxType] = useState('Exclusive');
  const [currentTaxRate, setCurrentTaxRate] = useState(18);

  useEffect(() => {
    const fetchNextSNo = async () => {
      try {
        const nextSNo = await api.getNextSNo('/sales');
        setFormData(prev => ({ ...prev, sNo: String(nextSNo) }));
      } catch (err) {
        console.error('Failed to fetch next S.No:', err);
      }
    };
    fetchNextSNo();
  }, []);

  const handleFormChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleTopFrameChange = useCallback((e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }, [])

  const handleTaxChange = useCallback(({ taxType, taxRate }) => {
    setCurrentTaxType(taxType)
    setCurrentTaxRate(taxRate)
    
    // Recalculate all rows with new tax
    setItems(prevItems => prevItems.map((item) => {
      const qty = parseFloat(item.qty) || 0;
      const rate = parseFloat(item.rate) || 0;
      const discPerc = parseFloat(item.discPerc) || 0;
      const taxPerc = parseFloat(taxRate) || 0;

      const base = qty * rate;
      const discAmt = base * (discPerc / 100);
      const taxable = base - discAmt;
      const taxAmtVal = taxable * (taxPerc / 100);
      const totalAmtVal = (taxable + taxAmtVal).toFixed(2);

      return {
        ...item,
        taxPerc: taxRate,
        totalAmt: totalAmtVal
      }
    }))
  }, [])

  const handleItemChange = (index, key, value) => {
    const newItems = [...items]
    const item = { ...newItems[index], [key]: value };

    const qty = parseFloat(item.qty) || 0;
    const weight = parseFloat(item.weight) || 0;
    const rate = parseFloat(item.rate) || 0;
    const discPerc = parseFloat(item.discPerc) || 0;
    const taxPerc = parseFloat(item.taxPerc) || 0;

    item.totalWt = (qty * weight).toFixed(3);
    const base = qty * rate;
    const discAmt = base * (discPerc / 100);
    const taxable = base - discAmt;
    const taxAmtVal = taxable * (taxPerc / 100);
    item.totalAmt = (taxable + taxAmtVal).toFixed(2);

    newItems[index] = item;
    setItems(newItems)
  }

  const addItemRow = () => {
    setItems([...items, { item_name: '', lot_no: '', qty: '', box: '', rate: '', tax_rate: currentTaxRate, tax_amount: 0, amount: 0 }])
  }

  const deleteItemRow = (index) => {
    if (items.length > 1) {
      const newItems = items.filter((_, i) => i !== index)
      setItems(newItems)
    }
  }

  const addRow = () => {
    setItems([...items, {
      itemName: '',
      lotNo: '',
      weight: '',
      qty: '',
      totalWt: '',
      rate: '',
      discPerc: '',
      taxPerc: '',
      totalAmt: '',
    }])
  }

  const removeRow = (index) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const payload = {
      formData,
      items,
      totals: {
        totalQty: items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0),
        totalWt: items.reduce((sum, item) => sum + (parseFloat(item.totalWt) || 0), 0),
        totalAmt: items.reduce((sum, item) => sum + (parseFloat(item.totalAmt) || 0), 0)
      }
    }

    console.log('Submitting:', payload)

    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const result = await response.json()
        alert('Sales saved successfully!')
        navigate('/entry/sales-display')
      } else {
        const error = await response.json()
        alert(`Error: ${error.message}`)
        console.error('Error:', error)
      }
    } catch (error) {
      alert('Network error occurred')
      console.error('Network error:', error)
    }
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        Create Sales Entry
      </div>

      <div className="content">
        <div className="form-box">
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <label htmlFor="sNo" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#005F99' }}>S.No</label>
              <input type="number" id="sNo" name="sNo" value={formData.sNo} onChange={handleFormChange} required style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <label htmlFor="date" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#005F99' }}>Date</label>
              <input type="date" id="date" name="date" value={formData.date} onChange={handleFormChange} required style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <label htmlFor="customer" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#005F99' }}>Customer</label>
              <MasterDropdown 
                masterType="customers" 
                value={formData.customer}
                onChange={handleFormChange}
                name="customer"
                required 
              />
            </div>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <label htmlFor="remarks" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#005F99' }}>Remarks</label>
              <input type="text" id="remarks" name="remarks" value={formData.remarks} onChange={handleFormChange} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ marginTop: '20px' }}>
            <h2>Sales Items</h2>
            <div id="item-rows">
              {items.map((item, index) => (
                <div key={index} style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px', alignItems: 'end' }}>
                  <div style={{ flex: '1', minWidth: '120px' }}>
                    <label>Item Name</label>
                    <input type="text" value={item.itemName || ''} onChange={(e) => handleItemChange(index, 'itemName', e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: '1', minWidth: '120px' }}>
                    <label>Lot No</label>
                    <input type="text" value={item.lotNo || ''} onChange={(e) => handleItemChange(index, 'lotNo', e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: '1', minWidth: '120px' }}>
                    <label>Weight</label>
                    <input type="number" step="0.01" value={item.weight || ''} onChange={(e) => handleItemChange(index, 'weight', e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: '1', minWidth: '120px' }}>
                    <label>Qty</label>
                    <input type="number" step="0.01" value={item.qty || ''} onChange={(e) => handleItemChange(index, 'qty', e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: '1', minWidth: '120px' }}>
                    <label>Total Wt</label>
                    <input type="number" step="0.01" value={item.totalWt || ''} readOnly style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: '1', minWidth: '120px' }}>
                    <label>Rate</label>
                    <input type="number" step="0.01" value={item.rate || ''} onChange={(e) => handleItemChange(index, 'rate', e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: '1', minWidth: '120px' }}>
                    <label>Disc %</label>
                    <input type="number" step="0.01" value={item.discPerc || ''} onChange={(e) => handleItemChange(index, 'discPerc', e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: '1', minWidth: '120px' }}>
                    <label>Tax %</label>
                    <input type="number" step="0.01" value={item.taxPerc || ''} onChange={(e) => handleItemChange(index, 'taxPerc', e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: '1', minWidth: '120px' }}>
                    <label>Total Amt</label>
                    <input type="number" step="0.01" value={item.totalAmt || ''} readOnly style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: '0 0 auto' }}>
                    <button type="button" onClick={() => removeRow(index)} style={{ backgroundColor: '#f44336', color: 'white', padding: '10px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={addRow} style={{ backgroundColor: '#005F99', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '10px' }}>Add Row</button>
          </div>
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <button type="submit" style={{ backgroundColor: '#005F99', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Save Sales</button>
          </div>
        </form>
        <BackToHome />
        </div>
      </div>
    </div>
  )
}

export default SalesCreationPage
