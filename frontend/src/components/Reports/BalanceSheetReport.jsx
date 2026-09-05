import React, { useState, useEffect } from 'react'
import axios from 'axios'
import './ReportPage.css'

/**
 * BalanceSheetReport - Shows Assets & Liabilities
 * Blue & White theme following the uniform information page format
 */
const BalanceSheetReport = () => {
  const [asOnDate, setAsOnDate] = useState('')
  const [reportData, setReportData] = useState(null)
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
      const response = await axios.get(`/api/reports/balance-sheet?as_on_date=${asOnDate}`)
      
      if (response.data && typeof response.data === 'object') {
        setReportData(response.data)
      }
    } catch (err) {
      console.error('Error fetching balance sheet:', err)
      setError('Failed to load Balance Sheet')
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

  return (
    <div className="window">
      <div className="screen-title">Balance Sheet</div>

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

      {/* Balance Status */}
      {!loading && reportData && (
        <div className={`balance-status ${reportData.isBalanced ? 'balanced' : 'imbalanced'}`}>
          {reportData.isBalanced ? '✓ Balance Sheet is Balanced' : '⚠ Balance Sheet is NOT Balanced'}
        </div>
      )}

      {/* Report Table - Two Column Layout */}
      {!loading && reportData && (
        <div className="report-table-container">
          <div className="balance-sheet-container">
            {/* Assets Column */}
            <div className="balance-sheet-column">
              <h3 className="column-header">ASSETS</h3>
              <table className="report-table">
                <tbody>
                  <tr>
                    <td>Stock Value</td>
                    <td className="text-right">{parseFloat(reportData.assets?.stockValue || 0).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>Cash in Hand</td>
                    <td className="text-right">{parseFloat(reportData.assets?.cashInHand || 0).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>Accounts Receivable</td>
                    <td className="text-right">{parseFloat(reportData.assets?.accountsReceivable || 0).toFixed(2)}</td>
                  </tr>
                  <tr className="total-row">
                    <td><strong>Total Assets</strong></td>
                    <td className="text-right"><strong>{parseFloat(reportData.assets?.total || 0).toFixed(2)}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Liabilities Column */}
            <div className="balance-sheet-column">
              <h3 className="column-header">LIABILITIES</h3>
              <table className="report-table">
                <tbody>
                  <tr>
                    <td>Accounts Payable</td>
                    <td className="text-right">{parseFloat(reportData.liabilities?.accountsPayable || 0).toFixed(2)}</td>
                  </tr>
                  <tr className="total-row">
                    <td><strong>Total Liabilities</strong></td>
                    <td className="text-right"><strong>{parseFloat(reportData.liabilities?.total || 0).toFixed(2)}</strong></td>
                  </tr>
                  <tr>
                    <td>Capital</td>
                    <td className="text-right">{parseFloat(reportData.capital || 0).toFixed(2)}</td>
                  </tr>
                  <tr className="total-row">
                    <td><strong>Total</strong></td>
                    <td className="text-right"><strong>{(parseFloat(reportData.liabilities?.total || 0) + parseFloat(reportData.capital || 0)).toFixed(2)}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BalanceSheetReport
