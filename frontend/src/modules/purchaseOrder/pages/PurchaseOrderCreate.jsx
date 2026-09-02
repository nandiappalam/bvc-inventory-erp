import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { EntryTopFrame, EntryItemsTable, EntryTotalsRow, EntryActions } from '../../../components/entry';
import purchaseOrderService from '../services/purchaseOrderService';
import api from '../../../utils/api';
import { saveModuleDraft, loadModuleDraft, clearModuleDraft } from '../../../utils/draftHelper';

const PurchaseOrderCreate = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editingId = searchParams.get('id');

  const [formData, setFormData] = useState({
    sNo: '',
    date: new Date().toISOString().split('T')[0],
    payType: 'Cash',
    type: 'Urad',
    invNo: '',
    invDate: '',
    taxType: 'Exclusive',
    poDate: new Date().toISOString().split('T')[0],
    terms: '',
    fob: '',
    shipVia: '',
    sign: '',
    supplierId: '',
    supplierName: '',
    address: '',
    sender: '',
    remarks: '',
    purchase_request_id: '',
    pr_no: '',
    // Totals
    taxPercent: '',
    amount: '0.00',
    billAmt: '0.00',
    taxAmt: '0.00',
    totAmt: '0.00'
  });

  const [prPickerOpen, setPrPickerOpen] = useState(false);
  const [approvedPrList, setApprovedPrList] = useState([]);
  const [loadingPrList, setLoadingPrList] = useState(false);

  const [items, setItems] = useState([
    {
      id: 1,
      item_name: '',
      weight: '',
      qty: '',
      tot_wt: '',
      purc_rate: '',
      disc_percent: '',
      tax_percent: '',
      ed_percent: '',
      amount: '0.00'
    }
  ]);

  const [deductionsList, setDeductionsList] = useState([]);
  const [selectedDeductions, setSelectedDeductions] = useState([]);

  const handleDeductionAdd = (dedId) => {
    if (!dedId) return;
    const found = deductionsList.find(d => String(d.id) === String(dedId));
    if (!found) return;
    if (selectedDeductions.some(d => String(d.id) === String(dedId))) return;

    const rawType = (found.ded_type || found.deduction_type || found.type || 'less').toLowerCase();
    const newRow = {
      id: found.id,
      deduction: found.ded_name || found.deduction_name || found.name || '',
      type: rawType.includes('add') ? 'add' : 'less',
      percent: found.ded_value || found.deduction_value || '',
      amount: '',
      remarks: ''
    };
    const updated = [...selectedDeductions, newRow];
    recalculateAllTotals(items, updated, formData.taxPercent);
  };

  const handleDeductionChange = (index, field, value) => {
    const updated = [...selectedDeductions];
    updated[index] = { ...updated[index], [field]: value };
    recalculateAllTotals(items, updated, formData.taxPercent);
  };

  const handleDeleteDeduction = (index) => {
    const updated = selectedDeductions.filter((_, i) => i !== index);
    recalculateAllTotals(items, updated, formData.taxPercent);
  };

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  useEffect(() => {
    const fetchDeductions = async () => {
      try {
        const res = await api('/masters/deduction_purchase').catch(() => null) || await api('/masters/deduction_sales').catch(() => null);
        const list = Array.isArray(res) ? res : (res?.data || res?.rows || []);
        if (list.length > 0) setDeductionsList(list);
      } catch(e) {}
    };
    fetchDeductions();
  }, []);

  const applyPurchaseRequest = async (pr) => {
    if (!pr) return;

    // Clear conflicting drafts
    clearModuleDraft('po_create');

    let fullPr = pr;
    try {
      const prIdToFetch = pr.id || pr.pr_no;
      if (prIdToFetch) {
        const fetchedPr = await api(`/purchase-requests/${prIdToFetch}`).catch(() => null) || 
                          await fetch(`/api/purchase-requests/${prIdToFetch}`).then(r => r.json()).catch(() => null);
        if (fetchedPr && (fetchedPr.id || (fetchedPr.items && fetchedPr.items.length > 0))) {
          fullPr = fetchedPr;
        }
      }
    } catch (e) {
      console.error('Error fetching full PR for PO create:', e);
    }

    const suppId = fullPr.suggested_supplier_id || fullPr.supplier_id || '';
    let suppName = fullPr.supplier_name || '';
    let suppAddress = fullPr.supplier_address || fullPr.address || '';

    if (suppId) {
      try {
        const suppRecord = await api(`/masters/record/suppliers/${suppId}`).catch(() => null);
        if (suppRecord) {
          suppName = suppName || suppRecord.name || suppRecord.supplier_name || '';
          const contactPerson = suppRecord.contact_person || suppRecord.contactPerson || '';
          const addressLine = suppRecord.address || suppRecord.address1 || '';
          const area = suppRecord.area || '';
          const phone = suppRecord.phone || suppRecord.phone_res || suppRecord.mobile || suppRecord.phone_off || '';
          const email = suppRecord.email || '';
          const gstNo = suppRecord.gst_no || suppRecord.tin_no || suppRecord.gstNo || '';

          const details = [
            suppName && `Name : ${suppName}`,
            contactPerson && `Contact Person : ${contactPerson}`,
            addressLine && `Address : ${addressLine}`,
            area && `Area : ${area}`,
            phone && `Phone : ${phone}`,
            email && `Email : ${email}`,
            gstNo && `GST/TIN No : ${gstNo}`
          ].filter(Boolean).join('\n');

          if (details) {
            suppAddress = details;
          }
        }
      } catch (e) {
        console.error('Error fetching supplier address for PR:', e);
      }
    }

    const prItems = fullPr.items || [];

    // Collect specs and descriptions for PO remarks
    const specsList = [];
    if (prItems.length > 0) {
      prItems.forEach(it => {
        const itemName = it.resolved_item_name || it.item_name || 'Item';
        const spec = it.description || it.specs || it.item_description;
        if (spec) {
          specsList.push(`${itemName} [Specs: ${spec}]`);
        }
      });
    }

    const remarksParts = [
      `From PR #${fullPr.pr_no}`,
      specsList.length > 0 ? specsList.join(', ') : (fullPr.description ? `Specs: ${fullPr.description}` : ''),
      fullPr.department ? `Dept: ${fullPr.department}` : '',
      fullPr.destination_godown ? `Dest Godown: ${fullPr.destination_godown}` : '',
      fullPr.required_date ? `Req Date: ${fullPr.required_date}` : '',
      fullPr.purpose ? `Purpose: ${fullPr.purpose}` : '',
      (fullPr.remarks && !['approved', 'submitted'].includes(String(fullPr.remarks).toLowerCase())) ? `PR Remarks: ${fullPr.remarks}` : ''
    ].filter(Boolean);

    const generatedRemarks = remarksParts.join(' | ');

    setFormData(prev => ({
      ...prev,
      supplierId: suppId || prev.supplierId,
      supplierName: suppName || prev.supplierName,
      address: suppAddress || prev.address,
      purchase_request_id: fullPr.id,
      pr_no: fullPr.pr_no,
      remarks: generatedRemarks
    }));

    if (prItems.length > 0) {
      const mappedItems = prItems.map((it, idx) => {
        const itemName = it.resolved_item_name || it.item_name || '';
        const appQty = parseFloat(it.approved_qty);
        const reqQty = parseFloat(it.requested_qty || it.qty || 0);
        const qty = (!isNaN(appQty) && appQty > 0) ? appQty : (reqQty > 0 ? reqQty : (parseFloat(it.qty) || 0));

        let weightVal = it.weight || it.unit_weight || it.per_unit_weight || it.master_weight || '';
        let weight = parseFloat(String(weightVal).replace(/[^\d.]/g, '')) || 0;
        if (weight <= 0 && itemName) {
          const match = String(itemName).match(/(\d+(?:\.\d+)?)\s*(?:kg|g|kgs|gm|bag)/i);
          if (match) {
            const num = parseFloat(match[1]);
            if (!isNaN(num) && num > 0) weight = num;
          }
        }
        if (weight <= 0 && it.description) {
          const match = String(it.description).match(/(\d+(?:\.\d+)?)\s*(?:kg|g|kgs|gm|bag)/i);
          if (match) {
            const num = parseFloat(match[1]);
            if (!isNaN(num) && num > 0) weight = num;
          }
        }
        if (weight <= 0) {
          weight = 50; // Standard bag weight fallback
        }

        const totWt = (qty * weight).toFixed(2);
        const rate = parseFloat(it.estimated_rate || it.rate || it.purc_rate || it.purchase_rate || 0) || 0;
        const disc = parseFloat(it.disc_percent || it.discount_percent || 0) || 0;
        const tax = parseFloat(it.tax_rate || it.tax_percent || 5) || 5;
        const baseAmt = qty * rate;
        const discAmt = baseAmt * (disc / 100);
        const taxAmt = ((baseAmt - discAmt) * tax) / 100;
        const amt = (baseAmt - discAmt + taxAmt).toFixed(2);

        return {
          id: idx + 1,
          item_id: it.item_id || '',
          item_name: itemName,
          item_label: itemName,
          weight: String(weight),
          weight_id: String(it.weight_id || it.weight || weight),
          per_unit_wt: weight,
          qty: String(qty || ''),
          tot_wt: String(totWt || ''),
          total_wt: parseFloat(totWt) || 0,
          purc_rate: String(rate || ''),
          rate: String(rate || ''),
          disc_percent: disc > 0 ? String(disc) : '',
          disc: disc > 0 ? String(disc) : '',
          tax_percent: String(tax),
          tax_rate: String(tax),
          ed_percent: '',
          amount: amt,
          available_lots_loaded: true,
          available_lots: []
        };
      });
      setItems(mappedItems);
      recalculateAllTotals(mappedItems, selectedDeductions, formData.taxPercent);
    }
  };

  const handleOpenPrPicker = async () => {
    setPrPickerOpen(true);
    setLoadingPrList(true);
    try {
      let list = [];
      const res = await api('/purchase-requests/approved-list').catch(() => null) || await fetch('/api/purchase-requests/approved-list').then(r => r.json()).catch(() => null);
      if (Array.isArray(res) && res.length > 0) {
        list = res;
      } else {
        const allRes = await api('/purchase-requests').catch(() => null) || await fetch('/api/purchase-requests').then(r => r.json()).catch(() => []);
        const rawList = Array.isArray(allRes) ? allRes : (allRes?.rows || allRes?.data || []);
        list = rawList.filter(p => ['approved', 'partially converted', 'converted', 'pending po', 'submitted', 'draft', 'active'].includes((p.status || '').toLowerCase()) || !p.status);
      }
      setApprovedPrList(list);
    } catch (e) {
      console.error('Failed to load approved PRs:', e);
      setApprovedPrList([]);
    } finally {
      setLoadingPrList(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const linkedPrId = searchParams.get('pr_id') || searchParams.get('purchase_request_id');

        if (editingId) {
          const existing = await purchaseOrderService.get(editingId);
          if (existing) {
            setFormData({
              sNo: existing.sNo || existing.s_no || '',
              date: existing.date || '',
              payType: existing.payType || existing.paymentTerms || 'Cash',
              type: existing.type || 'Urad',
              invNo: existing.invNo || existing.orderNo || '',
              invDate: existing.invDate || '',
              taxType: existing.taxType || 'Exclusive',
              poDate: existing.poDate || existing.date || '',
              terms: existing.terms || '',
              fob: existing.fob || '',
              shipVia: existing.shipVia || '',
              sign: existing.sign || '',
              supplierId: existing.supplierId || '',
              supplierName: existing.supplierName || '',
              address: existing.address || '',
              sender: existing.sender || '',
              remarks: existing.internalRemarks || existing.remarks || '',
              purchase_request_id: existing.purchase_request_id || '',
              pr_no: existing.pr_no || '',
              taxPercent: String(existing.taxPercent || '18'),
              amount: String(existing.amount || '0.00'),
              billAmt: String(existing.billAmt || '0.00'),
              taxAmt: String(existing.taxAmt || '0.00'),
              totAmt: String(existing.totAmt || '0.00')
            });

            if (existing.items && existing.items.length > 0) {
              setItems(existing.items.map((it, idx) => ({
                id: idx + 1,
                item_name: it.itemName || it.item_name || '',
                weight: it.weight || '',
                qty: it.qty || '',
                tot_wt: it.tot_wt || it.totWt || '',
                purc_rate: it.purc_rate || it.rate || '',
                disc_percent: it.disc_percent || it.discountPercent || '',
                tax_percent: it.tax_percent || it.taxPercent || '',
                ed_percent: it.ed_percent || '',
                amount: it.amount || '0.00'
              })));
            }

            if (existing.deductions && existing.deductions.length > 0) {
              setSelectedDeductions(existing.deductions.map(d => ({
                id: d.id,
                deduction: d.deduction || d.deduction_name || '',
                type: (d.type || 'less').toLowerCase(),
                percent: d.percent || d.value || '',
                amount: d.amount || '',
                remarks: d.remarks || ''
              })));
            }
          }
        } else {
          const nextSNo = await purchaseOrderService.getNextSNo();
          if (nextSNo) {
            setFormData(prev => ({
              ...prev,
              sNo: String(nextSNo),
              s_no: String(nextSNo),
              invNo: `PO-${nextSNo}`
            }));
          }

          if (linkedPrId) {
            try {
              const prRes = await api(`/purchase-requests/${linkedPrId}`).catch(() => null) || await fetch(`/api/purchase-requests/${linkedPrId}`).then(r => r.json()).catch(() => null);
              if (prRes && (prRes.id || prRes.pr_no)) {
                applyPurchaseRequest(prRes);
              }
            } catch (err) {
              console.error('Error preloading PR into PO:', err);
            }
          } else {
            const savedDraft = loadModuleDraft('po_create');
            if (savedDraft && savedDraft.formData) {
              setFormData(prev => ({
                ...prev,
                ...savedDraft.formData,
                sNo: prev.sNo,
                invNo: prev.invNo
              }));
              if (savedDraft.items && savedDraft.items.length > 0) {
                setItems(savedDraft.items);
              }
              if (savedDraft.selectedDeductions) {
                setSelectedDeductions(savedDraft.selectedDeductions);
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to load purchase order details:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [editingId, searchParams]);

  // Auto-save draft when not editing
  useEffect(() => {
    if (!editingId && (formData.supplierName || formData.remarks || (items.length > 0 && items[0]?.item_name))) {
      saveModuleDraft('po_create', { formData, items, selectedDeductions });
    }
  }, [formData, items, selectedDeductions, editingId]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };

      if (name === 'sNo' || name === 's_no') {
        updated.sNo = value;
        updated.s_no = value;
        if (!prev.invNo || prev.invNo.startsWith('PO-')) {
          updated.invNo = `PO-${value}`;
        }
      }

      if (name === 'supplierId' && typeof value === 'object' && value) {
        updated.supplierId = value.id;
        updated.supplierName = value.name || value.supplier_name || '';
        updated.address = value.address || value.address1 || '';
      }

      if (name === 'taxPercent') {
        recalculateAllTotals(items, selectedDeductions, value);
      }

      return updated;
    });
  };

  // Compute and update totals across items and deductions
  const recalculateAllTotals = (updatedItems, updatedDeductions, formTaxPct) => {
    let totalAmount = 0;
    let totalItemTax = 0;

    updatedItems.forEach(item => {
      const qty = parseFloat(item.qty) || 0;
      const rate = parseFloat(item.purc_rate) || 0;
      const disc = parseFloat(item.disc_percent) || 0;
      const itemTax = parseFloat(item.tax_percent) || 0;

      const baseAmt = qty * rate;
      const amt = baseAmt - (baseAmt * disc / 100);
      totalAmount += amt;
      if (itemTax > 0) {
        totalItemTax += (amt * itemTax / 100);
      }
    });

    const taxRate = parseFloat(formTaxPct);
    const computedTaxAmt = (!isNaN(taxRate) && taxRate > 0) ? (totalAmount * taxRate / 100) : (totalItemTax > 0 ? totalItemTax : 0);

    let totalDedLess = 0;
    let totalDedAdd = 0;

    const newSelectedDeductions = updatedDeductions.map(d => {
      const pct = parseFloat(d.percent);
      let dAmt = parseFloat(d.amount) || 0;
      if (!isNaN(pct) && pct > 0 && totalAmount > 0) {
        dAmt = parseFloat(((totalAmount * pct) / 100).toFixed(2));
      }
      const isAdd = (d.type || '').toLowerCase() === 'add';
      if (isAdd) {
        totalDedAdd += dAmt;
      } else {
        totalDedLess += dAmt;
      }
      return {
        ...d,
        amount: dAmt ? dAmt.toFixed(2) : (d.amount || '')
      };
    });

    const totAmt = totalAmount + computedTaxAmt - totalDedLess + totalDedAdd;

    setFormData(prev => ({
      ...prev,
      amount: totalAmount.toFixed(2),
      billAmt: totalAmount.toFixed(2),
      taxAmt: computedTaxAmt.toFixed(2),
      totAmt: Math.max(0, totAmt).toFixed(2)
    }));

    setSelectedDeductions(newSelectedDeductions);
  };

  const handleRowChange = (index, key, value) => {
    setItems(prevItems => {
      const updatedItems = [...prevItems];
      if (key === '__batch__' && typeof value === 'object') {
        updatedItems[index] = { ...updatedItems[index], ...value };
      } else {
        updatedItems[index] = { ...updatedItems[index], [key]: value };
      }

      const qty = parseFloat(updatedItems[index].qty) || 0;
      const weight = parseFloat(updatedItems[index].weight) || 0;
      const rate = parseFloat(updatedItems[index].purc_rate) || 0;
      const disc = parseFloat(updatedItems[index].disc_percent) || 0;
      const tax = parseFloat(updatedItems[index].tax_percent) || 0;

      const totWt = weight > 0 ? (qty * weight) : qty;
      updatedItems[index].tot_wt = totWt > 0 ? totWt.toFixed(2) : '';

      let baseAmt = qty * rate;
      let amt = baseAmt - (baseAmt * disc / 100) + (baseAmt * tax / 100);

      updatedItems[index].amount = amt.toFixed(2);

      recalculateAllTotals(updatedItems, selectedDeductions, formData.taxPercent);

      return updatedItems;
    });
  };

  const addItem = () => {
    setItems(prev => [
      ...prev,
      {
        id: prev.length + 1,
        item_name: '',
        weight: '',
        qty: '',
        tot_wt: '',
        purc_rate: '',
        disc_percent: '',
        tax_percent: '',
        ed_percent: '',
        amount: '0.00'
      }
    ]);
  };

  const deleteItem = (index) => {
    setItems(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const payload = {
        sNo: formData.sNo,
        s_no: formData.sNo,
        date: formData.date,
        payType: formData.payType,
        type: formData.type,
        invNo: formData.invNo,
        invDate: formData.invDate,
        taxType: formData.taxType,
        poDate: formData.poDate,
        terms: formData.terms,
        fob: formData.fob,
        shipVia: formData.shipVia,
        sign: formData.sign,
        supplierId: formData.supplierId,
        supplierName: formData.supplierName,
        address: formData.address,
        sender: formData.sender,
        remarks: formData.remarks,
        taxPercent: formData.taxPercent,
        amount: formData.amount,
        billAmt: formData.billAmt,
        taxAmt: formData.taxAmt,
        totAmt: formData.totAmt,
        purchase_request_id: formData.purchase_request_id || null,
        pr_no: formData.pr_no || null,
        items: items.map(it => ({
          itemName: typeof it.item_name === 'object' ? it.item_name?.name || '' : it.item_name,
          weight: parseFloat(it.weight) || 0,
          qty: parseFloat(it.qty) || 0,
          totWt: parseFloat(it.tot_wt) || 0,
          rate: parseFloat(it.purc_rate) || 0,
          discountPercent: parseFloat(it.disc_percent) || 0,
          taxPercent: parseFloat(it.tax_percent) || 0,
          edPercent: parseFloat(it.ed_percent) || 0,
          amount: parseFloat(it.amount) || 0
        })),
        deductions: selectedDeductions.map(d => ({
          deduction: d.deduction,
          type: d.type || 'less',
          percent: d.percent,
          amount: d.amount,
          remarks: d.remarks
        }))
      };

      if (editingId) {
        await purchaseOrderService.update(editingId, payload);
      } else {
        await purchaseOrderService.create(payload);
        clearModuleDraft('po_create');
      }

      setMessage('Purchase Order saved successfully!');
      setMessageType('success');
      setTimeout(() => {
        navigate('/entry/purchase-order-list');
      }, 1500);
    } catch (err) {
      console.error('Error saving purchase order:', err);
      setMessage('Error saving purchase order: ' + err.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  // 4 Column Header Top Fields as shown in Screenshot 2
  const topFrameFields = [
    // Col 1
    { name: 'sNo', label: 'S.No', type: 'text', readOnly: true, col: 1 },
    { name: 'date', label: 'Date', type: 'date', col: 1 },
    { name: 'payType', label: 'Pay Type', type: 'select', options: [
      { value: 'Cash', label: 'Cash' },
      { value: 'Credit', label: 'Credit' }
    ], col: 1 },
    { name: 'type', label: 'Type', type: 'select', options: [
      { value: 'Urad', label: 'Urad' },
      { value: 'Moong', label: 'Moong' },
      { value: 'Others', label: 'Others' }
    ], col: 1 },

    // Col 2
    { name: 'invNo', label: 'Inv. No', type: 'text', col: 2 },
    { name: 'invDate', label: 'Inv. Date', type: 'date', col: 2 },
    { name: 'taxType', label: 'Tax Type', type: 'select', options: [
      { value: 'Exclusive', label: 'Exclusive' },
      { value: 'Inclusive', label: 'Inclusive' },
      { value: 'Without Tax', label: 'Without Tax' }
    ], col: 2 },
    { name: 'poDate', label: 'P.O. Date', type: 'date', col: 2 },

    // Col 3
    { name: 'terms', label: 'Terms', type: 'text', col: 3 },
    { name: 'fob', label: 'F.O.B', type: 'text', col: 3 },
    { name: 'shipVia', label: 'Ship Via', type: 'text', col: 3 },
    { name: 'sign', label: 'Sign', type: 'text', col: 3 },

    // Col 4
    { name: 'supplierId', label: 'Supplier', type: 'masterSelect', masterType: 'suppliers', col: 4 },
    { name: 'address', label: 'Address', type: 'textarea', col: 4 },
    { name: 'sender', label: 'Sender', type: 'masterSelect', masterType: 'senders', col: 4 }
  ];

  const itemColumns = [
    { key: 'item_name', title: 'Item Name', type: 'masterSelect', masterType: 'items' },
    { key: 'weight', title: 'Weight', type: 'masterSelect', masterType: 'weights' },
    { key: 'qty', title: 'Qty', type: 'number' },
    { key: 'tot_wt', title: 'Tot Wt', readOnly: true },
    { key: 'purc_rate', title: 'Purc Rate', type: 'number' },
    { key: 'disc_percent', title: 'Disc %', type: 'number' },
    { key: 'tax_percent', title: 'Tax %', type: 'number' },
    { key: 'ed_percent', title: 'ED %', type: 'number' },
    { key: 'amount', title: 'Amount', readOnly: true }
  ];

  const totals = [
    { name: 'taxPercent', label: 'Tax %', value: formData.taxPercent },
    { name: 'amount', label: 'Amount', value: formData.amount },
    { name: 'billAmt', label: 'Bill Amt', value: formData.billAmt },
    { name: 'taxAmt', label: 'Tax Amt', value: formData.taxAmt },
    { name: 'totAmt', label: 'Tot Amt', value: formData.totAmt }
  ];

  return (
    <div className="window">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div className="screen-title" style={{ margin: 0 }}>
          {editingId ? 'Edit Purchase Order' : 'Purchase Order Creation'}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={handleOpenPrPicker}
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
            🔗 Link Purchase Request
          </button>
        </div>
      </div>

      {formData.pr_no && (
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
            <span style={{ fontSize: '18px' }}>📋</span>
            <span>
              <strong>Linked with Purchase Request:</strong> {formData.pr_no}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                setFormData(prev => ({ ...prev, purchase_request_id: '', pr_no: '' }));
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
              Unlink PR
            </button>
          </div>
        </div>
      )}

      {message && <div className={`message ${messageType}`}>{message}</div>}

      <form onSubmit={handleSave}>
        <EntryTopFrame 
          fields={topFrameFields} 
          data={formData} 
          onChange={handleFormChange}
          columns={4}
          nextSnoEndpoint="/purchase-orders/next-sno"
        />

        <EntryItemsTable 
          columns={itemColumns}
          data={items}
          onRowChange={handleRowChange}
          onAddRow={addItem}
          onDeleteRow={deleteItem}
          showActions={true}
          lotMode="none"
        />

        <EntryTotalsRow totals={totals} />

        {/* Deduction Details Table */}
        <div style={{ margin: '15px 0', background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', color: '#1e4fa8', fontWeight: 'bold' }}>Deduction Details</h3>
            <select 
              onChange={(e) => { handleDeductionAdd(e.target.value); e.target.value = ''; }} 
              defaultValue=""
              style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px', outline: 'none' }}
            >
              <option value="" disabled>+ Add Deduction</option>
              {deductionsList.map(d => (
                <option key={d.id} value={d.id}>{d.ded_name || d.deduction_name || d.name}</option>
              ))}
            </select>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#3f6fc0', color: '#ffffff' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left' }}>Deduction Name</th>
                <th style={{ padding: '6px 10px', textAlign: 'center', width: '110px' }}>Type</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', width: '80px' }}>%</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', width: '120px' }}>Amount</th>
                <th style={{ padding: '6px 10px', textAlign: 'left' }}>Remarks</th>
                <th style={{ padding: '6px 10px', textAlign: 'center', width: '60px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {selectedDeductions.map((row, index) => (
                <tr key={index} style={{ borderBottom: '1px solid #e2e8f0', background: index % 2 === 0 ? '#ffffff' : '#f9fbff' }}>
                  <td style={{ padding: '6px 10px', fontWeight: '500' }}>{row.deduction}</td>
                  <td style={{ padding: '4px 10px' }}>
                    <select
                      value={row.type || 'less'}
                      onChange={(e) => handleDeductionChange(index, 'type', e.target.value)}
                      style={{ width: '100%', padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '3px', fontSize: '12px', outline: 'none' }}
                    >
                      <option value="less">Less (-)</option>
                      <option value="add">Add (+)</option>
                    </select>
                  </td>
                  <td style={{ padding: '4px 10px' }}>
                    <input 
                      type="number" 
                      value={row.percent || ''} 
                      onChange={(e) => handleDeductionChange(index, 'percent', e.target.value)}
                      style={{ width: '100%', textAlign: 'right', padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '3px' }}
                    />
                  </td>
                  <td style={{ padding: '4px 10px' }}>
                    <input 
                      type="number" 
                      value={row.amount || ''} 
                      onChange={(e) => handleDeductionChange(index, 'amount', e.target.value)}
                      style={{ width: '100%', textAlign: 'right', padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '3px' }}
                    />
                  </td>
                  <td style={{ padding: '4px 10px' }}>
                    <input 
                      type="text" 
                      value={row.remarks || ''} 
                      onChange={(e) => handleDeductionChange(index, 'remarks', e.target.value)}
                      style={{ width: '100%', padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '3px' }}
                    />
                  </td>
                  <td style={{ padding: '4px 10px', textAlign: 'center' }}>
                    <button 
                      type="button"
                      onClick={() => handleDeleteDeduction(index)} 
                      style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
              {selectedDeductions.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ padding: '10px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                    No deductions added. Select from the dropdown above to add deductions.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <EntryActions 
          onSave={handleSave}
          saving={loading}
          saveText={editingId ? "Update" : "Save"}
        />
      </form>

      {/* PR Picker Dialog */}
      {prPickerOpen && (
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
              maxWidth: '800px',
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
                Select Approved Purchase Request to Convert / Link
              </h3>
              <button
                onClick={() => setPrPickerOpen(false)}
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
              {loadingPrList ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  Loading approved requisitions...
                </div>
              ) : approvedPrList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  No approved purchase requests found.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                      <th style={{ padding: '8px', textAlign: 'left' }}>PR No</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Department</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Items</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Total Qty</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Est. Value (₹)</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvedPrList.map((pr) => (
                      <tr key={pr.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px', fontWeight: 'bold', color: '#1f4fb2' }}>{pr.pr_no}</td>
                        <td style={{ padding: '8px' }}>{pr.request_date}</td>
                        <td style={{ padding: '8px' }}>{pr.department || 'General'}</td>
                        <td style={{ padding: '8px' }}>{pr.item_names || (pr.items && pr.items.map(i => i.item_name).join(', ')) || '—'}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>{pr.total_qty || 0}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>
                          ₹{parseFloat(pr.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => {
                              applyPurchaseRequest(pr);
                              setPrPickerOpen(false);
                            }}
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
                            Import ➔
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
                onClick={() => setPrPickerOpen(false)}
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
  );
};

export default PurchaseOrderCreate;
