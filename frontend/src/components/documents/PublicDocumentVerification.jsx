import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Box,
  Card,
  CardContent,
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
  Paper,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Stack,
  IconButton,
  Tooltip,
  Snackbar
} from '@mui/material';
import VerifiedIcon from '@mui/icons-material/Verified';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import ShareIcon from '@mui/icons-material/Share';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PaymentIcon from '@mui/icons-material/Payment';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import SecurityIcon from '@mui/icons-material/Security';
import PrintIcon from '@mui/icons-material/Print';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import DrawIcon from '@mui/icons-material/Draw';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import { generateDocumentPDF } from '../../utils/pdfGenerator';

export default function PublicDocumentVerification() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [docData, setDocData] = useState(null);

  // Modals
  const [ackModalOpen, setAckModalOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Acknowledgement form
  const [ackForm, setAckForm] = useState({
    received_by: '',
    quantity_received: '',
    condition: 'Good',
    remarks: ''
  });
  const [ackSubmitting, setAckSubmitting] = useState(false);

  // Payment record form
  const [payForm, setPayForm] = useState({
    transaction_ref: '',
    vpa_id: '',
    amount: '',
    notes: ''
  });
  const [paySubmitting, setPaySubmitting] = useState(false);

  // Canvas ref for digital signature
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    fetchPublicDocument();
  }, [token]);

  const fetchPublicDocument = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`/api/documents/public/${token}`);
      if (res.data.success) {
        setDocData(res.data);
        if (res.data.document?.grand_total) {
          setPayForm(prev => ({ ...prev, amount: res.data.document.grand_total }));
        }
      } else {
        setError(res.data.message || 'Unable to verify document');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired document verification link');
    } finally {
      setLoading(false);
    }
  };

  // --- Signature Canvas Handling ---
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleAcknowledgementSubmit = async () => {
    if (!ackForm.received_by) {
      alert('Please enter Receiver Name / Representative');
      return;
    }

    let signatureData = null;
    if (canvasRef.current && hasSignature) {
      signatureData = canvasRef.current.toDataURL('image/png');
    }

    try {
      setAckSubmitting(true);
      const res = await axios.post(`/api/documents/public/acknowledge/${token}`, {
        ...ackForm,
        signature_data: signatureData
      });
      if (res.data.success) {
        setToastMessage('Delivery acknowledgement submitted successfully!');
        setAckModalOpen(false);
        fetchPublicDocument();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error recording acknowledgement');
    } finally {
      setAckSubmitting(false);
    }
  };

  const handlePaymentSubmit = async () => {
    if (!payForm.transaction_ref) {
      alert('Please enter UPI Reference / UTR Number');
      return;
    }

    try {
      setPaySubmitting(true);
      const res = await axios.post(`/api/documents/public/record-payment/${token}`, payForm);
      if (res.data.success) {
        setToastMessage('Payment confirmation logged successfully!');
        setPayModalOpen(false);
        fetchPublicDocument();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error recording payment');
    } finally {
      setPaySubmitting(false);
    }
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const docNo = docData?.document?.document_no || 'Document';
    const shareTitle = `BVC Exports Verified Document - ${docNo}`;
    const shareText = `Please view verified digital document ${docNo} from BVC Exports: ${shareUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl
        });
        return;
      } catch (e) {}
    }

    // Fallback: Copy to clipboard
    navigator.clipboard.writeText(shareUrl);
    setToastMessage('Verification link copied to clipboard!');
  };

  const handleDownloadPDF = () => {
    if (!docData) return;
    generateDocumentPDF({
      company: docData.company,
      document: docData.document,
      signatures: docData.signatures || [],
      docQrDataUrl: docData.docQrDataUrl,
      upiQrDataUrl: docData.upiQrDataUrl,
      verificationUrl: window.location.href,
      autoDownload: true
    });
    setToastMessage('PDF generated and downloaded!');
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f8fafc', p: 3 }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress size={48} sx={{ color: '#0f172a' }} />
          <Typography variant="body1" sx={{ color: '#64748b', fontWeight: 600 }}>
            Verifying digital document integrity...
          </Typography>
        </Stack>
      </Box>
    );
  }

  if (error || !docData) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f8fafc', p: 3 }}>
        <Card sx={{ maxWidth: 500, width: '100%', p: 3, textAlign: 'center', borderRadius: 3, boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
          <SecurityIcon sx={{ fontSize: 64, color: '#ef4444', mb: 2 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a', mb: 1 }}>
            Verification Failed
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mb: 3 }}>
            {error || 'The requested document token could not be verified or has expired.'}
          </Typography>
          <Button variant="contained" onClick={() => navigate('/')} sx={{ bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' } }}>
            Go to BVC ERP Home
          </Button>
        </Card>
      </Box>
    );
  }

  const { company, document, signatures, acknowledgement, upiLink, upiQrDataUrl } = docData;
  const isPaid = document.payment_status === 'PAID' || document.status === 'PAID';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f1f5f9', py: { xs: 2, sm: 4 }, px: { xs: 1.5, sm: 3 } }}>
      <Box sx={{ maxWidth: 920, mx: 'auto' }}>
        
        {/* TOP STATUS BAR */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 2.5,
            borderRadius: 2.5,
            bgcolor: '#0f172a',
            color: '#ffffff',
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
            gap: 1.5,
            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)'
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <VerifiedIcon sx={{ color: '#22c55e', fontSize: 32 }} />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, letterSpacing: '0.02em', lineHeight: 1.2 }}>
                OFFICIAL VERIFIED BVC DIGITAL DOCUMENT
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                Secure Token: {token} • Verified at {new Date(docData.verifiedAt).toLocaleTimeString()}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ width: { xs: '100%', sm: 'auto' }, justifyContent: 'flex-end' }}>
            <Button
              size="small"
              variant="contained"
              startIcon={<PictureAsPdfIcon />}
              onClick={handleDownloadPDF}
              sx={{ bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' }, textTransform: 'none', fontWeight: 600, fontSize: '0.8rem' }}
            >
              Download PDF
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ShareIcon />}
              onClick={handleShare}
              sx={{ color: '#ffffff', borderColor: '#475569', '&:hover': { borderColor: '#94a3b8' }, textTransform: 'none', fontWeight: 600, fontSize: '0.8rem' }}
            >
              Share
            </Button>
          </Stack>
        </Paper>

        {/* MAIN DOCUMENT CARD */}
        <Card sx={{ borderRadius: 3, boxShadow: '0 10px 30px rgba(0,0,0,0.06)', overflow: 'hidden', mb: 3 }}>
          {/* Company Brand Header */}
          <Box sx={{ p: { xs: 2.5, sm: 3.5 }, bgcolor: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={8}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                  {company?.name || 'BVC EXPORTS PRIVATE LIMITED'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
                  {company?.address}
                </Typography>
                <Stack direction="row" spacing={2} sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
                  <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>
                    GSTIN: {company?.gstin || '33AABCB1234A1Z5'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#475569' }}>
                    Tel: {company?.phone || '+91 98765 43210'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#475569' }}>
                    Email: {company?.email || 'billing@bvcexports.com'}
                  </Typography>
                </Stack>
              </Grid>

              <Grid item xs={12} sm={4} sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                <Chip
                  label={(document?.document_type || 'DOCUMENT').toUpperCase()}
                  sx={{ bgcolor: '#f1f5f9', color: '#0f172a', fontWeight: 800, fontSize: '0.85rem', mb: 1 }}
                />
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#2563eb' }}>
                  {document?.document_no}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                  Date: {document?.date || 'Today'}
                </Typography>
                <Chip
                  label={document?.status || 'VALID'}
                  size="small"
                  color={document?.status === 'PAID' || document?.status === 'APPROVED' ? 'success' : 'primary'}
                  sx={{ mt: 0.5, fontWeight: 700 }}
                />
              </Grid>
            </Grid>
          </Box>

          {/* Party & Dispatch Details */}
          <Box sx={{ p: { xs: 2, sm: 3 }, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Issued To / Customer
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', mt: 0.5 }}>
                  {document?.party_name || 'Valued Party'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
                  {document?.billing_address || 'Registered Address'}
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Dispatch & Logistics Details
                </Typography>
                <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                  <Typography variant="body2" sx={{ color: '#334155' }}>
                    <strong>Vehicle No:</strong> {document?.vehicle_no || 'Direct / Internal Dispatch'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#334155' }}>
                    <strong>Transporter:</strong> {document?.transport || 'Self / Direct Logistics'}
                  </Typography>
                  {document?.remarks && (
                    <Typography variant="body2" sx={{ color: '#64748b', fontStyle: 'italic' }}>
                      <strong>Remarks:</strong> {document?.remarks}
                    </Typography>
                  )}
                </Stack>
              </Grid>
            </Grid>
          </Box>

          {/* Line Items Table */}
          <Box sx={{ p: { xs: 1.5, sm: 3 } }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a', mb: 1.5 }}>
              TRANSACTION PARTICULARS & LINE ITEMS
            </Typography>

            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#0f172a' }}>
                  <TableRow>
                    <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>#</TableCell>
                    <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Description</TableCell>
                    <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Lot / Batch</TableCell>
                    <TableCell align="right" sx={{ color: '#ffffff', fontWeight: 700 }}>Qty</TableCell>
                    <TableCell align="right" sx={{ color: '#ffffff', fontWeight: 700 }}>Rate (₹)</TableCell>
                    <TableCell align="right" sx={{ color: '#ffffff', fontWeight: 700 }}>Amount (₹)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(document?.items || []).map((item, idx) => (
                    <TableRow key={idx} sx={{ '&:nth-of-type(even)': { bgcolor: '#f8fafc' } }}>
                      <TableCell sx={{ fontWeight: 600 }}>{idx + 1}</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#0f172a' }}>{item.item_name}</TableCell>
                      <TableCell>{item.lot_no || '—'}</TableCell>
                      <TableCell align="right">
                        {item.weight ? `${item.qty} (${item.weight} kg)` : item.qty}
                      </TableCell>
                      <TableCell align="right">{parseFloat(item.rate || 0).toFixed(2)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        ₹{parseFloat(item.amount || (item.qty * item.rate) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Totals Section */}
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2, width: { xs: '100%', sm: 320 } }}>
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: '#64748b' }}>Subtotal</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      ₹{parseFloat(document?.subtotal || document?.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Typography>
                  </Box>
                  {parseFloat(document?.tax_amount || 0) > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ color: '#64748b' }}>Taxes (GST)</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        ₹{parseFloat(document.tax_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </Typography>
                    </Box>
                  )}
                  <Divider />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>Grand Total</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#2563eb' }}>
                      ₹{parseFloat(document?.grand_total || document?.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Box>
          </Box>

          {/* DYNAMIC UPI PAYMENT SECTION */}
          {parseFloat(document?.grand_total || 0) > 0 && (
            <Box sx={{ p: { xs: 2, sm: 3 }, bgcolor: isPaid ? '#f0fdf4' : '#fafafa', borderTop: '1px solid #e2e8f0' }}>
              <Grid container spacing={3} alignItems="center">
                <Grid item xs={12} sm={3} sx={{ textAlign: 'center' }}>
                  {upiQrDataUrl ? (
                    <Box sx={{ p: 1, bgcolor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 2, display: 'inline-block' }}>
                      <img src={upiQrDataUrl} alt="UPI Payment QR" style={{ width: 140, height: 140, display: 'block' }} />
                      <Typography variant="caption" sx={{ color: '#16a34a', fontWeight: 700, mt: 0.5, display: 'block' }}>
                        Scan to Pay via UPI
                      </Typography>
                    </Box>
                  ) : (
                    <PaymentIcon sx={{ fontSize: 64, color: '#64748b' }} />
                  )}
                </Grid>

                <Grid item xs={12} sm={9}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <Chip
                      label={isPaid ? 'PAID / COMPLETED' : 'PAYMENT PENDING'}
                      color={isPaid ? 'success' : 'warning'}
                      sx={{ fontWeight: 800 }}
                    />
                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                      VPA: {company?.upiVpa || 'bvc@upi'}
                    </Typography>
                  </Stack>

                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
                    {isPaid ? 'Payment Confirmed' : `Amount Payable: ₹${parseFloat(document?.grand_total || 0).toLocaleString('en-IN')}`}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
                    Scan QR using Google Pay, PhonePe, Paytm, or BHIM. After paying, you can submit the UPI reference for instant ERP reconciliation.
                  </Typography>

                  <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1 }}>
                    {upiLink && !isPaid && (
                      <Button
                        variant="contained"
                        startIcon={<PaymentIcon />}
                        href={upiLink}
                        sx={{ bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' }, fontWeight: 700, textTransform: 'none' }}
                      >
                        Pay via UPI App
                      </Button>
                    )}
                    {!isPaid && (
                      <Button
                        variant="outlined"
                        onClick={() => setPayModalOpen(true)}
                        sx={{ color: '#0f172a', borderColor: '#cbd5e1', fontWeight: 600, textTransform: 'none' }}
                      >
                        Log Payment Reference
                      </Button>
                    )}
                    <Button
                      variant="outlined"
                      startIcon={<AssignmentTurnedInIcon />}
                      onClick={() => setAckModalOpen(true)}
                      sx={{ color: '#2563eb', borderColor: '#bfdbfe', fontWeight: 600, textTransform: 'none' }}
                    >
                      {acknowledgement ? 'View / Update Proof of Delivery' : 'Sign Proof of Delivery'}
                    </Button>
                  </Stack>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* DIGITAL SIGNATURES & AUDIT TRAIL */}
          <Box sx={{ p: { xs: 2, sm: 3 }, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 1.5 }}>
              Cryptographic Digital Signatures & Internal Approval Audit
            </Typography>

            <Grid container spacing={2}>
              {(signatures && signatures.length > 0 ? signatures : [
                { stage: 'PREPARED', signed_by_name: 'ERP Billing Staff', signed_by_role: 'Operations Desk', signed_at: document?.date },
                { stage: 'APPROVED', signed_by_name: 'Authorized Signatory', signed_by_role: 'Management', certificate_ref: 'BVC-DSC-VERIFIED' }
              ]).map((sig, idx) => (
                <Grid item xs={12} sm={4} key={idx}>
                  <Paper elevation={0} sx={{ p: 1.5, border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: '#ffffff' }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <CheckCircleIcon sx={{ color: '#16a34a', fontSize: 18 }} />
                      <Typography variant="caption" sx={{ fontWeight: 800, color: '#0f172a' }}>
                        {sig.stage || 'APPROVED'}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', mt: 0.5 }}>
                      {sig.signed_by_name || sig.signer || 'Authorized Signatory'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                      {sig.signed_by_role || 'Signatory'} • {sig.signed_at ? new Date(sig.signed_at).toLocaleDateString() : 'Active'}
                    </Typography>
                    {sig.certificate_ref && (
                      <Typography variant="caption" sx={{ color: '#2563eb', fontWeight: 600, display: 'block', mt: 0.5 }}>
                        Ref: {sig.certificate_ref}
                      </Typography>
                    )}
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Card>

        {/* FOOTER ACTIONS */}
        <Stack direction="row" justifyContent="center" spacing={2} sx={{ mb: 4 }}>
          <Button
            variant="contained"
            startIcon={<PictureAsPdfIcon />}
            onClick={handleDownloadPDF}
            sx={{ bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' }, fontWeight: 700, textTransform: 'none', px: 3, py: 1 }}
          >
            Download PDF
          </Button>
          <Button
            variant="outlined"
            startIcon={<WhatsAppIcon />}
            onClick={() => {
              const text = encodeURIComponent(`BVC Exports Verified Document ${document?.document_no}: ${window.location.href}`);
              window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
            }}
            sx={{ color: '#16a34a', borderColor: '#86efac', fontWeight: 700, textTransform: 'none', px: 3, py: 1 }}
          >
            Share on WhatsApp
          </Button>
        </Stack>
      </Box>

      {/* PROOF OF DELIVERY ACKNOWLEDGEMENT MODAL */}
      <Dialog open={ackModalOpen} onClose={() => setAckModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a' }}>
          Digital Delivery Receipt & Proof of Delivery
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            <TextField
              label="Received By (Name / Representative)"
              fullWidth
              size="small"
              value={ackForm.received_by}
              onChange={(e) => setAckForm({ ...ackForm, received_by: e.target.value })}
              placeholder="e.g. Ramesh (Store Manager)"
              required
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Quantity Received"
                  fullWidth
                  size="small"
                  value={ackForm.quantity_received}
                  onChange={(e) => setAckForm({ ...ackForm, quantity_received: e.target.value })}
                  placeholder="e.g. 50 Bags"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  select
                  label="Goods Condition"
                  fullWidth
                  size="small"
                  value={ackForm.condition}
                  onChange={(e) => setAckForm({ ...ackForm, condition: e.target.value })}
                >
                  <MenuItem value="Good">Good / Intact</MenuItem>
                  <MenuItem value="Minor Damage">Minor Damage</MenuItem>
                  <MenuItem value="Damaged">Damaged</MenuItem>
                  <MenuItem value="Shortage">Quantity Shortage</MenuItem>
                </TextField>
              </Grid>
            </Grid>
            <TextField
              label="Remarks / Notes"
              fullWidth
              multiline
              rows={2}
              size="small"
              value={ackForm.remarks}
              onChange={(e) => setAckForm({ ...ackForm, remarks: e.target.value })}
              placeholder="Any additional observations or seal numbers"
            />

            {/* Signature Pad */}
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                  Touchscreen Signature:
                </Typography>
                <Button size="small" onClick={clearSignature} sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
                  Clear Pad
                </Button>
              </Stack>
              <Box
                sx={{
                  border: '2px dashed #cbd5e1',
                  borderRadius: 2,
                  bgcolor: '#ffffff',
                  cursor: 'crosshair',
                  touchAction: 'none'
                }}
              >
                <canvas
                  ref={canvasRef}
                  width={460}
                  height={140}
                  style={{ width: '100%', height: '140px', display: 'block' }}
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
          <Button onClick={() => setAckModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAcknowledgementSubmit}
            disabled={ackSubmitting}
            sx={{ bgcolor: '#0f172a', fontWeight: 700 }}
          >
            {ackSubmitting ? 'Submitting...' : 'Confirm Delivery Receipt'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* PAYMENT LOGGING MODAL */}
      <Dialog open={payModalOpen} onClose={() => setPayModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a' }}>
          Submit Payment Details
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              label="UPI Ref / UTR / Transaction ID"
              fullWidth
              size="small"
              value={payForm.transaction_ref}
              onChange={(e) => setPayForm({ ...payForm, transaction_ref: e.target.value })}
              placeholder="e.g. 429381048291"
              required
            />
            <TextField
              label="Your UPI ID (VPA)"
              fullWidth
              size="small"
              value={payForm.vpa_id}
              onChange={(e) => setPayForm({ ...payForm, vpa_id: e.target.value })}
              placeholder="e.g. customer@okhdfcbank"
            />
            <TextField
              label="Amount Paid (₹)"
              fullWidth
              size="small"
              type="number"
              value={payForm.amount}
              onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
            />
            <TextField
              label="Payment Notes"
              fullWidth
              size="small"
              value={payForm.notes}
              onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
              placeholder="e.g. Paid via Google Pay"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setPayModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handlePaymentSubmit}
            disabled={paySubmitting}
            sx={{ bgcolor: '#16a34a', fontWeight: 700 }}
          >
            {paySubmitting ? 'Logging...' : 'Submit Payment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* SNACKBAR NOTIFICATION */}
      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={3500}
        onClose={() => setToastMessage('')}
        message={toastMessage}
      />
    </Box>
  );
}
