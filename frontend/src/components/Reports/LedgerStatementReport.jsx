import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/api.js'
import { printHtml } from '../../utils/printHelper.js'
import './ReportPage.css'

/**
 * LedgerStatementReport - Individual ledger transactions with running balance
 * Blue & White theme following the uniform information page format
 */
const LedgerStatementReport = () => {
  const navigate = useNavigate()
  const [ledgers, setLedgers] = useState([])
  const [selectedLedger, setSelectedLedger] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [selectedLedgerId, setSelectedLedgerId] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [reportData, setReportData] = useState(null)
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

  // Parse URL search params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ledgerParam = params.get('ledger')
    const typeParam = params.get('type')
    if (ledgerParam) {
      setSelectedLedger(ledgerParam)
      setSelectedLedgerId(params.get('loadman_id') || params.get('ledger_id') || params.get('id') || '')
      if (typeParam) {
        setSelectedType(typeParam)
      }
    }
  }, [])

  // Fetch ledgers for dropdown
  useEffect(() => {
    const fetchLedgers = async () => {
      try {
        const [suppliersRes, customersRes, papadRes, flourRes, opRes, lmRes] = await Promise.all([
          api.getMasters('suppliers'),
          api.getMasters('customers'),
          api.getMasters('papad_companies'),
          api.getMasters('flour_mills'),
          api.getMasters('operational_parties'),
          api.get('/masters/all/ledgermaster').catch(() => null)
        ])
        
        const suppliers = (suppliersRes?.success && Array.isArray(suppliersRes.data)) ? suppliersRes.data : []
        const customers = (customersRes?.success && Array.isArray(customersRes.data)) ? customersRes.data : []
        const papads = (papadRes?.success && Array.isArray(papadRes.data)) ? papadRes.data : []
        const flourMills = (flourRes?.success && Array.isArray(flourRes.data)) ? flourRes.data : []
        const ops = (opRes?.success && Array.isArray(opRes.data)) ? opRes.data : []
        const generalLedgers = (lmRes?.data && Array.isArray(lmRes.data)) ? lmRes.data : (Array.isArray(lmRes) ? lmRes : [])
        
        const combined = []
        const seen = new Set()

        suppliers.forEach(s => {
          const key = `${s.name}_Supplier`
          if (!seen.has(key)) {
            seen.add(key)
            combined.push({ id: s.id, name: s.name, type: 'Supplier' })
          }
        })

        customers.forEach(c => {
          const key = `${c.name}_Customer`
          if (!seen.has(key)) {
            seen.add(key)
            combined.push({ id: c.id, name: c.name, type: 'Customer' })
          }
        })

        papads.forEach(p => {
          const key = `${p.name}_Papad Company`
          if (!seen.has(key)) {
            seen.add(key)
            combined.push({ id: p.id, name: p.name, type: 'Papad Company' })
          }
        })

        flourMills.forEach(f => {
          const name = f.flourmill || f.name
          if (name) {
            const key = `${name}_Flour Mill`
            if (!seen.has(key)) {
              seen.add(key)
              combined.push({ id: f.id, name, type: 'Flour Mill' })
            }
          }
        })

        ops.forEach(o => {
          const name = o.name
          if (name) {
            const key = `${name}_Loadman`
            if (!seen.has(key)) {
              seen.add(key)
              combined.push({ id: o.id, name, type: 'Loadman' })
            }
          }
        })

        generalLedgers.forEach(l => {
          const name = l.name
          const type = l.ledger_type || 'General'
          if (name) {
            const key = `${name}_${type}`
            if (!seen.has(key) && !seen.has(`${name}_Supplier`) && !seen.has(`${name}_Customer`) && !seen.has(`${name}_Loadman`)) {
              seen.add(key)
              combined.push({ id: l.id, name, type })
            }
          }
        })

        // Sort alphabetically by name
        combined.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        setLedgers(combined)
      } catch (err) {
        console.error('Error fetching ledgers:', err)
        setLedgers([])
      }
    }
    fetchLedgers()
  }, [])

  // Fetch report data
  const fetchReport = async () => {
    if (!selectedLedger) return
    
    setLoading(true)
    setError('')
    
    try {
      const params = {}
      if (fromDate) params.from_date = fromDate
      if (toDate) params.to_date = toDate
      if (selectedType) params.type = selectedType
      if (selectedLedgerId) {
        params.loadman_id = selectedLedgerId
        params.ledger_id = selectedLedgerId
        params.id = selectedLedgerId
      }
      
      const result = await api.get('/reports/ledger/' + encodeURIComponent(selectedLedger), { params })
      const data = (result && result.data && typeof result.data === 'object' && result.data.transactions) 
        ? result.data 
        : (result && result.transactions ? result : (result && result.data ? result.data : null))

      if (data && Array.isArray(data.transactions)) {
        setReportData(data)
      } else {
        setError(result?.message || 'Failed to load Ledger Statement')
      }
    } catch (err) {
      console.error('Error fetching ledger:', err)
      setError('Failed to load Ledger Statement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedLedger) {
      fetchReport()
    }
  }, [selectedLedger, selectedType, selectedLedgerId, fromDate, toDate])

  const selectedLedgerOption = selectedLedger
    ? JSON.stringify([selectedLedger, selectedType, selectedLedgerId])
    : ''

  const handlePrint = () => {
    const rowsHtml = safeTransactions.map((row, idx) => `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${row.date ? new Date(row.date).toLocaleDateString() : '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">${row.voucher_type || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: bold; color: #1f4fb2;">${row.voucher_no || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">${row.particulars || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; color: ${parseFloat(row.debit) > 0 ? '#059669' : 'inherit'};">${parseFloat(row.debit || 0) > 0 ? parseFloat(row.debit).toFixed(2) : '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; color: ${parseFloat(row.credit) > 0 ? '#d97706' : 'inherit'};">${parseFloat(row.credit || 0) > 0 ? parseFloat(row.credit).toFixed(2) : '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold;">${Math.abs(parseFloat(row.balance || 0)).toFixed(2)}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; color: #0f172a; padding: 12px;">
        <div style="border-bottom: 2px solid #1f4fb2; padding-bottom: 8px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h2 style="margin: 0; color: #1f4fb2; font-size: 20px;">LEDGER STATEMENT REPORT</h2>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
              Ledger Account: <strong>${selectedLedger || 'All'}</strong> | 
              Period: <strong>${fromDate || 'Start'}</strong> to <strong>${toDate || 'End'}</strong> | 
              Printed on: ${new Date().toLocaleString()}
            </div>
          </div>
          <div style="text-align: right; font-size: 12px; color: #475569;">
            Total Transactions: <strong>${safeTransactions.length}</strong>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background-color: #1f4fb2; color: #ffffff;">
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: center;">Date</th>
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: left;">Type</th>
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: left;">Voucher No</th>
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: left;">Particulars</th>
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: right;">Debit (₹)</th>
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: right;">Credit (₹)</th>
              <th style="padding: 6px; border: 1px solid #1f4fb2; color: #fff; text-align: right;">Balance (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="7" style="text-align:center; padding: 14px;">No transactions recorded</td></tr>'}
          </tbody>
          <tfoot>
            <tr style="background-color: #e2e8f0; font-weight: bold;">
              <td colspan="6" style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">Closing Balance:</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; color: #1f4fb2;">₹ ${Math.abs(parseFloat(reportData?.closingBalance || 0)).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    printHtml(html, `Ledger_Statement_${selectedLedger || 'Report'}`);
  }

  const safeTransactions = reportData?.transactions || []

  return (
    <div className="window ledger-statement-page">
      <div className="screen-header">
        <button className="header-btn back-btn" onClick={() => navigate(-1)}>
          <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          Back
        </button>
        <div className="screen-title-text">Ledger Statement</div>
        <button className="header-btn refresh-btn" onClick={fetchReport}>
          <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18"></path>
          </svg>
          Refresh
        </button>
      </div>

      <div className="report-filters-card">
        <div className="filter-row">
          <div className="filter-group flex-2">
            <label>Select Ledger Account</label>
            <select
              className="uniform-input"
              value={selectedLedgerOption}
              onChange={(e) => {
                const val = e.target.value
                if (val) {
                  const [name, type, id] = JSON.parse(val)
                  setSelectedLedger(name)
                  setSelectedType(type)
                  setSelectedLedgerId(id || '')
                } else {
                  setSelectedLedger('')
                  setSelectedType('')
                  setSelectedLedgerId('')
                }
              }}
            >
              <option value="">-- Choose Account --</option>
              {ledgers.map((ledger, idx) => (
                <option
                  key={`${ledger.id || 'ledger'}-${idx}`}
                  value={JSON.stringify([ledger.name, ledger.type, String(ledger.id || '')])}
                >
                  {ledger.name} ({ledger.type})
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>From Date</label>
            <input
              type="date"
              className="uniform-input"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>To Date</label>
            <input
              type="date"
              className="uniform-input"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div className="filter-actions">
            <button className="btn btn-primary" onClick={fetchReport} disabled={loading}>
              {loading ? 'Loading...' : 'Search'}
            </button>
            <button className="btn btn-secondary" onClick={handlePrint} disabled={!reportData}>
              Print
            </button>
          </div>
        </div>
      </div>

      {error && <div className="message-box error">{error}</div>}

      {/* Ledger Header & Opening Balance Card */}
      {!loading && reportData && (
        <div className="ledger-summary-card">
          <div className="summary-main">
            <div className="ledger-info">
              <span className="label">Account Name</span>
              <span className="value">{reportData.ledgerName}</span>
            </div>
            <div className="ledger-info">
              <span className="label">Statement Period</span>
              <span className="value small">{new Date(fromDate).toLocaleDateString()} to {new Date(toDate).toLocaleDateString()}</span>
            </div>
          </div>
          <div className="summary-stats">
            <div className="stat-box">
              <span className="label">Opening Balance</span>
              <span className={`value ${parseFloat(reportData.openingBalance || 0) >= 0 ? 'debit' : 'credit'}`}>
                ₹ {Math.abs(parseFloat(reportData.openingBalance || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                {parseFloat(reportData.openingBalance || 0) >= 0 ? ' Dr' : ' Cr'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Report Table */}
      {!loading && reportData && (
        <div className="report-table-wrapper">
          <table className="report-table">
            <thead>
              <tr>
                <th width="100">Date</th>
                <th width="150">Voucher Type</th>
                <th width="120">Voucher No</th>
                <th>Particulars</th>
                <th className="text-right" width="120">Debit (₹)</th>
                <th className="text-right" width="120">Credit (₹)</th>
                <th className="text-right" width="150">Balance (₹)</th>
              </tr>
            </thead>
            <tbody>
              {safeTransactions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center no-data">No transactions found for the selected period</td>
                </tr>
              ) : (
                <>
                  {safeTransactions.map((row, index) => {
                    const typeLower = String(row.voucher_type || '').toLowerCase();
                    const isClickable = row.voucher_no && row.voucher_no !== '-';
                    
                    const handleVoucherClick = () => {
                      if (!isClickable) return;
                      if (typeLower.includes('purchase')) {
                        navigate(`/entry/purchase-display?search=${encodeURIComponent(row.voucher_no)}`);
                      } else if (typeLower.includes('sales')) {
                        navigate(`/entry/sales-display?search=${encodeURIComponent(row.voucher_no)}`);
                      } else {
                        navigate(`/entry/voucher-display?search=${encodeURIComponent(row.voucher_no)}`);
                      }
                    };

                    return (
                      <tr key={index}>
                        <td className="text-center">{row.date ? new Date(row.date).toLocaleDateString('en-GB') : '-'}</td>
                        <td>{row.voucher_type || '-'}</td>
                        <td 
                          className={isClickable ? 'clickable-voucher' : ''}
                          onClick={handleVoucherClick}
                        >
                          {row.voucher_no || '-'}
                        </td>
                        <td className="particulars-cell">{row.particulars || '-'}</td>
                        <td className="text-right debit-val">{parseFloat(row.debit || 0) > 0 ? parseFloat(row.debit).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}</td>
                        <td className="text-right credit-val">{parseFloat(row.credit || 0) > 0 ? parseFloat(row.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}</td>
                        <td className="text-right balance-val">
                          {Math.abs(parseFloat(row.balance || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          {parseFloat(row.balance || 0) >= 0 ? ' Dr' : ' Cr'}
                        </td>
                      </tr>
                    );
                  })}
                </>
              )}
            </tbody>
            <tfoot>
              <tr className="closing-balance-row">
                <td colSpan="6" className="text-right"><strong>Closing Balance:</strong></td>
                <td className="text-right">
                  <strong>
                    ₹ {Math.abs(parseFloat(reportData.closingBalance || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    {parseFloat(reportData.closingBalance || 0) >= 0 ? ' Dr' : ' Cr'}
                  </strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      
      {!loading && !reportData && !error && (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <h3>Select an account to view statement</h3>
          <p>Choose a ledger from the dropdown above and click Search.</p>
        </div>
      )}
    </div>
  )

}

export default LedgerStatementReport
