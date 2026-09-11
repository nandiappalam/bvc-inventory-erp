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
  Chip,
  IconButton,
  CircularProgress,
  InputAdornment
} from '@mui/material';
import {
  AcUnit as ColdIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Print as PrintIcon,
  Add as AddIcon,
  FileDownload as ExportIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

const ColdStorageStock = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [stockData, setStockData] = useState([]);
  const [coldStorages, setColdStorages] = useState([]);

  // Filters
  const [selectedCs, setSelectedCs] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchColdStorages();
    fetchStock();
  }, [selectedCs]);

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

  const fetchStock = async () => {
    setLoading(true);
    try {
      let url = '/cold-storage/stock';
      if (selectedCs) {
        url += `?cold_storage_id=${selectedCs}`;
      }
      const res = await api(url);
      if (res && res.data) {
        setStockData(res.data);
      } else {
        setStockData([]);
      }
    } catch (err) {
      console.error('Error fetching stock:', err);
      setStockData([]);
    } finally {
      setLoading(false);
    }
  };

  // Filtered list
  const filteredData = stockData.filter(item => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      item.item_name?.toLowerCase().includes(s) ||
      item.purchase_lot_no?.toLowerCase().includes(s) ||
      item.cold_storage_lot_no?.toLowerCase().includes(s) ||
      item.cold_storage_name?.toLowerCase().includes(s)
    );
  });

  // KPI Calculations
  const totalInwardQty = filteredData.reduce((sum, item) => sum + parseFloat(item.in_qty || 0), 0);
  const totalOutwardQty = filteredData.reduce((sum, item) => sum + parseFloat(item.out_qty || 0), 0);
  const totalAvailableQty = filteredData.reduce((sum, item) => sum + parseFloat(item.available_qty || 0), 0);
  const totalAvailableWt = filteredData.reduce((sum, item) => sum + parseFloat(item.available_wt || 0), 0);

  return (
    <Box sx={{ p: 3, maxWidth: 1300, margin: '0 auto' }}>
      {/* Title Bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ColdIcon sx={{ fontSize: 36, color: '#1f4fb2' }} />
          <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>
            Cold Storage Live Stock Balance & Lot Report
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => navigate('/cold-storage/in')}
          >
            Cold Storage IN (CSI)
          </Button>
          <Button
            variant="contained"
            color="warning"
            startIcon={<AddIcon />}
            onClick={() => navigate('/cold-storage/out')}
          >
            Cold Storage OUT (CSO)
          </Button>
        </Box>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={3}>
          <Card sx={{ borderLeft: '5px solid #1f4fb2', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="body2" color="text.secondary">Total Inward Stored Qty</Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1f4fb2', mt: 0.5 }}>
                {totalInwardQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={3}>
          <Card sx={{ borderLeft: '5px solid #d97706', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="body2" color="text.secondary">Total Issued Outward Qty</Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#d97706', mt: 0.5 }}>
                {totalOutwardQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={3}>
          <Card sx={{ borderLeft: '5px solid #059669', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="body2" color="text.secondary">Net Available Stock Balance</Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#059669', mt: 0.5 }}>
                {totalAvailableQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={3}>
          <Card sx={{ borderLeft: '5px solid #4f46e5', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="body2" color="text.secondary">Net Stored Weight (KG)</Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#4f46e5', mt: 0.5 }}>
                {totalAvailableWt.toLocaleString('en-IN', { maximumFractionDigits: 2 })} KG
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filter Bar */}
      <Card sx={{ mb: 3, p: 2, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              select
              size="small"
              label="Filter by Cold Storage"
              value={selectedCs}
              onChange={(e) => setSelectedCs(e.target.value)}
            >
              <MenuItem value="">-- All Cold Storages --</MenuItem>
              {coldStorages.map((cs) => (
                <MenuItem key={cs.id} value={cs.id}>
                  {cs.godown_name} ({cs.external_company || 'Cold Storage'})
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={5}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search by Item Name, Cold Storage Lot, or Purchase Lot..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid item xs={12} sm={3} sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchStock}
              sx={{ flexGrow: 1 }}
            >
              Refresh
            </Button>
            <IconButton onClick={() => window.print()} title="Print Report">
              <PrintIcon />
            </IconButton>
          </Grid>
        </Grid>
      </Card>

      {/* Table Card */}
      <Card sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
              <CircularProgress />
            </Box>
          ) : filteredData.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">No stock items found in Cold Storage.</Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} elevation={0}>
              <Table size="small">
                <TableHead sx={{ backgroundColor: '#1f4fb2' }}>
                  <TableRow>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>#</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Cold Storage Facility</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Item Name</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>CS Lot #</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Original Purchase Lot #</TableCell>
                    <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold' }}>Stored Qty (IN)</TableCell>
                    <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold' }}>Issued Qty (OUT)</TableCell>
                    <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold' }}>Available Balance</TableCell>
                    <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold' }}>Available Weight</TableCell>
                    <TableCell align="center" sx={{ color: '#fff', fontWeight: 'bold' }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredData.map((row, idx) => (
                    <TableRow key={idx} hover sx={{ '&:nth-of-type(even)': { backgroundColor: '#f8fafc' } }}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell sx={{ fontWeight: '500', color: '#1f4fb2' }}>
                        {row.cold_storage_name}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>{row.item_name}</TableCell>
                      <TableCell>
                        <Chip label={row.cold_storage_lot_no} size="small" color="primary" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Chip label={row.purchase_lot_no} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell align="right">{row.in_qty.toFixed(2)} {row.unit}</TableCell>
                      <TableCell align="right" sx={{ color: '#d97706' }}>{row.out_qty.toFixed(2)} {row.unit}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: row.available_qty > 0 ? '#059669' : '#dc2626' }}>
                        {row.available_qty.toFixed(2)} {row.unit}
                      </TableCell>
                      <TableCell align="right">{row.available_wt.toFixed(2)} KG</TableCell>
                      <TableCell align="center">
                        {row.available_qty > 0 ? (
                          <Chip label="In Stock" size="small" color="success" />
                        ) : (
                          <Chip label="Exhausted" size="small" color="default" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default ColdStorageStock;
