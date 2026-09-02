import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Select,
  MenuItem,
  Button,
  Table,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
  Box,
  Alert,
  FormControlLabel,
  Switch,
  IconButton,
  Chip,
} from '@mui/material';

import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useNavigate, Link, useLocation, useParams } from 'react-router-dom';
import voucherAPI from './voucherService.js';
import { safeArray } from '../../utils/safeArray.js';

const VOUCHER_TYPES = ['Payment', 'Receipt', 'Contra', 'Journal'];

const VoucherCreate = ({ voucherId = null, isEdit = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: paramId } = useParams();
  
  const actualVoucherId = voucherId || paramId;
  const actualIsEdit = isEdit || !!paramId;

  const [formData, setFormData] = useState({
    voucher_type: 'Payment',
    voucher_no: '',
    auto_voucher_no: true,
    date: new Date().toISOString().split('T')[0],
    reference_no: '',
    narration: ''
  });

  // Standard journal entries state
  const [entries, setEntries] = useState([
    { type: 'Dr', ledger_id: '', ledger_name: '', debit: '', credit: '', remarks: '' },
    { type: 'Cr', ledger_id: '', ledger_name: '', debit: '', credit: '', remarks: '' }
  ]);

  // Specialized Payment Voucher State
  const [paymentState, setPaymentState] = useState({
    party_ledger_id: '',
    cash_ledger_id: '',
    amount: '',
    reference_no: ''
  });

  // Specialized Receipt Voucher State
  const [receiptState, setReceiptState] = useState({
    party_ledger_id: '',
    cash_ledger_id: '',
    amount: '',
    reference_no: ''
  });

  // Specialized Contra Voucher State
  const [contraState, setContraState] = useState({
    from_ledger_id: '',
    to_ledger_id: '',
    amount: '',
    reference_no: ''
  });

  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totals, setTotals] = useState({ debit: 0, credit: 0 });
  const [ledgerBalances, setLedgerBalances] = useState({});

  const [outstandingBills, setOutstandingBills] = useState([]);
  const [selectedBills, setSelectedBills] = useState({});
  const [isEditLoaded, setIsEditLoaded] = useState(false);

  // Quick Bill / Voucher No search state
  const [searchableBills, setSearchableBills] = useState([]);
  const [selectedQuickBillKey, setSelectedQuickBillKey] = useState('');
  const [manualSearchNo, setManualSearchNo] = useState('');
  const [quickAlert, setQuickAlert] = useState('');

  const cleanLedgerName = (name) => {
    if (!name) return '';
    return name.replace(/\s*\((Supplier|Customer|Papad Co|Flour Mill)\)$/i, '').trim();
  };

  const isPurchaseOrPayable = (bill, currentLedgers = ledgers) => {
    if (!bill) return false;
    const bType = String(bill.type || '').toLowerCase();
    const vType = String(bill.voucher_type || '').toLowerCase();
    const invNo = String(bill.invoice_no || bill.voucher_no || '').toUpperCase();
    const lName = cleanLedgerName(bill.ledger_name).toLowerCase();

    if (bType === 'payable' || bType === 'purchase' || vType === 'purchase' || vType === 'payment') return true;
    if (bType === 'receivable' || bType === 'sales' || vType === 'sales' || vType === 'receipt') return false;
    if (invNo.startsWith('PUR')) return true;
    if (invNo.startsWith('SAL') || invNo.startsWith('INV')) return false;

    if (currentLedgers && currentLedgers.length > 0) {
      const matched = currentLedgers.find(l => cleanLedgerName(l.name).toLowerCase() === lName);
      if (matched) {
        const lType = String(matched.ledger_type || '').toLowerCase();
        const gName = String(matched.group_name || '').toLowerCase();
        if (lType === 'supplier' || gName.includes('creditor') || gName.includes('supplier')) return true;
        if (lType === 'customer' || gName.includes('debtor') || gName.includes('customer')) return false;
      }
    }

    if (lName.includes('supplier')) return true;
    return false;
  };

  const applyBillToVoucher = (bill, currentLedgers = ledgers) => {
    if (!bill) return;
    const isPayable = isPurchaseOrPayable(bill, currentLedgers);
    const targetType = isPayable ? 'Payment' : 'Receipt';
    const rawPartyStr = String(bill.ledger_name || '');
    
    const matchedList = currentLedgers && currentLedgers.length > 0 ? currentLedgers : ledgers;
    
    // Split by comma in case bill.ledger_name has multiple ledger names joined by comma (e.g., "ABC, Sales Account, Output Tax")
    const partyParts = rawPartyStr.split(',').map(p => cleanLedgerName(p.trim())).filter(Boolean);
    
    let matchedLedger = null;
    
    // 1. First attempt: find party matching target type preference (Supplier for Payment, Customer for Receipt)
    for (const part of partyParts) {
      const partLower = part.toLowerCase();
      const found = matchedList.find(l => {
        const lName = cleanLedgerName(l.name).toLowerCase();
        if (lName !== partLower) return false;
        const lType = String(l.ledger_type || '').toLowerCase();
        const gName = String(l.group_name || '').toLowerCase();
        if (targetType === 'Payment' && (lType === 'supplier' || gName.includes('creditor') || gName.includes('supplier'))) return true;
        if (targetType === 'Receipt' && (lType === 'customer' || gName.includes('debtor') || gName.includes('customer'))) return true;
        return false;
      });
      if (found) {
        matchedLedger = found;
        break;
      }
    }

    // 2. Second attempt: find any matching ledger among the party parts
    if (!matchedLedger) {
      for (const part of partyParts) {
        const partLower = part.toLowerCase();
        const found = matchedList.find(l => cleanLedgerName(l.name).toLowerCase() === partLower);
        if (found) {
          matchedLedger = found;
          break;
        }
      }
    }

    // 3. Fallback: match full string
    if (!matchedLedger) {
      const fullClean = cleanLedgerName(rawPartyStr).toLowerCase();
      matchedLedger = matchedList.find(l => cleanLedgerName(l.name).toLowerCase() === fullClean);
    }

    // Find default Cash/Bank ledger for payment/receipt cash_ledger_id if needed
    const defaultCashBank = matchedList.find(l => {
      const lType = String(l.ledger_type || '').toLowerCase();
      const lName = String(l.name || '').toLowerCase();
      return lType === 'cash' || lType === 'bank' || lName.includes('cash') || lName.includes('bank');
    });

    const refVal = String(bill.invoice_no || bill.voucher_no || '');

    setFormData(prev => ({
      ...prev,
      voucher_type: targetType,
      reference_no: refVal ? `${refVal}` : prev.reference_no,
      narration: `Settlement voucher for ${isPayable ? 'Purchase Invoice' : 'Sales Bill'} #${refVal}`
    }));

    const settleAmt = String(bill.balance !== undefined ? bill.balance : (bill.amount || ''));

    if (matchedLedger) {
      if (targetType === 'Payment') {
        setPaymentState(prev => ({
          ...prev,
          party_ledger_id: matchedLedger.id,
          cash_ledger_id: prev.cash_ledger_id || (defaultCashBank ? defaultCashBank.id : ''),
          amount: settleAmt,
          reference_no: refVal
        }));
      } else {
        setReceiptState(prev => ({
          ...prev,
          party_ledger_id: matchedLedger.id,
          cash_ledger_id: prev.cash_ledger_id || (defaultCashBank ? defaultCashBank.id : ''),
          amount: settleAmt,
          reference_no: refVal
        }));
      }
      fetchLedgerBalance(matchedLedger.name);
      fetchOutstandingBills(matchedLedger.name, targetType, `Ref: ${refVal}`, parseFloat(settleAmt) || 0);
    }
  };

  const fetchOutstandingBills = async (ledgerName, type, matchedRemarks = '', loadedAmount = 0) => {
    if (!ledgerName) {
      setOutstandingBills([]);
      setSelectedBills({});
      return;
    }
    const cleanName = cleanLedgerName(ledgerName);
    try {
      const response = await fetch(`/api/reports/outstanding-details?ledger_name=${encodeURIComponent(cleanName)}`);
      const result = await response.json();
      const bills = Array.isArray(result) ? result : (result.data || []);
      const filteredBills = bills.filter(b => b.type === (type === 'Payment' ? 'Payable' : 'Receivable'));

      const matchedInvoices = [];
      if (matchedRemarks && matchedRemarks.startsWith('Ref:')) {
        const parts = matchedRemarks.replace(/^Ref:\s*/, '').split(',');
        parts.forEach(p => {
          const cleaned = p.trim();
          if (cleaned) matchedInvoices.push(cleaned);
        });
      }

      const resolvedBills = [...filteredBills];
      const initialSelected = {};

      resolvedBills.forEach(b => {
        const isMatched = matchedInvoices.includes(String(b.invoice_no).trim());
        initialSelected[b.invoice_no] = {
          selected: isMatched,
          invoice_amount: b.amount,
          balance: b.balance,
          allocated: isMatched ? Math.min(b.balance, loadedAmount || b.balance).toFixed(2) : ''
        };
      });

      matchedInvoices.forEach(invNo => {
        if (!initialSelected[invNo]) {
          initialSelected[invNo] = {
            selected: true,
            invoice_amount: loadedAmount,
            balance: loadedAmount,
            allocated: parseFloat(loadedAmount).toFixed(2)
          };
          resolvedBills.push({
            invoice_no: invNo,
            date: formData.date,
            amount: loadedAmount,
            balance: loadedAmount,
            paid: 0,
            type: type === 'Payment' ? 'Payable' : 'Receivable'
          });
        }
      });

      setOutstandingBills(resolvedBills);
      setSelectedBills(initialSelected);
    } catch (err) {
      console.error('Failed to fetch outstanding bills:', err);
    }
  };

  const handleOverallAmountChange = (amountStr, currentBills = outstandingBills) => {
    const totalAmt = parseFloat(amountStr) || 0;
    let remaining = totalAmt;
    
    const updatedSelected = { ...selectedBills };
    
    // Reset allocations first
    Object.keys(updatedSelected).forEach(key => {
      updatedSelected[key] = {
        ...updatedSelected[key],
        selected: false,
        allocated: ''
      };
    });
    
    // Allocate chronologically (FIFO)
    currentBills.forEach(bill => {
      if (remaining <= 0) return;
      
      const maxAllocatable = bill.balance;
      const allocation = Math.min(maxAllocatable, remaining);
      
      if (allocation > 0) {
        updatedSelected[bill.invoice_no] = {
          selected: true,
          invoice_amount: bill.amount,
          balance: bill.balance,
          allocated: allocation.toFixed(2)
        };
        remaining -= allocation;
      }
    });
    
    setSelectedBills(updatedSelected);
  };

  const handleBillAllocatedChange = (invoiceNo, val) => {
    const updatedSelected = { ...selectedBills };
    const numVal = parseFloat(val) || 0;
    updatedSelected[invoiceNo] = {
      ...updatedSelected[invoiceNo],
      allocated: val,
      selected: numVal > 0
    };
    setSelectedBills(updatedSelected);
    
    // Recalculate total payment/receipt amount as sum of allocations
    const totalAllocated = Object.values(updatedSelected)
      .filter(b => b.selected)
      .reduce((sum, b) => sum + (parseFloat(b.allocated) || 0), 0);
    
    if (formData.voucher_type === 'Payment') {
      setPaymentState(prev => ({ ...prev, amount: totalAllocated > 0 ? totalAllocated.toFixed(2) : '' }));
    } else if (formData.voucher_type === 'Receipt') {
      setReceiptState(prev => ({ ...prev, amount: totalAllocated > 0 ? totalAllocated.toFixed(2) : '' }));
    }
  };

  const handleBillCheckboxChange = (invoiceNo, checked, balance) => {
    const updatedSelected = { ...selectedBills };
    if (checked) {
      let currentVoucherAmt = 0;
      if (formData.voucher_type === 'Payment') {
        currentVoucherAmt = parseFloat(paymentState.amount) || 0;
      } else if (formData.voucher_type === 'Receipt') {
        currentVoucherAmt = parseFloat(receiptState.amount) || 0;
      }
      
      const alreadyAllocated = Object.entries(updatedSelected)
        .filter(([key, b]) => b.selected && key !== invoiceNo)
        .reduce((sum, [_, b]) => sum + (parseFloat(b.allocated) || 0), 0);
      
      const remainingToAllocate = Math.max(0, currentVoucherAmt - alreadyAllocated);
      const allocation = remainingToAllocate > 0 ? Math.min(balance, remainingToAllocate) : balance;
      
      updatedSelected[invoiceNo] = {
        ...updatedSelected[invoiceNo],
        selected: true,
        allocated: allocation.toFixed(2)
      };
    } else {
      updatedSelected[invoiceNo] = {
        ...updatedSelected[invoiceNo],
        selected: false,
        allocated: ''
      };
    }
    setSelectedBills(updatedSelected);
    
    // Re-sum totals
    const totalAllocated = Object.values(updatedSelected)
      .filter(b => b.selected)
      .reduce((sum, b) => sum + (parseFloat(b.allocated) || 0), 0);
      
    if (formData.voucher_type === 'Payment') {
      setPaymentState(prev => ({ ...prev, amount: totalAllocated > 0 ? totalAllocated.toFixed(2) : '' }));
    } else if (formData.voucher_type === 'Receipt') {
      setReceiptState(prev => ({ ...prev, amount: totalAllocated > 0 ? totalAllocated.toFixed(2) : '' }));
    }
  };

  const fetchLedgerBalance = async (ledgerName) => {
    if (!ledgerName) return;
    try {
      const response = await fetch(`/api/reports/ledger/${encodeURIComponent(ledgerName)}`);
      const result = await response.json();
      if (result && result.closingBalance !== undefined) {
        setLedgerBalances(prev => ({
          ...prev,
          [ledgerName]: result.closingBalance
        }));
      }
    } catch (err) {
      console.error('Failed to fetch ledger balance:', err);
    }
  };

  // Fetch all pending bills for Quick Search
  useEffect(() => {
    fetch('/api/reports/outstanding-details')
      .then(r => r.json())
      .then(data => {
        const bills = Array.isArray(data) ? data : (data.data || []);
        const mapped = bills.map((b, idx) => ({
          ...b,
          key: `${b.ledger_name}_${b.type}_${b.invoice_no}_${idx}`
        }));
        setSearchableBills(mapped);
      })
      .catch(err => console.error('Failed to load searchable bills:', err));
  }, []);

  // Load ledgers and existing voucher if editing/duplicating or settling bill
  useEffect(() => {
    voucherAPI.getLedgers().then(res => {
      const parsedLedgers = safeArray(res);
      setLedgers(parsedLedgers);
      if (actualIsEdit && actualVoucherId) {
        loadVoucher(actualVoucherId, parsedLedgers);
      } else if (location.state?.prefillBill) {
        applyBillToVoucher(location.state.prefillBill, parsedLedgers);
        setQuickAlert(`✓ Auto-filled voucher details for ${location.state.prefillBill.type === 'Payable' ? 'Purchase Invoice' : 'Sales Bill'} #${location.state.prefillBill.invoice_no || location.state.prefillBill.voucher_no} (${location.state.prefillBill.ledger_name})`);
      } else if (location.state?.prefillVoucherNo) {
        const searchNo = String(location.state.prefillVoucherNo).trim().toLowerCase();
        fetch('/api/reports/outstanding-details')
          .then(r => r.json())
          .then(data => {
            const bills = Array.isArray(data) ? data : (data.data || []);
            const matched = bills.find(b => String(b.invoice_no).toLowerCase() === searchNo || String(b.voucher_no || '').toLowerCase() === searchNo);
            if (matched) {
              applyBillToVoucher(matched, parsedLedgers);
              setQuickAlert(`✓ Auto-filled voucher details for ${matched.type === 'Payable' ? 'Purchase Invoice' : 'Sales Bill'} #${matched.invoice_no} (${matched.ledger_name})`);
            }
          });
      } else if (location.state?.prefill) {
        const pre = location.state.prefill;
        setFormData({
          voucher_type: pre.voucher_type,
          voucher_no: '',
          auto_voucher_no: true,
          date: pre.date,
          reference_no: pre.reference_no || '',
          narration: pre.narration || ''
        });

        // Populate standard/specialized forms depending on prefill type
        if (pre.voucher_type === 'Payment') {
          const drEntry = pre.entries.find(e => e.type === 'Dr');
          const crEntry = pre.entries.find(e => e.type === 'Cr');
          setPaymentState({
            party_ledger_id: drEntry ? drEntry.ledger_id : '',
            cash_ledger_id: crEntry ? crEntry.ledger_id : '',
            amount: drEntry ? (drEntry.debit || drEntry.credit || '') : '',
            reference_no: drEntry ? (drEntry.remarks || '') : ''
          });
        } else if (pre.voucher_type === 'Receipt') {
          const drEntry = pre.entries.find(e => e.type === 'Dr');
          const crEntry = pre.entries.find(e => e.type === 'Cr');
          setReceiptState({
            party_ledger_id: crEntry ? crEntry.ledger_id : '',
            cash_ledger_id: drEntry ? drEntry.ledger_id : '',
            amount: drEntry ? (drEntry.debit || drEntry.credit || '') : '',
            reference_no: drEntry ? (drEntry.remarks || '') : ''
          });
        } else if (pre.voucher_type === 'Contra') {
          const drEntry = pre.entries.find(e => e.type === 'Dr');
          const crEntry = pre.entries.find(e => e.type === 'Cr');
          setContraState({
            from_ledger_id: crEntry ? crEntry.ledger_id : '',
            to_ledger_id: drEntry ? drEntry.ledger_id : '',
            amount: drEntry ? (drEntry.debit || drEntry.credit || '') : '',
            reference_no: drEntry ? (drEntry.remarks || '') : ''
          });
        } else {
          setEntries(pre.entries.map(e => {
            if (e.ledger_name) fetchLedgerBalance(e.ledger_name);
            return {
              type: e.type,
              ledger_id: e.ledger_id,
              ledger_name: e.ledger_name || '',
              debit: e.debit || '',
              credit: e.credit || '',
              remarks: e.remarks || ''
            };
          }));
          calculateTotals(pre.entries);
        }
      }
    });
  }, []);

  // Fetch balance for selected specialized ledgers and their outstanding invoices
  useEffect(() => {
    if (formData.voucher_type === 'Payment' && paymentState.party_ledger_id) {
      const ledger = ledgers.find(l => l.id == paymentState.party_ledger_id);
      if (ledger) {
        fetchLedgerBalance(ledger.name);
        if (!actualIsEdit || isEditLoaded) {
          fetchOutstandingBills(ledger.name, 'Payment');
        }
      }
    } else {
      if (!actualIsEdit || isEditLoaded) {
        setOutstandingBills([]);
        setSelectedBills({});
      }
    }
  }, [paymentState.party_ledger_id, ledgers, formData.voucher_type, isEditLoaded]);

  useEffect(() => {
    if (formData.voucher_type === 'Payment' && paymentState.cash_ledger_id) {
      const ledger = ledgers.find(l => l.id == paymentState.cash_ledger_id);
      if (ledger) fetchLedgerBalance(ledger.name);
    }
  }, [paymentState.cash_ledger_id, ledgers, formData.voucher_type]);

  useEffect(() => {
    if (formData.voucher_type === 'Receipt' && receiptState.party_ledger_id) {
      const ledger = ledgers.find(l => l.id == receiptState.party_ledger_id);
      if (ledger) {
        fetchLedgerBalance(ledger.name);
        if (!actualIsEdit || isEditLoaded) {
          fetchOutstandingBills(ledger.name, 'Receipt');
        }
      }
    } else {
      if (!actualIsEdit || isEditLoaded) {
        setOutstandingBills([]);
        setSelectedBills({});
      }
    }
  }, [receiptState.party_ledger_id, ledgers, formData.voucher_type, isEditLoaded]);

  useEffect(() => {
    if (formData.voucher_type === 'Receipt' && receiptState.cash_ledger_id) {
      const ledger = ledgers.find(l => l.id == receiptState.cash_ledger_id);
      if (ledger) fetchLedgerBalance(ledger.name);
    }
  }, [receiptState.cash_ledger_id, ledgers, formData.voucher_type]);

  useEffect(() => {
    if (formData.voucher_type === 'Contra' && contraState.from_ledger_id) {
      const ledger = ledgers.find(l => l.id == contraState.from_ledger_id);
      if (ledger) fetchLedgerBalance(ledger.name);
    }
    if (formData.voucher_type === 'Contra' && contraState.to_ledger_id) {
      const ledger = ledgers.find(l => l.id == contraState.to_ledger_id);
      if (ledger) fetchLedgerBalance(ledger.name);
    }
  }, [contraState.from_ledger_id, contraState.to_ledger_id, ledgers, formData.voucher_type]);

  const updatePreviewNo = async () => {
    if (formData.auto_voucher_no && formData.voucher_type) {
      try {
        const res = await voucherAPI.previewVoucherNo({ voucher_type: formData.voucher_type });
        setFormData(f => ({...f, voucher_no: res.voucher_no }));
      } catch (err) {
        console.error('Preview failed:', err);
      }
    }
  };

  useEffect(() => {
    const timer = setTimeout(updatePreviewNo, 300);
    return () => clearTimeout(timer);
  }, [formData.voucher_type]);

  const loadVoucher = async (id, parsedLedgers = ledgers) => {
    try {
      const data = await voucherAPI.get(id);
      setFormData({
        voucher_type: data.voucher_type,
        voucher_no: data.voucher_no,
        auto_voucher_no: false,
        date: data.date,
        reference_no: data.reference_no || '',
        narration: data.narration || ''
      });

      // Map loaded entries back to specialized form states or standard journal table
      if (data.voucher_type === 'Payment') {
        const drEntry = data.entries.find(e => e.type === 'Dr');
        const crEntry = data.entries.find(e => e.type === 'Cr');
        setPaymentState({
          party_ledger_id: drEntry ? drEntry.ledger_id : '',
          cash_ledger_id: crEntry ? crEntry.ledger_id : '',
          amount: drEntry ? (drEntry.debit || drEntry.credit || '') : '',
          reference_no: crEntry ? (crEntry.remarks || '').replace(/^Ref:\s*/, '') : ''
        });
        if (drEntry && drEntry.ledger_name) {
          fetchLedgerBalance(drEntry.ledger_name);
          fetchOutstandingBills(drEntry.ledger_name, 'Payment', drEntry.remarks, drEntry.debit || drEntry.credit || 0);
        }
        if (crEntry && crEntry.ledger_name) fetchLedgerBalance(crEntry.ledger_name);
      } else if (data.voucher_type === 'Receipt') {
        const drEntry = data.entries.find(e => e.type === 'Dr');
        const crEntry = data.entries.find(e => e.type === 'Cr');
        setReceiptState({
          party_ledger_id: crEntry ? crEntry.ledger_id : '',
          cash_ledger_id: drEntry ? drEntry.ledger_id : '',
          amount: drEntry ? (drEntry.debit || drEntry.credit || '') : '',
          reference_no: drEntry ? (drEntry.remarks || '').replace(/^Ref:\s*/, '') : ''
        });
        if (crEntry && crEntry.ledger_name) {
          fetchLedgerBalance(crEntry.ledger_name);
          fetchOutstandingBills(crEntry.ledger_name, 'Receipt', crEntry.remarks, drEntry.debit || drEntry.credit || 0);
        }
        if (drEntry && drEntry.ledger_name) fetchLedgerBalance(drEntry.ledger_name);
      } else if (data.voucher_type === 'Contra') {
        const drEntry = data.entries.find(e => e.type === 'Dr');
        const crEntry = data.entries.find(e => e.type === 'Cr');
        setContraState({
          from_ledger_id: crEntry ? crEntry.ledger_id : '',
          to_ledger_id: drEntry ? drEntry.ledger_id : '',
          amount: drEntry ? (drEntry.debit || drEntry.credit || '') : '',
          reference_no: drEntry ? (drEntry.remarks || '').replace(/^Ref:\s*/, '') : ''
        });
        if (drEntry && drEntry.ledger_name) fetchLedgerBalance(drEntry.ledger_name);
        if (crEntry && crEntry.ledger_name) fetchLedgerBalance(crEntry.ledger_name);
      } else {
        setEntries(data.entries.map(e => {
          if (e.ledger_name) fetchLedgerBalance(e.ledger_name);
          return {
            type: e.type || 'Dr',
            ledger_id: e.ledger_id || '',
            ledger_name: e.ledger_name || '',
            debit: e.debit || '',
            credit: e.credit || '',
            remarks: e.remarks || ''
          };
        }));
        calculateTotals(data.entries);
      }
      setIsEditLoaded(true);
    } catch (err) {
      setError('Failed to load voucher');
    }
  };

  const updateEntry = (index, field, value) => {
    const newEntries = [...entries];
    if (field === 'type') {
      newEntries[index].debit = '';
      newEntries[index].credit = '';
    } else if (field === 'debit' || field === 'credit') {
      newEntries[index][field === 'debit' ? 'credit' : 'debit'] = '';
    } else if (field === 'ledger_id') {
      const ledger = ledgers.find(l => l.id == value);
      const ledgerName = ledger ? ledger.name : '';
      newEntries[index].ledger_name = ledgerName;
      if (ledgerName) fetchLedgerBalance(ledgerName);
    }
    newEntries[index][field] = value;
    setEntries(newEntries);
    calculateTotals(newEntries);
  };

  const addEntry = () => {
    setEntries([...entries, { type: 'Dr', ledger_id: '', ledger_name: '', debit: '', credit: '', remarks: '' }]);
  };

  const deleteEntry = (index) => {
    if (entries.length > 2) {
      setEntries(entries.filter((_, i) => i !== index));
    } else {
      setError('Minimum 2 entries required');
    }
  };

  const calculateTotals = (ents = entries) => {
    const debit = ents.reduce((sum, e) => sum + Number(e.debit || 0), 0);
    const credit = ents.reduce((sum, e) => sum + Number(e.credit || 0), 0);
    setTotals({ debit, credit });
  };

  const validateForm = () => {
    if (formData.voucher_type === 'Journal') {
      if (entries.length < 2) return 'Minimum 2 entries required';

      const debitPaise = Math.round(Number(totals.debit || 0) * 100);
      const creditPaise = Math.round(Number(totals.credit || 0) * 100);
      if (debitPaise !== creditPaise) return 'Debit and Credit must balance';

      for (const e of entries) {
        if (!e.ledger_id) return 'Ledger required for all entries';
        if ((Number(e.debit) || 0) > 0 && (Number(e.credit) || 0) > 0) return 'Only one of debit or credit per entry';
        if ((Number(e.debit) || 0) === 0 && (Number(e.credit) || 0) === 0) return 'Entry must have amount';
      }
    } else if (formData.voucher_type === 'Payment') {
      if (!paymentState.party_ledger_id) return 'Party/Supplier is required';
      if (!paymentState.cash_ledger_id) return 'Cash/Bank account is required';
      if (!paymentState.amount || Number(paymentState.amount) <= 0) return 'Valid payment amount is required';
      if (paymentState.party_ledger_id === paymentState.cash_ledger_id) return 'Party and Cash/Bank account must be different';
    } else if (formData.voucher_type === 'Receipt') {
      if (!receiptState.party_ledger_id) return 'Party/Customer is required';
      if (!receiptState.cash_ledger_id) return 'Cash/Bank account is required';
      if (!receiptState.amount || Number(receiptState.amount) <= 0) return 'Valid receipt amount is required';
      if (receiptState.party_ledger_id === receiptState.cash_ledger_id) return 'Party and Cash/Bank account must be different';
    } else if (formData.voucher_type === 'Contra') {
      if (!contraState.from_ledger_id) return 'Source account is required';
      if (!contraState.to_ledger_id) return 'Destination account is required';
      if (!contraState.amount || Number(contraState.amount) <= 0) return 'Valid transfer amount is required';
      if (contraState.from_ledger_id === contraState.to_ledger_id) return 'Source and Destination accounts must be different';
    }

    if (formData.auto_voucher_no && !formData.voucher_type) return 'Voucher type required for auto numbering';
    return '';
  };

  const handleSubmit = async () => {
    const valErr = validateForm();
    if (valErr) {
      setError(valErr);
      return;
    }

    // Process double entry rows dynamically depending on the selected specialized form
    let finalEntries = [];
    if (formData.voucher_type === 'Payment') {
      const selectedBillList = Object.entries(selectedBills)
        .filter(([_, b]) => b.selected && parseFloat(b.allocated) > 0)
        .map(([invNo, b]) => `${invNo}`);
      const billingRef = selectedBillList.length > 0 ? `Ref: ${selectedBillList.join(', ')}` : '';

      finalEntries = [
        {
          type: 'Dr',
          ledger_id: parseInt(paymentState.party_ledger_id),
          debit: Number(paymentState.amount),
          credit: 0,
          remarks: billingRef || (paymentState.reference_no ? `Ref: ${paymentState.reference_no}` : '')
        },
        {
          type: 'Cr',
          ledger_id: parseInt(paymentState.cash_ledger_id),
          debit: 0,
          credit: Number(paymentState.amount),
          remarks: paymentState.reference_no ? `Ref: ${paymentState.reference_no}` : ''
        }
      ];
    } else if (formData.voucher_type === 'Receipt') {
      const selectedBillList = Object.entries(selectedBills)
        .filter(([_, b]) => b.selected && parseFloat(b.allocated) > 0)
        .map(([invNo, b]) => `${invNo}`);
      const billingRef = selectedBillList.length > 0 ? `Ref: ${selectedBillList.join(', ')}` : '';

      finalEntries = [
        {
          type: 'Dr',
          ledger_id: parseInt(receiptState.cash_ledger_id),
          debit: Number(receiptState.amount),
          credit: 0,
          remarks: receiptState.reference_no ? `Ref: ${receiptState.reference_no}` : ''
        },
        {
          type: 'Cr',
          ledger_id: parseInt(receiptState.party_ledger_id),
          debit: 0,
          credit: Number(receiptState.amount),
          remarks: billingRef || (receiptState.reference_no ? `Ref: ${receiptState.reference_no}` : '')
        }
      ];
    } else if (formData.voucher_type === 'Contra') {
      finalEntries = [
        {
          type: 'Dr',
          ledger_id: parseInt(contraState.to_ledger_id),
          debit: Number(contraState.amount),
          credit: 0,
          remarks: contraState.reference_no ? `Ref: ${contraState.reference_no}` : ''
        },
        {
          type: 'Cr',
          ledger_id: parseInt(contraState.from_ledger_id),
          debit: 0,
          credit: Number(contraState.amount),
          remarks: contraState.reference_no ? `Ref: ${contraState.reference_no}` : ''
        }
      ];
    } else {
      finalEntries = entries.map(e => ({
        type: e.type,
        ledger_id: parseInt(e.ledger_id),
        debit: Number(e.debit) || 0,
        credit: Number(e.credit) || 0,
        remarks: e.remarks
      }));
    }

    const submitData = {
      ...formData,
      entries: finalEntries
    };
    if (submitData.auto_voucher_no) delete submitData.voucher_no;

    setLoading(true);
    setError('');
    try {
      if (actualIsEdit) {
        await voucherAPI.update(actualVoucherId, submitData);
      } else {
        await voucherAPI.create(submitData);
      }
      alert(actualIsEdit ? 'Voucher updated successfully!' : 'Voucher created successfully!');
      navigate('/entry/voucher-display');
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  // Check if save should be disabled
  const isSaveDisabled = () => {
    if (loading) return true;
    if (formData.voucher_type === 'Journal') {
      const debitPaise = Math.round(Number(totals.debit || 0) * 100);
      const creditPaise = Math.round(Number(totals.credit || 0) * 100);
      return debitPaise !== creditPaise || entries.length < 2;
    } else if (formData.voucher_type === 'Payment') {
      return !paymentState.party_ledger_id || !paymentState.cash_ledger_id || !paymentState.amount;
    } else if (formData.voucher_type === 'Receipt') {
      return !receiptState.party_ledger_id || !receiptState.cash_ledger_id || !receiptState.amount;
    } else if (formData.voucher_type === 'Contra') {
      return !contraState.from_ledger_id || !contraState.to_ledger_id || !contraState.amount;
    }
    return false;
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }} id="voucher-create-container">
      <Paper elevation={3} sx={{ p: 4, borderTop: '4px solid #1976d2', borderRadius: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, pb: 2, borderBottom: '1px solid #e0e0e0' }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#1565c0', letterSpacing: '0.03em' }}>
              {actualIsEdit ? 'EDIT VOUCHER' : 'CREATE VOUCHER'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Professional double-entry ledger bookkeeping
            </Typography>
          </Box>
          <Button
            component={Link}
            to="/entry/voucher-display"
            variant="outlined"
            size="small"
            color="primary"
            sx={{ fontWeight: 'bold' }}
          >
            ← BACK TO REGISTER
          </Button>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 3, fontWeight: 'medium' }}>{error}</Alert>}

        {/* Quick Bill / Voucher No Search Bar */}
        <Paper variant="outlined" sx={{ p: 2.5, mb: 3, bgcolor: '#f0f4fe', borderColor: '#c7d2fe', borderRadius: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#3730a3', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.95rem' }}>
            🔍 Select / Search by Voucher No or Bill / Invoice No to Settle
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <Box sx={{ flexGrow: 1, minWidth: 280 }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#4338ca', display: 'block', mb: 0.5 }}>
                Select Pending Bill / Invoice from List:
              </Typography>
              <Select
                size="small"
                fullWidth
                displayEmpty
                value={selectedQuickBillKey}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedQuickBillKey(val);
                  if (val) {
                    const foundBill = searchableBills.find(b => b.key === val);
                    if (foundBill) {
                      applyBillToVoucher(foundBill);
                      setQuickAlert(`✓ Auto-filled voucher details for ${foundBill.type === 'Payable' ? 'Purchase Invoice' : 'Sales Bill'} #${foundBill.invoice_no} (${foundBill.ledger_name}). Outstanding Balance: ₹${parseFloat(foundBill.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
                    }
                  }
                }}
                sx={{ bgcolor: '#fff' }}
              >
                <MenuItem value="">-- Select Pending Purchase Invoice / Sales Bill / Voucher --</MenuItem>
                {searchableBills.map(b => (
                  <MenuItem key={b.key} value={b.key}>
                    {b.type === 'Payable' ? '🛒 Purchase Inv' : '🏷️ Sales Bill'} #{b.invoice_no} — {b.ledger_name} (Bal: ₹{parseFloat(b.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })})
                  </MenuItem>
                ))}
              </Select>
            </Box>

            <Box sx={{ width: 220 }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#4338ca', display: 'block', mb: 0.5 }}>
                Or Type Voucher / Bill No:
              </Typography>
              <TextField
                size="small"
                fullWidth
                placeholder="e.g. 1, PUR-001, S001..."
                value={manualSearchNo}
                onChange={(e) => setManualSearchNo(e.target.value)}
                sx={{ bgcolor: '#fff' }}
              />
            </Box>

            <Box>
              <Button
                variant="contained"
                size="medium"
                onClick={() => {
                  if (!manualSearchNo.trim()) return;
                  const searchUpper = manualSearchNo.trim().toLowerCase();
                  const found = searchableBills.find(b => String(b.invoice_no).toLowerCase() === searchUpper || String(b.voucher_no || '').toLowerCase() === searchUpper);
                  if (found) {
                    applyBillToVoucher(found);
                    setQuickAlert(`✓ Auto-filled voucher details for ${found.type === 'Payable' ? 'Purchase Invoice' : 'Sales Bill'} #${found.invoice_no} (${found.ledger_name}). Outstanding Balance: ₹${parseFloat(found.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
                  } else {
                    alert(`No pending bill or invoice found matching "${manualSearchNo}". Please check the number.`);
                  }
                }}
                sx={{ bgcolor: '#4f46e5', fontWeight: 'bold', px: 3, textTransform: 'none', height: 40 }}
              >
                Proceed with Voucher
              </Button>
            </Box>
          </Box>

          {quickAlert && (
            <Alert severity="success" sx={{ mt: 2, py: 0.5, fontWeight: 'bold' }} onClose={() => setQuickAlert('')}>
              {quickAlert}
            </Alert>
          )}
        </Paper>

        {/* Top Voucher Info Bar */}
        <Box sx={{ mb: 4, p: 2, bgcolor: '#f8f9fa', borderRadius: 1, border: '1px solid #e9ecef' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#495057', mb: 2 }}>
            Voucher Configuration
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.auto_voucher_no}
                  onChange={(e) => {
                    setFormData({...formData, auto_voucher_no: e.target.checked});
                    if (e.target.checked) setFormData(f => ({...f, voucher_no: ''}));
                  }}
                  color="primary"
                />
              }
              label="Auto Voucher No"
              sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.9rem', fontWeight: 600 } }}
            />
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 150 }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Voucher Type</Typography>
              <Select
                value={formData.voucher_type}
                onChange={(e) => setFormData({...formData, voucher_type: e.target.value})}
                size="small"
                disabled={actualIsEdit}
                sx={{ bgcolor: '#fff' }}
              >
                {VOUCHER_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 140 }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Voucher Number</Typography>
              <TextField
                value={formData.voucher_no}
                onChange={(e) => setFormData({...formData, voucher_no: e.target.value})}
                disabled={formData.auto_voucher_no}
                size="small"
                placeholder="Auto-generated"
                sx={{ bgcolor: '#fff' }}
              />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 150 }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Transaction Date</Typography>
              <TextField
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                size="small"
                inputProps={{ min: '2020-01-01' }}
                sx={{ bgcolor: '#fff' }}
              />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 150 }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>General Reference No</Typography>
              <TextField
                placeholder="Optional Ref..."
                value={formData.reference_no}
                onChange={(e) => setFormData({...formData, reference_no: e.target.value})}
                size="small"
                sx={{ bgcolor: '#fff' }}
              />
            </Box>
          </Box>
        </Box>

        {/* 1. SPECIALIZED PAYMENT VOUCHER FORM */}
        {formData.voucher_type === 'Payment' && (
          <Paper variant="outlined" sx={{ p: 3, mb: 4, bgcolor: '#fdfdfd', borderColor: '#cfe2f3' }}>
            <Typography variant="subtitle1" gutterBottom sx={{ color: '#1565c0', fontWeight: 'bold', borderBottom: '1px solid #cfe2f3', pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              💸 Payment Settlement details
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 650, mt: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#495057' }}>Paid To (Supplier / Expense Ledger)</Typography>
                <Select
                  value={paymentState.party_ledger_id}
                  onChange={(e) => setPaymentState({ ...paymentState, party_ledger_id: e.target.value })}
                  size="small"
                  fullWidth
                  displayEmpty
                >
                  <MenuItem value="">-- Select Party / Ledger --</MenuItem>
                  {ledgers.filter(l => l.ledger_type !== 'Cash' && l.ledger_type !== 'Bank' && !l.name.toLowerCase().includes('cash') && !l.name.toLowerCase().includes('bank') && !l.name.toLowerCase().includes('petty')).map(l => (
                    <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>
                  ))}
                </Select>
                {(() => {
                  const ledger = ledgers.find(l => l.id == paymentState.party_ledger_id);
                  const balance = ledger ? ledgerBalances[ledger.name] : undefined;
                  if (balance !== undefined) {
                    const isDr = balance >= 0;
                    const colorVal = balance > 0 ? '#1565c0' : balance < 0 ? '#c62828' : 'text.secondary';
                    return (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5, px: 1 }}>
                        <Typography variant="caption" sx={{ color: colorVal, fontWeight: 'bold' }}>
                          Current Outstanding Balance: ₹{Math.abs(balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {isDr ? 'Dr' : 'Cr'}
                        </Typography>
                        <Button
                          size="small"
                          variant="text"
                          sx={{ fontSize: '11px', p: 0, minWidth: 'auto', textTransform: 'none', fontWeight: 'bold' }}
                          onClick={() => setPaymentState({ ...paymentState, amount: Math.abs(balance).toFixed(2) })}
                        >
                          [Settlement Full Balance]
                        </Button>
                      </Box>
                    );
                  }
                  return null;
                })()}
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#495057' }}>Paid From (Cash / Bank Account)</Typography>
                <Select
                  value={paymentState.cash_ledger_id}
                  onChange={(e) => setPaymentState({ ...paymentState, cash_ledger_id: e.target.value })}
                  size="small"
                  fullWidth
                  displayEmpty
                >
                  <MenuItem value="">-- Select Cash/Bank Account --</MenuItem>
                  {ledgers.filter(l => l.name.toLowerCase().includes('cash') || l.name.toLowerCase().includes('bank') || l.name.toLowerCase().includes('petty')).map(l => (
                    <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>
                  ))}
                </Select>
                {(() => {
                  const ledger = ledgers.find(l => l.id == paymentState.cash_ledger_id);
                  const balance = ledger ? ledgerBalances[ledger.name] : undefined;
                  if (balance !== undefined) {
                    return (
                      <Typography variant="caption" sx={{ mt: 0.5, px: 1, color: '#2e7d32', fontWeight: 'medium' }}>
                        Account Balance: ₹{Math.abs(balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {balance >= 0 ? 'Dr' : 'Cr'}
                      </Typography>
                    );
                  }
                  return null;
                })()}
              </Box>

              {outstandingBills.length > 0 && (
                <Box sx={{ p: 2.5, border: '1px solid #cfe2f3', borderRadius: 1.5, bgcolor: '#f4f8fb' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1565c0', mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.9rem' }}>📋 Outstanding Purchase Invoices to Settle</span>
                    <Button 
                      size="small" 
                      variant="outlined" 
                      sx={{ fontSize: '11px', textTransform: 'none', py: 0.2 }}
                      onClick={() => handleOverallAmountChange(paymentState.amount)}
                    >
                      FIFO Auto-Allocate
                    </Button>
                  </Typography>
                  <Table size="small" sx={{ bgcolor: '#fff', border: '1px solid #dee2e6', borderRadius: 1 }}>
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f1f3f5' }}>
                        <TableCell padding="checkbox" sx={{ fontWeight: 'bold' }}>Settle</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Invoice No</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Bill Amt (₹)</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Outstanding (₹)</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', width: 140 }}>Allocated Paid (₹)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {outstandingBills.map(bill => {
                        const billSelect = selectedBills[bill.invoice_no] || { selected: false, allocated: '' };
                        return (
                          <TableRow key={bill.invoice_no} hover>
                            <TableCell padding="checkbox">
                              <input
                                type="checkbox"
                                style={{ width: 18, height: 18, cursor: 'pointer' }}
                                checked={billSelect.selected}
                                onChange={(e) => handleBillCheckboxChange(bill.invoice_no, e.target.checked, bill.balance)}
                              />
                            </TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>{bill.invoice_no}</TableCell>
                            <TableCell>{bill.date}</TableCell>
                            <TableCell align="right">₹{bill.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell align="right" sx={{ color: '#c62828', fontWeight: 'bold' }}>₹{bill.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell align="right">
                              <TextField
                                size="small"
                                type="number"
                                value={billSelect.allocated}
                                onChange={(e) => handleBillAllocatedChange(bill.invoice_no, e.target.value)}
                                placeholder="0.00"
                                inputProps={{ min: '0', max: bill.balance, step: '0.01', style: { textAlign: 'right', fontWeight: 'bold', padding: '4px 8px' } }}
                                sx={{ width: 120, bgcolor: billSelect.selected ? '#e8f5e9' : '#fff' }}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {(() => {
                    const selectedKeys = Object.keys(selectedBills).filter(k => selectedBills[k]?.selected && parseFloat(selectedBills[k]?.allocated || 0) > 0);
                    if (selectedKeys.length === 0) return null;
                    const totalAllocated = selectedKeys.reduce((sum, k) => sum + parseFloat(selectedBills[k].allocated || 0), 0);
                    return (
                      <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1b5e20' }}>
                          ✅ Settling {selectedKeys.length} Purchase Invoice{selectedKeys.length > 1 ? 's' : ''}: #{selectedKeys.join(', #')}
                        </Typography>
                        <Chip label={`Total Payment: ₹${totalAllocated.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} color="success" size="small" sx={{ fontWeight: 'bold' }} />
                      </Box>
                    );
                  })()}
                </Box>
              )}

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#495057' }}>Amount Paid (₹)</Typography>
                  <TextField
                    type="number"
                    value={paymentState.amount}
                    onChange={(e) => {
                      setPaymentState({ ...paymentState, amount: e.target.value });
                      handleOverallAmountChange(e.target.value);
                    }}
                    size="small"
                    inputProps={{ min: '0.01', step: '0.01' }}
                    placeholder="0.00"
                    required
                    fullWidth
                  />
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#495057' }}>Payment Instrument / Ref No</Typography>
                  <TextField
                    value={paymentState.reference_no}
                    onChange={(e) => setPaymentState({ ...paymentState, reference_no: e.target.value })}
                    size="small"
                    placeholder="Chq No, UPI Ref, etc."
                    fullWidth
                  />
                </Box>
              </Box>
            </Box>
          </Paper>
        )}

        {/* 2. SPECIALIZED RECEIPT VOUCHER FORM */}
        {formData.voucher_type === 'Receipt' && (
          <Paper variant="outlined" sx={{ p: 3, mb: 4, bgcolor: '#fdfdfd', borderColor: '#d9ead3' }}>
            <Typography variant="subtitle1" gutterBottom sx={{ color: '#2e7d32', fontWeight: 'bold', borderBottom: '1px solid #d9ead3', pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              📥 Receipt Settlement details
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 650, mt: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#495057' }}>Received From (Customer / Ledger)</Typography>
                <Select
                  value={receiptState.party_ledger_id}
                  onChange={(e) => setReceiptState({ ...receiptState, party_ledger_id: e.target.value })}
                  size="small"
                  fullWidth
                  displayEmpty
                >
                  <MenuItem value="">-- Select Customer / Ledger --</MenuItem>
                  {ledgers.filter(l => l.ledger_type !== 'Cash' && l.ledger_type !== 'Bank' && !l.name.toLowerCase().includes('cash') && !l.name.toLowerCase().includes('bank') && !l.name.toLowerCase().includes('petty')).map(l => (
                    <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>
                  ))}
                </Select>
                {(() => {
                  const ledger = ledgers.find(l => l.id == receiptState.party_ledger_id);
                  const balance = ledger ? ledgerBalances[ledger.name] : undefined;
                  if (balance !== undefined) {
                    const isDr = balance >= 0;
                    const colorVal = balance > 0 ? '#1565c0' : balance < 0 ? '#c62828' : 'text.secondary';
                    return (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5, px: 1 }}>
                        <Typography variant="caption" sx={{ color: colorVal, fontWeight: 'bold' }}>
                          Current Outstanding Balance: ₹{Math.abs(balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {isDr ? 'Dr' : 'Cr'}
                        </Typography>
                        <Button
                          size="small"
                          variant="text"
                          sx={{ fontSize: '11px', p: 0, minWidth: 'auto', textTransform: 'none', fontWeight: 'bold' }}
                          onClick={() => setReceiptState({ ...receiptState, amount: Math.abs(balance).toFixed(2) })}
                        >
                          [Receive Full Balance]
                        </Button>
                      </Box>
                    );
                  }
                  return null;
                })()}
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#495057' }}>Received In (Cash / Bank Account)</Typography>
                <Select
                  value={receiptState.cash_ledger_id}
                  onChange={(e) => setReceiptState({ ...receiptState, cash_ledger_id: e.target.value })}
                  size="small"
                  fullWidth
                  displayEmpty
                >
                  <MenuItem value="">-- Select Cash/Bank Account --</MenuItem>
                  {ledgers.filter(l => l.name.toLowerCase().includes('cash') || l.name.toLowerCase().includes('bank') || l.name.toLowerCase().includes('petty')).map(l => (
                    <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>
                  ))}
                </Select>
                {(() => {
                  const ledger = ledgers.find(l => l.id == receiptState.cash_ledger_id);
                  const balance = ledger ? ledgerBalances[ledger.name] : undefined;
                  if (balance !== undefined) {
                    return (
                      <Typography variant="caption" sx={{ mt: 0.5, px: 1, color: '#2e7d32', fontWeight: 'medium' }}>
                        Account Balance: ₹{Math.abs(balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {balance >= 0 ? 'Dr' : 'Cr'}
                      </Typography>
                    );
                  }
                  return null;
                })()}
              </Box>

              {outstandingBills.length > 0 && (
                <Box sx={{ p: 2.5, border: '1px solid #d9ead3', borderRadius: 1.5, bgcolor: '#f9fbf8' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#2e7d32', mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.9rem' }}>📋 Outstanding Sales Invoices to Settle</span>
                    <Button 
                      size="small" 
                      variant="outlined" 
                      color="success"
                      sx={{ fontSize: '11px', textTransform: 'none', py: 0.2 }}
                      onClick={() => handleOverallAmountChange(receiptState.amount)}
                    >
                      FIFO Auto-Allocate
                    </Button>
                  </Typography>
                  <Table size="small" sx={{ bgcolor: '#fff', border: '1px solid #dee2e6', borderRadius: 1 }}>
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f1f3f5' }}>
                        <TableCell padding="checkbox" sx={{ fontWeight: 'bold' }}>Settle</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Invoice No</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Bill Amt (₹)</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Outstanding (₹)</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', width: 140 }}>Allocated Received (₹)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {outstandingBills.map(bill => {
                        const billSelect = selectedBills[bill.invoice_no] || { selected: false, allocated: '' };
                        return (
                          <TableRow key={bill.invoice_no} hover>
                            <TableCell padding="checkbox">
                              <input
                                type="checkbox"
                                style={{ width: 18, height: 18, cursor: 'pointer' }}
                                checked={billSelect.selected}
                                onChange={(e) => handleBillCheckboxChange(bill.invoice_no, e.target.checked, bill.balance)}
                              />
                            </TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>{bill.invoice_no}</TableCell>
                            <TableCell>{bill.date}</TableCell>
                            <TableCell align="right">₹{bill.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell align="right" sx={{ color: '#c62828', fontWeight: 'bold' }}>₹{bill.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell align="right">
                              <TextField
                                size="small"
                                type="number"
                                value={billSelect.allocated}
                                onChange={(e) => handleBillAllocatedChange(bill.invoice_no, e.target.value)}
                                placeholder="0.00"
                                inputProps={{ min: '0', max: bill.balance, step: '0.01', style: { textAlign: 'right', fontWeight: 'bold', padding: '4px 8px' } }}
                                sx={{ width: 120, bgcolor: billSelect.selected ? '#e8f5e9' : '#fff' }}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {(() => {
                    const selectedKeys = Object.keys(selectedBills).filter(k => selectedBills[k]?.selected && parseFloat(selectedBills[k]?.allocated || 0) > 0);
                    if (selectedKeys.length === 0) return null;
                    const totalAllocated = selectedKeys.reduce((sum, k) => sum + parseFloat(selectedBills[k].allocated || 0), 0);
                    return (
                      <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1b5e20' }}>
                          ✅ Settling {selectedKeys.length} Sales Bill{selectedKeys.length > 1 ? 's' : ''}: #{selectedKeys.join(', #')}
                        </Typography>
                        <Chip label={`Total Receipt: ₹${totalAllocated.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} color="success" size="small" sx={{ fontWeight: 'bold' }} />
                      </Box>
                    );
                  })()}
                </Box>
              )}

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#495057' }}>Amount Received (₹)</Typography>
                  <TextField
                    type="number"
                    value={receiptState.amount}
                    onChange={(e) => {
                      setReceiptState({ ...receiptState, amount: e.target.value });
                      handleOverallAmountChange(e.target.value);
                    }}
                    size="small"
                    inputProps={{ min: '0.01', step: '0.01' }}
                    placeholder="0.00"
                    required
                    fullWidth
                  />
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#495057' }}>Receipt Reference / Instrument No</Typography>
                  <TextField
                    value={receiptState.reference_no}
                    onChange={(e) => setReceiptState({ ...receiptState, reference_no: e.target.value })}
                    size="small"
                    placeholder="UPI ID, Cheque No, etc."
                    fullWidth
                  />
                </Box>
              </Box>
            </Box>
          </Paper>
        )}

        {/* 3. SPECIALIZED CONTRA VOUCHER FORM */}
        {formData.voucher_type === 'Contra' && (
          <Paper variant="outlined" sx={{ p: 3, mb: 4, bgcolor: '#fdfdfd', borderColor: '#d1e7dd' }}>
            <Typography variant="subtitle1" gutterBottom sx={{ color: '#0f5132', fontWeight: 'bold', borderBottom: '1px solid #d1e7dd', pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              🔄 Contra Cash ↔ Bank Transfer
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 650, mt: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#495057' }}>Transfer From (Source Account)</Typography>
                <Select
                  value={contraState.from_ledger_id}
                  onChange={(e) => setContraState({ ...contraState, from_ledger_id: e.target.value })}
                  size="small"
                  fullWidth
                  displayEmpty
                >
                  <MenuItem value="">-- Select Source Cash/Bank --</MenuItem>
                  {ledgers.filter(l => l.ledger_type === 'Cash' || l.ledger_type === 'Bank' || l.name.toLowerCase().includes('cash') || l.name.toLowerCase().includes('bank') || l.name.toLowerCase().includes('petty')).map(l => (
                    <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>
                  ))}
                </Select>
                {(() => {
                  const ledger = ledgers.find(l => l.id == contraState.from_ledger_id);
                  const balance = ledger ? ledgerBalances[ledger.name] : undefined;
                  if (balance !== undefined) {
                    return (
                      <Typography variant="caption" sx={{ mt: 0.5, px: 1, color: '#2e7d32', fontWeight: 'medium' }}>
                        Account Balance: ₹{Math.abs(balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {balance >= 0 ? 'Dr' : 'Cr'}
                      </Typography>
                    );
                  }
                  return null;
                })()}
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#495057' }}>Transfer To (Destination Account)</Typography>
                <Select
                  value={contraState.to_ledger_id}
                  onChange={(e) => setContraState({ ...contraState, to_ledger_id: e.target.value })}
                  size="small"
                  fullWidth
                  displayEmpty
                >
                  <MenuItem value="">-- Select Destination Cash/Bank --</MenuItem>
                  {ledgers.filter(l => l.ledger_type === 'Cash' || l.ledger_type === 'Bank' || l.name.toLowerCase().includes('cash') || l.name.toLowerCase().includes('bank') || l.name.toLowerCase().includes('petty')).map(l => (
                    <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>
                  ))}
                </Select>
                {(() => {
                  const ledger = ledgers.find(l => l.id == contraState.to_ledger_id);
                  const balance = ledger ? ledgerBalances[ledger.name] : undefined;
                  if (balance !== undefined) {
                    return (
                      <Typography variant="caption" sx={{ mt: 0.5, px: 1, color: '#2e7d32', fontWeight: 'medium' }}>
                        Account Balance: ₹{Math.abs(balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {balance >= 0 ? 'Dr' : 'Cr'}
                      </Typography>
                    );
                  }
                  return null;
                })()}
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#495057' }}>Transfer Amount (₹)</Typography>
                  <TextField
                    type="number"
                    value={contraState.amount}
                    onChange={(e) => setContraState({ ...contraState, amount: e.target.value })}
                    size="small"
                    inputProps={{ min: '0.01', step: '0.01' }}
                    placeholder="0.00"
                    required
                    fullWidth
                  />
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#495057' }}>Contra Memo / Reference</Typography>
                  <TextField
                    value={contraState.reference_no}
                    onChange={(e) => setContraState({ ...contraState, reference_no: e.target.value })}
                    size="small"
                    placeholder="ATM Ref, internal notes, etc."
                    fullWidth
                  />
                </Box>
              </Box>
            </Box>
          </Paper>
        )}

        {/* 4. GENERIC JOURNAL DOUBLE-ENTRY TABLE */}
        {formData.voucher_type === 'Journal' && (
          <Box sx={{ mb: 4 }} id="journal-entries-table-container">
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#495057', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              📓 Manual Debit/Credit Entries
            </Typography>
            <Table size="small" sx={{ border: '1px solid #dee2e6', borderRadius: 1 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f1f3f5' }}>
                  <TableCell style={{ width: 100, fontWeight: 'bold' }}>Type</TableCell>
                  <TableCell style={{ fontWeight: 'bold' }}>Particulars (Ledger Account)</TableCell>
                  <TableCell style={{ width: 140, fontWeight: 'bold' }}>Debit (₹)</TableCell>
                  <TableCell style={{ width: 140, fontWeight: 'bold' }}>Credit (₹)</TableCell>
                  <TableCell style={{ fontWeight: 'bold' }}>Row Remarks</TableCell>
                  <TableCell style={{ width: 60, fontWeight: 'bold' }} align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.map((entry, index) => (
                  <TableRow key={index} sx={{ '&:nth-of-type(even)': { bgcolor: '#f8f9fa' } }}>
                    <TableCell>
                      <Select
                        value={entry.type || 'Dr'}
                        onChange={(e) => updateEntry(index, 'type', e.target.value)}
                        size="small"
                        fullWidth
                      >
                        <MenuItem value="Dr">Dr</MenuItem>
                        <MenuItem value="Cr">Cr</MenuItem>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={entry.ledger_id || ''}
                        onChange={(e) => updateEntry(index, 'ledger_id', e.target.value)}
                        size="small"
                        fullWidth
                        displayEmpty
                      >
                        <MenuItem value="">-- Select Ledger --</MenuItem>
                        {ledgers.map(ledger => (
                          <MenuItem key={ledger.id} value={ledger.id}>{ledger.name}</MenuItem>
                        ))}
                      </Select>
                      {entry.ledger_name && (
                        <Box sx={{ mt: 0.5, px: 1 }}>
                          {ledgerBalances[entry.ledger_name] !== undefined && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="caption" sx={{ color: '#1565c0', fontWeight: 'bold' }}>
                                Bal: ₹{Math.abs(parseFloat(ledgerBalances[entry.ledger_name])).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {parseFloat(ledgerBalances[entry.ledger_name]) >= 0 ? 'Dr' : 'Cr'}
                              </Typography>
                              <Button 
                                size="small" 
                                variant="text" 
                                sx={{ fontSize: '10px', p: 0, minWidth: 'auto', textTransform: 'none', fontWeight: 'bold' }}
                                onClick={() => {
                                  const absVal = Math.abs(parseFloat(ledgerBalances[entry.ledger_name]));
                                  updateEntry(index, entry.type === 'Dr' ? 'debit' : 'credit', absVal.toFixed(2));
                                }}
                              >
                                [Apply]
                              </Button>
                            </Box>
                          )}
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={entry.debit || ''}
                        onChange={(e) => updateEntry(index, 'debit', e.target.value)}
                        type="number"
                        size="small"
                        placeholder="0.00"
                        inputProps={{ step: '0.01' }}
                        fullWidth
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={entry.credit || ''}
                        onChange={(e) => updateEntry(index, 'credit', e.target.value)}
                        type="number"
                        size="small"
                        placeholder="0.00"
                        inputProps={{ step: '0.01' }}
                        fullWidth
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={entry.remarks || ''}
                        onChange={(e) => updateEntry(index, 'remarks', e.target.value)}
                        size="small"
                        placeholder="Particular notes..."
                        fullWidth
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton onClick={() => deleteEntry(index)} size="small" color="error" disabled={entries.length <= 2}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            <Button
              startIcon={<AddIcon />}
              onClick={addEntry}
              variant="outlined"
              size="small"
              sx={{ mt: 2, fontWeight: 'bold' }}
            >
              Add Row Entry
            </Button>
          </Box>
        )}

        {/* Totals + Running Balance Indicator for Journal Vouchers */}
        {formData.voucher_type === 'Journal' ? (() => {
          const debitPaise = Math.round(Number(totals.debit || 0) * 100);
          const creditPaise = Math.round(Number(totals.credit || 0) * 100);
          const differencePaise = debitPaise - creditPaise;
          const balanced = differencePaise === 0;

          return (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, p: 2, bgcolor: '#f8f9fa', borderRadius: 1, border: '1px solid #e9ecef' }}>
              <Box>
                <Alert
                  severity={balanced ? 'success' : 'error'}
                  sx={{ py: 0, px: 2, fontWeight: 'bold', border: '1px solid', borderColor: balanced ? '#b1dfbb' : '#f5c6cb' }}
                >
                  {balanced ? 'Journal Voucher Balanced 🟢' : 'Journal Voucher Not Balanced 🔴'}
                </Alert>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                  Total Debit: <strong>₹{totals.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', mt: 0.5 }}>
                  Total Credit: <strong>₹{totals.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 900, color: balanced ? '#2e7d32' : '#c62828', mt: 0.5 }}>
                  Difference: <strong>₹{(differencePaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </Typography>
              </Box>
            </Box>
          );
        })() : (
          <Box sx={{ mb: 4 }}>
            <Alert severity="success" sx={{ fontWeight: 'bold', bgcolor: '#e8f5e9', border: '1px solid #c8e6c9', color: '#2e7d32' }}>
              Double Entry Auto-Balancing Active ⚡ (Balanced Dr and Cr ledger transactions will be posted automatically on save)
            </Alert>
          </Box>
        )}

        {/* Global Narration Field */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#495057', mb: 1 }}>
            Global Voucher Narration / Explanation
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={2}
            value={formData.narration}
            onChange={(e) => setFormData({...formData, narration: e.target.value})}
            placeholder="Provide details about this settlement / transaction..."
            sx={{ bgcolor: '#fff' }}
          />
        </Box>

        {/* Bottom Actions Bar */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', pt: 3, borderTop: '1px solid #e0e0e0' }}>
          <Button
            variant="outlined"
            onClick={() => navigate('/entry/voucher-display')}
            color="inherit"
            disabled={loading}
            sx={{ fontWeight: 'bold' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isSaveDisabled()}
            color="primary"
            sx={{ fontWeight: 'bold', px: 4 }}
          >
            {loading ? 'Saving Record...' : (actualIsEdit ? 'Update Voucher' : 'Save Voucher')}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default VoucherCreate;
