import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  TextField,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  Snackbar
} from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import FactoryIcon from '@mui/icons-material/Factory';
import AssessmentIcon from '@mui/icons-material/Assessment';

import procurementPlanningService from '../../services/procurementPlanningService';
import ProcurementItemDetailModal from './ProcurementItemDetailModal';

const ProcurementPlanningDashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialItem = searchParams.get('item') || '';

  const [horizon, setHorizon] = useState('30d');
  const [searchQuery, setSearchQuery] = useState(initialItem);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'shortage', 'reorder', 'surplus'

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);

  // Modals state
  const [selectedItemForDetail, setSelectedItemForDetail] = useState(null);
  const [suggestionsModalOpen, setSuggestionsModalOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedSuggestionKeys, setSelectedSuggestionKeys] = useState({});
  const [isSubmittingPR, setIsSubmittingPR] = useState(false);

  // Snackbar Notification
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, itemsRes] = await Promise.all([
        procurementPlanningService.getSummary(horizon),
        procurementPlanningService.getItems(horizon, searchQuery, activeFilter)
      ]);

      if (sumRes.success) setSummary(sumRes.data);
      if (itemsRes.success) setItems(itemsRes.data);
    } catch (err) {
      console.error('Error fetching procurement planning data:', err);
      setError(err.message || 'Failed to load procurement planning data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [horizon, activeFilter]);

  // Handle Search Input with Enter / debounce
  const handleSearchSubmit = (e) => {
    if (e.key === 'Enter') {
      fetchData();
    }
  };

  // Open Suggestions Review Modal
  const handleOpenSuggestions = async () => {
    try {
      setLoading(true);
      const res = await procurementPlanningService.getSuggestions(horizon);
      if (res.success && res.data) {
        setSuggestions(res.data);
        const sel = {};
        res.data.forEach(s => {
          sel[s.itemName] = true;
        });
        setSelectedSuggestionKeys(sel);
        setSuggestionsModalOpen(true);
      }
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to generate suggestions: ' + err.message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Toggle suggestion selection
  const handleToggleSelectSuggestion = (itemName) => {
    setSelectedSuggestionKeys(prev => ({
      ...prev,
      [itemName]: !prev[itemName]
    }));
  };

  // Confirm and Create Purchase Request
  const handleCreatePRFromSuggestions = async (customItems = null) => {
    const itemsToCreate = customItems || suggestions.filter(s => selectedSuggestionKeys[s.itemName]);
    if (!itemsToCreate.length) {
      setSnackbar({ open: true, message: 'Please select at least one item to create Purchase Request.', severity: 'warning' });
      return;
    }

    setIsSubmittingPR(true);
    try {
      const res = await procurementPlanningService.createPR(
        itemsToCreate,
        `Auto-created via Intelligent Procurement Planning (${horizon.toUpperCase()} Horizon)`
      );

      if (res.success) {
        setSuggestionsModalOpen(false);
        setSnackbar({
          open: true,
          message: `${res.data.message || 'Purchase Request created successfully!'}`,
          severity: 'success'
        });
        // Refresh items table
        fetchData();
      }
    } catch (err) {
      console.error('Error creating PR:', err);
      setSnackbar({ open: true, message: 'Error creating Purchase Request: ' + err.message, severity: 'error' });
    } finally {
      setIsSubmittingPR(false);
    }
  };

  const getStatusChip = (status) => {
    switch (status) {
      case 'SHORTAGE':
        return <Chip label="Shortage Alert" size="small" sx={{ bgcolor: '#fee2e2', color: '#991b1b', fontWeight: 'bold' }} />;
      case 'REORDER':
        return <Chip label="Reorder Level" size="small" sx={{ bgcolor: '#ffedd5', color: '#9a3412', fontWeight: 'bold' }} />;
      case 'SURPLUS':
        return <Chip label="Excess Surplus" size="small" sx={{ bgcolor: '#e0e7ff', color: '#3730a3', fontWeight: 'bold' }} />;
      case 'HEALTHY':
      default:
        return <Chip label="Healthy" size="small" sx={{ bgcolor: '#dcfce7', color: '#166534', fontWeight: 'bold' }} />;
    }
  };

  return (
    <Box sx={{ pb: 6 }}>
      {/* Header & Controls */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, mb: 3, gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
              Intelligent Procurement Planning
            </Typography>
            <Chip label="Live Engine" size="small" color="primary" variant="outlined" />
          </Box>
          <Typography variant="body2" color="text.secondary">
            Projected stock equation: <strong>Supply (Physical + Open PO) - Demand (Work Orders + Sales) = Projected Available</strong>
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          {/* Planning Horizon Selector */}
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="horizon-select-label">Planning Period</InputLabel>
            <Select
              labelId="horizon-select-label"
              value={horizon}
              label="Planning Period"
              onChange={(e) => setHorizon(e.target.value)}
            >
              <MenuItem value="7d">Next 7 Days</MenuItem>
              <MenuItem value="30d">This Month (30 Days)</MenuItem>
              <MenuItem value="60d">Next 60 Days</MenuItem>
              <MenuItem value="90d">Next 90 Days</MenuItem>
              <MenuItem value="all">All Requirements</MenuItem>
            </Select>
          </FormControl>

          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchData}
            size="medium"
            sx={{ textTransform: 'none' }}
          >
            Refresh
          </Button>

          <Button
            variant="contained"
            color="primary"
            startIcon={<ShoppingCartIcon />}
            onClick={handleOpenSuggestions}
            size="medium"
            sx={{ textTransform: 'none', fontWeight: 'bold' }}
          >
            Generate Purchase Suggestions
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* KPI Metric Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card 
            variant="outlined" 
            sx={{ 
              cursor: 'pointer', 
              borderColor: activeFilter === 'reorder' ? '#0284c7' : '#e2e8f0',
              bgcolor: activeFilter === 'reorder' ? '#f0f9ff' : '#ffffff',
              transition: 'all 0.2s',
              '&:hover': { borderColor: '#0284c7', boxShadow: 1 }
            }}
            onClick={() => setActiveFilter(activeFilter === 'reorder' ? 'all' : 'reorder')}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#64748b' }}>
                  ITEMS REQUIRING PURCHASE
                </Typography>
                <WarningAmberIcon sx={{ color: '#ea580c', fontSize: 20 }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#0f172a', my: 0.5 }}>
                {summary ? summary.itemsRequiringPurchase : 0}
              </Typography>
              <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 'medium' }}>
                Total: {summary ? summary.totalRecommendedQtyMT : 0} MT Recommended
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card 
            variant="outlined" 
            sx={{ 
              cursor: 'pointer', 
              borderColor: activeFilter === 'shortage' ? '#dc2626' : '#e2e8f0',
              bgcolor: activeFilter === 'shortage' ? '#fff1f2' : '#ffffff',
              transition: 'all 0.2s',
              '&:hover': { borderColor: '#dc2626', boxShadow: 1 }
            }}
            onClick={() => setActiveFilter(activeFilter === 'shortage' ? 'all' : 'shortage')}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#64748b' }}>
                  PROJECTED SHORTAGE
                </Typography>
                <TrendingDownIcon sx={{ color: '#dc2626', fontSize: 20 }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#b91c1c', my: 0.5 }}>
                {summary ? summary.projectedShortageItems : 0}
              </Typography>
              <Typography variant="caption" sx={{ color: '#991b1b', fontWeight: 'medium' }}>
                Demand &gt; Supply in {horizon}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined" sx={{ borderColor: '#e2e8f0', bgcolor: '#ffffff' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#64748b' }}>
                  OPEN PURCHASE ORDERS
                </Typography>
                <LocalShippingIcon sx={{ color: '#0284c7', fontSize: 20 }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#0284c7', my: 0.5 }}>
                {summary ? summary.openPOItems : 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Active incoming pipelines
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card 
            variant="outlined" 
            sx={{ 
              cursor: 'pointer', 
              borderColor: activeFilter === 'surplus' ? '#4f46e5' : '#e2e8f0',
              bgcolor: activeFilter === 'surplus' ? '#f5f3ff' : '#ffffff',
              transition: 'all 0.2s',
              '&:hover': { borderColor: '#4f46e5', boxShadow: 1 }
            }}
            onClick={() => setActiveFilter(activeFilter === 'surplus' ? 'all' : 'surplus')}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#64748b' }}>
                  EXCESS STOCK
                </Typography>
                <CheckCircleOutlineIcon sx={{ color: '#4f46e5', fontSize: 20 }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#4338ca', my: 0.5 }}>
                {summary ? summary.excessStockItems : 0}
              </Typography>
              <Typography variant="caption" sx={{ color: '#4338ca', fontWeight: 'medium' }}>
                Available &gt; 2.5x Reorder
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filter Chips & Search Bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label="All Tracked Items"
            clickable
            color={activeFilter === 'all' ? 'primary' : 'default'}
            variant={activeFilter === 'all' ? 'filled' : 'outlined'}
            onClick={() => setActiveFilter('all')}
          />
          <Chip
            label="Shortages Only"
            clickable
            color={activeFilter === 'shortage' ? 'error' : 'default'}
            variant={activeFilter === 'shortage' ? 'filled' : 'outlined'}
            onClick={() => setActiveFilter('shortage')}
          />
          <Chip
            label="Reorder Needed"
            clickable
            color={activeFilter === 'reorder' ? 'warning' : 'default'}
            variant={activeFilter === 'reorder' ? 'filled' : 'outlined'}
            onClick={() => setActiveFilter('reorder')}
          />
          <Chip
            label="Surplus Stock"
            clickable
            color={activeFilter === 'surplus' ? 'secondary' : 'default'}
            variant={activeFilter === 'surplus' ? 'filled' : 'outlined'}
            onClick={() => setActiveFilter('surplus')}
          />
        </Box>

        <TextField
          size="small"
          placeholder="Search item code, name, category..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearchSubmit}
          sx={{ width: { xs: '100%', sm: 300 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: '#64748b' }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Main Planning Matrix Table */}
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: '#f8fafc' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', fontSize: '12px', color: '#475569' }}>ITEM / MATERIAL</TableCell>
              <TableCell sx={{ fontWeight: 'bold', fontSize: '12px', color: '#475569' }} align="right">CURRENT STOCK</TableCell>
              <TableCell sx={{ fontWeight: 'bold', fontSize: '12px', color: '#475569' }} align="right">OPEN PO (EXP)</TableCell>
              <TableCell sx={{ fontWeight: 'bold', fontSize: '12px', color: '#475569' }} align="right">TOTAL SUPPLY</TableCell>
              <TableCell sx={{ fontWeight: 'bold', fontSize: '12px', color: '#475569' }} align="right">TOTAL DEMAND</TableCell>
              <TableCell sx={{ fontWeight: 'bold', fontSize: '12px', color: '#475569' }} align="right">PROJECTED AVAILABLE</TableCell>
              <TableCell sx={{ fontWeight: 'bold', fontSize: '12px', color: '#475569' }} align="center">STATUS</TableCell>
              <TableCell sx={{ fontWeight: 'bold', fontSize: '12px', color: '#475569' }} align="right">RECOMMENDED PURCHASE</TableCell>
              <TableCell sx={{ fontWeight: 'bold', fontSize: '12px', color: '#475569' }} align="center">ACTIONS</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={32} />
                  <Typography variant="body2" sx={{ mt: 1, color: '#64748b' }}>Calculating projected stock and requirements...</Typography>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                  <Typography variant="body1" sx={{ fontWeight: 'medium', color: '#64748b' }}>
                    No items matching the selected filters.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              items.map((it, idx) => (
                <TableRow 
                  key={it.itemCode ? `${it.itemCode}-${idx}` : `${it.itemName}-${idx}`}
                  hover
                  sx={{ 
                    bgcolor: it.status === 'SHORTAGE' ? '#fffafb' : 'inherit',
                    '&:last-child td, &:last-child th': { border: 0 }
                  }}
                >
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                      {it.itemName}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                      {it.itemCode} • {it.itemGroup}
                    </Typography>
                  </TableCell>

                  <TableCell align="right" sx={{ fontWeight: 'medium' }}>
                    {it.supply.currentStock.toLocaleString()} {it.unit}
                  </TableCell>

                  <TableCell align="right" sx={{ color: it.supply.openPO > 0 ? '#0284c7' : '#94a3b8' }}>
                    {it.supply.openPO > 0 ? `+${it.supply.openPO.toLocaleString()} ${it.unit}` : '-'}
                  </TableCell>

                  <TableCell align="right" sx={{ fontWeight: 'bold', color: '#0369a1' }}>
                    {it.supply.totalSupply.toLocaleString()} {it.unit}
                  </TableCell>

                  <TableCell align="right" sx={{ fontWeight: 'bold', color: it.demand.totalDemand > 0 ? '#b91c1c' : '#64748b' }}>
                    {it.demand.totalDemand > 0 ? `${it.demand.totalDemand.toLocaleString()} ${it.unit}` : '0'}
                  </TableCell>

                  <TableCell align="right" sx={{ fontWeight: 'bold', color: it.projectedAvailable < 0 ? '#dc2626' : '#16a34a' }}>
                    {it.projectedAvailable.toLocaleString()} {it.unit}
                  </TableCell>

                  <TableCell align="center">
                    {getStatusChip(it.status)}
                  </TableCell>

                  <TableCell align="right">
                    {it.recommendedPurchase > 0 ? (
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#b91c1c' }}>
                          {it.recommendedPurchase.toLocaleString()} {it.unit}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                          Est. ₹{it.estimatedAmount.toLocaleString('en-IN')}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="caption" sx={{ color: '#94a3b8' }}>No purchase needed</Typography>
                    )}
                  </TableCell>

                  <TableCell align="center">
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                      <Tooltip title="Why is this item showing this calculation? Click for transparent breakdown">
                        <IconButton
                          size="small"
                          color="info"
                          onClick={() => setSelectedItemForDetail(it)}
                          sx={{ bgcolor: '#f0f9ff', '&:hover': { bgcolor: '#e0f2fe' } }}
                        >
                          <HelpOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>

                      {it.recommendedPurchase > 0 && (
                        <Tooltip title="Create Purchase Request">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleCreatePRFromSuggestions([it])}
                            sx={{ bgcolor: '#eff6ff', '&:hover': { bgcolor: '#dbeafe' } }}
                          >
                            <ShoppingCartIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Item Detail / Equation Breakdown Modal */}
      <ProcurementItemDetailModal
        open={Boolean(selectedItemForDetail)}
        onClose={() => setSelectedItemForDetail(null)}
        item={selectedItemForDetail}
        onCreatePR={handleCreatePRFromSuggestions}
      />

      {/* Purchase Suggestions Review Modal */}
      <Dialog 
        open={suggestionsModalOpen} 
        onClose={() => !isSubmittingPR && setSuggestionsModalOpen(false)} 
        maxWidth="lg" 
        fullWidth
      >
        <DialogTitle component="div" sx={{ borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#0f172a' }}>
              Management Review: Recommended Purchase Suggestions
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              Review and select calculated items before issuing to the Purchase Request workflow.
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          {suggestions.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <CheckCircleOutlineIcon sx={{ fontSize: 48, color: '#16a34a', mb: 1 }} />
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>All Stock Healthy!</Typography>
              <Typography variant="body2" color="text.secondary">No items require procurement for the selected period.</Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ my: 1 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={
                          Object.values(selectedSuggestionKeys).some(Boolean) &&
                          !Object.values(selectedSuggestionKeys).every(Boolean)
                        }
                        checked={suggestions.length > 0 && Object.values(selectedSuggestionKeys).every(Boolean)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          const nextSel = {};
                          suggestions.forEach(s => { nextSel[s.itemName] = checked; });
                          setSelectedSuggestionKeys(nextSel);
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Item Name</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }} align="right">Current Stock</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }} align="right">Total Demand</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }} align="right">Projected Balance</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }} align="right">Recommended Purchase</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Suggested Supplier</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }} align="right">Est. Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {suggestions.map((s, idx) => {
                    const isChecked = Boolean(selectedSuggestionKeys[s.itemName]);
                    return (
                      <TableRow key={s.itemCode ? `${s.itemCode}-${idx}` : `${s.itemName}-${idx}`} hover selected={isChecked}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={isChecked}
                            onChange={() => handleToggleSelectSuggestion(s.itemName)}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{s.itemName}</Typography>
                          <Typography variant="caption" color="text.secondary">{s.reason}</Typography>
                        </TableCell>
                        <TableCell align="right">{s.currentStock.toLocaleString()} {s.unit}</TableCell>
                        <TableCell align="right">{s.totalDemand.toLocaleString()} {s.unit}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: s.projectedAvailable < 0 ? '#dc2626' : '#ea580c' }}>
                          {s.projectedAvailable.toLocaleString()} {s.unit}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#b91c1c' }}>
                          {s.recommendedPurchase.toLocaleString()} {s.unit}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{s.suggestedSupplier}</Typography>
                          <Typography variant="caption" color="text.secondary">₹{s.estimatedRate}/{s.unit}</Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                          ₹{s.estimatedAmount.toLocaleString('en-IN')}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0', justifyContent: 'space-between' }}>
          <Button onClick={() => setSuggestionsModalOpen(false)} disabled={isSubmittingPR}>
            Cancel
          </Button>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              Selected: {Object.values(selectedSuggestionKeys).filter(Boolean).length} of {suggestions.length} items
            </Typography>
            <Button
              variant="contained"
              color="primary"
              disabled={isSubmittingPR || !Object.values(selectedSuggestionKeys).some(Boolean)}
              onClick={() => handleCreatePRFromSuggestions()}
              startIcon={isSubmittingPR ? <CircularProgress size={16} color="inherit" /> : <ShoppingCartIcon />}
              sx={{ textTransform: 'none', fontWeight: 'bold' }}
            >
              {isSubmittingPR ? 'Creating PR...' : 'Create Purchase Request (Draft)'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Action Notification */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity} 
          variant="filled"
          action={
            snackbar.severity === 'success' ? (
              <Button color="inherit" size="small" onClick={() => navigate('/entry/purchase-request-display')}>
                View PRs
              </Button>
            ) : null
          }
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ProcurementPlanningDashboard;
