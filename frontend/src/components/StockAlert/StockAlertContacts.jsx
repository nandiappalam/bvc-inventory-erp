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
  Alert
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
  Phone as PhoneIcon
} from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';

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

  const [message, setMessage] = useState(null);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stock-alerts/contacts');
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const text = await res.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch (parseErr) {}

      if (json && json.success) {
        setContacts(json.contacts || []);
      }
    } catch (err) {
      // Handle network error quietly
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

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this alert contact?')) return;
    try {
      const res = await fetch(`/api/stock-alerts/contacts/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
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

    try {
      const url = editId ? `/api/stock-alerts/contacts/${editId}` : '/api/stock-alerts/contacts';
      const method = editId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const json = await res.json();

      if (json.success) {
        setMessage({ type: 'success', text: 'Contact saved successfully!' });
        setOpenModal(false);
        fetchContacts();
      } else {
        setMessage({ type: 'error', text: json.message || 'Failed to save contact' });
      }
    } catch (err) {
      console.error('Error saving contact:', err);
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 3, mb: 5 }}>
      {/* Top Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <IconButton component={Link} to="/features/stock-alert-dashboard" sx={{ color: '#1f4fb2' }}>
            <BackIcon />
          </IconButton>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1f4fb2', display: 'flex', alignItems: 'center', gap: 1 }}>
              <ContactsIcon /> Alert Contacts Master
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage internal recipients, department roles, phone numbers and emails for automated stock alert dispatches
            </Typography>
          </Box>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            size="small"
            component={Link}
            to="/features/stock-alert-config"
            sx={{ borderColor: '#64748b', color: '#334155' }}
          >
            Threshold Config
          </Button>

          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={handleOpenAdd}
            sx={{ backgroundColor: '#1f4fb2', '&:hover': { backgroundColor: '#183c8a' } }}
          >
            Add Contact
          </Button>
        </Stack>
      </Box>

      {message && (
        <Alert severity={message.type} onClose={() => setMessage(null)} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}

      {/* Contacts Table */}
      <Paper sx={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small">
            <TableHead sx={{ backgroundColor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', width: '50px', textAlign: 'center' }}>S.No</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Contact Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Department / Role</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Phone Number</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Email Address</TableCell>
                <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4 }}>
                    <CircularProgress size={30} />
                  </TableCell>
                </TableRow>
              ) : contacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4, color: '#64748b' }}>
                    No contacts configured. Click "Add Contact" to add recipients.
                  </TableCell>
                </TableRow>
              ) : (
                contacts.map((contact, idx) => (
                  <TableRow key={contact.id} sx={{ '&:hover': { backgroundColor: '#f8fafc' } }}>
                    <TableCell sx={{ textAlign: 'center', color: '#64748b' }}>{idx + 1}</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#1e293b' }}>{contact.contact_name}</TableCell>
                    <TableCell>
                      <Chip
                        label={contact.department || 'General'}
                        size="small"
                        sx={{ backgroundColor: '#e2e8f0', fontSize: '11px', height: '22px' }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '12px' }}>
                      {contact.phone || '-'}
                    </TableCell>
                    <TableCell sx={{ fontSize: '12px', color: '#1e40af' }}>
                      {contact.email || '-'}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      <Chip
                        label={contact.active ? 'Active' : 'Inactive'}
                        size="small"
                        color={contact.active ? 'success' : 'default'}
                        sx={{ fontSize: '10px', height: '20px' }}
                      />
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      <Stack direction="row" spacing={1} justifyContent="center">
                        <IconButton size="small" onClick={() => handleOpenEdit(contact)} color="primary">
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDelete(contact.id)} color="error">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Modal */}
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
                label="Phone Number"
                placeholder="+91 98765 43210"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Email Address"
                placeholder="manager@bvcerp.com"
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
                label="Active Status"
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
    </Container>
  );
};

export default StockAlertContacts;
