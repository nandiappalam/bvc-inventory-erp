import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Tabs,
  Tab,
  Grid,
  Chip,
  Paper,
  Stack,
  Divider,
  TextField,
  CircularProgress,
  IconButton,
  Tooltip,
  Alert,
  Snackbar,
  Table,
  TableContainer,
  TableHead,
  TableRow,
  TableCell,
  TableBody
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import VerifiedIcon from '@mui/icons-material/Verified';
import ShareIcon from '@mui/icons-material/Share';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PaymentIcon from '@mui/icons-material/Payment';
import DrawIcon from '@mui/icons-material/Draw';
import HistoryIcon from '@mui/icons-material/History';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PrintIcon from '@mui/icons-material/Print';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import { useAuth } from '../../context/AuthContext';
import { generateDocumentPDF } from '../../utils/pdfGenerator';

export default function DigitalDocumentModal({
  open,
  onClose,
  documentType = 'Sales Invoice',
  documentId = '',
  documentNo = '',
  partyName = '',
  totalAmount = 0,
  date = '',
  itemSummary = '',
  status = 'VALID'
}) {
  const { user } = useAuth();

  const [tabIndex, setTabIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [docTokenData, setDocTokenData] = useState(null);
  const [fullPublicDoc, setFullPublicDoc] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [relationships, setRelationships] = useState(null);
  const [signatures, setSignatures] = useState([]);
  const [toastMessage, setToastMessage] = useState('');

  // Signing state
  const [signStage, setSignStage] = useState('APPROVED');
  const [signerName, setSignerName] = useState(user?.username || user?.name || 'ERP Manager');
  const [signerRole, setSignerRole] = useState(user?.role || 'Authorized Signatory');
  const [signingLoading, setSigningLoading] = useState(false);

  useEffect(() => {
    if (open && documentNo) {
      loadTokenAndMetadata();
    }
  }, [open, documentNo]);

  const loadTokenAndMetadata = async () => {
    try {
      setLoading(true);
      // 1. Generate / Retrieve Token with window.location.origin
      const res = await axios.post('/api/documents/generate-token', {
        document_type: documentType,
        document_id: documentId,
        document_no: documentNo,
        party_name: partyName,
        total_amount: totalAmount,
        date: date || new Date().toISOString().split('T')[0],
        item_summary: itemSummary,
        status: status,
        origin: window.location.origin
      });

      if (res.data.success) {
        setDocTokenData(res.data);

        // Fetch full resolved document details from DB (including line items, lot numbers, address, vehicle, GST)
        try {
          const pubRes = await axios.get(`/api/documents/public/${res.data.token}`);
          if (pubRes.data.success) {
            setFullPublicDoc(pubRes.data);
          }
        } catch (pubErr) {
          console.warn('Could not fetch public details:', pubErr);
        }
      }

      // 2. Load Signatures
      const sigRes = await axios.get(`/api/documents/signatures/${encodeURIComponent(documentNo)}`).catch(() => ({ data: {} }));
      if (sigRes.data?.signatures) {
        setSignatures(sigRes.data.signatures);
      }

      // 3. Load Audit Logs
      const auditRes = await axios.get(`/api/documents/audit/${encodeURIComponent(documentNo)}`).catch(() => ({ data: {} }));
      if (auditRes.data?.auditLogs) {
        setAuditLogs(auditRes.data.auditLogs);
      }

      // 4. Load Relationships
      const relRes = await axios.get(`/api/documents/relationships/${encodeURIComponent(documentNo)}?document_type=${encodeURIComponent(documentType)}`).catch(() => ({ data: {} }));
      if (relRes.data?.relationships) {
        setRelationships(relRes.data.relationships);
      }
    } catch (err) {
      console.error('Error loading digital document:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignDocument = async () => {
    try {
      setSigningLoading(true);
      const res = await axios.post('/api/documents/sign', {
        document_type: documentType,
        document_id: documentId,
        document_no: documentNo,
        stage: signStage,
        signed_by_name: signerName,
        signed_by_role: signerRole
      });

      if (res.data.success) {
        setToastMessage(`Document successfully signed (${signStage})!`);
        loadTokenAndMetadata();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error signing document');
    } finally {
      setSigningLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (docTokenData?.verificationUrl) {
      navigator.clipboard.writeText(docTokenData.verificationUrl);
      setToastMessage('Public verification link copied to clipboard!');
    }
  };

  const handleDownloadPDF = () => {
    if (!docTokenData) return;

    const resolvedCompany = fullPublicDoc?.company || {
      name: 'BVC Exports Private Limited',
      address: '123 Main Industrial Area, Madurai, Tamil Nadu',
      gstin: '33AABCB1234A1Z5',
      phone: '+91 98765 43210',
      email: 'billing@bvcexports.com'
    };

    const resolvedDocument = fullPublicDoc?.document || {
      document_type: documentType,
      document_no: documentNo,
      party_name: partyName,
      date: date || new Date().toISOString().split('T')[0],
      grand_total: totalAmount,
      total_amount: totalAmount,
      status: status,
      items: [
        { item_name: itemSummary || `${documentType} - ${documentNo}`, qty: 1, rate: totalAmount, amount: totalAmount }
      ]
    };

    generateDocumentPDF({
      company: resolvedCompany,
      document: resolvedDocument,
      signatures: fullPublicDoc?.signatures || signatures,
      docQrDataUrl: docTokenData.docQrDataUrl,
      upiQrDataUrl: docTokenData.upiQrDataUrl,
      verificationUrl: docTokenData.verificationUrl,
      autoDownload: true
    });
    setToastMessage('PDF downloaded successfully!');
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ p: 2.5, bgcolor: '#0f172a', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <VerifiedIcon sx={{ color: '#22c55e', fontSize: 26 }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1.05rem', lineHeight: 1.2 }}>
                BVC Digital Document Platform
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                {documentType} • {documentNo}
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={onClose} sx={{ color: '#94a3b8', '&:hover': { color: '#ffffff' } }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: '#f8fafc' }}>
          <Tabs value={tabIndex} onChange={(e, val) => setTabIndex(val)} sx={{ px: 2 }}>
            <Tab icon={<QrCode2Icon fontSize="small" />} iconPosition="start" label="QR & Verification" sx={{ textTransform: 'none', fontWeight: 700 }} />
            <Tab icon={<PaymentIcon fontSize="small" />} iconPosition="start" label="UPI Payment" sx={{ textTransform: 'none', fontWeight: 700 }} />
            <Tab icon={<DrawIcon fontSize="small" />} iconPosition="start" label="e-Signature / DSC" sx={{ textTransform: 'none', fontWeight: 700 }} />
            <Tab icon={<AccountTreeIcon fontSize="small" />} iconPosition="start" label="Relationships" sx={{ textTransform: 'none', fontWeight: 700 }} />
            <Tab icon={<HistoryIcon fontSize="small" />} iconPosition="start" label="Audit Trail" sx={{ textTransform: 'none', fontWeight: 700 }} />
          </Tabs>
        </Box>

        <DialogContent sx={{ p: 3, bgcolor: '#f1f5f9' }}>
          {loading ? (
            <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={36} sx={{ color: '#0f172a' }} />
            </Box>
          ) : (
            <>
              {/* TAB 0: QR & VERIFICATION */}
              {tabIndex === 0 && (
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={4} sx={{ textAlign: 'center' }}>
                    <Paper elevation={0} sx={{ p: 2, bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}>
                      {docTokenData?.docQrDataUrl ? (
                        <img src={docTokenData.docQrDataUrl} alt="Document Verification QR" style={{ width: '100%', maxWidth: 180, display: 'block', margin: '0 auto' }} />
                      ) : (
                        <CircularProgress size={28} />
                      )}
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, mt: 1, display: 'block' }}>
                        Token: {docTokenData?.token}
                      </Typography>
                    </Paper>
                  </Grid>

                  <Grid item xs={12} sm={8}>
                    <Paper elevation={0} sx={{ p: 2.5, bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', mb: 1 }}>
                        Public Document Verification Link
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
                        Recipients can scan this QR code or click the public verification link to view, verify authenticity, sign proof of delivery, or pay via UPI.
                      </Typography>

                      <TextField
                        fullWidth
                        size="small"
                        value={docTokenData?.verificationUrl || ''}
                        InputProps={{
                          readOnly: true,
                          endAdornment: (
                            <Tooltip title="Copy Link">
                              <IconButton onClick={handleCopyLink} size="small">
                                <ContentCopyIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )
                        }}
                        sx={{ mb: 2 }}
                      />

                      <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1 }}>
                        <Button
                          variant="contained"
                          startIcon={<PictureAsPdfIcon />}
                          onClick={handleDownloadPDF}
                          sx={{ bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' }, textTransform: 'none', fontWeight: 700 }}
                        >
                          Download PDF
                        </Button>
                        <Button
                          variant="outlined"
                          startIcon={<OpenInNewIcon />}
                          onClick={() => window.open(docTokenData?.verificationUrl, '_blank')}
                          sx={{ color: '#2563eb', borderColor: '#bfdbfe', textTransform: 'none', fontWeight: 700 }}
                        >
                          Open Verification Page
                        </Button>
                        <Button
                          variant="outlined"
                          startIcon={<WhatsAppIcon />}
                          onClick={() => {
                            const text = encodeURIComponent(`BVC Verified Document ${documentNo}: ${docTokenData?.verificationUrl}`);
                            window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
                          }}
                          sx={{ color: '#16a34a', borderColor: '#86efac', textTransform: 'none', fontWeight: 700 }}
                        >
                          WhatsApp
                        </Button>
                      </Stack>
                    </Paper>
                  </Grid>
                </Grid>
              )}

              {/* TAB 1: UPI PAYMENT */}
              {tabIndex === 1 && (
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={4} sx={{ textAlign: 'center' }}>
                    <Paper elevation={0} sx={{ p: 2, bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}>
                      {docTokenData?.upiQrDataUrl ? (
                        <img src={docTokenData.upiQrDataUrl} alt="UPI Payment QR" style={{ width: '100%', maxWidth: 180, display: 'block', margin: '0 auto' }} />
                      ) : (
                        <Typography variant="body2" sx={{ color: '#64748b', py: 4 }}>
                          Amount is zero / No payment required
                        </Typography>
                      )}
                      <Typography variant="caption" sx={{ color: '#16a34a', fontWeight: 700, mt: 1, display: 'block' }}>
                        Dynamic UPI Payment QR
                      </Typography>
                    </Paper>
                  </Grid>

                  <Grid item xs={12} sm={8}>
                    <Paper elevation={0} sx={{ p: 2.5, bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                        <Chip
                          label={status === 'PAID' ? 'PAID' : 'PAYMENT PENDING'}
                          color={status === 'PAID' ? 'success' : 'warning'}
                          sx={{ fontWeight: 800 }}
                        />
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                          VPA: bvc@upi
                        </Typography>
                      </Stack>

                      <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
                        Total Amount: ₹{parseFloat(totalAmount || 0).toLocaleString('en-IN')}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
                        UPI intent string includes document reference for automated reconciliation.
                      </Typography>

                      <TextField
                        fullWidth
                        size="small"
                        label="UPI Intent Link"
                        value={docTokenData?.upiLink || ''}
                        InputProps={{
                          readOnly: true,
                          endAdornment: (
                            <Tooltip title="Copy UPI Link">
                              <IconButton onClick={() => { navigator.clipboard.writeText(docTokenData.upiLink); setToastMessage('UPI link copied!'); }} size="small">
                                <ContentCopyIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )
                        }}
                        sx={{ mb: 2 }}
                      />
                    </Paper>
                  </Grid>
                </Grid>
              )}

              {/* TAB 2: E-SIGNATURE & APPROVAL */}
              {tabIndex === 2 && (
                <Stack spacing={2.5}>
                  <Paper elevation={0} sx={{ p: 2.5, bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', mb: 1 }}>
                      Sign & Authorize Document (Internal DSC / Audit)
                    </Typography>
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid item xs={12} sm={4}>
                        <TextField
                          select
                          label="Approval Stage"
                          fullWidth
                          size="small"
                          value={signStage}
                          onChange={(e) => setSignStage(e.target.value)}
                          SelectProps={{ native: true }}
                        >
                          <option value="PREPARED">Prepared By</option>
                          <option value="CHECKED">Checked & Verified</option>
                          <option value="APPROVED">Approved (Authorized Signatory)</option>
                          <option value="FINAL">Final Sealed</option>
                        </TextField>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <TextField
                          label="Signer Name"
                          fullWidth
                          size="small"
                          value={signerName}
                          onChange={(e) => setSignerName(e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <TextField
                          label="Designation / Role"
                          fullWidth
                          size="small"
                          value={signerRole}
                          onChange={(e) => setSignerRole(e.target.value)}
                        />
                      </Grid>
                    </Grid>

                    <Button
                      variant="contained"
                      startIcon={<DrawIcon />}
                      onClick={handleSignDocument}
                      disabled={signingLoading}
                      sx={{ bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' }, textTransform: 'none', fontWeight: 700 }}
                    >
                      {signingLoading ? 'Signing...' : `Digitally Sign as ${signStage}`}
                    </Button>
                  </Paper>

                  {/* Active Signatures */}
                  <Paper elevation={0} sx={{ p: 2.5, bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a', mb: 1.5 }}>
                      Document Signature Records
                    </Typography>

                    {signatures.length === 0 ? (
                      <Typography variant="body2" sx={{ color: '#64748b' }}>
                        No digital signatures recorded yet.
                      </Typography>
                    ) : (
                      <Grid container spacing={1.5}>
                        {signatures.map((sig, idx) => (
                          <Grid item xs={12} sm={6} key={idx}>
                            <Paper elevation={0} sx={{ p: 1.5, border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: '#f8fafc' }}>
                              <Stack direction="row" alignItems="center" spacing={1}>
                                <CheckCircleIcon sx={{ color: '#16a34a', fontSize: 18 }} />
                                <Typography variant="caption" sx={{ fontWeight: 800, color: '#0f172a' }}>
                                  {sig.stage || sig.stage_name}
                                </Typography>
                              </Stack>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', mt: 0.5 }}>
                                {sig.signer || sig.signed_by_name}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                                {sig.role || sig.signed_by_role} • {sig.signedAt || sig.signed_at}
                              </Typography>
                              {sig.hash && (
                                <Typography variant="caption" sx={{ color: '#2563eb', fontWeight: 600, display: 'block' }}>
                                  Hash: {sig.hash.substring(0, 16)}...
                                </Typography>
                              )}
                            </Paper>
                          </Grid>
                        ))}
                      </Grid>
                    )}
                  </Paper>
                </Stack>
              )}

              {/* TAB 3: RELATIONSHIPS */}
              {tabIndex === 3 && (
                <Paper elevation={0} sx={{ p: 2.5, bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', mb: 1 }}>
                    Document Relationship & Workflow Graph
                  </Typography>

                  {relationships?.parent && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Parent Transaction:
                      </Typography>
                      <Paper elevation={0} sx={{ p: 1.5, mt: 0.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {relationships.parent.label}: {relationships.parent.document_no}
                        </Typography>
                      </Paper>
                    </Box>
                  )}

                  {relationships?.children && relationships.children.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Downstream Documents & Actions:
                      </Typography>
                      <Stack spacing={1} sx={{ mt: 0.5 }}>
                        {relationships.children.map((child, cIdx) => (
                          <Paper key={cIdx} elevation={0} sx={{ p: 1.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {child.label}: {child.document_no}
                            </Typography>
                            {child.status && (
                              <Chip label={child.status} size="small" sx={{ mt: 0.5, height: 20, fontSize: '0.7rem' }} />
                            )}
                          </Paper>
                        ))}
                      </Stack>
                    </Box>
                  )}

                  {(!relationships?.parent && (!relationships?.children || relationships.children.length === 0)) && (
                    <Typography variant="body2" sx={{ color: '#64748b' }}>
                      Standalone ERP Document with no linked transactions.
                    </Typography>
                  )}
                </Paper>
              )}

              {/* TAB 4: AUDIT TRAIL */}
              {tabIndex === 4 && (
                <Paper elevation={0} sx={{ p: 2.5, bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', mb: 1.5 }}>
                    Complete Document Activity Audit Trail
                  </Typography>

                  {auditLogs.length === 0 ? (
                    <Typography variant="body2" sx={{ color: '#64748b' }}>
                      No audit records logged yet.
                    </Typography>
                  ) : (
                    <TableContainer>
                      <Table size="small">
                        <TableHead sx={{ bgcolor: '#f8fafc' }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>User / Actor</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Details</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Timestamp</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {auditLogs.map((log, lIdx) => (
                            <TableRow key={lIdx}>
                              <TableCell>
                                <Chip label={log.action} size="small" sx={{ fontWeight: 700, fontSize: '0.7rem' }} />
                              </TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>{log.user_name || 'System'}</TableCell>
                              <TableCell sx={{ color: '#64748b' }}>{log.details || '—'}</TableCell>
                              <TableCell sx={{ color: '#64748b' }}>{new Date(log.created_at).toLocaleString('en-IN')}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Paper>
              )}
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2.5, bgcolor: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
          <Button onClick={onClose} sx={{ color: '#64748b' }}>Close</Button>
          <Button
            variant="contained"
            startIcon={<PictureAsPdfIcon />}
            onClick={handleDownloadPDF}
            sx={{ bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' }, textTransform: 'none', fontWeight: 700 }}
          >
            Download PDF
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={3000}
        onClose={() => setToastMessage('')}
        message={toastMessage}
      />
    </>
  );
}
