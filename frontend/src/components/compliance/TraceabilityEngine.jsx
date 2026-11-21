import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { printHtml } from '../../utils/printHelper';
import { api } from '../../services/api';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  TextField,
  Chip,
  Paper,
  Divider,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  Tooltip,
  IconButton,
  Autocomplete
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import StoreIcon from '@mui/icons-material/Store';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import InventoryIcon from '@mui/icons-material/Inventory';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import VerifiedIcon from '@mui/icons-material/Verified';
import PrintIcon from '@mui/icons-material/Print';
import ScienceIcon from '@mui/icons-material/Science';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import SecurityIcon from '@mui/icons-material/Security';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ClearIcon from '@mui/icons-material/Clear';

const escHtml = (val) => String(val ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export default function TraceabilityEngine({ targetLot = '', onLotChange }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlLot = searchParams.get('lot') || searchParams.get('lot_no') || '';

  const [lotInput, setLotInput] = useState(urlLot || targetLot || '');
  const [traceData, setTraceData] = useState(null);
  const [allLots, setAllLots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const lastQueriedLotRef = useRef(null);
  const isFetchingRef = useRef(false);

  const fetchTraceData = useCallback(async (lotToQuery, updateUrl = true) => {
    const query = (lotToQuery || 'latest').trim();
    if (!query) return;

    if (isFetchingRef.current && lastQueriedLotRef.current?.toUpperCase() === query.toUpperCase()) {
      return;
    }

    isFetchingRef.current = true;
    setLoading(true);
    setError(null);
    lastQueriedLotRef.current = query;

    try {
      const data = await api(`/compliance/traceability/${encodeURIComponent(query)}`);
      if (data && data.success && data.lotNo) {
        setTraceData(data);
        const resolved = data.lotNo || query;
        setLotInput(resolved);
        if (data.activeLots && data.activeLots.length > 0) {
          setAllLots(data.activeLots);
        } else {
          setAllLots([]);
        }
        if (updateUrl) {
          setSearchParams({ lot: resolved }, { replace: true });
        }
        if (onLotChange) {
          onLotChange(resolved);
        }
      } else {
        setTraceData(null);
        setAllLots(data?.activeLots || []);
        setError(data?.message || `No trace records found for lot "${query}" in this company.`);
      }
    } catch (err) {
      console.error('Error tracing lot:', err);
      setTraceData(null);
      setError(err?.message || 'Failed to connect to Traceability Engine.');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [onLotChange, setSearchParams]);

  // Initial load & company change listener
  useEffect(() => {
    const initialLot = urlLot || targetLot || 'latest';
    fetchTraceData(initialLot, false);

    const handleCompanyChange = () => {
      lastQueriedLotRef.current = null;
      fetchTraceData('latest', false);
    };
    window.addEventListener('erp_company_changed', handleCompanyChange);
    return () => window.removeEventListener('erp_company_changed', handleCompanyChange);
  }, []);

  // When external targetLot prop changes
  useEffect(() => {
    if (targetLot && targetLot !== lastQueriedLotRef.current && targetLot !== traceData?.lotNo) {
      setLotInput(targetLot);
      fetchTraceData(targetLot, true);
    }
  }, [targetLot]);

  const handleManualSearch = (specificLot) => {
    const query = (specificLot || lotInput || 'latest').trim();
    if (query) {
      setLotInput(query);
      fetchTraceData(query, true);
    }
  };

  const handleTrace = (lot) => {
    handleManualSearch(lot);
  };

  const handlePrint = () => {
    if (!traceData) return;
    const lotNo = traceData.lotNo || lotInput || 'LOT';
    const supplier = traceData.backwardTrace?.supplier;
    const iqr = traceData.backwardTrace?.iqr;
    const grindBatches = traceData.productionHistory?.grindBatches || [];
    const coas = traceData.qualityCertificates?.coas || [];
    const dispatches = traceData.forwardTrace?.dispatches || [];
    const purReturns = traceData.purchaseReturns || traceData.backwardTrace?.purchaseReturns || [];
    const stockMovements = traceData.stockMovements || [];

    const printWindowHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>360° Traceability Certificate - Lot ${escHtml(lotNo)}</title>
        <style>
          @page { size: A4; margin: 12mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 15px; color: #0f172a; font-size: 11px; line-height: 1.4; }
          .header { text-align: center; border-bottom: 2px solid #1f4fb2; padding-bottom: 10px; margin-bottom: 15px; }
          .company-name { font-size: 22px; font-weight: 900; color: #1f4fb2; letter-spacing: 0.5px; }
          .subtitle { font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
          .cert-title { font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 8px; background: #eff6ff; display: inline-block; padding: 4px 16px; border-radius: 4px; border: 1px solid #bfdbfe; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
          .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; }
          .meta-box label { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; }
          .meta-box val { font-size: 11px; font-weight: 800; color: #0f172a; }
          .section { margin-bottom: 14px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; page-break-inside: avoid; }
          .section-header { background: #1f4fb2; color: white; font-weight: 800; padding: 6px 12px; font-size: 11px; text-transform: uppercase; }
          .section-body { padding: 10px; background: #ffffff; }
          table { width: 100%; border-collapse: collapse; margin-top: 6px; }
          th, td { border: 1px solid #cbd5e1; padding: 5px 8px; font-size: 10px; text-align: left; }
          th { background: #f1f5f9; font-weight: 700; color: #1e293b; }
          .badge-pass { background: #dcfce7; color: #15803d; font-weight: 800; padding: 2px 6px; border-radius: 3px; font-size: 9px; display: inline-block; }
          .footer-sig { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 25px; padding-top: 15px; border-top: 1px dashed #cbd5e1; text-align: center; }
          .sig-line { border-top: 1px solid #0f172a; margin-top: 25px; padding-top: 4px; font-weight: 700; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">BVC EXPORTS PVT. LTD.</div>
          <div class="subtitle">Quality Assurance & Food Safety Compliance Division • FSSAI / HACCP / ISO 22000 Certified</div>
          <div class="cert-title">360° COMPLETE LOT TRACEABILITY & ORIGIN CERTIFICATE</div>
        </div>

        <div class="grid-2">
          <div class="meta-box">
            <label>Target Lot Number</label>
            <val style="color:#1f4fb2; font-family:monospace; font-size:14px;">${escHtml(lotNo)}</val>
          </div>
          <div class="meta-box">
            <label>Commodity / Item Name</label>
            <val>${escHtml(traceData.lotDetails?.item_name || supplier?.item_name || 'N/A')}</val>
          </div>
          <div class="meta-box">
            <label>Parent Input Lots</label>
            <val>${escHtml((traceData.parentLots && traceData.parentLots.length > 0 ? traceData.parentLots.join(', ') : traceData.parentLot) || 'Direct Inward Lot')}</val>
          </div>
          <div class="meta-box">
            <label>Trace Issue Date</label>
            <val>${escHtml(new Date().toLocaleDateString('en-GB'))}</val>
          </div>
        </div>

        <div class="section">
          <div class="section-header">1. Inward Procurement & Supplier Origin (Backward Trace)</div>
          <div class="section-body">
            ${supplier ? `
              <table>
                <tr>
                  <th>Supplier Name</th>
                  <td><strong>${escHtml(supplier.name || '—')}</strong></td>
                  <th>GSTIN / License</th>
                  <td>${escHtml(supplier.gstin || '—')}</td>
                </tr>
                <tr>
                  <th>Inward Invoice No</th>
                  <td><strong>${escHtml(supplier.invoice_no || '—')}</strong></td>
                  <th>Receiving Date</th>
                  <td>${escHtml(supplier.receiving_date || '—')}</td>
                </tr>
                <tr>
                  <th>Inward Quantity</th>
                  <td><strong>${escHtml(supplier.inward_qty_bags || 0)} Bags (${escHtml(supplier.total_weight_kg || 0)} Kg)</strong></td>
                  <th>Godown Location</th>
                  <td>${escHtml(supplier.godown_name || '—')}</td>
                </tr>
                <tr>
                  <th>Vehicle Number</th>
                  <td>${escHtml(supplier.vehicle_no || '—')}</td>
                  <th>Address & Contact</th>
                  <td>${escHtml([supplier.address, supplier.area].filter(Boolean).join(', ') || '—')} ${supplier.phone ? `(Ph: ${escHtml(supplier.phone)})` : ''}</td>
                </tr>
              </table>
            ` : '<p style="margin:0;">No direct procurement invoice linked (produced/converted batch or opening lot).</p>'}
            ${purReturns && purReturns.length > 0 ? `
              <div style="margin-top:8px; padding:6px 10px; background:#fffbeb; border:1px solid #fde68a; border-radius:4px;">
                <div style="font-weight:800; color:#b45309; font-size:10px; margin-bottom:4px;">DEBIT NOTE / PURCHASE RETURN DETAILS:</div>
                <table>
                  <thead>
                    <tr>
                      <th>Voucher No</th>
                      <th>Return Date</th>
                      <th>Supplier</th>
                      <th>Item</th>
                      <th style="text-align:right;">Returned Qty</th>
                      <th style="text-align:right;">Returned Wt (kg)</th>
                      <th>Return Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${purReturns.map(pr => `
                      <tr>
                        <td><strong>${escHtml(pr.return_voucher_no || '—')}</strong></td>
                        <td>${escHtml(pr.date || '—')}</td>
                        <td>${escHtml(pr.supplier_name || '—')}</td>
                        <td>${escHtml(pr.item_name || '—')}</td>
                        <td style="text-align:right; color:#dc2626; font-weight:700;">-${escHtml(pr.returned_qty || 0)}</td>
                        <td style="text-align:right; color:#dc2626; font-weight:700;">-${escHtml(pr.returned_total_weight_kg || 0)} kg</td>
                        <td>${escHtml(pr.return_reason || 'Rejection Return')}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : ''}
          </div>
        </div>

        <div class="section">
          <div class="section-header">2. Incoming Quality Control Report (IQR / P1)</div>
          <div class="section-body">
            ${iqr ? `
              <table>
                <tr>
                  <th>IQR / QC Record No</th>
                  <td><strong>${escHtml(iqr.record_no || iqr.findings?.iqr_no || '—')}</strong></td>
                  <th>Inspection Date</th>
                  <td>${escHtml(iqr.record_date || '—')}</td>
                  <th>Inspected By</th>
                  <td>${escHtml(iqr.checked_by || '—')}</td>
                </tr>
                <tr>
                  <th>Moisture Content</th>
                  <td><strong>${escHtml(iqr.findings?.moisture || 'N/A')}</strong></td>
                  <th>Foreign Matter</th>
                  <td><strong>${escHtml(iqr.findings?.foreign_matter || 'N/A')}</strong></td>
                  <th>Broken Grain</th>
                  <td><strong>${escHtml(iqr.findings?.broken_grain || 'N/A')}</strong></td>
                </tr>
                <tr>
                  <th>Weevil / Pest</th>
                  <td>${escHtml(iqr.findings?.weevils || 'N/A')}</td>
                  <th>Overall Decision</th>
                  <td colspan="3"><span class="badge-pass">${escHtml(iqr.findings?.decision || iqr.status || 'RECORDED')}</span></td>
                </tr>
              </table>
            ` : '<p style="margin:0;">No incoming quality report logged for this lot yet.</p>'}
          </div>
        </div>

        ${grindBatches.length > 0 ? `
          <div class="section">
            <div class="section-header">3. Milling Transformation & In-Process Audit (P3 / P4)</div>
            <div class="section-body">
              ${grindBatches.map(gb => `
                <div style="margin-bottom:8px; padding-bottom:8px; border-bottom:1px dashed #cbd5e1;">
                  <div style="font-weight:800; color:#6b21a8; margin-bottom:4px;">
                    Grind Ref: ${escHtml(gb.grind_no)} | Date: ${escHtml(gb.date || '—')} | Facility: ${escHtml(gb.flour_mill)} | Yield: ${escHtml(gb.yield_efficiency)}
                  </div>
                  <table>
                    <tr>
                      <th>CCP / Process Check</th>
                      <th>Logged Value</th>
                      <th>Status</th>
                    </tr>
                    <tr>
                      <td>CCP-1: Magnetic Separator</td>
                      <td>${escHtml(gb.ccp_monitoring?.ccp1_magnet || 'Not Logged')}</td>
                      <td><span class="badge-pass">${escHtml(gb.ccp_monitoring?.status || '—')}</span></td>
                    </tr>
                    <tr>
                      <td>CCP-1: Gravity De-Stoner</td>
                      <td>${escHtml(gb.ccp_monitoring?.ccp1_destoner || 'Not Logged')}</td>
                      <td><span class="badge-pass">${escHtml(gb.ccp_monitoring?.status || '—')}</span></td>
                    </tr>
                    <tr>
                      <td>CCP-2: Stainless Sifter</td>
                      <td>${escHtml(gb.ccp_monitoring?.ccp2_sifter || 'Not Logged')}</td>
                      <td><span class="badge-pass">${escHtml(gb.ccp_monitoring?.status || '—')}</span></td>
                    </tr>
                  </table>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="section">
          <div class="section-header">4. Certificate of Analysis (COA / P6) Laboratory Results</div>
          <div class="section-body">
            ${coas.length > 0 ? coas.map(coa => `
              <div style="margin-bottom:8px;">
                <div style="font-weight:800; color:#0369a1; margin-bottom:4px;">
                  COA Ref: ${escHtml(coa.record_no || '—')} | Item: ${escHtml(coa.item_name)} | Batch Lot: ${escHtml(coa.lot_no)}
                </div>
                ${(coa.findings?.parameters && coa.findings.parameters.length > 0) ? `
                  <table>
                    <tr>
                      <th>S.No</th>
                      <th>Analytical Parameter</th>
                      <th>Specification Standard</th>
                      <th>Observed Result</th>
                      <th>Status</th>
                    </tr>
                    ${coa.findings.parameters.map((p, idx) => `
                      <tr>
                        <td>${idx + 1}</td>
                        <td>${escHtml(p.parameter)}</td>
                        <td>${escHtml(p.standard)}</td>
                        <td><strong>${escHtml(p.observed)}</strong></td>
                        <td><span class="badge-pass">${escHtml(p.result || 'PASS')}</span></td>
                      </tr>
                    `).join('')}
                  </table>
                ` : '<p style="margin:4px 0;">QC clearance logged without parameter breakdown.</p>'}
                <div style="margin-top:6px; font-weight:800; color:#15803d;">
                  Decision: ${escHtml(coa.findings?.decision || coa.status || 'RECORDED')} ${coa.approved_by ? `(Approved By: ${escHtml(coa.approved_by)})` : ''}
                </div>
              </div>
            `).join('') : '<p style="margin:0;">No Certificate of Analysis (P6 / QC) parameters logged for this lot.</p>'}
          </div>
        </div>

        <div class="section">
          <div class="section-header">5. Chronological Stock, Cold Storage & Godown Transfer Timeline</div>
          <div class="section-body">
            ${stockMovements.length > 0 ? `
              <table>
                <tr>
                  <th>Date</th>
                  <th>Module</th>
                  <th>Ref No</th>
                  <th>Godown</th>
                  <th>Lot</th>
                  <th>Dir</th>
                  <th>Qty</th>
                  <th>Weight (Kg)</th>
                  <th>Party / Remarks</th>
                </tr>
                ${stockMovements.map(m => `
                  <tr>
                    <td>${escHtml(m.movement_date || '—')}</td>
                    <td>${escHtml(m.source_module || m.movement_type || '—')}</td>
                    <td>${escHtml(m.source_ref_no || '—')}</td>
                    <td>${escHtml(m.godown_name || '—')}</td>
                    <td>${escHtml(m.lot_no || '—')}</td>
                    <td>${escHtml(m.direction || '—')}</td>
                    <td>${escHtml(m.qty || 0)}</td>
                    <td>${escHtml(m.weight || 0)}</td>
                    <td>${escHtml(m.party_name || m.remarks || '—')}</td>
                  </tr>
                `).join('')}
              </table>
            ` : '<p style="margin:0;">No stock movements recorded.</p>'}
          </div>
        </div>

        <div class="section">
          <div class="section-header">6. Forward Dispatches & Terminal Inspection (P7)</div>
          <div class="section-body">
            ${dispatches.length > 0 ? `
              <table>
                <tr>
                  <th>Customer Name</th>
                  <th>Invoice No</th>
                  <th>Dispatch Date</th>
                  <th>Dispatched Qty</th>
                  <th>Vehicle No</th>
                  <th>Terminal QA</th>
                </tr>
                ${dispatches.map(d => `
                  <tr>
                    <td><strong>${escHtml(d.customer_name || '—')}</strong></td>
                    <td>${escHtml(d.invoice_no || '—')}</td>
                    <td>${escHtml(d.date || '—')}</td>
                    <td>${escHtml(d.sold_qty || 0)} Bags (${escHtml(d.sold_weight_kg || 0)} Kg)</td>
                    <td>${escHtml(d.terminal_inspection?.vehicle_no || '—')}</td>
                    <td><span class="badge-pass">${escHtml(d.terminal_inspection?.status || 'Dispatched')}</span></td>
                  </tr>
                `).join('')}
              </table>
            ` : '<p style="margin:0;">Stock currently held in factory godowns or not yet dispatched to customers.</p>'}
          </div>
        </div>

        <div class="footer-sig">
          <div>
            <div class="sig-line">QA Inspector / Chemist</div>
            <div style="font-size:9px; color:#64748b;">Inspected & Verified</div>
          </div>
          <div>
            <div class="sig-line">Plant Milling Incharge</div>
            <div style="font-size:9px; color:#64748b;">Production Clearance</div>
          </div>
          <div>
            <div class="sig-line">Quality Assurance Head</div>
            <div style="font-size:9px; color:#1f4fb2; font-weight:800;">Authorized Signatory</div>
          </div>
        </div>
      </body>
      </html>
    `;

    printHtml(printWindowHtml, `360_Traceability_Certificate_${lotNo}`);
  };

  const supplier = traceData?.backwardTrace?.supplier;
  const parentPurchases = traceData?.backwardTrace?.parentPurchases || [];
  const purchaseReturns = traceData?.purchaseReturns || traceData?.backwardTrace?.purchaseReturns || [];
  const totalReturnedBags = purchaseReturns.reduce((acc, r) => acc + (parseFloat(r.returned_qty) || 0), 0);
  const iqr = traceData?.backwardTrace?.iqr;
  const grindBatches = traceData?.productionHistory?.grindBatches || [];
  const rawCoas = traceData?.qualityCertificates?.coas || [];
  const seenCoaKeys = new Set();
  const coas = rawCoas.filter(c => {
    const k = c.record_no || c.findings?.coa_no || c.lot_no;
    if (!k || seenCoaKeys.has(k)) return false;
    seenCoaKeys.add(k);
    return true;
  });
  const currentStock = traceData?.currentStock || [];
  const stockMovements = traceData?.stockMovements || [];
  const dispatches = traceData?.forwardTrace?.dispatches || [];
  const parentLots = (traceData?.parentLots && traceData.parentLots.length > 0)
    ? traceData.parentLots
    : (traceData?.parentLot ? [traceData.parentLot] : []);
  const activeLots = (traceData?.activeLots && traceData.activeLots.length > 0) ? traceData.activeLots : allLots;

  return (
    <Box sx={{ pb: 6 }}>
      {/* SEARCH HEADER & LOT PICKER */}
      <Card sx={{ mb: 3, p: 2.5, backgroundColor: '#f0f6ff', border: '1px solid #bfdbfe' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1f4fb2', mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <AltRouteIcon /> P8 — Interactive Traceability Engine (360° Backward & Forward Trace)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Search or select any Raw Material or Finished Goods Lot Number to inspect full supplier origin, inward QC, milling transformation batches, godown balances, and customer dispatches.
            </Typography>

            {/* Quick Active Lots Chips */}
            {activeLots.length > 0 && (
              <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', mr: 0.5 }}>
                  Active Factory Lots:
                </Typography>
                {activeLots.slice(0, 12).map((al, idx) => (
                  <Chip
                    key={`${al.lot_no}-${idx}`}
                    label={`${al.lot_no} (${al.item_name})`}
                    size="small"
                    onClick={() => {
                      setLotInput(al.lot_no);
                      handleManualSearch(al.lot_no);
                    }}
                    color={traceData?.lotNo?.toUpperCase() === al.lot_no?.toUpperCase() ? 'primary' : 'default'}
                    variant={traceData?.lotNo?.toUpperCase() === al.lot_no?.toUpperCase() ? 'filled' : 'outlined'}
                    sx={{
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      bgcolor: traceData?.lotNo?.toUpperCase() === al.lot_no?.toUpperCase() ? '#1f4fb2' : '#ffffff',
                      borderColor: traceData?.lotNo?.toUpperCase() === al.lot_no?.toUpperCase() ? '#1f4fb2' : '#cbd5e1',
                      '&:hover': { bgcolor: '#e0f2fe' }
                    }}
                  />
                ))}
              </Box>
            )}
          </Grid>

          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Autocomplete
                freeSolo
                size="small"
                fullWidth
                options={activeLots}
                getOptionLabel={(option) => {
                  if (typeof option === 'string') return option;
                  return `${option.lot_no} — ${option.item_name} (${option.remaining_quantity ?? option.initial_qty ?? 0} Bags)`;
                }}
                inputValue={lotInput}
                onInputChange={(event, newInputValue, reason) => {
                  if (reason === 'input' || reason === 'clear') {
                    setLotInput(newInputValue);
                  }
                }}
                onChange={(event, newValue) => {
                  if (newValue) {
                    const cleanVal = typeof newValue === 'string'
                      ? (newValue.includes('—') ? newValue.split('—')[0].trim() : newValue)
                      : newValue.lot_no;
                    setLotInput(cleanVal);
                    handleManualSearch(cleanVal);
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Search / Type any Lot No (e.g. LOT0001, LOT0004, LOT0014)..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleManualSearch(lotInput);
                      }
                    }}
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />
                    }}
                    sx={{ bgcolor: 'white' }}
                  />
                )}
              />
              <Button
                variant="contained"
                onClick={() => handleManualSearch(lotInput)}
                disabled={loading}
                sx={{ fontWeight: 700, minWidth: 120, height: 40, bgcolor: '#1f4fb2' }}
              >
                {loading ? <CircularProgress size={20} color="inherit" /> : 'Trace Lot'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Card>

      {error && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 10, gap: 2 }}>
          <CircularProgress size={44} />
          <Typography variant="body2" color="text.secondary">
            Querying 360° backward and forward traceability records...
          </Typography>
        </Box>
      ) : traceData ? (
        <Box>
          {/* QUICK SUMMARY HEADER BAR */}
          <Paper
            elevation={1}
            sx={{
              p: 2.5,
              mb: 3,
              border: '1px solid #e2e8f0',
              backgroundColor: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 2,
              borderRadius: 2
            }}
          >
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, letterSpacing: 0.5 }}>
                360° TRACE REPORT FOR LOT
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.2 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#1f4fb2', fontFamily: 'monospace' }}>
                  {traceData.lotNo}
                </Typography>
                <Chip
                  label={traceData.lotDetails?.item_name || supplier?.item_name || 'Raw Material / Finished Good'}
                  color="primary"
                  size="small"
                  sx={{ fontWeight: 700, bgcolor: '#e0e7ff', color: '#3730a3' }}
                />
                {parentLots.map((pLot) => (
                  <Chip
                    key={pLot}
                    label={`Derived from: ${pLot}`}
                    size="small"
                    variant="outlined"
                    onClick={() => handleTrace(pLot)}
                    icon={<SyncAltIcon fontSize="small" />}
                    sx={{ cursor: 'pointer', borderColor: '#8b5cf6', color: '#6d28d9', fontWeight: 600 }}
                  />
                ))}
                {purchaseReturns.length > 0 && (
                  <Chip
                    label={`Debit Note Return: ${totalReturnedBags} Bags`}
                    color="warning"
                    size="small"
                    sx={{ fontWeight: 800, bgcolor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}
                  />
                )}
              </Stack>
            </Box>

            <Stack direction="row" spacing={3} alignItems="center">
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                  CURRENT FACTORY STOCK
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#16a34a' }}>
                  {currentStock.reduce((s, c) => s + (parseFloat(c.remaining_quantity || c.available_qty || c.quantity) || 0), 0)} Bags
                </Typography>
              </Box>
              <Divider orientation="vertical" flexItem />
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={handlePrint}
                size="medium"
                sx={{ fontWeight: 700, borderColor: '#cbd5e1', color: '#334155' }}
              >
                Print Trace Certificate
              </Button>
            </Stack>
          </Paper>

          {/* TRACEABILITY 6-STEP FULL LIFECYCLE GRID */}
          <Grid container spacing={3}>

            {/* 1. BACKWARD TRACE: Origin & Supplier */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%', borderTop: '4px solid #1f4fb2', border: '1px solid #cbd5e1', borderRadius: 2 }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <StoreIcon sx={{ color: '#1f4fb2' }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                        1. Inward Origin & Supplier Details
                      </Typography>
                    </Box>
                    <Chip label="BACKWARD TRACE" size="small" sx={{ bgcolor: '#e0e7ff', color: '#1e40af', fontWeight: 700, fontSize: '10px' }} />
                  </Box>

                  {supplier ? (
                    <Box sx={{ fontSize: '13px', lineHeight: 1.9, bgcolor: '#f8fafc', p: 2, borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                      <Grid container spacing={1}>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>SUPPLIER NAME</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>{supplier.name}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>INVOICE / GRN NO</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace', color: '#1f4fb2' }}>{supplier.invoice_no}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>INWARD QUANTITY</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 800, color: '#059669' }}>
                            {supplier.inward_qty_bags} Bags ({supplier.total_weight_kg ? `${Number(supplier.total_weight_kg).toLocaleString()} Kg` : '—'})
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>RECEIVING DATE</Typography>
                          <Typography variant="body2">{supplier.receiving_date || '—'}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>SUPPLIER GSTIN</Typography>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{supplier.gstin || '—'}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>RECEIVING GODOWN</Typography>
                          <Typography variant="body2">{supplier.godown_name || '—'}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>TRANSPORT VEHICLE</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{supplier.vehicle_no || '—'}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>PURCHASE RATE</Typography>
                          <Typography variant="body2">₹{supplier.rate_per_unit || 0} / Unit ({supplier.pay_type || '—'})</Typography>
                        </Grid>
                        <Grid item xs={12}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>SUPPLIER ADDRESS & CONTACT</Typography>
                          <Typography variant="body2">
                            {[supplier.address, supplier.area].filter(Boolean).join(', ') || '—'}{supplier.phone ? ` — Ph: ${supplier.phone}` : ''}
                          </Typography>
                        </Grid>
                      </Grid>
                      {parentPurchases.length > 1 && (
                        <Box sx={{ mt: 1.5, pt: 1, borderTop: '1px dashed #cbd5e1' }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', display: 'block', mb: 0.5 }}>
                            All Linked Parent Purchases ({parentPurchases.length}):
                          </Typography>
                          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                            {parentPurchases.map((pp, idx) => (
                              <Chip
                                key={`pp-${pp.lot_no}-${idx}`}
                                label={`${pp.lot_no}: ${pp.supplier_name} (${pp.inward_qty_bags} Bags)`}
                                size="small"
                                onClick={() => handleTrace(pp.lot_no)}
                                sx={{ fontSize: '11px', cursor: 'pointer', bgcolor: '#e0f2fe', color: '#0369a1' }}
                              />
                            ))}
                          </Stack>
                        </Box>
                      )}

                      {purchaseReturns.length > 0 && (
                        <Box sx={{ mt: 2, p: 1.5, bgcolor: '#fffbeb', borderRadius: 1.5, border: '1px solid #fde68a' }}>
                          <Typography variant="caption" sx={{ fontWeight: 800, color: '#b45309', display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                            ⚠️ PURCHASE RETURN (DEBIT NOTE) DISPATCHED TO SUPPLIER
                          </Typography>
                          {purchaseReturns.map((pr, idx) => (
                            <Box key={`pr-${idx}`} sx={{ fontSize: '12px', color: '#92400e', mb: idx < purchaseReturns.length - 1 ? 1 : 0, pb: idx < purchaseReturns.length - 1 ? 1 : 0, borderBottom: idx < purchaseReturns.length - 1 ? '1px dashed #fde68a' : 'none' }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                                <span>Voucher: {pr.return_voucher_no} ({pr.date})</span>
                                <span style={{ color: '#dc2626' }}>- {pr.returned_qty} Bags ({pr.returned_total_weight_kg} Kg)</span>
                              </Box>
                              <Box sx={{ fontSize: '11px', color: '#78350f', mt: 0.2 }}>
                                Reason: {pr.return_reason || 'Material Rejection'} | Supplier: {pr.supplier_name}
                              </Box>
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>
                  ) : (
                    <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px dashed #cbd5e1' }}>
                      <Typography variant="body2" color="text.secondary">
                        Procurement record linked through batch transformation chain.
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* 2. INCOMING QUALITY REPORT (IQR / P1) */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%', borderTop: '4px solid #059669', border: '1px solid #cbd5e1', borderRadius: 2 }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FactCheckIcon sx={{ color: '#059669' }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                        2. Incoming Quality Report (IQR / P1)
                      </Typography>
                    </Box>
                    <Chip
                      label={iqr ? (iqr.findings?.decision || iqr.status || 'QC RECORDED') : 'NO IQR LOGGED'}
                      size="small"
                      sx={{
                        bgcolor: iqr ? '#dcfce7' : '#f1f5f9',
                        color: iqr ? '#15803d' : '#64748b',
                        fontWeight: 700,
                        fontSize: '10px'
                      }}
                    />
                  </Box>

                  {iqr ? (
                    <Box sx={{ fontSize: '13px', lineHeight: 1.9, bgcolor: '#f0fdf4', p: 2, borderRadius: 1.5, border: '1px solid #bbf7d0' }}>
                      <Grid container spacing={1}>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>IQR / QC RECORD NO</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace', color: '#059669' }}>
                            {iqr.record_no || iqr.findings?.iqr_no || '—'}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>INSPECTION DATE</Typography>
                          <Typography variant="body2">{iqr.record_date || '—'}</Typography>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>MOISTURE</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>{iqr.findings?.moisture || 'N/A'}</Typography>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>FOREIGN MATTER</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>{iqr.findings?.foreign_matter || 'N/A'}</Typography>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>BROKEN GRAIN</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>{iqr.findings?.broken_grain || 'N/A'}</Typography>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>WEEVILS / PEST</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#16a34a' }}>{iqr.findings?.weevils || 'N/A'}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>INSPECTED BY</Typography>
                          <Typography variant="body2">{iqr.checked_by || '—'}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>DECISION / STATUS</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 800, color: '#15803d' }}>
                            {iqr.findings?.decision || iqr.status || 'RECORDED'}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Box>
                  ) : (
                    <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px dashed #cbd5e1' }}>
                      <Typography variant="body2" color="text.secondary">
                        No Incoming Quality Report (IQR / P1) or QC inspection logged for this lot yet.
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* 3. PRODUCTION & MILLING DETAILS (GRIND BATCHES + CCP MONITORING) */}
            <Grid item xs={12}>
              <Card sx={{ borderTop: '4px solid #7c3aed', border: '1px solid #cbd5e1', borderRadius: 2 }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PrecisionManufacturingIcon sx={{ color: '#7c3aed' }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                        3. Milling & In-Process Transformation (Grind Batches & CCPs)
                      </Typography>
                    </Box>
                    <Chip label="TRANSFORMATION AUDIT" size="small" sx={{ bgcolor: '#f3e8ff', color: '#6b21a8', fontWeight: 700, fontSize: '10px' }} />
                  </Box>

                  {grindBatches.length > 0 ? (
                    <Stack spacing={2.5}>
                      {grindBatches.map((gb, idx) => (
                        <Paper key={idx} variant="outlined" sx={{ p: 2, bgcolor: '#faf5ff', borderColor: '#e9d5ff', borderRadius: 2 }}>
                          <Grid container spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
                            <Grid item xs={12} sm={3}>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>GRIND NUMBER</Typography>
                              <Typography variant="subtitle2" sx={{ fontWeight: 800, fontFamily: 'monospace', color: '#6b21a8' }}>
                                {gb.grind_no}
                              </Typography>
                            </Grid>
                            <Grid item xs={12} sm={3}>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>MILLING FACILITY</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>{gb.flour_mill}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={3}>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>MILLING DATE</Typography>
                              <Typography variant="body2">{gb.date}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={3}>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>YIELD EFFICIENCY</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 800, color: '#15803d' }}>
                                {gb.yield_efficiency} (Loss: {gb.milling_loss_kg} Kg)
                              </Typography>
                            </Grid>
                          </Grid>

                          {/* Inputs and Outputs Table */}
                          <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                              <Typography variant="caption" sx={{ fontWeight: 800, color: '#374151', display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                📥 RAW MATERIAL INPUTS
                              </Typography>
                              <TableContainer component={Paper} variant="outlined" sx={{ bgcolor: 'white' }}>
                                <Table size="small">
                                  <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                                    <TableRow>
                                      <TableCell sx={{ fontWeight: 700 }}>Input Item</TableCell>
                                      <TableCell sx={{ fontWeight: 700 }}>Input Lot</TableCell>
                                      <TableCell sx={{ fontWeight: 700 }}>Bags</TableCell>
                                      <TableCell sx={{ fontWeight: 700 }}>Total Kg</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {gb.inputs.map((inp, iIdx) => (
                                      <TableRow key={iIdx}>
                                        <TableCell sx={{ fontWeight: 600 }}>{inp.item_name}</TableCell>
                                        <TableCell>
                                          <Chip
                                            label={inp.lot_no}
                                            size="small"
                                            onClick={() => handleTrace(inp.lot_no)}
                                            sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '11px', cursor: 'pointer', bgcolor: '#e0f2fe', color: '#0369a1' }}
                                          />
                                        </TableCell>
                                        <TableCell>{inp.qty_bags}</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>{inp.total_weight_kg.toLocaleString()} Kg</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </TableContainer>
                            </Grid>

                            <Grid item xs={12} md={6}>
                              <Typography variant="caption" sx={{ fontWeight: 800, color: '#374151', display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                📤 FINISHED GOOD OUTPUTS
                              </Typography>
                              <TableContainer component={Paper} variant="outlined" sx={{ bgcolor: 'white' }}>
                                <Table size="small">
                                  <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                                    <TableRow>
                                      <TableCell sx={{ fontWeight: 700 }}>Output Item</TableCell>
                                      <TableCell sx={{ fontWeight: 700 }}>Output Lot</TableCell>
                                      <TableCell sx={{ fontWeight: 700 }}>Bags</TableCell>
                                      <TableCell sx={{ fontWeight: 700 }}>Total Kg</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {gb.outputs.map((out, oIdx) => (
                                      <TableRow key={oIdx}>
                                        <TableCell sx={{ fontWeight: 600 }}>{out.item_name}</TableCell>
                                        <TableCell>
                                          <Chip
                                            label={out.lot_no}
                                            size="small"
                                            onClick={() => handleTrace(out.lot_no)}
                                            sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '11px', cursor: 'pointer', bgcolor: '#f3e8ff', color: '#6b21a8' }}
                                          />
                                        </TableCell>
                                        <TableCell>{out.qty_bags}</TableCell>
                                        <TableCell sx={{ fontWeight: 700, color: '#7c3aed' }}>{out.total_weight_kg.toLocaleString()} Kg</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </TableContainer>
                            </Grid>
                          </Grid>

                          {/* In-Process & CCP Verifications */}
                          <Grid container spacing={2} sx={{ mt: 1 }}>
                            <Grid item xs={12} md={6}>
                              <Box sx={{ p: 1.5, bgcolor: '#ffffff', borderRadius: 1.5, border: '1px solid #e9d5ff' }}>
                                <Typography variant="caption" sx={{ fontWeight: 800, color: '#6b21a8', display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                  <FactCheckIcon sx={{ fontSize: 16 }} /> P3 — IN-PROCESS CHECKLIST
                                </Typography>
                                <Typography variant="caption" sx={{ display: 'block', color: '#475569' }}>
                                  • Sieve / Wire Mesh: <strong>{gb.in_process_checklist?.mesh_size}</strong>
                                </Typography>
                                <Typography variant="caption" sx={{ display: 'block', color: '#475569' }}>
                                  • Milling Temperature: <strong>{gb.in_process_checklist?.milling_temperature}</strong>
                                </Typography>
                                <Typography variant="caption" sx={{ display: 'block', color: '#475569' }}>
                                  • Foreign Matter: <strong>{gb.in_process_checklist?.foreign_matter_audit}</strong> (Incharge: {gb.in_process_checklist?.operator})
                                </Typography>
                              </Box>
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <Box sx={{ p: 1.5, bgcolor: '#ffffff', borderRadius: 1.5, border: '1px solid #e9d5ff' }}>
                                <Typography variant="caption" sx={{ fontWeight: 800, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                  <SecurityIcon sx={{ fontSize: 16 }} /> P4 — CCP MONITORING RECORD
                                </Typography>
                                <Typography variant="caption" sx={{ display: 'block', color: '#475569' }}>
                                  • CCP-1 Magnet: <strong>{gb.ccp_monitoring?.ccp1_magnet}</strong>
                                </Typography>
                                <Typography variant="caption" sx={{ display: 'block', color: '#475569' }}>
                                  • CCP-1 Destoner: <strong>{gb.ccp_monitoring?.ccp1_destoner}</strong>
                                </Typography>
                                <Typography variant="caption" sx={{ display: 'block', color: '#475569' }}>
                                  • CCP-2 Sifter: <strong>{gb.ccp_monitoring?.ccp2_sifter}</strong>
                                </Typography>
                              </Box>
                            </Grid>
                          </Grid>
                        </Paper>
                      ))}
                    </Stack>
                  ) : (
                    <Box sx={{ p: 2, bgcolor: '#faf5ff', borderRadius: 1.5, border: '1px dashed #c084fc' }}>
                      <Typography variant="body2" sx={{ color: '#6b21a8' }}>
                        Raw material storage lot — directly held for packaging / whole grain dispatch.
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* 4. CERTIFICATE OF ANALYSIS (COA / P6) */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%', borderTop: '4px solid #0284c7', border: '1px solid #cbd5e1', borderRadius: 2 }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ScienceIcon sx={{ color: '#0284c7' }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                        4. Certificate of Analysis (COA / P6)
                      </Typography>
                    </Box>
                    <Chip label="QA CERTIFIED" size="small" sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 700, fontSize: '10px' }} />
                  </Box>

                  {coas.length > 0 ? (
                    <Stack spacing={2}>
                      {coas.map((coa, cIdx) => (
                        <Paper key={cIdx} variant="outlined" sx={{ p: 2, bgcolor: '#f0f9ff', borderColor: '#bae6fd', borderRadius: 1.5 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Box>
                              <Typography variant="subtitle2" sx={{ fontWeight: 800, fontFamily: 'monospace', color: '#0369a1' }}>
                                {coa.record_no}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Item: <strong>{coa.item_name}</strong> | Batch: <strong>{coa.lot_no}</strong>
                              </Typography>
                            </Box>
                            <Chip label={coa.status} size="small" color="success" sx={{ fontWeight: 700, fontSize: '10px' }} />
                          </Box>

                          {coa.findings?.parameters && coa.findings.parameters.length > 0 && (
                            <TableContainer component={Paper} variant="outlined" sx={{ bgcolor: 'white', mb: 1 }}>
                              <Table size="small">
                                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                  <TableRow>
                                    <TableCell sx={{ fontWeight: 700, py: 0.5 }}>Parameter</TableCell>
                                    <TableCell sx={{ fontWeight: 700, py: 0.5 }}>Standard</TableCell>
                                    <TableCell sx={{ fontWeight: 700, py: 0.5 }}>Observed</TableCell>
                                    <TableCell sx={{ fontWeight: 700, py: 0.5 }}>Result</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {coa.findings.parameters.slice(0, 4).map((p, pIdx) => (
                                    <TableRow key={pIdx}>
                                      <TableCell sx={{ py: 0.5 }}>{p.parameter}</TableCell>
                                      <TableCell sx={{ py: 0.5 }}>{p.standard}</TableCell>
                                      <TableCell sx={{ py: 0.5, fontWeight: 600 }}>{p.observed}</TableCell>
                                      <TableCell sx={{ py: 0.5, fontWeight: 700, color: '#16a34a' }}>{p.result}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          )}

                          <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, color: '#0284c7' }}>
                            Decision: {coa.findings?.decision || 'PASSED & RELEASED FOR SALE'} (Approved By: {coa.approved_by || 'Quality Head'})
                          </Typography>
                        </Paper>
                      ))}
                    </Stack>
                  ) : (
                    <Box sx={{ p: 2, bgcolor: '#f0f9ff', borderRadius: 1.5, border: '1px dashed #7dd3fc' }}>
                      <Typography variant="body2" sx={{ color: '#0369a1' }}>
                        COA generated upon finished goods packaging clearance.
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* 5. CURRENT FACTORY GODOWN BALANCES */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%', borderTop: '4px solid #16a34a', border: '1px solid #cbd5e1', borderRadius: 2 }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <InventoryIcon sx={{ color: '#16a34a' }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                        5. Current Godown Storage Balances
                      </Typography>
                    </Box>
                    <Chip label="LIVE STOCK" size="small" sx={{ bgcolor: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: '10px' }} />
                  </Box>

                  {currentStock.length > 0 ? (
                    <TableContainer component={Paper} variant="outlined" sx={{ bgcolor: 'white' }}>
                      <Table size="small">
                        <TableHead sx={{ bgcolor: '#f8fafc' }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Godown</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Item Name</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Lot No</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Available Qty</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {currentStock.map((s, idx) => (
                            <TableRow key={idx}>
                              <TableCell sx={{ fontWeight: 700 }}>{s.godown_name || s.godown || '-'}</TableCell>
                              <TableCell>{s.item_name}</TableCell>
                              <TableCell>
                                <Chip
                                  label={s.lot_no}
                                  size="small"
                                  onClick={() => handleTrace(s.lot_no)}
                                  sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '11px', cursor: 'pointer', bgcolor: '#e0f2fe', color: '#0369a1' }}
                                />
                              </TableCell>
                              <TableCell sx={{ fontWeight: 800, color: '#16a34a' }}>
                                {s.remaining_quantity || s.available_qty || s.quantity} Bags
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Zero balance remaining in factory godowns (100% dispatched / processed).
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* 5.5 COLD STORAGE, GODOWN TRANSFER & STOCK MOVEMENT TIMELINE */}
            <Grid item xs={12}>
              <Card sx={{ borderTop: '4px solid #0f766e', border: '1px solid #cbd5e1', borderRadius: 2 }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SyncAltIcon sx={{ color: '#0f766e' }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                        5.5 Chronological Stock Movement, Cold Storage & Godown Transfer Timeline
                      </Typography>
                    </Box>
                    <Chip label={`${stockMovements.length} MOVEMENTS`} size="small" sx={{ bgcolor: '#ccfbf1', color: '#0f766e', fontWeight: 700, fontSize: '10px' }} />
                  </Box>

                  {stockMovements.length > 0 ? (
                    <TableContainer component={Paper} variant="outlined" sx={{ bgcolor: 'white' }}>
                      <Table size="small">
                        <TableHead sx={{ bgcolor: '#f8fafc' }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Module / Type</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Ref No</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Godown</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Lot No</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Dir</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Qty (Bags)</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Weight (Kg)</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Party / Remarks</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {stockMovements.map((mv, mIdx) => (
                            <TableRow key={`${mv.id || mIdx}`} hover>
                              <TableCell>{mv.movement_date || '—'}</TableCell>
                              <TableCell>
                                <Typography variant="caption" sx={{ fontWeight: 700, color: '#0f172a', display: 'block' }}>
                                  {mv.source_module || mv.movement_type}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">{mv.movement_type}</Typography>
                              </TableCell>
                              <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{mv.source_ref_no || '—'}</TableCell>
                              <TableCell>{mv.godown_name || '—'}</TableCell>
                              <TableCell>
                                {mv.lot_no ? (
                                  <Chip
                                    label={mv.lot_no}
                                    size="small"
                                    onClick={() => handleTrace(mv.lot_no)}
                                    sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '11px', cursor: 'pointer', bgcolor: '#e0f2fe', color: '#0369a1' }}
                                  />
                                ) : '—'}
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={mv.direction}
                                  size="small"
                                  color={mv.direction === 'IN' ? 'success' : 'warning'}
                                  sx={{ fontWeight: 700, fontSize: '10px' }}
                                />
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>{Number(mv.qty || 0).toLocaleString()}</TableCell>
                              <TableCell align="right">{Number(mv.weight || 0).toLocaleString()}</TableCell>
                              <TableCell>
                                <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>{mv.party_name || '—'}</Typography>
                                {mv.remarks && <Typography variant="caption" color="text.secondary">{mv.remarks}</Typography>}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No movement ledger entries recorded for this lot family.
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* 6. FORWARD TRACE: SALES & CUSTOMER DISPATCHES */}
            <Grid item xs={12}>
              <Card sx={{ borderTop: '4px solid #ea580c', border: '1px solid #cbd5e1', borderRadius: 2 }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LocalShippingIcon sx={{ color: '#ea580c' }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                        6. Forward Trace: Sales, Customer Dispatches & Terminal Inspection (P7)
                      </Typography>
                    </Box>
                    <Chip label="FORWARD TRACE" size="small" sx={{ bgcolor: '#ffedd5', color: '#c2410c', fontWeight: 700, fontSize: '10px' }} />
                  </Box>

                  {dispatches.length > 0 ? (
                    <TableContainer component={Paper} variant="outlined" sx={{ bgcolor: 'white' }}>
                      <Table size="small">
                        <TableHead sx={{ bgcolor: '#f8fafc' }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Customer Name</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Invoice No</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Dispatch Date</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Item & Lot</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Sold Qty (Bags)</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Weight (Kg)</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Terminal QA (P7)</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {dispatches.map((d, idx) => (
                            <TableRow key={idx}>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>{d.customer_name || '—'}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {[d.customer_city, d.customer_phone ? `Ph: ${d.customer_phone}` : ''].filter(Boolean).join(' • ') || '—'}
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#ea580c' }}>{d.invoice_no || '—'}</TableCell>
                              <TableCell>{d.date || '—'}</TableCell>
                              <TableCell>
                                <div>{d.item_name}</div>
                                <Chip
                                  label={d.lot_no}
                                  size="small"
                                  onClick={() => handleTrace(d.lot_no)}
                                  sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '11px', cursor: 'pointer', bgcolor: '#fef3c7', color: '#92400e' }}
                                />
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>{d.sold_qty || 0} Bags</TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#ea580c' }}>
                                {d.sold_weight_kg ? `${Number(d.sold_weight_kg).toLocaleString()} Kg` : '—'}
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={d.terminal_inspection?.record_no ? `${d.terminal_inspection.record_no} (${d.terminal_inspection.bag_integrity})` : (d.terminal_inspection?.status || 'Dispatched')}
                                  size="small"
                                  color={d.terminal_inspection?.record_no ? 'success' : 'default'}
                                  sx={{ fontWeight: 600, fontSize: '11px' }}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Box sx={{ p: 2, bgcolor: '#fffbeb', borderRadius: 1.5, border: '1px dashed #fcd34d' }}>
                      <Typography variant="body2" sx={{ color: '#b45309' }}>
                        No forward customer dispatches recorded yet for this specific lot.
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

          </Grid>
        </Box>
      ) : null}
    </Box>
  );
}
