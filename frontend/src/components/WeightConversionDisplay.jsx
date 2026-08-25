import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../utils/api.js'
import { printHtml } from '../utils/printHelper'
import './WeightConversionDisplay.css'

const WeightConversionDisplay = () => {
  const navigate = useNavigate()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  useEffect(() => {
    loadWeightConversions()
  }, [])

  const loadWeightConversions = async () => {
    try {
      setLoading(true)
      const result = await api('db/query', {
        method: 'POST',
        body: {
          sql: `
            SELECT 
              wc.id, 
              wc.s_no, 
              wc.date, 
              wc.remarks, 
              wc.type, 
              wci.id AS item_id,
              wci.item_name, 
              wci.lot_no, 
              wci.weight, 
              wci.qty, 
              wci.total_wt,
              COALESCE(wci.type, 'input') as item_type
            FROM weight_conversion wc 
            LEFT JOIN weight_conversion_items wci ON wc.id = wci.weight_conversion_id 
            ORDER BY wc.id DESC, wci.s_no ASC
          `,
          params: []
        }
      })
      
      if (Array.isArray(result)) {
        setRecords(result)
      } else if (result && result.success) {
        setRecords(result.data || [])
      } else {
        const errorMsg = (result && result.message) || 'Unknown error'
        console.error('Error loading weight conversions:', errorMsg)
        setRecords([])
      }
    } catch (error) {
      console.error('Error loading weight conversions:', error)
      setRecords([])
      setSnackbar({ open: true, message: 'Error loading weight conversions: ' + error.message, severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handlePrintRow = (record) => {
    const groupItems = records.filter(r => r.id === record.id);
    const inputItems = groupItems.filter(r => r.item_type === 'input');
    const outputItems = groupItems.filter(r => r.item_type === 'output');

    const html = `
      <html>
        <head>
          <title>Weight Conversion #${record.s_no || record.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
            h2 { color: #1e4fa8; border-bottom: 2px solid #1e4fa8; padding-bottom: 8px; margin-bottom: 15px; }
            .info { margin-bottom: 15px; display: flex; gap: 30px; font-size: 14px; background: #f5f8ff; padding: 10px; border-radius: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 13px; }
            th { background: #1e4fa8; color: white; }
            .section-title { font-weight: bold; margin-top: 15px; color: #1e4fa8; font-size: 15px; }
          </style>
        </head>
        <body>
          <h2>Weight Conversion Record</h2>
          <div class="info">
            <div><strong>S.No:</strong> ${record.s_no || ''}</div>
            <div><strong>Date:</strong> ${formatDate(record.date)}</div>
            <div><strong>Type:</strong> ${record.type || 'Standard'}</div>
            <div><strong>Remarks:</strong> ${record.remarks || '-'}</div>
          </div>

          <div class="section-title">Input Items</div>
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Item Name</th>
                <th>Lot No</th>
                <th>Weight</th>
                <th>Qty</th>
                <th>Total Wt</th>
              </tr>
            </thead>
            <tbody>
              ${inputItems.map((item, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${item.item_name || ''}</td>
                  <td>${item.lot_no || ''}</td>
                  <td>${item.weight || ''}</td>
                  <td>${item.qty || 0}</td>
                  <td>${parseFloat(item.total_wt || 0).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="section-title">Output Converted Items</div>
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Item Name</th>
                <th>Weight</th>
                <th>Qty</th>
                <th>Total Wt</th>
              </tr>
            </thead>
            <tbody>
              ${outputItems.map((item, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${item.item_name || ''}</td>
                  <td>${item.weight || ''}</td>
                  <td>${item.qty || 0}</td>
                  <td>${parseFloat(item.total_wt || 0).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `
    printHtml(html, `Weight Conversion #${record.s_no || record.id}`)
  };

  const handleEdit = (record) => {
    navigate(`/entry/weight-conversion-create?id=${record.id}`)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    try {
      const res = await fetch(`/api/weight-conversion/${deleteConfirmId}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (res.ok && (data.success !== false)) {
        setSnackbar({ open: true, message: 'Weight conversion deleted successfully!', severity: 'success' })
        loadWeightConversions()
      } else {
        setSnackbar({ open: true, message: 'Error deleting weight conversion: ' + (data.message || 'Unknown error'), severity: 'error' })
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Error deleting weight conversion: ' + error.message, severity: 'error' })
    } finally {
      setDeleteConfirmId(null);
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const filteredRecords = records.filter(record => {
    if (dateFrom && record.date < dateFrom) return false
    if (dateTo && record.date > dateTo) return false
    return true
  })

  const totalQtySum = filteredRecords.reduce((sum, r) => sum + (parseFloat(r.qty) || 0), 0)
  const totalWeightSum = filteredRecords.reduce((sum, r) => sum + (parseFloat(r.total_wt) || 0), 0)
  const uniqueParentIds = new Set(filteredRecords.map(r => r.id))
  const distinctRowsCount = uniqueParentIds.size

  let lastParentId = null;

  return (
    <div className="weight-conversion-display">
      <div className="window">
        <div className="title">
          <div>Weight Conversion Display</div>
          <div>
            <div className="filter-bar">
              <label>Date :</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style={{ width: '60px' }}>S.No</th>
              <th style={{ width: '100px' }}>Date</th>
              <th style={{ width: '150px' }}>Item Name</th>
              <th style={{ width: '100px' }}>Lot No</th>
              <th style={{ width: '100px' }}>Type</th>
              <th style={{ width: '80px' }}>Weight</th>
              <th style={{ width: '80px' }}>Qty</th>
              <th style={{ width: '100px' }}>Tot Wt</th>
              <th style={{ width: '120px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '20px' }}>Loading...</td>
              </tr>
            ) : filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '20px' }}>No records found</td>
              </tr>
            ) : (
              filteredRecords.map((record, index) => {
                const isFirstInGroup = record.id !== lastParentId;
                lastParentId = record.id;
                return (
                  <tr key={record.item_id || record.id || index} style={{ background: isFirstInGroup ? '#fff' : '#fcfdfe' }}>
                    <td style={{ fontWeight: isFirstInGroup ? 'bold' : 'normal', color: '#1e4fa8' }}>{isFirstInGroup ? record.s_no || index + 1 : ""}</td>
                    <td>{isFirstInGroup ? formatDate(record.date) : ""}</td>
                    <td>{record.item_name}</td>
                    <td>{record.lot_no}</td>
                    <td style={{ fontWeight: '600', color: record.item_type === 'output' ? '#16a34a' : '#2563eb' }}>
                      {record.item_type === 'output' ? 'Output' : 'Input'}
                    </td>
                    <td>{record.weight}</td>
                    <td style={{ textAlign: 'right', paddingRight: '8px' }}>{parseFloat(record.qty || 0).toFixed(3)}</td>
                    <td style={{ textAlign: 'right', paddingRight: '8px', fontWeight: 'bold' }}>{parseFloat(record.total_wt || 0).toFixed(3)}</td>
                    <td>
                      {isFirstInGroup && (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => handlePrintRow(record)} style={{ padding: '2px 8px', fontSize: '12px', background: '#0284c7', borderColor: '#0284c7', color: '#fff' }}>Print</button>
                          <button onClick={() => handleEdit(record)} style={{ padding: '2px 8px', fontSize: '12px' }}>Edit</button>
                          <button onClick={() => setDeleteConfirmId(record.id)} style={{ padding: '2px 8px', fontSize: '12px', background: '#d9534f', borderColor: '#d43f3a' }}>Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {!loading && filteredRecords.length > 0 && (
            <tfoot>
              <tr style={{ background: '#f5f8ff', fontWeight: 'bold', borderTop: '2px solid #9bb4e0' }}>
                <td colSpan="6" style={{ textAlign: 'right', paddingRight: '15px', height: '30px' }}>Total:</td>
                <td style={{ textAlign: 'right', paddingRight: '8px', color: '#1e4fa8' }}>{totalQtySum.toFixed(3)}</td>
                <td style={{ textAlign: 'right', paddingRight: '8px', color: '#1e4fa8' }}>{totalWeightSum.toFixed(3)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>

        <div className="footer">
          <div>
            <button onClick={handlePrint}>Print</button>
          </div>
          <div style={{ color: '#fff', fontSize: '15px' }}>
            Row(s): {distinctRowsCount} &nbsp;&nbsp; Total: <b>{totalWeightSum.toFixed(2)}</b>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', maxWidth: '400px', width: '100%', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
            <h3 style={{ marginTop: 0, color: '#1e293b' }}>Confirm Delete</h3>
            <p style={{ color: '#475569' }}>Are you sure you want to delete this weight conversion record?</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button 
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#f1f5f9', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleDeleteConfirm}
                style={{ padding: '8px 16px', border: 'none', borderRadius: '4px', backgroundColor: '#dc2626', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {snackbar.open && (
        <div className={`snackbar ${snackbar.severity}`}>
          {snackbar.message}
          <button onClick={() => setSnackbar({ ...snackbar, open: false })}>×</button>
        </div>
      )}
    </div>
  )
}

export default WeightConversionDisplay
