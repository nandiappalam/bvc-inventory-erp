import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import './ReportPage.css'

/**
 * ReportPage - Generic Report Display Component
 * Styled to match original HTML format (Entry/papad in Display.html)
 */
const ReportPage = ({ reportType, title }) => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    item_id: '',
    from_date: '',
    to_date: '',
    supplier_id: '',
    customer_id: '',
    lot_no: ''
  })

  // Auto-fill lot_no from search parameters
  useEffect(() => {
    const lotQuery = searchParams.get('lotNo') || searchParams.get('lot_no')
    if (lotQuery) {
      setFilters(prev => ({ ...prev, lot_no: lotQuery }))
    }
  }, [searchParams])
  const [items, setItems] = useState([])

  // Report configurations
  const reportConfig = {
    'stock-status': {
      title: 'Stock Status Report',
      endpoint: '/api/reports/stock-status',
      columns: [
        { key: 'item_name', label: 'Item' },
        { key: 'opening_qty', label: 'Opening Stock' },
        { key: 'total_purchased', label: 'Total Purchased' },
        { key: 'total_sold', label: 'Total Sold' },
        { key: 'current_balance', label: 'Current Balance' }
      ],
      filters: ['item', 'date']
    },
    'lot-history': {
      title: 'Lot History Report',
      endpoint: '/api/reports/lot-history',
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'item_name', label: 'Item Name' },
        { key: 'lot_no', label: 'Lot No' },
        { key: 'type', label: 'Type' },
        { key: 'reference_no', label: 'Reference No' },
        { key: 'qty_in', label: 'Qty In' },
        { key: 'qty_out', label: 'Qty Out' },
        { key: 'rejection_qty', label: 'Rejection Qty' },
        { key: 'open_stock_qty', label: 'Open Stock Qty' },
        { key: 'balance', label: 'Balance' },
        { key: 'weight', label: 'KG (per Bag)' },
        { key: 'overall_kg', label: 'Overall KG' },
        { key: 'balance_kg', label: 'Balance KG' }
      ],
      filters: ['item', 'lot']
    },
    'purchase-register': {
      title: 'Purchase Register',
      endpoint: '/api/reports/purchase-register',
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'bill_no', label: 'Bill No' },
        { key: 'supplier', label: 'Supplier' },
        { key: 'item_name', label: 'Item' },
        { key: 'lot_no', label: 'Lot No' },
        { key: 'qty', label: 'Qty' },
        { key: 'rate', label: 'Rate' },
        { key: 'amount', label: 'Amount' }
      ],
      filters: ['supplier', 'date']
    },
    'sales-register': {
      title: 'Sales Register',
      endpoint: '/api/reports/sales-register',
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'invoice_no', label: 'Invoice No' },
        { key: 'customer', label: 'Customer' },
        { key: 'item_name', label: 'Item' },
        { key: 'lot_no', label: 'Lot No' },
        { key: 'qty', label: 'Qty' },
        { key: 'rate', label: 'Rate' },
        { key: 'amount', label: 'Amount' }
      ],
      filters: ['customer', 'date']
    },
    'purchase-return-register': {
      title: 'Purchase Return Register',
      endpoint: '/api/reports/purchase-return-register',
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'return_no', label: 'Return No' },
        { key: 'supplier_name', label: 'Supplier' },
        { key: 'item_name', label: 'Item' },
        { key: 'qty', label: 'Qty' },
        { key: 'amount', label: 'Amount' }
      ],
      filters: ['supplier', 'date']
    },
    'sales-return-register': {
      title: 'Sales Return Register',
      endpoint: '/api/reports/sales-return-register',
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'return_no', label: 'Return No' },
        { key: 'customer', label: 'Customer' },
        { key: 'item_name', label: 'Item' },
        { key: 'qty', label: 'Qty' },
        { key: 'amount', label: 'Amount' }
      ],
      filters: ['customer', 'date']
    },
    'papad-ledger': {
      title: 'Papad Ledger',
      endpoint: '/api/reports/papad-ledger',
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'voucher_no', label: 'Voucher No' },
        { key: 'particulars', label: 'Particulars' },
        { key: 'debit', label: 'Debit' },
        { key: 'credit', label: 'Credit' },
        { key: 'balance', label: 'Balance' }
      ],
      filters: ['date']
    },
    'supplier-ledger': {
      title: 'Supplier Ledger',
      endpoint: '/api/reports/supplier-ledger',
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'voucher_no', label: 'Voucher No' },
        { key: 'type', label: 'Type' },
        { key: 'debit', label: 'Debit' },
        { key: 'credit', label: 'Credit' },
        { key: 'balance', label: 'Balance' }
      ],
      filters: ['supplier', 'date']
    },
    'customer-ledger': {
      title: 'Customer Ledger',
      endpoint: '/api/reports/customer-ledger',
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'voucher_no', label: 'Voucher No' },
        { key: 'type', label: 'Type' },
        { key: 'debit', label: 'Debit' },
        { key: 'credit', label: 'Credit' },
        { key: 'balance', label: 'Balance' }
      ],
      filters: ['customer', 'date']
    }
  }

  const config = reportConfig[reportType] || reportConfig['stock-status']

  // Fetch items for dropdown
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await axios.get('/api/masters/items')
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

  // Fetch report data
  const fetchReport = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (filters.item_id) params.append('item_id', filters.item_id)
      if (filters.from_date) params.append('from_date', filters.from_date)
      if (filters.to_date) params.append('to_date', filters.to_date)
      if (filters.supplier_id) params.append('supplier_id', filters.supplier_id)
      if (filters.customer_id) params.append('customer_id', filters.customer_id)
      if (filters.lot_no) params.append('lot_no', filters.lot_no)

      const response = await axios.get(`${config.endpoint}?${params.toString()}`)
      
      let responseData = []
      if (response.data) {
        if (Array.isArray(response.data)) {
          responseData = response.data
        } else if (typeof response.data === 'object') {
          responseData = Array.isArray(response.data.data) ? response.data.data : []
        }
      }
      setData(responseData)
    } catch (err) {
      setError('Error fetching report data: ' + err.message)
      setData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [reportType, config.endpoint, filters.lot_no])

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setFilters(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    fetchReport()
  }

  const handlePrint = () => {
    window.print()
  }

  const handleClear = () => {
    setFilters({
      item_id: '',
      from_date: '',
      to_date: '',
      supplier_id: '',
      customer_id: '',
      lot_no: ''
    })
    setTimeout(fetchReport, 100)
  }

  const safeData = Array.isArray(data) ? data : []

  return (
    <div style={styles.container}>
      {/* Title Bar - Same as HTML format */}
      <div style={styles.titleBar}>
        <span style={styles.titleText}>{config.title}</span>
        
        <div style={styles.dateBox}>
          {config.filters.includes('item') && (
            <span style={styles.filterItem}>
              Item : 
              <select 
                name="item_id" 
                value={filters.item_id} 
                onChange={handleFilterChange}
                style={styles.filterSelect}
              >
                <option value="">All Items</option>
                {items.map(item => (
                  <option key={item.id} value={item.id}>{item.name || item.item_name}</option>
                ))}
              </select>
            </span>
          )}

          {config.filters.includes('lot') && (
            <span style={styles.filterItem}>
              Lot No : 
              <input 
                type="text" 
                name="lot_no" 
                value={filters.lot_no} 
                onChange={handleFilterChange}
                placeholder="Lot No"
                style={styles.filterInput}
              />
            </span>
          )}

          {config.filters.includes('date') && (
            <>
              <span style={styles.filterItem}>
                From Date :
                <input 
                  type="date" 
                  name="from_date" 
                  value={filters.from_date} 
                  onChange={handleFilterChange}
                  style={styles.filterInput}
                />
              </span>
              <span style={styles.filterItem}>
                To Date :
                <input 
                  type="date" 
                  name="to_date" 
                  value={filters.to_date} 
                  onChange={handleFilterChange}
                  style={styles.filterInput}
                />
              </span>
            </>
          )}

          <button type="button" onClick={handleSubmit} style={styles.searchBtn}>Search</button>
          <button type="button" onClick={handleClear} style={styles.clearBtn}>Clear</button>
        </div>
      </div>

      {/* Error Message */}
      {error && <div style={styles.errorMessage}>{error}</div>}

      {/* Loading */}
      {loading && <div style={styles.loading}>Loading...</div>}

      {/* Data Table - Same as HTML format */}
      {!loading && !error && (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                {config.columns.map(col => (
                  <th key={col.key} style={styles.th}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {safeData.length > 0 ? (
                safeData.map((row, index) => (
                  <tr key={index}>
                    {config.columns.map(col => {
                      const val = row[col.key];
                      const isClickable = ['lot_no', 'bill_no', 'invoice_no', 'voucher_no', 'reference_no', 'return_no'].includes(col.key) && val && val !== '-';
                      
                      const handleClick = () => {
                        if (!isClickable) return;
                        if (col.key === 'lot_no') {
                          navigate(`/report/lot-history?lotNo=${encodeURIComponent(val)}`);
                        } else if (col.key === 'bill_no' || col.key === 'reference_no' || col.key === 'return_no') {
                          const type = String(row.type || '').trim().toLowerCase();
                          if (type.includes('purchase return')) {
                            navigate(`/entry/purchase-return-display?search=${encodeURIComponent(val)}`);
                          } else if (type.includes('purchase')) {
                            navigate(`/entry/purchase-display?search=${encodeURIComponent(val)}`);
                          } else if (type.includes('sales return')) {
                            navigate(`/entry/sales-return-display?search=${encodeURIComponent(val)}`);
                          } else if (type.includes('sale')) {
                            navigate(`/entry/sales-display?search=${encodeURIComponent(val)}`);
                          } else if (type.includes('grinding') || type.includes('grind')) {
                            navigate(`/entry/grind-display?search=${encodeURIComponent(val)}`);
                          } else if (type.includes('flour out return') || type.includes('flour_out_return')) {
                            navigate(`/entry/flour-out-return-display?search=${encodeURIComponent(val)}`);
                          } else if (type.includes('flour out') || type.includes('flour_out')) {
                            navigate(`/entry/flour-out-display?search=${encodeURIComponent(val)}`);
                          } else {
                            navigate(`/entry/purchase-display?search=${encodeURIComponent(val)}`);
                          }
                        } else if (col.key === 'invoice_no') {
                          navigate(`/entry/sales-display?search=${encodeURIComponent(val)}`);
                        } else if (col.key === 'voucher_no') {
                          navigate(`/entry/voucher-display?search=${encodeURIComponent(val)}`);
                        }
                      };

                      let displayVal = val;
                      if (col.key.includes('amount') || col.key.includes('debit') || col.key.includes('credit') || col.key.includes('balance') || col.key.includes('qty') || col.key.includes('rate') || col.key === 'weight' || col.key === 'overall_kg' || col.key === 'balance_kg') {
                        displayVal = parseFloat(val || 0).toFixed(2);
                      } else {
                        displayVal = val || '-';
                      }

                      return (
                        <td 
                          key={col.key} 
                          style={{
                            ...styles.td,
                            ...(isClickable ? { color: '#2c5fb8', cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold' } : {})
                          }}
                          onClick={isClickable ? handleClick : undefined}
                        >
                          {displayVal}
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={config.columns.length} style={styles.noData}>
                    No data found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer - Same as HTML format */}
      <div style={styles.footerBar}>
        <div style={styles.footerLeft}>
          <button onClick={handlePrint} style={styles.printBtn}>Print</button>
          <button style={styles.actionBtn}>Edit</button>
          <button style={styles.actionBtn}>Update</button>
        </div>
        <div style={styles.footerRight}>
          Row(s): {safeData.length}
        </div>
      </div>
    </div>
  )
}

// Styles matching original HTML format (Entry/papad in Display.html)
const styles = {
  container: {
    margin: '0',
    fontFamily: 'Arial, sans-serif',
    background: '#eaf2ff',
    minHeight: 'auto',
    display: 'flex',
    flexDirection: 'column'
  },
  // Title Bar - matches .title-bar
  titleBar: {
    background: '#f5f8ff',
    borderBottom: '1px solid #9bb6e5',
    padding: '6px 10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  titleText: {
    fontWeight: 'bold',
    fontSize: '16px',
    color: '#333'
  },
  dateBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap'
  },
  filterItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '13px'
  },
  filterInput: {
    marginLeft: '5px',
    padding: '4px 6px',
    border: '1px solid #9bb6e5',
    borderRadius: '3px',
    fontSize: '13px',
    background: '#fff'
  },
  filterSelect: {
    marginLeft: '5px',
    padding: '4px 6px',
    border: '1px solid #9bb6e5',
    borderRadius: '3px',
    fontSize: '13px',
    background: '#fff',
    minWidth: '120px'
  },
  searchBtn: {
    background: '#2c5fb8',
    color: 'white',
    border: 'none',
    padding: '5px 12px',
    cursor: 'pointer',
    fontSize: '13px',
    borderRadius: '3px'
  },
  clearBtn: {
    background: '#6c757d',
    color: 'white',
    border: 'none',
    padding: '5px 12px',
    cursor: 'pointer',
    fontSize: '13px',
    borderRadius: '3px'
  },
  // Error
  errorMessage: {
    padding: '10px',
    background: '#f8d7da',
    color: '#721c24',
    margin: '10px',
    borderRadius: '4px'
  },
  // Loading
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: '#2c5fb8',
    fontSize: '14px'
  },
  // Table Container - matches .table-container
  tableContainer: {
    padding: '10px',
    flex: '1',
    maxHeight: 'calc(100vh - 200px)',
    overflowY: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    background: 'white'
  },
  // Table Header - matches th
  th: {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    background: '#2c5fb8',
    color: 'white',
    border: '1px solid #9bb6e5',
    padding: '5px',
    fontSize: '13px',
    textAlign: 'left',
    fontWeight: 'bold'
  },
  td: {
    border: '1px solid #c5d6f5',
    height: '28px',
    padding: '5px',
    fontSize: '13px'
  },
  noData: {
    textAlign: 'center',
    padding: '40px',
    color: '#999'
  },
  // Footer Bar - matches .footer-bar
  footerBar: {
    background: '#f5f8ff',
    borderTop: '1px solid #9bb6e5',
    padding: '6px 10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  footerLeft: {
    display: 'flex',
    gap: '5px'
  },
  footerRight: {
    fontWeight: 'bold',
    fontSize: '13px'
  },
  printBtn: {
    background: '#2c5fb8',
    color: 'white',
    border: 'none',
    padding: '5px 12px',
    cursor: 'pointer',
    fontSize: '13px',
    borderRadius: '3px'
  },
  actionBtn: {
    background: '#2c5fb8',
    color: 'white',
    border: 'none',
    padding: '5px 12px',
    cursor: 'pointer',
    fontSize: '13px',
    borderRadius: '3px'
  }
}

export default ReportPage
