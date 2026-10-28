import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Tabs,
  Tab,
  Chip,
  IconButton,
  CircularProgress,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip
} from '@mui/material';
import {
  AcUnit as ColdIcon,
  Dashboard as DashboardIcon,
  Inventory as StockIcon,
  ReceiptLong as VoucherIcon,
  Calculate as BillingIcon,
  AccountBalance as LedgerIcon,
  AccountTree as TraceIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Sync as SyncIcon,
  LocalShipping as TruckIcon,
  CheckCircle as CheckIcon,
  Warning as AlertIcon,
  Settings as SettingsIcon,
  ArrowForward as ArrowIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

// Subcomponents
import ColdStorageStock from './ColdStorageStock';
import ColdStorageVouchers from './ColdStorageVouchers';
import ColdStorageBilling from './ColdStorageBilling';
import ColdStorageTraceability from './ColdStorageTraceability';
import ColdStorageLedger from './ColdStorageLedger';
import ColdStorageMaster from './ColdStorageMaster';

const ColdStorageWorkspace = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState({
    activeFacilities: 0,
    totalLots: 0,
    availableQty: 0,
    availableWt: 0,
    accruedLiability: 0,
    pendingBillsCount: 0,
    recentVouchers: [],
    recentBills: []
  });

  useEffect(() => {
    fetchHubData();
  }, []);

  const fetchHubData = async () => {
    setLoading(true);
    try {
      const [storagesRes, stockRes, vouchersRes, billsRes] = await Promise.all([
        api('/cold-storage/storages').catch(() => ({ data: [] })),
        api('/cold-storage/stock').catch(() => ({ data: [] })),
        api('/cold-storage/vouchers').catch(() => ({ data: [] })),
        api('/cold-storage/bills').catch(() => ({ data: [] }))
      ]);

      const storages = storagesRes?.data || [];
      const stock = stockRes?.data || [];
      const vouchers = vouchersRes?.data || [];
      const bills = billsRes?.data || [];

      const availQty = stock.reduce((s, it) => s + parseFloat(it.available_qty || 0), 0);
      const availWt = stock.reduce((s, it) => s + parseFloat(it.available_wt || 0), 0);
      const liability = stock.reduce((s, it) => s + parseFloat(it.total_accrued_cost || 0), 0);
      const pendingBills = bills.filter(b => b.status === 'Pending').length;

      setStats({
        activeFacilities: storages.length,
        totalLots: stock.filter(s => s.available_qty > 0).length,
        availableQty: availQty,
        availableWt: availWt,
        accruedLiability: liability,
        pendingBillsCount: pendingBills,
        recentVouchers: vouchers.slice(0, 5),
        recentBills: bills.slice(0, 5)
      });
    } catch (err) {
      console.error('Error fetching hub data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncStock = async () => {
    setSyncing(true);
    try {
      await api('/cold-storage/sync-stock', { method: 'POST' });
      await fetchHubData();
    } catch (err) {
      console.error('Error syncing cold storage stock:', err);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, width: '100%', maxWidth: '100%', margin: '0 auto' }}>
      {/* Top Banner */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2.5,
          flexWrap: 'wrap',
          gap: 2,
          p: 2.5,
          background: 'linear-gradient(135deg, #1e3a8a 0%, #1f4fb2 60%, #0284c7 100%)',
          borderRadius: 2,
          color: '#ffffff',
          boxShadow: '0 4px 12px rgba(30, 58, 138, 0.2)'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              backgroundColor: 'rgba(255,255,255,0.15)',
              p: 1.5,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ColdIcon sx={{ fontSize: 40, color: '#ffffff' }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: '800', letterSpacing: '0.5px' }}>
              BVC Cold Storage Central Command
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', mt: 0.5 }}>
              Unified management for external rented cold storage • Inward (CSI) • Retrieval & Dispatch (CSO) • Live Stock & Accrued Rent • Operator Billing & Accounts
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            startIcon={<SyncIcon />}
            onClick={handleSyncStock}
            disabled={syncing}
            sx={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.3)' },
              color: '#fff',
              textTransform: 'none',
              fontWeight: '600'
            }}
          >
            {syncing ? 'Syncing...' : 'Sync Live Stock'}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/cold-storage/in')}
            sx={{
              backgroundColor: '#10b981',
              '&:hover': { backgroundColor: '#059669' },
              color: '#fff',
              fontWeight: 'bold',
              textTransform: 'none'
            }}
          >
            New Inward (CSI)
          </Button>
          <Button
            variant="contained"
            startIcon={<TruckIcon />}
            onClick={() => navigate('/cold-storage/out')}
            sx={{
              backgroundColor: '#f59e0b',
              '&:hover': { backgroundColor: '#d97706' },
              color: '#fff',
              fontWeight: 'bold',
              textTransform: 'none'
            }}
          >
            New Outward (CSO)
          </Button>
          <Button
            variant="contained"
            startIcon={<VoucherIcon />}
            onClick={() => navigate('/cold-storage/out?view=history')}
            sx={{
              backgroundColor: 'rgba(255,255,255,0.25)',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.35)' },
              color: '#fff',
              fontWeight: 'bold',
              textTransform: 'none'
            }}
          >
            CSO Bills & Register
          </Button>
        </Box>
      </Box>

      {/* Navigation Tabs */}
      <Card sx={{ mb: 3, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 2,
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': { fontWeight: 'bold', textTransform: 'none', fontSize: '14px', py: 2 }
          }}
        >
          <Tab icon={<DashboardIcon fontSize="small" />} iconPosition="start" label="Operations Hub & KPIs" />
          <Tab icon={<StockIcon fontSize="small" />} iconPosition="start" label="Live Stock & Lot Valuation" />
          <Tab icon={<VoucherIcon fontSize="small" />} iconPosition="start" label="CSI & CSO Vouchers" />
          <Tab
            icon={<BillingIcon fontSize="small" />}
            iconPosition="start"
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span>Operator Billing & Verification</span>
                {stats.pendingBillsCount > 0 && (
                  <Chip
                    label={`${stats.pendingBillsCount} Pending`}
                    size="small"
                    color="warning"
                    sx={{ height: 20, fontSize: '11px', fontWeight: 'bold' }}
                  />
                )}
              </Box>
            }
          />
          <Tab icon={<LedgerIcon fontSize="small" />} iconPosition="start" label="Movement & Operator Ledger" />
          <Tab icon={<TraceIcon fontSize="small" />} iconPosition="start" label="Batch / Lot Traceability" />
          <Tab icon={<SettingsIcon fontSize="small" />} iconPosition="start" label="Godown Tariffs & Day Slabs" />
        </Tabs>
      </Card>

      {/* Tab 0: Operations Hub & Quick Actions */}
      {activeTab === 0 && (
        <Box>
          {/* Key Metric Cards */}
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={2.4}>
              <Card sx={{ borderLeft: '5px solid #1f4fb2', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                    Active Facilities
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#1f4fb2', mt: 0.5 }}>
                    {stats.activeFacilities}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">Rented external partners</Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={2.4}>
              <Card sx={{ borderLeft: '5px solid #059669', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                    Available CS Stock
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#059669', mt: 0.5 }}>
                    {stats.availableQty.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">{stats.totalLots} Active CS Lots</Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={2.4}>
              <Card sx={{ borderLeft: '5px solid #6366f1', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                    Stored Net Weight
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#6366f1', mt: 0.5 }}>
                    {(stats.availableWt / 1000).toFixed(1)} T
                  </Typography>
                  <Typography variant="caption" color="text.secondary">{stats.availableWt.toLocaleString()} KG</Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={2.4}>
              <Card sx={{ borderLeft: '5px solid #b45309', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                    Accrued Charges Liability
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#b45309', mt: 0.5 }}>
                    ₹{stats.accruedLiability.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">Rent + Handling accrued</Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={2.4}>
              <Card sx={{ borderLeft: '5px solid #dc2626', backgroundColor: '#fff1f2', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                    Pending Operator Bills
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#dc2626', mt: 0.5 }}>
                    {stats.pendingBillsCount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">Requires audit / approval</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Quick Operations Launchpad */}
          <Card sx={{ mb: 3, p: 2.5, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#1f4fb2', mb: 2 }}>
              Quick Transaction Actions
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    cursor: 'pointer',
                    '&:hover': { borderColor: '#10b981', backgroundColor: '#f0fdf4' }
                  }}
                  onClick={() => navigate('/cold-storage/in')}
                >
                  <ColdIcon sx={{ fontSize: 36, color: '#10b981', mb: 1 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Receive Inward (CSI)</Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Record transfer from factory godown or direct purchase receipt
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    cursor: 'pointer',
                    '&:hover': { borderColor: '#f59e0b', backgroundColor: '#fffbeb' }
                  }}
                  onClick={() => navigate('/cold-storage/out')}
                >
                  <TruckIcon sx={{ fontSize: 36, color: '#f59e0b', mb: 1 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Retrieve / Dispatch (CSO)</Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Issue material to factory godown or direct customer delivery
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    cursor: 'pointer',
                    '&:hover': { borderColor: '#1f4fb2', backgroundColor: '#eff6ff' }
                  }}
                  onClick={() => setActiveTab(3)}
                >
                  <BillingIcon sx={{ fontSize: 36, color: '#1f4fb2', mb: 1 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Verify Operator Bill</Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Auto-calculate storage charges, audit invoice & post to ledger
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    cursor: 'pointer',
                    '&:hover': { borderColor: '#6366f1', backgroundColor: '#eef2ff' }
                  }}
                  onClick={() => navigate('/cold-storage/master')}
                >
                  <SettingsIcon sx={{ fontSize: 36, color: '#6366f1', mb: 1 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Facility & Rate Master</Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Configure operator partners, storage duration slabs & handling rates
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Card>

          {/* Recent Activity Split */}
          <Grid container spacing={3}>
            {/* Recent Vouchers */}
            <Grid item xs={12} md={6}>
              <Card sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)', height: '100%' }}>
                <CardContent sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>
                      Recent Movement Vouchers
                    </Typography>
                    <Button size="small" endIcon={<ArrowIcon />} onClick={() => setActiveTab(2)}>
                      View All
                    </Button>
                  </Box>

                  {stats.recentVouchers.length === 0 ? (
                    <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                      No recent movement vouchers recorded.
                    </Typography>
                  ) : (
                    <TableContainer>
                      <Table size="small">
                        <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Voucher #</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Facility</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Qty</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {stats.recentVouchers.map((v) => (
                            <TableRow key={v.id} sx={{ '&:hover': { backgroundColor: '#f1f5f9' } }}>
                              <TableCell sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>{v.voucher_no}</TableCell>
                              <TableCell>
                                <Chip
                                  label={v.voucher_type}
                                  size="small"
                                  color={v.voucher_type === 'IN' ? 'primary' : 'warning'}
                                  sx={{ fontWeight: 'bold', height: 22 }}
                                />
                              </TableCell>
                              <TableCell>{v.cold_storage_name}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                {v.total_qty}
                              </TableCell>
                              <TableCell>{v.voucher_date}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Recent Operator Bills */}
            <Grid item xs={12} md={6}>
              <Card sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)', height: '100%' }}>
                <CardContent sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>
                      Recent Operator Invoices & Bills
                    </Typography>
                    <Button size="small" endIcon={<ArrowIcon />} onClick={() => setActiveTab(3)}>
                      View All
                    </Button>
                  </Box>

                  {stats.recentBills.length === 0 ? (
                    <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                      No operator bills saved yet.
                    </Typography>
                  ) : (
                    <TableContainer>
                      <Table size="small">
                        <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Bill #</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Operator</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total (₹)</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Variance</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 'bold' }}>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {stats.recentBills.map((b) => (
                            <TableRow key={b.id} sx={{ '&:hover': { backgroundColor: '#f1f5f9' } }}>
                              <TableCell sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>{b.bill_no}</TableCell>
                              <TableCell>{b.operator_name}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                ₹{parseFloat(b.grand_total || 0).toFixed(2)}
                              </TableCell>
                              <TableCell
                                align="right"
                                sx={{
                                  fontWeight: 'bold',
                                  color: Math.abs(b.variance_amount || 0) > 100 ? '#dc2626' : '#059669'
                                }}
                              >
                                ₹{parseFloat(b.variance_amount || 0).toFixed(2)}
                              </TableCell>
                              <TableCell align="center">
                                <Chip
                                  label={b.status}
                                  size="small"
                                  color={b.status === 'Approved' ? 'success' : 'warning'}
                                  sx={{ fontWeight: 'bold', height: 22 }}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Tab 1: Live Stock & Lot Valuation */}
      {activeTab === 1 && <ColdStorageStock />}

      {/* Tab 2: Vouchers Register */}
      {activeTab === 2 && <ColdStorageVouchers />}

      {/* Tab 3: Operator Billing & Verification */}
      {activeTab === 3 && <ColdStorageBilling />}

      {/* Tab 4: Ledger */}
      {activeTab === 4 && <ColdStorageLedger />}

      {/* Tab 5: Lot Traceability */}
      {activeTab === 5 && <ColdStorageTraceability />}

      {/* Tab 6: Godown Tariffs & Day Slabs */}
      {activeTab === 6 && <ColdStorageMaster />}
    </Box>
  );
};

export default ColdStorageWorkspace;
