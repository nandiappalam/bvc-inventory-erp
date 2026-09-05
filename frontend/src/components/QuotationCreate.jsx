import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './QuotationCreate.css';
import api from "../services/api.js";
import { EntryTopFrame, EntryItemsTable, EntryTotalsRow, EntryBottomSummary, EntryActions, EntrySection } from './entry';

const QuotationCreate = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    bill_no: '',
    date: new Date().toISOString().split('T')[0],
    pay_type: 'Cash',
    tax_type: 'Exclusive',
    type: 'Urad',
    remarks: '',
    customer: '',
    address: '',
    tax_percent: '0',
    amount: '0.00',
    bill_amt: '0.00',
    tax_amt: '0.00',
    total_amt: '0.00',
    deduction: '',
    percent: '',
    deduction_amount: '0.00',
    deduction_remarks: ''
  });

  const [items, setItems] = useState([
    { item_name: '', lot_no: '', qty: '', box: '', rate: '', disc: '', tax: '', amount: '' }
  ]);

  const [deductionsList, setDeductionsList] = useState([]);
  const [selectedDeductions, setSelectedDeductions] = useState([
    { deduction_id: '', name: '', type: 'LESS', percent: '', amount: '', remarks: '' }
  ]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  const searchParams = new URLSearchParams(window.location.search);
  const editId = searchParams.get('id');

  // Fetch initial data & edit record if present
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        if (editId) {
          const res = await api(`/quotations/${editId}`);
          if (res) {
            setFormData({
              bill_no: String(res.bill_no || res.s_no || ''),
              date: res.date ? res.date.substring(0, 10) : new Date().toISOString().split('T')[0],
              pay_type: res.pay_type || 'Cash',
              tax_type: res.tax_type || 'Exclusive',
              type: res.type || 'Urad',
              remarks: res.remarks || '',
              customer: res.customer || '',
              address: res.address || '',
              tax_percent: String(res.tax_percent !== undefined && res.tax_percent !== null ? res.tax_percent : '0'),
              amount: String(res.amount || '0.00'),
              bill_amt: String(res.bill_amt || '0.00'),
              tax_amt: String(res.tax_amt || '0.00'),
              total_amt: String(res.total_amt || '0.00'),
              deduction: String(res.deduction || ''),
              percent: String(res.percent || ''),
              deduction_amount: String(res.deduction_amount || '0.00'),
              deduction_remarks: res.deduction_remarks || ''
            });
            if (Array.isArray(res.items) && res.items.length > 0) {
              setItems(res.items.map(it => ({
                item_name: it.item_name || '',
                lot_no: it.lot_no || '',
                qty: String(it.qty || ''),
                box: String(it.box || ''),
                rate: String(it.rate || ''),
                disc: String(it.disc || ''),
                tax: String(it.tax || ''),
                amount: String(it.amount || '')
              })));
            }
          }
        } else {
          const nextRes = await api('/quotations/next-bill-no');
          if (nextRes && nextRes.success) {
            setFormData(prev => ({ ...prev, bill_no: String(nextRes.next_bill_no) }));
          }
        }

        const r1 = await api('/masters/deduction_sales').catch(() => null);
        const a1 = Array.isArray(r1) ? r1 : (r1?.data || r1?.rows || []);
        if (a1.length > 0) {
          setDeductionsList(a1);
        } else {
          const r2 = await api('/masters/deduction_purchase').catch(() => null);
          const a2 = Array.isArray(r2) ? r2 : (r2?.data || r2?.rows || []);
          setDeductionsList(a2);
        }
      } catch (err) {
        console.error('Failed to fetch initial quotation data:', err);
      }
    };
    fetchInitialData();
  }, [editId]);

  // Recalculate quotation financial totals
  const recalculateTotals = (updatedItems, updatedDeductions, taxPercentVal, customDeduction, customPercent) => {
    let totalGrossAmount = 0;
    let totalTaxAmount = 0;

    updatedItems.forEach(item => {
      const qty = parseFloat(item.qty) || 0;
      const rate = parseFloat(item.rate) || 0;
      const discPct = parseFloat(item.disc) || 0;
      const taxPct = parseFloat(item.tax) || 0;

      const base = qty * rate;
      const discVal = base * (discPct / 100);
      const afterDisc = base - discVal;
      const taxVal = afterDisc * (taxPct / 100);

      totalGrossAmount += base;
      totalTaxAmount += taxVal;
    });

    let netDeductionsAmt = 0;
    updatedDeductions.forEach(d => {
      const pct = parseFloat(d.percent) || 0;
      let amt = parseFloat(d.amount) || 0;
      if (pct > 0 && totalGrossAmount > 0) {
        amt = (totalGrossAmount * pct) / 100;
        d.amount = amt.toFixed(2);
      }
      const dedType = (d.type || 'LESS').toUpperCase();
      if (dedType === 'ADD') {
        netDeductionsAmt -= amt; // Adding increases bill amount
      } else {
        netDeductionsAmt += amt; // Less decreases bill amount
      }
    });

    const manualDedVal = parseFloat(customDeduction) || 0;
    const manualPctVal = parseFloat(customPercent) || 0;
    const manualPctAmt = (totalGrossAmount * manualPctVal) / 100;

    const finalTotalDeductions = netDeductionsAmt + manualDedVal + manualPctAmt;
    const billAmt = Math.max(0, totalGrossAmount - finalTotalDeductions);

    const taxRate = parseFloat(taxPercentVal) || 0;
    const calculatedTaxAmt = totalTaxAmount > 0 ? totalTaxAmount : billAmt * (taxRate / 100);
    const totalAmt = billAmt + calculatedTaxAmt;

    setFormData(prev => ({
      ...prev,
      amount: totalGrossAmount.toFixed(2),
      bill_amt: billAmt.toFixed(2),
      tax_amt: calculatedTaxAmt.toFixed(2),
      total_amt: totalAmt.toFixed(2),
      deduction_amount: finalTotalDeductions.toFixed(2)
    }));
  };

  const handleInputChange = (nameOrEvent, maybeValue) => {
    let fieldName = '';
    let fieldValue = '';
    if (nameOrEvent && nameOrEvent.target) {
      fieldName = nameOrEvent.target.name;
      fieldValue = nameOrEvent.target.value;
    } else {
      fieldName = nameOrEvent;
      fieldValue = maybeValue;
    }

    setFormData(prev => {
      const updated = { ...prev, [fieldName]: fieldValue };
      recalculateTotals(
        items,
        selectedDeductions,
        updated.tax_percent,
        updated.deduction,
        updated.percent
      );
      return updated;
    });
  };

  const handleRowChange = (rowIndex, key, value) => {
    setItems(prevItems => {
      const newItems = [...prevItems];
      if (key === '__batch__' && typeof value === 'object') {
        newItems[rowIndex] = { ...newItems[rowIndex], ...value };
      } else {
        newItems[rowIndex] = { ...newItems[rowIndex], [key]: value };
      }

      const qty = parseFloat(newItems[rowIndex].qty) || 0;
      const rate = parseFloat(newItems[rowIndex].rate) || 0;
      const disc = parseFloat(newItems[rowIndex].disc) || 0;
      const tax = parseFloat(newItems[rowIndex].tax) || 0;

      const baseAmt = qty * rate;
      const afterDisc = baseAmt - (baseAmt * (disc / 100));
      const afterTax = afterDisc + (afterDisc * (tax / 100));
      newItems[rowIndex].amount = afterTax.toFixed(2);

      recalculateTotals(
        newItems,
        selectedDeductions,
        formData.tax_percent,
        formData.deduction,
        formData.percent
      );

      return newItems;
    });
  };

  const addItemRow = () => {
    setItems(prev => [...prev, { item_name: '', lot_no: '', qty: '', box: '', rate: '', disc: '', tax: '', amount: '' }]);
  };

  const deleteItemRow = (index) => {
    setItems(prev => {
      if (prev.length <= 1) return prev;
      const newItems = prev.filter((_, i) => i !== index);
      recalculateTotals(
        newItems,
        selectedDeductions,
        formData.tax_percent,
        formData.deduction,
        formData.percent
      );
      return newItems;
    });
  };

  const handleDeductionRowChange = (index, field, value) => {
    setSelectedDeductions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      if (field === 'deduction_id' && value) {
        const master = deductionsList.find(d => String(d.id) === String(value));
        if (master) {
          updated[index].name = master.name || master.deduction_name || master.ded_name || '';
          updated[index].type = (master.type || master.deduction_type || 'LESS').toUpperCase();
          updated[index].percent = master.deduction_value || master.ded_value || '';
        }
      }

      recalculateTotals(
        items,
        updated,
        formData.tax_percent,
        formData.deduction,
        formData.percent
      );

      return updated;
    });
  };

  const addDeductionRow = () => {
    setSelectedDeductions(prev => [...prev, { deduction_id: '', name: '', type: 'LESS', percent: '', amount: '', remarks: '' }]);
  };

  const deleteDeductionRow = (index) => {
    setSelectedDeductions(prev => {
      if (prev.length <= 1) return prev;
      const updated = prev.filter((_, i) => i !== index);
      recalculateTotals(
        items,
        updated,
        formData.tax_percent,
        formData.deduction,
        formData.percent
      );
      return updated;
    });
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const validItems = items.filter(item => {
        const name = typeof item.item_name === 'object' ? (item.item_name?.name || item.item_name?.item_name || '') : (item.item_name || '');
        return name.trim() !== '' && parseFloat(item.qty) > 0;
      }).map(item => ({
        ...item,
        item_name: typeof item.item_name === 'object' ? (item.item_name?.name || item.item_name?.item_name || '') : (item.item_name || ''),
        qty: parseFloat(item.qty) || 0,
        box: parseFloat(item.box) || 0,
        rate: parseFloat(item.rate) || 0,
        disc: parseFloat(item.disc) || 0,
        tax: parseFloat(item.tax) || 0,
        amount: parseFloat(item.amount) || 0
      }));

      if (validItems.length === 0) {
        setMessage('At least one item with name and quantity is required');
        setMessageType('error');
        setLoading(false);
        return;
      }

      const customerVal = typeof formData.customer === 'object' 
        ? (formData.customer?.name || formData.customer?.label || formData.customer?.customer_name || '') 
        : (formData.customer || '');

      const payload = {
        ...formData,
        customer: customerVal,
        items: validItems,
        deductions: selectedDeductions.filter(d => d.deduction_id || d.name || d.amount)
      };

      let result;
      if (editId) {
        result = await api(`/quotations/${editId}`, {
          method: 'PUT',
          body: payload
        });
      } else {
        result = await api('/quotations', {
          method: 'POST',
          body: payload
        });
      }

      if (result && result.success) {
        setMessage(editId ? 'Quotation updated successfully!' : 'Quotation saved successfully!');
        setMessageType('success');
        setFormData({
          bill_no: '',
          date: new Date().toISOString().split('T')[0],
          pay_type: 'Cash',
          tax_type: 'Exclusive',
          type: 'Urad',
          remarks: '',
          customer: '',
          address: '',
          tax_percent: '0',
          amount: '0.00',
          bill_amt: '0.00',
          tax_amt: '0.00',
          total_amt: '0.00',
          deduction: '',
          percent: '',
          deduction_amount: '0.00',
          deduction_remarks: ''
        });
        setItems([
          { item_name: '', lot_no: '', qty: '', box: '', rate: '', disc: '', tax: '', amount: '' }
        ]);
        setSelectedDeductions([
          { deduction_id: '', name: '', type: 'LESS', percent: '', amount: '', remarks: '' }
        ]);

        const nextResult = await api('/quotations/next-bill-no');
        if (nextResult && nextResult.success) {
          setFormData(prev => ({ ...prev, bill_no: String(nextResult.next_bill_no) }));
        }

        setTimeout(() => {
          setMessage('');
          navigate('/entry/quotation-display');
        }, 1500);
      } else {
        setMessage(result?.message || 'Error saving quotation');
        setMessageType('error');
      }
    } catch (error) {
      setMessage('Error saving quotation: ' + error.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const topFrameFields = [
    { name: 'bill_no', label: 'Bill No', type: 'text', readOnly: true, value: formData.bill_no, col: 1 },
    { name: 'date', label: 'Date', type: 'date', value: formData.date, col: 1 },
    { name: 'pay_type', label: 'Pay Type', type: 'select', options: [
      { value: 'Cash', label: 'Cash' },
      { value: 'Credit', label: 'Credit' }
    ], value: formData.pay_type, col: 1 },
    { name: 'tax_type', label: 'Tax Type', type: 'select', options: [
      { value: 'Exclusive', label: 'Exclusive' },
      { value: 'Inclusive', label: 'Inclusive' },
      { value: 'Without Tax', label: 'Without Tax' }
    ], value: formData.tax_type, col: 2 },
    { name: 'type', label: 'Type', type: 'select', options: [
      { value: 'Pack', label: 'Pack' },
      { value: 'Urad', label: 'Urad' },
      { value: 'Loose', label: 'Loose' }
    ], value: formData.type, col: 2 },
    { name: 'remarks', label: 'Remarks', type: 'textarea', value: formData.remarks, col: 2 },
    { name: 'customer', label: 'Customer', type: 'masterSelect', masterType: 'customers', value: formData.customer, col: 3 },
    { name: 'address', label: 'Address', type: 'textarea', value: formData.address, col: 3 },
  ];

  const itemColumns = [
    { key: 'item_name', title: 'Item Name', type: 'masterSelect', masterType: 'items' },
    { key: 'lot_no', title: 'Lot No', type: 'lotSelect' },
    { key: 'weight', title: 'Weight', type: 'masterSelect', masterType: 'weights' },
    { key: 'qty', title: 'Qty', type: 'number' },
    { key: 'box', title: 'Box', type: 'number' },
    { key: 'rate', title: 'Rate', type: 'number' },
    { key: 'disc', title: 'Disc %', type: 'number' },
    { key: 'tax', title: 'Tax %', type: 'number' },
    { key: 'amount', title: 'Amount', readOnly: true }
  ];

  const totals = [
    { name: 'tax_percent', label: 'Tax %', value: formData.tax_percent },
    { name: 'amount', label: 'Amount', value: formData.amount },
    { name: 'bill_amt', label: 'Bill Amt', value: formData.bill_amt },
    { name: 'tax_amt', label: 'Tax Amt', value: formData.tax_amt },
    { name: 'total_amt', label: 'Total Amt', value: formData.total_amt },
  ];

  const summaryFields = [
    { name: 'deduction', label: 'Deduction', value: formData.deduction },
    { name: 'percent', label: 'Percent %', value: formData.percent },
    { name: 'deduction_amount', label: 'Total Ded', value: formData.deduction_amount },
    { name: 'deduction_remarks', label: 'Remarks', value: formData.deduction_remarks },
  ];

  return (
    <div className="window">
      <div className="screen-title">Quotation Creation</div>

      {message && <div className={`message ${messageType}`}>{message}</div>}

      <EntryTopFrame 
        fields={topFrameFields} 
        data={formData} 
        onChange={handleInputChange}
      />

      <EntryItemsTable 
        columns={itemColumns}
        data={items}
        onRowChange={handleRowChange}
        onAddRow={addItemRow}
        onDeleteRow={deleteItemRow}
        showActions={true}
        lotMode="select"
      />

      {/* Deduction Master Table Section */}
      <EntrySection title="Deduction Details :">
        <div style={{ margin: '10px 0', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#1f4fb2', color: '#fff' }}>
                <th style={{ padding: '8px', border: '1px solid #1976d2' }}>Deduction Master</th>
                <th style={{ padding: '8px', border: '1px solid #1976d2' }}>Type</th>
                <th style={{ padding: '8px', border: '1px solid #1976d2' }}>Percent (%)</th>
                <th style={{ padding: '8px', border: '1px solid #1976d2' }}>Amount</th>
                <th style={{ padding: '8px', border: '1px solid #1976d2' }}>Remarks</th>
                <th style={{ padding: '8px', border: '1px solid #1976d2', width: '50px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {selectedDeductions.map((row, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '4px', border: '1px solid #ccc' }}>
                    <select
                      style={{ width: '100%', height: '30px', padding: '2px 5px' }}
                      value={row.deduction_id}
                      onChange={(e) => handleDeductionRowChange(idx, 'deduction_id', e.target.value)}
                    >
                      <option value="">-- Select Deduction --</option>
                      {deductionsList.map((d, dIdx) => (
                        <option key={`${d.id || 'ded'}-${dIdx}`} value={d.id}>{d.name || d.deduction_name || d.ded_name}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '4px', border: '1px solid #ccc', textAlign: 'center' }}>
                    <select
                      style={{ 
                        width: '100%', 
                        height: '30px', 
                        padding: '2px 5px',
                        backgroundColor: '#fff',
                        color: (String(row.type || '').toUpperCase() === 'ADD' || String(row.type || '').toUpperCase() === 'PLUS' || String(row.type || '').toUpperCase() === '+') ? '#16a34a' : '#dc2626',
                        fontWeight: '700',
                        boxSizing: 'border-box'
                      }}
                      value={(String(row.type || '').toUpperCase() === 'ADD' || String(row.type || '').toUpperCase() === 'PLUS' || String(row.type || '').toUpperCase() === '+') ? 'ADD' : 'LESS'}
                      onChange={(e) => handleDeductionRowChange(idx, 'type', e.target.value.toUpperCase())}
                    >
                      <option value="LESS" style={{ color: '#dc2626', fontWeight: 'bold' }}>LESS (-)</option>
                      <option value="ADD" style={{ color: '#16a34a', fontWeight: 'bold' }}>ADD (+)</option>
                    </select>
                  </td>
                  <td style={{ padding: '4px', border: '1px solid #ccc' }}>
                    <input
                      type="number"
                      style={{ width: '100%', height: '30px', padding: '2px 5px' }}
                      value={row.percent}
                      onChange={(e) => handleDeductionRowChange(idx, 'percent', e.target.value)}
                      placeholder="0"
                    />
                  </td>
                  <td style={{ padding: '4px', border: '1px solid #ccc' }}>
                    <input
                      type="number"
                      style={{ width: '100%', height: '30px', padding: '2px 5px' }}
                      value={row.amount}
                      onChange={(e) => handleDeductionRowChange(idx, 'amount', e.target.value)}
                      placeholder="0.00"
                    />
                  </td>
                  <td style={{ padding: '4px', border: '1px solid #ccc' }}>
                    <input
                      type="text"
                      style={{ width: '100%', height: '30px', padding: '2px 5px' }}
                      value={row.remarks}
                      onChange={(e) => handleDeductionRowChange(idx, 'remarks', e.target.value)}
                      placeholder="Remarks"
                    />
                  </td>
                  <td style={{ padding: '4px', border: '1px solid #ccc', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => deleteDeductionRow(idx)}
                      style={{ background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '3px', padding: '2px 8px', cursor: 'pointer' }}
                    >
                      X
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            onClick={addDeductionRow}
            style={{ marginTop: '8px', background: '#1f4fb2', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
          >
            + Add Deduction
          </button>
        </div>
      </EntrySection>

      <EntryTotalsRow totals={totals} />

      <EntryBottomSummary 
        summaryFields={summaryFields}
        formData={formData}
        onChange={handleInputChange}
      />

      <EntryActions 
        onSave={handleSave}
        saving={loading}
        saveText="Save"
      />
    </div>
  );
};

export default QuotationCreate;
