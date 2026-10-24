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
  Storefront as CustomerIcon,
  Warehouse as WarehouseIcon,
  ReceiptLong as ReceiptIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { printHtml } from '../../utils/printHelper';

const ColdStorageOut = () => {
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
  const [csLots, setCsLots] = useState([]);
  const [godowns, setGodowns] = useState([]);
  const [customers, setCustomers] = useState([]);

  // Form State
  const [outwardDestType, setOutwardDestType] = useState('Internal Godown'); // 'Internal Godown' | 'Customer Dispatch'
  const [voucherNo, setVoucherNo] = useState('');
  const [voucherDate, setVoucherDate] = useState(today);
  const [coldStorageId, setColdStorageId] = useState('');
  const [coldStorageName, setColdStorageName] = useState('');
  const [selectedCsObj, setSelectedCsObj] = useState(null);

  // Destination Internal Godown
  const [destinationGodownId, setDestinationGodownId] = useState('');
  const [destinationGodownName, setDestinationGodownName] = useState('Main Godown');

  // Customer Dispatch Details
  const [customerId, setCustomerId] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [salesOrderRef, setSalesOrderRef] = useState('');

  // Transport & Logistics
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [transporterName, setTransporterName] = useState('');
  const [lrNo, setLrNo] = useState('');
  const [lrDate, setLrDate] = useState('');
  const [gatePassNo, setGatePassNo] = useState('');
  const [handlingRate, setHandlingRate] = useState(0);
  const [tariffConfig, setTariffConfig] = useState(null);

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
      avail_in_cs: 0
    }
  ]);

  const calculateReleasedCharge = (item) => {
    const qty = parseFloat(item.quantity || 0);
    const wt = parseFloat(item.weight || 1);
    const totWt = parseFloat(item.total_wt || (qty * wt));
    if (qty <= 0 || totWt <= 0 || !item.inward_date) {
      return { calendarDays: 0, billableDays: 0, storageCharge: 0, loadingCharge: 0, totalReleasedCost: 0, remainingQty: item.avail_in_cs || 0 };
    }

    const inD = new Date(item.inward_date.slice(0, 10));
    const outD = voucherDate ? new Date(voucherDate.slice(0, 10)) : new Date();
    const diffMs = Math.max(0, outD - inD);
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    // Inclusive calendar days: outward - inward + 1
    const calendarDays = diffDays + 1;
    const freeDays = tariffConfig?.freeDays || 0;
    const minDays = tariffConfig?.minDays || 1;
    const billableDays = Math.max(minDays, Math.max(0, calendarDays - freeDays));

    const isWhole = (tariffConfig?.calculationType || 'Progressive').toLowerCase().includes('whole');
    const slabs = (tariffConfig?.storageSlabs || [
      { slab_start_day: 1, slab_end_day: 15, rate: 0.20 },
      { slab_start_day: 16, slab_end_day: 30, rate: 0.30 },
      { slab_start_day: 31, slab_end_day: 99999, rate: 0.40 }
    ]).slice().sort((a, b) => (parseInt(a.slab_start_day, 10) || 1) - (parseInt(b.slab_start_day, 10) || 1));

    let storageCharge = 0;
    if (isWhole) {
      let matched = slabs[slabs.length - 1];
      for (const s of slabs) {
        const start = parseInt(s.slab_start_day, 10) || 1;
        const end = s.slab_end_day ? parseInt(s.slab_end_day, 10) : 999999;
        if (billableDays >= start && billableDays <= end) {
          matched = s;
          break;
        }
      }
      storageCharge = totWt * (parseFloat(matched?.rate) || 0.20) * billableDays;
    } else {
      let rem = billableDays;
      for (const s of slabs) {
        if (rem <= 0) break;
        const start = parseInt(s.slab_start_day, 10) || 1;
        const end = s.slab_end_day ? parseInt(s.slab_end_day, 10) : 999999;
        const span = Math.max(0, end - start + 1);
        const inThis = Math.min(rem, span);
        if (inThis > 0) {
          storageCharge += totWt * (parseFloat(s.rate) || 0.20) * inThis;
          rem -= inThis;
        }
      }
    }

    const outRate = parseFloat(handlingRate || tariffConfig?.outwardLoadingRate || 0.50);
    const loadingCharge = totWt * outRate;
    const remainingQty = Math.max(0, parseFloat(item.avail_in_cs || 0) - qty);

    return {
      calendarDays,
      billableDays,
      storageCharge: Number(storageCharge.toFixed(2)),
      loadingCharge: Number(loadingCharge.toFixed(2)),
      totalReleasedCost: Number((storageCharge + loadingCharge).toFixed(2)),
      remainingQty: Number(remainingQty.toFixed(2))
    };
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [vRes, csRes, gRes, custRes] = await Promise.all([
        api('/cold-storage/next-voucher-no?type=OUT').catch(() => ({ voucher_no: 'CSO-000001' })),
        api('/cold-storage/storages').catch(() => ({ data: [] })),
        api('/cold-storage/all-godowns').catch(() => ({ data: [] })),
        api('/masters/customers').catch(() => ({ data: [] }))
      ]);

      if (vRes?.voucher_no) {
        setVoucherNo(vRes.voucher_no);
      }

      if (csRes?.data?.length > 0) {
        setColdStorages(csRes.data);
        const first = csRes.data[0];
        setColdStorageId(first.id);
        setColdStorageName(first.godown_name);
        setSelectedCsObj(first);
        setHandlingRate(parseFloat(first.outward_handling_rate || 0));
        loadCsLots(first.id);
      }

      const gList = gRes?.data || [];
      if (gList.length > 0) {
        setGodowns(gList);
        const mainG = gList.find(g =>
          (g.godown_name || '').toLowerCase().includes('main') ||
          (g.godown_name || '').toLowerCase().includes('production')
        );
        if (mainG) {
          setDestinationGodownId(mainG.id);
          setDestinationGodownName(mainG.godown_name);
        }
      }

      if (custRes?.data) {
        setCustomers(custRes.data);
      }
    } catch (err) {
      console.error('Error loading initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCsLots = async (csId) => {
    try {
      const [lotsRes, tariffRes] = await Promise.all([
        api(`/cold-storage/cs-lots?cold_storage_id=${csId}`).catch(() => ({ data: [] })),
        api(`/cold-storage/tariff/${csId}`).catch(() => ({ data: null }))
      ]);
      setCsLots(lotsRes?.data || []);
      if (tariffRes?.data) {
        setTariffConfig(tariffRes.data);
      }
    } catch (err) {
      console.error('Error fetching CS lots or tariff:', err);
      setCsLots([]);
    }
  };

  const handleColdStorageChange = (e) => {
    const csId = e.target.value;
    setColdStorageId(csId);
    const selected = coldStorages.find(c => c.id === csId);
    if (selected) {
      setColdStorageName(selected.godown_name);
      setSelectedCsObj(selected);
      setHandlingRate(parseFloat(selected.outward_handling_rate || 0));
    }
    loadCsLots(csId);
    // Reset items on cold storage switch
    setItems([
      {
        item_name: '',
        purchase_lot_no: '',
        cold_storage_lot_no: '',
        quantity: '',
        weight: '50',
        total_wt: '0',
        unit: 'Bags',
        remarks: '',
        avail_in_cs: 0
      }
    ]);
  };

  const handleCsLotSelect = (index, csLotKey) => {
    const selectedLot = csLots.find(l => `${l.item_name}_${l.cold_storage_lot_no}` === csLotKey);
    if (selectedLot) {
      const updated = [...items];
      const lotWeight = parseFloat(
        selectedLot.weight ||
        selectedLot.per_weight ||
        (selectedLot.available_wt && selectedLot.available_qty
          ? selectedLot.available_wt / selectedLot.available_qty
          : 50)
      ) || 50;

      const initialQty = selectedLot.available_qty > 0 ? selectedLot.available_qty : '';
      const initialTotalWt = initialQty !== '' ? (parseFloat(initialQty) * lotWeight).toFixed(2) : '';

      updated[index] = {
        ...updated[index],
        item_name: selectedLot.item_name,
        purchase_lot_no: selectedLot.purchase_lot_no,
        cold_storage_lot_no: selectedLot.cold_storage_lot_no,
        unit: selectedLot.unit || 'Bags',
        weight: String(lotWeight),
        avail_in_cs: selectedLot.available_qty,
        quantity: initialQty,
        total_wt: initialTotalWt,
        inward_date: selectedLot.inward_date,
        storage_days_today: selectedLot.storage_days_today || 1,
        original_in_qty: selectedLot.original_in_qty
      };
      setItems(updated);
    }
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    if (field === 'quantity' || field === 'weight') {
      const q = parseFloat(updated[index].quantity || 0);
      const w = parseFloat(updated[index].weight || 1);
      updated[index].total_wt = (q * w).toFixed(2);
    }
    setItems(updated);
  };

  const addItemRow = () => {
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
        avail_in_cs: 0
      }
    ]);
  };

  const removeItemRow = (index) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const totalQtySum = items.reduce((sum, i) => sum + parseFloat(i.quantity || 0), 0);
  const totalWtSum = items.reduce((sum, i) => sum + parseFloat(i.total_wt || 0), 0);
  const totalHandlingCharges = totalQtySum * (parseFloat(handlingRate) || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!coldStorageId || !coldStorageName) {
      setMessage('Please select a Cold Storage Godown');
      setMessageType('error');
      return;
    }

    if (outwardDestType === 'Customer Dispatch' && !customerName.trim()) {
      setMessage('Please specify or select a Customer for direct dispatch');
      setMessageType('error');
      return;
    }

    const validItems = items.filter(i => i.item_name && parseFloat(i.quantity) > 0);
    if (validItems.length === 0) {
      setMessage('Please enter at least one item with valid quantity');
      setMessageType('error');
      return;
    }

    // STRICT CLIENT VALIDATION: Cannot issue more than available stock in Cold Storage!
    for (const item of validItems) {
      const q = parseFloat(item.quantity || 0);
      if (q > item.avail_in_cs) {
        setMessage(
          `Insufficient Stock in Cold Storage for ${item.item_name} (CS Lot: ${item.cold_storage_lot_no}). Available: ${item.avail_in_cs} ${item.unit}, Requested: ${q} ${item.unit}.`
        );
        setMessageType('error');
        return;
      }
    }

    setSaving(true);
    setMessage('');
    try {
      const payload = {
        voucher_date: voucherDate,
        cold_storage_id: coldStorageId,
        cold_storage_name: coldStorageName,
        outward_dest_type: outwardDestType,
        destination_godown_id: outwardDestType === 'Internal Godown' ? destinationGodownId : null,
        destination_godown_name: outwardDestType === 'Internal Godown' ? destinationGodownName : `Customer: ${customerName}`,
        customer_id: outwardDestType === 'Customer Dispatch' ? customerId : null,
        customer_name: outwardDestType === 'Customer Dispatch' ? customerName : '',
        sales_order_ref: salesOrderRef,
        vehicle_no: vehicleNo,
        driver_name: driverName,
        driver_phone: driverPhone,
        transporter_name: transporterName,
        lr_no: lrNo,
        lr_date: lrDate,
        gate_pass_no: gatePassNo,
        handling_rate: parseFloat(handlingRate) || 0,
        handling_amount: totalHandlingCharges,
        remarks,
        items: validItems
      };

      const res = await api('/cold-storage/out', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res && res.success) {
        setSavedVoucher({
          voucher_no: res.voucher_no || voucherNo,
          voucher_date: voucherDate,
          cold_storage_name: coldStorageName,
          outward_dest_type: outwardDestType,
          destination_godown_name: outwardDestType === 'Internal Godown' ? destinationGodownName : `Customer: ${customerName}`,
          customer_name: customerName,
          sales_order_ref: salesOrderRef,
          vehicle_no: vehicleNo,
          transporter_name: transporterName,
          lr_no: lrNo,
          gate_pass_no: gatePassNo,
          handling_rate: handlingRate,
          handling_amount: totalHandlingCharges,
          total_qty: res.total_qty || totalQtySum,
          total_wt: res.total_wt || totalWtSum,
          remarks,
          items: validItems
        });
        setPrintModalOpen(true);
        setMessage(`Success: Cold Storage Outward ${res.voucher_no} issued successfully!`);
        setMessageType('success');
      } else {
        setMessage(res?.message || 'Error issuing Cold Storage OUT voucher');
        setMessageType('error');
      }
    } catch (err) {
      setMessage('Error: ' + err.message);
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  const handleResetForm = () => {
    setPrintModalOpen(false);
    setItems([
      {
        item_name: '',
        purchase_lot_no: '',
        cold_storage_lot_no: '',
        quantity: '',
        weight: '50',
        total_wt: '0',
        unit: 'Bags',
        remarks: '',
        avail_in_cs: 0
      }
    ]);
    setRemarks('');
    setVehicleNo('');
    setDriverName('');
    setDriverPhone('');
    setTransporterName('');
    setLrNo('');
    setLrDate('');
    setGatePassNo('');
    setCustomerName('');
    setSalesOrderRef('');
    fetchInitialData();
  };

  const handlePrintIssueSlip = () => {
    if (!savedVoucher) return;
    const itemsHtml = (savedVoucher.items || []).map((it, idx) => `
      <tr>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${idx + 1}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: bold;">${it.item_name}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; color: #b45309; font-weight: bold;">${it.cold_storage_lot_no || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${it.purchase_lot_no || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold;">${it.quantity} ${it.unit}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">${it.weight || 1} KG</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold;">${it.total_wt} KG</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">${it.remarks || '-'}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 12px; color: #0f172a;">
        <div style="border-bottom: 2px solid #b45309; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <div style="font-size: 20px; font-weight: 800; color: #b45309; text-transform: uppercase;">BHAGWATI VEG COMMODITIES</div>
            <div style="font-size: 13px; font-weight: 700; color: #334155; margin-top: 2px;">
              COLD STORAGE OUTWARD / RETRIEVAL & DISPATCH SLIP (CSO)
            </div>
          </div>
          <div style="text-align: right; font-size: 11px; color: #64748b;">
            Type: <strong>${savedVoucher.outward_dest_type || 'Internal Godown'}</strong>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; background: #fffbeb; padding: 10px; border-radius: 4px; margin-bottom: 14px; font-size: 12px; border: 1px solid #fef3c7;">
          <div style="width: 48%;">
            <div><strong>Voucher #:</strong> ${savedVoucher.voucher_no}</div>
            <div><strong>Date:</strong> ${savedVoucher.voucher_date}</div>
            <div><strong>Source Cold Storage:</strong> ${savedVoucher.cold_storage_name}</div>
            <div><strong>Destination:</strong> ${savedVoucher.destination_godown_name}</div>
            ${savedVoucher.sales_order_ref ? `<div><strong>Sales/Order Ref:</strong> ${savedVoucher.sales_order_ref}</div>` : ''}
          </div>
          <div style="width: 48%; text-align: right;">
            <div><strong>Vehicle / Lorry #:</strong> ${savedVoucher.vehicle_no || 'N/A'}</div>
            <div><strong>Transporter:</strong> ${savedVoucher.transporter_name || 'Direct'}</div>
            <div><strong>LR / Bilty #:</strong> ${savedVoucher.lr_no || 'N/A'}</div>
            <div><strong>Gate Pass #:</strong> ${savedVoucher.gate_pass_no || 'N/A'}</div>
            <div><strong>Handling Rate:</strong> ₹${savedVoucher.handling_rate || 0}/Unit (₹${(savedVoucher.handling_amount || 0).toFixed(2)})</div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background-color: #b45309; color: #ffffff;">
              <th style="padding: 6px; border: 1px solid #b45309; color: #fff; text-align: center;">#</th>
              <th style="padding: 6px; border: 1px solid #b45309; color: #fff; text-align: left;">Item Name</th>
              <th style="padding: 6px; border: 1px solid #b45309; color: #fff; text-align: center;">Cold Storage Lot #</th>
              <th style="padding: 6px; border: 1px solid #b45309; color: #fff; text-align: center;">Purchase Lot #</th>
              <th style="padding: 6px; border: 1px solid #b45309; color: #fff; text-align: right;">Qty</th>
              <th style="padding: 6px; border: 1px solid #b45309; color: #fff; text-align: right;">Per Wt</th>
              <th style="padding: 6px; border: 1px solid #b45309; color: #fff; text-align: right;">Total Wt</th>
              <th style="padding: 6px; border: 1px solid #b45309; color: #fff; text-align: left;">Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr style="background-color: #f1f5f9; font-weight: bold;">
              <td colspan="4" style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">TOTALS:</td>
              <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; color: #b45309;">${savedVoucher.total_qty}</td>
              <td style="padding: 6px; border: 1px solid #cbd5e1;"></td>
              <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; color: #b45309;">${savedVoucher.total_wt} KG</td>
              <td style="padding: 6px; border: 1px solid #cbd5e1;"></td>
            </tr>
          </tfoot>
        </table>

        ${savedVoucher.remarks ? `
          <div style="margin-top: 12px; font-size: 11px; color: #475569;">
            <strong>Remarks / Dispatch Notes:</strong> ${savedVoucher.remarks}
          </div>
        ` : ''}

        <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 11px; color: #475569;">
          <div style="border-top: 1px solid #94a3b8; width: 160px; text-align: center; padding-top: 4px;">Prepared By</div>
          <div style="border-top: 1px solid #94a3b8; width: 160px; text-align: center; padding-top: 4px;">Cold Storage Operator / Incharge</div>
          <div style="border-top: 1px solid #94a3b8; width: 160px; text-align: center; padding-top: 4px;">Driver / Receiver Signature</div>
        </div>
      </div>
    `;
    printHtml(html, `Cold_Outward_Voucher_${savedVoucher.voucher_no}`);
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, width: '100%', maxWidth: '100%', margin: '0 auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <IconButton color="primary" onClick={() => navigate('/cold-storage/vouchers')}>
            <ArrowBackIcon />
          </IconButton>
          <ColdIcon sx={{ fontSize: 32, color: '#d97706' }} />
          <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#b45309' }}>
            Cold Storage Outward / Issue Voucher (CSO)
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => navigate('/cold-storage/stock')}
          >
            Check Stock Balance
          </Button>
          <Chip
            label={`Voucher #: ${voucherNo || 'Generating...'}`}
            color="warning"
            variant="outlined"
            sx={{ fontWeight: 'bold', fontSize: '15px' }}
          />
        </Box>
      </Box>

      {message && (
        <Alert severity={messageType} sx={{ mb: 3 }} onClose={() => setMessage('')}>
          {message}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        <form onSubmit={handleSubmit}>
          {/* Main Info Card */}
          <Card sx={{ mb: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <CardContent sx={{ p: 3 }}>
              {/* Outward Mode Selector */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, flexWrap: 'wrap', gap: 1.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#b45309' }}>
                  1. Cold Storage Source & Dispatch Destination
                </Typography>
                <ToggleButtonGroup
                  value={outwardDestType}
                  exclusive
                  size="small"
                  onChange={(_, val) => val && setOutwardDestType(val)}
                  sx={{ backgroundColor: '#fff' }}
                >
                  <ToggleButton value="Internal Godown" sx={{ px: 2, fontWeight: 'bold' }}>
                    <WarehouseIcon fontSize="small" sx={{ mr: 1 }} /> Internal Retrieval (Factory / Godown)
                  </ToggleButton>
                  <ToggleButton value="Customer Dispatch" sx={{ px: 2, fontWeight: 'bold' }}>
                    <CustomerIcon fontSize="small" sx={{ mr: 1 }} /> Direct Dispatch to Customer
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              <Grid container spacing={2.5}>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="Voucher Date"
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
                    label="Source Cold Storage Facility"
                    value={coldStorageId}
                    onChange={handleColdStorageChange}
                    required
                  >
                    {coldStorages.map((cs) => (
                      <MenuItem key={cs.id} value={cs.id}>
                        {cs.godown_name} ({cs.external_company || cs.storage_location || 'Cold Storage'})
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                {outwardDestType === 'Internal Godown' ? (
                  <Grid item xs={12} sm={4.5}>
                    <Autocomplete
                      freeSolo
                      options={godowns.map((g) => g.godown_name || '')}
                      value={destinationGodownName}
                      onInputChange={(_, newInputValue) => {
                        setDestinationGodownName(newInputValue);
                        const matched = godowns.find(
                          g => (g.godown_name || '').toLowerCase() === (newInputValue || '').toLowerCase()
                        );
                        if (matched) {
                          setDestinationGodownId(matched.id);
                        }
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          size="small"
                          label="Destination Godown / Processing Unit"
                          placeholder="Select destination godown or enter purpose"
                          required
                        />
                      )}
                    />
                  </Grid>
                ) : (
                  <>
                    <Grid item xs={12} sm={4.5}>
                      <Autocomplete
                        freeSolo
                        options={customers.map((c) => c.print_name || c.name || '')}
                        value={customerName}
                        onInputChange={(_, newInputValue) => {
                          setCustomerName(newInputValue);
                          const matched = customers.find(
                            c => (c.print_name || c.name || '').toLowerCase() === (newInputValue || '').toLowerCase()
                          );
                          if (matched) {
                            setCustomerId(matched.id);
                            if (matched.address1) setCustomerAddress(matched.address1);
                          }
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            size="small"
                            label="Customer / Buyer Name *"
                            placeholder="Select customer or enter buyer name"
                            required
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Sales Order / Invoice Ref #"
                        value={salesOrderRef}
                        onChange={(e) => setSalesOrderRef(e.target.value)}
                        placeholder="e.g. SO-00124 or INV-892"
                      />
                    </Grid>
                    <Grid item xs={12} sm={9}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Delivery Location / Customer Shipping Address"
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        placeholder="Destination address where goods will be delivered"
                      />
                    </Grid>
                  </>
                )}
              </Grid>
            </CardContent>
          </Card>

          {/* Transit & Vehicle Information */}
          <Card sx={{ mb: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <TruckIcon sx={{ color: '#d97706' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#b45309' }}>
                  2. Logistics, Vehicle & Outward Gate Pass
                </Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Vehicle / Lorry No"
                    placeholder="e.g. TN 38 BJ 5544"
                    value={vehicleNo}
                    onChange={(e) => setVehicleNo(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Driver Name"
                    placeholder="Driver Name"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Driver Phone"
                    placeholder="Mobile No"
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Transporter / Carrier"
                    placeholder="Transporter Name"
                    value={transporterName}
                    onChange={(e) => setTransporterName(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="LR / Bilty No"
                    placeholder="LR-0001"
                    value={lrNo}
                    onChange={(e) => setLrNo(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="LR Date"
                    value={lrDate}
                    onChange={(e) => setLrDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Operator Gate Pass No"
                    placeholder="Cold Storage Gate Pass #"
                    value={gatePassNo}
                    onChange={(e) => setGatePassNo(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label="Outward Handling Rate (₹/Unit)"
                    value={handlingRate}
                    onChange={(e) => setHandlingRate(e.target.value)}
                    helperText={`Est. Handling: ₹${totalHandlingCharges.toFixed(2)}`}
                    inputProps={{ step: 'any' }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Remarks / Dispatch / Issue Notes"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="e.g. Issued for Milling Batch #402 or Customer delivery challan"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Items Table Card */}
          <Card sx={{ mb: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#b45309' }}>
                  3. Stored Material & Cold Storage Lot Selection
                </Typography>
                <Button startIcon={<AddIcon />} variant="outlined" size="small" color="warning" onClick={addItemRow}>
                  Add Item Row
                </Button>
              </Box>

              {csLots.length === 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  No materials currently stored in this Cold Storage location.
                </Alert>
              )}

              <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto', borderRadius: 1.5 }}>
                <Table sx={{ minWidth: 1250, '& .MuiTableCell-root': { py: 1, px: 1 } }}>
                  <TableHead sx={{ backgroundColor: '#fffbe3' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', width: 45, textAlign: 'center' }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', minWidth: 280, width: 320 }}>Cold Storage Lot & Item</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', minWidth: 140, width: 160 }}>Purchase Lot #</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', minWidth: 130, width: 150 }}>Avail Stock in CS</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', minWidth: 120, width: 135 }}>Issue Qty</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', minWidth: 100, width: 110 }}>Per Wt</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', minWidth: 120, width: 135 }}>Total Wt</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', minWidth: 90, width: 100 }}>Unit</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', minWidth: 160 }}>Item Remarks</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', width: 60 }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((row, idx) => {
                      const csLotKey = row.item_name && row.cold_storage_lot_no ? `${row.item_name}_${row.cold_storage_lot_no}` : '';
                      const isExcess = parseFloat(row.quantity || 0) > row.avail_in_cs;

                      return (
                        <TableRow key={idx} sx={{ backgroundColor: isExcess ? '#fff1f2' : 'inherit', '&:hover': { backgroundColor: isExcess ? '#ffe4e6' : '#fffdf5' } }}>
                          <TableCell align="center" sx={{ fontWeight: '600', color: 'text.secondary' }}>
                            {idx + 1}
                          </TableCell>

                          {/* CS Lot & Item Select */}
                          <TableCell>
                            <TextField
                              fullWidth
                              select
                              size="small"
                              value={csLotKey}
                              onChange={(e) => handleCsLotSelect(idx, e.target.value)}
                              error={!row.cold_storage_lot_no}
                              helperText={!row.cold_storage_lot_no ? 'Select lot' : ''}
                            >
                              <MenuItem value="">-- Select CS Lot --</MenuItem>
                              {csLots.map((lot, lIdx) => (
                                <MenuItem
                                  key={lIdx}
                                  value={`${lot.item_name}_${lot.cold_storage_lot_no}`}
                                  disabled={lot.available_qty <= 0}
                                >
                                  <strong>{lot.item_name}</strong> &nbsp;|&nbsp; Lot: {lot.cold_storage_lot_no} &nbsp;|&nbsp; Avail: {lot.available_qty} {lot.unit || 'Bags'}
                                </MenuItem>
                              ))}
                            </TextField>
                            {row.inward_date && (
                              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: '#0284c7', fontWeight: 600 }}>
                                📅 Inward: {row.inward_date} • {row.storage_days_today || 1} Days
                              </Typography>
                            )}
                          </TableCell>

                          {/* Purchase Lot display */}
                          <TableCell>
                            <Box sx={{ p: 0.8, backgroundColor: '#f8fafc', borderRadius: 1, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                              <Typography variant="body2" sx={{ fontWeight: '600', color: '#334155' }}>
                                {row.purchase_lot_no || '—'}
                              </Typography>
                            </Box>
                          </TableCell>

                          {/* Available Balance in CS */}
                          <TableCell>
                            <Chip
                              label={`${row.avail_in_cs} ${row.unit}`}
                              color={row.avail_in_cs > 0 ? 'success' : 'default'}
                              size="small"
                              variant="outlined"
                              sx={{ fontWeight: 'bold' }}
                            />
                          </TableCell>

                          {/* Issue Qty */}
                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              value={row.quantity}
                              onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                              error={isExcess}
                              helperText={isExcess ? 'Exceeds stock!' : ''}
                              placeholder="Qty"
                              inputProps={{
                                step: "any",
                                sx: { px: 1.25, py: 0.9, fontSize: '0.875rem', fontWeight: '600' }
                              }}
                            />
                          </TableCell>

                          {/* Weight */}
                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              value={row.weight}
                              onChange={(e) => handleItemChange(idx, 'weight', e.target.value)}
                              placeholder="1"
                              inputProps={{
                                step: "any",
                                sx: { px: 1.25, py: 0.9, fontSize: '0.875rem' }
                              }}
                            />
                          </TableCell>

                          {/* Total Weight */}
                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              value={row.total_wt}
                              onChange={(e) => handleItemChange(idx, 'total_wt', e.target.value)}
                              placeholder="0"
                              inputProps={{
                                step: "any",
                                sx: { px: 1.25, py: 0.9, fontSize: '0.875rem', fontWeight: '600' }
                              }}
                            />
                          </TableCell>

                          {/* Unit */}
                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              value={row.unit}
                              onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                              placeholder="KG"
                              inputProps={{
                                sx: { px: 1.25, py: 0.9, fontSize: '0.875rem', textAlign: 'center' }
                              }}
                            />
                          </TableCell>

                          {/* Remarks */}
                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              value={row.remarks}
                              onChange={(e) => handleItemChange(idx, 'remarks', e.target.value)}
                              placeholder="Notes"
                              inputProps={{
                                sx: { px: 1.25, py: 0.9, fontSize: '0.875rem' }
                              }}
                            />
                          </TableCell>

                          <TableCell align="center">
                            <IconButton
                              color="error"
                              size="small"
                              onClick={() => removeItemRow(idx)}
                              disabled={items.length === 1}
                              title="Delete Row"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Partial Outward & Storage Charge Live Breakdown */}
              {items.some(it => parseFloat(it.quantity || 0) > 0 && it.cold_storage_lot_no) && (
                <Card variant="outlined" sx={{ mt: 2.5, p: 2, backgroundColor: '#fffbeb', borderColor: '#fde68a' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#92400e', display: 'flex', alignItems: 'center', gap: 1 }}>
                      ❄️ Partial Outward & Storage Day Billing Breakdown (Inclusive Calendar Dates)
                    </Typography>
                    <Chip
                      label={`Tariff: ${tariffConfig?.calculationType || 'Progressive'} Slabs • Outward Handling: ₹${handlingRate}/kg`}
                      size="small"
                      color="warning"
                      variant="outlined"
                      sx={{ fontWeight: 'bold' }}
                    />
                  </Box>

                  <TableContainer component={Paper} variant="outlined" sx={{ backgroundColor: '#ffffff', mb: 1.5 }}>
                    <Table size="small">
                      <TableHead sx={{ backgroundColor: '#fef3c7' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Lot No & Item</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }} align="center">Inward Date</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }} align="center">Calendar Days</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }} align="right">Released Qty (KG)</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }} align="right">Storage Charge (₹)</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }} align="right">Outward Loading (₹)</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }} align="right">Total Release Cost</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }} align="center">Remaining Balance in CS</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {items
                          .filter(it => parseFloat(it.quantity || 0) > 0 && it.cold_storage_lot_no)
                          .map((it, iIdx) => {
                            const c = calculateReleasedCharge(it);
                            const issueKg = parseFloat(it.total_wt || (parseFloat(it.quantity || 0) * parseFloat(it.weight || 1))) || 0;
                            return (
                              <TableRow key={iIdx}>
                                <TableCell sx={{ fontWeight: 600 }}>
                                  {it.item_name} <br />
                                  <Typography variant="caption" color="text.secondary">Lot: {it.cold_storage_lot_no}</Typography>
                                </TableCell>
                                <TableCell align="center">{it.inward_date || 'Today'}</TableCell>
                                <TableCell align="center">
                                  <Chip label={`${c.calendarDays} Days`} size="small" sx={{ height: 20, fontSize: '11px', fontWeight: 'bold' }} />
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                  {it.quantity} {it.unit} ({issueKg.toFixed(1)} KG)
                                </TableCell>
                                <TableCell align="right" sx={{ color: '#0369a1', fontWeight: 'bold' }}>
                                  ₹{c.storageCharge.toFixed(2)}
                                </TableCell>
                                <TableCell align="right" sx={{ color: '#d97706', fontWeight: 'bold' }}>
                                  ₹{c.loadingCharge.toFixed(2)}
                                </TableCell>
                                <TableCell align="right" sx={{ color: '#16a34a', fontWeight: 'bold' }}>
                                  ₹{c.totalReleasedCost.toFixed(2)}
                                </TableCell>
                                <TableCell align="center">
                                  <Chip
                                    label={`${c.remainingQty} ${it.unit} Left`}
                                    size="small"
                                    color={c.remainingQty > 0 ? 'info' : 'default'}
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: '11px', fontWeight: 'bold' }}
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <Typography variant="caption" sx={{ color: '#78350f', display: 'block', fontStyle: 'italic' }}>
                    * Storage day counting includes both inward and outward calendar dates. Released quantity is billed for its exact storage duration; remaining quantity continues tracking independent storage charges.
                  </Typography>
                </Card>
              )}

              {/* Total Summary */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 4, mt: 2, p: 1.5, backgroundColor: '#fef3c7', borderRadius: 1, flexWrap: 'wrap' }}>
                <Typography variant="subtitle2">
                  Total Items: <strong>{items.length}</strong>
                </Typography>
                <Typography variant="subtitle2">
                  Total Issued Quantity: <strong style={{ color: '#b45309' }}>{totalQtySum.toFixed(2)}</strong>
                </Typography>
                <Typography variant="subtitle2">
                  Total Issued Weight: <strong style={{ color: '#b45309' }}>{totalWtSum.toFixed(2)} KG</strong>
                </Typography>
                <Typography variant="subtitle2">
                  Est. Outward Handling: <strong style={{ color: '#b45309' }}>₹{totalHandlingCharges.toFixed(2)}</strong>
                </Typography>
              </Box>
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
              startIcon={<SaveIcon />}
              disabled={saving}
              sx={{ backgroundColor: '#d97706', '&:hover': { backgroundColor: '#b45309' }, px: 4, py: 1 }}
            >
              {saving ? 'Issuing...' : 'Issue Cold Storage Outward Voucher'}
            </Button>
          </Box>
        </form>
      )}

      {/* Print / Confirmation Dialog */}
      <Dialog open={printModalOpen} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ backgroundColor: '#d97706', color: '#fff', display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckIcon /> Cold Storage Outward Issued
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {savedVoucher && (
            <Box sx={{ p: 1 }}>
              <Typography variant="h6" color="warning" gutterBottom>
                Voucher #: {savedVoucher.voucher_no}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Date:</strong> {savedVoucher.voucher_date}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Cold Storage Source:</strong> {savedVoucher.cold_storage_name}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Destination:</strong> {savedVoucher.destination_godown_name}
              </Typography>
              {savedVoucher.vehicle_no && (
                <Typography variant="body2" gutterBottom>
                  <strong>Vehicle #:</strong> {savedVoucher.vehicle_no}
                </Typography>
              )}
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>Items Issued:</Typography>
              {savedVoucher.items.map((it, idx) => (
                <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, fontSize: '13px' }}>
                  <span>{it.item_name} (CS Lot: {it.cold_storage_lot_no} / Purchase Lot: {it.purchase_lot_no})</span>
                  <span><strong>{it.quantity} {it.unit}</strong> ({it.total_wt} KG)</span>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
          <Button variant="outlined" onClick={handleResetForm}>
            Create Another Voucher
          </Button>
          <Button
            variant="contained"
            color="warning"
            startIcon={<PrintIcon />}
            onClick={handlePrintIssueSlip}
          >
            Print Issue Slip
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ColdStorageOut;
