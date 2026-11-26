import React, { useEffect, useState } from 'react';
import { Box, Button, Typography, CircularProgress, Paper, Divider, Alert } from '@mui/material';
import { useNavigate, useParams, useLocation } from 'react-router-dom';

import ERPPageLayout from '../../../components/erp/ERPPageLayout';
import ERPBreadcrumb from '../../../components/erp/ERPBreadcrumb';
import ERPHeader from '../../../components/erp/ERPHeader';
import qualityApi from '../services/qualityApi';
import api from '../../../services/api';
import { printElement } from '../../../utils/printHelper';

export default function CertificateAnalysisDisplay() {
  const { id: paramId } = useParams(); // QC inspection ID
  const location = useLocation();
  const qs = React.useMemo(() => new URLSearchParams(location.search), [location.search]);
  const id = paramId || qs.get('id') || qs.get('qcId') || qs.get('lotNo') || '';

  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [coaNo, setCoaNo] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    const targetId = id || '1';
    qualityApi.loadQc(targetId)
      .then((res) => {
        if (res?.success && res?.data) {
          setData(res.data);
          
          // Trigger generation/retrieval of COA no
          qualityApi.generateCoa({ qcId: targetId })
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
  }, [id]);

  const onPrint = () => {
    const el = document.getElementById('coa-printable-area');
    if (el) {
      printElement(el, { title: `COA - Lot ${data?.lotNo || id}` });
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

  const rawQcResults = data.qcResults || [];
  const seenParamKeys = new Set();
  const seenParamNames = new Set();
  const qcResults = rawQcResults.filter((r) => {
    const key = (r.parameterKey || r.id || '').toString().toLowerCase().trim();
    const name = (r.parameterName || r.parameter || '').toString().toLowerCase().trim();
    if ((key && seenParamKeys.has(key)) || (name && seenParamNames.has(name))) return false;
    if (key) seenParamKeys.add(key);
    if (name) seenParamNames.add(name);
    return true;
  });
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
              <b>Lot Number:</b> <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{data.lotNo || data.rm_lot_no || data.lot_no || data.lotno || data.batch || '-'}</span>
              <b>Batch Identity:</b> <span>{data.batch || data.lotNo || data.rm_lot_no || data.lot_no || data.lotno || '-'}</span>
              <b>Quantity Certified:</b> <span>{data.quantity ? `${data.quantity} bags` : '-'}</span>
              <b>Total Weight:</b> <span>{data.total_weight ? `${data.total_weight} kg (${(data.total_weight / 1000).toFixed(2)} MT)` : (data.unit_weight ? `Unit: ${data.unit_weight} kg` : '-')}</span>
            </Box>
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#2e7d32', textTransform: 'uppercase', borderBottom: '1px solid #e0e0e0', pb: 0.5, mb: 1 }}>
              Analysis Information
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '130px 1fr', rowGap: 0.75 }}>
              <b>Date of Analysis:</b> <span>{data.inspectionDate || data.inspection_date || data.inspectiondate || data.analysisDate || data.analysis_date || data.receipt_date || data.date || '-'}</span>
              <b>Supplier / Source:</b> <span>{data.supplier || '-'}</span>
              <b>Test Specification:</b> <span>BVC-QA-STD-{data.item ? String(data.item).toUpperCase().replace(/\s+/g,'') : '01'}</span>
              <b>Lab Analyst:</b> <span>{data.analyst || data.inspector || 'QC Scientist'}</span>
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
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#2e7d32', mb: 0.5 }}>Compliance Statement &amp; Declaration:</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 12.5, lineHeight: 1.5 }}>
            It is hereby certified that the raw material lot mentioned above has been sampled and tested under ISO protocols. The test results conform to BVC food-grade safety standards. The batch is certified as <b>FIT FOR PRODUCTION</b>.
          </Typography>
        </Box>

        {/* Photographic / Video / Document Evidence Section */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#2e7d32', textTransform: 'uppercase', mb: 1.5 }}>
            Attached Physical Test Photos, Videos &amp; Document References
          </Typography>
          {Array.isArray(data.evidence) && data.evidence.length > 0 ? (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2 }}>
              {data.evidence.map((item, idx) => {
                const isImage = (item.mime_type && item.mime_type.startsWith('image/')) || (item.type === 'image') || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(item.url || item.name || '');
                const isVideo = (item.mime_type && item.mime_type.startsWith('video/')) || (item.type === 'video') || /\.(mp4|webm|mov|ogg)$/i.test(item.url || item.name || '');
                return (
                  <Box 
                    key={item.id || idx}
                    sx={{ 
                      border: '1.5px solid #c8e6c9', 
                      borderRadius: 1.5, 
                      p: 1.5, 
                      backgroundColor: '#f9fbf9',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" sx={{ fontWeight: 800, color: '#2e7d32' }}>
                        #{idx + 1} {item.name || 'Test Evidence'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 10 }}>
                        {item.type || (isImage ? 'Photo' : isVideo ? 'Video' : 'Document')}
                      </Typography>
                    </Box>

                    {item.notes && (
                      <Typography variant="caption" sx={{ color: '#475569', fontStyle: 'italic', display: 'block' }}>
                        {item.notes}
                      </Typography>
                    )}

                    {isImage ? (
                      <Box sx={{ textAlign: 'center', mt: 0.5 }}>
                        <img 
                          src={item.url} 
                          alt={item.name || 'QC Physical Test'} 
                          style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain', borderRadius: '4px', border: '1px solid #dcdcdc' }} 
                        />
                      </Box>
                    ) : isVideo ? (
                      <Box sx={{ textAlign: 'center', mt: 0.5 }}>
                        <video 
                          src={item.url} 
                          controls 
                          style={{ maxWidth: '100%', maxHeight: '180px', borderRadius: '4px', border: '1px solid #dcdcdc' }} 
                        />
                      </Box>
                    ) : (
                      <Box sx={{ p: 2, textAlign: 'center', backgroundColor: '#ffffff', borderRadius: 1, border: '1px dashed #81c784' }}>
                        <Typography sx={{ fontSize: 24, mb: 0.5 }}>📄</Typography>
                        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: '#2e7d32', fontWeight: 700, fontSize: 12, wordBreak: 'break-all' }}>
                          View Certified Attachment
                        </a>
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          ) : (
            <Box sx={{ p: 2, border: '1px dashed #c8e6c9', borderRadius: 1, backgroundColor: '#f9fbf9', color: 'text.secondary', fontSize: 12, fontStyle: 'italic' }}>
              No photographic, video or document test evidence attached to this certificate.
            </Box>
          )}
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
