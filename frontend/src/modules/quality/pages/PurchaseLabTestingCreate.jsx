import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, TextField, MenuItem, Select, FormControl, InputLabel, CircularProgress, Alert, Snackbar, TableRow, TableCell } from '@mui/material';
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

import parameterTemplates from '../config/parameterTemplates';
import { buildQcDraftFromContext } from '../utils/qcWorkflow';
import { computeCategoryPassRate, computeOverallFromResults } from '../utils/qcCalculations';
import qualityApi from '../services/qualityApi';
import api from '../../../services/api';
import { printHtml } from '../../../utils/printHelper';

const tabOrder = ['Physical', 'Chemical', 'Microbiology'];

const columns = [
  { key: 'parameter', label: 'Parameter', sx: { width: '25%' } },
  { key: 'method', label: 'Method', sx: { width: '15%' } },
  { key: 'specification', label: 'Specification', sx: { width: '20%' } },
  { key: 'actual', label: 'Actual Result', sx: { width: '15%' } },
  { key: 'unit', label: 'Unit', sx: { width: '10%' } },
  { key: 'status', label: 'Auto Result', sx: { width: '15%' } },
  { key: 'remarks', label: 'Remarks', sx: { width: '20%' } },
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

function normalizeDateInput(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
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
    // If specification is text-based but actual is text, fallback to simple PASS for now if it contains matching word
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

export default function PurchaseLabTestingCreate() {
  const navigate = useNavigate();
  const { id } = useParams(); // Detect if we are in display/view mode for a saved QC ID
  const isReadOnly = !!id;

  const location = useLocation();
  const qs = new URLSearchParams(location.search);

  const [activeTab, setActiveTab] = useState('Physical');
  const [pendingLots, setPendingLots] = useState([]);
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
  });

  const [qcResults, setQcResults] = useState([]);
  const [labRemarks, setLabRemarks] = useState('');

  // 1. Load pending lots on mount (only for creation mode)
  useEffect(() => {
    if (!isReadOnly) {
      setLoading(true);
      api('/quality/pending')
        .then((res) => {
          if (res?.success && Array.isArray(res?.data)) {
            setPendingLots(res.data);
            
            // If query params are provided from another page, auto-select it
            const qLotNo = qs.get('lotNo');
            if (qLotNo) {
              const matched = res.data.find(l => l.lot_no === qLotNo);
              if (matched) {
                handleSelectPendingLot(matched);
              }
            }
          }
        })
        .catch((err) => {
          console.error('Failed to load pending lots:', err);
          setError('Failed to fetch pending laboratory lots.');
        })
        .finally(() => setLoading(false));
    }
  }, [isReadOnly, location.search]);

  // 2. Load existing record on mount (for display/read-only mode)
  useEffect(() => {
    if (isReadOnly) {
      setLoadingHistory(true);
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
              receiptDate: normalizeDateInput(data.receipt_date),
              invoiceDate: normalizeDateInput(data.invoice_date),
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

  // Handle choosing a pending lot from dropdown
  const handleSelectPendingLot = (lot) => {
    if (!lot) return;
    
    // Attempt to map item name to our parameter templates keys
    let matchedProductKey = 'Rice';
    const itemNameLower = String(lot.item_name || '').toLowerCase();
    if (itemNameLower.includes('wheat')) matchedProductKey = 'Wheat';
    else if (itemNameLower.includes('bengal') || itemNameLower.includes('gram') || itemNameLower.includes('chana')) matchedProductKey = 'BengalGram';
    else if (itemNameLower.includes('urad')) matchedProductKey = 'Urad';

    setQcHeader({
      qcId: '',
      purchaseId: lot.purchase_id || '',
      lotNo: lot.lot_no || '',
      supplier: lot.supplier_name || '',
      item: lot.item_name || '',
      batch: lot.lot_no || '', // fall back to lot_no for batch if empty
      analyst: 'QC Engineer',
      remarks: '',
      quantity: lot.received_qty || '',
      unitWeight: lot.unit_weight || '',
      totalWeight: lot.total_weight || '',
      receiptDate: normalizeDateInput(lot.receipt_date),
      invoiceDate: normalizeDateInput(lot.invoice_date),
    });

    // Initialize qcResults from the product template
    const template = parameterTemplates[matchedProductKey] || parameterTemplates.Rice;
    const initialResults = [];

    // Pre-populate parameter results for Physical, Chemical, Microbiology
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

    setQcResults(initialResults);
    setSelectedLotId(lot.stock_lot_id || '');
    setLabRemarks('');
  };

  const handleDropdownChange = (e) => {
    const val = e.target.value;
    setSelectedLotId(val);
    const lot = pendingLots.find(l => l.stock_lot_id === val);
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
            <TableCell style={{ fontWeight: 700, padding: '10px 12px' }}>{row.parameter}</TableCell>
            <TableCell style={{ padding: '10px 12px' }}>{row.method || '-'}</TableCell>
            <TableCell style={{ padding: '10px 12px' }}>{formatSpecification(row)}</TableCell>
            <TableCell style={{ padding: '10px 12px' }}>
              <TextField
                size="small"
                value={row.actualResult || ''}
                disabled={isReadOnly}
                onChange={(e) => updateRow(row.parameterKey, { actualResult: e.target.value })}
                placeholder="Enter result..."
                fullWidth
                variant="outlined"
              />
            </TableCell>
            <TableCell style={{ padding: '10px 12px' }}>{row.unit || '-'}</TableCell>
            <TableCell style={{ padding: '10px 12px' }}>
              <Box 
                sx={{ 
                  fontWeight: 900, 
                  fontSize: 13,
                  color: row.status === 'PASS' ? '#2e7d32' : row.status === 'FAIL' ? '#d32f2f' : '#ed6c02',
                  backgroundColor: row.status === 'PASS' ? '#e8f5e9' : row.status === 'FAIL' ? '#ffebee' : '#fff3e0',
                  textAlign: 'center',
                  py: 0.5,
                  borderRadius: 1
                }}
              >
                {row.status}
              </Box>
            </TableCell>
            <TableCell style={{ padding: '10px 12px' }}>
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
      setToast({ open: true, message: 'Please select a pending lot before saving.', severity: 'warning' });
      return;
    }

    setLoading(true);
    const payload = {
      qcHeader: {
        ...qcHeader,
        remarks: labRemarks,
        qcResults,
      },
      summary: derived,
    };

    qualityApi.saveQc({ qcId: id, payload })
      .then((res) => {
        if (res?.success) {
          setToast({ open: true, message: 'QC laboratory inspection saved successfully!', severity: 'success' });
          setTimeout(() => {
            navigate('/quality/dashboard');
          }, 1500);
        } else {
          setToast({ open: true, message: res?.message || 'Failed to save QC record.', severity: 'error' });
        }
      })
      .catch((err) => {
        console.error('Error saving QC:', err);
        setToast({ open: true, message: 'Server error saving laboratory testing details.', severity: 'error' });
      })
      .finally(() => setLoading(false));
  };

  const onClear = () => {
    if (isReadOnly) return;
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
    navigate(`/quality/iqr-display/${targetId}`);
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
    const resultsRows = Object.entries(tableState).flatMap(([cat, rows]) => 
      rows.map(r => `
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 600;">${r.parameter || '-'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">${cat}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">${r.method || 'Standard'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center;">${formatSpecification(r)}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; font-weight: bold;">${r.actual || '-'} ${r.unit || ''}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; font-weight: 800; color: ${r.status === 'FAIL' ? '#dc2626' : '#16a34a'};">${r.status || 'PENDING'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-size: 11px;">${r.remarks || '-'}</td>
        </tr>
      `)
    ).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; color: #0f172a; padding: 15px;">
        <div style="text-align: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 15px;">
          <h2 style="margin: 0; color: #1e3a8a; font-size: 20px;">BVC FOODS LABORATORY DIVISION</h2>
          <p style="margin: 3px 0 0; font-size: 12px; color: #475569; font-weight: 600;">PURCHASE INWARD LAB TESTING REPORT</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-bottom: 15px; font-size: 12px;">
          <div><strong>Lab Test ID:</strong> ${qcHeader.qcId || id || 'Draft'}</div>
          <div><strong>Test Date:</strong> ${qcHeader.receiptDate || new Date().toISOString().split('T')[0]}</div>
          <div><strong>Lot Number:</strong> <span style="font-weight: 800; color: #1e3a8a;">${qcHeader.lotNo || '-'}</span></div>
          <div><strong>Product / Item:</strong> ${qcHeader.item || '-'}</div>
          <div><strong>Supplier:</strong> ${qcHeader.supplier || '-'}</div>
          <div><strong>Batch / Ref:</strong> ${qcHeader.batch || '-'}</div>
          <div><strong>Quantity:</strong> ${qcHeader.quantity || '-'} bags (${qcHeader.totalWeight || '-'} kg)</div>
          <div><strong>Analyst:</strong> ${qcHeader.analyst || 'QC Chemist'}</div>
          <div><strong>Overall Result:</strong> <span style="font-weight: 800; color: ${derived.overall === 'REJECTED' || derived.overall === 'FAIL' ? '#dc2626' : '#16a34a'};">${derived.overall}</span></div>
          <div><strong>Pass Rate:</strong> Physical: ${derived.physicalPass}%, Chemical: ${derived.chemicalPass}%, Micro: ${derived.microPass}%</div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
          <thead>
            <tr style="background: #1e3a8a; color: white;">
              <th style="border: 1px solid #1e3a8a; padding: 8px 10px; text-align: left;">Parameter</th>
              <th style="border: 1px solid #1e3a8a; padding: 8px 10px; text-align: left;">Category</th>
              <th style="border: 1px solid #1e3a8a; padding: 8px 10px; text-align: left;">Method</th>
              <th style="border: 1px solid #1e3a8a; padding: 8px 10px; text-align: center;">Specification</th>
              <th style="border: 1px solid #1e3a8a; padding: 8px 10px; text-align: center;">Actual Result</th>
              <th style="border: 1px solid #1e3a8a; padding: 8px 10px; text-align: center;">Status</th>
              <th style="border: 1px solid #1e3a8a; padding: 8px 10px; text-align: left;">Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${resultsRows || '<tr><td colspan="7" style="text-align:center; padding: 15px;">No parameters recorded</td></tr>'}
          </tbody>
        </table>

        ${qcHeader.remarks ? `
          <div style="border: 1px solid #cbd5e1; border-radius: 4px; padding: 10px; margin-bottom: 20px; font-size: 12px; background: #fff;">
            <strong>Analyst Remarks:</strong>
            <p style="margin: 4px 0 0; color: #334155;">${qcHeader.remarks}</p>
          </div>
        ` : ''}

        <div style="display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; border-top: 1px dashed #cbd5e1; font-size: 12px;">
          <div style="text-align: center; width: 180px;">
            <div style="height: 35px;"></div>
            <div style="border-top: 1px solid #0f172a; padding-top: 4px; font-weight: bold;">Lab Chemist</div>
          </div>
          <div style="text-align: center; width: 180px;">
            <div style="height: 35px;"></div>
            <div style="border-top: 1px solid #0f172a; padding-top: 4px; font-weight: bold;">QA Officer</div>
          </div>
          <div style="text-align: center; width: 180px;">
            <div style="height: 35px;"></div>
            <div style="border-top: 1px solid #0f172a; padding-top: 4px; font-weight: bold;">Lab In-Charge</div>
          </div>
        </div>
      </div>
    `;

    printHtml(html, `Lab Test Report - ${qcHeader.lotNo || 'Report'}`);
  };

  const onExit = () => {
    navigate('/quality/dashboard');
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
            { label: 'Quality Module', isCurrent: false },
            { label: 'Purchase Lab Testing', isCurrent: false },
            { label: isReadOnly ? 'Display / Read-Only' : 'Create / Lab Entry', isCurrent: true },
          ]}
        />
      }
      header={<ERPHeader title={isReadOnly ? `Purchase Lab Testing Details (Read-Only) – ${qcHeader.lotNo}` : "Purchase Lab Testing – Master QA Entry"} />}
      rightSlot={summaryCard}
      childrenBottom={
        <ERPActionBar>
          {!isReadOnly && (
            <Button variant="contained" color="primary" onClick={onSave} disabled={loading}>
              {loading ? 'Saving...' : 'Save Lab Record'}
            </Button>
          )}
          {!isReadOnly && (
            <Button variant="outlined" color="secondary" onClick={onClear}>
              Clear
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
        {!isReadOnly && pendingLots.length > 0 && (
          <ERPInformationCard title="Pending Quality Control Queue">
            <FormControl fullWidth size="small">
              <InputLabel id="pending-lot-label">Select Incoming Lot from Purchase</InputLabel>
              <Select
                labelId="pending-lot-label"
                value={selectedLotId}
                label="Select Incoming Lot from Purchase"
                onChange={handleDropdownChange}
              >
                {pendingLots.map((lot) => (
                  <MenuItem key={lot.stock_lot_id} value={lot.stock_lot_id}>
                    {lot.lot_no} – {lot.item_name} ({lot.supplier_name}) – Qty: {lot.received_qty}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
              gap: 1.5,
              fontSize: 14
            }}
          >
            <Box>
              <b>QC / Lab ID:</b> {qcHeader.qcId || 'Draft'}
            </Box>
            <Box>
              <b>Purchase Ref ID:</b> {qcHeader.purchaseId || '-'}
            </Box>
            <Box>
              <b>Supplier Name:</b> {qcHeader.supplier || '-'}
            </Box>
            <Box>
              <b>Product / Item:</b> {qcHeader.item || '-'}
            </Box>
            <Box>
              <b>Raw Material Lot No:</b> {qcHeader.lotNo || '-'}
            </Box>
            <Box>
              <b>Batch Identification:</b> {qcHeader.batch || '-'}
            </Box>
            <Box>
              <b>Quantity (Bags):</b> {qcHeader.quantity || '-'}
            </Box>
            <Box>
              <b>Weight:</b> {qcHeader.totalWeight ? `${qcHeader.totalWeight} MT` : (qcHeader.unitWeight ? `Unit: ${qcHeader.unitWeight} kg` : '-')}
            </Box>
            <Box>
              <b>Arrival / Receipt Date:</b> {qcHeader.receiptDate || '-'}
            </Box>
            <Box>
              <b>Invoice Date:</b> {qcHeader.invoiceDate || '-'}
            </Box>
            <Box>
              <b>Analyst Name:</b> {isReadOnly ? qcHeader.analyst : (
                <TextField 
                  size="small" 
                  value={qcHeader.analyst}
                  onChange={(e) => setQcHeader(prev => ({ ...prev, analyst: e.target.value }))}
                  sx={{ width: 200 }}
                />
              )}
            </Box>
            <Box>
              <b>Inspection Date:</b> {new Date().toISOString().split('T')[0]}
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
