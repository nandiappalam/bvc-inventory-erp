import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Tooltip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LockIcon from '@mui/icons-material/Lock';
import SearchIcon from '@mui/icons-material/Search';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const themeColors = {
  primary: '#1f4fb2',
  secondary: '#2a5ea0',
  lightBlue: '#dbe7fb',
  lighterBlue: '#eaf2fb',
  white: '#ffffff',
  textPrimary: '#333333',
};

const formatDateDisplay = (dateStr) => {
  if (!dateStr) return '--';
  // If already in YYYY-MM-DD
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [y, m, d] = dateStr.split('-');
    return `${d}-${m}-${y}`;
  }
  return dateStr;
};

const FinancialYearDisplay = () => {
  const navigate = useNavigate();
  const { selectedCompany, user, isAdmin, hasPermission, updateFinancialYear } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [financialYears, setFinancialYears] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search & Filter State
  const [searchParams, setSearchParams] = useState({
    financialYear: '',
    status: 'All',
    current: 'All'
  });

  // View Modal State
  const [viewItem, setViewItem] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);

  // Check permission
  const canView = isAdmin || hasPermission('Financial Year', 'Display', 'can_view') || hasPermission('User', 'can_view');
  const canCreate = isAdmin || hasPermission('Financial Year', 'Create', 'can_create') || hasPermission('User', 'can_create');

  useEffect(() => {
    if (canView) {
      fetchFinancialYears();
    }
  }, [selectedCompany?.id, canView]);

  const fetchFinancialYears = async () => {
    try {
      setLoading(true);
      setError('');
      const companyId = selectedCompany?.id || 1;
      const response = await fetch(`/api/financial-years/${companyId}`);
      const data = await response.json();
      
      if (response.ok) {
        setFinancialYears(Array.isArray(data) ? data : []);
      } else {
        setError(data.message || 'Failed to fetch financial years');
      }
    } catch (error) {
      setError('Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  const handleSetCurrent = async (id, fyName) => {
    try {
      setError('');
      const response = await fetch(`/api/financial-years/${id}/set-current`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: selectedCompany?.id || 1 })
      });
      
      const data = await response.json();

      if (response.ok) {
        setSuccess(`Financial year ${fyName || ''} set as current successfully!`);
        updateFinancialYear(fyName);
        fetchFinancialYears();
      } else {
        setError(data.message || 'Failed to set as current financial year.');
      }
    } catch (err) {
      setError('Error connecting to server.');
    }
  };

  const handleCloseFY = async (id, fyName) => {
    if (!window.confirm(`Are you sure you want to close financial year ${fyName}?`)) return;

    try {
      setError('');
      const response = await fetch(`/api/financial-years/${id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closed_by: user?.username || 'admin' })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Financial year ${fyName} closed successfully!`);
        fetchFinancialYears();
      } else {
        setError(data.message || 'Failed to close financial year.');
      }
    } catch (err) {
      setError('Error connecting to server.');
    }
  };

  const handleDeleteFY = async (id, fyName) => {
    if (!window.confirm(`Are you sure you want to delete financial year ${fyName}?`)) return;

    try {
      setError('');
      const response = await fetch(`/api/financial-years/${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Financial year ${fyName} deleted successfully!`);
        fetchFinancialYears();
      } else {
        setError(data.message || 'Cannot delete financial year.');
      }
    } catch (err) {
      setError('Error connecting to server.');
    }
  };

  const handleViewDetails = (year) => {
    setViewItem(year);
    setViewModalOpen(true);
  };

  const handleResetFilters = () => {
    setSearchParams({
      financialYear: '',
      status: 'All',
      current: 'All'
    });
  };

  // Filtered List calculation
  const filteredYears = financialYears.filter(year => {
    const fyMatch = !searchParams.financialYear || 
      (year.financial_year && year.financial_year.toLowerCase().includes(searchParams.financialYear.toLowerCase())) ||
      (year.year_name && year.year_name.toLowerCase().includes(searchParams.financialYear.toLowerCase()));

    const statusMatch = searchParams.status === 'All' || 
      (year.status && year.status.toLowerCase() === searchParams.status.toLowerCase());

    const isCurrentBool = year.is_current === 1 || year.is_active === 1;
    const currentMatch = searchParams.current === 'All' ||
      (searchParams.current === 'Yes' && isCurrentBool) ||
      (searchParams.current === 'No' && !isCurrentBool);

    return fyMatch && statusMatch && currentMatch;
  });

  if (!canView) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">You don't have permission to view Financial Years</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: '1200px', margin: '0 auto' }}>
      {/* Top Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate(-1)} color="primary">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" sx={{ fontWeight: 'bold', color: themeColors.primary }}>
            Financial Year List
          </Typography>
        </Box>
        {canCreate && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/features/financial-year-create')}
            sx={{ backgroundColor: themeColors.primary, fontWeight: 'bold', px: 3 }}
          >
            + Create Financial Year
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Filter Card */}
      <Card elevation={2} sx={{ mb: 3, borderRadius: '8px', borderLeft: `4px solid ${themeColors.primary}` }}>
        <CardContent sx={{ p: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: themeColors.primary, mb: 2 }}>
            Search Financial Year
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4}>
              <TextField
                label="Financial Year"
                placeholder="Search..."
                value={searchParams.financialYear}
                onChange={(e) => setSearchParams(prev => ({ ...prev, financialYear: e.target.value }))}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel id="filter-status-label">Status</InputLabel>
                <Select
                  labelId="filter-status-label"
                  label="Status"
                  value={searchParams.status}
                  onChange={(e) => setSearchParams(prev => ({ ...prev, status: e.target.value }))}
                >
                  <MenuItem value="All">All</MenuItem>
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Closed">Closed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel id="filter-current-label">Current</InputLabel>
                <Select
                  labelId="filter-current-label"
                  label="Current"
                  value={searchParams.current}
                  onChange={(e) => setSearchParams(prev => ({ ...prev, current: e.target.value }))}
                >
                  <MenuItem value="All">All</MenuItem>
                  <MenuItem value="Yes">Yes</MenuItem>
                  <MenuItem value="No">No</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={2} sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                startIcon={<SearchIcon />}
                onClick={() => {}}
                sx={{ backgroundColor: themeColors.primary, flexGrow: 1 }}
                size="small"
              >
                Search
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<RestartAltIcon />}
                onClick={handleResetFilters}
                size="small"
              >
                Reset
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Table Card */}
      <Card elevation={3} sx={{ borderRadius: '8px' }}>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table size="medium">
                <TableHead>
                  <TableRow sx={{ backgroundColor: themeColors.lighterBlue }}>
                    <TableCell sx={{ fontWeight: 'bold', color: themeColors.primary, width: '60px' }}>S.No</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: themeColors.primary }}>Financial Year</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: themeColors.primary }}>Start Date</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: themeColors.primary }}>End Date</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: themeColors.primary }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: themeColors.primary, align: 'center' }}>Current</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: themeColors.primary, textAlign: 'center' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredYears.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4, color: '#64748b' }}>
                        No financial years found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredYears.map((year, index) => {
                      const isCurrentBool = year.is_current === 1 || year.is_active === 1;
                      const isClosed = year.status === 'Closed';

                      return (
                        <TableRow key={year.id} hover sx={{ '&:nth-of-type(even)': { backgroundColor: '#f8fafc' } }}>
                          <TableCell sx={{ fontWeight: '500' }}>{index + 1}</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                            {year.financial_year || year.year_name}
                          </TableCell>
                          <TableCell>{formatDateDisplay(year.start_date)}</TableCell>
                          <TableCell>{formatDateDisplay(year.end_date)}</TableCell>
                          <TableCell>
                            <Chip 
                              label={year.status || 'Active'} 
                              size="small"
                              sx={{
                                fontWeight: 'bold',
                                backgroundColor: isClosed ? '#fee2e2' : '#dcfce7',
                                color: isClosed ? '#991b1b' : '#166534',
                                border: isClosed ? '1px solid #fca5a5' : '1px solid #86efac'
                              }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            {isCurrentBool ? (
                              <Tooltip title="Current Active Financial Year">
                                <CheckCircleIcon sx={{ color: '#16a34a', fontSize: '22px' }} />
                              </Tooltip>
                            ) : (
                              <Typography variant="body2" sx={{ color: '#94a3b8' }}>--</Typography>
                            )}
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'nowrap' }}>
                              <Button
                                size="small"
                                variant="outlined"
                                color="info"
                                startIcon={<VisibilityIcon fontSize="small" />}
                                onClick={() => handleViewDetails(year)}
                                sx={{ py: 0.3, px: 1, fontSize: '12px' }}
                              >
                                View
                              </Button>

                              <Button
                                size="small"
                                variant="outlined"
                                color="primary"
                                startIcon={<EditIcon fontSize="small" />}
                                onClick={() => navigate(`/features/financial-year-edit/${year.id}`)}
                                sx={{ py: 0.3, px: 1, fontSize: '12px' }}
                              >
                                Edit
                              </Button>

                              {!isCurrentBool && (
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="success"
                                  onClick={() => handleSetCurrent(year.id, year.financial_year || year.year_name)}
                                  sx={{ py: 0.3, px: 1, fontSize: '11px', textTransform: 'none' }}
                                >
                                  Set Current
                                </Button>
                              )}

                              {!isClosed && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="warning"
                                  startIcon={<LockIcon fontSize="small" />}
                                  onClick={() => handleCloseFY(year.id, year.financial_year || year.year_name)}
                                  sx={{ py: 0.3, px: 1, fontSize: '11px', textTransform: 'none' }}
                                >
                                  Close
                                </Button>
                              )}

                              <Tooltip title="Delete Financial Year">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleDeleteFY(year.id, year.financial_year || year.year_name)}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* View Details Dialog */}
      <Dialog 
        open={viewModalOpen} 
        onClose={() => setViewModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ backgroundColor: themeColors.lighterBlue, color: themeColors.primary, fontWeight: 'bold' }}>
          Financial Year Details
        </DialogTitle>
        <DialogContent sx={{ p: 3, pt: 3 }}>
          {viewItem && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={5}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#475569' }}>
                    Financial Year:
                  </Typography>
                </Grid>
                <Grid item xs={7}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#0f172a' }}>
                    {viewItem.financial_year || viewItem.year_name}
                  </Typography>
                </Grid>

                <Grid item xs={5}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#475569' }}>
                    Start Date:
                  </Typography>
                </Grid>
                <Grid item xs={7}>
                  <Typography variant="body2">{formatDateDisplay(viewItem.start_date)}</Typography>
                </Grid>

                <Grid item xs={5}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#475569' }}>
                    End Date:
                  </Typography>
                </Grid>
                <Grid item xs={7}>
                  <Typography variant="body2">{formatDateDisplay(viewItem.end_date)}</Typography>
                </Grid>

                <Grid item xs={5}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#475569' }}>
                    Status:
                  </Typography>
                </Grid>
                <Grid item xs={7}>
                  <Chip 
                    label={viewItem.status || 'Active'} 
                    size="small"
                    color={viewItem.status === 'Closed' ? 'error' : 'success'}
                  />
                </Grid>

                <Grid item xs={5}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#475569' }}>
                    Current FY:
                  </Typography>
                </Grid>
                <Grid item xs={7}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: (viewItem.is_current || viewItem.is_active) ? '#16a34a' : '#64748b' }}>
                    {(viewItem.is_current || viewItem.is_active) ? 'YES ✓' : 'NO'}
                  </Typography>
                </Grid>

                <Grid item xs={5}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#475569' }}>
                    Remarks:
                  </Typography>
                </Grid>
                <Grid item xs={7}>
                  <Typography variant="body2">{viewItem.remarks || 'Financial Year ' + (viewItem.financial_year || viewItem.year_name)}</Typography>
                </Grid>

                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                </Grid>

                <Grid item xs={5}>
                  <Typography variant="body2" sx={{ color: '#64748b' }}>
                    Created By:
                  </Typography>
                </Grid>
                <Grid item xs={7}>
                  <Typography variant="body2" sx={{ color: '#334155' }}>
                    {viewItem.created_by || 'admin'}
                  </Typography>
                </Grid>

                <Grid item xs={5}>
                  <Typography variant="body2" sx={{ color: '#64748b' }}>
                    Created Date:
                  </Typography>
                </Grid>
                <Grid item xs={7}>
                  <Typography variant="body2" sx={{ color: '#334155' }}>
                    {viewItem.created_at ? formatDateDisplay(viewItem.created_at.split(' ')[0]) : formatDateDisplay(viewItem.start_date)}
                  </Typography>
                </Grid>

                <Grid item xs={5}>
                  <Typography variant="body2" sx={{ color: '#64748b' }}>
                    Modified By:
                  </Typography>
                </Grid>
                <Grid item xs={7}>
                  <Typography variant="body2" sx={{ color: '#334155' }}>
                    {viewItem.updated_by || 'admin'}
                  </Typography>
                </Grid>

                <Grid item xs={5}>
                  <Typography variant="body2" sx={{ color: '#64748b' }}>
                    Modified Date:
                  </Typography>
                </Grid>
                <Grid item xs={7}>
                  <Typography variant="body2" sx={{ color: '#334155' }}>
                    {viewItem.updated_at ? formatDateDisplay(viewItem.updated_at.split(' ')[0]) : '--'}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button 
            variant="contained" 
            color="primary"
            startIcon={<EditIcon />}
            onClick={() => {
              setViewModalOpen(false);
              if (viewItem) {
                navigate(`/features/financial-year-edit/${viewItem.id}`);
              }
            }}
          >
            Edit
          </Button>
          <Button 
            variant="outlined" 
            onClick={() => setViewModalOpen(false)}
          >
            Back
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FinancialYearDisplay;
