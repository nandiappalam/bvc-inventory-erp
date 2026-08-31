import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../services/api.js'
import { calculateTotals } from '../utils/taxCalc'
import './SalesCreate.css'

// Import ALL modular components from entry folder
import { 
  EntryTopFrame, 
  EntryItemsTable, 
  EntryTotalsRow, 
  EntryBottomSummary, 
  EntryActions 
} from './entry';

/**
 * SalesCreate - Sales Creation Entry Page
 */
const SalesCreate = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('id')
  const isOrder = window.location.pathname.includes('order');

  const [formData, setFormData] = useState({
    s_no: '',
    date: new Date().toISOString().split('T')[0],
    pay_type: 'Credit',
    tax_type: 'Exclusive',
    tax_percent: 5,
    lorry_no: '',
    p_o_no: '',
    driver: '',
    pur_trans: '',
    remarks: '',
    customer_id: '',
    address: '',
    phone: '',
    sender_id: '',
    consignee_id: '',
    godown_from_id: '',
    bill_amt: 0,
    tax_amt: 0,
    total_amt: 0,
    deduction: '',
    deduction_remarks: '',
    deduction_amount: 0,
    grand_total: 0
  })

  const [rows, setRows] = useState([{}])
  const [deductionOptions, setDeductionOptions] = useState([])
  const [selectedDeductions, setSelectedDeductions] = useState([
    { deduction_id: '', name: '', type: 'LESS', percent: '', amount: '', remarks: '' }
  ])
  const [selectedDeductionId, setSelectedDeductionId] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Fetch deductions master data on load
  useEffect(() => {
    const fetchDeductions = async () => {
      try {
        const res = await api('/masters/deduction_sales')
        if (res && res.success) {
          setDeductionOptions(res.data || [])
        } else if (Array.isArray(res)) {
          setDeductionOptions(res)
        }
      } catch (err) {
        console.error('Error fetching deductions:', err)
      }
    }
    fetchDeductions()
  }, [])

  // Load existing data if editId is provided
  useEffect(() => {
    if (editId) {
      const loadRecord = async () => {
        setLoading(true);
        setError('');
        try {
          const data = await api(`/sales/${editId}`);
          if (data) {
            setFormData({
              s_no: data.s_no || '',
              date: data.date ? data.date.substring(0, 10) : new Date().toISOString().split('T')[0],
              pay_type: data.pay_type || 'Credit',
              tax_type: data.tax_type || 'Exclusive',
              tax_percent: data.tax_rate || data.tax_percent || 5,
              lorry_no: data.lorry_no || '',
              p_o_no: data.p_o_no || '',
              driver: data.driver || '',
              pur_trans: data.pur_trans || '',
              remarks: data.remarks || '',
              customer_id: data.customer_id || data.customer || '',
              address: data.address || '',
              phone: data.phone || '',
              sender_id: data.sender_id || '',
              consignee_id: data.consignee_id || '',
              godown_from_id: data.godown_from_id || '',
              bill_amt: data.bill_amt || 0,
              tax_amt: data.tax_amt || 0,
              total_amt: data.total_amt || 0,
              deduction: data.deduction || '',
              deduction_remarks: data.deduction_remarks || '',
              deduction_amount: data.deduction_amount || 0,
              grand_total: data.grand_total || 0
            });

            // Set selected deduction options if available
            let loadedDeductions = [];
            if (data.deductions) {
              try {
                loadedDeductions = typeof data.deductions === 'string' ? JSON.parse(data.deductions) : data.deductions;
              } catch (e) {
                console.error('Error parsing data.deductions:', e);
              }
            }
            if ((!loadedDeductions || loadedDeductions.length === 0) && data.deductions_json) {
              try {
                loadedDeductions = JSON.parse(data.deductions_json);
              } catch (e) {
                console.error('Error parsing data.deductions_json:', e);
              }
            }

            const validDeds = Array.isArray(loadedDeductions) ? loadedDeductions.filter(d => 
              (d.deduction_id && String(d.deduction_id).trim() !== '') || 
              (d.name || d.ded_name || d.deduction_name || d.deduction) || 
              (parseFloat(d.amount) > 0 || parseFloat(d.percent) > 0)
            ) : [];

            if (validDeds.length > 0) {
              setSelectedDeductions(validDeds.map(d => ({
                deduction_id: String(d.deduction_id || d.id || ''),
                name: d.name || d.ded_name || d.deduction_name || d.deduction || '',
                percent: d.percent !== undefined && d.percent !== null ? String(d.percent) : '',
                amount: d.amount !== undefined && d.amount !== null ? String(d.amount) : '',
                remarks: d.remarks || ''
              })));
            } else if (data.deduction || (data.deduction_amount && parseFloat(data.deduction_amount) !== 0)) {
              const matchingDed = deductionOptions.find(d => d.ded_name === data.deduction || String(d.id) === String(data.deduction));
              setSelectedDeductions([{
                deduction_id: matchingDed ? String(matchingDed.id) : '',
                name: data.deduction || (matchingDed ? matchingDed.ded_name : 'Deduction'),
                percent: '',
                amount: String(Math.abs(data.deduction_amount || 0)),
                remarks: data.deduction_remarks || ''
              }]);
              if (matchingDed) {
                setSelectedDeductionId(String(matchingDed.id));
              }
            } else {
              setSelectedDeductions([{ deduction_id: '', name: '', percent: '', amount: '', remarks: '' }]);
            }
            
            if (data.items && data.items.length > 0) {
              setRows(data.items.map((it) => ({
                item_name: it.item_name || '',
                lot_no: it.lot_no || '',
                qty: it.qty || '',
                weight: it.weight || '',
                per_unit_wt: it.weight || '',
                total_wt: it.total_wt || '',
                total_weight: it.total_wt || '',
                rate: it.rate || '',
                disc: it.disc !== undefined ? it.disc : (it.disc_perc || ''),
                tax_rate: it.tax_rate !== undefined ? it.tax_rate : (it.tax_perc || ''),
                amount: it.total_amt || it.amount || ''
              })));
            }
          } else {
            setError('Could not load the specified record.');
          }
        } catch (err) {
          console.error('Error loading sales record:', err);
          setError('Error loading record: ' + err.message);
        } finally {
          setLoading(false);
        }
      };
      loadRecord();
    } else {
      if (rows.length === 0) {
        setRows([{}]);
      }
      // Fetch next sequential s_no for Bill No / Order No
      api(`/sales/next-sno?is_order=${isOrder ? 1 : 0}`)
        .then(async res => {
          const sno = res?.next_sno ?? res?.next_s_no ?? res?.s_no ?? res?.data?.s_no;
          if (sno) {
            setFormData(prev => ({ ...prev, s_no: String(sno) }));
          } else {
            const fallback = await api.getNextSNo(`/sales?is_order=${isOrder ? 1 : 0}`);
            setFormData(prev => ({ ...prev, s_no: String(fallback) }));
          }
        })
        .catch(async () => {
          try {
            const fallback = await api.getNextSNo(`/sales?is_order=${isOrder ? 1 : 0}`);
            setFormData(prev => ({ ...prev, s_no: String(fallback) }));
          } catch (e) {}
        });
    }
  }, [editId, isOrder]);

  // Sync missing deduction_id from deductionOptions when master data arrives
  useEffect(() => {
    if (deductionOptions.length > 0) {
      setSelectedDeductions(prev => prev.map(d => {
        if (!d.deduction_id && d.name) {
          const match = deductionOptions.find(opt => opt.ded_name === d.name || opt.ded_code === d.name);
          if (match) return { ...d, deduction_id: String(match.id) };
        }
        return d;
      }));
    }
  }, [deductionOptions]);

  // Recalculate invoice totals when items or tax type change
  useEffect(() => {
    const newTotals = calculateTotals(rows, formData.tax_type, formData.tax_percent || 5)
    setFormData(prev => ({
      ...prev,
      bill_amt: newTotals.taxableAmount,
      tax_amt: newTotals.taxAmount,
      total_amt: newTotals.totalAmount
    }))
  }, [rows, formData.tax_type, formData.tax_percent])

  // Recalculate deductions and grand total when bill totals or deductions change
  useEffect(() => {
    const totalAmt = parseFloat(formData.total_amt) || 0
    const billAmt = parseFloat(formData.bill_amt) || 0
    
    let totalAdditions = 0
    let totalSubtractions = 0

    selectedDeductions.forEach(d => {
      const pct = parseFloat(d.percent) || 0
      let amt = parseFloat(d.amount) || 0
      if (pct > 0 && billAmt > 0) {
        amt = (billAmt * pct) / 100
      }
      const dName = String(d.name || '').toLowerCase()
      const dCode = String(d.ded_code || '').toUpperCase()
      const rowType = String(d.type || '').toUpperCase()
      const matchingOpt = deductionOptions.find(opt => 
        String(opt.id) === String(d.deduction_id) || 
        (opt.ded_name && opt.ded_name.toLowerCase() === dName) ||
        (opt.ded_code && opt.ded_code.toLowerCase() === dName)
      );

      const optCode = String(matchingOpt?.ded_code || '').toUpperCase();
      const optHead = String(matchingOpt?.account_head || '').toLowerCase();
      const optType = String(matchingOpt?.ded_type || matchingOpt?.type || matchingOpt?.deduction_type || '').toLowerCase();

      // Explicit rowType (ADD/LESS) takes precedence; otherwise fallback to master / name
      const isAdd = rowType === 'ADD' || rowType === '+' || rowType === 'ADDITION' || 
                    (rowType !== 'LESS' && (dName.includes('tcs') || dCode.includes('TCS') || optCode.includes('TCS') || optHead.includes('tcs') || optType === 'add' || optType === '+'));

      if (isAdd) {
        totalAdditions += amt
      } else {
        totalSubtractions += amt
      }
    })

    const customManualDed = parseFloat(formData.deduction) || 0
    const netDeductionAmount = totalSubtractions + customManualDed - totalAdditions
    const grandTot = totalAmt + totalAdditions - totalSubtractions - customManualDed

    setFormData(prev => ({
      ...prev,
      deduction_amount: netDeductionAmount,
      grand_total: Math.max(0, grandTot)
    }))
  }, [formData.total_amt, formData.bill_amt, formData.deduction, selectedDeductions, deductionOptions])

  const handleDeductionRowChange = (index, field, value) => {
    setSelectedDeductions(prev => {
      const updated = [...prev]
      let val = value
      if (field === 'type') {
        val = (String(value || '').toUpperCase() === 'ADD' || String(value || '').toUpperCase() === 'PLUS' || String(value || '').toUpperCase() === '+') ? 'ADD' : 'LESS'
      }
      updated[index] = { ...updated[index], [field]: val }

      if (field === 'deduction_id') {
        const ded = deductionOptions.find(d => String(d.id) === String(value))
        if (ded) {
          const dVal = parseFloat(ded.ded_value) || 0
          const billAmt = parseFloat(formData.bill_amt) || 0
          updated[index].name = ded.ded_name || ''
          
          const optType = String(ded.ded_type || ded.type || ded.deduction_type || '').toUpperCase();
          const isAdd = optType === 'ADD' || optType === 'ADDITION' || (ded.ded_name && ded.ded_name.toLowerCase().includes('tcs'));
          updated[index].type = isAdd ? 'ADD' : 'LESS';

          if (ded.ded_type === 'Percentage' || ded.ded_type === 'percent') {
            updated[index].percent = String(dVal)
            updated[index].amount = ((billAmt * dVal) / 100).toFixed(2)
          } else {
            updated[index].percent = ''
            updated[index].amount = String(dVal)
          }
        } else {
          updated[index].name = ''
          updated[index].type = 'LESS'
          updated[index].percent = ''
          updated[index].amount = ''
        }
      } else if (field === 'percent') {
        const pct = parseFloat(value) || 0
        const billAmt = parseFloat(formData.bill_amt) || 0
        if (pct > 0) {
          updated[index].amount = ((billAmt * pct) / 100).toFixed(2)
        }
      }

      return updated
    })
  }

  const addDeductionRow = () => {
    setSelectedDeductions(prev => [...prev, { deduction_id: '', name: '', type: 'LESS', percent: '', amount: '', remarks: '' }])
  }

  const removeDeductionRow = (index) => {
    setSelectedDeductions(prev => {
      if (prev.length <= 1) return [{ deduction_id: '', name: '', type: 'LESS', percent: '', amount: '', remarks: '' }]
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleFormChange = useCallback((e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }, [])

  const handleRowChange = useCallback((index, field, value) => {
    setRows(prevRows => {
      const updatedRows = [...prevRows]
      if (field === '__batch__' && typeof value === 'object') {
        updatedRows[index] = { ...updatedRows[index], ...value }
      } else {
        updatedRows[index] = { ...updatedRows[index], [field]: value }
      }
      return updatedRows
    })
  }, [])

  const addRow = useCallback((newRow = {}) => {
    setRows(prev => [...prev, newRow])
  }, [])

  const deleteRow = useCallback((index) => {
    if (rows.length > 1) {
      setRows(prev => prev.filter((_, i) => i !== index))
    }
  }, [rows.length])

  const getBackendTotals = () => {
    const totalQty = rows.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0)
    const totalWeight = rows.reduce((sum, item) => sum + (parseFloat(item.total_wt || item.total_weight || 0)), 0)
    const totalAmount = rows.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)
    
    let baseAmount = formData.bill_amt
    let taxAmount = formData.tax_amt
    const netAmount = formData.total_amt
    const grandTotal = formData.grand_total

    return {
      totalQty,
      totalWeight,
      totalAmount,
      baseAmount,
      discAmount: 0,
      taxAmount,
      netAmount,
      deductions: { autoWages: 0, vatPercent: 0, vat: formData.deduction_amount },
      grandTotal
    }
  }

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const totals = getBackendTotals()
      const transformedItems = rows.map(item => {
        const qty = parseFloat(item.qty) || 0;
        const weight = parseFloat(item.weight || item.per_unit_wt || 0);
        const totalWt = parseFloat(item.total_wt || item.total_weight || (qty * weight));
        const disc = parseFloat(item.disc) || 0;
        const tax = parseFloat(item.tax_rate) || 0;
        const amount = parseFloat(item.amount) || 0;

        return {
          itemName: item.item_name,
          lotNo: item.lot_no,
          qty,
          weight,
          totalWt,
          rate: parseFloat(item.rate) || 0,
          disc,
          discPerc: disc,
          tax,
          taxPerc: tax,
          amount,
          totalAmt: amount,
          box: parseFloat(item.box) || 0
        };
      })

      const validDeductions = selectedDeductions.filter(d => 
        (d.deduction_id && String(d.deduction_id).trim() !== '') || 
        (d.name && String(d.name).trim() !== '') || 
        (parseFloat(d.amount) > 0 || parseFloat(d.percent) > 0)
      );

      const payload = {
        formData: {
          ...formData,
          customer: formData.customer_id, // Map customer ID to customer field
          is_order: isOrder ? 1 : 0,
          selectedDeductions: validDeductions
        },
        items: transformedItems,
        totals
      }

      let result;
      if (editId) {
        result = await api(`/sales/${editId}`, { method: 'PUT', body: payload })
      } else {
        result = await api('/entries/sale', { method: 'POST', body: payload })
      }
      
      if (!result) {
        setError('API failed (null response)');
        return;
      }

      if (result.success || result.message === 'Sales record updated successfully!') {
        setSuccess(
          editId 
            ? (isOrder ? 'Sales Order updated successfully!' : 'Sales updated successfully!')
            : (isOrder ? 'Sales Order created successfully!' : 'Sales created successfully!')
        )

        if (!editId) {
          setFormData({
            s_no: '', date: new Date().toISOString().split('T')[0], pay_type: 'Credit',
            tax_type: 'Exclusive', lorry_no: '', p_o_no: '', driver: '',
            pur_trans: '', remarks: '', customer_id: '', address: '', phone: '',
            sender_id: '', consignee_id: '', godown_from_id: '', bill_amt: 0, tax_amt: 0,
            total_amt: 0, deduction: '', deduction_remarks: '', deduction_amount: 0, grand_total: 0
          })
          setRows([{ item_name: '', lot_no: '', qty: '', weight: '', total_wt: '', rate: '', disc: '', tax_rate: '', amount: '' }])
          setSelectedDeductionId('')
        }

        setTimeout(() => {
          setSuccess('')
          navigate(isOrder ? '/entry/sales-order-display' : '/entry/sales-display')
        }, 1000)
      } else {
        setError(result.message || 'Error saving sales record')
      }
    } catch (err) {
      setError(err.message || 'Error saving sales record')
    } finally {
      setLoading(false)
    }
  }

  const topFrameFields = isOrder ? [
    { name: 's_no', label: 'Order No', type: 'text', readOnly: true, col: 1 },
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
      {value: 'Pack', label: 'Pack'},
      {value: 'Bulk', label: 'Bulk'},
      {value: 'Loose', label: 'Loose'}
    ], col: 2 },
    { name: 'remarks', label: 'Remarks', type: 'textarea', col: 2 },
    { name: 'customer_id', label: 'Customer', type: 'masterSelect', masterType: 'customers', col: 3 },
    { name: 'address', label: 'Address', type: 'textarea', readOnly: true, col: 3 }
  ] : [
    // Column 1: Basic Options
    { name: 's_no', label: 'Bill No', type: 'text', readOnly: true, col: 1 },
    { name: 'date', label: 'Date', type: 'date', col: 1 },
    { name: 'pay_type', label: 'Pay Type', type: 'select', options: [
      {value: 'Cash', label: 'Cash'},
      {value: 'Credit', label: 'Credit'}
    ], col: 1 },
    { name: 'tax_type', label: 'Tax Type', type: 'select', options: [
      {value: 'Exclusive', label: 'Exclusive'},
      {value: 'Inclusive', label: 'Inclusive'},
      {value: 'Without Tax', label: 'Without Tax'}
    ], col: 1 },
    { name: 'type', label: 'Type', type: 'select', options: [
      {value: 'Pack', label: 'Pack'},
      {value: 'Bulk', label: 'Bulk'},
      {value: 'Loose', label: 'Loose'}
    ], col: 1 },

    // Column 2: Dispatch / Vehicle Info
    { name: 'lorry_no', label: 'Lorry No', type: 'text', col: 2 },
    { name: 'p_o_no', label: 'P.O No', type: 'text', col: 2 },
    { name: 'driver', label: 'Driver', type: 'text', col: 2 },
    { name: 'pur_trans', label: 'Pur. Trans', type: 'masterSelect', masterType: 'transports', col: 2 },
    { name: 'sign', label: 'Sign', type: 'text', col: 2 },
    { name: 'remarks', label: 'Remarks', type: 'textarea', col: 2 },

    // Column 3: Party Details
    { name: 'customer_id', label: 'Customer', type: 'masterSelect', masterType: 'customers', col: 3 },
    { name: 'address', label: 'Address', type: 'textarea', readOnly: true, col: 3 },
    { name: 'sender_id', label: 'Sender', type: 'masterSelect', masterType: 'senders', col: 3 },
    { name: 'consignee_id', label: 'Consigned To', type: 'masterSelect', masterType: 'consignees', col: 3 }
  ]

  const columns = isOrder ? [
    { key: 's_no', title: 'S.No', readOnly: true },
    { key: 'item_name', title: 'Item Name', type: 'masterSelect', masterType: 'items' },
    { key: 'weight', title: 'Weight', type: 'masterSelect', masterType: 'weights' },
    { key: 'qty', title: 'Qty', type: 'number' },
    { key: 'total_wt', title: 'Total Wt', type: 'number', readOnly: true },
    { key: 'rate', title: 'Rate', type: 'number' },
    { key: 'disc', title: 'Disc%', type: 'number' },
    { key: 'tax_rate', title: 'Tax%', type: 'number' },
    { key: 'amount', title: 'Amount', readOnly: true }
  ] : [
    { key: 's_no', title: 'S.No', readOnly: true },
    { key: 'item_name', title: 'Item Name', type: 'masterSelect', masterType: 'items' },
    { key: 'lot_no', title: 'Lot No', type: 'lotSelect' },
    { key: 'weight', title: 'Weight', type: 'masterSelect', masterType: 'weights' },
    { key: 'qty', title: 'Qty', type: 'number' },
    { key: 'total_wt', title: 'Total Wt', type: 'number', readOnly: true },
    { key: 'rate', title: 'Rate', type: 'number' },
    { key: 'disc', title: 'Disc%', type: 'number' },
    { key: 'tax_rate', title: 'Tax%', type: 'number' },
    { key: 'amount', title: 'Amount', readOnly: true }
  ]

  const handleDeductionSelectChange = (e) => {
    const value = e.target.value
    setSelectedDeductionId(value)
    if (!value) {
      setFormData(prev => ({ ...prev, deduction: '', deduction_amount: 0 }))
    } else {
      const ded = deductionOptions.find(d => String(d.id) === String(value))
      if (ded) {
        setFormData(prev => ({ ...prev, deduction: ded.ded_name }))
      }
    }
  }

  return (
    <div className="window">
      <div className="screen-title">{isOrder ? 'Sales Order Creation' : 'Sales Creation'}</div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <form onSubmit={handleSubmit}>
        <EntryTopFrame 
          fields={topFrameFields} 
          data={formData} 
          onChange={handleFormChange}
          columns={3}
          taxType={formData.tax_type}
          taxRate={formData.tax_percent}
        />

        <EntryItemsTable 
          columns={columns}
          data={rows}
          onRowChange={handleRowChange}
          onAddRow={addRow}
          onDeleteRow={deleteRow}
          showActions={true}
          lotMode={isOrder ? 'none' : 'select'}
          taxType={formData.tax_type}
          taxRate={formData.tax_percent}
        />

        <EntryTotalsRow 
          totals={[
            { label: 'Total Qty', value: rows.reduce((sum, r) => sum + (parseFloat(r.qty) || 0), 0), isAmount: false },
            { label: 'Bill Amt', value: formData.bill_amt, isAmount: true },
            { label: 'Tax Amt', value: formData.tax_amt, isAmount: true },
            { label: 'Total', value: formData.total_amt, isAmount: true }
          ]} 
        />

        <div style={{ marginTop: '24px', padding: '24px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '2px solid #cbd5e1', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '2px solid #cbd5e1', paddingBottom: '10px' }}>
            <div style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deductions & Final Summary</div>
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
          onSave={handleSubmit}
          loading={loading}
          saveText={isOrder ? 'Save Sales Order' : 'Save Sales'}
        />
      </form>
    </div>
  )
}

export default SalesCreate
