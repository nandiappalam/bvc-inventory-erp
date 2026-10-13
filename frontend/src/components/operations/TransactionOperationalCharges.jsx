import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Grid,
  Tooltip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PaymentIcon from '@mui/icons-material/Payment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EngineeringIcon from '@mui/icons-material/Engineering';
import DriveEtaIcon from '@mui/icons-material/DriveEta';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import RefreshIcon from '@mui/icons-material/Refresh';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

export default function TransactionOperationalCharges({
  sourceModule, // 'GODOWN_TRANSFER', 'OUTPASS', 'INPASS', 'PURCHASE', 'SALES'
  sourceTransactionId,
  sourceTransactionNo,
  defaultVehicleNo = '',
  defaultDriverName = '',
  defaultItemName = '',
  defaultQuantity = 0,
  defaultFromLocation = '',
  defaultToLocation = '',
  onChargeAdded
}) {
  const { selectedCompany, user } = useAuth();
  const companyId = selectedCompany?.id || 1;

  const [charges, setCharges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [parties, setParties] = useState([]);

  const [form, setForm] = useState({
    charge_type: 'LOADING',
    party_id: '',
    party_name: '',
    party_category: 'LOADMAN',
    vehicle_no: defaultVehicleNo,
    driver_name: defaultDriverName,
    item_name: defaultItemName,
    from_location: defaultFromLocation,
    to_location: defaultToLocation,
    quantity: defaultQuantity || '5000',
    calculation_basis: 'PER_KG',
    rate: '0.50',
    amount: '2500',
    remarks: ''
  });

  const apiHeaders = { headers: { 'x-company-id': companyId } };

  const loadCharges = async () => {
    if (!sourceTransactionId && !sourceTransactionNo) return;
    setLoading(true);
    try {
      const res = await axios.get('/api/operational-charges/traceability', {
        ...apiHeaders,
        params: {
          source_module: sourceModule,
          source_transaction_id: sourceTransactionId,
          source_transaction_no: sourceTransactionNo
        }
      });
      setCharges(res.data?.traceability?.charges || []);
    } catch (err) {
      console.warn('Error loading transaction charges:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCharges();
    axios.get('/api/operational-charges/parties', apiHeaders)
      .then(r => setParties(r.data?.parties || []))
      .catch(() => {});
  }, [sourceTransactionId, sourceTransactionNo, companyId]);

  const handleOpenAdd = () => {
    setForm(prev => ({
      ...prev,
      vehicle_no: defaultVehicleNo || prev.vehicle_no,
      driver_name: defaultDriverName || prev.driver_name,
      item_name: defaultItemName || prev.item_name,
      from_location: defaultFromLocation || prev.from_location,
      to_location: defaultToLocation || prev.to_location,
      quantity: defaultQuantity || prev.quantity
    }));
    setAddModalOpen(true);
  };

  const handleSave = async () => {
    try {
      await axios.post('/api/operational-charges', {
        ...form,
        source_module: sourceModule,
        source_transaction_type: sourceModule,
        source_transaction_id: sourceTransactionId,
        source_transaction_no: sourceTransactionNo,
        created_by: user?.username || 'Operator'
      }, apiHeaders);
      setAddModalOpen(false);
      loadCharges();
      if (onChargeAdded) onChargeAdded();
    } catch (err) {
      alert('Error saving charge: ' + (err.response?.data?.error || err.message));
    }
  };

  const totalCost = charges.reduce((s, c) => s + (parseFloat(c.total_amount) || 0), 0);
  const totalPaid = charges.reduce((s, c) => s + (parseFloat(c.paid_amount) || 0), 0);

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#f8fafc', mt: 2, border: '1px solid #cbd5e1' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocalShippingIcon sx={{ color: '#2563eb' }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e3a8a' }}>
            Operational Costs & Worker/Driver Charges
          </Typography>
          <Chip
            label={`Total: ₹${totalCost.toLocaleString()} | Paid: ₹${totalPaid.toLocaleString()}`}
            size="small"
            sx={{ fontWeight: 700, bgcolor: totalCost > 0 ? '#dbeafe' : '#e2e8f0', color: '#1e3a8a' }}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadCharges}
            sx={{ textTransform: 'none', py: 0.2 }}
          >
            Refresh
          </Button>
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenAdd}
            sx={{ bgcolor: '#2563eb', fontWeight: 700, textTransform: 'none', py: 0.2 }}
          >
            + Add Operational Charge
          </Button>
        </Box>
      </Box>

      {charges.length === 0 ? (
        <Typography variant="body2" sx={{ color: '#94a3b8', fontStyle: 'italic', py: 1 }}>
          No operational charges recorded for this transaction yet. (e.g. Loading labour, vehicle driver, transport charge).
        </Typography>
      ) : (
        <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, bgcolor: '#ffffff' }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f1f5f9' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Charge No</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Operation</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Party / Worker</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Vehicle / Route</TableCell>
                <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Amount</TableCell>
                <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Balance</TableCell>
                <TableCell sx={{ fontWeight: 700, textAlign: 'center' }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {charges.map(ch => (
                <TableRow key={ch.id} hover>
                  <TableCell sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{ch.charge_no}</TableCell>
                  <TableCell>
                    <Chip label={ch.charge_type} size="small" sx={{ fontWeight: 700, fontSize: 10, height: 20 }} />
                  </TableCell>
                  <TableCell>{ch.party_name}</TableCell>
                  <TableCell>{ch.vehicle_no || ch.from_location || '-'}</TableCell>
                  <TableCell sx={{ textAlign: 'right', fontWeight: 800 }}>₹{Number(ch.total_amount).toLocaleString()}</TableCell>
                  <TableCell sx={{ textAlign: 'right', color: ch.balance_amount > 0 ? '#b45309' : '#16a34a', fontWeight: 700 }}>
                    ₹{Number(ch.balance_amount).toLocaleString()}
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center' }}>
                    <Chip label={ch.status} size="small" sx={{ fontSize: 9, height: 18 }} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add Modal */}
      <Dialog open={addModalOpen} onClose={() => setAddModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#1e3a8a' }}>
          Record Operational Charge on {sourceModule} {sourceTransactionNo}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Operation Type"
                fullWidth
                size="small"
                value={form.charge_type}
                onChange={(e) => setForm({ ...form, charge_type: e.target.value })}
              >
                <MenuItem value="LOADING">Loading Operation</MenuItem>
                <MenuItem value="UNLOADING">Unloading Operation</MenuItem>
                <MenuItem value="DRIVER">Driver Trip Payment</MenuItem>
                <MenuItem value="TRANSPORT">Transport Charge</MenuItem>
                <MenuItem value="HELPER">Vehicle Helper</MenuItem>
                <MenuItem value="PROCESSING">Mill Processing</MenuItem>
                <MenuItem value="WEIGHING">Weighbridge</MenuItem>
                <MenuItem value="LABOUR">General Labour</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Party / Worker Name"
                fullWidth
                size="small"
                value={form.party_name}
                onChange={(e) => setForm({ ...form, party_name: e.target.value })}
                placeholder="e.g. Ramesh Loadman, Murugan Driver"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Vehicle No"
                fullWidth
                size="small"
                value={form.vehicle_no}
                onChange={(e) => setForm({ ...form, vehicle_no: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Driver Name"
                fullWidth
                size="small"
                value={form.driver_name}
                onChange={(e) => setForm({ ...form, driver_name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Quantity (KG / Bags)"
                fullWidth
                size="small"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Rate (₹)"
                fullWidth
                size="small"
                value={form.rate}
                onChange={(e) => {
                  const r = e.target.value;
                  const amt = (parseFloat(form.quantity) || 0) * (parseFloat(r) || 0);
                  setForm({ ...form, rate: r, amount: amt.toString() });
                }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Total Amount (₹)"
                fullWidth
                size="small"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                sx={{ input: { fontWeight: 800, color: '#1e3a8a' } }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Remarks"
                fullWidth
                size="small"
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddModalOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} sx={{ bgcolor: '#1e3a8a', fontWeight: 700 }}>
            Save Charge
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
