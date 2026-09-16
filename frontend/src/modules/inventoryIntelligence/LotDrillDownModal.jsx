import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  CircularProgress,
  Divider
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import inventoryIntelligenceService from '../../services/inventoryIntelligenceService';

const LotDrillDownModal = ({ open, onClose, lotNo }) => {
  const [loading, setLoading] = useState(false);
  const [lotData, setLotData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open && lotNo) {
      setLoading(true);
      setError(null);
      inventoryIntelligenceService.getLotDetails(lotNo)
        .then(res => {
          if (res.success) setLotData(res.data);
          else setError(res.message || 'Failed to load lot');
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [open, lotNo]);

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle component="div" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1, borderBottom: '1px solid #e2e8f0' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Inventory2Icon sx={{ color: '#0284c7' }} />
          <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: '18px' }}>
            Lot Traceability & QC Audit: {lotNo}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2.5 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6, flexDirection: 'column', alignItems: 'center' }}>
            <CircularProgress size={32} />
            <Typography variant="body2" sx={{ mt: 1, color: '#64748b' }}>Loading lot audit trail...</Typography>
          </Box>
        ) : error || !lotData || !lotData.found ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="error">{error || 'Lot details not available.'}</Typography>
          </Box>
        ) : (
          <Box>
            {/* High Level Specs */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card variant="outlined" sx={{ bgcolor: '#f8fafc' }}>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">Item / Material</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{lotData.itemName}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card variant="outlined" sx={{ bgcolor: '#f8fafc' }}>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">Remaining Quantity</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#0369a1' }}>
                      {lotData.remainingQuantity} kg
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card variant="outlined" sx={{ bgcolor: '#f8fafc' }}>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">QC Status</Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <Chip
                        label={lotData.qcStatus}
                        size="small"
                        color={lotData.qcStatus === 'PASSED' ? 'success' : lotData.qcStatus === 'REJECTED' ? 'error' : 'warning'}
                        sx={{ fontWeight: 'bold', height: 22 }}
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card variant="outlined" sx={{ bgcolor: '#f8fafc' }}>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">Lot Age</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: lotData.ageDays > 90 ? '#dc2626' : '#1e293b' }}>
                      {lotData.ageDays} Days
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Inward Details */}
            <Box sx={{ p: 2, mb: 3, borderRadius: 2, bgcolor: '#f1f5f9', border: '1px solid #e2e8f0' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: '#334155' }}>
                Inward & Location Tracking
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Supplier:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>{lotData.supplier}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Inward Date:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>{lotData.purchaseDate || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Godown Location:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>{lotData.godown}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Production Usable:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: lotData.usableForProduction ? '#16a34a' : '#dc2626' }}>
                    {lotData.usableForProduction ? 'Yes (Usable)' : 'No (Blocked)'}
                  </Typography>
                </Grid>
              </Grid>
            </Box>

            {/* Quality Inspection History */}
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: '#0369a1', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <VerifiedUserIcon fontSize="small" /> Quality Inspection Records
            </Typography>
            {lotData.inspections && lotData.inspections.length > 0 ? (
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f8fafc' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', fontSize: '11px' }}>Inspection No</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', fontSize: '11px' }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', fontSize: '11px' }}>Inspector</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', fontSize: '11px' }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', fontSize: '11px' }}>Moisture / Specs</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', fontSize: '11px' }}>Remarks</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lotData.inspections.map((ins, idx) => (
                      <TableRow key={idx}>
                        <TableCell sx={{ fontSize: '12px' }}>{ins.inspection_no || `QC-${ins.id}`}</TableCell>
                        <TableCell sx={{ fontSize: '12px' }}>{ins.inspection_date || ins.created_at}</TableCell>
                        <TableCell sx={{ fontSize: '12px' }}>{ins.inspected_by || 'QC Officer'}</TableCell>
                        <TableCell sx={{ fontSize: '12px' }}>
                          <Chip 
                            label={ins.status || 'PASSED'} 
                            size="small" 
                            color={ins.status === 'PASSED' ? 'success' : 'error'} 
                            sx={{ height: 20, fontSize: '10px' }} 
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: '12px' }}>{ins.moisture_percent ? `${ins.moisture_percent}%` : 'Standard'}</TableCell>
                        <TableCell sx={{ fontSize: '12px' }}>{ins.remarks || 'Standard Inward QC'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box sx={{ p: 2, textAlign: 'center', bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px dashed #cbd5e1' }}>
                <Typography variant="body2" color="text.secondary">
                  No separate lab inspection ticket attached to this lot.
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0' }}>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LotDrillDownModal;
