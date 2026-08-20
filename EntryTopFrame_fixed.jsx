import React, { useState, useEffect } from 'react';
import { executeQuery } from '../../utils/api';

/**
 * EntryTopFrame - 3 or 4-column info bar for Entry pages
 * Used for header fields like S.No, Date, Remarks, etc.
 * Styled with Blue & White theme
 * 
 * @param {Array} fields - Array of field objects { label, name, value, onChange, type, options, masterType }
 * @param {Object} data - Form data object
 * @param {Function} onChange - Change handler function
 * @param {Number} columns - Number of columns (default 3)
 */

// Table name mapping for master types
const masterTableMap = {
  papad_companies: 'papad_company_master',
  suppliers: 'supplier_master',
  customers: 'customer_master',
  items: 'item_master',
  flour_mills: 'flour_mill_master',
  areas: 'area_master',
  weights: 'weightmaster',
  ledgers: 'ledgermaster',
  godowns: 'godown_master',
};

export const EntryTopFrame = ({ fields = [], data = {}, onChange = () => {}, columns: colCount = 3 }) => {
  // Group fields into columns
  const columns = Array.from({ length: colCount }, () => []);
  
  fields.forEach((field, index) => {
    columns[index % colCount].push(field);
  });

  const handleChange = (name, value) => {
    onChange({ target: { name, value } });
  };

  // Dynamic grid columns based on colCount
  const gridStyle = {
    ...styles.infoBar,
    gridTemplateColumns: `repeat(${colCount}, 1fr)`,
  };

  return (
    <div className="info-bar" style={gridStyle}>
      {columns.map((column, colIndex) => (
        <div key={colIndex} style={styles.column}>
          {column.map((field) => (
            <MasterFieldWrapper 
              key={field.name} 
              field={field} 
              data={data}
              onChange={handleChange}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

// MasterFieldWrapper - handles both regular selects and MasterDropdown
const MasterFieldWrapper = ({ field, data, onChange }) => {
  const [masterOptions, setMasterOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  // If field has masterType, fetch from Tauri
  useEffect(() => {
    if (field.masterType) {
      const fetchMasterData = async () => {
        setLoading(true);
        try {
          const tableName = masterTableMap[field.masterType] || field.masterType;
          const rawResult = await executeQuery(
            `SELECT * FROM ${tableName} WHERE (status = 'Active' OR status IS NULL OR status NOT IN ('Inactive')) ORDER BY id ASC`,
            []
          );
          const resultData = Array.isArray(rawResult) ? rawResult : (rawResult?.data || []);
          console.log(`[Master ${field.masterType}]`, resultData.length, 'options');
          setMasterOptions(resultData);
        } catch (err) {
          console.error(`Error fetching ${field.masterType}:`, err);
          setMasterOptions([]);
        } finally {
          setLoading(false);
        }
      };
      fetchMasterData();
    }
  }, [field.masterType]);

  // If masterType is specified, use dynamic dropdown
  if (field.masterType) {
    return (
      <div className="field-group" style={styles.fieldGroup}>
        <label style={styles.label}>{field.label}</label>
        <select
          name={field.name}
          value={data[field.name] || ''}
          onChange={(e) => onChange(field.name, e.target.value)}
          style={styles.input}
          disabled={loading}
        >
          <option value="">Select...</option>
          {masterOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name || opt.flourmill || opt.godown_name || opt.item_name || opt.supplier_name || opt.customer_name || String(opt.id)}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Regular select or input
  return (
    <div className="field-group" style={styles.fieldGroup}>
      <label style={styles.label}>{field.label}</label>
      {field.type === 'select' ? (
        <select
          name={field.name}
          value={data[field.name] || ''}
          onChange={(e) => onChange(field.name, e.target.value)}
          style={styles.input}
        >
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={field.type || 'text'}
          name={field.name}
          value={data[field.name] || ''}
          onChange={(e) => onChange(field.name, e.target.value)}
          style={styles.input}
        />
      )}
    </div>
  );
};

const styles = {
  infoBar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '20px',
    padding: '20px',
    borderBottom: '2px solid #9fb6dd',
    backgroundColor: '#e9eef7',
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  fieldGroup: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '8px',
  },
  label: {
    width: '80px',
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#1f3f67',
    marginRight: '8px',
  },
  input: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid #7fa1d6',
    borderRadius: '4px',
    fontSize: '13px',
    backgroundColor: '#ffffff',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
};

export default EntryTopFrame;
