import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  Tabs,
  Tab,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Divider,
  Stack,
  MenuItem,
  Select,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  MenuBook as MenuBookIcon,
  Add as AddIcon,
  Calculate as CalculateIcon,
  CompareArrows as CompareArrowsIcon,
  Layers as LayersIcon,
  Edit as EditIcon,
  History as HistoryIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import manufacturingService from '../../services/manufacturingService';

const BOMDashboard = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [boms, setBoms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Simulator State
  const [selectedBomForExplosion, setSelectedBomForExplosion] = useState('');
  const [explosionQuantity, setExplosionQuantity] = useState(1000);
  const [explosionResults, setExplosionResults] = useState(null);
  const [explosionLoading, setExplosionLoading] = useState(false);

  // Dialog State
  const [bomDialogOpen, setBomDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('CREATE'); // 'CREATE' | 'EDIT' | 'VERSION'
  const [editingBomId, setEditingBomId] = useState(null);
  const [formData, setFormData] = useState({
    bomCode: '',
    bomName: '',
    productName: '',
    version: 'V1',
    batchQty: 100,
    uom: 'KG',
    standardYieldPct: 100,
    yieldTolerancePct: 2,
    remarks: '',
    items: [
      { itemName: '', quantity: '', uom: 'KG', scrapPct: 0, itemType: 'Raw Material', isOptional: false }
    ]
  });

  // Fetch all BOMs
  const fetchBOMs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await manufacturingService.getBOMs();
      if (res.success && res.data) {
        setBoms(res.data);
        if (res.data.length > 0 && !selectedBomForExplosion) {
          setSelectedBomForExplosion(res.data[0].id);
        }
      }
    } catch (e) {
      console.error('Error fetching BOMs:', e);
      setError('Failed to load BOM catalog.');
    } finally {
      setLoading(false);
    }
  }, [selectedBomForExplosion]);

  useEffect(() => {
    fetchBOMs();
  }, [fetchBOMs]);

  // Run Material Explosion
  const handleExplode = async () => {
    if (!selectedBomForExplosion) return;
    setExplosionLoading(true);
    try {
      const res = await manufacturingService.calculateRequirements(selectedBomForExplosion, explosionQuantity);
      if (res.success) {
        setExplosionResults(res.data);
      }
    } catch (e) {
      console.error('Error exploding BOM:', e);
      setError('Error calculating material requirements');
    } finally {
      setExplosionLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBomForExplosion && activeTab === 1) {
      handleExplode();
    }
  }, [selectedBomForExplosion, activeTab]);

  // Open Create Dialog
  const handleOpenCreate = () => {
    setDialogMode('CREATE');
    setEditingBomId(null);
    setFormData({
      bomCode: `BOM-${Date.now().toString().slice(-4)}`,
      bomName: '',
      productName: '',
      version: 'V1',
      batchQty: 100,
      uom: 'KG',
      standardYieldPct: 100,
      yieldTolerancePct: 2,
      remarks: '',
      items: [
        { itemName: '', quantity: '', uom: 'KG', scrapPct: 0, itemType: 'Raw Material', isOptional: false }
      ]
    });
    setBomDialogOpen(true);
  };

  // Open Edit Dialog
  const handleOpenEdit = async (bomId) => {
    try {
      const res = await manufacturingService.getBOMById(bomId);
      if (res.success && res.data) {
        const b = res.data;
        setDialogMode('EDIT');
        setEditingBomId(b.id);
        setFormData({
          bomCode: b.bom_code,
          bomName: b.bom_name,
          productName: b.product_name,
          version: b.version,
          batchQty: b.batch_qty,
          uom: b.uom,
          standardYieldPct: b.standard_yield_pct,
          yieldTolerancePct: b.yield_tolerance_pct,
          remarks: b.remarks || '',
          items: (b.items || []).map(it => ({
            itemId: it.item_id,
            itemName: it.item_name,
            quantity: it.quantity,
            uom: it.uom,
            scrapPct: it.scrap_pct || 0,
            itemType: it.item_type || 'Raw Material',
            isOptional: !!it.is_optional
          }))
        });
        setBomDialogOpen(true);
      }
    } catch (e) {
      setError('Failed to load BOM details for editing');
    }
  };

  // Save BOM
  const handleSaveBOM = async () => {
    try {
      if (dialogMode === 'CREATE') {
        const res = await manufacturingService.createBOM(formData);
        if (res.success) {
          setSuccessMsg('BOM formula created successfully');
          setBomDialogOpen(false);
          fetchBOMs();
        }
      } else if (dialogMode === 'EDIT') {
        const res = await manufacturingService.updateBOM(editingBomId, formData);
        if (res.success) {
          setSuccessMsg('BOM formula updated successfully');
          setBomDialogOpen(false);
          fetchBOMs();
        }
      }
    } catch (e) {
      setError(e.message || 'Error saving BOM');
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: '1600px', mx: 'auto' }}>
      {/* Header */}
      <Paper elevation={0} sx={{ p: 2.5, mb: 3, borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
        <Grid container spacing={2} alignItems="center" justifyContent="space-between">
          <Grid item xs={12} md={7}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <MenuBookIcon sx={{ color: '#0284c7', fontSize: 32 }} />
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
                  Bill of Materials & Formulation Engine
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b' }}>
                  Multi-level recipes, scrap factor allowances, standard version control, and multi-tier material explosion.
                </Typography>
              </Box>
            </Stack>
          </Grid>
          <Grid item xs={12} md={5}>
            <Stack direction="row" spacing={1.5} justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleOpenCreate}
                sx={{ bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' }, textTransform: 'none', fontWeight: 600 }}
              >
                Create New BOM
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: '10px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>ACTIVE FORMULAS</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', mt: 0.5 }}>{boms.length}</Typography>
            <Typography variant="caption" sx={{ color: '#059669', fontWeight: 600 }}>Standardized Recipes</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} md={3}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: '10px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>STANDARD MILLING YIELD</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', mt: 0.5 }}>72.0%</Typography>
            <Typography variant="caption" sx={{ color: '#0284c7', fontWeight: 600 }}>Urad Grains to Flour</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} md={3}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: '10px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>JOBWORK PAPAD YIELD</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', mt: 0.5 }}>90.0%</Typography>
            <Typography variant="caption" sx={{ color: '#8b5cf6', fontWeight: 600 }}>Allowed Wastage: 3.0%</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} md={3}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: '10px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>MRP CALCULATION</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#059669', mt: 0.5 }}>Automated</Typography>
            <Typography variant="caption" sx={{ color: '#64748b' }}>Connected to Procurement</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Messages */}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg('')}>{successMsg}</Alert>}

      {/* Main Tabs */}
      <Paper elevation={0} sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
        <Tabs
          value={activeTab}
          onChange={(e, val) => setActiveTab(val)}
          textColor="primary"
          indicatorColor="primary"
          sx={{ borderBottom: '1px solid #f1f5f9', px: 2 }}
        >
          <Tab icon={<LayersIcon />} iconPosition="start" label="BOM Master Registry" sx={{ fontWeight: 700, textTransform: 'none' }} />
          <Tab icon={<CalculateIcon />} iconPosition="start" label="Material Explosion & Stock Check" sx={{ fontWeight: 700, textTransform: 'none' }} />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* TAB 0: BOM CATALOG */}
          {activeTab === 0 && (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '8px' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>BOM Code</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Formula Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Finished Product</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Version</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Standard Batch (KG)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Standard Yield %</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Components</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 4 }}><CircularProgress size={28} /></TableCell>
                    </TableRow>
                  ) : boms.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 4, color: '#64748b' }}>No BOM formulas found.</TableCell>
                    </TableRow>
                  ) : (
                    boms.map((b) => (
                      <TableRow key={`bom-${b.id}`} hover>
                        <TableCell sx={{ fontWeight: 700, color: '#0284c7' }}>{b.bom_code}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{b.bom_name}</TableCell>
                        <TableCell>{b.product_name}</TableCell>
                        <TableCell><Chip label={b.version || 'V1'} size="small" sx={{ fontWeight: 700 }} /></TableCell>
                        <TableCell>{b.batch_qty} {b.uom}</TableCell>
                        <TableCell>{b.standard_yield_pct}% (±{b.yield_tolerance_pct}%)</TableCell>
                        <TableCell>{b.component_count || 0} items</TableCell>
                        <TableCell>
                          <Chip label={b.status || 'Active'} size="small" color={b.status === 'Active' ? 'success' : 'default'} sx={{ fontWeight: 600 }} />
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1}>
                            <Tooltip title="Edit Formula">
                              <IconButton size="small" color="primary" onClick={() => handleOpenEdit(b.id)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => {
                                setSelectedBomForExplosion(b.id);
                                setActiveTab(1);
                              }}
                              sx={{ textTransform: 'none', fontSize: '12px' }}
                            >
                              Explode
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* TAB 1: MATERIAL EXPLOSION SIMULATOR */}
          {activeTab === 1 && (
            <Box>
              <Paper sx={{ p: 2.5, mb: 3, bgcolor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={5}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Select BOM Formula</InputLabel>
                      <Select
                        value={selectedBomForExplosion}
                        label="Select BOM Formula"
                        onChange={(e) => setSelectedBomForExplosion(e.target.value)}
                      >
                        {boms.map((b) => (
                          <MenuItem key={`sel-bom-${b.id}`} value={b.id}>
                            {b.product_name} ({b.bom_code} - {b.version})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Target Production Quantity (KG)"
                      type="number"
                      value={explosionQuantity}
                      onChange={(e) => setExplosionQuantity(parseFloat(e.target.value) || 0)}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={handleExplode}
                      startIcon={<CalculateIcon />}
                      sx={{ bgcolor: '#0284c7', textTransform: 'none', fontWeight: 700 }}
                    >
                      Calculate Requirements
                    </Button>
                  </Grid>
                </Grid>
              </Paper>

              {explosionLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={32} /></Box>
              ) : explosionResults ? (
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a', mb: 1.5 }}>
                    Exploded Raw Material Requirements for {explosionQuantity} KG of {explosionResults.bom?.product_name}:
                  </Typography>

                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '8px' }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: '#f8fafc' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Component / Raw Material</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Standard Recipe / Batch</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Scrap Allowance</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Gross Required (KG)</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Available Stock (KG)</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Shortage / Surplus</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Readiness</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(explosionResults.requirements || []).map((req, idx) => (
                          <TableRow key={`req-${req.itemName}-${idx}`} hover>
                            <TableCell sx={{ fontWeight: 700, color: '#0f172a' }}>{req.itemName}</TableCell>
                            <TableCell><Chip label={req.itemType} size="small" sx={{ fontSize: '11px' }} /></TableCell>
                            <TableCell>{req.standardQtyPerBatch} {req.uom}</TableCell>
                            <TableCell>{req.scrapPct}%</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: '#0284c7' }}>{req.requiredQty} {req.uom}</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{req.availableStock} {req.uom}</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: req.shortage > 0 ? '#dc2626' : '#16a34a' }}>
                              {req.shortage > 0 ? `-${req.shortage} ${req.uom}` : 'Sufficient'}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={req.status}
                                size="small"
                                color={req.status === 'SHORTAGE' ? 'error' : 'success'}
                                sx={{ fontWeight: 700, fontSize: '11px' }}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              ) : null}
            </Box>
          )}
        </Box>
      </Paper>

      {/* Create / Edit Dialog */}
      <Dialog open={bomDialogOpen} onClose={() => setBomDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {dialogMode === 'CREATE' ? 'Create New BOM Formula' : 'Edit BOM Formula'}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label="BOM Code"
                value={formData.bomCode}
                onChange={(e) => setFormData({ ...formData, bomCode: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label="Formula Name"
                value={formData.bomName}
                onChange={(e) => setFormData({ ...formData, bomName: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label="Finished Product Name"
                value={formData.productName}
                onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Batch Qty"
                type="number"
                value={formData.batchQty}
                onChange={(e) => setFormData({ ...formData, batchQty: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                size="small"
                label="UOM"
                value={formData.uom}
                onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
            Components & Raw Material Formulation
          </Typography>

          {formData.items.map((it, idx) => (
            <Stack key={`it-${idx}`} direction="row" spacing={1} sx={{ mb: 1.5 }} alignItems="center">
              <TextField
                size="small"
                label="Component Name"
                value={it.itemName}
                onChange={(e) => {
                  const updated = [...formData.items];
                  updated[idx].itemName = e.target.value;
                  setFormData({ ...formData, items: updated });
                }}
                sx={{ flex: 2 }}
                required
              />
              <TextField
                size="small"
                label="Quantity"
                type="number"
                value={it.quantity}
                onChange={(e) => {
                  const updated = [...formData.items];
                  updated[idx].quantity = e.target.value;
                  setFormData({ ...formData, items: updated });
                }}
                sx={{ width: 110 }}
                required
              />
              <TextField
                size="small"
                label="Scrap %"
                type="number"
                value={it.scrapPct}
                onChange={(e) => {
                  const updated = [...formData.items];
                  updated[idx].scrapPct = e.target.value;
                  setFormData({ ...formData, items: updated });
                }}
                sx={{ width: 90 }}
              />
              <FormControl size="small" sx={{ width: 140 }}>
                <Select
                  value={it.itemType}
                  onChange={(e) => {
                    const updated = [...formData.items];
                    updated[idx].itemType = e.target.value;
                    setFormData({ ...formData, items: updated });
                  }}
                >
                  <MenuItem value="Raw Material">Raw Material</MenuItem>
                  <MenuItem value="Intermediate">Intermediate</MenuItem>
                  <MenuItem value="Consumable">Consumable</MenuItem>
                </Select>
              </FormControl>
              <IconButton
                size="small"
                color="error"
                onClick={() => {
                  if (formData.items.length > 1) {
                    setFormData({ ...formData, items: formData.items.filter((_, i) => i !== idx) });
                  }
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}

          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => {
              setFormData({
                ...formData,
                items: [...formData.items, { itemName: '', quantity: '', uom: 'KG', scrapPct: 0, itemType: 'Raw Material', isOptional: false }]
              });
            }}
            sx={{ textTransform: 'none', mt: 1 }}
          >
            Add Component Row
          </Button>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setBomDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveBOM} sx={{ bgcolor: '#0284c7' }}>
            Save Formula
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BOMDashboard;
