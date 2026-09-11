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
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert
} from '@mui/material';
import {
  AcUnit as ColdIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { api } from '../../services/api';

const ColdStorageMaster = () => {
  const [loading, setLoading] = useState(false);
  const [storages, setStorages] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    id: null,
    godown_name: '',
    godown_type: 'Cold Storage',
    storage_location: 'Outside Factory',
    external_company: '',
    contact_person: '',
    phone_off: '',
    address1: '',
    capacity: '',
    capacity_unit: 'KG',
    temperature_range: '2°C - 8°C',
    status: 'Active'
  });

  useEffect(() => {
    fetchStorages();
  }, []);

  const fetchStorages = async () => {
    setLoading(true);
    try {
      const res = await api('/godowns');
      if (res && res.data) {
        // Filter godowns that are Cold Storage or Outside Factory
        const csList = (res.data || []).filter(
          g => g.godown_type === 'Cold Storage' || g.storage_location === 'Outside Factory' || (g.godown_name || '').toLowerCase().includes('cold')
        );
        setStorages(csList.length > 0 ? csList : res.data);
      }
    } catch (err) {
      console.error('Error fetching storages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNew = () => {
    setFormData({
      id: null,
      godown_name: `Cold Storage ${storages.length + 1}`,
      godown_type: 'Cold Storage',
      storage_location: 'Outside Factory',
      external_company: '',
      contact_person: '',
      phone_off: '',
      address1: '',
      capacity: '50000',
      capacity_unit: 'KG',
      temperature_range: '2°C - 8°C',
      status: 'Active'
    });
    setMessage('');
    setOpenDialog(true);
  };

  const handleEdit = (item) => {
    setFormData({
      id: item.id,
      godown_name: item.godown_name || '',
      godown_type: item.godown_type || 'Cold Storage',
      storage_location: item.storage_location || 'Outside Factory',
      external_company: item.external_company || '',
      contact_person: item.contact_person || '',
      phone_off: item.phone_off || item.phone_res || '',
      address1: item.address1 || item.address || '',
      capacity: item.capacity || '',
      capacity_unit: item.capacity_unit || 'KG',
      temperature_range: item.temperature_range || '',
      status: item.status || 'Active'
    });
    setMessage('');
    setOpenDialog(true);
  };

  const handleSave = async () => {
    if (!formData.godown_name.trim()) {
      setMessage('Godown/Cold Storage Name is required');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      let res;
      if (formData.id) {
        res = await api(`/godowns/${formData.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData)
        });
      } else {
        res = await api('/godowns', {
          method: 'POST',
          body: JSON.stringify(formData)
        });
      }

      if (res && (res.success || res.id)) {
        setOpenDialog(false);
        fetchStorages();
      } else {
        setMessage(res?.message || 'Error saving Cold Storage master');
      }
    } catch (err) {
      setMessage('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, width: '100%', maxWidth: '100%', margin: '0 auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ColdIcon sx={{ fontSize: 36, color: '#1f4fb2' }} />
          <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>
            Cold Storage Facility Master Configuration
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleOpenNew}
        >
          Add Cold Storage
        </Button>
      </Box>

      {/* Facilities List Table */}
      <Card sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
              <CircularProgress />
            </Box>
          ) : storages.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">No Cold Storage facilities configured yet.</Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 950 }}>
                <TableHead sx={{ backgroundColor: '#1f4fb2' }}>
                  <TableRow>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>#</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Facility Name</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>External Company / Location</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Type</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Capacity</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Temp Range</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Contact Person</TableCell>
                    <TableCell align="center" sx={{ color: '#fff', fontWeight: 'bold' }}>Status</TableCell>
                    <TableCell align="center" sx={{ color: '#fff', fontWeight: 'bold' }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {storages.map((row, idx) => (
                    <TableRow key={row.id || idx} hover sx={{ '&:nth-of-type(even)': { backgroundColor: '#f8fafc' } }}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>{row.godown_name}</TableCell>
                      <TableCell>{row.external_company || row.storage_location || 'Outside Factory'}</TableCell>
                      <TableCell>
                        <Chip label={row.godown_type || 'Cold Storage'} size="small" color="primary" variant="outlined" />
                      </TableCell>
                      <TableCell>{row.capacity ? `${row.capacity} ${row.capacity_unit || 'KG'}` : 'N/A'}</TableCell>
                      <TableCell>{row.temperature_range || '2°C - 8°C'}</TableCell>
                      <TableCell>{row.contact_person || 'N/A'}</TableCell>
                      <TableCell align="center">
                        <Chip label={row.status || 'Active'} color="success" size="small" />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton size="small" color="primary" onClick={() => handleEdit(row)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ backgroundColor: '#1f4fb2', color: '#fff' }}>
          {formData.id ? 'Edit Cold Storage Facility' : 'Add New Cold Storage Facility'}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {message && <Alert severity="error" sx={{ mb: 2 }}>{message}</Alert>}
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Cold Storage Name"
                value={formData.godown_name}
                onChange={(e) => setFormData({ ...formData, godown_name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="External Company Name"
                value={formData.external_company}
                onChange={(e) => setFormData({ ...formData, external_company: e.target.value })}
                placeholder="e.g. Freezetech Cold Storage Ltd"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                size="small"
                label="Storage Location"
                value={formData.storage_location}
                onChange={(e) => setFormData({ ...formData, storage_location: e.target.value })}
              >
                <MenuItem value="Outside Factory">Outside Factory (External)</MenuItem>
                <MenuItem value="Inside Factory">Inside Factory (In-house)</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Temperature Range"
                value={formData.temperature_range}
                onChange={(e) => setFormData({ ...formData, temperature_range: e.target.value })}
                placeholder="e.g. 2°C - 8°C"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Total Capacity"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                size="small"
                label="Capacity Unit"
                value={formData.capacity_unit}
                onChange={(e) => setFormData({ ...formData, capacity_unit: e.target.value })}
              >
                <MenuItem value="KG">KG</MenuItem>
                <MenuItem value="Bags">Bags</MenuItem>
                <MenuItem value="Tons">Tons</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Contact Person"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Phone / Mobile"
                value={formData.phone_off}
                onChange={(e) => setFormData({ ...formData, phone_off: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                multiline
                rows={2}
                label="Address / Location Details"
                value={formData.address1}
                onChange={(e) => setFormData({ ...formData, address1: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Facility'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ColdStorageMaster;
