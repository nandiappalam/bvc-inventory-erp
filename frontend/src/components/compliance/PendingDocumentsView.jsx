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
} from '@mui/material';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlayCircleFilledWhiteIcon from '@mui/icons-material/PlayCircleFilledWhite';
import RateReviewIcon from '@mui/icons-material/RateReview';
import RefreshIcon from '@mui/icons-material/Refresh';

export default function PendingDocumentsView({ onNavigateTab, onEditDoc, onRefresh }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPending = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/compliance/pending');
      const json = await res.json();
      if (json.success) {
        setData(json);
        setError(null);
      } else {
        setError(json.error || 'Failed to fetch pending items');
      }
    } catch (err) {
      console.error('Error loading pending items:', err);
      setError('Server connection error.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleLogChecklist = (code) => {
    if (code.startsWith('P')) {
      if (onNavigateTab) onNavigateTab(1); // Production Records
    } else {
      if (onNavigateTab) onNavigateTab(2); // Cleaning Records
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PendingActionsIcon sx={{ color: '#ea580c', fontSize: 28 }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
              Pending Documents & Action Items
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Aggregated queue of unlogged daily checklists, overdue compliance tasks, and controlled documents pending review or approval.
          </Typography>
        </Box>

        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshIcon />}
          onClick={fetchPending}
          sx={{ textTransform: 'none', fontWeight: 'bold' }}
        >
          Refresh Queue
        </Button>
      </Box>

      {/* Metric Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#fff7ed', border: '1px solid #fed7aa', height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#9a3412' }}>
                TOTAL PENDING ACTIONS
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#c2410c', mt: 0.5 }}>
                {data?.total_pending || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Action items needing attention
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#eff6ff', border: '1px solid #bfdbfe', height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#1e40af' }}>
                DOCUMENTS IN REVIEW
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#1d4ed8', mt: 0.5 }}>
                {data?.pending_reviews_count || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                D1–D11 drafts & revisions
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#fef2f2', border: '1px solid #fecaca', height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#991b1b' }}>
                TODAY'S OPEN CHECKLISTS
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#dc2626', mt: 0.5 }}>
                {data?.pending_checklists_count || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Daily operational checks
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      ) : (
        <Grid container spacing={3}>
          {/* 1. Today's Unlogged Checklists */}
          <Grid item xs={12} md={6}>
            <Card sx={{ borderRadius: 2, border: '1px solid #e2e8f0' }}>
              <Box sx={{ p: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#0f172a' }}>
                  Today's Open Operational Checklists
                </Typography>
                <Chip size="small" label={`${data?.pending_checklists?.length || 0} Open`} color="error" />
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Code</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Checklist Name</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Frequency</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(data?.pending_checklists || []).map((chk) => (
                      <TableRow key={chk.code} hover>
                        <TableCell>
                          <Chip
                            label={chk.code}
                            size="small"
                            sx={{
                              fontWeight: 'bold',
                              bgcolor: chk.code.startsWith('P') ? '#eff6ff' : '#f0fdf4',
                              color: chk.code.startsWith('P') ? '#1d4ed8' : '#15803d',
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{chk.name}</TableCell>
                        <TableCell sx={{ color: '#64748b' }}>{chk.frequency}</TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => handleLogChecklist(chk.code)}
                            startIcon={<PlayCircleFilledWhiteIcon />}
                            sx={{
                              fontSize: '11px',
                              textTransform: 'none',
                              py: 0.3,
                              px: 1,
                              bgcolor: '#1f4fb2',
                            }}
                          >
                            Log Today
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(data?.pending_checklists || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 3, color: '#16a34a', fontWeight: 600 }}>
                          <CheckCircleIcon sx={{ verticalAlign: 'middle', mr: 0.5 }} /> All today's operational checklists completed!
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          </Grid>

          {/* 2. Documents Under Review / Drafts */}
          <Grid item xs={12} md={6}>
            <Card sx={{ borderRadius: 2, border: '1px solid #e2e8f0' }}>
              <Box sx={{ p: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#0f172a' }}>
                  Controlled Documents Awaiting Review / Approval
                </Typography>
                <Chip size="small" label={`${data?.pending_reviews?.length || 0} Items`} color="warning" />
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Doc No</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Document Title</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(data?.pending_reviews || []).map((doc) => (
                      <TableRow key={doc.id} hover>
                        <TableCell sx={{ fontWeight: 'bold' }}>{doc.doc_number}</TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{doc.title}</Typography>
                          <Typography variant="caption" color="text.secondary">Prep by: {doc.prepared_by || 'QA Staff'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={doc.status}
                            size="small"
                            color={doc.status === 'UNDER_REVIEW' ? 'warning' : 'default'}
                            sx={{ fontWeight: 'bold', fontSize: '10px' }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => onEditDoc && onEditDoc(doc)}
                            startIcon={<RateReviewIcon />}
                            sx={{ fontSize: '11px', textTransform: 'none', py: 0.3, px: 1 }}
                          >
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(data?.pending_reviews || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 3, color: '#16a34a', fontWeight: 600 }}>
                          <CheckCircleIcon sx={{ verticalAlign: 'middle', mr: 0.5 }} /> All controlled documents are approved!
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
