import React, { useState, useEffect } from 'react';
import api from '../../services/api.js';
import { getMasters, safeArray, normalizeMasterKey } from '../../services/masterservice.js';

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
  weights: 'weightmaster',
  weight: 'weightmaster',
  flour_mills: 'flour_mill_master',
  flour_mill: 'flour_mill_master',
  papad_companies: 'papad_company_master',
  papad_company: 'papad_company_master',
  deductions: 'deduction_purchase',
  deduction_purchase: 'deduction_purchase',
  deduction_sales: 'deduction_sales',
  areas: 'area_master',
  cities: 'city_master',
  item_groups: 'item_groups'
};

const getOptionValue = (opt) => {
  if (opt === null || opt === undefined) return '';
  if (typeof opt === 'string' || typeof opt === 'number') return String(opt);
  if (opt.id !== undefined && opt.id !== null) return String(opt.id);
  if (opt.value !== undefined && opt.value !== null) return String(opt.value);
  return String(opt.name || opt.code || '');
};

const getOptionLabel = (opt) => {
  if (!opt) return '';
  if (typeof opt === 'string' || typeof opt === 'number') return String(opt);
  if (opt.label !== undefined && opt.label !== null && opt.label !== '') return String(opt.label);
  return (
    opt.name ||
    opt.supplier_name ||
    opt.customer_name ||
    opt.sender_name ||
    opt.consignee_name ||
    opt.transport_name ||
    opt.transporter ||
    opt.godown_name ||
    opt.flourmill ||
    opt.flour_mill_name ||
    opt.mill_name ||
    opt.papad_company ||
    opt.company_name ||
    opt.ledger_name ||
    opt.item_name ||
    opt.group_name ||
    opt.ded_name ||
    opt.deduction_name ||
    opt.print_name ||
    opt.printname ||
    opt.weight_name ||
    (opt.id !== undefined ? String(opt.id) : '') ||
    (opt.value !== undefined ? String(opt.value) : '')
  );
};

const MASTER_FIELD_TYPES = {
  supplier: 'suppliers',
  suppliers: 'suppliers',
  supplier_id: 'suppliers',
  supplierId: 'suppliers',
  supplierName: 'suppliers',
  supplier_name: 'suppliers',
  customer: 'customers',
  customers: 'customers',
  customer_id: 'customers',
  customerId: 'customers',
  customerName: 'customers',
  customer_name: 'customers',
  exporter: 'customers',
  buyer_other: 'customers',
  item: 'items',
  items: 'items',
  item_id: 'items',
  itemId: 'items',
  itemName: 'items',
  item_name: 'items',
  godown: 'godowns',
  godowns: 'godowns',
  godown_id: 'godowns',
  godownId: 'godowns',
  godown_from: 'godowns',
  godown_to: 'godowns',
  godown_from_id: 'godowns',
  godown_to_id: 'godowns',
  from_godown_id: 'godowns',
  to_godown_id: 'godowns',
  transport: 'transports',
  transports: 'transports',
  transport_id: 'transports',
  transportId: 'transports',
  transporter: 'transports',
  transporters: 'transports',
  transporter_id: 'transports',
  pur_trans: 'transports',
  pur_transport: 'transports',
  ship_via: 'transports',
  weight: 'weights',
  weights: 'weights',
  weight_id: 'weights',
  weightId: 'weights',
  wt: 'weights',
  sender: 'senders',
  senders: 'senders',
  sender_id: 'senders',
  senderId: 'senders',
  sender_name: 'senders',
  consignee: 'consignees',
  consignees: 'consignees',
  consignee_id: 'consignees',
  consigneeId: 'consignees',
  consigned_to: 'consignees',
  consignee_name: 'consignees',
  papad_company: 'papad_companies',
  papad_companies: 'papad_companies',
  papadCompany: 'papad_companies',
  papadComp: 'papad_companies',
  papad_comp: 'papad_companies',
  papad_company_id: 'papad_companies',
  flour_mill: 'flour_mills',
  flour_mills: 'flour_mills',
  flourMill: 'flour_mills',
  flourmill: 'flour_mills',
  flour_mill_id: 'flour_mills',
  area: 'areas',
  areas: 'areas',
  area_id: 'areas',
  city: 'cities',
  cities: 'cities',
  city_id: 'cities',
  deduction: 'deductions',
  deductions: 'deductions',
  deduction_purchase: 'deductions',
  deduction_sales: 'deduction_sales'
};
const DEBUG = false;

const validateEntryConfig = (fields, columns) => true;

export const EntryTopFrame = ({ fields = [], data = {}, onChange = () => {}, columns: colCount = 3, taxType, taxRate, onTaxChange, nextSnoEndpoint, hideStockType = false }) => {
  const generateSno = () => '1';

  // Check if we are in Edit / Update mode so existing records are never wiped
  const isEditMode = Boolean(
    data?.id || 
    window.location.pathname.includes('/edit') || 
    new URLSearchParams(window.location.search).get('id') || 
    new URLSearchParams(window.location.search).get('editId') ||
    new URLSearchParams(window.location.search).get('po_id')
  );

  // Unified onChange handler ensuring safe synthetic event and direct (name, value) calling
  const invokeOnChange = (name, value) => {
    if (typeof onChange === 'function') {
      const syntheticEvent = {
        target: { name, value },
        currentTarget: { name, value },
        name,
        value
      };
      onChange(syntheticEvent, value);
    }
    if (onTaxChange && (name === 'tax_type' || name === 'tax_rate')) {
      onTaxChange({ taxType: data.tax_type || 'Exclusive', taxRate: parseFloat(data.tax_rate) || 18 });
    }
  };

  useEffect(() => {
    if (isEditMode) return;

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
            invokeOnChange(fieldToSet, String(nextSno));
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
  }, [isEditMode]);

  useEffect(() => {
    if (isEditMode) return;
    if (!data.date) {
      invokeOnChange('date', new Date().toISOString().split('T')[0]);
    }
    const isAdvance = window.location.pathname.toLowerCase().includes('advance');
    if (!hideStockType && !isAdvance && !data.stock_type && !data.stockType) {
      invokeOnChange('stock_type', 'RM');
    }
  }, [isEditMode]);

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

    const isAdvance = window.location.pathname.toLowerCase().includes('advance');
    const shouldHideStockType = hideStockType || isAdvance;
    const hasStockType = updatedFields.some(f => f.name === 'stock_type' || f.name === 'stockType');
    if (!hasStockType && !shouldHideStockType) {
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
    const normName = String(field.name || '').toLowerCase();
    const masterKey = field.masterType || MASTER_FIELD_TYPES[field.name] || MASTER_FIELD_TYPES[normName];
    const isMaster = !!masterKey || field.type === 'master' || field.type === 'masterSelect';
    if (isMaster) {
      const resolvedMasterType = normalizeMasterKey(field.masterType || masterKey || field.name);
      return {
        ...field,
        type: 'master',
        masterType: resolvedMasterType || (field.name.endsWith('s') ? field.name : field.name + 's')
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
              onChange={invokeOnChange}
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

const MasterFieldWrapper = ({ field, data, onChange, autoFillFields = [], generateSno, api: apiProp }) => { 
  const normKey = normalizeMasterKey(field.masterType || field.name);
  const masterKeyFromTypes = MASTER_FIELD_TYPES[field.name] || MASTER_FIELD_TYPES[String(field.name || '').toLowerCase()];
  const isMasterField = field.type === 'master' || field.type === 'masterSelect' || !!field.masterType || !!masterKeyFromTypes;
  const isSelectField = field.type === 'select' || isMasterField || (Array.isArray(field.options) && field.options.length > 0);

  const [masterOptions, setMasterOptions] = useState(() => {
    if (Array.isArray(field.options) && field.options.length > 1) {
      return field.options;
    }
    return [];
  });
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

  const fetchMasterData = async (force = false) => {
    const key = normKey || normalizeMasterKey(masterKeyFromTypes) || normalizeMasterKey(field.name);
    if (!key) return;
    setLoading(true);
    try {
      const rawResult = await getMasters(key, { forceRefresh: force });
      if (!rawResult) return;
      const resultData = safeArray(rawResult.data || rawResult);
      if (resultData && resultData.length > 0) {
        setMasterOptions(resultData);
      } else if (!field.options || field.options.length <= 1) {
        setMasterOptions(resultData);
      }
    } catch (err) {
      console.error(`Error fetching master ${key}:`, err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isMasterField || MASTER_FIELD_TYPES[field.name] || MASTER_FIELD_TYPES[String(field.name || '').toLowerCase()]) {
      fetchMasterData();
    } else if (field.options && field.options.length > 0) {
      setMasterOptions(field.options);
    }
  }, [field.masterType, field.name, isMasterField]);

  const handleDropdownFocus = () => {
    if ((isMasterField || MASTER_FIELD_TYPES[field.name]) && masterOptions.length === 0 && !loading) {
      fetchMasterData(true);
    }
  };

  const handleMasterSelect = async (selectedVal, field) => {
    const key = normalizeMasterKey(field?.masterType || field?.name);
    if (!selectedVal || !key) return;

    try {
      const tableName = masterTableMap[key] || masterTableMap[field.masterType] || key;
      const apiClient = apiProp || api;
      const record = await apiClient(`/masters/record/${tableName}/${encodeURIComponent(selectedVal)}`);

      if (record) {
        // Only autofill 'address' for customers, suppliers, and papad companies.
        const isCustomer = key === 'customers' || field.name === 'customer_id' || field.name === 'customer' || field.name === 'customerId' || field.name === 'customerName';
        const isSupplier = key === 'suppliers' || field.name === 'supplier_id' || field.name === 'supplier' || field.name === 'supplierId' || field.name === 'supplierName';
        const isPapadComp = key === 'papad_companies' || field.name === 'papad_company' || field.name === 'papadCompany' || field.name === 'papadComp';

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
    const key = normalizeMasterKey(field.masterType || field.name);
    const isAutofillMaster = 
      key === 'customers' || field.name === 'customer_id' || field.name === 'customer' || field.name === 'customerId' || field.name === 'customerName' ||
      key === 'suppliers' || field.name === 'supplier_id' || field.name === 'supplier' || field.name === 'supplierId' || field.name === 'supplierName' ||
      key === 'papad_companies' || field.name === 'papad_company' || field.name === 'papadCompany' || field.name === 'papadComp';

    if (value && isAutofillMaster) {
      await handleMasterSelect(value, field);
    }
  };

  const effectiveOptions = (field.options && Array.isArray(field.options) && field.options.length > 0)
    ? field.options
    : (masterOptions || []);

  if (isSelectField || field.masterType || effectiveOptions.length > 0) {
    let rawVal = (data[field.name] !== undefined && data[field.name] !== null) ? String(data[field.name]) : '';
    if (!rawVal) {
      if (field.name.includes('_')) {
        const camel = field.name.replace(/_([a-z])/g, (_, g) => g.toUpperCase());
        if (data[camel] !== undefined && data[camel] !== null) rawVal = String(data[camel]);
      } else {
        const snake = field.name.replace(/([A-Z])/g, '_$1').toLowerCase();
        if (data[snake] !== undefined && data[snake] !== null) rawVal = String(data[snake]);
      }
    }
    if (!rawVal) {
      if (['supplier_id', 'supplierId', 'supplier'].includes(field.name)) {
        rawVal = String(data.supplier_id || data.supplierId || data.supplier || data.supplierName || data.supplier_name || '');
      } else if (['customer_id', 'customerId', 'customer'].includes(field.name)) {
        rawVal = String(data.customer_id || data.customerId || data.customer || data.customerName || data.customer_name || '');
      } else if (['godown_id', 'godownId', 'godown'].includes(field.name)) {
        rawVal = String(data.godown_id || data.godownId || data.godown || data.godownName || data.godown_name || '');
      } else if (['transport_id', 'transportId', 'transporter', 'transport'].includes(field.name)) {
        rawVal = String(data.transporter || data.transport || data.transport_id || data.transportId || '');
      }
    }
    let selectValue = rawVal;
    
    if (rawVal && effectiveOptions.length > 0) {
      const match = effectiveOptions.find(opt => {
        const optVal = getOptionValue(opt);
        const optLabel = getOptionLabel(opt);
        return String(optVal).toLowerCase() === rawVal.toLowerCase() ||
               String(optLabel).toLowerCase() === rawVal.toLowerCase();
      });
      if (match) {
        selectValue = getOptionValue(match);
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
          onFocus={handleDropdownFocus}
          style={{
            ...styles.input,
            cursor: (field.disabled || field.readOnly) ? 'not-allowed' : 'pointer',
            backgroundColor: (field.disabled || field.readOnly) ? '#f4f6fa' : '#ffffff'
          }}
          disabled={field.disabled || field.readOnly}
          className="form-control form-select"
        >
          <option value="">Select...</option>
          {selectValue && !effectiveOptions.some(opt => String(getOptionValue(opt)).toLowerCase() === String(selectValue).toLowerCase()) && (
            <option value={selectValue}>
              {data[field.name + '_name'] || data[field.name + 'Name'] || data.supplierName || data.supplier_name || data.customerName || data.customer_name || data.godownName || data.godown_name || selectValue}
            </option>
          )}
          {effectiveOptions.map((opt, idx) => {
            const optVal = getOptionValue(opt);
            const optLabel = getOptionLabel(opt);
            return (
              <option key={`${optVal || 'opt'}-${idx}`} value={optVal}>
                {optLabel}
              </option>
            );
          })}
        </select>
      </div>
    );
  }

  if (isTextarea) {
    let rawTextValue = data[field.name] !== undefined && data[field.name] !== null ? data[field.name] : '';
    if (!rawTextValue) {
      if (field.name === 'address') {
        rawTextValue = data.supplier_details || data.supplierDetails || data.customer_details || data.party_details || '';
      } else if (field.name === 'supplier_details' || field.name === 'supplierDetails') {
        rawTextValue = data.address || '';
      }
    }
    return (
      <div className="entry-top-field-group" style={{ ...styles.fieldGroup, alignItems: 'flex-start', minHeight: '52px' }}>
        <label style={{ ...styles.label, paddingTop: '4px' }}>{field.label}</label>
        <span style={{ ...styles.colon, paddingTop: '4px' }}>:</span>
        <textarea
          name={field.name}
          value={rawTextValue || ''}
          onChange={(e) => onChange(field.name, e.target.value)}
          readOnly={field.readOnly}
          style={{ ...styles.input, height: '48px', minHeight: '48px', resize: 'vertical', fontFamily: 'inherit', padding: '4px 6px' }}
        />
      </div>
    );
  }

  let rawInputValue = data[field.name] !== undefined && data[field.name] !== null ? data[field.name] : '';
  if (!rawInputValue && field.name.includes('_')) {
    const camel = field.name.replace(/_([a-z])/g, (_, g) => g.toUpperCase());
    if (data[camel] !== undefined && data[camel] !== null) rawInputValue = data[camel];
  } else if (!rawInputValue) {
    const snake = field.name.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (data[snake] !== undefined && data[snake] !== null) rawInputValue = data[snake];
  }

  if (field.type === 'date' && rawInputValue) {
    rawInputValue = String(rawInputValue).split('T')[0].split(' ')[0];
  }

  return (
    <div className="entry-top-field-group" style={styles.fieldGroup}>
      <label style={styles.label}>{field.label}</label>
      <span style={styles.colon}>:</span>
      <input
        type={field.type || 'text'}
        name={field.name}
        value={rawInputValue || ''}
        onChange={(e) => onChange(field.name, e.target.value)}
        readOnly={field.readOnly}
        style={field.readOnly ? { ...styles.input, backgroundColor: '#f4f6fa', color: '#1f3f67' } : styles.input}
      />
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
