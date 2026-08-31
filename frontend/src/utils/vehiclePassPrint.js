/**
 * vehiclePassPrint.js - Professional Vehicle In-Pass & Out-Pass Print Generators
 * Generates high-standard ERP gate pass documents compatible with printHtml.
 */

export function generateVehicleInPassHtml(row = {}, company = {}) {
  const companyName = company?.name || company?.print_name || 'BVC EXPORTS PRIVATE LIMITED';
  const companyAddress = company?.address || company?.address1 || 'Factory & Processing Plant, Industrial Area, Tamil Nadu';
  const companyGst = company?.gst_number || company?.gst_no || '33AAAAA0000A1Z5';
  const companyPhone = company?.phone_off || company?.mobile1 || company?.phone || '+91 98765 43210';

  const passNo = `INP-${String(row.s_no || row.id || '001').padStart(4, '0')}`;
  const passDate = row.date || row.invoice_date || new Date().toISOString().slice(0, 10);
  const currentTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const vehicleNo = row.vehicle_no || row.lorry_no || '—';
  const transporter = row.transporter || row.transport || 'Direct / Own Vehicle';
  const driverName = row.driver_name || row.driver || '—';
  const supplierName = row.supplier_name || row.supplier || '—';
  const supplierAddress = row.address || '—';
  const invNo = row.inv_no || row.invoice_no || '—';
  const poNo = row.po_no || (row.purchase_order_id ? `PO-${row.purchase_order_id}` : 'Direct Purchase');
  const itemName = row.item_name || '—';
  const lotNo = row.lot_no || '—';
  const qty = row.qty || row.weight || '—';
  const unitWt = row.weight || row.per_unit_wt || '—';
  const totalWeight = row.total_weight || row.total_wt || '—';
  const godown = row.godown || row.godown_name || 'Main Godown';

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; line-height: 1.4; max-width: 850px; margin: 0 auto; padding: 10px;">
      
      <!-- HEADER -->
      <div style="border-bottom: 2px solid #0f766e; padding-bottom: 12px; margin-bottom: 16px; text-align: center; position: relative;">
        <div style="font-size: 20px; font-weight: 800; color: #0f766e; letter-spacing: 0.5px; text-transform: uppercase;">
          ${companyName}
        </div>
        <div style="font-size: 12px; color: #475569; margin-top: 2px;">
          ${companyAddress} | Ph: ${companyPhone}
        </div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px; font-weight: 600;">
          GSTIN: ${companyGst}
        </div>
        <div style="margin-top: 10px; display: inline-block; background: #0f766e; color: #ffffff; padding: 4px 18px; border-radius: 4px; font-weight: 700; font-size: 13px; letter-spacing: 1px; text-transform: uppercase;">
          VEHICLE INWARD PASS / GATE IN-PASS
        </div>
      </div>

      <!-- PASS META BAR -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 12px;">
        <tr>
          <td style="padding: 8px 12px; width: 25%;"><strong>Gate Pass No:</strong> <span style="color: #0f766e; font-weight: bold; font-size: 13px;">${passNo}</span></td>
          <td style="padding: 8px 12px; width: 25%;"><strong>Inward Date:</strong> ${passDate}</td>
          <td style="padding: 8px 12px; width: 25%;"><strong>Inward Time:</strong> ${currentTime}</td>
          <td style="padding: 8px 12px; width: 25%;"><strong>Gate No:</strong> Gate #1 (Main Inward)</td>
        </tr>
      </table>

      <!-- 2-COLUMN SECTION: VEHICLE & SUPPLIER -->
      <div style="display: flex; gap: 14px; margin-bottom: 14px;">
        
        <!-- VEHICLE & DRIVER BOX -->
        <div style="flex: 1; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden;">
          <div style="background: #e2e8f0; padding: 6px 10px; font-size: 12px; font-weight: 700; color: #334155; border-bottom: 1px solid #cbd5e1;">
            🚚 VEHICLE & TRANSPORTER DETAILS
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <tr>
              <td style="padding: 6px 10px; border-bottom: 1px solid #f1f5f9; width: 40%; color: #64748b; font-weight: 600;">Vehicle / Lorry No</td>
              <td style="padding: 6px 10px; border-bottom: 1px solid #f1f5f9; font-weight: 700; color: #0f172a; font-size: 13px;">${vehicleNo}</td>
            </tr>
            <tr>
              <td style="padding: 6px 10px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-weight: 600;">Driver Name</td>
              <td style="padding: 6px 10px; border-bottom: 1px solid #f1f5f9; font-weight: 600;">${driverName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 10px; color: #64748b; font-weight: 600;">Transporter</td>
              <td style="padding: 6px 10px; font-weight: 600;">${transporter}</td>
            </tr>
          </table>
        </div>

        <!-- SUPPLIER & PO BOX -->
        <div style="flex: 1; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden;">
          <div style="background: #e2e8f0; padding: 6px 10px; font-size: 12px; font-weight: 700; color: #334155; border-bottom: 1px solid #cbd5e1;">
            🏢 SUPPLIER & INVOICE REFERENCE
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <tr>
              <td style="padding: 6px 10px; border-bottom: 1px solid #f1f5f9; width: 40%; color: #64748b; font-weight: 600;">Supplier Name</td>
              <td style="padding: 6px 10px; border-bottom: 1px solid #f1f5f9; font-weight: 700; color: #0f172a;">${supplierName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 10px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-weight: 600;">Supplier Invoice No</td>
              <td style="padding: 6px 10px; border-bottom: 1px solid #f1f5f9; font-weight: 600;">${invNo}</td>
            </tr>
            <tr>
              <td style="padding: 6px 10px; color: #64748b; font-weight: 600;">P.O. Reference</td>
              <td style="padding: 6px 10px; font-weight: 600;">${poNo}</td>
            </tr>
          </table>
        </div>

      </div>

      <!-- MATERIAL INWARD TABLE -->
      <div style="border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden; margin-bottom: 14px;">
        <div style="background: #e2e8f0; padding: 6px 10px; font-size: 12px; font-weight: 700; color: #334155; border-bottom: 1px solid #cbd5e1;">
          📦 MATERIAL INWARD SPECIFICATIONS
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 1px solid #cbd5e1;">
              <th style="padding: 8px 10px; font-weight: 700;">Item / Material Name</th>
              <th style="padding: 8px 10px; font-weight: 700;">Assigned Lot No</th>
              <th style="padding: 8px 10px; font-weight: 700; text-align: center;">Bags / Qty</th>
              <th style="padding: 8px 10px; font-weight: 700; text-align: center;">Per Unit Wt (KG)</th>
              <th style="padding: 8px 10px; font-weight: 700; text-align: right;">Total Weight (KG)</th>
              <th style="padding: 8px 10px; font-weight: 700;">Destination Godown</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 10px; font-weight: 700; color: #0f172a;">${itemName}</td>
              <td style="padding: 8px 10px; font-weight: 700; color: #0f766e;">${lotNo}</td>
              <td style="padding: 8px 10px; text-align: center; font-weight: 600;">${qty}</td>
              <td style="padding: 8px 10px; text-align: center;">${unitWt}</td>
              <td style="padding: 8px 10px; text-align: right; font-weight: 700;">${totalWeight}</td>
              <td style="padding: 8px 10px;">${godown}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- WEIGHBRIDGE & SECURITY CHECKPOINTS -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 12px;">
        <tr style="background: #f8fafc; border-bottom: 1px solid #cbd5e1;">
          <th colspan="4" style="padding: 6px 10px; text-align: left; font-weight: 700; color: #334155;">⚖️ WEIGHBRIDGE & SECURITY CHECKS</th>
        </tr>
        <tr>
          <td style="padding: 8px 10px; border-right: 1px solid #cbd5e1; width: 25%;"><strong>Gross Weight:</strong> ________________ KG</td>
          <td style="padding: 8px 10px; border-right: 1px solid #cbd5e1; width: 25%;"><strong>Tare Weight:</strong> Pending Exit</td>
          <td style="padding: 8px 10px; border-right: 1px solid #cbd5e1; width: 25%;"><strong>Net Weight:</strong> ________________ KG</td>
          <td style="padding: 8px 10px; width: 25%;"><strong>Security Seal:</strong> Verified [ ✓ ]</td>
        </tr>
        <tr style="border-top: 1px solid #cbd5e1;">
          <td colspan="4" style="padding: 8px 10px; color: #475569;">
            <strong>Remarks / Inspection Notes:</strong> Material received in good condition. Sample drawn for Quality Control inspection.
          </td>
        </tr>
      </table>

      <!-- SIGNATURE BLOCKS -->
      <div style="margin-top: 25px; display: flex; justify-content: space-between; text-align: center; font-size: 11px; color: #475569;">
        <div style="width: 28%; border-top: 1px dashed #94a3b8; padding-top: 6px;">
          <strong>Security Guard / Gatekeeper</strong><br/>
          (Signature & Seal)
        </div>
        <div style="width: 28%; border-top: 1px dashed #94a3b8; padding-top: 6px;">
          <strong>Driver Acknowledgement</strong><br/>
          (Signature)
        </div>
        <div style="width: 28%; border-top: 1px dashed #94a3b8; padding-top: 6px;">
          <strong>Stores / Unloading Officer</strong><br/>
          (Authorized Signatory)
        </div>
      </div>

    </div>
  `;
}

export function generateVehicleOutPassHtml(row = {}, company = {}) {
  const companyName = company?.name || company?.print_name || 'BVC EXPORTS PRIVATE LIMITED';
  const companyAddress = company?.address || company?.address1 || 'Factory & Processing Plant, Industrial Area, Tamil Nadu';
  const companyGst = company?.gst_number || company?.gst_no || '33AAAAA0000A1Z5';
  const companyPhone = company?.phone_off || company?.mobile1 || company?.phone || '+91 98765 43210';

  const passNo = `OUTP-${String(row.s_no || row.id || '001').padStart(4, '0')}`;
  const passDate = row.date || row.invoice_date || new Date().toISOString().slice(0, 10);
  const currentTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const vehicleNo = row.vehicle_no || row.lorry_no || '—';
  const transporter = row.transporter || row.transport || 'Direct / Own Vehicle';
  const driverName = row.driver_name || row.driver || '—';
  const supplierName = row.supplier_name || row.supplier || '—';
  const invNo = row.inv_no || row.invoice_no || '—';
  const poNo = row.po_no || (row.purchase_order_id ? `PO-${row.purchase_order_id}` : 'Direct Purchase');
  const itemName = row.item_name || '—';
  const lotNo = row.lot_no || '—';
  const qty = row.qty || row.weight || '—';
  const totalWeight = row.total_weight || row.total_wt || '—';
  const godown = row.godown || row.godown_name || 'Main Godown';

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; line-height: 1.4; max-width: 850px; margin: 0 auto; padding: 10px;">
      
      <!-- HEADER -->
      <div style="border-bottom: 2px solid #b91c1c; padding-bottom: 12px; margin-bottom: 16px; text-align: center; position: relative;">
        <div style="font-size: 20px; font-weight: 800; color: #b91c1c; letter-spacing: 0.5px; text-transform: uppercase;">
          ${companyName}
        </div>
        <div style="font-size: 12px; color: #475569; margin-top: 2px;">
          ${companyAddress} | Ph: ${companyPhone}
        </div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px; font-weight: 600;">
          GSTIN: ${companyGst}
        </div>
        <div style="margin-top: 10px; display: inline-block; background: #b91c1c; color: #ffffff; padding: 4px 18px; border-radius: 4px; font-weight: 700; font-size: 13px; letter-spacing: 1px; text-transform: uppercase;">
          VEHICLE OUTWARD PASS / GATE OUT-PASS
        </div>
      </div>

      <!-- PASS META BAR -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; font-size: 12px;">
        <tr>
          <td style="padding: 8px 12px; width: 25%;"><strong>Gate Out Pass:</strong> <span style="color: #b91c1c; font-weight: bold; font-size: 13px;">${passNo}</span></td>
          <td style="padding: 8px 12px; width: 25%;"><strong>Outward Date:</strong> ${passDate}</td>
          <td style="padding: 8px 12px; width: 25%;"><strong>Exit Time:</strong> ${currentTime}</td>
          <td style="padding: 8px 12px; width: 25%;"><strong>Gate Clearance:</strong> APPROVED [ ✓ ]</td>
        </tr>
      </table>

      <!-- 2-COLUMN SECTION: VEHICLE & UNLOADING REF -->
      <div style="display: flex; gap: 14px; margin-bottom: 14px;">
        
        <!-- VEHICLE & DRIVER BOX -->
        <div style="flex: 1; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden;">
          <div style="background: #f1f5f9; padding: 6px 10px; font-size: 12px; font-weight: 700; color: #334155; border-bottom: 1px solid #cbd5e1;">
            🚚 DEPARTING VEHICLE & DRIVER
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <tr>
              <td style="padding: 6px 10px; border-bottom: 1px solid #f1f5f9; width: 40%; color: #64748b; font-weight: 600;">Vehicle / Lorry No</td>
              <td style="padding: 6px 10px; border-bottom: 1px solid #f1f5f9; font-weight: 700; color: #0f172a; font-size: 13px;">${vehicleNo}</td>
            </tr>
            <tr>
              <td style="padding: 6px 10px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-weight: 600;">Driver Name</td>
              <td style="padding: 6px 10px; border-bottom: 1px solid #f1f5f9; font-weight: 600;">${driverName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 10px; color: #64748b; font-weight: 600;">Transporter</td>
              <td style="padding: 6px 10px; font-weight: 600;">${transporter}</td>
            </tr>
          </table>
        </div>

        <!-- UNLOADING CLEARANCE BOX -->
        <div style="flex: 1; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden;">
          <div style="background: #f1f5f9; padding: 6px 10px; font-size: 12px; font-weight: 700; color: #334155; border-bottom: 1px solid #cbd5e1;">
            📋 UNLOADING CLEARANCE & INWARD REF
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <tr>
              <td style="padding: 6px 10px; border-bottom: 1px solid #f1f5f9; width: 40%; color: #64748b; font-weight: 600;">Supplier / Vendor</td>
              <td style="padding: 6px 10px; border-bottom: 1px solid #f1f5f9; font-weight: 700; color: #0f172a;">${supplierName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 10px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-weight: 600;">Supplier Inv & PO</td>
              <td style="padding: 6px 10px; border-bottom: 1px solid #f1f5f9; font-weight: 600;">${invNo} (${poNo})</td>
            </tr>
            <tr>
              <td style="padding: 6px 10px; color: #64748b; font-weight: 600;">Unloaded at Godown</td>
              <td style="padding: 6px 10px; font-weight: 600;">${godown}</td>
            </tr>
          </table>
        </div>

      </div>

      <!-- UNLOADED MATERIAL SUMMARY -->
      <div style="border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden; margin-bottom: 14px;">
        <div style="background: #f1f5f9; padding: 6px 10px; font-size: 12px; font-weight: 700; color: #334155; border-bottom: 1px solid #cbd5e1;">
          ✅ UNLOADED & ACCEPTED GOODS VERIFICATION
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 1px solid #cbd5e1;">
              <th style="padding: 8px 10px; font-weight: 700;">Material Unloaded</th>
              <th style="padding: 8px 10px; font-weight: 700;">Lot Number</th>
              <th style="padding: 8px 10px; font-weight: 700; text-align: center;">Unloaded Bags</th>
              <th style="padding: 8px 10px; font-weight: 700; text-align: right;">Total Weight (KG)</th>
              <th style="padding: 8px 10px; font-weight: 700; text-align: center;">Unloading Status</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 10px; font-weight: 700; color: #0f172a;">${itemName}</td>
              <td style="padding: 8px 10px; font-weight: 700; color: #b91c1c;">${lotNo}</td>
              <td style="padding: 8px 10px; text-align: center; font-weight: 600;">${qty}</td>
              <td style="padding: 8px 10px; text-align: right; font-weight: 700;">${totalWeight}</td>
              <td style="padding: 8px 10px; text-align: center; color: #15803d; font-weight: 700;">COMPLETED [ ✓ ]</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- WEIGHBRIDGE OUTWARD VERIFICATION -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 12px;">
        <tr style="background: #f8fafc; border-bottom: 1px solid #cbd5e1;">
          <th colspan="4" style="padding: 6px 10px; text-align: left; font-weight: 700; color: #334155;">⚖️ TARE WEIGHT & EXIT INSPECTION</th>
        </tr>
        <tr>
          <td style="padding: 8px 10px; border-right: 1px solid #cbd5e1; width: 25%;"><strong>Tare (Empty) Wt:</strong> ________________ KG</td>
          <td style="padding: 8px 10px; border-right: 1px solid #cbd5e1; width: 25%;"><strong>Net Unloaded:</strong> ________________ KG</td>
          <td style="padding: 8px 10px; border-right: 1px solid #cbd5e1; width: 25%;"><strong>Vehicle Cleaned:</strong> Verified [ ✓ ]</td>
          <td style="padding: 8px 10px; width: 25%;"><strong>Return Dunnage:</strong> Nil</td>
        </tr>
        <tr style="border-top: 1px solid #cbd5e1;">
          <td colspan="4" style="padding: 8px 10px; color: #475569;">
            <strong>Gate Security Clearance:</strong> Certified that the vehicle has completely unloaded the designated consignment, weighed empty, and is authorized to exit the premises.
          </td>
        </tr>
      </table>

      <!-- SIGNATURE BLOCKS -->
      <div style="margin-top: 25px; display: flex; justify-content: space-between; text-align: center; font-size: 11px; color: #475569;">
        <div style="width: 28%; border-top: 1px dashed #94a3b8; padding-top: 6px;">
          <strong>Stores In-Charge</strong><br/>
          (Unloading Verified)
        </div>
        <div style="width: 28%; border-top: 1px dashed #94a3b8; padding-top: 6px;">
          <strong>Driver Acknowledgement</strong><br/>
          (Signature)
        </div>
        <div style="width: 28%; border-top: 1px dashed #94a3b8; padding-top: 6px;">
          <strong>Main Gate Security</strong><br/>
          (Authorized Out-Pass Signatory)
        </div>
      </div>

    </div>
  `;
}
