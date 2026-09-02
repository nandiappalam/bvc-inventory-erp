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
  Tabs,
  Tab,
  CircularProgress,
  Snackbar,
  Alert,
  Chip
} from '@mui/material';
import {
  Search as SearchIcon,
  RestartAlt as ResetIcon,
  GetApp as ExcelIcon,
  Print as PrintIcon,
  Assessment as ReportIcon,
  PieChart as ChartIcon
} from '@mui/icons-material';
import { printHtml } from '../../utils/printHelper';
import api from '../../services/api.js';

const REPORT_TYPES = [
  { id: 'summary', label: 'Purchase Request Summary' },
  { id: 'pending', label: 'Pending Requisitions Report' },
  { id: 'department', label: 'Department-wise Requests' },
  { id: 'item', label: 'Item-wise Requests' },
  { id: 'monthly', label: 'Monthly Trend Report' },
  { id: 'approval_status', label: 'Approval Status Breakdown' },
  { id: 'priority', label: 'Priority Distribution Report' }
];

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

const PurchaseRequestReports = () => {
  const [activeTab, setActiveTab] = useState('summary');

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');

  // Report Data State
  const [reportRows, setReportRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  useEffect(() => {
    fetchReportData();
  }, [activeTab]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('reportType', activeTab);
      if (dateFrom) queryParams.append('dateFrom', dateFrom);
      if (dateTo) queryParams.append('dateTo', dateTo);
      if (department) queryParams.append('department', department);
      if (status) queryParams.append('status', status);
      if (priority) queryParams.append('priority', priority);

      // Handle pending specifically
      if (activeTab === 'pending' && !status) {
        queryParams.append('status', 'Submitted');
      }

      const data = await api(`/purchase-requests/reports?${queryParams.toString()}`);
      if (data && data.rows && Array.isArray(data.rows)) {
        if (activeTab === 'item') {
          let masterItems = [];
          try {
            const mData = await api('/masters/items');
            if (Array.isArray(mData)) masterItems = mData;
          } catch (e) {
            console.log('Notice master fetch:', e);
          }

          const resolved = data.rows.map(r => {
            let name = r.item_name;
            if (!name || !isNaN(name)) {
              const matched = masterItems.find(m => String(m.id) === String(r.item_name) || String(m.id) === String(r.item_id));
              if (matched) name = matched.item_name || matched.name;
              else if (r.item_code) name = `Item (${r.item_code})`;
              else name = `Item #${r.item_id || name}`;
            }
            return { ...r, item_name: name };
          });
          setReportRows(resolved);
        } else {
          setReportRows(data.rows);
        }
      } else {
        setReportRows([]);
      }
    } catch (err) {
      console.error('Error loading report:', err);
      setSnackbar({ open: true, message: 'Error loading report data', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setDateFrom('');
    setDateTo('');
    setDepartment('');
    setStatus('');
    setPriority('');
    setTimeout(() => {
      fetchReportData();
    }, 50);
  };

  const exportExcel = () => {
    if (reportRows.length === 0) return;
    let headers = [];
    let rows = [];

    if (activeTab === 'department') {
      headers = ['Department', 'Total Requests', 'Approved', 'Pending', 'Rejected', 'Total Items', 'Total Qty', 'Total Value (₹)'];
      rows = reportRows.map(r => [r.department, r.total_requests, r.approved_count, r.pending_count, r.rejected_count, r.total_items, r.total_qty, r.total_amount]);
    } else if (activeTab === 'item') {
      headers = ['Item Name', 'Code', 'Unit', 'PR No', 'Req Date', 'Department', 'Requester', 'Priority', 'Status', 'Req Qty', 'App Qty', 'Est Rate', 'Est Amount'];
      rows = reportRows.map(r => [r.item_name, r.item_code || '', r.unit, r.pr_no, r.request_date, r.department, r.requested_by, r.priority, r.status, r.requested_qty, r.approved_qty, r.estimated_rate, r.estimated_amount]);
    } else if (activeTab === 'approval_status') {
      headers = ['Status', 'Count', 'Total Value (₹)'];
      rows = reportRows.map(r => [r.status, r.count, r.total_value]);
    } else if (activeTab === 'priority') {
      headers = ['Priority', 'Count', 'Total Value (₹)'];
      rows = reportRows.map(r => [r.priority, r.count, r.total_value]);
    } else {
      headers = ['PR No', 'Item Name(s)', 'Req Date', 'Department', 'Requester', 'Priority', 'Total Items', 'Total Qty', 'Total Value (₹)', 'Status'];
      rows = reportRows.map(r => [r.pr_no, r.item_names || r.item_name || '', r.request_date, r.department, r.requested_by, r.priority, r.total_items, r.total_qty, r.total_amount, r.status]);
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${activeTab}_purchase_request_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="text-align: center; color: #1f4fb2; margin-bottom: 5px;">BVC ERP INVENTORY SYSTEM</h2>
        <h3 style="text-align: center; margin-top: 0;">${REPORT_TYPES.find(t => t.id === activeTab)?.label || 'Purchase Request Report'}</h3>
        <p style="text-align: center; font-size: 12px; color: #666;">Generated on: ${new Date().toLocaleString()}</p>

        <table border="1" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 20px;">
          <thead style="background-color: #1f4fb2; color: #fff;">
            <tr>
              ${activeTab === 'department' ? `
                <th>Department</th><th>Requests</th><th>Approved</th><th>Pending</th><th>Rejected</th><th>Items</th><th>Total Qty</th><th>Total Value (₹)</th>
              ` : activeTab === 'item' ? `
                <th>Item Name</th><th>Code</th><th>PR No</th><th>Date</th><th>Dept</th><th>Status</th><th>Req Qty</th><th>App Qty</th><th>Amount (₹)</th>
              ` : activeTab === 'approval_status' || activeTab === 'priority' ? `
                <th>Category</th><th>Count</th><th>Total Value (₹)</th>
              ` : `
                <th>PR No</th><th>Item Name(s)</th><th>Req Date</th><th>Department</th><th>Requested By</th><th>Priority</th><th>Items</th><th>Total Qty</th><th>Value (₹)</th><th>Status</th>
              `}
            </tr>
          </thead>
          <tbody>
            ${reportRows.map(r => `
              <tr>
                ${activeTab === 'department' ? `
                  <td>${r.department}</td><td>${r.total_requests}</td><td>${r.approved_count}</td><td>${r.pending_count}</td><td>${r.rejected_count}</td><td>${r.total_items}</td><td>${r.total_qty}</td><td>₹${(r.total_amount || 0).toLocaleString('en-IN')}</td>
                ` : activeTab === 'item' ? `
                  <td>${r.item_name}</td><td>${r.item_code || ''}</td><td>${r.pr_no}</td><td>${r.request_date}</td><td>${r.department}</td><td>${r.status}</td><td>${r.requested_qty}</td><td>${r.approved_qty}</td><td>₹${(r.estimated_amount || 0).toLocaleString('en-IN')}</td>
                ` : activeTab === 'approval_status' || activeTab === 'priority' ? `
                  <td>${r.status || r.priority}</td><td>${r.count}</td><td>₹${(r.total_value || 0).toLocaleString('en-IN')}</td>
                ` : `
                  <td>${r.pr_no}</td><td>${r.item_names || r.item_name || '-'}</td><td>${r.request_date}</td><td>${r.department}</td><td>${r.requested_by}</td><td>${r.priority}</td><td>${r.total_items}</td><td>${r.total_qty}</td><td>₹${(r.total_amount || 0).toLocaleString('en-IN')}</td><td>${r.status}</td>
                `}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    printHtml(html);
  };

  return (
    <Box sx={{ p: 2, backgroundColor: '#f4f6f9', minHeight: '100vh' }}>
      {/* Header */}
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
          <ReportIcon sx={{ fontSize: 32 }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Purchase Request Reports & Analytics
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>
              Audit reports, item requisitions, status metrics & department breakdowns
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Tabs Selector */}
      <Paper elevation={2} sx={{ mb: 3, borderRadius: 1.5 }}>
        <Tabs
          value={activeTab}
          onChange={(e, val) => setActiveTab(val)}
          variant="scrollable"
          scrollButtons="auto"
          textColor="primary"
          indicatorColor="primary"
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          {REPORT_TYPES.map(t => (
            <Tab key={t.id} value={t.id} label={t.label} sx={{ fontWeight: 'bold', fontSize: '13px' }} />
          ))}
        </Tabs>
      </Paper>

      {/* Filter Panel */}
      <Card elevation={2} sx={{ mb: 3, borderRadius: 1.5 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={2.4}>
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

            <Grid item xs={12} sm={6} md={2.4}>
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

            <Grid item xs={12} sm={6} md={2.4}>
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

            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                select
                label="Status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                fullWidth
                size="small"
              >
                <MenuItem value="">-- All Statuses --</MenuItem>
                <MenuItem value="Draft">Draft</MenuItem>
                <MenuItem value="Submitted">Submitted</MenuItem>
                <MenuItem value="Approved">Approved</MenuItem>
                <MenuItem value="Rejected">Rejected</MenuItem>
                <MenuItem value="Returned">Returned</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                select
                label="Priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                fullWidth
                size="small"
              >
                <MenuItem value="">-- All Priorities --</MenuItem>
                <MenuItem value="Urgent">Urgent</MenuItem>
                <MenuItem value="High">High</MenuItem>
                <MenuItem value="Medium">Medium</MenuItem>
                <MenuItem value="Low">Low</MenuItem>
              </TextField>
            </Grid>
          </Grid>

          <Box sx={{ display: 'flex', gap: 1.5, mt: 2, justifyContent: 'flex-end' }}>
            <Button variant="outlined" color="secondary" startIcon={<ResetIcon />} onClick={handleReset}>
              Reset
            </Button>
            <Button variant="contained" startIcon={<SearchIcon />} onClick={fetchReportData} sx={{ backgroundColor: '#1f4fb2' }}>
              Generate Report
            </Button>
            <Button variant="outlined" color="success" startIcon={<ExcelIcon />} onClick={exportExcel}>
              Export Excel
            </Button>
            <Button variant="outlined" color="primary" startIcon={<PrintIcon />} onClick={handlePrint}>
              Print Report
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Report Table */}
      <Card elevation={2} sx={{ borderRadius: 1.5 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>
              {REPORT_TYPES.find(t => t.id === activeTab)?.label} ({reportRows.length} Records)
            </Typography>
          </Box>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead sx={{ backgroundColor: '#1f4fb2' }}>
                <TableRow>
                  {activeTab === 'department' ? (
                    <>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Department</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Total PRs</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Approved</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Pending</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Rejected</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Total Items</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Total Qty</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Total Value (₹)</TableCell>
                    </>
                  ) : activeTab === 'item' ? (
                    <>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Item Name</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Item Code</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>PR No</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Req Date</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Department</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Requested Qty</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Approved Qty</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Est. Rate (₹)</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Est. Amount (₹)</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Status</TableCell>
                    </>
                  ) : activeTab === 'approval_status' || activeTab === 'priority' ? (
                    <>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Category / Group</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Total Count</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Total Estimated Value (₹)</TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>PR No</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Item Name(s)</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Req Date</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Department</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Requested By</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Priority</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Total Items</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Total Qty</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Est. Amount (₹)</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Status</TableCell>
                    </>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={11} align="center" sx={{ py: 3 }}>
                      <CircularProgress size={30} />
                      <Typography variant="body2" sx={{ mt: 1 }}>Generating report...</Typography>
                    </TableCell>
                  </TableRow>
                ) : reportRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No data found for selected report criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  reportRows.map((r, idx) => (
                    <TableRow key={idx} hover>
                      {activeTab === 'department' ? (
                        <>
                          <TableCell sx={{ fontWeight: 'bold' }}>{r.department}</TableCell>
                          <TableCell>{r.total_requests}</TableCell>
                          <TableCell sx={{ color: 'success.main', fontWeight: 'bold' }}>{r.approved_count}</TableCell>
                          <TableCell sx={{ color: 'warning.main', fontWeight: 'bold' }}>{r.pending_count}</TableCell>
                          <TableCell sx={{ color: 'error.main' }}>{r.rejected_count}</TableCell>
                          <TableCell>{r.total_items}</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>{r.total_qty}</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>₹{(r.total_amount || 0).toLocaleString('en-IN')}</TableCell>
                        </>
                      ) : activeTab === 'item' ? (
                        <>
                          <TableCell sx={{ fontWeight: 'bold' }}>{r.item_name}</TableCell>
                          <TableCell>{r.item_code || '—'}</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>{r.pr_no}</TableCell>
                          <TableCell>{r.request_date}</TableCell>
                          <TableCell>{r.department}</TableCell>
                          <TableCell>{r.requested_qty}</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', color: 'success.main' }}>{r.approved_qty}</TableCell>
                          <TableCell>₹{(r.estimated_rate || 0).toFixed(2)}</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>₹{(r.estimated_amount || 0).toLocaleString('en-IN')}</TableCell>
                          <TableCell><Chip label={r.status} size="small" /></TableCell>
                        </>
                      ) : activeTab === 'approval_status' || activeTab === 'priority' ? (
                        <>
                          <TableCell sx={{ fontWeight: 'bold' }}>{r.status || r.priority}</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>{r.count}</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>₹{(r.total_value || 0).toLocaleString('en-IN')}</TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>{r.pr_no}</TableCell>
                          <TableCell sx={{ fontWeight: '500' }}>{r.item_names || r.item_name || '—'}</TableCell>
                          <TableCell>{r.request_date}</TableCell>
                          <TableCell>{r.department}</TableCell>
                          <TableCell>{r.requested_by}</TableCell>
                          <TableCell><Chip label={r.priority} size="small" /></TableCell>
                          <TableCell>{r.total_items}</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>{r.total_qty}</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>₹{(r.total_amount || 0).toLocaleString('en-IN')}</TableCell>
                          <TableCell><Chip label={r.status} size="small" color={r.status === 'Approved' ? 'success' : r.status === 'Submitted' ? 'warning' : 'default'} /></TableCell>
                        </>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

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

export default PurchaseRequestReports;
