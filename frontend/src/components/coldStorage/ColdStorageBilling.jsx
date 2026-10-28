import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  MenuItem,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  InputAdornment,
  Tooltip,
  FormControlLabel,
  Switch
} from '@mui/material';
import {
  Calculate as CalcIcon,
  ReceiptLong as BillIcon,
  CheckCircle as ApproveIcon,
  Print as PrintIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
  AccountBalance as BankIcon,
  TrendingDown as VarianceIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { printHtml } from '../../utils/printHelper';
import ColdStorageReleaseOrderModal from './ColdStorageReleaseOrderModal';
import { AcUnit as ColdIcon } from '@mui/icons-material';

const ColdStorageBilling = () => {
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];

  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');

  // CSRO Modal State
  const [csroModalOpen, setCsroModalOpen] = useState(false);
  const [selectedCsroVoucher, setSelectedCsroVoucher] = useState(null);

  // Facilities & Operators
  const [coldStorages, setColdStorages] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [pastBills, setPastBills] = useState([]);

  // Form State
  const [coldStorageId, setColdStorageId] = useState('');
  const [coldStorageName, setColdStorageName] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState(today);

  // Operator Invoice inputs
  const [operatorInvoiceNo, setOperatorInvoiceNo] = useState('');
  const [operatorInvoiceDate, setOperatorInvoiceDate] = useState(today);
  const [operatorInvoiceAmount, setOperatorInvoiceAmount] = useState('');

  // Charges Breakdown (editable adjustments)
  const [storageCharges, setStorageCharges] = useState(0);
  const [handlingCharges, setHandlingCharges] = useState(0);
  const [insuranceCharges, setInsuranceCharges] = useState(0);
  const [mamoolCharges, setMamoolCharges] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);
  const [gstRate, setGstRate] = useState(18);
  const [isInterstate, setIsInterstate] = useState(false);
  const [remarks, setRemarks] = useState('');

  // ERP Calculation Results
  const [calculatedItems, setCalculatedItems] = useState([]);
  const [erpGrandTotal, setErpGrandTotal] = useState(0);

  // View Details Modal
  const [selectedBillDetails, setSelectedBillDetails] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  useEffect(() => {
    fetchInitialData();
    fetchBills();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [csRes, supRes] = await Promise.all([
        api('/cold-storage/storages').catch(() => ({ data: [] })),
        api('/masters/suppliers').catch(() => ({ data: [] }))
      ]);

      if (csRes?.data?.length > 0) {
        setColdStorages(csRes.data);
        const first = csRes.data[0];
        setColdStorageId(first.id);
        setColdStorageName(first.godown_name);
        if (first.operator_id) {
          setOperatorId(first.operator_id);
          setOperatorName(first.operator_name || first.external_company || 'Operator');
        } else if (first.external_company) {
          setOperatorName(first.external_company);
        }
      }
      if (supRes?.data) {
        setSuppliers(supRes.data);
      }
    } catch (err) {
      console.error('Error fetching billing initial data:', err);
    }
  };

  const fetchBills = async () => {
    setLoading(true);
    try {
      const res = await api('/cold-storage/bills');
      if (res && res.data) {
        setPastBills(res.data);
      } else {
        setPastBills([]);
      }
    } catch (err) {
      console.error('Error fetching bills:', err);
      setPastBills([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFacilityChange = (e) => {
    const csId = e.target.value;
    setColdStorageId(csId);
    const selected = coldStorages.find(c => c.id === csId);
    if (selected) {
      setColdStorageName(selected.godown_name);
      setGstRate(parseFloat(selected.gst_rate || 18));
      if (selected.operator_id) {
        setOperatorId(selected.operator_id);
        setOperatorName(selected.operator_name || selected.external_company || 'Operator');
      } else if (selected.external_company) {
        setOperatorName(selected.external_company);
      }
    }
    // Clear previous calc
    setCalculatedItems([]);
    setStorageCharges(0);
    setHandlingCharges(0);
    setInsuranceCharges(0);
    setMamoolCharges(0);
  };

  // Perform ERP Accrual Calculation
  const handleCalculateCharges = async () => {
    if (!coldStorageId) {
      setMessage('Please select a Cold Storage Facility first');
      setMessageType('error');
      return;
    }
    setCalculating(true);
    setMessage('');
    try {
      const res = await api('/cold-storage/calculate-bill', {
        method: 'POST',
        body: JSON.stringify({
          cold_storage_id: coldStorageId,
          operator_id: operatorId || null,
          period_from: periodFrom,
          period_to: periodTo,
          operator_invoice_amount: parseFloat(operatorInvoiceAmount || 0)
        })
      });

      if (res && res.success && res.data) {
        const d = res.data;
        setStorageCharges(d.storage_charges || 0);
        setHandlingCharges(d.handling_charges || 0);
        setInsuranceCharges(d.insurance_charges || 0);
        setMamoolCharges(d.mamool_charges || 0);
        setGstRate(d.tax_rate || 18);
        setCalculatedItems(d.items || []);
        setErpGrandTotal(d.grand_total || 0);

        if (d.operator_name && !operatorName) {
          setOperatorName(d.operator_name);
        }

        setMessage(
          `Calculation successful: Evaluated ${d.total_lots} active lot records. ERP Estimated Total: ₹${d.grand_total?.toFixed(2)}`
        );
        setMessageType('success');
      } else {
        setMessage(res?.message || 'Failed to calculate cold storage bill');
        setMessageType('error');
      }
    } catch (err) {
      setMessage('Error calculating charges: ' + err.message);
      setMessageType('error');
    } finally {
      setCalculating(false);
    }
  };

  // Live Math
  const taxableAmount =
    (parseFloat(storageCharges) || 0) +
    (parseFloat(handlingCharges) || 0) +
    (parseFloat(insuranceCharges) || 0) +
    (parseFloat(mamoolCharges) || 0) +
    (parseFloat(otherCharges) || 0);

  const rate = parseFloat(gstRate) || 0;
  const totalTax = (taxableAmount * rate) / 100;
  const cgstAmount = isInterstate ? 0 : totalTax / 2;
  const sgstAmount = isInterstate ? 0 : totalTax / 2;
  const igstAmount = isInterstate ? totalTax : 0;
  const grandTotal = taxableAmount + totalTax;

  const numericOperatorInvoiceAmt = parseFloat(operatorInvoiceAmount) || 0;
  const variance = numericOperatorInvoiceAmt > 0 ? numericOperatorInvoiceAmt - grandTotal : 0;
  const variancePercent = grandTotal > 0 && numericOperatorInvoiceAmt > 0
    ? ((variance / grandTotal) * 100).toFixed(1)
    : 0;

  // Save Pending Bill
  const handleSaveBill = async () => {
    if (!coldStorageId) {
      setMessage('Cold Storage Facility is required');
      setMessageType('error');
      return;
    }
    if (taxableAmount <= 0) {
      setMessage('Total bill amount must be greater than zero');
      setMessageType('error');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const payload = {
        cold_storage_id: coldStorageId,
        cold_storage_name: coldStorageName,
        operator_id: operatorId || null,
        operator_name: operatorName || 'Cold Storage Operator',
        period_from: periodFrom,
        period_to: periodTo,
        operator_invoice_no: operatorInvoiceNo,
        operator_invoice_date: operatorInvoiceDate,
        operator_invoice_amount: numericOperatorInvoiceAmt,
        erp_calculated_amount: erpGrandTotal || grandTotal,
        variance_amount: variance,
        storage_charges: parseFloat(storageCharges) || 0,
        handling_charges: parseFloat(handlingCharges) || 0,
        insurance_charges: parseFloat(insuranceCharges) || 0,
        mamool_charges: parseFloat(mamoolCharges) || 0,
        other_charges: parseFloat(otherCharges) || 0,
        taxable_amount: taxableAmount,
        tax_rate: rate,
        cgst_amount: cgstAmount,
        sgst_amount: sgstAmount,
        igst_amount: igstAmount,
        total_tax: totalTax,
        grand_total: grandTotal,
        remarks,
        items: calculatedItems
      };

      const res = await api('/cold-storage/bills', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res && res.success) {
        setMessage(`Success: Cold Storage Operator Bill ${res.bill_no} saved in Pending status.`);
        setMessageType('success');
        fetchBills();
      } else {
        setMessage(res?.message || 'Error saving bill');
        setMessageType('error');
      }
    } catch (err) {
      setMessage('Error saving bill: ' + err.message);
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  // Approve Bill & Post to Accounts
  const handleApproveBill = async (billId) => {
    if (!window.confirm('Are you sure you want to approve this bill and post journal entries to Accounts?')) {
      return;
    }
    setApproving(true);
    try {
      const res = await api(`/cold-storage/bills/${billId}/approve`, {
        method: 'POST'
      });
      if (res && res.success) {
        setMessage(`Success: Bill approved and posted to Accounts! Voucher #: ${res.voucher_no}`);
        setMessageType('success');
        fetchBills();
      } else {
        setMessage(res?.message || 'Error approving bill');
        setMessageType('error');
      }
    } catch (err) {
      setMessage('Error approving bill: ' + err.message);
      setMessageType('error');
    } finally {
      setApproving(false);
    }
  };

  const handleDeleteBill = async (billId) => {
    if (!window.confirm('Are you sure you want to delete this pending bill?')) return;
    try {
      const res = await api(`/cold-storage/bills/${billId}`, { method: 'DELETE' });
      if (res && res.success) {
        setMessage('Bill deleted successfully');
        setMessageType('success');
        fetchBills();
      } else {
        setMessage(res?.message || 'Error deleting bill');
        setMessageType('error');
      }
    } catch (err) {
      setMessage('Error: ' + err.message);
      setMessageType('error');
    }
  };

  const handlePrintBill = (bill) => {
    let items = [];
    try {
      items = typeof bill.items_json === 'string' ? JSON.parse(bill.items_json) : (bill.items_json || []);
    } catch (_) {}

    const billTypeLabel = (bill.bill_type || 'OPERATOR').toUpperCase();
    const paidAmt = parseFloat(bill.paid_amount || 0);
    const grandTot = parseFloat(bill.grand_total || 0);
    const balanceAmt = parseFloat(bill.balance_amount !== undefined ? bill.balance_amount : (grandTot - paidAmt));

    const itemsRows = items.map((it, idx) => `
      <tr>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${idx + 1}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: bold;">${it.item_name}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace;">${it.cold_storage_lot_no || '-'}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace;">${it.purchase_lot_no || '-'}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">${it.billable_units || it.in_qty || it.quantity || 0}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">${(it.total_wt || ((it.quantity || 0) * (it.weight || 50))).toFixed(2)} Kg</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${it.storage_days || 0} Days</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">₹${parseFloat(it.handling_charges || it.unloading_charge || 0).toFixed(2)}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">₹${parseFloat(it.storage_charges || it.storage_charge || 0).toFixed(2)}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold;">₹${parseFloat(it.total_charges || it.total_amount || 0).toFixed(2)}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 15px; color: #0f172a;">
        <div style="border-bottom: 3px solid #1f4fb2; padding-bottom: 10px; margin-bottom: 12px; display: flex; justify-content: space-between;">
          <div>
            <div style="font-size: 18px; font-weight: 800; color: #1f4fb2; text-transform: uppercase;">${bill.cold_storage_name || 'COLD STORAGE FACILITY'}</div>
            <div style="font-size: 12px; font-weight: 700; color: #475569;">OFFICIAL COLD STORAGE ${billTypeLabel} BILL STATEMENT</div>
            <div style="font-size: 11px; color: #64748b;">Operator Partner: ${bill.operator_name || 'Cold Storage Operator'}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 15px; font-weight: bold; color: #1f4fb2;">Bill #: ${bill.bill_no}</div>
            <div style="font-size: 11px; color: #64748b;">Date: ${bill.bill_date}</div>
            <div style="font-size: 11px; font-weight: bold; color: ${bill.status === 'Approved' ? '#059669' : '#d97706'}; mt-1">
              Status: ${bill.status} ${bill.accounting_voucher_no ? `(${bill.accounting_voucher_no})` : ''}
            </div>
          </div>
        </div>

        <!-- Vehicle, Logistics & Driver Strip -->
        <div style="display: flex; justify-content: space-between; background: #f8fafc; padding: 10px; border-radius: 4px; margin-bottom: 12px; font-size: 11px; border: 1px solid #cbd5e1;">
          <div><strong>Vehicle / Lorry No:</strong> ${bill.vehicle_no || 'N/A'}</div>
          <div><strong>Driver Name:</strong> ${bill.driver_name || 'N/A'}</div>
          <div><strong>Transporter:</strong> ${bill.transporter_name || 'N/A'}</div>
          <div><strong>Loadman Team:</strong> ${bill.loadman_name || 'Inward/Outward Loading'}</div>
          <div><strong>Loadman Charges:</strong> ₹${parseFloat(bill.loadman_charges || bill.handling_charges || 0).toFixed(2)}</div>
        </div>

        ${items.length > 0 ? `
          <div style="font-size: 12px; font-weight: bold; margin-bottom: 6px; color: #1f4fb2; text-transform: uppercase;">Stored Item & Charges Breakdown:</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 14px;">
            <thead>
              <tr style="background: #1f4fb2; color: #fff;">
                <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff;">#</th>
                <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: left;">Item Name</th>
                <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff;">CS Lot No</th>
                <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff;">Purchase Lot</th>
                <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: right;">Qty</th>
                <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: right;">Total Weight</th>
                <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff;">Stored Days</th>
                <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: right;">Handling</th>
                <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: right;">Storage Rent</th>
                <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: right;">Total Charge</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>
        ` : ''}

        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 10px;">
          <!-- Payment Details Box -->
          <div style="width: 48%; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 10px; border-radius: 4px; font-size: 11px;">
            <div style="font-weight: bold; color: #166534; text-transform: uppercase; margin-bottom: 4px;">Payment & Settlement Details:</div>
            <div><strong>Paid Amount:</strong> ₹${paidAmt.toFixed(2)}</div>
            <div><strong>Balance Amount:</strong> ₹${balanceAmt.toFixed(2)}</div>
            <div><strong>Payment Status:</strong> ${balanceAmt <= 0 ? 'FULLY PAID' : paidAmt > 0 ? 'PARTIAL' : 'PENDING'}</div>
            <div><strong>Linked Voucher #:</strong> ${bill.voucher_no || 'Pending Post'}</div>
          </div>

          <!-- Totals Table -->
          <table style="width: 300px; border-collapse: collapse; font-size: 11px;">
            <tr>
              <td style="padding: 4px 8px; border: 1px solid #cbd5e1; font-weight: bold;">Handling / Loadman:</td>
              <td style="padding: 4px 8px; border: 1px solid #cbd5e1; text-align: right;">₹${parseFloat(bill.handling_charges || bill.loadman_charges || 0).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 8px; border: 1px solid #cbd5e1; font-weight: bold;">Accrued Storage Rent:</td>
              <td style="padding: 4px 8px; border: 1px solid #cbd5e1; text-align: right;">₹${parseFloat(bill.storage_charges || 0).toFixed(2)}</td>
            </tr>
            <tr style="font-weight: bold; background: #f8fafc;">
              <td style="padding: 4px 8px; border: 1px solid #cbd5e1;">Taxable Base Amount:</td>
              <td style="padding: 4px 8px; border: 1px solid #cbd5e1; text-align: right;">₹${parseFloat(bill.taxable_amount || 0).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 8px; border: 1px solid #cbd5e1;">GST (${bill.tax_rate || 18}%):</td>
              <td style="padding: 4px 8px; border: 1px solid #cbd5e1; text-align: right;">₹${parseFloat(bill.total_tax || 0).toFixed(2)}</td>
            </tr>
            <tr style="font-weight: 800; background: #eff6ff; font-size: 13px;">
              <td style="padding: 6px 8px; border: 1px solid #93c5fd; color: #1e40af;">Grand Total Bill:</td>
              <td style="padding: 6px 8px; border: 1px solid #93c5fd; text-align: right; color: #1e40af;">₹${grandTot.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 11px; color: #475569;">
          <div style="border-top: 1px solid #94a3b8; width: 160px; text-align: center; padding-top: 4px;">Cold Storage Operator Signature</div>
          <div style="border-top: 1px solid #94a3b8; width: 160px; text-align: center; padding-top: 4px;">Verified By (Store Incharge)</div>
          <div style="border-top: 1px solid #94a3b8; width: 160px; text-align: center; padding-top: 4px;">Authorized Partner / Accounts</div>
        </div>
      </div>
    `;
    printHtml(html, `Cold_Storage_Bill_${bill.bill_no}`);
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, width: '100%', maxWidth: '100%', margin: '0 auto' }}>
      {/* Title */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <IconButton color="primary" onClick={() => navigate('/cold-storage/stock')}>
            <ArrowBackIcon />
          </IconButton>
          <BillIcon sx={{ fontSize: 36, color: '#1f4fb2' }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>
              Cold Storage Operator Billing & Verification
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Calculate accrued storage & handling charges, verify operator invoices, detect variance, and post to Accounts Ledger
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            color="warning"
            startIcon={<BillIcon />}
            onClick={() => navigate('/cold-storage/out?view=history')}
            sx={{ fontWeight: 800, bgcolor: '#d97706', '&:hover': { bgcolor: '#b45309' } }}
          >
            CSO Outward Bills & Statements
          </Button>
          <Button variant="outlined" color="primary" onClick={() => navigate('/cold-storage/master')}>
            Facility Rates Master
          </Button>
          <Button variant="outlined" color="primary" onClick={() => navigate('/cold-storage/stock')}>
            Live Stock & Lot Valuation
          </Button>
        </Box>
      </Box>

      {message && (
        <Alert severity={messageType} sx={{ mb: 3 }} onClose={() => setMessage('')}>
          {message}
        </Alert>
      )}

      {/* Main Billing Workspace Card */}
      <Card sx={{ mb: 4, boxShadow: '0 2px 10px rgba(0,0,0,0.08)', borderTop: '4px solid #1f4fb2' }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#1f4fb2', mb: 2 }}>
            1. Billing Parameters & ERP Auto-Calculation
          </Typography>

          <Grid container spacing={2.5}>
            {/* Facility */}
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                select
                size="small"
                label="Cold Storage Facility *"
                value={coldStorageId}
                onChange={handleFacilityChange}
                required
              >
                {coldStorages.map((cs) => (
                  <MenuItem key={cs.id} value={cs.id}>
                    {cs.godown_name} ({cs.external_company || 'Cold Storage'})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Operator Supplier */}
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label="Cold Storage Operator Partner"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                placeholder="e.g. AgroCold Services Pvt Ltd"
              />
            </Grid>

            {/* Date Range */}
            <Grid item xs={12} sm={2}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="Period From"
                value={periodFrom}
                onChange={(e) => setPeriodFrom(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={2}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="Period To *"
                value={periodTo}
                onChange={(e) => setPeriodTo(e.target.value)}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>

            {/* Operator's Actual Invoice Info */}
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label="Operator Invoice Number"
                placeholder="e.g. ACS/2026/044"
                value={operatorInvoiceNo}
                onChange={(e) => setOperatorInvoiceNo(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="Operator Invoice Date"
                value={operatorInvoiceDate}
                onChange={(e) => setOperatorInvoiceDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Operator Invoiced Amount (₹)"
                placeholder="0.00"
                value={operatorInvoiceAmount}
                onChange={(e) => setOperatorInvoiceAmount(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start">₹</InputAdornment>
                }}
              />
            </Grid>
            <Grid item xs={12} sm={2} sx={{ display: 'flex', alignItems: 'center' }}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<CalcIcon />}
                onClick={handleCalculateCharges}
                disabled={calculating}
                sx={{ backgroundColor: '#1f4fb2', height: 40 }}
              >
                {calculating ? 'Calculating...' : 'Calculate ERP Charges'}
              </Button>
            </Grid>
          </Grid>

          {/* Variance Detection Banner */}
          {numericOperatorInvoiceAmt > 0 && grandTotal > 0 && (
            <Box
              sx={{
                mt: 3,
                p: 2,
                borderRadius: 1.5,
                backgroundColor: Math.abs(variance) < 10 ? '#f0fdf4' : Math.abs(variance) < 500 ? '#fffbeb' : '#fef2f2',
                border: `1px solid ${Math.abs(variance) < 10 ? '#86efac' : Math.abs(variance) < 500 ? '#fde047' : '#fca5a5'}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 2
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {Math.abs(variance) < 10 ? (
                  <ApproveIcon color="success" sx={{ fontSize: 28 }} />
                ) : (
                  <WarningIcon color={Math.abs(variance) < 500 ? 'warning' : 'error'} sx={{ fontSize: 28 }} />
                )}
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                    Invoice Verification & Variance: {variance > 0 ? `Operator billed ₹${variance.toFixed(2)} extra` : variance < 0 ? `ERP expected ₹${Math.abs(variance).toFixed(2)} higher` : 'Exact Match (₹0 Variance)'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Operator Invoice: ₹{numericOperatorInvoiceAmt.toFixed(2)} vs ERP Accrual: ₹{grandTotal.toFixed(2)} ({variancePercent}% variance)
                  </Typography>
                </Box>
              </Box>
              <Chip
                label={Math.abs(variance) < 10 ? 'Exact Match' : Math.abs(variance) < 500 ? 'Acceptable Tolerance' : 'High Discrepancy Alert'}
                color={Math.abs(variance) < 10 ? 'success' : Math.abs(variance) < 500 ? 'warning' : 'error'}
                sx={{ fontWeight: 'bold' }}
              />
            </Box>
          )}

          <Divider sx={{ my: 3 }} />

          {/* Charges Breakdown Inputs */}
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#1f4fb2', mb: 2 }}>
            2. Itemized Charge Adjustments & GST Breakdown
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={2.4}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Storage Rent Charges (₹)"
                value={storageCharges}
                onChange={(e) => setStorageCharges(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start">₹</InputAdornment>
                }}
              />
            </Grid>
            <Grid item xs={12} sm={2.4}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Handling Charges (₹)"
                value={handlingCharges}
                onChange={(e) => setHandlingCharges(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start">₹</InputAdornment>
                }}
              />
            </Grid>
            <Grid item xs={12} sm={2.4}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Insurance Charges (₹)"
                value={insuranceCharges}
                onChange={(e) => setInsuranceCharges(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start">₹</InputAdornment>
                }}
              />
            </Grid>
            <Grid item xs={12} sm={2.4}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Mamool / Hamali Charges (₹)"
                value={mamoolCharges}
                onChange={(e) => setMamoolCharges(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start">₹</InputAdornment>
                }}
              />
            </Grid>
            <Grid item xs={12} sm={2.4}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Other / Freight Charges (₹)"
                value={otherCharges}
                onChange={(e) => setOtherCharges(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start">₹</InputAdornment>
                }}
              />
            </Grid>

            {/* Tax Settings */}
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="GST Rate %"
                value={gstRate}
                onChange={(e) => setGstRate(e.target.value)}
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>
                }}
              />
            </Grid>
            <Grid item xs={12} sm={3} sx={{ display: 'flex', alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={isInterstate}
                    onChange={(e) => setIsInterstate(e.target.checked)}
                    color="primary"
                  />
                }
                label={isInterstate ? 'Inter-State (IGST 18%)' : 'Intra-State (CGST 9% + SGST 9%)'}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Audit Remarks / Verification Notes"
                placeholder="e.g. Verified against 10-day storage slab agreement"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </Grid>
          </Grid>

          {/* Total Calculation Strip */}
          <Box
            sx={{
              mt: 3,
              p: 2,
              backgroundColor: '#eff6ff',
              borderRadius: 1.5,
              border: '1px solid #bfdbfe',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 2
            }}
          >
            <Box>
              <Typography variant="body2" color="text.secondary">Taxable Amount:</Typography>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1e40af' }}>
                ₹{taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                {isInterstate ? `IGST (${rate}%):` : `CGST (${rate / 2}%) + SGST (${rate / 2}%):`}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1e40af' }}>
                ₹{totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Grand Total Bill:</Typography>
              <Typography variant="h5" sx={{ fontWeight: '800', color: '#047857' }}>
                ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<SaveIcon />}
                onClick={handleSaveBill}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Pending Bill'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Bill History Table */}
      <Card sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>
              Cold Storage Operator Bills & Verification Register
            </Typography>
            <Button startIcon={<RefreshIcon />} size="small" onClick={fetchBills}>
              Refresh
            </Button>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : pastBills.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">No operator bills saved yet.</Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 1100 }}>
                <TableHead sx={{ backgroundColor: '#1f4fb2' }}>
                  <TableRow>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Bill #</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Bill Date</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Cold Storage Facility</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Operator Name</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Operator Inv #</TableCell>
                    <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold' }}>Invoiced Amt</TableCell>
                    <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold' }}>ERP Amt</TableCell>
                    <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold' }}>Variance</TableCell>
                    <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold' }}>Grand Total</TableCell>
                    <TableCell align="center" sx={{ color: '#fff', fontWeight: 'bold' }}>Status</TableCell>
                    <TableCell align="center" sx={{ color: '#fff', fontWeight: 'bold' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pastBills.map((b) => {
                    const isApproved = b.status === 'Approved';
                    const bVariance = parseFloat(b.variance_amount || 0);

                    return (
                      <TableRow key={b.id} sx={{ '&:hover': { backgroundColor: '#f8fafc' } }}>
                        <TableCell sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>{b.bill_no}</TableCell>
                        <TableCell>{b.bill_date}</TableCell>
                        <TableCell sx={{ fontWeight: '600' }}>{b.cold_storage_name}</TableCell>
                        <TableCell>{b.operator_name}</TableCell>
                        <TableCell>{b.operator_invoice_no || '—'}</TableCell>
                        <TableCell align="right">
                          ₹{parseFloat(b.operator_invoice_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell align="right">
                          ₹{parseFloat(b.erp_calculated_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: Math.abs(bVariance) > 100 ? '#dc2626' : '#059669' }}>
                          ₹{bVariance.toFixed(2)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: '800', color: '#047857' }}>
                          ₹{parseFloat(b.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={b.status}
                            color={isApproved ? 'success' : 'warning'}
                            size="small"
                            sx={{ fontWeight: 'bold' }}
                          />
                          {b.accounting_voucher_no && (
                            <Typography variant="caption" display="block" color="text.secondary">
                              {b.accounting_voucher_no}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', alignItems: 'center' }}>
                            <Tooltip title="Print Cold Storage Release Order (CSRO)">
                              <IconButton
                                size="small"
                                sx={{ color: '#1e3a8a', bgcolor: '#eff6ff' }}
                                onClick={() => {
                                  const vTarget = b.voucher_no || (b.bill_no?.startsWith('CSB-') ? b.bill_no.replace('CSB-', '') : '');
                                  setSelectedCsroVoucher({
                                    voucher_no: vTarget,
                                    voucher_date: b.bill_date,
                                    cold_storage_name: b.cold_storage_name,
                                    operator_name: b.operator_name,
                                    vehicle_no: b.vehicle_no,
                                    driver_name: b.driver_name,
                                    driver_phone: b.driver_phone,
                                    transporter_name: b.transporter_name,
                                    items: typeof b.items_json === 'string' ? JSON.parse(b.items_json) : (b.items_json || [])
                                  });
                                  setCsroModalOpen(true);
                                }}
                              >
                                <ColdIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Open Full 10-Column CSO Bill Statement Preview & Editor">
                              <IconButton
                                size="small"
                                sx={{ color: '#d97706', bgcolor: '#fffbeb' }}
                                onClick={() => {
                                  const vTarget = b.voucher_no || (b.bill_no?.startsWith('CSB-') ? b.bill_no.replace('CSB-', '') : '');
                                  navigate(`/cold-storage/out?view=history&voucher_no=${vTarget}`);
                                }}
                              >
                                <BillIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="View Lot Breakdown">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => {
                                  setSelectedBillDetails(b);
                                  setDetailsModalOpen(true);
                                }}
                              >
                                <ViewIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Print Statement">
                              <IconButton size="small" color="secondary" onClick={() => handlePrintBill(b)}>
                                <PrintIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {!isApproved && (
                              <Tooltip title="Approve & Post to Accounts Ledger">
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => handleApproveBill(b.id)}
                                  disabled={approving}
                                >
                                  <ApproveIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {!isApproved && (
                              <Tooltip title="Delete">
                                <IconButton size="small" color="error" onClick={() => handleDeleteBill(b.id)}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Lot Breakdown Modal */}
      <Dialog open={detailsModalOpen} onClose={() => setDetailsModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ backgroundColor: '#1f4fb2', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Bill Details: {selectedBillDetails?.bill_no}</span>
          <Chip
            label={selectedBillDetails?.status || 'Pending'}
            sx={{ backgroundColor: '#fff', color: '#1f4fb2', fontWeight: 'bold' }}
          />
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {selectedBillDetails && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6}>
                  <Typography variant="body2"><strong>Facility:</strong> {selectedBillDetails.cold_storage_name}</Typography>
                  <Typography variant="body2"><strong>Operator:</strong> {selectedBillDetails.operator_name}</Typography>
                  <Typography variant="body2"><strong>Period:</strong> {selectedBillDetails.period_from || '—'} to {selectedBillDetails.period_to || '—'}</Typography>
                </Grid>
                <Grid item xs={6} sx={{ textAlign: 'right' }}>
                  <Typography variant="body2"><strong>Operator Invoice #:</strong> {selectedBillDetails.operator_invoice_no || 'N/A'}</Typography>
                  <Typography variant="body2"><strong>Invoiced Amount:</strong> ₹{selectedBillDetails.operator_invoice_amount}</Typography>
                  <Typography variant="body2"><strong>Grand Total:</strong> ₹{selectedBillDetails.grand_total}</Typography>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: '#1f4fb2' }}>
                Stored Lots & Calculated Charges:
              </Typography>

              {(() => {
                let items = [];
                try {
                  items = typeof selectedBillDetails.items_json === 'string'
                    ? JSON.parse(selectedBillDetails.items_json)
                    : (selectedBillDetails.items_json || []);
                } catch (_) {}

                if (items.length === 0) {
                  return <Typography color="text.secondary">No lot breakdown available for this bill.</Typography>;
                }

                return (
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead sx={{ backgroundColor: '#f1f5f9' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Item Name</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>CS Lot #</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Units Stored</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 'bold' }}>Days (Slabs)</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Storage Rent</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Handling</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total Charges</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {items.map((it, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{it.item_name}</TableCell>
                            <TableCell>{it.cold_storage_lot_no}</TableCell>
                            <TableCell align="right">{it.billable_units || it.in_qty || 0}</TableCell>
                            <TableCell align="center">{it.storage_days || 0}d ({it.billing_periods || 1} slab)</TableCell>
                            <TableCell align="right">₹{parseFloat(it.storage_charges || 0).toFixed(2)}</TableCell>
                            <TableCell align="right">₹{parseFloat(it.handling_charges || 0).toFixed(2)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>₹{parseFloat(it.total_charges || 0).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                );
              })()}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDetailsModalOpen(false)}>Close</Button>
          {selectedBillDetails && (
            <Button
              variant="contained"
              startIcon={<PrintIcon />}
              onClick={() => handlePrintBill(selectedBillDetails)}
            >
              Print Statement
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* CSRO Release Order Modal */}
      <ColdStorageReleaseOrderModal
        open={csroModalOpen}
        onClose={() => setCsroModalOpen(false)}
        csoData={selectedCsroVoucher}
      />
    </Box>
  );
};

export default ColdStorageBilling;
