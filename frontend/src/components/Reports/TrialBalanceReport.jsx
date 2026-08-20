import React, { useState, useEffect } from 'react'
import api from '../../utils/api.js'
import './ReportPage.css'

/**
 * TrialBalanceReport - Shows ledger-wise Debit & Credit summary
 * Blue & White theme following the uniform information page format
 */
const TrialBalanceReport = () => {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [reportData, setReportData] = useState({ ledgers: [], totalDebit: 0, totalCredit: 0, isBalanced: true })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Set default dates (current financial year starting April 1st)
  useEffect(() => {
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth() // 0-indexed: 0 = Jan, 11 = Dec
    const startYear = currentMonth >= 3 ? currentYear : currentYear - 1
    const firstDay = new Date(startYear, 3, 1) // April 1st
    setFromDate(firstDay.toISOString().split('T')[0])
    setToDate(today.toISOString().split('T')[0])
  }, [])

  // Fetch report data
  const fetchReport = async () => {
    if (!fromDate || !toDate) return
    
    setLoading(true)
    setError('')
    
    try {
      const params = {}
      if (fromDate) params.from_date = fromDate
      if (toDate) params.to_date = toDate
      
      const result = await api('/reports/trial-balance', { params })
      
      // Handle response data
      if (result.success && result.data && typeof result.data === 'object') {
        setReportData({
          ledgers: Array.isArray(result.data.ledgers) ? result.data.ledgers : [],
          totalDebit: parseFloat(result.data.totalDebit) || 0,
          totalCredit: parseFloat(result.data.totalCredit) || 0,
          isBalanced: result.data.isBalanced
        })
      } else {
        setError(result.message || 'Failed to load Trial Balance')
      }
    } catch (err) {
      console.error('Error fetching trial balance:', err)
      setError('Failed to load Trial Balance')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (fromDate && toDate) {
      fetchReport()
    }
  }, [fromDate, toDate])

  const handlePrint = () => {
    window.print()
  }

  const safeLedgers = Array.isArray(reportData.ledgers) ? reportData.ledgers : []

  return (
    <div className="window">
      <div className="screen-title"> Trial Balance</div>

      {/* Filter Section */}
      <div className="report-filters">
        <div className="filter-row">
          <div className="filter-group">
            <label>From Date:</label>
            <input
              type="date"
              className="uniform-input"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>To Date:</label>
            <input
              type="date"
              className="uniform-input"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
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

      {/* Balance Status */}
      {!loading && (
        <div className={`balance-status ${reportData.isBalanced ? 'balanced' : 'imbalanced'}`}>
          {reportData.isBalanced ? '✓ Trial Balance is Balanced' : '⚠ Trial Balance is NOT Balanced'}
        </div>
      )}

      {/* Report Table */}
      {!loading && (
        <div className="report-table-container">
          <table className="report-table">
            <thead>
              <tr>
                <th>Ledger Name</th>
                <th className="text-right">Debit</th>
                <th className="text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {safeLedgers.length === 0 ? (
                <tr>
                  <td colSpan="3" className="text-center">No data available</td>
                </tr>
              ) : (
                <>
                  {safeLedgers.map((row, index) => (
                    <tr key={index}>
                      <td>{row.ledger_name || '-'}</td>
                      <td className="text-right">{parseFloat(row.debit || 0).toFixed(2)}</td>
                      <td className="text-right">{parseFloat(row.credit || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td><strong>Total</strong></td>
                    <td className="text-right"><strong>{reportData.totalDebit.toFixed(2)}</strong></td>
                    <td className="text-right"><strong>{reportData.totalCredit.toFixed(2)}</strong></td>
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

export default TrialBalanceReport
