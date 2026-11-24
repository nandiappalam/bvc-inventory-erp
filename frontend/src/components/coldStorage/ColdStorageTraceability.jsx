import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
  Chip,
  IconButton,
  CircularProgress,
  InputAdornment,
  Alert,
  Stack
} from '@mui/material';
import {
  AcUnit as ColdIcon,
  Search as SearchIcon,
  AltRoute as RouteIcon,
  Store as StoreIcon,
  Factory as FactoryIcon,
  LocalShipping as ShippingIcon,
  Print as PrintIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { api } from '../../services/api';
import { printHtml } from '../../utils/printHelper';

const escHtml = (val) => String(val ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const ColdStorageTraceability = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlQueryParam = (searchParams.get('lot') || searchParams.get('lotNo') || searchParams.get('query') || '').trim();

  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(urlQueryParam);
  const [traceResults, setTraceResults] = useState([]);
  const [availableLots, setAvailableLots] = useState([]);
  const [notice, setNotice] = useState('');
  const fetchSeqRef = useRef(0);
  const searchQueryRef = useRef(urlQueryParam);
  searchQueryRef.current = searchQuery;

  const fetchTraceability = useCallback(async (queryText = '') => {
    const seq = ++fetchSeqRef.current;
    setLoading(true);
    setNotice('');
    try {
      const q = String(queryText || '').trim();
      const url = q ? `/cold-storage/traceability?query=${encodeURIComponent(q)}` : `/cold-storage/traceability`;
      const res = await api(url);
      if (seq !== fetchSeqRef.current) return;
      if (res && res.data) {
        setTraceResults(res.data);
      } else {
        setTraceResults([]);
      }
      if (res && Array.isArray(res.availableColdLots)) {
        setAvailableLots(res.availableColdLots);
      }
    } catch (err) {
      if (seq !== fetchSeqRef.current) return;
      console.error('Error searching traceability:', err);
      setTraceResults([]);
      setNotice(err?.message || 'Failed to fetch Cold Storage traceability records.');
    } finally {
      if (seq === fetchSeqRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (urlQueryParam) {
      setSearchQuery(urlQueryParam);
      fetchTraceability(urlQueryParam);
    } else {
      fetchTraceability('');
    }
  }, [urlQueryParam, fetchTraceability]);

  useEffect(() => {
    const handleRefresh = () => {
      fetchTraceability(searchQueryRef.current);
    };
    window.addEventListener('erp_company_changed', handleRefresh);
    window.addEventListener('erp_stock_updated', handleRefresh);
    return () => {
      window.removeEventListener('erp_company_changed', handleRefresh);
      window.removeEventListener('erp_stock_updated', handleRefresh);
    };
  }, [fetchTraceability]);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    fetchTraceability(searchQuery);
  };

  const handlePrintTrace = () => {
    if (traceResults.length === 0) {
      setNotice('No traceability records available to print. Perform a search or clear search first.');
      return;
    }

    const cardsHtml = traceResults.map((trace) => {
      const csRows = (trace.cold_storage_lots_list || []).map((csLot, cIdx) => `
        <tr>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center;">${cIdx + 1}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; font-weight: bold; color: #1f4fb2;">${escHtml(csLot.cold_storage_lot_no)}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1;">${escHtml(csLot.cold_storage_name)}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: right;">${parseFloat(csLot.in_qty || 0).toFixed(2)} ${escHtml(trace.unit)}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: right; color: #d97706;">${parseFloat(csLot.out_qty || 0).toFixed(2)} ${escHtml(trace.unit)}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: #059669;">${parseFloat(csLot.current_balance || 0).toFixed(2)} ${escHtml(trace.unit)}</td>
        </tr>
      `).join('');

      const movRows = (trace.audit_trail && trace.audit_trail.length > 0 ? trace.audit_trail : trace.movements || []).map((m, mIdx) => {
        const isLedger = Boolean(m.source_module);
        const dt = isLedger ? m.movement_date : m.voucher_date;
        const ref = isLedger ? m.source_ref_no : m.voucher_no;
        const tp = isLedger ? `${m.source_module} (${m.direction})` : (m.voucher_type === 'IN' ? 'COLD INWARD' : 'COLD OUTWARD');
        const loc = isLedger ? m.godown_name : m.cold_storage_name;
        const target = isLedger ? (m.party_name || '-') : (m.voucher_type === 'IN' ? m.source_godown_name : m.destination_godown_name);
        const lot = isLedger ? m.lot_no : m.cold_storage_lot_no;
        const qty = isLedger ? m.qty : m.quantity;
        return `
          <tr>
            <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center;">${mIdx + 1}</td>
            <td style="padding: 5px 8px; border: 1px solid #cbd5e1;">${escHtml(dt || '-')}</td>
            <td style="padding: 5px 8px; border: 1px solid #cbd5e1; font-weight: bold;">${escHtml(ref || '-')}</td>
            <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center;">${escHtml(tp)}</td>
            <td style="padding: 5px 8px; border: 1px solid #cbd5e1;">${escHtml(loc || '-')}</td>
            <td style="padding: 5px 8px; border: 1px solid #cbd5e1;">${escHtml(target || '-')}</td>
            <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center;">${escHtml(lot || '-')}</td>
            <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold;">${parseFloat(qty || 0).toFixed(2)}</td>
          </tr>
        `;
      }).join('');

      return `
        <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 14px; margin-bottom: 20px; page-break-inside: avoid;">
          <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #1f4fb2; padding-bottom: 8px; margin-bottom: 12px;">
            <div>
              <span style="font-size: 16px; font-weight: bold; color: #1f4fb2;">Purchase Lot: ${escHtml(trace.purchase_lot_no)}</span>
              <span style="font-size: 14px; margin-left: 12px; font-weight: bold; color: #334155;">- ${escHtml(trace.item_name)}</span>
            </div>
            <div style="font-size: 12px; color: #64748b;">
              Supplier: <strong>${escHtml(trace.supplier_name || 'N/A')}</strong> | Purchase Date: <strong>${escHtml(trace.purchase_date || 'N/A')}</strong>
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px; background: #f8fafc;">
            <tr>
              <td style="padding: 6px 10px; border: 1px solid #e2e8f0; width: 25%;">
                <div style="color: #64748b; font-size: 10px;">Total Purchased</div>
                <div style="font-size: 13px; font-weight: bold;">${parseFloat(trace.purchased_qty || 0).toFixed(2)} Bags (${parseFloat(trace.purchased_total_wt || 0).toLocaleString()} KG)</div>
              </td>
              <td style="padding: 6px 10px; border: 1px solid #e2e8f0; width: 25%;">
                <div style="color: #64748b; font-size: 10px;">Main Godown Balance</div>
                <div style="font-size: 13px; font-weight: bold;">${parseFloat(trace.main_godown_balance || 0).toFixed(2)} Bags</div>
              </td>
              <td style="padding: 6px 10px; border: 1px solid #e2e8f0; width: 25%;">
                <div style="color: #64748b; font-size: 10px;">Cold Storage Balance</div>
                <div style="font-size: 13px; font-weight: bold; color: #059669;">${parseFloat(trace.cold_storage_current_balance || 0).toFixed(2)} Bags (IN: ${parseFloat(trace.cold_storage_in_qty || 0).toFixed(2)})</div>
              </td>
              <td style="padding: 6px 10px; border: 1px solid #e2e8f0; width: 25%;">
                <div style="color: #64748b; font-size: 10px;">Outward / Production</div>
                <div style="font-size: 13px; font-weight: bold; color: #d97706;">${parseFloat(trace.issued_to_production_qty || 0).toFixed(2)} Bags</div>
              </td>
            </tr>
          </table>

          <h4 style="margin: 8px 0 4px 0; color: #1f4fb2; font-size: 12px;">Cold Storage Sub-Lot Breakdown</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 12px;">
            <thead>
              <tr style="background: #f1f5f9;">
                <th style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: center;">#</th>
                <th style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: left;">CS Lot #</th>
                <th style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: left;">Cold Storage</th>
                <th style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: right;">Inward</th>
                <th style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: right;">Issued Out</th>
                <th style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: right;">Current Balance</th>
              </tr>
            </thead>
            <tbody>
              ${csRows || '<tr><td colspan="6" style="text-align:center; padding: 6px;">No CS sub-lots</td></tr>'}
            </tbody>
          </table>

          <h4 style="margin: 8px 0 4px 0; color: #1f4fb2; font-size: 12px;">Chronological Movement Audit Trail</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 12px;">
            <thead>
              <tr style="background: #f1f5f9;">
                <th style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: center;">#</th>
                <th style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: left;">Date</th>
                <th style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: left;">Ref #</th>
                <th style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: center;">Type / Module</th>
                <th style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: left;">Godown / Facility</th>
                <th style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: left;">Party / Counterparty</th>
                <th style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: center;">Lot #</th>
                <th style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: right;">Qty</th>
              </tr>
            </thead>
            <tbody>
              ${movRows || '<tr><td colspan="8" style="text-align:center; padding: 6px;">No movements</td></tr>'}
            </tbody>
          </table>

          ${(trace.milling_batches && trace.milling_batches.length > 0) ? `
            <h4 style="margin: 8px 0 4px 0; color: #b45309; font-size: 12px;">Milling / Production &amp; Wastage Breakdown</h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
              <thead>
                <tr style="background: #fef3c7;">
                  <th style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: left;">Batch #</th>
                  <th style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: left;">Facility / Date</th>
                  <th style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: left;">Inputs Consumed</th>
                  <th style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: left;">Outputs Produced</th>
                  <th style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: left;">Wastage / Recovery</th>
                </tr>
              </thead>
              <tbody>
                ${trace.milling_batches.map(mb => `
                  <tr>
                    <td style="padding: 4px 6px; border: 1px solid #cbd5e1; font-weight: bold;">${escHtml(mb.batch_no)} (${escHtml(mb.yield_percent || 0)}%)</td>
                    <td style="padding: 4px 6px; border: 1px solid #cbd5e1;">${escHtml(mb.mill_name)}<br/>${escHtml(mb.date)}</td>
                    <td style="padding: 4px 6px; border: 1px solid #cbd5e1;">${(mb.inputs || []).map(i => `${escHtml(i.lot_no)}: ${escHtml(i.item_name)} (${escHtml(i.total_wt)} KG)`).join('<br/>') || '-'}</td>
                    <td style="padding: 4px 6px; border: 1px solid #cbd5e1;">${(mb.outputs || []).map(o => `${escHtml(o.lot_no)}: ${escHtml(o.item_name)} (${escHtml(o.total_wt)} KG)`).join('<br/>') || '-'}</td>
                    <td style="padding: 4px 6px; border: 1px solid #cbd5e1;">${(mb.wastages || []).map(w => `${escHtml(w.item_name)} [${escHtml(w.lot_no || '-')}]: ${escHtml(w.total_wt)} KG`).join('<br/>') || 'None'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}
        </div>
      `;
    }).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; color: #0f172a; padding: 10px;">
        <div style="border-bottom: 2px solid #1f4fb2; padding-bottom: 8px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h2 style="margin: 0; color: #1f4fb2; font-size: 20px;">COLD STORAGE LOT TRACEABILITY AUDIT REPORT</h2>
            <div style="font-size: 11px; color: #64748b; margin-top: 3px;">
              Query: <strong>${escHtml(searchQuery || 'All Cold Storage Lots')}</strong> | Printed on: ${escHtml(new Date().toLocaleString())}
            </div>
          </div>
          <div style="text-align: right; font-size: 12px; color: #475569;">
            Total Traces: <strong>${traceResults.length}</strong>
          </div>
        </div>
        ${cardsHtml}
      </div>
    `;

    printHtml(html, 'Lot_Traceability_Report');
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, width: '100%', maxWidth: '100%', margin: '0 auto' }}>
      {/* Title */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <RouteIcon sx={{ fontSize: 36, color: '#1f4fb2' }} />
          <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>
            Cold Storage Lot Traceability: Purchase → Cold Storage → Transfers → Production & Sales
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <IconButton onClick={() => fetchTraceability(searchQuery)} color="primary" title="Refresh Traces">
            <RefreshIcon />
          </IconButton>
          <IconButton onClick={handlePrintTrace} color="primary" title="Print Trace Report">
            <PrintIcon />
          </IconButton>
        </Stack>
      </Box>

      {Boolean(notice) && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setNotice('')}>
          {notice}
        </Alert>
      )}

      {/* Search Bar & Quick CS Lot Chips */}
      <Card sx={{ mb: 4, p: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <form onSubmit={handleSearch}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, color: '#2a5ea0' }}>
            Search Purchase Lot No, Cold Storage Lot No, or Item Name
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={8}>
              <TextField
                fullWidth
                size="medium"
                placeholder="e.g. Enter Purchase Lot # (LOT0011) or Cold Storage Lot # (CS-LOT0011) or Item..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="primary" />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={6} sm={2}>
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                startIcon={<SearchIcon />}
                disabled={loading}
                sx={{ backgroundColor: '#1f4fb2', py: 1.2 }}
              >
                {loading ? 'Tracing...' : 'Trace Lot'}
              </Button>
            </Grid>
            <Grid item xs={6} sm={2}>
              <Button
                fullWidth
                variant="outlined"
                size="large"
                disabled={loading}
                onClick={() => {
                  setSearchQuery('');
                  fetchTraceability('');
                }}
                sx={{ py: 1.2 }}
              >
                Show All CS
              </Button>
            </Grid>
          </Grid>

          {availableLots.length > 0 && (
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', mr: 0.5 }}>
                Active Cold Storage Lots:
              </Typography>
              {availableLots.slice(0, 14).map((al, i) => {
                const labelLot = al.lot_no || al.purchase_lot_no;
                return (
                  <Chip
                    key={`${labelLot}-${i}`}
                    label={`${labelLot} (${al.item_name})`}
                    size="small"
                    onClick={() => {
                      setSearchQuery(labelLot);
                      fetchTraceability(labelLot);
                    }}
                    color={searchQuery.toUpperCase() === String(labelLot).toUpperCase() ? 'primary' : 'default'}
                    variant={searchQuery.toUpperCase() === String(labelLot).toUpperCase() ? 'filled' : 'outlined'}
                    sx={{ fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                  />
                );
              })}
            </Box>
          )}
        </form>
      </Card>

      {/* Results */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      ) : traceResults.length === 0 ? (
        <Box sx={{ p: 5, textAlign: 'center', backgroundColor: '#fff', borderRadius: 2, border: '1px dashed #cbd5e1' }}>
          <Typography variant="subtitle1" color="text.secondary">
            No Cold Storage traceability records matched your search criteria. Click &quot;Show All CS&quot; or select a lot above.
          </Typography>
        </Box>
      ) : (
        traceResults.map((trace, idx) => (
          <Card key={`${trace.purchase_lot_no}-${idx}`} sx={{ mb: 4, boxShadow: '0 3px 10px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            {/* Header */}
            <Box sx={{ backgroundColor: '#1f4fb2', color: '#fff', p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Item: {trace.item_name}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Original Purchase Lot #: <strong>{trace.purchase_lot_no}</strong> | Supplier: <strong>{trace.supplier_name}</strong> | Voucher: {trace.purchase_voucher}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                {(trace.sibling_lots || []).filter(l => l !== trace.purchase_lot_no).map(sl => (
                  <Chip key={sl} label={sl} size="small" sx={{ bgcolor: '#dbeafe', color: '#1e3a8a', fontWeight: 700 }} />
                ))}
                <Button
                  size="small"
                  variant="contained"
                  color="secondary"
                  onClick={() => navigate(`/lot-genealogy?lotNo=${encodeURIComponent(trace.purchase_lot_no)}`)}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  Open Genealogy Tree
                </Button>
                <Chip label={`Unit: ${trace.unit}`} color="info" sx={{ fontWeight: 'bold' }} />
              </Stack>
            </Box>

            <CardContent sx={{ p: 3 }}>
              {/* Lifecycle Visual Pipeline */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={3}>
                  <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', backgroundColor: '#f0f9ff', borderColor: '#bae6fd' }}>
                    <ShippingIcon color="primary" sx={{ fontSize: 32 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#0369a1', mt: 1 }}>
                      1. Purchased / Inward
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#0284c7' }}>
                      {Number(trace.purchased_qty || 0).toFixed(2)} Bags
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {Number(trace.purchased_total_wt || 0).toLocaleString()} KG | Voucher: {trace.purchase_voucher} | Date: {trace.purchase_date}
                    </Typography>
                  </Paper>
                </Grid>

                <Grid item xs={12} sm={3}>
                  <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
                    <StoreIcon color="action" sx={{ fontSize: 32 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#334155', mt: 1 }}>
                      2. Non-Cold Godown Balance
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#475569' }}>
                      {Number(trace.main_godown_balance || 0).toFixed(2)} Bags
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Primary: {trace.main_godown}
                    </Typography>
                  </Paper>
                </Grid>

                <Grid item xs={12} sm={3}>
                  <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', backgroundColor: '#eff6ff', borderColor: '#93c5fd' }}>
                    <ColdIcon color="primary" sx={{ fontSize: 32 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1d4ed8', mt: 1 }}>
                      3. Cold Storage Live Balance
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>
                      {Number(trace.cold_storage_current_balance || 0).toFixed(2)} Bags
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Voucher IN: {trace.cold_storage_in_qty} | OUT: {trace.cold_storage_out_qty}
                    </Typography>
                  </Paper>
                </Grid>

                <Grid item xs={12} sm={3}>
                  <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', backgroundColor: '#fffbeb', borderColor: '#fde68a' }}>
                    <FactoryIcon color="warning" sx={{ fontSize: 32 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#b45309', mt: 1 }}>
                      4. Production / Outward
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#d97706' }}>
                      {Number(trace.issued_to_production_qty || 0).toFixed(2)} Bags
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {trace.milling_batches?.length || 0} Milling Batch(es) | {trace.sales_dispatches?.length || 0} Sale(s)
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* Live Per-Godown Balances */}
              {trace.godown_balances && trace.godown_balances.length > 0 && (
                <Box sx={{ mb: 3, p: 1.5, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#334155', display: 'block', mb: 1 }}>
                    LIVE PER-GODOWN PHYSICAL BALANCES:
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {trace.godown_balances.map((gb, gIdx) => (
                      <Chip
                        key={`gb-${gIdx}`}
                        label={`${gb.godown_name} (${gb.lot_no}): ${gb.balance_qty} Bags (${Number(gb.balance_weight_kg || 0).toLocaleString()} KG)`}
                        size="small"
                        color={gb.balance_qty > 0 ? (gb.is_cold_storage ? 'primary' : 'success') : 'default'}
                        variant={gb.balance_qty > 0 ? 'filled' : 'outlined'}
                        sx={{ fontWeight: 700 }}
                      />
                    ))}
                  </Stack>
                </Box>
              )}

              {/* Cold Storage Lot Breakdown */}
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, color: '#1f4fb2' }}>
                Cold Storage Sub-Lot Breakdown
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 800 }}>
                  <TableHead sx={{ backgroundColor: '#f0f4fa' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>CS Lot Number</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Cold Storage Name</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total Inward Qty</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total Outward Issued</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Voucher Net Balance</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(trace.cold_storage_lots_list || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ color: 'text.secondary', py: 2 }}>
                          Direct Cold Storage Purchase (No separate CS transfer sub-lot voucher).
                        </TableCell>
                      </TableRow>
                    ) : (
                      trace.cold_storage_lots_list.map((csLot, cIdx) => (
                        <TableRow key={cIdx}>
                          <TableCell>{cIdx + 1}</TableCell>
                          <TableCell>
                            <Chip label={csLot.cold_storage_lot_no} color="primary" size="small" variant="outlined" />
                          </TableCell>
                          <TableCell>{csLot.cold_storage_name}</TableCell>
                          <TableCell align="right">{csLot.in_qty.toFixed(2)} Bags</TableCell>
                          <TableCell align="right" sx={{ color: '#d97706' }}>{csLot.out_qty.toFixed(2)} Bags</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', color: '#059669' }}>
                            {csLot.current_balance.toFixed(2)} Bags
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Transfers, Milling (Inputs/Outputs/Wastages), Weight Conversions & Sales Summary */}
              {(trace.transfers?.length > 0 || trace.milling_batches?.length > 0 || trace.weight_conversions?.length > 0 || trace.sales_dispatches?.length > 0) && (
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  {trace.transfers?.length > 0 && (
                    <Grid item xs={12} md={4}>
                      <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#faf5ff', borderColor: '#e9d5ff', height: '100%' }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: '#6b21a8', display: 'block', mb: 0.5 }}>
                          GODOWN TRANSFERS ({trace.transfers.length})
                        </Typography>
                        {trace.transfers.map((tr, tIdx) => (
                          <Typography key={tIdx} variant="caption" sx={{ display: 'block', color: '#4c1d95', mb: 0.4 }}>
                            • {tr.ref_no}: {tr.from_godown_name} → {tr.to_godown_name} ({tr.qty} Bags / {tr.transfer_date})
                          </Typography>
                        ))}
                      </Paper>
                    </Grid>
                  )}
                  {trace.sales_dispatches?.length > 0 && (
                    <Grid item xs={12} md={4}>
                      <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#f0fdf4', borderColor: '#bbf7d0', height: '100%' }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: '#15803d', display: 'block', mb: 0.5 }}>
                          SALES DISPATCHES ({trace.sales_dispatches.length})
                        </Typography>
                        {trace.sales_dispatches.map((sd, sIdx) => (
                          <Typography key={sIdx} variant="caption" sx={{ display: 'block', color: '#14532d', mb: 0.4 }}>
                            • Inv #{sd.invoice_no}: {sd.customer_name} ({sd.qty} Bags / {sd.total_wt} KG, {sd.date})
                          </Typography>
                        ))}
                      </Paper>
                    </Grid>
                  )}
                  {trace.weight_conversions?.length > 0 && (
                    <Grid item xs={12} md={4}>
                      <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#eff6ff', borderColor: '#bfdbfe', height: '100%' }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: '#1e40af', display: 'block', mb: 0.5 }}>
                          WEIGHT CONVERSIONS ({trace.weight_conversions.length})
                        </Typography>
                        {trace.weight_conversions.map((wc, wIdx) => (
                          <Typography key={wIdx} variant="caption" sx={{ display: 'block', color: '#1e3a8a', mb: 0.4 }}>
                            • {wc.voucher_no} ({wc.date}): {(wc.inputs || []).map(i => `${i.lot_no} (${i.total_wt} KG)`).join(', ')} → {(wc.outputs || []).map(o => `${o.lot_no} (${o.total_wt} KG)`).join(', ')}
                          </Typography>
                        ))}
                      </Paper>
                    </Grid>
                  )}
                  {trace.milling_batches?.length > 0 && (
                    <Grid item xs={12}>
                      <Paper variant="outlined" sx={{ p: 2, bgcolor: '#fffbeb', borderColor: '#fde68a' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#b45309', mb: 1 }}>
                          MILLING / PRODUCTION — INPUTS, OUTPUTS &amp; WASTAGES ({trace.milling_batches.length})
                        </Typography>
                        <Grid container spacing={1.5}>
                          {trace.milling_batches.map((mb, mIdx) => (
                            <Grid item xs={12} md={6} key={`mb-cs-${mIdx}`}>
                              <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#ffffff', borderColor: '#fcd34d' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                                    {mb.batch_no} ({mb.process_mode})
                                  </Typography>
                                  <Chip label={`${mb.yield_percent ?? 0}% Yield`} size="small" color="success" sx={{ fontWeight: 700, fontSize: '10px', height: '20px' }} />
                                </Box>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                                  Facility: <strong>{mb.mill_name}</strong> | Date: <strong>{mb.date}</strong>
                                  {mb.inpass_no ? ` | Inpass: ${mb.inpass_no}` : ''}
                                </Typography>
                                <Typography variant="caption" sx={{ display: 'block', color: '#1e40af', fontWeight: 600 }}>
                                  Inputs ({Number(mb.total_input_kg || 0).toLocaleString()} KG): {(mb.inputs || []).map(i => `${i.item_name} [${i.lot_no}] (${i.qty} Bags / ${i.total_wt} KG)`).join(', ') || '-'}
                                </Typography>
                                <Typography variant="caption" sx={{ display: 'block', color: '#15803d', fontWeight: 600, mt: 0.25 }}>
                                  Outputs ({Number(mb.total_output_kg || 0).toLocaleString()} KG): {(mb.outputs || []).map(o => `${o.item_name} [${o.lot_no}] (${o.qty} Bags / ${o.total_wt} KG)`).join(', ') || '-'}
                                </Typography>
                                {mb.wastages?.length > 0 && (
                                  <Typography variant="caption" sx={{ display: 'block', color: '#b45309', fontWeight: 600, mt: 0.25 }}>
                                    Wastages ({Number(mb.total_wastage_kg || 0).toLocaleString()} KG): {mb.wastages.map(w => `${w.item_name}${w.lot_no && w.lot_no !== '-' ? ` [${w.lot_no}]` : ''} (${w.total_wt} KG)`).join(', ')}
                                  </Typography>
                                )}
                                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                                  {(mb.outputs || []).filter(o => o.lot_no).map((o, oIdx) => (
                                    <Chip
                                      key={`cs-out-chip-${oIdx}`}
                                      label={`Trace Output ${o.lot_no}`}
                                      size="small"
                                      color="primary"
                                      variant="outlined"
                                      onClick={() => navigate(`/lot-genealogy?lotNo=${encodeURIComponent(o.lot_no)}`)}
                                      sx={{ fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}
                                    />
                                  ))}
                                </Stack>
                              </Paper>
                            </Grid>
                          ))}
                        </Grid>
                      </Paper>
                    </Grid>
                  )}
                </Grid>
              )}

              {/* Chronological Audit Trail (All Modules from Clean Physical Ledger) */}
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, color: '#1f4fb2' }}>
                Complete End-to-End Movement Audit Trail
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 950 }}>
                  <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Ref #</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Module / Direction</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Godown</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Party / Counterparty</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Lot #</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Qty (Bags)</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Weight (KG)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(trace.audit_trail && trace.audit_trail.length > 0) ? (
                      trace.audit_trail.map((m, mIdx) => {
                        const isIn = m.direction === 'IN';
                        return (
                          <TableRow key={m.id || mIdx} hover>
                            <TableCell>{mIdx + 1}</TableCell>
                            <TableCell>{m.movement_date || '-'}</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{m.source_ref_no || '-'}</TableCell>
                            <TableCell>
                              <Chip
                                label={`${m.source_module} (${m.direction})`}
                                color={isIn ? 'success' : 'warning'}
                                size="small"
                                sx={{ fontWeight: 700, fontSize: '10px' }}
                              />
                            </TableCell>
                            <TableCell>{m.godown_name || '-'}</TableCell>
                            <TableCell>{m.party_name || '-'}</TableCell>
                            <TableCell><Chip label={m.lot_no} size="small" variant="outlined" /></TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>{Number(m.qty || 0).toLocaleString()}</TableCell>
                            <TableCell align="right">{Number(m.weight || 0).toLocaleString()}</TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      (trace.movements || []).map((m, mIdx) => {
                        const isIn = m.voucher_type === 'IN';
                        return (
                          <TableRow key={mIdx}>
                            <TableCell>{mIdx + 1}</TableCell>
                            <TableCell>{m.voucher_date}</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', color: isIn ? '#1f4fb2' : '#d97706' }}>{m.voucher_no}</TableCell>
                            <TableCell>
                              <Chip label={isIn ? 'COLD INWARD' : 'COLD OUTWARD'} color={isIn ? 'primary' : 'warning'} size="small" />
                            </TableCell>
                            <TableCell>{m.cold_storage_name}</TableCell>
                            <TableCell>{isIn ? m.source_godown_name : m.destination_godown_name}</TableCell>
                            <TableCell><Chip label={m.cold_storage_lot_no} size="small" variant="outlined" /></TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>{m.quantity}</TableCell>
                            <TableCell align="right">{Number(m.total_wt || 0).toLocaleString()}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        ))
      )}
    </Box>
  );
};

export default ColdStorageTraceability;
