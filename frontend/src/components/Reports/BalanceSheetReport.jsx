import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { printHtml } from '../../utils/printHelper.js'
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
    if (!reportData) return;
    const html = `
      <div style="font-family: Arial, sans-serif; color: #0f172a; padding: 12px;">
        <div style="border-bottom: 2px solid #1f4fb2; padding-bottom: 8px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h2 style="margin: 0; color: #1f4fb2; font-size: 20px;">BALANCE SHEET REPORT</h2>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
              As On Date: <strong>${asOnDate || 'Current'}</strong> | Printed on: ${new Date().toLocaleString()}
            </div>
          </div>
          <div style="text-align: right; font-weight: bold; font-size: 12px; color: ${reportData.isBalanced ? '#059669' : '#dc2626'};">
            ${reportData.isBalanced ? '✓ Balanced' : '⚠ Imbalanced'}
          </div>
        </div>

        <div style="display: flex; gap: 20px; justify-content: space-between;">
          <div style="flex: 1;">
            <h3 style="background: #1f4fb2; color: #fff; padding: 6px 10px; margin: 0; font-size: 13px;">ASSETS</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px;">
              <tbody>
                <tr>
                  <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">Stock Value</td>
                  <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">${parseFloat(reportData.assets?.stockValue || 0).toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">Cash in Hand</td>
                  <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">${parseFloat(reportData.assets?.cashInHand || 0).toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">Accounts Receivable</td>
                  <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">${parseFloat(reportData.assets?.accountsReceivable || 0).toFixed(2)}</td>
                </tr>
                <tr style="background-color: #e2e8f0; font-weight: bold;">
                  <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">Total Assets</td>
                  <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; color: #059669;">₹ ${parseFloat(reportData.assets?.total || 0).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style="flex: 1;">
            <h3 style="background: #1f4fb2; color: #fff; padding: 6px 10px; margin: 0; font-size: 13px;">LIABILITIES & CAPITAL</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px;">
              <tbody>
                <tr>
                  <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">Accounts Payable</td>
                  <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">${parseFloat(reportData.liabilities?.accountsPayable || 0).toFixed(2)}</td>
                </tr>
                <tr style="background-color: #f1f5f9; font-weight: bold;">
                  <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">Total Liabilities</td>
                  <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">${parseFloat(reportData.liabilities?.total || 0).toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">Capital</td>
                  <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">${parseFloat(reportData.capital || 0).toFixed(2)}</td>
                </tr>
                <tr style="background-color: #e2e8f0; font-weight: bold;">
                  <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">Total Liabilities & Capital</td>
                  <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; color: #1f4fb2;">₹ ${(parseFloat(reportData.liabilities?.total || 0) + parseFloat(reportData.capital || 0)).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    printHtml(html, 'Balance_Sheet_Report');
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
