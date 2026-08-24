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
  Snackbar,
  Alert,
  Tooltip,
  Divider,
  Stack
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Undo as ReturnIcon,
  Search as SearchIcon,
  RestartAlt as ResetIcon,
  FilterList as FilterIcon,
  RateReview as ReviewIcon,
  Close as CloseIcon,
  Verified as ManagerIcon,
  ShoppingCart as PoIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

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

const PurchaseRequestApproval = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [department, setDepartment] = useState('');
  const [requester, setRequester] = useState('');
  const [priority, setPriority] = useState('');
  const [statusFilter, setStatusFilter] = useState('Submitted');

  // List & State
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  // Review Dialog State
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedPr, setSelectedPr] = useState(null);
  const [itemApprovals, setItemApprovals] = useState([]);
  const [managerRemarks, setManagerRemarks] = useState('');
  const [processingAction, setProcessingAction] = useState(false);

  // Snackbar State
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  useEffect(() => {
    fetchPendingRequests();
  }, [statusFilter]);

  const fetchPendingRequests = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (dateFrom) queryParams.append('dateFrom', dateFrom);
      if (dateTo) queryParams.append('dateTo', dateTo);
      if (department) queryParams.append('department', department);
      if (requester) queryParams.append('requested_by', requester);
      if (priority) queryParams.append('priority', priority);
      if (statusFilter) queryParams.append('status', statusFilter);

      const res = await fetch(`/api/purchase-requests?${queryParams.toString()}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setRequests(data);
      } else {
        setRequests([]);
      }
    } catch (err) {
      console.error('Error fetching pending PRs:', err);
      setSnackbar({ open: true, message: 'Failed to load requests for approval', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReview = async (id) => {
    setReviewDialogOpen(true);
    setManagerRemarks('');
    try {
      const res = await fetch(`/api/purchase-requests/${id}`);
      const data = await res.json();
      if (res.ok) {
        setSelectedPr(data);
        
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

        setItemApprovals((data.items || []).map(it => {
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
            id: it.id,
            item_name: name,
            requested_qty: it.requested_qty,
            approved_qty: it.approved_qty || it.requested_qty,
            unit: it.unit,
            estimated_rate: it.estimated_rate
          };
        }));
      } else {
        throw new Error(data.error || 'Failed to fetch details');
      }
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
      setReviewDialogOpen(false);
    }
  };

  const handleApprovedQtyChange = (index, value) => {
    const updated = [...itemApprovals];
    updated[index].approved_qty = parseFloat(value) || 0;
    setItemApprovals(updated);
  };

  const handleAction = async (actionType) => {
    if (!selectedPr) return;

    if ((actionType === 'reject' || actionType === 'return') && !managerRemarks.trim()) {
      setSnackbar({ open: true, message: 'Manager Remarks are mandatory for Reject or Return action', severity: 'warning' });
      return;
    }

    setProcessingAction(true);
    try {
      const endpoint = `/api/purchase-requests/${selectedPr.id}/${actionType}`;
      const payload = {
        approved_by: user?.username || 'Manager',
        rejected_by: user?.username || 'Manager',
        returned_by: user?.username || 'Manager',
        approval_remarks: managerRemarks,
        remarks: managerRemarks,
        item_approvals: itemApprovals
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Operation failed');
      }

      setSnackbar({ open: true, message: data.message || `PR ${actionType}ed successfully`, severity: 'success' });
      setReviewDialogOpen(false);
      fetchPendingRequests();
    } catch (err) {
      console.error(`Error during ${actionType}:`, err);
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    } finally {
      setProcessingAction(false);
    }
  };

  const getPriorityChip = (p) => {
    let color = 'default';
    if (p === 'Urgent') color = 'error';
    if (p === 'High') color = 'warning';
    if (p === 'Medium') color = 'info';
    return <Chip label={p} size="small" color={color} sx={{ fontWeight: 'bold' }} />;
  };

  return (
    <Box sx={{ p: 2, backgroundColor: '#f4f6f9', minHeight: '100vh' }}>
      {/* Header Bar */}
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ManagerIcon sx={{ fontSize: 30 }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Purchase Request Approval Portal
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>
              Manager Review & Authorization Workbench
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Filter Panel */}
      <Card elevation={2} sx={{ mb: 3, borderRadius: 1.5 }}>
        <CardContent>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2, color: '#1f4fb2', display: 'flex', alignItems: 'center', gap: 1 }}>
            <FilterIcon fontSize="small" /> Pending Approvals Filter
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
                <MenuItem value="">-- All --</MenuItem>
                {DEPARTMENTS.map(d => (
                  <MenuItem key={d} value={d}>{d}</MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <TextField
                label="Requester"
                value={requester}
                onChange={(e) => setRequester(e.target.value)}
                fullWidth
                size="small"
              />
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
                <MenuItem value="">-- All --</MenuItem>
                <MenuItem value="Urgent">Urgent</MenuItem>
                <MenuItem value="High">High</MenuItem>
                <MenuItem value="Medium">Medium</MenuItem>
                <MenuItem value="Low">Low</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <TextField
                select
                label="Status Filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                fullWidth
                size="small"
              >
                <MenuItem value="Submitted">Submitted (Pending)</MenuItem>
                <MenuItem value="Approved">Approved</MenuItem>
                <MenuItem value="Rejected">Rejected</MenuItem>
                <MenuItem value="Returned">Returned</MenuItem>
                <MenuItem value="">All Statuses</MenuItem>
              </TextField>
            </Grid>
          </Grid>

          <Box sx={{ display: 'flex', gap: 1.5, mt: 2, justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<ResetIcon />}
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setDepartment('');
                setRequester('');
                setPriority('');
                setStatusFilter('Submitted');
              }}
            >
              Reset
            </Button>
            <Button variant="contained" startIcon={<SearchIcon />} onClick={fetchPendingRequests} sx={{ backgroundColor: '#1f4fb2' }}>
              Filter
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Requests Waiting Approval Table */}
      <Card elevation={2} sx={{ borderRadius: 1.5 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>
            Purchase Requisitions Pending Action ({requests.length})
          </Typography>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead sx={{ backgroundColor: '#1f4fb2' }}>
                <TableRow>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>PR No</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Item Name(s)</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Department</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Requested By</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Priority</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Req Date</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Required Date</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Items</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Est. Value (₹)</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Status</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold', textAlign: 'center' }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={11} align="center" sx={{ py: 3 }}>
                      <CircularProgress size={30} />
                      <Typography variant="body2" sx={{ mt: 1 }}>Loading pending requisitions...</Typography>
                    </TableCell>
                  </TableRow>
                ) : requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No purchase requests waiting for approval under selected criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  requests.map(r => (
                    <TableRow key={r.id} hover sx={{ backgroundColor: r.priority === 'Urgent' ? '#fff8f8' : 'inherit' }}>
                      <TableCell sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>{r.pr_no}</TableCell>
                      <TableCell sx={{ fontWeight: '500', color: '#1e293b' }}>{r.item_names || r.item_name || '—'}</TableCell>
                      <TableCell>{r.department || 'General'}</TableCell>
                      <TableCell>{r.requested_by || 'Admin'}</TableCell>
                      <TableCell>{getPriorityChip(r.priority)}</TableCell>
                      <TableCell>{r.request_date}</TableCell>
                      <TableCell>{r.required_date || 'N/A'}</TableCell>
                      <TableCell>{r.total_items || 0}</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>₹{(r.total_amount || 0).toLocaleString('en-IN')}</TableCell>
                      <TableCell>
                        <Chip label={r.status} color={r.status === 'Submitted' ? 'warning' : 'default'} size="small" />
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={1} justifyContent="center">
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<ReviewIcon />}
                            onClick={() => handleOpenReview(r.id)}
                            sx={{ backgroundColor: '#1f4fb2', textTransform: 'none' }}
                          >
                            Review & Act
                          </Button>
                          {(r.status === 'Approved' || r.status === 'Converted') && (
                            <Button
                              variant="contained"
                              color="success"
                              size="small"
                              startIcon={<PoIcon />}
                              onClick={() => navigate(`/entry/purchase-order-create?pr_id=${r.id}`)}
                              sx={{ textTransform: 'none', fontWeight: 'bold' }}
                            >
                              Create PO
                            </Button>
                          )}
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

      {/* Review & Approval Modal */}
      <Dialog open={reviewDialogOpen} onClose={() => setReviewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle component="div" sx={{ backgroundColor: '#1f4fb2', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Manager Review — Purchase Request {selectedPr?.pr_no}
          </Typography>
          <IconButton color="inherit" onClick={() => setReviewDialogOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 3 }}>
          {selectedPr && (
            <Box>
              {/* Request Overview */}
              <Grid container spacing={2} sx={{ mb: 3, p: 2, backgroundColor: '#f0f4fa', borderRadius: 1 }}>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">PR Number</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>{selectedPr.pr_no}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Request Date</Typography>
                  <Typography variant="subtitle2">{selectedPr.request_date}</Typography>
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
                  <Typography variant="caption" color="text.secondary">Requester</Typography>
                  <Typography variant="subtitle2">{selectedPr.requested_by}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Priority</Typography>
                  <Typography variant="subtitle2">{selectedPr.priority}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Supplier</Typography>
                  <Typography variant="subtitle2">{selectedPr.supplier_name || 'Any Supplier'}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Godown</Typography>
                  <Typography variant="subtitle2">{selectedPr.godown_name || 'Main Godown'}</Typography>
                </Grid>
                {selectedPr.remarks && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">Requisition Purpose / Remarks</Typography>
                    <Typography variant="body2">{selectedPr.remarks}</Typography>
                  </Grid>
                )}
              </Grid>

              {/* Items Table with Editable Approved Qty */}
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, color: '#1f4fb2' }}>
                Item Quantity Verification (Manager Approval Adjustment)
              </Typography>

              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                <Table size="small">
                  <TableHead sx={{ backgroundColor: '#1f4fb2' }}>
                    <TableRow>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Item Name</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Req Qty</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold', width: '130px' }}>Approved Qty *</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Unit</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Est Rate (₹)</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Est Total (₹)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {itemApprovals.map((it, idx) => (
                      <TableRow key={it.id || idx}>
                        <TableCell sx={{ fontWeight: 'bold' }}>{it.item_name}</TableCell>
                        <TableCell>{it.requested_qty}</TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            size="small"
                            value={it.approved_qty}
                            onChange={(e) => handleApprovedQtyChange(idx, e.target.value)}
                            inputProps={{ min: 0, step: 'any', style: { fontWeight: 'bold', color: '#1f4fb2' } }}
                          />
                        </TableCell>
                        <TableCell>{it.unit}</TableCell>
                        <TableCell>₹{(it.estimated_rate || 0).toFixed(2)}</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>
                          ₹{((it.approved_qty || 0) * (it.estimated_rate || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Manager Remarks */}
              <TextField
                label="Manager Remarks / Instructions *"
                value={managerRemarks}
                onChange={(e) => setManagerRemarks(e.target.value)}
                fullWidth
                multiline
                rows={3}
                placeholder="Enter approval notes or mandatory reason if rejecting/returning for amendment..."
                required
              />
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, justifyContent: 'space-between', backgroundColor: '#f8f9fa' }}>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<ReturnIcon />}
            onClick={() => handleAction('return')}
            disabled={processingAction}
          >
            Return to Requester
          </Button>

          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            {(selectedPr?.status === 'Approved' || selectedPr?.status === 'Converted') && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<PoIcon />}
                onClick={() => {
                  setReviewDialogOpen(false);
                  navigate(`/entry/purchase-order-create?pr_id=${selectedPr.id}`);
                }}
                sx={{ px: 2, fontWeight: 'bold', backgroundColor: '#0284c7' }}
              >
                Create Purchase Order ➔
              </Button>
            )}

            <Button
              variant="contained"
              color="error"
              startIcon={<RejectIcon />}
              onClick={() => handleAction('reject')}
              disabled={processingAction}
            >
              Reject
            </Button>

            <Button
              variant="contained"
              color="success"
              startIcon={processingAction ? <CircularProgress size={20} color="inherit" /> : <ApproveIcon />}
              onClick={() => handleAction('approve')}
              disabled={processingAction}
              sx={{ px: 3, fontWeight: 'bold' }}
            >
              Approve PR
            </Button>
          </Box>
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

export default PurchaseRequestApproval;
