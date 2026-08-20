import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  TextField,
  Chip,
  Paper,
  Divider,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import StoreIcon from '@mui/icons-material/Store';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import InventoryIcon from '@mui/icons-material/Inventory';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import VerifiedIcon from '@mui/icons-material/Verified';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PrintIcon from '@mui/icons-material/Print';

export default function TraceabilityEngine() {
  const [lotInput, setLotInput] = useState('LOT0014');
  const [traceData, setTraceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleTrace = async (targetLot = lotInput) => {
    if (!targetLot || !targetLot.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/compliance/traceability/${encodeURIComponent(targetLot.trim())}`);
      const data = await res.json();
      if (data.success) {
        setTraceData(data);
      } else {
        setError(data.message || 'No trace records found for this lot');
        setTraceData(null);
      }
    } catch (err) {
      console.error('Error tracing lot:', err);
      setError('Failed to query traceability engine.');
      setTraceData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleTrace('LOT0014');
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Box>
      {/* Search Header */}
      <Card sx={{ mb: 3, p: 2.5, backgroundColor: '#f0f6ff', border: '1px solid #bfdbfe' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={7}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#1f4fb2', mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <AltRouteIcon /> P8 — Interactive Traceability Engine (360° Backward & Forward Trace)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Enter any Raw Material or Finished Goods Lot Number to trace supplier origin, inward QC, processing batches, godown balances, and customer dispatches.
            </Typography>
          </Grid>
          <Grid item xs={12} md={5}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="Enter Lot No (e.g. LOT0014, LOT0003)..."
                value={lotInput}
                onChange={(e) => setLotInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleTrace(); }}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />,
                }}
              />
              <Button
                variant="contained"
                color="primary"
                onClick={() => handleTrace()}
                disabled={loading}
                sx={{ fontWeight: 'bold', minWidth: 100 }}
              >
                {loading ? <CircularProgress size={20} color="inherit" /> : 'Trace Lot'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Card>

      {error && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : traceData ? (
        <Box>
          {/* Quick Summary Header */}
          <Paper sx={{ p: 2.5, mb: 3, border: '1px solid #e2e8f0', backgroundColor: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>TRACE REPORT FOR LOT</Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1f4fb2', fontFamily: 'monospace' }}>
                {traceData.lotNo}
              </Typography>
              <Typography variant="body2" sx={{ color: '#0369a1', fontWeight: 'bold' }}>
                {traceData.backwardTrace?.purchase?.item_name || 'Standard Inventory Lot'}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" color="text.secondary">CURRENT FACTORY STOCK</Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#10b981' }}>
                  {traceData.currentStock.reduce((s, c) => s + (parseFloat(c.available_qty) || 0), 0)} Kg
                </Typography>
              </Box>
              <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint} size="small">
                Print Trace Certificate
              </Button>
            </Box>
          </Paper>

          {/* Traceability Flow Nodes */}
          <Grid container spacing={2.5}>
            {/* 1. BACKWARD TRACE: Origin & Supplier */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%', borderTop: '4px solid #1f4fb2', border: '1px solid #cbd5e1' }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <StoreIcon color="primary" />
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                      1. Inward Origin & Supplier Details
                    </Typography>
                  </Box>

                  {traceData.backwardTrace?.purchase ? (
                    <Box sx={{ fontSize: '13px', lineHeight: 1.8 }}>
                      <div><strong>Supplier:</strong> {traceData.backwardTrace.purchase.supplier_name || traceData.backwardTrace.purchase.party_name || 'Direct Procurement'}</div>
                      <div><strong>Invoice / GRN:</strong> {traceData.backwardTrace.purchase.invoice_no || 'N/A'}</div>
                      <div><strong>Receiving Date:</strong> {traceData.backwardTrace.purchase.date || '—'}</div>
                      <div><strong>Inward Quantity:</strong> {traceData.backwardTrace.purchase.qty || '—'} Kg</div>
                      {traceData.backwardTrace.purchase.supplier_phone && (
                        <div><strong>Contact:</strong> {traceData.backwardTrace.purchase.supplier_phone}</div>
                      )}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Inward purchase record linked through item lot sequence.
                    </Typography>
                  )}

                  {traceData.backwardTrace?.inwardQC && traceData.backwardTrace.inwardQC.length > 0 && (
                    <Box sx={{ mt: 2, p: 1.5, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #e2e8f0' }}>
                      <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#10b981', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <VerifiedIcon sx={{ fontSize: 16 }} /> INWARD QC PASSED (P1)
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Inspection parameters verified and cleared for production.
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* 2. PRODUCTION & MILLING STAGES */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%', borderTop: '4px solid #8b5cf6', border: '1px solid #cbd5e1' }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <PrecisionManufacturingIcon sx={{ color: '#8b5cf6' }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                      2. In-Process & Milling Transformations
                    </Typography>
                  </Box>

                  {traceData.productionHistory?.grindBatches?.length > 0 ? (
                    <TableContainer component={Paper} variant="outlined" sx={{ mb: 1 }}>
                      <Table size="small">
                        <TableHead sx={{ bgcolor: '#f8fafc' }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Grind No</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Input</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Output Item</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Output Lot</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {traceData.productionHistory.grindBatches.map((g, idx) => (
                            <TableRow key={idx}>
                              <TableCell sx={{ fontFamily: 'monospace' }}>{g.grind_no}</TableCell>
                              <TableCell>{g.input_qty} Kg</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>{g.output_item || 'Flour'}</TableCell>
                              <TableCell sx={{ fontFamily: 'monospace', color: '#8b5cf6' }}>{g.output_lot || '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Box sx={{ p: 2, bgcolor: '#faf5ff', borderRadius: 1, border: '1px dashed #c084fc' }}>
                      <Typography variant="body2" sx={{ color: '#6b21a8' }}>
                        Processed as direct whole pulse / raw material grain storage.
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* 3. CURRENT FACTORY GODOWN INVENTORY */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%', borderTop: '4px solid #10b981', border: '1px solid #cbd5e1' }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <InventoryIcon sx={{ color: '#10b981' }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                      3. Current Godown Storage Balances
                    </Typography>
                  </Box>

                  {traceData.currentStock.length > 0 ? (
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead sx={{ bgcolor: '#f8fafc' }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Godown</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Item Name</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Available Balance</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {traceData.currentStock.map((s, idx) => (
                            <TableRow key={idx}>
                              <TableCell sx={{ fontWeight: 'bold' }}>{s.godown || 'Main Factory Godown'}</TableCell>
                              <TableCell>{s.item_name}</TableCell>
                              <TableCell sx={{ fontWeight: 'bold', color: '#10b981' }}>{s.available_qty} Kg</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Zero balance remaining in factory godowns (100% dispatched / processed).
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* 4. FORWARD TRACE: Dispatches & Customers */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%', borderTop: '4px solid #f59e0b', border: '1px solid #cbd5e1' }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <LocalShippingIcon sx={{ color: '#f59e0b' }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                      4. Forward Trace: Sales & Customer Dispatches
                    </Typography>
                  </Box>

                  {traceData.forwardTrace?.dispatches?.length > 0 ? (
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead sx={{ bgcolor: '#f8fafc' }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Customer</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Invoice</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Qty Sold</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {traceData.forwardTrace.dispatches.map((d, idx) => (
                            <TableRow key={idx}>
                              <TableCell sx={{ fontWeight: 'bold' }}>{d.customer_name || d.party_name}</TableCell>
                              <TableCell sx={{ fontFamily: 'monospace' }}>{d.invoice_no}</TableCell>
                              <TableCell>{d.date}</TableCell>
                              <TableCell sx={{ fontWeight: 'bold', color: '#d97706' }}>{d.sold_qty} Kg</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No customer dispatches recorded yet for this lot.
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      ) : null}
    </Box>
  );
}
