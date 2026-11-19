import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Tabs,
  Tab,
  Button,
  IconButton,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  Alert,
  Snackbar,
  Tooltip,
  CircularProgress,
  Divider
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import SmsIcon from '@mui/icons-material/Sms';
import EmailIcon from '@mui/icons-material/Email';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import SendIcon from '@mui/icons-material/Send';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import MoveToInboxIcon from '@mui/icons-material/MoveToInbox';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AssignmentReturnIcon from '@mui/icons-material/AssignmentReturn';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import SettingsIcon from '@mui/icons-material/Settings';
import DescriptionIcon from '@mui/icons-material/Description';
import ReplayIcon from '@mui/icons-material/Replay';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import PhonelinkLockIcon from '@mui/icons-material/PhonelinkLock';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import axios from 'axios';

const MODULE_OPTIONS = [
  { value: 'ALL', label: 'All ERP Modules' },
  { value: 'PURCHASE', label: 'Purchase' },
  { value: 'PURCHASE_RETURN', label: 'Purchase Return' },
  { value: 'SALES', label: 'Sales' },
  { value: 'SALES_RETURN', label: 'Sales Return' },
  { value: 'GODOWN_TRANSFER', label: 'Godown / Item Transfer' },
  { value: 'PRODUCTION', label: 'Production / Mill / Packing' },
  { value: 'COLD_STORAGE', label: 'Cold Storage IN / OUT' },
  { value: 'STOCK_ADJUST', label: 'Stock Adjustment / Opening' },
  { value: 'VOUCHER', label: 'Vouchers' },
  { value: 'ADVANCE', label: 'Advances' },
  { value: 'QUOTATION', label: 'Quotations' },
  { value: 'PURCHASE_ORDER', label: 'Purchase Orders' },
  { value: 'PURCHASE_REQUEST', label: 'Purchase Requests' },
  { value: 'WORK_ORDER', label: 'Work Orders' },
  { value: 'EXPORT_ORDER', label: 'Sales Export Orders' },
  { value: 'OUTPASS', label: 'Outpass' },
  { value: 'INPASS', label: 'Inpass' },
  { value: 'QC', label: 'Quality Control' }
];

const DEFAULT_RECIPIENT_FORM = {
  name: '',
  role: 'Client / Customer',
  description: '',
  phone: '',
  email: '',
  whatsapp_enabled: true,
  sms_enabled: false,
  email_enabled: false,
  in_app_enabled: true,
  notify_all: true,
  notify_purchase: true,
  notify_purchase_return: true,
  notify_sales: true,
  notify_sales_return: true,
  notify_godown_transfer: true,
  notify_production: true,
  notify_vouchers: true,
  notify_outpass: true,
  notify_inpass: true,
  notify_qc: true,
  notify_vehicle_loading: true,
  is_active: true
};

const parseTimestamp = (val) => {
  if (!val) return null;
  if (val instanceof Date) return val;
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s) && !s.includes('T') && !s.endsWith('Z')) {
    return new Date(s.replace(' ', 'T') + 'Z');
  }
  return new Date(s);
};

const formatDateTimeIST = (val) => {
  const d = parseTimestamp(val);
  if (!d || Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
};

const formatTimeIST = (val) => {
  const d = parseTimestamp(val);
  if (!d || Number.isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
};

const formatDateIST = (val) => {
  const d = parseTimestamp(val);
  if (!d || Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
};

function StatusTag({ label, tone = 'neutral' }) {
  const styles = {
    success: { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' },
    warning: { bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
    error: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
    info: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
    neutral: { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' }
  }[tone] || { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1,
        py: 0.25,
        borderRadius: 1,
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1.4,
        bgcolor: styles.bg,
        color: styles.color,
        border: `1px solid ${styles.border}`,
        whiteSpace: 'nowrap'
      }}
    >
      {label}
    </Box>
  );
}

export default function CentralNotificationCenter() {
  const navigate = useNavigate();
  const [tabIndex, setTabIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  // Toast feedback (no window.alert inside iframe)
  const [toast, setToast] = useState({ open: false, severity: 'info', text: '' });
  const showToast = useCallback((severity, text) => {
    setToast({ open: true, severity, text });
  }, []);

  // Core data states
  const [activities, setActivities] = useState([]);
  const [deliveryLogs, setDeliveryLogs] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [channels, setChannels] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingConfirmations, setPendingConfirmations] = useState(0);
  const [unmaskPhone, setUnmaskPhone] = useState(true);

  // Main Company Server WhatsApp Session state
  const [waStatus, setWaStatus] = useState({
    status: 'DISCONNECTED',
    connected: false,
    phoneNumber: null,
    displayName: 'Main Company WhatsApp',
    qrDataUrl: null,
    pairingCode: null,
    lastError: null,
    connectedAt: null
  });
  const [waConnecting, setWaConnecting] = useState(false);
  const [waPairingPhone, setWaPairingPhone] = useState('');
  const [directPhone, setDirectPhone] = useState('');
  const [directMessage, setDirectMessage] = useState('');
  const [sendingDirect, setSendingDirect] = useState(false);

  // Filter states
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [recipientSearch, setRecipientSearch] = useState('');

  // Confirm delete dialog (in-app, avoids browser confirm)
  const [deleteConfirmRec, setDeleteConfirmRec] = useState(null);

  // Acknowledgment dialog
  const [ackModalOpen, setAckModalOpen] = useState(false);
  const [selectedItemForAck, setSelectedItemForAck] = useState(null);
  const [ackPersonName, setAckPersonName] = useState('');
  const [ackRemarks, setAckRemarks] = useState('');

  // Recipient form dialog
  const [recipientModalOpen, setRecipientModalOpen] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState(null);
  const [recipientForm, setRecipientForm] = useState(DEFAULT_RECIPIENT_FORM);

  // Template edit dialog
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateBodyDraft, setTemplateBodyDraft] = useState('');

  // Channel edit dialog
  const [channelModalOpen, setChannelModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [channelForm, setChannelForm] = useState({
    provider_name: '',
    api_endpoint: '',
    sender_id: '',
    auth_token: '',
    is_active: true,
    test_mode: true
  });

  // Single recipient test alert dialog
  const [recipientTestModalOpen, setRecipientTestModalOpen] = useState(false);
  const [selectedRecipientForTest, setSelectedRecipientForTest] = useState(null);
  const [recipientTestModule, setRecipientTestModule] = useState('PURCHASE');

  // Test Result preview dialog
  const [testResultModalOpen, setTestResultModalOpen] = useState(false);
  const [testResultData, setTestResultData] = useState(null);
  const [sendingTest, setSendingTest] = useState(false);

  const loadWhatsAppStatus = useCallback(async () => {
    try {
      const res = await axios.get('/api/central-notifications/whatsapp/status');
      if (res.data?.success) {
        setWaStatus(res.data);
      }
    } catch (_) {}
  }, []);

  const loadLiveSummary = useCallback(async () => {
    try {
      const res = await axios.get('/api/central-notifications/live');
      if (res.data.success) {
        setUnreadCount(res.data.count || 0);
        setPendingConfirmations(res.data.pendingConfirmations || 0);
      }
    } catch (_) {}
  }, []);

  const loadLiveActivities = useCallback(async () => {
    try {
      const res = await axios.get('/api/central-notifications/live-activity');
      if (res.data.success) {
        setActivities(res.data.activities || []);
      }
    } catch (_) {}
  }, []);

  const loadDeliveryLogs = useCallback(async (forceUnmask = unmaskPhone) => {
    try {
      const res = await axios.get(`/api/central-notifications/delivery-logs?unmask=${forceUnmask}`);
      if (res.data.success) {
        setDeliveryLogs(res.data.logs || []);
      }
    } catch (_) {}
  }, [unmaskPhone]);

  const loadRecipients = useCallback(async (forceUnmask = unmaskPhone) => {
    try {
      const res = await axios.get(`/api/central-notifications/recipients?unmask=${forceUnmask}`);
      if (res.data.success) {
        setRecipients(res.data.recipients || []);
      }
    } catch (_) {}
  }, [unmaskPhone]);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await axios.get('/api/central-notifications/templates');
      if (res.data.success) {
        setTemplates(res.data.templates || []);
      }
    } catch (_) {}
  }, []);

  const loadChannels = useCallback(async () => {
    try {
      const res = await axios.get('/api/central-notifications/channels');
      if (res.data.success) {
        setChannels(res.data.channels || []);
      }
    } catch (_) {}
  }, []);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      loadWhatsAppStatus(),
      loadLiveSummary(),
      loadLiveActivities(),
      loadDeliveryLogs(),
      loadRecipients(),
      loadTemplates(),
      loadChannels()
    ]);
    setLoading(false);
  }, [loadWhatsAppStatus, loadLiveSummary, loadLiveActivities, loadDeliveryLogs, loadRecipients, loadTemplates, loadChannels]);

  useEffect(() => {
    loadAllData();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      loadLiveSummary();
      loadWhatsAppStatus();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadAllData, loadLiveSummary, loadWhatsAppStatus]);

  // Fast-poll QR / pairing code status while linking Main Company WhatsApp
  useEffect(() => {
    const activeLinking = ['CONNECTING', 'QR_READY', 'PAIRING_CODE_READY'].includes(waStatus.status);
    if (!activeLinking) return undefined;

    const timer = setInterval(async () => {
      try {
        const res = await axios.get('/api/central-notifications/whatsapp/status');
        if (res.data?.success) {
          setWaStatus(res.data);
          if (res.data.connected) {
            showToast('success', `Main Company WhatsApp connected (${res.data.phoneNumber || 'Active'})!`);
          }
        }
      } catch (_) {}
    }, 3000);

    return () => clearInterval(timer);
  }, [waStatus.status, showToast]);

  // Server WhatsApp Actions
  const handleConnectQr = async (fresh = true) => {
    setWaConnecting(true);
    try {
      const res = await axios.post('/api/central-notifications/whatsapp/connect', {
        mode: 'qr',
        fresh
      });
      if (res.data?.success) {
        setWaStatus(res.data);
        showToast('info', 'Generating WhatsApp QR code. Scan with WhatsApp → Linked Devices.');
      }
    } catch (e) {
      showToast('error', e.response?.data?.error || 'Failed to initiate WhatsApp QR linking');
    } finally {
      setWaConnecting(false);
    }
  };

  const handleConnectPairing = async () => {
    const cleaned = waPairingPhone.trim();
    if (!cleaned || cleaned.replace(/\D/g, '').length < 10) {
      showToast('warning', 'Enter your Main Company WhatsApp phone number with country code (e.g. +91 9876543210).');
      return;
    }
    setWaConnecting(true);
    try {
      const res = await axios.post('/api/central-notifications/whatsapp/connect', {
        mode: 'pairing',
        phoneNumber: cleaned,
        fresh: true
      });
      if (res.data?.success) {
        setWaStatus(res.data);
        showToast('info', 'Pairing code requested. Wait 2–4 seconds if still generating.');
      }
    } catch (e) {
      showToast('error', e.response?.data?.error || 'Failed to generate pairing code');
    } finally {
      setWaConnecting(false);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    setWaConnecting(true);
    try {
      const res = await axios.post('/api/central-notifications/whatsapp/disconnect');
      if (res.data?.success) {
        setWaStatus(res.data);
        showToast('info', 'Main Company Server WhatsApp disconnected.');
      }
    } catch (e) {
      showToast('error', e.response?.data?.error || 'Failed to disconnect Server WhatsApp');
    } finally {
      setWaConnecting(false);
    }
  };

  const handleSendDirectWhatsApp = async () => {
    if (!directPhone.trim() || !directMessage.trim()) {
      showToast('warning', 'Enter both recipient WhatsApp number and message text.');
      return;
    }
    setSendingDirect(true);
    try {
      const res = await axios.post('/api/central-notifications/whatsapp/send-direct', {
        phone: directPhone.trim(),
        message: directMessage.trim()
      });
      if (res.data?.success) {
        showToast('success', `WhatsApp sent from Main Company (${res.data.senderPhone || 'Server'}) to ${res.data.phone}`);
        setDirectMessage('');
      }
    } catch (e) {
      showToast('error', e.response?.data?.error || 'Failed to send direct WhatsApp message');
    } finally {
      setSendingDirect(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await axios.post('/api/central-notifications/mark-all-read');
      loadAllData();
      showToast('success', 'All alerts marked as read.');
    } catch (_) {}
  };

  const openAckDialog = (item) => {
    setSelectedItemForAck(item);
    setAckPersonName('');
    setAckRemarks('');
    setAckModalOpen(true);
  };

  const submitAcknowledgment = async () => {
    if (!selectedItemForAck) return;
    try {
      await axios.post(`/api/central-notifications/acknowledge/${selectedItemForAck.id}`, {
        acknowledged_by: ackPersonName,
        remarks: ackRemarks
      });
      setAckModalOpen(false);
      loadAllData();
      showToast('success', 'Transaction acknowledgment recorded.');
    } catch (e) {
      showToast('error', 'Error recording acknowledgment: ' + (e.response?.data?.message || e.message));
    }
  };

  const retryLog = async (logId) => {
    try {
      const res = await axios.post(`/api/central-notifications/retry/${logId}`);
      if (res.data.success) {
        loadDeliveryLogs();
        showToast('success', `Retry status: ${res.data.delivery_status || 'Processed'}`);
      }
    } catch (e) {
      showToast('error', e.response?.data?.message || 'Retry failed');
    }
  };

  const openRecipientModal = (rec = null) => {
    if (rec) {
      setEditingRecipient(rec);
      setRecipientForm({
        name: rec.name || '',
        role: rec.role || 'Client / Customer',
        description: rec.description || '',
        phone: rec.phone_raw || '',
        email: rec.email || '',
        whatsapp_enabled: Boolean(rec.whatsapp_enabled),
        sms_enabled: Boolean(rec.sms_enabled),
        email_enabled: Boolean(rec.email_enabled),
        in_app_enabled: Boolean(rec.in_app_enabled),
        notify_all: Boolean(rec.notify_all),
        notify_purchase: Boolean(rec.notify_purchase),
        notify_purchase_return: rec.notify_purchase_return !== undefined ? Boolean(rec.notify_purchase_return) : true,
        notify_sales: Boolean(rec.notify_sales),
        notify_sales_return: rec.notify_sales_return !== undefined ? Boolean(rec.notify_sales_return) : true,
        notify_godown_transfer: rec.notify_godown_transfer !== undefined ? Boolean(rec.notify_godown_transfer) : true,
        notify_production: rec.notify_production !== undefined ? Boolean(rec.notify_production) : true,
        notify_vouchers: rec.notify_vouchers !== undefined ? Boolean(rec.notify_vouchers) : true,
        notify_outpass: Boolean(rec.notify_outpass),
        notify_inpass: Boolean(rec.notify_inpass),
        notify_qc: Boolean(rec.notify_qc),
        notify_vehicle_loading: Boolean(rec.notify_vehicle_loading),
        is_active: rec.is_active !== undefined ? Boolean(rec.is_active) : true
      });
    } else {
      setEditingRecipient(null);
      setRecipientForm({ ...DEFAULT_RECIPIENT_FORM });
    }
    setRecipientModalOpen(true);
  };

  const openSingleRecipientTest = (rec) => {
    setSelectedRecipientForTest(rec);
    if (rec.notify_purchase) setRecipientTestModule('PURCHASE');
    else if (rec.notify_sales) setRecipientTestModule('SALES');
    else if (rec.notify_purchase_return) setRecipientTestModule('PURCHASE_RETURN');
    else if (rec.notify_godown_transfer) setRecipientTestModule('GODOWN_TRANSFER');
    else if (rec.notify_outpass) setRecipientTestModule('OUTPASS');
    else setRecipientTestModule('PURCHASE');
    setRecipientTestModalOpen(true);
  };

  const dispatchSingleRecipientTest = async () => {
    if (!selectedRecipientForTest) return;
    setSendingTest(true);
    try {
      const res = await axios.post(`/api/central-notifications/recipients/${selectedRecipientForTest.id}/test-alert`, {
        moduleName: recipientTestModule
      });
      if (res.data.success) {
        setRecipientTestModalOpen(false);
        setTestResultData({
          title: `Direct Test Alert Dispatched to ${selectedRecipientForTest.name}`,
          moduleName: recipientTestModule,
          recipient: selectedRecipientForTest.name,
          role: selectedRecipientForTest.role,
          phone: selectedRecipientForTest.phone_raw || selectedRecipientForTest.phone,
          formattedWhatsAppMsg: res.data.formattedWhatsAppMsg,
          formattedSmsMsg: res.data.formattedSmsMsg,
          deliveryResults: res.data.deliveryResults
        });
        setTestResultModalOpen(true);
        loadAllData();
      }
    } catch (e) {
      showToast('error', 'Error triggering test alert: ' + (e.response?.data?.message || e.message));
    } finally {
      setSendingTest(false);
    }
  };

  const saveRecipient = async () => {
    if (!recipientForm.name.trim()) {
      showToast('warning', 'Please enter a contact / client name.');
      return;
    }
    if ((recipientForm.whatsapp_enabled || recipientForm.sms_enabled) && !recipientForm.phone.trim()) {
      showToast('warning', 'Please enter a WhatsApp / Mobile phone number.');
      return;
    }
    try {
      if (editingRecipient) {
        await axios.put(`/api/central-notifications/recipients/${editingRecipient.id}`, recipientForm);
        showToast('success', `Updated recipient ${recipientForm.name}.`);
      } else {
        await axios.post('/api/central-notifications/recipients', recipientForm);
        showToast('success', `Added ${recipientForm.name} to WhatsApp recipients.`);
      }
      setRecipientModalOpen(false);
      loadRecipients();
    } catch (e) {
      showToast('error', 'Error saving recipient: ' + (e.response?.data?.message || e.message));
    }
  };

  const confirmDeleteRecipient = async () => {
    if (!deleteConfirmRec) return;
    try {
      await axios.delete(`/api/central-notifications/recipients/${deleteConfirmRec.id}`);
      showToast('success', `Removed ${deleteConfirmRec.name}.`);
      setDeleteConfirmRec(null);
      loadRecipients();
    } catch (e) {
      showToast('error', 'Error deleting recipient: ' + (e.response?.data?.message || e.message));
    }
  };

  const openTemplateModal = (tpl) => {
    setEditingTemplate(tpl);
    setTemplateBodyDraft(tpl.template_body || '');
    setTemplateModalOpen(true);
  };

  const saveTemplate = async () => {
    if (!editingTemplate) return;
    try {
      await axios.put(`/api/central-notifications/templates/${editingTemplate.id}`, {
        template_body: templateBodyDraft
      });
      setTemplateModalOpen(false);
      loadTemplates();
      showToast('success', 'Notification message template updated.');
    } catch (e) {
      showToast('error', 'Error saving template: ' + (e.response?.data?.message || e.message));
    }
  };

  const openChannelModal = (ch) => {
    setEditingChannel(ch);
    setChannelForm({
      provider_name: ch.provider_name || '',
      api_endpoint: ch.api_endpoint || '',
      sender_id: ch.sender_id || '',
      auth_token: '',
      is_active: Boolean(ch.is_active),
      test_mode: Boolean(ch.test_mode)
    });
    setChannelModalOpen(true);
  };

  const saveChannel = async () => {
    if (!editingChannel) return;
    try {
      await axios.put(`/api/central-notifications/channels/${editingChannel.id}`, channelForm);
      setChannelModalOpen(false);
      loadChannels();
      showToast('success', `${editingChannel.channel} gateway configuration saved.`);
    } catch (e) {
      showToast('error', 'Error saving channel: ' + (e.response?.data?.message || e.message));
    }
  };

  const navigateToModule = (moduleName) => {
    const mod = String(moduleName || '').toUpperCase();
    if (mod === 'OUTPASS') navigate('/entry/outpass-display');
    else if (mod === 'INPASS') navigate('/entry/inpass-display');
    else if (mod === 'PURCHASE_RETURN') navigate('/entry/purchase-return-display');
    else if (mod === 'PURCHASE_ORDER') navigate('/entry/purchase-order-list');
    else if (mod === 'PURCHASE_REQUEST') navigate('/entry/purchase-request-display');
    else if (mod === 'PURCHASE') navigate('/entry/purchase-display');
    else if (mod === 'SALES_RETURN') navigate('/entry/sales-return-display');
    else if (mod === 'EXPORT_ORDER') navigate('/entry/sales-export-order-display');
    else if (mod === 'SALES') navigate('/entry/sales-display');
    else if (mod === 'GODOWN_TRANSFER' || mod === 'ITEM_TRANSFER') navigate('/entry/godown-transfer-display');
    else if (mod === 'COLD_STORAGE') navigate('/cold-storage/vouchers');
    else if (mod === 'STOCK_ADJUST') navigate('/entry/stock-adjust-display');
    else if (mod === 'VOUCHER') navigate('/entry/voucher-display');
    else if (mod === 'ADVANCE') navigate('/entry/advance-display');
    else if (mod === 'QUOTATION') navigate('/entry/quotation-display');
    else if (mod === 'WORK_ORDER') navigate('/entry/work-order-display');
    else if (['PRODUCTION', 'GRIND', 'FLOUR_OUT', 'FLOUR_OUT_RETURN', 'PAPAD_IN', 'PAPAD_RETURN', 'PACKING'].includes(mod)) {
      navigate('/entry/grind-display');
    } else if (mod === 'QC') navigate('/entry/quality-control-list');
    else navigate('/command-center');
  };

  const getModuleIcon = (moduleName) => {
    const mod = String(moduleName || '').toUpperCase();
    if (mod === 'OUTPASS') return <LocalShippingIcon sx={{ color: '#2563eb', fontSize: 24 }} />;
    if (mod === 'INPASS') return <MoveToInboxIcon sx={{ color: '#059669', fontSize: 24 }} />;
    if (mod === 'PURCHASE' || mod === 'PURCHASE_ORDER' || mod === 'PURCHASE_REQUEST') {
      return <ShoppingCartIcon sx={{ color: '#16a34a', fontSize: 24 }} />;
    }
    if (mod === 'PURCHASE_RETURN' || mod === 'SALES_RETURN') {
      return <AssignmentReturnIcon sx={{ color: '#ea580c', fontSize: 24 }} />;
    }
    if (mod === 'SALES' || mod === 'EXPORT_ORDER' || mod === 'QUOTATION') {
      return <PointOfSaleIcon sx={{ color: '#d97706', fontSize: 24 }} />;
    }
    if (mod === 'GODOWN_TRANSFER' || mod === 'ITEM_TRANSFER') {
      return <SwapHorizIcon sx={{ color: '#0284c7', fontSize: 24 }} />;
    }
    if (mod === 'COLD_STORAGE') return <AcUnitIcon sx={{ color: '#0891b2', fontSize: 24 }} />;
    if (mod === 'STOCK_ADJUST') return <Inventory2Icon sx={{ color: '#4f46e5', fontSize: 24 }} />;
    if (mod === 'VOUCHER' || mod === 'ADVANCE') return <AccountBalanceWalletIcon sx={{ color: '#7c3aed', fontSize: 24 }} />;
    return <PrecisionManufacturingIcon sx={{ color: '#334155', fontSize: 24 }} />;
  };

  // Filtered views
  const filteredActivities = activities.filter((act) => {
    if (moduleFilter === 'ALL') return true;
    const m = (act.reference_module || act.module_name || '').toUpperCase();
    if (moduleFilter === 'PRODUCTION') {
      return ['PRODUCTION', 'GRIND', 'FLOUR_OUT', 'FLOUR_OUT_RETURN', 'PAPAD_IN', 'PAPAD_RETURN', 'PACKING', 'WORK_ORDER'].includes(m);
    }
    return m === moduleFilter || m.includes(moduleFilter);
  });

  const filteredLogs = deliveryLogs.filter((log) => {
    if (channelFilter !== 'ALL' && log.channel !== channelFilter) return false;
    if (moduleFilter !== 'ALL') {
      const lm = (log.module_name || '').toUpperCase();
      if (lm !== moduleFilter && !lm.includes(moduleFilter)) return false;
    }
    return true;
  });

  const filteredRecipients = recipients.filter((rec) => {
    if (!recipientSearch.trim()) return true;
    const q = recipientSearch.toLowerCase();
    return (
      (rec.name || '').toLowerCase().includes(q) ||
      (rec.role || '').toLowerCase().includes(q) ||
      (rec.description || '').toLowerCase().includes(q) ||
      (rec.phone || '').toLowerCase().includes(q)
    );
  });

  const activeWhatsAppClientsCount = recipients.filter(
    (r) => r.is_active && r.whatsapp_enabled && r.phone_raw && !r.phone_raw.includes('X')
  ).length;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Header Bar */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #1e3a8a 0%, #1f4fb2 55%, #2563eb 100%)',
          color: '#ffffff',
          p: 2.5,
          borderRadius: 2,
          boxShadow: '0 4px 14px rgba(31, 79, 178, 0.2)',
          mb: 2.5,
          gap: 2
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <NotificationsActiveIcon sx={{ fontSize: 34, color: '#bfdbfe' }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '0.2px' }}>
              WhatsApp &amp; Enterprise Notification Center
            </Typography>
            <Typography variant="body2" sx={{ color: '#dbeafe', mt: 0.3 }}>
              Main Company Server WhatsApp dispatch across Purchase, Sales, Returns, Transfers, Production, Cold Storage &amp; Vouchers
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            size="small"
            variant="contained"
            onClick={() => setTabIndex(0)}
            startIcon={<WhatsAppIcon />}
            sx={{
              backgroundColor: waStatus.connected ? '#059669' : 'rgba(255,255,255,0.18)',
              color: '#ffffff',
              fontWeight: 700,
              textTransform: 'none',
              '&:hover': { backgroundColor: waStatus.connected ? '#047857' : 'rgba(255,255,255,0.28)' }
            }}
          >
            {waStatus.connected
              ? `Server WhatsApp: ${waStatus.phoneNumber || 'Linked'}`
              : 'Link Main Company WhatsApp'}
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={loadAllData}
            startIcon={<RefreshIcon />}
            sx={{
              backgroundColor: 'rgba(255,255,255,0.16)',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.26)' },
              textTransform: 'none',
              fontWeight: 600
            }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={handleMarkAllRead}
            startIcon={<DoneAllIcon />}
            sx={{
              backgroundColor: 'rgba(255,255,255,0.16)',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.26)' },
              textTransform: 'none',
              fontWeight: 600
            }}
          >
            Mark All Read
          </Button>
        </Box>
      </Box>

      {/* KPI Summary Strip */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 2.5 }}>
        <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Server WhatsApp
              </Typography>
              <StatusTag
                label={waStatus.connected ? 'CONNECTED' : waStatus.status}
                tone={waStatus.connected ? 'success' : waStatus.status === 'QR_READY' || waStatus.status === 'PAIRING_CODE_READY' ? 'warning' : 'neutral'}
              />
            </Box>
            <Typography
              variant="h6"
              sx={{ fontWeight: 800, color: '#0f172a', mt: 1, fontVariantNumeric: 'tabular-nums', fontFamily: waStatus.phoneNumber ? 'monospace' : 'inherit' }}
            >
              {waStatus.connected ? (waStatus.phoneNumber || 'Linked Session') : 'Not Linked'}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.4 }}>
              Main company sender number
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Client &amp; Team Contacts
              </Typography>
              <StatusTag label={`${activeWhatsAppClientsCount} WhatsApp Ready`} tone="info" />
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#1e3a8a', mt: 0.75, fontVariantNumeric: 'tabular-nums' }}>
              {recipients.filter((r) => r.is_active).length}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.25 }}>
              Active subscribed numbers with descriptions
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Delivery Audit Logs
              </Typography>
              <StatusTag label="Multi-Channel" tone="success" />
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#047857', mt: 0.75, fontVariantNumeric: 'tabular-nums' }}>
              {deliveryLogs.length}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.25 }}>
              WhatsApp, SMS, Email &amp; In-App dispatches
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Unread / Pending Ack
              </Typography>
              <StatusTag label={`${unreadCount} Unread`} tone={pendingConfirmations > 0 ? 'warning' : 'neutral'} />
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#b45309', mt: 0.75, fontVariantNumeric: 'tabular-nums' }}>
              {pendingConfirmations}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.25 }}>
              Entries awaiting review confirmation
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Main Tabs */}
      <Paper sx={{ borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
        <Tabs
          value={tabIndex}
          onChange={(_, val) => setTabIndex(val)}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            borderBottom: '1px solid #e2e8f0',
            px: 2,
            '& .MuiTab-root': { fontWeight: 700, py: 1.6, textTransform: 'none', fontSize: 13.5 }
          }}
        >
          <Tab label="Main Company WhatsApp" icon={<WhatsAppIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
          <Tab label={`Client & Team Recipients (${recipients.length})`} />
          <Tab label="Live Transaction Stream" />
          <Tab label={`Pending Confirmations (${pendingConfirmations})`} />
          <Tab label="Delivery Audit Logs" />
          <Tab label="Message Templates" icon={<DescriptionIcon sx={{ fontSize: 17 }} />} iconPosition="start" />
          <Tab label="Gateway Settings" icon={<SettingsIcon sx={{ fontSize: 17 }} />} iconPosition="start" />
        </Tabs>

        {loading && (
          <Box sx={{ px: 3, pt: 2, display: 'flex', alignItems: 'center', gap: 1, color: '#64748b' }}>
            <CircularProgress size={16} />
            <Typography variant="caption">Syncing communication status...</Typography>
          </Box>
        )}

        {/* TAB 0: Main Company Server WhatsApp Connection & Direct Send */}
        {tabIndex === 0 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.15fr 0.85fr' }, gap: 3 }}>
              {/* Left Column: Main Company Account Linker */}
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, bgcolor: '#ffffff', borderColor: '#e2e8f0' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <WhatsAppIcon sx={{ color: '#16a34a' }} />
                      Main Company WhatsApp Sender Account
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3 }}>
                      Link your company&apos;s primary WhatsApp number on the server. Whenever any entry is created (Purchase, Sales, Return, Transfer, Production, Voucher), the server automatically sends WhatsApp notifications to all subscribed client &amp; staff numbers.
                    </Typography>
                  </Box>
                  <StatusTag
                    label={waStatus.connected ? 'LIVE & CONNECTED' : waStatus.status}
                    tone={waStatus.connected ? 'success' : waStatus.lastError ? 'error' : 'warning'}
                  />
                </Box>

                {waStatus.lastError && !waStatus.connected && (
                  <Alert severity="warning" sx={{ mb: 2, fontSize: 12.5 }}>
                    {waStatus.lastError}
                  </Alert>
                )}

                {waStatus.connected ? (
                  <Box sx={{ p: 2.5, borderRadius: 2, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#166534', fontWeight: 700, textTransform: 'uppercase' }}>
                          Active Server Sender Number
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 800, color: '#14532d', fontFamily: 'monospace', mt: 0.25, fontVariantNumeric: 'tabular-nums' }}>
                          {waStatus.phoneNumber || 'Connected'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#166534', display: 'block', mt: 0.5, fontVariantNumeric: 'tabular-nums' }}>
                          {waStatus.displayName || 'Main Company WhatsApp'}
                          {waStatus.connectedAt ? ` • Linked ${formatDateTimeIST(waStatus.connectedAt)}` : ''}
                        </Typography>
                      </Box>
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        disabled={waConnecting}
                        startIcon={<LinkOffIcon />}
                        onClick={handleDisconnectWhatsApp}
                        sx={{ fontWeight: 700, textTransform: 'none', bgcolor: '#ffffff' }}
                      >
                        Disconnect Account
                      </Button>
                    </Box>

                    <Divider sx={{ my: 2, borderColor: '#bbf7d0' }} />
                    <Typography variant="body2" sx={{ color: '#166534', fontWeight: 600 }}>
                      Automatic delivery is active. New entries across Purchase, Sales, Purchase Return, Sales Return, Godown Transfer, Production, Cold Storage, Stock Adjust &amp; Vouchers will dispatch from this WhatsApp number automatically.
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                    {/* Option 1: QR Code Linking */}
                    <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <QrCode2Icon fontSize="small" color="primary" />
                            Option 1: Scan QR Code (Recommended)
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Open WhatsApp on company phone → Linked Devices → Link a Device → Scan QR
                          </Typography>
                        </Box>
                        <Button
                          variant="contained"
                          size="small"
                          disabled={waConnecting}
                          onClick={() => handleConnectQr(true)}
                          startIcon={waConnecting ? <CircularProgress size={14} color="inherit" /> : <QrCode2Icon />}
                          sx={{ backgroundColor: '#1f4fb2', fontWeight: 700, textTransform: 'none' }}
                        >
                          {waStatus.qrDataUrl ? 'Refresh QR Code' : 'Generate WhatsApp QR'}
                        </Button>
                      </Box>

                      {waStatus.qrDataUrl && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2, bgcolor: '#ffffff', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                          <Box
                            component="img"
                            src={waStatus.qrDataUrl}
                            alt="Main Company WhatsApp Link QR"
                            sx={{ width: 220, height: 220, borderRadius: 1 }}
                          />
                          <Typography variant="caption" sx={{ mt: 1, color: '#475569', fontWeight: 600 }}>
                            Auto-checking connection every 3 seconds...
                          </Typography>
                        </Box>
                      )}
                    </Box>

                    {/* Option 2: 8-Digit Pairing Code */}
                    <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                        <PhonelinkLockIcon fontSize="small" color="success" />
                        Option 2: Link with 8-Digit Phone Pairing Code
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                        Enter your Main Company phone number with country code (e.g. +91 9876543210), then enter the generated 8-character code in WhatsApp → Linked Devices → Link with phone number instead.
                      </Typography>

                      <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', flexWrap: 'wrap' }}>
                        <TextField
                          size="small"
                          label="Company WhatsApp Phone"
                          placeholder="+91 9876543210"
                          value={waPairingPhone}
                          onChange={(e) => setWaPairingPhone(e.target.value)}
                          sx={{ flex: 1, minWidth: 220, bgcolor: '#ffffff' }}
                        />
                        <Button
                          variant="outlined"
                          color="success"
                          disabled={waConnecting}
                          onClick={handleConnectPairing}
                          sx={{ fontWeight: 700, textTransform: 'none', height: 40 }}
                        >
                          Get 8-Digit Code
                        </Button>
                      </Box>

                      {waStatus.pairingCode && (
                        <Box sx={{ mt: 2, p: 2, bgcolor: '#ffffff', borderRadius: 1.5, border: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="caption" sx={{ color: '#166534', fontWeight: 700 }}>
                              ENTER THIS CODE ON WHATSAPP MOBILE:
                            </Typography>
                            <Typography variant="h4" sx={{ fontFamily: 'monospace', fontWeight: 900, letterSpacing: '4px', color: '#14532d', fontVariantNumeric: 'tabular-nums' }}>
                              {waStatus.pairingCode}
                            </Typography>
                          </Box>
                          <IconButton
                            onClick={() => {
                              navigator.clipboard?.writeText(waStatus.pairingCode);
                              showToast('info', 'Pairing code copied.');
                            }}
                            title="Copy Pairing Code"
                          >
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      )}
                    </Box>
                  </Box>
                )}
              </Paper>

              {/* Right Column: Quick Send & Recipient Overview */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, bgcolor: '#ffffff', borderColor: '#e2e8f0' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
                    Quick Send via Main Company WhatsApp
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                    Test sending an instant WhatsApp message directly from the server to any client or team number.
                  </Typography>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {recipients.some((r) => r.phone_raw && !r.phone_raw.includes('X')) && (
                      <TextField
                        select
                        size="small"
                        label="Quick Select Added Client / Contact"
                        value=""
                        onChange={(e) => {
                          if (e.target.value) setDirectPhone(e.target.value);
                        }}
                        SelectProps={{ native: true }}
                        InputLabelProps={{ shrink: true }}
                      >
                        <option value="">-- Choose saved recipient phone --</option>
                        {recipients
                          .filter((r) => r.phone_raw && !r.phone_raw.includes('X'))
                          .map((r) => (
                            <option key={r.id} value={r.phone_raw}>
                              {r.name} ({r.phone_raw}){r.description ? ` — ${r.description}` : ''}
                            </option>
                          ))}
                      </TextField>
                    )}

                    <TextField
                      size="small"
                      label="Recipient WhatsApp Number"
                      placeholder="+91 9876543210"
                      value={directPhone}
                      onChange={(e) => setDirectPhone(e.target.value)}
                    />
                    <TextField
                      size="small"
                      multiline
                      rows={4}
                      label="WhatsApp Message"
                      placeholder="Enter message to dispatch from Main Company WhatsApp..."
                      value={directMessage}
                      onChange={(e) => setDirectMessage(e.target.value)}
                    />
                    <Button
                      variant="contained"
                      color="success"
                      disabled={sendingDirect || !waStatus.connected}
                      onClick={handleSendDirectWhatsApp}
                      startIcon={sendingDirect ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                      sx={{ fontWeight: 700, textTransform: 'none', bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' } }}
                    >
                      {waStatus.connected ? 'Send Direct WhatsApp Now' : 'Link Main Company WhatsApp First'}
                    </Button>
                  </Box>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, bgcolor: '#ffffff', borderColor: '#e2e8f0' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a', mb: 1 }}>
                    Automatic Notification Coverage
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, lineHeight: 1.6 }}>
                    Every newly saved entry across <strong>Purchase</strong>, <strong>Sales</strong>, <strong>Purchase Return</strong>, <strong>Sales Return</strong>, <strong>Godown / Item Transfers</strong>, <strong>Production / Mill / Packing</strong>, <strong>Cold Storage IN/OUT</strong>, <strong>Stock Adjustments</strong>, <strong>Vouchers &amp; Advances</strong>, and <strong>Orders</strong> automatically pushes formatted details to every active WhatsApp recipient.
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => {
                        setTabIndex(1);
                        openRecipientModal();
                      }}
                      startIcon={<PersonAddIcon />}
                      sx={{ backgroundColor: '#1f4fb2', fontWeight: 700, textTransform: 'none' }}
                    >
                      Add Client WhatsApp &amp; Description
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setTabIndex(1)}
                      sx={{ fontWeight: 700, textTransform: 'none' }}
                    >
                      View All {recipients.length} Contacts →
                    </Button>
                  </Box>
                </Paper>
              </Box>
            </Box>
          </Box>
        )}

        {/* TAB 1: Client & Team Recipients (with Description & All Entry Routing) */}
        {tabIndex === 1 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                  Client &amp; Stakeholder WhatsApp Numbers
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Add client or team WhatsApp numbers with their description and select which created entry notifications they receive automatically
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                  size="small"
                  placeholder="Search name, description, phone..."
                  value={recipientSearch}
                  onChange={(e) => setRecipientSearch(e.target.value)}
                  sx={{ minWidth: 220 }}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={unmaskPhone}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setUnmaskPhone(checked);
                        loadRecipients(checked);
                      }}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                      {unmaskPhone ? 'Full Phone Shown' : 'Mask Phone'}
                    </Typography>
                  }
                />
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<PersonAddIcon />}
                  onClick={() => openRecipientModal()}
                  sx={{ backgroundColor: '#1f4fb2', fontWeight: 700, textTransform: 'none' }}
                >
                  Add WhatsApp Recipient
                </Button>
              </Box>
            </Box>

            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>Name &amp; Category</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Description</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>WhatsApp / Phone</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Channels</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Subscribed Entries</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 800, textAlign: 'right' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRecipients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} sx={{ textAlign: 'center', py: 5, color: '#64748b' }}>
                        <Typography variant="body2" sx={{ mb: 1.5 }}>
                          No client or stakeholder WhatsApp numbers added yet. Add numbers with their description to automatically receive notifications for created entries.
                        </Typography>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<PersonAddIcon />}
                          onClick={() => openRecipientModal()}
                          sx={{ backgroundColor: '#1f4fb2', fontWeight: 700, textTransform: 'none' }}
                        >
                          Add WhatsApp Number
                        </Button>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRecipients.map((rec) => {
                      const hasPhone = Boolean(rec.phone_raw && !rec.phone_raw.includes('X') && !rec.phone_raw.includes('x'));
                      const subs = [];
                      if (rec.notify_all) subs.push('All Entries');
                      else {
                        if (rec.notify_purchase) subs.push('Purchase');
                        if (rec.notify_purchase_return) subs.push('Purch Return');
                        if (rec.notify_sales) subs.push('Sales');
                        if (rec.notify_sales_return) subs.push('Sales Return');
                        if (rec.notify_godown_transfer) subs.push('Transfer');
                        if (rec.notify_production) subs.push('Production/CS');
                        if (rec.notify_vouchers) subs.push('Vouchers/Orders');
                        if (rec.notify_outpass) subs.push('Outpass');
                        if (rec.notify_inpass) subs.push('Inpass');
                        if (rec.notify_qc) subs.push('QC');
                      }

                      const enabledChannels = [];
                      if (rec.whatsapp_enabled) enabledChannels.push('WhatsApp');
                      if (rec.sms_enabled) enabledChannels.push('SMS');
                      if (rec.email_enabled) enabledChannels.push('Email');
                      if (rec.in_app_enabled) enabledChannels.push('In-App');

                      return (
                        <TableRow key={rec.id} hover>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                              {rec.name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                              {rec.role}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ maxWidth: 240 }}>
                            <Typography variant="body2" sx={{ fontSize: 12.5, color: rec.description ? '#334155' : '#94a3b8' }}>
                              {rec.description || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                            <span>{hasPhone ? (rec.phone || rec.phone_raw) : '—'}</span>
                          </TableCell>
                          <TableCell sx={{ fontSize: 12, color: '#334155' }}>
                            {enabledChannels.join(' · ') || 'None'}
                          </TableCell>
                          <TableCell sx={{ maxWidth: 260 }}>
                            <Typography variant="caption" sx={{ color: '#334155', lineHeight: 1.4, display: 'block' }}>
                              {subs.length > 0 ? subs.join(', ') : 'None'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <StatusTag label={rec.is_active ? 'Active' : 'Disabled'} tone={rec.is_active ? 'success' : 'neutral'} />
                          </TableCell>
                          <TableCell sx={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <Button
                              size="small"
                              variant="outlined"
                              color="success"
                              startIcon={<SendIcon sx={{ fontSize: 12 }} />}
                              onClick={() => openSingleRecipientTest(rec)}
                              sx={{ fontSize: 11, py: 0.3, px: 1, textTransform: 'none', fontWeight: 700, mr: 0.75 }}
                            >
                              Test
                            </Button>
                            <IconButton size="small" onClick={() => openRecipientModal(rec)} title="Edit Contact & Description">
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" color="error" onClick={() => setDeleteConfirmRec(rec)} title="Delete Recipient">
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* TAB 2: Live Transaction Stream */}
        {tabIndex === 2 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                  Live Application Entry &amp; Notification Stream
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Real-time feed of created entries across all ERP modules
                </Typography>
              </Box>

              <TextField
                select
                size="small"
                label="Filter Entry Module"
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                SelectProps={{ native: true }}
                sx={{ minWidth: 230 }}
              >
                {MODULE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </TextField>
            </Box>

            {filteredActivities.length === 0 ? (
              <Alert severity="info" sx={{ mt: 2 }}>
                No recent activity recorded for this filter.
              </Alert>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mt: 1 }}>
                {filteredActivities.map((act) => {
                  const isAck = act.acknowledged === 1;
                  return (
                    <Paper
                      key={act.id}
                      variant="outlined"
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        borderColor: '#e2e8f0',
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { sm: 'center' },
                        justifyContent: 'space-between',
                        gap: 2,
                        backgroundColor: isAck ? '#ffffff' : '#f8fafc'
                      }}
                    >
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                        <Box sx={{ mt: 0.3 }}>{getModuleIcon(act.reference_module || act.module_name)}</Box>
                        <Box>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                            <StatusTag label={act.reference_module || 'ENTRY'} tone="info" />
                            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                              {act.title}
                            </Typography>
                            {isAck ? (
                              <StatusTag label={`Ack by ${act.acknowledged_by || 'Manager'}`} tone="success" />
                            ) : (
                              <StatusTag label="Awaiting Ack" tone="warning" />
                            )}
                          </Box>
                          <Typography variant="body2" sx={{ color: '#334155', mt: 0.5 }}>
                            {act.message}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.75, fontVariantNumeric: 'tabular-nums' }}>
                            {formatDateTimeIST(act.created_at)}
                            {act.whatsapp_sent ? ' • WhatsApp Dispatched' : ''}
                            {act.sms_sent ? ' • SMS Dispatched' : ''}
                          </Typography>
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', gap: 1, alignSelf: { xs: 'flex-end', sm: 'center' }, flexShrink: 0 }}>
                        {!isAck && (
                          <Button
                            variant="outlined"
                            size="small"
                            color="primary"
                            onClick={() => openAckDialog(act)}
                            sx={{ fontWeight: 700, textTransform: 'none' }}
                          >
                            Acknowledge
                          </Button>
                        )}
                        <Button
                          variant="contained"
                          size="small"
                          endIcon={<OpenInNewIcon />}
                          onClick={() => navigateToModule(act.reference_module || act.module_name)}
                          sx={{ backgroundColor: '#1e3a8a', fontWeight: 700, textTransform: 'none' }}
                        >
                          Open Module
                        </Button>
                      </Box>
                    </Paper>
                  );
                })}
              </Box>
            )}
          </Box>
        )}

        {/* TAB 3: Pending Confirmations */}
        {tabIndex === 3 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
              Transactions Awaiting Official Management Acknowledgment
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Audit loop for verifying dispatches, returns, transfers, and vouchers
            </Typography>

            {activities.filter((a) => !a.acknowledged).length === 0 ? (
              <Alert severity="success" sx={{ mt: 2 }}>
                All transaction notifications have been acknowledged.
              </Alert>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {activities
                  .filter((a) => !a.acknowledged)
                  .map((act) => (
                    <Paper
                      key={act.id}
                      variant="outlined"
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        justifyContent: 'space-between',
                        alignItems: { sm: 'center' },
                        gap: 2,
                        bgcolor: '#fffbeb',
                        borderColor: '#fde68a'
                      }}
                    >
                      <Box>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <StatusTag label={act.reference_module || 'TRANSACTION'} tone="warning" />
                          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                            {act.title}
                          </Typography>
                        </Box>
                        <Typography variant="body2" sx={{ mt: 0.5, color: '#451a03' }}>
                          {act.message}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#92400e', mt: 0.5, display: 'block', fontVariantNumeric: 'tabular-nums' }}>
                          Logged: {formatDateTimeIST(act.created_at)}
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          variant="contained"
                          size="small"
                          color="warning"
                          onClick={() => openAckDialog(act)}
                          sx={{ fontWeight: 800, textTransform: 'none' }}
                        >
                          Acknowledge
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => navigateToModule(act.reference_module || act.module_name)}
                          sx={{ fontWeight: 700, textTransform: 'none' }}
                        >
                          Open Module
                        </Button>
                      </Box>
                    </Paper>
                  ))}
              </Box>
            )}
          </Box>
        )}

        {/* TAB 4: Communication Audit & Delivery Logs */}
        {tabIndex === 4 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                  Communication Audit &amp; Delivery Logs
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Complete outbound dispatch history across Server WhatsApp, SMS, Email &amp; In-App channels
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={unmaskPhone}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setUnmaskPhone(checked);
                        loadDeliveryLogs(checked);
                      }}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                      {unmaskPhone ? 'Phone Unmasked' : 'Mask Phone'}
                    </Typography>
                  }
                />

                <TextField
                  select
                  size="small"
                  label="Channel"
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                  SelectProps={{ native: true }}
                  sx={{ minWidth: 140 }}
                >
                  <option value="ALL">All Channels</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="SMS">SMS</option>
                  <option value="EMAIL">Email</option>
                  <option value="IN_APP">In-App</option>
                </TextField>

                <TextField
                  select
                  size="small"
                  label="Module"
                  value={moduleFilter}
                  onChange={(e) => setModuleFilter(e.target.value)}
                  SelectProps={{ native: true }}
                  sx={{ minWidth: 190 }}
                >
                  {MODULE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </TextField>
              </Box>
            </Box>

            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>Time</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Event &amp; Ref</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Recipient</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Channel &amp; Contact</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Message Content</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} sx={{ textAlign: 'center', py: 3, color: '#94a3b8' }}>
                        No delivery logs recorded matching this filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => {
                      const statusUpper = String(log.delivery_status || '').toUpperCase();
                      const tone = statusUpper.includes('FAILED') || statusUpper.includes('SKIPPED')
                        ? 'error'
                        : statusUpper.includes('DELIVERED')
                          ? 'success'
                          : 'warning';
                      return (
                        <TableRow key={log.id} hover>
                          <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                            {formatTimeIST(log.created_at)}
                            <Typography variant="caption" sx={{ display: 'block', color: '#94a3b8' }}>
                              {formatDateIST(log.created_at)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {log.event_type || log.module_name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                              {log.reference_no}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {log.recipient_name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                              {log.recipient_role}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: '#0f172a', display: 'block' }}>
                              {log.channel}
                            </Typography>
                            <Typography variant="caption" sx={{ display: 'block', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>
                              {log.recipient_contact}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ maxWidth: 320 }}>
                            <Typography variant="caption" sx={{ display: 'block', whiteSpace: 'pre-line', color: '#334155' }}>
                              {log.message_body?.length > 130 ? `${log.message_body.substring(0, 130)}...` : log.message_body}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <StatusTag label={log.delivery_status || 'DELIVERED'} tone={tone} />
                            {log.gateway_response && !statusUpper.includes('DELIVERED') && (
                              <Typography variant="caption" sx={{ display: 'block', color: '#64748b', mt: 0.3, maxWidth: 160 }}>
                                {log.gateway_response}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {log.delivery_url && (
                                <Tooltip title={log.channel === 'WHATSAPP' ? 'Open in WhatsApp' : 'Open in SMS'}>
                                  <IconButton
                                    size="small"
                                    component="a"
                                    href={log.delivery_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    sx={{ color: log.channel === 'WHATSAPP' ? '#16a34a' : '#2563eb' }}
                                  >
                                    {log.channel === 'WHATSAPP' ? <WhatsAppIcon fontSize="small" /> : <SmsIcon fontSize="small" />}
                                  </IconButton>
                                </Tooltip>
                              )}
                              {!statusUpper.includes('DELIVERED') && (
                                <IconButton size="small" onClick={() => retryLog(log.id)} title="Retry sending">
                                  <ReplayIcon fontSize="small" />
                                </IconButton>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* TAB 5: Message Templates */}
        {tabIndex === 5 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                Transaction Message Templates
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Customizable WhatsApp &amp; SMS message formats with dynamic entry variables
              </Typography>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
              {templates.map((tpl) => (
                <Paper key={tpl.id} variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: '#e2e8f0' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <StatusTag label={tpl.channel} tone={tpl.channel === 'WHATSAPP' ? 'success' : 'info'} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        {tpl.event_type}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => openTemplateModal(tpl)}
                      sx={{ textTransform: 'none', fontWeight: 700 }}
                    >
                      Edit
                    </Button>
                  </Box>
                  <Box
                    component="pre"
                    sx={{
                      p: 1.5,
                      bgcolor: '#f8fafc',
                      borderRadius: 1.5,
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap',
                      maxHeight: 210,
                      overflowY: 'auto',
                      m: 0
                    }}
                  >
                    {tpl.template_body}
                  </Box>
                </Paper>
              ))}
            </Box>
          </Box>
        )}

        {/* TAB 6: Channel & Gateway Provider Settings */}
        {tabIndex === 6 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
              Fallback API &amp; SMTP Gateway Providers
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Server WhatsApp (Tab 1) takes top priority automatically when linked. Configure optional Meta Cloud API, Fast2SMS / Twilio, or SMTP Email providers below.
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2.5 }}>
              {channels.map((ch) => (
                <Card key={ch.id} sx={{ borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
                  <CardContent sx={{ p: 2.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        {ch.channel === 'WHATSAPP' && <WhatsAppIcon color="success" />}
                        {ch.channel === 'SMS' && <SmsIcon color="primary" />}
                        {ch.channel === 'EMAIL' && <EmailIcon color="secondary" />}
                        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                          {ch.channel} Gateway
                        </Typography>
                      </Box>
                      <StatusTag
                        label={ch.test_mode ? 'Test Mode' : 'Live'}
                        tone={ch.test_mode ? 'warning' : 'success'}
                      />
                    </Box>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8, mb: 2 }}>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        Provider: <strong>{ch.provider_name}</strong>
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        Endpoint: <strong>{ch.api_endpoint || 'Default Provider URL'}</strong>
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        Sender ID: <strong>{ch.sender_id || '—'}</strong>
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        Status: <strong style={{ color: ch.is_active ? '#16a34a' : '#dc2626' }}>{ch.is_active ? 'Active' : 'Disabled'}</strong>
                      </Typography>
                    </Box>

                    <Button
                      fullWidth
                      variant="outlined"
                      size="small"
                      startIcon={<SettingsIcon />}
                      onClick={() => openChannelModal(ch)}
                      sx={{ textTransform: 'none', fontWeight: 700 }}
                    >
                      Configure Provider
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Box>
        )}
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deleteConfirmRec)} onClose={() => setDeleteConfirmRec(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a' }}>Confirm Contact Removal</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Remove <strong>{deleteConfirmRec?.name}</strong> from automatic WhatsApp &amp; notification alerts?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteConfirmRec(null)} color="inherit">Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDeleteRecipient} sx={{ fontWeight: 700 }}>
            Delete Contact
          </Button>
        </DialogActions>
      </Dialog>

      {/* Acknowledgment Modal */}
      <Dialog open={ackModalOpen} onClose={() => setAckModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#1e3a8a', borderBottom: '1px solid #e2e8f0' }}>
          Confirm &amp; Acknowledge Transaction
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          {selectedItemForAck && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  {selectedItemForAck.reference_module} Transaction
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                  {selectedItemForAck.title}
                </Typography>
                <Typography variant="body2" sx={{ color: '#475569', mt: 0.5 }}>
                  {selectedItemForAck.message}
                </Typography>
              </Box>

              <TextField
                label="Acknowledging Person Name / Role"
                fullWidth
                size="small"
                value={ackPersonName}
                onChange={(e) => setAckPersonName(e.target.value)}
              />

              <TextField
                label="Review Notes (Optional)"
                fullWidth
                multiline
                rows={2}
                size="small"
                value={ackRemarks}
                onChange={(e) => setAckRemarks(e.target.value)}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0' }}>
          <Button onClick={() => setAckModalOpen(false)} color="inherit">Cancel</Button>
          <Button variant="contained" onClick={submitAcknowledgment} sx={{ backgroundColor: '#1e3a8a', fontWeight: 700 }}>
            Confirm Acknowledgment
          </Button>
        </DialogActions>
      </Dialog>

      {/* Recipient Add/Edit Modal */}
      <Dialog open={recipientModalOpen} onClose={() => setRecipientModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#1e3a8a' }}>
          {editingRecipient ? 'Edit WhatsApp / Notification Recipient' : 'Add Client or Team WhatsApp Recipient'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              <TextField
                label="Contact / Client Name"
                fullWidth
                size="small"
                value={recipientForm.name}
                onChange={(e) => setRecipientForm({ ...recipientForm, name: e.target.value })}
                placeholder="e.g. XYZ Wholesale Traders"
              />

              <TextField
                select
                label="Contact Category / Role"
                fullWidth
                size="small"
                value={recipientForm.role}
                onChange={(e) => setRecipientForm({ ...recipientForm, role: e.target.value })}
                SelectProps={{ native: true }}
              >
                <option value="Client / Customer">Client / Customer</option>
                <option value="Supplier / Vendor">Supplier / Vendor</option>
                <option value="Owner">Owner</option>
                <option value="Manager">General Manager</option>
                <option value="Factory In-charge">Factory In-charge</option>
                <option value="Purchase Manager">Purchase Manager</option>
                <option value="Sales Manager">Sales Manager</option>
                <option value="Accounts">Accounts Department</option>
                <option value="QC">Quality Control</option>
              </TextField>
            </Box>

            <TextField
              label="Description / Purpose"
              fullWidth
              multiline
              rows={2}
              size="small"
              value={recipientForm.description}
              onChange={(e) => setRecipientForm({ ...recipientForm, description: e.target.value })}
              placeholder="e.g. Chennai Distributor — receives daily Sales, Sales Return & Godown Transfer alerts"
            />

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              <TextField
                label="WhatsApp / Mobile Number"
                fullWidth
                size="small"
                value={recipientForm.phone}
                onChange={(e) => setRecipientForm({ ...recipientForm, phone: e.target.value })}
                placeholder="+91 98765 43210"
                helperText="Include country code or 10-digit number"
              />
              <TextField
                label="Email Address (Optional)"
                fullWidth
                size="small"
                value={recipientForm.email}
                onChange={(e) => setRecipientForm({ ...recipientForm, email: e.target.value })}
                placeholder="client@company.com"
              />
            </Box>

            <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 0.5 }}>
              Delivery Channels
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={recipientForm.whatsapp_enabled}
                    onChange={(e) => setRecipientForm({ ...recipientForm, whatsapp_enabled: e.target.checked })}
                    size="small"
                  />
                }
                label="WhatsApp"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={recipientForm.sms_enabled}
                    onChange={(e) => setRecipientForm({ ...recipientForm, sms_enabled: e.target.checked })}
                    size="small"
                  />
                }
                label="SMS"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={recipientForm.email_enabled}
                    onChange={(e) => setRecipientForm({ ...recipientForm, email_enabled: e.target.checked })}
                    size="small"
                  />
                }
                label="Email"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={recipientForm.in_app_enabled}
                    onChange={(e) => setRecipientForm({ ...recipientForm, in_app_enabled: e.target.checked })}
                    size="small"
                  />
                }
                label="In-App"
              />
            </Box>

            <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={recipientForm.notify_all}
                    onChange={(e) => setRecipientForm({ ...recipientForm, notify_all: e.target.checked })}
                    size="small"
                  />
                }
                label={
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    Subscribe to All Application Entries
                  </Typography>
                }
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Or customize entry notifications individually below:
              </Typography>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 0.5 }}>
                <FormControlLabel
                  control={<Switch size="small" disabled={recipientForm.notify_all} checked={recipientForm.notify_all || recipientForm.notify_purchase} onChange={(e) => setRecipientForm({ ...recipientForm, notify_purchase: e.target.checked })} />}
                  label={<Typography variant="caption" sx={{ fontWeight: 600 }}>Purchase</Typography>}
                />
                <FormControlLabel
                  control={<Switch size="small" disabled={recipientForm.notify_all} checked={recipientForm.notify_all || recipientForm.notify_purchase_return} onChange={(e) => setRecipientForm({ ...recipientForm, notify_purchase_return: e.target.checked })} />}
                  label={<Typography variant="caption" sx={{ fontWeight: 600 }}>Purchase Return</Typography>}
                />
                <FormControlLabel
                  control={<Switch size="small" disabled={recipientForm.notify_all} checked={recipientForm.notify_all || recipientForm.notify_sales} onChange={(e) => setRecipientForm({ ...recipientForm, notify_sales: e.target.checked })} />}
                  label={<Typography variant="caption" sx={{ fontWeight: 600 }}>Sales &amp; Export</Typography>}
                />
                <FormControlLabel
                  control={<Switch size="small" disabled={recipientForm.notify_all} checked={recipientForm.notify_all || recipientForm.notify_sales_return} onChange={(e) => setRecipientForm({ ...recipientForm, notify_sales_return: e.target.checked })} />}
                  label={<Typography variant="caption" sx={{ fontWeight: 600 }}>Sales Return</Typography>}
                />
                <FormControlLabel
                  control={<Switch size="small" disabled={recipientForm.notify_all} checked={recipientForm.notify_all || recipientForm.notify_godown_transfer} onChange={(e) => setRecipientForm({ ...recipientForm, notify_godown_transfer: e.target.checked })} />}
                  label={<Typography variant="caption" sx={{ fontWeight: 600 }}>Godown &amp; Item Transfer</Typography>}
                />
                <FormControlLabel
                  control={<Switch size="small" disabled={recipientForm.notify_all} checked={recipientForm.notify_all || recipientForm.notify_production} onChange={(e) => setRecipientForm({ ...recipientForm, notify_production: e.target.checked })} />}
                  label={<Typography variant="caption" sx={{ fontWeight: 600 }}>Production / CS / Stock</Typography>}
                />
                <FormControlLabel
                  control={<Switch size="small" disabled={recipientForm.notify_all} checked={recipientForm.notify_all || recipientForm.notify_vouchers} onChange={(e) => setRecipientForm({ ...recipientForm, notify_vouchers: e.target.checked })} />}
                  label={<Typography variant="caption" sx={{ fontWeight: 600 }}>Vouchers / Advances / Orders</Typography>}
                />
                <FormControlLabel
                  control={<Switch size="small" disabled={recipientForm.notify_all} checked={recipientForm.notify_all || recipientForm.notify_outpass} onChange={(e) => setRecipientForm({ ...recipientForm, notify_outpass: e.target.checked })} />}
                  label={<Typography variant="caption" sx={{ fontWeight: 600 }}>Outpass Dispatched</Typography>}
                />
                <FormControlLabel
                  control={<Switch size="small" disabled={recipientForm.notify_all} checked={recipientForm.notify_all || recipientForm.notify_inpass} onChange={(e) => setRecipientForm({ ...recipientForm, notify_inpass: e.target.checked })} />}
                  label={<Typography variant="caption" sx={{ fontWeight: 600 }}>Inpass Received</Typography>}
                />
                <FormControlLabel
                  control={<Switch size="small" disabled={recipientForm.notify_all} checked={recipientForm.notify_all || recipientForm.notify_qc} onChange={(e) => setRecipientForm({ ...recipientForm, notify_qc: e.target.checked })} />}
                  label={<Typography variant="caption" sx={{ fontWeight: 600 }}>Quality Control</Typography>}
                />
              </Box>
            </Box>

            {editingRecipient && (
              <FormControlLabel
                control={
                  <Switch
                    checked={recipientForm.is_active}
                    onChange={(e) => setRecipientForm({ ...recipientForm, is_active: e.target.checked })}
                    size="small"
                  />
                }
                label="Contact Active"
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0' }}>
          <Button onClick={() => setRecipientModalOpen(false)} color="inherit">Cancel</Button>
          <Button variant="contained" onClick={saveRecipient} sx={{ backgroundColor: '#1f4fb2', fontWeight: 700 }}>
            Save Recipient
          </Button>
        </DialogActions>
      </Dialog>

      {/* Template Edit Modal */}
      <Dialog open={templateModalOpen} onClose={() => setTemplateModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#1e3a8a' }}>
          Edit {editingTemplate?.event_type} Template ({editingTemplate?.channel})
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Alert severity="info" sx={{ fontSize: 12 }}>
              Variables: <code>{'{{company_name}}'}</code>, <code>{'{{reference_no}}'}</code>, <code>{'{{supplier}}'}</code>, <code>{'{{customer}}'}</code>, <code>{'{{party_name}}'}</code>, <code>{'{{item_summary}}'}</code>, <code>{'{{quantity}}'}</code>, <code>{'{{bags}}'}</code>, <code>{'{{amount_display}}'}</code>, <code>{'{{godown}}'}</code>, <code>{'{{from_location}}'}</code>, <code>{'{{to_location}}'}</code>, <code>{'{{vehicle}}'}</code>, <code>{'{{date}}'}</code>, <code>{'{{remarks}}'}</code>
            </Alert>
            <TextField
              multiline
              rows={12}
              fullWidth
              value={templateBodyDraft}
              onChange={(e) => setTemplateBodyDraft(e.target.value)}
              sx={{ fontFamily: 'monospace', fontSize: 13 }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setTemplateModalOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveTemplate} sx={{ fontWeight: 700, backgroundColor: '#1e3a8a' }}>
            Save Template
          </Button>
        </DialogActions>
      </Dialog>

      {/* Channel Provider Modal */}
      <Dialog open={channelModalOpen} onClose={() => setChannelModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#1e3a8a' }}>
          Configure {editingChannel?.channel} Gateway Provider
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {editingChannel?.channel === 'WHATSAPP' && (
              <Alert severity="info" sx={{ fontSize: 12.5, borderRadius: 2 }}>
                Note: When your <strong>Main Company WhatsApp</strong> is linked in Tab 1, messages send automatically without Meta API credentials. You can optionally configure Meta Cloud API here as an enterprise fallback.
              </Alert>
            )}

            <TextField
              label="Provider Name"
              fullWidth
              size="small"
              value={channelForm.provider_name}
              onChange={(e) => setChannelForm({ ...channelForm, provider_name: e.target.value })}
            />
            <TextField
              label={editingChannel?.channel === 'EMAIL' ? 'SMTP Host & Port (e.g. smtp.gmail.com:587)' : 'API Endpoint / Base URL'}
              fullWidth
              size="small"
              value={channelForm.api_endpoint}
              onChange={(e) => setChannelForm({ ...channelForm, api_endpoint: e.target.value })}
            />
            <TextField
              label={editingChannel?.channel === 'EMAIL' ? 'Sender Email / SMTP Username' : 'Sender ID / Phone Number ID'}
              fullWidth
              size="small"
              value={channelForm.sender_id}
              onChange={(e) => setChannelForm({ ...channelForm, sender_id: e.target.value })}
            />
            <TextField
              label="API Access Token / SMTP App Password"
              fullWidth
              type="password"
              size="small"
              value={channelForm.auth_token}
              onChange={(e) => setChannelForm({ ...channelForm, auth_token: e.target.value })}
              helperText="Leave blank to retain existing saved token."
            />
            <FormControlLabel
              control={
                <Switch
                  checked={channelForm.test_mode}
                  onChange={(e) => setChannelForm({ ...channelForm, test_mode: e.target.checked })}
                />
              }
              label={channelForm.test_mode ? 'Sandbox Mode Enabled (Simulated Logging)' : 'Live Gateway Mode Active'}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={channelForm.is_active}
                  onChange={(e) => setChannelForm({ ...channelForm, is_active: e.target.checked })}
                />
              }
              label="Enable Channel"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0' }}>
          <Button onClick={() => setChannelModalOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveChannel} sx={{ fontWeight: 700, backgroundColor: '#1e3a8a' }}>
            Save Configuration
          </Button>
        </DialogActions>
      </Dialog>

      {/* Single Recipient Direct Test Modal */}
      <Dialog open={recipientTestModalOpen} onClose={() => setRecipientTestModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#1e3a8a' }}>
          Test Alert to {selectedRecipientForTest?.name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {selectedRecipientForTest?.name} ({selectedRecipientForTest?.role})
              </Typography>
              {selectedRecipientForTest?.description && (
                <Typography variant="caption" sx={{ display: 'block', color: '#475569' }}>
                  {selectedRecipientForTest.description}
                </Typography>
              )}
              <Typography variant="caption" sx={{ display: 'block', color: '#64748b', fontFamily: 'monospace', mt: 0.4 }}>
                WhatsApp: {selectedRecipientForTest?.phone_raw || selectedRecipientForTest?.phone || 'Not set'}
              </Typography>
            </Box>

            <TextField
              select
              label="Entry Event Type"
              fullWidth
              size="small"
              value={recipientTestModule}
              onChange={(e) => setRecipientTestModule(e.target.value)}
              SelectProps={{ native: true }}
            >
              {MODULE_OPTIONS.filter((o) => o.value !== 'ALL').map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRecipientTestModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            disabled={sendingTest}
            onClick={dispatchSingleRecipientTest}
            startIcon={sendingTest ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
            sx={{ fontWeight: 700 }}
          >
            {sendingTest ? 'Sending...' : 'Send Test Alert'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Test Result Preview Modal */}
      <Dialog open={testResultModalOpen} onClose={() => setTestResultModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleIcon color="success" />
          {testResultData?.title || 'Notification Dispatched'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#f0fdf4', borderColor: '#86efac' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WhatsAppIcon sx={{ color: '#16a34a' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#166534' }}>
                    WhatsApp Message Content
                  </Typography>
                </Box>

                {(() => {
                  const targetPhone = testResultData?.phone || testResultData?.deliveryResults?.find((d) => d.phone)?.phone || '';
                  const cleanDigits = targetPhone.replace(/\D/g, '');
                  const waUrl =
                    cleanDigits.length >= 10 && !targetPhone.includes('X') && !targetPhone.includes('x')
                      ? `https://api.whatsapp.com/send?phone=${cleanDigits}&text=${encodeURIComponent(testResultData?.formattedWhatsAppMsg || '')}`
                      : null;

                  return (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          navigator.clipboard?.writeText(testResultData?.formattedWhatsAppMsg || '');
                          showToast('info', 'WhatsApp message copied to clipboard.');
                        }}
                        sx={{ textTransform: 'none', fontWeight: 700, fontSize: 11, borderColor: '#86efac', color: '#166534' }}
                      >
                        Copy Text
                      </Button>
                      {waUrl && (
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          startIcon={<WhatsAppIcon sx={{ fontSize: 14 }} />}
                          sx={{ textTransform: 'none', fontWeight: 800, fontSize: 12, bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' } }}
                        >
                          Open WhatsApp Web
                        </Button>
                      )}
                    </Box>
                  );
                })()}
              </Box>

              <Box
                sx={{
                  p: 2,
                  bgcolor: '#ffffff',
                  borderRadius: 1.5,
                  border: '1px solid #bbf7d0',
                  fontFamily: 'monospace',
                  fontSize: 12.5,
                  whiteSpace: 'pre-wrap',
                  color: '#1e293b',
                  lineHeight: 1.5,
                  maxHeight: 260,
                  overflowY: 'auto'
                }}
              >
                {testResultData?.formattedWhatsAppMsg || 'No WhatsApp template content generated.'}
              </Box>
            </Paper>

            {testResultData?.formattedSmsMsg && (
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#f8fafc' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                  <SmsIcon sx={{ color: '#2563eb' }} fontSize="small" />
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e3a8a' }}>
                    SMS Text Preview
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12, color: '#334155' }}>
                  {testResultData.formattedSmsMsg}
                </Typography>
              </Paper>
            )}

            {testResultData?.deliveryResults && testResultData.deliveryResults.length > 0 && (
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#475569', display: 'block', mb: 0.75 }}>
                  CHANNEL DELIVERY RESULTS:
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {testResultData.deliveryResults.map((dr, i) => {
                    const ok = String(dr.status || '').includes('DELIVERED') || String(dr.status || '').includes('SENT');
                    return (
                      <StatusTag
                        key={i}
                        label={`${dr.channel}: ${dr.status} (${dr.recipient})`}
                        tone={ok ? 'success' : 'warning'}
                      />
                    );
                  })}
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0' }}>
          <Button variant="contained" onClick={() => setTestResultModalOpen(false)} sx={{ backgroundColor: '#1f4fb2', fontWeight: 700 }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* In-App Toast Notification */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4500}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          severity={toast.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {toast.text}
        </Alert>
      </Snackbar>
    </Box>
  );
}
