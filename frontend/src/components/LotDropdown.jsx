import React, { useState, useEffect } from 'react'
import axios from 'axios'

/**
 * LotDropdown - Displays available lots for an item with stock count
 * Used in Sales Create page when selecting an item
 * 
 * Props:
 * - label: Display label for the dropdown
 * - itemId: Selected item ID
 * - itemName: Selected item name
 * - value: Current selected value (lot_no)
 * - onChange: Function to handle change (returns {lot_no, remaining_qty})
 * - required: Whether the field is required
 * - disabled: Whether the dropdown is disabled
 */
const LotDropdown = ({ 
  label = 'Select Lot', 
  itemId, 
  itemName,
  value, 
  onChange, 
  required = false,
  placeholder = 'Select lot...',
  disabled = false
}) => {
  const [lots, setLots] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Fetch available lots when item changes
  useEffect(() => {
    if (!itemName && !itemId) {
      setLots([])
      return
    }

    const fetchLots = async () => {
      setLoading(true)
      setError('')
      
      try {
        const params = itemId ? `?item_id=${itemId}` : `?item_name=${encodeURIComponent(itemName)}`
        const response = await axios.get(`/api/stock/available-lots${params}`)
        
        if (Array.isArray(response.data)) {
          setLots(response.data)
        } else {
          setLots([])
        }
      } catch (err) {
        console.error('Error fetching lots:', err)
        setError('Failed to load lots')
        setLots([])
      } finally {
        setLoading(false)
      }
    }

    fetchLots()
  }, [itemId, itemName])

  const handleChange = (e) => {
    const selectedLotNo = e.target.value
    const selectedLot = lots.find(lot => lot.lot_no === selectedLotNo)
    
    if (onChange) {
      onChange({
        lot_no: selectedLotNo,
        remaining_quantity: selectedLot ? selectedLot.remaining_quantity : 0
      })
    }
  }

  if (loading) {
    return (
      <div className="form-row">
        <label>
          {label}
          {required && <span className="required">*</span>}
        </label>
        <select className="uniform-input" disabled>
          <option>Loading lots...</option>
        </select>
      </div>
    )
  }

  if (error) {
    return (
      <div className="form-row">
        <label>
          {label}
          {required && <span className="required">*</span>}
        </label>
        <select className="uniform-input error" disabled>
          <option>{error}</option>
        </select>
      </div>
    )
  }

  // If no lots available, show message
  const totalAvailable = lots.reduce((sum, lot) => sum + lot.remaining_quantity, 0)

  return (
    <div className="form-row">
      <label>
        {label}
        {required && <span className="required">*</span>}
      </label>
      <select
        className="uniform-input"
        value={value || ''}
        onChange={handleChange}
        disabled={disabled || loading || lots.length === 0}
        required={required}
      >
        <option value="">{placeholder}</option>
        {lots.map((lot, idx) => {
          const qty = lot.remaining_quantity ?? lot.available_qty ?? lot.balance_qty ?? lot.stock ?? 0;
          const wt = lot.per_unit_weight ?? lot.weight ?? 0;
          const wtStr = wt > 0 ? ` | Wt: ${wt}KG` : '';
          const rateVal = lot.purc_rate ?? lot.purchase_rate ?? lot.rate ?? 0;
          const rateStr = rateVal > 0 ? ` | Rate: ₹${parseFloat(rateVal).toFixed(2)}` : '';
          const supStr = lot.supplier_name && lot.supplier_name !== '-' ? ` | ${lot.supplier_name}` : '';
          return (
            <option key={`${lot.lot_no || 'lot'}-${idx}`} value={lot.lot_no}>
              {lot.display || `${lot.lot_no}${wtStr} | Stock: ${parseFloat(qty).toFixed(3)}${rateStr}${supStr}`}
            </option>
          );
        })}
      </select>
      {lots.length > 0 && (
        <span style={{ marginLeft: '8px', fontSize: '11px', color: '#1976d2' }}>
          Total: {totalAvailable}
        </span>
      )}
      {lots.length === 0 && itemName && !loading && (
        <span style={{ marginLeft: '8px', fontSize: '11px', color: '#f44336' }}>
          No stock available
        </span>
      )}
    </div>
  )
}

export default LotDropdown
