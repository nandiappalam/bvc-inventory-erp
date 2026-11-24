import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  FormControl,
  FormControlLabel,
  Switch,
  IconButton,
  Chip,
  Snackbar,
} from '@mui/material';

import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useNavigate, Link, useLocation, useParams } from 'react-router-dom';
import voucherAPI from './voucherService.js';
import api from '../../services/api.js';
import { safeArray } from '../../utils/safeArray.js';
import { InlineMasterModal } from '../../components/common/InlineMasterModal.jsx';

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

  // Manual Master Creation Modal State
  const [inlineMasterOpen, setInlineMasterOpen] = useState(false);
  const [inlineMasterType, setInlineMasterType] = useState('suppliers');

  const handleInlineMasterCreated = async (newId, newRecord) => {
    try {
      const refreshed = await voucherAPI.getLedgers();
      const updatedLedgers = safeArray(refreshed);
      setLedgers(updatedLedgers);

      const targetName = newRecord?.name || '';
      const matched = updatedLedgers.find(l => 
        (newId && l.id == newId) || 
        (targetName && l.name.toLowerCase().includes(targetName.toLowerCase()))
      );

      if (matched) {
        if (inlineMasterType === 'customers') {
          setReceiptState(prev => ({ ...prev, party_ledger_id: matched.id }));
        } else {
          setPaymentState(prev => ({ ...prev, party_ledger_id: matched.id }));
        }
      }
    } catch (e) {
      console.error('Error refreshing ledgers after inline create:', e);
    }
  };

  // Quick Bill / Voucher No search state
  const [searchableBills, setSearchableBills] = useState([]);
  const [selectedQuickBillKey, setSelectedQuickBillKey] = useState('');
  const [manualSearchNo, setManualSearchNo] = useState('');
  const [quickAlert, setQuickAlert] = useState('');
  const [matchedVoucherContext, setMatchedVoucherContext] = useState(null);
  const [contextLoading, setContextLoading] = useState(false);
  const pendingBillMatchRef = useRef(null);

  // Toast state
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

  const cleanLedgerName = (name) => {
    if (!name) return '';
    return name.replace(/\s*\([^)]*\)$/i, '').trim();
  };

  const isPurchaseOrPayable = (bill, currentLedgers = ledgers) => {
    if (!bill) return false;
    const bType = String(bill.type || '').toLowerCase();
    const vType = String(bill.voucher_type || '').toLowerCase();
    const cat = String(bill.category || '').toLowerCase();
    const invNo = String(bill.invoice_no || bill.voucher_no || '').toUpperCase();
    const lName = cleanLedgerName(bill.ledger_name).toLowerCase();

    if (bType === 'payable' || bType === 'purchase' || vType === 'purchase' || vType === 'payment' || cat === 'transport' || cat === 'loadman') return true;
    if (bType === 'receivable' || bType === 'sales' || vType === 'sales' || vType === 'receipt') return false;
    if (invNo.startsWith('PUR') || invNo.startsWith('TRP') || invNo.startsWith('LDM') || invNo.startsWith('OPC') || invNo.startsWith('PAY')) return true;
    if (invNo.startsWith('SAL') || invNo.startsWith('INV') || invNo.startsWith('REC')) return false;

    if (currentLedgers && currentLedgers.length > 0) {
      const matched = currentLedgers.find(l => cleanLedgerName(l.name).toLowerCase() === lName);
      if (matched) {
        const lType = String(matched.ledger_type || '').toLowerCase();
        const gName = String(matched.group_name || matched.under || '').toLowerCase();
        if (lType === 'supplier' || lType === 'transporter' || lType === 'worker' || gName.includes('creditor') || gName.includes('supplier') || gName.includes('transporter') || gName.includes('worker') || gName.includes('payable')) return true;
        if (lType === 'customer' || gName.includes('debtor') || gName.includes('customer')) return false;
      }
    }

    if (lName.includes('supplier') || lName.includes('lorry') || lName.includes('transport') || lName.includes('loadman')) return true;
    return false;
  };

  const applyBillToVoucher = (bill, currentLedgers = ledgers) => {
    if (!bill) return;
    const isPayable = isPurchaseOrPayable(bill, currentLedgers);
    const targetType = isPayable ? 'Payment' : 'Receipt';
    const rawPartyStr = String(bill.ledger_name || '');
    
    const matchedList = currentLedgers && currentLedgers.length > 0 ? currentLedgers : ledgers;
    
    // Split by comma in case bill.ledger_name has multiple ledger names joined by comma
    const partyParts = rawPartyStr.split(',').map(p => cleanLedgerName(p.trim())).filter(Boolean);
    
    let matchedLedger = null;
    
    // 1. First attempt: find party matching target type preference (Supplier/Transporter/Worker for Payment, Customer for Receipt)
    for (const part of partyParts) {
      const partLower = part.toLowerCase();
      const found = matchedList.find(l => {
        const lName = cleanLedgerName(l.name).toLowerCase();
        if (lName !== partLower) return false;
        const lType = String(l.ledger_type || '').toLowerCase();
        const gName = String(l.group_name || l.under || '').toLowerCase();
        if (targetType === 'Payment' && (lType === 'supplier' || lType === 'transporter' || lType === 'worker' || gName.includes('creditor') || gName.includes('supplier') || gName.includes('transporter') || gName.includes('worker') || gName.includes('payable'))) return true;
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
    const billTypeDesc = bill.category === 'transport' ? 'Transport Freight' : (bill.category === 'loadman' ? 'Loadman Charge' : (isPayable ? 'Purchase Invoice' : 'Sales Bill'));

    setFormData(prev => ({
      ...prev,
      voucher_type: targetType,
      reference_no: refVal ? `${refVal}` : prev.reference_no,
      narration: `Settlement voucher for ${billTypeDesc} #${refVal}`
    }));

    const settleAmt = String(bill.balance !== undefined ? bill.balance : (bill.amount || ''));

    if (matchedLedger) {
      pendingBillMatchRef.current = {
        ledgerId: String(matchedLedger.id),
        remarks: `Ref: ${refVal}`,
        amount: parseFloat(settleAmt) || 0,
      };
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

  const applyCombinedPartySettlement = (ctx) => {
    if (!ctx || !Array.isArray(ctx.parties)) return;
    const unpaidParties = ctx.parties.filter(p => (parseFloat(p.outstanding_amount ?? p.balance) || 0) > 0.01);
    if (unpaidParties.length === 0) return;

    const refVal = String(ctx.purchase?.inv_no || ctx.voucher?.voucher_no || ctx.query || '');
    const defaultCashBank = ledgers.find(l => {
      const lType = String(l.ledger_type || '').toLowerCase();
      const lName = String(l.name || '').toLowerCase();
      return lType === 'cash' || lType === 'bank' || lName.includes('bank') || lName.includes('cash');
    });

    const isPayable = unpaidParties.every(p => p.type !== 'Receivable');
    const totalAmt = Math.round(unpaidParties.reduce((s, p) => s + (parseFloat(p.outstanding_amount ?? p.balance) || 0), 0) * 100) / 100;

    const journalRows = unpaidParties.map(p => {
      const matchedL = ledgers.find(l => cleanLedgerName(l.name).toLowerCase() === cleanLedgerName(p.ledger_name).toLowerCase());
      const amt = Number(p.outstanding_amount ?? p.balance ?? 0);
      if (p.ledger_name) fetchLedgerBalance(p.ledger_name);
      return {
        type: isPayable ? 'Dr' : 'Cr',
        ledger_id: matchedL?.id || p.ledger_id || '',
        ledger_name: matchedL?.name || p.ledger_name,
        debit: isPayable ? amt : '',
        credit: isPayable ? '' : amt,
        remarks: `Ref: ${refVal} (${p.role})`
      };
    });

    if (defaultCashBank) fetchLedgerBalance(defaultCashBank.name);
    journalRows.push({
      type: isPayable ? 'Cr' : 'Dr',
      ledger_id: defaultCashBank?.id || '',
      ledger_name: defaultCashBank?.name || '',
      debit: isPayable ? '' : totalAmt,
      credit: isPayable ? totalAmt : '',
      remarks: `Combined settlement for ${ctx.voucher?.voucher_no || refVal}`
    });

    setFormData(prev => ({
      ...prev,
      voucher_type: 'Journal',
      reference_no: ctx.voucher?.voucher_no || refVal,
      narration: `Combined settlement for ${ctx.voucher?.voucher_no || 'Voucher'} (Invoice #${refVal}) — ${unpaidParties.map(p => p.ledger_name).join(', ')}`
    }));
    setEntries(journalRows);
    calculateTotals(journalRows);
    setQuickAlert(`✓ Prepared combined Journal settlement for all ${unpaidParties.length} involved parties (${unpaidParties.map(p => `${p.ledger_name}: ₹${Number(p.outstanding_amount ?? p.balance).toLocaleString('en-IN')}`).join(', ')}). Total: ₹${totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
  };

  const handleVoucherLookup = async (rawQuery, preferredBill = null) => {
    const q = String(rawQuery || '').trim();
    if (!q && !preferredBill) return;

    const searchLower = q.toLowerCase();
    const searchCompact = searchLower.replace(/[-\s]/g, '');

    const matchingBills = q
      ? searchableBills.filter(b => {
          const vNo = String(b.voucher_no || '').toLowerCase();
          const invNo = String(b.invoice_no || '').toLowerCase();
          const tokens = Array.isArray(b.searchTokens) ? b.searchTokens.map(t => String(t).toLowerCase()) : [];
          return vNo === searchLower || vNo.replace(/-/g, '') === searchCompact || invNo === searchLower || tokens.includes(searchLower) || tokens.includes(searchCompact);
        })
      : [];

    setContextLoading(true);
    let ctx = null;
    try {
      const lookupQ = q || preferredBill?.voucher_no || preferredBill?.invoice_no || '';
      if (lookupQ) {
        const res = await voucherAPI.lookup(lookupQ);
        if (res && res.found) {
          ctx = res;
          setMatchedVoucherContext(res);
        } else {
          setMatchedVoucherContext(null);
        }
      }
    } catch (_) {
      setMatchedVoucherContext(null);
    } finally {
      setContextLoading(false);
    }

    const billToApply = preferredBill
      || matchingBills[0]
      || (ctx?.parties?.find(p => (parseFloat(p.outstanding_amount) || 0) > 0.01) || ctx?.parties?.[0]);

    if (billToApply) {
      applyBillToVoucher(billToApply);
      const allParties = ctx?.parties && ctx.parties.length > 0 ? ctx.parties : matchingBills;
      if (allParties.length > 1) {
        const summary = allParties.map(p => `${p.ledger_name} (₹${parseFloat(p.outstanding_amount ?? p.balance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })})`).join(' | ');
        setQuickAlert(`✓ Loaded Voucher ${ctx?.voucher?.voucher_no || billToApply.voucher_no || ''} (#${billToApply.invoice_no || ''}) with ${allParties.length} involved payables: ${summary}`);
      } else {
        const bTypeDesc = billToApply.category === 'transport' ? 'Transport Freight' : (billToApply.category === 'loadman' ? 'Loadman Charge' : (billToApply.type === 'Payable' ? 'Purchase Invoice' : 'Sales Bill'));
        setQuickAlert(`✓ Auto-filled voucher details for ${bTypeDesc} #${billToApply.invoice_no || billToApply.voucher_no} (${billToApply.ledger_name}). Outstanding Balance: ₹${parseFloat(billToApply.balance ?? billToApply.outstanding_amount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
      }
    } else if (ctx && ctx.entries && ctx.entries.length > 0) {
      setQuickAlert(`✓ Loaded automatic voucher ${ctx.voucher?.voucher_no || q} (${ctx.entries.length} ledger accounts). Select a party below to settle or view ledger & payment details.`);
    } else {
      setQuickAlert(`No voucher, pending bill, or invoice found matching "${q}". Please check the number.`);
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
      const filteredBills = bills.filter(b => 
        b.type === (type === 'Payment' ? 'Payable' : 'Receivable') && 
        (parseFloat(b.balance) || 0) > 0.01
      );

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
  const loadSearchableBills = useCallback(() => {
    api('/reports/outstanding-details')
      .then(data => {
        const bills = Array.isArray(data) ? data : (data?.data || []);
        const pendingOnly = bills.filter(b => {
          const bal = parseFloat(b.balance) || 0;
          if (bal <= 0.01) return false;
          const lName = (b.ledger_name || '').toLowerCase().trim();
          // Filter out nominal accounts that are not party ledgers
          if (
            lName.includes('purchase account') ||
            lName === 'purchases' ||
            lName.includes('sales account') ||
            lName === 'sales' ||
            lName.includes('input tax') ||
            lName.includes('output tax') ||
            lName.includes('cgst') ||
            lName.includes('sgst') ||
            lName.includes('igst') ||
            lName.includes('duties & taxes') ||
            lName.includes('discount') ||
            lName.includes('round off')
          ) {
            return false;
          }
          return true;
        });

        // Deduplicate in case any bills still share invoice_no / voucher_no / supplier
        const seen = new Set();
        const uniqueBills = [];
        pendingOnly.forEach(b => {
          const cleanParty = String(b.ledger_name || '').replace(/\s*\((Supplier|Customer|Creditor|Debtor)\)$/i, '').trim().toLowerCase();
          const cleanInv = String(b.invoice_no || b.voucher_no || '').trim().toLowerCase();
          const dedupeKey = `${b.type}_${cleanParty}_${cleanInv}`;
          if (!seen.has(dedupeKey)) {
            seen.add(dedupeKey);
            uniqueBills.push(b);
          }
        });

        const mapped = uniqueBills.map((b, idx) => ({
          ...b,
          key: `${b.ledger_name}_${b.type}_${b.invoice_no || b.voucher_no}_${idx}`
        }));
        setSearchableBills(mapped);
      })
      .catch(err => {
        console.error('Failed to load searchable bills:', err);
        setSearchableBills([]);
      });
  }, []);

  useEffect(() => {
    loadSearchableBills();
    const handleCompanyChange = () => {
      loadSearchableBills();
      voucherAPI.getLedgers().then(res => setLedgers(safeArray(res))).catch(() => setLedgers([]));
    };
    window.addEventListener('erp_company_changed', handleCompanyChange);
    return () => window.removeEventListener('erp_company_changed', handleCompanyChange);
  }, [loadSearchableBills]);

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
          const pending = pendingBillMatchRef.current;
          if (pending && pending.ledgerId === String(ledger.id)) {
            pendingBillMatchRef.current = null;
            fetchOutstandingBills(ledger.name, 'Payment', pending.remarks, pending.amount);
          } else {
            fetchOutstandingBills(ledger.name, 'Payment');
          }
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
          const pending = pendingBillMatchRef.current;
          if (pending && pending.ledgerId === String(ledger.id)) {
            pendingBillMatchRef.current = null;
            fetchOutstandingBills(ledger.name, 'Receipt', pending.remarks, pending.amount);
          } else {
            fetchOutstandingBills(ledger.name, 'Receipt');
          }
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
    const resolveId = (val) => {
      if (val === undefined || val === null || val === '') return 1;
      const n = parseInt(val, 10);
      return !isNaN(n) && n > 0 ? n : (typeof val === 'string' ? val : 1);
    };

    let finalEntries = [];
    if (formData.voucher_type === 'Payment') {
      const selectedBillList = Object.entries(selectedBills)
        .filter(([_, b]) => b.selected && parseFloat(b.allocated) > 0)
        .map(([invNo, b]) => `${invNo}`);
      const billingRef = selectedBillList.length > 0 ? `Ref: ${selectedBillList.join(', ')}` : '';
      const partyLedger = ledgers.find(l => l.id == paymentState.party_ledger_id);
      const cashLedger = ledgers.find(l => l.id == paymentState.cash_ledger_id);

      finalEntries = [
        {
          type: 'Dr',
          ledger_id: resolveId(paymentState.party_ledger_id),
          ledger_name: partyLedger?.name || '',
          debit: Number(paymentState.amount),
          credit: 0,
          remarks: billingRef || (paymentState.reference_no ? `Ref: ${paymentState.reference_no}` : '')
        },
        {
          type: 'Cr',
          ledger_id: resolveId(paymentState.cash_ledger_id),
          ledger_name: cashLedger?.name || '',
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
      const partyReceiptLedger = ledgers.find(l => l.id == receiptState.party_ledger_id);
      const cashReceiptLedger = ledgers.find(l => l.id == receiptState.cash_ledger_id);

      finalEntries = [
        {
          type: 'Dr',
          ledger_id: resolveId(receiptState.cash_ledger_id),
          ledger_name: cashReceiptLedger?.name || '',
          debit: Number(receiptState.amount),
          credit: 0,
          remarks: receiptState.reference_no ? `Ref: ${receiptState.reference_no}` : ''
        },
        {
          type: 'Cr',
          ledger_id: resolveId(receiptState.party_ledger_id),
          ledger_name: partyReceiptLedger?.name || '',
          debit: 0,
          credit: Number(receiptState.amount),
          remarks: billingRef || (receiptState.reference_no ? `Ref: ${receiptState.reference_no}` : '')
        }
      ];
    } else if (formData.voucher_type === 'Contra') {
      const toLedger = ledgers.find(l => l.id == contraState.to_ledger_id);
      const fromLedger = ledgers.find(l => l.id == contraState.from_ledger_id);

      finalEntries = [
        {
          type: 'Dr',
          ledger_id: resolveId(contraState.to_ledger_id),
          ledger_name: toLedger?.name || '',
          debit: Number(contraState.amount),
          credit: 0,
          remarks: contraState.reference_no ? `Ref: ${contraState.reference_no}` : ''
        },
        {
          type: 'Cr',
          ledger_id: resolveId(contraState.from_ledger_id),
          ledger_name: fromLedger?.name || '',
          debit: 0,
          credit: Number(contraState.amount),
          remarks: contraState.reference_no ? `Ref: ${contraState.reference_no}` : ''
        }
      ];
    } else {
      finalEntries = entries.map(e => ({
        type: e.type,
        ledger_id: resolveId(e.ledger_id),
        ledger_name: e.ledger_name || '',
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
      setSelectedQuickBillKey('');
      setManualSearchNo('');
      loadSearchableBills();
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
            🔍 Select / Search by Voucher No, Purchase, Sales, Freight, or Expense Bill to Settle
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <Box sx={{ flexGrow: 1, minWidth: 280 }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#4338ca', display: 'block', mb: 0.5 }}>
                Select Pending Bill / Invoice / Expense Payable from List:
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
                      handleVoucherLookup(foundBill.voucher_no || foundBill.invoice_no, foundBill);
                    }
                  } else {
                    setMatchedVoucherContext(null);
                  }
                }}
                sx={{ bgcolor: '#fff' }}
              >
                <MenuItem value="">-- Select Pending Purchase / Sales / Freight / Loadman / Expense Payable --</MenuItem>
                {searchableBills.map(b => {
                  let icon = '🛒 Purchase Inv';
                  if (b.category === 'transport') icon = '🚚 Transport Freight';
                  else if (b.category === 'loadman') icon = '👷 Loadman Charges';
                  else if (b.voucher_type === 'Operational') icon = '⚡ Operational Charge';
                  else if (b.type === 'Receivable' || b.voucher_type === 'Sales' || b.category === 'sales') icon = '🏷️ Sales Bill';
                  else if (b.type === 'Payable' && b.category !== 'purchase') icon = '📄 General Payable';

                  const refDisplay = b.voucher_no && b.invoice_no && String(b.voucher_no) !== String(b.invoice_no)
                    ? `${b.voucher_no} (Inv #${b.invoice_no})`
                    : (b.voucher_no || b.invoice_no);

                  return (
                    <MenuItem key={b.key} value={b.key}>
                      {icon} #{refDisplay} — {b.ledger_name} (Bal: ₹{parseFloat(b.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })})
                    </MenuItem>
                  );
                })}
              </Select>
            </Box>

            <Box sx={{ width: 220 }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#4338ca', display: 'block', mb: 0.5 }}>
                Or Type Voucher / Bill No:
              </Typography>
              <TextField
                size="small"
                fullWidth
                placeholder="e.g. PUR00019, 5361, S001..."
                value={manualSearchNo}
                onChange={(e) => setManualSearchNo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && manualSearchNo.trim()) {
                    e.preventDefault();
                    handleVoucherLookup(manualSearchNo);
                  }
                }}
                sx={{ bgcolor: '#fff' }}
              />
            </Box>

            <Box>
              <Button
                variant="contained"
                size="medium"
                disabled={contextLoading}
                onClick={() => handleVoucherLookup(manualSearchNo)}
                sx={{ bgcolor: '#4f46e5', fontWeight: 'bold', px: 3, textTransform: 'none', height: 40 }}
              >
                {contextLoading ? 'Searching...' : 'Proceed with Voucher'}
              </Button>
            </Box>
          </Box>

          {quickAlert && (
            <Alert severity="success" sx={{ mt: 2, py: 0.5, fontWeight: 'bold' }} onClose={() => setQuickAlert('')}>
              {quickAlert}
            </Alert>
          )}

          {matchedVoucherContext && matchedVoucherContext.found && (
            <Paper variant="outlined" sx={{ mt: 2.5, p: 2, bgcolor: '#ffffff', borderColor: '#a5b4fc', borderRadius: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, pb: 1.5, borderBottom: '1px solid #e2e8f0' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e3a8a' }}>
                    📑 Automatic Voucher Details: {matchedVoucherContext.voucher?.voucher_no || matchedVoucherContext.query}
                  </Typography>
                  {matchedVoucherContext.voucher?.voucher_type && (
                    <Chip label={matchedVoucherContext.voucher.voucher_type} size="small" color="primary" variant="outlined" sx={{ fontWeight: 'bold' }} />
                  )}
                  {matchedVoucherContext.purchase?.inv_no && (
                    <Chip label={`Inv #${matchedVoucherContext.purchase.inv_no}`} size="small" sx={{ fontWeight: 'bold', bgcolor: '#eef2ff', color: '#3730a3' }} />
                  )}
                  {matchedVoucherContext.voucher?.date && (
                    <Chip label={`Date: ${matchedVoucherContext.voucher.date}`} size="small" variant="outlined" />
                  )}
                  {matchedVoucherContext.purchase?.vehicle_no && (
                    <Chip label={`Vehicle: ${matchedVoucherContext.purchase.vehicle_no}`} size="small" variant="outlined" />
                  )}
                </Box>
                <Button size="small" color="inherit" onClick={() => setMatchedVoucherContext(null)} sx={{ textTransform: 'none', fontWeight: 'bold' }}>
                  Close Breakdown ✕
                </Button>
              </Box>

              {/* 1. ALL INVOLVED PAYABLE / RECEIVABLE PARTIES */}
              {matchedVoucherContext.parties && matchedVoucherContext.parties.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      👥 Involved Parties & Payable / Settlement Status ({matchedVoucherContext.parties.length})
                    </Typography>
                    {matchedVoucherContext.parties.filter(p => (p.outstanding_amount || 0) > 0.01).length > 1 && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="secondary"
                        onClick={() => applyCombinedPartySettlement(matchedVoucherContext)}
                        sx={{ textTransform: 'none', fontWeight: 'bold', py: 0.25 }}
                      >
                        Settle All Unpaid Parties Together (Journal)
                      </Button>
                    )}
                  </Box>
                  <Table size="small" sx={{ border: '1px solid #e2e8f0', mb: 2 }}>
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f8fafc' }}>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.75 }}>Role</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.75 }}>Ledger Account</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', py: 0.75 }}>Billed Amt (₹)</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', py: 0.75 }}>Paid (₹)</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', py: 0.75 }}>Outstanding (₹)</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold', py: 0.75 }}>Settle Party</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {matchedVoucherContext.parties.map((p, idx) => {
                        const activePartyId = formData.voucher_type === 'Payment' ? paymentState.party_ledger_id : receiptState.party_ledger_id;
                        const activeLedger = ledgers.find(l => l.id == activePartyId);
                        const isCurrentlySelected = activeLedger && cleanLedgerName(activeLedger.name).toLowerCase() === cleanLedgerName(p.ledger_name).toLowerCase();
                        const outAmt = Number(p.outstanding_amount || 0);
                        const roleIcon = p.role === 'Transporter' ? '🚚' : p.role === 'Loadman' ? '👷' : p.role === 'Customer' ? '🏷️' : '🏭';
                        return (
                          <TableRow key={`${p.ledger_name}_${idx}`} sx={{ bgcolor: isCurrentlySelected ? '#eff6ff' : 'inherit' }}>
                            <TableCell sx={{ py: 0.75, fontWeight: 'bold', fontSize: '0.8rem' }}>{roleIcon} {p.role}</TableCell>
                            <TableCell sx={{ py: 0.75, fontWeight: 'bold' }}>{p.ledger_name}</TableCell>
                            <TableCell align="right" sx={{ py: 0.75 }}>₹{Number(p.billed_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell align="right" sx={{ py: 0.75, color: '#15803d', fontWeight: 600 }}>₹{Number(p.paid_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell align="right" sx={{ py: 0.75, color: outAmt > 0.01 ? '#b91c1c' : '#15803d', fontWeight: 'bold' }}>
                              ₹{outAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell align="center" sx={{ py: 0.75 }}>
                              <Button
                                size="small"
                                variant={isCurrentlySelected ? 'contained' : 'outlined'}
                                color={outAmt > 0.01 ? 'primary' : 'success'}
                                onClick={() => {
                                  applyBillToVoucher({
                                    ...p,
                                    balance: outAmt > 0.01 ? outAmt : Number(p.billed_amount || 0),
                                    amount: Number(p.billed_amount || 0)
                                  });
                                  setQuickAlert(`✓ Switched settlement form to ${p.role}: ${p.ledger_name} (Amount: ₹${(outAmt > 0.01 ? outAmt : Number(p.billed_amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })})`);
                                }}
                                sx={{ textTransform: 'none', fontWeight: 'bold', fontSize: '0.75rem', py: 0.2 }}
                              >
                                {isCurrentlySelected ? '✓ Selected' : (outAmt > 0.01 ? 'Select to Pay' : 'Paid (View)')}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Box>
              )}

              {/* 2. COMPLETE AUTOMATIC VOUCHER DOUBLE-ENTRY LEDGER ACCOUNTS */}
              {matchedVoucherContext.entries && matchedVoucherContext.entries.length > 0 && (
                <Box sx={{ mt: 1.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'block', mb: 1 }}>
                    📒 All Ledger Accounts Posted in Automatic Voucher ({matchedVoucherContext.entries.length} Entries)
                  </Typography>
                  <Table size="small" sx={{ border: '1px solid #e2e8f0', mb: 2 }}>
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#1e3a8a' }}>
                        <TableCell sx={{ color: '#fff', fontWeight: 'bold', py: 0.75, width: 60 }}>Dr/Cr</TableCell>
                        <TableCell sx={{ color: '#fff', fontWeight: 'bold', py: 0.75 }}>Ledger Account Name</TableCell>
                        <TableCell sx={{ color: '#fff', fontWeight: 'bold', py: 0.75 }}>Category / Role</TableCell>
                        <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold', py: 0.75 }}>Debit (₹)</TableCell>
                        <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold', py: 0.75 }}>Credit (₹)</TableCell>
                        <TableCell sx={{ color: '#fff', fontWeight: 'bold', py: 0.75 }}>Remarks</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {matchedVoucherContext.entries.map((ent, idx) => (
                        <TableRow key={ent.id || idx} hover>
                          <TableCell sx={{ py: 0.6, fontWeight: 'bold', color: ent.type === 'Dr' ? '#b91c1c' : '#15803d' }}>{ent.type}</TableCell>
                          <TableCell sx={{ py: 0.6, fontWeight: 600 }}>{ent.ledger_name}</TableCell>
                          <TableCell sx={{ py: 0.6, fontSize: '0.78rem', color: '#475569' }}>{ent.role || ent.group_name || 'Ledger'}</TableCell>
                          <TableCell align="right" sx={{ py: 0.6, fontWeight: ent.debit > 0 ? 700 : 400 }}>
                            {ent.debit > 0 ? `₹${ent.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                          </TableCell>
                          <TableCell align="right" sx={{ py: 0.6, fontWeight: ent.credit > 0 ? 700 : 400 }}>
                            {ent.credit > 0 ? `₹${ent.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                          </TableCell>
                          <TableCell sx={{ py: 0.6, fontSize: '0.78rem', color: '#64748b' }}>{ent.remarks || '—'}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow sx={{ bgcolor: '#f1f5f9' }}>
                        <TableCell colSpan={3} align="right" sx={{ fontWeight: 800, py: 0.75 }}>TOTAL:</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, py: 0.75, color: '#b91c1c' }}>
                          ₹{Number(matchedVoucherContext.voucher?.total_debit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, py: 0.75, color: '#15803d' }}>
                          ₹{Number(matchedVoucherContext.voucher?.total_credit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell sx={{ py: 0.75, fontWeight: 'bold', color: '#15803d' }}>
                          {matchedVoucherContext.voucher?.is_balanced ? 'Balanced ✓' : 'Check Balance'}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </Box>
              )}

              {/* 3. RECORDED PAYMENT / SETTLEMENT HISTORY */}
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'block', mb: 1 }}>
                  💳 Payment & Settlement Details for this Voucher ({matchedVoucherContext.settlements?.length || 0})
                </Typography>
                {matchedVoucherContext.settlements && matchedVoucherContext.settlements.length > 0 ? (
                  <Table size="small" sx={{ border: '1px solid #cbd5e1' }}>
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f0fdfa' }}>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.6 }}>Payment Voucher</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.6 }}>Date</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.6 }}>Type</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.6 }}>Party Account</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.6 }}>Cash / Bank Mode</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', py: 0.6 }}>Amount (₹)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {matchedVoucherContext.settlements.map((sv) => (
                        <TableRow key={sv.id} hover>
                          <TableCell sx={{ py: 0.6, fontWeight: 'bold', color: '#0f766e' }}>{sv.voucher_no}</TableCell>
                          <TableCell sx={{ py: 0.6 }}>{sv.date}</TableCell>
                          <TableCell sx={{ py: 0.6 }}>{sv.voucher_type}</TableCell>
                          <TableCell sx={{ py: 0.6, fontWeight: 600 }}>{sv.party_names || '—'}</TableCell>
                          <TableCell sx={{ py: 0.6 }}>{sv.account_names || '—'}</TableCell>
                          <TableCell align="right" sx={{ py: 0.6, fontWeight: 'bold' }}>
                            ₹{Number(sv.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Typography variant="caption" sx={{ display: 'block', p: 1, bgcolor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 1, color: '#64748b' }}>
                    No payment / settlement vouchers recorded yet for this voucher. Select any party above (`TRY`, Transporter, or Loadman) to record a settlement below.
                  </Typography>
                )}
              </Box>
            </Paper>
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
                  onChange={(e) => {
                    if (e.target.value === '__CREATE_NEW_SUPPLIER__') {
                      setInlineMasterType('suppliers');
                      setInlineMasterOpen(true);
                      return;
                    }
                    setPaymentState({ ...paymentState, party_ledger_id: e.target.value });
                  }}
                  size="small"
                  fullWidth
                  displayEmpty
                >
                  <MenuItem value="">-- Select Party / Ledger --</MenuItem>
                  {ledgers.filter(l => l.ledger_type !== 'Cash' && l.ledger_type !== 'Bank' && !l.name.toLowerCase().includes('cash') && !l.name.toLowerCase().includes('bank') && !l.name.toLowerCase().includes('petty')).map(l => (
                    <MenuItem key={l.id} value={l.id}>
                      {l.name} {l.group_name || l.under ? ` — ${l.group_name || l.under}` : ''}
                    </MenuItem>
                  ))}
                  <MenuItem value="__CREATE_NEW_SUPPLIER__" sx={{ fontWeight: 'bold', color: '#1e3a8a', borderTop: '1px solid #e2e8f0', mt: 1 }}>
                    + Enter Supplier / Party Manually
                  </MenuItem>
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
                    <span style={{ fontSize: '0.9rem' }}>📋 Outstanding Invoices & Payables to Settle</span>
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
                        <TableCell sx={{ fontWeight: 'bold' }}>Category / Type</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Ref / Inv No</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Bill Amt (₹)</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Outstanding (₹)</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', width: 140 }}>Allocated Paid (₹)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {outstandingBills.map(bill => {
                        const billSelect = selectedBills[bill.invoice_no] || { selected: false, allocated: '' };
                        let catLabel = '🛒 Purchase';
                        let catColor = '#1565c0';
                        if (bill.category === 'transport') { catLabel = '🚚 Transport'; catColor = '#e65100'; }
                        else if (bill.category === 'loadman') { catLabel = '👷 Loadman'; catColor = '#6a1b9a'; }
                        else if (bill.voucher_type === 'Operational') { catLabel = '⚡ Operational'; catColor = '#00838f'; }
                        else if (bill.type === 'Payable' && bill.category !== 'purchase') { catLabel = '📄 Payable'; catColor = '#424242'; }

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
                            <TableCell sx={{ fontWeight: 'bold', color: catColor, fontSize: '0.85rem' }}>{catLabel}</TableCell>
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
                  onChange={(e) => {
                    if (e.target.value === '__CREATE_NEW_CUSTOMER__') {
                      setInlineMasterType('customers');
                      setInlineMasterOpen(true);
                      return;
                    }
                    setReceiptState({ ...receiptState, party_ledger_id: e.target.value });
                  }}
                  size="small"
                  fullWidth
                  displayEmpty
                >
                  <MenuItem value="">-- Select Customer / Ledger --</MenuItem>
                  {ledgers.filter(l => l.ledger_type !== 'Cash' && l.ledger_type !== 'Bank' && !l.name.toLowerCase().includes('cash') && !l.name.toLowerCase().includes('bank') && !l.name.toLowerCase().includes('petty')).map(l => (
                    <MenuItem key={l.id} value={l.id}>
                      {l.name} {l.group_name || l.under ? ` — ${l.group_name || l.under}` : ''}
                    </MenuItem>
                  ))}
                  <MenuItem value="__CREATE_NEW_CUSTOMER__" sx={{ fontWeight: 'bold', color: '#1e3a8a', borderTop: '1px solid #e2e8f0', mt: 1 }}>
                    + Enter Customer Manually
                  </MenuItem>
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
                      <FormControl size="small" fullWidth>
                        <Select
                          value={entry.type || 'Dr'}
                          onChange={(e) => updateEntry(index, 'type', e.target.value)}
                        >
                          <MenuItem value="Dr">Dr</MenuItem>
                          <MenuItem value="Cr">Cr</MenuItem>
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell>
                      <FormControl size="small" fullWidth>
                        <Select
                          value={entry.ledger_id || ''}
                          onChange={(e) => {
                            if (e.target.value === '__CREATE_NEW_LEDGER__') {
                              setInlineMasterType('suppliers');
                              setInlineMasterOpen(true);
                              return;
                            }
                            updateEntry(index, 'ledger_id', e.target.value);
                          }}
                          displayEmpty
                        >
                          <MenuItem value="">-- Select Ledger --</MenuItem>
                          {ledgers.map(ledger => (
                            <MenuItem key={ledger.id} value={ledger.id}>
                              {ledger.name} {ledger.group_name || ledger.under ? ` — ${ledger.group_name || ledger.under}` : ''}
                            </MenuItem>
                          ))}
                          <MenuItem value="__CREATE_NEW_LEDGER__" sx={{ fontWeight: 'bold', color: '#1e3a8a', borderTop: '1px solid #e2e8f0', mt: 1 }}>
                            + Enter Master / Ledger Manually
                          </MenuItem>
                        </Select>
                      </FormControl>
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

      <InlineMasterModal
        open={inlineMasterOpen}
        onClose={() => setInlineMasterOpen(false)}
        masterType={inlineMasterType}
        onSuccess={handleInlineMasterCreated}
      />

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setToast(prev => ({ ...prev, open: false }))}
          severity={toast.severity}
          variant="filled"
          sx={{ width: '100%', fontWeight: 'bold' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default VoucherCreate;
