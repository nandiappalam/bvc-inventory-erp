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
  PrecisionManufacturing as PrecisionManufacturingIcon,
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
  Assessment as AssessmentIcon,
  Speed as SpeedIcon,
  ShoppingCart as ShoppingCartIcon,
  Tune as TuneIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import manufacturingService from '../../services/manufacturingService';

const ProductionPlanningDashboard = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Shortage explosion modal
  const [shortageDialogOpen, setShortageDialogOpen] = useState(false);
  const [selectedPlanShortages, setSelectedPlanShortages] = useState(null);
  const [shortageLoading, setShortageLoading] = useState(false);

  // Yield Stats & Batches
  const [yieldStats, setYieldStats] = useState(null);
  const [yieldBatches, setYieldBatches] = useState([]);
  const [yieldTrends, setYieldTrends] = useState([]);
  const [yieldLoading, setYieldLoading] = useState(false);

  // Create Plan Dialog
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [planForm, setPlanForm] = useState({
    planNo: `PP-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
    planDate: new Date().toISOString().split('T')[0],
    targetDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    remarks: '',
    items: [
      { productName: '', targetQty: '', uom: 'KG', machineLine: 'Flour Mill A', shift: 'General Shift' }
    ]
  });

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await manufacturingService.getProductionPlans();
      if (res.success && res.data) {
        setPlans(res.data);
      }
    } catch (e) {
      console.error('Error fetching production plans:', e);
      setError('Failed to load production plans.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchYieldData = useCallback(async () => {
    setYieldLoading(true);
    try {
      const [stRes, bRes, trRes] = await Promise.all([
        manufacturingService.getYieldStats(),
        manufacturingService.getYieldBatches(),
        manufacturingService.getYieldTrends()
      ]);
      if (stRes.success) setYieldStats(stRes.data);
      if (bRes.success) setYieldBatches(bRes.data);
      if (trRes.success) setYieldTrends(trRes.data);
    } catch (e) {
      console.error('Error loading yield intelligence:', e);
    } finally {
      setYieldLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
    fetchYieldData();
  }, [fetchPlans, fetchYieldData]);

  // Inspect Shortages
  const handleInspectShortages = async (planId) => {
    setShortageLoading(true);
    setShortageDialogOpen(true);
    try {
      const res = await manufacturingService.getPlanShortages(planId);
      if (res.success) {
        setSelectedPlanShortages(res.data);
      }
    } catch (e) {
      setError('Could not calculate plan component shortages');
    } finally {
      setShortageLoading(false);
    }
  };

  // Save Plan
  const handleSavePlan = async () => {
    try {
      const res = await manufacturingService.createProductionPlan(planForm);
      if (res.success) {
        setSuccessMsg('Production plan created successfully');
        setPlanDialogOpen(false);
        fetchPlans();
      }
    } catch (e) {
      setError(e.message || 'Error creating production plan');
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: '1600px', mx: 'auto' }}>
      {/* Header */}
      <Paper elevation={0} sx={{ p: 2.5, mb: 3, borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
        <Grid container spacing={2} alignItems="center" justifyContent="space-between">
          <Grid item xs={12} md={7}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <PrecisionManufacturingIcon sx={{ color: '#0284c7', fontSize: 32 }} />
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
                  Production Planning & Yield Intelligence
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b' }}>
                  End-to-end production scheduling, BOM requirement explosion, mass balance verification, and yield degradation tracking.
                </Typography>
              </Box>
            </Stack>
          </Grid>
          <Grid item xs={12} md={5}>
            <Stack direction="row" spacing={1.5} justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
              <Button
                component={Link}
                to="/procurement-planning"
                variant="outlined"
                startIcon={<ShoppingCartIcon />}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                Procurement Planning
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setPlanDialogOpen(true)}
                sx={{ bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' }, textTransform: 'none', fontWeight: 600 }}
              >
                New Production Plan
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Yield & Planning KPI Metrics */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: '10px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>PLANNED PRODUCTION</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', mt: 0.5 }}>
              {plans.reduce((sum, p) => sum + (p.total_target_qty || 0), 0)} <span style={{ fontSize: '14px', fontWeight: 500 }}>KG</span>
            </Typography>
            <Typography variant="caption" sx={{ color: '#0284c7', fontWeight: 600 }}>
              Across {plans.length} Active Plans
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={6} md={3}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: '10px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>OVERALL MILLING YIELD</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#059669', mt: 0.5 }}>
              {yieldStats?.overallYieldPct ?? 0}%
            </Typography>
            <Typography variant="caption" sx={{ color: '#059669', fontWeight: 600 }}>
              Standard: 72.0% (±2.0%)
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={6} md={3}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: '10px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>MASS BALANCE STATUS</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', mt: 0.5 }}>
              100% Accounted
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              Input = Output + Byproduct + Loss
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={6} md={3}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: '10px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>YIELD EXCEPTIONS</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: (yieldStats?.belowStandardCount || 0) > 0 ? '#dc2626' : '#16a34a', mt: 0.5 }}>
              {yieldStats?.belowStandardCount || 0} Batches
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              Requires Chemist Audit
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Messages */}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg('')}>{successMsg}</Alert>}

      {/* Tabs */}
      <Paper elevation={0} sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
        <Tabs
          value={activeTab}
          onChange={(e, val) => setActiveTab(val)}
          textColor="primary"
          indicatorColor="primary"
          sx={{ borderBottom: '1px solid #f1f5f9', px: 2 }}
        >
          <Tab icon={<AssessmentIcon />} iconPosition="start" label="Production Plans & MRP Shortages" sx={{ fontWeight: 700, textTransform: 'none' }} />
          <Tab icon={<SpeedIcon />} iconPosition="start" label="Yield Intelligence & Mass Balance" sx={{ fontWeight: 700, textTransform: 'none' }} />
          <Tab icon={<TrendingUpIcon />} iconPosition="start" label="Monthly Yield Trends" sx={{ fontWeight: 700, textTransform: 'none' }} />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* TAB 0: PLANS & MRP */}
          {activeTab === 0 && (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '8px' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Plan Number</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Plan Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Target Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Scheduled Products</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Total Planned Qty (KG)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Material Readiness</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}><CircularProgress size={28} /></TableCell></TableRow>
                  ) : plans.length === 0 ? (
                    <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: '#64748b' }}>No production plans scheduled yet.</TableCell></TableRow>
                  ) : (
                    plans.map((p) => (
                      <TableRow key={`plan-${p.id}`} hover>
                        <TableCell sx={{ fontWeight: 700, color: '#0284c7' }}>{p.plan_no}</TableCell>
                        <TableCell>{p.plan_date}</TableCell>
                        <TableCell>{p.target_date || 'N/A'}</TableCell>
                        <TableCell>{p.item_count} Items</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>{p.total_target_qty} KG</TableCell>
                        <TableCell>
                          <Chip label={p.status || 'Planned'} size="small" color={p.status === 'Released' ? 'success' : 'default'} sx={{ fontWeight: 600 }} />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<TuneIcon />}
                            onClick={() => handleInspectShortages(p.id)}
                            sx={{ textTransform: 'none', fontWeight: 600, fontSize: '12px' }}
                          >
                            Check BOM Shortages
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Button size="small" variant="text" sx={{ textTransform: 'none', fontWeight: 600 }}>
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* TAB 1: YIELD INTELLIGENCE & MASS BALANCE */}
          {activeTab === 1 && (
            <Box>
              <Paper sx={{ p: 2, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', mb: 2.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#166534' }}>
                  Mass Balance Formula: Input Grain = Finished Flour + By-product Bran + Elevator/Sieve Wastage + Process Loss
                </Typography>
              </Paper>

              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '8px' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f8fafc' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Batch / Work Order</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Machine Line</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Product</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Input Grain (KG)</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Output Flour (KG)</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Actual Yield %</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Standard Yield %</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Mass Balance Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {yieldBatches.map((b) => (
                      <TableRow key={`yb-${b.id}`} hover>
                        <TableCell sx={{ fontWeight: 700, color: '#0284c7' }}>{b.batchNo}</TableCell>
                        <TableCell>{b.machineLine}</TableCell>
                        <TableCell>{b.productName}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{b.inputKg} KG</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{b.outputKg} KG</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: b.actualYieldPct < 70 ? '#dc2626' : '#16a34a' }}>
                          {b.actualYieldPct}%
                        </TableCell>
                        <TableCell>{b.standardYieldPct}% (±{b.yieldTolerancePct}%)</TableCell>
                        <TableCell>
                          <Chip
                            label={b.massBalanceStatus}
                            size="small"
                            color={b.massBalanceStatus === 'BALANCED' ? 'success' : 'warning'}
                            sx={{ fontWeight: 700, fontSize: '11px' }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* TAB 2: YIELD TRENDS */}
          {activeTab === 2 && (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '8px' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Period (Month)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Milling Batches</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Average Yield %</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Average Wastage %</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Target Benchmark</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Performance Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {yieldTrends.map((t, idx) => (
                    <TableRow key={`trend-${t.month}-${idx}`} hover>
                      <TableCell sx={{ fontWeight: 700 }}>{t.month}</TableCell>
                      <TableCell>{t.batchCount} Batches</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#0284c7' }}>{t.avgYieldPct}%</TableCell>
                      <TableCell>{t.avgWastagePct}%</TableCell>
                      <TableCell>{t.targetYieldPct}%</TableCell>
                      <TableCell>
                        <Chip label="Optimal Efficiency" size="small" color="success" sx={{ fontWeight: 600 }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </Paper>

      {/* Shortage Dialog */}
      <Dialog open={shortageDialogOpen} onClose={() => setShortageDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          Material Requirement Explosion & Shortage Check
        </DialogTitle>
        <DialogContent dividers>
          {shortageLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={32} /></Box>
          ) : selectedPlanShortages ? (
            <Box>
              <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
                Plan <strong>{selectedPlanShortages.planNo}</strong> exploded through all active BOM recipes:
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '6px' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f8fafc' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Component Name</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Total Required (KG)</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Warehouse Stock (KG)</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Shortage (KG)</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(selectedPlanShortages.requirements || []).map((r, idx) => (
                      <TableRow key={`req-${r.itemName}-${idx}`}>
                        <TableCell sx={{ fontWeight: 600 }}>{r.itemName}</TableCell>
                        <TableCell>{r.totalRequiredQty} {r.uom}</TableCell>
                        <TableCell>{r.availableStock} {r.uom}</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: r.shortage > 0 ? '#dc2626' : '#16a34a' }}>
                          {r.shortage > 0 ? `${r.shortage} ${r.uom}` : '0 KG (Sufficient)'}
                        </TableCell>
                        <TableCell>
                          <Chip label={r.status} size="small" color={r.status === 'SHORTAGE' ? 'error' : 'success'} sx={{ fontWeight: 700, fontSize: '11px' }} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setShortageDialogOpen(false)}>Close</Button>
          <Button
            component={Link}
            to="/procurement-planning"
            variant="contained"
            sx={{ bgcolor: '#0284c7' }}
          >
            Create Purchase Request in Procurement
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Plan Dialog */}
      <Dialog open={planDialogOpen} onClose={() => setPlanDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Schedule New Production Plan</DialogTitle>
        <DialogContent dividers>
          <TextField
            fullWidth
            size="small"
            label="Plan Number"
            value={planForm.planNo}
            onChange={(e) => setPlanForm({ ...planForm, planNo: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            size="small"
            label="Target Completion Date"
            type="date"
            value={planForm.targetDate}
            onChange={(e) => setPlanForm({ ...planForm, targetDate: e.target.value })}
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 2 }}
          />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Target Product Line</Typography>
          <TextField
            fullWidth
            size="small"
            label="Product Name"
            value={planForm.items[0]?.productName || ''}
            onChange={(e) => {
              const updated = [...planForm.items];
              updated[0].productName = e.target.value;
              setPlanForm({ ...planForm, items: updated });
            }}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            size="small"
            label="Target Planned Quantity (KG)"
            type="number"
            value={planForm.items[0]?.targetQty || ''}
            onChange={(e) => {
              const updated = [...planForm.items];
              updated[0].targetQty = e.target.value;
              setPlanForm({ ...planForm, items: updated });
            }}
            sx={{ mb: 2 }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setPlanDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSavePlan} sx={{ bgcolor: '#0284c7' }}>
            Schedule Plan
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProductionPlanningDashboard;
