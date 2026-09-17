import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Tabs,
  Tab,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  Tooltip,
  Alert,
  Snackbar,
  CircularProgress,
  Divider,
  Stack,
  Badge
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import TimelineIcon from '@mui/icons-material/Timeline';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import InventoryIcon from '@mui/icons-material/Inventory';
import VerifiedIcon from '@mui/icons-material/Verified';
import ScheduleIcon from '@mui/icons-material/Schedule';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import SearchIcon from '@mui/icons-material/Search';

import { factoryProductionPlanningService } from '../../services/factoryProductionPlanningService';
import { useAuth } from '../../context/AuthContext';

// ERP Brand Colors
const brand = {
  primary: '#1f4fb2',
  secondary: '#2a5ea0',
  lightBg: '#f8fafc',
  border: '#e2e8f0',
  success: '#16a34a',
  warning: '#ea580c',
  danger: '#dc2626',
  purple: '#7c3aed',
  amber: '#d97706',
  slate: '#475569'
};

const FactoryProductionPlanningDashboard = () => {
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });

  // Data states
  const [dashboardData, setDashboardData] = useState(null);
  const [queueItems, setQueueItems] = useState([]);
  const [demandData, setDemandData] = useState(null);
  const [materialData, setMaterialData] = useState(null);
  const [cleaningOrders, setCleaningOrders] = useState([]);
  const [traceabilityData, setTraceabilityData] = useState(null);
  const [traceSearchKey, setTraceSearchKey] = useState('PO-2026-0045');

  // Filters
  const [queueFilterStatus, setQueueFilterStatus] = useState('ALL');
  const [queueFilterPriority, setQueueFilterPriority] = useState('ALL');
  const [queueSearch, setQueueSearch] = useState('');

  // Dialog States
  const [addJobOpen, setAddJobOpen] = useState(false);
  const [newJobForm, setNewJobForm] = useState({
    sourceRefNo: '',
    customerName: '',
    productName: 'Urad Flour',
    orderedQty: 1000,
    requiredQty: 700,
    dueDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    priority: 'HIGH',
    priorityScore: 85,
    assignedUnitCode: 'GRD-01',
    priorityReason: 'Confirmed Customer PO - Urgent Milling'
  });

  const [outputModalOpen, setOutputModalOpen] = useState(false);
  const [selectedJobForOutput, setSelectedJobForOutput] = useState(null);
  const [outputForm, setOutputForm] = useState({
    inputQty: 700,
    goodOutputQty: 665,
    processLossQty: 35,
    wasteFlourQty: 0,
    rejectionQty: 0,
    operatorName: 'Suresh Kumar',
    verifiedBy: 'QA Lead - Karthik Raja'
  });

  const [verifyCleanModalOpen, setVerifyCleanModalOpen] = useState(false);
  const [selectedCleaningOrder, setSelectedCleaningOrder] = useState(null);
  const [cleanForm, setCleanForm] = useState({
    verifiedBy: 'QA In-charge',
    qcNotes: 'Swab residue inspection passed. 100% clean and sanitized.'
  });

  const showToast = (message, severity = 'success') => {
    setNotification({ open: true, message, severity });
  };

  // Load all dashboard components
  const loadDashboard = useCallback(async () => {
    try {
      setRefreshing(true);
      const [dash, qRes, dem, mat, cln] = await Promise.all([
        factoryProductionPlanningService.getDashboardSummary(),
        factoryProductionPlanningService.getQueue({ status: queueFilterStatus, priority: queueFilterPriority, search: queueSearch }),
        factoryProductionPlanningService.getCustomerDemand(),
        factoryProductionPlanningService.getMaterialAvailability(),
        factoryProductionPlanningService.getCleaningOrders()
      ]);

      setDashboardData(dash);
      setQueueItems(qRes.data || []);
      setDemandData(dem);
      setMaterialData(mat);
      setCleaningOrders(cln.data || []);
    } catch (err) {
      console.error('Failed to load production planning data:', err);
      showToast('Error loading production planning data: ' + err.message, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [queueFilterStatus, queueFilterPriority, queueSearch]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Handle Starting a Job
  const handleStartJob = async (job) => {
    try {
      const res = await factoryProductionPlanningService.advanceJob(job.id, 'START_PRODUCTION', {
        unitCode: job.assigned_unit_code || 'GRD-01',
        operator: user?.username || 'Suresh Kumar'
      });
      showToast(res.message, 'success');
      loadDashboard();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Open Record Output Modal
  const openOutputModal = (job) => {
    setSelectedJobForOutput(job);
    const inQty = job.required_qty || job.ordered_qty || 700;
    const estGood = Math.round(inQty * 0.95);
    const estLoss = inQty - estGood;
    setOutputForm({
      inputQty: inQty,
      goodOutputQty: estGood,
      processLossQty: estLoss,
      wasteFlourQty: 0,
      rejectionQty: 0,
      operatorName: user?.username || 'Suresh Kumar',
      verifiedBy: 'QA Lead - Karthik Raja'
    });
    setOutputModalOpen(true);
  };

  // Submit Output & Switch Unit to Cleaning
  const handleRecordOutput = async () => {
    if (!selectedJobForOutput) return;
    try {
      const res = await factoryProductionPlanningService.advanceJob(selectedJobForOutput.id, 'RECORD_OUTPUT_AND_CLEAN', {
        ...outputForm,
        unitCode: selectedJobForOutput.assigned_unit_code || 'GRD-01'
      });
      showToast(res.message, 'success');
      setOutputModalOpen(false);
      loadDashboard();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Open Verify Cleaning Modal
  const openVerifyCleanModal = (order) => {
    setSelectedCleaningOrder(order);
    setCleanForm({
      verifiedBy: user?.username || 'QA In-charge',
      qcNotes: 'Allergen check passed; visual swab clean.'
    });
    setVerifyCleanModalOpen(true);
  };

  // Submit Cleaning Verification and Auto-Start next Job
  const handleVerifyCleaning = async () => {
    if (!selectedCleaningOrder) return;
    try {
      const res = await factoryProductionPlanningService.advanceJob(1, 'VERIFY_CLEANING_AND_AUTO_START_NEXT', {
        cleaningCode: selectedCleaningOrder.cleaning_code,
        unitCode: selectedCleaningOrder.unit_code,
        verifiedBy: cleanForm.verifiedBy,
        qcNotes: cleanForm.qcNotes
      });
      showToast(res.message, 'success');
      setVerifyCleanModalOpen(false);
      loadDashboard();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Handle MTS Approval
  const handleApproveMTS = async (forecastId) => {
    try {
      const res = await factoryProductionPlanningService.approveMTS(forecastId, user?.username || 'Plant Manager');
      showToast(res.message, 'success');
      loadDashboard();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Handle Add to Queue submit
  const handleCreateJob = async () => {
    try {
      await factoryProductionPlanningService.addToQueue(newJobForm);
      showToast('Production Job queued successfully!', 'success');
      setAddJobOpen(false);
      loadDashboard();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Handle Traceability Search
  const handleTraceSearch = async () => {
    try {
      const res = await factoryProductionPlanningService.getTraceability(traceSearchKey);
      setTraceabilityData(res);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Priority Badge Renderer
  const renderPriorityBadge = (priority, score) => {
    switch (priority) {
      case 'URGENT':
        return <Chip label={`URGENT (${score})`} size="small" sx={{ bgcolor: '#fee2e2', color: '#991b1b', fontWeight: 'bold' }} />;
      case 'HIGH':
        return <Chip label={`HIGH (${score})`} size="small" sx={{ bgcolor: '#ffedd5', color: '#9a3412', fontWeight: 'bold' }} />;
      case 'NORMAL':
        return <Chip label={`NORMAL (${score})`} size="small" sx={{ bgcolor: '#fef9c3', color: '#854d0e' }} />;
      case 'WAITING_MATERIAL':
        return <Chip label={`WAITING MAT (${score})`} size="small" sx={{ bgcolor: '#f1f5f9', color: '#475569' }} />;
      default:
        return <Chip label={`${priority} (${score})`} size="small" sx={{ bgcolor: '#e0e7ff', color: '#3730a3' }} />;
    }
  };

  // Status Badge Renderer
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'RUNNING':
        return <Chip label="⚡ RUNNING" size="small" sx={{ bgcolor: '#dcfce7', color: '#166534', fontWeight: 'bold' }} />;
      case 'QUEUED':
        return <Chip label="QUEUED" size="small" sx={{ bgcolor: '#f1f5f9', color: '#334155' }} />;
      case 'CLEANING':
        return <Chip label="🧹 CLEANING" size="small" sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 'bold' }} />;
      case 'COMPLETED':
        return <Chip label="✓ COMPLETED" size="small" sx={{ bgcolor: '#e0f2fe', color: '#0369a1' }} />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  if (loading && !dashboardData) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <CircularProgress sx={{ color: brand.primary, mb: 2 }} />
        <Typography variant="body1" sx={{ color: brand.slate }}>
          Initializing Factory Production Planning Engine & Queue...
        </Typography>
      </Box>
    );
  }

  const spotlight = dashboardData?.spotlight;
  const units = dashboardData?.units || [];
  const matSummary = dashboardData?.materialSummary || {};

  return (
    <Box sx={{ p: 3, bgcolor: '#f8fafc', minHeight: '100vh' }}>
      {/* Header Bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <PrecisionManufacturingIcon sx={{ color: brand.primary, fontSize: 32 }} />
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
              Factory Production Planning & Control
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
            Deterministic queue scheduling, material availability (ATP), unit capacity & predictive customer demand
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadDashboard}
            disabled={refreshing}
            sx={{ borderColor: brand.border, color: '#334155', textTransform: 'none', fontWeight: 600 }}
          >
            {refreshing ? 'Syncing...' : 'Refresh Status'}
          </Button>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddJobOpen(true)}
            sx={{ bgcolor: brand.primary, textTransform: 'none', fontWeight: 600, '&:hover': { bgcolor: brand.secondary } }}
          >
            Queue Production Job
          </Button>
        </Stack>
      </Box>

      {/* Top 4 KPI Metrics */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Active Factory Queue
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: brand.primary, my: 0.5 }}>
                {dashboardData?.totalQueueCount || 0} Jobs
              </Typography>
              <Typography variant="caption" sx={{ color: '#dc2626', fontWeight: 600 }}>
                {dashboardData?.urgentCount || 0} Urgent • {dashboardData?.highCount || 0} High Priority
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Raw Material ATP (Net Available)
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: brand.success, my: 0.5 }}>
                {(matSummary.netAvailableRawATP || 24250).toLocaleString()} <span style={{ fontSize: '16px' }}>KG</span>
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                {(matSummary.reservedRawStock || 4200).toLocaleString()} KG reserved for active jobs
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Work Center Utilization
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#0284c7', my: 0.5 }}>
                {units.filter(u => u.status === 'RUNNING').length} / {units.length} <span style={{ fontSize: '16px' }}>Active</span>
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                {units.filter(u => u.status === 'CLEANING').length} in cleaning / changeover
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Advance MTS Recommendations
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: brand.purple, my: 0.5 }}>
                {dashboardData?.pendingRecommendations?.length || 0} <span style={{ fontSize: '16px' }}>Signals</span>
              </Typography>
              <Typography variant="caption" sx={{ color: brand.purple, fontWeight: 600 }}>
                Demand forecast buffer approvals
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs Navigation */}
      <Paper sx={{ mb: 3, borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
        <Tabs
          value={currentTab}
          onChange={(e, v) => setCurrentTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 2,
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, fontSize: '14px', minHeight: '52px' },
            '& .Mui-selected': { color: `${brand.primary} !important` },
            '& .MuiTabs-indicator': { bgcolor: brand.primary, height: 3 }
          }}
        >
          <Tab icon={<PrecisionManufacturingIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Plant Floor & Spotlight" />
          <Tab icon={<ScheduleIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={`Production Queue (${queueItems.length})`} />
          <Tab icon={<TrendingUpIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Customer Demand & Advance Forecast" />
          <Tab icon={<InventoryIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Material ATP & Shortage Check" />
          <Tab icon={<CleaningServicesIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={`Cleaning & Changeovers (${cleaningOrders.length})`} />
          <Tab icon={<TimelineIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="End-to-End Traceability" />
        </Tabs>
      </Paper>

      {/* TAB 0: PLANT FLOOR & SPOTLIGHT CONTROL */}
      {currentTab === 0 && (
        <Box>
          {/* Spotlight Priority Card */}
          {spotlight && (
            <Card sx={{ mb: 3, border: '1.5px solid #2563eb', borderRadius: 2.5, bgcolor: '#ffffff', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.08)' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip label="SPOTLIGHT: WHAT TO PRODUCE NOW" size="small" sx={{ bgcolor: '#dbeafe', color: '#1d4ed8', fontWeight: 800, fontSize: '11px' }} />
                      {renderPriorityBadge(spotlight.priority, spotlight.priority_score)}
                      {renderStatusBadge(spotlight.status)}
                    </Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', mt: 1 }}>
                      {spotlight.product_name} • {spotlight.customer_name} ({spotlight.source_ref_no})
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#475569', mt: 0.5 }}>
                      <strong>Priority Reasoning:</strong> {spotlight.priority_reason || 'Highest score based on due date & material ATP'}
                    </Typography>
                  </Box>

                  <Stack direction="row" spacing={1.5}>
                    {spotlight.status === 'QUEUED' && (
                      <Button
                        variant="contained"
                        startIcon={<PlayArrowIcon />}
                        onClick={() => handleStartJob(spotlight)}
                        sx={{ bgcolor: brand.success, '&:hover': { bgcolor: '#15803d' }, textTransform: 'none', fontWeight: 700 }}
                      >
                        Start Production Now
                      </Button>
                    )}
                    {spotlight.status === 'RUNNING' && (
                      <Button
                        variant="contained"
                        startIcon={<CheckCircleIcon />}
                        onClick={() => openOutputModal(spotlight)}
                        sx={{ bgcolor: brand.primary, '&:hover': { bgcolor: brand.secondary }, textTransform: 'none', fontWeight: 700 }}
                      >
                        Record Output & Clean
                      </Button>
                    )}
                  </Stack>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Spotlight metrics */}
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={4} md={2}>
                    <Typography variant="caption" sx={{ color: '#64748b' }}>Ordered Qty</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>{spotlight.ordered_qty} KG</Typography>
                  </Grid>
                  <Grid item xs={6} sm={4} md={2}>
                    <Typography variant="caption" sx={{ color: '#64748b' }}>Stock Available (ATP)</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: brand.success }}>{spotlight.availableStock || 300} KG</Typography>
                  </Grid>
                  <Grid item xs={6} sm={4} md={2}>
                    <Typography variant="caption" sx={{ color: '#64748b' }}>Required to Produce</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#ea580c' }}>{spotlight.required_qty || 700} KG</Typography>
                  </Grid>
                  <Grid item xs={6} sm={4} md={2}>
                    <Typography variant="caption" sx={{ color: '#64748b' }}>Assigned Unit</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: brand.primary }}>{spotlight.assigned_unit_code || 'GRD-01'}</Typography>
                  </Grid>
                  <Grid item xs={6} sm={4} md={2}>
                    <Typography variant="caption" sx={{ color: '#64748b' }}>Due Date</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>{spotlight.due_date}</Typography>
                  </Grid>
                  <Grid item xs={6} sm={4} md={2}>
                    <Typography variant="caption" sx={{ color: '#64748b' }}>Lead Time Est.</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#7c3aed' }}>{spotlight.leadTimeEstimate || '3h 33m'}</Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}

          {/* Plant Floor Units / Work Centers Grid */}
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1e293b', mb: 2 }}>
            🏭 Factory Work Centers & Live Machine Status
          </Typography>

          <Grid container spacing={2.5}>
            {units.map((unit) => (
              <Grid item xs={12} md={6} lg={4} key={unit.id}>
                <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ p: 2.5, flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800 }}>
                          {unit.unit_code} • {unit.process_stage}
                        </Typography>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a' }}>
                          {unit.unit_name}
                        </Typography>
                      </Box>
                      {renderStatusBadge(unit.status)}
                    </Box>

                    <Box sx={{ my: 1.5, p: 1.5, bgcolor: '#f1f5f9', borderRadius: 1.5 }}>
                      <Typography variant="caption" sx={{ color: '#475569', display: 'block' }}>
                        Current Task: <strong>{unit.current_product || 'Idle / Ready for Next Job'}</strong>
                      </Typography>
                      {unit.current_job_code && (
                        <Typography variant="caption" sx={{ color: brand.primary, fontWeight: 700, display: 'block' }}>
                          Job Ref: {unit.current_job_code} ({unit.current_input_qty} KG)
                        </Typography>
                      )}
                      <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5 }}>
                        Operator: {unit.operator || 'Unassigned'} • Efficiency: {unit.efficiency_pct}%
                      </Typography>
                    </Box>

                    {unit.status === 'RUNNING' && (
                      <Box sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: '#334155' }}>Processing Progress</Typography>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: brand.primary }}>{unit.progressPct}%</Typography>
                        </Box>
                        <LinearProgress variant="determinate" value={unit.progressPct} sx={{ height: 8, borderRadius: 4, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: brand.primary } }} />
                        <Typography variant="caption" sx={{ color: '#64748b', mt: 0.5, display: 'block' }}>
                          ⏳ {unit.remainingFormatted}
                        </Typography>
                      </Box>
                    )}

                    {unit.status === 'CLEANING' && (
                      <Box sx={{ mb: 2, p: 1, bgcolor: '#fef3c7', borderRadius: 1 }}>
                        <Typography variant="caption" sx={{ color: '#92400e', fontWeight: 700 }}>
                          🧹 Food Safety Changeover Clean in Progress
                        </Typography>
                      </Box>
                    )}

                    <Divider sx={{ my: 1.5 }} />

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        Capacity: <strong>{unit.capacity_kg_per_hr} kg/hr</strong>
                      </Typography>

                      {unit.status === 'RUNNING' && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            const job = queueItems.find(q => q.source_ref_no === unit.current_job_code) || {
                              id: unit.current_job_id || 1,
                              source_ref_no: unit.current_job_code,
                              product_name: unit.current_product,
                              required_qty: unit.current_input_qty,
                              assigned_unit_code: unit.unit_code
                            };
                            openOutputModal(job);
                          }}
                          sx={{ textTransform: 'none', fontSize: '12px' }}
                        >
                          Record Output
                        </Button>
                      )}

                      {unit.status === 'CLEANING' && (
                        <Button
                          size="small"
                          variant="contained"
                          color="warning"
                          onClick={() => {
                            const cln = cleaningOrders.find(c => c.unit_code === unit.unit_code && c.status === 'IN_PROGRESS') || {
                              cleaning_code: 'CLN-CURRENT',
                              unit_code: unit.unit_code
                            };
                            openVerifyCleanModal(cln);
                          }}
                          sx={{ textTransform: 'none', fontSize: '12px' }}
                        >
                          Verify Clean & Ready
                        </Button>
                      )}

                      {unit.status === 'READY' && (
                        <Chip label="Ready for Queue" size="small" sx={{ bgcolor: '#dcfce7', color: '#15803d', fontWeight: 600 }} />
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* TAB 1: PRODUCTION QUEUE & DYNAMIC PRIORITY */}
      {currentTab === 1 && (
        <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, flexWrap: 'wrap', gap: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                  Factory Production Queue & Deterministic Priority Engine
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  Orders auto-ranked by Due Date Proximity (40 pts) + Material ATP (30 pts) + Capacity/Unit Readiness (30 pts)
                </Typography>
              </Box>

              <Stack direction="row" spacing={1.5} alignItems="center">
                <TextField
                  size="small"
                  placeholder="Search product / PO..."
                  value={queueSearch}
                  onChange={(e) => setQueueSearch(e.target.value)}
                  sx={{ width: 220 }}
                />

                <TextField
                  size="small"
                  select
                  value={queueFilterPriority}
                  onChange={(e) => setQueueFilterPriority(e.target.value)}
                  sx={{ width: 150 }}
                >
                  <MenuItem value="ALL">All Priorities</MenuItem>
                  <MenuItem value="URGENT">Urgent (≥90)</MenuItem>
                  <MenuItem value="HIGH">High (75-89)</MenuItem>
                  <MenuItem value="NORMAL">Normal</MenuItem>
                  <MenuItem value="WAITING_MATERIAL">Waiting Material</MenuItem>
                </TextField>

                <TextField
                  size="small"
                  select
                  value={queueFilterStatus}
                  onChange={(e) => setQueueFilterStatus(e.target.value)}
                  sx={{ width: 140 }}
                >
                  <MenuItem value="ALL">All Status</MenuItem>
                  <MenuItem value="QUEUED">Queued</MenuItem>
                  <MenuItem value="RUNNING">Running</MenuItem>
                  <MenuItem value="COMPLETED">Completed</MenuItem>
                </TextField>
              </Stack>
            </Box>

            <TableContainer component={Paper} sx={{ boxShadow: 'none', border: '1px solid #e2e8f0' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Order / Source Ref</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Customer</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Product Name</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Ordered / Required Qty</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Due Date</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Priority Score</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Material ATP</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Unit</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569', textAlign: 'right' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {queueItems.map((item, idx) => (
                    <TableRow key={item.id} sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                      <TableCell sx={{ fontWeight: 700 }}>{idx + 1}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: brand.primary }}>
                          {item.source_ref_no}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>{item.order_type}</Typography>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{item.customer_name}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{item.product_name}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {item.required_qty} KG
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                          (Ordered: {item.ordered_qty} KG)
                        </Typography>
                      </TableCell>
                      <TableCell>{item.due_date}</TableCell>
                      <TableCell>
                        {renderPriorityBadge(item.priority, item.priority_score)}
                      </TableCell>
                      <TableCell>
                        {item.material_status === 'AVAILABLE' ? (
                          <Chip label="✓ 100% In Stock" size="small" sx={{ bgcolor: '#dcfce7', color: '#166534', fontSize: '11px' }} />
                        ) : (
                          <Chip label="⚠️ Shortage / QC Hold" size="small" sx={{ bgcolor: '#fee2e2', color: '#991b1b', fontSize: '11px' }} />
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip label={item.assigned_unit_code || 'GRD-01'} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>{renderStatusBadge(item.status)}</TableCell>
                      <TableCell sx={{ textAlign: 'right' }}>
                        {item.status === 'QUEUED' && (
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<PlayArrowIcon />}
                            onClick={() => handleStartJob(item)}
                            sx={{ bgcolor: brand.success, textTransform: 'none', fontSize: '12px' }}
                          >
                            Start
                          </Button>
                        )}
                        {item.status === 'RUNNING' && (
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => openOutputModal(item)}
                            sx={{ bgcolor: brand.primary, textTransform: 'none', fontSize: '12px' }}
                          >
                            Record Output
                          </Button>
                        )}
                        {item.status === 'COMPLETED' && (
                          <Chip label="Done" size="small" color="success" variant="outlined" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {queueItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} sx={{ textAlign: 'center', py: 4, color: '#64748b' }}>
                        No production orders found matching the filter criteria.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* TAB 2: CUSTOMER DEMAND & PREDICTIVE FORECASTING */}
      {currentTab === 2 && (
        <Box>
          <Grid container spacing={3}>
            {/* Forecast Summary Cards */}
            <Grid item xs={12} md={4}>
              <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 2, height: '100%' }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 2 }}>
                    📈 Customer Demand Summary
                  </Typography>
                  <Stack spacing={2}>
                    <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 1.5 }}>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>Confirmed Customer POs</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: brand.primary }}>
                        {(demandData?.summary?.totalConfirmedDemandKg || 3300).toLocaleString()} KG
                      </Typography>
                    </Box>
                    <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 1.5 }}>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>Quotation Pipeline Demand</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: brand.purple }}>
                        {(demandData?.summary?.totalQuotationPipelineKg || 1800).toLocaleString()} KG
                      </Typography>
                    </Box>
                    <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 1.5 }}>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>Recommended Make-to-Stock (MTS)</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: brand.warning }}>
                        {(demandData?.summary?.totalRecommendedMtsKg || 1500).toLocaleString()} KG
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            {/* Advance Make-to-Stock Recommendations */}
            <Grid item xs={12} md={8}>
              <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 1 }}>
                    🎯 Advance Make-to-Stock (MTS) Forecast Engine
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 2 }}>
                    Predicts reorder cycles based on customer historical run-rate vs available stock. Planners can approve advance production directly into the queue.
                  </Typography>

                  <TableContainer component={Paper} sx={{ boxShadow: 'none', border: '1px solid #e2e8f0' }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: '#f8fafc' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Customer & Product</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Historical Monthly Avg</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Current Stock (ATP)</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Recommended MTS</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Confidence</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Status / Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(demandData?.forecasts || []).map((f) => (
                          <TableRow key={f.id}>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>{f.product_name}</Typography>
                              <Typography variant="caption" sx={{ color: '#64748b' }}>{f.customer_name}</Typography>
                            </TableCell>
                            <TableCell>{f.historical_avg_qty} KG</TableCell>
                            <TableCell sx={{ color: brand.success, fontWeight: 700 }}>{f.current_stock_atp} KG</TableCell>
                            <TableCell sx={{ color: brand.warning, fontWeight: 800 }}>+{f.recommended_production_qty} KG</TableCell>
                            <TableCell>
                              <Chip label={`${f.confidence_score}%`} size="small" sx={{ bgcolor: '#e0e7ff', color: '#3730a3', fontWeight: 700 }} />
                            </TableCell>
                            <TableCell>
                              {f.recommendation_status === 'RECOMMENDED' ? (
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => handleApproveMTS(f.id)}
                                  sx={{ bgcolor: brand.primary, textTransform: 'none', fontSize: '11px', py: 0.5 }}
                                >
                                  Approve & Queue
                                </Button>
                              ) : (
                                <Chip label="Approved ✓" size="small" color="success" />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* TAB 3: MATERIAL AVAILABILITY & ATP */}
      {currentTab === 3 && (
        <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
          <CardContent sx={{ p: 2.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 1 }}>
              📦 Multi-Tier Material Availability & Available-to-Promise (ATP)
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 3 }}>
              Calculates Net ATP = (Total Physical Stock) - (Allocated to Active Queue) - (QC Hold / Quarantine)
            </Typography>

            <TableContainer component={Paper} sx={{ boxShadow: 'none', border: '1px solid #e2e8f0' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Item Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Total On Hand</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Allocated / Reserved</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>QC Hold / Quarantine</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Net Available (ATP)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Replenishment Lead Time</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(materialData?.items || []).map((m, idx) => (
                    <TableRow key={idx}>
                      <TableCell sx={{ fontWeight: 700 }}>{m.item_name}</TableCell>
                      <TableCell>
                        <Chip label={m.category} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{m.total_on_hand.toLocaleString()} {m.uom}</TableCell>
                      <TableCell sx={{ color: '#ea580c', fontWeight: 600 }}>{m.allocated_reserved.toLocaleString()} {m.uom}</TableCell>
                      <TableCell sx={{ color: '#dc2626' }}>{m.quality_hold} {m.uom}</TableCell>
                      <TableCell sx={{ color: brand.success, fontWeight: 800, fontSize: '15px' }}>
                        {m.net_available_atp.toLocaleString()} {m.uom}
                      </TableCell>
                      <TableCell>{m.lead_time_days > 0 ? `${m.lead_time_days} days` : 'Immediate'}</TableCell>
                      <TableCell>
                        {m.status === 'AVAILABLE' ? (
                          <Chip label="Ready ✓" size="small" color="success" />
                        ) : (
                          <Chip label="⚠️ Shortage" size="small" color="error" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* TAB 4: CLEANING & FOOD SAFETY CHANGEOVERS */}
      {currentTab === 4 && (
        <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                  🧹 Food Safety Cleaning & Unit Changeover Verifications
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  Mandatory allergen separation and sanitation checks. Verification automatically triggers the next queued batch.
                </Typography>
              </Box>
            </Box>

            <TableContainer component={Paper} sx={{ boxShadow: 'none', border: '1px solid #e2e8f0' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Cleaning Code</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Unit / Work Center</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Previous Product</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Next Scheduled Product</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Allergen Risk</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Standard Duration</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>QC Verification</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cleaningOrders.map((cln) => (
                    <TableRow key={cln.id}>
                      <TableCell sx={{ fontWeight: 700, color: brand.primary }}>{cln.cleaning_code}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{cln.unit_code}</TableCell>
                      <TableCell>{cln.previous_product}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{cln.next_product}</TableCell>
                      <TableCell>
                        <Chip label={cln.allergen_risk || 'Low'} size="small" sx={{ bgcolor: cln.allergen_risk === 'High' ? '#fee2e2' : '#f1f5f9' }} />
                      </TableCell>
                      <TableCell>{cln.duration_mins} mins</TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, color: cln.qc_status === 'PASSED' ? brand.success : '#ea580c' }}>
                          {cln.qc_status}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>{cln.verified_by || 'Pending QA'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={cln.status} size="small" color={cln.status === 'VERIFIED' ? 'success' : 'warning'} />
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right' }}>
                        {cln.status !== 'VERIFIED' && (
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => openVerifyCleanModal(cln)}
                            sx={{ bgcolor: brand.primary, textTransform: 'none', fontSize: '11px' }}
                          >
                            Verify Clean
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
      )}

      {/* TAB 5: END-TO-END TRACEABILITY */}
      {currentTab === 5 && (
        <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <TextField
                size="small"
                label="Enter PO / Order / Lot Number"
                value={traceSearchKey}
                onChange={(e) => setTraceSearchKey(e.target.value)}
                sx={{ width: 300 }}
              />
              <Button
                variant="contained"
                startIcon={<SearchIcon />}
                onClick={handleTraceSearch}
                sx={{ bgcolor: brand.primary, textTransform: 'none', fontWeight: 600 }}
              >
                Trace Flow
              </Button>
            </Box>

            {traceabilityData?.chain && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', mb: 2 }}>
                  Traceability Flow for: <span style={{ color: brand.primary }}>{traceabilityData.traceKey}</span>
                </Typography>

                <Stack spacing={2}>
                  {traceabilityData.chain.map((step, idx) => (
                    <Box
                      key={idx}
                      sx={{
                        p: 2,
                        border: '1px solid #e2e8f0',
                        borderRadius: 2,
                        bgcolor: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 2
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            bgcolor: '#dbeafe',
                            color: brand.primary,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800
                          }}
                        >
                          {idx + 1}
                        </Box>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                            {step.stage} • <span style={{ color: brand.primary }}>{step.code}</span>
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#64748b' }}>
                            Party/Dept: {step.party} • Date: {step.date}
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#334155', mt: 0.5 }}>
                            {step.details}
                          </Typography>
                        </Box>
                      </Box>

                      <Chip label={step.status} size="small" color="primary" variant="outlined" sx={{ fontWeight: 700 }} />
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* DIALOG: ADD NEW JOB TO QUEUE */}
      <Dialog open={addJobOpen} onClose={() => setAddJobOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Queue New Production Job</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Source Ref / PO No"
              fullWidth
              size="small"
              value={newJobForm.sourceRefNo}
              onChange={(e) => setNewJobForm({ ...newJobForm, sourceRefNo: e.target.value })}
              placeholder="e.g. PO-2026-0099"
            />
            <TextField
              label="Customer Name"
              fullWidth
              size="small"
              value={newJobForm.customerName}
              onChange={(e) => setNewJobForm({ ...newJobForm, customerName: e.target.value })}
              placeholder="e.g. ABC Foods"
            />
            <TextField
              label="Product Name"
              fullWidth
              size="small"
              value={newJobForm.productName}
              onChange={(e) => setNewJobForm({ ...newJobForm, productName: e.target.value })}
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Ordered Qty (KG)"
                  type="number"
                  fullWidth
                  size="small"
                  value={newJobForm.orderedQty}
                  onChange={(e) => setNewJobForm({ ...newJobForm, orderedQty: e.target.value, requiredQty: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Required to Produce (KG)"
                  type="number"
                  fullWidth
                  size="small"
                  value={newJobForm.requiredQty}
                  onChange={(e) => setNewJobForm({ ...newJobForm, requiredQty: e.target.value })}
                />
              </Grid>
            </Grid>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Due Date"
                  type="date"
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={newJobForm.dueDate}
                  onChange={(e) => setNewJobForm({ ...newJobForm, dueDate: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Assigned Unit"
                  select
                  fullWidth
                  size="small"
                  value={newJobForm.assignedUnitCode}
                  onChange={(e) => setNewJobForm({ ...newJobForm, assignedUnitCode: e.target.value })}
                >
                  <MenuItem value="CLN-01">CLN-01 (Cleaning)</MenuItem>
                  <MenuItem value="GRD-01">GRD-01 (Grinding Mill)</MenuItem>
                  <MenuItem value="SIV-01">SIV-01 (Sieving)</MenuItem>
                  <MenuItem value="MIX-01">MIX-01 (Blender)</MenuItem>
                  <MenuItem value="PCK-01">PCK-01 (Packaging)</MenuItem>
                </TextField>
              </Grid>
            </Grid>
            <TextField
              label="Priority Level"
              select
              fullWidth
              size="small"
              value={newJobForm.priority}
              onChange={(e) => setNewJobForm({ ...newJobForm, priority: e.target.value })}
            >
              <MenuItem value="URGENT">URGENT (Score: 95)</MenuItem>
              <MenuItem value="HIGH">HIGH (Score: 85)</MenuItem>
              <MenuItem value="NORMAL">NORMAL (Score: 65)</MenuItem>
              <MenuItem value="PLANNED">PLANNED (Score: 50)</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAddJobOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateJob} sx={{ bgcolor: brand.primary }}>
            Add to Queue
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG: RECORD OUTPUT & SWITCH TO CLEANING */}
      <Dialog open={outputModalOpen} onClose={() => setOutputModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Record Production Output & Yield</DialogTitle>
        <DialogContent dividers>
          {selectedJobForOutput && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Alert severity="info" sx={{ py: 0.5 }}>
                Recording output for <strong>{selectedJobForOutput.product_name}</strong> ({selectedJobForOutput.source_ref_no}). Completing this will automatically put the unit in <strong>CLEANING mode</strong>.
              </Alert>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    label="Input Material (KG)"
                    type="number"
                    fullWidth
                    size="small"
                    value={outputForm.inputQty}
                    onChange={(e) => setOutputForm({ ...outputForm, inputQty: e.target.value })}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Good Output (KG)"
                    type="number"
                    fullWidth
                    size="small"
                    value={outputForm.goodOutputQty}
                    onChange={(e) => setOutputForm({ ...outputForm, goodOutputQty: e.target.value })}
                  />
                </Grid>
              </Grid>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    label="Process Loss (KG)"
                    type="number"
                    fullWidth
                    size="small"
                    value={outputForm.processLossQty}
                    onChange={(e) => setOutputForm({ ...outputForm, processLossQty: e.target.value })}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Calculated Yield %"
                    fullWidth
                    size="small"
                    disabled
                    value={`${((outputForm.goodOutputQty / (outputForm.inputQty || 1)) * 100).toFixed(2)}%`}
                  />
                </Grid>
              </Grid>
              <TextField
                label="QA Inspector / Verified By"
                fullWidth
                size="small"
                value={outputForm.verifiedBy}
                onChange={(e) => setOutputForm({ ...outputForm, verifiedBy: e.target.value })}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOutputModalOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleRecordOutput} sx={{ bgcolor: brand.primary }}>
            Submit Output & Trigger Cleaning
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG: VERIFY CLEANING & AUTO-START NEXT */}
      <Dialog open={verifyCleanModalOpen} onClose={() => setVerifyCleanModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Food Safety Cleaning Verification</DialogTitle>
        <DialogContent dividers>
          {selectedCleaningOrder && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Alert severity="warning" sx={{ py: 0.5 }}>
                Verifying clean for unit <strong>{selectedCleaningOrder.unit_code}</strong>. Approving will mark machine READY and automatically initiate the next priority job!
              </Alert>
              <TextField
                label="QA Inspector Name"
                fullWidth
                size="small"
                value={cleanForm.verifiedBy}
                onChange={(e) => setCleanForm({ ...cleanForm, verifiedBy: e.target.value })}
              />
              <TextField
                label="QC Notes / Swab Test Clearance"
                multiline
                rows={2}
                fullWidth
                size="small"
                value={cleanForm.qcNotes}
                onChange={(e) => setCleanForm({ ...cleanForm, qcNotes: e.target.value })}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setVerifyCleanModalOpen(false)}>Cancel</Button>
          <Button variant="contained" color="success" onClick={handleVerifyCleaning}>
            Verify Clean & Auto-Start Next Job
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar Notifications */}
      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={() => setNotification({ ...notification, open: false })}
      >
        <Alert severity={notification.severity} onClose={() => setNotification({ ...notification, open: false })}>
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default FactoryProductionPlanningDashboard;
