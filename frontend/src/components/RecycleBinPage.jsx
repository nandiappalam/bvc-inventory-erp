import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TextField,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Tooltip,
  CircularProgress,
  Alert,
  Snackbar,
  IconButton,
} from '@mui/material';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import RecyclingIcon from '@mui/icons-material/Recycling';
import api from '../services/api.js';

const themeColors = {
  primary: '#1f4fb2',
  secondary: '#2a5ea0',
  lightBlue: '#dbe7fb',
  lighterBlue: '#eaf2fb',
  success: '#10b981',
  textPrimary: '#333333',
};

const RecycleBinPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [restoringId, setRestoringId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [emptying, setEmptying] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await api('/recycle-bin');
      if (data && data.success) {
        setItems(data.items || []);
      } else {
        showNotification(data?.message || 'Failed to load recycle bin', 'error');
      }
    } catch (err) {
      console.error('Error fetching recycle bin:', err);
      showNotification('Error loading recycle bin items', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const showNotification = (message, severity = 'success') => {
    setNotification({ open: true, message, severity });
  };

  const handleRestore = async (id, title) => {
    if (!window.confirm(`Are you sure you want to restore "${title}"?`)) return;
    setRestoringId(id);
    try {
      const data = await api(`/recycle-bin/restore/${id}`, { method: 'POST' });
      if (data && data.success) {
        showNotification(data.message || `Restored "${title}" successfully`, 'success');
        fetchItems();
      } else {
        showNotification(data?.message || 'Failed to restore item', 'error');
      }
    } catch (err) {
      showNotification('Error restoring item', 'error');
    } finally {
      setRestoringId(null);
    }
  };

  const handleDeletePermanently = async (id, title) => {
    if (!window.confirm(`Are you sure you want to PERMANENTLY delete "${title}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      const data = await api(`/recycle-bin/${id}`, { method: 'DELETE' });
      if (data && data.success) {
        showNotification(`Permanently deleted "${title}"`, 'info');
        fetchItems();
      } else {
        showNotification(data?.message || 'Failed to delete item', 'error');
      }
    } catch (err) {
      showNotification('Error deleting item', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEmptyBin = async () => {
    if (items.length === 0) return;
    if (!window.confirm(`Are you sure you want to EMPTY the Recycle Bin? All ${items.length} deleted items will be permanently erased.`)) return;
    setEmptying(true);
    try {
      const data = await api('/recycle-bin/empty', { method: 'POST' });
      if (data && data.success) {
        showNotification('Recycle bin emptied successfully', 'info');
        fetchItems();
      } else {
        showNotification(data?.message || 'Failed to empty recycle bin', 'error');
      }
    } catch (err) {
      showNotification('Error emptying recycle bin', 'error');
    } finally {
      setEmptying(false);
    }
  };

  const modules = ['ALL', ...Array.from(new Set(items.map((i) => i.module_name || 'General')))];

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      !search ||
      (item.title && item.title.toLowerCase().includes(search.toLowerCase())) ||
      (item.module_name && item.module_name.toLowerCase().includes(search.toLowerCase())) ||
      (item.deleted_by && item.deleted_by.toLowerCase().includes(search.toLowerCase()));

    const matchesModule = moduleFilter === 'ALL' || item.module_name === moduleFilter;

    return matchesSearch && matchesModule;
  });

  const getModuleChipColor = (modName) => {
    if (!modName) return { bg: '#e2e8f0', color: '#334155' };
    const lower = modName.toLowerCase();
    if (lower.includes('purchase')) return { bg: '#dbeafe', color: '#1e40af' };
    if (lower.includes('sales')) return { bg: '#dcfce7', color: '#166534' };
    if (lower.includes('item') || lower.includes('master')) return { bg: '#fef3c7', color: '#92400e' };
    if (lower.includes('voucher')) return { bg: '#f3e8ff', color: '#6b21a8' };
    return { bg: '#e2e8f0', color: '#334155' };
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 3, mb: 4 }}>
      <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        {/* Header */}
        <Box
          sx={{
            background: `linear-gradient(135deg, ${themeColors.primary} 0%, ${themeColors.secondary} 100%)`,
            color: 'white',
            p: 2.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <RecyclingIcon sx={{ fontSize: 32, color: '#f43f5e' }} />
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                Recycle Bin
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)' }}>
                View and restore deleted records across Purchases, Sales, Masters, and Vouchers
              </Typography>
            </Box>
          </Box>
          <Chip
            label={`${items.length} Items Deleted`}
            sx={{
              bgcolor: 'rgba(255,255,255,0.2)',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '13px',
              px: 1,
            }}
          />
        </Box>

        {/* Content */}
        <Box sx={{ p: 3, bgcolor: '#f8fafc' }}>
          {/* Controls Bar */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Search deleted records..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ flexGrow: 1, minWidth: '220px', bgcolor: 'white', borderRadius: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <FormControl size="small" sx={{ minWidth: 180, bgcolor: 'white', borderRadius: 1 }}>
              <InputLabel>Module Filter</InputLabel>
              <Select value={moduleFilter} label="Module Filter" onChange={(e) => setModuleFilter(e.target.value)}>
                {modules.map((m) => (
                  <MenuItem key={m} value={m}>
                    {m === 'ALL' ? 'All Modules' : m}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Tooltip title="Refresh Recycle Bin">
              <IconButton onClick={fetchItems} color="primary" sx={{ bgcolor: 'white', border: '1px solid #cbd5e1' }}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {items.length > 0 && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteSweepIcon />}
                onClick={handleEmptyBin}
                disabled={emptying}
                sx={{
                  borderColor: '#f43f5e',
                  color: '#e11d48',
                  fontWeight: 'bold',
                  '&:hover': { bgcolor: '#ffe4e6', borderColor: '#e11d48' },
                }}
              >
                {emptying ? 'Emptying...' : 'Empty Recycle Bin'}
              </Button>
            )}
          </Box>

          {/* Table */}
          <TableContainer component={Paper} elevation={1} sx={{ borderRadius: 2 }}>
            <Table size="medium">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: themeColors.lighterBlue, color: themeColors.primary }}>Module</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: themeColors.lighterBlue, color: themeColors.primary }}>Record Description / Title</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: themeColors.lighterBlue, color: themeColors.primary }}>Deleted By</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: themeColors.lighterBlue, color: themeColors.primary }}>Date & Time</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: themeColors.lighterBlue, color: themeColors.primary }}>
                    Restore / Action
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                      <CircularProgress size={36} />
                      <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                        Loading Recycle Bin...
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                      <RecyclingIcon sx={{ fontSize: 56, color: '#cbd5e1', mb: 1 }} />
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#64748b' }}>
                        {items.length === 0 ? 'Recycle Bin is empty' : 'No records match search filter'}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                        When you delete records in Purchases, Sales, Masters, or Vouchers, they will be stored here and can be restored anytime.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => {
                    const chipStyle = getModuleChipColor(item.module_name);
                    const formattedDate = item.deleted_at ? new Date(item.deleted_at).toLocaleString() : 'N/A';
                    return (
                      <TableRow key={item.id} hover>
                        <TableCell>
                          <Chip
                            label={item.module_name || 'General'}
                            size="small"
                            sx={{
                              bgcolor: chipStyle.bg,
                              color: chipStyle.color,
                              fontWeight: 'bold',
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontWeight: '600', color: themeColors.textPrimary }}>
                          {item.title || `Record #${item.record_id}`}
                        </TableCell>
                        <TableCell sx={{ color: '#475569' }}>{item.deleted_by || 'admin'}</TableCell>
                        <TableCell sx={{ color: '#64748b', fontSize: '13px', fontFamily: 'monospace' }}>{formattedDate}</TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                            <Button
                              variant="contained"
                              size="small"
                              startIcon={restoringId === item.id ? <CircularProgress size={16} color="inherit" /> : <RestoreFromTrashIcon />}
                              onClick={() => handleRestore(item.id, item.title)}
                              disabled={restoringId === item.id}
                              sx={{
                                bgcolor: themeColors.success,
                                color: 'white',
                                textTransform: 'none',
                                fontWeight: 'bold',
                                '&:hover': { bgcolor: '#059669' },
                              }}
                            >
                              Restore
                            </Button>
                            <Tooltip title="Delete Permanently">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeletePermanently(item.id, item.title)}
                                disabled={deletingId === item.id}
                                sx={{
                                  '&:hover': { bgcolor: '#ffe4e6' },
                                }}
                              >
                                {deletingId === item.id ? <CircularProgress size={18} color="error" /> : <DeleteForeverIcon />}
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Paper>

      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={() => setNotification({ ...notification, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setNotification({ ...notification, open: false })}
          severity={notification.severity}
          variant="filled"
          sx={{ width: '100%', fontWeight: 'bold' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default RecycleBinPage;
