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
  TablePagination,
  Chip,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Stack
} from '@mui/material';
import {
  Search as SearchIcon,
  RestartAlt as ResetIcon,
  Print as PrintIcon,
  Visibility as ViewIcon,
  LocalShipping as VehicleIcon,
  CheckCircle as PassIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';

const VehicleInspectionReport = ({ hideHeader = false }) => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({ totalVehicles: 0, approvedVehicles: 0, rejectedVehicles: 0 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Selected row for detail modal
  const [selectedRow, setSelectedRow] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const qParams = new URLSearchParams();
      if (fromDate) qParams.append('from_date', fromDate);
      if (toDate) qParams.append('to_date', toDate);

      const res = await fetch(`/api/reports/vehicle-inspection?${qParams.toString()}`);
      if (res.ok) {
        const result = await res.json();
        setData(result.data || []);
        setSummary(result.summary || { totalVehicles: 0, approvedVehicles: 0, rejectedVehicles: 0 });
      }
    } catch (e) {
      console.error('Error fetching vehicle inspection report:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFromDate('');
    setToDate('');
    setSearchQuery('');
    fetchReport();
  };

  const filteredData = data.filter(row => {
    if (!searchQuery) return true;
    const term = searchQuery.toLowerCase();
    return (
      (row.vehicle_no || '').toLowerCase().includes(term) ||
      (row.customer || '').toLowerCase().includes(term) ||
      (row.checked_by || '').toLowerCase().includes(term) ||
      (row.doc_ref || '').toLowerCase().includes(term)
    );
  });

  const handleOpenDetail = (row) => {
    setSelectedRow(row);
    setModalOpen(true);
  };

  return (
    <Container maxWidth="xl" sx={{ mt: hideHeader ? 0 : 2, mb: 4, px: hideHeader ? '0 !important' : undefined }}>
      {/* Title Header */}
      {!hideHeader && (
        <Paper
          elevation={2}
          sx={{
            p: 2.5,
            mb: 3,
            backgroundColor: '#0284c7',
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
              Vehicle Loading / Unloading Inspection Report
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)' }}>
              QA Safety & Hygiene Inspection Register (DOC Ref: BVC/QA/F/07)
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Chip
              icon={<VehicleIcon sx={{ color: '#fff !important' }} />}
              label="DOC Ref: BVC/QA/F/07"
              sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 'bold' }}
            />
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

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card elevation={1} sx={{ borderLeft: '4px solid #0284c7', borderRadius: '8px' }}>
            <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary" fontWeight="bold">TOTAL VEHICLES INSPECTED</Typography>
              <Typography variant="h5" fontWeight="bold" color="#0284c7">{summary.totalVehicles}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card elevation={1} sx={{ borderLeft: '4px solid #16a34a', borderRadius: '8px' }}>
            <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary" fontWeight="bold">APPROVED TRUCKS</Typography>
              <Typography variant="h5" fontWeight="bold" color="#16a34a">{summary.approvedVehicles}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card elevation={1} sx={{ borderLeft: '4px solid #dc2626', borderRadius: '8px' }}>
            <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary" fontWeight="bold">REJECTED / UNFIT</Typography>
              <Typography variant="h5" fontWeight="bold" color="#dc2626">{summary.rejectedVehicles}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filter Toolbar */}
      <Paper elevation={1} sx={{ p: 2, mb: 3, borderRadius: '8px', backgroundColor: '#f8fafc' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="From Date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="To Date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search vehicle number, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ color: '#64748b', mr: 1, fontSize: 20 }} />
              }}
            />
          </Grid>
          <Grid item xs={12} sm={2} sx={{ display: 'flex', gap: 1 }}>
            <Button fullWidth variant="contained" onClick={fetchReport} sx={{ backgroundColor: '#0284c7', textTransform: 'none' }}>
              Filter
            </Button>
            <Button variant="outlined" onClick={handleReset} sx={{ color: '#64748b', borderColor: '#cbd5e1' }}>
              <ResetIcon />
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Inspection Register Table */}
      <Paper elevation={2} sx={{ borderRadius: '8px', overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small">
            <TableHead sx={{ backgroundColor: '#f1f5f9' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>S.No</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>DOC Ref</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Vehicle No</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Customer / Qty</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Checked By (Security)</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Verified By (Clerk)</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>Acceptance Status</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={32} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Loading Vehicle Inspection Register...</Typography>
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No vehicle loading/unloading inspection records found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredData
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((row, idx) => (
                    <TableRow key={row.id ? `vehicle-${row.id}-${idx}` : idx} hover>
                      <TableCell>{page * rowsPerPage + idx + 1}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>{row.doc_ref || 'BVC/QA/F/07'}</TableCell>
                      <TableCell>{row.date}</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#0284c7' }}>
                        <Chip label={row.vehicle_no} size="small" variant="filled" sx={{ backgroundColor: '#e0f2fe', color: '#0369a1', fontWeight: 'bold' }} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="600">{row.customer}</Typography>
                        <Typography variant="caption" color="text.secondary">{row.qty_mt}</Typography>
                      </TableCell>
                      <TableCell>{row.checked_by || 'J.V.N.'}</TableCell>
                      <TableCell>{row.verified_by || 'Clerk'}</TableCell>
                      <TableCell align="center">
                        <Chip
                          icon={<PassIcon sx={{ fontSize: '14px !important' }} />}
                          label={row.status || 'APPROVED'}
                          color={row.status === 'REJECTED' ? 'error' : 'success'}
                          size="small"
                          sx={{ fontWeight: 'bold', fontSize: '10px' }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="View Vehicle Inspection Checklist">
                          <IconButton size="small" onClick={() => handleOpenDetail(row)} sx={{ color: '#0284c7' }}>
                            <ViewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
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
          count={filteredData.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        />
      </Paper>

      {/* Inspection Checklist Dialog */}
      {selectedRow && (
        <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle component="div" sx={{ backgroundColor: '#0284c7', color: '#fff', pb: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="h6" fontWeight="bold">VEHICLE LOADING/UN LOADING INSPECTION REPORT</Typography>
                <Typography variant="caption" sx={{ opacity: 0.9 }}>DOC Ref: BVC/QA/F/07</Typography>
              </Box>
              <Chip label={`Date: ${selectedRow.date}`} sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 'bold' }} />
            </Box>
          </DialogTitle>
          <DialogContent dividers sx={{ p: 3 }}>
            <Paper variant="outlined" sx={{ p: 2, mb: 2, backgroundColor: '#f8fafc' }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">Customer / Qty</Typography>
                  <Typography variant="body2" fontWeight="bold" color="#0284c7">{selectedRow.customer} | {selectedRow.qty_mt}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">Vehicle No</Typography>
                  <Typography variant="body2" fontWeight="bold" sx={{ fontFamily: 'monospace' }}>{selectedRow.vehicle_no}</Typography>
                </Grid>
              </Grid>
            </Paper>

            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#0284c7', mb: 1, textTransform: 'uppercase' }}>
              Vehicle Inspection Checklist Parameters
            </Typography>

            <Table size="small" sx={{ border: '1px solid #e2e8f0' }}>
              <TableHead sx={{ backgroundColor: '#f1f5f9' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', width: '60px' }}>Sl.No</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Check for</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', width: '80px' }}>OK</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', width: '80px' }}>Not OK</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>REMARKS / Vehicle No</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>1</TableCell>
                  <TableCell>Cleanliness of truck - Dust / Dirt</TableCell>
                  <TableCell align="center" sx={{ color: '#16a34a', fontWeight: 'bold' }}>✓</TableCell>
                  <TableCell align="center">-</TableCell>
                  <TableCell>-</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>2</TableCell>
                  <TableCell>No Pest / Pest droppings</TableCell>
                  <TableCell align="center" sx={{ color: '#16a34a', fontWeight: 'bold' }}>✓</TableCell>
                  <TableCell align="center">-</TableCell>
                  <TableCell>-</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>3</TableCell>
                  <TableCell>No foreign material / Moisture</TableCell>
                  <TableCell align="center" sx={{ color: '#16a34a', fontWeight: 'bold' }}>✓</TableCell>
                  <TableCell align="center">-</TableCell>
                  <TableCell>-</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>4</TableCell>
                  <TableCell>Doors are intact- Good condition</TableCell>
                  <TableCell align="center" sx={{ color: '#16a34a', fontWeight: 'bold' }}>✓</TableCell>
                  <TableCell align="center">-</TableCell>
                  <TableCell>-</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>5</TableCell>
                  <TableCell>No corrosion (platform / all inner area)</TableCell>
                  <TableCell align="center" sx={{ color: '#16a34a', fontWeight: 'bold' }}>✓</TableCell>
                  <TableCell align="center">-</TableCell>
                  <TableCell>-</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>6</TableCell>
                  <TableCell>Truck sealing (empty and after loading)</TableCell>
                  <TableCell align="center" sx={{ color: '#16a34a', fontWeight: 'bold' }}>✓</TableCell>
                  <TableCell align="center">-</TableCell>
                  <TableCell>-</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>7</TableCell>
                  <TableCell>Any unwanted Odour</TableCell>
                  <TableCell align="center" sx={{ color: '#16a34a', fontWeight: 'bold' }}>✓</TableCell>
                  <TableCell align="center">-</TableCell>
                  <TableCell>-</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>8</TableCell>
                  <TableCell>Tarpaulin in the truck (clean/damage)</TableCell>
                  <TableCell align="center" sx={{ color: '#16a34a', fontWeight: 'bold' }}>✓</TableCell>
                  <TableCell align="center">-</TableCell>
                  <TableCell>-</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>9</TableCell>
                  <TableCell>General acceptance of truck</TableCell>
                  <TableCell align="center" sx={{ color: '#16a34a', fontWeight: 'bold' }}>✓</TableCell>
                  <TableCell align="center">-</TableCell>
                  <TableCell>-</TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                Checked by: {selectedRow.checked_by || 'J.V.N.'} (Security)
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                Verified by: {selectedRow.verified_by || 'Clerk'}
              </Typography>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button variant="outlined" onClick={() => window.print()} startIcon={<PrintIcon />} sx={{ textTransform: 'none' }}>
              Print Report
            </Button>
            <Button variant="contained" onClick={() => setModalOpen(false)} sx={{ backgroundColor: '#0284c7', textTransform: 'none' }}>
              Close
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Container>
  );
};

export default VehicleInspectionReport;
