import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  TextField,
  MenuItem,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  CircularProgress,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  FormControlLabel,
  Switch
} from '@mui/material';
import {
  Search as SearchIcon,
  RestartAlt as ResetIcon,
  FileDownload as ExcelIcon,
  Print as PrintIcon,
  Lock as LockIcon,
  VerifiedUser as VerifiedIcon,
  Save as SaveIcon,
  Sync as SyncIcon,
  WarningAmber as WarningIcon,
  FactCheck as FactCheckIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { printHtml } from '../../utils/printHelper';
import StockMovementDrilldownModal from './StockMovementDrilldownModal';

const AS_OF_TIME_PRESETS = [
  { value: '23:59:59', label: 'Current / End of Day (23:59:59)' },
  { value: '09:00:00', label: 'Morning Shift (09:00 AM)' },
  { value: '11:30:00', label: 'Mid-Morning (11:30 AM)' },
  { value: '14:00:00', label: 'Afternoon (02:00 PM)' },
  { value: '16:30:00', label: 'Evening (04:30 PM)' },
  { value: 'CUSTOM', label: 'Custom Time...' }
];

const STOCK_CATEGORIES = [
  { id: 'ALL', label: 'All Stock' },
  { id: 'RM', label: 'RM Stock' },
  { id: 'FG', label: 'FG Stock' },
  { id: 'Bag Material', label: 'Bag Material' },
  { id: 'Vacuum Material', label: 'Vacuum Material' },
  { id: 'Wastage', label: 'Wastage Stock' },
  { id: 'Cold Storage', label: 'Cold Storage' }
];

const REPORT_TITLES = {
  opening: 'DAILY OPENING STOCK REGISTER',
  current: 'CURRENT STOCK POSITION REPORT',
  closing: 'DAILY CLOSING STOCK REGISTER',
  reconciliation: 'STOCK LEDGER RECONCILIATION REPORT'
};

const fmtNum = (val, decimals = 2) => {
  const n = Number(val || 0);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : Math.min(decimals, 2),
    maximumFractionDigits: decimals
  });
};

const statusChipColor = (status) => {
  const s = String(status || '').toUpperCase();
  if (s === 'APPROVED_LOCKED' || s === 'MATCHED') return { bg: '#dcfce7', fg: '#166534' };
  if (s === 'VERIFIED') return { bg: '#dbeafe', fg: '#1e40af' };
  if (s === 'DRAFT' || s === 'PREVIEW') return { bg: '#fef3c7', fg: '#92400e' };
  if (s === 'VARIANCE' || s === 'NEGATIVE_STOCK' || s === 'OVER_RESERVED') return { bg: '#fee2e2', fg: '#991b1b' };
  return { bg: '#f1f5f9', fg: '#334155' };
};

const StockRegisterPanel = ({ mode = 'current', hideHeader = false }) => {
  const auth = useAuth() || {};
  const todayIso = new Date().toISOString().slice(0, 10);

  const [meta, setMeta] = useState({
    company: { id: null, name: 'BVC Exports Pvt Ltd' },
    financialYears: [],
    godowns: [],
    suppliers: []
  });

  // Filters
  const [stockDate, setStockDate] = useState(todayIso);
  const [asOfPreset, setAsOfPreset] = useState('23:59:59');
  const [customTime, setCustomTime] = useState('14:00');
  const [financialYear, setFinancialYear] = useState(auth.financialYear || '');
  const [stockCategory, setStockCategory] = useState('ALL');
  const [godownName, setGodownName] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [rmLotNo, setRmLotNo] = useState('');
  const [fgLotNo, setFgLotNo] = useState('');
  const [search, setSearch] = useState('');
  const [stockStatus, setStockStatus] = useState('ALL');
  const [varianceOnly, setVarianceOnly] = useState(false);

  // Data state
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Closing editable physical counts map keyed by identity_key
  const [countEdits, setCountEdits] = useState({});

  // Confirm Dialog + Snackbar
  const [confirmDlg, setConfirmDlg] = useState({ open: false, title: '', message: '', onConfirm: null });
  const [toast, setToast] = useState({ open: false, severity: 'success', message: '' });

  // Drill-down Modal
  const [drilldown, setDrilldown] = useState({ open: false, row: null });

  const effectiveAsOfTime = asOfPreset === 'CUSTOM'
    ? (customTime && customTime.length === 5 ? `${customTime}:00` : (customTime || '23:59:59'))
    : asOfPreset;

  // Load filter metadata (company name, FYs, godowns, suppliers)
  const loadFilters = useCallback(async () => {
    try {
      const res = await api.get('/stock-reports/filters');
      if (res && res.success !== false) {
        const rawFys = Array.isArray(res.financialYears) ? res.financialYears : [];
        const fyMap = new Map();
        rawFys.forEach((f) => {
          const fyName = String(f?.financial_year || f?.year_name || '').trim();
          if (!fyName) return;
          if (!fyMap.has(fyName)) {
            fyMap.set(fyName, { ...f, financial_year: fyName });
          } else if (f?.is_active) {
            fyMap.get(fyName).is_active = f.is_active;
          }
        });
        const uniqueFys = Array.from(fyMap.values());

        setMeta({
          company: res.company || { id: null, name: 'Company' },
          financialYears: uniqueFys,
          godowns: Array.isArray(res.godowns) ? res.godowns : [],
          suppliers: Array.isArray(res.suppliers) ? res.suppliers : []
        });
        if (!financialYear && uniqueFys.length > 0) {
          const activeFy = uniqueFys.find(f => f.is_active) || uniqueFys[0];
          if (activeFy?.financial_year) {
            setFinancialYear(activeFy.financial_year);
          }
        }
      }
    } catch (e) {
      console.error('Error loading stock report filters:', e);
    }
  }, [financialYear]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let endpoint = '/stock-reports/current';
      const params = {
        financialYear: financialYear || undefined,
        stockCategory,
        godownName: godownName || undefined,
        supplierName: supplierName || undefined,
        rmLotNo: rmLotNo || undefined,
        fgLotNo: fgLotNo || undefined,
        search: search || undefined
      };

      if (mode === 'opening') {
        endpoint = '/stock-reports/opening';
        params.stockDate = stockDate;
        params.stockStatus = stockStatus;
      } else if (mode === 'current') {
        endpoint = '/stock-reports/current';
        params.stockDate = stockDate;
        params.asOfTime = effectiveAsOfTime;
        params.stockStatus = stockStatus;
      } else if (mode === 'closing') {
        endpoint = '/stock-reports/closing';
        params.closingDate = stockDate;
        params.cutoffTime = effectiveAsOfTime;
        params.varianceOnly = varianceOnly ? 'true' : 'false';
      } else if (mode === 'reconciliation') {
        endpoint = '/stock-reports/reconciliation';
        params.varianceOnly = varianceOnly ? 'true' : 'false';
      }

      const res = await api.get(endpoint, { params });
      if (res && res.success === false) {
        setError(res.message || 'Failed to load stock register.');
        setReportData(null);
      } else {
        setReportData(res);
        setPage(0);
        if (mode === 'closing' && Array.isArray(res?.rows)) {
          const initEdits = {};
          res.rows.forEach((r) => {
            initEdits[r.identity_key] = {
              line_id: r.id || null,
              identity_key: r.identity_key,
              physical_count_qty: r.physical_count_qty ?? '',
              physical_count_weight: r.physical_count_weight ?? '',
              variance_reason: r.variance_reason || ''
            };
          });
          setCountEdits(initEdits);
        }
      }
    } catch (err) {
      setError(err?.message || 'Error fetching stock register.');
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [
    mode,
    stockDate,
    effectiveAsOfTime,
    financialYear,
    stockCategory,
    godownName,
    supplierName,
    rmLotNo,
    fgLotNo,
    search,
    stockStatus,
    varianceOnly
  ]);

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  useEffect(() => {
    const handleEvent = () => {
      loadFilters();
      fetchReport();
    };
    window.addEventListener('erp_stock_updated', handleEvent);
    window.addEventListener('erp_company_changed', handleEvent);
    return () => {
      window.removeEventListener('erp_stock_updated', handleEvent);
      window.removeEventListener('erp_company_changed', handleEvent);
    };
  }, [loadFilters, fetchReport]);

  const handleReset = () => {
    setStockDate(todayIso);
    setAsOfPreset('23:59:59');
    setStockCategory('ALL');
    setGodownName('');
    setSupplierName('');
    setRmLotNo('');
    setFgLotNo('');
    setSearch('');
    setStockStatus('ALL');
    setVarianceOnly(false);
    setPage(0);
  };

  // Opening Snapshot Actions
  const runOpeningSnapshot = async (approve) => {
    setActionLoading(true);
    try {
      const res = await api.post('/stock-reports/opening/generate', {
        stockDate,
        financialYear: financialYear || null,
        approve
      });
      if (res?.success === false) {
        setToast({ open: true, severity: 'error', message: res.message || 'Failed to save opening snapshot.' });
      } else {
        setReportData(res);
        setToast({
          open: true,
          severity: 'success',
          message: approve ? 'Opening stock snapshot approved and locked.' : 'Opening stock draft saved.'
        });
      }
    } catch (e) {
      setToast({ open: true, severity: 'error', message: e?.message || 'Operation failed.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Closing Workflow Actions
  const handleClosingDraft = async () => {
    setActionLoading(true);
    try {
      const res = await api.post('/stock-reports/closing/draft', {
        closingDate: stockDate,
        financialYear: financialYear || null,
        cutoffTime: effectiveAsOfTime
      });
      if (res?.success === false) {
        setToast({ open: true, severity: 'error', message: res.message || 'Failed to generate closing draft.' });
      } else {
        setToast({ open: true, severity: 'success', message: 'Daily closing draft generated/refreshed.' });
        fetchReport();
      }
    } catch (e) {
      setToast({ open: true, severity: 'error', message: e?.message || 'Error generating closing draft.' });
    } finally {
      setActionLoading(false);
    }
  };

  const ensureClosingIdAndSaveCounts = async () => {
    setActionLoading(true);
    try {
      let closingId = reportData?.header?.id;
      if (!closingId) {
        const draftRes = await api.post('/stock-reports/closing/draft', {
          closingDate: stockDate,
          financialYear: financialYear || null,
          cutoffTime: effectiveAsOfTime
        });
        if (draftRes?.success === false || !draftRes?.header?.id) {
          setToast({ open: true, severity: 'error', message: draftRes?.message || 'Create closing draft first.' });
          return;
        }
        closingId = draftRes.header.id;
      }

      const linesPayload = Object.values(countEdits).map((c) => ({
        line_id: c.line_id || undefined,
        identity_key: c.identity_key,
        physical_count_qty: c.physical_count_qty === '' ? null : Number(c.physical_count_qty),
        physical_count_weight: c.physical_count_weight === '' ? null : Number(c.physical_count_weight),
        variance_reason: c.variance_reason || ''
      }));

      const res = await api.post(`/stock-reports/closing/${closingId}/physical-count`, {
        lines: linesPayload
      });
      if (res?.success === false) {
        setToast({ open: true, severity: 'error', message: res.message || 'Failed to save physical counts.' });
      } else {
        setToast({ open: true, severity: 'success', message: 'Physical counts & variances saved.' });
        fetchReport();
      }
    } catch (e) {
      setToast({ open: true, severity: 'error', message: e?.message || 'Error saving physical counts.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyClosing = async () => {
    const closingId = reportData?.header?.id;
    if (!closingId) {
      setToast({ open: true, severity: 'warning', message: 'Please generate/save a Closing Draft first.' });
      return;
    }
    setActionLoading(true);
    try {
      const res = await api.post(`/stock-reports/closing/${closingId}/verify`, {});
      if (res?.success === false) {
        setToast({ open: true, severity: 'error', message: res.message || 'Verification failed.' });
      } else {
        setToast({ open: true, severity: 'success', message: 'Closing register verified.' });
        fetchReport();
      }
    } catch (e) {
      setToast({ open: true, severity: 'error', message: e?.message || 'Error verifying closing.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveLockClosing = async () => {
    const closingId = reportData?.header?.id;
    if (!closingId) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/stock-reports/closing/${closingId}/approve`, {});
      if (res?.success === false) {
        setToast({ open: true, severity: 'error', message: res.message || 'Approval failed.' });
      } else {
        setToast({ open: true, severity: 'success', message: 'Daily closing approved, variances posted, and register locked.' });
        fetchReport();
      }
    } catch (e) {
      setToast({ open: true, severity: 'error', message: e?.message || 'Error approving closing.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReconciliationSync = async () => {
    setActionLoading(true);
    try {
      const res = await api.post('/stock-reports/reconciliation/sync', {
        financialYear: financialYear || null
      });
      if (res?.success === false) {
        setToast({ open: true, severity: 'error', message: res.message || 'Reconciliation sync failed.' });
      } else {
        setToast({ open: true, severity: 'success', message: 'Non-destructive backfill sync complete.' });
        setReportData(res);
      }
    } catch (e) {
      setToast({ open: true, severity: 'error', message: e?.message || 'Error running sync.' });
    } finally {
      setActionLoading(false);
    }
  };

  const rows = Array.isArray(reportData?.rows) ? reportData.rows : [];
  const paginatedRows = rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  // Category filter on reconciliation rows client-side if stockCategory selected
  const displayedRows = mode === 'reconciliation' && stockCategory !== 'ALL'
    ? rows.filter((r) => {
        if (stockCategory === 'Cold Storage') return r.storage_type === 'Cold Storage' || r.stock_category === 'Cold Storage';
        return r.stock_category === stockCategory;
      })
    : rows;
  const pagedRows = mode === 'reconciliation'
    ? displayedRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
    : paginatedRows;

  // Exports
  const handleExportExcel = () => {
    if (!displayedRows.length) return;
    let exportRows = [];
    if (mode === 'opening') {
      exportRows = displayedRows.map((r) => ({
        'S.No': r.sno,
        'Stock Category': r.display_category || r.stock_category,
        'Item Code': r.item_code || '',
        'Item Name': r.item_name,
        'Supplier Name': r.supplier_name || '',
        'Supplier Invoice No.': r.supplier_invoice_no || '',
        'RM Lot No.': r.rm_lot_no || '',
        'FG Lot No.': r.fg_lot_no || '',
        'Parent Lot No.': r.parent_lot_no || '',
        'Godown Name': r.godown_name || '',
        'UOM': r.uom || 'Bags',
        'Prev Closing Qty': r.prev_closing_qty || 0,
        'Prev Closing Wt (KG)': r.prev_closing_weight || 0,
        'Opening Adj (+/-) Qty': r.opening_adjustment_qty || 0,
        'Opening Stock Qty': r.opening_qty || 0,
        'Opening Stock Wt (KG)': r.opening_weight || 0,
        'Stock Status': r.stock_status || 'Available',
        'Remarks': r.remarks || ''
      }));
    } else if (mode === 'current') {
      exportRows = displayedRows.map((r) => ({
        'S.No': r.sno,
        'Stock Category': r.display_category || r.stock_category,
        'Item Code': r.item_code || '',
        'Item Name': r.item_name,
        'Supplier': r.supplier_name || '',
        'Invoice No.': r.supplier_invoice_no || '',
        'RM Lot No.': r.rm_lot_no || '',
        'FG Lot No.': r.fg_lot_no || '',
        'Parent Lot No.': r.parent_lot_no || '',
        'Godown': r.godown_name || '',
        'UOM': r.uom || 'Bags',
        'Opening Qty': r.opening_qty || 0,
        'Total In Qty': r.total_in_qty || 0,
        'Total Available Qty': r.total_available_qty || 0,
        'Total Out Qty': r.total_out_qty || 0,
        'Current Balance Qty': r.current_balance_qty || 0,
        'Current Balance Wt (KG)': r.current_balance_weight || 0,
        'Reserved Qty': r.reserved_qty || 0,
        'Available Stock Qty': r.available_stock_qty || 0,
        'Stock Status': r.warning_flag || r.stock_status || 'Available'
      }));
    } else if (mode === 'closing') {
      exportRows = displayedRows.map((r) => ({
        'S.No': r.sno,
        'Stock Category': r.display_category || r.stock_category,
        'Item Code': r.item_code || '',
        'Item Name': r.item_name,
        'Supplier': r.supplier_name || '',
        'RM Lot No.': r.rm_lot_no || '',
        'FG Lot No.': r.fg_lot_no || '',
        'Parent Lot No.': r.parent_lot_no || '',
        'Godown': r.godown_name || '',
        'UOM': r.uom || 'Bags',
        'Opening Qty': r.opening_qty || 0,
        'Total In Qty': r.total_in_qty || 0,
        'Total Out Qty': r.total_out_qty || 0,
        'System Closing Qty': r.system_closing_qty || 0,
        'System Closing Wt (KG)': r.system_closing_weight || 0,
        'Physical Count Qty': r.physical_count_qty ?? '',
        'Physical Count Wt (KG)': r.physical_count_weight ?? '',
        'Variance Qty': r.variance_qty || 0,
        'Variance Reason': r.variance_reason || '',
        'Final Closing Qty': r.final_closing_qty || 0,
        'Final Closing Wt (KG)': r.final_closing_weight || 0,
        'Status': r.line_status || r.closing_status || reportData?.status || 'PREVIEW'
      }));
    } else {
      exportRows = displayedRows.map((r, idx) => ({
        'S.No': idx + 1,
        'Stock Category': r.stock_category || '',
        'Item Name': r.item_name || '',
        'Lot No': r.lot_no || '',
        'Godown': r.godown_name || '',
        'Movement Ledger Qty': r.movement_qty || 0,
        'Movement Wt (KG)': r.movement_weight || 0,
        'Legacy Stock Qty': r.legacy_stock_qty || 0,
        'Legacy Lot Qty': r.legacy_lot_qty || 0,
        'Variance vs Stock': r.variance_vs_stock || 0,
        'Variance vs Lots': r.variance_vs_lots || 0,
        'Status': r.status || 'MATCHED'
      }));
    }

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, mode.toUpperCase());
    XLSX.writeFile(wb, `BVC_${mode}_stock_${stockDate}.xlsx`);
  };

  const handleExportCsv = async () => {
    try {
      const token = localStorage.getItem('erp_token');
      const compId = localStorage.getItem('erp_company_id');
      const qs = new URLSearchParams({
        type: mode === 'reconciliation' ? 'current' : mode,
        format: 'csv',
        stockDate,
        closingDate: stockDate,
        asOfTime: effectiveAsOfTime,
        financialYear: financialYear || '',
        stockCategory,
        godownName,
        supplierName,
        rmLotNo,
        fgLotNo,
        search,
        stockStatus,
        varianceOnly: varianceOnly ? 'true' : 'false'
      });
      const res = await fetch(`/api/stock-reports/export?${qs.toString()}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(compId ? { 'X-Company-Id': compId } : {})
        }
      });
      if (!res.ok) throw new Error('CSV export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BVC_${mode}_stock_${stockDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setToast({ open: true, severity: 'error', message: e?.message || 'Failed to download CSV.' });
    }
  };

  const handlePrint = () => {
    const title = REPORT_TITLES[mode] || 'STOCK REGISTER';
    const companyName = meta.company?.name || 'BVC Exports Pvt Ltd';
    const userLabel = auth.user?.username || auth.user?.name || 'admin';
    const nowStr = new Date().toLocaleString('en-IN');

    let cols = [];
    if (mode === 'opening') {
      cols = ['S.No', 'Category', 'Item Name', 'Supplier', 'RM Lot', 'FG Lot', 'Godown', 'UOM', 'Prev Closing Qty', 'Adj Qty', 'Opening Qty', 'Opening Wt (KG)', 'Status'];
    } else if (mode === 'current') {
      cols = ['S.No', 'Category', 'Item Name', 'RM Lot', 'FG Lot', 'Godown', 'Opening', 'Total In', 'Total Out', 'Current Bal Qty', 'Current Bal Wt (KG)', 'Reserved Qty', 'Available Qty', 'Status'];
    } else if (mode === 'closing') {
      cols = ['S.No', 'Category', 'Item Name', 'RM Lot', 'FG Lot', 'Godown', 'Opening', 'Total In', 'Total Out', 'System Qty', 'Physical Qty', 'Variance Qty', 'Final Closing Qty', 'Final Wt (KG)'];
    } else {
      cols = ['S.No', 'Category', 'Item Name', 'Lot No', 'Godown', 'Ledger Qty', 'Legacy Stock Qty', 'Legacy Lot Qty', 'Var vs Lots', 'Status'];
    }

    const thHtml = cols.map(c => `<th style="border:1px solid #cbd5e1;padding:6px;background:#0f172a;color:#fff;font-size:10px;text-align:left;">${c}</th>`).join('');
    const bodyHtml = displayedRows.map((r, idx) => {
      let vals = [];
      if (mode === 'opening') {
        vals = [r.sno, r.display_category || r.stock_category, r.item_name, r.supplier_name || '—', r.rm_lot_no || '—', r.fg_lot_no || '—', r.godown_name, r.uom, fmtNum(r.prev_closing_qty), fmtNum(r.opening_adjustment_qty), fmtNum(r.opening_qty), fmtNum(r.opening_weight), r.stock_status];
      } else if (mode === 'current') {
        vals = [r.sno, r.display_category || r.stock_category, r.item_name, r.rm_lot_no || '—', r.fg_lot_no || '—', r.godown_name, fmtNum(r.opening_qty), fmtNum(r.total_in_qty), fmtNum(r.total_out_qty), fmtNum(r.current_balance_qty), fmtNum(r.current_balance_weight), fmtNum(r.reserved_qty), fmtNum(r.available_stock_qty), r.warning_flag || r.stock_status];
      } else if (mode === 'closing') {
        vals = [r.sno, r.display_category || r.stock_category, r.item_name, r.rm_lot_no || '—', r.fg_lot_no || '—', r.godown_name, fmtNum(r.opening_qty), fmtNum(r.total_in_qty), fmtNum(r.total_out_qty), fmtNum(r.system_closing_qty), r.physical_count_qty ?? '—', fmtNum(r.variance_qty), fmtNum(r.final_closing_qty), fmtNum(r.final_closing_weight)];
      } else {
        vals = [idx + 1, r.stock_category, r.item_name, r.lot_no || '—', r.godown_name || '—', fmtNum(r.movement_qty), fmtNum(r.legacy_stock_qty), fmtNum(r.legacy_lot_qty), fmtNum(r.variance_vs_lots), r.status];
      }
      return `<tr style="background:${idx % 2 === 0 ? '#fff' : '#f8fafc'}">${vals.map(v => `<td style="border:1px solid #cbd5e1;padding:5px;font-size:10px;">${v ?? '—'}</td>`).join('')}</tr>`;
    }).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 10px;">
        <div style="border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; display:flex; justify-content:space-between; align-items:flex-end;">
          <div>
            <div style="font-size: 16px; font-weight: bold; color: #0f172a;">${companyName}</div>
            <div style="font-size: 14px; font-weight: bold; color: #0284c7; margin-top: 2px;">${title}</div>
          </div>
          <div style="font-size: 10px; text-align: right; color: #475569;">
            <div>Stock Date: <b>${stockDate}</b> ${mode === 'current' ? `| As Of Time: <b>${effectiveAsOfTime}</b>` : ''}</div>
            <div>FY: <b>${financialYear || reportData?.financialYear || 'All'}</b> | Category: <b>${stockCategory}</b> | Godown: <b>${godownName || 'All'}</b></div>
            <div>Prepared / Generated By: <b>${userLabel}</b> | Generated: <b>${nowStr}</b></div>
          </div>
        </div>
        <table style="width:100%; border-collapse:collapse;">
          <thead><tr>${thHtml}</tr></thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </div>
    `;
    printHtml(html, title);
  };

  // Summary Cards rendering
  const renderSummaryCards = () => {
    const sc = reportData?.summaryCards || reportData?.summary || {};
    let cards = [];
    if (mode === 'opening') {
      cards = [
        { label: 'Total Opening Stock', qty: sc.totalAllOpening?.qty, wt: sc.totalAllOpening?.weight, color: '#0f172a' },
        { label: 'RM Opening Stock', qty: sc.totalRmOpening?.qty, wt: sc.totalRmOpening?.weight, color: '#0369a1' },
        { label: 'FG Opening Stock', qty: sc.totalFgOpening?.qty, wt: sc.totalFgOpening?.weight, color: '#15803d' },
        { label: 'Bag & Vacuum Material', qty: (sc.totalBagOpening?.qty || 0) + (sc.totalVacuumOpening?.qty || 0), wt: (sc.totalBagOpening?.weight || 0) + (sc.totalVacuumOpening?.weight || 0), color: '#7c3aed' },
        { label: 'Wastage & Cold Storage', qty: (sc.totalWastageOpening?.qty || 0) + (sc.totalColdStorageOpening?.qty || 0), wt: (sc.totalWastageOpening?.weight || 0) + (sc.totalColdStorageOpening?.weight || 0), color: '#b45309' }
      ];
    } else if (mode === 'current') {
      cards = [
        { label: 'Physical Stock Balance', qty: sc.totalPhysicalStock?.qty, wt: sc.totalPhysicalStock?.weight, color: '#0f172a' },
        { label: 'Reserved Qty (Orders)', qty: sc.totalReservedStock?.qty, wt: sc.totalReservedStock?.weight, color: '#b45309' },
        { label: 'Available Stock', qty: sc.totalAvailableStock?.qty, wt: sc.totalAvailableStock?.weight, color: '#15803d' },
        { label: 'RM / FG Split (Qty)', qtyText: `RM: ${fmtNum(sc.totalRmStock?.qty)} | FG: ${fmtNum(sc.totalFgStock?.qty)}`, wtText: `Pkg: ${fmtNum(sc.totalPackagingMaterial?.qty)} | Cold: ${fmtNum(sc.totalColdStorage?.qty)}`, color: '#0284c7' },
        { label: 'Stock Risk Flags', qtyText: `Neg: ${sc.negativeWarningsCount || 0} | Over-Resv: ${sc.overReservedWarningsCount || 0}`, wtText: `Wastage: ${fmtNum(sc.totalWastage?.qty)} Qty`, color: (sc.negativeWarningsCount || sc.overReservedWarningsCount) ? '#dc2626' : '#475569' }
      ];
    } else if (mode === 'closing') {
      cards = [
        { label: 'System Closing Stock', qty: sc.totalSystemClosing?.qty, wt: sc.totalSystemClosing?.weight, color: '#0f172a' },
        { label: 'Physical Count Entered', qty: sc.totalPhysicalCount?.qty, wt: sc.totalPhysicalCount?.weight, color: '#0284c7' },
        { label: 'Shortage Variance (-)', qty: sc.totalShortage?.qty, wt: sc.totalShortage?.weight, color: '#dc2626' },
        { label: 'Excess Variance (+)', qty: sc.totalExcess?.qty, wt: sc.totalExcess?.weight, color: '#15803d' },
        { label: 'Closing Status', qtyText: reportData?.status || 'PREVIEW', wtText: reportData?.isLocked ? 'Locked & Carried Forward' : 'Editable', color: '#4338ca' }
      ];
    } else {
      cards = [
        { label: 'Total Identities', qtyText: String(sc.totalRows || displayedRows.length), wtText: `Matched: ${sc.matchedCount || 0}`, color: '#0f172a' },
        { label: 'Variances Detected', qtyText: String(sc.varianceCount || 0), wtText: 'Non-destructive audit', color: sc.varianceCount > 0 ? '#dc2626' : '#15803d' },
        { label: 'Movement Ledger Total', qtyText: `${fmtNum(sc.totalMovementQty)} Qty`, wtText: 'Append-only sum', color: '#0284c7' },
        { label: 'Legacy Stock Table', qtyText: `${fmtNum(sc.totalLegacyStockQty)} Qty`, wtText: `Lots table: ${fmtNum(sc.totalLegacyLotQty)} Qty`, color: '#64748b' }
      ];
    }

    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 1.5, mb: 2 }}>
        {cards.map((c) => (
          <Card key={c.label} variant="outlined" sx={{ borderLeft: `4px solid ${c.color}`, borderRadius: '6px' }}>
            <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                {c.label}
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: c.color, mt: 0.25 }}>
                {c.qtyText !== undefined ? c.qtyText : `${fmtNum(c.qty)} Qty`}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {c.wtText !== undefined ? c.wtText : `${fmtNum(c.wt)} KG`}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  };

  const isClosingLocked = Boolean(reportData?.isLocked || reportData?.status === 'APPROVED_LOCKED');

  return (
    <Box>
      {/* Official Register Header Banner */}
      <Paper
        elevation={1}
        sx={{
          p: 2,
          mb: 2,
          borderRadius: '8px',
          backgroundColor: '#0f172a',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2
        }}
      >
        <Box>
          {!hideHeader && (
            <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block' }}>
              {meta.company?.name}
            </Typography>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
            <AssessmentIcon sx={{ color: '#38bdf8' }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold', letterSpacing: '0.4px' }}>
              {REPORT_TITLES[mode]}
            </Typography>
            {reportData?.status && (
              <Chip
                size="small"
                label={reportData.status}
                sx={{
                  fontWeight: 'bold',
                  backgroundColor: statusChipColor(reportData.status).bg,
                  color: statusChipColor(reportData.status).fg
                }}
              />
            )}
            {reportData?.isFirstDayOfFy && (
              <Chip size="small" label="First Day of Financial Year" sx={{ backgroundColor: '#e0f2fe', color: '#0369a1', fontWeight: 'bold' }} />
            )}
          </Box>
          <Typography variant="caption" sx={{ color: '#cbd5e1', display: 'block', mt: 0.4 }}>
            Company: <b>{meta.company?.name}</b> | Stock Date: <b>{stockDate}</b>
            {mode === 'current' ? ` | As Of Time: ${effectiveAsOfTime}` : ''} | FY: <b>{financialYear || reportData?.financialYear || 'Active'}</b> | Generated By: <b>{auth.user?.username || 'admin'}</b>
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button size="small" variant="outlined" startIcon={<ExcelIcon />} onClick={handleExportExcel} sx={{ color: '#e2e8f0', borderColor: '#475569', textTransform: 'none' }}>
            Excel
          </Button>
          <Button size="small" variant="outlined" startIcon={<ExcelIcon />} onClick={handleExportCsv} sx={{ color: '#e2e8f0', borderColor: '#475569', textTransform: 'none' }}>
            CSV
          </Button>
          <Button size="small" variant="contained" startIcon={<PrintIcon />} onClick={handlePrint} sx={{ backgroundColor: '#0284c7', textTransform: 'none' }}>
            Print / PDF
          </Button>
        </Box>
      </Paper>

      {/* Alerts: Provisional Opening Warning / Negative Stock / Over-Reserved */}
      {(reportData?.provisionalWarning || reportData?.isProvisional || reportData?.isProvisionalOpening) && (
        <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 2, fontWeight: 600 }}>
          {reportData?.provisionalWarning || 'PROVISIONAL OPENING — PREVIOUS DAY CLOSING NOT APPROVED'}
          {reportData?.previousDate ? ` (Previous Working Day: ${reportData.previousDate})` : ''}
        </Alert>
      )}
      {mode === 'current' && (reportData?.summaryCards?.negativeWarningsCount > 0 || reportData?.summaryCards?.overReservedWarningsCount > 0) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Attention: {reportData.summaryCards.negativeWarningsCount || 0} negative physical balance item(s) and {reportData.summaryCards.overReservedWarningsCount || 0} over-reserved item(s) detected.
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* 6-Category Filter Tabs */}
      <Paper variant="outlined" sx={{ mb: 2, borderRadius: '8px', backgroundColor: '#ffffff' }}>
        <Tabs
          value={stockCategory}
          onChange={(_e, val) => {
            setStockCategory(val);
            setPage(0);
          }}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 1,
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '13px', minHeight: 42 }
          }}
        >
          {STOCK_CATEGORIES.map((cat) => (
            <Tab key={cat.id} value={cat.id} label={cat.label} />
          ))}
        </Tabs>
      </Paper>

      {/* Filter Panel */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: '8px', backgroundColor: '#ffffff' }}>
        <Grid container spacing={1.5} alignItems="center">
          {mode !== 'reconciliation' && (
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label={mode === 'closing' ? 'Closing Date' : 'Stock Date'}
                value={stockDate}
                onChange={(e) => setStockDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          )}

          {(mode === 'current' || mode === 'closing') && (
            <>
              <Grid item xs={12} sm={6} md={2.5}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label={mode === 'closing' ? 'Cutoff Time' : 'As Of Time'}
                  value={asOfPreset}
                  onChange={(e) => setAsOfPreset(e.target.value)}
                >
                  {AS_OF_TIME_PRESETS.map((p) => (
                    <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              {asOfPreset === 'CUSTOM' && (
                <Grid item xs={12} sm={4} md={1.5}>
                  <TextField
                    fullWidth
                    size="small"
                    type="time"
                    label="Custom Time"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              )}
            </>
          )}

          <Grid item xs={12} sm={6} md={2}>
            <TextField
              select
              fullWidth
              size="small"
              label="Financial Year"
              value={financialYear}
              onChange={(e) => setFinancialYear(e.target.value)}
            >
              <MenuItem value="">Active / Auto</MenuItem>
              {meta.financialYears.map((fy, idx) => (
                <MenuItem key={fy.id ? `${fy.financial_year}-${fy.id}` : `${fy.financial_year}-${idx}`} value={fy.financial_year}>
                  {fy.financial_year} {fy.is_active ? '(Active)' : ''}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <TextField
              select
              fullWidth
              size="small"
              label="Godown"
              value={godownName}
              onChange={(e) => setGodownName(e.target.value)}
            >
              <MenuItem value="">All Godowns</MenuItem>
              {meta.godowns.map((g) => (
                <MenuItem key={g.id} value={g.godown_name}>
                  {g.godown_name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          {mode !== 'reconciliation' && (
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                select
                fullWidth
                size="small"
                label="Supplier"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
              >
                <MenuItem value="">All Suppliers</MenuItem>
                {meta.suppliers.map((s) => (
                  <MenuItem key={s.id} value={s.name}>{s.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
          )}

          <Grid item xs={12} sm={6} md={1.75}>
            <TextField
              fullWidth
              size="small"
              label="RM Lot No."
              value={rmLotNo}
              onChange={(e) => setRmLotNo(e.target.value)}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={1.75}>
            <TextField
              fullWidth
              size="small"
              label="FG / Parent Lot"
              value={fgLotNo}
              onChange={(e) => setFgLotNo(e.target.value)}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              size="small"
              label="Search Item / Lot / Ref"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Grid>

          {(mode === 'opening' || mode === 'current') && (
            <Grid item xs={12} sm={6} md={1.75}>
              <TextField
                select
                fullWidth
                size="small"
                label="Stock Status"
                value={stockStatus}
                onChange={(e) => setStockStatus(e.target.value)}
              >
                <MenuItem value="ALL">All Status</MenuItem>
                <MenuItem value="Available">Available</MenuItem>
                <MenuItem value="Hold">On Hold</MenuItem>
                <MenuItem value="Rejected">Rejected</MenuItem>
              </TextField>
            </Grid>
          )}

          {(mode === 'closing' || mode === 'reconciliation') && (
            <Grid item xs={12} sm={6} md={2}>
              <FormControlLabel
                control={<Switch checked={varianceOnly} onChange={(e) => setVarianceOnly(e.target.checked)} size="small" />}
                label={<Typography variant="body2">Variance Only</Typography>}
              />
            </Grid>
          )}

          <Grid item xs={12} sm="auto" sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" size="small" startIcon={<SearchIcon />} onClick={fetchReport} sx={{ textTransform: 'none' }}>
              Refresh
            </Button>
            <Button variant="outlined" size="small" startIcon={<ResetIcon />} onClick={handleReset} sx={{ textTransform: 'none' }}>
              Reset
            </Button>
          </Grid>
        </Grid>

        {/* Workflow Actions Bar */}
        {mode === 'opening' && (
          <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto' }}>
              Opening Stock = Previous Approved Closing + Approved Opening Adjustments. Approving locks today&apos;s opening snapshot against overwrites.
            </Typography>
            <Button
              size="small"
              variant="outlined"
              disabled={actionLoading || reportData?.isLocked}
              startIcon={<SaveIcon />}
              onClick={() => runOpeningSnapshot(false)}
              sx={{ textTransform: 'none' }}
            >
              Save Opening Draft
            </Button>
            <Button
              size="small"
              variant="contained"
              color="success"
              disabled={actionLoading || reportData?.isLocked}
              startIcon={<LockIcon />}
              onClick={() => setConfirmDlg({
                open: true,
                title: 'Approve & Lock Opening Stock',
                message: `Lock the Daily Opening Stock snapshot for ${stockDate}? Once locked, regenerating a draft will not overwrite it.`,
                onConfirm: () => {
                  setConfirmDlg({ open: false, title: '', message: '', onConfirm: null });
                  runOpeningSnapshot(true);
                }
              })}
              sx={{ textTransform: 'none' }}
            >
              {reportData?.isLocked ? 'Approved & Locked' : 'Approve & Lock Opening'}
            </Button>
          </Box>
        )}

        {mode === 'closing' && (
          <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto' }}>
              Workflow: <b>Draft</b> &rarr; Enter Physical Counts &rarr; <b>Verify</b> &rarr; <b>Approve &amp; Lock</b> (posts variance adjustments &amp; locks D+1 carry-forward).
            </Typography>
            <Button
              size="small"
              variant="outlined"
              disabled={actionLoading || isClosingLocked}
              startIcon={<SyncIcon />}
              onClick={handleClosingDraft}
              sx={{ textTransform: 'none' }}
            >
              Generate / Refresh Draft
            </Button>
            <Button
              size="small"
              variant="contained"
              disabled={actionLoading || isClosingLocked}
              startIcon={<SaveIcon />}
              onClick={ensureClosingIdAndSaveCounts}
              sx={{ textTransform: 'none' }}
            >
              Save Physical Counts
            </Button>
            <Button
              size="small"
              variant="contained"
              color="info"
              disabled={actionLoading || isClosingLocked || !reportData?.header?.id}
              startIcon={<FactCheckIcon />}
              onClick={handleVerifyClosing}
              sx={{ textTransform: 'none' }}
            >
              Verify Closing
            </Button>
            <Button
              size="small"
              variant="contained"
              color="success"
              disabled={actionLoading || isClosingLocked || reportData?.status !== 'VERIFIED'}
              startIcon={<LockIcon />}
              onClick={() => setConfirmDlg({
                open: true,
                title: 'Approve & Lock Daily Closing',
                message: `Approve & Lock the Daily Closing Stock Register for ${stockDate}? Any physical variance will be posted as CLOSING_ADJUSTMENT movements and this register will become tomorrow's carried-forward Opening Stock.`,
                onConfirm: () => {
                  setConfirmDlg({ open: false, title: '', message: '', onConfirm: null });
                  handleApproveLockClosing();
                }
              })}
              sx={{ textTransform: 'none' }}
            >
              {isClosingLocked ? 'Approved & Locked' : 'Approve & Lock'}
            </Button>
          </Box>
        )}

        {mode === 'reconciliation' && (
          <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto' }}>
              Non-destructive shadow comparison between append-only <b>stock_movements</b> and legacy <b>stock</b> / <b>stock_lots</b> tables. Historical records are never wiped.
            </Typography>
            <Button
              size="small"
              variant="contained"
              disabled={actionLoading}
              startIcon={<SyncIcon />}
              onClick={handleReconciliationSync}
              sx={{ textTransform: 'none' }}
            >
              Run Non-Destructive Backfill Sync
            </Button>
          </Box>
        )}
      </Paper>

      {/* Summary KPI Cards */}
      {renderSummaryCards()}

      {/* Data Table */}
      <Paper variant="outlined" sx={{ borderRadius: '8px', overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TableContainer sx={{ maxHeight: 560 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  {mode === 'opening' && (
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Stock Category</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Item Code / Name</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Supplier / Inv No.</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>RM Lot</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>FG / Parent Lot</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Godown</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Prev Closing</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Adj (+/-)</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Opening Qty</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Opening Wt (KG)</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Status</TableCell>
                    </TableRow>
                  )}

                  {mode === 'current' && (
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Category</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Item Name / UOM</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>RM Lot / FG Lot</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Godown</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Opening</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Total In</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Total Out</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Balance Qty</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Balance Wt (KG)</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Reserved</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Available Qty</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Status</TableCell>
                    </TableRow>
                  )}

                  {mode === 'closing' && (
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Category</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Item Name</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Lots (RM / FG)</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Godown</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Opening</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>In / Out</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>System Closing</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff', minWidth: 115 }}>Physical Qty</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff', minWidth: 115 }}>Physical Wt</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Variance Qty</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff', minWidth: 150 }}>Variance Reason</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Final Closing</TableCell>
                    </TableRow>
                  )}

                  {mode === 'reconciliation' && (
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Category</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Item Name</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Lot No</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Godown</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Movement Ledger Qty</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Legacy Stock Qty</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Legacy Lot Qty</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Var vs Stock</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Var vs Lots</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fff' }}>Status</TableCell>
                    </TableRow>
                  )}
                </TableHead>

                <TableBody>
                  {pagedRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13} align="center" sx={{ py: 5, color: '#64748b' }}>
                        No stock register records found for the selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagedRows.map((r, idx) => {
                      const rowNum = page * rowsPerPage + idx + 1;
                      if (mode === 'opening') {
                        return (
                          <TableRow
                            key={r.identity_key || rowNum}
                            hover
                            onClick={() => setDrilldown({ open: true, row: r })}
                            sx={{ cursor: 'pointer' }}
                          >
                            <TableCell>{r.sno || rowNum}</TableCell>
                            <TableCell>
                              <Chip size="small" label={r.display_category || r.stock_category} sx={{ fontSize: '11px', fontWeight: 600 }} />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>{r.item_name}</Typography>
                              <Typography variant="caption" color="text.secondary">{r.item_code ? `${r.item_code} · ` : ''}{r.uom}</Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">{r.supplier_name || '—'}</Typography>
                              {r.supplier_invoice_no && <Typography variant="caption" color="text.secondary">Inv: {r.supplier_invoice_no}</Typography>}
                            </TableCell>
                            <TableCell sx={{ fontSize: '12px' }}>{r.rm_lot_no || '—'}</TableCell>
                            <TableCell sx={{ fontSize: '12px' }}>
                              {r.fg_lot_no || '—'}
                              {r.parent_lot_no && <Typography variant="caption" display="block" color="text.secondary">Parent: {r.parent_lot_no}</Typography>}
                            </TableCell>
                            <TableCell sx={{ fontSize: '12px' }}>{r.godown_name}</TableCell>
                            <TableCell align="right">{fmtNum(r.prev_closing_qty)}</TableCell>
                            <TableCell align="right" sx={{ color: r.opening_adjustment_qty ? '#0284c7' : '#64748b' }}>
                              {fmtNum(r.opening_adjustment_qty)}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>{fmtNum(r.opening_qty)}</TableCell>
                            <TableCell align="right">{fmtNum(r.opening_weight)}</TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={r.is_provisional ? 'PROVISIONAL' : (r.stock_status || 'Available')}
                                sx={{
                                  height: 22,
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  backgroundColor: r.is_provisional ? '#fef3c7' : '#dcfce7',
                                  color: r.is_provisional ? '#92400e' : '#166534'
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      }

                      if (mode === 'current') {
                        const chipColors = statusChipColor(r.warning_flag || r.stock_status);
                        return (
                          <TableRow
                            key={r.identity_key || rowNum}
                            hover
                            onClick={() => setDrilldown({ open: true, row: r })}
                            sx={{
                              cursor: 'pointer',
                              backgroundColor: r.is_negative_physical ? '#fef2f2' : r.is_over_reserved ? '#fffbeb' : '#ffffff'
                            }}
                          >
                            <TableCell>{r.sno || rowNum}</TableCell>
                            <TableCell>
                              <Chip size="small" label={r.display_category || r.stock_category} sx={{ fontSize: '11px', fontWeight: 600 }} />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>{r.item_name}</Typography>
                              <Typography variant="caption" color="text.secondary">{r.uom}{r.bag_breakdown_display ? ` · ${r.bag_breakdown_display}` : ''}</Typography>
                            </TableCell>
                            <TableCell sx={{ fontSize: '12px' }}>
                              {r.rm_lot_no || r.fg_lot_no || r.lot_no || '—'}
                              {r.parent_lot_no && <Typography variant="caption" display="block" color="text.secondary">Parent: {r.parent_lot_no}</Typography>}
                            </TableCell>
                            <TableCell sx={{ fontSize: '12px' }}>{r.godown_name}</TableCell>
                            <TableCell align="right">{fmtNum(r.opening_qty)}</TableCell>
                            <TableCell align="right" sx={{ color: '#15803d', fontWeight: 600 }}>{fmtNum(r.total_in_qty)}</TableCell>
                            <TableCell align="right" sx={{ color: '#b91c1c', fontWeight: 600 }}>{fmtNum(r.total_out_qty)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', color: r.current_balance_qty < 0 ? '#dc2626' : '#0f172a' }}>
                              {fmtNum(r.current_balance_qty)}
                            </TableCell>
                            <TableCell align="right">{fmtNum(r.current_balance_weight)}</TableCell>
                            <TableCell align="right" sx={{ color: r.reserved_qty > 0 ? '#b45309' : '#94a3b8', fontWeight: r.reserved_qty > 0 ? 700 : 400 }}>
                              {fmtNum(r.reserved_qty)}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', color: r.available_stock_qty < 0 ? '#dc2626' : '#15803d' }}>
                              {fmtNum(r.available_stock_qty)}
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={r.warning_flag || r.stock_status || 'Available'}
                                sx={{ height: 22, fontSize: '11px', fontWeight: 600, backgroundColor: chipColors.bg, color: chipColors.fg }}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      }

                      if (mode === 'closing') {
                        const edit = countEdits[r.identity_key] || {};
                        const livePhysQty = edit.physical_count_qty !== '' && edit.physical_count_qty !== undefined
                          ? Number(edit.physical_count_qty)
                          : null;
                        const liveVarQty = livePhysQty !== null
                          ? Number((livePhysQty - Number(r.system_closing_qty || 0)).toFixed(3))
                          : Number(r.variance_qty || 0);
                        return (
                          <TableRow
                            key={r.identity_key || rowNum}
                            hover
                            onClick={() => setDrilldown({ open: true, row: r })}
                            sx={{ cursor: 'pointer' }}
                          >
                            <TableCell>{r.sno || rowNum}</TableCell>
                            <TableCell>
                              <Chip size="small" label={r.display_category || r.stock_category} sx={{ fontSize: '11px', fontWeight: 600 }} />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>{r.item_name}</Typography>
                              <Typography variant="caption" color="text.secondary">{r.uom}</Typography>
                            </TableCell>
                            <TableCell sx={{ fontSize: '12px' }}>
                              {r.rm_lot_no || r.fg_lot_no || r.lot_no || '—'}
                            </TableCell>
                            <TableCell sx={{ fontSize: '12px' }}>{r.godown_name}</TableCell>
                            <TableCell align="right">{fmtNum(r.opening_qty)}</TableCell>
                            <TableCell align="right" sx={{ fontSize: '12px' }}>
                              <span style={{ color: '#15803d' }}>+{fmtNum(r.total_in_qty)}</span> / <span style={{ color: '#b91c1c' }}>-{fmtNum(r.total_out_qty)}</span>
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                              {fmtNum(r.system_closing_qty)}
                              <Typography variant="caption" display="block" color="text.secondary">{fmtNum(r.system_closing_weight)} KG</Typography>
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <TextField
                                size="small"
                                type="number"
                                disabled={isClosingLocked}
                                value={edit.physical_count_qty ?? ''}
                                onChange={(e) => setCountEdits((prev) => ({
                                  ...prev,
                                  [r.identity_key]: { ...(prev[r.identity_key] || { line_id: r.id || null, identity_key: r.identity_key }), physical_count_qty: e.target.value }
                                }))}
                                placeholder={String(r.system_closing_qty ?? 0)}
                                sx={{ width: 95 }}
                              />
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <TextField
                                size="small"
                                type="number"
                                disabled={isClosingLocked}
                                value={edit.physical_count_weight ?? ''}
                                onChange={(e) => setCountEdits((prev) => ({
                                  ...prev,
                                  [r.identity_key]: { ...(prev[r.identity_key] || { line_id: r.id || null, identity_key: r.identity_key }), physical_count_weight: e.target.value }
                                }))}
                                placeholder={String(r.system_closing_weight ?? 0)}
                                sx={{ width: 95 }}
                              />
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', color: liveVarQty < 0 ? '#dc2626' : liveVarQty > 0 ? '#15803d' : '#64748b' }}>
                              {fmtNum(liveVarQty)}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <TextField
                                size="small"
                                disabled={isClosingLocked}
                                value={edit.variance_reason ?? ''}
                                onChange={(e) => setCountEdits((prev) => ({
                                  ...prev,
                                  [r.identity_key]: { ...(prev[r.identity_key] || { line_id: r.id || null, identity_key: r.identity_key }), variance_reason: e.target.value }
                                }))}
                                placeholder={Math.abs(liveVarQty) > 0.001 ? 'Reason required' : 'Optional'}
                                sx={{ width: 140 }}
                              />
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                              {fmtNum(r.final_closing_qty)}
                              <Typography variant="caption" display="block" color="text.secondary">{fmtNum(r.final_closing_weight)} KG</Typography>
                            </TableCell>
                          </TableRow>
                        );
                      }

                      // reconciliation
                      const chipColors = statusChipColor(r.status);
                      return (
                        <TableRow
                          key={r.identity_key || rowNum}
                          hover
                          onClick={() => setDrilldown({ open: true, row: r })}
                          sx={{ cursor: 'pointer', backgroundColor: r.status === 'VARIANCE' ? '#fef2f2' : '#ffffff' }}
                        >
                          <TableCell>{rowNum}</TableCell>
                          <TableCell>
                            <Chip size="small" label={r.stock_category || 'RM'} sx={{ fontSize: '11px', fontWeight: 600 }} />
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{r.item_name}</TableCell>
                          <TableCell sx={{ fontSize: '12px' }}>{r.lot_no || '—'}</TableCell>
                          <TableCell sx={{ fontSize: '12px' }}>{r.godown_name || '—'}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', color: '#0284c7' }}>{fmtNum(r.movement_qty)}</TableCell>
                          <TableCell align="right">{fmtNum(r.legacy_stock_qty)}</TableCell>
                          <TableCell align="right">{fmtNum(r.legacy_lot_qty)}</TableCell>
                          <TableCell align="right" sx={{ color: Math.abs(r.variance_vs_stock) > 0.01 ? '#dc2626' : '#15803d', fontWeight: 600 }}>
                            {fmtNum(r.variance_vs_stock)}
                          </TableCell>
                          <TableCell align="right" sx={{ color: Math.abs(r.variance_vs_lots) > 0.01 ? '#dc2626' : '#15803d', fontWeight: 600 }}>
                            {fmtNum(r.variance_vs_lots)}
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={r.status}
                              icon={r.status === 'MATCHED' ? <VerifiedIcon sx={{ fontSize: 14 }} /> : undefined}
                              sx={{ height: 22, fontSize: '11px', fontWeight: 600, backgroundColor: chipColors.bg, color: chipColors.fg }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={displayedRows.length}
              page={page}
              onPageChange={(_e, nextPage) => setPage(nextPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[15, 25, 50, 100]}
            />
          </>
        )}
      </Paper>

      {/* Row-Level Drill-Down Modal */}
      <StockMovementDrilldownModal
        open={drilldown.open}
        onClose={() => setDrilldown({ open: false, row: null })}
        row={drilldown.row}
        stockDate={stockDate}
        asOfTime={effectiveAsOfTime}
        financialYear={financialYear || reportData?.financialYear || ''}
      />

      {/* Confirmation Dialog (replaces window.confirm) */}
      <Dialog open={confirmDlg.open} onClose={() => setConfirmDlg({ open: false, title: '', message: '', onConfirm: null })}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>{confirmDlg.title}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">{confirmDlg.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDlg({ open: false, title: '', message: '', onConfirm: null })} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button variant="contained" color="success" onClick={() => confirmDlg.onConfirm && confirmDlg.onConfirm()} sx={{ textTransform: 'none' }}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar Toast (replaces window.alert) */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4500}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setToast((prev) => ({ ...prev, open: false }))} severity={toast.severity} variant="filled">
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default StockRegisterPanel;
