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
  Chip,
  IconButton,
  CircularProgress,
  Divider,
  InputAdornment
} from '@mui/material';
import {
  AcUnit as ColdIcon,
  Search as SearchIcon,
  AltRoute as RouteIcon,
  Store as StoreIcon,
  Factory as FactoryIcon,
  LocalShipping as ShippingIcon,
  Print as PrintIcon
} from '@mui/icons-material';
import { api } from '../../services/api';
import { printHtml } from '../../utils/printHelper';

const ColdStorageTraceability = () => {
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [traceResults, setTraceResults] = useState([]);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const res = await api(`/cold-storage/traceability?query=${encodeURIComponent(searchQuery.trim())}`);
      if (res && res.data) {
        setTraceResults(res.data);
      } else {
        setTraceResults([]);
      }
    } catch (err) {
      console.error('Error searching traceability:', err);
      setTraceResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintTrace = () => {
    if (traceResults.length === 0) {
      alert('No traceability records to print. Please perform a search first.');
      return;
    }

    const cardsHtml = traceResults.map((trace, idx) => {
      const csRows = (trace.cold_storage_lots_list || []).map((csLot, cIdx) => `
        <tr>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center;">${cIdx + 1}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; font-weight: bold; color: #1f4fb2;">${csLot.cold_storage_lot_no}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1;">${csLot.cold_storage_name}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: right;">${parseFloat(csLot.in_qty || 0).toFixed(2)} ${trace.unit}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: right; color: #d97706;">${parseFloat(csLot.out_qty || 0).toFixed(2)} ${trace.unit}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: #059669;">${parseFloat(csLot.current_balance || 0).toFixed(2)} ${trace.unit}</td>
        </tr>
      `).join('');

      const movRows = (trace.movements || []).map((m, mIdx) => `
        <tr>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center;">${mIdx + 1}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1;">${m.voucher_date}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; font-weight: bold;">${m.voucher_no}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center; color: ${m.voucher_type === 'IN' ? '#1f4fb2' : '#d97706'}; font-weight: bold;">${m.voucher_type === 'IN' ? 'COLD INWARD' : 'COLD OUTWARD'}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1;">${m.cold_storage_name}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1;">${m.voucher_type === 'IN' ? m.source_godown_name : m.destination_godown_name}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center;">${m.cold_storage_lot_no || '-'}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold;">${parseFloat(m.quantity || 0).toFixed(2)} ${m.unit || trace.unit}</td>
        </tr>
      `).join('');

      return `
        <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 14px; margin-bottom: 20px; page-break-inside: avoid;">
          <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #1f4fb2; padding-bottom: 8px; margin-bottom: 12px;">
            <div>
              <span style="font-size: 16px; font-weight: bold; color: #1f4fb2;">Purchase Lot: ${trace.purchase_lot_no}</span>
              <span style="font-size: 14px; margin-left: 12px; font-weight: bold; color: #334155;">- ${trace.item_name}</span>
            </div>
            <div style="font-size: 12px; color: #64748b;">
              Supplier: <strong>${trace.supplier_name || 'N/A'}</strong> | Purchase Date: <strong>${trace.purchase_date || 'N/A'}</strong>
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px; background: #f8fafc;">
            <tr>
              <td style="padding: 6px 10px; border: 1px solid #e2e8f0; width: 25%;">
                <div style="color: #64748b; font-size: 10px;">Total Purchased</div>
                <div style="font-size: 13px; font-weight: bold;">${parseFloat(trace.original_purchase_qty || 0).toFixed(2)} ${trace.unit}</div>
              </td>
              <td style="padding: 6px 10px; border: 1px solid #e2e8f0; width: 25%;">
                <div style="color: #64748b; font-size: 10px;">Transferred to Cold Storage</div>
                <div style="font-size: 13px; font-weight: bold; color: #1f4fb2;">${parseFloat(trace.transferred_to_cold_storage_qty || 0).toFixed(2)} ${trace.unit}</div>
              </td>
              <td style="padding: 6px 10px; border: 1px solid #e2e8f0; width: 25%;">
                <div style="color: #64748b; font-size: 10px;">Cold Storage Balance</div>
                <div style="font-size: 13px; font-weight: bold; color: #059669;">${parseFloat(trace.current_cold_storage_balance || 0).toFixed(2)} ${trace.unit}</div>
              </td>
              <td style="padding: 6px 10px; border: 1px solid #e2e8f0; width: 25%;">
                <div style="color: #64748b; font-size: 10px;">Issued / Consumed</div>
                <div style="font-size: 13px; font-weight: bold; color: #d97706;">${parseFloat(trace.issued_to_production_qty || 0).toFixed(2)} ${trace.unit}</div>
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
              ${csRows || '<tr><td colspan="6" style="text-align:center; padding: 6px;">No CS lots</td></tr>'}
            </tbody>
          </table>

          <h4 style="margin: 8px 0 4px 0; color: #1f4fb2; font-size: 12px;">Movement Audit Trail</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
            <thead>
              <tr style="background: #f1f5f9;">
                <th style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: center;">#</th>
                <th style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: left;">Date</th>
                <th style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: left;">Voucher #</th>
                <th style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: center;">Type</th>
                <th style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: left;">Cold Storage</th>
                <th style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: left;">Source / Target</th>
                <th style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: center;">CS Lot #</th>
                <th style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: right;">Qty</th>
              </tr>
            </thead>
            <tbody>
              ${movRows || '<tr><td colspan="8" style="text-align:center; padding: 6px;">No movements</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
    }).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; color: #0f172a; padding: 10px;">
        <div style="border-bottom: 2px solid #1f4fb2; padding-bottom: 8px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h2 style="margin: 0; color: #1f4fb2; font-size: 20px;">LOT TRACEABILITY AUDIT REPORT</h2>
            <div style="font-size: 11px; color: #64748b; margin-top: 3px;">
              Query: <strong>${searchQuery || 'All'}</strong> | Printed on: ${new Date().toLocaleString()}
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
            Lot Traceability: Purchase Lot → Cold Storage Lot → Inventory / Production
          </Typography>
        </Box>
        <IconButton onClick={handlePrintTrace} color="primary" title="Print Trace Report">
          <PrintIcon />
        </IconButton>
      </Box>

      {/* Search Bar */}
      <Card sx={{ mb: 4, p: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <form onSubmit={handleSearch}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, color: '#2a5ea0' }}>
            Search Purchase Lot No, Cold Storage Lot No, or Item Name
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={9}>
              <TextField
                fullWidth
                size="medium"
                placeholder="e.g. Enter Purchase Lot # (LOT001) or Cold Storage Lot # (CS-0001) or Wheat/Chana..."
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
            <Grid item xs={12} sm={3}>
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                startIcon={<SearchIcon />}
                disabled={loading}
                sx={{ backgroundColor: '#1f4fb2', py: 1.2 }}
              >
                {loading ? 'Tracing...' : 'Trace Material Lot'}
              </Button>
            </Grid>
          </Grid>
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
            Enter a Lot Number (e.g. LOT001 or CS-0001) above to trace its entire lifecycle across Purchase, Main Godown, Cold Storage, and Production Issues.
          </Typography>
        </Box>
      ) : (
        traceResults.map((trace, idx) => (
          <Card key={idx} sx={{ mb: 4, boxShadow: '0 3px 10px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            {/* Header */}
            <Box sx={{ backgroundColor: '#1f4fb2', color: '#fff', p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Item: {trace.item_name}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Original Purchase Lot #: <strong>{trace.purchase_lot_no}</strong> | Supplier: {trace.supplier_name}
                </Typography>
              </Box>
              <Chip label={`Unit: ${trace.unit}`} color="secondary" sx={{ fontWeight: 'bold' }} />
            </Box>

            <CardContent sx={{ p: 3 }}>
              {/* Lifecycle Visual Pipeline */}
              <Grid container spacing={2} sx={{ mb: 4 }}>
                {/* Stage 1: Purchase */}
                <Grid item xs={12} sm={3}>
                  <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', backgroundColor: '#f0f9ff', borderColor: '#bae6fd' }}>
                    <ShippingIcon color="primary" sx={{ fontSize: 32 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#0369a1', mt: 1 }}>
                      1. Purchased
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#0284c7' }}>
                      {trace.purchased_qty.toFixed(2)} {trace.unit}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Voucher: {trace.purchase_voucher} | Date: {trace.purchase_date}
                    </Typography>
                  </Paper>
                </Grid>

                {/* Stage 2: Main Godown Balance */}
                <Grid item xs={12} sm={3}>
                  <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
                    <StoreIcon color="action" sx={{ fontSize: 32 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#334155', mt: 1 }}>
                      2. Main Inventory Balance
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#475569' }}>
                      {trace.main_godown_balance.toFixed(2)} {trace.unit}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Location: {trace.main_godown}
                    </Typography>
                  </Paper>
                </Grid>

                {/* Stage 3: Cold Storage Balance */}
                <Grid item xs={12} sm={3}>
                  <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', backgroundColor: '#eff6ff', borderColor: '#93c5fd' }}>
                    <ColdIcon color="primary" sx={{ fontSize: 32 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1d4ed8', mt: 1 }}>
                      3. Stored in Cold Storage
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>
                      {trace.cold_storage_current_balance.toFixed(2)} {trace.unit}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      IN: {trace.cold_storage_in_qty} | OUT: {trace.cold_storage_out_qty}
                    </Typography>
                  </Paper>
                </Grid>

                {/* Stage 4: Issued to Production */}
                <Grid item xs={12} sm={3}>
                  <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', backgroundColor: '#fffbeb', borderColor: '#fde68a' }}>
                    <FactoryIcon color="warning" sx={{ fontSize: 32 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#b45309', mt: 1 }}>
                      4. Issued to Production
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#d97706' }}>
                      {trace.issued_to_production_qty.toFixed(2)} {trace.unit}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Consumed from Cold Storage
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

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
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Current Lot Balance</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {trace.cold_storage_lots_list.map((csLot, cIdx) => (
                      <TableRow key={cIdx}>
                        <TableCell>{cIdx + 1}</TableCell>
                        <TableCell>
                          <Chip label={csLot.cold_storage_lot_no} color="primary" size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>{csLot.cold_storage_name}</TableCell>
                        <TableCell align="right">{csLot.in_qty.toFixed(2)} {trace.unit}</TableCell>
                        <TableCell align="right" sx={{ color: '#d97706' }}>{csLot.out_qty.toFixed(2)} {trace.unit}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#059669' }}>
                          {csLot.current_balance.toFixed(2)} {trace.unit}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Chronological Movements History */}
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, color: '#1f4fb2' }}>
                Complete Voucher Audit Trail
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 950 }}>
                  <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Voucher Date</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Voucher #</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Facility</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Source / Target</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>CS Lot #</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Quantity Transferred</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {trace.movements.map((m, mIdx) => {
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
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                            {m.quantity} {m.unit}
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
