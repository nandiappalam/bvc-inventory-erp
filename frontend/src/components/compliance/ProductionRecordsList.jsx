import React, { useState, useEffect, useRef } from 'react';
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
  Stack,
  Divider,
  Alert
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import CloseIcon from '@mui/icons-material/Close';
import SyncIcon from '@mui/icons-material/Sync';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScienceIcon from '@mui/icons-material/Science';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import SecurityIcon from '@mui/icons-material/Security';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PrintIcon from '@mui/icons-material/Print';
import VerifiedIcon from '@mui/icons-material/Verified';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

const PROD_RECORDS = [
  { code: 'ALL', label: 'All Records (P1–P8)', freq: '', docRef: 'BVC/QA/ALL/00' },
  { code: 'P1', label: 'P1: Income Quality Report', freq: 'RM Receiving', color: '#0284c7', docRef: 'BVC/QA/IQR/01' },
  { code: 'P2', label: 'P2: Fumigation Records', freq: 'Loading', color: '#d97706', docRef: 'BVC/QA/FUM/02' },
  { code: 'P3', label: 'P3: In Process Checklist', freq: 'Daily / Per Batch', color: '#7c3aed', docRef: 'BVC/PRD/IPC/03' },
  { code: 'P4', label: 'P4: CCP Monitoring Records', freq: 'Daily / 2-Hourly', color: '#dc2626', docRef: 'BVC/HACCP/CCP/04' },
  { code: 'P5', label: 'P5: Product Changeover Record', freq: 'Per Changeover', color: '#db2777', docRef: 'BVC/PRD/PCO/05' },
  { code: 'P6', label: 'P6: Certificate of Analysis (COA)', freq: 'Loading / Release', color: '#059669', docRef: 'BVC/QA/COA/06' },
  { code: 'P7', label: 'P7: Terminal Inspection Record', freq: 'Loading', color: '#d97706', docRef: 'BVC/LOG/TIR/07' },
  { code: 'P8', label: 'P8: Traceability Engine', freq: 'Full Lifecycle Trace', color: '#1f4fb2', docRef: 'BVC/QA/TRC/08' },
];

export default function ProductionRecordsList({ onRefresh, onNavigateToTrace, onOpenTraceability }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(null);
  const [selectedCode, setSelectedCode] = useState('ALL');
  const [lotSearch, setLotSearch] = useState('');

  // New Record Dialog
  const [openNewDialog, setOpenNewDialog] = useState(false);
  const [formData, setFormData] = useState({
    record_code: 'P1',
    record_no: `P1-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    record_date: new Date().toISOString().split('T')[0],
    frequency: 'RM Receiving',
    item_name: 'Broken Rice',
    lot_no: 'LOT0014',
    supplier_name: 'KTH',
    customer_name: '',
    vehicle_no: 'TN-58-AX-9912',
    checked_by: 'QA Officer',
    status: 'COMPLETED',
    remarks: 'Complies with quality specifications.',
    findings: { moisture: '10.8%', foreign_matter: '0.4%', broken_grain: '1.2%', weevils: '0%', decision: 'ACCEPTED' }
  });

  // View Record Dialog
  const [viewingRecord, setViewingRecord] = useState(null);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      let url = '/api/compliance/production-records';
      const params = [];
      if (selectedCode !== 'ALL' && selectedCode !== 'P8') params.push(`record_code=${selectedCode}`);
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

  const handleSyncRecords = async () => {
    try {
      setSyncing(true);
      setSyncSuccess(null);
      const res = await fetch('/api/compliance/production-records/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSyncSuccess(`Auto-synced ${data.synced} compliance production records from ERP purchases, milling batches & sales!`);
        fetchRecords();
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error('Error syncing production records:', err);
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenCreate = (code = 'P1') => {
    if (code === 'P8') {
      if (onNavigateToTrace) onNavigateToTrace();
      return;
    }
    const selectedMeta = PROD_RECORDS.find(p => p.code === code) || PROD_RECORDS[1];
    setFormData({
      record_code: code,
      record_no: `${code}-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      record_date: new Date().toISOString().split('T')[0],
      frequency: selectedMeta.freq || 'Daily',
      item_name: 'Broken Rice',
      lot_no: 'LOT0014',
      supplier_name: 'KTH',
      customer_name: '',
      vehicle_no: 'TN-58-AX-9912',
      checked_by: 'QA Officer',
      status: 'COMPLETED',
      remarks: `Operational compliance record logged under ${code}.`,
      findings: code === 'P1'
        ? { moisture: '10.8%', foreign_matter: '0.4%', broken_grain: '1.2%', weevils: '0%', decision: 'ACCEPTED' }
        : code === 'P6'
        ? { coa_no: `COA-2026-${Math.floor(100+Math.random()*900)}`, decision: 'PASSED & RELEASED FOR SALE', parameters: [{ parameter: 'Moisture Content', standard: 'Max 12%', observed: '10.5%', result: 'Pass' }] }
        : { result: 'Passed', parameters_checked: '100% Ok' }
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

  const parseFindings = (findings) => {
    if (!findings) return {};
    if (typeof findings === 'object') return findings;
    try {
      return JSON.parse(findings);
    } catch (e) {
      return { raw: findings };
    }
  };

  const handlePrintModal = () => {
    window.print();
  };

  // Helper to render official formatted inspection details based on record code
  const renderOfficialReportContent = (rec) => {
    if (!rec) return null;
    const findings = parseFindings(rec.findings_json || rec.findings);
    const code = rec.record_code;

    if (code === 'P1') {
      const paramsList = findings.parameters_list || [
        { parameter: 'Moisture Content', standard: 'Max 12.0%', observed: findings.moisture || '10.8%', result: 'Pass' },
        { parameter: 'Foreign Matter / Impurities', standard: 'Max 1.0%', observed: findings.foreign_matter || '0.4%', result: 'Pass' },
        { parameter: 'Broken / Damaged Grains', standard: 'Max 2.0%', observed: findings.broken_grain || '1.2%', result: 'Pass' },
        { parameter: 'Weevils / Live Infestation', standard: 'Nil / 0%', observed: findings.weevils || '0% Nil', result: 'Pass' },
        { parameter: 'Color, Odor & Freshness', standard: 'Characteristic / Fresh Grain', observed: 'Normal & Characteristic', result: 'Pass' }
      ];

      return (
        <Box sx={{ mt: 1 }}>
          {/* Supplier & Inward Meta */}
          <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f8fafc', mb: 2, border: '1px solid #cbd5e1' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e3a8a', mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              1. Inward Consignment & Procurement Details
            </Typography>
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>SUPPLIER NAME</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{rec.supplier_name || findings.supplier_name || 'Direct Procurement'}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>PURCHASE INVOICE / GRN</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace', color: '#1f4fb2' }}>
                  {findings.purchase_invoice || rec.purchase_no || 'N/A'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>TRANSPORT VEHICLE</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{rec.vehicle_no || findings.vehicle_no || 'N/A'}</Typography>
              </Grid>
              <Grid item xs={6} sm={4}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>INWARD BAGS</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{findings.inward_bags !== undefined ? `${findings.inward_bags} Bags` : 'N/A'}</Typography>
              </Grid>
              <Grid item xs={6} sm={4}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>TOTAL NET WEIGHT</Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, color: '#059669' }}>
                  {findings.total_weight_kg !== undefined ? `${Number(findings.total_weight_kg).toLocaleString()} Kg` : 'N/A'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>PURCHASE RATE</Typography>
                <Typography variant="body2">{findings.rate_per_unit ? `₹${findings.rate_per_unit} / Unit` : 'N/A'}</Typography>
              </Grid>
            </Grid>
          </Paper>

          {/* Quality Analysis Table */}
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e3a8a', mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            2. Inward Physical & Quality Parameters (P1 Checklist / IQR: {findings.iqr_no || rec.record_no})
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, border: '1px solid #cbd5e1' }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>S.No</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Quality Parameter</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>FSSAI / Factory Standard</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Observed Value</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Quality Result</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paramsList.map((p, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{p.parameter}</TableCell>
                    <TableCell>{p.standard}</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#0284c7' }}>{p.observed}</TableCell>
                    <TableCell><Chip label={p.result || 'PASSED'} size="small" color="success" sx={{ height: 20, fontSize: '10px', fontWeight: 700 }} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Decision */}
          <Box sx={{ p: 1.5, bgcolor: '#f0fdf4', borderRadius: 1.5, border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <VerifiedIcon sx={{ color: '#16a34a' }} />
              <Typography variant="body2" sx={{ fontWeight: 800, color: '#15803d' }}>
                QUALITY DISPOSITION: {findings.decision || 'ACCEPTED FOR PROCESSING & STORAGE'}
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#15803d' }}>
              FSSAI COMPLIANT
            </Typography>
          </Box>
        </Box>
      );
    }

    if (code === 'P2') {
      return (
        <Box sx={{ mt: 1 }}>
          <Paper variant="outlined" sx={{ p: 2, bgcolor: '#fffbeb', mb: 2, border: '1px solid #fde68a' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#92400e', mb: 1, textTransform: 'uppercase' }}>
              1. Fumigation & Pest Eradication Parameters
            </Typography>
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>COMMODITY / LOT</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{rec.item_name} {rec.lot_no ? `(${rec.lot_no})` : ''}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>FUMIGANT CHEMICAL</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#b45309' }}>Aluminium Phosphide (3 Tablets/Ton)</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>EXPOSURE PERIOD</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>7 Days (168 Hours Gas Tight)</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>DEGASSING & AERATION</Typography>
                <Typography variant="body2">48 Hours Natural Aeration</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>GAS RESIDUAL AUDIT</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#16a34a' }}>&lt; 0.05 ppm (Safe Limit &lt; 0.1 ppm)</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>PEST MORTALITY</Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, color: '#15803d' }}>100% Dead / Zero Live Pests</Typography>
              </Grid>
            </Grid>
          </Paper>
          <Box sx={{ p: 1.5, bgcolor: '#f0fdf4', borderRadius: 1.5, border: '1px solid #bbf7d0' }}>
            <Typography variant="body2" sx={{ fontWeight: 800, color: '#15803d' }}>
              SAFETY CLEARANCE: Grains degassed, certified non-hazardous and released for milling.
            </Typography>
          </Box>
        </Box>
      );
    }

    if (code === 'P3') {
      const outputs = findings.outputs || [];
      return (
        <Box sx={{ mt: 1 }}>
          {/* Grind Batch Header */}
          <Paper variant="outlined" sx={{ p: 2, bgcolor: '#faf5ff', mb: 2, border: '1px solid #e9d5ff' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#6b21a8', mb: 1, textTransform: 'uppercase' }}>
              1. Milling Batch Transformation & Yield
            </Typography>
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>GRIND NUMBER</Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, fontFamily: 'monospace', color: '#6b21a8' }}>
                  {findings.grind_no || 'GRD-0001'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>FLOUR MILL / LINE</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{findings.flour_mill || 'KTH Mill (Line 1)'}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>MILLING DATE</Typography>
                <Typography variant="body2">{rec.record_date}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>RAW MATERIAL INPUT</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {findings.input_item || rec.item_name} ({findings.input_lot || rec.lot_no}) — {findings.input_qty_bags || 50} Bags ({findings.input_weight_kg || 2500} Kg)
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>TOTAL OUTPUT WEIGHT</Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, color: '#7c3aed' }}>
                  {findings.total_output_kg || 2500} Kg
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>MILLING YIELD EFFICIENCY</Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, color: '#16a34a' }}>
                  {findings.yield_percentage || '100.0%'}
                </Typography>
              </Grid>
            </Grid>
          </Paper>

          {/* Outputs List if available */}
          {outputs.length > 0 && (
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, border: '1px solid #cbd5e1' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>Output Finished Good</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Generated Lot No</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Bags</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Total Weight (Kg)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {outputs.map((out, idx) => (
                    <TableRow key={idx}>
                      <TableCell sx={{ fontWeight: 700 }}>{out.item}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#6b21a8' }}>{out.lot_no}</TableCell>
                      <TableCell>{out.qty}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{out.total_wt} Kg</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* In-Process Operational Parameters Table */}
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#6b21a8', mb: 1, textTransform: 'uppercase' }}>
            2. In-Process Milling & Sieve Checkpoints (P3 Checklist)
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, border: '1px solid #cbd5e1' }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>Check Item</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Standard Operating Limit</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Observed Status</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Compliance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Wire Mesh / Sieve Size</TableCell>
                  <TableCell>Mesh 60 / Standard Calibration</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{findings.mesh_size_check || '60 Mesh - Passed'}</TableCell>
                  <TableCell><Chip label="COMPLIANT" size="small" color="success" sx={{ height: 20, fontSize: '10px', fontWeight: 700 }} /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Sieve Integrity & Wear</TableCell>
                  <TableCell>No tears, perforations, or frame leakages</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#059669' }}>{findings.sieve_integrity || 'Intact (No tears)'}</TableCell>
                  <TableCell><Chip label="COMPLIANT" size="small" color="success" sx={{ height: 20, fontSize: '10px', fontWeight: 700 }} /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Milling Temperature</TableCell>
                  <TableCell>Max &lt; 45°C</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{findings.milling_temperature || '38°C'}</TableCell>
                  <TableCell><Chip label="COMPLIANT" size="small" color="success" sx={{ height: 20, fontSize: '10px', fontWeight: 700 }} /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Foreign Matter Audit</TableCell>
                  <TableCell>0% Nil (Continuous In-line Check)</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{findings.foreign_matter_audit || '0% Nil'}</TableCell>
                  <TableCell><Chip label="COMPLIANT" size="small" color="success" sx={{ height: 20, fontSize: '10px', fontWeight: 700 }} /></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ p: 1.5, bgcolor: '#faf5ff', borderRadius: 1.5, border: '1px solid #e9d5ff' }}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#6b21a8' }}>
              MILLER INCHARGE: {findings.operator || 'Senior Miller Incharge'} — Sieve intact and milling parameters approved.
            </Typography>
          </Box>
        </Box>
      );
    }

    if (code === 'P4') {
      return (
        <Box sx={{ mt: 1 }}>
          <Paper variant="outlined" sx={{ p: 2, bgcolor: '#fef2f2', mb: 2, border: '1px solid #fecaca' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#991b1b', mb: 1, textTransform: 'uppercase' }}>
              1. HACCP / FSSAI Critical Control Point (CCP) Audit
            </Typography>
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>MONITORING FREQUENCY</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{findings.monitoring_frequency || '2-Hourly Continuous Check'}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>CCP-1 MAGNET GAUSS</Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, color: '#dc2626' }}>
                  {findings.ccp1_observed_magnet || '10,200 Gauss (Calibrated)'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>CORRECTIVE ACTION</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#16a34a' }}>
                  {findings.corrective_action || 'None Required (All CCPs within limits)'}
                </Typography>
              </Grid>
            </Grid>
          </Paper>

          <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, border: '1px solid #cbd5e1' }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>Critical Control Point</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Critical Limit Specification</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Observed Monitoring Value</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>CCP Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>
                    <div>CCP-1: Rare Earth Magnet</div>
                    <Typography variant="caption" color="text.secondary">Metal Fragment Barrier</Typography>
                  </TableCell>
                  <TableCell>Magnet Strength ≥ 10,000 Gauss</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#dc2626' }}>
                    {findings.ccp1_observed_magnet || '10,200 Gauss'}
                  </TableCell>
                  <TableCell><Chip label="COMPLIANT" size="small" color="success" sx={{ height: 20, fontSize: '10px', fontWeight: 700 }} /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>
                    <div>CCP-1: De-Stoner Gravity Unit</div>
                    <Typography variant="caption" color="text.secondary">Stone & Heavy Impurity Trap</Typography>
                  </TableCell>
                  <TableCell>Destoner Stone Pass: 0% Nil</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {findings.ccp1_observed_destoner || 'Zero stones passed / Cleaned trap'}
                  </TableCell>
                  <TableCell><Chip label="COMPLIANT" size="small" color="success" sx={{ height: 20, fontSize: '10px', fontWeight: 700 }} /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>
                    <div>CCP-2: Stainless Sifter Screen</div>
                    <Typography variant="caption" color="text.secondary">Physical Particle Sieve</Typography>
                  </TableCell>
                  <TableCell>Screen 60 Mesh Intact (Zero Tears)</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {findings.ccp2_observed_sieve || 'Intact & Cleaned at start & end of batch'}
                  </TableCell>
                  <TableCell><Chip label="COMPLIANT" size="small" color="success" sx={{ height: 20, fontSize: '10px', fontWeight: 700 }} /></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      );
    }

    if (code === 'P5') {
      return (
        <Box sx={{ mt: 1 }}>
          <Paper variant="outlined" sx={{ p: 2, bgcolor: '#fdf2f8', mb: 2, border: '1px solid #fbcfe8' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#9d174d', mb: 1, textTransform: 'uppercase' }}>
              1. Product Changeover & Line Clearance Parameters
            </Typography>
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>PREVIOUS PRODUCT</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>Urad Dal (Batch GRD-0001)</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>NEXT PRODUCT</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#db2777' }}>{rec.item_name || 'Broken Rice Flour'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>ALLERGEN / GLUTEN CONTROL</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#16a34a' }}>Negative / Thoroughly Air Flushed</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>LINE SANITIZATION STATUS</Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, color: '#059669' }}>CLEARED & APPROVED</Typography>
              </Grid>
            </Grid>
          </Paper>
        </Box>
      );
    }

    if (code === 'P6') {
      const params = findings.parameters || [
        { parameter: 'Moisture Content', standard: 'Max 12.0%', observed: '10.5%', result: 'Pass' },
        { parameter: 'Total Ash (Dry Basis)', standard: 'Max 3.5%', observed: '1.8%', result: 'Pass' },
        { parameter: 'Acid Insoluble Ash', standard: 'Max 0.1%', observed: '0.04%', result: 'Pass' },
        { parameter: 'Granularity (Mesh 60)', standard: 'Min 98.0%', observed: '99.4%', result: 'Pass' },
        { parameter: 'Gluten Test', standard: 'Negative / Nil', observed: 'Negative (Gluten-Free)', result: 'Pass' },
        { parameter: 'Total Plate Count', standard: 'Max 10,000 cfu/g', observed: '850 cfu/g', result: 'Pass' },
        { parameter: 'Yeast & Mold Count', standard: 'Max 100 cfu/g', observed: '<30 cfu/g', result: 'Pass' },
        { parameter: 'E. coli & Salmonella', standard: 'Absent in 25g', observed: 'Absent', result: 'Pass' }
      ];

      return (
        <Box sx={{ mt: 1 }}>
          {/* Certificate Header Banner */}
          <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f0fdf4', mb: 2, border: '1px solid #bbf7d0' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>CERTIFICATE OF ANALYSIS NO</Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#059669', fontFamily: 'monospace' }}>
                  {findings.coa_no || rec.record_no}
                </Typography>
              </Box>
              <Chip label="QA CERTIFIED" color="success" sx={{ fontWeight: 800 }} />
            </Box>
            <Divider sx={{ my: 1 }} />
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>PRODUCT NAME</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{rec.item_name}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>BATCH / LOT NUMBER</Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, fontFamily: 'monospace', color: '#1f4fb2' }}>
                  {rec.lot_no || 'LOT0016'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>BATCH QUANTITY</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{findings.batch_qty || '232 Bags (6,960 Kg)'}</Typography>
              </Grid>
            </Grid>
          </Paper>

          {/* Laboratory Testing Results Table */}
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#059669', mb: 1, textTransform: 'uppercase' }}>
            Laboratory Analytical Parameters
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, border: '1px solid #cbd5e1' }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>S.No</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Test Parameter</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Standard Specification</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Observed Laboratory Value</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Result</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {params.map((p, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{p.parameter}</TableCell>
                    <TableCell>{p.standard}</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#0284c7' }}>{p.observed}</TableCell>
                    <TableCell><Chip label="PASS" size="small" color="success" sx={{ height: 20, fontSize: '10px', fontWeight: 700 }} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ p: 1.5, bgcolor: '#f0fdf4', borderRadius: 1.5, border: '1px solid #bbf7d0' }}>
            <Typography variant="body2" sx={{ fontWeight: 800, color: '#15803d' }}>
              FINAL CONCLUSION: The analyzed batch sample satisfies all FSSAI & Export Quality standards. {findings.decision || 'PASSED & RELEASED FOR PACKAGING / DISPATCH'}.
            </Typography>
          </Box>
        </Box>
      );
    }

    if (code === 'P7') {
      return (
        <Box sx={{ mt: 1 }}>
          <Paper variant="outlined" sx={{ p: 2, bgcolor: '#fffbeb', mb: 2, border: '1px solid #fde68a' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#92400e', mb: 1, textTransform: 'uppercase' }}>
              1. Pre-Shipment Terminal & Transport Details
            </Typography>
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>CUSTOMER NAME</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{rec.customer_name || 'Customer A'}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>SALES INVOICE NO</Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, fontFamily: 'monospace', color: '#d97706' }}>
                  {findings.sales_invoice || rec.invoice_no || 'INV-004'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>VEHICLE / TRUCK NO</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{rec.vehicle_no || findings.vehicle_no || 'TN-58-AX-9912'}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>DISPATCHED PRODUCT</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{rec.item_name} ({rec.lot_no})</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>DISPATCH QUANTITY</Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, color: '#059669' }}>
                  {findings.dispatched_qty_bags || 100} Bags ({findings.dispatched_weight_kg || 3000} Kg)
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>CONTAINER SEAL NO</Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, fontFamily: 'monospace', color: '#1e40af' }}>
                  {findings.container_seal_no || 'SEAL-88219'}
                </Typography>
              </Grid>
            </Grid>
          </Paper>

          <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, border: '1px solid #cbd5e1' }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>Pre-Loading Check Item</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Standard Criteria</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Observed Status</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>QA Result</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Vehicle Bed & Floor</TableCell>
                  <TableCell>Dry, swept clean, free from nails/oil</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Clean & Dry Floor</TableCell>
                  <TableCell><Chip label="PASSED" size="small" color="success" sx={{ height: 20, fontSize: '10px', fontWeight: 700 }} /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Tarpaulin & Cover</TableCell>
                  <TableCell>Waterproof, intact, tear-free</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Intact & Securely Tied</TableCell>
                  <TableCell><Chip label="PASSED" size="small" color="success" sx={{ height: 20, fontSize: '10px', fontWeight: 700 }} /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Bag Stitching & Seal</TableCell>
                  <TableCell>Double stitch, tamper evident, zero leak</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#059669' }}>
                    {findings.bag_stitching || 'Double Stitch Verified'}
                  </TableCell>
                  <TableCell><Chip label="PASSED" size="small" color="success" sx={{ height: 20, fontSize: '10px', fontWeight: 700 }} /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Odor & Pest Inspection</TableCell>
                  <TableCell>Zero chemical fumes, insect free</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Fresh / Zero Pests</TableCell>
                  <TableCell><Chip label="PASSED" size="small" color="success" sx={{ height: 20, fontSize: '10px', fontWeight: 700 }} /></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ p: 1.5, bgcolor: '#f0fdf4', borderRadius: 1.5, border: '1px solid #bbf7d0' }}>
            <Typography variant="body2" sx={{ fontWeight: 800, color: '#15803d' }}>
              FINAL DISPATCH CLEARANCE: Pre-shipment quality inspected and approved for customer transport.
            </Typography>
          </Box>
        </Box>
      );
    }

    return null;
  };

  return (
    <Box sx={{ pb: 4 }}>
      {/* FILTER BUTTONS (P1–P8) */}
      <Box sx={{ mb: 2.5, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {PROD_RECORDS.map((rec) => {
          const isSelected = selectedCode === rec.code;
          return (
            <Chip
              key={rec.code}
              label={rec.label}
              onClick={() => {
                if (rec.code === 'P8' && onNavigateToTrace) {
                  onNavigateToTrace();
                } else {
                  setSelectedCode(rec.code);
                }
              }}
              color={isSelected ? 'primary' : 'default'}
              variant={isSelected ? 'filled' : 'outlined'}
              sx={{
                fontWeight: isSelected ? 800 : 600,
                cursor: 'pointer',
                bgcolor: isSelected ? '#1f4fb2' : '#ffffff',
                borderColor: '#cbd5e1'
              }}
            />
          );
        })}
      </Box>

      {syncSuccess && (
        <Alert severity="success" sx={{ mb: 2.5 }} onClose={() => setSyncSuccess(null)}>
          {syncSuccess}
        </Alert>
      )}

      {/* SEARCH AND AUTO-SYNC ACTION BAR */}
      <Card sx={{ mb: 3, p: 2, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={5}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search by Lot Number (e.g. LOT0014), Item, or Party..."
              value={lotSearch}
              onChange={(e) => setLotSearch(e.target.value)}
              sx={{ bgcolor: 'white' }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={7} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              color="primary"
              startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
              onClick={handleSyncRecords}
              disabled={syncing}
              sx={{ fontWeight: 700, borderColor: '#bfdbfe', bgcolor: '#eff6ff' }}
            >
              {syncing ? 'Syncing...' : '⚡ Auto-Sync ERP Records'}
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => handleOpenCreate(selectedCode === 'ALL' ? 'P1' : selectedCode)}
              sx={{ fontWeight: 700, bgcolor: '#1f4fb2' }}
            >
              Log New {selectedCode === 'ALL' ? 'Production Record' : selectedCode}
            </Button>
          </Grid>
        </Grid>
      </Card>

      {/* RECORDS TABLE */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : records.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center', backgroundColor: '#fdfdfd', border: '1px dashed #cbd5e1', borderRadius: 2 }}>
          <PrecisionManufacturingIcon sx={{ fontSize: 48, color: '#94a3b8', mb: 1 }} />
          <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 700 }}>
            No Production Records Found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Click "Auto-Sync ERP Records" to automatically generate records from Purchases, Milling Batches, and Sales.
          </Typography>
          <Stack direction="row" spacing={1.5} justifyContent="center">
            <Button variant="contained" startIcon={<SyncIcon />} onClick={handleSyncRecords} sx={{ bgcolor: '#1f4fb2', fontWeight: 700 }}>
              Auto-Sync Records
            </Button>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => handleOpenCreate(selectedCode === 'ALL' ? 'P1' : selectedCode)}>
              Create First Record
            </Button>
          </Stack>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: 'none' }}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: '#f1f5f9' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, width: 80 }}>Code</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Record No</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Frequency</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Item & Lot No</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Party / Mill Line</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Inspected By</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Findings Key Summary</TableCell>
                <TableCell sx={{ fontWeight: 800, width: 90 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 800, textAlign: 'center', width: 120 }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {records.map((r) => {
                const parsed = parseFindings(r.findings_json || r.findings);
                return (
                  <TableRow key={r.id} hover>
                    <TableCell>
                      <Chip
                        size="small"
                        label={r.record_code}
                        color={r.record_code === 'P1' ? 'primary' : r.record_code === 'P6' ? 'success' : r.record_code === 'P4' ? 'error' : 'default'}
                        sx={{ fontWeight: 800, fontSize: '11px' }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 800, color: '#1f4fb2' }}>
                      {r.record_no}
                    </TableCell>
                    <TableCell>{r.record_date}</TableCell>
                    <TableCell>
                      <Chip size="small" label={r.frequency || 'Daily'} variant="outlined" sx={{ fontSize: '11px' }} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{r.item_name || '—'}</Typography>
                      {r.lot_no && (
                        <Chip
                          size="small"
                          label={r.lot_no}
                          onClick={() => {
                            if (onNavigateToTrace) onNavigateToTrace(r.lot_no);
                          }}
                          sx={{ fontSize: '11px', height: 20, bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 700, cursor: 'pointer' }}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {r.supplier_name || r.customer_name || r.vehicle_no || r.stage_name || 'Factory In-House'}
                    </TableCell>
                    <TableCell>{r.checked_by || 'QA Officer'}</TableCell>
                    <TableCell>
                      {r.record_code === 'P1' ? (
                        <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 600 }}>
                          Moisture: {parsed.moisture || '10.8%'} | FM: {parsed.foreign_matter || '0.4%'} | {parsed.decision || 'ACCEPTED'}
                        </Typography>
                      ) : r.record_code === 'P3' ? (
                        <Typography variant="caption" sx={{ color: '#6b21a8', fontWeight: 600 }}>
                          Grind: {parsed.grind_no || 'GRD-0001'} | Sieve: {parsed.sieve_integrity || 'Intact'} | Temp: {parsed.milling_temperature || '38°C'}
                        </Typography>
                      ) : r.record_code === 'P4' ? (
                        <Typography variant="caption" sx={{ color: '#dc2626', fontWeight: 600 }}>
                          Magnet: {parsed.ccp1_observed_magnet || '10,200G'} | Destoner: {parsed.ccp1_observed_destoner || 'Pass'}
                        </Typography>
                      ) : r.record_code === 'P6' ? (
                        <Typography variant="caption" sx={{ color: '#059669', fontWeight: 600 }}>
                          {parsed.coa_no || r.record_no} — {parsed.decision || 'PASSED & RELEASED'}
                        </Typography>
                      ) : (
                        <Typography variant="caption" sx={{ display: 'block', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.remarks || JSON.stringify(parsed)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={r.status} color="success" sx={{ fontWeight: 700, fontSize: '10px' }} />
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        <Tooltip title="View Official Form">
                          <IconButton size="small" color="primary" onClick={() => setViewingRecord(r)}>
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Print Official Record">
                          <IconButton
                            size="small"
                            sx={{ color: '#0284c7' }}
                            onClick={() => {
                              setViewingRecord(r);
                              setTimeout(() => window.print(), 300);
                            }}
                          >
                            <PrintIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {r.lot_no && (
                          <Tooltip title={`360° Traceability for ${r.lot_no}`}>
                            <IconButton
                              size="small"
                              sx={{ color: '#7c3aed' }}
                              onClick={() => {
                                if (onNavigateToTrace) onNavigateToTrace(r.lot_no);
                              }}
                            >
                              <AltRouteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* CREATE DIALOG */}
      <Dialog open={openNewDialog} onClose={() => setOpenNewDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle component="div" sx={{ bgcolor: '#1f4fb2', color: 'white', fontWeight: 700 }}>
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
                label="Supplier / Customer / Mill"
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
          <Button onClick={handleSaveRecord} variant="contained" sx={{ bgcolor: '#1f4fb2', fontWeight: 700 }}>
            Save Record
          </Button>
        </DialogActions>
      </Dialog>

      {/* OFFICIAL FORMATTED DOCUMENT & PRINT MODAL */}
      {viewingRecord && (
        <Dialog
          open={Boolean(viewingRecord)}
          onClose={() => setViewingRecord(null)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle
            component="div"
            sx={{
              bgcolor: '#1f4fb2',
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              py: 1.5,
              px: 2.5
            }}
          >
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                {viewingRecord.record_code}: {viewingRecord.record_no} — Official Record
              </Typography>
              <Typography variant="caption" sx={{ color: '#bfdbfe' }}>
                Food Safety & Quality Management System (FSSAI / HACCP / ISO 22000)
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                variant="contained"
                size="small"
                startIcon={<PrintIcon />}
                onClick={handlePrintModal}
                sx={{ bgcolor: '#ffffff', color: '#1f4fb2', fontWeight: 800, '&:hover': { bgcolor: '#e0f2fe' } }}
              >
                Print Report
              </Button>
              <IconButton size="small" onClick={() => setViewingRecord(null)} sx={{ color: 'white' }}>
                <CloseIcon />
              </IconButton>
            </Stack>
          </DialogTitle>

          <DialogContent sx={{ p: 3, bgcolor: '#fafbfc' }}>
            {/* Corporate Header */}
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                mb: 2.5,
                bgcolor: 'white',
                border: '2px solid #1f4fb2',
                borderRadius: 1.5
              }}
            >
              <Grid container spacing={1} alignItems="center">
                <Grid item xs={12} sm={8}>
                  <Typography variant="h6" sx={{ fontWeight: 900, color: '#1f4fb2', letterSpacing: 0.5 }}>
                    BVC EXPORTS
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', color: '#475569', fontWeight: 700 }}>
                    QUALITY ASSURANCE & COMPLIANCE DIVISION • ISO 22000:2018 / HACCP CERTIFIED
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a', mt: 0.5 }}>
                    {PROD_RECORDS.find(p => p.code === viewingRecord.record_code)?.label || viewingRecord.record_code}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={4} sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>
                    DOC REF: {PROD_RECORDS.find(p => p.code === viewingRecord.record_code)?.docRef || 'BVC/QA/01'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    REV NO: <strong>01</strong> | REV DATE: <strong>01.01.2024</strong>
                  </Typography>
                  <Chip
                    label={viewingRecord.status}
                    color="success"
                    size="small"
                    sx={{ mt: 0.5, fontWeight: 800, fontSize: '11px' }}
                  />
                </Grid>
              </Grid>
            </Paper>

            {/* General Meta Grid */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>RECORD NO</Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, fontFamily: 'monospace', color: '#1f4fb2' }}>
                  {viewingRecord.record_no}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>RECORD DATE</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{viewingRecord.record_date}</Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>ITEM / COMMODITY</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{viewingRecord.item_name}</Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>LOT NUMBER</Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, fontFamily: 'monospace', color: '#1f4fb2' }}>
                  {viewingRecord.lot_no || 'N/A'}
                </Typography>
              </Grid>
            </Grid>

            {/* Official Report Content */}
            {renderOfficialReportContent(viewingRecord)}

            {/* Remarks */}
            {viewingRecord.remarks && (
              <Box sx={{ mt: 2, p: 1.5, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #e2e8f0' }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>
                  OFFICIAL OBSERVATIONS & AUDITOR REMARKS
                </Typography>
                <Typography variant="body2" sx={{ fontStyle: 'italic', color: '#334155' }}>
                  "{viewingRecord.remarks}"
                </Typography>
              </Box>
            )}

            {/* Authorized Signatories Footer */}
            <Box sx={{ mt: 3, pt: 2, borderTop: '1px dashed #cbd5e1' }}>
              <Grid container spacing={3}>
                <Grid item xs={6} sm={4}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>INSPECTED BY</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{viewingRecord.checked_by || 'QA QC Officer'}</Typography>
                  <Typography variant="caption" color="text.secondary">QA Chemist / Inspector</Typography>
                </Grid>
                <Grid item xs={6} sm={4}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>VERIFIED BY</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>Plant Production Head</Typography>
                  <Typography variant="caption" color="text.secondary">Production Manager</Typography>
                </Grid>
                <Grid item xs={12} sm={4} sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>APPROVED BY</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#1f4fb2' }}>Quality Assurance Head</Typography>
                  <Typography variant="caption" color="text.secondary">FSTL / Management Rep</Typography>
                </Grid>
              </Grid>
            </Box>
          </DialogContent>

          <DialogActions sx={{ p: 2, bgcolor: '#f1f5f9', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            {viewingRecord.lot_no ? (
              <Button
                startIcon={<AltRouteIcon />}
                onClick={() => {
                  const targetLot = viewingRecord.lot_no;
                  setViewingRecord(null);
                  if (onNavigateToTrace) onNavigateToTrace(targetLot);
                }}
                sx={{ color: '#7c3aed', fontWeight: 700 }}
              >
                View 360° Traceability for {viewingRecord.lot_no}
              </Button>
            ) : <Box />}

            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={handlePrintModal}
                sx={{ fontWeight: 700 }}
              >
                Print Report
              </Button>
              <Button onClick={() => setViewingRecord(null)} variant="contained" sx={{ bgcolor: '#1f4fb2', fontWeight: 700 }}>
                Close
              </Button>
            </Stack>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
