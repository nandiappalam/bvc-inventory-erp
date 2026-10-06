import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
  MenuItem,
  IconButton,
  Alert,
  Chip,
  Paper,
  CircularProgress
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import api from '../../services/api';

export default function IQRUnloadGodownModal({ open, onClose, lotData, onSuccess }) {
  const [godowns, setGodowns] = useState([]);
  const [loadingGodowns, setLoadingGodowns] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const lotNo = lotData?.rm_lot_no || lotData?.lot_no || lotData?.lotNo || '';
  const itemName = lotData?.item_name || lotData?.itemName || 'Material';
  const supplierName = lotData?.supplier_name || lotData?.supplierName || '-';
  const totalQty = parseFloat(lotData?.inward_bags || lotData?.qty || lotData?.total_qty || lotData?.quantity || 500);
  const totalWeight = parseFloat(lotData?.total_weight_kg || lotData?.weight || lotData?.total_weight || (totalQty * 50));
  const perUnitWeight = totalQty > 0 ? (totalWeight / totalQty) : 50;

  const [splits, setSplits] = useState([]);

  // Fetch Godowns on mount
  useEffect(() => {
    if (open) {
      setError('');
      setLoadingGodowns(true);
      api('/masters/all/godowns')
        .then((res) => {
          let list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
          if (!list || list.length === 0) {
            list = [
              { id: 1, godown_name: 'Main Raw Material Godown' },
              { id: 2, godown_name: 'BTS Cold Storage' },
              { id: 3, godown_name: 'Godown A' },
              { id: 4, godown_name: 'Godown B' }
            ];
          }
          setGodowns(list);

          // Initialize splits with primary default or single row
          const defaultGodown = list[0] || { id: 1, godown_name: 'Main Godown' };
          setSplits([
            {
              godownId: String(defaultGodown.id),
              godownName: defaultGodown.godown_name,
              qty: String(totalQty),
              weight: String(totalWeight)
            }
          ]);
        })
        .catch((err) => {
          console.error('Error fetching godowns:', err);
          const fallbackList = [
            { id: 1, godown_name: 'Main Raw Material Godown' },
            { id: 2, godown_name: 'BTS Cold Storage' },
            { id: 3, godown_name: 'Godown A' },
            { id: 4, godown_name: 'Godown B' }
          ];
          setGodowns(fallbackList);
          setSplits([
            {
              godownId: '1',
              godownName: 'Main Raw Material Godown',
              qty: String(totalQty),
              weight: String(totalWeight)
            }
          ]);
        })
        .finally(() => setLoadingGodowns(false));
    }
  }, [open, lotNo, totalQty, totalWeight]);

  const allocatedQtySum = splits.reduce((acc, row) => acc + (parseFloat(row.qty) || 0), 0);
  const allocatedWeightSum = splits.reduce((acc, row) => acc + (parseFloat(row.weight) || 0), 0);
  const remainingQty = totalQty - allocatedQtySum;
  const isFullyAllocated = Math.abs(remainingQty) < 0.01;

  const handleGodownChange = (index, godownId) => {
    const selected = godowns.find((g) => String(g.id) === String(godownId));
    const updated = [...splits];
    updated[index].godownId = String(godownId);
    updated[index].godownName = selected ? (selected.godown_name || selected.name) : 'Godown';
    setSplits(updated);
  };

  const handleQtyChange = (index, val) => {
    const q = parseFloat(val) || 0;
    const calculatedWeight = (q * perUnitWeight).toFixed(2);
    const updated = [...splits];
    updated[index].qty = val;
    updated[index].weight = String(calculatedWeight);
    setSplits(updated);
  };

  const handleWeightChange = (index, val) => {
    const updated = [...splits];
    updated[index].weight = val;
    setSplits(updated);
  };

  const handleAddSplitRow = () => {
    const unallocated = remainingQty > 0 ? remainingQty : 0;
    const calcWt = (unallocated * perUnitWeight).toFixed(2);
    const availableGodown = godowns.find((g) => !splits.some((s) => String(s.godownId) === String(g.id))) || godowns[0];

    setSplits([
      ...splits,
      {
        godownId: String(availableGodown?.id || 1),
        godownName: availableGodown?.godown_name || 'Additional Godown',
        qty: String(unallocated),
        weight: String(calcWt)
      }
    ]);
  };

  const handleRemoveRow = (index) => {
    if (splits.length <= 1) return;
    const updated = splits.filter((_, i) => i !== index);
    setSplits(updated);
  };

  const handleSubmit = async () => {
    setError('');
    if (splits.length === 0) {
      setError('Please select at least one godown for unloading.');
      return;
    }

    const invalidRow = splits.find((s) => !s.godownId || parseFloat(s.qty) <= 0);
    if (invalidRow) {
      setError('Please ensure every row has a valid Godown selected and Quantity greater than 0.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        lotNo,
        status: 'UNLOADED',
        godownSplits: splits.map((s) => ({
          godownId: Number(s.godownId),
          godownName: s.godownName,
          qty: parseFloat(s.qty) || 0,
          weight: parseFloat(s.weight) || 0
        }))
      };

      const res = await api('/qc/unload', {
        method: 'POST',
        body: payload
      });

      if (res?.success) {
        if (onSuccess) onSuccess(res);
        onClose();
      } else {
        setError(res?.message || 'Failed to complete unloading stock.');
      }
    } catch (err) {
      console.error('Error submitting multi-godown unload:', err);
      setError(err?.message || 'Failed to submit unloading allocation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ bg: '#1e293b', color: '#fff', fontWeight: 800, py: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <LocalShippingIcon sx={{ color: '#38bdf8' }} />
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            IQR Godown Unloading & Multi-Godown Split Allocation
          </Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8' }}>
            Verify lot parameters and split item quantity across target godowns/cold storage
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Lot Overview Header Card */}
        <Paper elevation={0} sx={{ p: 2, mb: 3, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr 1fr' }, gap: 2 }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700 }}>Lot Number</Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#0f172a' }}>{lotNo}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700 }}>Item / Product</Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e40af' }}>{itemName}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700 }}>Supplier</Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155' }}>{supplierName}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700 }}>Total Purchase Lot Qty</Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#15803d' }}>
                {totalQty} Bags ({totalWeight} kg)
              </Typography>
            </Box>
          </Box>
        </Paper>

        {loadingGodowns ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                Specify Unloading Godowns & Quantity Split:
              </Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddCircleOutlineIcon fontSize="small" />}
                onClick={handleAddSplitRow}
                sx={{ fontWeight: 700, textTransform: 'none' }}
              >
                + Add Godown Split
              </Button>
            </Box>

            <Table sx={{ border: '1px solid #e2e8f0' }}>
              <TableHead sx={{ backgroundColor: '#f1f5f9' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, width: '40%' }}>Destination Godown / Cold Storage</TableCell>

                  <TableCell sx={{ fontWeight: 800, width: '25%' }}>Allocated Qty (Bags)</TableCell>
                  <TableCell sx={{ fontWeight: 800, width: '25%' }}>Weight (Kg)</TableCell>
                  <TableCell sx={{ width: '10%', textAlign: 'center' }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {splits.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        value={row.godownId}
                        onChange={(e) => handleGodownChange(index, e.target.value)}
                      >
                        {godowns.map((g) => (
                          <MenuItem key={g.id} value={String(g.id)}>
                            {g.godown_name || g.name} {g.godown_type ? `(${g.godown_type})` : ''}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        fullWidth
                        size="small"
                        value={row.qty}
                        onChange={(e) => handleQtyChange(index, e.target.value)}
                        inputProps={{ min: 0 }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        fullWidth
                        size="small"
                        value={row.weight}
                        onChange={(e) => handleWeightChange(index, e.target.value)}
                        inputProps={{ min: 0 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        color="error"
                        size="small"
                        disabled={splits.length <= 1}
                        onClick={() => handleRemoveRow(index)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Allocation Summary Bar */}
            <Paper elevation={0} sx={{ p: 2, mt: 2, border: '1px solid #e2e8f0', backgroundColor: isFullyAllocated ? '#f0fdf4' : '#fffbeb', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {isFullyAllocated ? (
                    <CheckCircleIcon color="success" />
                  ) : (
                    <WarningAmberIcon color="warning" />
                  )}
                  <Typography variant="body2" sx={{ fontWeight: 700, color: isFullyAllocated ? '#166534' : '#b45309' }}>
                    {isFullyAllocated
                      ? `Exact 100% Allocation Matched: ${allocatedQtySum} / ${totalQty} Bags (${allocatedWeightSum} kg)`
                      : `Total Allocated: ${allocatedQtySum} / ${totalQty} Bags (Remaining: ${remainingQty} Bags)`}
                  </Typography>
                </Box>
                <Chip
                  label={isFullyAllocated ? '100% ALLOCATED' : `${Math.round((allocatedQtySum / totalQty) * 100)}% ALLOCATED`}
                  color={isFullyAllocated ? 'success' : 'warning'}
                  size="small"
                  sx={{ fontWeight: 800 }}
                />
              </Box>
            </Paper>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0' }}>
        <Button onClick={onClose} disabled={submitting} sx={{ fontWeight: 700 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="success"
          disabled={submitting || splits.length === 0}
          onClick={handleSubmit}
          startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <CheckCircleIcon />}
          sx={{ fontWeight: 800, px: 3 }}
        >
          {submitting ? 'Unloading & Updating Stock...' : 'Confirm & Unload to Godowns'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
