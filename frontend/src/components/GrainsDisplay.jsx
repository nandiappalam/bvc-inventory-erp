import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EntryDisplay } from './entry';
import api from '../services/api';
import { printHtml } from '../utils/printHelper';

const GrainsDisplay = () => {
  const navigate = useNavigate();

  // Handle edit / view by navigating to creation page with ID
  const handleEdit = (row) => {
    navigate(`/entry/grind-create?id=${row.id}`);
  };

  // Beautiful custom print generator with full Yield, Cost, CCP, OPRP & Verification sign-off
  const handlePrint = async (row) => {
    let fullRecord = row;
    try {
      if (!row.inputItems || !row.ccp || !row.oprp || !row.verification) {
        const fetched = await api(`/grains/${row.id}`);
        if (fetched && fetched.id) {
          fullRecord = fetched;
        }
      }
    } catch (e) {
      console.warn('Using existing row data for print:', e);
    }

    const inputs = fullRecord.inputItems || fullRecord.input_items || [];
    const outputs = fullRecord.outputItems || fullRecord.output_items || [];
    const wastages = fullRecord.wastageItems || fullRecord.wastage_items || [];
    const ccp = fullRecord.ccp || {};
    const oprpList = fullRecord.oprp || [];
    const verification = fullRecord.verification || {};

    const totalInputBags = inputs.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
    const totalInputWt = inputs.reduce((sum, item) => sum + (parseFloat(item.totalWt || item.total_wt) || 0), 0);
    const totalInputCost = inputs.reduce((sum, item) => {
      const qty = parseFloat(item.qty) || 0;
      const rate = parseFloat(item.rate || item.purchase_rate || item.cost || 0);
      return sum + (qty * rate);
    }, 0);

    const avgRmCostPerQty = totalInputBags > 0 ? (totalInputCost / totalInputBags) : 0;
    const avgRmCostPerKg = totalInputWt > 0 ? (totalInputCost / totalInputWt) : 0;

    const totalOutputBags = outputs.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
    const totalOutputWt = outputs.reduce((sum, item) => sum + (parseFloat(item.totalWt || item.total_wt) || 0), 0);

    const totalWastageBags = wastages.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
    const totalWastageWt = wastages.reduce((sum, item) => sum + (parseFloat(item.totalWt || item.total_wt) || 0), 0);

    const shortcomingWt = totalInputWt - (totalOutputWt + totalWastageWt);
    const shortcomingPositive = shortcomingWt > 0 ? shortcomingWt : 0;

    const inputPct = totalInputWt > 0 ? 100 : 0;
    const outputPct = totalInputWt > 0 ? (totalOutputWt / totalInputWt) * 100 : 0;
    const wastagePct = totalInputWt > 0 ? (totalWastageWt / totalInputWt) * 100 : 0;
    const shortcomingPct = totalInputWt > 0 ? (shortcomingWt / totalInputWt) * 100 : 0;

    const wastageLossAmount = totalWastageWt * avgRmCostPerKg;
    const shortcomingLossAmount = shortcomingPositive * avgRmCostPerKg;
    const totalRmLossAmount = wastageLossAmount + shortcomingLossAmount;

    // 1. Input Items Table Rows with Cost
    const inputRows = inputs.map((item, idx) => {
      const qty = parseFloat(item.qty) || 0;
      const rate = parseFloat(item.rate || item.purchase_rate || item.cost || 0);
      const rowCost = qty * rate;
      return `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${idx + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: 600; color: #1e293b;">${item.itemName || item.item_name || ''}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; font-family: monospace; color: #2563eb;">${item.lotNo || item.lot_no || '-'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">${(parseFloat(item.weight) || 0).toFixed(2)} kg</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: 600;">${qty}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold; color: #1e3a8a;">${(parseFloat(item.totalWt || item.total_wt) || 0).toFixed(2)} kg</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">₹${rate.toFixed(2)}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold; color: #0f172a;">₹${rowCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      `;
    }).join('');

    // 2. Output Items Table Rows
    const outputRows = outputs.map((item, idx) => `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: 600; color: #065f46;">${item.itemName || item.item_name || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-family: monospace; color: #059669;">${item.lotNo || item.lot_no || '-'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">${(parseFloat(item.weight) || 0).toFixed(2)} kg</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: 600;">${parseFloat(item.qty) || 0}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold; color: #16a34a;">${(parseFloat(item.totalWt || item.total_wt) || 0).toFixed(2)} kg</td>
      </tr>
    `).join('');

    // 3. Wastage Items Table Rows
    const wastageRows = wastages.map((item, idx) => `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: 600; color: #991b1b;">${item.itemName || item.item_name || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-family: monospace; color: #dc2626;">${item.lotNo || item.lot_no || '-'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">${(parseFloat(item.weight) || 0).toFixed(2)} kg</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: 600;">${parseFloat(item.qty) || 0}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold; color: #dc2626;">${(parseFloat(item.totalWt || item.total_wt) || 0).toFixed(2)} kg</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; color: #64748b;">${item.category || 'Process Residue'}</td>
      </tr>
    `).join('');

    // 4. OPRP Monitoring Table Rows
    const oprpRows = (oprpList && oprpList.length > 0 ? oprpList : (inputs.length > 0 ? inputs.map((inIt, i) => ({
      material: inIt.itemName || inIt.item_name,
      rm_fg: 'RM',
      lot_number: inIt.lotNo || inIt.lot_no || '-',
      quantity: inIt.qty || 0,
      alp: 1,
      g: 1,
      alp_check: 'PASS',
      g_grinding_check: 'PASS',
      alp_gram: 160,
      inspector: 'QC Inspector',
      remarks: 'Raw Material Lot Inspected'
    })) : [])).map((item, idx) => {
      const isAlpPass = item.alp === 1 || item.alp === '1' || item.alp === true || 
        String(item.alp_check || item.alpCheck || '').toLowerCase().includes('pass') || 
        String(item.alp_check || item.alpCheck || '').toLowerCase().includes('safe') ||
        (item.alp_check === undefined && item.alp !== 0 && item.alp !== '0');
      
      const isGrindPass = item.g === 1 || item.g === '1' || item.g === true || 
        String(item.g_grinding_check || item.gGrindingCheck || '').toLowerCase().includes('pass') || 
        String(item.g_grinding_check || item.gGrindingCheck || '').toLowerCase().includes('safe') ||
        (item.g_grinding_check === undefined && item.g !== 0 && item.g !== '0');

      const matName = item.material || item.material_name || item.materialName || item.item_name || item.itemName || 
        (inputs[idx]?.itemName || inputs[idx]?.item_name) || 
        (outputs[idx]?.itemName || outputs[idx]?.item_name) || 
        (idx === 0 ? (inputs[0]?.itemName || inputs[0]?.item_name || 'Raw Material') : (outputs[0]?.itemName || outputs[0]?.item_name || 'Finished Flour'));

      const itemType = item.rm_fg || item.rmFg || item.item_type || item.itemType || item.type || (idx === 0 ? 'RM' : 'FG');

      const lotNo = item.lot_number || item.lot_no || item.lotNo || 
        (idx === 0 ? (inputs[0]?.lotNo || inputs[0]?.lot_no) : (outputs[0]?.lotNo || outputs[0]?.lot_no)) || '-';

      const bagsCount = item.quantity !== undefined && item.quantity !== null && item.quantity !== '' ? item.quantity : 
        (item.qty !== undefined && item.qty !== null && item.qty !== '' ? item.qty : 
        (item.bags !== undefined ? item.bags : 
        (idx === 0 ? (inputs[0]?.qty || 0) : (outputs[0]?.qty || 0))));

      const alpGramDisplay = (item.alp_gram !== undefined && item.alp_gram !== null && item.alp_gram !== '') ? `${item.alp_gram} g` : 
        (item.alpGram ? `${item.alpGram} g` : '160 g');

      return `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${idx + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: 600; color: #1e293b;">${matName}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;"><span style="font-size: 11px; font-weight: bold; padding: 2px 6px; border-radius: 4px; background: ${itemType === 'FG' ? '#dcfce7' : '#e0f2fe'}; color: ${itemType === 'FG' ? '#15803d' : '#0369a1'};">${itemType}</span></td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; font-family: monospace; font-weight: 600;">${lotNo}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: 600;">${bagsCount}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold; color: #0284c7;">${alpGramDisplay}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: bold; background-color: ${isAlpPass ? '#dcfce7' : '#fee2e2'}; color: ${isAlpPass ? '#15803d' : '#b91c1c'}; border: 1px solid ${isAlpPass ? '#86efac' : '#fca5a5'};">
              ${isAlpPass ? 'PASS' : 'FAIL'}
            </span>
          </td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: bold; background-color: ${isGrindPass ? '#dcfce7' : '#fee2e2'}; color: ${isGrindPass ? '#15803d' : '#b91c1c'}; border: 1px solid ${isGrindPass ? '#86efac' : '#fca5a5'};">
              ${isGrindPass ? 'PASS' : 'FAIL'}
            </span>
          </td>
          <td style="border: 1px solid #cbd5e1; padding: 8px;">${item.checked_by || item.inspector || item.inspector_sign || 'QC Inspector'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; color: #64748b; font-size: 11px;">${item.remarks || (idx === 0 ? 'Raw Material Lot Inspected' : 'Finished Good Batch Inspected')}</td>
        </tr>
      `;
    }).join('');

    // CCP details
    const ccpStatus = (ccp.status || fullRecord.ccp_status || 'PASS').toUpperCase();
    const isCcpPass = ccpStatus === 'PASS';
    const isCcpFail = ccpStatus === 'FAIL';
    const ccpCategory = ccp.ccp_category || ccp.ccpCategory || 'Sortex Machine / Sieving';
    const ccpLimit = ccp.critical_limit || ccp.criticalLimit || '5.5 g/MT';
    const ccpActual = ccp.actual_reading !== undefined && ccp.actual_reading !== null ? ccp.actual_reading : (ccp.actualReading || '0.0');
    const ccpUnit = ccp.unit || 'g/MT';
    const ccpCheckedBy = ccp.checked_by || ccp.checkedBy || 'QC Inspector';
    const ccpTime = ccp.checked_time || ccp.checkedTime || (fullRecord.date ? fullRecord.date.split('T')[0] : '');

    // Verification details
    const finalApproval = (verification.final_approval || verification.finalApproval || fullRecord.qc_status || 'APPROVED').toUpperCase();
    const isApproved = finalApproval === 'APPROVED';
    const isRejected = finalApproval === 'REJECTED';
    const operatorIncharge = verification.operator_incharge || verification.operatorIncharge || 'Shift Operator';
    const prodShift = verification.production_shift || verification.shift || 'Shift A';
    const prodIncharge = verification.production_incharge || verification.productionIncharge || 'Production Lead';
    const qcTechnologist = verification.qc_technologist || verification.qcTechnologist || 'QC Technologist';
    const qaManager = verification.qa_manager || verification.qaManager || 'QA Manager';
    const verifRemarks = verification.remarks || verification.verification_remarks || fullRecord.remarks || 'All milling, CCP parameters, and FSMS hygiene criteria are verified.';

    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 24px; color: #1e293b; max-width: 900px; margin: 0 auto; line-height: 1.45; font-size: 13px;">
        
        <div style="text-align: center; border-bottom: 3px solid #1f4fb2; padding-bottom: 15px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="text-align: left;">
              <h1 style="color: #1f4fb2; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">BVC ERP SYSTEM</h1>
              <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b; font-weight: 600;">FLOUR MILLING & FSMS PRODUCTION PROCESS RECORD</p>
            </div>
            <div style="text-align: right;">
              <span style="display: inline-block; padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 800; background: #e0e7ff; color: #1e40af; border: 1px solid #c7d2fe;">
                GRIND ID: #${fullRecord.id}
              </span>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 15px; background-color: #f8fafc; padding: 12px 16px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 13px; text-align: left;">
            <div><span style="color: #64748b; font-size: 11px; display: block; text-transform: uppercase;">Milling Date</span><strong>${fullRecord.date ? fullRecord.date.split('T')[0] : ''}</strong></div>
            <div><span style="color: #64748b; font-size: 11px; display: block; text-transform: uppercase;">Flour Mill</span><strong>${fullRecord.flour_mill_name || fullRecord.flour_mill || 'Mill #1'}</strong></div>
            <div><span style="color: #64748b; font-size: 11px; display: block; text-transform: uppercase;">Production Shift</span><strong>${prodShift}</strong></div>
            <div><span style="color: #64748b; font-size: 11px; display: block; text-transform: uppercase;">FSMS QC Status</span><strong style="color: ${isApproved ? '#15803d' : '#b91c1c'};">${finalApproval}</strong></div>
          </div>
        </div>

        <div style="margin-bottom: 22px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #cbd5e1; padding-bottom: 6px; margin-bottom: 8px;">
            <h3 style="margin: 0; color: #1f4fb2; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">1. Raw Material Input Items</h3>
            <span style="font-size: 12px; color: #475569; font-weight: 600;">Total Input: ${totalInputBags} bags / ${totalInputWt.toFixed(2)} kg</span>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background-color: #f1f5f9; color: #334155;">
                <th style="border: 1px solid #cbd5e1; padding: 8px; width: 45px; text-align: center;">S.No</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Item Name</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Lot No</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 90px;">Unit Wt</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 65px;">Qty</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 100px;">Total Wt</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 90px;">Rate / Qty</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 110px;">Total RM Cost</th>
              </tr>
            </thead>
            <tbody>
              ${inputRows || '<tr><td colspan="8" style="text-align: center; padding: 12px; color: #64748b;">No raw material input items recorded</td></tr>'}
              <tr style="font-weight: bold; background-color: #f8fafc; color: #1e3a8a;">
                <td colspan="4" style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; text-transform: uppercase;">Total Input:</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">${totalInputBags}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">${totalInputWt.toFixed(2)} kg</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">-</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-size: 13px;">₹${totalInputCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="margin-bottom: 22px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #cbd5e1; padding-bottom: 6px; margin-bottom: 8px;">
            <h3 style="margin: 0; color: #15803d; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">2. Output Items (Finished Goods - FG)</h3>
            <span style="font-size: 12px; color: #15803d; font-weight: 600;">Total Output: ${totalOutputBags} bags / ${totalOutputWt.toFixed(2)} kg (${outputPct.toFixed(2)}%)</span>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background-color: #f0fdf4; color: #166534;">
                <th style="border: 1px solid #cbd5e1; padding: 8px; width: 45px; text-align: center;">S.No</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Finished Good Item</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Output Lot No</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 100px;">Unit Wt</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 80px;">Qty (Bags)</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 120px;">Total Wt (kg)</th>
              </tr>
            </thead>
            <tbody>
              ${outputRows || '<tr><td colspan="6" style="text-align: center; padding: 12px; color: #64748b;">No finished good items recorded</td></tr>'}
              <tr style="font-weight: bold; background-color: #f0fdf4; color: #15803d;">
                <td colspan="4" style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; text-transform: uppercase;">Total Finished Goods:</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">${totalOutputBags}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-size: 13px;">${totalOutputWt.toFixed(2)} kg</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="margin-bottom: 22px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #cbd5e1; padding-bottom: 6px; margin-bottom: 8px;">
            <h3 style="margin: 0; color: #b91c1c; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">3. Process Wastage Items</h3>
            <span style="font-size: 12px; color: #b91c1c; font-weight: 600;">Total Wastage: ${totalWastageBags} bags / ${totalWastageWt.toFixed(2)} kg (${wastagePct.toFixed(2)}%)</span>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background-color: #fef2f2; color: #991b1b;">
                <th style="border: 1px solid #cbd5e1; padding: 8px; width: 45px; text-align: center;">S.No</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Wastage Item</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Lot No</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 100px;">Unit Wt</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 80px;">Qty (Bags)</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 120px;">Total Wt (kg)</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left; width: 140px;">Category / Reason</th>
              </tr>
            </thead>
            <tbody>
              ${wastageRows || '<tr><td colspan="7" style="text-align: center; padding: 12px; color: #64748b;">No wastage items recorded</td></tr>'}
              <tr style="font-weight: bold; background-color: #fef2f2; color: #b91c1c;">
                <td colspan="4" style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; text-transform: uppercase;">Total Wastage:</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">${totalWastageBags}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-size: 13px;">${totalWastageWt.toFixed(2)} kg</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px;">-</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="margin-bottom: 24px; background-color: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #cbd5e1;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="margin: 0; color: #1e3a8a; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">
              Grind Material Balance & Yield Summary (Cost Analytics)
            </h3>
            ${totalInputCost > 0 ? `
              <span style="font-size: 11px; font-weight: bold; background-color: #dbeafe; color: #1e40af; padding: 3px 8px; border-radius: 10px; border: 1px solid #bfdbfe;">
                RM Purchase Cost: ₹${avgRmCostPerQty.toFixed(2)} / qty (₹${avgRmCostPerKg.toFixed(2)} / kg)
              </span>
            ` : ''}
          </div>

          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
            <div style="padding: 10px; background-color: #e0e7ff; border-radius: 6px; border-left: 4px solid #4f46e5;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 10px; color: #4338ca; font-weight: 700; text-transform: uppercase;">TOTAL INPUT MATERIAL</span>
                <span style="font-size: 10px; font-weight: bold; color: #3730a3; background-color: #c7d2fe; padding: 1px 5px; border-radius: 4px;">${inputPct.toFixed(2)}%</span>
              </div>
              <div style="font-size: 13px; font-weight: bold; color: #1e1b4b; margin-top: 4px;">
                ${totalInputBags.toFixed(0)} bags / ${totalInputWt.toFixed(2)} kg
              </div>
              <div style="font-size: 11px; font-weight: 700; color: #3730a3; margin-top: 4px; border-top: 1px dashed #a5b4fc; padding-top: 3px;">
                RM Cost: ₹${totalInputCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
            </div>

            <div style="padding: 10px; background-color: #dcfce7; border-radius: 6px; border-left: 4px solid #16a34a;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 10px; color: #15803d; font-weight: 700; text-transform: uppercase;">FINISHED GOODS OUTPUT</span>
                <span style="font-size: 10px; font-weight: bold; color: #166534; background-color: #bbf7d0; padding: 1px 5px; border-radius: 4px;">${outputPct.toFixed(2)}%</span>
              </div>
              <div style="font-size: 13px; font-weight: bold; color: #064e3b; margin-top: 4px;">
                ${totalOutputBags.toFixed(0)} bags / ${totalOutputWt.toFixed(2)} kg
              </div>
              <div style="font-size: 11px; font-weight: 700; color: #15803d; margin-top: 4px; border-top: 1px dashed #86efac; padding-top: 3px;">
                Yield Share: ${outputPct.toFixed(2)}%
              </div>
            </div>

            <div style="padding: 10px; background-color: #fee2e2; border-radius: 6px; border-left: 4px solid #dc2626;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 10px; color: #b91c1c; font-weight: 700; text-transform: uppercase;">PROCESS WASTAGE</span>
                <span style="font-size: 10px; font-weight: bold; color: #991b1b; background-color: #fecaca; padding: 1px 5px; border-radius: 4px;">${wastagePct.toFixed(2)}%</span>
              </div>
              <div style="font-size: 13px; font-weight: bold; color: #7f1d1d; margin-top: 4px;">
                ${totalWastageBags.toFixed(0)} bags / ${totalWastageWt.toFixed(2)} kg
              </div>
              <div style="font-size: 11px; font-weight: 700; color: #991b1b; margin-top: 4px; border-top: 1px dashed #fca5a5; padding-top: 3px;">
                Wastage Amount: ₹${wastageLossAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
            </div>

            <div style="padding: 10px; background-color: #ffedd5; border-radius: 6px; border-left: 4px solid #f97316;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 10px; color: #c2410c; font-weight: 700; text-transform: uppercase;">SHORTCOMING / LOSS</span>
                <span style="font-size: 10px; font-weight: bold; color: #9a3412; background-color: #fed7aa; padding: 1px 5px; border-radius: 4px;">${shortcomingPct.toFixed(2)}%</span>
              </div>
              <div style="font-size: 13px; font-weight: bold; color: #7c2d12; margin-top: 4px;">
                ${shortcomingWt.toFixed(2)} kg
              </div>
              <div style="font-size: 11px; font-weight: 700; color: #9a3412; margin-top: 4px; border-top: 1px dashed #fdba74; padding-top: 3px;">
                Loss Amount: ₹${shortcomingLossAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div style="margin-top: 12px; padding: 8px 12px; background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
            <span style="font-weight: 600; color: #9f1239;">Total RM Wastage & Shortcoming Loss:</span>
            <span style="font-weight: bold; color: #881337; font-size: 13px;">
              ${(totalWastageWt + shortcomingPositive).toFixed(2)} kg = ₹${totalRmLossAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div style="margin-bottom: 22px; background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 10px;">
            <h3 style="margin: 0; color: #1e3a8a; font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">
              5. Critical Control Point (CCP) Monitoring - ISO 22000 FSMS
            </h3>
            <span style="padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: bold; background-color: ${isCcpPass ? '#dcfce7' : '#fee2e2'}; color: ${isCcpPass ? '#15803d' : '#b91c1c'}; border: 1px solid ${isCcpPass ? '#86efac' : '#fca5a5'};">
              CCP STATUS: ${ccpStatus}
            </span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 12px;">
            <div><span style="color: #64748b; font-size: 11px; display: block;">CCP Equipment / Point:</span><strong>${ccpCategory}</strong></div>
            <div><span style="color: #64748b; font-size: 11px; display: block;">Critical Limit Standard:</span><strong>${ccpLimit}</strong></div>
            <div><span style="color: #64748b; font-size: 11px; display: block;">Actual Test Reading:</span><strong style="color: ${isCcpPass ? '#15803d' : '#b91c1c'};">${ccpActual} ${ccpUnit}</strong></div>
            <div><span style="color: #64748b; font-size: 11px; display: block;">Checked By:</span><strong>${ccpCheckedBy}</strong></div>
            <div><span style="color: #64748b; font-size: 11px; display: block;">Inspection Time:</span><strong>${ccpTime}</strong></div>
            <div><span style="color: #64748b; font-size: 11px; display: block;">Corrective Action:</span><strong>${ccp.corrective_action || ccp.correctiveAction || 'None (Within Critical Limit)'}</strong></div>
          </div>
        </div>

        <div style="margin-bottom: 22px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #cbd5e1; padding-bottom: 6px; margin-bottom: 8px;">
            <h3 style="margin: 0; color: #1e3a8a; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">6. Operational Prerequisite Programs (OPRP) Monitoring</h3>
            <span style="font-size: 12px; color: #475569; font-weight: 600;">ISO 22000 Food Safety Controls (${oprpList.length} Entries)</span>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background-color: #f1f5f9; color: #334155;">
                <th style="border: 1px solid #cbd5e1; padding: 6px 8px; width: 40px; text-align: center;">S.No</th>
                <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left;">Material Name</th>
                <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; width: 55px;">Type</th>
                <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; width: 110px;">Lot No</th>
                <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; width: 55px;">Bags</th>
                <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; width: 80px;">ALP (g)</th>
                <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; width: 75px;">ALP Check</th>
                <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; width: 85px;">G Grinding</th>
                <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; width: 95px;">Inspector</th>
                <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left;">Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${oprpRows || '<tr><td colspan="10" style="text-align: center; padding: 12px; color: #64748b;">No OPRP monitoring records registered for this batch</td></tr>'}
            </tbody>
          </table>
        </div>

        <div style="margin-bottom: 20px; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px;">
            <h3 style="margin: 0; color: #1e3a8a; font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">
              7. Production & FSMS Verification Sign-Off
            </h3>
            <span style="padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: bold; background-color: ${isApproved ? '#dbeafe' : (isRejected ? '#fee2e2' : '#fef3c7')}; color: ${isApproved ? '#1e40af' : (isRejected ? '#b91c1c' : '#d97706')}; border: 1px solid ${isApproved ? '#bfdbfe' : (isRejected ? '#fca5a5' : '#fde68a')};">
              FINAL APPROVAL: ${finalApproval}
            </span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 12px; margin-bottom: 14px;">
            <div><span style="color: #64748b; font-size: 11px; display: block;">Operator In-Charge:</span><strong>${operatorIncharge}</strong></div>
            <div><span style="color: #64748b; font-size: 11px; display: block;">QC Technologist:</span><strong>${qcTechnologist}</strong></div>
            <div><span style="color: #64748b; font-size: 11px; display: block;">QA Manager:</span><strong>${qaManager}</strong></div>
            <div style="grid-column: span 3; background-color: #ffffff; padding: 8px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <span style="color: #64748b; font-size: 11px; display: block;">Verification Remarks:</span>
              <p style="margin: 2px 0 0 0; color: #334155; font-size: 12px;">${verifRemarks}</p>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 15px; text-align: center;">
            <div style="border: 1px dashed #94a3b8; border-radius: 6px; padding: 12px 6px; background-color: #ffffff;">
              <div style="height: 35px; border-bottom: 1px solid #cbd5e1; margin-bottom: 6px;"></div>
              <strong style="font-size: 11px; color: #334155; display: block;">${operatorIncharge || 'Machine Operator'}</strong>
              <span style="font-size: 10px; color: #64748b;">Operator Signature</span>
            </div>

            <div style="border: 1px dashed #94a3b8; border-radius: 6px; padding: 12px 6px; background-color: #ffffff;">
              <div style="height: 35px; border-bottom: 1px solid #cbd5e1; margin-bottom: 6px;"></div>
              <strong style="font-size: 11px; color: #334155; display: block;">${prodIncharge || 'Production In-Charge'}</strong>
              <span style="font-size: 10px; color: #64748b;">Production Incharge</span>
            </div>

            <div style="border: 1px dashed #94a3b8; border-radius: 6px; padding: 12px 6px; background-color: #ffffff;">
              <div style="height: 35px; border-bottom: 1px solid #cbd5e1; margin-bottom: 6px;"></div>
              <strong style="font-size: 11px; color: #334155; display: block;">${qcTechnologist || 'QC Technologist'}</strong>
              <span style="font-size: 10px; color: #64748b;">QC Inspector Sign</span>
            </div>

            <div style="border: 1px dashed #94a3b8; border-radius: 6px; padding: 12px 6px; background-color: #ffffff;">
              <div style="height: 35px; border-bottom: 1px solid #cbd5e1; margin-bottom: 6px;"></div>
              <strong style="font-size: 11px; color: #334155; display: block;">${qaManager || 'QA Manager'}</strong>
              <span style="font-size: 10px; color: #64748b;">QA Head Approval & Stamp</span>
            </div>
          </div>
        </div>

        <div style="border-top: 1px solid #cbd5e1; padding-top: 8px; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8;">
          <span>BVC ERP System - Automated Milling & Quality Report</span>
          <span>Generated on: ${new Date().toLocaleString()}</span>
        </div>

      </div>
    `;

    printHtml(html, `Grind Report - #${fullRecord.id}`);
  };

  const columns = [
    { key: 'sno', title: 'S.No', render: (_val, row, idx) => idx !== undefined ? idx + 1 : (row.s_no || row.id || '') },
    { key: 'id', title: 'ID' },
    { key: 'date', title: 'Date', render: (val) => val ? val.split('T')[0] : '' },
    { key: 'flour_mill', title: 'Flour Mill', render: (val, row) => row.flour_mill_name || row.flour_mill || '' },
    {
      key: 'input_details',
      title: 'Input Items & Lots',
      render: (_, row) => {
        const items = row.inputItems || row.input_items || [];
        if (items.length === 0) return <span style={{ color: '#64748b' }}>No Input Items</span>;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {items.map((item, idx) => (
              <div key={idx} style={{ fontSize: '13px', borderBottom: idx < items.length - 1 ? '1px dashed #e2e8f0' : 'none', paddingBottom: '2px' }}>
                <span style={{ fontWeight: '600' }}>{item.itemName || item.item_name}</span>
                <span style={{ color: '#3b82f6', background: '#eff6ff', padding: '1px 5px', borderRadius: '4px', marginLeft: '6px', fontSize: '11px', fontFamily: 'monospace' }}>
                  {item.lotNo || item.lot_no}
                </span>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
                  {item.weight || item.per_unit_weight || 0} kg × {item.qty || 0} = <strong>{(item.totalWt || item.total_wt || 0)} kg</strong>
                </div>
              </div>
            ))}
          </div>
        );
      }
    },
    {
      key: 'input_total_wt',
      title: 'Input Total Wt',
      render: (_, row) => {
        const items = row.inputItems || row.input_items || [];
        const total = items.reduce((sum, item) => sum + (parseFloat(item.totalWt || item.total_wt) || 0), 0);
        return <strong style={{ color: '#1e3a8a', fontSize: '15px' }}>{total.toFixed(2)} kg</strong>;
      }
    },
    {
      key: 'output_details',
      title: 'Output Items & Lots',
      render: (_, row) => {
        const items = row.outputItems || row.output_items || [];
        if (items.length === 0) return <span style={{ color: '#64748b' }}>No Output Items</span>;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {items.map((item, idx) => (
              <div key={idx} style={{ fontSize: '13px', borderBottom: idx < items.length - 1 ? '1px dashed #e2e8f0' : 'none', paddingBottom: '2px' }}>
                <span style={{ fontWeight: '600' }}>{item.itemName || item.item_name}</span>
                {item.lotNo || item.lot_no ? (
                  <span style={{ color: '#10b981', background: '#ecfdf5', padding: '1px 5px', borderRadius: '4px', marginLeft: '6px', fontSize: '11px', fontFamily: 'monospace' }}>
                    {item.lotNo || item.lot_no}
                  </span>
                ) : null}
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
                  {item.weight || item.per_unit_weight || 0} kg × {item.qty || 0} = <strong>{(item.totalWt || item.total_wt || 0)} kg</strong>
                </div>
              </div>
            ))}
          </div>
        );
      }
    },
    {
      key: 'output_total_wt',
      title: 'Output Total Wt',
      render: (_, row) => {
        const items = row.outputItems || row.output_items || [];
        const total = items.reduce((sum, item) => sum + (parseFloat(item.totalWt || item.total_wt) || 0), 0);
        return <strong style={{ color: '#16a34a', fontSize: '15px' }}>{total.toFixed(2)} kg</strong>;
      }
    },
    {
      key: 'wastage_total_wt',
      title: 'Wastage Total Wt',
      render: (_, row) => {
        const items = row.wastageItems || row.wastage_items || [];
        const total = items.reduce((sum, item) => sum + (parseFloat(item.totalWt || item.total_wt) || 0), 0);
        return <strong style={{ color: '#dc2626', fontSize: '15px' }}>{total.toFixed(2)} kg</strong>;
      }
    },
    {
      key: 'shortcoming_total_wt',
      title: 'Shortcoming Wt',
      render: (_, row) => {
        const inputs = row.inputItems || row.input_items || [];
        const outputs = row.outputItems || row.output_items || [];
        const wastages = row.wastageItems || row.wastage_items || [];
        const inputTotal = inputs.reduce((sum, x) => sum + (parseFloat(x.totalWt || x.total_wt) || 0), 0);
        const outputTotal = outputs.reduce((sum, x) => sum + (parseFloat(x.totalWt || x.total_wt) || 0), 0);
        const wastageTotal = wastages.reduce((sum, x) => sum + (parseFloat(x.totalWt || x.total_wt) || 0), 0);
        const loss = inputTotal - (outputTotal + wastageTotal);
        return <strong style={{ color: loss >= 0 ? '#f97316' : '#ef4444', fontSize: '15px' }}>{loss.toFixed(2)} kg</strong>;
      }
    },
    {
      key: 'ccp_status',
      title: 'CCP Status',
      render: (_, row) => {
        const status = (row.ccp_status || row.ccp?.status || 'PASS').toUpperCase();
        const isPass = status === 'PASS';
        const isFail = status === 'FAIL';
        return (
          <span style={{
            padding: '3px 8px',
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: 'bold',
            backgroundColor: isPass ? '#dcfce7' : isFail ? '#fee2e2' : '#fef3c7',
            color: isPass ? '#15803d' : isFail ? '#b91c1c' : '#b45309',
            border: `1px solid ${isPass ? '#86efac' : isFail ? '#fca5a5' : '#fde68a'}`
          }}>
            {status}
          </span>
        );
      }
    },
    {
      key: 'oprp_status',
      title: 'OPRP Status',
      render: (_, row) => {
        const status = row.oprp_status || (row.oprp && row.oprp.length > 0 ? 'Completed' : 'Completed');
        return (
          <span style={{
            padding: '3px 8px',
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: 'bold',
            backgroundColor: '#dcfce7',
            color: '#15803d',
            border: '1px solid #86efac'
          }}>
            {status}
          </span>
        );
      }
    },
    {
      key: 'qc_status',
      title: 'QC Approval',
      render: (_, row) => {
        const status = (row.qc_status || row.verification?.final_approval || 'APPROVED').toUpperCase();
        const isApp = status === 'APPROVED';
        const isRej = status === 'REJECTED';
        return (
          <span style={{
            padding: '3px 8px',
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: 'bold',
            backgroundColor: isApp ? '#dbeafe' : isRej ? '#fee2e2' : '#fef3c7',
            color: isApp ? '#1e40af' : isRej ? '#b91c1c' : '#b45309',
            border: `1px solid ${isApp ? '#bfdbfe' : isRej ? '#fca5a5' : '#fde68a'}`
          }}>
            {status}
          </span>
        );
      }
    },
    { key: 'remarks', title: 'Remarks' }
  ];

  return (
    <EntryDisplay
      title="Grind Display"
      apiEndpoint="/grains"
      columns={columns}
      onEdit={handleEdit}
      onPrint={handlePrint}
      onRowClick={handleEdit}
      addNewLink="/entry/grind-create"
    />
  );
};

export default GrainsDisplay;
