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
  Checkbox,
  FormGroup
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  ArrowBack as BackIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  NotificationsActive as AlertIcon,
  People as ContactsIcon
} from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';

const StockAlertConfig = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [configs, setConfigs] = useState([]);
  const [itemsList, setItemsList] = useState([]);
  const [godownsList, setGodownsList] = useState([]);
  const [contactsList, setContactsList] = useState([]);

  // Modal State
  const [openModal, setOpenModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState({
    item_id: '',
    item_name: '',
    godown_id: '',
    godown_name: 'All Godowns',
    minimum_qty: 500,
    reorder_level: 1000,
    critical_level: 200,
    alert_enabled: 1,
    in_app_enabled: 1,
    email_enabled: 1,
    sms_enabled: 0,
    whatsapp_enabled: 0,
    offline_enabled: 1,
    contact_ids: []
  });

  const [message, setMessage] = useState(null);

  // Fetch all configurations
  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stock-alerts/config');
      const json = await res.json();
      if (json.success) {
        setConfigs(json.configs || []);
      }
    } catch (err) {
      console.error('Error loading stock alert configs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch master dropdown data
  useEffect(() => {
    fetchConfigs();

    // Fetch items from master
    fetch('/api/masters/items')
      .then(res => res.json())
      .then(data => {
        let list = [];
        if (Array.isArray(data)) {
          list = data;
        } else if (data && Array.isArray(data.data)) {
          list = data.data;
        } else if (data && Array.isArray(data.items)) {
          list = data.items;
        }
        setItemsList(list);
      })
      .catch(err => console.error('Error fetching items:', err));

    // Fetch godowns
    fetch('/api/godowns')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setGodownsList(data);
      })
      .catch(err => console.error('Error fetching godowns:', err));

    // Fetch contacts
    fetch('/api/stock-alerts/contacts')
      .then(res => res.json())
      .then(data => {
        if (data.success) setContactsList(data.contacts || []);
      })
      .catch(err => console.error('Error fetching contacts:', err));

    const handleStockUpdate = () => {
      fetchConfigs();
    };
    window.addEventListener('stock-alerts-updated', handleStockUpdate);
    return () => window.removeEventListener('stock-alerts-updated', handleStockUpdate);
  }, []);

  const handleOpenAdd = () => {
    setEditId(null);
    setFormData({
      item_id: '',
      item_name: '',
      godown_id: '',
      godown_name: 'All Godowns',
      minimum_qty: 500,
      reorder_level: 1000,
      critical_level: 200,
      alert_enabled: 1,
      in_app_enabled: 1,
      email_enabled: 1,
      sms_enabled: 0,
      whatsapp_enabled: 0,
      offline_enabled: 1,
      contact_ids: contactsList.map(c => c.id) // Default all contacts selected
    });
    setOpenModal(true);
  };

  const handleOpenEdit = (cfg) => {
    setEditId(cfg.id);
    const assignedIds = cfg.contact_ids ? String(cfg.contact_ids).split(',').map(Number) : [];
    setFormData({
      item_id: cfg.item_id || '',
      item_name: cfg.item_name || '',
      godown_id: cfg.godown_id || '',
      godown_name: cfg.godown_name || 'All Godowns',
      minimum_qty: cfg.minimum_qty || 0,
      reorder_level: cfg.reorder_level || 0,
      critical_level: cfg.critical_level || 0,
      alert_enabled: cfg.alert_enabled ?? 1,
      in_app_enabled: cfg.in_app_enabled ?? 1,
      email_enabled: cfg.email_enabled ?? 1,
      sms_enabled: cfg.sms_enabled ?? 0,
      whatsapp_enabled: cfg.whatsapp_enabled ?? 0,
      offline_enabled: cfg.offline_enabled ?? 1,
      contact_ids: assignedIds.length > 0 ? assignedIds : contactsList.map(c => c.id)
    });
    setOpenModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this stock alert threshold configuration?')) return;
    try {
      const res = await fetch(`/api/stock-alerts/config/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setMessage({ type: 'success', text: 'Configuration deleted successfully' });
        fetchConfigs();
        window.dispatchEvent(new CustomEvent('stock-alerts-updated'));
      }
    } catch (err) {
      console.error('Error deleting configuration:', err);
    }
  };

  const handleItemSelect = (itemName) => {
    const itm = itemsList.find(i => (i.item_name || i.name) === itemName);
    setFormData(prev => ({
      ...prev,
      item_name: itemName,
      item_id: itm?.id || ''
    }));
  };

  const handleGodownSelect = (godownName) => {
    const g = godownsList.find(gd => gd.godown_name === godownName);
    setFormData(prev => ({
      ...prev,
      godown_name: godownName,
      godown_id: g?.id || ''
    }));
  };

  const handleContactToggle = (cId) => {
    setFormData(prev => {
      const exists = prev.contact_ids.includes(cId);
      const next = exists ? prev.contact_ids.filter(id => id !== cId) : [...prev.contact_ids, cId];
      return { ...prev, contact_ids: next };
    });
  };

  const handleSave = async () => {
    if (!formData.item_name) {
      setMessage({ type: 'error', text: 'Please select an item' });
      return;
    }

    try {
      const url = editId ? `/api/stock-alerts/config/${editId}` : '/api/stock-alerts/config';
      const method = editId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const json = await res.json();

      if (json.success) {
        setMessage({ type: 'success', text: 'Stock alert threshold saved successfully!' });
        setOpenModal(false);
        fetchConfigs();
        window.dispatchEvent(new CustomEvent('stock-alerts-updated'));
      } else {
        setMessage({ type: 'error', text: json.message || 'Failed to save configuration' });
      }
    } catch (err) {
      console.error('Error saving configuration:', err);
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 3, mb: 5 }}>
      {/* Top Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <IconButton component={Link} to="/features/stock-alert-dashboard" sx={{ color: '#1f4fb2' }}>
            <BackIcon />
          </IconButton>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1f4fb2', display: 'flex', alignItems: 'center', gap: 1 }}>
              <AlertIcon /> Stock Alert Threshold Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Set Minimum Stock, Reorder Level, and Critical Thresholds per Item and Godown Location
            </Typography>
          </Box>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            size="small"
            component={Link}
            to="/features/stock-alert-contacts"
            startIcon={<ContactsIcon />}
            sx={{ borderColor: '#64748b', color: '#334155' }}
          >
            Manage Contacts
          </Button>

          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={handleOpenAdd}
            sx={{ backgroundColor: '#1f4fb2', '&:hover': { backgroundColor: '#183c8a' } }}
          >
            Add Item Threshold
          </Button>
        </Stack>
      </Box>

      {message && (
        <Alert severity={message.type} onClose={() => setMessage(null)} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}

      {/* Main Configurations Table */}
      <Paper sx={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small">
            <TableHead sx={{ backgroundColor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', width: '50px', textAlign: 'center' }}>S.No</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Item Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Godown Location</TableCell>
                <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Critical Level (Kg)</TableCell>
                <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Minimum Stock (Kg)</TableCell>
                <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Reorder Level (Kg)</TableCell>
                <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Alerts Enabled</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Enabled Channels</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Assigned Contacts</TableCell>
                <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} sx={{ textAlign: 'center', py: 4 }}>
                    <CircularProgress size={30} />
                  </TableCell>
                </TableRow>
              ) : configs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} sx={{ textAlign: 'center', py: 4, color: '#64748b' }}>
                    No stock alert configurations created yet. Click "Add Item Threshold" above to create one.
                  </TableCell>
                </TableRow>
              ) : (
                configs.map((cfg, idx) => (
                  <TableRow key={cfg.id} sx={{ '&:hover': { backgroundColor: '#f8fafc' } }}>
                    <TableCell sx={{ textAlign: 'center', color: '#64748b' }}>{idx + 1}</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#1e293b' }}>{cfg.item_name}</TableCell>
                    <TableCell>
                      <Chip
                        label={cfg.godown_name || 'All Godowns'}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '11px', height: '22px' }}
                      />
                    </TableCell>
                    <TableCell sx={{ textAlign: 'right', color: '#dc2626', fontWeight: 'bold', fontFamily: 'monospace' }}>
                      {cfg.critical_level > 0 ? `${cfg.critical_level} Kg` : '-'}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'right', color: '#ea580c', fontWeight: 'bold', fontFamily: 'monospace' }}>
                      {cfg.minimum_qty > 0 ? `${cfg.minimum_qty} Kg` : '-'}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'right', color: '#d97706', fontWeight: 'bold', fontFamily: 'monospace' }}>
                      {cfg.reorder_level > 0 ? `${cfg.reorder_level} Kg` : '-'}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      <Chip
                        label={cfg.alert_enabled ? 'Active' : 'Disabled'}
                        size="small"
                        color={cfg.alert_enabled ? 'success' : 'default'}
                        sx={{ fontSize: '10px', height: '20px' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        {cfg.in_app_enabled ? <Chip label="App" size="small" color="primary" sx={{ fontSize: '10px', height: '18px' }} /> : null}
                        {cfg.email_enabled ? <Chip label="Email" size="small" color="info" sx={{ fontSize: '10px', height: '18px' }} /> : null}
                        {cfg.offline_enabled ? <Chip label="Desktop" size="small" color="secondary" sx={{ fontSize: '10px', height: '18px' }} /> : null}
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ fontSize: '12px', color: '#334155' }}>
                      {cfg.assigned_contacts || 'All Active Contacts'}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      <Stack direction="row" spacing={1} justifyContent="center">
                        <IconButton size="small" onClick={() => handleOpenEdit(cfg)} color="primary">
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDelete(cfg.id)} color="error">
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

      {/* Add / Edit Modal */}
      <Dialog open={openModal} onClose={() => setOpenModal(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ backgroundColor: '#1f4fb2', color: '#ffffff', py: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
              {editId ? 'Edit Stock Alert Threshold' : 'Add Stock Alert Threshold'}
            </Typography>
            <IconButton size="small" onClick={() => setOpenModal(false)} sx={{ color: '#ffffff' }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            {/* Item Selection */}
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                size="small"
                label="Select Item *"
                value={formData.item_name}
                onChange={(e) => handleItemSelect(e.target.value)}
                disabled={Boolean(editId)}
              >
                {itemsList.map(item => (
                  <MenuItem key={item.id} value={item.item_name || item.name}>
                    {item.item_name || item.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Godown Selection */}
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                size="small"
                label="Godown Location (Specific or All)"
                value={formData.godown_name}
                onChange={(e) => handleGodownSelect(e.target.value)}
              >
                <MenuItem value="All Godowns">All Godowns (Global Default)</MenuItem>
                {godownsList.map(g => (
                  <MenuItem key={g.id} value={g.godown_name}>
                    {g.godown_name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Critical Level */}
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Critical Stock Level (Kg)"
                helperText="Emergency minimum threshold"
                value={formData.critical_level}
                onChange={(e) => setFormData({ ...formData, critical_level: parseFloat(e.target.value) || 0 })}
              />
            </Grid>

            {/* Minimum Stock Qty */}
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Minimum Stock Qty (Kg) *"
                helperText="Low stock alert trigger level"
                value={formData.minimum_qty}
                onChange={(e) => setFormData({ ...formData, minimum_qty: parseFloat(e.target.value) || 0 })}
              />
            </Grid>

            {/* Reorder Level */}
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Reorder Level (Kg) *"
                helperText="Trigger for reordering before low stock"
                value={formData.reorder_level}
                onChange={(e) => setFormData({ ...formData, reorder_level: parseFloat(e.target.value) || 0 })}
              />
            </Grid>

            {/* Notification Channels */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1e293b', mb: 1 }}>
                Notification Channels
              </Typography>
              <FormGroup row>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={Boolean(formData.in_app_enabled)}
                      onChange={(e) => setFormData({ ...formData, in_app_enabled: e.target.checked ? 1 : 0 })}
                    />
                  }
                  label="In-App (Bell & Popups)"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={Boolean(formData.email_enabled)}
                      onChange={(e) => setFormData({ ...formData, email_enabled: e.target.checked ? 1 : 0 })}
                    />
                  }
                  label="Email Notification"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={Boolean(formData.offline_enabled)}
                      onChange={(e) => setFormData({ ...formData, offline_enabled: e.target.checked ? 1 : 0 })}
                    />
                  }
                  label="Offline / Desktop Alert (Tauri)"
                />
              </FormGroup>
            </Grid>

            {/* Assign Contacts */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1e293b', mb: 1 }}>
                Assigned Contacts (Multiple Selection)
              </Typography>
              <Box sx={{ border: '1px solid #cbd5e1', borderRadius: '4px', p: 1.5, maxHeight: '160px', overflowY: 'auto' }}>
                <Grid container spacing={1}>
                  {contactsList.map(c => (
                    <Grid item xs={12} sm={6} key={c.id}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={formData.contact_ids.includes(c.id)}
                            onChange={() => handleContactToggle(c.id)}
                            size="small"
                          />
                        }
                        label={
                          <Typography variant="body2">
                            <strong>{c.contact_name}</strong> ({c.department})
                          </Typography>
                        }
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </Grid>

            {/* Active Toggle */}
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(formData.alert_enabled)}
                    onChange={(e) => setFormData({ ...formData, alert_enabled: e.target.checked ? 1 : 0 })}
                    color="primary"
                  />
                }
                label="Enable Alert Triggers for this configuration"
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0' }}>
          <Button onClick={() => setOpenModal(false)} variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleSave} variant="contained" startIcon={<SaveIcon />} sx={{ backgroundColor: '#1f4fb2' }}>
            Save Threshold Configuration
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default StockAlertConfig;
