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
  CircularProgress,
  Alert,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import SanitizerIcon from '@mui/icons-material/Sanitizer';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import EmergencyShareIcon from '@mui/icons-material/EmergencyShare';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import PlayCircleFilledWhiteIcon from '@mui/icons-material/PlayCircleFilledWhite';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RefreshIcon from '@mui/icons-material/Refresh';

export default function DocumentDashboardView({
  onNavigateTab,
  onCreateDoc,
  onOpenTraceability,
  onOpenRecall,
}) {
  const [todayData, setTodayData] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [expiringData, setExpiringData] = useState(null);
  const [pendingData, setPendingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [dashRes, todayRes, expRes, pendRes] = await Promise.all([
        fetch('/api/compliance/dashboard').then((r) => r.json()),
        fetch('/api/compliance/today-required').then((r) => r.json()),
        fetch('/api/compliance/expiring').then((r) => r.json()),
        fetch('/api/compliance/pending').then((r) => r.json()),
      ]);

      if (dashRes.success) setDashboardData(dashRes);
      if (todayRes.success) setTodayData(todayRes);
      if (expRes.success) setExpiringData(expRes);
      if (pendRes.success) setPendingData(pendRes);
      setError(null);
    } catch (err) {
      console.error('Error loading document dashboard:', err);
      setError('Unable to load document dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleAction = (record) => {
    if (record.category.includes('Production')) {
      if (onNavigateTab) onNavigateTab(1); // Production Records
    } else {
      if (onNavigateTab) onNavigateTab(2); // Cleaning Records
    }
  };

  return (
    <Box>
      {/* Top Banner */}
      <Box
        sx={{
          mb: 3,
          p: 3,
          borderRadius: 2,
          background: 'linear-gradient(135deg, #1f4fb2 0%, #2a5ea0 100%)',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <VerifiedUserIcon sx={{ fontSize: 32, color: '#93c5fd' }} />
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              Document Control & Compliance Subsystem
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', maxWidth: 800 }}>
            Unified FSSAI, ISO 22000 & HACCP compliant document framework for BVC Exports Pvt. Ltd. Distinct handling for Production Records (P1–P8), Cleaning Records (C1–C10), and Controlled Documents (D1–D11).
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => onCreateDoc && onCreateDoc('D1')}
            sx={{
              backgroundColor: 'white',
              color: '#1f4fb2',
              fontWeight: 'bold',
              '&:hover': { backgroundColor: '#f1f5f9' },
            }}
          >
            New Controlled Document
          </Button>
          <Button
            variant="outlined"
            startIcon={<AltRouteIcon />}
            onClick={() => onOpenTraceability && onOpenTraceability()}
            sx={{
              color: 'white',
              borderColor: 'rgba(255,255,255,0.6)',
              '&:hover': { borderColor: 'white', backgroundColor: 'rgba(255,255,255,0.1)' },
            }}
          >
            Traceability (P8)
          </Button>
        </Box>
      </Box>

      {/* DOCUMENT CONTROL Summary Metric Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid #1f4fb2', height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                TOTAL DOCUMENTS
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mt: 0.5 }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>
                  29
                </Typography>
                <Chip size="small" label="Master Catalog" color="primary" />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                8 Prod | 10 Clean | 11 Controlled
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid #ea580c', height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                PENDING TODAY
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mt: 0.5 }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#ea580c' }}>
                  {todayData?.pendingCount ?? (pendingData?.total_pending || 0)}
                </Typography>
                <Chip size="small" label="Requires Action" color="warning" />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {todayData?.completedCount || 0} checks completed today
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid #d97706', height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                EXPIRING SOON (&lt; 30D)
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mt: 0.5 }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#d97706' }}>
                  {expiringData?.expiring_soon_count || 0}
                </Typography>
                <Chip size="small" label="Renew Soon" sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 'bold' }} />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Medical D7, FOSTAC D8, Halal D10
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid #dc2626', height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                EXPIRED RECORDS
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mt: 0.5 }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#dc2626' }}>
                  {expiringData?.expired_count || 0}
                </Typography>
                <Chip size="small" label="Urgent Action" color="error" />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Overdue review / renewal dates
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content Grid: Today's Required Records + Subsystem Quick Links */}
      <Grid container spacing={3}>
        {/* Left: TODAY'S REQUIRED RECORDS */}
        <Grid item xs={12} lg={7}>
          <Card sx={{ borderRadius: 2, border: '1px solid #e2e8f0', height: '100%' }}>
            <Box sx={{ p: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarMonthIcon sx={{ color: '#1f4fb2' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#0f172a' }}>
                  TODAY'S REQUIRED OPERATIONAL RECORDS
                </Typography>
              </Box>
              <Button size="small" startIcon={<RefreshIcon />} onClick={fetchDashboardData} sx={{ textTransform: 'none' }}>
                Refresh
              </Button>
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', width: 70 }}>Code</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Required Record</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', width: 140 }}>Frequency</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', width: 120 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', width: 130, textAlign: 'center' }}>1-Click Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(todayData?.records || []).map((rec) => (
                    <TableRow key={rec.code} hover>
                      <TableCell>
                        <Chip
                          label={rec.code}
                          size="small"
                          sx={{
                            fontWeight: 'bold',
                            bgcolor: rec.code.startsWith('P') ? '#eff6ff' : '#f0fdf4',
                            color: rec.code.startsWith('P') ? '#1d4ed8' : '#15803d',
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {rec.name}
                        {rec.last_no && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            Last Logged: {rec.last_no}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ color: '#64748b', fontSize: '12px' }}>{rec.frequency}</TableCell>
                      <TableCell>
                        {rec.is_completed ? (
                          <Chip
                            icon={<CheckCircleIcon />}
                            label="Completed"
                            size="small"
                            color="success"
                            sx={{ fontWeight: 'bold', fontSize: '11px' }}
                          />
                        ) : (
                          <Chip
                            icon={<ErrorOutlineIcon />}
                            label="Pending"
                            size="small"
                            color="error"
                            sx={{ fontWeight: 'bold', fontSize: '11px' }}
                          />
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          size="small"
                          variant={rec.is_completed ? 'outlined' : 'contained'}
                          onClick={() => handleAction(rec)}
                          startIcon={rec.is_completed ? <VisibilityIcon /> : <PlayCircleFilledWhiteIcon />}
                          sx={{
                            fontSize: '11px',
                            textTransform: 'none',
                            py: 0.3,
                            px: 1,
                            bgcolor: rec.is_completed ? 'transparent' : '#1f4fb2',
                          }}
                        >
                          {rec.is_completed ? 'View Record' : 'Create Record'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Grid>

        {/* Right: Quick Subsystem Launchers & Shortcuts */}
        <Grid item xs={12} lg={5}>
          <Grid container spacing={2}>
            {/* 1. Production Records P1–P8 */}
            <Grid item xs={12} sm={6}>
              <Card
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  cursor: 'pointer',
                  transition: '0.2s',
                  '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
                }}
                onClick={() => onNavigateTab && onNavigateTab(1)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <PrecisionManufacturingIcon sx={{ color: '#1d4ed8' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1e40af' }}>
                    Production Records (P1–P8)
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: '#3b82f6', display: 'block', mb: 1.5 }}>
                  IQR, Fumigation, In-Process, CCP Monitoring, COA & Traceability
                </Typography>
                <Button size="small" variant="contained" sx={{ bgcolor: '#1d4ed8', fontSize: '11px', textTransform: 'none' }}>
                  Open Production Logs
                </Button>
              </Card>
            </Grid>

            {/* 2. Cleaning Records C1–C10 */}
            <Grid item xs={12} sm={6}>
              <Card
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  cursor: 'pointer',
                  transition: '0.2s',
                  '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
                }}
                onClick={() => onNavigateTab && onNavigateTab(2)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <SanitizerIcon sx={{ color: '#15803d' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#166534' }}>
                    Cleaning Records (C1–C10)
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: '#22c55e', display: 'block', mb: 1.5 }}>
                  Area Sanitation, Pallets, Glass/Plastic, Pest Control & Hygiene
                </Typography>
                <Button size="small" variant="contained" sx={{ bgcolor: '#15803d', fontSize: '11px', textTransform: 'none' }}>
                  Open Cleaning Logs
                </Button>
              </Card>
            </Grid>

            {/* 3. Controlled Documents D1–D11 */}
            <Grid item xs={12} sm={6}>
              <Card
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: '#faf5ff',
                  border: '1px solid #e9d5ff',
                  cursor: 'pointer',
                  transition: '0.2s',
                  '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
                }}
                onClick={() => onNavigateTab && onNavigateTab(0)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <DescriptionIcon sx={{ color: '#7e22ce' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#6b21a8' }}>
                    Controlled Docs (D1–D11)
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: '#a855f7', display: 'block', mb: 1.5 }}>
                  SOPs, Work Instructions, Hazard Plan, MTR Specs & Training
                </Typography>
                <Button size="small" variant="contained" sx={{ bgcolor: '#7e22ce', fontSize: '11px', textTransform: 'none' }}>
                  Open Controlled Docs
                </Button>
              </Card>
            </Grid>

            {/* 4. Document Register (All 29) */}
            <Grid item xs={12} sm={6}>
              <Card
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                  transition: '0.2s',
                  '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
                }}
                onClick={() => onNavigateTab && onNavigateTab(6)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <MenuBookIcon sx={{ color: '#334155' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#0f172a' }}>
                    Document Register (29)
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 1.5 }}>
                  Master registry table with creation modes, frequencies & ERP links
                </Typography>
                <Button size="small" variant="contained" sx={{ bgcolor: '#334155', fontSize: '11px', textTransform: 'none' }}>
                  View Full Register
                </Button>
              </Card>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
}
