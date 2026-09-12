import React, { useState, useEffect } from 'react'
import api from '../../services/api.js'
import { printHtml } from '../../utils/printHelper.js'
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
    const rowsHtml = safeReportData.map((row, idx) => `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${row.voucher_date || row.date || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: bold; color: #1f4fb2;">${row.voucher_no || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">${row.voucher_type || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 600;">${row.account_name || row.particulars || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; color: ${parseFloat(row.debit) > 0 ? '#059669' : 'inherit'};">${parseFloat(row.debit || 0) > 0 ? parseFloat(row.debit).toFixed(2) : '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; color: ${parseFloat(row.credit) > 0 ? '#d97706' : 'inherit'};">${parseFloat(row.credit || 0) > 0 ? parseFloat(row.credit).toFixed(2) : '-'}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; color: #0f172a; padding: 12px;">
        <div style="border-bottom: 2px solid #1f4fb2; padding-bottom: 8px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h2 style="margin: 0; color: #1f4fb2; font-size: 20px;">DAY BOOK REPORT</h2>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
              Period: <strong>${fromDate || 'Start'}</strong> to <strong>${toDate || 'End'}</strong> | Printed on: ${new Date().toLocaleString()}
            </div>
          </div>
          <div style="text-align: right; font-size: 12px; color: #475569;">
            Total Vouchers: <strong>${safeReportData.length}</strong>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px;">
          <tr style="background: #f1f5f9;">
            <td style="padding: 8px 12px; border: 1px solid #cbd5e1; width: 50%;">
              <div style="font-size: 10px; color: #64748b;">Total Debit Amount</div>
              <div style="font-size: 14px; font-weight: bold; color: #059669;">₹ ${totalDebit.toFixed(2)}</div>
            </td>
            <td style="padding: 8px 12px; border: 1px solid #cbd5e1; width: 50%;">
              <div style="font-size: 10px; color: #64748b;">Total Credit Amount</div>
              <div style="font-size: 14px; font-weight: bold; color: #d97706;">₹ ${totalCredit.toFixed(2)}</div>
            </td>
          </tr>
        </table>

        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background-color: #1f4fb2; color: #ffffff;">
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: center;">Date</th>
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: left;">Voucher No</th>
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: left;">Type</th>
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: left;">Particulars</th>
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: right;">Debit (₹)</th>
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: right;">Credit (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="6" style="text-align:center; padding: 14px;">No vouchers recorded</td></tr>'}
          </tbody>
          <tfoot>
            <tr style="background-color: #e2e8f0; font-weight: bold;">
              <td colspan="4" style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">Grand Total:</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; color: #059669;">₹ ${totalDebit.toFixed(2)}</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; color: #d97706;">₹ ${totalCredit.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>

        <div style="margin-top: 24px; border-top: 1px solid #cbd5e1; padding-top: 8px; font-size: 10px; color: #64748b; display: flex; justify-content: space-between;">
          <span>BVC ERP System - Day Book Report</span>
          <span>Printed on ${new Date().toLocaleString()}</span>
        </div>
      </div>
    `;

    printHtml(html, 'Day_Book_Report');
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
