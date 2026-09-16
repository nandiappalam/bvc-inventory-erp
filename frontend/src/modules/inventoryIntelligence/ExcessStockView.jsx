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
  CircularProgress
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import InventoryIcon from '@mui/icons-material/Inventory';
import inventoryIntelligenceService from '../../services/inventoryIntelligenceService';
import { useNavigate } from 'react-router-dom';

const ExcessStockView = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [excessData, setExcessData] = useState(null);

  useEffect(() => {
    setLoading(true);
    inventoryIntelligenceService.getExcessStock()
      .then(res => {
        if (res.success) setExcessData(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const items = excessData?.items || [];
  const totalExcessKg = excessData?.totalExcessKG || 0;
  const totalExcessValue = excessData?.totalExcessValueLocked || 0;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
          Excess Stock & Over-Stocking Analysis
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Items where current physical stock exceeds optimal maximum storage limits (&gt; 2.2x Reorder Level), trapping excess working capital.
        </Typography>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card variant="outlined" sx={{ bgcolor: '#f5f3ff', borderColor: '#ddd6fe' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: '#6d28d9', fontWeight: 'bold' }}>EXCESS ITEMS</Typography>
                <TrendingUpIcon sx={{ color: '#7c3aed' }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#5b21b6', my: 0.5 }}>
                {items.length}
              </Typography>
              <Typography variant="caption" color="text.secondary">Exceeding capacity caps</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card variant="outlined" sx={{ bgcolor: '#fff7ed', borderColor: '#fed7aa' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: '#c2410c', fontWeight: 'bold' }}>EXCESS WEIGHT</Typography>
                <InventoryIcon sx={{ color: '#ea580c' }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#9a3412', my: 0.5 }}>
                {(totalExcessKg / 1000).toFixed(2)} MT
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {totalExcessKg.toLocaleString()} KG in surplus storage
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card variant="outlined" sx={{ bgcolor: '#f0fdf4', borderColor: '#bbf7d0' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: '#166534', fontWeight: 'bold' }}>SURPLUS CAPITAL TRAPPED</Typography>
                <AttachMoneyIcon sx={{ color: '#16a34a' }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#15803d', my: 0.5 }}>
                ₹{totalExcessValue.toLocaleString('en-IN')}
              </Typography>
              <Typography variant="caption" color="text.secondary">Working capital overcommitted</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Excess Table */}
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6, flexDirection: 'column', alignItems: 'center' }}>
            <CircularProgress size={32} />
            <Typography variant="body2" sx={{ mt: 1, color: '#64748b' }}>Comparing warehouse levels with reorder baselines...</Typography>
          </Box>
        ) : items.length === 0 ? (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <Typography variant="h6" sx={{ color: '#166534', fontWeight: 'bold', mb: 1 }}>
              Optimal Stock Levels!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              No items currently exceed safety capacity limits.
            </Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '12px' }}>ITEM NAME</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '12px' }}>GROUP</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '12px' }} align="right">CURRENT STOCK (KG)</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '12px' }} align="right">MAX LEVEL (KG)</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '12px' }} align="right">EXCESS WEIGHT (KG)</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '12px' }} align="right">SURPLUS CAPITAL (₹)</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '12px' }}>RECOMMENDATION</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((it, idx) => (
                <TableRow key={`${it.itemCode || it.itemName}-${idx}`} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{it.itemName}</Typography>
                    <Typography variant="caption" color="text.secondary">{it.itemCode}</Typography>
                  </TableCell>

                  <TableCell>{it.itemGroup}</TableCell>

                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>{it.currentStockKG.toLocaleString()}</TableCell>
                  <TableCell align="right">{it.maxStockLevel.toLocaleString()}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: '#7c3aed' }}>
                    +{it.excessWeightKG.toLocaleString()}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: '#16a34a' }}>
                    ₹{it.excessValueLocked.toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ color: '#475569' }}>
                      {it.recommendation}
                    </Typography>
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

export default ExcessStockView;
