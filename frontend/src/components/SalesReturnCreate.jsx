import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api.js';
import { calculateTotals } from '../utils/taxCalc';
import './SalesReturnCreate.css';

// Import ALL modular components from entry folder
import { 
  EntryTopFrame, 
  EntryItemsTable, 
  EntryTotalsRow, 
  EntryActions 
} from './entry';

/**
 * SalesReturnCreate - Sales Return Creation Page
 */
const SalesReturnCreate = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');

  const [formData, setFormData] = useState({
    s_no: '',
    date: new Date().toISOString().split('T')[0],
    pay_type: 'Credit',
    tax_type: 'Exclusive',
    tax_percent: 0,
    customer_id: '',
    address: '',
    phone: '',
    godown_from_id: '',
    remarks: '',
    bill_amt: 0,
    tax_amt: 0,
    total_amt: 0,
    deduction: '',
    deduction_remarks: '',
    deduction_amount: 0,
    grand_total: 0
  });

  const [items, setItems] = useState([{}]);
  const [deductionOptions, setDeductionOptions] = useState([]);
  const [selectedDeductions, setSelectedDeductions] = useState([
    { deduction_id: '', name: '', type: 'LESS', percent: '', amount: '', remarks: '' }
  ]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  // Fetch deductions master data on load
  useEffect(() => {
    const fetchDeductions = async () => {
      try {
        const res = await api('/masters/deduction_sales');
        if (res && res.success) {
          setDeductionOptions(res.data || []);
        } else if (Array.isArray(res)) {
          setDeductionOptions(res);
        }
      } catch (err) {
        console.error('Error fetching deductions:', err);
      }
    };
    fetchDeductions();
  }, []);

  // Fetch next S.No or load existing record
  useEffect(() => {
    if (editId) {
      const loadRecord = async () => {
        try {
          const data = await api(`/sales-returns/${editId}`);
          if (data) {
            setFormData({
              s_no: data.s_no || '',
              date: data.date ? data.date.substring(0, 10) : new Date().toISOString().split('T')[0],
              pay_type: data.pay_type || 'Credit',
              tax_type: data.tax_type || 'Exclusive',
              tax_percent: data.tax_percent || 0,
              customer_id: data.customer_id || data.customer || '',
              address: data.address || '',
              phone: data.phone || '',
              godown_from_id: data.godown_from_id || '',
              remarks: data.remarks || '',
              bill_amt: data.bill_amt || 0,
              tax_amt: data.tax_amt || 0,
              total_amt: data.total_amt || 0,
              deduction: data.deduction || '',
              deduction_remarks: data.deduction_remarks || '',
              deduction_amount: data.deduction_amount || 0,
              grand_total: data.grand_total || 0
            });
            if (data.items && data.items.length > 0) {
              setItems(data.items);
            }
          }
        } catch (err) {
          console.error('Error loading sales return record:', err);
        }
      };
      loadRecord();
    } else {
      // Auto-fetch next S.No for new record
      const fetchNextSno = async () => {
        try {
          const res = await api('/sales-returns/next-sno');
          const sno = res?.next_s_no ?? res?.next_sno ?? res?.s_no ?? res?.data?.s_no;
          if (sno) {
            setFormData(prev => ({ ...prev, s_no: String(sno) }));
          } else {
            const fallback = await api.getNextSNo('/sales-returns');
            setFormData(prev => ({ ...prev, s_no: String(fallback) }));
          }
        } catch (e) {
          const fallback = await api.getNextSNo('/sales-returns');
          setFormData(prev => ({ ...prev, s_no: String(fallback) }));
        }
      };
      fetchNextSno();
    }
  }, [editId]);

  useEffect(() => {
    if (items.length === 0) {
      setItems([{}]);
    }
  }, []);

  // Recalculate totals when items or tax type change
  useEffect(() => {
    const mappedItems = items.map(item => ({
      ...item,
      disc: parseFloat(item.disc_perc) || 0,
      tax_rate: parseFloat(item.tax_perc) || 0
    }));
    const taxPct = formData.tax_percent !== '' && formData.tax_percent !== undefined && formData.tax_percent !== null ? (parseFloat(formData.tax_percent) || 0) : 0;
    const newTotals = calculateTotals(mappedItems, formData.tax_type, taxPct);
    setFormData(prev => ({
      ...prev,
      bill_amt: newTotals.taxableAmount,
      tax_amt: newTotals.taxAmount,
      total_amt: newTotals.totalAmount
    }));
  }, [items, formData.tax_type, formData.tax_percent]);

  // Recalculate deductions and grand total when bill totals or deductions change
  useEffect(() => {
    const totalAmt = parseFloat(formData.total_amt) || 0;
    const billAmt = parseFloat(formData.bill_amt) || 0;

    let totalAdditions = 0;
    let totalSubtractions = 0;

    selectedDeductions.forEach(d => {
      const pct = parseFloat(d.percent) || 0;
      let amt = parseFloat(d.amount) || 0;
      if (pct > 0 && billAmt > 0) {
        amt = (billAmt * pct) / 100;
      }
      const dName = String(d.name || '').toLowerCase();
      const rowType = String(d.type || '').toUpperCase();

      const matchingOpt = deductionOptions.find(opt => 
        String(opt.id) === String(d.deduction_id) || 
        (opt.ded_name && opt.ded_name.toLowerCase() === dName)
      );

      const optType = String(matchingOpt?.ded_type || matchingOpt?.type || matchingOpt?.deduction_type || '').toUpperCase();
      
      // Explicit rowType (ADD/LESS) takes precedence; otherwise fallback to master / name
      const isAdd = rowType === 'ADD' || rowType === '+' || rowType === 'ADDITION' || 
                    (rowType !== 'LESS' && (optType === 'ADD' || optType === 'ADDITION' || dName.includes('tcs')));

      if (isAdd) {
        totalAdditions += amt;
      } else {
        totalSubtractions += amt;
      }
    });

    const netDeductionAmount = totalSubtractions - totalAdditions;
    const grandTot = totalAmt + totalAdditions - totalSubtractions;

    setFormData(prev => ({
      ...prev,
      deduction_amount: netDeductionAmount,
      grand_total: Math.max(0, grandTot)
    }));
  }, [formData.total_amt, formData.bill_amt, selectedDeductions, deductionOptions]);

  const handleDeductionRowChange = (index, field, value) => {
    setSelectedDeductions(prev => {
      const updated = [...prev];
      let val = value;
      if (field === 'type') {
        val = (String(value || '').toUpperCase() === 'ADD' || String(value || '').toUpperCase() === 'PLUS' || String(value || '').toUpperCase() === '+') ? 'ADD' : 'LESS';
      }
      updated[index] = { ...updated[index], [field]: val };

      if (field === 'deduction_id') {
        const ded = deductionOptions.find(d => String(d.id) === String(value));
        if (ded) {
          const dVal = parseFloat(ded.ded_value) || 0;
          const billAmt = parseFloat(formData.bill_amt) || 0;
          updated[index].name = ded.ded_name || '';

          const optType = String(ded.ded_type || ded.type || ded.deduction_type || '').toUpperCase();
          const isAdd = optType === 'ADD' || optType === 'ADDITION' || (ded.ded_name && ded.ded_name.toLowerCase().includes('tcs'));
          updated[index].type = isAdd ? 'ADD' : 'LESS';

          if (ded.ded_type === 'Percentage' || ded.ded_type === 'percent') {
            updated[index].percent = String(dVal);
            updated[index].amount = ((billAmt * dVal) / 100).toFixed(2);
          } else {
            updated[index].percent = '';
            updated[index].amount = String(dVal);
          }
        } else {
          updated[index].name = '';
          updated[index].type = 'LESS';
          updated[index].percent = '';
          updated[index].amount = '';
        }
      } else if (field === 'percent') {
        const pct = parseFloat(value) || 0;
        const billAmt = parseFloat(formData.bill_amt) || 0;
        if (pct > 0) {
          updated[index].amount = ((billAmt * pct) / 100).toFixed(2);
        }
      }

      return updated;
    });
  };

  const addDeductionRow = () => {
    setSelectedDeductions(prev => [...prev, { deduction_id: '', name: '', type: 'LESS', percent: '', amount: '', remarks: '' }]);
  };

  const removeDeductionRow = (index) => {
    setSelectedDeductions(prev => {
      if (prev.length <= 1) return [{ deduction_id: '', name: '', type: 'LESS', percent: '', amount: '', remarks: '' }];
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleFormChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleItemChange = useCallback((index, field, value) => {
    setItems(prevItems => {
      const updatedItems = [...prevItems];
      if (field === '__batch__' && typeof value === 'object') {
        updatedItems[index] = { ...updatedItems[index], ...value };
      } else {
        updatedItems[index] = { ...updatedItems[index], [field]: value };
      }

      // Live row amount calculation
      const qty = parseFloat(updatedItems[index].qty) || 0;
      const rate = parseFloat(updatedItems[index].rate) || 0;
      const discPerc = parseFloat(updatedItems[index].disc_perc) || 0;
      const taxPerc = parseFloat(updatedItems[index].tax_perc) || 0;
      const discAmount = (qty * rate * discPerc) / 100;
      const taxableAmount = qty * rate - discAmount;
      const taxAmount = formData.tax_type === 'Exclusive' ? (taxableAmount * taxPerc) / 100 : 0;
      updatedItems[index].amount = taxableAmount + taxAmount;

      return updatedItems;
    });
  }, [formData.tax_type]);

  const addItem = useCallback(() => {
    setItems(prev => [...prev, {}]);
  }, []);

  const removeItem = useCallback((index) => {
    if (items.length > 1) {
      setItems(prev => prev.filter((_, i) => i !== index));
    }
  }, [items.length]);

  const handleSave = async () => {
    setLoading(true);
    setMessage('');

    try {
      const transformedItems = items.map(item => ({
        item_name: item.item_name,
        lot_no: item.lot_no,
        qty: parseFloat(item.qty) || 0,
        rate: parseFloat(item.rate) || 0,
        disc_perc: parseFloat(item.disc_perc) || 0,
        tax_perc: parseFloat(item.tax_perc) || 0,
        amount: parseFloat(item.amount) || 0
      }));

      const validDeductions = selectedDeductions.filter(d => 
        (d.deduction_id && String(d.deduction_id).trim() !== '') || 
        (d.name && String(d.name).trim() !== '') || 
        (parseFloat(d.amount) > 0 || parseFloat(d.percent) > 0)
      );

      const payload = {
        ...formData,
        customer: formData.customer_id,
        total_qty: items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0),
        total_wt: items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0),
        total_amt: formData.grand_total,
        deduction: validDeductions.map(d => d.name).filter(Boolean).join(', '),
        deductions_json: JSON.stringify(validDeductions),
        items: transformedItems
      };

      const endpoint = editId ? `/sales-returns/${editId}` : '/sales-returns';
      const method = editId ? 'PUT' : 'POST';

      const response = await api(endpoint, {
        method,
        body: payload
      });

      if (response && response.success !== false) {
        setMessage('Sales Return saved successfully!');
        setMessageType('success');
        setFormData({
          s_no: '',
          date: new Date().toISOString().split('T')[0],
          pay_type: 'Credit',
          tax_type: 'Exclusive',
          tax_percent: 5,
          customer_id: '',
          address: '',
          phone: '',
          godown_from_id: '',
          remarks: '',
          bill_amt: 0,
          tax_amt: 0,
          total_amt: 0,
          deduction: '',
          deduction_remarks: '',
          deduction_amount: 0,
          grand_total: 0
        });
        setItems([{}]);
        setSelectedDeductions([{ deduction_id: '', name: '', type: 'LESS', percent: '', amount: '', remarks: '' }]);
        setTimeout(() => {
          setMessage('');
          navigate('/entry/sales-return-display');
        }, 1000);
      } else {
        const text = await response.text();
        let errorData = {};
        try { errorData = JSON.parse(text); } catch (e) {}
        setMessage(errorData.error || errorData.message || 'Error saving Sales Return');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error saving sales return:', error);
      setMessage('Error saving Sales Return: ' + error.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const topFrameFields = [
    { name: 'date', label: 'Date', type: 'date', col: 1 },
    { name: 'pay_type', label: 'Pay Type', type: 'select', options: [
      {value: 'Cash', label: 'Cash'},
      {value: 'Credit', label: 'Credit'}
    ], col: 1 },
    { name: 'tax_type', label: 'Tax Type', type: 'select', options: [
      {value: 'Exclusive', label: 'Exclusive'},
      {value: 'Inclusive', label: 'Inclusive'},
      {value: 'Without Tax', label: 'Without Tax'}
    ], col: 2 },
    { name: 'type', label: 'Type', type: 'select', options: [
      {value: 'Urad', label: 'Urad'},
      {value: 'Moong', label: 'Moong'},
      {value: 'Others', label: 'Others'}
    ], col: 2 },
    { name: 'customer_id', label: 'Customer', type: 'masterSelect', masterType: 'customers', col: 3 },
    { name: 'address', label: 'Address', type: 'textarea', readOnly: true, col: 3 }
  ];

  const itemColumns = [
    { key: 'item_name', title: 'Item Name', type: 'masterSelect', masterType: 'items' },
    { key: 'lot_no', title: 'Lot No', type: 'lotSelect' },
    { key: 'weight', title: 'Weight', type: 'masterSelect', masterType: 'weights' },
    { key: 'qty', title: 'Qty', type: 'number' },
    { key: 'box', title: 'Box', type: 'number' },
    { key: 'rate', title: 'Rate', type: 'number' },
    { key: 'disc_perc', title: 'Disc %', type: 'number' },
    { key: 'tax_perc', title: 'Tax %', type: 'number' },
    { key: 'amount', title: 'Amount', readOnly: true },
  ];

  return (
    <div className="window">
      <div className="screen-title">Sales Return Creation</div>

      {message && <div className={`alert ${messageType}`}>{message}</div>}

      <EntryTopFrame 
        fields={topFrameFields} 
        data={formData} 
        onChange={handleFormChange}
        columns={3}
        taxType={formData.tax_type}
        taxRate={formData.tax_percent}
      />

      <EntryItemsTable 
        columns={itemColumns}
        data={items}
        onRowChange={handleItemChange}
        onAddRow={addItem}
        onDeleteRow={removeItem}
        showActions={true}
        lotMode="select"
        taxType={formData.tax_type}
        taxRate={formData.tax_percent}
      />

      <EntryTotalsRow 
        totals={[
          { label: 'Total Qty', value: items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0), isAmount: false },
          { label: 'Bill Amt', value: formData.bill_amt, isAmount: true },
          { label: 'Tax Amt', value: formData.tax_amt, isAmount: true },
          { label: 'Total', value: formData.total_amt, isAmount: true }
        ]} 
      />

      <div style={{ marginTop: '24px', padding: '24px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '2px solid #cbd5e1', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '2px solid #cbd5e1', paddingBottom: '10px' }}>
          <div style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deductions & Summary</div>
          <button
            type="button"
            onClick={addDeductionRow}
            style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
          >
            + Add Deduction Row
          </button>
        </div>

        {selectedDeductions.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.8fr 1.1fr 0.8fr 1.2fr 1.5fr 40px', gap: '10px', marginBottom: '8px', fontWeight: '700', fontSize: '12px', color: '#475569' }}>
            <div>Select Master</div>
            <div>Deduction Name</div>
            <div>Type</div>
            <div>%</div>
            <div>Amount (₹)</div>
            <div>Remarks</div>
            <div style={{ textAlign: 'center' }}>Action</div>
          </div>
        )}

        {selectedDeductions.map((dRow, dIdx) => (
          <div key={dIdx} style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.8fr 1.1fr 0.8fr 1.2fr 1.5fr 40px', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
            <div>
              <select 
                value={dRow.deduction_id || ''} 
                onChange={(e) => handleDeductionRowChange(dIdx, 'deduction_id', e.target.value)}
                style={{ width: '100%', height: '38px', padding: '6px 10px', border: '1px solid #94a3b8', borderRadius: '6px', fontSize: '13px', backgroundColor: '#fff', color: '#0f172a', boxSizing: 'border-box' }}
              >
                <option value="">-- Select Master --</option>
                {deductionOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.ded_name} ({opt.ded_type === 'Percentage' ? `${opt.ded_value}%` : `₹${opt.ded_value}`})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <input 
                type="text" 
                value={dRow.name || ''} 
                onChange={(e) => handleDeductionRowChange(dIdx, 'name', e.target.value)}
                placeholder="Deduction Name"
                style={{ width: '100%', height: '38px', padding: '6px 10px', border: '1px solid #94a3b8', borderRadius: '6px', fontSize: '13px', backgroundColor: '#fff', color: '#0f172a', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <select 
                value={(String(dRow.type || '').toUpperCase() === 'ADD' || String(dRow.type || '').toUpperCase() === 'PLUS' || String(dRow.type || '').toUpperCase() === '+') ? 'ADD' : 'LESS'} 
                onChange={(e) => handleDeductionRowChange(dIdx, 'type', e.target.value)}
                style={{ 
                  width: '100%', 
                  height: '38px', 
                  padding: '6px 8px', 
                  border: '1px solid #94a3b8', 
                  borderRadius: '6px', 
                  fontSize: '13px', 
                  backgroundColor: '#ffffff', 
                  color: (String(dRow.type || '').toUpperCase() === 'ADD' || String(dRow.type || '').toUpperCase() === 'PLUS' || String(dRow.type || '').toUpperCase() === '+') ? '#16a34a' : '#dc2626', 
                  fontWeight: '700', 
                  boxSizing: 'border-box',
                  cursor: 'pointer'
                }}
              >
                <option value="LESS" style={{ color: '#dc2626', fontWeight: 'bold' }}>LESS (-)</option>
                <option value="ADD" style={{ color: '#16a34a', fontWeight: 'bold' }}>ADD (+)</option>
              </select>
            </div>

            <div>
              <input 
                type="number" 
                value={dRow.percent || ''} 
                onChange={(e) => handleDeductionRowChange(dIdx, 'percent', e.target.value)}
                placeholder="%"
                style={{ width: '100%', height: '38px', padding: '6px 10px', border: '1px solid #94a3b8', borderRadius: '6px', fontSize: '13px', backgroundColor: '#fff', color: '#0f172a', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <input 
                type="number" 
                value={dRow.amount || ''} 
                onChange={(e) => handleDeductionRowChange(dIdx, 'amount', e.target.value)}
                placeholder="₹ Amount"
                style={{ width: '100%', height: '38px', padding: '6px 10px', border: '1px solid #94a3b8', borderRadius: '6px', fontSize: '13px', backgroundColor: '#fff', color: '#0f172a', fontWeight: 'bold', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <input 
                type="text" 
                value={dRow.remarks || ''} 
                onChange={(e) => handleDeductionRowChange(dIdx, 'remarks', e.target.value)}
                placeholder="Remarks"
                style={{ width: '100%', height: '38px', padding: '6px 10px', border: '1px solid #94a3b8', borderRadius: '6px', fontSize: '13px', backgroundColor: '#fff', color: '#0f172a', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ textAlign: 'center' }}>
              <button 
                type="button" 
                onClick={() => removeDeductionRow(dIdx)}
                style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none', width: '36px', height: '36px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}
                title="Remove row"
              >
                ✕
              </button>
            </div>
          </div>
        ))}

        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', borderTop: '2px solid #cbd5e1', paddingTop: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '13px', color: '#64748b', display: 'block' }}>Net Deduction / Adjustment:</span>
              <span style={{
                fontSize: '16px',
                fontWeight: '700',
                color: (parseFloat(formData.deduction_amount) || 0) < 0 ? '#16a34a' : ((parseFloat(formData.deduction_amount) || 0) > 0 ? '#dc2626' : '#475569')
              }}>
                {(parseFloat(formData.deduction_amount) || 0) < 0
                  ? `+₹${Math.abs(parseFloat(formData.deduction_amount) || 0).toFixed(2)}`
                  : `₹${(parseFloat(formData.deduction_amount) || 0).toFixed(2)}`}
              </span>
            </div>
            <div style={{ textAlign: 'right', borderLeft: '2px solid #cbd5e1', paddingLeft: '20px' }}>
              <span style={{ fontSize: '14px', fontWeight: '700', color: '#475569', display: 'block' }}>Grand Total:</span>
              <span style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a' }}>
                ₹{(parseFloat(formData.grand_total) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      <EntryActions 
        onSave={handleSave}
        saving={loading}
        saveText="Save Sales Return"
      />
    </div>
  );
};

export default SalesReturnCreate;
