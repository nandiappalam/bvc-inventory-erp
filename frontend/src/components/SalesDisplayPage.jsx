import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api.js';
import DigitalDocumentModal from './documents/DigitalDocumentModal';
import SalesLedgerDetailsModal from './sales/SalesLedgerDetailsModal';
import SalesDetailViewModal from './sales/SalesDetailViewModal';
import { printFormalSalesBill } from '../utils/formalBillPrinter';
import { printOutpassDocument } from '../utils/movementPrintTemplates';
import { exportToExcel } from '../utils/exportHelper';
import { printHtml } from '../utils/printHelper';

const formatWeightCompact = (val, showZero = false) => {
  const n = Number(val || 0);
  if (n <= 0) return showZero ? '0 kg' : '—';
  return `${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })} kg`;
};

const formatCurrencyCompact = (val) => {
  const n = Number(val || 0);
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDateDMY = (val) => {
  if (!val) return '—';
  const s = String(val).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return s.substring(0, 10) || '—';
};

const escHtml = (val) =>
  String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const OPTIONAL_COLUMN_DEFINITIONS = [
  {
    key: 'customer_code',
    title: 'Customer Code',
    getText: (row) => row.customer_code || '—',
    render: (row) => (
      <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#334155' }}>
        {row.customer_code || '—'}
      </span>
    )
  },
  {
    key: 'customer_gstin',
    title: 'Customer GSTIN',
    getText: (row) => row.customer_gstin || '—',
    render: (row) => (
      <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#1e293b' }}>
        {row.customer_gstin || '—'}
      </span>
    )
  },
  {
    key: 'place_of_supply',
    title: 'Place of Supply',
    getText: (row) => row.place_of_supply || row.party_state || '—',
    render: (row) => row.place_of_supply || row.party_state || '—'
  },
  {
    key: 'godown_from_name',
    title: 'Godown Name',
    getText: (row) => row.godown_from_name || row.godown_name || '—',
    render: (row) => row.godown_from_name || row.godown_name || '—'
  },
  {
    key: 'hsn_code',
    title: 'HSN Code',
    getText: (row) => {
      const items = Array.isArray(row.items) ? row.items : [];
      const hsns = Array.from(new Set(items.map((i) => i.hsn_code).filter(Boolean)));
      return hsns.join(', ') || '—';
    },
    render: (row) => {
      const items = Array.isArray(row.items) ? row.items : [];
      const hsns = Array.from(new Set(items.map((i) => i.hsn_code).filter(Boolean)));
      return <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{hsns.join(', ') || '—'}</span>;
    }
  },
  {
    key: 'vehicle_gross_weight',
    title: 'Gross Weight',
    align: 'right',
    getText: (row) => formatWeightCompact(row.vehicle_gross_weight),
    render: (row) => <div style={{ textAlign: 'right' }}>{formatWeightCompact(row.vehicle_gross_weight)}</div>
  },
  {
    key: 'tare_weight_combined',
    title: 'Tare Weight',
    align: 'right',
    getText: (row) => {
      const vTare = Number(row.vehicle_tare_weight || 0);
      const pTare = Number(row.package_tare_weight || 0);
      if (vTare <= 0 && pTare <= 0) return '—';
      return `${(vTare + pTare).toLocaleString('en-IN', { maximumFractionDigits: 2 })} kg`;
    },
    render: (row) => {
      const vTare = Number(row.vehicle_tare_weight || 0);
      const pTare = Number(row.package_tare_weight || 0);
      if (vTare <= 0 && pTare <= 0) return <div style={{ textAlign: 'right', color: '#94a3b8' }}>—</div>;
      return (
        <div style={{ textAlign: 'right' }}>
          <div>{formatWeightCompact(vTare || pTare)}</div>
          {vTare > 0 && pTare > 0 && (
            <div style={{ fontSize: '10px', color: '#64748b' }}>Pkg: {formatWeightCompact(pTare)}</div>
          )}
        </div>
      );
    }
  },
  {
    key: 'rate_display',
    title: 'Rate',
    align: 'right',
    getText: (row) => {
      const first = Array.isArray(row.items) && row.items[0] ? row.items[0] : {};
      const rt = Number(first.rate ?? row.rate ?? 0);
      return rt > 0 ? `${formatCurrencyCompact(rt)} (${first.rate_type || 'Per Kg'})` : '—';
    },
    render: (row) => {
      const first = Array.isArray(row.items) && row.items[0] ? row.items[0] : {};
      const rt = Number(first.rate ?? row.rate ?? 0);
      if (rt <= 0) return <div style={{ textAlign: 'right', color: '#94a3b8' }}>—</div>;
      return (
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 600 }}>{formatCurrencyCompact(rt)}</div>
          <div style={{ fontSize: '10px', color: '#64748b' }}>{first.rate_type || 'Per Kg'}</div>
        </div>
      );
    }
  },
  {
    key: 'bill_amt',
    title: 'Taxable Value',
    align: 'right',
    getText: (row) => formatCurrencyCompact(row.bill_amt || row.base_amt || 0),
    render: (row) => <div style={{ textAlign: 'right' }}>{formatCurrencyCompact(row.bill_amt || row.base_amt || 0)}</div>
  },
  {
    key: 'gst_summary',
    title: 'GST % & Amount',
    align: 'right',
    getText: (row) => `${Number(row.tax_percent || row.tax_perc || 0)}% (${formatCurrencyCompact(row.tax_amt || row.tax_amount || 0)})`,
    render: (row) => (
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontWeight: 600 }}>{formatCurrencyCompact(row.tax_amt || row.tax_amount || 0)}</div>
        <div style={{ fontSize: '10px', color: '#64748b' }}>{Number(row.tax_percent || row.tax_perc || 0)}%</div>
      </div>
    )
  },
  {
    key: 'tcs_amount',
    title: 'TCS',
    align: 'right',
    getText: (row) => formatCurrencyCompact(row.tcs_amount || 0),
    render: (row) => <div style={{ textAlign: 'right' }}>{formatCurrencyCompact(row.tcs_amount || 0)}</div>
  },
  {
    key: 'other_charges_total',
    title: 'Other Charges',
    align: 'right',
    getText: (row) => {
      const amt = Number(row.loading_charges_amt || 0) + Number(row.other_charges || 0) + Number(row.freight_recovery_amt || 0);
      return formatCurrencyCompact(amt);
    },
    render: (row) => {
      const amt = Number(row.loading_charges_amt || 0) + Number(row.other_charges || 0) + Number(row.freight_recovery_amt || 0);
      return <div style={{ textAlign: 'right' }}>{formatCurrencyCompact(amt)}</div>;
    }
  },
  {
    key: 'round_off',
    title: 'Round Off',
    align: 'right',
    getText: (row) => formatCurrencyCompact(row.round_off || 0),
    render: (row) => <div style={{ textAlign: 'right' }}>{formatCurrencyCompact(row.round_off || 0)}</div>
  },
  {
    key: 'payment_mode_display',
    title: 'Payment Mode',
    getText: (row) => [row.pay_type, row.payment_mode].filter(Boolean).join(' / ') || '—',
    render: (row) => [row.pay_type, row.payment_mode].filter(Boolean).join(' / ') || '—'
  },
  {
    key: 'due_date',
    title: 'Due Date',
    getText: (row) => formatDateDMY(row.due_date),
    render: (row) => formatDateDMY(row.due_date)
  },
  {
    key: 'transporter_name',
    title: 'Transporter',
    getText: (row) => row.transporter_name || row.pur_trans || '—',
    render: (row) => row.transporter_name || row.pur_trans || '—'
  },
  {
    key: 'eway_bill_no',
    title: 'E-Way Bill No.',
    getText: (row) => row.eway_bill_no || '—',
    render: (row) => (
      <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{row.eway_bill_no || '—'}</span>
    )
  },
  {
    key: 'audit_info',
    title: 'Created By / Updated At',
    getText: (row) => {
      const by = row.created_by || '—';
      const upd = row.updated_at ? formatDateDMY(row.updated_at) : formatDateDMY(row.created_at);
      return `${by} (${upd})`;
    },
    render: (row) => (
      <div style={{ fontSize: '11px' }}>
        <div style={{ fontWeight: 600, color: '#334155' }}>{row.created_by || '—'}</div>
        <div style={{ fontSize: '10px', color: '#64748b' }}>
          {row.updated_at ? `Upd: ${formatDateDMY(row.updated_at)}` : `Cr: ${formatDateDMY(row.created_at)}`}
        </div>
      </div>
    )
  }
];

const SalesDisplayPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isOrder = location.pathname.includes('order');
  const { isAdmin, hasPermission, selectedCompany, financialYear } = useAuth();

  const storageKey = isOrder ? 'bvc_sales_order_opt_cols_v1' : 'bvc_sales_display_opt_cols_v1';
  const [visibleOptionalKeys, setVisibleOptionalKeys] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const colMenuRef = useRef(null);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [notice, setNotice] = useState(null);

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filterFY, setFilterFY] = useState('ALL');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterItem, setFilterItem] = useState('');
  const [filterGodown, setFilterGodown] = useState('');
  const [filterPayType, setFilterPayType] = useState('');
  const [filterPayStatus, setFilterPayStatus] = useState('');
  const [filterDispatchStatus, setFilterDispatchStatus] = useState('');
  const [filterTransporter, setFilterTransporter] = useState('');
  const [filterRecordStatus, setFilterRecordStatus] = useState('ACTIVE'); // 'ACTIVE' | 'ALL' | 'CANCELLED'
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  // Modals
  const [viewModal, setViewModal] = useState({ open: false, record: null });
  const [activeDoc, setActiveDoc] = useState(null);
  const [ledgerModal, setLedgerModal] = useState({ open: false, salesId: null, salesData: null });
  const [cancelModal, setCancelModal] = useState({ open: false, row: null, reason: '', busy: false });

  const highlightId = searchParams.get('highlightId') || '';
  const highlightRef = searchParams.get('highlightRef') || '';

  const moduleName = isOrder ? 'Sales Order' : 'Sales';
  const canCreate =
    isAdmin ||
    hasPermission(moduleName, 'Display', 'can_create') ||
    hasPermission(moduleName, 'Create', 'can_create') ||
    hasPermission(moduleName, 'can_create');
  const canEdit = isAdmin || hasPermission(moduleName, 'Display', 'can_edit') || hasPermission(moduleName, 'can_edit');
  const canDelete = isAdmin || hasPermission(moduleName, 'Display', 'can_delete') || hasPermission(moduleName, 'can_delete');
  const canPrint = isAdmin || hasPermission(moduleName, 'Display', 'can_print') || hasPermission(moduleName, 'can_print');

  const showNotice = useCallback((title, message) => {
    setNotice({ title, message });
    setTimeout(() => setNotice(null), 4500);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(visibleOptionalKeys));
    } catch (_) {}
  }, [visibleOptionalKeys, storageKey]);

  useEffect(() => {
    const handleOutside = (e) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target)) {
        setColMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const endpoint = isOrder ? '/sales?is_order=1' : '/sales?is_order=0';
      const result = await api(endpoint);
      const list = Array.isArray(result) ? result : (Array.isArray(result?.data) ? result.data : []);
      setRows(list);
    } catch (err) {
      console.error('Error fetching sales register:', err);
      setFetchError(err.message || 'Failed to load sales register.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [isOrder]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Helper: check if row matches highlight query param
  const isRowHighlighted = useCallback(
    (row) => {
      if (!row) return false;
      if (highlightId && row.id !== undefined && row.id !== null && String(row.id) === String(highlightId)) {
        return true;
      }
      if (!highlightId && highlightRef) {
        const target = String(highlightRef).trim().toLowerCase();
        const candidates = [row.inv_no, row.s_no, row.voucher_no, row.outpass_no, row.customer_po_no];
        return candidates.some((c) => c !== undefined && c !== null && String(c).trim().toLowerCase() === target);
      }
      return false;
    },
    [highlightId, highlightRef]
  );

  // Filter options derived from dataset
  const filterOptions = useMemo(() => {
    const fys = new Set();
    const customers = new Set();
    const items = new Set();
    const godowns = new Set();
    const transporters = new Set();
    rows.forEach((r) => {
      if (r.financial_year) fys.add(r.financial_year);
      if (r.customer_name || r.customer) customers.add(r.customer_name || r.customer);
      if (Array.isArray(r.items)) {
        r.items.forEach((it) => {
          if (it.item_name) items.add(it.item_name);
          if (it.godown_name) godowns.add(it.godown_name);
        });
      }
      if (r.godown_from_name) godowns.add(r.godown_from_name);
      if (r.transporter_name || r.pur_trans) transporters.add(r.transporter_name || r.pur_trans);
    });
    return {
      fys: Array.from(fys).sort(),
      customers: Array.from(customers).sort(),
      items: Array.from(items).sort(),
      godowns: Array.from(godowns).sort(),
      transporters: Array.from(transporters).sort()
    };
  }, [rows]);

  // Apply all filters
  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return rows.filter((row) => {
      const isCancelled = Boolean(row.is_cancelled) || String(row.computed_dispatch_status || '').toLowerCase() === 'cancelled';
      if (filterRecordStatus === 'ACTIVE' && isCancelled) return false;
      if (filterRecordStatus === 'CANCELLED' && !isCancelled) return false;

      if (filterFY !== 'ALL' && String(row.financial_year || '') !== filterFY) return false;

      if (fromDate || toDate) {
        const dStr = String(row.date || row.created_at || '').substring(0, 10);
        if (fromDate && dStr < fromDate) return false;
        if (toDate && dStr > toDate) return false;
      }

      if (filterCustomer && (row.customer_name || row.customer || '') !== filterCustomer) return false;

      if (filterItem) {
        const hasItem = Array.isArray(row.items)
          ? row.items.some((it) => it.item_name === filterItem)
          : String(row.item_name || '').includes(filterItem);
        if (!hasItem) return false;
      }

      if (filterGodown) {
        const matchGodown =
          row.godown_from_name === filterGodown ||
          row.godown_name === filterGodown ||
          (Array.isArray(row.items) && row.items.some((it) => it.godown_name === filterGodown));
        if (!matchGodown) return false;
      }

      if (filterPayType) {
        const pt = String(row.pay_type || '').toLowerCase();
        if (!pt.includes(filterPayType.toLowerCase())) return false;
      }

      if (!isOrder && filterPayStatus && (row.payment_status || '') !== filterPayStatus) return false;
      if (!isOrder && filterDispatchStatus && (row.computed_dispatch_status || '') !== filterDispatchStatus) return false;

      if (filterTransporter && (row.transporter_name || row.pur_trans || '') !== filterTransporter) return false;

      if (q) {
        const haystack = [
          row.inv_no,
          row.s_no,
          row.voucher_no,
          row.customer_name,
          row.customer,
          row.customer_gstin,
          row.sales_order_ref,
          row.customer_po_no,
          row.p_o_no,
          row.po_no,
          row.item_name,
          row.lot_no,
          row.lorry_no,
          row.outpass_no,
          row.delivery_challan_no,
          row.transporter_name
        ]
          .filter((v) => v !== undefined && v !== null)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [
    rows,
    filterRecordStatus,
    filterFY,
    fromDate,
    toDate,
    filterCustomer,
    filterItem,
    filterGodown,
    filterPayType,
    filterPayStatus,
    filterDispatchStatus,
    filterTransporter,
    searchTerm,
    isOrder
  ]);

  // Clear blocking filters and jump to page containing highlighted record
  useEffect(() => {
    if ((!highlightId && !highlightRef) || !rows.length) return;
    const matchIdx = rows.findIndex((r) => isRowHighlighted(r));
    if (matchIdx >= 0) {
      setSearchTerm('');
      setFromDate('');
      setToDate('');
      setFilterFY('ALL');
      setFilterCustomer('');
      setFilterItem('');
      setFilterGodown('');
      setFilterPayType('');
      setFilterPayStatus('');
      setFilterDispatchStatus('');
      setFilterTransporter('');
      setFilterRecordStatus('ALL');
    }
  }, [highlightId, highlightRef, rows, isRowHighlighted]);

  useEffect(() => {
    if ((!highlightId && !highlightRef) || loading || !filteredRows.length) return;
    const idx = filteredRows.findIndex((r) => isRowHighlighted(r));
    if (idx >= 0) {
      const targetPage = Math.floor(idx / pageSize) + 1;
      if (targetPage !== currentPage) {
        setCurrentPage(targetPage);
      }
      const timer = setTimeout(() => {
        const el = document.querySelector('[data-highlighted="true"]');
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [highlightId, highlightRef, loading, filteredRows, pageSize, currentPage, isRowHighlighted]);

  // Reset page when filter count shrinks
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    if (currentPage > maxPage) setCurrentPage(1);
  }, [filteredRows.length, pageSize, currentPage]);

  // KPI Totals across filtered active records
  const kpiSummary = useMemo(() => {
    let totalSales = 0;
    let totalReceived = 0;
    let totalOutstanding = 0;
    let totalDispatchedWt = 0;
    let totalOrderWt = 0;
    let totalQty = 0;
    let activeCount = 0;

    filteredRows.forEach((r) => {
      if (r.is_cancelled) return;
      activeCount += 1;
      const amt = Number(r.grand_total || r.total_amt || 0);
      const rec = Number(r.actual_received_amount ?? (Number(r.received_amount || 0) + Number(r.advance_adjusted || 0)));
      const due = Number(r.actual_balance_due ?? Math.max(0, amt - rec));
      totalSales += amt;
      totalReceived += rec;
      totalOutstanding += due;
      totalDispatchedWt += Number(r.confirmed_dispatched_weight || 0);
      totalOrderWt += Number(r.product_net_weight || r.total_wt || 0);
      totalQty += Number(r.qty || r.total_qty || 0);
    });

    return {
      activeCount,
      totalSales,
      totalReceived,
      totalOutstanding,
      totalDispatchedWt,
      totalOrderWt,
      totalQty
    };
  }, [filteredRows]);

  const clearAllFilters = () => {
    setSearchTerm('');
    setFromDate('');
    setToDate('');
    setFilterFY('ALL');
    setFilterCustomer('');
    setFilterItem('');
    setFilterGodown('');
    setFilterPayType('');
    setFilterPayStatus('');
    setFilterDispatchStatus('');
    setFilterTransporter('');
    setFilterRecordStatus('ACTIVE');
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(
    searchTerm ||
    fromDate ||
    toDate ||
    filterFY !== 'ALL' ||
    filterCustomer ||
    filterItem ||
    filterGodown ||
    filterPayType ||
    filterPayStatus ||
    filterDispatchStatus ||
    filterTransporter ||
    filterRecordStatus !== 'ACTIVE'
  );

  // Handlers for row actions
  const handleEdit = (row) => {
    if (isOrder) {
      navigate(`/entry/sales-order-create?id=${row.id}`);
    } else {
      navigate(`/entry/sales-create?id=${row.id}`);
    }
  };

  const handlePrint = async (row) => {
    try {
      let fullRecord = row;
      if (!row.items || row.items.length === 0 || !row.deductions) {
        const fetched = await api(`/sales/${row.id}`).catch(() => null);
        if (fetched) fullRecord = fetched;
      }
      printFormalSalesBill({
        documentType: isOrder ? 'SALES ORDER' : 'TAX INVOICE',
        record: fullRecord,
        company: selectedCompany,
        items: fullRecord.items || []
      });
    } catch (e) {
      console.error('Print sales error:', e);
      printFormalSalesBill({
        documentType: isOrder ? 'SALES ORDER' : 'TAX INVOICE',
        record: row,
        company: selectedCompany,
        items: row.items || []
      });
    }
  };

  const handlePrintOutpass = async (row) => {
    const outpassKey = row.outpass_id || row.outpass_no;
    if (!outpassKey) return;
    try {
      const res = await api(`/outpasses/${encodeURIComponent(outpassKey)}`);
      const op = res?.data || res;
      if (op && (op.outpass_no || op.id)) {
        printOutpassDocument(op, 'ORIGINAL - STORE COPY');
      } else {
        showNotice('Outpass Unavailable', 'Could not locate linked gate outpass details.');
      }
    } catch (err) {
      showNotice('Error', 'Failed to load outpass: ' + err.message);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelModal.row?.id || cancelModal.busy) return;
    setCancelModal((prev) => ({ ...prev, busy: true }));
    try {
      const result = await api(`/sales/${cancelModal.row.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelModal.reason || '' })
      });
      if (result && (result.success || result.message)) {
        showNotice('Success', result.message || 'Sales record cancelled and stock/outpass/vouchers reverted cleanly.');
        setCancelModal({ open: false, row: null, reason: '', busy: false });
        fetchData();
      } else {
        showNotice('Error', result?.message || 'Cancellation failed.');
        setCancelModal((prev) => ({ ...prev, busy: false }));
      }
    } catch (err) {
      showNotice('Error', 'Cancellation failed: ' + err.message);
      setCancelModal((prev) => ({ ...prev, busy: false }));
    }
  };

  // Build Default Columns (Exact 18 columns for Sales Display; order-tailored columns for Sales Order Display)
  const defaultColumns = useMemo(() => {
    if (isOrder) {
      return [
        {
          key: 'sno',
          title: 'S.No.',
          getText: (_row, idx) => String(idx + 1),
          render: (_row, idx) => <span style={{ fontWeight: 700, color: '#475569' }}>{idx + 1}</span>
        },
        {
          key: 'doc_no',
          title: 'Order No.',
          getText: (row) => String(row.inv_no || row.s_no || row.id || ''),
          render: (row) => (
            <div>
              <div style={{ fontWeight: 800, color: '#1e3a8a' }}>SO #{row.inv_no || row.s_no || row.id}</div>
              {row.voucher_no && <div style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>{row.voucher_no}</div>}
            </div>
          )
        },
        {
          key: 'date',
          title: 'Date',
          getText: (row) => formatDateDMY(row.date),
          render: (row) => <span style={{ whiteSpace: 'nowrap' }}>{formatDateDMY(row.date)}</span>
        },
        {
          key: 'customer',
          title: 'Customer',
          getText: (row) => `${row.customer_name || row.customer || ''}${row.party_state ? ` (${row.party_state})` : ''}`,
          render: (row) => (
            <div style={{ minWidth: '140px' }}>
              <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.customer_name || row.customer || '—'}</div>
              {row.party_state && <div style={{ fontSize: '10px', color: '#64748b' }}>{row.party_state}</div>}
            </div>
          )
        },
        {
          key: 'order_ref',
          title: 'Customer PO',
          getText: (row) => row.customer_po_no || row.p_o_no || row.po_no || '—',
          render: (row) => row.customer_po_no || row.p_o_no || row.po_no || <span style={{ color: '#94a3b8' }}>—</span>
        },
        {
          key: 'item_name',
          title: 'Item Name',
          getText: (row) => row.item_summary || row.item_name || '—',
          render: (row) => (
            <div title={row.item_name || ''} style={{ minWidth: '130px', fontWeight: 600 }}>
              {row.item_summary || row.item_name || '—'}
            </div>
          )
        },
        {
          key: 'lot_no',
          title: 'Lot No.',
          getText: (row) => row.lot_no || '—',
          render: (row) => {
            const lots = Array.isArray(row.unique_lots) ? row.unique_lots : [];
            if (lots.length === 0) return <span style={{ color: '#94a3b8' }}>—</span>;
            return (
              <span title={lots.join(', ')} style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8', fontSize: '11px' }}>
                {lots.length > 1 ? `${lots.length} Lots (${lots[0]}…)` : lots[0]}
              </span>
            );
          }
        },
        {
          key: 'qty_bags',
          title: 'Qty / Bags',
          align: 'right',
          getText: (row) => `${Number(row.qty || 0)} Bags`,
          render: (row) => (
            <div style={{ textAlign: 'right', fontWeight: 700 }}>
              {Number(row.qty || 0).toLocaleString('en-IN')} <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 500 }}>Bags</span>
            </div>
          )
        },
        {
          key: 'net_weight',
          title: 'Ordered Net Wt',
          align: 'right',
          getText: (row) => formatWeightCompact(row.product_net_weight || row.total_wt, true),
          render: (row) => (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700 }}>{formatWeightCompact(row.product_net_weight || row.total_wt, true)}</div>
              {Number(row.net_load_weight || 0) > 0 && (
                <div style={{ fontSize: '10px', color: '#0369a1' }}>WB: {formatWeightCompact(row.net_load_weight)}</div>
              )}
            </div>
          )
        },
        {
          key: 'lorry_no',
          title: 'Vehicle No.',
          getText: (row) => row.lorry_no || '—',
          render: (row) => (row.lorry_no ? <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{row.lorry_no}</span> : <span style={{ color: '#94a3b8' }}>—</span>)
        },
        {
          key: 'freight',
          title: 'Freight',
          align: 'right',
          getText: (row) => (Number(row.freight_amount || 0) > 0 ? `${formatCurrencyCompact(row.freight_amount)} (${row.freight_paid_by || 'Buyer'})` : '—'),
          render: (row) => {
            const frAmt = Number(row.freight_amount || 0);
            if (frAmt <= 0) return <div style={{ textAlign: 'right', color: '#94a3b8' }}>—</div>;
            return (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 600 }}>{formatCurrencyCompact(frAmt)}</div>
                <div style={{ fontSize: '10px', color: '#64748b' }}>{row.freight_paid_by || 'Buyer'}</div>
              </div>
            );
          }
        },
        {
          key: 'delivery_date',
          title: 'Delivery Date',
          getText: (row) => formatDateDMY(row.delivery_date || row.expected_delivery_date),
          render: (row) => formatDateDMY(row.delivery_date || row.expected_delivery_date)
        },
        {
          key: 'grand_total',
          title: 'Order Total',
          align: 'right',
          getText: (row) => formatCurrencyCompact(row.grand_total || row.total_amt || 0),
          render: (row) => (
            <div style={{ textAlign: 'right', fontWeight: 800, color: '#1e3a8a' }}>
              {formatCurrencyCompact(row.grand_total || row.total_amt || 0)}
            </div>
          )
        },
        {
          key: 'dispatch_status',
          title: 'Status',
          getText: (row) => row.computed_dispatch_status || 'Open Order',
          render: (row) => {
            const st = row.computed_dispatch_status || 'Open Order';
            return (
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  backgroundColor: st === 'Cancelled' ? '#f1f5f9' : '#dbeafe',
                  color: st === 'Cancelled' ? '#64748b' : '#1e40af'
                }}
              >
                {st}
              </span>
            );
          }
        }
      ];
    }

    // Exact 17 data columns + Actions = 18 Default Columns for Sales Display
    return [
      {
        key: 'sno',
        title: 'S.No.',
        getText: (_row, idx) => String(idx + 1),
        render: (_row, idx) => <span style={{ fontWeight: 700, color: '#475569' }}>{idx + 1}</span>
      },
      {
        key: 'doc_no',
        title: 'Doc No.',
        getText: (row) => String(row.inv_no || row.s_no || row.voucher_no || row.id || ''),
        render: (row) => (
          <div style={{ whiteSpace: 'nowrap' }}>
            <div style={{ fontWeight: 800, color: '#1e3a8a' }}>{row.inv_no || row.s_no || row.id}</div>
            {row.voucher_no && (
              <div style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>{row.voucher_no}</div>
            )}
          </div>
        )
      },
      {
        key: 'date',
        title: 'Date',
        getText: (row) => formatDateDMY(row.date),
        render: (row) => <span style={{ whiteSpace: 'nowrap' }}>{formatDateDMY(row.date)}</span>
      },
      {
        key: 'customer',
        title: 'Customer',
        getText: (row) => `${row.customer_name || row.customer || ''}${row.party_state ? ` (${row.party_state})` : ''}`,
        render: (row) => (
          <div style={{ minWidth: '140px' }}>
            <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.customer_name || row.customer || '—'}</div>
            {row.party_state && <div style={{ fontSize: '10px', color: '#64748b' }}>{row.party_state}</div>}
          </div>
        )
      },
      {
        key: 'order_no',
        title: 'Order No.',
        getText: (row) => row.sales_order_ref || row.customer_po_no || row.p_o_no || row.po_no || '—',
        render: (row) => {
          const ref = row.sales_order_ref || row.customer_po_no || row.p_o_no || row.po_no;
          return ref ? (
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>{ref}</span>
          ) : (
            <span style={{ color: '#94a3b8' }}>—</span>
          );
        }
      },
      {
        key: 'outpass_challan',
        title: 'Outpass / Challan',
        getText: (row) => [row.outpass_no, row.delivery_challan_no].filter(Boolean).join(' / ') || '—',
        render: (row) => {
          if (!row.outpass_no && !row.delivery_challan_no) return <span style={{ color: '#94a3b8' }}>—</span>;
          return (
            <div style={{ whiteSpace: 'nowrap' }}>
              {row.outpass_no && (
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#1d4ed8',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    fontSize: '11px'
                  }}
                >
                  {row.outpass_no}
                </span>
              )}
              {row.delivery_challan_no && (
                <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>Chln: {row.delivery_challan_no}</div>
              )}
            </div>
          );
        }
      },
      {
        key: 'item_name',
        title: 'Item Name',
        getText: (row) => row.item_summary || row.item_name || '—',
        render: (row) => (
          <div title={row.item_name || ''} style={{ minWidth: '130px', fontWeight: 600, color: '#0f172a' }}>
            {row.item_summary || row.item_name || '—'}
          </div>
        )
      },
      {
        key: 'lot_no',
        title: 'Lot No.',
        getText: (row) => row.lot_no || '—',
        render: (row) => {
          const lots = Array.isArray(row.unique_lots) ? row.unique_lots : [];
          if (lots.length === 0) return <span style={{ color: '#94a3b8' }}>—</span>;
          return (
            <span
              title={lots.join(', ')}
              style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8', fontSize: '11px', whiteSpace: 'nowrap' }}
            >
              {lots.length > 1 ? `${lots.length} Lots (${lots[0]}…)` : lots[0]}
            </span>
          );
        }
      },
      {
        key: 'qty_bags',
        title: 'Qty / Bags',
        align: 'right',
        getText: (row) => `${Number(row.qty || 0)} Bags`,
        render: (row) => (
          <div style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700 }}>
            {Number(row.qty || 0).toLocaleString('en-IN')}{' '}
            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 500 }}>Bags</span>
          </div>
        )
      },
      {
        key: 'net_weight',
        title: 'Net Weight',
        align: 'right',
        getText: (row) => formatWeightCompact(row.confirmed_dispatched_weight, true),
        render: (row) => {
          const dispWt = Number(row.confirmed_dispatched_weight || 0);
          const invWt = Number(row.product_net_weight || row.total_wt || 0);
          return (
            <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }} title={`Confirmed Dispatched: ${dispWt} kg | Invoice Product Wt: ${invWt} kg`}>
              <div style={{ fontWeight: 700, color: dispWt > 0 ? '#0f172a' : '#94a3b8' }}>
                {dispWt > 0 ? formatWeightCompact(dispWt) : '0 kg'}
              </div>
              {dispWt <= 0 && invWt > 0 && (
                <div style={{ fontSize: '10px', color: '#64748b' }}>Inv: {formatWeightCompact(invWt)}</div>
              )}
            </div>
          );
        }
      },
      {
        key: 'lorry_no',
        title: 'Vehicle No.',
        getText: (row) => row.lorry_no || '—',
        render: (row) =>
          row.lorry_no ? (
            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '11px', whiteSpace: 'nowrap' }}>{row.lorry_no}</span>
          ) : (
            <span style={{ color: '#94a3b8' }}>—</span>
          )
      },
      {
        key: 'freight',
        title: 'Freight',
        align: 'right',
        getText: (row) => (Number(row.freight_amount || 0) > 0 ? `${formatCurrencyCompact(row.freight_amount)} (${row.freight_paid_by || 'Buyer'})` : '—'),
        render: (row) => {
          const frAmt = Number(row.freight_amount || 0);
          if (frAmt <= 0) return <div style={{ textAlign: 'right', color: '#94a3b8' }}>—</div>;
          return (
            <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
              <div style={{ fontWeight: 600 }}>{formatCurrencyCompact(frAmt)}</div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>{row.freight_paid_by || 'Buyer'}</div>
            </div>
          );
        }
      },
      {
        key: 'grand_total',
        title: 'Invoice Total',
        align: 'right',
        getText: (row) => formatCurrencyCompact(row.grand_total || row.total_amt || 0),
        render: (row) => (
          <div style={{ textAlign: 'right', fontWeight: 800, color: '#1e3a8a', whiteSpace: 'nowrap' }}>
            {formatCurrencyCompact(row.grand_total || row.total_amt || 0)}
          </div>
        )
      },
      {
        key: 'received_amount',
        title: 'Received Amount',
        align: 'right',
        getText: (row) => formatCurrencyCompact(row.actual_received_amount || 0),
        render: (row) => {
          const rec = Number(row.actual_received_amount || 0);
          return (
            <div style={{ textAlign: 'right', fontWeight: 700, color: rec > 0 ? '#15803d' : '#64748b', whiteSpace: 'nowrap' }}>
              {formatCurrencyCompact(rec)}
            </div>
          );
        }
      },
      {
        key: 'balance_due',
        title: 'Balance Due',
        align: 'right',
        getText: (row) => formatCurrencyCompact(row.actual_balance_due || 0),
        render: (row) => {
          const due = Number(row.actual_balance_due || 0);
          return (
            <div style={{ textAlign: 'right', fontWeight: 700, color: due > 0.01 ? '#b91c1c' : '#15803d', whiteSpace: 'nowrap' }}>
              {formatCurrencyCompact(due)}
            </div>
          );
        }
      },
      {
        key: 'payment_status',
        title: 'Payment Status',
        getText: (row) => row.payment_status || 'Unpaid',
        render: (row) => {
          const st = row.payment_status || 'Unpaid';
          const bg =
            st === 'Paid' ? '#dcfce7' : st === 'Partially Paid' ? '#fef3c7' : st === 'Cancelled' ? '#f1f5f9' : '#fee2e2';
          const color =
            st === 'Paid' ? '#166534' : st === 'Partially Paid' ? '#92400e' : st === 'Cancelled' ? '#64748b' : '#991b1b';
          return (
            <span
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: bg,
                color,
                fontSize: '11px',
                fontWeight: 700,
                whiteSpace: 'nowrap'
              }}
            >
              {st}
            </span>
          );
        }
      },
      {
        key: 'dispatch_status',
        title: 'Dispatch Status',
        getText: (row) => row.computed_dispatch_status || 'Pending',
        render: (row) => {
          const st = row.computed_dispatch_status || 'Pending';
          const bg =
            st === 'Delivered'
              ? '#ccfbf1'
              : st === 'Dispatched'
              ? '#dcfce7'
              : st === 'Partially Dispatched'
              ? '#fef3c7'
              : st === 'Cancelled'
              ? '#f1f5f9'
              : '#e0f2fe';
          const color =
            st === 'Delivered'
              ? '#115e59'
              : st === 'Dispatched'
              ? '#166534'
              : st === 'Partially Dispatched'
              ? '#92400e'
              : st === 'Cancelled'
              ? '#64748b'
              : '#0369a1';
          return (
            <span
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: bg,
                color,
                fontSize: '11px',
                fontWeight: 700,
                whiteSpace: 'nowrap'
              }}
            >
              {st}
            </span>
          );
        }
      }
    ];
  }, [isOrder]);

  const activeColumns = useMemo(() => {
    const chosenOptional = OPTIONAL_COLUMN_DEFINITIONS.filter((c) => visibleOptionalKeys.includes(c.key));
    return [...defaultColumns, ...chosenOptional];
  }, [defaultColumns, visibleOptionalKeys]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const handleToggleOptionalCol = (key) => {
    setVisibleOptionalKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleExportExcel = () => {
    if (!filteredRows.length) {
      showNotice('Notice', 'No matching sales records to export.');
      return;
    }
    const exportCols = activeColumns.map((col) => ({
      key: col.key,
      title: col.title,
      render: (_val, row, idx) => col.getText(row, idx)
    }));
    const sheetTitle = isOrder ? 'Sales_Orders' : 'Sales_Register';
    const fileLabel = isOrder ? 'Sales_Order_Display' : 'Sales_Display';
    exportToExcel(filteredRows, fileLabel, exportCols, sheetTitle);
  };

  const handlePrintList = () => {
    if (!filteredRows.length) {
      showNotice('Notice', 'No matching sales records to print.');
      return;
    }
    const compName = selectedCompany?.name || 'BVC Exports Pvt Ltd';
    const fyLabel = filterFY !== 'ALL' ? filterFY : financialYear || '2026-2027';
    const periodLabel =
      fromDate || toDate
        ? `${fromDate ? formatDateDMY(fromDate) : 'Start'} to ${toDate ? formatDateDMY(toDate) : 'Today'}`
        : 'All Dates';
    const filterParts = [];
    if (filterCustomer) filterParts.push(`Customer: ${filterCustomer}`);
    if (filterItem) filterParts.push(`Item: ${filterItem}`);
    if (filterPayStatus) filterParts.push(`Payment: ${filterPayStatus}`);
    if (filterDispatchStatus) filterParts.push(`Dispatch: ${filterDispatchStatus}`);
    if (searchTerm) filterParts.push(`Search: "${searchTerm}"`);

    const thHtml = activeColumns
      .map(
        (c) =>
          `<th style="border:1px solid #1e3a8a;background:#1f4fb2;color:#ffffff;padding:6px 7px;font-size:10px;text-align:${
            c.align === 'right' ? 'right' : 'left'
          };white-space:nowrap;">${escHtml(c.title)}</th>`
      )
      .join('');

    const tbodyHtml = filteredRows
      .map((row, idx) => {
        const tds = activeColumns
          .map(
            (c) =>
              `<td style="border:1px solid #cbd5e1;padding:5px 7px;font-size:10px;text-align:${
                c.align === 'right' ? 'right' : 'left'
              };vertical-align:top;">${escHtml(c.getText(row, idx))}</td>`
          )
          .join('');
        return `<tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">${tds}</tr>`;
      })
      .join('');

    let totalFreight = 0;
    filteredRows.forEach((r) => {
      if (!r.is_cancelled) totalFreight += Number(r.freight_amount || 0);
    });

    const tfootCells = activeColumns
      .map((c, idx) => {
        if (idx === 0) return `<td style="border:1px solid #cbd5e1;padding:6px 7px;font-weight:800;">TOTAL</td>`;
        if (c.key === 'qty_bags') return `<td style="border:1px solid #cbd5e1;padding:6px 7px;text-align:right;font-weight:800;">${kpiSummary.totalQty.toLocaleString('en-IN')}</td>`;
        if (c.key === 'net_weight') {
          const wt = isOrder ? kpiSummary.totalOrderWt : kpiSummary.totalDispatchedWt;
          return `<td style="border:1px solid #cbd5e1;padding:6px 7px;text-align:right;font-weight:800;">${formatWeightCompact(wt, true)}</td>`;
        }
        if (c.key === 'freight') return `<td style="border:1px solid #cbd5e1;padding:6px 7px;text-align:right;font-weight:800;">${formatCurrencyCompact(totalFreight)}</td>`;
        if (c.key === 'grand_total') return `<td style="border:1px solid #cbd5e1;padding:6px 7px;text-align:right;font-weight:800;">${formatCurrencyCompact(kpiSummary.totalSales)}</td>`;
        if (c.key === 'received_amount') return `<td style="border:1px solid #cbd5e1;padding:6px 7px;text-align:right;font-weight:800;">${formatCurrencyCompact(kpiSummary.totalReceived)}</td>`;
        if (c.key === 'balance_due') return `<td style="border:1px solid #cbd5e1;padding:6px 7px;text-align:right;font-weight:800;">${formatCurrencyCompact(kpiSummary.totalOutstanding)}</td>`;
        return `<td style="border:1px solid #cbd5e1;padding:6px 7px;"></td>`;
      })
      .join('');

    const html = `
      <style>
        @page { size: A4 landscape; margin: 8mm; }
      </style>
      <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; padding: 6px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #1f4fb2;padding-bottom:8px;margin-bottom:10px;">
          <div>
            <h2 style="margin:0;color:#1f4fb2;font-size:18px;font-weight:800;">${escHtml(compName)}</h2>
            <div style="font-size:11px;color:#475569;">Financial Year: <strong>${escHtml(fyLabel)}</strong> | Period: <strong>${escHtml(periodLabel)}</strong></div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:15px;font-weight:800;color:#1e3a8a;">${isOrder ? 'SALES ORDER REGISTER' : 'SALES INVOICE REGISTER'}</div>
            <div style="font-size:10px;color:#64748b;">Generated: ${escHtml(new Date().toLocaleString())} | Records: ${filteredRows.length}</div>
          </div>
        </div>
        ${filterParts.length ? `<div style="font-size:10px;color:#475569;margin-bottom:8px;"><strong>Active Filters:</strong> ${escHtml(filterParts.join(' | '))}</div>` : ''}
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr>${thHtml}</tr></thead>
          <tbody>${tbodyHtml}</tbody>
          <tfoot><tr style="background:#e2e8f0;">${tfootCells}</tr></tfoot>
        </table>
      </div>
    `;
    printHtml(html, isOrder ? 'Sales Order Register' : 'Sales Invoice Register');
  };

  return (
    <div style={{ padding: '14px 16px', backgroundColor: '#f1f5f9', minHeight: '100vh' }}>
      <style>{`
        .sales-reg-row:hover {
          background-color: #f1f5f9 !important;
        }
        .sales-reg-row[data-highlighted="true"],
        .sales-reg-row[data-highlighted="true"]:hover {
          background-color: #fef08a !important;
        }
      `}</style>

      {/* Blue ERP Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1f4fb2 0%, #2a5ea0 100%)',
          color: '#ffffff',
          padding: '12px 18px',
          borderRadius: '8px 8px 0 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          boxShadow: '0 2px 6px rgba(30, 58, 138, 0.18)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              backgroundColor: '#ffffff',
              color: '#1e293b',
              border: '1px solid #cbd5e1',
              borderRadius: '5px',
              padding: '5px 12px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            ← Back
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, letterSpacing: '0.2px' }}>
              {isOrder ? 'Sales Order Display' : 'Sales Display'}
            </h2>
            <div style={{ fontSize: '11px', color: '#dbeafe', marginTop: '1px' }}>
              {selectedCompany?.name || 'BVC Exports Pvt Ltd'} · FY {financialYear || '2026-2027'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={fetchData}
            style={{
              backgroundColor: '#ffffff',
              color: '#1e3a8a',
              border: 'none',
              borderRadius: '5px',
              padding: '7px 13px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            ↻ Refresh
          </button>

          {/* Column Visibility Selector */}
          <div style={{ position: 'relative' }} ref={colMenuRef}>
            <button
              type="button"
              onClick={() => setColMenuOpen((prev) => !prev)}
              style={{
                backgroundColor: visibleOptionalKeys.length > 0 ? '#fef3c7' : '#ffffff',
                color: visibleOptionalKeys.length > 0 ? '#92400e' : '#1e3a8a',
                border: 'none',
                borderRadius: '5px',
                padding: '7px 13px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              ⚙ Columns{visibleOptionalKeys.length > 0 ? ` (+${visibleOptionalKeys.length})` : ''}
            </button>
            {colMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '110%',
                  zIndex: 1200,
                  width: '280px',
                  maxHeight: '380px',
                  overflowY: 'auto',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  boxShadow: '0 14px 30px rgba(15, 23, 42, 0.22)',
                  padding: '10px 12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#1e3a8a' }}>Optional Columns (18)</span>
                  <button
                    type="button"
                    onClick={() => setVisibleOptionalKeys([])}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#dc2626',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Reset Default
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '5px' }}>
                  {OPTIONAL_COLUMN_DEFINITIONS.map((col) => {
                    const checked = visibleOptionalKeys.includes(col.key);
                    return (
                      <label
                        key={col.key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          padding: '3px 4px',
                          borderRadius: '4px',
                          backgroundColor: checked ? '#eff6ff' : 'transparent'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleOptionalCol(col.key)}
                        />
                        <span style={{ fontWeight: checked ? 700 : 500 }}>{col.title}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleExportExcel}
            style={{
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '5px',
              padding: '7px 13px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            📊 Export Excel
          </button>

          <button
            type="button"
            onClick={handlePrintList}
            style={{
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '5px',
              padding: '7px 13px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            🖨 Print List
          </button>

          {canCreate && (
            <button
              type="button"
              onClick={() => navigate(isOrder ? '/entry/sales-order-create' : '/entry/sales-create')}
              style={{
                backgroundColor: '#1e3a8a',
                color: '#ffffff',
                border: '1px solid #93c5fd',
                borderRadius: '5px',
                padding: '7px 15px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              + Create New {isOrder ? 'Sales Order' : 'Sales'}
            </button>
          )}
        </div>
      </div>

      {/* Main White Body Card */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #cbd5e1',
          borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          padding: '14px 16px'
        }}
      >
        {notice && (
          <div
            style={{
              marginBottom: '12px',
              padding: '10px 14px',
              borderRadius: '6px',
              backgroundColor: notice.title === 'Error' ? '#fef2f2' : notice.title === 'Notice' ? '#fffbeb' : '#f0fdf4',
              border: `1px solid ${notice.title === 'Error' ? '#fca5a5' : notice.title === 'Notice' ? '#fcd34d' : '#86efac'}`,
              color: notice.title === 'Error' ? '#991b1b' : notice.title === 'Notice' ? '#92400e' : '#166534',
              fontSize: '12px',
              fontWeight: 600
            }}
          >
            <strong>{notice.title}:</strong> {notice.message}
          </div>
        )}

        {fetchError && (
          <div
            style={{
              marginBottom: '12px',
              padding: '10px 14px',
              borderRadius: '6px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fca5a5',
              color: '#991b1b',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <span>Error loading data: {fetchError}</span>
            <button
              type="button"
              onClick={fetchData}
              style={{ backgroundColor: '#1f4fb2', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer' }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Top 4 KPI Summary Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px',
            marginBottom: '14px'
          }}
        >
          <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>
              {isOrder ? 'Total Order Value' : 'Total Sales'}
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#1e3a8a', marginTop: '3px' }}>
              {formatCurrencyCompact(kpiSummary.totalSales)}
            </div>
            <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
              {kpiSummary.activeCount} active {isOrder ? 'order(s)' : 'invoice(s)'}
            </div>
          </div>

          <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
              {isOrder ? 'Total Ordered Qty' : 'Total Received'}
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#15803d', marginTop: '3px' }}>
              {isOrder ? `${kpiSummary.totalQty.toLocaleString('en-IN')} Bags` : formatCurrencyCompact(kpiSummary.totalReceived)}
            </div>
            <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
              {isOrder ? 'Across filtered active orders' : 'Verified receipts & advance adjusted'}
            </div>
          </div>

          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>
              {isOrder ? 'Open Orders' : 'Total Outstanding'}
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#b91c1c', marginTop: '3px' }}>
              {isOrder ? kpiSummary.activeCount : formatCurrencyCompact(kpiSummary.totalOutstanding)}
            </div>
            <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
              {isOrder ? 'Ready for invoice conversion' : 'Pending customer balance'}
            </div>
          </div>

          <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '10px 14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>
              {isOrder ? 'Total Ordered Net Weight' : 'Total Dispatched Weight'}
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0c4a6e', marginTop: '3px' }}>
              {formatWeightCompact(isOrder ? kpiSummary.totalOrderWt : kpiSummary.totalDispatchedWt, true)}
            </div>
            <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
              {isOrder ? 'Net product weight ordered' : 'Confirmed gate outpass / outward stock wt'}
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div
          style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '10px 12px',
            marginBottom: '12px'
          }}
        >
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search Doc No, Customer, GSTIN, PO, Item, Lot, Vehicle, Outpass, Challan..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                flex: '1 1 280px',
                minWidth: '220px',
                height: '34px',
                minHeight: '34px',
                lineHeight: '1.35',
                boxSizing: 'border-box',
                padding: '4px 10px',
                border: '1px solid #cbd5e1',
                borderRadius: '5px',
                fontSize: '12.5px',
                color: '#0f172a',
                backgroundColor: '#ffffff'
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#334155' }}>
              <span>From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ height: '34px', minHeight: '34px', lineHeight: '1.35', boxSizing: 'border-box', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '12.5px', color: '#0f172a', backgroundColor: '#ffffff' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#334155' }}>
              <span>To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ height: '34px', minHeight: '34px', lineHeight: '1.35', boxSizing: 'border-box', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '12.5px', color: '#0f172a', backgroundColor: '#ffffff' }}
              />
            </div>

            <select
              value={filterFY}
              onChange={(e) => {
                setFilterFY(e.target.value);
                setCurrentPage(1);
              }}
              style={{ height: '34px', minHeight: '34px', minWidth: '115px', lineHeight: '1.35', boxSizing: 'border-box', padding: '4px 10px', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '12.5px', color: '#0f172a', backgroundColor: '#ffffff' }}
              title="Financial Year"
            >
              <option value="ALL">All FY</option>
              {filterOptions.fys.map((fy) => (
                <option key={fy} value={fy}>
                  FY {fy}
                </option>
              ))}
            </select>

            {!isOrder && (
              <>
                <select
                  value={filterPayStatus}
                  onChange={(e) => {
                    setFilterPayStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{ height: '34px', minHeight: '34px', minWidth: '155px', lineHeight: '1.35', boxSizing: 'border-box', padding: '4px 10px', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '12.5px', color: '#0f172a', backgroundColor: '#ffffff' }}
                >
                  <option value="">All Payment Status</option>
                  <option value="Paid">Paid</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Unpaid">Unpaid</option>
                </select>

                <select
                  value={filterDispatchStatus}
                  onChange={(e) => {
                    setFilterDispatchStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{ height: '34px', minHeight: '34px', minWidth: '165px', lineHeight: '1.35', boxSizing: 'border-box', padding: '4px 10px', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '12.5px', color: '#0f172a', backgroundColor: '#ffffff' }}
                >
                  <option value="">All Dispatch Status</option>
                  <option value="Pending">Pending</option>
                  <option value="Partially Dispatched">Partially Dispatched</option>
                  <option value="Dispatched">Dispatched</option>
                  <option value="Delivered">Delivered</option>
                </select>
              </>
            )}

            <button
              type="button"
              onClick={() => setShowMoreFilters((prev) => !prev)}
              style={{
                backgroundColor: showMoreFilters ? '#1e3a8a' : '#e2e8f0',
                color: showMoreFilters ? '#ffffff' : '#1e293b',
                border: 'none',
                borderRadius: '5px',
                padding: '7px 11px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {showMoreFilters ? '▲ Less Filters' : '▼ More Filters'}
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                style={{
                  backgroundColor: '#fee2e2',
                  color: '#991b1b',
                  border: '1px solid #fecaca',
                  borderRadius: '5px',
                  padding: '6px 11px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                ✕ Clear Filters
              </button>
            )}
          </div>

          {showMoreFilters && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
                gap: '8px',
                marginTop: '10px',
                paddingTop: '10px',
                borderTop: '1px solid #e2e8f0'
              }}
            >
              <select
                value={filterCustomer}
                onChange={(e) => {
                  setFilterCustomer(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ height: '34px', minHeight: '34px', lineHeight: '1.35', boxSizing: 'border-box', padding: '4px 10px', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '12.5px', color: '#0f172a', backgroundColor: '#ffffff' }}
              >
                <option value="">All Customers</option>
                {filterOptions.customers.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={filterItem}
                onChange={(e) => {
                  setFilterItem(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ height: '34px', minHeight: '34px', lineHeight: '1.35', boxSizing: 'border-box', padding: '4px 10px', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '12.5px', color: '#0f172a', backgroundColor: '#ffffff' }}
              >
                <option value="">All Items / Products</option>
                {filterOptions.items.map((it) => (
                  <option key={it} value={it}>
                    {it}
                  </option>
                ))}
              </select>

              <select
                value={filterGodown}
                onChange={(e) => {
                  setFilterGodown(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ height: '34px', minHeight: '34px', lineHeight: '1.35', boxSizing: 'border-box', padding: '4px 10px', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '12.5px', color: '#0f172a', backgroundColor: '#ffffff' }}
              >
                <option value="">All Godowns</option>
                {filterOptions.godowns.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>

              <select
                value={filterPayType}
                onChange={(e) => {
                  setFilterPayType(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ height: '34px', minHeight: '34px', lineHeight: '1.35', boxSizing: 'border-box', padding: '4px 10px', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '12.5px', color: '#0f172a', backgroundColor: '#ffffff' }}
              >
                <option value="">All Sales Types</option>
                <option value="Cash">Cash</option>
                <option value="Credit">Credit</option>
                <option value="Partial">Partial</option>
              </select>

              <select
                value={filterTransporter}
                onChange={(e) => {
                  setFilterTransporter(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ height: '34px', minHeight: '34px', lineHeight: '1.35', boxSizing: 'border-box', padding: '4px 10px', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '12.5px', color: '#0f172a', backgroundColor: '#ffffff' }}
              >
                <option value="">All Transporters</option>
                {filterOptions.transporters.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <select
                value={filterRecordStatus}
                onChange={(e) => {
                  setFilterRecordStatus(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ height: '34px', minHeight: '34px', lineHeight: '1.35', boxSizing: 'border-box', padding: '4px 10px', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '12.5px', color: '#0f172a', backgroundColor: '#ffffff' }}
              >
                <option value="ACTIVE">Active Records Only</option>
                <option value="ALL">All (Include Cancelled)</option>
                <option value="CANCELLED">Cancelled Only</option>
              </select>
            </div>
          )}
        </div>

        {/* Main Sales Register Table */}
        <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '1480px' }}>
            <thead>
              <tr style={{ backgroundColor: '#1f4fb2', color: '#ffffff' }}>
                {activeColumns.map((col) => (
                  <th
                    key={col.key}
                    style={{
                      padding: '10px 9px',
                      borderBottom: '2px solid #1e3a8a',
                      borderRight: '1px solid rgba(255,255,255,0.16)',
                      textAlign: col.align === 'right' ? 'right' : 'left',
                      fontWeight: 700,
                      fontSize: '11.5px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {col.title}
                  </th>
                ))}
                <th
                  style={{
                    padding: '10px 9px',
                    borderBottom: '2px solid #1e3a8a',
                    textAlign: 'center',
                    fontWeight: 700,
                    fontSize: '11.5px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={activeColumns.length + 1} style={{ padding: '28px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                    Loading {isOrder ? 'sales orders' : 'sales register'}...
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={activeColumns.length + 1} style={{ padding: '28px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                    No matching {isOrder ? 'sales orders' : 'sales records'} found.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, pIdx) => {
                  const globalIdx = (currentPage - 1) * pageSize + pIdx;
                  const highlighted = isRowHighlighted(row);
                  const firstItem = Array.isArray(row.items) && row.items[0] ? row.items[0] : {};
                  const lotNo = firstItem.lot_no || row.primary_lot_no || row.lot_no || '';
                  const qcId = firstItem.qc_id || row.qc_id;
                  const amt = Number(row.grand_total || row.total_amt || 0);

                  return (
                    <tr
                      key={row.id || globalIdx}
                      className="sales-reg-row"
                      data-highlighted={highlighted ? 'true' : 'false'}
                      style={{
                        backgroundColor: highlighted ? '#fef08a' : pIdx % 2 === 0 ? '#ffffff' : '#f8fafc',
                        borderBottom: '1px solid #e2e8f0'
                      }}
                    >
                      {activeColumns.map((col) => (
                        <td
                          key={col.key}
                          style={{
                            padding: '8px 9px',
                            borderRight: '1px solid #e2e8f0',
                            color: '#1e293b',
                            verticalAlign: 'middle'
                          }}
                        >
                          {col.render(row, globalIdx)}
                        </td>
                      ))}

                      <td style={{ padding: '7px 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center', minWidth: '290px' }}>
                          <button
                            type="button"
                            onClick={() => setViewModal({ open: true, record: row })}
                            style={{
                              backgroundColor: '#0f766e',
                              color: '#ffffff',
                              border: 'none',
                              padding: '4px 9px',
                              borderRadius: '4px',
                              fontWeight: 700,
                              fontSize: '11px',
                              cursor: 'pointer'
                            }}
                            title="View Complete 7-Section Sales Details (Read-Only)"
                          >
                            View
                          </button>

                          {isOrder && !row.is_cancelled && canCreate && (
                            <button
                              type="button"
                              onClick={() => navigate(`/entry/sales-create?fromOrder=${row.id}`)}
                              style={{
                                backgroundColor: '#15803d',
                                color: '#ffffff',
                                border: 'none',
                                padding: '4px 9px',
                                borderRadius: '4px',
                                fontWeight: 700,
                                fontSize: '11px',
                                cursor: 'pointer'
                              }}
                              title="Convert Sales Order to Sales Invoice"
                            >
                              Convert Invoice
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setLedgerModal({ open: true, salesId: row.id, salesData: row })}
                            style={{
                              backgroundColor: '#4338ca',
                              color: '#ffffff',
                              border: 'none',
                              padding: '4px 9px',
                              borderRadius: '4px',
                              fontWeight: 700,
                              fontSize: '11px',
                              cursor: 'pointer'
                            }}
                            title="View Sales Transaction Ledger Statement"
                          >
                            Ledger
                          </button>

                          {!isOrder && (row.outpass_id || row.outpass_no) && (
                            <button
                              type="button"
                              onClick={() => handlePrintOutpass(row)}
                              style={{
                                backgroundColor: '#0369a1',
                                color: '#ffffff',
                                border: 'none',
                                padding: '4px 9px',
                                borderRadius: '4px',
                                fontWeight: 700,
                                fontSize: '11px',
                                cursor: 'pointer'
                              }}
                              title={`Print Gate Outpass ${row.outpass_no || ''}`}
                            >
                              Outpass
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              setActiveDoc({
                                documentType: isOrder ? 'Sales Order' : 'Sales Invoice',
                                documentId: row.id || row.s_no,
                                documentNo: row.inv_no || (row.s_no ? `SI-${row.s_no}` : `SI-${row.id}`),
                                partyName: row.customer_name || row.customer || 'Customer',
                                totalAmount: amt,
                                date: row.date ? String(row.date).substring(0, 10) : new Date().toISOString().split('T')[0],
                                itemSummary: row.item_name ? `${row.item_name} (${row.qty || 0} bags)` : 'Sales Goods',
                                status: row.is_cancelled ? 'CANCELLED' : 'VALID'
                              })
                            }
                            style={{
                              backgroundColor: '#0f172a',
                              color: '#ffffff',
                              border: 'none',
                              padding: '4px 9px',
                              borderRadius: '4px',
                              fontWeight: 700,
                              fontSize: '11px',
                              cursor: 'pointer'
                            }}
                            title="Digital Document & QR"
                          >
                            Digital Doc
                          </button>

                          {canEdit && !row.is_cancelled && (
                            <button
                              type="button"
                              onClick={() => handleEdit(row)}
                              style={{
                                backgroundColor: '#1976d2',
                                color: '#ffffff',
                                border: 'none',
                                padding: '4px 9px',
                                borderRadius: '4px',
                                fontWeight: 700,
                                fontSize: '11px',
                                cursor: 'pointer'
                              }}
                            >
                              Update
                            </button>
                          )}

                          {canPrint && (
                            <button
                              type="button"
                              onClick={() => handlePrint(row)}
                              style={{
                                backgroundColor: '#0288d1',
                                color: '#ffffff',
                                border: 'none',
                                padding: '4px 9px',
                                borderRadius: '4px',
                                fontWeight: 700,
                                fontSize: '11px',
                                cursor: 'pointer'
                              }}
                            >
                              Print
                            </button>
                          )}

                          {qcId ? (
                            <button
                              type="button"
                              onClick={() => navigate(`/quality/coa-display/${qcId}`)}
                              style={{
                                backgroundColor: '#2e7d32',
                                color: '#ffffff',
                                border: 'none',
                                padding: '4px 9px',
                                borderRadius: '4px',
                                fontWeight: 700,
                                fontSize: '11px',
                                cursor: 'pointer'
                              }}
                            >
                              COA Report
                            </button>
                          ) : (
                            lotNo && (
                              <button
                                type="button"
                                onClick={() => navigate(`/entry/quality-control-create?lotNo=${encodeURIComponent(lotNo)}`)}
                                style={{
                                  backgroundColor: '#00838f',
                                  color: '#ffffff',
                                  border: 'none',
                                  padding: '4px 9px',
                                  borderRadius: '4px',
                                  fontWeight: 700,
                                  fontSize: '11px',
                                  cursor: 'pointer'
                                }}
                              >
                                QC Test
                              </button>
                            )
                          )}

                          {(isAdmin || canDelete) && !row.is_cancelled && (
                            <button
                              type="button"
                              onClick={() => setCancelModal({ open: true, row, reason: '', busy: false })}
                              style={{
                                backgroundColor: '#dc2626',
                                color: '#ffffff',
                                border: 'none',
                                padding: '4px 9px',
                                borderRadius: '4px',
                                fontWeight: 700,
                                fontSize: '11px',
                                cursor: 'pointer'
                              }}
                              title="Controlled Cancellation (Reverts stock, outpass & vouchers)"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Total Records & Pagination Footer */}
        <div
          style={{
            marginTop: '12px',
            padding: '10px 14px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
            {filteredRows.length > 0
              ? `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredRows.length)} of ${filteredRows.length} | Total Records: ${filteredRows.length}`
              : 'Total Records: 0'}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '5px' }}>
              Rows:
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{ height: '30px', minHeight: '30px', minWidth: '64px', lineHeight: '1.35', boxSizing: 'border-box', padding: '3px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12.5px', color: '#0f172a', backgroundColor: '#ffffff' }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>

            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              style={{
                padding: '5px 11px',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                backgroundColor: currentPage <= 1 ? '#f1f5f9' : '#ffffff',
                color: currentPage <= 1 ? '#94a3b8' : '#1e293b',
                fontWeight: 700,
                fontSize: '12px',
                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer'
              }}
            >
              Prev
            </button>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e3a8a' }}>
              Page {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              style={{
                padding: '5px 11px',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                backgroundColor: currentPage >= totalPages ? '#f1f5f9' : '#ffffff',
                color: currentPage >= totalPages ? '#94a3b8' : '#1e293b',
                fontWeight: 700,
                fontSize: '12px',
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer'
              }}
            >
              Next
            </button>

            <button
              type="button"
              onClick={handlePrintList}
              style={{
                backgroundColor: '#1f4fb2',
                color: '#ffffff',
                border: 'none',
                borderRadius: '5px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              🖨 Print List
            </button>
          </div>
        </div>
      </div>

      {/* 7-Section Read-Only Detailed View Modal */}
      <SalesDetailViewModal
        isOpen={viewModal.open}
        onClose={() => setViewModal({ open: false, record: null })}
        record={viewModal.record}
        isOrder={isOrder}
        onPrint={handlePrint}
      />

      {/* Digital Document Modal */}
      {activeDoc && (
        <DigitalDocumentModal
          open={Boolean(activeDoc)}
          onClose={() => setActiveDoc(null)}
          documentType={activeDoc.documentType}
          documentId={activeDoc.documentId}
          documentNo={activeDoc.documentNo}
          partyName={activeDoc.partyName}
          totalAmount={activeDoc.totalAmount}
          date={activeDoc.date}
          itemSummary={activeDoc.itemSummary}
          status={activeDoc.status}
        />
      )}

      {/* Ledger Details Modal */}
      <SalesLedgerDetailsModal
        isOpen={ledgerModal.open}
        onClose={() => setLedgerModal({ open: false, salesId: null, salesData: null })}
        salesId={ledgerModal.salesId}
        salesData={ledgerModal.salesData}
      />

      {/* Controlled Cancellation Modal */}
      {cancelModal.open && cancelModal.row && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10600,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => !cancelModal.busy && setCancelModal({ open: false, row: null, reason: '', busy: false })}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              boxShadow: '0 20px 50px rgba(15, 23, 42, 0.3)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ backgroundColor: '#dc2626', color: '#ffffff', padding: '12px 16px', fontWeight: 800, fontSize: '15px' }}>
              Confirm Controlled Cancellation
            </div>
            <div style={{ padding: '16px', fontSize: '13px', color: '#1e293b' }}>
              <p style={{ marginTop: 0, marginBottom: '10px', lineHeight: 1.5 }}>
                You are cancelling{' '}
                <strong>
                  {isOrder ? `Sales Order #${cancelModal.row.inv_no || cancelModal.row.s_no}` : `Invoice #${cancelModal.row.inv_no || cancelModal.row.s_no}`}
                </strong>{' '}
                for <strong>{cancelModal.row.customer_name || cancelModal.row.customer}</strong>.
              </p>
              <p style={{ marginTop: 0, marginBottom: '12px', fontSize: '12px', color: '#475569' }}>
                This will revert stock levels, reverse accounting vouchers, archive the snapshot to the Recycle Bin
                {cancelModal.row.outpass_no ? `, and cancel linked Outpass (${cancelModal.row.outpass_no})` : ''}.
              </p>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
                Cancellation Reason (Optional)
              </label>
              <input
                type="text"
                value={cancelModal.reason}
                onChange={(e) => setCancelModal((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder="e.g., Duplicate entry, Customer order cancelled..."
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '5px',
                  fontSize: '12px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div style={{ padding: '10px 16px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                disabled={cancelModal.busy}
                onClick={() => setCancelModal({ open: false, row: null, reason: '', busy: false })}
                style={{
                  padding: '7px 14px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '5px',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Keep Record
              </button>
              <button
                type="button"
                disabled={cancelModal.busy}
                onClick={handleConfirmCancel}
                style={{
                  padding: '7px 14px',
                  border: 'none',
                  borderRadius: '5px',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: cancelModal.busy ? 'wait' : 'pointer'
                }}
              >
                {cancelModal.busy ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesDisplayPage;
