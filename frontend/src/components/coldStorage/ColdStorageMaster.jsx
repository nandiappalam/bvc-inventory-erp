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
  Alert,
  Divider,
  Autocomplete,
  Tooltip,
  RadioGroup,
  FormControlLabel,
  Radio
} from '@mui/material';
import {
  AcUnit as ColdIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Business as OperatorIcon,
  MonetizationOn as PriceIcon,
  Thermostat as TempIcon,
  LocalShipping as TransportIcon,
  Tune as TuneIcon,
  Calculate as CalcIcon
} from '@mui/icons-material';
import { api } from '../../services/api';

const ColdStorageMaster = () => {
  const [loading, setLoading] = useState(false);
  const [storages, setStorages] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Tariff & Slab Dialog State
  const [openTariffDialog, setOpenTariffDialog] = useState(false);
  const [selectedGodownForTariff, setSelectedGodownForTariff] = useState(null);
  const [loadingTariff, setLoadingTariff] = useState(false);
  const [savingTariff, setSavingTariff] = useState(false);
  const [tariffMessage, setTariffMessage] = useState('');
  const [tariffData, setTariffData] = useState({
    calculationType: 'Progressive',
    freeDays: 0,
    minDays: 1,
    inwardUnloadingRate: 0.50,
    outwardLoadingRate: 0.50,
    storageSlabs: [
      { slab_start_day: 1, slab_end_day: 15, rate: 0.20 },
      { slab_start_day: 16, slab_end_day: 30, rate: 0.30 },
      { slab_start_day: 31, slab_end_day: 99999, rate: 0.40 }
    ]
  });
  // Live Simulation state
  const [simWeight, setSimWeight] = useState(1000);
  const [simDays, setSimDays] = useState(10);

  // Form State
  const [formData, setFormData] = useState({
    id: null,
    godown_name: '',
    print_name: '',
    godown_type: 'Cold Storage',
    storage_location: 'Outside Factory',
    external_company: '',
    operator_id: null,
    operator_name: '',
    contact_person: '',
    phone_off: '',
    address1: '',
    gst_number: '',
    capacity: '50000',
    capacity_unit: 'KG',
    temperature_range: '2°C - 8°C',
    default_chamber: 'Chamber 1',
    // Billing & Pricing Terms
    billing_basis: 'Per Bag',
    billing_method: 'Fixed Period',
    storage_duration: 10,
    duration_unit: 'Days',
    min_billable_days: 10,
    rate_per_bag: 15,
    rate_per_kg: 0.30,
    rate_per_ton: 300,
    inward_handling_rate: 3.5,
    outward_handling_rate: 3.5,
    insurance_rate: 1.0,
    mamool_rate: 0.5,
    gst_rate: 18,
    cold_storage_remarks: '',
    status: 'Active'
  });

  useEffect(() => {
    fetchStorages();
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const res = await api('/masters/suppliers');
      if (res && res.data) {
        setSuppliers(res.data);
      }
    } catch (e) {
      console.warn('Could not load suppliers for operator linkage:', e.message);
    }
  };

  const fetchStorages = async () => {
    setLoading(true);
    try {
      const res = await api('/godowns');
      const list = Array.isArray(res) ? res : (res?.data || []);
      const csList = list.filter(
        g => g.godown_type === 'Cold Storage' ||
             g.storage_location === 'Outside Factory' ||
             (g.godown_name || '').toLowerCase().includes('cold')
      );
      setStorages(csList.length > 0 ? csList : list);
    } catch (err) {
      console.error('Error fetching storages:', err);
      setStorages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNew = () => {
    setFormData({
      id: null,
      godown_name: `Cold Storage Facility ${storages.length + 1}`,
      print_name: `External Cold Storage ${storages.length + 1}`,
      godown_type: 'Cold Storage',
      storage_location: 'Outside Factory',
      external_company: '',
      operator_id: null,
      operator_name: '',
      contact_person: '',
      phone_off: '',
      address1: '',
      gst_number: '',
      capacity: '50000',
      capacity_unit: 'KG',
      temperature_range: '2°C - 8°C',
      default_chamber: 'Chamber 1',
      billing_basis: 'Per Bag',
      billing_method: 'Fixed Period',
      storage_duration: 10,
      duration_unit: 'Days',
      min_billable_days: 10,
      rate_per_bag: 15,
      rate_per_kg: 0.30,
      rate_per_ton: 300,
      inward_handling_rate: 3.5,
      outward_handling_rate: 3.5,
      insurance_rate: 1.0,
      mamool_rate: 0.5,
      gst_rate: 18,
      cold_storage_remarks: '',
      status: 'Active'
    });
    setMessage('');
    setOpenDialog(true);
  };

  const handleEdit = (item) => {
    setFormData({
      id: item.id,
      godown_name: item.godown_name || item.name || '',
      print_name: item.print_name || item.printname || item.godown_name || '',
      godown_type: item.godown_type || 'Cold Storage',
      storage_location: item.storage_location || 'Outside Factory',
      external_company: item.external_company || '',
      operator_id: item.operator_id || null,
      operator_name: item.operator_name || item.resolved_operator_name || item.external_company || '',
      contact_person: item.contact_person || item.resolved_contact_person || '',
      phone_off: item.phone_off || item.phone || item.mobile1 || item.resolved_phone || '',
      address1: item.address1 || item.address || '',
      gst_number: item.gst_number || item.gst_no || item.resolved_gst || '',
      capacity: item.capacity !== undefined ? String(item.capacity) : '50000',
      capacity_unit: item.capacity_unit || 'KG',
      temperature_range: item.temperature_range || '2°C - 8°C',
      default_chamber: item.default_chamber || 'Chamber 1',
      billing_basis: item.billing_basis || 'Per Bag',
      billing_method: item.billing_method || 'Fixed Period',
      storage_duration: item.storage_duration !== undefined ? item.storage_duration : 10,
      duration_unit: item.duration_unit || 'Days',
      min_billable_days: item.min_billable_days !== undefined ? item.min_billable_days : 10,
      rate_per_bag: item.rate_per_bag !== undefined ? item.rate_per_bag : 15,
      rate_per_kg: item.rate_per_kg !== undefined ? item.rate_per_kg : 0.30,
      rate_per_ton: item.rate_per_ton !== undefined ? item.rate_per_ton : 300,
      inward_handling_rate: item.inward_handling_rate !== undefined ? item.inward_handling_rate : 3.5,
      outward_handling_rate: item.outward_handling_rate !== undefined ? item.outward_handling_rate : 3.5,
      insurance_rate: item.insurance_rate !== undefined ? item.insurance_rate : 1.0,
      mamool_rate: item.mamool_rate !== undefined ? item.mamool_rate : 0.5,
      gst_rate: item.gst_rate !== undefined ? item.gst_rate : 18,
      cold_storage_remarks: item.cold_storage_remarks || '',
      status: item.status || 'Active'
    });
    setMessage('');
    setOpenDialog(true);
  };

  const handleOperatorSelect = (event, selectedSupplier) => {
    if (selectedSupplier) {
      setFormData(prev => ({
        ...prev,
        operator_id: selectedSupplier.id,
        operator_name: selectedSupplier.print_name || selectedSupplier.name,
        contact_person: selectedSupplier.contact_person || prev.contact_person,
        phone_off: selectedSupplier.phone_off || selectedSupplier.mobile1 || prev.phone_off,
        address1: selectedSupplier.address || prev.address1,
        gst_number: selectedSupplier.gst_number || prev.gst_number
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        operator_id: null,
        operator_name: ''
      }));
    }
  };

  const handleDelete = async (item) => {
    const confirmed = window.__appConfirm ? await window.__appConfirm({
      title: 'Confirm Cold Storage Deletion',
      message: `Are you sure you want to delete Cold Storage facility "${item.godown_name}"?\n\nThis record will be moved to the Recycle Bin.`,
      confirmText: 'Delete Facility',
      confirmColor: 'error'
    }) : window.confirm(`Are you sure you want to delete "${item.godown_name}"?`);

    if (!confirmed) return;

    try {
      const res = await api(`/godowns/${item.id}`, { method: 'DELETE' });
      if (res && res.success) {
        fetchStorages();
      } else {
        alert(res?.message || 'Error deleting facility');
      }
    } catch (err) {
      alert('Error deleting facility: ' + err.message);
    }
  };

  const handleSave = async () => {
    if (!formData.godown_name.trim()) {
      setMessage('Cold Storage Facility Name is required');
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

  const handleOpenTariffDialog = async (item) => {
    setSelectedGodownForTariff(item);
    setOpenTariffDialog(true);
    setLoadingTariff(true);
    setTariffMessage('');
    try {
      const res = await api(`/cold-storage/tariff/${item.id}`);
      if (res && res.data) {
        const d = res.data;
        setTariffData({
          calculationType: d.calculationType || 'Progressive',
          freeDays: d.freeDays !== undefined ? d.freeDays : 0,
          minDays: d.minDays !== undefined ? d.minDays : 1,
          inwardUnloadingRate: d.inwardUnloadingRate !== undefined ? d.inwardUnloadingRate : 0.50,
          outwardLoadingRate: d.outwardLoadingRate !== undefined ? d.outwardLoadingRate : 0.50,
          storageSlabs: Array.isArray(d.storageSlabs) && d.storageSlabs.length > 0
            ? d.storageSlabs
            : [
                { slab_start_day: 1, slab_end_day: 15, rate: 0.20 },
                { slab_start_day: 16, slab_end_day: 30, rate: 0.30 },
                { slab_start_day: 31, slab_end_day: 99999, rate: 0.40 }
              ]
        });
      }
    } catch (err) {
      console.error('Error fetching tariff:', err);
    } finally {
      setLoadingTariff(false);
    }
  };

  const handleSlabChange = (idx, field, value) => {
    const updated = [...tariffData.storageSlabs];
    updated[idx] = { ...updated[idx], [field]: value };
    setTariffData({ ...tariffData, storageSlabs: updated });
  };

  const handleAddSlab = () => {
    const slabs = tariffData.storageSlabs || [];
    const lastSlab = slabs[slabs.length - 1];
    const nextStart = lastSlab ? (parseInt(lastSlab.slab_end_day, 10) || 30) + 1 : 1;
    setTariffData({
      ...tariffData,
      storageSlabs: [
        ...slabs,
        { slab_start_day: nextStart, slab_end_day: nextStart + 14, rate: 0.40 }
      ]
    });
  };

  const handleDeleteSlab = (idx) => {
    const updated = tariffData.storageSlabs.filter((_, i) => i !== idx);
    setTariffData({ ...tariffData, storageSlabs: updated });
  };

  const handleSaveTariff = async () => {
    if (!selectedGodownForTariff) return;
    setSavingTariff(true);
    setTariffMessage('');
    try {
      const res = await api(`/cold-storage/tariff/${selectedGodownForTariff.id}`, {
        method: 'POST',
        body: JSON.stringify(tariffData)
      });
      if (res && res.success) {
        setTariffMessage('Tariff and Day Slabs updated successfully!');
        fetchStorages();
        setTimeout(() => {
          setOpenTariffDialog(false);
        }, 1200);
      } else {
        setTariffMessage(res?.message || 'Error updating tariff');
      }
    } catch (err) {
      setTariffMessage('Error: ' + err.message);
    } finally {
      setSavingTariff(false);
    }
  };

  // Live simulation breakdown calculation
  const calculateSimulation = () => {
    const w = parseFloat(simWeight) || 0;
    const d = Math.max(0, parseInt(simDays, 10) || 0);
    const free = parseInt(tariffData.freeDays, 10) || 0;
    const minD = parseInt(tariffData.minDays, 10) || 1;
    const netD = Math.max(0, d - free);
    const billableDays = Math.max(netD, minD);
    const isWhole = String(tariffData.calculationType).toLowerCase().includes('whole');

    const slabs = (tariffData.storageSlabs || [])
      .slice()
      .sort((a, b) => (parseInt(a.slab_start_day, 10) || 1) - (parseInt(b.slab_start_day, 10) || 1));

    let storageCharge = 0;
    const breakdown = [];

    if (isWhole) {
      let matched = slabs[slabs.length - 1] || { rate: 0.20, slab_start_day: 1, slab_end_day: 15 };
      for (const s of slabs) {
        const start = parseInt(s.slab_start_day, 10) || 1;
        const end = s.slab_end_day ? parseInt(s.slab_end_day, 10) : 999999;
        if (billableDays >= start && billableDays <= end) {
          matched = s;
          break;
        }
      }
      const r = parseFloat(matched.rate) || 0;
      storageCharge = w * r * billableDays;
      breakdown.push({
        label: `Whole Duration Slab (${matched.slab_start_day}–${matched.slab_end_day >= 99999 ? 'Beyond' : matched.slab_end_day} days)`,
        days: billableDays,
        rate: r,
        amount: storageCharge
      });
    } else {
      let rem = billableDays;
      for (const s of slabs) {
        if (rem <= 0) break;
        const start = parseInt(s.slab_start_day, 10) || 1;
        const end = s.slab_end_day ? parseInt(s.slab_end_day, 10) : 999999;
        const span = Math.max(0, end - start + 1);
        const inThis = Math.min(rem, span);
        if (inThis > 0) {
          const r = parseFloat(s.rate) || 0;
          const amt = w * r * inThis;
          storageCharge += amt;
          breakdown.push({
            label: `Days ${start}–${end >= 99999 ? 'Beyond' : end}`,
            days: inThis,
            rate: r,
            amount: amt
          });
          rem -= inThis;
        }
      }
    }

    const unloadCharge = w * (parseFloat(tariffData.inwardUnloadingRate) || 0);
    const loadCharge = w * (parseFloat(tariffData.outwardLoadingRate) || 0);

    return {
      billableDays,
      storageCharge,
      unloadCharge,
      loadCharge,
      totalCost: storageCharge + unloadCharge + loadCharge,
      breakdown
    };
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, width: '100%', maxWidth: '100%', margin: '0 auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ColdIcon sx={{ fontSize: 36, color: '#0284c7' }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#0f172a' }}>
              External Cold Storage Facilities & Operator Terms
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              Manage rental terms, operator linkage, storage duration slabs, handling rates, and GST for external facilities
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => { fetchStorages(); fetchSuppliers(); }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            sx={{ bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' } }}
            startIcon={<AddIcon />}
            onClick={handleOpenNew}
          >
            Add Cold Storage Facility
          </Button>
        </Box>
      </Box>

      {/* Facilities List Table */}
      <Card sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: 2 }}>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper} elevation={0}>
              <Table size="small">
                <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', color: '#1e293b' }}>Facility Name</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#1e293b' }}>Operator / Vendor</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#1e293b' }}>Storage Location</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#1e293b' }}>Billing Basis & Slabs</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#1e293b' }} align="right">Rental Rate</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#1e293b' }} align="right">Handling (In / Out)</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#1e293b' }} align="center">GST %</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#1e293b' }} align="center">Status</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#1e293b' }} align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {storages.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 3, color: '#64748b' }}>
                        No cold storage facilities configured yet. Click "Add Cold Storage Facility" to set up your first external partner.
                      </TableCell>
                    </TableRow>
                  ) : (
                    storages.map((item) => (
                      <TableRow key={item.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#0369a1' }}>
                            {item.godown_name || item.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                            {item.print_name || item.printname || ''} {item.default_chamber ? `• ${item.default_chamber}` : ''}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {item.operator_name || item.resolved_operator_name || item.external_company || 'Unlinked'}
                          </Typography>
                          {item.gst_number && (
                            <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                              GSTIN: {item.gst_number}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={item.storage_location || 'Outside Factory'} 
                            size="small" 
                            variant="outlined" 
                            color={item.storage_location === 'Outside Factory' ? 'primary' : 'default'}
                            sx={{ fontSize: '11px', height: 22 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '12px' }}>
                            <strong>{item.billing_basis || 'Per Bag'}</strong> ({item.billing_method || 'Fixed Period'})
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#64748b' }}>
                            Slab: {item.storage_duration || 10} Days (Min: {item.min_billable_days || 10}d)
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#0f766e' }}>
                            {item.billing_basis === 'Per Bag' || (item.rate_per_bag && Number(item.rate_per_bag) > 0)
                              ? `₹${Number(item.rate_per_bag || 0).toFixed(2)} / Bag`
                              : item.billing_basis === 'Per Ton'
                              ? `₹${Number(item.rate_per_ton || 0).toFixed(2)} / Ton`
                              : `₹${Number(item.rate_per_kg || 0).toFixed(2)} / KG`}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="caption" sx={{ display: 'block', color: '#475569' }}>
                            In: <strong>₹{Number(item.inward_handling_rate || 0).toFixed(2)}</strong> / bag
                          </Typography>
                          <Typography variant="caption" sx={{ display: 'block', color: '#475569' }}>
                            Out: <strong>₹{Number(item.outward_handling_rate || 0).toFixed(2)}</strong> / bag
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip 
                            label={`${item.gst_rate !== undefined ? item.gst_rate : 18}%`} 
                            size="small" 
                            sx={{ height: 20, fontSize: '11px', bgcolor: '#f1f5f9' }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={item.status || 'Active'}
                            color={item.status === 'Active' ? 'success' : 'default'}
                            size="small"
                            sx={{ height: 22, fontSize: '11px' }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="Configure Day Slabs & Tariff">
                            <IconButton size="small" sx={{ color: '#0284c7' }} onClick={() => handleOpenTariffDialog(item)}>
                              <TuneIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit Facility Terms">
                            <IconButton size="small" color="primary" onClick={() => handleEdit(item)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Facility">
                            <IconButton size="small" color="error" onClick={() => handleDelete(item)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Facility Edit / Add Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ backgroundColor: '#0284c7', color: 'white', py: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ColdIcon />
            <Typography variant="h6" component="span" sx={{ fontWeight: 'bold' }}>
              {formData.id ? 'Edit Cold Storage Facility & Terms' : 'Add External Cold Storage Facility'}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 3, pt: 3 }}>
          {message && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {message}
            </Alert>
          )}

          {/* Section 1: Facility & Operator Linkage */}
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#0369a1', display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <OperatorIcon fontSize="small" /> 1. Facility Identity & Cold Storage Operator
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Cold Storage Facility Name *"
                value={formData.godown_name}
                onChange={(e) => setFormData({ ...formData, godown_name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Print / Display Name"
                value={formData.print_name}
                onChange={(e) => setFormData({ ...formData, print_name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Autocomplete
                size="small"
                options={suppliers}
                getOptionLabel={(opt) => opt.print_name || opt.name || ''}
                value={suppliers.find(s => s.id === formData.operator_id) || (formData.operator_name ? { name: formData.operator_name } : null)}
                onChange={handleOperatorSelect}
                freeSolo
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    label="Linked Operator (Supplier / Vendor) *" 
                    placeholder="Select or enter operator vendor"
                    helperText="Storage bills will be credited to this operator account"
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Operator GSTIN"
                value={formData.gst_number}
                onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })}
                placeholder="e.g. 33AAAAA0000A1Z5"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label="Contact Person"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label="Phone / Mobile"
                value={formData.phone_off}
                onChange={(e) => setFormData({ ...formData, phone_off: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                select
                size="small"
                label="Facility Status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <MenuItem value="Active">Active</MenuItem>
                <MenuItem value="Inactive">Inactive</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                multiline
                rows={1.5}
                label="External Facility Address & Location"
                value={formData.address1}
                onChange={(e) => setFormData({ ...formData, address1: e.target.value })}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          {/* Section 2: Storage Rental Terms */}
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#0369a1', display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <PriceIcon fontSize="small" /> 2. Agreed Storage Pricing & Duration Terms
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                select
                size="small"
                label="Billing Basis *"
                value={formData.billing_basis}
                onChange={(e) => setFormData({ ...formData, billing_basis: e.target.value })}
              >
                <MenuItem value="Per Bag">Per Bag / Unit</MenuItem>
                <MenuItem value="Per KG">Per KG</MenuItem>
                <MenuItem value="Per Ton">Per Ton / MT</MenuItem>
                <MenuItem value="Fixed Monthly">Fixed Monthly</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                select
                size="small"
                label="Billing Method"
                value={formData.billing_method}
                onChange={(e) => setFormData({ ...formData, billing_method: e.target.value })}
              >
                <MenuItem value="Fixed Period">Fixed Period (Slabs)</MenuItem>
                <MenuItem value="Daily">Daily Pro-rated</MenuItem>
                <MenuItem value="Monthly">Calendar Monthly</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Slab Duration (Days) *"
                value={formData.storage_duration}
                onChange={(e) => setFormData({ ...formData, storage_duration: e.target.value })}
                helperText="e.g. 10 days slab, 15 days slab"
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Rate per Bag (₹)"
                value={formData.rate_per_bag}
                onChange={(e) => setFormData({ ...formData, rate_per_bag: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Rate per KG (₹)"
                value={formData.rate_per_kg}
                onChange={(e) => setFormData({ ...formData, rate_per_kg: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Rate per Ton (₹)"
                value={formData.rate_per_ton}
                onChange={(e) => setFormData({ ...formData, rate_per_ton: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Min Billable Days"
                value={formData.min_billable_days}
                onChange={(e) => setFormData({ ...formData, min_billable_days: e.target.value })}
                helperText="Minimum chargeable days"
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          {/* Section 3: Handling & Auxiliary Charges */}
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#0369a1', display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <TransportIcon fontSize="small" /> 3. Handling, Insurance & GST
          </Typography>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Inward Handling (₹/bag)"
                value={formData.inward_handling_rate}
                onChange={(e) => setFormData({ ...formData, inward_handling_rate: e.target.value })}
                helperText="Loading into chamber"
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Outward Handling (₹/bag)"
                value={formData.outward_handling_rate}
                onChange={(e) => setFormData({ ...formData, outward_handling_rate: e.target.value })}
                helperText="Unloading / retrieval"
              />
            </Grid>
            <Grid item xs={12} sm={2}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Insurance (₹/bag)"
                value={formData.insurance_rate}
                onChange={(e) => setFormData({ ...formData, insurance_rate: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={2}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Mamool (₹/bag)"
                value={formData.mamool_rate}
                onChange={(e) => setFormData({ ...formData, mamool_rate: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={2}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="GST Rate (%)"
                value={formData.gst_rate}
                onChange={(e) => setFormData({ ...formData, gst_rate: e.target.value })}
                helperText="Standard is 18%"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label="Default Chamber / Room"
                value={formData.default_chamber}
                onChange={(e) => setFormData({ ...formData, default_chamber: e.target.value })}
                placeholder="e.g. Chamber 1, Vault A"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label="Operating Temperature"
                value={formData.temperature_range}
                onChange={(e) => setFormData({ ...formData, temperature_range: e.target.value })}
                placeholder="e.g. 2°C - 8°C"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label="Facility Capacity (KG)"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Contract / SLA Remarks"
                value={formData.cold_storage_remarks}
                onChange={(e) => setFormData({ ...formData, cold_storage_remarks: e.target.value })}
                placeholder="e.g. Operator invoice due on 1st of every month; free inward loading if > 500 bags"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, backgroundColor: '#f8fafc' }}>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            sx={{ bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' } }}
            onClick={handleSave} 
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Facility Configuration'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Tariff & Day Slabs Configuration Dialog */}
      <Dialog
        open={openTariffDialog}
        onClose={() => setOpenTariffDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ backgroundColor: '#1e3a8a', color: 'white', py: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <TuneIcon />
            <Box>
              <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                Storage Day Slabs & Tariff Configuration
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)' }}>
                {selectedGodownForTariff?.godown_name} • {selectedGodownForTariff?.operator_name || 'AgroCold Services'}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 3, pt: 3 }}>
          {tariffMessage && (
            <Alert
              severity={tariffMessage.includes('Error') ? 'error' : 'success'}
              sx={{ mb: 2 }}
            >
              {tariffMessage}
            </Alert>
          )}

          {loadingTariff ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box>
              {/* Section 1: Slab Calculation Method */}
              <Card variant="outlined" sx={{ mb: 2.5, p: 2, backgroundColor: '#f8fafc' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1e3a8a', mb: 1 }}>
                  1. Slab Billing Calculation Method
                </Typography>
                <RadioGroup
                  row
                  value={tariffData.calculationType}
                  onChange={(e) => setTariffData({ ...tariffData, calculationType: e.target.value })}
                >
                  <FormControlLabel
                    value="Progressive"
                    control={<Radio color="primary" />}
                    label={
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          Progressive Slabs
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Each slab rate applies only to the days within its slab range (e.g., Days 1–15 @ rate 1, Days 16–30 @ rate 2)
                        </Typography>
                      </Box>
                    }
                    sx={{ mb: 1, mr: 4 }}
                  />
                  <FormControlLabel
                    value="Whole Duration"
                    control={<Radio color="primary" />}
                    label={
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          Whole-Duration Slabs
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          The rate for the attained slab duration applies to all billable calendar days
                        </Typography>
                      </Box>
                    }
                  />
                </RadioGroup>
              </Card>

              {/* Section 2: Configurable Day Slabs */}
              <Box sx={{ mb: 2.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1e3a8a' }}>
                    2. Storage Day Slabs (Per-KG-Per-Day Rates)
                  </Typography>
                  <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={handleAddSlab}>
                    Add Day Slab Range
                  </Button>
                </Box>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead sx={{ backgroundColor: '#f1f5f9' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Slab Name / Range</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="center">Start Day</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="center">End Day (or Beyond)</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="right">Rate (₹ / KG / Day)</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="center">Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {tariffData.storageSlabs.map((slab, sIdx) => (
                        <TableRow key={sIdx}>
                          <TableCell sx={{ fontWeight: 600, color: '#1e3a8a' }}>
                            Slab {sIdx + 1}: Days {slab.slab_start_day}–{slab.slab_end_day >= 99999 ? 'Beyond' : slab.slab_end_day}
                          </TableCell>
                          <TableCell align="center">
                            <TextField
                              size="small"
                              type="number"
                              value={slab.slab_start_day}
                              onChange={(e) => handleSlabChange(sIdx, 'slab_start_day', e.target.value)}
                              sx={{ width: 90 }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <TextField
                              size="small"
                              type="number"
                              value={slab.slab_end_day >= 99999 ? '' : slab.slab_end_day}
                              onChange={(e) => handleSlabChange(sIdx, 'slab_end_day', e.target.value ? e.target.value : 99999)}
                              placeholder="Beyond"
                              sx={{ width: 100 }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <TextField
                              size="small"
                              type="number"
                              value={slab.rate}
                              onChange={(e) => handleSlabChange(sIdx, 'rate', e.target.value)}
                              inputProps={{ step: '0.01' }}
                              sx={{ width: 110 }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteSlab(sIdx)}
                              disabled={tariffData.storageSlabs.length <= 1}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              {/* Section 3: Labour & Contract Terms */}
              <Card variant="outlined" sx={{ mb: 2.5, p: 2, backgroundColor: '#f8fafc' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1e3a8a', mb: 1.5 }}>
                  3. Separate Labour Charges & Contract Policy
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Inward Unloading (₹/KG)"
                      value={tariffData.inwardUnloadingRate}
                      onChange={(e) => setTariffData({ ...tariffData, inwardUnloadingRate: e.target.value })}
                      helperText="Calculated on actual handled kg"
                      inputProps={{ step: '0.01' }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Outward Loading (₹/KG)"
                      value={tariffData.outwardLoadingRate}
                      onChange={(e) => setTariffData({ ...tariffData, outwardLoadingRate: e.target.value })}
                      helperText="Calculated on actual handled kg"
                      inputProps={{ step: '0.01' }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Free Storage Days"
                      value={tariffData.freeDays}
                      onChange={(e) => setTariffData({ ...tariffData, freeDays: e.target.value })}
                      helperText="Contractual grace days"
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Min Billable Days"
                      value={tariffData.minDays}
                      onChange={(e) => setTariffData({ ...tariffData, minDays: e.target.value })}
                      helperText="Minimum chargeable days"
                    />
                  </Grid>
                </Grid>
              </Card>

              {/* Section 4: Live Slab Calculation Simulator */}
              <Card variant="outlined" sx={{ p: 2, backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <CalcIcon sx={{ color: '#1e3a8a' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1e3a8a' }}>
                    4. Tariff Calculation Simulator & Verification
                  </Typography>
                </Box>
                <Grid container spacing={2} sx={{ mb: 1.5 }}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Test Weight (KG)"
                      value={simWeight}
                      onChange={(e) => setSimWeight(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Test Storage Duration (Calendar Days)"
                      value={simDays}
                      onChange={(e) => setSimDays(e.target.value)}
                      helperText="Inclusive of inward & outward dates"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Box sx={{ p: 1, backgroundColor: '#ffffff', borderRadius: 1, border: '1px solid #bfdbfe' }}>
                      <Typography variant="caption" color="text.secondary">Total Simulated Cost:</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1e3a8a' }}>
                        ₹{calculateSimulation().totalCost.toFixed(2)}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>

                {/* Simulation Breakdown Table */}
                <Table size="small" sx={{ backgroundColor: '#ffffff', borderRadius: 1 }}>
                  <TableHead sx={{ backgroundColor: '#dbeafe' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', py: 0.5 }}>Charge Type / Slab Breakdown</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', py: 0.5 }}>Billable Days / Qty</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', py: 0.5 }}>Applicable Rate</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', py: 0.5 }}>Amount (₹)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {calculateSimulation().breakdown.map((b, bIdx) => (
                      <TableRow key={bIdx}>
                        <TableCell sx={{ py: 0.5 }}>{b.label}</TableCell>
                        <TableCell align="center" sx={{ py: 0.5 }}>{b.days} Days</TableCell>
                        <TableCell align="right" sx={{ py: 0.5 }}>₹{b.rate.toFixed(2)} / kg / day</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', py: 0.5 }}>₹{b.amount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell sx={{ py: 0.5 }}>Inward Unloading Labour ({simWeight} kg)</TableCell>
                      <TableCell align="center" sx={{ py: 0.5 }}>—</TableCell>
                      <TableCell align="right" sx={{ py: 0.5 }}>₹{parseFloat(tariffData.inwardUnloadingRate || 0).toFixed(2)} / kg</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', py: 0.5 }}>₹{calculateSimulation().unloadCharge.toFixed(2)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ py: 0.5 }}>Outward Loading Labour ({simWeight} kg)</TableCell>
                      <TableCell align="center" sx={{ py: 0.5 }}>—</TableCell>
                      <TableCell align="right" sx={{ py: 0.5 }}>₹{parseFloat(tariffData.outwardLoadingRate || 0).toFixed(2)} / kg</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', py: 0.5 }}>₹{calculateSimulation().loadCharge.toFixed(2)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Card>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, backgroundColor: '#f8fafc' }}>
          <Button onClick={() => setOpenTariffDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            sx={{ bgcolor: '#1e3a8a', '&:hover': { bgcolor: '#172554' } }}
            onClick={handleSaveTariff}
            disabled={savingTariff}
          >
            {savingTariff ? 'Saving Tariff...' : 'Save Tariff & Day Slabs'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ColdStorageMaster;
