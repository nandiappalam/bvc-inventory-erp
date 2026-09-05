import React from "react";

/**
 * EntryDisplayTable - Uniform table component for Entry display pages
 * Displays data with configurable columns and action buttons
 */
const EntryDisplayTable = ({ 
  columns = [], 
  data = [], 
  loading = false,
  onRowClick,
  customActions
}) => {
  // Default action buttons
  const defaultActions = (row) => (
    <>
      <button 
        style={styles.actionBtn} 
        onClick={(e) => {
          e.stopPropagation();
          if (row.onUpdate) row.onUpdate(row);
        }}
      >
        Update
      </button>
      <button 
        style={styles.printBtn} 
        onClick={(e) => {
          e.stopPropagation();
          if (row.onPrint) row.onPrint(row);
        }}
      >
        Print
      </button>
      <button 
        style={styles.deleteBtn} 
        onClick={(e) => {
          e.stopPropagation();
          if (row.onDelete) row.onDelete(row);
        }}
      >
        Delete
      </button>
    </>
  );

  if (loading) {
    return (
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} style={styles.th}>{col.title}</th>
              ))}
              <th style={styles.th}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={columns.length + 1} style={styles.loading}>
                Loading...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div style={styles.tableWrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={styles.th}>{col.title}</th>
            ))}
            <th style={styles.th}>ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 1} style={styles.noData}>
                No records found
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr 
                key={row.id || idx} 
                style={onRowClick ? styles.clickableRow : styles.row}
                onClick={() => onRowClick && onRowClick(row)}
              >
                {columns.map((col) => (
                  <td key={col.key} style={styles.td}>
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
                <td style={styles.actionsCell}>
                  {customActions ? customActions(row) : defaultActions(row)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

const styles = {
  tableWrapper: {
    padding: '0 20px 20px',
    overflow: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    background: '#fff',
    fontSize: '14px',
  },
  th: {
    background: '#66B4E3',
    color: '#fff',
    padding: '10px',
    textAlign: 'left',
    fontWeight: 'bold',
    border: '1px solid #666',
  },
  td: {
    padding: '8px',
    border: '1px solid #666',
  },
  row: {
    background: '#fff',
  },
  clickableRow: {
    background: '#fff',
    cursor: 'pointer',
  },
  actionsCell: {
    padding: '8px',
    textAlign: 'center',
    whiteSpace: 'nowrap',
  },
  actionBtn: {
    padding: '5px 12px',
    background: '#234D8B',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    marginRight: '5px'
  },
  printBtn: {
    padding: '5px 12px',
    background: '#3A6F32',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    marginRight: '5px'
  },
  deleteBtn: {
    padding: '5px 12px',
    background: '#dc3545',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px'
  },
  loading: {
    textAlign: 'center',
    padding: '20px',
    color: '#666',
  },
  noData: {
    textAlign: 'center',
    padding: '20px',
    color: '#999',
  },
};

export default EntryDisplayTable;
