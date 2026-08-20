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
  TableCell
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

const tabOrder = ['Physical', 'Chemical', 'Microbiology'];

const columns = [
  { key: 'parameter', label: 'Parameter', sx: { width: '20%' } },
  { key: 'method', label: 'Method', sx: { width: '10%' } },
  { key: 'min', label: 'Min Limit', sx: { width: '10%' } },
  { key: 'max', label: 'Max Limit', sx: { width: '10%' } },
  { key: 'actual', label: 'Current Limit (Manual Entry)', sx: { width: '18%' } },
  { key: 'unit', label: 'Unit', sx: { width: '8%' } },
  { key: 'status', label: 'Auto Result', sx: { width: '12%' } },
  { key: 'remarks', label: 'Remarks', sx: { width: '14%' } },
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

  const [itemsMaster, setItemsMaster] = useState([]);

  // 1. Load arrived stock lots & item master (including finished/unloaded ones to allow flexible audits or testing)
  useEffect(() => {
    if (!isReadOnly) {
      setLoading(true);
      setError('');
      Promise.all([
        api(`/masters/all/item_master`),
        api(`/qc/pending?all=true`)
      ])
      .then(([itemsRes, pendingRes]) => {
        // Parse item master
        const itemsData = itemsRes?.data || itemsRes || [];
        const itemsArr = Array.isArray(itemsData) ? itemsData : [];
        setItemsMaster(itemsArr);

        // Parse pending lots
        if (pendingRes?.success && Array.isArray(pendingRes?.data)) {
          const lotsData = pendingRes.data;
          setAllLots(lotsData);
          
          // Check if there are query parameters to pre-populate
          const qLotNo = qs.get('lotNo');
          if (qLotNo) {
            const matched = lotsData.find(l => l.lot_no === qLotNo);
            if (matched) {
              handleSelectPendingLotWithItems(matched, itemsArr);
            }
          } else if (lotsData.length > 0) {
            // Try to find first pending lot
            const firstPending = lotsData.find(l => !l.qc_status || l.qc_status === 'QC_PENDING');
            if (firstPending) {
              handleSelectPendingLotWithItems(firstPending, itemsArr);
            } else {
              handleSelectPendingLotWithItems(lotsData[0], itemsArr);
            }
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
            setQcHeader({
              qcId: data.qcId || data.id || '',
              purchaseId: data.purchaseId || '',
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
              unloadingStatus: data.unloadingStatus || data.unloading_status || '',
            });
            setQcResults(data.qcResults || []);
            setLabRemarks(data.remarks || '');
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

    setQcHeader({
      qcId: '',
      purchaseId: lot.purchase_id || '',
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

  const renderTabBody = (tabValue) => {
    const rows = qcResults.filter((r) => r.category === tabValue);

    if (rows.length === 0) {
      return (
        <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary', border: '1px dashed #ccc', borderRadius: 1 }}>
          No parameters defined for {tabValue} category. Please select a pending lot.
        </Box>
      );
    }

    return (
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
          </TableRow>
        )}
      />
    );
  };

  const onSave = () => {
    if (isReadOnly) return;
    if (!qcHeader.lotNo) {
      setToast({ open: true, message: 'Please select an arrived lot before saving.', severity: 'warning' });
      return;
    }

    setLoading(true);
    const payload = {
      qcHeader: {
        ...qcHeader,
        remarks: labRemarks,
        qcResults
      },
      summary: {
        overallResult: derived.overallResult,
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

          // Navigate to display or view report
          setTimeout(() => {
            navigate(`/entry/quality-control-display`);
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
    window.print();
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
            Overall QA Status
          </Box>
          <Box 
            sx={{ 
              mt: 1, 
              fontSize: 16, 
              fontWeight: 900, 
              textAlign: 'center', 
              py: 0.75, 
              borderRadius: 1,
              color: '#ffffff',
              backgroundColor: derived.overallResult === 'ACCEPTED' ? '#2e7d32' : derived.overallResult === 'REJECTED' ? '#d32f2f' : derived.overallResult === 'HOLD' ? '#ed6c02' : '#757575'
            }}
          >
            {derived.overallResult}
          </Box>
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
          {!!id && qcHeader.status !== 'ACCEPTED' && qcHeader.status !== 'PASS' && (
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

        {/* Dynamic Parameter Tabs */}
        <ERPParameterTabs value={activeTab} onChange={setActiveTab} tabs={tabOrder} renderTabBody={renderTabBody} />

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
