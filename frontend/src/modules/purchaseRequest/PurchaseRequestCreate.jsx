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
  ShoppingCart as PurchaseIcon,
  Calculate as CalculateIcon,
  InfoOutlined as InfoIcon
} from '@mui/icons-material';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

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

  // Item Rows State
  const [items, setItems] = useState([
    {
      item_id: '',
      item_code: '',
      item_name: '',
      description: '',
      requested_qty: '',
      approved_qty: '',
      unit: 'kg',
      current_stock: 0,
      minimum_stock: 0,
      suggested_qty: 0,
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
    }
  }, [editId]);

  const fetchNextPrNo = async () => {
    try {
      const res = await fetch('/api/purchase-requests/next-pr-no');
      const data = await res.json();
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
      const itemsRes = await fetch('/api/masters/all/items');
      const itemsData = await itemsRes.json();
      const loadedItems = Array.isArray(itemsData) ? itemsData : (itemsData.data || []);
      setItemsList(loadedItems);

      // Suppliers Master
      const suppRes = await fetch('/api/masters/all/suppliers');
      const suppData = await suppRes.json();
      const loadedSuppliers = Array.isArray(suppData) ? suppData : (suppData.data || []);
      setSuppliersList(loadedSuppliers);

      // Godowns Master
      const godownRes = await fetch('/api/godowns');
      const godownData = await godownRes.json();
      const loadedGodowns = Array.isArray(godownData) ? godownData : (godownData.data || []);
      setGodownsList(loadedGodowns);

      // Weights Master
      try {
        const weightRes = await fetch('/api/masters/all/weights');
        const weightData = await weightRes.json();
        const loadedWeights = Array.isArray(weightData) ? weightData : (weightData.data || []);
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
      const res = await fetch(`/api/purchase-requests/${id}`);
      if (!res.ok) throw new Error('Purchase Request not found');
      const data = await res.json();

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
          description: it.description || '',
          requested_qty: it.requested_qty || '',
          approved_qty: it.approved_qty || it.requested_qty || '',
          unit: it.unit || 'kg',
          current_stock: it.current_stock || 0,
          minimum_stock: it.minimum_stock || 0,
          suggested_qty: it.suggested_qty || 0,
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

  // Item Change Handler
  const handleItemSelect = async (index, itemId) => {
    const selectedObj = itemsList.find(i => String(i.id) === String(itemId) || i.item_name === itemId);
    if (!selectedObj) return;

    const newRows = [...items];
    const itemName = selectedObj.item_name || selectedObj.name || itemId;
    
    // Fetch live stock for this item if possible
    let currentStock = selectedObj.current_stock || selectedObj.stock || 0;
    let minStock = selectedObj.minimum_stock || selectedObj.min_stock || 0;

    try {
      const stockRes = await fetch(`/api/stock?item_name=${encodeURIComponent(itemName)}`);
      if (stockRes.ok) {
        const stockData = await stockRes.json();
        if (Array.isArray(stockData) && stockData.length > 0) {
          const totStock = stockData.reduce((sum, s) => sum + (parseFloat(s.qty) || parseFloat(s.available_qty) || 0), 0);
          if (totStock > 0) currentStock = totStock;
        }
      }
    } catch (e) {
      console.log('Stock query notice:', e.message);
    }

    const suggestedQty = Math.max((parseFloat(minStock) || 0) - (parseFloat(currentStock) || 0), 0);
    const reqQty = newRows[index].requested_qty || (suggestedQty > 0 ? suggestedQty : '');
    const rate = newRows[index].estimated_rate || selectedObj.rate || selectedObj.purchase_rate || '';
    const estAmt = (parseFloat(reqQty) || 0) * (parseFloat(rate) || 0);

    newRows[index] = {
      ...newRows[index],
      item_id: selectedObj.id || '',
      item_code: selectedObj.item_code || selectedObj.code || '',
      item_name: itemName,
      unit: selectedObj.unit || selectedObj.uom || 'kg',
      current_stock: currentStock,
      minimum_stock: minStock,
      suggested_qty: suggestedQty,
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
        description: '',
        requested_qty: '',
        approved_qty: '',
        unit: 'kg',
        current_stock: 0,
        minimum_stock: 0,
        suggested_qty: 0,
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

  // Calculate Totals
  const totalItemsCount = items.filter(i => i.item_name).length;
  const totalQty = items.reduce((sum, i) => sum + (parseFloat(i.requested_qty) || 0), 0);
  const totalInventoryValue = items.reduce((sum, i) => sum + ((parseFloat(i.current_stock) || 0) * (parseFloat(i.estimated_rate) || 0)), 0);
  const totalEstimatedPurchaseValue = items.reduce((sum, i) => sum + (parseFloat(i.estimated_amount) || 0), 0);

  const handleReset = () => {
    if (editId) {
      loadPurchaseRequest(editId);
    } else {
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
          description: '',
          requested_qty: '',
          approved_qty: '',
          unit: 'kg',
          current_stock: 0,
          minimum_stock: 0,
          suggested_qty: 0,
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
      godown_name: selectedGodown ? (selectedGodown.godown_name || selectedGodown.name) : '',
      priority,
      status: targetStatus,
      remarks,
      items: validItems.map(it => ({
        item_id: it.item_id || null,
        item_code: it.item_code || '',
        item_name: it.item_name,
        description: it.description,
        requested_qty: parseFloat(it.requested_qty) || 0,
        approved_qty: parseFloat(it.requested_qty) || 0,
        unit: it.unit || 'kg',
        current_stock: parseFloat(it.current_stock) || 0,
        minimum_stock: parseFloat(it.minimum_stock) || 0,
        suggested_qty: parseFloat(it.suggested_qty) || 0,
        estimated_rate: parseFloat(it.estimated_rate) || 0,
        estimated_amount: parseFloat(it.estimated_amount) || 0,
        remarks: it.remarks
      }))
    };

    setSubmitting(true);
    try {
      const url = editId ? `/api/purchase-requests/${editId}` : '/api/purchase-requests';
      const method = editId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save Purchase Request');
      }

      setSnackbar({
        open: true,
        message: data.message || `Purchase Request ${targetStatus === 'Submitted' ? 'submitted' : 'saved'} successfully!`,
        severity: 'success'
      });

      setTimeout(() => {
        navigate('/entry/purchase-request-display');
      }, 1200);
    } catch (err) {
      console.error('Error saving PR:', err);
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ p: 2, backgroundColor: '#f4f6f9', minHeight: '100vh' }}>
      {/* Module Title Header Bar */}
      <Paper
        elevation={2}
        sx={{
          p: 2,
          mb: 3,
          backgroundColor: '#1f4fb2',
          color: '#ffffff',
          borderRadius: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <PurchaseIcon sx={{ fontSize: 28 }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold', lineHeight: 1.2 }}>
              {editId ? 'Edit Purchase Request' : 'Purchase Request Creation'}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>
              BVC Inventory System — Internal Purchase Requisition
            </Typography>
          </Box>
        </Box>
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<BackIcon />}
          onClick={() => navigate('/entry/purchase-request-display')}
          sx={{ borderColor: 'rgba(255,255,255,0.6)', '&:hover': { borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.1)' } }}
        >
          View All Requests
        </Button>
      </Paper>

      {/* Header Form Card */}
      <Card elevation={2} sx={{ mb: 3, borderRadius: 1.5 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#1f4fb2', display: 'flex', alignItems: 'center', gap: 1 }}>
              <InfoIcon fontSize="small" /> Header Information
            </Typography>
            <Chip
              label={`Status: ${status}`}
              color={status === 'Submitted' ? 'warning' : status === 'Approved' ? 'success' : 'default'}
              variant="filled"
              sx={{ fontWeight: 'bold' }}
            />
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="PR No"
                value={prNo}
                onChange={(e) => setPrNo(e.target.value)}
                fullWidth
                size="small"
                required
                InputProps={{
                  readOnly: true,
                  style: { fontWeight: 'bold', backgroundColor: '#f0f4fa' }
                }}
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
                label="Required Date"
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
                label="Department"
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
                label="Priority"
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
                placeholder="Enter special justification, project code, or specific requisition notes..."
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Item Details Table Card */}
      <Card elevation={2} sx={{ mb: 3, borderRadius: 1.5 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#1f4fb2', display: 'flex', alignItems: 'center', gap: 1 }}>
              <InventoryIcon fontSize="small" /> Requested Item Details
            </Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={addRow}
              sx={{ backgroundColor: '#1f4fb2', '&:hover': { backgroundColor: '#183f91' } }}
            >
              Add Item Row
            </Button>
          </Box>

          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
            <Table size="small">
              <TableHead sx={{ backgroundColor: '#1f4fb2' }}>
                <TableRow>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold', width: '50px' }}>S.No</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold', minWidth: '200px' }}>Item Name *</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold', minWidth: '140px' }}>Weight</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold', minWidth: '140px' }}>Description</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold', width: '110px' }}>Req Qty *</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold', width: '80px' }}>Unit</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold', width: '100px' }}>Curr. Stock</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold', width: '100px' }}>Min. Stock</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold', width: '110px' }}>Suggested</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold', width: '110px' }}>Est. Rate (₹)</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold', width: '120px' }}>Est. Amount (₹)</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold', minWidth: '130px' }}>Remarks</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 'bold', width: '60px', textAlign: 'center' }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((row, idx) => (
                  <TableRow key={idx} hover sx={{ '&:nth-of-type(odd)': { backgroundColor: '#fafbfc' } }}>
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>{idx + 1}</TableCell>
                    <TableCell>
                      <TextField
                        select
                        value={row.item_name || ''}
                        onChange={(e) => handleItemSelect(idx, e.target.value)}
                        fullWidth
                        size="small"
                        variant="outlined"
                      >
                        <MenuItem value="">-- Select Item --</MenuItem>
                        {itemsList.map(it => (
                          <MenuItem key={it.id || it.item_name} value={it.item_name || it.name}>
                            {it.item_name || it.name} {it.item_code ? `(${it.item_code})` : ''}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell>
                      <TextField
                        select
                        value={row.weight || ''}
                        onChange={(e) => handleRowChange(idx, 'weight', e.target.value)}
                        fullWidth
                        size="small"
                        variant="outlined"
                      >
                        <MenuItem value="">-- Select Weight --</MenuItem>
                        {weightsList.map((w, wIdx) => (
                          <MenuItem key={w.id || wIdx} value={w.weight_name || w.name || w.weight || w.per_unit_wt}>
                            {w.weight_name || w.name || w.weight} {w.unit ? `(${w.unit})` : ''}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={row.description || ''}
                        onChange={(e) => handleRowChange(idx, 'description', e.target.value)}
                        fullWidth
                        size="small"
                        placeholder="Spec / Make"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        value={row.requested_qty}
                        onChange={(e) => handleRowChange(idx, 'requested_qty', e.target.value)}
                        fullWidth
                        size="small"
                        inputProps={{ min: 0, step: 'any', style: { fontWeight: 'bold', color: '#1f4fb2' } }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={row.unit || 'kg'}
                        onChange={(e) => handleRowChange(idx, 'unit', e.target.value)}
                        fullWidth
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={{ backgroundColor: '#f8f9fa' }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: row.current_stock < row.minimum_stock ? 'error.main' : 'text.primary' }}>
                        {row.current_stock}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ backgroundColor: '#f8f9fa' }}>
                      <Typography variant="body2">{row.minimum_stock}</Typography>
                    </TableCell>
                    <TableCell sx={{ backgroundColor: '#f8f9fa' }}>
                      <Chip
                        label={row.suggested_qty}
                        size="small"
                        color={row.suggested_qty > 0 ? 'secondary' : 'default'}
                        variant={row.suggested_qty > 0 ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        value={row.estimated_rate}
                        onChange={(e) => handleRowChange(idx, 'estimated_rate', e.target.value)}
                        fullWidth
                        size="small"
                        inputProps={{ min: 0, step: 'any' }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f0f4fa' }}>
                      ₹{(row.estimated_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={row.remarks || ''}
                        onChange={(e) => handleRowChange(idx, 'remarks', e.target.value)}
                        fullWidth
                        size="small"
                        placeholder="Note"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton color="error" size="small" onClick={() => removeRow(idx)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={1} sx={{ p: 2, borderLeft: '4px solid #1f4fb2', borderRadius: 1.5 }}>
            <Typography variant="caption" color="text.secondary">Total Requested Items</Typography>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>
              {totalItemsCount} <Typography component="span" variant="caption">Line Items</Typography>
            </Typography>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={1} sx={{ p: 2, borderLeft: '4px solid #2196f3', borderRadius: 1.5 }}>
            <Typography variant="caption" color="text.secondary">Total Quantity</Typography>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#2196f3' }}>
              {totalQty.toLocaleString('en-IN')} <Typography component="span" variant="caption">Units</Typography>
            </Typography>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={1} sx={{ p: 2, borderLeft: '4px solid #9c27b0', borderRadius: 1.5 }}>
            <Typography variant="caption" color="text.secondary">Current Inventory Value</Typography>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#9c27b0' }}>
              ₹{totalInventoryValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </Typography>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={1} sx={{ p: 2, borderLeft: '4px solid #4caf50', borderRadius: 1.5 }}>
            <Typography variant="caption" color="text.secondary">Estimated Purchase Value</Typography>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#4caf50' }}>
              ₹{totalEstimatedPurchaseValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </Typography>
          </Card>
        </Grid>
      </Grid>

      {/* Bottom Action Controls */}
      <Paper elevation={3} sx={{ p: 2, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff' }}>
        <Button
          variant="outlined"
          color="warning"
          startIcon={<ResetIcon />}
          onClick={handleReset}
          disabled={submitting}
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
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            onClick={() => handleSubmitForm('Draft')}
            disabled={submitting}
            sx={{ backgroundColor: '#2a5ea0', '&:hover': { backgroundColor: '#1d4880' } }}
          >
            Save Draft
          </Button>

          <Button
            variant="contained"
            color="success"
            startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
            onClick={() => handleSubmitForm('Submitted')}
            disabled={submitting}
            sx={{ px: 3, fontWeight: 'bold' }}
          >
            Submit for Approval
          </Button>
        </Box>
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PurchaseRequestCreate;
