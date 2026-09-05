import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Button,
  IconButton,
  TextField,
  MenuItem,
  Stack,
  Tooltip,
  Divider,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  RadioGroup,
  Radio,
  FormControlLabel
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import SaveIcon from '@mui/icons-material/Save';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import { CLEANING_RECORDS, INVENTORY_PRESETS, getInitialChecklistForCode } from './cleaningData';

export default function CleaningPaperCreationForm({
  formState,
  setFormState,
  handleSaveForm,
  onCancel,
  onOpenPrintPreview,
  handleApplyInventoryPreset,
  handleQuickMarkAllOk,
  isEditing
}) {
  const code = formState.record_code || 'C1';

  // Master entities state loaded from ERP Database
  const [masterEntities, setMasterEntities] = useState({
    employees: [],
    areas: [],
    machines: [],
    waterTanks: [],
    windows: [],
    pallets: [],
    toilets: [],
    vehicles: [],
    suppliers: [],
    packingMaterials: [],
    purchases: []
  });

  useEffect(() => {
    async function loadMasterEntities() {
      try {
        const res = await fetch('/api/compliance/master-entities');
        const json = await res.json();
        if (json.success && json.data) {
          setMasterEntities(json.data);
        }
      } catch (err) {
        console.error('Error fetching master entities:', err);
      }
    }
    loadMasterEntities();
  }, []);

  const updateForm = (field, val) => {
    setFormState(prev => ({ ...prev, [field]: val }));
  };

  const updateChecklist = (field, val) => {
    setFormState(prev => ({
      ...prev,
      checklist: {
        ...(prev.checklist || {}),
        [field]: val
      }
    }));
  };

  // Quick entity select helper for current form
  const handleSelectMasterEntity = (e) => {
    const val = e.target.value;
    if (!val) return;

    if (code === 'C1') {
      const area = (masterEntities.areas || []).find(a => a.area_name === val);
      if (area) {
        updateForm('area_location', area.area_name);
      }
    } else if (code === 'C2' || code === 'C14') {
      const mch = (masterEntities.machines || []).find(m => m.code === val || m.name === val);
      if (mch) {
        updateForm('area_location', `${mch.name} (${mch.code})`);
        updateChecklist('machine_name', mch.name);
        updateChecklist('machine_code', mch.code);
        updateChecklist('machine_no', mch.code);
        if (mch.responsibility) updateChecklist('responsibility', mch.responsibility);
        if (mch.location) updateChecklist('location', mch.location);
      }
    } else if (code === 'C3') {
      updateForm('area_location', val);
    } else if (code === 'C4') {
      const wt = (masterEntities.waterTanks || []).find(t => t.code === val || t.name === val);
      if (wt) {
        updateForm('area_location', `${wt.name} (${wt.location})`);
        updateChecklist('tank_id', wt.name);
        updateChecklist('tank_code', wt.code);
      }
    } else if (code === 'C5' || code === 'C11') {
      const win = (masterEntities.windows || []).find(w => w.code === val);
      if (win) {
        updateForm('area_location', `${win.code} - ${win.location}`);
        updateChecklist('window_id_code', win.code);
        updateChecklist('location', win.location);
      }
    } else if (code === 'C6' || code === 'C12') {
      const plt = (masterEntities.pallets || []).find(p => p.code === val || p.name === val);
      if (plt) {
        updateForm('area_location', `${plt.code} (${plt.location})`);
        updateChecklist('pallet_code', plt.code);
      }
    } else if (code === 'C7') {
      const tlt = (masterEntities.toilets || []).find(t => t.code === val || t.name === val);
      if (tlt) {
        updateForm('area_location', `${tlt.name} (${tlt.location})`);
        updateChecklist('toilet_name', tlt.name);
      }
    } else if (code === 'C8') {
      const veh = (masterEntities.vehicles || []).find(v => v.vehicle_no === val);
      if (veh) {
        updateForm('vehicle_no', veh.vehicle_no);
        updateChecklist('vehicle_no', veh.vehicle_no);
        if (veh.party_name) {
          updateChecklist('customer_qty', `${veh.party_name} ${veh.qty ? `/ ${veh.qty}` : ''}`);
        }
      }
    } else if (code === 'C10') {
      const pur = (masterEntities.purchases || []).find(p => p.invoice_no === val);
      if (pur) {
        updateChecklist('invoice_no', pur.invoice_no);
        if (pur.supplier) updateChecklist('supplier', pur.supplier);
        if (pur.inv_date) updateForm('record_date', pur.inv_date);
      }
    }
  };

  return (
    <Box sx={{ mb: 6 }}>
      {/* TOP CONTROLS BAR */}
      <Paper
        elevation={2}
        sx={{
          p: 2,
          mb: 3,
          bgcolor: '#0f172a',
          color: '#ffffff',
          borderRadius: 2,
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', md: 'center' },
          gap: 2
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <IconButton onClick={onCancel} sx={{ color: '#ffffff', bgcolor: 'rgba(255,255,255,0.1)' }} size="small">
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.5px' }}>
              {isEditing ? `Edit Compliance Entry: ${formState.record_no}` : `Create New Official Compliance Entry (${code})`}
            </Typography>
            <Typography variant="caption" sx={{ color: '#94a3b8' }}>
              BVC Exports Pvt Ltd — Food Safety & Sanitation Official Paper Worksheet
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button
            variant="outlined"
            size="small"
            startIcon={<PrintIcon />}
            onClick={() => onOpenPrintPreview(true)}
            sx={{
              color: '#ffffff',
              borderColor: '#475569',
              '&:hover': { bgcolor: '#1e293b', borderColor: '#94a3b8' }
            }}
          >
            Print Blank Form
          </Button>

          <Button
            variant="outlined"
            size="small"
            startIcon={<VisibilityIcon />}
            onClick={() => onOpenPrintPreview(false)}
            sx={{
              color: '#38bdf8',
              borderColor: '#0284c7',
              '&:hover': { bgcolor: 'rgba(56, 189, 248, 0.1)' }
            }}
          >
            Live Paper View
          </Button>

          <Button
            variant="outlined"
            size="small"
            startIcon={<PrintIcon />}
            onClick={(e) => handleSaveForm(e, true)}
            sx={{
              color: '#facc15',
              borderColor: '#ca8a04',
              fontWeight: 700,
              '&:hover': { bgcolor: 'rgba(250, 204, 21, 0.1)' }
            }}
          >
            💾 Save & Print
          </Button>

          <Button
            variant="contained"
            size="small"
            startIcon={<SaveIcon />}
            onClick={(e) => handleSaveForm(e, false)}
            sx={{
              bgcolor: '#2563eb',
              fontWeight: 700,
              '&:hover': { bgcolor: '#1d4ed8' }
            }}
          >
            {isEditing ? 'Update Entry' : 'Save Entry'}
          </Button>
        </Stack>
      </Paper>

      {/* QUICK PRESET & AUTO-FILL TOOLBAR */}
      <Paper elevation={1} sx={{ p: 2, mb: 3, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3.5}>
            <TextField
              select
              fullWidth
              size="small"
              label="Select Checklist Format (C1–C14)"
              value={formState.record_code}
              onChange={(e) => {
                const newCode = e.target.value;
                const newChecklist = getInitialChecklistForCode(newCode);
                const meta = CLEANING_RECORDS.find(c => c.code === newCode) || {};
                let defaultInspector = 'Sanitation Officer';
                let defaultSupervisor = 'Plant Supervisor';
                if (newCode === 'C7') { defaultInspector = 'House Keeper'; defaultSupervisor = 'HR MANAGER'; }
                else if (newCode === 'C8') { defaultInspector = 'Security Officer'; defaultSupervisor = 'Dispatch Clerk'; }
                else if (newCode === 'C9') { defaultInspector = 'QMR'; defaultSupervisor = 'Managing Director'; }
                else if (newCode === 'C10') { defaultInspector = 'QC Inspector'; defaultSupervisor = 'QA Head'; }
                else if (newCode === 'C11' || newCode === 'C12') { defaultInspector = 'QA Officer'; defaultSupervisor = 'QA Manager'; }
                else if (newCode === 'C13') { defaultInspector = 'Vasu (Pest Officer)'; defaultSupervisor = 'Mr. Sasikumar (FSTL)'; }
                else if (newCode === 'C14') { defaultInspector = 'Operator'; defaultSupervisor = 'Plant Incharge'; }

                setFormState(prev => ({
                  ...prev,
                  record_code: newCode,
                  area_location: meta.target || prev.area_location,
                  frequency: meta.freq || prev.frequency,
                  inspector_name: defaultInspector,
                  supervisor_name: defaultSupervisor,
                  prepared_by: defaultInspector,
                  verified_by: defaultSupervisor,
                  checklist: newChecklist
                }));
              }}
              sx={{ bgcolor: '#ffffff' }}
              disabled={isEditing}
            >
              {CLEANING_RECORDS.filter(c => c.code !== 'ALL').map(c => (
                <MenuItem key={c.code} value={c.code}>
                  <strong>[{c.code}]</strong> {c.label.replace(`${c.code}: `, '')} ({c.freq})
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} md={5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <AutoAwesomeIcon sx={{ color: '#16a34a' }} />
              <TextField
                select
                fullWidth
                size="small"
                label="⚡ Quick-Connect Real Master Entity"
                defaultValue=""
                onChange={handleSelectMasterEntity}
                sx={{ bgcolor: '#ffffff' }}
              >
                <MenuItem value="" disabled>-- Select ERP Master Entity to Autofill --</MenuItem>
                {code === 'C1' && (masterEntities.areas || []).map(a => (
                  <MenuItem key={a.id} value={a.area_name}>🏢 Area: {a.area_name}</MenuItem>
                ))}
                {(code === 'C2' || code === 'C14') && (masterEntities.machines || []).map(m => (
                  <MenuItem key={m.id} value={m.code}>⚙️ Machine: {m.name} ({m.code})</MenuItem>
                ))}
                {code === 'C3' && (masterEntities.areas || []).map(a => (
                  <MenuItem key={a.id} value={a.area_name}>🐜 Pest Control Area: {a.area_name}</MenuItem>
                ))}
                {code === 'C4' && (masterEntities.waterTanks || []).map(t => (
                  <MenuItem key={t.id} value={t.code}>💧 Water Tank: {t.name}</MenuItem>
                ))}
                {(code === 'C5' || code === 'C11') && (masterEntities.windows || []).map(w => (
                  <MenuItem key={w.id} value={w.code}>🪟 Window: {w.code} - {w.location}</MenuItem>
                ))}
                {(code === 'C6' || code === 'C12') && (masterEntities.pallets || []).map(p => (
                  <MenuItem key={p.id} value={p.code}>📦 Pallet: {p.name} ({p.code})</MenuItem>
                ))}
                {code === 'C7' && (masterEntities.toilets || []).map(t => (
                  <MenuItem key={t.id} value={t.code}>🚻 Restroom: {t.name}</MenuItem>
                ))}
                {code === 'C8' && (masterEntities.vehicles || []).map(v => (
                  <MenuItem key={v.vehicle_no} value={v.vehicle_no}>🚛 Vehicle: {v.vehicle_no} ({v.party_name})</MenuItem>
                ))}
                {code === 'C10' && (masterEntities.purchases || []).map(p => (
                  <MenuItem key={p.id} value={p.invoice_no}>📄 Purchase Invoice: {p.invoice_no} ({p.supplier})</MenuItem>
                ))}
              </TextField>
            </Stack>
          </Grid>

          <Grid item xs={12} md={3.5}>
            <Stack direction="row" spacing={1} justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
              <Button
                variant="contained"
                size="small"
                color="success"
                startIcon={<CheckCircleIcon />}
                onClick={handleQuickMarkAllOk}
                sx={{ fontWeight: 700, width: { xs: '100%', sm: 'auto' } }}
              >
                ✓ Mark All Checkpoints OK
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* ========================================================================= */}
      {/* OFFICIAL PAPER WORKSHEET CONTAINER */}
      {/* ========================================================================= */}
      <Paper
        elevation={4}
        sx={{
          maxWidth: '1050px',
          mx: 'auto',
          p: { xs: 2, sm: 4 },
          bgcolor: '#ffffff',
          border: '2px solid #000000',
          borderRadius: 0,
          color: '#000000',
          fontFamily: '"Arial", "Calibri", sans-serif'
        }}
      >
        {code === 'C1' && <C1Editor formState={formState} updateForm={updateForm} updateChecklist={updateChecklist} masterEntities={masterEntities} />}
        {code === 'C2' && <C2Editor formState={formState} updateForm={updateForm} updateChecklist={updateChecklist} masterEntities={masterEntities} />}
        {code === 'C3' && <C3Editor formState={formState} updateForm={updateForm} updateChecklist={updateChecklist} masterEntities={masterEntities} />}
        {code === 'C4' && <C4Editor formState={formState} updateForm={updateForm} updateChecklist={updateChecklist} masterEntities={masterEntities} />}
        {code === 'C5' && <C5Editor formState={formState} updateForm={updateForm} updateChecklist={updateChecklist} masterEntities={masterEntities} />}
        {code === 'C6' && <C6Editor formState={formState} updateForm={updateForm} updateChecklist={updateChecklist} masterEntities={masterEntities} />}
        {code === 'C7' && <C7Editor formState={formState} updateForm={updateForm} updateChecklist={updateChecklist} masterEntities={masterEntities} />}
        {code === 'C8' && <C8Editor formState={formState} updateForm={updateForm} updateChecklist={updateChecklist} masterEntities={masterEntities} />}
        {code === 'C9' && <C9Editor formState={formState} updateForm={updateForm} updateChecklist={updateChecklist} setFormState={setFormState} masterEntities={masterEntities} />}
        {code === 'C10' && <C10Editor formState={formState} updateForm={updateForm} updateChecklist={updateChecklist} masterEntities={masterEntities} />}
        {code === 'C11' && <C11Editor formState={formState} updateForm={updateForm} updateChecklist={updateChecklist} masterEntities={masterEntities} />}
        {code === 'C12' && <C12Editor formState={formState} updateForm={updateForm} updateChecklist={updateChecklist} masterEntities={masterEntities} />}
        {code === 'C13' && <C13Editor formState={formState} updateForm={updateForm} updateChecklist={updateChecklist} masterEntities={masterEntities} />}
        {code === 'C14' && <C14Editor formState={formState} updateForm={updateForm} updateChecklist={updateChecklist} masterEntities={masterEntities} />}
      </Paper>

      {/* BOTTOM ACTION BAR */}
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2, maxWidth: '1050px', mx: 'auto' }}>
        <Button variant="outlined" color="inherit" onClick={onCancel} sx={{ bgcolor: '#ffffff', px: 3 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={(e) => handleSaveForm(e, false)}
          sx={{ bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' }, px: 4, py: 1, fontWeight: 700 }}
        >
          {isEditing ? 'Update Compliance Entry' : 'Save Compliance Entry'}
        </Button>
      </Box>
    </Box>
  );
}

// =========================================================================================
// C1: PRODUCTION AREA CLEANING (DAILY)
// =========================================================================================
function C1Editor({ formState, updateForm, updateChecklist }) {
  const chk = formState.checklist || {};
  const activities = chk.activities || [];

  const handleStatusChange = (idx, status) => {
    const updated = [...activities];
    updated[idx] = { ...updated[idx], status };
    updateChecklist('activities', updated);
  };

  const handleRemarkChange = (idx, remarks) => {
    const updated = [...activities];
    updated[idx] = { ...updated[idx], remarks };
    updateChecklist('activities', updated);
  };

  return (
    <Box>
      {/* Document Header Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '12px', width: '38%', verticalAlign: 'middle', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: '#000' }}>
                BVC EXPORTS PVT LIMITED
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '8px', width: '37%', verticalAlign: 'middle', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: '#000', textTransform: 'uppercase' }}>
                CLEANING CHECKLIST<br />PRODUCTION AREA<br /><span style={{ fontSize: '0.9rem', fontWeight: 600 }}>(Daily)</span>
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 10px', width: '25%', verticalAlign: 'top', fontSize: '0.82rem' }}>
              <div><strong>FORMAT NO.</strong> : BVC/CP/CL/01</div>
              <div><strong>REV. NO.</strong> : 00</div>
              <div style={{ display: 'flex', alignItems: 'center', marginTop: 2 }}>
                <strong>DATE :</strong>
                <input
                  type="date"
                  value={formState.record_date || ''}
                  onChange={(e) => updateForm('record_date', e.target.value)}
                  style={{ marginLeft: 6, padding: '2px 4px', border: '1px solid #999', fontSize: '0.82rem' }}
                />
              </div>
              <div><strong>PAGE</strong> : 1 OF 1</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Subheader: Checked by / Verified by */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>CHECKED BY (OPERATOR) :</strong>
              <input
                type="text"
                value={formState.inspector_name || ''}
                onChange={(e) => updateForm('inspector_name', e.target.value)}
                placeholder="Enter Operator Name"
                style={{ width: '90%', marginTop: 4, padding: '4px 8px', border: '1px solid #ccc', fontSize: '0.88rem' }}
              />
            </td>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>VERIFIED BY : UNIT SUPERVISOR</strong>
              <input
                type="text"
                value={formState.supervisor_name || ''}
                onChange={(e) => updateForm('supervisor_name', e.target.value)}
                placeholder="Enter Unit Supervisor Name"
                style={{ width: '90%', marginTop: 4, padding: '4px 8px', border: '1px solid #ccc', fontSize: '0.88rem' }}
              />
            </td>
          </tr>
        </tbody>
      </table>

      {/* Activities Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            <th style={{ border: '2px solid #000', padding: '8px', width: '8%', textAlign: 'center' }}>SL.NO.</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '47%', textAlign: 'left' }}>ACTIVITIES</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '20%', textAlign: 'center' }}>STATUS</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '25%', textAlign: 'left' }}>REMARKS</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((act, idx) => (
            <tr key={idx}>
              <td style={{ border: '2px solid #000', padding: '8px', textAlign: 'center', fontWeight: 700 }}>{act.s_no}.</td>
              <td style={{ border: '2px solid #000', padding: '8px', fontWeight: 600, fontSize: '0.88rem' }}>{act.activity}</td>
              <td style={{ border: '2px solid #000', padding: '8px', textAlign: 'center' }}>
                <select
                  value={act.status || 'OK'}
                  onChange={(e) => handleStatusChange(idx, e.target.value)}
                  style={{ padding: '4px 8px', fontWeight: 700, borderRadius: 4, border: '1px solid #94a3b8' }}
                >
                  <option value="OK">√ CHECK (OK)</option>
                  <option value="NOT_OK">X NOT CHECK</option>
                  <option value="HOLIDAY">H HOLIDAY</option>
                </select>
              </td>
              <td style={{ border: '2px solid #000', padding: '8px' }}>
                <input
                  type="text"
                  value={act.remarks || ''}
                  onChange={(e) => handleRemarkChange(idx, e.target.value)}
                  style={{ width: '95%', padding: '4px 8px', border: '1px solid #ccc' }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend Box */}
      <Box sx={{ border: '1px solid #000', p: 1.5, display: 'flex', justifyContent: 'space-around', alignItems: 'center', bgcolor: '#fafafa' }}>
        <Box sx={{ textAlign: 'center' }}><strong>[ √ ]</strong> CHECK</Box>
        <Box sx={{ textAlign: 'center' }}><strong>[ H ]</strong> HOLIDAY</Box>
        <Box sx={{ textAlign: 'center' }}><strong>[ X ]</strong> NOT CHECK</Box>
      </Box>
    </Box>
  );
}

// =========================================================================================
// C2: MACHINERIES CLEANING (15 DAYS ONCE)
// =========================================================================================
function C2Editor({ formState, updateForm, updateChecklist }) {
  const chk = formState.checklist || {};
  const activities = chk.activities || [];

  const handleStatusChange = (idx, status) => {
    const updated = [...activities];
    updated[idx] = { ...updated[idx], status };
    updateChecklist('activities', updated);
  };

  const handleRemarkChange = (idx, remarks) => {
    const updated = [...activities];
    updated[idx] = { ...updated[idx], remarks };
    updateChecklist('activities', updated);
  };

  return (
    <Box>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '12px', width: '38%', verticalAlign: 'middle', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: '#000' }}>
                BVC EXPORTS PVT LIMITED
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '8px', width: '37%', verticalAlign: 'middle', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: '#000', textTransform: 'uppercase' }}>
                CLEANING CHECKLIST<br />MACHINERIES<br /><span style={{ fontSize: '0.9rem', fontWeight: 600 }}>(15 DAYS ONCE)</span>
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 10px', width: '25%', verticalAlign: 'top', fontSize: '0.82rem' }}>
              <div><strong>FORMAT NO.</strong> : BVC/CP/CL/02</div>
              <div><strong>REV. NO.</strong> : 00</div>
              <div><strong>DATE</strong> : 29.05.2017</div>
              <div><strong>PAGE</strong> : 1 OF 1</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Machine Name & Responsibility */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>MACHINE NAME & CODE :</strong>
              <input
                type="text"
                value={formState.area_location || chk.machine_name || ''}
                onChange={(e) => {
                  updateForm('area_location', e.target.value);
                  updateChecklist('machine_name', e.target.value);
                }}
                placeholder="e.g. Pulse Hammer Mill #01 (MCH-MIL-01)"
                style={{ width: '95%', marginTop: 4, padding: '4px 8px', border: '1px solid #ccc', fontSize: '0.88rem' }}
              />
            </td>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>RESPONSIBILITY :</strong>
              <input
                type="text"
                value={chk.responsibility || ''}
                onChange={(e) => updateChecklist('responsibility', e.target.value)}
                placeholder="e.g. Operator / Cleaner"
                style={{ width: '95%', marginTop: 4, padding: '4px 8px', border: '1px solid #ccc', fontSize: '0.88rem' }}
              />
            </td>
          </tr>
        </tbody>
      </table>

      {/* Activities Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            <th style={{ border: '2px solid #000', padding: '8px', width: '8%', textAlign: 'center' }}>SL.NO.</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '50%', textAlign: 'left' }}>ACTIVITIES</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '18%', textAlign: 'center' }}>STATUS</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '24%', textAlign: 'left' }}>REMARKS</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((act, idx) => (
            <tr key={idx}>
              <td style={{ border: '2px solid #000', padding: '8px', textAlign: 'center', fontWeight: 700 }}>{act.s_no}.</td>
              <td style={{ border: '2px solid #000', padding: '8px', fontWeight: 600, fontSize: '0.88rem', whiteSpace: 'pre-line' }}>{act.activity}</td>
              <td style={{ border: '2px solid #000', padding: '8px', textAlign: 'center' }}>
                <select
                  value={act.status || 'OK'}
                  onChange={(e) => handleStatusChange(idx, e.target.value)}
                  style={{ padding: '4px 8px', fontWeight: 700, borderRadius: 4, border: '1px solid #94a3b8' }}
                >
                  <option value="OK">√ CHECK</option>
                  <option value="NOT_OK">X NOT CHECK</option>
                  <option value="HOLIDAY">H HOLIDAY</option>
                </select>
              </td>
              <td style={{ border: '2px solid #000', padding: '8px' }}>
                <input
                  type="text"
                  value={act.remarks || ''}
                  onChange={(e) => handleRemarkChange(idx, e.target.value)}
                  style={{ width: '95%', padding: '4px 8px', border: '1px solid #ccc' }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Bottom Signatures */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>CHECKED BY :</strong>
              <input
                type="text"
                value={formState.inspector_name || ''}
                onChange={(e) => updateForm('inspector_name', e.target.value)}
                placeholder="Operator Name"
                style={{ width: '90%', marginTop: 4, padding: '4px 8px', border: '1px solid #ccc' }}
              />
            </td>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>VERIFIED BY :</strong>
              <input
                type="text"
                value={formState.supervisor_name || ''}
                onChange={(e) => updateForm('supervisor_name', e.target.value)}
                placeholder="Supervisor Name"
                style={{ width: '90%', marginTop: 4, padding: '4px 8px', border: '1px solid #ccc' }}
              />
            </td>
          </tr>
        </tbody>
      </table>

      <Box sx={{ border: '1px solid #000', p: 1.5, display: 'flex', justifyContent: 'space-around', alignItems: 'center', bgcolor: '#fafafa' }}>
        <Box sx={{ textAlign: 'center' }}><strong>[ √ ]</strong> CHECK</Box>
        <Box sx={{ textAlign: 'center' }}><strong>[ H ]</strong> HOLIDAY</Box>
        <Box sx={{ textAlign: 'center' }}><strong>[ X ]</strong> NOT CHECK</Box>
      </Box>
    </Box>
  );
}

// =========================================================================================
// C3: PEST CONTROL CLEANING (MONTHLY ONCE)
// =========================================================================================
function C3Editor({ formState, updateForm, updateChecklist }) {
  const chk = formState.checklist || {};
  const activities = chk.activities || [];

  const handleStatusChange = (idx, status) => {
    const updated = [...activities];
    updated[idx] = { ...updated[idx], status };
    updateChecklist('activities', updated);
  };

  const handleRemarkChange = (idx, remarks) => {
    const updated = [...activities];
    updated[idx] = { ...updated[idx], remarks };
    updateChecklist('activities', updated);
  };

  return (
    <Box>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '12px', width: '38%', verticalAlign: 'middle', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: '#000' }}>
                BVC EXPORTS PVT LIMITED
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '8px', width: '37%', verticalAlign: 'middle', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: '#000', textTransform: 'uppercase' }}>
                CLEANING CHECKLIST<br />PEST CONTROL<br /><span style={{ fontSize: '0.9rem', fontWeight: 600 }}>(MONTHLY ONCE)</span>
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 10px', width: '25%', verticalAlign: 'top', fontSize: '0.82rem' }}>
              <div><strong>FORMAT NO.</strong> : BVC/CP/CL/03</div>
              <div><strong>REV. NO.</strong> : 00</div>
              <div><strong>DATE</strong> : 29.05.2017</div>
              <div><strong>PAGE</strong> : 1 OF 1</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Activities Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            <th style={{ border: '2px solid #000', padding: '8px', width: '8%', textAlign: 'center' }}>SL.NO.</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '52%', textAlign: 'left' }}>ACTIVITIES</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '16%', textAlign: 'center' }}>STATUS</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '24%', textAlign: 'left' }}>REMARKS</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((act, idx) => (
            <tr key={idx}>
              <td style={{ border: '2px solid #000', padding: '8px', textAlign: 'center', fontWeight: 700 }}>{act.s_no}.</td>
              <td style={{ border: '2px solid #000', padding: '8px', fontWeight: 600, fontSize: '0.88rem', whiteSpace: 'pre-line' }}>{act.activity}</td>
              <td style={{ border: '2px solid #000', padding: '8px', textAlign: 'center' }}>
                <select
                  value={act.status || 'OK'}
                  onChange={(e) => handleStatusChange(idx, e.target.value)}
                  style={{ padding: '4px 8px', fontWeight: 700, borderRadius: 4, border: '1px solid #94a3b8' }}
                >
                  <option value="OK">√ CHECK</option>
                  <option value="NOT_OK">X NOT CHECK</option>
                  <option value="HOLIDAY">H HOLIDAY</option>
                </select>
              </td>
              <td style={{ border: '2px solid #000', padding: '8px' }}>
                <input
                  type="text"
                  value={act.remarks || ''}
                  onChange={(e) => handleRemarkChange(idx, e.target.value)}
                  style={{ width: '95%', padding: '4px 8px', border: '1px solid #ccc' }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Signatures */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>CHECKED BY :</strong>
              <input
                type="text"
                value={formState.inspector_name || ''}
                onChange={(e) => updateForm('inspector_name', e.target.value)}
                placeholder="PCI Operator / Sanitation Incharge"
                style={{ width: '90%', marginTop: 4, padding: '4px 8px', border: '1px solid #ccc' }}
              />
            </td>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>VERIFIED BY :</strong>
              <input
                type="text"
                value={formState.supervisor_name || ''}
                onChange={(e) => updateForm('supervisor_name', e.target.value)}
                placeholder="QA Incharge / Plant Supervisor"
                style={{ width: '90%', marginTop: 4, padding: '4px 8px', border: '1px solid #ccc' }}
              />
            </td>
          </tr>
        </tbody>
      </table>

      <Box sx={{ border: '1px solid #000', p: 1.5, display: 'flex', justifyContent: 'space-around', alignItems: 'center', bgcolor: '#fafafa' }}>
        <Box sx={{ textAlign: 'center' }}><strong>[ √ ]</strong> CHECK</Box>
        <Box sx={{ textAlign: 'center' }}><strong>[ H ]</strong> HOLIDAY</Box>
        <Box sx={{ textAlign: 'center' }}><strong>[ X ]</strong> NOT CHECK</Box>
      </Box>
    </Box>
  );
}

// =========================================================================================
// C4: WATER TANK CLEANING (15 DAYS ONCE)
// =========================================================================================
function C4Editor({ formState, updateForm, updateChecklist }) {
  const chk = formState.checklist || {};
  const activities = chk.activities || [];

  const handleStatusChange = (idx, status) => {
    const updated = [...activities];
    updated[idx] = { ...updated[idx], status };
    updateChecklist('activities', updated);
  };

  const handleRemarkChange = (idx, remarks) => {
    const updated = [...activities];
    updated[idx] = { ...updated[idx], remarks };
    updateChecklist('activities', updated);
  };

  return (
    <Box>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '12px', width: '38%', verticalAlign: 'middle', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: '#000' }}>
                BVC EXPORTS PVT LIMITED
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '8px', width: '37%', verticalAlign: 'middle', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: '#000', textTransform: 'uppercase' }}>
                CLEANING CHECKLIST<br />WATER TANK<br /><span style={{ fontSize: '0.9rem', fontWeight: 600 }}>(15 DAYS ONCE)</span>
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 10px', width: '25%', verticalAlign: 'top', fontSize: '0.82rem' }}>
              <div><strong>FORMAT NO.</strong> : BVC/CP/CL/04</div>
              <div><strong>REV. NO.</strong> : 00</div>
              <div><strong>DATE</strong> : 29.05.2017</div>
              <div><strong>PAGE</strong> : 1 OF 1</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Tank Identification */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '8px 12px' }}>
              <strong>TANK IDENTIFICATION / LOCATION :</strong>
              <input
                type="text"
                value={formState.area_location || ''}
                onChange={(e) => updateForm('area_location', e.target.value)}
                placeholder="e.g. Overhead Process Water Tank #01 (10,000 L)"
                style={{ width: '95%', marginTop: 4, padding: '4px 8px', border: '1px solid #ccc' }}
              />
            </td>
          </tr>
        </tbody>
      </table>

      {/* Activities Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            <th style={{ border: '2px solid #000', padding: '8px', width: '8%', textAlign: 'center' }}>SL.NO.</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '52%', textAlign: 'left' }}>ACTIVITIES</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '16%', textAlign: 'center' }}>STATUS</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '24%', textAlign: 'left' }}>REMARKS</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((act, idx) => (
            <tr key={idx}>
              <td style={{ border: '2px solid #000', padding: '8px', textAlign: 'center', fontWeight: 700 }}>{act.s_no}.</td>
              <td style={{ border: '2px solid #000', padding: '8px', fontWeight: 600, fontSize: '0.88rem' }}>{act.activity}</td>
              <td style={{ border: '2px solid #000', padding: '8px', textAlign: 'center' }}>
                <select
                  value={act.status || 'OK'}
                  onChange={(e) => handleStatusChange(idx, e.target.value)}
                  style={{ padding: '4px 8px', fontWeight: 700, borderRadius: 4, border: '1px solid #94a3b8' }}
                >
                  <option value="OK">√ CHECK</option>
                  <option value="NOT_OK">X NOT CHECK</option>
                  <option value="HOLIDAY">H HOLIDAY</option>
                </select>
              </td>
              <td style={{ border: '2px solid #000', padding: '8px' }}>
                <input
                  type="text"
                  value={act.remarks || ''}
                  onChange={(e) => handleRemarkChange(idx, e.target.value)}
                  style={{ width: '95%', padding: '4px 8px', border: '1px solid #ccc' }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Signatures */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>CHECKED BY :</strong>
              <input
                type="text"
                value={formState.inspector_name || ''}
                onChange={(e) => updateForm('inspector_name', e.target.value)}
                placeholder="Sanitation Staff"
                style={{ width: '90%', marginTop: 4, padding: '4px 8px', border: '1px solid #ccc' }}
              />
            </td>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>VERIFIED BY :</strong>
              <input
                type="text"
                value={formState.supervisor_name || ''}
                onChange={(e) => updateForm('supervisor_name', e.target.value)}
                placeholder="Unit Supervisor"
                style={{ width: '90%', marginTop: 4, padding: '4px 8px', border: '1px solid #ccc' }}
              />
            </td>
          </tr>
        </tbody>
      </table>

      <Box sx={{ border: '1px solid #000', p: 1.5, display: 'flex', justifyContent: 'space-around', alignItems: 'center', bgcolor: '#fafafa' }}>
        <Box sx={{ textAlign: 'center' }}><strong>[ √ ]</strong> CHECK</Box>
        <Box sx={{ textAlign: 'center' }}><strong>[ H ]</strong> HOLIDAY</Box>
        <Box sx={{ textAlign: 'center' }}><strong>[ X ]</strong> NOT CHECK</Box>
      </Box>
    </Box>
  );
}

// =========================================================================================
// C5: WINDOW-GLASS CLEANING (MONTHLY ONCE)
// =========================================================================================
function C5Editor({ formState, updateForm, updateChecklist }) {
  const chk = formState.checklist || {};
  const activities = chk.activities || [];

  const handleStatusChange = (idx, status) => {
    const updated = [...activities];
    updated[idx] = { ...updated[idx], status };
    updateChecklist('activities', updated);
  };

  const handleRemarkChange = (idx, remarks) => {
    const updated = [...activities];
    updated[idx] = { ...updated[idx], remarks };
    updateChecklist('activities', updated);
  };

  return (
    <Box>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '12px', width: '38%', verticalAlign: 'middle', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: '#000' }}>
                BVC EXPORTS PVT LIMITED
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '8px', width: '37%', verticalAlign: 'middle', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: '#000', textTransform: 'uppercase' }}>
                CLEANING CHECKLIST<br />WINDOW-GLASS<br /><span style={{ fontSize: '0.9rem', fontWeight: 600 }}>(MONTHLY ONCE)</span>
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 10px', width: '25%', verticalAlign: 'top', fontSize: '0.82rem' }}>
              <div><strong>FORMAT NO.</strong> : BVC/CP/CL/05</div>
              <div><strong>REV. NO.</strong> : 00</div>
              <div><strong>DATE</strong> : 29.05.2017</div>
              <div><strong>PAGE</strong> : 1 OF 1</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Window ID Code & Location */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>WINDOW ID CODE :</strong>
              <input
                type="text"
                value={chk.window_id_code || ''}
                onChange={(e) => updateChecklist('window_id_code', e.target.value)}
                placeholder="e.g. WIN-MIL-01 to 08"
                style={{ width: '90%', marginTop: 4, padding: '4px 8px', border: '1px solid #ccc' }}
              />
            </td>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>LOCATION :</strong>
              <input
                type="text"
                value={formState.area_location || chk.location || ''}
                onChange={(e) => {
                  updateForm('area_location', e.target.value);
                  updateChecklist('location', e.target.value);
                }}
                placeholder="e.g. Milling Hall Line 1 & Packaging Bay"
                style={{ width: '90%', marginTop: 4, padding: '4px 8px', border: '1px solid #ccc' }}
              />
            </td>
          </tr>
        </tbody>
      </table>

      {/* Activities Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            <th style={{ border: '2px solid #000', padding: '8px', width: '8%', textAlign: 'center' }}>SL.NO.</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '52%', textAlign: 'left' }}>ACTIVITIES</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '16%', textAlign: 'center' }}>STATUS</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '24%', textAlign: 'left' }}>REMARKS</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((act, idx) => (
            <tr key={idx}>
              <td style={{ border: '2px solid #000', padding: '8px', textAlign: 'center', fontWeight: 700 }}>{act.s_no}.</td>
              <td style={{ border: '2px solid #000', padding: '8px', fontWeight: 600, fontSize: '0.88rem', whiteSpace: 'pre-line' }}>{act.activity}</td>
              <td style={{ border: '2px solid #000', padding: '8px', textAlign: 'center' }}>
                <select
                  value={act.status || 'OK'}
                  onChange={(e) => handleStatusChange(idx, e.target.value)}
                  style={{ padding: '4px 8px', fontWeight: 700, borderRadius: 4, border: '1px solid #94a3b8' }}
                >
                  <option value="OK">√ CHECK</option>
                  <option value="NOT_OK">X NOT CHECK</option>
                  <option value="HOLIDAY">H HOLIDAY</option>
                </select>
              </td>
              <td style={{ border: '2px solid #000', padding: '8px' }}>
                <input
                  type="text"
                  value={act.remarks || ''}
                  onChange={(e) => handleRemarkChange(idx, e.target.value)}
                  style={{ width: '95%', padding: '4px 8px', border: '1px solid #ccc' }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Signatures */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>CHECKED BY :</strong>
              <input
                type="text"
                value={formState.inspector_name || ''}
                onChange={(e) => updateForm('inspector_name', e.target.value)}
                placeholder="Housekeeper Name"
                style={{ width: '90%', marginTop: 4, padding: '4px 8px', border: '1px solid #ccc' }}
              />
            </td>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>VERIFIED BY :</strong>
              <input
                type="text"
                value={formState.supervisor_name || ''}
                onChange={(e) => updateForm('supervisor_name', e.target.value)}
                placeholder="Supervisor Name"
                style={{ width: '90%', marginTop: 4, padding: '4px 8px', border: '1px solid #ccc' }}
              />
            </td>
          </tr>
        </tbody>
      </table>

      <Box sx={{ border: '1px solid #000', p: 1.5, display: 'flex', justifyContent: 'space-around', alignItems: 'center', bgcolor: '#fafafa' }}>
        <Box sx={{ textAlign: 'center' }}><strong>[ √ ]</strong> CHECK</Box>
        <Box sx={{ textAlign: 'center' }}><strong>[ H ]</strong> HOLIDAY</Box>
        <Box sx={{ textAlign: 'center' }}><strong>[ X ]</strong> NOT CHECK</Box>
      </Box>
    </Box>
  );
}

// =========================================================================================
// C6: WOOD-PALLET CLEANING (15 DAYS ONCE)
// =========================================================================================
function C6Editor({ formState, updateForm, updateChecklist }) {
  const chk = formState.checklist || {};
  const activities = chk.activities || [];

  const handleStatusChange = (idx, status) => {
    const updated = [...activities];
    updated[idx] = { ...updated[idx], status };
    updateChecklist('activities', updated);
  };

  const handleRemarkChange = (idx, remarks) => {
    const updated = [...activities];
    updated[idx] = { ...updated[idx], remarks };
    updateChecklist('activities', updated);
  };

  return (
    <Box>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '12px', width: '38%', verticalAlign: 'middle', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: '#000' }}>
                BVC EXPORTS PVT LIMITED
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '8px', width: '37%', verticalAlign: 'middle', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: '#000', textTransform: 'uppercase' }}>
                CLEANING CHECKLIST<br />WOOD-PALLET<br /><span style={{ fontSize: '0.9rem', fontWeight: 600 }}>(15 DAYS ONCE)</span>
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 10px', width: '25%', verticalAlign: 'top', fontSize: '0.82rem' }}>
              <div><strong>FORMAT NO.</strong> : BVC/CP/CL/06</div>
              <div><strong>REV. NO.</strong> : 00</div>
              <div><strong>DATE</strong> : 29.05.2017</div>
              <div><strong>PAGE</strong> : 1 OF 1</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Pallet Code / No */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '8px 12px' }}>
              <strong>PALLET CODE/NO :</strong>
              <input
                type="text"
                value={formState.area_location || chk.pallet_code || ''}
                onChange={(e) => {
                  updateForm('area_location', e.target.value);
                  updateChecklist('pallet_code', e.target.value);
                }}
                placeholder="e.g. PLT-WD-01 to 50 (Finished Goods Bay)"
                style={{ width: '95%', marginTop: 4, padding: '4px 8px', border: '1px solid #ccc' }}
              />
            </td>
          </tr>
        </tbody>
      </table>

      {/* Activities Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            <th style={{ border: '2px solid #000', padding: '8px', width: '8%', textAlign: 'center' }}>SL.NO.</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '52%', textAlign: 'left' }}>ACTIVITIES</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '16%', textAlign: 'center' }}>STATUS</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '24%', textAlign: 'left' }}>REMARKS</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((act, idx) => (
            <tr key={idx}>
              <td style={{ border: '2px solid #000', padding: '8px', textAlign: 'center', fontWeight: 700 }}>{act.s_no}.</td>
              <td style={{ border: '2px solid #000', padding: '8px', fontWeight: 600, fontSize: '0.88rem' }}>{act.activity}</td>
              <td style={{ border: '2px solid #000', padding: '8px', textAlign: 'center' }}>
                <select
                  value={act.status || 'OK'}
                  onChange={(e) => handleStatusChange(idx, e.target.value)}
                  style={{ padding: '4px 8px', fontWeight: 700, borderRadius: 4, border: '1px solid #94a3b8' }}
                >
                  <option value="OK">√ CHECK</option>
                  <option value="NOT_OK">X NOT CHECK</option>
                  <option value="HOLIDAY">H HOLIDAY</option>
                </select>
              </td>
              <td style={{ border: '2px solid #000', padding: '8px' }}>
                <input
                  type="text"
                  value={act.remarks || ''}
                  onChange={(e) => handleRemarkChange(idx, e.target.value)}
                  style={{ width: '95%', padding: '4px 8px', border: '1px solid #ccc' }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Signatures */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>CHECKED BY :</strong>
              <input
                type="text"
                value={formState.inspector_name || ''}
                onChange={(e) => updateForm('inspector_name', e.target.value)}
                placeholder="Store Staff"
                style={{ width: '90%', marginTop: 4, padding: '4px 8px', border: '1px solid #ccc' }}
              />
            </td>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>VERIFIED BY :</strong>
              <input
                type="text"
                value={formState.supervisor_name || ''}
                onChange={(e) => updateForm('supervisor_name', e.target.value)}
                placeholder="Supervisor"
                style={{ width: '90%', marginTop: 4, padding: '4px 8px', border: '1px solid #ccc' }}
              />
            </td>
          </tr>
        </tbody>
      </table>

      <Box sx={{ border: '1px solid #000', p: 1.5, display: 'flex', justifyContent: 'space-around', alignItems: 'center', bgcolor: '#fafafa' }}>
        <Box sx={{ textAlign: 'center' }}><strong>[ √ ]</strong> CHECK</Box>
        <Box sx={{ textAlign: 'center' }}><strong>[ H ]</strong> HOLIDAY</Box>
        <Box sx={{ textAlign: 'center' }}><strong>[ X ]</strong> NOT CHECK</Box>
      </Box>
    </Box>
  );
}

// =========================================================================================
// C7: TOILET INSPECTION CHECK LIST (BVC-QA-F-05)
// =========================================================================================
function C7Editor({ formState, updateForm, updateChecklist }) {
  const chk = formState.checklist || {};
  const items = chk.check_items || [];

  const handleStatusToggle = (idx, val) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], status: val };
    updateChecklist('check_items', updated);
  };

  const handleRemarkChange = (idx, remarks) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], remarks };
    updateChecklist('check_items', updated);
  };

  return (
    <Box>
      <Box sx={{ textAlign: 'center', border: '2px solid #000', p: 1.5, mb: 2 }}>
        <Typography sx={{ fontWeight: 800, fontSize: '1.15rem' }}>BVC EXPORTS PVT LTD</Typography>
        <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '0.5px' }}>
          TOILET INSPECTION CHECK LIST
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, fontSize: '0.88rem', px: 2 }}>
          <div><strong>DOC Ref :</strong> BVC-QA-F-05</div>
          <div>
            <strong>Month :</strong>{' '}
            <input
              type="text"
              value={chk.month || ''}
              onChange={(e) => updateChecklist('month', e.target.value)}
              style={{ padding: '2px 6px', border: '1px solid #ccc' }}
            />
          </div>
          <div>
            <strong>Toilet :</strong>{' '}
            <input
              type="text"
              value={formState.area_location || chk.toilet_name || ''}
              onChange={(e) => {
                updateForm('area_location', e.target.value);
                updateChecklist('toilet_name', e.target.value);
              }}
              placeholder="e.g. Block A Restroom"
              style={{ padding: '2px 6px', border: '1px solid #ccc' }}
            />
          </div>
        </Box>
      </Box>

      {/* Items Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            <th style={{ border: '2px solid #000', padding: '8px', width: '8%', textAlign: 'center' }}>Sl.No</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '45%', textAlign: 'left' }}>Check for</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '20%', textAlign: 'center' }}>Status (✓ Yes / X No)</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '27%', textAlign: 'left' }}>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={idx}>
              <td style={{ border: '2px solid #000', padding: '8px', textAlign: 'center', fontWeight: 700 }}>{it.s_no || idx + 1}</td>
              <td style={{ border: '2px solid #000', padding: '8px', fontWeight: 600 }}>{it.item}</td>
              <td style={{ border: '2px solid #000', padding: '8px', textAlign: 'center' }}>
                <select
                  value={it.status || '✓'}
                  onChange={(e) => handleStatusToggle(idx, e.target.value)}
                  style={{ padding: '4px 8px', fontWeight: 700, borderRadius: 4 }}
                >
                  <option value="✓">✓ - Yes</option>
                  <option value="X">X - No</option>
                </select>
              </td>
              <td style={{ border: '2px solid #000', padding: '8px' }}>
                <input
                  type="text"
                  value={it.remarks || ''}
                  onChange={(e) => handleRemarkChange(idx, e.target.value)}
                  style={{ width: '95%', padding: '4px 8px', border: '1px solid #ccc' }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Signatures */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>Done By: House Keeper</strong>
              <input
                type="text"
                value={formState.inspector_name || ''}
                onChange={(e) => updateForm('inspector_name', e.target.value)}
                placeholder="House Keeper Name"
                style={{ width: '90%', marginTop: 4, padding: '4px 8px', border: '1px solid #ccc' }}
              />
            </td>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>Checked by : HR MANAGER</strong>
              <input
                type="text"
                value={formState.supervisor_name || ''}
                onChange={(e) => updateForm('supervisor_name', e.target.value)}
                placeholder="HR Manager Name"
                style={{ width: '90%', marginTop: 4, padding: '4px 8px', border: '1px solid #ccc' }}
              />
            </td>
          </tr>
        </tbody>
      </table>

      <Box sx={{ border: '1px solid #000', p: 1, textAlign: 'center', bgcolor: '#fafafa', fontWeight: 700 }}>
        ✓- Yes &nbsp;&nbsp;&nbsp;&nbsp; X- No
      </Box>
    </Box>
  );
}

// =========================================================================================
// C8: VEHICLE LOADING/UNLOADING INSPECTION REPORT (BVC/QA/F/07)
// =========================================================================================
function C8Editor({ formState, updateForm, updateChecklist }) {
  const chk = formState.checklist || {};
  const points = chk.check_points || [];

  const handleToggle = (idx, isOk) => {
    const updated = [...points];
    updated[idx] = { ...updated[idx], ok: isOk, not_ok: !isOk };
    updateChecklist('check_points', updated);
  };

  const handleRemark = (idx, remarks) => {
    const updated = [...points];
    updated[idx] = { ...updated[idx], remarks };
    updateChecklist('check_points', updated);
  };

  return (
    <Box>
      <Box sx={{ textAlign: 'center', border: '2px solid #000', p: 1.5, mb: 2 }}>
        <Typography sx={{ fontWeight: 800, fontSize: '1.15rem' }}>
          VEHICLE LOADING/UN LOADING INSPECTION REPORT
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5, fontSize: '0.88rem' }}>
          <div><strong>DOC Ref :</strong> BVC/QA/F/07</div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <strong>Date :</strong>
            <input
              type="date"
              value={formState.record_date || ''}
              onChange={(e) => updateForm('record_date', e.target.value)}
              style={{ marginLeft: 6, padding: '2px 4px', border: '1px solid #ccc' }}
            />
          </div>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, fontSize: '0.88rem' }}>
          <div style={{ width: '48%', textAlign: 'left' }}>
            <strong>Customer / Qty :</strong>
            <input
              type="text"
              value={chk.customer_qty || ''}
              onChange={(e) => updateChecklist('customer_qty', e.target.value)}
              placeholder="e.g. Royal Foods Exporters / 500 Bags"
              style={{ width: '90%', marginLeft: 4, padding: '2px 6px', border: '1px solid #ccc' }}
            />
          </div>
          <div style={{ width: '48%', textAlign: 'left' }}>
            <strong>Vehicle No :</strong>
            <input
              type="text"
              value={formState.area_location || chk.vehicle_no || ''}
              onChange={(e) => {
                updateForm('area_location', e.target.value);
                updateChecklist('vehicle_no', e.target.value);
              }}
              placeholder="e.g. TN-58-AX-9912"
              style={{ width: '80%', marginLeft: 4, padding: '2px 6px', border: '1px solid #ccc', fontWeight: 700 }}
            />
          </div>
        </Box>
      </Box>

      {/* Checkpoints Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            <th style={{ border: '2px solid #000', padding: '8px', width: '8%', textAlign: 'center' }}>Sl.No</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '45%', textAlign: 'left' }}>Check for</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '10%', textAlign: 'center' }}>OK</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '10%', textAlign: 'center' }}>Not OK</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '27%', textAlign: 'left' }}>REMARKS / Vehicle No</th>
          </tr>
        </thead>
        <tbody>
          {points.map((pt, idx) => (
            <tr key={idx}>
              <td style={{ border: '2px solid #000', padding: '8px', textAlign: 'center', fontWeight: 700 }}>{pt.s_no || idx + 1}</td>
              <td style={{ border: '2px solid #000', padding: '8px', fontWeight: 600 }}>{pt.item}</td>
              <td style={{ border: '2px solid #000', padding: '8px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={Boolean(pt.ok)}
                  onChange={(e) => handleToggle(idx, e.target.checked)}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
              </td>
              <td style={{ border: '2px solid #000', padding: '8px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={Boolean(pt.not_ok)}
                  onChange={(e) => handleToggle(idx, !e.target.checked)}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
              </td>
              <td style={{ border: '2px solid #000', padding: '8px' }}>
                <input
                  type="text"
                  value={pt.remarks || ''}
                  onChange={(e) => handleRemark(idx, e.target.value)}
                  style={{ width: '95%', padding: '4px 8px', border: '1px solid #ccc' }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Signatures */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '10px 12px', width: '50%' }}>
              <strong>Checked by : (Security)</strong>
              <input
                type="text"
                value={formState.inspector_name || ''}
                onChange={(e) => updateForm('inspector_name', e.target.value)}
                placeholder="Security Officer Name"
                style={{ width: '90%', marginTop: 4, padding: '4px 8px', border: '1px solid #ccc' }}
              />
            </td>
            <td style={{ border: '2px solid #000', padding: '10px 12px', width: '50%' }}>
              <strong>Verified by : (clerk)</strong>
              <input
                type="text"
                value={formState.supervisor_name || ''}
                onChange={(e) => updateForm('supervisor_name', e.target.value)}
                placeholder="Dispatch Clerk Name"
                style={{ width: '90%', marginTop: 4, padding: '4px 8px', border: '1px solid #ccc' }}
              />
            </td>
          </tr>
        </tbody>
      </table>
    </Box>
  );
}

// =========================================================================================
// C9: FOOD HANDLERS PERSONAL HYGIENE LOG (BVC/QA/F/01)
// =========================================================================================
function C9Editor({ formState, updateForm, updateChecklist, setFormState, masterEntities }) {
  const chk = formState.checklist || {};
  const workers = chk.workers || [];

  const handleWorkerField = (idx, field, val) => {
    const updated = [...workers];
    updated[idx] = { ...updated[idx], [field]: val };
    updateChecklist('workers', updated);
  };

  const handleAddWorker = () => {
    const newWorker = {
      s_no: workers.length + 1,
      shift: '1. D',
      worker_name: '',
      area: 'Production',
      wearing_ppes: '✓',
      nail_trimming: '✓',
      free_wounds: '✓',
      no_illness: '✓',
      no_jewels: '✓',
      no_chemicals: '✓',
      no_smoking: '✓',
      remarks: 'Fit for duty',
      corrective_action: 'None'
    };
    updateChecklist('workers', [...workers, newWorker]);
  };

  const handlePopulateFromEmployeeMaster = () => {
    const activeEmps = masterEntities?.employees || [];
    if (activeEmps.length > 0) {
      const generated = activeEmps.map((emp, i) => ({
        s_no: i + 1,
        shift: emp.shift || '1. D',
        worker_name: emp.name,
        area: emp.department || 'Production',
        wearing_ppes: '✓',
        nail_trimming: '✓',
        free_wounds: '✓',
        no_illness: '✓',
        no_jewels: '✓',
        no_chemicals: '✓',
        no_smoking: '✓',
        remarks: 'Fit for duty',
        corrective_action: 'None'
      }));
      updateChecklist('workers', generated);
    }
  };

  const handleRemoveWorker = (idx) => {
    const updated = workers.filter((_, i) => i !== idx).map((w, i) => ({ ...w, s_no: i + 1 }));
    updateChecklist('workers', updated);
  };

  return (
    <Box>
      {/* Header Container */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '12px', width: '70%', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.15rem' }}>BVC EXPORTS (PVT) LTD</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', mt: 0.5 }}>
                Food Handlers Personal Hygiene Log
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '30%', fontSize: '0.82rem' }}>
              <div><strong>Form No:</strong> BVC/QA/F/01</div>
              <div><strong>Rev.No :</strong> 0</div>
              <div><strong>Date:</strong> 29.05.2017</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Date Row & Master Controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2, fontSize: '0.9rem' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <strong>Date:</strong>
          <input
            type="date"
            value={formState.record_date || ''}
            onChange={(e) => updateForm('record_date', e.target.value)}
            style={{ marginLeft: 8, padding: '4px 8px', border: '1px solid #ccc' }}
          />
        </Box>
        <Stack direction="row" spacing={1}>
          {masterEntities?.employees?.length > 0 && (
            <Button
              variant="outlined"
              size="small"
              color="secondary"
              startIcon={<GroupAddIcon />}
              onClick={handlePopulateFromEmployeeMaster}
              sx={{ fontWeight: 700 }}
            >
              👥 Import All ({masterEntities.employees.length}) Active Workers
            </Button>
          )}
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={handleAddWorker}
            sx={{ fontWeight: 700 }}
          >
            Add Worker
          </Button>
        </Stack>
      </Box>

      {/* Workers Hygiene Table */}
      <TableContainer sx={{ maxHeight: 600, border: '2px solid #000', mb: 2 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>Sl. No</th>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>Shift</th>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: '4px', textAlign: 'left', minWidth: 110 }}>Worker Name</th>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: '4px', textAlign: 'left', minWidth: 80 }}>Area</th>
              <th colSpan={7} style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', background: '#e2e8f0' }}>
                ✓-ok &nbsp;&nbsp; X- Not Ok
              </th>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: '4px', textAlign: 'left', minWidth: 80 }}>Remarks</th>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: '4px', textAlign: 'left', minWidth: 80 }}>Corrective Action</th>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>Action</th>
            </tr>
            <tr style={{ background: '#f8fafc', fontSize: '0.72rem' }}>
              <th style={{ border: '1px solid #000', padding: '4px', maxWidth: 65 }}>Wearing PPEs (Head Cover/Mask)</th>
              <th style={{ border: '1px solid #000', padding: '4px', maxWidth: 75 }}>Nail Trimming / No discharge</th>
              <th style={{ border: '1px solid #000', padding: '4px', maxWidth: 65 }}>Free from Visible wounds</th>
              <th style={{ border: '1px solid #000', padding: '4px', maxWidth: 75 }}>No symptoms illness / cold</th>
              <th style={{ border: '1px solid #000', padding: '4px', maxWidth: 70 }}>No exposed jewels</th>
              <th style={{ border: '1px solid #000', padding: '4px', maxWidth: 75 }}>No mehendi / ointments</th>
              <th style={{ border: '1px solid #000', padding: '4px', maxWidth: 65 }}>No Smoking / chewing</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((w, idx) => (
              <tr key={idx}>
                <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontWeight: 700 }}>{w.s_no || idx + 1}</td>
                <td style={{ border: '1px solid #000', padding: '4px' }}>
                  <input
                    type="text"
                    value={w.shift || '1. D'}
                    onChange={(e) => handleWorkerField(idx, 'shift', e.target.value)}
                    style={{ width: '100%', padding: '2px', textAlign: 'center' }}
                  />
                </td>
                <td style={{ border: '1px solid #000', padding: '4px' }}>
                  <input
                    type="text"
                    value={w.worker_name || ''}
                    onChange={(e) => handleWorkerField(idx, 'worker_name', e.target.value)}
                    placeholder="Worker Name"
                    style={{ width: '100%', padding: '2px' }}
                  />
                </td>
                <td style={{ border: '1px solid #000', padding: '4px' }}>
                  <input
                    type="text"
                    value={w.area || ''}
                    onChange={(e) => handleWorkerField(idx, 'area', e.target.value)}
                    placeholder="Area"
                    style={{ width: '100%', padding: '2px' }}
                  />
                </td>
                {['wearing_ppes', 'nail_trimming', 'free_wounds', 'no_illness', 'no_jewels', 'no_chemicals', 'no_smoking'].map((f) => (
                  <td key={f} style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }}>
                    <select
                      value={w[f] || '✓'}
                      onChange={(e) => handleWorkerField(idx, f, e.target.value)}
                      style={{ padding: '2px', fontWeight: 700 }}
                    >
                      <option value="✓">✓</option>
                      <option value="X">X</option>
                    </select>
                  </td>
                ))}
                <td style={{ border: '1px solid #000', padding: '4px' }}>
                  <input
                    type="text"
                    value={w.remarks || ''}
                    onChange={(e) => handleWorkerField(idx, 'remarks', e.target.value)}
                    style={{ width: '100%', padding: '2px' }}
                  />
                </td>
                <td style={{ border: '1px solid #000', padding: '4px' }}>
                  <input
                    type="text"
                    value={w.corrective_action || ''}
                    onChange={(e) => handleWorkerField(idx, 'corrective_action', e.target.value)}
                    style={{ width: '100%', padding: '2px' }}
                  />
                </td>
                <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }}>
                  <IconButton size="small" color="error" onClick={() => handleRemoveWorker(idx)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableContainer>

      {/* Signatures */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>CheckedBy : QMR</strong>
              <input
                type="text"
                value={formState.inspector_name || ''}
                onChange={(e) => updateForm('inspector_name', e.target.value)}
                placeholder="QMR Name"
                style={{ width: '90%', marginTop: 4, padding: '4px 8px', border: '1px solid #ccc' }}
              />
            </td>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>Approved By : Managing Director</strong>
              <input
                type="text"
                value={formState.supervisor_name || ''}
                onChange={(e) => updateForm('supervisor_name', e.target.value)}
                placeholder="Managing Director Name"
                style={{ width: '90%', marginTop: 4, padding: '4px 8px', border: '1px solid #ccc' }}
              />
            </td>
          </tr>
        </tbody>
      </table>
    </Box>
  );
}

// =========================================================================================
// C10: PRIMARY PACKING MATERIAL INSPECTION RECORD (PPMI)
// =========================================================================================
function C10Editor({ formState, updateForm, updateChecklist, masterEntities }) {
  const chk = formState.checklist || {};
  const params = chk.parameters || [];

  const handleParamChange = (idx, field, val) => {
    const updated = [...params];
    updated[idx] = { ...updated[idx], [field]: val };
    updateChecklist('parameters', updated);
  };

  const handlePurchaseSelect = (invNo) => {
    const found = (masterEntities?.purchases || []).find(p => p.invoice_no === invNo);
    if (found) {
      updateChecklist('invoice_no', found.invoice_no);
      if (found.supplier) updateChecklist('supplier', found.supplier);
      if (found.inv_date) updateForm('record_date', found.inv_date);
    }
  };

  return (
    <Box>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '12px', width: '38%', verticalAlign: 'middle', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: '#000' }}>
                BVC EXPORTS PRIVATE LIMITED
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '8px', width: '37%', verticalAlign: 'middle', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: '#000', textTransform: 'uppercase' }}>
                PRIMARY PACKING<br />MATERIAL INSPECTION<br />RECORD
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 10px', width: '25%', verticalAlign: 'top', fontSize: '0.82rem' }}>
              <div><strong>PPMI :</strong> <input type="text" value={chk.ppmi_no || ''} onChange={(e) => updateChecklist('ppmi_no', e.target.value)} style={{ width: '60%', border: '1px solid #ccc', padding: '2px' }} /></div>
              <div style={{ marginTop: 2 }}><strong>DATE :</strong> <input type="date" value={formState.record_date || ''} onChange={(e) => updateForm('record_date', e.target.value)} style={{ border: '1px solid #ccc', padding: '2px' }} /></div>
              <div style={{ marginTop: 2 }}><strong>SUPPLIER :</strong> <input type="text" value={chk.supplier || ''} onChange={(e) => updateChecklist('supplier', e.target.value)} style={{ width: '60%', border: '1px solid #ccc', padding: '2px' }} /></div>
              <div style={{ marginTop: 2 }}><strong>INVOICE NO :</strong> <input type="text" value={chk.invoice_no || ''} onChange={(e) => updateChecklist('invoice_no', e.target.value)} style={{ width: '55%', border: '1px solid #ccc', padding: '2px' }} /></div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Date & Time Row */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '6px 12px', width: '50%' }}>
              <strong>Date:</strong> {formState.record_date}
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 12px', width: '50%' }}>
              <strong>Time :</strong>{' '}
              <input
                type="text"
                value={chk.time || ''}
                onChange={(e) => updateChecklist('time', e.target.value)}
                placeholder="e.g. 10:30 AM"
                style={{ border: '1px solid #ccc', padding: '2px 6px' }}
              />
            </td>
          </tr>
        </tbody>
      </table>

      {/* Parameters Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            <th style={{ border: '2px solid #000', padding: '8px', width: '8%', textAlign: 'center' }}>S.NO</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '25%', textAlign: 'left' }}>PARAMETERS</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '32%', textAlign: 'left' }}>STD WITH TOLORANCE</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '20%', textAlign: 'left' }}>OBSERVATIONS</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '15%', textAlign: 'left' }}>ACTION TAKEN</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p, idx) => (
            <tr key={idx}>
              <td style={{ border: '2px solid #000', padding: '8px', textAlign: 'center', fontWeight: 700 }}>{p.s_no || idx + 1}</td>
              <td style={{ border: '2px solid #000', padding: '8px', fontWeight: 600 }}>{p.parameter}</td>
              <td style={{ border: '2px solid #000', padding: '8px' }}>
                <input
                  type="text"
                  value={p.std_tolerance || ''}
                  onChange={(e) => handleParamChange(idx, 'std_tolerance', e.target.value)}
                  style={{ width: '95%', padding: '4px 6px', border: '1px solid #ccc' }}
                />
              </td>
              <td style={{ border: '2px solid #000', padding: '8px' }}>
                <input
                  type="text"
                  value={p.observations || ''}
                  onChange={(e) => handleParamChange(idx, 'observations', e.target.value)}
                  style={{ width: '95%', padding: '4px 6px', border: '1px solid #ccc' }}
                />
              </td>
              <td style={{ border: '2px solid #000', padding: '8px' }}>
                <input
                  type="text"
                  value={p.action_taken || ''}
                  onChange={(e) => handleParamChange(idx, 'action_taken', e.target.value)}
                  style={{ width: '95%', padding: '4px 6px', border: '1px solid #ccc' }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Signatures */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>Prepared By</strong>
              <input
                type="text"
                value={formState.inspector_name || ''}
                onChange={(e) => updateForm('inspector_name', e.target.value)}
                placeholder="QC Inspector Name"
                style={{ width: '90%', marginTop: 4, padding: '4px 8px', border: '1px solid #ccc' }}
              />
            </td>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>Approved By</strong>
              <input
                type="text"
                value={formState.supervisor_name || ''}
                onChange={(e) => updateForm('supervisor_name', e.target.value)}
                placeholder="QA Head Name"
                style={{ width: '90%', marginTop: 4, padding: '4px 8px', border: '1px solid #ccc' }}
              />
            </td>
          </tr>
        </tbody>
      </table>
    </Box>
  );
}

// =========================================================================================
// C11: GLASS AND PLASTIC CONTROL CHECKLIST (BVC/QA/F/03)
// =========================================================================================
function C11Editor({ formState, updateForm, updateChecklist }) {
  const chk = formState.checklist || {};
  const params = chk.parameters || [];

  const handleParamChange = (idx, field, val) => {
    const updated = [...params];
    updated[idx] = { ...updated[idx], [field]: val };
    updateChecklist('parameters', updated);
  };

  return (
    <Box>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '12px', width: '38%', verticalAlign: 'middle', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: '#000' }}>
                BVC EXPORTS PRIVATE LIMITED
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '8px', width: '37%', verticalAlign: 'middle', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: '#000', textTransform: 'uppercase' }}>
                GLASS AND PLASTIC<br />CONTROL CHECKLIST
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 10px', width: '25%', verticalAlign: 'top', fontSize: '0.82rem' }}>
              <div><strong>BVC/QA/F/03</strong></div>
              <div><strong>Rev.No./Date :</strong> 00/29.05.2017</div>
              <div><strong>Page no :</strong> 1 of 1</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Date/shift and Time */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '6px 12px', width: '50%' }}>
              <strong>Date /shift :</strong>{' '}
              <input
                type="text"
                value={chk.shift || 'Day Shift'}
                onChange={(e) => updateChecklist('shift', e.target.value)}
                style={{ border: '1px solid #ccc', padding: '2px 6px' }}
              />
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 12px', width: '50%' }}>
              <strong>Time :</strong>{' '}
              <input
                type="text"
                value={chk.time || '09:00 AM'}
                onChange={(e) => updateChecklist('time', e.target.value)}
                style={{ border: '1px solid #ccc', padding: '2px 6px' }}
              />
            </td>
          </tr>
        </tbody>
      </table>

      {/* Parameters Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            <th style={{ border: '2px solid #000', padding: '6px', width: '6%', textAlign: 'center' }}>Sl.no</th>
            <th style={{ border: '2px solid #000', padding: '6px', width: '42%', textAlign: 'left' }}>PARAMETERS</th>
            <th style={{ border: '2px solid #000', padding: '6px', width: '10%', textAlign: 'center' }}>Checklist</th>
            <th style={{ border: '2px solid #000', padding: '6px', width: '12%', textAlign: 'center' }}>Conditions</th>
            <th style={{ border: '2px solid #000', padding: '6px', width: '15%', textAlign: 'left' }}>OBSERVATIONS</th>
            <th style={{ border: '2px solid #000', padding: '6px', width: '15%', textAlign: 'left' }}>ACTION TAKEN</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p, idx) => (
            <tr key={idx}>
              <td style={{ border: '2px solid #000', padding: '6px', textAlign: 'center', fontWeight: 700 }}>{p.s_no || idx + 1}</td>
              <td style={{ border: '2px solid #000', padding: '6px', fontSize: '0.84rem' }}>{p.parameter}</td>
              <td style={{ border: '2px solid #000', padding: '6px', textAlign: 'center' }}>
                <select
                  value={p.checklist || 'Y'}
                  onChange={(e) => handleParamChange(idx, 'checklist', e.target.value)}
                  style={{ padding: '2px 4px', fontWeight: 700 }}
                >
                  <option value="Y">Y</option>
                  <option value="N">N</option>
                </select>
              </td>
              <td style={{ border: '2px solid #000', padding: '6px', textAlign: 'center' }}>
                <select
                  value={p.condition || 'O.K'}
                  onChange={(e) => handleParamChange(idx, 'condition', e.target.value)}
                  style={{ padding: '2px 4px', fontWeight: 700 }}
                >
                  <option value="O.K">O.K</option>
                  <option value="IR">IR</option>
                  <option value="NI">NI</option>
                </select>
              </td>
              <td style={{ border: '2px solid #000', padding: '6px' }}>
                <input
                  type="text"
                  value={p.observations || ''}
                  onChange={(e) => handleParamChange(idx, 'observations', e.target.value)}
                  style={{ width: '95%', padding: '2px 4px', border: '1px solid #ccc' }}
                />
              </td>
              <td style={{ border: '2px solid #000', padding: '6px' }}>
                <input
                  type="text"
                  value={p.action_taken || ''}
                  onChange={(e) => handleParamChange(idx, 'action_taken', e.target.value)}
                  style={{ width: '95%', padding: '2px 4px', border: '1px solid #ccc' }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Box sx={{ border: '1px solid #000', p: 1, mb: 2, fontSize: '0.8rem', bgcolor: '#fafafa' }}>
        <strong>Conditions :</strong> IR - immediate repair required &nbsp;|&nbsp; NI : Check at next inspection &nbsp;|&nbsp; O.K- no problem noted
      </Box>

      {/* Signatures */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000' }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>PREPARED BY</strong>
              <input
                type="text"
                value={formState.inspector_name || ''}
                onChange={(e) => updateForm('inspector_name', e.target.value)}
                placeholder="Prepared By Name"
                style={{ width: '90%', marginTop: 4, padding: '4px 8px', border: '1px solid #ccc' }}
              />
            </td>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>APPROVED BY</strong>
              <input
                type="text"
                value={formState.supervisor_name || ''}
                onChange={(e) => updateForm('supervisor_name', e.target.value)}
                placeholder="Approved By Name"
                style={{ width: '90%', marginTop: 4, padding: '4px 8px', border: '1px solid #ccc' }}
              />
            </td>
          </tr>
        </tbody>
      </table>
    </Box>
  );
}

// =========================================================================================
// C12: PLASTIC PALLET CONTROL CHECKLIST (BVC/QA/F/04)
// =========================================================================================
function C12Editor({ formState, updateForm, updateChecklist }) {
  const chk = formState.checklist || {};
  const params = chk.parameters || [];

  const handleParamChange = (idx, field, val) => {
    const updated = [...params];
    updated[idx] = { ...updated[idx], [field]: val };
    updateChecklist('parameters', updated);
  };

  return (
    <Box>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '12px', width: '38%', verticalAlign: 'middle', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: '#000' }}>
                BVC EXPORTS PRIVATE LIMITED
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '8px', width: '37%', verticalAlign: 'middle', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: '#000', textTransform: 'uppercase' }}>
                PLASTIC PALLET CONTROL<br />CHECKLIST
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 10px', width: '25%', verticalAlign: 'top', fontSize: '0.82rem' }}>
              <div><strong>BVC/QA/F/04</strong></div>
              <div><strong>Rev.No./Date :</strong> 00/29.05.2017</div>
              <div><strong>Page no :</strong> 1 of 1</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Date/shift and Time */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '6px 12px', width: '50%' }}>
              <strong>Date /shift :</strong>{' '}
              <input
                type="text"
                value={chk.shift || 'Day Shift'}
                onChange={(e) => updateChecklist('shift', e.target.value)}
                style={{ border: '1px solid #ccc', padding: '2px 6px' }}
              />
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 12px', width: '50%' }}>
              <strong>Time :</strong>{' '}
              <input
                type="text"
                value={chk.time || '09:30 AM'}
                onChange={(e) => updateChecklist('time', e.target.value)}
                style={{ border: '1px solid #ccc', padding: '2px 6px' }}
              />
            </td>
          </tr>
        </tbody>
      </table>

      {/* Parameters Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            <th style={{ border: '2px solid #000', padding: '6px', width: '6%', textAlign: 'center' }}>Sl.no</th>
            <th style={{ border: '2px solid #000', padding: '6px', width: '46%', textAlign: 'left' }}>PARAMETERS</th>
            <th style={{ border: '2px solid #000', padding: '6px', width: '14%', textAlign: 'center' }}>STD WITH TOLERANCE</th>
            <th style={{ border: '2px solid #000', padding: '6px', width: '17%', textAlign: 'left' }}>OBSERVATIONS</th>
            <th style={{ border: '2px solid #000', padding: '6px', width: '17%', textAlign: 'left' }}>ACTION TAKEN</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p, idx) => (
            <tr key={idx}>
              <td style={{ border: '2px solid #000', padding: '6px', textAlign: 'center', fontWeight: 700 }}>{p.s_no || idx + 1}</td>
              <td style={{ border: '2px solid #000', padding: '6px', fontSize: '0.84rem' }}>{p.parameter}</td>
              <td style={{ border: '2px solid #000', padding: '6px', textAlign: 'center' }}>
                <select
                  value={p.std_tolerance || 'Y'}
                  onChange={(e) => handleParamChange(idx, 'std_tolerance', e.target.value)}
                  style={{ padding: '2px 4px', fontWeight: 700 }}
                >
                  <option value="Y">Y</option>
                  <option value="N">N</option>
                </select>
              </td>
              <td style={{ border: '2px solid #000', padding: '6px' }}>
                <input
                  type="text"
                  value={p.observations || ''}
                  onChange={(e) => handleParamChange(idx, 'observations', e.target.value)}
                  style={{ width: '95%', padding: '2px 4px', border: '1px solid #ccc' }}
                />
              </td>
              <td style={{ border: '2px solid #000', padding: '6px' }}>
                <input
                  type="text"
                  value={p.action_taken || ''}
                  onChange={(e) => handleParamChange(idx, 'action_taken', e.target.value)}
                  style={{ width: '95%', padding: '2px 4px', border: '1px solid #ccc' }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Box sx={{ border: '1px solid #000', p: 1, mb: 2, fontSize: '0.8rem', bgcolor: '#fafafa' }}>
        <strong>Conditions:</strong> IR - immediate repair required &nbsp;|&nbsp; NI: Check at next inspection &nbsp;|&nbsp; O.K-no problem noted
      </Box>

      {/* Signatures */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000' }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>PREPARED BY</strong>
              <input
                type="text"
                value={formState.inspector_name || ''}
                onChange={(e) => updateForm('inspector_name', e.target.value)}
                placeholder="Prepared By Name"
                style={{ width: '90%', marginTop: 4, padding: '4px 8px', border: '1px solid #ccc' }}
              />
            </td>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>APPROVED BY</strong>
              <input
                type="text"
                value={formState.supervisor_name || ''}
                onChange={(e) => updateForm('supervisor_name', e.target.value)}
                placeholder="Approved By Name"
                style={{ width: '90%', marginTop: 4, padding: '4px 8px', border: '1px solid #ccc' }}
              />
            </td>
          </tr>
        </tbody>
      </table>
    </Box>
  );
}

// =========================================================================================
// C13: ROUTINE RODENT BAIT MONITORING RECORD (INTERNAL & OUTSIDE) (BVC/QA/F/10)
// =========================================================================================
function C13Editor({ formState, updateForm, updateChecklist }) {
  const chk = formState.checklist || {};
  const internal = chk.internal_stations || [];
  const outside = chk.outside_stations || [];

  return (
    <Box>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '12px', width: '70%', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.1rem' }}>BVC EXPORTS PVT LIMITED</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                Routine Rodent bait Monitoring Record - Internal & Outside
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 10px', width: '30%', fontSize: '0.82rem' }}>
              <div><strong>Rec No :</strong> BVC/QA/F/10</div>
              <div><strong>Rev No:</strong> 01</div>
              <div><strong>Rev.Date:</strong> 01.01.2023</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Meta Row */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '6px 12px', width: '33%' }}>
              <strong>Month-</strong>{' '}
              <input
                type="text"
                value={chk.month || ''}
                onChange={(e) => updateChecklist('month', e.target.value)}
                style={{ border: '1px solid #ccc', padding: '2px 6px' }}
              />
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 12px', width: '33%' }}>
              <strong>Prepared By:</strong> Vasu
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 12px', width: '34%' }}>
              <strong>Approved By (FSTL):</strong> Mr. Sasikumar
            </td>
          </tr>
        </tbody>
      </table>

      {/* Section 1: Internal */}
      <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', bgcolor: '#e2e8f0', p: 1, border: '1px solid #000' }}>
        Routine Rodent bait Monitoring Record-Internal (Rodent Trap station internal of the factory premises)
      </Typography>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 8 }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th style={{ border: '1px solid #000', padding: '6px', width: '30%' }}>Trap Station No</th>
            <th style={{ border: '1px solid #000', padding: '6px', width: '70%' }}>Status Summary</th>
          </tr>
        </thead>
        <tbody>
          {internal.map((st, idx) => (
            <tr key={idx}>
              <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 700 }}>{st.station_no}</td>
              <td style={{ border: '1px solid #000', padding: '6px' }}>{st.status_summary}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Box sx={{ border: '1px solid #000', p: 1, mb: 2 }}>
        <strong>CAPA (Internal) :</strong>{' '}
        <input
          type="text"
          value={chk.internal_capa || ''}
          onChange={(e) => updateChecklist('internal_capa', e.target.value)}
          style={{ width: '80%', padding: '4px', border: '1px solid #ccc' }}
        />
      </Box>

      {/* Section 2: Outside */}
      <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', bgcolor: '#e2e8f0', p: 1, border: '1px solid #000' }}>
        Routine Rodent bait Monitoring Record-Outside
      </Typography>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 8 }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th style={{ border: '1px solid #000', padding: '6px', width: '30%' }}>Bait Station No</th>
            <th style={{ border: '1px solid #000', padding: '6px', width: '70%' }}>Status Summary</th>
          </tr>
        </thead>
        <tbody>
          {outside.map((st, idx) => (
            <tr key={idx}>
              <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 700 }}>{st.station_no}</td>
              <td style={{ border: '1px solid #000', padding: '6px' }}>{st.status_summary}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Box sx={{ border: '1px solid #000', p: 1, mb: 2 }}>
        <strong>CAPA (Outside) :</strong>{' '}
        <input
          type="text"
          value={chk.outside_capa || ''}
          onChange={(e) => updateChecklist('outside_capa', e.target.value)}
          style={{ width: '80%', padding: '4px', border: '1px solid #ccc' }}
        />
      </Box>

      <Box sx={{ border: '1px solid #000', p: 1, display: 'flex', justifyContent: 'space-between', bgcolor: '#fafafa' }}>
        <div><strong>Verified By :</strong> Vasu (Pest Officer)</div>
        <div><strong>QA Manager :</strong> Mr. Sasikumar</div>
      </Box>
    </Box>
  );
}

// =========================================================================================
// C14: ROUTINE / PREVENTIVE MAINTENANCE CHECKLIST (BVC/MNTF/03)
// =========================================================================================
function C14Editor({ formState, updateForm, updateChecklist }) {
  const chk = formState.checklist || {};
  const criteria = chk.criteria || [];

  const handleRemarkChange = (idx, remarks) => {
    const updated = [...criteria];
    updated[idx] = { ...updated[idx], remarks };
    updateChecklist('criteria', updated);
  };

  return (
    <Box>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '12px', width: '60%', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>BVC EXPORTS PRIVATE LIMITED</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: '1rem', mt: 0.5 }}>
                ROUTINE/PREVENTIVE MAINTENANCE CHECKLIST
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '40%', fontSize: '0.82rem' }}>
              <div><strong>FORMAL NUMBER :</strong> BVC/MNTF/03</div>
              <div style={{ marginTop: 4 }}>
                <strong>REV.NO/DATE :</strong>{' '}
                <input
                  type="date"
                  value={formState.record_date || ''}
                  onChange={(e) => updateForm('record_date', e.target.value)}
                  style={{ border: '1px solid #ccc', padding: '2px' }}
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Machine & Operator Meta */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '6px 12px', width: '33%' }}>
              <strong>M/C NO :</strong>{' '}
              <input
                type="text"
                value={chk.machine_no || ''}
                onChange={(e) => updateChecklist('machine_no', e.target.value)}
                placeholder="e.g. MCH-MIL-01"
                style={{ border: '1px solid #ccc', padding: '2px 6px', width: '65%' }}
              />
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 12px', width: '33%' }}>
              <strong>M/C NAME :</strong>{' '}
              <input
                type="text"
                value={formState.area_location || chk.machine_name || ''}
                onChange={(e) => {
                  updateForm('area_location', e.target.value);
                  updateChecklist('machine_name', e.target.value);
                }}
                placeholder="e.g. Pulse Hammer Mill"
                style={{ border: '1px solid #ccc', padding: '2px 6px', width: '65%' }}
              />
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 12px', width: '34%' }}>
              <strong>OPERATOR NAME :</strong>{' '}
              <input
                type="text"
                value={formState.inspector_name || chk.operator_name || ''}
                onChange={(e) => {
                  updateForm('inspector_name', e.target.value);
                  updateChecklist('operator_name', e.target.value);
                }}
                placeholder="e.g. Murugan K"
                style={{ border: '1px solid #ccc', padding: '2px 6px', width: '60%' }}
              />
            </td>
          </tr>
        </tbody>
      </table>

      {/* Criteria Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 16 }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            <th style={{ border: '2px solid #000', padding: '8px', width: '8%', textAlign: 'center' }}>Sl.No</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '40%', textAlign: 'left' }}>Criteria</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '18%', textAlign: 'center' }}>Frequency</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '34%', textAlign: 'left' }}>Observations & Remarks</th>
          </tr>
        </thead>
        <tbody>
          {criteria.map((c, idx) => (
            <tr key={idx}>
              <td style={{ border: '2px solid #000', padding: '8px', textAlign: 'center', fontWeight: 700 }}>{c.s_no || idx + 1}</td>
              <td style={{ border: '2px solid #000', padding: '8px', fontWeight: 600 }}>{c.criteria}</td>
              <td style={{ border: '2px solid #000', padding: '8px', textAlign: 'center' }}>
                <Chip label={c.frequency} size="small" color={c.frequency === 'Daily' ? 'primary' : c.frequency === 'Weekly' ? 'warning' : 'secondary'} />
              </td>
              <td style={{ border: '2px solid #000', padding: '8px' }}>
                <input
                  type="text"
                  value={c.remarks || ''}
                  onChange={(e) => handleRemarkChange(idx, e.target.value)}
                  style={{ width: '95%', padding: '4px 8px', border: '1px solid #ccc' }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Signatures */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000' }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>Checked by - Operator</strong>
              <input
                type="text"
                value={formState.inspector_name || ''}
                onChange={(e) => updateForm('inspector_name', e.target.value)}
                placeholder="Operator Name"
                style={{ width: '90%', marginTop: 4, padding: '4px 8px', border: '1px solid #ccc' }}
              />
            </td>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>Approved by: Plant Incharge</strong>
              <input
                type="text"
                value={formState.supervisor_name || ''}
                onChange={(e) => updateForm('supervisor_name', e.target.value)}
                placeholder="Plant Incharge Name"
                style={{ width: '90%', marginTop: 4, padding: '4px 8px', border: '1px solid #ccc' }}
              />
            </td>
          </tr>
        </tbody>
      </table>
    </Box>
  );
}
