import React from 'react';

// EntryDisplay - Generic entry display table
const EntryDisplay = ({
  title = 'Entry Display',
  data = [],
  columns = [],
  onDelete = () => {},
  customActions = null
}) => (
  <div className="display-container">
    <h2>{title}</h2>
    <table className="display-table">
      <thead>
        <tr>
          {columns.map((c, i) => (
            <th key={`header-${i}`}>{c.title}</th>
          ))}
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={row.id || `row-${i}`}>
            {columns.map((c, j) => (
              <td key={`cell-${i}-${j}`}>{row[c.key] || ''}</td>
            ))}
            <td>
              {customActions ? customActions(row) : (
                <button onClick={() => onDelete(row.id || row.s_no)}>
                  Delete
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default EntryDisplay;

