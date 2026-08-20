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

  // Beautiful custom print generator
  const handlePrint = (row) => {
    const inputs = row.inputItems || row.input_items || [];
    const outputs = row.outputItems || row.output_items || [];
    const wastages = row.wastageItems || row.wastage_items || [];

    const inputRows = inputs.map((item, idx) => `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 10px;">${item.itemName || item.item_name || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 10px; font-family: monospace;">${item.lotNo || item.lot_no || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right;">${item.weight || 0} kg</td>
        <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right;">${item.qty || 0}</td>
        <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; font-weight: bold;">${(parseFloat(item.totalWt || item.total_wt) || 0).toFixed(2)} kg</td>
      </tr>
    `).join('');

    const outputRows = outputs.map((item, idx) => `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 10px;">${item.itemName || item.item_name || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 10px; font-family: monospace;">${item.lotNo || item.lot_no || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right;">${item.weight || 0} kg</td>
        <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right;">${item.qty || 0}</td>
        <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; font-weight: bold;">${(parseFloat(item.totalWt || item.total_wt) || 0).toFixed(2)} kg</td>
      </tr>
    `).join('');

    const wastageRows = wastages.map((item, idx) => `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 10px;">${item.itemName || item.item_name || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 10px; font-family: monospace;">${item.lotNo || item.lot_no || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right;">${item.weight || 0} kg</td>
        <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right;">${item.qty || 0}</td>
        <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; font-weight: bold;">${(parseFloat(item.totalWt || item.total_wt) || 0).toFixed(2)} kg</td>
      </tr>
    `).join('');

    const inputTotal = inputs.reduce((sum, item) => sum + (parseFloat(item.totalWt || item.total_wt) || 0), 0);
    const outputTotal = outputs.reduce((sum, item) => sum + (parseFloat(item.totalWt || item.total_wt) || 0), 0);
    const wastageTotal = wastages.reduce((sum, item) => sum + (parseFloat(item.totalWt || item.total_wt) || 0), 0);

    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #1e293b; max-width: 800px; margin: 0 auto; line-height: 1.5;">
        <div style="text-align: center; border-bottom: 3px solid #1f4fb2; padding-bottom: 20px; margin-bottom: 25px;">
          <h1 style="color: #1f4fb2; margin: 0 0 5px 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">BVC ERP</h1>
          <h2 style="color: #475569; margin: 0 0 15px 0; font-size: 18px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Grind Creation Invoice / Summary</h2>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 20px; background-color: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 14px; text-align: left;">
            <div><strong>Grind ID:</strong> #${row.id}</div>
            <div><strong>Date:</strong> ${row.date ? row.date.split('T')[0] : ''}</div>
            <div><strong>Flour Mill:</strong> ${row.flour_mill_name || row.flour_mill || ''}</div>
          </div>
        </div>

        <div style="margin-bottom: 25px; background-color: #f1f5f9; padding: 15px; border-radius: 6px; border-left: 4px solid #475569;">
          <strong style="color: #334155; font-size: 14px; text-transform: uppercase;">Remarks:</strong>
          <p style="margin: 5px 0 0 0; font-size: 15px; color: #475569;">${row.remarks || 'No remarks recorded.'}</p>
        </div>

        <h3 style="color: #1f4fb2; border-bottom: 2px solid #cbd5e1; padding-bottom: 8px; margin-top: 30px; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px;">1. Input Items</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
          <thead>
            <tr style="background-color: #f1f5f9; color: #334155;">
              <th style="border: 1px solid #cbd5e1; padding: 10px; width: 60px; text-align: center;">S.No</th>
              <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: left;">Item Name</th>
              <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: left;">Lot No</th>
              <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; width: 100px;">Weight</th>
              <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; width: 80px;">Qty</th>
              <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; width: 120px;">Total Wt</th>
            </tr>
          </thead>
          <tbody>
            ${inputRows || '<tr><td colspan="6" style="text-align: center; padding: 15px; color: #64748b;">No input items recorded</td></tr>'}
            <tr style="font-weight: bold; background-color: #f8fafc; color: #1e3a8a;">
              <td colspan="5" style="border: 1px solid #cbd5e1; padding: 12px; text-align: right; font-size: 14px; text-transform: uppercase;">Total Input Weight:</td>
              <td style="border: 1px solid #cbd5e1; padding: 12px; text-align: right; font-size: 15px;">${inputTotal.toFixed(2)} kg</td>
            </tr>
          </tbody>
        </table>

        <h3 style="color: #1f4fb2; border-bottom: 2px solid #cbd5e1; padding-bottom: 8px; margin-top: 35px; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px;">2. Output Items (Finished Goods)</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
          <thead>
            <tr style="background-color: #f1f5f9; color: #334155;">
              <th style="border: 1px solid #cbd5e1; padding: 10px; width: 60px; text-align: center;">S.No</th>
              <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: left;">Output Item</th>
              <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: left;">Lot No</th>
              <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; width: 100px;">Weight</th>
              <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; width: 80px;">Qty</th>
              <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; width: 120px;">Total Wt</th>
            </tr>
          </thead>
          <tbody>
            ${outputRows || '<tr><td colspan="6" style="text-align: center; padding: 15px; color: #64748b;">No output items recorded</td></tr>'}
            <tr style="font-weight: bold; background-color: #f8fafc; color: #16a34a;">
              <td colspan="5" style="border: 1px solid #cbd5e1; padding: 12px; text-align: right; font-size: 14px; text-transform: uppercase;">Total Output Weight:</td>
              <td style="border: 1px solid #cbd5e1; padding: 12px; text-align: right; font-size: 15px;">${outputTotal.toFixed(2)} kg</td>
            </tr>
          </tbody>
        </table>

        <h3 style="color: #1f4fb2; border-bottom: 2px solid #cbd5e1; padding-bottom: 8px; margin-top: 35px; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px;">3. Wastage Items</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
          <thead>
            <tr style="background-color: #f1f5f9; color: #334155;">
              <th style="border: 1px solid #cbd5e1; padding: 10px; width: 60px; text-align: center;">S.No</th>
              <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: left;">Wastage Item</th>
              <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: left;">Lot No</th>
              <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; width: 100px;">Weight</th>
              <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; width: 80px;">Qty</th>
              <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; width: 120px;">Total Wt</th>
            </tr>
          </thead>
          <tbody>
            ${wastageRows || '<tr><td colspan="6" style="text-align: center; padding: 15px; color: #64748b;">No wastage items recorded</td></tr>'}
            <tr style="font-weight: bold; background-color: #f8fafc; color: #dc2626;">
              <td colspan="5" style="border: 1px solid #cbd5e1; padding: 12px; text-align: right; font-size: 14px; text-transform: uppercase;">Total Wastage Weight:</td>
              <td style="border: 1px solid #cbd5e1; padding: 12px; text-align: right; font-size: 15px;">${wastageTotal.toFixed(2)} kg</td>
            </tr>
          </tbody>
        </table>

        <div style="margin-top: 30px; background-color: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #cbd5e1;">
          <h3 style="margin: 0 0 15px 0; color: #1f4fb2; font-size: 15px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Grind Yield & Loss Balance Summary</h3>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; text-align: left;">
            <div style="padding: 10px; background-color: #e0e7ff; border-radius: 6px; border-left: 4px solid #4f46e5; font-size: 12px;">
              <strong style="color: #4338ca; text-transform: uppercase; font-size: 10px; display: block; margin-bottom: 4px;">TOTAL INPUT</strong>
              <span style="font-size: 15px; font-weight: bold; color: #1e1b4b;">${inputTotal.toFixed(2)} kg</span>
            </div>
            <div style="padding: 10px; background-color: #dcfce7; border-radius: 6px; border-left: 4px solid #16a34a; font-size: 12px;">
              <strong style="color: #15803d; text-transform: uppercase; font-size: 10px; display: block; margin-bottom: 4px;">FINISHED GOODS</strong>
              <span style="font-size: 15px; font-weight: bold; color: #064e3b;">${outputTotal.toFixed(2)} kg</span>
            </div>
            <div style="padding: 10px; background-color: #fee2e2; border-radius: 6px; border-left: 4px solid #ef4444; font-size: 12px;">
              <strong style="color: #991b1b; text-transform: uppercase; font-size: 10px; display: block; margin-bottom: 4px;">WASTAGE</strong>
              <span style="font-size: 15px; font-weight: bold; color: #7f1d1d;">${wastageTotal.toFixed(2)} kg</span>
            </div>
            <div style="padding: 10px; background-color: #ffedd5; border-radius: 6px; border-left: 4px solid #f97316; font-size: 12px;">
              <strong style="color: #c2410c; text-transform: uppercase; font-size: 10px; display: block; margin-bottom: 4px;">SHORTCOMING (LOSS)</strong>
              <span style="font-size: 15px; font-weight: bold; color: #7c2d12;">${(inputTotal - (outputTotal + wastageTotal)).toFixed(2)} kg</span>
            </div>
          </div>
        </div>
      </div>
    `;

    printHtml(html, `Grind Report - #${row.id}`);
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
