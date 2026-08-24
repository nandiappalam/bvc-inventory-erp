import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Container,
  Paper,
  Grid,
  Typography,
  TextField,
  MenuItem,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Card,
  CardContent,
  Alert
} from '@mui/material';
import {
  NotificationsActive as AlertIcon,
  Warning as WarningIcon,
  Error as CriticalIcon,
  CheckCircle as NormalIcon,
  Refresh as RefreshIcon,
  Print as PrintIcon,
  FileDownload as ExportIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  People as ContactsIcon,
  AddShoppingCart as PurchaseIcon,
  Layers as LotIcon,
  Warehouse as GodownIcon,
  Close as CloseIcon,
  History as HistoryIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  DoneAll as ResolveIcon
} from '@mui/icons-material';
import { useNavigate, Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { printHtml } from '../../utils/printHelper';

const themeColors = {
  primary: '#1f4fb2',
  secondary: '#2a5ea0',
  critical: '#dc2626',
  criticalBg: '#fef2f2',
  criticalBorder: '#fca5a5',
  low: '#ea580c',
  lowBg: '#fff7ed',
  lowBorder: '#fdba74',
  reorder: '#d97706',
  reorderBg: '#fffbeb',
  reorderBorder: '#fde68a',
  normal: '#16a34a',
  normalBg: '#f0fdf4',
  normalBorder: '#86efac'
};

const StockAlertDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    summary: {
      totalConfigured: 0,
      criticalCount: 0,
      lowStockCount: 0,
      reorderCount: 0,
      normalCount: 0,
      totalAlerts: 0
    },
    items: [],
    history: [],
    notifications: []
  });

  const [activeTab, setActiveTab] = useState(0);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [godownFilter, setGodownFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [godowns, setGodowns] = useState([]);

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Lot breakdown modal
  const [selectedItemLots, setSelectedItemLots] = useState(null);

  // Fetch Dashboard Data
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stock-alerts/dashboard');
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const text = await res.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch (parseErr) {
        // Non-json response
      }

      if (json && json.success) {
        setData({
          summary: json.summary || {},
          items: json.items || [],
          history: json.history || [],
          notifications: json.notifications || []
        });
      }
    } catch (err) {
      // Handle network error quietly
    } finally {
      setLoading(false);
    }
  };

  // Fetch Godowns & initial data
  useEffect(() => {
    fetch('/api/godowns')
      .then(res => res.ok ? res.json() : [])
      .then(list => {
        if (Array.isArray(list)) setGodowns(list);
      })
      .catch(() => {});

    fetchDashboardData();

    // Auto-update on custom stock-alerts-updated event
    const handleStockUpdate = () => {
      fetchDashboardData();
    };
    window.addEventListener('stock-alerts-updated', handleStockUpdate);

    // Periodic sync every 20 seconds
    const interval = setInterval(fetchDashboardData, 20000);

    return () => {
      window.removeEventListener('stock-alerts-updated', handleStockUpdate);
      clearInterval(interval);
    };
  }, []);

  // Trigger evaluation
  const handleReevaluate = async () => {
    setLoading(true);
    try {
      await fetch('/api/stock-alerts/evaluate', { method: 'POST' });
      await fetchDashboardData();
      window.dispatchEvent(new CustomEvent('stock-alerts-updated'));
    } catch (e) {
      console.error('Error triggering stock alert evaluation:', e);
    } finally {
      setLoading(false);
    }
  };

  // Manual Resolve
  const handleResolveAlert = async (alertId) => {
    try {
      await fetch(`/api/stock-alerts/resolve/${alertId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Manually verified and marked as reviewed' })
      });
      fetchDashboardData();
      window.dispatchEvent(new CustomEvent('stock-alerts-updated'));
    } catch (err) {
      console.error('Error resolving alert:', err);
    }
  };

  // Filter items
  const filteredItems = useMemo(() => {
    return (data.items || []).filter(item => {
      // Status Filter
      if (statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false;
      }
      // Godown Filter
      if (godownFilter !== 'ALL') {
        const itemG = (item.godown_name || '').toLowerCase();
        const targetG = godownFilter.toLowerCase();
        if (itemG !== targetG && itemG !== 'all godowns' && !item.godowns?.some(g => g.toLowerCase() === targetG)) {
          return false;
        }
      }
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (item.item_name || '').toLowerCase().includes(q);
        const godownMatch = (item.godown_name || '').toLowerCase().includes(q);
        const lotMatch = item.lots?.some(l => (l.lot_no || '').toLowerCase().includes(q));
        if (!nameMatch && !godownMatch && !lotMatch) return false;
      }
      return true;
    });
  }, [data.items, statusFilter, godownFilter, searchQuery]);

  // Export Excel
  const handleExportExcel = () => {
    const exportRows = filteredItems.map((item, idx) => ({
      'S.No': idx + 1,
      'Item Name': item.item_name,
      'Godown': item.godown_name,
      'Current Stock (Kg)': item.current_qty.toFixed(2),
      'Critical Level (Kg)': item.critical_level || 0,
      'Minimum Stock (Kg)': item.minimum_qty || 0,
      'Reorder Level (Kg)': item.reorder_level || 0,
      'Status': item.status,
      'Available Lots': item.lots?.map(l => `${l.lot_no} (${l.qty} Kg)`).join(', ') || 'None',
      'Contacts': item.contacts?.map(c => c.contact_name).join(', ') || 'N/A'
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Alerts');
    XLSX.writeFile(wb, `BVC_Stock_Alerts_${new Date().toISOString().substring(0, 10)}.xlsx`);
  };

  // Print Report
  const handlePrint = () => {
    const printContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #1f4fb2; padding-bottom: 10px;">
          <h2 style="margin: 0; color: #1f4fb2; text-transform: uppercase;">BVC ERP - Stock Alert & Reorder Status Report</h2>
          <p style="margin: 5px 0 0 0; font-size: 13px; color: #555;">Generated on: ${new Date().toLocaleString('en-IN')}</p>
        </div>

        <div style="display: flex; gap: 15px; margin-bottom: 20px;">
          <div style="flex: 1; padding: 10px; border: 1px solid #dc2626; background: #fef2f2; border-radius: 4px; text-align: center;">
            <div style="font-size: 12px; color: #991b1b; font-weight: bold;">CRITICAL STOCK</div>
            <div style="font-size: 20px; font-weight: bold; color: #dc2626;">${data.summary.criticalCount} Items</div>
          </div>
          <div style="flex: 1; padding: 10px; border: 1px solid #ea580c; background: #fff7ed; border-radius: 4px; text-align: center;">
            <div style="font-size: 12px; color: #9a3412; font-weight: bold;">LOW STOCK</div>
            <div style="font-size: 20px; font-weight: bold; color: #ea580c;">${data.summary.lowStockCount} Items</div>
          </div>
          <div style="flex: 1; padding: 10px; border: 1px solid #d97706; background: #fffbeb; border-radius: 4px; text-align: center;">
            <div style="font-size: 12px; color: #92400e; font-weight: bold;">REORDER REQUIRED</div>
            <div style="font-size: 20px; font-weight: bold; color: #d97706;">${data.summary.reorderCount} Items</div>
          </div>
          <div style="flex: 1; padding: 10px; border: 1px solid #16a34a; background: #f0fdf4; border-radius: 4px; text-align: center;">
            <div style="font-size: 12px; color: #166534; font-weight: bold;">NORMAL STOCK</div>
            <div style="font-size: 20px; font-weight: bold; color: #16a34a;">${data.summary.normalCount} Items</div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">S.No</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Item Name</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Godown</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">Current Stock</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">Critical</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">Min Stock</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">Reorder Level</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${filteredItems.map((item, i) => `
              <tr style="background-color: ${
                item.status === 'CRITICAL' ? '#fef2f2' :
                item.status === 'LOW' ? '#fff7ed' :
                item.status === 'REORDER' ? '#fffbeb' : '#ffffff'
              };">
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${i + 1}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: bold;">${item.item_name}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px;">${item.godown_name}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: bold; color: ${
                  item.status === 'CRITICAL' ? '#dc2626' :
                  item.status === 'LOW' ? '#ea580c' :
                  item.status === 'REORDER' ? '#d97706' : '#16a34a'
                };">${item.current_qty.toFixed(2)} Kg</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">${item.critical_level || 0}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">${item.minimum_qty || 0}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">${item.reorder_level || 0}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; font-weight: bold; color: ${
                  item.status === 'CRITICAL' ? '#dc2626' :
                  item.status === 'LOW' ? '#ea580c' :
                  item.status === 'REORDER' ? '#d97706' : '#16a34a'
                };">${item.status}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    printHtml(printContent);
  };

  const getStatusChip = (status) => {
    switch (status) {
      case 'CRITICAL':
        return (
          <Chip
            icon={<CriticalIcon sx={{ fontSize: '16px !important', color: '#dc2626 !important' }} />}
            label="CRITICAL STOCK"
            size="small"
            sx={{
              backgroundColor: themeColors.criticalBg,
              color: themeColors.critical,
              border: `1px solid ${themeColors.criticalBorder}`,
              fontWeight: 'bold',
              fontSize: '11px'
            }}
          />
        );
      case 'LOW':
        return (
          <Chip
            icon={<WarningIcon sx={{ fontSize: '16px !important', color: '#ea580c !important' }} />}
            label="LOW STOCK"
            size="small"
            sx={{
              backgroundColor: themeColors.lowBg,
              color: themeColors.low,
              border: `1px solid ${themeColors.lowBorder}`,
              fontWeight: 'bold',
              fontSize: '11px'
            }}
          />
        );
      case 'REORDER':
        return (
          <Chip
            icon={<AlertIcon sx={{ fontSize: '16px !important', color: '#d97706 !important' }} />}
            label="REORDER REQUIRED"
            size="small"
            sx={{
              backgroundColor: themeColors.reorderBg,
              color: themeColors.reorder,
              border: `1px solid ${themeColors.reorderBorder}`,
              fontWeight: 'bold',
              fontSize: '11px'
            }}
          />
        );
      default:
        return (
          <Chip
            icon={<NormalIcon sx={{ fontSize: '16px !important', color: '#16a34a !important' }} />}
            label="NORMAL"
            size="small"
            sx={{
              backgroundColor: themeColors.normalBg,
              color: themeColors.normal,
              border: `1px solid ${themeColors.normalBorder}`,
              fontWeight: 'bold',
              fontSize: '11px'
            }}
          />
        );
    }
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 3, mb: 5 }}>
      {/* Top Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 'bold', color: themeColors.primary, display: 'flex', alignItems: 'center', gap: 1 }}>
            <AlertIcon /> Minimum Stock & Low Stock Alert Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Centralized item-wise & godown-wise inventory threshold monitoring with automated stock ledger synchronization
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={handleReevaluate}
            disabled={loading}
            sx={{ borderColor: themeColors.primary, color: themeColors.primary }}
          >
            {loading ? 'Evaluating...' : 'Re-evaluate Stock'}
          </Button>

          <Button
            variant="contained"
            size="small"
            component={Link}
            to="/features/stock-alert-config"
            startIcon={<SettingsIcon />}
            sx={{ backgroundColor: themeColors.primary, '&:hover': { backgroundColor: themeColors.secondary } }}
          >
            Threshold Config
          </Button>

          <Button
            variant="outlined"
            size="small"
            component={Link}
            to="/features/stock-alert-contacts"
            startIcon={<ContactsIcon />}
            sx={{ borderColor: '#64748b', color: '#334155' }}
          >
            Alert Contacts
          </Button>
        </Stack>
      </Box>

      {/* Summary KPI Metric Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Total Monitored */}
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ border: '1px solid #cbd5e1', boxShadow: '0 2px 4px rgba(0,0,0,0.04)', borderRadius: '8px' }}>
            <CardContent sx={{ p: '16px !important' }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>
                Total Items Monitored
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#1e293b', my: 0.5 }}>
                {data.summary.totalConfigured || 0}
              </Typography>
              <Typography variant="caption" sx={{ color: '#0284c7', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <GodownIcon fontSize="inherit" /> Godown & Item Level
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Critical Stock */}
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{
            border: `1px solid ${themeColors.criticalBorder}`,
            backgroundColor: themeColors.criticalBg,
            boxShadow: '0 2px 4px rgba(220,38,38,0.08)',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'transform 0.15s ease',
            '&:hover': { transform: 'translateY(-2px)' }
          }}
          onClick={() => setStatusFilter(statusFilter === 'CRITICAL' ? 'ALL' : 'CRITICAL')}
          >
            <CardContent sx={{ p: '16px !important' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: '#991b1b', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  Critical Level
                </Typography>
                <CriticalIcon sx={{ color: '#dc2626', fontSize: '20px' }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#dc2626', my: 0.5 }}>
                {data.summary.criticalCount || 0}
              </Typography>
              <Typography variant="caption" sx={{ color: '#b91c1c', fontWeight: 500 }}>
                Stock &le; Critical Threshold
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Low Stock */}
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{
            border: `1px solid ${themeColors.lowBorder}`,
            backgroundColor: themeColors.lowBg,
            boxShadow: '0 2px 4px rgba(234,88,12,0.08)',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'transform 0.15s ease',
            '&:hover': { transform: 'translateY(-2px)' }
          }}
          onClick={() => setStatusFilter(statusFilter === 'LOW' ? 'ALL' : 'LOW')}
          >
            <CardContent sx={{ p: '16px !important' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: '#9a3412', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  Low Stock
                </Typography>
                <WarningIcon sx={{ color: '#ea580c', fontSize: '20px' }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#ea580c', my: 0.5 }}>
                {data.summary.lowStockCount || 0}
              </Typography>
              <Typography variant="caption" sx={{ color: '#c2410c', fontWeight: 500 }}>
                Stock &le; Minimum Qty
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Reorder Required */}
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{
            border: `1px solid ${themeColors.reorderBorder}`,
            backgroundColor: themeColors.reorderBg,
            boxShadow: '0 2px 4px rgba(217,119,6,0.08)',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'transform 0.15s ease',
            '&:hover': { transform: 'translateY(-2px)' }
          }}
          onClick={() => setStatusFilter(statusFilter === 'REORDER' ? 'ALL' : 'REORDER')}
          >
            <CardContent sx={{ p: '16px !important' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: '#92400e', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  Reorder Required
                </Typography>
                <AlertIcon sx={{ color: '#d97706', fontSize: '20px' }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#d97706', my: 0.5 }}>
                {data.summary.reorderCount || 0}
              </Typography>
              <Typography variant="caption" sx={{ color: '#b45309', fontWeight: 500 }}>
                Stock &le; Reorder Level
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Normal Stock */}
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{
            border: `1px solid ${themeColors.normalBorder}`,
            backgroundColor: themeColors.normalBg,
            boxShadow: '0 2px 4px rgba(22,163,74,0.08)',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'transform 0.15s ease',
            '&:hover': { transform: 'translateY(-2px)' }
          }}
          onClick={() => setStatusFilter(statusFilter === 'NORMAL' ? 'ALL' : 'NORMAL')}
          >
            <CardContent sx={{ p: '16px !important' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: '#166534', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  Normal Stock
                </Typography>
                <NormalIcon sx={{ color: '#16a34a', fontSize: '20px' }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#16a34a', my: 0.5 }}>
                {data.summary.normalCount || 0}
              </Typography>
              <Typography variant="caption" sx={{ color: '#15803d', fontWeight: 500 }}>
                Healthy Inventory
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs: Live Status vs History & Notifications */}
      <Paper sx={{ mb: 3, border: '1px solid #e2e8f0', borderRadius: '8px' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, pt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
            <Tab label={`Active Stock Status (${filteredItems.length})`} sx={{ fontWeight: 'bold' }} />
            <Tab label={`Alert History & Log (${data.history?.length || 0})`} sx={{ fontWeight: 'bold' }} />
            <Tab label={`Dispatched Notifications (${data.notifications?.length || 0})`} sx={{ fontWeight: 'bold' }} />
          </Tabs>

          <Stack direction="row" spacing={1} sx={{ my: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ExportIcon />}
              onClick={handleExportExcel}
              sx={{ textTransform: 'none', fontSize: '12px' }}
            >
              Export Excel
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<PrintIcon />}
              onClick={handlePrint}
              sx={{ textTransform: 'none', fontSize: '12px' }}
            >
              Print
            </Button>
          </Stack>
        </Box>

        {/* TAB 0: Active Stock Status Table */}
        {activeTab === 0 && (
          <Box sx={{ p: 2 }}>
            {/* Filter Bar */}
            <Grid container spacing={2} sx={{ mb: 2 }} alignItems="center">
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search item, code, lot number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ color: '#94a3b8', mr: 1, fontSize: '20px' }} />
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={3}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Godown Location"
                  value={godownFilter}
                  onChange={(e) => setGodownFilter(e.target.value)}
                >
                  <MenuItem value="ALL">All Godowns</MenuItem>
                  {godowns.map(g => (
                    <MenuItem key={g.id} value={g.godown_name}>{g.godown_name}</MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={3}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Stock Alert Status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="ALL">All Statuses ({data.items.length})</MenuItem>
                  <MenuItem value="CRITICAL">🔴 Critical Stock ({data.summary.criticalCount})</MenuItem>
                  <MenuItem value="LOW">🟠 Low Stock ({data.summary.lowStockCount})</MenuItem>
                  <MenuItem value="REORDER">🟡 Reorder Required ({data.summary.reorderCount})</MenuItem>
                  <MenuItem value="NORMAL">🟢 Normal Stock ({data.summary.normalCount})</MenuItem>
                </TextField>
              </Grid>

              <Grid item xs={12} sm={2}>
                <Button
                  fullWidth
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setSearchQuery('');
                    setGodownFilter('ALL');
                    setStatusFilter('ALL');
                  }}
                  sx={{ height: 40 }}
                >
                  Reset Filters
                </Button>
              </Grid>
            </Grid>

            {/* Table */}
            <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: '6px' }}>
              <Table size="small">
                <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', width: '50px', textAlign: 'center' }}>S.No</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Item Name</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Godown</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Current Stock (Kg)</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Critical Level</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Min Stock Qty</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Reorder Level</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Stock Status</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Traceability (Lots)</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Assigned Contacts</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={11} sx={{ textAlign: 'center', py: 4 }}>
                        <CircularProgress size={32} />
                        <Typography variant="body2" sx={{ mt: 1, color: '#64748b' }}>Calculating stock ledger balances...</Typography>
                      </TableCell>
                    </TableRow>
                  ) : filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="body1" sx={{ color: '#64748b' }}>No items match the selected filter criteria.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((item, idx) => {
                        const isCritical = item.status === 'CRITICAL';
                        const isLow = item.status === 'LOW';
                        const isReorder = item.status === 'REORDER';

                        return (
                          <TableRow
                            key={`${item.item_name}-${item.godown_name}-${idx}`}
                            sx={{
                              backgroundColor: isCritical ? '#fff1f2' : isLow ? '#fff7ed' : isReorder ? '#fffbeb' : 'inherit',
                              '&:hover': {
                                backgroundColor: isCritical ? '#ffe4e6' : isLow ? '#ffedd5' : isReorder ? '#fef3c7' : '#f1f5f9'
                              }
                            }}
                          >
                            <TableCell sx={{ textAlign: 'center', color: '#64748b' }}>
                              {page * rowsPerPage + idx + 1}
                            </TableCell>

                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                                {item.item_name}
                              </Typography>
                            </TableCell>

                            <TableCell>
                              <Chip
                                icon={<GodownIcon sx={{ fontSize: '14px !important' }} />}
                                label={item.godown_name}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '11px', height: '22px' }}
                              />
                            </TableCell>

                            <TableCell sx={{ textAlign: 'right' }}>
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: 'bold',
                                  fontFamily: 'monospace',
                                  fontSize: '13px',
                                  color: isCritical ? '#dc2626' : isLow ? '#ea580c' : isReorder ? '#d97706' : '#16a34a'
                                }}
                              >
                                {item.current_qty.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} Kg
                              </Typography>
                            </TableCell>

                            <TableCell sx={{ textAlign: 'right', color: '#dc2626', fontWeight: 600, fontFamily: 'monospace' }}>
                              {item.critical_level > 0 ? `${item.critical_level} Kg` : '-'}
                            </TableCell>

                            <TableCell sx={{ textAlign: 'right', color: '#ea580c', fontWeight: 600, fontFamily: 'monospace' }}>
                              {item.minimum_qty > 0 ? `${item.minimum_qty} Kg` : '-'}
                            </TableCell>

                            <TableCell sx={{ textAlign: 'right', color: '#d97706', fontWeight: 600, fontFamily: 'monospace' }}>
                              {item.reorder_level > 0 ? `${item.reorder_level} Kg` : '-'}
                            </TableCell>

                            <TableCell sx={{ textAlign: 'center' }}>
                              {getStatusChip(item.status)}
                            </TableCell>

                            <TableCell sx={{ textAlign: 'center' }}>
                              {item.lots && item.lots.length > 0 ? (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<LotIcon sx={{ fontSize: '14px !important' }} />}
                                  onClick={() => setSelectedItemLots(item)}
                                  sx={{ textTransform: 'none', fontSize: '11px', py: 0.2, height: '24px' }}
                                >
                                  {item.lots.length} Lot{item.lots.length > 1 ? 's' : ''}
                                </Button>
                              ) : (
                                <Typography variant="caption" sx={{ color: '#94a3b8' }}>No Lots</Typography>
                              )}
                            </TableCell>

                            <TableCell>
                              <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                                {item.contacts && item.contacts.length > 0 ? (
                                  item.contacts.slice(0, 2).map((c, ci) => (
                                    <Tooltip key={ci} title={`${c.contact_name} (${c.department}) - 📞 ${c.phone || 'N/A'} | ✉️ ${c.email || 'N/A'}`}>
                                      <Chip
                                        label={c.contact_name}
                                        size="small"
                                        sx={{ fontSize: '10px', height: '20px', backgroundColor: '#e2e8f0' }}
                                      />
                                    </Tooltip>
                                  ))
                                ) : (
                                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>Default</Typography>
                                )}
                              </Stack>
                            </TableCell>

                            <TableCell sx={{ textAlign: 'center' }}>
                              <Stack direction="row" spacing={1} justifyContent="center">
                                {(isCritical || isLow || isReorder) && (
                                  <Tooltip title="Create Purchase Request / Order">
                                    <IconButton
                                      size="small"
                                      color="primary"
                                      component={Link}
                                      to={`/entry/purchase-request-create?item=${encodeURIComponent(item.item_name)}&neededQty=${Math.max((item.reorder_level || item.minimum_qty || 500) - item.current_qty, 100)}`}
                                      sx={{ backgroundColor: '#eff6ff', '&:hover': { backgroundColor: '#dbeafe' } }}
                                    >
                                      <PurchaseIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}

                                <Tooltip title="Configure Thresholds">
                                  <IconButton
                                    size="small"
                                    component={Link}
                                    to="/features/stock-alert-config"
                                    sx={{ color: '#64748b' }}
                                  >
                                    <SettingsIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        );
                      })
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              rowsPerPageOptions={[10, 25, 50, 100]}
              component="div"
              count={filteredItems.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(e, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
            />
          </Box>
        )}

        {/* TAB 1: Alert History & Event Log */}
        {activeTab === 1 && (
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 2, color: '#475569', fontWeight: 'bold' }}>
              Historical Record of Triggered, Transitioned & Automatically Resolved Stock Alerts
            </Typography>

            <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: '6px' }}>
              <Table size="small">
                <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Triggered Date</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Item Name</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Godown</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Alert Severity</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Stock at Trigger</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Thresholds (Min / Reorder)</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Lifecycle Status</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Resolution Details</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.history && data.history.length > 0 ? (
                    data.history.map((h, i) => (
                      <TableRow key={h.id || i} sx={{ '&:hover': { backgroundColor: '#f8fafc' } }}>
                        <TableCell sx={{ fontSize: '12px', fontFamily: 'monospace' }}>
                          {h.triggered_at ? new Date(h.triggered_at).toLocaleString('en-IN') : 'N/A'}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>{h.item_name}</TableCell>
                        <TableCell>{h.godown_name}</TableCell>
                        <TableCell>{getStatusChip(h.alert_type)}</TableCell>
                        <TableCell sx={{ textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace' }}>
                          {parseFloat(h.current_qty || 0).toFixed(1)} Kg
                        </TableCell>
                        <TableCell sx={{ textAlign: 'right', fontSize: '12px' }}>
                          Min: {h.minimum_qty || h.cfg_min || 0} / Reorder: {h.reorder_level || h.cfg_reorder || 0}
                        </TableCell>
                        <TableCell sx={{ textAlign: 'center' }}>
                          <Chip
                            label={h.status}
                            size="small"
                            color={h.status === 'OPEN' ? 'error' : 'success'}
                            variant={h.status === 'OPEN' ? 'filled' : 'outlined'}
                            sx={{ fontWeight: 'bold', fontSize: '11px' }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: '12px', color: h.status === 'RESOLVED' ? '#16a34a' : '#64748b' }}>
                          {h.resolved_reason || (h.status === 'OPEN' ? 'Waiting for stock replenishment' : 'Resolved')}
                          {h.resolved_at && ` on ${new Date(h.resolved_at).toLocaleDateString('en-IN')}`}
                        </TableCell>
                        <TableCell sx={{ textAlign: 'center' }}>
                          {h.status === 'OPEN' && (
                            <Button
                              size="small"
                              variant="outlined"
                              color="success"
                              onClick={() => handleResolveAlert(h.id)}
                              sx={{ textTransform: 'none', fontSize: '11px', py: 0.2 }}
                            >
                              Mark Reviewed
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} sx={{ textAlign: 'center', py: 3, color: '#94a3b8' }}>
                        No historical alert records found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* TAB 2: Dispatched Notifications Queue */}
        {activeTab === 2 && (
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 2, color: '#475569', fontWeight: 'bold' }}>
              Multi-Channel Alert Dispatch Queue (In-App, Email, Offline Desktop Logs)
            </Typography>

            <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: '6px' }}>
              <Table size="small">
                <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Date & Time</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Channel</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Recipient Contact</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Email / Phone</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Alert Content / Message</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Delivery Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.notifications && data.notifications.length > 0 ? (
                    data.notifications.map((n, i) => (
                      <TableRow key={n.id || i} sx={{ '&:hover': { backgroundColor: '#f8fafc' } }}>
                        <TableCell sx={{ fontSize: '12px', fontFamily: 'monospace' }}>
                          {n.created_at ? new Date(n.created_at).toLocaleString('en-IN') : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={n.channel}
                            size="small"
                            color={n.channel === 'EMAIL' ? 'primary' : n.channel === 'IN_APP' ? 'secondary' : 'default'}
                            sx={{ fontWeight: 'bold', fontSize: '10px' }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>{n.contact_name || 'All Managers'}</TableCell>
                        <TableCell sx={{ fontSize: '12px' }}>{n.contact_email || n.contact_phone || '-'}</TableCell>
                        <TableCell sx={{ fontSize: '12px', color: '#334155' }}>{n.message}</TableCell>
                        <TableCell sx={{ textAlign: 'center' }}>
                          <Chip
                            label={n.status}
                            size="small"
                            color={n.status === 'SENT' ? 'success' : n.status === 'PENDING' ? 'warning' : 'default'}
                            sx={{ fontSize: '10px' }}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ textAlign: 'center', py: 3, color: '#94a3b8' }}>
                        No notification logs recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Paper>

      {/* Lot-Level Breakdown Modal */}
      <Dialog
        open={Boolean(selectedItemLots)}
        onClose={() => setSelectedItemLots(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ backgroundColor: themeColors.primary, color: '#ffffff', py: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
              Lot Traceability: {selectedItemLots?.item_name}
            </Typography>
            <IconButton size="small" onClick={() => setSelectedItemLots(null)} sx={{ color: '#ffffff' }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ mb: 2, color: '#64748b' }}>
            Location: <strong>{selectedItemLots?.godown_name}</strong> | Total Available: <strong>{selectedItemLots?.current_qty?.toFixed(1)} Kg</strong>
          </Typography>

          <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: '4px' }}>
            <Table size="small">
              <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Lot No</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Godown</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Available Qty (Kg)</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Unit Rate</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {selectedItemLots?.lots && selectedItemLots.lots.length > 0 ? (
                  selectedItemLots.lots.map((lot, idx) => (
                    <TableRow key={idx}>
                      <TableCell sx={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{lot.lot_no}</TableCell>
                      <TableCell>{lot.godown || selectedItemLots.godown_name}</TableCell>
                      <TableCell sx={{ textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace' }}>
                        {lot.qty?.toFixed(1)} Kg
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right' }}>
                        {lot.rate ? `₹${lot.rate.toFixed(2)}` : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} sx={{ textAlign: 'center', py: 2 }}>No active lots</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setSelectedItemLots(null)} variant="outlined">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default StockAlertDashboard;
