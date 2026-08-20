import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  CircularProgress, 
  Paper, 
  Divider, 
  Alert,
  Snackbar,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField
} from '@mui/material';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ReplyAllIcon from '@mui/icons-material/ReplyAll';
import PrintIcon from '@mui/icons-material/Print';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';

import ERPPageLayout from '../../../components/erp/ERPPageLayout';
import ERPBreadcrumb from '../../../components/erp/ERPBreadcrumb';
import ERPHeader from '../../../components/erp/ERPHeader';
import qualityApi from '../../quality/services/qualityApi';
import api from '../../../services/api';

export default function IncomingQualityCreate() {
  const { id: pathId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const qs = new URLSearchParams(location.search);

  const id = pathId || qs.get('id') || qs.get('qcId'); // QC Inspection ID

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [iqrInfo, setIqrInfo] = useState(null);
  const [unloadingStatus, setUnloadingStatus] = useState('PENDING_DECISION');
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

  const [godowns, setGodowns] = useState([]);
  const [selectedGodown, setSelectedGodown] = useState('');
  const [unloadedQty, setUnloadedQty] = useState('');

  useEffect(() => {
    api('/masters/all/godowns')
      .then(res => {
        if (res?.success) {
          setGodowns(res.data || []);
        }
      })
      .catch(err => console.error("Error loading godowns:", err));
  }, []);

  useEffect(() => {
    if (data && data.quantity) {
      setUnloadedQty(String(data.quantity));
    }
  }, [data]);

  const loadReportData = () => {
    if (!id) {
      setError('Please provide or select a Quality Control Inspection ID.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    qualityApi.loadQc(id)
      .then((res) => {
        if (res?.success && res?.data) {
          setData(res.data);
          const status = res.data.unloadingStatus || res.data.unloading_status || (res.data.return_registered ? 'RETURNED' : 'PENDING_DECISION');
          setUnloadingStatus(status);
          
          // Automatically trigger or load IQR generation
          qualityApi.generateIqr({ qcId: id })
            .then(iqrRes => {
              if (iqrRes?.success && iqrRes?.data) {
                setIqrInfo(iqrRes.data);
              }
            })
            .catch(err => console.error("Error generating/loading IQR record:", err));
        } else {
          setError('Laboratory inspection record not found for this IQR.');
        }
      })
      .catch((err) => {
        console.error('Failed to load QC record for IQR:', err);
        setError('Failed to fetch Quality Control inspection data.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReportData();
  }, [id]);

  const handleUnloadLot = () => {
    if (!data?.lotNo) return;
    if (!selectedGodown) {
      setToast({ open: true, message: 'Please select a target Godown first.', severity: 'error' });
      return;
    }
    if (!unloadedQty || parseFloat(unloadedQty) !== parseFloat(data.quantity)) {
      setToast({ 
        open: true, 
        message: `Verification Failed! Confirmed quantity (${unloadedQty || 0} bags) MUST exactly equal the Purchase quantity (${data.quantity} bags) to confirm unloading.`, 
        severity: 'error' 
      });
      return;
    }

    setActionLoading(true);
    
    api('/qc/confirm-disposal', {
      method: 'POST',
      body: {
        lotNo: data.lotNo,
        godownId: selectedGodown,
        unloadedQty: parseFloat(unloadedQty),
        purchaseId: data.purchaseId
      }
    })
      .then((res) => {
        if (res?.success) {
          setUnloadingStatus('UNLOADED');
          setToast({ open: true, message: 'Material stock lot unloaded, godown assigned, and vehicle status updated successfully!', severity: 'success' });
          loadReportData();
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

  const handleReturnLot = () => {
    if (!data?.lotNo) return;
    setActionLoading(true);
    
    api('/qc/unload', {
      method: 'POST',
      body: {
        lotNo: data.lotNo,
        status: 'RETURNED'
      }
    })
      .then((res) => {
        if (res?.success) {
          setUnloadingStatus('RETURNED');
          setToast({ open: true, message: 'Lot marked REJECTED & RETURNED! Redirecting to Purchase Return...', severity: 'success' });
          
          const rd = res.returnData || {};
          const party = rd.partyName || data.supplierName || data.supplier || '';
          const item = rd.itemName || data.itemName || data.item || '';
          const q = rd.qty || data.quantity || data.totalBags || '';
          const w = rd.weight || data.unitWeight || '';
          const lNo = data.lotNo;
          const pId = rd.purchaseId || data.purchaseId || '';
          const invNo = rd.invNo || data.invNo || data.inv_no || '';

          setTimeout(() => {
            navigate(`/entry/purchase-return-create?partyName=${encodeURIComponent(party)}&itemName=${encodeURIComponent(item)}&qty=${q}&weight=${w}&lotNo=${encodeURIComponent(lNo)}&referenceId=${pId}&invNo=${encodeURIComponent(invNo)}`);
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

  const onPrint = () => {
    window.print();
  };

  const onExit = () => {
    navigate('/entry/incoming-quality-display');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress />
        <Box sx={{ ml: 2 }}>Loading Incoming Quality Report...</Box>
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{error || 'Unable to display incoming quality report.'}</Alert>
        <Button sx={{ mt: 2 }} variant="contained" onClick={onExit}>Back to Incoming Quality List</Button>
      </Box>
    );
  }

  const { qcResults = [] } = data;
  const overallResult = data.overallResult || 'ACCEPTED';
  const isPassed = overallResult === 'ACCEPTED' || overallResult === 'PASS';

  return (
    <ERPPageLayout
      containerProps={{ px: { xs: 0, sm: 0 } }}
      breadcrumb={
        <ERPBreadcrumb
          items={[
            { label: 'Entry', isCurrent: false },
            { label: 'Incoming Quality', isCurrent: false },
            { label: 'Report Display', isCurrent: true },
          ]}
        />
      }
      header={<ERPHeader title={`Incoming Quality Report – Lot ${data.lotNo || ''}`} />}
      childrenBottom={
        <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'flex-end', '@media print': { display: 'none' } }}>
          <Button variant="contained" color="primary" startIcon={<PrintIcon />} onClick={onPrint}>
            Print Report
          </Button>
          <Button variant="outlined" startIcon={<ExitToAppIcon />} onClick={onExit}>
            Exit
          </Button>
        </Box>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        
        {/* Plant Discharge Control Panel (Grounded in User Intent) */}
        <Card 
          sx={{ 
            boxShadow: '0 4px 10px rgba(0,0,0,0.06)', 
            border: '1px solid',
            borderColor: isPassed ? '#a5d6a7' : '#ef9a9a',
            backgroundColor: isPassed ? '#f1f8e9' : '#ffebee',
            '@media print': { display: 'none' } 
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={7}>
                <Typography variant="h6" sx={{ fontWeight: 800, color: isPassed ? '#2e7d32' : '#c62828', display: 'flex', alignItems: 'center', gap: 1 }}>
                  Plant Disposal & Unloading Operations
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary', fontWeight: 500 }}>
                  {isPassed ? (
                    "This incoming raw material lot has PASSED quality specifications. Confirm the unloading operations below to update the warehouse stock status."
                  ) : (
                    "This incoming raw material lot has FAILED quality specifications. Reject and register return operations to notify logistics to return the material."
                  )}
                </Typography>
                <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Current Unloading State:</Typography>
                  <Box 
                    sx={{ 
                      px: 2, 
                      py: 0.5, 
                      borderRadius: 1, 
                      fontSize: 12, 
                      fontWeight: 900,
                      color: '#ffffff',
                      backgroundColor: unloadingStatus === 'UNLOADED' ? '#2e7d32' : unloadingStatus === 'RETURNED' ? '#d32f2f' : '#ed6c02',
                      textTransform: 'uppercase'
                    }}
                  >
                    {unloadingStatus === 'UNLOADED' ? 'UNLOADED TO GODOWN' : unloadingStatus === 'RETURNED' ? 'RETURNED TO SUPPLIER' : 'PENDING DECISION'}
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} md={5} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, gap: 2 }}>
                {unloadingStatus === 'PENDING_DECISION' ? (
                  <>
                    {isPassed ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                          <FormControl size="small" sx={{ minWidth: 160, flex: 1 }}>
                            <InputLabel id="create-godown-select-label">Select Godown</InputLabel>
                            <Select
                              labelId="create-godown-select-label"
                              value={selectedGodown}
                              label="Select Godown"
                              onChange={(e) => setSelectedGodown(e.target.value)}
                            >
                              {godowns.map(g => (
                                <MenuItem key={g.id} value={g.id}>
                                  {g.godown_name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>

                          <TextField
                            size="small"
                            type="number"
                            label="Unload Qty"
                            value={unloadedQty}
                            onChange={(e) => setUnloadedQty(e.target.value)}
                            sx={{ width: 120 }}
                          />
                        </Box>
                        <Button
                          variant="contained"
                          color="success"
                          startIcon={<LocalShippingIcon />}
                          disabled={actionLoading}
                          onClick={handleUnloadLot}
                          sx={{ fontWeight: 900, px: 3, py: 1, alignSelf: 'flex-end' }}
                        >
                          {actionLoading ? 'Processing...' : 'Unload & Verify'}
                        </Button>
                      </Box>
                    ) : (
                      <Button
                        variant="contained"
                        color="error"
                        startIcon={<ReplyAllIcon />}
                        disabled={actionLoading}
                        onClick={handleReturnLot}
                        sx={{ fontWeight: 900, px: 3, py: 1 }}
                      >
                        {actionLoading ? 'Processing...' : 'Return to Supplier'}
                      </Button>
                    )}
                  </>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center', p: 1, border: '2px dashed', borderColor: unloadingStatus === 'UNLOADED' ? '#2e7d32' : '#d32f2f', borderRadius: 1, px: 3, width: '100%' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 900, color: unloadingStatus === 'UNLOADED' ? '#2e7d32' : '#d32f2f', textAlign: 'center' }}>
                      {unloadingStatus === 'UNLOADED' ? '✔ MATERIAL RECEIVED & PLACED' : '✘ MATERIAL DISCHARGED & RETURNED'}
                    </Typography>
                    {unloadingStatus === 'UNLOADED' && (data.godown_name || data.godownName) && (
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                        Target Godown: {data.godown_name || data.godownName}
                      </Typography>
                    )}
                  </Box>
                )}
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Printable IQR Sheet */}
        <Paper 
          id="iqr-printable-area"
          sx={{ 
            p: { xs: 3, sm: 5 }, 
            maxWidth: '850px', 
            mx: 'auto', 
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            borderRadius: 2,
            border: '1px solid #e0e0e0',
            backgroundColor: '#ffffff',
            color: '#000000',
            '@media print': {
              boxShadow: 'none',
              border: 'none',
              p: 0,
              maxWidth: '100%'
            }
          }}
        >
          {/* Document Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 900, color: '#1976d2', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                BVC Quality Department
              </Typography>
              <Typography variant="subtitle1" sx={{ color: 'text.secondary', fontWeight: 700, mt: 0.5 }}>
                INCOMING QUALITY REPORT (IQR)
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Box sx={{ 
                border: '2px solid',
                borderColor: overallResult === 'ACCEPTED' ? '#2e7d32' : overallResult === 'REJECTED' ? '#d32f2f' : '#ed6c02',
                color: overallResult === 'ACCEPTED' ? '#2e7d32' : overallResult === 'REJECTED' ? '#d32f2f' : '#ed6c02',
                fontWeight: 900, 
                fontSize: 16, 
                px: 2, 
                py: 0.75, 
                borderRadius: 1,
                textTransform: 'uppercase'
              }}>
                {overallResult}
              </Box>
              <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
                Report ID: {iqrInfo?.iqrNo || `IQR-${data.qcNo || id}`}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ mb: 3, borderBottomWidth: 2 }} />

          {/* Transaction Info Grid */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2.5, mb: 4, fontSize: 14 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase' }}>Supplier & Goods Details</Typography>
              <Box sx={{ mt: 1, display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: 0.5 }}>
                <b>Supplier:</b> <span>{data.supplier || '-'}</span>
                <b>Product / Item:</b> <span>{data.item || '-'}</span>
                <b>Quantity:</b> <span>{data.quantity ? `${data.quantity} bags` : '-'}</span>
                <b>Weight:</b> <span>{data.total_weight ? `${data.total_weight} MT` : (data.unit_weight ? `Unit: ${data.unit_weight} kg` : '-')}</span>
                <b>Receipt S.No:</b> <span>{data.purchaseId || '-'}</span>
              </Box>
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase' }}>Inspection & Lot details</Typography>
              <Box sx={{ mt: 1, display: 'grid', gridTemplateColumns: '130px 1fr', rowGap: 0.5 }}>
                <b>Lot Number:</b> <span>{data.lotNo || '-'}</span>
                <b>Batch:</b> <span>{data.batch || data.lotNo || '-'}</span>
                <b>Receipt Date:</b> <span>{data.receipt_date || '-'}</span>
                <b>Invoice Date:</b> <span>{data.invoice_date || '-'}</span>
                <b>Inspection Date:</b> <span>{data.inspectionDate || '-'}</span>
                <b>QC Inspector:</b> <span>{data.analyst || 'QC System'}</span>
              </Box>
            </Box>
          </Box>

          {/* Parameter Testing Results */}
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', mb: 1.5 }}>
            Laboratory Parameters & Test Results
          </Typography>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '32px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left', fontSize: '13px', color: '#555' }}>
                <th style={{ padding: '8px 4px' }}>Parameter Name</th>
                <th style={{ padding: '8px 4px' }}>Category</th>
                <th style={{ padding: '8px 4px' }}>Specification Limit</th>
                <th style={{ padding: '8px 4px' }}>Actual Result</th>
                <th style={{ padding: '8px 4px' }}>Unit</th>
                <th style={{ padding: '8px 4px' }}>Method</th>
                <th style={{ padding: '8px 4px', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {qcResults.map((r, index) => {
                const specMin = r.min;
                const specMax = r.max;
                const specText = r.specification || '';
                let specDisplay = specText;
                if (!specDisplay) {
                  if (specMin !== undefined && specMax !== undefined) specDisplay = `${specMin} - ${specMax}`;
                  else if (specMin !== undefined) specDisplay = `Min ${specMin}`;
                  else if (specMax !== undefined) specDisplay = `Max ${specMax}`;
                  else specDisplay = '-';
                }

                return (
                  <tr key={r.parameterKey || index} style={{ borderBottom: '1px solid #e0e0e0', fontSize: '13.5px' }}>
                    <td style={{ padding: '10px 4px', fontWeight: 700 }}>{r.parameterName || r.parameter}</td>
                    <td style={{ padding: '10px 4px', color: '#666' }}>{r.category || '-'}</td>
                    <td style={{ padding: '10px 4px' }}>{specDisplay}</td>
                    <td style={{ padding: '10px 4px', fontWeight: 800 }}>{r.actualResult !== undefined ? r.actualResult : (r.result || '-')}</td>
                    <td style={{ padding: '10px 4px' }}>{r.unit || '-'}</td>
                    <td style={{ padding: '10px 4px', color: '#555', fontSize: '12px' }}>{r.method || '-'}</td>
                    <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                      <span style={{ 
                        fontWeight: 900, 
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        color: r.status === 'PASS' ? '#1b5e20' : r.status === 'FAIL' ? '#b71c1c' : '#e65100',
                        backgroundColor: r.status === 'PASS' ? '#e8f5e9' : r.status === 'FAIL' ? '#ffebee' : '#fff3e0'
                      }}>
                        {r.status || 'PENDING'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Remarks */}
          <Box sx={{ mb: 4, p: 2, border: '1px solid #e0e0e0', borderRadius: 1, backgroundColor: '#fdfdfd' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>Laboratory Remarks & Recommendations:</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
              {data.remarks || 'No remarks provided by the analyst.'}
            </Typography>
          </Box>

          {/* Signatures */}
          <Box sx={{ mt: 6, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, textAlign: 'center' }}>
            <Box sx={{ borderTop: '1px solid #333', pt: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 800 }}>QC Lead / Chemist</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Tested & Verified By</Typography>
            </Box>
            <Box sx={{ borderTop: '1px solid #333', pt: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 800 }}>Plant Quality Manager</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Approved & Released By</Typography>
            </Box>
          </Box>
        </Paper>

        {/* Toast Notification */}
        <Snackbar 
          open={toast.open} 
          autoHideDuration={4000} 
          onClose={() => setToast(prev => ({ ...prev, open: false }))}
        >
          <Alert severity={toast.severity} sx={{ width: '100%' }}>
            {toast.message}
          </Alert>
        </Snackbar>

        <Box sx={{ height: 20 }} />
      </Box>
    </ERPPageLayout>
  );
}
