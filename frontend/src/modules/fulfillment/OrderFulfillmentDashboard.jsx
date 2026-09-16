import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Alert,
  CircularProgress,
  TextField,
  MenuItem,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloseIcon from '@mui/icons-material/Close';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const STAGES = [
  'ORDER_CONFIRMED',
  'STOCK_ALLOCATED',
  'PRODUCTION_COMPLETED',
  'QC_PASSED',
  'PACKING_PENDING',
  'READY_FOR_DISPATCH',
  'DISPATCHED',
  'INVOICED'
];

export default function OrderFulfillmentDashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // New Order Form
  const [orderForm, setOrderForm] = useState({
    orderNo: '',
    customerName: '',
    orderedWeightKg: '',
    expectedDeliveryDate: '',
    itemsSummary: 'Urad Gota Premium (1000 Bags)',
    orderValue: ''
  });

  // Reserve Form
  const [reserveForm, setReserveForm] = useState({
    lotNo: '',
    reservedWeightKg: '',
    godownName: 'Main Godown'
  });

  // Advance Form
  const [advanceForm, setAdvanceForm] = useState({
    nextStage: '',
    notes: '',
    vehicleNo: ''
  });

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
    fetchFulfillmentData();
  }, []);

  const fetchFulfillmentData = async () => {
    setLoading(true);
    try {
      const [stRes, ordRes, exRes] = await Promise.all([
        axios.get('/api/order-fulfillment/dashboard-stats'),
        axios.get('/api/order-fulfillment/orders-pipeline'),
        axios.get('/api/order-fulfillment/exception-alerts')
      ]);

      if (stRes.data.success) setStats(stRes.data.data);
      if (ordRes.data.success) setOrders(ordRes.data.data || []);
      if (exRes.data.success) setExceptions(exRes.data.data || []);
    } catch (err) {
      setErrorMsg(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async () => {
    try {
      const res = await axios.post('/api/order-fulfillment/orders', orderForm);
      if (res.data.success) {
        setSuccessMsg(`Fulfillment Order ${res.data.data.orderNo} initialized!`);
        setNewOrderOpen(false);
        fetchFulfillmentData();
      }
    } catch (err) {
      setErrorMsg(parseError(err));
    }
  };

  const handleOpenReserve = (order) => {
    setSelectedOrder(order);
    setReserveForm({
      lotNo: '',
      reservedWeightKg: Math.max(0, order.ordered_weight_kg - order.reserved_weight_kg),
      godownName: 'Main Godown'
    });
    setReserveOpen(true);
  };

  const handleReserveStock = async () => {
    if (!selectedOrder) return;
    try {
      const res = await axios.post(`/api/order-fulfillment/reserve-stock/${selectedOrder.id}`, reserveForm);
      if (res.data.success) {
        setSuccessMsg(`Reserved ${reserveForm.reservedWeightKg} KG from lot ${reserveForm.lotNo}!`);
        setReserveOpen(false);
        fetchFulfillmentData();
      }
    } catch (err) {
      setErrorMsg(parseError(err));
    }
  };

  const handleOpenAdvance = (order) => {
    setSelectedOrder(order);
    const currIdx = STAGES.indexOf(order.status);
    const nextSt = currIdx < STAGES.length - 1 ? STAGES[currIdx + 1] : order.status;
    setAdvanceForm({
      nextStage: nextSt,
      notes: '',
      vehicleNo: order.vehicle_no || ''
    });
    setAdvanceOpen(true);
  };

  const handleAdvanceStage = async () => {
    if (!selectedOrder) return;
    try {
      const res = await axios.post(`/api/order-fulfillment/update-stage/${selectedOrder.id}`, advanceForm);
      if (res.data.success) {
        setSuccessMsg(`Order transitioned to ${advanceForm.nextStage}!`);
        setAdvanceOpen(false);
        fetchFulfillmentData();
      }
    } catch (err) {
      setErrorMsg(parseError(err));
    }
  };

  const formatCurr = (val) => {
    return '₹' + (parseFloat(val) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  };

  if (loading && !stats) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }} color="text.secondary">Loading Order Fulfillment Pipeline...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocalShippingIcon color="primary" fontSize="large" /> Customer Order Fulfillment
          </Typography>
          <Typography variant="body2" color="text.secondary">
            End-to-End Sales Order Pipeline Tracking, Real-Time Stock Reservation & Dispatch Scheduling
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddShoppingCartIcon />}
          onClick={() => {
            setOrderForm({
              orderNo: `SO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
              customerName: '',
              orderedWeightKg: '',
              expectedDeliveryDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
              itemsSummary: 'Urad Gota Premium (500 Bags)',
              orderValue: ''
            });
            setNewOrderOpen(true);
          }}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          Create Fulfillment Order
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

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid #3b82f6' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                TOTAL ACTIVE ORDERS
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                {stats?.totalOrders} Orders
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {stats?.inProgressOrders} In Active Pipeline
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid #f59e0b' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                READY FOR DISPATCH
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#f59e0b' }}>
                {stats?.readyForDispatch} Orders
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Packed & QC Verified
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid #10b981' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                STOCK RESERVED
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#10b981' }}>
                {stats?.totalReservedMT} MT
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Protected against duplicate issuance
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid #ef4444' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                PIPELINE EXCEPTIONS
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#ef4444' }}>
                {stats?.exceptionsCount} Alerts
              </Typography>
              <Typography variant="caption" color="text.secondary">
                QC holds or delivery delays
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Exception Alerts Widget */}
      {exceptions.length > 0 && (
        <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Active Fulfillment Bottlenecks:
          </Typography>
          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
            {exceptions.map((ex, i) => (
              <li key={i}>
                <strong>{ex.orderNo} ({ex.customerName})</strong>: {ex.exceptionType.replace('_', ' ')} — {ex.details}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {/* Orders Pipeline Table */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Fulfillment Orders Pipeline Matrix
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead sx={{ bgcolor: 'grey.50' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Order #</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Customer</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Order Wt (MT)</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Reserved</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Expected Delivery</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Current Stage</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Vehicle</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                      No active customer fulfillment orders. Click 'Create Fulfillment Order' to begin.
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((ord) => {
                    const stageIdx = STAGES.indexOf(ord.status);
                    const pct = Math.round(((stageIdx + 1) / STAGES.length) * 100);

                    return (
                      <TableRow key={ord.id} hover>
                        <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                          {ord.order_no}
                          <Typography variant="caption" color="text.secondary" display="block">
                            {formatCurr(ord.order_value)}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{ord.customer_name}</TableCell>
                        <TableCell>{(ord.ordered_weight_kg / 1000).toFixed(2)} MT</TableCell>
                        <TableCell>
                          <Chip
                            label={`${(ord.reserved_weight_kg / 1000).toFixed(2)} MT`}
                            size="small"
                            color={ord.reserved_weight_kg >= ord.ordered_weight_kg ? 'success' : 'default'}
                            sx={{ fontSize: '11px', fontWeight: 600 }}
                          />
                        </TableCell>
                        <TableCell>{ord.expected_delivery_date}</TableCell>
                        <TableCell sx={{ minWidth: 160 }}>
                          <Chip
                            label={ord.status.replace(/_/g, ' ')}
                            size="small"
                            color={ord.status === 'INVOICED' ? 'success' : ord.status === 'READY_FOR_DISPATCH' ? 'warning' : 'primary'}
                            sx={{ fontSize: '11px', fontWeight: 700, mb: 0.5 }}
                          />
                          <LinearProgress variant="determinate" value={Number.isNaN(Number(pct)) ? 0 : Math.max(0, Math.min(100, Number(pct)))} sx={{ height: 5, borderRadius: 2 }} />
                        </TableCell>
                        <TableCell>{ord.vehicle_no || 'Pending'}</TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<BookmarkAddIcon />}
                              onClick={() => handleOpenReserve(ord)}
                              disabled={ord.status === 'INVOICED' || ord.status === 'DISPATCHED'}
                              sx={{ textTransform: 'none', py: 0.2 }}
                            >
                              Reserve
                            </Button>
                            <Button
                              size="small"
                              variant="contained"
                              endIcon={<ArrowForwardIcon />}
                              onClick={() => handleOpenAdvance(ord)}
                              disabled={ord.status === 'INVOICED'}
                              sx={{ textTransform: 'none', py: 0.2, fontWeight: 600 }}
                            >
                              Next Stage
                            </Button>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* CREATE ORDER MODAL */}
      <Dialog open={newOrderOpen} onClose={() => setNewOrderOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle component="div" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>New Customer Fulfillment Order</Typography>
          <IconButton size="small" onClick={() => setNewOrderOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Order Number *"
                value={orderForm.orderNo}
                onChange={(e) => setOrderForm({ ...orderForm, orderNo: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Customer Name *"
                placeholder="e.g. Mahadev Traders"
                value={orderForm.customerName}
                onChange={(e) => setOrderForm({ ...orderForm, customerName: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Ordered Weight (KG) *"
                type="number"
                placeholder="e.g. 10000"
                value={orderForm.orderedWeightKg}
                onChange={(e) => setOrderForm({ ...orderForm, orderedWeightKg: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Estimated Order Value (₹)"
                type="number"
                placeholder="e.g. 850000"
                value={orderForm.orderValue}
                onChange={(e) => setOrderForm({ ...orderForm, orderValue: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Expected Delivery Date"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={orderForm.expectedDeliveryDate}
                onChange={(e) => setOrderForm({ ...orderForm, expectedDeliveryDate: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Commodity / Packaging Spec"
                value={orderForm.itemsSummary}
                onChange={(e) => setOrderForm({ ...orderForm, itemsSummary: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setNewOrderOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateOrder} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Create Order
          </Button>
        </DialogActions>
      </Dialog>

      {/* STOCK RESERVATION MODAL */}
      <Dialog open={reserveOpen} onClose={() => setReserveOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle component="div" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Reserve Stock for {selectedOrder?.order_no}
          </Typography>
          <IconButton size="small" onClick={() => setReserveOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Lot No to Reserve *"
                placeholder="e.g. LOT-2026-0042"
                value={reserveForm.lotNo}
                onChange={(e) => setReserveForm({ ...reserveForm, lotNo: e.target.value })}
                helperText="Reserving locks this lot balance against other orders."
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Reservation Weight (KG) *"
                type="number"
                value={reserveForm.reservedWeightKg}
                onChange={(e) => setReserveForm({ ...reserveForm, reservedWeightKg: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Godown Location"
                value={reserveForm.godownName}
                onChange={(e) => setReserveForm({ ...reserveForm, godownName: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setReserveOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" color="primary" onClick={handleReserveStock} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Confirm Reservation
          </Button>
        </DialogActions>
      </Dialog>

      {/* ADVANCE STAGE MODAL */}
      <Dialog open={advanceOpen} onClose={() => setAdvanceOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle component="div" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Advance Pipeline Stage: {selectedOrder?.order_no}
          </Typography>
          <IconButton size="small" onClick={() => setAdvanceOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                size="small"
                label="Target Stage *"
                value={advanceForm.nextStage}
                onChange={(e) => setAdvanceForm({ ...advanceForm, nextStage: e.target.value })}
              >
                {STAGES.map((st) => (
                  <MenuItem key={st} value={st}>
                    {st.replace(/_/g, ' ')}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Assigned Vehicle / Transport No"
                placeholder="e.g. MH-12-AB-1234"
                value={advanceForm.vehicleNo}
                onChange={(e) => setAdvanceForm({ ...advanceForm, vehicleNo: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Progress Notes / Dispatch Remarks"
                multiline
                rows={2}
                value={advanceForm.notes}
                onChange={(e) => setAdvanceForm({ ...advanceForm, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAdvanceOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleAdvanceStage} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Update Pipeline
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
