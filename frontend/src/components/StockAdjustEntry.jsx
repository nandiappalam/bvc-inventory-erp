import React, { useState } from 'react'
import './StockAdjustEntry.css'
import api from '../utils/api'

const StockAdjustEntry = () => {
  const [formData, setFormData] = useState({
    adjust_date: new Date().toISOString().split('T')[0],
    item_name: '',
    old_qty: '',
    new_qty: '',
    reason: '',
    remarks: ''
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.item_name.trim()) {
      setMessage('Item name is required')
      setMessageType('error')
      return
    }
    setLoading(true)
    try {
      // Use Tauri API instead of fetch
      const result = await api.createStockAdjust(formData)
      if (result && result.success) {
        setMessage('Stock adjustment saved')
        setMessageType('success')
        setFormData({ adjust_date: new Date().toISOString().split('T')[0], item_name: '', old_qty: '', new_qty: '', reason: '', remarks: '' })
        setTimeout(() => setMessage(''), 3000)
      } else {
        setMessage(result?.message || 'Error saving')
        setMessageType('error')
      }
    } catch (error) {
      console.error('Error saving stock adjust:', error)
      setMessage('Error saving: ' + error.message)
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Top Title */}
      <div className="top-bar">Stock Adjust Entry</div>

      {/* Window Header */}
      <div className="window-header">
        Stock Adjustment
        <span className="close">✕</span>
      </div>

      <div className="form-wrapper">
        <form className="entry-form" onSubmit={handleSubmit}>
          {message && <div className={`message-box ${messageType}`}>{message}</div>}
          <div className="row"><label>Date</label><input type="date" name="adjust_date" value={formData.adjust_date} onChange={handleChange} /></div>
          <div className="row"><label>Item Name</label><input name="item_name" value={formData.item_name} onChange={handleChange} required /></div>
          <div className="row"><label>Old Qty</label><input name="old_qty" value={formData.old_qty} onChange={handleChange} /></div>
          <div className="row"><label>New Qty</label><input name="new_qty" value={formData.new_qty} onChange={handleChange} /></div>
          <div className="row"><label>Reason</label><input name="reason" value={formData.reason} onChange={handleChange} /></div>
          <div className="row"><label>Remarks</label><input name="remarks" value={formData.remarks} onChange={handleChange} /></div>
          <div className="btn-row"><button type="submit" className="save-btn" disabled={loading}>{loading ? 'Saving...' : 'Save'}</button></div>
        </form>
      </div>
    </div>
  )
}

export default StockAdjustEntry
