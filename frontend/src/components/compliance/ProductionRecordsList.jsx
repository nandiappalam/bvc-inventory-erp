import React, { useState, useEffect } from 'react';
import {
  Box,
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
  IconButton,
  TextField,
  MenuItem,
  CircularProgress,
  Tooltip,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import CloseIcon from '@mui/icons-material/Close';

const PROD_RECORDS = [
  { code: 'ALL', label: 'All Production Records (P1–P8)', freq: '' },
  { code: 'P1', label: 'P1: Income Quality Report', freq: 'RM Receiving', color: 'primary' },
  { code: 'P2', label: 'P2: Fumigation Records', freq: 'Loading', color: 'warning' },
  { code: 'P3', label: 'P3: In Process Checklist', freq: 'Daily / Per Batch', color: 'info' },
  { code: 'P4', label: 'P4: CCP Monitoring Records', freq: 'Daily / 2-Hourly', color: 'error' },
  { code: 'P5', label: 'P5: Product Changeover Record', freq: 'Per Changeover', color: 'secondary' },
  { code: 'P6', label: 'P6: Certificate of Analysis (COA)', freq: 'Loading / Release', color: 'success' },
  { code: 'P7', label: 'P7: Terminal Inspection Record', freq: 'Loading', color: 'warning' },
  { code: 'P8', label: 'P8: Traceability Engine', freq: 'Full Lifecycle Trace', color: 'primary' },
];

export default function ProductionRecordsList({ onRefresh }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCode, setSelectedCode] = useState('ALL');
  const [lotSearch, setLotSearch] = useState('');

  // New Record Dialog
  const [openNewDialog, setOpenNewDialog] = useState(false);
  const [formData, setFormData] = useState({
    record_code: 'P1',
    record_no: `P1-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    record_date: new Date().toISOString().split('T')[0],
    frequency: 'RM Receiving',
    item_name: 'Urad Gotta',
    lot_no: 'LOT0003',
    supplier_name: '',
    customer_name: '',
    vehicle_no: '',
    checked_by: 'QA Officer',
    status: 'COMPLETED',
    remarks: 'Complies with quality specifications.',
    findings: { moisture: '11.2%', foreign_matter: '0.3%', decision: 'PASSED' }
  });

  // View Record Dialog
  const [viewingRecord, setViewingRecord] = useState(null);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      let url = '/api/compliance/production-records';
      const params = [];
      if (selectedCode !== 'ALL') params.push(`record_code=${selectedCode}`);
      if (lotSearch) params.push(`lot_no=${encodeURIComponent(lotSearch)}`);
      if (params.length > 0) url += `?${params.join('&')}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setRecords(data.records || []);
      }
    } catch (err) {
      console.error('Error fetching production records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [selectedCode, lotSearch]);

  const handleOpenCreate = (code = 'P1') => {
    const selectedMeta = PROD_RECORDS.find(p => p.code === code) || PROD_RECORDS[1];
    setFormData({
      record_code: code,
      record_no: `${code}-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      record_date: new Date().toISOString().split('T')[0],
      frequency: selectedMeta.freq || 'Daily',
      item_name: 'Urad Dal',
      lot_no: 'LOT0014',
      supplier_name: 'Sri Amman Traders',
      customer_name: '',
      vehicle_no: 'TN-58-AX-9912',
      checked_by: 'QA Officer',
      status: 'COMPLETED',
      remarks: `Operational compliance logged under ${code}.`,
      findings: { result: 'Passed', parameters_checked: '100% Ok' }
    });
    setOpenNewDialog(true);
  };

  const handleSaveRecord = async () => {
    try {
      const res = await fetch('/api/compliance/production-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        setOpenNewDialog(false);
        fetchRecords();
        if (onRefresh) onRefresh();
      } else {
        alert(data.message || 'Failed to save production record');
      }
    } catch (err) {
      console.error('Error saving record:', err);
    }
  };

  return (
    <Box>
      {/* Filter Categories */}
      <Box sx={{ mb: 2.5, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {PROD_RECORDS.map((rec) => {
          const isSelected = selectedCode === rec.code;
          return (
            <Chip
              key={rec.code}
              label={rec.label}
              onClick={() => setSelectedCode(rec.code)}
              color={isSelected ? 'primary' : 'default'}
              variant={isSelected ? 'filled' : 'outlined'}
              sx={{
                fontWeight: isSelected ? 'bold' : 'normal',
                cursor: 'pointer',
              }}
            />
          );
        })}
      </Box>

      {/* Action Bar */}
      <Card sx={{ mb: 3, p: 2, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={6}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search by Lot Number, Item, or Supplier/Customer..."
              value={lotSearch}
              onChange={(e) => setLotSearch(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={6} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => handleOpenCreate(selectedCode === 'ALL' ? 'P1' : selectedCode)}
              sx={{ fontWeight: 'bold' }}
            >
              Log New {selectedCode === 'ALL' ? 'Production Record' : selectedCode}
            </Button>
          </Grid>
        </Grid>
      </Card>

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
          <CircularProgress />
        </Box>
      ) : records.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center', backgroundColor: '#fdfdfd', border: '1px dashed #cbd5e1' }}>
          <PrecisionManufacturingIcon sx={{ fontSize: 48, color: '#94a3b8', mb: 1 }} />
          <Typography variant="h6" color="text.secondary">
            No Production Records found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Record operational data such as Inward QA (P1), Fumigation (P2), In-Process (P3), or CCPs (P4).
          </Typography>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => handleOpenCreate(selectedCode === 'ALL' ? 'P1' : selectedCode)}>
            Create First Record
          </Button>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={{ border: '1px solid #e2e8f0', boxShadow: 'none' }}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: '#f1f5f9' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', width: 70 }}>Code</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Record No</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Frequency</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Item & Lot No</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Party / Vehicle</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Checked By</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Findings Summary</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 90 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: 80 }}>View</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    <Chip size="small" label={r.record_code} color="primary" sx={{ fontWeight: 'bold' }} />
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#1f4fb2' }}>
                    {r.record_no}
                  </TableCell>
                  <TableCell>{r.record_date}</TableCell>
                  <TableCell>
                    <Chip size="small" label={r.frequency || 'Daily'} variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{r.item_name || '—'}</Typography>
                    {r.lot_no && (
                      <Chip size="small" label={r.lot_no} sx={{ fontSize: '11px', height: 20, bgcolor: '#e0f2fe', color: '#0369a1' }} />
                    )}
                  </TableCell>
                  <TableCell>
                    {r.supplier_name || r.customer_name || r.vehicle_no || 'Plant Internal'}
                  </TableCell>
                  <TableCell>{r.checked_by || 'QA Officer'}</TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ display: 'block', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {typeof r.findings === 'object' ? JSON.stringify(r.findings) : r.findings}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={r.status} color="success" />
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center' }}>
                    <IconButton size="small" color="primary" onClick={() => setViewingRecord(r)}>
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create Dialog */}
      <Dialog open={openNewDialog} onClose={() => setOpenNewDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle component="div" sx={{ bgcolor: '#1f4fb2', color: 'white' }}>
          Log Production Record ({formData.record_code})
        </DialogTitle>
        <DialogContent sx={{ p: 3, pt: 2, bgcolor: '#fafbfc' }}>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={6}>
              <TextField
                size="small"
                fullWidth
                label="Record No"
                value={formData.record_no}
                onChange={(e) => setFormData({ ...formData, record_no: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                size="small"
                type="date"
                fullWidth
                label="Record Date"
                value={formData.record_date}
                onChange={(e) => setFormData({ ...formData, record_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                size="small"
                fullWidth
                label="Item Name"
                value={formData.item_name}
                onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                size="small"
                fullWidth
                label="Lot No"
                value={formData.lot_no}
                onChange={(e) => setFormData({ ...formData, lot_no: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                size="small"
                fullWidth
                label="Supplier / Customer"
                value={formData.supplier_name}
                onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                size="small"
                fullWidth
                label="Vehicle No (if applicable)"
                value={formData.vehicle_no}
                onChange={(e) => setFormData({ ...formData, vehicle_no: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                size="small"
                fullWidth
                label="Observations & Remarks"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: '#f1f5f9' }}>
          <Button onClick={() => setOpenNewDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveRecord} variant="contained" color="primary">Save Record</Button>
        </DialogActions>
      </Dialog>

      {/* Detail Dialog */}
      {viewingRecord && (
        <Dialog open={Boolean(viewingRecord)} onClose={() => setViewingRecord(null)} maxWidth="sm" fullWidth>
          <DialogTitle component="div" sx={{ bgcolor: '#1f4fb2', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
              {viewingRecord.record_code}: {viewingRecord.record_no}
            </Typography>
            <IconButton size="small" onClick={() => setViewingRecord(null)} sx={{ color: 'white' }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 3 }}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary">RECORD DATE & FREQUENCY</Typography>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{viewingRecord.record_date} ({viewingRecord.frequency})</Typography>
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary">ITEM & LOT NO</Typography>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{viewingRecord.item_name} — Lot: {viewingRecord.lot_no || 'N/A'}</Typography>
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary">FINDINGS</Typography>
              <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#f8fafc', fontFamily: 'monospace', fontSize: '12px' }}>
                {JSON.stringify(viewingRecord.findings, null, 2)}
              </Paper>
            </Box>
            {viewingRecord.remarks && (
              <Box>
                <Typography variant="caption" color="text.secondary">REMARKS</Typography>
                <Typography variant="body2">{viewingRecord.remarks}</Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2, bgcolor: '#f1f5f9' }}>
            <Button onClick={() => setViewingRecord(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
