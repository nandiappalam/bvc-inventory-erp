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
  Autocomplete
} from '@mui/material';
import {
  Search as SearchIcon,
  AccountTree as AccountTreeIcon,
  CallSplit as CallSplitIcon,
  ReportProblem as ReportProblemIcon,
  CheckCircle as CheckCircleIcon,
  LocalShipping as LocalShippingIcon,
  Factory as FactoryIcon,
  Inventory as InventoryIcon,
  Assignment as AssignmentIcon,
  Print as PrintIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import manufacturingService from '../../services/manufacturingService';

const LotGenealogyDashboard = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedLotNo, setSelectedLotNo] = useState('');
  const [lotOptions, setLotOptions] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [lotDetails, setLotDetails] = useState(null);
  const [forwardTree, setForwardTree] = useState(null);
  const [backwardTree, setBackwardTree] = useState(null);
  const [recallReport, setRecallReport] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [splitRows, setSplitRows] = useState([
    { targetLotNo: '', quantity: '', godownName: 'Main Godown' },
    { targetLotNo: '', quantity: '', godownName: 'Main Godown' }
  ]);

  // Fetch lot suggestions from database
  const fetchLotOptions = useCallback(async (q = '') => {
    try {
      const res = await manufacturingService.searchLots(q);
      if (res.success && res.data) {
        setLotOptions(res.data);
        if (!selectedLotNo && res.data.length > 0) {
          setSelectedLotNo(res.data[0].lotNo);
        }
      }
    } catch (e) {
      console.error('Error fetching lot options:', e);
    }
  }, [selectedLotNo]);

  useEffect(() => {
    fetchLotOptions();
  }, [fetchLotOptions]);

  // Load Lot Genealogy Details
  const loadLotData = useCallback(async (lotNo) => {
    if (!lotNo) return;
    setDetailsLoading(true);
    setError('');
    try {
      const [detRes, fwdRes, backRes, recRes] = await Promise.all([
        manufacturingService.getLotDetails(lotNo),
        manufacturingService.getForwardTrace(lotNo),
        manufacturingService.getBackwardTrace(lotNo),
        manufacturingService.getRecallReport(lotNo)
      ]);

      if (detRes.success) setLotDetails(detRes.data);
      if (fwdRes.success) setForwardTree(fwdRes.data);
      if (backRes.success) setBackwardTree(backRes.data);
      if (recRes.success) setRecallReport(recRes.data);
    } catch (e) {
      console.error('Error loading lot trace:', e);
      setError('Could not load complete genealogy tree for this lot.');
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedLotNo) {
      loadLotData(selectedLotNo);
    }
  }, [selectedLotNo, loadLotData]);

  // Handle Split
  const handleSplitSubmit = async () => {
    try {
      const res = await manufacturingService.performLotSplit({
        sourceLotNo: selectedLotNo,
        splitQuantities: splitRows.filter(r => parseFloat(r.quantity) > 0),
        reason: 'Grading / Sub-lot allocation'
      });
      if (res.success) {
        setSuccessMsg(`Lot ${selectedLotNo} successfully split into sub-lots!`);
        setSplitDialogOpen(false);
        fetchLotOptions();
        loadLotData(selectedLotNo);
      }
    } catch (e) {
      setError(e.message || 'Error executing lot split');
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: '1600px', mx: 'auto' }}>
      {/* Top Header */}
      <Paper elevation={0} sx={{ p: 2.5, mb: 3, borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
        <Grid container spacing={2} alignItems="center" justifyContent="space-between">
          <Grid item xs={12} md={7}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <AccountTreeIcon sx={{ color: '#0284c7', fontSize: 32 }} />
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
                  Lot Genealogy & Traceability Engine
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b' }}>
                  Bidirectional supply-chain traceability, QC inspection links, mass-balance audit, and rapid recall readiness.
                </Typography>
              </Box>
            </Stack>
          </Grid>
          <Grid item xs={12} md={5}>
            <Stack direction="row" spacing={1.5} justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
              <Button
                variant="outlined"
                startIcon={<CallSplitIcon />}
                onClick={() => {
                  setSplitRows([
                    { targetLotNo: `${selectedLotNo}-A`, quantity: '', godownName: lotDetails?.godown || 'Main Godown' },
                    { targetLotNo: `${selectedLotNo}-B`, quantity: '', godownName: lotDetails?.godown || 'Main Godown' }
                  ]);
                  setSplitDialogOpen(true);
                }}
                disabled={!selectedLotNo}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                Split Lot
              </Button>
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={() => {
                  fetchLotOptions();
                  if (selectedLotNo) loadLotData(selectedLotNo);
                }}
                sx={{ bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' }, textTransform: 'none', fontWeight: 600 }}
              >
                Refresh
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Lot Selector & Quick Stats Bar */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: '10px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155', mb: 1 }}>
              Select Active Lot for Inspection
            </Typography>
            <Autocomplete
              options={lotOptions}
              getOptionLabel={(option) => `${option.lotNo} — ${option.itemName} (${option.currentQuantity || option.quantity || 0} KG)`}
              value={lotOptions.find(o => o.lotNo === selectedLotNo) || null}
              onChange={(e, val) => {
                if (val) setSelectedLotNo(val.lotNo);
              }}
              renderInput={(params) => (
                <TextField {...params} size="small" placeholder="Search by Lot #, Grain or Output..." />
              )}
            />
          </Paper>
        </Grid>

        <Grid item xs={6} md={2}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: '10px', border: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>CURRENT STOCK</Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
              {lotDetails?.remainingQuantity ?? '0'} <span style={{ fontSize: '13px', fontWeight: 500 }}>KG</span>
            </Typography>
            <Typography variant="caption" sx={{ color: lotDetails?.totalReturnedQty > 0 ? '#b91c1c' : '#059669', fontWeight: 600, display: 'block' }}>
              {lotDetails?.totalReturnedQty > 0 ? `Returned: ${lotDetails.totalReturnedQty} Bags (${lotDetails.totalReturnedWeight || lotDetails.totalReturnedQty * 50} KG)` : `Original: ${lotDetails?.quantity ?? 0} KG`}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={6} md={2}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: '10px', border: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>QC & RETURN STATUS</Typography>
            <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              <Chip
                label={lotDetails?.qcStatus || 'ACCEPTED'}
                size="small"
                color={lotDetails?.qcStatus === 'RETURNED' || lotDetails?.qcStatus === 'REJECTED' ? 'error' : (lotDetails?.qcStatus === 'PARTIALLY_RETURNED' ? 'warning' : 'success')}
                sx={{ fontWeight: 700, fontSize: '12px' }}
              />
              {lotDetails?.purchaseReturns?.length > 0 && (
                <Chip
                  label="DEBIT NOTE ISSUED"
                  size="small"
                  color="error"
                  variant="outlined"
                  sx={{ fontWeight: 700, fontSize: '10px', height: '20px' }}
                />
              )}
            </Box>
            <Typography variant="caption" sx={{ color: '#64748b', mt: 0.5, display: 'block' }}>
              {lotDetails?.qc?.qc_no ? `QC #${lotDetails.qc.qc_no}` : (lotDetails?.purchaseReturns?.length > 0 ? `Ret Inv #${lotDetails.purchaseReturns[0].return_inv_no || lotDetails.purchaseReturns[0].return_s_no}` : 'Inward Verified')}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={6} md={2}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: '10px', border: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>STORAGE GODOWN</Typography>
            <Typography variant="body1" sx={{ fontWeight: 700, color: '#0f172a', mt: 0.5 }}>
              {lotDetails?.godown || 'Main Godown'}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              Unit: {lotDetails?.unit || 'KG'}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={6} md={2}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: '10px', border: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>AUDIT COMPLIANCE</Typography>
            <Typography variant="body1" sx={{ fontWeight: 700, color: '#0284c7', mt: 0.5 }}>
              100% Trackable
            </Typography>
            <Typography variant="caption" sx={{ color: '#059669', fontWeight: 600 }}>
              FSSAI Recall Ready
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Messages */}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg('')}>{successMsg}</Alert>}

      {/* Navigation Tabs */}
      <Paper elevation={0} sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(e, val) => setActiveTab(val)}
          textColor="primary"
          indicatorColor="primary"
          sx={{ borderBottom: '1px solid #f1f5f9', px: 2 }}
        >
          <Tab icon={<ArrowForwardIcon />} iconPosition="start" label="Forward Trace (Where it Went)" sx={{ fontWeight: 700, textTransform: 'none' }} />
          <Tab icon={<ArrowBackIcon />} iconPosition="start" label="Backward Trace (Where it Came From)" sx={{ fontWeight: 700, textTransform: 'none' }} />
          <Tab icon={<ReportProblemIcon />} iconPosition="start" label="Audit & Recall Readiness" sx={{ fontWeight: 700, textTransform: 'none' }} />
          <Tab icon={<InventoryIcon />} iconPosition="start" label="Lot Master Register" sx={{ fontWeight: 700, textTransform: 'none' }} />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {detailsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={36} />
            </Box>
          ) : (
            <>
              {/* TAB 0: FORWARD TRACE */}
              {activeTab === 0 && (
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', mb: 2 }}>
                    Forward Traceability Flow for Lot: <span style={{ color: '#0284c7' }}>{selectedLotNo}</span>
                  </Typography>

                  <Grid container spacing={2}>
                    {/* Step 1: Raw Material Inward */}
                    <Grid item xs={12} md={4}>
                      <Card variant="outlined" sx={{ borderRadius: '10px', height: '100%', borderColor: '#cbd5e1' }}>
                        <CardContent>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                            <LocalShippingIcon sx={{ color: '#0284c7' }} />
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a' }}>
                              1. Inward Ingestion & QC
                            </Typography>
                          </Stack>
                          <Divider sx={{ mb: 1.5 }} />
                          {lotDetails?.purchase ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                              <Typography variant="body2">
                                <strong>Supplier:</strong> {lotDetails.purchase.supplierName || 'N/A'}
                              </Typography>
                              <Typography variant="body2">
                                <strong>Purchase Voucher:</strong> #{lotDetails.purchase.voucherNo || (lotDetails.purchase.purchaseId ? 'PUR-' + lotDetails.purchase.purchaseId : 'N/A')}
                              </Typography>
                              {lotDetails.purchase.poNo && (
                                <Typography variant="body2">
                                  <strong>PO Ref:</strong> {lotDetails.purchase.poNo}
                                </Typography>
                              )}
                              <Typography variant="body2">
                                <strong>Inward Date:</strong> {lotDetails.purchase.purchaseDate || 'N/A'}
                              </Typography>
                              <Typography variant="body2">
                                <strong>Vehicle:</strong> {lotDetails.purchase.vehicleNo || 'N/A'}
                              </Typography>
                              {lotDetails.purchase.transportName && (
                                <Typography variant="body2">
                                  <strong>Transport:</strong> {lotDetails.purchase.transportName}
                                </Typography>
                              )}
                              <Typography variant="body2">
                                <strong>Inward Qty:</strong> {lotDetails.purchase.qty ? `${lotDetails.purchase.qty} Bags (${lotDetails.purchase.totalWeight || lotDetails.purchase.qty * 50} KG)` : (lotDetails.quantity ? `${lotDetails.quantity} KG` : 'N/A')}
                              </Typography>
                              {lotDetails.purchase.isDerivedFromParent && (
                                <Chip
                                  label={`Inward derived from Raw Parent Lot #${lotDetails.purchase.parentLotNo}`}
                                  size="small"
                                  color="info"
                                  sx={{ fontWeight: 600, mt: 0.5 }}
                                />
                              )}
                              {lotDetails.qc ? (
                                <Box sx={{ mt: 1, p: 1, bgcolor: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                                  <Typography variant="caption" sx={{ color: '#166534', fontWeight: 700, display: 'block' }}>
                                    QC Status: {lotDetails.qc.overall_result || 'ACCEPTED'} {lotDetails.qc.qc_no ? `(${lotDetails.qc.qc_no})` : ''}
                                  </Typography>
                                  {lotDetails.qc.summarySpecs && (
                                    <Typography variant="caption" sx={{ color: '#15803d', display: 'block', mt: 0.5 }}>
                                      {lotDetails.qc.summarySpecs}
                                    </Typography>
                                  )}
                                </Box>
                              ) : (
                                <Box sx={{ mt: 1, p: 1, bgcolor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                  <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600, display: 'block' }}>
                                    QC Status: {lotDetails.qcStatus || 'ACCEPTED'} (Inward Verified)
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          ) : (
                            <Typography variant="body2" sx={{ color: '#64748b' }}>
                              No purchase inward record linked directly to this lot.
                            </Typography>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* Step 2: Milling & Intermediate Output */}
                    <Grid item xs={12} md={4}>
                      <Card variant="outlined" sx={{ borderRadius: '10px', height: '100%', borderColor: '#cbd5e1' }}>
                        <CardContent>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                            <FactoryIcon sx={{ color: '#8b5cf6' }} />
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a' }}>
                              2. Milling & Production
                            </Typography>
                          </Stack>
                          <Divider sx={{ mb: 1.5 }} />
                          {lotDetails?.millingConsumptions?.length > 0 || lotDetails?.millingOutputs?.length > 0 ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                              {/* Milling consumptions */}
                              {lotDetails.millingConsumptions?.map((wo, i) => (
                                <Box key={`mc-${i}`} sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                                      Batch #{wo.work_order_no}
                                    </Typography>
                                    <Chip label="CONSUMED" size="small" sx={{ fontSize: '10px', height: '20px', fontWeight: 700, bgcolor: '#e0f2fe', color: '#0369a1' }} />
                                  </Stack>
                                  <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5 }}>
                                    Flour Mill: <strong>{wo.work_unit}</strong> | Date: <strong>{wo.work_order_date}</strong>
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: '#334155', display: 'block' }}>
                                    Consumed: <strong>{wo.input_qty} KG</strong> | Target: <strong>{wo.target_product}</strong>
                                  </Typography>
                                  {wo.output_lot_no && (
                                    <Chip
                                      label={`→ Output Lot #${wo.output_lot_no} (${wo.output_weight || wo.input_qty} KG)`}
                                      size="small"
                                      color="primary"
                                      sx={{ mt: 0.8, fontWeight: 600, fontSize: '11px' }}
                                    />
                                  )}
                                </Box>
                              ))}

                              {/* Milling outputs */}
                              {lotDetails.millingOutputs?.map((mo, i) => (
                                <Box key={`mo-${i}`} sx={{ p: 1.5, bgcolor: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                                      Batch #{mo.work_order_no}
                                    </Typography>
                                    <Chip label="PRODUCED" size="small" color="success" sx={{ fontSize: '10px', height: '20px', fontWeight: 700 }} />
                                  </Stack>
                                  <Typography variant="caption" sx={{ color: '#166534', display: 'block', mt: 0.5 }}>
                                    Flour Mill: <strong>{mo.work_unit}</strong> | Date: <strong>{mo.work_order_date}</strong>
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: '#14532d', display: 'block' }}>
                                    Produced: <strong>{mo.output_kgs} KG</strong> {mo.finished_product}
                                  </Typography>
                                  {mo.input_lot_no && (
                                    <Chip
                                      label={`Milled From Raw Lot #${mo.input_lot_no}`}
                                      size="small"
                                      sx={{ mt: 0.8, fontWeight: 600, fontSize: '11px', bgcolor: '#dbeafe', color: '#1e40af' }}
                                    />
                                  )}
                                </Box>
                              ))}
                            </Box>
                          ) : (
                            <Box sx={{ p: 1, bgcolor: '#f8fafc', borderRadius: '6px' }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>Direct Godown Allocation</Typography>
                              <Typography variant="caption" sx={{ color: '#64748b' }}>Ready for Milling or Work Order processing.</Typography>
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* Step 3: Jobwork & Customer Sales */}
                    <Grid item xs={12} md={4}>
                      <Card variant="outlined" sx={{ borderRadius: '10px', height: '100%', borderColor: '#cbd5e1' }}>
                        <CardContent>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                            <AssignmentIcon sx={{ color: '#059669' }} />
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a' }}>
                              3. Jobwork & Distribution
                            </Typography>
                          </Stack>
                          <Divider sx={{ mb: 1.5 }} />
                          {lotDetails?.salesDispatches?.length > 0 || lotDetails?.jobworkMovements?.length > 0 || lotDetails?.purchaseReturns?.length > 0 ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              {lotDetails.purchaseReturns?.map((pr, i) => (
                                <Box key={`pr-${i}`} sx={{ p: 1, bgcolor: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca' }}>
                                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#991b1b' }}>
                                      Purchase Return (Debit Note)
                                    </Typography>
                                    <Chip label="RETURNED" size="small" color="error" sx={{ fontSize: '10px', height: '20px', fontWeight: 700 }} />
                                  </Stack>
                                  <Typography variant="caption" sx={{ color: '#991b1b', display: 'block', mt: 0.5 }}>
                                    Supplier: <strong>{pr.supplier_name}</strong> | Ret Inv: <strong>#{pr.return_inv_no || pr.return_s_no}</strong>
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: '#b91c1c', display: 'block' }}>
                                    Returned Qty: <strong>{pr.qty} Bags ({pr.total_wt || pr.qty * 50} KG)</strong> | Date: <strong>{pr.return_date}</strong>
                                  </Typography>
                                  {pr.reason && (
                                    <Typography variant="caption" sx={{ color: '#7f1d1d', display: 'block', fontStyle: 'italic', mt: 0.25 }}>
                                      Reason: {pr.reason}
                                    </Typography>
                                  )}
                                </Box>
                              ))}
                              {lotDetails.jobworkMovements?.map((jw, i) => (
                                <Box key={`jw-${i}`} sx={{ p: 1, bgcolor: '#fef3c7', borderRadius: '6px', border: '1px solid #fde68a' }}>
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Contractor: {jw.contractor_name}</Typography>
                                  <Typography variant="caption" sx={{ color: '#92400e' }}>Dispatch #{jw.dispatch_no} | Issued: {jw.total_wt || jw.qty} KG</Typography>
                                </Box>
                              ))}
                              {lotDetails.salesDispatches?.map((sd, i) => (
                                <Box key={`sd-${i}`} sx={{ p: 1, bgcolor: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Customer: {sd.customer_name}</Typography>
                                  <Typography variant="caption" sx={{ color: '#64748b' }}>Invoice #{sd.bill_no} | Qty: {sd.qty} KG</Typography>
                                </Box>
                              ))}
                            </Box>
                          ) : (
                            <Typography variant="body2" sx={{ color: '#64748b' }}>
                              Material currently in stock in <strong>{lotDetails?.godown || 'Main Godown'}</strong>. No downstream customer dispatches, contractor transfers, or vendor returns.
                            </Typography>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </Box>
              )}

              {/* TAB 1: BACKWARD TRACE */}
              {activeTab === 1 && (
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', mb: 2 }}>
                    Backward Ancestry Flow for: <span style={{ color: '#0284c7' }}>{selectedLotNo}</span>
                  </Typography>

                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '8px' }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: '#f8fafc' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Stage</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Source Entity / Ref</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Item Description</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Quantity (KG)</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>QC & Status</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {/* 1. If generated by Milling / Work Orders */}
                        {lotDetails?.millingOutputs?.map((mo, idx) => (
                          <TableRow key={`back-mo-${idx}`}>
                            <TableCell>
                              <Chip label="Milling / Production" size="small" sx={{ fontWeight: 700, bgcolor: '#f3e8ff', color: '#6b21a8' }} />
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>
                              Milling Batch #{mo.work_order_no} ({mo.work_unit || 'BVC MILL'})
                            </TableCell>
                            <TableCell>{mo.finished_product || lotDetails?.itemName}</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>{mo.output_kgs} KG</TableCell>
                            <TableCell>
                              <Chip label="PRODUCED" size="small" color="success" sx={{ fontWeight: 600 }} />
                            </TableCell>
                            <TableCell>{mo.work_order_date || 'N/A'}</TableCell>
                          </TableRow>
                        ))}

                        {/* 2. Parent Raw Grain from Milling */}
                        {lotDetails?.millingOutputs?.filter(mo => mo.input_lot_no).map((mo, idx) => (
                          <TableRow key={`back-raw-${idx}`}>
                            <TableCell>
                              <Chip label="Raw Material Parent" size="small" color="primary" sx={{ fontWeight: 600 }} />
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>
                              Input Lot #{mo.input_lot_no} {lotDetails?.purchase?.supplierName ? `(Supplier: ${lotDetails.purchase.supplierName})` : ''}
                            </TableCell>
                            <TableCell>{mo.input_item || 'Raw Grain'}</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>{mo.output_kgs} KG</TableCell>
                            <TableCell>
                              <Chip label={lotDetails?.qcStatus || 'ACCEPTED'} size="small" color="success" sx={{ fontWeight: 600 }} />
                            </TableCell>
                            <TableCell>{mo.work_order_date || 'N/A'}</TableCell>
                          </TableRow>
                        ))}

                        {/* 3. Purchase Return / Debit Note Stage */}
                        {lotDetails?.purchaseReturns?.map((pr, idx) => (
                          <TableRow key={`back-pr-${idx}`} sx={{ bgcolor: '#fef2f2' }}>
                            <TableCell>
                              <Chip label="Purchase Return" size="small" color="error" sx={{ fontWeight: 700 }} />
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>
                              Returned to: {pr.supplier_name} | Ret Inv #{pr.return_inv_no || pr.return_s_no}
                            </TableCell>
                            <TableCell>{pr.item_name || lotDetails?.itemName}</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: '#dc2626' }}>
                              -{pr.total_wt || pr.qty * 50} KG ({pr.qty} Bags)
                            </TableCell>
                            <TableCell>
                              <Chip label={pr.return_status || 'RETURNED'} size="small" color="error" sx={{ fontWeight: 600 }} />
                            </TableCell>
                            <TableCell>{pr.return_date || 'N/A'}</TableCell>
                          </TableRow>
                        ))}

                        {/* 4. Inward Purchase Stage */}
                        {lotDetails?.purchase && (
                          <TableRow key="back-pur">
                            <TableCell>
                              <Chip label="Inward Ingestion" size="small" color="info" sx={{ fontWeight: 600 }} />
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>
                              Supplier: {lotDetails.purchase.supplierName} | Voucher #{lotDetails.purchase.voucherNo || lotDetails.purchase.invNo || 'N/A'} {lotDetails.purchase.vehicleNo !== 'N/A' ? `(Vehicle: ${lotDetails.purchase.vehicleNo})` : ''}
                            </TableCell>
                            <TableCell>{lotDetails.purchase.itemName || lotDetails.itemName}</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>
                              {lotDetails.purchase.totalWeight || (lotDetails.purchase.qty ? lotDetails.purchase.qty * 50 : lotDetails.quantity)} KG
                            </TableCell>
                            <TableCell>
                              <Chip label={lotDetails.qc?.overall_result || lotDetails.qcStatus || 'ACCEPTED'} size="small" color="success" sx={{ fontWeight: 600 }} />
                            </TableCell>
                            <TableCell>{lotDetails.purchase.purchaseDate || 'N/A'}</TableCell>
                          </TableRow>
                        )}

                        {/* Fallback if no purchase, return, or milling records exist */}
                        {!lotDetails?.purchase && (!lotDetails?.purchaseReturns || lotDetails.purchaseReturns.length === 0) && (!lotDetails?.millingOutputs || lotDetails.millingOutputs.length === 0) && (
                          <TableRow>
                            <TableCell>
                              <Chip label="Stock Lot" size="small" color="default" sx={{ fontWeight: 600 }} />
                            </TableCell>
                            <TableCell>Initial Stock Inward</TableCell>
                            <TableCell>{lotDetails?.itemName}</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>{lotDetails?.quantity} KG</TableCell>
                            <TableCell>
                              <Chip label={lotDetails?.qcStatus || 'ACCEPTED'} size="small" color="success" sx={{ fontWeight: 600 }} />
                            </TableCell>
                            <TableCell>N/A</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {/* TAB 2: AUDIT & RECALL READINESS */}
              {activeTab === 2 && (
                <Box>
                  <Paper sx={{ p: 3, bgcolor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', mb: 3 }}>
                    <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 800, color: '#991b1b' }}>
                          Regulatory Mock Recall & Quality Incident Report
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#b91c1c' }}>
                          Instant identification of affected raw materials, production batches, storage godowns, and customers for FSSAI compliance.
                        </Typography>
                      </Box>
                      <Button variant="contained" color="error" startIcon={<PrintIcon />} onClick={() => window.print()} sx={{ textTransform: 'none', fontWeight: 700 }}>
                        Export Recall Dossier
                      </Button>
                    </Stack>
                  </Paper>

                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Card variant="outlined" sx={{ borderRadius: '10px' }}>
                        <CardContent>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a', mb: 1 }}>
                            Affected Vendors & Raw Inwards
                          </Typography>
                          <Typography variant="body2">
                            <strong>Supplier:</strong> {lotDetails?.purchase?.supplierName || 'No direct vendor link'}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Purchase Ref:</strong> #{lotDetails?.purchase?.voucherNo || (lotDetails?.purchase?.purchaseId ? 'PUR-' + lotDetails.purchase.purchaseId : 'N/A')}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Inward Date:</strong> {lotDetails?.purchase?.purchaseDate || 'N/A'}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Vehicle:</strong> {lotDetails?.purchase?.vehicleNo || 'N/A'}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Card variant="outlined" sx={{ borderRadius: '10px' }}>
                        <CardContent>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a', mb: 1 }}>
                            Current Warehouse Exposure
                          </Typography>
                          <Typography variant="body2">
                            <strong>Godown Location:</strong> {lotDetails?.godown || 'Main Godown'}
                          </Typography>
                          <Typography variant="body2">
                            <strong>On-Hand Stock to Quarantine:</strong> {lotDetails?.remainingQuantity ?? 0} KG
                          </Typography>
                          <Typography variant="body2">
                            <strong>Current QC Lock:</strong> {lotDetails?.qcStatus || 'ACCEPTED'}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* Affected batches */}
                    <Grid item xs={12}>
                      <Card variant="outlined" sx={{ borderRadius: '10px' }}>
                        <CardContent>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a', mb: 1.5 }}>
                            Affected Milling & Production Batches
                          </Typography>
                          {lotDetails?.millingConsumptions?.length > 0 || lotDetails?.millingOutputs?.length > 0 ? (
                            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '6px' }}>
                              <Table size="small">
                                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                  <TableRow>
                                    <TableCell sx={{ fontWeight: 700 }}>Work Order / Batch #</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Flour Mill</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Quantity (KG)</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {lotDetails.millingConsumptions?.map((mc, idx) => (
                                    <TableRow key={`aff-mc-${idx}`}>
                                      <TableCell sx={{ fontWeight: 600, color: '#0284c7' }}>{mc.work_order_no}</TableCell>
                                      <TableCell>{mc.work_unit}</TableCell>
                                      <TableCell>{mc.work_order_date}</TableCell>
                                      <TableCell sx={{ fontWeight: 600 }}>{mc.input_qty} KG</TableCell>
                                      <TableCell><Chip label="CONSUMED" size="small" sx={{ fontSize: '11px', height: '22px' }} /></TableCell>
                                    </TableRow>
                                  ))}
                                  {lotDetails.millingOutputs?.map((mo, idx) => (
                                    <TableRow key={`aff-mo-${idx}`}>
                                      <TableCell sx={{ fontWeight: 600, color: '#0284c7' }}>{mo.work_order_no}</TableCell>
                                      <TableCell>{mo.work_unit}</TableCell>
                                      <TableCell>{mo.work_order_date}</TableCell>
                                      <TableCell sx={{ fontWeight: 600 }}>{mo.output_kgs} KG</TableCell>
                                      <TableCell><Chip label="PRODUCED" size="small" color="success" sx={{ fontSize: '11px', height: '22px' }} /></TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          ) : (
                            <Typography variant="body2" sx={{ color: '#64748b' }}>
                              No production batches have processed this lot yet.
                            </Typography>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </Box>
              )}

              {/* TAB 3: LOT MASTER REGISTER */}
              {activeTab === 3 && (
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '8px' }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: '#f8fafc' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Lot Number</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Item Name</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Current Stock (KG)</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>QC Status</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {lotOptions.map((lot, idx) => (
                        <TableRow key={`reg-${lot.lotNo}-${idx}`} hover selected={lot.lotNo === selectedLotNo}>
                          <TableCell sx={{ fontWeight: 700, color: '#0284c7' }}>{lot.lotNo}</TableCell>
                          <TableCell>{lot.itemName}</TableCell>
                          <TableCell>{lot.currentQuantity || lot.quantity || 0} KG</TableCell>
                          <TableCell>{lot.location || 'Main Godown'}</TableCell>
                          <TableCell>
                            <Chip label={lot.qcStatus || 'ACCEPTED'} size="small" color={lot.qcStatus === 'REJECTED' ? 'error' : 'success'} sx={{ fontWeight: 600 }} />
                          </TableCell>
                          <TableCell>
                            <Button size="small" variant="text" onClick={() => setSelectedLotNo(lot.lotNo)} sx={{ textTransform: 'none', fontWeight: 600 }}>
                              Inspect
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </>
          )}
        </Box>
      </Paper>

      {/* Split Dialog */}
      <Dialog open={splitDialogOpen} onClose={() => setSplitDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Split Lot: {selectedLotNo}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
            Available balance: <strong>{lotDetails?.remainingQuantity ?? 0} KG</strong>. Specify sub-lot IDs and target quantities.
          </Typography>
          {splitRows.map((row, idx) => (
            <Stack key={`split-row-${idx}`} direction="row" spacing={1.5} sx={{ mb: 1.5 }}>
              <TextField
                label="Target Lot #"
                size="small"
                value={row.targetLotNo}
                onChange={(e) => {
                  const updated = [...splitRows];
                  updated[idx].targetLotNo = e.target.value;
                  setSplitRows(updated);
                }}
                sx={{ flex: 1 }}
              />
              <TextField
                label="Quantity (KG)"
                type="number"
                size="small"
                value={row.quantity}
                onChange={(e) => {
                  const updated = [...splitRows];
                  updated[idx].quantity = e.target.value;
                  setSplitRows(updated);
                }}
                sx={{ width: 140 }}
              />
            </Stack>
          ))}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setSplitDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSplitSubmit} sx={{ bgcolor: '#0284c7' }}>
            Execute Split
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LotGenealogyDashboard;
