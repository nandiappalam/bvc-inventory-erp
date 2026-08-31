import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Button,
  TextField,
  InputAdornment,
  MenuItem,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DescriptionIcon from '@mui/icons-material/Description';
import PrintIcon from '@mui/icons-material/Print';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

const TEMPLATES = [
  { code: 'D1', title: 'Work Instruction (WI) Template', category: 'Controlled', format: 'ISO 22000 / Standard Standard Operating Form' },
  { code: 'D2', title: 'HACCP & OPRP Hazard Analysis Worksheet', category: 'Controlled', format: 'Codex Alimentarius Hazard Plan' },
  { code: 'D3', title: 'Raw Material Specification & MTR Format', category: 'Controlled', format: 'Supplier Quality Technical Specification' },
  { code: 'D4', title: 'Food Safety Training & Assessment Log', category: 'Controlled', format: 'Employee Competency Evaluation Form' },
  { code: 'D5', title: 'Standard Operating Procedure (SOP) Template', category: 'Controlled', format: 'Controlled Quality Management System' },
  { code: 'D6', title: 'RCCA / 5-Why Problem Solving Sheet', category: 'Controlled', format: 'CAPA Corrective Action Report' },
  { code: 'D7', title: 'Employee Medical Fitness Certificate Format', category: 'Controlled', format: 'FSSAI Schedule 4 Form IX Format' },
  { code: 'D8', title: 'FOSTAC Certification Tracker Template', category: 'Controlled', format: 'FSSAI Food Safety Supervisor Form' },
  { code: 'D9', title: 'Crisis Recall & Withdrawal Drill Matrix', category: 'Controlled', format: 'FSSAI Recall Procedure Standard' },
  { code: 'D10', title: 'Halal Assurance Declaration Standard', category: 'Controlled', format: 'Halal Certification Compliance Statement' },
  { code: 'D11', title: 'Manufacturing Process Flow Chart Template', category: 'Controlled', format: 'HACCP Process Steps & CCP Mapping' },
  { code: 'P1', title: 'Incoming Raw Material Quality (IQR) Slip', category: 'Production', format: 'Lab Test & Physical Quality Form' },
  { code: 'P2', title: 'Fumigation & Pest Treatment Log', category: 'Production', format: 'Phosphine / Methyl Bromide Safety Sheet' },
  { code: 'P3', title: 'In-Process Quality & Milling Checklist', category: 'Production', format: 'Batch Processing & Visual Quality Form' },
  { code: 'P4', title: 'CCP 2-Hourly Magnet & Sieve Monitoring Sheet', category: 'Production', format: 'Critical Limit Verification Form' },
  { code: 'P5', title: 'Product Changeover & Line Clearance Sheet', category: 'Production', format: 'Cross-Contamination Prevention Sheet' },
  { code: 'P6', title: 'Certificate of Analysis (COA) Official Form', category: 'Production', format: 'Finished Goods Release & FSSAI Parameters' },
  { code: 'P7', title: 'Vehicle Loading & Terminal Inspection Slip', category: 'Production', format: 'Pre-Dispatch & Container Quality Form' },
  { code: 'C1', title: 'Production Area Cleaning (BVC/CP/CL/01)', category: 'Cleaning', format: 'Daily Floor, Wall, Equipment & Drain Sanitation Register' },
  { code: 'C2', title: 'Machineries Cleaning (BVC/CP/CL/02)', category: 'Cleaning', format: '15 Days Once Motor Cover, De-Stoner & Pulse Roller Cleaning' },
  { code: 'C3', title: 'Pest Control Cleaning (BVC/CP/CL/03)', category: 'Cleaning', format: 'Monthly Once PCI Operators & Chemical Treatment Register' },
  { code: 'C4', title: 'Water Tank Cleaning (BVC/CP/CL/04)', category: 'Cleaning', format: '15 Days Once Overhead & Process Water Tank Sanitation Log' },
  { code: 'C5', title: 'Window-Glass Cleaning (BVC/CP/CL/05)', category: 'Cleaning', format: 'Monthly Once Factory Glazing & Glass Partitions Check' },
  { code: 'C6', title: 'Wood-Pallet Cleaning (BVC/CP/CL/06)', category: 'Cleaning', format: '15 Days Once Pallet Heat Treatment & Cleanliness Register' },
  { code: 'C7', title: 'Toilet Inspection Checklist (BVC-QA-F-05)', category: 'Cleaning', format: 'Daily Facility Restroom, Basin & Water Supply Inspection' },
  { code: 'C8', title: 'Vehicle Loading / Unloading Inspection (BVC/QA/F/07)', category: 'Cleaning', format: 'Loading & Inward Transport Odor, Tarpaulin & Cleanliness Check' },
  { code: 'C9', title: 'Food Handlers Personal Hygiene (BVC/QA/F/01)', category: 'Cleaning', format: 'Daily Grooming, Nails, Uniform, Jewelry & Health Sheet' },
  { code: 'C10', title: 'Primary Packing Material Inspection (PPMI/QA/F/08)', category: 'Cleaning', format: 'PM Receiving Virgin HDPE Liner, Bursting & Food-Grade Check' },
];

export default function DocumentTemplatesView({ onCreateDoc, onNavigateTab }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [previewTemplate, setPreviewTemplate] = useState(null);

  const filtered = TEMPLATES.filter((t) => {
    const matchesSearch =
      t.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.format.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = categoryFilter === 'ALL' || t.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DescriptionIcon sx={{ color: '#1f4fb2', fontSize: 28 }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
              Standard Compliance Document Templates (29 Formats)
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Pre-configured FSSAI, ISO 22000, and HACCP compliant document templates ready for printing and digital generation.
          </Typography>
        </Box>
      </Box>

      {/* Filter Bar */}
      <Card sx={{ mb: 3, p: 2, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={8}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search template by code (e.g. D1, P4, C9) or format..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: '#64748b' }} />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              select
              fullWidth
              size="small"
              label="Filter by Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <MenuItem value="ALL">All Categories</MenuItem>
              <MenuItem value="Controlled">Controlled Documents (D1–D11)</MenuItem>
              <MenuItem value="Production">Production Records (P1–P8)</MenuItem>
              <MenuItem value="Cleaning">Cleaning & Control (C1–C10)</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Card>

      {/* Template Cards Grid */}
      <Grid container spacing={2}>
        {filtered.map((t) => (
          <Grid item xs={12} sm={6} md={4} key={t.code}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                borderRadius: 2,
                border: '1px solid #e2e8f0',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 6px 16px rgba(0,0,0,0.06)',
                },
              }}
            >
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Chip
                    label={t.code}
                    size="small"
                    sx={{
                      fontWeight: 'bold',
                      bgcolor: t.code.startsWith('D') ? '#faf5ff' : t.code.startsWith('P') ? '#eff6ff' : '#f0fdf4',
                      color: t.code.startsWith('D') ? '#7e22ce' : t.code.startsWith('P') ? '#1d4ed8' : '#15803d',
                      border: '1px solid currentColor',
                    }}
                  />
                  <Chip label={t.category} size="small" variant="outlined" sx={{ fontSize: '10px' }} />
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a', mb: 1 }}>
                  {t.title}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                  {t.format}
                </Typography>
              </CardContent>

              <Box sx={{ p: 2, pt: 0, display: 'flex', gap: 1 }}>
                <Button
                  fullWidth
                  size="small"
                  variant="outlined"
                  startIcon={<VisibilityIcon />}
                  onClick={() => setPreviewTemplate(t)}
                  sx={{ fontSize: '11px', textTransform: 'none' }}
                >
                  Preview
                </Button>
                <Button
                  fullWidth
                  size="small"
                  variant="contained"
                  startIcon={<AddCircleOutlineIcon />}
                  onClick={() => {
                    if (t.code.startsWith('D') && onCreateDoc) {
                      onCreateDoc(t.code);
                    } else if (t.code.startsWith('P') && onNavigateTab) {
                      onNavigateTab(1);
                    } else if (onNavigateTab) {
                      onNavigateTab(2);
                    }
                  }}
                  sx={{ fontSize: '11px', textTransform: 'none', bgcolor: '#1f4fb2' }}
                >
                  Use Template
                </Button>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Preview Dialog */}
      {previewTemplate && (
        <Dialog
          open={Boolean(previewTemplate)}
          onClose={() => setPreviewTemplate(null)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ bgcolor: '#1f4fb2', color: 'white', fontWeight: 'bold' }}>
            Template Preview: {previewTemplate.code} - {previewTemplate.title}
          </DialogTitle>
          <DialogContent sx={{ p: 3, mt: 2 }}>
            <Paper variant="outlined" sx={{ p: 3, bgcolor: '#ffffff', border: '2px solid #0f172a' }}>
              <Box sx={{ textAlign: 'center', borderBottom: '2px solid #0f172a', pb: 2, mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', letterSpacing: 1 }}>
                  BVC EXPORTS PVT. LTD. - FOOD SAFETY MANAGEMENT SYSTEM
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>
                  {previewTemplate.title.toUpperCase()} (CODE: {previewTemplate.code})
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Compliant with FSSAI Regulations & ISO 22000:2018 Standard
                </Typography>
              </Box>

              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ display: 'block' }}><strong>Doc No:</strong> {previewTemplate.code}-STD-001</Typography>
                  <Typography variant="caption" sx={{ display: 'block' }}><strong>Category:</strong> {previewTemplate.category}</Typography>
                </Grid>
                <Grid item xs={6} sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" sx={{ display: 'block' }}><strong>Version:</strong> 1.0 (Active)</Typography>
                  <Typography variant="caption" sx={{ display: 'block' }}><strong>Effective Date:</strong> 01-Apr-2026</Typography>
                </Grid>
              </Grid>

              <Divider sx={{ my: 1.5 }} />

              <Typography variant="body2" sx={{ color: '#475569', my: 2 }}>
                This standardized official template layout contains all mandatory fields, critical limit parameters, operator checklist signatures, and supervisor verification columns. Clicking "Use Template" loads this structure into the digital entry module.
              </Typography>

              <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 1, border: '1px dashed #cbd5e1' }}>
                <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', mb: 0.5 }}>
                  Standard Scope & Form Structure:
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  {previewTemplate.format}
                </Typography>
              </Box>
            </Paper>
          </DialogContent>
          <DialogActions sx={{ p: 2, bgcolor: '#f8fafc' }}>
            <Button onClick={() => setPreviewTemplate(null)} sx={{ textTransform: 'none' }}>
              Close
            </Button>
            <Button
              variant="contained"
              startIcon={<PrintIcon />}
              onClick={() => window.print()}
              sx={{ bgcolor: '#1f4fb2', textTransform: 'none' }}
            >
              Print Template
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
