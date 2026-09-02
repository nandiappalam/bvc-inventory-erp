import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  TextField,
  Chip,
  Grid
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Print as PrintIcon,
  History as HistoryIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const themeColors = {
  primary: '#1f4fb2',
  secondary: '#2a5ea0',
  lightBlue: '#dbe7fb',
  lighterBlue: '#eaf2fb',
  white: '#ffffff',
  textPrimary: '#333333',
};

const UserActivitiesDisplay = () => {
  const navigate = useNavigate();
  const { selectedCompany } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [userFilter, setUserFilter] = useState('');

  useEffect(() => {
    fetchActivities();
  }, [selectedCompany]);

  const fetchActivities = async () => {
    setLoading(true);
    setError('');
    try {
      let url = `/api/features/activities?companyId=${selectedCompany?.id || 1}`;
      if (startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      } else if (startDate) {
        url += `&startDate=${startDate}`;
      } else if (endDate) {
        url += `&endDate=${endDate}`;
      }
      if (userFilter) {
        url += `&user=${encodeURIComponent(userFilter)}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setActivities(data || []);
      } else {
        throw new Error('Failed to load user activities');
      }
    } catch (e) {
      console.error('Failed to fetch activities:', e);
      setError('Could not load user activities from server.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setUserFilter('');
    setTimeout(() => {
      fetch('/api/features/activities')
        .then(res => res.json())
        .then(data => setActivities(data || []))
        .catch(err => console.error(err));
    }, 50);
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredActivities = activities.filter(item => {
    if (!userFilter) return true;
    const uLower = userFilter.toLowerCase();
    return (item.user?.toLowerCase().includes(uLower)) ||
           (item.activities?.toLowerCase().includes(uLower)) ||
           (item.remarks?.toLowerCase().includes(uLower));
  });

  return (
    <Box sx={{ p: 3, maxWidth: 1200, margin: '0 auto' }}>
      {/* Top Bar Header */}
      <Card sx={{ mb: 3, bgcolor: themeColors.primary, color: 'white', borderRadius: 2, boxShadow: 2 }}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <HistoryIcon sx={{ fontSize: 28 }} />
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              User Activities Display
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/')}
            sx={{
              color: 'white',
              borderColor: 'rgba(255, 255, 255, 0.6)',
              '&:hover': { borderColor: 'white', bgcolor: 'rgba(255, 255, 255, 0.1)' }
            }}
          >
            Back to Dashboard
          </Button>
        </Box>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Filter Options */}
      <Card sx={{ mb: 3, p: 2, borderRadius: 2, boxShadow: 1 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={3}>
            <TextField
              label="Start Date"
              size="small"
              fullWidth
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="DD-MM-YYYY"
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              label="End Date"
              size="small"
              fullWidth
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="DD-MM-YYYY"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Filter by User or Action"
              size="small"
              fullWidth
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              placeholder="e.g. admin, Login, Sales"
            />
          </Grid>
          <Grid item xs={12} sm={3} sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              onClick={fetchActivities}
              startIcon={<FilterIcon />}
              sx={{ bgcolor: themeColors.secondary, '&:hover': { bgcolor: themeColors.primary } }}
              fullWidth
            >
              Apply
            </Button>
            <Button
              variant="outlined"
              onClick={handleReset}
              sx={{ color: themeColors.primary, borderColor: themeColors.primary }}
              fullWidth
            >
              Show All
            </Button>
          </Grid>
        </Grid>
      </Card>

      {/* Main Activities Table */}
      <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 2, overflow: 'hidden' }}>
        <Table sx={{ minWidth: 650 }}>
          <TableHead sx={{ bgcolor: themeColors.lighterBlue }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', color: themeColors.primary, width: 60 }}>#</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: themeColors.primary, width: 120 }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: themeColors.primary, width: 120 }}>Time</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: themeColors.primary, width: 180 }}>User Name</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: themeColors.primary, width: 220 }}>Activities</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: themeColors.primary }}>Remarks</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={32} sx={{ color: themeColors.primary }} />
                  <Typography variant="body2" sx={{ mt: 1, color: '#666' }}>
                    Fetching activity logs...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : filteredActivities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4, color: '#666' }}>
                  No activity logs found for the selected criteria.
                </TableCell>
              </TableRow>
            ) : (
              filteredActivities.map((item, idx) => (
                <TableRow
                  key={item.id || idx}
                  hover
                  sx={{
                    '&:nth-of-type(even)': { bgcolor: '#f9fbfd' },
                    transition: 'background-color 0.2s'
                  }}
                >
                  <TableCell sx={{ fontWeight: 'medium', color: '#666' }}>{idx + 1}</TableCell>
                  <TableCell>{item.date || '-'}</TableCell>
                  <TableCell>{item.time || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      label={item.user || 'System'}
                      size="small"
                      sx={{
                        bgcolor: themeColors.lightBlue,
                        color: themeColors.primary,
                        fontWeight: 'bold',
                        fontSize: '0.75rem'
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'medium', color: themeColors.secondary }}>
                    {item.activities}
                  </TableCell>
                  <TableCell sx={{ color: '#555' }}>{item.remarks || '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Footer Bar */}
        <Box sx={{
          p: 2,
          bgcolor: themeColors.lighterBlue,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px solid #e0e0e0'
        }}>
          <Typography variant="body2" sx={{ fontWeight: 'bold', color: themeColors.primary }}>
            Total Activity Record(s): {filteredActivities.length}
          </Typography>

          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            sx={{ bgcolor: themeColors.primary, '&:hover': { bgcolor: themeColors.secondary } }}
          >
            Print
          </Button>
        </Box>
      </TableContainer>
    </Box>
  );
};

export default UserActivitiesDisplay;
