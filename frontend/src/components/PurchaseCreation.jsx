import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api, getMasters } from '../utils/api';
import purchaseOrderService from '../modules/purchaseOrder/services/purchaseOrderService';
import {
  buildReceiptDraftFromPurchaseOrder,
  getPurchaseOrderItemsForInward
} from '../modules/purchaseOrder/utils/poToReceipt.mjs';
import { saveModuleDraft, loadModuleDraft, clearModuleDraft } from '../utils/draftHelper';

import EntryTopFrame from './entry/EntryTopFrame';
import GodownStockPopover from './entry/GodownStockPopover';
import EntryItemsTable from './entry/EntryItemsTable';
import EntryBottomSummary from './entry/EntryBottomSummary';
import EntryActions from './entry/EntryActions';
import EntryTaxBillDetails from './entry/EntryTaxBillDetails';
import { calculateInvoiceTax, calculateLineTax } from '../services/taxService';
import { InlineMasterModal, getCreateLabel } from './common/InlineMasterModal.jsx';
import PurchaseLedgerDetailsModal from './purchase/PurchaseLedgerDetailsModal';
import TransportFreightDetailsModal from './purchase/TransportFreightDetailsModal';
import WeightEntryModal from './purchase/WeightEntryModal';
import './SalesCreate.css';

/**
 * PurchaseCreation
 * Single-file implementation:
 * - EntryItemsTable calculates row values (amount, tax_amount, weight)
 * - This page ONLY aggregates totals and builds backend payload
 */
const PurchaseCreation = () => {
  const skipLoadmanChargeSync = useRef(false);
  const isEditPurchaseLoaded = useRef(false);
  const { id: paramId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const id = paramId || searchParams.get('id') || location.state?.editId || location.state?.id;
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
    address: '',
    supplier_state: 'Tamil Nadu',
    supplier_state_code: '33',

    // Transport & Vehicle fields
    transporter: '',
    transport: '',
    transport_charges: 0,
    freight_amount: 0,
    advance_amount: 0,
    mamool_amount: 0,
    weight_cash: 0,
    other_additional_charges: 0,
    other_deductions: 0,
    net_transport_amount: 0,
    transport_payable_type: 'SEPARATE',
    vehicle_no: '',
    lorry_no: '',
    driver_name: '',
    driver: '',
    driver_mobile: '',
    transport_date: '',
    gross_weight: '',
    tare_weight: '',
    net_weight: '',
    weighbridge_location: 'Main Factory',
    unloading_date: '',
    unloading_time: '',
    weighment_ref_no: '',
    operator_name: '',
    weight_status: 'TARE_PENDING',

    tax_type: 'Exclusive',
    tax_rate: 5,

    type: 'Urad',
    remarks: '',
    source_order_no: '',
    source_order_id: '',
    purchase_order_id: '',
    po_no: '',

    // Cold Storage Inward & Loadman Unloading Details
    chamber_no: 'Chamber 1',
    loadman_name: '',
    loadman_worker_id: '',
    loadman_qty_kg: '',
    loadman_rate_per_kg: '0.50',
    loadman_payable_type: 'SEPARATE',
    additional_charges: '0'
  })

  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);
  const [transportModalOpen, setTransportModalOpen] = useState(false);
  const [weightModalOpen, setWeightModalOpen] = useState(false);

  // Date-wise Loadman rate auto-calculation from Loadman master duration period
  useEffect(() => {
    if (!formData.loadman_name) return;
    const loadWorkerRate = async () => {
      try {
        const workersRes = await getMasters('workers');
        const list = Array.isArray(workersRes) ? workersRes : (workersRes?.data || []);
        const matched = list.find(w => 
          (w.name && w.name.trim().toLowerCase() === formData.loadman_name.trim().toLowerCase()) ||
          String(w.id) === String(formData.loadman_worker_id)
        );
        if (matched && matched.per_kg_amount !== undefined && matched.per_kg_amount !== null && Number(matched.per_kg_amount) > 0) {
          const transDate = formData.date ? new Date(formData.date) : new Date();
          let applies = true;
          if (matched.from_date || matched.effective_from) {
            const fDate = new Date(matched.from_date || matched.effective_from);
            if (transDate < fDate) applies = false;
          }
          if (matched.till_date || matched.effective_to) {
            const tDate = new Date(matched.till_date || matched.effective_to);
            if (transDate > tDate) applies = false;
          }
          if (applies) {
            setFormData(prev => ({
              ...prev,
              loadman_rate_per_kg: String(matched.per_kg_amount),
              loadman_worker_id: matched.id || prev.loadman_worker_id
            }));
          }
        }
      } catch (err) {
        console.warn('Notice loading worker rate:', err.message);
      }
    };
    loadWorkerRate();
  }, [formData.loadman_name, formData.date]);

  const [poPickerOpen, setPoPickerOpen] = useState(false);
  const [poList, setPoList] = useState([]);
  const [loadingPoList, setLoadingPoList] = useState(false);

  const [tableData, setTableData] = useState([{
    sno: 1,
    item_name: '',
    lot_no: '',
    qty: 0,
    weight: 0,
    total_wt: 0,
    rate: 0,
    disc: 0,
    tax_rate: 5,
    amount: 0,
    lot_status: 'available'
  }]);
  const [deductions, setDeductions] = useState([]);
  const [selectedDeductions, setSelectedDeductions] = useState([]);
  const [inlineDeductionOpen, setInlineDeductionOpen] = useState(false);
  const deductionsRef = React.useRef(deductions);
  deductionsRef.current = deductions;

  const validItems = useMemo(() => {
    return (tableData || []).filter((r) => {
      return (
        (r?.item_name || r?.item_id) &&
        Number(r?.qty) > 0
      );
    });
  }, [tableData]);

  // 1. Calculate Unloading / Loadman Charges from active items weight and rates
  const calculatedLoadmanCharges = useMemo(() => {
    const totalWt = validItems.reduce((acc, r) => acc + (parseFloat(r.total_wt || r.total_weight || (Number(r.qty || 0) * Number(r.weight || 50))) || 0), 0);
    const userQty = parseFloat(formData.loadman_qty_kg);
    const qty = (Number.isFinite(userQty) && userQty > 0) ? userQty : totalWt;
    const userRate = parseFloat(formData.loadman_rate_per_kg);
    const rate = (Number.isFinite(userRate) && userRate >= 0) ? userRate : 0.50;
    const add = parseFloat(formData.additional_charges || 0) || 0;
    return Number(((qty * rate) + add).toFixed(2));
  }, [formData.loadman_qty_kg, formData.loadman_rate_per_kg, formData.additional_charges, validItems]);

  // 2. ERP Calculation Logic (FINAL canonical flow)
  const erpTotals = useMemo(() => {
    const invoiceResult = calculateInvoiceTax({
      items: validItems,
      taxMode: formData.tax_type,
      defaultTaxType: 'Taxable',
      companyState: 'Tamil Nadu',
      partyState: formData.supplier_state || 'Tamil Nadu',
      partyStateCode: formData.supplier_state_code || undefined
    });

    const calculatedDeductions = selectedDeductions.map(d => {
      const percentage = Number(d.percentage ?? d.percent ?? 0) || 0;
      const calculationType = String(d.calculation_type || d.calc_type || '').toLowerCase();
      const isPercentage = calculationType.includes('percent') || percentage > 0;
      const amount = isPercentage && !d.manual_amount
        ? Number((invoiceResult.taxableAmount * percentage / 100).toFixed(2))
        : Number(d.amount || 0) || 0;
      return { ...d, amount };
    });

    const addDeductions = calculatedDeductions
      .filter(d => String(d.type || d.calculation || '').toUpperCase() === 'ADD')
      .reduce((s, d) => s + (Number(d.amount || 0) || 0), 0);

    const lessDeductions = calculatedDeductions
      .filter(d => String(d.type || d.calculation || '').toUpperCase() === 'LESS')
      .reduce((s, d) => s + (Number(d.amount || 0) || 0), 0);

    const totalDeductions = addDeductions - lessDeductions;
    // Grand Total (Supplier Net Payable): only add loadman/transport if included in supplier bill
    const isLoadmanSupplier = String(formData.loadman_payable_type || '').toUpperCase().includes('SUPPLIER') || String(formData.loadman_payable_type || '').toUpperCase().includes('INCLUDED');
    const isTransportSupplier = String(formData.transport_payable_type || '').toUpperCase().includes('SUPPLIER') || String(formData.transport_payable_type || '').toUpperCase().includes('INCLUDED');

    let rawGrandTotal = invoiceResult.netAmount + totalDeductions;
    if (isLoadmanSupplier) {
      rawGrandTotal += calculatedLoadmanCharges;
    }
    if (isTransportSupplier) {
      rawGrandTotal += parseFloat(formData.net_transport_amount || formData.transport_charges || formData.freight_amount || 0);
    }
    const grandTotal = Number(rawGrandTotal.toFixed(2));

    const activeTaxRate = Number(invoiceResult.rateSummaries
      .find(rate => Number(rate.gstRate) > 0)?.gstRate || 0);

    return {
      totalQty: invoiceResult.totalQty,
      totalWeight: invoiceResult.totalWeight,
      baseAmount: invoiceResult.baseAmount,
      discountAmount: invoiceResult.discAmount,
      discountPercent: (() => {
        const rates = [...new Set(validItems
          .map(item => Number(item.disc_percent ?? item.disc ?? 0))
          .filter(rate => rate > 0))];
        return rates.length === 1 ? rates[0] : 0;
      })(),
      taxable: invoiceResult.taxableAmount,
      exemptAmount: invoiceResult.exemptAmount || 0,
      nilRatedAmount: invoiceResult.nilRatedAmount || 0,
      zeroRatedAmount: invoiceResult.zeroRatedAmount || 0,
      nonGstAmount: invoiceResult.nonGstAmount || 0,
      withoutTaxAmount: invoiceResult.withoutTaxAmount || 0,
      taxAmount: invoiceResult.taxAmount,
      cgstAmount: invoiceResult.cgstAmount,
      sgstAmount: invoiceResult.sgstAmount,
      igstAmount: invoiceResult.igstAmount,
      cessAmount: invoiceResult.cessAmount,
      rateSummaries: invoiceResult.rateSummaries,
      hsnSummaries: invoiceResult.hsnSummaries,
      taxRate: activeTaxRate,
      isInterState: invoiceResult.isInterState,
      netAmount: invoiceResult.netAmount,
      totalDeductions,
      grandTotal,
      unloadingCharges: calculatedLoadmanCharges,
      calculatedDeductions
    };
  }, [validItems, formData.tax_type, formData.tax_rate, formData.tax_percent, formData.supplier_state, formData.supplier_state_code, selectedDeductions, calculatedLoadmanCharges]);

  // Expose 'totals' alias to guarantee no ReferenceError anywhere in component
  const totals = erpTotals;

  // Keep loadman_charges form field automatically synchronized with calculated charges
  useEffect(() => {
    if (skipLoadmanChargeSync.current) {
      skipLoadmanChargeSync.current = false;
      return;
    }
    // Prevent overwriting existing loaded charges on initial edit load
    if (isEditPurchaseLoaded.current) {
      return;
    }
    const chargeStr = String(calculatedLoadmanCharges || 0);
    setFormData(prev => {
      if (prev.loadman_charges !== chargeStr) {
        return { ...prev, loadman_charges: chargeStr };
      }
      return prev;
    });
  }, [calculatedLoadmanCharges]);

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
      stock_type: formData.stock_type || 'RM',
      transporter: formData.transporter || formData.transport || '',
      transport: formData.transporter || formData.transport || '',
      vehicle_no: formData.vehicle_no || formData.lorry_no || '',
      lorry_no: formData.vehicle_no || formData.lorry_no || '',
      driver_name: formData.driver_name || formData.driver || '',
      driver: formData.driver_name || formData.driver || '',
      contact_person: formData.contact_person || '',
      area: formData.area || '',
      phone: formData.phone || '',
      gst_no: formData.gst_no || '',
      email: formData.email || '',
      gross_weight: formData.gross_weight,
      cross_weight: formData.gross_weight,
      tare_weight: formData.tare_weight,
      net_weight: formData.net_weight,

      tax_percent: formData.tax_rate,
      tax_mode: formData.tax_type,
      company_state: 'Tamil Nadu',
      company_state_code: '33',
      supplier_state: formData.supplier_state || 'Tamil Nadu',
      supplier_state_code: formData.supplier_state_code || '33',
      type: formData.type, // purchase_type
      sno: formData.s_no || 1,
      remarks: formData.remarks,
      source_order_no: formData.source_order_no || formData.po_no,
      source_order_id: formData.source_order_id || formData.purchase_order_id,
      purchase_order_id: formData.purchase_order_id || formData.source_order_id,
      po_no: formData.po_no || formData.source_order_no,
      // Cold Storage & Loadman details
      chamber_no: formData.chamber_no || 'Chamber 1',
      loadman_name: formData.loadman_name || '',
      loadman_worker_id: formData.loadman_worker_id || null,
      loadman_qty_kg: formData.loadman_qty_kg || String(erpTotals?.totalWeight || 0),
      loadman_rate_per_kg: formData.loadman_rate_per_kg || '0.50',
      loadman_charges: formData.loadman_charges || String(calculatedLoadmanCharges || 0),
      additional_charges: formData.additional_charges || '0',
      // Keep fields that may be used by ledger helper
      supplier_id: formData.supplier_id
    }
  }, [formData, erpTotals?.totalWeight, calculatedLoadmanCharges])



  const loadDeductions = useCallback(async () => {
    try {
      const res = await getMasters('deduction_purchase', { forceRefresh: true });
      const data = res?.data || res;
      const arr = Array.isArray(data) ? data : [];
      setDeductions(arr);
      return arr;
    } catch (err) {
      console.error('Deduction load failed', err);
      return [];
    }
  }, []);

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const applyPurchaseOrder = useCallback(async (order) => {
    if (!order) return;
    const draft = buildReceiptDraftFromPurchaseOrder(order);

    // Fetch fresh next S.No
    let nextSNo = '';
    try {
      const snoRes = await api('/purchases/next-sno');
      if (snoRes?.next_sno || snoRes?.data?.s_no) {
        nextSNo = String(snoRes.next_sno || snoRes.data.s_no);
      }
    } catch (e) {}

    let suppAddress = order.address || order.supplierAddress || '';
    let suppId = draft.formData.supplier_id || order.supplier_id || order.supplierId || '';
    const suppNameCandidate = order.supplier_name || order.supplierName || order.supplier || '';
    if (!suppId && suppNameCandidate) {
      try {
        const suppListRes = await getMasters('suppliers');
        const suppList = Array.isArray(suppListRes) ? suppListRes : (suppListRes?.data || []);
        const matched = suppList.find(s => 
          String(s.id) === String(suppNameCandidate) ||
          String(s.name || s.supplier_name).trim().toLowerCase() === String(suppNameCandidate).trim().toLowerCase()
        );
        if (matched) {
          suppId = String(matched.id);
        } else if (/^\d+$/.test(String(suppNameCandidate))) {
          suppId = String(suppNameCandidate);
        }
      } catch (e) {}
    }

    if ((!suppAddress || suppAddress.length < 5) && suppId) {
      try {
        const suppRes = await api(`/masters/record/suppliers/${suppId}`);
        if (suppRes) {
          const partyName = suppRes.name || suppRes.supplier_name || '';
          const contactPerson = suppRes.contact_person || '';
          const addressLine = suppRes.address || suppRes.address1 || '';
          const area = suppRes.area || '';
          const phone = suppRes.phone || suppRes.mobile || '';
          const email = suppRes.email || '';
          const gstNo = suppRes.gst_no || suppRes.tin_no || '';
          suppAddress = [
            partyName && `Name : ${partyName}`,
            contactPerson && `Contact Person : ${contactPerson}`,
            addressLine && `Address : ${addressLine}`,
            area && `Area : ${area}`,
            phone && `Phone : ${phone}`,
            email && `Email : ${email}`,
            gstNo && `GST/TIN No : ${gstNo}`
          ].filter(Boolean).join('\n');
        }
      } catch (e) {}
    }

    const godownVal = draft.formData.godown || order.godown || order.godown_name || '';
    const godownIdVal = draft.formData.godown_id || order.godown_id || order.godownId || '';

    setFormData((prev) => ({
      ...prev,
      ...draft.formData,
      s_no: nextSNo || prev.s_no,
      supplier_id: suppId || prev.supplier_id,
      supplier: suppId || prev.supplier_id,
      godown: godownVal || prev.godown,
      godown_id: godownIdVal || prev.godown_id,
      address: suppAddress || draft.formData.address || prev.address || '',
      supplier_details: suppAddress || draft.formData.supplier_details || prev.supplier_details || '',
      transporter: order.transporter || order.transport || order.ship_via || draft.formData.transporter || prev.transporter || '',
      transport: order.transporter || order.transport || order.ship_via || draft.formData.transporter || prev.transporter || '',
      vehicle_no: order.vehicle_no || order.lorry_no || draft.formData.vehicle_no || prev.vehicle_no || '',
      lorry_no: order.vehicle_no || order.lorry_no || draft.formData.vehicle_no || prev.vehicle_no || '',
      driver_name: order.driver_name || order.driver || draft.formData.driver_name || prev.driver_name || '',
      driver: order.driver_name || order.driver || draft.formData.driver_name || prev.driver_name || '',
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

    // Prioritize actual purchase order items over any stale cached draft to avoid unwanted rows
    const baseItems = Array.isArray(order.items) ? order.items : [];
    const mappedItems = baseItems.map((it, idx) => {
      const qty = Number(it.qty || 0);
      const rate = Number(it.rate || it.purc_rate || 0);
      const weight = Number(it.weight || it.per_unit_weight || it.perUnitWeight || 0);
      const totWt = Number(it.tot_wt || it.total_wt || it.total_weight || (qty * (weight || 1)));
      const disc = Number(it.discount_percent || it.disc_percent || it.disc || 0);
      const tax = Number(it.tax_percent ?? it.tax_rate ?? order.tax_percent ?? order.tax_rate ?? 0);
      const baseAmt = qty * rate;
      const discAmt = baseAmt * (disc / 100);
      const taxable = baseAmt - discAmt;
      const taxAmt = (taxable * tax) / 100;
      const finalAmt = Number(it.amount) || (taxable + taxAmt);
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
        tot_wt: totWt,
        total_wt: totWt,
        total_weight: totWt,
        rate,
        purc_rate: rate,
        disc,
        disc_percent: disc,
        tax_rate: tax,
        tax_percent: tax,
        base_amount: baseAmt,
        disc_amount: discAmt,
        tax_amount: taxAmt,
        amount: finalAmt.toFixed(2),
        lot_no: autoLot,
        lot_status: 'reserved'
      };
    });

    const hasPricedItems = mappedItems.some(it => Number(it.rate) > 0 || Number(it.amount) > 0);
    const filteredMappedItems = mappedItems.filter(it => {
      const hasName = Boolean(it.item_name || it.item_id);
      const hasQtyOrRate = Number(it.qty) > 0 || Number(it.rate) > 0;
      if (!hasName || !hasQtyOrRate) return false;
      // If PO has priced items, filter out zero-rate zero-amount auxiliary entries (e.g. Vacuum Bag with rate 0, amount 0)
      if (hasPricedItems) {
        return Number(it.rate) > 0 || Number(it.amount) > 0;
      }
      return true;
    });

    // Explicitly replace table data to avoid merging with previous entries (e.g. from drafts)
    if (filteredMappedItems.length > 0) {
      setTableData(filteredMappedItems);
    } else {
      setTableData([{
        sno: 1,
        item_name: '',
        lot_no: '',
        qty: '',
        weight: '',
        total_wt: '',
        rate: '',
        disc: '',
        tax_rate: 5,
        amount: '',
        lot_status: 'available'
      }]);
    }

    const orderDeductions = (order.deductions && order.deductions.length > 0) ? order.deductions : (draft.selectedDeductions || []);
    if (orderDeductions.length > 0) {
      const activeDeductions = deductionsRef.current || [];
      setSelectedDeductions(orderDeductions.map(d => {
        const matchedDed = activeDeductions.find(master => 
          String(master.id) === String(d.id || d.deduction_id) || 
          (master.ded_name && (d.deduction || d.deduction_name || d.name) && master.ded_name.toLowerCase() === (d.deduction || d.deduction_name || d.name).toLowerCase())
        );
        return {
          id: matchedDed ? matchedDed.id : (d.deduction_id || d.id || ''),
          deduction_id: matchedDed ? matchedDed.id : (d.deduction_id || d.id || ''),
          name: matchedDed ? (matchedDed.ded_name || matchedDed.name) : (d.deduction || d.deduction_name || d.name || ''),
          deduction: matchedDed ? (matchedDed.ded_name || matchedDed.name) : (d.deduction || d.deduction_name || d.name || ''),
          amount: parseFloat(d.amount) || 0,
          type: (d.type || matchedDed?.type || 'LESS').toUpperCase(),
          percentage: parseFloat(d.percent || d.percentage || d.value || 0),
          percent: parseFloat(d.percent || d.percentage || d.value || 0),
          calculation_type: d.calculation_type || d.calc_type || matchedDed?.calculation_type || (d.percent || d.percentage ? 'Percentage' : 'Fixed'),
          manual_amount: false,
          remarks: d.remarks || ''
        };
      }));
    }
  }, []);

  const [godownsList, setGodownsList] = useState([]);
  const [coldStorageTariff, setColdStorageTariff] = useState(null);

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

    const loadGodowns = async () => {
      try {
        const res = await getMasters('godowns');
        const arr = Array.isArray(res?.data || res) ? (res?.data || res) : [];
        setGodownsList(arr);
      } catch (err) {
        console.warn('Godowns master load failed:', err.message);
      }
    };

    loadGodowns();

    const fetchNextSNo = async () => {
      if (id) return;
      try {
        const nextSNo = await api.getNextSNo('/purchases/purchase-list');
        setFormData(prev => ({ ...prev, s_no: String(nextSNo) }));
      } catch (err) {
        console.error('Failed to fetch next S.No:', err);
      }
    };

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
        if (!result || result.success === false) {
          throw new Error(result?.message || 'The purchase could not be loaded.');
        }
        const data = result?.data || result;
        if (data && (data.id || data.s_no)) {
          skipLoadmanChargeSync.current = data.loadman_charges !== undefined &&
            data.loadman_charges !== null &&
            data.loadman_charges !== '' &&
            Number(data.loadman_charges) !== Number(calculatedLoadmanCharges);
          const formatDate = (d) => d ? String(d).split('T')[0].split(' ')[0] : '';
          const suppId = String(data.supplier || data.supplier_id || data.supplierId || '');
          const suppName = data.supplier_name || data.supplierName || '';

          setFormData({
            s_no: String(data.s_no || data.sNo || ''),
            supplier_id: suppId,
            supplierId: suppId,
            supplier_name: suppName,
            supplierName: suppName,
            supplier_details: data.address || data.supplier_details || '',
            address: data.address || data.supplier_details || '',
            supplier_state: data.supplier_state || data.party_state || data.state || 'Tamil Nadu',
            supplier_state_code: data.supplier_state_code || data.party_state_code || data.state_code || '33',
            transporter: data.transporter || data.transport || '',
            transport: data.transporter || data.transport || '',
            transport_charges: parseFloat(data.transport_charges || data.freight_amount || 0),
            freight_amount: parseFloat(data.freight_amount || data.transport_charges || 0),
            advance_amount: parseFloat(data.advance_amount || 0),
            mamool_amount: parseFloat(data.mamool_amount || 0),
            weight_cash: parseFloat(data.weight_cash || 0),
            other_additional_charges: parseFloat(data.other_additional_charges || 0),
            other_deductions: parseFloat(data.other_deductions || 0),
            net_transport_amount: parseFloat(data.net_transport_amount || 0),
            transport_payable_type: data.transport_payable_type || 'SEPARATE',
            vehicle_no: data.vehicle_no || data.lorry_no || '',
            lorry_no: data.vehicle_no || data.lorry_no || '',
            driver_name: data.driver_name || data.driver || '',
            driver: data.driver_name || data.driver || '',
            driver_mobile: data.driver_mobile || '',
            transport_date: data.transport_date || '',
            contact_person: data.supplier_contact_person || data.contact_person || '',
            area: data.area || '',
            phone: data.supplier_phone || data.phone || '',
            gross_weight: data.gross_weight ?? data.cross_weight ?? '',
            tare_weight: data.tare_weight ?? '',
            net_weight: data.net_weight ?? '',
            weighbridge_location: data.weighbridge_location || 'Main Factory',
            unloading_date: data.unloading_date || '',
            unloading_time: data.unloading_time || '',
            weighment_ref_no: data.weighment_ref_no || '',
            operator_name: data.operator_name || '',
            weight_status: data.weight_status || (Number(data.tare_weight || 0) > 0 ? 'COMPLETED' : 'TARE_PENDING'),
            date: formatDate(data.date),
            inv_no: data.inv_no || data.invNo || '',
            invNo: data.inv_no || data.invNo || '',
            inv_date: formatDate(data.inv_date || data.invDate),
            invDate: formatDate(data.inv_date || data.invDate),
            godown_id: String(data.godown || data.godown_id || data.godownId || ''),
            godownId: String(data.godown || data.godown_id || data.godownId || ''),
            pay_type: data.pay_type || data.payType || 'Cash',
            stock_type: data.stock_type || data.stockType || 'RM',
            tax_type: data.tax_type || data.taxType || 'Exclusive',
            tax_rate: data.tax_percent ?? data.tax_rate ?? 0,
            loadman_name: data.loadman_name || data.worker_name || '',
            loadman_worker_id: data.loadman_worker_id ? String(data.loadman_worker_id) : '',
            loadman_qty_kg: data.loadman_qty_kg !== undefined && data.loadman_qty_kg !== null ? String(data.loadman_qty_kg) : '',
            loadman_rate_per_kg: (data.loadman_rate_per_kg !== undefined && data.loadman_rate_per_kg !== null && String(data.loadman_rate_per_kg) !== '') ? String(data.loadman_rate_per_kg) : '0.50',
            loadman_charges: (data.loadman_charges !== undefined && data.loadman_charges !== null && String(data.loadman_charges) !== '') ? String(data.loadman_charges) : '',
            loadman_payable_type: data.loadman_payable_type || 'SEPARATE',
            additional_charges: data.additional_charges !== undefined && data.additional_charges !== null ? String(data.additional_charges) : '0',
            gst_no: data.gst_no || data.supplier_gstin || '',
            email: data.email || data.supplier_email || '',
            type: data.type || 'Urad',
            remarks: data.remarks || '',
            source_order_no: data.source_order_no || data.po_no || '',
            source_order_id: data.source_order_id || data.purchase_order_id || '',
            purchase_order_id: data.purchase_order_id || data.source_order_id || '',
            po_no: data.po_no || data.source_order_no || ''
          });
          isEditPurchaseLoaded.current = true;

          if (Array.isArray(data.items) && data.items.length > 0) {
            setTableData(data.items.map(it => {
              const qty = Number(it.qty || 0);
              const rate = Number(it.rate || it.purc_rate || 0);
              const disc_percent = Number(it.disc_percent ?? it.discount_percent ?? 0);
              const tax_percent = Number(it.tax_percent ?? it.tax_rate ?? it.gst_rate ?? 0);

              const per_unit_wt = Number(it.per_unit_weight ?? it.weight ?? 0);
              const total_weight = Number(it.total_weight ?? it.total_wt ?? (qty * per_unit_wt));
              const lineTax = calculateLineTax({
                qty,
                rate,
                discPercent: disc_percent,
                discAmount: it.disc_amount,
                taxType: it.tax_type,
                taxMode: data.tax_mode || data.tax_type || 'Exclusive',
                gstRate: tax_percent,
                cessRate: it.cess_rate || 0,
                hsnCode: it.hsn_code || '',
                companyState: data.company_state || 'Tamil Nadu',
                partyState: data.supplier_state || data.party_state || 'Tamil Nadu',
                companyStateCode: data.company_state_code || '33',
                partyStateCode: data.supplier_state_code || data.party_state_code || '33'
              });
              const base_amount = lineTax.grossAmount;
              const disc_amount = lineTax.discAmount;
              const tax_amount = lineTax.taxAmount;
              const amount = lineTax.totalAmount;

              const matchedWeight = weightsList.find(w => Number(w.weight) === per_unit_wt);
              const weight_id = matchedWeight ? matchedWeight.id : (it.weight_id || '');

              return {
                ...it,
                item_id: it.item_id || it.itemId || it.item_name || '',
                item_name: it.item_name || it.itemName || '',
                item_label: it.item_name || it.itemName || '',
                qty,
                weight: per_unit_wt,
                weight_id: weight_id,
                per_unit_wt,
                total_wt: total_weight,
                total_weight,
                rate,
                purc_rate: rate,
                disc: disc_percent,
                disc_percent,
                tax_rate: lineTax.gstRate,
                tax_percent: lineTax.gstRate,
                gst_rate: lineTax.gstRate,
                tax_type: lineTax.taxType,
                hsn_code: lineTax.hsnCode,
                base_amount,
                disc_amount,
                tax_amount,
                amount: amount.toFixed(2),
                lot_no: it.lot_no || '',
                lot_status: 'reserved'
              };
            }));
          }

          if (Array.isArray(data.deductions) && data.deductions.length > 0) {
            setSelectedDeductions(data.deductions.map(d => ({
              id: d.id || d.deduction_id || d.deduction_purchase_id || '',
              deduction_id: d.deduction_id || d.id || '',
              name: d.deduction_name || d.name || d.deduction || '',
              deduction: d.deduction_name || d.name || d.deduction || '',
              amount: parseFloat(d.amount) || 0,
              type: (d.type || 'LESS').toUpperCase(),
              percentage: parseFloat(d.percent || d.percentage || d.value || 0),
              percent: parseFloat(d.percent || d.percentage || d.value || 0),
              remarks: d.remarks || ''
            })));
          }
        } else {
          throw new Error('The requested purchase was not found.');
        }
      } catch (err) {
        console.error('Failed to load purchase details for edit:', err);
        setError(`Could not load purchase details: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    const preloadFromPurchaseOrder = async () => {
      const params = new URLSearchParams(location.search);
      const sourceOrderId = params.get('sourcePurchaseOrderId') || params.get('po_id') || params.get('purchase_order_id') || params.get('po');
      const selectedOrder = location.state?.sourcePurchaseOrder;
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

      // If loading from PO, ensure any existing draft for NEW creation is cleared to avoid mixing
      if (!id) clearModuleDraft('purchase_create');

      try {
        let order = null;
        try {
          order = await purchaseOrderService.get(sourceOrderId);
        } catch (e) {
          console.log('purchaseOrderService get fallback');
        }
        if (!order || (!order.id && !order.s_no && !order.inv_no)) {
          const res = await api(`/purchase-orders/${sourceOrderId}`).catch(() => null);
          if (res?.data && (res.data.id || res.data.s_no || res.data.inv_no)) {
            order = res.data;
          } else if (res && (res.id || res.s_no || res.inv_no)) {
            order = res;
          }
        }

        if (order && (order.id || order.s_no || order.inv_no)) {
          if (selectedOrder && String(selectedOrder.id) === String(sourceOrderId)) {
            if (order.id && String(order.id) !== String(selectedOrder.id)) {
              throw new Error('The selected Purchase Order does not match the order returned by the server.');
            }
            const selectedItems = getPurchaseOrderItemsForInward(selectedOrder, order);
            if (selectedItems.length === 0) {
              throw new Error(`No item details were returned for Purchase Order ${order.inv_no || order.invNo || sourceOrderId}.`);
            }
            order = { ...order, items: selectedItems };
          }
          await applyPurchaseOrder(order);
          setSuccess(`Inward loaded from Purchase Order ${order.inv_no || order.invNo || ('#' + sourceOrderId)}`);
        } else {
          setError(`Could not fetch Purchase Order #${sourceOrderId}`);
        }
      } catch (err) {
        console.error('Error preloading PO:', err);
        setError(`Error loading Purchase Order: ${err.message}`);
      }
    };

    fetchNextSNo();
    loadDeductions();
    fetchPurchase();
    preloadFromPurchaseOrder();
  }, [id, location.search, location.state, applyPurchaseOrder]);

  // Auto-save draft when form changes (for new entries only)
  useEffect(() => {
    if (!id && (formData.supplier_id || (tableData && tableData.some(r => r.item_name || r.qty)))) {
      saveModuleDraft('purchase_create', { formData, tableData, selectedDeductions });
    }
  }, [id, formData, tableData, selectedDeductions]);

  // Auto-detect Cold Storage selection and load live tariff rules
  useEffect(() => {
    const rawGodown = formData.godown_id;
    if (!rawGodown) {
      setColdStorageTariff(null);
      return;
    }
    const g = (godownsList || []).find(it => 
      String(it.id) === String(rawGodown) || 
      String(it.godown_name).toLowerCase() === String(rawGodown).toLowerCase()
    );
    const isCs = Boolean(
      g && (
        Number(g.is_cold_storage) === 1 ||
        String(g.godown_type || '').toLowerCase().includes('cold') ||
        String(g.storage_location || '').toLowerCase().includes('outside') ||
        String(g.godown_name || '').toLowerCase().includes('cold') ||
        Number(g.id) === 2
      )
    );

    if (isCs && g?.id) {
      api(`/cold-storage/tariff/${g.id}`).then(res => {
        if (res && res.data) {
          setColdStorageTariff(res.data);
          setFormData(prev => ({
            ...prev,
            loadman_rate_per_kg: prev.loadman_rate_per_kg || String(res.data.inwardUnloadingRate || '0.50'),
            chamber_no: prev.chamber_no || g.default_chamber || 'Chamber 1'
          }));
        }
      }).catch(e => console.warn('Tariff fetch notice:', e.message));
    } else {
      setColdStorageTariff(null);
    }
  }, [formData.godown_id, godownsList]);

  const selectedGodownObj = useMemo(() => {
    const rawGodown = formData.godown_id;
    if (!rawGodown) return null;
    return (godownsList || []).find(it => 
      String(it.id) === String(rawGodown) || 
      String(it.godown_name).toLowerCase() === String(rawGodown).toLowerCase()
    ) || null;
  }, [godownsList, formData.godown_id]);

  const isColdStorageSelected = useMemo(() => {
    if (!selectedGodownObj) return false;
    return Boolean(
      Number(selectedGodownObj.is_cold_storage) === 1 ||
      String(selectedGodownObj.godown_type || '').toLowerCase().includes('cold') ||
      String(selectedGodownObj.storage_location || '').toLowerCase().includes('outside') ||
      String(selectedGodownObj.godown_name || '').toLowerCase().includes('cold') ||
      Number(selectedGodownObj.id) === 2
    );
  }, [selectedGodownObj]);

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
      setError('');
      let fullPo = null;
      try {
        fullPo = await purchaseOrderService.get(po.id);
      } catch (e) {}
      if (!fullPo) {
        const res = await api(`/purchase-orders/${po.id}`).catch(() => null);
        fullPo = res?.data || res || po;
      }

      if (!fullPo) {
        throw new Error(`Could not load Purchase Order ${po.inv_no || po.invNo || po.id}.`);
      }

      if (po.id && fullPo.id && String(fullPo.id) !== String(po.id)) {
        throw new Error(
          `The selected Purchase Order ${po.inv_no || po.invNo || po.id} did not match the order returned by the server. Please refresh the PO list and try again.`
        );
      }

      const selectedItems = getPurchaseOrderItemsForInward(po, fullPo);
      if (!Array.isArray(selectedItems) || selectedItems.length === 0) {
        throw new Error(
          `No item details were returned for Purchase Order ${po.inv_no || po.invNo || po.id}. No rows were imported.`
        );
      }

      clearModuleDraft('purchase_create');
      await applyPurchaseOrder({ ...fullPo, items: selectedItems });
      setPoPickerOpen(false);
    } catch (err) {
      console.error('Error importing PO:', err);
      setError(`Could not import Purchase Order: ${err.message}`);
    }
  };

  const handleTopFrameChange = useCallback((e, val) => {
    let name, value;
    if (e && e.target && e.target.name !== undefined) {
      name = e.target.name;
      value = e.target.value;
    } else if (typeof e === 'string') {
      name = e;
      value = val;
    } else if (e && e.name !== undefined) {
      name = e.name;
      value = e.value;
    } else {
      return;
    }

    if (name === 'loadman_rate_per_kg' || name === 'loadman_qty_kg' || name === 'loadman_charges') {
      isEditPurchaseLoaded.current = false;
    }

    setFormData(prev => {
      if (name !== 'gross_weight' && name !== 'tare_weight') {
        return { ...prev, [name]: value };
      }
      const currentGross = Number(name === 'gross_weight' ? value : prev.gross_weight) || 0;
      const currentTare = Number(name === 'tare_weight' ? value : prev.tare_weight) || 0;
      return {
        ...prev,
        [name]: value,
        net_weight: (currentGross - currentTare).toFixed(2)
      };
    });
  }, []);

  const handleRowChange = useCallback((index, key, value) => {
    isEditPurchaseLoaded.current = false;
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
      disc_percent: Number(row.disc_percent ?? row.disc ?? 0),
      disc_amount: Number(row.disc_amount || 0),

      tax_percent: Number(row.tax_percent ?? row.tax_rate ?? row.gst_rate ?? 0),
      gst_rate: Number(row.tax_percent ?? row.tax_rate ?? row.gst_rate ?? 0),
      tax_type: row.tax_type || (Number(row.tax_percent ?? row.tax_rate ?? row.gst_rate ?? 0) === 0 ? 'Nil Rated' : 'Taxable'),
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
      const hasGrossWeight = formData.gross_weight !== '' && formData.gross_weight !== null && formData.gross_weight !== undefined;
      const hasTareWeight = formData.tare_weight !== '' && formData.tare_weight !== null && formData.tare_weight !== undefined;
      const grossWeight = Number(formData.gross_weight || 0);
      const tareWeight = Number(formData.tare_weight || 0);
      if ((hasGrossWeight && (!Number.isFinite(grossWeight) || grossWeight < 0)) ||
          (hasTareWeight && (!Number.isFinite(tareWeight) || tareWeight < 0))) {
        setError('Cross Weight and Tare Weight must be valid non-negative kilograms.');
        return;
      }
      if ((hasGrossWeight || hasTareWeight) && grossWeight - tareWeight < 0) {
        setError('Tare Weight cannot exceed Cross Weight.');
        return;
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
            tax_type: it.tax_type,
            tax_amount: it.tax_amount,
            amount: it.amount,
          })),
          totals: {
            totalQty: totals.totalQty,
            totalWeight: totals.totalWeight,
            totalAmount: totals.baseAmount - totals.discountAmount,
            baseAmount: totals.baseAmount,
            discAmount: totals.discountAmount,
            taxAmount: totals.taxAmount,
            cgstAmount: totals.cgstAmount,
            sgstAmount: totals.sgstAmount,
            igstAmount: totals.igstAmount,
            cessAmount: totals.cessAmount || 0,
            netAmount: totals.netAmount,
            taxableAmount: totals.taxable,
            exemptAmount: totals.exemptAmount,
            deductionAmount: totals.totalDeductions, // backend expects deductionAmount
            grandTotal: totals.grandTotal,
            // keep backend-expected container
            deductions: { autoWages: 0, vatPercent: 0, vat: 0 },
          },
          deductions: totals.calculatedDeductions.map(d => ({ // Pass full deduction details
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
        try {
          const { invalidateMasterCache } = await import('../services/masterservice.js');
          invalidateMasterCache('loadman');
          invalidateMasterCache('workers');
          invalidateMasterCache('operational_parties');
        } catch (_) {}
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
    if (dedId === '__CREATE_NEW__' || dedId === 'create_new' || dedId === 'manual') {
      setInlineDeductionOpen(true);
      return;
    }
    const master = deductions.find(d => String(d.id) === String(dedId));
    if (!master) return;

    // Check if deduction already added
    if (selectedDeductions.some(d => String(d.id) === String(dedId))) {
      alert('This deduction has already been added.');
      return;
    }

    const calcType = master.calculation_type || master.calc_type || 'Percentage';
    const dedValue = parseFloat(master.deduction_value || master.ded_value || 0) || 0;

    // Required: deduction amount based on ERP taxable base (we keep it simple: Percentage of erpTotals taxable base)
    let amt = 0;
    if (String(calcType).toLowerCase().includes('percent')) {
      amt = Number(erpTotals.taxable || 0) * (dedValue / 100);
    } else {
      amt = dedValue;
    }

    setSelectedDeductions(prev => [...prev, {
      id: master.id,
      deduction_id: master.id,
      name: master.ded_name || master.name || master.deduction_name || 'Unnamed',
      amount: amt,
      manual_amount: false,
      type: String(master.type || master.ded_type || master.deduction_type || 'LESS').toUpperCase(),
      calculation_type: calcType,
      percentage: calcType === 'Percentage' ? dedValue : 0,
      affect_gst: String(master.affect_gst || master.affect_cost_of_goods || 'NO').toUpperCase(),
      remarks: ''
    }]);
  };

  const handleInlineDeductionCreated = async (newId, newRecord) => {
    try {
      const refreshed = await loadDeductions();
      const targetId = newId || newRecord?.id;
      const created = (refreshed || []).find(d => String(d.id) === String(targetId)) || newRecord;
      if (created) {
        const calcType = created.calculation_type || created.calc_type || 'Percentage';
        const dedValue = parseFloat(created.deduction_value || created.ded_value || 0) || 0;
        let amt = 0;
        if (String(calcType).toLowerCase().includes('percent')) {
          amt = Number(erpTotals.taxable || 0) * (dedValue / 100);
        } else {
          amt = dedValue;
        }
        setSelectedDeductions(prev => {
          if (prev.some(d => String(d.id) === String(targetId))) return prev;
          return [...prev, {
            id: targetId,
            deduction_id: targetId,
            name: created.ded_name || created.name || created.deduction_name || 'Unnamed',
            amount: amt,
            manual_amount: false,
            type: String(created.type || created.ded_type || created.deduction_type || 'LESS').toUpperCase(),
            calculation_type: calcType,
            percentage: calcType === 'Percentage' ? dedValue : 0,
            affect_gst: String(created.affect_gst || created.affect_cost_of_goods || 'NO').toUpperCase(),
            remarks: ''
          }];
        });
      }
    } catch (err) {
      console.error('Failed to handle newly created deduction:', err);
    }
  };

  const formatNumber = (num) => Number(num || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3
  });

  // Define fields for EntryTopFrame - organized by columns (matches SalesCreate)
  // ✅ Purchase fields with Transporter, Vehicle No, Driver name
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
    { name: 'godown_id', label: 'Godown', type: 'masterSelect', masterType: 'godowns', col: 1 },

    // Column 2
    { name: 'inv_no', label: 'Invoice No', type: 'text', col: 2 },
    { name: 'inv_date', label: 'Invoice Date', type: 'date', col: 2 },
    { name: 'loadman_name', label: 'Loadman Team', type: 'masterSelect', masterType: 'workers', placeholder: 'e.g. K. Murugan', col: 2 },
    { name: 'loadman_rate_per_kg', label: 'Loadman (₹/Kg)', type: 'number', min: 0, step: '0.01', placeholder: '0.50', col: 2 },
    { name: 'loadman_charges', label: 'Unloading Fee (₹)', type: 'number', readOnly: true, col: 2 },
    { name: 'loadman_payable_type', label: 'Loadman Payment', type: 'select', options: [
      { value: 'SEPARATE', label: 'Separately Payable to Loadman' },
      { value: 'SUPPLIER_INVOICE', label: 'Included in Supplier Bill' }
    ], col: 2 },

    // Column 3
    { name: 'supplier_id', label: 'Supplier', type: 'masterSelect', masterType: 'suppliers', col: 3 },
    { name: 'type', label: 'Type', type: 'select', options: [
      {value: 'Urad', label: 'Urad'}, {value: 'Rice', label: 'Rice'}, {value: 'Flour', label: 'Flour'}, {value: 'Other', label: 'Other'}
    ], col: 3 },
    { name: 'gross_weight', label: 'Cross Weight (KG)', type: 'number', min: 0, step: '0.01', col: 3 },
    { name: 'tare_weight', label: 'Tare Weight (KG)', type: 'number', min: 0, step: '0.01', col: 3 },
    { name: 'net_weight', label: 'Net Weight (KG)', type: 'number', readOnly: true, step: '0.01', col: 3 },
    { name: 'address', label: 'Address', type: 'textarea', readOnly: true, col: 3 },
    { name: 'remarks', label: 'Remarks', type: 'textarea', col: 3 },
  ];

  // ✅ FIXED Purchase columns: Auto lot generation on Item select, manual Qty, manual Weight, manual Rate
  const columns = [
    { key: 'sno', title: 'S.No', readOnly: true },
    { key: 'item_name', title: 'Item', type: 'masterSelect', masterType: 'items' },
    { key: 'lot_no', title: 'Lot No' },
    { key: 'qty', title: 'Qty', type: 'number' },
    { key: 'weight', title: 'Per Unit Wt', type: 'masterSelect', masterType: 'weights' },
    { key: 'total_wt', title: 'Total Wt', readOnly: true },
    { key: 'rate', title: 'Rate', type: 'number' }, // Manual entry
    { key: 'disc', title: 'Disc%', type: 'number' },
    { key: 'tax_rate', title: 'Tax%', type: 'taxSelect' },
    { key: 'amount', title: 'Amount', readOnly: true } // Taxable/net amount
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

  const handleCancel = () => {
    if (window.confirm('Are you sure you want to cancel? Any unsaved changes will be discarded.')) {
      clearModuleDraft('purchase_create');
      navigate('/entry/purchase-display');
    }
  };

  const handleBack = () => {
    if ((formData.supplier_id || validItems.length > 0) &&
      !window.confirm('Leave this purchase form? Unsaved changes may be lost.')) {
      return;
    }
    const historyIndex = window.history.state?.idx;
    if (Number.isInteger(historyIndex) && historyIndex > 0) {
      navigate(-1);
    } else {
      navigate('/entry/purchase-display', { replace: true });
    }
  };

  const handleRefresh = async () => {
    if (id) {
      setLoading(true);
      try {
        const result = await api(`/purchases/${id}`);
        const data = result?.data || result;
        if (data) {
          skipLoadmanChargeSync.current = data.loadman_charges !== undefined &&
            data.loadman_charges !== null &&
            data.loadman_charges !== '' &&
            Number(data.loadman_charges) !== Number(calculatedLoadmanCharges);
          const formatDate = (d) => d ? String(d).split('T')[0].split(' ')[0] : '';
          const suppId = String(data.supplier || data.supplier_id || data.supplierId || '');
          const suppName = data.supplier_name || data.supplierName || '';

          setFormData({
            s_no: String(data.s_no || data.sNo || ''),
            supplier_id: suppId,
            supplierId: suppId,
            supplier_name: suppName,
            supplierName: suppName,
            supplier_details: data.address || data.supplier_details || '',
            address: data.address || data.supplier_details || '',
            supplier_state: data.supplier_state || data.party_state || data.state || 'Tamil Nadu',
            supplier_state_code: data.supplier_state_code || data.party_state_code || data.state_code || '33',
            transporter: data.transporter || data.transport || '',
            transport: data.transporter || data.transport || '',
            vehicle_no: data.vehicle_no || data.lorry_no || '',
            lorry_no: data.vehicle_no || data.lorry_no || '',
            driver_name: data.driver_name || data.driver || '',
            driver: data.driver_name || data.driver || '',
            contact_person: data.supplier_contact_person || data.contact_person || '',
            area: data.area || '',
            phone: data.supplier_phone || data.phone || '',
            gross_weight: data.gross_weight ?? data.cross_weight ?? '',
            tare_weight: data.tare_weight ?? '',
            net_weight: data.net_weight ?? '',
            date: formatDate(data.date),
            inv_no: data.inv_no || data.invNo || '',
            invNo: data.inv_no || data.invNo || '',
            inv_date: formatDate(data.inv_date || data.invDate),
            invDate: formatDate(data.inv_date || data.invDate),
            godown_id: String(data.godown || data.godown_id || data.godownId || ''),
            godownId: String(data.godown || data.godown_id || data.godownId || ''),
            pay_type: data.pay_type || data.payType || 'Cash',
            stock_type: data.stock_type || data.stockType || 'RM',
            tax_type: data.tax_type || data.taxType || 'Exclusive',
            tax_rate: data.tax_percent ?? data.tax_rate ?? 0,
            loadman_name: data.loadman_name || data.worker_name || '',
            loadman_worker_id: data.loadman_worker_id ? String(data.loadman_worker_id) : '',
            loadman_qty_kg: data.loadman_qty_kg ?? '',
            loadman_rate_per_kg: (data.loadman_rate_per_kg !== undefined && data.loadman_rate_per_kg !== null && String(data.loadman_rate_per_kg) !== '') ? String(data.loadman_rate_per_kg) : '0.50',
            loadman_charges: (data.loadman_charges !== undefined && data.loadman_charges !== null && String(data.loadman_charges) !== '') ? String(data.loadman_charges) : '',
            additional_charges: data.additional_charges ?? '0',
            gst_no: data.gst_no || data.supplier_gstin || '',
            email: data.email || data.supplier_email || '',
            type: data.type || 'Urad',
            remarks: data.remarks || '',
            source_order_no: data.source_order_no || data.po_no || '',
            source_order_id: data.source_order_id || data.purchase_order_id || '',
            purchase_order_id: data.purchase_order_id || data.source_order_id || '',
            po_no: data.po_no || data.source_order_no || ''
          });
          isEditPurchaseLoaded.current = true;

          if (Array.isArray(data.items) && data.items.length > 0) {
            setTableData(data.items.map(it => {
              const qty = Number(it.approved_qty ?? it.qty ?? 0);
              const rate = Number(it.rate || it.purc_rate || 0);
              const disc_percent = Number(it.disc_percent ?? it.discount_percent ?? 0);
              const tax_percent = Number(it.tax_percent ?? it.tax_rate ?? it.gst_rate ?? 0);
              const per_unit_wt = Number(it.per_unit_weight ?? it.weight ?? 0);
              const total_weight = Number(it.total_weight ?? it.total_wt ?? (qty * per_unit_wt));
              const lineTax = calculateLineTax({
                qty,
                rate,
                discPercent: disc_percent,
                discAmount: it.disc_amount,
                taxType: it.tax_type,
                taxMode: data.tax_mode || data.tax_type || 'Exclusive',
                gstRate: tax_percent,
                cessRate: it.cess_rate || 0,
                hsnCode: it.hsn_code || '',
                companyState: data.company_state || 'Tamil Nadu',
                partyState: data.supplier_state || data.party_state || 'Tamil Nadu',
                companyStateCode: data.company_state_code || '33',
                partyStateCode: data.supplier_state_code || data.party_state_code || '33'
              });
              const base_amount = lineTax.grossAmount;
              const disc_amount = lineTax.discAmount;
              const tax_amount = lineTax.taxAmount;
              const amount = lineTax.totalAmount;

              return {
                ...it,
                item_id: it.item_id || it.itemId || it.item_name || '',
                item_name: it.item_name || it.itemName || '',
                item_label: it.item_name || it.itemName || '',
                qty,
                weight: per_unit_wt,
                per_unit_wt,
                total_wt: total_weight,
                total_weight,
                rate,
                purc_rate: rate,
                disc: disc_percent,
                disc_percent,
                tax_rate: lineTax.gstRate,
                tax_percent: lineTax.gstRate,
                gst_rate: lineTax.gstRate,
                tax_type: lineTax.taxType,
                hsn_code: lineTax.hsnCode,
                base_amount,
                disc_amount,
                tax_amount,
                amount: amount.toFixed(2),
                lot_no: it.lot_no || '',
                lot_status: 'reserved'
              };
            }));
          }
        }
      } catch (e) {
        console.error('Refresh error:', e);
      } finally {
        setLoading(false);
      }
    } else {
      clearModuleDraft('purchase_create');
      try {
        const nextSNo = await api.getNextSNo('/purchases/purchase-list');
        setFormData({
          s_no: String(nextSNo || '1'),
          supplier_id: '',
          supplierId: '',
          supplier_name: '',
          supplierName: '',
          supplier_details: '',
          address: '',
          supplier_state: 'Tamil Nadu',
          supplier_state_code: '33',
          transporter: '',
          transport: '',
          vehicle_no: '',
          lorry_no: '',
          driver_name: '',
          driver: '',
          gross_weight: '',
          tare_weight: '',
          net_weight: '',
          date: new Date().toISOString().split('T')[0],
          inv_no: '',
          invNo: '',
          inv_date: '',
          invDate: '',
          godown_id: '',
          godownId: '',
          pay_type: 'Cash',
          stock_type: 'RM',
          tax_type: 'Exclusive',
          tax_rate: 5,
          gst_no: '',
          email: '',
          type: 'Urad',
          remarks: '',
          source_order_no: '',
          source_order_id: '',
          purchase_order_id: '',
          po_no: ''
        });
        setTableData([{
          sno: 1,
          item_name: '',
          lot_no: '',
          qty: 0,
          weight: 0,
          total_wt: 0,
          rate: 0,
          disc: 0,
          tax_rate: 5,
          amount: 0,
          lot_status: 'available'
        }]);
        setSelectedDeductions([]);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const isPoWise = Boolean(formData.po_no || formData.source_order_no);

  return (
    <div className="window">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div className="screen-title" style={{ margin: 0 }}>
            {id ? 'Purchase Update / Edit' : 'Purchase Creation'}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
            Creation Mode: <span style={{ fontWeight: 600, color: isPoWise ? '#0284c7' : '#16a34a' }}>{isPoWise ? 'PO Wise (Linked Order)' : 'Direct Purchase (Without PO)'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {isPoWise ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    purchase_order_id: '',
                    po_no: '',
                    source_order_id: '',
                    source_order_no: ''
                  }));
                }}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#fee2e2',
                  color: '#991b1b',
                  border: '1px solid #fca5a5',
                  borderRadius: '4px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                ✕ Switch to Direct Purchase
              </button>
              <button
                type="button"
                onClick={handleOpenPoPicker}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#f0fdf4',
                  color: '#166534',
                  border: '1px solid #86efac',
                  borderRadius: '4px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                🔄 Select Different PO
              </button>
            </>
          ) : (
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
              🔗 Link Purchase Order (PO Wise)
            </button>
          )}
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
          fieldAddon={(field, selected) => field.name === 'godown_id' ? (
            <GodownStockPopover
              godownId={selected.option?.id || formData.godown_id}
              godownName={selected.label}
              godownType={selected.option?.godown_type || ''}
            />
          ) : null}
        />

        {/* Transport Freight Summary & Post-Unloading Weight Management Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', margin: '14px 0' }}>
          
          {/* Card A: Consolidated Transport Freight Summary */}
          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>🚚</span>
                <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#1e293b' }}>Transport Freight Details</span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: Number(formData.net_transport_amount || formData.transport_charges || 0) > 0 ? '#dcfce7' : '#f1f5f9',
                  color: Number(formData.net_transport_amount || formData.transport_charges || 0) > 0 ? '#166534' : '#64748b',
                  border: '1px solid #cbd5e1'
                }}>
                  {Number(formData.net_transport_amount || formData.transport_charges || 0) > 0 ? 'Details Saved' : 'Not Added'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setTransportModalOpen(true)}
                style={{
                  padding: '4px 10px',
                  backgroundColor: '#1e40af',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>✏️</span>
                <span>{Number(formData.net_transport_amount || formData.transport_charges || 0) > 0 ? 'Edit Details' : 'Add Freight Details'}</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '12px' }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Transporter:</span>
                <strong style={{ color: '#0f172a' }}>{formData.transporter || formData.transport || 'Not Selected'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Vehicle No:</span>
                <strong style={{ color: '#0f172a', textTransform: 'uppercase' }}>{formData.vehicle_no || 'Not Entered'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Net Transport Amount:</span>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#15803d' }}>
                  ₹{Number(formData.net_transport_amount || formData.transport_charges || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Card B: Weight Details Display Table (Strictly Non-Editable Format) */}
          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>⚖️</span>
                <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#1e293b' }}>Purchase Weight Details</span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: Number(formData.tare_weight || 0) > 0 ? '#dcfce7' : '#fef3c7',
                  color: Number(formData.tare_weight || 0) > 0 ? '#166534' : '#92400e',
                  border: '1px solid #cbd5e1'
                }}>
                  {Number(formData.tare_weight || 0) > 0 ? 'Completed' : 'Tare Pending'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setWeightModalOpen(true)}
                style={{
                  padding: '4px 10px',
                  backgroundColor: '#047857',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>⚖️</span>
                <span>{Number(formData.tare_weight || 0) > 0 ? 'Tare Weight Recorded' : 'Record Tare Weight'}</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: '8px', fontSize: '12px', alignItems: 'center' }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Gross Weight:</span>
                <strong style={{ color: '#0f172a', fontSize: '13px' }}>
                  {formData.gross_weight ? `${Number(formData.gross_weight).toLocaleString('en-IN')} kg` : `${erpTotals.totalWeight || 0} kg`}
                </strong>
              </div>

              {/* Tare Weight with Single Scale Icon */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Tare Weight:</span>
                  <strong style={{ color: Number(formData.tare_weight || 0) > 0 ? '#0f172a' : '#d97706', fontSize: '13px' }}>
                    {Number(formData.tare_weight || 0) > 0 ? `${Number(formData.tare_weight).toLocaleString('en-IN')} kg` : 'Pending'}
                  </strong>
                </div>
                {/* Single Weight Scale Icon for Post-Unloading Entry */}
                <button
                  type="button"
                  onClick={() => setWeightModalOpen(true)}
                  title="Click scale icon to enter Tare Weight post-unloading"
                  style={{
                    border: '1px solid #a7f3d0',
                    background: '#ecfdf5',
                    borderRadius: '50%',
                    width: '30px',
                    height: '30px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#047857',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  ⚖️
                </button>
              </div>

              <div>
                <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Calculated Net Weight:</span>
                <strong style={{ color: Number(formData.net_weight || 0) > 0 ? '#15803d' : '#d97706', fontSize: '13px' }}>
                  {Number(formData.net_weight || 0) > 0 ? `${Number(formData.net_weight).toLocaleString('en-IN')} kg` : 'Pending'}
                </strong>
              </div>
            </div>
          </div>

        </div>



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
          isInterState={erpTotals.isInterState}
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

        <EntryTaxBillDetails
          title="Purchase Bill & GST Tax Breakdown"
          grossAmt={erpTotals.baseAmount || 0}
          discPercent={erpTotals.discountPercent || 0}
          discAmt={erpTotals.discountAmount || 0}
          billAmt={erpTotals.taxable || 0}
          exemptAmt={erpTotals.exemptAmount || 0}
          nilRatedAmt={erpTotals.nilRatedAmount || 0}
          zeroRatedAmt={erpTotals.zeroRatedAmount || 0}
          nonGstAmt={erpTotals.nonGstAmount || 0}
          withoutTaxAmt={erpTotals.withoutTaxAmount || 0}
          taxAmt={erpTotals.taxAmount || 0}
          totalAmt={erpTotals.netAmount || 0}
          grandTotal={erpTotals.grandTotal || 0}
          taxPercent={erpTotals.taxRate ?? 0}
          cgstAmt={erpTotals.cgstAmount || 0}
          sgstAmt={erpTotals.sgstAmount || 0}
          igstAmt={erpTotals.igstAmount || 0}
          rateSummaries={erpTotals.rateSummaries || []}
          deductionsAmt={erpTotals.totalDeductions || 0}
          unloadingAmt={calculatedLoadmanCharges || 0}
          taxType={formData.tax_type}
          isInterState={erpTotals.isInterState}
        />

        <div className="erp-bottom-layout">

          {/* (ERP layout) LEFT -> Deduction Table | RIGHT -> ERP Totals */}

          {/* LEFT SIDE */}
          <div className="deduction-panel">

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0 }}>Deductions</h3>
              <select 
                value=""
                onChange={(e) => handleDeductionAdd(e.target.value)} 
                className="table-input" 
                style={{ width: '220px', height: '30px', fontWeight: 'bold' }}
              >
                <option value="">+ Add Deduction</option>
                {deductions.map((d, idx) => (
                  <option key={`${d.id || 'ded'}-${idx}`} value={d.id}>{d.ded_name || d.name || d.deduction_name}</option>
                ))}
                <option value="__CREATE_NEW__" style={{ fontWeight: 'bold', color: '#1e3a8a' }}>
                  {getCreateLabel('deductions')}
                </option>
              </select>
            </div>

            <table className="deduction-table">
              <thead>
                <tr>
                  <th>Deduction</th>
                  <th style={{ width: '70px' }}>%</th>
                  <th style={{ width: '100px' }}>Amt</th>
                  <th style={{ width: '90px' }}>Calculation</th>
                  <th style={{ width: '40px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>

              <tbody>
                {selectedDeductions.map((row, index) => (
                  <tr key={index}>

                    <td>
                      <select
                        style={{ width: '100%' }}
                        value={
                          deductions.find(d => String(d.id) === String(row.deduction_id || row.id))?.id ||
                          deductions.find(d => (d.ded_name || d.name) === (row.name || row.deduction))?.id ||
                          (row.deduction_id || row.id || row.name || '')
                        }
                        onChange={(e) => {
                          const nextId = e.target.value;
                          if (nextId === '__CREATE_NEW__' || nextId === 'create_new' || nextId === 'manual') {
                            setInlineDeductionOpen(true);
                            return;
                          }
                          const updated = [...selectedDeductions];
                          const master = deductions.find(d => String(d.id) === String(nextId));
                          if (master) {
                            const calcType = master.calculation_type || master.calc_type || 'Percentage';
                            const dedValue = parseFloat(master.deduction_value || master.ded_value || 0) || 0;
                            const isPct = String(calcType).toLowerCase().includes('percent');
                            const base = Number(erpTotals.taxable || 0);
                            updated[index] = {
                              ...updated[index],
                              deduction_id: master.id,
                              id: master.id,
                              name: master.ded_name || master.name || master.deduction_name,
                              calculation_type: calcType,
                              percentage: isPct ? dedValue : 0,
                              percent: isPct ? dedValue : 0,
                              amount: isPct ? (base * (dedValue / 100)) : dedValue,
                              manual_amount: false,
                              type: String(master.type || master.deduction_type || updated[index].type || 'LESS').toUpperCase(),
                            };
                          } else {
                            updated[index] = {
                              ...updated[index],
                              name: nextId,
                              deduction_id: nextId
                            };
                          }
                          setSelectedDeductions(updated);
                        }}
                      >
                        <option value="">Select</option>
                        {(deductions || []).map((d, idx) => (
                          <option key={`${d.id || 'ded'}-${idx}`} value={d.id}>
                            {d.ded_name || d.name}
                          </option>
                        ))}
                        {row.name && !deductions.some(d => String(d.id) === String(row.deduction_id || row.id) || (d.ded_name || d.name) === row.name) && (
                          <option value={row.deduction_id || row.id || row.name}>{row.name}</option>
                        )}
                        <option value="__CREATE_NEW__" style={{ fontWeight: 'bold', color: '#1e3a8a' }}>
                          {getCreateLabel('deductions')}
                        </option>
                      </select>
                    </td>

                    <td>
                      <input
                        type="number"
                        style={{ width: '100%' }}
                        value={Number(row.percent ?? row.percentage ?? 0)}
                        onChange={(e) => {
                          const updated = [...selectedDeductions];
                          const pct = parseFloat(e.target.value) || 0;
                          updated[index].percent = pct;
                          updated[index].percentage = pct;
                          const base = Number(erpTotals.taxable || 0);
                          updated[index].amount = base * (pct / 100);
                          updated[index].manual_amount = false;
                          setSelectedDeductions(updated);
                        }}
                      />
                    </td>

                    <td>
                      <input
                        type="number"
                        style={{ width: '100%' }}
                        value={Number(erpTotals.calculatedDeductions?.[index]?.amount ?? row.amount ?? 0)}
                        onChange={(e) => {
                          const updated = [...selectedDeductions];
                          updated[index].amount = parseFloat(e.target.value) || 0;
                          updated[index].manual_amount = true;
                          setSelectedDeductions(updated);
                        }}
                      />
                    </td>

                    <td>
                      <select
                        style={{ width: '100%' }}
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

                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => deleteDeduction(index)}
                        style={{
                          background: '#fee2e2',
                          color: '#dc2626',
                          border: '1px solid #fca5a5',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          padding: '2px 6px',
                          fontSize: '12px'
                        }}
                        title="Remove Deduction"
                      >
                        ✕
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>

          </div>

          {/* RIGHT : ERP TOTALS */}
          <div className="erp-summary-panel">
            <div style={{ marginBottom: '10px', fontWeight: 'bold', color: '#1e293b' }}>Summary & Weight</div>
            <div>Total Qty : {formatNumber(erpTotals.totalQty)}</div>
            <div>Total Weight : {formatNumber(erpTotals.totalWeight)} KG</div>
            <hr style={{ margin: '12px 0', borderColor: '#cbd5e1' }} />
            <div>Base Amount : ₹{formatNumber(erpTotals.baseAmount)}</div>
            <div>Discount : ₹{formatNumber(erpTotals.discountAmount)}</div>
            <div>Taxable Amt : ₹{formatNumber(erpTotals.taxable)}</div>
            <div>Exempt Amt : ₹{formatNumber(erpTotals.exemptAmount)}</div>
            {erpTotals.nilRatedAmount > 0 && <div>Nil Rated Amt : ₹{formatNumber(erpTotals.nilRatedAmount)}</div>}
            {erpTotals.zeroRatedAmount > 0 && <div>Zero Rated Amt : ₹{formatNumber(erpTotals.zeroRatedAmount)}</div>}
            {erpTotals.nonGstAmount > 0 && <div>Non-GST Amt : ₹{formatNumber(erpTotals.nonGstAmount)}</div>}
            {erpTotals.withoutTaxAmount > 0 && <div>Without Tax Amt : ₹{formatNumber(erpTotals.withoutTaxAmount)}</div>}
            <div>Total Tax : ₹{formatNumber(erpTotals.taxAmount)}</div>
            <div>Deductions : ₹{formatNumber(erpTotals.totalDeductions)}</div>
            <div className="grand-total" style={{ marginTop: '12px', fontSize: '15px', fontWeight: 'bold', color: '#1e3a8a' }}>
              Grand Total : ₹{formatNumber(erpTotals.grandTotal)}
            </div>
          </div>

        </div>

        {/* MODULAR: EntryActions - Back, Cancel, Refresh, Save */}
        <EntryActions
          onSave={handleSubmit}
          onCancel={handleCancel}
          onRefresh={handleRefresh}
          onBack={handleBack}
          saving={loading}
          saveText={id ? 'Update' : 'Save'}
          extraButtons={
            <button
              type="button"
              onClick={() => setLedgerModalOpen(true)}
              style={{
                backgroundColor: '#0f766e',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Open complete purchase-wise transaction ledger statement"
            >
              <span>📑</span>
              <span>View Ledger Details</span>
            </button>
          }
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

      {/* Inline Master Modal for Deductions */}
      <InlineMasterModal
        open={inlineDeductionOpen}
        onClose={() => setInlineDeductionOpen(false)}
        masterType="deduction_purchase"
        onSuccess={handleInlineDeductionCreated}
      />

      {/* Transport Freight Details Modal */}
      <TransportFreightDetailsModal
        isOpen={transportModalOpen}
        onClose={() => setTransportModalOpen(false)}
        voucherNo={formData.inv_no || formData.s_no ? `PUR-${formData.inv_no || formData.s_no}` : 'PUR-NEW'}
        initialData={formData}
        onSave={(tData) => {
          setFormData(prev => ({
            ...prev,
            ...tData,
            transporter: tData.transporter || prev.transporter,
            transport: tData.transporter || prev.transporter,
            vehicle_no: tData.vehicle_no || prev.vehicle_no,
            lorry_no: tData.vehicle_no || prev.vehicle_no,
            driver_name: tData.driver_name || prev.driver_name,
            driver: tData.driver_name || prev.driver_name,
            driver_mobile: tData.driver_mobile || prev.driver_mobile,
            transport_charges: tData.freight_amount || prev.transport_charges,
            freight_amount: tData.freight_amount || prev.freight_amount,
            advance_amount: tData.advance_amount || 0,
            mamool_amount: tData.mamool_amount || 0,
            weight_cash: tData.weight_cash || 0,
            other_additional_charges: tData.other_additional_charges || 0,
            other_deductions: tData.other_deductions || 0,
            net_transport_amount: tData.net_transport_amount || 0,
            transport_payable_type: tData.transport_payable_type || prev.transport_payable_type || 'SEPARATE'
          }));
        }}
      />

      {/* Controlled Post-Unloading Tare Weight Entry Modal */}
      <WeightEntryModal
        isOpen={weightModalOpen}
        onClose={() => setWeightModalOpen(false)}
        voucherNo={formData.inv_no || formData.s_no ? `PUR-${formData.inv_no || formData.s_no}` : 'PUR-NEW'}
        purchaseId={id || null}
        initialData={{
          gross_weight: formData.gross_weight || erpTotals.totalWeight || 0,
          tare_weight: formData.tare_weight || 0,
          net_weight: formData.net_weight || 0,
          weighbridge_location: formData.weighbridge_location || 'Main Factory',
          unloading_date: formData.unloading_date || formData.date,
          unloading_time: formData.unloading_time || '',
          weighment_ref_no: formData.weighment_ref_no || '',
          operator_name: formData.operator_name || ''
        }}
        onSave={(wData) => {
          setFormData(prev => ({
            ...prev,
            gross_weight: wData.gross_weight,
            tare_weight: wData.tare_weight,
            net_weight: wData.net_weight,
            weighbridge_location: wData.weighbridge_location,
            unloading_date: wData.unloading_date,
            unloading_time: wData.unloading_time,
            weighment_ref_no: wData.weighment_ref_no,
            operator_name: wData.operator_name,
            weight_status: wData.weight_status
          }));
        }}
      />

      {/* Purchase-wise Transaction Ledger Details Modal */}
      <PurchaseLedgerDetailsModal
        isOpen={ledgerModalOpen}
        onClose={() => setLedgerModalOpen(false)}
        purchaseId={id}
        purchaseData={{
          formData,
          items: validItems,
          totals: erpTotals,
          deductions: selectedDeductions
        }}
      />
    </div>
  )
}

export default PurchaseCreation
