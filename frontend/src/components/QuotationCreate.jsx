import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './QuotationCreate.css';
import api from "../services/api.js";
import { calculateTotals } from '../utils/taxCalc';
import { 
  EntryTopFrame, 
  EntryItemsTable, 
  EntryTotalsRow, 
  EntryBottomSummary, 
  EntryActions, 
  EntrySection,
  EntryTaxBillDetails 
} from './entry';
import { InlineMasterModal, getCreateLabel } from './common/InlineMasterModal.jsx';
import SalesDistributionWorkflow from './common/SalesDistributionWorkflow.jsx';

const QuotationCreate = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');

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
    tax_percent_display: '0%',
    amount: '0.00',
    gross_amt: '0.00',
    disc_percent: '0',
    disc_amount: '0.00',
    bill_amt: '0.00',
    tax_amt: '0.00',
    cgst_amt: '0.00',
    sgst_amt: '0.00',
    igst_amt: '0.00',
    total_amt: '0.00',
    grand_total: '0.00',
    rate_summaries: [],
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
  const [inlineDeductionOpen, setInlineDeductionOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  // Recalculate quotation financial totals using centralized tax service
  const recalculateTotals = (updatedItems, updatedDeductions, taxPercentVal, customDeduction, customPercent) => {
    const formattedDeductions = (updatedDeductions || []).map(d => ({
      amount: parseFloat(d.amount) || 0,
      type: (d.type || 'LESS').toUpperCase()
    }));
    if (parseFloat(customDeduction) > 0) {
      formattedDeductions.push({ amount: parseFloat(customDeduction), type: 'LESS' });
    }

    const calcResult = calculateTotals(
      updatedItems || [],
      formData.tax_type || 'Exclusive',
      parseFloat(taxPercentVal !== undefined && taxPercentVal !== null ? taxPercentVal : formData.tax_percent) || 0,
      formData.address || 'Tamil Nadu',
      'Tamil Nadu',
      formattedDeductions
    );

    setFormData(prev => ({
      ...prev,
      gross_amt: (calcResult.grossAmount || calcResult.baseAmount || 0).toFixed(2),
      disc_percent: String(calcResult.discPercent || 0),
      disc_amount: (calcResult.discAmount || 0).toFixed(2),
      amount: calcResult.baseAmount.toFixed(2),
      bill_amt: calcResult.taxableAmount.toFixed(2),
      tax_amt: calcResult.taxAmount.toFixed(2),
      cgst_amt: (calcResult.cgstAmount || 0).toFixed(2),
      sgst_amt: (calcResult.sgstAmount || 0).toFixed(2),
      igst_amt: (calcResult.igstAmount || 0).toFixed(2),
      total_amt: calcResult.totalAmount.toFixed(2),
      grand_total: calcResult.grandTotal.toFixed(2),
      deduction_amount: calcResult.deductionAmount.toFixed(2),
      tax_percent: String(calcResult.primaryTaxRate || 0),
      tax_percent_display: calcResult.taxPercentDisplay || '0%',
      rate_summaries: calcResult.rateSummaries || []
    }));
  };

  // Fetch initial data & edit record if present
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        if (editId) {
          const res = await api(`/quotations/${editId}`);
          if (res) {
            const customerVal = res.customer_name || res.customer || res.customer_id || '';
            const initialTaxRate = String(res.tax_percent !== undefined && res.tax_percent !== null ? res.tax_percent : '0');

            setFormData(prev => ({
              ...prev,
              bill_no: String(res.bill_no || res.s_no || ''),
              date: res.date ? res.date.substring(0, 10) : new Date().toISOString().split('T')[0],
              pay_type: res.pay_type || 'Cash',
              tax_type: res.tax_type || 'Exclusive',
              type: res.type || 'Urad',
              remarks: res.remarks || '',
              customer: customerVal,
              address: res.address || '',
              tax_percent: initialTaxRate,
              amount: String(res.amount || '0.00'),
              bill_amt: String(res.bill_amt || '0.00'),
              tax_amt: String(res.tax_amt || '0.00'),
              total_amt: String(res.total_amt || '0.00'),
              deduction: String(res.deduction || ''),
              percent: String(res.percent || ''),
              deduction_amount: String(res.deduction_amount || '0.00'),
              deduction_remarks: res.deduction_remarks || ''
            }));

            let mappedItems = [];
            if (Array.isArray(res.items) && res.items.length > 0) {
              mappedItems = res.items.map(it => ({
                item_name: it.item_name || '',
                lot_no: it.lot_no || '',
                qty: String(it.qty !== undefined ? it.qty : ''),
                box: String(it.box !== undefined ? it.box : ''),
                rate: String(it.rate !== undefined ? it.rate : ''),
                disc: String(it.disc !== undefined ? it.disc : ''),
                tax: String(it.tax !== undefined ? it.tax : ''),
                amount: String(it.amount !== undefined ? it.amount : '')
              }));
            } else if (res.item_name) {
              mappedItems = [{
                item_name: res.item_name || '',
                lot_no: res.lot_no || '',
                qty: String(res.qty || ''),
                box: String(res.box || ''),
                rate: String(res.rate || ''),
                disc: String(res.disc || ''),
                tax: String(res.tax || ''),
                amount: String(res.amount || '')
              }];
            } else {
              mappedItems = [{ item_name: '', lot_no: '', qty: '', box: '', rate: '', disc: '', tax: '', amount: '' }];
            }
            setItems(mappedItems);

            let initialDeds = [{ deduction_id: '', name: '', type: 'LESS', percent: '', amount: '', remarks: '' }];
            if (Array.isArray(res.deductions) && res.deductions.length > 0) {
              initialDeds = res.deductions;
            } else if (parseFloat(res.deduction_amount) > 0 || res.deduction) {
              initialDeds = [{
                deduction_id: '',
                name: res.deduction || 'Deduction',
                type: 'LESS',
                percent: String(res.percent || ''),
                amount: String(res.deduction_amount || ''),
                remarks: res.deduction_remarks || ''
              }];
            }
            setSelectedDeductions(initialDeds);

            // Immediately trigger totals calculation for loaded data
            recalculateTotals(mappedItems, initialDeds, initialTaxRate, res.deduction, res.percent);
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

  const handleInlineDeductionCreated = async (newId, newRecord) => {
    try {
      const res = await api('/masters/deduction_sales');
      const list = res?.data || res || [];
      if (Array.isArray(list)) setDeductionsList(list);
      const targetId = newId || newRecord?.id;
      const found = (Array.isArray(list) ? list : []).find(d => String(d.id) === String(targetId)) || newRecord;
      if (found) {
        setSelectedDeductions(prev => {
          const filtered = prev.filter(r => r.deduction_id || r.name);
          const updated = [
            ...filtered,
            {
              deduction_id: targetId,
              name: found.name || found.deduction_name || found.ded_name || '',
              type: (found.type || found.deduction_type || 'LESS').toUpperCase(),
              percent: found.deduction_value || found.ded_value || '',
              amount: '',
              remarks: ''
            }
          ];
          recalculateTotals(
            items,
            updated,
            formData.tax_percent,
            formData.deduction,
            formData.percent
          );
          return updated;
        });
      }
    } catch (err) {
      console.error('Error refreshing quotation deductions:', err);
    }
  };

  const handleDeductionRowChange = (index, field, value) => {
    if (field === 'deduction_id' && (value === '__CREATE_NEW__' || value === 'create_new' || value === 'manual')) {
      setInlineDeductionOpen(true);
      return;
    }
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
    { key: 'tax', title: 'Tax %', type: 'taxSelect' },
    { key: 'amount', title: 'Amount', readOnly: true }
  ];

  const totals = [
    { name: 'tax_percent', label: 'Tax %', value: formData.tax_percent_display || (formData.tax_percent ? `${formData.tax_percent}%` : '0%'), isAmount: false },
    { name: 'bill_amt', label: 'Bill Amt', value: formData.bill_amt, isAmount: true },
    { name: 'cgst_amt', label: 'CGST', value: formData.cgst_amt || '0.00', isAmount: true },
    { name: 'sgst_amt', label: 'SGST', value: formData.sgst_amt || '0.00', isAmount: true },
    { name: 'tax_amt', label: 'Tax Amt', value: formData.tax_amt, isAmount: true },
    { name: 'total_amt', label: 'Total Amt', value: formData.total_amt, isAmount: true },
  ];

  const summaryFields = [
    { name: 'deduction', label: 'Deduction', value: formData.deduction },
    { name: 'percent', label: 'Percent %', value: formData.percent },
    { name: 'deduction_amount', label: 'Total Ded', value: formData.deduction_amount },
    { name: 'deduction_remarks', label: 'Remarks', value: formData.deduction_remarks },
  ];

  return (
    <div className="window">
      <SalesDistributionWorkflow currentModule="quotation" />
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
                      <option value="__CREATE_NEW__" style={{ fontWeight: 'bold', color: '#1e3a8a' }}>
                        {getCreateLabel('deductions')}
                      </option>
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
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '8px' }}>
            <select
              value=""
              onChange={(e) => {
                const val = e.target.value;
                if (val === '__CREATE_NEW__' || val === 'create_new' || val === 'manual') {
                  setInlineDeductionOpen(true);
                  return;
                }
                if (val) {
                  const master = deductionsList.find(d => String(d.id) === String(val));
                  if (master) {
                    setSelectedDeductions(prev => [
                      ...prev.filter(r => r.deduction_id || r.name),
                      {
                        deduction_id: master.id,
                        name: master.name || master.deduction_name || master.ded_name || '',
                        type: (master.type || master.deduction_type || 'LESS').toUpperCase(),
                        percent: master.deduction_value || master.ded_value || '',
                        amount: '',
                        remarks: ''
                      }
                    ]);
                  }
                }
              }}
              style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #1f4fb2', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: '#fff' }}
            >
              <option value="">+ Add Deduction</option>
              {deductionsList.map((d, dIdx) => (
                <option key={`${d.id || 'ded'}-${dIdx}`} value={d.id}>{d.name || d.deduction_name || d.ded_name}</option>
              ))}
              <option value="__CREATE_NEW__" style={{ fontWeight: 'bold', color: '#1e3a8a' }}>
                {getCreateLabel('deductions')}
              </option>
            </select>
            <button
              type="button"
              onClick={addDeductionRow}
              style={{ background: '#1f4fb2', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              + Add Deduction Row
            </button>
          </div>
        </div>
      </EntrySection>

      <EntryTaxBillDetails 
        title="Quotation Bill & GST Tax Breakdown"
        grossAmt={formData.gross_amt || formData.amount || 0}
        discPercent={formData.disc_percent || 0}
        discAmt={formData.disc_amount || 0}
        billAmt={formData.bill_amt}
        taxAmt={formData.tax_amt}
        totalAmt={formData.total_amt}
        grandTotal={formData.grand_total || formData.total_amt}
        taxPercent={formData.tax_percent}
        cgstAmt={formData.cgst_amt}
        sgstAmt={formData.sgst_amt}
        igstAmt={formData.igst_amt}
        rateSummaries={formData.rate_summaries}
        deductionsAmt={formData.deduction_amount}
        taxType={formData.tax_type}
        isInterState={Boolean(formData.address && !formData.address.toLowerCase().includes('tamil nadu') && !formData.address.toLowerCase().includes('tn'))}
      />

      <EntryBottomSummary 
        summaryFields={summaryFields}
        formData={formData}
        onChange={handleInputChange}
      />

      <EntryActions 
        onSave={handleSave}
        saving={loading}
        saveText={editId ? "Update Quotation" : "Save Quotation"}
      />

      {/* Inline Master Modal for Deductions */}
      <InlineMasterModal
        open={inlineDeductionOpen}
        onClose={() => setInlineDeductionOpen(false)}
        masterType="deduction_sales"
        onSuccess={handleInlineDeductionCreated}
      />
    </div>
  );
};

export default QuotationCreate;
