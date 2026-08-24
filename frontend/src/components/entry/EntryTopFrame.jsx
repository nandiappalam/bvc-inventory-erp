import React, { useState, useEffect } from 'react';
import api from '../../services/api.js';
import { getMasters, safeArray } from '../../services/masterservice.js';

const masterTableMap = {
  suppliers: 'supplier_master',
  customers: 'customer_master',
  items: 'item_master',
  godowns: 'godown_master',
  godown: 'godown_master',
  senders: 'sender_group_master',
  sender: 'sender_group_master',
  consignees: 'consignee_group_master',
  consignee: 'consignee_group_master',
  transports: 'transport_master',
  transport: 'transport_master',
  papad_companies: 'papad_company_master',
  papad_company: 'papad_company_master',
};

const getOptionLabel = (opt) => {
  if (!opt) return '';
  return (
    opt.name ||
    opt.sender_name ||
    opt.consignee_name ||
    opt.transport_name ||
    opt.godown_name ||
    opt.flourmill ||
    opt.papad_company ||
    opt.company_name ||
    opt.ledger_name ||
    opt.item_name ||
    opt.print_name ||
    opt.label ||
    String(opt.id || '')
  );
};

const MASTER_FIELD_TYPES = {};
const DEBUG = false;

const validateEntryConfig = (fields, columns) => true;

export const EntryTopFrame = ({ fields = [], data = {}, onChange = () => {}, columns: colCount = 3, taxType, taxRate, onTaxChange, nextSnoEndpoint }) => {
  const generateSno = () => '1';

  useEffect(() => {
    // Auto-fetch next purchase/flour-out S.No only for creation mode.
    const fetchNext = async () => {
      try {
        let endpoint = nextSnoEndpoint;
        if (!endpoint) {
          const path = window.location.pathname.toLowerCase();
          if (path.includes('purchase-order') || path.includes('purchase_order')) {
            endpoint = '/purchase-orders/next-sno';
          } else if (path.includes('flour-out')) {
            endpoint = '/flour-out/next-sno';
          } else if (path.includes('sales-export')) {
            endpoint = '/sales-export-orders/next-sno';
          } else if (path.includes('sales')) {
            endpoint = '/sales/next-sno';
          } else {
            endpoint = '/purchases/next-sno';
          }
        }
        const snoRes = await api(endpoint);
        const nextSno = snoRes?.next_sno ?? snoRes?.sNo ?? snoRes?.s_no ?? snoRes?.data?.s_no ?? snoRes?.data?.next_sno ?? snoRes?.data?.sNo;
        if (nextSno !== undefined && nextSno !== null && String(nextSno) !== '') {
          let fieldToSet = 's_no';
          if (data.sNo !== undefined || fields.some(f => f.name === 'sNo')) {
            fieldToSet = 'sNo';
          } else if (data.sno !== undefined || fields.some(f => f.name === 'sno')) {
            fieldToSet = 'sno';
          } else if (data.billNo !== undefined || fields.some(f => f.name === 'billNo')) {
            fieldToSet = 'billNo';
          } else if (data.bill_no !== undefined || fields.some(f => f.name === 'bill_no')) {
            fieldToSet = 'bill_no';
          }
          
          if (!data[fieldToSet]) {
            onChange({ target: { name: fieldToSet, value: String(nextSno) } });
          }
        }
      } catch (err) {
        console.error('Failed to fetch next sequential s_no:', err);
      }
    };

    let fieldToCheck = 's_no';
    if (data.sNo !== undefined || fields.some(f => f.name === 'sNo')) {
      fieldToCheck = 'sNo';
    } else if (data.sno !== undefined || fields.some(f => f.name === 'sno')) {
      fieldToCheck = 'sno';
    } else if (data.billNo !== undefined || fields.some(f => f.name === 'billNo')) {
      fieldToCheck = 'billNo';
    } else if (data.bill_no !== undefined || fields.some(f => f.name === 'bill_no')) {
      fieldToCheck = 'bill_no';
    }

    if (!data || !data[fieldToCheck]) {
      fetchNext();
    }
  }, []);

  useEffect(() => {
    if (!data.date) {
      onChange({ target: { name: 'date', value: new Date().toISOString().split('T')[0] } });
    }
    if (!data.stock_type && !data.stockType) {
      onChange({ target: { name: 'stock_type', value: 'RM' } });
    }
  }, []);

  const userHasExplicitCols = fields.some(f => f && f.col !== undefined && f.col !== null);

  const normalizeFields = (rawFields) => {
    let hasSno = false;

    const filtered = rawFields.filter(f => f);

    const updatedFields = filtered.map((field) => {
      if (field.name === 'sno' || field.name === 's_no' || field.name === 'sNo' || field.name === 'billNo' || field.name === 'bill_no') {
        hasSno = true;
        return {
          ...field,
          type: field.type || 'auto',
          readOnly: field.readOnly !== undefined ? field.readOnly : true,
          col: field.col || (userHasExplicitCols ? 1 : undefined)
        };
      }
      return field;
    });

    if (!hasSno) {
      updatedFields.unshift({
        name: 's_no',
        label: 'S.No',
        type: 'auto',
        readOnly: true,
        col: userHasExplicitCols ? 1 : undefined
      });
    }

    const hasStockType = updatedFields.some(f => f.name === 'stock_type' || f.name === 'stockType');
    if (!hasStockType) {
      updatedFields.push({
        name: 'stock_type',
        label: 'Stock Type',
        type: 'select',
        options: [
          { value: 'RM', label: 'RM (Raw Material)' },
          { value: 'FG', label: 'FG (Finished Goods)' },
          { value: 'Vacuum', label: 'Vacuum' }
        ],
        col: userHasExplicitCols ? 1 : undefined
      });
    }

    return updatedFields;
  };

  const normalizedFields = normalizeFields(fields);
  const processedFields = normalizedFields.map(field => {
    const isMaster = field.masterType || Object.keys(MASTER_FIELD_TYPES).includes(field.name);
    if (isMaster && field.type !== 'master') {
      return {
        ...field,
        type: 'master',
        masterType: field.masterType || field.name + 's'
      };
    }
    return field;
  });

  validateEntryConfig(processedFields, []);

  const handleChange = (name, value) => {
    onChange({ target: { name, value } });
    if (onTaxChange && (name === 'tax_type' || name === 'tax_rate')) {
      onTaxChange({ taxType: data.tax_type || 'Exclusive', taxRate: parseFloat(data.tax_rate) || 18 });
    }
  };

  // Group fields into columns based on explicit field.col OR smart auto-balanced vertical distribution
  const maxExplicitCol = userHasExplicitCols ? Math.max(...processedFields.map(f => f.col || 1)) : colCount;
  const numCols = Math.max(colCount || 3, maxExplicitCol);

  const columnsGrid = Array.from({ length: numCols }, () => []);

  if (userHasExplicitCols) {
    processedFields.forEach((field) => {
      const colIdx = Math.min(Math.max((field.col || 1) - 1, 0), numCols - 1);
      columnsGrid[colIdx].push(field);
    });
  } else {
    // Smart vertical distribution if no explicit `col` assigned
    const partyNames = [
      'customer', 'customer_id', 'supplier', 'supplier_id', 'address', 'phone', 
      'sender', 'sender_id', 'consignee', 'consignee_id', 'consigned_to',
      'papad_company', 'papadCompany', 'papadComp', 'flour_mill', 'flourMill',
      'godown_id', 'godown'
    ];
    const leftNames = [
      's_no', 'sNo', 'sno', 'bill_no', 'billNo', 'date', 'pay_type', 'payType', 'tax_type', 'taxType'
    ];

    const leftFields = [];
    const partyFields = [];
    const midFields = [];

    processedFields.forEach((field) => {
      if (leftNames.includes(field.name)) {
        leftFields.push(field);
      } else if (partyNames.includes(field.name)) {
        partyFields.push(field);
      } else {
        midFields.push(field);
      }
    });

    if (numCols === 2) {
      columnsGrid[0] = [...leftFields, ...midFields];
      columnsGrid[1] = partyFields;
    } else if (numCols === 3) {
      columnsGrid[0] = leftFields;
      columnsGrid[1] = midFields;
      columnsGrid[2] = partyFields;
    } else {
      // 4 or more columns
      columnsGrid[0] = leftFields;
      const midChunk = Math.ceil(midFields.length / Math.max(1, numCols - 2));
      for (let i = 0; i < numCols - 2; i++) {
        columnsGrid[i + 1] = midFields.slice(i * midChunk, (i + 1) * midChunk);
      }
      columnsGrid[numCols - 1] = partyFields;
    }

    // Safeguard check: If any column is empty OR max-min imbalance > 2, perform balanced sequential chunking
    const colLengths = columnsGrid.map(c => c.length);
    const minColLen = Math.min(...colLengths);
    const maxColLen = Math.max(...colLengths);

    if (minColLen === 0 || (maxColLen - minColLen > 2)) {
      const freshGrid = Array.from({ length: numCols }, () => []);
      const chunkSize = Math.ceil(processedFields.length / numCols);
      processedFields.forEach((field, index) => {
        const targetCol = Math.min(Math.floor(index / chunkSize), numCols - 1);
        freshGrid[targetCol].push(field);
      });
      for (let c = 0; c < numCols; c++) {
        columnsGrid[c] = freshGrid[c];
      }
    }
  }

  return (
    <div className="info-bar entry-top-frame-bar" style={{ ...styles.infoBar, gridTemplateColumns: `repeat(${numCols}, 1fr)` }}>
      {columnsGrid.map((colFields, colIdx) => (
        <div key={`col-${colIdx}`} className="info-bar-column" style={styles.column}>
          {colFields.map((field) => (
            <MasterFieldWrapper 
              key={field.name} 
              field={field} 
              data={data}
              onChange={handleChange}
              autoFillFields={field.autoFillFields || []}
              generateSno={generateSno}
              api={api}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

const MasterFieldWrapper = ({ field, data, onChange, autoFillFields = [], generateSno, api }) => { 
  const [masterOptions, setMasterOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  const isTextarea = field.type === 'textarea' || field.name === 'address' || field.name === 'remarks';

  if (field.type === 'auto') {
    return (
      <div className="entry-top-field-group" style={styles.fieldGroup}>
        <label style={styles.label}>{field.label}</label>
        <span style={styles.colon}>:</span>
        <input
          type="text"
          value={data[field.name] || data.sno || data.s_no || data.sNo || data.billNo || data.bill_no || ''}
          readOnly
          style={{ ...styles.input, backgroundColor: '#f4f6fa', color: '#1f3f67', fontWeight: 'bold' }}
          className="form-control"
        />
      </div>
    );
  }

  useEffect(() => {
    if (field.masterType) {
      const fetchMasterData = async () => {
        setLoading(true);
        try {
          const rawResult = await getMasters(field.masterType);
          if (!rawResult) return;
          const resultData = safeArray(rawResult.data || rawResult);
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

  const handleMasterSelect = async (id, field) => {
    if (!id || !field?.masterType) return;

    try {
      const tableName = masterTableMap[field.masterType] || field.masterType;
      const record = await api(`/masters/record/${tableName}/${id}`);

      if (record) {
        // Only autofill 'address' for customers, suppliers, and papad companies.
        // Senders and Consignees must NOT overwrite the customer's address.
        const isCustomer = field.masterType === 'customers' || field.name === 'customer_id' || field.name === 'customer' || field.name === 'customerId' || field.name === 'customerName';
        const isSupplier = field.masterType === 'suppliers' || field.name === 'supplier_id' || field.name === 'supplier' || field.name === 'supplierId' || field.name === 'supplierName';
        const isPapadComp = field.masterType === 'papad_companies' || field.name === 'papad_company' || field.name === 'papadCompany' || field.name === 'papadComp';

        if (isCustomer || isSupplier) {
          const partyName = record.name || record.supplier_name || record.customer_name || '';
          const contactPerson = record.contact_person || record.contactPerson || '';
          const addressLine = record.address || record.address1 || '';
          const area = record.area || '';
          const phone = record.phone || record.phone_res || record.mobile || record.phone_off || '';
          const email = record.email || '';
          const gstNo = record.gst_no || record.tin_no || record.gstNo || '';

          const details = [
            partyName && `Name : ${partyName}`,
            contactPerson && `Contact Person : ${contactPerson}`,
            addressLine && `Address : ${addressLine}`,
            area && `Area : ${area}`,
            phone && `Phone : ${phone}`,
            email && `Email : ${email}`,
            gstNo && `GST/TIN No : ${gstNo}`
          ].filter(Boolean).join('\n');

          if (details) {
            onChange('address', details);
          }
          if (isSupplier && partyName) {
            onChange('supplierName', partyName);
            onChange('supplier_name', partyName);
          }
          if (isCustomer && partyName) {
            onChange('customerName', partyName);
            onChange('customer_name', partyName);
          }
        } else if (isPapadComp) {
          const name = record.name || '';
          const contactPerson = record.contact_person || '';
          const addressLine = [record.address, record.address1, record.address2, record.address3, record.address4]
            .filter(Boolean)
            .join(', ') || record.address || '';
          const phone = record.mobile || record.mobile1 || record.phone_off || record.phone_res || '';
          const email = record.email || '';
          
          onChange(
            'address',
            `Name : ${name}\nContact Person : ${contactPerson}\nAddress : ${addressLine}\nPhone : ${phone}\nEmail : ${email}`
          );
        }
      }
    } catch (err) {
      console.error(`${field.masterType} autofill failed:`, err);
    }
  };

  const handleChange = async (e) => {
    const value = e.target.value;
    onChange(field.name, value);
    const isAutofillMaster = 
      field.masterType === 'customers' || field.name === 'customer_id' || field.name === 'customer' || field.name === 'customerId' || field.name === 'customerName' ||
      field.masterType === 'suppliers' || field.name === 'supplier_id' || field.name === 'supplier' || field.name === 'supplierId' || field.name === 'supplierName' ||
      field.masterType === 'papad_companies' || field.name === 'papad_company' || field.name === 'papadCompany' || field.name === 'papadComp';

    if (value && isAutofillMaster) {
      await handleMasterSelect(value, field);
    }
  };

  if (field.masterType) {
    let selectValue = (data[field.name] !== undefined && data[field.name] !== null) ? String(data[field.name]) : '';
    if (selectValue && masterOptions.length > 0) {
      const isValidId = masterOptions.some(opt => String(opt.id) === selectValue);
      if (!isValidId) {
        const found = masterOptions.find(opt => 
          getOptionLabel(opt).toLowerCase() === selectValue.toLowerCase()
        );
        if (found) {
          selectValue = String(found.id);
        }
      }
    }

    return (
      <div className="entry-top-field-group" style={styles.fieldGroup}>
        <label style={styles.label}>{field.label}</label>
        <span style={styles.colon}>:</span>
        <select
          name={field.name}
          value={selectValue}
          onChange={handleChange}
          style={styles.input}
          disabled={loading}
        >
          <option value="">Select...</option>
          {masterOptions.map((opt, idx) => (
            <option key={`${opt.id || 'opt'}-${idx}`} value={opt.id}>
              {getOptionLabel(opt)}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (isTextarea) {
    return (
      <div className="entry-top-field-group" style={{ ...styles.fieldGroup, alignItems: 'flex-start', minHeight: '52px' }}>
        <label style={{ ...styles.label, paddingTop: '4px' }}>{field.label}</label>
        <span style={{ ...styles.colon, paddingTop: '4px' }}>:</span>
        <textarea
          name={field.name}
          value={data[field.name] || ''}
          onChange={(e) => onChange(field.name, e.target.value)}
          readOnly={field.readOnly}
          style={{ ...styles.input, height: '48px', minHeight: '48px', resize: 'vertical', fontFamily: 'inherit', padding: '4px 6px' }}
        />
      </div>
    );
  }

  return (
    <div className="entry-top-field-group" style={styles.fieldGroup}>
      <label style={styles.label}>{field.label}</label>
      <span style={styles.colon}>:</span>
      {field.type === 'select' ? (
        <select
          name={field.name}
          value={data[field.name] || ''}
          onChange={(e) => onChange(field.name, e.target.value)}
          style={styles.input}
        >
          {field.options?.map((opt, idx) => (
            <option key={`${opt.value || 'val'}-${idx}`} value={opt.value}>
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
          readOnly={field.readOnly}
          style={field.readOnly ? { ...styles.input, backgroundColor: '#f4f6fa', color: '#1f3f67' } : styles.input}
        />
      )}
    </div>
  );
};

const styles = {
  infoBar: {
    display: 'grid',
    gap: '10px 24px',
    padding: '14px 20px',
    borderBottom: '2px solid #9fb6dd',
    backgroundColor: '#e9eef7',
    boxSizing: 'border-box',
    width: '100%',
    alignItems: 'start',
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    width: '100%',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minHeight: '26px',
    boxSizing: 'border-box',
    margin: '1px 0',
  },
  label: {
    width: '105px',
    minWidth: '105px',
    maxWidth: '105px',
    fontSize: '11.5px',
    fontWeight: '600',
    color: '#1f3f67',
    marginRight: '0px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    lineHeight: '1.2',
    textAlign: 'left',
  },
  colon: {
    width: '12px',
    minWidth: '12px',
    maxWidth: '12px',
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#1f3f67',
    fontSize: '12px',
    marginRight: '6px',
    flexShrink: 0,
  },
  input: {
    flex: 1,
    minWidth: '80px',
    width: '100%',
    height: '28px',
    boxSizing: 'border-box',
    padding: '3px 8px',
    border: '1px solid #7fa1d6',
    borderRadius: '3px',
    fontSize: '12px',
    lineHeight: '1.2',
    backgroundColor: '#ffffff',
    color: '#1a1a1a',
    outline: 'none',
  },
};

export default EntryTopFrame;
