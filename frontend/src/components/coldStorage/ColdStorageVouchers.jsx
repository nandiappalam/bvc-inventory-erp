import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  MenuItem,
  Tabs,
  Tab,
  Chip,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Alert
} from '@mui/material';
import {
  AcUnit as ColdIcon,
  Visibility as ViewIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Print as PrintIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

const ColdStorageVouchers = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [vouchers, setVouchers] = useState([]);
  const [coldStorages, setColdStorages] = useState([]);

  // Filters
  const [activeTab, setActiveTab] = useState('ALL'); // ALL, IN, OUT
  const [selectedCs, setSelectedCs] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');

  // View Modal State
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedVoucherDetails, setSelectedVoucherDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    fetchColdStorages();
    fetchVouchers();
  }, [activeTab, selectedCs, dateFrom, dateTo]);

  const fetchColdStorages = async () => {
    try {
      const res = await api('/cold-storage/storages');
      if (res && res.data) {
        setColdStorages(res.data);
      }
    } catch (err) {
      console.error('Error fetching storages:', err);
    }
  };

  const fetchVouchers = async () => {
    setLoading(true);
    try {
      let params = [];
      if (activeTab !== 'ALL') params.push(`voucher_type=${activeTab}`);
      if (selectedCs) params.push(`cold_storage_id=${selectedCs}`);
      if (dateFrom) params.push(`date_from=${dateFrom}`);
      if (dateTo) params.push(`date_to=${dateTo}`);

      const queryString = params.length > 0 ? `?${params.join('&')}` : '';
      const res = await api(`/cold-storage/vouchers${queryString}`);

      if (res && res.data) {
        setVouchers(res.data);
      } else {
        setVouchers([]);
      }
    } catch (err) {
      console.error('Error fetching vouchers:', err);
      setVouchers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewVoucher = async (id) => {
    setLoadingDetails(true);
    setViewModalOpen(true);
    try {
      const res = await api(`/cold-storage/vouchers/${id}`);
      if (res && res.data) {
        setSelectedVoucherDetails(res.data);
      }
    } catch (err) {
      console.error('Error loading voucher details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleDeleteVoucher = async (id, voucherNo) => {
    if (!window.confirm(`Are you sure you want to delete Cold Storage Voucher ${voucherNo}?`)) {
      return;
    }
    try {
      const res = await api(`/cold-storage/vouchers/${id}`, { method: 'DELETE' });
      if (res && res.success) {
        fetchVouchers();
      }
    } catch (err) {
      alert('Error deleting voucher: ' + err.message);
    }
  };

  const filteredVouchers = vouchers.filter(v => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      v.voucher_no?.toLowerCase().includes(s) ||
      v.cold_storage_name?.toLowerCase().includes(s) ||
      v.remarks?.toLowerCase().includes(s)
    );
  });

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, width: '100%', maxWidth: '100%', margin: '0 auto' }}>
      {/* Title Bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ColdIcon sx={{ fontSize: 36, color: '#1f4fb2' }} />
          <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>
            Cold Storage Voucher Register
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => navigate('/cold-storage/in')}
          >
            New Inward (CSI)
          </Button>
          <Button
            variant="contained"
            color="warning"
            startIcon={<AddIcon />}
            onClick={() => navigate('/cold-storage/out')}
          >
            New Outward (CSO)
          </Button>
        </Box>
      </Box>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(e, val) => setActiveTab(val)}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label="All Vouchers" value="ALL" />
          <Tab label="Cold Storage IN (CSI)" value="IN" />
          <Tab label="Cold Storage OUT (CSO)" value="OUT" />
        </Tabs>
      </Paper>

      {/* Filters */}
      <Card sx={{ mb: 3, p: 2, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              select
              size="small"
              label="Cold Storage Location"
              value={selectedCs}
              onChange={(e) => setSelectedCs(e.target.value)}
            >
              <MenuItem value="">-- All Cold Storages --</MenuItem>
              {coldStorages.map((cs) => (
                <MenuItem key={cs.id} value={cs.id}>
                  {cs.godown_name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={2.5}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="From Date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} sm={2.5}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="To Date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search Voucher # or Remarks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Grid>

          <Grid item xs={12} sm={1}>
            <IconButton onClick={fetchVouchers} color="primary" title="Refresh">
              <RefreshIcon />
            </IconButton>
          </Grid>
        </Grid>
      </Card>

      {/* Voucher List Table */}
      <Card sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
              <CircularProgress />
            </Box>
          ) : filteredVouchers.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">No Cold Storage vouchers found.</Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 1100 }}>
                <TableHead sx={{ backgroundColor: '#1f4fb2' }}>
                  <TableRow>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>#</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Voucher No</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Type</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Date</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Cold Storage Facility</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Origin / Destination</TableCell>
                    <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold' }}>Total Qty</TableCell>
                    <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold' }}>Total Wt (KG)</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Remarks</TableCell>
                    <TableCell align="center" sx={{ color: '#fff', fontWeight: 'bold' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredVouchers.map((row, idx) => {
                    const isIn = row.voucher_type === 'IN';
                    return (
                      <TableRow key={row.id} hover sx={{ '&:nth-of-type(even)': { backgroundColor: '#f8fafc' } }}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: isIn ? '#1f4fb2' : '#d97706' }}>
                          {row.voucher_no}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={isIn ? 'INWARD' : 'OUTWARD'}
                            color={isIn ? 'primary' : 'warning'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{row.voucher_date}</TableCell>
                        <TableCell sx={{ fontWeight: '500' }}>{row.cold_storage_name}</TableCell>
                        <TableCell>
                          {isIn ? (row.source_godown_name || 'Main Godown') : (row.destination_godown_name || 'Production Floor')}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                          {parseFloat(row.total_qty || 0).toFixed(2)}
                        </TableCell>
                        <TableCell align="right">
                          {parseFloat(row.total_wt || 0).toFixed(2)} KG
                        </TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontSize: '12px' }}>
                          {row.remarks || '-'}
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleViewVoucher(row.id)}
                            title="View Voucher"
                          >
                            <ViewIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteVoucher(row.id, row.voucher_no)}
                            title="Delete Voucher"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* View Voucher Modal */}
      <Dialog open={viewModalOpen} onClose={() => setViewModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ backgroundColor: '#1f4fb2', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Cold Storage Voucher Details</Typography>
          <IconButton onClick={() => setViewModalOpen(false)} sx={{ color: '#fff' }}>×</IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {loadingDetails ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : selectedVoucherDetails ? (
            <Box>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" color="text.secondary">Voucher Number</Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>{selectedVoucherDetails.voucher_no}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" color="text.secondary">Voucher Type</Typography>
                  <Chip
                    label={selectedVoucherDetails.voucher_type === 'IN' ? 'COLD STORAGE IN' : 'COLD STORAGE OUT'}
                    color={selectedVoucherDetails.voucher_type === 'IN' ? 'primary' : 'warning'}
                    size="small"
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" color="text.secondary">Date</Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>{selectedVoucherDetails.voucher_date}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" color="text.secondary">Facility</Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>{selectedVoucherDetails.cold_storage_name}</Typography>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, color: '#1f4fb2' }}>
                Item & Lot Breakdown
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead sx={{ backgroundColor: '#f0f4fa' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Item Name</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Purchase Lot #</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>CS Lot #</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Quantity</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Weight</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total Weight</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Unit</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(selectedVoucherDetails.items || []).map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>{item.item_name}</TableCell>
                        <TableCell>{item.purchase_lot_no}</TableCell>
                        <TableCell><Chip label={item.cold_storage_lot_no} size="small" variant="outlined" color="primary" /></TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right">{item.weight}</TableCell>
                        <TableCell align="right">{item.total_wt} KG</TableCell>
                        <TableCell>{item.unit}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {selectedVoucherDetails.remarks && (
                <Box sx={{ mt: 2, p: 1.5, backgroundColor: '#f8fafc', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary">Remarks:</Typography>
                  <Typography variant="body2">{selectedVoucherDetails.remarks}</Typography>
                </Box>
              )}
            </Box>
          ) : (
            <Typography>No details available.</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button variant="outlined" onClick={() => setViewModalOpen(false)}>Close</Button>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>
            Print Voucher
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ColdStorageVouchers;
