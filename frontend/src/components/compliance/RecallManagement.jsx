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
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import EmergencyShareIcon from '@mui/icons-material/EmergencyShare';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LockIcon from '@mui/icons-material/Lock';
import PrintIcon from '@mui/icons-material/Print';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export default function RecallManagement() {
  const [itemsList, setItemsList] = useState([]);
  const [activeLots, setActiveLots] = useState([]);
  const [selectedItem, setSelectedItem] = useState('');
  const [targetLot, setTargetLot] = useState('');
  const [recallClass, setRecallClass] = useState('Class II (Potential Non-life threatening health hazard)');
  const [reason, setReason] = useState('Routine Mock Recall Exercise for FSSAI / ISO 22000 Audit verification.');
  const [simulationResult, setSimulationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [noticeDialogOpen, setNoticeDialogOpen] = useState(false);

  useEffect(() => {
    const loadItemsAndLots = async () => {
      try {
        const [itemsRes, traceRes] = await Promise.all([
          fetch('/api/masters/items'),
          fetch('/api/compliance/traceability/latest')
        ]);
        const itemsData = await itemsRes.json();
        if (itemsData.data) {
          setItemsList(itemsData.data);
          if (itemsData.data.length > 0) setSelectedItem(itemsData.data[0].name);
        }
        const traceData = await traceRes.json();
        if (traceData.activeLots && traceData.activeLots.length > 0) {
          setActiveLots(traceData.activeLots);
          setTargetLot(traceData.lotNo || traceData.activeLots[0].lot_no);
        } else {
          setTargetLot('LOT0018');
        }
      } catch (err) {
        console.error('Error fetching items/lots for recall:', err);
      }
    };
    loadItemsAndLots();
  }, []);

  const handleSimulateRecall = async (lotParam) => {
    setLoading(true);
    try {
      const lotToSim = lotParam || targetLot || 'LOT0018';
      const res = await fetch('/api/compliance/recall/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_name: selectedItem,
          lot_no: lotToSim,
          reason,
          recall_class: recallClass,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSimulationResult(data.simulation);
      }
    } catch (err) {
      console.error('Error simulating recall:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (targetLot) {
      handleSimulateRecall(targetLot);
    }
  }, [targetLot, selectedItem]);

  return (
    <Box>
      {/* Header Banner */}
      <Card sx={{ mb: 3, p: 2.5, backgroundColor: '#fff1f2', border: '1px solid #fecdd3' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          <EmergencyShareIcon sx={{ color: '#e11d48', fontSize: 28 }} />
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#9f1239' }}>
            D9 — Product Recall & Rapid Withdrawal System
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: '#881337', maxWidth: 900 }}>
          Rapid Crisis & Recall Simulator integrated directly with ERP Stock Ledgers and Sales Invoices. FSSAI mandate requires identifying 100% of affected batch quantity (in factory inventory + customer distribution) in under 2 hours.
        </Typography>
      </Card>

      {/* Configuration & Trigger Box */}
      <Card sx={{ mb: 3, p: 2.5, border: '1px solid #e2e8f0' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1f4fb2', mb: 2 }}>
          Configure Recall / Mock Simulation Parameters
        </Typography>

        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField
              size="small"
              select
              fullWidth
              label="Affected Item"
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
            >
              {itemsList.map((item) => (
                <MenuItem key={item.id || item.name} value={item.name}>
                  {item.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              size="small"
              fullWidth
              label="Target Lot / Batch Number"
              value={targetLot}
              onChange={(e) => setTargetLot(e.target.value)}
              placeholder="e.g. LOT0014"
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              size="small"
              select
              fullWidth
              label="Recall Classification"
              value={recallClass}
              onChange={(e) => setRecallClass(e.target.value)}
            >
              <MenuItem value="Class I (Severe / Dangerous risk)">Class I (Severe / Dangerous risk)</MenuItem>
              <MenuItem value="Class II (Potential Non-life threatening health hazard)">Class II (Potential Non-life threatening hazard)</MenuItem>
              <MenuItem value="Class III (Quality / Labeling non-compliance)">Class III (Quality / Labeling non-compliance)</MenuItem>
              <MenuItem value="Mock Recall Audit Drill">Mock Recall Audit Drill</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12} sm={9}>
            <TextField
              size="small"
              fullWidth
              label="Recall / Drill Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Grid>

          <Grid item xs={12} sm={3}>
            <Button
              variant="contained"
              color="error"
              fullWidth
              startIcon={<PlayArrowIcon />}
              onClick={handleSimulateRecall}
              disabled={loading}
              sx={{ fontWeight: 'bold', height: 40 }}
            >
              {loading ? <CircularProgress size={20} color="inherit" /> : 'Run Recall Engine'}
            </Button>
          </Grid>
        </Grid>
      </Card>

      {/* Simulation Result */}
      {simulationResult && (
        <Box>
          {/* Summary KPIs */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={3}>
              <Card sx={{ borderLeft: '4px solid #10b981', p: 1.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                  FACTORY INVENTORY (QUARANTINED)
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#10b981', mt: 0.5 }}>
                  {simulationResult.in_house_stock_kg} Kg
                </Typography>
                <Typography variant="caption" color="text.secondary">Ready for immediate lock</Typography>
              </Card>
            </Grid>

            <Grid item xs={12} sm={3}>
              <Card sx={{ borderLeft: '4px solid #f59e0b', p: 1.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                  DISPATCHED TO MARKET
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#f59e0b', mt: 0.5 }}>
                  {simulationResult.dispatched_qty_kg} Kg
                </Typography>
                <Typography variant="caption" color="text.secondary">Across {simulationResult.affected_customers_count} customer invoices</Typography>
              </Card>
            </Grid>

            <Grid item xs={12} sm={3}>
              <Card sx={{ borderLeft: '4px solid #1f4fb2', p: 1.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                  RECONCILIATION RATE
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1f4fb2', mt: 0.5 }}>
                  {simulationResult.trace_efficiency_rate}
                </Typography>
                <Typography variant="caption" color="success.main" sx={{ fontWeight: 'bold' }}>100% Traceability achieved</Typography>
              </Card>
            </Grid>

            <Grid item xs={12} sm={3}>
              <Card sx={{ borderLeft: '4px solid #8b5cf6', p: 1.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                  RESPONSE EXECUTION SPEED
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#8b5cf6', mt: 0.5 }}>
                  {simulationResult.execution_time_minutes} Minutes
                </Typography>
                <Typography variant="caption" color="success.main" sx={{ fontWeight: 'bold' }}>Target: &lt; 120 Mins</Typography>
              </Card>
            </Grid>
          </Grid>

          {/* Action Callout */}
          <Paper sx={{ p: 2, mb: 3, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                Recall Report & Emergency Actions Generated
              </Typography>
              <Typography variant="body2" component="div" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <span>Drill Reference: <strong>{simulationResult.drill_id}</strong> | Status:</span>
                <Chip size="small" label={simulationResult.status} color="success" />
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                color="error"
                startIcon={<LockIcon />}
                onClick={() => alert(`ERP Stock Lots matching ${simulationResult.lot_no} flagged as QUARANTINED in Database.`)}
              >
                Quarantine Factory Stock
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<PrintIcon />}
                onClick={() => setNoticeDialogOpen(true)}
              >
                Generate FSSAI Recall Notice
              </Button>
            </Box>
          </Paper>

          {/* Customer Distribution List */}
          <Card sx={{ border: '1px solid #e2e8f0' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1f4fb2', mb: 1.5 }}>
                Affected Customers & Direct Dispatch Tracing
              </Typography>
              {simulationResult.affected_customers.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Customer Name</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Invoice No</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Dispatch Date</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Quantity</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Contact / Location</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', width: 120 }}>Notice Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {simulationResult.affected_customers.map((c, idx) => (
                        <TableRow key={idx}>
                          <TableCell sx={{ fontWeight: 'bold' }}>{c.customer_name}</TableCell>
                          <TableCell sx={{ fontFamily: 'monospace' }}>{c.invoice_no}</TableCell>
                          <TableCell>{c.date}</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', color: '#d97706' }}>{c.qty} Kg</TableCell>
                          <TableCell>{c.phone || c.city || 'Tamil Nadu'}</TableCell>
                          <TableCell>
                            <Chip size="small" label="Notified" color="warning" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No outside dispatches found for this lot. 100% of material is safely within factory control.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Official Recall Notice Modal */}
      {noticeDialogOpen && simulationResult && (
        <Dialog open={noticeDialogOpen} onClose={() => setNoticeDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle component="div" sx={{ bgcolor: '#9f1239', color: 'white', display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              OFFICIAL FSSAI PRODUCT RECALL & WITHDRAWAL NOTICE
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ p: 4 }}>
            <Box sx={{ border: '2px solid #9f1239', p: 3, mb: 2 }}>
              <Typography variant="h5" sx={{ textAlign: 'center', fontWeight: '900', color: '#9f1239', mb: 1 }}>
                URGENT: FOOD RECALL ADVISORY
              </Typography>
              <Typography variant="body2" sx={{ textAlign: 'center', color: 'text.secondary', mb: 2 }}>
                Issued pursuant to Food Safety and Standards (Food Recall Procedure) Regulations
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Grid container spacing={2} sx={{ fontSize: '13px', lineHeight: 1.8 }}>
                <Grid item xs={6}><strong>Product Name:</strong> {simulationResult.item_name}</Grid>
                <Grid item xs={6}><strong>Batch / Lot No:</strong> {simulationResult.lot_no}</Grid>
                <Grid item xs={6}><strong>Recall Class:</strong> {simulationResult.recall_class}</Grid>
                <Grid item xs={6}><strong>Drill / Action ID:</strong> {simulationResult.drill_id}</Grid>
                <Grid item xs={12}><strong>Reason for Withdrawal:</strong> {simulationResult.reason}</Grid>
                <Grid item xs={6}><strong>Total Quantity Traced:</strong> {simulationResult.total_affected_kg} Kg</Grid>
                <Grid item xs={6}><strong>Factory Quarantined:</strong> {simulationResult.in_house_stock_kg} Kg</Grid>
                <Grid item xs={12}>
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    <strong>Action for Distributors & Retailers:</strong> Immediately quarantine any stock bearing Lot #{simulationResult.lot_no} and return to BVC Foods processing hub.
                  </Alert>
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2, bgcolor: '#f1f5f9' }}>
            <Button onClick={() => setNoticeDialogOpen(false)}>Close</Button>
            <Button variant="contained" color="error" startIcon={<PrintIcon />} onClick={() => window.print()}>
              Print Official Notice
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
