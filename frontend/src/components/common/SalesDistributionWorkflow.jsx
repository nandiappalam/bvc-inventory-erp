import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api.js';

export const SD_MODULES = [
  {
    id: 'quotation',
    stepNumber: '1',
    label: 'Quotation',
    createPath: '/entry/quotation-create',
    displayPath: '/entry/quotation-display',
    flowType: 'domestic',
    description: 'Price estimation & tax split quotation for prospective client'
  },
  {
    id: 'sales_order',
    stepNumber: '2',
    label: 'Sales Order',
    createPath: '/entry/sales-order-create',
    displayPath: '/entry/sales-order-display',
    flowType: 'domestic',
    description: 'Confirmed order commitment with delivery terms'
  },
  {
    id: 'sales',
    stepNumber: '3',
    label: 'Sales Invoice',
    createPath: '/entry/sales-create',
    displayPath: '/entry/sales-display',
    flowType: 'domestic',
    description: 'GST tax invoice, stock reduction & accounting ledger entry'
  },
  {
    id: 'sales_return',
    stepNumber: '4',
    label: 'Sales Return',
    createPath: '/entry/sales-return-create',
    displayPath: '/entry/sales-return-display',
    flowType: 'domestic',
    description: 'Credit note with GST tax reversal & returned stock restock'
  },
  {
    id: 'sales_export_order',
    stepNumber: 'A',
    label: 'Export Order',
    createPath: '/entry/sales-export-order-create',
    displayPath: '/entry/sales-export-order-display',
    flowType: 'export',
    description: 'Foreign currency buyer purchase contract'
  },
  {
    id: 'sales_export',
    stepNumber: 'B',
    label: 'Export Sales',
    createPath: '/entry/sales-export-create',
    displayPath: '/entry/sales-export-display',
    flowType: 'export',
    description: 'Export shipping invoice (Zero-rated / LUT under GST)'
  }
];

export const SalesDistributionWorkflow = ({
  currentModule = 'quotation',
  onImportRecord = null,
  importButtonText = ''
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importSourceList, setImportSourceList] = useState([]);
  const [loadingImport, setLoadingImport] = useState(false);

  // Identify active step
  const activeModule = SD_MODULES.find(m => 
    m.id === currentModule || 
    currentPath.includes(m.id) || 
    (m.id === 'sales_order' && currentPath.includes('sales-order')) ||
    (m.id === 'sales' && (currentPath.includes('sales-create') || currentPath.includes('sales-display')) && !currentPath.includes('order') && !currentPath.includes('export') && !currentPath.includes('return'))
  ) || SD_MODULES[0];

  // Determine what source module can be imported into this step
  let importSourceEndpoint = null;
  let importSourceName = '';
  if (activeModule.id === 'sales_order') {
    importSourceEndpoint = '/quotations';
    importSourceName = 'Quotation';
  } else if (activeModule.id === 'sales') {
    importSourceEndpoint = '/sales?is_order=1';
    importSourceName = 'Sales Order';
  } else if (activeModule.id === 'sales_export') {
    importSourceEndpoint = '/sales-export-orders';
    importSourceName = 'Export Order';
  } else if (activeModule.id === 'sales_return') {
    importSourceEndpoint = '/sales?is_order=0';
    importSourceName = 'Sales Invoice';
  }

  const handleOpenImport = async () => {
    if (!importSourceEndpoint) return;
    setLoadingImport(true);
    setImportModalOpen(true);
    try {
      const res = await api(importSourceEndpoint);
      const rows = Array.isArray(res) ? res : (res?.data || res?.rows || []);
      setImportSourceList(rows);
    } catch (e) {
      console.error('Failed to load records for workflow import:', e);
      setImportSourceList([]);
    } finally {
      setLoadingImport(false);
    }
  };

  const handleSelectRecord = async (record) => {
    setImportModalOpen(false);
    let fullRecord = record;
    try {
      if (record && record.id && importSourceEndpoint) {
        let baseEndpoint = importSourceEndpoint.split('?')[0];
        if (baseEndpoint.startsWith('/api/')) baseEndpoint = baseEndpoint.replace('/api/', '/');
        const res = await api(`${baseEndpoint}/${record.id}`);
        if (res && (res.items || res.id)) {
          fullRecord = res;
        }
      }
    } catch (e) {
      console.warn('Could not fetch full record details for import, using selected row:', e);
    }
    if (onImportRecord) {
      onImportRecord(fullRecord);
    }
  };

  return (
    <div style={styles.workflowContainer}>
      <div style={styles.topRow}>
        <div style={styles.brandTitle}>
          <span style={styles.sdBadge}>S&D WORKFLOW</span>
          <span style={styles.moduleHeading}>Sales & Distribution Lifecycle</span>
        </div>
        <div style={styles.actionButtons}>
          {importSourceEndpoint && onImportRecord && (
            <button
              type="button"
              onClick={handleOpenImport}
              style={styles.importBtn}
              title={`Import data directly from ${importSourceName}`}
            >
              📥 {importButtonText || `Import from ${importSourceName}`}
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate(activeModule.displayPath)}
            style={styles.listBtn}
            title="View Register / List for this module"
          >
            📋 View Register
          </button>
        </div>
      </div>

      {/* Stepper Navigation */}
      <div style={styles.stepperWrapper}>
        <div style={styles.flowSectionLabel}>Domestic Order-to-Cash Cycle:</div>
        <div style={styles.stepsRow}>
          {SD_MODULES.filter(m => m.flowType === 'domestic').map((mod, idx, arr) => {
            const isActive = activeModule.id === mod.id;
            return (
              <React.Fragment key={mod.id}>
                <div
                  onClick={() => navigate(mod.createPath)}
                  style={{
                    ...styles.stepCard,
                    ...(isActive ? styles.activeStepCard : styles.inactiveStepCard)
                  }}
                  title={mod.description}
                >
                  <div style={{
                    ...styles.stepNumberBadge,
                    backgroundColor: isActive ? '#ffffff' : '#3b82f6',
                    color: isActive ? '#1d4ed8' : '#ffffff'
                  }}>
                    {mod.stepNumber}
                  </div>
                  <div style={styles.stepInfo}>
                    <div style={{
                      ...styles.stepLabel,
                      color: isActive ? '#ffffff' : '#1e3a8a'
                    }}>
                      {mod.label}
                    </div>
                    <div style={{
                      ...styles.stepSub,
                      color: isActive ? '#dbeafe' : '#64748b'
                    }}>
                      {isActive ? 'Current View' : 'Click to Open'}
                    </div>
                  </div>
                </div>
                {idx < arr.length - 1 && <div style={styles.arrow}>➔</div>}
              </React.Fragment>
            );
          })}
        </div>

        <div style={{ ...styles.flowSectionLabel, marginTop: '10px' }}>Export Trade Flow:</div>
        <div style={styles.stepsRow}>
          {SD_MODULES.filter(m => m.flowType === 'export').map((mod, idx, arr) => {
            const isActive = activeModule.id === mod.id;
            return (
              <React.Fragment key={mod.id}>
                <div
                  onClick={() => navigate(mod.createPath)}
                  style={{
                    ...styles.stepCard,
                    ...(isActive ? styles.activeStepCard : styles.inactiveStepCard)
                  }}
                  title={mod.description}
                >
                  <div style={{
                    ...styles.stepNumberBadge,
                    backgroundColor: isActive ? '#ffffff' : '#059669',
                    color: isActive ? '#047857' : '#ffffff'
                  }}>
                    {mod.stepNumber}
                  </div>
                  <div style={styles.stepInfo}>
                    <div style={{
                      ...styles.stepLabel,
                      color: isActive ? '#ffffff' : '#065f46'
                    }}>
                      {mod.label}
                    </div>
                    <div style={{
                      ...styles.stepSub,
                      color: isActive ? '#d1fae5' : '#64748b'
                    }}>
                      {isActive ? 'Current View' : 'Click to Open'}
                    </div>
                  </div>
                </div>
                {idx < arr.length - 1 && <div style={styles.arrow}>➔</div>}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Modal for importing from previous stage */}
      {importModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0, color: '#1e3a8a', fontSize: '16px', fontWeight: '800' }}>
                Select {importSourceName} to Pull Details
              </h3>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                style={styles.closeBtn}
              >
                ✕
              </button>
            </div>
            <div style={styles.modalBody}>
              {loadingImport ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                  Loading {importSourceName} records...
                </div>
              ) : importSourceList.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                  No available {importSourceName} records found.
                </div>
              ) : (
                <table style={styles.importTable}>
                  <thead>
                    <tr style={{ backgroundColor: '#1e3a8a', color: '#ffffff' }}>
                      <th style={styles.th}>Doc / Bill No</th>
                      <th style={styles.th}>Date</th>
                      <th style={styles.th}>Customer</th>
                      <th style={styles.th}>Amount</th>
                      <th style={styles.th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importSourceList.slice(0, 25).map((row, idx) => {
                      const docNo = row.bill_no || row.s_no || row.sNo || row.id;
                      const dateVal = row.date ? String(row.date).substring(0, 10) : '';
                      const cust = row.customer_name || row.customer || row.consignee || 'Unknown';
                      const amt = row.total_amt || row.grand_total || row.bill_amt || 0;
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={styles.td}><strong>#{docNo}</strong></td>
                          <td style={styles.td}>{dateVal}</td>
                          <td style={styles.td}>{cust}</td>
                          <td style={{ ...styles.td, fontWeight: '700', color: '#1d4ed8' }}>
                            ₹{parseFloat(amt || 0).toLocaleString()}
                          </td>
                          <td style={styles.td}>
                            <button
                              type="button"
                              onClick={() => handleSelectRecord(row)}
                              style={styles.selectBtn}
                            >
                              Select & Fill
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  workflowContainer: {
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '12px 18px',
    marginBottom: '16px',
    boxShadow: '0 2px 5px rgba(0, 0, 0, 0.04)'
  },
  topRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '8px'
  },
  brandTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  sdBadge: {
    backgroundColor: '#1e3a8a',
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: '800',
    padding: '3px 8px',
    borderRadius: '4px',
    letterSpacing: '0.05em'
  },
  moduleHeading: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#0f172a'
  },
  actionButtons: {
    display: 'flex',
    gap: '8px'
  },
  importBtn: {
    backgroundColor: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '5px',
    padding: '5px 12px',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer'
  },
  listBtn: {
    backgroundColor: '#f1f5f9',
    color: '#1e3a8a',
    border: '1px solid #cbd5e1',
    borderRadius: '5px',
    padding: '5px 12px',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer'
  },
  stepperWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  flowSectionLabel: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  },
  stepsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    overflowX: 'auto',
    paddingBottom: '4px'
  },
  stepCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 14px',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    minWidth: '130px'
  },
  activeStepCard: {
    backgroundColor: '#1d4ed8',
    color: '#ffffff',
    boxShadow: '0 2px 4px rgba(29, 78, 216, 0.25)'
  },
  inactiveStepCard: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0'
  },
  stepNumberBadge: {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: '800'
  },
  stepInfo: {
    display: 'flex',
    flexDirection: 'column'
  },
  stepLabel: {
    fontSize: '13px',
    fontWeight: '700'
  },
  stepSub: {
    fontSize: '10px'
  },
  arrow: {
    color: '#94a3b8',
    fontSize: '14px',
    fontWeight: 'bold',
    userSelect: 'none'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modalBox: {
    backgroundColor: '#ffffff',
    width: '90%',
    maxWidth: '750px',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
  },
  modalHeader: {
    padding: '12px 18px',
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    color: '#64748b'
  },
  modalBody: {
    padding: '16px',
    maxHeight: '400px',
    overflowY: 'auto'
  },
  importTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px'
  },
  th: {
    padding: '8px 10px',
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: '700'
  },
  td: {
    padding: '8px 10px',
    fontSize: '12px'
  },
  selectBtn: {
    backgroundColor: '#16a34a',
    color: '#ffffff',
    border: 'none',
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '700',
    cursor: 'pointer'
  }
};

export default SalesDistributionWorkflow;
