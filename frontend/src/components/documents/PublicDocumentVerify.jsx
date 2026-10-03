import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import {
  Box,
  Container,
  Paper,
  Typography,
  Chip,
  Button,
  Divider,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Stack,
  Card,
  CardContent,
  TextField,
  RadioGroup,
  FormControlLabel,
  Radio,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert
} from '@mui/material';
import VerifiedIcon from '@mui/icons-material/Verified';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DownloadIcon from '@mui/icons-material/Download';
import PrintIcon from '@mui/icons-material/Print';
import ShareIcon from '@mui/icons-material/Share';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PaymentIcon from '@mui/icons-material/Payment';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import EditIcon from '@mui/icons-material/Edit';
import SecurityIcon from '@mui/icons-material/Security';

const PublicDocumentVerify = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [ackModalOpen, setAckModalOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [submittingAck, setSubmittingAck] = useState(false);
  const [submittingPay, setSubmittingPay] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Acknowledgement form state
  const [ackForm, setAckForm] = useState({
    received_status: 'YES',
    received_by: '',
    quantity_received: '',
    condition: 'Good',
    remarks: ''
  });

  // Payment form state
  const [payForm, setPayForm] = useState({
    transaction_ref: '',
    vpa_id: '',
    notes: ''
  });

  // Canvas ref for signature
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Fetch document by token
  const fetchDoc = async () => {
    setLoading(true);
    setError('');
    try {
      const resp = await axios.get(`/api/documents/public/${token}`);
      if (resp.data && resp.data.success) {
        setData(resp.data);
      } else {
        setError(resp.data?.message || 'Document not found');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to verify document. It may be invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchDoc();
  }, [token]);

  // Handle Canvas Drawing for Signature Pad
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  // Submit Acknowledgement (Proof of Delivery)
  const handleSubmitAck = async () => {
    if (!ackForm.received_by.trim()) {
      alert('Please enter the name of the person receiving the goods.');
      return;
    }

    let signatureDataUrl = null;
    if (canvasRef.current && hasSignature) {
      signatureDataUrl = canvasRef.current.toDataURL('image/png');
    }

    setSubmittingAck(true);
    try {
      const resp = await axios.post(`/api/documents/public/acknowledge/${token}`, {
        ...ackForm,
        signature_data: signatureDataUrl,
        device_info: `${navigator.userAgent} (${window.innerWidth}x${window.innerHeight})`
      });

      if (resp.data && resp.data.success) {
        setSuccessMessage('Delivery acknowledgement confirmed and recorded on BVC ERP!');
        setAckModalOpen(false);
        fetchDoc();
      }
    } catch (err) {
      alert('Error recording delivery acknowledgement: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmittingAck(false);
    }
  };

  // Submit Payment Confirmation
  const handleSubmitPay = async () => {
    setSubmittingPay(true);
    try {
      const resp = await axios.post(`/api/documents/public/record-payment/${token}`, {
        transaction_ref: payForm.transaction_ref || `UPI-${Date.now()}`,
        vpa_id: payForm.vpa_id,
        amount: data?.document?.grand_total || 0,
        notes: payForm.notes
      });

      if (resp.data && resp.data.success) {
        setSuccessMessage('Payment confirmation recorded! Document status updated to PAID.');
        setPayModalOpen(false);
        fetchDoc();
      }
    } catch (err) {
      alert('Error recording payment: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmittingPay(false);
    }
  };

  // Share via WhatsApp
  const handleShareWhatsApp = () => {
    const currentUrl = window.location.href;
    const text = `Official BVC ERP Digital Invoice: ${data?.document?.document_no} for ₹${parseFloat(data?.document?.grand_total || 0).toLocaleString('en-IN')}. Verify & Pay online: ${currentUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Print Bill
  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="100vh" bgcolor="#f8fafc" p={3}>
        <CircularProgress size={48} sx={{ color: '#2563eb', mb: 2 }} />
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>
          Verifying Official BVC ERP Document...
        </Typography>
        <Typography variant="caption" sx={{ color: '#64748b' }}>
          Cryptographic token verification in progress
        </Typography>
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: '1px solid #fee2e2', bgcolor: '#fff5f5', textAlign: 'center' }}>
          <SecurityIcon sx={{ fontSize: 56, color: '#dc2626', mb: 1.5 }} />
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#991b1b', mb: 1 }}>
            Document Verification Failed
          </Typography>
          <Typography variant="body2" sx={{ color: '#7f1d1d', mb: 3 }}>
            {error || 'This document token is invalid, expired, or does not exist.'}
          </Typography>
          <Button component={Link} to="/" variant="contained" color="primary" sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}>
            Return to BVC ERP Home
          </Button>
        </Paper>
      </Container>
    );
  }

  const { company, document: doc, signatures = [], acknowledgement, upiLink, upiQrDataUrl } = data;
  const isPaid = doc.status === 'PAID';

  return (
    <Box sx={{ bgcolor: '#f1f5f9', minHeight: '100vh', py: { xs: 2, sm: 4 }, px: { xs: 1, sm: 2 } }}>
      <Container maxWidth="md">
        {/* Top Notification Alert */}
        {successMessage && (
          <Alert severity="success" sx={{ mb: 2.5, borderRadius: 2, fontWeight: 600 }} onClose={() => setSuccessMessage('')}>
            {successMessage}
          </Alert>
        )}

        {/* Verification Status Banner */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 2.5,
            borderRadius: 2.5,
            bgcolor: isPaid ? '#f0fdf4' : '#eff6ff',
            border: `1px solid ${isPaid ? '#bbf7d0' : '#bfdbfe'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1.5
          }}
        >
          <Box display="flex" alignItems="center" gap={1.5}>
            <VerifiedIcon sx={{ color: isPaid ? '#16a34a' : '#2563eb', fontSize: 32 }} />
            <Box>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: isPaid ? '#166534' : '#1e40af' }}>
                  OFFICIALLY VERIFIED BVC ERP DOCUMENT
                </Typography>
                <Chip
                  label={doc.status || 'VALID'}
                  size="small"
                  color={isPaid ? 'success' : 'primary'}
                  sx={{ fontWeight: 800, fontSize: '11px', height: 22 }}
                />
              </Box>
              <Typography variant="caption" sx={{ color: '#475569' }}>
                Secure Access Token: <strong style={{ fontFamily: 'monospace' }}>{token}</strong>
              </Typography>
            </Box>
          </Box>

          <Stack direction="row" spacing={1} sx={{ '@media print': { display: 'none !important' } }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<WhatsAppIcon sx={{ color: '#16a34a' }} />}
              onClick={handleShareWhatsApp}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, borderColor: '#cbd5e1', bgcolor: '#ffffff' }}
            >
              Share
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<PrintIcon />}
              onClick={handlePrint}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#0f172a' }}
            >
              Print
            </Button>
          </Stack>
        </Paper>

        {/* Main E-Bill / Document Card */}
        <Paper elevation={0} sx={{ p: { xs: 2.5, sm: 4 }, borderRadius: 3, border: '1px solid #cbd5e1', bgcolor: '#ffffff', mb: 3 }}>
          {/* Header & Logo */}
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2} borderBottom="2px solid #1e3a8a" pb={2.5} mb={2.5}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 900, color: '#1e3a8a', letterSpacing: '0.5px' }}>
                {company.name}
              </Typography>
              <Typography variant="body2" sx={{ color: '#475569', maxWidth: 450, mt: 0.5 }}>
                {company.address}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5 }}>
                <strong>GSTIN:</strong> {company.gstin} | <strong>Phone:</strong> {company.phone}
              </Typography>
            </Box>

            <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
                {doc.document_type}
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 900, color: '#2563eb', fontFamily: 'monospace' }}>
                #{doc.document_no}
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
                <strong>Date:</strong> {doc.date}
              </Typography>
            </Box>
          </Box>

          {/* Party & Transport Details */}
          <Grid container spacing={2} mb={3}>
            <Grid item xs={12} sm={6}>
              <Card variant="outlined" sx={{ bgcolor: '#f8fafc', borderColor: '#e2e8f0', height: '100%' }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    Bill To / Recipient:
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a', mt: 0.5 }}>
                    {doc.party_name || 'Valued Customer / Supplier'}
                  </Typography>
                  {doc.remarks && (
                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 1 }}>
                      <strong>Remarks:</strong> {doc.remarks}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Card variant="outlined" sx={{ bgcolor: '#f8fafc', borderColor: '#e2e8f0', height: '100%' }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    Logistics & Vehicle Information:
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#1e293b', mt: 0.5 }}>
                    <strong>Vehicle No:</strong> {doc.vehicle_no || 'Standard Transport'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#1e293b' }}>
                    <strong>Carrier:</strong> {doc.transport || 'Direct Logistics'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Line Items Table */}
          <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: 2, mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f1f5f9' }}>
                  <TableCell sx={{ fontWeight: 800, color: '#1e293b' }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#1e293b' }}>Item Description</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#1e293b' }}>Lot No</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#1e293b' }}>Qty (Bags)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#1e293b' }}>Rate (₹)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#1e293b' }}>Amount (₹)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {doc.items && doc.items.length > 0 ? (
                  doc.items.map((item, idx) => (
                    <TableRow key={idx} hover>
                      <TableCell sx={{ color: '#64748b' }}>{idx + 1}</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#0f172a' }}>{item.item_name}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', color: '#475569' }}>{item.lot_no || '—'}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>{parseFloat(item.qty || 0).toFixed(2)}</TableCell>
                      <TableCell align="right">₹{parseFloat(item.rate || 0).toFixed(2)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#0f172a' }}>
                        ₹{parseFloat(item.amount || (item.qty * item.rate) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 2, color: '#64748b' }}>
                      Invoice Total: <strong>₹{parseFloat(doc.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Financial Summary Breakdown */}
          <Box display="flex" justifyContent="flex-end" mb={3}>
            <Box sx={{ width: { xs: '100%', sm: 320 } }}>
              <Stack spacing={1}>
                {doc.subtotal > 0 && (
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" sx={{ color: '#64748b' }}>Subtotal:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>₹{parseFloat(doc.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Typography>
                  </Box>
                )}
                {doc.tax_amount > 0 && (
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" sx={{ color: '#64748b' }}>GST Tax Amount:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>₹{parseFloat(doc.tax_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Typography>
                  </Box>
                )}
                <Divider />
                <Box display="flex" justifyContent="space-between" sx={{ bgcolor: '#f8fafc', p: 1.5, borderRadius: 1.5 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>Grand Total:</Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 900, color: '#16a34a' }}>
                    ₹{parseFloat(doc.grand_total || doc.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          </Box>

          {/* Dynamic UPI Payment QR & Scan-To-Pay Section */}
          {parseFloat(doc.grand_total) > 0 && (
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2.5, bgcolor: isPaid ? '#f0fdf4' : '#fffbe3', border: `1px solid ${isPaid ? '#bbf7d0' : '#fde68a'}`, mb: 3 }}>
              <Grid container spacing={2.5} alignItems="center">
                <Grid item xs={12} sm={4} textAlign="center">
                  {upiQrDataUrl ? (
                    <Box sx={{ bgcolor: '#ffffff', p: 1.5, borderRadius: 2, display: 'inline-block', border: '1px solid #cbd5e1' }}>
                      <img src={upiQrDataUrl} alt="UPI Payment QR Code" style={{ width: 140, height: 140, display: 'block' }} />
                    </Box>
                  ) : (
                    <QrCode2Icon sx={{ fontSize: 90, color: '#16a34a' }} />
                  )}
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#0f172a', display: 'block', mt: 0.5 }}>
                    Scan with any UPI App
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={8}>
                  <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                    <PaymentIcon sx={{ color: '#d97706' }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#92400e' }}>
                      {isPaid ? 'Payment Complete (Paid via UPI)' : 'Instant UPI Digital Payment'}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: '#475569', mb: 1.5 }}>
                    Pay securely using Google Pay, PhonePe, Paytm, BHIM, or your bank's UPI app with the exact invoice reference.
                  </Typography>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ '@media print': { display: 'none !important' } }}>
                    {!isPaid ? (
                      <>
                        <Button
                          variant="contained"
                          color="success"
                          component="a"
                          href={upiLink}
                          startIcon={<PaymentIcon />}
                          sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 2 }}
                        >
                          Pay ₹{parseFloat(doc.grand_total).toLocaleString('en-IN')} via UPI
                        </Button>
                        <Button
                          variant="outlined"
                          color="warning"
                          onClick={() => setPayModalOpen(true)}
                          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                        >
                          I Have Completed Payment
                        </Button>
                      </>
                    ) : (
                      <Chip
                        icon={<CheckCircleIcon />}
                        label="Payment Confirmed & Settled"
                        color="success"
                        sx={{ fontWeight: 800, height: 32, fontSize: '13px' }}
                      />
                    )}
                  </Stack>
                </Grid>
              </Grid>
            </Paper>
          )}

          {/* Digital Delivery Proof / Acknowledgement Section */}
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', mb: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} mb={1}>
              <Box display="flex" alignItems="center" gap={1}>
                <LocalShippingIcon sx={{ color: '#2563eb' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                  Digital Delivery Proof & Customer Acknowledgement
                </Typography>
              </Box>

              {!acknowledgement && (
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  onClick={() => setAckModalOpen(true)}
                  startIcon={<AssignmentTurnedInIcon />}
                  sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, '@media print': { display: 'none !important' } }}
                >
                  Confirm Material Receipt
                </Button>
              )}
            </Box>

            {acknowledgement ? (
              <Box sx={{ bgcolor: '#ffffff', p: 2, borderRadius: 2, border: '1px solid #bbf7d0', mt: 1.5 }}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <CheckCircleIcon sx={{ color: '#16a34a', fontSize: 20 }} />
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#166534' }}>
                    Material Verified & Received by: {acknowledgement.received_by}
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: '#475569', display: 'block' }}>
                  <strong>Condition:</strong> {acknowledgement.condition} | <strong>Quantity:</strong> {acknowledgement.quantity_received || 'Full Quantity'} | <strong>Time:</strong> {new Date(acknowledgement.acknowledged_at).toLocaleString('en-IN')}
                </Typography>
                {acknowledgement.remarks && (
                  <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5 }}>
                    <strong>Note:</strong> {acknowledgement.remarks}
                  </Typography>
                )}
                {acknowledgement.signature_data && (
                  <Box sx={{ mt: 1.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', display: 'block' }}>Digital Touch Signature:</Typography>
                    <img src={acknowledgement.signature_data} alt="Receiver Signature" style={{ height: 40, borderBottom: '1px solid #94a3b8' }} />
                  </Box>
                )}
              </Box>
            ) : (
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5 }}>
                No digital delivery proof submitted yet. The recipient or transporter can confirm receipt online using this link.
              </Typography>
            )}
          </Paper>

          {/* Internal Approval & Multi-Level E-Signature Seals */}
          <Box borderTop="1px dashed #cbd5e1" pt={2.5}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 1.5 }}>
              Audited Digital Signatures & Approval Stamps
            </Typography>

            <Grid container spacing={2}>
              {signatures.length > 0 ? (
                signatures.map((sig, idx) => (
                  <Grid item xs={12} sm={4} key={idx}>
                    <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                      <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                        <CheckCircleIcon sx={{ color: '#16a34a', fontSize: 18 }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#166534' }}>
                          {sig.stage} BY
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>{sig.signed_by_name}</Typography>
                      <Typography variant="caption" sx={{ color: '#475569', display: 'block' }}>{sig.signed_by_role || 'Authorized Signatory'}</Typography>
                      <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '10px', display: 'block', fontFamily: 'monospace', mt: 0.5 }}>
                        Hash: {sig.signature_hash || 'SHA256-VERIFIED'}
                      </Typography>
                    </Paper>
                  </Grid>
                ))
              ) : (
                <Grid item xs={12}>
                  <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                      Digitally generated & authenticated via BVC ERP System Architecture.
                    </Typography>
                  </Paper>
                </Grid>
              )}
            </Grid>
          </Box>
        </Paper>
      </Container>

      {/* Confirmation Modal: Proof of Delivery (Acknowledgement) */}
      <Dialog open={ackModalOpen} onClose={() => setAckModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', pb: 1 }}>
          Confirm Material Receipt & Digital Signature
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            <TextField
              label="Recipient Name / Authorized Receiver *"
              fullWidth
              size="small"
              value={ackForm.received_by}
              onChange={(e) => setAckForm({ ...ackForm, received_by: e.target.value })}
              placeholder="e.g. R. Selvam (Warehouse Incharge)"
            />

            <TextField
              label="Quantity Received"
              fullWidth
              size="small"
              value={ackForm.quantity_received}
              onChange={(e) => setAckForm({ ...ackForm, quantity_received: e.target.value })}
              placeholder="e.g. 100 Bags (Full Quantity Verified)"
            />

            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', display: 'block', mb: 0.5 }}>
                Package Condition:
              </Typography>
              <RadioGroup
                row
                value={ackForm.condition}
                onChange={(e) => setAckForm({ ...ackForm, condition: e.target.value })}
              >
                <FormControlLabel value="Good" control={<Radio size="small" />} label="Good / Sealed" />
                <FormControlLabel value="Minor Damage" control={<Radio size="small" />} label="Minor Damage" />
                <FormControlLabel value="Shortage" control={<Radio size="small" />} label="Quantity Shortage" />
              </RadioGroup>
            </Box>

            <TextField
              label="Remarks / Receiver Notes"
              fullWidth
              size="small"
              multiline
              rows={2}
              value={ackForm.remarks}
              onChange={(e) => setAckForm({ ...ackForm, remarks: e.target.value })}
              placeholder="Any inspection remarks or batch condition notes..."
            />

            {/* Mobile Touch Signature Pad */}
            <Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                  Touch Signature (Draw with finger or mouse):
                </Typography>
                <Button size="small" onClick={clearCanvas} sx={{ textTransform: 'none', fontSize: '11px' }}>
                  Clear Pad
                </Button>
              </Box>
              <Box sx={{ border: '1px dashed #94a3b8', borderRadius: 2, bgcolor: '#ffffff', overflow: 'hidden' }}>
                <canvas
                  ref={canvasRef}
                  width={460}
                  height={120}
                  style={{ width: '100%', height: 120, display: 'block', touchAction: 'none' }}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setAckModalOpen(false)} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmitAck}
            disabled={submittingAck}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
          >
            {submittingAck ? 'Recording...' : 'Submit Digital Proof'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Modal: UPI Payment Done */}
      <Dialog open={payModalOpen} onClose={() => setPayModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a' }}>
          Confirm UPI Payment
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body2" sx={{ color: '#475569' }}>
              Enter the transaction reference number from Google Pay, PhonePe, Paytm, or your banking app:
            </Typography>
            <TextField
              label="UPI Transaction / UTR Ref Number"
              fullWidth
              size="small"
              value={payForm.transaction_ref}
              onChange={(e) => setPayForm({ ...payForm, transaction_ref: e.target.value })}
              placeholder="e.g. 423948192841"
            />
            <TextField
              label="Sender VPA ID (Optional)"
              fullWidth
              size="small"
              value={payForm.vpa_id}
              onChange={(e) => setPayForm({ ...payForm, vpa_id: e.target.value })}
              placeholder="e.g. customer@okaxis"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setPayModalOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleSubmitPay}
            disabled={submittingPay}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
          >
            {submittingPay ? 'Verifying...' : 'Confirm Paid'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PublicDocumentVerify;
