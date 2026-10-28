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
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip
} from '@mui/material';
import {
  AcUnit as ColdIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Print as PrintIcon,
  Add as AddIcon,
  Calculate as CalcIcon,
  Schedule as ScheduleIcon,
  AttachMoney as MoneyIcon,
  Inventory2 as BoxIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { printHtml } from '../../utils/printHelper';

const ColdStorageStock = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [stockData, setStockData] = useState([]);
  const [coldStorages, setColdStorages] = useState([]);

  // View mode: 'balance' | 'valuation'
  const [viewMode, setViewMode] = useState('valuation');

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
      item.cold_storage_name?.toLowerCase().includes(s) ||
      item.operator_name?.toLowerCase().includes(s)
    );
  });

  // KPI Calculations
  const totalInwardQty = filteredData.reduce((sum, item) => sum + parseFloat(item.in_qty || 0), 0);
  const totalOutwardQty = filteredData.reduce((sum, item) => sum + parseFloat(item.out_qty || 0), 0);
  const totalAvailableQty = filteredData.reduce((sum, item) => sum + parseFloat(item.available_qty || 0), 0);
  const totalAvailableWt = filteredData.reduce((sum, item) => sum + parseFloat(item.available_wt || 0), 0);
  const totalAccruedStorageCost = filteredData.reduce((sum, item) => sum + parseFloat(item.accrued_storage_cost || 0), 0);
  const totalAccruedHandlingCost = filteredData.reduce((sum, item) => sum + parseFloat(item.accrued_handling_cost || 0), 0);
  const totalAccruedLiability = filteredData.reduce((sum, item) => sum + parseFloat(item.total_accrued_cost || 0), 0);

  const handlePrintReport = () => {
    const isValuation = viewMode === 'valuation';
    const rowsHtml = filteredData.map((row, idx) => `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${idx + 1}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: bold; color: #1f4fb2;">${row.cold_storage_name || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 600;">${row.item_name || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${row.cold_storage_lot_no || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${row.purchase_lot_no || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${row.inward_date || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: ${row.available_qty > 0 ? '#059669' : '#dc2626'};">
          ${parseFloat(row.available_qty || 0).toFixed(2)} ${row.unit || 'Bags'}
        </td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">${parseFloat(row.available_wt || 0).toFixed(2)} KG</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #d97706;">
          ${row.storage_days || 0} Days (${row.billing_periods || 1} Slabs)
        </td>
        ${isValuation ? `
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">₹${parseFloat(row.rate_per_bag || row.effective_rate || 0).toFixed(2)}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: #1e40af;">₹${parseFloat(row.accrued_storage_cost || 0).toFixed(2)}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: #b45309;">₹${parseFloat(row.accrued_handling_cost || 0).toFixed(2)}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: 800; color: #047857;">₹${parseFloat(row.total_accrued_cost || 0).toFixed(2)}</td>
        ` : `
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; color: #475569;">${parseFloat(row.in_qty || 0).toFixed(2)}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; color: #d97706;">${parseFloat(row.out_qty || 0).toFixed(2)}</td>
        `}
      </tr>
    `).join('');

    const activeCsName = selectedCs
      ? (coldStorages.find(c => String(c.id) === String(selectedCs))?.godown_name || selectedCs)
      : 'All Facilities';

    const html = `
      <div style="font-family: Arial, sans-serif; color: #0f172a; padding: 10px;">
        <div style="border-bottom: 2px solid #1f4fb2; padding-bottom: 10px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h2 style="margin: 0; color: #1f4fb2; font-size: 20px; text-transform: uppercase;">Cold Storage Live Stock & Valuation Report</h2>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
              Facility: <strong>${activeCsName}</strong> | As of Date: <strong>${new Date().toLocaleDateString('en-IN')}</strong>
            </div>
          </div>
          <div style="text-align: right; font-size: 12px; color: #475569;">
            Total Active Lots: <strong>${filteredData.length}</strong>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px;">
          <tr style="background: #f1f5f9;">
            <td style="padding: 8px 12px; border: 1px solid #cbd5e1; width: 20%;">
              <div style="font-size: 10px; color: #64748b;">Net Available Stock</div>
              <div style="font-size: 14px; font-weight: bold; color: #059669;">${totalAvailableQty.toFixed(2)} Bags</div>
            </td>
            <td style="padding: 8px 12px; border: 1px solid #cbd5e1; width: 20%;">
              <div style="font-size: 10px; color: #64748b;">Net Stored Weight</div>
              <div style="font-size: 14px; font-weight: bold; color: #4f46e5;">${totalAvailableWt.toFixed(2)} KG</div>
            </td>
            <td style="padding: 8px 12px; border: 1px solid #cbd5e1; width: 20%;">
              <div style="font-size: 10px; color: #64748b;">Accrued Storage Rent</div>
              <div style="font-size: 14px; font-weight: bold; color: #1e40af;">₹${totalAccruedStorageCost.toFixed(2)}</div>
            </td>
            <td style="padding: 8px 12px; border: 1px solid #cbd5e1; width: 20%;">
              <div style="font-size: 10px; color: #64748b;">Accrued Handling Charges</div>
              <div style="font-size: 14px; font-weight: bold; color: #b45309;">₹${totalAccruedHandlingCost.toFixed(2)}</div>
            </td>
            <td style="padding: 8px 12px; border: 1px solid #cbd5e1; width: 20%;">
              <div style="font-size: 10px; color: #64748b;">Total Accrued Cost</div>
              <div style="font-size: 14px; font-weight: 800; color: #047857;">₹${totalAccruedLiability.toFixed(2)}</div>
            </td>
          </tr>
        </table>

        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background-color: #1f4fb2; color: #ffffff;">
              <th style="padding: 8px 6px; border: 1px solid #1f4fb2; text-align: center; color: #fff;">#</th>
              <th style="padding: 8px 6px; border: 1px solid #1f4fb2; text-align: left; color: #fff;">Cold Storage</th>
              <th style="padding: 8px 6px; border: 1px solid #1f4fb2; text-align: left; color: #fff;">Item Name</th>
              <th style="padding: 8px 6px; border: 1px solid #1f4fb2; text-align: center; color: #fff;">CS Lot #</th>
              <th style="padding: 8px 6px; border: 1px solid #1f4fb2; text-align: center; color: #fff;">Orig Lot #</th>
              <th style="padding: 8px 6px; border: 1px solid #1f4fb2; text-align: center; color: #fff;">Inward Date</th>
              <th style="padding: 8px 6px; border: 1px solid #1f4fb2; text-align: right; color: #fff;">Balance Qty</th>
              <th style="padding: 8px 6px; border: 1px solid #1f4fb2; text-align: right; color: #fff;">Balance Wt</th>
              <th style="padding: 8px 6px; border: 1px solid #1f4fb2; text-align: center; color: #fff;">Days (Slabs)</th>
              ${isValuation ? `
                <th style="padding: 8px 6px; border: 1px solid #1f4fb2; text-align: right; color: #fff;">Rate/Bag</th>
                <th style="padding: 8px 6px; border: 1px solid #1f4fb2; text-align: right; color: #fff;">Accrued Rent</th>
                <th style="padding: 8px 6px; border: 1px solid #1f4fb2; text-align: right; color: #fff;">Handling</th>
                <th style="padding: 8px 6px; border: 1px solid #1f4fb2; text-align: right; color: #fff;">Total Cost</th>
              ` : `
                <th style="padding: 8px 6px; border: 1px solid #1f4fb2; text-align: right; color: #fff;">In Qty</th>
                <th style="padding: 8px 6px; border: 1px solid #1f4fb2; text-align: right; color: #fff;">Out Qty</th>
              `}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml.length > 0 ? rowsHtml : '<tr><td colspan="13" style="text-align:center; padding: 20px; color: #64748b;">No stock records found</td></tr>'}
          </tbody>
        </table>

        <div style="margin-top: 24px; border-top: 1px solid #cbd5e1; padding-top: 8px; font-size: 10px; color: #64748b; display: flex; justify-content: space-between;">
          <span>BVC ERP System - External Cold Storage Management</span>
          <span>Stock Valuation & Storage Duration Audit</span>
        </div>
      </div>
    `;
    printHtml(html, 'Cold Storage Stock Valuation Report');
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, width: '100%', maxWidth: '100%', margin: '0 auto' }}>
      {/* Title Bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ColdIcon sx={{ fontSize: 36, color: '#1f4fb2' }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>
              Cold Storage Live Stock & Storage Valuation
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Track external warehouse balances, lot duration slabs, accrued rent and handling liability
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
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
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<CalcIcon />}
            onClick={() => navigate('/cold-storage/billing')}
          >
            Verify Operator Bill
          </Button>
        </Box>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ borderLeft: '5px solid #059669', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                Available Balance
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#059669', mt: 0.5 }}>
                {totalAvailableQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </Typography>
              <Typography variant="caption" color="text.secondary">Total Bags / Units in CS</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ borderLeft: '5px solid #4f46e5', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                Net Stored Weight
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#4f46e5', mt: 0.5 }}>
                {totalAvailableWt.toLocaleString('en-IN', { maximumFractionDigits: 2 })} KG
              </Typography>
              <Typography variant="caption" color="text.secondary">Physical stock weight</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ borderLeft: '5px solid #1e40af', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                Accrued Storage Rent
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1e40af', mt: 0.5 }}>
                ₹{totalAccruedStorageCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </Typography>
              <Typography variant="caption" color="text.secondary">Based on duration slabs</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ borderLeft: '5px solid #d97706', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                Accrued Handling
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#d97706', mt: 0.5 }}>
                ₹{totalAccruedHandlingCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </Typography>
              <Typography variant="caption" color="text.secondary">Inward + Outward load/unload</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={12} md={2.4}>
          <Card sx={{ borderLeft: '5px solid #047857', backgroundColor: '#f0fdf4', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                Total Accrued Cost
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: '800', color: '#047857', mt: 0.5 }}>
                ₹{totalAccruedLiability.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </Typography>
              <Typography variant="caption" color="text.secondary">Storage + Handling + Insurance</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filter and View Mode Bar */}
      <Card sx={{ mb: 3, p: 2, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={3.5}>
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
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search by Item, Cold Storage Lot, or Purchase Lot..."
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
          <Grid item xs={12} sm={2.5}>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              size="small"
              onChange={(_, val) => val && setViewMode(val)}
              fullWidth
            >
              <ToggleButton value="valuation" sx={{ px: 1, fontSize: '12px', fontWeight: 'bold' }}>
                <MoneyIcon fontSize="small" sx={{ mr: 0.5 }} /> Valuation
              </ToggleButton>
              <ToggleButton value="balance" sx={{ px: 1, fontSize: '12px', fontWeight: 'bold' }}>
                <BoxIcon fontSize="small" sx={{ mr: 0.5 }} /> Quantities
              </ToggleButton>
            </ToggleButtonGroup>
          </Grid>
          <Grid item xs={12} sm={2} sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchStock}
              sx={{ flexGrow: 1 }}
            >
              Refresh
            </Button>
            <Tooltip title="Print Stock & Cost Report">
              <IconButton onClick={handlePrintReport} color="primary">
                <PrintIcon />
              </IconButton>
            </Tooltip>
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
            <TableContainer component={Paper} elevation={0} sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 1250 }}>
                <TableHead sx={{ backgroundColor: '#1f4fb2' }}>
                  <TableRow>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold', width: 45 }}>#</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Cold Storage Facility</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Item Name</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>CS Lot #</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Original Purchase Lot #</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Inward Date</TableCell>
                    <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold' }}>Available Balance</TableCell>
                    <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold' }}>Available Weight</TableCell>
                    <TableCell align="center" sx={{ color: '#fff', fontWeight: 'bold' }}>Duration / Slabs</TableCell>
                    {viewMode === 'valuation' ? (
                      <>
                        <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold' }}>Storage Rate</TableCell>
                        <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold' }}>Accrued Rent</TableCell>
                        <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold' }}>Handling Cost</TableCell>
                        <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold' }}>Total Accrued</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold' }}>Inward Qty</TableCell>
                        <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold' }}>Outward Qty</TableCell>
                        <TableCell align="center" sx={{ color: '#fff', fontWeight: 'bold' }}>Stock Status</TableCell>
                      </>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredData.map((row, idx) => {
                    const isExhausted = row.available_qty <= 0;
                    return (
                      <TableRow
                        key={idx}
                        sx={{
                          backgroundColor: idx % 2 === 0 ? '#fff' : '#f8fafc',
                          '&:hover': { backgroundColor: '#f1f5f9' },
                          opacity: isExhausted ? 0.65 : 1
                        }}
                      >
                        <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>{idx + 1}</TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>
                            {row.cold_storage_name || 'Cold Storage'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {row.chamber_no || 'Chamber 1'} • {row.operator_name || 'Operator'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>{row.item_name}</TableCell>
                        <TableCell>
                          <Chip
                            label={row.cold_storage_lot_no || '-'}
                            size="small"
                            sx={{ fontWeight: 'bold', backgroundColor: '#e0f2fe', color: '#0369a1' }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={row.purchase_lot_no || '-'}
                            size="small"
                            variant="outlined"
                            sx={{ fontWeight: '600' }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: '12px' }}>
                          {row.inward_date || '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: isExhausted ? '#dc2626' : '#059669', fontSize: '13px' }}>
                          {parseFloat(row.available_qty || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} {(!row.unit || row.unit.toLowerCase() === 'kg') ? 'Bags' : row.unit}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                          {parseFloat(row.available_wt || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} KG
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title={`${row.storage_days || 0} storage days (${row.billable_days || row.storage_days} billable) in ${row.storage_duration || 10}-day slabs`}>
                            <Chip
                              icon={<ScheduleIcon sx={{ fontSize: '14px !important' }} />}
                              label={`${row.storage_days || 0}d (${row.billing_periods || 1} slab)`}
                              size="small"
                              color={row.billing_periods > 3 ? 'warning' : 'default'}
                              variant="outlined"
                              sx={{ fontWeight: 'bold', fontSize: '11px' }}
                            />
                          </Tooltip>
                        </TableCell>

                        {viewMode === 'valuation' ? (
                          <>
                            <TableCell align="right" sx={{ fontSize: '12px' }}>
                              ₹{parseFloat(row.rate_per_bag || row.effective_rate || 0).toFixed(2)}
                              <Typography variant="caption" display="block" color="text.secondary">
                                /{row.billing_basis || 'Bag'}
                              </Typography>
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', color: '#1e40af' }}>
                              ₹{parseFloat(row.accrued_storage_cost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', color: '#b45309' }}>
                              ₹{parseFloat(row.accrued_handling_cost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: '800', color: '#047857', backgroundColor: '#f0fdf4' }}>
                              ₹{parseFloat(row.total_accrued_cost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell align="right" sx={{ color: '#475569' }}>
                              {parseFloat(row.in_qty || 0).toFixed(2)}
                            </TableCell>
                            <TableCell align="right" sx={{ color: '#d97706' }}>
                              {parseFloat(row.out_qty || 0).toFixed(2)}
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label={isExhausted ? 'Exhausted' : 'In Stock'}
                                color={isExhausted ? 'default' : 'success'}
                                size="small"
                                sx={{ fontWeight: 'bold' }}
                              />
                            </TableCell>
                          </>
                        )}
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

export default ColdStorageStock;
