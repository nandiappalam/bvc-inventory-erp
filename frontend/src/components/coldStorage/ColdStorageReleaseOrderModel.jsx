import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  Divider,
  Grid,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButtonGroup,
  ToggleButton,
  Stack,
  Alert
} from '@mui/material';
import {
  Close as CloseIcon,
  Print as PrintIcon,
  CheckCircle as CheckCircleIcon,
  VerifiedUser as AuthorizeIcon,
  Description as DocumentIcon,
  LocalShipping as TruckIcon,
  Business as WarehouseIcon,
  Receipt as ReceiptIcon,
  AssignmentTurnedIn as StatusIcon
} from '@mui/icons-material';
import { printHtml } from '../../utils/printHelper';
import { useAuth } from '../../context/AuthContext';

const ColdStorageReleaseOrderModal = ({ open, onClose, csoData }) => {
  const { selectedCompany } = useAuth();
  const [printFormat, setPrintFormat] = useState('A5'); // 'A5' | '4INCH'
  const [releaseStatus, setReleaseStatus] = useState('Authorized'); // 'Draft' | 'Authorized' | 'Issued' | 'Confirmed'
  const [detailedVoucher, setDetailedVoucher] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && csoData) {
      setReleaseStatus(csoData.status || csoData.release_status || 'Authorized');
      fetchFullVoucherDetails(csoData.id || csoData.voucher_id);
    }
  }, [open, csoData]);

  const fetchFullVoucherDetails = async (voucherId) => {
    if (!voucherId) {
      setDetailedVoucher(csoData);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/cold-storage/vouchers/${voucherId}`);
      const data = await res.json();
      if (data && data.success && data.voucher) {
        setDetailedVoucher(data.voucher);
      } else {
        setDetailedVoucher(csoData);
      }
    } catch (err) {
      console.warn('Notice loading full voucher for CSRO:', err.message);
      setDetailedVoucher(csoData);
    } finally {
      setLoading(false);
    }
  };

  if (!open || !csoData) return null;

  const vData = detailedVoucher || csoData;
  const companyName = selectedCompany?.name || 'BVC EXPORTS PVT. LTD.';
  const companyAddress = selectedCompany?.address || 'Factory & Processing Division, Main Road';
  const companyGst = selectedCompany?.gst_number || selectedCompany?.gstin || '33AAACB1234F1Z1';

  const voucherNo = vData.voucher_no || 'CSO-000001';
  const releaseOrderNo = `CSRO-${voucherNo.replace(/^CSO-/, '')}`;
  const voucherDate = vData.voucher_date || new Date().toISOString().split('T')[0];
  const currentDate = new Date().toLocaleString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });

  const warehouseName = vData.cold_storage_name || vData.operator_name || 'BTS Cold Storage';
  const warehouseAddress = vData.operator_address || vData.storage_location || 'Outside Factory Premises';
  const warehouseContact = vData.operator_phone || vData.driver_phone || '9842100000';

  const receiverName = vData.customer_name || vData.destination_godown_name || 'Production Division';
  const driverName = vData.driver_name || 'Assign Driver';
  const driverPhone = vData.driver_phone || vData.phone || 'N/A';
  const vehicleNo = vData.vehicle_no || vData.lorry_no || 'N/A';
  const transporterName = vData.transporter_name || 'Internal Logistics';
  const loadmanName = vData.loadman_name || 'Factory Loading Team';

  const itemsList = Array.isArray(vData.items) && vData.items.length > 0 ? vData.items : [
    {
      item_name: vData.item_name || 'Commodity / Stored Goods',
      purchase_lot_no: vData.lot_no || vData.purchase_lot_no || 'LOT0006',
      cold_storage_lot_no: vData.cold_storage_lot_no || `CS-${vData.lot_no || 'LOT0006'}`,
      quantity: parseFloat(vData.qty || vData.quantity || vData.total_qty || 0),
      weight: parseFloat(vData.weight || 50),
      total_wt: parseFloat(vData.total_wt || vData.weight || 0),
      unit: vData.unit || 'KG',
      inward_date: vData.inward_date || voucherDate,
      storage_basis: vData.storage_basis || 'Per KG / Day',
      storage_rate: vData.storage_rate || '0.20'
    }
  ];

  // Helper calculation for Release Quantities
  const calculateLotMetrics = (item) => {
    const curReleaseQty = parseFloat(item.quantity || item.qty || 0);
    const curReleaseWt = parseFloat(item.total_wt || (curReleaseQty * parseFloat(item.weight || 50))) || 0;
    
    // Estimate original inward & previous releases if present in item or calculate
    const originalInwardQty = parseFloat(item.original_inward_qty || item.quantity || 0) + parseFloat(item.previously_released_qty || 0);
    const previouslyReleasedQty = parseFloat(item.previously_released_qty || 0);
    const availBeforeRelease = Math.max(curReleaseQty, originalInwardQty - previouslyReleasedQty);
    const balanceAfterRelease = Math.max(0, availBeforeRelease - curReleaseQty);

    return {
      curReleaseQty,
      curReleaseWt,
      originalInwardQty: originalInwardQty > 0 ? originalInwardQty : curReleaseQty,
      previouslyReleasedQty,
      availBeforeRelease,
      balanceAfterRelease,
      inwardDate: item.inward_date || voucherDate,
      billingBasis: item.storage_basis || 'Monthly / Per KG',
      storageRate: item.storage_rate || '0.20'
    };
  };

  // Generate Print HTML string for A5 or 4-inch format
  const generatePrintHTML = (format) => {
    const is4Inch = format === '4INCH';
    
    const pageCss = is4Inch ? `
      @page {
        size: 101.6mm auto;
        margin: 2mm;
      }
      body {
        width: 96mm !important;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        font-size: 10px !important;
        color: #000000 !important;
        background: #ffffff !important;
        margin: 0 auto !important;
        padding: 4px !important;
      }
      .release-order-box {
        border: 2px solid #000000 !important;
        padding: 6px !important;
      }
      th, td {
        font-size: 9px !important;
        padding: 3px !important;
        border: 1px solid #000000 !important;
      }
      .brand-title { font-size: 14px !important; font-weight: 900 !important; text-align: center; text-transform: uppercase; }
      .doc-title { font-size: 11px !important; font-weight: 800 !important; text-align: center; border-bottom: 1px solid #000; padding-bottom: 3px; }
      .section-hdr { font-size: 9px !important; font-weight: 800 !important; background: #f1f5f9; padding: 2px 4px; border-bottom: 1px solid #000; margin-top: 6px; }
      .seal-box { border: 1px dashed #000; height: 50px; text-align: center; font-size: 8px; pt: 30px; }
    ` : `
      @page {
        size: A5 portrait;
        margin: 6mm 8mm;
      }
      body {
        width: 100% !important;
        font-family: Arial, Helvetica, sans-serif !important;
        font-size: 11px !important;
        color: #0f172a !important;
        background: #ffffff !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .release-order-box {
        border: 2px solid #1e3a8a !important;
        padding: 12px !important;
        border-radius: 4px !important;
      }
      th {
        background-color: #1e3a8a !important;
        color: #ffffff !important;
        font-size: 10px !important;
        font-weight: 800 !important;
        padding: 5px 6px !important;
      }
      td {
        border: 1px solid #cbd5e1 !important;
        font-size: 10px !important;
        padding: 4px 6px !important;
      }
      .brand-title { font-size: 16px !important; font-weight: 900 !important; color: #1e3a8a; text-align: center; letter-spacing: 0.5px; }
      .doc-title { font-size: 13px !important; font-weight: 900 !important; color: #0f172a; text-align: center; text-transform: uppercase; background: #eff6ff; padding: 4px; border: 1px solid #93c5fd; margin: 6px 0; }
      .section-hdr { font-size: 11px !important; font-weight: 800 !important; color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 2px; margin-top: 10px; margin-bottom: 6px; }
      .seal-box { border: 1px dashed #94a3b8; height: 60px; text-align: center; font-size: 9px; color: #64748b; padding-top: 40px; border-radius: 4px; }
    `;

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${releaseOrderNo} - Cold Storage Release Order</title>
        <style>
          ${pageCss}
        </style>
      </head>
      <body>
        <div class="release-order-box">
          <!-- HEADER -->
          <div class="brand-title">${companyName}</div>
          <div style="text-align: center; font-size: 9px; color: #475569;">${companyAddress} | GSTIN: ${companyGst}</div>
          
          <div class="doc-title">COLD STORAGE RELEASE ORDER (CSRO)</div>
          <div style="text-align: center; font-size: 9px; font-weight: bold; color: #1e3a8a; margin-bottom: 8px;">
            Factory Authorization for Release of Stored Goods
          </div>

          <!-- META DATA ROW -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
            <tr>
              <td style="width: 25%; font-weight: bold; background: #f8fafc;">Release Order No:</td>
              <td style="width: 25%; font-weight: bold; color: #1e3a8a; font-family: monospace;">${releaseOrderNo}</td>
              <td style="width: 25%; font-weight: bold; background: #f8fafc;">Order Date & Time:</td>
              <td style="width: 25%;">${currentDate}</td>
            </tr>
            <tr>
              <td style="font-weight: bold; background: #f8fafc;">CSO Reference:</td>
              <td style="font-weight: bold; font-family: monospace;">${voucherNo}</td>
              <td style="font-weight: bold; background: #f8fafc;">Release Status:</td>
              <td style="font-weight: bold; color: #16a34a;">${releaseStatus.toUpperCase()}</td>
            </tr>
          </tr>
          </table>

          <!-- WAREHOUSE DETAILS -->
          <div class="section-hdr">1. Cold Storage Warehouse Details</div>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
            <tr>
              <td style="width: 25%; font-weight: bold; background: #f8fafc;">Warehouse / Operator:</td>
              <td style="width: 40%; font-weight: bold; color: #0369a1;">${warehouseName}</td>
              <td style="width: 15%; font-weight: bold; background: #f8fafc;">Contact No:</td>
              <td style="width: 20%;">${warehouseContact}</td>
            </tr>
            <tr>
              <td style="font-weight: bold; background: #f8fafc;">Warehouse Location:</td>
              <td colspan="3">${warehouseAddress}</td>
            </tr>
          </table>

          <!-- STORED GOODS & RELEASE QUANTITY TABLE -->
          <div class="section-hdr">2. Stored Goods & Release Quantity Authorization</div>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
            <thead>
              <tr>
                <th>Item / Description</th>
                <th>Factory Lot No.</th>
                <th>CS Lot No.</th>
                <th style="text-align: right;">Orig. Inward</th>
                <th style="text-align: right;">Prev. Released</th>
                <th style="text-align: right;">Auth Release Qty</th>
                <th style="text-align: right;">Expected Balance</th>
                <th style="text-align: right;">Release Weight (KG)</th>
              </tr>
            </thead>
            <tbody>
    `;

    itemsList.forEach((it, idx) => {
      const m = calculateLotMetrics(it);
      html += `
        <tr>
          <td style="font-weight: bold;">${it.item_name || 'Commodity'}</td>
          <td style="font-family: monospace;">${it.purchase_lot_no || 'LOT-GENERAL'}</td>
          <td style="font-family: monospace; font-weight: bold; color: #0369a1;">${it.cold_storage_lot_no || 'CS-LOT'}</td>
          <td style="text-align: right;">${m.originalInwardQty} ${it.unit || 'KG'}</td>
          <td style="text-align: right;">${m.previouslyReleasedQty} ${it.unit || 'KG'}</td>
          <td style="text-align: right; font-weight: bold; color: #15803d;">${m.curReleaseQty} ${it.unit || 'KG'}</td>
          <td style="text-align: right; font-weight: bold; color: #d97706;">${m.balanceAfterRelease} ${it.unit || 'KG'}</td>
          <td style="text-align: right; font-weight: bold;">${m.curReleaseWt.toFixed(2)} KG</td>
        </tr>
      `;
    });

    html += `
            </tbody>
          </table>

          <!-- STORAGE & BILLING SNAPSHOT -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
            <tr>
              <td style="width: 25%; font-weight: bold; background: #f8fafc;">Storage Inward Date:</td>
              <td style="width: 25%;">${itemsList[0]?.inward_date || voucherDate}</td>
              <td style="width: 25%; font-weight: bold; background: #f8fafc;">Billing Basis / Period:</td>
              <td style="width: 25%;">${itemsList[0]?.storage_basis || 'Monthly / Per KG'}</td>
            </tr>
            <tr>
              <td style="font-weight: bold; background: #f8fafc;">Applicable Storage Rate:</td>
              <td style="font-weight: bold; color: #0369a1;">₹ ${itemsList[0]?.storage_rate || '0.20'} / KG / Day</td>
              <td style="font-weight: bold; background: #f8fafc;">Authorized Outward Date:</td>
              <td style="font-weight: bold;">${voucherDate}</td>
            </tr>
          </table>

          <!-- COLLECTION & TRANSPORT DETAILS -->
          <div class="section-hdr">3. Collection & Transport Details</div>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
            <tr>
              <td style="width: 20%; font-weight: bold; background: #f8fafc;">Collected By / Target:</td>
              <td style="width: 30%; font-weight: bold;">${receiverName}</td>
              <td style="width: 20%; font-weight: bold; background: #f8fafc;">Transporter Name:</td>
              <td style="width: 30%;">${transporterName}</td>
            </tr>
            <tr>
              <td style="font-weight: bold; background: #f8fafc;">Lorry / Vehicle No:</td>
              <td style="font-weight: bold; font-family: monospace; color: #1e3a8a;">${vehicleNo}</td>
              <td style="font-weight: bold; background: #f8fafc;">Driver Name & Phone:</td>
              <td style="font-weight: bold;">${driverName} (${driverPhone})</td>
            </tr>
            <tr>
              <td style="font-weight: bold; background: #f8fafc;">Loadman Team:</td>
              <td>${loadmanName}</td>
              <td style="font-weight: bold; background: #f8fafc;">Dispatch Date / Time:</td>
              <td>${voucherDate} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
            </tr>
          </table>

          <!-- AUTHORIZATION INSTRUCTION -->
          <div style="background: #fefce8; border: 1px solid #fef08a; padding: 6px; text-align: center; font-size: 9px; color: #713f12; margin-bottom: 12px; font-weight: 600;">
            ⚠️ <strong>RELEASE INSTRUCTION:</strong> Please release ONLY the specified quantity above against this authorized order. Record the actual quantity released and report any discrepancy immediately.
          </div>

          <!-- SIGNATURES AND SEALS (4 BLOCKS) -->
          <div style="margin-top: 15px;">
            <table style="width: 100%; border-collapse: collapse; border: none;">
              <tr>
                <td style="width: 25%; border: none !important; padding: 2px;">
                  <div class="seal-box">
                    Authorized Signatory<br />
                    <strong>${companyName}</strong>
                  </div>
                </td>
                <td style="width: 25%; border: none !important; padding: 2px;">
                  <div class="seal-box">
                    Company Seal<br />
                    <strong>${companyName}</strong>
                  </div>
                </td>
                <td style="width: 25%; border: none !important; padding: 2px;">
                  <div class="seal-box">
                    Cold Storage Auth. Signature<br />
                    <strong>${warehouseName}</strong>
                  </div>
                </td>
                <td style="width: 25%; border: none !important; padding: 2px;">
                  <div class="seal-box">
                    Cold Storage Seal<br />
                    <strong>${warehouseName}</strong>
                  </div>
                </td>
              </tr>
            </table>
          </div>

          <div style="margin-top: 8px; text-align: center; font-size: 8px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 4px;">
            Document generated from existing CSO record #${voucherNo}. Actual release confirmed separately via ERP stock movement.
          </div>
        </div>
      </body>
      </html>
    `;
    return html;
  };

  const handlePrint = () => {
    const htmlContent = generatePrintHTML(printFormat);
    const title = `CSRO_${releaseOrderNo}_${voucherDate}`;
    
    // Page options for printHtml engine
    const options = {
      title,
      pageFormat: printFormat === '4INCH' ? '4inch' : 'A5'
    };

    printHtml(htmlContent, title, options);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle component="div" sx={{ bgcolor: '#1e3a8a', color: '#ffffff', py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <DocumentIcon sx={{ fontSize: 28, color: '#93c5fd' }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
              Cold Storage Release Order (CSRO)
            </Typography>
            <Typography variant="caption" sx={{ color: '#bfdbfe' }}>
              Factory Authorization for Cold Storage Warehouse Release
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: '#ffffff' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3, bgcolor: '#f8fafc' }}>
        {/* Top Control Bar */}
        <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 2, border: '1px solid #cbd5e1', bgcolor: '#ffffff' }}>
          <Grid container spacing={2} alignItems="center" justifyContent="space-between">
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', mb: 0.5 }}>
                Print Format & Page Layout
              </Typography>
              <ToggleButtonGroup
                value={printFormat}
                exclusive
                onChange={(e, newF) => newF && setPrintFormat(newF)}
                size="small"
                color="primary"
              >
                <ToggleButton value="A5" sx={{ fontWeight: 800, px: 2 }}>
                  📄 A5 Format (148 x 210 mm)
                </ToggleButton>
                <ToggleButton value="4INCH" sx={{ fontWeight: 800, px: 2 }}>
                  🧾 4-Inch Roll Format
                </ToggleButton>
              </ToggleButtonGroup>
            </Grid>

            <Grid item xs={12} sm={6} display="flex" justifyContent={{ xs: 'flex-start', sm: 'flex-end' }} alignItems="center" gap={1.5}>
              <Box textAlign={{ xs: 'left', sm: 'right' }}>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>Release Order Reference</Typography>
                <Chip
                  label={releaseOrderNo}
                  color="primary"
                  size="small"
                  sx={{ fontWeight: 900, fontFamily: 'monospace' }}
                />
              </Box>
              <Box textAlign={{ xs: 'left', sm: 'right' }}>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>Authorization Status</Typography>
                <Chip
                  label={releaseStatus}
                  color={releaseStatus === 'Confirmed' ? 'success' : 'info'}
                  size="small"
                  sx={{ fontWeight: 900 }}
                />
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* Live Preview Box */}
        <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1.5px solid #1e3a8a', bgcolor: '#ffffff', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          {/* Header */}
          <Box textTransform="uppercase" textAlign="center" mb={2}>
            <Typography variant="h5" sx={{ fontWeight: 900, color: '#1e3a8a', letterSpacing: '0.5px' }}>
              {companyName}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
              {companyAddress} • GSTIN: {companyGst}
            </Typography>
            <Box sx={{ bgcolor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 1.5, py: 0.75, px: 2, mt: 1, display: 'inline-block' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#1e3a8a', textTransform: 'uppercase' }}>
                Cold Storage Release Order (CSRO)
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* Reference Banner */}
          <Grid container spacing={2} sx={{ mb: 2, p: 1.5, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700 }}>Release Order #</Typography>
              <Typography variant="body2" sx={{ fontWeight: 900, fontFamily: 'monospace', color: '#1e3a8a' }}>{releaseOrderNo}</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700 }}>CSO Voucher Ref</Typography>
              <Typography variant="body2" sx={{ fontWeight: 800, fontFamily: 'monospace' }}>{voucherNo}</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700 }}>Order Date</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{voucherDate}</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700 }}>Warehouse Operator</Typography>
              <Typography variant="body2" sx={{ fontWeight: 800, color: '#0369a1' }}>{warehouseName}</Typography>
            </Grid>
          </Grid>

          {/* Quantity Table */}
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e3a8a', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarehouseIcon fontSize="small" /> Authorized Goods & Release Quantities
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#1e3a8a' }}>
                <TableRow>
                  <TableCell sx={{ color: '#fff', fontWeight: 800 }}>Item Name</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 800 }}>Factory Lot</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 800 }}>CS Lot</TableCell>
                  <TableCell align="right" sx={{ color: '#fff', fontWeight: 800 }}>Inward Qty</TableCell>
                  <TableCell align="right" sx={{ color: '#fff', fontWeight: 800 }}>Prev Released</TableCell>
                  <TableCell align="right" sx={{ color: '#fff', fontWeight: 800 }}>Auth Release Qty</TableCell>
                  <TableCell align="right" sx={{ color: '#fff', fontWeight: 800 }}>Exp. Balance</TableCell>
                  <TableCell align="right" sx={{ color: '#fff', fontWeight: 800 }}>Release Wt (KG)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {itemsList.map((it, idx) => {
                  const m = calculateLotMetrics(it);
                  return (
                    <TableRow key={idx}>
                      <TableCell sx={{ fontWeight: 800 }}>{it.item_name || 'Commodity'}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{it.purchase_lot_no || 'LOT-GENERAL'}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 800, color: '#0369a1' }}>{it.cold_storage_lot_no || 'CS-LOT'}</TableCell>
                      <TableCell align="right">{m.originalInwardQty} {it.unit || 'KG'}</TableCell>
                      <TableCell align="right">{m.previouslyReleasedQty} {it.unit || 'KG'}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: '#15803d' }}>{m.curReleaseQty} {it.unit || 'KG'}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, color: '#d97706' }}>{m.balanceAfterRelease} {it.unit || 'KG'}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900 }}>{m.curReleaseWt.toFixed(2)} KG</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Transport & Receiver Details */}
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e3a8a', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <TruckIcon fontSize="small" /> Receiver & Vehicle Dispatch Information
          </Typography>
          <Grid container spacing={1.5} sx={{ mb: 2, p: 1.5, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0', fontSize: '13px' }}>
            <Grid item xs={12} sm={4}>
              <strong>Receiver / Target:</strong> {receiverName}
            </Grid>
            <Grid item xs={12} sm={4}>
              <strong>Transporter:</strong> {transporterName}
            </Grid>
            <Grid item xs={12} sm={4}>
              <strong>Vehicle No:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#1e3a8a' }}>{vehicleNo}</span>
            </Grid>
            <Grid item xs={12} sm={4}>
              <strong>Driver Name:</strong> {driverName}
            </Grid>
            <Grid item xs={12} sm={4}>
              <strong>Driver Phone:</strong> {driverPhone}
            </Grid>
            <Grid item xs={12} sm={4}>
              <strong>Loadman Team:</strong> {loadmanName}
            </Grid>
          </Grid>

          {/* Authorization Notice */}
          <Alert severity="warning" sx={{ mb: 2.5, borderRadius: 1.5, '& .MuiAlert-message': { fontSize: '12px', fontWeight: 600 } }}>
            <strong>Warehouse Instruction:</strong> Please release ONLY the quantity specified above against this authorized order. Record the actual quantity released and report any discrepancy immediately.
          </Alert>

          {/* 4 Signature Boxes */}
          <Grid container spacing={1.5}>
            <Grid item xs={3}>
              <Paper elevation={0} sx={{ border: '1px dashed #94a3b8', p: 1.5, minHeight: 70, textAlign: 'center', bgcolor: '#fafafa' }}>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, display: 'block', mt: 3 }}>
                  Authorized Signatory<br /><strong>{companyName}</strong>
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={3}>
              <Paper elevation={0} sx={{ border: '1px dashed #94a3b8', p: 1.5, minHeight: 70, textAlign: 'center', bgcolor: '#fafafa' }}>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, display: 'block', mt: 3 }}>
                  Company Seal<br /><strong>{companyName}</strong>
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={3}>
              <Paper elevation={0} sx={{ border: '1px dashed #94a3b8', p: 1.5, minHeight: 70, textAlign: 'center', bgcolor: '#fafafa' }}>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, display: 'block', mt: 3 }}>
                  Cold Storage Signature<br /><strong>{warehouseName}</strong>
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={3}>
              <Paper elevation={0} sx={{ border: '1px dashed #94a3b8', p: 1.5, minHeight: 70, textAlign: 'center', bgcolor: '#fafafa' }}>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, display: 'block', mt: 3 }}>
                  Cold Storage Seal<br /><strong>{warehouseName}</strong>
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Paper>
      </DialogContent>

      <DialogActions sx={{ p: 2, bgcolor: '#ffffff', borderTop: '1px solid #e2e8f0', justifyContent: 'space-between' }}>
        <Button onClick={onClose} variant="outlined" color="inherit">
          Close
        </Button>
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            sx={{ fontWeight: 800, px: 3, bgcolor: '#1e3a8a', '&:hover': { bgcolor: '#1d4ed8' } }}
          >
            Print Release Order ({printFormat === '4INCH' ? '4-Inch Thermal' : 'A5 Official'})
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
};

export default ColdStorageReleaseOrderModal;
