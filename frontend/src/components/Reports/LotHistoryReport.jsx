import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { printHtml } from '../../utils/printHelper'
import './ReportPage.css'

/**
 * LotHistoryReport - Comprehensive Lot History & Traceability Report
 * Tracks full lifecycle of a specific lot across all entries/stock transactions
 */
const LotHistoryReport = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  
  const [items, setItems] = useState([])
  const [selectedItem, setSelectedItem] = useState('')
  const [lotNo, setLotNo] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [reportData, setReportData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Auto-fill lotNo from search params on mount
  useEffect(() => {
    const lotQuery = searchParams.get('lotNo') || searchParams.get('lot_no')
    if (lotQuery) {
      setLotNo(lotQuery)
    }
  }, [searchParams])

  // Fetch items dropdown
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await axios.get('/api/masters/item_master')
        const itemsData = Array.isArray(response.data) 
          ? response.data 
          : (response.data?.data || [])
        setItems(itemsData)
      } catch (err) {
        console.error('Error fetching items:', err)
        setItems([])
      }
    }
    fetchItems()
  }, [])

  // Fetch lot history report
  const fetchReport = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (selectedItem) params.append('item_id', selectedItem)
      if (lotNo) params.append('lot_no', lotNo)
      if (fromDate) params.append('from_date', fromDate)
      if (toDate) params.append('to_date', toDate)

      const response = await axios.get(`/api/reports/lot-history?${params.toString()}`)
      
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
      console.error('Error fetching lot history:', err)
      setError('Failed to load lot history data')
      setReportData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [selectedItem, lotNo])

  const handleClear = () => {
    setSelectedItem('')
    setLotNo('')
    setFromDate('')
    setToDate('')
  }

  const handlePrint = () => {
    if (safeReportData.length === 0) {
      alert("No data to print.");
      return;
    }

    const rowsHtml = safeReportData.map((row) => `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 12px;">${row.date ? new Date(row.date).toLocaleDateString() : '-'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 12px; font-weight: bold;">${row.item_name || '-'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 12px; font-family: monospace;">${row.lot_no || '-'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 12px;">${row.type || '-'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 12px;">${row.reference_no || '-'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 12px; text-align: right;">${parseFloat(row.qty_in || 0).toFixed(2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 12px; text-align: right;">${parseFloat(row.qty_out || 0).toFixed(2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 12px; text-align: right;">${parseFloat(row.rejection_qty || 0).toFixed(2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 12px; text-align: right; font-weight: bold; color: green;">${parseFloat(row.balance || 0).toFixed(2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 12px; text-align: right;">${parseFloat(row.weight || 0).toFixed(2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 12px; text-align: right; font-weight: bold;">${parseFloat(row.balance_kg || 0).toFixed(2)} kg</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #334155;">
        <div style="border-bottom: 3px solid #1f4fb2; padding-bottom: 10px; margin-bottom: 15px; text-align: center;">
          <h1 style="color: #1f4fb2; margin: 0; font-size: 24px;">A.S.MOORTHY & CO</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: bold; text-transform: uppercase;">Lot History & Traceability Report</p>
          <p style="margin: 3px 0 0 0; font-size: 12px; color: #64748b;">
            ${lotNo ? `Lot No: ${lotNo}` : 'All Lots'}
          </p>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <thead>
            <tr style="background-color: #1f4fb2; color: white;">
              <th style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: left;">Date</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: left;">Item Name</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: left;">Lot No</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: left;">Type</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: left;">Ref No</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: right;">Qty In</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: right;">Qty Out</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: right;">Rejection</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: right;">Balance Qty</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: right;">Unit Wt</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: right;">Balance KG</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
    printHtml(html, `Lot_History_Report_${lotNo || 'all'}`);
  }

  const safeReportData = Array.isArray(reportData) ? reportData : []

  // Totals
  const totalIn = safeReportData.reduce((sum, r) => sum + (parseFloat(r.qty_in) || 0) + (parseFloat(r.open_stock_qty) || 0), 0)
  const totalOut = safeReportData.reduce((sum, r) => sum + (parseFloat(r.qty_out) || 0) + (parseFloat(r.rejection_qty) || 0), 0)
  const lastBalance = safeReportData.length > 0 ? parseFloat(safeReportData[safeReportData.length - 1].balance || 0) : 0
  const lastBalanceKg = safeReportData.length > 0 ? parseFloat(safeReportData[safeReportData.length - 1].balance_kg || 0) : 0

  return (
    <div className="window">
      <div className="screen-title">🔍 Lot History & Traceability</div>

      {/* Filters Section */}
      <div className="report-filters">
        <div className="filter-row">
          <div className="filter-group">
            <label>Item:</label>
            <select
              className="uniform-input"
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
            >
              <option value="">All Items</option>
              {items.map((item, idx) => (
                <option key={`${item.id || 'item'}-${idx}`} value={item.id}>{item.name || item.item_name}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Lot No:</label>
            <input
              type="text"
              placeholder="Enter Lot No"
              className="uniform-input"
              value={lotNo}
              onChange={(e) => setLotNo(e.target.value)}
            />
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

          <div className="filter-group" style={{ display: 'flex', gap: '8px', alignSelf: 'flex-end' }}>
            <button className="btn btn-primary" onClick={fetchReport}>
              Search
            </button>
            <button className="btn btn-secondary" onClick={handleClear}>
              Clear
            </button>
            <button className="btn btn-secondary" onClick={handlePrint}>
              Print
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Bar */}
      <div style={{
        display: 'flex',
        gap: '15px',
        margin: '12px 0',
        padding: '10px 15px',
        background: '#f8fafc',
        borderRadius: '6px',
        border: '1px solid #e2e8f0'
      }}>
        <div><strong>Total Qty In:</strong> <span style={{ color: '#16a34a', fontWeight: 'bold' }}>{totalIn.toFixed(2)} Bags</span></div>
        <div><strong>Total Qty Out:</strong> <span style={{ color: '#dc2626', fontWeight: 'bold' }}>{totalOut.toFixed(2)} Bags</span></div>
        <div><strong>Current Lot Balance:</strong> <span style={{ color: '#1f4fb2', fontWeight: 'bold' }}>{lastBalance.toFixed(2)} Bags</span></div>
        <div><strong>Current Balance Weight:</strong> <span style={{ color: '#059669', fontWeight: 'bold' }}>{lastBalanceKg.toFixed(2)} kg</span></div>
      </div>

      {error && <div className="message-box error">{error}</div>}
      {loading && <div className="loading">Loading lot history...</div>}

      {/* Report Table */}
      {!loading && (
        <div className="report-table-container">
          <table className="report-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Item Name</th>
                <th>Lot No</th>
                <th>Type / Transaction</th>
                <th>Reference No</th>
                <th className="text-right">Qty In</th>
                <th className="text-right">Qty Out</th>
                <th className="text-right">Rejection Qty</th>
                <th className="text-right">Open Stock Qty</th>
                <th className="text-right">Balance Qty</th>
                <th className="text-right">Unit Wt (kg)</th>
                <th className="text-right">Overall Wt (kg)</th>
                <th className="text-right">Balance Wt (kg)</th>
              </tr>
            </thead>
            <tbody>
              {safeReportData.length === 0 ? (
                <tr>
                  <td colSpan="13" className="text-center">No lot history found for current filter criteria</td>
                </tr>
              ) : (
                safeReportData.map((row, index) => {
                  const refVal = row.reference_no || row.bill_no || row.invoice_no;
                  const isClickable = refVal && refVal !== '-';

                  const handleRefClick = () => {
                    if (!isClickable) return;
                    const typeStr = String(row.type || '').toLowerCase();
                    if (typeStr.includes('purchase return')) {
                      navigate(`/entry/purchase-return-display?search=${encodeURIComponent(refVal)}`);
                    } else if (typeStr.includes('purchase')) {
                      navigate(`/entry/purchase-display?search=${encodeURIComponent(refVal)}`);
                    } else if (typeStr.includes('sales return')) {
                      navigate(`/entry/sales-return-display?search=${encodeURIComponent(refVal)}`);
                    } else if (typeStr.includes('sale')) {
                      navigate(`/entry/sales-display?search=${encodeURIComponent(refVal)}`);
                    } else if (typeStr.includes('grind')) {
                      navigate(`/entry/grind-display?search=${encodeURIComponent(refVal)}`);
                    } else if (typeStr.includes('flour out return')) {
                      navigate(`/entry/flour-out-return-display?search=${encodeURIComponent(refVal)}`);
                    } else if (typeStr.includes('flour out')) {
                      navigate(`/entry/flour-out-display?search=${encodeURIComponent(refVal)}`);
                    } else {
                      navigate(`/entry/purchase-display?search=${encodeURIComponent(refVal)}`);
                    }
                  };

                  return (
                    <tr key={index}>
                      <td>{row.date ? new Date(row.date).toLocaleDateString() : '-'}</td>
                      <td style={{ fontWeight: 'bold' }}>{row.item_name || '-'}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#1e293b' }}>{row.lot_no || '-'}</td>
                      <td>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          background: row.type?.includes('Purchase') ? '#dcfce7' : row.type?.includes('Sale') ? '#fee2e2' : '#f1f5f9',
                          color: row.type?.includes('Purchase') ? '#15803d' : row.type?.includes('Sale') ? '#b91c1c' : '#334155'
                        }}>
                          {row.type || '-'}
                        </span>
                      </td>
                      <td 
                        style={isClickable ? { color: '#1f4fb2', cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold' } : {}}
                        onClick={handleRefClick}
                      >
                        {refVal || '-'}
                      </td>
                      <td className="text-right" style={{ color: row.qty_in > 0 ? '#16a34a' : 'inherit' }}>{parseFloat(row.qty_in || 0).toFixed(2)}</td>
                      <td className="text-right" style={{ color: row.qty_out > 0 ? '#dc2626' : 'inherit' }}>{parseFloat(row.qty_out || 0).toFixed(2)}</td>
                      <td className="text-right" style={{ color: row.rejection_qty > 0 ? '#b91c1c' : 'inherit' }}>{parseFloat(row.rejection_qty || 0).toFixed(2)}</td>
                      <td className="text-right">{parseFloat(row.open_stock_qty || 0).toFixed(2)}</td>
                      <td className="text-right" style={{ fontWeight: 'bold', color: (row.balance || 0) < 0 ? '#dc2626' : '#16a34a' }}>
                        {parseFloat(row.balance || 0).toFixed(2)}
                      </td>
                      <td className="text-right">{parseFloat(row.weight || 0).toFixed(2)}</td>
                      <td className="text-right">{parseFloat(row.overall_kg || 0).toFixed(2)}</td>
                      <td className="text-right" style={{ fontWeight: 'bold', color: (row.balance_kg || 0) < 0 ? '#dc2626' : '#059669' }}>
                        {parseFloat(row.balance_kg || 0).toFixed(2)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default LotHistoryReport
