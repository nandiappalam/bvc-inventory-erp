import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Chip,
  Button,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Tooltip
} from '@mui/material';
import {
  Close as CloseIcon,
  OpenInNew as OpenInNewIcon,
  History as HistoryIcon,
  CalendarToday as CalendarIcon
} from '@mui/icons-material';
import api from '../../services/api';

const fmtNum = (val, decimals = 2) => {
  const n = Number(val || 0);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : Math.min(decimals, 3),
    maximumFractionDigits: decimals
  });
};

const StockMovementDrilldownModal = ({
  open,
  onClose,
  row,
  stockDate,
  asOfTime,
  financialYear
}) => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('date');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const fetchMovements = useCallback(async (modeToUse) => {
    if (!open || !row) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/stock-reports/movements', {
        params: {
          identityKey: row.identity_key || '',
          itemName: row.item_name || '',
          lotNo: row.lot_no || row.fg_lot_no || row.rm_lot_no || '',
          rmLotNo: row.rm_lot_no || '',
          fgLotNo: row.fg_lot_no || '',
          parentLotNo: row.parent_lot_no || '',
          godownName: row.godown_name || '',
          stockCategory: row.stock_category || '',
          supplierName: row.supplier_name || '',
          financialYear: financialYear || '',
          stockDate: stockDate || '',
          asOfTime: asOfTime || '23:59:59',
          viewMode: modeToUse
        }
      });

      if (res && res.success === false) {
        setError(res.message || 'Failed to load stock movement history.');
        setData(null);
      } else {
        setData(res);
      }
    } catch (err) {
      setError(err?.message || 'Error loading stock movement history.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [open, row, stockDate, asOfTime, financialYear]);

  useEffect(() => {
    if (open && row) {
      fetchMovements(viewMode);
    }
  }, [open, row, viewMode, fetchMovements]);

  const handleModeChange = (_e, nextMode) => {
    if (nextMode) {
      setViewMode(nextMode);
    }
  };

  const toReadOnlyDisplayRoute = (route, movement) => {
    const raw = String(route || '').trim();
    const sourceMod = String(movement?.source_module || '').toUpperCase();
    const sourceId = movement?.source_id ? Number(movement.source_id) : null;
    const sourceRef = movement?.source_ref_no ? String(movement.source_ref_no).trim() : '';

    const appendHighlight = (basePath, fallbackId = null) => {
      const id = sourceId || fallbackId;
      if (id) return `${basePath}?highlightId=${id}`;
      if (sourceRef) return `${basePath}?highlightRef=${encodeURIComponent(sourceRef)}`;
      return basePath;
    };

    const editMatch = raw.match(/^\/purchase\/edit\/(\d+)/i);
    if (editMatch) {
      return appendHighlight('/entry/purchase-display', Number(editMatch[1]));
    }

    const createMatch = raw.match(/^\/entry\/([a-z0-9-]+)-create(?:\?.*?\bid=(\d+))?/i);
    if (createMatch) {
      const slug = createMatch[1].toLowerCase();
      const extractedId = createMatch[2] ? Number(createMatch[2]) : null;
      return appendHighlight(`/entry/${slug}-display`, extractedId);
    }

    if (raw && !raw.includes('?')) {
      return appendHighlight(raw);
    }

    if (!raw && sourceMod) {
      const moduleMap = {
        OPEN: '/entry/open-display',
        OPENING: '/entry/open-display',
        PURCHASE: '/entry/purchase-display',
        QC: '/entry/purchase-display',
        UNLOADING: '/entry/purchase-display',
        PURCHASE_RETURN: '/entry/purchase-return-display',
        GRAIN: '/entry/grind-display',
        GRAINS: '/entry/grind-display',
        GRAIN_INPUT: '/entry/grind-display',
        GRAIN_OUTPUT: '/entry/grind-display',
        GRAIN_WASTAGE: '/entry/grind-display',
        HAND_SORTING: '/hand-sorting',
        PACKING: '/entry/packing-display',
        PACKING_FROM: '/entry/packing-display',
        PACKING_TO: '/entry/packing-display',
        PACKING_MATERIAL: '/entry/packing-display',
        WEIGHT_CONVERSION: '/entry/weight-conversion-display',
        WEIGHT_CONVERSION_FROM: '/entry/weight-conversion-display',
        WEIGHT_CONVERSION_TO: '/entry/weight-conversion-display',
        FLOUR_OUT: '/entry/flour-out-display',
        FLOUR_OUT_RETURN: '/entry/flour-out-return-display',
        PAPAD_IN: '/entry/papad-in-display',
        PAPAD_RETURN: '/entry/papad-return-display',
        OUTPASS: '/entry/outpass-display',
        INPASS: '/entry/inpass-display',
        ITEM_TRANSFER: '/inventory/item-transfer/display',
        GODOWN_TRANSFER: '/entry/godown-transfer-display',
        COLD_STORAGE: '/cold-storage/vouchers',
        SALES: '/entry/sales-display',
        SALES_ORDER: '/entry/sales-order-display',
        SALES_EXPORT_ORDER: '/entry/sales-export-order-display',
        SALES_RETURN: '/entry/sales-return-display',
        STOCK_ADJUST: '/entry/stock-adjust-display'
      };
      if (moduleMap[sourceMod]) {
        return appendHighlight(moduleMap[sourceMod]);
      }
    }

    return raw;
  };

  const handleNavigateVoucher = (route, movement) => {
    const safeRoute = toReadOnlyDisplayRoute(route, movement);
    if (!safeRoute) return;
    onClose();
    navigate(safeRoute);
  };

  const header = data?.header || row || {};
  const totals = data?.totals || {};
  const movements = data?.movements || [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle
        sx={{
          backgroundColor: '#0f172a',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 1.5,
          px: 2.5
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <HistoryIcon sx={{ color: '#38bdf8' }} />
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', lineHeight: 1.2 }}>
              Row-Level Stock Movement Drill-Down — {header.item_name || row?.item_name || 'Item'}
            </Typography>
            <Typography variant="caption" sx={{ color: '#cbd5e1' }}>
              Chronological Ledger Trace (Single Movement Engine)
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleModeChange}
            size="small"
            sx={{
              backgroundColor: '#1e293b',
              '& .MuiToggleButton-root': {
                color: '#cbd5e1',
                borderColor: '#334155',
                textTransform: 'none',
                fontSize: '12px',
                px: 1.5,
                py: 0.5,
                '&.Mui-selected': {
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  fontWeight: 'bold'
                }
              }
            }}
          >
            <ToggleButton value="date">
              <CalendarIcon sx={{ fontSize: 14, mr: 0.6 }} />
              Date Window
            </ToggleButton>
            <ToggleButton value="full_lot">
              <HistoryIcon sx={{ fontSize: 14, mr: 0.6 }} />
              Full Lot History
            </ToggleButton>
          </ToggleButtonGroup>

          <IconButton onClick={onClose} size="small" sx={{ color: '#cbd5e1' }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 2.5, backgroundColor: '#f8fafc' }}>
        {/* Header Metadata Summary */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2, backgroundColor: '#ffffff', borderRadius: '6px' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 1.5 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Item Code / Name</Typography>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                {header.item_code ? `${header.item_code} — ` : ''}{header.item_name || row?.item_name || '—'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Category / Storage</Typography>
              <Box sx={{ mt: 0.25 }}>
                <Chip
                  size="small"
                  label={`${header.stock_category || row?.stock_category || 'Stock'}${header.storage_type === 'Cold Storage' ? ' (Cold Storage)' : ''}`}
                  sx={{ fontWeight: 600, backgroundColor: '#e0f2fe', color: '#0369a1' }}
                />
              </Box>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Supplier / Party</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {header.supplier_name || row?.supplier_name || '—'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">RM Lot / FG Lot / Parent Lot</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                {header.rm_lot_no || row?.rm_lot_no || '—'} / {header.fg_lot_no || row?.fg_lot_no || '—'} / {header.parent_lot_no || row?.parent_lot_no || '—'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Godown</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {header.godown_name || row?.godown_name || 'Main Godown'}
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 1.5,
              mt: 2,
              pt: 1.5,
              borderTop: '1px solid #e2e8f0'
            }}
          >
            <Box sx={{ p: 1, backgroundColor: '#f1f5f9', borderRadius: '4px' }}>
              <Typography variant="caption" color="text.secondary">Opening (Register)</Typography>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#0f172a' }}>
                {fmtNum(row?.opening_qty ?? row?.prev_closing_qty ?? 0)} Qty | {fmtNum(row?.opening_weight ?? row?.prev_closing_weight ?? 0)} KG
              </Typography>
            </Box>
            <Box sx={{ p: 1, backgroundColor: '#f0fdf4', borderRadius: '4px' }}>
              <Typography variant="caption" color="text.secondary">Total In (Active Physical)</Typography>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#15803d' }}>
                +{fmtNum(totals.totalInQty)} Qty | +{fmtNum(totals.totalInWeight)} KG
              </Typography>
            </Box>
            <Box sx={{ p: 1, backgroundColor: '#fef2f2', borderRadius: '4px' }}>
              <Typography variant="caption" color="text.secondary">Total Out (Active Physical)</Typography>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#b91c1c' }}>
                -{fmtNum(totals.totalOutQty)} Qty | -{fmtNum(totals.totalOutWeight)} KG
              </Typography>
            </Box>
            <Box sx={{ p: 1, backgroundColor: '#eff6ff', borderRadius: '4px' }}>
              <Typography variant="caption" color="text.secondary">Closing Running Balance</Typography>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1d4ed8' }}>
                {fmtNum(totals.currentBalanceQty)} Qty | {fmtNum(totals.currentBalanceWeight)} KG
              </Typography>
            </Box>
          </Box>
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 460 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#1e293b', color: '#ffffff' }}>Date &amp; Time</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#1e293b', color: '#ffffff' }}>Movement Type</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#1e293b', color: '#ffffff' }}>Source Ref</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#1e293b', color: '#ffffff' }}>Party / Mill / Godown</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#1e293b', color: '#ffffff' }}>In Qty</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#1e293b', color: '#ffffff' }}>In Wt (KG)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#1e293b', color: '#ffffff' }}>Out Qty</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#1e293b', color: '#ffffff' }}>Out Wt (KG)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#1e293b', color: '#ffffff' }}>Running Qty</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#1e293b', color: '#ffffff' }}>Running Wt (KG)</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#1e293b', color: '#ffffff' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#1e293b', color: '#ffffff' }}>Created By / Remarks</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {movements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} align="center" sx={{ py: 4, color: '#64748b' }}>
                      No stock movement records found for this filter window.
                    </TableCell>
                  </TableRow>
                ) : (
                  movements.map((m) => {
                    const isRev = m.reversal_status !== 'Active';
                    const isNonPhysical = m.is_physical_stock === false;
                    return (
                      <TableRow
                        key={m.id}
                        hover
                        sx={{
                          opacity: isRev ? 0.65 : 1,
                          backgroundColor: isNonPhysical ? '#fffbeb' : isRev ? '#f1f5f9' : '#ffffff'
                        }}
                      >
                        <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '12px' }}>
                          {m.date} <Typography component="span" variant="caption" color="text.secondary">{m.time}</Typography>
                        </TableCell>
                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>
                          {m.movement_type}
                          {isNonPhysical && (
                            <Chip size="small" label="Non-Physical" sx={{ ml: 0.75, height: 18, fontSize: '10px', backgroundColor: '#fef3c7', color: '#92400e' }} />
                          )}
                        </TableCell>
                        <TableCell sx={{ fontSize: '12px' }}>
                          {m.nav_route ? (
                            <Tooltip title={`View highlighted record in ${m.source_module} display`}>
                              <Button
                                size="small"
                                variant="text"
                                endIcon={<OpenInNewIcon sx={{ fontSize: 13 }} />}
                                onClick={() => handleNavigateVoucher(m.nav_route, m)}
                                sx={{ p: 0, minWidth: 0, textTransform: 'none', fontWeight: 600, fontSize: '12px' }}
                              >
                                {m.source_ref_no}
                              </Button>
                            </Tooltip>
                          ) : (
                            <Typography variant="caption" sx={{ fontWeight: 600 }}>{m.source_ref_no}</Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ fontSize: '12px' }}>{m.party_or_godown || '—'}</TableCell>
                        <TableCell align="right" sx={{ fontSize: '12px', color: m.qty_in > 0 ? '#15803d' : '#94a3b8', fontWeight: m.qty_in > 0 ? 700 : 400 }}>
                          {m.qty_in > 0 ? fmtNum(m.qty_in) : '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '12px', color: m.weight_in > 0 ? '#15803d' : '#94a3b8' }}>
                          {m.weight_in > 0 ? fmtNum(m.weight_in) : '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '12px', color: m.qty_out > 0 ? '#b91c1c' : '#94a3b8', fontWeight: m.qty_out > 0 ? 700 : 400 }}>
                          {m.qty_out > 0 ? fmtNum(m.qty_out) : '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '12px', color: m.weight_out > 0 ? '#b91c1c' : '#94a3b8' }}>
                          {m.weight_out > 0 ? fmtNum(m.weight_out) : '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '12px', fontWeight: 'bold', color: m.running_balance_qty < 0 ? '#dc2626' : '#0f172a' }}>
                          {fmtNum(m.running_balance_qty)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '12px', fontWeight: 'bold', color: m.running_balance_weight < 0 ? '#dc2626' : '#0f172a' }}>
                          {fmtNum(m.running_balance_weight)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={m.reversal_status}
                            sx={{
                              height: 20,
                              fontSize: '11px',
                              fontWeight: 600,
                              backgroundColor: m.reversal_status === 'Active' ? '#dcfce7' : '#fee2e2',
                              color: m.reversal_status === 'Active' ? '#166534' : '#991b1b'
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: '12px', maxWidth: 240 }}>
                          <Typography variant="caption" display="block" sx={{ fontWeight: 600 }}>{m.created_by}</Typography>
                          {m.remarks && (
                            <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                              {m.remarks}
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 1.5, backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto' }}>
          Click any linked Source Ref to jump directly to the voucher. Reversed entries are kept in audit trail and excluded from running balance.
        </Typography>
        <Button onClick={onClose} variant="contained" size="small" sx={{ textTransform: 'none' }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StockMovementDrilldownModal;
