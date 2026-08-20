import React, { useEffect, useState, useMemo } from 'react';
import { Box, Button, TextField, Typography, Paper, Divider, CircularProgress, Alert, InputAdornment, Grid, Card, CardContent, TableRow, TableCell } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import LibraryAddIcon from '@mui/icons-material/LibraryAdd';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ListAltIcon from '@mui/icons-material/ListAlt';

import ERPPageLayout from '../../../components/erp/ERPPageLayout';
import ERPBreadcrumb from '../../../components/erp/ERPBreadcrumb';
import ERPHeader from '../../../components/erp/ERPHeader';
import ERPTable from '../../../components/erp/ERPTable';
import api from '../../../services/api';

export default function QualityDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Data states
  const [pendingLots, setPendingLots] = useState([]);
  const [completedTests, setCompletedTests] = useState([]);

  // Search states
  const [pendingSearch, setPendingSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');

  // Load dashboard data on mount
  const loadData = () => {
    setLoading(true);
    setError('');

    Promise.all([
      api('/quality/pending'),
      api('/quality/purchase-lab-testing')
    ])
      .then(([pendingRes, historyRes]) => {
        if (pendingRes?.success) {
          setPendingLots(pendingRes.data || []);
        }
        if (historyRes?.success) {
          setCompletedTests(historyRes.data || []);
        }
      })
      .catch((err) => {
        console.error('Failed to load quality dashboard data:', err);
        setError('Error loading quality dashboard metrics.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute stats
  const stats = useMemo(() => {
    const totalPending = pendingLots.length;
    const totalCompleted = completedTests.length;
    const accepted = completedTests.filter(t => t.overallResult === 'ACCEPTED' || t.overallResult === 'PASS').length;
    const onHold = completedTests.filter(t => t.overallResult === 'HOLD').length;
    const rejected = completedTests.filter(t => t.overallResult === 'REJECTED' || t.overallResult === 'FAIL').length;

    const rate = totalCompleted > 0 ? Math.round((accepted / totalCompleted) * 100) : 100;

    return {
      totalPending,
      totalCompleted,
      accepted,
      onHold,
      rejected,
      acceptanceRate: `${rate}%`
    };
  }, [pendingLots, completedTests]);

  // Filtered lists
  const filteredPending = useMemo(() => {
    const s = pendingSearch.toLowerCase().trim();
    if (!s) return pendingLots;
    return pendingLots.filter(l => 
      String(l.lot_no || '').toLowerCase().includes(s) ||
      String(l.item_name || '').toLowerCase().includes(s) ||
      String(l.supplier_name || '').toLowerCase().includes(s)
    );
  }, [pendingLots, pendingSearch]);

  const filteredHistory = useMemo(() => {
    const s = historySearch.toLowerCase().trim();
    if (!s) return completedTests;
    return completedTests.filter(h => 
      String(h.lotNo || '').toLowerCase().includes(s) ||
      String(h.item || '').toLowerCase().includes(s) ||
      String(h.supplier || '').toLowerCase().includes(s) ||
      String(h.analyst || '').toLowerCase().includes(s) ||
      String(h.qc_no || '').toLowerCase().includes(s)
    );
  }, [completedTests, historySearch]);

  const handlePerformLabTest = (lot) => {
    navigate(`/quality/purchase-lab-testing-create?lotNo=${encodeURIComponent(lot.lot_no)}&supplier=${encodeURIComponent(lot.supplier_name)}&item=${encodeURIComponent(lot.item_name)}&purchaseId=${encodeURIComponent(lot.purchase_id)}`);
  };

  const handleViewInspection = (qcId) => {
    navigate(`/quality/purchase-lab-testing-display/${qcId}`);
  };

  const handleViewIqr = (qcId) => {
    navigate(`/quality/iqr-display/${qcId}`);
  };

  const handleViewCoa = (qcId) => {
    navigate(`/quality/coa-display/${qcId}`);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress />
        <Box sx={{ ml: 2 }}>Loading Quality Management Dashboard...</Box>
      </Box>
    );
  }

  return (
    <ERPPageLayout
      containerProps={{ px: { xs: 0, sm: 0 } }}
      breadcrumb={
        <ERPBreadcrumb
          items={[
            { label: 'Quality Module', isCurrent: false },
            { label: 'Dashboard', isCurrent: true },
          ]}
        />
      }
      header={<ERPHeader title="Quality Control & Compliance Dashboard" />}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        
        {error && (
          <Alert severity="error">{error}</Alert>
        )}

        {/* Dashboard KPIs Grid */}
        <Grid container spacing={2.5}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ borderLeft: '5px solid #ed6c02', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: 11 }}>
                  Pending QC Queue
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 900, mt: 1, color: '#ed6c02' }}>
                  {stats.totalPending} <span style={{ fontSize: 14, fontWeight: 700, color: '#757575' }}>lots</span>
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ borderLeft: '5px solid #1976d2', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: 11 }}>
                  Inspections Performed
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 900, mt: 1, color: '#1976d2' }}>
                  {stats.totalCompleted} <span style={{ fontSize: 14, fontWeight: 700, color: '#757575' }}>records</span>
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ borderLeft: '5px solid #2e7d32', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: 11 }}>
                  Acceptance Pass Rate
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 900, mt: 1, color: '#2e7d32' }}>
                  {stats.acceptanceRate}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ borderLeft: '5px solid #9c27b0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: 11 }}>
                  Active Holds / Flagged
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 900, mt: 1, color: '#9c27b0' }}>
                  {stats.onHold} <span style={{ fontSize: 14, fontWeight: 700, color: '#757575' }}>lots</span>
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Visual disposition breakdown graph */}
        <Paper sx={{ p: 3, border: '1px solid #e0e0e0', borderRadius: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 2 }}>
            Laboratory Inspection Dispositions Summary
          </Typography>
          {stats.totalCompleted === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No inspections recorded yet to generate disposition chart.
            </Typography>
          ) : (
            <Box>
              <Box sx={{ display: 'flex', height: 28, borderRadius: 1.5, overflow: 'hidden', mb: 2.5 }}>
                <Box 
                  sx={{ 
                    backgroundColor: '#2e7d32', 
                    width: `${Math.round((stats.accepted / stats.totalCompleted) * 100)}%`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 900
                  }}
                >
                  {stats.accepted > 0 && `${Math.round((stats.accepted / stats.totalCompleted) * 100)}% Accept`}
                </Box>
                <Box 
                  sx={{ 
                    backgroundColor: '#ed6c02', 
                    width: `${Math.round((stats.onHold / stats.totalCompleted) * 100)}%`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 900
                  }}
                >
                  {stats.onHold > 0 && `${Math.round((stats.onHold / stats.totalCompleted) * 100)}% Hold`}
                </Box>
                <Box 
                  sx={{ 
                    backgroundColor: '#d32f2f', 
                    width: `${Math.round((stats.rejected / stats.totalCompleted) * 100)}%`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 900
                  }}
                >
                  {stats.rejected > 0 && `${Math.round((stats.rejected / stats.totalCompleted) * 100)}% Reject`}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#2e7d32' }} />
                  <Typography variant="caption" sx={{ fontWeight: 800 }}>Accepted Lots ({stats.accepted})</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ed6c02' }} />
                  <Typography variant="caption" sx={{ fontWeight: 800 }}>Held Lots ({stats.onHold})</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#d32f2f' }} />
                  <Typography variant="caption" sx={{ fontWeight: 800 }}>Rejected Lots ({stats.rejected})</Typography>
                </Box>
              </Box>
            </Box>
          )}
        </Paper>

        {/* 1. Queue of Pending Lots */}
        <Paper sx={{ p: 3, border: '1px solid #e0e0e0', borderRadius: 2 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 2 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                Pending Quality Testing Queue (Raw Materials Receipt)
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Select an incoming raw material lot to perform laboratory testing
              </Typography>
            </Box>
            <TextField
              size="small"
              placeholder="Search Lot, Item, Supplier..."
              value={pendingSearch}
              onChange={(e) => setPendingSearch(e.target.value)}
              sx={{ width: { xs: '100%', sm: 280 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon size="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          <Divider sx={{ mb: 2 }} />

          {filteredPending.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
              No pending lots match your search query. All quality clear!
            </Box>
          ) : (
            <ERPTable
              columns={[
                { key: 'lot', label: 'Lot No' },
                { key: 'item', label: 'Raw Material Item' },
                { key: 'qty', label: 'Bags' },
                { key: 'supplier', label: 'Supplier Name' },
                { key: 'receipt', label: 'Receipt S_No' },
                { key: 'action', label: 'Actions', sx: { textAlign: 'right' } }
              ]}
              rows={filteredPending}
              renderRow={(row, idx) => (
                <TableRow key={row.stock_lot_id ? `pending-${row.stock_lot_id}-${idx}` : `pending-lot-${idx}`}>
                  <TableCell style={{ padding: '10px 8px', fontWeight: 800, fontFamily: 'monospace' }}>{row.lot_no}</TableCell>
                  <TableCell style={{ padding: '10px 8px', fontWeight: 700 }}>{row.item_name}</TableCell>
                  <TableCell style={{ padding: '10px 8px' }}>{row.received_qty || '-'}</TableCell>
                  <TableCell style={{ padding: '10px 8px', color: '#555' }}>{row.supplier_name || '-'}</TableCell>
                  <TableCell style={{ padding: '10px 8px' }}>{row.receipt_no || '-'}</TableCell>
                  <TableCell style={{ padding: '10px 8px', textAlign: 'right' }}>
                    <Button 
                      variant="contained" 
                      color="warning" 
                      size="small" 
                      onClick={() => handlePerformLabTest(row)}
                      startIcon={<LibraryAddIcon sx={{ fontSize: 14 }} />}
                      sx={{ fontWeight: 800, py: 0.5, px: 1.5, fontSize: 11 }}
                    >
                      Record Lab Test
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            />
          )}
        </Paper>

        {/* 2. Recent Lab Test Inspections */}
        <Paper sx={{ p: 3, border: '1px solid #e0e0e0', borderRadius: 2 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 2 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                Completed Laboratory Testing Registers
              </Typography>
              <Typography variant="caption" color="text.secondary">
                View completed laboratory results, generate official IQR documents, or COA certificates
              </Typography>
            </Box>
            <TextField
              size="small"
              placeholder="Search Code, Lot, Analyst..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              sx={{ width: { xs: '100%', sm: 280 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon size="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          <Divider sx={{ mb: 2 }} />

          {filteredHistory.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
              No completed laboratory inspections found.
            </Box>
          ) : (
            <ERPTable
              columns={[
                { key: 'qcNo', label: 'QA Ref No' },
                { key: 'lot', label: 'Lot No' },
                { key: 'item', label: 'Product Item' },
                { key: 'supplier', label: 'Supplier' },
                { key: 'date', label: 'Inspect Date' },
                { key: 'analyst', label: 'Analyst' },
                { key: 'status', label: 'QA Status' },
                { key: 'actions', label: 'Reports & Certificates', sx: { textAlign: 'right', width: '280px' } }
              ]}
              rows={filteredHistory}
              renderRow={(row, idx) => (
                <TableRow key={row.qcId ? `history-${row.qcId}-${idx}` : `history-qc-${idx}`}>
                  <TableCell style={{ padding: '10px 8px', fontWeight: 800 }}>{row.qc_no || `QC-${row.qcId}`}</TableCell>
                  <TableCell style={{ padding: '10px 8px', fontFamily: 'monospace' }}>{row.lotNo}</TableCell>
                  <TableCell style={{ padding: '10px 8px', fontWeight: 700 }}>{row.item}</TableCell>
                  <TableCell style={{ padding: '10px 8px', color: '#555', fontSize: 13 }}>{row.supplier || '-'}</TableCell>
                  <TableCell style={{ padding: '10px 8px' }}>{row.inspectionDate || '-'}</TableCell>
                  <TableCell style={{ padding: '10px 8px' }}>{row.analyst || '-'}</TableCell>
                  <TableCell style={{ padding: '10px 8px' }}>
                    <span style={{ 
                      fontWeight: 900, 
                      fontSize: '11px',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      color: '#fff',
                      backgroundColor: row.overallResult === 'ACCEPTED' || row.overallResult === 'PASS' ? '#2e7d32' : row.overallResult === 'HOLD' ? '#ed6c02' : '#d32f2f'
                    }}>
                      {row.overallResult}
                    </span>
                  </TableCell>
                  <TableCell style={{ padding: '10px 8px', textAlign: 'right' }}>
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                      <Button 
                        variant="outlined" 
                        size="small" 
                        onClick={() => handleViewInspection(row.qcId)}
                        sx={{ fontWeight: 700, px: 1, py: 0.25, fontSize: 10.5 }}
                      >
                        Lab Rec
                      </Button>
                      <Button 
                        variant="contained" 
                        color="info" 
                        size="small" 
                        onClick={() => handleViewIqr(row.qcId)}
                        startIcon={<ListAltIcon sx={{ fontSize: 10 }} />}
                        sx={{ fontWeight: 700, px: 1, py: 0.25, fontSize: 10.5 }}
                      >
                        IQR
                      </Button>
                      <Button 
                        variant="contained" 
                        color="success" 
                        size="small" 
                        onClick={() => handleViewCoa(row.qcId)}
                        startIcon={<CheckCircleIcon sx={{ fontSize: 10 }} />}
                        sx={{ fontWeight: 700, px: 1, py: 0.25, fontSize: 10.5 }}
                      >
                        COA
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            />
          )}
        </Paper>

        <Box sx={{ height: 20 }} />
      </Box>
    </ERPPageLayout>
  );
}
