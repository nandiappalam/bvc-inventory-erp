import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Button,
  IconButton,
  Chip,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Divider,
  Alert,
  Tooltip,
  CircularProgress,
  Badge,
  InputAdornment,
  TablePagination,
  Snackbar,
  Switch,
  FormControlLabel
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PaymentIcon from '@mui/icons-material/Payment';
import PrintIcon from '@mui/icons-material/Print';
import CancelIcon from '@mui/icons-material/Cancel';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PersonIcon from '@mui/icons-material/Person';
import EngineeringIcon from '@mui/icons-material/Engineering';
import DriveEtaIcon from '@mui/icons-material/DriveEta';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import TimelineIcon from '@mui/icons-material/Timeline';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SettingsIcon from '@mui/icons-material/Settings';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CloseIcon from '@mui/icons-material/Close';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';

const CHARGE_TYPE_CONFIG = {
  LOADING: { label: 'Loading', color: '#10b981', bg: '#ecfdf5', icon: EngineeringIcon },
  UNLOADING: { label: 'Unloading', color: '#06b6d4', bg: '#ecfeff', icon: EngineeringIcon },
  DRIVER: { label: 'Driver', color: '#3b82f6', bg: '#eff6ff', icon: DriveEtaIcon },
  TRANSPORT: { label: 'Transport', color: '#6366f1', bg: '#eef2ff', icon: LocalShippingIcon },
  HELPER: { label: 'Helper', color: '#8b5cf6', bg: '#f5f3ff', icon: PersonIcon },
  PROCESSING: { label: 'Outside Mill Processing', color: '#d97706', bg: '#fffbeb', icon: SettingsIcon },
  WEIGHING: { label: 'Weighing', color: '#64748b', bg: '#f8fafc', icon: AssessmentIcon },
  LABOUR: { label: 'General Labour', color: '#059669', bg: '#f0fdf4', icon: PersonIcon },
  OTHER: { label: 'Other', color: '#64748b', bg: '#f1f5f9', icon: AttachMoneyIcon }
};

const STATUS_CONFIG = {
  PENDING: { label: 'Pending Approval', color: '#f59e0b', bg: '#fef3c7' },
  APPROVED: { label: 'Approved', color: '#3b82f6', bg: '#eff6ff' },
  PARTIALLY_PAID: { label: 'Partially Paid', color: '#8b5cf6', bg: '#f3e8ff' },
  PAID: { label: 'Fully Paid', color: '#10b981', bg: '#d1fae5' },
  CANCELLED: { label: 'Cancelled', color: '#ef4444', bg: '#fee2e2' }
};

export default function OperationalChargesHub() {
  const { selectedCompany, user } = useAuth();
  const confirm = useConfirm();
  const companyId = selectedCompany?.id || 1;

  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});

  // Charges state
  const [charges, setCharges] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterModule, setFilterModule] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);

  // Masters
  const [parties, setParties] = useState([]);
  const [rates, setRates] = useState([]);
  const [payments, setPayments] = useState([]);

  // Rate filters
  const [rateSearchQuery, setRateSearchQuery] = useState('');
  const [rateFilterType, setRateFilterType] = useState('ALL');
  const [rateFilterStatus, setRateFilterStatus] = useState('ALL'); // ALL, ACTIVE, INACTIVE

  // In-app Snackbar notifications (avoids window.alert)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  const notify = (message, severity = 'success') => {
    setToast({ open: true, message, severity });
  };

  // Modals
  const [chargeModalOpen, setChargeModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [traceModalOpen, setTraceModalOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [partyModalOpen, setPartyModalOpen] = useState(false);
  const [rateModalOpen, setRateModalOpen] = useState(false);

  // Selected entities for actions
  const [selectedCharge, setSelectedCharge] = useState(null);
  const [traceData, setTraceData] = useState(null);
  const [printData, setPrintData] = useState(null);
  const [printDocType, setPrintDocType] = useState('CHARGE_VOUCHER'); // CHARGE_VOUCHER, PAYMENT_RECEIPT, LOADING_SLIP, DRIVER_RECEIPT

  // Charge Form
  const [chargeForm, setChargeForm] = useState({
    charge_no: '',
    source_module: 'GODOWN_TRANSFER',
    source_transaction_no: '',
    charge_type: 'LOADING',
    party_id: '',
    party_name: '',
    party_category: 'LOADMAN',
    vehicle_no: '',
    driver_name: '',
    item_name: 'Broken Rice',
    lot_no: '',
    from_location: 'Main Godown',
    to_location: 'Godown B',
    quantity: '5000',
    uom: 'KG',
    rate: '0.50',
    calculation_basis: 'PER_KG',
    amount: '2500',
    remarks: '',
    workers: [
      { party_name: 'Ramesh Loadman', party_category: 'LOADMAN', worker_role: 'Lead Loader', amount: '1000' },
      { party_name: 'Kumar Loadman', party_category: 'LOADMAN', worker_role: 'Loader', amount: '800' },
      { party_name: 'Selvam Unload Worker', party_category: 'LOADMAN', worker_role: 'Loader', amount: '700' }
    ]
  });

  // Payment Form
  const [paymentForm, setPaymentForm] = useState({
    party_id: '',
    party_name: '',
    party_category: 'LOADMAN',
    paid_amount: '',
    payment_method: 'CASH',
    reference_no: '',
    cash_bank_ledger: 'Cash in Hand',
    paid_by: user?.username || 'Admin',
    received_by: '',
    remarks: '',
    allocations: []
  });

  // Party Form
  const [partyForm, setPartyForm] = useState({
    id: null,
    name: '',
    party_category: 'LOADMAN',
    phone: '',
    address: '',
    payment_mode: 'CASH',
    upi_id: '',
    notes: ''
  });

  // Rate Form
  const [rateForm, setRateForm] = useState({
    id: null,
    charge_type: 'LOADING',
    party_category: 'LOADMAN',
    calculation_basis: 'PER_KG',
    rate: '0.50',
    uom: 'KG',
    notes: ''
  });

  // Reports
  const [reportType, setReportType] = useState('SUMMARY');
  const [reportData, setReportData] = useState(null);

  // Headers for API calls
  const apiHeaders = useMemo(() => ({
    headers: { 'x-company-id': companyId }
  }), [companyId]);

  // Load initial data
  const loadData = async () => {
    setLoading(true);
    try {
      const [sumRes, chRes, pRes, rRes, payRes] = await Promise.all([
        axios.get('/api/operational-charges/summary', apiHeaders).catch(() => ({ data: { stats: {}, data: { summary: {} } } })),
        axios.get('/api/operational-charges/charges', { ...apiHeaders, params: { charge_type: filterType, status: filterStatus, source_module: filterModule, search: searchQuery, from_date: fromDate, to_date: toDate } }).catch(() => ({ data: { charges: [], data: [] } })),
        axios.get('/api/operational-charges/parties', apiHeaders).catch(() => ({ data: { parties: [], data: [] } })),
        axios.get('/api/operational-charges/rates', apiHeaders).catch(() => ({ data: { rates: [], data: [] } })),
        axios.get('/api/operational-charges/payments', apiHeaders).catch(() => ({ data: { payments: [], data: [] } }))
      ]);

      setStats(sumRes.data?.stats || sumRes.data?.data?.summary || {});
      setCharges(Array.isArray(chRes.data?.charges) ? chRes.data.charges : (Array.isArray(chRes.data?.data) ? chRes.data.data : []));
      setParties(Array.isArray(pRes.data?.parties) ? pRes.data.parties : (Array.isArray(pRes.data?.data) ? pRes.data.data : []));
      setRates(Array.isArray(rRes.data?.rates) ? rRes.data.rates : (Array.isArray(rRes.data?.data) ? rRes.data.data : []));
      setPayments(Array.isArray(payRes.data?.payments) ? payRes.data.payments : (Array.isArray(payRes.data?.data) ? payRes.data.data : []));
    } catch (err) {
      console.error('Error loading operational data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [companyId, filterType, filterStatus, filterModule, fromDate, toDate]);

  // Open Create Charge Modal with auto next number
  const handleOpenCreateCharge = async () => {
    try {
      const numRes = await axios.get('/api/operational-charges/next-number', apiHeaders);
      setChargeForm(prev => ({
        ...prev,
        charge_no: numRes.data?.next_charge_no || `OC-${Date.now().toString().slice(-5)}`,
        workers: [
          { party_name: 'Ramesh Loadman', party_category: 'LOADMAN', worker_role: 'Lead Loader', amount: '1000' },
          { party_name: 'Kumar Loadman', party_category: 'LOADMAN', worker_role: 'Loader', amount: '800' },
          { party_name: 'Selvam Unload Worker', party_category: 'LOADMAN', worker_role: 'Loader', amount: '700' }
        ]
      }));
    } catch (_) {}
    setChargeModalOpen(true);
  };

  // Auto calculate when charge form values change
  const handleAutoCalculateCharge = async (type, basis, qty) => {
    try {
      const calcRes = await axios.post('/api/operational-charges/calculate', {
        charge_type: type,
        calculation_basis: basis,
        quantity: qty
      }, apiHeaders);
      if (calcRes.data?.success) {
        const c = calcRes.data.calculation;
        setChargeForm(prev => ({
          ...prev,
          rate: c.rate.toString(),
          calculation_basis: c.calculation_basis,
          amount: c.amount.toString()
        }));
      }
    } catch (_) {}
  };

  // Submit Create Charge
  const handleSaveCharge = async () => {
    try {
      setLoading(true);
      await axios.post('/api/operational-charges', chargeForm, apiHeaders);
      setChargeModalOpen(false);
      notify('Operational charge recorded successfully!', 'success');
      await loadData();
    } catch (err) {
      notify('Error saving charge: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Approve Charge
  const handleApproveCharge = async (charge) => {
    try {
      setLoading(true);
      await axios.post(`/api/operational-charges/${charge.id}/approve`, {
        approved_by: user?.username || 'Manager'
      }, apiHeaders);
      notify(`Operational Charge ${charge.charge_no} approved & posted to accounts!`, 'success');
      await loadData();
    } catch (err) {
      notify('Error approving charge: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Cancel Charge
  const handleCancelCharge = async (charge) => {
    try {
      setLoading(true);
      await axios.post(`/api/operational-charges/${charge.id}/cancel`, { reason: 'Operation cancelled by user' }, apiHeaders);
      notify(`Operational Charge ${charge.charge_no} cancelled.`, 'info');
      await loadData();
    } catch (err) {
      notify('Error cancelling charge: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Open Payment Modal pre-filled for a specific charge or general party
  const handleOpenPayment = (charge = null) => {
    if (charge) {
      setPaymentForm({
        party_id: charge.party_id || '',
        party_name: charge.party_name || '',
        party_category: charge.party_category || 'LOADMAN',
        paid_amount: charge.balance_amount ? charge.balance_amount.toString() : '',
        payment_method: 'CASH',
        reference_no: `Ref: ${charge.charge_no}`,
        cash_bank_ledger: 'Cash in Hand',
        paid_by: user?.username || 'Admin',
        received_by: charge.party_name || '',
        remarks: `Payment against ${charge.charge_no} (${charge.source_module} ${charge.source_transaction_no || ''})`,
        allocations: [{
          charge_id: charge.id,
          charge_no: charge.charge_no,
          allocated_amount: charge.balance_amount
        }]
      });
    } else {
      const defaultParty = parties && parties.length > 0 ? parties[0] : null;
      setPaymentForm({
        party_id: defaultParty ? defaultParty.id : '',
        party_name: defaultParty ? defaultParty.name : '',
        party_category: defaultParty ? (defaultParty.category || defaultParty.party_category || 'LOADMAN') : 'LOADMAN',
        paid_amount: '',
        payment_method: 'CASH',
        reference_no: '',
        cash_bank_ledger: 'Cash in Hand',
        paid_by: user?.username || 'Admin',
        received_by: defaultParty ? defaultParty.name : '',
        remarks: '',
        allocations: []
      });
    }
    setPaymentModalOpen(true);
  };

  // Submit Payment
  const handleSavePayment = async () => {
    try {
      const recName = paymentForm.party_name?.trim() || '';
      if (!paymentForm.party_id && !recName) {
        notify('Please select or enter a recipient Worker / Driver / Transporter name', 'warning');
        return;
      }
      const amountNum = Number(paymentForm.paid_amount);
      if (!paymentForm.paid_amount || isNaN(amountNum) || amountNum <= 0) {
        notify('Please enter a valid disbursement amount greater than 0', 'warning');
        return;
      }

      setLoading(true);
      const rawPid = paymentForm.party_id;
      const cleanPartyId = rawPid
        ? (typeof rawPid === 'string' && (rawPid.startsWith('TM_') || isNaN(Number(rawPid))) ? rawPid : Number(rawPid))
        : undefined;

      const payload = {
        ...paymentForm,
        party_id: cleanPartyId,
        party_name: recName || paymentForm.party_name,
        paid_amount: amountNum,
        payment_mode: paymentForm.payment_method || 'CASH',
        notes: paymentForm.remarks || paymentForm.notes || ''
      };

      const response = await axios.post('/api/operational-charges/payments', payload, apiHeaders);
      if (response.data?.success) {
        const savedData = response.data.data;
        const newRecord = {
          id: savedData?.id || Date.now(),
          payment_no: savedData?.payment_no || 'OPP-NEW',
          payment_date: payload.payment_date || new Date().toISOString().split('T')[0],
          party_id: cleanPartyId,
          party_name: payload.party_name,
          party_category: paymentForm.party_category || 'LOADMAN',
          payment_method: payload.payment_mode,
          payment_mode: payload.payment_mode,
          paid_amount: payload.paid_amount,
          reference_no: payload.reference_no,
          voucher_no: savedData?.voucher_no || 'Auto-posted',
          paid_by: payload.paid_by || 'Admin',
          allocations: []
        };
        // Optimistically insert to front of payments table
        setPayments(prev => [newRecord, ...prev.filter(x => x.id !== newRecord.id)]);
        setPaymentModalOpen(false);
        setActiveTab(1); // Switch to Tab 1 (Payment Receipts & Vouchers) so user immediately sees saved details in the table
        notify('Payment receipt created & saved successfully! Added to Payment Receipts & Vouchers register.', 'success');
        await loadData();
      } else {
        notify('Error recording payment: ' + (response.data?.error || 'Unknown error'), 'error');
      }
    } catch (err) {
      console.error('Payment save error:', err);
      notify('Error recording payment: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Toggle Active/Inactive for a Rate Card
  const handleToggleRateActive = async (rateId, currentStatus) => {
    try {
      setLoading(true);
      const res = await axios.post(`/api/operational-charges/rates/${rateId}/toggle-active`, {}, apiHeaders);
      const nextActive = res.data?.is_active ?? (currentStatus ? 0 : 1);
      setRates(prev => prev.map(r => String(r.id) === String(rateId) ? { ...r, is_active: nextActive } : r));
      notify(`Rate ${nextActive ? 'activated' : 'deactivated (hidden from active operations)'}`, 'success');
      await loadData();
    } catch (err) {
      notify('Error toggling rate: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Delete Rate Card permanently with confirmation
  const handleDeleteRate = (rateId, rateCode) => {
    confirm({
      title: 'Confirm Rate Deletion',
      message: `Are you sure you want to delete Rate Master ${rateCode || '#' + rateId}?\n\nThis will remove the rate configuration from operational charge calculations.`,
      confirmText: 'Delete Rate',
      confirmColor: 'error',
      onConfirm: async () => {
        try {
          setLoading(true);
          await axios.delete(`/api/operational-charges/rates/${rateId}`, apiHeaders);
          setRates(prev => prev.filter(r => String(r.id) !== String(rateId)));
          notify(`Rate ${rateCode || '#' + rateId} deleted successfully`, 'success');
          await loadData();
        } catch (err) {
          notify('Error deleting rate: ' + (err.response?.data?.error || err.message), 'error');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // Purge all Inactive / Unwanted Rates with confirmation
  const handlePurgeInactiveRates = () => {
    confirm({
      title: 'Confirm Purge Inactive Rates',
      message: 'Are you sure you want to permanently purge all inactive rates? Active rates will remain unaffected.',
      confirmText: 'Purge Inactive',
      confirmColor: 'error',
      onConfirm: async () => {
        try {
          setLoading(true);
          const res = await axios.post('/api/operational-charges/rates/cleanup-inactive', {}, apiHeaders);
          notify(res.data?.message || 'Purged inactive rates successfully', 'success');
          await loadData();
        } catch (err) {
          notify('Error purging inactive rates: ' + (err.response?.data?.error || err.message), 'error');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // Delete Payment record with confirmation
  const handleDeletePayment = (payment) => {
    const pNo = payment.payment_no || `#${payment.id}`;
    const pAmt = payment.paid_amount ? ` for ₹${Number(payment.paid_amount).toLocaleString('en-IN')}` : '';
    const pParty = payment.party_name ? ` (${payment.party_name})` : '';

    confirm({
      title: 'Confirm Payment Record Deletion',
      message: `Are you sure you want to delete Payment Record ${pNo}${pAmt}${pParty}?\n\nThis will remove the disbursement receipt and restore outstanding dues on linked operational charges. This action cannot be undone.`,
      confirmText: 'Delete Payment',
      confirmColor: 'error',
      onConfirm: async () => {
        try {
          setLoading(true);
          await axios.delete(`/api/operational-charges/payments/${payment.id}`, apiHeaders);
          setPayments(prev => prev.filter(item => String(item.id) !== String(payment.id)));
          notify(`Payment ${pNo} deleted successfully`, 'success');
          await loadData();
        } catch (err) {
          notify('Error deleting payment: ' + (err.response?.data?.error || err.message), 'error');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // Edit Payment Record
  const handleEditPayment = (p) => {
    setPaymentForm({
      id: p.id,
      party_id: p.party_id || '',
      party_name: p.party_name || '',
      party_category: p.party_category || 'LOADMAN',
      paid_amount: p.paid_amount ? p.paid_amount.toString() : '',
      payment_method: p.payment_method || p.payment_mode || 'CASH',
      reference_no: p.reference_no || '',
      cash_bank_ledger: p.cash_bank_ledger || 'Cash in Hand',
      paid_by: p.paid_by || user?.username || 'Admin',
      received_by: p.received_by || p.party_name || '',
      remarks: p.remarks || '',
      allocations: p.allocations || []
    });
    setPaymentModalOpen(true);
  };

  // Delete Operational Party permanently with confirmation
  const handleDeleteParty = (partyId, partyName) => {
    confirm({
      title: 'Confirm Party Deletion',
      message: `Are you sure you want to delete Operational Party "${partyName}"?\n\nThis will remove the party from operational master records.`,
      confirmText: 'Delete Party',
      confirmColor: 'error',
      onConfirm: async () => {
        try {
          setLoading(true);
          await axios.delete(`/api/operational-charges/parties/${partyId}`, apiHeaders);
          setParties(prev => prev.filter(p => String(p.id) !== String(partyId)));
          notify(`Party "${partyName}" deleted successfully`, 'success');
          await loadData();
        } catch (err) {
          notify('Error deleting party: ' + (err.response?.data?.error || err.message), 'error');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // Print Party Statement / Details
  const handlePrintParty = (p) => {
    setPrintDocType('PARTY_STATEMENT');
    setPrintData({
      company: { name: selectedCompany?.name || 'BVC Exports Pvt Ltd' },
      party: p
    });
    setPrintModalOpen(true);
  };

  // Print Rate Card Details
  const handlePrintRate = (r) => {
    setPrintDocType('RATE_CARD');
    setPrintData({
      company: { name: selectedCompany?.name || 'BVC Exports Pvt Ltd' },
      rate: r
    });
    setPrintModalOpen(true);
  };

  // Open Traceability Lineage Modal
  const handleOpenTrace = async (charge) => {
    setSelectedCharge(charge);
    setTraceData(null);
    setTraceModalOpen(true);
    try {
      const tRes = await axios.get('/api/operational-charges/traceability', {
        ...apiHeaders,
        params: {
          charge_id: charge.id,
          source_module: charge.source_module,
          source_transaction_id: charge.source_transaction_id,
          source_transaction_no: charge.source_transaction_no
        }
      });
      setTraceData(tRes.data?.traceability);
    } catch (err) {
      console.error('Error fetching traceability:', err);
    }
  };

  // Open Print Modal
  const handleOpenPrint = async (charge, docType = 'CHARGE_VOUCHER') => {
    setSelectedCharge(charge);
    setPrintDocType(docType);
    setPrintData(null);
    setPrintModalOpen(true);
    try {
      const pRes = await axios.get(`/api/operational-charges/${charge.id}/print`, apiHeaders);
      setPrintData(pRes.data);
    } catch (err) {
      console.error('Error fetching print data:', err);
    }
  };

  // Load Reports Tab Data
  const handleLoadReport = async (type) => {
    setReportType(type);
    setLoading(true);
    try {
      const rRes = await axios.get('/api/operational-charges/reports', {
        ...apiHeaders,
        params: {
          report_type: type,
          from_date: fromDate,
          to_date: toDate,
          charge_type: filterType,
          source_module: filterModule
        }
      });
      setReportData(rRes.data);
    } catch (err) {
      console.error('Error loading report:', err);
    } finally {
      setLoading(false);
    }
  };

  // Print Window Execution
  const triggerNativePrint = () => {
    window.print();
  };

  return (
    <Box sx={{ width: '100%', pb: 6 }}>
      {/* Top Banner Header */}
      <Paper sx={{
        p: 3,
        mb: 3,
        borderRadius: 2,
        background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
        color: '#ffffff',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 2,
        boxShadow: '0 4px 20px rgba(37, 99, 235, 0.25)'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 2 }}>
            <AccountBalanceWalletIcon sx={{ fontSize: 36, color: '#93c5fd' }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '0.5px' }}>
              Factory Operational Charges & Worker/Driver Payment Hub
            </Typography>
            <Typography variant="body2" sx={{ color: '#dbeafe', mt: 0.5 }}>
              Centralized loading/unloading costs, driver trip charges, transport fees & labour accounting across Godown Transfer, Outpass, Inpass, Purchases & Sales
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={loadData}
            sx={{ bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={handleOpenCreateCharge}
            sx={{ bgcolor: '#10b981', fontWeight: 700, '&:hover': { bgcolor: '#059669' } }}
          >
            Record Operation / Charge
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<PaymentIcon />}
            onClick={() => handleOpenPayment()}
            sx={{ bgcolor: '#f59e0b', fontWeight: 700, '&:hover': { bgcolor: '#d97706' } }}
          >
            Issue Worker/Driver Payment
          </Button>
        </Box>
      </Paper>

      {/* KPI Tiles */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid #10b981', borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Today's Loading Cost
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', mt: 0.5 }}>
                ₹{Number(stats.today_loading_cost || 0).toLocaleString()}
              </Typography>
              <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 600 }}>
                Unloading: ₹{Number(stats.today_unloading_cost || 0).toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid #3b82f6', borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Today's Driver & Transport
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#1e3a8a', mt: 0.5 }}>
                ₹{Number((Number(stats.today_driver_cost || 0) + Number(stats.today_transport_cost || 0))).toLocaleString()}
              </Typography>
              <Typography variant="caption" sx={{ color: '#3b82f6', fontWeight: 600 }}>
                Driver: ₹{Number(stats.today_driver_cost || 0).toLocaleString()} | Transport: ₹{Number(stats.today_transport_cost || 0).toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid #f59e0b', borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Pending Approval / Payable
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#b45309', mt: 0.5 }}>
                ₹{Number(stats.total_outstanding_payable || 0).toLocaleString()}
              </Typography>
              <Typography variant="caption" sx={{ color: '#d97706', fontWeight: 600 }}>
                {stats.pending_approval_count || 0} Pending Approvals | {stats.pending_payments_count || 0} Awaiting Payment
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid #8b5cf6', borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Disbursed Payments (Paid)
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#6d28d9', mt: 0.5 }}>
                ₹{Number(stats.total_paid_amount || 0).toLocaleString()}
              </Typography>
              <Typography variant="caption" sx={{ color: '#8b5cf6', fontWeight: 600 }}>
                {stats.fully_paid_count || 0} Fully Settled Operations
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Tabs Navigation */}
      <Paper sx={{ borderRadius: 2, mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(e, val) => setActiveTab(val)}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: '1px solid #e2e8f0', px: 2 }}
        >
          <Tab label={`Operational Charges Register (${charges.length})`} sx={{ fontWeight: 700, py: 2 }} />
          <Tab label={`Payment Receipts & Vouchers (${payments.length})`} sx={{ fontWeight: 700, py: 2 }} />
          <Tab label={`Workers & Transporters Master (${parties.length})`} sx={{ fontWeight: 700, py: 2 }} />
          <Tab label={`Configurable Rates Master (${rates.length})`} sx={{ fontWeight: 700, py: 2 }} />
          <Tab label="Cost Analytics & Traceability Reports" sx={{ fontWeight: 700, py: 2 }} />
        </Tabs>

        {/* TAB 0: Operational Charges Register */}
        {activeTab === 0 && (
          <Box sx={{ p: 3 }}>
            {/* Filter Bar */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2, bgcolor: '#f8fafc' }}>
              <Grid container spacing={1.5} alignItems="center">
                <Grid item xs={12} sm={3}>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="Search by Charge No, Worker, Vehicle..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ color: '#94a3b8' }} />
                        </InputAdornment>
                      )
                    }}
                  />
                </Grid>
                <Grid item xs={6} sm={2}>
                  <TextField
                    select
                    size="small"
                    fullWidth
                    label="Charge Type"
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                  >
                    <MenuItem value="ALL">All Types</MenuItem>
                    <MenuItem value="LOADING">Loading</MenuItem>
                    <MenuItem value="UNLOADING">Unloading</MenuItem>
                    <MenuItem value="DRIVER">Driver</MenuItem>
                    <MenuItem value="TRANSPORT">Transport</MenuItem>
                    <MenuItem value="HELPER">Helper</MenuItem>
                    <MenuItem value="PROCESSING">Mill Processing</MenuItem>
                    <MenuItem value="WEIGHING">Weighing</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={6} sm={2}>
                  <TextField
                    select
                    size="small"
                    fullWidth
                    label="Status"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <MenuItem value="ALL">All Statuses</MenuItem>
                    <MenuItem value="PENDING">Pending Approval</MenuItem>
                    <MenuItem value="APPROVED">Approved (Unpaid)</MenuItem>
                    <MenuItem value="PARTIALLY_PAID">Partially Paid</MenuItem>
                    <MenuItem value="PAID">Fully Paid</MenuItem>
                    <MenuItem value="CANCELLED">Cancelled</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={6} sm={2}>
                  <TextField
                    select
                    size="small"
                    fullWidth
                    label="Source Module"
                    value={filterModule}
                    onChange={(e) => setFilterModule(e.target.value)}
                  >
                    <MenuItem value="ALL">All Modules</MenuItem>
                    <MenuItem value="GODOWN_TRANSFER">Godown Transfer</MenuItem>
                    <MenuItem value="OUTPASS">Outpass</MenuItem>
                    <MenuItem value="INPASS">Inpass</MenuItem>
                    <MenuItem value="PURCHASE">Purchase</MenuItem>
                    <MenuItem value="SALES">Sales</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={6} sm={1.5}>
                  <TextField
                    type="date"
                    size="small"
                    fullWidth
                    label="From Date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={6} sm={1.5}>
                  <TextField
                    type="date"
                    size="small"
                    fullWidth
                    label="To Date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
            </Paper>

            {/* Charges Table */}
            <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Charge No & Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Source Transaction</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Operation & Type</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Worker / Driver / Transporter</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Vehicle & Route</TableCell>
                    <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Quantity & Rate</TableCell>
                    <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Total Amount</TableCell>
                    <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Balance</TableCell>
                    <TableCell sx={{ fontWeight: 700, textAlign: 'center' }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700, textAlign: 'center' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {charges.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} sx={{ textAlign: 'center', py: 4, color: '#94a3b8' }}>
                        No operational charges recorded. Click "Record Operation / Charge" to log physical loading, unloading or driver payments.
                      </TableCell>
                    </TableRow>
                  ) : (
                    charges.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((c) => {
                      const typeCfg = CHARGE_TYPE_CONFIG[c.charge_type] || CHARGE_TYPE_CONFIG.OTHER;
                      const statusCfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.PENDING;
                      const isPending = c.status === 'PENDING';
                      const isUnpaid = c.status === 'APPROVED' || c.status === 'PARTIALLY_PAID';

                      return (
                        <TableRow key={c.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e3a8a', fontFamily: 'monospace' }}>
                              {c.charge_no}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                              {c.charge_date}
                            </Typography>
                          </TableCell>

                          <TableCell>
                            <Chip
                              label={c.source_module.replace('_', ' ')}
                              size="small"
                              sx={{ fontSize: 10, height: 20, fontWeight: 700, bgcolor: '#e2e8f0', mb: 0.5 }}
                            />
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {c.source_transaction_no || `ID: ${c.source_transaction_id}`}
                            </Typography>
                          </TableCell>

                          <TableCell>
                            <Chip
                              label={typeCfg.label}
                              size="small"
                              sx={{
                                fontWeight: 800,
                                fontSize: 11,
                                height: 22,
                                color: typeCfg.color,
                                bgcolor: typeCfg.bg,
                                border: `1px solid ${typeCfg.color}`
                              }}
                            />
                            {c.item_name && (
                              <Typography variant="caption" sx={{ display: 'block', color: '#64748b', mt: 0.3 }}>
                                {c.item_name} {c.lot_no ? `(${c.lot_no})` : ''}
                              </Typography>
                            )}
                          </TableCell>

                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {c.party_name}
                            </Typography>
                            <Chip
                              label={c.party_category || 'LABOUR'}
                              size="small"
                              sx={{ fontSize: 9, height: 18, bgcolor: '#f1f5f9', color: '#475569' }}
                            />
                          </TableCell>

                          <TableCell>
                            {c.vehicle_no ? (
                              <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                                {c.vehicle_no}
                              </Typography>
                            ) : (
                              <Typography variant="caption" sx={{ color: '#94a3b8' }}>-</Typography>
                            )}
                            {(c.from_location || c.to_location) && (
                              <Typography variant="caption" sx={{ display: 'block', color: '#64748b' }}>
                                {c.from_location} ➔ {c.to_location}
                              </Typography>
                            )}
                          </TableCell>

                          <TableCell sx={{ textAlign: 'right' }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {Number(c.quantity).toLocaleString()} {c.uom}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                              @ ₹{c.rate} / {c.calculation_basis}
                            </Typography>
                          </TableCell>

                          <TableCell sx={{ textAlign: 'right' }}>
                            <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                              ₹{Number(c.total_amount).toLocaleString()}
                            </Typography>
                            {c.paid_amount > 0 && (
                              <Typography variant="caption" sx={{ color: '#16a34a', display: 'block' }}>
                                Paid: ₹{Number(c.paid_amount).toLocaleString()}
                              </Typography>
                            )}
                          </TableCell>

                          <TableCell sx={{ textAlign: 'right' }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: c.balance_amount > 0 ? '#b45309' : '#10b981' }}>
                              ₹{Number(c.balance_amount).toLocaleString()}
                            </Typography>
                          </TableCell>

                          <TableCell sx={{ textAlign: 'center' }}>
                            <Chip
                              label={statusCfg.label}
                              size="small"
                              sx={{
                                fontWeight: 800,
                                fontSize: 10,
                                height: 20,
                                color: statusCfg.color,
                                bgcolor: statusCfg.bg
                              }}
                            />
                          </TableCell>

                          <TableCell sx={{ textAlign: 'center' }}>
                            <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                              <Tooltip title="View Traceability & Audit History">
                                <IconButton size="small" onClick={() => handleOpenTrace(c)} sx={{ color: '#2563eb' }}>
                                  <TimelineIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>

                              {isPending && (
                                <Tooltip title="Approve & Post Accrual">
                                  <IconButton size="small" onClick={() => handleApproveCharge(c)} sx={{ color: '#10b981' }}>
                                    <CheckCircleIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}

                              {isUnpaid && (
                                <Tooltip title="Issue Payment to Worker/Driver">
                                  <IconButton size="small" onClick={() => handleOpenPayment(c)} sx={{ color: '#f59e0b' }}>
                                    <PaymentIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}

                              <Tooltip title="Print Slip / Voucher">
                                <IconButton size="small" onClick={() => handleOpenPrint(c, 'CHARGE_VOUCHER')} sx={{ color: '#64748b' }}>
                                  <PrintIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>

                              {c.status !== 'CANCELLED' && c.paid_amount === 0 && (
                                <Tooltip title="Cancel Charge">
                                  <IconButton size="small" onClick={() => handleCancelCharge(c)} sx={{ color: '#ef4444' }}>
                                    <CancelIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>

              <TablePagination
                rowsPerPageOptions={[10, 15, 25, 50]}
                component="div"
                count={charges.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(e, newPage) => setPage(newPage)}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
              />
            </TableContainer>
          </Box>
        )}

        {/* TAB 1: Payment Receipts & Vouchers */}
        {activeTab === 1 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Disbursed Operational Payments & Worker Receipts
              </Typography>
              <Button
                variant="contained"
                size="small"
                startIcon={<PaymentIcon />}
                onClick={() => handleOpenPayment()}
                sx={{ bgcolor: '#1e3a8a', fontWeight: 700 }}
              >
                + Record New Payment
              </Button>
            </Box>

            <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Payment Receipt No</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Recipient Worker/Driver</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Payment Mode</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Disbursed By</TableCell>
                    <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Amount Paid</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Allocated Charges</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Accounting Voucher</TableCell>
                    <TableCell sx={{ fontWeight: 700, textAlign: 'center' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} sx={{ textAlign: 'center', py: 4, color: '#94a3b8' }}>
                        No payments disbursed yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments.map((p) => (
                      <TableRow key={p.id} hover>
                        <TableCell sx={{ fontWeight: 700, color: '#1e3a8a', fontFamily: 'monospace' }}>
                          {p.payment_no}
                        </TableCell>
                        <TableCell>{p.payment_date}</TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>{p.party_name}</Typography>
                          <Typography variant="caption" sx={{ color: '#64748b' }}>{p.party_category}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={p.payment_method || p.payment_mode || 'CASH'} size="small" sx={{ fontWeight: 700, fontSize: 10 }} />
                        </TableCell>
                        <TableCell>{p.paid_by || p.created_by || 'Admin'}</TableCell>
                        <TableCell sx={{ textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                          ₹{Number(p.paid_amount || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {(p.allocations || []).map((a, idx) => (
                            <Chip
                              key={a.id || idx}
                              label={`${a.charge_no || `Charge #${a.charge_id}`} (₹${Number(a.allocated_amount ?? a.amount ?? 0).toLocaleString()})`}
                              size="small"
                              sx={{ mr: 0.5, mb: 0.5, fontSize: 9 }}
                            />
                          ))}
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                            {p.voucher_no || 'Auto-posted'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ textAlign: 'center' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.5 }}>
                            <Tooltip title="Edit Payment Record">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleEditPayment(p)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Print Official Receipt">
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<PrintIcon />}
                                onClick={() => {
                                  setPrintDocType('PAYMENT_RECEIPT');
                                  setPrintData({
                                    company: { name: selectedCompany?.name || 'BVC Exports Pvt Ltd' },
                                    payment: p
                                  });
                                  setPrintModalOpen(true);
                                }}
                                sx={{ textTransform: 'none', py: 0.2, fontSize: 11 }}
                              >
                                Receipt
                              </Button>
                            </Tooltip>
                            <Tooltip title="Delete Payment Record">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeletePayment(p)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* TAB 2: Workers & Transporters Master */}
        {activeTab === 2 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Operational Parties (Workers, Drivers, Helpers, Transporters)
              </Typography>
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => {
                  setPartyForm({
                    id: null,
                    name: '',
                    party_category: 'LOADMAN',
                    phone: '',
                    address: '',
                    payment_mode: 'CASH',
                    upi_id: '',
                    notes: ''
                  });
                  setPartyModalOpen(true);
                }}
                sx={{ bgcolor: '#1e3a8a', fontWeight: 700 }}
              >
                + Add Operational Party
              </Button>
            </Box>

            <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Full Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Category / Role</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Phone Number</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Preferred Payment Mode</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>UPI / Bank Details</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700, textAlign: 'center' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {parties.map((p) => (
                    <TableRow key={p.id} hover>
                      <TableCell sx={{ fontWeight: 700 }}>{p.name}</TableCell>
                      <TableCell>
                        <Chip label={p.party_category} size="small" sx={{ fontWeight: 700, fontSize: 10 }} />
                      </TableCell>
                      <TableCell>{p.phone || '-'}</TableCell>
                      <TableCell>{p.payment_mode}</TableCell>
                      <TableCell>{p.upi_id || p.address || '-'}</TableCell>
                      <TableCell>
                        <Chip
                          label={p.is_active ? 'Active' : 'Disabled'}
                          size="small"
                          color={p.is_active ? 'success' : 'default'}
                          sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.5 }}>
                          <Tooltip title="Edit Party">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => {
                                setPartyForm(p);
                                setPartyModalOpen(true);
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Print Party Statement">
                            <IconButton
                              size="small"
                              color="info"
                              onClick={() => handlePrintParty(p)}
                            >
                              <PrintIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Party">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteParty(p.id, p.name)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* TAB 3: Configurable Rates Master */}
        {activeTab === 3 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Configurable Operational Rates Card ({rates.filter(r => r.is_active !== 0).length} Active / {rates.length} Total)
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  Manage rates per bag, MT, trip, or fixed charge. Unnecessary rows can be deleted, deactivated, or purged.
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {rates.some(r => r.is_active === 0) && (
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    startIcon={<DeleteSweepIcon />}
                    onClick={handlePurgeInactiveRates}
                    sx={{ fontWeight: 700, textTransform: 'none' }}
                  >
                    Purge Inactive ({rates.filter(r => r.is_active === 0).length})
                  </Button>
                )}
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setRateForm({
                      id: null,
                      charge_type: 'LOADING',
                      party_category: 'ALL',
                      calculation_basis: 'PER_BAG',
                      rate: '2.50',
                      rate_per_unit: '2.50',
                      uom: 'BAG',
                      notes: '',
                      description: '',
                      is_active: 1
                    });
                    setRateModalOpen(true);
                  }}
                  sx={{ bgcolor: '#1e3a8a', fontWeight: 700 }}
                >
                  + Configure New Rate
                </Button>
              </Box>
            </Box>

            {/* Rates Filter & Search Bar */}
            <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: '#f8fafc', borderRadius: 2 }}>
              <Grid container spacing={1.5} alignItems="center">
                <Grid item xs={12} sm={4}>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="Search by Charge Type, Category, Code, Notes..."
                    value={rateSearchQuery}
                    onChange={(e) => setRateSearchQuery(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ color: '#94a3b8' }} />
                        </InputAdornment>
                      )
                    }}
                  />
                </Grid>
                <Grid item xs={6} sm={2.5}>
                  <TextField
                    select
                    size="small"
                    fullWidth
                    label="Filter Charge Type"
                    value={rateFilterType}
                    onChange={(e) => setRateFilterType(e.target.value)}
                  >
                    <MenuItem value="ALL">All Types</MenuItem>
                    <MenuItem value="LOADING">Loading</MenuItem>
                    <MenuItem value="UNLOADING">Unloading</MenuItem>
                    <MenuItem value="GODOWN_TRANSFER">Godown Transfer</MenuItem>
                    <MenuItem value="OUTPASS_MILL">External Mill Outpass</MenuItem>
                    <MenuItem value="INPASS_RECEIPT">Processed Inpass Unloading</MenuItem>
                    <MenuItem value="DRIVER_ALLOWANCE">Driver Allowance / Batta</MenuItem>
                    <MenuItem value="DRIVER">Driver</MenuItem>
                    <MenuItem value="TRANSPORT">Transport</MenuItem>
                    <MenuItem value="LABOUR">Labour</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={6} sm={2.5}>
                  <TextField
                    select
                    size="small"
                    fullWidth
                    label="Status Filter"
                    value={rateFilterStatus}
                    onChange={(e) => setRateFilterStatus(e.target.value)}
                  >
                    <MenuItem value="ALL">All (Active & Disabled)</MenuItem>
                    <MenuItem value="ACTIVE">Active Only</MenuItem>
                    <MenuItem value="INACTIVE">Disabled / Inactive</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={3} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                  {rateSearchQuery || rateFilterType !== 'ALL' || rateFilterStatus !== 'ALL' ? (
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => {
                        setRateSearchQuery('');
                        setRateFilterType('ALL');
                        setRateFilterStatus('ALL');
                      }}
                      sx={{ textTransform: 'none', color: '#64748b' }}
                    >
                      Clear Filters
                    </Button>
                  ) : null}
                  <Typography variant="caption" sx={{ alignSelf: 'center', color: '#64748b', fontWeight: 600 }}>
                    Showing {(rates || []).filter(r => {
                      const ct = r.operation_type || r.charge_type || 'LOADING';
                      const cat = r.charge_category || r.party_category || 'LABOUR';
                      const desc = r.description || r.notes || '';
                      const code = r.rate_code || '';
                      if (rateFilterType !== 'ALL' && ct !== rateFilterType) return false;
                      if (rateFilterStatus === 'ACTIVE' && r.is_active === 0) return false;
                      if (rateFilterStatus === 'INACTIVE' && r.is_active !== 0) return false;
                      if (rateSearchQuery) {
                        const q = rateSearchQuery.toLowerCase();
                        return ct.toLowerCase().includes(q) || cat.toLowerCase().includes(q) || desc.toLowerCase().includes(q) || code.toLowerCase().includes(q);
                      }
                      return true;
                    }).length} of {rates.length} rates
                  </Typography>
                </Grid>
              </Grid>
            </Paper>

            <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Charge Type</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Applicable Category</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Calculation Basis</TableCell>
                    <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Standard Rate (₹)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Unit (UOM)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Notes / Effective</TableCell>
                    <TableCell sx={{ fontWeight: 700, textAlign: 'center' }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700, textAlign: 'center' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rates.filter(r => {
                    const ct = r.operation_type || r.charge_type || 'LOADING';
                    const cat = r.charge_category || r.party_category || 'LABOUR';
                    const desc = r.description || r.notes || '';
                    const code = r.rate_code || '';
                    if (rateFilterType !== 'ALL' && ct !== rateFilterType) return false;
                    if (rateFilterStatus === 'ACTIVE' && r.is_active === 0) return false;
                    if (rateFilterStatus === 'INACTIVE' && r.is_active !== 0) return false;
                    if (rateSearchQuery) {
                      const q = rateSearchQuery.toLowerCase();
                      return ct.toLowerCase().includes(q) || cat.toLowerCase().includes(q) || desc.toLowerCase().includes(q) || code.toLowerCase().includes(q);
                    }
                    return true;
                  }).map((r) => {
                    const chargeType = r.operation_type || r.charge_type || 'LOADING';
                    const category = r.charge_category || r.party_category || 'LABOUR';
                    const basis = r.rate_basis || r.calculation_basis || 'PER_BAG';
                    const rateVal = Number(r.rate_per_unit ?? r.rate ?? 0);
                    const uomVal = r.uom || (basis === 'PER_KG' ? 'KG' : basis === 'PER_TONNE' ? 'MT' : basis === 'PER_BAG' ? 'BAG' : 'TRIP');
                    const descVal = r.description || r.notes || '-';
                    const isActive = r.is_active !== 0;

                    return (
                      <TableRow key={r.id} hover sx={{ opacity: isActive ? 1 : 0.65 }}>
                        <TableCell sx={{ fontWeight: 700, color: '#1e3a8a' }}>
                          {chargeType}
                          {r.rate_code && <Typography variant="caption" display="block" sx={{ color: '#64748b' }}>{r.rate_code}</Typography>}
                        </TableCell>
                        <TableCell>
                          <Chip label={category} size="small" sx={{ fontWeight: 700, fontSize: 10 }} />
                        </TableCell>
                        <TableCell>{basis}</TableCell>
                        <TableCell sx={{ textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                          ₹{rateVal.toFixed(2)}
                        </TableCell>
                        <TableCell>{uomVal}</TableCell>
                        <TableCell>{descVal}</TableCell>
                        <TableCell sx={{ textAlign: 'center' }}>
                          <Chip
                            label={isActive ? 'Active' : 'Disabled'}
                            size="small"
                            color={isActive ? 'success' : 'default'}
                            sx={{ fontWeight: 700, fontSize: 10, height: 22 }}
                          />
                        </TableCell>
                        <TableCell sx={{ textAlign: 'center' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.5 }}>
                            <Tooltip title="Edit Rate Card">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => {
                                  setRateForm({
                                    id: r.id,
                                    rate_code: r.rate_code || '',
                                    charge_type: chargeType,
                                    operation_type: chargeType,
                                    party_category: category,
                                    charge_category: category,
                                    calculation_basis: basis,
                                    rate_basis: basis,
                                    rate: rateVal.toString(),
                                    rate_per_unit: rateVal.toString(),
                                    uom: uomVal,
                                    notes: descVal === '-' ? '' : descVal,
                                    description: descVal === '-' ? '' : descVal,
                                    is_active: isActive ? 1 : 0
                                  });
                                  setRateModalOpen(true);
                                }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Print Rate Card">
                              <IconButton
                                size="small"
                                color="info"
                                onClick={() => handlePrintRate(r)}
                              >
                                <PrintIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={isActive ? "Disable / Mark Unnecessary" : "Enable Rate"}>
                              <IconButton
                                size="small"
                                color={isActive ? "warning" : "success"}
                                onClick={() => handleToggleRateActive(r.id, isActive)}
                              >
                                {isActive ? <ToggleOnIcon fontSize="small" /> : <ToggleOffIcon fontSize="small" />}
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Rate Card Permanently">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteRate(r.id, r.rate_code)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* TAB 4: Cost Analytics & Reports */}
        {activeTab === 4 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
              <Button
                variant={reportType === 'SUMMARY' ? 'contained' : 'outlined'}
                size="small"
                onClick={() => handleLoadReport('SUMMARY')}
              >
                Overall Summary
              </Button>
              <Button
                variant={reportType === 'WORKER_WISE' ? 'contained' : 'outlined'}
                size="small"
                onClick={() => handleLoadReport('WORKER_WISE')}
              >
                Worker-wise Cost
              </Button>
              <Button
                variant={reportType === 'DRIVER_WISE' ? 'contained' : 'outlined'}
                size="small"
                onClick={() => handleLoadReport('DRIVER_WISE')}
              >
                Driver-wise Cost
              </Button>
              <Button
                variant={reportType === 'VEHICLE_WISE' ? 'contained' : 'outlined'}
                size="small"
                onClick={() => handleLoadReport('VEHICLE_WISE')}
              >
                Vehicle-wise Cost
              </Button>
              <Button
                variant={reportType === 'GODOWN_WISE' ? 'contained' : 'outlined'}
                size="small"
                onClick={() => handleLoadReport('GODOWN_WISE')}
              >
                Godown Transfer Cost
              </Button>
            </Box>

            {reportData?.data && (
              <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                    <TableRow>
                      {reportType === 'WORKER_WISE' && (
                        <>
                          <TableCell sx={{ fontWeight: 700 }}>Worker / Party</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                          <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Total Operations</TableCell>
                          <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Total Charges (₹)</TableCell>
                          <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Total Paid (₹)</TableCell>
                          <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Outstanding Balance (₹)</TableCell>
                        </>
                      )}
                      {reportType === 'DRIVER_WISE' && (
                        <>
                          <TableCell sx={{ fontWeight: 700 }}>Driver Name</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Vehicle No</TableCell>
                          <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Total Trips</TableCell>
                          <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Total Charges (₹)</TableCell>
                          <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Paid (₹)</TableCell>
                          <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Pending (₹)</TableCell>
                        </>
                      )}
                      {reportType === 'VEHICLE_WISE' && (
                        <>
                          <TableCell sx={{ fontWeight: 700 }}>Vehicle No</TableCell>
                          <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Trips</TableCell>
                          <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Loading (₹)</TableCell>
                          <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Unloading (₹)</TableCell>
                          <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Driver (₹)</TableCell>
                          <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Transport (₹)</TableCell>
                          <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Total Operational Cost (₹)</TableCell>
                        </>
                      )}
                      {reportType === 'GODOWN_WISE' && (
                        <>
                          <TableCell sx={{ fontWeight: 700 }}>From Godown</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>To Godown</TableCell>
                          <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Transfers</TableCell>
                          <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Loading (₹)</TableCell>
                          <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Unloading (₹)</TableCell>
                          <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Driver & Transport (₹)</TableCell>
                          <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Total Transfer Cost (₹)</TableCell>
                        </>
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reportData.data.map((row, idx) => (
                      <TableRow key={idx} hover>
                        {reportType === 'WORKER_WISE' && (
                          <>
                            <TableCell sx={{ fontWeight: 700 }}>{row.party_name}</TableCell>
                            <TableCell>{row.party_category}</TableCell>
                            <TableCell sx={{ textAlign: 'right' }}>{row.total_operations}</TableCell>
                            <TableCell sx={{ textAlign: 'right', fontWeight: 800 }}>₹{Number(row.total_charges).toLocaleString()}</TableCell>
                            <TableCell sx={{ textAlign: 'right', color: '#16a34a' }}>₹{Number(row.total_paid).toLocaleString()}</TableCell>
                            <TableCell sx={{ textAlign: 'right', color: '#dc2626', fontWeight: 700 }}>₹{Number(row.total_balance).toLocaleString()}</TableCell>
                          </>
                        )}
                        {reportType === 'DRIVER_WISE' && (
                          <>
                            <TableCell sx={{ fontWeight: 700 }}>{row.driver_name}</TableCell>
                            <TableCell sx={{ fontFamily: 'monospace' }}>{row.vehicle_no || '-'}</TableCell>
                            <TableCell sx={{ textAlign: 'right' }}>{row.total_trips}</TableCell>
                            <TableCell sx={{ textAlign: 'right', fontWeight: 800 }}>₹{Number(row.total_charges).toLocaleString()}</TableCell>
                            <TableCell sx={{ textAlign: 'right', color: '#16a34a' }}>₹{Number(row.total_paid).toLocaleString()}</TableCell>
                            <TableCell sx={{ textAlign: 'right', color: '#dc2626', fontWeight: 700 }}>₹{Number(row.total_balance).toLocaleString()}</TableCell>
                          </>
                        )}
                        {reportType === 'VEHICLE_WISE' && (
                          <>
                            <TableCell sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{row.vehicle_no}</TableCell>
                            <TableCell sx={{ textAlign: 'right' }}>{row.total_trips}</TableCell>
                            <TableCell sx={{ textAlign: 'right' }}>₹{Number(row.loading_cost).toLocaleString()}</TableCell>
                            <TableCell sx={{ textAlign: 'right' }}>₹{Number(row.unloading_cost).toLocaleString()}</TableCell>
                            <TableCell sx={{ textAlign: 'right' }}>₹{Number(row.driver_cost).toLocaleString()}</TableCell>
                            <TableCell sx={{ textAlign: 'right' }}>₹{Number(row.transport_cost).toLocaleString()}</TableCell>
                            <TableCell sx={{ textAlign: 'right', fontWeight: 800, color: '#1e3a8a' }}>₹{Number(row.total_operational_cost).toLocaleString()}</TableCell>
                          </>
                        )}
                        {reportType === 'GODOWN_WISE' && (
                          <>
                            <TableCell sx={{ fontWeight: 700 }}>{row.from_location}</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>{row.to_location}</TableCell>
                            <TableCell sx={{ textAlign: 'right' }}>{row.total_transfers}</TableCell>
                            <TableCell sx={{ textAlign: 'right' }}>₹{Number(row.loading_cost).toLocaleString()}</TableCell>
                            <TableCell sx={{ textAlign: 'right' }}>₹{Number(row.unloading_cost).toLocaleString()}</TableCell>
                            <TableCell sx={{ textAlign: 'right' }}>₹{Number(Number(row.transport_cost || 0) + Number(row.driver_cost || 0)).toLocaleString()}</TableCell>
                            <TableCell sx={{ textAlign: 'right', fontWeight: 800, color: '#1e3a8a' }}>₹{Number(row.total_transfer_cost).toLocaleString()}</TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}
      </Paper>

      {/* DIALOG 1: Record Operational Charge */}
      <Dialog open={chargeModalOpen} onClose={() => setChargeModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#1e3a8a' }}>
          Record Factory Operational Charge & Physical Movement
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Charge No"
                fullWidth
                size="small"
                disabled
                value={chargeForm.charge_no}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                select
                label="Source Module"
                fullWidth
                size="small"
                value={chargeForm.source_module}
                onChange={(e) => setChargeForm({ ...chargeForm, source_module: e.target.value })}
              >
                <MenuItem value="GODOWN_TRANSFER">Godown Transfer</MenuItem>
                <MenuItem value="OUTPASS">Outpass (Material Leaving Factory)</MenuItem>
                <MenuItem value="INPASS">Inpass (Material Arrived Back)</MenuItem>
                <MenuItem value="PURCHASE">Purchase Arrival</MenuItem>
                <MenuItem value="SALES">Sales Dispatch</MenuItem>
                <MenuItem value="GRIND">Outside Grind</MenuItem>
                <MenuItem value="OTHER">Other Movement</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Source Transaction No"
                fullWidth
                size="small"
                placeholder="e.g. TRF-1, OP-00021, PUR-00025"
                value={chargeForm.source_transaction_no}
                onChange={(e) => setChargeForm({ ...chargeForm, source_transaction_no: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                select
                label="Charge Type"
                fullWidth
                size="small"
                value={chargeForm.charge_type}
                onChange={(e) => {
                  const val = e.target.value;
                  setChargeForm({ ...chargeForm, charge_type: val });
                  handleAutoCalculateCharge(val, chargeForm.calculation_basis, chargeForm.quantity);
                }}
              >
                <MenuItem value="LOADING">Loading Operation</MenuItem>
                <MenuItem value="UNLOADING">Unloading Operation</MenuItem>
                <MenuItem value="DRIVER">Driver Trip Payment</MenuItem>
                <MenuItem value="TRANSPORT">Transport Charge</MenuItem>
                <MenuItem value="HELPER">Vehicle Helper</MenuItem>
                <MenuItem value="PROCESSING">Outside Mill Processing Charge</MenuItem>
                <MenuItem value="WEIGHING">Weighbridge Charge</MenuItem>
                <MenuItem value="LABOUR">General Labour</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                select
                label="Responsible Party / Leader"
                fullWidth
                size="small"
                value={chargeForm.party_id}
                onChange={(e) => {
                  const pId = e.target.value;
                  const found = parties.find(p => p.id === pId);
                  setChargeForm({
                    ...chargeForm,
                    party_id: pId,
                    party_name: found ? found.name : '',
                    party_category: found ? found.party_category : 'LOADMAN'
                  });
                }}
              >
                {parties.map(p => (
                  <MenuItem key={p.id} value={p.id}>{p.name} ({p.party_category})</MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                label="Vehicle No"
                fullWidth
                size="small"
                placeholder="e.g. TN-58-AB-1234"
                value={chargeForm.vehicle_no}
                onChange={(e) => setChargeForm({ ...chargeForm, vehicle_no: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={3}>
              <TextField
                label="Quantity"
                fullWidth
                size="small"
                value={chargeForm.quantity}
                onChange={(e) => {
                  const q = e.target.value;
                  setChargeForm({ ...chargeForm, quantity: q });
                  handleAutoCalculateCharge(chargeForm.charge_type, chargeForm.calculation_basis, q);
                }}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                select
                label="Calculation Basis"
                fullWidth
                size="small"
                value={chargeForm.calculation_basis}
                onChange={(e) => {
                  const b = e.target.value;
                  setChargeForm({ ...chargeForm, calculation_basis: b });
                  handleAutoCalculateCharge(chargeForm.charge_type, b, chargeForm.quantity);
                }}
              >
                <MenuItem value="PER_KG">Per KG (₹/KG)</MenuItem>
                <MenuItem value="PER_TRIP">Per Trip (₹/Trip)</MenuItem>
                <MenuItem value="PER_LOAD">Per Load</MenuItem>
                <MenuItem value="PER_DAY">Per Day</MenuItem>
                <MenuItem value="FIXED">Fixed Amount</MenuItem>
                <MenuItem value="MANUAL">Manual Total</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                label="Rate (₹)"
                fullWidth
                size="small"
                value={chargeForm.rate}
                onChange={(e) => setChargeForm({ ...chargeForm, rate: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                label="Total Charge (₹)"
                fullWidth
                size="small"
                value={chargeForm.amount}
                onChange={(e) => setChargeForm({ ...chargeForm, amount: e.target.value })}
                sx={{ input: { fontWeight: 800, color: '#1e3a8a' } }}
              />
            </Grid>

            {/* Workers Multi-Split for Loading/Unloading */}
            {(chargeForm.charge_type === 'LOADING' || chargeForm.charge_type === 'UNLOADING') && (
              <Grid item xs={12}>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e3a8a' }}>
                      Worker Split Breakdown (Multiple Loadmen / Unloadmen)
                    </Typography>
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => setChargeForm({
                        ...chargeForm,
                        workers: [...chargeForm.workers, { party_name: 'Helper', party_category: 'LOADMAN', worker_role: 'Helper', amount: '500' }]
                      })}
                    >
                      Add Worker
                    </Button>
                  </Box>

                  {chargeForm.workers.map((w, idx) => (
                    <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                      <TextField
                        size="small"
                        placeholder="Worker Name"
                        value={w.party_name}
                        onChange={(e) => {
                          const updated = [...chargeForm.workers];
                          updated[idx].party_name = e.target.value;
                          setChargeForm({ ...chargeForm, workers: updated });
                        }}
                        sx={{ flex: 2 }}
                      />
                      <TextField
                        size="small"
                        placeholder="Role (e.g. Lead, Loader)"
                        value={w.worker_role}
                        onChange={(e) => {
                          const updated = [...chargeForm.workers];
                          updated[idx].worker_role = e.target.value;
                          setChargeForm({ ...chargeForm, workers: updated });
                        }}
                        sx={{ flex: 1.5 }}
                      />
                      <TextField
                        size="small"
                        placeholder="Amount (₹)"
                        value={w.amount}
                        onChange={(e) => {
                          const updated = [...chargeForm.workers];
                          updated[idx].amount = e.target.value;
                          const total = updated.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
                          setChargeForm({ ...chargeForm, workers: updated, amount: total.toString() });
                        }}
                        sx={{ flex: 1 }}
                      />
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          const updated = chargeForm.workers.filter((_, i) => i !== idx);
                          const total = updated.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
                          setChargeForm({ ...chargeForm, workers: updated, amount: total.toString() });
                        }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                </Paper>
              </Grid>
            )}

            <Grid item xs={12} sm={6}>
              <TextField
                label="From Location / Godown"
                fullWidth
                size="small"
                value={chargeForm.from_location}
                onChange={(e) => setChargeForm({ ...chargeForm, from_location: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="To Location / Destination"
                fullWidth
                size="small"
                value={chargeForm.to_location}
                onChange={(e) => setChargeForm({ ...chargeForm, to_location: e.target.value })}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Remarks / Notes"
                fullWidth
                size="small"
                value={chargeForm.remarks}
                onChange={(e) => setChargeForm({ ...chargeForm, remarks: e.target.value })}
                placeholder="e.g. 100 bags unloaded at Main Godown bay 2"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setChargeModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveCharge}
            sx={{ bgcolor: '#1e3a8a', fontWeight: 700 }}
          >
            Save Operational Charge
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG 2: Record Payment Modal */}
      <Dialog open={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#1e3a8a' }}>
          Issue Worker / Driver Payment & Post Accounting Voucher
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                select
                label="Recipient Worker / Driver / Transporter Master *"
                fullWidth
                size="small"
                value={paymentForm.party_id || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'CUSTOM') {
                    setPaymentForm({
                      ...paymentForm,
                      party_id: '',
                      party_name: '',
                      received_by: ''
                    });
                  } else {
                    const found = parties.find(p => p.id === Number(val) || p.id === val);
                    setPaymentForm({
                      ...paymentForm,
                      party_id: val,
                      party_name: found ? found.name : '',
                      party_category: found ? (found.category || found.party_category || 'LOADMAN') : paymentForm.party_category,
                      received_by: found ? found.name : ''
                    });
                  }
                }}
                helperText={parties.length === 0 ? "No registered master parties found. Add parties in 'Workers & Transporters Master' tab." : "Select recipient from Worker/Driver/Transporter Master list"}
              >
                <MenuItem value=""><em>-- Select Worker & Transporter Master --</em></MenuItem>
                {parties.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name} ({p.party_code || `OPP-${p.id}`}) — {p.category || p.party_category || 'WORKER'}
                  </MenuItem>
                ))}
                <MenuItem value="CUSTOM"><em>+ Enter Custom Recipient Name Manually</em></MenuItem>
              </TextField>
            </Grid>

            {(!paymentForm.party_id || paymentForm.party_id === '') && (
              <Grid item xs={12}>
                <TextField
                  label="Recipient Custom / Unregistered Worker Name"
                  fullWidth
                  size="small"
                  value={paymentForm.party_name}
                  onChange={(e) => setPaymentForm({
                    ...paymentForm,
                    party_name: e.target.value,
                    received_by: e.target.value
                  })}
                  placeholder="e.g. Ramesh Loadman, Murugan Driver"
                  helperText="Enter name if recipient is not listed in Master dropdown"
                />
              </Grid>
            )}

            <Grid item xs={12} sm={6}>
              <TextField
                label="Amount to Disburse (₹)"
                fullWidth
                size="small"
                value={paymentForm.paid_amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, paid_amount: e.target.value })}
                sx={{ input: { fontWeight: 800, color: '#16a34a' } }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Payment Method"
                fullWidth
                size="small"
                value={paymentForm.payment_method}
                onChange={(e) => setPaymentForm({
                  ...paymentForm,
                  payment_method: e.target.value,
                  cash_bank_ledger: e.target.value === 'CASH' ? 'Cash in Hand' : 'Bank Account'
                })}
              >
                <MenuItem value="CASH">Cash in Hand</MenuItem>
                <MenuItem value="BANK">Bank Transfer / NEFT</MenuItem>
                <MenuItem value="UPI">UPI / GPay / PhonePe</MenuItem>
                <MenuItem value="RTGS">RTGS</MenuItem>
                <MenuItem value="OTHER">Other</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Cash / Bank Account Ledger"
                fullWidth
                size="small"
                value={paymentForm.cash_bank_ledger}
                onChange={(e) => setPaymentForm({ ...paymentForm, cash_bank_ledger: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Reference No / Trx ID / Cheque"
                fullWidth
                size="small"
                value={paymentForm.reference_no}
                onChange={(e) => setPaymentForm({ ...paymentForm, reference_no: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Disbursed By (Cashier/Admin)"
                fullWidth
                size="small"
                value={paymentForm.paid_by}
                onChange={(e) => setPaymentForm({ ...paymentForm, paid_by: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Received By (Worker Signature Name)"
                fullWidth
                size="small"
                value={paymentForm.received_by}
                onChange={(e) => setPaymentForm({ ...paymentForm, received_by: e.target.value })}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Payment Narration / Remarks"
                fullWidth
                size="small"
                value={paymentForm.remarks}
                onChange={(e) => setPaymentForm({ ...paymentForm, remarks: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setPaymentModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSavePayment}
            sx={{ bgcolor: '#10b981', fontWeight: 700 }}
          >
            Confirm & Issue Payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG 3: Traceability Modal */}
      <Dialog open={traceModalOpen} onClose={() => setTraceModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: 1 }}>
          <TimelineIcon /> End-to-End Transaction Traceability & Audit Lineage
        </DialogTitle>
        <DialogContent dividers>
          {traceData ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Step 1: Business Transaction */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderLeft: '5px solid #2563eb' }}>
                <Typography variant="caption" sx={{ color: '#2563eb', fontWeight: 700, textTransform: 'uppercase' }}>
                  1. Originating ERP Transaction
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  {traceData.sourceModule} — {traceData.sourceTransactionNo || traceData.sourceTransactionId}
                </Typography>
                {traceData.sourceDetails && (
                  <Typography variant="body2" sx={{ color: '#475569', mt: 0.5 }}>
                    Item: {traceData.sourceDetails.item_name || traceData.sourceDetails.items?.[0]?.item_name || 'Goods'} |
                    Godown: {traceData.sourceDetails.godown || traceData.sourceDetails.to_godown_name || traceData.sourceDetails.from_godown_name || 'Factory'} |
                    Date: {traceData.sourceDetails.date || traceData.sourceDetails.transfer_date}
                  </Typography>
                )}
              </Paper>

              {/* Step 2: Operational Charges */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderLeft: '5px solid #10b981' }}>
                <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>
                  2. Physical Operation & Operational Charges
                </Typography>
                {traceData.charges.map(ch => (
                  <Box key={ch.id} sx={{ mt: 1, p: 1.5, bgcolor: '#f8fafc', borderRadius: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        {ch.charge_no} — {ch.charge_type} (₹{ch.total_amount})
                      </Typography>
                      <Chip label={ch.status} size="small" sx={{ fontWeight: 700, height: 20 }} />
                    </Box>
                    <Typography variant="body2" sx={{ color: '#475569' }}>
                      Party: {ch.party_name} ({ch.party_category}) | Vehicle: {ch.vehicle_no || 'N/A'} | Rate: ₹{ch.rate}/{ch.calculation_basis}
                    </Typography>
                  </Box>
                ))}
              </Paper>

              {/* Step 3: Payments Disbursed */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderLeft: '5px solid #f59e0b' }}>
                <Typography variant="caption" sx={{ color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase' }}>
                  3. Worker & Driver Payment Disbursed
                </Typography>
                {traceData.payments.length === 0 ? (
                  <Typography variant="body2" sx={{ color: '#94a3b8', mt: 0.5 }}>
                    No payment disbursed yet. Charge is pending payment.
                  </Typography>
                ) : (
                  traceData.payments.map(py => (
                    <Box key={py.id} sx={{ mt: 1, p: 1.5, bgcolor: '#fffbeb', borderRadius: 1.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        Receipt: {py.payment_no} — Paid ₹{py.paid_amount} via {py.payment_method}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#475569' }}>
                        Disbursed to: {py.party_name} | By: {py.paid_by} | Date: {py.payment_date}
                      </Typography>
                    </Box>
                  ))
                )}
              </Paper>

              {/* Step 4: Accounting & Ledger Vouchers */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderLeft: '5px solid #8b5cf6' }}>
                <Typography variant="caption" sx={{ color: '#8b5cf6', fontWeight: 700, textTransform: 'uppercase' }}>
                  4. General Ledger Accounting Vouchers
                </Typography>
                {traceData.vouchers.length === 0 ? (
                  <Typography variant="body2" sx={{ color: '#94a3b8', mt: 0.5 }}>
                    Voucher accrual generated on charge approval.
                  </Typography>
                ) : (
                  traceData.vouchers.map(v => (
                    <Box key={v.id} sx={{ mt: 1, p: 1.5, bgcolor: '#f5f3ff', borderRadius: 1.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        Voucher: {v.voucher_no} ({v.voucher_type}) — Date: {v.date}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#475569' }}>
                        Narration: {v.narration}
                      </Typography>
                    </Box>
                  ))
                )}
              </Paper>
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress size={32} />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTraceModalOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG 4: Printable Slip / Receipt Dialog */}
      <Dialog open={printModalOpen} onClose={() => setPrintModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#1e3a8a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Print {printDocType.replace('_', ' ')}</span>
          <Button startIcon={<PrintIcon />} variant="contained" size="small" onClick={triggerNativePrint}>
            Print Document
          </Button>
        </DialogTitle>
        <DialogContent dividers>
          {printData && (
            <Box id="printable-slip" sx={{ p: 3, bgcolor: '#ffffff', color: '#000000', border: '1px solid #cbd5e1', borderRadius: 2 }}>
              {/* Header */}
              <Box sx={{ textAlign: 'center', borderBottom: '2px solid #000', pb: 2, mb: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  {printData.company?.name || 'BVC EXPORTS PVT. LTD.'}
                </Typography>
                <Typography variant="caption" sx={{ display: 'block' }}>
                  Factory & Processing Mills • Operational Management
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mt: 1, letterSpacing: '1px', textTransform: 'uppercase' }}>
                  {printDocType === 'CHARGE_VOUCHER' && 'OPERATIONAL CHARGE VOUCHER'}
                  {printDocType === 'PAYMENT_RECEIPT' && 'WORKER / DRIVER PAYMENT RECEIPT'}
                  {printDocType === 'LOADING_SLIP' && 'VEHICLE LOADING & LABOUR SLIP'}
                </Typography>
              </Box>

              {/* Charge Voucher Details */}
              {printDocType === 'CHARGE_VOUCHER' && printData.charge && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>Voucher No: {printData.charge.charge_no}</strong>
                    <span>Date: {printData.charge.charge_date}</span>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Source: {printData.charge.source_module} ({printData.charge.source_transaction_no})</span>
                    <span>Operation: {printData.charge.charge_type}</span>
                  </Box>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Party/Worker: <strong>{printData.charge.party_name}</strong></span>
                    <span>Category: {printData.charge.party_category}</span>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Vehicle No: <strong>{printData.charge.vehicle_no || 'N/A'}</strong></span>
                    <span>Driver: {printData.charge.driver_name || '-'}</span>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Quantity: {printData.charge.quantity} {printData.charge.uom}</span>
                    <span>Rate: ₹{printData.charge.rate}/{printData.charge.calculation_basis}</span>
                  </Box>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 16 }}>
                    <strong>Total Amount:</strong>
                    <strong style={{ fontSize: 18 }}>₹{Number(printData.charge.total_amount).toLocaleString()}</strong>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Status: {printData.charge.status}</span>
                    <span>Paid: ₹{printData.charge.paid_amount} | Balance: ₹{printData.charge.balance_amount}</span>
                  </Box>
                </Box>
              )}

              {/* Payment Receipt Details */}
              {printDocType === 'PAYMENT_RECEIPT' && printData.payment && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>Receipt No: {printData.payment.payment_no}</strong>
                    <span>Date: {printData.payment.payment_date}</span>
                  </Box>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Paid To: <strong>{printData.payment.party_name}</strong></span>
                    <span>Role: {printData.payment.party_category}</span>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Payment Mode: {printData.payment.payment_method}</span>
                    <span>Ref No: {printData.payment.reference_no || '-'}</span>
                  </Box>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 16 }}>
                    <strong>Amount Received:</strong>
                    <strong style={{ fontSize: 20, color: '#16a34a' }}>₹{Number(printData.payment.paid_amount).toLocaleString()}</strong>
                  </Box>
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" sx={{ color: '#475569' }}>
                      Remarks: {printData.payment.remarks || 'Operational payment acknowledged'}
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* Party Statement Details */}
              {printDocType === 'PARTY_STATEMENT' && printData.party && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>Party Code: {printData.party.party_code}</strong>
                    <span>Category: {printData.party.category || printData.party.party_category}</span>
                  </Box>
                  <Divider sx={{ my: 0.5 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Name: <strong>{printData.party.name}</strong></span>
                    <span>Phone: {printData.party.phone || '-'}</span>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Payment Mode: {printData.party.payment_mode}</span>
                    <span>UPI / Bank: {printData.party.upi_id || printData.party.account_no || '-'}</span>
                  </Box>
                  <Divider sx={{ my: 0.5 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 16 }}>
                    <strong>Outstanding Dues Balance:</strong>
                    <strong style={{ fontSize: 18, color: '#dc2626' }}>₹{Number(printData.party.outstanding_balance || 0).toLocaleString()}</strong>
                  </Box>
                </Box>
              )}

              {/* Rate Card Details */}
              {printDocType === 'RATE_CARD' && printData.rate && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>Rate Code: {printData.rate.rate_code || 'N/A'}</strong>
                    <span>Status: {printData.rate.is_active !== 0 ? 'Active' : 'Disabled'}</span>
                  </Box>
                  <Divider sx={{ my: 0.5 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Charge Type: <strong>{printData.rate.operation_type || printData.rate.charge_type}</strong></span>
                    <span>Category: {printData.rate.charge_category || printData.rate.party_category}</span>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Calculation Basis: {printData.rate.rate_basis || printData.rate.calculation_basis}</span>
                    <span>UOM: {printData.rate.uom}</span>
                  </Box>
                  <Divider sx={{ my: 0.5 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 16 }}>
                    <strong>Standard Rate:</strong>
                    <strong style={{ fontSize: 20, color: '#16a34a' }}>₹{Number(printData.rate.rate_per_unit || printData.rate.rate || 0).toFixed(2)} / {printData.rate.uom}</strong>
                  </Box>
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" sx={{ color: '#475569' }}>
                      Description / Notes: {printData.rate.description || printData.rate.notes || 'No description provided'}
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* Signatures */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 6, pt: 2, borderTop: '1px dashed #94a3b8' }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ display: 'block', mb: 4 }}>Prepared / Paid By</Typography>
                  <strong>{user?.username || 'Admin'}</strong>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ display: 'block', mb: 4 }}>Receiver's Signature</Typography>
                  <strong>{printData.charge?.party_name || printData.payment?.party_name || 'Worker'}</strong>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ display: 'block', mb: 4 }}>Factory Manager Verification</Typography>
                  <strong>Authorized Signatory</strong>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPrintModalOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG 5: Add/Edit Party Modal */}
      <Dialog open={partyModalOpen} onClose={() => setPartyModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          {partyForm.id ? 'Edit Operational Party' : 'Add Operational Party'}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Full Name"
              size="small"
              fullWidth
              value={partyForm.name}
              onChange={(e) => setPartyForm({ ...partyForm, name: e.target.value })}
            />
            <TextField
              select
              label="Category"
              size="small"
              fullWidth
              value={partyForm.party_category}
              onChange={(e) => setPartyForm({ ...partyForm, party_category: e.target.value })}
            >
              <MenuItem value="LOADMAN">Loadman</MenuItem>
              <MenuItem value="UNLOAD_WORKER">Unload Worker</MenuItem>
              <MenuItem value="DRIVER">Driver</MenuItem>
              <MenuItem value="HELPER">Vehicle Helper</MenuItem>
              <MenuItem value="LABOUR">General Labour</MenuItem>
              <MenuItem value="TRANSPORTER">Transporter</MenuItem>
              <MenuItem value="EXTERNAL_MILL">External Mill</MenuItem>
              <MenuItem value="JOB_WORKER">Job Worker</MenuItem>
              <MenuItem value="OTHER">Other</MenuItem>
            </TextField>
            <TextField
              label="Phone Number"
              size="small"
              fullWidth
              value={partyForm.phone}
              onChange={(e) => setPartyForm({ ...partyForm, phone: e.target.value })}
            />
            <TextField
              select
              label="Payment Mode"
              size="small"
              fullWidth
              value={partyForm.payment_mode}
              onChange={(e) => setPartyForm({ ...partyForm, payment_mode: e.target.value })}
            >
              <MenuItem value="CASH">Cash</MenuItem>
              <MenuItem value="UPI">UPI</MenuItem>
              <MenuItem value="BANK">Bank Transfer</MenuItem>
            </TextField>
            <TextField
              label="UPI ID / Account Info"
              size="small"
              fullWidth
              value={partyForm.upi_id}
              onChange={(e) => setPartyForm({ ...partyForm, upi_id: e.target.value })}
            />
            <TextField
              label="Notes / Vehicle Details"
              size="small"
              fullWidth
              value={partyForm.notes}
              onChange={(e) => setPartyForm({ ...partyForm, notes: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPartyModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={async () => {
              if (partyForm.id) {
                await axios.put(`/api/operational-charges/parties/${partyForm.id}`, partyForm, apiHeaders);
              } else {
                await axios.post('/api/operational-charges/parties', partyForm, apiHeaders);
              }
              setPartyModalOpen(false);
              loadData();
            }}
          >
            Save Party
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG 6: Add/Edit Rate Modal */}
      <Dialog open={rateModalOpen} onClose={() => setRateModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#1e3a8a' }}>
          {rateForm.id ? `Edit Rate Card (${rateForm.rate_code || '#' + rateForm.id})` : 'Configure Operational Rate'}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              select
              label="Charge Type"
              size="small"
              fullWidth
              value={rateForm.charge_type || rateForm.operation_type || 'LOADING'}
              onChange={(e) => setRateForm({
                ...rateForm,
                charge_type: e.target.value,
                operation_type: e.target.value
              })}
            >
              {rateForm.charge_type && !['LOADING', 'UNLOADING', 'GODOWN_TRANSFER', 'OUTPASS_MILL', 'INPASS_RECEIPT', 'DRIVER_ALLOWANCE', 'DRIVER', 'TRANSPORT', 'HELPER', 'PROCESSING', 'WEIGHING', 'LABOUR'].includes(rateForm.charge_type) && (
                <MenuItem value={rateForm.charge_type}>{rateForm.charge_type}</MenuItem>
              )}
              <MenuItem value="LOADING">Loading</MenuItem>
              <MenuItem value="UNLOADING">Unloading</MenuItem>
              <MenuItem value="GODOWN_TRANSFER">Godown Transfer</MenuItem>
              <MenuItem value="OUTPASS_MILL">External Mill Outpass</MenuItem>
              <MenuItem value="INPASS_RECEIPT">Processed Inpass Unloading</MenuItem>
              <MenuItem value="DRIVER_ALLOWANCE">Driver Allowance / Batta</MenuItem>
              <MenuItem value="DRIVER">Driver</MenuItem>
              <MenuItem value="TRANSPORT">Transport</MenuItem>
              <MenuItem value="HELPER">Helper</MenuItem>
              <MenuItem value="PROCESSING">Mill Processing</MenuItem>
              <MenuItem value="WEIGHING">Weighing</MenuItem>
              <MenuItem value="LABOUR">General Labour</MenuItem>
            </TextField>

            <TextField
              select
              label="Category"
              size="small"
              fullWidth
              value={rateForm.party_category || rateForm.charge_category || 'LABOUR'}
              onChange={(e) => setRateForm({
                ...rateForm,
                party_category: e.target.value,
                charge_category: e.target.value
              })}
            >
              {rateForm.charge_category && !['ALL', 'LABOUR', 'LOADMAN', 'UNLOAD_WORKER', 'DRIVER', 'DRIVER_BATTA', 'TRANSPORT', 'TRANSPORTER', 'HELPER', 'EXTERNAL_MILL'].includes(rateForm.charge_category) && (
                <MenuItem value={rateForm.charge_category}>{rateForm.charge_category}</MenuItem>
              )}
              <MenuItem value="ALL">All Workers</MenuItem>
              <MenuItem value="LABOUR">Labour</MenuItem>
              <MenuItem value="LOADMAN">Loadman</MenuItem>
              <MenuItem value="UNLOAD_WORKER">Unload Worker</MenuItem>
              <MenuItem value="DRIVER">Driver</MenuItem>
              <MenuItem value="DRIVER_BATTA">Driver Batta</MenuItem>
              <MenuItem value="TRANSPORT">Transport</MenuItem>
              <MenuItem value="TRANSPORTER">Transporter</MenuItem>
              <MenuItem value="HELPER">Helper</MenuItem>
              <MenuItem value="EXTERNAL_MILL">External Mill</MenuItem>
            </TextField>

            <TextField
              select
              label="Calculation Basis"
              size="small"
              fullWidth
              value={rateForm.calculation_basis || rateForm.rate_basis || 'PER_BAG'}
              onChange={(e) => setRateForm({
                ...rateForm,
                calculation_basis: e.target.value,
                rate_basis: e.target.value,
                uom: e.target.value === 'PER_KG' ? 'KG' : e.target.value === 'PER_TONNE' ? 'MT' : e.target.value === 'PER_BAG' ? 'BAG' : (rateForm.uom || 'TRIP')
              })}
            >
              {rateForm.rate_basis && !['PER_BAG', 'PER_KG', 'PER_TONNE', 'PER_TRIP', 'PER_LOAD', 'PER_DAY', 'FIXED'].includes(rateForm.rate_basis) && (
                <MenuItem value={rateForm.rate_basis}>{rateForm.rate_basis}</MenuItem>
              )}
              <MenuItem value="PER_BAG">Per Bag</MenuItem>
              <MenuItem value="PER_KG">Per KG</MenuItem>
              <MenuItem value="PER_TONNE">Per MT / Tonne</MenuItem>
              <MenuItem value="PER_TRIP">Per Trip</MenuItem>
              <MenuItem value="PER_LOAD">Per Load</MenuItem>
              <MenuItem value="PER_DAY">Per Day</MenuItem>
              <MenuItem value="FIXED">Fixed</MenuItem>
            </TextField>

            <TextField
              label="Standard Rate (₹)"
              size="small"
              fullWidth
              type="number"
              inputProps={{ step: '0.01' }}
              value={rateForm.rate !== undefined ? rateForm.rate : (rateForm.rate_per_unit || '')}
              onChange={(e) => setRateForm({
                ...rateForm,
                rate: e.target.value,
                rate_per_unit: e.target.value
              })}
            />

            <TextField
              label="Unit of Measurement (UOM)"
              size="small"
              fullWidth
              value={rateForm.uom || ''}
              onChange={(e) => setRateForm({ ...rateForm, uom: e.target.value })}
              placeholder="BAG, KG, MT, TRIP..."
            />

            <TextField
              label="Description / Notes"
              size="small"
              fullWidth
              multiline
              rows={2}
              value={rateForm.notes !== undefined ? rateForm.notes : (rateForm.description || '')}
              onChange={(e) => setRateForm({
                ...rateForm,
                notes: e.target.value,
                description: e.target.value
              })}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={rateForm.is_active !== 0}
                  onChange={(e) => setRateForm({ ...rateForm, is_active: e.target.checked ? 1 : 0 })}
                  color="success"
                />
              }
              label={rateForm.is_active !== 0 ? "Rate Active (In Use)" : "Rate Disabled / Inactive"}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRateModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={async () => {
              try {
                setLoading(true);
                const valRate = Number(rateForm.rate !== undefined && rateForm.rate !== '' ? rateForm.rate : (rateForm.rate_per_unit ?? 0));
                const ratePayload = {
                  ...rateForm,
                  operation_type: rateForm.charge_type || rateForm.operation_type || 'LOADING',
                  charge_category: rateForm.party_category || rateForm.charge_category || 'LABOUR',
                  rate_basis: rateForm.calculation_basis || rateForm.rate_basis || 'PER_BAG',
                  rate_per_unit: isNaN(valRate) ? 0 : valRate,
                  uom: rateForm.uom || (rateForm.calculation_basis === 'PER_KG' ? 'KG' : rateForm.calculation_basis === 'PER_TONNE' ? 'MT' : rateForm.calculation_basis === 'PER_BAG' ? 'BAG' : 'TRIP'),
                  description: rateForm.notes !== undefined ? rateForm.notes : (rateForm.description || ''),
                  is_active: rateForm.is_active !== undefined ? rateForm.is_active : 1
                };

                let resp;
                if (rateForm.id) {
                  resp = await axios.put(`/api/operational-charges/rates/${rateForm.id}`, ratePayload, apiHeaders);
                } else {
                  resp = await axios.post('/api/operational-charges/rates', ratePayload, apiHeaders);
                }
                const updatedItem = resp?.data?.data || ratePayload;
                const targetId = String(rateForm.id || updatedItem?.id);
                setRates(prev => {
                  const exists = prev.some(r => String(r.id) === targetId);
                  const formatted = {
                    ...updatedItem,
                    id: rateForm.id || updatedItem?.id,
                    rate_code: rateForm.rate_code || updatedItem?.rate_code || '',
                    operation_type: ratePayload.operation_type,
                    charge_type: ratePayload.operation_type,
                    charge_category: ratePayload.charge_category,
                    party_category: ratePayload.charge_category,
                    rate_basis: ratePayload.rate_basis,
                    calculation_basis: ratePayload.rate_basis,
                    rate_per_unit: ratePayload.rate_per_unit,
                    rate: ratePayload.rate_per_unit,
                    uom: ratePayload.uom,
                    description: ratePayload.description,
                    notes: ratePayload.description,
                    is_active: ratePayload.is_active
                  };
                  if (exists) {
                    return prev.map(r => String(r.id) === targetId ? { ...r, ...formatted } : r);
                  }
                  return [formatted, ...prev];
                });
                setRateModalOpen(false);
                notify(rateForm.id ? 'Rate card updated successfully! Changes saved.' : 'New rate card created successfully!', 'success');
                await loadData();
              } catch (err) {
                console.error('Error saving rate:', err);
                notify('Error saving rate: ' + (err.response?.data?.error || err.message), 'error');
              } finally {
                setLoading(false);
              }
            }}
            sx={{ bgcolor: '#1e3a8a', fontWeight: 700 }}
          >
            {rateForm.id ? 'Save Changes' : 'Create Rate'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* In-App Toast Notification */}
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
          sx={{ width: '100%', fontWeight: 700 }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
