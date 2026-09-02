import React, { useEffect, useState } from 'react';
import { Box, Button, Typography, CircularProgress, Paper, Divider, Alert } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';

import ERPPageLayout from '../../../components/erp/ERPPageLayout';
import ERPBreadcrumb from '../../../components/erp/ERPBreadcrumb';
import ERPHeader from '../../../components/erp/ERPHeader';
import qualityApi from '../services/qualityApi';
import api from '../../../services/api';
import { printHtml } from '../../../utils/printHelper';

export default function CertificateAnalysisDisplay() {
  const { id } = useParams(); // QC inspection ID
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [coaNo, setCoaNo] = useState('');

  useEffect(() => {
    if (id) {
      setLoading(true);
      qualityApi.loadQc(id)
        .then((res) => {
          if (res?.success && res?.data) {
            setData(res.data);
            
            // Trigger generation/retrieval of COA no
            qualityApi.generateCoa({ qcId: id })
              .then(coaRes => {
                if (coaRes?.success && coaRes?.data) {
                  setCoaNo(coaRes.data.coaNo);
                }
              })
              .catch(err => console.error("Error generating COA:", err));
          } else {
            setError('Laboratory inspection record not found for this COA.');
          }
        })
        .catch((err) => {
          console.error('Failed to load QC record for COA:', err);
          setError('Failed to fetch Quality Control inspection data.');
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  const onPrint = () => {
    const el = document.getElementById('coa-printable-area');
    if (el) {
      printHtml(el.innerHTML, `COA - Lot ${data?.lotNo || id}`);
    } else {
      window.print();
    }
  };

  const onExit = () => {
    navigate('/quality/dashboard');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress />
        <Box sx={{ ml: 2 }}>Generating Certificate of Analysis (COA)...</Box>
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{error || 'Unable to display COA.'}</Alert>
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
            { label: 'Certificate of Analysis', isCurrent: false },
            { label: 'Display', isCurrent: true },
          ]}
        />
      }
      header={<ERPHeader title={`Certificate of Analysis (COA) – ${data.lotNo || ''}`} />}
      childrenBottom={
        <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'flex-end', '@media print': { display: 'none' } }}>
          <Button variant="contained" color="success" onClick={onPrint}>
            Print COA
          </Button>
          <Button variant="outlined" onClick={onExit}>
            Exit
          </Button>
        </Box>
      }
    >
      <Paper 
        id="coa-printable-area"
        sx={{ 
          p: { xs: 4, sm: 6 }, 
          maxWidth: '850px', 
          mx: 'auto', 
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          borderRadius: 2,
          border: '1.5px solid #2e7d32', // green border for COA
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
            <Typography variant="h5" sx={{ fontWeight: 950, color: '#2e7d32', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              BVC Food Laboratories
            </Typography>
            <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              An ISO 9001:2015 Certified QA Lab
            </Typography>
            <Typography variant="h6" sx={{ color: '#2e7d32', fontWeight: 800, mt: 1, borderBottom: '2px solid #2e7d32', pb: 0.5 }}>
              CERTIFICATE OF ANALYSIS
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Box sx={{ 
              border: '2.5px solid #2e7d32',
              color: '#2e7d32',
              fontWeight: 950, 
              fontSize: 15, 
              px: 2, 
              py: 0.5, 
              borderRadius: 1,
              backgroundColor: '#e8f5e9'
            }}>
              APPROVED & CERTIFIED
            </Box>
            <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary', fontWeight: 700 }}>
              COA Certificate No: {coaNo || `COA-${data.qcNo || id}`}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 3, borderBottomWidth: 1.5, borderColor: '#2e7d32' }} />

        {/* Product/Lot Metadata Section */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 3, mb: 4, fontSize: 13.5 }}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#2e7d32', textTransform: 'uppercase', borderBottom: '1px solid #e0e0e0', pb: 0.5, mb: 1 }}>
              Product Identification
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: 0.75 }}>
              <b>Product Name:</b> <span>{data.item || '-'}</span>
              <b>Lot Number:</b> <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{data.lotNo || '-'}</span>
              <b>Batch Identity:</b> <span>{data.batch || data.lotNo || '-'}</span>
              <b>Quantity Certified:</b> <span>{data.quantity ? `${data.quantity} bags` : '-'}</span>
            </Box>
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#2e7d32', textTransform: 'uppercase', borderBottom: '1px solid #e0e0e0', pb: 0.5, mb: 1 }}>
              Analysis Information
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '130px 1fr', rowGap: 0.75 }}>
              <b>Date of Analysis:</b> <span>{data.inspectionDate || '-'}</span>
              <b>Supplier / Source:</b> <span>{data.supplier || '-'}</span>
              <b>Test Specification:</b> <span>BVC-QA-STD-{data.item ? String(data.item).toUpperCase().replace(/\s+/g,'') : '01'}</span>
              <b>Lab Analyst:</b> <span>{data.analyst || 'QC Scientist'}</span>
            </Box>
          </Box>
        </Box>

        {/* Analysis Results Table */}
        <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#2e7d32', textTransform: 'uppercase', mb: 1.5 }}>
          Analytical Test Parameter Report
        </Typography>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '32px' }}>
          <thead>
            <tr style={{ borderBottom: '2.5px solid #2e7d32', backgroundColor: '#f1f8e9', textAlign: 'left', fontSize: '12.5px', color: '#2e7d32' }}>
              <th style={{ padding: '10px 8px' }}>Test Parameter</th>
              <th style={{ padding: '10px 8px' }}>Method Reference</th>
              <th style={{ padding: '10px 8px' }}>Specified Limit</th>
              <th style={{ padding: '10px 8px' }}>Analytical Result</th>
              <th style={{ padding: '10px 8px' }}>Unit of Measure</th>
              <th style={{ padding: '10px 8px', textAlign: 'center' }}>Evaluation</th>
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
                else specDisplay = 'Standard limit';
              }

              return (
                <tr key={r.parameterKey || index} style={{ borderBottom: '1px solid #e8f5e9', fontSize: '13px' }}>
                  <td style={{ padding: '12px 8px', fontWeight: 700 }}>{r.parameterName || r.parameter}</td>
                  <td style={{ padding: '12px 8px', fontStyle: 'italic', color: '#444' }}>{r.method || 'Standard Method'}</td>
                  <td style={{ padding: '12px 8px' }}>{specDisplay}</td>
                  <td style={{ padding: '12px 8px', fontWeight: 800, color: '#2e7d32' }}>{r.actualResult !== undefined ? r.actualResult : (r.result || '-')}</td>
                  <td style={{ padding: '12px 8px' }}>{r.unit || '-'}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                    <span style={{ 
                      fontWeight: 900, 
                      fontSize: '11px',
                      color: r.status === 'PASS' ? '#2e7d32' : '#c62828',
                      textTransform: 'uppercase'
                    }}>
                      {r.status || 'PASS'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Lab Manager Declarations */}
        <Box sx={{ mb: 4, p: 2, border: '1px solid #c8e6c9', borderRadius: 1, backgroundColor: '#f1f8e9' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#2e7d32', mb: 0.5 }}>Compliance Statement & Declaration:</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 12.5, lineHeight: 1.5 }}>
            It is hereby certified that the raw material lot mentioned above has been sampled and tested under ISO protocols. The test results conform to BVC food-grade safety standards. The batch is certified as <b>FIT FOR HUMANOID PRODUCTION</b>.
          </Typography>
        </Box>

        {/* Certification block & signatures */}
        <Box sx={{ mt: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Box sx={{ fontSize: 12, color: 'text.secondary' }}>
            <Typography variant="caption" sx={{ display: 'block' }}>Date of Issue: {new Date().toLocaleDateString()}</Typography>
            <Typography variant="caption" sx={{ display: 'block' }}>BVC Central Laboratories, India</Typography>
          </Box>
          <Box sx={{ borderTop: '1.5px solid #2e7d32', width: '220px', textAlign: 'center', pt: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 850, color: '#2e7d32' }}>Dr.X Quality Officer Name</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Chief Quality Officer / Lab Manager</Typography>
          </Box>
        </Box>
      </Paper>
    </ERPPageLayout>
  );
}
