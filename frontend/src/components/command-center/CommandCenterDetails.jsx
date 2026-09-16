import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Button,
  Grid,
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
  Tooltip
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  OpenInNew as OpenInNewIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  ErrorOutline as ErrorOutlineIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { COMMAND_CENTER_CONFIG } from '../../config/commandCenterConfig';
import commandCenterService from '../../services/commandCenterService';
import { useAuth } from '../../context/AuthContext';

/**
 * CommandCenterDetails View
 * Deep-dive inspection page for any operational section with quick navigation links.
 */
const CommandCenterDetails = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSection = searchParams.get('section') || 'purchase';
  const [activeTab, setActiveTab] = useState(initialSection);
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const { financialYear } = useAuth() || {};

  const sectionKeys = ['purchase', 'inventory', 'production', 'sales', 'accounts', 'quality', 'approvals', 'alerts'];

  useEffect(() => {
    const sec = searchParams.get('section');
    if (sec && sectionKeys.includes(sec)) {
      setActiveTab(sec);
    }
  }, [searchParams]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await commandCenterService.getSummary(financialYear);
        if (res && res.success) {
          setData(res.data || {});
        }
      } catch (e) {
        console.error('Error loading details metrics:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [financialYear]);

  const handleTabChange = (_event, newValue) => {
    setActiveTab(newValue);
    setSearchParams({ section: newValue });
  };

  const currentConfig = COMMAND_CENTER_CONFIG[activeTab] || COMMAND_CENTER_CONFIG.purchase;
  const currentData = data[activeTab] || {};

  const handleNavigateToModule = (targetRoute) => {
    const returnPath = `/command-center/details?section=${encodeURIComponent(activeTab)}`;
    sessionStorage.setItem('command_center_referrer', JSON.stringify({
      path: returnPath,
      sectionName: activeTab || 'Operations',
      timestamp: Date.now()
    }));
    navigate(targetRoute, {
      state: {
        fromCommandCenter: true,
        returnPath,
        sourceSection: activeTab || 'Operations'
      }
    });
  };

  return (
    <Box sx={{ width: '100%', maxWidth: '1600px', mx: 'auto', p: { xs: 1, sm: 2 } }}>
      {/* Header Bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/command-center')}
          sx={{ textTransform: 'none', borderColor: '#cbd5e1', color: '#334155' }}
        >
          Back to Command Center
        </Button>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a' }}>
          Operations Detail: {currentConfig.title}
        </Typography>
      </Box>

      {/* Tab Navigation */}
      <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: '8px', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 1,
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '13px',
              minHeight: 48
            }
          }}
        >
          {sectionKeys.map((key) => {
            const conf = COMMAND_CENTER_CONFIG[key];
            return <Tab key={key} value={key} label={conf.title} />;
          })}
        </Tabs>
      </Paper>

      {/* Metrics Detail Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {currentConfig.metrics.map((m) => {
          const val = currentData[m.key] !== undefined ? currentData[m.key] : 0;
          let displayVal = val;
          if (m.isCurrency) {
            displayVal = `₹${(parseFloat(val) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
          } else if (typeof val === 'number') {
            displayVal = val.toLocaleString('en-IN');
          }

          return (
            <Grid item xs={12} sm={6} md={3} key={m.key}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  height: '100%',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                    borderColor: '#93c5fd'
                  }
                }}
              >
                <Box>
                  <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600, mb: 1 }}>
                    {m.label}
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#0f172a', mb: 1 }}>
                    {displayVal} <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 'normal' }}>{m.unit}</span>
                  </Typography>
                </Box>

                <Button
                  variant="contained"
                  size="small"
                  onClick={() => handleNavigateToModule(m.route)}
                  endIcon={<OpenInNewIcon sx={{ fontSize: 15 }} />}
                  sx={{
                    mt: 1.5,
                    textTransform: 'none',
                    backgroundColor: currentConfig.color || '#2563eb',
                    '&:hover': { backgroundColor: '#1d4ed8' }
                  }}
                >
                  {m.actionLabel}
                </Button>
              </Paper>
            </Grid>
          );
        })}
      </Grid>

      {/* Actionable Routing Directory */}
      <Paper elevation={0} sx={{ p: 2.5, borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a', mb: 2 }}>
          Direct Workflow Links & Sub-modules
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead sx={{ backgroundColor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Metric / Target</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Target Path</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Required Permission</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: '#475569' }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {currentConfig.metrics.map((m) => (
                <TableRow key={m.key} hover>
                  <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>{m.label}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', color: '#0369a1', fontSize: '12px' }}>{m.route}</TableCell>
                  <TableCell>
                    <Chip label={m.permission} size="small" variant="outlined" sx={{ fontSize: '11px' }} />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleNavigateToModule(m.route)}
                      endIcon={<OpenInNewIcon sx={{ fontSize: 13 }} />}
                      sx={{ textTransform: 'none', fontSize: '12px' }}
                    >
                      Open Page
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default CommandCenterDetails;
