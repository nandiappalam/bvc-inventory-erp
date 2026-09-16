import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Chip,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  IconButton,
  CircularProgress,
  Divider,
  BottomNavigation,
  BottomNavigationAction
} from '@mui/material';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import InputIcon from '@mui/icons-material/Input';
import OutputIcon from '@mui/icons-material/Output';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import WifiIcon from '@mui/icons-material/Wifi';
import HistoryIcon from '@mui/icons-material/History';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function WarehouseMobileView() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeModal, setActiveModal] = useState(null); // 'RECEIVE', 'ISSUE', 'TRANSFER', 'DISPATCH', 'SCAN'
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Mobile Action Forms
  const [receiveForm, setReceiveForm] = useState({
    godownId: 1,
    godownName: 'Main Godown',
    itemName: 'Urad Sabut',
    lotNo: '',
    quantityBags: '',
    weightKg: '',
    remarks: ''
  });

  const [issueForm, setIssueForm] = useState({
    lotNo: '',
    quantityBags: '',
    weightKg: '',
    purpose: 'Production Milling',
    remarks: ''
  });

  const [transferForm, setTransferForm] = useState({
    sourceGodownId: 1,
    sourceGodownName: 'Main Godown',
    destGodownId: 2,
    destGodownName: 'Chamber 01',
    lotNo: '',
    weightKg: '',
    remarks: ''
  });

  const [dispatchForm, setDispatchForm] = useState({
    orderNo: '',
    vehicleNo: '',
    driverName: '',
    weightKg: '',
    remarks: ''
  });

  // Fast Scan State
  const [scanCode, setScanCode] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [scanLoading, setScanLoading] = useState(false);

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

  useEffect(() => {
    fetchWarehouseData();
  }, []);

  const fetchWarehouseData = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/warehouse-ops/dashboard-data');
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (err) {
      setErrorMsg(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleReceiveSubmit = async () => {
    try {
      const res = await axios.post('/api/warehouse-ops/receive', receiveForm);
      if (res.data.success) {
        setSuccessMsg(`Stock Received: ${receiveForm.weightKg} KG into ${receiveForm.godownName}`);
        setActiveModal(null);
        fetchWarehouseData();
      }
    } catch (err) {
      setErrorMsg(parseError(err));
    }
  };

  const handleIssueSubmit = async () => {
    try {
      const res = await axios.post('/api/warehouse-ops/issue', issueForm);
      if (res.data.success) {
        setSuccessMsg(`Stock Issued: ${issueForm.weightKg} KG for ${issueForm.purpose}`);
        setActiveModal(null);
        fetchWarehouseData();
      }
    } catch (err) {
      setErrorMsg(parseError(err));
    }
  };

  const handleTransferSubmit = async () => {
    try {
      const res = await axios.post('/api/warehouse-ops/transfer', transferForm);
      if (res.data.success) {
        setSuccessMsg(`Stock Transferred: ${transferForm.weightKg} KG moved to ${transferForm.destGodownName}`);
        setActiveModal(null);
        fetchWarehouseData();
      }
    } catch (err) {
      setErrorMsg(parseError(err));
    }
  };

  const handleDispatchSubmit = async () => {
    try {
      const res = await axios.post('/api/warehouse-ops/dispatch', dispatchForm);
      if (res.data.success) {
        setSuccessMsg(`Vehicle ${dispatchForm.vehicleNo} Dispatched successfully!`);
        setActiveModal(null);
        fetchWarehouseData();
      }
    } catch (err) {
      setErrorMsg(parseError(err));
    }
  };

  const handleFastScan = async () => {
    if (!scanCode.trim()) return;
    setScanLoading(true);
    try {
      const res = await axios.get(`/api/barcode-qr/lookup/${encodeURIComponent(scanCode.trim())}`);
      if (res.data.success) {
        setScanResult(res.data.data);
      } else {
        setErrorMsg('Code lookup failed.');
      }
    } catch (err) {
      setErrorMsg(parseError(err));
    } finally {
      setScanLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }} color="text.secondary">Loading Warehouse Mobile Interface...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 2 }, maxWidth: 900, mx: 'auto', pb: 10 }}>
      {/* Top Mobile Bar */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarehouseIcon color="primary" /> Warehouse Mobile Operations
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Touch-Optimized Shop Floor & Godown Movement Interface
          </Typography>
        </Box>
        <Chip
          icon={<WifiIcon fontSize="small" />}
          label="Online"
          size="small"
          color="success"
          sx={{ fontWeight: 700 }}
        />
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

      {/* Warehouse Summary Cards */}
      <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
        <Grid item xs={6} sm={3}>
          <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', bgcolor: '#f8fafc' }}>
            <Typography variant="caption" color="text.secondary">TOTAL ON-HAND</Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main' }}>
              {data?.totalStockMT} MT
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', bgcolor: '#f8fafc' }}>
            <Typography variant="caption" color="text.secondary">TOTAL GODOWNS</Typography>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {data?.godowns?.length || 0} Sites
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', bgcolor: '#f8fafc' }}>
            <Typography variant="caption" color="text.secondary">ITEM LINES</Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#10b981' }}>
              {data?.totalItemsInStock} Items
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', bgcolor: '#f8fafc' }}>
            <Typography variant="caption" color="text.secondary">PENDING DISPATCH</Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#f59e0b' }}>
              {data?.pendingDispatches} Orders
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Big Touch Action Buttons Grid (48px+ touch targets) */}
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
        Fast Godown Operations
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* RECEIVE */}
        <Grid item xs={6} sm={4}>
          <Button
            fullWidth
            variant="contained"
            color="primary"
            onClick={() => setActiveModal('RECEIVE')}
            sx={{
              p: 2.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              borderRadius: 2,
              textTransform: 'none',
              minHeight: 100
            }}
          >
            <InputIcon sx={{ fontSize: 32 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1 }}>
              RECEIVE
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>Goods Inward</Typography>
          </Button>
        </Grid>

        {/* ISSUE */}
        <Grid item xs={6} sm={4}>
          <Button
            fullWidth
            variant="contained"
            color="secondary"
            onClick={() => setActiveModal('ISSUE')}
            sx={{
              p: 2.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              borderRadius: 2,
              textTransform: 'none',
              minHeight: 100
            }}
          >
            <OutputIcon sx={{ fontSize: 32 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1 }}>
              ISSUE
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>To Production / Grinding</Typography>
          </Button>
        </Grid>

        {/* TRANSFER */}
        <Grid item xs={6} sm={4}>
          <Button
            fullWidth
            variant="contained"
            sx={{
              bgcolor: '#0d9488',
              '&:hover': { bgcolor: '#0f766e' },
              p: 2.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              borderRadius: 2,
              textTransform: 'none',
              minHeight: 100
            }}
            onClick={() => setActiveModal('TRANSFER')}
          >
            <SwapHorizIcon sx={{ fontSize: 32 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1 }}>
              TRANSFER
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>Inter-Godown / CS</Typography>
          </Button>
        </Grid>

        {/* DISPATCH */}
        <Grid item xs={6} sm={4}>
          <Button
            fullWidth
            variant="contained"
            sx={{
              bgcolor: '#d97706',
              '&:hover': { bgcolor: '#b45309' },
              p: 2.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              borderRadius: 2,
              textTransform: 'none',
              minHeight: 100
            }}
            onClick={() => setActiveModal('DISPATCH')}
          >
            <LocalShippingIcon sx={{ fontSize: 32 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1 }}>
              DISPATCH
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>Vehicle Gate-Out</Typography>
          </Button>
        </Grid>

        {/* FAST SCAN */}
        <Grid item xs={12} sm={8}>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => setActiveModal('SCAN')}
            sx={{
              p: 2.5,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              borderRadius: 2,
              textTransform: 'none',
              borderWidth: 2,
              minHeight: 100
            }}
          >
            <QrCodeScannerIcon sx={{ fontSize: 38 }} color="primary" />
            <Box sx={{ textAlign: 'left' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                SCAN BARCODE / QR
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Instant 360° Stock, Lot & Location Inspection
              </Typography>
            </Box>
          </Button>
        </Grid>
      </Grid>

      {/* Recent Activity Log */}
      <Card variant="outlined">
        <CardContent sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <HistoryIcon fontSize="small" /> Recent Mobile Floor Activities
          </Typography>
          {(!data?.recentLogs || data.recentLogs.length === 0) ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              No recent mobile logs. Perform operations using the action buttons above.
            </Typography>
          ) : (
            data.recentLogs.map((log) => (
              <Box
                key={log.id}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  py: 1,
                  borderBottom: '1px solid #f1f5f9'
                }}
              >
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={log.operation_type}
                      size="small"
                      color={log.operation_type === 'RECEIVE' ? 'primary' : log.operation_type === 'ISSUE' ? 'secondary' : 'default'}
                      sx={{ fontSize: '10px', fontWeight: 700, height: 20 }}
                    />
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {log.lot_no ? `Lot: ${log.lot_no}` : log.godown_name}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {log.weight_kg} KG • {log.godown_name} • By {log.user_name || 'Warehouse Staff'}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {log.created_at?.split('T')[0] || 'Today'}
                </Typography>
              </Box>
            ))
          )}
        </CardContent>
      </Card>

      {/* RECEIVE MODAL */}
      <Dialog open={activeModal === 'RECEIVE'} onClose={() => setActiveModal(null)} maxWidth="xs" fullWidth>
        <DialogTitle component="div" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Goods Receipt (Inward)</Typography>
          <IconButton size="small" onClick={() => setActiveModal(null)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                size="small"
                label="Destination Godown *"
                value={receiveForm.godownName}
                onChange={(e) => setReceiveForm({ ...receiveForm, godownName: e.target.value })}
              >
                {(data?.godowns || []).map((g) => (
                  <MenuItem key={g.id} value={g.godown_name}>{g.godown_name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Item Commodity *"
                value={receiveForm.itemName}
                onChange={(e) => setReceiveForm({ ...receiveForm, itemName: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Lot No *"
                placeholder="e.g. LOT-2026-0099"
                value={receiveForm.lotNo}
                onChange={(e) => setReceiveForm({ ...receiveForm, lotNo: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                size="small"
                label="Weight (KG) *"
                type="number"
                value={receiveForm.weightKg}
                onChange={(e) => setReceiveForm({ ...receiveForm, weightKg: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                size="small"
                label="Bags"
                type="number"
                value={receiveForm.quantityBags}
                onChange={(e) => setReceiveForm({ ...receiveForm, quantityBags: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setActiveModal(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleReceiveSubmit} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Confirm Inward
          </Button>
        </DialogActions>
      </Dialog>

      {/* ISSUE MODAL */}
      <Dialog open={activeModal === 'ISSUE'} onClose={() => setActiveModal(null)} maxWidth="xs" fullWidth>
        <DialogTitle component="div" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Stock Issuance</Typography>
          <IconButton size="small" onClick={() => setActiveModal(null)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Lot No to Issue *"
                placeholder="e.g. LOT-2026-0042"
                value={issueForm.lotNo}
                onChange={(e) => setIssueForm({ ...issueForm, lotNo: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Weight (KG) *"
                type="number"
                value={issueForm.weightKg}
                onChange={(e) => setIssueForm({ ...issueForm, weightKg: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                size="small"
                label="Purpose *"
                value={issueForm.purpose}
                onChange={(e) => setIssueForm({ ...issueForm, purpose: e.target.value })}
              >
                <MenuItem value="Production Milling">Production Milling</MenuItem>
                <MenuItem value="Jobwork Grinding">Jobwork Grinding</MenuItem>
                <MenuItem value="Packaging & Repacking">Packaging & Repacking</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setActiveModal(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" color="secondary" onClick={handleIssueSubmit} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Confirm Issue
          </Button>
        </DialogActions>
      </Dialog>

      {/* TRANSFER MODAL */}
      <Dialog open={activeModal === 'TRANSFER'} onClose={() => setActiveModal(null)} maxWidth="xs" fullWidth>
        <DialogTitle component="div" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Inter-Godown Transfer</Typography>
          <IconButton size="small" onClick={() => setActiveModal(null)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                size="small"
                label="Source Godown *"
                value={transferForm.sourceGodownName}
                onChange={(e) => setTransferForm({ ...transferForm, sourceGodownName: e.target.value })}
              >
                {(data?.godowns || []).map((g) => (
                  <MenuItem key={g.id} value={g.godown_name}>{g.godown_name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                size="small"
                label="Destination Godown *"
                value={transferForm.destGodownName}
                onChange={(e) => setTransferForm({ ...transferForm, destGodownName: e.target.value })}
              >
                {(data?.godowns || []).map((g) => (
                  <MenuItem key={g.id} value={g.godown_name}>{g.godown_name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Lot No *"
                value={transferForm.lotNo}
                onChange={(e) => setTransferForm({ ...transferForm, lotNo: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Transfer Weight (KG) *"
                type="number"
                value={transferForm.weightKg}
                onChange={(e) => setTransferForm({ ...transferForm, weightKg: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setActiveModal(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleTransferSubmit} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Confirm Transfer
          </Button>
        </DialogActions>
      </Dialog>

      {/* DISPATCH MODAL */}
      <Dialog open={activeModal === 'DISPATCH'} onClose={() => setActiveModal(null)} maxWidth="xs" fullWidth>
        <DialogTitle component="div" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Customer Dispatch (Gate-Out)</Typography>
          <IconButton size="small" onClick={() => setActiveModal(null)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Fulfillment Order # *"
                placeholder="e.g. SO-2026-104"
                value={dispatchForm.orderNo}
                onChange={(e) => setDispatchForm({ ...dispatchForm, orderNo: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Vehicle Registration # *"
                placeholder="e.g. MH-12-PQ-4567"
                value={dispatchForm.vehicleNo}
                onChange={(e) => setDispatchForm({ ...dispatchForm, vehicleNo: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Driver Name"
                value={dispatchForm.driverName}
                onChange={(e) => setDispatchForm({ ...dispatchForm, driverName: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Dispatched Weight (KG) *"
                type="number"
                value={dispatchForm.weightKg}
                onChange={(e) => setDispatchForm({ ...dispatchForm, weightKg: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setActiveModal(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={handleDispatchSubmit} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Confirm Dispatch
          </Button>
        </DialogActions>
      </Dialog>

      {/* SCAN MODAL */}
      <Dialog open={activeModal === 'SCAN'} onClose={() => setActiveModal(null)} maxWidth="sm" fullWidth>
        <DialogTitle component="div" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Mobile Barcode Scanner</Typography>
          <IconButton size="small" onClick={() => setActiveModal(null)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              fullWidth
              size="medium"
              placeholder="Scan or type barcode (e.g. LOT-2026-0042)..."
              value={scanCode}
              onChange={(e) => setScanCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleFastScan(); }}
              autoFocus
            />
            <Button
              variant="contained"
              onClick={handleFastScan}
              disabled={scanLoading}
              sx={{ minWidth: 100, fontWeight: 700 }}
            >
              {scanLoading ? <CircularProgress size={20} color="inherit" /> : 'Scan'}
            </Button>
          </Box>

          {scanResult && (
            <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f8fafc' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {scanResult.itemName || scanResult.lotNo}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Type: <strong>{scanResult.type}</strong> • Lot: <strong>{scanResult.lotNo}</strong>
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                <span>Stock On Hand:</span>
                <strong>{scanResult.currentStock?.toLocaleString()} {scanResult.unit}</strong>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                <span>Godown / Location:</span>
                <strong>{scanResult.currentGodown}</strong>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                <span>Quality Status:</span>
                <Chip label={scanResult.qcStatus || 'PASSED'} size="small" color="success" />
              </Box>
            </Paper>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setActiveModal(null)} sx={{ textTransform: 'none' }}>Close</Button>
          {scanResult && (
            <Button
              variant="contained"
              onClick={() => {
                setActiveModal(null);
                navigate(`/barcode-qr?code=${encodeURIComponent(scanResult.lotNo || scanCode)}`);
              }}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Open Full 360° Dossier
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
