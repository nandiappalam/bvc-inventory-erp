import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Grid,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider,
  CircularProgress,
  Alert,
  IconButton,
  Stack
} from '@mui/material';
import {
  AcUnit as ColdStorageIcon,
  Print as PrintIcon,
  Close as CloseIcon,
  OpenInNew as OpenInNewIcon,
  LocalShipping as TruckIcon,
  ReceiptLong as BillIcon,
  Gavel as TermsIcon,
  CheckCircle as PaidIcon
} from '@mui/icons-material';
import { api } from '../../services/api';
import { printHtml } from '../../utils/printHelper';

const ColdStoragePurchaseStatementModal = ({ open, onClose, purchaseRow, navigate }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statement, setStatement] = useState(null);

  useEffect(() => {
    if (open && purchaseRow?.id) {
      fetchStatement();
    }
  }, [open, purchaseRow]);

  const fetchStatement = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api(`/cold-storage/purchase-statement/${purchaseRow.id}`);
      if (res && res.success && res.data) {
        setStatement(res.data);
      } else {
        setError(res?.message || 'Failed to load cold storage purchase statement.');
      }
    } catch (err) {
      console.error('Error loading purchase statement:', err);
      setError('Error loading statement: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintStatement = () => {
    if (!statement) return;

    const itemsRows = (statement.items || []).map((it, idx) => `
      <tr>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${idx + 1}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: bold;">${it.item_name}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; font-family: monospace; text-align: center;">${it.cold_storage_lot_no}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; font-family: monospace; text-align: center;">${it.purchase_lot_no}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold;">${it.qty} units</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">${it.total_weight.toFixed(2)} Kg</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${it.storage_days} Days</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">₹${it.unloading_charge.toFixed(2)}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">₹${it.storage_charge.toFixed(2)}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: #0f172a;">₹${it.total_item_charge.toFixed(2)}</td>
      </tr>
    `).join('');

    const slabsHtml = (statement.tariff_terms?.storage_slabs || []).map(s => `
      <span style="display: inline-block; background: #e0f2fe; color: #0369a1; padding: 3px 8px; border-radius: 4px; font-weight: bold; margin-right: 6px; margin-bottom: 4px; font-size: 11px;">
        Days ${s.slab_start_day}–${s.slab_end_day || 'Beyond'}: ₹${s.rate}/kg/day
      </span>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #0f172a;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; border-bottom: 3px solid #0284c7; padding-bottom: 10px; margin-bottom: 15px;">
          <div>
            <h2 style="margin: 0; color: #0284c7; text-transform: uppercase; letter-spacing: 0.5px;">${statement.cold_storage_name}</h2>
            <p style="margin: 3px 0; font-size: 12px; color: #475569;"><strong>Operator Partner:</strong> ${statement.operator_name} | Cold Storage Inward Bill Statement</p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 16px; font-weight: bold; color: #0284c7;">Bill No: ${statement.linked_bill?.bill_no || `CSB-IN-${statement.purchase_id}`}</div>
            <div style="font-size: 12px; color: #64748b;">Date: ${statement.purchase_date}</div>
            <div style="font-size: 12px; font-weight: bold; color: ${statement.linked_bill?.status === 'Approved' ? '#16a34a' : '#d97706'}; mt-1">
              Payment Status: ${statement.linked_bill?.status || 'Pending Verification'}
            </div>
          </div>
        </div>

        <!-- Supplier & Linked Purchase Details -->
        <div style="display: flex; justify-content: space-between; background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 15px; font-size: 12px;">
          <div style="width: 48%;">
            <p style="margin: 2px 0; font-weight: bold; color: #0f172a; text-transform: uppercase;">Commodity Supplier Details:</p>
            <p style="margin: 2px 0;"><strong>Supplier:</strong> ${statement.supplier_name}</p>
            <p style="margin: 2px 0;"><strong>Phone:</strong> ${statement.supplier_phone || 'N/A'}</p>
            <p style="margin: 2px 0;"><strong>GSTIN:</strong> ${statement.supplier_gst || 'N/A'}</p>
          </div>
          <div style="width: 48%; text-align: right;">
            <p style="margin: 2px 0; font-weight: bold; color: #0f172a; text-transform: uppercase;">Linked Purchase Ref:</p>
            <p style="margin: 2px 0;"><strong>Purchase Invoice #:</strong> ${statement.inv_no}</p>
            <p style="margin: 2px 0;"><strong>Purchase Date:</strong> ${statement.purchase_date}</p>
            <p style="margin: 2px 0;"><strong>Target Facility:</strong> ${statement.cold_storage_name}</p>
          </div>
        </div>

        <!-- Operator Terms & Calculation Method -->
        <div style="background: #f0f9ff; padding: 10px 14px; border-radius: 6px; border: 1px solid #bae6fd; margin-bottom: 15px; font-size: 11px;">
          <div style="font-weight: bold; color: #0369a1; text-transform: uppercase; margin-bottom: 6px; font-size: 12px;">
            📜 External Cold Storage Facilities & Operator Terms:
          </div>
          <div style="display: flex; justify-content: space-between; flex-wrap: wrap; margin-bottom: 6px;">
            <span><strong>Calculation Basis:</strong> ${statement.tariff_terms?.calculation_type} Slab Rent</span>
            <span><strong>Free Days:</strong> ${statement.tariff_terms?.free_days} Days</span>
            <span><strong>Min Billable Duration:</strong> ${statement.tariff_terms?.min_days} Day</span>
            <span><strong>Unloading Rate:</strong> ₹${statement.tariff_terms?.inward_unloading_rate}/kg</span>
            <span><strong>Loading Rate:</strong> ₹${statement.tariff_terms?.outward_loading_rate}/kg</span>
          </div>
          <div><strong>Configured Storage Slabs:</strong> ${slabsHtml}</div>
        </div>

        <!-- Logistics, Vehicle & Loadman Charges Details -->
        <div style="display: flex; justify-content: space-between; background: #fff; padding: 10px 14px; border-radius: 6px; border: 1px solid #cbd5e1; margin-bottom: 15px; font-size: 11px; flex-wrap: wrap; gap: 8px;">
          <div><strong>Vehicle / Lorry No:</strong> ${statement.vehicle_no || 'N/A'}</div>
          <div><strong>Driver Name:</strong> ${statement.driver_name || 'N/A'}</div>
          <div><strong>Transporter:</strong> ${statement.transporter_name || 'N/A'}</div>
          <div><strong>Loadman Team:</strong> ${statement.loadman_name || 'Inward Unloading Team'}</div>
          <div><strong>Unloading Charges:</strong> ₹${(statement.loadman_charges || statement.financial_summary?.unloading_charges || 0).toFixed(2)}</div>
          <div><strong>LR / Gate Pass:</strong> ${statement.lr_no || 'N/A'} / ${statement.gate_pass_no || 'N/A'}</div>
        </div>

        <!-- Itemized Commodities & Charges -->
        <p style="font-weight: bold; color: #0284c7; text-transform: uppercase; font-size: 12px; margin-bottom: 6px;">Stored Commodity & Charges Breakdown:</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 15px;">
          <thead>
            <tr style="background: #0284c7; color: white;">
              <th style="padding: 6px; border: 1px solid #0284c7;">#</th>
              <th style="padding: 6px; border: 1px solid #0284c7; text-align: left;">Item Name</th>
              <th style="padding: 6px; border: 1px solid #0284c7;">CS Lot No</th>
              <th style="padding: 6px; border: 1px solid #0284c7;">Purchase Lot</th>
              <th style="padding: 6px; border: 1px solid #0284c7; text-align: right;">Qty</th>
              <th style="padding: 6px; border: 1px solid #0284c7; text-align: right;">Total Weight</th>
              <th style="padding: 6px; border: 1px solid #0284c7;">Stored Days</th>
              <th style="padding: 6px; border: 1px solid #0284c7; text-align: right;">Unloading</th>
              <th style="padding: 6px; border: 1px solid #0284c7; text-align: right;">Storage Rent</th>
              <th style="padding: 6px; border: 1px solid #0284c7; text-align: right;">Total Charge</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <!-- Financial Summary -->
        <div style="display: flex; justify-content: flex-end; margin-bottom: 25px;">
          <table style="width: 320px; border-collapse: collapse; font-size: 11px;">
            <tr>
              <td style="padding: 5px; border: 1px solid #cbd5e1; font-weight: bold;">Unloading / Loadman Charges:</td>
              <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: right;">₹${statement.financial_summary?.unloading_charges?.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 5px; border: 1px solid #cbd5e1; font-weight: bold;">Accrued Storage Rent:</td>
              <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: right;">₹${statement.financial_summary?.accrued_storage_charges?.toFixed(2)}</td>
            </tr>
            <tr style="background: #f8fafc; font-weight: bold;">
              <td style="padding: 5px; border: 1px solid #cbd5e1;">Taxable Amount:</td>
              <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: right;">₹${statement.financial_summary?.taxable_amount?.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 5px; border: 1px solid #cbd5e1;">GST (${statement.financial_summary?.tax_rate}%):</td>
              <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: right;">₹${statement.financial_summary?.total_tax?.toFixed(2)}</td>
            </tr>
            <tr style="background: #f0f9ff; font-size: 13px; font-weight: bold; color: #0369a1;">
              <td style="padding: 7px; border: 1px solid #bae6fd;">Grand Total Payment Bill:</td>
              <td style="padding: 7px; border: 1px solid #bae6fd; text-align: right;">₹${statement.financial_summary?.grand_total?.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <!-- Signatures -->
        <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 11px; color: #475569;">
          <div style="border-top: 1px solid #94a3b8; width: 170px; text-align: center; padding-top: 5px;">Cold Storage Operator Signature</div>
          <div style="border-top: 1px solid #94a3b8; width: 170px; text-align: center; padding-top: 5px;">Prepared By (Store Incharge)</div>
          <div style="border-top: 1px solid #94a3b8; width: 170px; text-align: center; padding-top: 5px;">Authorized Partner / Accounts</div>
        </div>
      </div>
    `;

    printHtml(html, `ColdStorage_Bill_${statement.inv_no}`);
  };

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle sx={{ bgcolor: '#0284c7', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 2 }}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <ColdStorageIcon sx={{ fontSize: 26 }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              Cold Storage Purchase Bill Statement
            </Typography>
            <Typography variant="caption" sx={{ color: '#e0f2fe', opacity: 0.9 }}>
              Itemized stored quantities, loadman charges, vehicle transport & operator terms breakdown
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: '#ffffff' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {loading ? (
          <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" py={6} gap={2}>
            <CircularProgress size={36} color="primary" />
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#64748b' }}>
              Calculating cold storage bill statement & operator terms...
            </Typography>
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ my: 2 }}>
            {error}
          </Alert>
        ) : statement ? (
          <Box display="flex" flexDirection="column" gap={2.5} pt={1}>
            {/* Top Info Strip */}
            <Paper elevation={0} sx={{ p: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 800, textTransform: 'uppercase', display: 'block' }}>
                    Cold Storage Facility & Operator
                  </Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 900, color: '#0f172a' }}>
                    ❄️ {statement.cold_storage_name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>
                    Operator Partner: {statement.operator_name}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6} textAlign={{ sm: 'right' }}>
                  <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 800, textTransform: 'uppercase', display: 'block' }}>
                    Linked Purchase Ref
                  </Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 900, color: '#0f172a' }}>
                    Inv #: {statement.inv_no} ({statement.purchase_date})
                  </Typography>
                  <Chip
                    label={`Bill Status: ${statement.linked_bill?.status || 'Pending Verification'}`}
                    color={statement.linked_bill?.status === 'Approved' ? 'success' : 'warning'}
                    size="small"
                    sx={{ fontWeight: 800, mt: 0.5 }}
                  />
                </Grid>
              </Grid>
            </Paper>

            {/* Operator Terms & Calculation Method */}
            <Paper elevation={0} sx={{ p: 2, bgcolor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TermsIcon sx={{ fontSize: 18 }} />
                External Cold Storage Facilities & Operator Terms
              </Typography>

              <Grid container spacing={1.5}>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, display: 'block' }}>
                    Calculation Basis
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                    {statement.tariff_terms?.calculation_type} Slab
                  </Typography>
                </Grid>

                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, display: 'block' }}>
                    Free Days / Min Days
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                    {statement.tariff_terms?.free_days} Free / {statement.tariff_terms?.min_days} Min Day
                  </Typography>
                </Grid>

                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, display: 'block' }}>
                    Inward Unloading Rate
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#15803d' }}>
                    ₹{statement.tariff_terms?.inward_unloading_rate} / Kg
                  </Typography>
                </Grid>

                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, display: 'block' }}>
                    Outward Loading Rate
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#2563eb' }}>
                    ₹{statement.tariff_terms?.outward_loading_rate} / Kg
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <Box display="flex" alignItems="center" gap={1} flexWrap="wrap" mt={0.5}>
                    <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 800 }}>
                      Configured Storage Slabs:
                    </Typography>
                    {(statement.tariff_terms?.storage_slabs || []).map((s, idx) => (
                      <Chip
                        key={idx}
                        label={`Days ${s.slab_start_day}–${s.slab_end_day || 'Beyond'}: ₹${s.rate}/kg/day`}
                        size="small"
                        sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 800, fontSize: '11px' }}
                      />
                    ))}
                  </Box>
                </Grid>
              </Grid>
            </Paper>

            {/* Vehicle, Transport & Driver Logistics */}
            <Paper elevation={0} sx={{ p: 2, bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#334155', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TruckIcon sx={{ fontSize: 18, color: '#0284c7' }} />
                Transport, Driver & Vehicle Details
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={6} sm={2}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, display: 'block' }}>Vehicle / Lorry No</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 800 }}>{statement.vehicle_no || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={6} sm={2}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, display: 'block' }}>Driver Name</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{statement.driver_name || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={6} sm={2}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, display: 'block' }}>Transporter Name</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#0284c7' }}>{statement.transporter_name || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={6} sm={2}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, display: 'block' }}>Loadman Team</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{statement.loadman_name || 'Inward Unloading Team'}</Typography>
                </Grid>
                <Grid item xs={6} sm={2}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, display: 'block' }}>Loadman Unloading</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#15803d' }}>₹{(statement.loadman_charges || statement.financial_summary?.unloading_charges || 0).toFixed(2)}</Typography>
                </Grid>
                <Grid item xs={6} sm={2}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, display: 'block' }}>Insurance / Other</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a' }}>₹{(statement.insurance_charges || statement.financial_summary?.insurance_charges || 0).toFixed(2)}</Typography>
                </Grid>
              </Grid>
            </Paper>

            {/* Itemized Commodities Table */}
            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: '#0284c7', color: '#ffffff', fontWeight: 800, textTransform: 'uppercase', fontSize: '11px' } }}>
                    <TableCell align="center">#</TableCell>
                    <TableCell>Commodity / Item</TableCell>
                    <TableCell>CS Lot No</TableCell>
                    <TableCell align="right">Qty (Units)</TableCell>
                    <TableCell align="right">Total Weight (Kg)</TableCell>
                    <TableCell align="center">Stored Days</TableCell>
                    <TableCell align="right">Loadman Unloading</TableCell>
                    <TableCell align="right">Storage Rent</TableCell>
                    <TableCell align="right" sx={{ bgcolor: '#0369a1 !important' }}>Total Charge</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {(statement.items || []).map((it, idx) => (
                    <TableRow key={idx} hover>
                      <TableCell align="center" sx={{ color: '#94a3b8', fontSize: '11px' }}>{idx + 1}</TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#0f172a' }}>{it.item_name}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>{it.cold_storage_lot_no}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800 }}>{it.qty} units</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{it.total_weight.toFixed(2)} Kg</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800, color: '#d97706' }}>{it.storage_days} Days</TableCell>
                      <TableCell align="right" sx={{ color: '#334155' }}>₹{it.unloading_charge.toFixed(2)}</TableCell>
                      <TableCell align="right" sx={{ color: '#334155' }}>₹{it.storage_charge.toFixed(2)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: '#15803d', bgcolor: '#f0fdf4' }}>₹{it.total_item_charge.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Financial Summary Strip */}
            <Paper elevation={0} sx={{ p: 2, bgcolor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 2 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={8}>
                  <Stack direction="row" spacing={3} flexWrap="wrap">
                    <Box>
                      <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 800, display: 'block' }}>Unloading Charges</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 800, color: '#334155' }}>₹{statement.financial_summary?.unloading_charges?.toFixed(2)}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 800, display: 'block' }}>Accrued Storage Rent</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 800, color: '#334155' }}>₹{statement.financial_summary?.accrued_storage_charges?.toFixed(2)}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 800, display: 'block' }}>GST Tax ({statement.financial_summary?.tax_rate}%)</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 800, color: '#334155' }}>₹{statement.financial_summary?.total_tax?.toFixed(2)}</Typography>
                    </Box>
                  </Stack>
                </Grid>

                <Grid item xs={12} sm={4} textAlign={{ sm: 'right' }}>
                  <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 800, textTransform: 'uppercase', display: 'block' }}>
                    Grand Total Payment Charges
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 900, color: '#0284c7' }}>
                    ₹{statement.financial_summary?.grand_total?.toFixed(2)}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
          </Box>
        ) : null}
      </DialogContent>

      <DialogActions sx={{ p: 2.5, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0', justifyContent: 'space-between' }}>
        <Button
          variant="outlined"
          startIcon={<OpenInNewIcon />}
          onClick={() => {
            onClose();
            if (navigate) navigate('/cold-storage');
          }}
          sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 700 }}
        >
          Open Cold Storage Workspace
        </Button>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            onClick={onClose}
            sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 700 }}
          >
            Close
          </Button>

          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={handlePrintStatement}
            disabled={!statement}
            sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 800, bgcolor: '#0284c7', px: 3 }}
          >
            Print Cold Storage Bill Statement
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
};

export default ColdStoragePurchaseStatementModal;
