import React from "react";

/**
 * EntryDisplayActions - Uniform action buttons for Entry display pages
 * Contains Update, Print, Delete buttons with consistent styling
 */
const EntryDisplayActions = ({ 
  onUpdate, 
  onPrint, 
  onDelete,
  onAddNew,
  onRefresh,
  addNewLink,
  totalRecords = 0,
  showAddNew = false,
  showRefresh = true
}) => {
  const handleUpdate = () => {
    if (onUpdate) {
      onUpdate();
    }
  };

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
    }
  };

  const handleAddNew = () => {
    if (onAddNew) {
      onAddNew();
    } else if (addNewLink) {
      window.location.href = addNewLink;
    }
  };

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      window.location.reload();
    }
  };

  return (
    <div style={styles.footer}>
      <div style={styles.footerLeft}>
        <span style={styles.recordCount}>Total Records: {totalRecords}</span>
      </div>
      <div style={styles.footerRight}>
        {showRefresh && (
          <button style={styles.refreshBtn} onClick={handleRefresh}>
            Refresh
          </button>
        )}
        {showAddNew && (
          <button style={styles.addNewBtn} onClick={handleAddNew}>
            Create New
          </button>
        )}
        <button style={styles.printBtn} onClick={handlePrint}>
          Print
        </button>
        {onUpdate && (
          <button style={styles.actionBtn} onClick={handleUpdate}>
            Update
          </button>
        )}
        {onDelete && (
          <button style={styles.deleteBtn} onClick={handleDelete}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
};

const styles = {
  footer: {
    background: '#66B4E3',
    padding: '10px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    border: '2px solid #A5B89B',
    fontWeight: 'bold'
  },
  footerLeft: {
    fontSize: '14px'
  },
  footerRight: {
    display: 'flex',
    gap: '10px'
  },
  recordCount: {
    color: '#333',
    fontSize: '14px'
  },
  refreshBtn: {
    padding: '8px 16px',
    background: '#666',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  addNewBtn: {
    padding: '8px 16px',
    background: '#234D8B',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  printBtn: {
    padding: '8px 16px',
    background: '#3A6F32',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  actionBtn: {
    padding: '8px 16px',
    background: '#234D8B',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  deleteBtn: {
    padding: '8px 16px',
    background: '#dc3545',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '14px'
  }
};

export default EntryDisplayActions;
