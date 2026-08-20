import React from 'react';
import { UpdateButton, DeleteButton, PrintButton } from './Button';
import { printHtml } from '../../utils/printHelper';

/**
 * DataTable - Standardized table component
 */
export const DataTable = ({
  columns = [],
  data = [],
  onUpdate,
  onDelete,
  onPrint,
  loading = false,
  emptyMessage = 'No data available',
  showActions = true,
  actionColumnWidth = '180px',
  className = '',
  style = {}
}) => {
  const tableContainerStyle = {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    overflow: 'hidden',
    ...style
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
  };

  const theadStyle = {
    backgroundColor: '#1565C0',
    color: '#ffffff',
  };

  const thStyle = {
    padding: '12px 16px',
    textAlign: 'left',
    fontWeight: 'bold',
    fontSize: '13px',
    borderBottom: '2px solid #0D47A1',
    whiteSpace: 'nowrap',
  };

  const tdStyle = {
    padding: '12px 16px',
    borderBottom: '1px solid #e0e0e0',
    color: '#333333',
  };

  const trHoverStyle = {
    backgroundColor: '#f5f9ff',
    transition: 'background-color 0.2s',
  };

  const actionsCellStyle = {
    textAlign: 'center',
    padding: '8px',
    width: actionColumnWidth,
    whiteSpace: 'nowrap',
  };

  const loadingStyle = {
    textAlign: 'center',
    padding: '40px',
    color: '#666666',
    fontSize: '16px',
  };

  const emptyStyle = {
    textAlign: 'center',
    padding: '40px',
    color: '#999999',
    fontSize: '14px',
  };

  const handlePrint = (row) => {
    if (onPrint) {
      onPrint(row);
    } else {
      // Default print behavior using safe printHtml
      const html = `<pre>${JSON.stringify(row, null, 2)}</pre>`;
      printHtml(html, "Record Detail");
    }
  };

  const handleDelete = (row) => {
    if (onDelete) {
      onDelete(row);
    } else {
      // Default delete behavior with confirmation
      if (window.confirm('Are you sure you want to delete this record?')) {
        console.log('Delete:', row);
      }
    }
  };

  return (
    <div style={tableContainerStyle} className={className}>
      {loading ? (
        <div style={loadingStyle}>Loading data...</div>
      ) : data.length === 0 ? (
        <div style={emptyStyle}>{emptyMessage}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead style={theadStyle}>
              <tr>
                <th style={{ ...thStyle, width: '50px' }}>S.No</th>
                {columns.map((col, idx) => (
                  <th key={idx} style={thStyle}>
                    {col.header}
                  </th>
                ))}
                {showActions && (
                  <th style={{ ...thStyle, width: actionColumnWidth, textAlign: 'center' }}>
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  style={rowIdx % 2 === 0 ? {} : { backgroundColor: '#fafafa' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f5f9ff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = rowIdx % 2 === 0 ? '#ffffff' : '#fafafa';
                  }}
                >
                  <td style={{ ...tdStyle, fontWeight: 'bold', color: '#1565C0' }}>
                    {rowIdx + 1}
                  </td>
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} style={tdStyle}>
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                  {showActions && (
                    <td style={actionsCellStyle}>
                      {onUpdate && (
                        <UpdateButton onClick={() => onUpdate(row)} />
                      )}
                      <PrintButton onClick={() => handlePrint(row)} />
                      {onDelete && (
                        <DeleteButton onClick={() => handleDelete(row)} />
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DataTable;
