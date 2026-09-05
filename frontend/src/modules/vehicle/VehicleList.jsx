import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getVehicleMovements, updateVehicleMovement, deleteVehicleMovement } from './vehicleService';
import VehiclePrint from './VehiclePrint';

const VehicleList = () => {
  const navigate = useNavigate();
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [openPrint, setOpenPrint] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadMovements();
  }, []);

  const loadMovements = async () => {
    setLoading(true);
    try {
      const data = await getVehicleMovements();
      setMovements(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Load movements failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (id) => {
    navigate(`/entry/vehicle-movement-create?id=${id}`);
  };

  const handlePrint = (id) => {
    setSelectedId(id);
    setOpenPrint(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    try {
      const res = await deleteVehicleMovement(deleteConfirmId);
      if (res && res.success !== false) {
        loadMovements();
      } else {
        alert('Delete failed: ' + (res?.message || 'Unknown error'));
      }
    } catch (err) {
      alert('Delete failed: ' + err.message);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      await updateVehicleMovement(id, { status: newStatus });
      loadMovements();
    } catch (err) {
      alert('Update failed: ' + err.message);
    }
  };

  const filteredMovements = movements.filter((row) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (row.vehicle_no && row.vehicle_no.toLowerCase().includes(term)) ||
      (row.driver_name && row.driver_name.toLowerCase().includes(term)) ||
      (row.party_name && row.party_name.toLowerCase().includes(term)) ||
      (row.item_name && row.item_name.toLowerCase().includes(term)) ||
      (row.lot_no && row.lot_no.toLowerCase().includes(term)) ||
      (row.transporter_name && row.transporter_name.toLowerCase().includes(term))
    );
  });

  return (
    <div style={styles.container}>
      <style>{`
        .vehicle-row:hover {
          background-color: #f1f5f9 !important;
        }
      `}</style>

      {/* Screen Title Bar (Standard Blue & White Application Theme) */}
      <div className="screen-title" style={styles.header}>
        <button 
          onClick={() => navigate(-1)} 
          style={styles.backBtn}
        >
          ← Back
        </button>
        <span style={{ verticalAlign: 'middle', flex: 1, textAlign: 'center' }}>
          VEHICLE MOVEMENT DISPLAY
        </span>
        <button 
          onClick={() => navigate('/entry/vehicle-movement-create')}
          style={styles.headerAddBtn}
        >
          + New Movement
        </button>
      </div>

      {/* Filter / Search Section */}
      <div style={styles.filterSection}>
        <div style={styles.filterLeft}>
          <input
            type="text"
            placeholder="Search vehicle, driver, party, item..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        <div style={styles.filterRight}>
          <button style={styles.refreshBtn} onClick={loadMovements}>Refresh</button>
          <button 
            style={styles.addNewBtn} 
            onClick={() => navigate('/entry/vehicle-movement-create')}
          >
            Create New Movement
          </button>
        </div>
      </div>

      {/* Main Table Display */}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>S.NO</th>
              <th style={styles.th}>VEHICLE NO</th>
              <th style={styles.th}>DRIVER NAME</th>
              <th style={styles.th}>TRANSPORTER</th>
              <th style={styles.th}>MOVEMENT TYPE</th>
              <th style={styles.th}>REF DETAILS</th>
              <th style={styles.th}>LOT NO</th>
              <th style={styles.th}>PARTY NAME</th>
              <th style={styles.th}>ITEM NAME</th>
              <th style={styles.th}>QTY</th>
              <th style={styles.th}>WEIGHT</th>
              <th style={styles.th}>GROSS / TARE / NET</th>
              <th style={styles.th}>ANALYZING TEAM</th>
              <th style={styles.th}>STATUS</th>
              <th style={styles.th}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="15" style={styles.loading}>Loading vehicle records...</td>
              </tr>
            ) : filteredMovements.length === 0 ? (
              <tr>
                <td colSpan="15" style={styles.noData}>No vehicle movement records found</td>
              </tr>
            ) : (
              filteredMovements.map((row, idx) => (
                <tr key={row.id || idx} className="vehicle-row">
                  <td style={styles.td}>{idx + 1}</td>
                  <td style={styles.tdVehicleNo}>{row.vehicle_no || '-'}</td>
                  <td style={styles.td}>{row.driver_name || '-'}</td>
                  <td style={styles.td}>{row.transporter_name || '-'}</td>
                  <td style={styles.td}>{row.movement_type || 'IN'} / {row.operation_type || 'GENERAL'}</td>
                  <td style={styles.td}>{row.reference_type ? `${row.reference_type} #${row.reference_id || ''}` : '-'}</td>
                  <td style={styles.td}><strong>{row.lot_no || '-'}</strong></td>
                  <td style={styles.td}>{row.party_name || '-'}</td>
                  <td style={styles.td}>{row.item_name || '-'}</td>
                  <td style={styles.td}>{row.qty !== null && row.qty !== undefined ? row.qty : '-'}</td>
                  <td style={styles.td}>{row.weight !== null && row.weight !== undefined ? row.weight : '-'}</td>
                  <td style={styles.td}>{row.gross_weight || '0'} / {row.tare_weight || '0'} / {row.net_weight || '0'}</td>
                  <td style={styles.td}>
                    {row.analyzing_team || row.analyzing_area ? (
                      <div>
                        <div>{row.analyzing_team || '-'}</div>
                        <div style={{ fontSize: '11px', color: '#666' }}>{row.analyzing_area || '-'}</div>
                      </div>
                    ) : '-'}
                  </td>
                  <td style={styles.td}>
                    <select 
                      value={row.status || 'IN'} 
                      onChange={(e) => handleStatusUpdate(row.id, e.target.value)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: '1px solid #7fa1d6',
                        fontWeight: 'bold',
                        fontSize: '12px',
                        backgroundColor: row.status === 'OUT' ? '#dcfce7' : row.status === 'UNLOADED' ? '#f3e8ff' : row.status === 'RETURNED' || row.status === 'RETURN' ? '#fee2e2' : '#ffffff',
                        color: row.status === 'OUT' ? '#166534' : row.status === 'UNLOADED' ? '#6b21a8' : row.status === 'RETURNED' || row.status === 'RETURN' ? '#991b1b' : '#1f4fb2',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="IN">IN</option>
                      <option value="UNLOAD">UNLOAD</option>
                      <option value="UNLOADED">UNLOADED</option>
                      <option value="RETURN">RETURN</option>
                      <option value="RETURNED">RETURNED</option>
                      <option value="OUT">OUT</option>
                    </select>
                  </td>
                  <td style={styles.actionsCell}>
                    <div style={styles.actionBtnGroup}>
                      <button style={styles.actionBtn} onClick={() => handleEdit(row.id)}>Update</button>
                      <button style={styles.printBtn} onClick={() => handlePrint(row.id)}>Print</button>
                      <button style={styles.deleteBtn} onClick={() => setDeleteConfirmId(row.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer bar */}
      <div style={styles.footer}>
        <div style={styles.footerLeft}>
          Total Movements: {filteredMovements.length}
        </div>
        <div style={styles.footerRight}>
          <button style={styles.printGlobalBtn} onClick={() => window.print()}>Print Register</button>
        </div>
      </div>

      {openPrint && selectedId && (
        <VehiclePrint 
          movementId={selectedId} 
          onClose={() => setOpenPrint(false)} 
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>Confirm Delete</h3>
            <p style={styles.modalBody}>Are you sure you want to delete this vehicle movement record?</p>
            <div style={styles.modalActions}>
              <button 
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                style={styles.modalCancelBtn}
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleDeleteConfirm}
                style={styles.modalConfirmBtn}
              >
                Delete
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: '4px 4px 0 0',
    marginBottom: '15px'
  },
  backBtn: {
    background: '#ffffff', 
    border: '1px solid #ccc', 
    borderRadius: '4px', 
    padding: '4px 12px', 
    cursor: 'pointer', 
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#333',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  },
  headerAddBtn: {
    background: '#ffffff',
    color: '#1f4fb2',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 14px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold'
  },
  filterSection: {
    background: '#e9eef7',
    padding: '15px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '2px solid #9fb6dd',
    marginBottom: '15px',
    borderRadius: '4px'
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
    width: '280px',
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
    overflowX: 'auto',
    background: '#fff',
    borderRadius: '4px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    background: '#1f4fb2',
    color: '#fff',
    padding: '10px',
    textAlign: 'left',
    fontWeight: 'bold',
    border: '1px solid #9fb6dd',
    whiteSpace: 'nowrap'
  },
  td: {
    padding: '8px 10px',
    border: '1px solid #c0c8da',
    whiteSpace: 'nowrap'
  },
  tdVehicleNo: {
    padding: '8px 10px',
    border: '1px solid #c0c8da',
    fontWeight: 'bold',
    color: '#1f4fb2',
    whiteSpace: 'nowrap'
  },
  actionsCell: {
    padding: '8px 10px',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    border: '1px solid #c0c8da',
    verticalAlign: 'middle'
  },
  actionBtnGroup: {
    display: 'flex',
    gap: '6px',
    justifyContent: 'center',
    alignItems: 'center'
  },
  actionBtn: {
    padding: '6px 12px',
    background: '#1f4fb2',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
    lineHeight: '1',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '60px',
    height: '28px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
  },
  printBtn: {
    padding: '6px 12px',
    background: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
    lineHeight: '1',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '55px',
    height: '28px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
  },
  deleteBtn: {
    padding: '6px 12px',
    background: '#dc2626',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
    lineHeight: '1',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '60px',
    height: '28px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
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
    color: '#1f3f67',
    marginTop: '15px',
    borderRadius: '4px'
  },
  footerLeft: {
    fontSize: '14px'
  },
  footerRight: {
    display: 'flex',
    gap: '10px'
  },
  printGlobalBtn: {
    padding: '8px 16px',
    background: '#1f4fb2',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: '24px',
    borderRadius: '8px',
    maxWidth: '400px',
    width: '90%',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
  },
  modalTitle: {
    marginTop: 0,
    color: '#1f4fb2',
    fontSize: '18px'
  },
  modalBody: {
    color: '#475569',
    fontSize: '14px',
    marginBottom: '20px'
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px'
  },
  modalCancelBtn: {
    padding: '8px 16px',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    backgroundColor: '#f1f5f9',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  modalConfirmBtn: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: '#dc2626',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer'
  }
};

export default VehicleList;
