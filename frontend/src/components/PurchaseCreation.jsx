import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { api, getMasters } from '../utils/api';
import purchaseOrderService from '../modules/purchaseOrder/services/purchaseOrderService';
import { buildReceiptDraftFromPurchaseOrder } from '../modules/purchaseOrder/utils/poToReceipt.mjs';
import { saveModuleDraft, loadModuleDraft, clearModuleDraft } from '../utils/draftHelper';

import EntryTopFrame from './entry/EntryTopFrame';
import EntryItemsTable from './entry/EntryItemsTable';
import EntryBottomSummary from './entry/EntryBottomSummary';
import EntryActions from './entry/EntryActions';
import './SalesCreate.css';

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
    source_order_id: '',
    purchase_order_id: '',
    po_no: ''
  })

  const [poPickerOpen, setPoPickerOpen] = useState(false);
  const [poList, setPoList] = useState([]);
  const [loadingPoList, setLoadingPoList] = useState(false);

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
      source_order_no: formData.source_order_no || formData.po_no,
      source_order_id: formData.source_order_id || formData.purchase_order_id,
      purchase_order_id: formData.purchase_order_id || formData.source_order_id,
      po_no: formData.po_no || formData.source_order_no,
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

    const applyPurchaseOrder = async (order) => {
      if (!order) return;
      const draft = buildReceiptDraftFromPurchaseOrder(order);

      // Fetch fresh next S.No
      let nextSNo = formData.s_no;
      try {
        const snoRes = await api('/purchases/next-sno');
        if (snoRes?.next_sno || snoRes?.data?.s_no) {
          nextSNo = String(snoRes.next_sno || snoRes.data.s_no);
        }
      } catch (e) {}

      setFormData((prev) => ({
        ...prev,
        ...draft.formData,
        s_no: nextSNo || prev.s_no,
        supplier_id: draft.formData.supplier_id || order.supplier_id || order.supplierId || prev.supplier_id,
        supplier_details: draft.formData.supplier_details || order.address || prev.supplier_details,
        remarks: draft.formData.remarks || (order.remarks ? `PO: ${order.inv_no || order.invNo} - ${order.remarks}` : `Inwarded from PO #${order.inv_no || order.invNo}`),
        source_order_no: draft.formData.source_order_no || order.inv_no || order.invNo || '',
        source_order_id: draft.formData.source_order_id || order.id || '',
        purchase_order_id: order.id || '',
        po_no: order.inv_no || order.invNo || ''
      }));

      // Get next lot number preview
      let startLotNum = 1;
      try {
        const lotPrev = await api('/lots/preview', { method: 'GET' });
        const match = String(lotPrev?.lot_no || lotPrev?.data?.lot_no || 'LOT0001').match(/LOT(\d+)/i);
        if (match) startLotNum = parseInt(match[1], 10);
      } catch (e) {}

      const baseItems = (draft.tableData && draft.tableData.length > 0) ? draft.tableData : (order.items || []);
      const mappedItems = baseItems.map((it, idx) => {
        const qty = Number(it.qty || 0);
        const rate = Number(it.rate || it.purc_rate || 0);
        const weight = Number(it.weight || it.per_unit_weight || it.perUnitWeight || 0);
        const totWt = Number(it.tot_wt || it.total_weight || (qty * (weight || 1)));
        const disc = Number(it.discount_percent || it.disc_percent || 0);
        const tax = Number(it.tax_percent ?? order.tax_percent ?? order.tax_rate ?? 5);
        const baseAmt = qty * rate;
        const discAmt = baseAmt * (disc / 100);
        const taxAmt = ((baseAmt - discAmt) * tax) / 100;
        const finalAmt = Number(it.amount) || (baseAmt + taxAmt);
        const autoLot = it.lot_no || `LOT${String(startLotNum + idx).padStart(4, '0')}`;

        return {
          item_id: it.item_id || it.itemId || it.item_name || it.itemName || '',
          item_name: it.item_name || it.itemName || '',
          item_label: it.item_name || it.itemName || '',
          qty,
          weight,
          weight_id: it.weight_id || '',
          per_unit_wt: weight,
          per_unit_weight: weight,
          total_wt: totWt,
          total_weight: totWt,
          rate,
          purc_rate: rate,
          disc,
          disc_percent: disc,
          tax_rate: tax,
          tax_percent: tax,
          amount: finalAmt,
          lot_no: autoLot,
          lot_status: 'reserved'
        };
      });

      setTableData(mappedItems);

      if (order.deductions && order.deductions.length > 0) {
        setSelectedDeductions(order.deductions.map(d => ({
          id: d.id,
          name: d.deduction || d.deduction_name || d.name,
          amount: parseFloat(d.amount) || 0,
          type: (d.type || 'less').toUpperCase(),
          calculation_type: 'Percentage',
          percentage: parseFloat(d.percent || d.value) || 0,
          remarks: d.remarks || ''
        })));
      }
    };

    const preloadFromPurchaseOrder = async () => {
      const params = new URLSearchParams(location.search);
      const sourceOrderId = params.get('sourcePurchaseOrderId') || params.get('po_id') || params.get('purchase_order_id') || params.get('po');
      if (!sourceOrderId || id) {
        // Check for saved draft if not loading from PO and not editing existing ID
        if (!id) {
          const draft = loadModuleDraft('purchase_create');
          if (draft && draft.data) {
            if (draft.data.formData) setFormData(prev => ({ ...prev, ...draft.data.formData }));
            if (Array.isArray(draft.data.tableData) && draft.data.tableData.length > 0) setTableData(draft.data.tableData);
            if (Array.isArray(draft.data.selectedDeductions)) setSelectedDeductions(draft.data.selectedDeductions);
          }
        }
        return;
      }

      try {
        let order = null;
        try {
          order = await purchaseOrderService.get(sourceOrderId);
        } catch (e) {
          console.log('purchaseOrderService get fallback');
        }
        if (!order) {
          const res = await api(`/purchase-orders/${sourceOrderId}`).catch(() => null);
          order = res?.data || res;
        }

        if (order) {
          await applyPurchaseOrder(order);
        }
      } catch (err) {
        console.error('Error preloading PO:', err);
      }
    };

    loadDeductions();
    fetchPurchase();
    preloadFromPurchaseOrder();
  }, [id, location.search]);

  // Auto-save draft when form changes (for new entries only)
  useEffect(() => {
    if (!id && (formData.supplier_id || (tableData && tableData.some(r => r.item_name || r.qty)))) {
      saveModuleDraft('purchase_create', { formData, tableData, selectedDeductions });
    }
  }, [id, formData, tableData, selectedDeductions]);

  const handleOpenPoPicker = async () => {
    setPoPickerOpen(true);
    setLoadingPoList(true);
    try {
      const res = await api('/purchase-orders').catch(() => null) || await fetch('/api/purchase-orders').then(r => r.json()).catch(() => []);
      const list = Array.isArray(res) ? res : (res?.rows || res?.data || []);
      setPoList(list);
    } catch (e) {
      console.error('Error fetching PO list:', e);
    } finally {
      setLoadingPoList(false);
    }
  };

  const handleSelectPo = async (po) => {
    try {
      let fullPo = null;
      try {
        fullPo = await purchaseOrderService.get(po.id);
      } catch (e) {}
      if (!fullPo) {
        const res = await api(`/purchase-orders/${po.id}`).catch(() => null);
        fullPo = res?.data || res || po;
      }
      
      const draft = buildReceiptDraftFromPurchaseOrder(fullPo);
      setFormData((prev) => ({
        ...prev,
        ...draft.formData,
        supplier_id: draft.formData.supplier_id || fullPo.supplier_id || fullPo.supplierId || prev.supplier_id,
        supplier_details: draft.formData.supplier_details || fullPo.address || prev.supplier_details,
        remarks: draft.formData.remarks || `Inwarded from PO #${fullPo.inv_no || fullPo.invNo || fullPo.orderNo}`,
        source_order_no: draft.formData.source_order_no || fullPo.inv_no || fullPo.invNo || fullPo.orderNo || '',
        source_order_id: String(fullPo.id || ''),
        purchase_order_id: String(fullPo.id || ''),
        po_no: fullPo.inv_no || fullPo.invNo || fullPo.orderNo || ''
      }));

      if (draft.tableData && draft.tableData.length > 0) {
        setTableData(draft.tableData);
      } else if (fullPo.items && fullPo.items.length > 0) {
        setTableData(fullPo.items.map((it) => ({
          item_id: it.item_id || it.itemId || it.item_name || it.itemName,
          item_name: it.item_name || it.itemName,
          qty: Number(it.qty || 0),
          weight: Number(it.weight || 0),
          weight_id: it.weight_id || '',
          per_unit_wt: Number(it.weight || 0),
          total_wt: Number(it.tot_wt || it.totWt || (Number(it.qty || 0) * Number(it.weight || 0))),
          total_weight: Number(it.tot_wt || it.totWt || (Number(it.qty || 0) * Number(it.weight || 0))),
          rate: Number(it.rate || it.purc_rate || 0),
          disc: Number(it.discount_percent || it.disc_percent || 0),
          disc_percent: Number(it.discount_percent || it.disc_percent || 0),
          tax_rate: Number(it.tax_percent || 5),
          tax_percent: Number(it.tax_percent || 5),
          amount: Number(it.amount || 0)
        })));
      }

      setPoPickerOpen(false);
    } catch (err) {
      console.error('Error importing PO:', err);
    }
  };

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
        clearModuleDraft('purchase_create');
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div className="screen-title" style={{ margin: 0 }}>Purchase Creation</div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={handleOpenPoPicker}
            style={{
              padding: '6px 14px',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
            }}
          >
            🔗 Link Purchase Order
          </button>
        </div>
      </div>

      {(formData.po_no || formData.source_order_no) && (
        <div
          style={{
            marginBottom: '15px',
            padding: '10px 16px',
            backgroundColor: '#f0fdf4',
            border: '1px solid #86efac',
            borderRadius: '6px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: '#166534',
            fontSize: '13px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>📦</span>
            <span>
              <strong>Linked with Purchase Order:</strong> {formData.po_no || formData.source_order_no}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                setFormData(prev => ({ ...prev, purchase_order_id: '', po_no: '', source_order_id: '', source_order_no: '' }));
              }}
              style={{
                padding: '3px 8px',
                backgroundColor: '#fee2e2',
                color: '#991b1b',
                border: '1px solid #fca5a5',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 'bold'
              }}
            >
              Unlink PO
            </button>
          </div>
        </div>
      )}

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

      {/* PO Picker Modal Dialog */}
      {poPickerOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '8px',
              width: '100%',
              maxWidth: '850px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
            }}
          >
            <div
              style={{
                padding: '14px 20px',
                backgroundColor: '#1f4fb2',
                color: '#fff',
                borderTopLeftRadius: '8px',
                borderTopRightRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
                Select Purchase Order to Inward / Convert
              </h3>
              <button
                onClick={() => setPoPickerOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  fontSize: '20px',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
              {loadingPoList ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  Loading Purchase Orders...
                </div>
              ) : poList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  No purchase orders found.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                      <th style={{ padding: '8px', textAlign: 'left' }}>PO No</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Supplier</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Item / Details</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Total (₹)</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Status</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poList.map((po) => (
                      <tr key={po.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px', fontWeight: 'bold', color: '#1f4fb2' }}>
                          {po.inv_no || po.invNo || po.orderNo || `PO-${po.s_no}`}
                        </td>
                        <td style={{ padding: '8px' }}>{po.date}</td>
                        <td style={{ padding: '8px', fontWeight: '500' }}>{po.supplier_name || po.supplierName || '—'}</td>
                        <td style={{ padding: '8px' }}>
                          {po.item_name || (po.items && po.items.map(i => i.item_name || i.itemName).join(', ')) || po.type || '—'}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>
                          ₹{parseFloat(po.total_amt || po.totAmt || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            backgroundColor: (po.inward_purchase_id || po.status === 'Received') ? '#dcfce7' : '#fef9c3',
                            color: (po.inward_purchase_id || po.status === 'Received') ? '#15803d' : '#854d0e'
                          }}>
                            {po.inward_purchase_id || po.status === 'Received' ? 'Received' : 'Ordered'}
                          </span>
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleSelectPo(po)}
                            style={{
                              padding: '5px 12px',
                              backgroundColor: '#16a34a',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              fontWeight: 'bold',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            Inward ➔
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div
              style={{
                padding: '12px 20px',
                backgroundColor: '#f8fafc',
                borderBottomLeftRadius: '8px',
                borderBottomRightRadius: '8px',
                display: 'flex',
                justifyContent: 'flex-end'
              }}
            >
              <button
                type="button"
                onClick={() => setPoPickerOpen(false)}
                style={{
                  padding: '6px 14px',
                  backgroundColor: '#e2e8f0',
                  color: '#334155',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PurchaseCreation
