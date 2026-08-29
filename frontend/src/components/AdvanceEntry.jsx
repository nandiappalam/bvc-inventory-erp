import React, { useState, useEffect } from 'react'
import { getAdvances, deleteAdvance } from '../utils/api'
import './AdvanceEntry.css'

const AdvanceEntry = () => {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')
  const [selectedRow, setSelectedRow] = useState(null)
  const [showModal, setShowModal] = useState(false)

  const fetchRows = async () => {
    try {
      const result = await getAdvances()
      // Handle null/undefined result, failed query, or non-array data
      if (result && result.success) {
        // Ensure data is always an array
        const data = result.data
        if (Array.isArray(data)) {
          setRows(data)
        } else if (data === null || data === undefined) {
          setRows([])
        } else {
          console.warn('[AdvanceEntry] Unexpected data format:', data)
          setRows([])
        }
      } else {
        // Handle failed query or null result - don't crash, show empty
        console.warn('[AdvanceEntry] Query failed or returned null:', result)
        setRows([])
      }
    } catch (error) {
      console.error('[AdvanceEntry] Error loading advances:', error)
      // Don't crash on error - show empty table
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRows()
  }, [])

  const handleDelete = async (row) => {
    if (!window.confirm('Delete this advance?')) return
    try {
      const result = await deleteAdvance(row.id)
      if (result.success) {
        setMessage('Deleted')
        fetchRows()
        setTimeout(() => setMessage(''), 3000)
      } else {
        setMessage(result.message || 'Error deleting')
        setMessageType('error')
      }
    } catch (error) {
      setMessage('Error deleting')
      setMessageType('error')
    }
  }

  const handlePrint = (row) => {
    const w = window.open('', '', 'width=800,height=600')
    w.document.write(`<html><body><h3>Advance</h3><p>Papad Company: ${row.papad_company_name || row.company || row.papad_company}</p><p>Amount: ${row.amount}</p></body></html>`)
    w.print()
  }

  if (loading) return <div className="loading-state">Loading...</div>

  return (
    <div>
      {/* Top Title */}
      <div className="top-bar">Advance Entry</div>

      {/* Window Header */}
      <div className="window-header">
        Advance Display
        <span className="close">✕</span>
      </div>

      {message && <div className={`message-box ${messageType}`}>{message}</div>}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Company</th>
              <th>Amount</th>
              <th>Pay Mode</th>
              <th className="actions-header">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                <td>{row.date}</td>
<td>{row.papad_company_name || row.company || row.papad_company}</td>
                <td>{row.amount}</td>
                <td>{row.pay_mode}</td>
                <td className="actions-cell">
                  <button className="action-btn print-btn" onClick={() => handlePrint(row)}>Print</button>
                  <button className="action-btn delete-btn" onClick={() => handleDelete(row)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AdvanceEntry
