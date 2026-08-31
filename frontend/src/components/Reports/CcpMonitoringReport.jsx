import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Grid,
  Typography,
  TextField,
  MenuItem,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress
} from '@mui/material';
import {
  Security as SecurityIcon,
  Refresh as RefreshIcon,
  Print as PrintIcon,
  FileDownload as ExportIcon,
  Search as SearchIcon,
  RestartAlt as ResetIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { printHtml } from '../../utils/printHelper';

const CcpMonitoringReport = ({ hideHeader = false }) => {
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [status, setStatus] = useState('ALL');
  const [category, setCategory] = useState('');

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.append('from_date', fromDate);
      if (toDate) params.append('to_date', toDate);
      if (status && status !== 'ALL') params.append('status', status);
      if (category) params.append('category', category);

      const res = await fetch(`/api/reports/ccp-monitoring?${params.toString()}`);
      const json = await res.json();
      if (Array.isArray(json)) {
        setData(json);
      } else if (json && Array.isArray(json.data)) {
        setData(json.data);
      } else {
        setData([]);
      }
    } catch (err) {
      console.error('Error fetching CCP report:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const handleReset = () => {
    setFromDate('');
    setToDate('');
    setStatus('ALL');
    setCategory('');
  };

  // Metrics
  const totalChecks = data.length;
  const passCount = data.filter(r => (r.status || '').toUpperCase() === 'PASS').length;
  const failCount = data.filter(r => (r.status || '').toUpperCase() === 'FAIL').length;
  const complianceRate = totalChecks > 0 ? ((passCount / totalChecks) * 100).toFixed(1) : '100.0';

  // Excel Export
  const handleExportExcel = () => {
    if (data.length === 0) return;
    const excelData = data.map((row, idx) => ({
      'S.No': idx + 1,
      'DATE': row.date || row.grind_date || row.checked_date_time || '',
      'Material': row.item_name || row.material || 'Bengal gram split',
      'Quantity Processed (kg)': row.processed_qty || row.quantity_processed || '',
      'Location': row.location || row.ccp_category || 'Sortex machine at end level',
      'Critical Limit (g/MT)': row.critical_limit || '',
      'Checked By': row.checked_by || 'J.V.N.',
      'Status': row.status || 'PASS'
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'CCP Monitoring Record');
    XLSX.writeFile(workbook, `CCP_Monitoring_Record_${fromDate || 'All'}_to_${toDate || 'All'}.xlsx`);
  };

  // Print Report
  const handlePrintReport = () => {
    const tableRowsHtml = data.map((r, idx) => `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px;">${r.date || r.grind_date || r.checked_date_time || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">${r.item_name || r.material || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold;">${r.processed_qty || r.quantity_processed || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px;">${r.location || r.ccp_category || 'Sortex machine at end level'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold;">${r.critical_limit || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px;">${r.checked_by || 'J.V.N.'}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 25px; color: #1e293b;">
        <div style="text-align: center; border-bottom: 3px solid #1e3a8a; padding-bottom: 15px; margin-bottom: 20px;">
          <h1 style="color: #1e3a8a; margin: 0 0 5px 0;">BVC EXPORTS</h1>
          <h2 style="color: #334155; margin: 0 0 5px 0;">CCP Monitoring Record</h2>
          <p style="margin: 0; color: #64748b; font-size: 14px;">Critical Control Point Audit & Quality Inspection Log</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px;">
          <thead>
            <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
              <th style="border: 1px solid #cbd5e1; padding: 8px;">S.No</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px;">DATE</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px;">Material</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px;">Quantity Processed (kg)</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px;">Location</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px;">Critical Limit (g/MT)</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px;">Checked by</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      </div>
    `;

    printHtml(html);
  };

  return (
    <Container maxWidth="xl" sx={{ mt: hideHeader ? 0 : 3, mb: 4, px: hideHeader ? '0 !important' : undefined }}>
      <Paper elevation={hideHeader ? 0 : 2} sx={{ p: hideHeader ? 0 : 3, borderRadius: 2, border: hideHeader ? 'none' : undefined }}>
        {/* Header */}
        {!hideHeader && (
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <SecurityIcon color="primary" sx={{ fontSize: 32 }} />
              <Box>
                <Typography variant="h5" fontWeight="bold" color="primary">
                  Critical Control Point (CCP) Monitoring Report
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  ISO 22000 Food Safety CCP Verification & Deviation Log
                </Typography>
              </Box>
            </Box>
            <Stack direction="row" spacing={1.5}>
              <Button variant="outlined" color="primary" startIcon={<ArrowBackIcon />} onClick={() => navigate('/reports')} size="small">
                All Reports
              </Button>
              <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchReport} size="small">
                Refresh
              </Button>
              <Button variant="outlined" color="success" startIcon={<ExportIcon />} onClick={handleExportExcel} size="small">
                Excel
              </Button>
              <Button variant="contained" color="primary" startIcon={<PrintIcon />} onClick={handlePrintReport} size="small">
                Print Report
              </Button>
            </Stack>
          </Stack>
        )}

        {hideHeader && (
          <Box display="flex" justifyContent="flex-end" mb={2}>
            <Stack direction="row" spacing={1.5}>
              <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchReport} size="small">
                Refresh
              </Button>
              <Button variant="outlined" color="success" startIcon={<ExportIcon />} onClick={handleExportExcel} size="small">
                Excel
              </Button>
              <Button variant="contained" color="primary" startIcon={<PrintIcon />} onClick={handlePrintReport} size="small">
                Print Report
              </Button>
            </Stack>
          </Box>
        )}

        {/* Filters */}
        <Paper variant="outlined" sx={{ p: 2, mb: 3, backgroundColor: '#f8fafc' }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="From Date"
                type="date"
                fullWidth
                size="small"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="To Date"
                type="date"
                fullWidth
                size="small"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.5}>
              <TextField
                select
                label="Inspection Status"
                fullWidth
                size="small"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <MenuItem value="ALL">All Statuses</MenuItem>
                <MenuItem value="Pass">Pass</MenuItem>
                <MenuItem value="Fail">Fail</MenuItem>
                <MenuItem value="Pending">Pending</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.5}>
              <TextField
                label="CCP Category / Equipment"
                fullWidth
                size="small"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Sortex, Magnet, etc."
              />
            </Grid>
            <Grid item xs={12} sm={6} md={1}>
              <Button variant="contained" startIcon={<SearchIcon />} onClick={fetchReport} size="small" fullWidth>
                Filter
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Metric Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={3}>
            <Paper elevation={0} sx={{ p: 2, bgcolor: '#f1f5f9', borderLeft: '4px solid #475569', borderRadius: 1.5 }}>
              <Typography variant="caption" fontWeight="bold" color="#475569">
                TOTAL CHECKS
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="#1e293b" sx={{ mt: 0.5 }}>
                {totalChecks}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Paper elevation={0} sx={{ p: 2, bgcolor: '#dcfce7', borderLeft: '4px solid #16a34a', borderRadius: 1.5 }}>
              <Typography variant="caption" fontWeight="bold" color="#15803d">
                PASSED (COMPLIANT)
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="#064e3b" sx={{ mt: 0.5 }}>
                {passCount}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Paper elevation={0} sx={{ p: 2, bgcolor: '#fee2e2', borderLeft: '4px solid #dc2626', borderRadius: 1.5 }}>
              <Typography variant="caption" fontWeight="bold" color="#b91c1c">
                FAILED / DEVIATIONS
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="#7f1d1d" sx={{ mt: 0.5 }}>
                {failCount}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Paper elevation={0} sx={{ p: 2, bgcolor: '#e0e7ff', borderLeft: '4px solid #4f46e5', borderRadius: 1.5 }}>
              <Typography variant="caption" fontWeight="bold" color="#4338ca">
                CCP COMPLIANCE RATE
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="#1e1b4b" sx={{ mt: 0.5 }}>
                {complianceRate}%
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Table */}
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5 }}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: '#f1f5f9' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>S.No</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>DATE</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Material</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Quantity Processed (kg)</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Location</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Critical Limit (g/MT)</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Checked by</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={32} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Loading CCP monitoring log...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No CCP records found for the selected criteria.
                  </TableCell>
                </TableRow>
              ) : (
                data
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((row, idx) => (
                    <TableRow key={row.id ? `ccp-${row.id}-${idx}` : idx} hover>
                      <TableCell>{page * rowsPerPage + idx + 1}</TableCell>
                      <TableCell>{row.date || row.grind_date || row.checked_date_time}</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: 'primary.main' }}>{row.item_name || row.material || 'Bengal gram split'}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{row.processed_qty || row.quantity_processed || '-'}</TableCell>
                      <TableCell>{row.location || row.ccp_category || 'Sortex machine at end level'}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: '#0f766e' }}>{row.critical_limit || '-'}</TableCell>
                      <TableCell sx={{ fontWeight: '500' }}>{row.checked_by || 'J.V.N.'}</TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={row.status || 'PASS'} 
                          color={(row.status || '').toUpperCase() === 'PASS' ? 'success' : 'error'} 
                          size="small" 
                          sx={{ fontWeight: 'bold', fontSize: '11px' }}
                        />
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={data.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_e, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </Paper>
    </Container>
  );
};

export default CcpMonitoringReport;
