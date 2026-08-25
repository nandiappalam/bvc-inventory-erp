import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  MenuItem,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Alert,
  Snackbar,
  CircularProgress,
  Tooltip,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Send as SendIcon,
  RestartAlt as ResetIcon,
  Cancel as CancelIcon,
  AssignmentReturn as BackIcon,
  Inventory as InventoryIcon,
  ShoppingCart as PurchaseIcon
} from '@mui/icons-material';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api.js';
import { saveModuleDraft, loadModuleDraft, clearModuleDraft } from '../../utils/draftHelper';

const DEPARTMENTS = [
  'Raw Materials',
  'Packaging Materials',
  'Production',
  'Maintenance & Engineering',
  'Quality Control',
  'Stores & Warehouse',
  'Office & Administration',
  'Electrical & Utilities',
  'General'
];

const PRIORITIES = [
  { value: 'Low', color: '#4caf50' },
  { value: 'Medium', color: '#2196f3' },
  { value: 'High', color: '#ff9800' },
  { value: 'Urgent', color: '#f44336' }
];

const PurchaseRequestCreate = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const editId = searchParams.get('id') || location.state?.editId;

  // Master Data States
  const [itemsList, setItemsList] = useState([]);
  const [suppliersList, setSuppliersList] = useState([]);
  const [godownsList, setGodownsList] = useState([]);
  const [weightsList, setWeightsList] = useState([]);
  const [loadingMasters, setLoadingMasters] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form Header State
  const [prNo, setPrNo] = useState('');
  const [requestDate, setRequestDate] = useState(new Date().toISOString().split('T')[0]);
  const [requiredDate, setRequiredDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [department, setDepartment] = useState('Raw Materials');
  const [requestedBy, setRequestedBy] = useState(user?.username || 'Admin');
  const [priority, setPriority] = useState('Medium');
  const [supplierId, setSupplierId] = useState('');
  const [godownId, setGodownId] = useState('');
  const [status, setStatus] = useState('Draft');
  const [remarks, setRemarks] = useState('');

  // Item Rows State (Min. Stock Qty removed per user instruction)
  const [items, setItems] = useState([
    {
      item_id: '',
      item_code: '',
      item_name: '',
      weight: '',
      description: '',
      requested_qty: '',
      approved_qty: '',
      unit: 'kg',
      current_stock: 0,
      current_stock_rm: 0,
      current_stock_fg: 0,
      estimated_rate: '',
      estimated_amount: 0,
      remarks: ''
    }
  ]);

  // Alert/Message State
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  // Load Next PR No & Masters
  useEffect(() => {
    fetchMasters();
    if (editId) {
      loadPurchaseRequest(editId);
    } else {
      fetchNextPrNo();
      // Auto-load draft if creating new
      const savedDraft = loadModuleDraft('pr_create');
      if (savedDraft && savedDraft.items && savedDraft.items.length > 0) {
        if (savedDraft.department) setDepartment(savedDraft.department);
        if (savedDraft.priority) setPriority(savedDraft.priority);
        if (savedDraft.supplierId) setSupplierId(savedDraft.supplierId);
        if (savedDraft.godownId) setGodownId(savedDraft.godownId);
        if (savedDraft.remarks) setRemarks(savedDraft.remarks);
        setItems(savedDraft.items);
      }
    }
  }, [editId]);

  // Auto-save draft when creating
  useEffect(() => {
    if (!editId && (remarks || supplierId || (items.length > 0 && items[0]?.item_name))) {
      saveModuleDraft('pr_create', {
        department,
        priority,
        supplierId,
        godownId,
        remarks,
        items
      });
    }
  }, [department, priority, supplierId, godownId, remarks, items, editId]);

  const fetchNextPrNo = async () => {
    try {
      const data = await api('/purchase-requests/next-pr-no');
      if (data.next_pr_no) {
        setPrNo(data.next_pr_no);
      }
    } catch (err) {
      console.error('Error fetching next PR no:', err);
    }
  };

  const fetchMasters = async () => {
    setLoadingMasters(true);
    try {
      // Items Master
      const itemsData = await api('/masters/all/items');
      const loadedItems = Array.isArray(itemsData) ? itemsData : (itemsData?.data || []);
      setItemsList(loadedItems);

      // Suppliers Master
      const suppData = await api('/masters/all/suppliers');
      const loadedSuppliers = Array.isArray(suppData) ? suppData : (suppData?.data || []);
      setSuppliersList(loadedSuppliers);

      // Godowns Master
      const godownData = await api('/godowns');
      const loadedGodowns = Array.isArray(godownData) ? godownData : (godownData?.data || []);
      setGodownsList(loadedGodowns);

      // Weights Master
      try {
        const weightData = await api('/masters/all/weights');
        const loadedWeights = Array.isArray(weightData) ? weightData : (weightData?.data || []);
        setWeightsList(loadedWeights);
      } catch (e) {
        console.error('Error fetching weights:', e);
      }
    } catch (err) {
      console.error('Error fetching masters for PR:', err);
      setSnackbar({ open: true, message: 'Failed to load dropdown master data', severity: 'error' });
    } finally {
      setLoadingMasters(false);
    }
  };

  const loadPurchaseRequest = async (id) => {
    try {
      const data = await api(`/purchase-requests/${id}`);
      if (!data || data.success === false) throw new Error(data?.message || 'Purchase Request not found');

      setPrNo(data.pr_no);
      setRequestDate(data.request_date || new Date().toISOString().split('T')[0]);
      setRequiredDate(data.required_date || '');
      setDepartment(data.department || 'Raw Materials');
      setRequestedBy(data.requested_by || user?.username || 'Admin');
      setPriority(data.priority || 'Medium');
      setSupplierId(data.supplier_id || '');
      setGodownId(data.godown_id || '');
      setStatus(data.status || 'Draft');
      setRemarks(data.remarks || '');

      if (Array.isArray(data.items) && data.items.length > 0) {
        setItems(data.items.map(it => ({
          item_id: it.item_id || '',
          item_code: it.item_code || '',
          item_name: it.item_name || '',
          weight: it.weight || '',
          description: it.description || '',
          requested_qty: it.requested_qty || '',
          approved_qty: it.approved_qty || it.requested_qty || '',
          unit: it.unit || 'kg',
          current_stock: it.current_stock || 0,
          current_stock_rm: it.current_stock_rm !== undefined ? it.current_stock_rm : (it.current_stock || 0),
          current_stock_fg: it.current_stock_fg || 0,
          estimated_rate: it.estimated_rate || '',
          estimated_amount: it.estimated_amount || 0,
          remarks: it.remarks || ''
        })));
      }
    } catch (err) {
      console.error('Error loading PR:', err);
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  // Item Change Handler with live RM & FG stock calculation specifically for selected item
  const handleItemSelect = async (index, itemId) => {
    const selectedObj = itemsList.find(i => String(i.id) === String(itemId) || String(i.item_code) === String(itemId) || i.item_name === itemId);
    if (!selectedObj) return;

    const newRows = [...items];
    const itemName = selectedObj.item_name || selectedObj.name || itemId;
    
    // Fetch live RM and FG stock specifically for THIS selected item
    let currentStockRm = 0;
    let currentStockFg = 0;

    try {
      // 1. Try dedicated item balance endpoint
      const balanceData = await api(`/stock/item-balance/${encodeURIComponent(itemName)}`);
      if (balanceData && balanceData.success !== false) {
        if (balanceData) {
          currentStockRm = parseFloat(balanceData.rm_stock_qty) || 0;
          currentStockFg = parseFloat(balanceData.fg_stock_qty) || 0;
          if (currentStockRm === 0 && currentStockFg === 0 && balanceData.stock_qty) {
            currentStockRm = parseFloat(balanceData.stock_qty) || 0;
          }
        }
      } else {
        // 2. Try purchase-requests item-stock endpoint
        const prStockData = await api(`/purchase-requests/item-stock/${encodeURIComponent(selectedObj.id || itemName)}`);
        if (prStockData && prStockData.success !== false) {
          currentStockRm = parseFloat(prStockData.current_stock_rm !== undefined ? prStockData.current_stock_rm : prStockData.current_stock) || 0;
          currentStockFg = parseFloat(prStockData.current_stock_fg) || 0;
        }
      }
    } catch (e) {
      console.log('Stock query notice for item:', itemName, e.message);
      if (selectedObj.stock_qty || selectedObj.current_stock) {
        currentStockRm = parseFloat(selectedObj.stock_qty || selectedObj.current_stock) || 0;
      }
    }

    if (currentStockRm < 0) currentStockRm = 0;
    if (currentStockFg < 0) currentStockFg = 0;

    const reqQty = newRows[index].requested_qty || '';
    const rate = newRows[index].estimated_rate || selectedObj.rate || selectedObj.purchase_rate || '';
    const estAmt = (parseFloat(reqQty) || 0) * (parseFloat(rate) || 0);

    newRows[index] = {
      ...newRows[index],
      item_id: selectedObj.id || '',
      item_code: selectedObj.item_code || selectedObj.code || '',
      item_name: itemName,
      unit: selectedObj.unit || selectedObj.uom || 'kg',
      current_stock: currentStockRm,
      current_stock_rm: currentStockRm,
      current_stock_fg: currentStockFg,
      requested_qty: reqQty,
      estimated_rate: rate,
      estimated_amount: estAmt
    };

    setItems(newRows);
  };

  const handleRowChange = (index, field, value) => {
    const newRows = [...items];
    newRows[index][field] = value;

    if (field === 'requested_qty' || field === 'estimated_rate') {
      const reqQty = parseFloat(field === 'requested_qty' ? value : newRows[index].requested_qty) || 0;
      const rate = parseFloat(field === 'estimated_rate' ? value : newRows[index].estimated_rate) || 0;
      newRows[index].estimated_amount = reqQty * rate;
    }

    setItems(newRows);
  };

  const addRow = () => {
    setItems([
      ...items,
      {
        item_id: '',
        item_code: '',
        item_name: '',
        weight: '',
        description: '',
        requested_qty: '',
        approved_qty: '',
        unit: 'kg',
        current_stock: 0,
        current_stock_rm: 0,
        current_stock_fg: 0,
        estimated_rate: '',
        estimated_amount: 0,
        remarks: ''
      }
    ]);
  };

  const removeRow = (index) => {
    if (items.length === 1) {
      setSnackbar({ open: true, message: 'At least one item is required', severity: 'warning' });
      return;
    }
    const newRows = items.filter((_, i) => i !== index);
    setItems(newRows);
  };

  // Calculate Totals (Current Inventory Value box removed per user instruction)
  const totalItemsCount = items.filter(i => i.item_name).length;
  const totalQty = items.reduce((sum, i) => sum + (parseFloat(i.requested_qty) || 0), 0);
  const totalEstimatedPurchaseValue = items.reduce((sum, i) => sum + (parseFloat(i.estimated_amount) || 0), 0);

  const handleReset = () => {
    if (editId) {
      loadPurchaseRequest(editId);
    } else {
      clearModuleDraft('pr_create');
      fetchNextPrNo();
      setRequestDate(new Date().toISOString().split('T')[0]);
      setDepartment('Raw Materials');
      setPriority('Medium');
      setSupplierId('');
      setGodownId('');
      setRemarks('');
      setItems([
        {
          item_id: '',
          item_code: '',
          item_name: '',
          weight: '',
          description: '',
          requested_qty: '',
          approved_qty: '',
          unit: 'kg',
          current_stock: 0,
          estimated_rate: '',
          estimated_amount: 0,
          remarks: ''
        }
      ]);
    }
  };

  const handleSubmitForm = async (targetStatus) => {
    if (!prNo) {
      setSnackbar({ open: true, message: 'PR Number is required', severity: 'error' });
      return;
    }

    const validItems = items.filter(i => i.item_name && parseFloat(i.requested_qty) > 0);
    if (validItems.length === 0) {
      setSnackbar({ open: true, message: 'Please add at least one valid item with Item Name and Required Quantity > 0', severity: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const selectedSupplier = suppliersList.find(s => String(s.id) === String(supplierId));
      const selectedGodown = godownsList.find(g => String(g.id) === String(godownId));

      const payload = {
        pr_no: prNo,
        request_date: requestDate,
        required_date: requiredDate,
        department,
        requested_by: requestedBy,
        supplier_id: supplierId || null,
        supplier_name: selectedSupplier ? (selectedSupplier.supplier_name || selectedSupplier.name) : '',
        godown_id: godownId || null,
        godown_name: selectedGodown ? (selectedGodown.godown_name || selectedGodown.name) : 'Main Godown',
        priority,
        status: targetStatus || status,
        remarks,
        items: validItems.map(it => ({
          item_id: it.item_id || null,
          item_code: it.item_code || '',
          item_name: it.item_name,
          weight: it.weight || '',
          description: it.description || '',
          requested_qty: parseFloat(it.requested_qty) || 0,
          approved_qty: parseFloat(it.approved_qty) || parseFloat(it.requested_qty) || 0,
          unit: it.unit || 'kg',
          current_stock: parseFloat(it.current_stock) || 0,
          estimated_rate: parseFloat(it.estimated_rate) || 0,
          estimated_amount: (parseFloat(it.requested_qty) || 0) * (parseFloat(it.estimated_rate) || 0),
          remarks: it.remarks || ''
        }))
      };

      const url = editId ? `/api/purchase-requests/${editId}` : '/api/purchase-requests';
      const method = editId ? 'PUT' : 'POST';

      const data = await api(url, { method, body: payload });
      if (!data || data.success === false) throw new Error(data?.message || data?.error || 'Failed to save purchase request');

      clearModuleDraft('pr_create');
      setSnackbar({
        open: true,
        message: `Purchase Request ${prNo} ${editId ? 'updated' : 'saved'} successfully as ${targetStatus || status}!`,
        severity: 'success'
      });

      setTimeout(() => {
        navigate('/entry/purchase-request-display');
      }, 1200);
    } catch (err) {
      console.error('Save PR error:', err);
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 1.5, sm: 3 }, maxWidth: 1400, margin: '0 auto', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Header Bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <PurchaseIcon sx={{ color: '#0284c7', fontSize: 32 }} />
            {editId ? `Edit Purchase Request — ${prNo}` : 'Purchase Request Creation'}
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
            Submit and manage raw material & component purchase requests with live stock validation
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            startIcon={<BackIcon />}
            onClick={() => navigate('/entry/purchase-request-display')}
            sx={{ textTransform: 'none', fontWeight: 600, borderColor: '#cbd5e1', color: '#334155' }}
          >
            Display List
          </Button>
        </Box>
      </Box>

      {/* Main Form Fields Card */}
      <Card elevation={2} sx={{ mb: 3, borderRadius: 2, border: '1px solid #e2e8f0' }}>
        <Box sx={{ px: 3, py: 1.8, backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: '700', color: '#0f2942', display: 'flex', alignItems: 'center', gap: 1 }}>
            📋 Header & Requisition Details
          </Typography>
          <Chip label={`Status: ${status}`} color={status === 'Approved' ? 'success' : status === 'Submitted' ? 'primary' : 'default'} size="small" sx={{ fontWeight: 'bold' }} />
        </Box>
        <CardContent sx={{ p: 3 }}>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="PR Number"
                value={prNo}
                onChange={(e) => setPrNo(e.target.value)}
                fullWidth
                size="small"
                inputProps={{ style: { fontWeight: '700', color: '#0284c7' } }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="Request Date"
                type="date"
                value={requestDate}
                onChange={(e) => setRequestDate(e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="Required By Date"
                type="date"
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                label="Department / Cost Center"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                fullWidth
                size="small"
              >
                {DEPARTMENTS.map(d => (
                  <MenuItem key={d} value={d}>{d}</MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="Requested By"
                value={requestedBy}
                onChange={(e) => setRequestedBy(e.target.value)}
                fullWidth
                size="small"
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                label="Priority Level"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                fullWidth
                size="small"
              >
                {PRIORITIES.map(p => (
                  <MenuItem key={p.value} value={p.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: p.color }} />
                      {p.value}
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                label="Preferred Supplier (Optional)"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                fullWidth
                size="small"
              >
                <MenuItem value="">-- None / Any Supplier --</MenuItem>
                {suppliersList.map(s => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.supplier_name || s.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                label="Destination Godown"
                value={godownId}
                onChange={(e) => setGodownId(e.target.value)}
                fullWidth
                size="small"
              >
                <MenuItem value="">-- Main Godown --</MenuItem>
                {godownsList.map(g => (
                  <MenuItem key={g.id} value={g.id}>
                    {g.godown_name || g.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Remarks / Purpose of Requisition"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                fullWidth
                multiline
                rows={2}
                size="small"
                placeholder="Enter requisition notes, project code, or justification..."
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Item Details Table Card - High Contrast Titles and Comfortable Field Sizes */}
      <Card elevation={2} sx={{ mb: 3, borderRadius: 2, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <Box sx={{ px: 3, py: 1.8, backgroundColor: '#0f2942', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: '800', color: '#ffffff', display: 'flex', alignItems: 'center', gap: 1 }}>
            <InventoryIcon sx={{ color: '#38bdf8' }} /> Purchase Request Items
          </Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={addRow}
            sx={{ backgroundColor: '#0284c7', '&:hover': { backgroundColor: '#0369a1' }, fontWeight: 'bold', textTransform: 'none' }}
          >
            Add Item Row
          </Button>
        </Box>

        <TableContainer component={Paper} elevation={0} sx={{ overflowX: 'auto' }}>
          <Table size="medium" sx={{ minWidth: 1050 }}>
            <TableHead sx={{ backgroundColor: '#0f172a' }}>
              <TableRow>
                <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13.5px', width: '60px', textAlign: 'center', py: 1.8, borderRight: '1px solid #334155', letterSpacing: '0.3px' }}>S.No</TableCell>
                <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13.5px', minWidth: '240px', py: 1.8, borderRight: '1px solid #334155', letterSpacing: '0.3px' }}>Item Name *</TableCell>
                <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13.5px', minWidth: '150px', py: 1.8, borderRight: '1px solid #334155', letterSpacing: '0.3px' }}>Weight</TableCell>
                <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13.5px', minWidth: '180px', py: 1.8, borderRight: '1px solid #334155', letterSpacing: '0.3px' }}>Description / Specs</TableCell>
                <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13.5px', minWidth: '130px', py: 1.8, borderRight: '1px solid #334155', letterSpacing: '0.3px' }}>Req Qty *</TableCell>
                <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13.5px', minWidth: '100px', py: 1.8, borderRight: '1px solid #334155', letterSpacing: '0.3px' }}>Unit</TableCell>
                <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13.5px', minWidth: '140px', py: 1.8, borderRight: '1px solid #334155', letterSpacing: '0.3px' }}>Curr. Stock (RM)</TableCell>
                <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13.5px', minWidth: '140px', py: 1.8, borderRight: '1px solid #334155', letterSpacing: '0.3px' }}>Curr. Stock (FG)</TableCell>
                <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13.5px', minWidth: '130px', py: 1.8, borderRight: '1px solid #334155', letterSpacing: '0.3px' }}>Est. Rate (₹)</TableCell>
                <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13.5px', minWidth: '140px', py: 1.8, borderRight: '1px solid #334155', letterSpacing: '0.3px' }}>Est. Amount (₹)</TableCell>
                <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13.5px', minWidth: '140px', py: 1.8, borderRight: '1px solid #334155', letterSpacing: '0.3px' }}>Remarks</TableCell>
                <TableCell sx={{ color: '#ffffff !important', fontWeight: '800', fontSize: '13.5px', width: '70px', textAlign: 'center', py: 1.8, letterSpacing: '0.3px' }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((row, idx) => (
                <TableRow key={idx} hover sx={{ '&:nth-of-type(even)': { backgroundColor: '#f8fafc' }, '&:hover': { backgroundColor: '#f1f5f9' } }}>
                  <TableCell sx={{ fontWeight: '800', textAlign: 'center', color: '#475569', fontSize: '13px' }}>{idx + 1}</TableCell>
                  
                  {/* Item Name */}
                  <TableCell sx={{ py: 1 }}>
                    <TextField
                      select
                      value={row.item_name || ''}
                      onChange={(e) => handleItemSelect(idx, e.target.value)}
                      fullWidth
                      size="small"
                      variant="outlined"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          height: '42px',
                          fontSize: '13px',
                          fontWeight: '600'
                        }
                      }}
                    >
                      <MenuItem value="">-- Select Item --</MenuItem>
                      {itemsList.map(it => (
                        <MenuItem key={it.id || it.item_name} value={it.item_name || it.name}>
                          {it.item_name || it.name} {it.item_code ? `(${it.item_code})` : ''}
                        </MenuItem>
                      ))}
                    </TextField>
                  </TableCell>

                  {/* Weight */}
                  <TableCell sx={{ py: 1 }}>
                    <TextField
                      select
                      value={row.weight || ''}
                      onChange={(e) => handleRowChange(idx, 'weight', e.target.value)}
                      fullWidth
                      size="small"
                      variant="outlined"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          height: '42px',
                          fontSize: '13px'
                        }
                      }}
                    >
                      <MenuItem value="">-- Weight --</MenuItem>
                      {weightsList.map((w, wIdx) => (
                        <MenuItem key={w.id || wIdx} value={w.weight_name || w.name || w.weight || w.per_unit_wt}>
                          {w.weight_name || w.name || w.weight} {w.unit ? `(${w.unit})` : ''}
                        </MenuItem>
                      ))}
                    </TextField>
                  </TableCell>

                  {/* Description */}
                  <TableCell sx={{ py: 1 }}>
                    <TextField
                      value={row.description || ''}
                      onChange={(e) => handleRowChange(idx, 'description', e.target.value)}
                      fullWidth
                      size="small"
                      placeholder="Spec / Quality / Make"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          height: '42px',
                          fontSize: '13px'
                        }
                      }}
                    />
                  </TableCell>

                  {/* Req Qty */}
                  <TableCell sx={{ py: 1 }}>
                    <TextField
                      type="number"
                      value={row.requested_qty}
                      onChange={(e) => handleRowChange(idx, 'requested_qty', e.target.value)}
                      fullWidth
                      size="small"
                      placeholder="0.00"
                      inputProps={{ min: 0, step: 'any', style: { fontWeight: '700', color: '#0284c7', fontSize: '13px' } }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          height: '42px'
                        }
                      }}
                    />
                  </TableCell>

                  {/* Unit */}
                  <TableCell sx={{ py: 1 }}>
                    <TextField
                      value={row.unit || 'kg'}
                      onChange={(e) => handleRowChange(idx, 'unit', e.target.value)}
                      fullWidth
                      size="small"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          height: '42px',
                          fontSize: '13px'
                        }
                      }}
                    />
                  </TableCell>

                  {/* Curr. Stock (RM) */}
                  <TableCell sx={{ py: 1, backgroundColor: '#f8fafc' }}>
                    <Box sx={{ px: 1.2, py: 0.8, backgroundColor: '#e2e8f0', borderRadius: 1, textAlign: 'right' }}>
                      <Typography variant="body2" sx={{ fontWeight: '800', color: '#0f172a', fontFamily: 'monospace', fontSize: '13px' }}>
                        {parseFloat(row.current_stock_rm !== undefined ? row.current_stock_rm : (row.current_stock || 0)).toFixed(2)}
                      </Typography>
                    </Box>
                  </TableCell>

                  {/* Curr. Stock (FG) */}
                  <TableCell sx={{ py: 1, backgroundColor: '#f0fdf4' }}>
                    <Box sx={{ px: 1.2, py: 0.8, backgroundColor: '#dcfce7', borderRadius: 1, textAlign: 'right' }}>
                      <Typography variant="body2" sx={{ fontWeight: '800', color: '#166534', fontFamily: 'monospace', fontSize: '13px' }}>
                        {parseFloat(row.current_stock_fg || 0).toFixed(2)}
                      </Typography>
                    </Box>
                  </TableCell>

                  {/* Est. Rate */}
                  <TableCell sx={{ py: 1 }}>
                    <TextField
                      type="number"
                      value={row.estimated_rate}
                      onChange={(e) => handleRowChange(idx, 'estimated_rate', e.target.value)}
                      fullWidth
                      size="small"
                      placeholder="0.00"
                      inputProps={{ min: 0, step: 'any', style: { textAlign: 'right', fontWeight: '600', fontSize: '13px' } }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          height: '42px'
                        }
                      }}
                    />
                  </TableCell>

                  {/* Est. Amount */}
                  <TableCell sx={{ py: 1, backgroundColor: '#f0fdf4' }}>
                    <Box sx={{ px: 1.5, py: 0.8, backgroundColor: '#dcfce7', borderRadius: 1, textAlign: 'right' }}>
                      <Typography variant="body2" sx={{ fontWeight: '800', color: '#15803d', fontSize: '13px' }}>
                        ₹{(row.estimated_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                    </Box>
                  </TableCell>

                  {/* Remarks */}
                  <TableCell sx={{ py: 1 }}>
                    <TextField
                      value={row.remarks || ''}
                      onChange={(e) => handleRowChange(idx, 'remarks', e.target.value)}
                      fullWidth
                      size="small"
                      placeholder="Item note"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          height: '42px',
                          fontSize: '13px'
                        }
                      }}
                    />
                  </TableCell>

                  {/* Action */}
                  <TableCell align="center" sx={{ py: 1 }}>
                    <IconButton color="error" size="small" onClick={() => removeRow(idx)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Summary Cards (Current inventory value box removed per user instruction) */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card elevation={1} sx={{ p: 2.5, borderLeft: '5px solid #0284c7', borderRadius: 2, backgroundColor: '#ffffff' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Requested Items</Typography>
            <Typography variant="h5" sx={{ fontWeight: '800', color: '#0284c7', mt: 0.5 }}>
              {totalItemsCount} <Typography component="span" variant="caption" sx={{ color: '#64748b' }}>Line Items</Typography>
            </Typography>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card elevation={1} sx={{ p: 2.5, borderLeft: '5px solid #3b82f6', borderRadius: 2, backgroundColor: '#ffffff' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Quantity</Typography>
            <Typography variant="h5" sx={{ fontWeight: '800', color: '#1d4ed8', mt: 0.5 }}>
              {totalQty.toLocaleString('en-IN')} <Typography component="span" variant="caption" sx={{ color: '#64748b' }}>Units</Typography>
            </Typography>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card elevation={1} sx={{ p: 2.5, borderLeft: '5px solid #16a34a', borderRadius: 2, backgroundColor: '#ffffff' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Estimated Purchase Value</Typography>
            <Typography variant="h5" sx={{ fontWeight: '800', color: '#15803d', mt: 0.5 }}>
              ₹{totalEstimatedPurchaseValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Typography>
          </Card>
        </Grid>
      </Grid>

      {/* Bottom Action Controls */}
      <Paper elevation={3} sx={{ p: 2.5, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', border: '1px solid #e2e8f0' }}>
        <Button
          variant="outlined"
          color="warning"
          startIcon={<ResetIcon />}
          onClick={handleReset}
          disabled={submitting}
          sx={{ textTransform: 'none', fontWeight: '700' }}
        >
          Reset Form
        </Button>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<CancelIcon />}
            onClick={() => navigate('/entry/purchase-request-display')}
            disabled={submitting}
            sx={{ textTransform: 'none', fontWeight: '600' }}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            color="primary"
            startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
            onClick={() => handleSubmitForm('Draft')}
            disabled={submitting}
            sx={{ backgroundColor: '#475569', '&:hover': { backgroundColor: '#334155' }, fontWeight: '700', textTransform: 'none' }}
          >
            Save as Draft
          </Button>

          <Button
            variant="contained"
            color="success"
            startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
            onClick={() => handleSubmitForm('Submitted')}
            disabled={submitting}
            sx={{ backgroundColor: '#16a34a', '&:hover': { backgroundColor: '#15803d' }, fontWeight: '800', px: 3, textTransform: 'none' }}
          >
            Submit Requisition
          </Button>
        </Box>
      </Paper>

      {/* Notification Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%', fontWeight: 'bold' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PurchaseRequestCreate;
