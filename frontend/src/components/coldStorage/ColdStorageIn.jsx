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
  CheckCircle as CheckIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

const ColdStorageIn = () => {
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
  const [availableLots, setAvailableLots] = useState([]);
  const [godowns, setGodowns] = useState([]);

  // Form State
  const [voucherNo, setVoucherNo] = useState('');
  const [voucherDate, setVoucherDate] = useState(today);
  const [coldStorageId, setColdStorageId] = useState('');
  const [coldStorageName, setColdStorageName] = useState('');
  const [sourceGodownId, setSourceGodownId] = useState('');
  const [sourceGodownName, setSourceGodownName] = useState('Main Godown');
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
      avail_in_main: 0
    }
  ]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 1. Next Voucher No
      const vRes = await api('/cold-storage/next-voucher-no?type=IN');
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
        }
      }

      // 3. Available Purchase Lots
      const lotsRes = await api('/cold-storage/available-lots');
      if (lotsRes && lotsRes.data) {
        setAvailableLots(lotsRes.data);
      }

      // 4. Main Godowns
      const gRes = await api('/godowns');
      if (gRes && gRes.data) {
        setGodowns(gRes.data);
      }
    } catch (err) {
      console.error('Error loading initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleColdStorageChange = (e) => {
    const csId = e.target.value;
    setColdStorageId(csId);
    const selected = coldStorages.find(c => c.id === csId);
    if (selected) {
      setColdStorageName(selected.godown_name);
    }
  };

  const handleLotSelect = (index, lotKey) => {
    const selectedLot = availableLots.find(l => `${l.item_name}_${l.purchase_lot_no}` === lotKey);
    if (selectedLot) {
      const updated = [...items];
      const autoCsLot = `CS-${selectedLot.purchase_lot_no}`;
      updated[index] = {
        ...updated[index],
        item_name: selectedLot.item_name,
        purchase_lot_no: selectedLot.purchase_lot_no,
        cold_storage_lot_no: autoCsLot,
        unit: selectedLot.unit || 'KG',
        avail_in_main: selectedLot.available_qty,
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
        avail_in_main: 0
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

    setSaving(true);
    setMessage('');

    try {
      const payload = {
        voucher_date: voucherDate,
        cold_storage_id: coldStorageId,
        cold_storage_name: coldStorageName,
        source_godown_id: sourceGodownId,
        source_godown_name: sourceGodownName,
        remarks,
        items: validItems
      };

      const res = await api('/cold-storage/in', {
        method: 'POST',
        body: payload
      });

      if (res && res.success) {
        setMessage(`Cold Storage IN Voucher ${res.voucher_no} created successfully!`);
        setMessageType('success');
        setSavedVoucher({
          voucher_no: res.voucher_no,
          voucher_date: voucherDate,
          cold_storage_name: coldStorageName,
          source_godown_name: sourceGodownName,
          remarks,
          items: validItems
        });
        setPrintModalOpen(true);
      } else {
        setMessage(res?.message || 'Error saving Cold Storage IN voucher');
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
        avail_in_main: 0
      }
    ]);
    setRemarks('');
    fetchInitialData();
  };

  const totalQtySum = items.reduce((sum, i) => sum + parseFloat(i.quantity || 0), 0);
  const totalWtSum = items.reduce((sum, i) => sum + parseFloat(i.total_wt || 0), 0);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, width: '100%', maxWidth: '100%', margin: '0 auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <IconButton color="primary" onClick={() => navigate('/cold-storage/vouchers')}>
            <ArrowBackIcon />
          </IconButton>
          <ColdIcon sx={{ fontSize: 32, color: '#1f4fb2' }} />
          <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>
            Cold Storage Inward Voucher (CSI)
          </Typography>
        </Box>
        <Chip 
          label={`Voucher #: ${voucherNo || 'Generating...'}`} 
          color="primary" 
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
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, color: '#2a5ea0' }}>
                Storage Location & Transfer Details
              </Typography>
              <Grid container spacing={2.5}>
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

                <Grid item xs={12} sm={4.5}>
                  <TextField
                    fullWidth
                    select
                    size="small"
                    label="Destination Cold Storage"
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

                <Grid item xs={12} sm={4.5}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Source Godown / Origin"
                    value={sourceGodownName}
                    onChange={(e) => setSourceGodownName(e.target.value)}
                    placeholder="e.g. Main Raw Material Warehouse"
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Remarks / Vehicle / Temperature Notes"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="e.g. Transported in Reefer Truck at 4°C"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Items Table Card */}
          <Card sx={{ mb: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#2a5ea0' }}>
                  Material & Lot Selection
                </Typography>
                <Button startIcon={<AddIcon />} variant="outlined" size="small" onClick={addItemRow}>
                  Add Item Row
                </Button>
              </Box>

              <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto', borderRadius: 1.5 }}>
                <Table sx={{ minWidth: 1250, '& .MuiTableCell-root': { py: 1, px: 1 } }}>
                  <TableHead sx={{ backgroundColor: '#f0f4fa' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', width: 45, textAlign: 'center' }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', minWidth: 280, width: 320 }}>Purchase Lot & Item</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', minWidth: 150, width: 170 }}>Purchase Lot #</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', minWidth: 150, width: 170 }}>Cold Storage Lot #</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', minWidth: 120, width: 135 }}>Inward Qty</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', minWidth: 100, width: 110 }}>Per Wt</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', minWidth: 120, width: 135 }}>Total Wt</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', minWidth: 90, width: 100 }}>Unit</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', minWidth: 160 }}>Item Remarks</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', width: 60 }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((row, idx) => {
                      const lotKey = row.item_name && row.purchase_lot_no ? `${row.item_name}_${row.purchase_lot_no}` : '';
                      return (
                        <TableRow key={idx} sx={{ '&:hover': { backgroundColor: '#fbfcfd' } }}>
                          <TableCell align="center" sx={{ fontWeight: '600', color: 'text.secondary' }}>
                            {idx + 1}
                          </TableCell>
                          
                          {/* Lot & Item Select */}
                          <TableCell>
                            <TextField
                              fullWidth
                              select
                              size="small"
                              value={lotKey}
                              onChange={(e) => handleLotSelect(idx, e.target.value)}
                              SelectProps={{ 
                                displayEmpty: true,
                                sx: { fontSize: '0.875rem' }
                              }}
                            >
                              <MenuItem value="" disabled>-- Select Purchase Lot --</MenuItem>
                              {availableLots.map((l, lIdx) => (
                                <MenuItem key={lIdx} value={`${l.item_name}_${l.purchase_lot_no}`}>
                                  {l.item_name} (Lot: {l.purchase_lot_no}) - Avail: {l.available_qty} {l.unit}
                                </MenuItem>
                              ))}
                            </TextField>
                          </TableCell>

                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              value={row.purchase_lot_no}
                              onChange={(e) => handleItemChange(idx, 'purchase_lot_no', e.target.value)}
                              placeholder="Purchase Lot #"
                              inputProps={{
                                sx: { px: 1.25, py: 0.9, fontSize: '0.875rem' }
                              }}
                            />
                          </TableCell>

                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              value={row.cold_storage_lot_no}
                              onChange={(e) => handleItemChange(idx, 'cold_storage_lot_no', e.target.value)}
                              placeholder="e.g. CS-001"
                              inputProps={{
                                sx: { px: 1.25, py: 0.9, fontSize: '0.875rem', fontWeight: '500' }
                              }}
                            />
                          </TableCell>

                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              value={row.quantity}
                              onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                              placeholder="Qty"
                              inputProps={{
                                step: "any",
                                sx: { px: 1.25, py: 0.9, fontSize: '0.875rem', fontWeight: '600' }
                              }}
                            />
                          </TableCell>

                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              value={row.weight}
                              onChange={(e) => handleItemChange(idx, 'weight', e.target.value)}
                              placeholder="1"
                              inputProps={{
                                step: "any",
                                sx: { px: 1.25, py: 0.9, fontSize: '0.875rem' }
                              }}
                            />
                          </TableCell>

                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              value={row.total_wt}
                              onChange={(e) => handleItemChange(idx, 'total_wt', e.target.value)}
                              placeholder="0"
                              inputProps={{
                                step: "any",
                                sx: { px: 1.25, py: 0.9, fontSize: '0.875rem', fontWeight: '600' }
                              }}
                            />
                          </TableCell>

                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              value={row.unit}
                              onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                              placeholder="KG"
                              inputProps={{
                                sx: { px: 1.25, py: 0.9, fontSize: '0.875rem', textAlign: 'center' }
                              }}
                            />
                          </TableCell>

                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              value={row.remarks}
                              onChange={(e) => handleItemChange(idx, 'remarks', e.target.value)}
                              placeholder="Notes"
                              inputProps={{
                                sx: { px: 1.25, py: 0.9, fontSize: '0.875rem' }
                              }}
                            />
                          </TableCell>

                          <TableCell align="center">
                            <IconButton 
                              color="error" 
                              size="small" 
                              onClick={() => removeItemRow(idx)}
                              disabled={items.length === 1}
                              title="Delete Row"
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
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 4, mt: 2, p: 1.5, backgroundColor: '#f8fafc', borderRadius: 1 }}>
                <Typography variant="subtitle2">
                  Total Items: <strong>{items.length}</strong>
                </Typography>
                <Typography variant="subtitle2">
                  Total Inward Quantity: <strong style={{ color: '#1f4fb2' }}>{totalQtySum.toFixed(2)}</strong>
                </Typography>
                <Typography variant="subtitle2">
                  Total Weight: <strong style={{ color: '#1f4fb2' }}>{totalWtSum.toFixed(2)} KG</strong>
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
              sx={{ backgroundColor: '#1f4fb2', px: 4, py: 1 }}
            >
              {saving ? 'Saving...' : 'Save Cold Storage Inward Voucher'}
            </Button>
          </Box>
        </form>
      )}

      {/* Print / Success Confirmation Dialog */}
      <Dialog open={printModalOpen} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ backgroundColor: '#1f4fb2', color: '#fff', display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckIcon /> Cold Storage Inward Saved
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {savedVoucher && (
            <Box sx={{ p: 1 }}>
              <Typography variant="h6" color="primary" gutterBottom>
                Voucher #: {savedVoucher.voucher_no}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Date:</strong> {savedVoucher.voucher_date}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Cold Storage:</strong> {savedVoucher.cold_storage_name}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Origin:</strong> {savedVoucher.source_godown_name}
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>Items Transferred:</Typography>
              {savedVoucher.items.map((it, idx) => (
                <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, fontSize: '13px' }}>
                  <span>{it.item_name} (Lot: {it.cold_storage_lot_no})</span>
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
            startIcon={<PrintIcon />}
            onClick={() => {
              window.print();
            }}
          >
            Print Voucher Slip
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ColdStorageIn;
