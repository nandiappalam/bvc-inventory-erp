import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/api.js'
import './ReportPage.css'

/**
 * OutstandingDetailsReport - Shows bill-wise pending details
 * Blue & White theme following the uniform information page format
 */
const OutstandingDetailsReport = () => {
  const navigate = useNavigate()
  const [asOnDate, setAsOnDate] = useState('')
  const [reportData, setReportData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Set default date (today)
  useEffect(() => {
    setAsOnDate(new Date().toISOString().split('T')[0])
  }, [])

  // Fetch report data
  const fetchReport = async () => {
    if (!asOnDate) return
    
    setLoading(true)
    setError('')
    
    try {
      const result = await api('/reports/outstanding-details', { params: { as_on_date: asOnDate } })
      
      if (result.success && Array.isArray(result.data)) {
        setReportData(result.data)
      } else {
        setError(result.message || 'Failed to load Outstanding Details')
      }
    } catch (err) {
      console.error('Error fetching outstanding details:', err)
      setError('Failed to load Outstanding Details')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (asOnDate) {
      fetchReport()
    }
  }, [asOnDate])

  const handlePrint = () => {
    window.print()
  }

  const safeReportData = Array.isArray(reportData) ? reportData : []

  // Calculate totals
  const totalReceivable = safeReportData
    .filter(r => r.type === 'Receivable')
    .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
  
  const totalPayable = safeReportData
    .filter(r => r.type === 'Payable')
    .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)

  return (
    <div className="window">
      <div className="screen-title">Outstanding Details</div>

      {/* Filter Section */}
      <div className="report-filters">
        <div className="filter-row">
          <div className="filter-group">
            <label>As On Date:</label>
            <input
              type="date"
              className="uniform-input"
              value={asOnDate}
              onChange={(e) => setAsOnDate(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>&nbsp;</label>
            <button className="btn btn-primary" onClick={fetchReport}>
              Search
            </button>
          </div>

          <div className="filter-group">
            <label>&nbsp;</label>
            <button className="btn btn-secondary" onClick={handlePrint}>
              Print
            </button>
          </div>
        </div>
      </div>

      {error && <div className="message-box error">{error}</div>}
      {loading && <div className="loading">Loading...</div>}

      {/* Summary Cards */}
      {!loading && (
        <div className="summary-cards">
          <div className="summary-card receivable">
            <h4>Total Receivable</h4>
            <p className="amount">{totalReceivable.toFixed(2)}</p>
          </div>
          <div className="summary-card payable">
            <h4>Total Payable</h4>
            <p className="amount">{totalPayable.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Report Table */}
      {!loading && (
        <div className="report-table-container">
          <table className="report-table">
            <thead>
              <tr>
                <th>Ledger Name</th>
                <th>Type</th>
                <th>Invoice No</th>
                <th>Date</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Paid</th>
                <th className="text-right">Balance</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {safeReportData.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center">No outstanding bills</td>
                </tr>
              ) : (
                <>
                  {safeReportData.map((row, index) => (
                    <tr key={index}>
                      <td>{row.ledger_name || '-'}</td>
                      <td>
                        <span className={`type-badge ${row.type?.toLowerCase()}`}>
                          {row.type || '-'}
                        </span>
                      </td>
                      <td>{row.invoice_no || '-'}</td>
                      <td>{row.date ? new Date(row.date).toLocaleDateString() : '-'}</td>
                      <td className="text-right">{parseFloat(row.amount || 0).toFixed(2)}</td>
                      <td className="text-right">{parseFloat(row.paid || 0).toFixed(2)}</td>
                      <td className="text-right">{parseFloat(row.balance || 0).toFixed(2)}</td>
                      <td className="text-center">
                        <button
                          className="btn btn-sm btn-primary"
                          style={{ fontSize: '11px', padding: '3px 10px', textTransform: 'none', fontWeight: 'bold' }}
                          onClick={() => navigate('/entry/voucher-create', { state: { prefillBill: row } })}
                          title="Proceed with Voucher Creation for this Bill"
                        >
                          ⚡ Create Voucher
                        </button>
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default OutstandingDetailsReport
