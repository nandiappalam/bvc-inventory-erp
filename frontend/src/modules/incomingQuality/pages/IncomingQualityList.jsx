import React, { useEffect, useState, useMemo } from 'react';
import { 
  Box, 
  Button, 
  TextField, 
  Typography, 
  Paper, 
  CircularProgress, 
  Alert, 
  InputAdornment,
  Snackbar,
  TableRow,
  TableCell
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import DescriptionIcon from '@mui/icons-material/Description';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ReplyAllIcon from '@mui/icons-material/ReplyAll';

import ERPPageLayout from '../../../components/erp/ERPPageLayout';
import ERPBreadcrumb from '../../../components/erp/ERPBreadcrumb';
import ERPHeader from '../../../components/erp/ERPHeader';
import ERPTable from '../../../components/erp/ERPTable';
import api from '../../../services/api';

const columns = [
  { key: 'iqr_no', label: 'IQR Number', sx: { width: '15%' } },
  { key: 'rm_lot_no', label: 'Lot Number', sx: { width: '12%' } },
  { key: 'item_name', label: 'Item / Product', sx: { width: '18%' } },
  { key: 'supplier_name', label: 'Supplier', sx: { width: '18%' } },
  { key: 'uploaded_date', label: 'Report Date', sx: { width: '10%' } },
  { key: 'overall_result', label: 'QC Outcome', sx: { width: '10%' } },
  { key: 'unloading_status', label: 'Plant Disposal', sx: { width: '12%' } },
  { key: 'actions', label: 'Actions', sx: { width: '15%', textAlign: 'right' } }
];

export default function IncomingQualityList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [iqrList, setIqrList] = useState([]);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

  const loadData = () => {
    setLoading(true);
    setError('');
    api('/quality/registers')
      .then((res) => {
        if (res?.success && res?.data) {
          setIqrList(res.data.iqr || []);
        } else {
          setError(res?.message || 'Failed to load IQR registers.');
        }
      })
      .catch((err) => {
        console.error('Failed to load IQR list:', err);
        setError('Error connecting to the quality reports database.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredIqrs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return iqrList;
    return iqrList.filter(r => 
      String(r.iqr_no || '').toLowerCase().includes(q) ||
      String(r.rm_lot_no || '').toLowerCase().includes(q) ||
      String(r.item_name || '').toLowerCase().includes(q) ||
      String(r.supplier_name || '').toLowerCase().includes(q)
    );
  }, [iqrList, searchQuery]);

  const handleUnloadLot = (lotNo) => {
    if (!lotNo) return;
    setActionLoading(true);
    api('/qc/unload', {
      method: 'POST',
      body: { lotNo, status: 'UNLOADED' }
    })
      .then((res) => {
        if (res?.success) {
          setToast({ open: true, message: `Lot ${lotNo} successfully unloaded to Godown!`, severity: 'success' });
          loadData(); // Reload list
        } else {
          setToast({ open: true, message: res?.message || 'Failed to update unloading status.', severity: 'error' });
        }
      })
      .catch(err => {
        console.error('Error unloading lot:', err);
        setToast({ open: true, message: 'Server connection failed.', severity: 'error' });
      })
      .finally(() => setActionLoading(false));
  };

  const handleReturnLot = (lotNo) => {
    if (!lotNo) return;
    setActionLoading(true);
    api('/qc/unload', {
      method: 'POST',
      body: { lotNo, status: 'RETURNED' }
    })
      .then((res) => {
        if (res?.success) {
          setToast({ open: true, message: `Lot ${lotNo} marked REJECTED & RETURNED! Redirecting to Purchase Return...`, severity: 'success' });
          loadData();
          const rd = res.returnData || {};
          const party = rd.partyName || '';
          const item = rd.itemName || '';
          const q = rd.qty || '';
          const w = rd.weight || '';
          const pId = rd.purchaseId || '';
          const invNo = rd.invNo || '';

          setTimeout(() => {
            navigate(`/entry/purchase-return-create?partyName=${encodeURIComponent(party)}&itemName=${encodeURIComponent(item)}&qty=${q}&weight=${w}&lotNo=${encodeURIComponent(lotNo)}&referenceId=${pId}&invNo=${encodeURIComponent(invNo)}`);
          }, 800);
        } else {
          setToast({ open: true, message: res?.message || 'Failed to update return status.', severity: 'error' });
        }
      })
      .catch(err => {
        console.error('Error returning lot:', err);
        setToast({ open: true, message: 'Server connection failed.', severity: 'error' });
      })
      .finally(() => setActionLoading(false));
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress />
        <Box sx={{ ml: 2 }}>Loading Incoming Quality Reports register...</Box>
      </Box>
    );
  }

  return (
    <ERPPageLayout
      containerProps={{ px: { xs: 0, sm: 0 } }}
      breadcrumb={
        <ERPBreadcrumb
          items={[
            { label: 'Entry', isCurrent: false },
            { label: 'Incoming Quality', isCurrent: true },
          ]}
        />
      }
      header={<ERPHeader title="Incoming Quality Reports (IQR) Register" />}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        
        {error && (
          <Alert severity="error">{error}</Alert>
        )}

        <Paper sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Incoming Quality Reports (IQRs) List
          </Typography>
          <TextField
            size="small"
            placeholder="Search by IQR no, lot, product, supplier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ width: 320 }}
          />
        </Paper>

        <Paper sx={{ p: 2 }}>
          {filteredIqrs.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
              No incoming quality reports found. Please complete Quality Control inspections first to generate reports automatically.
            </Box>
          ) : (
            <ERPTable
              columns={columns}
              rows={filteredIqrs}
              renderRow={(row) => {
                const outcome = row.overall_result || 'ACCEPTED';
                const isPassed = outcome === 'ACCEPTED' || outcome === 'PASS';
                const outcomeColor = isPassed ? '#2e7d32' : outcome === 'REJECTED' || outcome === 'FAIL' ? '#d32f2f' : '#ed6c02';
                const outcomeBg = isPassed ? '#e8f5e9' : outcome === 'REJECTED' || outcome === 'FAIL' ? '#ffebee' : '#fff3e0';

                const dispStatus = row.unloading_status || 'PENDING_DECISION';
                const dispColor = dispStatus === 'UNLOADED' ? '#2e7d32' : dispStatus === 'RETURNED' ? '#d32f2f' : '#ed6c02';
                const dispBg = dispStatus === 'UNLOADED' ? '#e8f5e9' : dispStatus === 'RETURNED' ? '#ffebee' : '#fff3e0';
                const dispLabel = dispStatus === 'UNLOADED' ? 'UNLOADED' : dispStatus === 'RETURNED' ? 'RETURNED' : 'PENDING';

                return (
                  <TableRow key={row.id}>
                    <TableCell style={{ fontWeight: 800, padding: '12px' }}>{row.iqr_no}</TableCell>
                    <TableCell style={{ fontWeight: 700, padding: '12px' }}>{row.rm_lot_no}</TableCell>
                    <TableCell style={{ padding: '12px' }}>{row.item_name}</TableCell>
                    <TableCell style={{ padding: '12px' }}>{row.supplier_name || '-'}</TableCell>
                    <TableCell style={{ padding: '12px' }}>{row.uploaded_date || '-'}</TableCell>
                    <TableCell style={{ padding: '12px' }}>
                      <Box 
                        sx={{ 
                          fontWeight: 900, 
                          fontSize: 10,
                          color: outcomeColor,
                          backgroundColor: outcomeBg,
                          px: 1,
                          py: 0.5,
                          borderRadius: 1,
                          display: 'inline-block',
                          textTransform: 'uppercase'
                        }}
                      >
                        {outcome}
                      </Box>
                    </TableCell>
                    <TableCell style={{ padding: '12px' }}>
                      <Box 
                        sx={{ 
                          fontWeight: 900, 
                          fontSize: 10,
                          color: dispColor,
                          backgroundColor: dispBg,
                          px: 1,
                          py: 0.5,
                          borderRadius: 1,
                          display: 'inline-block',
                          textTransform: 'uppercase'
                        }}
                      >
                        {dispLabel}
                      </Box>
                    </TableCell>
                    <TableCell style={{ padding: '12px', textAlign: 'right' }}>
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                        <Button
                          size="small"
                          variant="contained"
                          color="info"
                          startIcon={<DescriptionIcon fontSize="small" />}
                          onClick={() => navigate(`/entry/incoming-quality-create?id=${row.qc_id}`)}
                          sx={{ fontWeight: 700 }}
                        >
                          View Report
                        </Button>
                        
                        {dispStatus === 'PENDING_DECISION' && (
                          isPassed ? (
                            <Button
                              size="small"
                              variant="outlined"
                              color="success"
                              disabled={actionLoading}
                              startIcon={<LocalShippingIcon fontSize="small" />}
                              onClick={() => handleUnloadLot(row.rm_lot_no)}
                              sx={{ fontWeight: 800 }}
                            >
                              Unload
                            </Button>
                          ) : (
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              disabled={actionLoading}
                              startIcon={<ReplyAllIcon fontSize="small" />}
                              onClick={() => handleReturnLot(row.rm_lot_no)}
                              sx={{ fontWeight: 800 }}
                            >
                              Return
                            </Button>
                          )
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              }}
            />
          )}
        </Paper>

        {/* Toast Alerts */}
        <Snackbar 
          open={toast.open} 
          autoHideDuration={4000} 
          onClose={() => setToast(prev => ({ ...prev, open: false }))}
        >
          <Alert severity={toast.severity} sx={{ width: '100%' }}>
            {toast.message}
          </Alert>
        </Snackbar>

      </Box>
    </ERPPageLayout>
  );
}
