import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  LinearProgress,
  CircularProgress,
  Stack
} from '@mui/material';
import {
  Add as AddIcon,
  Dashboard as DashboardIcon,
  HourglassTop as PendingIcon,
  CheckCircle as ApprovedIcon,
  Cancel as RejectedIcon,
  ShoppingCart as PRHeaderIcon,
  TrendingUp as TrendIcon,
  Assessment as ReportsIcon,
  RateReview as ReviewIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api.js';

const PurchaseRequestDashboard = () => {
  const navigate = useNavigate();

  const [metrics, setMetrics] = useState({
    today_requests: 0,
    pending_approvals: 0,
    urgent_pending: 0,
    approved_today: 0,
    rejected_today: 0,
    monthly_total: 0,
    monthly_value: 0
  });

  const [recentRequests, setRecentRequests] = useState([]);
  const [departmentStats, setDepartmentStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const data = await api('/purchase-requests/dashboard/metrics');
      if (data) {
        if (data.metrics) setMetrics(data.metrics);
        if (Array.isArray(data.recent_requests)) setRecentRequests(data.recent_requests);
        if (Array.isArray(data.department_stats)) setDepartmentStats(data.department_stats);
      }
    } catch (err) {
      console.error('Error loading PR dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusChip = (st) => {
    switch (st) {
      case 'Approved':
        return <Chip label="Approved" color="success" size="small" sx={{ fontWeight: 'bold' }} />;
      case 'Submitted':
        return <Chip label="Submitted" color="warning" size="small" sx={{ fontWeight: 'bold' }} />;
      case 'Rejected':
        return <Chip label="Rejected" color="error" size="small" sx={{ fontWeight: 'bold' }} />;
      default:
        return <Chip label={st || 'Draft'} variant="outlined" size="small" />;
    }
  };

  return (
    <Box sx={{ p: 2, backgroundColor: '#f4f6f9', minHeight: '100vh' }}>
      {/* Top Banner */}
      <Paper
        elevation={2}
        sx={{
          p: 2.5,
          mb: 3,
          backgroundColor: '#1f4fb2',
          color: '#ffffff',
          borderRadius: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <DashboardIcon sx={{ fontSize: 36 }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              Purchase Request Executive Dashboard
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Real-time monitoring of purchase requisitions, approval flows, and material demands
            </Typography>
          </Box>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="contained"
            sx={{ backgroundColor: '#ffffff', color: '#1f4fb2', fontWeight: 'bold', '&:hover': { backgroundColor: '#eaf2fb' } }}
            startIcon={<AddIcon />}
            onClick={() => navigate('/entry/purchase-request-create')}
          >
            Create PR
          </Button>
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<ReviewIcon />}
            onClick={() => navigate('/entry/purchase-request-approval')}
            sx={{ borderColor: 'rgba(255,255,255,0.7)', '&:hover': { borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.1)' } }}
          >
            Approvals ({metrics.pending_approvals})
          </Button>
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<ReportsIcon />}
            onClick={() => navigate('/entry/purchase-request-reports')}
            sx={{ borderColor: 'rgba(255,255,255,0.7)', '&:hover': { borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.1)' } }}
          >
            Reports
          </Button>
        </Stack>
      </Paper>

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2} sx={{ borderRadius: 1.5, borderLeft: '5px solid #1f4fb2' }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                TODAY'S REQUISITIONS
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#1f4fb2', my: 0.5 }}>
                {metrics.today_requests}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Submitted in the last 24 hours
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2} sx={{ borderRadius: 1.5, borderLeft: '5px solid #ff9800' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                  PENDING APPROVAL
                </Typography>
                {metrics.urgent_pending > 0 && (
                  <Chip label={`${metrics.urgent_pending} Urgent`} color="error" size="small" sx={{ fontWeight: 'bold' }} />
                )}
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#ff9800', my: 0.5 }}>
                {metrics.pending_approvals}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Awaiting Manager Authorization
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2} sx={{ borderRadius: 1.5, borderLeft: '5px solid #4caf50' }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                APPROVED TODAY
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#4caf50', my: 0.5 }}>
                {metrics.approved_today}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Ready for PO conversion
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2} sx={{ borderRadius: 1.5, borderLeft: '5px solid #9c27b0' }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                THIS MONTH'S ESTIMATED VALUE
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#9c27b0', my: 0.5 }}>
                ₹{(metrics.monthly_value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Total across {metrics.monthly_total} requisitions
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Dashboard Grid */}
      <Grid container spacing={3}>
        {/* Recent Purchase Requests */}
        <Grid item xs={12} md={8}>
          <Card elevation={2} sx={{ borderRadius: 1.5 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#1f4fb2', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PRHeaderIcon fontSize="small" /> Recent Purchase Requisitions
                </Typography>
                <Button size="small" onClick={() => navigate('/entry/purchase-request-display')}>
                  View All
                </Button>
              </Box>

              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead sx={{ backgroundColor: '#1f4fb2' }}>
                    <TableRow>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>PR No</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Item Name(s)</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Department</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Date</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Priority</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Est Value (₹)</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                          <CircularProgress size={24} />
                        </TableCell>
                      </TableRow>
                    ) : recentRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                          No recent purchase requests found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      recentRequests.map(r => (
                        <TableRow key={r.id} hover>
                          <TableCell sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>{r.pr_no}</TableCell>
                          <TableCell sx={{ fontWeight: '500' }}>{r.item_names || r.item_name || '—'}</TableCell>
                          <TableCell>{r.department}</TableCell>
                          <TableCell>{r.request_date}</TableCell>
                          <TableCell>
                            <Chip label={r.priority} size="small" color={r.priority === 'Urgent' ? 'error' : 'default'} />
                          </TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>₹{(r.total_amount || 0).toLocaleString('en-IN')}</TableCell>
                          <TableCell>{getStatusChip(r.status)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Department Breakdown */}
        <Grid item xs={12} md={4}>
          <Card elevation={2} sx={{ borderRadius: 1.5 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, color: '#1f4fb2', display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendIcon fontSize="small" /> Department Demands
              </Typography>

              {loading ? (
                <Box sx={{ textAlignment: 'center', py: 4 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : departmentStats.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No department requisitions recorded.</Typography>
              ) : (
                departmentStats.map((d, idx) => {
                  const maxVal = Math.max(...departmentStats.map(s => s.total_amount || 1));
                  const pct = Math.min(((d.total_amount || 0) / maxVal) * 100, 100);

                  return (
                    <Box key={idx} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {d.department || 'General'} ({d.request_count})
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#1f4fb2', fontWeight: 'bold' }}>
                          ₹{(d.total_amount || 0).toLocaleString('en-IN')}
                        </Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 4, backgroundColor: '#eaf2fb' }} />
                    </Box>
                  );
                })
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PurchaseRequestDashboard;
