import React, { useState, useEffect } from 'react'
import api from '../../utils/api.js'
import './ReportPage.css'

/**
 * OutstandingSummaryReport - Shows pending balances
 * Blue & White theme following the uniform information page format
 */
const OutstandingSummaryReport = () => {
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
      const result = await api('/reports/outstanding-summary', { params: { as_on_date: asOnDate } })
      
      if (result.success && Array.isArray(result.data)) {
        setReportData(result.data)
      } else {
        setError(result.message || 'Failed to load Outstanding Summary')
      }
    } catch (err) {
      console.error('Error fetching outstanding summary:', err)
      setError('Failed to load Outstanding Summary')
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
    .reduce((sum, r) => sum + (parseFloat(r.balance) || 0), 0)
  
  const totalPayable = safeReportData
    .filter(r => r.type === 'Payable')
    .reduce((sum, r) => sum + (parseFloat(r.balance) || 0), 0)

  return (
    <div className="window">
      <div className="screen-title">Outstanding Summary</div>

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
                <th className="text-right">Total</th>
                <th className="text-right">Paid</th>
                <th className="text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {safeReportData.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center">No outstanding balances</td>
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
                      <td className="text-right">
                        {(parseFloat(row.total_purchase) || parseFloat(row.total_sales) || 0).toFixed(2)}
                      </td>
                      <td className="text-right">
                        {(parseFloat(row.total_payment) || parseFloat(row.total_receipt) || 0).toFixed(2)}
                      </td>
                      <td className="text-right">{parseFloat(row.balance || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td colSpan="4"><strong>Net Balance</strong></td>
                    <td className="text-right">
                      <strong>{(totalReceivable - totalPayable).toFixed(2)}</strong>
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default OutstandingSummaryReport
