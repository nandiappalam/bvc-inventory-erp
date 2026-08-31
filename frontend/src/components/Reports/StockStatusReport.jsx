import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../../context/AuthContext'
import './ReportPage.css'

/**
 * StockStatusReport - Real-time stock position with Stock In/Out and Current Balance
 * Supports:
 *  - Categorized tabs (RM Stock, FG Stock, Wastage Stock)
 *  - Financial Year filter & automatic year-wise selector
 *  - Interactive Lot Audit logs tracing entries & usages across all modules
 *  - RM Processing Destination tracking (where it was processed & output FG lots)
 *  - FG Source RM tracking (the RM lot it was made from)
 *  - Balances counting & totals summary
 */
const StockStatusReport = () => {
  const [reportMode, setReportMode] = useState('summary') // 'summary' or 'lot'
  const [items, setItems] = useState([])
  const [selectedItem, setSelectedItem] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [stockData, setStockData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Custom enhanced states
  const [selectedCategory, setSelectedCategory] = useState('All') // 'All', 'RM', 'FG', 'Wastage'
  const [selectedFY, setSelectedFY] = useState('2024-2025')
  const [expandedLot, setExpandedLot] = useState(null)
  const [selectedLotNoFilter, setSelectedLotNoFilter] = useState('')
  const [isFGModalOpen, setIsFGModalOpen] = useState(false)
  const [selectedFGItem, setSelectedFGItem] = useState(null)
  const [fgLotDetails, setFgLotDetails] = useState([])
  const [modalLoading, setModalLoading] = useState(false)

  const { financialYear } = useAuth() || {}

  const getDatesForFinancialYear = (fyString) => {
    if (!fyString || fyString === 'All' || fyString === 'All Years') {
      return { start: '', end: '' };
    }
    const parts = fyString.split('-');
    if (parts.length === 2) {
      let startYear = parts[0].trim();
      let endYear = parts[1].trim();
      if (startYear.length === 2) startYear = '20' + startYear;
      if (endYear.length === 2) endYear = '20' + endYear;
      return {
        start: `${startYear}-04-01`,
        end: `${endYear}-03-31`
      };
    }
    return { start: '', end: '' };
  };

  // Sync with global financial year on mount
  useEffect(() => {
    if (financialYear) {
      setSelectedFY(financialYear);
      const dates = getDatesForFinancialYear(financialYear);
      setFromDate(dates.start);
      setToDate(dates.end);
    } else {
<<<<<<< HEAD
      const dates = getDatesForFinancialYear('2026-2027');
=======
      const dates = getDatesForFinancialYear('2024-2025');
>>>>>>> origin/main
      setFromDate(dates.start);
      setToDate(dates.end);
    }
  }, [financialYear]);

  // Fetch items for dropdown
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

  // Fetch stock report
  const fetchReport = async () => {
    setLoading(true)
    setError('')
    
    try {
      let url = ''
      let params = {}
      
      if (reportMode === 'summary') {
        url = '/api/reports/stock-status'
        if (selectedItem) params.item_id = selectedItem
        if (fromDate) params.from_date = fromDate
        if (toDate) params.to_date = toDate
      } else {
        url = '/api/stock/lots'
        if (selectedItem) params.item_id = selectedItem
      }
      
      const queryString = new URLSearchParams(params).toString()
      const response = await axios.get(`${url}${queryString ? '?' + queryString : ''}`)
      
      // Robust data handling
      let responseData = []
      if (response.data) {
        if (Array.isArray(response.data)) {
          responseData = response.data
        } else if (typeof response.data === 'object') {
          responseData = Array.isArray(response.data.data) ? response.data.data : []
        }
      }
      setStockData(responseData)
    } catch (err) {
      console.error('Error fetching stock report:', err)
      setError('Failed to load stock report')
      setStockData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [reportMode, selectedItem, fromDate, toDate])

  const handleFGClick = async (row) => {
    setSelectedFGItem(row);
    setIsFGModalOpen(true);
    setModalLoading(true);
    setFgLotDetails([]);
    try {
      const itemId = row.item_id || items.find(i => (i.name || i.item_name) === row.item_name)?.id;
      let url = '/api/stock/lots';
      if (itemId) {
        url += `?item_id=${itemId}`;
      }
      const response = await axios.get(url);
      let responseData = [];
      if (response.data) {
        if (Array.isArray(response.data)) {
          responseData = response.data;
        } else if (typeof response.data === 'object') {
          responseData = Array.isArray(response.data.data) ? response.data.data : [];
        }
      }
      if (!itemId) {
        responseData = responseData.filter(r => r.item_name === row.item_name);
      }
      setFgLotDetails(responseData.filter(r => r.category === 'FG'));
    } catch (err) {
      console.error('Error fetching FG lot details:', err);
    } finally {
      setModalLoading(false);
    }
  };

  const handlePrint = () => {
    window.print()
  }

  const toggleExpandLot = (lotNo) => {
    if (expandedLot === lotNo) {
      setExpandedLot(null);
    } else {
      setExpandedLot(lotNo);
    }
  };

  const safeStockData = Array.isArray(stockData) ? stockData : []

  // Client-side filtering by categories and lot number
  const filteredData = safeStockData.filter(row => {
    if (selectedCategory !== 'All') {
      const cat = String(row.category || row.stock_type || '').toUpperCase();
      const sel = String(selectedCategory).toUpperCase();
      if (sel === 'VACUUM') {
        if (cat !== 'VACUUM' && !String(row.item_name || '').toUpperCase().includes('VACUUM') && !String(row.stock_type || '').toUpperCase().includes('VACUUM')) {
          return false;
        }
      } else if (cat !== sel) {
        return false;
      }
    }
    if (selectedLotNoFilter && row.lot_no && !row.lot_no.toLowerCase().includes(selectedLotNoFilter.toLowerCase())) return false;
    return true;
  });

  // Calculate totals
  const totalCount = filteredData.length;
  const totalBalance = filteredData.reduce((sum, row) => {
    if (reportMode === 'summary') {
      return sum + (parseFloat(row.current_balance) || 0);
    } else {
      return sum + (parseFloat(row.remaining_quantity) || 0);
    }
  }, 0);

  const totalPurchasedQty = filteredData.reduce((sum, row) => {
    if (reportMode === 'summary') {
      return sum + (parseFloat(row.total_purchased) || 0);
    } else {
      return sum + (parseFloat(row.purchased_qty) || 0);
    }
  }, 0);

  const totalSoldQty = filteredData.reduce((sum, row) => {
    if (reportMode === 'summary') {
      return sum + (parseFloat(row.total_sold) || 0);
    } else {
      return sum + (parseFloat(row.sold_qty) || 0);
    }
  }, 0);

  return (
    <div className="window" style={styles.container}>
      <div className="screen-title" style={styles.titleText}>🏢 Stock Status & Traceability Report</div>

      {/* Filters Section */}
      <div className="report-filters" style={styles.filterBar}>
        <div className="filter-row" style={styles.dateBox}>
          <div className="filter-group" style={styles.filterItem}>
            <label>Report Mode:</label>
            <div className="radio-group">
              <label style={styles.radioLabel}>
                <input
                  type="radio"
                  name="reportMode"
                  value="summary"
                  checked={reportMode === 'summary'}
                  onChange={(e) => {
                    setReportMode(e.target.value);
                    setExpandedLot(null);
                  }}
                  style={styles.radio}
                />
                Product Summary
              </label>
              <label style={styles.radioLabel}>
                <input
                  type="radio"
                  name="reportMode"
                  value="lot"
                  checked={reportMode === 'lot'}
                  onChange={(e) => setReportMode(e.target.value)}
                  style={styles.radio}
                />
                Lot Breakdown
              </label>
            </div>
          </div>

          {/* Financial Year Selector */}
          <div className="filter-group" style={styles.filterItem}>
            <label>Financial Year:</label>
            <select
              className="uniform-input"
              value={selectedFY}
              onChange={(e) => {
                const fy = e.target.value;
                setSelectedFY(fy);
                const dates = getDatesForFinancialYear(fy);
                setFromDate(dates.start);
                setToDate(dates.end);
              }}
              style={styles.filterSelect}
            >
              <option value="All">All Years</option>
              <option value="2024-2025">FY 2024-25 (01/04/24 - 31/03/25)</option>
              <option value="2025-2026">FY 2025-26 (01/04/25 - 31/03/26)</option>
              <option value="2026-2027">FY 2026-27 (01/04/26 - 31/03/27)</option>
            </select>
          </div>

          <div className="filter-group" style={styles.filterItem}>
            <label>Item:</label>
            <select
              className="uniform-input"
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              style={styles.filterSelect}
            >
              <option value="">All Items</option>
              {items.map((item, idx) => (
                <option key={`${item.id || 'item'}-${idx}`} value={item.id}>{item.name || item.item_name}</option>
              ))}
            </select>
          </div>

          <div className="filter-group" style={styles.filterItem}>
            <label>Lot No:</label>
            <input
              type="text"
              placeholder="Search Lot No"
              className="uniform-input"
              value={selectedLotNoFilter}
              onChange={(e) => setSelectedLotNoFilter(e.target.value)}
              style={styles.filterInput}
            />
          </div>

          {reportMode === 'summary' && (
            <>
              <div className="filter-group" style={styles.filterItem}>
                <label>From Date:</label>
                <input
                  type="date"
                  className="uniform-input"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  style={styles.filterInput}
                />
              </div>

              <div className="filter-group" style={styles.filterItem}>
                <label>To Date:</label>
                <input
                  type="date"
                  className="uniform-input"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  style={styles.filterInput}
                />
              </div>
            </>
          )}

          <div className="filter-group" style={{ display: 'flex', gap: '8px', alignSelf: 'flex-end' }}>
            <button className="btn btn-primary" onClick={fetchReport} style={styles.searchBtn}>
              Search
            </button>
            <button className="btn btn-secondary" onClick={handlePrint} style={styles.printBtn}>
              Print
            </button>
          </div>
        </div>
      </div>

      {/* Category Tabs Bar */}
      <div style={styles.tabContainer}>
        {['All', 'RM', 'FG', 'Vacuum', 'Wastage'].map(cat => (
          <button
            key={cat}
            onClick={() => {
              setSelectedCategory(cat);
              setExpandedLot(null);
            }}
            style={{
              ...styles.tabButton,
              ...(selectedCategory === cat ? styles.tabButtonActive : {})
            }}
          >
            {cat === 'All' ? '📌 All Stock' : cat === 'RM' ? '🌾 Raw Material (RM)' : cat === 'FG' ? '📦 Finished Goods (FG)' : cat === 'Vacuum' ? '🌬️ Vacuum Stock' : '🗑️ Wastage Stock'}
          </button>
        ))}
      </div>

      {/* Error Message */}
      {error && <div className="message-box error" style={styles.errorMessage}>{error}</div>}

      {/* Loading */}
      {loading && <div className="loading" style={styles.loading}>Loading stock & trace register...</div>}

      {/* Product Summary Mode */}
      {!loading && reportMode === 'summary' && (
        <div className="report-table-container" style={styles.tableContainer}>
          <table className="report-table" style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Item Name</th>
                <th style={styles.th}>Category</th>
                <th style={{...styles.th, textAlign: 'right'}}>Weight (KG)</th>
                <th style={{...styles.th, textAlign: 'right'}}>Opening Stock</th>
                <th style={{...styles.th, textAlign: 'right'}}>Total Purchased/In</th>
                <th style={{...styles.th, textAlign: 'right'}}>Total Sold/Out</th>
                <th style={{...styles.th, textAlign: 'right'}}>Current Balance</th>
                <th style={{...styles.th, textAlign: 'right'}}>Weight Balance (KG)</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center" style={styles.noData}>No stock records matching criteria</td>
                </tr>
              ) : (
                filteredData.map((row, index) => {
                  const catColor = row.category === 'RM' ? '#b45309' : row.category === 'FG' ? '#16a34a' : '#dc2626';
                  const catBg = row.category === 'RM' ? '#fef3c7' : row.category === 'FG' ? '#dcfce7' : '#fee2e2';

                  return (
                    <tr key={index} style={{ background: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                      <td style={{...styles.td, fontWeight: 'bold'}}>
                        {row.category === 'FG' ? (
                          <span 
                            onClick={() => handleFGClick(row)} 
                            title="Click to view full traceability & process log"
                            style={{ color: '#2563eb', cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            {row.item_name}
                          </span>
                        ) : (
                          row.item_name
                        )}
                      </td>
                      <td style={styles.td}>
                        <span style={{
                          ...styles.tag,
                          color: catColor,
                          background: catBg
                        }}>
                          {row.category === 'RM' ? '🌾 RM' : row.category === 'FG' ? '📦 FG' : '🗑️ Wastage'}
                        </span>
                      </td>
                      <td className="text-right" style={{...styles.td, textAlign: 'right'}}>{parseFloat(row.weight || 0).toFixed(2)}</td>
                      <td className="text-right" style={{...styles.td, textAlign: 'right'}}>{parseFloat(row.opening_qty || 0).toFixed(2)}</td>
                      <td className="text-right" style={{...styles.td, textAlign: 'right'}}>{parseFloat(row.total_purchased || 0).toFixed(2)}</td>
                      <td className="text-right" style={{...styles.td, textAlign: 'right'}}>{parseFloat(row.total_sold || 0).toFixed(2)}</td>
                      <td className="text-right" style={{
                        ...styles.td,
                        textAlign: 'right',
                        fontWeight: 'bold',
                        color: (row.current_balance || 0) < 0 ? 'red' : 'green'
                      }}>
                        {parseFloat(row.current_balance || 0).toFixed(2)}
                      </td>
                      <td className="text-right" style={{
                        ...styles.td,
                        textAlign: 'right',
                        fontWeight: 'bold',
                        color: (row.current_balance_weight || 0) < 0 ? '#b91c1c' : '#15803d'
                      }}>
                        {parseFloat(row.current_balance_weight || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Lot Breakdown Mode */}
      {!loading && reportMode === 'lot' && (
        <div className="report-table-container" style={styles.tableContainer}>
          <table className="report-table" style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}></th>
                <th style={styles.th}>Item Name</th>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Lot No</th>
                <th style={styles.th}>Purchase Date</th>
                <th style={{...styles.th, textAlign: 'right'}}>Weight (KG)</th>
                <th style={{...styles.th, textAlign: 'right'}}>Purchased</th>
                <th style={{...styles.th, textAlign: 'right'}}>Sold</th>
                <th style={{...styles.th, textAlign: 'right'}}>Remaining</th>
                <th style={{...styles.th, textAlign: 'right'}}>Weight Remaining (KG)</th>
                <th style={{...styles.th, textAlign: 'right'}}>Rate</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan="11" className="text-center" style={styles.noData}>No lots matching criteria</td>
                </tr>
              ) : (
                filteredData.map((row, index) => {
                  const isExpanded = expandedLot === row.lot_no;
                  const catColor = row.category === 'RM' ? '#b45309' : row.category === 'FG' ? '#16a34a' : '#dc2626';
                  const catBg = row.category === 'RM' ? '#fef3c7' : row.category === 'FG' ? '#dcfce7' : '#fee2e2';

                  return (
                    <React.Fragment key={index}>
                      <tr style={{
                        background: isExpanded ? '#f1f5f9' : (index % 2 === 0 ? '#ffffff' : '#f8fafc'),
                        borderBottom: '1px solid #cbd5e1'
                      }}>
                        <td style={{...styles.td, textAlign: 'center', cursor: 'pointer', width: '35px'}} onClick={() => toggleExpandLot(row.lot_no)}>
                          <span style={{fontSize: '14px', fontWeight: 'bold', color: '#2c5fb8'}}>
                            {isExpanded ? '▼' : '►'}
                          </span>
                        </td>
                        <td style={{...styles.td, fontWeight: 'bold'}}>
                          {row.category === 'FG' ? (
                            <span 
                              onClick={() => handleFGClick(row)} 
                              title="Click to view full traceability & process log"
                              style={{ color: '#2563eb', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                              {row.item_name}
                            </span>
                          ) : (
                            row.item_name
                          )}
                          {row.lot_no && (
                            <span style={{
                              fontSize: '11px', 
                              color: '#475569', 
                              marginLeft: '8px', 
                              fontWeight: 'normal', 
                              background: '#f1f5f9', 
                              padding: '2px 6px', 
                              borderRadius: '4px',
                              border: '1px solid #cbd5e1',
                              fontFamily: 'monospace'
                            }}>
                              Lot: {row.lot_no}
                            </span>
                          )}
                        </td>
                        <td style={styles.td}>
                          <span style={{
                            ...styles.tag,
                            color: catColor,
                            background: catBg
                          }}>
                            {row.category === 'RM' ? '🌾 RM' : row.category === 'FG' ? '📦 FG' : '🗑️ Wastage'}
                          </span>
                        </td>
                        <td style={{...styles.td, fontFamily: 'monospace', fontWeight: 'bold', color: '#1e293b'}}>{row.lot_no}</td>
                        <td style={styles.td}>{row.created_at ? new Date(row.created_at).toLocaleDateString() : '-'}</td>
                        <td className="text-right" style={{...styles.td, textAlign: 'right'}}>{parseFloat(row.weight || 0).toFixed(2)}</td>
                        <td className="text-right" style={{...styles.td, textAlign: 'right'}}>{parseFloat(row.purchased_qty || 0).toFixed(2)}</td>
                        <td className="text-right" style={{...styles.td, textAlign: 'right'}}>{parseFloat(row.sold_qty || 0).toFixed(2)}</td>
                        <td className="text-right" style={{
                          ...styles.td,
                          textAlign: 'right',
                          fontWeight: 'bold',
                          color: (row.remaining_quantity || 0) <= 0 ? '#94a3b8' : 'green'
                        }}>
                          {parseFloat(row.remaining_quantity || 0).toFixed(2)}
                        </td>
                        <td className="text-right" style={{
                          ...styles.td,
                          textAlign: 'right',
                          fontWeight: 'bold',
                          color: (row.remaining_weight || 0) <= 0 ? '#94a3b8' : 'green'
                        }}>
                          {parseFloat(row.remaining_weight || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                        </td>
                        <td className="text-right" style={{...styles.td, textAlign: 'right', color: '#475569'}}>{parseFloat(row.rate || 0).toFixed(2)}</td>
                      </tr>

                      {isExpanded && (
                        <tr style={{background: '#f8fafc'}}>
                          <td colSpan={11} style={styles.expandedTd}>
                            <div style={styles.expandedCard}>
                              <h4 style={styles.expandedHeader}>
                                🔍 Trace Audit Log for Lot: <span style={{fontFamily: 'monospace', textDecoration: 'underline'}}>{row.lot_no}</span>
                              </h4>
                              
                              <div style={styles.detailsGrid}>
                                <div style={styles.detailItem}>
                                  <strong>Status:</strong> {parseFloat(row.remaining_quantity || 0) > 0 ? (
                                    <span style={{color: 'green', fontWeight: 'bold'}}>🟢 Active Stock</span>
                                  ) : (
                                    <span style={{color: '#64748b'}}>⚪ Fully Consumed</span>
                                  )}
                                </div>
                                <div style={styles.detailItem}><strong>Initial Qty:</strong> {parseFloat(row.purchased_qty || 0).toFixed(2)}</div>
                                <div style={styles.detailItem}><strong>Used Qty:</strong> {parseFloat(row.sold_qty || 0).toFixed(2)}</div>
                                <div style={styles.detailItem}><strong>Current Balance:</strong> <strong style={{color: 'green'}}>{parseFloat(row.remaining_quantity || 0).toFixed(2)}</strong></div>
                              </div>

                              <div style={{marginTop: '15px'}}>
                                <h5 style={styles.sectionHeader}>🔄 Lot Lifecycle Activity Log (Step-by-step Movement)</h5>
                                {row.lifecycle_history && row.lifecycle_history.length > 0 ? (
                                  <table style={styles.nestedTable}>
                                    <thead>
                                      <tr style={styles.nestedThRow}>
                                        <th style={styles.nestedTh}>Date</th>
                                        <th style={styles.nestedTh}>Module / Process</th>
                                        <th style={styles.nestedTh}>Voucher / Reference No</th>
                                        <th style={styles.nestedTh}>Party / Mill / Destination</th>
                                        <th style={styles.nestedTh}>Action</th>
                                        <th style={{...styles.nestedTh, textAlign: 'right'}}>Quantity Change</th>
                                        <th style={{...styles.nestedTh, textAlign: 'right'}}>Weight (kg)</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {row.lifecycle_history.map((hist, hIdx) => (
                                        <tr key={hIdx} style={{background: hist.type === 'Entry' ? '#f0fdf4' : '#fffbeb'}}>
                                          <td style={styles.nestedTd}>{new Date(hist.date).toLocaleDateString()}</td>
                                          <td style={{...styles.nestedTd, fontWeight: 'bold'}}>{hist.module}</td>
                                          <td style={styles.nestedTd}>{hist.reference_no || '-'}</td>
                                          <td style={styles.nestedTd}>{hist.party || '-'}</td>
                                          <td style={styles.nestedTd}>
                                            <span style={{
                                              padding: '2px 6px',
                                              borderRadius: '3px',
                                              fontSize: '11px',
                                              fontWeight: 'bold',
                                              color: hist.type === 'Entry' ? '#15803d' : '#b45309',
                                              background: hist.type === 'Entry' ? '#dcfce7' : '#fef3c7'
                                            }}>
                                              {hist.type === 'Entry' ? '📥 Entry / In' : '📤 Consumed / Out'}
                                            </span>
                                          </td>
                                          <td style={{...styles.nestedTd, textAlign: 'right', fontWeight: 'bold'}}>
                                            {hist.qty > 0 ? `+${hist.qty.toFixed(2)}` : hist.qty.toFixed(2)}
                                          </td>
                                          <td style={{...styles.nestedTd, textAlign: 'right'}}>
                                            {hist.weight > 0 ? `+${hist.weight.toFixed(2)}` : hist.weight.toFixed(2)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <div style={styles.noNestedData}>No explicit transaction logs found. Initial opening balance recorded.</div>
                                )}
                              </div>

                              {row.category === 'RM' && (
                                <div style={{marginTop: '15px', borderTop: '1px solid #e2e8f0', paddingTop: '10px'}}>
                                  <h5 style={styles.sectionHeader}>🌾 Raw Material Processing & Conversions</h5>
                                  {row.processing_details ? (
                                    <div style={styles.yieldContainer}>
                                      <p style={{fontSize: '13px', margin: '0 0 8px 0'}}>
                                        This raw material lot was sent to grinding. It was processed in <strong>{row.processing_details.processed_runs}</strong> production runs, yielding the following items:
                                      </p>
                                      
                                      <div style={styles.yieldGrid}>
                                        <div style={{background: '#f0fdf4', padding: '10px', borderRadius: '4px', border: '1px solid #bbf7d0'}}>
                                          <h6 style={{margin: '0 0 6px 0', fontSize: '12px', fontWeight: 'bold', color: '#16a34a'}}>🟢 Yielded Finished Goods (FG Lots)</h6>
                                          {row.processing_details.outputs && row.processing_details.outputs.length > 0 ? (
                                            <ul style={{margin: 0, paddingLeft: '15px', fontSize: '12px'}}>
                                              {row.processing_details.outputs.map((out, oIdx) => (
                                                <li key={oIdx} style={{marginBottom: '4px'}}>
                                                  <strong>{out.item_name}</strong> - Lot: <span style={{fontFamily: 'monospace', fontWeight: 'bold'}}>{out.lot_no}</span> ({out.qty} Bags / {out.weight} kg)
                                                </li>
                                              ))}
                                            </ul>
                                          ) : (
                                            <span style={{fontSize: '11px', color: '#64748b'}}>No FG lot registered.</span>
                                          )}
                                        </div>

                                        <div style={{background: '#fef2f2', padding: '10px', borderRadius: '4px', border: '1px solid #fecaca'}}>
                                          <h6 style={{margin: '0 0 6px 0', fontSize: '12px', fontWeight: 'bold', color: '#dc2626'}}>🔴 Yielded Processing Wastage</h6>
                                          {row.processing_details.wastages && row.processing_details.wastages.length > 0 ? (
                                            <ul style={{margin: 0, paddingLeft: '15px', fontSize: '12px'}}>
                                              {row.processing_details.wastages.map((was, wIdx) => (
                                                <li key={wIdx} style={{marginBottom: '4px'}}>
                                                  <strong>{was.item_name}</strong> ({was.qty} Bags / {was.weight} kg)
                                                </li>
                                              ))}
                                            </ul>
                                          ) : (
                                            <span style={{fontSize: '11px', color: '#64748b'}}>No process wastage recorded.</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div style={styles.noNestedData}>This lot has not been processed in any grinding/milling modules yet. Available for processing.</div>
                                  )}
                                </div>
                              )}

                              {row.category === 'FG' && (
                                <div style={{marginTop: '15px', borderTop: '1px solid #e2e8f0', paddingTop: '10px'}}>
                                  <h5 style={styles.sectionHeader}>🌾 Production Raw Material Source</h5>
                                  {row.source_details ? (
                                    <div style={{background: '#f8fafc', padding: '10px', borderRadius: '4px', border: '1px solid #e2e8f0'}}>
                                      <p style={{fontSize: '13px', margin: '0 0 6px 0'}}>This Finished Good lot was milled/manufactured from the following Raw Material inputs:</p>
                                      <ul style={{margin: 0, paddingLeft: '15px', fontSize: '12px'}}>
                                        {row.source_details.rm_inputs && row.source_details.rm_inputs.length > 0 ? (
                                          row.source_details.rm_inputs.map((inp, iIdx) => (
                                            <li key={iIdx} style={{marginBottom: '4px'}}>
                                              🌾 <strong>{inp.item_name}</strong> - Lot: <span style={{fontFamily: 'monospace', fontWeight: 'bold'}}>{inp.lot_no}</span> ({inp.qty} Bags / {inp.weight} kg used)
                                            </li>
                                          ))
                                        ) : (
                                          <li style={{color: '#64748b'}}>No source logs found.</li>
                                        )}
                                      </ul>
                                    </div>
                                  ) : (
                                    <div style={styles.noNestedData}>This FG lot was created directly (e.g. Opening Stock entry) rather than via grinding.</div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary Footer Widget - Final field count of balance stock */}
      <div style={styles.totalsWidget}>
        <div style={styles.widgetItem}>
          <span style={styles.widgetLabel}>Total Items:</span>
          <span style={styles.widgetValue}>{totalCount}</span>
        </div>
        <div style={styles.widgetItem}>
          <span style={styles.widgetLabel}>Total Purchased/Yielded:</span>
          <span style={styles.widgetValue}>{totalPurchasedQty.toFixed(2)} Bags</span>
        </div>
        <div style={styles.widgetItem}>
          <span style={styles.widgetLabel}>Total Sold/Consumed:</span>
          <span style={{...styles.widgetValue, color: '#dc2626'}}>{totalSoldQty.toFixed(2)} Bags</span>
        </div>
        <div style={styles.widgetItem}>
          <span style={styles.widgetLabel}>Current Balance Stock Count:</span>
          <span style={{...styles.widgetValue, color: 'green'}}>{totalBalance.toFixed(2)} Bags</span>
        </div>
      </div>

      {/* Small Window Modal for FG Details */}
      {isFGModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>📦 Finished Goods (FG) Traceability Details</h3>
              <button onClick={() => setIsFGModalOpen(false)} style={styles.modalCloseBtn}>×</button>
            </div>
            
            <div style={styles.modalBody}>
              <div style={styles.modalItemMeta}>
                <strong>Item Name:</strong> <span style={{fontSize: '15px', color: '#1d4ed8', fontWeight: 'bold'}}>{selectedFGItem?.item_name}</span>
              </div>
              
              {modalLoading ? (
                <div style={styles.modalLoading}>Loading lot details & process trace...</div>
              ) : fgLotDetails.length === 0 ? (
                <div style={styles.noData}>No Finished Goods lots found for this item in the records.</div>
              ) : (
                <div style={styles.lotList}>
                  {fgLotDetails.map((lot, idx) => (
                    <div key={idx} style={styles.lotCard}>
                      <div style={styles.lotCardHeader}>
                        <span style={styles.lotNoLabel}>Lot No: <strong style={{fontFamily: 'monospace'}}>{lot.lot_no}</strong></span>
                        <span style={{
                          ...styles.tag,
                          color: '#16a34a',
                          background: '#dcfce7'
                        }}>
                          Active Stock: {parseFloat(lot.remaining_quantity || 0).toFixed(2)} Bags
                        </span>
                      </div>
                      
                      <div style={styles.lotMetaGrid}>
                        <div><strong>Mfg Date:</strong> {lot.created_at ? new Date(lot.created_at).toLocaleDateString() : '-'}</div>
                        <div><strong>Yielded Qty:</strong> {parseFloat(lot.purchased_qty || 0).toFixed(2)} Bags</div>
                        <div><strong>Sold Qty:</strong> {parseFloat(lot.sold_qty || 0).toFixed(2)} Bags</div>
                        <div><strong>Rate:</strong> {parseFloat(lot.rate || 0).toFixed(2)}</div>
                      </div>

                      {/* Process & Grinding Details */}
                      <div style={styles.modalSection}>
                        <h4 style={styles.modalSectionTitle}>🌾 Milling / Grinding Process Tracing</h4>
                        {lot.source_details ? (
                          <div>
                            {/* Process Info */}
                            {lot.source_details.process_info && lot.source_details.process_info.length > 0 && (
                              <div style={{marginBottom: '10px', fontSize: '12px', background: '#f8fafc', padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0'}}>
                                {lot.source_details.process_info.map((p, pIdx) => (
                                  <div key={pIdx}>
                                    ⚙️ <strong>Process Ref:</strong> #{p.reference_no} | 🏭 <strong>Mill:</strong> {p.mill} | 📅 <strong>Date:</strong> {p.date ? new Date(p.date).toLocaleDateString() : '-'}
                                  </div>
                                ))}
                              </div>
                            )}

                            <div style={styles.modalTraceGrid}>
                              {/* Inputs */}
                              <div style={styles.modalTraceCol}>
                                <h5 style={{...styles.modalColTitle, color: '#b45309'}}>📥 Raw Material Inputs</h5>
                                {lot.source_details.rm_inputs && lot.source_details.rm_inputs.length > 0 ? (
                                  <ul style={styles.modalList}>
                                    {lot.source_details.rm_inputs.map((inp, iIdx) => (
                                      <li key={iIdx} style={styles.modalListItem}>
                                        <strong>{inp.item_name}</strong>
                                        <div style={{fontSize: '11px', color: '#475569'}}>
                                          Lot: <span style={{fontFamily: 'monospace'}}>{inp.lot_no}</span>
                                        </div>
                                        <div style={{fontSize: '11px', color: '#047857', fontWeight: '600'}}>
                                          {inp.qty} Bags / {inp.weight} kg
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <div style={styles.noNestedData}>No RM inputs recorded</div>
                                )}
                              </div>

                              {/* Outputs */}
                              <div style={styles.modalTraceCol}>
                                <h5 style={{...styles.modalColTitle, color: '#16a34a'}}>📤 Process Output (FG)</h5>
                                {lot.source_details.outputs && lot.source_details.outputs.length > 0 ? (
                                  <ul style={styles.modalList}>
                                    {lot.source_details.outputs.map((out, oIdx) => (
                                      <li key={oIdx} style={styles.modalListItem}>
                                        <strong style={{color: out.lot_no === lot.lot_no ? '#1d4ed8' : '#1e293b'}}>
                                          {out.item_name} {out.lot_no === lot.lot_no && '(This Lot)'}
                                        </strong>
                                        <div style={{fontSize: '11px', color: '#475569'}}>
                                          Lot: <span style={{fontFamily: 'monospace'}}>{out.lot_no}</span>
                                        </div>
                                        <div style={{fontSize: '11px', color: '#047857', fontWeight: '600'}}>
                                          {out.qty} Bags / {out.weight} kg
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <div style={styles.noNestedData}>No process outputs recorded</div>
                                )}
                              </div>

                              {/* Wastage */}
                              <div style={styles.modalTraceCol}>
                                <h5 style={{...styles.modalColTitle, color: '#dc2626'}}>🗑️ Process Wastage / Loss</h5>
                                {lot.source_details.wastages && lot.source_details.wastages.length > 0 ? (
                                  <ul style={styles.modalList}>
                                    {lot.source_details.wastages.map((was, wIdx) => (
                                      <li key={wIdx} style={styles.modalListItem}>
                                        <strong>{was.item_name}</strong>
                                        <div style={{fontSize: '11px', color: '#b91c1c', fontWeight: '600'}}>
                                          {was.qty} Bags / {was.weight} kg
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <div style={styles.noNestedData}>No wastage recorded</div>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div style={styles.noNestedData}>
                            This FG lot was recorded directly as opening stock/initial adjustment rather than via milling/grinding.
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div style={styles.modalFooter}>
              <button onClick={() => setIsFGModalOpen(false)} style={styles.modalCloseBtnPrimary}>Close Window</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Inline overrides styling for StockStatusReport for pristine visual polish
const styles = {
  container: {
    background: '#f1f5f9',
    padding: '16px',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
    margin: '10px'
  },
  titleText: {
    fontWeight: '800',
    color: '#0f172a',
    fontSize: '18px',
    marginBottom: '16px'
  },
  filterBar: {
    background: '#ffffff',
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    marginBottom: '16px'
  },
  dateBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  filterItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontSize: '13px',
    fontWeight: '600',
    color: '#475569'
  },
  radioLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    cursor: 'pointer',
    background: '#f8fafc',
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid #e2e8f0',
    marginRight: '8px',
    fontSize: '12px'
  },
  radio: {
    cursor: 'pointer'
  },
  filterInput: {
    padding: '6px 10px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '13px',
    background: '#fff',
    outline: 'none',
    color: '#1e293b'
  },
  filterSelect: {
    padding: '6px 10px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '13px',
    background: '#fff',
    minWidth: '150px',
    outline: 'none',
    color: '#1e293b'
  },
  searchBtn: {
    background: '#2563eb',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold',
    borderRadius: '6px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
  },
  printBtn: {
    background: '#475569',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold',
    borderRadius: '6px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
  },
  // Category tabs
  tabContainer: {
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '8px 16px',
    display: 'flex',
    gap: '8px',
    marginBottom: '16px'
  },
  tabButton: {
    background: 'none',
    border: 'none',
    padding: '6px 14px',
    fontSize: '13px',
    fontWeight: '600',
    color: '#64748b',
    cursor: 'pointer',
    borderRadius: '6px',
    transition: 'all 0.15s ease'
  },
  tabButtonActive: {
    background: '#f1f5f9',
    color: '#1e293b'
  },
  // Tag Styling
  tag: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '9999px',
    fontSize: '11px',
    fontWeight: 'bold',
    textTransform: 'uppercase'
  },
  // Error
  errorMessage: {
    padding: '12px 16px',
    background: '#fee2e2',
    color: '#991b1b',
    borderRadius: '6px',
    fontWeight: '500',
    fontSize: '13px',
    marginBottom: '16px'
  },
  // Loading
  loading: {
    textAlign: 'center',
    padding: '60px',
    color: '#2563eb',
    fontSize: '14px',
    fontWeight: '600'
  },
  // Table Container
  tableContainer: {
    overflowX: 'auto',
    marginBottom: '16px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    background: 'white',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  },
  th: {
    background: '#1e293b',
    color: 'white',
    border: '1px solid #334155',
    padding: '10px 14px',
    fontSize: '13px',
    textAlign: 'left',
    fontWeight: '700'
  },
  td: {
    border: '1px solid #e2e8f0',
    padding: '10px 14px',
    fontSize: '13px',
    color: '#334155'
  },
  noData: {
    textAlign: 'center',
    padding: '60px',
    color: '#64748b',
    fontSize: '13px'
  },
  // Accordion Details Tr
  expandedTd: {
    padding: '12px 18px',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0'
  },
  expandedCard: {
    background: 'white',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    padding: '16px',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
  },
  expandedHeader: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    fontWeight: '700',
    color: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px',
    background: '#f1f5f9',
    padding: '10px 14px',
    borderRadius: '6px',
    marginBottom: '12px',
    fontSize: '12px',
    color: '#475569'
  },
  detailItem: {
    lineHeight: '1.5'
  },
  sectionHeader: {
    fontSize: '12px',
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#475569',
    margin: '0 0 8px 0',
    letterSpacing: '0.05em'
  },
  nestedTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px',
    borderRadius: '6px',
    overflow: 'hidden',
    border: '1px solid #e2e8f0',
    background: '#ffffff'
  },
  nestedThRow: {
    background: '#cbd5e1'
  },
  nestedTh: {
    padding: '6px 10px',
    color: '#334155',
    textAlign: 'left',
    fontWeight: '700'
  },
  nestedTd: {
    padding: '6px 10px',
    borderBottom: '1px solid #e2e8f0',
    color: '#475569'
  },
  noNestedData: {
    padding: '12px',
    textAlign: 'center',
    color: '#64748b',
    background: '#f8fafc',
    borderRadius: '6px',
    border: '1px dashed #cbd5e1',
    fontSize: '12px'
  },
  yieldContainer: {
    background: '#f8fafc',
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0'
  },
  yieldGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    marginTop: '6px'
  },
  // Totals Widget Block
  totalsWidget: {
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '12px 18px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  },
  widgetItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  widgetLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#64748b'
  },
  widgetValue: {
    fontSize: '16px',
    fontWeight: '800',
    color: '#0f172a'
  },
  // Modal Styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    padding: '20px'
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
    width: '100%',
    maxWidth: '900px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid #cbd5e1',
    overflow: 'hidden'
  },
  modalHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc'
  },
  modalTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '700',
    color: '#1e293b'
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    color: '#64748b',
    cursor: 'pointer',
    lineHeight: '1',
    padding: '4px'
  },
  modalBody: {
    padding: '20px',
    overflowY: 'auto',
    flex: 1,
    backgroundColor: '#f1f5f9'
  },
  modalItemMeta: {
    backgroundColor: '#ffffff',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    marginBottom: '16px',
    fontSize: '14px',
    color: '#334155'
  },
  modalLoading: {
    textAlign: 'center',
    padding: '40px',
    color: '#2563eb',
    fontWeight: '600',
    fontSize: '14px'
  },
  lotList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  lotCard: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  },
  lotCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #f1f5f9',
    paddingBottom: '8px',
    marginBottom: '12px'
  },
  lotNoLabel: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#1e293b'
  },
  lotMetaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: '12px',
    fontSize: '12px',
    color: '#475569',
    backgroundColor: '#f8fafc',
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    marginBottom: '16px'
  },
  modalSection: {
    borderTop: '1px solid #e2e8f0',
    paddingTop: '12px'
  },
  modalSectionTitle: {
    margin: '0 0 10px 0',
    fontSize: '12px',
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  modalTraceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px',
    marginTop: '10px'
  },
  modalTraceCol: {
    backgroundColor: '#f8fafc',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    padding: '12px'
  },
  modalColTitle: {
    margin: '0 0 10px 0',
    fontSize: '12px',
    fontWeight: '700',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '6px'
  },
  modalList: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  modalListItem: {
    fontSize: '12px',
    paddingBottom: '6px',
    borderBottom: '1px dashed #e2e8f0'
  },
  modalFooter: {
    padding: '12px 20px',
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'flex-end',
    backgroundColor: '#f8fafc'
  },
  modalCloseBtnPrimary: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer'
  }
}

export default StockStatusReport
