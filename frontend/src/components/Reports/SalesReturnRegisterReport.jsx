import React, { useState, useEffect } from 'react'
import axios from 'axios'
import './ReportPage.css'

/**
 * SalesReturnRegisterReport - Track returned sales
 * Fixed version with robust data handling
 */
const SalesReturnRegisterReport = () => {
  const [customers, setCustomers] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [reportData, setReportData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const response = await axios.get('/api/masters/customer_master')
        const customersData = Array.isArray(response.data) 
          ? response.data 
          : (response.data?.data || [])
        setCustomers(customersData)
      } catch (err) {
        console.error('Error fetching customers:', err)
        setCustomers([])
      }
    }
    fetchCustomers()
  }, [])

  const fetchReport = async () => {
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (selectedCustomer) params.customer_id = selectedCustomer
      if (fromDate) params.from_date = fromDate
      if (toDate) params.to_date = toDate
      
      const queryString = new URLSearchParams(params).toString()
      const response = await axios.get(`/api/reports/sales-return-register${queryString ? '?' + queryString : ''}`)
      
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
      console.error('Error fetching sales return register:', err)
      setError('Failed to load sales return register')
      setReportData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchReport() }, [selectedCustomer, fromDate, toDate])

  const handlePrint = () => { window.print() }
  
  // Ensure data is always an array
  const safeReportData = Array.isArray(reportData) ? reportData : []
  
  const totalAmount = safeReportData.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0)

  return (
    <div className="window">
      <div className="screen-title">Sales Return Register</div>
      <div className="report-filters">
        <div className="filter-row">
          <div className="filter-group">
            <label>Customer:</label>
            <select className="uniform-input" value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)}>
              <option value="">All Customers</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
            <button className="btn btn-primary" onClick={fetchReport}> Refresh</button>
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
              <tr><th>Date</th><th>Return No</th><th>Customer</th><th>Item</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">Amount</th><th>Remarks</th></tr>
            </thead>
            <tbody>
              {safeReportData.length === 0 ? (
                <tr><td colSpan="8" className="text-center">No data available</td></tr>
              ) : (
                <>
                  {safeReportData.map((row, i) => (
                    <tr key={i}>
                      <td>{row.date ? new Date(row.date).toLocaleDateString() : '-'}</td>
                      <td>{row.return_no || '-'}</td>
                      <td>{row.customer_name || '-'}</td>
                      <td>{row.item_name || '-'}</td>
                      <td className="text-right">{parseFloat(row.qty || 0).toFixed(2)}</td>
                      <td className="text-right">{parseFloat(row.rate || 0).toFixed(2)}</td>
                      <td className="text-right">{parseFloat(row.amount || 0).toFixed(2)}</td>
                      <td>{row.remarks || '-'}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td colSpan="6"><strong>Total</strong></td>
                    <td className="text-right"><strong>{totalAmount.toFixed(2)}</strong></td>
                    <td></td>
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

export default SalesReturnRegisterReport
