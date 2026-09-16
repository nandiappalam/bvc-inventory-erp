import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
  Button,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Paper,
  Chip
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  FilterAlt as FilterAltIcon,
  Schedule as ScheduleIcon,
  Business as BusinessIcon,
  DateRange as DateRangeIcon,
  DashboardCustomize as DashboardCustomizeIcon
} from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import commandCenterService from '../../services/commandCenterService';
import { COMMAND_CENTER_CONFIG } from '../../config/commandCenterConfig';
import SummarySection from './SummarySection';

/**
 * CommandCenterMain View
 * Real-time operational overview with high-contrast, structured 8-section layout.
 */
const CommandCenterMain = () => {
  const { selectedCompany, financialYear, user } = useAuth() || {};
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState({});
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  // Fetch metrics data
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setRefreshing(true);
    setError('');

    try {
      const res = await commandCenterService.getSummary(financialYear);
      if (res && res.success) {
        setData(res.data || {});
        setLastUpdated(res.lastUpdated ? new Date(res.lastUpdated) : new Date());
      } else {
        setError(res?.message || 'Failed to retrieve Command Center metrics.');
      }
    } catch (err) {
      console.error('Error fetching Command Center data:', err);
      setError('Error communicating with Command Center API server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [financialYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Section order
  const sectionKeys = ['purchase', 'inventory', 'production', 'sales', 'accounts', 'quality', 'approvals', 'alerts'];

  return (
    <Box sx={{ width: '100%', maxWidth: '1600px', mx: 'auto', p: { xs: 1, sm: 2 } }}>
      {/* Top Header & Quick Context Bar */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2.5,
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          backgroundColor: '#ffffff',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', md: 'center' },
          gap: 2
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <DashboardCustomizeIcon sx={{ color: '#0369a1', fontSize: 28 }} />
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a', letterSpacing: '-0.3px' }}>
              Command Center
            </Typography>
            <Chip
              label="Real-Time"
              size="small"
              sx={{
                backgroundColor: '#dcfce7',
                color: '#15803d',
                fontWeight: 'bold',
                fontSize: '11px',
                height: 22
              }}
            />
          </Box>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
            Unified cross-departmental operations, pending approvals, and active inventory status.
          </Typography>
        </Box>

        {/* Global Context Tags & Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          {selectedCompany && (
            <Chip
              icon={<BusinessIcon sx={{ fontSize: 16 }} />}
              label={selectedCompany.name || selectedCompany}
              variant="outlined"
              size="small"
              sx={{ borderColor: '#cbd5e1', color: '#334155', fontWeight: 500 }}
            />
          )}

          {financialYear && (
            <Chip
              icon={<DateRangeIcon sx={{ fontSize: 16 }} />}
              label={`FY: ${financialYear}`}
              variant="outlined"
              size="small"
              sx={{ borderColor: '#cbd5e1', color: '#334155', fontWeight: 500 }}
            />
          )}

          {lastUpdated && (
            <Typography variant="caption" sx={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ScheduleIcon sx={{ fontSize: 13 }} />
              {lastUpdated.toLocaleTimeString()}
            </Typography>
          )}

          <Button
            component={Link}
            to="/procurement-planning"
            variant="contained"
            size="small"
            sx={{
              backgroundColor: '#0284c7',
              color: '#ffffff',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '12px',
              '&:hover': {
                backgroundColor: '#0369a1'
              }
            }}
          >
            Procurement Planning
          </Button>

          <Button
            component={Link}
            to="/inventory-intelligence"
            variant="contained"
            size="small"
            sx={{
              backgroundColor: '#059669',
              color: '#ffffff',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '12px',
              '&:hover': {
                backgroundColor: '#047857'
              }
            }}
          >
            Inventory Intelligence
          </Button>

          <Button
            component={Link}
            to="/lot-genealogy"
            variant="contained"
            size="small"
            sx={{
              backgroundColor: '#4f46e5',
              color: '#ffffff',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '12px',
              '&:hover': {
                backgroundColor: '#4338ca'
              }
            }}
          >
            Lot Genealogy
          </Button>

          <Button
            component={Link}
            to="/bom-master"
            variant="contained"
            size="small"
            sx={{
              backgroundColor: '#0891b2',
              color: '#ffffff',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '12px',
              '&:hover': {
                backgroundColor: '#0e7490'
              }
            }}
          >
            BOM & MRP
          </Button>

          <Button
            component={Link}
            to="/production-planning"
            variant="contained"
            size="small"
            sx={{
              backgroundColor: '#d97706',
              color: '#ffffff',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '12px',
              '&:hover': {
                backgroundColor: '#b45309'
              }
            }}
          >
            Production & Yield
          </Button>

          <Button
            component={Link}
            to="/jobwork-control"
            variant="contained"
            size="small"
            sx={{
              backgroundColor: '#7c3aed',
              color: '#ffffff',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '12px',
              '&:hover': {
                backgroundColor: '#6d28d9'
              }
            }}
          >
            Jobwork Control
          </Button>

          <Button
            variant="outlined"
            size="small"
            onClick={() => fetchData(false)}
            disabled={loading || refreshing}
            startIcon={refreshing ? <CircularProgress size={14} color="inherit" /> : <RefreshIcon />}
            sx={{
              borderColor: '#cbd5e1',
              color: '#334155',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '12px',
              '&:hover': {
                borderColor: '#94a3b8',
                backgroundColor: '#f8fafc'
              }
            }}
          >
            Refresh
          </Button>
        </Box>
      </Paper>

      {/* Global Errors */}
      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>
          {error}
        </Alert>
      )}

      {/* Main 8-Section Operational Grid */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '350px' }}>
          <CircularProgress size={36} sx={{ color: '#0369a1' }} />
        </Box>
      ) : (
        <Grid container spacing={2}>
          {sectionKeys.map((secKey) => {
            const config = COMMAND_CENTER_CONFIG[secKey];
            if (!config) return null;
            const secData = data[secKey] || {};
            const isSecError = secData.error === true;

            return (
              <Grid item xs={12} md={6} lg={3} key={secKey}>
                <SummarySection
                  sectionKey={secKey}
                  config={config}
                  data={secData}
                  error={isSecError}
                />
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
};

export default CommandCenterMain;
