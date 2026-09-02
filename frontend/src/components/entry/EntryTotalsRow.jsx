import React from 'react';

/**
 * EntryTotalsRow - Totals row for calculation display in Entry pages
 * Shows calculated totals like quantity, amount, etc.
 * Styled with Blue & White theme
 * 
 * @param {Array} totals - Array of total items { label, value, isAmount }
 */
export const EntryTotalsRow = ({ totals = [] }) => {
  return (
    <div className="totals-row" style={styles.totalsRow}>
      {totals.map((item, index) => (
        <div key={index} style={styles.totalItem}>
          <span style={styles.totalLabel}>{item.label}: </span>
          <span style={item.isAmount ? styles.totalAmount : styles.totalValue}>
            {item.isAmount ? '₹' : ''}{item.value?.toLocaleString() || '0'}
          </span>
        </div>
      ))}
    </div>
  );
};

const styles = {
  totalsRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '30px',
    padding: '15px 20px',
    backgroundColor: '#dbe7fb',
    borderTop: '2px solid #9fb6dd',
    borderBottom: '2px solid #9fb6dd',
  },
  totalItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  totalLabel: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#1f3f67',
  },
  totalValue: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#1f4fb2',
    minWidth: '80px',
    textAlign: 'right',
  },
  totalAmount: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#1f4fb2',
    minWidth: '120px',
    textAlign: 'right',
  },
};

export default EntryTotalsRow;
