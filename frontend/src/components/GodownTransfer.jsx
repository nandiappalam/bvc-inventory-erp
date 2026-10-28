import React, { useState, useEffect } from 'react';
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
  Tab,
  Card,
  CardContent,
  FormControlLabel,
  Switch
} from '@mui/material';
import {
  CompareArrows as TransferIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Print as PrintIcon,
  FileDownload as ExportIcon,
  Business as GodownIcon,
  Inventory as ItemIcon,
  ReceiptLong as BillIcon,
  AcUnit as ColdStorageIcon,
  Edit as EditIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  LocalShipping as TruckIcon,
  Assessment as AssessmentIcon,
  Groups as WorkerIcon,
  Engineering as HandlersIcon,
  Badge as SupervisorIcon,
  AltRoute as MethodIcon,
  DirectionsBus as VehicleIcon,
  Apartment as WarehouseIcon,
  Visibility as ViewIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material';
import { printHtml } from '../utils/printHelper';
import ColdStorageTransferStatementModal from './coldStorage/ColdStorageTransferStatementModal';
import ColdStorageReleaseOrderModal from './coldStorage/ColdStorageReleaseOrderModal';
import { InlineMasterModal } from './common/InlineMasterModal.jsx';
import { useNavigate } from 'react-router-dom';

const DEFAULT_MOVEMENT_METHODS = [
  'Hand Trolley',
  'Manual Worker Carry',
  'Forklift / Pallet Truck',
  'Conveyor Belt System',
  'Campus Tractor / Trailer',
  'Overhead Crane'
];

const GodownTransfer = ({ initialView = 'create' }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(initialView === 'display' ? 'display' : 'create');
  const [godowns, setGodowns] = useState([]);
  const [godownItems, setGodownItems] = useState([]);
  const [workersList, setWorkersList] = useState([]);
  const [openWorkerModal, setOpenWorkerModal] = useState(false);
  const [workerManual, setWorkerManual] = useState(false);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  // Quick Godown Master Creation Modal State
  const [openGodownModal, setOpenGodownModal] = useState(false);
  const [godownModalTarget, setGodownModalTarget] = useState('general'); // 'from' | 'to' | 'general'
  const [savingGodown, setSavingGodown] = useState(false);
  const [newGodownForm, setNewGodownForm] = useState({
    godown_name: '',
    area: 'Factory Campus',
    godown_type: 'Normal',
    storage_location: 'Inside Factory'
  });

  // Manual Name Entry Toggles
  const [fromGodownManual, setFromGodownManual] = useState(false);
  const [toGodownManual, setToGodownManual] = useState(false);
  const [customFromGodown, setCustomFromGodown] = useState('');
  const [customToGodown, setCustomToGodown] = useState('');

  // Movement Methods Master Dropdown List with Custom Add
  const [savedMovementMethods, setSavedMovementMethods] = useState(DEFAULT_MOVEMENT_METHODS);
  const [movementMethodManual, setMovementMethodManual] = useState(false);
  const [customMovementMethod, setCustomMovementMethod] = useState('');

  // View Voucher Modal State
  const [viewingTransfer, setViewingTransfer] = useState(null);

  // CSRO Modal State
  const [csroModalOpen, setCsroModalOpen] = useState(false);
  const [selectedCsroVoucher, setSelectedCsroVoucher] = useState(null);

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  useEffect(() => {
    if (initialView) {
      setActiveTab(initialView === 'display' ? 'display' : 'create');
    }
  }, [initialView]);

  // Modal State for Cold Storage Bill Statement
  const [openBillModal, setOpenBillModal] = useState(false);
  const [selectedTransferRow, setSelectedTransferRow] = useState(null);
  const [csSourceTariff, setCsSourceTariff] = useState(null);

  // Modal State for Editing Transfer
  const [editingTransfer, setEditingTransfer] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    s_no: 'TRF-1',
    transfer_date: new Date().toISOString().split('T')[0],
    from_godown_id: '',
    from_godown_name: '',
    to_godown_id: '',
    to_godown_name: '',
    item_name: '',
    lot_no: '',
    qty: '',
    weight: '',
    transfer_mode: 'INTERNAL_UNIT', // 'INTERNAL_UNIT' | 'EXTERNAL_VEHICLE'
    worker_team: '',
    movement_method: 'Hand Trolley',
    supervisor_name: '',
    vehicle_no: '',
    driver_name: '',
    driver_phone: '',
    transporter_name: '',
    loadman_name: '',
    loadman_rate_per_qty: '10', // Rate per bag
    loadman_charges: '',
    handling_amount: '',
    storage_rate: '',
    insurance_charges: '',
    remarks: ''
  });

  const fetchNextSNo = async () => {
    try {
      const res = await fetch('/api/godown-transfers/next-sno');
      const data = await res.json();
      if (data && data.next_s_no) {
        setFormData(prev => ({ ...prev, s_no: data.next_s_no }));
      }
    } catch (e) {
      console.error('Error fetching next transfer s_no:', e);
    }
  };

  const [selectedItemDetails, setSelectedItemDetails] = useState(null);

  // Fetch Godown Master List
  const fetchGodowns = async () => {
    try {
      const res = await fetch('/api/godowns');
      const result = await res.json();
      const list = Array.isArray(result) ? result : (result.data || []);
      if (Array.isArray(list)) {
        setGodowns(list);
      }
    } catch (err) {
      console.error('Error fetching godown master:', err);
    }
  };

  const fetchWorkers = async () => {
    try {
      const res = await fetch('/api/masters/workers');
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.data || []);
      if (Array.isArray(list)) {
        setWorkersList(list);
      }
    } catch (e) {
      console.warn('Error fetching workers:', e.message);
    }
  };

  const handleWorkerCreated = (newId, newRecord) => {
    const workerName = newRecord?.name || newRecord?.worker_name || '';
    if (workerName) {
      setWorkersList(prev => {
        if (!prev.some(w => w.name === workerName || w.id === newId)) {
          return [...prev, { id: newId, name: workerName, ...newRecord }];
        }
        return prev;
      });
      setFormData(prev => ({
        ...prev,
        worker_team: workerName,
        loadman_name: workerName
      }));
    }
    fetchWorkers();
    setOpenWorkerModal(false);
  };

  useEffect(() => {
    fetchGodowns();
    fetchWorkers();
    fetchTransfers();
    fetchNextSNo();
  }, []);

  // Save new godown master
  const handleSaveNewGodown = async () => {
    if (!newGodownForm.godown_name.trim()) {
      setMessage({ type: 'error', text: 'Please enter a Godown / Factory Unit Name' });
      return;
    }
    setSavingGodown(true);
    try {
      const res = await fetch('/api/godowns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newGodownForm)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const savedName = newGodownForm.godown_name.trim();
        const newGodownId = data.id || data.data?.id;
        setNewGodownForm({ godown_name: '', area: 'Factory Campus', godown_type: 'Normal', storage_location: 'Inside Factory' });
        setOpenGodownModal(false);
        await fetchGodowns();

        if (godownModalTarget === 'from' && newGodownId) {
          handleFromGodownChange(newGodownId, savedName);
        } else if (godownModalTarget === 'to' && newGodownId) {
          handleToGodownChange(newGodownId, savedName);
        }
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to create Godown Master' });
      }
    } catch (err) {
      console.error('Error creating godown:', err);
      setMessage({ type: 'error', text: 'Network error creating Godown Master' });
    } finally {
      setSavingGodown(false);
    }
  };

  // Fetch all transfer entries
  const fetchTransfers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/godown-transfers');
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.data || []);
      if (Array.isArray(list)) {
        setTransfers(list);
      }
    } catch (err) {
      console.error('Error fetching godown transfers:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper to check if a godown is cold storage
  const checkIsColdStorage = (godownObjOrName, godownId) => {
    if (godownId) {
      const g = godowns.find(x => String(x.id) === String(godownId));
      if (g) {
        const gName = (g.godown_name || '').toLowerCase();
        const gType = (g.godown_type || '').toLowerCase();
        const gLoc = (g.storage_location || '').toLowerCase();
        if (gName.includes('cold') || gType.includes('cold') || gLoc.includes('outside') || g.is_cold_storage === 1 || String(g.id) === '2') {
          return true;
        }
      }
      if (String(godownId) === '2') return true;
    }
    if (!godownObjOrName) return false;
    if (typeof godownObjOrName === 'object') {
      const gName = (godownObjOrName.godown_name || '').toLowerCase();
      const gType = (godownObjOrName.godown_type || '').toLowerCase();
      const gLoc = (godownObjOrName.storage_location || '').toLowerCase();
      return gName.includes('cold') || gType.includes('cold') || gLoc.includes('outside') || godownObjOrName.is_cold_storage === 1 || String(godownObjOrName.id) === '2';
    }
    const nameStr = String(godownObjOrName).toLowerCase();
    const g = godowns.find(x => (x.godown_name || '').toLowerCase() === nameStr);
    if (g) {
      const gType = (g.godown_type || '').toLowerCase();
      const gLoc = (g.storage_location || '').toLowerCase();
      return nameStr.includes('cold') || gType.includes('cold') || gLoc.includes('outside') || g.is_cold_storage === 1 || String(g.id) === '2';
    }
    return nameStr.includes('cold') || nameStr.includes('storage') || String(godownObjOrName) === '2';
  };

  // Update existing transfer record
  const handleUpdateTransfer = async (e) => {
    if (e) e.preventDefault();
    if (!editingTransfer || updating) return;
    setUpdating(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await fetch(`/api/godown-transfers/${editingTransfer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTransfer)
      });
      const data = await res.json();
      if (res.ok && (data.success || data.message)) {
        setMessage({ type: 'success', text: 'Transfer details updated successfully!' });
        setEditingTransfer(null);
        fetchTransfers();
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to update transfer' });
      }
    } catch (err) {
      console.error('Error updating transfer:', err);
      setMessage({ type: 'error', text: 'Network error updating transfer' });
    } finally {
      setUpdating(false);
    }
  };

  // Fetch tariff rate if selecting cold storage
  const fetchColdStorageTariff = async (godownId) => {
    if (!godownId) {
      setCsSourceTariff(null);
      return;
    }
    try {
      const res = await fetch(`/api/cold-storage/tariff/${godownId}`);
      const data = await res.json();
      if (data && data.success && data.tariff) {
        const t = data.tariff;
        setCsSourceTariff(t);
        const defaultRate = t.storageSlabs?.[0]?.rate || 0.20;
        const defaultHandling = t.outwardLoadingRate || t.inwardUnloadingRate || 0.50;
        setFormData(prev => {
          const currentWt = parseFloat(prev.weight || 0);
          const calculatedHandling = currentWt > 0 ? (currentWt * defaultHandling).toFixed(2) : String((defaultHandling * 50).toFixed(2));
          return {
            ...prev,
            storage_rate: prev.storage_rate || String(defaultRate),
            handling_amount: prev.handling_amount || calculatedHandling
          };
        });
      }
    } catch (_) {}
  };

  // Handle From Godown Change
  const handleFromGodownChange = async (godownId, explicitName) => {
    const selectedG = godowns.find(g => String(g.id) === String(godownId));
    const gName = explicitName || (selectedG ? selectedG.godown_name : '');

    setFormData(prev => ({
      ...prev,
      from_godown_id: godownId,
      from_godown_name: gName || prev.from_godown_name,
      item_name: '',
      lot_no: '',
      qty: '',
      weight: ''
    }));

    setSelectedItemDetails(null);

    const isCold = checkIsColdStorage(selectedG || gName, godownId);
    if (isCold) {
      fetchColdStorageTariff(godownId);
    } else {
      setCsSourceTariff(null);
    }

    if (!godownId) {
      setGodownItems([]);
      return;
    }

    setLoadingItems(true);
    try {
      const res = await fetch(`/api/godown-transfers/godown-items/${godownId}`);
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

  // Handle To Godown Select
  const handleToGodownChange = (godownId, explicitName) => {
    const selectedG = godowns.find(g => String(g.id) === String(godownId));
    const gName = explicitName || (selectedG ? selectedG.godown_name : '');
    setFormData(prev => ({
      ...prev,
      to_godown_id: godownId,
      to_godown_name: gName || prev.to_godown_name
    }));

    if (!formData.from_godown_id && checkIsColdStorage(selectedG || gName, godownId)) {
      fetchColdStorageTariff(godownId);
    }
  };

  // Handle Item Select
  const handleItemChange = (e) => {
    const val = e.target.value;
    if (!val) {
      setFormData(prev => ({ ...prev, item_name: '', lot_no: '', qty: '', weight: '', loadman_charges: '' }));
      setSelectedItemDetails(null);
      return;
    }

    const [iName, lNo] = val.split('||');
    const matched = godownItems.find(i => i.item_name === iName && i.lot_no === lNo);

    if (matched) {
      setSelectedItemDetails(matched);
      const q = matched.balance_qty || 1;
      const unitWt = matched.unit_weight || 50;
      const wt = (q * unitWt) || 50;
      const outHandlingRate = csSourceTariff?.outwardLoadingRate || 0.50;
      const autoHandling = csSourceTariff ? (wt * outHandlingRate).toFixed(2) : '';
      const autoLabour = (q * (parseFloat(formData.loadman_rate_per_qty) || 0)).toFixed(2);

      setFormData(prev => ({
        ...prev,
        item_name: matched.item_name,
        lot_no: matched.lot_no || 'LOT-GENERAL',
        qty: q,
        weight: wt,
        loadman_charges: autoLabour,
        storage_rate: prev.storage_rate || String(csSourceTariff?.storageSlabs?.[0]?.rate || 0.20),
        handling_amount: autoHandling || autoLabour || prev.handling_amount
      }));
    } else {
      setFormData(prev => ({ ...prev, item_name: val }));
    }
  };

  // Auto Recalculate Labour Charges on Qty or Rate change
  const handleQtyChange = (e) => {
    const nextQty = e.target.value;
    const unitWeight = Number(selectedItemDetails?.unit_weight) || 50;
    const nextWeight = nextQty === '' ? '' : String(Number(nextQty) * unitWeight);
    const rate = parseFloat(formData.loadman_rate_per_qty) || 0;
    const calculatedLabour = nextQty === '' ? '' : String((Number(nextQty) * rate).toFixed(2));
    const outRate = csSourceTariff?.outwardLoadingRate || 0.50;
    const autoHandling = csSourceTariff && nextWeight !== '' ? String((Number(nextWeight) * outRate).toFixed(2)) : calculatedLabour;

    setFormData(prev => ({
      ...prev,
      qty: nextQty,
      weight: nextWeight,
      loadman_charges: calculatedLabour,
      handling_amount: autoHandling || calculatedLabour
    }));
  };

  const handleRatePerQtyChange = (e) => {
    const nextRate = e.target.value;
    const q = parseFloat(formData.qty) || 0;
    const calculatedLabour = q > 0 ? String((q * (parseFloat(nextRate) || 0)).toFixed(2)) : formData.loadman_charges;

    setFormData(prev => ({
      ...prev,
      loadman_rate_per_qty: nextRate,
      loadman_charges: calculatedLabour,
      handling_amount: calculatedLabour || prev.handling_amount
    }));
  };

  // Add Custom Movement Method
  const handleSaveCustomMovementMethod = () => {
    const trimmed = customMovementMethod.trim();
    if (trimmed && !savedMovementMethods.includes(trimmed)) {
      setSavedMovementMethods(prev => [...prev, trimmed]);
      setFormData(prev => ({ ...prev, movement_method: trimmed }));
      setCustomMovementMethod('');
      setMovementMethodManual(false);
      setMessage({ type: 'success', text: `Movement Method "${trimmed}" added to master list!` });
    }
  };

  // Handle Submit Form
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setMessage({ type: '', text: '' });

    const finalFromId = fromGodownManual ? (customFromGodown || 'custom_from') : formData.from_godown_id;
    const finalFromName = fromGodownManual ? customFromGodown : formData.from_godown_name;
    const finalToId = toGodownManual ? (customToGodown || 'custom_to') : formData.to_godown_id;
    const finalToName = toGodownManual ? customToGodown : formData.to_godown_name;
    const finalMethod = movementMethodManual ? (customMovementMethod || formData.movement_method) : formData.movement_method;

    if (!finalFromId || !finalFromName) {
      setMessage({ type: 'error', text: 'Please specify Source Godown' });
      return;
    }

    if (!finalToId || !finalToName) {
      setMessage({ type: 'error', text: 'Please specify Destination Godown' });
      return;
    }

    if (finalFromId === finalToId || (finalFromName && finalFromName.trim().toLowerCase() === finalToName.trim().toLowerCase())) {
      setMessage({ type: 'error', text: 'From Godown and To Godown cannot be the same' });
      return;
    }

    if (!formData.item_name) {
      setMessage({ type: 'error', text: 'Please select an item to transfer' });
      return;
    }

    if (!formData.qty || parseFloat(formData.qty) <= 0) {
      setMessage({ type: 'error', text: 'Please enter a valid transfer quantity' });
      return;
    }

    const payload = {
      ...formData,
      movement_method: finalMethod,
      from_godown_id: finalFromId,
      from_godown_name: finalFromName,
      to_godown_id: finalToId,
      to_godown_name: finalToName
    };

    setSubmitting(true);
    try {
      const res = await fetch('/api/godown-transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        const isCsSource = checkIsColdStorage(finalFromName, finalFromId);
        const billNo = data.linked_bill?.bill_no || (data.linked_voucher?.voucher_no ? `CSB-${data.linked_voucher.voucher_no}` : '');

        setMessage({
          type: data.warning ? 'error' : 'success',
          text: isCsSource && billNo
            ? `Godown transfer recorded successfully! Cold Storage Outward Bill #${billNo} was automatically generated.`
            : (data.message || 'Godown transfer recorded successfully!')
        });

        const createdTransferId = data.transfer_id;

        // Auto-open Cold Storage Bill Modal for instant review & print if source was Cold Storage
        if (isCsSource && createdTransferId) {
          setSelectedTransferRow({
            id: createdTransferId,
            s_no: formData.s_no,
            from_godown_id: finalFromId,
            from_godown_name: finalFromName,
            to_godown_id: finalToId,
            to_godown_name: finalToName,
            item_name: formData.item_name,
            lot_no: formData.lot_no,
            qty: formData.qty,
            weight: formData.weight,
            handling_amount: formData.handling_amount,
            storage_rate: formData.storage_rate,
            transfer_date: formData.transfer_date
          });
          setOpenBillModal(true);
        }

        setFormData({
          s_no: '',
          transfer_date: new Date().toISOString().split('T')[0],
          from_godown_id: '',
          from_godown_name: '',
          to_godown_id: '',
          to_godown_name: '',
          item_name: '',
          lot_no: '',
          qty: '',
          weight: '',
          transfer_mode: 'INTERNAL_UNIT',
          worker_team: '',
          movement_method: 'Hand Trolley',
          supervisor_name: '',
          vehicle_no: '',
          driver_name: '',
          driver_phone: '',
          transporter_name: '',
          loadman_name: '',
          loadman_rate_per_qty: '10',
          loadman_charges: '',
          handling_amount: '',
          storage_rate: '',
          insurance_charges: '',
          remarks: ''
        });
        setCustomFromGodown('');
        setCustomToGodown('');
        setFromGodownManual(false);
        setToGodownManual(false);
        setMovementMethodManual(false);
        setCustomMovementMethod('');
        fetchNextSNo();
        setGodownItems([]);
        setSelectedItemDetails(null);
        fetchTransfers();
        if (!isCsSource) {
          setActiveTab('display');
        }
      } else {
        setMessage({ type: 'error', text: data.message || 'Error recording transfer' });
      }
    } catch (err) {
      console.error('Error submitting godown transfer:', err);
      setMessage({ type: 'error', text: 'Network error recording transfer' });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Transfer
  const handleDelete = async (id) => {
    const confirmed = window.__appConfirm ? await window.__appConfirm({
      title: 'Confirm Transfer Deletion',
      message: 'Are you sure you want to delete this transfer entry?',
      confirmText: 'Delete Transfer',
      confirmColor: 'error'
    }) : window.confirm('Are you sure you want to delete this transfer entry?');
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/godown-transfers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Transfer entry deleted successfully' });
        fetchTransfers();
      }
    } catch (err) {
      console.error('Error deleting transfer:', err);
    }
  };

  // Open Cold Storage Bill Modal
  const handleOpenBill = (row) => {
    setSelectedTransferRow(row);
    setOpenBillModal(true);
  };

  // Single Voucher Print Helper
  const handlePrintSingleVoucher = (t) => {
    const isInternal = t.transfer_mode === 'INTERNAL_UNIT' || (!t.vehicle_no && !t.driver_name);
    const unitWt = t.weight && t.qty ? (t.weight / t.qty).toFixed(1) : '50.0';
    const totalTons = t.weight ? (t.weight / 1000).toFixed(3) : '0.000';
    const labourAmt = Number(t.handling_amount || t.loadman_charges || 0).toFixed(2);

    const content = `
      <div style="font-family: Arial, sans-serif; padding: 30px; max-width: 800px; margin: 0 auto; color: #0f172a; border: 2px solid #1e3a8a; border-radius: 8px;">
        <div style="text-align: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 20px;">
          <h1 style="margin: 0; color: #1e3a8a; font-size: 24px; text-transform: uppercase; letter-spacing: 1px;">BVC EXPORTS PRIVATE LIMITED</h1>
          <p style="margin: 4px 0 0 0; color: #475569; font-size: 13px; font-weight: bold;">FACTORY STOCK TRANSFER & MOVEMENT VOUCHER</p>
        </div>

        <table style="width: 100%; margin-bottom: 20px; font-size: 13px; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px; width: 50%;"><strong>Voucher S.No:</strong> <span style="font-family: monospace; font-size: 15px; color: #2563eb; font-weight: bold;">${t.s_no}</span></td>
            <td style="padding: 6px; width: 50%; text-align: right;"><strong>Transfer Date:</strong> ${t.transfer_date}</td>
          </tr>
          <tr>
            <td style="padding: 6px;"><strong>Movement Mode:</strong> ${isInternal ? '🏢 Internal Factory Unit Movement' : '🚚 External Vehicle Transport'}</td>
            <td style="padding: 6px; text-align: right;"><strong>Status:</strong> <span style="color: #15803d; font-weight: bold;">COMPLETED</span></td>
          </tr>
        </table>

        <div style="display: flex; justify-content: space-between; gap: 20px; margin-bottom: 20px;">
          <div style="flex: 1; background-color: #eff6ff; padding: 12px; border-radius: 6px; border: 1px solid #bfdbfe;">
            <div style="font-size: 11px; text-transform: uppercase; color: #1e40af; font-weight: bold; margin-bottom: 4px;">SOURCE GODOWN / UNIT</div>
            <div style="font-size: 16px; font-weight: bold; color: #1e3a8a;">${t.from_godown_name}</div>
          </div>
          <div style="flex: 1; background-color: #f0fdf4; padding: 12px; border-radius: 6px; border: 1px solid #bbf7d0;">
            <div style="font-size: 11px; text-transform: uppercase; color: #166534; font-weight: bold; margin-bottom: 4px;">DESTINATION GODOWN / UNIT</div>
            <div style="font-size: 16px; font-weight: bold; color: #15803d;">${t.to_godown_name}</div>
          </div>
        </div>

        <h3 style="font-size: 14px; text-transform: uppercase; color: #334155; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; margin-bottom: 10px;">Item & Stock Particulars</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
          <thead>
            <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
              <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: left;">Item Name</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: left;">Lot / Batch No</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">Qty (Bags)</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">Packing Wt</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">Total Weight</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">${t.item_name}</td>
              <td style="padding: 8px; border: 1px solid #e2e8f0; font-family: monospace;">${t.lot_no || '-'}</td>
              <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #2563eb;">${t.qty} Bags</td>
              <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right;">${unitWt} Kg / bag</td>
              <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${t.weight || 0} Kg (${totalTons} MT)</td>
            </tr>
          </tbody>
        </table>

        <h3 style="font-size: 14px; text-transform: uppercase; color: #334155; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; margin-bottom: 10px;">Movement & Handling Particulars</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
          ${isInternal ? `
            <tr>
              <td style="padding: 6px; border: 1px solid #e2e8f0;"><strong>Worker Team / Handlers:</strong> ${t.worker_team || 'Factory Shift Team'}</td>
              <td style="padding: 6px; border: 1px solid #e2e8f0;"><strong>Internal Movement Method:</strong> ${t.movement_method || 'Hand Trolley'}</td>
            </tr>
            <tr>
              <td style="padding: 6px; border: 1px solid #e2e8f0;"><strong>Shift Supervisor:</strong> ${t.supervisor_name || '-'}</td>
              <td style="padding: 6px; border: 1px solid #e2e8f0;"><strong>Loadman Labour Rate:</strong> ₹${t.loadman_rate_per_qty || 0} / bag</td>
            </tr>
          ` : `
            <tr>
              <td style="padding: 6px; border: 1px solid #e2e8f0;"><strong>Vehicle / Lorry No:</strong> ${t.vehicle_no || '-'}</td>
              <td style="padding: 6px; border: 1px solid #e2e8f0;"><strong>Driver Name:</strong> ${t.driver_name || '-'} (${t.driver_phone || 'N/A'})</td>
            </tr>
            <tr>
              <td style="padding: 6px; border: 1px solid #e2e8f0;"><strong>Transporter Agency:</strong> ${t.transporter_name || '-'}</td>
              <td style="padding: 6px; border: 1px solid #e2e8f0;"><strong>Loadman Team:</strong> ${t.loadman_name || t.worker_team || '-'}</td>
            </tr>
          `}
          <tr>
            <td style="padding: 6px; border: 1px solid #e2e8f0;"><strong>Total Labour Charges:</strong> ₹${labourAmt}</td>
            <td style="padding: 6px; border: 1px solid #e2e8f0;"><strong>Transfer Remarks:</strong> ${t.remarks || 'Internal Movement'}</td>
          </tr>
        </table>

        <div style="margin-top: 50px; display: flex; justify-content: space-between; text-align: center; font-size: 12px; font-weight: bold; color: #475569;">
          <div style="width: 30%; border-top: 1.5px dashed #64748b; padding-top: 6px;">Prepared / Dispatch Sup.</div>
          <div style="width: 30%; border-top: 1.5px dashed #64748b; padding-top: 6px;">Transport / Loadman Incharge</div>
          <div style="width: 30%; border-top: 1.5px dashed #64748b; padding-top: 6px;">Receiving Godown Incharge</div>
        </div>
      </div>
    `;

    printHtml(content, `Stock_Transfer_Voucher_${t.s_no}`);
  };

  // Export CSV
  const handleExportCSV = () => {
    let csv = 'S.No,Transfer Date,From Godown,To Godown,Item Name,Lot No,Quantity,Weight (Kg),Transfer Mode,Worker Team,Movement Method,Supervisor,Driver,Vehicle No,Handling Amount,Storage Rate,Remarks\n';
    transfers.forEach(t => {
      csv += `"${t.s_no}","${t.transfer_date}","${t.from_godown_name}","${t.to_godown_name}","${t.item_name}","${t.lot_no}",${t.qty},${t.weight},"${t.transfer_mode || 'INTERNAL_UNIT'}","${t.worker_team || ''}","${t.movement_method || ''}","${t.supervisor_name || ''}","${t.driver_name || ''}","${t.vehicle_no || ''}",${t.handling_amount || 0},${t.storage_rate || 0},"${t.remarks || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Godown_Transfers_${new Date().toISOString().substring(0, 10)}.csv`;
    link.click();
  };

  // Print Register List
  const handlePrint = () => {
    let printContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="text-align: center; color: #1e3a8a; margin-bottom: 5px;">Godown to Godown Transfer Register</h2>
        <p style="text-align: center; color: #64748b; font-size: 13px; margin-top: 0;">Generated on: ${new Date().toLocaleString()}</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px;">
          <thead>
            <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
              <th style="padding: 8px; border: 1px solid #cbd5e1;">S.No</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">Date</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">From Godown / Unit</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">To Godown / Unit</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">Item Name</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">Lot No</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">Qty</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">Weight (Kg)</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">Movement / Transport Info</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">Remarks</th>
            </tr>
          </thead>
          <tbody>
    `;

    transfers.forEach((t) => {
      const isInternal = t.transfer_mode === 'INTERNAL_UNIT' || (!t.vehicle_no && !t.driver_name);
      const movementInfo = isInternal
        ? `[Internal] Team: ${t.worker_team || 'Factory Workers'} (${t.movement_method || 'Manual'}) ${t.supervisor_name ? `• Sup: ${t.supervisor_name}` : ''}`
        : `[External] Driver: ${t.driver_name || '-'} (${t.vehicle_no || 'Lorry'})`;

      printContent += `
        <tr>
          <td style="padding: 6px; border: 1px solid #e2e8f0; text-align: center;">${t.s_no}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0;">${t.transfer_date}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0; font-weight: bold;">${t.from_godown_name}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0; font-weight: bold; color: #2563eb;">${t.to_godown_name}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0;">${t.item_name}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0;">${t.lot_no}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${t.qty}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0; text-align: right;">${t.weight}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0; font-size: 11px;">${movementInfo}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0;">${t.remarks || '-'}</td>
        </tr>
      `;
    });

    printContent += `
          </tbody>
        </table>
      </div>
    `;

    printHtml(printContent, 'Godown_Transfers_Report');
  };

  const filteredTransfers = transfers.filter(t => {
    const term = searchTerm.toLowerCase();
    return (
      (t.s_no || '').toLowerCase().includes(term) ||
      (t.from_godown_name || '').toLowerCase().includes(term) ||
      (t.to_godown_name || '').toLowerCase().includes(term) ||
      (t.item_name || '').toLowerCase().includes(term) ||
      (t.lot_no || '').toLowerCase().includes(term) ||
      (t.worker_team || '').toLowerCase().includes(term) ||
      (t.supervisor_name || '').toLowerCase().includes(term) ||
      (t.driver_name || '').toLowerCase().includes(term) ||
      (t.vehicle_no || '').toLowerCase().includes(term)
    );
  });

  const resolvedFromName = formData.from_godown_name || godowns.find(g => String(g.id) === String(formData.from_godown_id))?.godown_name || '';
  const sidebarFromGodown = fromGodownManual
    ? (customFromGodown || 'Custom Source')
    : (resolvedFromName ? (checkIsColdStorage(resolvedFromName, formData.from_godown_id) ? `❄️ ${resolvedFromName}` : `📍 ${resolvedFromName}`) : 'Not Selected');

  const resolvedToName = formData.to_godown_name || godowns.find(g => String(g.id) === String(formData.to_godown_id))?.godown_name || '';
  const sidebarToGodown = toGodownManual
    ? (customToGodown || 'Custom Destination')
    : (resolvedToName ? (checkIsColdStorage(resolvedToName, formData.to_godown_id) ? `❄️ ${resolvedToName}` : `🚚 ${resolvedToName}`) : 'Not Selected');

  const unitWeight = selectedItemDetails?.unit_weight || 50;
  const totalWeightKg = formData.weight ? parseFloat(formData.weight) : (formData.qty ? parseFloat(formData.qty) * unitWeight : 0);
  const totalWeightTons = (totalWeightKg / 1000).toFixed(2);

  return (
    <Container maxWidth={false} sx={{ py: 3, px: { xs: 2, sm: 3 }, bgcolor: '#f8fafc', minHeight: '100vh' }}>
      {/* Header Banner */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: 3, 
          mb: 3, 
          borderRadius: 3, 
          border: '1px solid #e2e8f0', 
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <Box sx={{ bgcolor: '#eff6ff', p: 2, borderRadius: 3, color: '#2563eb', display: 'flex', boxShadow: 'inset 0 2px 4px rgba(37,99,235,0.1)' }}>
              <TransferIcon sx={{ fontSize: 36 }} />
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>
                Godown Transfer & Internal Factory Unit Movement
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500, mt: 0.5 }}>
                Manage internal unit-to-unit transfers with factory worker teams as well as external vehicle transport & Cold Storage synchronization.
              </Typography>
            </Box>
          </Box>

          <Stack direction="row" spacing={1.5} flexWrap="wrap" gap={1}>
            <Button
              variant="contained"
              size="medium"
              startIcon={<WarehouseIcon />}
              onClick={() => {
                setGodownModalTarget('general');
                setOpenGodownModal(true);
              }}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800, bgcolor: '#1e293b', '&:hover': { bgcolor: '#0f172a' } }}
            >
              + Add Godown Master
            </Button>
            <Button
              variant="contained"
              size="medium"
              startIcon={<ColdStorageIcon />}
              onClick={() => navigate('/cold-storage/in')}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800, bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' } }}
            >
              Cold Storage IN
            </Button>
            <Button
              variant="contained"
              size="medium"
              startIcon={<ColdStorageIcon />}
              onClick={() => navigate('/cold-storage/out')}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800, bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' } }}
            >
              Cold Storage OUT
            </Button>
            <Button
              variant="outlined"
              size="medium"
              startIcon={<RefreshIcon className={loading ? 'animate-spin' : ''} />}
              onClick={() => { fetchGodowns(); fetchTransfers(); }}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, borderColor: '#cbd5e1', color: '#334155', bgcolor: '#ffffff' }}
            >
              Refresh
            </Button>
            <Button
              variant="outlined"
              color="success"
              size="medium"
              startIcon={<ExportIcon />}
              onClick={handleExportCSV}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#ffffff' }}
            >
              Export CSV
            </Button>
            <Button
              variant="contained"
              size="medium"
              startIcon={<PrintIcon />}
              onClick={handlePrint}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800, bgcolor: '#1e3a8a', '&:hover': { bgcolor: '#1d4ed8' }, boxShadow: '0 4px 6px -1px rgba(30,58,138,0.2)' }}
            >
              Print Register
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Message Toast */}
      {message.text && (
        <Alert severity={message.type === 'error' ? 'error' : 'success'} sx={{ mb: 3, borderRadius: 2.5, fontWeight: 600 }} onClose={() => setMessage({ type: '', text: '' })}>
          {message.text}
        </Alert>
      )}

      {/* Navigation Tabs */}
      <Paper elevation={0} sx={{ p: 1, mb: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff', display: 'inline-flex', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}>
        <Tabs
          value={activeTab}
          onChange={(e, val) => setActiveTab(val)}
          sx={{
            minHeight: 44,
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 800, fontSize: '14px', borderRadius: 2, minHeight: 40, px: 3, transition: 'all 0.2s' },
            '& .Mui-selected': { bgcolor: '#eff6ff', color: '#1d4ed8 !important' },
            '& .MuiTabs-indicator': { display: 'none' }
          }}
        >
          <Tab value="create" label="New Transfer Entry" icon={<AddIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
          <Tab value="display" label={`Transfer Register (${transfers.length})`} icon={<TransferIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* ================= TAB 1: CREATE GODOWN TRANSFER ================= */}
      {activeTab === 'create' && (
        <Grid container spacing={3}>
          {/* Main Form Section */}
          <Grid item xs={12} lg={8}>
            <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)' }}>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={3} pb={2} borderBottom="2px solid #f1f5f9">
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <AddIcon sx={{ color: '#2563eb' }} />
                  Create Stock Transfer Voucher
                </Typography>
                <Chip label={`Voucher S.No: ${formData.s_no}`} color="primary" variant="outlined" sx={{ fontWeight: 800, fontFamily: 'monospace', borderRadius: 1.5 }} />
              </Box>

              <form onSubmit={handleSubmit}>
                <Stack spacing={3.5}>
                  {/* SECTION 1: Routing & Source / Destination Selection */}
                  <Box sx={{ p: 2.5, borderRadius: 2.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#334155', textTransform: 'uppercase', mb: 2, fontSize: '12px', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <GodownIcon sx={{ fontSize: 16, color: '#2563eb' }} />
                      1. Transfer Routing & Schedule
                    </Typography>
                    <Grid container spacing={2.5}>
                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Transfer S.No"
                          required
                          value={formData.s_no}
                          onChange={(e) => setFormData({ ...formData, s_no: e.target.value })}
                          InputProps={{ style: { fontFamily: 'monospace', fontWeight: 700, backgroundColor: '#ffffff' } }}
                        />
                      </Grid>

                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          type="date"
                          fullWidth
                          size="small"
                          label="Transfer Date"
                          required
                          value={formData.transfer_date}
                          onChange={(e) => setFormData({ ...formData, transfer_date: e.target.value })}
                          InputProps={{ style: { backgroundColor: '#ffffff' } }}
                        />
                      </Grid>

                      {/* From Godown / Unit Selection */}
                      <Grid item xs={12} sm={6} md={3}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                            From Godown (Source)
                          </Typography>
                          <Box display="flex" gap={1} alignItems="center">
                            <Typography
                              variant="caption"
                              onClick={() => setFromGodownManual(!fromGodownManual)}
                              sx={{ color: '#2563eb', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}
                            >
                              {fromGodownManual ? 'Select Dropdown' : 'Type Custom'}
                            </Typography>
                            <Typography
                              variant="caption"
                              onClick={() => {
                                setGodownModalTarget('from');
                                setOpenGodownModal(true);
                              }}
                              sx={{ color: '#059669', cursor: 'pointer', fontWeight: 800 }}
                            >
                              + Add Master
                            </Typography>
                          </Box>
                        </Box>

                        {fromGodownManual ? (
                          <TextField
                            fullWidth
                            size="small"
                            placeholder="Type Source Godown / Unit Name..."
                            value={customFromGodown}
                            onChange={(e) => {
                              setCustomFromGodown(e.target.value);
                              setFormData(prev => ({ ...prev, from_godown_name: e.target.value }));
                            }}
                            InputProps={{ style: { backgroundColor: '#ffffff', fontWeight: 600 } }}
                          />
                        ) : (
                          <TextField
                            select
                            fullWidth
                            size="small"
                            required={!fromGodownManual}
                            value={formData.from_godown_id}
                            onChange={(e) => handleFromGodownChange(e.target.value)}
                            InputProps={{ style: { backgroundColor: '#ffffff' } }}
                          >
                            <MenuItem value="">-- Select Source Godown --</MenuItem>
                            {godowns.map(g => (
                              <MenuItem key={g.id} value={g.id}>
                                {checkIsColdStorage(g, g.id) ? '❄️ ' : '📍 '} {g.godown_name} ({g.area || 'Factory'})
                              </MenuItem>
                            ))}
                          </TextField>
                        )}
                      </Grid>

                      {/* To Godown / Unit Selection */}
                      <Grid item xs={12} sm={6} md={3}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                            To Godown (Destination)
                          </Typography>
                          <Box display="flex" gap={1} alignItems="center">
                            <Typography
                              variant="caption"
                              onClick={() => setToGodownManual(!toGodownManual)}
                              sx={{ color: '#2563eb', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}
                            >
                              {toGodownManual ? 'Select Dropdown' : 'Type Custom'}
                            </Typography>
                            <Typography
                              variant="caption"
                              onClick={() => {
                                setGodownModalTarget('to');
                                setOpenGodownModal(true);
                              }}
                              sx={{ color: '#059669', cursor: 'pointer', fontWeight: 800 }}
                            >
                              + Add Master
                            </Typography>
                          </Box>
                        </Box>

                        {toGodownManual ? (
                          <TextField
                            fullWidth
                            size="small"
                            placeholder="Type Destination Godown / Unit..."
                            value={customToGodown}
                            onChange={(e) => {
                              setCustomToGodown(e.target.value);
                              setFormData(prev => ({ ...prev, to_godown_name: e.target.value }));
                            }}
                            InputProps={{ style: { backgroundColor: '#ffffff', fontWeight: 600 } }}
                          />
                        ) : (
                          <TextField
                            select
                            fullWidth
                            size="small"
                            required={!toGodownManual}
                            value={formData.to_godown_id}
                            onChange={(e) => handleToGodownChange(e.target.value)}
                            InputProps={{ style: { backgroundColor: '#ffffff' } }}
                          >
                            <MenuItem value="">-- Select Destination Godown --</MenuItem>
                            {godowns
                              .filter(g => String(g.id) !== String(formData.from_godown_id))
                              .map(g => (
                                <MenuItem key={g.id} value={g.id}>
                                  {checkIsColdStorage(g, g.id) ? '❄️ ' : '🚚 '} {g.godown_name} ({g.area || 'Storage'})
                                </MenuItem>
                              ))
                            }
                          </TextField>
                        )}
                      </Grid>
                    </Grid>
                  </Box>

                  {/* COLD STORAGE SOURCE AUTO-CONFIGURATION BANNER */}
                  {checkIsColdStorage(formData.from_godown_name, formData.from_godown_id) && (
                    <Card elevation={0} sx={{ p: 2.5, bgcolor: '#eff6ff', borderRadius: 2.5, border: '1.5px solid #93c5fd' }}>
                      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} mb={1.5}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <ColdStorageIcon sx={{ color: '#0284c7', fontSize: 24 }} />
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0369a1', fontSize: '13px' }}>
                              ❄️ Source Godown is Cold Storage: Auto-Configuration & Bill Active
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#0284c7' }}>
                              Outward charges, storage slabs, and linked Cold Storage Bill will be automatically generated upon submission.
                            </Typography>
                          </Box>
                        </Box>
                        <Chip
                          label={`Tariff Slabs • Outward Handling: ₹${csSourceTariff?.outwardLoadingRate || 0.50}/kg`}
                          size="small"
                          color="info"
                          sx={{ fontWeight: 800 }}
                        />
                      </Box>
                    </Card>
                  )}

                  {/* SECTION 2: Item Selection */}
                  <Box sx={{ p: 2.5, borderRadius: 2.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#334155', textTransform: 'uppercase', mb: 2, fontSize: '12px', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ItemIcon sx={{ fontSize: 16, color: '#0284c7' }} />
                      2. Item Stock & Lot Selection
                    </Typography>
                    <Grid container spacing={2.5}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          select
                          fullWidth
                          size="small"
                          label={`Select Item & Lot from ${formData.from_godown_name || 'Source Godown'} ${loadingItems ? '(Loading...)' : ''}`}
                          required
                          value={formData.item_name && formData.lot_no ? `${formData.item_name}||${formData.lot_no}` : ''}
                          onChange={handleItemChange}
                          disabled={(!formData.from_godown_id && !fromGodownManual) || loadingItems}
                          InputProps={{ style: { backgroundColor: '#ffffff' } }}
                        >
                          <MenuItem value="">
                            {!formData.from_godown_id && !fromGodownManual
                              ? '⚠️ Please select Source Godown first' 
                              : godownItems.length === 0 
                                ? 'No stock available in this godown' 
                                : '-- Select Item to Transfer --'}
                          </MenuItem>
                          {godownItems.map(item => (
                            <MenuItem key={`${item.item_name}||${item.lot_no}`} value={`${item.item_name}||${item.lot_no}`}>
                              📦 {item.item_name} | Lot: {item.lot_no} | Avail Qty: {item.balance_qty} | Wt: {item.total_weight} Kg
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>

                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Lot / Batch No"
                          value={formData.lot_no}
                          onChange={(e) => setFormData({ ...formData, lot_no: e.target.value })}
                          InputProps={{ style: { fontFamily: 'monospace', fontWeight: 700, backgroundColor: '#ffffff' } }}
                        />
                      </Grid>

                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          type="number"
                          fullWidth
                          size="small"
                          label="Transfer Quantity (Bags)"
                          required
                          value={formData.qty}
                          onChange={handleQtyChange}
                          InputProps={{ style: { fontWeight: 800, color: '#1d4ed8', backgroundColor: '#ffffff' } }}
                        />
                      </Grid>
                    </Grid>
                  </Box>

                  {/* SECTION 3: Transfer Mode & Movement Details */}
                  <Box sx={{ p: 2.5, borderRadius: 2.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#334155', textTransform: 'uppercase', mb: 2, fontSize: '12px', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <WorkerIcon sx={{ fontSize: 16, color: '#2563eb' }} />
                      3. Transfer Movement Mode & Worker / Vehicle Particulars
                    </Typography>

                    {/* Movement Mode Selector */}
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                      <Grid item xs={12} sm={6}>
                        <Paper
                          onClick={() => setFormData({ ...formData, transfer_mode: 'INTERNAL_UNIT' })}
                          elevation={0}
                          sx={{
                            p: 2,
                            borderRadius: 2.5,
                            border: `2px solid ${formData.transfer_mode === 'INTERNAL_UNIT' ? '#2563eb' : '#cbd5e1'}`,
                            bgcolor: formData.transfer_mode === 'INTERNAL_UNIT' ? '#eff6ff' : '#ffffff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            transition: 'all 0.2s'
                          }}
                        >
                          <WorkerIcon sx={{ fontSize: 32, color: formData.transfer_mode === 'INTERNAL_UNIT' ? '#2563eb' : '#64748b' }} />
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: formData.transfer_mode === 'INTERNAL_UNIT' ? '#1e3a8a' : '#334155' }}>
                              Internal Factory Unit Movement
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                              Inside factory transfers via shift workers, hand trolleys, forklifts or conveyor.
                            </Typography>
                          </Box>
                        </Paper>
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <Paper
                          onClick={() => setFormData({ ...formData, transfer_mode: 'EXTERNAL_VEHICLE' })}
                          elevation={0}
                          sx={{
                            p: 2,
                            borderRadius: 2.5,
                            border: `2px solid ${formData.transfer_mode === 'EXTERNAL_VEHICLE' ? '#2563eb' : '#cbd5e1'}`,
                            bgcolor: formData.transfer_mode === 'EXTERNAL_VEHICLE' ? '#eff6ff' : '#ffffff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            transition: 'all 0.2s'
                          }}
                        >
                          <TruckIcon sx={{ fontSize: 32, color: formData.transfer_mode === 'EXTERNAL_VEHICLE' ? '#2563eb' : '#64748b' }} />
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: formData.transfer_mode === 'EXTERNAL_VEHICLE' ? '#1e3a8a' : '#334155' }}>
                              External Vehicle Transport
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                              Inter-godown or cold storage lorry transport with driver & vehicle details.
                            </Typography>
                          </Box>
                        </Paper>
                      </Grid>
                    </Grid>

                    {/* Mode Specific Fields */}
                    {formData.transfer_mode === 'INTERNAL_UNIT' ? (
                      <Grid container spacing={2.5}>
                        <Grid item xs={12} sm={6} md={4}>
                          <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                              Worker Team / Loadman
                            </Typography>
                            <Box display="flex" gap={1} alignItems="center">
                              <Typography
                                variant="caption"
                                onClick={() => setWorkerManual(!workerManual)}
                                sx={{ color: '#2563eb', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}
                              >
                                {workerManual ? 'Select Master' : 'Type Custom'}
                              </Typography>
                              <Typography
                                variant="caption"
                                onClick={() => setOpenWorkerModal(true)}
                                sx={{ color: '#059669', cursor: 'pointer', fontWeight: 800 }}
                              >
                                + Add Master
                              </Typography>
                            </Box>
                          </Box>

                          {workerManual ? (
                            <TextField
                              fullWidth
                              size="small"
                              placeholder="e.g. Shift A Handlers / Unit 1 Team"
                              value={formData.worker_team}
                              onChange={(e) => setFormData({ ...formData, worker_team: e.target.value, loadman_name: e.target.value })}
                              InputProps={{ style: { backgroundColor: '#ffffff', fontWeight: 600 } }}
                            />
                          ) : (
                            <TextField
                              select
                              fullWidth
                              size="small"
                              value={formData.worker_team}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '__ADD_NEW__') {
                                  setOpenWorkerModal(true);
                                } else {
                                  setFormData({ ...formData, worker_team: val, loadman_name: val });
                                }
                              }}
                              InputProps={{ style: { backgroundColor: '#ffffff', fontWeight: 600 } }}
                            >
                              <MenuItem value="">-- Select Worker / Loadman Team --</MenuItem>
                              <MenuItem value="__ADD_NEW__" sx={{ color: '#059669', fontWeight: 700 }}>
                                ➕ + Add Worker / Loadman Manually
                              </MenuItem>
                              {workersList.map(w => (
                                <MenuItem key={w.id || w.name} value={w.name}>
                                  👷 {w.name} {w.category ? `(${w.category})` : ''} {w.phone ? `• ${w.phone}` : ''}
                                </MenuItem>
                              ))}
                            </TextField>
                          )}
                        </Grid>

                        {/* Internal Movement Method Dropdown with + Add Manual Entry Option */}
                        <Grid item xs={12} sm={6} md={4}>
                          <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                              Movement Method
                            </Typography>
                            <Typography
                              variant="caption"
                              onClick={() => setMovementMethodManual(!movementMethodManual)}
                              sx={{ color: '#2563eb', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}
                            >
                              {movementMethodManual ? 'Select Master' : '+ Add Custom'}
                            </Typography>
                          </Box>

                          {movementMethodManual ? (
                            <Box display="flex" gap={1}>
                              <TextField
                                fullWidth
                                size="small"
                                placeholder="Enter custom method..."
                                value={customMovementMethod}
                                onChange={(e) => setCustomMovementMethod(e.target.value)}
                                InputProps={{ style: { backgroundColor: '#ffffff', fontWeight: 600 } }}
                              />
                              <Button
                                variant="contained"
                                size="small"
                                onClick={handleSaveCustomMovementMethod}
                                sx={{ bgcolor: '#1e3a8a', textTransform: 'none', px: 2, fontWeight: 700 }}
                              >
                                Save
                              </Button>
                            </Box>
                          ) : (
                            <TextField
                              select
                              fullWidth
                              size="small"
                              value={formData.movement_method}
                              onChange={(e) => setFormData({ ...formData, movement_method: e.target.value })}
                              InputProps={{ style: { backgroundColor: '#ffffff', fontWeight: 600 } }}
                            >
                              {savedMovementMethods.map((m) => (
                                <MenuItem key={m} value={m}>
                                  🛠️ {m}
                                </MenuItem>
                              ))}
                            </TextField>
                          )}
                        </Grid>

                        <Grid item xs={12} sm={6} md={4}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Factory Supervisor Name"
                            placeholder="e.g. S. Murugan (Supervisor)"
                            value={formData.supervisor_name}
                            onChange={(e) => setFormData({ ...formData, supervisor_name: e.target.value })}
                            InputProps={{ style: { backgroundColor: '#ffffff' } }}
                          />
                        </Grid>

                        <Grid item xs={12} sm={6} md={4}>
                          <TextField
                            type="number"
                            fullWidth
                            size="small"
                            label="Loadman Rate per Bag / Qty (₹)"
                            value={formData.loadman_rate_per_qty}
                            onChange={handleRatePerQtyChange}
                            InputProps={{ style: { backgroundColor: '#ffffff', fontWeight: 700, color: '#2563eb' } }}
                          />
                        </Grid>

                        <Grid item xs={12} sm={6} md={4}>
                          <TextField
                            type="number"
                            fullWidth
                            size="small"
                            label="Total Labour Charges (₹)"
                            value={formData.loadman_charges}
                            onChange={(e) => setFormData({ ...formData, loadman_charges: e.target.value, handling_amount: e.target.value })}
                            InputProps={{ style: { backgroundColor: '#ffffff', fontWeight: 800, color: '#059669' } }}
                            helperText={formData.qty && formData.loadman_rate_per_qty ? `Auto Calc: ${formData.qty} bags × ₹${formData.loadman_rate_per_qty}` : ''}
                          />
                        </Grid>

                        <Grid item xs={12} sm={6} md={4}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Transfer Remarks / Notes"
                            placeholder="e.g. Internal shifting from processing bay to packing hall..."
                            value={formData.remarks}
                            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                            InputProps={{ style: { backgroundColor: '#ffffff' } }}
                          />
                        </Grid>
                      </Grid>
                    ) : (
                      <Grid container spacing={2.5}>
                        <Grid item xs={12} sm={6} md={3}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Vehicle / Lorry No"
                            placeholder="e.g. TN-38-BZ-1234"
                            value={formData.vehicle_no}
                            onChange={(e) => setFormData({ ...formData, vehicle_no: e.target.value })}
                            InputProps={{ style: { fontFamily: 'monospace', backgroundColor: '#ffffff' } }}
                          />
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Driver Name & Contact"
                            placeholder="Driver Name"
                            value={formData.driver_name}
                            onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
                            InputProps={{ style: { backgroundColor: '#ffffff' } }}
                          />
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Transporter / Agency"
                            placeholder="Transport Name"
                            value={formData.transporter_name}
                            onChange={(e) => setFormData({ ...formData, transporter_name: e.target.value })}
                            InputProps={{ style: { backgroundColor: '#ffffff' } }}
                          />
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                          <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                              Loadman / Worker Team
                            </Typography>
                            <Typography
                              variant="caption"
                              onClick={() => setOpenWorkerModal(true)}
                              sx={{ color: '#059669', cursor: 'pointer', fontWeight: 800 }}
                            >
                              + Add Master
                            </Typography>
                          </Box>
                          <TextField
                            select
                            fullWidth
                            size="small"
                            value={formData.loadman_name}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '__ADD_NEW__') {
                                setOpenWorkerModal(true);
                              } else {
                                setFormData({ ...formData, loadman_name: val, worker_team: val });
                              }
                            }}
                            InputProps={{ style: { backgroundColor: '#ffffff', fontWeight: 600 } }}
                          >
                            <MenuItem value="">-- Select Loadman Team --</MenuItem>
                            <MenuItem value="__ADD_NEW__" sx={{ color: '#059669', fontWeight: 700 }}>
                              ➕ + Add Loadman Manually
                            </MenuItem>
                            {workersList.map(w => (
                              <MenuItem key={w.id || w.name} value={w.name}>
                                👷 {w.name} {w.category ? `(${w.category})` : ''}
                              </MenuItem>
                            ))}
                          </TextField>
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                          <TextField
                            type="number"
                            fullWidth
                            size="small"
                            label="Loadman Rate per Qty (₹)"
                            value={formData.loadman_rate_per_qty}
                            onChange={handleRatePerQtyChange}
                            InputProps={{ style: { backgroundColor: '#ffffff', fontWeight: 700 } }}
                          />
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                          <TextField
                            type="number"
                            fullWidth
                            size="small"
                            label="Total Labour Charges (₹)"
                            value={formData.loadman_charges}
                            onChange={(e) => setFormData({ ...formData, loadman_charges: e.target.value, handling_amount: e.target.value })}
                            InputProps={{ style: { backgroundColor: '#ffffff', fontWeight: 800, color: '#059669' } }}
                          />
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                          <TextField
                            type="number"
                            fullWidth
                            size="small"
                            label="Handling Amount (₹)"
                            value={formData.handling_amount}
                            onChange={(e) => setFormData({ ...formData, handling_amount: e.target.value })}
                            InputProps={{ style: { fontWeight: 700, color: '#047857', backgroundColor: '#ffffff' } }}
                          />
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                          <TextField
                            type="number"
                            fullWidth
                            size="small"
                            label="Storage Rate (₹ / Kg / Day)"
                            value={formData.storage_rate}
                            onChange={(e) => setFormData({ ...formData, storage_rate: e.target.value })}
                            InputProps={{ style: { fontWeight: 700, color: '#1d4ed8', backgroundColor: '#ffffff' } }}
                          />
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                          <TextField
                            type="number"
                            fullWidth
                            size="small"
                            label="Insurance Charges (₹)"
                            value={formData.insurance_charges}
                            onChange={(e) => setFormData({ ...formData, insurance_charges: e.target.value })}
                            InputProps={{ style: { backgroundColor: '#ffffff' } }}
                          />
                        </Grid>

                        <Grid item xs={12} sm={6} md={9}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Transfer Remarks / Notes"
                            placeholder="e.g. External godown transport notes..."
                            value={formData.remarks}
                            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                            InputProps={{ style: { backgroundColor: '#ffffff' } }}
                          />
                        </Grid>
                      </Grid>
                    )}
                  </Box>

                  <Box pt={1} display="flex" justifyContent="flex-end">
                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      disabled={submitting}
                      startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <TransferIcon />}
                      sx={{ 
                        borderRadius: 2.5, 
                        px: 6, 
                        py: 1.5, 
                        fontWeight: 800, 
                        textTransform: 'none', 
                        bgcolor: '#2563eb', 
                        '&:hover': { bgcolor: '#1d4ed8' },
                        boxShadow: '0 4px 12px rgba(37,99,235,0.25)'
                      }}
                    >
                      {submitting ? 'Recording Transfer...' : 'Submit Godown Transfer'}
                    </Button>
                  </Box>
                </Stack>
              </form>
            </Paper>
          </Grid>

          {/* Right Live Summary Sidebar */}
          <Grid item xs={12} lg={4}>
            <Stack spacing={3}>
              <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AssessmentIcon sx={{ color: '#2563eb' }} />
                  Transfer Summary & Flow
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Stack spacing={2}>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Source Godown</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 800, color: '#1e3a8a' }}>
                      {sidebarFromGodown}
                    </Typography>
                  </Box>

                  <Box sx={{ textAlign: 'center', my: -1 }}>
                    <Chip label="➔ Transfer Path ➔" size="small" sx={{ fontWeight: 800, bgcolor: '#eff6ff', color: '#1d4ed8' }} />
                  </Box>

                  <Box>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Destination Godown</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 800, color: '#15803d' }}>
                      {sidebarToGodown}
                    </Typography>
                  </Box>

                  <Divider />

                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>Movement Mode:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: '#2563eb' }}>
                      {formData.transfer_mode === 'INTERNAL_UNIT' ? '🏢 Internal Unit Movement' : '🚚 External Transport'}
                    </Typography>
                  </Box>

                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>Selected Item:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a' }}>{formData.item_name || '-'}</Typography>
                  </Box>

                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>Lot / Batch No:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800, fontFamily: 'monospace', color: '#2563eb' }}>{formData.lot_no || '-'}</Typography>
                  </Box>

                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>Quantity (Bags):</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 900, color: '#0369a1' }}>{formData.qty ? `${formData.qty} Bags` : '0 Bags'}</Typography>
                  </Box>

                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>Packing Weight:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#475569' }}>{unitWeight} Kg / bag</Typography>
                  </Box>

                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>Total Estimated Weight:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 900, color: '#0f172a' }}>
                      {totalWeightKg ? `${totalWeightKg.toLocaleString()} Kg (${totalWeightTons} MT)` : '0 Kg'}
                    </Typography>
                  </Box>

                  {formData.transfer_mode === 'INTERNAL_UNIT' ? (
                    <>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>Movement Method:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 800, color: '#0284c7' }}>{formData.movement_method || '-'}</Typography>
                      </Box>

                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>Worker / Loadman Team:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 800, color: '#334155' }}>{formData.worker_team || '-'}</Typography>
                      </Box>

                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>Supervisor Name:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#475569' }}>{formData.supervisor_name || '-'}</Typography>
                      </Box>
                    </>
                  ) : (
                    <>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>Vehicle Lorry No:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 800, fontFamily: 'monospace', color: '#1e3a8a' }}>{formData.vehicle_no || '-'}</Typography>
                      </Box>

                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>Driver Name:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155' }}>{formData.driver_name || '-'}</Typography>
                      </Box>

                      {formData.transporter_name && (
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>Transporter / Agency:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155' }}>{formData.transporter_name}</Typography>
                        </Box>
                      )}

                      {formData.loadman_name && (
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>Loadman / Worker Team:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e3a8a' }}>{formData.loadman_name}</Typography>
                        </Box>
                      )}
                    </>
                  )}

                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>Loadman Rate per Bag:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: '#2563eb' }}>₹{formData.loadman_rate_per_qty || '0'}</Typography>
                  </Box>

                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>Total Labour Charges:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 900, color: '#047857' }}>₹{formData.loadman_charges || '0.00'}</Typography>
                  </Box>

                  {formData.handling_amount && (
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>Handling Charges:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#059669' }}>₹{formData.handling_amount}</Typography>
                    </Box>
                  )}

                  {formData.storage_rate && (
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>CS Storage Rate:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#0284c7' }}>₹{formData.storage_rate} / Kg / Day</Typography>
                    </Box>
                  )}

                  {formData.insurance_charges && (
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>Insurance Charges:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#d97706' }}>₹{formData.insurance_charges}</Typography>
                    </Box>
                  )}

                  {(Number(formData.loadman_charges || 0) > 0 || Number(formData.handling_amount || 0) > 0 || Number(formData.insurance_charges || 0) > 0) && (
                    <Box display="flex" justifyContent="space-between" pt={1} borderTop="1.5px solid #e2e8f0">
                      <Typography variant="subtitle2" sx={{ color: '#0f172a', fontWeight: 800 }}>Total Movement & CS Cost:</Typography>
                      <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#1e3a8a' }}>
                        ₹{(Number(formData.loadman_charges || 0) + Number(formData.handling_amount || 0) + Number(formData.insurance_charges || 0)).toFixed(2)}
                      </Typography>
                    </Box>
                  )}

                  {formData.remarks && (
                    <Box pt={1} borderTop="1px dashed #e2e8f0">
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700 }}>Remarks:</Typography>
                      <Typography variant="body2" sx={{ color: '#334155', fontStyle: 'italic', fontSize: '12px' }}>{formData.remarks}</Typography>
                    </Box>
                  )}
                </Stack>
              </Paper>
            </Stack>
          </Grid>
        </Grid>
      )}

      {/* ================= TAB 2: REGISTER & DISPLAY ================= */}
      {activeTab === 'display' && (
        <Stack spacing={3}>
          {/* KPI Summary Cards */}
          <Grid container spacing={3}>
            <Grid item xs={12} sm={4}>
              <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#ffffff' }}>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Transfers</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 900, color: '#0f172a', mt: 0.5 }}>{transfers.length}</Typography>
                </Box>
                <Box sx={{ p: 2, bgcolor: '#eff6ff', borderRadius: 2.5, color: '#2563eb' }}>
                  <TransferIcon sx={{ fontSize: 28 }} />
                </Box>
              </Paper>
            </Grid>

            <Grid item xs={12} sm={4}>
              <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#ffffff' }}>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Internal Unit Transfers</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 900, color: '#0284c7', mt: 0.5 }}>
                    {transfers.filter(t => t.transfer_mode === 'INTERNAL_UNIT' || (!t.vehicle_no && !t.driver_name)).length}
                  </Typography>
                </Box>
                <Box sx={{ p: 2, bgcolor: '#e0f2fe', borderRadius: 2.5, color: '#0284c7' }}>
                  <WorkerIcon sx={{ fontSize: 28 }} />
                </Box>
              </Paper>
            </Grid>

            <Grid item xs={12} sm={4}>
              <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#ffffff' }}>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Labour Charges</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 900, color: '#15803d', mt: 0.5 }}>
                    ₹{transfers.reduce((acc, t) => acc + Number(t.handling_amount || t.loadman_charges || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </Typography>
                </Box>
                <Box sx={{ p: 2, bgcolor: '#dcfce7', borderRadius: 2.5, color: '#15803d' }}>
                  <BillIcon sx={{ fontSize: 28 }} />
                </Box>
              </Paper>
            </Grid>
          </Grid>

          {/* Register Table Container */}
          <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', overflow: 'hidden', bgcolor: '#ffffff', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)' }}>
            <Box p={2.5} bgcolor="#f8fafc" borderBottom="1px solid #e2e8f0" display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1e293b' }}>
                Godown & Unit Transfer Register ({filteredTransfers.length})
              </Typography>
              
              <TextField
                size="small"
                placeholder="Search godown, worker team, driver, vehicle..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ color: '#94a3b8', mr: 1, fontSize: 18 }} />,
                  style: { borderRadius: 12, backgroundColor: '#ffffff', fontSize: '13px' }
                }}
                sx={{ width: 340 }}
              />
            </Box>

            <TableContainer sx={{ maxHeight: 600 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: '#f1f5f9', color: '#334155', fontWeight: 800, textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px' } }}>
                    <TableCell align="center" width="60">S.No</TableCell>
                    <TableCell>Transfer Date</TableCell>
                    <TableCell>From Godown / Unit</TableCell>
                    <TableCell>To Godown / Unit</TableCell>
                    <TableCell>Item Name</TableCell>
                    <TableCell>Lot No</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Weight (Kg)</TableCell>
                    <TableCell>Movement / Worker Details</TableCell>
                    <TableCell align="right">Labour Charges (₹)</TableCell>
                    <TableCell align="center">CS Bill</TableCell>
                    <TableCell align="center" width="160">Actions</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {filteredTransfers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} align="center" sx={{ py: 8, color: '#94a3b8', fontWeight: 600 }}>
                        No transfer entries found matching your search criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTransfers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((item) => {
                      const isCS = checkIsColdStorage(item.from_godown_name, item.from_godown_id) || checkIsColdStorage(item.to_godown_name, item.to_godown_id);
                      const isInternal = item.transfer_mode === 'INTERNAL_UNIT' || (!item.vehicle_no && !item.driver_name);

                      return (
                        <TableRow key={item.id} hover sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                          <TableCell align="center" sx={{ fontWeight: 800, fontFamily: 'monospace' }}>{item.s_no}</TableCell>
                          <TableCell sx={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>{item.transfer_date}</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: '#1e3a8a' }}>
                            {checkIsColdStorage(item.from_godown_name, item.from_godown_id) ? `❄️ ${item.from_godown_name}` : `📍 ${item.from_godown_name}`}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, color: '#15803d' }}>
                            {checkIsColdStorage(item.to_godown_name, item.to_godown_id) ? `❄️ ${item.to_godown_name}` : `🚚 ${item.to_godown_name}`}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 800, color: '#0f172a' }}>{item.item_name}</TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: '11px', color: '#2563eb', fontWeight: 700 }}>{item.lot_no}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 900, color: '#0369a1' }}>{item.qty}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: '#475569' }}>{item.weight}</TableCell>

                          <TableCell sx={{ fontSize: '11px', color: '#64748b' }}>
                            {isInternal ? (
                              <Box>
                                <Chip label="Internal Unit" size="small" color="secondary" variant="outlined" sx={{ height: 18, fontSize: '9px', fontWeight: 800, mb: 0.5 }} />
                                {item.worker_team ? <div style={{ fontWeight: 700, color: '#334155' }}>👥 {item.worker_team}</div> : null}
                                {item.movement_method ? <div style={{ color: '#0284c7' }}>📦 {item.movement_method}</div> : null}
                                {item.supervisor_name ? <div style={{ color: '#475569', fontSize: '10px' }}>👔 {item.supervisor_name}</div> : null}
                              </Box>
                            ) : (
                              <Box>
                                {item.driver_name ? <div style={{ fontWeight: 700, color: '#334155' }}>👤 {item.driver_name}</div> : null}
                                {item.vehicle_no ? <div style={{ fontFamily: 'monospace', color: '#2563eb' }}>🚚 {item.vehicle_no}</div> : null}
                              </Box>
                            )}
                          </TableCell>

                          <TableCell align="right" sx={{ fontWeight: 800, color: '#047857' }}>
                            ₹{Number(item.handling_amount || item.loadman_charges || 0).toFixed(2)}
                          </TableCell>

                          <TableCell align="center">
                            {isCS ? (
                              <Stack direction="row" spacing={0.5} justifyContent="center">
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => handleOpenBill(item)}
                                  startIcon={<ColdStorageIcon sx={{ fontSize: 14 }} />}
                                  sx={{ textTransform: 'none', fontWeight: 800, fontSize: '11px', borderRadius: 1.5, borderColor: '#38bdf8', color: '#0284c7', bgcolor: '#f0f9ff' }}
                                >
                                  CSO Bill
                                </Button>
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => {
                                    setSelectedCsroVoucher({
                                      voucher_no: `CSO-TRF-${item.s_no}`,
                                      voucher_date: item.transfer_date,
                                      cold_storage_name: item.from_godown_name,
                                      destination_godown_name: item.to_godown_name,
                                      vehicle_no: item.vehicle_no,
                                      driver_name: item.driver_name,
                                      driver_phone: item.driver_phone,
                                      transporter_name: item.transporter_name,
                                      loadman_name: item.worker_team || item.loadman_name,
                                      items: [
                                        {
                                          item_name: item.item_name,
                                          purchase_lot_no: item.lot_no,
                                          cold_storage_lot_no: `CS-${item.lot_no}`,
                                          quantity: item.qty,
                                          weight: item.weight ? item.weight / (item.qty || 1) : 50,
                                          total_wt: item.weight,
                                          unit: 'Units',
                                          inward_date: item.transfer_date,
                                          storage_basis: 'Per KG / Day',
                                          storage_rate: item.storage_rate || '0.20'
                                        }
                                      ]
                                    });
                                    setCsroModalOpen(true);
                                  }}
                                  startIcon={<ColdStorageIcon sx={{ fontSize: 14 }} />}
                                  sx={{ textTransform: 'none', fontWeight: 800, fontSize: '11px', borderRadius: 1.5, bgcolor: '#1e3a8a', '&:hover': { bgcolor: '#1d4ed8' } }}
                                >
                                  Print CSRO
                                </Button>
                              </Stack>
                            ) : (
                              <span style={{ color: '#cbd5e1' }}>-</span>
                            )}
                          </TableCell>

                          {/* ACTION BUTTONS: View, Print, Edit, Delete */}
                          <TableCell align="center">
                            <Stack direction="row" spacing={0.5} justifyContent="center">
                              <Tooltip title="View Transfer Particulars">
                                <IconButton size="small" color="info" onClick={() => setViewingTransfer(item)} sx={{ bgcolor: '#e0f2fe' }}>
                                  <ViewIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Print Transfer Voucher">
                                <IconButton size="small" color="secondary" onClick={() => handlePrintSingleVoucher(item)} sx={{ bgcolor: '#f3e8ff' }}>
                                  <PrintIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Edit Particulars">
                                <IconButton size="small" color="primary" onClick={() => setEditingTransfer({ ...item })} sx={{ bgcolor: '#eff6ff' }}>
                                  <EditIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete Entry">
                                <IconButton size="small" color="error" onClick={() => handleDelete(item.id)} sx={{ bgcolor: '#ffeeec' }}>
                                  <DeleteIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              rowsPerPageOptions={[10, 25, 50, 100]}
              component="div"
              count={filteredTransfers.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(e, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
            />
          </Paper>
        </Stack>
      )}

      {/* VIEW VOUCHER DETAILS DIALOG MODAL */}
      <Dialog open={Boolean(viewingTransfer)} onClose={() => setViewingTransfer(null)} maxWidth="md" fullWidth>
        {viewingTransfer && (
          <>
            <DialogTitle component="div" sx={{ bgcolor: '#1e3a8a', color: '#ffffff', fontWeight: 800, display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 2 }}>
              <Box display="flex" alignItems="center" gap={1.5}>
                <TransferIcon sx={{ fontSize: 24 }} />
                <Typography variant="h6" fontWeight={800}>
                  Stock Transfer Voucher Particulars — #{viewingTransfer.s_no}
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => setViewingTransfer(null)} sx={{ color: '#ffffff' }}>
                <CloseIcon />
              </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 3, bgcolor: '#f8fafc' }}>
              <Stack spacing={2.5} sx={{ mt: 1 }}>
                <Paper elevation={0} sx={{ p: 2, bgcolor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 2 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="textSecondary" fontWeight={700}>SOURCE GODOWN / UNIT</Typography>
                      <Typography variant="h6" fontWeight={900} color="primary">{viewingTransfer.from_godown_name}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="textSecondary" fontWeight={700}>DESTINATION GODOWN / UNIT</Typography>
                      <Typography variant="h6" fontWeight={900} color="success">{viewingTransfer.to_godown_name}</Typography>
                    </Grid>
                  </Grid>
                </Paper>

                <Paper elevation={0} sx={{ p: 2.5, bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}>
                  <Typography variant="subtitle2" fontWeight={800} color="#1e293b" mb={1.5}>TRANSFER & ITEM DETAILS</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="caption" color="textSecondary">Transfer Date</Typography>
                      <Typography variant="body2" fontWeight={800}>{viewingTransfer.transfer_date}</Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="caption" color="textSecondary">Item Name</Typography>
                      <Typography variant="body2" fontWeight={800}>{viewingTransfer.item_name}</Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="caption" color="textSecondary">Lot / Batch No</Typography>
                      <Typography variant="body2" fontWeight={800} sx={{ fontFamily: 'monospace', color: '#2563eb' }}>{viewingTransfer.lot_no}</Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="caption" color="textSecondary">Quantity (Bags)</Typography>
                      <Typography variant="body2" fontWeight={900} color="primary">{viewingTransfer.qty} Bags</Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="caption" color="textSecondary">Total Weight (Kg)</Typography>
                      <Typography variant="body2" fontWeight={800}>{viewingTransfer.weight} Kg</Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="caption" color="textSecondary">Weight in Metric Tons</Typography>
                      <Typography variant="body2" fontWeight={800}>{(Number(viewingTransfer.weight || 0) / 1000).toFixed(3)} MT</Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="caption" color="textSecondary">Movement Mode</Typography>
                      <Typography variant="body2" fontWeight={800}>
                        {viewingTransfer.transfer_mode === 'INTERNAL_UNIT' || (!viewingTransfer.vehicle_no && !viewingTransfer.driver_name)
                          ? '🏢 Internal Unit Movement'
                          : '🚚 External Transport'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="caption" color="textSecondary">Movement Method</Typography>
                      <Typography variant="body2" fontWeight={800}>{viewingTransfer.movement_method || '-'}</Typography>
                    </Grid>
                  </Grid>
                </Paper>

                <Paper elevation={0} sx={{ p: 2.5, bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}>
                  <Typography variant="subtitle2" fontWeight={800} color="#1e293b" mb={1.5}>LABOUR, TRANSPORT & FINANCIALS</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6} sm={4}>
                      <Typography variant="caption" color="textSecondary">Worker / Loadman Team</Typography>
                      <Typography variant="body2" fontWeight={800}>{viewingTransfer.worker_team || viewingTransfer.loadman_name || '-'}</Typography>
                    </Grid>
                    <Grid item xs={6} sm={4}>
                      <Typography variant="caption" color="textSecondary">Supervisor Name</Typography>
                      <Typography variant="body2" fontWeight={800}>{viewingTransfer.supervisor_name || '-'}</Typography>
                    </Grid>
                    <Grid item xs={6} sm={4}>
                      <Typography variant="caption" color="textSecondary">Loadman Rate / Bag</Typography>
                      <Typography variant="body2" fontWeight={800}>₹{viewingTransfer.loadman_rate_per_qty || 0}</Typography>
                    </Grid>
                    <Grid item xs={6} sm={4}>
                      <Typography variant="caption" color="textSecondary">Total Labour Charges</Typography>
                      <Typography variant="body2" fontWeight={900} color="success">₹{Number(viewingTransfer.handling_amount || viewingTransfer.loadman_charges || 0).toFixed(2)}</Typography>
                    </Grid>
                    <Grid item xs={6} sm={4}>
                      <Typography variant="caption" color="textSecondary">Driver & Vehicle No</Typography>
                      <Typography variant="body2" fontWeight={800}>{viewingTransfer.driver_name ? `${viewingTransfer.driver_name} (${viewingTransfer.vehicle_no || ''})` : '-'}</Typography>
                    </Grid>
                    <Grid item xs={6} sm={4}>
                      <Typography variant="caption" color="textSecondary">Transporter Name</Typography>
                      <Typography variant="body2" fontWeight={800}>{viewingTransfer.transporter_name || '-'}</Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="caption" color="textSecondary">Remarks / Notes</Typography>
                      <Typography variant="body2" fontStyle="italic">{viewingTransfer.remarks || 'No remarks entered'}</Typography>
                    </Grid>
                  </Grid>
                </Paper>
              </Stack>
            </DialogContent>

            <DialogActions sx={{ p: 2.5, bgcolor: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
              <Button onClick={() => setViewingTransfer(null)} variant="outlined" sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}>
                Close
              </Button>
              <Button
                onClick={() => {
                  handlePrintSingleVoucher(viewingTransfer);
                  setViewingTransfer(null);
                }}
                variant="contained"
                startIcon={<PrintIcon />}
                sx={{ bgcolor: '#1e3a8a', borderRadius: 2, textTransform: 'none', fontWeight: 800 }}
              >
                Print Voucher
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Quick Add New Godown Master Dialog */}
      <Dialog open={openGodownModal} onClose={() => setOpenGodownModal(false)} maxWidth="xs" fullWidth>
        <DialogTitle component="div" sx={{ bgcolor: '#1e3a8a', color: '#ffffff', fontWeight: 800, display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 2 }}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <WarehouseIcon sx={{ fontSize: 24 }} />
            <Typography variant="h6" fontWeight={800}>
              Create Godown / Factory Unit Master
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setOpenGodownModal(false)} sx={{ color: '#ffffff' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3, bgcolor: '#f8fafc' }}>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              size="small"
              label="Godown / Unit Name"
              placeholder="e.g. Processing Bay 3, Unit 2 Packing"
              required
              value={newGodownForm.godown_name}
              onChange={(e) => setNewGodownForm({ ...newGodownForm, godown_name: e.target.value })}
              InputProps={{ style: { backgroundColor: '#ffffff', fontWeight: 700 } }}
            />

            <TextField
              fullWidth
              size="small"
              label="Area / Campus Location"
              placeholder="e.g. Factory Premises, Unit 1 Campus"
              value={newGodownForm.area}
              onChange={(e) => setNewGodownForm({ ...newGodownForm, area: e.target.value })}
              InputProps={{ style: { backgroundColor: '#ffffff' } }}
            />

            <TextField
              select
              fullWidth
              size="small"
              label="Godown Type"
              value={newGodownForm.godown_type}
              onChange={(e) => setNewGodownForm({ ...newGodownForm, godown_type: e.target.value })}
              InputProps={{ style: { backgroundColor: '#ffffff' } }}
            >
              <MenuItem value="Normal">Normal Warehouse</MenuItem>
              <MenuItem value="Internal Factory Unit">Internal Factory Unit / Bay</MenuItem>
              <MenuItem value="Cold Storage">Cold Storage Facility</MenuItem>
              <MenuItem value="Processing Hall">Processing / Sorting Hall</MenuItem>
            </TextField>

            <TextField
              select
              fullWidth
              size="small"
              label="Storage Location Category"
              value={newGodownForm.storage_location}
              onChange={(e) => setNewGodownForm({ ...newGodownForm, storage_location: e.target.value })}
              InputProps={{ style: { backgroundColor: '#ffffff' } }}
            >
              <MenuItem value="Inside Factory">Inside Factory Campus</MenuItem>
              <MenuItem value="Outside Campus">Outside Warehouse</MenuItem>
              <MenuItem value="External Cold Storage">External Commercial Cold Storage</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2.5, bgcolor: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
          <Button onClick={() => setOpenGodownModal(false)} variant="outlined" sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}>
            Cancel
          </Button>
          <Button onClick={handleSaveNewGodown} variant="contained" disabled={savingGodown} startIcon={<SaveIcon />} sx={{ bgcolor: '#1e3a8a', borderRadius: 2, textTransform: 'none', fontWeight: 800 }}>
            {savingGodown ? 'Saving...' : 'Save Godown Master'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Transfer Particulars Modal */}
      <Dialog open={Boolean(editingTransfer)} onClose={() => setEditingTransfer(null)} maxWidth="md" fullWidth>
        {editingTransfer && (
          <form onSubmit={handleUpdateTransfer}>
            <DialogTitle component="div" sx={{ bgcolor: '#1e3a8a', color: '#ffffff', fontWeight: 800, display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 2 }}>
              <Box display="flex" alignItems="center" gap={1.5}>
                <EditIcon sx={{ fontSize: 24 }} />
                <Typography variant="h6" fontWeight={800}>
                  Update Transfer Voucher #{editingTransfer.s_no}
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => setEditingTransfer(null)} sx={{ color: '#ffffff' }}>
                <CloseIcon />
              </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 3, bgcolor: '#f8fafc' }}>
              <Box mb={2.5} p={2} bgcolor="#ffffff" borderRadius={2} border="1px solid #e2e8f0" display="flex" justifyContent="space-between" alignItems="center" fontSize="13px">
                <div>From Godown: <strong>{editingTransfer.from_godown_name}</strong></div>
                <div>To Godown: <strong style={{ color: '#15803d' }}>{editingTransfer.to_godown_name}</strong></div>
                <div>Item: <strong>{editingTransfer.item_name}</strong> (<span style={{ color: '#2563eb' }}>{editingTransfer.qty} units</span>)</div>
              </Box>

              <Grid container spacing={2.5}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Worker Team / Handlers"
                    value={editingTransfer.worker_team || ''}
                    onChange={(e) => setEditingTransfer({ ...editingTransfer, worker_team: e.target.value })}
                    InputProps={{ style: { backgroundColor: '#ffffff' } }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Internal Movement Method"
                    value={editingTransfer.movement_method || ''}
                    onChange={(e) => setEditingTransfer({ ...editingTransfer, movement_method: e.target.value })}
                    InputProps={{ style: { backgroundColor: '#ffffff' } }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Supervisor Name"
                    value={editingTransfer.supervisor_name || ''}
                    onChange={(e) => setEditingTransfer({ ...editingTransfer, supervisor_name: e.target.value })}
                    InputProps={{ style: { backgroundColor: '#ffffff' } }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Vehicle / Lorry No"
                    value={editingTransfer.vehicle_no || ''}
                    onChange={(e) => setEditingTransfer({ ...editingTransfer, vehicle_no: e.target.value })}
                    InputProps={{ style: { backgroundColor: '#ffffff' } }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Driver Name"
                    value={editingTransfer.driver_name || ''}
                    onChange={(e) => setEditingTransfer({ ...editingTransfer, driver_name: e.target.value })}
                    InputProps={{ style: { backgroundColor: '#ffffff' } }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    type="number"
                    fullWidth
                    size="small"
                    label="Labour Charges (₹)"
                    value={editingTransfer.loadman_charges !== undefined ? editingTransfer.loadman_charges : ''}
                    onChange={(e) => setEditingTransfer({
                      ...editingTransfer,
                      loadman_charges: e.target.value,
                      handling_amount: editingTransfer.handling_amount ? editingTransfer.handling_amount : e.target.value
                    })}
                    InputProps={{ style: { backgroundColor: '#ffffff' } }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Remarks"
                    value={editingTransfer.remarks || ''}
                    onChange={(e) => setEditingTransfer({ ...editingTransfer, remarks: e.target.value })}
                    InputProps={{ style: { backgroundColor: '#ffffff' } }}
                  />
                </Grid>
              </Grid>
            </DialogContent>

            <DialogActions sx={{ p: 2.5, bgcolor: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
              <Button onClick={() => setEditingTransfer(null)} variant="outlined" sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={updating} startIcon={<SaveIcon />} sx={{ bgcolor: '#1e3a8a', borderRadius: 2, textTransform: 'none', fontWeight: 800 }}>
                {updating ? 'Saving Changes...' : 'Save Transfer Details'}
              </Button>
            </DialogActions>
          </form>
        )}
      </Dialog>

      {/* Cold Storage Transfer Bill Statement Modal */}
      <ColdStorageTransferStatementModal
        open={openBillModal}
        onClose={() => {
          setOpenBillModal(false);
          setSelectedTransferRow(null);
        }}
        transferRow={selectedTransferRow}
        navigate={navigate}
      />

      {/* Cold Storage Release Order Modal */}
      <ColdStorageReleaseOrderModal
        open={csroModalOpen}
        onClose={() => setCsroModalOpen(false)}
        csoData={selectedCsroVoucher}
      />

      {/* Worker / Loadman Master Creation Modal */}
      <InlineMasterModal
        open={openWorkerModal}
        onClose={() => setOpenWorkerModal(false)}
        masterType="workers"
        onSuccess={handleWorkerCreated}
      />
    </Container>
  );
};

export default GodownTransfer;
