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
  VerifiedUser as VerifiedUserIcon,
  Refresh as RefreshIcon,
  Print as PrintIcon,
  FileDownload as ExportIcon,
  Search as SearchIcon,
  RestartAlt as ResetIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { printHtml } from '../../utils/printHelper';

const OprpMonitoringReport = ({ hideHeader = false }) => {
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [rmFg, setRmFg] = useState('ALL');
  const [material, setMaterial] = useState('');

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
      if (rmFg && rmFg !== 'ALL') params.append('rm_fg', rmFg);
      if (material) params.append('material', material);

      const res = await fetch(`/api/reports/oprp-monitoring?${params.toString()}`);
      const json = await res.json();
      if (Array.isArray(json)) {
        setData(json);
      } else if (json && Array.isArray(json.data)) {
        setData(json.data);
      } else {
        setData([]);
      }
    } catch (err) {
      console.error('Error fetching OPRP report:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const handleReset = () => {
    setFromDate('');
    setToDate('');
    setRmFg('ALL');
    setMaterial('');
  };

  // Metrics
  const totalLots = data.length;
  const rmCount = data.filter(r => (r.rm_fg || '').toUpperCase() === 'RM').length;
  const fgCount = data.filter(r => (r.rm_fg || '').toUpperCase() === 'FG').length;
  const verifiedCount = data.filter(r => Number(r.alp) === 1 && Number(r.g) === 1).length;
  const verifiedRate = totalLots > 0 ? ((verifiedCount / totalLots) * 100).toFixed(1) : '100.0';

  // Excel Export
  const handleExportExcel = () => {
    if (data.length === 0) return;
    const excelData = data.map((row, idx) => ({
      'S.No': idx + 1,
      'Voucher No': row.voucher_no || row.voucher,
      'Date': row.date,
      'Material Name': row.material,
      'Type': row.rm_fg,
      'Lot Number': row.lot_number,
      'Quantity (Bags)': row.quantity || '—',
      'ALP Check (Cleaning)': Number(row.alp) === 1 ? 'Pass' : 'Fail',
      'G Check (Grinding)': Number(row.g) === 1 ? 'Pass' : 'Fail',
      'Checked By': row.checked_by,
      'Remarks': row.remarks || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'OPRP Monitoring');
    XLSX.writeFile(workbook, `OPRP_Monitoring_Report_${fromDate}_to_${toDate}.xlsx`);
  };

  // Print Report
  const handlePrintReport = () => {
    const tableRowsHtml = data.map((r, idx) => `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px;">${r.voucher_no || r.voucher || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px;">${r.date || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">${r.material || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${r.rm_fg || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-family: monospace;">${r.lot_number || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold;">${r.quantity || '—'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold; color: ${Number(r.alp) === 1 ? '#16a34a' : '#dc2626'};">${Number(r.alp) === 1 ? '✓ PASS' : '✗ FAIL'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold; color: ${Number(r.g) === 1 ? '#16a34a' : '#dc2626'};">${Number(r.g) === 1 ? '✓ PASS' : '✗ FAIL'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px;">${r.checked_by || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px;">${r.remarks || ''}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 25px; color: #1e293b;">
        <div style="text-align: center; border-bottom: 3px solid #1e3a8a; padding-bottom: 15px; margin-bottom: 20px;">
          <h1 style="color: #1e3a8a; margin: 0 0 5px 0;">OPERATIONAL PREREQUISITE PROGRAM (OPRP) REPORT</h1>
          <p style="margin: 0; color: #64748b; font-size: 14px;">ISO 22000 Material Quality Verification Log (${fromDate} to ${toDate})</p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px;">
          <div style="padding: 10px; background-color: #f1f5f9; border-radius: 6px; border-left: 4px solid #475569;">
            <div style="font-size: 11px; color: #475569; font-weight: bold;">TOTAL LOTS INSPECTED</div>
            <div style="font-size: 18px; font-weight: bold; color: #1e293b;">${totalLots}</div>
          </div>
          <div style="padding: 10px; background-color: #e0e7ff; border-radius: 6px; border-left: 4px solid #4f46e5;">
            <div style="font-size: 11px; color: #4338ca; font-weight: bold;">RAW MATERIAL (RM) LOTS</div>
            <div style="font-size: 18px; font-weight: bold; color: #1e1b4b;">${rmCount}</div>
          </div>
          <div style="padding: 10px; background-color: #dcfce7; border-radius: 6px; border-left: 4px solid #16a34a;">
            <div style="font-size: 11px; color: #15803d; font-weight: bold;">FINISHED GOODS (FG) LOTS</div>
            <div style="font-size: 18px; font-weight: bold; color: #064e3b;">${fgCount}</div>
          </div>
          <div style="padding: 10px; background-color: #f0fdf4; border-radius: 6px; border-left: 4px solid #22c55e;">
            <div style="font-size: 11px; color: #166534; font-weight: bold;">FULLY VERIFIED RATE</div>
            <div style="font-size: 18px; font-weight: bold; color: #14532d;">${verifiedRate}%</div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background-color: #f1f5f9; color: #1e293b; text-align: left;">
              <th style="border: 1px solid #cbd5e1; padding: 8px;">S.No</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px;">Voucher</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px;">Date</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px;">Material Name</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">Type</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px;">Lot Number</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">Qty</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">ALP Check</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">G Check</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px;">Checked By</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px;">Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      </div>
    `;

    printHtml(html, 'OPRP Monitoring Report');
  };

  return (
    <Container maxWidth="xl" sx={{ mt: hideHeader ? 0 : 3, mb: 4, px: hideHeader ? '0 !important' : undefined }}>
      <Paper elevation={hideHeader ? 0 : 2} sx={{ p: hideHeader ? 0 : 3, borderRadius: 2, border: hideHeader ? 'none' : undefined }}>
        {/* Header */}
        {!hideHeader && (
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <VerifiedUserIcon color="primary" sx={{ fontSize: 32 }} />
              <Box>
                <Typography variant="h5" fontWeight="bold" color="primary">
                  Operational Prerequisite Program (OPRP) Report
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  ISO 22000 Raw Material & Finished Goods OPRP Verification
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
                label="Material Type"
                fullWidth
                size="small"
                value={rmFg}
                onChange={(e) => setRmFg(e.target.value)}
              >
                <MenuItem value="ALL">All Materials (RM & FG)</MenuItem>
                <MenuItem value="RM">Raw Material (RM)</MenuItem>
                <MenuItem value="FG">Finished Good (FG)</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.5}>
              <TextField
                label="Material Name / Lot"
                fullWidth
                size="small"
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                placeholder="Wheat, Flour, Lot..."
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
                TOTAL LOTS INSPECTED
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="#1e293b" sx={{ mt: 0.5 }}>
                {totalLots}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Paper elevation={0} sx={{ p: 2, bgcolor: '#e0e7ff', borderLeft: '4px solid #4f46e5', borderRadius: 1.5 }}>
              <Typography variant="caption" fontWeight="bold" color="#4338ca">
                RAW MATERIAL (RM) LOTS
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="#1e1b4b" sx={{ mt: 0.5 }}>
                {rmCount}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Paper elevation={0} sx={{ p: 2, bgcolor: '#dcfce7', borderLeft: '4px solid #16a34a', borderRadius: 1.5 }}>
              <Typography variant="caption" fontWeight="bold" color="#15803d">
                FINISHED GOODS (FG) LOTS
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="#064e3b" sx={{ mt: 0.5 }}>
                {fgCount}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Paper elevation={0} sx={{ p: 2, bgcolor: '#f0fdf4', borderLeft: '4px solid #22c55e', borderRadius: 1.5 }}>
              <Typography variant="caption" fontWeight="bold" color="#166534">
                FULLY VERIFIED RATE
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="#14532d" sx={{ mt: 0.5 }}>
                {verifiedRate}%
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
                <TableCell sx={{ fontWeight: 'bold' }}>Voucher</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Material Name</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Lot Number</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Quantity (Bags)</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>ALP Gram (g)</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>ALP Check</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>G Check</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Checked By</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Remarks</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={12} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={32} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Loading OPRP verification log...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No OPRP records found for the selected criteria.
                  </TableCell>
                </TableRow>
              ) : (
                data
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((row, idx) => (
                    <TableRow key={row.id ? `oprp-${row.id}-${idx}` : idx} hover>
                      <TableCell>{page * rowsPerPage + idx + 1}</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: 'primary.main' }}>{row.voucher_no || row.voucher}</TableCell>
                      <TableCell>{row.date}</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>{row.material}</TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={row.rm_fg || 'FG'} 
                          color={(row.rm_fg || '').toUpperCase() === 'RM' ? 'primary' : 'success'} 
                          size="small" 
                          sx={{ fontWeight: 'bold', fontSize: '10px' }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{row.lot_number}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{row.quantity || '—'}</TableCell>
                      <TableCell align="right" sx={{ color: '#0284c7', fontWeight: 'bold' }}>{row.alp_gram || row.alpGram || '0.0'} g</TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={Number(row.alp) === 1 ? 'PASS' : 'FAIL'} 
                          color={Number(row.alp) === 1 ? 'success' : 'error'} 
                          size="small" 
                          variant="outlined"
                          sx={{ fontWeight: 'bold', fontSize: '10px' }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={Number(row.g) === 1 ? 'PASS' : 'FAIL'} 
                          color={Number(row.g) === 1 ? 'success' : 'error'} 
                          size="small" 
                          variant="outlined"
                          sx={{ fontWeight: 'bold', fontSize: '10px' }}
                        />
                      </TableCell>
                      <TableCell>{row.checked_by}</TableCell>
                      <TableCell>{row.remarks || '—'}</TableCell>
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

export default OprpMonitoringReport;
