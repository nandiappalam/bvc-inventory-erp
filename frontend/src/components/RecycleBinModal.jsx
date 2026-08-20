import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  IconButton,
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
} from '@mui/material';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import RecyclingIcon from '@mui/icons-material/Recycling';

const themeColors = {
  primary: '#1f4fb2',
  secondary: '#2a5ea0',
  lightBlue: '#dbe7fb',
  lighterBlue: '#eaf2fb',
  danger: '#e11d48',
  dangerLight: '#ffe4e6',
  success: '#10b981',
  successLight: '#d1fae5',
  textPrimary: '#333333',
};

const RecycleBinModal = ({ open, onClose }) => {
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
      const response = await fetch('/api/recycle-bin');
      const data = await response.json();
      if (data.success) {
        setItems(data.items || []);
      } else {
        showNotification(data.message || 'Failed to load recycle bin', 'error');
      }
    } catch (err) {
      console.error('Error fetching recycle bin:', err);
      showNotification('Error loading recycle bin items', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchItems();
    }
  }, [open]);

  const showNotification = (message, severity = 'success') => {
    setNotification({ open: true, message, severity });
  };

  const handleRestore = async (id, title) => {
    if (!window.confirm(`Are you sure you want to restore "${title}"?`)) return;
    setRestoringId(id);
    try {
      const res = await fetch(`/api/recycle-bin/restore/${id}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showNotification(data.message || `Restored "${title}" successfully`, 'success');
        fetchItems();
      } else {
        showNotification(data.message || 'Failed to restore item', 'error');
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
      const res = await fetch(`/api/recycle-bin/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showNotification(`Permanently deleted "${title}"`, 'info');
        fetchItems();
      } else {
        showNotification(data.message || 'Failed to delete item', 'error');
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
      const res = await fetch('/api/recycle-bin/empty', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showNotification('Recycle bin emptied successfully', 'info');
        fetchItems();
      } else {
        showNotification(data.message || 'Failed to empty recycle bin', 'error');
      }
    } catch (err) {
      showNotification('Error emptying recycle bin', 'error');
    } finally {
      setEmptying(false);
    }
  };

  // Get unique list of module names for filtering
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
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth paperprops={{ style: { borderRadius: 12 } }}>
        <DialogTitle
          sx={{
            background: `linear-gradient(135deg, ${themeColors.primary} 0%, ${themeColors.secondary} 100%)`,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            py: 1.5,
            px: 2.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <RecyclingIcon sx={{ fontSize: 26, color: '#f43f5e' }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: '18px' }}>
              Recycle Bin
            </Typography>
            <Chip
              label={`${items.length} Deleted Items`}
              size="small"
              sx={{
                bgcolor: 'rgba(255,255,255,0.2)',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '11px',
                ml: 1,
              }}
            />
          </Box>
          <IconButton onClick={onClose} sx={{ color: 'white' }} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 2.5, bgcolor: '#f8fafc' }}>
          {/* Controls Bar */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Search deleted records..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ flexGrow: 1, minWidth: '200px', bgcolor: 'white', borderRadius: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <FormControl size="small" sx={{ minWidth: 160, bgcolor: 'white', borderRadius: 1 }}>
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
              <IconButton onClick={fetchItems} color="primary" size="small" sx={{ bgcolor: 'white', border: '1px solid #cbd5e1' }}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {items.length > 0 && (
              <Button
                variant="outlined"
                color="error"
                size="small"
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
                {emptying ? 'Emptying...' : 'Empty Bin'}
              </Button>
            )}
          </Box>

          {/* Table */}
          <TableContainer component={Paper} elevation={1} sx={{ borderRadius: 2, maxHeight: 420 }}>
            <Table stickyHeader size="small">
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
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      <CircularProgress size={32} />
                      <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                        Loading Recycle Bin...
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 5 }}>
                      <RecyclingIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 1 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#64748b' }}>
                        {items.length === 0 ? 'Recycle Bin is empty' : 'No records match search filter'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                        Deleted records from purchases, sales, masters, and vouchers will appear here.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => {
                    const chipStyle = getModuleChipColor(item.module_name);
                    const formattedDate = item.deleted_at ? new Date(item.deleted_at).toLocaleString() : 'N/A';
                    return (
                      <TableRow key={item.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        <TableCell>
                          <Chip
                            label={item.module_name || 'General'}
                            size="small"
                            sx={{
                              bgcolor: chipStyle.bg,
                              color: chipStyle.color,
                              fontWeight: 'bold',
                              fontSize: '11px',
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontWeight: '600', color: themeColors.textPrimary }}>
                          {item.title || `Record #${item.record_id}`}
                        </TableCell>
                        <TableCell sx={{ color: '#475569', fontSize: '12px' }}>{item.deleted_by || 'admin'}</TableCell>
                        <TableCell sx={{ color: '#64748b', fontSize: '12px', fontFamily: 'monospace' }}>{formattedDate}</TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                            <Button
                              variant="contained"
                              size="small"
                              startIcon={restoringId === item.id ? <CircularProgress size={14} color="inherit" /> : <RestoreFromTrashIcon />}
                              onClick={() => handleRestore(item.id, item.title)}
                              disabled={restoringId === item.id}
                              sx={{
                                bgcolor: themeColors.success,
                                color: 'white',
                                textTransform: 'none',
                                fontSize: '12px',
                                py: 0.3,
                                px: 1.5,
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
                                {deletingId === item.id ? <CircularProgress size={16} color="error" /> : <DeleteForeverIcon fontSize="small" />}
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
        </DialogContent>

        <DialogActions sx={{ px: 2.5, py: 1.5, bgcolor: '#f1f5f9', borderTop: '1px solid #e2e8f0' }}>
          <Typography variant="caption" sx={{ color: '#64748b', flexGrow: 1 }}>
            Items restored from Recycle Bin will automatically return to their original module tables.
          </Typography>
          <Button onClick={onClose} variant="contained" sx={{ bgcolor: themeColors.primary, textTransform: 'none', fontWeight: 'bold' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

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
    </>
  );
};

export default RecycleBinModal;
