import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './PurchaseReturn.css';
import { getMasters } from '../services/masterservice.js';

// Import modular entry components
import { EntryTopFrame, EntryItemsTable, EntryTotalsRow, EntryBottomSummary, EntryActions, EntrySection } from './entry';

const PurchaseReturn = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    sNo: 1,
    date: new Date().toISOString().substring(0, 10),
    returnInvNo: '',
    supplier: '',
    payType: 'Credit',
    invDate: new Date().toISOString().substring(0, 10),
    type: 'Urad',
    address: '',
    taxType: 'Exclusive',
    godown: '',
    remarks: ''
  });

  const [items, setItems] = useState([
    {
      id: 1,
      item_name: '',
      lot_no: '',
      weight: '',
      qty: '',
      total_wt: 0,
      rate: '',
      disc: '',
      tax: '',
      amount: 0
    }
  ]);

  const [masterDeductions, setMasterDeductions] = useState([]);
  const [selectedDeductions, setSelectedDeductions] = useState([]);
  const [pendingReturns, setPendingReturns] = useState([]);
  const [selectedPendingLot, setSelectedPendingLot] = useState('');

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

  // Load deduction masters and pending returns list
  useEffect(() => {
    getMasters('deduction_purchase')
      .then(res => {
        if (Array.isArray(res)) setMasterDeductions(res);
      })
      .catch(() => {
        getMasters('deduction_sales').then(res => {
          if (Array.isArray(res)) setMasterDeductions(res);
        }).catch(() => {});
      });

    fetch('/api/purchase-returns/pending-returns')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setPendingReturns(data);
      })
      .catch(err => console.error('Error fetching pending returns:', err));
  }, []);

  // Recalculate totals and deduction amounts
  const recalculateAll = (currentItems = items, currentDeductions = selectedDeductions) => {
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

      const totWt = parseFloat(item.totalWt ?? item.total_wt ?? (q * w)) || 0;
      const lineBase = q * r;
      const lineDisc = (lineBase * d) / 100;
      const lineTax = ((lineBase - lineDisc) * t) / 100;
      const lineAmt = lineBase - lineDisc + lineTax;

      totalQty += q;
      totalWeight += totWt;
      baseAmount += lineBase;
      discAmount += lineDisc;
      taxAmount += lineTax;
      totalAmount += (item.amount !== undefined && item.amount !== null && !isNaN(item.amount)) ? parseFloat(item.amount) : lineAmt;
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
  };

  // Prefill details if navigated from Vehicle Movement Reject/Return flow or Edit mode
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editId = params.get('id');
    const partyName = params.get('partyName') || '';
    const itemName = params.get('itemName') || '';
    const qty = params.get('qty') || '';
    const weight = params.get('weight') || '';
    const lotNo = params.get('lotNo') || '';
    const referenceId = params.get('referenceId') || params.get('purchaseId') || '';
    const urlInvNo = params.get('invNo') || params.get('returnInvNo') || '';

    if (editId) {
      // Load existing purchase return record for editing
      const fetchRecord = async () => {
        try {
          const res = await fetch(`/api/purchase-returns/${editId}`);
          if (res.ok) {
            const data = await res.json();
            setFormData({
              sNo: data.s_no || data.sNo || editId,
              date: data.date ? data.date.substring(0, 10) : new Date().toISOString().substring(0, 10),
              returnInvNo: data.return_inv_no || data.returnInvNo || '',
              supplier: String(data.supplier_id || data.supplier || ''),
              payType: data.pay_type || data.payType || 'Credit',
              invDate: data.inv_date || data.invDate || new Date().toISOString().substring(0, 10),
              type: data.type || 'Urad',
              address: data.address || '',
              taxType: data.tax_type || data.taxType || 'Exclusive',
              godown: data.godown || '',
              remarks: data.remarks || ''
            });

            if (Array.isArray(data.items) && data.items.length > 0) {
              const loadedItems = data.items.map((it, idx) => {
                const q = parseFloat(it.qty) || 0;
                const w = parseFloat(it.weight) || 0;
                const r = parseFloat(it.rate) || 0;
                const d = parseFloat(it.disc_percent ?? it.disc) || 0;
                const t = parseFloat(it.tax_percent ?? it.tax) || 0;
                const totWt = parseFloat(it.tot_wt || it.total_wt || it.totalWt || (q * w)) || 0;
                let amt = q * r;
                amt -= (amt * d) / 100;
                amt += (amt * t) / 100;
                return {
                  id: idx + 1,
                  item_name: it.item_name || it.itemName || '',
                  lot_no: it.lot_no || it.lotNo || '',
                  weight: String(w || ''),
                  qty: String(q || ''),
                  totalWt: totWt,
                  total_wt: totWt,
                  rate: String(r || ''),
                  disc: String(d || ''),
                  tax: String(t || ''),
                  amount: amt
                };
              });
              setItems(loadedItems);

              let loadedDeds = [];
              if (Array.isArray(data.deductions)) {
                loadedDeds = data.deductions.map(d => ({
                  deduction_id: d.deduction_id || d.id,
                  id: d.deduction_id || d.id,
                  name: d.deduction_name || d.name || 'Deduction',
                  type: String(d.type || 'LESS').toUpperCase(),
                  calculation_type: d.calculation_type || d.calc_type || 'Percentage',
                  percent: parseFloat(d.percentage ?? d.percent ?? 0) || 0,
                  amount: parseFloat(d.amount) || 0
                }));
                setSelectedDeductions(loadedDeds);
              }
              recalculateAll(loadedItems, loadedDeds);
            }
          }
        } catch (err) {
          console.error('Error fetching purchase return edit record:', err);
        }
      };
      fetchRecord();
    } else if (partyName || itemName || qty || weight || lotNo || referenceId || urlInvNo) {
      const fetchSuppliersAndPurchase = async () => {
        try {
          let foundRate = 0;
          let foundTax = 0;
          let foundDisc = 0;
          let fetchedInvNo = urlInvNo;
          let loadedDeds = [];

          if (referenceId) {
            try {
              const purRes = await fetch(`/api/purchases/${referenceId}`);
              if (purRes.ok) {
                const purData = await purRes.json();
                if (purData) {
                  fetchedInvNo = purData.inv_no || purData.invNo || urlInvNo || referenceId;

                  setFormData(prev => ({
                    ...prev,
                    returnInvNo: String(fetchedInvNo),
                    address: purData.address || prev.address || '',
                    taxType: purData.tax_type || prev.taxType || 'Exclusive',
                    payType: purData.pay_type || prev.payType || 'Credit'
                  }));

                  if (Array.isArray(purData.items)) {
                    const matchedItem = purData.items.find(i => 
                      (lotNo && i.lot_no === lotNo) || 
                      (itemName && i.item_name?.toLowerCase() === itemName.toLowerCase())
                    ) || purData.items[0];

                    if (matchedItem) {
                      foundRate = parseFloat(matchedItem.rate) || 0;
                      foundTax = parseFloat(matchedItem.tax_percent ?? matchedItem.tax ?? purData.tax_percent) || 0;
                      foundDisc = parseFloat(matchedItem.disc_percent ?? matchedItem.disc) || 0;
                    } else if (purData.tax_percent) {
                      foundTax = parseFloat(purData.tax_percent) || 0;
                    }
                  }

                  if (Array.isArray(purData.deductions) && purData.deductions.length > 0) {
                    loadedDeds = purData.deductions.map(d => ({
                      deduction_id: d.deduction_purchase_id || d.deduction_id || d.id,
                      id: d.deduction_purchase_id || d.deduction_id || d.id,
                      name: d.deduction_name || d.name || 'Deduction',
                      type: String(d.type || d.ded_type || d.deduction_type || 'LESS').toUpperCase(),
                      calculation_type: d.calculation_type || d.calc_type || 'Percentage',
                      percent: parseFloat(d.percentage ?? d.percent ?? d.value ?? 0) || 0,
                      amount: parseFloat(d.amount) || 0
                    }));
                    setSelectedDeductions(loadedDeds);
                  }
                }
              }
            } catch (e) {
              console.error('Error fetching linked purchase details:', e);
            }
          }

          if (urlInvNo && !fetchedInvNo) {
            setFormData(prev => ({ ...prev, returnInvNo: String(urlInvNo) }));
          }

          const suppliers = await getMasters('suppliers');
          const matched = suppliers.find(s => 
            (s.name && s.name.toLowerCase().trim() === partyName.toLowerCase().trim()) ||
            (s.print_name && s.print_name.toLowerCase().trim() === partyName.toLowerCase().trim())
          );
          if (matched) {
            setFormData(prev => ({ 
              ...prev, 
              supplier: String(matched.id), 
              address: matched.address || prev.address || '',
              remarks: `Returned from QC / Vehicle Movement linked to Purchase Inv #${fetchedInvNo || referenceId}` 
            }));
          } else {
            setFormData(prev => ({ 
              ...prev, 
              remarks: `Party: ${partyName}. Returned from QC / Vehicle Movement linked to Purchase Inv #${fetchedInvNo || referenceId}` 
            }));
          }

          const initialQty = parseFloat(qty) || 0;
          const initialWeight = parseFloat(weight) || 0;
          const calculatedTotalWt = initialQty * initialWeight;

          let lineBase = initialQty * foundRate;
          let lineDisc = (lineBase * foundDisc) / 100;
          let lineTax = ((lineBase - lineDisc) * foundTax) / 100;
          let amt = lineBase - lineDisc + lineTax;

          const prefilledItem = {
            id: 1,
            item_name: itemName,
            lot_no: lotNo,
            weight: String(initialWeight || ''),
            qty: String(initialQty || ''),
            totalWt: calculatedTotalWt,
            total_wt: calculatedTotalWt,
            rate: String(foundRate || ''),
            disc: String(foundDisc || ''),
            tax: String(foundTax || ''),
            amount: amt
          };

          setItems([prefilledItem]);
          recalculateAll([prefilledItem], loadedDeds);

        } catch (err) {
          console.error('Error fetching suppliers/purchases for prefill:', err);
        }
      };
      fetchSuppliersAndPurchase();
    }
  }, []);

  // Handle selection from Pending QC Rejected Lot Dropdown
  const handleSelectPendingReturn = (lotNo) => {
    setSelectedPendingLot(lotNo);
    if (!lotNo) return;
    const match = pendingReturns.find(p => p.lot_no === lotNo);
    if (!match) return;

    const party = match.supplier_master_id || match.supplier_name || match.supplier_id || '';
    const item = match.item_name || '';
    const q = parseFloat(match.qty) || 0;
    const w = parseFloat(match.weight) || 0;
    const r = parseFloat(match.rate) || 0;
    const disc = parseFloat(match.disc) || 0;
    const tax = parseFloat(match.tax) || 0;

    setFormData(prev => ({
      ...prev,
      supplier: String(party),
      returnInvNo: String(match.inv_no || ''),
      address: match.supplier_address || prev.address || '',
      payType: match.pay_type || prev.payType || 'Credit',
      taxType: match.tax_type || prev.taxType || 'Exclusive',
      remarks: `QC Rejected / Returned Lot ${match.lot_no}. Purchase Inv #${match.inv_no || ''}`
    }));

    const totWt = q * w;
    let lineBase = q * r;
    let lineDisc = (lineBase * disc) / 100;
    let lineTax = ((lineBase - lineDisc) * tax) / 100;
    let amt = lineBase - lineDisc + lineTax;

    const newItem = {
      id: 1,
      item_name: item,
      lot_no: match.lot_no,
      weight: String(w || ''),
      qty: String(q || ''),
      totalWt: totWt,
      total_wt: totWt,
      rate: String(r || ''),
      disc: String(disc || ''),
      tax: String(tax || ''),
      amount: amt
    };

    setItems([newItem]);
    recalculateAll([newItem], selectedDeductions);
  };

  const handleFormChange = (nameOrEvent, maybeValue) => {
    if (nameOrEvent && nameOrEvent.target) {
      const { name, value } = nameOrEvent.target;
      setFormData(prev => ({ ...prev, [name]: value }));
    } else {
      setFormData(prev => ({ ...prev, [nameOrEvent]: maybeValue }));
    }
  };

  const handleItemChange = (index, field, value) => {
    setItems(prevItems => {
      const updatedItems = [...prevItems];
      if (field === '__batch__' && typeof value === 'object') {
        updatedItems[index] = { ...updatedItems[index], ...value };
      } else {
        updatedItems[index] = { ...updatedItems[index], [field]: value };
      }
      
      const weight = parseFloat(updatedItems[index].weight) || 0;
      const qty = parseFloat(updatedItems[index].qty) || 0;
      const rate = parseFloat(updatedItems[index].rate) || 0;
      const disc = parseFloat(updatedItems[index].disc) || 0;
      const tax = parseFloat(updatedItems[index].tax) || 0;

      const totalwt = weight * qty;
      let lineBase = qty * rate;
      let lineDisc = (lineBase * disc) / 100;
      let lineTax = ((lineBase - lineDisc) * tax) / 100;
      let amt = lineBase - lineDisc + lineTax;

      updatedItems[index].totalWt = totalwt;
      updatedItems[index].total_wt = totalwt;
      updatedItems[index].amount = amt;

      recalculateAll(updatedItems, selectedDeductions);
      return updatedItems;
    });
  };

  // Handle deduction changes (percent or calculated amount)
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

  const addItem = () => {
    const newId = Math.max(...items.map(item => item.id), 0) + 1;
    setItems(prev => {
      const updated = [...prev, {
        id: newId,
        item_name: '',
        lot_no: '',
        weight: '',
        qty: '',
        total_wt: 0,
        rate: '',
        disc: '',
        tax: '',
        amount: 0
      }];
      recalculateAll(updated, selectedDeductions);
      return updated;
    });
  };

  const deleteItem = (index) => {
    setItems(prev => {
      if (prev.length <= 1) return prev;
      const updatedItems = prev.filter((_, i) => i !== index);
      recalculateAll(updatedItems, selectedDeductions);
      return updatedItems;
    });
  };

  const handleSave = async () => {
    setLoading(true);
    setMessage('');

    try {
      const data = { formData, items, totals, deductions: selectedDeductions };
      const params = new URLSearchParams(window.location.search);
      const editId = params.get('id');

      const url = editId ? `/api/purchase-returns/${editId}` : '/api/purchase-returns';
      const method = editId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        setMessage(editId ? 'Purchase return updated successfully!' : 'Purchase return saved successfully!');
        setMessageType('success');
        setTimeout(() => {
          setMessage('');
          navigate('/entry/purchase-return-display');
        }, 1200);
      } else {
        setMessage('Error saving purchase return');
        setMessageType('error');
      }
    } catch (error) {
      setMessage('Error saving purchase return');
      setMessageType('error');
    }
    setLoading(false);
  };

  const topFrameFields = [
    { name: 'sNo', label: 'S.No', readOnly: true, col: 1 },
    { name: 'date', label: 'Date', type: 'date', col: 1 },
    { name: 'payType', label: 'Pay Type', type: 'select', options: [
      { value: 'Cash', label: 'Cash' },
      { value: 'Credit', label: 'Credit' }
    ], col: 1 },

    { name: 'returnInvNo', label: 'Inv. No', col: 2 },
    { name: 'invDate', label: 'Inv. Date', type: 'date', col: 2 },
    { name: 'taxType', label: 'Tax Type', type: 'select', options: [
      { value: 'Exclusive', label: 'Exclusive' },
      { value: 'Inclusive', label: 'Inclusive' },
      { value: 'Without Tax', label: 'Without Tax' }
    ], col: 2 },

    { name: 'type', label: 'Type', type: 'select', options: [
      { value: 'Urad', label: 'Urad' },
      { value: 'Moong', label: 'Moong' },
      { value: 'Others', label: 'Others' }
    ], col: 3 },

    { name: 'supplier', label: 'Supplier', type: 'masterSelect', masterType: 'suppliers', col: 4 },
    { name: 'address', label: 'Address', type: 'textarea', col: 4 }
  ];

  const itemColumns = [
    { key: 'item_name', title: 'Item Name', type: 'masterSelect', masterType: 'items' },
    { key: 'lot_no', title: 'Lot No', type: 'lotSelect' },
    { key: 'weight', title: 'Weight', type: 'masterSelect', masterType: 'weights' },
    { key: 'qty', title: 'Qty', type: 'number' },
    { key: 'total_wt', title: 'Total Wt', readOnly: true },
    { key: 'rate', title: 'Rate', type: 'number' },
    { key: 'disc', title: 'Disc %', type: 'number' },
    { key: 'tax', title: 'Tax %', type: 'number' },
    { key: 'amount', title: 'Amount', readOnly: true },
  ];

  const totalsArr = [
    { name: 'totalQty', label: 'Total Qty', value: totals.totalQty.toFixed(3) },
    { name: 'totalWeight', label: 'Total Weight', value: totals.totalWeight.toFixed(3) },
    { name: 'totalAmount', label: 'Total Amount', value: totals.totalAmount.toFixed(2) },
    { name: 'grandTotal', label: 'Grand Total', value: totals.grandTotal.toFixed(2) },
  ];

  const summaryFields = [
    { name: 'baseAmount', label: 'Base Amount', value: totals.baseAmount.toFixed(2) },
    { name: 'discAmount', label: 'Disc Amount', value: totals.discAmount.toFixed(2) },
    { name: 'taxAmount', label: 'Tax Amount', value: totals.taxAmount.toFixed(2) },
    { name: 'addDeductions', label: 'Add Deductions', value: (totals.addDeductions || 0).toFixed(2) },
    { name: 'lessDeductions', label: 'Less Deductions', value: (totals.lessDeductions || 0).toFixed(2) },
    { name: 'grandTotal', label: 'Grand Total', value: totals.grandTotal.toFixed(2) },
  ];

  const handleRowChange = (rowIndex, key, value) => {
    handleItemChange(rowIndex, key, value);
  };

  return (
    <div className="window">
      <div className="screen-title">Purchase Return Creation</div>

      {message && <div className={`message ${messageType}`}>{message}</div>}

      {pendingReturns.length > 0 && (
        <div style={{
          backgroundColor: '#fff3e0',
          border: '1px solid #ffe0b2',
          borderRadius: '6px',
          padding: '10px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
        }}>
          <span style={{ fontWeight: 'bold', color: '#e65100', fontSize: '13px', whiteSpace: 'nowrap' }}>
            ⚠️ Pending QC Rejected Items ({pendingReturns.length}):
          </span>
          <select
            value={selectedPendingLot}
            onChange={(e) => handleSelectPendingReturn(e.target.value)}
            style={{
              flex: 1,
              padding: '6px 12px',
              border: '1px solid #f57c00',
              borderRadius: '4px',
              fontSize: '13px',
              fontWeight: '600',
              backgroundColor: '#ffffff',
              cursor: 'pointer'
            }}
          >
            <option value="">-- Select Pending Return Item / Lot --</option>
            {pendingReturns.map((pr, idx) => (
              <option key={idx} value={pr.lot_no}>
                Lot: {pr.lot_no} | Item: {pr.item_name} | Supplier: {pr.supplier_print_name || pr.supplier_name || pr.supplier_id} | Qty: {pr.qty} | Inv: {pr.inv_no || '-'}
              </option>
            ))}
          </select>
        </div>
      )}

      <EntryTopFrame 
        fields={topFrameFields} 
        data={formData} 
        onChange={handleFormChange}
        columns={4}
      />

      <EntrySection title="Items">
        <EntryItemsTable 
          columns={itemColumns}
          data={items}
          onRowChange={handleRowChange}
          onAddRow={addItem}
          onDeleteRow={deleteItem}
          showActions={true}
          lotMode="select"
        />
      </EntrySection>

      <EntrySection title="Purchase Deductions">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', color: '#1f3f67', fontWeight: 'bold' }}>Deductions List</span>
          <select
            value=""
            onChange={(e) => {
              const dedId = e.target.value;
              if (!dedId) return;
              const master = masterDeductions.find(d => String(d.id) === String(dedId));
              if (master) {
                const newDed = {
                  deduction_id: master.id,
                  id: master.id,
                  name: master.ded_name || master.name || master.deduction_name,
                  type: String(master.type || master.ded_type || master.deduction_type || 'LESS').toUpperCase(),
                  calculation_type: master.calculation_type || master.calc_type || 'Percentage',
                  percent: parseFloat(master.deduction_value || master.ded_value || 0) || 0,
                  amount: 0
                };
                const updated = [...selectedDeductions, newDed];
                recalculateAll(items, updated);
              }
            }}
            style={{ padding: '6px 12px', border: '1px solid #7fa1d6', borderRadius: '4px', fontSize: '13px', backgroundColor: '#fff', cursor: 'pointer' }}
          >
            <option value="">+ Add Purchase Deduction</option>
            {masterDeductions.map((d, idx) => (
              <option key={`${d.id || 'ded'}-${idx}`} value={d.id}>
                {d.ded_name || d.name || d.deduction_name} ({d.type || d.ded_type || 'Less'})
              </option>
            ))}
          </select>
        </div>

        {selectedDeductions.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', border: '1px solid #c7d6f3', borderRadius: '4px' }}>
              <thead>
                <tr style={{ backgroundColor: '#1f4fb2', color: '#fff', fontSize: '13px', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px' }}>Deduction Name</th>
                  <th style={{ padding: '8px 12px' }}>Type</th>
                  <th style={{ padding: '8px 12px' }}>% / Value</th>
                  <th style={{ padding: '8px 12px' }}>Calculated Amount (₹)</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {selectedDeductions.map((ded, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0', fontSize: '13px' }}>
                    <td style={{ padding: '8px 12px', fontWeight: '500' }}>{ded.name || ded.deduction_name}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <select
                        value={(ded.type || 'LESS').toUpperCase()}
                        onChange={(e) => handleDeductionChange(idx, 'type', e.target.value)}
                        style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: '4px' }}
                      >
                        <option value="ADD">ADD (+)</option>
                        <option value="LESS">LESS (-)</option>
                      </select>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <input
                        type="number"
                        step="0.01"
                        value={ded.percent ?? ded.percentage ?? ''}
                        onChange={(e) => handleDeductionChange(idx, 'percent', e.target.value)}
                        style={{ width: '90px', padding: '4px 8px', border: '1px solid #ccc', borderRadius: '4px' }}
                      />
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <input
                        type="number"
                        step="0.01"
                        value={ded.amount !== undefined && ded.amount !== null ? parseFloat(ded.amount).toFixed(2) : ''}
                        onChange={(e) => handleDeductionChange(idx, 'amount', e.target.value)}
                        style={{ width: '110px', padding: '4px 8px', border: '1px solid #ccc', borderRadius: '4px', fontWeight: 'bold', color: '#1f4fb2' }}
                      />
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = selectedDeductions.filter((_, i) => i !== idx);
                          recalculateAll(items, updated);
                        }}
                        style={{ backgroundColor: '#f44336', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ fontSize: '13px', color: '#666', fontStyle: 'italic', padding: '8px 0' }}>
            No purchase deductions added. Select from the dropdown above to add deductions.
          </div>
        )}
      </EntrySection>

      <EntryTotalsRow totals={totalsArr} />

      <EntryBottomSummary 
        summaryFields={summaryFields}
        formData={totals}
      />

      <EntryActions 
        onSave={handleSave}
        saving={loading}
        saveText="Save"
      />
    </div>
  );
};

export default PurchaseReturn;
