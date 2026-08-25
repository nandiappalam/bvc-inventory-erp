import React, { useState, useEffect } from 'react';
import {
  Box,
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
  IconButton,
  TextField,
  MenuItem,
  CircularProgress,
  Tooltip,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Divider,
  Alert,
  Switch,
  FormControlLabel,
  RadioGroup,
  Radio,
  FormControl,
  FormLabel,
  Stack,
  Badge
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PrintIcon from '@mui/icons-material/Print';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import EventNoteIcon from '@mui/icons-material/EventNote';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import ScheduleIcon from '@mui/icons-material/Schedule';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import BugReportIcon from '@mui/icons-material/BugReport';
import EngineeringIcon from '@mui/icons-material/Engineering';
import BadgeIcon from '@mui/icons-material/Badge';
import InventoryIcon from '@mui/icons-material/Inventory';
import WcIcon from '@mui/icons-material/Wc';
import PersonPinIcon from '@mui/icons-material/PersonPin';
import ShieldIcon from '@mui/icons-material/Shield';
import PaletteIcon from '@mui/icons-material/Palette';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CleaningPaperPrintModal from './CleaningPaperPrintModal';
import CleaningPaperCreationForm from './CleaningPaperCreationForm';
import { CLEANING_RECORDS, INVENTORY_PRESETS, getInitialChecklistForCode } from './cleaningData';

export default function CleaningControlList({ onRefresh }) {
  const [activeTab, setActiveTab] = useState(0); // 0: Register, 1: Schedule Summary, 2: Form
  const [records, setRecords] = useState([]);
  const [scheduleSummary, setScheduleSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [selectedCode, setSelectedCode] = useState('ALL');
  
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Dialog & View state
  const [viewingRecord, setViewingRecord] = useState(null);
  const [isBlankPrint, setIsBlankPrint] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form State
  const [formState, setFormState] = useState(getInitialFormState('C1'));

  function getInitialFormState(code = 'C1') {
    const today = new Date().toISOString().split('T')[0];
    const recNo = `${code}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const meta = CLEANING_RECORDS.find(r => r.code === code) || CLEANING_RECORDS[1] || { target: 'Factory Premises', freq: 'Daily', docRef: '' };
    const defaultChecklist = getInitialChecklistForCode(code);

    let defaultInspector = 'Sanitation Officer';
    let defaultSupervisor = 'Plant Supervisor';

    if (code === 'C7') {
      defaultInspector = 'House Keeper';
      defaultSupervisor = 'HR MANAGER';
    } else if (code === 'C8') {
      defaultInspector = 'Security Officer';
      defaultSupervisor = 'Dispatch Clerk';
    } else if (code === 'C9') {
      defaultInspector = 'QMR';
      defaultSupervisor = 'Managing Director';
    } else if (code === 'C10') {
      defaultInspector = 'QC Inspector';
      defaultSupervisor = 'QA Head';
    } else if (code === 'C11' || code === 'C12') {
      defaultInspector = 'QA Officer';
      defaultSupervisor = 'QA Manager';
    } else if (code === 'C13') {
      defaultInspector = 'Mr. Y (Pest Officer)';
      defaultSupervisor = 'Mr. X (FSTL)';
    } else if (code === 'C14') {
      defaultInspector = 'Operator';
      defaultSupervisor = 'Plant Incharge';
    }

    return {
      record_code: code,
      record_no: recNo,
      record_date: today,
      area_location: meta.target || 'Factory Premises',
      frequency: meta.freq || 'Daily',
      company_name: 'BVC Exports Pvt. Ltd.',
      financial_year: '2026-2027',
      inspector_name: defaultInspector,
      supervisor_name: defaultSupervisor,
      prepared_by: defaultInspector,
      verified_by: defaultSupervisor,
      customer_name: defaultChecklist.customer_qty || '',
      supplier_name: defaultChecklist.supplier || '',
      vehicle_no: defaultChecklist.vehicle_no || '',
      status: 'COMPLETED',
      overall_status: 'PASS',
      corrective_action: 'None required. Standard operational compliance maintained.',
      remarks: `${meta.label || code} inspected and found compliant with ISO 22000:2018 / BVC SOP.`,
      checklist: defaultChecklist
    };
  }

  // Fetch cleaning records
  const fetchRecords = async () => {
    try {
      setLoading(true);
      let url = `/api/compliance/cleaning-records?record_code=${selectedCode}`;
      if (statusFilter !== 'ALL') url += `&overall_status=${statusFilter}`;
      if (fromDate) url += `&from_date=${fromDate}`;
      if (toDate) url += `&to_date=${toDate}`;
      if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setRecords(data.records || []);
      }
    } catch (err) {
      console.error('Error fetching cleaning records:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch cleaning schedule summary
  const fetchScheduleSummary = async () => {
    try {
      setScheduleLoading(true);
      const res = await fetch('/api/compliance/cleaning-schedule-summary');
      const data = await res.json();
      if (data.success) {
        setScheduleSummary(data.summary || []);
      }
    } catch (err) {
      console.error('Error fetching schedule summary:', err);
    } finally {
      setScheduleLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [selectedCode, statusFilter, fromDate, toDate]);

  useEffect(() => {
    fetchScheduleSummary();
  }, []);

  const handleResetFilters = () => {
    setSelectedCode('ALL');
    setStatusFilter('ALL');
    setFromDate('');
    setToDate('');
    setSearchTerm('');
  };

  const handleCodeSelect = (code) => {
    setSelectedCode(code);
    if (activeTab !== 0) setActiveTab(0);
  };

  const handleStartNewRecord = (code = 'C1') => {
    setIsEditing(false);
    setEditingId(null);
    setFormState(getInitialFormState(code));
    setActiveTab(2); // switch to Form tab
  };

  const handleEditRecord = (record) => {
    setIsEditing(true);
    setEditingId(record.id);
    setFormState({
      record_code: record.record_code,
      record_no: record.record_no,
      record_date: record.record_date,
      area_location: record.area_location || '',
      frequency: record.frequency || 'Daily',
      company_name: record.company_name || 'BVC Exports Pvt. Ltd.',
      financial_year: record.financial_year || '2026-2027',
      inspector_name: record.inspector_name || '',
      supervisor_name: record.supervisor_name || '',
      prepared_by: record.prepared_by || '',
      verified_by: record.verified_by || '',
      customer_name: record.customer_name || '',
      supplier_name: record.supplier_name || '',
      vehicle_no: record.vehicle_no || '',
      status: record.status || 'COMPLETED',
      overall_status: record.overall_status || 'PASS',
      corrective_action: record.corrective_action || '',
      remarks: record.remarks || '',
      checklist: record.checklist || {}
    });
    setActiveTab(2);
  };

  const handleDeleteRecord = async (id) => {
    if (!window.confirm('Are you sure you want to delete this cleaning checklist record?')) return;
    try {
      const res = await fetch(`/api/compliance/cleaning-records/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchRecords();
        fetchScheduleSummary();
      }
    } catch (err) {
      console.error('Error deleting record:', err);
    }
  };

  const handleApplyInventoryPreset = (presetName) => {
    const preset = INVENTORY_PRESETS.find(p => p.name === presetName);
    if (!preset) return;
    
    // Switch to code if different
    let currentInitial = formState;
    if (formState.record_code !== preset.code) {
      currentInitial = getInitialFormState(preset.code);
    }

    const mergedChecklist = { ...(currentInitial.checklist || {}), ...preset.data };

    setFormState({
      ...currentInitial,
      record_code: preset.code,
      area_location: preset.data.area_location || currentInitial.area_location,
      inspector_name: preset.data.inspector_name || formState.inspector_name || '',
      supervisor_name: preset.data.supervisor_name || formState.supervisor_name || '',
      customer_name: preset.data.customer_name || currentInitial.customer_name || '',
      supplier_name: preset.data.supplier_name || currentInitial.supplier_name || '',
      vehicle_no: preset.data.vehicle_no || currentInitial.vehicle_no || '',
      checklist: mergedChecklist
    });
  };

  const handleQuickMarkAllOk = () => {
    const code = formState.record_code;
    const currentChk = { ...(formState.checklist || {}) };

    if (code === 'C1' && currentChk.cleaning_points) {
      currentChk.cleaning_points = currentChk.cleaning_points.map(p => ({ ...p, status: 'OK', remarks: 'Clean & sanitised' }));
    } else if (['C2', 'C3', 'C4', 'C5', 'C6'].includes(code) && currentChk.cleaning_items) {
      currentChk.cleaning_items = currentChk.cleaning_items.map(p => ({ ...p, status: 'OK', remarks: 'Activity verified OK' }));
    } else if (code === 'C2' && currentChk.parameters) {
      currentChk.parameters = currentChk.parameters.map(p => ({ ...p, result: 'OK', remarks: 'Compliant' }));
    } else if (code === 'C3' && currentChk.parameters) {
      currentChk.parameters = currentChk.parameters.map(p => ({ ...p, status: 'OK', condition: 'Secure' }));
    } else if (code === 'C4' && currentChk.parameters) {
      currentChk.parameters = currentChk.parameters.map(p => ({ ...p, result: 'Pass', remarks: 'Sanitized' }));
    } else if (code === 'C5' && currentChk.windows) {
      currentChk.windows = currentChk.windows.map(w => ({ ...w, status: 'OK', integrity: 'Intact', remarks: 'Cleaned with Colin' }));
    } else if (code === 'C6' && currentChk.steps) {
      currentChk.steps = currentChk.steps.map(s => ({ ...s, status: 'OK' }));
    } else if (code === 'C7' && currentChk.checklist) {
      currentChk.checklist = currentChk.checklist.map(c => ({ ...c, status: 'Yes', remarks: 'Clean & available' }));
    } else if (code === 'C8' && currentChk.checklist) {
      currentChk.checklist = currentChk.checklist.map(c => ({ ...c, ok: true, not_ok: false, remarks: 'Verified OK' }));
    } else if (code === 'C9' && currentChk.employees) {
      currentChk.employees = currentChk.employees.map(e => ({
        ...e,
        uniform: 'Yes',
        hairnet: 'Yes',
        clean_hands: 'Yes',
        trimmed_nails: 'Yes',
        no_jewelry: 'Yes',
        footwear: 'Yes',
        health: 'Fit',
        status: 'PASS',
        remarks: 'Compliant'
      }));
    } else if (code === 'C10' && currentChk.parameters) {
      currentChk.parameters = currentChk.parameters.map(p => ({ ...p, result: 'Pass', observed: 'Conforms to standard' }));
    }

    setFormState({
      ...formState,
      overall_status: 'PASS',
      checklist: currentChk
    });
  };

  const handleSaveForm = async (e, autoPrint = false) => {
    if (e && e.preventDefault) e.preventDefault();
    try {
      const url = isEditing
        ? `/api/compliance/cleaning-records/${editingId}`
        : '/api/compliance/cleaning-records';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formState)
      });
      const data = await res.json();
      if (data.success) {
        fetchRecords();
        fetchScheduleSummary();
        if (onRefresh) onRefresh();

        if (autoPrint) {
          const savedData = data.record || formState;
          setViewingRecord(savedData);
          setIsBlankPrint(false);
        } else {
          alert(isEditing ? 'Cleaning record updated successfully!' : 'Cleaning record saved successfully!');
          setActiveTab(0); // return to register
        }
      } else {
        alert(`Error: ${data.message || data.error}`);
      }
    } catch (err) {
      console.error('Error saving cleaning record:', err);
      alert('Failed to save cleaning record.');
    }
  };

  // Helper for status badge rendering
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'PASS':
      case 'COMPLIANT':
        return <Chip icon={<CheckCircleIcon />} label="PASS / COMPLIANT" size="small" color="success" sx={{ fontWeight: 600 }} />;
      case 'ACTION_REQUIRED':
      case 'DUE_SOON':
      case 'DUE_TODAY':
        return <Chip icon={<WarningAmberIcon />} label={status.replace('_', ' ')} size="small" color="warning" sx={{ fontWeight: 600 }} />;
      case 'FAIL':
      case 'OVERDUE':
        return <Chip icon={<ErrorOutlineIcon />} label={status} size="small" color="error" sx={{ fontWeight: 600 }} />;
      case 'EVENT_TRIGGERED':
        return <Chip label="ON EVENT (LOADING/RECEIVING)" size="small" color="info" sx={{ fontWeight: 600 }} />;
      default:
        return <Chip label={status || 'COMPLETED'} size="small" variant="outlined" />;
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!records.length) return alert('No records to export');
    const headers = ['Record Code', 'Record No', 'Date', 'Frequency', 'Area/Location', 'Inspector', 'Supervisor', 'Overall Status', 'Remarks'];
    const rows = records.map(r => [
      r.record_code,
      r.record_no,
      r.record_date,
      r.frequency,
      `"${(r.area_location || '').replace(/"/g, '""')}"`,
      `"${(r.inspector_name || '').replace(/"/g, '""')}"`,
      `"${(r.supervisor_name || '').replace(/"/g, '""')}"`,
      r.overall_status,
      `"${(r.remarks || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `BVC_Cleaning_Records_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Box sx={{ width: '100%', pb: 4 }}>
      {/* Top Header Card */}
      <Paper elevation={2} sx={{ p: 2.5, mb: 3, borderRadius: 2, borderLeft: '6px solid #1976d2' }}>
        <Grid container alignItems="center" justifyContent="space-between" spacing={2}>
          <Grid item xs={12} md={7}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <CleaningServicesIcon color="primary" sx={{ fontSize: 36 }} />
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#1a237e' }}>
                  BVC Exports Pvt. Ltd. — Cleaning & Control Records (C1–C10)
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  ISO 22000:2018 & FSSAI Compliant Sanitation, Pest, Pallet, Vehicle, Glass, Machinery & Hygiene Registers
                </Typography>
              </Box>
            </Stack>
          </Grid>
          <Grid item xs={12} md={5}>
            <Stack direction="row" spacing={1.5} justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => { fetchRecords(); fetchScheduleSummary(); }}
                size="small"
              >
                Refresh
              </Button>
              <Button
                variant="outlined"
                startIcon={<FileDownloadIcon />}
                onClick={handleExportCSV}
                size="small"
                color="secondary"
              >
                Export CSV
              </Button>
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={() => {
                  setViewingRecord(getInitialFormState(selectedCode === 'ALL' ? 'C1' : selectedCode));
                  setIsBlankPrint(true);
                }}
                size="small"
                color="primary"
                sx={{ fontWeight: 600 }}
              >
                Print Blank Paper Form
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleStartNewRecord(selectedCode === 'ALL' ? 'C1' : selectedCode)}
                size="small"
                sx={{ bgcolor: '#1976d2', '&:hover': { bgcolor: '#1565c0' }, fontWeight: 700 }}
              >
                + New Checklist Entry
              </Button>
            </Stack>
          </Grid>
        </Grid>

        {/* View Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 2.5 }}>
          <Tabs
            value={activeTab}
            onChange={(e, val) => setActiveTab(val)}
            textColor="primary"
            indicatorColor="primary"
          >
            <Tab icon={<FactCheckIcon fontSize="small" />} iconPosition="start" label="Cleaning Records Register" />
            <Tab icon={<ScheduleIcon fontSize="small" />} iconPosition="start" label="C1–C10 Schedule & Due Dates" />
            <Tab icon={<AddIcon fontSize="small" />} iconPosition="start" label={isEditing ? 'Edit Checklist Record' : 'Create Checklist Entry'} />
          </Tabs>
        </Box>
      </Paper>

      {/* Proactive Audit & Frequency Notification Banner */}
      {(() => {
        const overdueList = scheduleSummary.filter(s => s.scheduleStatus === 'OVERDUE');
        const dueTodayList = scheduleSummary.filter(s => s.scheduleStatus === 'DUE_TODAY' || s.scheduleStatus === 'DUE_SOON');
        if (overdueList.length === 0 && dueTodayList.length === 0) return null;
        return (
          <Box sx={{ mb: 3 }}>
            {overdueList.length > 0 && (
              <Alert
                severity="error"
                icon={<ErrorOutlineIcon />}
                action={
                  <Button color="inherit" size="small" onClick={() => setActiveTab(1)}>
                    View Schedule Matrix
                  </Button>
                }
                sx={{ mb: 1.5, borderRadius: 2 }}
              >
                <strong>Compliance Attention Required ({overdueList.length} Overdue):</strong>{' '}
                {overdueList.map(o => `${o.code} (${o.name} - Mandated: ${o.frequency})`).join(' • ')} — Immediate inspection update required!
              </Alert>
            )}
            {dueTodayList.length > 0 && (
              <Alert
                severity="warning"
                icon={<WarningAmberIcon />}
                action={
                  <Button color="inherit" size="small" onClick={() => setActiveTab(1)}>
                    View Due Dates
                  </Button>
                }
                sx={{ borderRadius: 2 }}
              >
                <strong>Checklists Due for Inspection ({dueTodayList.length}):</strong>{' '}
                {dueTodayList.map(d => `${d.code} (${d.name} - Next Due: ${d.nextDueDate || 'Today'})`).join(' • ')}
              </Alert>
            )}
          </Box>
        );
      })()}

      {/* C1 to C10 Frequency Quick Filter Bar */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: '#455a64' }}>
          Select Cleaning Record Format (C1–C10):
        </Typography>
        <Grid container spacing={1}>
          {CLEANING_RECORDS.map((item) => {
            const isSelected = selectedCode === item.code;
            return (
              <Grid item xs={6} sm={4} md={2.4} key={item.code}>
                <Card
                  onClick={() => handleCodeSelect(item.code)}
                  sx={{
                    cursor: 'pointer',
                    p: 1.2,
                    borderRadius: 1.5,
                    border: isSelected ? '2px solid #1976d2' : '1px solid #e0e0e0',
                    bgcolor: isSelected ? '#e3f2fd' : '#ffffff',
                    transition: 'all 0.2s',
                    '&:hover': { boxShadow: 3, transform: 'translateY(-2px)' }
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ color: item.color || '#1976d2' }}>
                      {item.icon}
                    </Box>
                    <Box sx={{ overflow: 'hidden' }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', noWrap: true }}>
                        {item.code} {item.code !== 'ALL' && `— ${item.freq}`}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {item.label.replace(`${item.code}: `, '')}
                      </Typography>
                    </Box>
                  </Stack>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Box>

      {/* TAB 0: CLEANING RECORDS REGISTER */}
      {activeTab === 0 && (
        <Box>
          {/* Search & Filter Bar */}
          <Paper sx={{ p: 2, mb: 3, bgcolor: '#f8fafc', borderRadius: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6} md={3.5}>
                <TextField
                  fullWidth
                  size="small"
                  label="Search Record # / Area / Inspector / Notes"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchRecords()}
                  InputProps={{
                    endAdornment: (
                      <IconButton size="small" onClick={fetchRecords}>
                        <SearchIcon fontSize="small" />
                      </IconButton>
                    )
                  }}
                />
              </Grid>
              <Grid item xs={6} sm={3} md={2}>
                <TextField
                  fullWidth
                  select
                  size="small"
                  label="Result Status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="ALL">All Results</MenuItem>
                  <MenuItem value="PASS">PASS</MenuItem>
                  <MenuItem value="ACTION_REQUIRED">ACTION REQUIRED</MenuItem>
                  <MenuItem value="FAIL">FAIL</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={6} sm={3} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="From Date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6} sm={3} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="To Date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6} sm={3} md={2.5}>
                <Stack direction="row" spacing={1}>
                  <Button variant="contained" size="small" onClick={fetchRecords} sx={{ flex: 1 }}>
                    Filter
                  </Button>
                  <Button variant="outlined" size="small" onClick={handleResetFilters}>
                    Reset
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </Paper>

          {/* Records Table */}
          <TableContainer component={Paper} elevation={1} sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>S.No</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Format Code</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Record No</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Frequency</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Area / Location</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Inspector / Verified By</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Result</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                      <CircularProgress size={32} />
                      <Typography variant="body2" sx={{ mt: 1 }}>Loading BVC Cleaning Records...</Typography>
                    </TableCell>
                  </TableRow>
                ) : records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                      <Typography variant="body1" color="text.secondary">
                        No cleaning records found for the selected criteria.
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => handleStartNewRecord(selectedCode === 'ALL' ? 'C1' : selectedCode)}
                        sx={{ mt: 1.5 }}
                      >
                        Create New Entry
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((r, idx) => (
                    <TableRow key={r.id} hover>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{r.record_date}</TableCell>
                      <TableCell>
                        <Chip
                          label={r.record_code}
                          size="small"
                          color={r.record_code === 'C1' ? 'primary' : r.record_code === 'C4' ? 'error' : r.record_code === 'C5' ? 'secondary' : 'default'}
                          sx={{ fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.record_no}</TableCell>
                      <TableCell>{r.frequency}</TableCell>
                      <TableCell>{r.area_location || r.customer_name || r.vehicle_no || '-'}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{r.inspector_name || '-'}</Typography>
                        <Typography variant="caption" color="text.secondary">Ver: {r.verified_by || '-'}</Typography>
                      </TableCell>
                      <TableCell>{renderStatusBadge(r.overall_status)}</TableCell>
                      <TableCell>
                        <Chip label={r.status || 'COMPLETED'} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={0.5} justifyContent="center">
                          <Tooltip title="Print Official BVC Paper Record">
                            <IconButton
                              size="small"
                              sx={{ color: '#0f172a' }}
                              onClick={() => {
                                setViewingRecord(r);
                                setIsBlankPrint(false);
                              }}
                            >
                              <PrintIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="View Certificate Preview">
                            <IconButton size="small" color="primary" onClick={() => { setViewingRecord(r); setIsBlankPrint(false); }}>
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit Record">
                            <IconButton size="small" color="info" onClick={() => handleEditRecord(r)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Record">
                            <IconButton size="small" color="error" onClick={() => handleDeleteRecord(r.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* TAB 1: SCHEDULE & DUE DATES OVERVIEW */}
      {activeTab === 1 && (
        <Box>
          <Paper elevation={1} sx={{ p: 2, mb: 3, bgcolor: '#f8fafc', borderRadius: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#1a237e', mb: 1 }}>
              BVC Sanitation & Preventive Inspection Matrix (C1–C10 Compliance Schedule)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Real-time audit tracking based on predefined statutory frequencies (Daily, 15 Days Once, Monthly Once, Event Triggered).
            </Typography>
          </Paper>

          <Grid container spacing={2}>
            {scheduleSummary.map((item) => (
              <Grid item xs={12} md={6} lg={4} key={item.code}>
                <Card sx={{ height: '100%', borderLeft: `6px solid ${item.scheduleStatus === 'OVERDUE' ? '#d32f2f' : item.scheduleStatus === 'DUE_TODAY' || item.scheduleStatus === 'DUE_SOON' ? '#ed6c02' : '#2e7d32'}`, boxShadow: 2 }}>
                  <CardContent sx={{ pb: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip label={item.code} color="primary" size="small" sx={{ fontWeight: 700 }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{item.name}</Typography>
                      </Stack>
                      {renderStatusBadge(item.scheduleStatus)}
                    </Stack>

                    <Divider sx={{ my: 1 }} />

                    <Grid container spacing={1} sx={{ fontSize: '0.85rem', mt: 0.5 }}>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary" display="block">Mandated Frequency:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.frequency}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary" display="block">Target Scope:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.target}</Typography>
                      </Grid>

                      <Grid item xs={6} sx={{ mt: 1 }}>
                        <Typography variant="caption" color="text.secondary" display="block">Last Completed:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#1b5e20' }}>
                          {item.lastCompletedDate || 'No Record'}
                        </Typography>
                      </Grid>
                      <Grid item xs={6} sx={{ mt: 1 }}>
                        <Typography variant="caption" color="text.secondary" display="block">Next Due Date:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: item.daysRemaining < 0 ? '#d32f2f' : '#0d47a1' }}>
                          {item.nextDueDate || (item.intervalDays === 0 ? 'On Next Event' : 'Pending Initial Audit')}
                        </Typography>
                      </Grid>
                    </Grid>

                    <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px dashed #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        {item.lastRecord ? `Last Ref: ${item.lastRecord.record_no}` : 'Awaiting entry'}
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={() => handleStartNewRecord(item.code)}
                      >
                        Log Now
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* TAB 2: OFFICIAL PAPER CREATION WORKSHEET */}
      {activeTab === 2 && (
        <CleaningPaperCreationForm
          formState={formState}
          setFormState={setFormState}
          handleSaveForm={handleSaveForm}
          onCancel={() => setActiveTab(0)}
          onOpenPrintPreview={(isBlank) => {
            setViewingRecord(formState);
            setIsBlankPrint(isBlank);
          }}
          handleApplyInventoryPreset={handleApplyInventoryPreset}
          handleQuickMarkAllOk={handleQuickMarkAllOk}
          inventoryPresets={INVENTORY_PRESETS}
          cleaningRecords={CLEANING_RECORDS}
          isEditing={isEditing}
        />
      )}

      {/* OFFICIAL BVC PAPER FORMAT PRINT MODAL */}
      <CleaningPaperPrintModal
        open={Boolean(viewingRecord)}
        record={viewingRecord}
        isBlank={isBlankPrint}
        onClose={() => {
          setViewingRecord(null);
          setIsBlankPrint(false);
        }}
      />
    </Box>
  );
}
