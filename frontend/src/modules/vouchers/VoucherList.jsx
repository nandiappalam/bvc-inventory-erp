import React, { useState, useEffect } from 'react';
import {
  Container, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, Button, Box, TextField, Select, MenuItem, IconButton, Chip, Dialog,
  DialogContent, DialogActions, CircularProgress, Tooltip
} from '@mui/material';
import { Link, useNavigate } from 'react-router-dom';
import voucherAPI from './voucherService.js';
import { safeArray } from '../../utils/safeArray.js';

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
  const [vouchers, setVouchers] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    from_date: '',
    to_date: '',
    voucher_type: '',
    ledger_id: '',
    status: '',
    search: ''
  });

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
      alert('Could not fetch voucher details.');
      setDisplayOpen(false);
    } finally {
      setDisplayLoading(false);
    }
  };

  const handleCancelVoucher = async (voucher) => {
    if (window.confirm(`Are you sure you want to Cancel voucher ${voucher.voucher_no}?`)) {
      try {
        const fullData = await voucherAPI.get(voucher.id);
        const updated = {
          ...fullData,
          status: 'Cancelled',
          posted: 0 // Do not post cancelled voucher
        };
        await voucherAPI.update(voucher.id, updated);
        alert('Voucher cancelled successfully!');
        loadVouchers();
        if (displayOpen && displayVoucher?.id === voucher.id) {
          openDisplay(voucher.id);
        }
      } catch (err) {
        alert('Failed to cancel voucher: ' + err.message);
      }
    }
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
      alert('Failed to duplicate: ' + err.message);
    }
  };

  const deleteVoucher = async (id) => {
    if (window.confirm('Are you absolutely sure you want to delete this voucher from the ledger? This is an irreversible action.')) {
      try {
        await voucherAPI.delete(id);
        alert('Voucher deleted successfully');
        loadVouchers();
        setDisplayOpen(false);
      } catch (err) {
        alert('Delete failed: ' + err.message);
      }
    }
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
            window.print();
          }, 400);
        } catch (err) {
          console.error(err);
        } finally {
          setDisplayLoading(false);
        }
        return;
      }
    }
    window.print();
  };

  const handleDownloadPDF = async (voucher) => {
    if (voucher && (!displayVoucher || displayVoucher.id !== voucher.id)) {
      setDisplayLoading(true);
      setDisplayOpen(true);
      try {
        const fullData = await voucherAPI.get(voucher.id);
        setDisplayVoucher(fullData);
        setTimeout(() => {
          alert(`To download this voucher as a PDF, click OK, then select 'Save as PDF' or 'Print to PDF' as the Destination in the browser print dialog.`);
          window.print();
        }, 500);
      } catch (err) {
        console.error(err);
      } finally {
        setDisplayLoading(false);
      }
      return;
    }
    alert(`To download this voucher as a PDF, click OK, then select 'Save as PDF' or 'Print to PDF' as the Destination in the browser print dialog.`);
    window.print();
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

      {/* Classic Tally Green Terminal-Style Voucher Display Dialog */}
      <Dialog
        open={displayOpen}
        onClose={() => setDisplayOpen(false)}
        maxWidth="md"
        fullWidth
        id="voucher-print-area"
        PaperProps={{
          sx: {
            bgcolor: '#e8ebe6',
            color: '#1b3a1e',
            fontFamily: '"JetBrains Mono", Courier, monospace',
            border: '8px solid #4a5c4e',
            boxShadow: 24,
            borderRadius: 0
          }
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden !important;
            }
            #voucher-print-area, #voucher-print-area * {
              visibility: visible !important;
            }
            #voucher-print-area {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              background-color: #e8ebe6 !important;
              color: #1b3a1e !important;
              box-shadow: none !important;
              border: none !important;
            }
            .MuiDialogActions-root, button, .MuiButton-root, .MuiIconButton-root {
              display: none !important;
            }
          }
        ` }} />
        {displayLoading ? (
          <DialogContent sx={{ p: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, bgcolor: '#e8ebe6' }}>
            <CircularProgress color="success" />
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>Fetching Ledger Journal Entries...</Typography>
          </DialogContent>
        ) : displayVoucher ? (
          <>
            {/* Tally Terminal Banner */}
            <Box sx={{ bgcolor: '#2e4a36', color: '#fff', p: 1.5, textAlign: 'center', borderBottom: '2px solid #1b3a1e' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', letterSpacing: 2, fontSize: '0.8rem', fontFamily: 'monospace' }}>
                VIVEKA SOFTWARES, TRICHY-621216 | PHONE: 9994360045
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', color: '#a5d6a7', letterSpacing: 1, fontFamily: 'monospace' }}>
                Inventory Management System & Double Entry Financial Accounting Core
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', color: '#cfd8dc', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                A.S.MOORTHY & CO — FINANCIAL YEAR: 2026-2027
              </Typography>
            </Box>

            {/* Title Block */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 3, py: 1.5, bgcolor: '#3e6147', color: '#fff' }}>
              <Typography sx={{ fontWeight: 'bold', fontSize: '1.1rem', letterSpacing: 1, fontFamily: 'monospace' }}>
                VOUCHER DISPLAY
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Chip label={`Status: ${displayVoucher.status || 'Approved'}`} size="small" color="success" sx={{ color: '#fff', fontFamily: 'monospace', fontWeight: 'bold' }} />
                {displayVoucher.posted !== 0 && <Chip label="POSTED IN GENERAL LEDGER" size="small" color="primary" sx={{ color: '#fff', fontFamily: 'monospace', fontSize: '0.65rem' }} />}
              </Box>
            </Box>

            <DialogContent sx={{ p: 3, color: '#1b3a1e' }}>
              {/* Voucher Meta details */}
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2, mb: 3, borderBottom: '2px solid #1b3a1e', pb: 2 }}>
                <Box>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    <strong>Voucher No : </strong> {displayVoucher.voucher_no}
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 0.5 }}>
                    <strong>Vch. Type  : </strong> {displayVoucher.voucher_type}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    <strong>Date       : </strong> {displayVoucher.date}
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 0.5 }}>
                    <strong>Reference  : </strong> {displayVoucher.reference_no || 'N/A'}
                  </Typography>
                </Box>
              </Box>

              {/* Transactions Ledger Entry Table */}
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, fontFamily: 'monospace', textDecoration: 'underline' }}>
                Particulars / Double Entry Ledgers:
              </Typography>
              <TableContainer sx={{ border: '1px solid #1b3a1e', bgcolor: '#f1f3ef' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { bgcolor: '#cbd4c9', color: '#1b3a1e', fontWeight: 'bold', borderBottom: '1px solid #1b3a1e', fontFamily: 'monospace' } }}>
                      <TableCell style={{ width: 80 }}>Type</TableCell>
                      <TableCell>Particulars (Ledger Name)</TableCell>
                      <TableCell align="right" style={{ width: 130 }}>Debit (₹)</TableCell>
                      <TableCell align="right" style={{ width: 130 }}>Credit (₹)</TableCell>
                      <TableCell>Remarks</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody sx={{ '& td': { fontFamily: 'monospace', borderBottom: '1px solid #dcdfd9' } }}>
                    {safeArray(displayVoucher.entries).map((entry, index) => (
                      <TableRow key={index} sx={{ '&:last-child td': { borderBottom: 'none' } }}>
                        <TableCell>
                          <strong style={{ color: entry.type === 'Dr' ? '#b71c1c' : '#1b5e20' }}>
                            {entry.type}
                          </strong>
                        </TableCell>
                        <TableCell>
                          <strong>{entry.ledger_name}</strong>
                        </TableCell>
                        <TableCell align="right">
                          {entry.debit > 0 ? `₹${parseFloat(entry.debit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                        </TableCell>
                        <TableCell align="right">
                          {entry.credit > 0 ? `₹${parseFloat(entry.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                        </TableCell>
                        <TableCell>{entry.remarks || '-'}</TableCell>
                      </TableRow>
                    ))}

                    {/* double underline standard totals row */}
                    <TableRow sx={{ bgcolor: '#cbd4c9', '& td': { fontWeight: 'bold', borderTop: '2px double #1b3a1e', borderBottom: '2px double #1b3a1e' } }}>
                      <TableCell colSpan={2} align="right">
                        <strong>TOTAL:</strong>
                      </TableCell>
                      <TableCell align="right">
                        ₹{parseFloat(displayVoucher.total_debit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell align="right">
                        ₹{parseFloat(displayVoucher.total_credit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <strong style={{ color: '#1b5e20' }}>Balanced ✔</strong>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Narration Box */}
              <Box sx={{ mt: 3, p: 2, border: '1px solid #1b3a1e', bgcolor: '#f8f9f6', minHeight: 60 }}>
                <Typography variant="caption" display="block" sx={{ fontWeight: 'bold', color: '#4a5c4e', fontFamily: 'monospace' }}>
                  NARRATION / REMARKS:
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {displayVoucher.narration || 'No narration provided for this double entry transaction.'}
                </Typography>
              </Box>
            </DialogContent>
          </>
        ) : (
          <DialogContent sx={{ p: 3, textAlign: 'center' }}>
            <Typography sx={{ fontFamily: 'monospace' }}>No voucher data loaded.</Typography>
          </DialogContent>
        )}

        <DialogActions sx={{ p: 3, bgcolor: '#cbd4c9', gap: 1, borderTop: '1px solid #1b3a1e', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              color="success"
              startIcon={<PrintIcon />}
              onClick={() => handlePrint(displayVoucher?.voucher_no)}
              sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}
            >
              Print 🖨
            </Button>
            <Button
              variant="contained"
              color="info"
              startIcon={<PictureAsPdfIcon />}
              onClick={() => handleDownloadPDF(displayVoucher)}
              sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}
            >
              PDF 📄
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<EditIcon />}
              onClick={() => {
                if (displayVoucher) navigate(`/entry/voucher-create/${displayVoucher.id}`);
              }}
              sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}
            >
              Edit ✏️
            </Button>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<ContentCopyIcon />}
              onClick={() => {
                if (displayVoucher) handleDuplicateVoucher(displayVoucher.id);
              }}
              sx={{ fontFamily: 'monospace', fontWeight: 'bold', bgcolor: '#fff' }}
            >
              Duplicate
            </Button>
            {displayVoucher && displayVoucher.status !== 'Cancelled' && (
              <Button
                variant="outlined"
                color="warning"
                startIcon={<CancelIcon />}
                onClick={() => handleCancelVoucher(displayVoucher)}
                sx={{ fontFamily: 'monospace', fontWeight: 'bold', bgcolor: '#fff' }}
              >
                Cancel ❌
              </Button>
            )}
            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => {
                if (displayVoucher) deleteVoucher(displayVoucher.id);
              }}
              sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}
            >
              Delete 🗑
            </Button>
          </Box>
          <Button
            variant="contained"
            color="inherit"
            onClick={() => setDisplayOpen(false)}
            sx={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#fff', bgcolor: '#2e3b4e', '&:hover': { bgcolor: '#1a2332' } }}
          >
            Close Escape
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VoucherList;
