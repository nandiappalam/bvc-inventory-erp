import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { printHtml } from '../../utils/printHelper.js'
import './ReportPage.css'

/**
 * SalesRegisterReport - All sales entries with customer and item details
 * Fixed version with robust data handling
 */
const SalesRegisterReport = () => {
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
      const response = await axios.get(`/api/reports/sales-register${queryString ? '?' + queryString : ''}`)
      
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
      console.error('Error fetching sales register:', err)
      setError('Failed to load sales register')
      setReportData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [selectedCustomer, fromDate, toDate])

  const handlePrint = () => {
    const rowsHtml = safeReportData.map((row, idx) => `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${row.date || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: bold; color: #1f4fb2;">${row.bill_no || row.voucher_no || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 600;">${row.customer_name || row.party_name || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">${row.item_name || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">${parseFloat(row.qty || 0).toFixed(2)}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">${parseFloat(row.rate || 0).toFixed(2)}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: #059669;">${parseFloat(row.amount || 0).toFixed(2)}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; color: #0f172a; padding: 12px;">
        <div style="border-bottom: 2px solid #1f4fb2; padding-bottom: 8px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h2 style="margin: 0; color: #1f4fb2; font-size: 20px;">SALES REGISTER REPORT</h2>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
              Period: <strong>${fromDate || 'Start'}</strong> to <strong>${toDate || 'End'}</strong> | Customer: <strong>${selectedCustomer || 'All'}</strong> | Printed on: ${new Date().toLocaleString()}
            </div>
          </div>
          <div style="text-align: right; font-size: 12px; color: #475569;">
            Total Bills: <strong>${safeReportData.length}</strong>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background-color: #1f4fb2; color: #ffffff;">
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: center;">Date</th>
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: left;">Bill No</th>
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: left;">Customer Name</th>
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: left;">Item</th>
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: right;">Qty</th>
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: right;">Rate (₹)</th>
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: right;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="7" style="text-align:center; padding: 14px;">No sales records found</td></tr>'}
          </tbody>
          <tfoot>
            <tr style="background-color: #e2e8f0; font-weight: bold;">
              <td colspan="4" style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">Grand Total:</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">${totalQty.toFixed(2)}</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1;"></td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; color: #059669;">₹ ${totalAmount.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    printHtml(html, 'Sales_Register_Report');
  }

  // Ensure data is always an array
  const safeReportData = Array.isArray(reportData) ? reportData : []

  const totalAmount = safeReportData.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0)
  const totalQty = safeReportData.reduce((sum, row) => sum + (parseFloat(row.qty) || 0), 0)

  return (
    <div className="window">
      <div className="screen-title">Sales Register</div>

      <div className="report-filters">
        <div className="filter-row">
          <div className="filter-group">
            <label>Customer:</label>
            <select
              className="uniform-input"
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
            >
              <option value="">All Customers</option>
              {customers.map((customer, idx) => (
                <option key={`${customer.id || 'cust'}-${idx}`} value={customer.id}>{customer.name}</option>
              ))}
            </select>
          </div>

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
                <th>Invoice No</th>
                <th>Customer</th>
                <th>Item</th>
                <th>Lot No</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Rate</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {safeReportData.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center">No data available</td>
                </tr>
              ) : (
                <>
                  {safeReportData.map((row, index) => (
                    <tr key={index}>
                      <td>{row.date ? new Date(row.date).toLocaleDateString() : '-'}</td>
                      <td>{row.invoice_no || '-'}</td>
                      <td>{row.customer_name || '-'}</td>
                      <td>{row.item_name || '-'}</td>
                      <td>{row.lot_no || '-'}</td>
                      <td className="text-right">{parseFloat(row.qty || 0).toFixed(2)}</td>
                      <td className="text-right">{parseFloat(row.rate || 0).toFixed(2)}</td>
                      <td className="text-right">{parseFloat(row.amount || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td colSpan="5"><strong>Total</strong></td>
                    <td className="text-right"><strong>{totalQty.toFixed(2)}</strong></td>
                    <td></td>
                    <td className="text-right"><strong>{totalAmount.toFixed(2)}</strong></td>
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

export default SalesRegisterReport
