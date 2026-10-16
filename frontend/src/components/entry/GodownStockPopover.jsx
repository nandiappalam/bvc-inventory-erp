import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  IconButton,
  Paper,
  Popper,
  Radio,
  RadioGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import {
  Close as CloseIcon,
  Inventory2 as InventoryIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { api } from '../../utils/api';
import { filterGodownStockRows, getPurchaseLotNumber, getRowsForGodown } from './godownStockData.mjs';

const stockCategories = ['All', 'RM', 'FG', 'Waste', 'Vacuum'];
const coldStorageViews = ['CSI Qty', 'CSO Qty', 'Balance Qty'];
const formatStockDate = value => {
  if (!value) return '—';
  const [year, month, day] = String(value).split('T')[0].split('-');
  return year && month && day ? `${day}/${month}/${year}` : String(value);
};

const GodownStockPopover = ({ godownId, godownName, godownType }) => {
  const anchorRef = useRef(null);
  const requestIdRef = useRef(0);
  const previousGodownIdRef = useRef('');
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [showZeroStock, setShowZeroStock] = useState(false);
  const [category, setCategory] = useState('All');
  const [coldStorageView, setColdStorageView] = useState('Balance Qty');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const selectedId = godownId ? String(godownId) : '';
    if (selectedId && selectedId !== '__CREATE_NEW__' && selectedId !== previousGodownIdRef.current) {
      setOpen(true);
    }
    previousGodownIdRef.current = selectedId;
  }, [godownId]);

  useEffect(() => {
    if (!godownId || godownId === '__CREATE_NEW__') {
      setOpen(false);
      setRows([]);
      setError('');
      setLoading(false);
      return undefined;
    }

    if (!open) return undefined;

    const requestId = ++requestIdRef.current;
    setRows([]);
    setError('');
    setLoading(true);

    api('/reports/godown-stock', { params: { godownId } })
      .then(response => {
        if (requestId !== requestIdRef.current) return;
        setRows(getRowsForGodown(response, godownId));
      })
      .catch(fetchError => {
        if (requestId !== requestIdRef.current) return;
        setError(fetchError.message || 'Unable to load godown stock.');
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });

    return () => {
      requestIdRef.current += 1;
    };
  }, [godownId, open, reloadKey]);

  const isColdStorage = String(godownType || '').toLowerCase() === 'cold storage' ||
    String(godownName || '').toLowerCase().includes('cold') ||
    rows.some(row => row.stock_location_type === 'cold-storage');
  const filteredRows = useMemo(() => {
    return filterGodownStockRows(rows, search, showZeroStock, isColdStorage ? 'All' : category);
  }, [rows, search, showZeroStock, category, isColdStorage]);
  const showPurchasedDate = !isColdStorage && category !== 'FG' && category !== 'Waste';
  const showProcessedDate = !isColdStorage && category !== 'RM';

  if (!godownId || godownId === '__CREATE_NEW__') return null;

  const retry = () => setReloadKey(key => key + 1);

  return (
    <>
      <Tooltip title="View selected godown stock">
        <IconButton
          ref={anchorRef}
          size="small"
          aria-label="View selected godown stock"
          onClick={() => setOpen(true)}
          sx={{ ml: 0.5, p: 0.5, color: '#1f4fb2', flexShrink: 0 }}
        >
          <InventoryIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Popper
        open={open}
        anchorEl={anchorRef.current}
        placement="right-start"
        modifiers={[
          { name: 'flip', enabled: true },
          { name: 'preventOverflow', enabled: true, options: { padding: 12 } }
        ]}
        sx={{ zIndex: 1400 }}
      >
        <Paper
          elevation={8}
          sx={{
            width: { xs: 'calc(100vw - 24px)', sm: 720 },
            maxWidth: 'calc(100vw - 24px)',
            border: '1px solid #cbd5e1',
            borderRadius: 1.5,
            overflow: 'hidden'
          }}
        >
          <Box sx={{
            px: 1.5,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#1f4fb2',
            color: '#fff'
          }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                Godown Stock
              </Typography>
              <Typography variant="caption" noWrap sx={{ display: 'block', opacity: 0.9 }}>
                {godownName || `Godown ${godownId}`}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', ml: 1 }}>
              <Tooltip title="Refresh stock">
                <span>
                  <IconButton
                    size="small"
                    aria-label="Refresh stock"
                    onClick={retry}
                    disabled={loading}
                    sx={{ color: '#fff' }}
                  >
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <IconButton
                size="small"
                aria-label="Close stock report"
                onClick={() => setOpen(false)}
                sx={{ color: '#fff' }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          <Box sx={{ p: 1.25 }}>
            {!isColdStorage && (
              <RadioGroup
                row
                aria-label="Filter stock category"
                value={category}
                onChange={event => setCategory(event.target.value)}
                sx={{ flexWrap: 'nowrap', overflowX: 'auto', mb: 0.5 }}
              >
                {stockCategories.map(stockCategory => (
                  <FormControlLabel
                    key={stockCategory}
                    value={stockCategory}
                    control={<Radio size="small" sx={{ p: 0.5 }} />}
                    label={stockCategory}
                    sx={{
                      flexShrink: 0,
                      mr: 0.5,
                      '& .MuiFormControlLabel-label': { fontSize: 11 }
                    }}
                  />
                ))}
              </RadioGroup>
            )}
            {isColdStorage && (
              <RadioGroup
                row
                aria-label="Filter cold storage movements"
                value={coldStorageView}
                onChange={event => setColdStorageView(event.target.value)}
                sx={{ flexWrap: 'nowrap', overflowX: 'auto', mb: 0.5 }}
              >
                {coldStorageViews.map(view => (
                  <FormControlLabel
                    key={view}
                    value={view}
                    control={<Radio size="small" sx={{ p: 0.5 }} />}
                    label={view}
                    sx={{
                      flexShrink: 0,
                      mr: 0.5,
                      '& .MuiFormControlLabel-label': { fontSize: 11 }
                    }}
                  />
                ))}
              </RadioGroup>
            )}
            {!isColdStorage && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                {category === 'RM'
                  ? 'Purchased Date shows when stock was purchased.'
                  : category === 'FG' || category === 'Waste'
                    ? 'Processed Date shows when stock was produced.'
                    : category === 'Vacuum'
                      ? 'Dates reflect the source: purchase for Vacuum Bag, processing for Vacuum GN.'
                      : 'Dates show the purchase or processing record when available.'}
              </Typography>
            )}
            <TextField
              size="small"
              fullWidth
              placeholder="Search item, code, or lot"
              value={search}
              onChange={event => setSearch(event.target.value)}
              inputProps={{ 'aria-label': 'Search godown stock' }}
            />
            <FormControlLabel
              sx={{ mt: 0.25, mb: 0, '& .MuiFormControlLabel-label': { fontSize: 12 } }}
              control={
                <Checkbox
                  size="small"
                  checked={showZeroStock}
                  onChange={event => setShowZeroStock(event.target.checked)}
                />
              }
              label="Show zero stock"
            />

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              {loading ? 'Loading stock…' : `${filteredRows.length} stock row${filteredRows.length === 1 ? '' : 's'}`}
            </Typography>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : error ? (
              <Box sx={{ py: 1, textAlign: 'center' }}>
                <Typography color="error" variant="body2" sx={{ mb: 1 }}>{error}</Typography>
                <Button size="small" variant="outlined" onClick={retry}>Retry</Button>
              </Box>
            ) : filteredRows.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                {rows.length === 0
                  ? 'No stock found in this Godown'
                  : 'No stock rows match your search'}
              </Typography>
            ) : (
              <TableContainer sx={{ maxHeight: 300, overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 1 }}>
                <Table size="small" stickyHeader aria-label="Selected godown stock" sx={{ minWidth: isColdStorage ? 700 : 620 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Item</TableCell>
                      <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Type</TableCell>
                      {isColdStorage ? (
                        <>
                          <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Purchase Lot</TableCell>
                          <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>CS Lot</TableCell>
                          {coldStorageView === 'CSI Qty' && (
                            <>
                              <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>CSI Qty</TableCell>
                              <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>CSI Date</TableCell>
                            </>
                          )}
                          {coldStorageView === 'CSO Qty' && (
                            <>
                              <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>CSO Qty</TableCell>
                              <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>CSO Date</TableCell>
                            </>
                          )}
                          {coldStorageView === 'Balance Qty' && (
                            <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Balance Qty</TableCell>
                          )}
                        </>
                      ) : (
                        <>
                          <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Lot</TableCell>
                          <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Available</TableCell>
                          <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Unit</TableCell>
                          {showPurchasedDate && <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Purchased Date</TableCell>}
                          {showProcessedDate && <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Processed Date</TableCell>}
                        </>
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredRows.map((row, index) => (
                      <TableRow key={`${row.item_id || row.item_name}-${row.lot_no}-${index}`} hover>
                        <TableCell sx={{ minWidth: 110 }}>
                          <Typography variant="body2">{row.item_name || '—'}</Typography>
                          {row.item_code && (
                            <Typography variant="caption" color="text.secondary">{row.item_code}</Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.stock_category}</TableCell>
                        {isColdStorage ? (
                          <>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                              {getPurchaseLotNumber(row) || '—'}
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.lot_no || '—'}</TableCell>
                            {coldStorageView === 'CSI Qty' && (
                              <>
                                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                  {Number(row.in_qty || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })} {row.unit || ''}
                                </TableCell>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatStockDate(row.last_in_date)}</TableCell>
                              </>
                            )}
                            {coldStorageView === 'CSO Qty' && (
                              <>
                                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                  {Number(row.out_qty || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })} {row.unit || ''}
                                </TableCell>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatStockDate(row.last_out_date)}</TableCell>
                              </>
                            )}
                            {coldStorageView === 'Balance Qty' && (
                              <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                                {row.available_qty.toLocaleString('en-IN', { maximumFractionDigits: 3 })} {row.unit || ''}
                              </TableCell>
                            )}
                          </>
                        ) : (
                          <>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.lot_no || '—'}</TableCell>
                            <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                              {row.available_qty.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.unit || '—'}</TableCell>
                            {category !== 'FG' && category !== 'Waste' && (
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatStockDate(row.entry_date)}</TableCell>
                            )}
                            {category !== 'RM' && (
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatStockDate(row.processed_date)}</TableCell>
                            )}
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </Paper>
      </Popper>
    </>
  );
};

export default GodownStockPopover;
