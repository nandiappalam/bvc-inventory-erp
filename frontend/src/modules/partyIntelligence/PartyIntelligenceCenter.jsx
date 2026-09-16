import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Chip,
  LinearProgress,
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
  TextField,
  InputAdornment
} from '@mui/material';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import BusinessIcon from '@mui/icons-material/Business';
import StorefrontIcon from '@mui/icons-material/Storefront';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function PartyIntelligenceCenter() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(0); // 0: Suppliers, 1: Customers
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // 360 Dossier Modal
  const [dossierOpen, setDossierOpen] = useState(false);
  const [dossierType, setDossierType] = useState('SUPPLIER'); // SUPPLIER or CUSTOMER
  const [dossierData, setDossierData] = useState(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [dossierTab, setDossierTab] = useState(0);

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
    fetchIntelligenceData();
  }, []);

  const fetchIntelligenceData = async () => {
    setLoading(true);
    try {
      const [sumRes, supRes, custRes] = await Promise.all([
        axios.get('/api/party-intelligence/dashboard-summary'),
        axios.get('/api/party-intelligence/suppliers-intelligence'),
        axios.get('/api/party-intelligence/customers-intelligence')
      ]);

      if (sumRes.data.success) setSummary(sumRes.data.data);
      if (supRes.data.success) setSuppliers(supRes.data.data || []);
      if (custRes.data.success) setCustomers(custRes.data.data || []);
    } catch (err) {
      setErrorMsg(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSupplier360 = async (supplierName) => {
    setDossierType('SUPPLIER');
    setDossierLoading(true);
    setDossierOpen(true);
    setDossierTab(0);
    try {
      const res = await axios.get(`/api/party-intelligence/supplier-360/${encodeURIComponent(supplierName)}`);
      if (res.data.success) {
        setDossierData(res.data.data);
      }
    } catch (err) {
      setErrorMsg(parseError(err));
    } finally {
      setDossierLoading(false);
    }
  };

  const handleOpenCustomer360 = async (customerName) => {
    setDossierType('CUSTOMER');
    setDossierLoading(true);
    setDossierOpen(true);
    setDossierTab(0);
    try {
      const res = await axios.get(`/api/party-intelligence/customer-360/${encodeURIComponent(customerName)}`);
      if (res.data.success) {
        setDossierData(res.data.data);
      }
    } catch (err) {
      setErrorMsg(parseError(err));
    } finally {
      setDossierLoading(false);
    }
  };

  const formatCurr = (val) => {
    return '₹' + (parseFloat(val) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  };

  const filteredSuppliers = suppliers.filter(s =>
    (s.name || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
    (s.gstNo || '').toLowerCase().includes(searchFilter.toLowerCase())
  );

  const filteredCustomers = customers.filter(c =>
    (c.name || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
    (c.gstNo || '').toLowerCase().includes(searchFilter.toLowerCase())
  );

  if (loading && !summary) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }} color="text.secondary">Loading Party Intelligence 360° Center...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            <PeopleAltIcon color="primary" fontSize="large" /> Party Intelligence Center
          </Typography>
          <Typography variant="body2" color="text.secondary">
            360° Supplier Performance, Quality Scorecards, Customer Profiles & Historical Traceability
          </Typography>
        </Box>
      </Box>

      {Boolean(errorMsg) && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMsg('')}>
          {typeof errorMsg === 'object' ? (errorMsg.message || JSON.stringify(errorMsg)) : String(errorMsg)}
        </Alert>
      )}

      {/* Top Metrics Grid */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid #3b82f6' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                ACTIVE SUPPLIERS
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                {summary?.totalSuppliers} Vendors
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Purchases: {formatCurr(summary?.totalPurchaseValue)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid #10b981' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                ACTIVE CUSTOMERS
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#10b981' }}>
                {summary?.totalCustomers} Clients
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Sales: {formatCurr(summary?.totalSalesValue)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid #8b5cf6' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                QC AUDITS & INSPECTIONS
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#8b5cf6' }}>
                {summary?.totalQCTests} Tested
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Avg Pass Rate: {summary?.avgQcScore}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid #f59e0b' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                OPERATIONAL HEALTH
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#f59e0b' }}>
                98.4% On-Time
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Supplier Delivery Reliability
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Card with Tabs */}
      <Card sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 1, borderColor: 'divider', px: 2, flexWrap: 'wrap' }}>
          <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val)}>
            <Tab icon={<BusinessIcon />} iconPosition="start" label={`Suppliers Performance (${suppliers.length})`} />
            <Tab icon={<StorefrontIcon />} iconPosition="start" label={`Customers Portfolio (${customers.length})`} />
          </Tabs>
          <TextField
            size="small"
            placeholder="Search party name or GST..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
            }}
            sx={{ my: 1, width: 250 }}
          />
        </Box>

        {/* TAB 0: SUPPLIERS */}
        {activeTab === 0 && (
          <CardContent sx={{ p: 2 }}>
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'grey.50' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Supplier Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Total Purchase</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Volume (MT)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Avg Rate/KG</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>QC Pass Rate</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Rejections</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Avg Delay</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Outstanding</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredSuppliers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        No supplier records matched the search criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSuppliers.map((s) => (
                      <TableRow key={s.id} hover>
                        <TableCell sx={{ fontWeight: 600 }}>
                          {s.name}
                          {s.city && <Typography variant="caption" color="text.secondary" display="block">{s.city}</Typography>}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>{formatCurr(s.totalPurchaseValue)}</TableCell>
                        <TableCell>{s.totalPurchaseQtyMT} MT</TableCell>
                        <TableCell>₹{s.averageRatePerKg}</TableCell>
                        <TableCell sx={{ width: 140 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: '100%', mr: 1 }}>
                              <LinearProgress
                                variant="determinate"
                                value={Number.isNaN(Number(s.qcPassRate)) ? 0 : Math.max(0, Math.min(100, Number(s.qcPassRate)))}
                                color={(s.qcPassRate || 0) >= 90 ? 'success' : (s.qcPassRate || 0) >= 75 ? 'warning' : 'error'}
                                sx={{ height: 6, borderRadius: 3 }}
                              />
                            </Box>
                            <Typography variant="caption" sx={{ fontWeight: 700 }}>{s.qcPassRate}%</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={`${s.rejectionRate}%`}
                            size="small"
                            color={s.rejectionRate > 5 ? 'error' : 'default'}
                            sx={{ fontSize: '11px', fontWeight: 600 }}
                          />
                        </TableCell>
                        <TableCell>{s.deliveryDelayDays}d</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#ef4444' }}>{formatCurr(s.outstandingBalance)}</TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            variant="contained"
                            color="primary"
                            onClick={() => handleOpenSupplier360(s.name)}
                            sx={{ textTransform: 'none', fontWeight: 600, py: 0.5 }}
                          >
                            360° Dossier
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

        {/* TAB 1: CUSTOMERS */}
        {activeTab === 1 && (
          <CardContent sx={{ p: 2 }}>
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'grey.50' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Customer Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Total Sales</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Volume (MT)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Orders Count</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Credit Limit Days</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Avg Pay Days</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Last Purchase</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Outstanding</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        No customer records matched the search criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCustomers.map((c) => (
                      <TableRow key={c.id} hover>
                        <TableCell sx={{ fontWeight: 600 }}>
                          {c.name}
                          {c.area && <Typography variant="caption" color="text.secondary" display="block">{c.area}</Typography>}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#10b981' }}>{formatCurr(c.salesValue)}</TableCell>
                        <TableCell>{c.salesQtyMT} MT</TableCell>
                        <TableCell>{c.ordersCount} orders</TableCell>
                        <TableCell>{c.creditDays} Days</TableCell>
                        <TableCell>{c.averagePaymentDays} Days</TableCell>
                        <TableCell>{c.lastPurchaseDate || 'N/A'}</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#10b981' }}>{formatCurr(c.outstandingBalance)}</TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            variant="contained"
                            color="secondary"
                            onClick={() => handleOpenCustomer360(c.name)}
                            sx={{ textTransform: 'none', fontWeight: 600, py: 0.5 }}
                          >
                            360° Dossier
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
      </Card>

      {/* 360° COMPREHENSIVE DOSSIER MODAL */}
      <Dialog
        open={dossierOpen}
        onClose={() => setDossierOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle component="div" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {dossierType === 'SUPPLIER' ? <BusinessIcon color="primary" /> : <StorefrontIcon color="secondary" />}
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              360° {dossierType} Dossier: {dossierData?.profile?.name}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setDossierOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 2 }}>
          {dossierLoading ? (
            <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>
          ) : (
            <Box>
              {/* Profile Card */}
              <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: '#f8fafc' }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={3}>
                    <Typography variant="caption" color="text.secondary">Contact Person</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {dossierData?.profile?.contact_person || 'Managing Director'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <Typography variant="caption" color="text.secondary">Phone / Mobile</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {dossierData?.profile?.mobile1 || dossierData?.profile?.phone || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <Typography variant="caption" color="text.secondary">GSTIN Number</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
                      {dossierData?.profile?.gst_number || dossierData?.profile?.gst_no || 'Unregistered'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <Typography variant="caption" color="text.secondary">Credit Limit</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {dossierData?.profile?.limit_days ? `${dossierData.profile.limit_days} Days` : '30 Days'}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>

              {/* Dossier Tabs */}
              <Tabs value={dossierTab} onChange={(e, val) => setDossierTab(val)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tab label={dossierType === 'SUPPLIER' ? 'Purchase Invoices' : 'Sales Invoices'} />
                <Tab label={dossierType === 'SUPPLIER' ? 'Quality History' : 'Quotations'} />
                <Tab label="Associated Stock Lots" />
                <Tab label="Ledger & Payments" />
              </Tabs>

              {/* TAB 0: INVOICES */}
              {dossierTab === 0 && (
                <TableContainer>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: 'grey.50' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Voucher #</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Commodity</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Qty / Wt</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Rate</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Total Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(() => {
                        const invoiceList = (dossierType === 'SUPPLIER' ? dossierData?.purchases : dossierData?.sales) || [];
                        if (invoiceList.length === 0) {
                          return <TableRow><TableCell colSpan={6} align="center">No invoice records found.</TableCell></TableRow>;
                        }
                        return invoiceList.map((row, idx) => (
                          <TableRow key={idx} hover>
                            <TableCell>{row.date}</TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{row.s_no}</TableCell>
                            <TableCell>{row.item_name || 'Agro Commodity'}</TableCell>
                            <TableCell>{row.qty || row.total_weight}</TableCell>
                            <TableCell>₹{row.rate || 0}</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>{formatCurr(row.amount)}</TableCell>
                          </TableRow>
                        ));
                      })()}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* TAB 1: QC / QUOTES */}
              {dossierTab === 1 && (
                <TableContainer>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: 'grey.50' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Reference #</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Item</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Score / Result</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Notes / Remarks</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(() => {
                        const recordsList = (dossierType === 'SUPPLIER' ? dossierData?.qcReports : dossierData?.quotations) || [];
                        if (recordsList.length === 0) {
                          return <TableRow><TableCell colSpan={5} align="center">No records logged in this category.</TableCell></TableRow>;
                        }
                        return recordsList.map((item, idx) => (
                          <TableRow key={idx} hover>
                            <TableCell>{item.date || item.quote_date}</TableCell>
                            <TableCell sx={{ fontFamily: 'monospace' }}>{item.qc_no || item.quote_no}</TableCell>
                            <TableCell>{item.item_name || 'Materials'}</TableCell>
                            <TableCell>
                              <Chip
                                label={item.result || item.status || 'PASSED'}
                                size="small"
                                color={item.result === 'REJECTED' ? 'error' : 'success'}
                              />
                            </TableCell>
                            <TableCell>{item.notes || item.remarks || '-'}</TableCell>
                          </TableRow>
                        ));
                      })()}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* TAB 2: STOCK LOTS */}
              {dossierTab === 2 && (
                <TableContainer>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: 'grey.50' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Lot Number</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Commodity</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Initial Qty</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Remaining Qty</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>QC Status</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="center">360° Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(dossierData?.lots || []).length === 0 ? (
                        <TableRow><TableCell colSpan={6} align="center">No specific lot batches mapped.</TableCell></TableRow>
                      ) : (
                        dossierData.lots.map((lot) => (
                          <TableRow key={lot.lot_no} hover>
                            <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{lot.lot_no}</TableCell>
                            <TableCell>{lot.item_name}</TableCell>
                            <TableCell>{lot.quantity} KG</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>{lot.remaining_quantity} KG</TableCell>
                            <TableCell>
                              <Chip label={lot.qc_status} size="small" color={lot.qc_status === 'PASSED' ? 'success' : 'error'} />
                            </TableCell>
                            <TableCell align="center">
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<QrCode2Icon />}
                                onClick={() => {
                                  setDossierOpen(false);
                                  navigate(`/barcode-qr?code=LOT-${encodeURIComponent(lot.lot_no)}`);
                                }}
                                sx={{ textTransform: 'none' }}
                              >
                                Scan 360°
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* TAB 3: LEDGER */}
              {dossierTab === 3 && (
                <TableContainer>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: 'grey.50' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Voucher No</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Debit (₹)</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Credit (₹)</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Remarks</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(dossierData?.vouchers || []).length === 0 ? (
                        <TableRow><TableCell colSpan={6} align="center">No ledger journal entries found.</TableCell></TableRow>
                      ) : (
                        dossierData.vouchers.map((v, i) => (
                          <TableRow key={i} hover>
                            <TableCell>{v.date}</TableCell>
                            <TableCell sx={{ fontFamily: 'monospace' }}>{v.voucher_no || v.id}</TableCell>
                            <TableCell>{v.type || 'Payment'}</TableCell>
                            <TableCell>{v.debit ? formatCurr(v.debit) : '-'}</TableCell>
                            <TableCell>{v.credit ? formatCurr(v.credit) : '-'}</TableCell>
                            <TableCell>{v.remarks || '-'}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDossierOpen(false)} sx={{ textTransform: 'none' }}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
