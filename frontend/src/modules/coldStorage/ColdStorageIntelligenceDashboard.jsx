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
  TextField,
  MenuItem,
  Alert,
  IconButton,
  Tooltip,
  CircularProgress
} from '@mui/material';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import CloseIcon from '@mui/icons-material/Close';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeviceThermostatIcon from '@mui/icons-material/DeviceThermostat';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function ColdStorageIntelligenceDashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [facilities, setFacilities] = useState([]);
  const [tempLogs, setTempLogs] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals
  const [inwardOpen, setInwardOpen] = useState(false);
  const [outwardOpen, setOutwardOpen] = useState(false);
  const [tempLogOpen, setTempLogOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [selectedChamber, setSelectedChamber] = useState(null);
  const [chamberInventory, setChamberInventory] = useState([]);

  // Inward Form State
  const [inwardForm, setInwardForm] = useState({
    chamberId: '',
    itemName: 'Urad Sabut',
    inwardLotNo: '',
    originalPurchaseLotNo: '',
    qtyBags: '',
    weightKg: '',
    supplierName: 'Agro Farm Producer',
    qcStatus: 'PASSED',
    tempRecorded: '',
    humidityRecorded: '',
    remarks: ''
  });

  // Outward Form State
  const [outwardForm, setOutwardForm] = useState({
    chamberId: '',
    itemName: 'Urad Sabut',
    lotNo: '',
    weightKg: '',
    qtyBags: '',
    purpose: 'Production Milling',
    destinationGodownName: 'Main Godown',
    remarks: ''
  });

  // Temp Form State
  const [tempForm, setTempForm] = useState({
    chamberId: '',
    temperature: '',
    humidity: '',
    recordedBy: 'Shift Officer',
    remarks: ''
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
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, facRes, logsRes] = await Promise.all([
        axios.get('/api/cold-storage-intelligence/control-center-stats'),
        axios.get('/api/cold-storage-intelligence/facilities-master'),
        axios.get('/api/cold-storage-intelligence/temperature-logs')
      ]);

      if (statsRes.data.success) setStats(statsRes.data.data);
      if (facRes.data.success) setFacilities(facRes.data.data);
      if (logsRes.data.success) setTempLogs(logsRes.data.data);
    } catch (err) {
      setErrorMsg(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChamberInventory = async (ch) => {
    setSelectedChamber(ch);
    setInventoryOpen(true);
    try {
      const res = await axios.get(`/api/cold-storage-intelligence/chamber-inventory/${ch.id}`);
      if (res.data.success) {
        setChamberInventory(res.data.data || []);
      }
    } catch (err) {
      console.warn('Error fetching chamber inventory:', err);
    }
  };

  const handleInwardSubmit = async () => {
    try {
      const res = await axios.post('/api/cold-storage-intelligence/inward-csi', inwardForm);
      if (res.data.success) {
        setSuccessMsg(`Cold Storage Inward ${res.data.data.csiNo} created successfully!`);
        setInwardOpen(false);
        fetchDashboardData();
      }
    } catch (err) {
      setErrorMsg(parseError(err));
    }
  };

  const handleOutwardSubmit = async () => {
    try {
      const res = await axios.post('/api/cold-storage-intelligence/outward-cso', outwardForm);
      if (res.data.success) {
        setSuccessMsg(`Cold Storage Outward ${res.data.data.csoNo} recorded successfully!`);
        setOutwardOpen(false);
        fetchDashboardData();
      }
    } catch (err) {
      setErrorMsg(parseError(err));
    }
  };

  const handleTempLogSubmit = async () => {
    try {
      const res = await axios.post('/api/cold-storage-intelligence/temperature-logs', tempForm);
      if (res.data.success) {
        setSuccessMsg(`Temperature log recorded (Status: ${res.data.data.status})`);
        setTempLogOpen(false);
        fetchDashboardData();
      }
    } catch (err) {
      setErrorMsg(parseError(err));
    }
  };

  if (loading && !stats) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }} color="text.secondary">Loading Cold Storage Control Center...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            <AcUnitIcon color="primary" fontSize="large" /> Cold Storage Intelligence
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Multi-Chamber Capacity Control, Temperature Surveillance, Lot Lineage & Aging Management
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<ArrowDownwardIcon />}
            onClick={() => setInwardOpen(true)}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Log Inward (CSI)
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<ArrowUpwardIcon />}
            onClick={() => setOutwardOpen(true)}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Log Outward (CSO)
          </Button>
          <Button
            variant="outlined"
            startIcon={<DeviceThermostatIcon />}
            onClick={() => setTempLogOpen(true)}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Log Temp Reading
          </Button>
        </Box>
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

      {/* KPI Overview Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid #0284c7' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                TOTAL CAPACITY
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                {stats?.totalCapacityMT} MT
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Across {stats?.totalFacilities} Storage Facilities
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid #0d9488' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                OCCUPIED STOCK
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#0d9488' }}>
                {stats?.totalOccupiedMT} MT
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {stats?.occupancyOverallPct}% Total Occupancy
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid #16a34a' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                AVAILABLE CAPACITY
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#16a34a' }}>
                {stats?.availableCapacityMT} MT
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Headroom for new inward
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid #ea580c' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                INTELLIGENCE ALERTS
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 0.5, alignItems: 'baseline' }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#ea580c' }}>
                  {stats?.temperatureAlertsCount || 0}
                </Typography>
                <Typography variant="caption" color="text.secondary">Temp Alerts</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#64748b', ml: 1 }}>
                  {stats?.agingLotsCount || 0}
                </Typography>
                <Typography variant="caption" color="text.secondary">Aging Lots</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {stats?.qcHoldCount || 0} Lots in QC Hold
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Chamber Status Cards Grid */}
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        Active Chambers & Live Atmospheric Monitoring
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {(stats?.chambers || []).map((ch) => {
          const isWarning = ch.status === 'WARNING';
          const isCritical = ch.status === 'CRITICAL';
          const statusColor = isCritical ? 'error' : isWarning ? 'warning' : 'success';

          return (
            <Grid item xs={12} md={4} key={ch.id}>
              <Card
                variant="outlined"
                sx={{
                  borderTop: `4px solid ${isCritical ? '#dc2626' : isWarning ? '#f59e0b' : '#10b981'}`,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {ch.chamberName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {ch.facilityName}
                      </Typography>
                    </Box>
                    <Chip
                      label={ch.status}
                      color={statusColor}
                      size="small"
                      sx={{ fontWeight: 700, fontSize: '11px' }}
                    />
                  </Box>

                  {/* Atmospheric Gauges */}
                  <Box sx={{ display: 'flex', gap: 2, my: 2, p: 1.5, bgcolor: '#f8fafc', borderRadius: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ThermostatIcon color={statusColor} />
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">Temp</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 700 }}>
                          {ch.currentTemp}°C
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2 }}>
                      <WaterDropIcon color="primary" />
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">Humidity</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 700 }}>
                          {ch.currentHumidity}%
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* Capacity Bar */}
                  <Box sx={{ mb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        Occupancy: <strong>{(ch.occupiedKg / 1000).toFixed(1)} / {(ch.capacityKg / 1000).toFixed(1)} MT</strong>
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>
                        {ch.occupancyPct}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Number.isNaN(Number(ch.occupancyPct)) ? 0 : Math.max(0, Math.min(100, Number(ch.occupancyPct)))}
                      color={(ch.occupancyPct || 0) > 90 ? 'error' : (ch.occupancyPct || 0) > 75 ? 'warning' : 'primary'}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Available: <strong>{(ch.availableKg / 1000).toFixed(1)} MT</strong>
                  </Typography>
                </CardContent>

                <Box sx={{ p: 2, pt: 0, display: 'flex', justifyContent: 'space-between' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Inventory2Icon />}
                    onClick={() => handleOpenChamberInventory(ch)}
                    sx={{ textTransform: 'none', fontWeight: 600 }}
                  >
                    View Chamber Lots
                  </Button>
                  <Tooltip title="Log temperature check">
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => {
                        setTempForm({ ...tempForm, chamberId: ch.id });
                        setTempLogOpen(true);
                      }}
                    >
                      <DeviceThermostatIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Atmospheric Logs & Audit Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Recent Temperature & Humidity Audit Logs
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead sx={{ bgcolor: 'grey.50' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Date & Time</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Facility & Chamber</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Temperature</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Humidity</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Recorded By</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Remarks</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tempLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                      No temperature logs recorded yet. Use 'Log Temp Reading' to record atmospheric surveillance.
                    </TableCell>
                  </TableRow>
                ) : (
                  tempLogs.slice(0, 8).map((log) => (
                    <TableRow key={log.id} hover>
                      <TableCell>{log.log_date} {log.log_time}</TableCell>
                      <TableCell>{log.chamber_name}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{log.temperature}°C</TableCell>
                      <TableCell>{log.humidity}%</TableCell>
                      <TableCell>
                        <Chip
                          label={log.status}
                          size="small"
                          color={log.status === 'CRITICAL' ? 'error' : log.status === 'WARNING' ? 'warning' : 'success'}
                          sx={{ fontSize: '11px', fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell>{log.recorded_by}</TableCell>
                      <TableCell>{log.remarks || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* INWARD (CSI) MODAL */}
      <Dialog open={inwardOpen} onClose={() => setInwardOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle component="div" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Cold Storage Inward (CSI)</Typography>
          <IconButton size="small" onClick={() => setInwardOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                size="small"
                label="Target Chamber *"
                value={inwardForm.chamberId}
                onChange={(e) => setInwardForm({ ...inwardForm, chamberId: e.target.value })}
                helperText="Enforces capacity limit. Will reject if capacity exceeded."
              >
                {(stats?.chambers || []).map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.chamberName} (Available: {(c.availableKg / 1000).toFixed(1)} MT)
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Item Commodity *"
                value={inwardForm.itemName}
                onChange={(e) => setInwardForm({ ...inwardForm, itemName: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Inward Lot No *"
                placeholder="e.g. LOT-2026-CS01"
                value={inwardForm.inwardLotNo}
                onChange={(e) => setInwardForm({ ...inwardForm, inwardLotNo: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Weight (KG) *"
                type="number"
                placeholder="e.g. 5000"
                value={inwardForm.weightKg}
                onChange={(e) => setInwardForm({ ...inwardForm, weightKg: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Bags Count"
                type="number"
                value={inwardForm.qtyBags}
                onChange={(e) => setInwardForm({ ...inwardForm, qtyBags: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Supplier / Depositor"
                value={inwardForm.supplierName}
                onChange={(e) => setInwardForm({ ...inwardForm, supplierName: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                size="small"
                label="QC Status"
                value={inwardForm.qcStatus}
                onChange={(e) => setInwardForm({ ...inwardForm, qcStatus: e.target.value })}
              >
                <MenuItem value="PASSED">PASSED</MenuItem>
                <MenuItem value="CONDITIONAL">CONDITIONAL</MenuItem>
                <MenuItem value="HOLD">HOLD (Quarantine)</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Remarks"
                value={inwardForm.remarks}
                onChange={(e) => setInwardForm({ ...inwardForm, remarks: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setInwardOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleInwardSubmit} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Submit Inward (CSI)
          </Button>
        </DialogActions>
      </Dialog>

      {/* OUTWARD (CSO) MODAL */}
      <Dialog open={outwardOpen} onClose={() => setOutwardOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle component="div" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Cold Storage Outward (CSO)</Typography>
          <IconButton size="small" onClick={() => setOutwardOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                size="small"
                label="Source Chamber *"
                value={outwardForm.chamberId}
                onChange={(e) => setOutwardForm({ ...outwardForm, chamberId: e.target.value })}
              >
                {(stats?.chambers || []).map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.chamberName} (Stock: {(c.occupiedKg / 1000).toFixed(1)} MT)
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Lot No *"
                placeholder="e.g. LOT-2026-CS01"
                value={outwardForm.lotNo}
                onChange={(e) => setOutwardForm({ ...outwardForm, lotNo: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Dispatch Weight (KG) *"
                type="number"
                value={outwardForm.weightKg}
                onChange={(e) => setOutwardForm({ ...outwardForm, weightKg: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                size="small"
                label="Purpose"
                value={outwardForm.purpose}
                onChange={(e) => setOutwardForm({ ...outwardForm, purpose: e.target.value })}
              >
                <MenuItem value="Production Milling">Production Milling</MenuItem>
                <MenuItem value="Sales Dispatch">Sales Dispatch</MenuItem>
                <MenuItem value="Inter-Godown Transfer">Inter-Godown Transfer</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Destination Godown"
                value={outwardForm.destinationGodownName}
                onChange={(e) => setOutwardForm({ ...outwardForm, destinationGodownName: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOutwardOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" color="secondary" onClick={handleOutwardSubmit} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Dispatch Outward (CSO)
          </Button>
        </DialogActions>
      </Dialog>

      {/* TEMP LOG MODAL */}
      <Dialog open={tempLogOpen} onClose={() => setTempLogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle component="div" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Atmospheric Reading</Typography>
          <IconButton size="small" onClick={() => setTempLogOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                size="small"
                label="Chamber *"
                value={tempForm.chamberId}
                onChange={(e) => setTempForm({ ...tempForm, chamberId: e.target.value })}
              >
                {(stats?.chambers || []).map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.chamberName}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Temperature (°C) *"
                type="number"
                value={tempForm.temperature}
                onChange={(e) => setTempForm({ ...tempForm, temperature: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Humidity (%) *"
                type="number"
                value={tempForm.humidity}
                onChange={(e) => setTempForm({ ...tempForm, humidity: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Recorded By"
                value={tempForm.recordedBy}
                onChange={(e) => setTempForm({ ...tempForm, recordedBy: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setTempLogOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleTempLogSubmit} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Save Reading
          </Button>
        </DialogActions>
      </Dialog>

      {/* CHAMBER INVENTORY DETAILS MODAL */}
      <Dialog open={inventoryOpen} onClose={() => setInventoryOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle component="div" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Inventory in {selectedChamber?.chamberName}
          </Typography>
          <IconButton size="small" onClick={() => setInventoryOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 2 }}>
          <TableContainer>
            <Table size="small">
              <TableHead sx={{ bgcolor: 'grey.50' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Lot No</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Item Commodity</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Supplier</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Inward Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Storage Age</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Current Stock</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>QC Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {chamberInventory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                      No active stock lots found in this chamber.
                    </TableCell>
                  </TableRow>
                ) : (
                  chamberInventory.map((lot) => (
                    <TableRow key={lot.lotNo} hover>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{lot.lotNo}</TableCell>
                      <TableCell>{lot.itemName}</TableCell>
                      <TableCell>{lot.supplierName}</TableCell>
                      <TableCell>{lot.inwardDate}</TableCell>
                      <TableCell>
                        <Chip
                          label={`${lot.daysInStorage} Days`}
                          size="small"
                          color={lot.isAging ? 'warning' : 'default'}
                          sx={{ fontWeight: 600, fontSize: '11px' }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        {lot.currentStockKg?.toLocaleString()} {lot.unit}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={lot.qcStatus}
                          size="small"
                          color={lot.qcStatus === 'PASSED' ? 'success' : 'error'}
                          sx={{ fontWeight: 700, fontSize: '11px' }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<QrCode2Icon />}
                          onClick={() => {
                            setInventoryOpen(false);
                            navigate(`/barcode-qr?code=LOT-${encodeURIComponent(lot.lotNo)}`);
                          }}
                          sx={{ textTransform: 'none' }}
                        >
                          Scan 360°
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setInventoryOpen(false)} sx={{ textTransform: 'none' }}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
