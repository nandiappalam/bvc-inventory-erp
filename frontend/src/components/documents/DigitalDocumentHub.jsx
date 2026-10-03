import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Container,
  Paper,
  Box,
  Typography,
  Stack,
  Button,
  Grid,
  Chip,
  Tabs,
  Tab,
  TextField,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Alert,
  IconButton,
  Tooltip
} from '@mui/material';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import DocumentScannerIcon from '@mui/icons-material/DocumentScanner';
import VerifiedIcon from '@mui/icons-material/Verified';
import PaymentIcon from '@mui/icons-material/Payment';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import PrintIcon from '@mui/icons-material/Print';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import HistoryIcon from '@mui/icons-material/History';
import SendIcon from '@mui/icons-material/Send';

import { useAuth } from '../../context/AuthContext';

const DigitalDocumentHub = () => {
  const { user, selectedCompany } = useAuth();
  const [activeTab, setActiveTab] = useState(0); // 0: E-Bill & QR Generator, 1: E-Signatures Approval, 2: Delivery Proofs, 3: Warehouse Barcode Labels
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // E-Bill Generator State
  const [docType, setDocType] = useState('Sales Invoice');
  const [docNo, setDocNo] = useState('SI-2026-000145');
  const [partyName, setPartyName] = useState('ABC Foods Pvt Ltd');
  const [totalAmount, setTotalAmount] = useState('8260');
  const [generatedDoc, setGeneratedDoc] = useState(null);

  // E-Signatures State
  const [signDocNo, setSignDocNo] = useState('SI-2026-000145');
  const [signStage, setSignStage] = useState('APPROVED');
  const [existingSignatures, setExistingSignatures] = useState([]);
  const [signingLoading, setSigningLoading] = useState(false);

  // Warehouse Barcode Labels State
  const [labels, setLabels] = useState([]);
  const [labelsLoading, setLabelsLoading] = useState(false);

  // Generate QR & E-Bill
  const handleGenerateEBill = async () => {
    if (!docNo.trim() || !partyName.trim()) {
      alert('Please enter document number and party name.');
      return;
    }
    setLoading(true);
    setSuccessMsg('');
    try {
      const resp = await axios.post('/api/documents/generate-token', {
        document_type: docType,
        document_no: docNo.trim(),
        party_name: partyName.trim(),
        total_amount: parseFloat(totalAmount) || 0,
        date: new Date().toISOString().split('T')[0]
      });

      if (resp.data && resp.data.success) {
        setGeneratedDoc(resp.data);
        setSuccessMsg(`Digital E-Bill and QR successfully created for ${docNo}!`);
      }
    } catch (err) {
      alert('Error generating E-Bill: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Fetch Signatures for Document
  const fetchSignatures = async (dNo) => {
    if (!dNo) return;
    try {
      const resp = await axios.get(`/api/documents/signatures/${encodeURIComponent(dNo)}`);
      if (resp.data && resp.data.success) {
        setExistingSignatures(resp.data.signatures || []);
      }
    } catch (err) {}
  };

  useEffect(() => {
    if (activeTab === 1) fetchSignatures(signDocNo);
    if (activeTab === 3) fetchBarcodeLabels();
  }, [activeTab, signDocNo]);

  // Sign Document Internally
  const handleSignDocument = async (stage) => {
    setSigningLoading(true);
    try {
      const resp = await axios.post('/api/documents/sign', {
        document_type: docType,
        document_no: signDocNo.trim(),
        stage: stage || signStage,
        signed_by_name: user?.username || 'admin',
        signed_by_role: user?.role || 'Authorized Signatory'
      });

      if (resp.data && resp.data.success) {
        setSuccessMsg(`Document ${signDocNo} digitally signed as ${stage}!`);
        fetchSignatures(signDocNo);
      }
    } catch (err) {
      alert('Error signing document: ' + (err.response?.data?.message || err.message));
    } finally {
      setSigningLoading(false);
    }
  };

  // Fetch Warehouse Barcode Labels
  const fetchBarcodeLabels = async () => {
    setLabelsLoading(true);
    try {
      const resp = await axios.get('/api/documents/barcode-labels');
      if (resp.data && resp.data.success) {
        setLabels(resp.data.labels || []);
      }
    } catch (err) {
      console.error('Error fetching barcode labels:', err);
    } finally {
      setLabelsLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard: ' + text);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Header */}
      <Paper elevation={0} sx={{ p: 2.5, mb: 3, borderRadius: 2.5, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Box sx={{ bgcolor: '#eff6ff', p: 1.25, borderRadius: 2, color: '#2563eb', display: 'flex' }}>
              <QrCode2Icon sx={{ fontSize: 28 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 900, color: '#0f172a', lineHeight: 1.2 }}>
                Digital Document Platform & E-Invoice / QR Hub
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
                Unified E-Bill Generation, Dynamic UPI QR, Multi-Level E-Signatures & Warehouse Barcodes
              </Typography>
            </Box>
          </Box>

          <Stack direction="row" spacing={1.5}>
            <Chip
              icon={<VerifiedIcon />}
              label="Cryptographic Verification Active"
              color="success"
              size="small"
              sx={{ fontWeight: 700 }}
            />
          </Stack>
        </Box>

        {/* Tab Navigation */}
        <Tabs
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          sx={{
            mt: 2,
            borderTop: '1px solid #f1f5f9',
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, fontSize: '13px' }
          }}
        >
          <Tab icon={<QrCode2Icon fontSize="small" />} iconPosition="start" label="E-Bill & Document QR Generator" />
          <Tab icon={<VerifiedIcon fontSize="small" />} iconPosition="start" label="Internal E-Signature & Approval" />
          <Tab icon={<DocumentScannerIcon fontSize="small" />} iconPosition="start" label="Warehouse Barcode & Lot Labels" />
        </Tabs>
      </Paper>

      {/* Notifications */}
      {successMsg && (
        <Alert severity="success" sx={{ mb: 3, borderRadius: 2, fontWeight: 600 }} onClose={() => setSuccessMsg('')}>
          {successMsg}
        </Alert>
      )}

      {/* TAB 0: E-Bill & QR Generator */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          {/* Input Panel */}
          <Grid item xs={12} md={5}>
            <Paper elevation={0} sx={{ p: 3, borderRadius: 2.5, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <QrCode2Icon sx={{ color: '#2563eb' }} /> Generate Digital E-Bill & QR Code
              </Typography>

              <Stack spacing={2}>
                <TextField
                  select
                  label="Document Type"
                  size="small"
                  fullWidth
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  SelectProps={{ native: true }}
                >
                  <option value="Sales Invoice">Sales Invoice</option>
                  <option value="Purchase Invoice">Purchase Invoice</option>
                  <option value="Purchase Return">Purchase Return (Debit Note)</option>
                  <option value="Sales Return">Sales Return (Credit Note)</option>
                  <option value="Purchase Order">Purchase Order (PO)</option>
                  <option value="Delivery Challan">Delivery Challan</option>
                  <option value="QC Inspection">QC Inspection Report</option>
                  <option value="Payment Receipt">Payment Receipt</option>
                </TextField>

                <TextField
                  label="Document / Invoice Number *"
                  size="small"
                  fullWidth
                  value={docNo}
                  onChange={(e) => setDocNo(e.target.value)}
                  placeholder="e.g. SI-2026-000145"
                />

                <TextField
                  label="Party / Customer / Supplier Name *"
                  size="small"
                  fullWidth
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  placeholder="e.g. ABC Foods Pvt Ltd"
                />

                <TextField
                  label="Total Invoice Amount (₹)"
                  size="small"
                  type="number"
                  fullWidth
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="e.g. 8260"
                />

                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleGenerateEBill}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={16} /> : <QrCode2Icon />}
                  sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800, py: 1 }}
                >
                  {loading ? 'Generating...' : 'Generate Verified Document QR'}
                </Button>
              </Stack>
            </Paper>
          </Grid>

          {/* Generated Result Card */}
          <Grid item xs={12} md={7}>
            {generatedDoc ? (
              <Paper elevation={0} sx={{ p: 3, borderRadius: 2.5, border: '1px solid #bbf7d0', bgcolor: '#f0fdf4' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <CheckCircleIcon sx={{ color: '#16a34a' }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#166534' }}>
                      Verified E-Bill Ready & Published
                    </Typography>
                  </Box>
                  <Chip label="LIVE & VERIFIED" size="small" color="success" sx={{ fontWeight: 800 }} />
                </Box>

                <Grid container spacing={2} alignItems="center">
                  {/* Document QR */}
                  <Grid item xs={12} sm={6} textAlign="center">
                    <Box sx={{ p: 1.5, bgcolor: '#ffffff', borderRadius: 2, display: 'inline-block', border: '1px solid #cbd5e1' }}>
                      <img src={generatedDoc.docQrDataUrl} alt="Document QR Code" style={{ width: 150, height: 150, display: 'block' }} />
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#0f172a', display: 'block', mt: 0.5 }}>
                      BVC Document Verification QR
                    </Typography>
                  </Grid>

                  {/* UPI Payment QR */}
                  {generatedDoc.upiQrDataUrl && (
                    <Grid item xs={12} sm={6} textAlign="center">
                      <Box sx={{ p: 1.5, bgcolor: '#ffffff', borderRadius: 2, display: 'inline-block', border: '1px solid #cbd5e1' }}>
                        <img src={generatedDoc.upiQrDataUrl} alt="UPI Payment QR Code" style={{ width: 150, height: 150, display: 'block' }} />
                      </Box>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#15803d', display: 'block', mt: 0.5 }}>
                        Dynamic UPI Payment QR (₹{parseFloat(totalAmount).toLocaleString('en-IN')})
                      </Typography>
                    </Grid>
                  )}
                </Grid>

                <Divider sx={{ my: 2 }} />

                <Stack spacing={1}>
                  <Typography variant="body2" sx={{ color: '#1e293b' }}>
                    <strong>Public Verification Link:</strong>
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, bgcolor: '#ffffff', p: 1, borderRadius: 1.5, border: '1px solid #cbd5e1' }}>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#2563eb', fontWeight: 700, flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {generatedDoc.verificationUrl}
                    </Typography>
                    <IconButton size="small" onClick={() => copyToClipboard(generatedDoc.verificationUrl)}>
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  <Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
                    <Button
                      variant="contained"
                      color="primary"
                      component="a"
                      href={generatedDoc.verificationUrl}
                      target="_blank"
                      startIcon={<OpenInNewIcon />}
                      sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                    >
                      Open Mobile E-Bill View
                    </Button>
                    <Button
                      variant="outlined"
                      color="success"
                      startIcon={<WhatsAppIcon />}
                      onClick={() => {
                        const txt = `BVC ERP Verified Bill: ${docNo} for ₹${totalAmount}. Verify & Pay: ${generatedDoc.verificationUrl}`;
                        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(txt)}`, '_blank');
                      }}
                      sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                    >
                      WhatsApp Bill
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            ) : (
              <Paper elevation={0} sx={{ p: 6, textAlign: 'center', borderRadius: 2.5, border: '1px dashed #cbd5e1', bgcolor: '#f8fafc' }}>
                <QrCode2Icon sx={{ fontSize: 64, color: '#cbd5e1', mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#475569' }}>
                  No Document Generated Yet
                </Typography>
                <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                  Enter document details on the left and click "Generate Verified Document QR" to create instant public access & payment codes.
                </Typography>
              </Paper>
            )}
          </Grid>
        </Grid>
      )}

      {/* TAB 1: Internal E-Signature & Approval */}
      {activeTab === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={5}>
            <Paper elevation={0} sx={{ p: 3, borderRadius: 2.5, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <VerifiedIcon sx={{ color: '#7c3aed' }} /> Multi-Level Internal E-Signature Stamp
              </Typography>

              <Stack spacing={2}>
                <TextField
                  label="Document Number to Sign"
                  size="small"
                  fullWidth
                  value={signDocNo}
                  onChange={(e) => setSignDocNo(e.target.value)}
                  placeholder="e.g. SI-2026-000145"
                />

                <Box sx={{ bgcolor: '#f8fafc', p: 1.5, borderRadius: 2, border: '1px solid #e2e8f0' }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', display: 'block', mb: 0.5 }}>
                    Signatory Identity:
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                    {user?.username || 'admin'} ({user?.role || 'Administrator'})
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    Authenticated session with SHA-256 cryptographic audit stamping.
                  </Typography>
                </Box>

                <Stack spacing={1}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => handleSignDocument('PREPARED')}
                    disabled={signingLoading}
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                  >
                    1. Sign as PREPARED BY ({user?.username || 'admin'})
                  </Button>
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={() => handleSignDocument('CHECKED')}
                    disabled={signingLoading}
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                  >
                    2. Sign as CHECKED BY ({user?.username || 'admin'})
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    onClick={() => handleSignDocument('APPROVED')}
                    disabled={signingLoading}
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                  >
                    3. Sign as APPROVED BY ({user?.username || 'admin'})
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          </Grid>

          <Grid item xs={12} md={7}>
            <Paper elevation={0} sx={{ p: 3, borderRadius: 2.5, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', mb: 2 }}>
                Current Digital Approval Chain for {signDocNo}
              </Typography>

              {existingSignatures.length > 0 ? (
                <Stack spacing={1.5}>
                  {existingSignatures.map((sig, idx) => (
                    <Paper key={idx} elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Box display="flex" alignItems="center" gap={1}>
                          <CheckCircleIcon sx={{ color: '#16a34a' }} />
                          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#166534' }}>
                            {sig.stage} BY: {sig.signed_by_name}
                          </Typography>
                        </Box>
                        <Chip label={sig.certificate_ref || 'DSC-VALID'} size="small" color="success" sx={{ fontWeight: 800 }} />
                      </Box>
                      <Typography variant="caption" sx={{ color: '#475569', display: 'block', mt: 0.5 }}>
                        Role: {sig.signed_by_role} | Stamped on: {new Date(sig.signed_at).toLocaleString('en-IN')}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#94a3b8', fontFamily: 'monospace', display: 'block', fontSize: '10px', mt: 0.5 }}>
                        Hash: {sig.signature_hash}
                      </Typography>
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Box py={4} textAlign="center">
                  <Typography variant="body2" sx={{ color: '#64748b' }}>
                    No digital approvals recorded for this document yet. Click one of the buttons on the left to sign.
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* TAB 2: Warehouse Barcode & Lot Labels */}
      {activeTab === 2 && (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 2.5, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                Printable Warehouse Lot & Item Barcode Tags
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                High-density QR & Barcode labels for bag tagging, pallet tracking, and warehouse scanner integration
              </Typography>
            </Box>

            <Button
              variant="contained"
              color="primary"
              startIcon={<PrintIcon />}
              onClick={() => window.print()}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
            >
              Print All Labels
            </Button>
          </Box>

          {labelsLoading ? (
            <Box py={6} textAlign="center">
              <CircularProgress size={36} />
              <Typography variant="body2" sx={{ mt: 1, color: '#64748b' }}>Loading Warehouse Lot Labels...</Typography>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {labels.map((lbl, idx) => (
                <Grid item xs={12} sm={6} md={4} key={idx}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      borderColor: '#cbd5e1',
                      bgcolor: '#ffffff',
                      textAlign: 'center',
                      pageBreakInside: 'avoid'
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#1e3a8a', textTransform: 'uppercase' }}>
                      BVC EXPORTS PVT LTD
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 900, color: '#0f172a', fontFamily: 'monospace', my: 0.5 }}>
                      {lbl.lot_no}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: '#0369a1' }}>
                      {lbl.item_name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#475569', display: 'block' }}>
                      Godown: <strong>{lbl.godown_name}</strong> | Balance: <strong>{lbl.remaining_quantity || lbl.quantity} Bags</strong>
                    </Typography>

                    <Box sx={{ my: 1 }}>
                      <img src={lbl.qr_code_url} alt="Lot QR" style={{ width: 110, height: 110, display: 'block', margin: '0 auto' }} />
                    </Box>

                    <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#64748b' }}>
                      ||| {lbl.barcode_value} |||
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>
      )}
    </Container>
  );
};

export default DigitalDocumentHub;
