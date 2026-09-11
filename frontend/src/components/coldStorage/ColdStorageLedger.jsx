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
  CircularProgress
} from '@mui/material';
import {
  AcUnit as ColdIcon,
  Refresh as RefreshIcon,
  Print as PrintIcon
} from '@mui/icons-material';
import { api } from '../../services/api';

const ColdStorageLedger = () => {
  const [loading, setLoading] = useState(false);
  const [ledgerData, setLedgerData] = useState([]);
  const [coldStorages, setColdStorages] = useState([]);

  // Filters
  const [selectedCs, setSelectedCs] = useState('');
  const [itemName, setItemName] = useState('');
  const [purchaseLotNo, setPurchaseLotNo] = useState('');
  const [coldStorageLotNo, setColdStorageLotNo] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchColdStorages();
    fetchLedger();
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

  const fetchLedger = async () => {
    setLoading(true);
    try {
      let params = [];
      if (selectedCs) params.push(`cold_storage_id=${selectedCs}`);
      if (itemName) params.push(`item_name=${encodeURIComponent(itemName)}`);
      if (purchaseLotNo) params.push(`purchase_lot_no=${encodeURIComponent(purchaseLotNo)}`);
      if (coldStorageLotNo) params.push(`cold_storage_lot_no=${encodeURIComponent(coldStorageLotNo)}`);
      if (dateFrom) params.push(`date_from=${dateFrom}`);
      if (dateTo) params.push(`date_to=${dateTo}`);

      const queryString = params.length > 0 ? `?${params.join('&')}` : '';
      const res = await api(`/cold-storage/ledger${queryString}`);

      if (res && res.data) {
        setLedgerData(res.data);
      } else {
        setLedgerData([]);
      }
    } catch (err) {
      console.error('Error fetching ledger:', err);
      setLedgerData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSelectedCs('');
    setItemName('');
    setPurchaseLotNo('');
    setColdStorageLotNo('');
    setDateFrom('');
    setDateTo('');
    fetchLedger();
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, width: '100%', maxWidth: '100%', margin: '0 auto' }}>
      {/* Title */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ColdIcon sx={{ fontSize: 36, color: '#1f4fb2' }} />
          <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>
            Cold Storage Item & Lot Movement Ledger
          </Typography>
        </Box>
        <IconButton onClick={() => window.print()} title="Print Ledger">
          <PrintIcon />
        </IconButton>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3, p: 2, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              select
              size="small"
              label="Cold Storage Facility"
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
              label="Item Name"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Grain / Powder"
            />
          </Grid>

          <Grid item xs={12} sm={2}>
            <TextField
              fullWidth
              size="small"
              label="Purchase Lot #"
              value={purchaseLotNo}
              onChange={(e) => setPurchaseLotNo(e.target.value)}
            />
          </Grid>

          <Grid item xs={12} sm={2}>
            <TextField
              fullWidth
              size="small"
              label="CS Lot #"
              value={coldStorageLotNo}
              onChange={(e) => setColdStorageLotNo(e.target.value)}
            />
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

          <Grid item xs={12} sm={4} sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={fetchLedger}
              sx={{ flexGrow: 1 }}
            >
              Search Ledger
            </Button>
            <Button
              variant="outlined"
              onClick={handleResetFilters}
            >
              Reset
            </Button>
          </Grid>
        </Grid>
      </Card>

      {/* Ledger Table */}
      <Card sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
              <CircularProgress />
            </Box>
          ) : ledgerData.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">No ledger transaction history found for selected criteria.</Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 1150 }}>
                <TableHead sx={{ backgroundColor: '#1f4fb2' }}>
                  <TableRow>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>#</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Date</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Voucher No</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Type</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Item Name</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>CS Lot #</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Purchase Lot #</TableCell>
                    <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold' }}>Inward (+)</TableCell>
                    <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold' }}>Outward (-)</TableCell>
                    <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold' }}>Running Balance</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Remarks</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {ledgerData.map((row, idx) => {
                    const isIn = row.voucher_type === 'IN';
                    const qty = parseFloat(row.quantity || 0);

                    return (
                      <TableRow key={idx} hover sx={{ '&:nth-of-type(even)': { backgroundColor: '#f8fafc' } }}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>{row.voucher_date}</TableCell>
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
                        <TableCell sx={{ fontWeight: 'bold' }}>{row.item_name}</TableCell>
                        <TableCell><Chip label={row.cold_storage_lot_no} size="small" variant="outlined" color="primary" /></TableCell>
                        <TableCell><Chip label={row.purchase_lot_no} size="small" variant="outlined" /></TableCell>
                        <TableCell align="right" sx={{ color: '#059669', fontWeight: isIn ? 'bold' : 'normal' }}>
                          {isIn ? `+${qty.toFixed(2)} ${row.unit}` : '-'}
                        </TableCell>
                        <TableCell align="right" sx={{ color: '#dc2626', fontWeight: !isIn ? 'bold' : 'normal' }}>
                          {!isIn ? `-${qty.toFixed(2)} ${row.unit}` : '-'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>
                          {row.running_balance.toFixed(2)} {row.unit}
                        </TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontSize: '12px' }}>
                          {row.remarks || '-'}
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
    </Box>
  );
};

export default ColdStorageLedger;
