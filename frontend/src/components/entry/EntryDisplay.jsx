import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../services/api";
import { safeArray } from "../../utils/safeArray";
import { printHtml } from "../../utils/printHelper";
import { useAuth } from "../../context/AuthContext";
import { exportToExcel, printTableList, reactNodeToHtml } from "../../utils/exportHelper";

/**
 * EntryDisplay - Uniform display component for Entry pages
 * Provides standardized table display with actions (Update, Print, Delete)
 * Styled with Blue & White theme
 */
const EntryDisplay = ({ 
  title = "Display",
  apiEndpoint,
  tableName,
  columns = [],
  onEdit,
  onPrint,
  onRowClick,
  customActions,
  onAddNew,
  addNewLink,
  moduleName
}) => {
  const navigate = useNavigate();
  const { isAdmin, hasPermission, selectedCompany, financialYear } = useAuth();

  const getModuleNameFromTitle = (t) => {
    if (!t) return 'Purchase';
    const clean = t.replace(/ Display$/i, '').replace(/ Creation$/i, '').trim();
    if (clean.toLowerCase() === 'purchase') return 'Purchase';
    if (clean.toLowerCase() === 'sales') return 'Sales';
    if (clean.toLowerCase() === 'sales order') return 'Sales Order';
    if (clean.toLowerCase() === 'purchase order') return 'Purchase Order';
    if (clean.toLowerCase() === 'grind' || clean.toLowerCase() === 'flour out') return 'Flour Out';
    return clean;
  };

  const effectiveModule = moduleName || getModuleNameFromTitle(title);

  const canEdit = isAdmin || hasPermission(effectiveModule, 'Display', 'can_edit') || hasPermission(effectiveModule, 'can_edit');
  const canDelete = isAdmin || hasPermission(effectiveModule, 'Display', 'can_delete') || hasPermission(effectiveModule, 'can_delete');
  const canPrint = isAdmin || hasPermission(effectiveModule, 'Display', 'can_print') || hasPermission(effectiveModule, 'can_print');
  const canCreate = isAdmin || hasPermission(effectiveModule, 'Display', 'can_create') || hasPermission(effectiveModule, 'Create', 'can_create') || hasPermission(effectiveModule, 'can_create');
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get("search") || "";
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [searchTerm, setSearchTerm] = useState(initialSearch);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null
  });

  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onClose: null
  });

  const showConfirm = (title, message, onConfirm) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const showAlert = (title, message, onClose = null) => {
    setAlertModal({
      isOpen: true,
      title,
      message,
      onClose
    });
  };

  const getResolvedAddNewLink = () => {
    if (addNewLink && addNewLink.startsWith('/entry/')) {
      return addNewLink;
    }
    
    const cleanTitle = title.toLowerCase()
      .replace(' display', '')
      .replace(' creation', '')
      .trim();

    if (cleanTitle === 'grind' || cleanTitle === 'grains') {
      return '/entry/grind-create';
    }
    if (cleanTitle === 'vehicle' || cleanTitle === 'vehicle movement') {
      return '/entry/vehicle-movement-create';
    }
    if (cleanTitle === 'purchase order') {
      return '/entry/purchase-order-create';
    }
    if (cleanTitle === 'sales order') {
      return '/entry/sales-order-create';
    }
    if (cleanTitle === 'sales export order') {
      return '/entry/sales-export-order-create';
    }
    if (cleanTitle === 'papad in') {
      return '/entry/papad-in-create';
    }
    if (cleanTitle === 'quality control') {
      return '/entry/quality-control-create';
    }
    if (cleanTitle === 'incoming quality') {
      return '/entry/incoming-quality-create';
    }
    if (cleanTitle === 'voucher') {
      return '/entry/voucher-create';
    }
    
    const slug = cleanTitle.replace(/\s+/g, '-');
    return `/entry/${slug}-create`;
  };

  const resolvedLink = getResolvedAddNewLink();

  const fetchData = async () => {
    if (!apiEndpoint && !tableName) return;
    setLoading(true);
    setMessage("");
    try {
      let result;
      
      if (tableName && !['purchases', 'sales'].includes(tableName)) {
        result = await api(`/masters/${tableName}`);
      } else if (apiEndpoint) {
        const response = await api(apiEndpoint);
        result = response;
      } else {
        setData([]);
        return;
      }
      
      // Debug: log raw response shape for this page
      console.log('EntryDisplay apiEndpoint:', apiEndpoint, 'result:', result);

      const rawData = safeArray(result.data || result);
      setData(rawData);

    } catch (error) {
      console.error("Error fetching data:", error);
      setMessage("Error loading data");
      setMessageType("error");
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [apiEndpoint, tableName]);

  const handleDeleteDirect = async (row) => {
    const id = row.id;
    try {
      // Clean up the apiEndpoint or derive from tableName to get the base REST path
      let baseEndpoint = apiEndpoint;
      if (!baseEndpoint && tableName) {
        baseEndpoint = `/masters/${tableName}`;
      } else if (!baseEndpoint) {
        baseEndpoint = "/purchases";
      }
      
      baseEndpoint = baseEndpoint
        .replace(/\/purchase-list$/, "")
        .replace(/\/list$/, "")
        .replace(/\/get-all$/, "")
        .replace(/\/all$/, "")
        .replace(/\/list-all$/, "")
        .replace(/\/get_all$/, "");
      
      const res = await api(`${baseEndpoint}/${id}`, { method: 'DELETE' });
      if (res && res.success !== false) {
        setMessage("Record deleted successfully");
        setMessageType("success");
        fetchData();
      } else {
        setMessage(res?.message || "Delete failed");
        setMessageType("error");
      }
    } catch (error) {
      setMessage("Network error while deleting");
      setMessageType("error");
    }
    setTimeout(() => setMessage(""), 3000);
  };

  const handleDelete = async (row) => {
    const id = row.id;
    if (!id) {
      setMessage("Cannot delete: missing record id");
      setMessageType("error");
      return;
    }
    showConfirm(
      "Delete Record",
      "Are you sure you want to delete this record? This will restore stock levels and revert related transactions.",
      () => handleDeleteDirect(row)
    );
  };

  const handlePrint = (row) => {
    if (onPrint) {
      onPrint(row);
      return;
    }
    let tableHtml = "<table style='border-collapse:collapse;width:100%'>";
    tableHtml += "<thead><tr>";
    columns.forEach(col => {
      tableHtml += `<th style='border:1px solid #1f4fb2;padding:8px;background:#1f4fb2;color:#fff'>${col.title || col.key}</th>`;
    });
    tableHtml += "</tr></thead><tbody><tr>";
    columns.forEach(col => {
      let val = row[col.key] || "";
      if (col.render) {
        val = col.render(val, row);
        if (typeof val !== 'string' && typeof val !== 'number') {
          val = reactNodeToHtml(val) || row[col.key] || "";
        }
      }
      tableHtml += `<td style='border:1px solid #cbd5e1;padding:8px'>${val}</td>`;
    });
    tableHtml += "</tr></tbody></table>";
    
    const html = `
      <div style="font-family:Arial, sans-serif;padding:15px;">
        <h2 style="color:#1f4fb2;border-bottom:2px solid #1f4fb2;padding-bottom:10px;">${title} Details</h2>
        ${tableHtml}
      </div>
    `;
    printHtml(html, `${title} - ${row.id || 'Print'}`);
  };

  const handleEdit = (row) => {
    if (onEdit) {
      onEdit(row);
    }
  };

  const handleExportExcel = () => {
    exportToExcel(filteredData, title, columns);
  };

  const handlePrintList = () => {
    const currentFY = (new Date().getMonth() >= 3 ? `${new Date().getFullYear()}-${new Date().getFullYear() + 1}` : `${new Date().getFullYear() - 1}-${new Date().getFullYear()}`);
    printTableList(title, columns, filteredData, {
      company: selectedCompany?.name || 'BVC Company',
      fy: financialYear || currentFY
    });
  };

  const filteredData = data.filter(row => {
    if (!searchTerm) return true;
    return Object.values(row).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div style={styles.container}>
      <style>{`
        .entry-display-row:hover {
          background-color: #f1f5f9 !important;
        }
      `}</style>
      <div style={styles.header}>
        <button 
          onClick={() => navigate(-1)} 
          style={{ 
            background: '#ffffff', 
            border: '1px solid #ccc', 
            borderRadius: '4px', 
            padding: '4px 10px', 
            marginRight: '12px', 
            cursor: 'pointer', 
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#333',
            verticalAlign: 'middle',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}
        >
          ← Back
        </button>
        <span style={{ verticalAlign: 'middle' }}>{title}</span>
      </div>

      {message && (
        <div style={messageType === 'success' ? styles.successMessage : styles.errorMessage}>
          {message}
        </div>
      )}

      <div style={styles.filterSection}>
        <div style={styles.filterLeft}>
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        <div style={styles.filterRight}>
          <button style={styles.refreshBtn} onClick={fetchData}>Refresh</button>
          <button 
            style={{ ...styles.refreshBtn, backgroundColor: '#10b981', color: 'white', borderColor: '#10b981', fontWeight: 'bold' }} 
            onClick={handleExportExcel}
          >
            📊 Export Excel
          </button>
          <button 
            style={{ ...styles.refreshBtn, backgroundColor: '#1f4fb2', color: 'white', borderColor: '#1f4fb2', fontWeight: 'bold' }} 
            onClick={handlePrintList}
          >
            🖨 Print List
          </button>
          {canCreate && (onAddNew ? (
            <button style={styles.addNewBtn} onClick={onAddNew}>
              Create New {title.replace(' Display', '')}
            </button>
          ) : resolvedLink ? (
            <button 
              style={styles.addNewBtn} 
              onClick={() => navigate(resolvedLink)}
            >
              Create New {title.replace(' Display', '')}
            </button>
          ) : null)}
        </div>
      </div>

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
            {loading ? (
              <tr>
                <td colSpan={columns.length + 1} style={styles.loading}>Loading...</td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} style={styles.noData}>No records found</td>
              </tr>
            ) : (
              filteredData.map((row, idx) => (
                <tr 
                  key={`${row.id ?? 'row'}-${idx}`}
                  className="entry-display-row"
                  style={{ cursor: (onRowClick || (canEdit && onEdit)) ? 'pointer' : 'default' }}
                  onClick={(e) => {
                    if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.closest('a')) {
                      return;
                    }
                    if (onRowClick) {
                      onRowClick(row);
                    } else if (canEdit && onEdit) {
                      onEdit(row);
                    }
                  }}
                >
                  {columns.map((col) => (
                    <td key={col.key} style={styles.td}>
                      {col.render ? col.render(row[col.key], row, idx) : row[col.key]}
                    </td>
                  ))}
                  <td style={styles.actionsCell}>
                    {customActions ? (
                      customActions(row, fetchData, showConfirm, showAlert, { canEdit, canDelete, canPrint, canCreate, isAdmin })
                    ) : (
                      <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
                        {canEdit && (
                          <button 
                            className="action-btn update-btn" 
                            style={{ ...styles.actionBtn, backgroundColor: '#1976d2' }} 
                            onClick={() => handleEdit(row)}
                          >
                            Update
                          </button>
                        )}
                        {canPrint && (
                          <button 
                            className="action-btn print-btn" 
                            style={{ ...styles.actionBtn, backgroundColor: '#0288d1' }} 
                            onClick={() => handlePrint(row)}
                          >
                            Print
                          </button>
                        )}
                        {canDelete && (
                          <button 
                            className="action-btn delete-btn danger" 
                            style={{ ...styles.deleteBtn, backgroundColor: '#d32f2f' }} 
                            onClick={() => handleDelete(row)}
                          >
                            Delete
                          </button>
                        )}
                        {!canEdit && !canPrint && !canDelete && <span style={{ color: '#888', fontSize: '12px' }}>-</span>}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={styles.footer}>
        <div style={styles.footerLeft}>
          Total Records: {filteredData.length}
        </div>
        <div style={styles.footerRight}>
          <button style={styles.printBtn} onClick={handlePrintList}>Print List</button>
        </div>
      </div>

      {confirmModal.isOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>{confirmModal.title}</h3>
            <p style={styles.modalBody}>{confirmModal.message}</p>
            <div style={styles.modalActions}>
              <button 
                style={styles.modalCancelBtn} 
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              >
                Cancel
              </button>
              <button 
                style={styles.modalConfirmBtn} 
                onClick={confirmModal.onConfirm}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {alertModal.isOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>{alertModal.title}</h3>
            <p style={styles.modalBody}>{alertModal.message}</p>
            <div style={styles.modalActions}>
              <button 
                style={styles.modalConfirmBtn} 
                onClick={() => {
                  setAlertModal(prev => ({ ...prev, isOpen: false }));
                  if (alertModal.onClose && typeof alertModal.onClose === 'function') {
                    alertModal.onClose();
                  }
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    background: '#f0f6ff',
    minHeight: '100vh',
    fontFamily: "'Segoe UI', 'Tahoma', Arial, sans-serif"
  },
  header: {
    background: 'linear-gradient(135deg, #1f4fb2 0%, #2a5ea0 100%)',
    color: 'white',
    padding: '12px 20px',
    fontSize: '20px',
    fontWeight: 'bold',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  successMessage: {
    padding: '12px 20px',
    background: '#d4edda',
    color: '#155724',
    border: '1px solid #c3e6cb',
    borderRadius: '4px',
    marginBottom: '15px'
  },
  errorMessage: {
    padding: '12px 20px',
    background: '#f8d7da',
    color: '#721c24',
    border: '1px solid #f5c6cb',
    borderRadius: '4px',
    marginBottom: '15px'
  },
  filterSection: {
    background: '#e9eef7',
    padding: '15px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '2px solid #9fb6dd',
    marginBottom: '15px'
  },
  filterLeft: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center'
  },
  filterRight: {
    display: 'flex',
    gap: '10px'
  },
  searchInput: {
    padding: '8px 12px',
    border: '1px solid #7fa1d6',
    borderRadius: '4px',
    fontSize: '14px',
    width: '200px',
    backgroundColor: '#ffffff',
  },
  refreshBtn: {
    padding: '8px 16px',
    background: '#1f4fb2',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold'
  },
  addNewBtn: {
    padding: '8px 16px',
    background: '#2a5ea0',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold'
  },
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
    background: '#1f4fb2',
    color: '#fff',
    padding: '10px',
    textAlign: 'left',
    fontWeight: 'bold',
    border: '1px solid #9fb6dd',
  },
  td: {
    padding: '8px',
    border: '1px solid #c0c8da',
  },
  actionsCell: {
    padding: '8px',
    textAlign: 'center',
    whiteSpace: 'nowrap',
  },
  actionBtn: {
    padding: '5px 12px',
    background: '#1f4fb2',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold',
    marginRight: '5px'
  },
  deleteBtn: {
    padding: '5px 12px',
    background: '#f44336',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold'
  },
  printBtn: {
    padding: '8px 16px',
    background: '#2196F3',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold'
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
  footer: {
    background: '#dbe7fb',
    padding: '12px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '2px solid #9fb6dd',
    fontWeight: 'bold',
    color: '#1f3f67'
  },
  footerLeft: {
    fontSize: '14px'
  },
  footerRight: {
    display: 'flex',
    gap: '10px'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  modalContent: {
    background: '#ffffff',
    padding: '24px',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    maxWidth: '400px',
    width: '90%',
    textAlign: 'left',
  },
  modalTitle: {
    margin: '0 0 12px 0',
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#1f4fb2',
  },
  modalBody: {
    margin: '0 0 20px 0',
    fontSize: '14px',
    color: '#4a5568',
    lineHeight: '1.5',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  },
  modalCancelBtn: {
    padding: '8px 16px',
    background: '#edf2f7',
    color: '#4a5568',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  modalConfirmBtn: {
    padding: '8px 16px',
    background: '#1f4fb2',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
  }
};

export default EntryDisplay;

