import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  Tabs,
  Tab,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Divider,
  Stack,
  MenuItem,
  Select,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  Handshake as HandshakeIcon,
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  AssignmentTurnedIn as AssignmentTurnedInIcon,
  AccountBalance as AccountBalanceIcon,
  Star as StarIcon,
  Receipt as ReceiptIcon,
  LocalShipping as LocalShippingIcon
} from '@mui/icons-material';
import manufacturingService from '../../services/manufacturingService';

const JobworkControlDashboard = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [scorecards, setScorecards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Selected Contractor for Ledger
  const [selectedContractorForLedger, setSelectedContractorForLedger] = useState('');
  const [contractorLedger, setContractorLedger] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Dialogs
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState(null);

  // Form State for Order
  const [orderForm, setOrderForm] = useState({
    contractorName: '',
    orderDate: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
    remarks: '',
    items: [
      { itemName: 'Urad Flour Fine', lotNo: 'FLR-LOT-01', issuedQtyKg: 1000, rate: 12 }
    ]
  });

  // Form State for Receipt
  const [receiptForm, setReceiptForm] = useState({
    receiptNo: `JWR-${Date.now().toString().slice(-4)}`,
    receiptDate: new Date().toISOString().split('T')[0],
    outputItemName: 'Special Papad (4.5")',
    outputLotNo: `PAP-${Date.now().toString().slice(-4)}`,
    receivedQtyKg: 900,
    actualWastageKg: 25,
    qcStatus: 'ACCEPTED',
    remarks: ''
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [stRes, oRes, cRes, scRes] = await Promise.all([
        manufacturingService.getJobworkStats(),
        manufacturingService.getJobworkOrders(),
        manufacturingService.getContractors(),
        manufacturingService.getContractorScorecards()
      ]);

      if (stRes.success) setStats(stRes.data);
      if (oRes.success) setOrders(oRes.data);
      if (cRes.success) {
        setContractors(cRes.data);
        if (cRes.data.length > 0 && !selectedContractorForLedger) {
          setSelectedContractorForLedger(cRes.data[0].name);
        }
      }
      if (scRes.success) setScorecards(scRes.data);
    } catch (e) {
      console.error('Error loading jobwork data:', e);
      setError('Failed to load Jobwork Control Center data.');
    } finally {
      setLoading(false);
    }
  }, [selectedContractorForLedger]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load Ledger
  const fetchLedger = useCallback(async (cName) => {
    if (!cName) return;
    setLedgerLoading(true);
    try {
      const res = await manufacturingService.getContractorLedger(cName);
      if (res.success) {
        setContractorLedger(res.data);
      }
    } catch (e) {
      console.error('Error fetching ledger:', e);
    } finally {
      setLedgerLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedContractorForLedger) {
      fetchLedger(selectedContractorForLedger);
    }
  }, [selectedContractorForLedger, fetchLedger]);

  // Handle Create Order
  const handleSaveOrder = async () => {
    try {
      const res = await manufacturingService.createJobworkOrder(orderForm);
      if (res.success) {
        setSuccessMsg('Jobwork order created and material dispatched successfully');
        setOrderDialogOpen(false);
        fetchData();
      }
    } catch (e) {
      setError(e.message || 'Error creating jobwork order');
    }
  };

  // Handle Record Receipt
  const handleSaveReceipt = async () => {
    try {
      const res = await manufacturingService.recordJobworkReceipt({
        jobworkId: selectedOrderForReceipt.id,
        contractorName: selectedOrderForReceipt.contractor_name,
        ...receiptForm
      });
      if (res.success) {
        setSuccessMsg(`Papad stock receipt #${receiptForm.outputLotNo} recorded and QC verified!`);
        setReceiptDialogOpen(false);
        fetchData();
      }
    } catch (e) {
      setError(e.message || 'Error recording jobwork receipt');
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: '1600px', mx: 'auto' }}>
      {/* Header */}
      <Paper elevation={0} sx={{ p: 2.5, mb: 3, borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
        <Grid container spacing={2} alignItems="center" justifyContent="space-between">
          <Grid item xs={12} md={7}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <HandshakeIcon sx={{ color: '#0284c7', fontSize: 32 }} />
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
                  Jobwork & Contractor Control Center
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b' }}>
                  Material issue tracking, expected vs actual papad yield, allowed vs excess wastage audit, and contractor ledgers.
                </Typography>
              </Box>
            </Stack>
          </Grid>
          <Grid item xs={12} md={5}>
            <Stack direction="row" spacing={1.5} justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  setOrderForm({
                    contractorName: contractors[0]?.name || '',
                    orderDate: new Date().toISOString().split('T')[0],
                    expectedDeliveryDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
                    remarks: '',
                    items: [
                      { itemName: '', lotNo: '', issuedQtyKg: '', rate: '' }
                    ]
                  });
                  setOrderDialogOpen(true);
                }}
                sx={{ bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' }, textTransform: 'none', fontWeight: 600 }}
              >
                Issue Jobwork Order
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={2}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: '10px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>FLOUR ISSUED</Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>{stats?.totalIssuedKg || 0} <span style={{ fontSize: '13px' }}>KG</span></Typography>
            <Typography variant="caption" sx={{ color: '#0284c7' }}>Across {stats?.activeContractors || 3} Contractors</Typography>
          </Paper>
        </Grid>

        <Grid item xs={6} md={2}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: '10px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>EXPECTED PAPAD</Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>{stats?.expectedOutputKg || 0} <span style={{ fontSize: '13px' }}>KG</span></Typography>
            <Typography variant="caption" sx={{ color: '#059669' }}>Std Yield: 90.0%</Typography>
          </Paper>
        </Grid>

        <Grid item xs={6} md={2}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: '10px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>PAPAD RECEIVED</Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#16a34a' }}>{stats?.receivedOutputKg || 0} <span style={{ fontSize: '13px' }}>KG</span></Typography>
            <Typography variant="caption" sx={{ color: '#16a34a' }}>QC Verified</Typography>
          </Paper>
        </Grid>

        <Grid item xs={6} md={2}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: '10px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>PENDING BALANCE</Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#ca8a04' }}>{stats?.pendingOutputKg || 0} <span style={{ fontSize: '13px' }}>KG</span></Typography>
            <Typography variant="caption" sx={{ color: '#ca8a04' }}>In Processing</Typography>
          </Paper>
        </Grid>

        <Grid item xs={6} md={2}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: '10px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>EXCESS WASTAGE</Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, color: (stats?.excessWastageKg || 0) > 0 ? '#dc2626' : '#16a34a' }}>
              {stats?.excessWastageKg || 0} <span style={{ fontSize: '13px' }}>KG</span>
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b' }}>Allowed: {stats?.allowedWastageKg || 0} KG</Typography>
          </Paper>
        </Grid>

        <Grid item xs={6} md={2}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: '10px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>JOBWORK CHARGES</Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>₹{stats?.totalJobworkCharges?.toLocaleString('en-IN') || '0'}</Typography>
            <Typography variant="caption" sx={{ color: '#64748b' }}>Payable to Contractors</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Messages */}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg('')}>{successMsg}</Alert>}

      {/* Main Tabs */}
      <Paper elevation={0} sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
        <Tabs
          value={activeTab}
          onChange={(e, val) => setActiveTab(val)}
          textColor="primary"
          indicatorColor="primary"
          sx={{ borderBottom: '1px solid #f1f5f9', px: 2 }}
        >
          <Tab icon={<ReceiptIcon />} iconPosition="start" label="Jobwork Orders & Processing" sx={{ fontWeight: 700, textTransform: 'none' }} />
          <Tab icon={<AccountBalanceIcon />} iconPosition="start" label="Contractor Material Ledger" sx={{ fontWeight: 700, textTransform: 'none' }} />
          <Tab icon={<StarIcon />} iconPosition="start" label="Performance Scorecards" sx={{ fontWeight: 700, textTransform: 'none' }} />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* TAB 0: ORDERS */}
          {activeTab === 0 && (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '8px' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Order #</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Contractor Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Order Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Flour Issued (KG)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Expected Papad (KG)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Received (KG)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Pending (KG)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 4, color: '#64748b' }}>No active jobwork orders.</TableCell>
                    </TableRow>
                  ) : (
                    orders.map((o) => (
                      <TableRow key={`order-${o.id}`} hover>
                        <TableCell sx={{ fontWeight: 700, color: '#0284c7' }}>{o.order_no}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{o.contractor_name}</TableCell>
                        <TableCell>{o.order_date}</TableCell>
                        <TableCell>{o.total_issued_qty_kg} KG</TableCell>
                        <TableCell>{o.expected_output_kg} KG</TableCell>
                        <TableCell sx={{ color: '#16a34a', fontWeight: 600 }}>{o.received_output_kg} KG</TableCell>
                        <TableCell sx={{ color: '#ca8a04', fontWeight: 600 }}>{o.pending_output_kg} KG</TableCell>
                        <TableCell>
                          <Chip label={o.status || 'Issued'} size="small" color={o.status === 'Completed' ? 'success' : 'primary'} sx={{ fontWeight: 600 }} />
                        </TableCell>
                        <TableCell>
                          {o.status !== 'Completed' && (
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => {
                                setSelectedOrderForReceipt(o);
                                setReceiptForm({
                                  ...receiptForm,
                                  receivedQtyKg: o.pending_output_kg || o.expected_output_kg || 100
                                });
                                setReceiptDialogOpen(true);
                              }}
                              sx={{ bgcolor: '#0284c7', textTransform: 'none', fontSize: '11px' }}
                            >
                              Receive Goods
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* TAB 1: CONTRACTOR LEDGER */}
          {activeTab === 1 && (
            <Box>
              <Paper sx={{ p: 2, mb: 3, bgcolor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Select Contractor</InputLabel>
                      <Select
                        value={selectedContractorForLedger}
                        label="Select Contractor"
                        onChange={(e) => setSelectedContractorForLedger(e.target.value)}
                      >
                        {contractors.map((c) => (
                          <MenuItem key={`c-opt-${c.id}`} value={c.name}>
                            {c.name} ({c.type})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                      Current Outstanding Material with Contractor: <span style={{ color: '#0284c7' }}>{contractorLedger?.currentMaterialBalanceKg || 0} KG</span>
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>

              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '8px' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f8fafc' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Ref / Voucher #</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Transaction</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Material / Lot</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Issued (KG)</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Received (KG)</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Balance (KG)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ledgerLoading ? (
                      <TableRow><TableCell colSpan={7} align="center" sx={{ py: 3 }}><CircularProgress size={24} /></TableCell></TableRow>
                    ) : contractorLedger?.materialLedger?.length === 0 ? (
                      <TableRow><TableCell colSpan={7} align="center" sx={{ py: 3, color: '#64748b' }}>No movements recorded for this contractor.</TableCell></TableRow>
                    ) : (
                      contractorLedger?.materialLedger?.map((row, idx) => (
                        <TableRow key={`led-${idx}`} hover>
                          <TableCell>{row.date}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{row.refNo}</TableCell>
                          <TableCell><Chip label={row.type} size="small" color={row.type === 'Issue' ? 'primary' : 'success'} sx={{ fontWeight: 600 }} /></TableCell>
                          <TableCell>{row.itemName} ({row.lotNo || 'N/A'})</TableCell>
                          <TableCell>{row.issuedKg ? `${row.issuedKg} KG` : '—'}</TableCell>
                          <TableCell>{row.receivedKg ? `${row.receivedKg} KG` : '—'}</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: '#0284c7' }}>{row.balanceKg} KG</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* TAB 2: SCORECARDS */}
          {activeTab === 2 && (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '8px' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Contractor Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>On-Time Delivery %</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Yield Efficiency %</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Excess Wastage %</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Quality Pass Rate %</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Rating</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {scorecards.map((sc) => (
                    <TableRow key={`sc-${sc.id}`} hover>
                      <TableCell sx={{ fontWeight: 700 }}>{sc.name}</TableCell>
                      <TableCell>{sc.type}</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#16a34a' }}>{sc.onTimeDeliveryRate}%</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#0284c7' }}>{sc.yieldEfficiencyPct}%</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#ca8a04' }}>{sc.excessWastagePct}%</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#16a34a' }}>{sc.qualityPassRatePct}%</TableCell>
                      <TableCell>
                        <Chip label="Grade A Contractor" size="small" color="success" sx={{ fontWeight: 700 }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </Paper>

      {/* Create Order Dialog */}
      <Dialog open={orderDialogOpen} onClose={() => setOrderDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Issue Flour to Jobwork Contractor</DialogTitle>
        <DialogContent dividers>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Contractor</InputLabel>
            <Select
              value={orderForm.contractorName}
              label="Contractor"
              onChange={(e) => setOrderForm({ ...orderForm, contractorName: e.target.value })}
            >
              {contractors.map((c) => (
                <MenuItem key={`ctr-${c.id}`} value={c.name}>{c.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            size="small"
            label="Target Flour Material"
            value={orderForm.items[0]?.itemName}
            onChange={(e) => {
              const items = [...orderForm.items];
              items[0].itemName = e.target.value;
              setOrderForm({ ...orderForm, items });
            }}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            size="small"
            label="Source Flour Lot #"
            value={orderForm.items[0]?.lotNo}
            onChange={(e) => {
              const items = [...orderForm.items];
              items[0].lotNo = e.target.value;
              setOrderForm({ ...orderForm, items });
            }}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            size="small"
            label="Issued Quantity (KG)"
            type="number"
            value={orderForm.items[0]?.issuedQtyKg}
            onChange={(e) => {
              const items = [...orderForm.items];
              items[0].issuedQtyKg = e.target.value;
              setOrderForm({ ...orderForm, items });
            }}
            sx={{ mb: 2 }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOrderDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveOrder} sx={{ bgcolor: '#0284c7' }}>
            Dispatch Material
          </Button>
        </DialogActions>
      </Dialog>

      {/* Receive Finished Goods Dialog */}
      <Dialog open={receiptDialogOpen} onClose={() => setReceiptDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Record Papad Receipt & QC Inward</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
            Receiving finished product for order <strong>{selectedOrderForReceipt?.order_no}</strong> ({selectedOrderForReceipt?.contractor_name})
          </Typography>

          <TextField
            fullWidth
            size="small"
            label="Finished Papad Item"
            value={receiptForm.outputItemName}
            onChange={(e) => setReceiptForm({ ...receiptForm, outputItemName: e.target.value })}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            size="small"
            label="Generated Papad Lot #"
            value={receiptForm.outputLotNo}
            onChange={(e) => setReceiptForm({ ...receiptForm, outputLotNo: e.target.value })}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            size="small"
            label="Received Weight (KG)"
            type="number"
            value={receiptForm.receivedQtyKg}
            onChange={(e) => setReceiptForm({ ...receiptForm, receivedQtyKg: e.target.value })}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            size="small"
            label="Reported Wastage (KG)"
            type="number"
            value={receiptForm.actualWastageKg}
            onChange={(e) => setReceiptForm({ ...receiptForm, actualWastageKg: e.target.value })}
            sx={{ mb: 2 }}
          />

          <FormControl fullWidth size="small">
            <InputLabel>QC Inward Result</InputLabel>
            <Select
              value={receiptForm.qcStatus}
              label="QC Inward Result"
              onChange={(e) => setReceiptForm({ ...receiptForm, qcStatus: e.target.value })}
            >
              <MenuItem value="ACCEPTED">ACCEPTED (Pass to Warehouse)</MenuItem>
              <MenuItem value="REJECTED">REJECTED (Quality Defect)</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setReceiptDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveReceipt} sx={{ bgcolor: '#0284c7' }}>
            Verify & Inward Stock
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default JobworkControlDashboard;
