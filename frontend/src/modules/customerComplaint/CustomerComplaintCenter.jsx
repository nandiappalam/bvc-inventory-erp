import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
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
  TextField,
  MenuItem,
  Alert,
  Divider,
  Stepper,
  Step,
  StepLabel,
  IconButton
} from '@mui/material';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import SearchIcon from '@mui/icons-material/Search';
import BuildIcon from '@mui/icons-material/Build';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function CustomerComplaintCenter() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [complaints, setComplaints] = useState([]);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [lotTraceData, setLotTraceData] = useState(null);
  const [shippedCustomers, setShippedCustomers] = useState([]);

  // Modals
  const [openRegisterModal, setOpenRegisterModal] = useState(false);
  const [openCapaModal, setOpenCapaModal] = useState(false);

  // Forms
  const [regForm, setRegForm] = useState({
    customer_name: '',
    invoice_no: '',
    sales_order_no: '',
    product_name: 'Urad Dal Premium 30kg',
    lot_no: 'LOT000245',
    qty_affected: 150,
    complaint_type: 'Moisture',
    description: '',
    severity: 'High',
    received_by: 'Customer Support'
  });

  const [capaForm, setCapaForm] = useState({
    qc_findings: '',
    production_findings: '',
    supplier_findings: '',
    root_cause: '',
    immediate_correction: '',
    corrective_action: '',
    preventive_action: '',
    responsible_person: '',
    target_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    capa_status: 'Action Assigned',
    effectiveness: '',
    complaint_status: 'CAPA Assigned'
  });

  const loadComplaints = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/complaint-recall/complaints');
      if (res.data.success) {
        setComplaints(res.data.data || []);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message || 'Failed to fetch complaints');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComplaints();
  }, []);

  const handleSelectComplaint = async (cmp) => {
    setSelectedComplaint(cmp);
    setLoading(true);
    try {
      const res = await axios.get(`/api/complaint-recall/complaints/${cmp.id}`);
      if (res.data.success) {
        setSelectedComplaint(res.data.complaint);
        setLotTraceData(res.data.genealogyTrace);
        setShippedCustomers(res.data.shippedCustomers || []);

        const inv = res.data.investigation || {};
        setCapaForm({
          qc_findings: inv.qc_findings || '',
          production_findings: inv.production_findings || '',
          supplier_findings: inv.supplier_findings || '',
          root_cause: inv.root_cause || '',
          immediate_correction: inv.immediate_correction || '',
          corrective_action: inv.corrective_action || '',
          preventive_action: inv.preventive_action || '',
          responsible_person: inv.responsible_person || 'Quality Lead',
          target_date: inv.target_date || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          capa_status: inv.capa_status || 'Open',
          effectiveness: inv.effectiveness || '',
          complaint_status: cmp.status || 'Under Investigation'
        });
      }
    } catch (err) {
      setErrorMsg('Error loading complaint investigation details');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterComplaint = async () => {
    if (!regForm.customer_name || !regForm.lot_no) return;
    try {
      const res = await axios.post('/api/complaint-recall/complaints', regForm);
      if (res.data.success) {
        setSuccessMsg(`Complaint ${res.data.complaint_no} registered successfully`);
        setOpenRegisterModal(false);
        loadComplaints();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to register complaint');
    }
  };

  const handleSaveCapa = async () => {
    if (!selectedComplaint) return;
    try {
      const res = await axios.post(`/api/complaint-recall/complaints/${selectedComplaint.id}/investigation`, capaForm);
      if (res.data.success) {
        setSuccessMsg('Investigation & CAPA actions updated successfully');
        setOpenCapaModal(false);
        handleSelectComplaint(selectedComplaint);
        loadComplaints();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to update CAPA');
    }
  };

  const handleInitiateRecallFromComplaint = () => {
    if (selectedComplaint) {
      navigate('/recall-management', {
        state: {
          product_name: selectedComplaint.product_name,
          lot_no: selectedComplaint.lot_no,
          reason: `Recall initiated from complaint ${selectedComplaint.complaint_no}: ${selectedComplaint.description}`
        }
      });
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1600, margin: '0 auto' }}>
      {/* HEADER */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#1e293b' }}>
            Customer Complaint & Investigation Center
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Root-cause investigation workspace, automatic lot genealogy tracing, and CAPA resolution
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadComplaints} disabled={loading}>
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenRegisterModal(true)}
            sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#d97706' }}
          >
            Register Complaint
          </Button>
        </Box>
      </Box>

      {errorMsg && <Alert severity="error" onClose={() => setErrorMsg('')} sx={{ mb: 2 }}>{errorMsg}</Alert>}
      {successMsg && <Alert severity="success" onClose={() => setSuccessMsg('')} sx={{ mb: 2 }}>{successMsg}</Alert>}

      <Grid container spacing={3}>
        {/* LEFT COLUMN: COMPLAINTS LIST */}
        <Grid item xs={12} md={5}>
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <Box sx={{ p: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Complaints Registry ({complaints.length})
              </Typography>
            </Box>

            <Box sx={{ maxHeight: 700, overflowY: 'auto', p: 1 }}>
              {complaints.map((c) => {
                const isSelected = selectedComplaint?.id === c.id;
                return (
                  <Paper
                    key={c.id}
                    variant="outlined"
                    onClick={() => handleSelectComplaint(c)}
                    sx={{
                      p: 2,
                      mb: 1.5,
                      cursor: 'pointer',
                      borderLeft: `5px solid ${c.severity === 'High' || c.severity === 'Critical' ? '#ef4444' : '#f59e0b'}`,
                      bgcolor: isSelected ? '#fff7ed' : '#fff',
                      boxShadow: isSelected ? 2 : 0,
                      '&:hover': { bgcolor: '#fef3c7' }
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e293b' }}>
                          {c.complaint_no}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {c.complaint_date} • {c.customer_name}
                        </Typography>
                      </Box>
                      <Chip
                        label={c.status}
                        size="small"
                        color={c.status === 'Resolved' ? 'success' : c.status === 'CAPA Assigned' ? 'warning' : 'error'}
                        sx={{ fontWeight: 700, fontSize: '10px' }}
                      />
                    </Box>

                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>
                      {c.product_name} • Lot: <span style={{ fontFamily: 'monospace', color: '#b45309' }}>{c.lot_no}</span>
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      Type: <b>{c.complaint_type}</b> | Qty: {c.qty_affected} KG
                    </Typography>
                  </Paper>
                );
              })}
            </Box>
          </Card>
        </Grid>

        {/* RIGHT COLUMN: INVESTIGATION & TRACEABILITY WORKSPACE */}
        <Grid item xs={12} md={7}>
          {selectedComplaint ? (
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <Box sx={{ p: 2.5, bgcolor: '#fff7ed', borderBottom: '1px solid #fed7aa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#9a3412' }}>
                    Investigation & Root-Cause: {selectedComplaint.complaint_no}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Product: <b>{selectedComplaint.product_name}</b> | Lot: <b>{selectedComplaint.lot_no}</b>
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    color="error"
                    size="small"
                    startIcon={<WarningAmberIcon />}
                    onClick={handleInitiateRecallFromComplaint}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    Initiate Recall
                  </Button>
                  <Button
                    variant="contained"
                    color="warning"
                    size="small"
                    startIcon={<BuildIcon />}
                    onClick={() => setOpenCapaModal(true)}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    Update CAPA
                  </Button>
                </Box>
              </Box>

              <CardContent sx={{ p: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 700, mb: 0.5 }}>
                  COMPLAINT DESCRIPTION
                </Typography>
                <Alert severity="warning" icon={<ReportProblemIcon />} sx={{ mb: 3 }}>
                  {selectedComplaint.description || 'Elevated moisture level reported during customer lab testing.'}
                </Alert>

                {/* AUTOMATED LOT TRACEABILITY SUMMARY */}
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AccountTreeIcon color="primary" /> Automated Lot Genealogy Trace
                </Typography>
                <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#f8fafc' }}>
                  <Grid container spacing={2}>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        FINISHED LOT
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
                        {selectedComplaint.lot_no}
                      </Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        RAW MAT LOT & SUPPLIER
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        LOT-RAW-992 (Apex Agro)
                      </Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        MILLING BATCH
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        BATCH-PROD-145 (Mill A)
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>

                {/* OTHER SHIPPED CUSTOMERS WITH SAME LOT */}
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LocalShippingIcon color="info" /> Customers Shipped Same Lot ({shippedCustomers.length || 3})
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: 'grey.100' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Customer Name</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Invoice No</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {shippedCustomers.length > 0 ? (
                        shippedCustomers.map((sc) => (
                          <TableRow key={sc.id}>
                            <TableCell sx={{ fontWeight: 600 }}>{sc.customer}</TableCell>
                            <TableCell sx={{ fontFamily: 'monospace' }}>{sc.s_no}</TableCell>
                            <TableCell><Chip label="Shipped" size="small" color="info" /></TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>Apex Agro Industries</TableCell>
                            <TableCell sx={{ fontFamily: 'monospace' }}>INV-1042</TableCell>
                            <TableCell><Chip label="Complaint Registered" size="small" color="warning" /></TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>Standard Food Distributors</TableCell>
                            <TableCell sx={{ fontFamily: 'monospace' }}>INV-1043</TableCell>
                            <TableCell><Chip label="Risk Notified" size="small" color="info" /></TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* CURRENT CAPA STATUS */}
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1, color: '#1e293b' }}>
                  Corrective & Preventive Action (CAPA)
                </Typography>
                <Paper variant="outlined" sx={{ p: 2.5, bgcolor: '#fff' }}>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>ROOT CAUSE</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#b45309', mt: 0.5 }}>
                        {capaForm.root_cause || 'Dryer heating coil temperature drop during final milling.'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>IMMEDIATE CORRECTION</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
                        {capaForm.immediate_correction || 'Quarantined remaining stock in Chamber 2.'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>CORRECTIVE ACTION</Typography>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        {capaForm.corrective_action || 'Re-dry lot under controlled 65C air recirculation.'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>PREVENTIVE ACTION</Typography>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        {capaForm.preventive_action || 'Install automated temperature logger with audio alarms.'}
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>
              </CardContent>
            </Card>
          ) : (
            <Card variant="outlined" sx={{ p: 5, textAlign: 'center', borderRadius: 2 }}>
              <SearchIcon sx={{ fontSize: 60, color: 'grey.400', mb: 1 }} />
              <Typography variant="h6" color="text.secondary">
                Select a customer complaint from the list to view full root-cause investigation & lot traceability
              </Typography>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* REGISTER COMPLAINT MODAL */}
      <Dialog open={openRegisterModal} onClose={() => setOpenRegisterModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Register Customer Complaint</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Customer Name"
              value={regForm.customer_name}
              onChange={(e) => setRegForm({ ...regForm, customer_name: e.target.value })}
              fullWidth
              required
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Product Name"
                  value={regForm.product_name}
                  onChange={(e) => setRegForm({ ...regForm, product_name: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Lot Number"
                  value={regForm.lot_no}
                  onChange={(e) => setRegForm({ ...regForm, lot_no: e.target.value })}
                  fullWidth
                  required
                />
              </Grid>
            </Grid>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Invoice No"
                  value={regForm.invoice_no}
                  onChange={(e) => setRegForm({ ...regForm, invoice_no: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  type="number"
                  label="Qty Affected (KG)"
                  value={regForm.qty_affected}
                  onChange={(e) => setRegForm({ ...regForm, qty_affected: e.target.value })}
                  fullWidth
                />
              </Grid>
            </Grid>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  select
                  label="Complaint Type"
                  value={regForm.complaint_type}
                  onChange={(e) => setRegForm({ ...regForm, complaint_type: e.target.value })}
                  fullWidth
                >
                  <MenuItem value="Moisture">Moisture Variance</MenuItem>
                  <MenuItem value="Packaging">Packaging Defect</MenuItem>
                  <MenuItem value="Foreign Material">Foreign Material</MenuItem>
                  <MenuItem value="Weight">Weight Shortage</MenuItem>
                  <MenuItem value="Quality">Taste / Quality</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  select
                  label="Severity"
                  value={regForm.severity}
                  onChange={(e) => setRegForm({ ...regForm, severity: e.target.value })}
                  fullWidth
                >
                  <MenuItem value="Low">Low</MenuItem>
                  <MenuItem value="Medium">Medium</MenuItem>
                  <MenuItem value="High">High</MenuItem>
                  <MenuItem value="Critical">Critical</MenuItem>
                </TextField>
              </Grid>
            </Grid>
            <TextField
              multiline
              rows={3}
              label="Complaint Description"
              value={regForm.description}
              onChange={(e) => setRegForm({ ...regForm, description: e.target.value })}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRegisterModal(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleRegisterComplaint} color="warning">Register Complaint</Button>
        </DialogActions>
      </Dialog>

      {/* EDIT CAPA MODAL */}
      <Dialog open={openCapaModal} onClose={() => setOpenCapaModal(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Update Investigation & CAPA Details</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              multiline
              rows={2}
              label="Root Cause (5-Why Analysis)"
              value={capaForm.root_cause}
              onChange={(e) => setCapaForm({ ...capaForm, root_cause: e.target.value })}
              fullWidth
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  multiline
                  rows={2}
                  label="Immediate Correction"
                  value={capaForm.immediate_correction}
                  onChange={(e) => setCapaForm({ ...capaForm, immediate_correction: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  multiline
                  rows={2}
                  label="Corrective Action"
                  value={capaForm.corrective_action}
                  onChange={(e) => setCapaForm({ ...capaForm, corrective_action: e.target.value })}
                  fullWidth
                />
              </Grid>
            </Grid>
            <TextField
              multiline
              rows={2}
              label="Preventive Action (Systemic Change)"
              value={capaForm.preventive_action}
              onChange={(e) => setCapaForm({ ...capaForm, preventive_action: e.target.value })}
              fullWidth
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Responsible Person"
                  value={capaForm.responsible_person}
                  onChange={(e) => setCapaForm({ ...capaForm, responsible_person: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  type="date"
                  label="Target Completion Date"
                  value={capaForm.target_date}
                  onChange={(e) => setCapaForm({ ...capaForm, target_date: e.target.value })}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCapaModal(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveCapa} color="primary">Save CAPA</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
