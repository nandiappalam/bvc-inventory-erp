import React, { useEffect, useState } from 'react';
import { Box, Button, Typography, CircularProgress, Paper, Divider, Alert } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';

import ERPPageLayout from '../../../components/erp/ERPPageLayout';
import ERPBreadcrumb from '../../../components/erp/ERPBreadcrumb';
import ERPHeader from '../../../components/erp/ERPHeader';
import qualityApi from '../services/qualityApi';
import api from '../../../services/api';

export default function IncomingQualityReportDisplay() {
  const { id } = useParams(); // QC inspection ID
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [iqrInfo, setIqrInfo] = useState(null);

  useEffect(() => {
    if (id) {
      setLoading(true);
      qualityApi.loadQc(id)
        .then((res) => {
          if (res?.success && res?.data) {
            setData(res.data);
            
            // Trigger automatic generation of IQR entry in database if not already done
            qualityApi.generateIqr({ qcId: id })
              .then(iqrRes => {
                if (iqrRes?.success && iqrRes?.data) {
                  setIqrInfo(iqrRes.data);
                }
              })
              .catch(err => console.error("Error generating IQR record:", err));
          } else {
            setError('Laboratory inspection record not found for this IQR.');
          }
        })
        .catch((err) => {
          console.error('Failed to load QC record for IQR:', err);
          setError('Failed to fetch Quality Control inspection data.');
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  const onPrint = () => {
    window.print();
  };

  const onExit = () => {
    navigate('/quality/dashboard');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress />
        <Box sx={{ ml: 2 }}>Generating Incoming Quality Report (IQR)...</Box>
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{error || 'Unable to display report.'}</Alert>
        <Button sx={{ mt: 2 }} variant="contained" onClick={onExit}>Back to Dashboard</Button>
      </Box>
    );
  }

  const { qcResults = [] } = data;
  const overallResult = data.overallResult || 'ACCEPTED';

  return (
    <ERPPageLayout
      containerProps={{ px: { xs: 0, sm: 0 } }}
      breadcrumb={
        <ERPBreadcrumb
          items={[
            { label: 'Quality Module', isCurrent: false },
            { label: 'Incoming Quality Report', isCurrent: false },
            { label: 'Display', isCurrent: true },
          ]}
        />
      }
      header={<ERPHeader title={`Incoming Quality Report (IQR) – ${data.lotNo || ''}`} />}
      childrenBottom={
        <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'flex-end', '@media print': { display: 'none' } }}>
          <Button variant="contained" color="primary" onClick={onPrint}>
            Print Report
          </Button>
          <Button variant="outlined" onClick={onExit}>
            Exit
          </Button>
        </Box>
      }
    >
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
    </ERPPageLayout>
  );
}
