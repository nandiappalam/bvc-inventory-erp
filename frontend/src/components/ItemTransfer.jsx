import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Container,
  Paper,
  Grid,
  Typography,
  TextField,
  MenuItem,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab
} from '@mui/material';
import {
  CompareArrows as TransferIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Print as PrintIcon,
  FileDownload as ExportIcon,
  Search as SearchIcon,
  RestartAlt as ResetIcon,
  Warehouse as GodownIcon,
  Inventory as ItemIcon,
  Scale as ScaleIcon,
  CurrencyRupee as CurrencyRupeeIcon,
  Visibility as ViewIcon,
  ListAlt as ListIcon,
  CheckCircle as SuccessIcon
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { printHtml } from '../utils/printHelper';

const ItemTransfer = ({ initialView = 'create' }) => {
  const [activeTab, setActiveTab] = useState(initialView === 'display' ? 'display' : 'create');

  // Godowns list & source items
  const [godowns, setGodowns] = useState([]);
  const [godownItems, setGodownItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Form State
  const [formData, setFormData] = useState({
    transfer_no: 'TRF-1',
    date: new Date().toISOString().split('T')[0],
    from_godown_id: '',
    from_godown_name: '',
    to_godown_id: '',
    to_godown_name: '',
    selected_item_key: '',
    item_id: '',
    item_code: '',
    item_name: '',
    lot_no: '',
    weight: '',
    unit: 'kg',
    available_qty: 0,
    transfer_qty: '',
    transfer_weight: '',
    rate: 0,
    remarks: '',
    created_by: 'Admin'
  });

  const fetchNextTransferNo = useCallback(async () => {
    try {
      const res = await fetch('/api/item-transfers/next-sno');
      const data = await res.json();
      if (data && (data.next_transfer_no || data.next_s_no)) {
        setFormData((prev) => ({ ...prev, transfer_no: data.next_transfer_no || data.next_s_no }));
      }
    } catch (err) {
      console.error('Error fetching next transfer number:', err);
    }
  }, []);

  // Staged Items state for multi-item transfers
  const [stagedItems, setStagedItems] = useState([]);

  // Transfer History State
  const [transfersList, setTransfersList] = useState([]);
  const [loadingTransfers, setLoadingTransfers] = useState(false);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    fromGodown: '',
    toGodown: '',
    item: '',
    lotNo: ''
  });

  // Detail Modal State
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [openModal, setOpenModal] = useState(false);

  // Pagination for Register Table
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Load Godowns on Mount & Next Transfer No
  useEffect(() => {
    fetch('/api/godowns')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setGodowns(data);
      })
      .catch((err) => console.error('Error fetching godowns:', err));

    fetchNextTransferNo();
  }, [fetchNextTransferNo]);

  // Fetch Available Items when Source Godown changes
  const handleFromGodownChange = async (godownId) => {
    const selectedG = godowns.find((g) => String(g.id) === String(godownId));
    const gName = selectedG ? selectedG.godown_name : '';

    setFormData((prev) => ({
      ...prev,
      from_godown_id: godownId,
      from_godown_name: gName,
      selected_item_key: '',
      item_id: '',
      item_code: '',
      item_name: '',
      lot_no: '',
      weight: '',
      unit: 'kg',
      available_qty: 0,
      transfer_qty: '',
      transfer_weight: '',
      rate: 0
    }));

    setStagedItems([]);

    if (!godownId) {
      setGodownItems([]);
      return;
    }

    setLoadingItems(true);
    try {
      const res = await fetch(`/api/item-transfers/godown-items/${godownId}`);
      const data = await res.json();

      if (data && Array.isArray(data.items)) {
        setGodownItems(data.items);
      } else {
        setGodownItems([]);
      }
    } catch (err) {
      console.error('Error fetching items for godown:', err);
      setGodownItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  // Handle Item Selection from Dropdown
  const handleItemSelect = (itemKey) => {
    if (!itemKey) {
      setFormData((prev) => ({
        ...prev,
        selected_item_key: '',
        item_id: '',
        item_code: '',
        item_name: '',
        lot_no: '',
        weight: '',
        unit: 'kg',
        available_qty: 0,
        transfer_qty: '',
        transfer_weight: '',
        rate: 0
      }));
      return;
    }

    const [iName, lNo] = itemKey.split('||');
    const matched = godownItems.find((i) => i.item_name === iName && i.lot_no === lNo);

    if (matched) {
      const unitWt = parseFloat(matched.weight || matched.per_unit_weight || 1);
      const avail = parseFloat(matched.available_qty || matched.qty || 0);
      const rate = parseFloat(matched.rate || matched.purchase_rate || 0);

      setFormData((prev) => ({
        ...prev,
        selected_item_key: itemKey,
        item_id: matched.item_id || matched.id || '',
        item_code: matched.item_code || `ITM-${matched.item_id || 101}`,
        item_name: matched.item_name,
        lot_no: matched.lot_no,
        weight: unitWt,
        unit: matched.unit || 'kg',
        available_qty: avail,
        rate: rate,
        transfer_qty: '',
        transfer_weight: ''
      }));
    }
  };

  // Handle Qty Input
  const handleTransferQtyChange = (val) => {
    const qty = parseFloat(val) || 0;
    const unitWt = parseFloat(formData.weight) || 1;
    const calcWeight = (qty * unitWt).toFixed(2);

    setFormData((prev) => ({
      ...prev,
      transfer_qty: val,
      transfer_weight: qty > 0 ? calcWeight : ''
    }));
  };

  // Add Item to Staged Transfer Table
  const handleAddItemToTransfer = () => {
    setMessage({ type: '', text: '' });

    if (!formData.item_name) {
      setMessage({ type: 'error', text: 'Please select an Item from the dropdown' });
      return;
    }

    const trfQty = parseFloat(formData.transfer_qty) || 0;
    if (trfQty <= 0) {
      setMessage({ type: 'error', text: 'Transfer quantity must be greater than 0' });
      return;
    }

    if (trfQty > formData.available_qty) {
      setMessage({ type: 'error', text: `Transfer quantity (${trfQty}) cannot exceed available stock (${formData.available_qty})` });
      return;
    }

    // Check if item+lot already staged
    const exists = stagedItems.some((i) => i.item_name === formData.item_name && i.lot_no === formData.lot_no);
    if (exists) {
      setMessage({ type: 'error', text: 'This item & lot is already added to the transfer list below.' });
      return;
    }

    const unitWt = parseFloat(formData.weight) || 1;
    const totalWt = (trfQty * unitWt).toFixed(2);
    const rate = parseFloat(formData.rate) || 0;
    const totalAmt = (trfQty * rate).toFixed(2);

    const newItem = {
      id: Date.now(),
      item_id: formData.item_id,
      item_code: formData.item_code,
      item_name: formData.item_name,
      lot_no: formData.lot_no,
      weight: unitWt,
      unit: formData.unit || 'kg',
      available_qty: formData.available_qty,
      transfer_qty: trfQty,
      transfer_weight: parseFloat(totalWt),
      rate: rate,
      amount: parseFloat(totalAmt)
    };

    setStagedItems((prev) => [...prev, newItem]);

    // Reset item selection
    setFormData((prev) => ({
      ...prev,
      selected_item_key: '',
      item_id: '',
      item_code: '',
      item_name: '',
      lot_no: '',
      weight: '',
      unit: 'kg',
      available_qty: 0,
      transfer_qty: '',
      transfer_weight: '',
      rate: 0
    }));
  };

  const handleRemoveStagedItem = (id) => {
    setStagedItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Handle Destination Godown Select
  const handleToGodownChange = (godownId) => {
    const selectedG = godowns.find((g) => String(g.id) === String(godownId));
    setFormData((prev) => ({
      ...prev,
      to_godown_id: godownId,
      to_godown_name: selectedG ? selectedG.godown_name : ''
    }));
  };

  // Save Transfer Submission
  const handleSaveTransfer = async (e) => {
    if (e) e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!formData.from_godown_id || !formData.to_godown_id) {
      setMessage({ type: 'error', text: 'Please select both Source (From Godown) and Destination (To Godown)' });
      return;
    }

    if (String(formData.from_godown_id) === String(formData.to_godown_id)) {
      setMessage({ type: 'error', text: 'Source and Destination Godown cannot be the same!' });
      return;
    }

    // Determine items to submit
    let itemsToSubmit = [...stagedItems];
    if (itemsToSubmit.length === 0) {
      if (!formData.item_name) {
        setMessage({ type: 'error', text: 'Please select an Item and add it to the transfer list' });
        return;
      }
      const trfQty = parseFloat(formData.transfer_qty) || 0;
      if (trfQty <= 0) {
        setMessage({ type: 'error', text: 'Transfer quantity must be greater than 0' });
        return;
      }
      if (trfQty > formData.available_qty) {
        setMessage({ type: 'error', text: `Transfer quantity (${trfQty}) cannot exceed available stock (${formData.available_qty})` });
        return;
      }
      const unitWt = parseFloat(formData.weight) || 1;
      itemsToSubmit.push({
        item_id: formData.item_id,
        item_code: formData.item_code,
        item_name: formData.item_name,
        lot_no: formData.lot_no,
        weight: unitWt,
        unit: formData.unit,
        available_qty: formData.available_qty,
        transfer_qty: trfQty,
        transfer_weight: (trfQty * unitWt).toFixed(2),
        rate: formData.rate,
        amount: (trfQty * formData.rate).toFixed(2),
        remarks: formData.remarks
      });
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        items: itemsToSubmit
      };

      const res = await fetch('/api/item-transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data && (data.success || data.id || data.transfer_no)) {
        setMessage({ type: 'success', text: `Item Transfer #${data.transfer_no || formData.transfer_no} recorded successfully!` });

        // Reset form
        setFormData({
          transfer_no: 'TRF-1',
          date: new Date().toISOString().split('T')[0],
          from_godown_id: '',
          from_godown_name: '',
          to_godown_id: '',
          to_godown_name: '',
          selected_item_key: '',
          item_id: '',
          item_code: '',
          item_name: '',
          lot_no: '',
          weight: '',
          unit: 'kg',
          available_qty: 0,
          transfer_qty: '',
          transfer_weight: '',
          rate: 0,
          remarks: '',
          created_by: 'Admin'
        });
        setStagedItems([]);
        setGodownItems([]);
        fetchNextTransferNo();

        // Refresh List if loaded
        fetchTransfers();
      } else {
        setMessage({ type: 'error', text: data?.message || 'Failed to record item transfer' });
      }
    } catch (err) {
      console.error('Error saving item transfer:', err);
      setMessage({ type: 'error', text: 'Network/server error while saving transfer' });
    } finally {
      setSaving(false);
    }
  };

  // Fetch Transfers List for Register View
  const fetchTransfers = async () => {
    setLoadingTransfers(true);
    try {
      const params = new URLSearchParams();
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.fromGodown) params.append('fromGodown', filters.fromGodown);
      if (filters.toGodown) params.append('toGodown', filters.toGodown);
      if (filters.item) params.append('item', filters.item);
      if (filters.lotNo) params.append('lotNo', filters.lotNo);

      const res = await fetch(`/api/item-transfers?${params.toString()}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.data || [];
      setTransfersList(list);
    } catch (err) {
      console.error('Error loading transfer history:', err);
      setTransfersList([]);
    } finally {
      setLoadingTransfers(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'display') {
      fetchTransfers();
    }
  }, [activeTab]);

  // Handle Delete Transfer
  const handleDeleteTransfer = async (id) => {
    if (!window.confirm('Are you sure you want to delete this transfer voucher? Stock will be reverted.')) return;
    try {
      const res = await fetch(`/api/item-transfers/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data && (data.success || data.message)) {
        alert('Transfer voucher deleted successfully');
        fetchTransfers();
      } else {
        alert('Delete failed: ' + (data?.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error deleting transfer:', err);
      alert('Error deleting transfer voucher');
    }
  };

  // Print Voucher Detail
  const handlePrintVoucher = (row) => {
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 25px; color: #1e293b;">
        <div style="text-align: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #1e3a8a; text-transform: uppercase;">BVC ERP - Inter-Godown Item Transfer Voucher</h2>
          <p style="margin: 5px 0 0 0; color: #64748b;">Voucher No: <strong>${row.transfer_no || row.id}</strong> | Date: <strong>${row.date || ''}</strong></p>
        </div>

        <table style="width: 100%; margin-bottom: 20px; font-size: 13px; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; border: 1px solid #cbd5e1; width: 50%; bg-color: #f8fafc;">
              <strong>Source Godown (From):</strong><br/>
              <span style="font-size: 15px; color: #1e3a8a; font-weight: bold;">📍 ${row.from_godown_name || 'N/A'}</span>
            </td>
            <td style="padding: 8px; border: 1px solid #cbd5e1; width: 50%; bg-color: #f8fafc;">
              <strong>Destination Godown (To):</strong><br/>
              <span style="font-size: 15px; color: #15803d; font-weight: bold;">🚚 ${row.to_godown_name || 'N/A'}</span>
            </td>
          </tr>
        </table>

        <h3 style="color: #334155; font-size: 14px; text-transform: uppercase; margin-bottom: 10px;">Transferred Item Details</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background-color: #1e293b; color: white;">
              <th style="padding: 8px; border: 1px solid #334155;">Item Name</th>
              <th style="padding: 8px; border: 1px solid #334155;">Lot No</th>
              <th style="padding: 8px; border: 1px solid #334155;">Unit Wt</th>
              <th style="padding: 8px; border: 1px solid #334155; text-align: right;">Transfer Qty</th>
              <th style="padding: 8px; border: 1px solid #334155; text-align: right;">Total Weight</th>
              <th style="padding: 8px; border: 1px solid #334155; text-align: right;">Rate</th>
              <th style="padding: 8px; border: 1px solid #334155; text-align: right;">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">${row.item_name || 'N/A'}</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; font-family: monospace;">${row.lot_no || 'N/A'}</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1;">${row.weight || 0} ${row.unit || 'kg'}</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: #1e3a8a;">${row.transfer_qty || row.qty || 0}</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">${((row.transfer_qty || 0) * (row.weight || 1)).toFixed(2)} Kg</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">₹${row.rate || 0}</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: #15803d;">₹${row.amount || ((row.transfer_qty || 0) * (row.rate || 0)).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        ${row.remarks ? `<p style="margin-top: 15px; font-size: 12px; color: #475569;"><strong>Remarks:</strong> ${row.remarks}</p>` : ''}

        <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px; font-weight: bold;">
          <div>Prepared By: _________________</div>
          <div>Authorized Signature: _________________</div>
        </div>
      </div>
    `;
    printHtml(html, `Transfer_${row.transfer_no || row.id}`);
  };

  // Export Transfers Register to Excel
  const handleExportTransfersExcel = () => {
    const exportRows = transfersList.map((t, idx) => ({
      'S.No': idx + 1,
      'Transfer No': t.transfer_no || `TRF-${t.id}`,
      'Date': t.date || '',
      'Source Godown': t.from_godown_name || '',
      'Destination Godown': t.to_godown_name || '',
      'Item Name': t.item_name || '',
      'Lot Number': t.lot_no || '',
      'Transfer Qty': t.transfer_qty || t.qty || 0,
      'Weight (Kg)': ((t.transfer_qty || 0) * (t.weight || 1)).toFixed(2),
      'Rate (₹)': t.rate || 0,
      'Total Amount (₹)': t.amount || 0,
      'Remarks': t.remarks || '',
      'Created By': t.created_by || 'Admin'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Item Transfers');
    XLSX.writeFile(workbook, `Item_Transfers_Register_${new Date().toISOString().substring(0, 10)}.xlsx`);
  };

  // Register KPI Totals
  const registerTotals = useMemo(() => {
    const totalQty = transfersList.reduce((acc, curr) => acc + (parseFloat(curr.transfer_qty || curr.qty || 0)), 0);
    const totalWt = transfersList.reduce((acc, curr) => acc + ((parseFloat(curr.transfer_qty || curr.qty || 0)) * (parseFloat(curr.weight || 1))), 0);
    const totalAmt = transfersList.reduce((acc, curr) => acc + (parseFloat(curr.amount || 0)), 0);
    return { totalQty, totalWt, totalAmt };
  }, [transfersList]);

  return (
    <Container maxWidth={false} sx={{ py: 3, px: { xs: 2, sm: 3 } }}>
      {/* ================= HEADER & TAB BAR ================= */}
      <Paper elevation={0} sx={{ p: 2.5, mb: 3, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Box sx={{ bgcolor: '#eff6ff', p: 1.25, borderRadius: 2, color: '#2563eb', display: 'flex' }}>
              <TransferIcon sx={{ fontSize: 28 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                Item Transfer / Inter-Godown Movement
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
                Transfer inventory stock & lot quantities seamlessly between Godown storage locations
              </Typography>
            </Box>
          </Box>

          <Box display="flex" alignItems="center" gap={2}>
            <Tabs
              value={activeTab}
              onChange={(e, newTab) => setActiveTab(newTab)}
              sx={{
                bgcolor: '#f1f5f9',
                p: 0.5,
                borderRadius: 2,
                minHeight: 40,
                '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, borderRadius: 1.5, minHeight: 34, px: 2, py: 0.5 }
              }}
            >
              <Tab value="create" label="New Item Transfer" icon={<AddIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
              <Tab value="display" label="Transfer Register & Logs" icon={<ListIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
            </Tabs>
          </Box>
        </Stack>
      </Paper>

      {/* Alert Messages */}
      {message.text && (
        <Alert severity={message.type === 'error' ? 'error' : 'success'} sx={{ mb: 3, borderRadius: 2 }} onClose={() => setMessage({ type: '', text: '' })}>
          {message.text}
        </Alert>
      )}

      {/* ================= TAB 1: CREATE ITEM TRANSFER ================= */}
      {activeTab === 'create' && (
        <form onSubmit={handleSaveTransfer}>
          <Stack spacing={3}>
            {/* SECTION 1: Transfer Voucher Information */}
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2} pb={1.5} borderBottom="1px solid #f1f5f9">
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', tracking: '0.5px', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <GodownIcon sx={{ color: '#2563eb', fontSize: 20 }} />
                  1. Transfer Information
                </Typography>
                <Chip label={`Voucher No: ${formData.transfer_no}`} size="small" sx={{ fontFamily: 'monospace', fontWeight: 800, bgcolor: '#f1f5f9' }} />
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Transfer No"
                    required
                    value={formData.transfer_no}
                    onChange={(e) => setFormData({ ...formData, transfer_no: e.target.value })}
                    inputProps={{ style: { fontFamily: 'monospace', fontWeight: 700 } }}
                    sx={{ bgcolor: '#f8fafc' }}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    type="date"
                    fullWidth
                    size="small"
                    label="Transfer Date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    sx={{ bgcolor: '#f8fafc' }}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="From Godown (Source)"
                    required
                    value={formData.from_godown_id}
                    onChange={(e) => handleFromGodownChange(e.target.value)}
                    sx={{ bgcolor: '#f8fafc' }}
                  >
                    <MenuItem value="">-- Select Source Godown --</MenuItem>
                    {godowns.map((g) => (
                      <MenuItem key={g.id} value={String(g.id)}>
                        📍 {g.godown_name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="To Godown (Destination)"
                    required
                    value={formData.to_godown_id}
                    onChange={(e) => handleToGodownChange(e.target.value)}
                    sx={{ bgcolor: '#f8fafc' }}
                  >
                    <MenuItem value="">-- Select Destination Godown --</MenuItem>
                    {godowns.map((g) => (
                      <MenuItem key={g.id} value={String(g.id)} disabled={String(g.id) === String(formData.from_godown_id)}>
                        📍 {g.godown_name} {String(g.id) === String(formData.from_godown_id) ? '(Source)' : ''}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Remarks / Vehicle Info / Notes"
                    placeholder="Enter transfer instructions or vehicle number..."
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    sx={{ bgcolor: '#f8fafc' }}
                  />
                </Grid>
              </Grid>
            </Paper>

            {/* SECTION 2: Select & Add Item */}
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2} pb={1.5} borderBottom="1px solid #f1f5f9">
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', tracking: '0.5px', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ItemIcon sx={{ color: '#2563eb', fontSize: 20 }} />
                  2. Select Item from Source Godown
                </Typography>
                {formData.from_godown_name && (
                  <Chip label={`Source: ${formData.from_godown_name}`} size="small" color="primary" variant="outlined" sx={{ fontWeight: 700 }} />
                )}
              </Box>

              <Grid container spacing={2} alignItems="center">
                {/* Select Item Dropdown */}
                <Grid item xs={12} md={6}>
                  {!formData.from_godown_id ? (
                    <Alert severity="warning" sx={{ py: 0.5, borderRadius: 1.5 }}>
                      Please select "From Godown (Source)" in Section 1 above to load available items.
                    </Alert>
                  ) : loadingItems ? (
                    <Box display="flex" alignItems="center" gap={1.5} p={1} bgcolor="#eff6ff" borderRadius={1.5}>
                      <CircularProgress size={20} />
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#1d4ed8' }}>
                        Loading available stock items in {formData.from_godown_name}...
                      </Typography>
                    </Box>
                  ) : godownItems.length === 0 ? (
                    <Alert severity="error" sx={{ py: 0.5, borderRadius: 1.5 }}>
                      No available stock items found in selected Source Godown.
                    </Alert>
                  ) : (
                    <TextField
                      select
                      fullWidth
                      size="small"
                      label="Select Available Item & Lot"
                      value={formData.selected_item_key}
                      onChange={(e) => handleItemSelect(e.target.value)}
                      sx={{ bgcolor: '#f8fafc' }}
                    >
                      <MenuItem value="">-- Select Item & Lot Number --</MenuItem>
                      {godownItems.map((itm) => {
                        const key = `${itm.item_name}||${itm.lot_no}`;
                        return (
                          <MenuItem key={key} value={key}>
                            {itm.label || `${itm.item_name} (${itm.weight}kg) - Lot: ${itm.lot_no} - Avail: ${itm.available_qty} ${itm.unit || 'kg'}`}
                          </MenuItem>
                        );
                      })}
                    </TextField>
                  )}
                </Grid>

                {/* Transfer Qty & Weight Inputs */}
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    type="number"
                    fullWidth
                    size="small"
                    label="Transfer Qty (Units)"
                    placeholder="Qty"
                    disabled={!formData.item_name}
                    value={formData.transfer_qty}
                    onChange={(e) => handleTransferQtyChange(e.target.value)}
                    inputProps={{ step: "any", min: 0.01, max: formData.available_qty }}
                    sx={{ bgcolor: '#ffffff' }}
                  />
                  {formData.available_qty > 0 && (
                    <Typography variant="caption" sx={{ color: parseFloat(formData.transfer_qty) > formData.available_qty ? '#dc2626' : '#64748b', fontWeight: 600, mt: 0.5, display: 'block' }}>
                      Avail Stock: {formData.available_qty} {parseFloat(formData.transfer_qty) > formData.available_qty && '⚠️ Exceeds Available Qty!'}
                    </Typography>
                  )}
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    type="number"
                    fullWidth
                    size="small"
                    label="Transfer Weight (Kg)"
                    placeholder="Auto calculated"
                    disabled={!formData.item_name}
                    value={formData.transfer_weight}
                    onChange={(e) => setFormData({ ...formData, transfer_weight: e.target.value })}
                    inputProps={{ step: "any" }}
                    sx={{ bgcolor: '#f8fafc' }}
                  />
                </Grid>
              </Grid>

              {/* Selected Item Overview Chip Panel */}
              {formData.item_name && (
                <Box mt={2} p={2} bgcolor="#f0f9ff" borderRadius={2} border="1px solid #bae6fd" display="flex" flexWrap="wrap" alignItems="center" justifyContent="space-between" gap={2}>
                  <Stack direction="row" spacing={3} flexWrap="wrap">
                    <Box>
                      <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                        Selected Item
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                        {formData.item_name} ({formData.item_code})
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                        Lot Number
                      </Typography>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 800, color: '#2563eb' }}>
                        {formData.lot_no}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                        Unit Weight
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155' }}>
                        {formData.weight} {formData.unit}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                        Available Stock
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 900, color: '#0284c7' }}>
                        {formData.available_qty} units
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                        Cost Rate
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#15803d' }}>
                        ₹{formData.rate}
                      </Typography>
                    </Box>
                  </Stack>

                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleAddItemToTransfer}
                    sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 800, bgcolor: '#2563eb', px: 3 }}
                  >
                    Add Item to Table
                  </Button>
                </Box>
              )}
            </Paper>

            {/* SECTION 3: Staged Items Table */}
            <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid #e2e8f0', overflow: 'hidden', bgcolor: '#ffffff' }}>
              <Box p={2} bgcolor="#f8fafc" borderBottom="1px solid #e2e8f0" display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', tracking: '0.5px', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ListIcon sx={{ color: '#2563eb', fontSize: 18 }} />
                  3. Staged Transfer Items List ({stagedItems.length})
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                  Multiple items will be transferred in a single transaction
                </Typography>
              </Box>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { bgcolor: '#f1f5f9', color: '#334155', fontWeight: 800, textTransform: 'uppercase', fontSize: '11px' } }}>
                      <TableCell align="center" width="50">S.No</TableCell>
                      <TableCell>Item Code</TableCell>
                      <TableCell>Item Name</TableCell>
                      <TableCell align="right">Unit Wt</TableCell>
                      <TableCell>Lot Number</TableCell>
                      <TableCell align="right">Avail Qty</TableCell>
                      <TableCell align="right" sx={{ bgcolor: '#e0f2fe !important', color: '#0369a1 !important' }}>Transfer Qty</TableCell>
                      <TableCell align="right">Total Wt (Kg)</TableCell>
                      <TableCell align="right">Rate (₹)</TableCell>
                      <TableCell align="right" sx={{ bgcolor: '#dcfce7 !important', color: '#15803d !important' }}>Total Amount (₹)</TableCell>
                      <TableCell align="center" width="70">Action</TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {stagedItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} align="center" sx={{ py: 6, color: '#94a3b8' }}>
                          No items added to the transfer voucher list yet. Select an item above and click "Add Item to Table".
                        </TableCell>
                      </TableRow>
                    ) : (
                      stagedItems.map((item, idx) => (
                        <TableRow key={item.id || idx} hover>
                          <TableCell align="center" sx={{ color: '#94a3b8', fontSize: '11px' }}>
                            {idx + 1}
                          </TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', color: '#64748b', fontSize: '11px' }}>{item.item_code}</TableCell>
                          <TableCell sx={{ fontWeight: 800, color: '#0f172a' }}>{item.item_name}</TableCell>
                          <TableCell align="right" sx={{ color: '#475569' }}>
                            {item.weight} {item.unit}
                          </TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>{item.lot_no}</TableCell>
                          <TableCell align="right" sx={{ color: '#64748b' }}>{item.available_qty}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 900, color: '#0284c7', bgcolor: '#f0f9ff' }}>
                            {item.transfer_qty}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: '#334155' }}>
                            {item.transfer_weight} Kg
                          </TableCell>
                          <TableCell align="right" sx={{ color: '#475569' }}>
                            ₹{item.rate}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 900, color: '#15803d', bgcolor: '#f0fdf4' }}>
                            ₹{item.amount.toFixed(2)}
                          </TableCell>
                          <TableCell align="center">
                            <IconButton size="small" color="error" onClick={() => handleRemoveStagedItem(item.id)}>
                              <DeleteIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>

                  {/* Footer Totals */}
                  {stagedItems.length > 0 && (
                    <TableHead>
                      <TableRow sx={{ '& th': { bgcolor: '#e2e8f0', color: '#0f172a', fontWeight: 900, fontSize: '12px' } }}>
                        <TableCell colSpan={6} align="right" sx={{ textTransform: 'uppercase' }}>
                          Voucher Totals:
                        </TableCell>
                        <TableCell align="right" sx={{ color: '#0369a1 !important', bgcolor: '#bae6fd !important' }}>
                          {stagedItems.reduce((acc, i) => acc + (parseFloat(i.transfer_qty) || 0), 0)}
                        </TableCell>
                        <TableCell align="right">
                          {stagedItems.reduce((acc, i) => acc + (parseFloat(i.transfer_weight) || 0), 0).toFixed(2)} Kg
                        </TableCell>
                        <TableCell align="right">-</TableCell>
                        <TableCell align="right" sx={{ color: '#15803d !important', bgcolor: '#bbf7d0 !important' }}>
                          ₹{stagedItems.reduce((acc, i) => acc + (parseFloat(i.amount) || 0), 0).toFixed(2)}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableHead>
                  )}
                </Table>
              </TableContainer>
            </Paper>

            {/* SECTION 4: Bottom Action Bar */}
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                  {stagedItems.length > 0
                    ? `${stagedItems.length} item(s) staged for inter-godown transfer.`
                    : 'Fill item details above and add to list.'}
                </Typography>

                <Stack direction="row" spacing={2}>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setStagedItems([]);
                      setFormData({
                        transfer_no: 'TRF-1',
                        date: new Date().toISOString().split('T')[0],
                        from_godown_id: '',
                        from_godown_name: '',
                        to_godown_id: '',
                        to_godown_name: '',
                        selected_item_key: '',
                        item_id: '',
                        item_code: '',
                        item_name: '',
                        lot_no: '',
                        weight: '',
                        unit: 'kg',
                        available_qty: 0,
                        transfer_qty: '',
                        transfer_weight: '',
                        rate: 0,
                        remarks: '',
                        created_by: 'Admin'
                      });
                      setGodownItems([]);
                      fetchNextTransferNo();
                    }}
                    sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 700 }}
                  >
                    Reset Voucher
                  </Button>

                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={saving}
                    startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <TransferIcon />}
                    sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 800, bgcolor: '#2563eb', px: 4 }}
                  >
                    {saving ? 'Processing Transfer...' : 'Save Item Transfer'}
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          </Stack>
        </form>
      )}

      {/* ================= TAB 2: ITEM TRANSFER REGISTER / LOGS ================= */}
      {activeTab === 'display' && (
        <Stack spacing={3}>
          {/* Filters Card */}
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#334155', textTransform: 'uppercase', tracking: '0.5px', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <SearchIcon sx={{ fontSize: 18, color: '#2563eb' }} />
              Filter Item Transfers
            </Typography>

            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6} md={2}>
                <TextField
                  type="date"
                  fullWidth
                  size="small"
                  label="Date From"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  sx={{ bgcolor: '#f8fafc' }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <TextField
                  type="date"
                  fullWidth
                  size="small"
                  label="Date To"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  sx={{ bgcolor: '#f8fafc' }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="From Godown"
                  value={filters.fromGodown}
                  onChange={(e) => setFilters({ ...filters, fromGodown: e.target.value })}
                  sx={{ bgcolor: '#f8fafc' }}
                >
                  <MenuItem value="">All Source Godowns</MenuItem>
                  {godowns.map((g) => (
                    <MenuItem key={g.id} value={String(g.id)}>
                      📍 {g.godown_name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="To Godown"
                  value={filters.toGodown}
                  onChange={(e) => setFilters({ ...filters, toGodown: e.target.value })}
                  sx={{ bgcolor: '#f8fafc' }}
                >
                  <MenuItem value="">All Destination Godowns</MenuItem>
                  {godowns.map((g) => (
                    <MenuItem key={g.id} value={String(g.id)}>
                      📍 {g.godown_name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  label="Search Item"
                  placeholder="Item Name/Code..."
                  value={filters.item}
                  onChange={(e) => setFilters({ ...filters, item: e.target.value })}
                  sx={{ bgcolor: '#f8fafc' }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <Stack direction="row" spacing={1}>
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={fetchTransfers}
                    startIcon={<SearchIcon />}
                    sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 700, bgcolor: '#2563eb' }}
                  >
                    Search
                  </Button>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => {
                      setFilters({ dateFrom: '', dateTo: '', fromGodown: '', toGodown: '', item: '', lotNo: '' });
                      fetchTransfers();
                    }}
                    startIcon={<ResetIcon />}
                    sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 700 }}
                  >
                    Reset
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </Paper>

          {/* KPI Summary Cards */}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Transfers Logged
                  </Typography>
                  <TransferIcon sx={{ color: '#2563eb', fontSize: 20 }} />
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', mt: 0.5 }}>
                  {transfersList.length}
                </Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 500 }}>
                  Recorded Vouchers
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#f0f9ff' }}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>
                    Total Transferred Qty
                  </Typography>
                  <ItemIcon sx={{ color: '#0284c7', fontSize: 20 }} />
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 900, color: '#0369a1', mt: 0.5 }}>
                  {registerTotals.totalQty.toLocaleString()}
                </Typography>
                <Typography variant="caption" sx={{ color: '#0284c7', fontWeight: 600 }}>
                  Units Transferred
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Total Transferred Wt
                  </Typography>
                  <ScaleIcon sx={{ color: '#ea580c', fontSize: 20 }} />
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', mt: 0.5 }}>
                  {registerTotals.totalWt.toFixed(1)} <Typography component="span" variant="caption" sx={{ fontWeight: 700 }}>Kg</Typography>
                </Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 500 }}>
                  Total Weight (Kg)
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#f0fdf4' }}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#15803d', textTransform: 'uppercase' }}>
                    Total Transfer Value
                  </Typography>
                  <CurrencyRupeeIcon sx={{ color: '#16a34a', fontSize: 20 }} />
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 900, color: '#15803d', mt: 0.5 }}>
                  ₹{registerTotals.totalAmt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </Typography>
                <Typography variant="caption" sx={{ color: '#16a34a', fontWeight: 600 }}>
                  Stock Valuation
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Transfers Table List */}
          <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid #e2e8f0', overflow: 'hidden', bgcolor: '#ffffff' }}>
            <Box p={2} bgcolor="#f8fafc" borderBottom="1px solid #e2e8f0" display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', tracking: '0.5px' }}>
                Item Transfer Vouchers ({transfersList.length})
              </Typography>
              <Button
                variant="outlined"
                color="success"
                size="small"
                startIcon={<ExportIcon />}
                onClick={handleExportTransfersExcel}
                sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 700 }}
              >
                Export Register
              </Button>
            </Box>

            {loadingTransfers ? (
              <Box display="flex" justifyContent="center" alignItems="center" py={8}>
                <CircularProgress size={36} />
                <Typography variant="body2" sx={{ ml: 2, color: '#64748b', fontWeight: 600 }}>
                  Loading Transfer Records...
                </Typography>
              </Box>
            ) : (
              <>
                <TableContainer sx={{ maxHeight: 650 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow sx={{ '& th': { bgcolor: '#f1f5f9', color: '#334155', fontWeight: 800, textTransform: 'uppercase', fontSize: '11px' } }}>
                        <TableCell align="center" width="50">S.No</TableCell>
                        <TableCell>Transfer No</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>From Godown (Source)</TableCell>
                        <TableCell>To Godown (Destination)</TableCell>
                        <TableCell>Item Name</TableCell>
                        <TableCell>Lot Number</TableCell>
                        <TableCell align="right" sx={{ bgcolor: '#e0f2fe !important', color: '#0369a1 !important' }}>Transfer Qty</TableCell>
                        <TableCell align="right">Weight (Kg)</TableCell>
                        <TableCell align="right">Rate (₹)</TableCell>
                        <TableCell align="right" sx={{ bgcolor: '#dcfce7 !important', color: '#15803d !important' }}>Amount (₹)</TableCell>
                        <TableCell align="center" width="120">Actions</TableCell>
                      </TableRow>
                    </TableHead>

                    <TableBody>
                      {transfersList.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={12} align="center" sx={{ py: 6, color: '#94a3b8' }}>
                            No item transfers recorded yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        transfersList.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, idx) => {
                          const trfQty = parseFloat(row.transfer_qty || row.qty || 0);
                          const unitWt = parseFloat(row.weight || 1);
                          const totalWt = (trfQty * unitWt).toFixed(2);
                          const amt = parseFloat(row.amount || (trfQty * (row.rate || 0))).toFixed(2);

                          return (
                            <TableRow key={row.id || idx} hover>
                              <TableCell align="center" sx={{ color: '#94a3b8', fontSize: '11px' }}>
                                {page * rowsPerPage + idx + 1}
                              </TableCell>
                              <TableCell sx={{ fontFamily: 'monospace', fontWeight: 800, color: '#0f172a' }}>
                                {row.transfer_no || `TRF-${row.id}`}
                              </TableCell>
                              <TableCell sx={{ color: '#475569', fontSize: '11px' }}>{row.date ? row.date.substring(0, 10) : ''}</TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#1e3a8a' }}>📍 {row.from_godown_name}</TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#15803d' }}>🚚 {row.to_godown_name}</TableCell>
                              <TableCell sx={{ fontWeight: 800, color: '#1e293b' }}>{row.item_name}</TableCell>
                              <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>{row.lot_no}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 900, color: '#0284c7', bgcolor: '#f0f9ff' }}>
                                {trfQty}
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700, color: '#334155' }}>
                                {totalWt} Kg
                              </TableCell>
                              <TableCell align="right" sx={{ color: '#475569' }}>
                                ₹{row.rate || 0}
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 900, color: '#15803d', bgcolor: '#f0fdf4' }}>
                                ₹{parseFloat(amt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell align="center">
                                <Stack direction="row" spacing={0.5} justifyContent="center">
                                  <Tooltip title="View Details / Voucher">
                                    <IconButton
                                      size="small"
                                      color="primary"
                                      onClick={() => {
                                        setSelectedVoucher(row);
                                        setOpenModal(true);
                                      }}
                                    >
                                      <ViewIcon sx={{ fontSize: 18 }} />
                                    </IconButton>
                                  </Tooltip>

                                  <Tooltip title="Print Voucher">
                                    <IconButton size="small" onClick={() => handlePrintVoucher(row)}>
                                      <PrintIcon sx={{ fontSize: 18, color: '#334155' }} />
                                    </IconButton>
                                  </Tooltip>

                                  <Tooltip title="Delete Voucher">
                                    <IconButton size="small" color="error" onClick={() => handleDeleteTransfer(row.id)}>
                                      <DeleteIcon sx={{ fontSize: 18 }} />
                                    </IconButton>
                                  </Tooltip>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>

                    {/* Table Footer Totals */}
                    {transfersList.length > 0 && (
                      <TableHead>
                        <TableRow sx={{ '& th': { bgcolor: '#e2e8f0', color: '#0f172a', fontWeight: 900, fontSize: '12px' } }}>
                          <TableCell colSpan={7} align="right" sx={{ textTransform: 'uppercase' }}>
                            Totals:
                          </TableCell>
                          <TableCell align="right" sx={{ color: '#0369a1 !important', bgcolor: '#bae6fd !important' }}>
                            {registerTotals.totalQty}
                          </TableCell>
                          <TableCell align="right">
                            {registerTotals.totalWt.toFixed(2)} Kg
                          </TableCell>
                          <TableCell align="right">-</TableCell>
                          <TableCell align="right" sx={{ color: '#15803d !important', bgcolor: '#bbf7d0 !important' }}>
                            ₹{registerTotals.totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </TableHead>
                    )}
                  </Table>
                </TableContainer>

                <TablePagination
                  rowsPerPageOptions={[10, 25, 50, 100]}
                  component="div"
                  count={transfersList.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={(e, newPage) => setPage(newPage)}
                  onRowsPerPageChange={(e) => {
                    setRowsPerPage(parseInt(e.target.value, 10));
                    setPage(0);
                  }}
                />
              </>
            )}
          </Paper>
        </Stack>
      )}

      {/* ================= VIEW VOUCHER DETAIL MODAL ================= */}
      <Dialog open={openModal} onClose={() => setOpenModal(false)} maxWidth="md" fullWidth>
        {selectedVoucher && (
          <>
            <DialogTitle sx={{ bgcolor: '#0f172a', color: '#ffffff', fontWeight: 800, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box display="flex" alignItems="center" gap={1}>
                <TransferIcon sx={{ color: '#38bdf8' }} />
                Item Transfer Voucher #{selectedVoucher.transfer_no || selectedVoucher.id}
              </Box>
              <Typography variant="caption" sx={{ color: '#94a3b8', fontFamily: 'monospace' }}>
                Date: {selectedVoucher.date}
              </Typography>
            </DialogTitle>

            <DialogContent sx={{ p: 3, bgcolor: '#f8fafc' }}>
              <Grid container spacing={2} sx={{ mb: 3, mt: 0.5 }}>
                <Grid item xs={6}>
                  <Paper elevation={0} sx={{ p: 2, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                      From Godown (Source)
                    </Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1e3a8a', mt: 0.5 }}>
                      📍 {selectedVoucher.from_godown_name}
                    </Typography>
                  </Paper>
                </Grid>

                <Grid item xs={6}>
                  <Paper elevation={0} sx={{ p: 2, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                      To Godown (Destination)
                    </Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#15803d', mt: 0.5 }}>
                      🚚 {selectedVoucher.to_godown_name}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden', bgcolor: '#ffffff' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { bgcolor: '#f1f5f9', fontWeight: 800, textTransform: 'uppercase', fontSize: '11px' } }}>
                      <TableCell>Item Name</TableCell>
                      <TableCell>Lot No</TableCell>
                      <TableCell align="right">Unit Wt</TableCell>
                      <TableCell align="right">Transfer Qty</TableCell>
                      <TableCell align="right">Total Weight</TableCell>
                      <TableCell align="right">Rate</TableCell>
                      <TableCell align="right">Total Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800 }}>{selectedVoucher.item_name}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>{selectedVoucher.lot_no}</TableCell>
                      <TableCell align="right">{selectedVoucher.weight} {selectedVoucher.unit || 'kg'}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: '#0284c7' }}>{selectedVoucher.transfer_qty || selectedVoucher.qty}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{((selectedVoucher.transfer_qty || selectedVoucher.qty || 0) * (selectedVoucher.weight || 1)).toFixed(2)} Kg</TableCell>
                      <TableCell align="right">₹{selectedVoucher.rate || 0}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: '#15803d' }}>₹{selectedVoucher.amount || ((selectedVoucher.transfer_qty || 0) * (selectedVoucher.rate || 0)).toFixed(2)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Paper>

              {selectedVoucher.remarks && (
                <Box mt={2} p={1.5} bgcolor="#ffffff" borderRadius={1.5} border="1px solid #e2e8f0">
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                    Remarks: {selectedVoucher.remarks}
                  </Typography>
                </Box>
              )}
            </DialogContent>

            <DialogActions sx={{ p: 2, bgcolor: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
              <Button onClick={() => setOpenModal(false)} variant="outlined">
                Close
              </Button>
              <Button onClick={() => handlePrintVoucher(selectedVoucher)} variant="contained" startIcon={<PrintIcon />} sx={{ bgcolor: '#1e293b' }}>
                Print Voucher
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
};

export default ItemTransfer;
