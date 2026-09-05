import React, { useState, useEffect } from 'react'
import api from '../../services/api.js'
export const safeArray = (arr) => Array.isArray(arr) ? arr : [];
import './ReportPage.css'

/**
 * DayBookReport - Shows all transactions date-wise (chronological order)
 * Blue & White theme following the uniform information page format
 */
const DayBookReport = () => {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [reportData, setReportData] = useState([])
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
      
      const result = await api.get('/reports/daybook', { params })
      
      // Handle response data
      let responseData = []
      if (result.success && result.data) {
        responseData = Array.isArray(result.data) ? result.data : []
      } else {
        console.error('Error fetching daybook:', result.message)
        setError(result.message || 'Failed to load Day Book')
      }
      setReportData(responseData)
    } catch (err) {
      console.error('Error fetching daybook:', err)
      setError('Failed to load Day Book')
      setReportData([])
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

  // Ensure data is always an array
  const safeReportData = Array.isArray(reportData) ? reportData : []

  // Calculate totals
  const totalDebit = safeReportData.reduce((sum, row) => sum + (parseFloat(row.debit) || 0), 0)
  const totalCredit = safeReportData.reduce((sum, row) => sum + (parseFloat(row.credit) || 0), 0)

  return (
    <div className="window">
      <div className="screen-title">Day Book</div>

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
      {!loading && (
        <div className="report-table-container">
          <table className="report-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Voucher Type</th>
                <th>Voucher No</th>
                <th>Ledger Name</th>
                <th className="text-right">Debit</th>
                <th className="text-right">Credit</th>
                <th className="text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {safeReportData.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center">No transactions found</td>
                </tr>
              ) : (
                <>
                  {safeReportData.map((row, index) => (
                    <tr key={index}>
                      <td>{row.date ? new Date(row.date).toLocaleDateString() : '-'}</td>
                      <td>{row.voucher_type || '-'}</td>
                      <td>{row.voucher_no || '-'}</td>
                      <td>{row.ledger_name || '-'}</td>
                      <td className="text-right">{parseFloat(row.debit || 0).toFixed(2)}</td>
                      <td className="text-right">{parseFloat(row.credit || 0).toFixed(2)}</td>
                      <td className="text-right">{parseFloat(row.balance || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td colSpan="4"><strong>Total</strong></td>
                    <td className="text-right"><strong>{totalDebit.toFixed(2)}</strong></td>
                    <td className="text-right"><strong>{totalCredit.toFixed(2)}</strong></td>
                    <td className="text-right"></td>
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

export default DayBookReport
