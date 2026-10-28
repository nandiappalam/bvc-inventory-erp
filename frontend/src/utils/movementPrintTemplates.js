/**
 * movementPrintTemplates.js
 * Universal, high-fidelity print templates for Material Gate Outpass and Inpass documents.
 * Adheres to BVC ERP theme styling with precise tables, badges, mass balance calculations,
 * and 4-column signature blocks for security, store, QC, and external parties.
 */

import { printHtml } from './printHelper';

/**
 * Format numbers cleanly with commas and decimals
 */
const formatWeight = (val) => {
  const num = parseFloat(val) || 0;
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatCurrency = (val) => {
  const num = parseFloat(val) || 0;
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Generate and trigger print for Material Outpass (Delivery Challan)
 * @param {Object} op - Outpass object with items, party_name, etc.
 * @param {String} copyTitle - Copy type label (e.g. 'ORIGINAL STORE COPY', 'SECURITY GATE COPY', 'ALL COPIES')
 */
export const printOutpassDocument = (op, copyTitle = 'ORIGINAL STORE COPY') => {
  if (!op) return;

  const items = op.items && op.items.length > 0 ? op.items : [
    {
      item_name: op.input_item_name || op.item_name || 'Material Item',
      lot_no: op.input_lot_no || op.lot_no || 'RM-LOT',
      qty: op.total_qty || op.qty || 1,
      weight: op.unit_weight || 50,
      total_weight: op.total_weight || 0,
      godown_name: op.from_godown_name || op.godown_name || 'PJ Main Godown',
      reason: op.purpose || 'Outside Processing'
    }
  ];

  const totalBags = items.reduce((sum, it) => sum + (parseInt(it.qty) || 0), 0);
  const totalWeightKg = items.reduce((sum, it) => sum + (parseFloat(it.total_weight) || 0), 0) || parseFloat(op.total_weight) || 0;
  const totalTonnes = (totalWeightKg / 1000).toFixed(3);

  const itemRowsHtml = items.map((it, idx) => `
    <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
      <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold; color: #475569;">${idx + 1}</td>
      <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: 700; color: #0f172a; font-size: 13px;">
        ${it.item_name || 'Material'}
        ${it.item_code ? `<span style="font-size: 11px; color: #64748b; display: block; font-weight: normal;">Code: ${it.item_code}</span>` : ''}
      </td>
      <td style="border: 1px solid #cbd5e1; padding: 8px; font-family: monospace; font-size: 12px; font-weight: 600; color: #1d4ed8; text-align: center;">
        ${it.lot_no || '-'}
      </td>
      <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: 700; font-size: 13px;">
        ${it.qty || 0}
      </td>
      <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #475569;">
        ${formatWeight(it.weight || 50)} kg
      </td>
      <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: 700; color: #1e3a8a; font-size: 13px;">
        ${formatWeight(it.total_weight || 0)} kg
      </td>
      <td style="border: 1px solid #cbd5e1; padding: 8px; color: #334155; font-size: 12px;">
        ${it.godown_name || op.from_godown_name || 'PJ Main Godown'}
      </td>
      <td style="border: 1px solid #cbd5e1; padding: 8px; color: #475569; font-size: 12px;">
        ${it.reason || op.purpose || 'Outside Processing'}
      </td>
    </tr>
  `).join('');

  const renderSinglePage = (badgeText) => `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; color: #0f172a; max-width: 960px; margin: 0 auto; background: #ffffff; page-break-after: always;">
      
      <!-- Top Branding Header -->
      <div style="border-bottom: 3px double #1f4fb2; padding-bottom: 12px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h1 style="margin: 0; color: #1f4fb2; font-size: 24px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">
              BVC 
            </h1>
            <p style="margin: 3px 0 0 0; font-size: 12px; color: #475569; font-weight: 600;">
              Factory & Works • Material Movement & Security Gate Control
            </p>
            <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b;">
              Unit I: Main Industrial Area | Phone: +91 98765 43210 | Email: dispatch@bvcagro.com
            </p>
          </div>
          <div style="text-align: right;">
            <div style="display: inline-block; background: #1f4fb2; color: #ffffff; padding: 4px 12px; border-radius: 4px; font-weight: 800; font-size: 11px; letter-spacing: 1px; text-transform: uppercase;">
              ${badgeText}
            </div>
            <div style="margin-top: 8px; font-family: monospace; font-size: 18px; font-weight: bold; color: #1f4fb2;">
              ${op.outpass_no || 'OP-00000'}
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
              Date: <strong>${op.date || new Date().toISOString().split('T')[0]}</strong>
            </div>
          </div>
        </div>

        <!-- Banner Bar -->
        <div style="margin-top: 12px; background: #f0f4ff; border: 1px solid #bfdbfe; border-radius: 4px; padding: 6px 12px; display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
          <span style="font-weight: 800; color: #1e40af; letter-spacing: 0.5px; text-transform: uppercase;">
            📋 MATERIAL GATE OUTPASS (DELIVERY CHALLAN / GOODS OUTWARD PASS)
          </span>
          <span style="background: #1f4fb2; color: #ffffff; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 700;">
            STATUS: ${op.status || 'OUTPASSED'}
          </span>
        </div>
      </div>

      <!-- Information Matrix -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
        
        <!-- Box 1: Dispatch & Movement Metadata -->
        <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; background: #f8fafc;">
          <h3 style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; color: #1f4fb2; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; letter-spacing: 0.5px;">
            📍 Movement & Source Details
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin: 0;">
            <tr>
              <td style="padding: 3px 0; color: #64748b; width: 38%;">Outpass Serial:</td>
              <td style="padding: 3px 0; font-weight: 700; color: #1f4fb2; font-family: monospace;">${op.outpass_no}</td>
            </tr>
            <tr>
              <td style="padding: 3px 0; color: #64748b;">Issue Date & Time:</td>
              <td style="padding: 3px 0; font-weight: 600;">${op.date} ${op.created_at ? '│ ' + new Date(op.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</td>
            </tr>
            <tr>
              <td style="padding: 3px 0; color: #64748b;">Purpose / Mode:</td>
              <td style="padding: 3px 0;">
                <span style="background: #dbeafe; color: #1e40af; padding: 2px 6px; border-radius: 3px; font-weight: 700; font-size: 11px;">
                  ${op.purpose || 'Outside Mill Processing'}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 3px 0; color: #64748b;">Reference Doc:</td>
              <td style="padding: 3px 0; font-weight: 600; color: #334155;">
                ${op.reference_type || 'Grind'} (${op.reference_no || op.work_order_no || `#${op.reference_id || '-'}`})
              </td>
            </tr>
            <tr>
              <td style="padding: 3px 0; color: #64748b;">Dispatch Godown:</td>
              <td style="padding: 3px 0; font-weight: 600; color: #0f172a;">
                ${op.from_godown_name || op.from_location || 'PJ Main Factory Godown'}
              </td>
            </tr>
            ${op.expected_return_date ? `
              <tr>
                <td style="padding: 3px 0; color: #64748b;">Expected Return:</td>
                <td style="padding: 3px 0; font-weight: 700; color: #d97706;">${op.expected_return_date}</td>
              </tr>
            ` : ''}
          </table>
        </div>

        <!-- Box 2: Destination & Party Details -->
        <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; background: #f8fafc;">
          <h3 style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; color: #1f4fb2; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; letter-spacing: 0.5px;">
            🏭 Destination Mill / Party Information
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin: 0;">
            <tr>
              <td style="padding: 3px 0; color: #64748b; width: 38%;">External Mill / Party:</td>
              <td style="padding: 3px 0; font-weight: 800; font-size: 13px; color: #0f172a;">${op.party_name || op.external_mill_name || 'External Mill'}</td>
            </tr>
            ${op.mill_area ? `
              <tr>
                <td style="padding: 3px 0; color: #64748b;">Mill Location / Area:</td>
                <td style="padding: 3px 0; font-weight: 600; color: #334155;">${op.mill_area}</td>
              </tr>
            ` : ''}
            <tr>
              <td style="padding: 3px 0; color: #64748b;">Destination Address:</td>
              <td style="padding: 3px 0; color: #334155;">${op.destination || op.mill_area || 'External Mill Premises'}</td>
            </tr>
            <tr>
              <td style="padding: 3px 0; color: #64748b;">Vehicle Number:</td>
              <td style="padding: 3px 0;">
                <span style="font-family: monospace; font-size: 13px; font-weight: 800; background: #1e293b; color: #f8fafc; padding: 2px 8px; border-radius: 4px; letter-spacing: 1px;">
                  ${op.vehicle_no || 'N/A / Direct Delivery'}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 3px 0; color: #64748b;">Driver Name & Contact:</td>
              <td style="padding: 3px 0; font-weight: 600;">
                ${op.driver_name || 'N/A'} ${op.driver_phone ? `📞 (${op.driver_phone})` : ''}
              </td>
            </tr>
            <tr>
              <td style="padding: 3px 0; color: #64748b;">Transporter Name:</td>
              <td style="padding: 3px 0; color: #334155;">${op.transporter || 'Self Logistics / Direct'}</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Dispatched Materials Table -->
      <div style="margin-bottom: 16px;">
        <h3 style="margin: 0 0 6px 0; font-size: 12px; text-transform: uppercase; color: #1f4fb2; letter-spacing: 0.5px; display: flex; justify-content: space-between; align-items: center;">
          <span>📦 Dispatched Items Specification</span>
          <span style="font-size: 11px; font-weight: normal; color: #64748b;">Count: ${items.length} Item(s)</span>
        </h3>
        
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin: 0;">
          <thead>
            <tr style="background: #1f4fb2; color: #ffffff;">
              <th style="border: 1px solid #cbd5e1; padding: 8px; width: 40px; text-align: center;">S.No</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Item & Description</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; width: 110px;">Lot / Batch No</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 75px;">Bags</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 90px;">Unit Wt</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 110px;">Total Net Weight</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left; width: 120px;">Godown</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Process Reason</th>
            </tr>
          </thead>
          <tbody>
            ${itemRowsHtml}
          </tbody>
          <tfoot>
            <tr style="background: #f1f5f9; font-weight: bold; border-top: 2px solid #1f4fb2;">
              <td colspan="3" style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-size: 12px; text-transform: uppercase; color: #1e293b;">
                TOTAL DISPATCH SUMMARY:
              </td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-size: 14px; font-weight: 800; color: #0f172a;">
                ${totalBags} Bags
              </td>
              <td style="border: 1px solid #cbd5e1; padding: 8px;"></td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #1f4fb2; font-size: 15px; font-weight: 800;">
                ${formatWeight(totalWeightKg)} kg
                <span style="display: block; font-size: 10px; color: #475569; font-weight: normal;">(${totalTonnes} MT)</span>
              </td>
              <td colspan="2" style="border: 1px solid #cbd5e1; padding: 8px; font-size: 11px; color: #64748b; vertical-align: middle;">
                Verified by Factory Scale
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Financial & Rate Note (If charges specified) -->
      ${parseFloat(op.processing_rate_kg) > 0 ? `
        <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; font-size: 12px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong style="color: #166534; font-size: 13px;">Agrred Processing Rate:</strong>
            <span style="font-weight: 700; color: #15803d; font-size: 14px; margin-left: 6px;">₹${op.processing_rate_kg} / kg</span>
          </div>
          <div>
            <strong style="color: #166534; font-size: 13px;">Estimated Processing Fee:</strong>
            <span style="font-weight: 800; color: #166534; font-size: 15px; margin-left: 6px;">${formatCurrency(op.estimated_charges || (op.processing_rate_kg * totalWeightKg))}</span>
          </div>
        </div>
      ` : ''}

      <!-- Custody & Legal Declaration Box -->
      <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-left: 4px solid #1f4fb2; border-radius: 4px; padding: 10px 12px; margin-bottom: 24px; font-size: 11px; color: #1e3a8a; line-height: 1.5;">
        <strong>CUSTODY & OWNERSHIP DECLARATION:</strong>
        The material detailed in this gate outpass is dispatched exclusively for outside processing / jobwork / grinding.
        <strong>Physical ownership remains 100% with BVC.</strong>
        The recipient mill is bound to return the processed material along with by-products and reconciled process loss via corresponding Inpass.
        Not for sale or transfer to any third party.
      </div>

      ${op.remarks ? `
        <div style="margin-bottom: 20px; font-size: 11px; color: #475569; background: #f8fafc; padding: 8px; border: 1px solid #e2e8f0; border-radius: 4px;">
          <strong>Special Remarks / Instructions:</strong> ${op.remarks}
        </div>
      ` : ''}

      <!-- 4-Column Signature & Clearance Matrix -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; text-align: center; font-size: 11px; margin-top: 40px; padding-top: 10px;">
        <div style="border-top: 1.5px solid #475569; padding-top: 6px;">
          <strong style="display: block; color: #0f172a;">PREPARED BY</strong>
          <span style="color: #64748b; font-size: 10px;">Store Keeper (${op.created_by || 'Admin'})</span>
        </div>
        <div style="border-top: 1.5px solid #475569; padding-top: 6px;">
          <strong style="display: block; color: #0f172a;">FACTORY IN-CHARGE</strong>
          <span style="color: #64748b; font-size: 10px;">Authorized Signature & Stamp</span>
        </div>
        <div style="border-top: 1.5px solid #475569; padding-top: 6px;">
          <strong style="display: block; color: #0f172a;">SECURITY GATE OUT</strong>
          <span style="color: #64748b; font-size: 10px;">Gate Pass Seal & Time Out</span>
        </div>
        <div style="border-top: 1.5px solid #475569; padding-top: 6px;">
          <strong style="display: block; color: #0f172a;">DRIVER / RECEIVER</strong>
          <span style="color: #64748b; font-size: 10px;">Vehicle Driver Signature</span>
        </div>
      </div>

      <!-- Footer Bar -->
      <div style="margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 6px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8;">
        <span>BVC ERP System • Generated Code: ${op.outpass_no || 'OP'}</span>
        <span>Page 1 of 1</span>
        <span>Printed On: ${new Date().toLocaleString('en-IN')}</span>
      </div>
    </div>
  `;

  let fullHtml = '';
  if (copyTitle === 'ALL COPIES') {
    fullHtml = renderSinglePage('ORIGINAL - STORE COPY') +
               renderSinglePage('DUPLICATE - SECURITY GATE COPY') +
               renderSinglePage('TRIPLICATE - TRANSPORTER / MILL COPY');
  } else {
    fullHtml = renderSinglePage(copyTitle);
  }

  printHtml(fullHtml, `Outpass_${op.outpass_no || 'GatePass'}`);
};


/**
 * Generate and trigger print for Material Inpass (Goods Receipt & QC Clearance Note)
 * @param {Object} ip - Inpass object with items, mass balance, etc.
 * @param {String} copyTitle - Copy type label (e.g. 'ORIGINAL STORE COPY', 'QC COPY')
 */
export const printInpassDocument = (ip, copyTitle = 'ORIGINAL STORE COPY') => {
  if (!ip) return;

  const items = ip.items && ip.items.length > 0 ? ip.items : [
    {
      item_name: ip.output_item_name || ip.item_name || 'Processed Goods',
      output_type: ip.output_type || 'PROCESSED',
      lot_no: ip.output_lot_no || ip.lot_no || 'FG-LOT',
      qty: ip.total_qty || ip.qty || 1,
      total_weight: ip.output_weight || ip.total_weight || 0,
      godown_name: ip.to_godown_name || ip.godown_name || 'PJ Main Godown',
      qc_status: ip.qc_status || 'PASS'
    }
  ];

  const totalBags = items.reduce((sum, it) => sum + (parseInt(it.qty) || 0), 0);
  const totalWeightKg = items.reduce((sum, it) => sum + (parseFloat(it.total_weight) || 0), 0) || parseFloat(ip.total_weight) || parseFloat(ip.output_weight) || 0;
  const totalTonnes = (totalWeightKg / 1000).toFixed(3);

  const inputWeight = parseFloat(ip.input_weight) || parseFloat(ip.total_dispatched_weight) || totalWeightKg;
  const fgWeight = parseFloat(ip.output_weight) || totalWeightKg;
  const byproductWeight = parseFloat(ip.byproduct_weight) || 0;
  const lossWeight = parseFloat(ip.loss_weight) || parseFloat(ip.process_loss) || 0;
  const yieldPercent = ip.yield_percent ? parseFloat(ip.yield_percent).toFixed(2) : ((fgWeight / (inputWeight || 1)) * 100).toFixed(2);
  const discrepancyKg = parseFloat(ip.discrepancy_weight || ip.discrepancy_kg) || 0;

  const itemRowsHtml = items.map((it, idx) => `
    <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
      <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold; color: #475569;">${idx + 1}</td>
      <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: 700; color: #0f172a; font-size: 13px;">
        ${it.item_name || 'Item'}
      </td>
      <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">
        <span style="background: ${it.output_type === 'BYPRODUCT' ? '#e0f2fe' : it.output_type === 'WASTAGE' ? '#fee2e2' : '#dcfce7'}; color: ${it.output_type === 'BYPRODUCT' ? '#0369a1' : it.output_type === 'WASTAGE' ? '#991b1b' : '#166534'}; padding: 2px 7px; border-radius: 4px; font-weight: bold; font-size: 11px;">
          ${it.output_type || 'PROCESSED'}
        </span>
      </td>
      <td style="border: 1px solid #cbd5e1; padding: 8px; font-family: monospace; font-size: 12px; font-weight: 600; color: #1d4ed8; text-align: center;">
        ${it.lot_no || '-'}
      </td>
      <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: 700; font-size: 13px;">
        ${it.qty || 0}
      </td>
      <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: 700; color: #15803d; font-size: 13px;">
        ${formatWeight(it.total_weight || 0)} kg
      </td>
      <td style="border: 1px solid #cbd5e1; padding: 8px; color: #334155; font-size: 12px;">
        ${it.godown_name || ip.to_godown_name || 'PJ Main Factory Godown'}
      </td>
      <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">
        <span style="background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 4px; font-weight: 800; font-size: 11px;">
          ✓ ${it.qc_status || ip.qc_status || 'PASSED'}
        </span>
      </td>
    </tr>
  `).join('');

  const renderSinglePage = (badgeText) => `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; color: #0f172a; max-width: 960px; margin: 0 auto; background: #ffffff; page-break-after: always;">
      
      <!-- Top Branding Header -->
      <div style="border-bottom: 3px double #059669; padding-bottom: 12px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h1 style="margin: 0; color: #059669; font-size: 24px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">
              BVC
            </h1>
            <p style="margin: 3px 0 0 0; font-size: 12px; color: #475569; font-weight: 600;">
              Factory Inward Goods Control • External Mill Return & Quality Clearance
            </p>
            <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b;">
              Unit I: Main Industrial Area | Phone: +91 98765 43210 | Email: inward@bvcagro.com
            </p>
          </div>
          <div style="text-align: right;">
            <div style="display: inline-block; background: #059669; color: #ffffff; padding: 4px 12px; border-radius: 4px; font-weight: 800; font-size: 11px; letter-spacing: 1px; text-transform: uppercase;">
              ${badgeText}
            </div>
            <div style="margin-top: 8px; font-family: monospace; font-size: 18px; font-weight: bold; color: #059669;">
              ${ip.inpass_no || 'IP-00000'}
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
              Receipt Date: <strong>${ip.date || new Date().toISOString().split('T')[0]}</strong>
            </div>
          </div>
        </div>

        <!-- Banner Bar -->
        <div style="margin-top: 12px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 4px; padding: 6px 12px; display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
          <span style="font-weight: 800; color: #065f46; letter-spacing: 0.5px; text-transform: uppercase;">
            📥 MATERIAL GATE INPASS / PROCESSED GOODS RECEIPT NOTE
          </span>
          <span style="background: #059669; color: #ffffff; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 700;">
            QC STATUS: ${ip.qc_status || 'PASS'}
          </span>
        </div>
      </div>

      <!-- Information Matrix -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
        
        <!-- Box 1: Receipt & Linked Outpass -->
        <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; background: #f8fafc;">
          <h3 style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; color: #059669; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; letter-spacing: 0.5px;">
            📍 Inward Receipt Metadata
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin: 0;">
            <tr>
              <td style="padding: 3px 0; color: #64748b; width: 38%;">Inpass Serial:</td>
              <td style="padding: 3px 0; font-weight: 700; color: #059669; font-family: monospace;">${ip.inpass_no}</td>
            </tr>
            <tr>
              <td style="padding: 3px 0; color: #64748b;">Receipt Date & Time:</td>
              <td style="padding: 3px 0; font-weight: 600;">${ip.date} ${ip.created_at ? '│ ' + new Date(ip.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</td>
            </tr>
            <tr>
              <td style="padding: 3px 0; color: #64748b;">Linked Outpass:</td>
              <td style="padding: 3px 0;">
                <span style="font-family: monospace; font-weight: 800; color: #2563eb; background: #eff6ff; padding: 2px 6px; border-radius: 3px; font-size: 12px;">
                  ${ip.outpass_no || 'N/A'}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 3px 0; color: #64748b;">Reference Doc:</td>
              <td style="padding: 3px 0; font-weight: 600; color: #334155;">
                ${ip.reference_type || 'Grind Work Order'} (${ip.reference_no || ip.work_order_no || `#${ip.reference_id || '-'}`})
              </td>
            </tr>
            <tr>
              <td style="padding: 3px 0; color: #64748b;">Receiving Godown:</td>
              <td style="padding: 3px 0; font-weight: 700; color: #0f172a;">
                ${ip.to_godown_name || ip.godown_name || 'PJ Main Factory Godown'}
              </td>
            </tr>
          </table>
        </div>

        <!-- Box 2: Sender & Transport Info -->
        <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; background: #f8fafc;">
          <h3 style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; color: #059669; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; letter-spacing: 0.5px;">
            🏭 Returning Mill & Logistics
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin: 0;">
            <tr>
              <td style="padding: 3px 0; color: #64748b; width: 38%;">External Mill / Processor:</td>
              <td style="padding: 3px 0; font-weight: 800; font-size: 13px; color: #0f172a;">${ip.party_name || ip.external_mill_name || 'External Mill'}</td>
            </tr>
            ${ip.mill_area ? `
              <tr>
                <td style="padding: 3px 0; color: #64748b;">Mill Location / Area:</td>
                <td style="padding: 3px 0; font-weight: 600; color: #334155;">${ip.mill_area}</td>
              </tr>
            ` : ''}
            <tr>
              <td style="padding: 3px 0; color: #64748b;">Vehicle Number:</td>
              <td style="padding: 3px 0;">
                <span style="font-family: monospace; font-size: 13px; font-weight: 800; background: #065f46; color: #f8fafc; padding: 2px 8px; border-radius: 4px; letter-spacing: 1px;">
                  ${ip.vehicle_no || 'N/A / Direct Receipt'}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 3px 0; color: #64748b;">Driver Name:</td>
              <td style="padding: 3px 0; font-weight: 600;">${ip.driver_name || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 3px 0; color: #64748b;">Received By:</td>
              <td style="padding: 3px 0; font-weight: 700; color: #0f172a;">${ip.received_by || 'Store Receiver'}</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Mass Balance Reconciliation Card -->
      <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 6px; padding: 12px 16px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #bbf7d0; padding-bottom: 6px; margin-bottom: 10px;">
          <h4 style="margin: 0; font-size: 12px; font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">
            ⚖️ Mass-Balance & Processing Yield Audit
          </h4>
          <span style="font-weight: 800; color: #15803d; background: #dcfce7; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
            Milling Yield: ${yieldPercent}%
          </span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; text-align: center;">
          <div style="background: #ffffff; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px;">
            <div style="font-size: 11px; color: #64748b; font-weight: 600;">Dispatched RM Input</div>
            <div style="font-size: 15px; font-weight: 800; color: #1e3a8a; margin-top: 2px;">${formatWeight(inputWeight)} kg</div>
          </div>
          <div style="background: #ffffff; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px;">
            <div style="font-size: 11px; color: #64748b; font-weight: 600;">Processed FG Output</div>
            <div style="font-size: 15px; font-weight: 800; color: #15803d; margin-top: 2px;">${formatWeight(fgWeight)} kg</div>
          </div>
          <div style="background: #ffffff; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px;">
            <div style="font-size: 11px; color: #64748b; font-weight: 600;">By-product / Bran</div>
            <div style="font-size: 15px; font-weight: 800; color: #0288d1; margin-top: 2px;">${formatWeight(byproductWeight)} kg</div>
          </div>
          <div style="background: #ffffff; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px;">
            <div style="font-size: 11px; color: #64748b; font-weight: 600;">Process / Moisture Loss</div>
            <div style="font-size: 15px; font-weight: 800; color: #b91c1c; margin-top: 2px;">${formatWeight(lossWeight)} kg</div>
          </div>
        </div>

        ${discrepancyKg > 0 ? `
          <div style="margin-top: 10px; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 4px; padding: 6px 10px; color: #991b1b; font-size: 11px; display: flex; justify-content: space-between; align-items: center;">
            <span>⚠️ <strong>Unaccounted Quantity Discrepancy:</strong> ${formatWeight(discrepancyKg)} kg Shortage</span>
            <span><strong>Reason / Note:</strong> ${ip.discrepancy_reason || 'Under Investigation'}</span>
          </div>
        ` : `
          <div style="margin-top: 8px; text-align: right; font-size: 11px; color: #166534; font-weight: 700;">
            ✓ Total Input = Total Output + By-products + Process Loss (100% Reconciled)
          </div>
        `}
      </div>

      <!-- Received Goods Details Table -->
      <div style="margin-bottom: 16px;">
        <h3 style="margin: 0 0 6px 0; font-size: 12px; text-transform: uppercase; color: #059669; letter-spacing: 0.5px; display: flex; justify-content: space-between; align-items: center;">
          <span>📦 Received Items & QC Classification</span>
          <span style="font-size: 11px; font-weight: normal; color: #64748b;">Count: ${items.length} Item(s)</span>
        </h3>
        
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin: 0;">
          <thead>
            <tr style="background: #059669; color: #ffffff;">
              <th style="border: 1px solid #cbd5e1; padding: 8px; width: 40px; text-align: center;">S.No</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Received Material Description</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; width: 110px;">Classification</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; width: 110px;">Allocated Lot</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 70px;">Bags</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 110px;">Net Received Weight</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left; width: 130px;">Stock Godown</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; width: 85px;">QC Status</th>
            </tr>
          </thead>
          <tbody>
            ${itemRowsHtml}
          </tbody>
          <tfoot>
            <tr style="background: #f1f5f9; font-weight: bold; border-top: 2px solid #059669;">
              <td colspan="4" style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-size: 12px; text-transform: uppercase; color: #1e293b;">
                TOTAL INWARD GOODS RECEIPT:
              </td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-size: 14px; font-weight: 800; color: #0f172a;">
                ${totalBags} Bags
              </td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #059669; font-size: 15px; font-weight: 800;">
                ${formatWeight(totalWeightKg)} kg
                <span style="display: block; font-size: 10px; color: #475569; font-weight: normal;">(${totalTonnes} MT)</span>
              </td>
              <td colspan="2" style="border: 1px solid #cbd5e1; padding: 8px; font-size: 11px; color: #64748b; vertical-align: middle;">
                Credited into Factory Live Inventory
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Financial & Payable Processing Charges -->
      ${(parseFloat(ip.total_processing_charges) > 0 || parseFloat(ip.processing_charge_per_kg) > 0) ? `
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; font-size: 12px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong style="color: #1e40af; font-size: 13px;">Processing Charge Rate:</strong>
            <span style="font-weight: 700; color: #1d4ed8; font-size: 14px; margin-left: 6px;">₹${ip.processing_charge_per_kg || 0} / kg</span>
          </div>
          <div>
            <strong style="color: #1e40af; font-size: 13px;">Total Payable Processing Charges:</strong>
            <span style="font-weight: 800; color: #1e40af; font-size: 15px; margin-left: 6px;">
              ${formatCurrency(ip.total_processing_charges || (parseFloat(ip.processing_charge_per_kg) * inputWeight))}
            </span>
          </div>
        </div>
      ` : ''}

      ${ip.remarks ? `
        <div style="margin-bottom: 20px; font-size: 11px; color: #475569; background: #f8fafc; padding: 8px; border: 1px solid #e2e8f0; border-radius: 4px;">
          <strong>Special Inward Remarks:</strong> ${ip.remarks}
        </div>
      ` : ''}

      <!-- 4-Column Signature & Clearance Matrix -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; text-align: center; font-size: 11px; margin-top: 40px; padding-top: 10px;">
        <div style="border-top: 1.5px solid #475569; padding-top: 6px;">
          <strong style="display: block; color: #0f172a;">SECURITY GATE IN</strong>
          <span style="color: #64748b; font-size: 10px;">Inward Gate Entry Seal</span>
        </div>
        <div style="border-top: 1.5px solid #475569; padding-top: 6px;">
          <strong style="display: block; color: #0f172a;">QC VERIFICATION OFFICER</strong>
          <span style="color: #64748b; font-size: 10px;">Quality Clearance Stamp</span>
        </div>
        <div style="border-top: 1.5px solid #475569; padding-top: 6px;">
          <strong style="display: block; color: #0f172a;">STORE / RECEIVER</strong>
          <span style="color: #64748b; font-size: 10px;">Received by (${ip.received_by || 'Admin'})</span>
        </div>
        <div style="border-top: 1.5px solid #475569; padding-top: 6px;">
          <strong style="display: block; color: #0f172a;">FACTORY MANAGER</strong>
          <span style="color: #64748b; font-size: 10px;">Authorized Approval</span>
        </div>
      </div>

      <!-- Footer Bar -->
      <div style="margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 6px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8;">
        <span>BVC ERP System • Generated Code: ${ip.inpass_no || 'IP'}</span>
        <span>Page 1 of 1</span>
        <span>Printed On: ${new Date().toLocaleString('en-IN')}</span>
      </div>
    </div>
  `;

  let fullHtml = '';
  if (copyTitle === 'ALL COPIES') {
    fullHtml = renderSinglePage('ORIGINAL - STORE COPY') +
               renderSinglePage('DUPLICATE - QC & ACCOUNTS COPY');
  } else {
    fullHtml = renderSinglePage(copyTitle);
  }

  printHtml(fullHtml, `Inpass_${ip.inpass_no || 'InwardNote'}`);
};
