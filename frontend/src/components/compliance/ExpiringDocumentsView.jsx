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
  Grid,
  CircularProgress,
  Alert,
  Tooltip,
  IconButton,
} from '@mui/material';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RefreshIcon from '@mui/icons-material/Refresh';

export default function ExpiringDocumentsView({ onViewDoc, onEditDoc }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchExpiring = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/compliance/expiring');
      const json = await res.json();
      if (json.success) {
        setData(json);
        setError(null);
      } else {
        setError(json.error || 'Failed to fetch expiring documents');
      }
    } catch (err) {
      console.error('Error loading expiring documents:', err);
      setError('Server connection error.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpiring();
  }, []);

  const getExpiryChip = (doc) => {
    if (doc.expiry_status === 'EXPIRED') {
      return (
        <Chip
          icon={<EventBusyIcon />}
          size="small"
          label={`Expired (${Math.abs(doc.days_remaining)}d ago)`}
          color="error"
          sx={{ fontWeight: 'bold' }}
        />
      );
    } else if (doc.expiry_status === 'EXPIRING_SOON') {
      return (
        <Chip
          icon={<WarningAmberIcon />}
          size="small"
          label={`Expires in ${doc.days_remaining} days`}
          color="warning"
          sx={{ fontWeight: 'bold' }}
        />
      );
    } else if (doc.expiry_status === 'UPCOMING_REVIEW') {
      return (
        <Chip
          size="small"
          label={`Review due in ${doc.days_remaining}d`}
          sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 600 }}
        />
      );
    }
    return (
      <Chip
        icon={<CheckCircleIcon />}
        size="small"
        label="Valid"
        color="success"
        sx={{ fontWeight: 'bold' }}
      />
    );
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EventBusyIcon sx={{ color: '#dc2626', fontSize: 28 }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
              Expiring Documents & Statutory Certificate Tracker
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Monitors validity and mandatory review dates for Medical Fitness Certificates (D7), FOSTAC Training (D8), Halal Declarations (D10), MTR Specs (D3), and FSMS Plans (D2).
          </Typography>
        </Box>

        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshIcon />}
          onClick={fetchExpiring}
          sx={{ textTransform: 'none', fontWeight: 'bold' }}
        >
          Refresh Tracker
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#fef2f2', border: '1px solid #fecaca', height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#991b1b' }}>
                EXPIRED CERTIFICATES / REVIEWS
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#dc2626', mt: 0.5 }}>
                {data?.expired_count || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Require urgent renewal
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#fffbeb', border: '1px solid #fde68a', height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#92400e' }}>
                EXPIRING WITHIN 30 DAYS
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#d97706', mt: 0.5 }}>
                {data?.expiring_soon_count || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Action required soon
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#166534' }}>
                TOTAL VALIDITY MONITORED
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#15803d', mt: 0.5 }}>
                {data?.total_tracked || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Certificates & controlled docs
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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
                <TableCell sx={{ fontWeight: 'bold', width: 70, py: 1.5 }}>Code</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 140 }}>Doc Number</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Document / Certificate Title</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 160 }}>Associated Entity</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 110 }}>Effective Date</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 120 }}>Review / Expiry</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 180 }}>Status / Expiry</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 140, textAlign: 'center' }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data?.documents || []).map((doc) => (
                <TableRow
                  key={doc.id}
                  hover
                  sx={{
                    '&:nth-of-type(even)': { bgcolor: '#fafafa' },
                    '&:hover': { bgcolor: '#f0f7ff' },
                  }}
                >
                  <TableCell>
                    <Chip
                      label={doc.doc_code}
                      size="small"
                      sx={{
                        fontWeight: 'bold',
                        bgcolor: '#eff6ff',
                        color: '#1d4ed8',
                        border: '1px solid #93c5fd',
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: '#1e293b' }}>{doc.doc_number}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                      {doc.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Ver {doc.version || '1.0'} | Status: {doc.status}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>
                      {doc.employee_name || doc.supplier_name || doc.item_name || 'Plant Wide'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ color: '#64748b', fontSize: '12px' }}>
                    {doc.effective_date || 'N/A'}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#0f172a' }}>
                    {doc.review_date}
                  </TableCell>
                  <TableCell>
                    {getExpiryChip(doc)}
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                      <Tooltip title="View Document">
                        <IconButton size="small" onClick={() => onViewDoc && onViewDoc(doc)}>
                          <VisibilityIcon fontSize="small" sx={{ color: '#1f4fb2' }} />
                        </IconButton>
                      </Tooltip>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => onEditDoc && onEditDoc(doc)}
                        startIcon={<AutorenewIcon />}
                        sx={{ fontSize: '11px', textTransform: 'none', py: 0.2, px: 0.8 }}
                      >
                        Renew
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {(data?.documents || []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 3, color: '#64748b' }}>
                    No expiring documents currently tracked.
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
