import React from 'react';
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
  Divider,
  IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import FactoryIcon from '@mui/icons-material/Factory';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import Inventory2Icon from '@mui/icons-material/Inventory2';

const ProcurementItemDetailModal = ({ open, onClose, item, onCreatePR }) => {
  if (!item) return null;

  const {
    itemCode,
    itemName,
    itemGroup,
    unit,
    supply,
    demand,
    projectedAvailable,
    controlLevels,
    shortage,
    recommendedPurchase,
    status,
    suggestedSupplier,
    estimatedRate,
    estimatedAmount,
    details
  } = item;

  const isShortage = status === 'SHORTAGE' || status === 'REORDER';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle component="div" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1, borderBottom: '1px solid #e2e8f0' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HelpOutlineIcon sx={{ color: '#0284c7' }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: '18px', color: '#0f172a' }}>
              Procurement Calculation Breakdown: {itemName}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              Code: {itemCode} | Group: {itemGroup} | Unit: {unit}
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2.5 }}>
        {/* Core Mathematical Formula Banner */}
        <Box sx={{ p: 2, mb: 3, borderRadius: 2, bgcolor: isShortage ? '#fff1f2' : '#f0fdf4', border: `1px solid ${isShortage ? '#fecdd3' : '#bbf7d0'}` }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: isShortage ? '#9f1239' : '#166534', mb: 1 }}>
            Planning Equation: Projected Available = Total Supply - Total Demand
          </Typography>
          <Grid container spacing={2} sx={{ textAlign: 'center' }}>
            <Grid item xs={3}>
              <Typography variant="caption" color="text.secondary">Total Supply</Typography>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#0369a1' }}>
                {supply.totalSupply.toLocaleString()} {unit}
              </Typography>
            </Grid>
            <Grid item xs={1} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="h5" color="text.secondary">-</Typography>
            </Grid>
            <Grid item xs={3}>
              <Typography variant="caption" color="text.secondary">Total Demand</Typography>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#b91c1c' }}>
                {demand.totalDemand.toLocaleString()} {unit}
              </Typography>
            </Grid>
            <Grid item xs={1} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="h5" color="text.secondary">=</Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary">Projected Available</Typography>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: projectedAvailable < 0 ? '#dc2626' : '#16a34a' }}>
                {projectedAvailable.toLocaleString()} {unit}
              </Typography>
            </Grid>
          </Grid>
        </Box>

        {/* Supply vs Demand Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {/* Supply Breakdown */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ height: '100%', borderColor: '#bae6fd', bgcolor: '#f0f9ff' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <Inventory2Icon sx={{ color: '#0284c7', fontSize: 20 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#0369a1' }}>
                    Supply Components
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: '1px dashed #cbd5e1' }}>
                  <Typography variant="body2" color="text.secondary">Current Physical Stock:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{supply.currentStock.toLocaleString()} {unit}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: '1px dashed #cbd5e1' }}>
                  <Typography variant="body2" color="text.secondary">Open POs (Expected):</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{supply.openPO.toLocaleString()} {unit}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: '1px dashed #cbd5e1' }}>
                  <Typography variant="body2" color="text.secondary">Confirmed Incoming:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{supply.confirmedIncoming.toLocaleString()} {unit}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#0369a1' }}>Total Supply:</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#0369a1' }}>{supply.totalSupply.toLocaleString()} {unit}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Demand Breakdown */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ height: '100%', borderColor: '#fed7aa', bgcolor: '#fffaf5' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <FactoryIcon sx={{ color: '#ea580c', fontSize: 20 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#c2410c' }}>
                    Demand Components
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: '1px dashed #cbd5e1' }}>
                  <Typography variant="body2" color="text.secondary">Production Requirements:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{demand.productionDemand.toLocaleString()} {unit}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: '1px dashed #cbd5e1' }}>
                  <Typography variant="body2" color="text.secondary">Confirmed Sales Orders:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{demand.salesDemand.toLocaleString()} {unit}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: '1px dashed #cbd5e1' }}>
                  <Typography variant="body2" color="text.secondary">Reserved / QC Hold:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{demand.reservedStock.toLocaleString()} {unit}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#c2410c' }}>Total Demand:</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#c2410c' }}>{demand.totalDemand.toLocaleString()} {unit}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Stock Thresholds & Recommendation */}
        <Box sx={{ p: 2, mb: 3, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1.5, color: '#334155' }}>
            Control Thresholds & Recommendation Analysis
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary">Reorder Level</Typography>
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{controlLevels.reorderLevel.toLocaleString()} {unit}</Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary">Minimum Stock</Typography>
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{controlLevels.minimumStock.toLocaleString()} {unit}</Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary">Safety Buffer</Typography>
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{controlLevels.safetyStock.toLocaleString()} {unit}</Typography>
            </Grid>
          </Grid>

          {recommendedPurchase > 0 && (
            <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#b91c1c' }}>
                  Recommended Purchase: {recommendedPurchase.toLocaleString()} {unit}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Suggested Supplier: <strong>{suggestedSupplier}</strong> (Est. Rate: ₹{estimatedRate}/{unit} | Total: ₹{estimatedAmount.toLocaleString('en-IN')})
                </Typography>
              </Box>
            </Box>
          )}
        </Box>

        {/* Section: Open Purchase Orders List */}
        {details.openPOs && details.openPOs.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: '#0369a1', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <LocalShippingIcon fontSize="small" /> Open Purchase Orders ({details.openPOs.length})
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '11px' }}>PO Number</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '11px' }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '11px' }}>Supplier</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '11px' }} align="right">Ordered Wt ({unit})</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '11px' }} align="right">Rate (₹)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {details.openPOs.map((po, idx) => (
                    <TableRow key={idx}>
                      <TableCell sx={{ fontSize: '12px' }}>{po.poNo || `PO-${po.poId}`}</TableCell>
                      <TableCell sx={{ fontSize: '12px' }}>{po.date}</TableCell>
                      <TableCell sx={{ fontSize: '12px' }}>{po.supplierName}</TableCell>
                      <TableCell sx={{ fontSize: '12px', fontWeight: 'bold' }} align="right">{po.orderedWeight.toLocaleString()}</TableCell>
                      <TableCell sx={{ fontSize: '12px' }} align="right">₹{po.rate}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Section: Production Demand List */}
        {details.productionRequirements && details.productionRequirements.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: '#c2410c', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <FactoryIcon fontSize="small" /> Production Demand Sources ({details.productionRequirements.length})
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '11px' }}>Work Order #</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '11px' }}>Required Date</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '11px' }}>Target Product</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '11px' }} align="right">Required Wt ({unit})</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {details.productionRequirements.map((wo, idx) => (
                    <TableRow key={idx}>
                      <TableCell sx={{ fontSize: '12px' }}>{wo.workOrderNo || `WO-${wo.workOrderId}`}</TableCell>
                      <TableCell sx={{ fontSize: '12px' }}>{wo.requiredDate}</TableCell>
                      <TableCell sx={{ fontSize: '12px' }}>{wo.product}</TableCell>
                      <TableCell sx={{ fontSize: '12px', fontWeight: 'bold' }} align="right">{wo.requiredWeight.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Section: Sales Orders List */}
        {details.salesRequirements && details.salesRequirements.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: '#4338ca', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ShoppingCartIcon fontSize="small" /> Confirmed Sales Commitments ({details.salesRequirements.length})
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '11px' }}>Order No</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '11px' }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '11px' }}>Customer</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '11px' }} align="right">Committed Wt ({unit})</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {details.salesRequirements.map((so, idx) => (
                    <TableRow key={idx}>
                      <TableCell sx={{ fontSize: '12px' }}>{so.salesOrderNo || `SO-${so.salesOrderId}`}</TableCell>
                      <TableCell sx={{ fontSize: '12px' }}>{so.orderDate}</TableCell>
                      <TableCell sx={{ fontSize: '12px' }}>{so.customer}</TableCell>
                      <TableCell sx={{ fontSize: '12px', fontWeight: 'bold' }} align="right">{so.committedWeight.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0', justifyContent: 'space-between' }}>
        <Button onClick={onClose} variant="outlined" color="inherit">
          Close
        </Button>
        {recommendedPurchase > 0 && (
          <Button
            onClick={() => {
              onClose();
              if (onCreatePR) onCreatePR([item]);
            }}
            variant="contained"
            color="primary"
            startIcon={<ShoppingCartIcon />}
            sx={{ textTransform: 'none', fontWeight: 'bold' }}
          >
            Create Purchase Request ({recommendedPurchase.toLocaleString()} {unit})
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ProcurementItemDetailModal;
