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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Alert,
  CircularProgress,
  Divider,
  MenuItem,
  TextField
} from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import PaymentsIcon from '@mui/icons-material/Payments';
import AssessmentIcon from '@mui/icons-material/Assessment';
import TimelineIcon from '@mui/icons-material/Timeline';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
import WarningIcon from '@mui/icons-material/Warning';
import PriceCheckIcon from '@mui/icons-material/PriceCheck';
import axios from 'axios';

export default function FinancialControlCenter() {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [receivables, setReceivables] = useState(null);
  const [payables, setPayables] = useState(null);
  const [cashflowDays, setCashflowDays] = useState(30);
  const [cashflow, setCashflow] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  // Drill-down dialog
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [drillDownData, setDrillDownData] = useState(null);
  const [drillDownLoading, setDrillDownLoading] = useState(false);

  const parseError = (err) => {
    if (!err) return '';
    const raw = err.response?.data?.error || err.response?.data?.message || err.message || err;
    if (typeof raw === 'object' && raw !== null) {
      if (typeof raw.message === 'string') return raw.message;
      if (typeof raw.error === 'string') return raw.error;
      try {
        return JSON.stringify(raw);
      } catch {
        return String(raw);
      }
    }
    return String(raw);
  };

  useEffect(() => {
    fetchFinancialData();
  }, []);

  useEffect(() => {
    fetchCashFlow(cashflowDays);
  }, [cashflowDays]);

  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      const [mRes, rRes, pRes, aRes] = await Promise.all([
        axios.get('/api/financial-intelligence/control-center-metrics'),
        axios.get('/api/financial-intelligence/receivable-aging'),
        axios.get('/api/financial-intelligence/payable-aging'),
        axios.get('/api/financial-intelligence/payment-due-alerts')
      ]);

      if (mRes.data.success) setMetrics(mRes.data.data);
      if (rRes.data.success) setReceivables(rRes.data.data);
      if (pRes.data.success) setPayables(pRes.data.data);
      if (aRes.data.success) setAlerts(Array.isArray(aRes.data.data) ? aRes.data.data : []);
    } catch (err) {
      setErrorMsg(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  const fetchCashFlow = async (days) => {
    try {
      const res = await axios.get(`/api/financial-intelligence/cash-flow-forecast?days=${days}`);
      if (res.data.success) {
        setCashflow(res.data.data);
      }
    } catch (err) {
      console.warn('Error fetching cashflow:', err);
    }
  };

  const handleOpenDrillDown = async (partyName, partyType) => {
    setDrillDownLoading(true);
    setDrillDownOpen(true);
    try {
      const res = await axios.get(`/api/financial-intelligence/drill-down?partyName=${encodeURIComponent(partyName)}&partyType=${partyType}`);
      if (res.data.success) {
        setDrillDownData(res.data.data);
      }
    } catch (err) {
      setErrorMsg(parseError(err));
    } finally {
      setDrillDownLoading(false);
    }
  };

  const formatCurr = (val) => {
    return '₹' + (parseFloat(val) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  };

  if (loading && !metrics) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }} color="text.secondary">Loading Financial Intelligence Control Center...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            <AssessmentIcon color="primary" fontSize="large" /> Financial Intelligence
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Receivable Aging, Payable Aging, Cash Flow Forecasting & Financial Audit Drill-Down
          </Typography>
        </Box>
      </Box>

      {Boolean(errorMsg) && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMsg('')}>
          {typeof errorMsg === 'object' ? (errorMsg.message || JSON.stringify(errorMsg)) : String(errorMsg)}
        </Alert>
      )}

      {/* Primary KPI Grid */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid #10b981' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                TOTAL RECEIVABLES
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#10b981' }}>
                {formatCurr(metrics?.receivables)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {metrics?.customersCount} Customers Outstanding
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid #ef4444' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                TOTAL PAYABLES
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#ef4444' }}>
                {formatCurr(metrics?.payables)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {metrics?.suppliersCount} Suppliers Bills Due
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid #0284c7' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                TOTAL LIQUID FUNDS
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#0284c7' }}>
                {formatCurr(metrics?.totalLiquidFunds)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Bank: {formatCurr(metrics?.bankBalance)} | Cash: {formatCurr(metrics?.cashBalance)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid #8b5cf6' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                STOCK VALUATION
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#8b5cf6' }}>
                {formatCurr(metrics?.stockValuation)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Gross Margin: ~{metrics?.grossMarginPct}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Card sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(e, val) => setActiveTab(val)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          <Tab icon={<TrendingUpIcon />} iconPosition="start" label="Receivable Intelligence & Aging" />
          <Tab icon={<TrendingDownIcon />} iconPosition="start" label="Payable Intelligence & Aging" />
          <Tab icon={<TimelineIcon />} iconPosition="start" label="Cash Flow Forecast" />
          <Tab icon={<WarningIcon />} iconPosition="start" label={`Payment Due Alerts (${(Array.isArray(alerts) ? alerts : []).length})`} />
        </Tabs>

        {/* TAB 0: RECEIVABLES */}
        {activeTab === 0 && (
          <CardContent sx={{ p: 3 }}>
            {/* Aging Buckets Display */}
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
              Receivables Aging Analysis
            </Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {receivables?.agingBuckets && Object.entries(receivables.agingBuckets).map(([key, val]) => (
                <Grid item xs={6} sm={4} md={2.4} key={key}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', bgcolor: key === '180+' ? '#fef2f2' : '#f8fafc' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      {key.toUpperCase()} DAYS
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: key === '180+' ? '#dc2626' : 'text.primary', mt: 0.5 }}>
                      {formatCurr(val)}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>

            {/* Customers Receivables Table */}
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
              Customer-wise Outstanding Breakdown
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'grey.50' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Customer Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Total Outstanding</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Overdue Amount</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Credit Days</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Oldest Due Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!receivables?.parties || receivables.parties.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        No outstanding customer invoices recorded.
                      </TableCell>
                    </TableRow>
                  ) : (
                    receivables.parties.map((p) => (
                      <TableRow key={p.partyName} hover>
                        <TableCell sx={{ fontWeight: 600 }}>
                          {typeof p.partyName === 'string' && /^\d+$/.test(p.partyName.trim()) 
                            ? `Customer #${p.partyName}` 
                            : (p.partyName || 'Direct Customer')}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#10b981' }}>{formatCurr(p.totalOutstanding)}</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: p.overdueAmount > 0 ? '#ef4444' : 'text.secondary' }}>
                          {formatCurr(p.overdueAmount)}
                        </TableCell>
                        <TableCell>{p.creditDays} Days</TableCell>
                        <TableCell>{p.oldestDueDate || '-'}</TableCell>
                        <TableCell>
                          <Chip
                            label={p.overdueAmount > 0 ? 'OVERDUE' : 'WITHIN CREDIT'}
                            size="small"
                            color={p.overdueAmount > 0 ? 'error' : 'success'}
                            sx={{ fontSize: '11px', fontWeight: 700 }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<VisibilityIcon />}
                            onClick={() => handleOpenDrillDown(p.partyName, 'CUSTOMER')}
                            sx={{ textTransform: 'none' }}
                          >
                            Drill-Down
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        )}

        {/* TAB 1: PAYABLES */}
        {activeTab === 1 && (
          <CardContent sx={{ p: 3 }}>
            {/* Aging Buckets Display */}
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
              Payables Aging Analysis
            </Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {payables?.agingBuckets && Object.entries(payables.agingBuckets).map(([key, val]) => (
                <Grid item xs={6} sm={4} md={2.4} key={key}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', bgcolor: key === '180+' ? '#fef2f2' : '#f8fafc' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      {key.toUpperCase()} DAYS
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: key === '180+' ? '#dc2626' : 'text.primary', mt: 0.5 }}>
                      {formatCurr(val)}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>

            {/* Suppliers Payables Table */}
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
              Supplier-wise Outstanding Breakdown
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'grey.50' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Supplier Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Total Outstanding</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Overdue Amount</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Credit Days</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Oldest Due Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!payables?.parties || payables.parties.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        No outstanding supplier bills recorded.
                      </TableCell>
                    </TableRow>
                  ) : (
                    payables.parties.map((p) => (
                      <TableRow key={p.partyName} hover>
                        <TableCell sx={{ fontWeight: 600 }}>
                          {typeof p.partyName === 'string' && /^\d+$/.test(p.partyName.trim()) 
                            ? `Supplier #${p.partyName}` 
                            : (p.partyName || 'Direct Supplier')}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#ef4444' }}>{formatCurr(p.totalOutstanding)}</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: p.overdueAmount > 0 ? '#ef4444' : 'text.secondary' }}>
                          {formatCurr(p.overdueAmount)}
                        </TableCell>
                        <TableCell>{p.creditDays} Days</TableCell>
                        <TableCell>{p.oldestDueDate || '-'}</TableCell>
                        <TableCell>
                          <Chip
                            label={p.overdueAmount > 0 ? 'OVERDUE' : 'WITHIN CREDIT'}
                            size="small"
                            color={p.overdueAmount > 0 ? 'error' : 'success'}
                            sx={{ fontSize: '11px', fontWeight: 700 }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<VisibilityIcon />}
                            onClick={() => handleOpenDrillDown(p.partyName, 'SUPPLIER')}
                            sx={{ textTransform: 'none' }}
                          >
                            Drill-Down
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        )}

        {/* TAB 2: CASH FLOW FORECAST */}
        {activeTab === 2 && (
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Cash Flow Forecast & Liquidity Projection
              </Typography>
              <TextField
                select
                size="small"
                label="Forecast Horizon"
                value={cashflowDays}
                onChange={(e) => setCashflowDays(Number(e.target.value))}
                sx={{ width: 180 }}
              >
                <MenuItem value={1}>Today Only</MenuItem>
                <MenuItem value={7}>Next 7 Days</MenuItem>
                <MenuItem value={30}>Next 30 Days</MenuItem>
                <MenuItem value={90}>Next 90 Days (Quarter)</MenuItem>
              </TextField>
            </Box>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Paper variant="outlined" sx={{ p: 2, borderTop: '3px solid #0284c7' }}>
                  <Typography variant="caption" color="text.secondary">Opening Liquid Cash (Actual)</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                    {formatCurr(cashflow?.openingCash)}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper variant="outlined" sx={{ p: 2, borderTop: '3px solid #10b981' }}>
                  <Typography variant="caption" color="text.secondary">Projected Inflows (Collections)</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#10b981', mt: 0.5 }}>
                    +{formatCurr(cashflow?.projectedInflows)}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper variant="outlined" sx={{ p: 2, borderTop: '3px solid #ef4444' }}>
                  <Typography variant="caption" color="text.secondary">Projected Outflows (Payments)</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#ef4444', mt: 0.5 }}>
                    -{formatCurr(cashflow?.projectedOutflows)}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper variant="outlined" sx={{ p: 2, borderTop: '3px solid #6366f1' }}>
                  <Typography variant="caption" color="text.secondary">Projected Closing Cash</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#6366f1', mt: 0.5 }}>
                    {formatCurr(cashflow?.projectedClosingCash)}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            {/* Projection Schedule Table */}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Daily Projected Schedule (First 15 Days)
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'grey.50' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Projected Inflow</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Projected Outflow</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Net Daily</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Projected Balance</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(cashflow?.forecastSchedule || []).slice(0, 15).map((row) => (
                    <TableRow key={row.date} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{row.date}</TableCell>
                      <TableCell sx={{ color: '#10b981' }}>+{formatCurr(row.projectedInflow)}</TableCell>
                      <TableCell sx={{ color: '#ef4444' }}>-{formatCurr(row.projectedOutflow)}</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: row.netChange >= 0 ? '#10b981' : '#ef4444' }}>
                        {formatCurr(row.netChange)}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{formatCurr(row.closingBalance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        )}

        {/* TAB 3: DUE ALERTS */}
        {activeTab === 3 && (() => {
          const safeAlerts = Array.isArray(alerts) ? alerts : [];
          return (
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                Upcoming & Overdue Payment Notifications
              </Typography>
              {safeAlerts.length === 0 ? (
                <Alert severity="success">No overdue or immediate payment liabilities found.</Alert>
              ) : (
                <Grid container spacing={2}>
                  {safeAlerts.map((a, idx) => (
                    <Grid item xs={12} sm={6} md={4} key={idx}>
                      <Card variant="outlined" sx={{ borderLeft: `4px solid ${a?.urgency === 'OVERDUE' ? '#ef4444' : a?.urgency === 'DUE_TODAY' ? '#f59e0b' : '#3b82f6'}` }}>
                        <CardContent sx={{ p: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                              {a?.supplierName}
                            </Typography>
                            <Chip
                              label={(a?.urgency || 'DUE').replace(/_/g, ' ')}
                              color={a?.urgency === 'OVERDUE' ? 'error' : a?.urgency === 'DUE_TODAY' ? 'warning' : 'primary'}
                              size="small"
                              sx={{ fontWeight: 700, fontSize: '10px' }}
                            />
                          </Box>
                          <Typography variant="h6" sx={{ fontWeight: 800, mt: 1, color: '#ef4444' }}>
                            {formatCurr(a?.amount)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Bill #{a?.billNo} • Due Date: {a?.dueDate}
                          </Typography>
                          <Button
                            size="small"
                            variant="text"
                            startIcon={<VisibilityIcon />}
                            onClick={() => handleOpenDrillDown(a?.supplierName, 'SUPPLIER')}
                            sx={{ textTransform: 'none', mt: 1, p: 0 }}
                          >
                            View Bill & Ledger
                          </Button>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </CardContent>
          );
        })()}
      </Card>

      {/* AUDITABLE FINANCIAL DRILL-DOWN MODAL */}
      <Dialog
        open={drillDownOpen}
        onClose={() => setDrillDownOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle component="div" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Audit Drill-Down: {drillDownData?.partyName} ({drillDownData?.partyType})
          </Typography>
          <IconButton size="small" onClick={() => setDrillDownOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 2 }}>
          {drillDownLoading ? (
            <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress /></Box>
          ) : (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Invoices / Bills Register
              </Typography>
              <TableContainer sx={{ mb: 3 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'grey.50' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Voucher / Bill #</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Item Description</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Qty</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Bill Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(drillDownData?.invoices || []).length === 0 ? (
                      <TableRow><TableCell colSpan={5} align="center" sx={{ py: 2, color: 'text.secondary' }}>No invoice or bill records found for this party.</TableCell></TableRow>
                    ) : (
                      drillDownData.invoices.map((inv, i) => (
                        <TableRow key={i} hover>
                          <TableCell>{inv.date || inv.invoice_date || '-'}</TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{inv.inv_no || inv.s_no || `BILL-${inv.id}`}</TableCell>
                          <TableCell>{inv.item_name || 'Raw Grain / Goods'}</TableCell>
                          <TableCell>{inv.qty ? `${inv.qty} Bags/KG` : '-'}</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: '#1e3a8a' }}>{formatCurr(inv.amount || inv.grand_total || inv.total_amount)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Related Payment & Ledger Journal Entries
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'grey.50' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Voucher #</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Voucher Type</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Debit (Paid ₹)</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Credit (Received ₹)</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Remarks / Narration</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(drillDownData?.vouchers || []).length === 0 ? (
                      <TableRow><TableCell colSpan={6} align="center" sx={{ py: 2, color: 'text.secondary' }}>No payment vouchers or ledger journal entries recorded yet.</TableCell></TableRow>
                    ) : (
                      drillDownData.vouchers.map((v, i) => (
                        <TableRow key={i} hover>
                          <TableCell>{v.date || '-'}</TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{v.voucher_no || `VOC-${v.id}`}</TableCell>
                          <TableCell>
                            <Chip
                              label={v.type || v.voucher_type || 'Payment'}
                              size="small"
                              color={v.debit > 0 ? 'primary' : 'success'}
                              sx={{ fontWeight: 600, fontSize: '11px' }}
                            />
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, color: '#ef4444' }}>{v.debit ? formatCurr(v.debit) : '-'}</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: '#10b981' }}>{v.credit ? formatCurr(v.credit) : '-'}</TableCell>
                          <TableCell>{v.entry_remarks || v.remarks || v.narration || '-'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDrillDownOpen(false)} sx={{ textTransform: 'none' }}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
