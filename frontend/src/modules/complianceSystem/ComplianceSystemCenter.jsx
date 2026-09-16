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
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  IconButton,
  CircularProgress,
  Divider,
  Tooltip
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import WarningIcon from '@mui/icons-material/Warning';
import ApprovalIcon from '@mui/icons-material/AssignmentTurnedIn';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import HistoryIcon from '@mui/icons-material/History';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import FilterListIcon from '@mui/icons-material/FilterList';
import axios from 'axios';

export default function ComplianceSystemCenter() {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [summary, setSummary] = useState({
    completed: 18,
    approved: 12,
    pending: 4,
    overdue: 2,
    inProgress: 3,
    scheduled: 5,
    rejected: 1,
    total: 24
  });

  const [departmentBreakdown, setDepartmentBreakdown] = useState([]);
  const [auditTrail, setAuditTrail] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');

  // Dialog State
  const [openScheduleModal, setOpenScheduleModal] = useState(false);
  const [openTaskModal, setOpenTaskModal] = useState(false);

  // Form State
  const [scheduleForm, setScheduleForm] = useState({
    task_name: '',
    task_type: 'CLEANING',
    module: 'Production',
    frequency: 'Daily',
    responsible_dept: 'Production',
    assigned_to: '',
    priority: 'Medium'
  });

  const [taskForm, setTaskForm] = useState({
    task_name: '',
    task_type: 'INSPECTION',
    module: 'Production',
    frequency: 'Daily',
    scheduled_date: new Date().toISOString().split('T')[0],
    due_date: new Date().toISOString().split('T')[0],
    assigned_to: '',
    priority: 'Medium',
    remarks: ''
  });

  const loadData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [dashRes, schRes, tskRes] = await Promise.all([
        axios.get('/api/compliance-system/dashboard'),
        axios.get('/api/compliance-system/schedules'),
        axios.get(`/api/compliance-system/tasks${statusFilter ? `?status=${statusFilter}` : ''}`)
      ]);

      if (dashRes.data.success) {
        setSummary(dashRes.data.summary || summary);
        setDepartmentBreakdown(dashRes.data.departmentBreakdown || []);
        setAuditTrail(dashRes.data.auditTrail || []);
      }
      if (schRes.data.success) {
        setSchedules(schRes.data.data || []);
      }
      if (tskRes.data.success) {
        setTasks(tskRes.data.data || []);
      }
    } catch (err) {
      console.error('Error loading compliance data:', err);
      setErrorMsg(err.response?.data?.error || err.message || 'Failed to load compliance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleGenerateTasks = async () => {
    setLoading(true);
    try {
      const res = await axios.post('/api/compliance-system/generate-tasks');
      if (res.data.success) {
        setSuccessMsg(res.data.message);
        loadData();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to generate automated tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      const res = await axios.put(`/api/compliance-system/tasks/${taskId}/status`, {
        status: newStatus,
        completed_by: 'Operator Lead',
        approved_by: 'Quality Supervisor',
        remarks: `Updated to ${newStatus}`
      });
      if (res.data.success) {
        setSuccessMsg(`Task status updated to ${newStatus}`);
        loadData();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Status update failed');
    }
  };

  const handleCreateSchedule = async () => {
    if (!scheduleForm.task_name) return;
    try {
      const res = await axios.post('/api/compliance-system/schedules', scheduleForm);
      if (res.data.success) {
        setSuccessMsg('Schedule master created successfully');
        setOpenScheduleModal(false);
        setScheduleForm({
          task_name: '',
          task_type: 'CLEANING',
          module: 'Production',
          frequency: 'Daily',
          responsible_dept: 'Production',
          assigned_to: '',
          priority: 'Medium'
        });
        loadData();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to create schedule');
    }
  };

  const handleCreateTask = async () => {
    if (!taskForm.task_name) return;
    try {
      const res = await axios.post('/api/compliance-system/tasks', taskForm);
      if (res.data.success) {
        setSuccessMsg('Task created successfully');
        setOpenTaskModal(false);
        setTaskForm({
          task_name: '',
          task_type: 'INSPECTION',
          module: 'Production',
          frequency: 'Daily',
          scheduled_date: new Date().toISOString().split('T')[0],
          due_date: new Date().toISOString().split('T')[0],
          assigned_to: '',
          priority: 'Medium',
          remarks: ''
        });
        loadData();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to create task');
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1600, margin: '0 auto' }}>
      {/* HEADER */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#1e293b' }}>
            Automated Compliance Center
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Task-driven food-safety, cleaning, inspection, and calibration automation
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadData}
            disabled={loading}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<PlayArrowIcon />}
            onClick={handleGenerateTasks}
            disabled={loading}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Generate Today's Tasks
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenTaskModal(true)}
            sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#1f4fb2' }}
          >
            New Task
          </Button>
        </Box>
      </Box>

      {errorMsg && (
        <Alert severity="error" onClose={() => setErrorMsg('')} sx={{ mb: 2 }}>
          {errorMsg}
        </Alert>
      )}
      {successMsg && (
        <Alert severity="success" onClose={() => setSuccessMsg('')} sx={{ mb: 2 }}>
          {successMsg}
        </Alert>
      )}

      {/* COMPLIANCE METRIC CARDS */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card
            onClick={() => setStatusFilter(statusFilter === 'Completed' ? '' : 'Completed')}
            sx={{
              p: 2,
              cursor: 'pointer',
              borderLeft: '4px solid #10b981',
              bgcolor: statusFilter === 'Completed' ? '#ecfdf5' : '#fff',
              boxShadow: 1
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                  COMPLETED / APPROVED
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: '#10b981', mt: 0.5 }}>
                  {summary.completed + summary.approved}
                </Typography>
              </Box>
              <CheckCircleIcon sx={{ fontSize: 38, color: '#10b981' }} />
            </Box>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            onClick={() => setStatusFilter(statusFilter === 'Scheduled' ? '' : 'Scheduled')}
            sx={{
              p: 2,
              cursor: 'pointer',
              borderLeft: '4px solid #3b82f6',
              bgcolor: statusFilter === 'Scheduled' ? '#eff6ff' : '#fff',
              boxShadow: 1
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                  PENDING / SCHEDULED
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: '#3b82f6', mt: 0.5 }}>
                  {summary.pending + summary.scheduled + summary.inProgress}
                </Typography>
              </Box>
              <PendingActionsIcon sx={{ fontSize: 38, color: '#3b82f6' }} />
            </Box>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            onClick={() => setStatusFilter(statusFilter === 'Overdue' ? '' : 'Overdue')}
            sx={{
              p: 2,
              cursor: 'pointer',
              borderLeft: '4px solid #ef4444',
              bgcolor: statusFilter === 'Overdue' ? '#fef2f2' : '#fff',
              boxShadow: 1
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                  OVERDUE TASKS
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: '#ef4444', mt: 0.5 }}>
                  {summary.overdue}
                </Typography>
              </Box>
              <WarningIcon sx={{ fontSize: 38, color: '#ef4444' }} />
            </Box>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            onClick={() => setStatusFilter(statusFilter === 'Pending Approval' ? '' : 'Pending Approval')}
            sx={{
              p: 2,
              cursor: 'pointer',
              borderLeft: '4px solid #f59e0b',
              bgcolor: statusFilter === 'Pending Approval' ? '#fffbeb' : '#fff',
              boxShadow: 1
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                  AWAITING APPROVAL
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: '#f59e0b', mt: 0.5 }}>
                  {summary.pending}
                </Typography>
              </Box>
              <ApprovalIcon sx={{ fontSize: 38, color: '#f59e0b' }} />
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* TABS & CONTAINER */}
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(e, val) => setActiveTab(val)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2, bgcolor: '#f8fafc' }}
        >
          <Tab label={`Compliance Tasks (${tasks.length})`} icon={<PendingActionsIcon />} iconPosition="start" />
          <Tab label="Schedule Master" icon={<EventRepeatIcon />} iconPosition="start" />
          <Tab label="Department Breakdown & Audit Log" icon={<HistoryIcon />} iconPosition="start" />
        </Tabs>

        {/* TAB 0: TASK LIST & EXECUTION */}
        {activeTab === 0 && (
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Active Compliance Tasks Execution
              </Typography>
              {statusFilter && (
                <Chip
                  label={`Filtered by: ${statusFilter}`}
                  onDelete={() => setStatusFilter('')}
                  color="primary"
                  size="small"
                />
              )}
            </Box>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead sx={{ bgcolor: 'grey.100' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Task Code</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Task Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Module</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Frequency</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Scheduled / Due</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Assignee</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Priority</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        No compliance tasks found matching criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    tasks.map((t) => (
                      <TableRow key={t.id} hover>
                        <TableCell sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{t.task_code}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{t.task_name}</TableCell>
                        <TableCell>
                          <Chip label={t.module} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>{t.frequency}</TableCell>
                        <TableCell sx={{ fontSize: '12px' }}>
                          {t.scheduled_date} → <b>{t.due_date}</b>
                        </TableCell>
                        <TableCell>{t.assigned_to || 'Unassigned'}</TableCell>
                        <TableCell>
                          <Chip
                            label={t.priority}
                            size="small"
                            color={t.priority === 'Critical' ? 'error' : t.priority === 'High' ? 'warning' : 'default'}
                            sx={{ fontWeight: 700, fontSize: '10px' }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={t.status}
                            size="small"
                            color={
                              t.status === 'Approved' ? 'success' :
                              t.status === 'Completed' ? 'success' :
                              t.status === 'Overdue' ? 'error' :
                              t.status === 'Pending Approval' ? 'warning' : 'primary'
                            }
                            sx={{ fontWeight: 700, fontSize: '11px' }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                            {t.status !== 'Approved' && t.status !== 'Completed' && (
                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                                sx={{ fontSize: '11px', textTransform: 'none', py: 0.2 }}
                                onClick={() => handleUpdateStatus(t.id, 'Completed')}
                              >
                                Complete
                              </Button>
                            )}
                            {t.status === 'Completed' && (
                              <Button
                                size="small"
                                variant="contained"
                                color="primary"
                                sx={{ fontSize: '11px', textTransform: 'none', py: 0.2 }}
                                onClick={() => handleUpdateStatus(t.id, 'Approved')}
                              >
                                Approve
                              </Button>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        )}

        {/* TAB 1: SCHEDULE MASTER */}
        {activeTab === 1 && (
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Compliance Schedule Masters
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setOpenScheduleModal(true)}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                New Schedule Master
              </Button>
            </Box>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead sx={{ bgcolor: 'grey.100' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Task Title</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Module / Dept</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Frequency</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Responsible</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Priority</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {schedules.map((s) => (
                    <TableRow key={s.id} hover>
                      <TableCell sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{s.schedule_code}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{s.task_name}</TableCell>
                      <TableCell>{s.task_type}</TableCell>
                      <TableCell>{s.module}</TableCell>
                      <TableCell>
                        <Chip label={s.frequency} color="info" size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>{s.assigned_to || s.responsible_dept}</TableCell>
                      <TableCell>{s.priority}</TableCell>
                      <TableCell>
                        <Chip label={s.is_active ? 'Active' : 'Disabled'} color={s.is_active ? 'success' : 'default'} size="small" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        )}

        {/* TAB 2: AUDIT LOG & BREAKDOWN */}
        {activeTab === 2 && (
          <CardContent sx={{ p: 3 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={5}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                  Departmental Compliance Standing
                </Typography>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  {departmentBreakdown.map((d, i) => (
                    <Box key={i} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {d.dept}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {d.approved} Approved / {d.total} Total
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                        <Chip label={`Overdue: ${d.overdue}`} size="small" color={d.overdue > 0 ? 'error' : 'default'} />
                        <Chip label={`Pending: ${d.pending}`} size="small" color={d.pending > 0 ? 'warning' : 'default'} />
                      </Box>
                      <Divider />
                    </Box>
                  ))}
                </Paper>
              </Grid>

              <Grid item xs={12} md={7}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                  Recent Compliance Audit Log
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead sx={{ bgcolor: 'grey.100' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Task</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>User</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Status Change</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Timestamp</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {auditTrail.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell sx={{ fontWeight: 600 }}>{log.task_code || `TSK-${log.task_id}`}</TableCell>
                          <TableCell>{log.action}</TableCell>
                          <TableCell>{log.changed_by}</TableCell>
                          <TableCell sx={{ fontSize: '11px' }}>
                            {log.old_value} → <b>{log.new_value}</b>
                          </TableCell>
                          <TableCell sx={{ fontSize: '11px', color: 'text.secondary' }}>{log.created_at}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            </Grid>
          </CardContent>
        )}
      </Card>

      {/* CREATE SCHEDULE MODAL */}
      <Dialog open={openScheduleModal} onClose={() => setOpenScheduleModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Create Compliance Schedule Master</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Task Title"
              value={scheduleForm.task_name}
              onChange={(e) => setScheduleForm({ ...scheduleForm, task_name: e.target.value })}
              fullWidth
              required
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  select
                  label="Task Type"
                  value={scheduleForm.task_type}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, task_type: e.target.value })}
                  fullWidth
                >
                  <MenuItem value="CLEANING">Cleaning & Sanitization</MenuItem>
                  <MenuItem value="PEST_CONTROL">Pest Control</MenuItem>
                  <MenuItem value="CALIBRATION">Equipment Calibration</MenuItem>
                  <MenuItem value="INSPECTION">Food Safety Inspection</MenuItem>
                  <MenuItem value="SAFETY">Safety Audit</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  select
                  label="Frequency"
                  value={scheduleForm.frequency}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, frequency: e.target.value })}
                  fullWidth
                >
                  <MenuItem value="Daily">Daily</MenuItem>
                  <MenuItem value="Weekly">Weekly</MenuItem>
                  <MenuItem value="Monthly">Monthly</MenuItem>
                  <MenuItem value="Quarterly">Quarterly</MenuItem>
                  <MenuItem value="Yearly">Yearly</MenuItem>
                </TextField>
              </Grid>
            </Grid>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  select
                  label="Module / Dept"
                  value={scheduleForm.module}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, module: e.target.value })}
                  fullWidth
                >
                  <MenuItem value="Production">Production</MenuItem>
                  <MenuItem value="Warehouse">Warehouse</MenuItem>
                  <MenuItem value="QC">QC & Food Safety</MenuItem>
                  <MenuItem value="Maintenance">Maintenance</MenuItem>
                  <MenuItem value="Admin">Administration</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Assigned User / Role"
                  value={scheduleForm.assigned_to}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, assigned_to: e.target.value })}
                  fullWidth
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenScheduleModal(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateSchedule}>Save Schedule</Button>
        </DialogActions>
      </Dialog>

      {/* CREATE SINGLE TASK MODAL */}
      <Dialog open={openTaskModal} onClose={() => setOpenTaskModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Create New Compliance Task</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Task Title"
              value={taskForm.task_name}
              onChange={(e) => setTaskForm({ ...taskForm, task_name: e.target.value })}
              fullWidth
              required
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  type="date"
                  label="Scheduled Date"
                  value={taskForm.scheduled_date}
                  onChange={(e) => setTaskForm({ ...taskForm, scheduled_date: e.target.value })}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  type="date"
                  label="Due Date"
                  value={taskForm.due_date}
                  onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  select
                  label="Module / Dept"
                  value={taskForm.module}
                  onChange={(e) => setTaskForm({ ...taskForm, module: e.target.value })}
                  fullWidth
                >
                  <MenuItem value="Production">Production</MenuItem>
                  <MenuItem value="Warehouse">Warehouse</MenuItem>
                  <MenuItem value="QC">QC & Food Safety</MenuItem>
                  <MenuItem value="Maintenance">Maintenance</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Assigned Operator"
                  value={taskForm.assigned_to}
                  onChange={(e) => setTaskForm({ ...taskForm, assigned_to: e.target.value })}
                  fullWidth
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenTaskModal(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateTask}>Create Task</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
