import React, { useState, useEffect } from 'react'
import axios from 'axios'
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

  const handlePrint = () => { window.print() }

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
