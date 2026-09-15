import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Grid,
  Typography,
  TextField,
  MenuItem,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  CircularProgress,
  Alert,
  Divider,
  Card,
  CardContent
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as BackIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  People as ContactsIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  NotificationsActive as AlertBellIcon,
  Send as SendIcon,
  ContentCopy as CopyIcon,
  CheckCircle as CheckCircleIcon,
  OpenInNew as OpenInNewIcon,
  Chat as ChatIcon,
  MarkEmailRead as SentEmailIcon,
  SettingsSuggest as SettingsIcon
} from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api.js';

const StockAlertContacts = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState([]);

  // Modal State
  const [openModal, setOpenModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState({
    contact_name: '',
    department: 'Purchase',
    phone: '',
    email: '',
    active: 1
  });

  // Test Alert Modal & Status State
  const [testingId, setTestingId] = useState(null);
  const [copiedType, setCopiedType] = useState(null);
  const [testResultModal, setTestResultModal] = useState({
    open: false,
    contact: null,
    emailResult: null,
    phoneResult: null,
    emailSubject: '',
    emailPlainText: '',
    phoneMsg: '',
    channels: []
  });

  // Message alert
  const [message, setMessage] = useState(null);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const json = await api('/stock-alerts/contacts');
      if (json && json.success) {
        setContacts(json.contacts || []);
      }
    } catch (err) {
      console.error('Error fetching contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const handleOpenAdd = () => {
    setEditId(null);
    setFormData({
      contact_name: '',
      department: 'Purchase',
      phone: '',
      email: '',
      active: 1
    });
    setOpenModal(true);
  };

  const handleOpenEdit = (contact) => {
    setEditId(contact.id);
    setFormData({
      contact_name: contact.contact_name || '',
      department: contact.department || 'Purchase',
      phone: contact.phone || '',
      email: contact.email || '',
      active: contact.active ?? 1
    });
    setOpenModal(true);
  };

  const handleTestAlert = async (contact) => {
    setTestingId(contact.id);
    try {
      const json = await api(`/stock-alerts/contacts/${contact.id}/test-alert`, {
        method: 'POST'
      });
      if (json && json.success) {
        setMessage({
          type: 'success',
          text: `🔔 Test Alert Processed for ${contact.contact_name}! Review delivery options below.`
        });
        window.dispatchEvent(new CustomEvent('stock-alerts-updated'));

        // Open the rich interactive test alert report dialog
        setTestResultModal({
          open: true,
          contact: json.contact || contact,
          emailResult: json.emailResult || null,
          phoneResult: json.phoneResult || null,
          emailSubject: json.emailSubject || `🔔 [TEST ALERT] BVC ERP Stock Alert - ${contact.contact_name}`,
          emailPlainText: json.emailPlainText || '',
          phoneMsg: json.phoneMsg || '',
          channels: json.channels || []
        });
      } else {
        setMessage({ type: 'error', text: json?.message || 'Failed to dispatch test alert' });
      }
    } catch (err) {
      console.error('Error sending test alert:', err);
      setMessage({ type: 'error', text: err.message || 'Error sending test alert' });
    } finally {
      setTestingId(null);
    }
  };

  const handleCopyText = (text, type) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this alert contact?')) return;
    try {
      const json = await api(`/stock-alerts/contacts/${id}`, { method: 'DELETE' });
      if (json && json.success) {
        setMessage({ type: 'success', text: 'Contact deleted successfully' });
        fetchContacts();
      }
    } catch (err) {
      console.error('Error deleting contact:', err);
    }
  };

  const handleSave = async () => {
    if (!formData.contact_name.trim()) {
      setMessage({ type: 'error', text: 'Contact name is required' });
      return;
    }

    const payload = {
      ...formData,
      contact_name: formData.contact_name.trim(),
      department: formData.department || 'Purchase',
      phone: (formData.phone || '').trim(),
      email: (formData.email || '').trim(),
      active: formData.active ? 1 : 0
    };

    try {
      const endpoint = editId ? `/stock-alerts/contacts/${editId}` : '/stock-alerts/contacts';
      const method = editId ? 'PUT' : 'POST';

      const json = await api(endpoint, {
        method,
        body: payload
      });

      if (json && json.success) {
        setMessage({ type: 'success', text: 'Contact saved successfully!' });
        setOpenModal(false);
        fetchContacts();
      } else {
        setMessage({ type: 'error', text: json?.message || 'Failed to save contact' });
      }
    } catch (err) {
      console.error('Error saving contact:', err);
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 3, mb: 4 }}>
      {/* Header */}
      <Paper elevation={0} sx={{ p: 2.5, mb: 3, backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<BackIcon />}
              onClick={() => navigate('/stock-alert-config')}
              sx={{ color: '#64748b', borderColor: '#cbd5e1' }}
            >
              Back to Thresholds
            </Button>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                👥 Alert Contacts Master
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Manage recipients and verify Multi-Channel Alert Delivery (In-App, Email, SMS, & WhatsApp)
              </Typography>
            </Box>
          </Box>

          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined"
              color="primary"
              component={Link}
              to="/stock-alert-dashboard"
              startIcon={<AlertBellIcon />}
            >
              Alerts Dashboard
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenAdd}
              sx={{ backgroundColor: '#1f4fb2', '&:hover': { backgroundColor: '#183c8a' } }}
            >
              Add New Contact
            </Button>
          </Stack>
        </Box>
      </Paper>

      {/* Alerts */}
      {message && (
        <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {/* Main Table */}
      <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
        <Box sx={{ p: 2, backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
            Configured Recipients ({contacts.length})
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b' }}>
            Click <strong>"Test Alert"</strong> on any contact to verify and test instant email or phone/WhatsApp dispatch.
          </Typography>
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead sx={{ backgroundColor: '#f1f5f9' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', color: '#334155' }}>S.No</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#334155' }}>Contact Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#334155' }}>Department</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#334155' }}>Phone Number</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#334155' }}>Email Address</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#334155', textAlign: 'center' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#334155', textAlign: 'center' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4 }}>
                    <CircularProgress size={24} />
                    <Typography variant="body2" sx={{ mt: 1, color: '#64748b' }}>
                      Loading contacts...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : contacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4 }}>
                    <ContactsIcon sx={{ fontSize: 40, color: '#cbd5e1', mb: 1 }} />
                    <Typography variant="body1" sx={{ color: '#64748b' }}>
                      No alert contacts created yet.
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#94a3b8', mb: 2 }}>
                      Add purchase managers, storekeepers, or executives to receive low stock warnings.
                    </Typography>
                    <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleOpenAdd} sx={{ backgroundColor: '#1f4fb2' }}>
                      Add First Contact
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                contacts.map((contact, idx) => (
                  <TableRow key={contact.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                      {contact.contact_name}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={contact.department || 'Purchase'}
                        size="small"
                        sx={{
                          backgroundColor: '#e0f2fe',
                          color: '#0369a1',
                          fontWeight: 'bold',
                          fontSize: '11px'
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {contact.phone ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <PhoneIcon sx={{ fontSize: 15, color: '#059669' }} />
                          <Typography variant="body2" sx={{ color: '#334155', fontFamily: 'monospace' }}>
                            {contact.phone}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" sx={{ color: '#94a3b8', fontStyle: 'italic' }}>
                          Not provided
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {contact.email ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <EmailIcon sx={{ fontSize: 15, color: '#2563eb' }} />
                          <Typography variant="body2" sx={{ color: '#1e40af' }}>
                            {contact.email}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" sx={{ color: '#94a3b8', fontStyle: 'italic' }}>
                          Not provided
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      <Chip
                        label={contact.active ? 'Active' : 'Inactive'}
                        size="small"
                        color={contact.active ? 'success' : 'default'}
                        sx={{ height: '22px', fontSize: '11px', fontWeight: 'bold' }}
                      />
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
                        <Tooltip title="Test Alert: Dispatches real In-App log, Email, & Mobile WhatsApp/SMS message">
                          <span>
                            <Button
                              size="small"
                              variant="contained"
                              color="warning"
                              startIcon={testingId === contact.id ? <CircularProgress size={14} color="inherit" /> : <SendIcon />}
                              disabled={testingId === contact.id}
                              onClick={() => handleTestAlert(contact)}
                              sx={{
                                fontSize: '11px',
                                py: 0.25,
                                px: 1.2,
                                height: '28px',
                                textTransform: 'none',
                                fontWeight: 'bold',
                                backgroundColor: '#d97706',
                                '&:hover': { backgroundColor: '#b45309' }
                              }}
                            >
                              Test Alert
                            </Button>
                          </span>
                        </Tooltip>
                        <Tooltip title="Edit Contact">
                          <IconButton size="small" onClick={() => handleOpenEdit(contact)} color="primary">
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Contact">
                          <IconButton size="small" onClick={() => handleDelete(contact.id)} color="error">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Add / Edit Contact Modal */}
      <Dialog open={openModal} onClose={() => setOpenModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ backgroundColor: '#1f4fb2', color: '#ffffff', py: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
              {editId ? 'Edit Alert Contact' : 'Add New Alert Contact'}
            </Typography>
            <IconButton size="small" onClick={() => setOpenModal(false)} sx={{ color: '#ffffff' }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Contact Name *"
                placeholder="e.g., Sundar Raman"
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                size="small"
                label="Department / Designation"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              >
                <MenuItem value="Purchase">Purchase Department</MenuItem>
                <MenuItem value="Stores & Godown">Stores & Godown</MenuItem>
                <MenuItem value="Production">Production Management</MenuItem>
                <MenuItem value="Accounts">Accounts & Finance</MenuItem>
                <MenuItem value="Executive Management">Executive Management</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Phone Number (SMS & WhatsApp)"
                placeholder="+91 9876543210"
                helperText="Include 10-digit or +91 for WhatsApp alerts"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Email Address (SMTP & Webmail)"
                placeholder="purchasemanager@bvcerp.com"
                helperText="For automated threshold alert emails"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(formData.active)}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked ? 1 : 0 })}
                    color="primary"
                  />
                }
                label="Active Recipient (Will receive automated warnings)"
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0' }}>
          <Button onClick={() => setOpenModal(false)} variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleSave} variant="contained" startIcon={<SaveIcon />} sx={{ backgroundColor: '#1f4fb2' }}>
            Save Contact
          </Button>
        </DialogActions>
      </Dialog>

      {/* Test Alert Dispatch Report & Direct Action Modal */}
      <Dialog
        open={testResultModal.open}
        onClose={() => setTestResultModal(prev => ({ ...prev, open: false }))}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ backgroundColor: '#0f172a', color: '#ffffff', py: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AlertBellIcon sx={{ color: '#f59e0b' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                Stock Alert Test Dispatch Report
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={() => setTestResultModal(prev => ({ ...prev, open: false }))}
              sx={{ color: '#94a3b8', '&:hover': { color: '#ffffff' } }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 2.5, backgroundColor: '#f8fafc' }}>
          {testResultModal.contact && (
            <Box sx={{ mb: 2.5, p: 2, backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1e293b', mb: 0.5 }}>
                Recipient Profile:
              </Typography>
              <Grid container spacing={1}>
                <Grid item xs={12} sm={3}>
                  <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>Name</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#0f172a' }}>
                    {testResultModal.contact.contact_name}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>Department</Typography>
                  <Typography variant="body2" sx={{ color: '#0369a1', fontWeight: 'bold' }}>
                    {testResultModal.contact.department || 'Purchase'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>Email Address</Typography>
                  <Typography variant="body2" sx={{ color: '#1e40af', fontWeight: 'bold' }}>
                    {testResultModal.contact.email || 'None registered'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>Phone Number</Typography>
                  <Typography variant="body2" sx={{ color: '#059669', fontWeight: 'bold' }}>
                    {testResultModal.contact.phone || 'None registered'}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}

          <Grid container spacing={2}>
            {/* Email Channel */}
            <Grid item xs={12} md={6}>
              <Card elevation={0} sx={{ border: '1px solid #cbd5e1', borderRadius: '8px', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 1.5, backgroundColor: '#eff6ff', borderBottom: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <EmailIcon sx={{ color: '#2563eb', fontSize: 20 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1e3a8a' }}>
                      Email Notification Channel
                    </Typography>
                  </Box>
                  {testResultModal.emailResult?.delivered ? (
                    <Chip size="small" icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />} label="SMTP Sent" color="success" sx={{ height: '22px', fontSize: '11px' }} />
                  ) : (
                    <Chip size="small" label="Ready to Send" color="primary" variant="outlined" sx={{ height: '22px', fontSize: '11px' }} />
                  )}
                </Box>
                <CardContent sx={{ p: 2, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" sx={{ color: '#334155', mb: 1 }}>
                      <strong>Target:</strong> {testResultModal.contact?.email || 'No email entered for this contact'}
                    </Typography>

                    {testResultModal.emailResult?.delivered ? (
                      <Alert severity="success" sx={{ py: 0.5, mb: 1.5, fontSize: '12px' }}>
                        Automated email transmitted to inbox via Server SMTP!
                      </Alert>
                    ) : (
                      <Alert severity="info" sx={{ py: 0.5, mb: 1.5, fontSize: '12px' }}>
                        Alert notification logged in ERP. Click below to launch your email client / Gmail with the prefilled alert message.
                      </Alert>
                    )}

                    <Box sx={{ p: 1.5, backgroundColor: '#f1f5f9', borderRadius: '6px', fontSize: '11px', color: '#475569', mb: 2, fontFamily: 'monospace', maxHeight: '110px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                      <strong>Subject:</strong> {testResultModal.emailSubject}
                      {'\n\n'}
                      {testResultModal.emailPlainText}
                    </Box>
                  </Box>

                  <Stack spacing={1}>
                    {testResultModal.contact?.email && (
                      <Button
                        variant="contained"
                        color="primary"
                        startIcon={<OpenInNewIcon />}
                        href={testResultModal.emailResult?.mailtoUrl || `mailto:${testResultModal.contact.email}?subject=${encodeURIComponent(testResultModal.emailSubject)}&body=${encodeURIComponent(testResultModal.emailPlainText)}`}
                        target="_blank"
                        fullWidth
                        sx={{ textTransform: 'none', fontWeight: 'bold', backgroundColor: '#2563eb' }}
                      >
                        Open & Send in Email Client / Gmail
                      </Button>
                    )}
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<CopyIcon />}
                      onClick={() => handleCopyText(testResultModal.emailPlainText, 'email')}
                      fullWidth
                      sx={{ textTransform: 'none', fontSize: '12px' }}
                    >
                      {copiedType === 'email' ? '✓ Email Text Copied!' : 'Copy Email Alert Text'}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            {/* Phone (WhatsApp & SMS) Channel */}
            <Grid item xs={12} md={6}>
              <Card elevation={0} sx={{ border: '1px solid #cbd5e1', borderRadius: '8px', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 1.5, backgroundColor: '#ecfdf5', borderBottom: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PhoneIcon sx={{ color: '#059669', fontSize: 20 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#065f46' }}>
                      Phone & WhatsApp Channel
                    </Typography>
                  </Box>
                  <Chip size="small" label="Ready to Send" color="success" variant="outlined" sx={{ height: '22px', fontSize: '11px' }} />
                </Box>
                <CardContent sx={{ p: 2, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" sx={{ color: '#334155', mb: 1 }}>
                      <strong>Target:</strong> {testResultModal.contact?.phone || 'No phone entered for this contact'}
                    </Typography>

                    <Alert severity="success" sx={{ py: 0.5, mb: 1.5, fontSize: '12px' }}>
                      Alert formatted for WhatsApp and SMS. Click below to trigger the message directly to their device.
                    </Alert>

                    <Box sx={{ p: 1.5, backgroundColor: '#f1f5f9', borderRadius: '6px', fontSize: '11px', color: '#475569', mb: 2, fontFamily: 'monospace', maxHeight: '110px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                      {testResultModal.phoneMsg}
                    </Box>
                  </Box>

                  <Stack spacing={1}>
                    {testResultModal.contact?.phone && (
                      <>
                        <Button
                          variant="contained"
                          color="success"
                          startIcon={<ChatIcon />}
                          href={testResultModal.phoneResult?.whatsappUrl || `https://api.whatsapp.com/send?phone=${testResultModal.contact.phone.replace(/[^\d+]/g, '')}&text=${encodeURIComponent(testResultModal.phoneMsg)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          fullWidth
                          sx={{ textTransform: 'none', fontWeight: 'bold', backgroundColor: '#16a34a', '&:hover': { backgroundColor: '#15803d' } }}
                        >
                          Send via WhatsApp Web / Mobile
                        </Button>
                        <Button
                          variant="outlined"
                          color="success"
                          startIcon={<PhoneIcon />}
                          href={testResultModal.phoneResult?.smsUrl || `sms:${testResultModal.contact.phone}?body=${encodeURIComponent(testResultModal.phoneMsg)}`}
                          fullWidth
                          sx={{ textTransform: 'none', fontWeight: 'bold', fontSize: '12px' }}
                        >
                          Send via Device SMS
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<CopyIcon />}
                      onClick={() => handleCopyText(testResultModal.phoneMsg, 'phone')}
                      fullWidth
                      sx={{ textTransform: 'none', fontSize: '12px' }}
                    >
                      {copiedType === 'phone' ? '✓ Message Copied!' : 'Copy WhatsApp / SMS Text'}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            {/* Server Automated Background SMTP Setup Note */}
            <Grid item xs={12}>
              <Paper elevation={0} sx={{ p: 2, backgroundColor: '#f1f5f9', borderRadius: '8px', border: '1px dashed #94a3b8' }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <SettingsIcon sx={{ color: '#475569', mt: 0.3 }} />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                      ℹ️ Note on Server-Side Automated Delivery:
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#475569', lineHeight: 1.6, display: 'block' }}>
                      For 100% automated background email sending (without manual client opening), ensure SMTP credentials (<code>SMTP_USER</code> and <code>SMTP_PASS</code> or <code>SMTP_HOST</code>) are provided in the server environment settings.
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 2, backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
          <Button
            onClick={() => setTestResultModal(prev => ({ ...prev, open: false }))}
            variant="contained"
            sx={{ backgroundColor: '#0f172a', textTransform: 'none' }}
          >
            Close Report
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default StockAlertContacts;
