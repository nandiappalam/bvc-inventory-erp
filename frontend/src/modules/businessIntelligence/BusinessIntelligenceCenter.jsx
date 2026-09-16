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
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import RefreshIcon from '@mui/icons-material/Refresh';
import axios from 'axios';

export default function BusinessIntelligenceCenter() {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [kpis, setKpis] = useState({
    revenue: 2450000,
    purchases: 1650000,
    grossMargin: 800000,
    marginPct: 28.5,
    stockValue: 890000,
    totalStockKg: 45000,
    quarantineStockKg: 800,
    receivables: 420000,
    payables: 310000,
    productionInputKg: 58000,
    productionOutputKg: 43600,
    yieldPct: 75.2,
    qcIssuesCount: 4,
    inventoryTurnover: 4.8
  });

  const [suppliers, setSuppliers] = useState([]);
  const [productionTrends, setProductionTrends] = useState([]);
  const [productsMargin, setProductsMargin] = useState([]);

  const loadBiData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [dashRes, purRes, prodRes, marginRes] = await Promise.all([
        axios.get('/api/bi-intelligence/dashboard'),
        axios.get('/api/bi-intelligence/purchase-analytics'),
        axios.get('/api/bi-intelligence/production-analytics'),
        axios.get('/api/bi-intelligence/margin-intelligence')
      ]);

      if (dashRes.data.success) setKpis(dashRes.data.kpis);
      if (purRes.data.success) setSuppliers(purRes.data.suppliers || []);
      if (prodRes.data.success) setProductionTrends(prodRes.data.monthlyTrends || []);
      if (marginRes.data.success) setProductsMargin(marginRes.data.products || []);
    } catch (err) {
      console.error('Error fetching BI data:', err);
      setErrorMsg(err.response?.data?.error || 'Failed to load BI analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBiData();
  }, []);

  const formatCurrency = (val) => {
    return `₹${(val || 0).toLocaleString('en-IN')}`;
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1600, margin: '0 auto' }}>
      {/* HEADER */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#1e293b' }}>
            Business Intelligence Center
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Cross-modular executive dashboard: Procurement, Production Yield, Inventory Turnover, and Product Margins
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadBiData} disabled={loading}>
          Refresh Analytics
        </Button>
      </Box>

      {errorMsg && <Alert severity="error" sx={{ mb: 2 }}>{errorMsg}</Alert>}

      {/* TOP EXECUTIVE KPIS */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ p: 2, borderLeft: '4px solid #3b82f6', boxShadow: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>REVENUE</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#1e3a8a', mt: 0.5 }}>
              {formatCurrency(kpis.revenue)}
            </Typography>
            <Typography variant="caption" color="success.main" sx={{ fontWeight: 700 }}>
              +14.2% vs previous period
            </Typography>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ p: 2, borderLeft: '4px solid #10b981', boxShadow: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>GROSS MARGIN</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#047857', mt: 0.5 }}>
              {formatCurrency(kpis.grossMargin)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              Margin Rate: <b>{kpis.marginPct}%</b>
            </Typography>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ p: 2, borderLeft: '4px solid #8b5cf6', boxShadow: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>TOTAL STOCK VALUE</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#6d28d9', mt: 0.5 }}>
              {formatCurrency(kpis.stockValue)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              {kpis.totalStockKg.toLocaleString()} KG Total Stock
            </Typography>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ p: 2, borderLeft: '4px solid #f59e0b', boxShadow: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>PRODUCTION YIELD</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#b45309', mt: 0.5 }}>
              {kpis.yieldPct}%
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              Turnover: <b>{kpis.inventoryTurnover}x / year</b>
            </Typography>
          </Card>
        </Grid>
      </Grid>

      {/* TABS CONTAINER */}
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(e, val) => setActiveTab(val)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2, bgcolor: '#f8fafc' }}
        >
          <Tab label="Purchase & Supplier BI" icon={<ShoppingBagIcon />} iconPosition="start" />
          <Tab label="Production Analytics" icon={<PrecisionManufacturingIcon />} iconPosition="start" />
          <Tab label="Margin & Product Costing" icon={<AttachMoneyIcon />} iconPosition="start" />
        </Tabs>

        {/* TAB 0: PURCHASE & SUPPLIER BI */}
        {activeTab === 0 && (
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2 }}>
              Supplier Performance & Procurement Analytics
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead sx={{ bgcolor: 'grey.100' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Supplier Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Total Purchase Spend</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Orders Count</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Quality Acceptance %</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>On-Time Delivery</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Return Rate</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {suppliers.map((s, i) => (
                    <TableRow key={i} hover>
                      <TableCell sx={{ fontWeight: 700 }}>
                        {typeof s.supplier === 'string' && /^\d+$/.test(s.supplier.trim())
                          ? `Supplier #${s.supplier}`
                          : (s.supplier || 'Direct Supplier')}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#1e3a8a' }}>{formatCurrency(s.spend)}</TableCell>
                      <TableCell>{s.orders}</TableCell>
                      <TableCell>
                        <Chip label={`${s.qualityScore.toFixed(1)}%`} color="success" size="small" />
                      </TableCell>
                      <TableCell>{s.deliveryPerformance}</TableCell>
                      <TableCell>{s.returnPct}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        )}

        {/* TAB 1: PRODUCTION ANALYTICS */}
        {activeTab === 1 && (
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2 }}>
              Monthly Production Yield & Cost Intelligence
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead sx={{ bgcolor: 'grey.100' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Month</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Grain Input (KG)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Flour Output (KG)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Yield %</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Process Loss / Wastage %</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Milling Cost / KG</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {productionTrends.map((t, i) => (
                    <TableRow key={i} hover>
                      <TableCell sx={{ fontWeight: 700 }}>{t.month}</TableCell>
                      <TableCell>{t.inputKg.toLocaleString()} KG</TableCell>
                      <TableCell>{t.outputKg.toLocaleString()} KG</TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#047857' }}>{t.yieldPct}%</TableCell>
                      <TableCell color="error">{t.wastagePct}%</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>₹{t.costPerKg}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        )}

        {/* TAB 2: MARGIN INTELLIGENCE */}
        {activeTab === 2 && (
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2 }}>
              Product-Wise Cost Breakdown & Gross Margin Analysis
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead sx={{ bgcolor: 'grey.100' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Product Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Raw Material Cost</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Processing Cost</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Packing + Freight</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Total Cost / KG</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Selling Price / KG</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Gross Margin / KG</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Margin %</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {productsMargin.map((p, i) => (
                    <TableRow key={i} hover>
                      <TableCell sx={{ fontWeight: 700 }}>{p.product}</TableCell>
                      <TableCell>₹{p.purchaseCost}</TableCell>
                      <TableCell>₹{p.processingCost + p.jobworkCost}</TableCell>
                      <TableCell>₹{p.packingCost + p.freightCost}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>₹{p.totalCost}</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#1e3a8a' }}>₹{p.sellingPrice}</TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#047857' }}>₹{p.margin}</TableCell>
                      <TableCell>
                        <Chip label={`${p.marginPct}%`} color="success" size="small" sx={{ fontWeight: 800 }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        )}
      </Card>
    </Box>
  );
}
