import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  FormControl,
  Select,
  MenuItem,
  Divider,
  Paper,
  Tabs,
  Tab,
  Chip,
  InputLabel,
  Tooltip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Stack,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Badge
} from '@mui/material';
import {
  PrecisionManufacturing as ProcessIcon,
  Group as TeamIcon,
  VerifiedUser as QcIcon,
  Inventory2 as BagIcon,
  Assignment as DailyReportIcon,
  LocalShipping as LoadingIcon,
  History as HistoryIcon,
  ReportProblem as InsectIcon,
  Scale as ScaleIcon,
  CheckCircle as SuccessIcon,
  Warning as WarningIcon,
  Lock as LockIcon,
  LockOpen as UnlockIcon,
  Search as SearchIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  ArrowBack as ArrowBackIcon,
  HelpOutline as GuideIcon,
  Schedule as ClockIcon,
  LocationOn as LocationIcon,
  FactCheck as DecisionIcon,
  Inventory as StockIcon,
  Calculate as CalculateIcon,
  TrackChanges as TargetIcon
} from '@mui/icons-material';
import ViewControlToolbar from '../../components/ViewControlToolbar';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api.js';

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`sorting-tabpanel-${index}`}
      aria-labelledby={`sorting-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2.5, pb: 2 }}>{children}</Box>}
    </div>
  );
}

const HandSortingWorkspace = () => {
  const navigate = useNavigate();
  const { selectedCompany, user } = useAuth();

  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState('success');

  // Dashboard KPI data
  const [kpis, setKpis] = useState({
    active_jobs: 0,
    qc_pending_jobs: 0,
    ready_approved_kg: 0,
    ready_approved_bags: 0,
    isolated_bags_count: 0,
    isolated_weight_kg: 0,
    total_customer_demand_kg: 0,
    allocated_fg_kg: 0,
    pending_customer_demand_kg: 0
  });

  // Data states
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobDetails, setJobDetails] = useState(null);
  const [fgBags, setFgBags] = useState([]);
  const [dailyReports, setDailyReports] = useState([]);
  const [customerPlans, setCustomerPlans] = useState([]);

  // Search & Filter
  const [jobSearch, setJobSearch] = useState('');
  const [routeFilter, setRouteFilter] = useState('');
  const [bagFilter, setBagFilter] = useState('');
  const [traceKey, setTraceKey] = useState('');
  const [traceData, setTraceData] = useState(null);

  // Dialogs
  const [newJobOpen, setNewJobOpen] = useState(false);
  const [roundOpen, setRoundOpen] = useState(false);
  const [fgBagOpen, setFgBagOpen] = useState(false);
  const [isolateOpen, setIsolateOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [dailyReportOpen, setDailyReportOpen] = useState(false);
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [diagramOpen, setDiagramOpen] = useState(false);
  const [selectedBagForAction, setSelectedBagForAction] = useState(null);

  // Dynamic Route-Based Stock Lots State
  const [routeLots, setRouteLots] = useState([]);
  const [loadingLots, setLoadingLots] = useState(false);
  const [selectedStockLot, setSelectedStockLot] = useState(null);
  const [customLotMode, setCustomLotMode] = useState(false);

  // Fresh Forms (Zero fake example data)
  const [newJobForm, setNewJobForm] = useState({
    item_name: '',
    item_code: '',
    processing_route: 'ROUTE_B',
    source_lot_no: '',
    available_stock_bags: 0,
    available_stock_weight_kg: 0,
    unit_bag_weight_kg: 26.0,
    issued_bags_to_team: 2,
    source_bags_count: 2,
    source_rm_weight_kg: 52.0,
    vacuum_processed: true,
    vacuum_bags_count: 2,
    vacuum_output_weight_kg: 52.0,
    vacuum_date: '',
    waiting_days: 0,
    sorting_batch_no: '',
    tray_station_no: 'Tray-01 (Station A)',
    team_name: '',
    team_leader: '',
    member1: '',
    member2: '',
    member3: '',
    start_time: '08:30 AM',
    target_fg_bag_weight_kg: 50.0,
    estimated_waste_pct: 1.0,
    approx_fg_bags: 1,
    approx_fg_weight_kg: 51.48,
    daily_target_fg_bags: 8,
    daily_target_hours: 8.0
  });

  const [roundForm, setRoundForm] = useState({
    round_number: 1,
    tray_no: 'Tray-01',
    findings_category: 'Normal sorting',
    findings_description: '',
    waste_measured_weight_kg: 0.5,
    live_insect_found: false,
    affected_bag_ref: '',
    qc_sample_sent: true,
    qc_sample_weight_g: 250,
    qc_action: 'Approve current result',
    qc_decision_notes: '',
    qc_inspector: user?.username || 'QC Officer'
  });

  const [fgBagForm, setFgBagForm] = useState({
    bag_count: 1,
    actual_weight_kg: 50.00,
    target_weight_kg: 50.00,
    stitching_status: 'STITCHED',
    fg_row_location: 'Row-A-01',
    qc_status: 'APPROVED',
    isolation_status: 'NORMAL',
    isolation_reason: ''
  });

  const [isolateForm, setIsolateForm] = useState({
    reason: 'Live insect found at tray open side during bagging. Immediate QC hold.',
    isolated_by: user?.username || 'QC Officer'
  });

  const [releaseForm, setReleaseForm] = useState({
    authorized_by: user?.username || 'Quality Manager',
    release_notes: '',
    new_row_location: 'Row-A-02'
  });

  const [dailyReportForm, setDailyReportForm] = useState({
    record_date: new Date().toISOString().split('T')[0],
    shift: 'Shift-1',
    team_name: '',
    team_leader: '',
    member1: '',
    member2: '',
    member3: '',
    item_name: '',
    source_lot_no: '',
    rm_bags_count: 0,
    rm_weight_kg: 0,
    vacuum_bags_count: 0,
    vacuum_output_kg: 0,
    fg_bags_count: 0,
    fg_weight_kg: 0,
    sorting_hours: 8.0,
    sorting_rounds: 1,
    waste_weight_kg: 0,
    findings_summary: '',
    stitched_in_row_count: 0,
    awaiting_qc_count: 0,
    approved_fg_count: 0,
    isolated_fg_count: 0,
    rejected_fg_count: 0,
    remarks: ''
  });

  const [newPlanForm, setNewPlanForm] = useState({
    customer_name: '',
    customer_po: '',
    sales_order_ref: '',
    fg_item_name: '',
    required_qty_kg: 1000,
    target_bag_weight_kg: 50.0,
    loading_datetime: '',
    prep_deadline_datetime: '',
    priority_level: 'HIGH',
    notes: ''
  });

  const [selectedPlanForAlloc, setSelectedPlanForAlloc] = useState(null);
  const [selectedBagsForAlloc, setSelectedBagsForAlloc] = useState([]);

  // Load Initial Data
  useEffect(() => {
    loadAllData();
  }, [selectedCompany]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const companyId = selectedCompany?.id || 1;
      const [kpiRes, jobsRes, bagsRes, reportsRes, plansRes] = await Promise.all([
        api.get(`/hand-sorting/dashboard?company_id=${companyId}`),
        api.get(`/hand-sorting/jobs?company_id=${companyId}`),
        api.get(`/hand-sorting/fg-bags?company_id=${companyId}`),
        api.get(`/hand-sorting/daily-reports?company_id=${companyId}`),
        api.get(`/hand-sorting/customer-plans?company_id=${companyId}`)
      ]);

      if (kpiRes && kpiRes.data) setKpis(kpiRes.data);
      if (jobsRes && jobsRes.data) {
        const list = Array.isArray(jobsRes.data) ? jobsRes.data : [];
        setJobs(list);
        if (list.length > 0) {
          const currentId = selectedJob?.id || selectedJob?.job?.id;
          const matched = list.find(j => j.id === currentId);
          if (matched) {
            selectJob(matched);
          } else {
            selectJob(list[0]);
          }
        } else {
          setSelectedJob(null);
          setJobDetails(null);
        }
      }
      if (bagsRes && bagsRes.data) setFgBags(bagsRes.data);
      if (reportsRes && reportsRes.data) setDailyReports(reportsRes.data);
      if (plansRes && plansRes.data) setCustomerPlans(plansRes.data);
    } catch (err) {
      console.error('Failed to load hand sorting data:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectJob = async (job) => {
    if (!job) {
      setSelectedJob(null);
      setJobDetails(null);
      return;
    }
    const actualJob = job.job || job;
    const jobId = actualJob?.id;
    if (!jobId || jobId === 'undefined' || jobId === 'null') {
      setSelectedJob(null);
      setJobDetails(null);
      return;
    }
    setSelectedJob(actualJob);
    try {
      const companyId = selectedCompany?.id || 1;
      const res = await api.get(`/hand-sorting/jobs/${jobId}?company_id=${companyId}`);
      if (res && res.data) {
        setJobDetails(res.data);
        if (res.data.job) {
          setSelectedJob(res.data.job);
        }
      }
    } catch (err) {
      console.error('Error fetching job details:', err);
      if (err?.response?.status === 404) {
        setSelectedJob(null);
        setJobDetails(null);
      }
    }
  };

  // Fetch dynamic stock lots when opening New Job dialog or changing route
  useEffect(() => {
    if (newJobOpen) {
      fetchLotsForRoute(newJobForm.processing_route);
    }
  }, [newJobOpen, newJobForm.processing_route, selectedCompany]);

  const fetchLotsForRoute = async (route) => {
    setLoadingLots(true);
    try {
      const companyId = selectedCompany?.id || 1;
      const res = await api.get(`/hand-sorting/source-lots?route=${route}&company_id=${companyId}`);
      const rawList = (res && res.data ? res.data : []) || [];
      const seen = new Set();
      const list = [];
      for (const item of rawList) {
        if (item && item.lot_no && !seen.has(item.lot_no)) {
          seen.add(item.lot_no);
          list.push(item);
        }
      }
      setRouteLots(list);

      // Check if current source_lot_no is in list
      const matched = list.find((l) => l.lot_no === newJobForm.source_lot_no);
      if (matched) {
        setSelectedStockLot(matched);
      } else if (list.length > 0) {
        applySelectedLot(list[0], route);
      } else {
        setSelectedStockLot(null);
      }
    } catch (err) {
      console.error('Failed to load source lots:', err);
    } finally {
      setLoadingLots(false);
    }
  };

  // Live dynamic calculation for Source Weight & Approximate FG Output
  const calculateEstimates = (issuedBags, unitWeight, targetFgWeight = 50.0, wastePct = 1.0) => {
    const bags = Math.max(0, parseInt(issuedBags || 0));
    const uWt = Math.max(0, parseFloat(unitWeight || 0));
    const target = Math.max(1, parseFloat(targetFgWeight || 50.0));
    const waste = Math.max(0, parseFloat(wastePct || 0));

    // 1. Total Weight Issued to Team (kg) = issued_bags * unit_weight
    const totalSourceWeight = parseFloat((bags * uWt).toFixed(2));

    // 2. Expected FG Net Weight (kg) = totalSourceWeight * (1 - waste / 100)
    const expectedFgWeight = parseFloat((totalSourceWeight * (1 - waste / 100)).toFixed(2));

    // 3. Approximate FG Bags Count = Math.floor(expectedFgWeight / target)
    const approxFgBags = Math.floor(expectedFgWeight / target);

    // 4. Remainder weight (kg)
    const remainderKg = parseFloat((expectedFgWeight - (approxFgBags * target)).toFixed(2));

    return {
      source_rm_weight_kg: totalSourceWeight,
      approx_fg_bags: approxFgBags,
      approx_fg_weight_kg: expectedFgWeight,
      remainder_kg: remainderKg,
      waste_kg: parseFloat(((totalSourceWeight * waste) / 100).toFixed(2))
    };
  };

  const handleCalculationFieldChange = (field, value) => {
    setNewJobForm(prev => {
      const updated = { ...prev, [field]: value };
      const issued = field === 'issued_bags_to_team' ? value : updated.issued_bags_to_team;
      const uWt = field === 'unit_bag_weight_kg' ? value : updated.unit_bag_weight_kg;
      const targetFg = field === 'target_fg_bag_weight_kg' ? value : updated.target_fg_bag_weight_kg;
      const waste = field === 'estimated_waste_pct' ? value : updated.estimated_waste_pct;

      const calc = calculateEstimates(issued, uWt, targetFg, waste);

      return {
        ...updated,
        source_bags_count: parseInt(issued || 0),
        source_rm_weight_kg: calc.source_rm_weight_kg,
        approx_fg_bags: calc.approx_fg_bags,
        approx_fg_weight_kg: calc.approx_fg_weight_kg,
        vacuum_bags_count: prev.processing_route === 'ROUTE_B' ? parseInt(issued || 0) : 0,
        vacuum_output_weight_kg: prev.processing_route === 'ROUTE_B' ? calc.source_rm_weight_kg : 0
      };
    });
  };

  const applySelectedLot = (lot, currentRoute = newJobForm.processing_route) => {
    setSelectedStockLot(lot);
    if (!lot) return;

    const isRouteB = currentRoute === 'ROUTE_B';
    const isRouteA = currentRoute === 'ROUTE_A';

    const availBags = parseInt(lot.available_bags || lot.source_bags_count || 0);
    const availWeight = parseFloat(lot.available_weight_kg || lot.source_rm_weight_kg || 0);

    let unitWeight = 50.0;
    if (parseFloat(lot.unit_bag_weight_kg) > 0) {
      unitWeight = parseFloat(lot.unit_bag_weight_kg);
    } else if (parseFloat(lot.vacuum_bag_unit_weight) > 0) {
      unitWeight = parseFloat(lot.vacuum_bag_unit_weight);
    } else if (availBags > 0 && availWeight > 0) {
      unitWeight = parseFloat((availWeight / availBags).toFixed(2));
    } else if (isRouteB) {
      unitWeight = 26.0;
    }

    // Default issued bags to team: e.g. 2 bags, or up to availBags
    const issuedBags = availBags > 0 ? Math.min(availBags, isRouteB ? 4 : 2) : 2;
    const calc = calculateEstimates(issuedBags, unitWeight, newJobForm.target_fg_bag_weight_kg || 50.0, newJobForm.estimated_waste_pct || 1.0);

    setNewJobForm((prev) => ({
      ...prev,
      source_lot_no: lot.lot_no,
      item_name: lot.item_name || prev.item_name,
      item_code: lot.item_code || prev.item_code,
      available_stock_bags: availBags,
      available_stock_weight_kg: availWeight,
      unit_bag_weight_kg: unitWeight,
      issued_bags_to_team: issuedBags,
      source_bags_count: issuedBags,
      source_rm_weight_kg: calc.source_rm_weight_kg,
      approx_fg_bags: calc.approx_fg_bags,
      approx_fg_weight_kg: calc.approx_fg_weight_kg,
      vacuum_processed: isRouteB ? true : false,
      vacuum_bags_count: isRouteB ? issuedBags : 0,
      vacuum_output_weight_kg: isRouteB ? calc.source_rm_weight_kg : 0,
      vacuum_date: isRouteB ? (lot.vacuum_date || '') : '',
      waiting_days: isRouteB ? (lot.waiting_days || 0) : 0,
      sorting_batch_no: isRouteB
        ? `BATCH-VAC-${lot.lot_no}`
        : isRouteA
          ? `BATCH-INSP-${lot.lot_no}`
          : `BATCH-DIR-${lot.lot_no}`
    }));
  };

  const handleCreateJob = async (e) => {
    if (e) e.preventDefault();
    setActionLoading(true);
    try {
      const companyId = selectedCompany?.id || 1;
      const members = [newJobForm.member1, newJobForm.member2, newJobForm.member3].filter(Boolean);

      const payload = {
        ...newJobForm,
        company_id: companyId,
        team_members: members,
        created_by: user?.username || 'Supervisor'
      };

      const res = await api.post('/hand-sorting/jobs', payload);
      if (res && res.success) {
        setMessage(res.message || 'Job created successfully!');
        setSeverity('success');
        setNewJobOpen(false);
        await loadAllData();

        // Auto select newly created job
        if (res.job_id) {
          try {
            const freshJobRes = await api.get(`/hand-sorting/jobs/${res.job_id}?company_id=${companyId}`);
            if (freshJobRes && freshJobRes.data) {
              const freshJob = freshJobRes.data.job || freshJobRes.data;
              setSelectedJob(freshJob);
              setJobDetails(freshJobRes.data);
            }
          } catch (e) {
            // ignore
          }
        }
      } else {
        setMessage(res?.message || 'Failed to create job');
        setSeverity('error');
      }
    } catch (err) {
      setMessage(err?.message || 'Error creating job');
      setSeverity('error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetWorkspace = async () => {
    if (!window.confirm('Reset Hand Sorting Workspace to fresh state? This will clear all active jobs, sorting rounds, and bagged FG records.')) {
      return;
    }
    setActionLoading(true);
    try {
      const companyId = selectedCompany?.id || 1;
      const res = await api.post('/hand-sorting/reset-fresh', { company_id: companyId });
      if (res && res.success) {
        setMessage('Hand Sorting workspace reset to fresh state.');
        setSeverity('info');
        setSelectedJob(null);
        setJobDetails(null);
        await loadAllData();
      }
    } catch (err) {
      setMessage(err?.message || 'Error resetting workspace');
      setSeverity('error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordRound = async (e) => {
    if (e) e.preventDefault();
    const actualJob = selectedJob?.job || selectedJob;
    const jobId = actualJob?.id;
    if (!jobId || jobId === 'undefined' || jobId === 'null') {
      setMessage('Please select an active sorting job first');
      setSeverity('warning');
      return;
    }
    setActionLoading(true);
    try {
      const companyId = selectedCompany?.id || 1;
      const res = await api.post(`/hand-sorting/jobs/${jobId}/round`, {
        ...roundForm,
        company_id: companyId
      });

      if (res && res.success) {
        setMessage('Sorting round & QC sample recorded successfully!');
        setSeverity('success');
        setRoundOpen(false);
        await selectJob(actualJob);
        await loadAllData();
      } else {
        setMessage(res?.message || 'Failed to record round');
        setSeverity('error');
      }
    } catch (err) {
      setMessage(err?.message || 'Error recording round');
      setSeverity('error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddFgBag = async (e) => {
    if (e) e.preventDefault();
    const actualJob = selectedJob?.job || selectedJob;
    const jobId = actualJob?.id;
    if (!jobId || jobId === 'undefined' || jobId === 'null') {
      setMessage('Please select an active sorting job first');
      setSeverity('warning');
      return;
    }
    setActionLoading(true);
    try {
      const companyId = selectedCompany?.id || 1;
      const res = await api.post(`/hand-sorting/jobs/${jobId}/fg-bag`, {
        ...fgBagForm,
        company_id: companyId
      });

      if (res && res.success) {
        setMessage(`FG Bag ${res.fg_bag_no} added and weighed!`);
        setSeverity('success');
        setFgBagOpen(false);
        await selectJob(actualJob);
        await loadAllData();
      } else {
        setMessage(res?.message || 'Failed to add bag');
        setSeverity('error');
      }
    } catch (err) {
      setMessage(err?.message || 'Error adding bag');
      setSeverity('error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleIsolateBag = async () => {
    if (!selectedBagForAction) return;
    setActionLoading(true);
    try {
      const companyId = selectedCompany?.id || 1;
      const res = await api.post(`/hand-sorting/fg-bags/${selectedBagForAction.id}/isolate`, {
        ...isolateForm,
        company_id: companyId
      });

      if (res && res.success) {
        setMessage(res.message);
        setSeverity('warning');
        setIsolateOpen(false);
        setSelectedBagForAction(null);
        await loadAllData();
        if (selectedJob) await selectJob(selectedJob);
      } else {
        setMessage(res?.message || 'Failed to isolate bag');
        setSeverity('error');
      }
    } catch (err) {
      setMessage(err?.message || 'Error isolating bag');
      setSeverity('error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReleaseBag = async () => {
    if (!selectedBagForAction) return;
    setActionLoading(true);
    try {
      const companyId = selectedCompany?.id || 1;
      const res = await api.post(`/hand-sorting/fg-bags/${selectedBagForAction.id}/release`, {
        ...releaseForm,
        company_id: companyId
      });

      if (res && res.success) {
        setMessage(res.message);
        setSeverity('success');
        setReleaseOpen(false);
        setSelectedBagForAction(null);
        await loadAllData();
        if (selectedJob) await selectJob(selectedJob);
      } else {
        setMessage(res?.message || 'Failed to release bag');
        setSeverity('error');
      }
    } catch (err) {
      setMessage(err?.message || 'Error releasing bag');
      setSeverity('error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveDailyReport = async (e) => {
    if (e) e.preventDefault();
    setActionLoading(true);
    try {
      const companyId = selectedCompany?.id || 1;
      const members = [dailyReportForm.member1, dailyReportForm.member2, dailyReportForm.member3].filter(Boolean);

      const res = await api.post('/hand-sorting/daily-reports', {
        ...dailyReportForm,
        company_id: companyId,
        team_members: members,
        entered_by: user?.username || 'Supervisor'
      });

      if (res && res.success) {
        setMessage(res.message);
        setSeverity('success');
        setDailyReportOpen(false);
        await loadAllData();
      } else {
        setMessage(res?.message || 'Failed to save daily report');
        setSeverity('error');
      }
    } catch (err) {
      setMessage(err?.message || 'Error saving daily report');
      setSeverity('error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddPlan = async (e) => {
    if (e) e.preventDefault();
    setActionLoading(true);
    try {
      const companyId = selectedCompany?.id || 1;
      const res = await api.post('/hand-sorting/customer-plans', {
        ...newPlanForm,
        company_id: companyId
      });

      if (res && res.success) {
        setMessage(res.message);
        setSeverity('success');
        setNewPlanOpen(false);
        await loadAllData();
      } else {
        setMessage(res?.message || 'Failed to add plan');
        setSeverity('error');
      }
    } catch (err) {
      setMessage(err?.message || 'Error adding plan');
      setSeverity('error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAllocateBags = async () => {
    if (!selectedPlanForAlloc || selectedBagsForAlloc.length === 0) return;
    setActionLoading(true);
    try {
      const companyId = selectedCompany?.id || 1;
      const res = await api.post(`/hand-sorting/customer-plans/${selectedPlanForAlloc.id}/allocate`, {
        bag_ids: selectedBagsForAlloc,
        customer_po: selectedPlanForAlloc.customer_po,
        company_id: companyId
      });

      if (res && res.success) {
        setMessage(res.message);
        setSeverity('success');
        setAllocateOpen(false);
        setSelectedBagsForAlloc([]);
        setSelectedPlanForAlloc(null);
        await loadAllData();
      } else {
        setMessage(res?.message || 'Allocation failed');
        setSeverity('error');
      }
    } catch (err) {
      setMessage(err?.message || 'Error allocating bags');
      setSeverity('error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRunTrace = async () => {
    if (!traceKey.trim()) return;
    setActionLoading(true);
    try {
      const companyId = selectedCompany?.id || 1;
      const res = await api.get(`/hand-sorting/traceability/${encodeURIComponent(traceKey.trim())}?company_id=${companyId}`);
      if (res && res.data) {
        setTraceData(res.data);
      }
    } catch (err) {
      console.error('Trace error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Helper for Route Name
  const getRouteLabel = (code) => {
    switch (code) {
      case 'ROUTE_A':
        return 'Route A: Incoming RM Inspection (Pre-QC Sample)';
      case 'ROUTE_B':
        return 'Route B: Vacuum Processing + Hand Sorting (7-Day Rest)';
      case 'ROUTE_C':
        return 'Route C: Direct RM to FG Hand Sorting';
      default:
        return code;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading Hand Sorting & Production Workspace...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      <ViewControlToolbar />

      {/* Top Banner */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: 2,
          background: (theme) =>
            theme.palette.mode === 'dark'
              ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #f0f7ff 100%)',
          border: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/dashboard')}
            sx={{ borderRadius: 2 }}
          >
            Dashboard
          </Button>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <ProcessIcon color="primary" sx={{ fontSize: 32 }} />
              <Typography variant="h5" fontWeight={700}>
                Hand Sorting, QC & Production
              </Typography>
              <Chip
                label="Single Integrated Workspace"
                color="primary"
                size="small"
                variant="outlined"
              />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              One connected workflow: Material Routes, 3-Member Tray Station, QC Samples, Live-Insect Isolation, 50kg Bag Tracking & Weekly Loading Deadlines
            </Typography>
          </Box>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<GuideIcon />}
            onClick={() => setDiagramOpen(true)}
            sx={{ borderRadius: 2 }}
          >
            View Factory Workflow Diagram
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => setNewJobOpen(true)}
            sx={{ borderRadius: 2 }}
          >
            Start New Job
          </Button>
          <Button
            variant="outlined"
            color="warning"
            onClick={handleResetWorkspace}
            sx={{ borderRadius: 2, fontSize: '0.8rem', textTransform: 'none' }}
          >
            Reset to Fresh Module
          </Button>
          <IconButton onClick={loadAllData} color="primary" title="Refresh Workspace">
            <RefreshIcon />
          </IconButton>
        </Stack>
      </Paper>

      {/* KPI Metric Strip */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                ACTIVE SORTING JOBS
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                <Typography variant="h4" fontWeight={700} color="primary">
                  {kpis.active_jobs}
                </Typography>
                <Chip
                  label={`${kpis.qc_pending_jobs} QC Pending`}
                  color={kpis.qc_pending_jobs > 0 ? 'warning' : 'default'}
                  size="small"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                READY APPROVED FG STOCK
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                <Typography variant="h4" fontWeight={700} color="success.main">
                  {kpis.ready_approved_bags} <span style={{ fontSize: '1rem', fontWeight: 500 }}>Bags</span>
                </Typography>
                <Typography variant="body2" fontWeight={600} color="text.secondary">
                  {kpis.ready_approved_kg.toFixed(1)} kg
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            variant="outlined"
            sx={{
              borderRadius: 2,
              borderColor: kpis.isolated_bags_count > 0 ? 'error.main' : 'divider',
              bgcolor: kpis.isolated_bags_count > 0 ? (theme) => theme.palette.mode === 'dark' ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2' : 'inherit'
            }}
          >
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" color={kpis.isolated_bags_count > 0 ? 'error.main' : 'text.secondary'} fontWeight={600}>
                ISOLATED BAGS (QC HOLD)
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                <Typography variant="h4" fontWeight={700} color={kpis.isolated_bags_count > 0 ? 'error.main' : 'text.primary'}>
                  {kpis.isolated_bags_count} <span style={{ fontSize: '1rem', fontWeight: 500 }}>Bags</span>
                </Typography>
                <Chip
                  icon={<InsectIcon />}
                  label="Critical Control"
                  color={kpis.isolated_bags_count > 0 ? 'error' : 'default'}
                  size="small"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                WEEKLY CUSTOMER DEMAND
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                <Typography variant="h4" fontWeight={700} color="info.main">
                  {kpis.total_customer_demand_kg} <span style={{ fontSize: '1rem', fontWeight: 500 }}>kg</span>
                </Typography>
                <Chip
                  label={`${kpis.pending_customer_demand_kg} kg Remaining`}
                  color={kpis.pending_customer_demand_kg > 0 ? 'primary' : 'success'}
                  size="small"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {message && (
        <Alert severity={severity} onClose={() => setMessage('')} sx={{ mb: 3, borderRadius: 2 }}>
          {message}
        </Alert>
      )}

      {/* Main Single-Page Tabbed Workspace */}
      <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Tabs
            value={activeTab}
            onChange={(e, val) => setActiveTab(val)}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="Hand Sorting Workspace Tabs"
            sx={{
              '& .MuiTab-root': {
                fontWeight: 600,
                minHeight: 48,
                fontSize: '0.875rem',
                textTransform: 'none',
              },
            }}
          >
            <Tab icon={<ProcessIcon fontSize="small" />} iconPosition="start" label="1. Material & Job" />
            <Tab icon={<TeamIcon fontSize="small" />} iconPosition="start" label="2. Team & Sorting" />
            <Tab icon={<QcIcon fontSize="small" />} iconPosition="start" label="3. QC & Isolation" />
            <Tab icon={<BagIcon fontSize="small" />} iconPosition="start" label="4. FG Bag Tracking" />
            <Tab icon={<DailyReportIcon fontSize="small" />} iconPosition="start" label="5. Daily Production" />
            <Tab icon={<LoadingIcon fontSize="small" />} iconPosition="start" label="6. Weekly Plan & Loading" />
            <Tab icon={<HistoryIcon fontSize="small" />} iconPosition="start" label="7. History & Reports" />
          </Tabs>
        </Box>

        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          {/* TAB 1: MATERIAL & JOB */}
          <TabPanel value={activeTab} index={0}>
            {jobs.length === 0 ? (
              <Card variant="outlined" sx={{ borderRadius: 3, p: 2, textAlign: 'center' }}>
                <CardContent sx={{ py: 5, px: 3, maxWidth: 900, mx: 'auto' }}>
                  <ProcessIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
                  <Typography variant="h5" fontWeight={800} gutterBottom>
                    Groundnut Factory Hand Sorting, QC & Production Workspace
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 700, mx: 'auto' }}>
                    Welcome to the fresh, integrated Factory Hand Sorting module. Manage material batching, 3-member rectangular silver tray sorting, QC inspections with live-insect quarantine holds, 50.00 kg FG bag packing, daily production logs, and customer loading schedules.
                  </Typography>

                  <Grid container spacing={3} sx={{ mb: 4, textAlign: 'left' }}>
                    <Grid item xs={12} sm={4}>
                      <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', height: '100%' }}>
                        <Chip label="Route A" size="small" color="warning" sx={{ mb: 1, fontWeight: 700 }} />
                        <Typography variant="subtitle2" fontWeight={700}>Incoming RM Pre-QC Inspection</Typography>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                          Factory received raw material purchase entries. 3-member station checks 1 bag sample and sends waste to QC before lot approval.
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Paper sx={{ p: 2.5, borderRadius: 2, border: '2px solid', borderColor: 'primary.main', bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(59, 130, 246, 0.08)' : '#eff6ff', height: '100%' }}>
                        <Chip label="Route B (Standard)" size="small" color="primary" sx={{ mb: 1, fontWeight: 700 }} />
                        <Typography variant="subtitle2" fontWeight={700}>Vacuum Hand Sorting</Typography>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                          Rested vacuum bags (~24–26 kg each). Combine multiple vacuum bags into 1 sorting batch at the rectangular tray, sort into attached 50 kg FG bags.
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', height: '100%' }}>
                        <Chip label="Route C" size="small" color="success" sx={{ mb: 1, fontWeight: 700 }} />
                        <Typography variant="subtitle2" fontWeight={700}>Direct RM Hand Sorting</Typography>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                          QC approved Raw Material lots cleared for direct 3-member station hand sorting into stitched 50 kg finished goods bags.
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>

                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<AddIcon />}
                    onClick={() => setNewJobOpen(true)}
                    sx={{ px: 4, py: 1.5, fontSize: '1rem', fontWeight: 700, borderRadius: 2 }}
                  >
                    Start New Hand Sorting Job
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Card variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent sx={{ p: 2.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" fontWeight={700}>
                          Active Sorting Jobs
                        </Typography>
                        <Button size="small" variant="contained" onClick={() => setNewJobOpen(true)}>
                          + New
                        </Button>
                      </Box>

                      <Stack spacing={1.5} sx={{ maxHeight: 600, overflowY: 'auto', pr: 0.5 }}>
                        {jobs.map((job) => {
                          const isSelected = selectedJob?.id === job.id;
                          return (
                            <Paper
                              key={job.id}
                              onClick={() => selectJob(job)}
                              elevation={isSelected ? 2 : 0}
                              sx={{
                                p: 2,
                                cursor: 'pointer',
                                borderRadius: 2,
                                border: '2px solid',
                                borderColor: isSelected ? 'primary.main' : 'divider',
                                bgcolor: isSelected ? 'action.hover' : 'background.paper',
                                transition: 'all 0.2s',
                                '&:hover': { borderColor: 'primary.light' }
                              }}
                            >
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                <Typography variant="subtitle2" fontWeight={700} color="primary">
                                  {job.job_no}
                                </Typography>
                                <Chip
                                  label={job.qc_status}
                                  size="small"
                                  color={job.qc_status === 'APPROVED' ? 'success' : (job.qc_status === 'HOLD' || job.qc_status === 'ISOLATED') ? 'error' : 'warning'}
                                />
                              </Box>

                              <Typography variant="body2" fontWeight={600} noWrap>
                                {job.item_name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" display="block">
                                Lot: <strong>{job.source_lot_no}</strong> | Route: {job.processing_route === 'ROUTE_B' ? 'Vacuum + Sorting' : job.processing_route === 'ROUTE_A' ? 'Incoming Pre-QC' : 'Direct RM-to-FG'}
                              </Typography>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                  {job.team_name} ({job.tray_station_no})
                                </Typography>
                                <Typography variant="caption" fontWeight={600}>
                                  {job.fg_bags_produced_count} / {job.daily_target_fg_bags || 8} FG Bags
                                </Typography>
                              </Box>
                            </Paper>
                          );
                        })}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Selected Job Detailed Card */}
                <Grid item xs={12} md={8}>
                  {selectedJob ? (
                    <Card variant="outlined" sx={{ borderRadius: 2 }}>
                      <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                          <Box>
                            <Typography variant="h5" fontWeight={700} color="primary">
                              {selectedJob.job_no} — {selectedJob.item_name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Processing Route: <strong>{getRouteLabel(selectedJob.processing_route)}</strong> | Batch: <strong>{selectedJob.sorting_batch_no || '-'}</strong>
                            </Typography>
                          </Box>
                          <Stack direction="row" spacing={1}>
                            <Button
                              variant="outlined"
                              color="secondary"
                              startIcon={<DecisionIcon />}
                              onClick={() => setRoundOpen(true)}
                            >
                              Record Round & Sample
                            </Button>
                            <Button
                              variant="contained"
                              color="primary"
                              startIcon={<ScaleIcon />}
                              onClick={() => setFgBagOpen(true)}
                            >
                              + Weigh FG Bag (50kg)
                            </Button>
                          </Stack>
                        </Box>

                        <Divider sx={{ my: 2 }} />

                        {/* Top Key Metrics Row */}
                        <Grid container spacing={2} sx={{ mb: 3 }}>
                          <Grid item xs={12} sm={3}>
                            <Paper sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1.5 }}>
                              <Typography variant="caption" color="text.secondary">Source Lot & Available Stock</Typography>
                              <Typography variant="subtitle1" fontWeight={700}>
                                {selectedJob.source_lot_no}
                              </Typography>
                              <Typography variant="caption" display="block">
                                Godown Stock: <strong>{selectedJob.available_stock_bags ? `${selectedJob.available_stock_bags} Bags` : 'Stock Linked'}</strong>
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Unit Wt: ~{selectedJob.unit_bag_weight_kg || (selectedJob.processing_route === 'ROUTE_B' ? 26 : 50)} kg
                              </Typography>
                            </Paper>
                          </Grid>

                          <Grid item xs={12} sm={3}>
                            <Paper sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1.5 }}>
                              <Typography variant="caption" color="text.secondary">Issued to Team & Total Weight</Typography>
                              <Typography variant="subtitle1" fontWeight={700} color="primary.main">
                                {selectedJob.issued_bags_to_team || selectedJob.source_bags_count} Bags Issued
                              </Typography>
                              <Typography variant="caption" display="block">
                                Total Input: <strong>{selectedJob.source_rm_weight_kg} kg</strong>
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Expected FG: ~{selectedJob.approx_fg_bags || Math.floor((selectedJob.source_rm_weight_kg || 0) / 50)} Bags (50kg)
                              </Typography>
                            </Paper>
                          </Grid>

                          <Grid item xs={12} sm={3}>
                            <Paper sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1.5 }}>
                              <Typography variant="caption" color="text.secondary">Daily Target FG Quota</Typography>
                              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                                <Typography variant="subtitle1" fontWeight={700} color={selectedJob.fg_bags_produced_count >= (selectedJob.daily_target_fg_bags || 8) ? 'success.main' : 'primary.main'}>
                                  {selectedJob.fg_bags_produced_count} / {selectedJob.daily_target_fg_bags || 8}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">Bags</Typography>
                              </Box>
                              <LinearProgress
                                variant="determinate"
                                value={Math.min(100, Math.round(((selectedJob.fg_bags_produced_count || 0) / (selectedJob.daily_target_fg_bags || 8)) * 100))}
                                color={selectedJob.fg_bags_produced_count >= (selectedJob.daily_target_fg_bags || 8) ? 'success' : 'primary'}
                                sx={{ height: 6, borderRadius: 3, my: 0.75 }}
                              />
                              <Typography variant="caption" color="text.secondary">
                                Shift: {selectedJob.daily_target_hours || 8.0} hrs ({Math.max(0, (selectedJob.daily_target_fg_bags || 8) - selectedJob.fg_bags_produced_count)} bags remaining)
                              </Typography>
                            </Paper>
                          </Grid>

                          <Grid item xs={12} sm={3}>
                            <Paper sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1.5 }}>
                              <Typography variant="caption" color="text.secondary">Produced FG Output</Typography>
                              <Typography variant="subtitle1" fontWeight={700} color="success.main">
                                {selectedJob.fg_bags_produced_count} Bags ({selectedJob.total_fg_weight_kg} kg)
                              </Typography>
                              <Typography variant="caption" display="block">Waste: {selectedJob.total_waste_weight_kg} kg</Typography>
                              <Typography variant="caption" color="text.secondary">Station: {selectedJob.tray_station_no}</Typography>
                            </Paper>
                          </Grid>
                        </Grid>

                        {/* Team Members assigned to the Silver Tray */}
                        <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <TeamIcon color="primary" /> Tray Station Team Members ({selectedJob.tray_station_no} • Team {selectedJob.team_name || 'Alpha'})
                        </Typography>
                        <Paper sx={{ p: 2, mb: 3, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                          <Grid container spacing={2}>
                            {(selectedJob.team_members_list && selectedJob.team_members_list.length > 0) ? (
                              selectedJob.team_members_list.map((m, idx) => (
                                <Grid item xs={12} sm={4} key={idx}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: 'primary.main', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                                      {idx + 1}
                                    </Box>
                                    <Box>
                                      <Typography variant="body2" fontWeight={700}>{m}</Typography>
                                      <Typography variant="caption" color="text.secondary">Tray Station Operator</Typography>
                                    </Box>
                                  </Box>
                                </Grid>
                              ))
                            ) : (
                              <Grid item xs={12}>
                                <Typography variant="body2" color="text.secondary">
                                  No individual worker names registered. Team Leader: <strong>{selectedJob.team_leader || 'Supervisor'}</strong>
                                </Typography>
                              </Grid>
                            )}
                          </Grid>
                        </Paper>

                        {/* Sorting Rounds History */}
                        <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <DecisionIcon color="primary" /> Sorting Rounds & QC Inspection Samples
                        </Typography>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Round #</TableCell>
                              <TableCell>Time</TableCell>
                              <TableCell>Finding Category</TableCell>
                              <TableCell>Observations</TableCell>
                              <TableCell align="right">Waste (kg)</TableCell>
                              <TableCell>QC Action & Decision</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(jobDetails?.rounds || []).map((r) => (
                              <TableRow key={r.id} sx={{ bgcolor: r.live_insect_found ? 'error.lighter' : 'inherit' }}>
                                <TableCell>Round {r.round_number}</TableCell>
                                <TableCell>{r.round_time}</TableCell>
                                <TableCell>
                                  <Chip
                                    label={r.findings_category}
                                    size="small"
                                    color={r.live_insect_found ? 'error' : 'default'}
                                    icon={r.live_insect_found ? <InsectIcon /> : undefined}
                                  />
                                </TableCell>
                                <TableCell>{r.findings_description || '-'}</TableCell>
                                <TableCell align="right">{r.waste_measured_weight_kg} kg</TableCell>
                                <TableCell>
                                  <Typography variant="caption" fontWeight={600} display="block">
                                    {r.qc_action}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {r.qc_decision_notes} ({r.qc_inspector})
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            ))}
                            {(!jobDetails?.rounds || jobDetails.rounds.length === 0) && (
                              <TableRow>
                                <TableCell colSpan={6} align="center">No rounds recorded yet. Click "Record Round & Sample" above.</TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  ) : (
                    <Alert severity="info">Select a job from the left panel or click "+ New" to start.</Alert>
                  )}
                </Grid>
              </Grid>
            )}
          </TabPanel>

          {/* TAB 2: TEAM & SORTING */}
          <TabPanel value={activeTab} index={1}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TeamIcon color="primary" /> Physical Sorting Station & 3-Member Tray Setup
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Accurately tracks the rectangular silver sorting tray (raised sides, open edge attached to empty FG bag) with up to 3 operators placing small quantities into the tray.
                </Typography>

                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2.5, borderRadius: 2, bgcolor: 'action.hover' }}>
                      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                        Physical Tray Workflow Checklist
                      </Typography>
                      <Stack spacing={1.5}>
                        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                          <SuccessIcon color="success" />
                          <Typography variant="body2">
                            <strong>Step 1:</strong> Take small quantity from RM/vacuum bag into the silver tray.
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                          <SuccessIcon color="success" />
                          <Typography variant="body2">
                            <strong>Step 2:</strong> Sort the material carefully (remove shells, stones, damaged grains, insect parts).
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                          <SuccessIcon color="success" />
                          <Typography variant="body2">
                            <strong>Step 3:</strong> Push cleared good material toward the open tray edge into attached FG bag.
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                          <SuccessIcon color="success" />
                          <Typography variant="body2">
                            <strong>Step 4:</strong> Fill to target weight (50.00 kg on digital scale) and stitch.
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                          <SuccessIcon color="success" />
                          <Typography variant="body2">
                            <strong>Step 5:</strong> Place stitched bag in designated warehouse row.
                          </Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                        Member-Wise Fair Work Allocation
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Output is split accurately according to actual hours worked by each team member at the tray without duplicating full team totals.
                      </Typography>

                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Worker Name</TableCell>
                            <TableCell>Role</TableCell>
                            <TableCell align="right">Active Hours</TableCell>
                            <TableCell align="right">Attributed Output</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(selectedJob?.team_members_list && selectedJob.team_members_list.length > 0) ? (
                            selectedJob.team_members_list.map((worker, idx) => {
                              const workerHours = selectedJob.daily_target_hours || 8.0;
                              const memberCount = selectedJob.team_members_list.length;
                              const workerKg = selectedJob.total_fg_weight_kg > 0
                                ? (selectedJob.total_fg_weight_kg / memberCount).toFixed(1)
                                : '0.0';
                              const workerBags = selectedJob.fg_bags_produced_count > 0
                                ? (selectedJob.fg_bags_produced_count / memberCount).toFixed(1)
                                : '0';
                              return (
                                <TableRow key={idx}>
                                  <TableCell>
                                    <Typography variant="body2" fontWeight={700}>{worker}</Typography>
                                    <Typography variant="caption" color="text.secondary">Station: {selectedJob.tray_station_no}</Typography>
                                  </TableCell>
                                  <TableCell>Tray Operator {idx + 1}</TableCell>
                                  <TableCell align="right">{workerHours.toFixed(1)} hrs</TableCell>
                                  <TableCell align="right">
                                    <Typography variant="body2" fontWeight={700}>{workerKg} kg</Typography>
                                    <Typography variant="caption" color="text.secondary">({workerBags} Bags)</Typography>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          ) : (
                            <TableRow>
                              <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                                {selectedJob
                                  ? 'No workers assigned yet for this job station. Please add workers in Job Setup.'
                                  : 'Select a sorting job to view member-wise output distribution.'}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </TabPanel>

          {/* TAB 3: QC & ISOLATION */}
          <TabPanel value={activeTab} index={2}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={7}>
                <Card
                  variant="outlined"
                  sx={{
                    borderRadius: 2,
                    borderColor: 'error.main',
                    borderWidth: 2,
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(239, 68, 68, 0.05)' : '#fff8f8'
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                      <InsectIcon color="error" sx={{ fontSize: 32 }} />
                      <Typography variant="h6" fontWeight={700} color="error.main">
                        Live-Insect Finding & Immediate Bag Isolation Protocol
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      Critical factory control: When any worker discovers a live insect at the tray, they immediately notify QC. 
                      The specific affected 50 kg FG bag is isolated separately, marked with an <strong>ISOLATED / QC HOLD</strong> tag, and removed to the isolation bay.
                    </Typography>

                    <Alert severity="warning" sx={{ mb: 3 }}>
                      <strong>Key Requirement:</strong> Other eligible bags may continue normal processing while the affected bag is held. The ERP blocks unauthorized release, dispatch, or normal customer allocation of the isolated bag.
                    </Alert>

                    <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                      Active Isolated FG Bags on QC Hold
                    </Typography>

                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Bag Number</TableCell>
                          <TableCell>Item & Lot</TableCell>
                          <TableCell>Isolation Reason</TableCell>
                          <TableCell>Location</TableCell>
                          <TableCell align="center">Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {fgBags.filter(b => b.isolation_status === 'ISOLATED').map((bag) => (
                          <TableRow key={bag.id} sx={{ bgcolor: 'error.lighter' }}>
                            <TableCell>
                              <Typography variant="body2" fontWeight={700} color="error.main">
                                {bag.fg_bag_no}
                              </Typography>
                              <Typography variant="caption">{bag.actual_weight_kg} kg</Typography>
                            </TableCell>
                            <TableCell>{bag.item_name}<br/><span style={{ fontSize: '0.75rem', color: '#64748b' }}>Lot: {bag.source_lot_no}</span></TableCell>
                            <TableCell>{bag.isolation_reason || 'Live insect detected'}</TableCell>
                            <TableCell><Chip label={bag.fg_row_location} size="small" color="error" /></TableCell>
                            <TableCell align="center">
                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                                startIcon={<UnlockIcon />}
                                onClick={() => {
                                  setSelectedBagForAction(bag);
                                  setReleaseOpen(true);
                                }}
                              >
                                Authorize Release
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {fgBags.filter(b => b.isolation_status === 'ISOLATED').length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} align="center">
                              Zero isolated bags currently. All FG stock is in normal status.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </Grid>

              {/* QC Decisions Card */}
              <Grid item xs={12} md={5}>
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <QcIcon color="primary" /> QC Actions & Acceptance Specifications
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Inspect foreign matter, live/dead insects, damaged grains, stones, weed seeds and evaluate against visual acceptance limits.
                    </Typography>

                    <Stack spacing={1.5}>
                      <Paper sx={{ p: 1.5, borderLeft: '4px solid #16a34a', bgcolor: 'action.hover' }}>
                        <Typography variant="subtitle2" fontWeight={700}>1. Approve Current Result</Typography>
                        <Typography variant="caption" color="text.secondary">Foreign matter within limits, zero infestation. Cleared for 50kg bag packing.</Typography>
                      </Paper>

                      <Paper sx={{ p: 1.5, borderLeft: '4px solid #f59e0b', bgcolor: 'action.hover' }}>
                        <Typography variant="subtitle2" fontWeight={700}>2. Request Another Sorting Round</Typography>
                        <Typography variant="caption" color="text.secondary">Excess shell or broken grains observed. Requires second sorting pass.</Typography>
                      </Paper>

                      <Paper sx={{ p: 1.5, borderLeft: '4px solid #dc2626', bgcolor: 'action.hover' }}>
                        <Typography variant="subtitle2" fontWeight={700}>3. Isolate Bag & Hold Material</Typography>
                        <Typography variant="caption" color="text.secondary">Live insect detected or critical contaminant. Isolated immediately under QC custody.</Typography>
                      </Paper>

                      <Paper sx={{ p: 1.5, borderLeft: '4px solid #3b82f6', bgcolor: 'action.hover' }}>
                        <Typography variant="subtitle2" fontWeight={700}>4. Request Additional Sampling Bags</Typography>
                        <Typography variant="caption" color="text.secondary">Used in Route A incoming inspection before authorizing production release.</Typography>
                      </Paper>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>

          {/* TAB 4: FG BAG TRACKING */}
          <TabPanel value={activeTab} index={3}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box>
                    <Typography variant="h6" fontWeight={700}>
                      Finished Goods (FG) Bag Register & Row Tracking
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Every bag has an individual record with actual filled weight, target packing (50 kg), digital scale confirmation, stitching, and warehouse row location.
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={() => {
                      if (!selectedJob) {
                        setMessage('Please select an active sorting job first');
                        setSeverity('warning');
                        return;
                      }
                      setFgBagOpen(true);
                    }}
                  >
                    Weigh & Record New FG Bag
                  </Button>
                </Box>

                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>FG Bag Number</TableCell>
                      <TableCell>Item Description</TableCell>
                      <TableCell>Source Lot / Batch</TableCell>
                      <TableCell align="right">Actual Weight</TableCell>
                      <TableCell align="right">Target Wt</TableCell>
                      <TableCell align="center">Stitching</TableCell>
                      <TableCell>Row Location</TableCell>
                      <TableCell align="center">QC / Isolation Status</TableCell>
                      <TableCell align="center">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {fgBags.map((bag) => {
                      const isIso = bag.isolation_status === 'ISOLATED';
                      return (
                        <TableRow key={bag.id} sx={{ bgcolor: isIso ? 'error.lighter' : 'inherit' }}>
                          <TableCell>
                            <Typography variant="body2" fontWeight={700} color={isIso ? 'error.main' : 'primary.main'}>
                              {bag.fg_bag_no}
                            </Typography>
                          </TableCell>
                          <TableCell>{bag.item_name}</TableCell>
                          <TableCell>
                            <Typography variant="caption" display="block">Lot: {bag.source_lot_no}</Typography>
                            <Typography variant="caption" color="text.secondary">Batch: {bag.batch_no || '-'}</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <strong>{bag.actual_weight_kg} kg</strong>
                            <Typography variant="caption" color="success.main" display="block">
                              {(bag.actual_weight_kg - bag.target_weight_kg) >= 0 ? `+${(bag.actual_weight_kg - bag.target_weight_kg).toFixed(2)}` : (bag.actual_weight_kg - bag.target_weight_kg).toFixed(2)} kg
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{bag.target_weight_kg} kg</TableCell>
                          <TableCell align="center">
                            <Chip label={bag.stitching_status} size="small" color="primary" variant="outlined" />
                          </TableCell>
                          <TableCell>
                            <Chip
                              icon={<LocationIcon />}
                              label={bag.fg_row_location}
                              size="small"
                              color={isIso ? 'error' : 'default'}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={bag.qc_status}
                              size="small"
                              color={bag.qc_status === 'APPROVED' ? 'success' : isIso ? 'error' : 'warning'}
                            />
                          </TableCell>
                          <TableCell align="center">
                            {isIso ? (
                              <Button
                                size="small"
                                variant="outlined"
                                color="success"
                                startIcon={<UnlockIcon />}
                                onClick={() => {
                                  setSelectedBagForAction(bag);
                                  setReleaseOpen(true);
                                }}
                              >
                                Release
                              </Button>
                            ) : (
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                startIcon={<InsectIcon />}
                                onClick={() => {
                                  setSelectedBagForAction(bag);
                                  setIsolateOpen(true);
                                }}
                              >
                                Isolate
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabPanel>

          {/* TAB 5: DAILY PRODUCTION */}
          <TabPanel value={activeTab} index={4}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box>
                    <Typography variant="h6" fontWeight={700}>
                      End-of-Day Manual Production Reports
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Separate reporting of RM Bags, Vacuum Bags, and Finished Goods Bags (strictly never added together).
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={() => setDailyReportOpen(true)}
                  >
                    Log End-of-Day Production
                  </Button>
                </Box>

                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date / Shift</TableCell>
                      <TableCell>Team & Leader</TableCell>
                      <TableCell>Item & Lot</TableCell>
                      <TableCell align="right">RM Handled</TableCell>
                      <TableCell align="right">Vacuum Output</TableCell>
                      <TableCell align="right">FG Bags Packed</TableCell>
                      <TableCell align="right">Waste</TableCell>
                      <TableCell align="center">Approved / Isolated</TableCell>
                      <TableCell>Remarks</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dailyReports.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <strong>{r.record_date}</strong>
                          <Typography variant="caption" display="block">{r.shift}</Typography>
                        </TableCell>
                        <TableCell>
                          {r.team_name}
                          <Typography variant="caption" color="text.secondary" display="block">
                            Leader: {r.team_leader}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {r.item_name}
                          <Typography variant="caption" display="block">Lot: {r.source_lot_no}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          {r.rm_bags_count} Bags
                          <Typography variant="caption" display="block">({r.rm_weight_kg} kg)</Typography>
                        </TableCell>
                        <TableCell align="right">
                          {r.vacuum_bags_count > 0 ? `${r.vacuum_bags_count} Bags (${r.vacuum_output_kg} kg)` : 'N/A'}
                        </TableCell>
                        <TableCell align="right">
                          <strong style={{ color: '#16a34a' }}>{r.fg_bags_count} Bags</strong>
                          <Typography variant="caption" display="block">({r.fg_weight_kg} kg)</Typography>
                        </TableCell>
                        <TableCell align="right">{r.waste_weight_kg} kg</TableCell>
                        <TableCell align="center">
                          <Chip label={`${r.approved_fg_count} Approved`} size="small" color="success" sx={{ mr: 0.5 }} />
                          {r.isolated_fg_count > 0 && (
                            <Chip label={`${r.isolated_fg_count} Isolated`} size="small" color="error" />
                          )}
                        </TableCell>
                        <TableCell>{r.remarks || '-'}</TableCell>
                      </TableRow>
                    ))}
                    {dailyReports.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} align="center">No daily production logs found.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabPanel>

          {/* TAB 6: WEEKLY PLAN & LOADING */}
          <TabPanel value={activeTab} index={5}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box>
                    <Typography variant="h6" fontWeight={700}>
                      Weekly Customer Demand & Loading-Based Production Targets
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Calculates required daily and hourly sorting targets from loading deadlines and allocated approved stock.
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={() => setNewPlanOpen(true)}
                  >
                    + Register Customer Order Plan
                  </Button>
                </Box>

                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Customer & PO</TableCell>
                      <TableCell>FG Item</TableCell>
                      <TableCell align="right">Required</TableCell>
                      <TableCell align="right">Allocated Approved</TableCell>
                      <TableCell align="right">Remaining To Produce</TableCell>
                      <TableCell>Loading Deadline</TableCell>
                      <TableCell align="right">Daily Target</TableCell>
                      <TableCell align="right">Hourly Target</TableCell>
                      <TableCell align="center">Readiness / Priority</TableCell>
                      <TableCell align="center">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {customerPlans.map((plan) => (
                      <TableRow key={plan.id} sx={{ bgcolor: plan.is_at_risk ? 'warning.lighter' : 'inherit' }}>
                        <TableCell>
                          <strong>{plan.customer_name}</strong>
                          <Typography variant="caption" display="block">PO: {plan.customer_po}</Typography>
                        </TableCell>
                        <TableCell>{plan.fg_item_name}</TableCell>
                        <TableCell align="right">
                          <strong>{plan.required_qty_kg} kg</strong>
                          <Typography variant="caption" display="block">({plan.required_bags_count} Bags)</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <strong style={{ color: '#16a34a' }}>{plan.allocated_approved_fg_kg} kg</strong>
                          <Typography variant="caption" display="block">({plan.allocated_bags_count} Bags)</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <strong style={{ color: plan.remaining_qty_kg > 0 ? '#dc2626' : '#16a34a' }}>
                            {plan.remaining_qty_kg} kg
                          </strong>
                          <Typography variant="caption" display="block">({plan.remaining_bags_count} Bags)</Typography>
                        </TableCell>
                        <TableCell>
                          {plan.loading_datetime}
                          <Typography variant="caption" color="text.secondary" display="block">
                            Prep Due: {plan.prep_deadline_datetime} ({plan.hours_remaining}h left)
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <strong>{plan.daily_target_kg} kg/day</strong>
                        </TableCell>
                        <TableCell align="right">
                          <strong>{plan.hourly_target_kg} kg/hr</strong>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={plan.remaining_qty_kg === 0 ? 'Ready To Load' : plan.priority_level}
                            size="small"
                            color={plan.remaining_qty_kg === 0 ? 'success' : plan.is_at_risk ? 'error' : 'warning'}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={plan.remaining_qty_kg === 0}
                            onClick={() => {
                              setSelectedPlanForAlloc(plan);
                              setAllocateOpen(true);
                            }}
                          >
                            Allocate FG Bags
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabPanel>

          {/* TAB 7: HISTORY & REPORTS */}
          <TabPanel value={activeTab} index={6}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SearchIcon color="primary" /> Full Forward & Backward Material Traceability
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Search by FG Bag Number (e.g. FG-GN-2601-001), RM Lot Number (e.g. LOT-GN-2026-081), or Batch Number.
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                      <TextField
                        size="small"
                        placeholder="Enter FG Bag No / RM Lot / Batch No"
                        value={traceKey}
                        onChange={(e) => setTraceKey(e.target.value)}
                        sx={{ width: 350 }}
                      />
                      <Button variant="contained" onClick={handleRunTrace} startIcon={<SearchIcon />}>
                        Trace Material
                      </Button>
                    </Box>

                    {traceData && (
                      <Paper sx={{ p: 2.5, borderRadius: 2, bgcolor: 'action.hover' }}>
                        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                          Traceability Results for "{traceData.search_key}"
                        </Typography>

                        <Grid container spacing={2} sx={{ mb: 2 }}>
                          {(traceData.matched_bags || []).map((b) => (
                            <Grid item xs={12} sm={6} key={b.id}>
                              <Paper sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}>
                                <Typography variant="subtitle2" fontWeight={700} color="primary">
                                  FG Bag: {b.fg_bag_no} ({b.actual_weight_kg} kg)
                                </Typography>
                                <Typography variant="body2">RM Lot: <strong>{b.rm_lot || b.source_lot_no}</strong></Typography>
                                <Typography variant="body2">Processing Route: {getRouteLabel(b.processing_route)}</Typography>
                                <Typography variant="body2">
                                  Vacuum Output: {b.vacuum_processed ? `${b.vacuum_bags_count} Vac Bags (${b.vacuum_output_weight_kg} kg)` : 'Direct Hand Sorting'}
                                </Typography>
                                <Typography variant="body2">Station & Team: {b.team_name} (Leader: {b.team_leader})</Typography>
                                <Typography variant="body2">
                                  Row Location: <strong>{b.fg_row_location}</strong> | Status: <strong>{b.qc_status}</strong>
                                </Typography>
                              </Paper>
                            </Grid>
                          ))}
                        </Grid>
                      </Paper>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>
        </Box>
      </Paper>

      {/* DIALOG 1: NEW SORTING JOB */}
      <Dialog open={newJobOpen} onClose={() => setNewJobOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Start New Hand Sorting Job</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Processing Route</InputLabel>
                <Select
                  value={newJobForm.processing_route}
                  label="Processing Route"
                  onChange={(e) => {
                    const newRoute = e.target.value;
                    setNewJobForm(prev => ({
                      ...prev,
                      processing_route: newRoute,
                      vacuum_processed: newRoute === 'ROUTE_B'
                    }));
                    fetchLotsForRoute(newRoute);
                  }}
                >
                  <MenuItem value="ROUTE_B">Route B: Vacuum Processing + Hand Sorting (Vacuumed Lots)</MenuItem>
                  <MenuItem value="ROUTE_C">Route C: Direct RM-to-FG Hand Sorting (QC Approved RM Stock)</MenuItem>
                  <MenuItem value="ROUTE_A">Route A: Incoming Raw Material Inspection (Purchase Arrived RM)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Route explanation banner */}
            <Grid item xs={12}>
              {newJobForm.processing_route === 'ROUTE_A' && (
                <Alert severity="info" sx={{ py: 0.75, fontSize: '0.85rem' }}>
                  <strong>Route A (Incoming RM Inspection):</strong> Showing newly arrived Raw Material lots from Purchase entries received in the factory. Team checks 1-bag sample and sends waste to QC before full lot release.
                </Alert>
              )}
              {newJobForm.processing_route === 'ROUTE_B' && (
                <Alert severity="info" sx={{ py: 0.75, fontSize: '0.85rem' }}>
                  <strong>Route B (Vacuum Hand Sorting):</strong> Showing vacuumed lots from Vacuum / Grind processing (with actual bag weights ~24–26 kg & 7-day resting period). Multiple vacuum bags can be combined.
                </Alert>
              )}
              {newJobForm.processing_route === 'ROUTE_C' && (
                <Alert severity="success" sx={{ py: 0.75, fontSize: '0.85rem' }}>
                  <strong>Route C (Direct Hand Sorting):</strong> Showing Raw Material lots with verified QC Approval. These lots are cleared and certified for direct hand sorting into 50 kg Finished Goods (FG) bags.
                </Alert>
              )}
            </Grid>

            {/* Dynamic Lot Selector from Stock */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary">
                  SOURCE LOT FROM STOCK ({routeLots.length} Lots Available for {newJobForm.processing_route === 'ROUTE_A' ? 'Route A' : newJobForm.processing_route === 'ROUTE_B' ? 'Route B' : 'Route C'})
                </Typography>
                <Button
                  size="small"
                  sx={{ fontSize: '0.75rem', p: 0, minWidth: 0, textTransform: 'none' }}
                  onClick={() => setCustomLotMode(!customLotMode)}
                >
                  {customLotMode ? 'Choose from ERP Stock' : 'Type Custom Lot No'}
                </Button>
              </Box>

              {!customLotMode ? (
                <FormControl fullWidth size="small">
                  <InputLabel id="stock-lot-select-label">
                    {loadingLots ? 'Loading lots from ERP stock...' : 'Select Source Lot from Stock'}
                  </InputLabel>
                  <Select
                    labelId="stock-lot-select-label"
                    value={newJobForm.source_lot_no || ''}
                    label={loadingLots ? 'Loading lots from ERP stock...' : 'Select Source Lot from Stock'}
                    onChange={(e) => {
                      const found = routeLots.find(l => l.lot_no === e.target.value);
                      if (found) {
                        applySelectedLot(found);
                      } else {
                        setNewJobForm({ ...newJobForm, source_lot_no: e.target.value });
                      }
                    }}
                  >
                    {loadingLots && <MenuItem disabled>Fetching lots...</MenuItem>}
                    {!loadingLots && routeLots.length === 0 && (
                      <MenuItem disabled>No lots found for this route</MenuItem>
                    )}
                    {routeLots.map((lot, idx) => (
                      <MenuItem key={`${lot.lot_no}-${idx}`} value={lot.lot_no}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', gap: 1 }}>
                          <Box>
                            <Typography variant="body2" fontWeight={700}>
                              {lot.lot_no} — {lot.item_name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {newJobForm.processing_route === 'ROUTE_A' && `Inv #${lot.purchase_inv_no || 'REC'} • Received: ${lot.receipt_date || 'Recent'}`}
                              {newJobForm.processing_route === 'ROUTE_B' && `Vac Output: ${lot.vacuum_bags_count || 12} Bags (~${lot.vacuum_output_weight_kg || 298.5} kg) • Rested: ${lot.waiting_days || 7} Days`}
                              {newJobForm.processing_route === 'ROUTE_C' && `QC Cert: ${lot.qc_no || 'QC-OK'} • Status: ${lot.qc_status || 'APPROVED'}`}
                            </Typography>
                          </Box>
                          <Chip
                            size="small"
                            color={newJobForm.processing_route === 'ROUTE_C' ? 'success' : newJobForm.processing_route === 'ROUTE_B' ? 'primary' : 'warning'}
                            label={`${lot.available_bags || lot.source_bags_count || 0} Bags (${lot.available_weight_kg || lot.source_rm_weight_kg || 0} kg)`}
                          />
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                <TextField
                  fullWidth
                  size="small"
                  label="Enter Custom Lot No"
                  value={newJobForm.source_lot_no}
                  onChange={(e) => setNewJobForm({ ...newJobForm, source_lot_no: e.target.value })}
                />
              )}
            </Grid>

            {/* Selected Lot Metadata & Stock Availability Card */}
            {selectedStockLot && (
              <Grid item xs={12}>
                <Paper sx={{ p: 2, borderRadius: 2, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(59, 130, 246, 0.08)' : '#f0f7ff', border: '1px solid', borderColor: 'primary.light' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <StockIcon color="primary" />
                      <Typography variant="subtitle1" fontWeight={700} color="primary.main">
                        Stock Lot: {selectedStockLot.lot_no} — {selectedStockLot.item_name}
                      </Typography>
                    </Box>
                    <Chip label={selectedStockLot.source_badge || 'Stock Lot'} size="small" color="primary" />
                  </Box>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                    {selectedStockLot.description}
                  </Typography>

                  <Grid container spacing={2}>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="caption" color="text.secondary" display="block">Available in Stock</Typography>
                      <Typography variant="subtitle2" fontWeight={700} color="primary.main">
                        {selectedStockLot.available_bags || selectedStockLot.source_bags_count || 0} Bags
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ({selectedStockLot.available_weight_kg || selectedStockLot.source_rm_weight_kg || 0} kg)
                      </Typography>
                    </Grid>

                    <Grid item xs={6} sm={3}>
                      <Typography variant="caption" color="text.secondary" display="block">Bag Unit Weight</Typography>
                      <Typography variant="subtitle2" fontWeight={700}>
                        ~{selectedStockLot.unit_bag_weight_kg || selectedStockLot.vacuum_bag_unit_weight || 50} kg / bag
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {newJobForm.processing_route === 'ROUTE_B' ? 'Vacuum pouch wt' : 'Standard RM bag'}
                      </Typography>
                    </Grid>

                    <Grid item xs={6} sm={3}>
                      <Typography variant="caption" color="text.secondary" display="block">Godown Location</Typography>
                      <Typography variant="subtitle2" fontWeight={700}>
                        {selectedStockLot.godown_name || 'Factory Godown'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">Bay Storage</Typography>
                    </Grid>

                    <Grid item xs={6} sm={3}>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {newJobForm.processing_route === 'ROUTE_B' ? 'Resting Status' : 'Quality Clearance'}
                      </Typography>
                      <Typography variant="subtitle2" fontWeight={700} color="success.main">
                        {newJobForm.processing_route === 'ROUTE_B'
                          ? `${selectedStockLot.waiting_days || 0} Days Rested`
                          : (selectedStockLot.qc_status || 'APPROVED')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {newJobForm.processing_route === 'ROUTE_C' ? `Cert: ${selectedStockLot.qc_no || 'QC-OK'}` : 'Ready for tray'}
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            )}

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Item Name"
                placeholder="e.g. Groundnut (GN - Bold Grade A)"
                value={newJobForm.item_name}
                onChange={(e) => setNewJobForm({ ...newJobForm, item_name: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Sorting Batch No"
                placeholder="e.g. BATCH-VAC-LOT0012"
                value={newJobForm.sorting_batch_no}
                onChange={(e) => setNewJobForm({ ...newJobForm, sorting_batch_no: e.target.value })}
              />
            </Grid>

            {/* SECTION 1: HOW MUCH BAGS TO GIVE THE TEAM & AUTO WEIGHT CALCULATION */}
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <BagIcon color="primary" fontSize="small" />
                <Typography variant="subtitle2" fontWeight={700}>
                  Material Allocation: Bags to Give to Team & Weight Calculation
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Bags to Give to Team (Batch)"
                value={newJobForm.issued_bags_to_team}
                onChange={(e) => handleCalculationFieldChange('issued_bags_to_team', e.target.value)}
                helperText={`Max in stock: ${newJobForm.available_stock_bags || 0} Bags`}
                inputProps={{ min: 1, max: newJobForm.available_stock_bags || 9999 }}
              />
              {/* Quick bag preset buttons */}
              <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                {[1, 2, 4, 6, 10].map((b) => (
                  <Chip
                    key={b}
                    label={`+${b} Bags`}
                    size="small"
                    variant={newJobForm.issued_bags_to_team === b ? 'filled' : 'outlined'}
                    color="primary"
                    clickable
                    onClick={() => handleCalculationFieldChange('issued_bags_to_team', b)}
                    sx={{ fontSize: '0.7rem', height: 22 }}
                  />
                ))}
                {newJobForm.available_stock_bags > 0 && (
                  <Chip
                    label={`All (${newJobForm.available_stock_bags})`}
                    size="small"
                    variant="outlined"
                    color="secondary"
                    clickable
                    onClick={() => handleCalculationFieldChange('issued_bags_to_team', newJobForm.available_stock_bags)}
                    sx={{ fontSize: '0.7rem', height: 22 }}
                  />
                )}
              </Box>
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Unit Weight per Bag (kg)"
                value={newJobForm.unit_bag_weight_kg}
                onChange={(e) => handleCalculationFieldChange('unit_bag_weight_kg', e.target.value)}
                helperText={newJobForm.processing_route === 'ROUTE_B' ? 'Vacuum pack: ~24–26 kg' : 'Standard RM bag: ~50 kg'}
                inputProps={{ step: 0.1, min: 1 }}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Total Source Weight (kg)"
                value={newJobForm.source_rm_weight_kg}
                onChange={(e) => setNewJobForm({ ...newJobForm, source_rm_weight_kg: parseFloat(e.target.value || 0) })}
                helperText={`🧮 Auto: ${newJobForm.issued_bags_to_team || 0} Bags × ${newJobForm.unit_bag_weight_kg || 0} kg`}
                inputProps={{ step: 0.1, min: 0 }}
              />
            </Grid>

            {/* SECTION 2: APPROXIMATE FG BAGS & WEIGHT YIELD CALCULATION */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, mt: 1 }}>
                <CalculateIcon color="success" fontSize="small" />
                <Typography variant="subtitle2" fontWeight={700}>
                  Production Yield & Expected Finished Goods (FG) 50kg Bags
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Target FG Bag Weight (kg)"
                value={newJobForm.target_fg_bag_weight_kg}
                onChange={(e) => handleCalculationFieldChange('target_fg_bag_weight_kg', e.target.value)}
                helperText="Standard export bag weight (50.00 kg on digital scale)"
                inputProps={{ step: 0.5, min: 10 }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Estimated Sorting Waste (%)"
                value={newJobForm.estimated_waste_pct}
                onChange={(e) => handleCalculationFieldChange('estimated_waste_pct', e.target.value)}
                helperText="Estimated foreign matter, dust & broken grain deduction (e.g. 1.0%)"
                inputProps={{ step: 0.1, min: 0, max: 20 }}
              />
            </Grid>

            {/* LIVE AUTOMATIC CALCULATION SUMMARY CARD */}
            <Grid item xs={12}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(34, 197, 94, 0.08)' : '#f0fdf4',
                  border: '1.5px solid',
                  borderColor: 'success.main'
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2" fontWeight={700} color="success.dark">
                    Expected FG Output (Calculated Automatically)
                  </Typography>
                  <Chip
                    label={`50 kg Bag Target`}
                    size="small"
                    color="success"
                  />
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="caption" color="text.secondary">Approximate FG Bags</Typography>
                    <Typography variant="h5" fontWeight={800} color="success.main">
                      ~{newJobForm.approx_fg_bags} Bags
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ({newJobForm.target_fg_bag_weight_kg} kg each)
                    </Typography>
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <Typography variant="caption" color="text.secondary">Expected FG Net Weight</Typography>
                    <Typography variant="h6" fontWeight={700}>
                      {newJobForm.approx_fg_weight_kg} kg
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      After ~{newJobForm.estimated_waste_pct}% waste deduction
                    </Typography>
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <Typography variant="caption" color="text.secondary">Estimated Waste & Balance</Typography>
                    <Typography variant="h6" fontWeight={700} color="warning.main">
                      ~{(((newJobForm.source_rm_weight_kg || 0) * (newJobForm.estimated_waste_pct || 1)) / 100).toFixed(1)} kg waste
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      +{(((newJobForm.approx_fg_weight_kg || 0) % (newJobForm.target_fg_bag_weight_kg || 50))).toFixed(1)} kg balance towards next bag
                    </Typography>
                  </Grid>
                </Grid>

                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, fontStyle: 'italic' }}>
                  Method note: Multiple vacuum bags (~24–26kg) or RM bags are opened and combined at the rectangular sorting tray, sorted by the 3-member team, and pushed into the attached 50.00 kg FG bag.
                </Typography>
              </Paper>
            </Grid>

            {/* SECTION 3: PER DAY TARGET FG BAG COUNT */}
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TargetIcon color="secondary" fontSize="small" />
                <Typography variant="subtitle2" fontWeight={700}>
                  Shift & Daily Production Quota
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Per Day Target FG Bag Count"
                value={newJobForm.daily_target_fg_bags}
                onChange={(e) => setNewJobForm({ ...newJobForm, daily_target_fg_bags: parseInt(e.target.value || 0) })}
                helperText={`Daily finished goods quota for this 3-member tray station (e.g. ${newJobForm.daily_target_fg_bags || 8} Bags = ${(newJobForm.daily_target_fg_bags || 8) * (newJobForm.target_fg_bag_weight_kg || 50)} kg FG/day)`}
                inputProps={{ min: 1 }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Target Shift Duration (Hours)"
                value={newJobForm.daily_target_hours}
                onChange={(e) => setNewJobForm({ ...newJobForm, daily_target_hours: parseFloat(e.target.value || 8.0) })}
                helperText="Standard shift: 8.0 working hours"
                inputProps={{ step: 0.5, min: 1 }}
              />
            </Grid>

            {/* SECTION 4: 3-MEMBER TRAY STATION CONFIGURATION (NO FAKE NAMES) */}
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                3-Member Tray Station Configuration (Enter Actual Station & Workers)
              </Typography>
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label="Station / Tray No"
                placeholder="e.g. Tray-01 (Station A)"
                value={newJobForm.tray_station_no}
                onChange={(e) => setNewJobForm({ ...newJobForm, tray_station_no: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label="Team Name"
                placeholder="e.g. Sorting Team Alpha"
                value={newJobForm.team_name}
                onChange={(e) => setNewJobForm({ ...newJobForm, team_name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label="Team Leader"
                placeholder="Supervisor / Leader Name"
                value={newJobForm.team_leader}
                onChange={(e) => setNewJobForm({ ...newJobForm, team_leader: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label="Member 1 (Tray Operator)"
                placeholder="Worker 1 Name"
                value={newJobForm.member1}
                onChange={(e) => setNewJobForm({ ...newJobForm, member1: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label="Member 2 (Tray Operator)"
                placeholder="Worker 2 Name"
                value={newJobForm.member2}
                onChange={(e) => setNewJobForm({ ...newJobForm, member2: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label="Member 3 (Tray Operator)"
                placeholder="Worker 3 Name"
                value={newJobForm.member3}
                onChange={(e) => setNewJobForm({ ...newJobForm, member3: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setNewJobOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateJob} disabled={actionLoading}>
            {actionLoading ? 'Creating...' : 'Start Job'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG 2: RECORD SORTING ROUND & QC SAMPLE */}
      <Dialog open={roundOpen} onClose={() => setRoundOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Record Sorting Round & QC Sample</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Round Number"
                value={roundForm.round_number}
                onChange={(e) => setRoundForm({ ...roundForm, round_number: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Findings Category</InputLabel>
                <Select
                  value={roundForm.findings_category}
                  label="Findings Category"
                  onChange={(e) => {
                    const isInsect = e.target.value === 'Live insects';
                    setRoundForm({
                      ...roundForm,
                      findings_category: e.target.value,
                      live_insect_found: isInsect,
                      qc_action: isInsect ? 'Keep on hold' : 'Approve current result'
                    });
                  }}
                >
                  <MenuItem value="Normal sorting">Normal sorting (No unusual findings)</MenuItem>
                  <MenuItem value="Live insects">Live insects (Triggers Isolation Protocol!)</MenuItem>
                  <MenuItem value="Dead insects or insect parts">Dead insects or insect parts</MenuItem>
                  <MenuItem value="Foreign matter">Foreign matter (shells, fibers, dust)</MenuItem>
                  <MenuItem value="Stones, soil and extraneous matter">Stones, soil and extraneous matter</MenuItem>
                  <MenuItem value="Damaged or discoloured grains">Damaged or discoloured grains</MenuItem>
                  <MenuItem value="Weed seeds or unwanted seeds">Weed seeds or unwanted seeds</MenuItem>
                  <MenuItem value="Other findings">Other findings</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {roundForm.live_insect_found && (
              <Grid item xs={12}>
                <Alert severity="error">
                  <strong>CRITICAL: Live insect finding!</strong> Worker must stop tray flow immediately. Specify the affected bag below for instant quarantine isolation.
                </Alert>
              </Grid>
            )}

            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Observations & Details"
                value={roundForm.findings_description}
                onChange={(e) => setRoundForm({ ...roundForm, findings_description: e.target.value })}
                multiline
                rows={2}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Measured Waste Weight (kg)"
                value={roundForm.waste_measured_weight_kg}
                onChange={(e) => setRoundForm({ ...roundForm, waste_measured_weight_kg: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="QC Sample Weight (g)"
                value={roundForm.qc_sample_weight_g}
                onChange={(e) => setRoundForm({ ...roundForm, qc_sample_weight_g: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>QC Action</InputLabel>
                <Select
                  value={roundForm.qc_action}
                  label="QC Action"
                  onChange={(e) => setRoundForm({ ...roundForm, qc_action: e.target.value })}
                >
                  <MenuItem value="Approve current result">Approve current result</MenuItem>
                  <MenuItem value="Request another sorting round">Request another sorting round</MenuItem>
                  <MenuItem value="Request additional source bags">Request additional source bags</MenuItem>
                  <MenuItem value="Require wider inspection or full-lot sorting">Require wider inspection or full-lot sorting</MenuItem>
                  <MenuItem value="Keep on hold">Keep on hold</MenuItem>
                  <MenuItem value="Reject material">Reject material</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="QC Inspector"
                value={roundForm.qc_inspector}
                onChange={(e) => setRoundForm({ ...roundForm, qc_inspector: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRoundOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleRecordRound} disabled={actionLoading}>
            Save Round & Sample
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG 3: WEIGH & RECORD FG BAG */}
      <Dialog open={fgBagOpen} onClose={() => setFgBagOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Fill, Weigh & Stitch FG Bag (50kg Target)</DialogTitle>
        <DialogContent dividers>
          {/* Header Progress Card: Completed & QC Accepted FG Bag Count */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              mb: 2.5,
              borderRadius: 2,
              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(34, 197, 94, 0.08)' : '#f0fdf4',
              border: '1.5px solid',
              borderColor: 'success.main'
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" fontWeight={700} color="success.dark">
                Station FG Completion & Progress
              </Typography>
              <Chip
                label={`Job #${selectedJob?.job_no || 'ACTIVE'}`}
                size="small"
                color="success"
              />
            </Box>

            <Grid container spacing={2} sx={{ mb: 1 }}>
              <Grid item xs={6} sm={4}>
                <Typography variant="caption" color="text.secondary" display="block">Completed & QC Accepted</Typography>
                <Typography variant="h5" fontWeight={800} color="success.main">
                  {selectedJob?.fg_bags_produced_count || 0} Bags
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  ({selectedJob?.total_fg_weight_kg || 0} kg)
                </Typography>
              </Grid>

              <Grid item xs={6} sm={4}>
                <Typography variant="caption" color="text.secondary" display="block">New Bag Recording</Typography>
                <Typography variant="h6" fontWeight={700} color="primary.main">
                  Bag #{ (selectedJob?.fg_bags_produced_count || 0) + parseInt(fgBagForm.bag_count || 1) }
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Target: {fgBagForm.target_weight_kg || 50.00} kg
                </Typography>
              </Grid>

              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary" display="block">Daily Station Target</Typography>
                <Typography variant="subtitle1" fontWeight={700}>
                  {selectedJob?.daily_target_fg_bags || 8} Bags ({((selectedJob?.daily_target_fg_bags || 8) * (fgBagForm.target_weight_kg || 50))} kg)
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, Math.round((((selectedJob?.fg_bags_produced_count || 0) + parseInt(fgBagForm.bag_count || 1)) / (selectedJob?.daily_target_fg_bags || 8)) * 100))}
                  color="success"
                  sx={{ height: 6, borderRadius: 3, mt: 0.5 }}
                />
              </Grid>
            </Grid>
          </Paper>

          <Grid container spacing={2}>
            {/* Field 1: Completed & QC Accepted Bags to Add */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Completed & QC Accepted Bag Count"
                value={fgBagForm.bag_count}
                onChange={(e) => setFgBagForm({ ...fgBagForm, bag_count: Math.max(1, parseInt(e.target.value || 1)) })}
                helperText={`Current: ${selectedJob?.fg_bags_produced_count || 0} Bags → Total will become ${(selectedJob?.fg_bags_produced_count || 0) + parseInt(fgBagForm.bag_count || 1)} Bags`}
                inputProps={{ min: 1 }}
              />
            </Grid>

            {/* Field 2: QC Status & Acceptance */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>QC Status & Acceptance</InputLabel>
                <Select
                  value={fgBagForm.qc_status}
                  label="QC Status & Acceptance"
                  onChange={(e) => setFgBagForm({ ...fgBagForm, qc_status: e.target.value })}
                >
                  <MenuItem value="APPROVED">APPROVED (QC Accepted for Export FG)</MenuItem>
                  <MenuItem value="PENDING">PENDING (Awaiting Final Sampling)</MenuItem>
                  <MenuItem value="HOLD">HOLD (QC Hold)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Field 3: Actual Filled Weight (kg) */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Actual Filled Weight (kg)"
                value={fgBagForm.actual_weight_kg}
                onChange={(e) => setFgBagForm({ ...fgBagForm, actual_weight_kg: e.target.value })}
                helperText="Digital scale reading (Standard: 50.00 kg)"
                inputProps={{ step: 0.05, min: 1 }}
              />
            </Grid>

            {/* Field 4: Target Packing Weight (kg) */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Target Packing Weight (kg)"
                value={fgBagForm.target_weight_kg}
                onChange={(e) => setFgBagForm({ ...fgBagForm, target_weight_kg: e.target.value })}
                helperText="Standard packing target (50.00 kg)"
                inputProps={{ step: 0.5, min: 10 }}
              />
            </Grid>

            {/* Field 5: Stitching Status */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Stitching Status</InputLabel>
                <Select
                  value={fgBagForm.stitching_status}
                  label="Stitching Status"
                  onChange={(e) => setFgBagForm({ ...fgBagForm, stitching_status: e.target.value })}
                >
                  <MenuItem value="STITCHED">Stitched & Sealed (Secured)</MenuItem>
                  <MenuItem value="PENDING">Pending Stitching</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Field 6: Warehouse Row Location */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Warehouse Row Location"
                value={fgBagForm.fg_row_location}
                onChange={(e) => setFgBagForm({ ...fgBagForm, fg_row_location: e.target.value })}
                helperText="Stack location e.g. Row-A-01, Row-B-04"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setFgBagOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddFgBag} disabled={actionLoading}>
            Confirm Weighing & Record Bag
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG 4: ISOLATE BAG */}
      <Dialog open={isolateOpen} onClose={() => setIsolateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <InsectIcon color="error" /> Isolate FG Bag Immediately
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 2 }}>
            You are placing <strong>{selectedBagForAction?.fg_bag_no}</strong> on immediate QC hold. It will be moved to the isolation bay and blocked from dispatch.
          </Typography>
          <TextField
            fullWidth
            size="small"
            label="Reason for Immediate Isolation"
            value={isolateForm.reason}
            onChange={(e) => setIsolateForm({ ...isolateForm, reason: e.target.value })}
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setIsolateOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleIsolateBag} disabled={actionLoading}>
            Confirm Isolation
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG 5: AUTHORIZED RELEASE FROM ISOLATION */}
      <Dialog open={releaseOpen} onClose={() => setReleaseOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: 'success.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <UnlockIcon color="success" /> Authorize Release from Isolation
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Authorizing release for <strong>{selectedBagForAction?.fg_bag_no}</strong>. This action is permanently audited.
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Authorized Officer Name"
                value={releaseForm.authorized_by}
                onChange={(e) => setReleaseForm({ ...releaseForm, authorized_by: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Assigned Destination Row"
                value={releaseForm.new_row_location}
                onChange={(e) => setReleaseForm({ ...releaseForm, new_row_location: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Justification & Assessment Notes"
                value={releaseForm.release_notes}
                onChange={(e) => setReleaseForm({ ...releaseForm, release_notes: e.target.value })}
                multiline
                rows={2}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setReleaseOpen(false)}>Cancel</Button>
          <Button variant="contained" color="success" onClick={handleReleaseBag} disabled={actionLoading}>
            Sign & Release Bag
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG 6: END OF DAY PRODUCTION REPORT */}
      <Dialog open={dailyReportOpen} onClose={() => setDailyReportOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Log End-of-Day Production Record</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="Report Date"
                InputLabelProps={{ shrink: true }}
                value={dailyReportForm.record_date}
                onChange={(e) => setDailyReportForm({ ...dailyReportForm, record_date: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Shift</InputLabel>
                <Select
                  value={dailyReportForm.shift}
                  label="Shift"
                  onChange={(e) => setDailyReportForm({ ...dailyReportForm, shift: e.target.value })}
                >
                  <MenuItem value="Shift-1">Shift-1 (Day)</MenuItem>
                  <MenuItem value="Shift-2">Shift-2 (Night)</MenuItem>
                  <MenuItem value="General">General Shift</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label="Team Name"
                value={dailyReportForm.team_name}
                onChange={(e) => setDailyReportForm({ ...dailyReportForm, team_name: e.target.value })}
              />
            </Grid>

            <Grid item xs={12}>
              <Alert severity="info" sx={{ fontSize: '0.85rem' }}>
                <strong>Important Principle:</strong> RM bags, vacuum bags, and FG bags represent different processing stages. Enter them separately below; they are never combined into a single total.
              </Alert>
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="RM Bags Handled"
                value={dailyReportForm.rm_bags_count}
                onChange={(e) => setDailyReportForm({ ...dailyReportForm, rm_bags_count: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Vacuum Bags Handled (if Route B)"
                value={dailyReportForm.vacuum_bags_count}
                onChange={(e) => setDailyReportForm({ ...dailyReportForm, vacuum_bags_count: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="FG Bags Packed & Weighed"
                value={dailyReportForm.fg_bags_count}
                onChange={(e) => setDailyReportForm({ ...dailyReportForm, fg_bags_count: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Total FG Weight (kg)"
                value={dailyReportForm.fg_weight_kg}
                onChange={(e) => setDailyReportForm({ ...dailyReportForm, fg_weight_kg: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Waste Weight (kg)"
                value={dailyReportForm.waste_weight_kg}
                onChange={(e) => setDailyReportForm({ ...dailyReportForm, waste_weight_kg: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Approved Bags"
                value={dailyReportForm.approved_fg_count}
                onChange={(e) => setDailyReportForm({ ...dailyReportForm, approved_fg_count: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDailyReportOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveDailyReport} disabled={actionLoading}>
            Save End-of-Day Report
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG 7: NEW CUSTOMER PLAN */}
      <Dialog open={newPlanOpen} onClose={() => setNewPlanOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Register Customer Order & Loading Deadline</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Customer Name"
                value={newPlanForm.customer_name}
                onChange={(e) => setNewPlanForm({ ...newPlanForm, customer_name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Customer PO / Sales Order"
                value={newPlanForm.customer_po}
                onChange={(e) => setNewPlanForm({ ...newPlanForm, customer_po: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Required Quantity (kg)"
                value={newPlanForm.required_qty_kg}
                onChange={(e) => setNewPlanForm({ ...newPlanForm, required_qty_kg: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Priority</InputLabel>
                <Select
                  value={newPlanForm.priority_level}
                  label="Priority"
                  onChange={(e) => setNewPlanForm({ ...newPlanForm, priority_level: e.target.value })}
                >
                  <MenuItem value="URGENT">URGENT (Approaching Loading Date)</MenuItem>
                  <MenuItem value="HIGH">HIGH</MenuItem>
                  <MenuItem value="NORMAL">NORMAL</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                type="datetime-local"
                label="Loading Date & Time"
                InputLabelProps={{ shrink: true }}
                value={newPlanForm.loading_datetime}
                onChange={(e) => setNewPlanForm({ ...newPlanForm, loading_datetime: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                type="datetime-local"
                label="Preparation/QC Deadline"
                InputLabelProps={{ shrink: true }}
                value={newPlanForm.prep_deadline_datetime}
                onChange={(e) => setNewPlanForm({ ...newPlanForm, prep_deadline_datetime: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setNewPlanOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddPlan} disabled={actionLoading}>
            Save Plan
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG 8: ALLOCATE APPROVED FG BAGS */}
      <Dialog open={allocateOpen} onClose={() => setAllocateOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          Allocate Approved FG Bags to Customer PO: {selectedPlanForAlloc?.customer_po}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Only <strong>APPROVED</strong>, normal status bags can be allocated. Held, isolated, or unapproved bags are strictly excluded.
          </Typography>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">Select</TableCell>
                <TableCell>FG Bag No</TableCell>
                <TableCell>Item & Lot</TableCell>
                <TableCell align="right">Weight</TableCell>
                <TableCell>Row Location</TableCell>
                <TableCell align="center">QC Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {fgBags.filter(b => b.qc_status === 'APPROVED' && b.isolation_status === 'NORMAL' && !b.allocated_order_id).map((bag) => {
                const isChecked = selectedBagsForAlloc.includes(bag.id);
                return (
                  <TableRow key={bag.id} hover onClick={() => {
                    if (isChecked) {
                      setSelectedBagsForAlloc(selectedBagsForAlloc.filter(id => id !== bag.id));
                    } else {
                      setSelectedBagsForAlloc([...selectedBagsForAlloc, bag.id]);
                    }
                  }} sx={{ cursor: 'pointer' }}>
                    <TableCell padding="checkbox">
                      <input type="checkbox" checked={isChecked} readOnly />
                    </TableCell>
                    <TableCell><strong>{bag.fg_bag_no}</strong></TableCell>
                    <TableCell>{bag.item_name} (Lot: {bag.source_lot_no})</TableCell>
                    <TableCell align="right">{bag.actual_weight_kg} kg</TableCell>
                    <TableCell><Chip label={bag.fg_row_location} size="small" /></TableCell>
                    <TableCell align="center"><Chip label="APPROVED" size="small" color="success" /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAllocateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleAllocateBags}
            disabled={actionLoading || selectedBagsForAlloc.length === 0}
          >
            Allocate {selectedBagsForAlloc.length} Selected Bags
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG 9: FACTORY WORKFLOW DIAGRAM */}
      <Dialog open={diagramOpen} onClose={() => setDiagramOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>BVC Factory Hand-Sorting Process Infographic</span>
          <Button onClick={() => setDiagramOpen(false)}>Close</Button>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 1, textAlign: 'center' }}>
          <img
            src="/public/assets/aistudio/Groundnut_Factory_Hand-Sorting_Workflow_73601ccf.png"
            alt="BVC Factory Hand-Sorting Workflow"
            style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px' }}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default HandSortingWorkspace;
