import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  Grid,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  Tooltip,
  IconButton,
} from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import PlayCircleFilledWhiteIcon from '@mui/icons-material/PlayCircleFilledWhite';
import RefreshIcon from '@mui/icons-material/Refresh';
import api from '../../services/api.js';

export default function DocumentScheduleView({ onNavigateTab }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [freqFilter, setFreqFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const json = await api('/compliance/dashboard');
      if (json && json.success) {
        setData(json.schedulerTasks || []);
        setError(null);
      } else {
        setError(json?.error || json?.message || 'Failed to fetch schedule');
      }
    } catch (err) {
      console.error('Error loading schedule:', err);
      setError('Server connection error.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, []);

  const filteredTasks = data.filter((t) => {
    const matchesFreq =
      freqFilter === 'ALL' || t.frequency.toLowerCase().includes(freqFilter.toLowerCase());
    const matchesStatus =
      statusFilter === 'ALL' || t.status === statusFilter;
    return matchesFreq && matchesStatus;
  });

  const getStatusChip = (status) => {
    switch (status) {
      case 'COMPLETED':
        return <Chip size="small" icon={<CheckCircleIcon />} label="Completed" color="success" sx={{ fontWeight: 'bold' }} />;
      case 'ON_TRACK':
        return <Chip size="small" icon={<EventAvailableIcon />} label="Due Soon" color="primary" sx={{ fontWeight: 'bold' }} />;
      case 'OVERDUE':
        return <Chip size="small" icon={<ErrorOutlineIcon />} label="Overdue" color="error" sx={{ fontWeight: 'bold' }} />;
      case 'EVENT_BASED':
        return <Chip size="small" label="Event / On Inward" sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 'bold' }} />;
      default:
        return <Chip size="small" label={status} color="default" />;
    }
  };

  const handleAction = (task) => {
    if (task.category.includes('Production')) {
      if (onNavigateTab) onNavigateTab(1); // Production Records
    } else {
      if (onNavigateTab) onNavigateTab(2); // Cleaning Records
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarMonthIcon sx={{ color: '#1f4fb2', fontSize: 28 }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
              Document Compliance & Audit Schedule Engine
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Dynamic frequency-based scheduler for operational checklists, hygiene audits, pest control, and critical monitoring limits.
          </Typography>
        </Box>

        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshIcon />}
          onClick={fetchSchedule}
          sx={{ textTransform: 'none', fontWeight: 'bold' }}
        >
          Refresh Schedule
        </Button>
      </Box>

      {/* Schedule Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={3}>
          <Card sx={{ bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#166534' }}>
                DAILY CHECKLISTS
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#15803d', mt: 0.5 }}>
                6 Active
              </Typography>
              <Typography variant="caption" color="text.secondary">
                P3, P4, C1 Area, C7 Toilet, C9 Hygiene
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={3}>
          <Card sx={{ bgcolor: '#eff6ff', border: '1px solid #bfdbfe', height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#1e40af' }}>
                15-DAYS ONCE
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#1d4ed8', mt: 0.5 }}>
                3 Active
              </Typography>
              <Typography variant="caption" color="text.secondary">
                C2 Machinery, C4 Water Tank, C6 Wood-Pallet
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={3}>
          <Card sx={{ bgcolor: '#faf5ff', border: '1px solid #e9d5ff', height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#6b21a8' }}>
                MONTHLY AUDITS
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#7e22ce', mt: 0.5 }}>
                2 Active
              </Typography>
              <Typography variant="caption" color="text.secondary">
                C3 Pest Control, C5 Window-Glass
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={3}>
          <Card sx={{ bgcolor: '#fffbeb', border: '1px solid #fde68a', height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#92400e' }}>
                EVENT & DISPATCH
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#b45309', mt: 0.5 }}>
                6 Active
              </Typography>
              <Typography variant="caption" color="text.secondary">
                P1, P2, P6, P7, C8 Vehicle, C10 Packing Mat
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filter Bar */}
      <Card sx={{ mb: 3, p: 2, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              size="small"
              label="Filter by Frequency"
              value={freqFilter}
              onChange={(e) => setFreqFilter(e.target.value)}
            >
              <MenuItem value="ALL">All Frequencies</MenuItem>
              <MenuItem value="Daily">Daily Tasks</MenuItem>
              <MenuItem value="15 Days">15 Days Once</MenuItem>
              <MenuItem value="Monthly">Monthly Once</MenuItem>
              <MenuItem value="Loading">Loading / On Dispatch</MenuItem>
              <MenuItem value="Receiving">Material Receiving (RM/PM)</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              size="small"
              label="Filter by Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="ALL">All Statuses</MenuItem>
              <MenuItem value="COMPLETED">Completed</MenuItem>
              <MenuItem value="ON_TRACK">Due Soon / On Track</MenuItem>
              <MenuItem value="EVENT_BASED">Event Based</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Card>

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f1f5f9' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', width: 80, py: 1.5 }}>Code</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Task / Document Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 180 }}>Category</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 150 }}>Frequency</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 140 }}>Last Completed</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 170 }}>Next Due / Window</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 140 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 130, textAlign: 'center' }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredTasks.map((t) => (
                <TableRow
                  key={t.code}
                  hover
                  sx={{
                    '&:nth-of-type(even)': { bgcolor: '#fafafa' },
                    '&:hover': { bgcolor: '#f0f7ff' },
                  }}
                >
                  <TableCell>
                    <Chip
                      label={t.code}
                      size="small"
                      sx={{
                        fontWeight: 'bold',
                        bgcolor: t.code.startsWith('P') ? '#eff6ff' : '#f0fdf4',
                        color: t.code.startsWith('P') ? '#1d4ed8' : '#15803d',
                        border: `1px solid ${t.code.startsWith('P') ? '#93c5fd' : '#86efac'}`,
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e293b' }}>
                      {t.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                      {t.category}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={t.frequency} size="small" variant="outlined" sx={{ fontSize: '11px', fontWeight: 600 }} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#334155' }}>
                      {t.last_done}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>
                      {t.due_next}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {getStatusChip(t.status)}
                  </TableCell>
                  <TableCell align="center">
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => handleAction(t)}
                      startIcon={<PlayCircleFilledWhiteIcon />}
                      sx={{
                        fontSize: '11px',
                        textTransform: 'none',
                        py: 0.3,
                        px: 1,
                        bgcolor: '#1f4fb2',
                        '&:hover': { bgcolor: '#173b87' },
                      }}
                    >
                      Log Entry
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
