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
import './VoucherList.css';

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
import RefreshIcon from '@mui/icons-material/Refresh';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import LastPageIcon from '@mui/icons-material/LastPage';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import SearchIcon from '@mui/icons-material/Search';

const VOUCHER_TYPES = ['Payment', 'Receipt', 'Contra', 'Journal', 'Purchase', 'Sales'];
const STATUSES = ['Draft', 'Submitted', 'Approved', 'Locked', 'Cancelled'];

const VoucherList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const confirm = useConfirm();
  const [vouchers, setVouchers] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);

  // In-app Snackbar notifications
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  const notify = (message, severity = 'success') => setToast({ open: true, message, severity });

  const handleReconcile = async () => {
    setReconciling(true);
    try {
      const res = await voucherAPI.reconcile();
      notify(res?.message || 'Accounting registers balanced successfully!', 'success');
      loadVouchers();
    } catch (err) {
      notify('Reconciliation error: ' + err.message, 'error');
    } finally {
      setReconciling(false);
    }
  };

  const [filters, setFilters] = useState({
    from_date: '',
    to_date: '',
    voucher_type: '',
    ledger_id: '',
    status: '',
    search: ''
  });

  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [filters]);

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
    const fetchLedgersList = () => {
      voucherAPI.getLedgers()
        .then(res => setLedgers(safeArray(res)))
        .catch(err => console.error('Error loading ledgers:', err));
    };
    fetchLedgersList();
    const handleCompanyChange = () => {
      fetchLedgersList();
      loadVouchers();
    };
    window.addEventListener('erp_company_changed', handleCompanyChange);
    return () => window.removeEventListener('erp_company_changed', handleCompanyChange);
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

  const effectiveRowsPerPage = rowsPerPage === 'All' ? vouchers.length : Number(rowsPerPage || 10);
  const totalPages = rowsPerPage === 'All' || vouchers.length === 0 ? 1 : Math.max(1, Math.ceil(vouchers.length / effectiveRowsPerPage));
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const paginatedVouchers = rowsPerPage === 'All'
    ? vouchers
    : vouchers.slice(safePage * effectiveRowsPerPage, (safePage + 1) * effectiveRowsPerPage);

  const startRecord = vouchers.length === 0 ? 0 : safePage * effectiveRowsPerPage + 1;
  const endRecord = rowsPerPage === 'All' ? vouchers.length : Math.min((safePage + 1) * effectiveRowsPerPage, vouchers.length);

  return (
    <Box className="voucher-display-container" id="voucher-register-container">
      {/* Enterprise Title Bar - Standard Blue & White Theme */}
      <Box className="voucher-header-bar">
        <Button
          onClick={() => navigate(-1)}
          className="voucher-header-btn"
          sx={{ minWidth: 'auto' }}
        >
          ← Back
        </Button>
        <Typography variant="h6" className="voucher-header-title">
          VOUCHER DISPLAY & AUDIT REGISTER
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            onClick={() => loadVouchers()}
            className="voucher-header-btn"
            startIcon={<RefreshIcon fontSize="small" />}
            size="small"
          >
            Refresh
          </Button>
          <Button
            onClick={handleReconcile}
            disabled={reconciling}
            className="voucher-header-btn-green"
            size="small"
          >
            {reconciling ? 'Reconciling...' : '⚡ Reconcile'}
          </Button>
          <Button
            component={Link}
            to="/entry/voucher-create"
            className="voucher-header-btn"
            size="small"
          >
            + New Voucher
          </Button>
        </Box>
      </Box>

      {/* Financial KPI Summary Banner */}
      <Box className="voucher-kpi-bar">
        <Box className="voucher-kpi-item">
          <span className="voucher-kpi-label">Total Vouchers</span>
          <span className="voucher-kpi-value">{totalCount} Entries</span>
        </Box>
        <Box className="voucher-kpi-item">
          <span className="voucher-kpi-label">Period Total Debit</span>
          <span className="voucher-kpi-value" style={{ color: '#fca5a5' }}>
            ₹{totalDebitSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </Box>
        <Box className="voucher-kpi-item">
          <span className="voucher-kpi-label">Period Total Credit</span>
          <span className="voucher-kpi-value" style={{ color: '#86efac' }}>
            ₹{totalCreditSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </Box>
        <Box className="voucher-kpi-item">
          <span className="voucher-kpi-label">Audit / Register Status</span>
          <span className={`voucher-kpi-value ${Math.abs(difference) < 0.01 ? 'voucher-kpi-status-ok' : 'voucher-kpi-status-warn'}`}>
            {Math.abs(difference) < 0.01 ? 'Balanced ✔ (₹0.00)' : `Unbalanced ❌ (₹${Math.abs(difference).toLocaleString('en-IN', { minimumFractionDigits: 2 })})`}
          </span>
        </Box>
        <Box className="voucher-kpi-item">
          <span className="voucher-kpi-label">Active View Density</span>
          <span className="voucher-kpi-value">
            {rowsPerPage === 'All' ? 'All Rows' : `Max ${rowsPerPage} Rows / Page`}
          </span>
        </Box>
      </Box>

      {/* Filters Panel */}
      <Box className="voucher-filter-card">
        <Box className="voucher-filter-row">
          <Box className="voucher-filter-group">
            <span className="voucher-filter-label">From Date</span>
            <TextField
              type="date"
              InputLabelProps={{ shrink: true }}
              value={filters.from_date}
              onChange={(e) => handleFilterChange('from_date', e.target.value)}
              size="small"
              sx={{ width: 140, bgcolor: '#ffffff' }}
            />
          </Box>

          <Box className="voucher-filter-group">
            <span className="voucher-filter-label">To Date</span>
            <TextField
              type="date"
              InputLabelProps={{ shrink: true }}
              value={filters.to_date}
              onChange={(e) => handleFilterChange('to_date', e.target.value)}
              size="small"
              sx={{ width: 140, bgcolor: '#ffffff' }}
            />
          </Box>

          <Box className="voucher-filter-group">
            <span className="voucher-filter-label">Voucher Type</span>
            <Select
              value={filters.voucher_type}
              onChange={(e) => handleFilterChange('voucher_type', e.target.value)}
              displayEmpty
              size="small"
              sx={{ width: 145, bgcolor: '#ffffff' }}
            >
              <MenuItem value="">[All Types]</MenuItem>
              {VOUCHER_TYPES.map(type => (
                <MenuItem key={type} value={type}>{type}</MenuItem>
              ))}
            </Select>
          </Box>

          <Box className="voucher-filter-group">
            <span className="voucher-filter-label">Ledger Account</span>
            <Select
              value={filters.ledger_id}
              onChange={(e) => handleFilterChange('ledger_id', e.target.value)}
              displayEmpty
              size="small"
              sx={{ width: 190, bgcolor: '#ffffff' }}
            >
              <MenuItem value="">[All Ledgers]</MenuItem>
              {ledgers.map(l => (
                <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>
              ))}
            </Select>
          </Box>

          <Box className="voucher-filter-group">
            <span className="voucher-filter-label">Status</span>
            <Select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              displayEmpty
              size="small"
              sx={{ width: 135, bgcolor: '#ffffff' }}
            >
              <MenuItem value="">[All Statuses]</MenuItem>
              {STATUSES.map(s => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </Select>
          </Box>

          <Box className="voucher-filter-group" sx={{ flexGrow: 1, minWidth: 200 }}>
            <span className="voucher-filter-label">Search (No / Particulars / Ref)</span>
            <TextField
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              size="small"
              placeholder="Search by Voucher No, Account, Narration..."
              sx={{ bgcolor: '#ffffff' }}
              InputProps={{
                startAdornment: <SearchIcon fontSize="small" sx={{ color: '#94a3b8', mr: 0.5 }} />
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignSelf: 'flex-end', pb: '2px' }}>
            <Button
              variant="outlined"
              onClick={handleClearFilters}
              startIcon={<ClearIcon />}
              size="medium"
              sx={{
                bgcolor: '#ffffff',
                color: '#475569',
                borderColor: '#cbd5e1',
                textTransform: 'none',
                fontWeight: 700,
                height: 38,
                '&:hover': { bgcolor: '#f1f5f9', borderColor: '#94a3b8' }
              }}
            >
              Clear
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Main Voucher Grid Card */}
      <Box className="voucher-table-card">
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8, flexDirection: 'column', gap: 2 }}>
            <CircularProgress sx={{ color: '#1f4fb2' }} />
            <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>Fetching accounting records...</Typography>
          </Box>
        ) : vouchers.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <Typography variant="subtitle1" sx={{ color: '#64748b', fontWeight: 600 }} gutterBottom>
              No vouchers match the active filters or register criteria.
            </Typography>
            <Button component={Link} to="/entry/voucher-create" variant="contained" sx={{ mt: 1, bgcolor: '#1f4fb2', textTransform: 'none', fontWeight: 700 }}>
              + Record First Voucher
            </Button>
          </Box>
        ) : (
          <Box>
            {/* Top Pagination & Density Toolbar */}
            <Box className="voucher-pagination-toolbar">
              <Box className="voucher-pagination-info">
                <span>Showing <strong>{startRecord}</strong> to <strong>{endRecord}</strong> of <strong>{totalCount}</strong> vouchers</span>
                <span style={{ color: '#94a3b8' }}>•</span>
                <span style={{ color: '#64748b', fontSize: '12px' }}>Maximum 10 rows per page</span>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box className="voucher-density-selector">
                  <span>Display Rows:</span>
                  <Select
                    value={rowsPerPage}
                    onChange={(e) => {
                      setRowsPerPage(e.target.value);
                      setPage(0);
                    }}
                    size="small"
                    sx={{ bgcolor: '#ffffff', height: 30, fontSize: '0.85rem', fontWeight: 700 }}
                  >
                    <MenuItem value={10}>10 (Standard)</MenuItem>
                    <MenuItem value={25}>25</MenuItem>
                    <MenuItem value={50}>50</MenuItem>
                    <MenuItem value={100}>100</MenuItem>
                    <MenuItem value="All">All</MenuItem>
                  </Select>
                </Box>

                {rowsPerPage !== 'All' && totalPages > 1 && (
                  <Box className="voucher-page-nav">
                    <Tooltip title="First Page">
                      <span>
                        <IconButton
                          size="small"
                          disabled={safePage === 0}
                          onClick={() => setPage(0)}
                          className="voucher-page-btn"
                        >
                          <FirstPageIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Previous Page">
                      <span>
                        <IconButton
                          size="small"
                          disabled={safePage === 0}
                          onClick={() => setPage(prev => Math.max(0, prev - 1))}
                          className="voucher-page-btn"
                        >
                          <NavigateBeforeIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>

                    <Typography variant="body2" sx={{ fontWeight: 800, px: 1, color: '#1e293b', fontSize: '12px' }}>
                      Page {safePage + 1} of {totalPages}
                    </Typography>

                    <Tooltip title="Next Page">
                      <span>
                        <IconButton
                          size="small"
                          disabled={safePage >= totalPages - 1}
                          onClick={() => setPage(prev => Math.min(totalPages - 1, prev + 1))}
                          className="voucher-page-btn"
                        >
                          <NavigateNextIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Last Page">
                      <span>
                        <IconButton
                          size="small"
                          disabled={safePage >= totalPages - 1}
                          onClick={() => setPage(totalPages - 1)}
                          className="voucher-page-btn"
                        >
                          <LastPageIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                )}
              </Box>
            </Box>

            {/* Table Area: Displays up to 10 rows seamlessly */}
            <Box className="voucher-table-container">
              <table className="voucher-enterprise-table">
                <thead>
                  <tr>
                    <th style={{ width: 45, textAlign: 'center' }}>#</th>
                    <th style={{ width: 105 }}>Date</th>
                    <th style={{ width: 100 }}>Type</th>
                    <th style={{ width: 115 }}>Voucher No</th>
                    <th>Particulars & Transaction Details</th>
                    <th style={{ width: 130, textAlign: 'right' }}>Debit (₹)</th>
                    <th style={{ width: 130, textAlign: 'right' }}>Credit (₹)</th>
                    <th style={{ width: 100, textAlign: 'center' }}>Status</th>
                    <th style={{ width: 75, textAlign: 'center' }}>Posted</th>
                    <th style={{ width: 220, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedVouchers.map((voucher, index) => {
                    const absoluteIndex = rowsPerPage === 'All' ? index + 1 : safePage * effectiveRowsPerPage + index + 1;
                    const vType = voucher.voucher_type || 'Journal';

                    return (
                      <tr key={voucher.id}>
                        <td className="voucher-row-num">{absoluteIndex}</td>
                        <td className="voucher-row-date">{voucher.date}</td>
                        <td>
                          <span className={`voucher-type-badge voucher-type-${vType}`}>
                            {vType}
                          </span>
                        </td>
                        <td>
                          <span
                            className="voucher-row-no-link"
                            onClick={() => openDisplay(voucher.id)}
                            title="Click to view full double-entry postings"
                          >
                            {voucher.voucher_no}
                          </span>
                        </td>
                        <td style={{ maxWidth: 380 }}>
                          <Tooltip title={voucher.particulars_display || voucher.ledger_names || 'N/A'}>
                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: 700,
                                  color: '#0f172a',
                                  lineHeight: 1.3,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  fontSize: '13px'
                                }}
                              >
                                {voucher.primary_particular || voucher.ledger_names || 'General Ledger'}
                              </Typography>
                              {(voucher.secondary_particular || voucher.narration) && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: '#64748b',
                                    fontSize: '0.75rem',
                                    lineHeight: 1.2,
                                    mt: 0.2,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {voucher.secondary_particular || voucher.narration}
                                </Typography>
                              )}
                            </Box>
                          </Tooltip>
                        </td>
                        <td className="voucher-amount-debit">
                          {parseFloat(voucher.total_debit || 0) > 0 ? (
                            `₹${parseFloat(voucher.total_debit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                          ) : (
                            <span style={{ color: '#94a3b8' }}>-</span>
                          )}
                        </td>
                        <td className="voucher-amount-credit">
                          {parseFloat(voucher.total_credit || 0) > 0 ? (
                            `₹${parseFloat(voucher.total_credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                          ) : (
                            <span style={{ color: '#94a3b8' }}>-</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`voucher-status-chip voucher-status-${voucher.status || 'Approved'}`}>
                            {voucher.status || 'Approved'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {voucher.posted !== 0 ? (
                            <span style={{ color: '#16a34a', fontWeight: 800, fontSize: '12px' }}>Yes</span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: '12px' }}>No</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <Box className="voucher-actions-group">
                            <Tooltip title="View (Tally Style Details)">
                              <IconButton size="small" sx={{ color: '#1b5e20' }} className="voucher-action-icon-btn" onClick={() => openDisplay(voucher.id)}>
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Create Settlement Voucher for this Bill">
                              <IconButton
                                size="small"
                                sx={{ color: '#0284c7' }}
                                className="voucher-action-icon-btn"
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
                            <Tooltip title="Edit Voucher">
                              <IconButton size="small" color="primary" className="voucher-action-icon-btn" onClick={() => navigate(`/entry/voucher-create/${voucher.id}`)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Print Voucher">
                              <IconButton size="small" color="inherit" className="voucher-action-icon-btn" onClick={() => handlePrint(voucher.voucher_no)}>
                                <PrintIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Export PDF">
                              <IconButton size="small" sx={{ color: '#0284c7' }} className="voucher-action-icon-btn" onClick={() => handleDownloadPDF(voucher)}>
                                <PictureAsPdfIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Duplicate Voucher">
                              <IconButton size="small" color="secondary" className="voucher-action-icon-btn" onClick={() => handleDuplicateVoucher(voucher.id)}>
                                <ContentCopyIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Cancel Voucher">
                              <IconButton size="small" sx={{ color: '#d97706' }} className="voucher-action-icon-btn" onClick={() => handleCancelVoucher(voucher)}>
                                <CancelIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Voucher">
                              <IconButton size="small" color="error" className="voucher-action-icon-btn" onClick={() => deleteVoucher(voucher.id)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Box>

            {/* Bottom Period Total & Closing Balance Banner - Matching ERP screenshot format */}
            <Box className="voucher-totals-banner">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span className="voucher-totals-label">PERIOD TOTAL & REGISTER BALANCE:</span>
              </Box>

              <Box className="voucher-totals-figures">
                <Box className="voucher-total-block">
                  <span className="voucher-total-caption">Total Debit:</span>
                  <span className="voucher-total-num-debit">
                    ₹{totalDebitSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </Box>
                <Box className="voucher-total-block">
                  <span className="voucher-total-caption">Total Credit:</span>
                  <span className="voucher-total-num-credit">
                    ₹{totalCreditSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </Box>
                <Box className="voucher-total-block">
                  <span className="voucher-total-caption">Difference:</span>
                  <span className={`voucher-total-status-badge ${Math.abs(difference) < 0.01 ? 'voucher-total-balanced' : 'voucher-total-unbalanced'}`}>
                    ₹{difference.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    {Math.abs(difference) < 0.01 ? ' (Balanced ✔)' : ' (Unbalanced ❌)'}
                  </span>
                </Box>
                {Math.abs(difference) > 0.01 && (
                  <Button
                    size="small"
                    variant="contained"
                    onClick={handleReconcile}
                    disabled={reconciling}
                    sx={{
                      fontSize: '0.75rem',
                      py: 0.3,
                      px: 1.5,
                      bgcolor: '#f59e0b',
                      color: '#000',
                      fontWeight: 'bold',
                      textTransform: 'none',
                      '&:hover': { bgcolor: '#d97706' }
                    }}
                  >
                    {reconciling ? 'Balancing...' : '⚡ Balance Now'}
                  </Button>
                )}
              </Box>
            </Box>

            {/* Bottom Pagination Bar */}
            <Box className="voucher-pagination-toolbar" sx={{ borderTop: '1px solid #e2e8f0', borderBottom: 'none' }}>
              <Box className="voucher-pagination-info">
                <span>Showing <strong>{startRecord}</strong> to <strong>{endRecord}</strong> of <strong>{totalCount}</strong> vouchers</span>
              </Box>

              {rowsPerPage !== 'All' && totalPages > 1 && (
                <Box className="voucher-page-nav">
                  <Button
                    size="small"
                    disabled={safePage === 0}
                    onClick={() => setPage(0)}
                    className="voucher-page-btn"
                  >
                    First
                  </Button>
                  <Button
                    size="small"
                    disabled={safePage === 0}
                    onClick={() => setPage(prev => Math.max(0, prev - 1))}
                    className="voucher-page-btn"
                  >
                    Previous
                  </Button>
                  <Typography variant="body2" sx={{ fontWeight: 800, px: 1, color: '#1e293b', fontSize: '12px' }}>
                    Page {safePage + 1} of {totalPages}
                  </Typography>
                  <Button
                    size="small"
                    disabled={safePage >= totalPages - 1}
                    onClick={() => setPage(prev => Math.min(totalPages - 1, prev + 1))}
                    className="voucher-page-btn"
                  >
                    Next
                  </Button>
                  <Button
                    size="small"
                    disabled={safePage >= totalPages - 1}
                    onClick={() => setPage(totalPages - 1)}
                    className="voucher-page-btn"
                  >
                    Last
                  </Button>
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Box>

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
