import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/api.js'
import { printHtml } from '../../utils/printHelper.js'
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
    const rowsHtml = safeReportData.map((row, idx) => `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 600;">${row.party_name || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: bold; color: #1f4fb2;">${row.bill_no || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${row.bill_date || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${row.due_date || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">${row.overdue_days || 0}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: ${row.type === 'Receivable' ? '#059669' : '#dc2626'};">${parseFloat(row.amount || 0).toFixed(2)}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold;">${row.type || 'Receivable'}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; color: #0f172a; padding: 12px;">
        <div style="border-bottom: 2px solid #1f4fb2; padding-bottom: 8px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h2 style="margin: 0; color: #1f4fb2; font-size: 20px;">OUTSTANDING DETAILS REPORT</h2>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
              As On Date: <strong>${asOnDate || 'Current'}</strong> | Printed on: ${new Date().toLocaleString()}
            </div>
          </div>
          <div style="text-align: right; font-size: 11px; color: #475569;">
            Receivables: <strong style="color:#059669">₹ ${totalReceivable.toFixed(2)}</strong> | 
            Payables: <strong style="color:#dc2626">₹ ${totalPayable.toFixed(2)}</strong>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background-color: #1f4fb2; color: #ffffff;">
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: left;">Party Name</th>
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: left;">Bill No</th>
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: center;">Bill Date</th>
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: center;">Due Date</th>
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: right;">Overdue (Days)</th>
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: right;">Amount (₹)</th>
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: center;">Type</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="7" style="text-align:center; padding: 14px;">No outstanding records found</td></tr>'}
          </tbody>
        </table>
      </div>
    `;

    printHtml(html, 'Outstanding_Details_Report');
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
