import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  Button,
  IconButton,
  Tooltip
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import inventoryIntelligenceService from '../../services/inventoryIntelligenceService';
import LotDrillDownModal from './LotDrillDownModal';

const StockAgingView = () => {
  const [viewType, setViewType] = useState('item'); // 'item' or 'lot'
  const [loading, setLoading] = useState(true);
  const [agingData, setAgingData] = useState(null);
  const [selectedLotNo, setSelectedLotNo] = useState(null);

  useEffect(() => {
    setLoading(true);
    inventoryIntelligenceService.getAging(viewType)
      .then(res => {
        if (res.success) setAgingData(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [viewType]);

  const summary = agingData?.bucketSummary || {
    b0_30: 0,
    b31_60: 0,
    b61_90: 0,
    b91_180: 0,
    b180_plus: 0,
    totalWeightKG: 0,
    totalWeightMT: 0
  };

  const totalKg = summary.totalWeightKG || 1;

  return (
    <Box>
      {/* Top Aging Distribution Summary Cards */}
      <Grid container spacing={1.5} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={2.4}>
          <Card variant="outlined" sx={{ bgcolor: '#f0fdf4', borderColor: '#bbf7d0' }}>
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="caption" sx={{ color: '#166534', fontWeight: 'bold' }}>0 - 30 DAYS</Typography>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#15803d' }}>
                {(summary.b0_30 / 1000).toFixed(2)} MT
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {Math.round((summary.b0_30 / totalKg) * 100)}% of stock (Fresh)
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={2.4}>
          <Card variant="outlined" sx={{ bgcolor: '#f0f9ff', borderColor: '#bae6fd' }}>
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 'bold' }}>31 - 60 DAYS</Typography>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#0284c7' }}>
                {(summary.b31_60 / 1000).toFixed(2)} MT
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {Math.round((summary.b31_60 / totalKg) * 100)}% of stock (Normal)
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={2.4}>
          <Card variant="outlined" sx={{ bgcolor: '#fefce8', borderColor: '#fef08a' }}>
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="caption" sx={{ color: '#a16207', fontWeight: 'bold' }}>61 - 90 DAYS</Typography>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#ca8a04' }}>
                {(summary.b61_90 / 1000).toFixed(2)} MT
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {Math.round((summary.b61_90 / totalKg) * 100)}% of stock (Mature)
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={2.4}>
          <Card variant="outlined" sx={{ bgcolor: '#fff7ed', borderColor: '#fed7aa' }}>
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="caption" sx={{ color: '#c2410c', fontWeight: 'bold' }}>91 - 180 DAYS</Typography>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#ea580c' }}>
                {(summary.b91_180 / 1000).toFixed(2)} MT
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {Math.round((summary.b91_180 / totalKg) * 100)}% of stock (Slow)
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={2.4}>
          <Card variant="outlined" sx={{ bgcolor: '#fff1f2', borderColor: '#fecdd3' }}>
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="caption" sx={{ color: '#be123c', fontWeight: 'bold' }}>180+ DAYS</Typography>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#e11d48' }}>
                {(summary.b180_plus / 1000).toFixed(2)} MT
              </Typography>
              <Typography variant="caption" sx={{ color: '#be123c', fontWeight: 'bold' }}>
                {Math.round((summary.b180_plus / totalKg) * 100)}% of stock (High Risk)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* View Switcher Controls */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
          {viewType === 'item' ? 'Item-Wise Stock Aging Matrix' : 'Lot-Wise Individual Aging Audit'}
        </Typography>

        <ToggleButtonGroup
          value={viewType}
          exclusive
          onChange={(e, val) => val && setViewType(val)}
          size="small"
        >
          <ToggleButton value="item" sx={{ textTransform: 'none', px: 2 }}>
            Item View
          </ToggleButton>
          <ToggleButton value="lot" sx={{ textTransform: 'none', px: 2 }}>
            Lot Detail View
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Main Aging Data Table */}
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6, flexDirection: 'column', alignItems: 'center' }}>
            <CircularProgress size={32} />
            <Typography variant="body2" sx={{ mt: 1, color: '#64748b' }}>Analyzing stock aging buckets...</Typography>
          </Box>
        ) : viewType === 'item' ? (
          /* Item View */
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '12px' }}>ITEM NAME</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '12px' }} align="right">TOTAL STOCK (KG)</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '12px' }} align="right">0-30 DAYS</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '12px' }} align="right">31-60 DAYS</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '12px' }} align="right">61-90 DAYS</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '12px' }} align="right">91-180 DAYS</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '12px' }} align="right">180+ DAYS</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '12px' }} align="center">OLDEST LOT</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {agingData?.items?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>No stock records available.</TableCell>
                </TableRow>
              ) : (
                agingData?.items?.map((it, idx) => (
                  <TableRow key={`${it.itemName}-${idx}`} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{it.itemName}</Typography>
                      <Typography variant="caption" color="text.secondary">{it.lotCount} active lots</Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>{it.totalWeightKG.toLocaleString()}</TableCell>
                    <TableCell align="right" sx={{ color: it.b0_30 > 0 ? '#15803d' : '#94a3b8' }}>{it.b0_30 ? it.b0_30.toLocaleString() : '-'}</TableCell>
                    <TableCell align="right" sx={{ color: it.b31_60 > 0 ? '#0284c7' : '#94a3b8' }}>{it.b31_60 ? it.b31_60.toLocaleString() : '-'}</TableCell>
                    <TableCell align="right" sx={{ color: it.b61_90 > 0 ? '#ca8a04' : '#94a3b8' }}>{it.b61_90 ? it.b61_90.toLocaleString() : '-'}</TableCell>
                    <TableCell align="right" sx={{ color: it.b91_180 > 0 ? '#ea580c' : '#94a3b8' }}>{it.b91_180 ? it.b91_180.toLocaleString() : '-'}</TableCell>
                    <TableCell align="right" sx={{ color: it.b180_plus > 0 ? '#dc2626' : '#94a3b8', fontWeight: it.b180_plus > 0 ? 'bold' : 'normal' }}>
                      {it.b180_plus ? it.b180_plus.toLocaleString() : '-'}
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={`${it.oldestLotDays} Days`}
                        size="small"
                        color={it.oldestLotDays > 180 ? 'error' : it.oldestLotDays > 90 ? 'warning' : 'default'}
                        sx={{ fontSize: '11px', height: 22 }}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        ) : (
          /* Lot View */
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '12px' }}>LOT NO</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '12px' }}>ITEM NAME</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '12px' }}>SUPPLIER</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '12px' }}>INWARD DATE</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '12px' }} align="right">QUANTITY (KG)</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '12px' }} align="center">AGE (DAYS)</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '12px' }} align="center">QC STATUS</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '12px' }} align="center">ACTIONS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {agingData?.lots?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>No lot records available.</TableCell>
                </TableRow>
              ) : (
                agingData?.lots?.map((lot, idx) => (
                  <TableRow key={`${lot.lotNo || 'lot'}-${idx}`} hover>
                    <TableCell sx={{ fontWeight: 'bold', color: '#0369a1' }}>{lot.lotNo}</TableCell>
                    <TableCell>{lot.itemName}</TableCell>
                    <TableCell>{lot.supplier}</TableCell>
                    <TableCell>{lot.receivedDate || 'N/A'}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>{lot.currentWeightKG.toLocaleString()}</TableCell>
                    <TableCell align="center">
                      <Chip
                        label={`${lot.ageDays} Days (${lot.bucket})`}
                        size="small"
                        color={lot.ageDays > 180 ? 'error' : lot.ageDays > 90 ? 'warning' : 'default'}
                        sx={{ fontSize: '11px', height: 22 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={lot.qcStatus}
                        size="small"
                        color={lot.qcStatus === 'PASSED' ? 'success' : lot.qcStatus === 'REJECTED' ? 'error' : 'warning'}
                        sx={{ fontSize: '11px', height: 22 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="View Lot Audit & QC Traceability">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => setSelectedLotNo(lot.lotNo)}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {/* Lot Drilldown Modal */}
      <LotDrillDownModal
        open={Boolean(selectedLotNo)}
        onClose={() => setSelectedLotNo(null)}
        lotNo={selectedLotNo}
      />
    </Box>
  );
};

export default StockAgingView;
