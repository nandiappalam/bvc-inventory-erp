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
  ToggleButton,
  Stack,
  Tabs,
  Tab,
  Tooltip,
  TablePagination
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
  ReceiptLong as ReceiptIcon,
  Edit as EditIcon,
  Close as CloseIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../services/api';
import { printHtml } from '../../utils/printHelper';
import ColdStorageReleaseOrderModal from './ColdStorageReleaseOrderModal';

const ColdStorageOut = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const today = new Date().toISOString().split('T')[0];

  const [activeView, setActiveView] = useState('create'); // 'create' | 'history'
  const [historyVouchers, setHistoryVouchers] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyCsFilter, setHistoryCsFilter] = useState('');
  const [historyPage, setHistoryPage] = useState(0);
  const [historyRowsPerPage, setHistoryRowsPerPage] = useState(25);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [savedVoucher, setSavedVoucher] = useState(null);

  // CSRO Release Order Modal State
  const [csroModalOpen, setCsroModalOpen] = useState(false);
  const [selectedCsroVoucher, setSelectedCsroVoucher] = useState(null);

  // Bill Editing State
  const [isEditingBill, setIsEditingBill] = useState(false);
  const [billEditData, setBillEditData] = useState({});
  const [savingBill, setSavingBill] = useState(false);

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
    const storageRatePerKg = totWt > 0 ? Number((storageCharge / totWt).toFixed(2)) : (parseFloat(slabs[0]?.rate) || 0.20);
    const baseDailyRate = parseFloat(slabs[0]?.rate || 0.20);

    return {
      calendarDays,
      billableDays,
      baseDailyRate,
      storageRatePerKg,
      storageCharge: Number(storageCharge.toFixed(2)),
      handlingRatePerKg: outRate,
      loadingCharge: Number(loadingCharge.toFixed(2)),
      totalReleasedCost: Number((storageCharge + loadingCharge).toFixed(2)),
      remainingQty: Number(remainingQty.toFixed(2)),
      remainingWt: Number((remainingQty * wt).toFixed(2))
    };
  };

  useEffect(() => {
    fetchInitialData();
    fetchHistoryVouchers();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const viewParam = params.get('view') || params.get('tab');
    const voucherIdParam = params.get('id') || params.get('voucher_id');
    const voucherNoParam = params.get('voucher_no');

    if (viewParam === 'history' || voucherIdParam || voucherNoParam) {
      setActiveView('history');
      if (voucherIdParam) {
        handleOpenVoucherBillPreview(voucherIdParam);
      } else if (voucherNoParam) {
        handleOpenVoucherBillPreview(voucherNoParam);
      }
    }
  }, [location.search]);

  const fetchHistoryVouchers = async () => {
    setLoadingHistory(true);
    try {
      const res = await api('/cold-storage/vouchers?voucher_type=OUT');
      if (res && res.data) {
        setHistoryVouchers(res.data);
      }
    } catch (err) {
      console.error('Error fetching CSO history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleOpenVoucherBillPreview = async (voucherIdOrObj) => {
    setLoading(true);
    try {
      const id = typeof voucherIdOrObj === 'object' ? voucherIdOrObj.id : voucherIdOrObj;
      const res = await api(`/cold-storage/vouchers/${id}`);
      if (res && res.data) {
        const v = res.data;
        const tariff = v.tariff || tariffConfig;
        const b = v.bill || {
          id: v.bill_id,
          bill_no: v.bill_no || `CSB-${v.voucher_no}`,
          bill_date: v.voucher_date,
          cold_storage_name: v.cold_storage_name,
          operator_name: v.operator_name || 'Cold Storage Operator',
          storage_charges: v.storage_charges || 0,
          handling_charges: v.handling_amount || 0,
          insurance_charges: 0,
          mamool_charges: 0,
          other_charges: 0,
          taxable_amount: (parseFloat(v.storage_charges || 0) + parseFloat(v.handling_amount || 0)),
          tax_rate: 18,
          cgst_amount: Number(((parseFloat(v.storage_charges || 0) + parseFloat(v.handling_amount || 0)) * 0.09).toFixed(2)),
          sgst_amount: Number(((parseFloat(v.storage_charges || 0) + parseFloat(v.handling_amount || 0)) * 0.09).toFixed(2)),
          grand_total: v.bill_grand_total || Number(((parseFloat(v.storage_charges || 0) + parseFloat(v.handling_amount || 0)) * 1.18).toFixed(2)),
          operator_invoice_no: '',
          operator_invoice_date: v.voucher_date,
          operator_invoice_amount: v.bill_grand_total || Number(((parseFloat(v.storage_charges || 0) + parseFloat(v.handling_amount || 0)) * 1.18).toFixed(2)),
          remarks: v.remarks || '',
          items: v.items || []
        };

        const enrichedItems = (v.items || []).map(it => {
          const qty = parseFloat(it.quantity || 0);
          const wt = parseFloat(it.weight || 1);
          const totWt = parseFloat(it.total_wt || (qty * wt));
          const calendarDays = it.calendar_days || 1;
          const sRate = it.storage_charges && totWt > 0 ? (it.storage_charges / (totWt * Math.max(1, calendarDays))) : (tariff?.storageSlabs?.[0]?.rate || 0.20);
          const hRate = it.loading_charges && totWt > 0 ? (it.loading_charges / totWt) : parseFloat(v.handling_rate || 0.50);

          return {
            ...it,
            charges: {
              calendarDays: it.calendar_days || calendarDays,
              billableDays: it.calendar_days || calendarDays,
              storageCharge: parseFloat(it.storage_charges || 0),
              loadingCharge: parseFloat(it.loading_charges || (totWt * hRate)),
              totalReleasedCost: (parseFloat(it.storage_charges || 0) + parseFloat(it.loading_charges || (totWt * hRate))),
              storageRatePerKg: sRate,
              handlingRatePerKg: hRate,
              remainingQty: it.remaining_quantity !== undefined ? it.remaining_quantity : 0,
              remainingWt: it.remaining_weight !== undefined ? it.remaining_weight : 0
            }
          };
        });

        const vData = {
          id: v.id,
          voucher_no: v.voucher_no,
          voucher_date: v.voucher_date,
          cold_storage_name: v.cold_storage_name,
          operator_name: v.operator_name || 'Cold Storage Operator',
          outward_dest_type: v.destination_godown_name?.toLowerCase().includes('customer') ? 'Customer Dispatch' : 'Internal Godown',
          destination_godown_name: v.destination_godown_name || 'Main Godown',
          customer_name: v.customer_name || '',
          sales_order_ref: v.sales_order_ref || '',
          vehicle_no: v.vehicle_no || '',
          driver_name: v.driver_name || '',
          driver_phone: v.driver_phone || '',
          transporter_name: v.transporter_name || '',
          lr_no: v.lr_no || '',
          gate_pass_no: v.gate_pass_no || '',
          handling_rate: v.handling_rate || 0,
          handling_amount: v.handling_amount || 0,
          total_qty: v.total_qty || 0,
          total_wt: v.total_wt || 0,
          remarks: v.remarks || '',
          items: enrichedItems,
          bill: b,
          tariff: tariff
        };

        setSavedVoucher(vData);
        setBillEditData({
          operator_invoice_no: b.operator_invoice_no || '',
          operator_invoice_date: b.operator_invoice_date || v.voucher_date,
          operator_invoice_amount: b.operator_invoice_amount || b.grand_total,
          storage_charges: b.storage_charges || 0,
          handling_charges: b.handling_charges || v.handling_amount || 0,
          insurance_charges: b.insurance_charges || 0,
          mamool_charges: b.mamool_charges || 0,
          other_charges: b.other_charges || 0,
          tax_rate: b.tax_rate || 18,
          remarks: b.remarks || v.remarks || ''
        });
        setIsEditingBill(false);
        setPrintModalOpen(true);
      }
    } catch (err) {
      console.error('Error opening voucher bill preview:', err);
      setMessage('Failed to open bill preview: ' + err.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVoucher = async (id, vNo) => {
    const ok = window.__appConfirm ? await window.__appConfirm({
      title: 'Delete Cold Storage Outward Voucher',
      message: `Are you sure you want to delete CSO Voucher ${vNo}? This will restore the stock in Cold Storage.`,
      confirmColor: 'error'
    }) : window.confirm(`Are you sure you want to delete CSO Voucher ${vNo}?`);
    if (!ok) return;

    try {
      const res = await api(`/cold-storage/vouchers/${id}`, { method: 'DELETE' });
      if (res && res.success) {
        setMessage(`Voucher ${vNo} deleted successfully and stock restored.`);
        setMessageType('success');
        fetchHistoryVouchers();
      }
    } catch (e) {
      setMessage('Error deleting voucher: ' + e.message);
      setMessageType('error');
    }
  };

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
      let lotWeight = parseFloat(
        selectedLot.weight ||
        selectedLot.per_weight ||
        (selectedLot.available_wt && selectedLot.available_qty
          ? selectedLot.available_wt / selectedLot.available_qty
          : 50)
      ) || 50;

      if (lotWeight <= 1) {
        lotWeight = (selectedLot.available_wt && selectedLot.available_qty && selectedLot.available_wt > selectedLot.available_qty)
          ? selectedLot.available_wt / selectedLot.available_qty
          : 50;
      }

      const initialQty = selectedLot.available_qty > 0 ? selectedLot.available_qty : '';
      const initialTotalWt = initialQty !== '' ? (parseFloat(initialQty) * lotWeight).toFixed(2) : '';

      updated[index] = {
        ...updated[index],
        item_name: selectedLot.item_name,
        purchase_lot_no: selectedLot.purchase_lot_no,
        cold_storage_lot_no: selectedLot.cold_storage_lot_no,
        unit: 'Bags',
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
        const fullBill = res.bill || {
          id: res.bill_id,
          bill_no: res.bill_no || `CSB-${res.voucher_no || voucherNo}`,
          bill_date: voucherDate,
          cold_storage_name: coldStorageName,
          operator_name: selectedCsObj?.operator_name || 'Cold Storage Operator',
          storage_charges: res.total_storage_charges || 0,
          handling_charges: res.total_handling_charges || totalHandlingCharges,
          insurance_charges: 0,
          mamool_charges: 0,
          other_charges: 0,
          taxable_amount: (res.total_storage_charges || 0) + (res.total_handling_charges || totalHandlingCharges),
          tax_rate: 18,
          cgst_amount: Number((((res.total_storage_charges || 0) + (res.total_handling_charges || totalHandlingCharges)) * 0.09).toFixed(2)),
          sgst_amount: Number((((res.total_storage_charges || 0) + (res.total_handling_charges || totalHandlingCharges)) * 0.09).toFixed(2)),
          grand_total: res.bill_grand_total || Number((((res.total_storage_charges || 0) + (res.total_handling_charges || totalHandlingCharges)) * 1.18).toFixed(2)),
          operator_invoice_no: '',
          operator_invoice_date: voucherDate,
          operator_invoice_amount: res.bill_grand_total || Number((((res.total_storage_charges || 0) + (res.total_handling_charges || totalHandlingCharges)) * 1.18).toFixed(2)),
          remarks: remarks || '',
          items: res.billing_items || validItems
        };

        const enrichedItems = validItems.map(it => {
          const c = calculateReleasedCharge(it);
          return {
            ...it,
            charges: c
          };
        });

        const vData = {
          voucher_no: res.voucher_no || voucherNo,
          voucher_date: voucherDate,
          cold_storage_name: coldStorageName,
          operator_name: selectedCsObj?.operator_name || selectedCsObj?.external_company || 'Cold Storage Operator',
          outward_dest_type: outwardDestType,
          destination_godown_name: outwardDestType === 'Internal Godown' ? destinationGodownName : `Customer: ${customerName}`,
          customer_name: customerName,
          sales_order_ref: salesOrderRef,
          vehicle_no: vehicleNo,
          driver_name: driverName,
          driver_phone: driverPhone,
          transporter_name: transporterName,
          lr_no: lrNo,
          gate_pass_no: gatePassNo,
          handling_rate: handlingRate,
          handling_amount: totalHandlingCharges,
          total_qty: res.total_qty || totalQtySum,
          total_wt: res.total_wt || totalWtSum,
          remarks,
          items: enrichedItems,
          bill: fullBill,
          tariff: res.tariff || tariffConfig
        };

        setSavedVoucher(vData);
        setBillEditData({
          operator_invoice_no: fullBill.operator_invoice_no || '',
          operator_invoice_date: fullBill.operator_invoice_date || voucherDate,
          operator_invoice_amount: fullBill.operator_invoice_amount || fullBill.grand_total,
          storage_charges: fullBill.storage_charges || 0,
          handling_charges: fullBill.handling_charges || totalHandlingCharges,
          insurance_charges: fullBill.insurance_charges || 0,
          mamool_charges: fullBill.mamool_charges || 0,
          other_charges: fullBill.other_charges || 0,
          tax_rate: fullBill.tax_rate || 18,
          remarks: fullBill.remarks || remarks || ''
        });
        setIsEditingBill(false);
        setPrintModalOpen(true);
        fetchHistoryVouchers();
        setMessage(`Success: Cold Storage Outward ${res.voucher_no} issued & Bill #${fullBill.bill_no} generated successfully!`);
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

  const handleSaveBillEdits = async () => {
    if (!savedVoucher?.bill?.id) {
      alert('Bill ID not found. Unable to update bill.');
      return;
    }
    setSavingBill(true);
    try {
      const res = await api(`/cold-storage/bills/${savedVoucher.bill.id}`, {
        method: 'PUT',
        body: JSON.stringify(billEditData)
      });
      if (res && (res.success || res.bill || res.data)) {
        const updatedBill = res.bill || res.data || res;
        setSavedVoucher(prev => ({
          ...prev,
          bill: updatedBill
        }));
        setIsEditingBill(false);
        setMessage(`Cold Storage Bill #${updatedBill.bill_no || savedVoucher.bill.bill_no} updated successfully!`);
        setMessageType('success');
      } else {
        alert(res?.message || 'Error updating bill');
      }
    } catch (e) {
      alert('Error updating bill: ' + e.message);
    } finally {
      setSavingBill(false);
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
    const bill = savedVoucher.bill || {};
    const itemsList = savedVoucher.items || [];

    const itemsHtml = itemsList.map((it, idx) => {
      const c = it.charges || calculateReleasedCharge(it);
      const issueKg = parseFloat(it.total_wt || (parseFloat(it.quantity || 0) * parseFloat(it.weight || 1))) || 0;
      const sRate = c.storageRatePerKg || (c.storageCharge > 0 && issueKg > 0 ? (c.storageCharge / issueKg) : 0.20);
      const hRate = c.handlingRatePerKg || parseFloat(savedVoucher.handling_rate || 0.50);

      return `
        <tr>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${idx + 1}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: bold;">
            ${it.item_name}
            <div style="font-size: 10px; color: #b45309;">CS Lot: ${it.cold_storage_lot_no || '-'}</div>
          </td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${it.purchase_lot_no || '-'}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${it.inward_date || 'N/A'}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold;">${c.calendarDays || 1}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold;">${it.quantity} ${it.unit}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold;">${issueKg.toFixed(1)} KG</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">₹${Number(sRate).toFixed(2)}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; color: #0369a1; font-weight: bold;">₹${(c.storageCharge || 0).toFixed(2)}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">₹${Number(hRate).toFixed(2)}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; color: #d97706; font-weight: bold;">₹${(c.loadingCharge || 0).toFixed(2)}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; color: #15803d; font-weight: bold;">₹${(c.totalReleasedCost || 0).toFixed(2)}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${c.remainingQty !== undefined ? c.remainingQty : '-'} ${it.unit}</td>
        </tr>
      `;
    }).join('');

    const totalStorage = parseFloat(bill.storage_charges || savedVoucher.total_storage_charges || 0);
    const totalHandling = parseFloat(bill.handling_charges || savedVoucher.handling_amount || 0);
    const totalInsurance = parseFloat(bill.insurance_charges || 0);
    const taxableAmount = parseFloat(bill.taxable_amount || (totalStorage + totalHandling + totalInsurance));
    const taxRate = parseFloat(bill.tax_rate || 18);
    const cgstAmt = parseFloat(bill.cgst_amount || ((taxableAmount * (taxRate / 2)) / 100));
    const sgstAmt = parseFloat(bill.sgst_amount || ((taxableAmount * (taxRate / 2)) / 100));
    const totalTax = cgstAmt + sgstAmt;
    const grandTotal = parseFloat(bill.grand_total || (taxableAmount + totalTax));

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 14px; color: #0f172a;">
        <div style="border-bottom: 3px solid #b45309; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <div style="font-size: 22px; font-weight: 900; color: #b45309; text-transform: uppercase; letter-spacing: 0.5px;">BHAGWATI VEG COMMODITIES</div>
            <div style="font-size: 14px; font-weight: 800; color: #1e293b; margin-top: 2px;">
              COLD STORAGE OUTWARD BILL & MATERIAL RELEASE SLIP (CSO)
            </div>
          </div>
          <div style="text-align: right; font-size: 11px; color: #475569;">
            <div><strong>Bill No:</strong> <span style="color: #b45309; font-size: 13px; font-weight: bold;">${bill.bill_no || 'CSB-' + savedVoucher.voucher_no}</span></div>
            <div><strong>Voucher #:</strong> ${savedVoucher.voucher_no}</div>
            <div><strong>Date:</strong> ${savedVoucher.voucher_date}</div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; background: #fffbeb; padding: 10px 14px; border-radius: 6px; margin-bottom: 14px; font-size: 11px; border: 1px solid #fde68a;">
          <div style="width: 48%; line-height: 1.6;">
            <div><strong>Cold Storage Facility:</strong> ${savedVoucher.cold_storage_name}</div>
            <div><strong>Operator / Agency:</strong> ${savedVoucher.operator_name || 'Cold Storage Operator'}</div>
            <div><strong>Dispatch Destination:</strong> ${savedVoucher.destination_godown_name}</div>
            ${savedVoucher.customer_name ? `<div><strong>Customer / Buyer:</strong> ${savedVoucher.customer_name}</div>` : ''}
            ${savedVoucher.sales_order_ref ? `<div><strong>Sales/Order Ref:</strong> ${savedVoucher.sales_order_ref}</div>` : ''}
          </div>
          <div style="width: 48%; text-align: right; line-height: 1.6;">
            <div><strong>Vehicle / Lorry #:</strong> ${savedVoucher.vehicle_no || 'N/A'}</div>
            <div><strong>Transporter:</strong> ${savedVoucher.transporter_name || 'Direct / Self'}</div>
            <div><strong>Driver:</strong> ${savedVoucher.driver_name || 'N/A'} ${savedVoucher.driver_phone ? `(${savedVoucher.driver_phone})` : ''}</div>
            <div><strong>LR / Bilty #:</strong> ${savedVoucher.lr_no || 'N/A'} | <strong>Gate Pass #:</strong> ${savedVoucher.gate_pass_no || 'N/A'}</div>
            <div><strong>Status:</strong> <span style="color: #15803d; font-weight: bold;">${bill.status || 'Confirmed'}</span></div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 10.5px; margin-bottom: 12px;">
          <thead>
            <tr style="background-color: #b45309; color: #ffffff;">
              <th style="padding: 6px 4px; border: 1px solid #b45309; text-align: center;">#</th>
              <th style="padding: 6px 4px; border: 1px solid #b45309; text-align: left;">Lot No & Item</th>
              <th style="padding: 6px 4px; border: 1px solid #b45309; text-align: center;">Purchase Lot</th>
              <th style="padding: 6px 4px; border: 1px solid #b45309; text-align: center;">Inward Date</th>
              <th style="padding: 6px 4px; border: 1px solid #b45309; text-align: center;">Days</th>
              <th style="padding: 6px 4px; border: 1px solid #b45309; text-align: right;">Qty</th>
              <th style="padding: 6px 4px; border: 1px solid #b45309; text-align: right;">Weight</th>
              <th style="padding: 6px 4px; border: 1px solid #b45309; text-align: right;">Storage/KG</th>
              <th style="padding: 6px 4px; border: 1px solid #b45309; text-align: right;">Storage (₹)</th>
              <th style="padding: 6px 4px; border: 1px solid #b45309; text-align: right;">Handling/KG</th>
              <th style="padding: 6px 4px; border: 1px solid #b45309; text-align: right;">Handling (₹)</th>
              <th style="padding: 6px 4px; border: 1px solid #b45309; text-align: right;">Total Cost (₹)</th>
              <th style="padding: 6px 4px; border: 1px solid #b45309; text-align: center;">Balance Left</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr style="background-color: #f8fafc; font-weight: bold; border-top: 2px solid #cbd5e1;">
              <td colspan="5" style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">TOTALS:</td>
              <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; color: #b45309;">${savedVoucher.total_qty}</td>
              <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; color: #b45309;">${savedVoucher.total_wt} KG</td>
              <td style="padding: 6px; border: 1px solid #cbd5e1;"></td>
              <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; color: #0369a1;">₹${totalStorage.toFixed(2)}</td>
              <td style="padding: 6px; border: 1px solid #cbd5e1;"></td>
              <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; color: #d97706;">₹${totalHandling.toFixed(2)}</td>
              <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; color: #15803d; font-size: 11.5px;">₹${(totalStorage + totalHandling).toFixed(2)}</td>
              <td style="padding: 6px; border: 1px solid #cbd5e1;"></td>
            </tr>
          </tfoot>
        </table>

        <!-- Financial Summary & Tax Statement -->
        <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
          <div style="width: 320px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 10px; font-size: 11.5px; line-height: 1.8;">
            <div style="display: flex; justify-content: space-between;">
              <span>Total Storage Charges:</span>
              <span style="font-weight: bold;">₹${totalStorage.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Total Handling / Loading:</span>
              <span style="font-weight: bold;">₹${totalHandling.toFixed(2)}</span>
            </div>
            ${totalInsurance > 0 ? `
              <div style="display: flex; justify-content: space-between;">
                <span>Insurance / Other Charges:</span>
                <span style="font-weight: bold;">₹${totalInsurance.toFixed(2)}</span>
              </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; border-top: 1px dashed #94a3b8; padding-top: 4px; margin-top: 2px;">
              <span>Taxable Subtotal:</span>
              <span style="font-weight: bold;">₹${taxableAmount.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: #475569; font-size: 10.5px;">
              <span>CGST (${(taxRate / 2).toFixed(1)}%):</span>
              <span>₹${cgstAmt.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: #475569; font-size: 10.5px;">
              <span>SGST (${(taxRate / 2).toFixed(1)}%):</span>
              <span>₹${sgstAmt.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-top: 2px solid #b45309; padding-top: 4px; margin-top: 4px; font-size: 13px; font-weight: bold; color: #b45309;">
              <span>Grand Total Payable:</span>
              <span>₹${grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        ${savedVoucher.remarks ? `
          <div style="margin-top: 14px; font-size: 11px; color: #475569; background: #f1f5f9; padding: 6px 10px; border-radius: 4px;">
            <strong>Remarks / Dispatch Notes:</strong> ${savedVoucher.remarks}
          </div>
        ` : ''}

        <div style="margin-top: 35px; display: flex; justify-content: space-between; font-size: 11px; color: #475569;">
          <div style="border-top: 1px solid #94a3b8; width: 170px; text-align: center; padding-top: 4px;">
            <strong>Prepared By</strong><br /><span style="font-size: 10px;">ERP Warehouse Admin</span>
          </div>
          <div style="border-top: 1px solid #94a3b8; width: 190px; text-align: center; padding-top: 4px;">
            <strong>Cold Storage Operator</strong><br /><span style="font-size: 10px;">Facility Incharge Signature</span>
          </div>
          <div style="border-top: 1px solid #94a3b8; width: 170px; text-align: center; padding-top: 4px;">
            <strong>Receiver / Transporter</strong><br /><span style="font-size: 10px;">Driver Signature & Date</span>
          </div>
        </div>
      </div>
    `;
    printHtml(html, `Cold_Outward_Bill_${savedVoucher.voucher_no}`);
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
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant={activeView === 'history' ? 'contained' : 'outlined'}
            color="warning"
            startIcon={<ReceiptIcon />}
            onClick={() => {
              const next = activeView === 'create' ? 'history' : 'create';
              setActiveView(next);
              if (next === 'history') fetchHistoryVouchers();
            }}
            sx={{ fontWeight: 800, bgcolor: activeView === 'history' ? '#d97706' : '#ffffff' }}
          >
            {activeView === 'create' ? `View CSO Bills & Register (${historyVouchers.length})` : '➕ Issue New CSO Voucher'}
          </Button>
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

      {/* View Switcher Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeView}
          onChange={(_, val) => {
            setActiveView(val);
            if (val === 'history') fetchHistoryVouchers();
          }}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
          sx={{
            '& .Mui-selected': { color: '#b45309 !important', fontWeight: 800 },
            '& .MuiTabs-indicator': { backgroundColor: '#d97706', height: 3 }
          }}
        >
          <Tab
            icon={<ColdIcon fontSize="small" />}
            iconPosition="start"
            label="1. Issue New CSO Outward Voucher"
            value="create"
            sx={{ fontWeight: 800, textTransform: 'none', fontSize: '14px' }}
          />
          <Tab
            icon={<ReceiptIcon fontSize="small" />}
            iconPosition="start"
            label={`2. CSO Outward Register & Bill Previews (${historyVouchers.length})`}
            value="history"
            sx={{ fontWeight: 800, textTransform: 'none', fontSize: '14px' }}
          />
        </Tabs>
      </Paper>

      {message && (
        <Alert severity={messageType} sx={{ mb: 3 }} onClose={() => setMessage('')}>
          {message}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      ) : activeView === 'create' ? (
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

                  <TableContainer component={Paper} variant="outlined" sx={{ backgroundColor: '#ffffff', mb: 1.5, overflowX: 'auto' }}>
                    <Table size="small">
                      <TableHead sx={{ backgroundColor: '#fef3c7' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Lot No & Item</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }} align="center">Inward Date</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }} align="center">Calendar Days</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }} align="right">Released Qty (KG)</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }} align="right">Storage Rate (₹/kg)</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }} align="right">Storage Charge (₹)</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }} align="right">Handling Rate (₹/kg)</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }} align="right">Total Handling Amnt (₹)</TableCell>
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
                            const sRate = c.storageRatePerKg || (c.storageCharge > 0 && issueKg > 0 ? (c.storageCharge / issueKg) : c.baseDailyRate);
                            const hRate = c.handlingRatePerKg || parseFloat(handlingRate || 0.50);
                            return (
                              <TableRow key={iIdx} hover>
                                <TableCell sx={{ fontWeight: 600 }}>
                                  {it.item_name} <br />
                                  <Typography variant="caption" sx={{ color: '#92400e', fontWeight: 700 }}>
                                    Lot: {it.cold_storage_lot_no} {it.purchase_lot_no ? `• Pur: ${it.purchase_lot_no}` : ''}
                                  </Typography>
                                </TableCell>
                                <TableCell align="center">{it.inward_date || 'Today'}</TableCell>
                                <TableCell align="center">
                                  <Chip label={`${c.calendarDays} Days`} size="small" sx={{ height: 20, fontSize: '11px', fontWeight: 'bold', bgcolor: '#fef3c7', color: '#92400e' }} />
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                  {it.quantity} {it.unit} <br />
                                  <Typography variant="caption" color="text.secondary">({issueKg.toFixed(1)} KG)</Typography>
                                </TableCell>
                                <TableCell align="right" sx={{ color: '#0284c7', fontWeight: 600 }}>
                                  ₹{Number(sRate).toFixed(2)}
                                </TableCell>
                                <TableCell align="right" sx={{ color: '#0369a1', fontWeight: 'bold' }}>
                                  ₹{c.storageCharge.toFixed(2)}
                                </TableCell>
                                <TableCell align="right" sx={{ color: '#d97706', fontWeight: 600 }}>
                                  ₹{Number(hRate).toFixed(2)}
                                </TableCell>
                                <TableCell align="right" sx={{ color: '#b45309', fontWeight: 'bold' }}>
                                  ₹{c.loadingCharge.toFixed(2)}
                                </TableCell>
                                <TableCell align="right" sx={{ color: '#16a34a', fontWeight: 'bold', fontSize: '13px' }}>
                                  ₹{c.totalReleasedCost.toFixed(2)}
                                </TableCell>
                                <TableCell align="center">
                                  <Chip
                                    label={`${c.remainingQty} ${it.unit} (${c.remainingWt || 0} KG)`}
                                    size="small"
                                    color={c.remainingQty > 0 ? 'info' : 'default'}
                                    variant="outlined"
                                    sx={{ height: 22, fontSize: '11px', fontWeight: 'bold' }}
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
      ) : (
        /* History & Bill Register View */
        <Box>
          {/* Filter Bar */}
          <Card sx={{ mb: 3, p: 2, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search Voucher #, Bill #, Cold Storage, Customer, Lot, Vehicle..."
                  value={historySearch}
                  onChange={(e) => {
                    setHistorySearch(e.target.value);
                    setHistoryPage(0);
                  }}
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ color: '#94a3b8', mr: 1, fontSize: 20 }} />
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  select
                  size="small"
                  label="Filter by Cold Storage"
                  value={historyCsFilter}
                  onChange={(e) => {
                    setHistoryCsFilter(e.target.value);
                    setHistoryPage(0);
                  }}
                >
                  <MenuItem value="">-- All Cold Storage Facilities --</MenuItem>
                  {coldStorages.map((cs) => (
                    <MenuItem key={cs.id} value={cs.id}>
                      {cs.godown_name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={5} sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={fetchHistoryVouchers}
                  disabled={loadingHistory}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  Refresh
                </Button>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setActiveView('create')}
                  sx={{ backgroundColor: '#d97706', '&:hover': { backgroundColor: '#b45309' }, textTransform: 'none', fontWeight: 800 }}
                >
                  Issue New CSO Voucher
                </Button>
              </Grid>
            </Grid>
          </Card>

          {/* KPI Summary Cards */}
          {(() => {
            const filtered = historyVouchers.filter(v => {
              const matchesCs = !historyCsFilter || String(v.cold_storage_id) === String(historyCsFilter);
              if (!matchesCs) return false;
              if (!historySearch.trim()) return true;
              const q = historySearch.toLowerCase();
              return (
                (v.voucher_no || '').toLowerCase().includes(q) ||
                (v.cold_storage_name || '').toLowerCase().includes(q) ||
                (v.destination_godown_name || '').toLowerCase().includes(q) ||
                (v.customer_name || '').toLowerCase().includes(q) ||
                (v.vehicle_no || '').toLowerCase().includes(q) ||
                (v.driver_name || '').toLowerCase().includes(q) ||
                (v.bill_no || '').toLowerCase().includes(q) ||
                (v.remarks || '').toLowerCase().includes(q)
              );
            });

            const totQty = filtered.reduce((acc, v) => acc + parseFloat(v.total_qty || 0), 0);
            const totWt = filtered.reduce((acc, v) => acc + parseFloat(v.total_wt || 0), 0);
            const totBillAmnt = filtered.reduce((acc, v) => acc + parseFloat(v.bill_grand_total || v.handling_amount || 0), 0);

            return (
              <>
                <Grid container spacing={2.5} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#fffbeb' }}>
                      <Typography variant="caption" sx={{ fontWeight: 800, color: '#b45309', textTransform: 'uppercase' }}>
                        CSO Vouchers Issued
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900, color: '#92400e', mt: 0.5 }}>
                        {filtered.length} Vouchers
                      </Typography>
                    </Paper>
                  </Grid>

                  <Grid item xs={12} sm={6} md={3}>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#f0fdf4' }}>
                      <Typography variant="caption" sx={{ fontWeight: 800, color: '#15803d', textTransform: 'uppercase' }}>
                        Total Quantity Released
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900, color: '#166534', mt: 0.5 }}>
                        {totQty.toFixed(2)} Units
                      </Typography>
                    </Paper>
                  </Grid>

                  <Grid item xs={12} sm={6} md={3}>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#eff6ff' }}>
                      <Typography variant="caption" sx={{ fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase' }}>
                        Total Weight Released
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900, color: '#1e40af', mt: 0.5 }}>
                        {totWt.toFixed(2)} KG
                      </Typography>
                    </Paper>
                  </Grid>

                  <Grid item xs={12} sm={6} md={3}>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#fdf4ff' }}>
                      <Typography variant="caption" sx={{ fontWeight: 800, color: '#a21caf', textTransform: 'uppercase' }}>
                        Total CSO Bill Value
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900, color: '#86198f', mt: 0.5 }}>
                        ₹{totBillAmnt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>

                {/* Vouchers & Bill Statement Register Table */}
                <Card sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: 2 }}>
                  <CardContent sx={{ p: 0 }}>
                    {loadingHistory ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
                        <CircularProgress />
                      </Box>
                    ) : filtered.length === 0 ? (
                      <Box sx={{ p: 6, textAlign: 'center' }}>
                        <ReceiptIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 1 }} />
                        <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 700 }}>
                          No Cold Storage Outward (CSO) vouchers found.
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Issue your first CSO outward voucher to view and manage its itemized bill statement.
                        </Typography>
                        <Button
                          variant="contained"
                          startIcon={<AddIcon />}
                          onClick={() => setActiveView('create')}
                          sx={{ backgroundColor: '#d97706', '&:hover': { backgroundColor: '#b45309' }, fontWeight: 800 }}
                        >
                          Issue New CSO Voucher
                        </Button>
                      </Box>
                    ) : (
                      <>
                        <TableContainer sx={{ maxHeight: 600 }}>
                          <Table stickyHeader size="small">
                            <TableHead sx={{ '& th': { bgcolor: '#92400e', color: '#ffffff', fontWeight: 800, textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px' } }}>
                              <TableRow>
                                <TableCell align="center" width="50" sx={{ color: '#fff' }}>#</TableCell>
                                <TableCell sx={{ color: '#fff' }}>Voucher No</TableCell>
                                <TableCell sx={{ color: '#fff' }}>Date</TableCell>
                                <TableCell sx={{ color: '#fff' }}>Cold Storage Facility</TableCell>
                                <TableCell sx={{ color: '#fff' }}>Destination / Target</TableCell>
                                <TableCell align="right" sx={{ color: '#fff' }}>Released Qty</TableCell>
                                <TableCell align="right" sx={{ color: '#fff' }}>Total Wt (KG)</TableCell>
                                <TableCell sx={{ color: '#fff' }}>Vehicle & Driver</TableCell>
                                <TableCell sx={{ color: '#fff' }}>CSO Bill #</TableCell>
                                <TableCell align="right" sx={{ color: '#fff' }}>Bill Total (₹)</TableCell>
                                <TableCell align="center" sx={{ color: '#fff' }}>Actions</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {filtered
                                .slice(historyPage * historyRowsPerPage, historyPage * historyRowsPerPage + historyRowsPerPage)
                                .map((row, idx) => {
                                  const displayBillNo = row.bill_no || `CSB-${row.voucher_no}`;
                                  const grandTotalVal = parseFloat(row.bill_grand_total || row.handling_amount || 0);

                                  return (
                                    <TableRow key={row.id} hover sx={{ '&:nth-of-type(even)': { backgroundColor: '#fffbeb' } }}>
                                      <TableCell align="center" sx={{ fontWeight: 700 }}>
                                        {historyPage * historyRowsPerPage + idx + 1}
                                      </TableCell>
                                      <TableCell>
                                        <Typography
                                          variant="body2"
                                          onClick={() => handleOpenVoucherBillPreview(row)}
                                          sx={{
                                            fontWeight: 900,
                                            color: '#b45309',
                                            cursor: 'pointer',
                                            '&:hover': { textDecoration: 'underline' }
                                          }}
                                        >
                                          {row.voucher_no}
                                        </Typography>
                                      </TableCell>
                                      <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>
                                        {row.voucher_date}
                                      </TableCell>
                                      <TableCell sx={{ fontWeight: 700, color: '#1e293b' }}>
                                        ❄️ {row.cold_storage_name}
                                      </TableCell>
                                      <TableCell>
                                        <Typography variant="body2" sx={{ fontWeight: 600, color: row.destination_godown_name?.includes('Customer') ? '#15803d' : '#0369a1' }}>
                                          {row.destination_godown_name || row.customer_name || 'Main Godown'}
                                        </Typography>
                                        {row.customer_name && !row.destination_godown_name?.includes('Customer') && (
                                          <Typography variant="caption" color="text.secondary">
                                            Cust: {row.customer_name}
                                          </Typography>
                                        )}
                                      </TableCell>
                                      <TableCell align="right" sx={{ fontWeight: 800 }}>
                                        {parseFloat(row.total_qty || 0).toFixed(2)}
                                      </TableCell>
                                      <TableCell align="right" sx={{ fontWeight: 800, color: '#475569' }}>
                                        {parseFloat(row.total_wt || 0).toFixed(2)} KG
                                      </TableCell>
                                      <TableCell sx={{ fontSize: '11px' }}>
                                        {row.vehicle_no ? <div style={{ fontFamily: 'monospace', fontWeight: 700 }}>🚚 {row.vehicle_no}</div> : null}
                                        {row.driver_name ? <div style={{ color: '#475569' }}>👤 {row.driver_name}</div> : null}
                                        {!row.vehicle_no && !row.driver_name ? '-' : null}
                                      </TableCell>
                                      <TableCell>
                                        <Chip
                                          label={displayBillNo}
                                          size="small"
                                          sx={{
                                            fontWeight: 800,
                                            fontFamily: 'monospace',
                                            bgcolor: '#fef3c7',
                                            color: '#92400e',
                                            border: '1px solid #fde68a'
                                          }}
                                        />
                                      </TableCell>
                                      <TableCell align="right" sx={{ fontWeight: 900, color: '#15803d', fontSize: '13px' }}>
                                        ₹{grandTotalVal.toFixed(2)}
                                      </TableCell>
                                      <TableCell align="center">
                                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', alignItems: 'center' }}>
                                          <Button
                                            variant="contained"
                                            size="small"
                                            startIcon={<ReceiptIcon fontSize="small" />}
                                            onClick={() => handleOpenVoucherBillPreview(row)}
                                            sx={{
                                              bgcolor: '#d97706',
                                              '&:hover': { bgcolor: '#b45309' },
                                              textTransform: 'none',
                                              fontWeight: 800,
                                              fontSize: '11px',
                                              py: 0.5,
                                              px: 1.2
                                            }}
                                          >
                                            CSO Bill Preview
                                          </Button>

                                          <Button
                                            variant="contained"
                                            size="small"
                                            startIcon={<ColdIcon fontSize="small" />}
                                            onClick={() => {
                                              setSelectedCsroVoucher(row);
                                              setCsroModalOpen(true);
                                            }}
                                            sx={{
                                              bgcolor: '#1e3a8a',
                                              '&:hover': { bgcolor: '#1d4ed8' },
                                              textTransform: 'none',
                                              fontWeight: 800,
                                              fontSize: '11px',
                                              py: 0.5,
                                              px: 1.2
                                            }}
                                          >
                                            Print CSRO
                                          </Button>

                                          <Tooltip title="View / Edit Bill">
                                            <IconButton
                                              size="small"
                                              color="warning"
                                              onClick={async () => {
                                                await handleOpenVoucherBillPreview(row);
                                                setIsEditingBill(true);
                                              }}
                                            >
                                              <EditIcon fontSize="small" />
                                            </IconButton>
                                          </Tooltip>

                                          <Tooltip title="Delete Voucher">
                                            <IconButton
                                              size="small"
                                              color="error"
                                              onClick={() => handleDeleteVoucher(row.id, row.voucher_no)}
                                            >
                                              <DeleteIcon fontSize="small" />
                                            </IconButton>
                                          </Tooltip>
                                        </Box>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                            </TableBody>
                          </Table>
                        </TableContainer>

                        <TablePagination
                          rowsPerPageOptions={[10, 25, 50, 100]}
                          component="div"
                          count={filtered.length}
                          rowsPerPage={historyRowsPerPage}
                          page={historyPage}
                          onPageChange={(e, newPage) => setHistoryPage(newPage)}
                          onRowsPerPageChange={(e) => {
                            setHistoryRowsPerPage(parseInt(e.target.value, 10));
                            setHistoryPage(0);
                          }}
                        />
                      </>
                    )}
                  </CardContent>
                </Card>
              </>
            );
          })()}
        </Box>
      )}

      {/* Full Cold Storage Outward Bill & Material Release Slip Dialog */}
      <Dialog open={printModalOpen} maxWidth="lg" fullWidth scroll="paper">
        <DialogTitle sx={{ backgroundColor: '#92400e', color: '#ffffff', py: 1.5, px: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <ReceiptIcon sx={{ fontSize: 28, color: '#fde68a' }} />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                  Cold Storage Outward Voucher & Bill Statement
                </Typography>
                <Typography variant="caption" sx={{ color: '#fef3c7', fontWeight: 600 }}>
                  Voucher #{savedVoucher?.voucher_no} • Bill #{savedVoucher?.bill?.bill_no || 'CSB-' + savedVoucher?.voucher_no} • Date: {savedVoucher?.voucher_date}
                </Typography>
              </Box>
            </Box>

            {/* ACTION BUTTONS AT THE TOP OF THE BILL */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {!isEditingBill ? (
                <>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<EditIcon />}
                    onClick={() => setIsEditingBill(true)}
                    sx={{
                      bgcolor: '#ffffff',
                      color: '#92400e',
                      fontWeight: 800,
                      px: 2,
                      '&:hover': { bgcolor: '#fef3c7' }
                    }}
                  >
                    Edit Bill
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<ColdIcon />}
                    onClick={() => {
                      setSelectedCsroVoucher(savedVoucher);
                      setCsroModalOpen(true);
                    }}
                    sx={{
                      bgcolor: '#1e3a8a',
                      color: '#ffffff',
                      fontWeight: 800,
                      px: 2,
                      '&:hover': { bgcolor: '#1d4ed8' }
                    }}
                  >
                    Print Release Order (CSRO)
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<PrintIcon />}
                    onClick={handlePrintIssueSlip}
                    sx={{
                      bgcolor: '#16a34a',
                      color: '#ffffff',
                      fontWeight: 800,
                      px: 2,
                      '&:hover': { bgcolor: '#15803d' }
                    }}
                  >
                    Print Bill & Slip
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<SaveIcon />}
                    onClick={handleSaveBillEdits}
                    disabled={savingBill}
                    sx={{
                      bgcolor: '#16a34a',
                      color: '#ffffff',
                      fontWeight: 800,
                      px: 2,
                      '&:hover': { bgcolor: '#15803d' }
                    }}
                  >
                    {savingBill ? 'Saving Changes...' : 'Save Bill Changes'}
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setIsEditingBill(false)}
                    sx={{
                      color: '#ffffff',
                      borderColor: '#ffffff',
                      fontWeight: 700,
                      '&:hover': { borderColor: '#fef3c7', bgcolor: 'rgba(255,255,255,0.1)' }
                    }}
                  >
                    Cancel Edit
                  </Button>
                </>
              )}
              <IconButton onClick={() => setPrintModalOpen(false)} sx={{ color: '#ffffff' }}>
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 3, backgroundColor: '#f8fafc' }}>
          {savedVoucher && (
            <Stack spacing={2.5}>
              {/* EDIT MODE: EDITABLE BILL FORM */}
              {isEditingBill ? (
                <Card variant="outlined" sx={{ p: 3, backgroundColor: '#ffffff', borderColor: '#f59e0b', borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <EditIcon sx={{ color: '#d97706' }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#92400e' }}>
                      Edit Cold Storage Outward Bill Charges & Invoicing Details
                    </Typography>
                  </Box>

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Operator Invoice No"
                        value={billEditData.operator_invoice_no || ''}
                        onChange={(e) => setBillEditData({ ...billEditData, operator_invoice_no: e.target.value })}
                        placeholder="e.g. INV-2026-001"
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        type="date"
                        fullWidth
                        size="small"
                        label="Operator Invoice Date"
                        value={billEditData.operator_invoice_date || ''}
                        onChange={(e) => setBillEditData({ ...billEditData, operator_invoice_date: e.target.value })}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        type="number"
                        fullWidth
                        size="small"
                        label="Operator Invoice Amount (₹)"
                        value={billEditData.operator_invoice_amount || ''}
                        onChange={(e) => setBillEditData({ ...billEditData, operator_invoice_amount: e.target.value })}
                        placeholder="0.00"
                      />
                    </Grid>

                    <Grid item xs={12} sm={4}>
                      <TextField
                        type="number"
                        fullWidth
                        size="small"
                        label="Storage Charges (₹)"
                        value={billEditData.storage_charges || ''}
                        onChange={(e) => setBillEditData({ ...billEditData, storage_charges: e.target.value })}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        type="number"
                        fullWidth
                        size="small"
                        label="Handling Charges (₹)"
                        value={billEditData.handling_charges || ''}
                        onChange={(e) => setBillEditData({ ...billEditData, handling_charges: e.target.value })}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        type="number"
                        fullWidth
                        size="small"
                        label="Insurance Charges (₹)"
                        value={billEditData.insurance_charges || ''}
                        onChange={(e) => setBillEditData({ ...billEditData, insurance_charges: e.target.value })}
                      />
                    </Grid>

                    <Grid item xs={12} sm={4}>
                      <TextField
                        type="number"
                        fullWidth
                        size="small"
                        label="Mamool Charges (₹)"
                        value={billEditData.mamool_charges || ''}
                        onChange={(e) => setBillEditData({ ...billEditData, mamool_charges: e.target.value })}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        type="number"
                        fullWidth
                        size="small"
                        label="Other Charges (₹)"
                        value={billEditData.other_charges || ''}
                        onChange={(e) => setBillEditData({ ...billEditData, other_charges: e.target.value })}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        type="number"
                        fullWidth
                        size="small"
                        label="GST Rate (%)"
                        value={billEditData.tax_rate !== undefined ? billEditData.tax_rate : 18}
                        onChange={(e) => setBillEditData({ ...billEditData, tax_rate: e.target.value })}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Bill Remarks / Notes"
                        value={billEditData.remarks || ''}
                        onChange={(e) => setBillEditData({ ...billEditData, remarks: e.target.value })}
                        placeholder="Add custom billing or adjustment remarks..."
                      />
                    </Grid>
                  </Grid>

                  {/* Dynamic Calculation Preview */}
                  {(() => {
                    const st = parseFloat(billEditData.storage_charges || 0);
                    const hd = parseFloat(billEditData.handling_charges || 0);
                    const ins = parseFloat(billEditData.insurance_charges || 0);
                    const mam = parseFloat(billEditData.mamool_charges || 0);
                    const oth = parseFloat(billEditData.other_charges || 0);
                    const txR = parseFloat(billEditData.tax_rate || 18);
                    const taxable = st + hd + ins + mam + oth;
                    const cgst = Number(((taxable * (txR / 2)) / 100).toFixed(2));
                    const sgst = Number(((taxable * (txR / 2)) / 100).toFixed(2));
                    const grand = Number((taxable + cgst + sgst).toFixed(2));
                    const invAmt = parseFloat(billEditData.operator_invoice_amount || grand);
                    const diff = Number((invAmt - grand).toFixed(2));

                    return (
                      <Box sx={{ mt: 2.5, p: 2, bgcolor: '#fffbeb', borderRadius: 1.5, border: '1px solid #fde68a' }}>
                        <Grid container spacing={2} alignItems="center">
                          <Grid item xs={6} sm={2.4}>
                            <Typography variant="caption" color="text.secondary">Taxable Subtotal</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 800 }}>₹{taxable.toFixed(2)}</Typography>
                          </Grid>
                          <Grid item xs={6} sm={2.4}>
                            <Typography variant="caption" color="text.secondary">CGST ({(txR / 2).toFixed(1)}%)</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 800 }}>₹{cgst.toFixed(2)}</Typography>
                          </Grid>
                          <Grid item xs={6} sm={2.4}>
                            <Typography variant="caption" color="text.secondary">SGST ({(txR / 2).toFixed(1)}%)</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 800 }}>₹{sgst.toFixed(2)}</Typography>
                          </Grid>
                          <Grid item xs={6} sm={2.4}>
                            <Typography variant="caption" color="text.secondary">Calculated Grand Total</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 900, color: '#15803d' }}>₹{grand.toFixed(2)}</Typography>
                          </Grid>
                          <Grid item xs={6} sm={2.4}>
                            <Typography variant="caption" color="text.secondary">Variance vs Invoice</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 800, color: diff !== 0 ? '#b91c1c' : '#15803d' }}>
                              ₹{diff.toFixed(2)}
                            </Typography>
                          </Grid>
                        </Grid>
                      </Box>
                    );
                  })()}
                </Card>
              ) : null}

              {/* VIEW MODE: FACILITY & DISPATCH INFO */}
              <Card variant="outlined" sx={{ p: 2, backgroundColor: '#ffffff', borderRadius: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 700 }}>
                      Cold Storage Facility & Operator Partner
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 800, color: '#92400e' }}>
                      ❄️ {savedVoucher.cold_storage_name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Operator: {savedVoucher.operator_name || 'Cold Storage Operator'}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 700 }}>
                      Destination / Dispatch Target
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 800, color: '#15803d' }}>
                      📍 {savedVoucher.destination_godown_name}
                    </Typography>
                    {savedVoucher.customer_name && (
                      <Typography variant="body2" color="text.secondary">
                        Customer: {savedVoucher.customer_name}
                      </Typography>
                    )}
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <Typography variant="caption" color="text.secondary">Vehicle / Transporter</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {savedVoucher.vehicle_no || 'N/A'} {savedVoucher.transporter_name ? `(${savedVoucher.transporter_name})` : ''}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="caption" color="text.secondary">Driver & Phone</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {savedVoucher.driver_name || 'N/A'} {savedVoucher.driver_phone ? `(${savedVoucher.driver_phone})` : ''}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="caption" color="text.secondary">Operator Invoice Status</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: savedVoucher.bill?.operator_invoice_no ? '#15803d' : '#d97706' }}>
                      {savedVoucher.bill?.operator_invoice_no ? `Inv #${savedVoucher.bill.operator_invoice_no}` : 'Internal Est. (Uninvoiced)'}
                    </Typography>
                  </Grid>
                </Grid>
              </Card>

              {/* ITEMIZED BILL BREAKDOWN TABLE WITH ALL REQUESTED COLUMNS */}
              <Card variant="outlined" sx={{ p: 2, backgroundColor: '#ffffff', borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e293b', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ReceiptIcon sx={{ fontSize: 18, color: '#b45309' }} />
                  Itemized Material Release & Cold Storage Outward Bill
                </Typography>

                <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead sx={{ backgroundColor: '#f1f5f9' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 800 }}>Lot No & Item</TableCell>
                        <TableCell sx={{ fontWeight: 800 }} align="center">Inward Date</TableCell>
                        <TableCell sx={{ fontWeight: 800 }} align="center">Calendar Days</TableCell>
                        <TableCell sx={{ fontWeight: 800 }} align="right">Released Qty (KG)</TableCell>
                        <TableCell sx={{ fontWeight: 800 }} align="right">Storage Charge / KG (₹)</TableCell>
                        <TableCell sx={{ fontWeight: 800 }} align="right">Storage Charge (₹)</TableCell>
                        <TableCell sx={{ fontWeight: 800 }} align="right">Handling Amnt / KG (₹)</TableCell>
                        <TableCell sx={{ fontWeight: 800 }} align="right">Total Handling Amnt (₹)</TableCell>
                        <TableCell sx={{ fontWeight: 800 }} align="right">Total Release Cost (₹)</TableCell>
                        <TableCell sx={{ fontWeight: 800 }} align="center">Remaining Balance in CS</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {savedVoucher.items.map((it, idx) => {
                        const c = it.charges || calculateReleasedCharge(it);
                        const issueKg = parseFloat(it.total_wt || (parseFloat(it.quantity || 0) * parseFloat(it.weight || 1))) || 0;
                        const sRate = c.storageRatePerKg || (c.storageCharge > 0 && issueKg > 0 ? (c.storageCharge / issueKg) : c.baseDailyRate);
                        const hRate = c.handlingRatePerKg || parseFloat(savedVoucher.handling_rate || 0.50);
                        return (
                          <TableRow key={idx} hover>
                            <TableCell sx={{ fontWeight: 700 }}>
                              {it.item_name}
                              <Typography variant="caption" sx={{ display: 'block', color: '#92400e', fontWeight: 700 }}>
                                CS Lot: {it.cold_storage_lot_no || '-'} {it.purchase_lot_no ? `• Pur Lot: ${it.purchase_lot_no}` : ''}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">{it.inward_date || 'N/A'}</TableCell>
                            <TableCell align="center">
                              <Chip label={`${c.calendarDays || 1} Days`} size="small" sx={{ height: 20, fontSize: '11px', fontWeight: 'bold' }} />
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800 }}>
                              {it.quantity} {it.unit} <br />
                              <Typography variant="caption" color="text.secondary">({issueKg.toFixed(1)} KG)</Typography>
                            </TableCell>
                            <TableCell align="right" sx={{ color: '#0284c7', fontWeight: 600 }}>
                              ₹{Number(sRate).toFixed(2)}
                            </TableCell>
                            <TableCell align="right" sx={{ color: '#0369a1', fontWeight: 800 }}>
                              ₹{(c.storageCharge || 0).toFixed(2)}
                            </TableCell>
                            <TableCell align="right" sx={{ color: '#d97706', fontWeight: 600 }}>
                              ₹{Number(hRate).toFixed(2)}
                            </TableCell>
                            <TableCell align="right" sx={{ color: '#b45309', fontWeight: 800 }}>
                              ₹{(c.loadingCharge || 0).toFixed(2)}
                            </TableCell>
                            <TableCell align="right" sx={{ color: '#15803d', fontWeight: 900, fontSize: '13px' }}>
                              ₹{(c.totalReleasedCost || 0).toFixed(2)}
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label={`${c.remainingQty !== undefined ? c.remainingQty : '-'} ${it.unit} (${c.remainingWt || 0} KG)`}
                                size="small"
                                color={c.remainingQty > 0 ? 'info' : 'default'}
                                variant="outlined"
                                sx={{ height: 22, fontSize: '11px', fontWeight: 'bold' }}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Card>

              {/* FINANCIAL SUMMARY & GST BREAKDOWN */}
              {(() => {
                const b = savedVoucher.bill || {};
                const totalStorage = parseFloat(b.storage_charges || savedVoucher.total_storage_charges || 0);
                const totalHandling = parseFloat(b.handling_charges || savedVoucher.handling_amount || 0);
                const totalInsurance = parseFloat(b.insurance_charges || 0);
                const totalMamool = parseFloat(b.mamool_charges || 0);
                const totalOther = parseFloat(b.other_charges || 0);
                const taxable = parseFloat(b.taxable_amount || (totalStorage + totalHandling + totalInsurance + totalMamool + totalOther));
                const txRate = parseFloat(b.tax_rate || 18);
                const cgst = parseFloat(b.cgst_amount || ((taxable * (txRate / 2)) / 100));
                const sgst = parseFloat(b.sgst_amount || ((taxable * (txRate / 2)) / 100));
                const grandTotal = parseFloat(b.grand_total || (taxable + cgst + sgst));
                const invAmt = parseFloat(b.operator_invoice_amount || grandTotal);
                const variance = parseFloat(b.variance_amount || (invAmt - grandTotal));

                return (
                  <Card variant="outlined" sx={{ p: 2.5, backgroundColor: '#ffffff', borderRadius: 2 }}>
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={7}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                          Invoicing Notes & Verification
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#475569', mb: 1.5, fontSize: '13px', lineHeight: 1.6 }}>
                          This Outward Bill covers storage days through calendar release date {savedVoucher.voucher_date}.
                          Any variance between the calculated amount and the Cold Storage Operator's tax invoice is tracked and recorded in the ERP ledger.
                        </Typography>
                        {savedVoucher.remarks && (
                          <Alert severity="info" sx={{ py: 0.5, fontSize: '12px' }}>
                            <strong>Voucher Remarks:</strong> {savedVoucher.remarks}
                          </Alert>
                        )}
                        {b.remarks && b.remarks !== savedVoucher.remarks && (
                          <Alert severity="warning" sx={{ mt: 1, py: 0.5, fontSize: '12px' }}>
                            <strong>Billing Notes:</strong> {b.remarks}
                          </Alert>
                        )}
                      </Grid>

                      <Grid item xs={12} md={5}>
                        <Paper elevation={0} sx={{ p: 2, bgcolor: '#fef3c7', borderRadius: 1.5, border: '1px solid #fde68a' }}>
                          <Stack spacing={1} sx={{ fontSize: '13px' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>Storage Charges:</span>
                              <strong>₹{totalStorage.toFixed(2)}</strong>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>Handling / Loading:</span>
                              <strong>₹{totalHandling.toFixed(2)}</strong>
                            </Box>
                            {totalInsurance > 0 && (
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Insurance:</span>
                                <strong>₹{totalInsurance.toFixed(2)}</strong>
                              </Box>
                            )}
                            {(totalMamool > 0 || totalOther > 0) && (
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Mamool / Other:</span>
                                <strong>₹{(totalMamool + totalOther).toFixed(2)}</strong>
                              </Box>
                            )}
                            <Divider sx={{ my: 0.5 }} />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', color: '#1e293b' }}>
                              <span>Taxable Value:</span>
                              <strong>₹{taxable.toFixed(2)}</strong>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                              <span>CGST ({(txRate / 2).toFixed(1)}%):</span>
                              <span>₹{cgst.toFixed(2)}</span>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                              <span>SGST ({(txRate / 2).toFixed(1)}%):</span>
                              <span>₹{sgst.toFixed(2)}</span>
                            </Box>
                            <Divider sx={{ my: 0.5 }} />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', color: '#92400e', fontWeight: 900 }}>
                              <span>Grand Total:</span>
                              <span>₹{grandTotal.toFixed(2)}</span>
                            </Box>
                            {variance !== 0 && (
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#b91c1c', fontWeight: 700 }}>
                                <span>Invoice Variance:</span>
                                <span>₹{variance.toFixed(2)}</span>
                              </Box>
                            )}
                          </Stack>
                        </Paper>
                      </Grid>
                    </Grid>
                  </Card>
                );
              })()}
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2.5, backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              variant="outlined"
              color="inherit"
              onClick={() => {
                setPrintModalOpen(false);
                if (activeView === 'history') {
                  fetchHistoryVouchers();
                }
              }}
              sx={{ fontWeight: 700 }}
            >
              Close Preview
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                handleResetForm();
                setActiveView('create');
              }}
              sx={{ fontWeight: 700 }}
            >
              Issue New Voucher
            </Button>
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5 }}>
            {!isEditingBill ? (
              <Button
                variant="outlined"
                color="warning"
                startIcon={<EditIcon />}
                onClick={() => setIsEditingBill(true)}
                sx={{ fontWeight: 800 }}
              >
                Edit Bill
              </Button>
            ) : (
              <Button
                variant="contained"
                color="success"
                startIcon={<SaveIcon />}
                onClick={handleSaveBillEdits}
                disabled={savingBill}
                sx={{ fontWeight: 800 }}
              >
                {savingBill ? 'Saving Changes...' : 'Save Bill Changes'}
              </Button>
            )}

            <Button
              variant="contained"
              startIcon={<ColdIcon />}
              onClick={() => {
                setSelectedCsroVoucher(savedVoucher);
                setCsroModalOpen(true);
              }}
              sx={{ backgroundColor: '#1e3a8a', '&:hover': { backgroundColor: '#1d4ed8' }, fontWeight: 800 }}
            >
              Print CSRO Release Order
            </Button>
            <Button
              variant="contained"
              startIcon={<PrintIcon />}
              onClick={handlePrintIssueSlip}
              sx={{ backgroundColor: '#d97706', '&:hover': { backgroundColor: '#b45309' }, fontWeight: 800 }}
            >
              Print Bill & Issue Slip
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* CSRO Release Order Modal */}
      <ColdStorageReleaseOrderModal
        open={csroModalOpen}
        onClose={() => setCsroModalOpen(false)}
        csoData={selectedCsroVoucher}
      />
    </Box>
  );
};

export default ColdStorageOut;
