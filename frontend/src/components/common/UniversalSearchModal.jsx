import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  InputBase,
  IconButton,
  Chip,
  CircularProgress,
  Stack,
  Button,
  Divider,
  Paper,
  Tooltip,
  Card,
  CardContent,
  Badge,
  Grid
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import NavigationIcon from '@mui/icons-material/Navigation';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import BusinessIcon from '@mui/icons-material/Business';
import ReceiptIcon from '@mui/icons-material/Receipt';
import VerifiedIcon from '@mui/icons-material/Verified';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import DescriptionIcon from '@mui/icons-material/Description';
import KeyboardReturnIcon from '@mui/icons-material/KeyboardReturn';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import AssignmentReturnIcon from '@mui/icons-material/AssignmentReturn';
import ShoppingCartCheckoutIcon from '@mui/icons-material/ShoppingCartCheckout';
import TuneIcon from '@mui/icons-material/Tune';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import HistoryIcon from '@mui/icons-material/History';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import { useAuth, PERMISSION_TYPES } from '../../context/AuthContext';

const CATEGORIES = [
  { id: 'all', label: 'All', icon: <SearchIcon fontSize="small" /> },
  { id: 'actions', label: 'Actions', icon: <FlashOnIcon fontSize="small" /> },
  { id: 'modules', label: 'Modules', icon: <NavigationIcon fontSize="small" /> },
  { id: 'items', label: 'Items', icon: <Inventory2Icon fontSize="small" /> },
  { id: 'parties', label: 'Parties', icon: <BusinessIcon fontSize="small" /> },
  { id: 'transactions', label: 'Transactions', icon: <ReceiptIcon fontSize="small" /> },
  { id: 'quality', label: 'Quality & IQR', icon: <VerifiedIcon fontSize="small" /> },
  { id: 'stock', label: 'Lots & Stock', icon: <QrCode2Icon fontSize="small" /> },
  { id: 'documents', label: 'Documents', icon: <DescriptionIcon fontSize="small" /> }
];

const DEFAULT_RECENT_SEARCHES = ['Rice', 'Urad Gotta', 'LOT0003', 'INV-', 'Purchase Return', 'PJ Godown', 'QC Inspection'];

const UniversalSearchModal = ({ open, onClose }) => {
  const navigate = useNavigate();
  const { isAdmin, hasPermission, selectedCompany, financialYear } = useAuth();

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({
    modules: [],
    actions: [],
    masters: [],
    transactions: [],
    quality: [],
    stock: [],
    documents: []
  });
  const [totalResults, setTotalResults] = useState(0);
  const [selectedChainItem, setSelectedChainItem] = useState(null);
  const [chainData, setChainData] = useState(null);
  const [chainLoading, setChainLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const stored = localStorage.getItem('bvc_erp_recent_searches');
      return stored ? JSON.parse(stored) : DEFAULT_RECENT_SEARCHES;
    } catch (e) {
      return DEFAULT_RECENT_SEARCHES;
    }
  });

  const inputRef = useRef(null);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 100);
      setSelectedChainItem(null);
      setChainData(null);
    } else {
      setQuery('');
      setSelectedCategory('all');
    }
  }, [open]);

  // Debounced search API call
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();

    if (!trimmed) {
      setLoading(false);
      setResults({
        modules: [],
        actions: [],
        masters: [],
        transactions: [],
        quality: [],
        stock: [],
        documents: []
      });
      setTotalResults(0);
      return;
    }

    setLoading(true);
    const debounceTimer = setTimeout(async () => {
      try {
        const companyId = selectedCompany?.id || 1;
        const resp = await axios.get(`/api/search`, {
          params: {
            q: trimmed,
            category: selectedCategory,
            limit: 10,
            company_id: companyId
          },
          headers: {
            'x-company-id': companyId
          }
        });

        if (resp.data && resp.data.success) {
          setResults(resp.data.results || {});
          setTotalResults(resp.data.total || 0);
        }
      } catch (err) {
        console.error('Error in Universal Search query:', err);
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => clearTimeout(debounceTimer);
  }, [query, selectedCategory, open, selectedCompany]);

  // Save to recent searches
  const saveRecentSearch = (searchTerm) => {
    if (!searchTerm || !searchTerm.trim()) return;
    const clean = searchTerm.trim();
    const updated = [clean, ...recentSearches.filter((s) => s.toLowerCase() !== clean.toLowerCase())].slice(0, 8);
    setRecentSearches(updated);
    try {
      localStorage.setItem('bvc_erp_recent_searches', JSON.stringify(updated));
    } catch (e) {}
  };

  // Navigate & Close handler
  const handleNavigate = (path, searchKeyword = null) => {
    if (searchKeyword) saveRecentSearch(searchKeyword);
    else if (query) saveRecentSearch(query);
    onClose();
    if (path) {
      navigate(path);
    }
  };

  // Fetch Relationship Chain for a transaction / lot / IQR
  const handleViewRelationshipChain = async (item) => {
    setSelectedChainItem(item);
    setChainLoading(true);
    try {
      const companyId = selectedCompany?.id || 1;
      const params = {};
      if (item.type === 'Purchase') params.type = 'purchase', params.id = item.id;
      else if (item.type === 'Purchase Order') params.po_no = item.docNo;
      else if (item.type === 'Stock Lot') params.lot_no = item.lotNo;
      else if (item.lotNo) params.lot_no = item.lotNo;
      else if (item.docNo) params.inv_no = item.docNo;

      const resp = await axios.get('/api/search/related', {
        params,
        headers: { 'x-company-id': companyId }
      });
      if (resp.data && resp.data.success) {
        setChainData(resp.data.chain);
      }
    } catch (err) {
      console.error('Error fetching relationship chain:', err);
    } finally {
      setChainLoading(false);
    }
  };

  // Permission-filtered lists
  const filteredModules = useMemo(() => {
    return (results.modules || []).filter((m) => {
      if (isAdmin) return true;
      if (!m.permission) return true;
      return hasPermission(m.permission, PERMISSION_TYPES.VIEW) || hasPermission(m.permission, PERMISSION_TYPES.CREATE);
    });
  }, [results.modules, isAdmin, hasPermission]);

  const filteredActions = useMemo(() => {
    return (results.actions || []).filter((a) => {
      if (isAdmin) return true;
      if (!a.permission) return true;
      return hasPermission(a.permission, PERMISSION_TYPES.CREATE);
    });
  }, [results.actions, isAdmin, hasPermission]);

  // Filtered Masters (split into items vs parties)
  const masterItems = useMemo(() => {
    return (results.masters || []).filter((m) => m.type === 'Item');
  }, [results.masters]);

  const masterParties = useMemo(() => {
    return (results.masters || []).filter((m) => m.type === 'Supplier' || m.type === 'Customer' || m.type === 'Godown');
  }, [results.masters]);

  const hasAnyResults = totalResults > 0 || filteredModules.length > 0 || filteredActions.length > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
          overflow: 'hidden',
          bgcolor: '#ffffff',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
      BackdropProps={{
        sx: {
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(5px)'
        }
      }}
    >
      {/* Search Header Bar */}
      <Box
        sx={{
          p: 2,
          pb: 1.5,
          borderBottom: '1px solid #e2e8f0',
          bgcolor: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ color: '#2563eb', display: 'flex', alignItems: 'center' }}>
            <SearchIcon sx={{ fontSize: 26 }} />
          </Box>
          <InputBase
            inputRef={inputRef}
            fullWidth
            placeholder="Search BVC ERP... (e.g. Rice, LOT0003, INV-2026, ABC Traders, Purchase Return, QC)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                if (selectedChainItem) setSelectedChainItem(null);
                else onClose();
              }
            }}
            sx={{
              fontSize: '16px',
              fontWeight: 600,
              color: '#0f172a',
              '& input::placeholder': {
                color: '#94a3b8',
                fontWeight: 400
              }
            }}
          />
          {loading && <CircularProgress size={20} sx={{ color: '#2563eb' }} />}
          {query && (
            <IconButton size="small" onClick={() => setQuery('')} sx={{ color: '#64748b' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
          <Chip
            label="ESC"
            size="small"
            onClick={onClose}
            sx={{
              bgcolor: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#64748b',
              fontWeight: 700,
              fontSize: '10px',
              height: '22px',
              cursor: 'pointer'
            }}
          />
        </Box>

        {/* Category Pills Filter */}
        <Box sx={{ display: 'flex', gap: 0.8, overflowX: 'auto', py: 0.5, '::-webkit-scrollbar': { display: 'none' } }}>
          {CATEGORIES.map((cat) => (
            <Chip
              key={cat.id}
              icon={cat.icon}
              label={cat.label}
              size="small"
              clickable
              onClick={() => setSelectedCategory(cat.id)}
              sx={{
                fontWeight: 600,
                fontSize: '12px',
                px: 0.5,
                bgcolor: selectedCategory === cat.id ? '#2563eb' : '#ffffff',
                color: selectedCategory === cat.id ? '#ffffff' : '#475569',
                border: selectedCategory === cat.id ? '1px solid #2563eb' : '1px solid #e2e8f0',
                '&:hover': {
                  bgcolor: selectedCategory === cat.id ? '#1d4ed8' : '#f1f5f9'
                },
                '& .MuiChip-icon': {
                  color: selectedCategory === cat.id ? '#ffffff' : '#64748b'
                }
              }}
            />
          ))}
        </Box>
      </Box>

      {/* Main Content Area */}
      <DialogContent sx={{ p: 0, overflowY: 'auto', bgcolor: '#ffffff' }}>
        {/* Relationship Intelligence Chain View (Drill-Down Mode) */}
        {selectedChainItem && (
          <Box sx={{ p: 2.5, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
              <Box display="flex" alignItems="center" gap={1}>
                <AccountTreeIcon sx={{ color: '#2563eb' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                  Document Workflow & Relationship Chain: <span style={{ color: '#2563eb' }}>{selectedChainItem.docNo || selectedChainItem.lotNo || selectedChainItem.title}</span>
                </Typography>
              </Box>
              <Button size="small" variant="outlined" onClick={() => setSelectedChainItem(null)} sx={{ borderRadius: '8px', textTransform: 'none' }}>
                Back to Search Results
              </Button>
            </Box>

            {chainLoading ? (
              <Box py={4} textAlign="center">
                <CircularProgress size={30} />
                <Typography variant="body2" sx={{ mt: 1, color: '#64748b' }}>Tracing linked documents & workflow...</Typography>
              </Box>
            ) : chainData ? (
              <Stack spacing={2}>
                {/* Workflow Chain Visual Roadmap */}
                <Grid container spacing={1.5}>
                  {/* Purchase */}
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ bgcolor: chainData.purchase ? '#ffffff' : '#f1f5f9', borderColor: chainData.purchase ? '#2563eb' : '#e2e8f0' }}>
                      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>1. Purchase Inward</Typography>
                        {chainData.purchase ? (
                          <>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>{chainData.purchase.inv_no || `PUR-${chainData.purchase.s_no}`}</Typography>
                            <Typography variant="caption" sx={{ color: '#475569', display: 'block' }}>Date: {chainData.purchase.date} | ₹{parseFloat(chainData.purchase.grand_total || chainData.purchase.total_amount || 0).toLocaleString('en-IN')}</Typography>
                            <Typography variant="caption" sx={{ color: '#2563eb', fontWeight: 600 }}>Supplier: {chainData.purchase.supplier}</Typography>
                          </>
                        ) : (
                          <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block' }}>No direct purchase linked</Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* QC Inspection */}
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ bgcolor: chainData.qcInspection ? (chainData.qcInspection.overall_result === 'REJECTED' ? '#fef2f2' : '#f0fdf4') : '#f1f5f9' }}>
                      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>2. QC Inspection</Typography>
                        {chainData.qcInspection ? (
                          <>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>{chainData.qcInspection.qc_no || `QC-${chainData.qcInspection.id}`}</Typography>
                            <Chip
                              label={chainData.qcInspection.overall_result || 'PASSED'}
                              size="small"
                              color={chainData.qcInspection.overall_result === 'REJECTED' ? 'error' : 'success'}
                              sx={{ height: 20, fontSize: '10px', fontWeight: 800, mt: 0.5 }}
                            />
                            <Typography variant="caption" sx={{ color: '#475569', display: 'block', mt: 0.5 }}>Lot: {chainData.qcInspection.rm_lot_no || '—'}</Typography>
                          </>
                        ) : (
                          <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block' }}>Pending QC Inspection</Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* IQR Report */}
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ bgcolor: chainData.iqrReport ? '#ffffff' : '#f1f5f9' }}>
                      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>3. Incoming Quality (IQR)</Typography>
                        {chainData.iqrReport ? (
                          <>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>{chainData.iqrReport.iqr_no || `IQR-${chainData.iqrReport.id}`}</Typography>
                            <Typography variant="caption" sx={{ color: '#16a34a', fontWeight: 600, display: 'block' }}>Verified & Logged</Typography>
                            <Typography variant="caption" sx={{ color: '#475569', display: 'block' }}>Date: {chainData.iqrReport.uploaded_date}</Typography>
                          </>
                        ) : (
                          <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block' }}>No IQR document filed</Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Purchase Return */}
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ bgcolor: chainData.purchaseReturn ? '#fee2e2' : '#f1f5f9', borderColor: chainData.purchaseReturn ? '#ef4444' : '#e2e8f0' }}>
                      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>4. Purchase Return</Typography>
                        {chainData.purchaseReturn ? (
                          <>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#b91c1c' }}>{chainData.purchaseReturn.return_inv_no || `PR-${chainData.purchaseReturn.s_no}`}</Typography>
                            <Typography variant="caption" sx={{ color: '#991b1b', fontWeight: 600, display: 'block' }}>Debit Note: ₹{parseFloat(chainData.purchaseReturn.grand_total || chainData.purchaseReturn.total_amount || 0).toLocaleString('en-IN')}</Typography>
                            <Typography variant="caption" sx={{ color: '#475569', display: 'block' }}>Reason: {chainData.purchaseReturn.reason || 'Vendor Return'}</Typography>
                          </>
                        ) : (
                          <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block' }}>Not Returned (In Factory Stock)</Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                {/* Suggested Action Bar */}
                {chainData.suggestedActions && chainData.suggestedActions.length > 0 && (
                  <Box sx={{ p: 1.5, bgcolor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', display: 'block', mb: 1 }}>
                      ⚡ Recommended Next Actions:
                    </Typography>
                    <Stack direction="row" spacing={1.5} flexWrap="wrap">
                      {chainData.suggestedActions.map((act, i) => (
                        <Button
                          key={i}
                          variant="contained"
                          color={act.type === 'error' ? 'error' : act.type === 'success' ? 'success' : act.type === 'info' ? 'info' : 'primary'}
                          size="small"
                          onClick={() => handleNavigate(act.url)}
                          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '6px' }}
                        >
                          {act.label}
                        </Button>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            ) : null}
          </Box>
        )}

        {/* Empty Search Prompt / Recent Searches */}
        {!query.trim() && (
          <Box sx={{ p: 3 }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Frequently Used Navigation & Quick Actions
            </Typography>
            <Grid container spacing={1.5} sx={{ mt: 0.5, mb: 3 }}>
              {[
                { label: 'Purchase Inward', path: '/entry/purchase-create', icon: <AddShoppingCartIcon fontSize="small" />, color: '#2563eb', bg: '#eff6ff' },
                { label: 'Sales Tax Invoice', path: '/entry/sales-create', icon: <ReceiptIcon fontSize="small" />, color: '#16a34a', bg: '#f0fdf4' },
                { label: 'Quality Control (QC)', path: '/entry/quality-control-create', icon: <FactCheckIcon fontSize="small" />, color: '#7c3aed', bg: '#f5f3ff' },
                { label: 'Purchase Return', path: '/entry/purchase-return-create', icon: <AssignmentReturnIcon fontSize="small" />, color: '#dc2626', bg: '#fef2f2' },
                { label: 'Grain Milling (Grind)', path: '/entry/grind-create', icon: <PrecisionManufacturingIcon fontSize="small" />, color: '#d97706', bg: '#fffbe3' },
                { label: 'Stock Reports (Lots)', path: '/report/stock-report', icon: <QrCode2Icon fontSize="small" />, color: '#0284c7', bg: '#f0f9ff' },
                { label: 'Godown Stock Status', path: '/reports/godown-stock', icon: <WarehouseIcon fontSize="small" />, color: '#0891b2', bg: '#ecfeff' },
                { label: 'Lot Genealogy Engine', path: '/lot-genealogy', icon: <AccountTreeIcon fontSize="small" />, color: '#4f46e5', bg: '#eef2ff' }
              ].map((item, idx) => (
                <Grid item xs={6} sm={3} key={idx}>
                  <Paper
                    elevation={0}
                    onClick={() => handleNavigate(item.path, item.label)}
                    sx={{
                      p: 1.5,
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.2,
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        bgcolor: item.bg,
                        borderColor: item.color,
                        transform: 'translateY(-2px)'
                      }
                    }}
                  >
                    <Box sx={{ color: item.color, display: 'flex' }}>{item.icon}</Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e293b', fontSize: '13px' }}>
                      {item.label}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>

            {/* Recent Searches Section */}
            {recentSearches.length > 0 && (
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Recent Searches & Jump Keywords
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                  {recentSearches.map((s, idx) => (
                    <Chip
                      key={idx}
                      icon={<HistoryIcon fontSize="small" />}
                      label={s}
                      size="small"
                      clickable
                      onClick={() => setQuery(s)}
                      sx={{
                        fontWeight: 600,
                        fontSize: '12px',
                        bgcolor: '#f1f5f9',
                        color: '#334155',
                        border: '1px solid #cbd5e1'
                      }}
                    />
                  ))}
                </Stack>
              </Box>
            )}
          </Box>
        )}

        {/* Search Results List */}
        {query.trim() && !loading && (
          <Box sx={{ p: 2 }}>
            {!hasAnyResults ? (
              <Box py={6} textAlign="center">
                <SearchIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#475569' }}>
                  No results found for "{query}"
                </Typography>
                <Typography variant="body2" sx={{ color: '#94a3b8', mt: 0.5 }}>
                  Try searching by item name (e.g. Rice), supplier/customer, invoice/doc number (INV-), lot number (LOT0003), or module name.
                </Typography>
              </Box>
            ) : (
              <Stack spacing={2.5}>
                {/* 1. Quick Actions */}
                {filteredActions.length > 0 && (selectedCategory === 'all' || selectedCategory === 'actions') && (
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                      <FlashOnIcon fontSize="small" /> Quick Actions
                    </Typography>
                    <Grid container spacing={1}>
                      {filteredActions.map((act, i) => (
                        <Grid item xs={12} sm={6} key={i}>
                          <Paper
                            elevation={0}
                            onClick={() => handleNavigate(act.path, act.label)}
                            sx={{
                              p: 1.5,
                              borderRadius: '8px',
                              border: '1px solid #bfdbfe',
                              bgcolor: '#eff6ff',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              '&:hover': {
                                bgcolor: '#dbeafe',
                                borderColor: '#3b82f6'
                              }
                            }}
                          >
                            <Box display="flex" alignItems="center" gap={1}>
                              <FlashOnIcon sx={{ color: '#2563eb', fontSize: 18 }} />
                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e40af' }}>{act.label}</Typography>
                            </Box>
                            <ArrowForwardIcon sx={{ color: '#2563eb', fontSize: 16 }} />
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                )}

                {/* 2. Navigation Modules */}
                {filteredModules.length > 0 && (selectedCategory === 'all' || selectedCategory === 'modules') && (
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                      <NavigationIcon fontSize="small" /> ERP Modules & Reports ({filteredModules.length})
                    </Typography>
                    <Stack spacing={0.8}>
                      {filteredModules.map((m, i) => (
                        <Paper
                          key={i}
                          elevation={0}
                          onClick={() => handleNavigate(m.path, m.name)}
                          sx={{
                            p: 1.5,
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            '&:hover': {
                              bgcolor: '#f8fafc',
                              borderColor: '#2563eb'
                            }
                          }}
                        >
                          <Box display="flex" alignItems="center" gap={1.5}>
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#2563eb' }} />
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>{m.name}</Typography>
                              <Typography variant="caption" sx={{ color: '#64748b' }}>{m.category} ➔ {m.group}</Typography>
                            </Box>
                          </Box>
                          <Stack direction="row" spacing={1} alignItems="center">
                            {m.createPath && (isAdmin || hasPermission(m.permission, PERMISSION_TYPES.CREATE)) && (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleNavigate(m.createPath, `New ${m.name}`);
                                }}
                                sx={{ borderRadius: '6px', textTransform: 'none', py: 0.2, fontSize: '11px', fontWeight: 700 }}
                              >
                                + New
                              </Button>
                            )}
                            <Chip label="Open" size="small" sx={{ bgcolor: '#f1f5f9', fontWeight: 600, fontSize: '11px' }} />
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  </Box>
                )}

                {/* 3. Items Master */}
                {masterItems.length > 0 && (selectedCategory === 'all' || selectedCategory === 'items' || selectedCategory === 'masters') && (
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                      <Inventory2Icon fontSize="small" /> Items & Product Masters ({masterItems.length})
                    </Typography>
                    <Stack spacing={0.8}>
                      {masterItems.map((item, i) => (
                        <Paper
                          key={i}
                          elevation={0}
                          sx={{
                            p: 1.5,
                            borderRadius: '8px',
                            border: '1px solid #e0f2fe',
                            bgcolor: '#f0f9ff',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 1
                          }}
                        >
                          <Box display="flex" alignItems="center" gap={1.5}>
                            <Inventory2Icon sx={{ color: '#0284c7', fontSize: 22 }} />
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 800, color: '#0369a1' }}>{item.title}</Typography>
                              <Typography variant="caption" sx={{ color: '#475569', display: 'block' }}>{item.subtitle}</Typography>
                            </Box>
                          </Box>
                          <Stack direction="row" spacing={1}>
                            <Button
                              size="small"
                              variant="contained"
                              color="primary"
                              onClick={() => handleNavigate(item.actionUrl, item.title)}
                              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '6px', py: 0.3, fontSize: '11px' }}
                            >
                              {item.actionLabel}
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleNavigate(item.url, item.title)}
                              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '6px', py: 0.3, fontSize: '11px' }}
                            >
                              Edit Item
                            </Button>
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  </Box>
                )}

                {/* 4. Suppliers & Customers */}
                {masterParties.length > 0 && (selectedCategory === 'all' || selectedCategory === 'parties' || selectedCategory === 'masters') && (
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                      <BusinessIcon fontSize="small" /> Suppliers, Customers & Godowns ({masterParties.length})
                    </Typography>
                    <Stack spacing={0.8}>
                      {masterParties.map((party, i) => (
                        <Paper
                          key={i}
                          elevation={0}
                          sx={{
                            p: 1.5,
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 1,
                            '&:hover': { borderColor: '#94a3b8' }
                          }}
                        >
                          <Box display="flex" alignItems="center" gap={1.5}>
                            <BusinessIcon sx={{ color: party.type === 'Supplier' ? '#d97706' : '#2563eb', fontSize: 22 }} />
                            <Box>
                              <Box display="flex" alignItems="center" gap={1}>
                                <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a' }}>{party.title}</Typography>
                                <Chip label={party.type} size="small" sx={{ height: 18, fontSize: '10px', fontWeight: 800, bgcolor: party.type === 'Supplier' ? '#fef3c7' : '#dbeafe', color: party.type === 'Supplier' ? '#92400e' : '#1e40af' }} />
                              </Box>
                              <Typography variant="caption" sx={{ color: '#64748b' }}>{party.subtitle}</Typography>
                            </Box>
                          </Box>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleNavigate(party.actionUrl || party.url, party.title)}
                            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '6px', py: 0.3, fontSize: '11px' }}
                          >
                            {party.actionLabel || 'View Master'}
                          </Button>
                        </Paper>
                      ))}
                    </Stack>
                  </Box>
                )}

                {/* 5. Transactions (Purchases, Returns, Sales) */}
                {results.transactions?.length > 0 && (selectedCategory === 'all' || selectedCategory === 'transactions') && (
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                      <ReceiptIcon fontSize="small" /> Transactions & Invoices ({results.transactions.length})
                    </Typography>
                    <Stack spacing={0.8}>
                      {results.transactions.map((tx, i) => (
                        <Paper
                          key={i}
                          elevation={0}
                          sx={{
                            p: 1.5,
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 1,
                            transition: 'all 0.15s ease',
                            '&:hover': { bgcolor: '#f8fafc', borderColor: '#cbd5e1' }
                          }}
                        >
                          <Box display="flex" alignItems="center" gap={1.5}>
                            <ReceiptIcon sx={{ color: tx.type.includes('Return') ? '#dc2626' : tx.type.includes('Sale') ? '#16a34a' : '#2563eb', fontSize: 22 }} />
                            <Box>
                              <Box display="flex" alignItems="center" gap={1}>
                                <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>{tx.docNo}</Typography>
                                <Chip label={tx.type} size="small" sx={{ height: 18, fontSize: '10px', fontWeight: 800 }} />
                                {tx.status && <Chip label={tx.status} size="small" color={tx.statusColor} sx={{ height: 18, fontSize: '10px', fontWeight: 700 }} />}
                              </Box>
                              <Typography variant="caption" sx={{ color: '#475569', display: 'block' }}>
                                Party: <strong>{tx.party || '—'}</strong> | Date: {tx.date} {tx.amount > 0 && `| Amount: ₹${tx.amount.toLocaleString('en-IN')}`}
                              </Typography>
                              {tx.items && <Typography variant="caption" sx={{ color: '#64748b', fontStyle: 'italic' }}>{tx.items}</Typography>}
                            </Box>
                          </Box>

                          <Stack direction="row" spacing={1}>
                            <Button
                              size="small"
                              variant="outlined"
                              color="secondary"
                              startIcon={<AccountTreeIcon sx={{ fontSize: 14 }} />}
                              onClick={() => handleViewRelationshipChain(tx)}
                              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '6px', py: 0.2, fontSize: '11px' }}
                            >
                              Workflow Trace
                            </Button>
                            <Button
                              size="small"
                              variant="contained"
                              color="primary"
                              onClick={() => handleNavigate(tx.url, tx.docNo)}
                              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '6px', py: 0.2, fontSize: '11px' }}
                            >
                              Open Record
                            </Button>
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  </Box>
                )}

                {/* 6. Quality & Lab Testing */}
                {results.quality?.length > 0 && (selectedCategory === 'all' || selectedCategory === 'quality') && (
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                      <VerifiedIcon fontSize="small" /> Quality Inspections & IQR Records ({results.quality.length})
                    </Typography>
                    <Stack spacing={0.8}>
                      {results.quality.map((q, i) => (
                        <Paper
                          key={i}
                          elevation={0}
                          sx={{
                            p: 1.5,
                            borderRadius: '8px',
                            border: '1px solid #ede9fe',
                            bgcolor: q.result === 'REJECTED' ? '#fef2f2' : '#f5f3ff',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 1
                          }}
                        >
                          <Box display="flex" alignItems="center" gap={1.5}>
                            <VerifiedIcon sx={{ color: q.result === 'REJECTED' ? '#dc2626' : '#7c3aed', fontSize: 22 }} />
                            <Box>
                              <Box display="flex" alignItems="center" gap={1}>
                                <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>{q.docNo}</Typography>
                                <Chip label={q.result} size="small" color={q.statusColor} sx={{ height: 18, fontSize: '10px', fontWeight: 800 }} />
                              </Box>
                              <Typography variant="caption" sx={{ color: '#475569', display: 'block' }}>{q.subtitle}</Typography>
                            </Box>
                          </Box>

                          <Stack direction="row" spacing={1}>
                            {q.actionUrl && (
                              <Button
                                size="small"
                                variant="contained"
                                color="error"
                                onClick={() => handleNavigate(q.actionUrl, q.docNo)}
                                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '6px', py: 0.2, fontSize: '11px' }}
                              >
                                {q.actionLabel}
                              </Button>
                            )}
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleViewRelationshipChain(q)}
                              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '6px', py: 0.2, fontSize: '11px' }}
                            >
                              Workflow Chain
                            </Button>
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  </Box>
                )}

                {/* 7. Stock Lots */}
                {results.stock?.length > 0 && (selectedCategory === 'all' || selectedCategory === 'stock') && (
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                      <QrCode2Icon fontSize="small" /> Stock Lots & Cold Storage Vouchers ({results.stock.length})
                    </Typography>
                    <Stack spacing={0.8}>
                      {results.stock.map((stk, i) => (
                        <Paper
                          key={i}
                          elevation={0}
                          sx={{
                            p: 1.5,
                            borderRadius: '8px',
                            border: '1px solid #dcfce7',
                            bgcolor: '#f0fdf4',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 1
                          }}
                        >
                          <Box display="flex" alignItems="center" gap={1.5}>
                            <QrCode2Icon sx={{ color: '#059669', fontSize: 22 }} />
                            <Box>
                              <Box display="flex" alignItems="center" gap={1}>
                                <Typography variant="body2" sx={{ fontWeight: 800, color: '#065f46', fontFamily: 'monospace' }}>{stk.lotNo || stk.docNo}</Typography>
                                {stk.godown && <Chip label={`📍 ${stk.godown}`} size="small" sx={{ height: 18, fontSize: '10px', fontWeight: 700, bgcolor: '#ffffff' }} />}
                                {stk.qcStatus && <Chip label={stk.qcStatus} size="small" color={stk.qcStatus === 'REJECTED' ? 'error' : 'success'} sx={{ height: 18, fontSize: '10px', fontWeight: 700 }} />}
                              </Box>
                              <Typography variant="caption" sx={{ color: '#166534', fontWeight: 600, display: 'block' }}>
                                Item: {stk.itemName || stk.items} | Balance: {stk.balanceQty !== undefined ? `${stk.balanceQty} ${stk.unit || 'bags'}` : stk.status}
                              </Typography>
                            </Box>
                          </Box>

                          <Stack direction="row" spacing={1}>
                            <Button
                              size="small"
                              variant="outlined"
                              color="success"
                              onClick={() => handleNavigate(stk.traceUrl || `/lot-genealogy?lot=${stk.lotNo}`, stk.lotNo)}
                              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '6px', py: 0.2, fontSize: '11px' }}
                            >
                              Trace Lot
                            </Button>
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              onClick={() => handleNavigate(stk.url, stk.lotNo)}
                              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '6px', py: 0.2, fontSize: '11px' }}
                            >
                              Stock Report
                            </Button>
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  </Box>
                )}

                {/* 8. Controlled Documents & Production Records */}
                {results.documents?.length > 0 && (selectedCategory === 'all' || selectedCategory === 'documents') && (
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                      <DescriptionIcon fontSize="small" /> Controlled Documents & Production Logs ({results.documents.length})
                    </Typography>
                    <Stack spacing={0.8}>
                      {results.documents.map((doc, i) => (
                        <Paper
                          key={i}
                          elevation={0}
                          sx={{
                            p: 1.5,
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 1,
                            '&:hover': { bgcolor: '#f8fafc', borderColor: '#2563eb' }
                          }}
                        >
                          <Box display="flex" alignItems="center" gap={1.5}>
                            <DescriptionIcon sx={{ color: doc.type?.includes('Digital') ? '#16a34a' : '#0284c7', fontSize: 22 }} />
                            <Box>
                              <Box display="flex" alignItems="center" gap={1}>
                                <Chip label={doc.docCode || doc.type} size="small" sx={{ height: 18, fontSize: '10px', fontWeight: 800, bgcolor: '#f1f5f9' }} />
                                <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>{doc.title}</Typography>
                                {doc.status && <Chip label={doc.status} size="small" color={doc.statusColor || 'success'} sx={{ height: 18, fontSize: '10px', fontWeight: 700 }} />}
                              </Box>
                              <Typography variant="caption" sx={{ color: '#64748b' }}>
                                Doc: {doc.docNumber || '—'} {doc.date && `| Date: ${doc.date}`} {doc.department && `| Dept: ${doc.department}`}
                              </Typography>
                            </Box>
                          </Box>
                          <Stack direction="row" spacing={1}>
                            <Button
                              size="small"
                              variant="contained"
                              color={doc.type?.includes('Digital') ? 'success' : 'primary'}
                              onClick={() => handleNavigate(doc.actionUrl || doc.url, doc.docNumber || doc.title)}
                              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '6px', py: 0.2, fontSize: '11px' }}
                            >
                              {doc.actionLabel || 'Open Document'}
                            </Button>
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            )}
          </Box>
        )}
      </DialogContent>

      {/* Footer Shortcut Helper */}
      <Box
        sx={{
          p: 1.5,
          px: 2,
          bgcolor: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '11px', display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <strong style={{ background: '#e2e8f0', padding: '1px 5px', borderRadius: '4px', color: '#1e293b' }}>Ctrl + K</strong> Search anywhere
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '11px', display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <strong style={{ background: '#e2e8f0', padding: '1px 5px', borderRadius: '4px', color: '#1e293b' }}>ESC</strong> Close
          </Typography>
        </Stack>

        <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '11px' }}>
          Company: <strong style={{ color: '#475569' }}>{selectedCompany?.name || 'BVC Company'}</strong> | FY: <strong style={{ color: '#475569' }}>{financialYear || 'Current'}</strong>
        </Typography>
      </Box>
    </Dialog>
  );
};

export default UniversalSearchModal;
