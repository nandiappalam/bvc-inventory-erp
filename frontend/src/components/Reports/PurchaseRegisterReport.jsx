import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { printHtml } from '../../utils/printHelper'
import './ReportPage.css'

/**
 * PurchaseRegisterReport - All purchase entries with supplier and item details
 * Fixed version with robust data handling
 */
const PurchaseRegisterReport = () => {
  const [suppliers, setSuppliers] = useState([])
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [reportData, setReportData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Fetch suppliers for dropdown
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const response = await axios.get('/api/masters/supplier_master')
        const suppliersData = Array.isArray(response.data) 
          ? response.data 
          : (response.data?.data || [])
        setSuppliers(suppliersData)
      } catch (err) {
        console.error('Error fetching suppliers:', err)
        setSuppliers([])
      }
    }
    fetchSuppliers()
  }, [])

  // Fetch report data
  const fetchReport = async () => {
    setLoading(true)
    setError('')
    
    try {
      const params = {}
      if (selectedSupplier) params.supplier_id = selectedSupplier
      if (fromDate) params.from_date = fromDate
      if (toDate) params.to_date = toDate
      
      const queryString = new URLSearchParams(params).toString()
      const response = await axios.get(`/api/reports/purchase-register${queryString ? '?' + queryString : ''}`)
      
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
      console.error('Error fetching purchase register:', err)
      setError('Failed to load purchase register')
      setReportData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [selectedSupplier, fromDate, toDate])

  const handlePrint = () => {
    if (safeReportData.length === 0) {
      alert("No data to print.");
      return;
    }

    const rowsHtml = safeReportData.map((row, index) => `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 12px;">${row.date ? new Date(row.date).toLocaleDateString() : '-'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 12px;">${row.bill_no || '-'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 12px;">${row.supplier_name || '-'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 12px;">${row.item_name || '-'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 12px;">${row.lot_no || '-'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 12px; text-align: right;">${parseFloat(row.weight || 0).toFixed(2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 12px; text-align: right;">${parseFloat(row.qty || 0).toFixed(2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 12px; text-align: right;">${parseFloat(row.total_wt || 0).toFixed(2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 12px; text-align: right;">${parseFloat(row.rate || 0).toFixed(2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 12px; text-align: right; font-weight: bold;">${parseFloat(row.amount || 0).toFixed(2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 12px;">${row.transport || '-'}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #334155;">
        <div style="border-bottom: 3px solid #1f4fb2; padding-bottom: 10px; margin-bottom: 15px; text-align: center;">
          <h1 style="color: #1f4fb2; margin: 0; font-size: 24px;">A.S.MOORTHY & CO</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Purchase Register Report</p>
          <p style="margin: 3px 0 0 0; font-size: 12px; color: #64748b;">
            Period: ${fromDate || 'Beginning'} to ${toDate || 'Present'}
          </p>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <thead>
            <tr style="background-color: #1f4fb2; color: white;">
              <th style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: left;">Date</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: left;">Bill No</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: left;">Supplier</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: left;">Item</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: left;">Lot No</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: right;">Unit Wt</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: right;">Bags Qty</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: right;">Total Wt</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: right;">Rate</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: right;">Amount</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: left;">Transport</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr style="font-weight: bold; background-color: #f1f5f9;">
              <td colspan="6" style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: right;">Grand Total:</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: right;">${totalQty.toFixed(2)}</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: right;">${totalWeight.toFixed(2)} kg</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px;"></td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: right;">${totalAmount.toFixed(2)}</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px;"></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
    printHtml(html, `Purchase_Register_Report_${fromDate || 'all'}_to_${toDate || 'all'}`);
  }

  // Ensure data is always an array
  const safeReportData = Array.isArray(reportData) ? reportData : []

  // Calculate totals
  const totalAmount = safeReportData.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0)
  const totalQty = safeReportData.reduce((sum, row) => sum + (parseFloat(row.qty) || 0), 0)
  const totalWeight = safeReportData.reduce((sum, row) => sum + (parseFloat(row.total_wt) || 0), 0)

  return (
    <div className="window">
      <div className="screen-title">Purchase Register</div>

      {/* Filters Section */}
      <div className="report-filters">
        <div className="filter-row">
          <div className="filter-group">
            <label>Supplier:</label>
            <select
              className="uniform-input"
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
            >
              <option value="">All Suppliers</option>
              {suppliers.map((supplier, idx) => (
                <option key={`${supplier.id || 'supp'}-${idx}`} value={supplier.id}>{supplier.name}</option>
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
            <button className="btn btn-primary" onClick={fetchReport}>
              Refresh
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
                <th>Bill No</th>
                <th>Supplier</th>
                <th>Item</th>
                <th>Lot No</th>
                <th className="text-right">Unit Wt (kg)</th>
                <th className="text-right">Bags Qty</th>
                <th className="text-right">Total Wt (kg)</th>
                <th className="text-right">Rate</th>
                <th className="text-right">Amount</th>
                <th>Transport</th>
              </tr>
            </thead>
            <tbody>
              {safeReportData.length === 0 ? (
                <tr>
                  <td colSpan="11" className="text-center">No data available</td>
                </tr>
              ) : (
                <>
                  {safeReportData.map((row, index) => (
                    <tr key={index}>
                      <td>{row.date ? new Date(row.date).toLocaleDateString() : '-'}</td>
                      <td>{row.bill_no || '-'}</td>
                      <td>{row.supplier_name || '-'}</td>
                      <td>{row.item_name || '-'}</td>
                      <td>{row.lot_no || '-'}</td>
                      <td className="text-right">{parseFloat(row.weight || 0).toFixed(2)}</td>
                      <td className="text-right">{parseFloat(row.qty || 0).toFixed(2)}</td>
                      <td className="text-right">{parseFloat(row.total_wt || 0).toFixed(2)}</td>
                      <td className="text-right">{parseFloat(row.rate || 0).toFixed(2)}</td>
                      <td className="text-right">{parseFloat(row.amount || 0).toFixed(2)}</td>
                      <td>{row.transport || '-'}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td colSpan="6"><strong>Total</strong></td>
                    <td className="text-right"><strong>{totalQty.toFixed(2)}</strong></td>
                    <td className="text-right"><strong>{totalWeight.toFixed(2)}</strong></td>
                    <td></td>
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

export default PurchaseRegisterReport
