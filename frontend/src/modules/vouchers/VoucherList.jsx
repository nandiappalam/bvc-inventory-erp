import React, { useState, useEffect } from 'react';
import {
  Container, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, Button, Box, TextField, Select, MenuItem, IconButton, Chip, Dialog,
  DialogContent, DialogActions, CircularProgress, Tooltip, Snackbar, Alert
} from '@mui/material';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import voucherAPI from './voucherService.js';
import { useConfirm } from '../../context/ConfirmContext.jsx';
import { safeArray } from '../../utils/safeArray.js';
import { printElement } from '../../utils/printHelper.js';

// Icons
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import PrintIcon from '@mui/icons-material/Print';
import DeleteIcon from '@mui/icons-material/Delete';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CancelIcon from '@mui/icons-material/Cancel';
import ClearIcon from '@mui/icons-material/Clear';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';

const VOUCHER_TYPES = ['Payment', 'Receipt', 'Contra', 'Journal'];
const STATUSES = ['Draft', 'Submitted', 'Approved', 'Locked', 'Cancelled'];

const VoucherList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const confirm = useConfirm();
  const [vouchers, setVouchers] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState(true);

  // In-app Snackbar notifications
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  const notify = (message, severity = 'success') => setToast({ open: true, message, severity });
  const [filters, setFilters] = useState({
    from_date: '',
    to_date: '',
    voucher_type: '',
    ledger_id: '',
    status: '',
    search: ''
  });

  // Sync URL search params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const searchVal = params.get('search');
    const typeVal = params.get('type') || params.get('voucher_type');
    const statusVal = params.get('status');
    const ledgerVal = params.get('ledger_id');
    const fromVal = params.get('from_date');
    const toVal = params.get('to_date');

    if (searchVal || typeVal || statusVal || ledgerVal || fromVal || toVal) {
      setFilters(prev => ({
        ...prev,
        search: searchVal !== null ? searchVal : prev.search,
        voucher_type: typeVal !== null ? typeVal : prev.voucher_type,
        status: statusVal !== null ? statusVal : prev.status,
        ledger_id: ledgerVal !== null ? ledgerVal : prev.ledger_id,
        from_date: fromVal !== null ? fromVal : prev.from_date,
        to_date: toVal !== null ? toVal : prev.to_date
      }));
    }
  }, [location.search]);

  // Display modal states
  const [displayOpen, setDisplayOpen] = useState(false);
  const [displayVoucher, setDisplayVoucher] = useState(null);
  const [displayLoading, setDisplayLoading] = useState(false);

  useEffect(() => {
    // Load ledgers for the filter dropdown
    voucherAPI.getLedgers()
      .then(res => setLedgers(safeArray(res)))
      .catch(err => console.error('Error loading ledgers:', err));
  }, []);

  useEffect(() => {
    loadVouchers();
  }, [filters]);

  const loadVouchers = async () => {
    setLoading(true);
    try {
      const data = await voucherAPI.getAll(filters);
      setVouchers(safeArray(data));
    } catch (err) {
      console.error('Load vouchers error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      from_date: '',
      to_date: '',
      voucher_type: '',
      ledger_id: '',
      status: '',
      search: ''
    });
  };

  const openDisplay = async (id) => {
    setDisplayLoading(true);
    setDisplayOpen(true);
    try {
      const fullData = await voucherAPI.get(id);
      setDisplayVoucher(fullData);
    } catch (err) {
      console.error('Failed to load voucher details:', err);
      notify('Could not fetch voucher details.', 'error');
      setDisplayOpen(false);
    } finally {
      setDisplayLoading(false);
    }
  };

  const handleCancelVoucher = (voucher) => {
    if (!voucher) return;
    const vNo = voucher.voucher_no || `#${voucher.id}`;
    confirm({
      title: 'Confirm Cancel Voucher',
      message: `Are you sure you want to cancel Voucher ${vNo}?\n\nThis will mark the voucher status as Cancelled and remove its entries from financial ledger balances.`,
      confirmText: 'Cancel Voucher',
      confirmColor: 'warning',
      onConfirm: async () => {
        try {
          const fullData = await voucherAPI.get(voucher.id);
          const updated = {
            ...fullData,
            status: 'Cancelled',
            posted: 0 // Do not post cancelled voucher
          };
          await voucherAPI.update(voucher.id, updated);
          notify(`Voucher ${voucher.voucher_no} cancelled successfully!`, 'info');
          loadVouchers();
          if (displayOpen && displayVoucher?.id === voucher.id) {
            openDisplay(voucher.id);
          }
        } catch (err) {
          notify('Failed to cancel voucher: ' + err.message, 'error');
        }
      }
    });
  };

  const handleDuplicateVoucher = async (id) => {
    try {
      const fullVoucher = await voucherAPI.get(id);
      const duplicatedData = {
        voucher_type: fullVoucher.voucher_type,
        date: new Date().toISOString().split('T')[0],
        reference_no: fullVoucher.reference_no ? `${fullVoucher.reference_no} (Dup)` : '',
        narration: fullVoucher.narration || '',
        status: 'Draft',
        posted: 1,
        entries: fullVoucher.entries.map(entry => ({
          type: entry.type,
          ledger_id: entry.ledger_id,
          ledger_name: entry.ledger_name,
          debit: entry.debit,
          credit: entry.credit,
          remarks: entry.remarks || ''
        }))
      };
      navigate('/entry/voucher-create', { state: { prefill: duplicatedData } });
    } catch (err) {
      notify('Failed to duplicate: ' + err.message, 'error');
    }
  };

  const deleteVoucher = (voucherOrId) => {
    const voucher = typeof voucherOrId === 'object' ? voucherOrId : vouchers.find(v => v.id === voucherOrId);
    const targetId = voucher ? voucher.id : voucherOrId;
    const vNo = voucher?.voucher_no || `#${targetId}`;
    const vType = voucher?.voucher_type || 'Voucher';
    const vAmt = voucher?.total_amount ? ` for ₹${Number(voucher.total_amount).toLocaleString('en-IN')}` : '';

    confirm({
      title: 'Confirm Voucher Deletion',
      message: `Are you sure you want to delete ${vType} ${vNo}${vAmt}?\n\nThis will permanently delete the voucher record and revert all associated ledger postings. This action cannot be undone.`,
      confirmText: 'Delete Voucher',
      confirmColor: 'error',
      onConfirm: async () => {
        try {
          await voucherAPI.delete(targetId);
          notify(`Voucher ${vNo} deleted successfully from register`, 'success');
          loadVouchers();
          setDisplayOpen(false);
        } catch (err) {
          notify('Delete failed: ' + err.message, 'error');
        }
      }
    });
  };

  const handlePrint = async (voucherOrNo) => {
    if (typeof voucherOrNo === 'string') {
      const v = vouchers.find(x => x.voucher_no === voucherOrNo);
      if (v) {
        setDisplayLoading(true);
        setDisplayOpen(true);
        try {
          const fullData = await voucherAPI.get(v.id);
          setDisplayVoucher(fullData);
          setTimeout(() => {
            const el = document.getElementById('voucher-print-area');
            if (el) {
              printElement(el, { title: `Voucher_${v.voucher_no}` });
            } else {
              window.print();
            }
          }, 400);
        } catch (err) {
          console.error(err);
        } finally {
          setDisplayLoading(false);
        }
        return;
      }
    }
    const el = document.getElementById('voucher-print-area');
    if (el) {
      printElement(el, { title: `Voucher_${displayVoucher?.voucher_no || 'Document'}` });
    } else {
      window.print();
    }
  };

  const handleDownloadPDF = async (voucher) => {
    if (voucher && (!displayVoucher || displayVoucher.id !== voucher.id)) {
      setDisplayLoading(true);
      setDisplayOpen(true);
      try {
        const fullData = await voucherAPI.get(voucher.id);
        setDisplayVoucher(fullData);
        setTimeout(() => {
          printElement('display-modal-printable');
        }, 500);
      } catch (err) {
        console.error(err);
      } finally {
        setDisplayLoading(false);
      }
      return;
    }
    printElement('display-modal-printable');
  };

  // Compute bottom summaries
  const totalCount = vouchers.length;
  const totalDebitSum = vouchers.reduce((sum, v) => sum + parseFloat(v.total_debit || 0), 0);
  const totalCreditSum = vouchers.reduce((sum, v) => sum + parseFloat(v.total_credit || 0), 0);
  const difference = totalDebitSum - totalCreditSum;

  return (
    <Box sx={{ p: '20px', bgcolor: '#f0f6ff', minHeight: '100vh', fontFamily: "'Segoe UI', 'Tahoma', Arial, sans-serif" }} id="voucher-register-container">
      {/* Enterprise Title Bar - Standard Blue & White Theme */}
      <Box className="screen-title" sx={{
        background: 'linear-gradient(135deg, #1f4fb2 0%, #2a5ea0 100%)',
        color: '#ffffff',
        p: '12px 20px',
        fontSize: '20px',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: '4px 4px 0 0',
        mb: '15px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <Button
          onClick={() => navigate(-1)}
          sx={{
            background: '#ffffff',
            border: '1px solid #ccc',
            borderRadius: '4px',
            padding: '4px 12px',
            fontSize: '13px',
            fontWeight: 'bold',
            color: '#333',
            textTransform: 'none',
            minWidth: 'auto',
            '&:hover': { background: '#f8fafc' }
          }}
        >
          ← Back
        </Button>
        <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#fff', fontSize: '20px', textAlign: 'center', flex: 1, textTransform: 'uppercase' }}>
          VOUCHER DISPLAY
        </Typography>
        <Button
          component={Link}
          to="/entry/voucher-create"
          sx={{
            background: '#ffffff',
            color: '#1f4fb2',
            fontWeight: 'bold',
            fontSize: '13px',
            px: 2,
            py: '6px',
            borderRadius: '4px',
            textTransform: 'none',
            '&:hover': { background: '#f8fafc' }
          }}
        >
          + New Voucher
        </Button>
      </Box>

      {/* Filters Panel */}
      <Paper elevation={1} sx={{ p: 2, mb: 2, bgcolor: '#e9eef7', border: '1px solid #9fb6dd', borderRadius: '4px' }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            label="From Date"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={filters.from_date}
            onChange={(e) => handleFilterChange('from_date', e.target.value)}
            size="small"
            sx={{ width: 140 }}
          />
          <TextField
            label="To Date"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={filters.to_date}
            onChange={(e) => handleFilterChange('to_date', e.target.value)}
            size="small"
            sx={{ width: 140 }}
          />
          <Select
            value={filters.voucher_type}
            onChange={(e) => handleFilterChange('voucher_type', e.target.value)}
            displayEmpty
            size="small"
            sx={{ width: 130 }}
          >
            <MenuItem value="">[All Voucher Types]</MenuItem>
            {VOUCHER_TYPES.map(type => (
              <MenuItem key={type} value={type}>{type}</MenuItem>
            ))}
          </Select>
          <Select
            value={filters.ledger_id}
            onChange={(e) => handleFilterChange('ledger_id', e.target.value)}
            displayEmpty
            size="small"
            sx={{ width: 180 }}
          >
            <MenuItem value="">[All Ledgers]</MenuItem>
            {ledgers.map(l => (
              <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>
            ))}
          </Select>
          <Select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            displayEmpty
            size="small"
            sx={{ width: 140 }}
          >
            <MenuItem value="">[All Statuses]</MenuItem>
            {STATUSES.map(s => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </Select>
          <TextField
            label="Search (No / Narration / Ref)"
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            size="small"
            placeholder="Search..."
            sx={{ flexGrow: 1, minWidth: 200 }}
          />
          <Button
            variant="outlined"
            onClick={handleClearFilters}
            startIcon={<ClearIcon />}
            size="medium"
            color="inherit"
          >
            Clear
          </Button>
        </Box>
      </Paper>

      {/* Main Voucher Grid */}
      <Paper elevation={2} sx={{ borderRadius: 1, overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8, flexDirection: 'column', gap: 2 }}>
            <CircularProgress color="success" />
            <Typography variant="body2" color="text.secondary">Fetching accounting records...</Typography>
          </Box>
        ) : vouchers.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <Typography variant="subtitle1" color="text.secondary" gutterBottom>
              No vouchers match the active filters or register criteria.
            </Typography>
            <Button component={Link} to="/entry/voucher-create" variant="contained" color="success" sx={{ mt: 1 }}>
              Record First Voucher
            </Button>
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: 'calc(100vh - 340px)', minHeight: '300px', overflowY: 'auto' }}>
            <Table size="small" stickyHeader sx={{ minWidth: 900 }}>
              <TableHead>
                <TableRow sx={{ '& th': { bgcolor: '#1f4fb2', color: '#fff', fontWeight: 'bold', border: '1px solid #9fb6dd' } }}>
                  <TableCell style={{ width: 60, color: '#fff' }}>No.</TableCell>
                  <TableCell style={{ width: 120, color: '#fff' }}>Voucher No</TableCell>
                  <TableCell style={{ width: 110, color: '#fff' }}>Date</TableCell>
                  <TableCell style={{ width: 110, color: '#fff' }}>Type</TableCell>
                  <TableCell style={{ color: '#fff' }}>Particulars (Ledger Account)</TableCell>
                  <TableCell align="right" style={{ width: 120, color: '#fff' }}>Debit</TableCell>
                  <TableCell align="right" style={{ width: 120, color: '#fff' }}>Credit</TableCell>
                  <TableCell style={{ width: 110, color: '#fff' }}>Status</TableCell>
                  <TableCell style={{ width: 90, color: '#fff' }}>Posted</TableCell>
                  <TableCell align="center" style={{ width: 230, color: '#fff' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {vouchers.map((voucher, index) => {
                  let statusColor = 'primary';
                  if (voucher.status === 'Draft') statusColor = 'default';
                  else if (voucher.status === 'Approved' || voucher.status === 'Submitted') statusColor = 'success';
                  else if (voucher.status === 'Cancelled') statusColor = 'error';
                  else if (voucher.status === 'Locked') statusColor = 'warning';

                  return (
                    <TableRow key={voucher.id} hover sx={{ '&:nth-of-type(even)': { bgcolor: '#fcfdfe' } }}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <Typography
                          onClick={() => openDisplay(voucher.id)}
                          sx={{
                            fontWeight: 'bold',
                            color: '#1b5e20',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            '&:hover': { color: '#0d3c13' }
                          }}
                        >
                          {voucher.voucher_no}
                        </Typography>
                      </TableCell>
                      <TableCell>{voucher.date}</TableCell>
                      <TableCell>
                        <Chip
                          label={voucher.voucher_type}
                          size="small"
                          sx={{
                            fontWeight: 'bold',
                            fontSize: '0.75rem',
                            bgcolor: voucher.voucher_type === 'Payment' ? '#ffebee' :
                                     voucher.voucher_type === 'Receipt' ? '#e8f5e9' :
                                     voucher.voucher_type === 'Contra' ? '#e3f2fd' : '#f3e5f5',
                            color: voucher.voucher_type === 'Payment' ? '#c62828' :
                                   voucher.voucher_type === 'Receipt' ? '#2e7d32' :
                                   voucher.voucher_type === 'Contra' ? '#1565c0' : '#6a1b9a',
                            border: '1px solid currentColor'
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Tooltip title={voucher.ledger_names || 'N/A'}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', noWrap: true, textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: 350 }}>
                            {voucher.ledger_names || 'N/A'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        ₹{parseFloat(voucher.total_debit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        ₹{parseFloat(voucher.total_credit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={voucher.status || 'Approved'}
                          size="small"
                          color={statusColor}
                          variant="outlined"
                          sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}
                        />
                      </TableCell>
                      <TableCell>
                        {voucher.posted !== 0 ? (
                          <Chip label="Yes" size="small" color="success" sx={{ fontSize: '0.7rem', height: 20 }} />
                        ) : (
                          <Chip label="No" size="small" color="default" sx={{ fontSize: '0.7rem', height: 20 }} />
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                          <Tooltip title="View (Tally Style)">
                            <IconButton size="small" color="success" onClick={() => openDisplay(voucher.id)}>
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Create Settlement Voucher for this Voucher No">
                            <IconButton
                              size="small"
                              sx={{ color: '#0284c7' }}
                              onClick={() => {
                                const isPurchase = voucher.voucher_type === 'Purchase' || voucher.voucher_type === 'Payment' || String(voucher.voucher_no).toUpperCase().startsWith('PUR');
                                navigate('/entry/voucher-create', {
                                  state: {
                                    prefillBill: {
                                      invoice_no: voucher.voucher_no,
                                      ledger_name: voucher.ledger_names,
                                      type: isPurchase ? 'Payable' : 'Receivable',
                                      voucher_type: isPurchase ? 'Purchase' : 'Sales',
                                      balance: voucher.total_debit || voucher.total_credit,
                                      amount: voucher.total_debit || voucher.total_credit
                                    }
                                  }
                                });
                              }}
                            >
                              <ReceiptLongIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit">
                            <IconButton size="small" color="primary" onClick={() => navigate(`/entry/voucher-create/${voucher.id}`)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Print">
                            <IconButton size="small" color="inherit" onClick={() => handlePrint(voucher.voucher_no)}>
                              <PrintIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="PDF">
                            <IconButton size="small" color="info" onClick={() => handleDownloadPDF(voucher)}>
                              <PictureAsPdfIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Duplicate">
                            <IconButton size="small" color="secondary" onClick={() => handleDuplicateVoucher(voucher.id)}>
                              <ContentCopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Cancel">
                            <IconButton size="small" color="warning" onClick={() => handleCancelVoucher(voucher)}>
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => deleteVoucher(voucher.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Bottom Professional Summaries */}
        {!loading && vouchers.length > 0 && (
          <Box sx={{ p: 2, bgcolor: '#1a2332', color: '#fff', borderTop: '2px solid #2e7d32' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, textAlign: 'center' }}>
              <Box>
                <Typography variant="caption" display="block" color="grey.400">TOTAL VOUCHERS</Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#a5d6a7' }}>{totalCount}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" display="block" color="grey.400">TOTAL DEBIT</Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  ₹{totalDebitSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" display="block" color="grey.400">TOTAL CREDIT</Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  ₹{totalCreditSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" display="block" color="grey.400">DIFFERENCE</Typography>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 900,
                    color: Math.abs(difference) < 0.01 ? '#81c784' : '#e57373'
                  }}
                >
                  ₹{difference.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  {Math.abs(difference) < 0.01 ? ' (Balanced ✔)' : ' (Unbalanced ❌)'}
                </Typography>
              </Box>
            </Box>
          </Box>
        )}
      </Paper>

      {/* Professional Blue & White Voucher Display Dialog */}
      <Dialog
        open={displayOpen}
        onClose={() => setDisplayOpen(false)}
        maxWidth="md"
        fullWidth
        id="voucher-print-area"
        PaperProps={{
          sx: {
            bgcolor: '#ffffff',
            color: '#1e293b',
            fontFamily: "'Segoe UI', 'Tahoma', Arial, sans-serif",
            border: '1px solid #cbd5e1',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            borderRadius: '8px',
            overflow: 'hidden'
          }
        }}
      >
        {displayLoading ? (
          <DialogContent sx={{ p: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, bgcolor: '#ffffff' }}>
            <CircularProgress sx={{ color: '#1f4fb2' }} />
            <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>Loading Voucher Details...</Typography>
          </DialogContent>
        ) : displayVoucher ? (
          <>
            {/* Enterprise Blue Header Banner */}
            <Box sx={{
              background: 'linear-gradient(135deg, #1f4fb2 0%, #2a5ea0 100%)',
              color: '#ffffff',
              p: '16px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}>
              <Box>
                <Typography variant="caption" sx={{ display: 'block', color: '#93c5fd', letterSpacing: 1.2, fontWeight: 700, textTransform: 'uppercase', fontSize: '0.7rem' }}>
                  Enterprise Accounting & Ledger System
                </Typography>
                <Typography sx={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: 0.5 }}>
                  Voucher Details — {displayVoucher.voucher_no}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                <Chip
                  label={`Status: ${displayVoucher.status || 'Approved'}`}
                  size="small"
                  sx={{
                    bgcolor: displayVoucher.status === 'Cancelled' ? '#fee2e2' : '#dcfce7',
                    color: displayVoucher.status === 'Cancelled' ? '#991b1b' : '#166534',
                    fontWeight: 700,
                    border: '1px solid currentColor'
                  }}
                />
                {displayVoucher.posted !== 0 && (
                  <Chip
                    label="Posted in Ledger"
                    size="small"
                    sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700, border: '1px solid #bfdbfe' }}
                  />
                )}
              </Box>
            </Box>

            <DialogContent sx={{ p: 3, bgcolor: '#f8fafc' }}>
              {/* Voucher Meta details Card */}
              <Paper elevation={0} sx={{ p: 2.5, mb: 3, bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>Voucher Number:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: '#1f4fb2' }}>{displayVoucher.voucher_no}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>Voucher Type:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>{displayVoucher.voucher_type}</Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>Transaction Date:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>{displayVoucher.date}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>Reference / Bill Ref:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>{displayVoucher.reference_no || 'N/A'}</Typography>
                  </Box>
                </Box>
              </Paper>

              {/* Transactions Ledger Entry Table */}
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#1e293b', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: 0.5 }}>
                Double Entry Account Postings & Particulars:
              </Typography>
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', bgcolor: '#ffffff' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { bgcolor: '#1f4fb2', color: '#ffffff', fontWeight: 700, fontSize: '0.8rem', borderBottom: '2px solid #1e40af' } }}>
                      <TableCell style={{ width: 80 }}>Type</TableCell>
                      <TableCell>Particulars (Ledger Account Name)</TableCell>
                      <TableCell align="right" style={{ width: 140 }}>Debit (₹)</TableCell>
                      <TableCell align="right" style={{ width: 140 }}>Credit (₹)</TableCell>
                      <TableCell>Remarks</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody sx={{ '& td': { borderColor: '#f1f5f9', py: 1.2 } }}>
                    {safeArray(displayVoucher.entries).map((entry, index) => (
                      <TableRow key={index} hover sx={{ '&:nth-of-type(even)': { bgcolor: '#fcfdfe' } }}>
                        <TableCell>
                          <Chip
                            label={entry.type}
                            size="small"
                            sx={{
                              fontWeight: 800,
                              height: 22,
                              fontSize: '0.7rem',
                              bgcolor: entry.type === 'Dr' ? '#fee2e2' : '#dcfce7',
                              color: entry.type === 'Dr' ? '#b91c1c' : '#15803d'
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                            {entry.ledger_name}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: entry.debit > 0 ? '#b91c1c' : '#64748b' }}>
                          {entry.debit > 0 ? `₹${parseFloat(entry.debit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: entry.credit > 0 ? '#15803d' : '#64748b' }}>
                          {entry.credit > 0 ? `₹${parseFloat(entry.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.85rem' }}>
                            {entry.remarks || '—'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}

                    {/* Totals Row */}
                    <TableRow sx={{ bgcolor: '#f1f5f9', '& td': { fontWeight: 800, borderTop: '2px solid #cbd5e1' } }}>
                      <TableCell colSpan={2} align="right">
                        TOTAL:
                      </TableCell>
                      <TableCell align="right" sx={{ color: '#b91c1c' }}>
                        ₹{parseFloat(displayVoucher.total_debit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell align="right" sx={{ color: '#15803d' }}>
                        ₹{parseFloat(displayVoucher.total_credit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#166534', fontSize: '0.75rem', fontWeight: 700 }}>
                          <span>Balanced ✔</span>
                        </Box>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Narration Box */}
              <Box sx={{ mt: 3, p: 2, border: '1px solid #e2e8f0', bgcolor: '#ffffff', borderRadius: '6px' }}>
                <Typography variant="caption" display="block" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase', mb: 0.5 }}>
                  Narration / Remarks:
                </Typography>
                <Typography variant="body2" sx={{ color: '#1e293b', fontWeight: 500 }}>
                  {displayVoucher.narration || 'No narration provided for this transaction.'}
                </Typography>
              </Box>
            </DialogContent>
          </>
        ) : (
          <DialogContent sx={{ p: 6, textAlign: 'center' }}>
            <Typography sx={{ color: '#64748b' }}>No voucher data loaded.</Typography>
          </DialogContent>
        )}

        <DialogActions sx={{ p: '16px 24px', bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              onClick={() => handlePrint(displayVoucher?.voucher_no)}
              startIcon={<PrintIcon />}
              sx={{ bgcolor: '#1f4fb2', fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#1e40af' } }}
              size="small"
            >
              Print
            </Button>
            <Button
              variant="contained"
              onClick={() => handleDownloadPDF(displayVoucher)}
              startIcon={<PictureAsPdfIcon />}
              sx={{ bgcolor: '#0284c7', fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#0369a1' } }}
              size="small"
            >
              PDF
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                if (displayVoucher) navigate(`/entry/voucher-create/${displayVoucher.id}`);
              }}
              startIcon={<EditIcon />}
              sx={{ color: '#1f4fb2', borderColor: '#1f4fb2', fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#eff6ff', borderColor: '#1e40af' } }}
              size="small"
            >
              Edit
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                if (displayVoucher) handleDuplicateVoucher(displayVoucher.id);
              }}
              startIcon={<ContentCopyIcon />}
              sx={{ color: '#475569', borderColor: '#cbd5e1', fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#f1f5f9' } }}
              size="small"
            >
              Duplicate
            </Button>
            {displayVoucher && displayVoucher.status !== 'Cancelled' && (
              <Button
                variant="outlined"
                onClick={() => handleCancelVoucher(displayVoucher)}
                startIcon={<CancelIcon />}
                sx={{ color: '#d97706', borderColor: '#fcd34d', fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#fffbeb' } }}
                size="small"
              >
                Cancel
              </Button>
            )}
            <Button
              variant="outlined"
              onClick={() => {
                if (displayVoucher) deleteVoucher(displayVoucher.id);
              }}
              startIcon={<DeleteIcon />}
              sx={{ color: '#dc2626', borderColor: '#fca5a5', fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#fef2f2' } }}
              size="small"
            >
              Delete
            </Button>
          </Box>
          <Button
            variant="contained"
            onClick={() => setDisplayOpen(false)}
            sx={{ bgcolor: '#64748b', fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#475569' } }}
            size="small"
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setToast(prev => ({ ...prev, open: false }))}
          severity={toast.severity}
          variant="filled"
          sx={{ width: '100%', fontWeight: 'bold' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default VoucherList;
