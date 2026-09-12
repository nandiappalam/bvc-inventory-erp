import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Grid,
  Typography,
  TextField,
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
  CircularProgress
} from '@mui/material';
import {
  Factory as FactoryIcon,
  Refresh as RefreshIcon,
  Print as PrintIcon,
  FileDownload as ExportIcon,
  Search as SearchIcon,
  RestartAlt as ResetIcon,
  ArrowBack as ArrowBackIcon,
  Assessment as AssessmentIcon,
  Scale as ScaleIcon,
  DeleteSweep as WastageIcon,
  Summarize as SummaryIcon
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { printHtml } from '../../utils/printHelper';

const DailyProductionReport = ({ hideHeader = false, reportType: propReportType }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reportType = propReportType || searchParams.get('type') || 'daily';

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [flourMill, setFlourMill] = useState('');
  const [itemName, setItemName] = useState('');
  const [lotNo, setLotNo] = useState('');
  const [operator, setOperator] = useState('');

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
      if (flourMill) params.append('flour_mill', flourMill);
      if (itemName) params.append('item_name', itemName);
      if (lotNo) params.append('lot_no', lotNo);
      if (operator) params.append('operator', operator);

      const res = await fetch(`/api/reports/daily-production?${params.toString()}`);
      const json = await res.json();
      if (Array.isArray(json)) {
        setData(json);
      } else {
        setData([]);
      }
    } catch (err) {
      console.error('Error fetching daily production report:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const handleReset = () => {
    setFromDate('');
    setToDate('');
    setFlourMill('');
    setItemName('');
    setLotNo('');
    setOperator('');
  };

  // Summary Metrics
  const totalInputWt = data.reduce((sum, r) => sum + (parseFloat(r.input_wt) || 0), 0);
  const totalOutputWt = data.reduce((sum, r) => sum + (parseFloat(r.output_wt) || 0), 0);
  const totalWastageWt = data.reduce((sum, r) => sum + (parseFloat(r.wastage_wt) || 0), 0);
  const totalStoneWt = data.reduce((sum, r) => sum + (parseFloat(r.stone_qty) || 0), 0);
  const totalOtherWastageWt = data.reduce((sum, r) => sum + (parseFloat(r.other_wastage_qty) || 0), 0);
  const totalShortcomingWt = data.reduce((sum, r) => sum + (parseFloat(r.shortcoming_wt) || 0), 0);
  const overallYield = totalInputWt > 0 ? ((totalOutputWt / totalInputWt) * 100).toFixed(2) : '100.00';
  const avgWastagePerc = totalInputWt > 0 ? ((totalWastageWt / totalInputWt) * 100).toFixed(2) : '0.00';

  // Excel Export
  const handleExportExcel = () => {
    if (data.length === 0) return;
    let sheetName = 'Daily Production';
    if (reportType === 'yield') sheetName = 'Yield & Material Balance';
    else if (reportType === 'wastage') sheetName = 'Wastage & Rejection';
    else if (reportType === 'summary') sheetName = 'Production Summary';

    const excelData = data.map((row, idx) => ({
      'S.No': idx + 1,
      'Voucher No': row.voucher,
      'Date': row.date,
      'Flour Mill': row.flour_mill,
      'Lot No': row.lot_no,
      'Input Material': row.item_name,
      'Input Qty (Bags)': row.input_qty,
      'Input Weight (kg)': row.input_wt,
      'Output Weight (kg)': row.output_wt,
      'Wastage (kg)': row.wastage_wt,
      'Wastage %': row.wastage_perc,
      'Yield %': row.yield_perc,
      'Operator': row.operator,
      'QC Approval': row.final_approval
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${sheetName.replace(/ /g, '_')}_Report_${fromDate || 'All'}_to_${toDate || 'All'}.xlsx`);
  };

  // Print Full Summary Report
  const handlePrintReport = () => {
    let reportTitle = 'DAILY GRIND PRODUCTION RECORD';
    if (reportType === 'yield') reportTitle = 'YIELD & MATERIAL BALANCE REPORT';
    else if (reportType === 'wastage') reportTitle = 'WASTAGE & REJECTION REPORT';
    else if (reportType === 'summary') reportTitle = 'PRODUCTION EXECUTIVE SUMMARY REPORT';

    const tableRowsHtml = data.map((r, idx) => `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px;">${r.date}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-family: monospace;">${r.lot_no}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px;">${r.item_name}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold;">${r.input_wt} kg</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold; color: #16a34a;">${r.output_wt} kg</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #dc2626;">${r.wastage_wt} kg</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold;">${r.yield_perc}%</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px;">${r.operator} (${r.shift})</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 25px; color: #1e293b;">
        <div style="text-align: center; border-bottom: 3px solid #1e3a8a; padding-bottom: 15px; margin-bottom: 20px;">
          <h1 style="color: #1e3a8a; margin: 0 0 5px 0;">BVC ERP - ${reportTitle}</h1>
          <p style="margin: 0; color: #64748b; font-size: 14px;">Period: ${fromDate || 'All'} to ${toDate || 'All'}</p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
          <div style="padding: 10px; background-color: #e0e7ff; border-radius: 6px; border-left: 4px solid #4f46e5;">
            <div style="font-size: 11px; color: #4338ca; font-weight: bold;">TOTAL INPUT</div>
            <div style="font-size: 16px; font-weight: bold; color: #1e1b4b;">${totalInputWt.toFixed(2)} kg</div>
          </div>
          <div style="padding: 10px; background-color: #dcfce7; border-radius: 6px; border-left: 4px solid #16a34a;">
            <div style="font-size: 11px; color: #15803d; font-weight: bold;">FG OUTPUT</div>
            <div style="font-size: 16px; font-weight: bold; color: #064e3b;">${totalOutputWt.toFixed(2)} kg</div>
          </div>
          <div style="padding: 10px; background-color: #fee2e2; border-radius: 6px; border-left: 4px solid #dc2626;">
            <div style="font-size: 11px; color: #b91c1c; font-weight: bold;">TOTAL WASTAGE</div>
            <div style="font-size: 16px; font-weight: bold; color: #7f1d1d;">${totalWastageWt.toFixed(2)} kg</div>
          </div>
          <div style="padding: 10px; background-color: #ffedd5; border-radius: 6px; border-left: 4px solid #f97316;">
            <div style="font-size: 11px; color: #c2410c; font-weight: bold;">AVERAGE YIELD</div>
            <div style="font-size: 16px; font-weight: bold; color: #7c2d12;">${overallYield}%</div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background-color: #f1f5f9; color: #1e293b; text-align: left;">
              <th style="border: 1px solid #cbd5e1; padding: 8px;">S.No</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px;">Date</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px;">Lot No</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px;">Material Name</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">Input Wt</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">Output Wt</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">Wastage Wt</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">Yield %</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px;">Operator</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      </div>
    `;

    printHtml(html, reportTitle);
  };

  // Titles and icons by reportType
  let pageTitle = 'Daily Production Record';
  let pageDesc = 'Comprehensive FSMS Production, Yield & Wastage Analytics';
  let PageIcon = FactoryIcon;

  if (reportType === 'yield') {
    pageTitle = 'Yield & Material Balance Report';
    pageDesc = 'Raw Material vs Finished Goods Reconciliation & Yield Target Variance';
    PageIcon = ScaleIcon;
  } else if (reportType === 'wastage') {
    pageTitle = 'Wastage & Rejection Report';
    pageDesc = 'Process Loss, Stone Impurities Removal & Wastage Analysis';
    PageIcon = WastageIcon;
  } else if (reportType === 'summary') {
    pageTitle = 'Production Summary Report';
    pageDesc = 'High-level Plant Processing Executive Summary & Lot Performance';
    PageIcon = SummaryIcon;
  }

  return (
    <Container maxWidth="xl" sx={{ mt: hideHeader ? 0 : 3, mb: 4, px: hideHeader ? '0 !important' : undefined }}>
      <Paper elevation={hideHeader ? 0 : 2} sx={{ p: hideHeader ? 0 : 3, borderRadius: 2, border: hideHeader ? 'none' : undefined }}>
        {/* Header */}
        {!hideHeader && (
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <PageIcon color="primary" sx={{ fontSize: 32 }} />
              <Box>
                <Typography variant="h5" fontWeight="bold" color="primary">
                  {pageTitle}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {pageDesc}
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
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box display="flex" alignItems="center" gap={1}>
              <PageIcon color="primary" sx={{ fontSize: 24 }} />
              <Typography variant="h6" fontWeight="bold" color="primary.main" fontSize="17px">
                {pageTitle}
              </Typography>
            </Box>
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
            <Grid item xs={12} sm={6} md={2}>
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
            <Grid item xs={12} sm={6} md={2}>
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
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                label="Flour Mill"
                fullWidth
                size="small"
                value={flourMill}
                onChange={(e) => setFlourMill(e.target.value)}
                placeholder="All Flour Mills"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                label="Item Name"
                fullWidth
                size="small"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="Search Material"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                label="Lot No"
                fullWidth
                size="small"
                value={lotNo}
                onChange={(e) => setLotNo(e.target.value)}
                placeholder="LOT0001"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Stack direction="row" spacing={1}>
                <Button variant="contained" startIcon={<SearchIcon />} onClick={fetchReport} size="small" fullWidth>
                  Filter
                </Button>
                <Button variant="outlined" startIcon={<ResetIcon />} onClick={handleReset} size="small" fullWidth color="inherit">
                  Reset
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        {/* Summary Metric Cards tailored by reportType */}
        {reportType === 'yield' ? (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={2.4}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: '#e0e7ff', borderLeft: '4px solid #4f46e5', borderRadius: 1.5 }}>
                <Typography variant="caption" fontWeight="bold" color="#4338ca">
                  TOTAL INPUT MATERIAL
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="#1e1b4b" sx={{ mt: 0.5 }}>
                  {totalInputWt.toFixed(2)} kg
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: '#dcfce7', borderLeft: '4px solid #16a34a', borderRadius: 1.5 }}>
                <Typography variant="caption" fontWeight="bold" color="#15803d">
                  FINISHED GOODS OUTPUT
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="#064e3b" sx={{ mt: 0.5 }}>
                  {totalOutputWt.toFixed(2)} kg
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: '#ffedd5', borderLeft: '4px solid #ea580c', borderRadius: 1.5 }}>
                <Typography variant="caption" fontWeight="bold" color="#c2410c">
                  MATERIAL LOSS / VARIANCE
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="#7c2d12" sx={{ mt: 0.5 }}>
                  {(totalInputWt - totalOutputWt).toFixed(2)} kg
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: '#f0fdf4', borderLeft: '4px solid #22c55e', borderRadius: 1.5 }}>
                <Typography variant="caption" fontWeight="bold" color="#166534">
                  ACTUAL YIELD %
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="#14532d" sx={{ mt: 0.5 }}>
                  {overallYield}%
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: '#f1f5f9', borderLeft: '4px solid #0284c7', borderRadius: 1.5 }}>
                <Typography variant="caption" fontWeight="bold" color="#0369a1">
                  TARGET YIELD BENCHMARK
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="#0c4a6e" sx={{ mt: 0.5 }}>
                  99.50%
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        ) : reportType === 'wastage' ? (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={2.4}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: '#e0e7ff', borderLeft: '4px solid #4f46e5', borderRadius: 1.5 }}>
                <Typography variant="caption" fontWeight="bold" color="#4338ca">
                  TOTAL RM PROCESSED
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="#1e1b4b" sx={{ mt: 0.5 }}>
                  {totalInputWt.toFixed(2)} kg
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: '#fef3c7', borderLeft: '4px solid #d97706', borderRadius: 1.5 }}>
                <Typography variant="caption" fontWeight="bold" color="#b45309">
                  STONE / HEAVY REMOVAL
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="#78350f" sx={{ mt: 0.5 }}>
                  {totalStoneWt.toFixed(2)} kg
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: '#fee2e2', borderLeft: '4px solid #dc2626', borderRadius: 1.5 }}>
                <Typography variant="caption" fontWeight="bold" color="#b91c1c">
                  OTHER DUST & WASTAGE
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="#7f1d1d" sx={{ mt: 0.5 }}>
                  {totalOtherWastageWt.toFixed(2)} kg
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: '#ffedd5', borderLeft: '4px solid #ea580c', borderRadius: 1.5 }}>
                <Typography variant="caption" fontWeight="bold" color="#c2410c">
                  TOTAL WASTAGE GENERATED
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="#7c2d12" sx={{ mt: 0.5 }}>
                  {totalWastageWt.toFixed(2)} kg
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: '#f0fdf4', borderLeft: '4px solid #16a34a', borderRadius: 1.5 }}>
                <Typography variant="caption" fontWeight="bold" color="#15803d">
                  AVERAGE WASTAGE %
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="#064e3b" sx={{ mt: 0.5 }}>
                  {avgWastagePerc}%
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        ) : reportType === 'summary' ? (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: '#e0e7ff', borderLeft: '4px solid #4f46e5', borderRadius: 1.5 }}>
                <Typography variant="caption" fontWeight="bold" color="#4338ca">
                  TOTAL PRODUCTION BATCHES
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="#1e1b4b" sx={{ mt: 0.5 }}>
                  {data.length} Batches
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: '#dcfce7', borderLeft: '4px solid #16a34a', borderRadius: 1.5 }}>
                <Typography variant="caption" fontWeight="bold" color="#15803d">
                  TOTAL VOLUME PROCESSED
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="#064e3b" sx={{ mt: 0.5 }}>
                  {(totalInputWt / 1000).toFixed(2)} MT ({totalInputWt.toFixed(0)} kg)
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: '#e0f2fe', borderLeft: '4px solid #0284c7', borderRadius: 1.5 }}>
                <Typography variant="caption" fontWeight="bold" color="#0369a1">
                  TOTAL FG YIELD
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="#0c4a6e" sx={{ mt: 0.5 }}>
                  {(totalOutputWt / 1000).toFixed(2)} MT ({totalOutputWt.toFixed(0)} kg)
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: '#f0fdf4', borderLeft: '4px solid #22c55e', borderRadius: 1.5 }}>
                <Typography variant="caption" fontWeight="bold" color="#166534">
                  AVERAGE PLANT YIELD %
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="#14532d" sx={{ mt: 0.5 }}>
                  {overallYield}%
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        ) : (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={2.4}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: '#e0e7ff', borderLeft: '4px solid #4f46e5', borderRadius: 1.5 }}>
                <Typography variant="caption" fontWeight="bold" color="#4338ca">
                  TOTAL INPUT MATERIAL
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="#1e1b4b" sx={{ mt: 0.5 }}>
                  {totalInputWt.toFixed(2)} kg
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: '#dcfce7', borderLeft: '4px solid #16a34a', borderRadius: 1.5 }}>
                <Typography variant="caption" fontWeight="bold" color="#15803d">
                  FINISHED GOODS OUTPUT
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="#064e3b" sx={{ mt: 0.5 }}>
                  {totalOutputWt.toFixed(2)} kg
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: '#fee2e2', borderLeft: '4px solid #dc2626', borderRadius: 1.5 }}>
                <Typography variant="caption" fontWeight="bold" color="#b91c1c">
                  PROCESS WASTAGE
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="#7f1d1d" sx={{ mt: 0.5 }}>
                  {totalWastageWt.toFixed(2)} kg
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: '#ffedd5', borderLeft: '4px solid #f97316', borderRadius: 1.5 }}>
                <Typography variant="caption" fontWeight="bold" color="#c2410c">
                  SHORTCOMING / LOSS
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="#7c2d12" sx={{ mt: 0.5 }}>
                  {totalShortcomingWt.toFixed(2)} kg
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: '#f0fdf4', borderLeft: '4px solid #22c55e', borderRadius: 1.5 }}>
                <Typography variant="caption" fontWeight="bold" color="#166534">
                  OVERALL YIELD %
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="#14532d" sx={{ mt: 0.5 }}>
                  {overallYield}%
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        )}

        {/* Table tailored by reportType */}
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5 }}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: '#f1f5f9' }}>
              {reportType === 'yield' ? (
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>S.No</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Lot / Batch No</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Raw Material Item</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Input Wt (kg)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Output FG Wt (kg)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Material Loss (kg)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actual Yield %</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Target Yield %</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Variance %</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>Reconciliation Status</TableCell>
                </TableRow>
              ) : reportType === 'wastage' ? (
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>S.No</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Lot No</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Material Name</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Input Wt (kg)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Stone Removed (kg)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Other Wastage (kg)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total Wastage (kg)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Wastage %</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>Wastage Status</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>QC Remarks & Incharge</TableCell>
                </TableRow>
              ) : reportType === 'summary' ? (
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>S.No</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Flour Mill / Unit</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Raw Material Processed</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Lot No</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total Input (bags)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total Input Wt (kg)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total Output FG Wt (kg)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Overall Yield %</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Shift & Operator</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>Approval Status</TableCell>
                </TableRow>
              ) : (
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>S.No</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Lot No</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Raw Material Name</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Supplier Name</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Qty Received</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Bag Wt (kg)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Processed Qty</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Output %</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>FG Name & Qty</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Stone Qty</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Other Wastage</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Wastage %</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Operators Involved / Shift</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>Remarks & Sign Off</TableCell>
                </TableRow>
              )}
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={15} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={32} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Loading production report...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={15} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No grind production records found for the selected criteria.
                  </TableCell>
                </TableRow>
              ) : (
                data
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((row, idx) => {
                    const inWt = parseFloat(row.input_wt) || 0;
                    const outWt = parseFloat(row.output_wt) || 0;
                    const lossWt = Math.max(0, inWt - outWt);
                    const yPerc = parseFloat(row.yield_perc) || (inWt > 0 ? (outWt / inWt) * 100 : 100);
                    const varPerc = (yPerc - 99.5).toFixed(2);
                    const wPerc = parseFloat(row.wastage_perc) || 0;

                    if (reportType === 'yield') {
                      return (
                        <TableRow key={row.id || idx} hover>
                          <TableCell>{page * rowsPerPage + idx + 1}</TableCell>
                          <TableCell>{row.date}</TableCell>
                          <TableCell><Chip label={row.lot_no} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '10px' }} /></TableCell>
                          <TableCell sx={{ fontWeight: '600' }}>{row.item_name}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>{inWt.toFixed(2)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', color: '#16a34a' }}>{outWt.toFixed(2)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', color: '#ea580c' }}>{lossWt.toFixed(2)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', color: yPerc >= 99.0 ? '#15803d' : '#b91c1c' }}>{yPerc.toFixed(2)}%</TableCell>
                          <TableCell align="right" sx={{ color: 'text.secondary' }}>99.50%</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', color: varPerc >= 0 ? '#16a34a' : '#dc2626' }}>
                            {varPerc >= 0 ? `+${varPerc}%` : `${varPerc}%`}
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={yPerc >= 99.0 ? 'BALANCED' : 'YIELD VARIANCE'}
                              color={yPerc >= 99.0 ? 'success' : 'warning'}
                              size="small"
                              sx={{ fontWeight: 'bold', fontSize: '10px' }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    }

                    if (reportType === 'wastage') {
                      return (
                        <TableRow key={row.id || idx} hover>
                          <TableCell>{page * rowsPerPage + idx + 1}</TableCell>
                          <TableCell>{row.date}</TableCell>
                          <TableCell><Chip label={row.lot_no} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '10px' }} /></TableCell>
                          <TableCell sx={{ fontWeight: '600' }}>{row.item_name}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>{inWt.toFixed(2)}</TableCell>
                          <TableCell align="right" sx={{ color: '#d97706', fontWeight: '500' }}>{row.stone_qty || 0} kg</TableCell>
                          <TableCell align="right" sx={{ color: '#dc2626', fontWeight: '500' }}>{row.other_wastage_qty || 0} kg</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', color: '#b91c1c' }}>{row.wastage_wt || 0} kg</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', color: wPerc <= 1.0 ? '#15803d' : '#c2410c' }}>{wPerc.toFixed(2)}%</TableCell>
                          <TableCell align="center">
                            <Chip
                              label={wPerc <= 1.0 ? 'NORMAL WASTAGE' : 'HIGH WASTAGE'}
                              color={wPerc <= 1.0 ? 'success' : 'error'}
                              size="small"
                              sx={{ fontWeight: 'bold', fontSize: '10px' }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">
                              QC: {row.qc_technologist || 'J.V.N.'} | Operator: {row.operator}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    }

                    if (reportType === 'summary') {
                      return (
                        <TableRow key={row.id || idx} hover>
                          <TableCell>{page * rowsPerPage + idx + 1}</TableCell>
                          <TableCell>{row.date}</TableCell>
                          <TableCell sx={{ fontWeight: '600' }}>{row.flour_mill || 'Standard Mill'}</TableCell>
                          <TableCell sx={{ fontWeight: '600', color: '#1e3a8a' }}>{row.item_name}</TableCell>
                          <TableCell><Chip label={row.lot_no} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '10px' }} /></TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>{row.input_qty} bags</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>{inWt.toFixed(2)} kg</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', color: '#16a34a' }}>{outWt.toFixed(2)} kg</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', color: '#15803d' }}>{yPerc.toFixed(2)}%</TableCell>
                          <TableCell>
                            <Typography variant="body2" fontSize="12px" fontWeight="600">{row.operator}</Typography>
                            <Typography variant="caption" color="text.secondary">{row.shift}</Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={row.final_approval || 'APPROVED'}
                              color={row.final_approval === 'APPROVED' ? 'success' : 'warning'}
                              size="small"
                              sx={{ fontWeight: 'bold', fontSize: '10px' }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    }

                    return (
                      <TableRow key={row.id || idx} hover>
                        <TableCell>{page * rowsPerPage + idx + 1}</TableCell>
                        <TableCell>{row.date}</TableCell>
                        <TableCell><Chip label={row.lot_no} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '10px' }} /></TableCell>
                        <TableCell sx={{ fontWeight: '600' }}>{row.item_name}</TableCell>
                        <TableCell sx={{ fontWeight: '500' }}>
                          {row.supplier_name && row.supplier_name !== 'N/A' ? row.supplier_name : (row.supplier || 'Kandiga / Velmurugan')}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>{row.input_qty} bags</TableCell>
                        <TableCell align="right">{row.bag_weight} kg</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#1e3a8a' }}>{row.processed_qty} bags ({row.input_wt} kg)</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#16a34a' }}>{row.yield_perc}%</TableCell>
                        <TableCell sx={{ color: '#0f766e', fontWeight: '500' }}>{row.output_desc}</TableCell>
                        <TableCell align="right" sx={{ color: '#991b1b' }}>{row.stone_qty} kg</TableCell>
                        <TableCell align="right" sx={{ color: '#dc2626' }}>{row.other_wastage_qty} kg</TableCell>
                        <TableCell align="right" sx={{ color: '#c2410c', fontWeight: '500' }}>{row.wastage_perc}%</TableCell>
                        <TableCell>
                          <Typography variant="body2" fontSize="12px" fontWeight="600">{row.operator}</Typography>
                          <Typography variant="caption" color="text.secondary">{row.shift}</Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Stack spacing={0.5} alignItems="center">
                            <Chip 
                              label={row.final_approval} 
                              color={row.final_approval === 'APPROVED' ? 'success' : 'warning'} 
                              size="small" 
                              sx={{ fontWeight: 'bold', fontSize: '10px' }}
                            />
                            <Typography variant="caption" fontSize="10px" color="text.secondary">
                              QC: {row.qc_technologist} | QA: {row.qa_manager}
                            </Typography>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })
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

export default DailyProductionReport;
