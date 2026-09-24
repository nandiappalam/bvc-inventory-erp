import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './PurchaseReturn.css';
import { getMasters } from '../services/masterservice.js';
import api from '../services/api.js';

// Predefined return reasons for business compliance & audit trail
const RETURN_REASONS = [
  'Quality parameters out of specification (QC Rejection)',
  'Incoming Quality Report (IQR) not accepted',
  'Quality Hold: Material quarantined pending re-test / return',
  'Material rejected at gate / not unloaded due to discrepancies',
  'Inward approval rejected / authorization pending',
  'Lab inspection not performed / returned prior to verification',
  'Physical damage during transit / handling',
  'Packaging defect / Bags torn or contaminated',
  'Incorrect / Wrong material supplied by vendor',
  'Excess delivery / Over-shipment beyond purchase order',
  'Near expiry / Expiry date violation',
  'Commercial agreement / Price dispute return',
  'Supplier initiated product recall',
  'Other / Custom reason (specified in remarks)'
];

const PurchaseReturn = () => {
  const navigate = useNavigate();

  // Unified Workflow State: Two Entry Sources
  // 'QC_IQR': Method A — Quality / Inspection Exception (QC Rejected, QC Hold, Not Unloaded, Not Approved, Lab Pending)
  // 'MANUAL': Method B — Manual Purchase Return by Invoice Received & RM Item Dropdown
  const [returnMethod, setReturnMethod] = useState('QC_IQR');

  // Method A State: Candidates from Quality / Inspection Exceptions
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidateFilter, setCandidateFilter] = useState('');
  const [candidateCategoryTab, setCandidateCategoryTab] = useState('ALL');

  // Method B State: Available Purchase Invoices & RM Items
  const [availableInvoices, setAvailableInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [selectedPurchaseRef, setSelectedPurchaseRef] = useState('');
  const [purchaseItemsAvailable, setPurchaseItemsAvailable] = useState([]);
  const [selectedRmItemToReturn, setSelectedRmItemToReturn] = useState('');
  const [supplierList, setSupplierList] = useState([]);
  const [supplierFilter, setSupplierFilter] = useState('');

  // Document Header Form State
  const [formData, setFormData] = useState({
    sNo: 1,
    date: new Date().toISOString().substring(0, 10),
    returnInvNo: '',
    supplier: '',
    supplierName: '',
    supplierAddress: '',
    supplierGstin: '',
    payType: 'Credit',
    invDate: new Date().toISOString().substring(0, 10),
    type: 'Urad',
    address: '',
    taxType: 'Exclusive',
    godown: 'Main Godown',
    remarks: '',
    // Full Genealogy Chain
    purchaseId: '',
    purchaseInvNo: '',
    poNo: '',
    qcNo: '',
    qcDate: '',
    qcStatus: '',
    inspector: '',
    iqrNo: ''
  });

  // Return Line Items
  const [items, setItems] = useState([
    {
      id: 1,
      purchase_item_id: null,
      item_name: '',
      item_id: null,
      lot_no: '',
      purchased_qty: 0,
      accepted_qty: 0,
      rejected_qty: 0,
      previously_returned_qty: 0,
      available_return_qty: 0,
      weight: 50,
      qty: '',
      total_wt: 0,
      rate: '',
      disc: 0,
      tax: 0,
      amount: 0,
      reason: 'Quality parameters out of specification (QC Rejection)'
    }
  ]);

  // Deductions
  const [masterDeductions, setMasterDeductions] = useState([]);
  const [selectedDeductions, setSelectedDeductions] = useState([]);

  // Totals
  const [totals, setTotals] = useState({
    totalQty: 0,
    totalWeight: 0,
    totalAmount: 0,
    baseAmount: 0,
    discAmount: 0,
    taxAmount: 0,
    netAmount: 0,
    addDeductions: 0,
    lessDeductions: 0,
    grandTotal: 0
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [isEditMode, setIsEditMode] = useState(false);

  // Recalculate totals and line deductions
  const recalculateAll = useCallback((currentItems = items, currentDeductions = selectedDeductions) => {
    let totalQty = 0;
    let totalWeight = 0;
    let totalAmount = 0;
    let baseAmount = 0;
    let discAmount = 0;
    let taxAmount = 0;

    currentItems.forEach(item => {
      const q = parseFloat(item.qty) || 0;
      const w = parseFloat(item.weight) || 0;
      const r = parseFloat(item.rate) || 0;
      const d = parseFloat(item.disc) || 0;
      const t = parseFloat(item.tax) || 0;

      const totWt = parseFloat(item.total_wt ?? (q * w)) || 0;
      const lineBase = q * r;
      const lineDisc = (lineBase * d) / 100;
      const lineTax = ((lineBase - lineDisc) * t) / 100;
      const lineAmt = lineBase - lineDisc + lineTax;

      totalQty += q;
      totalWeight += totWt;
      baseAmount += lineBase;
      discAmount += lineDisc;
      taxAmount += lineTax;
      totalAmount += lineAmt;
    });

    let addTotal = 0;
    let lessTotal = 0;

    const updatedDeds = (currentDeductions || []).map(ded => {
      let dedAmt = parseFloat(ded.amount) || 0;
      const pct = parseFloat(ded.percent ?? ded.percentage ?? 0) || 0;
      const calcType = String(ded.calculation_type || ded.calc_type || 'Percentage').toLowerCase();

      if (pct > 0) {
        if (calcType.includes('percent') || calcType === 'percentage') {
          dedAmt = (totalAmount * pct) / 100;
        } else {
          dedAmt = pct;
        }
      }

      const dType = String(ded.type || 'LESS').toUpperCase();
      if (dType === 'ADD' || dType === 'PLUS') {
        addTotal += dedAmt;
      } else {
        lessTotal += dedAmt;
      }

      return { ...ded, amount: dedAmt, percent: pct, percentage: pct };
    });

    const grandTotal = totalAmount + addTotal - lessTotal;

    setSelectedDeductions(updatedDeds);
    setTotals({
      totalQty,
      totalWeight,
      totalAmount,
      baseAmount,
      discAmount,
      taxAmount,
      netAmount: totalAmount,
      addDeductions: addTotal,
      lessDeductions: lessTotal,
      grandTotal
    });
  }, [items, selectedDeductions]);

  // Initial Data Fetching
  useEffect(() => {
    // 1. Fetch next sequential S.No
    api('/purchase-returns/next-sno')
      .then(res => {
        if (res?.s_no || res?.data?.s_no) {
          const nextNo = res.s_no || res.data.s_no;
          setFormData(prev => ({
            ...prev,
            sNo: nextNo,
            returnInvNo: prev.returnInvNo || `PR-${new Date().getFullYear()}-${String(nextNo).padStart(4, '0')}`
          }));
        }
      })
      .catch(() => {});

    // 2. Load deduction masters
    getMasters('deduction_purchase')
      .then(res => {
        if (Array.isArray(res)) setMasterDeductions(res);
      })
      .catch(() => {
        getMasters('deduction_sales').then(res => {
          if (Array.isArray(res)) setMasterDeductions(res);
        }).catch(() => {});
      });

    // 3. Load suppliers
    getMasters('supplier')
      .then(res => {
        if (Array.isArray(res)) setSupplierList(res);
      })
      .catch(() => {});

    // 4. Fetch QC/IQR rejection candidates
    loadCandidates();

    // 5. Fetch available purchase invoices for manual return
    loadAvailableInvoices();
  }, []);

  const loadCandidates = async () => {
    setCandidatesLoading(true);
    try {
      const data = await api('/purchase-returns/candidates');
      if (Array.isArray(data)) {
        setCandidates(data);
      }
    } catch (err) {
      console.error('Error fetching candidates:', err);
    } finally {
      setCandidatesLoading(false);
    }
  };

  const loadAvailableInvoices = async (supplierId = '') => {
    setInvoicesLoading(true);
    try {
      const url = supplierId 
        ? `/purchase-returns/invoices-for-return?supplier_id=${encodeURIComponent(supplierId)}`
        : '/purchase-returns/invoices-for-return';
      const data = await api(url);
      if (Array.isArray(data)) {
        setAvailableInvoices(data);
      }
    } catch (err) {
      console.error('Error fetching available invoices:', err);
    } finally {
      setInvoicesLoading(false);
    }
  };

  // Handle URL parameters (Edit mode or Deep link from QC / Lab Testing)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editId = params.get('id');
    const sourceParam = params.get('source');
    const urlLotNo = params.get('lotNo');
    const urlPurchaseId = params.get('purchaseId');

    if (editId) {
      setIsEditMode(true);
      // Load existing purchase return for editing
      api(`/purchase-returns/${editId}`).then(data => {
        if (data && !data.error) {
          const isQc = data.source === 'QC_REJECTION' || data.source === 'IQR_REJECTION' || data.source === 'QUALITY_HOLD';
          setReturnMethod(isQc ? 'QC_IQR' : 'MANUAL');

          setFormData({
            sNo: data.s_no || editId,
            date: data.date ? data.date.substring(0, 10) : new Date().toISOString().substring(0, 10),
            returnInvNo: data.return_inv_no || '',
            supplier: String(data.supplier || ''),
            supplierName: data.supplier_print_name || data.supplier_name || '',
            supplierAddress: data.supplier_address || data.address || '',
            supplierGstin: data.supplier_gstin || '',
            payType: data.pay_type || 'Credit',
            invDate: data.inv_date ? data.inv_date.substring(0, 10) : new Date().toISOString().substring(0, 10),
            type: data.type || 'Urad',
            address: data.address || '',
            taxType: data.tax_type || 'Exclusive',
            godown: data.godown || 'Main Godown',
            remarks: data.remarks || '',
            purchaseId: data.purchase_id || '',
            purchaseInvNo: data.purchase_inv_no || '',
            poNo: data.po_no || '',
            qcNo: data.qc_no || '',
            qcDate: data.qc_date ? String(data.qc_date).substring(0, 10) : '',
            qcStatus: isQc ? 'REJECTED' : '',
            inspector: data.inspector || '',
            iqrNo: data.iqr_no || ''
          });

          if (Array.isArray(data.items) && data.items.length > 0) {
            const mappedItems = data.items.map((it, idx) => {
              const q = parseFloat(it.qty) || 0;
              const w = parseFloat(it.weight) || 50;
              const r = parseFloat(it.rate) || 0;
              const d = parseFloat(it.disc_percent ?? it.disc) || 0;
              const t = parseFloat(it.tax_percent ?? it.tax) || 0;
              const totWt = parseFloat(it.total_wt ?? (q * w)) || 0;
              const lineBase = q * r;
              const lineDisc = (lineBase * d) / 100;
              const lineTax = ((lineBase - lineDisc) * t) / 100;
              const lineAmt = lineBase - lineDisc + lineTax;

              return {
                id: idx + 1,
                purchase_item_id: it.purchase_item_id || null,
                item_name: it.item_name || '',
                item_id: it.item_id || null,
                lot_no: it.lot_no || '',
                purchased_qty: parseFloat(it.purchased_qty) || q,
                accepted_qty: parseFloat(it.accepted_qty) || 0,
                rejected_qty: parseFloat(it.rejected_qty) || 0,
                previously_returned_qty: parseFloat(it.previously_returned_qty) || 0,
                available_return_qty: parseFloat(it.available_qty) || q,
                weight: w,
                qty: String(q),
                total_wt: totWt,
                rate: String(r),
                disc: d,
                tax: t,
                amount: lineAmt,
                reason: it.reason || 'Returned to supplier'
              };
            });
            setItems(mappedItems);

            if (Array.isArray(data.deductions)) {
              const mappedDeds = data.deductions.map(d => ({
                deduction_id: d.deduction_id || d.id,
                name: d.deduction_name || d.name || 'Deduction',
                type: String(d.type || 'LESS').toUpperCase(),
                calculation_type: d.calculation_type || 'Percentage',
                percent: parseFloat(d.percentage ?? d.percent ?? 0) || 0,
                amount: parseFloat(d.amount) || 0
              }));
              setSelectedDeductions(mappedDeds);
              recalculateAll(mappedItems, mappedDeds);
            } else {
              recalculateAll(mappedItems, []);
            }
          }
        }
      });
    } else if (sourceParam === 'qc' || urlLotNo) {
      // Auto-switch to Method A and search for the candidate lot
      setReturnMethod('QC_IQR');
      if (urlLotNo) {
        api('/purchase-returns/candidates').then(data => {
          if (Array.isArray(data)) {
            setCandidates(data);
            const found = data.find(c => c.lot_no === urlLotNo);
            if (found) {
              handleSelectCandidate(found);
            }
          }
        });
      }
    } else if (urlPurchaseId) {
      // Auto-switch to Method B and load the purchase chain
      setReturnMethod('MANUAL');
      setSelectedPurchaseRef(urlPurchaseId);
      handleSelectPurchase(urlPurchaseId);
    }
  }, []);

  // METHOD A: Handle Selecting a QC / Inspection Exception Candidate
  const handleSelectCandidate = async (candidate) => {
    if (!candidate) return;
    setSelectedCandidateId(candidate.candidate_id || candidate.lot_no);

    const received = parseFloat(candidate.received_qty) || 0;
    const prevReturned = parseFloat(candidate.previously_returned_qty) || 0;
    const eligible = parseFloat(candidate.eligible_return_qty) || Math.max(0, received - prevReturned);

    const initialFormData = {
      supplier: String(candidate.supplier_id || ''),
      supplierName: candidate.supplier_print_name || candidate.supplier_name || 'Vendor',
      supplierAddress: candidate.supplier_address || '',
      supplierGstin: candidate.supplier_gstin || '',
      address: candidate.supplier_address || '',
      payType: candidate.pay_type || 'Credit',
      taxType: candidate.tax_type || 'Exclusive',
      godown: candidate.godown || 'Main Godown',
      invDate: candidate.inv_date || candidate.received_date || new Date().toISOString().substring(0, 10),
      purchaseId: String(candidate.purchase_id || ''),
      purchaseInvNo: candidate.purchase_inv_no || candidate.inv_no || '',
      poNo: candidate.po_no || '',
      qcNo: candidate.qc_no || '',
      qcDate: candidate.qc_date || '',
      inspector: candidate.inspector || '',
      iqrNo: candidate.iqr_no || '',
      qcStatus: candidate.qc_status || candidate.overall_result || candidate.status_badge || 'EXCEPTION',
      remarks: `${candidate.status_badge || 'Quality'} Return: Lot ${candidate.lot_no || ''} (${candidate.reason || 'Quality exception'}). Originating Inv #${candidate.purchase_inv_no || candidate.purchase_id || '-'}`
    };

    setFormData(prev => ({
      ...prev,
      ...initialFormData,
      returnInvNo: prev.returnInvNo || `DN-${new Date().getFullYear()}-${String(prev.sNo || 1).padStart(4, '0')}`
    }));

    const w = parseFloat(candidate.weight) || 50;
    const r = parseFloat(candidate.rate) || 0;
    const d = parseFloat(candidate.disc) || 0;
    const t = parseFloat(candidate.tax) || 0;

    const totWt = eligible * w;
    const lineBase = eligible * r;
    const lineDisc = (lineBase * d) / 100;
    const lineTax = ((lineBase - lineDisc) * t) / 100;
    const lineAmt = lineBase - lineDisc + lineTax;

    const newItem = {
      id: 1,
      purchase_item_id: candidate.purchase_item_id || null,
      item_name: candidate.item_name || 'Raw Material',
      item_id: candidate.item_id || null,
      lot_no: candidate.lot_no || '',
      purchased_qty: received,
      accepted_qty: candidate.accepted_qty || 0,
      rejected_qty: candidate.rejected_qty || received,
      previously_returned_qty: prevReturned,
      available_return_qty: eligible,
      weight: w,
      qty: String(eligible),
      total_wt: totWt,
      rate: String(r),
      disc: d,
      tax: t,
      amount: lineAmt,
      reason: candidate.reason || 'Quality parameters out of specification (QC Rejection)'
    };

    setItems([newItem]);
    recalculateAll([newItem], selectedDeductions);

    // If purchase ID is known, asynchronously enrich with additional purchase chain metadata
    if (candidate.purchase_id || candidate.purchase_inv_no) {
      try {
        const pRef = candidate.purchase_id || candidate.purchase_inv_no;
        const chainRes = await api(`/purchase-returns/purchase-chain/${encodeURIComponent(pRef)}`);
        if (chainRes?.success && chainRes.purchase) {
          const cp = chainRes.purchase;
          setFormData(prev => ({
            ...prev,
            supplier: prev.supplier || String(cp.supplier || ''),
            supplierName: prev.supplierName && prev.supplierName !== 'Vendor' ? prev.supplierName : (cp.supplier_print_name || cp.supplier_name || prev.supplierName),
            supplierAddress: prev.supplierAddress || cp.supplier_address || cp.address || '',
            supplierGstin: prev.supplierGstin || cp.supplier_gstin || '',
            poNo: prev.poNo && prev.poNo !== '-' ? prev.poNo : (cp.resolved_po_no || cp.po_no || ''),
            godown: prev.godown && prev.godown !== 'Main Godown' ? prev.godown : (cp.godown_name || cp.godown || 'Main Godown')
          }));

          // If deductions exist from the purchase, offer them
          if (Array.isArray(chainRes.deductions) && chainRes.deductions.length > 0 && selectedDeductions.length === 0) {
            const mapped = chainRes.deductions.map(cd => ({
              deduction_id: cd.id,
              name: cd.name,
              type: String(cd.type || 'LESS').toUpperCase(),
              calculation_type: cd.calculation_type || 'Percentage',
              percent: parseFloat(cd.percent || 0),
              amount: parseFloat(cd.amount || 0)
            }));
            setSelectedDeductions(mapped);
            recalculateAll([newItem], mapped);
          }
        }
      } catch (e) {
        console.warn('Could not enrich candidate purchase chain:', e);
      }
    }
  };

  // METHOD B: Handle Selecting a Purchase Invoice
  const handleSelectPurchase = async (purchaseRef) => {
    setSelectedPurchaseRef(purchaseRef);
    setSelectedRmItemToReturn('');
    if (!purchaseRef) {
      setPurchaseItemsAvailable([]);
      return;
    }

    setLoading(true);
    try {
      const res = await api(`/purchase-returns/purchase-chain/${encodeURIComponent(purchaseRef)}`);
      if (res?.success && res.purchase) {
        const p = res.purchase;
        const chainItems = res.items || [];

        setPurchaseItemsAvailable(chainItems);

        setFormData(prev => ({
          ...prev,
          supplier: String(p.supplier || p.supplier_id || ''),
          supplierName: p.supplier_print_name || p.supplier_name || '',
          supplierAddress: p.supplier_address || p.address || '',
          supplierGstin: p.supplier_gstin || '',
          address: p.supplier_address || p.address || '',
          payType: p.pay_type || 'Credit',
          taxType: p.tax_type || 'Exclusive',
          godown: p.godown_name || p.godown || 'Main Godown',
          invDate: p.resolved_inv_date ? String(p.resolved_inv_date).substring(0, 10) : prev.invDate,
          purchaseId: String(p.id),
          purchaseInvNo: p.resolved_inv_no || p.inv_no || '',
          poNo: p.resolved_po_no || p.po_no || '',
          remarks: `Manual Purchase Return against Inv #${p.resolved_inv_no || p.inv_no}`
        }));

        // Automatically populate the first available item if present
        const eligibleFirst = chainItems.find(it => it.available_return_qty > 0) || chainItems[0];
        if (eligibleFirst) {
          const q = eligibleFirst.available_return_qty > 0 ? eligibleFirst.available_return_qty : 0;
          const w = parseFloat(eligibleFirst.weight) || 50;
          const r = parseFloat(eligibleFirst.rate) || 0;
          const d = parseFloat(eligibleFirst.disc_percent) || 0;
          const t = parseFloat(eligibleFirst.tax_percent) || 0;

          const totWt = q * w;
          const lineBase = q * r;
          const lineDisc = (lineBase * d) / 100;
          const lineTax = ((lineBase - lineDisc) * t) / 100;
          const lineAmt = lineBase - lineDisc + lineTax;

          const firstItem = {
            id: 1,
            purchase_item_id: eligibleFirst.purchase_item_id || eligibleFirst.id,
            item_name: eligibleFirst.item_name,
            item_id: eligibleFirst.item_id,
            lot_no: eligibleFirst.lot_no || '',
            purchased_qty: eligibleFirst.purchased_qty,
            accepted_qty: eligibleFirst.accepted_qty,
            rejected_qty: eligibleFirst.rejected_qty,
            previously_returned_qty: eligibleFirst.previously_returned_qty,
            available_return_qty: eligibleFirst.available_return_qty,
            weight: w,
            qty: String(q),
            total_wt: totWt,
            rate: String(r),
            disc: d,
            tax: t,
            amount: lineAmt,
            reason: eligibleFirst.is_qc_hold 
              ? 'Quality Hold: Material quarantined pending re-test / return' 
              : eligibleFirst.is_qc_rejected 
              ? 'Quality parameters out of specification (QC Rejection)' 
              : 'Physical damage during transit / handling'
          };
          setItems([firstItem]);
          recalculateAll([firstItem], selectedDeductions);
          setSelectedRmItemToReturn(String(eligibleFirst.purchase_item_id || eligibleFirst.id));
        } else {
          setItems([]);
          recalculateAll([], selectedDeductions);
        }
      } else {
        setMessage(res?.message || 'Could not load purchase details.');
        setMessageType('error');
      }
    } catch (err) {
      console.error('Error fetching purchase chain:', err);
      setMessage('Failed to load purchase details: ' + err.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  // METHOD B: Direct RM Item Selection from the Invoice Dropdown
  const handleSelectRmItemFromDropdown = (itemIdOrRef) => {
    setSelectedRmItemToReturn(itemIdOrRef);
    if (!itemIdOrRef) return;

    const matched = purchaseItemsAvailable.find(pi => 
      String(pi.purchase_item_id || pi.id) === String(itemIdOrRef) ||
      pi.lot_no === itemIdOrRef
    );
    if (!matched) return;

    const q = matched.available_return_qty > 0 ? matched.available_return_qty : 0;
    const w = parseFloat(matched.weight) || 50;
    const r = parseFloat(matched.rate) || 0;
    const d = parseFloat(matched.disc_percent) || 0;
    const t = parseFloat(matched.tax_percent) || 0;

    const totWt = q * w;
    const lineBase = q * r;
    const lineDisc = (lineBase * d) / 100;
    const lineTax = ((lineBase - lineDisc) * t) / 100;
    const lineAmt = lineBase - lineDisc + lineTax;

    const newItem = {
      id: 1,
      purchase_item_id: matched.purchase_item_id || matched.id,
      item_name: matched.item_name,
      item_id: matched.item_id,
      lot_no: matched.lot_no || '',
      purchased_qty: matched.purchased_qty,
      accepted_qty: matched.accepted_qty,
      rejected_qty: matched.rejected_qty,
      previously_returned_qty: matched.previously_returned_qty,
      available_return_qty: matched.available_return_qty,
      weight: w,
      qty: String(q),
      total_wt: totWt,
      rate: String(r),
      disc: d,
      tax: t,
      amount: lineAmt,
      reason: matched.is_qc_hold 
        ? 'Quality Hold: Material quarantined pending re-test / return' 
        : matched.is_qc_rejected 
        ? 'Quality parameters out of specification (QC Rejection)' 
        : 'Physical damage during transit / handling'
    };

    setFormData(prev => ({
      ...prev,
      qcNo: matched.qc_no || prev.qcNo,
      iqrNo: matched.iqr_no || prev.iqrNo,
      qcStatus: matched.qc_status || prev.qcStatus
    }));

    setItems([newItem]);
    recalculateAll([newItem], selectedDeductions);
  };

  // Add another item from the invoice
  const handleAddAdditionalItemFromInvoice = (purchaseItemId) => {
    const matched = purchaseItemsAvailable.find(pi => String(pi.purchase_item_id || pi.id) === String(purchaseItemId));
    if (!matched) return;

    const q = matched.available_return_qty > 0 ? matched.available_return_qty : 0;
    const w = parseFloat(matched.weight) || 50;
    const r = parseFloat(matched.rate) || 0;
    const d = parseFloat(matched.disc_percent) || 0;
    const t = parseFloat(matched.tax_percent) || 0;

    const totWt = q * w;
    const lineBase = q * r;
    const lineDisc = (lineBase * d) / 100;
    const lineTax = ((lineBase - lineDisc) * t) / 100;
    const lineAmt = lineBase - lineDisc + lineTax;

    const nextId = Math.max(...items.map(it => it.id), 0) + 1;
    const newRow = {
      id: nextId,
      purchase_item_id: matched.purchase_item_id || matched.id,
      item_name: matched.item_name,
      item_id: matched.item_id,
      lot_no: matched.lot_no || '',
      purchased_qty: matched.purchased_qty,
      accepted_qty: matched.accepted_qty,
      rejected_qty: matched.rejected_qty,
      previously_returned_qty: matched.previously_returned_qty,
      available_return_qty: matched.available_return_qty,
      weight: w,
      qty: String(q),
      total_wt: totWt,
      rate: String(r),
      disc: d,
      tax: t,
      amount: lineAmt,
      reason: 'Physical damage during transit / handling'
    };

    setItems(prev => {
      const updated = [...prev, newRow];
      recalculateAll(updated, selectedDeductions);
      return updated;
    });
  };

  // Line item value change handler with strict over-return enforcement
  const handleItemFieldChange = (index, field, value) => {
    setItems(prev => {
      const updated = [...prev];
      const row = { ...updated[index], [field]: value };

      if (field === 'qty') {
        const numQty = parseFloat(value) || 0;
        const avail = parseFloat(row.available_return_qty) || 0;

        if (numQty > avail && avail > 0) {
          row.overReturnError = `Cannot exceed available quantity (${avail.toFixed(2)})`;
        } else {
          row.overReturnError = null;
        }
      }

      const q = parseFloat(row.qty) || 0;
      const w = parseFloat(row.weight) || 0;
      const r = parseFloat(row.rate) || 0;
      const d = parseFloat(row.disc) || 0;
      const t = parseFloat(row.tax) || 0;

      const totWt = q * w;
      const lineBase = q * r;
      const lineDisc = (lineBase * d) / 100;
      const lineTax = ((lineBase - lineDisc) * t) / 100;
      const lineAmt = lineBase - lineDisc + lineTax;

      row.total_wt = totWt;
      row.amount = lineAmt;

      updated[index] = row;
      recalculateAll(updated, selectedDeductions);
      return updated;
    });
  };

  const removeItemRow = (index) => {
    if (items.length <= 1) return;
    setItems(prev => {
      const updated = prev.filter((_, i) => i !== index);
      recalculateAll(updated, selectedDeductions);
      return updated;
    });
  };

  // Deductions handling
  const handleDeductionChange = (idx, field, value) => {
    const updated = [...selectedDeductions];
    const ded = { ...updated[idx] };
    const numVal = parseFloat(value) || 0;

    if (field === 'percent') {
      ded.percent = numVal;
      ded.percentage = numVal;
      ded.amount = (totals.totalAmount * numVal) / 100;
    } else if (field === 'amount') {
      ded.amount = numVal;
      if (totals.totalAmount > 0) {
        const pct = (numVal / totals.totalAmount) * 100;
        ded.percent = parseFloat(pct.toFixed(2));
        ded.percentage = parseFloat(pct.toFixed(2));
      }
    } else if (field === 'type') {
      ded.type = value;
    }

    updated[idx] = ded;
    recalculateAll(items, updated);
  };

  const addDeductionRow = () => {
    const newDed = {
      deduction_id: null,
      name: 'Custom Adjustment',
      type: 'LESS',
      calculation_type: 'Percentage',
      percent: 0,
      amount: 0
    };
    const updated = [...selectedDeductions, newDed];
    setSelectedDeductions(updated);
    recalculateAll(items, updated);
  };

  const removeDeductionRow = (idx) => {
    const updated = selectedDeductions.filter((_, i) => i !== idx);
    setSelectedDeductions(updated);
    recalculateAll(items, updated);
  };

  // Filtered Candidates for Method A Search & Category Tabs
  const filteredCandidates = useMemo(() => {
    let list = candidates;
    if (candidateCategoryTab !== 'ALL') {
      list = list.filter(c => c.status_category === candidateCategoryTab);
    }
    const s = candidateFilter.toLowerCase().trim();
    if (!s) return list;
    return list.filter(c => 
      String(c.lot_no || '').toLowerCase().includes(s) ||
      String(c.item_name || '').toLowerCase().includes(s) ||
      String(c.supplier_name || '').toLowerCase().includes(s) ||
      String(c.purchase_inv_no || '').toLowerCase().includes(s) ||
      String(c.qc_no || '').toLowerCase().includes(s)
    );
  }, [candidates, candidateFilter, candidateCategoryTab]);

  // Form Save Handler
  const handleSave = async () => {
    setMessage('');

    if (!formData.supplier) {
      setMessage('Please select or specify a Supplier.');
      setMessageType('error');
      return;
    }

    if (returnMethod === 'MANUAL' && !formData.purchaseInvNo && !formData.purchaseId) {
      setMessage('A valid originating Purchase Invoice is required for a Purchase Return.');
      setMessageType('error');
      return;
    }

    if (!items || items.length === 0) {
      setMessage('Please add at least one item to return.');
      setMessageType('error');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const q = parseFloat(it.qty) || 0;
      if (q <= 0) {
        setMessage(`Row #${i + 1} (${it.item_name || 'Item'}): Return quantity must be greater than zero.`);
        setMessageType('error');
        return;
      }
      const avail = parseFloat(it.available_return_qty) || 0;
      if (avail > 0 && q > avail + 0.001) {
        setMessage(`Row #${i + 1} (${it.item_name || 'Item'}): Return quantity (${q}) exceeds the available return quantity of ${avail.toFixed(2)}.`);
        setMessageType('error');
        return;
      }
    }

    setLoading(true);

    try {
      const payload = {
        formData: {
          ...formData,
          returnMethod,
          purchaseId: formData.purchaseId,
          purchaseInvNo: formData.purchaseInvNo,
          poNo: formData.poNo,
          qcNo: formData.qcNo,
          iqrNo: formData.iqrNo
        },
        items,
        totals,
        deductions: selectedDeductions
      };

      let res;
      if (isEditMode) {
        const params = new URLSearchParams(window.location.search);
        const editId = params.get('id');
        res = await api(`/purchase-returns/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await api('/purchase-returns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (res?.success) {
        setMessage(res.message || 'Purchase return saved successfully!');
        setMessageType('success');
        setTimeout(() => {
          navigate('/entry/purchase-return-display');
        }, 1200);
      } else {
        setMessage(res?.message || 'Error saving purchase return.');
        setMessageType('error');
      }
    } catch (err) {
      console.error('Error in handleSave:', err);
      setMessage('Server error saving purchase return: ' + err.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pr-container">
      {/* Header Bar */}
      <div className="pr-header-bar">
        <div>
          <h1 className="pr-header-title">
            {isEditMode ? 'Edit Purchase Return / Debit Note' : 'Create Purchase Return / Debit Note'}
          </h1>
          <div className="pr-header-sub">
            Dual-Source Workflow: Linked directly to Originating Purchase Invoice, QC Inspections, and Inward Reports
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={() => navigate('/entry/purchase-return-display')}
            className="pr-btn pr-btn-secondary"
            style={{ height: '38px', fontSize: '13px' }}
          >
            ← Return Register
          </button>
        </div>
      </div>

      {/* Global Alert Message */}
      {message && (
        <div style={{ maxWidth: '1440px', margin: '16px auto', padding: '0 20px' }}>
          <div className={`pr-message ${messageType === 'error' ? 'pr-message-error' : 'pr-message-success'}`}>
            <span>{message}</span>
            <button
              type="button"
              onClick={() => setMessage('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '16px 20px' }}>
        
        {/* ========================================================================= */}
        {/* 1. ENTRY SOURCE / METHOD TOGGLE */}
        {/* ========================================================================= */}
        <div className="pr-card">
          <div className="pr-section-title">
            <span>1. Select Return Entry Mode</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {/* Method A Card */}
            <div
              onClick={() => setReturnMethod('QC_IQR')}
              style={{
                border: returnMethod === 'QC_IQR' ? '2.5px solid #1e3a8a' : '1.5px solid #cbd5e1',
                backgroundColor: returnMethod === 'QC_IQR' ? '#eff6ff' : '#ffffff',
                borderRadius: '8px',
                padding: '16px',
                cursor: 'pointer',
                transition: 'all 0.15s ease-in-out',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}
            >
              <input
                type="radio"
                name="returnMethod"
                value="QC_IQR"
                checked={returnMethod === 'QC_IQR'}
                onChange={() => setReturnMethod('QC_IQR')}
                style={{ width: '20px', height: '20px', marginTop: '2px', accentColor: '#1e3a8a' }}
              />
              <div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: returnMethod === 'QC_IQR' ? '#1e3a8a' : '#1e293b' }}>
                  Method A — Quality / Inspection Exception
                </div>
                <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px', lineHeight: '1.4' }}>
                  Returns triggered by <strong>QC Rejected</strong>, <strong>QC Hold</strong>, <strong>IQR Discrepancies</strong>, <strong>Pending Unloading</strong>, <strong>Not Approved</strong>, or <strong>Lab Pending</strong> items. Auto-populates all records with zero retyping.
                </div>
                <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <span className="pr-status-badge pr-badge-red">QC Rejected</span>
                  <span className="pr-status-badge pr-badge-amber">QC Hold</span>
                  <span className="pr-status-badge pr-badge-purple">Not Unloaded</span>
                  <span className="pr-status-badge pr-badge-rose">Not Approved</span>
                  <span className="pr-status-badge pr-badge-slate">Lab Pending</span>
                </div>
              </div>
            </div>

            {/* Method B Card */}
            <div
              onClick={() => setReturnMethod('MANUAL')}
              style={{
                border: returnMethod === 'MANUAL' ? '2.5px solid #1e3a8a' : '1.5px solid #cbd5e1',
                backgroundColor: returnMethod === 'MANUAL' ? '#eff6ff' : '#ffffff',
                borderRadius: '8px',
                padding: '16px',
                cursor: 'pointer',
                transition: 'all 0.15s ease-in-out',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}
            >
              <input
                type="radio"
                name="returnMethod"
                value="MANUAL"
                checked={returnMethod === 'MANUAL'}
                onChange={() => setReturnMethod('MANUAL')}
                style={{ width: '20px', height: '20px', marginTop: '2px', accentColor: '#1e3a8a' }}
              />
              <div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: returnMethod === 'MANUAL' ? '#1e3a8a' : '#1e293b' }}>
                  Method B — Manual Return (Invoice Received & RM Items Dropdown)
                </div>
                <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px', lineHeight: '1.4' }}>
                  Select an originating Purchase Invoice received at the factory, then choose specific purchased RM items from the dropdown to return (excess stock, transit damage, commercial dispute).
                </div>
                <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <span className="pr-status-badge pr-badge-blue">Purchase Scoped</span>
                  <span className="pr-status-badge pr-badge-green">RM Item Dropdown</span>
                  <span className="pr-status-badge pr-badge-slate">Over-Return Guard</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2A. METHOD A — QC/HOLD/INSPECTION EXCEPTION ITEMS SELECTOR */}
        {/* ========================================================================= */}
        {returnMethod === 'QC_IQR' && (
          <div className="pr-card-amber">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#92400e' }}>
                  ⚠️ Quality & Inward Exception Items ({filteredCandidates.length})
                </div>
                <div style={{ fontSize: '12px', color: '#b45309', marginTop: '2px' }}>
                  Includes QC Rejected, QC Hold, Pending Unloading, Not Approved, and Lab Pending lots. Click any row to automatically load all details.
                </div>
              </div>

              {/* Search Bar */}
              <input
                type="text"
                placeholder="🔍 Search Lot, Item, Supplier, Inv #, QC #..."
                value={candidateFilter}
                onChange={(e) => setCandidateFilter(e.target.value)}
                className="pr-input"
                style={{ maxWidth: '320px', height: '38px', backgroundColor: '#ffffff' }}
              />
            </div>

            {/* Category Filter Tabs */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {[
                { key: 'ALL', label: `All Candidates (${candidates.length})` },
                { key: 'QC_REJECTED', label: 'QC Rejected' },
                { key: 'QC_HOLD', label: 'QC On Hold' },
                { key: 'NOT_UNLOADED', label: 'Not Unloaded' },
                { key: 'NOT_APPROVED', label: 'Not Approved' },
                { key: 'LAB_PENDING', label: 'Lab Pending' },
                { key: 'FACTORY_STOCK', label: 'Factory RM Stock' },
                { key: 'PROCESSED', label: 'Processed (Production)' },
                { key: 'RETURNED', label: 'Returned' }
              ].map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setCandidateCategoryTab(tab.key)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: candidateCategoryTab === tab.key ? '2px solid #b45309' : '1px solid #fcd34d',
                    backgroundColor: candidateCategoryTab === tab.key ? '#b45309' : '#ffffff',
                    color: candidateCategoryTab === tab.key ? '#ffffff' : '#78350f',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Candidates Table */}
            {candidatesLoading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#b45309', fontWeight: 'bold' }}>
                Loading quality & inspection candidates...
              </div>
            ) : filteredCandidates.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                No items found for the selected filter.
              </div>
            ) : (
              <div className="pr-table-container" style={{ maxHeight: '280px', backgroundColor: '#ffffff' }}>
                <table className="pr-table">
                  <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                    <tr>
                      <th style={{ width: '130px' }}>Status</th>
                      <th style={{ width: '130px' }}>Lot No</th>
                      <th>Item Name</th>
                      <th>Supplier</th>
                      <th style={{ width: '110px' }}>Purchase Inv #</th>
                      <th style={{ width: '90px', textAlign: 'right' }}>Received</th>
                      <th style={{ width: '100px', textAlign: 'right' }}>Avail Return</th>
                      <th>QC Inspection</th>
                      <th>IQR Ref</th>
                      <th>Reason / Discrepancy</th>
                      <th style={{ width: '120px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCandidates.map((cand, idx) => {
                      const isSelected = selectedCandidateId === (cand.candidate_id || cand.lot_no);
                      let badgeClass = 'pr-badge-slate';
                      if (cand.status_category === 'QC_REJECTED') badgeClass = 'pr-badge-red';
                      else if (cand.status_category === 'QC_HOLD') badgeClass = 'pr-badge-amber';
                      else if (cand.status_category === 'NOT_UNLOADED') badgeClass = 'pr-badge-purple';
                      else if (cand.status_category === 'NOT_APPROVED') badgeClass = 'pr-badge-rose';
                      else if (cand.status_category === 'FACTORY_STOCK') badgeClass = 'pr-badge-green';
                      else if (cand.status_category === 'PROCESSED') badgeClass = 'pr-badge-blue';
                      else if (cand.status_category === 'RETURNED') badgeClass = 'pr-badge-slate';

                      const hasAvail = (cand.eligible_return_qty || 0) > 0;

                      return (
                        <tr 
                          key={cand.candidate_id || idx}
                          onClick={() => handleSelectCandidate(cand)}
                          style={{
                            backgroundColor: isSelected ? '#fef9c3' : undefined,
                            cursor: 'pointer'
                          }}
                        >
                          <td>
                            <span className={`pr-status-badge ${badgeClass}`}>
                              {cand.status_badge || 'Exception'}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#1e3a8a' }}>
                            {cand.lot_no}
                          </td>
                          <td style={{ fontWeight: '600' }}>{cand.item_name}</td>
                          <td>{cand.supplier_print_name || cand.supplier_name}</td>
                          <td style={{ fontFamily: 'monospace' }}>{cand.purchase_inv_no || '-'}</td>
                          <td style={{ textAlign: 'right' }}>{cand.received_qty}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', color: hasAvail ? '#15803d' : '#94a3b8' }}>
                            {cand.eligible_return_qty}
                          </td>
                          <td style={{ fontSize: '12px' }}>
                            {cand.qc_no} {cand.qc_status ? `(${cand.qc_status})` : ''}
                          </td>
                          <td style={{ fontSize: '12px' }}>{cand.iqr_no || '-'}</td>
                          <td 
                            style={{ maxWidth: '280px', minWidth: '200px', whiteSpace: 'normal', fontSize: '12px', color: '#334155', lineHeight: '1.4' }}
                            title={cand.reason}
                          >
                            {cand.reason}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectCandidate(cand);
                              }}
                              className={`pr-btn ${isSelected ? 'pr-btn-primary' : 'pr-btn-secondary'}`}
                              style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}
                            >
                              {isSelected ? '✓ Loaded' : 'Select'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2B. METHOD B — MANUAL INVOICE RECEIVED & RM ITEM DROPDOWN */}
        {/* ========================================================================= */}
        {returnMethod === 'MANUAL' && (
          <div className="pr-card-highlight">
            <div className="pr-section-title" style={{ color: '#166534' }}>
              <span>2. Select Received Purchase Invoice & RM Item to Return</span>
            </div>

            <div className="pr-form-grid-3">
              {/* Filter Supplier */}
              <div className="pr-form-group">
                <label className="pr-label">Filter Invoices by Supplier (Optional)</label>
                <select
                  value={supplierFilter}
                  onChange={(e) => {
                    setSupplierFilter(e.target.value);
                    loadAvailableInvoices(e.target.value);
                  }}
                  className="pr-select"
                >
                  <option value="">-- All Suppliers --</option>
                  {supplierList.map(s => (
                    <option key={s.id} value={s.id}>{s.print_name || s.name}</option>
                  ))}
                </select>
              </div>

              {/* Select Purchase Invoice */}
              <div className="pr-form-group" style={{ gridColumn: 'span 2' }}>
                <label className="pr-label pr-label-required" style={{ color: '#166534' }}>
                  Select Received Purchase Invoice *
                </label>
                <select
                  value={selectedPurchaseRef}
                  onChange={(e) => handleSelectPurchase(e.target.value)}
                  className="pr-select"
                  style={{ border: '2px solid #16a34a', fontWeight: 'bold' }}
                >
                  <option value="">-- Choose Purchase Invoice (Inv #, Date, Supplier, Qty) --</option>
                  {availableInvoices.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      Inv #{inv.inv_no} | Date: {inv.inv_date ? String(inv.inv_date).substring(0,10) : '-'} | Supplier: {inv.supplier_print_name || inv.supplier_name} | Qty: {inv.total_qty} Bags | ₹{parseFloat(inv.grand_total || 0).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* RM Items Dropdown from Selected Invoice */}
            {purchaseItemsAvailable.length > 0 && (
              <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#ffffff', borderRadius: '6px', border: '1.5px solid #86efac' }}>
                <label className="pr-label pr-label-required" style={{ color: '#15803d', fontSize: '14px' }}>
                  Select Purchased RM Item from Invoice #{formData.purchaseInvNo} to Return:
                </label>
                
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <select
                    value={selectedRmItemToReturn}
                    onChange={(e) => handleSelectRmItemFromDropdown(e.target.value)}
                    className="pr-select"
                    style={{ flex: 1, border: '2px solid #2563eb', fontWeight: 'bold', fontSize: '14px' }}
                  >
                    <option value="">-- Select RM Item from this Purchase to Return --</option>
                    {purchaseItemsAvailable.map(pi => (
                      <option key={pi.purchase_item_id || pi.id} value={pi.purchase_item_id || pi.id}>
                        {pi.item_name} (Lot: {pi.lot_no || 'N/A'}) — Received: {pi.purchased_qty} Bags | Avail Return: {pi.available_return_qty} Bags | Rate: ₹{pi.rate} | QC: {pi.qc_status}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      if (selectedRmItemToReturn) {
                        handleAddAdditionalItemFromInvoice(selectedRmItemToReturn);
                      }
                    }}
                    disabled={!selectedRmItemToReturn}
                    className="pr-btn pr-btn-primary"
                  >
                    + Add Item to Return
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. TRACEABILITY & GENEALOGY AUDIT CARD */}
        {/* ========================================================================= */}
        {(formData.purchaseInvNo || formData.qcNo || formData.iqrNo) && (
          <div style={{
            backgroundColor: '#eff6ff',
            border: '1.5px solid #93c5fd',
            borderRadius: '8px',
            padding: '14px 18px',
            marginBottom: '20px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '24px',
            alignItems: 'center'
          }}>
            <div style={{ fontWeight: '700', color: '#1e40af', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              🧬 Live Genealogy Audit:
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Originating Purchase Inv</span>
              <strong style={{ fontSize: '13px', color: '#0f172a' }}>#{formData.purchaseInvNo || '-'}</strong>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>PO Reference</span>
              <strong style={{ fontSize: '13px', color: '#0f172a' }}>{formData.poNo || 'Direct / PO-001'}</strong>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>QC Inspection</span>
              <strong style={{ fontSize: '13px', color: '#b45309' }}>
                {formData.qcNo || 'Pending QC'} {formData.qcStatus ? `(${formData.qcStatus})` : ''}
              </strong>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>IQR Report Ref</span>
              <strong style={{ fontSize: '13px', color: '#0f172a' }}>{formData.iqrNo || 'None'}</strong>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Warehouse Godown</span>
              <strong style={{ fontSize: '13px', color: '#0f172a' }}>{formData.godown || 'Main Godown'}</strong>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 4. DOCUMENT HEADER & SUPPLIER DETAILS */}
        {/* ========================================================================= */}
        <div className="pr-card">
          <div className="pr-section-title">
            <span>3. Return Document & Supplier Details</span>
          </div>

          <div className="pr-form-grid-4">
            {/* Return S.No */}
            <div className="pr-form-group">
              <label className="pr-label">Return S.No</label>
              <input
                type="text"
                readOnly
                value={formData.sNo}
                className="pr-input"
              />
            </div>

            {/* Return Date */}
            <div className="pr-form-group">
              <label className="pr-label pr-label-required">Return Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="pr-input"
              />
            </div>

            {/* Return Inv / Debit Note No */}
            <div className="pr-form-group">
              <label className="pr-label pr-label-required">Debit Note / Return Inv No</label>
              <input
                type="text"
                value={formData.returnInvNo}
                onChange={(e) => setFormData(prev => ({ ...prev, returnInvNo: e.target.value }))}
                className="pr-input"
                style={{ fontWeight: 'bold' }}
              />
            </div>

            {/* Supplier Name */}
            <div className="pr-form-group">
              <label className="pr-label pr-label-required">Supplier</label>
              <input
                type="text"
                readOnly
                value={formData.supplierName || formData.supplier || 'Not Selected'}
                className="pr-input"
                style={{ fontWeight: 'bold', color: '#1e3a8a', backgroundColor: '#f8fafc' }}
              />
            </div>

            {/* Supplier Address */}
            <div className="pr-form-group" style={{ gridColumn: 'span 2' }}>
              <label className="pr-label">Supplier Address & GSTIN</label>
              <input
                type="text"
                readOnly
                value={`${formData.supplierAddress || ''} ${formData.supplierGstin ? `(GSTIN: ${formData.supplierGstin})` : ''}`}
                className="pr-input"
              />
            </div>

            {/* Payment Mode */}
            <div className="pr-form-group">
              <label className="pr-label">Payment Mode</label>
              <select
                value={formData.payType}
                onChange={(e) => setFormData(prev => ({ ...prev, payType: e.target.value }))}
                className="pr-select"
              >
                <option value="Credit">Credit (Debit Note Adjustment)</option>
                <option value="Cash">Cash Return</option>
              </select>
            </div>

            {/* Tax Treatment */}
            <div className="pr-form-group">
              <label className="pr-label">Tax Treatment</label>
              <select
                value={formData.taxType}
                onChange={(e) => setFormData(prev => ({ ...prev, taxType: e.target.value }))}
                className="pr-select"
              >
                <option value="Exclusive">Exclusive (GST Extra)</option>
                <option value="Inclusive">Inclusive (GST Built-in)</option>
                <option value="Without Tax">Without Tax</option>
              </select>
            </div>

            {/* Godown */}
            <div className="pr-form-group">
              <label className="pr-label">Godown / Warehouse</label>
              <input
                type="text"
                value={formData.godown}
                onChange={(e) => setFormData(prev => ({ ...prev, godown: e.target.value }))}
                className="pr-input"
              />
            </div>

            {/* Remarks */}
            <div className="pr-form-group" style={{ gridColumn: 'span 3' }}>
              <label className="pr-label">Overall Return Remarks / Ledger Narration</label>
              <input
                type="text"
                placeholder="Enter return notes or reason..."
                value={formData.remarks}
                onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                className="pr-input"
              />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 5. RETURN LINE ITEMS TABLE */}
        {/* ========================================================================= */}
        <div className="pr-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div className="pr-section-title" style={{ margin: 0 }}>
              <span>4. Return Line Items</span>
            </div>
            
            {returnMethod === 'MANUAL' && purchaseItemsAvailable.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const unused = purchaseItemsAvailable.find(pi => !items.some(it => String(it.purchase_item_id) === String(pi.purchase_item_id || pi.id))) || purchaseItemsAvailable[0];
                  if (unused) handleAddAdditionalItemFromInvoice(unused.purchase_item_id || unused.id);
                }}
                className="pr-btn pr-btn-secondary"
                style={{ height: '36px', fontSize: '13px' }}
              >
                + Add Another Item
              </button>
            )}
          </div>

          <div className="pr-table-container">
            <table className="pr-table" style={{ minWidth: '1700px' }}>
              <thead>
                <tr>
                  <th style={{ width: '45px', minWidth: '45px', textAlign: 'center' }}>#</th>
                  <th style={{ width: '220px', minWidth: '220px' }}>Item Name</th>
                  <th style={{ width: '150px', minWidth: '150px' }}>Lot No</th>
                  <th style={{ width: '95px', minWidth: '95px', textAlign: 'right' }}>Purchased</th>
                  <th style={{ width: '95px', minWidth: '95px', textAlign: 'right' }}>Accepted</th>
                  <th style={{ width: '115px', minWidth: '115px', textAlign: 'right', backgroundColor: '#1d4ed8' }}>Avail Return</th>
                  <th style={{ width: '125px', minWidth: '125px', textAlign: 'right', backgroundColor: '#15803d' }}>Return Qty *</th>
                  <th style={{ width: '95px', minWidth: '95px', textAlign: 'right' }}>Weight (kg)</th>
                  <th style={{ width: '110px', minWidth: '110px', textAlign: 'right' }}>Total Wt</th>
                  <th style={{ width: '115px', minWidth: '115px', textAlign: 'right' }}>Rate (₹)</th>
                  <th style={{ width: '85px', minWidth: '85px', textAlign: 'right' }}>Disc %</th>
                  <th style={{ width: '85px', minWidth: '85px', textAlign: 'right' }}>Tax %</th>
                  <th style={{ width: '140px', minWidth: '140px', textAlign: 'right' }}>Amount (₹)</th>
                  <th style={{ minWidth: '280px' }}>Return Reason</th>
                  <th style={{ width: '55px', minWidth: '55px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={15} style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                      No items loaded. Please choose an item from the options above.
                    </td>
                  </tr>
                ) : (
                  items.map((row, idx) => {
                    const isOver = parseFloat(row.qty) > parseFloat(row.available_return_qty) && parseFloat(row.available_return_qty) > 0;
                    return (
                      <tr key={row.id || idx}>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>

                        {/* Item Name */}
                        <td style={{ width: '220px', minWidth: '220px' }}>
                          {returnMethod === 'MANUAL' && purchaseItemsAvailable.length > 0 ? (
                            <select
                              value={row.purchase_item_id || ''}
                              onChange={(e) => {
                                const matched = purchaseItemsAvailable.find(pi => String(pi.purchase_item_id || pi.id) === String(e.target.value));
                                if (matched) {
                                  const q = matched.available_return_qty > 0 ? matched.available_return_qty : 0;
                                  handleItemFieldChange(idx, 'item_name', matched.item_name);
                                  handleItemFieldChange(idx, 'lot_no', matched.lot_no || '');
                                  handleItemFieldChange(idx, 'purchased_qty', matched.purchased_qty);
                                  handleItemFieldChange(idx, 'accepted_qty', matched.accepted_qty);
                                  handleItemFieldChange(idx, 'available_return_qty', matched.available_return_qty);
                                  handleItemFieldChange(idx, 'rate', String(matched.rate));
                                  handleItemFieldChange(idx, 'qty', String(q));
                                }
                              }}
                              className="pr-table-select"
                              style={{ fontWeight: '600' }}
                            >
                              <option value="">-- Select Item --</option>
                              {purchaseItemsAvailable.map(pi => (
                                <option key={pi.purchase_item_id || pi.id} value={pi.purchase_item_id || pi.id}>
                                  {pi.item_name} (Lot: {pi.lot_no || 'N/A'})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              readOnly
                              value={row.item_name}
                              className="pr-table-input"
                              style={{ fontWeight: '600' }}
                            />
                          )}
                        </td>

                        {/* Lot No */}
                        <td style={{ width: '150px', minWidth: '150px' }}>
                          <input
                            type="text"
                            readOnly
                            value={row.lot_no}
                            className="pr-table-input"
                            style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#1e3a8a', padding: '4px 8px' }}
                          />
                        </td>

                        {/* Purchased Qty */}
                        <td style={{ width: '95px', minWidth: '95px', textAlign: 'right', color: '#475569', fontWeight: '600' }}>
                          {parseFloat(row.purchased_qty || 0).toFixed(2)}
                        </td>

                        {/* Accepted Qty */}
                        <td style={{ width: '95px', minWidth: '95px', textAlign: 'right', color: '#475569', fontWeight: '600' }}>
                          {parseFloat(row.accepted_qty || 0).toFixed(2)}
                        </td>

                        {/* Available Return Qty */}
                        <td style={{ width: '115px', minWidth: '115px', textAlign: 'right', fontWeight: '700', color: '#1d4ed8', backgroundColor: '#eff6ff' }}>
                          {parseFloat(row.available_return_qty || 0).toFixed(2)}
                        </td>

                        {/* Return Qty Input */}
                        <td style={{ width: '125px', minWidth: '125px', textAlign: 'right', backgroundColor: isOver ? '#fee2e2' : '#f0fdf4' }}>
                          <input
                            type="number"
                            step="0.01"
                            value={row.qty}
                            onChange={(e) => handleItemFieldChange(idx, 'qty', e.target.value)}
                            className="pr-table-input"
                            style={{
                              textAlign: 'right',
                              fontWeight: '700',
                              border: isOver ? '2px solid #dc2626' : '1.5px solid #16a34a',
                              color: isOver ? '#dc2626' : '#15803d'
                            }}
                          />
                          {isOver && (
                            <div style={{ color: '#dc2626', fontSize: '10px', marginTop: '2px', fontWeight: 'bold' }}>
                              Max: {parseFloat(row.available_return_qty).toFixed(2)}
                            </div>
                          )}
                        </td>

                        {/* Weight */}
                        <td style={{ width: '95px', minWidth: '95px' }}>
                          <input
                            type="number"
                            step="0.01"
                            value={row.weight}
                            onChange={(e) => handleItemFieldChange(idx, 'weight', e.target.value)}
                            className="pr-table-input"
                            style={{ textAlign: 'right' }}
                          />
                        </td>

                        {/* Total Wt */}
                        <td style={{ width: '110px', minWidth: '110px', textAlign: 'right', fontWeight: '600' }}>
                          {parseFloat(row.total_wt || 0).toFixed(2)}
                        </td>

                        {/* Rate */}
                        <td style={{ width: '115px', minWidth: '115px' }}>
                          <input
                            type="number"
                            step="0.01"
                            value={row.rate}
                            onChange={(e) => handleItemFieldChange(idx, 'rate', e.target.value)}
                            className="pr-table-input"
                            style={{ textAlign: 'right', fontWeight: '600' }}
                          />
                        </td>

                        {/* Disc % */}
                        <td style={{ width: '85px', minWidth: '85px' }}>
                          <input
                            type="number"
                            step="0.01"
                            value={row.disc}
                            onChange={(e) => handleItemFieldChange(idx, 'disc', e.target.value)}
                            className="pr-table-input"
                            style={{ textAlign: 'right' }}
                          />
                        </td>

                        {/* Tax % */}
                        <td style={{ width: '85px', minWidth: '85px' }}>
                          <input
                            type="number"
                            step="0.01"
                            value={row.tax}
                            onChange={(e) => handleItemFieldChange(idx, 'tax', e.target.value)}
                            className="pr-table-input"
                            style={{ textAlign: 'right' }}
                          />
                        </td>

                        {/* Amount */}
                        <td style={{ width: '140px', minWidth: '140px', textAlign: 'right', fontWeight: '700', color: '#1e3a8a' }}>
                          ₹{parseFloat(row.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* Return Reason */}
                        <td style={{ minWidth: '280px' }}>
                          <select
                            value={row.reason}
                            onChange={(e) => handleItemFieldChange(idx, 'reason', e.target.value)}
                            className="pr-table-select"
                          >
                            {!RETURN_REASONS.includes(row.reason) && row.reason && (
                              <option value={row.reason}>{row.reason}</option>
                            )}
                            {RETURN_REASONS.map((rs, rIdx) => (
                              <option key={rIdx} value={rs}>{rs}</option>
                            ))}
                          </select>
                        </td>

                        {/* Action */}
                        <td style={{ width: '55px', minWidth: '55px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => removeItemRow(idx)}
                            style={{
                              backgroundColor: '#fee2e2',
                              color: '#dc2626',
                              border: '1px solid #fecaca',
                              borderRadius: '4px',
                              padding: '6px 10px',
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              fontSize: '12px'
                            }}
                            title="Remove Item"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 6. DEDUCTIONS & ADJUSTMENTS */}
        {/* ========================================================================= */}
        <div className="pr-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div className="pr-section-title" style={{ margin: 0 }}>
              <span>5. Debit Note Deductions & Transport / Handling Adjustments</span>
            </div>
            <button
              type="button"
              onClick={addDeductionRow}
              className="pr-btn pr-btn-secondary"
              style={{ height: '36px', fontSize: '13px' }}
            >
              + Add Deduction / Surcharge
            </button>
          </div>

          {selectedDeductions.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
              No extra deductions applied. The return will debit the net item amounts directly.
            </div>
          ) : (
            <div className="pr-table-container">
              <table className="pr-table">
                <thead>
                  <tr>
                    <th style={{ width: '45px', textAlign: 'center' }}>#</th>
                    <th>Adjustment / Deduction Name</th>
                    <th style={{ width: '140px' }}>Type</th>
                    <th style={{ width: '120px', textAlign: 'right' }}>Percent (%)</th>
                    <th style={{ width: '140px', textAlign: 'right' }}>Amount (₹)</th>
                    <th style={{ width: '60px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDeductions.map((ded, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                      <td>
                        <input
                          type="text"
                          value={ded.name}
                          onChange={(e) => {
                            const updated = [...selectedDeductions];
                            updated[idx].name = e.target.value;
                            setSelectedDeductions(updated);
                          }}
                          className="pr-table-input"
                        />
                      </td>
                      <td>
                        <select
                          value={ded.type}
                          onChange={(e) => handleDeductionChange(idx, 'type', e.target.value)}
                          className="pr-table-select"
                        >
                          <option value="LESS">LESS (Deduct from Return)</option>
                          <option value="ADD">ADD (Surcharge / Penalty)</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={ded.percent}
                          onChange={(e) => handleDeductionChange(idx, 'percent', e.target.value)}
                          className="pr-table-input"
                          style={{ textAlign: 'right' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={ded.amount}
                          onChange={(e) => handleDeductionChange(idx, 'amount', e.target.value)}
                          className="pr-table-input"
                          style={{ textAlign: 'right', fontWeight: 'bold' }}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => removeDeductionRow(idx)}
                          style={{
                            backgroundColor: '#fee2e2',
                            color: '#dc2626',
                            border: '1px solid #fecaca',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            cursor: 'pointer'
                          }}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 7. FINANCIAL SUMMARY CARD */}
        {/* ========================================================================= */}
        <div className="pr-card" style={{ backgroundColor: '#f8fafc', border: '1.5px solid #cbd5e1' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>Total Return Qty</span>
              <strong style={{ fontSize: '18px', color: '#0f172a' }}>{totals.totalQty.toFixed(2)} Bags</strong>
            </div>

            <div>
              <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>Total Return Weight</span>
              <strong style={{ fontSize: '18px', color: '#0f172a' }}>{totals.totalWeight.toFixed(2)} KG</strong>
            </div>

            <div>
              <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>Base Net Amount</span>
              <strong style={{ fontSize: '18px', color: '#0f172a' }}>₹{totals.baseAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </div>

            <div>
              <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>Tax Amount</span>
              <strong style={{ fontSize: '18px', color: '#0f172a' }}>₹{totals.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </div>

            {totals.lessDeductions > 0 && (
              <div>
                <span style={{ fontSize: '12px', color: '#dc2626', display: 'block' }}>Total Deductions (Less)</span>
                <strong style={{ fontSize: '18px', color: '#dc2626' }}>-₹{totals.lessDeductions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </div>
            )}

            <div style={{
              backgroundColor: '#1e3a8a',
              color: '#ffffff',
              padding: '16px 20px',
              borderRadius: '8px',
              textAlign: 'right'
            }}>
              <span style={{ fontSize: '12px', color: '#bfdbfe', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total Debit Note Amount
              </span>
              <strong style={{ fontSize: '24px', letterSpacing: '-0.5px' }}>
                ₹{totals.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 8. ACTION BUTTONS TOOLBAR */}
        {/* ========================================================================= */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '14px', marginTop: '10px' }}>
          <button
            type="button"
            onClick={() => navigate('/entry/purchase-return-display')}
            className="pr-btn pr-btn-secondary"
          >
            Cancel / Back
          </button>

          <button
            type="button"
            onClick={() => {
              if (window.confirm('Reset this form and start over?')) {
                window.location.reload();
              }
            }}
            className="pr-btn pr-btn-secondary"
          >
            Reset Form
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="pr-btn pr-btn-primary"
            style={{ minWidth: '220px', fontSize: '15px' }}
          >
            {loading ? 'Saving Return...' : isEditMode ? '✓ Update Purchase Return' : '✓ Save & Post Return'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default PurchaseReturn;
