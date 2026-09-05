import React, { useState } from 'react'
import './PackingEntry.css'
import api from '../utils/api'

const PackingEntry = () => {
  const [formData, setFormData] = useState({
    packing_date: new Date().toISOString().split('T')[0],
    item_name: '',
    quantity: '',
    packing_size: '',
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
      const result = await api.createPacking(formData)
      if (result && result.success) {
        setMessage('Packing entry saved')
        setMessageType('success')
        setFormData({ packing_date: new Date().toISOString().split('T')[0], item_name: '', quantity: '', packing_size: '', remarks: '' })
        setTimeout(() => setMessage(''), 3000)
      } else {
        setMessage(result?.message || 'Error saving')
        setMessageType('error')
      }
    } catch (error) {
      console.error('Error saving packing:', error)
      setMessage('Error saving: ' + error.message)
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Top Title */}
      <div className="top-bar">Packing Entry</div>

      {/* Window Header */}
      <div className="window-header">
        Packing Entry
        <span className="close">✕</span>
      </div>

      <div className="form-wrapper">
        <form className="entry-form" onSubmit={handleSubmit}>
          {message && <div className={`message-box ${messageType}`}>{message}</div>}
          <div className="row"><label>Date</label><input type="date" name="packing_date" value={formData.packing_date} onChange={handleChange} /></div>
          <div className="row"><label>Item Name</label><input name="item_name" value={formData.item_name} onChange={handleChange} required /></div>
          <div className="row"><label>Quantity</label><input name="quantity" value={formData.quantity} onChange={handleChange} /></div>
          <div className="row"><label>Packing Size</label><input name="packing_size" value={formData.packing_size} onChange={handleChange} /></div>
          <div className="row"><label>Remarks</label><input name="remarks" value={formData.remarks} onChange={handleChange} /></div>
          <div className="btn-row"><button type="submit" className="save-btn" disabled={loading}>{loading ? 'Saving...' : 'Save'}</button></div>
        </form>
      </div>
    </div>
  )
}

export default PackingEntry
