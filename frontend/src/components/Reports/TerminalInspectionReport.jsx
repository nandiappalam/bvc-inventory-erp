import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  Grid,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Snackbar,
  Alert,
  Divider,
  Stack,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Print as PrintIcon,
  Save as SaveIcon,
  RestartAlt as ResetIcon,
  ArrowBack as ArrowBackIcon,
  CheckCircle as PassIcon,
  VerifiedUser as VerifiedIcon,
  Assignment as ReportIcon
} from '@mui/icons-material';
import { printHtml } from '../../utils/printHelper';

const DEFAULT_TERTIARY_DETAILS = [
  { id: '1a', label: '1.a MFG, Month and Year', req: 'Yes/No', finding: '-' },
  { id: '1b', label: '1.b Packing Configuration (No. of Packets)', req: 'Mentioned/Not Mentioned', finding: '-' },
  { id: '1c', label: '1.c Barcode', req: 'NA', finding: 'NA' },
  { id: '1d', label: '1.d Requirements (Wholesale Pack)', req: 'Mentioned/Not Mentioned', finding: '-' },
  { id: '1e', label: '1.e Lot Number', req: 'Mentioned/Not Mentioned', finding: '-' },
  { id: '2', label: '2 Whether Carton Boxes are Gum taped', req: 'NA', finding: 'NA' },
  { id: '3', label: '3 Stacking as per Specification', req: 'NA', finding: 'NA' },
  { id: '4', label: '4 Whether the packets are shrink wrapped', req: 'NA', finding: 'NA' },
  { id: '5', label: '5 Shortages found inside the box/carton/bag', req: 'Yes/No', finding: '-' },
  { id: '6', label: '6 Damages found inside the box/carton/bag', req: 'Yes/No', finding: '-' }
];

const DEFAULT_PRIMARY_DETAILS = [
  { id: 'p1', label: '1 Whether the product of india and Net wt. printed on the pack', req: 'Yes/No', finding: 'Yes' },
  { id: 'p2', label: '2 Whether ingredients are present on the pack', req: 'NA', finding: 'NA' },
  { id: 'p3', label: '3 whether the nutritional facts are appropriate', req: 'NA', finding: 'NA' },
  { id: 'p4', label: '4 whether Lot no. Mfd & Best before are printed on the pack', req: 'Yes/No', finding: 'Yes' },
  { id: 'p5', label: '5 whether Allergen Declaration trans fat are stated on the pack', req: 'Yes/No', finding: 'NO' },
  { id: 'p6', label: '6 Name of the country on the pack (export)', req: 'Yes/No', finding: 'NO' },
  { id: 'p7', label: '7 Whether the importer name printed (if applicable) on the pack', req: 'Yes/No', finding: 'NO' },
  { id: 'p8', label: '8 Whether the Barcode is present on the pack', req: 'NA', finding: 'NA' },
  { id: 'p9', label: '9 Analysis Reports (chemical/microbiological)', req: 'Available/Not available', finding: 'NA' }
];

const DEFAULT_PRODUCT_PARAMS = [
  { id: 'pr1', label: '1 Seal Integrity', req: 'NA', finding: 'NA' },
  { id: 'pr2', label: '2 Product Preparation', req: 'Checked at lab', finding: 'checked' },
  { id: 'pr3', label: '3 Dispatch Vehicle Cleaning/Hygiene', req: 'Verified/Not verified', finding: 'Verified' }
];

const PRESET_ITEMS = [
  'Urad Gota',
  'Bengal Gram Split',
  'Black Gram Gota',
  'Red Rice single boil',
  'Black Gram Split',
  'Urad split (vanban)',
  'Broken Rice'
];

const TerminalInspectionReport = ({ hideHeader = false }) => {
  const navigate = useNavigate();

  // Header Details
  const [reportDate, setReportDate] = useState('23.07.26');
  const [auditedBy, setAuditedBy] = useState('J.V.N.');
  const [itemName, setItemName] = useState('Urad Gota');

  // Audit Checklist Findings State
  const [tertiaryList, setTertiaryList] = useState(DEFAULT_TERTIARY_DETAILS);
  const [primaryList, setPrimaryList] = useState(DEFAULT_PRIMARY_DETAILS);
  const [productList, setProductList] = useState(DEFAULT_PRODUCT_PARAMS);

  // Snackbar Toast
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Handle Finding Change
  const handleFindingChange = (listType, id, newValue) => {
    if (listType === 'tertiary') {
      setTertiaryList(prev => prev.map(item => item.id === id ? { ...item, finding: newValue } : item));
    } else if (listType === 'primary') {
      setPrimaryList(prev => prev.map(item => item.id === id ? { ...item, finding: newValue } : item));
    } else if (listType === 'product') {
      setProductList(prev => prev.map(item => item.id === id ? { ...item, finding: newValue } : item));
    }
  };

  // Reset to default findings
  const handleReset = () => {
    setTertiaryList(DEFAULT_TERTIARY_DETAILS);
    setPrimaryList(DEFAULT_PRIMARY_DETAILS);
    setProductList(DEFAULT_PRODUCT_PARAMS);
    setSnackbar({ open: true, message: 'Audit findings reset to standard defaults.', severity: 'info' });
  };

  // Save Findings
  const handleSave = () => {
    setSnackbar({ open: true, message: `Terminal Inspection Report for "${itemName}" saved successfully!`, severity: 'success' });
  };

  // Print Official Terminal Inspection Report Document (Matching Page 3)
  const handlePrint = () => {
    const tertiaryRows = tertiaryList.map(item => `
      <tr>
        <td style="border: 1px solid #334155; padding: 6px 8px; text-align: center; font-size: 12px;">${item.id}</td>
        <td style="border: 1px solid #334155; padding: 6px 8px; font-size: 12px;">${item.label}</td>
        <td style="border: 1px solid #334155; padding: 6px 8px; font-size: 12px;">${item.req}</td>
        <td style="border: 1px solid #334155; padding: 6px 8px; font-weight: bold; font-size: 12px; color: ${item.finding === 'Yes' || item.finding === 'checked' || item.finding === 'Verified' ? '#16a34a' : item.finding === 'NO' ? '#dc2626' : '#1e293b'};">${item.finding}</td>
      </tr>
    `).join('');

    const primaryRows = primaryList.map(item => `
      <tr>
        <td style="border: 1px solid #334155; padding: 6px 8px; text-align: center; font-size: 12px;">${item.id.replace('p', '')}</td>
        <td style="border: 1px solid #334155; padding: 6px 8px; font-size: 12px;">${item.label}</td>
        <td style="border: 1px solid #334155; padding: 6px 8px; font-size: 12px;">${item.req}</td>
        <td style="border: 1px solid #334155; padding: 6px 8px; font-weight: bold; font-size: 12px; color: ${item.finding === 'Yes' ? '#16a34a' : item.finding === 'NO' ? '#dc2626' : '#1e293b'};">${item.finding}</td>
      </tr>
    `).join('');

    const productRows = productList.map(item => `
      <tr>
        <td style="border: 1px solid #334155; padding: 6px 8px; text-align: center; font-size: 12px;">${item.id.replace('pr', '')}</td>
        <td style="border: 1px solid #334155; padding: 6px 8px; font-size: 12px;">${item.label}</td>
        <td style="border: 1px solid #334155; padding: 6px 8px; font-size: 12px;">${item.req}</td>
        <td style="border: 1px solid #334155; padding: 6px 8px; font-weight: bold; font-size: 12px; color: ${item.finding === 'checked' || item.finding === 'Verified' ? '#16a34a' : '#1e293b'};">${item.finding}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 30px; color: #0f172a; max-width: 900px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 15px;">
          <div>
            <span style="font-size: 13px; font-weight: bold;">Date: <u>${reportDate}</u></span>
          </div>
          <div style="text-align: center;">
            <h2 style="margin: 0; font-size: 20px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Terminal Inspection Report</h2>
          </div>
          <div>
            <span style="font-size: 13px; font-weight: bold;">Inspected/Audited By: <u>${auditedBy}</u></span>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background-color: #f1f5f9; border: 1px solid #334155;">
              <th style="border: 1px solid #334155; padding: 6px; width: 50px; font-size: 12px; text-align: center;">S.NO</th>
              <th style="border: 1px solid #334155; padding: 6px; font-size: 12px; text-align: left;">AUDIT PARAMETERS</th>
              <th style="border: 1px solid #334155; padding: 6px; width: 220px; font-size: 12px; text-align: left;">REQUIREMENT</th>
              <th style="border: 1px solid #334155; padding: 6px; width: 180px; font-size: 12px; text-align: left;">AUDIT FINDINGS</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background-color: #f8fafc;">
              <td style="border: 1px solid #334155; padding: 6px; font-weight: bold; text-align: center; font-size: 12px;">1</td>
              <td colspan="3" style="border: 1px solid #334155; padding: 6px; font-weight: bold; font-size: 13px;">Name: <u>${itemName}</u></td>
            </tr>

            <!-- Tertiary / Secondary Packing Details -->
            <tr>
              <td colspan="4" style="border: 1px solid #334155; padding: 6px 10px; font-weight: bold; background-color: #e2e8f0; font-size: 12px; text-align: center; text-transform: uppercase;">
                Tertiary/Secondary Packing Details
              </td>
            </tr>
            ${tertiaryRows}

            <!-- Primary Packing details -->
            <tr>
              <td colspan="4" style="border: 1px solid #334155; padding: 6px 10px; font-weight: bold; background-color: #e2e8f0; font-size: 12px; text-align: center; text-transform: uppercase;">
                Primary Packing details
              </td>
            </tr>
            ${primaryRows}

            <!-- Product parameters -->
            <tr>
              <td colspan="4" style="border: 1px solid #334155; padding: 6px 10px; font-weight: bold; background-color: #e2e8f0; font-size: 12px; text-align: center; text-transform: uppercase;">
                Product parameters
              </td>
            </tr>
            ${productRows}
          </tbody>
        </table>

        <div style="display: flex; justify-content: space-between; margin-top: 40px; font-size: 13px; font-weight: bold;">
          <div>QC Technologist Sign: _______________</div>
          <div>QA Manager Sign: _______________</div>
        </div>
      </div>
    `;

    printHtml(html);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: hideHeader ? 0 : 2, mb: 4, px: hideHeader ? '0 !important' : undefined }}>
      {/* Title Header */}
      {!hideHeader && (
        <Paper
          elevation={2}
          sx={{
            p: 2.5,
            mb: 3,
            backgroundColor: '#0f766e',
            color: '#ffffff',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 2
          }}
        >
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 'bold', letterSpacing: '0.5px' }}>
              Terminal Inspection Report
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)' }}>
              Factory Processing, CCP & Quality Inspection Audit Form
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/reports')}
              sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.6)', textTransform: 'none', fontWeight: 'bold', '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' } }}
            >
              All Reports
            </Button>
          </Box>
        </Paper>
      )}

      {/* Main Report Form Card */}
      <Paper elevation={3} sx={{ p: 3, borderRadius: '8px', border: '1px solid #cbd5e1' }}>
        {/* Top Header Fields matching UG Traceability File */}
        <Box sx={{ borderBottom: '2px solid #0f766e', pb: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                size="small"
                label="Date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                placeholder="dd.mm.yy"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="h6" align="center" fontWeight="bold" color="#0f766e" sx={{ textTransform: 'uppercase' }}>
                Terminal Inspection Report
              </Typography>
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                size="small"
                label="Inspected/Audited By"
                value={auditedBy}
                onChange={(e) => setAuditedBy(e.target.value)}
              />
            </Grid>
          </Grid>

          {/* Item Selector */}
          <Grid container spacing={2} sx={{ mt: 1 }} alignItems="center">
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel id="item-name-select-label">Select Item Name</InputLabel>
                <Select
                  labelId="item-name-select-label"
                  label="Select Item Name"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  sx={{ fontWeight: 'bold', color: '#0f766e' }}
                >
                  {PRESET_ITEMS.map((item) => (
                    <MenuItem key={item} value={item}>
                      {item}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Name (Commodity / Item)"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                helperText="Editable Item name for audit inspection record"
              />
            </Grid>
          </Grid>
        </Box>

        {/* Audit Parameters Table */}
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '6px', mb: 3 }}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: '#f1f5f9' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', width: '70px', textAlign: 'center' }}>S.NO</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>AUDIT PARAMETERS</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '220px' }}>REQUIREMENT</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '220px' }}>AUDIT FINDINGS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {/* Item Header Row */}
              <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>1</TableCell>
                <TableCell colSpan={3} sx={{ fontWeight: 'bold', color: '#0f766e', fontSize: '15px' }}>
                  Name: {itemName}
                </TableCell>
              </TableRow>

              {/* 1. Tertiary / Secondary Packing Details Header */}
              <TableRow sx={{ backgroundColor: '#e2e8f0' }}>
                <TableCell colSpan={4} align="center" sx={{ fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase', py: 1 }}>
                  Tertiary/Secondary Packing Details
                </TableCell>
              </TableRow>
              {tertiaryList.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell align="center" sx={{ fontSize: '12px' }}>{row.id}</TableCell>
                  <TableCell sx={{ fontSize: '13px' }}>{row.label}</TableCell>
                  <TableCell sx={{ fontSize: '13px', color: 'text.secondary' }}>{row.req}</TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      value={row.finding}
                      onChange={(e) => handleFindingChange('tertiary', row.id, e.target.value)}
                      variant="outlined"
                      inputProps={{ style: { padding: '4px 8px', fontSize: '13px', fontWeight: 'bold' } }}
                    />
                  </TableCell>
                </TableRow>
              ))}

              {/* 2. Primary Packing Details Header */}
              <TableRow sx={{ backgroundColor: '#e2e8f0' }}>
                <TableCell colSpan={4} align="center" sx={{ fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase', py: 1 }}>
                  Primary Packing details
                </TableCell>
              </TableRow>
              {primaryList.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell align="center" sx={{ fontSize: '12px' }}>{row.id.replace('p', '')}</TableCell>
                  <TableCell sx={{ fontSize: '13px' }}>{row.label}</TableCell>
                  <TableCell sx={{ fontSize: '13px', color: 'text.secondary' }}>{row.req}</TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      value={row.finding}
                      onChange={(e) => handleFindingChange('primary', row.id, e.target.value)}
                      variant="outlined"
                      inputProps={{
                        style: {
                          padding: '4px 8px',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          color: row.finding === 'Yes' ? '#16a34a' : row.finding === 'NO' ? '#dc2626' : 'inherit'
                        }
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}

              {/* 3. Product Parameters Header */}
              <TableRow sx={{ backgroundColor: '#e2e8f0' }}>
                <TableCell colSpan={4} align="center" sx={{ fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase', py: 1 }}>
                  Product parameters
                </TableCell>
              </TableRow>
              {productList.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell align="center" sx={{ fontSize: '12px' }}>{row.id.replace('pr', '')}</TableCell>
                  <TableCell sx={{ fontSize: '13px' }}>{row.label}</TableCell>
                  <TableCell sx={{ fontSize: '13px', color: 'text.secondary' }}>{row.req}</TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      value={row.finding}
                      onChange={(e) => handleFindingChange('product', row.id, e.target.value)}
                      variant="outlined"
                      inputProps={{
                        style: {
                          padding: '4px 8px',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          color: row.finding === 'checked' || row.finding === 'Verified' ? '#16a34a' : 'inherit'
                        }
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Action Controls */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={handleReset}
            startIcon={<ResetIcon />}
            sx={{ textTransform: 'none', color: '#64748b', borderColor: '#cbd5e1' }}
          >
            Reset Default Findings
          </Button>

          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              onClick={handlePrint}
              startIcon={<PrintIcon />}
              sx={{ textTransform: 'none', fontWeight: 'bold' }}
            >
              Print Official Report
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              startIcon={<SaveIcon />}
              sx={{ backgroundColor: '#0f766e', textTransform: 'none', fontWeight: 'bold', '&:hover': { backgroundColor: '#115e59' } }}
            >
              Save Audit Report
            </Button>
          </Stack>
        </Box>
      </Paper>

      {/* Snackbar Toast */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%', fontWeight: 'bold' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default TerminalInspectionReport;
