import React, { useEffect, useMemo, useState } from 'react';
import { 
  Box, 
  Button, 
  TextField, 
  MenuItem, 
  Select, 
  FormControl, 
  InputLabel, 
  CircularProgress, 
  Alert, 
  Snackbar,
  Checkbox,
  FormControlLabel,
  Typography,
  TableRow,
  TableCell,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import ERPPageLayout from '../../../components/erp/ERPPageLayout';
import ERPBreadcrumb from '../../../components/erp/ERPBreadcrumb';
import ERPHeader from '../../../components/erp/ERPHeader';
import ERPInformationCard from '../../../components/erp/ERPInformationCard';
import ERPParameterTabs from '../../../components/erp/ERPParameterTabs';
import ERPTable from '../../../components/erp/ERPTable';
import ERPSummaryCard from '../../../components/erp/ERPSummaryCard';
import ERPRemarksCard from '../../../components/erp/ERPRemarksCard';
import ERPActionBar from '../../../components/erp/ERPActionBar';

import parameterTemplates from '../../quality/config/parameterTemplates';
import { computeCategoryPassRate, computeOverallFromResults } from '../../quality/utils/qcCalculations';
import qualityApi from '../../quality/services/qualityApi';
import api from '../../../services/api';
import { printHtml } from '../../../utils/printHelper';
import { generateQcPrintHtml } from '../../../utils/qcPrintHelper';

const tabOrder = ['Physical', 'Chemical', 'Microbiology'];

const columns = [
  { key: 'parameter', label: 'Parameter', sx: { width: '18%' } },
  { key: 'method', label: 'Method', sx: { width: '10%' } },
  { key: 'min', label: 'Min Limit', sx: { width: '8%' } },
  { key: 'max', label: 'Max Limit', sx: { width: '8%' } },
  { key: 'actual', label: 'Current Limit (Manual Entry)', sx: { width: '18%' } },
  { key: 'unit', label: 'Unit', sx: { width: '8%' } },
  { key: 'status', label: 'Auto Result', sx: { width: '10%' } },
  { key: 'remarks', label: 'Remarks', sx: { width: '12%' } },
  { key: 'action', label: '✕ Remove', sx: { width: '8%', textAlign: 'center' } },
];

function formatSpecification(row) {
  const min = row?.min;
  const max = row?.max;
  const spec = row?.specification || '';

  if (spec) return spec;
  if (min === undefined && max === undefined) return '-';
  if (min !== undefined && max !== undefined) return `${min} - ${max}`;
  if (min !== undefined) return `Min ${min}`;
  return `Max ${max}`;
}

function parseNum(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function evaluateBySpec({ min, max, actual, specification }) {
  if (actual === null || actual === undefined) return 'PENDING';
  const actStr = String(actual).trim().toUpperCase();
  if (!actStr) return 'PENDING';

  // Text specification checks (e.g. "Absent")
  if (specification && specification.toUpperCase() === 'ABSENT') {
    return actStr === 'ABSENT' || actStr === 'NIL' || actStr === 'NEGATIVE' || actStr === '0' ? 'PASS' : 'FAIL';
  }

  const actNum = parseNum(actual);
  if (actNum === null) {
    if (specification && actStr === specification.toUpperCase()) {
      return 'PASS';
    }
    return 'PENDING';
  }

  const minN = parseNum(min);
  const maxN = parseNum(max);

  if (minN === null && maxN === null) return 'PENDING';

  const pass = (minN === null || actNum >= minN) && (maxN === null || actNum <= maxN);
  return pass ? 'PASS' : 'FAIL';
}

export default function QualityControlCreate() {
  const navigate = useNavigate();
  const { id: pathId } = useParams();
  const location = useLocation();
  const qs = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const id = pathId || qs.get('id');
  const [forceEdit, setForceEdit] = useState(false);
  const isReadOnly = !!id && !forceEdit;

  const [activeTab, setActiveTab] = useState('Physical');
  const [allLots, setAllLots] = useState([]);
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [selectedLotId, setSelectedLotId] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

  // Main Form fields
  const [qcHeader, setQcHeader] = useState({
    qcId: '',
    purchaseId: '',
    lotNo: '',
    supplier: '',
    item: '',
    batch: '',
    analyst: 'QC Engineer',
    remarks: '',
    quantity: '',
    unitWeight: '',
    totalWeight: '',
    receiptDate: '',
    invoiceDate: '',
    unloadingStatus: '',
  });

  const [qcResults, setQcResults] = useState([]);
  const [labRemarks, setLabRemarks] = useState('');

  // Decision Status buttons: HOLD, PENDING, APPROVE, RETURN
  const [decisionStatus, setDecisionStatus] = useState('PENDING');

  // Photographic / Video / Document Evidence state
  const [evidence, setEvidence] = useState([]);
  const [newEvidenceName, setNewEvidenceName] = useState('');
  const [newEvidenceType, setNewEvidenceType] = useState('image');
  const [newEvidenceUrl, setNewEvidenceUrl] = useState('');
  const [newEvidenceNotes, setNewEvidenceNotes] = useState('');
  const [showAddEvidenceUrl, setShowAddEvidenceUrl] = useState(false);

  // Add parameter state & dialog
  const [showAddParamDialog, setShowAddParamDialog] = useState(false);
  const [newParam, setNewParam] = useState({
    parameter: '',
    category: 'Physical',
    method: 'IS 4333',
    min: '',
    max: '',
    specification: '',
    unit: '%',
    actualResult: '',
    remarks: ''
  });

  const [itemsMaster, setItemsMaster] = useState([]);

  // 1. Load arrived stock lots & item master (including finished/unloaded ones to allow flexible audits or testing)
  useEffect(() => {
    if (!isReadOnly) {
      setLoading(true);
      setError('');
      Promise.allSettled([
        api(`/masters/all/item_master`),
        api(`/qc/pending?all=true`)
      ])
      .then(([itemsSettled, pendingSettled]) => {
        const itemsRes = itemsSettled.status === 'fulfilled' ? itemsSettled.value : null;
        const pendingRes = pendingSettled.status === 'fulfilled' ? pendingSettled.value : null;

        // Parse item master
        const itemsData = itemsRes?.data || itemsRes || [];
        const itemsArr = Array.isArray(itemsData) ? itemsData : [];
        setItemsMaster(itemsArr);

        // Parse pending lots
        if (pendingRes?.success && Array.isArray(pendingRes?.data)) {
          const lotsData = pendingRes.data;
          setAllLots(lotsData);
          
          // Check if there are query parameters or router state to pre-populate
          const qLotNo = qs.get('lotNo') || location.state?.lotNo || location.state?.lot_no;
          const qPurchaseId = qs.get('purchase_id') || qs.get('purchaseId') || location.state?.purchase_id || location.state?.purchaseId;
          const stateVehicleNo = location.state?.vehicleNo || location.state?.vehicle_no;
          const stateItemName = qs.get('itemName') || qs.get('item_name') || location.state?.itemName || location.state?.item_name;
          const stateSupplier = qs.get('supplier') || qs.get('supplier_name') || location.state?.supplier || location.state?.party_name;

          // Priority 1: Exact Lot match in loaded lotsData
          let matchedLot = null;
          if (qLotNo) {
            matchedLot = lotsData.find(l => 
              String(l.lot_no || '').trim().toLowerCase() === String(qLotNo).trim().toLowerCase() ||
              String(l.stock_lot_id || '').trim().toLowerCase() === String(qLotNo).trim().toLowerCase()
            );
          }

          // Priority 2: Match by purchase ID and lot or item if available in lotsData
          if (!matchedLot && qPurchaseId) {
            matchedLot = lotsData.find(l => 
              (String(l.purchase_id) === String(qPurchaseId) || String(l.receipt_no) === String(qPurchaseId) || String(l.receipt_no) === `PUR-${qPurchaseId}`) &&
              (!qLotNo || String(l.lot_no || '').trim().toLowerCase() === String(qLotNo).trim().toLowerCase())
            );
          }

          // Priority 3: Match by Item Name or Supplier in lotsData
          if (!matchedLot && (stateItemName || stateSupplier)) {
            matchedLot = lotsData.find(l => 
              (stateItemName && String(l.item_name || '').toLowerCase() === String(stateItemName).toLowerCase()) ||
              (stateSupplier && String(l.supplier_name || '').toLowerCase() === String(stateSupplier).toLowerCase())
            );
          }

          if (matchedLot) {
            handleSelectPendingLotWithItems(matchedLot, itemsArr);
          } else if (qPurchaseId) {
            // Priority 4: Fetch directly from /purchases/:id to get the authentic purchase and its item details
            api(`/purchases/${qPurchaseId}`)
              .then(res => {
                const p = res?.data || res;
                if (p && (p.id || p.inv_no || p.s_no)) {
                  const pItems = Array.isArray(p.items) ? p.items : [];
                  const targetItem = (qLotNo && pItems.find(it => String(it.lot_no || '').trim().toLowerCase() === String(qLotNo).trim().toLowerCase())) ||
                                     pItems[0] || {};

                  handleSelectPendingLotWithItems({
                    stock_lot_id: targetItem.lot_no || qLotNo || `LOT-${qPurchaseId}`,
                    lot_no: targetItem.lot_no || qLotNo || `LOT-${qPurchaseId}`,
                    item_name: targetItem.item_name || targetItem.item || stateItemName || p.type || 'Raw Material',
                    supplier_name: p.supplier_name || p.supplier || stateSupplier || '',
                    received_qty: Number(targetItem.qty || targetItem.quantity || 100),
                    unit_weight: Number(targetItem.per_unit_weight || 50),
                    total_weight: Number(targetItem.total_weight || ((Number(targetItem.qty || 100)) * (Number(targetItem.per_unit_weight || 50)))),
                    receipt_no: p.inv_no || p.invoice_no || `PUR-${qPurchaseId}`,
                    purchase_id: qPurchaseId,
                    receipt_date: p.date || new Date().toISOString().split('T')[0],
                    invoice_date: p.inv_date || p.date || new Date().toISOString().split('T')[0],
                    unloading_status: 'PENDING_DECISION'
                  }, itemsArr);
                } else if (lotsData.length > 0) {
                  handleSelectPendingLotWithItems(lotsData[0], itemsArr);
                }
              })
              .catch(() => {
                if (lotsData.length > 0) {
                  handleSelectPendingLotWithItems(lotsData[0], itemsArr);
                }
              });
          } else if (lotsData.length > 0) {
            const firstPending = lotsData.find(l => !l.qc_status || l.qc_status === 'QC_PENDING');
            handleSelectPendingLotWithItems(firstPending || lotsData[0], itemsArr);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load raw material lots or item master:', err);
        setError('Failed to fetch arrived raw material lots or item master data.');
      })
      .finally(() => setLoading(false));
    }
  }, [isReadOnly, qs]);

  // 2. Load existing inspection record on mount (for display/view mode)
  useEffect(() => {
    if (isReadOnly) {
      setLoadingHistory(true);
      setError('');
      qualityApi.loadQc(id)
        .then((res) => {
          if (res?.success && res?.data) {
            const data = res.data;
            const displayPurchaseId = data.receipt_no 
              ? (String(data.receipt_no).startsWith('PUR-') ? data.receipt_no : `PUR-${data.receipt_no}`)
              : (data.s_no ? `PUR-${data.s_no}` : (data.purchaseId ? (String(data.purchaseId).startsWith('PUR-') ? data.purchaseId : `PUR-${data.purchaseId}`) : ''));

            setQcHeader({
              qcId: data.qcId || data.id || '',
              purchaseId: displayPurchaseId,
              lotNo: data.lotNo || '',
              supplier: data.supplier || '',
              item: data.item || '',
              batch: data.batch || '',
              analyst: data.analyst || 'QC Analyst',
              remarks: data.remarks || '',
              quantity: data.quantity || '',
              unitWeight: data.unit_weight || '',
              totalWeight: data.total_weight || '',
              receiptDate: data.receipt_date || '',
              invoiceDate: data.invoice_date || '',
              status: data.overallResult || data.overall_result || data.status || 'ACCEPTED',
              unloadingStatus: data.unloadingStatus || data.unloading_status || '',
            });

            // Ensure specs / parameters are fully populated with specifications
            let loadedResults = data.qcResults || [];
            let matchedProductKey = 'Rice';
            const itemNameLower = String(data.item || '').toLowerCase();
            if (itemNameLower.includes('wheat')) matchedProductKey = 'Wheat';
            else if (itemNameLower.includes('bengal') || itemNameLower.includes('gram') || itemNameLower.includes('chana')) matchedProductKey = 'BengalGram';
            else if (itemNameLower.includes('urad')) matchedProductKey = 'Urad';

            const templateObj = parameterTemplates[matchedProductKey] || parameterTemplates.Rice || {};

            // Flatten template into an array of parameter definitions
            const flattenedTemplate = Object.entries(templateObj).flatMap(([category, params]) =>
              (Array.isArray(params) ? params : []).map(p => ({
                parameterKey: p.id,
                parameter: p.parameter,
                category,
                min: p.min,
                max: p.max,
                specification: p.specification || '',
                unit: p.unit || '',
                method: p.method || ''
              }))
            );

            if (loadedResults.length === 0) {
              loadedResults = flattenedTemplate.map(t => ({
                ...t,
                actualResult: '',
                status: 'PASS',
                remarks: ''
              }));
            } else {
              loadedResults = loadedResults.map(r => {
                const matchInTemplate = flattenedTemplate.find(t => 
                  (r.parameterKey && t.parameterKey === r.parameterKey) || 
                  (r.parameter && t.parameter && t.parameter.toLowerCase() === r.parameter.toLowerCase())
                );
                return {
                  parameterKey: r.parameterKey || matchInTemplate?.parameterKey || 'param',
                  parameter: r.parameter || matchInTemplate?.parameter || r.parameterKey || 'Parameter',
                  category: r.category || matchInTemplate?.category || 'Physical',
                  min: r.min !== undefined ? r.min : matchInTemplate?.min,
                  max: r.max !== undefined ? r.max : matchInTemplate?.max,
                  specification: r.specification || matchInTemplate?.specification || '',
                  unit: r.unit || matchInTemplate?.unit || '',
                  method: r.method || matchInTemplate?.method || '',
                  actualResult: r.actualResult !== undefined ? r.actualResult : (r.value !== undefined ? r.value : (r.actual !== undefined ? r.actual : '')),
                  status: r.status || 'PASS',
                  remarks: r.remarks || ''
                };
              });
            }

            setQcResults(loadedResults);
            setLabRemarks(data.remarks || '');
            setDecisionStatus(data.overallResult || data.overall_result || data.status || 'ACCEPTED');
            const loadedEvidence = Array.isArray(data.evidence) 
              ? data.evidence 
              : (data.evidence_json ? (typeof data.evidence_json === 'string' ? JSON.parse(data.evidence_json) : data.evidence_json) : []);
            setEvidence(Array.isArray(loadedEvidence) ? loadedEvidence : []);
          } else {
            setError(res?.message || 'Inspection record not found.');
          }
        })
        .catch((err) => {
          console.error('Failed to load QC history:', err);
          setError('Failed to load QC inspection details.');
        })
        .finally(() => setLoadingHistory(false));
    }
  }, [id, isReadOnly]);

  // Filter lots based on checkbox
  const visibleLots = useMemo(() => {
    if (showPendingOnly) {
      return allLots.filter(l => !l.qc_status || l.qc_status === 'QC_PENDING' || l.qc_status === '');
    }
    return allLots;
  }, [allLots, showPendingOnly]);

  // Handle choosing a pending/arrived lot from dropdown
  const handleSelectPendingLotWithItems = (lot, itemsArr) => {
    if (!lot) return;

    const currentItemsMaster = itemsArr || itemsMaster;
    
    // Find matched item in itemsMaster to retrieve custom lab parameters
    const matchedItem = currentItemsMaster.find(it => 
      it.item_name?.toLowerCase() === lot.item_name?.toLowerCase() ||
      String(it.id) === String(lot.item_id)
    );

    let parsedParams = null;
    if (matchedItem && matchedItem.lab_parameters) {
      try {
        parsedParams = typeof matchedItem.lab_parameters === 'string'
          ? JSON.parse(matchedItem.lab_parameters)
          : matchedItem.lab_parameters;
      } catch (e) {
        console.error('Failed to parse lab parameters from matched item:', e);
      }
    }

    const displayPurchaseId = lot.receipt_no 
      ? (String(lot.receipt_no).startsWith('PUR-') ? lot.receipt_no : `PUR-${lot.receipt_no}`)
      : (lot.s_no ? `PUR-${lot.s_no}` : (lot.purchase_id ? (String(lot.purchase_id).startsWith('PUR-') ? lot.purchase_id : `PUR-${lot.purchase_id}`) : ''));

    setQcHeader({
      qcId: '',
      purchaseId: displayPurchaseId,
      lotNo: lot.lot_no || '',
      supplier: lot.supplier_name || '',
      item: lot.item_name || '',
      batch: lot.lot_no || '', // fall back to lot_no for batch if empty
      analyst: qcHeader.analyst || 'QC Engineer',
      remarks: '',
      quantity: lot.received_qty || '',
      unitWeight: lot.unit_weight || '',
      totalWeight: lot.total_weight || '',
      receiptDate: lot.receipt_date || '',
      invoiceDate: lot.invoice_date || '',
      unloadingStatus: lot.unloading_status || 'PENDING_DECISION',
    });

    const initialResults = [];

    // Check if item has custom lab parameters with specifications
    if (parsedParams && parsedParams.specs && Object.keys(parsedParams.specs).length > 0) {
      const specs = parsedParams.specs;
      Object.keys(specs).forEach((key) => {
        const p = specs[key];
        initialResults.push({
          parameterKey: key,
          parameter: p.parameter || p.name || key,
          category: p.category || 'Physical',
          min: p.min,
          max: p.max,
          specification: p.specification || '',
          unit: p.unit || '',
          method: p.method || '',
          actualResult: '',
          status: 'PENDING',
          remarks: ''
        });
      });
    } else {
      // Fall back to template-based parameters
      let matchedProductKey = 'Rice';
      const itemNameLower = String(lot.item_name || '').toLowerCase();
      if (itemNameLower.includes('wheat')) matchedProductKey = 'Wheat';
      else if (itemNameLower.includes('bengal') || itemNameLower.includes('gram') || itemNameLower.includes('chana')) matchedProductKey = 'BengalGram';
      else if (itemNameLower.includes('urad')) matchedProductKey = 'Urad';

      const template = parameterTemplates[matchedProductKey] || parameterTemplates.Rice;

      tabOrder.forEach(category => {
        const params = template[category] || [];
        params.forEach(p => {
          initialResults.push({
            parameterKey: p.id,
            parameter: p.parameter,
            category,
            min: p.min,
            max: p.max,
            specification: p.specification,
            unit: p.unit,
            method: p.method,
            actualResult: '',
            status: 'PENDING',
            remarks: ''
          });
        });
      });
    }

    setQcResults(initialResults);
    setSelectedLotId(lot.stock_lot_id || '');
    setLabRemarks('');
  };

  const handleSelectPendingLot = (lot) => {
    handleSelectPendingLotWithItems(lot, itemsMaster);
  };

  const handleLoadTemplateDirectly = (templateKey) => {
    if (!templateKey) return;
    
    // Auto-generate some default details for the custom lot
    const randomLotSuffix = Math.floor(1000 + Math.random() * 9000);
    const mockLotNo = `MLOT-${templateKey.toUpperCase().slice(0, 3)}-${randomLotSuffix}`;
    
    setQcHeader(prev => ({
      ...prev,
      qcId: '',
      purchaseId: prev.purchaseId || 'MANUAL-ENTRY',
      lotNo: prev.lotNo || mockLotNo,
      supplier: prev.supplier || 'Standard Supplier Ltd',
      item: templateKey,
      batch: prev.batch || mockLotNo,
      analyst: prev.analyst || 'QC Engineer',
      quantity: prev.quantity || '500',
      totalWeight: prev.totalWeight || '25.0',
      receiptDate: prev.receiptDate || new Date().toISOString().split('T')[0],
      invoiceDate: prev.invoiceDate || new Date().toISOString().split('T')[0],
    }));

    // Find matched item in itemsMaster to retrieve custom lab parameters if possible
    const matchedItem = itemsMaster.find(it => 
      it.item_name?.toLowerCase() === templateKey.toLowerCase()
    );

    let parsedParams = null;
    if (matchedItem && matchedItem.lab_parameters) {
      try {
        parsedParams = typeof matchedItem.lab_parameters === 'string'
          ? JSON.parse(matchedItem.lab_parameters)
          : matchedItem.lab_parameters;
      } catch (e) {
        console.error('Failed to parse lab parameters:', e);
      }
    }

    const initialResults = [];

    if (parsedParams && parsedParams.specs && Object.keys(parsedParams.specs).length > 0) {
      const specs = parsedParams.specs;
      Object.keys(specs).forEach((key) => {
        const p = specs[key];
        initialResults.push({
          parameterKey: key,
          parameter: p.parameter || p.name || key,
          category: p.category || 'Physical',
          min: p.min,
          max: p.max,
          specification: p.specification || '',
          unit: p.unit || '',
          method: p.method || '',
          actualResult: '',
          status: 'PENDING',
          remarks: ''
        });
      });
    } else {
      // Initialize qcResults from the product template
      const template = parameterTemplates[templateKey] || parameterTemplates.Rice;

      tabOrder.forEach(category => {
        const params = template[category] || [];
        params.forEach(p => {
          initialResults.push({
            parameterKey: p.id,
            parameter: p.parameter,
            category,
            min: p.min,
            max: p.max,
            specification: p.specification,
            unit: p.unit,
            method: p.method,
            actualResult: '',
            status: 'PENDING',
            remarks: ''
          });
        });
      });
    }

    setQcResults(initialResults);
    setSelectedLotId(''); // Reset selector
    setLabRemarks('');
    setToast({ open: true, message: `Loaded ${templateKey} parameter template! Please enter your actual testing values below.`, severity: 'success' });
  };

  const handleDropdownChange = (e) => {
    const val = e.target.value;
    setSelectedLotId(val);
    const lot = allLots.find(l => l.stock_lot_id === val);
    if (lot) {
      handleSelectPendingLot(lot);
    }
  };

  // Derive metrics using our pure utilities
  const derived = useMemo(() => {
    const overall = computeOverallFromResults(qcResults);
    const physicalPass = computeCategoryPassRate(qcResults, 'Physical');
    const chemicalPass = computeCategoryPassRate(qcResults, 'Chemical');
    const microPass = computeCategoryPassRate(qcResults, 'Microbiology');

    return {
      ...overall,
      physicalPass,
      chemicalPass,
      microPass,
    };
  }, [qcResults]);

  const updateRow = (paramKey, patch) => {
    if (isReadOnly) return;
    setQcResults((prev) => {
      const next = [...prev];
      const idx = next.findIndex((r) => r.parameterKey === paramKey);
      if (idx !== -1) {
        const updatedRow = { ...next[idx], ...patch };
        
        // Auto-calculate status if actualResult changed
        if ('actualResult' in patch) {
          updatedRow.status = evaluateBySpec({
            min: updatedRow.min,
            max: updatedRow.max,
            actual: patch.actualResult,
            specification: updatedRow.specification
          });
        }
        next[idx] = updatedRow;
      }
      return next;
    });
  };

  const handleRemoveParameter = (paramKey) => {
    if (isReadOnly) return;
    setQcResults((prev) => prev.filter((r) => r.parameterKey !== paramKey));
    setToast({ open: true, message: 'Parameter removed from inspection list', severity: 'info' });
  };

  const handleAddParameter = () => {
    if (!newParam.parameter.trim()) {
      setToast({ open: true, message: 'Parameter name is required', severity: 'warning' });
      return;
    }
    const paramKey = `custom_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const createdParam = {
      parameterKey: paramKey,
      parameter: newParam.parameter.trim(),
      parameterName: newParam.parameter.trim(),
      category: newParam.category || activeTab,
      method: newParam.method.trim() || 'Standard Method',
      min: newParam.min !== '' ? Number(newParam.min) : undefined,
      max: newParam.max !== '' ? Number(newParam.max) : undefined,
      specification: newParam.specification.trim(),
      unit: newParam.unit.trim() || '%',
      actualResult: newParam.actualResult.trim(),
      status: evaluateBySpec({
        min: newParam.min !== '' ? Number(newParam.min) : undefined,
        max: newParam.max !== '' ? Number(newParam.max) : undefined,
        actual: newParam.actualResult.trim(),
        specification: newParam.specification.trim()
      }),
      remarks: newParam.remarks.trim()
    };
    setQcResults((prev) => [...prev, createdParam]);
    setShowAddParamDialog(false);
    setNewParam({
      parameter: '',
      category: activeTab,
      method: 'IS 4333',
      min: '',
      max: '',
      specification: '',
      unit: '%',
      actualResult: '',
      remarks: ''
    });
    setToast({ open: true, message: `Added parameter "${createdParam.parameter}" to ${createdParam.category}!`, severity: 'success' });
  };

  const handleFileUpload = (e) => {
    if (isReadOnly) return;
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target.result;
        const isImg = file.type.startsWith('image/');
        const isVid = file.type.startsWith('video/');
        const detectedType = isImg ? 'image' : isVid ? 'video' : 'document';
        const newEv = {
          id: `ev_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          name: newEvidenceName.trim() || file.name,
          type: detectedType,
          mime_type: file.type || (isImg ? 'image/jpeg' : isVid ? 'video/mp4' : 'application/pdf'),
          url: dataUrl,
          notes: newEvidenceNotes.trim() || `Physical test sample - ${file.name}`,
          upload_date: new Date().toISOString().split('T')[0]
        };
        setEvidence((prev) => [...prev, newEv]);
      };
      reader.readAsDataURL(file);
    });
    setNewEvidenceName('');
    setNewEvidenceNotes('');
    setToast({ open: true, message: `Attached ${files.length} test reference file(s)`, severity: 'success' });
    e.target.value = '';
  };

  const handleAddUrlEvidence = () => {
    if (isReadOnly) return;
    if (!newEvidenceUrl.trim()) {
      setToast({ open: true, message: 'Please provide a valid document or media URL', severity: 'warning' });
      return;
    }
    const isImg = newEvidenceType === 'image' || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(newEvidenceUrl);
    const isVid = newEvidenceType === 'video' || /\.(mp4|webm|mov|ogg)$/i.test(newEvidenceUrl);
    const newEv = {
      id: `ev_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: newEvidenceName.trim() || 'Physical Quality Reference',
      type: newEvidenceType || (isImg ? 'image' : isVid ? 'video' : 'document'),
      mime_type: isImg ? 'image/jpeg' : isVid ? 'video/mp4' : 'application/pdf',
      url: newEvidenceUrl.trim(),
      notes: newEvidenceNotes.trim() || 'Physical inspection reference',
      upload_date: new Date().toISOString().split('T')[0]
    };
    setEvidence((prev) => [...prev, newEv]);
    setNewEvidenceName('');
    setNewEvidenceNotes('');
    setNewEvidenceUrl('');
    setShowAddEvidenceUrl(false);
    setToast({ open: true, message: 'Added test reference document link', severity: 'success' });
  };

  const handleRemoveEvidence = (idToRemove) => {
    if (isReadOnly) return;
    setEvidence((prev) => prev.filter((ev) => ev.id !== idToRemove));
    setToast({ open: true, message: 'Removed test reference item', severity: 'info' });
  };

  const renderTabBody = (tabValue) => {
    const rows = qcResults.filter((r) => r.category === tabValue);

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {/* Category Header with + Add Parameter button */}
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            p: 1.25, 
            backgroundColor: '#f1f5f9', 
            borderRadius: 1, 
            border: '1px solid #cbd5e1' 
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 800, color: '#1e3a8a' }}>
              {tabValue} Quality Parameters ({rows.length} Active)
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'inline' } }}>
              • Enter observed results or remove rows using ✕
            </Typography>
          </Box>
          {!isReadOnly && (
            <Button
              size="small"
              variant="contained"
              onClick={() => {
                setNewParam((prev) => ({ ...prev, category: tabValue }));
                setShowAddParamDialog(true);
              }}
              sx={{
                backgroundColor: '#1e3a8a',
                color: '#fff',
                fontWeight: 800,
                fontSize: 12,
                textTransform: 'none',
                py: 0.5,
                px: 1.5,
                borderRadius: 1,
                boxShadow: '0 2px 4px rgba(30,58,138,0.2)',
                '&:hover': { backgroundColor: '#172554' }
              }}
            >
              + Add {tabValue} Parameter
            </Button>
          )}
        </Box>

        {rows.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary', border: '1.5px dashed #cbd5e1', borderRadius: 1.5, backgroundColor: '#f8fafc' }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              No parameters defined for {tabValue} category.
            </Typography>
            {!isReadOnly && (
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  setNewParam((prev) => ({ ...prev, category: tabValue }));
                  setShowAddParamDialog(true);
                }}
                sx={{ mt: 1.5, fontWeight: 800 }}
              >
                + Add {tabValue} Parameter
              </Button>
            )}
          </Box>
        ) : (
          <ERPTable
            columns={columns}
            rows={rows}
            headerSx={{ '& .MuiTableCell-root': { paddingY: 1 } }}
            bodySx={{ '& .MuiTableCell-root': { paddingY: 1, verticalAlign: 'middle' } }}
            renderRow={(row) => (
              <TableRow key={row.parameterKey}>
                <TableCell style={{ fontWeight: 700 }}>{row.parameter}</TableCell>
                <TableCell>{row.method || '-'}</TableCell>
                <TableCell style={{ fontWeight: 600, color: '#333' }}>{row.min !== undefined && row.min !== null ? row.min : '-'}</TableCell>
                <TableCell style={{ fontWeight: 600, color: '#333' }}>{row.max !== undefined && row.max !== null ? row.max : '-'}</TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    value={row.actualResult || ''}
                    disabled={isReadOnly}
                    onChange={(e) => updateRow(row.parameterKey, { actualResult: e.target.value })}
                    placeholder="Enter result..."
                    fullWidth
                    variant="outlined"
                    InputProps={{
                      style: {
                        backgroundColor: row.status === 'PASS' ? '#e8f5e9' : row.status === 'FAIL' ? '#ffebee' : 'transparent',
                        color: row.status === 'PASS' ? '#2e7d32' : row.status === 'FAIL' ? '#d32f2f' : 'inherit',
                        fontWeight: row.status === 'PASS' || row.status === 'FAIL' ? 800 : 'normal',
                      }
                    }}
                  />
                </TableCell>
                <TableCell>{row.unit || '-'}</TableCell>
                <TableCell>
                  <Box 
                    sx={{ 
                      fontWeight: 900, 
                      fontSize: 12,
                      color: row.status === 'PASS' ? '#2e7d32' : row.status === 'FAIL' ? '#d32f2f' : '#ed6c02',
                      backgroundColor: row.status === 'PASS' ? '#e8f5e9' : row.status === 'FAIL' ? '#ffebee' : '#fff3e0',
                      textAlign: 'center',
                      py: 0.5,
                      borderRadius: 1
                    }}
                  >
                    {row.status === 'PASS' ? '✓ MATCHED' : row.status === 'FAIL' ? '✗ FAILED' : 'PENDING'}
                  </Box>
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    value={row.remarks || ''}
                    disabled={isReadOnly}
                    onChange={(e) => updateRow(row.parameterKey, { remarks: e.target.value })}
                    placeholder="Add remark..."
                    fullWidth
                    variant="outlined"
                  />
                </TableCell>
                <TableCell align="center">
                  {!isReadOnly && (
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={() => handleRemoveParameter(row.parameterKey)}
                      sx={{
                        minWidth: 28,
                        width: 28,
                        height: 28,
                        p: 0,
                        fontWeight: 900,
                        fontSize: 13,
                        borderRadius: 1,
                        borderColor: '#fca5a5',
                        color: '#dc2626',
                        '&:hover': {
                          backgroundColor: '#fee2e2',
                          borderColor: '#ef4444'
                        }
                      }}
                      title="Remove parameter from list"
                    >
                      ✕
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )}
          />
        )}
      </Box>
    );
  };

  const onSave = () => {
    if (isReadOnly) return;
    if (!qcHeader.lotNo) {
      setToast({ open: true, message: 'Please select an arrived lot before saving.', severity: 'warning' });
      return;
    }

    setLoading(true);
    const finalDecision = decisionStatus || derived.overallResult || 'ACCEPTED';
    const payload = {
      qcHeader: {
        ...qcHeader,
        status: finalDecision,
        remarks: labRemarks,
        qcResults,
        evidence
      },
      evidence,
      summary: {
        overallResult: finalDecision,
        pass: derived.pass,
        fail: derived.fail,
        pending: derived.pending
      }
    };

    qualityApi.submitQc(payload)
      .then((res) => {
        if (res?.success && res?.data) {
          setToast({ open: true, message: 'Quality control record saved successfully!', severity: 'success' });
          setQcHeader(prev => ({ ...prev, qcId: res.data.qcId, status: res.data.overallResult }));
          
          // Re-load lots
          api(`/qc/pending?all=true`)
            .then(lotsRes => {
              if (lotsRes?.success && Array.isArray(lotsRes?.data)) {
                setAllLots(lotsRes.data);
              }
            });

          // Navigate to completed QC list
          setTimeout(() => {
            navigate(`/entry/quality-control-display?tab=completed`);
          }, 1500);
        } else {
          setToast({ open: true, message: res?.message || 'Failed to save QA record.', severity: 'error' });
        }
      })
      .catch((err) => {
        console.error('Error saving QC:', err);
        setToast({ open: true, message: 'Failed to communicate with database server.', severity: 'error' });
      })
      .finally(() => setLoading(false));
  };

  const onOverrideApprove = () => {
    if (!qcHeader.lotNo) return;
    setLoading(true);
    api('/qc/override-approve', {
      method: 'POST',
      body: { lotNo: qcHeader.lotNo }
    })
      .then((res) => {
        if (res && res.success) {
          setToast({ open: true, message: `Lot ${qcHeader.lotNo} successfully approved and set to usable.`, severity: 'success' });
          setQcHeader(prev => ({ ...prev, status: 'ACCEPTED' }));
          setDecisionStatus('ACCEPTED');
          setTimeout(() => {
            navigate(`/entry/quality-control-display`);
          }, 1500);
        } else {
          setToast({ open: true, message: res?.message || 'Failed to override approve lot.', severity: 'error' });
        }
      })
      .catch((err) => {
        console.error('Error override approving lot:', err);
        setToast({ open: true, message: 'Failed to communicate with database server.', severity: 'error' });
      })
      .finally(() => setLoading(false));
  };

  const onChangeUnloadingStatus = (status) => {
    if (!qcHeader.lotNo) return;
    setLoading(true);
    api('/qc/unload', {
      method: 'POST',
      body: { lotNo: qcHeader.lotNo, status: status }
    })
      .then((res) => {
        if (res && res.success) {
          setToast({ open: true, message: `Lot unloading status successfully changed to ${status}.`, severity: 'success' });
          setQcHeader(prev => ({ ...prev, unloadingStatus: status }));

          if (status === 'RETURNED') {
            const rd = res.returnData || {};
            const party = rd.partyName || qcHeader.supplier || '';
            const item = rd.itemName || qcHeader.item || '';
            const q = rd.qty || qcHeader.quantity || '';
            const w = rd.weight || qcHeader.unitWeight || '';
            const lNo = qcHeader.lotNo;
            const pId = rd.purchaseId || qcHeader.purchaseId || '';
            const invNo = rd.invNo || qcHeader.invNo || '';

            setTimeout(() => {
              navigate(`/entry/purchase-return-create?partyName=${encodeURIComponent(party)}&itemName=${encodeURIComponent(item)}&qty=${q}&weight=${w}&lotNo=${encodeURIComponent(lNo)}&referenceId=${pId}&invNo=${encodeURIComponent(invNo)}`);
            }, 800);
          }
        } else {
          setToast({ open: true, message: res?.message || 'Failed to update status.', severity: 'error' });
        }
      })
      .catch((err) => {
        console.error('Error updating unloading status:', err);
        setToast({ open: true, message: 'Failed to communicate with database server.', severity: 'error' });
      })
      .finally(() => setLoading(false));
  };

  const onClear = () => {
    setQcResults([]);
    setLabRemarks('');
    setSelectedLotId('');
    setEvidence([]);
    setDecisionStatus('PENDING');
    setQcHeader({
      qcId: '',
      purchaseId: '',
      lotNo: '',
      supplier: '',
      item: '',
      batch: '',
      analyst: 'QC Engineer',
      remarks: '',
      quantity: '',
      unitWeight: '',
      totalWeight: '',
      receiptDate: '',
      invoiceDate: '',
    });
  };

  const onGenerateIqr = () => {
    const targetId = id || qcHeader.qcId;
    if (!targetId) {
      setToast({ open: true, message: 'Save the QC inspection first before generating IQR.', severity: 'warning' });
      return;
    }
    navigate(`/entry/incoming-quality-create?qcId=${targetId}`);
  };

  const onGenerateCoa = () => {
    const targetId = id || qcHeader.qcId;
    if (!targetId) {
      setToast({ open: true, message: 'Save the QC inspection first before generating COA.', severity: 'warning' });
      return;
    }
    navigate(`/quality/coa-display/${targetId}`);
  };

  const onPrint = () => {
    const finalDecision = decisionStatus || qcHeader.status || derived.overallResult || 'PENDING';
    const html = generateQcPrintHtml({
      qcNo: qcHeader.qcId || id || `QC-${qcHeader.lotNo || 'DRAFT'}`,
      date: qcHeader.receiptDate || new Date(),
      status: finalDecision,
      lotNo: qcHeader.lotNo,
      item: qcHeader.item,
      supplier: qcHeader.supplier,
      quantity: qcHeader.quantity,
      qcResults: qcResults,
      remarks: labRemarks || qcHeader.remarks,
      evidence: evidence
    }, {
      name: 'BVC EXPORTS PRIVATE LIMITED',
      address: 'Central Laboratory & Quality Assurance Division'
    }, 'COA');

    printHtml(html, `QC Inspection Report - ${qcHeader.lotNo || 'Inspection'}`);
  };

  const onExit = () => {
    navigate('/entry/quality-control-display');
  };

  const summaryCard = (
    <ERPSummaryCard>
      <Box sx={{ px: 2, pt: 2, pb: 2 }}>
        <Box sx={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', color: 'text.secondary', letterSpacing: 0.5 }}>
          Inspection Summary
        </Box>
        <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Pass / Fail / Pending:</span>
          <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--erp-primary)' }}>
            {derived.pass} / {derived.fail} / {derived.pending}
          </span>
        </Box>

        <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: '1fr', rowGap: 1, borderTop: '1px solid #f0f0f0', pt: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
            <span>Physical Pass:</span>
            <span>{derived.physicalPass}%</span>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
            <span>Chemical Pass:</span>
            <span>{derived.chemicalPass}%</span>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
            <span>Microbiology Pass:</span>
            <span>{derived.microPass}%</span>
          </Box>
        </Box>

        <Box sx={{ mt: 2, borderTop: '1px solid #f0f0f0', pt: 1.5 }}>
          <Box sx={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', color: 'text.secondary' }}>
            QA Decision Status
          </Box>
          <Box 
            sx={{ 
              mt: 1, 
              fontSize: 15, 
              fontWeight: 900, 
              textAlign: 'center', 
              py: 0.75, 
              borderRadius: 1,
              color: '#ffffff',
              backgroundColor: (decisionStatus || derived.overallResult) === 'APPROVE' || (decisionStatus || derived.overallResult) === 'ACCEPTED' 
                ? '#2e7d32' 
                : (decisionStatus || derived.overallResult) === 'RETURN' || (decisionStatus || derived.overallResult) === 'REJECTED' 
                ? '#d32f2f' 
                : (decisionStatus || derived.overallResult) === 'HOLD' 
                ? '#ed6c02' 
                : '#1976d2'
            }}
          >
            {decisionStatus || derived.overallResult}
          </Box>

          {!isReadOnly && (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, mt: 1.5 }}>
              {[
                { key: 'APPROVE', label: 'APPROVE', color: '#2e7d32', bg: '#e8f5e9' },
                { key: 'HOLD', label: 'HOLD', color: '#ed6c02', bg: '#fff3e0' },
                { key: 'PENDING', label: 'PENDING', color: '#1976d2', bg: '#e3f2fd' },
                { key: 'RETURN', label: 'RETURN', color: '#d32f2f', bg: '#ffebee' },
              ].map(b => (
                <Button
                  key={b.key}
                  size="small"
                  variant={(decisionStatus || qcHeader.status || derived.overallResult) === b.key ? 'contained' : 'outlined'}
                  onClick={() => {
                    setDecisionStatus(b.key);
                    setQcHeader(prev => ({ ...prev, status: b.key }));
                  }}
                  sx={{
                    fontSize: 11,
                    fontWeight: 900,
                    py: 0.4,
                    color: (decisionStatus || qcHeader.status || derived.overallResult) === b.key ? '#fff' : b.color,
                    backgroundColor: (decisionStatus || qcHeader.status || derived.overallResult) === b.key ? b.color : b.bg,
                    borderColor: b.color,
                    '&:hover': {
                      backgroundColor: b.color,
                      color: '#fff'
                    }
                  }}
                >
                  {b.label}
                </Button>
              ))}
            </Box>
          )}
        </Box>

        <Box sx={{ mt: 2 }}>
          <Box sx={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', color: 'text.secondary' }}>
            Disposition Recommendation
          </Box>
          <Box sx={{ mt: 0.5, fontSize: 13, fontWeight: 700, color: 'text.primary' }}>
            {derived.recommendation}
          </Box>
        </Box>
      </Box>
    </ERPSummaryCard>
  );

  if (loadingHistory) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress />
        <Box sx={{ ml: 2 }}>Loading Laboratory Inspection Details...</Box>
      </Box>
    );
  }

  return (
    <ERPPageLayout
      containerProps={{ px: { xs: 0, sm: 0 } }}
      breadcrumb={
        <ERPBreadcrumb
          items={[
            { label: 'Entry', isCurrent: false },
            { label: 'Quality Control', isCurrent: false },
            { label: isReadOnly ? 'Display' : 'Create', isCurrent: true },
          ]}
        />
      }
      header={<ERPHeader title={isReadOnly ? `Quality Control Details (Read-Only) – ${qcHeader.lotNo}` : "Quality Control – Master QA Entry"} />}
      rightSlot={summaryCard}
      childrenBottom={
        <ERPActionBar>
          {!isReadOnly && (
            <Button variant="contained" color="primary" onClick={onSave} disabled={loading}>
              {loading ? 'Saving...' : 'Save QA Record'}
            </Button>
          )}
          {!isReadOnly && (
            <Button variant="outlined" color="secondary" onClick={onClear}>
              Clear
            </Button>
          )}
          {!!id && !forceEdit && (
            <Button variant="contained" color="warning" onClick={() => setForceEdit(true)}>
              Retest / Edit
            </Button>
          )}
          {!!id && qcHeader.status !== 'ACCEPTED' && qcHeader.status !== 'PASS' && qcHeader.unloadingStatus !== 'UNLOADED' && (
            <Button variant="contained" color="success" onClick={onOverrideApprove} disabled={loading}>
              Approve to Unload
            </Button>
          )}
          {!!id && qcHeader.unloadingStatus !== 'UNLOADED' && (
            <Button variant="contained" sx={{ bgcolor: '#4caf50', '&:hover': { bgcolor: '#388e3c' }, color: '#fff' }} onClick={() => onChangeUnloadingStatus('UNLOADED')} disabled={loading}>
              Mark as Unloaded
            </Button>
          )}
          {!!id && qcHeader.unloadingStatus !== 'RETURNED' && (
            <Button variant="contained" sx={{ bgcolor: '#f44336', '&:hover': { bgcolor: '#d32f2f' }, color: '#fff' }} onClick={() => onChangeUnloadingStatus('RETURNED')} disabled={loading}>
              Mark as Returned
            </Button>
          )}
          {!!id && qcHeader.unloadingStatus && qcHeader.unloadingStatus !== 'PENDING_DECISION' && (
            <Button variant="outlined" color="primary" onClick={() => onChangeUnloadingStatus('PENDING_DECISION')} disabled={loading}>
              Reset to Unload Decision
            </Button>
          )}
          {(isReadOnly || qcHeader.qcId) && (
            <Button variant="contained" color="info" onClick={onGenerateIqr}>
              View IQR Report
            </Button>
          )}
          {(isReadOnly || qcHeader.qcId) && (
            <Button variant="contained" color="success" onClick={onGenerateCoa}>
              View COA Certificate
            </Button>
          )}
          <Button variant="outlined" onClick={onPrint}>
            Print Record
          </Button>
          <Button variant="outlined" onClick={onExit}>
            Exit
          </Button>
        </ERPActionBar>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        
        {/* Pending Lot Selector - Hidden in Read-Only Mode */}
        {!isReadOnly && (
          <ERPInformationCard title="Lot Identification & Parameter Template">
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 2 }}>
                <FormControl sx={{ flexGrow: 1 }} size="small">
                  <InputLabel id="pending-lot-label">Select Incoming Lot from Purchase</InputLabel>
                  <Select
                    labelId="pending-lot-label"
                    value={selectedLotId}
                    label="Select Incoming Lot from Purchase"
                    onChange={handleDropdownChange}
                  >
                    {visibleLots.length === 0 ? (
                      <MenuItem value="" disabled>No lots available. Arrive materials in Purchase creation first.</MenuItem>
                    ) : (
                      visibleLots.map((lot, idx) => (
                        <MenuItem key={`${lot.stock_lot_id || 'lot'}-${idx}`} value={lot.stock_lot_id || idx}>
                          {lot.lot_no} – {lot.item_name} ({lot.supplier_name || 'No Supplier'}) – Qty: {lot.received_qty} bags {lot.qc_status ? `[Status: ${lot.qc_status}]` : '[PENDING QC]'}
                        </MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>
                
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.secondary', px: { xs: 0, sm: 1 } }}>OR</Typography>
                </Box>

                <FormControl sx={{ width: { xs: '100%', sm: 260 } }} size="small">
                  <InputLabel id="manual-template-label">Load Raw Material Template</InputLabel>
                  <Select
                    labelId="manual-template-label"
                    value=""
                    label="Load Raw Material Template"
                    onChange={(e) => {
                      const templateKey = e.target.value;
                      handleLoadTemplateDirectly(templateKey);
                    }}
                  >
                    <MenuItem value="Rice">Rice Template</MenuItem>
                    <MenuItem value="Wheat">Wheat Template</MenuItem>
                    <MenuItem value="BengalGram">Bengal Gram Template</MenuItem>
                    <MenuItem value="Urad">Urad Template</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'info.main' }}>
                  💡 Tip: Select an arrived lot above, or choose a raw material template directly to input custom details manually.
                </Typography>
                <FormControlLabel
                  control={
                    <Checkbox 
                      checked={showPendingOnly} 
                      onChange={(e) => setShowPendingOnly(e.target.checked)} 
                      color="primary"
                      size="small"
                    />
                  }
                  label="Show Pending Only"
                  sx={{ whiteSpace: 'nowrap' }}
                />
              </Box>
            </Box>
          </ERPInformationCard>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>
        )}

        {/* Transaction Information Card */}
        <ERPInformationCard title="Transaction Information">
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2,
              fontSize: 14,
              alignItems: 'center'
            }}
          >
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 800, mb: 0.5, color: 'text.secondary' }}>QC / Lab ID:</Typography>
              <TextField size="small" fullWidth disabled value={qcHeader.qcId || 'Draft (Auto-generated)'} />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 800, mb: 0.5, color: 'text.secondary' }}>Purchase Ref ID:</Typography>
              <TextField 
                size="small" 
                fullWidth 
                disabled={isReadOnly} 
                value={qcHeader.purchaseId || ''} 
                onChange={(e) => setQcHeader(prev => ({ ...prev, purchaseId: e.target.value }))}
                placeholder="e.g. PUR-001 or MANUAL"
              />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 800, mb: 0.5, color: 'text.secondary' }}>Supplier Name:</Typography>
              <TextField 
                size="small" 
                fullWidth 
                disabled={isReadOnly} 
                value={qcHeader.supplier || ''} 
                onChange={(e) => setQcHeader(prev => ({ ...prev, supplier: e.target.value }))}
                placeholder="e.g. Standard Agro Ltd"
              />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 800, mb: 0.5, color: 'text.secondary' }}>Product / Item:</Typography>
              <TextField 
                size="small" 
                fullWidth 
                disabled={isReadOnly} 
                value={qcHeader.item || ''} 
                onChange={(e) => setQcHeader(prev => ({ ...prev, item: e.target.value }))}
                placeholder="e.g. Rice, Wheat, etc."
              />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 800, mb: 0.5, color: 'text.secondary' }}>Raw Material Lot No (Mandatory):</Typography>
              <TextField 
                size="small" 
                fullWidth 
                disabled={isReadOnly} 
                error={!isReadOnly && !qcHeader.lotNo}
                helperText={!isReadOnly && !qcHeader.lotNo ? 'Lot number is required' : ''}
                value={qcHeader.lotNo || ''} 
                onChange={(e) => setQcHeader(prev => ({ ...prev, lotNo: e.target.value }))}
                placeholder="e.g. LOT-2026-101"
              />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 800, mb: 0.5, color: 'text.secondary' }}>Batch Identification:</Typography>
              <TextField 
                size="small" 
                fullWidth 
                disabled={isReadOnly} 
                value={qcHeader.batch || ''} 
                onChange={(e) => setQcHeader(prev => ({ ...prev, batch: e.target.value }))}
                placeholder="e.g. B-01"
              />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 800, mb: 0.5, color: 'text.secondary' }}>Quantity (Bags):</Typography>
              <TextField 
                size="small" 
                fullWidth 
                disabled={isReadOnly} 
                value={qcHeader.quantity || ''} 
                onChange={(e) => setQcHeader(prev => ({ ...prev, quantity: e.target.value }))}
                placeholder="e.g. 500"
              />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 800, mb: 0.5, color: 'text.secondary' }}>Total Weight (MT):</Typography>
              <TextField 
                size="small" 
                fullWidth 
                disabled={isReadOnly} 
                value={qcHeader.totalWeight || ''} 
                onChange={(e) => setQcHeader(prev => ({ ...prev, totalWeight: e.target.value }))}
                placeholder="e.g. 25.0"
              />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 800, mb: 0.5, color: 'text.secondary' }}>Arrival / Receipt Date:</Typography>
              <TextField 
                size="small" 
                fullWidth 
                type="date"
                InputLabelProps={{ shrink: true }}
                disabled={isReadOnly} 
                value={qcHeader.receiptDate || ''} 
                onChange={(e) => setQcHeader(prev => ({ ...prev, receiptDate: e.target.value }))}
              />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 800, mb: 0.5, color: 'text.secondary' }}>Invoice Date:</Typography>
              <TextField 
                size="small" 
                fullWidth 
                type="date"
                InputLabelProps={{ shrink: true }}
                disabled={isReadOnly} 
                value={qcHeader.invoiceDate || ''} 
                onChange={(e) => setQcHeader(prev => ({ ...prev, invoiceDate: e.target.value }))}
              />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 800, mb: 0.5, color: 'text.secondary' }}>QC Analyst Name:</Typography>
              <TextField 
                size="small" 
                fullWidth 
                disabled={isReadOnly} 
                value={qcHeader.analyst || ''} 
                onChange={(e) => setQcHeader(prev => ({ ...prev, analyst: e.target.value }))}
                placeholder="QC Analyst Name"
              />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 800, mb: 0.5, color: 'text.secondary' }}>Inspection Date:</Typography>
              <TextField size="small" fullWidth disabled value={new Date().toISOString().split('T')[0]} />
            </Box>
          </Box>
        </ERPInformationCard>

        {/* Quality Inspection Decision & Status Option Buttons: HOLD, PENDING, APPROVE, RETURN */}
        <ERPInformationCard title="Quality Inspection Decision & Status">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              Select the quality inspection disposition decision for this arrived raw material lot. Click an option button to apply:
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 1.5 }}>
              {[
                { 
                  key: 'APPROVE', 
                  label: 'APPROVE', 
                  sub: 'Conforms to Specs (Pass)',
                  color: '#16a34a', 
                  bg: '#f0fdf4', 
                  border: '#86efac',
                  icon: '✓'
                },
                { 
                  key: 'HOLD', 
                  label: 'HOLD', 
                  sub: 'Quarantine / Retest Required',
                  color: '#d97706', 
                  bg: '#fffbeb', 
                  border: '#fcd34d',
                  icon: '⏸'
                },
                { 
                  key: 'PENDING', 
                  label: 'PENDING', 
                  sub: 'Awaiting Testing / Verification',
                  color: '#2563eb', 
                  bg: '#eff6ff', 
                  border: '#93c5fd',
                  icon: '⏳'
                },
                { 
                  key: 'RETURN', 
                  label: 'RETURN', 
                  sub: 'Reject & Mark for Return',
                  color: '#dc2626', 
                  bg: '#fef2f2', 
                  border: '#fca5a5',
                  icon: '↩'
                },
              ].map((opt) => {
                const isCurrent = (decisionStatus || qcHeader.status || 'PENDING') === opt.key;
                return (
                  <Button
                    key={opt.key}
                    disabled={isReadOnly}
                    onClick={() => {
                      setDecisionStatus(opt.key);
                      setQcHeader(prev => ({ ...prev, status: opt.key }));
                      setToast({ open: true, message: `Inspection status set to ${opt.key}`, severity: 'info' });
                    }}
                    variant={isCurrent ? 'contained' : 'outlined'}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      py: 1.5,
                      px: 1,
                      borderRadius: 2,
                      borderWidth: 2,
                      color: isCurrent ? '#ffffff' : opt.color,
                      backgroundColor: isCurrent ? opt.color : opt.bg,
                      borderColor: isCurrent ? opt.color : opt.border,
                      boxShadow: isCurrent ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                      transform: isCurrent ? 'scale(1.02)' : 'none',
                      transition: 'all 0.15s ease-in-out',
                      '&:hover': {
                        backgroundColor: isCurrent ? opt.color : '#ffffff',
                        borderColor: opt.color,
                        borderWidth: 2
                      }
                    }}
                  >
                    <Box sx={{ fontSize: 16, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <span>{opt.icon}</span>
                      <span>{opt.label}</span>
                    </Box>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        fontSize: 10, 
                        mt: 0.5, 
                        opacity: isCurrent ? 0.95 : 0.8, 
                        color: isCurrent ? '#ffffff' : 'text.secondary', 
                        textAlign: 'center' 
                      }}
                    >
                      {opt.sub}
                    </Typography>
                  </Button>
                );
              })}
            </Box>
          </Box>
        </ERPInformationCard>

        {/* Dynamic Parameter Tabs */}
        <ERPParameterTabs value={activeTab} onChange={setActiveTab} tabs={tabOrder} renderTabBody={renderTabBody} />

        {/* Photographic / Video / Document Evidence Card for Physical Details Test */}
        <ERPInformationCard title="Photographic / Video / Document Reference (Physical Test Quality)">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                Attach physical test quality evidence (photos of grains, seed appearance, moisture testing meters, sieve test video recordings, or official laboratory PDF test certificates). Attached references are automatically printed on the COA and IQR documents.
              </Typography>
              
              {!isReadOnly && (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    component="label"
                    size="small"
                    sx={{ 
                      backgroundColor: '#1e3a8a', 
                      color: '#fff', 
                      fontWeight: 700,
                      textTransform: 'none',
                      '&:hover': { backgroundColor: '#172554' } 
                    }}
                  >
                    📷 Upload Photo / Video / Doc
                    <input 
                      type="file" 
                      hidden 
                      multiple 
                      accept="image/*,video/*,.pdf,.doc,.docx"
                      onChange={handleFileUpload} 
                    />
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setShowAddEvidenceUrl(prev => !prev)}
                    sx={{ fontWeight: 700, textTransform: 'none' }}
                  >
                    🔗 + Add Link / URL
                  </Button>
                </Box>
              )}
            </Box>

            {/* URL Link Input Panel */}
            {showAddEvidenceUrl && !isReadOnly && (
              <Box sx={{ p: 2, backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e3a8a' }}>
                  Attach External Document / Image / Video Reference
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 140px' }, gap: 1.5 }}>
                  <TextField
                    size="small"
                    label="Reference Name / Title"
                    placeholder="e.g. Grain Appearance Test Photo"
                    value={newEvidenceName}
                    onChange={(e) => setNewEvidenceName(e.target.value)}
                  />
                  <TextField
                    size="small"
                    label="Direct URL / Link"
                    placeholder="https://... or /assets/..."
                    value={newEvidenceUrl}
                    onChange={(e) => setNewEvidenceUrl(e.target.value)}
                  />
                  <FormControl size="small">
                    <InputLabel id="ev-type-label">Type</InputLabel>
                    <Select
                      labelId="ev-type-label"
                      value={newEvidenceType}
                      label="Type"
                      onChange={(e) => setNewEvidenceType(e.target.value)}
                    >
                      <MenuItem value="image">Photo / Image</MenuItem>
                      <MenuItem value="video">Video Clip</MenuItem>
                      <MenuItem value="document">PDF / Document</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                  <TextField
                    size="small"
                    fullWidth
                    label="Physical Inspection Notes / Observations"
                    placeholder="e.g. Physical moisture color test, grain size verification"
                    value={newEvidenceNotes}
                    onChange={(e) => setNewEvidenceNotes(e.target.value)}
                  />
                  <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={handleAddUrlEvidence}
                    sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}
                  >
                    Attach Link
                  </Button>
                  <Button 
                    variant="outlined" 
                    color="secondary" 
                    onClick={() => setShowAddEvidenceUrl(false)}
                  >
                    Cancel
                  </Button>
                </Box>
              </Box>
            )}

            {/* Render Attached Evidence Cards */}
            {evidence.length > 0 ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2 }}>
                {evidence.map((item, idx) => {
                  const isImg = (item.mime_type && item.mime_type.startsWith('image/')) || item.type === 'image' || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(item.url || item.name || '');
                  const isVid = (item.mime_type && item.mime_type.startsWith('video/')) || item.type === 'video' || /\.(mp4|webm|mov|ogg)$/i.test(item.url || item.name || '');
                  return (
                    <Box
                      key={item.id || idx}
                      sx={{
                        border: '1px solid #cbd5e1',
                        borderRadius: 2,
                        p: 1.5,
                        backgroundColor: '#ffffff',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                        position: 'relative'
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box sx={{ pr: 2 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e3a8a', fontSize: 13 }}>
                            #{idx + 1} {item.name || 'Test Evidence'}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>
                            {item.type ? item.type.toUpperCase() : (isImg ? 'PHOTO' : isVid ? 'VIDEO' : 'DOCUMENT')}
                          </Typography>
                        </Box>
                        {!isReadOnly && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => handleRemoveEvidence(item.id)}
                            sx={{ minWidth: 26, width: 26, height: 26, p: 0, fontWeight: 900, borderRadius: 1 }}
                            title="Remove attachment"
                          >
                            ✕
                          </Button>
                        )}
                      </Box>

                      {item.notes && (
                        <Typography variant="caption" sx={{ color: '#475569', fontStyle: 'italic', display: 'block', backgroundColor: '#f8fafc', p: 0.75, borderRadius: 1 }}>
                          {item.notes}
                        </Typography>
                      )}

                      {isImg ? (
                        <Box sx={{ textAlign: 'center', backgroundColor: '#f1f5f9', borderRadius: 1, p: 1 }}>
                          <img
                            src={item.url}
                            alt={item.name}
                            style={{ maxWidth: '100%', maxHeight: '160px', objectFit: 'contain', borderRadius: 4 }}
                          />
                        </Box>
                      ) : isVid ? (
                        <Box sx={{ textAlign: 'center', backgroundColor: '#f1f5f9', borderRadius: 1, p: 1 }}>
                          <video
                            src={item.url}
                            controls
                            style={{ maxWidth: '100%', maxHeight: '160px', borderRadius: 4 }}
                          />
                        </Box>
                      ) : (
                        <Box sx={{ p: 2, textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: 1, border: '1px dashed #cbd5e1' }}>
                          <Typography sx={{ fontSize: 28, mb: 0.5 }}>📄</Typography>
                          <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontWeight: 700, fontSize: 12, wordBreak: 'break-all' }}>
                            View Attached Document
                          </a>
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            ) : (
              <Box sx={{ p: 3, textAlign: 'center', border: '1.5px dashed #cbd5e1', borderRadius: 2, backgroundColor: '#f8fafc' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  No photographic, video or document test evidence attached yet.
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                  Upload physical quality test images (grain appearance, moisture reading, infestation inspection) or video clips to display them in the COA and IQR print pages.
                </Typography>
              </Box>
            )}
          </Box>
        </ERPInformationCard>

        {/* Remarks Section */}
        <ERPRemarksCard title="Laboratory QA Remarks">
          <TextField
            fullWidth
            label="Lab QA Remarks"
            disabled={isReadOnly}
            value={labRemarks}
            onChange={(e) => setLabRemarks(e.target.value)}
            placeholder="Enter standard lab remarks, hold reasons, or notes..."
            multiline
            minRows={3}
            variant="outlined"
          />
        </ERPRemarksCard>

        {/* Add Parameter Dialog */}
        <Dialog open={showAddParamDialog} onClose={() => setShowAddParamDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 900, color: '#1e3a8a', borderBottom: '1px solid #e2e8f0' }}>
            + Add Parameter to {newParam.category || activeTab} Testing List
          </DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2.5 }}>
            <TextField
              label="Parameter Name (Mandatory)"
              size="small"
              fullWidth
              required
              value={newParam.parameter}
              onChange={(e) => setNewParam(prev => ({ ...prev, parameter: e.target.value }))}
              placeholder="e.g. Broken Grain %, Foreign Matter, Bulk Density"
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <FormControl size="small" fullWidth>
                <InputLabel id="dlg-cat-label">Category</InputLabel>
                <Select
                  labelId="dlg-cat-label"
                  value={newParam.category}
                  label="Category"
                  onChange={(e) => setNewParam(prev => ({ ...prev, category: e.target.value }))}
                >
                  <MenuItem value="Physical">Physical</MenuItem>
                  <MenuItem value="Chemical">Chemical</MenuItem>
                  <MenuItem value="Microbiology">Microbiology</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Test Method Reference"
                size="small"
                fullWidth
                value={newParam.method}
                onChange={(e) => setNewParam(prev => ({ ...prev, method: e.target.value }))}
                placeholder="e.g. IS 4333, Visual, AOAC"
              />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1.5 }}>
              <TextField
                label="Min Limit"
                size="small"
                type="number"
                value={newParam.min}
                onChange={(e) => setNewParam(prev => ({ ...prev, min: e.target.value }))}
                placeholder="e.g. 0"
              />
              <TextField
                label="Max Limit"
                size="small"
                type="number"
                value={newParam.max}
                onChange={(e) => setNewParam(prev => ({ ...prev, max: e.target.value }))}
                placeholder="e.g. 12"
              />
              <TextField
                label="Unit"
                size="small"
                value={newParam.unit}
                onChange={(e) => setNewParam(prev => ({ ...prev, unit: e.target.value }))}
                placeholder="e.g. %, g/L, ppm"
              />
            </Box>
            <TextField
              label="Specification / Standard Limit Description"
              size="small"
              fullWidth
              value={newParam.specification}
              onChange={(e) => setNewParam(prev => ({ ...prev, specification: e.target.value }))}
              placeholder="e.g. Max 12%, Absent, 750 - 880 g/L"
            />
            <TextField
              label="Observed / Actual Result (Optional)"
              size="small"
              fullWidth
              value={newParam.actualResult}
              onChange={(e) => setNewParam(prev => ({ ...prev, actualResult: e.target.value }))}
              placeholder="Enter actual test result if already tested"
            />
            <TextField
              label="Remarks / Quality Observation"
              size="small"
              fullWidth
              value={newParam.remarks}
              onChange={(e) => setNewParam(prev => ({ ...prev, remarks: e.target.value }))}
              placeholder="e.g. Meets FSSAI standard"
            />
          </DialogContent>
          <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0' }}>
            <Button onClick={() => setShowAddParamDialog(false)} color="secondary">
              Cancel
            </Button>
            <Button onClick={handleAddParameter} variant="contained" color="primary" sx={{ fontWeight: 800 }}>
              + Add Parameter
            </Button>
          </DialogActions>
        </Dialog>

        {/* Toast Alerts */}
        <Snackbar 
          open={toast.open} 
          autoHideDuration={4000} 
          onClose={() => setToast(prev => ({ ...prev, open: false }))}
        >
          <Alert severity={toast.severity} sx={{ width: '100%' }}>
            {toast.message}
          </Alert>
        </Snackbar>

        <Box sx={{ height: 20 }} />
      </Box>
    </ERPPageLayout>
  );
}
