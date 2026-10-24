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
  TablePagination,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Card,
  CardContent
} from '@mui/material';
import {
  CompareArrows as TransferIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Print as PrintIcon,
  FileDownload as ExportIcon,
  Business as GodownIcon,
  Inventory as ItemIcon,
  ReceiptLong as BillIcon,
  AcUnit as ColdStorageIcon,
  Edit as EditIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  LocalShipping as TruckIcon,
  CheckCircle as CheckCircleIcon,
  Assessment as AssessmentIcon,
  Scale as ScaleIcon
} from '@mui/icons-material';
import { printHtml } from '../utils/printHelper';
import ColdStorageTransferStatementModal from './coldStorage/ColdStorageTransferStatementModal';
import { useNavigate } from 'react-router-dom';

const GodownTransfer = ({ initialView = 'create' }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(initialView === 'display' ? 'display' : 'create');
  const [godowns, setGodowns] = useState([]);
  const [godownItems, setGodownItems] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  useEffect(() => {
    if (initialView) {
      setActiveTab(initialView === 'display' ? 'display' : 'create');
    }
  }, [initialView]);

  // Modal State for Cold Storage Bill Statement
  const [openBillModal, setOpenBillModal] = useState(false);
  const [selectedTransferRow, setSelectedTransferRow] = useState(null);

  // Modal State for Editing Transfer
  const [editingTransfer, setEditingTransfer] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    s_no: 'TRF-1',
    transfer_date: new Date().toISOString().split('T')[0],
    from_godown_id: '',
    from_godown_name: '',
    to_godown_id: '',
    to_godown_name: '',
    item_name: '',
    lot_no: '',
    qty: '',
    weight: '',
    vehicle_no: '',
    driver_name: '',
    driver_phone: '',
    transporter_name: '',
    loadman_name: '',
    loadman_charges: '',
    handling_amount: '',
    storage_rate: '',
    insurance_charges: '',
    remarks: ''
  });

  const fetchNextSNo = async () => {
    try {
      const res = await fetch('/api/godown-transfers/next-sno');
      const data = await res.json();
      if (data && data.next_s_no) {
        setFormData(prev => ({ ...prev, s_no: data.next_s_no }));
      }
    } catch (e) {
      console.error('Error fetching next transfer s_no:', e);
    }
  };

  const [selectedItemDetails, setSelectedItemDetails] = useState(null);

  // Fetch Godown Master List
  useEffect(() => {
    fetch('/api/masters/godown_master')
      .then(res => res.json())
      .then(result => {
        const list = Array.isArray(result) ? result : (result.data || []);
        if (Array.isArray(list)) {
          setGodowns(list);
        }
      })
      .catch(err => console.error('Error fetching godown master:', err));

    fetchTransfers();
    fetchNextSNo();
  }, []);

  // Fetch all transfer entries
  const fetchTransfers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/godown-transfers');
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.data || []);
      if (Array.isArray(list)) {
        setTransfers(list);
      }
    } catch (err) {
      console.error('Error fetching godown transfers:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper to check if a godown is cold storage
  const checkIsColdStorage = (godownObjOrName, godownId) => {
    if (godownId) {
      const g = godowns.find(x => String(x.id) === String(godownId));
      if (g) {
        const gName = (g.godown_name || '').toLowerCase();
        const gType = (g.godown_type || '').toLowerCase();
        const gLoc = (g.storage_location || '').toLowerCase();
        if (gName.includes('cold') || gType.includes('cold') || gLoc.includes('outside') || g.is_cold_storage === 1 || String(g.id) === '2') {
          return true;
        }
      }
      if (String(godownId) === '2') return true;
    }
    if (!godownObjOrName) return false;
    if (typeof godownObjOrName === 'object') {
      const gName = (godownObjOrName.godown_name || '').toLowerCase();
      const gType = (godownObjOrName.godown_type || '').toLowerCase();
      const gLoc = (godownObjOrName.storage_location || '').toLowerCase();
      return gName.includes('cold') || gType.includes('cold') || gLoc.includes('outside') || godownObjOrName.is_cold_storage === 1 || String(godownObjOrName.id) === '2';
    }
    const nameStr = String(godownObjOrName).toLowerCase();
    const g = godowns.find(x => (x.godown_name || '').toLowerCase() === nameStr);
    if (g) {
      const gType = (g.godown_type || '').toLowerCase();
      const gLoc = (g.storage_location || '').toLowerCase();
      return nameStr.includes('cold') || gType.includes('cold') || gLoc.includes('outside') || g.is_cold_storage === 1 || String(g.id) === '2';
    }
    return nameStr.includes('cold') || nameStr.includes('storage') || String(godownObjOrName) === '2';
  };

  // Update existing transfer record
  const handleUpdateTransfer = async (e) => {
    if (e) e.preventDefault();
    if (!editingTransfer || updating) return;
    setUpdating(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await fetch(`/api/godown-transfers/${editingTransfer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTransfer)
      });
      const data = await res.json();
      if (res.ok && (data.success || data.message)) {
        setMessage({ type: 'success', text: 'Transfer details updated successfully & Cold Storage synchronized!' });
        setEditingTransfer(null);
        fetchTransfers();
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to update transfer' });
      }
    } catch (err) {
      console.error('Error updating transfer:', err);
      setMessage({ type: 'error', text: 'Network error updating transfer' });
    } finally {
      setUpdating(false);
    }
  };

  // Fetch tariff rate if selecting cold storage
  const fetchColdStorageTariff = async (godownId) => {
    if (!godownId) return;
    try {
      const res = await fetch(`/api/cold-storage/tariff/${godownId}`);
      const data = await res.json();
      if (data && data.success && data.tariff) {
        const t = data.tariff;
        const defaultRate = t.storageSlabs?.[0]?.rate || 0.20;
        const defaultHandling = t.inwardUnloadingRate || t.outwardLoadingRate || 0.50;
        setFormData(prev => ({
          ...prev,
          storage_rate: prev.storage_rate || String(defaultRate),
          handling_amount: prev.handling_amount || (prev.weight ? String(Number(prev.weight) * defaultHandling) : '')
        }));
      }
    } catch (_) {}
  };

  // Handle From Godown Change
  const handleFromGodownChange = async (godownId) => {
    const selectedG = godowns.find(g => String(g.id) === String(godownId));
    const gName = selectedG ? selectedG.godown_name : '';

    setFormData(prev => ({
      ...prev,
      from_godown_id: godownId,
      from_godown_name: gName,
      item_name: '',
      lot_no: '',
      qty: '',
      weight: ''
    }));

    setSelectedItemDetails(null);

    if (checkIsColdStorage(selectedG, godownId)) {
      fetchColdStorageTariff(godownId);
    }

    if (!godownId) {
      setGodownItems([]);
      return;
    }

    setLoadingItems(true);
    try {
      const res = await fetch(`/api/godown-transfers/godown-items/${godownId}`);
      const data = await res.json();
      if (data && Array.isArray(data.items)) {
        setGodownItems(data.items);
      } else {
        setGodownItems([]);
      }
    } catch (err) {
      console.error('Error fetching items for godown:', err);
      setGodownItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  // Handle To Godown Select
  const handleToGodownChange = (godownId) => {
    const selectedG = godowns.find(g => String(g.id) === String(godownId));
    setFormData(prev => ({
      ...prev,
      to_godown_id: godownId,
      to_godown_name: selectedG ? selectedG.godown_name : ''
    }));

    if (checkIsColdStorage(selectedG, godownId)) {
      fetchColdStorageTariff(godownId);
    }
  };

  // Handle Item Select
  const handleItemChange = (e) => {
    const val = e.target.value;
    if (!val) {
      setFormData(prev => ({ ...prev, item_name: '', lot_no: '', qty: '', weight: '' }));
      setSelectedItemDetails(null);
      return;
    }

    const [iName, lNo] = val.split('||');
    const matched = godownItems.find(i => i.item_name === iName && i.lot_no === lNo);

    if (matched) {
      setSelectedItemDetails(matched);
      const q = matched.balance_qty || 1;
      const wt = (q * (matched.unit_weight || 1)) || 1;
      setFormData(prev => ({
        ...prev,
        item_name: matched.item_name,
        lot_no: matched.lot_no || 'LOT-GENERAL',
        qty: q,
        weight: wt
      }));
    } else {
      setFormData(prev => ({ ...prev, item_name: val }));
    }
  };

  // Handle Submit Form
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setMessage({ type: '', text: '' });

    if (!formData.from_godown_id || !formData.to_godown_id) {
      setMessage({ type: 'error', text: 'Please select both From Godown and To Godown' });
      return;
    }

    if (formData.from_godown_id === formData.to_godown_id) {
      setMessage({ type: 'error', text: 'From Godown and To Godown cannot be the same' });
      return;
    }

    if (!formData.item_name) {
      setMessage({ type: 'error', text: 'Please select an item to transfer' });
      return;
    }

    if (!formData.qty || parseFloat(formData.qty) <= 0) {
      setMessage({ type: 'error', text: 'Please enter a valid transfer quantity' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/godown-transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({
          type: data.warning ? 'error' : 'success',
          text: data.message || 'Godown transfer recorded successfully!'
        });
        setFormData({
          s_no: '',
          transfer_date: new Date().toISOString().split('T')[0],
          from_godown_id: '',
          from_godown_name: '',
          to_godown_id: '',
          to_godown_name: '',
          item_name: '',
          lot_no: '',
          qty: '',
          weight: '',
          vehicle_no: '',
          driver_name: '',
          driver_phone: '',
          transporter_name: '',
          loadman_name: '',
          loadman_charges: '',
          handling_amount: '',
          storage_rate: '',
          insurance_charges: '',
          remarks: ''
        });
        fetchNextSNo();
        setGodownItems([]);
        setSelectedItemDetails(null);
        fetchTransfers();
        setActiveTab('display');
      } else {
        setMessage({ type: 'error', text: data.message || 'Error recording transfer' });
      }
    } catch (err) {
      console.error('Error submitting godown transfer:', err);
      setMessage({ type: 'error', text: 'Network error recording transfer' });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Transfer
  const handleDelete = async (id) => {
    const confirmed = window.__appConfirm ? await window.__appConfirm({
      title: 'Confirm Transfer Deletion',
      message: 'Are you sure you want to delete this transfer entry?',
      confirmText: 'Delete Transfer',
      confirmColor: 'error'
    }) : window.confirm('Are you sure you want to delete this transfer entry?');
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/godown-transfers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Transfer entry deleted successfully' });
        fetchTransfers();
      }
    } catch (err) {
      console.error('Error deleting transfer:', err);
    }
  };

  // Open Cold Storage Bill Modal
  const handleOpenBill = (row) => {
    setSelectedTransferRow(row);
    setOpenBillModal(true);
  };

  // Export CSV
  const handleExportCSV = () => {
    let csv = 'S.No,Transfer Date,From Godown,To Godown,Item Name,Lot No,Quantity,Weight (Kg),Driver,Vehicle No,Loadman Charges,Handling Amount,Storage Rate,Insurance,Remarks\n';
    transfers.forEach(t => {
      csv += `"${t.s_no}","${t.transfer_date}","${t.from_godown_name}","${t.to_godown_name}","${t.item_name}","${t.lot_no}",${t.qty},${t.weight},"${t.driver_name || ''}","${t.vehicle_no || ''}",${t.loadman_charges || 0},${t.handling_amount || 0},${t.storage_rate || 0},${t.insurance_charges || 0},"${t.remarks || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Godown_Transfers_${new Date().toISOString().substring(0, 10)}.csv`;
    link.click();
  };

  // Print List
  const handlePrint = () => {
    let printContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="text-align: center; color: #1e3a8a; margin-bottom: 5px;">Godown to Godown Transfer Register</h2>
        <p style="text-align: center; color: #64748b; font-size: 13px; margin-top: 0;">Generated on: ${new Date().toLocaleString()}</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px;">
          <thead>
            <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
              <th style="padding: 8px; border: 1px solid #cbd5e1;">S.No</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">Date</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">From Godown</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">To Godown</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">Item Name</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">Lot No</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">Qty</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">Weight (Kg)</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">Driver & Vehicle</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">Remarks</th>
            </tr>
          </thead>
          <tbody>
    `;

    transfers.forEach((t) => {
      printContent += `
        <tr>
          <td style="padding: 6px; border: 1px solid #e2e8f0; text-align: center;">${t.s_no}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0;">${t.transfer_date}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0; font-weight: bold;">${t.from_godown_name}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0; font-weight: bold; color: #2563eb;">${t.to_godown_name}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0;">${t.item_name}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0;">${t.lot_no}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${t.qty}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0; text-align: right;">${t.weight}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0;">${t.driver_name || ''} ${t.vehicle_no ? `(${t.vehicle_no})` : ''}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0;">${t.remarks || '-'}</td>
        </tr>
      `;
    });

    printContent += `
          </tbody>
        </table>
      </div>
    `;

    printHtml(printContent, 'Godown_Transfers_Report');
  };

  const filteredTransfers = transfers.filter(t => {
    const term = searchTerm.toLowerCase();
    return (
      (t.s_no || '').toLowerCase().includes(term) ||
      (t.from_godown_name || '').toLowerCase().includes(term) ||
      (t.to_godown_name || '').toLowerCase().includes(term) ||
      (t.item_name || '').toLowerCase().includes(term) ||
      (t.lot_no || '').toLowerCase().includes(term) ||
      (t.driver_name || '').toLowerCase().includes(term) ||
      (t.vehicle_no || '').toLowerCase().includes(term)
    );
  });

  return (
    <Container maxWidth={false} sx={{ py: 3, px: { xs: 2, sm: 3 }, bgcolor: '#f8fafc', minHeight: '100vh' }}>
      {/* Header Banner */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: 3, 
          mb: 3, 
          borderRadius: 3, 
          border: '1px solid #e2e8f0', 
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <Box sx={{ bgcolor: '#eff6ff', p: 2, borderRadius: 3, color: '#2563eb', display: 'flex', boxShadow: 'inset 0 2px 4px rgba(37,99,235,0.1)' }}>
              <TransferIcon sx={{ fontSize: 36 }} />
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>
                Godown Transfer & Cold Storage Integration Module
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500, mt: 0.5 }}>
                Streamlined warehouse stock transfers, transport & driver tracking, with automated Cold Storage billing synchronization.
              </Typography>
            </Box>
          </Box>

          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined"
              size="medium"
              startIcon={<RefreshIcon className={loading ? 'animate-spin' : ''} />}
              onClick={fetchTransfers}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, borderColor: '#cbd5e1', color: '#334155', bgcolor: '#ffffff' }}
            >
              Refresh
            </Button>
            <Button
              variant="outlined"
              color="success"
              size="medium"
              startIcon={<ExportIcon />}
              onClick={handleExportCSV}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#ffffff' }}
            >
              Export CSV
            </Button>
            <Button
              variant="contained"
              size="medium"
              startIcon={<PrintIcon />}
              onClick={handlePrint}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800, bgcolor: '#1e3a8a', '&:hover': { bgcolor: '#1d4ed8' }, boxShadow: '0 4px 6px -1px rgba(30,58,138,0.2)' }}
            >
              Print Register
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Message Toast */}
      {message.text && (
        <Alert severity={message.type === 'error' ? 'error' : 'success'} sx={{ mb: 3, borderRadius: 2.5, fontWeight: 600 }} onClose={() => setMessage({ type: '', text: '' })}>
          {message.text}
        </Alert>
      )}

      {/* Navigation Tabs */}
      <Paper elevation={0} sx={{ p: 1, mb: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff', display: 'inline-flex', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}>
        <Tabs
          value={activeTab}
          onChange={(e, val) => setActiveTab(val)}
          sx={{
            minHeight: 44,
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 800, fontSize: '14px', borderRadius: 2, minHeight: 40, px: 3, transition: 'all 0.2s' },
            '& .Mui-selected': { bgcolor: '#eff6ff', color: '#1d4ed8 !important' },
            '& .MuiTabs-indicator': { display: 'none' }
          }}
        >
          <Tab value="create" label="New Transfer Entry" icon={<AddIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
          <Tab value="display" label={`Transfer Register (${transfers.length})`} icon={<TransferIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* ================= TAB 1: CREATE GODOWN TRANSFER ================= */}
      {activeTab === 'create' && (
        <Grid container spacing={3}>
          {/* Main Form Section */}
          <Grid item xs={12} lg={8}>
            <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)' }}>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={3} pb={2} borderBottom="2px solid #f1f5f9">
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <AddIcon sx={{ color: '#2563eb' }} />
                  Create Stock Transfer Voucher
                </Typography>
                <Chip label={`Voucher S.No: ${formData.s_no}`} color="primary" variant="outlined" sx={{ fontWeight: 800, fontFamily: 'monospace', borderRadius: 1.5 }} />
              </Box>

              <form onSubmit={handleSubmit}>
                <Stack spacing={3.5}>
                  {/* SECTION 1: Routing */}
                  <Box sx={{ p: 2.5, borderRadius: 2.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#334155', textTransform: 'uppercase', mb: 2, fontSize: '12px', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <GodownIcon sx={{ fontSize: 16, color: '#2563eb' }} />
                      1. Transfer Routing & Schedule
                    </Typography>
                    <Grid container spacing={2.5}>
                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Transfer S.No"
                          required
                          value={formData.s_no}
                          onChange={(e) => setFormData({ ...formData, s_no: e.target.value })}
                          InputProps={{ style: { fontFamily: 'monospace', fontWeight: 700, backgroundColor: '#ffffff' } }}
                        />
                      </Grid>

                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          type="date"
                          fullWidth
                          size="small"
                          label="Transfer Date"
                          required
                          value={formData.transfer_date}
                          onChange={(e) => setFormData({ ...formData, transfer_date: e.target.value })}
                          InputProps={{ style: { backgroundColor: '#ffffff' } }}
                        />
                      </Grid>

                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          select
                          fullWidth
                          size="small"
                          label="From Godown (Source)"
                          required
                          value={formData.from_godown_id}
                          onChange={(e) => handleFromGodownChange(e.target.value)}
                          InputProps={{ style: { backgroundColor: '#ffffff' } }}
                        >
                          <MenuItem value="">-- Select Source Godown --</MenuItem>
                          {godowns.map(g => (
                            <MenuItem key={g.id} value={g.id}>
                              {checkIsColdStorage(g, g.id) ? '❄️ ' : '📍 '} {g.godown_name} ({g.area || 'Factory'})
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>

                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          select
                          fullWidth
                          size="small"
                          label="To Godown (Destination)"
                          required
                          value={formData.to_godown_id}
                          onChange={(e) => handleToGodownChange(e.target.value)}
                          InputProps={{ style: { backgroundColor: '#ffffff' } }}
                        >
                          <MenuItem value="">-- Select Destination Godown --</MenuItem>
                          {godowns
                            .filter(g => String(g.id) !== String(formData.from_godown_id))
                            .map(g => (
                              <MenuItem key={g.id} value={g.id}>
                                {checkIsColdStorage(g, g.id) ? '❄️ ' : '🚚 '} {g.godown_name} ({g.area || 'Storage'})
                              </MenuItem>
                            ))
                          }
                        </TextField>
                      </Grid>
                    </Grid>
                  </Box>

                  {/* SECTION 2: Item Selection */}
                  <Box sx={{ p: 2.5, borderRadius: 2.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#334155', textTransform: 'uppercase', mb: 2, fontSize: '12px', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ItemIcon sx={{ fontSize: 16, color: '#0284c7' }} />
                      2. Item Stock & Lot Selection
                    </Typography>
                    <Grid container spacing={2.5}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          select
                          fullWidth
                          size="small"
                          label={`Select Item & Lot from ${formData.from_godown_name || 'Source Godown'} ${loadingItems ? '(Loading...)' : ''}`}
                          required
                          value={formData.item_name && formData.lot_no ? `${formData.item_name}||${formData.lot_no}` : ''}
                          onChange={handleItemChange}
                          disabled={!formData.from_godown_id || loadingItems}
                          InputProps={{ style: { backgroundColor: '#ffffff' } }}
                        >
                          <MenuItem value="">
                            {!formData.from_godown_id 
                              ? '⚠️ Please select Source Godown first' 
                              : godownItems.length === 0 
                                ? 'No stock available in this godown' 
                                : '-- Select Item to Transfer --'}
                          </MenuItem>
                          {godownItems.map(item => (
                            <MenuItem key={`${item.item_name}||${item.lot_no}`} value={`${item.item_name}||${item.lot_no}`}>
                              📦 {item.item_name} | Lot: {item.lot_no} | Avail Qty: {item.balance_qty} | Wt: {item.total_weight} Kg
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>

                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Lot / Batch No"
                          value={formData.lot_no}
                          onChange={(e) => setFormData({ ...formData, lot_no: e.target.value })}
                          InputProps={{ style: { fontFamily: 'monospace', fontWeight: 700, backgroundColor: '#ffffff' } }}
                        />
                      </Grid>

                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          type="number"
                          fullWidth
                          size="small"
                          label="Transfer Quantity"
                          required
                          value={formData.qty}
                          onChange={(e) => {
                            const nextQty = e.target.value;
                            const unitWeight = Number(selectedItemDetails?.unit_weight) || 0;
                            setFormData(prev => ({
                              ...prev,
                              qty: nextQty,
                              weight: nextQty === '' ? '' : String(Number(nextQty) * unitWeight)
                            }));
                          }}
                          InputProps={{ style: { fontWeight: 800, color: '#1d4ed8', backgroundColor: '#ffffff' } }}
                        />
                      </Grid>
                    </Grid>
                  </Box>

                  {/* SECTION 3: Transport & Charges */}
                  <Box sx={{ p: 2.5, borderRadius: 2.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#334155', textTransform: 'uppercase', mb: 2, fontSize: '12px', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TruckIcon sx={{ fontSize: 16, color: '#15803d' }} />
                      3. Vehicle Transport, Driver & Operational Charges
                    </Typography>
                    <Grid container spacing={2.5}>
                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Vehicle / Lorry No"
                          placeholder="e.g. TN-38-BZ-1234"
                          value={formData.vehicle_no}
                          onChange={(e) => setFormData({ ...formData, vehicle_no: e.target.value })}
                          InputProps={{ style: { fontFamily: 'monospace', backgroundColor: '#ffffff' } }}
                        />
                      </Grid>

                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Driver Name & Contact"
                          placeholder="Driver Name"
                          value={formData.driver_name}
                          onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
                          InputProps={{ style: { backgroundColor: '#ffffff' } }}
                        />
                      </Grid>

                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Transporter / Agency"
                          placeholder="Transport Name"
                          value={formData.transporter_name}
                          onChange={(e) => setFormData({ ...formData, transporter_name: e.target.value })}
                          InputProps={{ style: { backgroundColor: '#ffffff' } }}
                        />
                      </Grid>

                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Loadman / Worker Team"
                          placeholder="Loadman Team"
                          value={formData.loadman_name}
                          onChange={(e) => setFormData({ ...formData, loadman_name: e.target.value })}
                          InputProps={{ style: { backgroundColor: '#ffffff' } }}
                        />
                      </Grid>

                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          type="number"
                          fullWidth
                          size="small"
                          label="Labour Charges (₹)"
                          value={formData.loadman_charges}
                          onChange={(e) => setFormData({ ...formData, loadman_charges: e.target.value, handling_amount: e.target.value })}
                          InputProps={{ style: { backgroundColor: '#ffffff' } }}
                        />
                      </Grid>

                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          type="number"
                          fullWidth
                          size="small"
                          label="Handling Amount (₹)"
                          value={formData.handling_amount}
                          onChange={(e) => setFormData({ ...formData, handling_amount: e.target.value })}
                          InputProps={{ style: { fontWeight: 700, color: '#047857', backgroundColor: '#ffffff' } }}
                        />
                      </Grid>

                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          type="number"
                          fullWidth
                          size="small"
                          label="Storage Rate (₹ / Kg / Day)"
                          value={formData.storage_rate}
                          onChange={(e) => setFormData({ ...formData, storage_rate: e.target.value })}
                          InputProps={{ style: { fontWeight: 700, color: '#1d4ed8', backgroundColor: '#ffffff' } }}
                        />
                      </Grid>

                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          type="number"
                          fullWidth
                          size="small"
                          label="Insurance Charges (₹)"
                          value={formData.insurance_charges}
                          onChange={(e) => setFormData({ ...formData, insurance_charges: e.target.value })}
                          InputProps={{ style: { backgroundColor: '#ffffff' } }}
                        />
                      </Grid>

                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Transfer Remarks / Notes"
                          placeholder="e.g. Cold storage transfer reason or seasonal re-stacking notes..."
                          value={formData.remarks}
                          onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                          InputProps={{ style: { backgroundColor: '#ffffff' } }}
                        />
                      </Grid>
                    </Grid>
                  </Box>

                  <Box pt={1} display="flex" justifyContent="flex-end">
                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      disabled={submitting}
                      startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <TransferIcon />}
                      sx={{ 
                        borderRadius: 2.5, 
                        px: 6, 
                        py: 1.5, 
                        fontWeight: 800, 
                        textTransform: 'none', 
                        bgcolor: '#2563eb', 
                        '&:hover': { bgcolor: '#1d4ed8' },
                        boxShadow: '0 4px 12px rgba(37,99,235,0.25)'
                      }}
                    >
                      {submitting ? 'Recording Transfer...' : 'Submit Godown Transfer'}
                    </Button>
                  </Box>
                </Stack>
              </form>
            </Paper>
          </Grid>

          {/* Right Live Summary Sidebar */}
          <Grid item xs={12} lg={4}>
            <Stack spacing={3}>
              <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AssessmentIcon sx={{ color: '#2563eb' }} />
                  Transfer Summary & Flow
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Stack spacing={2}>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Source Godown</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 800, color: '#1e3a8a' }}>
                      {formData.from_godown_name ? (checkIsColdStorage(formData.from_godown_name, formData.from_godown_id) ? `❄️ ${formData.from_godown_name}` : `📍 ${formData.from_godown_name}`) : 'Not Selected'}
                    </Typography>
                  </Box>

                  <Box sx={{ textAlign: 'center', my: -1 }}>
                    <Chip label="➔ Transfer Path ➔" size="small" sx={{ fontWeight: 800, bgcolor: '#eff6ff', color: '#1d4ed8' }} />
                  </Box>

                  <Box>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Destination Godown</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 800, color: '#15803d' }}>
                      {formData.to_godown_name ? (checkIsColdStorage(formData.to_godown_name, formData.to_godown_id) ? `❄️ ${formData.to_godown_name}` : `🚚 ${formData.to_godown_name}`) : 'Not Selected'}
                    </Typography>
                  </Box>

                  <Divider />

                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>Selected Item:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a' }}>{formData.item_name || '-'}</Typography>
                  </Box>

                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>Lot / Batch No:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800, fontFamily: 'monospace', color: '#2563eb' }}>{formData.lot_no || '-'}</Typography>
                  </Box>

                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>Quantity:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 900, color: '#0369a1' }}>{formData.qty || '0'}</Typography>
                  </Box>

                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>Estimated Weight:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: '#475569' }}>{formData.weight ? `${formData.weight} Kg` : '0 Kg'}</Typography>
                  </Box>

                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>Handling Charges:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: '#047857' }}>₹{formData.handling_amount || '0.00'}</Typography>
                  </Box>
                </Stack>
              </Paper>

              <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #bae6fd', bgcolor: '#f0f9ff', p: 1 }}>
                <CardContent>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0369a1', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ColdStorageIcon sx={{ fontSize: 18 }} />
                    Cold Storage Sync Notice
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#0369a1', lineHeight: 1.6, fontSize: '13px' }}>
                    When transferring stock into or out of a Cold Storage facility (marked with ❄️), the system automatically updates chamber stock balances and generates valid Cold Storage Bill line items for billing reconciliation.
                  </Typography>
                </CardContent>
              </Card>
            </Stack>
          </Grid>
        </Grid>
      )}

      {/* ================= TAB 2: REGISTER & DISPLAY ================= */}
      {activeTab === 'display' && (
        <Stack spacing={3}>
          {/* KPI Summary Cards */}
          <Grid container spacing={3}>
            <Grid item xs={12} sm={4}>
              <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#ffffff' }}>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Transfers</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 900, color: '#0f172a', mt: 0.5 }}>{transfers.length}</Typography>
                </Box>
                <Box sx={{ p: 2, bgcolor: '#eff6ff', borderRadius: 2.5, color: '#2563eb' }}>
                  <TransferIcon sx={{ fontSize: 28 }} />
                </Box>
              </Paper>
            </Grid>

            <Grid item xs={12} sm={4}>
              <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#ffffff' }}>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cold Storage Linked</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 900, color: '#0284c7', mt: 0.5 }}>
                    {transfers.filter(t => checkIsColdStorage(t.from_godown_name, t.from_godown_id) || checkIsColdStorage(t.to_godown_name, t.to_godown_id)).length}
                  </Typography>
                </Box>
                <Box sx={{ p: 2, bgcolor: '#e0f2fe', borderRadius: 2.5, color: '#0284c7' }}>
                  <ColdStorageIcon sx={{ fontSize: 28 }} />
                </Box>
              </Paper>
            </Grid>

            <Grid item xs={12} sm={4}>
              <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#ffffff' }}>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Handling Charges</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 900, color: '#15803d', mt: 0.5 }}>
                    ₹{transfers.reduce((acc, t) => acc + Number(t.handling_amount || t.loadman_charges || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </Typography>
                </Box>
                <Box sx={{ p: 2, bgcolor: '#dcfce7', borderRadius: 2.5, color: '#15803d' }}>
                  <BillIcon sx={{ fontSize: 28 }} />
                </Box>
              </Paper>
            </Grid>
          </Grid>

          {/* Register Table Container */}
          <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', overflow: 'hidden', bgcolor: '#ffffff', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)' }}>
            <Box p={2.5} bgcolor="#f8fafc" borderBottom="1px solid #e2e8f0" display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1e293b' }}>
                Godown Transfer Entries Register ({filteredTransfers.length})
              </Typography>
              
              <TextField
                size="small"
                placeholder="Search godown, item, lot, vehicle..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ color: '#94a3b8', mr: 1, fontSize: 18 }} />,
                  style: { borderRadius: 12, backgroundColor: '#ffffff', fontSize: '13px' }
                }}
                sx={{ width: 320 }}
              />
            </Box>

            <TableContainer sx={{ maxHeight: 600 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: '#f1f5f9', color: '#334155', fontWeight: 800, textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px' } }}>
                    <TableCell align="center" width="60">S.No</TableCell>
                    <TableCell>Transfer Date</TableCell>
                    <TableCell>From Godown</TableCell>
                    <TableCell>To Godown</TableCell>
                    <TableCell>Item Name</TableCell>
                    <TableCell>Lot No</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Weight (Kg)</TableCell>
                    <TableCell>Driver & Vehicle</TableCell>
                    <TableCell align="right">Handling (₹)</TableCell>
                    <TableCell align="right">Storage Rate</TableCell>
                    <TableCell align="center">CS Bill</TableCell>
                    <TableCell align="center" width="120">Actions</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {filteredTransfers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13} align="center" sx={{ py: 8, color: '#94a3b8', fontWeight: 600 }}>
                        No godown transfer entries found matching your search criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTransfers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((item) => {
                      const isCS = checkIsColdStorage(item.from_godown_name, item.from_godown_id) || checkIsColdStorage(item.to_godown_name, item.to_godown_id);
                      return (
                        <TableRow key={item.id} hover sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                          <TableCell align="center" sx={{ fontWeight: 800, fontFamily: 'monospace' }}>{item.s_no}</TableCell>
                          <TableCell sx={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>{item.transfer_date}</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: '#1e3a8a' }}>
                            {checkIsColdStorage(item.from_godown_name, item.from_godown_id) ? `❄️ ${item.from_godown_name}` : `📍 ${item.from_godown_name}`}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, color: '#15803d' }}>
                            {checkIsColdStorage(item.to_godown_name, item.to_godown_id) ? `❄️ ${item.to_godown_name}` : `🚚 ${item.to_godown_name}`}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 800, color: '#0f172a' }}>{item.item_name}</TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: '11px', color: '#2563eb', fontWeight: 700 }}>{item.lot_no}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 900, color: '#0369a1' }}>{item.qty}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: '#475569' }}>{item.weight}</TableCell>
                          <TableCell sx={{ fontSize: '11px', color: '#64748b' }}>
                            {item.driver_name ? <div style={{ fontWeight: 700, color: '#334155' }}>👤 {item.driver_name}</div> : null}
                            {item.vehicle_no ? <div style={{ fontFamily: 'monospace', color: '#2563eb' }}>🚚 {item.vehicle_no}</div> : null}
                            {!item.driver_name && !item.vehicle_no ? '-' : null}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, color: '#047857' }}>
                            ₹{Number(item.handling_amount || item.loadman_charges || 0).toFixed(2)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, color: '#1d4ed8' }}>
                            ₹{Number(item.storage_rate || 0).toFixed(2)}
                          </TableCell>
                          <TableCell align="center">
                            {isCS ? (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleOpenBill(item)}
                                startIcon={<ColdStorageIcon sx={{ fontSize: 14 }} />}
                                sx={{ textTransform: 'none', fontWeight: 800, fontSize: '11px', borderRadius: 1.5, borderColor: '#38bdf8', color: '#0284c7', bgcolor: '#f0f9ff' }}
                              >
                                CS Bill
                              </Button>
                            ) : (
                              <span style={{ color: '#cbd5e1' }}>-</span>
                            )}
                          </TableCell>
                          <TableCell align="center">
                            <Stack direction="row" spacing={0.5} justifyContent="center">
                              <Tooltip title="Edit Particulars">
                                <IconButton size="small" color="primary" onClick={() => setEditingTransfer({ ...item })} sx={{ bgcolor: '#eff6ff' }}>
                                  <EditIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete Entry">
                                <IconButton size="small" color="error" onClick={() => handleDelete(item.id)} sx={{ bgcolor: '#ffeeec' }}>
                                  <DeleteIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              rowsPerPageOptions={[10, 25, 50, 100]}
              component="div"
              count={filteredTransfers.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(e, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
            />
          </Paper>
        </Stack>
      )}

      {/* Edit Transfer Particulars Modal */}
      <Dialog open={Boolean(editingTransfer)} onClose={() => setEditingTransfer(null)} maxWidth="md" fullWidth>
        {editingTransfer && (
          <form onSubmit={handleUpdateTransfer}>
            <DialogTitle sx={{ bgcolor: '#1e3a8a', color: '#ffffff', fontWeight: 800, display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 2 }}>
              <Box display="flex" alignItems="center" gap={1.5}>
                <EditIcon sx={{ fontSize: 24 }} />
                <Typography variant="h6" fontWeight={800}>
                  Update Transfer Voucher #{editingTransfer.s_no}
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => setEditingTransfer(null)} sx={{ color: '#ffffff' }}>
                <CloseIcon />
              </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 3, bgcolor: '#f8fafc' }}>
              <Box mb={2.5} p={2} bgcolor="#ffffff" borderRadius={2} border="1px solid #e2e8f0" display="flex" justifyContent="space-between" alignItems="center" fontSize="13px">
                <div>From Godown: <strong>{editingTransfer.from_godown_name}</strong></div>
                <div>To Godown: <strong style={{ color: '#15803d' }}>{editingTransfer.to_godown_name}</strong></div>
                <div>Item: <strong>{editingTransfer.item_name}</strong> (<span style={{ color: '#2563eb' }}>{editingTransfer.qty} units</span>)</div>
              </Box>

              <Grid container spacing={2.5}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Vehicle / Lorry No"
                    value={editingTransfer.vehicle_no || ''}
                    onChange={(e) => setEditingTransfer({ ...editingTransfer, vehicle_no: e.target.value })}
                    InputProps={{ style: { backgroundColor: '#ffffff' } }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Driver Name"
                    value={editingTransfer.driver_name || ''}
                    onChange={(e) => setEditingTransfer({ ...editingTransfer, driver_name: e.target.value })}
                    InputProps={{ style: { backgroundColor: '#ffffff' } }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Driver Phone"
                    value={editingTransfer.driver_phone || ''}
                    onChange={(e) => setEditingTransfer({ ...editingTransfer, driver_phone: e.target.value })}
                    InputProps={{ style: { backgroundColor: '#ffffff' } }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Transporter Name"
                    value={editingTransfer.transporter_name || ''}
                    onChange={(e) => setEditingTransfer({ ...editingTransfer, transporter_name: e.target.value })}
                    InputProps={{ style: { backgroundColor: '#ffffff' } }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Loadman / Worker Name"
                    value={editingTransfer.loadman_name || ''}
                    onChange={(e) => setEditingTransfer({ ...editingTransfer, loadman_name: e.target.value })}
                    InputProps={{ style: { backgroundColor: '#ffffff' } }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    type="number"
                    fullWidth
                    size="small"
                    label="Labour Charges (₹)"
                    value={editingTransfer.loadman_charges !== undefined ? editingTransfer.loadman_charges : ''}
                    onChange={(e) => setEditingTransfer({
                      ...editingTransfer,
                      loadman_charges: e.target.value,
                      handling_amount: editingTransfer.handling_amount ? editingTransfer.handling_amount : e.target.value
                    })}
                    InputProps={{ style: { backgroundColor: '#ffffff' } }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    type="number"
                    fullWidth
                    size="small"
                    label="Handling Amount (₹)"
                    value={editingTransfer.handling_amount !== undefined ? editingTransfer.handling_amount : ''}
                    onChange={(e) => setEditingTransfer({ ...editingTransfer, handling_amount: e.target.value })}
                    InputProps={{ style: { backgroundColor: '#ffffff' } }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    type="number"
                    fullWidth
                    size="small"
                    label="Storage Rate (₹ / Kg / Day)"
                    value={editingTransfer.storage_rate !== undefined ? editingTransfer.storage_rate : ''}
                    onChange={(e) => setEditingTransfer({ ...editingTransfer, storage_rate: e.target.value })}
                    InputProps={{ style: { backgroundColor: '#ffffff' } }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    type="number"
                    fullWidth
                    size="small"
                    label="Insurance Charges (₹)"
                    value={editingTransfer.insurance_charges !== undefined ? editingTransfer.insurance_charges : ''}
                    onChange={(e) => setEditingTransfer({ ...editingTransfer, insurance_charges: e.target.value })}
                    InputProps={{ style: { backgroundColor: '#ffffff' } }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Remarks"
                    value={editingTransfer.remarks || ''}
                    onChange={(e) => setEditingTransfer({ ...editingTransfer, remarks: e.target.value })}
                    InputProps={{ style: { backgroundColor: '#ffffff' } }}
                  />
                </Grid>
              </Grid>
            </DialogContent>

            <DialogActions sx={{ p: 2.5, bgcolor: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
              <Button onClick={() => setEditingTransfer(null)} variant="outlined" sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={updating} startIcon={<SaveIcon />} sx={{ bgcolor: '#1e3a8a', borderRadius: 2, textTransform: 'none', fontWeight: 800 }}>
                {updating ? 'Saving Changes...' : 'Save Transfer Details'}
              </Button>
            </DialogActions>
          </form>
        )}
      </Dialog>

      {/* Cold Storage Transfer Bill Statement Modal */}
      <ColdStorageTransferStatementModal
        open={openBillModal}
        onClose={() => {
          setOpenBillModal(false);
          setSelectedTransferRow(null);
        }}
        transferRow={selectedTransferRow}
        navigate={navigate}
      />
    </Container>
  );
};

export default GodownTransfer;
