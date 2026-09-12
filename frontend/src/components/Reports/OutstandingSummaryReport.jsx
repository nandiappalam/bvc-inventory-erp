import React, { useState, useEffect } from 'react'
import api from '../../utils/api.js'
import { printHtml } from '../../utils/printHelper.js'
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
    const rowsHtml = safeReportData.map((row, idx) => `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${idx + 1}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 600;">${row.party_name || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${row.party_type || row.type || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: ${row.type === 'Receivable' ? '#059669' : '#dc2626'};">${parseFloat(row.balance || 0).toFixed(2)}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold;">${row.type || 'Receivable'}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; color: #0f172a; padding: 12px;">
        <div style="border-bottom: 2px solid #1f4fb2; padding-bottom: 8px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h2 style="margin: 0; color: #1f4fb2; font-size: 20px;">OUTSTANDING SUMMARY REPORT</h2>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
              As On Date: <strong>${asOnDate || 'Current'}</strong> | Printed on: ${new Date().toLocaleString()}
            </div>
          </div>
          <div style="text-align: right; font-size: 11px; color: #475569;">
            Total Receivables: <strong style="color:#059669">₹ ${totalReceivable.toFixed(2)}</strong> | 
            Total Payables: <strong style="color:#dc2626">₹ ${totalPayable.toFixed(2)}</strong>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background-color: #1f4fb2; color: #ffffff;">
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: center;">#</th>
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: left;">Party Name</th>
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: center;">Category</th>
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: right;">Outstanding Balance (₹)</th>
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="5" style="text-align:center; padding: 14px;">No outstanding summary available</td></tr>'}
          </tbody>
        </table>
      </div>
    `;

    printHtml(html, 'Outstanding_Summary_Report');
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
