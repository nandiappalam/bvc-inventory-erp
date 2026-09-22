import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Alert,
  IconButton,
  Tooltip,
  MenuItem,
  CircularProgress
} from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import PrintIcon from '@mui/icons-material/Print';
import SearchIcon from '@mui/icons-material/Search';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloseIcon from '@mui/icons-material/Close';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import FactoryIcon from '@mui/icons-material/Factory';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import QRCode from 'qrcode';

export default function BarcodeQRManager() {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState(0);
  const [scanQuery, setScanQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 360 result dialog
  const [dossierOpen, setDossierOpen] = useState(false);
  const [lookupResult, setLookupResult] = useState(null);

  // Generator states
  const [genType, setGenType] = useState('LOT');
  const [genEntity, setGenEntity] = useState('');
  const [genTitle, setGenTitle] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const printLabelRef = useRef(null);

  // Registered codes
  const [registeredCodes, setRegisteredCodes] = useState([]);

  useEffect(() => {
    fetchRegisteredCodes();
    // Check if query param code exists
    const params = new URLSearchParams(location.search);
    const codeParam = params.get('code');
    if (codeParam) {
      setScanQuery(codeParam);
      handleLookup(codeParam);
    }
  }, [location.search]);

  useEffect(() => {
    // Generate QR preview on genEntity change
    if (genEntity) {
      const codeStr = genEntity.startsWith(`${genType}-`) ? genEntity : `${genType}-${genEntity}`;
      QRCode.toDataURL(codeStr, { width: 180, margin: 2 }, (err, url) => {
        if (!err) setQrDataUrl(url);
      });
    } else {
      setQrDataUrl('');
    }
  }, [genType, genEntity]);

  const fetchRegisteredCodes = async () => {
    try {
      const res = await axios.get('/api/barcode-qr/all');
      if (res.data.success) {
        setRegisteredCodes(res.data.data || []);
      }
    } catch (err) {
      console.warn('Error fetching codes:', err.message);
    }
  };

  const parseError = (err) => {
    if (!err) return '';
    const raw = err.response?.data?.error || err.response?.data?.message || err.message || err;
    if (typeof raw === 'object' && raw !== null) {
      if (typeof raw.message === 'string') return raw.message;
      if (typeof raw.error === 'string') return raw.error;
      try {
        return JSON.stringify(raw);
      } catch {
        return String(raw);
      }
    }
    return String(raw);
  };

  const handleLookup = async (codeToLookup) => {
    const code = codeToLookup || scanQuery;
    if (!code || !code.trim()) {
      setErrorMsg('Please enter or scan a valid code');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const res = await axios.get(`/api/barcode-qr/lookup/${encodeURIComponent(code.trim())}`);
      if (res.data.success) {
        setLookupResult(res.data.data);
        setDossierOpen(true);
      } else {
        setErrorMsg('Lookup failed: ' + (res.data.error || 'Code not found'));
      }
    } catch (err) {
      setErrorMsg(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterCode = async () => {
    if (!genEntity.trim()) {
      setErrorMsg('Please enter an identifier / lot / item code');
      return;
    }

    try {
      const res = await axios.post('/api/barcode-qr/register', {
        codeType: genType,
        entityCode: genEntity.trim(),
        labelTitle: genTitle || `${genType} Label - ${genEntity.trim()}`
      });

      if (res.data.success) {
        setSuccessMsg(`QR Code '${res.data.data.code}' registered successfully`);
        fetchRegisteredCodes();
      }
    } catch (err) {
      setErrorMsg(parseError(err));
    }
  };

  const handlePrintLabel = () => {
    if (!printLabelRef.current) return;
    const printContent = printLabelRef.current.innerHTML;
    const win = window.open('', '', 'width=600,height=500');
    win.document.write(`
      <html>
        <head>
          <title>Print Label</title>
          <style>
            body { font-family: sans-serif; margin: 0; padding: 20px; text-align: center; }
            .label-box { border: 2px solid #000; padding: 15px; border-radius: 8px; display: inline-block; max-width: 320px; }
            .title { font-size: 16px; font-weight: bold; margin-bottom: 8px; }
            .code-text { font-family: monospace; font-size: 14px; margin-top: 8px; font-weight: bold; }
            .sub { font-size: 12px; color: #555; }
          </style>
        </head>
        <body>
          <div class="label-box">
            ${printContent}
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            <QrCode2Icon color="primary" fontSize="large" /> Barcode & QR Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Universal 360° Barcode/QR Scanning, Lot Identification, and Industrial Label Generator
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<AccountTreeIcon />}
          onClick={() => navigate('/lot-genealogy')}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          Open Lot Genealogy Tree
        </Button>
      </Box>

      {Boolean(errorMsg) && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMsg('')}>
          {typeof errorMsg === 'object' ? (errorMsg.message || JSON.stringify(errorMsg)) : String(errorMsg)}
        </Alert>
      )}
      {successMsg && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg('')}>
          {successMsg}
        </Alert>
      )}

      {/* Tabs */}
      <Card sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(e, val) => setActiveTab(val)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          <Tab icon={<QrCodeScannerIcon />} iconPosition="start" label="Universal 360° Scan & Lookup" />
          <Tab icon={<QrCode2Icon />} iconPosition="start" label="QR Label Generator & Print" />
          <Tab icon={<CheckCircleOutlineIcon />} iconPosition="start" label="Registered Codes Master" />
        </Tabs>

        {/* TAB 0: SCAN & LOOKUP */}
        {activeTab === 0 && (
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              Scan or Enter Any Barcode / QR Code
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Supports Lot Codes (e.g. <code>LOT-2026-001</code>), Location Codes (e.g. <code>LOC-CH1-R1</code>), Item Codes (e.g. <code>ITM-101</code>), or raw lot numbers.
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', maxWidth: 650, mb: 3 }}>
              <TextField
                fullWidth
                size="medium"
                variant="outlined"
                placeholder="Scan barcode or type code here..."
                value={scanQuery}
                onChange={(e) => setScanQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleLookup();
                }}
                InputProps={{
                  startAdornment: <QrCodeScannerIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
              <Button
                variant="contained"
                size="large"
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
                onClick={() => handleLookup()}
                disabled={loading}
                sx={{ px: 3, textTransform: 'none', fontWeight: 600, minWidth: 140 }}
              >
                Lookup 360°
              </Button>
            </Box>

            {/* Quick Demo Lot Triggers */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                Quick Test Codes:
              </Typography>
              {['LOT-TEST-123', 'LOT-PUR-001', 'LOC-CHAMBER-01', 'ITM-URAD-GOTTA'].map((code) => (
                <Chip
                  key={code}
                  label={code}
                  size="small"
                  clickable
                  onClick={() => {
                    setScanQuery(code);
                    handleLookup(code);
                  }}
                  variant="outlined"
                  color="primary"
                />
              ))}
            </Box>
          </CardContent>
        )}

        {/* TAB 1: GENERATOR & PRINT */}
        {activeTab === 1 && (
          <CardContent sx={{ p: 3 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                  Configure Barcode / QR Label
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      label="Entity Type"
                      value={genType}
                      onChange={(e) => setGenType(e.target.value)}
                    >
                      <MenuItem value="LOT">Lot (Raw / Finished)</MenuItem>
                      <MenuItem value="LOCATION">Warehouse / Cold Storage Location</MenuItem>
                      <MenuItem value="ITEM">Item Master</MenuItem>
                      <MenuItem value="FINISHED_GOOD">Finished Product Pack</MenuItem>
                      <MenuItem value="PALLET">Pallet / Bin</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Entity Identifier / Number"
                      placeholder="e.g. 2026-0042"
                      value={genEntity}
                      onChange={(e) => setGenEntity(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Label Title / Description"
                      placeholder="e.g. Urad Sabut Grade A - Inward Lot"
                      value={genTitle}
                      onChange={(e) => setGenTitle(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Button
                        variant="contained"
                        startIcon={<CheckCircleOutlineIcon />}
                        onClick={handleRegisterCode}
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                      >
                        Register Code in Master
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<PrintIcon />}
                        onClick={handlePrintLabel}
                        disabled={!qrDataUrl}
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                      >
                        Print QR Label
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </Grid>

              {/* Label Preview Card */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                  Live Industrial Label Preview
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2.5,
                    maxWidth: 320,
                    mx: 'auto',
                    textAlign: 'center',
                    border: '2px solid #334155',
                    borderRadius: 2
                  }}
                >
                  <div ref={printLabelRef}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      BVC
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {genTitle || `${genType} IDENTIFIER`}
                    </Typography>
                    <Divider sx={{ my: 1 }} />
                    {qrDataUrl ? (
                      <img src={qrDataUrl} alt="QR Preview" style={{ width: 150, height: 150, margin: '8px 0' }} />
                    ) : (
                      <Box sx={{ width: 150, height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #cbd5e1', mx: 'auto', my: 1 }}>
                        <Typography variant="caption" color="text.secondary">Enter ID for QR</Typography>
                      </Box>
                    )}
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                      {genEntity ? `${genType}-${genEntity}` : 'CODE-XXXXX'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                      Scan via BVC Mobile or Handheld Scanner
                    </Typography>
                  </div>
                </Paper>
              </Grid>
            </Grid>
          </CardContent>
        )}

        {/* TAB 2: MASTER CODES LIST */}
        {activeTab === 2 && (
          <CardContent sx={{ p: 2 }}>
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'grey.50' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Title / Description</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Created Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {registeredCodes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        No registered barcode/QR entries found yet. Use the Generator tab to register codes.
                      </TableCell>
                    </TableRow>
                  ) : (
                    registeredCodes.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell>
                          <Chip label={row.code_type} size="small" color="primary" variant="outlined" />
                        </TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                          {row.entity_code}
                        </TableCell>
                        <TableCell>{row.label_title}</TableCell>
                        <TableCell>{new Date(row.created_at).toLocaleDateString()}</TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<SearchIcon />}
                            onClick={() => handleLookup(row.entity_code)}
                            sx={{ textTransform: 'none' }}
                          >
                            Inspect 360°
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        )}
      </Card>

      {/* 360° LOT / CODE DOSSIER DIALOG */}
      <Dialog
        open={dossierOpen}
        onClose={() => setDossierOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle component="div" sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <QrCode2Icon color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              360° Code Dossier: {lookupResult?.code || lookupResult?.lotNo}
            </Typography>
          </Box>
          <IconButton onClick={() => setDossierOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          {lookupResult?.type === 'LOT' ? (
            <Box>
              {/* Top Banner */}
              <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#f8fafc' }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary">Item Commodity</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>{lookupResult.itemName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Lot No: <strong style={{ fontFamily: 'monospace' }}>{lookupResult.lotNo}</strong>
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Current On-Hand Stock</Typography>
                    <Typography variant="h6" color="primary.main" sx={{ fontWeight: 700 }}>
                      {lookupResult.currentStock?.toLocaleString()} {lookupResult.unit}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Location: {lookupResult.currentGodown}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3} sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" color="text.secondary" display="block">Quality Status</Typography>
                    <Chip
                      label={lookupResult.qcStatus}
                      color={lookupResult.qcStatus === 'PASSED' ? 'success' : lookupResult.qcStatus === 'HOLD' ? 'warning' : 'error'}
                      size="small"
                      sx={{ fontWeight: 700 }}
                    />
                  </Grid>
                </Grid>
              </Paper>

              {/* Traceability Grid */}
              <Grid container spacing={2}>
                {/* 1. Purchase Inward */}
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <LocalShippingIcon color="primary" fontSize="small" /> Purchase Inward Information
                      </Typography>
                      {lookupResult.purchase ? (
                        <Box sx={{ fontSize: '13px' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                            <span style={{ color: '#64748b' }}>Voucher #:</span>
                            <strong>{lookupResult.purchase.voucherNo}</strong>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                            <span style={{ color: '#64748b' }}>Inward Date:</span>
                            <span>{lookupResult.purchase.inwardDate}</span>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                            <span style={{ color: '#64748b' }}>Supplier:</span>
                            <strong>{lookupResult.purchase.supplierName}</strong>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                            <span style={{ color: '#64748b' }}>Vehicle:</span>
                            <span>{lookupResult.purchase.vehicleNo || 'N/A'}</span>
                          </Box>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">No direct purchase inward record linked.</Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                {/* 2. Quality Control */}
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <VerifiedUserIcon color="success" fontSize="small" /> Quality Inspection
                      </Typography>
                      {lookupResult.qcInspection ? (
                        <Box sx={{ fontSize: '13px' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                            <span style={{ color: '#64748b' }}>Inspection #:</span>
                            <strong>{lookupResult.qcInspection.qcNo}</strong>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                            <span style={{ color: '#64748b' }}>Inspector:</span>
                            <span>{lookupResult.qcInspection.inspector || 'QC Team'}</span>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                            <span style={{ color: '#64748b' }}>Result:</span>
                            <Chip label={lookupResult.qcInspection.result} size="small" color="success" />
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                            <span style={{ color: '#64748b' }}>Inspection Date:</span>
                            <span>{lookupResult.qcInspection.date}</span>
                          </Box>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">No formal QC certificate logged.</Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                {/* 3. Production & Milling */}
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <FactoryIcon color="warning" fontSize="small" /> Milling & Processing
                      </Typography>
                      <Box sx={{ fontSize: '13px' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                          <span style={{ color: '#64748b' }}>Raw Grain Consumed:</span>
                          <span>{lookupResult.millingUsage?.inputs?.length || 0} batches</span>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                          <span style={{ color: '#64748b' }}>Flour/Gotta Produced:</span>
                          <span>{lookupResult.millingUsage?.outputs?.length || 0} batches</span>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* 4. Cold Storage Activity */}
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <AcUnitIcon color="info" fontSize="small" /> Cold Storage History
                      </Typography>
                      <Box sx={{ fontSize: '13px' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                          <span style={{ color: '#64748b' }}>CSI Inwards:</span>
                          <span>{lookupResult.coldStorageMovements?.inwards?.length || 0} entries</span>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                          <span style={{ color: '#64748b' }}>CSO Outwards:</span>
                          <span>{lookupResult.coldStorageMovements?.outwards?.length || 0} dispatches</span>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          ) : (
            <Box sx={{ py: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {lookupResult?.type} Details
              </Typography>
              <pre style={{ background: '#f8fafc', padding: '12px', borderRadius: '4px', overflowX: 'auto' }}>
                {JSON.stringify(lookupResult, null, 2)}
              </pre>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={() => setDossierOpen(false)} sx={{ textTransform: 'none' }}>
            Close
          </Button>
          {lookupResult?.type === 'LOT' && (
            <Button
              variant="contained"
              color="primary"
              endIcon={<ArrowForwardIcon />}
              onClick={() => {
                setDossierOpen(false);
                navigate(`/lot-genealogy?lotNo=${encodeURIComponent(lookupResult.lotNo)}`);
              }}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Trace Lot Genealogy Tree
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
