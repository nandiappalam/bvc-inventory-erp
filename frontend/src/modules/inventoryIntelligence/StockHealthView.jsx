import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  LinearProgress,
  Button
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import BlockIcon from '@mui/icons-material/Block';
import { useNavigate } from 'react-router-dom';

const StockHealthView = ({ summary, onSwitchTab }) => {
  const navigate = useNavigate();

  if (!summary) return null;

  const {
    physicalStockMT,
    availableStockMT,
    reservedStockMT,
    quarantineStockMT,
    rejectedStockMT,
    coldStorageStockMT,
    inTransitMT,
    openPOIncomingMT,
    health
  } = summary;

  const healthScore = health?.healthScorePercent || 85;

  return (
    <Box>
      {/* Top Banner: Overall Health Score & Stock Breakdown */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Health Score Card */}
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%', bgcolor: '#f8fafc', borderColor: '#cbd5e1' }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#475569' }}>
                    INVENTORY HEALTH INDEX
                  </Typography>
                  <Chip
                    label={healthScore >= 80 ? 'EXCELLENT' : healthScore >= 60 ? 'MODERATE' : 'ATTENTION NEEDED'}
                    size="small"
                    color={healthScore >= 80 ? 'success' : healthScore >= 60 ? 'warning' : 'error'}
                    sx={{ fontWeight: 'bold' }}
                  />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, my: 1.5 }}>
                  <Typography variant="h3" sx={{ fontWeight: 'bold', color: healthScore >= 80 ? '#16a34a' : healthScore >= 60 ? '#d97706' : '#dc2626' }}>
                    {healthScore}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">Optimal Stock Balance</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Number.isNaN(Number(healthScore)) ? 0 : Math.max(0, Math.min(100, Number(healthScore)))}
                  sx={{
                    height: 10,
                    borderRadius: 5,
                    bgcolor: '#e2e8f0',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: healthScore >= 80 ? '#16a34a' : healthScore >= 60 ? '#d97706' : '#dc2626'
                    }
                  }}
                />
              </Box>

              <Typography variant="caption" sx={{ color: '#64748b', mt: 2 }}>
                Evaluated against minimum safety stock, reorder thresholds, dead stock, and QC holds across all active warehouses.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Physical Stock Breakdown Cards */}
        <Grid item xs={12} md={8}>
          <Grid container spacing={1.5}>
            <Grid item xs={6} sm={4}>
              <Card variant="outlined" sx={{ borderColor: '#bae6fd', bgcolor: '#f0f9ff' }}>
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 'bold' }}>PHYSICAL STOCK</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#0f172a' }}>{physicalStockMT} MT</Typography>
                  <Typography variant="caption" color="text.secondary">Total Warehoused</Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={6} sm={4}>
              <Card variant="outlined" sx={{ borderColor: '#bbf7d0', bgcolor: '#f0fdf4' }}>
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="caption" sx={{ color: '#15803d', fontWeight: 'bold' }}>AVAILABLE FOR USE</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#16a34a' }}>{availableStockMT} MT</Typography>
                  <Typography variant="caption" color="text.secondary">Passed & Unreserved</Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={6} sm={4}>
              <Card variant="outlined" sx={{ borderColor: '#fed7aa', bgcolor: '#fffaf5' }}>
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="caption" sx={{ color: '#c2410c', fontWeight: 'bold' }}>RESERVED (PROD)</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#ea580c' }}>{reservedStockMT} MT</Typography>
                  <Typography variant="caption" color="text.secondary">Committed in WO</Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={6} sm={4}>
              <Card variant="outlined" sx={{ borderColor: '#fef08a', bgcolor: '#fefce8' }}>
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="caption" sx={{ color: '#a16207', fontWeight: 'bold' }}>QUARANTINE / HOLD</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#ca8a04' }}>{quarantineStockMT} MT</Typography>
                  <Typography variant="caption" color="text.secondary">Pending Lab QC</Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={6} sm={4}>
              <Card variant="outlined" sx={{ borderColor: '#fecdd3', bgcolor: '#fff1f2' }}>
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="caption" sx={{ color: '#be123c', fontWeight: 'bold' }}>REJECTED LOTS</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#e11d48' }}>{rejectedStockMT} MT</Typography>
                  <Typography variant="caption" color="text.secondary">Return / Scrap Pending</Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={6} sm={4}>
              <Card variant="outlined" sx={{ borderColor: '#ddd6fe', bgcolor: '#f5f3ff' }}>
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="caption" sx={{ color: '#6d28d9', fontWeight: 'bold' }}>COLD STORAGE</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#7c3aed' }}>{coldStorageStockMT} MT</Typography>
                  <Typography variant="caption" color="text.secondary">Climate Controlled</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>
      </Grid>

      {/* Health Categories Grid */}
      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1.5, color: '#1e293b' }}>
        Stock Status Categories & Action Triggers
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card 
            variant="outlined" 
            sx={{ 
              p: 2, 
              borderColor: '#86efac', 
              bgcolor: '#f0fdf4',
              cursor: 'pointer',
              '&:hover': { boxShadow: 1 }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <CheckCircleIcon sx={{ color: '#16a34a' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#15803d' }}>
                Healthy Stock
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#166534' }}>
              {health?.healthy || 0} Items
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Above reorder level & active within 90 days
            </Typography>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card 
            variant="outlined" 
            sx={{ 
              p: 2, 
              borderColor: '#fdba74', 
              bgcolor: '#fff7ed',
              cursor: 'pointer',
              '&:hover': { boxShadow: 1 }
            }}
            onClick={() => navigate('/procurement-planning?filter=reorder')}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <WarningIcon sx={{ color: '#ea580c' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#c2410c' }}>
                Low Stock Warning
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#9a3412' }}>
              {health?.lowStock || 0} Items
            </Typography>
            <Typography variant="caption" color="text.secondary">
              At or below reorder level (Click to Plan PR)
            </Typography>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card 
            variant="outlined" 
            sx={{ 
              p: 2, 
              borderColor: '#fca5a5', 
              bgcolor: '#fef2f2',
              cursor: 'pointer',
              '&:hover': { boxShadow: 1 }
            }}
            onClick={() => navigate('/procurement-planning?filter=shortage')}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <ErrorOutlineIcon sx={{ color: '#dc2626' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#b91c1c' }}>
                Critical Shortage
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#991b1b' }}>
              {health?.critical || 0} Items
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Below minimum safety threshold
            </Typography>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card 
            variant="outlined" 
            sx={{ 
              p: 2, 
              borderColor: '#cbd5e1', 
              bgcolor: '#f8fafc',
              cursor: 'pointer',
              '&:hover': { boxShadow: 1 }
            }}
            onClick={() => onSwitchTab && onSwitchTab(2)} // Switch to Dead stock tab
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <HourglassBottomIcon sx={{ color: '#64748b' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#475569' }}>
                Dead / Stagnant Stock
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#334155' }}>
              {health?.deadStock || 0} Items
            </Typography>
            <Typography variant="caption" color="text.secondary">
              No movement for 120+ days (Click to inspect)
            </Typography>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Action Navigator */}
      <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#0f172a' }}>
            Need to take immediate operational action?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Launch cross-module tools to replenish shortage, clear quarantine lots, or allocate dead stock.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="contained"
            color="primary"
            size="small"
            onClick={() => navigate('/procurement-planning')}
            sx={{ textTransform: 'none', fontWeight: 'bold' }}
          >
            Procurement Planning
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate('/quality/dashboard')}
            sx={{ textTransform: 'none' }}
          >
            Quality Control Hub
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate('/reports/category/stock')}
            sx={{ textTransform: 'none' }}
          >
            Godown Stock Ledger
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default StockHealthView;
