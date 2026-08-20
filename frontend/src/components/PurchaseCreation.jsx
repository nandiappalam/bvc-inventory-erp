import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { api, getMasters } from '../utils/api'
import purchaseOrderService from '../modules/purchaseOrder/services/purchaseOrderService';
import { buildReceiptDraftFromPurchaseOrder } from '../modules/purchaseOrder/utils/poToReceipt.mjs';


import EntryTopFrame from './entry/EntryTopFrame'
import EntryItemsTable from './entry/EntryItemsTable'
import EntryBottomSummary from './entry/EntryBottomSummary'
import EntryActions from './entry/EntryActions'
import './SalesCreate.css'

/**
 * PurchaseCreation
 * Single-file implementation:
 * - EntryItemsTable calculates row values (amount, tax_amount, weight)
 * - This page ONLY aggregates totals and builds backend payload
 */
const PurchaseCreation = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    s_no: '',
    supplier_id: '',
    date: new Date().toISOString().split('T')[0],
    inv_no: '',
    inv_date: '',
    godown_id: '',
    pay_type: 'Cash',

    // Supplier formatted details (auto-filled)
    supplier_details: '',


    tax_type: 'Exclusive',
    tax_rate: 5,

    type: 'Urad',
    remarks: '',
    source_order_no: '',
    source_order_id: ''
  })

  // Backend (/routes/purchases.js) expects legacy shape inside req.body: { formData, items, totals }
  // IMPORTANT: purchase handler reads: formData.date, formData.supplier, formData.payType, formData.invNo,
  // formData.invDate, formData.godown, formData.taxType, formData.type, formData.address, formData.sno, etc.
  const backendFormData = useMemo(() => {
    return {
      date: formData.date,
      supplier: formData.supplier_id,
      payType: formData.pay_type,
      address: formData.supplier_details || formData.address,
      invNo: formData.inv_no,
      invDate: formData.inv_date,
      godown: formData.godown_id,
      taxType: formData.tax_type, // Use actual tax_type from form

      tax_percent: formData.tax_rate,
      type: formData.type, // purchase_type
      sno: formData.s_no || 1,
      remarks: formData.remarks,
      source_order_no: formData.source_order_no,
      source_order_id: formData.source_order_id,
      // Keep fields that may be used by ledger helper
      supplier_id: formData.supplier_id
    }
  }, [formData])

  const [tableData, setTableData] = useState([]);
  const [deductions, setDeductions] = useState([]);
  const [selectedDeductions, setSelectedDeductions] = useState([]);

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Fetch Masters and Existing Record
  useEffect(() => {
    const loadDeductions = async () => {
      try {
        // Changed from 'purchase_deduction_master' to 'deduction_purchase' to match backend whitelist
        const res = await getMasters('deduction_purchase');
        const data = res?.data || res;
        setDeductions(Array.isArray(data) ? data : []);
      } catch (err) { console.error('Deduction load failed', err); }
    };

    const fetchNextSNo = async () => {
      if (id) return;
      try {
        const nextSNo = await api.getNextSNo('/purchases/purchase-list');
        setFormData(prev => ({ ...prev, s_no: String(nextSNo) }));
      } catch (err) {
        console.error('Failed to fetch next S.No:', err);
      }
    };

    fetchNextSNo();
    loadDeductions();

    const fetchPurchase = async () => {
      if (!id) return;
      setLoading(true);
      try {
        let weightsList = [];
        try {
          const weightsRes = await getMasters('weights');
          weightsList = weightsRes?.data || weightsRes || [];
        } catch (wErr) {
          console.error('Failed to load weights list during edit', wErr);
        }

        const result = await api(`/purchases/${id}`);
        if (result) {
          setFormData({
            s_no: String(result.s_no),
            supplier_id: result.supplier,
            supplier_details: result.address || '',
            address: result.address || '',
            date: result.date,

            inv_no: result.inv_no,
            inv_date: result.inv_date || '',
            godown_id: result.godown,
            pay_type: result.pay_type,
            tax_type: result.tax_type || 'Exclusive',
            tax_rate: result.tax_percent || 5,
            gst_no: result.gst_no || '',
            email: result.email || '',
            type: result.type || 'Urad',
            remarks: result.remarks || '',
            source_order_no: result.source_order_no || '',
            source_order_id: result.source_order_id || ''
          });
          setTableData((result.items || []).map(it => {
            const qty = Number(it.qty || 0);
            const rate = Number(it.rate || 0);
            const disc_percent = Number(it.disc_percent ?? 0);
            const tax_percent = Number(it.tax_percent ?? 5);

            const per_unit_wt = Number(it.per_unit_weight ?? it.weight ?? 0);
            const total_weight = Number(it.total_weight ?? it.total_wt ?? (qty * per_unit_wt));

            const base_amount = qty * rate;
            const disc_amount = base_amount * (disc_percent / 100);
            const taxable_amount = base_amount - disc_amount;
            const tax_amount = (taxable_amount * tax_percent) / 100;
            const amount = base_amount + tax_amount;

            // Find matching weight_id from weights list
            const matchedWeight = weightsList.find(w => Number(w.weight) === per_unit_wt);
            const weight_id = matchedWeight ? matchedWeight.id : '';

            return {
              ...it,
              item_id: it.item_id || it.item_name,
              qty,
              weight: per_unit_wt,
              weight_id: weight_id,
              per_unit_wt,
              total_wt: total_weight,
              total_weight,
              rate,
              disc: disc_percent,
              disc_percent,
              tax_rate: tax_percent,
              tax_percent,
              base_amount,
              disc_amount,
              tax_amount,
              amount,
              lot_status: 'reserved'
            };
          }));
          setSelectedDeductions((result.deductions || []).map(d => ({
            id: d.deduction_id || d.deduction_purchase_id,
            name: d.deduction_name,
            amount: d.amount,
            type: d.type || 'LESS',
            calculation_type: d.calculation_type || d.calc_type,
            percentage: d.percentage || d.value || 0,
            remarks: d.remarks || ''
          })));
        }
      } catch (err) { console.error('Fetch error:', err); }
      finally { setLoading(false); }
    };

    const preloadFromPurchaseOrder = () => {
      const params = new URLSearchParams(location.search);
      const sourceOrderId = params.get('sourcePurchaseOrderId');
      if (!sourceOrderId || id) {
        return;
      }

      const order = purchaseOrderService.get(sourceOrderId);
      if (!order) {
        return;
      }

      const draft = buildReceiptDraftFromPurchaseOrder(order);

      setFormData((prev) => ({
        ...prev,
        ...draft.formData,
        supplier_id: draft.formData.supplier_id || prev.supplier_id,
        supplier_details: draft.formData.supplier_details || prev.supplier_details,
        remarks: draft.formData.remarks || prev.remarks,
        source_order_no: draft.formData.source_order_no || prev.source_order_no,
        source_order_id: draft.formData.source_order_id || prev.source_order_id,
      }));

      setTableData(draft.tableData);
      setSelectedDeductions([]);
    };

    loadDeductions();
    fetchPurchase();
    preloadFromPurchaseOrder();
  }, [id, location.search]);

  const handleTopFrameChange = useCallback((e) => {
    const { name, value } = e.target

    if (name === 'supplier_id') {
      setFormData((prev) => ({ ...prev, supplier_id: value }))
      return
    }

    setFormData((prev) => ({ ...prev, [name]: value }))
  }, [])

  const handleRowChange = useCallback((index, key, value) => {
    setTableData((prevRows) => {
      const newRows = [...prevRows]
      if (key === '__batch__' && typeof value === 'object') {
        newRows[index] = { ...newRows[index], ...value }
      } else {
        newRows[index] = { ...newRows[index], [key]: value }
      }
      return newRows;
    });
  }, []);

  const addRow = useCallback((newRow = {}) => {
    setTableData((prev) => [...prev, newRow]);
  }, []);

  const deleteRow = useCallback((index) => {
    setTableData((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const deleteDeduction = useCallback((index) => {
    setSelectedDeductions(prev => prev.filter((_, i) => i !== index));
  }, []);

  const validItems = useMemo(() => { // Use tableData here
    // For Qty/Weight totals we should not require Rate.
    // Rate is optional in the UI flow (can be filled later), but Qty and Per Unit Wt/Total Wt must still contribute.
    return (tableData || []).filter((r) => {
      return (
        r?.item_name &&
        Number(r?.qty) > 0
      );
    });
  }, [tableData]);


  // ERP Calculation Logic (FINAL canonical flow)
  // Base Amount = Qty × Rate
  // Discount     = Base × Disc%
  // Taxable      = Base − Discount
  // Tax          = Taxable × GST%
  // Net Total    = Taxable + Tax
  // Grand Total  = Net Total + ADD deductions − LESS deductions
  const erpTotals = useMemo(() => {
    const rows = validItems || [];
    console.log('ROWS FOR TOTALS', rows);
    console.log('ROWS FOR TOTALS (weight fields)', (rows || []).map(r => ({
      item_name: r.item_name,
      qty: r.qty,
      weight: r.weight,
      per_unit_wt: r.per_unit_wt,

      total_wt: r.total_wt,
      total_weight: r.total_weight,
      totalWt: r.totalWt,
      totalWeight: r.totalWeight,

      base_amount: r.base_amount,
      rate: r.rate,
      total: r.total,
    })));

    // Determine which field actually contains the computed KG total in tableData
    // so UI totals can read the same key.
    const dbgWeightKeys = (rows || []).map(r => ({
      qty: r.qty,
      weight: r.weight,
      per_unit_wt: r.per_unit_wt,
      total_wt: r.total_wt,
      total_weight: r.total_weight,
      totalWt: r.totalWt,
      totalWeight: r.totalWeight,
    }));
    console.log('ROWS FOR TOTALS DBG WEIGHT KEYS', dbgWeightKeys);


    // Totals from canonical item fields already calculated in EntryItemsTable
    const totalQty = rows.reduce((s, r) => s + Number(r.qty || 0), 0);
    const totalWeight = rows.reduce(
      (s, r) => s + Number(r.total_wt || r.total_weight || 0),
      0
    );



    const baseAmount = rows.reduce((s, r) => s + Number(r.base_amount || 0), 0);
    const discountAmount = rows.reduce((s, r) => s + Number(r.disc_amount || 0), 0);

    const taxableAmount = Number((baseAmount - discountAmount).toFixed(2));

    const taxAmount = Number(rows.reduce((s, r) => s + Number(r.tax_amount || 0), 0).toFixed(2));
    const netAmount = Number((taxableAmount + taxAmount).toFixed(2)); // Apply rounding

    const addDeductions = selectedDeductions
      .filter(d => String(d.type || '').toUpperCase() === 'ADD')
      .reduce((s, d) => s + (Number(d.amount || 0) || 0), 0);

    const lessDeductions = selectedDeductions
      .filter(d => String(d.type || '').toUpperCase() === 'LESS')
      .reduce((s, d) => s + (Number(d.amount || 0) || 0), 0);

    const totalDeductions = addDeductions - lessDeductions;
    const grandTotal = Number((netAmount + totalDeductions).toFixed(2));

    return {
      totalQty,
      totalWeight,
      baseAmount,
      discountAmount,
      taxable: taxableAmount,
      taxAmount,
      netAmount,
      totalDeductions,
      grandTotal
    };
  }, [validItems, formData.tax_rate, selectedDeductions]);


  const totals = useMemo(() => {
    return erpTotals; // Use the comprehensive erpTotals
  }, [erpTotals]);

  const payload = useMemo(() => ({
    date: formData.date,
    supplier_id: Number(formData.supplier_id) || 0,
    godown_id: Number(formData.godown_id) || 0,
    inv_no: String(formData.inv_no || ''),
    inv_date: formData.inv_date,
    pay_type: formData.pay_type,

    items: validItems.map((row) => ({
      item_id: Number(row.item_id || row.item_name || 0) || 0,
      item_name:
        row.item_label ||
        row.item_text ||
        row.item_display ||
        row.item_master_name ||
        row.item_name_text ||
        row.item?.name ||
        row.item_name ||
        '',

      lot_no: row.lot_no || '',
      lot_status: row.lot_status || '',

      qty: Number(row.qty || 0),
      per_unit_weight: Number(row.per_unit_weight || row.weight || 0),
      total_weight: Number(row.total_weight || row.total_wt || 0),

      rate: Number(row.rate || 0),
      disc_percent: Number(row.disc_percent || row.disc || 0),
      disc_amount: Number(row.disc_amount || 0),

      tax_percent: Number(row.tax_percent || row.tax_rate || 0),
      tax_amount: Number(row.tax_amount || 0),

      amount: Number(row.amount || 0)
    })),

    totals: {
      totalQty: Number(erpTotals.totalQty || 0),
      totalWeight: Number(erpTotals.totalWeight || 0),
      totalAmount: Number(erpTotals.baseAmount || 0),
      taxAmount: Number(erpTotals.taxAmount || 0),
      netAmount: Number(erpTotals.netAmount || 0),
      deductionAmount: Number(erpTotals.totalDeductions || 0),
      grandTotal: Number(erpTotals.grandTotal || 0)
    }
  }), [formData, validItems, erpTotals]);

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      // VALIDATION (client-side, must prevent backend 400/500)
      if (!formData?.date || !formData?.supplier_id || validItems.length === 0) {
        setError('Date, Supplier, and at least one item required')
        return
      }

      // Ensure inv_date exists (backend may require it depending on schema)
      // If user leaves it blank, keep as empty string.

      console.log('🚀 PURCHASE SAVE PAYLOAD:', JSON.stringify(payload, null, 2))
      setLoading(true)

      const method = id ? 'PUT' : 'POST';
      const url = id ? `/purchases/${id}` : '/purchases';

      // backend/routes/purchases.js expects legacy keys inside totals:
      // totals.baseAmount, totals.discAmount, totals.grandTotal
      // It also expects item keys: itemName, lotNo, qty, weight, rate, disc, tax, amount

      // Option B2: preview lot numbers during selection (non-consuming).
      // On SAVE, commit ONLY rows that are not already reserved.
      const itemsWithLots = await (async () => {
        const out = [];
        for (const row of payload.items) {
          const lot_status = row.lot_status;

          // If status is already reserved/committed, keep it as-is.
          let lot_no = row.lot_no;
          if (!lot_no) {
            const lotRes = await api('/lots/reserve', { method: 'POST' });
            lot_no = lotRes?.lot_no || lotRes?.data?.lot_no || '';
          }

          out.push({
            ...row,
            lot_no,
            lot_status: 'reserved',
          });
        }
        return out;
      })();

      const result = await api(url, {
        method: method,
        body: {
          formData: {
            ...backendFormData,
            // S.No must be consumed ONLY on SAVE (new purchase)
            ...(id ? {} : await (async () => {
              const snoRes = await api('/purchases/next-sno');
              return {
                sno: snoRes?.next_sno ?? snoRes?.data?.s_no,
              };
            })()),
          },
          items: itemsWithLots.map((it) => ({ // Map to backend expected item keys
            item_id: Number(it.item_id ?? it.item_name ?? 0) || 0,
            item_name: String(it.item_name ?? it.item_id ?? ''),
            lotNo: it.lot_no,
            qty: it.qty,
            per_unit_weight: it.per_unit_weight,
            total_weight: it.total_weight,
            rate: it.rate,
            disc_percent: it.disc_percent,
            disc_amount: it.disc_amount,
            tax_percent: it.tax_percent,
            tax_amount: it.tax_amount,
            amount: it.amount,
          })),
          totals: {
            totalQty: totals.totalQty,
            totalWeight: totals.totalWeight,
            totalAmount: totals.taxable, // This is the taxable amount
            baseAmount: totals.baseAmount,
            discAmount: totals.discountAmount,
            taxAmount: totals.taxAmount,
            netAmount: totals.netAmount,
            deductionAmount: totals.totalDeductions, // backend expects deductionAmount
            grandTotal: totals.grandTotal,
            // keep backend-expected container
            deductions: { autoWages: 0, vatPercent: 0, vat: 0 },
          },
          deductions: selectedDeductions.map(d => ({ // Pass full deduction details
            deduction_id: d.id,
            deduction_name: d.name,
            type: d.type,
            calculation_type: d.calculation_type,
            percentage: d.percentage,
            affect_gst: d.affect_gst,
            amount: d.amount,
          }))
        }
      })

      if (!result) {
        setError('API failed (null response)')
        return
      }

      if (result.success) {
        alert(`Purchase ${id ? 'updated' : 'saved'} successfully!`);
        navigate('/entry/purchase-display');
      } else {
        setError(result.message || 'Error creating purchase')
      }
    } catch (err) {
      setError(err?.message || 'Error creating purchase')
    } finally {
      setLoading(false)
    }
  }

  const handleDeductionAdd = (dedId) => {
    const master = deductions.find(d => String(d.id) === String(dedId));
    if (!master) return;

    // Check if deduction already added
    if (selectedDeductions.some(d => String(d.id) === String(dedId))) {
      alert('This deduction has already been added.');
      return;
    }

    const calcType = master.calculation_type || master.calc_type || 'Percentage';
    const dedValue = parseFloat(master.deduction_value || master.deduction_value || master.ded_value || 0) || 0;

    // Required: deduction amount based on ERP taxable base (we keep it simple: Percentage of erpTotals taxable base)
    let amt = 0;
    if (String(calcType).toLowerCase().includes('percent')) {
      amt = Number(erpTotals.taxable || 0) * (dedValue / 100);
    } else {
      amt = dedValue;
    }

    setSelectedDeductions(prev => [...prev, {
      id: master.id,
      name: master.ded_name || master.name || master.deduction_name || 'Unnamed',
      amount: amt,
      type: String(master.type || master.deduction_type || 'LESS').toUpperCase(),
      calculation_type: calcType,
      percentage: calcType === 'Percentage' ? dedValue : 0,
      affect_gst: String(master.affect_gst || master.affect_cost_of_goods || 'NO').toUpperCase(),
      remarks: ''
    }]);
  };

  const formatNumber = (num) => Number(num || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3
  });

  // Define fields for EntryTopFrame - organized by columns (matches SalesCreate)
  // ✅ FIXED Purchase fields - NO 'value', supplier autofill
  const topFrameFields = [
    // Column 1
    { name: 's_no', label: 'S.No', readOnly: true, col: 1 },
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
    { name: 'inv_no', label: 'Invoice No', type: 'text', col: 2 },
    { name: 'inv_date', label: 'Invoice Date', type: 'date', col: 2 },
    { name: 'godown_id', label: 'Godown', type: 'masterSelect', masterType: 'godowns', col: 2 },
    { name: 'type', label: 'Type', type: 'select', options: [
      {value: 'Urad', label: 'Urad'}, {value: 'Rice', label: 'Rice'}, {value: 'Flour', label: 'Flour'}, {value: 'Other', label: 'Other'}
    ], col: 2 },
    { name: 'remarks', label: 'Remarks', type: 'textarea', col: 2 },

    // Column 3
    { name: 'supplier_id', label: 'Supplier', type: 'masterSelect', masterType: 'suppliers', col: 3 },
    { name: 'address', label: 'Address', type: 'textarea', readOnly: true, col: 3 },
  ];

  // ✅ FIXED Purchase columns + autoLotMode=true (creation)
const columns = [
    { key: 'sno', title: 'S.No', readOnly: true },
    { key: 'item_name', title: 'Item', type: 'masterSelect', masterType: 'items' },
    { key: 'lot_no', title: 'Lot No' },
    { key: 'qty', title: 'Qty', type: 'number' },
    { key: 'weight', title: 'Per Unit Wt', type: 'masterSelect', masterType: 'weights' }, // Changed to masterSelect
    { key: 'total_wt', title: 'Total Wt', readOnly: true },
    { key: 'rate', title: 'Rate', type: 'number' },
    { key: 'disc', title: 'Disc%', type: 'number' },
    { key: 'tax_rate', title: 'Tax%', type: 'number' },
    { key: 'amount', title: 'Amount', readOnly: true } // This is taxable amount
  ];

  // Define totals for EntryTotalsRow - matches SalesCreate
  // This is now handled by EntryBottomSummary

  // Bottom summary fields - matches SalesCreate
  const summaryFields = [
    { name: 'baseAmount', label: 'Base Amount', value: erpTotals.baseAmount, readOnly: true },
    { name: 'discAmount', label: 'Discount', value: erpTotals.discountAmount, readOnly: true },
    { name: 'taxable', label: 'Taxable', value: erpTotals.taxable, readOnly: true },
    { name: 'taxAmount', label: 'Tax', value: erpTotals.taxAmount, readOnly: true },
    { name: 'netAmount', label: 'Net', value: erpTotals.netAmount, readOnly: true },
    { name: 'totalDeductions', label: 'Deduction', value: erpTotals.totalDeductions, readOnly: true },
    { name: 'grandTotal', label: 'Grand Total', value: erpTotals.grandTotal, readOnly: true },
  ];

  const deductionFields = [
    // This will be handled by the dedicated deductions section
  ];

  return (
    <div className="window">
      <div className="screen-title">Purchase Creation</div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <form onSubmit={handleSubmit}>

        {/* Local CSS for ERP layout (ensures LEFT/RIGHT) */}
        <style>{`
          .erp-bottom-layout{display:flex;gap:20px;align-items:flex-start;margin-top:20px;}
          .deduction-panel{flex:1;background:#fff;border:1px solid #dcdcdc;padding:15px;}
          .erp-summary-panel{width:350px;background:#fff;border:1px solid #dcdcdc;padding:15px;}
          .grand-total{margin-top:15px;padding:15px 20px;background:#1e4db7;color:#ffffff !important;font-size:22px;font-weight:bold;border-radius:4px;display:block;}
          .deduction-table{width:100%;border-collapse:collapse;}
          .deduction-table th,.deduction-table td{border-bottom:1px solid #e5e5e5;padding:8px;}
          .deduction-table th{background:#f6f8ff;text-align:left;}
        `}</style>
        <EntryTopFrame
          fields={topFrameFields}
          data={formData}
          onChange={handleTopFrameChange}
          columns={3}
        />

        <EntryItemsTable
          columns={columns}
          data={tableData} // Use tableData here
          onRowChange={handleRowChange}
          onAddRow={addRow}
          onDeleteRow={deleteRow}
          showActions={true}
          lotMode="auto"
          taxType={formData.tax_type}
          taxRate={formData.tax_rate}
        />

        {/* Table Footer for Qty and Weight */}
        <div className="table-footer">
          <div className="footer-line"></div>
          <div className="footer-totals">
            Total Qty: <span>{formatNumber(erpTotals.totalQty)}</span> |
            Total Weight: <span>{formatNumber(erpTotals.totalWeight)} KG</span>
          </div>
          <div className="footer-line"></div>
        </div>

        <div className="erp-bottom-layout">

          {/* (ERP layout) LEFT -> Deduction Table | RIGHT -> ERP Totals */}

          {/* LEFT SIDE */}
          <div className="deduction-panel">

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0 }}>Deductions</h3>
              <select 
                onChange={(e) => handleDeductionAdd(e.target.value)} 
                className="table-input" 
                style={{ width: '200px', height: '30px' }}
              >
                <option value="">+ Add Deduction</option>
                {deductions.map((d, idx) => (
                  <option key={`${d.id || 'ded'}-${idx}`} value={d.id}>{d.ded_name || d.name || d.deduction_name}</option>
                ))}
              </select>
            </div>

            <table className="deduction-table">
              <thead>
                <tr>
                  <th>Deduction</th>
                  <th>%</th>
                  <th>Amt</th>
                  <th>Calculation</th>
                </tr>
              </thead>

              <tbody>
                {selectedDeductions.map((row, index) => (
                  <tr key={index}>

                    <td>
                      <select
                        value={row.deduction_id || row.id || ''}
                        onChange={(e) => {
                          const updated = [...selectedDeductions];
                          const nextId = e.target.value;
                          const master = deductions.find(d => String(d.id) === String(nextId));
                          if (!master) return;
                          updated[index] = {
                            ...updated[index],
                            deduction_id: master.id,
                            id: master.id,
                            name: master.ded_name || master.name || master.deduction_name,
                            calculation_type: master.calculation_type || master.calc_type,
                            percentage: Number(master.deduction_value || master.ded_value || 0) || 0,
                            type: String(master.type || master.deduction_type || updated[index].type || 'LESS').toUpperCase(),
                          };
                          setSelectedDeductions(updated);
                        }}
                      >
                        <option value="">Select</option>
                        {(deductions || []).map((d, idx) => (
                          <option key={`${d.id || 'ded'}-${idx}`} value={d.id}>
                            {d.ded_name || d.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td>
                      <input
                        type="number"
                        value={Number(row.percent ?? row.percentage ?? 0)}
                        onChange={(e) => {
                          const updated = [...selectedDeductions];
                          const pct = parseFloat(e.target.value) || 0;
                          updated[index].percent = pct;
                          updated[index].percentage = pct;
                          const base = Number(erpTotals.taxable || 0);
                          updated[index].amount = base * (pct / 100);
                          setSelectedDeductions(updated);
                        }}
                      />
                    </td>

                    <td>
                      <input
                        type="number"
                        value={Number(row.amount || 0)}
                        onChange={(e) => {
                          const updated = [...selectedDeductions];
                          updated[index].amount = parseFloat(e.target.value) || 0;
                          setSelectedDeductions(updated);
                        }}
                      />
                    </td>

                    <td>
                      <select
                        value={row.calculation || row.type || 'LESS'}
                        onChange={(e) => {
                          const updated = [...selectedDeductions];
                          updated[index].calculation = e.target.value;
                          updated[index].type = e.target.value;
                          setSelectedDeductions(updated);
                        }}
                      >
                        <option value="ADD">ADD</option>
                        <option value="LESS">LESS</option>
                      </select>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>

          </div>

          {/* RIGHT : ERP TOTALS */}
          <div className="erp-summary-panel">

            <div>Total Qty : {formatNumber(erpTotals.totalQty)}</div>

            <div>
              Total Weight : {formatNumber(erpTotals.totalWeight)} KG
            </div>

            <hr />

            <div>
              Base Amount : ₹{formatNumber(erpTotals.baseAmount)}
            </div>

            <div>
              Discount : ₹{formatNumber(erpTotals.discountAmount)}
            </div>

            <div>
              Taxable : ₹{formatNumber(erpTotals.taxable)}
            </div>

            <div>
              Tax : ₹{formatNumber(erpTotals.taxAmount)}
            </div>

            <div>
              Net Total : ₹{formatNumber(erpTotals.netAmount)}
            </div>

            <div>
              Deductions : ₹{formatNumber(erpTotals.totalDeductions)}
            </div>

            <div className="grand-total">
              Grand Total : ₹{formatNumber(erpTotals.grandTotal)}
            </div>

          </div>

        </div>

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

export default PurchaseCreation
