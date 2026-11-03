import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/api.js'
import { printHtml } from '../../utils/printHelper.js'
import PurchaseLedgerDetailsModal from '../purchase/PurchaseLedgerDetailsModal'
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
  const [selectedPurchaseModal, setSelectedPurchaseModal] = useState(null)

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
        const [suppliersRes, customersRes, papadRes, flourRes, opRes, lmRes, transRes] = await Promise.all([
          api.getMasters('suppliers'),
          api.getMasters('customers'),
          api.getMasters('papad_companies'),
          api.getMasters('flour_mills'),
          api.getMasters('operational_parties'),
          api.get('/masters/all/ledgermaster').catch(() => null),
          api.getMasters('transporters').catch(() => null)
        ])
        
        const suppliers = (suppliersRes?.success && Array.isArray(suppliersRes.data)) ? suppliersRes.data : []
        const customers = (customersRes?.success && Array.isArray(customersRes.data)) ? customersRes.data : []
        const papads = (papadRes?.success && Array.isArray(papadRes.data)) ? papadRes.data : []
        const flourMills = (flourRes?.success && Array.isArray(flourRes.data)) ? flourRes.data : []
        const ops = (opRes?.success && Array.isArray(opRes.data)) ? opRes.data : []
        const generalLedgers = (lmRes?.data && Array.isArray(lmRes.data)) ? lmRes.data : (Array.isArray(lmRes) ? lmRes : [])
        const transporters = (transRes?.success && Array.isArray(transRes.data)) ? transRes.data : (Array.isArray(transRes) ? transRes : [])
        
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

        transporters.forEach(t => {
          const name = t.name || t.transporter_name || t.print_name
          if (name) {
            const key = `${name}_Transporter`
            if (!seen.has(key)) {
              seen.add(key)
              combined.push({ id: t.id, name, type: 'Transporter' })
            }
          }
        })

        generalLedgers.forEach(l => {
          const name = l.name
          const type = l.ledger_type || 'General'
          if (name) {
            const key = `${name}_${type}`
            if (!seen.has(key) && !seen.has(`${name}_Supplier`) && !seen.has(`${name}_Customer`) && !seen.has(`${name}_Loadman`) && !seen.has(`${name}_Transporter`)) {
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

  const periodDebitCalculated = useMemo(() => {
    if (reportData?.periodDebitTotal !== undefined && reportData?.periodDebitTotal !== null && !isNaN(reportData.periodDebitTotal) && Number(reportData.periodDebitTotal) > 0) {
      return Number(reportData.periodDebitTotal);
    }
    return safeTransactions.reduce((acc, t) => acc + (parseFloat(t.debit) || 0), 0);
  }, [reportData, safeTransactions]);

  const periodCreditCalculated = useMemo(() => {
    if (reportData?.periodCreditTotal !== undefined && reportData?.periodCreditTotal !== null && !isNaN(reportData.periodCreditTotal) && Number(reportData.periodCreditTotal) > 0) {
      return Number(reportData.periodCreditTotal);
    }
    return safeTransactions.reduce((acc, t) => acc + (parseFloat(t.credit) || 0), 0);
  }, [reportData, safeTransactions]);

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

      {/* Compact Horizontal Ledger Header & Balance Summary Bar */}
      {!loading && reportData && (
        <div className="ledger-summary-card">
          <div className="summary-main">
            <div className="ledger-info">
              <span className="label">Account:</span>
              <span className="value">{reportData.ledgerName}</span>
            </div>
            <div className="ledger-info">
              <span className="label">Period:</span>
              <span className="value small">
                {fromDate ? new Date(fromDate).toLocaleDateString('en-GB') : 'Start'} to {toDate ? new Date(toDate).toLocaleDateString('en-GB') : 'Today'}
              </span>
            </div>
          </div>

          <div className="summary-stats">
            <div className="stat-box">
              <span className="label">Opening:</span>
              <span className="value">
                ₹ {Math.abs(parseFloat(reportData.openingBalance || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                <small style={{ marginLeft: '4px', opacity: 0.9 }}>{parseFloat(reportData.openingBalance || 0) >= 0 ? 'Dr' : 'Cr'}</small>
              </span>
            </div>
            <div className="stat-box">
              <span className="label">Period Dr:</span>
              <span className="value debit">
                ₹ {Number(periodDebitCalculated).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="stat-box">
              <span className="label">Period Cr:</span>
              <span className="value credit">
                ₹ {Number(periodCreditCalculated).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="stat-box" style={{ backgroundColor: 'rgba(59, 130, 246, 0.25)', borderColor: 'rgba(147, 197, 253, 0.4)' }}>
              <span className="label" style={{ color: '#ffffff' }}>Closing:</span>
              <span className="value" style={{ color: '#ffffff' }}>
                ₹ {Math.abs(parseFloat(reportData.closingBalance || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                <small style={{ marginLeft: '4px', opacity: 0.9 }}>{parseFloat(reportData.closingBalance || 0) >= 0 ? 'Dr' : 'Cr'}</small>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* High-Density Statement Table */}
      {!loading && reportData && (
        <div className="report-table-wrapper">
          <table className="report-table">
            <thead>
              <tr>
                <th width="40" style={{ textAlign: 'center' }}>#</th>
                <th width="90">Date</th>
                <th width="120">Voucher Type</th>
                <th width="120">Voucher No</th>
                <th>Particulars & Transaction Details</th>
                <th className="text-right" width="130">Debit (₹)</th>
                <th className="text-right" width="130">Credit (₹)</th>
                <th className="text-right" width="150">Balance (₹)</th>
                <th width="90" style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {safeTransactions.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                    No transactions found for the selected account in this period.
                  </td>
                </tr>
              ) : (
                <>
                  {safeTransactions.map((row, index) => {
                    const typeLower = String(row.voucher_type || '').toLowerCase();
                    const isClickable = row.voucher_no && row.voucher_no !== '-';
                    
                    const handleVoucherClick = () => {
                      if (!isClickable) return;
                      if (typeLower.includes('purchase') || String(row.voucher_no || '').startsWith('PUR') || row.voucher_type === 'Purchase Unloading' || typeLower.includes('debit note')) {
                        setSelectedPurchaseModal(row.reference_id || row.voucher_no);
                      } else if (typeLower.includes('sales')) {
                        navigate(`/entry/sales-display?search=${encodeURIComponent(row.voucher_no)}`);
                      } else {
                        navigate(`/entry/voucher-display?search=${encodeURIComponent(row.voucher_no)}`);
                      }
                    };

                    // Voucher badge styling helper
                    const getBadge = (vt) => {
                      const t = String(vt || '').toLowerCase();
                      if (t.includes('purchase') || t.includes('papad in')) return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
                      if (t.includes('sales') || t.includes('papad return')) return { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' };
                      if (t.includes('debit note') || t.includes('return')) return { bg: '#fef2f2', color: '#b91c1c', border: '#fca5a5' };
                      if (t.includes('credit note')) return { bg: '#fffbe3', color: '#b45309', border: '#fde68a' };
                      if (t.includes('payment') || t.includes('advance')) return { bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe' };
                      if (t.includes('receipt')) return { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' };
                      return { bg: '#f8fafc', color: '#334155', border: '#cbd5e1' };
                    };
                    const badge = getBadge(row.voucher_type);

                    const debitVal = parseFloat(row.debit || 0);
                    const creditVal = parseFloat(row.credit || 0);
                    const balVal = parseFloat(row.balance || 0);

                    return (
                      <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                        <td style={{ textAlign: 'center', color: '#94a3b8', fontWeight: '600', fontSize: '11px' }}>{index + 1}</td>
                        <td style={{ color: '#334155', fontWeight: '600' }}>{row.date ? new Date(row.date).toLocaleDateString('en-GB') : '-'}</td>
                        <td>
                          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, fontWeight: '700', display: 'inline-block' }}>
                            {row.voucher_type || 'General'}
                          </span>
                        </td>
                        <td>
                          <button 
                            className={isClickable ? 'clickable-voucher' : ''}
                            onClick={handleVoucherClick}
                            title="Click to view full voucher & transaction details"
                            style={{ background: isClickable ? '#eff6ff' : 'none', border: isClickable ? '1px solid #bfdbfe' : 'none', cursor: isClickable ? 'pointer' : 'default' }}
                          >
                            {row.voucher_no || '-'}
                          </button>
                        </td>
                        <td className="particulars-cell">
                          {row.particulars || '-'}
                          {(row.narration || row.remarks) && (
                            <span className="particulars-subtext">
                              Note: {row.narration || row.remarks}
                            </span>
                          )}
                        </td>
                        <td className="debit-val">{debitVal > 0 ? `₹${debitVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}</td>
                        <td className="credit-val">{creditVal > 0 ? `₹${creditVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}</td>
                        <td className="balance-val">
                          ₹ {Math.abs(balVal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          <span style={{ marginLeft: '4px', fontSize: '11px', color: balVal >= 0 ? '#047857' : '#b45309' }}>
                            {balVal >= 0 ? 'Dr' : 'Cr'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={handleVoucherClick}
                            style={{ padding: '4px 10px', backgroundColor: '#e2e8f0', color: '#1e293b', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                            title="Open voucher & journal details"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </>
              )}
            </tbody>
            <tfoot>
              <tr className="closing-balance-row">
                <td colSpan="5" style={{ textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Period Total & Closing Balance:</td>
                <td style={{ textAlign: 'right', color: '#34d399', fontWeight: '800' }}>
                  ₹ {Number(periodDebitCalculated).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ textAlign: 'right', color: '#fcd34d', fontWeight: '800' }}>
                  ₹ {Number(periodCreditCalculated).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ textAlign: 'right', color: '#ffffff', fontWeight: '800' }}>
                  ₹ {Math.abs(parseFloat(reportData.closingBalance || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  <small style={{ marginLeft: '4px' }}>{parseFloat(reportData.closingBalance || 0) >= 0 ? 'Dr' : 'Cr'}</small>
                </td>
                <td></td>
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

      {/* Direct Modal for Purchase Transaction Ledger & Double-Entry Details */}
      {selectedPurchaseModal && (
        <PurchaseLedgerDetailsModal
          isOpen={Boolean(selectedPurchaseModal)}
          onClose={() => setSelectedPurchaseModal(null)}
          purchaseId={selectedPurchaseModal}
        />
      )}
    </div>
  )

}

export default LedgerStatementReport
