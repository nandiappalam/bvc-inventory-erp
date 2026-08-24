import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  MenuItem,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Tooltip,
  Snackbar,
  Alert,
  Divider,
  Stack
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  RestartAlt as ResetIcon,
  GetApp as ExcelIcon,
  PictureAsPdf as PdfIcon,
  Print as PrintIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  CheckCircle as ApprovedIcon,
  HourglassTop as PendingIcon,
  Cancel as RejectedIcon,
  AssignmentReturn as ReturnedIcon,
  Close as CloseIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { printHtml } from '../../utils/printHelper';
import { exportToExcel as exportExcelUtil, printTableList } from '../../utils/exportHelper';

const DEPARTMENTS = [
  'Raw Materials',
  'Packaging Materials',
  'Production',
  'Maintenance & Engineering',
  'Quality Control',
  'Stores & Warehouse',
  'Office & Administration',
  'Electrical & Utilities',
  'General'
];

const STATUSES = ['Draft', 'Submitted', 'Approved', 'Rejected', 'Returned', 'Converted'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

const PurchaseRequestDisplay = () => {
  const navigate = useNavigate();

  // Filter States
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [department, setDepartment] = useState('');
  const [requestedBy, setRequestedBy] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [search, setSearch] = useState('');
  const [supplierId, setSupplierId] = useState('');

  // Data States
  const [requests, setRequests] = useState([]);
  const [suppliersList, setSuppliersList] = useState([]);
  const [loading, setLoading] = useState(false);

  // View Details Dialog State
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedPr, setSelectedPr] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Snackbar State
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  useEffect(() => {
    fetchSuppliers();
    fetchRequests();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/masters/all/suppliers');
      const data = await res.json();
      setSuppliersList(Array.isArray(data) ? data : (data.data || []));
    } catch (e) {
      console.log('Error loading suppliers:', e);
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (dateFrom) queryParams.append('dateFrom', dateFrom);
      if (dateTo) queryParams.append('dateTo', dateTo);
      if (department) queryParams.append('department', department);
      if (requestedBy) queryParams.append('requested_by', requestedBy);
      if (status) queryParams.append('status', status);
      if (priority) queryParams.append('priority', priority);
      if (supplierId) queryParams.append('supplier_id', supplierId);
      if (search) queryParams.append('search', search);

      const res = await fetch(`/api/purchase-requests?${queryParams.toString()}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setRequests(data);
      } else {
        setRequests([]);
      }
    } catch (err) {
      console.error('Error fetching PRs:', err);
      setSnackbar({ open: true, message: 'Error loading purchase requests', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setDepartment('');
    setRequestedBy('');
    setStatus('');
    setPriority('');
    setSearch('');
    setSupplierId('');
    setTimeout(() => {
      fetchRequests();
    }, 50);
  };

  const handleViewPr = async (id) => {
    setViewDialogOpen(true);
    setLoadingDetails(true);
    try {
      const res = await fetch(`/api/purchase-requests/${id}`);
      const data = await res.json();
      if (res.ok) {
        // Fetch item master for fallback item name resolution
        let masterItems = [];
        try {
          const mRes = await fetch('/api/masters/item');
          if (mRes.ok) {
            masterItems = await mRes.json();
          }
        } catch (e) {
          console.log('Notice master item fetch:', e.message);
        }

        const resolvedItems = (data.items || []).map(it => {
          let name = it.item_name;
          if (!name || !isNaN(name)) {
            const matched = masterItems.find(m => String(m.id) === String(it.item_id) || String(m.id) === String(it.item_name) || String(m.id) === String(name));
            if (matched) {
              name = matched.item_name || matched.name;
            } else if (it.item_code) {
              name = `Item (${it.item_code})`;
            } else {
              name = `Item #${it.item_id || it.id}`;
            }
          }
          return {
            ...it,
            item_name: name
          };
        });

        setSelectedPr({
          ...data,
          items: resolvedItems
        });
      } else {
        throw new Error(data.error || 'Failed to load details');
      }
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleDeletePr = async (id, prNo) => {
    if (!window.confirm(`Are you sure you want to delete Purchase Request ${prNo}?`)) return;

    try {
      const res = await fetch(`/api/purchase-requests/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setSnackbar({ open: true, message: data.message || 'Deleted successfully', severity: 'success' });
        fetchRequests();
      } else {
        throw new Error(data.error || 'Delete failed');
      }
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  const handleCopyPr = async (id) => {
    try {
      const res = await fetch(`/api/purchase-requests/${id}/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (res.ok) {
        setSnackbar({ open: true, message: `Copied successfully as ${data.pr_no}`, severity: 'success' });
        fetchRequests();
      } else {
        throw new Error(data.error || 'Copy failed');
      }
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  const handlePrintPr = (prData) => {
    if (!prData) return;
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <div style="text-align: center; border-bottom: 2px solid #1f4fb2; padding-bottom: 10px; margin-bottom: 20px;">
          <h2 style="color: #1f4fb2; margin: 0;">BVC ERP INVENTORY SYSTEM</h2>
          <h3 style="margin: 5px 0 0 0; color: #333;">PURCHASE REQUEST / REQUISITION</h3>
        </div>

        <table style="width: 100%; margin-bottom: 20px; font-size: 14px; border-collapse: collapse;">
          <tr>
            <td><strong>PR No:</strong> ${prData.pr_no}</td>
            <td><strong>Request Date:</strong> ${prData.request_date}</td>
            <td><strong>Required Date:</strong> ${prData.required_date || 'N/A'}</td>
          </tr>
          <tr>
            <td><strong>Department:</strong> ${prData.department || 'N/A'}</td>
            <td><strong>Requested By:</strong> ${prData.requested_by || 'N/A'}</td>
            <td><strong>Priority:</strong> ${prData.priority}</td>
          </tr>
          <tr>
            <td><strong>Preferred Supplier:</strong> ${prData.supplier_name || 'N/A'}</td>
            <td><strong>Godown:</strong> ${prData.godown_name || 'Main Godown'}</td>
            <td><strong>Status:</strong> ${prData.status}</td>
          </tr>
          ${prData.remarks ? `<tr><td colspan="3" style="padding-top: 8px;"><strong>Remarks:</strong> ${prData.remarks}</td></tr>` : ''}
        </table>

        <h4>Requested Items</h4>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;" border="1" cellpadding="6">
          <thead style="background-color: #f0f4fa;">
            <tr>
              <th>S.No</th>
              <th>Item Name</th>
              <th>Description</th>
              <th>Requested Qty</th>
              <th>Approved Qty</th>
              <th>Unit</th>
              <th>Est. Rate (₹)</th>
              <th>Est. Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${(prData.items || []).map((it, idx) => `
              <tr>
                <td style="text-align: center;">${idx + 1}</td>
                <td>${it.item_name}</td>
                <td>${it.description || ''}</td>
                <td style="text-align: right;">${it.requested_qty}</td>
                <td style="text-align: right;">${it.approved_qty}</td>
                <td>${it.unit}</td>
                <td style="text-align: right;">₹${(it.estimated_rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td style="text-align: right;">₹${(it.estimated_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        ${prData.approval_remarks ? `<p><strong>Approval Remarks:</strong> ${prData.approval_remarks}</p>` : ''}

        <div style="margin-top: 50px; display: flex; justify-content: space-between; padding: 0 30px;">
          <div style="text-align: center;">
            <p>____________________</p>
            <p>Requested By</p>
          </div>
          <div style="text-align: center;">
            <p>____________________</p>
            <p>Department Head</p>
          </div>
          <div style="text-align: center;">
            <p>____________________</p>
            <p>Authorized Signatory</p>
          </div>
        </div>
      </div>
    `;
    printHtml(html);
  };

  const handlePrintTableList = () => {
    if (requests.length === 0) {
      setSnackbar({ open: true, message: 'No records to print', severity: 'warning' });
      return;
    }
    const cols = [
      { key: 'pr_no', title: 'PR No' },
      { key: 'item_names', title: 'Item Name(s)' },
      { key: 'request_date', title: 'Request Date' },
      { key: 'required_date', title: 'Required Date' },
      { key: 'department', title: 'Department' },
      { key: 'requested_by', title: 'Requested By' },
      { key: 'priority', title: 'Priority' },
      { key: 'total_items', title: 'Items' },
      { key: 'total_qty', title: 'Total Qty' },
      { key: 'total_amount', title: 'Total Amount (₹)' },
      { key: 'status', title: 'Status' }
    ];
    printTableList('Purchase Requests List', cols, requests);
  };

  const exportToExcel = () => {
    if (requests.length === 0) {
      setSnackbar({ open: true, message: 'No records to export', severity: 'warning' });
      return;
    }
    const cols = [
      { key: 'pr_no', title: 'PR No' },
      { key: 'item_names', title: 'Item Name(s)' },
      { key: 'request_date', title: 'Request Date' },
      { key: 'required_date', title: 'Required Date' },
      { key: 'department', title: 'Department' },
      { key: 'requested_by', title: 'Requested By' },
      { key: 'priority', title: 'Priority' },
      { key: 'total_items', title: 'Items' },
      { key: 'total_qty', title: 'Total Qty' },
      { key: 'total_amount', title: 'Total Amount' },
      { key: 'status', title: 'Status' }
    ];
    exportExcelUtil(requests, 'Purchase_Requests', cols);
  };

  const getStatusChip = (st) => {
    switch (st) {
      case 'Approved':
        return <Chip icon={<ApprovedIcon />} label="Approved" color="success" size="small" sx={{ fontWeight: 'bold' }} />;
      case 'Submitted':
        return <Chip icon={<PendingIcon />} label="Submitted" color="warning" size="small" sx={{ fontWeight: 'bold' }} />;
      case 'Rejected':
        return <Chip icon={<RejectedIcon />} label="Rejected" color="error" size="small" sx={{ fontWeight: 'bold' }} />;
      case 'Returned':
        return <Chip icon={<ReturnedIcon />} label="Returned" color="secondary" size="small" sx={{ fontWeight: 'bold' }} />;
      case 'Converted':
        return <Chip label="Converted" color="primary" size="small" sx={{ fontWeight: 'bold' }} />;
      default:
        return <Chip label={st || 'Draft'} variant="outlined" size="small" sx={{ fontWeight: 'bold' }} />;
    }
  };

  const getPriorityColor = (p) => {
    switch (p) {
      case 'Urgent': return '#f44336';
      case 'High': return '#ff9800';
      case 'Medium': return '#2196f3';
      default: return '#4caf50';
    }
  };

  return (
    <Box sx={{ p: 2, backgroundColor: '#f4f6f9', minHeight: '100vh' }}>
      {/* Page Header */}
      <Paper
        elevation={2}
        sx={{
          p: 2,
          mb: 3,
          backgroundColor: '#1f4fb2',
          color: '#ffffff',
          borderRadius: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Purchase Request Registry & Display
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.9 }}>
            Search, Filter, Track & Manage all internal Purchase Requests
          </Typography>
        </Box>
        <Button
          variant="contained"
          sx={{ backgroundColor: '#ffffff', color: '#1f4fb2', fontWeight: 'bold', '&:hover': { backgroundColor: '#eaf2fb' } }}
          startIcon={<AddIcon />}
          onClick={() => navigate('/entry/purchase-request-create')}
        >
          Create New PR
        </Button>
      </Paper>

      {/* Filter Panel Card */}
      <Card elevation={2} sx={{ mb: 3, borderRadius: 1.5 }}>
        <CardContent>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2, color: '#1f4fb2', display: 'flex', alignItems: 'center', gap: 1 }}>
            <FilterIcon fontSize="small" /> Filter Panel
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                label="Date From"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <TextField
                label="Date To"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <TextField
                select
                label="Department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                fullWidth
                size="small"
              >
                <MenuItem value="">-- All Departments --</MenuItem>
                {DEPARTMENTS.map(d => (
                  <MenuItem key={d} value={d}>{d}</MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <TextField
                select
                label="Status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                fullWidth
                size="small"
              >
                <MenuItem value="">-- All Statuses --</MenuItem>
                {STATUSES.map(s => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <TextField
                select
                label="Priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                fullWidth
                size="small"
              >
                <MenuItem value="">-- All Priorities --</MenuItem>
                {PRIORITIES.map(p => (
                  <MenuItem key={p} value={p}>{p}</MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <TextField
                label="Search Text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                fullWidth
                size="small"
                placeholder="PR No, Requester, Supplier"
              />
            </Grid>
          </Grid>

          <Box sx={{ display: 'flex', gap: 1.5, mt: 2, justifyContent: 'flex-end' }}>
            <Button variant="outlined" color="secondary" startIcon={<ResetIcon />} onClick={handleResetFilters}>
              Reset
            </Button>

            <Button variant="contained" startIcon={<SearchIcon />} onClick={fetchRequests} sx={{ backgroundColor: '#1f4fb2' }}>
              Search
            </Button>

            <Button variant="outlined" color="success" startIcon={<ExcelIcon />} onClick={exportToExcel} sx={{ fontWeight: 'bold' }}>
              Export Excel
            </Button>

            <Button variant="outlined" color="primary" startIcon={<PrintIcon />} onClick={handlePrintTableList} sx={{ fontWeight: 'bold' }}>
              Print List
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card elevation={2} sx={{ borderRadius: 1.5 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
              Purchase Requests List ({requests.length})
            </Typography>
          </Box>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead sx={{ backgroundColor: '#0f172a' }}>
                <TableRow>
                  <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13px', textAlign: 'center', width: '55px', borderRight: '1px solid #334155' }}>S.No</TableCell>
                  <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13px', borderRight: '1px solid #334155' }}>PR No</TableCell>
                  <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13px', borderRight: '1px solid #334155' }}>Item Name(s)</TableCell>
                  <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13px', borderRight: '1px solid #334155' }}>Description / Details</TableCell>
                  <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13px', borderRight: '1px solid #334155' }}>Req Date</TableCell>
                  <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13px', borderRight: '1px solid #334155' }}>Department</TableCell>
                  <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13px', borderRight: '1px solid #334155' }}>Requested By</TableCell>
                  <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13px', borderRight: '1px solid #334155' }}>Priority</TableCell>
                  <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13px', borderRight: '1px solid #334155' }}>Items</TableCell>
                  <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13px', borderRight: '1px solid #334155' }}>Total Qty</TableCell>
                  <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13px', borderRight: '1px solid #334155' }}>Est. Value (₹)</TableCell>
                  <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13px', borderRight: '1px solid #334155' }}>Status</TableCell>
                  <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13px', textAlign: 'center' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={13} align="center" sx={{ py: 3 }}>
                      <CircularProgress size={30} />
                      <Typography variant="body2" sx={{ mt: 1 }}>Loading purchase requests...</Typography>
                    </TableCell>
                  </TableRow>
                ) : requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No purchase requests found matching the criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  requests.map((r, rIdx) => (
                    <TableRow key={r.id} hover sx={{ '&:nth-of-type(even)': { backgroundColor: '#f8fafc' } }}>
                      <TableCell sx={{ textAlign: 'center', fontWeight: '700', color: '#475569', fontSize: '13px' }}>{rIdx + 1}</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#0284c7', fontSize: '13px' }}>{r.pr_no}</TableCell>
                      <TableCell sx={{ fontWeight: '600', color: '#0f172a', fontSize: '13px' }}>{r.item_names || r.item_name || '—'}</TableCell>
                      <TableCell sx={{ color: '#475569', fontSize: '13px' }}>{r.descriptions || r.description || '—'}</TableCell>
                      <TableCell sx={{ fontSize: '13px', color: '#334155' }}>{r.request_date}</TableCell>
                      <TableCell sx={{ fontSize: '13px', color: '#334155' }}>{r.department || 'General'}</TableCell>
                      <TableCell sx={{ fontSize: '13px', color: '#334155' }}>{r.requested_by || 'Admin'}</TableCell>
                      <TableCell>
                        <Chip
                          label={r.priority}
                          size="small"
                          sx={{
                            backgroundColor: getPriorityColor(r.priority),
                            color: '#fff',
                            fontWeight: 'bold',
                            fontSize: '11px',
                            height: 22
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: '13px', color: '#334155' }}>{r.total_items || 0}</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', fontSize: '13px', color: '#0f172a' }}>{(r.total_qty || 0).toLocaleString('en-IN')}</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#0284c7', fontSize: '13px' }}>
                        ₹{(r.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>{getStatusChip(r.status)}</TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
                          {r.status === 'Approved' && (
                            <Tooltip title="Create Purchase Order for this Request">
                              <Button
                                variant="contained"
                                color="success"
                                size="small"
                                onClick={() => navigate(`/entry/purchase-order-create?pr_id=${r.id}`)}
                                sx={{ fontSize: '11px', px: 1, py: 0.2, minWidth: 'auto', textTransform: 'none', fontWeight: 'bold' }}
                              >
                                + PO
                              </Button>
                            </Tooltip>
                          )}
                          <Tooltip title="View Details">
                            <IconButton size="small" color="primary" onClick={() => handleViewPr(r.id)}>
                              <ViewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          {(r.status === 'Draft' || r.status === 'Returned') && (
                            <Tooltip title="Edit PR">
                              <IconButton size="small" color="secondary" onClick={() => navigate(`/entry/purchase-request-create?id=${r.id}`)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}

                          {(r.status === 'Draft' || r.status === 'Returned') && (
                            <Tooltip title="Delete PR">
                              <IconButton size="small" color="error" onClick={() => handleDeletePr(r.id, r.pr_no)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}

                          <Tooltip title="Copy PR">
                            <IconButton size="small" color="info" onClick={() => handleCopyPr(r.id)}>
                              <CopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* PR Details View Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle component="div" sx={{ backgroundColor: '#1f4fb2', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Purchase Request Details — {selectedPr?.pr_no}
          </Typography>
          <IconButton color="inherit" onClick={() => setViewDialogOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 3 }}>
          {loadingDetails || !selectedPr ? (
            <Box sx={{ textAlignment: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box>
              {/* Header Details */}
              <Grid container spacing={2} sx={{ mb: 3, p: 2, backgroundColor: '#f8f9fa', borderRadius: 1 }}>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">PR Number</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>{selectedPr.pr_no}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Request Date</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>{selectedPr.request_date}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Required Date</Typography>
                  <Typography variant="subtitle2">{selectedPr.required_date || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Department</Typography>
                  <Typography variant="subtitle2">{selectedPr.department}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Requested By</Typography>
                  <Typography variant="subtitle2">{selectedPr.requested_by}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Priority</Typography>
                  <Typography variant="subtitle2">{selectedPr.priority}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Preferred Supplier</Typography>
                  <Typography variant="subtitle2">{selectedPr.supplier_name || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Destination Godown</Typography>
                  <Typography variant="subtitle2">{selectedPr.godown_name || 'Main Godown'}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">Status</Typography>
                  <Box sx={{ mt: 0.5 }}>{getStatusChip(selectedPr.status)}</Box>
                </Grid>
                {selectedPr.remarks && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">Remarks</Typography>
                    <Typography variant="body2">{selectedPr.remarks}</Typography>
                  </Grid>
                )}
              </Grid>

              {/* Items List */}
              <Typography variant="subtitle1" sx={{ fontWeight: '800', mb: 1, color: '#0f2942', display: 'flex', alignItems: 'center', gap: 1 }}>
                📦 Requested Items Breakdown
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, borderRadius: 1.5, overflow: 'hidden' }}>
                <Table size="small">
                  <TableHead sx={{ backgroundColor: '#0f172a' }}>
                    <TableRow>
                      <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13px', textAlign: 'center', width: '55px', borderRight: '1px solid #334155' }}>S.No</TableCell>
                      <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13px', borderRight: '1px solid #334155' }}>Item Name</TableCell>
                      <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13px', borderRight: '1px solid #334155' }}>Weight</TableCell>
                      <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13px', borderRight: '1px solid #334155' }}>Description / Specs</TableCell>
                      <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13px', borderRight: '1px solid #334155' }}>Req Qty</TableCell>
                      <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13px', borderRight: '1px solid #334155' }}>App Qty</TableCell>
                      <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13px', borderRight: '1px solid #334155' }}>Unit</TableCell>
                      <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13px', borderRight: '1px solid #334155' }}>Est Rate (₹)</TableCell>
                      <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13px' }}>Est Amount (₹)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(selectedPr.items || []).map((it, idx) => (
                      <TableRow key={idx} hover sx={{ '&:nth-of-type(even)': { backgroundColor: '#f8fafc' } }}>
                        <TableCell sx={{ textAlign: 'center', fontWeight: '700', color: '#475569', fontSize: '13px' }}>{idx + 1}</TableCell>
                        <TableCell sx={{ fontWeight: '700', color: '#0f172a', fontSize: '13px' }}>{it.item_name}</TableCell>
                        <TableCell sx={{ fontSize: '13px', color: '#334155' }}>{it.weight || '—'}</TableCell>
                        <TableCell sx={{ fontSize: '13px', color: '#475569' }}>{it.description || '—'}</TableCell>
                        <TableCell sx={{ fontWeight: '600', color: '#0284c7', fontSize: '13px' }}>{it.requested_qty}</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: '#16a34a', fontSize: '13px' }}>{it.approved_qty || it.requested_qty}</TableCell>
                        <TableCell sx={{ fontSize: '13px', color: '#334155' }}>{it.unit || 'kg'}</TableCell>
                        <TableCell sx={{ fontSize: '13px', color: '#334155' }}>₹{(it.estimated_rate || 0).toFixed(2)}</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: '#0284c7', fontSize: '13px' }}>₹{(it.estimated_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Approval History */}
              <Typography variant="subtitle1" sx={{ fontWeight: '800', mb: 1, color: '#0f2942', display: 'flex', alignItems: 'center', gap: 1 }}>
                🕒 Approval Audit Trail
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5, overflow: 'hidden' }}>
                <Table size="small">
                  <TableHead sx={{ backgroundColor: '#0f172a' }}>
                    <TableRow>
                      <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13px', borderRight: '1px solid #334155' }}>Date & Time</TableCell>
                      <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13px', borderRight: '1px solid #334155' }}>Action</TableCell>
                      <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13px', borderRight: '1px solid #334155' }}>Performed By</TableCell>
                      <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13px' }}>Remarks</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(selectedPr.approval_history || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 2, color: '#64748b' }}>No history recorded.</TableCell>
                      </TableRow>
                    ) : (
                      selectedPr.approval_history.map((h, idx) => (
                        <TableRow key={idx} hover sx={{ '&:nth-of-type(even)': { backgroundColor: '#f8fafc' } }}>
                          <TableCell sx={{ fontSize: '13px', color: '#334155' }}>{h.performed_at}</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', color: '#0284c7', fontSize: '13px' }}>{h.action}</TableCell>
                          <TableCell sx={{ fontSize: '13px', color: '#334155' }}>{h.performed_by}</TableCell>
                          <TableCell sx={{ fontSize: '13px', color: '#475569' }}>{h.remarks}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button startIcon={<PrintIcon />} variant="outlined" onClick={() => handlePrintPr(selectedPr)}>
              Print PR
            </Button>
            {(selectedPr?.status === 'Approved' || selectedPr?.status === 'Converted') && (
              <Button
                variant="contained"
                color="success"
                onClick={() => {
                  setViewDialogOpen(false);
                  navigate(`/entry/purchase-order-create?pr_id=${selectedPr.id}`);
                }}
                sx={{ fontWeight: 'bold' }}
              >
                Create Purchase Order ➔
              </Button>
            )}
          </Box>
          <Button variant="contained" onClick={() => setViewDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default PurchaseRequestDisplay;
