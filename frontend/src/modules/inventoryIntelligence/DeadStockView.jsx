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
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useNavigate } from 'react-router-dom';
import inventoryIntelligenceService from '../../services/inventoryIntelligenceService';

const DeadStockView = () => {
  const navigate = useNavigate();
  const [thresholdDays, setThresholdDays] = useState(120);
  const [loading, setLoading] = useState(true);
  const [deadStockData, setDeadStockData] = useState(null);

  useEffect(() => {
    setLoading(true);
    inventoryIntelligenceService.getDeadStock(thresholdDays)
      .then(res => {
        if (res.success) setDeadStockData(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [thresholdDays]);

  const items = deadStockData?.items || [];
  const totalLockedKg = deadStockData?.totalDeadStockKG || 0;
  const totalLockedValue = deadStockData?.totalLockedCapitalValue || 0;

  return (
    <Box>
      {/* Top Controls & Threshold Selection */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
            Dead Stock Identification & Capital Recovery
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Identifies items and lots with zero transaction activity for &ge; {thresholdDays} consecutive days.
          </Typography>
        </Box>

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="threshold-days-label">Inactivity Threshold</InputLabel>
          <Select
            labelId="threshold-days-label"
            value={thresholdDays}
            label="Inactivity Threshold"
            onChange={(e) => setThresholdDays(e.target.value)}
          >
            <MenuItem value={60}>&ge; 60 Days (Slow Moving)</MenuItem>
            <MenuItem value={90}>&ge; 90 Days (Stagnant)</MenuItem>
            <MenuItem value={120}>&ge; 120 Days (Dead Stock Standard)</MenuItem>
            <MenuItem value={180}>&ge; 180 Days (High Risk Dead Stock)</MenuItem>
            <MenuItem value={365}>&ge; 365 Days (Obsolete)</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Summary KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card variant="outlined" sx={{ bgcolor: '#fff1f2', borderColor: '#fecdd3' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: '#be123c', fontWeight: 'bold' }}>DEAD STOCK ITEMS</Typography>
                <HourglassEmptyIcon sx={{ color: '#e11d48' }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#9f1239', my: 0.5 }}>
                {items.length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                No consumption in last {thresholdDays} days
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card variant="outlined" sx={{ bgcolor: '#fefce8', borderColor: '#fef08a' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: '#a16207', fontWeight: 'bold' }}>LOCKED STOCK VOLUME</Typography>
                <WarehouseIcon sx={{ color: '#ca8a04' }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#854d0e', my: 0.5 }}>
                {(totalLockedKg / 1000).toFixed(2)} MT
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {totalLockedKg.toLocaleString()} KG Occupying Warehouse
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card variant="outlined" sx={{ bgcolor: '#f0fdf4', borderColor: '#bbf7d0' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: '#166534', fontWeight: 'bold' }}>LOCKED WORKING CAPITAL</Typography>
                <AttachMoneyIcon sx={{ color: '#16a34a' }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#15803d', my: 0.5 }}>
                ₹{totalLockedValue.toLocaleString('en-IN')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Estimated Capital Eligible for Recovery
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Dead Stock Items Table */}
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6, flexDirection: 'column', alignItems: 'center' }}>
            <CircularProgress size={32} />
            <Typography variant="body2" sx={{ mt: 1, color: '#64748b' }}>Scanning historical movement ledgers...</Typography>
          </Box>
        ) : items.length === 0 ? (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <Typography variant="h6" sx={{ color: '#166534', fontWeight: 'bold', mb: 1 }}>
              No Dead Stock Found!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              All inventory items have recent transactions within {thresholdDays} days.
            </Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '12px' }}>ITEM NAME</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '12px' }}>CATEGORY</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '12px' }} align="right">LOCKED QTY (KG)</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '12px' }} align="right">LOCKED VALUE (₹)</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '12px' }}>LAST MOVEMENT DATE</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '12px' }} align="center">DAYS INACTIVE</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '12px' }}>GODOWNS</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '12px' }} align="center">ACTIONS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((it, idx) => (
                <TableRow key={`${it.itemName}-${idx}`} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#0f172a' }}>
                      {it.itemName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {it.lots.length} inactive lot(s)
                    </Typography>
                  </TableCell>

                  <TableCell>{it.itemGroup}</TableCell>

                  <TableCell align="right" sx={{ fontWeight: 'bold', color: '#991b1b' }}>
                    {it.totalWeightKG.toLocaleString()}
                  </TableCell>

                  <TableCell align="right" sx={{ fontWeight: 'bold', color: '#15803d' }}>
                    ₹{it.totalValue.toLocaleString('en-IN')}
                  </TableCell>

                  <TableCell>{it.lastMovementDate || 'Historical'}</TableCell>

                  <TableCell align="center">
                    <Chip
                      label={`${it.daysInactive} Days`}
                      size="small"
                      color={it.daysInactive >= 180 ? 'error' : 'warning'}
                      sx={{ fontWeight: 'bold', fontSize: '11px', height: 22 }}
                    />
                  </TableCell>

                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {it.godowns.map((g, idx) => (
                        <Chip key={idx} label={g} size="small" variant="outlined" sx={{ height: 20, fontSize: '10px' }} />
                      ))}
                    </Box>
                  </TableCell>

                  <TableCell align="center">
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => navigate('/entry/work-order-slip-create')}
                        sx={{ fontSize: '11px', textTransform: 'none', py: 0.2 }}
                      >
                        Plan in Work Order
                      </Button>
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => navigate('/reports/category/stock')}
                        sx={{ fontSize: '11px', textTransform: 'none', py: 0.2 }}
                      >
                        Ledger
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableContainer>
    </Box>
  );
};

export default DeadStockView;
