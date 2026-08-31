import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPurchase } from "../../services/api.js";

import { calculateTotals } from '../../utils/taxCalc'
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
 * PurchaseCreate - Purchase Creation Entry Page
 * Matches SalesCreate format exactly (3-column layout)
 */
const PurchaseCreate = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
  date: new Date().toISOString().split('T')[0],
  pay_type: 'Credit',
  tax_type: 'Exclusive',
  tax_percent: 5,
  type: '',
  lorry_no: '',
  p_o_no: '',
  driver: '',
  pur_trans: '',
  remarks: '',
  supplier_id: '',
  address: '',
  phone: '',
  godown_id: ''
})

const [rows, setRows] = useState([])

const totalsData = calculateTotals(rows, formData.tax_type, formData.tax_percent || 5)




  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Removed buggy generateLot useEffect

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Handler for EntryTopFrame - matches SalesCreate
  const handleTopFrameChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

const handleRowChange = useCallback((index, key, value) => {
    setRows(prevRows => {
      const newRows = [...prevRows];
      if (key === '__batch__' && typeof value === 'object') {
        newRows[index] = { ...newRows[index], ...value };
      } else {
        newRows[index] = { ...newRows[index], [key]: value };
      }
      return newRows;
    });
  }, []);

  const addRow = useCallback((newRow = {}) => {
    setRows(prev => [...prev, newRow]);
  }, []);

  const deleteRow = useCallback((index) => {
    if (rows.length > 1) {
      setRows(prev => prev.filter((_, i) => i !== index));
    }
  }, [rows.length]);

  // Legacy generateLot removed - EntryItemsTable handles auto lotMode

  // Calculate totals for Tauri command
const getBackendTotals = useCallback(() => {
    // Use field names set by EntryItemsTable
    const totalQty = rows.reduce((sum, r) => sum + (parseFloat(r.qty) || 0), 0);
    const totalWeight = rows.reduce(
      (sum, r) => sum + (parseFloat(r.total_wt ?? r.weight ?? 0) || 0),
      0
    ).toLocaleString();

    const totalAmount = rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

    // Debug mapping: verify what EntryItemsTable writes and what we read
    if (rows?.length) {
      console.log('SUMMARY ROWS (PurchaseCreate):', rows);
    }

    let baseAmount = totalAmount;

    let taxAmount = 0;
    if (formData.tax_type === 'Inclusive') {
      baseAmount = totalAmount / (1 + (formData.tax_percent || 5)/100);
      taxAmount = totalAmount - baseAmount;
    }
    
    const netAmount = formData.tax_type === 'Exclusive' ? totalAmount + taxAmount : totalAmount;
    
    return {
      totalQty,
      totalWeight,
      totalAmount,
      baseAmount,
      discAmount: 0,
      taxAmount,
      netAmount,
      deductions: { autoWages: 0, vatPercent: 0, vat: 0 },
      grandTotal: netAmount
    };
  }, [rows, formData.tax_type, formData.tax_percent]);

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const totals = getBackendTotals();

      // Reserve lots on SAVE.
      // Each row gets its own committed lot number (sequentially).
      const reservedItems = [];
      for (const r of rows) {
        let lot_no = r.lot_no;
        if (!lot_no && r.item_id) {
          const reserveRes = await api('/lots/reserve', { method: 'POST' });
          lot_no = reserveRes?.lot_no || reserveRes?.data?.lot_no || '';
        }
        reservedItems.push({ ...r, lot_no });
      }

      // Transform rows to backend format
      const transformedItems = reservedItems.map(r => ({
        item_name: r.item_name,
        lot_no: r.lot_no,
        qty: parseFloat(r.qty) || 0,
        total_wt: parseFloat(r.total_wt ?? (Number(r.qty || 0) * Number(r.weight || r.per_unit_wt || 0))) || 0,
        weight: parseFloat(r.weight ?? r.per_unit_wt) || 0,
        rate: parseFloat(r.rate) || 0,
        disc_percent: parseFloat(r.disc) || 0,
        tax_percent: parseFloat(r.tax_rate) || parseFloat(formData.tax_percent) || 0,
        disc_amount: parseFloat(r.disc_amount ?? 0) || 0,
        tax_amount: parseFloat(r.tax_amount ?? 0) || 0,
        amount: parseFloat(r.amount) || 0
      }));

      const result = await createPurchase(formData, transformedItems, totals)

      if (result.success) {
        setSuccess('Purchase created successfully!')
        setFormData((prev) => ({
          ...prev,
          date: new Date().toISOString().split('T')[0],
          pay_type: 'Credit',
          tax_type: 'Exclusive',
          tax_percent: 5,
          supplier_id: '',
          inv_no: '',
          inv_date: '',
          godown_id: '',
          address: '',
          phone: '',
          remarks: '',
          lorry_no: '',
          p_o_no: '',
          driver: '',
          pur_trans: ''
        }))
        setRows([]);
        setTimeout(() => {
          setSuccess('')
          navigate('/entry/purchase-display')
        }, 1000)
      } else {
        setError(result.message || 'Error creating purchase')
      }
    } catch (err) {
      setError(err.message || 'Error creating purchase')
    } finally {
      setLoading(false)
    }
  }

  // Define fields for EntryTopFrame - organized by columns (matches SalesCreate)
  // ✅ FIXED Purchase fields - NO 'value', supplier autofill
  const topFrameFields = [
    // Column 1
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
    
    // Column 2
    { name: 'inv_no', label: 'Inv No', type: 'text', col: 2 },
    { name: 'inv_date', label: 'Inv Date', type: 'date', col: 2 },
    { name: 'godown_id', label: 'Godown', type: 'masterSelect', masterType: 'godowns', col: 2 },
    
    // Column 3
    { name: 'supplier_id', label: 'Supplier', type: 'masterSelect', masterType: 'suppliers', col: 3 },
    { name: 'address', label: 'Address', type: 'textarea', readOnly: true, col: 3 }
  ];

  // ✅ FIXED Purchase columns + autoLotMode=true (creation)
const columns = [
    { key: 's_no', title: 'S.No', readOnly: true },
    { key: 'item_name', title: 'Item', type: 'masterSelect', masterType: 'items' },
    // 🔥 AUTO LOT: lot_no column simple - NO type:'lotSelect' - EntryItemsTable handles readonly via lotMode="auto"
    { key: 'lot_no', title: 'Lot No' },
    { key: 'qty', title: 'Qty', type: 'number' },
    { key: 'weight', title: 'Weight', type: 'masterSelect', masterType: 'weights' },

    { key: 'rate', title: 'Rate', type: 'number' },
    { key: 'disc', title: 'Disc%', type: 'number' },
    { key: 'tax_rate', title: 'Tax%', type: 'number' },
    { key: 'amount', title: 'Amount', readOnly: true }
  ]

  // Define totals for EntryTotalsRow - matches SalesCreate
  const totals = [
    { label: 'Total Qty', value: items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0), isAmount: false },
    { label: 'Bill Amt', value: formData.bill_amt, isAmount: true },
    { label: 'Tax Amt', value: formData.tax_amt, isAmount: true },
    { label: 'Total Amt', value: formData.total_amt, isAmount: true },
  ]

  // Bottom summary fields - matches SalesCreate
  const summaryFields = [
    { name: 'bill_amt', label: 'Bill Amt', value: formData.bill_amt, readOnly: true },
    { name: 'tax_amt', label: 'Tax Amt', value: formData.tax_amt, readOnly: true },
    { name: 'total_amt', label: 'Total Amt', value: formData.total_amt, readOnly: true },
  ]

  const deductionFields = [
    { name: 'deduction', label: 'Deduction', value: formData.deduction },
    { name: 'deduction_remarks', label: 'Remarks', value: formData.deduction_remarks },
  ]

  return (
    <div className="window">
      {/* SCREEN TITLE - matches SalesCreate */}
      <div className="screen-title">Purchase Creation</div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <form onSubmit={handleSubmit}>
        {/* MODULAR: EntryTopFrame - 3-column form layout - matches SalesCreate */}
        <EntryTopFrame 
          fields={topFrameFields} 
          data={formData} 
          onChange={handleTopFrameChange}
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
          lotMode="auto"
          taxType={formData.tax_type}
          taxRate={formData.tax_percent}
        />

        <EntryBottomSummary
          items={[
            { label: 'Amount', value: totals.billAmt, isAmount: true },
            { label: 'Tax', value: totals.taxAmt, isAmount: true },
            { label: 'Net Total', value: totals.totalAmt, isAmount: true }
          ]}
          deductionFields={deductionFields}
          formData={formData}
          onChange={handleTopFrameChange}
        />

        {/* MODULAR: EntryActions - Save button - matches SalesCreate */}
        <EntryActions 
          onSave={handleSubmit}
          loading={loading}
          saveText="Save"
        />
      </form>
    </div>
  )
}

export default PurchaseCreate
