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
  IconButton,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Chip
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  AcUnit as ColdIcon,
  Print as PrintIcon,
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

const ColdStorageOut = () => {
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [savedVoucher, setSavedVoucher] = useState(null);

  // Master lists
  const [coldStorages, setColdStorages] = useState([]);
  const [csLots, setCsLots] = useState([]);

  // Form State
  const [voucherNo, setVoucherNo] = useState('');
  const [voucherDate, setVoucherDate] = useState(today);
  const [coldStorageId, setColdStorageId] = useState('');
  const [coldStorageName, setColdStorageName] = useState('');
  const [destinationGodownName, setDestinationGodownName] = useState('Production Floor / Processing');
  const [remarks, setRemarks] = useState('');

  // Items State
  const [items, setItems] = useState([
    {
      item_name: '',
      purchase_lot_no: '',
      cold_storage_lot_no: '',
      quantity: '',
      weight: '1',
      total_wt: '0',
      unit: 'KG',
      remarks: '',
      avail_in_cs: 0
    }
  ]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 1. Next Voucher No
      const vRes = await api('/cold-storage/next-voucher-no?type=OUT');
      if (vRes && vRes.voucher_no) {
        setVoucherNo(vRes.voucher_no);
      }

      // 2. Cold Storage Godowns
      const csRes = await api('/cold-storage/storages');
      if (csRes && csRes.data) {
        setColdStorages(csRes.data);
        if (csRes.data.length > 0) {
          setColdStorageId(csRes.data[0].id);
          setColdStorageName(csRes.data[0].godown_name);
          loadCsLots(csRes.data[0].id);
        }
      }
    } catch (err) {
      console.error('Error loading initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCsLots = async (csId) => {
    try {
      const res = await api(`/cold-storage/cs-lots?cold_storage_id=${csId}`);
      if (res && res.data) {
        setCsLots(res.data);
      } else {
        setCsLots([]);
      }
    } catch (err) {
      console.error('Error fetching CS lots:', err);
      setCsLots([]);
    }
  };

  const handleColdStorageChange = (e) => {
    const csId = e.target.value;
    setColdStorageId(csId);
    const selected = coldStorages.find(c => c.id === csId);
    if (selected) {
      setColdStorageName(selected.godown_name);
    }
    loadCsLots(csId);
    // Reset items on cold storage switch
    setItems([
      {
        item_name: '',
        purchase_lot_no: '',
        cold_storage_lot_no: '',
        quantity: '',
        weight: '1',
        total_wt: '0',
        unit: 'KG',
        remarks: '',
        avail_in_cs: 0
      }
    ]);
  };

  const handleCsLotSelect = (index, csLotKey) => {
    const selectedLot = csLots.find(l => `${l.item_name}_${l.cold_storage_lot_no}` === csLotKey);
    if (selectedLot) {
      const updated = [...items];
      updated[index] = {
        ...updated[index],
        item_name: selectedLot.item_name,
        purchase_lot_no: selectedLot.purchase_lot_no,
        cold_storage_lot_no: selectedLot.cold_storage_lot_no,
        unit: selectedLot.unit || 'KG',
        avail_in_cs: selectedLot.available_qty,
        quantity: selectedLot.available_qty > 0 ? selectedLot.available_qty : '',
        total_wt: selectedLot.available_qty > 0 ? selectedLot.available_qty : ''
      };
      setItems(updated);
    }
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;

    if (field === 'quantity' || field === 'weight') {
      const q = parseFloat(updated[index].quantity || 0);
      const w = parseFloat(updated[index].weight || 1);
      updated[index].total_wt = (q * w).toFixed(2);
    }

    setItems(updated);
  };

  const addItemRow = () => {
    setItems([
      ...items,
      {
        item_name: '',
        purchase_lot_no: '',
        cold_storage_lot_no: '',
        quantity: '',
        weight: '1',
        total_wt: '0',
        unit: 'KG',
        remarks: '',
        avail_in_cs: 0
      }
    ]);
  };

  const removeItemRow = (index) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!coldStorageId || !coldStorageName) {
      setMessage('Please select a Cold Storage Godown');
      setMessageType('error');
      return;
    }

    const validItems = items.filter(i => i.item_name && parseFloat(i.quantity) > 0);
    if (validItems.length === 0) {
      setMessage('Please enter at least one item with valid quantity');
      setMessageType('error');
      return;
    }

    // STRICT CLIENT VALIDATION: Cannot issue more than available stock in Cold Storage!
    for (const item of validItems) {
      const q = parseFloat(item.quantity || 0);
      if (q > item.avail_in_cs) {
        setMessage(
          `Insufficient Stock in Cold Storage for ${item.item_name} (CS Lot: ${item.cold_storage_lot_no}). Available: ${item.avail_in_cs} ${item.unit}, Requested: ${q} ${item.unit}.`
        );
        setMessageType('error');
        return;
      }
    }

    setSaving(true);
    setMessage('');

    try {
      const payload = {
        voucher_date: voucherDate,
        cold_storage_id: coldStorageId,
        cold_storage_name: coldStorageName,
        destination_godown_name: destinationGodownName,
        remarks,
        items: validItems
      };

      const res = await api('/cold-storage/out', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res && res.success) {
        setMessage(`Cold Storage OUT Voucher ${res.voucher_no} issued successfully!`);
        setMessageType('success');
        setSavedVoucher({
          voucher_no: res.voucher_no,
          voucher_date: voucherDate,
          cold_storage_name: coldStorageName,
          destination_godown_name: destinationGodownName,
          remarks,
          items: validItems
        });
        setPrintModalOpen(true);
      } else {
        setMessage(res?.message || 'Error issuing Cold Storage OUT voucher');
        setMessageType('error');
      }
    } catch (err) {
      setMessage('Error: ' + err.message);
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  const handleResetForm = () => {
    setPrintModalOpen(false);
    setItems([
      {
        item_name: '',
        purchase_lot_no: '',
        cold_storage_lot_no: '',
        quantity: '',
        weight: '1',
        total_wt: '0',
        unit: 'KG',
        remarks: '',
        avail_in_cs: 0
      }
    ]);
    setRemarks('');
    fetchInitialData();
  };

  const totalQtySum = items.reduce((sum, i) => sum + parseFloat(i.quantity || 0), 0);
  const totalWtSum = items.reduce((sum, i) => sum + parseFloat(i.total_wt || 0), 0);

  return (
    <Box sx={{ p: 3, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <IconButton color="primary" onClick={() => navigate('/cold-storage/vouchers')}>
            <ArrowBackIcon />
          </IconButton>
          <ColdIcon sx={{ fontSize: 32, color: '#d97706' }} />
          <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#b45309' }}>
            Cold Storage Outward / Issue Voucher (CSO)
          </Typography>
        </Box>
        <Chip 
          label={`Voucher #: ${voucherNo || 'Generating...'}`} 
          color="warning" 
          variant="outlined" 
          sx={{ fontWeight: 'bold', fontSize: '15px' }} 
        />
      </Box>

      {message && (
        <Alert severity={messageType} sx={{ mb: 3 }} onClose={() => setMessage('')}>
          {message}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        <form onSubmit={handleSubmit}>
          {/* Main Info Card */}
          <Card sx={{ mb: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, color: '#b45309' }}>
                Cold Storage Source & Destination Details
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="Voucher Date"
                    value={voucherDate}
                    onChange={(e) => setVoucherDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    required
                  />
                </Grid>

                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    select
                    size="small"
                    label="Source Cold Storage"
                    value={coldStorageId}
                    onChange={handleColdStorageChange}
                    required
                  >
                    {coldStorages.map((cs) => (
                      <MenuItem key={cs.id} value={cs.id}>
                        {cs.godown_name} ({cs.external_company || cs.storage_location || 'Cold Storage'})
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                <Grid item xs={12} sm={5}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Destination / Issue Purpose"
                    value={destinationGodownName}
                    onChange={(e) => setDestinationGodownName(e.target.value)}
                    placeholder="e.g. Production Department / Main Processing"
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Remarks / Dispatch / Issue Notes"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="e.g. Issued for Milling Batch #402"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Items Table Card */}
          <Card sx={{ mb: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#b45309' }}>
                  Stored Material & Cold Storage Lot Selection
                </Typography>
                <Button startIcon={<AddIcon />} variant="outlined" size="small" color="warning" onClick={addItemRow}>
                  Add Item Row
                </Button>
              </Box>

              {csLots.length === 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  No materials currently stored in this Cold Storage location.
                </Alert>
              )}

              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead sx={{ backgroundColor: '#fffbe3' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '280px' }}>Cold Storage Lot & Item</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Purchase Lot #</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Avail Stock in CS</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '110px' }}>Issue Qty</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '90px' }}>Per Wt</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '110px' }}>Total Wt</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '80px' }}>Unit</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Item Remarks</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold' }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((row, idx) => {
                      const csLotKey = row.item_name && row.cold_storage_lot_no ? `${row.item_name}_${row.cold_storage_lot_no}` : '';
                      const isExcess = parseFloat(row.quantity || 0) > row.avail_in_cs;

                      return (
                        <TableRow key={idx} sx={{ backgroundColor: isExcess ? '#fff1f2' : 'inherit' }}>
                          <TableCell>{idx + 1}</TableCell>
                          
                          {/* CS Lot & Item Select */}
                          <TableCell>
                            <TextField
                              fullWidth
                              select
                              size="small"
                              value={csLotKey}
                              onChange={(e) => handleCsLotSelect(idx, e.target.value)}
                              SelectProps={{ displayEmpty: true }}
                            >
                              <MenuItem value="" disabled>-- Select CS Stored Lot --</MenuItem>
                              {csLots.map((l, lIdx) => (
                                <MenuItem key={lIdx} value={`${l.item_name}_${l.cold_storage_lot_no}`}>
                                  {l.item_name} (CS Lot: {l.cold_storage_lot_no}) - Avail: {l.available_qty} {l.unit}
                                </MenuItem>
                              ))}
                            </TextField>
                          </TableCell>

                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: '500' }}>
                              {row.purchase_lot_no || 'N/A'}
                            </Typography>
                          </TableCell>

                          <TableCell>
                            <Chip 
                              label={`${row.avail_in_cs} ${row.unit}`} 
                              color={row.avail_in_cs > 0 ? 'success' : 'default'} 
                              size="small" 
                              variant="outlined" 
                            />
                          </TableCell>

                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              value={row.quantity}
                              onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                              error={isExcess}
                              helperText={isExcess ? 'Exceeds stock!' : ''}
                              placeholder="Qty"
                            />
                          </TableCell>

                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              value={row.weight}
                              onChange={(e) => handleItemChange(idx, 'weight', e.target.value)}
                            />
                          </TableCell>

                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              value={row.total_wt}
                              onChange={(e) => handleItemChange(idx, 'total_wt', e.target.value)}
                            />
                          </TableCell>

                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              value={row.unit}
                              onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                            />
                          </TableCell>

                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              value={row.remarks}
                              onChange={(e) => handleItemChange(idx, 'remarks', e.target.value)}
                              placeholder="Notes"
                            />
                          </TableCell>

                          <TableCell align="center">
                            <IconButton 
                              color="error" 
                              size="small" 
                              onClick={() => removeItemRow(idx)}
                              disabled={items.length === 1}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Total Summary */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 4, mt: 2, p: 1.5, backgroundColor: '#fef3c7', borderRadius: 1 }}>
                <Typography variant="subtitle2">
                  Total Items: <strong>{items.length}</strong>
                </Typography>
                <Typography variant="subtitle2">
                  Total Issued Quantity: <strong style={{ color: '#b45309' }}>{totalQtySum.toFixed(2)}</strong>
                </Typography>
                <Typography variant="subtitle2">
                  Total Issued Weight: <strong style={{ color: '#b45309' }}>{totalWtSum.toFixed(2)} KG</strong>
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button variant="outlined" color="secondary" onClick={() => navigate('/cold-storage/vouchers')}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              startIcon={<SaveIcon />}
              disabled={saving}
              sx={{ backgroundColor: '#d97706', '&:hover': { backgroundColor: '#b45309' }, px: 4, py: 1 }}
            >
              {saving ? 'Issuing...' : 'Issue Cold Storage Outward Voucher'}
            </Button>
          </Box>
        </form>
      )}

      {/* Print / Confirmation Dialog */}
      <Dialog open={printModalOpen} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ backgroundColor: '#d97706', color: '#fff', display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckIcon /> Cold Storage Outward Issued
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {savedVoucher && (
            <Box sx={{ p: 1 }}>
              <Typography variant="h6" color="warning" gutterBottom>
                Voucher #: {savedVoucher.voucher_no}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Date:</strong> {savedVoucher.voucher_date}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Cold Storage Source:</strong> {savedVoucher.cold_storage_name}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Destination:</strong> {savedVoucher.destination_godown_name}
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>Items Issued:</Typography>
              {savedVoucher.items.map((it, idx) => (
                <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, fontSize: '13px' }}>
                  <span>{it.item_name} (CS Lot: {it.cold_storage_lot_no} / Purchase Lot: {it.purchase_lot_no})</span>
                  <span><strong>{it.quantity} {it.unit}</strong> ({it.total_wt} KG)</span>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
          <Button variant="outlined" onClick={handleResetForm}>
            Create Another Voucher
          </Button>
          <Button 
            variant="contained" 
            color="warning"
            startIcon={<PrintIcon />}
            onClick={() => {
              window.print();
            }}
          >
            Print Issue Slip
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ColdStorageOut;
