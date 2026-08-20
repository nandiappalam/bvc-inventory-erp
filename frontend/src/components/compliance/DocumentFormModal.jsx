import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  MenuItem,
  Typography,
  Box,
  Divider,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

const DOC_CONFIGS = {
  D1: { title: 'Work Instruction File', defaultPrefix: 'WI', defaultDept: 'Production' },
  D2: { title: 'Hazard / CCP / OPRP / VACCP Plan', defaultPrefix: 'HACCP', defaultDept: 'Quality Assurance' },
  D3: { title: 'MTR Signed Specification', defaultPrefix: 'MTR', defaultDept: 'Quality Assurance' },
  D4: { title: 'Training Record', defaultPrefix: 'TRN', defaultDept: 'Human Resources & QA' },
  D5: { title: 'SOPs Repository', defaultPrefix: 'SOP', defaultDept: 'Operations' },
  D6: { title: 'RCCA Record (Root Cause & CAPA)', defaultPrefix: 'RCCA', defaultDept: 'Quality & Maintenance' },
  D7: { title: 'Medical Fitness Certificate', defaultPrefix: 'MED', defaultDept: 'Occupational Health' },
  D8: { title: 'FOSTAC Training Certificate', defaultPrefix: 'FOSTAC', defaultDept: 'Food Safety' },
  D9: { title: 'Recall / Withdraw System', defaultPrefix: 'REC', defaultDept: 'Crisis Management' },
  D10: { title: 'Halal Declaration', defaultPrefix: 'HALAL', defaultDept: 'Export QA' },
  D11: { title: 'Process Flow Chart', defaultPrefix: 'PFC', defaultDept: 'Engineering & QA' },
};

export default function DocumentFormModal({ open, docCode = 'D1', initialData = null, onClose, onSaved }) {
  const isEditing = Boolean(initialData && initialData.id);
  const currentDocConfig = DOC_CONFIGS[docCode] || DOC_CONFIGS.D1;

  // Master Data State for Auto-fill
  const [itemsList, setItemsList] = useState([]);
  const [suppliersList, setSuppliersList] = useState([]);
  const [loadingMasters, setLoadingMasters] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    doc_code: docCode,
    doc_type: docCode,
    doc_number: `${currentDocConfig.defaultPrefix}-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    title: '',
    department: currentDocConfig.defaultDept,
    process_stage: '',
    version: '1.0',
    status: 'APPROVED',
    effective_date: new Date().toISOString().split('T')[0],
    review_date: '',
    prepared_by: '',
    approved_by: '',
    verified_by: '',
    item_id: '',
    item_name: '',
    lot_no: '',
    supplier_id: '',
    supplier_name: '',
    employee_name: '',
    remarks: '',
  });

  // Specialized Sub-data states
  const [hazardsList, setHazardsList] = useState([
    { process_step: 'Receiving & Inspection', hazard_type: 'Physical/Biological', hazard_desc: 'Stones, Dust, Infestation', control_category: 'OPRP-1', critical_limit: 'Moisture < 12%, Foreign matter < 1%', monitoring_freq: 'Every Lot', corrective_action: 'Quarantine or Reject' }
  ]);

  const [specsList, setSpecsList] = useState([
    { parameter: 'Moisture', standard_limit: 'Max 12.0 %', test_method: 'IS 4333 (Part 2)', category: 'Physical' },
    { parameter: 'Foreign Matter', standard_limit: 'Max 1.0 %', test_method: 'IS 4333 (Part 1)', category: 'Physical' },
    { parameter: 'Damaged Grains', standard_limit: 'Max 3.0 %', test_method: 'IS 4333 (Part 1)', category: 'Physical' },
  ]);

  const [trainingAttendees, setTrainingAttendees] = useState([
    { employee_name: '', emp_id: '', designation: '', evaluation_score: '', status: 'Passed' }
  ]);

  const [fiveWhySteps, setFiveWhySteps] = useState([
    'Why 1: Problem observed',
    'Why 2: Direct cause',
    'Why 3: Underlying factor',
    'Why 4: System gap',
    'Why 5: Root cause'
  ]);

  const [wiSteps, setWiSteps] = useState([
    { step_no: 1, action: 'Initial Pre-Inspection', control: 'Verify raw material bag condition and seal' },
    { step_no: 2, action: 'Processing / Destoning', control: 'Check rare earth magnet ≥ 10,000 Gauss' },
  ]);

  const [processStages, setProcessStages] = useState([
    { stage_no: 1, name: 'Raw Material Inward & QC (P1)', type: 'Receiving', ccp_type: 'OPRP-1', parameters: 'Moisture & Foreign Matter' },
    { stage_no: 2, name: 'Pre-Cleaning & Destoning', type: 'Cleaning', ccp_type: 'CCP-1', parameters: 'Stone rejection 100%' },
    { stage_no: 3, name: 'Grinding / Milling', type: 'Grinding', ccp_type: 'PRP', parameters: 'Temperature < 45°C' },
    { stage_no: 4, name: 'Sifting & Bagging (P3, P4)', type: 'Packing', ccp_type: 'CCP-2', parameters: 'Mesh integrity & Metal Detection' }
  ]);

  // Load Masters for Smart Auto-population
  useEffect(() => {
    const loadMasters = async () => {
      setLoadingMasters(true);
      try {
        const [itemsRes, suppliersRes] = await Promise.all([
          fetch('/api/masters/items').then(r => r.json()),
          fetch('/api/masters/suppliers').then(r => r.json()),
        ]);
        if (itemsRes.data) setItemsList(itemsRes.data);
        if (suppliersRes.data) setSuppliersList(suppliersRes.data);
      } catch (err) {
        console.error('Error loading masters:', err);
      } finally {
        setLoadingMasters(false);
      }
    };
    loadMasters();
  }, []);

  // Initialize form when opening or editing
  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        item_id: initialData.item_id || '',
        item_name: initialData.item_name || '',
        lot_no: initialData.lot_no || '',
        supplier_id: initialData.supplier_id || '',
        supplier_name: initialData.supplier_name || '',
        employee_name: initialData.employee_name || '',
        remarks: initialData.remarks || '',
      });

      const details = initialData.details || {};
      if (details.hazards) setHazardsList(details.hazards);
      if (details.parameters) setSpecsList(details.parameters);
      if (details.attendees) setTrainingAttendees(details.attendees);
      if (details.five_why_analysis) setFiveWhySteps(details.five_why_analysis);
      if (details.steps) setWiSteps(details.steps);
      if (details.stages) setProcessStages(details.stages);
    } else {
      const cfg = DOC_CONFIGS[docCode] || DOC_CONFIGS.D1;
      setFormData({
        doc_code: docCode,
        doc_type: docCode,
        doc_number: `${cfg.defaultPrefix}-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
        title: `${cfg.title} - ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`,
        department: cfg.defaultDept,
        process_stage: '',
        version: '1.0',
        status: 'APPROVED',
        effective_date: new Date().toISOString().split('T')[0],
        review_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
        prepared_by: 'QA Executive',
        approved_by: 'Plant Head / Director',
        verified_by: '',
        item_id: '',
        item_name: '',
        lot_no: '',
        supplier_id: '',
        supplier_name: '',
        employee_name: '',
        remarks: `Controlled Quality Document under ${docCode}.`,
      });
    }
  }, [docCode, initialData]);

  const handleItemSelect = (e) => {
    const selectedName = e.target.value;
    const found = itemsList.find(i => i.name === selectedName);
    setFormData(prev => ({
      ...prev,
      item_name: selectedName,
      item_id: found ? found.id : '',
      title: prev.title.includes(' - ') ? `${currentDocConfig.title} - ${selectedName}` : prev.title
    }));
  };

  const handleSupplierSelect = (e) => {
    const selectedName = e.target.value;
    const found = suppliersList.find(s => (s.supplier_name || s.name) === selectedName);
    setFormData(prev => ({
      ...prev,
      supplier_name: selectedName,
      supplier_id: found ? found.id : '',
    }));
  };

  const handleSave = async () => {
    if (!formData.doc_number || !formData.title) {
      alert('Please fill Doc Number and Title');
      return;
    }

    // Build specialized details JSON object based on docCode
    let detailsObj = {};
    if (docCode === 'D1') {
      detailsObj = { steps: wiSteps, safety_precautions: ['Hairnet & mask mandatory', 'Check magnets pre-shift'] };
    } else if (docCode === 'D2') {
      detailsObj = { hazards: hazardsList };
    } else if (docCode === 'D3') {
      detailsObj = { parameters: specsList, standard: 'FSSAI Standards 2026' };
    } else if (docCode === 'D4') {
      detailsObj = { attendees: trainingAttendees, trainer: formData.prepared_by };
    } else if (docCode === 'D5') {
      detailsObj = { scope: 'Factory-wide', procedure_steps: wiSteps.map(s => s.action) };
    } else if (docCode === 'D6') {
      detailsObj = { five_why_analysis: fiveWhySteps, immediate_correction: 'Immediate isolation & quarantine', corrective_action: 'Machine recalibration & SOP update' };
    } else if (docCode === 'D7') {
      detailsObj = { tests_conducted: ['Widal (Typhoid)', 'Chest X-Ray', 'Skin Screening'], fit_for_food_handling: true };
    } else if (docCode === 'D8') {
      detailsObj = { course_name: 'Advanced Manufacturing Food Safety Supervisor', cert_number: formData.doc_number };
    } else if (docCode === 'D9') {
      detailsObj = { recall_classification: 'Class II', reason: formData.remarks };
    } else if (docCode === 'D10') {
      detailsObj = { products_covered: [formData.item_name || 'All Pulses & Flours'], source_materials: '100% Plant Derived Vegetarian Food Grains' };
    } else if (docCode === 'D11') {
      detailsObj = { stages: processStages };
    }

    const payload = {
      ...formData,
      details: detailsObj,
    };

    try {
      const url = isEditing ? `/api/compliance/documents/${initialData.id}` : '/api/compliance/documents';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        if (onSaved) onSaved();
      } else {
        alert(data.message || 'Error saving document');
      }
    } catch (err) {
      console.error('Error saving compliance document:', err);
      alert('Failed to connect to backend server');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle component="div" sx={{ backgroundColor: '#1f4fb2', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip label={docCode} color="secondary" size="small" sx={{ fontWeight: 'bold' }} />
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            {isEditing ? 'Edit Controlled Document' : `Create ${currentDocConfig.title}`}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3, backgroundColor: '#fafbfc' }}>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          {/* General Metadata */}
          <Grid item xs={12} sm={4}>
            <TextField
              size="small"
              fullWidth
              label="Document Number"
              value={formData.doc_number}
              onChange={(e) => setFormData({ ...formData, doc_number: e.target.value })}
              required
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              size="small"
              fullWidth
              label="Version"
              value={formData.version}
              onChange={(e) => setFormData({ ...formData, version: e.target.value })}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              size="small"
              select
              fullWidth
              label="Document Status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <MenuItem value="APPROVED">Approved / Active</MenuItem>
              <MenuItem value="UNDER_REVIEW">Under Review</MenuItem>
              <MenuItem value="DRAFT">Draft</MenuItem>
              <MenuItem value="OBSOLETE">Obsolete</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12} sm={8}>
            <TextField
              size="small"
              fullWidth
              label="Document Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              size="small"
              fullWidth
              label="Department"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
            />
          </Grid>

          {/* ERP Smart Connections */}
          {(docCode === 'D2' || docCode === 'D3' || docCode === 'D9' || docCode === 'D10') && (
            <>
              <Grid item xs={12} sm={6}>
                <TextField
                  size="small"
                  select
                  fullWidth
                  label="Link Item Master (Auto-Fetch)"
                  value={formData.item_name}
                  onChange={handleItemSelect}
                  helperText="Fetches ERP Item specifications"
                >
                  <MenuItem value="">-- Select Item --</MenuItem>
                  {itemsList.map(item => (
                    <MenuItem key={item.id || item.name} value={item.name}>
                      {item.name} {item.group_name ? `(${item.group_name})` : ''}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  size="small"
                  select
                  fullWidth
                  label="Link Supplier Master (Optional)"
                  value={formData.supplier_name}
                  onChange={handleSupplierSelect}
                >
                  <MenuItem value="">-- Select Supplier --</MenuItem>
                  {suppliersList.map(sup => (
                    <MenuItem key={sup.id || sup.supplier_name} value={sup.supplier_name || sup.name}>
                      {sup.supplier_name || sup.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              {docCode === 'D9' && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    size="small"
                    fullWidth
                    label="Target Lot Number (for Recall)"
                    value={formData.lot_no}
                    onChange={(e) => setFormData({ ...formData, lot_no: e.target.value })}
                    placeholder="e.g. LOT0014"
                  />
                </Grid>
              )}
            </>
          )}

          <Grid item xs={12} sm={4}>
            <TextField
              size="small"
              type="date"
              fullWidth
              label="Effective Date"
              value={formData.effective_date}
              onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              size="small"
              type="date"
              fullWidth
              label="Review / Expiry Date"
              value={formData.review_date}
              onChange={(e) => setFormData({ ...formData, review_date: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              size="small"
              fullWidth
              label="Prepared By"
              value={formData.prepared_by}
              onChange={(e) => setFormData({ ...formData, prepared_by: e.target.value })}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              size="small"
              fullWidth
              label="Approved By"
              value={formData.approved_by}
              onChange={(e) => setFormData({ ...formData, approved_by: e.target.value })}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              size="small"
              fullWidth
              label="Remarks / Scope"
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
            />
          </Grid>
        </Grid>

        {/* Specialized Section for D2: Hazard Plan */}
        {docCode === 'D2' && (
          <Box sx={{ mt: 3, p: 2, backgroundColor: 'white', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>
                HACCP / CCP / OPRP Hazard Matrix
              </Typography>
              <Button
                size="small"
                startIcon={<AddCircleOutlineIcon />}
                onClick={() => setHazardsList([...hazardsList, { process_step: '', hazard_type: 'Physical', hazard_desc: '', control_category: 'CCP-1', critical_limit: '', monitoring_freq: 'Every 2 Hours', corrective_action: '' }])}
              >
                Add Hazard Point
              </Button>
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead sx={{ backgroundColor: '#f1f5f9' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Process Step</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Hazard Description</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Control Cat</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Critical Limit</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Frequency</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', width: 40 }}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {hazardsList.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <TextField
                          size="small"
                          value={row.process_step}
                          placeholder="e.g. Destoning"
                          onChange={(e) => {
                            const copy = [...hazardsList];
                            copy[idx].process_step = e.target.value;
                            setHazardsList(copy);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={row.hazard_desc}
                          placeholder="e.g. Stones / Ferrous"
                          onChange={(e) => {
                            const copy = [...hazardsList];
                            copy[idx].hazard_desc = e.target.value;
                            setHazardsList(copy);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          select
                          value={row.control_category}
                          onChange={(e) => {
                            const copy = [...hazardsList];
                            copy[idx].control_category = e.target.value;
                            setHazardsList(copy);
                          }}
                        >
                          <MenuItem value="CCP-1">CCP-1</MenuItem>
                          <MenuItem value="CCP-2">CCP-2</MenuItem>
                          <MenuItem value="OPRP-1">OPRP-1</MenuItem>
                          <MenuItem value="OPRP-2">OPRP-2</MenuItem>
                          <MenuItem value="PRP">PRP</MenuItem>
                        </TextField>
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={row.critical_limit}
                          placeholder="e.g. Magnet ≥ 10k Gauss"
                          onChange={(e) => {
                            const copy = [...hazardsList];
                            copy[idx].critical_limit = e.target.value;
                            setHazardsList(copy);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={row.monitoring_freq}
                          onChange={(e) => {
                            const copy = [...hazardsList];
                            copy[idx].monitoring_freq = e.target.value;
                            setHazardsList(copy);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" color="error" onClick={() => setHazardsList(hazardsList.filter((_, i) => i !== idx))}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Specialized Section for D3: MTR Specification */}
        {docCode === 'D3' && (
          <Box sx={{ mt: 3, p: 2, backgroundColor: 'white', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>
                MTR Standard Specifications & Quality Limits
              </Typography>
              <Button
                size="small"
                startIcon={<AddCircleOutlineIcon />}
                onClick={() => setSpecsList([...specsList, { parameter: '', standard_limit: '', test_method: '', category: 'Physical' }])}
              >
                Add Parameter
              </Button>
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead sx={{ backgroundColor: '#f1f5f9' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Parameter</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Standard Limit</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Test Method</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', width: 40 }}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {specsList.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <TextField
                          size="small"
                          value={row.parameter}
                          placeholder="e.g. Moisture"
                          onChange={(e) => {
                            const copy = [...specsList];
                            copy[idx].parameter = e.target.value;
                            setSpecsList(copy);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={row.standard_limit}
                          placeholder="Max 12.0 %"
                          onChange={(e) => {
                            const copy = [...specsList];
                            copy[idx].standard_limit = e.target.value;
                            setSpecsList(copy);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={row.test_method}
                          placeholder="IS 4333"
                          onChange={(e) => {
                            const copy = [...specsList];
                            copy[idx].test_method = e.target.value;
                            setSpecsList(copy);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          select
                          value={row.category}
                          onChange={(e) => {
                            const copy = [...specsList];
                            copy[idx].category = e.target.value;
                            setSpecsList(copy);
                          }}
                        >
                          <MenuItem value="Physical">Physical</MenuItem>
                          <MenuItem value="Chemical">Chemical</MenuItem>
                          <MenuItem value="Microbiology">Microbiology</MenuItem>
                        </TextField>
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" color="error" onClick={() => setSpecsList(specsList.filter((_, i) => i !== idx))}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Specialized Section for D4: Training Record */}
        {docCode === 'D4' && (
          <Box sx={{ mt: 3, p: 2, backgroundColor: 'white', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>
                Employee Attendees & Evaluation Record
              </Typography>
              <Button
                size="small"
                startIcon={<AddCircleOutlineIcon />}
                onClick={() => setTrainingAttendees([...trainingAttendees, { employee_name: '', emp_id: '', designation: '', evaluation_score: '', status: 'Passed' }])}
              >
                Add Attendee
              </Button>
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead sx={{ backgroundColor: '#f1f5f9' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Employee Name</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Emp ID</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Designation</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Score / %</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Result</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', width: 40 }}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {trainingAttendees.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <TextField
                          size="small"
                          value={row.employee_name}
                          placeholder="e.g. Murugan K"
                          onChange={(e) => {
                            const copy = [...trainingAttendees];
                            copy[idx].employee_name = e.target.value;
                            setTrainingAttendees(copy);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={row.emp_id}
                          placeholder="EMP-012"
                          onChange={(e) => {
                            const copy = [...trainingAttendees];
                            copy[idx].emp_id = e.target.value;
                            setTrainingAttendees(copy);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={row.designation}
                          placeholder="Operator"
                          onChange={(e) => {
                            const copy = [...trainingAttendees];
                            copy[idx].designation = e.target.value;
                            setTrainingAttendees(copy);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={row.evaluation_score}
                          placeholder="90%"
                          onChange={(e) => {
                            const copy = [...trainingAttendees];
                            copy[idx].evaluation_score = e.target.value;
                            setTrainingAttendees(copy);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          select
                          value={row.status}
                          onChange={(e) => {
                            const copy = [...trainingAttendees];
                            copy[idx].status = e.target.value;
                            setTrainingAttendees(copy);
                          }}
                        >
                          <MenuItem value="Passed">Passed</MenuItem>
                          <MenuItem value="Needs Retraining">Needs Retraining</MenuItem>
                        </TextField>
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" color="error" onClick={() => setTrainingAttendees(trainingAttendees.filter((_, i) => i !== idx))}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Specialized Section for D6: RCCA Record */}
        {docCode === 'D6' && (
          <Box sx={{ mt: 3, p: 2, backgroundColor: 'white', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1f4fb2', mb: 1.5 }}>
              5-Why Root Cause Analysis Engine
            </Typography>
            <Grid container spacing={1.5}>
              {fiveWhySteps.map((step, idx) => (
                <Grid item xs={12} key={idx}>
                  <TextField
                    size="small"
                    fullWidth
                    label={`Why Level ${idx + 1}`}
                    value={step}
                    onChange={(e) => {
                      const copy = [...fiveWhySteps];
                      copy[idx] = e.target.value;
                      setFiveWhySteps(copy);
                    }}
                  />
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2.5, backgroundColor: '#f1f5f9' }}>
        <Button onClick={onClose} variant="outlined" color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" color="primary" sx={{ fontWeight: 'bold' }}>
          {isEditing ? 'Update Document' : 'Save Controlled Document'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
