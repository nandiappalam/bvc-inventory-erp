import React, { useState, useEffect } from 'react'
import api from '../../utils/api.js'
import './ReportPage.css'

/**
 * ProfitLossReport - Shows Income & Expenses
 * Blue & White theme following the uniform information page format
 */
const ProfitLossReport = () => {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Set default dates (current month)
  useEffect(() => {
    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
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
      
      const result = await api('/reports/profit-loss', { params })
      
      if (result.success && result.data && typeof result.data === 'object') {
        setReportData(result.data)
      } else {
        setError(result.message || 'Failed to load Profit & Loss')
      }
    } catch (err) {
      console.error('Error fetching profit & loss:', err)
      setError('Failed to load Profit & Loss')
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

  return (
    <div className="window">
      <div className="screen-title">Profit & Loss Account</div>

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

      {/* Report Table */}
      {!loading && reportData && (
        <div className="report-table-container">
          <table className="report-table">
            <thead>
              <tr>
                <th>Particulars</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {/* Income Section */}
              <tr className="section-header">
                <td colSpan="2"><strong>INCOME</strong></td>
              </tr>
              <tr>
                <td>Sales</td>
                <td className="text-right">{parseFloat(reportData.income?.sales || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td>Less: Sales Returns</td>
                <td className="text-right">({parseFloat(reportData.income?.salesReturns || 0).toFixed(2)})</td>
              </tr>
              <tr className="total-row">
                <td><strong>Total Income</strong></td>
                <td className="text-right"><strong>{parseFloat(reportData.income?.totalSales || 0).toFixed(2)}</strong></td>
              </tr>

              {/* Expenses Section */}
              <tr className="section-header">
                <td colSpan="2"><strong>EXPENSES</strong></td>
              </tr>
              <tr>
                <td>Purchases</td>
                <td className="text-right">{parseFloat(reportData.expenses?.purchases || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td>Less: Purchase Returns</td>
                <td className="text-right">({parseFloat(reportData.expenses?.purchaseReturns || 0).toFixed(2)})</td>
              </tr>
              <tr>
                <td>Add: Closing Stock</td>
                <td className="text-right">{parseFloat(reportData.expenses?.closingStock || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td>Less: Opening Stock</td>
                <td className="text-right">({parseFloat(reportData.expenses?.openingStock || 0).toFixed(2)})</td>
              </tr>
              <tr>
                <td>Other Expenses</td>
                <td className="text-right">{parseFloat(reportData.expenses?.otherExpenses || 0).toFixed(2)}</td>
              </tr>
              <tr className="total-row">
                <td><strong>Total Expenses</strong></td>
                <td className="text-right"><strong>{parseFloat(reportData.expenses?.totalExpenses || 0).toFixed(2)}</strong></td>
              </tr>

              {/* Net Result */}
              <tr className={`total-row ${reportData.isProfit ? 'profit' : 'loss'}`}>
                <td><strong>{reportData.isProfit ? 'NET PROFIT' : 'NET LOSS'}</strong></td>
                <td className="text-right">
                  <strong>
                    {reportData.isProfit 
                      ? parseFloat(reportData.netProfit || 0).toFixed(2)
                      : parseFloat(reportData.netLoss || 0).toFixed(2)
                    }
                  </strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default ProfitLossReport
