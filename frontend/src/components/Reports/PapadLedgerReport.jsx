import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { printHtml } from '../../utils/printHelper.js'
import './ReportPage.css'

/**
 * PapadLedgerReport - Track full financial ledger: Supplier payments, Customer receipts, Debit/Credit
 * Fixed version with robust data handling
 */
const PapadLedgerReport = () => {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [papadCompany, setPapadCompany] = useState('')
  const [papadCompanies, setPapadCompanies] = useState([])
  const [reportData, setReportData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await axios.get('/api/masters/papad_companies')
        if (res.data) {
          const comps = Array.isArray(res.data) ? res.data : (res.data.data || [])
          setPapadCompanies(comps)
        }
      } catch (err) {
        console.error('Error fetching papad companies master:', err)
      }
    }
    fetchCompanies()
  }, [])

  const fetchReport = async () => {
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (fromDate) params.from_date = fromDate
      if (toDate) params.to_date = toDate
      if (papadCompany) params.papad_company = papadCompany
      
      const queryString = new URLSearchParams(params).toString()
      const response = await axios.get(`/api/reports/papad-ledger${queryString ? '?' + queryString : ''}`)
      
      // Robust data handling
      let responseData = []
      if (response.data) {
        if (Array.isArray(response.data)) {
          responseData = response.data
        } else if (typeof response.data === 'object') {
          responseData = Array.isArray(response.data.data) ? response.data.data : []
        }
      }
      setReportData(responseData)
    } catch (err) {
      console.error('Error fetching papad ledger:', err)
      setError('Failed to load papad ledger')
      setReportData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchReport() }, [fromDate, toDate, papadCompany])

  const handlePrint = () => {
    const rowsHtml = safeReportData.map((row, idx) => `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${row.date || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: bold; color: #1f4fb2;">${row.voucher_no || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">${row.voucher_type || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">${row.particulars || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; color: ${parseFloat(row.debit) > 0 ? '#059669' : 'inherit'};">${parseFloat(row.debit || 0) > 0 ? parseFloat(row.debit).toFixed(2) : '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; color: ${parseFloat(row.credit) > 0 ? '#d97706' : 'inherit'};">${parseFloat(row.credit || 0) > 0 ? parseFloat(row.credit).toFixed(2) : '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold;">${parseFloat(row.balance || 0).toFixed(2)}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; color: #0f172a; padding: 12px;">
        <div style="border-bottom: 2px solid #1f4fb2; padding-bottom: 8px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h2 style="margin: 0; color: #1f4fb2; font-size: 20px;">PAPAD LEDGER REPORT</h2>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
              Company: <strong>${papadCompany || 'All Companies'}</strong> | Period: <strong>${fromDate || 'Start'}</strong> to <strong>${toDate || 'End'}</strong> | Printed on: ${new Date().toLocaleString()}
            </div>
          </div>
          <div style="text-align: right; font-size: 12px; color: #475569;">
            Closing Balance: <strong style="color: #1f4fb2;">₹ ${parseFloat(finalBalance || 0).toFixed(2)}</strong>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background-color: #1f4fb2; color: #ffffff;">
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: center;">Date</th>
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: left;">Voucher No</th>
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: left;">Voucher Type</th>
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: left;">Particulars</th>
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: right;">Debit (₹)</th>
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: right;">Credit (₹)</th>
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: right;">Balance (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="7" style="text-align:center; padding: 14px;">No papad ledger records found</td></tr>'}
          </tbody>
          <tfoot>
            <tr style="background-color: #e2e8f0; font-weight: bold;">
              <td colspan="4" style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">Totals:</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; color: #059669;">₹ ${totalDebit.toFixed(2)}</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; color: #d97706;">₹ ${totalCredit.toFixed(2)}</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; color: #1f4fb2;">₹ ${parseFloat(finalBalance || 0).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    printHtml(html, 'Papad_Ledger_Report');
  }

  // Ensure data is always an array
  const safeReportData = Array.isArray(reportData) ? reportData : []

  const totalDebit = safeReportData.reduce((sum, row) => sum + (parseFloat(row.debit) || 0), 0)
  const totalCredit = safeReportData.reduce((sum, row) => sum + (parseFloat(row.credit) || 0), 0)
  const finalBalance = safeReportData.length > 0 ? safeReportData[safeReportData.length - 1].balance : 0

  return (
    <div className="window">
      <div className="screen-title">Papad Ledger (Payment Report)</div>
      <div className="report-filters">
        <div className="filter-row" style={{ flexWrap: 'wrap', gap: '15px' }}>
          <div className="filter-group">
            <label>Papad Company:</label>
            <select
              className="uniform-input"
              value={papadCompany}
              onChange={(e) => setPapadCompany(e.target.value)}
              style={{ minWidth: '220px' }}
            >
              <option value="">-- All Papad Companies --</option>
              {papadCompanies.map((comp) => (
                <option key={comp.id || comp.name} value={comp.name}>
                  {comp.name}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>From Date:</label>
            <input type="date" className="uniform-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="filter-group">
            <label>To Date:</label>
            <input type="date" className="uniform-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="filter-group">
            <label>&nbsp;</label>
            <button className="btn btn-primary" onClick={fetchReport}>Refresh</button>
          </div>
          <div className="filter-group">
            <label>&nbsp;</label>
            <button className="btn btn-secondary" onClick={handlePrint}>Print</button>
          </div>
        </div>
      </div>
      {error && <div className="message-box error">{error}</div>}
      {loading && <div className="loading">Loading...</div>}
      {!loading && (
        <div className="report-table-container">
          <table className="report-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Voucher No</th>
                <th>Particulars</th>
                <th>Type</th>
                <th className="text-right">Debit</th>
                <th className="text-right">Credit</th>
                <th className="text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {safeReportData.length === 0 ? (
                <tr><td colSpan="7" className="text-center">No data available</td></tr>
              ) : (
                <>
                  {safeReportData.map((row, i) => (
                    <tr key={i}>
                      <td>{row.date ? new Date(row.date).toLocaleDateString() : '-'}</td>
                      <td>{row.voucher_no || '-'}</td>
                      <td>{row.particulars || '-'}</td>
                      <td>{row.type || '-'}</td>
                      <td className="text-right">{parseFloat(row.debit || 0).toFixed(2)}</td>
                      <td className="text-right">{parseFloat(row.credit || 0).toFixed(2)}</td>
                      <td className="text-right" style={{ fontWeight: 'bold', color: (row.balance || 0) < 0 ? 'red' : 'green' }}>
                        {parseFloat(row.balance || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td colSpan="4"><strong>Total</strong></td>
                    <td className="text-right"><strong>{totalDebit.toFixed(2)}</strong></td>
                    <td className="text-right"><strong>{totalCredit.toFixed(2)}</strong></td>
                    <td className="text-right"><strong>{finalBalance.toFixed(2)}</strong></td>
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

export default PapadLedgerReport
