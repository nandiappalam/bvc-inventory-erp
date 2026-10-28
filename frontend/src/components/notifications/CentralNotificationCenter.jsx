import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Tabs,
  Tab,
  Button,
  Chip,
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
  Tooltip,
  Badge,
  CircularProgress
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
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import MoveToInboxIcon from '@mui/icons-material/MoveToInbox';
import ScienceIcon from '@mui/icons-material/Science';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import SettingsIcon from '@mui/icons-material/Settings';
import DescriptionIcon from '@mui/icons-material/Description';
import ReplayIcon from '@mui/icons-material/Replay';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import axios from 'axios';

export default function CentralNotificationCenter() {
  const navigate = useNavigate();
  const [tabIndex, setTabIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [deliveryLogs, setDeliveryLogs] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [channels, setChannels] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingConfirmations, setPendingConfirmations] = useState(0);
  const [unmaskPhone, setUnmaskPhone] = useState(false);

  // Filter states
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [channelFilter, setChannelFilter] = useState('ALL');

  // Acknowledgment dialog
  const [ackModalOpen, setAckModalOpen] = useState(false);
  const [selectedItemForAck, setSelectedItemForAck] = useState(null);
  const [ackPersonName, setAckPersonName] = useState('Owner / General Manager');
  const [ackRemarks, setAckRemarks] = useState('');

  // Recipient form dialog
  const [recipientModalOpen, setRecipientModalOpen] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState(null);
  const [recipientForm, setRecipientForm] = useState({
    name: '',
    role: 'Factory In-charge',
    phone: '',
    email: '',
    whatsapp_enabled: true,
    sms_enabled: true,
    email_enabled: false,
    in_app_enabled: true,
    notify_purchase: true,
    notify_sales: true,
    notify_outpass: true,
    notify_inpass: true,
    notify_qc: true,
    notify_vehicle_loading: true
  });

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

  // Test simulation dialog
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testModule, setTestModule] = useState('OUTPASS');
  const [testRefNo, setTestRefNo] = useState('OP-00021');

  // Single recipient test alert dialog
  const [recipientTestModalOpen, setRecipientTestModalOpen] = useState(false);
  const [selectedRecipientForTest, setSelectedRecipientForTest] = useState(null);
  const [recipientTestModule, setRecipientTestModule] = useState('OUTPASS');

  // Test Result preview dialog
  const [testResultModalOpen, setTestResultModalOpen] = useState(false);
  const [testResultData, setTestResultData] = useState(null);
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    loadAllData();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      loadLiveSummary();
    }, 60000); // 60s auto-refresh with tab visibility check
    return () => clearInterval(interval);
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      loadLiveSummary(),
      loadLiveActivities(),
      loadDeliveryLogs(),
      loadRecipients(),
      loadTemplates(),
      loadChannels()
    ]);
    setLoading(false);
  };

  const loadLiveSummary = async () => {
    try {
      const res = await axios.get('/api/central-notifications/live');
      if (res.data.success) {
        setUnreadCount(res.data.count || 0);
        setPendingConfirmations(res.data.pendingConfirmations || 0);
        setLiveAlerts(res.data.alerts || []);
      }
    } catch (e) {}
  };

  const loadLiveActivities = async () => {
    try {
      const res = await axios.get('/api/central-notifications/live-activity');
      if (res.data.success) {
        setActivities(res.data.activities || []);
      }
    } catch (e) {}
  };

  const loadDeliveryLogs = async () => {
    try {
      const res = await axios.get(`/api/central-notifications/delivery-logs?unmask=${unmaskPhone}`);
      if (res.data.success) {
        setDeliveryLogs(res.data.logs || []);
      }
    } catch (e) {}
  };

  const loadRecipients = async () => {
    try {
      const res = await axios.get(`/api/central-notifications/recipients?unmask=${unmaskPhone}`);
      if (res.data.success) {
        setRecipients(res.data.recipients || []);
      }
    } catch (e) {}
  };

  const loadTemplates = async () => {
    try {
      const res = await axios.get('/api/central-notifications/templates');
      if (res.data.success) {
        setTemplates(res.data.templates || []);
      }
    } catch (e) {}
  };

  const loadChannels = async () => {
    try {
      const res = await axios.get('/api/central-notifications/channels');
      if (res.data.success) {
        setChannels(res.data.channels || []);
      }
    } catch (e) {}
  };

  const handleMarkAllRead = async () => {
    try {
      await axios.post('/api/central-notifications/mark-all-read');
      loadAllData();
    } catch (e) {}
  };

  const openAckDialog = (item) => {
    setSelectedItemForAck(item);
    setAckPersonName('Owner / General Manager');
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
    } catch (e) {
      alert('Error recording acknowledgment: ' + (e.response?.data?.message || e.message));
    }
  };

  const retryLog = async (logId) => {
    try {
      const res = await axios.post(`/api/central-notifications/retry/${logId}`);
      if (res.data.success) {
        loadDeliveryLogs();
      }
    } catch (e) {
      alert(e.response?.data?.message || 'Retry failed');
    }
  };

  const openRecipientModal = (rec = null) => {
    if (rec) {
      setEditingRecipient(rec);
      setRecipientForm({
        name: rec.name || '',
        role: rec.role || 'Manager',
        phone: rec.phone_raw || rec.phone || '',
        email: rec.email || '',
        whatsapp_enabled: Boolean(rec.whatsapp_enabled),
        sms_enabled: Boolean(rec.sms_enabled),
        email_enabled: Boolean(rec.email_enabled),
        in_app_enabled: Boolean(rec.in_app_enabled),
        notify_purchase: Boolean(rec.notify_purchase),
        notify_sales: Boolean(rec.notify_sales),
        notify_outpass: Boolean(rec.notify_outpass),
        notify_inpass: Boolean(rec.notify_inpass),
        notify_qc: Boolean(rec.notify_qc),
        notify_vehicle_loading: Boolean(rec.notify_vehicle_loading)
      });
    } else {
      setEditingRecipient(null);
      setRecipientForm({
        name: '',
        role: 'Factory In-charge',
        phone: '+91 98XXX XXXXX',
        email: '',
        whatsapp_enabled: true,
        sms_enabled: true,
        email_enabled: false,
        in_app_enabled: true,
        notify_purchase: true,
        notify_sales: true,
        notify_outpass: true,
        notify_inpass: true,
        notify_qc: true,
        notify_vehicle_loading: true
      });
    }
    setRecipientModalOpen(true);
  };

  const openSingleRecipientTest = (rec) => {
    setSelectedRecipientForTest(rec);
    if (rec.notify_outpass) setRecipientTestModule('OUTPASS');
    else if (rec.notify_purchase) setRecipientTestModule('PURCHASE');
    else if (rec.notify_sales) setRecipientTestModule('SALES');
    else if (rec.notify_inpass) setRecipientTestModule('INPASS');
    else setRecipientTestModule('OUTPASS');
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
      alert('Error triggering test alert: ' + (e.response?.data?.message || e.message));
    } finally {
      setSendingTest(false);
    }
  };

  const saveRecipient = async () => {
    try {
      if (editingRecipient) {
        await axios.put(`/api/central-notifications/recipients/${editingRecipient.id}`, recipientForm);
      } else {
        await axios.post('/api/central-notifications/recipients', recipientForm);
      }
      setRecipientModalOpen(false);
      loadRecipients();
    } catch (e) {
      alert('Error saving recipient: ' + (e.response?.data?.message || e.message));
    }
  };

  const deleteRecipient = async (id) => {
    const confirmed = window.__appConfirm ? await window.__appConfirm({
      title: 'Confirm Contact Deletion',
      message: 'Are you sure you want to remove this notification contact?',
      confirmText: 'Delete Contact',
      confirmColor: 'error'
    }) : window.confirm('Are you sure you want to remove this notification contact?');
    if (!confirmed) return;
    try {
      await axios.delete(`/api/central-notifications/recipients/${id}`);
      loadRecipients();
    } catch (e) {
      alert('Error deleting recipient: ' + (e.response?.data?.message || e.message));
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
    } catch (e) {
      alert('Error saving template: ' + (e.response?.data?.message || e.message));
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
    } catch (e) {
      alert('Error saving channel: ' + (e.response?.data?.message || e.message));
    }
  };

  const triggerTestAlert = async () => {
    setSendingTest(true);
    try {
      const res = await axios.post('/api/central-notifications/test-send', {
        moduleName: testModule,
        referenceNo: testRefNo
      });
      if (res.data.success) {
        setTestModalOpen(false);
        setTestResultData({
          title: `Broadcast Test Notification Dispatched (${testModule})`,
          moduleName: testModule,
          referenceNo: testRefNo,
          recipientCount: res.data.recipientCount,
          formattedWhatsAppMsg: res.data.formattedWhatsAppMsg,
          formattedSmsMsg: res.data.formattedSmsMsg,
          deliveryResults: res.data.deliveryResults
        });
        setTestResultModalOpen(true);
        loadAllData();
      }
    } catch (e) {
      alert('Error sending test notification: ' + (e.response?.data?.message || e.message));
    } finally {
      setSendingTest(false);
    }
  };

  const navigateToModule = (moduleName, refNo) => {
    const mod = (moduleName || '').toUpperCase();
    if (mod.includes('OUTPASS')) navigate('/entry/outpass-display');
    else if (mod.includes('INPASS')) navigate('/entry/inpass-display');
    else if (mod.includes('PURCHASE')) navigate('/entry/purchase-display');
    else if (mod.includes('SALES')) navigate('/entry/sales-display');
    else if (mod.includes('QC')) navigate('/entry/quality-control-list');
    else navigate('/command-center');
  };

  // Filtered Activities
  const filteredActivities = activities.filter(act => {
    if (moduleFilter === 'ALL') return true;
    const m = (act.reference_module || act.module_name || '').toUpperCase();
    return m.includes(moduleFilter);
  });

  const filteredLogs = deliveryLogs.filter(log => {
    if (channelFilter !== 'ALL' && log.channel !== channelFilter) return false;
    if (moduleFilter !== 'ALL' && !(log.module_name || '').includes(moduleFilter)) return false;
    return true;
  });

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Title Bar in BVC Theme */}
      <Box sx={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #1e3a8a 0%, #1f4fb2 50%, #2563eb 100%)',
        color: '#ffffff',
        p: 2.5,
        borderRadius: 2,
        boxShadow: '0 4px 14px rgba(31, 79, 178, 0.25)',
        mb: 3
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <NotificationsActiveIcon sx={{ fontSize: 36, color: '#93c5fd' }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '0.5px' }}>
              Central Factory Communication & Notification Center
            </Typography>
            <Typography variant="body2" sx={{ color: '#dbeafe', mt: 0.3 }}>
              Automated WhatsApp, SMS, Email & In-App Dispatch Workflow for Inpass, Outpass, Purchases & Sales
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, mt: { xs: 2, sm: 0 }, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            size="small"
            onClick={loadAllData}
            startIcon={<RefreshIcon />}
            sx={{
              backgroundColor: 'rgba(255,255,255,0.18)',
              backdropFilter: 'blur(4px)',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.3)' }
            }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={() => setTestModalOpen(true)}
            startIcon={<SendIcon />}
            sx={{
              backgroundColor: '#10b981',
              fontWeight: 700,
              '&:hover': { backgroundColor: '#059669' }
            }}
          >
            Send Test Alert
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={handleMarkAllRead}
            startIcon={<DoneAllIcon />}
            sx={{
              backgroundColor: 'rgba(255,255,255,0.18)',
              backdropFilter: 'blur(4px)',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.3)' }
            }}
          >
            Mark All Read
          </Button>
        </Box>
      </Box>

      {/* KPI Overview Tiles */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
        <Card sx={{ borderLeft: '4px solid #3b82f6', borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <CardContent sx={{ p: 2 }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Unread Alerts
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#1e3a8a' }}>
                {unreadCount}
              </Typography>
              <Chip label="Live Feed" size="small" color="primary" sx={{ height: 20, fontSize: 11 }} />
            </Box>
            <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.5 }}>
              Real-time factory events
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ borderLeft: '4px solid #f59e0b', borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <CardContent sx={{ p: 2 }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Pending Confirmations
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#b45309' }}>
                {pendingConfirmations}
              </Typography>
              <Chip label="Requires Ack" size="small" color="warning" sx={{ height: 20, fontSize: 11 }} />
            </Box>
            <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.5 }}>
              Awaiting owner/manager review
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ borderLeft: '4px solid #10b981', borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <CardContent sx={{ p: 2 }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Outbound Delivery Logs
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#047857' }}>
                {deliveryLogs.length}
              </Typography>
              <Chip label="WhatsApp/SMS/InApp" size="small" color="success" sx={{ height: 20, fontSize: 11 }} />
            </Box>
            <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.5 }}>
              Tracked message dispatches
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ borderLeft: '4px solid #8b5cf6', borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <CardContent sx={{ p: 2 }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Registered Stakeholders
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#6d28d9' }}>
                {recipients.filter(r => r.is_active).length}
              </Typography>
              <Chip label="Configured" size="small" sx={{ height: 20, fontSize: 11, backgroundColor: '#ede9fe', color: '#6d28d9', fontWeight: 700 }} />
            </Box>
            <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.5 }}>
              Owners, Managers & In-charge
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Main Tabs Navigation */}
      <Paper sx={{ borderRadius: 2, mb: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <Tabs
          value={tabIndex}
          onChange={(e, val) => setTabIndex(val)}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            borderBottom: '1px solid #e2e8f0',
            px: 2,
            '& .MuiTab-root': { fontWeight: 700, py: 1.8 }
          }}
        >
          <Tab label="Factory Live Activity (Chronological)" />
          <Tab label={`Pending Confirmations (${pendingConfirmations})`} />
          <Tab label="Communication Audit & Delivery Logs" />
          <Tab label="Recipient & Event Routing Matrix" />
          <Tab label="Message Templates" icon={<DescriptionIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
          <Tab label="Channel & Provider Settings" icon={<SettingsIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
        </Tabs>

        {/* TAB 0: Factory Live Activity Stream */}
        {tabIndex === 0 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                  Live Factory Movement Stream
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Complete sequence of Outpass, Inpass, Purchases and Sales occurring inside the factory
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b' }}>
                  Filter Module:
                </Typography>
                {['ALL', 'OUTPASS', 'INPASS', 'PURCHASE', 'SALES'].map(m => (
                  <Chip
                    key={m}
                    label={m}
                    size="small"
                    clickable
                    color={moduleFilter === m ? 'primary' : 'default'}
                    onClick={() => setModuleFilter(m)}
                    sx={{ fontWeight: 700, fontSize: 11 }}
                  />
                ))}
              </Box>
            </Box>

            {filteredActivities.length === 0 ? (
              <Alert severity="info" sx={{ mt: 2 }}>
                No recent factory activity recorded for this filter.
              </Alert>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2 }}>
                {filteredActivities.map((act) => {
                  const isAck = act.acknowledged === 1;
                  return (
                    <Paper
                      key={act.id}
                      variant="outlined"
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { sm: 'center' },
                        justifyContent: 'space-between',
                        gap: 2,
                        borderLeft: act.reference_module === 'OUTPASS'
                          ? '5px solid #2563eb'
                          : act.reference_module === 'INPASS'
                            ? '5px solid #059669'
                            : act.reference_module === 'PURCHASE'
                              ? '5px solid #16a34a'
                              : '5px solid #d97706',
                        backgroundColor: isAck ? '#ffffff' : '#f8fafc'
                      }}
                    >
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                        <Box sx={{ mt: 0.5 }}>
                          {act.reference_module === 'OUTPASS' && <LocalShippingIcon sx={{ color: '#2563eb', fontSize: 28 }} />}
                          {act.reference_module === 'INPASS' && <MoveToInboxIcon sx={{ color: '#059669', fontSize: 28 }} />}
                          {act.reference_module === 'PURCHASE' && <ShoppingCartIcon sx={{ color: '#16a34a', fontSize: 28 }} />}
                          {act.reference_module === 'SALES' && <PointOfSaleIcon sx={{ color: '#d97706', fontSize: 28 }} />}
                        </Box>
                        <Box>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                            <Chip
                              label={act.reference_module || 'OPERATION'}
                              size="small"
                              sx={{ fontWeight: 800, fontSize: 10, height: 20 }}
                            />
                            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                              {act.title}
                            </Typography>
                            {isAck ? (
                              <Chip
                                icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />}
                                label={`Acknowledged by ${act.acknowledged_by || 'Manager'}`}
                                size="small"
                                color="success"
                                variant="outlined"
                                sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
                              />
                            ) : (
                              <Chip
                                label="Awaiting Acknowledgment"
                                size="small"
                                color="warning"
                                sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
                              />
                            )}
                          </Box>
                          <Typography variant="body2" sx={{ color: '#334155', mt: 0.5 }}>
                            {act.message}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 2, mt: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                              Time: {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(act.created_at).toLocaleDateString()}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Chip icon={<WhatsAppIcon sx={{ fontSize: '12px !important' }} />} label="WhatsApp Sent" size="small" sx={{ height: 18, fontSize: 9 }} />
                              <Chip icon={<SmsIcon sx={{ fontSize: '12px !important' }} />} label="SMS Dispatched" size="small" sx={{ height: 18, fontSize: 9 }} />
                            </Box>
                          </Box>
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', gap: 1, alignSelf: { xs: 'flex-end', sm: 'center' } }}>
                        {!isAck && (
                          <Button
                            variant="outlined"
                            size="small"
                            color="primary"
                            onClick={() => openAckDialog(act)}
                            sx={{ fontWeight: 700, textTransform: 'none' }}
                          >
                            ✓ Acknowledge
                          </Button>
                        )}
                        <Button
                          variant="contained"
                          size="small"
                          endIcon={<OpenInNewIcon />}
                          onClick={() => navigateToModule(act.reference_module, act.reference_id)}
                          sx={{ backgroundColor: '#1e3a8a', fontWeight: 700, textTransform: 'none' }}
                        >
                          View Details
                        </Button>
                      </Box>
                    </Paper>
                  );
                })}
              </Box>
            )}
          </Box>
        )}

        {/* TAB 1: Pending Confirmations */}
        {tabIndex === 1 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
              Transactions Awaiting Official Management Acknowledgment
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Owner & Manager audit loop to confirm floor dispatches, receiving, and outside mill movements
            </Typography>

            {activities.filter(a => !a.acknowledged).length === 0 ? (
              <Alert severity="success" sx={{ mt: 2 }}>
                All transaction notifications have been acknowledged! No pending confirmations.
              </Alert>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {activities.filter(a => !a.acknowledged).map((act) => (
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
                      borderLeft: '5px solid #f59e0b'
                    }}
                  >
                    <Box>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Chip label={act.reference_module || 'TRANSACTION'} size="small" color="warning" sx={{ fontWeight: 800, fontSize: 10, height: 20 }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{act.title}</Typography>
                      </Box>
                      <Typography variant="body2" sx={{ mt: 0.5, color: '#451a03' }}>{act.message}</Typography>
                      <Typography variant="caption" sx={{ color: '#92400e', mt: 0.5, display: 'block' }}>
                        Logged: {new Date(act.created_at).toLocaleString()}
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
                        ✓ Acknowledge Record
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => navigateToModule(act.reference_module, act.reference_id)}
                        sx={{ fontWeight: 700, textTransform: 'none' }}
                      >
                        Review Transaction
                      </Button>
                    </Box>
                  </Paper>
                ))}
              </Box>
            )}
          </Box>
        )}

        {/* TAB 2: Communication Audit & Delivery Logs */}
        {tabIndex === 2 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                  Communication Audit & Delivery Logs
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Complete audit trail of all automated WhatsApp, SMS, Email and In-App messages sent to stakeholders
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={unmaskPhone}
                      onChange={(e) => {
                        setUnmaskPhone(e.target.checked);
                        setTimeout(loadAllData, 50);
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

                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                  {['ALL', 'WHATSAPP', 'SMS', 'EMAIL', 'IN_APP'].map(ch => (
                    <Chip
                      key={ch}
                      label={ch}
                      size="small"
                      clickable
                      color={channelFilter === ch ? 'primary' : 'default'}
                      onClick={() => setChannelFilter(ch)}
                      sx={{ fontWeight: 700, fontSize: 11 }}
                    />
                  ))}
                </Box>
              </Box>
            </Box>

            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>Time</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Event & Module</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Recipient</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Channel & Contact</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Message Content</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Delivery Status</TableCell>
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
                    filteredLogs.map((log) => (
                      <TableRow key={log.id} hover>
                        <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                          {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          <Typography variant="caption" sx={{ display: 'block', color: '#94a3b8' }}>
                            {new Date(log.created_at).toLocaleDateString()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>{log.event_type || log.module_name}</Typography>
                          <Typography variant="caption" sx={{ color: '#64748b' }}>{log.reference_no}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>{log.recipient_name}</Typography>
                          <Typography variant="caption" sx={{ color: '#64748b' }}>{log.recipient_role}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={log.channel}
                            size="small"
                            color={log.channel === 'WHATSAPP' ? 'success' : log.channel === 'SMS' ? 'primary' : log.channel === 'EMAIL' ? 'secondary' : 'default'}
                            sx={{ height: 20, fontSize: 10, fontWeight: 700, mb: 0.3 }}
                          />
                          <Typography variant="caption" sx={{ display: 'block', fontFamily: 'monospace' }}>
                            {log.recipient_contact}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ maxWidth: 320 }}>
                          <Typography variant="caption" sx={{ display: 'block', whiteSpace: 'pre-line', color: '#334155' }}>
                            {log.message_body?.length > 120 ? `${log.message_body.substring(0, 120)}...` : log.message_body}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={log.delivery_status || 'DELIVERED'}
                            size="small"
                            color={log.delivery_status === 'DELIVERED' ? 'success' : log.delivery_status === 'FAILED' ? 'error' : 'warning'}
                            sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
                          />
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
                            {log.delivery_status !== 'DELIVERED' && (
                              <IconButton size="small" onClick={() => retryLog(log.id)} title="Retry sending">
                                <ReplayIcon fontSize="small" />
                              </IconButton>
                            )}
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

        {/* TAB 3: Recipient & Role Notification Rules */}
        {tabIndex === 3 && (
          <Box sx={{ p: 3 }}>
            <Alert severity="info" sx={{ mb: 2.5, borderRadius: 2, fontSize: 13, border: '1px solid #bfdbfe' }}>
              <strong>Configurable Phone Numbers & Routing Matrix:</strong> Phone numbers default to placeholder format (<code>+91 98XXX XXXXX</code>). Click <strong>Edit</strong> on any stakeholder to enter their real WhatsApp / SMS phone number and save it. Click <strong>⚡ Test Alert</strong> on any contact to verify automated transaction dispatching immediately.
            </Alert>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                  Notification Recipient & Event Routing Matrix
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Configure phone numbers, email addresses, and event subscriptions per stakeholder role
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={unmaskPhone}
                      onChange={(e) => {
                        setUnmaskPhone(e.target.checked);
                        setTimeout(loadRecipients, 50);
                      }}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                      {unmaskPhone ? 'Show Full Phone' : 'Mask Phone'}
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
                  Add Recipient Contact
                </Button>
              </Box>
            </Box>

            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>Name & Role</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Phone / WhatsApp</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Channels Enabled</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Subscribed Events</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 800, textAlign: 'right' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recipients.map((rec) => (
                    <TableRow key={rec.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{rec.name}</Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>{rec.role}</Typography>
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <span>{rec.phone || '—'}</span>
                          {rec.phone && (rec.phone.includes('X') || rec.phone.includes('x')) && (
                            <Chip label="Placeholder" size="small" sx={{ height: 16, fontSize: 9, bgcolor: '#fef3c7', color: '#92400e', fontWeight: 700 }} />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, color: '#475569' }}>
                        {rec.email || '—'}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {rec.whatsapp_enabled === 1 && <Chip label="WhatsApp" size="small" color="success" sx={{ height: 18, fontSize: 9, fontWeight: 700 }} />}
                          {rec.sms_enabled === 1 && <Chip label="SMS" size="small" color="primary" sx={{ height: 18, fontSize: 9, fontWeight: 700 }} />}
                          {rec.email_enabled === 1 && <Chip label="Email" size="small" color="secondary" sx={{ height: 18, fontSize: 9, fontWeight: 700 }} />}
                          {rec.in_app_enabled === 1 && <Chip label="In-App" size="small" sx={{ height: 18, fontSize: 9, fontWeight: 700 }} />}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {rec.notify_purchase === 1 && <Chip label="Purchase" size="small" sx={{ height: 18, fontSize: 9 }} />}
                          {rec.notify_sales === 1 && <Chip label="Sales" size="small" sx={{ height: 18, fontSize: 9 }} />}
                          {rec.notify_outpass === 1 && <Chip label="Outpass" size="small" sx={{ height: 18, fontSize: 9 }} />}
                          {rec.notify_inpass === 1 && <Chip label="Inpass" size="small" sx={{ height: 18, fontSize: 9 }} />}
                          {rec.notify_qc === 1 && <Chip label="QC" size="small" sx={{ height: 18, fontSize: 9 }} />}
                          {rec.notify_vehicle_loading === 1 && <Chip label="Vehicle" size="small" sx={{ height: 18, fontSize: 9 }} />}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={rec.is_active ? 'Active' : 'Disabled'}
                          size="small"
                          color={rec.is_active ? 'success' : 'default'}
                          sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right' }}>
                        <Button
                          size="small"
                          variant="outlined"
                          color="success"
                          startIcon={<SendIcon sx={{ fontSize: 12 }} />}
                          onClick={() => openSingleRecipientTest(rec)}
                          sx={{ fontSize: 11, py: 0.3, px: 1, textTransform: 'none', fontWeight: 700, mr: 1 }}
                        >
                          Test Alert
                        </Button>
                        <IconButton size="small" onClick={() => openRecipientModal(rec)} title="Edit Configuration">
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => deleteRecipient(rec.id)} title="Delete Recipient">
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* TAB 4: Message Templates */}
        {tabIndex === 4 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                  Transaction Message Templates
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Customizable message templates for Purchase, Sales, Outpass and Inpass with dynamic variable replacement
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
              {templates.map((tpl) => (
                <Paper key={tpl.id} variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Chip
                        label={tpl.channel}
                        size="small"
                        color={tpl.channel === 'WHATSAPP' ? 'success' : 'primary'}
                        sx={{ fontWeight: 800, fontSize: 10 }}
                      />
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
                      Edit Template
                    </Button>
                  </Box>
                  <Box
                    component="pre"
                    sx={{
                      p: 2,
                      bgcolor: '#f8fafc',
                      borderRadius: 1.5,
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap',
                      maxHeight: 220,
                      overflowY: 'auto'
                    }}
                  >
                    {tpl.template_body}
                  </Box>
                </Paper>
              ))}
            </Box>
          </Box>
        )}

        {/* TAB 5: Channel & Provider Settings */}
        {tabIndex === 5 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
              Approved Notification Provider & Gateway Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Official Meta WhatsApp Business Cloud API, Enterprise SMS Gateway & SMTP Email integrations
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
                      <Chip
                        label={ch.test_mode ? 'Sandbox / Test' : 'Live Gateway'}
                        size="small"
                        color={ch.test_mode ? 'warning' : 'success'}
                        sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
                      />
                    </Box>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        Provider: <strong>{ch.provider_name}</strong>
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        Endpoint: <strong>{ch.api_endpoint || 'Default Provider URL'}</strong>
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        Sender / Account ID: <strong>{ch.sender_id || '-'}</strong>
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        Status: <strong style={{ color: ch.is_active ? '#16a34a' : '#dc2626' }}>{ch.is_active ? 'Active & Ready' : 'Disabled'}</strong>
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

      {/* Acknowledgment Confirmation Modal */}
      <Dialog open={ackModalOpen} onClose={() => setAckModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#1e3a8a', borderBottom: '1px solid #e2e8f0' }}>
          Confirm & Acknowledge Transaction
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          {selectedItemForAck && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Alert severity="info" sx={{ mt: 1 }}>
                Acknowledging creates a permanent verification record in the ERP audit log.
              </Alert>

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
                placeholder="e.g. Factory Owner, Plant Manager"
              />

              <TextField
                label="Review Notes / Instructions (Optional)"
                fullWidth
                multiline
                rows={2}
                size="small"
                value={ackRemarks}
                onChange={(e) => setAckRemarks(e.target.value)}
                placeholder="e.g. Verified unloading, approved for next grind cycle"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0' }}>
          <Button onClick={() => setAckModalOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button variant="contained" onClick={submitAcknowledgment} sx={{ backgroundColor: '#1e3a8a', fontWeight: 700 }}>
            Confirm Acknowledgment
          </Button>
        </DialogActions>
      </Dialog>

      {/* Recipient Add/Edit Modal */}
      <Dialog open={recipientModalOpen} onClose={() => setRecipientModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#1e3a8a' }}>
          {editingRecipient ? 'Edit Notification Contact' : 'Add Notification Contact'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Contact Full Name"
              fullWidth
              size="small"
              value={recipientForm.name}
              onChange={(e) => setRecipientForm({ ...recipientForm, name: e.target.value })}
              placeholder="e.g. Factory Owner, Plant Incharge"
            />

            <TextField
              select
              label="ERP Role Focus"
              fullWidth
              size="small"
              value={recipientForm.role}
              onChange={(e) => setRecipientForm({ ...recipientForm, role: e.target.value })}
              SelectProps={{ native: true }}
            >
              <option value="Owner">Owner</option>
              <option value="Manager">General Manager</option>
              <option value="Factory In-charge">Factory In-charge</option>
              <option value="Purchase Manager">Purchase Manager</option>
              <option value="Sales Manager">Sales Manager</option>
              <option value="QC">Quality Control Chemist</option>
              <option value="Accounts">Accounts Department</option>
            </TextField>

            <TextField
              label="Phone Number (WhatsApp & SMS)"
              fullWidth
              size="small"
              value={recipientForm.phone}
              onChange={(e) => setRecipientForm({ ...recipientForm, phone: e.target.value })}
              placeholder="e.g. +91 98421 11223"
            />

            <TextField
              label="Email Address (Optional)"
              fullWidth
              size="small"
              value={recipientForm.email}
              onChange={(e) => setRecipientForm({ ...recipientForm, email: e.target.value })}
              placeholder="e.g. manager@bvcexports.com"
            />

            <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1 }}>
              Channels to Dispatch
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
                label="ERP In-App"
              />
            </Box>

            <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1 }}>
              Subscribed Event Triggers
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={recipientForm.notify_purchase}
                    onChange={(e) => setRecipientForm({ ...recipientForm, notify_purchase: e.target.checked })}
                    size="small"
                  />
                }
                label="Purchase Created/Received"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={recipientForm.notify_sales}
                    onChange={(e) => setRecipientForm({ ...recipientForm, notify_sales: e.target.checked })}
                    size="small"
                  />
                }
                label="Sales Created/Dispatched"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={recipientForm.notify_outpass}
                    onChange={(e) => setRecipientForm({ ...recipientForm, notify_outpass: e.target.checked })}
                    size="small"
                  />
                }
                label="Outpass Dispatched"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={recipientForm.notify_inpass}
                    onChange={(e) => setRecipientForm({ ...recipientForm, notify_inpass: e.target.checked })}
                    size="small"
                  />
                }
                label="Inpass Material Received"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={recipientForm.notify_qc}
                    onChange={(e) => setRecipientForm({ ...recipientForm, notify_qc: e.target.checked })}
                    size="small"
                  />
                }
                label="QC Testing Completed"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={recipientForm.notify_vehicle_loading}
                    onChange={(e) => setRecipientForm({ ...recipientForm, notify_vehicle_loading: e.target.checked })}
                    size="small"
                  />
                }
                label="Vehicle Loading Movement"
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0' }}>
          <Button onClick={() => setRecipientModalOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={saveRecipient}
            sx={{ backgroundColor: '#1f4fb2', fontWeight: 700 }}
          >
            Save Contact
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
              Available variables: <code>{'{{purchase_no}}'}</code>, <code>{'{{sales_no}}'}</code>, <code>{'{{outpass_no}}'}</code>, <code>{'{{inpass_no}}'}</code>, <code>{'{{supplier}}'}</code>, <code>{'{{customer}}'}</code>, <code>{'{{quantity}}'}</code>, <code>{'{{bags}}'}</code>, <code>{'{{vehicle}}'}</code>, <code>{'{{godown}}'}</code>, <code>{'{{qc_status}}'}</code>, <code>{'{{date}}'}</code>
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
                <strong>How to get Meta WhatsApp Cloud API credentials:</strong><br />
                1. Go to <strong>developers.facebook.com</strong> & log in.<br />
                2. Go to <strong>My Apps → Create App → Other → Business</strong>.<br />
                3. Add <strong>WhatsApp</strong> product to the app.<br />
                4. Go to <strong>WhatsApp → API Setup</strong> to copy your <strong>Phone number ID</strong> and <strong>Temporary/Permanent Access Token</strong>.<br />
                5. Paste them below, uncheck <em>Test Mode</em>, and click <strong>Save Configuration</strong>.
              </Alert>
            )}

            {editingChannel?.channel === 'SMS' && (
              <Alert severity="info" sx={{ fontSize: 12.5, borderRadius: 2 }}>
                <strong>How to get instant SMS delivery to Indian mobile numbers:</strong><br />
                1. Create a free account on <strong>fast2sms.com</strong> (gives free test SMS credits).<br />
                2. Go to <strong>Dev API</strong> tab and copy your <strong>API Authorization Key</strong>.<br />
                3. Paste the API key into the <strong>API Access Token</strong> field below, set Sender ID to <code>q</code>, uncheck <em>Test Mode</em>, and save!
              </Alert>
            )}

            {editingChannel?.channel === 'EMAIL' && (
              <Alert severity="info" sx={{ fontSize: 12.5, borderRadius: 2 }}>
                <strong>How to configure Automated Email Gateway (SMTP / Gmail / Outlook):</strong><br />
                1. <strong>Gmail / Google Workspace</strong>: Use Host: <code>smtp.gmail.com:587</code>, Sender/Username: your email, Auth Token: <strong>Google 16-character App Password</strong> (from Google Account → Security → 2-Step Verification → App passwords).<br />
                2. <strong>Microsoft 365 / Outlook</strong>: Use Host: <code>smtp.office365.com:587</code> and your Microsoft 365 account credentials.<br />
                3. <strong>AWS SES / SendGrid / Custom SMTP</strong>: Enter your SMTP Host:Port, API Key / Username in Sender ID, and Secret Key in Auth Token. Uncheck <em>Test Mode</em> to send live emails!
              </Alert>
            )}

            {/* Quick Presets */}
            {editingChannel?.channel === 'EMAIL' && (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>Quick Presets:</Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setChannelForm({
                    ...channelForm,
                    provider_name: 'Gmail SMTP (Google Workspace)',
                    api_endpoint: 'smtp.gmail.com:587',
                    sender_id: 'alerts@bvcagro.com',
                    test_mode: false
                  })}
                  sx={{ textTransform: 'none', fontSize: 11, py: 0.2 }}
                >
                  ⚡ Gmail / Google Workspace
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setChannelForm({
                    ...channelForm,
                    provider_name: 'Microsoft 365 SMTP',
                    api_endpoint: 'smtp.office365.com:587',
                    sender_id: 'notifications@bvcagro.com',
                    test_mode: false
                  })}
                  sx={{ textTransform: 'none', fontSize: 11, py: 0.2 }}
                >
                  ⚡ Office 365
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setChannelForm({
                    ...channelForm,
                    provider_name: 'SendGrid SMTP Gateway',
                    api_endpoint: 'smtp.sendgrid.net:587',
                    sender_id: 'apikey',
                    test_mode: false
                  })}
                  sx={{ textTransform: 'none', fontSize: 11, py: 0.2 }}
                >
                  ⚡ SendGrid
                </Button>
              </Box>
            )}

            {editingChannel?.channel === 'SMS' && (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>Quick Presets:</Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setChannelForm({
                    ...channelForm,
                    provider_name: 'Fast2SMS (Quick SMS India)',
                    api_endpoint: 'https://www.fast2sms.com/dev/bulkV2',
                    sender_id: 'q',
                    test_mode: false
                  })}
                  sx={{ textTransform: 'none', fontSize: 11, py: 0.2 }}
                >
                  ⚡ Fast2SMS (India)
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setChannelForm({
                    ...channelForm,
                    provider_name: 'Twilio SMS Gateway',
                    api_endpoint: 'https://api.twilio.com',
                    sender_id: '+1234567890',
                    test_mode: false
                  })}
                  sx={{ textTransform: 'none', fontSize: 11, py: 0.2 }}
                >
                  Twilio
                </Button>
              </Box>
            )}

            {editingChannel?.channel === 'WHATSAPP' && (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>Quick Presets:</Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setChannelForm({
                    ...channelForm,
                    provider_name: 'Meta WhatsApp Business Cloud API',
                    api_endpoint: 'https://graph.facebook.com/v19.0',
                    test_mode: false
                  })}
                  sx={{ textTransform: 'none', fontSize: 11, py: 0.2 }}
                >
                  ⚡ Meta Cloud API
                </Button>
              </Box>
            )}

            <TextField
              label="Provider Name"
              fullWidth
              size="small"
              value={channelForm.provider_name}
              onChange={(e) => setChannelForm({ ...channelForm, provider_name: e.target.value })}
            />
            <TextField
              label={
                editingChannel?.channel === 'WHATSAPP'
                  ? 'API Endpoint / Base URL'
                  : editingChannel?.channel === 'EMAIL'
                    ? 'SMTP Host & Port (e.g. smtp.gmail.com:587)'
                    : 'API Endpoint / Gateway URL'
              }
              fullWidth
              size="small"
              placeholder={
                editingChannel?.channel === 'WHATSAPP'
                  ? 'https://graph.facebook.com/v19.0'
                  : editingChannel?.channel === 'EMAIL'
                    ? 'smtp.gmail.com:587'
                    : 'https://www.fast2sms.com/dev/bulkV2'
              }
              value={channelForm.api_endpoint}
              onChange={(e) => setChannelForm({ ...channelForm, api_endpoint: e.target.value })}
            />
            <TextField
              label={
                editingChannel?.channel === 'WHATSAPP'
                  ? 'Meta Phone Number ID (Sender ID)'
                  : editingChannel?.channel === 'EMAIL'
                    ? 'Sender Email / SMTP Username (e.g. alerts@company.com)'
                    : 'Sender ID / Route Header (e.g. q or BVCERP)'
              }
              fullWidth
              size="small"
              placeholder={
                editingChannel?.channel === 'WHATSAPP'
                  ? 'e.g. 104829105829102'
                  : editingChannel?.channel === 'EMAIL'
                    ? 'e.g. alerts@bvcagro.com or factory@gmail.com'
                    : 'e.g. q or BVCERP'
              }
              value={channelForm.sender_id}
              onChange={(e) => setChannelForm({ ...channelForm, sender_id: e.target.value })}
            />
            <TextField
              label={
                editingChannel?.channel === 'WHATSAPP'
                  ? 'Meta Permanent Access Token (Bearer Token)'
                  : editingChannel?.channel === 'EMAIL'
                    ? 'SMTP Password / Google App Password (16 characters)'
                    : 'API Authorization Key / Token'
              }
              fullWidth
              type="password"
              size="small"
              placeholder={
                editingChannel?.channel === 'EMAIL'
                  ? 'Paste 16-char Google App Password or SMTP password'
                  : 'Paste secret API Token here'
              }
              value={channelForm.auth_token}
              onChange={(e) => setChannelForm({ ...channelForm, auth_token: e.target.value })}
              helperText="Credentials are encrypted and stored safely on the server."
            />
            <FormControlLabel
              control={
                <Switch
                  checked={channelForm.test_mode}
                  onChange={(e) => setChannelForm({ ...channelForm, test_mode: e.target.checked })}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {channelForm.test_mode ? 'Sandbox / Test Mode Enabled (Simulated Logging)' : '🟢 Live Gateway Mode Active (Sends real packets to phone)'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {channelForm.test_mode ? 'Logs alerts inside ERP without making external paid API requests.' : 'Dispatches live messages to real phone numbers over the network.'}
                  </Typography>
                </Box>
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={channelForm.is_active}
                  onChange={(e) => setChannelForm({ ...channelForm, is_active: e.target.checked })}
                />
              }
              label="Enable This Channel"
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

      {/* Test Simulation Alert Modal */}
      <Dialog open={testModalOpen} onClose={() => setTestModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#1e3a8a' }}>
          Send Test Transaction Notification
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              select
              label="Module"
              fullWidth
              size="small"
              value={testModule}
              onChange={(e) => setTestModule(e.target.value)}
              SelectProps={{ native: true }}
            >
              <option value="OUTPASS">Outpass (Material Leaving Factory)</option>
              <option value="INPASS">Inpass (Material Arrived Back)</option>
              <option value="PURCHASE">Purchase (Material Arrived)</option>
              <option value="SALES">Sales (Dispatched / Loaded)</option>
            </TextField>

            <TextField
              label="Reference Number"
              fullWidth
              size="small"
              value={testRefNo}
              onChange={(e) => setTestRefNo(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setTestModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            disabled={sendingTest}
            onClick={triggerTestAlert}
            startIcon={sendingTest ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
            sx={{ fontWeight: 700 }}
          >
            {sendingTest ? 'Dispatching...' : 'Dispatch Test Message'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Single Recipient Direct Test Modal */}
      <Dialog open={recipientTestModalOpen} onClose={() => setRecipientTestModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#1e3a8a' }}>
          ⚡ Test Alert to {selectedRecipientForTest?.name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box sx={{ p: 1.5, bgcolor: '#f1f5f9', borderRadius: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {selectedRecipientForTest?.name} ({selectedRecipientForTest?.role})
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', color: '#64748b', fontFamily: 'monospace' }}>
                Contact: {selectedRecipientForTest?.phone_raw || selectedRecipientForTest?.phone || 'Placeholder'}
              </Typography>
            </Box>

            <TextField
              select
              label="Transaction Module Event"
              fullWidth
              size="small"
              value={recipientTestModule}
              onChange={(e) => setRecipientTestModule(e.target.value)}
              SelectProps={{ native: true }}
            >
              <option value="OUTPASS">Outpass (Outside Mill Grind)</option>
              <option value="INPASS">Inpass (Outside Mill Material Received)</option>
              <option value="PURCHASE">Purchase (Paddy / Rice Inward)</option>
              <option value="SALES">Sales (Finished Rice Dispatch)</option>
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

      {/* Test Result & WhatsApp / SMS Preview Modal */}
      <Dialog open={testResultModalOpen} onClose={() => setTestResultModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleIcon color="success" />
          {testResultData?.title || 'Test Notification Generated'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Alert severity="success" sx={{ fontSize: 13, borderRadius: 1.5 }}>
              <strong>Transaction Event Successfully Created & Processed!</strong> Real ERP transaction notifications follow this exact structure.
            </Alert>

            {/* WhatsApp Card Preview */}
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#f0fdf4', borderColor: '#86efac' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WhatsAppIcon sx={{ color: '#16a34a' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#166534' }}>
                    WhatsApp Message Preview (Automated Format)
                  </Typography>
                </Box>

                {(() => {
                  const targetPhone = testResultData?.phone || testResultData?.deliveryResults?.find(d => d.phone)?.phone || '';
                  const cleanDigits = targetPhone.replace(/\D/g, '');
                  const waUrl = (cleanDigits.length >= 10 && !targetPhone.includes('X') && !targetPhone.includes('x'))
                    ? `https://api.whatsapp.com/send?phone=${cleanDigits}&text=${encodeURIComponent(testResultData?.formattedWhatsAppMsg || '')}`
                    : null;

                  return (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          navigator.clipboard.writeText(testResultData?.formattedWhatsAppMsg || '');
                          alert('WhatsApp message copied to clipboard!');
                        }}
                        sx={{ textTransform: 'none', fontWeight: 700, fontSize: 11, borderColor: '#86efac', color: '#166534' }}
                      >
                        Copy Text
                      </Button>
                      {waUrl ? (
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
                          💬 Open in WhatsApp & Send Now
                        </Button>
                      ) : (
                        <Chip
                          label="Set Real Phone to Enable 1-Click WhatsApp"
                          size="small"
                          sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 700, fontSize: 10 }}
                        />
                      )}
                    </Box>
                  );
                })()}
              </Box>

              <Box
                sx={{
                  p: 2,
                  bgcolor: '#ffffff',
                  borderRadius: 2,
                  border: '1px solid #bbf7d0',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  fontFamily: 'monospace',
                  fontSize: 12.5,
                  whiteSpace: 'pre-wrap',
                  color: '#1e293b',
                  lineHeight: 1.5,
                  maxHeight: 280,
                  overflowY: 'auto'
                }}
              >
                {testResultData?.formattedWhatsAppMsg || 'No WhatsApp template content generated.'}
              </Box>
            </Paper>

            <Alert severity="info" sx={{ fontSize: 12, borderRadius: 1.5 }}>
              <strong>How live messages are received on phone:</strong><br />
              1. <strong>Direct 1-Click WhatsApp:</strong> Click the green button above to instantly send this formatted message to the recipient phone number via WhatsApp Web / App.<br />
              2. <strong>Automated Meta Cloud API:</strong> Configure your Meta WhatsApp Cloud API Token or SMS Gateway in the <em>Approved Providers</em> tab for 100% silent background delivery.
            </Alert>

            {/* SMS Card Preview */}
            {testResultData?.formattedSmsMsg && (
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#f8fafc' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <SmsIcon sx={{ color: '#2563eb' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e3a8a' }}>
                    SMS Gateway Preview (160 Chars)
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12, color: '#334155' }}>
                  {testResultData.formattedSmsMsg}
                </Typography>
              </Paper>
            )}

            {/* Delivery Logs Summary */}
            {testResultData?.deliveryResults && testResultData.deliveryResults.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#475569', display: 'block', mb: 0.5 }}>
                  CHANNEL DELIVERY STATUS:
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {testResultData.deliveryResults.map((dr, i) => (
                    <Chip
                      key={i}
                      label={`${dr.channel}: ${dr.status} (${dr.recipient})`}
                      size="small"
                      color={dr.status.includes('DELIVERED') || dr.status.includes('SENT') ? 'success' : 'warning'}
                      sx={{ fontSize: 11, fontWeight: 700 }}
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0' }}>
          <Button
            variant="contained"
            onClick={() => setTestResultModalOpen(false)}
            sx={{ backgroundColor: '#1f4fb2', fontWeight: 700 }}
          >
            Close Preview
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
