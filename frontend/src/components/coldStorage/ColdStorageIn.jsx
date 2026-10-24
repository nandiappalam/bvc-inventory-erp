import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  MenuItem,
  IconButton,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Chip,
  Autocomplete,
  ToggleButtonGroup,
  ToggleButton
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  AcUnit as ColdIcon,
  Print as PrintIcon,
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckIcon,
  LocalShipping as TruckIcon,
  Business as OperatorIcon,
  Warehouse as WarehouseIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { printHtml } from '../../utils/printHelper';

const ColdStorageIn = () => {
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [savedVoucher, setSavedVoucher] = useState(null);

  // Master lists
  const [coldStorages, setColdStorages] = useState([]);
  const [availableLots, setAvailableLots] = useState([]);
  const [godowns, setGodowns] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  // Form State
  const [inwardSourceType, setInwardSourceType] = useState('Factory Godown'); // 'Factory Godown' | 'Direct Purchase'
  const [voucherNo, setVoucherNo] = useState('');
  const [voucherDate, setVoucherDate] = useState(today);
  const [coldStorageId, setColdStorageId] = useState('');
  const [coldStorageName, setColdStorageName] = useState('');
  const [selectedCsObj, setSelectedCsObj] = useState(null);

  // Source
  const [sourceGodownId, setSourceGodownId] = useState('');
  const [sourceGodownName, setSourceGodownName] = useState('Main Godown');
  const [sourceSupplierId, setSourceSupplierId] = useState(null);
  const [sourceSupplierName, setSourceSupplierName] = useState('');

  // Transit & Chamber details
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [transporterName, setTransporterName] = useState('');
  const [lrNo, setLrNo] = useState('');
  const [lrDate, setLrDate] = useState('');
  const [gatePassNo, setGatePassNo] = useState('');
  const [chamberNo, setChamberNo] = useState('Chamber 1');
  const [floorNo, setFloorNo] = useState('');
  const [rackNo, setRackNo] = useState('');
  const [remarks, setRemarks] = useState('');

  // Items State
  const [items, setItems] = useState([
    {
      item_name: '',
      purchase_lot_no: '',
      cold_storage_lot_no: '',
      quantity: '',
      weight: '50',
      total_wt: '0',
      unit: 'Bags',
      remarks: '',
      avail_in_main: 0
    }
  ]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [vRes, csRes, lotsRes, gRes, supRes] = await Promise.all([
        api('/cold-storage/next-voucher-no?type=IN').catch(() => ({ voucher_no: 'CSI-000001' })),
        api('/cold-storage/storages').catch(() => ({ data: [] })),
        api('/cold-storage/available-lots').catch(() => ({ data: [] })),
        api('/godowns').catch(() => ({ data: [] })),
        api('/masters/suppliers').catch(() => ({ data: [] }))
      ]);

      if (vRes?.voucher_no) setVoucherNo(vRes.voucher_no);
      if (csRes?.data?.length > 0) {
        setColdStorages(csRes.data);
        const first = csRes.data[0];
        setColdStorageId(first.id);
        setColdStorageName(first.godown_name);
        setSelectedCsObj(first);
        if (first.default_chamber) setChamberNo(first.default_chamber);
      }
      if (lotsRes?.data) setAvailableLots(lotsRes.data);
      if (gRes?.data) setGodowns(Array.isArray(gRes.data) ? gRes.data : (Array.isArray(gRes) ? gRes : []));
      if (supRes?.data) setSuppliers(supRes.data);
    } catch (err) {
      console.error('Error loading initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleColdStorageChange = (e) => {
    const csId = e.target.value;
    setColdStorageId(csId);
    const selected = coldStorages.find(c => c.id === csId);
    if (selected) {
      setColdStorageName(selected.godown_name);
      setSelectedCsObj(selected);
      if (selected.default_chamber) setChamberNo(selected.default_chamber);
    }
  };

  const handleLotSelect = (index, lotKey) => {
    const selectedLot = availableLots.find(l => `${l.item_name}_${l.purchase_lot_no}` === lotKey);
    if (selectedLot) {
      if (inwardSourceType === 'Factory Godown' && selectedLot.current_godown) {
        setSourceGodownName(selectedLot.current_godown);
        if (selectedLot.current_godown_id) {
          setSourceGodownId(selectedLot.current_godown_id);
        }
      }

      const updated = [...items];
      const qty = selectedLot.purchased_qty || 0;
      const wt = selectedLot.weight || selectedLot.per_weight || 50;
      const totWt = selectedLot.total_weight || (qty * wt);

      updated[index] = {
        ...updated[index],
        item_name: selectedLot.item_name,
        purchase_lot_no: selectedLot.purchase_lot_no,
        cold_storage_lot_no: selectedLot.purchase_lot_no.startsWith('CS-') 
          ? selectedLot.purchase_lot_no 
          : `CS-${selectedLot.purchase_lot_no}`,
        quantity: qty ? String(qty) : '',
        weight: wt ? String(wt) : '50',
        total_wt: totWt ? String(totWt) : '0',
        unit: selectedLot.unit || 'Bags',
        avail_in_main: qty
      };
      setItems(updated);
    }
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;

    if (field === 'quantity' || field === 'weight') {
      const q = parseFloat(field === 'quantity' ? value : updated[index].quantity) || 0;
      const w = parseFloat(field === 'weight' ? value : updated[index].weight) || 0;
      updated[index].total_wt = String(q * w);
    }

    setItems(updated);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        item_name: '',
        purchase_lot_no: '',
        cold_storage_lot_no: '',
        quantity: '',
        weight: '50',
        total_wt: '0',
        unit: 'Bags',
        remarks: '',
        avail_in_main: 0
      }
    ]);
  };

  const handleRemoveItem = (index) => {
    if (items.length === 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  // Calculations
  const totalQty = items.reduce((sum, it) => sum + (parseFloat(it.quantity) || 0), 0);
  const totalWeight = items.reduce((sum, it) => sum + (parseFloat(it.total_wt) || 0), 0);
  const handlingRate = parseFloat(selectedCsObj?.inward_handling_rate || 0);
  const estimatedHandlingCharge = Number((totalQty * handlingRate).toFixed(2));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!coldStorageId && !coldStorageName) {
      setMessage('Please select a Cold Storage facility');
      setMessageType('error');
      return;
    }

    const validItems = items.filter(it => it.item_name.trim() && parseFloat(it.quantity || 0) > 0);
    if (validItems.length === 0) {
      setMessage('Please add at least one item with valid quantity');
      setMessageType('error');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const payload = {
        voucher_date: voucherDate,
        cold_storage_id: coldStorageId,
        cold_storage_name: coldStorageName,
        operator_id: selectedCsObj?.operator_id || null,
        operator_name: selectedCsObj?.operator_name || selectedCsObj?.resolved_operator_name || '',
        inward_source_type: inwardSourceType,
        source_godown_id: inwardSourceType === 'Factory Godown' ? sourceGodownId : null,
        source_godown_name: inwardSourceType === 'Factory Godown' 
          ? sourceGodownName 
          : (sourceSupplierName ? `Direct Supplier: ${sourceSupplierName}` : 'Direct Purchase'),
        vehicle_no: vehicleNo,
        driver_name: driverName,
        driver_phone: driverPhone,
        transporter_name: transporterName,
        lr_no: lrNo,
        lr_date: lrDate,
        gate_pass_no: gatePassNo,
        chamber_no: chamberNo,
        floor_no: floorNo,
        rack_no: rackNo,
        handling_rate: handlingRate,
        handling_amount: estimatedHandlingCharge,
        storage_rate: parseFloat(selectedCsObj?.rate_per_bag || selectedCsObj?.rate_per_kg || 0),
        storage_basis: selectedCsObj?.billing_basis || 'Per Bag',
        remarks,
        items: validItems
      };

      const res = await api('/cold-storage/in', {
        method: 'POST',
        body: payload
      });

      if (res && res.success) {
        setMessage(`Cold Storage IN Voucher ${res.voucher_no} created successfully!`);
        setMessageType('success');
        setSavedVoucher({
          voucher_no: res.voucher_no,
          voucher_date: voucherDate,
          cold_storage_name: coldStorageName,
          operator_name: payload.operator_name,
          source_godown_name: payload.source_godown_name,
          vehicle_no: vehicleNo,
          driver_name: driverName,
          lr_no: lrNo,
          gate_pass_no: gatePassNo,
          chamber_no: chamberNo,
          handling_rate: handlingRate,
          handling_amount: estimatedHandlingCharge,
          remarks,
          items: validItems
        });
        setPrintModalOpen(true);
      } else {
        setMessage(res?.message || 'Error saving Cold Storage IN voucher');
        setMessageType('error');
      }
    } catch (err) {
      setMessage('Error: ' + err.message);
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    if (!savedVoucher) return;
    const itemsHtml = savedVoucher.items.map((it, idx) => `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${idx + 1}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 600;">${it.item_name}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${it.purchase_lot_no || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #0284c7;">${it.cold_storage_lot_no || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold;">${parseFloat(it.quantity).toFixed(2)} ${it.unit || 'Bags'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">${parseFloat(it.weight || 1).toFixed(2)} KG</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold;">${parseFloat(it.total_wt).toFixed(2)} KG</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; color: #0f172a; padding: 15px;">
        <div style="border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h2 style="margin: 0; color: #0284c7; font-size: 20px;">COLD STORAGE INWARD RECEIPT (CSI)</h2>
            <div style="font-size: 11px; color: #64748b; margin-top: 3px;">BVC Exports ERP - External Cold Storage Management</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 15px; font-weight: bold; color: #0f172a;"># ${savedVoucher.voucher_no}</div>
            <div style="font-size: 12px; color: #475569;">Date: <strong>${savedVoucher.voucher_date}</strong></div>
          </div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px; margin-bottom: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px;">
          <div>
            <div><strong>Cold Storage:</strong> ${savedVoucher.cold_storage_name}</div>
            <div><strong>Operator:</strong> ${savedVoucher.operator_name || 'External Facility'}</div>
            <div><strong>Source / Origin:</strong> ${savedVoucher.source_godown_name}</div>
            <div><strong>Chamber / Location:</strong> ${savedVoucher.chamber_no || 'Chamber 1'}</div>
          </div>
          <div>
            <div><strong>Vehicle / Lorry #:</strong> ${savedVoucher.vehicle_no || '-'}</div>
            <div><strong>Driver Name:</strong> ${savedVoucher.driver_name || '-'}</div>
            <div><strong>LR No:</strong> ${savedVoucher.lr_no || '-'}</div>
            <div><strong>Operator Gate Pass:</strong> ${savedVoucher.gate_pass_no || '-'}</div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 12px;">
          <thead>
            <tr style="background-color: #0284c7; color: #ffffff;">
              <th style="padding: 6px; border: 1px solid #0284c7; text-align: center; color: #fff;">#</th>
              <th style="padding: 6px; border: 1px solid #0284c7; text-align: left; color: #fff;">Item Name</th>
              <th style="padding: 6px; border: 1px solid #0284c7; text-align: center; color: #fff;">Purchase Lot</th>
              <th style="padding: 6px; border: 1px solid #0284c7; text-align: center; color: #fff;">Cold Storage Lot</th>
              <th style="padding: 6px; border: 1px solid #0284c7; text-align: right; color: #fff;">Bags / Qty</th>
              <th style="padding: 6px; border: 1px solid #0284c7; text-align: right; color: #fff;">Per Bag Wt</th>
              <th style="padding: 6px; border: 1px solid #0284c7; text-align: right; color: #fff;">Total Weight</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div style="background: #f1f5f9; padding: 8px 12px; border-radius: 4px; display: flex; justify-content: space-between; font-size: 12px;">
          <span><strong>Total Bags:</strong> ${totalQty.toFixed(2)}</span>
          <span><strong>Total Net Weight:</strong> ${totalWeight.toFixed(2)} KG</span>
          <span><strong>Inward Handling:</strong> ₹${estimatedHandlingCharge.toFixed(2)}</span>
        </div>

        ${savedVoucher.remarks ? `
          <div style="margin-top: 10px; font-size: 11px; color: #475569;">
            <strong>Remarks:</strong> ${savedVoucher.remarks}
          </div>
        ` : ''}

        <div style="margin-top: 36px; display: flex; justify-content: space-between; font-size: 11px; color: #475569;">
          <div style="border-top: 1px solid #94a3b8; width: 140px; text-align: center; padding-top: 4px;">Prepared By</div>
          <div style="border-top: 1px solid #94a3b8; width: 140px; text-align: center; padding-top: 4px;">Lorry Driver / Carrier</div>
          <div style="border-top: 1px solid #94a3b8; width: 140px; text-align: center; padding-top: 4px;">Cold Storage Gate Keeper</div>
        </div>
      </div>
    `;

    printHtml(html, `Cold_Inward_Voucher_${savedVoucher.voucher_no}`);
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, width: '100%', maxWidth: '100%', margin: '0 auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <IconButton color="primary" onClick={() => navigate('/cold-storage/vouchers')}>
            <ArrowBackIcon />
          </IconButton>
          <ColdIcon sx={{ fontSize: 32, color: '#0284c7' }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#0f172a' }}>
              Cold Storage Inward Voucher (CSI)
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              Record goods received into external cold storage facilities with transit and handling charges
            </Typography>
          </Box>
        </Box>
        <Chip 
          label={`Voucher #: ${voucherNo || 'Generating...'}`} 
          color="primary" 
          variant="outlined" 
          sx={{ fontWeight: 'bold', fontSize: '14px', height: 32 }} 
        />
      </Box>

      {message && (
        <Alert severity={messageType} sx={{ mb: 2.5 }} onClose={() => setMessage('')}>
          {message}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        <form onSubmit={handleSubmit}>
          {/* Section 1: Inward Source & Facility Card */}
          <Card sx={{ mb: 2.5, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: 2 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#0284c7', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WarehouseIcon fontSize="small" /> Inward Origin & Destination Facility
                </Typography>
                <ToggleButtonGroup
                  value={inwardSourceType}
                  exclusive
                  size="small"
                  onChange={(e, val) => val && setInwardSourceType(val)}
                  sx={{ height: 32 }}
                >
                  <ToggleButton value="Factory Godown" sx={{ px: 2, fontSize: '12px', fontWeight: 600 }}>
                    Factory Godown Transfer
                  </ToggleButton>
                  <ToggleButton value="Direct Purchase" sx={{ px: 2, fontSize: '12px', fontWeight: 600 }}>
                    Direct Purchase Inward
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="Inward Date"
                    value={voucherDate}
                    onChange={(e) => setVoucherDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    required
                  />
                </Grid>

                <Grid item xs={12} sm={4.5}>
                  <TextField
                    fullWidth
                    select
                    size="small"
                    label="Destination Cold Storage Facility *"
                    value={coldStorageId}
                    onChange={handleColdStorageChange}
                    required
                  >
                    {coldStorages.map((cs) => (
                      <MenuItem key={cs.id} value={cs.id}>
                        {cs.godown_name} ({cs.operator_name || cs.resolved_operator_name || 'External Operator'})
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                <Grid item xs={12} sm={4.5}>
                  {inwardSourceType === 'Factory Godown' ? (
                    <Autocomplete
                      freeSolo
                      size="small"
                      options={godowns.map((g) => g.godown_name || g.name || '')}
                      value={sourceGodownName}
                      onInputChange={(event, newInputValue) => {
                        setSourceGodownName(newInputValue);
                        const matched = godowns.find(g => (g.godown_name || g.name || '').toLowerCase() === (newInputValue || '').toLowerCase());
                        if (matched) setSourceGodownId(matched.id);
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Source Factory Godown / Origin *"
                          placeholder="Select origin factory godown"
                          required
                        />
                      )}
                    />
                  ) : (
                    <Autocomplete
                      size="small"
                      options={suppliers}
                      getOptionLabel={(opt) => opt.print_name || opt.name || ''}
                      value={suppliers.find(s => s.id === sourceSupplierId) || (sourceSupplierName ? { name: sourceSupplierName } : null)}
                      onChange={(e, val) => {
                        if (val) {
                          setSourceSupplierId(val.id);
                          setSourceSupplierName(val.print_name || val.name);
                        } else {
                          setSourceSupplierId(null);
                          setSourceSupplierName('');
                        }
                      }}
                      freeSolo
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Purchase Supplier / Farm Source *"
                          placeholder="Direct supplier name"
                          required
                        />
                      )}
                    />
                  )}
                </Grid>

                {/* Operator Terms Banner */}
                {selectedCsObj && (
                  <Grid item xs={12}>
                    <Box sx={{ p: 1.5, bgcolor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 1.5, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', fontSize: '12px' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#0369a1', fontWeight: 'bold' }}>
                        <OperatorIcon fontSize="small" /> Operator:
                      </Box>
                      <span><strong>{selectedCsObj.operator_name || selectedCsObj.resolved_operator_name || 'AgroChill Logistics'}</strong></span>
                      <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
                      <span>Rate: <strong>₹{selectedCsObj.rate_per_bag || 15} / Bag</strong> ({selectedCsObj.storage_duration || 10} Days Slab)</span>
                      <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
                      <span>Inward Handling: <strong>₹{selectedCsObj.inward_handling_rate || 3.5} / Bag</strong></span>
                      <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
                      <span>Min Billable: <strong>{selectedCsObj.min_billable_days || 10} Days</strong></span>
                      <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
                      <span>GST: <strong>{selectedCsObj.gst_rate || 18}%</strong></span>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>

          {/* Section 2: Transit, Logistics & Chamber Card */}
          <Card sx={{ mb: 2.5, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: 2 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, color: '#0284c7', display: 'flex', alignItems: 'center', gap: 1 }}>
                <TruckIcon fontSize="small" /> Transit, Vehicle & Chamber Allocation
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Lorry / Vehicle No"
                    value={vehicleNo}
                    onChange={(e) => setVehicleNo(e.target.value)}
                    placeholder="e.g. TN 28 AB 1234"
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Driver Name & Phone"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="Driver Name"
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Transporter Name"
                    value={transporterName}
                    onChange={(e) => setTransporterName(e.target.value)}
                    placeholder="e.g. VRL Logistics"
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="LR / Bilty No"
                    value={lrNo}
                    onChange={(e) => setLrNo(e.target.value)}
                    placeholder="LR Number"
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Operator Inward Pass #"
                    value={gatePassNo}
                    onChange={(e) => setGatePassNo(e.target.value)}
                    placeholder="Cold storage receipt / gate pass"
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Chamber / Room Allocation"
                    value={chamberNo}
                    onChange={(e) => setChamberNo(e.target.value)}
                    placeholder="e.g. Chamber 1"
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Floor / Stack No"
                    value={floorNo}
                    onChange={(e) => setFloorNo(e.target.value)}
                    placeholder="e.g. Floor 2, Stack 4"
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Rack / Position #"
                    value={rackNo}
                    onChange={(e) => setRackNo(e.target.value)}
                    placeholder="e.g. Rack B3"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Section 3: Item Lines Table */}
          <Card sx={{ mb: 2.5, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: 2 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#0284c7' }}>
                  Items to Store & Lot Tracking
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={handleAddItem}
                >
                  Add Line Item
                </Button>
              </Box>

              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
                <Table size="small">
                  <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', width: '22%' }}>Item Name *</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '18%' }}>Source Purchase Lot</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '18%' }}>Cold Storage Lot *</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '12%' }} align="right">Bags / Qty *</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '10%' }} align="right">Per Bag (KG)</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '12%' }} align="right">Total Weight (KG)</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '8%' }} align="center">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <TextField
                            fullWidth
                            size="small"
                            placeholder="e.g. Broken Rice, Urad"
                            value={row.item_name}
                            onChange={(e) => handleItemChange(index, 'item_name', e.target.value)}
                            required
                          />
                        </TableCell>
                        <TableCell>
                          <Autocomplete
                            freeSolo
                            size="small"
                            options={availableLots.map(l => `${l.item_name}_${l.purchase_lot_no}`)}
                            getOptionLabel={(opt) => {
                              const lot = availableLots.find(l => `${l.item_name}_${l.purchase_lot_no}` === opt);
                              return lot ? `${lot.purchase_lot_no} (${lot.purchased_qty} ${lot.unit || 'Bags'})` : opt;
                            }}
                            value={row.purchase_lot_no}
                            onChange={(e, val) => handleLotSelect(index, val)}
                            onInputChange={(e, val) => handleItemChange(index, 'purchase_lot_no', val)}
                            renderInput={(params) => (
                              <TextField {...params} placeholder="Select lot or type" size="small" />
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            fullWidth
                            size="small"
                            value={row.cold_storage_lot_no}
                            onChange={(e) => handleItemChange(index, 'cold_storage_lot_no', e.target.value)}
                            placeholder="Auto CS Lot"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            value={row.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                            inputProps={{ style: { textAlign: 'right' } }}
                            required
                          />
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            value={row.weight}
                            onChange={(e) => handleItemChange(index, 'weight', e.target.value)}
                            inputProps={{ style: { textAlign: 'right' } }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'right', pt: 1 }}>
                            {Number(row.total_wt || 0).toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            color="error"
                            disabled={items.length === 1}
                            onClick={() => handleRemoveItem(index)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Inward Summary Strip */}
              <Box sx={{ mt: 2, p: 2, bgcolor: '#f8fafc', borderRadius: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0' }}>
                <Box sx={{ display: 'flex', gap: 3 }}>
                  <Typography variant="body2">
                    Total Quantity: <strong>{totalQty.toFixed(2)} Bags</strong>
                  </Typography>
                  <Typography variant="body2">
                    Total Weight: <strong>{totalWeight.toFixed(2)} KG</strong> ({(totalWeight / 1000).toFixed(3)} MT)
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#0369a1' }}>
                    Est. Inward Handling: <strong>₹{estimatedHandlingCharge.toFixed(2)}</strong> (@ ₹{handlingRate}/bag)
                  </Typography>
                </Box>
              </Box>

              <TextField
                fullWidth
                size="small"
                sx={{ mt: 2 }}
                label="Inward Operational Remarks / Condition Notes"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Moisture 12%, bags intact, stacked on chamber pallet 4"
              />
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button variant="outlined" color="secondary" onClick={() => navigate('/cold-storage/vouchers')}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              size="large"
              sx={{ bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' }, px: 4 }}
              startIcon={<SaveIcon />}
              disabled={saving}
            >
              {saving ? 'Creating Inward Voucher...' : 'Save Cold Storage Inward'}
            </Button>
          </Box>
        </form>
      )}

      {/* Print Success Modal */}
      <Dialog open={printModalOpen} onClose={() => setPrintModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ textAlign: 'center', pt: 3 }}>
          <CheckIcon sx={{ fontSize: 48, color: '#16a34a', mb: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Inward Voucher Saved!
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center', pb: 2 }}>
          <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
            Cold Storage Inward Voucher <strong>{savedVoucher?.voucher_no}</strong> has been created and stock has been allocated to {savedVoucher?.cold_storage_name}.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            fullWidth
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            sx={{ mb: 1 }}
          >
            Print Inward Receipt (CSI)
          </Button>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
          <Button onClick={() => { setPrintModalOpen(false); navigate('/cold-storage/vouchers'); }}>
            View Voucher Register
          </Button>
          <Button variant="outlined" onClick={() => { setPrintModalOpen(false); fetchInitialData(); }}>
            New Inward
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ColdStorageIn;
