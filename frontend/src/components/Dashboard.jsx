import React, { useState, useEffect } from 'react';
import api from '../services/api.js';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  CardActionArea,
  List,
  ListItem,
  ListItemText,
  Divider,
  Chip,
  Button,
  Alert,
  AlertTitle,
  CircularProgress,
  IconButton,
  Tooltip,
  ButtonGroup
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';

// Icons
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AssignmentReturnIcon from '@mui/icons-material/AssignmentReturn';
import GrainIcon from '@mui/icons-material/Grain';
import BakeryDiningIcon from '@mui/icons-material/BakeryDining';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import ListAltIcon from '@mui/icons-material/ListAlt';
import AssignmentIcon from '@mui/icons-material/Assignment';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import TransformIcon from '@mui/icons-material/Transform';
import ScienceIcon from '@mui/icons-material/Science';
import AssessmentIcon from '@mui/icons-material/Assessment';
import InventoryIcon from '@mui/icons-material/Inventory';
import PeopleIcon from '@mui/icons-material/People';
import AccountBalanceBookIcon from '@mui/icons-material/MenuBook';
import HistoryIcon from '@mui/icons-material/History';
import RefreshIcon from '@mui/icons-material/Refresh';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend
);

const formatIndianCurrency = (num) => {
  if (num === null || num === undefined || isNaN(num)) return '₹0.00';
  const val = Number(num);
  return '₹' + val.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
};

const formatNumber = (num) => {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Number(num).toLocaleString('en-IN');
};

const formatRelativeTime = (dateStr) => {
  if (!dateStr || dateStr === 'Recently') return 'Recently';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return d.toLocaleDateString('en-GB');
  } catch {
    return dateStr;
  }
};

const Dashboard = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartMode, setChartMode] = useState('purchases_vs_sales'); // 'purchases_vs_sales' | 'purchases_vs_returns' | 'production'

  const [stats, setStats] = useState({
    totalPurchases: 0,
    totalPurchasesQty: 0,
    totalPurchasesWeight: 0,
    totalPurchasesAmount: 0,

    totalSales: 0,
    totalSalesQty: 0,
    totalSalesWeight: 0,
    totalSalesAmount: 0,

    totalReturns: 0,
    totalReturnsQty: 0,
    totalReturnsWeight: 0,
    totalReturnsAmount: 0,

    totalGrains: 0,
    totalGrainsInputQty: 0,
    totalGrainsOutput: 0,
    totalGrainsOutputQty: 0,
    totalGrainsBatches: 0,

    totalFlourOut: 0,
    totalFlourOutQty: 0,
    totalFlourOutBatches: 0,

    pendingPRs: 0,
    stockSummary: { total_lots: 0, total_qty: 0 }
  });

  const [monthlyTrends, setMonthlyTrends] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await api('/dashboard/stats');
      if (data && (data.success || data.stats)) {
        if (data.stats) setStats(data.stats);
        if (data.monthlyTrends) setMonthlyTrends(data.monthlyTrends);
        if (data.recentActivities) setRecentActivities(data.recentActivities);
      } else {
        await fetchFallbackData();
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      await fetchFallbackData();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchFallbackData = async () => {
    try {
      const [pRes, sRes, prRes, gRes, foRes] = await Promise.all([
        api('/purchases/purchase-list').catch(() => null),
        api('/sales/list').catch(() => null),
        api('/purchase-returns/list').catch(() => null),
        api('/grains/list').catch(() => null),
        api('/flour-out/list').catch(() => null),
      ]);

      const pArr = Array.isArray(pRes) ? pRes : (pRes?.data || []);
      const sArr = Array.isArray(sRes) ? sRes : (sRes?.data || []);
      const prArr = Array.isArray(prRes) ? prRes : (prRes?.data || []);
      const gArr = Array.isArray(gRes) ? gRes : (gRes?.data || []);
      const foArr = Array.isArray(foRes) ? foRes : (foRes?.data || []);

      const totalPurchasesAmount = pArr.reduce((sum, item) => sum + (Number(item.grand_total || item.total_amount) || 0), 0);
      const totalPurchasesQty = pArr.reduce((sum, item) => sum + (Number(item.total_qty) || 0), 0);
      const totalPurchasesWeight = pArr.reduce((sum, item) => sum + (Number(item.total_weight) || 0), 0);

      const totalSalesAmount = sArr.reduce((sum, item) => sum + (Number(item.grand_total || item.total_amt) || 0), 0);
      const totalSalesQty = sArr.reduce((sum, item) => sum + (Number(item.total_qty) || 0), 0);
      const totalSalesWeight = sArr.reduce((sum, item) => sum + (Number(item.total_wt) || 0), 0);

      const totalReturnsAmount = prArr.reduce((sum, item) => sum + (Number(item.grand_total || item.total_amount) || 0), 0);
      const totalReturnsQty = prArr.reduce((sum, item) => sum + (Number(item.total_qty) || 0), 0);
      const totalReturnsWeight = prArr.reduce((sum, item) => sum + (Number(item.total_weight) || 0), 0);

      const totalGrains = gArr.reduce((sum, item) => sum + (Number(item.total_input_weight || item.total_wt) || 0), 0);
      const totalFlourOut = foArr.reduce((sum, item) => sum + (Number(item.total_weight) || 0), 0);
      const totalFlourOutQty = foArr.reduce((sum, item) => sum + (Number(item.total_qty) || 0), 0);

      setStats(prev => ({
        ...prev,
        totalPurchases: pArr.length,
        totalPurchasesQty,
        totalPurchasesWeight,
        totalPurchasesAmount,

        totalSales: sArr.length,
        totalSalesQty,
        totalSalesWeight,
        totalSalesAmount,

        totalReturns: prArr.length,
        totalReturnsQty,
        totalReturnsWeight,
        totalReturnsAmount,

        totalGrains,
        totalGrainsBatches: gArr.length,

        totalFlourOut,
        totalFlourOutQty,
        totalFlourOutBatches: foArr.length
      }));
    } catch (e) {
      console.error('Fallback fetch error:', e);
    }
  };

  // Build Dynamic Chart Data based on chartMode
  const chartLabels = monthlyTrends.length > 0 ? monthlyTrends.map(m => m.label) : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

  let chartDatasets = [];
  let chartTitle = 'Monthly Performance Trends';

  if (chartMode === 'purchases_vs_sales') {
    chartTitle = 'Monthly Purchases vs Sales Amount (₹)';
    chartDatasets = [
      {
        label: 'Purchases (₹)',
        data: monthlyTrends.length > 0 ? monthlyTrends.map(m => m.purchasesAmount) : [0, 0, 0, 0, 0, 0],
        backgroundColor: 'rgba(31, 79, 178, 0.85)',
        borderColor: '#1f4fb2',
        borderWidth: 1,
        borderRadius: 4
      },
      {
        label: 'Sales (₹)',
        data: monthlyTrends.length > 0 ? monthlyTrends.map(m => m.salesAmount) : [0, 0, 0, 0, 0, 0],
        backgroundColor: 'rgba(16, 185, 129, 0.85)',
        borderColor: '#10b981',
        borderWidth: 1,
        borderRadius: 4
      }
    ];
  } else if (chartMode === 'purchases_vs_returns') {
    chartTitle = 'Monthly Purchases vs Returns Count';
    chartDatasets = [
      {
        label: 'Purchase Invoices',
        data: monthlyTrends.length > 0 ? monthlyTrends.map(m => m.purchasesCount) : [0, 0, 0, 0, 0, 0],
        backgroundColor: 'rgba(31, 79, 178, 0.85)',
        borderRadius: 4
      },
      {
        label: 'Returns Invoices',
        data: monthlyTrends.length > 0 ? monthlyTrends.map(m => m.returnsCount) : [0, 0, 0, 0, 0, 0],
        backgroundColor: 'rgba(225, 29, 72, 0.85)',
        borderRadius: 4
      }
    ];
  } else if (chartMode === 'production') {
    chartTitle = 'Monthly Production: Grains In (kg) vs Flour Out (kg)';
    chartDatasets = [
      {
        label: 'Grains Processed (kg)',
        data: monthlyTrends.length > 0 ? monthlyTrends.map(m => m.grainsWeight) : [0, 0, 0, 0, 0, 0],
        backgroundColor: 'rgba(202, 138, 4, 0.85)',
        borderRadius: 4
      },
      {
        label: 'Flour Dispatched (kg)',
        data: monthlyTrends.length > 0 ? monthlyTrends.map(m => m.flourOutWeight) : [0, 0, 0, 0, 0, 0],
        backgroundColor: 'rgba(234, 88, 12, 0.85)',
        borderRadius: 4
      }
    ];
  }

  const chartData = {
    labels: chartLabels,
    datasets: chartDatasets
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { font: { family: 'Arial', size: 12, weight: '600' }, boxWidth: 14 }
      },
      title: {
        display: true,
        text: chartTitle,
        font: { size: 14, weight: 'bold' },
        color: '#1e293b',
        padding: { bottom: 12 }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            let val = context.parsed.y;
            if (chartMode === 'purchases_vs_sales') {
              return `${label}: ₹${Number(val).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
            } else if (chartMode === 'production') {
              return `${label}: ${Number(val).toLocaleString('en-IN')} kg`;
            }
            return `${label}: ${val}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: '#f1f5f9' },
        ticks: {
          callback: function(value) {
            if (chartMode === 'purchases_vs_sales') {
              if (value >= 10000000) return '₹' + (value / 10000000).toFixed(1) + ' Cr';
              if (value >= 100000) return '₹' + (value / 100000).toFixed(1) + ' L';
              if (value >= 1000) return '₹' + (value / 1000).toFixed(0) + ' k';
              return '₹' + value;
            }
            if (chartMode === 'production' && value >= 1000) {
              return (value / 1000).toFixed(0) + 'k kg';
            }
            return value;
          }
        }
      },
      x: { grid: { display: false } }
    }
  };

  // Main & Regular Module Shortcuts
  const shortcutModules = [
    { title: 'Purchase Request', icon: <AssignmentIcon sx={{ color: '#0284c7' }} />, path: '/entry/purchase-request-dashboard', bg: '#e0f2fe', desc: 'Create & Approve PRs' },
    { title: 'Purchase Entry', icon: <AddShoppingCartIcon sx={{ color: '#16a34a' }} />, path: '/entry/purchase-create', bg: '#dcfce7', desc: 'New Goods Receipt' },
    { title: 'Purchase Display', icon: <ListAltIcon sx={{ color: '#0284c7' }} />, path: '/entry/purchase-display', bg: '#e0f2fe', desc: 'View All Invoices' },
    { title: 'Sales Entry', icon: <PointOfSaleIcon sx={{ color: '#10b981' }} />, path: '/entry/sales-create', bg: '#d1fae5', desc: 'New Sales Invoice' },
    { title: 'Sales Display', icon: <AssessmentIcon sx={{ color: '#059669' }} />, path: '/entry/sales-display', bg: '#ecfdf5', desc: 'View Sales Log' },
    { title: 'Work Order Slip', icon: <AssignmentIcon sx={{ color: '#2563eb' }} />, path: '/entry/work-order-slip-display', bg: '#dbeafe', desc: 'Pre-Grind Slips & Wastage' },
    { title: 'Grind Entry', icon: <TransformIcon sx={{ color: '#ca8a04' }} />, path: '/entry/grind-create', bg: '#fef9c3', desc: 'Grains Grinding' },
    { title: 'Flour Out', icon: <BakeryDiningIcon sx={{ color: '#ea580c' }} />, path: '/entry/flour-out-create', bg: '#ffedd5', desc: 'Flour Dispatch' },
    { title: 'Purchase Returns', icon: <AssignmentReturnIcon sx={{ color: '#e11d48' }} />, path: '/entry/purchase-return-display', bg: '#ffe4e6', desc: 'Return Vouchers' },
    { title: 'Godown Transfer', icon: <LocalShippingIcon sx={{ color: '#9333ea' }} />, path: '/entry/godown-transfer-create', bg: '#f3e8ff', desc: 'Stock Transfer' },
    { title: 'Quality Control', icon: <ScienceIcon sx={{ color: '#059669' }} />, path: '/quality/dashboard', bg: '#d1fae5', desc: 'Lab & QC Reports' },
    { title: 'Stock Report', icon: <AssessmentIcon sx={{ color: '#2563eb' }} />, path: '/report/stock-report', bg: '#dbeafe', desc: 'Real-time Inventory' },
    { title: 'Day Book', icon: <AccountBalanceBookIcon sx={{ color: '#475569' }} />, path: '/reports/day-book', bg: '#f1f5f9', desc: 'Financial Day Log' },
  ];

  const getActivityBadgeColor = (type) => {
    switch ((type || '').toLowerCase()) {
      case 'purchase': return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
      case 'sales': return { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' };
      case 'grind': return { bg: '#fefce8', color: '#a16207', border: '#fde047' };
      case 'flour out': return { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' };
      case 'return': return { bg: '#fff1f2', color: '#be123c', border: '#fecdd3' };
      default: return { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' };
    }
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      {/* Title Banner with Live Refresh */}
      <Paper sx={{ 
        p: 2, 
        mb: 3, 
        backgroundColor: '#3c78d8', 
        color: 'white', 
        borderRadius: '6px', 
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 'bold', letterSpacing: '0.5px' }}>
            Executive Dashboard
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)' }}>
            Real-time Inventory, Production & Financial Summary
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Refresh Dashboard Metrics">
            <IconButton 
              size="small" 
              onClick={() => fetchDashboardData(true)} 
              sx={{ color: 'white', backgroundColor: 'rgba(255,255,255,0.15)', '&:hover': { backgroundColor: 'rgba(255,255,255,0.3)' } }}
            >
              {refreshing ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>

      {/* Purchase Request Alert Message Banner */}
      {stats.pendingPRs > 0 && (
        <Alert
          severity="warning"
          variant="filled"
          sx={{
            mb: 3,
            borderRadius: '8px',
            backgroundColor: '#e65100',
            boxShadow: '0 3px 10px rgba(230,81,0,0.25)',
            '& .MuiAlert-icon': { fontSize: '28px' }
          }}
          action={
            <Button
              color="inherit"
              size="small"
              variant="outlined"
              onClick={() => navigate('/entry/purchase-request-approval')}
              sx={{
                fontWeight: 'bold',
                color: '#ffffff',
                borderColor: '#ffffff',
                backgroundColor: 'rgba(255,255,255,0.15)',
                '&:hover': { backgroundColor: 'rgba(255,255,255,0.3)', borderColor: '#ffffff' },
                textTransform: 'none',
                px: 2
              }}
            >
              Review & Act Now ({stats.pendingPRs})
            </Button>
          }
        >
          <AlertTitle sx={{ fontWeight: 'bold', fontSize: '15px' }}>
            🔔 Action Required: Pending Purchase Requisitions
          </AlertTitle>
          You have <strong>{stats.pendingPRs}</strong> purchase request(s) waiting for manager review and approval in the Purchase Request Approval Workbench.
        </Alert>
      )}

      {/* Top 5 Core Application KPI Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {/* 1. Total Purchases */}
        <Grid item xs={12} sm={6} md={4} lg={2.4}>
          <Card 
            sx={{ 
              borderRadius: '8px', 
              borderLeft: '5px solid #1f4fb2', 
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              cursor: 'pointer',
              transition: 'transform 0.15s, box-shadow 0.15s',
              '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }
            }}
            onClick={() => navigate('/entry/purchase-display')}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography color="textSecondary" variant="body2" sx={{ fontWeight: 600, fontSize: '13px' }}>
                  Total Purchases
                </Typography>
                <ShoppingCartIcon sx={{ color: '#1f4fb2', fontSize: '20px', opacity: 0.8 }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#1f4fb2', mt: 0.5, fontSize: '26px' }}>
                {stats.totalPurchases}
              </Typography>
              <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>
                  Qty: {formatNumber(stats.totalPurchasesQty)} bags
                </Typography>
                <Typography variant="caption" sx={{ color: '#1e293b', fontWeight: 700 }}>
                  Val: {formatIndianCurrency(stats.totalPurchasesAmount)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 2. Total Sales */}
        <Grid item xs={12} sm={6} md={4} lg={2.4}>
          <Card 
            sx={{ 
              borderRadius: '8px', 
              borderLeft: '5px solid #10b981', 
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              cursor: 'pointer',
              transition: 'transform 0.15s, box-shadow 0.15s',
              '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }
            }}
            onClick={() => navigate('/entry/sales-display')}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography color="textSecondary" variant="body2" sx={{ fontWeight: 600, fontSize: '13px' }}>
                  Total Sales
                </Typography>
                <PointOfSaleIcon sx={{ color: '#10b981', fontSize: '20px', opacity: 0.8 }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#10b981', mt: 0.5, fontSize: '26px' }}>
                {stats.totalSales}
              </Typography>
              <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>
                  Qty: {formatNumber(stats.totalSalesQty)} bags
                </Typography>
                <Typography variant="caption" sx={{ color: '#1e293b', fontWeight: 700 }}>
                  Val: {formatIndianCurrency(stats.totalSalesAmount)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 3. Total Returns */}
        <Grid item xs={12} sm={6} md={4} lg={2.4}>
          <Card 
            sx={{ 
              borderRadius: '8px', 
              borderLeft: '5px solid #e11d48', 
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              cursor: 'pointer',
              transition: 'transform 0.15s, box-shadow 0.15s',
              '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }
            }}
            onClick={() => navigate('/entry/purchase-return-display')}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography color="textSecondary" variant="body2" sx={{ fontWeight: 600, fontSize: '13px' }}>
                  Total Returns
                </Typography>
                <AssignmentReturnIcon sx={{ color: '#e11d48', fontSize: '20px', opacity: 0.8 }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#e11d48', mt: 0.5, fontSize: '26px' }}>
                {stats.totalReturns}
              </Typography>
              <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>
                  Qty: {formatNumber(stats.totalReturnsQty)} bags
                </Typography>
                <Typography variant="caption" sx={{ color: '#1e293b', fontWeight: 700 }}>
                  Val: {formatIndianCurrency(stats.totalReturnsAmount)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 4. Total Grains (kg) */}
        <Grid item xs={12} sm={6} md={4} lg={2.4}>
          <Card 
            sx={{ 
              borderRadius: '8px', 
              borderLeft: '5px solid #ca8a04', 
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              cursor: 'pointer',
              transition: 'transform 0.15s, box-shadow 0.15s',
              '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }
            }}
            onClick={() => navigate('/entry/grind-display')}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography color="textSecondary" variant="body2" sx={{ fontWeight: 600, fontSize: '13px' }}>
                  Total Grains (kg)
                </Typography>
                <GrainIcon sx={{ color: '#ca8a04', fontSize: '20px', opacity: 0.8 }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#ca8a04', mt: 0.5, fontSize: '26px' }}>
                {formatNumber(stats.totalGrains)}
              </Typography>
              <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>
                  In: {formatNumber(stats.totalGrainsInputQty)} bags ({stats.totalGrainsBatches} batches)
                </Typography>
                <Typography variant="caption" sx={{ color: '#16a34a', fontWeight: 700 }}>
                  Out: {formatNumber(stats.totalGrainsOutput)} kg
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 5. Flour Out (kg) */}
        <Grid item xs={12} sm={6} md={4} lg={2.4}>
          <Card 
            sx={{ 
              borderRadius: '8px', 
              borderLeft: '5px solid #ea580c', 
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              cursor: 'pointer',
              transition: 'transform 0.15s, box-shadow 0.15s',
              '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }
            }}
            onClick={() => navigate('/entry/flour-out-display')}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography color="textSecondary" variant="body2" sx={{ fontWeight: 600, fontSize: '13px' }}>
                  Flour Out (kg)
                </Typography>
                <BakeryDiningIcon sx={{ color: '#ea580c', fontSize: '20px', opacity: 0.8 }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#ea580c', mt: 0.5, fontSize: '26px' }}>
                {formatNumber(stats.totalFlourOut)}
              </Typography>
              <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>
                  Qty: {formatNumber(stats.totalFlourOutQty)} bags dispatched
                </Typography>
                <Typography variant="caption" sx={{ color: '#ea580c', fontWeight: 700 }}>
                  Dispatches: {stats.totalFlourOutBatches} records
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main & Regular Module Shortcuts */}
      <Paper sx={{ p: 2.5, mb: 3, borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#1e293b', fontSize: '16px' }}>
            ⚡ Main & Regular Module Shortcuts
          </Typography>
          <Chip label="Quick Access" size="small" color="primary" sx={{ fontWeight: 'bold' }} />
        </Box>

        <Grid container spacing={2}>
          {shortcutModules.map((m, idx) => (
            <Grid item xs={6} sm={4} md={3} lg={2} key={idx}>
              <Card 
                variant="outlined" 
                sx={{ 
                  borderRadius: '8px', 
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': { 
                    transform: 'translateY(-3px)', 
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    borderColor: '#1f4fb2' 
                  } 
                }}
              >
                <CardActionArea onClick={() => navigate(m.path)} sx={{ p: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.8 }}>
                    <Box sx={{ p: 1, borderRadius: '6px', backgroundColor: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {m.icon}
                    </Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#0f172a', lineHeight: 1.2 }}>
                      {m.title}
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: '#64748b', fontSize: '11px', display: 'block' }}>
                    {m.desc}
                  </Typography>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Analytics Charts & Live Activities */}
      <Grid container spacing={3}>
        {/* Monthly Performance Trends with Interactive Filter */}
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 2.5, borderRadius: '8px', border: '1px solid #e2e8f0', minHeight: '380px' }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUpIcon sx={{ color: '#1f4fb2' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                  Analytics & Trends
                </Typography>
              </Box>

              <ButtonGroup size="small" variant="outlined">
                <Button 
                  variant={chartMode === 'purchases_vs_sales' ? 'contained' : 'outlined'}
                  onClick={() => setChartMode('purchases_vs_sales')}
                  sx={{ textTransform: 'none', fontWeight: 600, fontSize: '12px' }}
                >
                  Purchases vs Sales
                </Button>
                <Button 
                  variant={chartMode === 'purchases_vs_returns' ? 'contained' : 'outlined'}
                  onClick={() => setChartMode('purchases_vs_returns')}
                  sx={{ textTransform: 'none', fontWeight: 600, fontSize: '12px' }}
                >
                  Purchases vs Returns
                </Button>
                <Button 
                  variant={chartMode === 'production' ? 'contained' : 'outlined'}
                  onClick={() => setChartMode('production')}
                  sx={{ textTransform: 'none', fontWeight: 600, fontSize: '12px' }}
                >
                  Grains vs Flour Out
                </Button>
              </ButtonGroup>
            </Box>

            <Box sx={{ height: '300px' }}>
              {loading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <CircularProgress size={32} />
                </Box>
              ) : (
                <Bar data={chartData} options={chartOptions} />
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Live Recent Activities */}
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 2.5, borderRadius: '8px', border: '1px solid #e2e8f0', minHeight: '380px', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                Recent Live Transactions
              </Typography>
              <HistoryIcon fontSize="small" sx={{ color: '#64748b' }} />
            </Box>
            <Divider sx={{ mb: 1.5 }} />

            {loading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexGrow: 1 }}>
                <CircularProgress size={28} />
              </Box>
            ) : recentActivities.length === 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexGrow: 1, color: '#94a3b8' }}>
                <Typography variant="body2">No recent transaction records</Typography>
              </Box>
            ) : (
              <List disablePadding sx={{ flexGrow: 1, overflowY: 'auto', maxHeight: '310px' }}>
                {recentActivities.map((act, index) => {
                  const badge = getActivityBadgeColor(act.type);
                  return (
                    <React.Fragment key={act.id || index}>
                      <ListItem sx={{ px: 0, py: 1, alignItems: 'flex-start' }}>
                        <ListItemText
                          disableTypography
                          primary={
                            <Typography component="div" variant="body2" sx={{ fontWeight: 600, color: '#334155', fontSize: '13px', lineHeight: 1.3 }}>
                              {act.action}
                            </Typography>
                          }
                          secondary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.4 }}>
                              <Typography component="span" variant="caption" sx={{ color: '#94a3b8', fontSize: '11px' }}>
                                {formatRelativeTime(act.time)}
                              </Typography>
                              {act.amount > 0 && (
                                <Typography component="span" variant="caption" sx={{ color: '#0f766e', fontWeight: 'bold', fontSize: '11px' }}>
                                  • {formatIndianCurrency(act.amount)}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                        <Chip 
                          label={act.type} 
                          size="small" 
                          sx={{ 
                            fontSize: '10px', 
                            height: '20px', 
                            fontWeight: 'bold',
                            backgroundColor: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                            ml: 1,
                            mt: 0.5
                          }} 
                        />
                      </ListItem>
                      {index < recentActivities.length - 1 && <Divider component="li" />}
                    </React.Fragment>
                  );
                })}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard;
