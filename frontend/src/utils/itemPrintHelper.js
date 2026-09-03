/**
 * itemPrintHelper.js
 * Generates structured, high-definition printable HTML for Item Master records.
 * Compatible with iframe/desktop printing via printHelper.js.
 */

export const buildItemPrintHtml = (item = {}, groupName = '') => {
  const itemCode = item.item_code || '-';
  const itemName = item.item_name || 'Untitled Item';
  const printName = item.print_name || item.item_name || '-';
  const group = groupName || item.item_group || item.group_name || '-';
  const itemType = item.type || item.category || 'Standard';
  const tax = item.tax !== undefined && item.tax !== null && item.tax !== '' ? `${item.tax}%` : '0%';
  const hsn = item.hsn_code || 'N/A';
  const minStock = item.min_stock || item.minimum_stock || '-';
  const maxStock = item.max_stock || item.maximum_stock || '-';
  const reorderLevel = item.reorder_level || '-';
  const unit = item.unit || item.uom || 'KGS';

  let specsHtml = '';
  let pObj = { categories: [], specs: {} };
  if (item.lab_parameters) {
    try {
      pObj = typeof item.lab_parameters === 'string' ? JSON.parse(item.lab_parameters) : item.lab_parameters;
    } catch (e) {
      pObj = { categories: [], specs: {} };
    }
  }
  const specs = pObj.specs || {};
  const specKeys = Object.keys(specs);

  if (specKeys.length > 0) {
    const rows = specKeys.map(key => {
      const s = specs[key] || {};
      return `<tr>
        <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 600;">${s.parameter || key}</td>
        <td style="padding: 6px 10px; border: 1px solid #cbd5e1;">${s.category || '-'}</td>
        <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: center; font-weight: 600;">${s.min !== undefined && s.min !== '' ? s.min : '-'}</td>
        <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: center; font-weight: 600;">${s.max !== undefined && s.max !== '' ? s.max : '-'}</td>
        <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: center;">${s.unit || '-'}</td>
        <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 11px;">${s.method || '-'}</td>
      </tr>`;
    }).join('');

    specsHtml = `
      <table style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px;">
        <thead>
          <tr style="background-color: #f1f5f9;">
            <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: left;">Testing Parameter</th>
            <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: left;">Category</th>
            <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">Min Bound</th>
            <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">Max Bound</th>
            <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">Unit</th>
            <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: left;">Reference Standard Method</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  } else {
    specsHtml = `
      <div style="text-align: center; padding: 14px; border: 1px dashed #94a3b8; color: #64748b; font-size: 12px; margin-top: 8px; border-radius: 4px;">
        No quality parameters or specification bounds configured for this item.
      </div>
    `;
  }

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; max-width: 850px; margin: 0 auto; padding: 12px; line-height: 1.4;">
      <!-- Company Header -->
      <div style="text-align: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 14px;">
        <h1 style="margin: 0; font-size: 22px; color: #1e3a8a; letter-spacing: 0.5px;">BVC EXPORTS PVT LTD</h1>
        <p style="margin: 4px 0; font-size: 13px; font-weight: bold; color: #475569;">QUALITY STANDARDS &amp; MATERIAL SPECIFICATIONS DIVISION</p>
        <p style="margin: 2px 0; font-size: 11px; color: #64748b;">Ref: BVC-ITM-STD-01 | ISO 9001:2015 CERTIFIED</p>
      </div>

      <!-- Document Title -->
      <div style="background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px 12px; font-weight: bold; font-size: 13px; text-align: center; margin-bottom: 16px; color: #1e3a8a; text-transform: uppercase;">
        Material Specification &amp; Technical Master Sheet
      </div>

      <!-- Item Primary Info Grid -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; font-size: 13px;">
        <div style="background: #f8fafc; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 4px;">
          <div style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 600;">Item Code / ID</div>
          <div style="font-weight: bold; color: #0f172a; margin-top: 2px; font-size: 14px;">${itemCode}</div>
        </div>
        <div style="background: #f8fafc; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 4px;">
          <div style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 600;">Item Name</div>
          <div style="font-weight: bold; color: #0f172a; margin-top: 2px; font-size: 14px;">${itemName}</div>
        </div>
        <div style="background: #f8fafc; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 4px;">
          <div style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 600;">Invoice / Print Name</div>
          <div style="font-weight: 600; color: #0f172a; margin-top: 2px;">${printName}</div>
        </div>
        <div style="background: #f8fafc; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 4px;">
          <div style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 600;">Commodity Group</div>
          <div style="font-weight: 600; color: #0f172a; margin-top: 2px;">${group}</div>
        </div>
        <div style="background: #f8fafc; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 4px;">
          <div style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 600;">Classification / Type</div>
          <div style="font-weight: 600; color: #0f172a; margin-top: 2px;">${itemType}</div>
        </div>
        <div style="background: #f8fafc; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 4px;">
          <div style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 600;">Tax &amp; HSN Code</div>
          <div style="font-weight: 600; color: #0f172a; margin-top: 2px;">${tax} | HSN: ${hsn}</div>
        </div>
      </div>

      <!-- Inventory Stock Controls -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; font-size: 12px;">
        <div style="background: #f8fafc; padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 4px; text-align: center;">
          <div style="font-size: 10px; color: #64748b; text-transform: uppercase;">Standard Unit</div>
          <div style="font-weight: bold; color: #0f172a; margin-top: 2px;">${unit}</div>
        </div>
        <div style="background: #f8fafc; padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 4px; text-align: center;">
          <div style="font-size: 10px; color: #64748b; text-transform: uppercase;">Min Stock</div>
          <div style="font-weight: bold; color: #0f172a; margin-top: 2px;">${minStock}</div>
        </div>
        <div style="background: #f8fafc; padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 4px; text-align: center;">
          <div style="font-size: 10px; color: #64748b; text-transform: uppercase;">Max Stock</div>
          <div style="font-weight: bold; color: #0f172a; margin-top: 2px;">${maxStock}</div>
        </div>
        <div style="background: #f8fafc; padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 4px; text-align: center;">
          <div style="font-size: 10px; color: #64748b; text-transform: uppercase;">Reorder Level</div>
          <div style="font-weight: bold; color: #0f172a; margin-top: 2px;">${reorderLevel}</div>
        </div>
      </div>

      <!-- Lab Quality Specifications Table -->
      <div style="margin-bottom: 20px;">
        <div style="font-size: 12px; font-weight: bold; text-transform: uppercase; color: #1e3a8a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">
          Laboratory Quality Bounds &amp; Reference Methods
        </div>
        ${specsHtml}
      </div>

      <!-- Remarks if available -->
      ${item.remarks || item.description ? `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px 12px; margin-bottom: 20px; font-size: 12px;">
          <strong style="color: #475569;">Remarks / Notes:</strong> ${item.remarks || item.description}
        </div>
      ` : ''}

      <!-- Signatures -->
      <div style="display: flex; justify-content: space-between; margin-top: 36px; padding-top: 14px;">
        <div style="text-align: center; width: 160px;">
          <div style="border-bottom: 1px solid #475569; height: 35px; margin-bottom: 6px;"></div>
          <span style="font-size: 11px; font-weight: bold; color: #334155;">Prepared By</span>
        </div>
        <div style="text-align: center; width: 160px;">
          <div style="border-bottom: 1px solid #475569; height: 35px; margin-bottom: 6px;"></div>
          <span style="font-size: 11px; font-weight: bold; color: #334155;">QC Analyst</span>
        </div>
        <div style="text-align: center; width: 160px;">
          <div style="border-bottom: 1px solid #475569; height: 35px; margin-bottom: 6px;"></div>
          <span style="font-size: 11px; font-weight: bold; color: #334155;">Authorized Quality Head</span>
        </div>
      </div>
    </div>
  `;
};
