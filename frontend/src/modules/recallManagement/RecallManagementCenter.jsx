import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  LinearProgress,
  Divider
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BlockIcon from '@mui/icons-material/Block';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import AssignmentReturnIcon from '@mui/icons-material/AssignmentReturn';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import axios from 'axios';
import { useLocation } from 'react-router-dom';

export default function RecallManagementCenter() {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [recalls, setRecalls] = useState([]);
  const [selectedRecall, setSelectedRecall] = useState(null);
  const [recallDetail, setRecallDetail] = useState(null);

  const [openRecallModal, setOpenRecallModal] = useState(false);
  const [recallForm, setRecallForm] = useState({
    product_name: location.state?.product_name || 'Urad Dal Premium 30kg',
    lot_no: location.state?.lot_no || 'LOT000245',
    reason: location.state?.reason || 'Elevated moisture level exceeding specification.',
    severity: 'HIGH',
    created_by: 'Quality Manager'
  });

  const loadRecalls = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/complaint-recall/recalls');
      if (res.data.success) {
        setRecalls(res.data.data || []);
        if (res.data.data && res.data.data.length > 0) {
          handleSelectRecall(res.data.data[0]);
        }
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message || 'Failed to fetch recalls');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecalls();
    if (location.state?.lot_no) {
      setOpenRecallModal(true);
    }
  }, []);

  const handleSelectRecall = async (rcl) => {
    setSelectedRecall(rcl);
    setLoading(true);
    try {
      const res = await axios.get(`/api/complaint-recall/recalls/${rcl.id}`);
      if (res.data.success) {
        setRecallDetail(res.data);
      }
    } catch (err) {
      setErrorMsg('Failed to load recall detail');
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateRecall = async () => {
    if (!recallForm.product_name || !recallForm.lot_no) return;
    try {
      const res = await axios.post('/api/complaint-recall/recalls', recallForm);
      if (res.data.success) {
        setSuccessMsg(`Recall order ${res.data.recall_no} initiated and stock placed in Quarantine.`);
        setOpenRecallModal(false);
        loadRecalls();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to initiate recall');
    }
  };

  const handleUpdateCustomerRecall = async (cust, newStatus) => {
    try {
      const res = await axios.put(`/api/complaint-recall/recalls/${selectedRecall.id}/customer-status`, {
        customer_id: cust.id,
        recall_status: newStatus,
        recovered_qty_kg: newStatus === 'RECOVERED' ? cust.supplied_qty_kg : cust.recovered_qty_kg || 0,
        credit_note_no: newStatus === 'RECOVERED' ? `CN-2026-${Math.floor(Math.random() * 900 + 100)}` : cust.credit_note_no
      });
      if (res.data.success) {
        setSuccessMsg(`Customer recall status updated to ${newStatus}`);
        handleSelectRecall(selectedRecall);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Status update failed');
    }
  };

  const lotDetails = recallDetail?.lotDetails || {
    produced_qty_kg: 5000,
    current_stock_kg: 800,
    sold_qty_kg: 4000,
    returned_qty_kg: 1500,
    quarantined_qty_kg: 800
  };

  const customers = recallDetail?.customers || [];
  const totalSold = lotDetails.sold_qty_kg || 4000;
  const totalRecovered = customers.reduce((acc, curr) => acc + (curr.recovered_qty_kg || 0), 0);
  const recoveryPct = totalSold > 0 ? Math.min(100, Math.round((totalRecovered / totalSold) * 100)) : 0;

  return (
    <Box sx={{ p: 3, maxWidth: 1600, margin: '0 auto' }}>
      {/* HEADER */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#1e293b' }}>
            Recall Management & Stock Quarantine
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Product recall execution, automated inventory quarantine block, customer recovery & credit note workflow
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadRecalls} disabled={loading}>
            Refresh
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<AddIcon />}
            onClick={() => setOpenRecallModal(true)}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Initiate Product Recall
          </Button>
        </Box>
      </Box>

      {errorMsg && <Alert severity="error" onClose={() => setErrorMsg('')} sx={{ mb: 2 }}>{errorMsg}</Alert>}
      {successMsg && <Alert severity="success" onClose={() => setSuccessMsg('')} sx={{ mb: 2 }}>{successMsg}</Alert>}

      <Grid container spacing={3}>
        {/* RECALL ORDERS LIST */}
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <Box sx={{ p: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Active Recall Orders ({recalls.length})
              </Typography>
            </Box>
            <Box sx={{ p: 1, maxHeight: 650, overflowY: 'auto' }}>
              {recalls.map((r) => {
                const isSelected = selectedRecall?.id === r.id;
                return (
                  <Paper
                    key={r.id}
                    variant="outlined"
                    onClick={() => handleSelectRecall(r)}
                    sx={{
                      p: 2,
                      mb: 1.5,
                      cursor: 'pointer',
                      borderLeft: '5px solid #ef4444',
                      bgcolor: isSelected ? '#fef2f2' : '#fff',
                      boxShadow: isSelected ? 2 : 0,
                      '&:hover': { bgcolor: '#ffe4e6' }
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#991b1b' }}>
                        {r.recall_no}
                      </Typography>
                      <Chip label={r.status} color="error" size="small" sx={{ fontWeight: 700, fontSize: '10px' }} />
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {r.product_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Lot: <b style={{ fontFamily: 'monospace' }}>{r.lot_no}</b> | Date: {r.recall_date}
                    </Typography>
                  </Paper>
                );
              })}
            </Box>
          </Card>
        </Grid>

        {/* RECALL WORKSPACE & STOCK QUARANTINE */}
        <Grid item xs={12} md={8}>
          {selectedRecall ? (
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <Box sx={{ p: 2.5, bgcolor: '#fef2f2', borderBottom: '1px solid #fecaca', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#991b1b' }}>
                    Recall Execution: {selectedRecall.recall_no}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Product: <b>{selectedRecall.product_name}</b> | Lot: <b>{selectedRecall.lot_no}</b>
                  </Typography>
                </Box>
                <Chip label={`Severity: ${selectedRecall.severity}`} color="error" sx={{ fontWeight: 800 }} />
              </Box>

              <CardContent sx={{ p: 3 }}>
                {/* REASON & AUTOMATED QUARANTINE BANNER */}
                <Alert severity="error" icon={<BlockIcon />} sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    RECALL REASON: {selectedRecall.reason}
                  </Typography>
                  Inventory Block Active: All remaining stock of lot <b>{selectedRecall.lot_no}</b> automatically locked in Stock Lots table.
                </Alert>

                {/* LOT MASS BALANCE METRICS */}
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1.5, color: '#1e293b' }}>
                  Lot Impact & Recovery Progress
                </Typography>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={3}>
                    <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', bgcolor: '#f8fafc' }}>
                      <Typography variant="caption" color="text.secondary">TOTAL PRODUCED</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 800 }}>{lotDetails.produced_qty_kg} KG</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={3}>
                    <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', bgcolor: '#fef2f2' }}>
                      <Typography variant="caption" color="error">QUARANTINED STOCK</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: '#ef4444' }}>{lotDetails.quarantined_qty_kg} KG</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={3}>
                    <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', bgcolor: '#fffbeb' }}>
                      <Typography variant="caption" color="warning.main">DISTRIBUTED / SOLD</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: '#b45309' }}>{lotDetails.sold_qty_kg} KG</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={3}>
                    <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', bgcolor: '#ecfdf5' }}>
                      <Typography variant="caption" color="success.main">RECOVERED</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: '#10b981' }}>{totalRecovered} KG</Typography>
                    </Paper>
                  </Grid>
                </Grid>

                {/* RECOVERY PROGRESS BAR */}
                <Box sx={{ mb: 4 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Customer Recall Recovery Progress
                    </Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#10b981' }}>
                      {recoveryPct}% ({totalRecovered} / {totalSold} KG)
                    </Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={recoveryPct} sx={{ height: 10, borderRadius: 5, bgcolor: '#e2e8f0' }} />
                </Box>

                {/* CUSTOMER NOTIFICATION LIST & RECOVERY ACTION */}
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1.5, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LocalShippingIcon color="primary" /> Customer Notification & Recovery List ({customers.length})
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead sx={{ bgcolor: 'grey.100' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Customer Name</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Invoice No</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Supplied Qty</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Credit Note</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="center">Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {customers.map((c) => (
                        <TableRow key={c.id} hover>
                          <TableCell sx={{ fontWeight: 600 }}>{c.customer_name}</TableCell>
                          <TableCell sx={{ fontFamily: 'monospace' }}>{c.invoice_no}</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>{c.supplied_qty_kg} KG</TableCell>
                          <TableCell>
                            <Chip
                              label={c.recall_status}
                              size="small"
                              color={c.recall_status === 'RECOVERED' ? 'success' : c.recall_status === 'PARTIAL_RECOVERED' ? 'warning' : 'error'}
                              sx={{ fontWeight: 700, fontSize: '10px' }}
                            />
                          </TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: '12px' }}>
                            {c.credit_note_no || '-'}
                          </TableCell>
                          <TableCell align="center">
                            {c.recall_status !== 'RECOVERED' && (
                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                                startIcon={<CheckCircleIcon />}
                                sx={{ fontSize: '11px', textTransform: 'none', py: 0.2 }}
                                onClick={() => handleUpdateCustomerRecall(c, 'RECOVERED')}
                              >
                                Mark Recovered
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          ) : (
            <Card variant="outlined" sx={{ p: 5, textAlign: 'center', borderRadius: 2 }}>
              <WarningAmberIcon sx={{ fontSize: 60, color: 'grey.400', mb: 1 }} />
              <Typography variant="h6" color="text.secondary">
                Select an active product recall order to view recovery execution
              </Typography>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* INITIATE RECALL MODAL */}
      <Dialog open={openRecallModal} onClose={() => setOpenRecallModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#991b1b' }}>Initiate Product Recall Order</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Alert severity="error">
              Initiating a recall will immediately place all inventory matching this lot number into <b>QUARANTINE</b> mode in the Stock Lots database.
            </Alert>
            <TextField
              label="Product Name"
              value={recallForm.product_name}
              onChange={(e) => setRecallForm({ ...recallForm, product_name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Lot Number"
              value={recallForm.lot_no}
              onChange={(e) => setRecallForm({ ...recallForm, lot_no: e.target.value })}
              fullWidth
              required
            />
            <TextField
              select
              label="Severity"
              value={recallForm.severity}
              onChange={(e) => setRecallForm({ ...recallForm, severity: e.target.value })}
              fullWidth
            >
              <MenuItem value="CRITICAL">CRITICAL (Immediate Health / Safety Hazard)</MenuItem>
              <MenuItem value="HIGH">HIGH (Specification / Quality Non-Compliance)</MenuItem>
              <MenuItem value="MEDIUM">MEDIUM (Minor Defect)</MenuItem>
            </TextField>
            <TextField
              multiline
              rows={3}
              label="Recall Reason / Explanation"
              value={recallForm.reason}
              onChange={(e) => setRecallForm({ ...recallForm, reason: e.target.value })}
              fullWidth
              required
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRecallModal(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleInitiateRecall}>Execute Quarantine & Recall</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
