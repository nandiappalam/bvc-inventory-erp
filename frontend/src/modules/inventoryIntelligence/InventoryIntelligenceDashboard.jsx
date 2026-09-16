import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Button,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import { useSearchParams, useNavigate } from 'react-router-dom';
import RefreshIcon from '@mui/icons-material/Refresh';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';

import inventoryIntelligenceService from '../../services/inventoryIntelligenceService';
import StockHealthView from './StockHealthView';
import StockAgingView from './StockAgingView';
import DeadStockView from './DeadStockView';
import ExcessStockView from './ExcessStockView';

const InventoryIntelligenceDashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');

  const tabIndexMap = {
    'health': 0,
    'aging': 1,
    'dead-stock': 2,
    'excess': 3
  };

  const [activeTab, setActiveTab] = useState(tabIndexMap[tabParam] || 0);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await inventoryIntelligenceService.getSummary();
      if (res.success) {
        setSummary(res.data);
      }
    } catch (err) {
      console.error('Error fetching inventory intelligence summary:', err);
      setError(err.message || 'Failed to load inventory summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    const tabNames = ['health', 'aging', 'dead-stock', 'excess'];
    setSearchParams({ tab: tabNames[newValue] });
  };

  return (
    <Box sx={{ pb: 6 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, mb: 3, gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
              Advanced Inventory Intelligence
            </Typography>
            <Chip label="Live Engine" size="small" color="success" variant="outlined" />
          </Box>
          <Typography variant="body2" color="text.secondary">
            Stock health analytics, multi-bucket aging, dead-stock capital recovery, and godown segregation.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchSummary}
            size="medium"
            sx={{ textTransform: 'none' }}
          >
            Refresh
          </Button>

          <Button
            variant="contained"
            color="primary"
            startIcon={<ShoppingCartIcon />}
            onClick={() => navigate('/procurement-planning')}
            size="medium"
            sx={{ textTransform: 'none', fontWeight: 'bold' }}
          >
            Procurement Planning
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Tabs Navigation */}
      <Paper variant="outlined" sx={{ borderRadius: 2, mb: 3, bgcolor: '#ffffff' }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 'bold',
              fontSize: '14px',
              minHeight: 48
            }
          }}
        >
          <Tab icon={<HealthAndSafetyIcon fontSize="small" />} iconPosition="start" label="Stock Health & Categories" />
          <Tab icon={<AccessTimeIcon fontSize="small" />} iconPosition="start" label="Multi-Bucket Aging Analysis" />
          <Tab icon={<HourglassEmptyIcon fontSize="small" />} iconPosition="start" label="Dead & Stagnant Stock" />
          <Tab icon={<TrendingUpIcon fontSize="small" />} iconPosition="start" label="Excess & Surplus Stock" />
        </Tabs>
      </Paper>

      {/* Tab Panels */}
      {loading && !summary ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8, flexDirection: 'column', alignItems: 'center' }}>
          <CircularProgress size={36} />
          <Typography variant="body2" sx={{ mt: 1.5, color: '#64748b' }}>Calculating inventory intelligence metrics...</Typography>
        </Box>
      ) : (
        <Box>
          {activeTab === 0 && (
            <StockHealthView summary={summary} onSwitchTab={setActiveTab} />
          )}
          {activeTab === 1 && (
            <StockAgingView />
          )}
          {activeTab === 2 && (
            <DeadStockView />
          )}
          {activeTab === 3 && (
            <ExcessStockView />
          )}
        </Box>
      )}
    </Box>
  );
};

export default InventoryIntelligenceDashboard;
