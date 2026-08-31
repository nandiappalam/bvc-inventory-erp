import React from 'react';

/**
 * EntryBottomSummary - Summary section for Entry pages
 * Shows additional summary information below the main table
 * Styled with Blue & White theme
 * 
 * @param {Array} items - Array of summary items { label, value, isAmount }
 * @param {String} title - Optional title for the summary section
 * @param {Array} deductionFields - Optional deduction fields for input
 * @param {Object} formData - Form data object
 * @param {Function} onChange - Change handler
 */
export const EntryBottomSummary = ({ 
  items = [], 
  title = 'Summary',
  deductionFields = [],
  formData = {},
  onChange = () => {}
}) => {
  const handleChange = (name, value) => {
    onChange({ target: { name, value } });
  };

  return (
    <div className="bottom-summary" style={styles.container}>
      {title && <div style={styles.title}>{title}</div>}
      
      {/* Summary Items Grid */}
      <div style={styles.summaryGrid}>
        {items.map((item, index) => (
          <div key={index} style={styles.summaryItem}>
            <span style={styles.label}>{item.label}: </span>
            <span style={item.isAmount ? styles.amount : styles.value}>
              {item.isAmount ? '₹' : ''}{item.value?.toLocaleString() || '0'}
            </span>
          </div>
        ))}
      </div>

      {/* Deductions Section */}
      {deductionFields.length > 0 && (
        <div style={styles.deductionsSection}>
          <div style={styles.deductionsTitle}>Deductions</div>
          <div style={styles.deductionsGrid}>
            {deductionFields.map((field, index) => (
              <div key={index} style={styles.deductionItem}>
                <label style={styles.deductionLabel}>{field.label}</label>
                {field.readOnly ? (
                  <span style={styles.deductionValue}>
                    {field.value || '0'}
                  </span>
                ) : (
                  <input
                    type="text"
                    value={formData[field.name] || ''}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    style={styles.deductionInput}
                    placeholder={field.placeholder || ''}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '15px 20px',
    backgroundColor: '#e9eef7',
    borderTop: '2px solid #9fb6dd',
    marginTop: '10px',
  },
  title: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#1f3f67',
    marginBottom: '12px',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '15px',
  },
  summaryItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '10px 15px',
    backgroundColor: '#ffffff',
    borderRadius: '4px',
    border: '1px solid #c7d6f3',
  },
  label: {
    fontSize: '13px',
    color: '#666666',
  },
  value: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#333333',
  },
  amount: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#1f4fb2',
  },
  // Deductions styles
  deductionsSection: {
    marginTop: '15px',
    paddingTop: '15px',
    borderTop: '1px solid #9fb6dd',
  },
  deductionsTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#1f3f67',
    marginBottom: '12px',
  },
  deductionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '15px',
  },
  deductionItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  deductionLabel: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#1f3f67',
  },
  deductionInput: {
    padding: '8px 12px',
    border: '1px solid #7fa1d6',
    borderRadius: '4px',
    fontSize: '13px',
    backgroundColor: '#ffffff',
  },
  deductionValue: {
    padding: '8px 12px',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#1f4fb2',
    backgroundColor: '#ffffff',
    borderRadius: '4px',
    border: '1px solid #c7d6f3',
  },
};

export default EntryBottomSummary;
