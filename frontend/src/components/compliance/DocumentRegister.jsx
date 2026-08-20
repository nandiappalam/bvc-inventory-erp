import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  TextField,
  InputAdornment,
  MenuItem,
  Grid,
  CircularProgress,
  Alert,
  Tooltip,
  IconButton,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import SanitizerIcon from '@mui/icons-material/Sanitizer';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import EmergencyShareIcon from '@mui/icons-material/EmergencyShare';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const CATEGORY_COLORS = {
  PRODUCTION_RECORD: { bg: '#eff6ff', border: '#3b82f6', text: '#1d4ed8', label: 'Production (P1–P8)' },
  CLEANING_RECORD: { bg: '#f0fdf4', border: '#22c55e', text: '#15803d', label: 'Cleaning (C1–C10)' },
  CONTROLLED_DOCUMENT: { bg: '#faf5ff', border: '#a855f7', text: '#7e22ce', label: 'Controlled (D1–D11)' },
};

const MODE_COLORS = {
  HYBRID: 'primary',
  CHECKLIST: 'success',
  CONTROLLED_DOCUMENT: 'secondary',
  ERP_FETCH: 'info',
  ERP_GENERATED: 'warning',
  MANUAL: 'default',
};

export default function DocumentRegister({
  onCreateDoc,
  onViewDoc,
  onOpenTraceability,
  onOpenRecall,
  onNavigateTab,
}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedMode, setSelectedMode] = useState('ALL');
  const [selectedFrequency, setSelectedFrequency] = useState('ALL');

  const fetchRegister = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/compliance/master-register');
      const json = await res.json();
      if (json.success) {
        setData(json.documents || []);
        setError(null);
      } else {
        setError(json.error || 'Failed to load master register');
      }
    } catch (err) {
      console.error('Error loading master register:', err);
      setError('Unable to reach server. Please check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegister();
  }, []);

  const filteredDocs = data.filter((doc) => {
    const matchesSearch =
      doc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.erp_data && doc.erp_data.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory =
      selectedCategory === 'ALL' || doc.category === selectedCategory;

    const matchesMode =
      selectedMode === 'ALL' || doc.creation_mode === selectedMode;

    const matchesFreq =
      selectedFrequency === 'ALL' ||
      (doc.frequency && doc.frequency.toLowerCase().includes(selectedFrequency.toLowerCase()));

    return matchesSearch && matchesCategory && matchesMode && matchesFreq;
  });

  const handleAction = (doc) => {
    if (doc.code === 'P8') {
      if (onOpenTraceability) onOpenTraceability();
      else if (onNavigateTab) onNavigateTab(3);
    } else if (doc.code === 'D9') {
      if (onOpenRecall) onOpenRecall();
      else if (onNavigateTab) onNavigateTab(4);
    } else if (doc.category === 'CONTROLLED_DOCUMENT') {
      if (onCreateDoc) onCreateDoc(doc.code);
    } else if (doc.category === 'PRODUCTION_RECORD') {
      if (onNavigateTab) onNavigateTab(1);
    } else if (doc.category === 'CLEANING_RECORD') {
      if (onNavigateTab) onNavigateTab(2);
    }
  };

  return (
    <Box>
      {/* Title & Stats */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MenuBookIcon sx={{ color: '#1f4fb2', fontSize: 28 }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
              Master Document Register (29 Standard BVC Records)
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Centralized register categorizing Production Records (P1–P8), Cleaning Records (C1–C10), and Controlled Documents (D1–D11).
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Chip label="29 Standard Documents" sx={{ fontWeight: 'bold', bgcolor: '#1f4fb2', color: 'white' }} />
          <Chip label="8 Production" sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 600 }} />
          <Chip label="10 Cleaning" sx={{ bgcolor: '#f0fdf4', color: '#15803d', fontWeight: 600 }} />
          <Chip label="11 Controlled" sx={{ bgcolor: '#faf5ff', color: '#7e22ce', fontWeight: 600 }} />
        </Box>
      </Box>

      {/* Filter Bar */}
      <Card sx={{ mb: 3, p: 2, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search code (P4, C1, D5), title or ERP source..."
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

          <Grid item xs={12} sm={2.6} md={2.6}>
            <TextField
              select
              fullWidth
              size="small"
              label="Category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <MenuItem value="ALL">All Categories (29)</MenuItem>
              <MenuItem value="PRODUCTION_RECORD">Production Records (P1–P8)</MenuItem>
              <MenuItem value="CLEANING_RECORD">Cleaning Records (C1–C10)</MenuItem>
              <MenuItem value="CONTROLLED_DOCUMENT">Controlled Docs (D1–D11)</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12} sm={2.6} md={2.6}>
            <TextField
              select
              fullWidth
              size="small"
              label="Creation Mode"
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value)}
            >
              <MenuItem value="ALL">All Creation Modes</MenuItem>
              <MenuItem value="HYBRID">HYBRID (ERP + Manual)</MenuItem>
              <MenuItem value="CHECKLIST">CHECKLIST (Standard Form)</MenuItem>
              <MenuItem value="CONTROLLED_DOCUMENT">CONTROLLED_DOCUMENT (Versioned)</MenuItem>
              <MenuItem value="ERP_FETCH">ERP_FETCH (Automated Trace)</MenuItem>
              <MenuItem value="ERP_GENERATED">ERP_GENERATED (COA / QC)</MenuItem>
              <MenuItem value="MANUAL">MANUAL (Record Form)</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12} sm={2.8} md={2.8}>
            <TextField
              select
              fullWidth
              size="small"
              label="Frequency"
              value={selectedFrequency}
              onChange={(e) => setSelectedFrequency(e.target.value)}
            >
              <MenuItem value="ALL">All Frequencies</MenuItem>
              <MenuItem value="Daily">Daily</MenuItem>
              <MenuItem value="15 Days">15 Days Once</MenuItem>
              <MenuItem value="Monthly">Monthly</MenuItem>
              <MenuItem value="Loading">Loading / Dispatch</MenuItem>
              <MenuItem value="RM Receiving">RM Receiving</MenuItem>
              <MenuItem value="Annual">Annual Review</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Card>

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f1f5f9' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', width: 50, py: 1.5 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 75 }}>Code</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Document Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 170 }}>Category</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 140 }}>Creation Mode</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 130 }}>Frequency</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 220 }}>ERP Data Integration</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 90, textAlign: 'center' }}>Records</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 140, textAlign: 'center' }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredDocs.map((doc) => {
                const cat = CATEGORY_COLORS[doc.category] || CATEGORY_COLORS.CONTROLLED_DOCUMENT;
                return (
                  <TableRow
                    key={doc.code}
                    hover
                    sx={{
                      '&:nth-of-type(even)': { bgcolor: '#fafafa' },
                      '&:hover': { bgcolor: '#f0f7ff' },
                    }}
                  >
                    <TableCell sx={{ color: '#64748b', fontSize: '12px' }}>{doc.s_no}</TableCell>
                    <TableCell>
                      <Chip
                        label={doc.code}
                        size="small"
                        sx={{
                          fontWeight: 800,
                          bgcolor: cat.bg,
                          color: cat.text,
                          border: `1px solid ${cat.border}`,
                          width: 44,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e293b' }}>
                        {doc.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={cat.label}
                        size="small"
                        sx={{
                          fontSize: '11px',
                          fontWeight: 600,
                          bgcolor: cat.bg,
                          color: cat.text,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={doc.creation_mode}
                        size="small"
                        color={MODE_COLORS[doc.creation_mode] || 'default'}
                        variant="outlined"
                        sx={{ fontSize: '11px', fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: '#475569' }}>
                        {doc.frequency}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ color: '#64748b', display: 'block', maxWidth: 210 }}>
                        {doc.erp_data}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={doc.record_count}
                        size="small"
                        sx={{
                          bgcolor: doc.record_count > 0 ? '#dcfce7' : '#f1f5f9',
                          color: doc.record_count > 0 ? '#166534' : '#64748b',
                          fontWeight: 'bold',
                        }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => handleAction(doc)}
                        startIcon={doc.code === 'P8' ? <AltRouteIcon /> : doc.code === 'D9' ? <EmergencyShareIcon /> : <PlayArrowIcon />}
                        sx={{
                          fontSize: '11px',
                          textTransform: 'none',
                          py: 0.4,
                          px: 1.2,
                          bgcolor: '#1f4fb2',
                          '&:hover': { bgcolor: '#173b87' },
                        }}
                      >
                        {doc.category === 'CONTROLLED_DOCUMENT' ? 'Open Doc' : 'Log / View'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredDocs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 3, color: '#64748b' }}>
                    No standard document found matching current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
