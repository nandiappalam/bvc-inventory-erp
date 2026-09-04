import * as XLSX from 'xlsx';
import { printHtml } from './printHelper';

/**
 * Convert any React element / JSX tree or primitives into valid, styled HTML string
 */
export function reactNodeToHtml(node) {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return '';
  }
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(reactNodeToHtml).join('');
  }
  if (typeof node === 'object') {
    // If it's a React element with props
    if (node.props) {
      const { children, style } = node.props;
      const innerHtml = children !== undefined ? reactNodeToHtml(children) : '';
      
      let tag = 'span';
      if (typeof node.type === 'string') {
        tag = node.type;
      }
      
      // Inline styles serialization
      let styleStr = '';
      if (style && typeof style === 'object') {
        styleStr = Object.entries(style)
          .filter(([_, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => {
            const cssKey = k.replace(/([A-Z])/g, '-$1').toLowerCase();
            return `${cssKey}:${v}`;
          })
          .join(';');
      }
      
      if (typeof node.type === 'string') {
        return `<${tag}${styleStr ? ` style="${styleStr}"` : ''}>${innerHtml}</${tag}>`;
      }
      // Fragment or component wrapper
      return innerHtml;
    }
    if (node.toString && node.toString !== Object.prototype.toString) {
      return node.toString();
    }
  }
  return '';
}

/**
 * Convert any React element / JSX tree into clean plain text (e.g. for Excel)
 */
export function reactNodeToText(node) {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return '';
  }
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(reactNodeToText).filter(Boolean).join(' ');
  }
  if (typeof node === 'object' && node.props) {
    return reactNodeToText(node.props.children);
  }
  return '';
}

/**
 * Export data array to an Excel (.xlsx) file
 */
export function exportToExcel(data, fileName = 'Export_Data', columns = null, sheetName = 'Sheet1') {
  if (!data || !Array.isArray(data) || data.length === 0) {
    alert('No data available to export to Excel.');
    return;
  }

  let formattedData = [];

  if (columns && Array.isArray(columns) && columns.length > 0) {
    // Filter out actions columns
    const activeCols = columns.filter(c => c.key !== 'actions' && c.key !== 'ACTIONS' && c.title !== 'ACTIONS' && c.title !== 'Actions');

    formattedData = data.map((row, idx) => {
      const formattedRow = {};
      activeCols.forEach(col => {
        const key = col.key || col.field || col.id;
        const title = col.title || col.label || col.headerName || key;
        if (!key) return;

        let val;
        if (typeof col.render === 'function') {
          const rendered = col.render(row[key], row, idx);
          if (typeof rendered === 'string' || typeof rendered === 'number') {
            val = rendered;
          } else if (rendered) {
            val = reactNodeToText(rendered);
          } else {
            val = row[key];
          }
        } else {
          val = row[key];
        }
        formattedRow[title] = val !== undefined && val !== null ? val : '';
      });
      return formattedRow;
    });
  } else {
    formattedData = data.map(row => {
      const cleanRow = {};
      Object.keys(row).forEach(k => {
        if (k !== 'id' && !k.endsWith('_id') && typeof row[k] !== 'object') {
          const formattedKey = k.replace(/_/g, ' ').toUpperCase();
          cleanRow[formattedKey] = row[k] !== null && row[k] !== undefined ? row[k] : '';
        }
      });
      return cleanRow;
    });
  }

  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Auto column widths
  const max_widths = [];
  formattedData.forEach(row => {
    Object.keys(row).forEach((key, colIdx) => {
      const valStr = String(row[key] || '');
      const keyStr = String(key);
      const len = Math.max(valStr.length, keyStr.length);
      max_widths[colIdx] = Math.max(max_widths[colIdx] || 10, len + 3);
    });
  });
  worksheet['!cols'] = max_widths.map(w => ({ wch: Math.min(w, 50) }));

  const dateStr = new Date().toISOString().split('T')[0];
  const cleanFileName = fileName.toLowerCase().endsWith('.xlsx') 
    ? fileName 
    : `${fileName.replace(/\s+/g, '_')}_${dateStr}.xlsx`;

  XLSX.writeFile(workbook, cleanFileName);
}

/**
 * Print entire table list with company header, date & record summary
 */
export function printTableList(title = 'Table Report', columns = [], data = [], metadata = {}) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    alert('No data available to print.');
    return;
  }

  const companyName = metadata.company || 'BVC Company';
  const defaultFY = (new Date().getMonth() >= 3 ? `${new Date().getFullYear()}-${new Date().getFullYear() + 1}` : `${new Date().getFullYear() - 1}-${new Date().getFullYear()}`);
  const fy = metadata.fy || defaultFY;
  const currentDate = new Date().toLocaleString();

  // Resolve active columns (exclude action buttons column)
  const activeCols = columns.filter(c => c.key !== 'actions' && c.key !== 'ACTIONS' && c.title !== 'ACTIONS' && c.title !== 'Actions');

  const headersHtml = activeCols.map(c => `
    <th style="border: 1px solid #1f4fb2; background-color: #1f4fb2; color: #ffffff; padding: 8px 10px; font-size: 12px; font-weight: bold; text-align: left; text-transform: uppercase; white-space: nowrap;">
      ${c.title || c.label || c.key}
    </th>
  `).join('');

  const rowsHtml = data.map((row, idx) => `
    <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
      ${activeCols.map(col => {
        let cellVal = row[col.key];
        let isHtml = false;
        if (col.render && typeof col.render === 'function') {
          const res = col.render(cellVal, row, idx);
          if (typeof res === 'string' || typeof res === 'number') {
            cellVal = res;
          } else if (res) {
            cellVal = reactNodeToHtml(res);
            isHtml = true;
          }
        }
        const displayVal = cellVal !== undefined && cellVal !== null ? String(cellVal) : '';
        const isNum = !isHtml && !isNaN(displayVal) && displayVal.trim() !== '' && !displayVal.startsWith('0') && displayVal.length < 15;
        return `
          <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-size: 12px; color: #1e293b; text-align: ${isNum ? 'right' : 'left'}; vertical-align: top;">
            ${displayVal}
          </td>
        `;
      }).join('')}
    </tr>
  `).join('');

  const html = `
    <div style="font-family: Arial, sans-serif; padding: 15px; color: #0f172a; max-width: 100%;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1f4fb2; padding-bottom: 12px; margin-bottom: 15px;">
        <div>
          <h2 style="margin: 0; color: #1f4fb2; font-size: 22px; font-weight: bold; letter-spacing: -0.5px;">${companyName}</h2>
          <p style="margin: 3px 0 0 0; font-size: 12px; color: #64748b;">Financial Year: ${fy} | ERP Master Report</p>
        </div>
        <div style="text-align: right;">
          <h3 style="margin: 0; color: #334155; font-size: 16px; font-weight: bold;">${title}</h3>
          <p style="margin: 3px 0 0 0; font-size: 11px; color: #64748b;">Generated on: ${currentDate}</p>
        </div>
      </div>

      <div style="margin-bottom: 10px; display: flex; justify-content: space-between; font-size: 12px; color: #475569;">
        <span><strong>Total Records:</strong> ${data.length}</span>
        ${metadata.filterInfo ? `<span><strong>Filters:</strong> ${metadata.filterInfo}</span>` : ''}
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 12px;">
        <thead>
          <tr>${headersHtml}</tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div style="margin-top: 30px; border-top: 1px solid #cbd5e1; padding-top: 10px; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8;">
        <span>BVC ERP System - ${title}</span>
        <span>Page 1 of 1</span>
      </div>
    </div>
  `;

  printHtml(html, `${title} - Table List`);
}
