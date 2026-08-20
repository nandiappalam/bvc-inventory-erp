import React, { useState } from 'react'
import axios from 'axios'
import './BVCFOCreate.css'

const BVCFOCreate = () => {
  const [formData, setFormData] = useState({
    s_no: '1',
    date: '',
    papad_company: '',
    remarks: ''
  })
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const addRow = () => {
    setItems([...items, {
      item_name: '',
      lot_no: '',
      weight: 0,
      qty: 0,
      total_wt: 0,
      papad_kg: 0,
      wages_bag: 0,
      wages: 0
    }])
  }

  const updateItem = (index, field, value) => {
    const updatedItems = [...items]
    updatedItems[index][field] = value

    // Auto-calculate total weight and wages
    if (field === 'weight' || field === 'qty') {
      const weight = parseFloat(updatedItems[index].weight) || 0
      const qty = parseFloat(updatedItems[index].qty) || 0
      updatedItems[index].total_wt = weight * qty
    }

    if (field === 'papad_kg' || field === 'wages_bag') {
      const papad_kg = parseFloat(updatedItems[index].papad_kg) || 0
      const wages_bag = parseFloat(updatedItems[index].wages_bag) || 0
      updatedItems[index].wages = papad_kg * wages_bag
    }

    setItems(updatedItems)
  }

  const deleteRow = (index) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const calculateTotals = () => {
    return items.reduce((totals, item) => ({
      qty: totals.qty + (parseFloat(item.qty) || 0),
      weight: totals.weight + (parseFloat(item.total_wt) || 0),
      wages: totals.wages + (parseFloat(item.wages) || 0)
    }), { qty: 0, weight: 0, wages: 0 })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (!formData.date) {
      setError('Date is required')
      setLoading(false)
      return
    }

    if (!formData.papad_company.trim()) {
      setError('Papad Company is required')
      setLoading(false)
      return
    }

    if (items.length === 0) {
      setError('At least one item is required')
      setLoading(false)
      return
    }

    try {
      const flourOutData = {
        ...formData,
        items: items,
        total_qty: calculateTotals().qty,
        total_weight: calculateTotals().weight,
        total_wages: calculateTotals().wages
      }

      const response = await axios.post('/api/flour-out', flourOutData)

      if (response.status === 201) {
        setSuccess('Flour Out created successfully')
        // Clear form
        setFormData({
          s_no: '1',
          date: '',
          papad_company: '',
          remarks: ''
        })
        setItems([])
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error creating flour out')
    } finally {
      setLoading(false)
    }
  }

  const totals = calculateTotals()

  return (
    <div>
      <div className="title-bar">Flour Out Creation</div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      {/* FORM SECTION */}
      <div className="form-container">
        <label>S.No</label>
        <input
          type="text"
          name="s_no"
          value={formData.s_no}
          onChange={handleInputChange}
        />

        <label>Date</label>
        <input
          type="date"
          name="date"
          value={formData.date}
          onChange={handleInputChange}
          required
        />

        <label>Papad Company</label>
        <input
          type="text"
          name="papad_company"
          value={formData.papad_company}
          onChange={handleInputChange}
          required
        />

        <label>Remarks</label>
        <input
          type="text"
          name="remarks"
          value={formData.remarks}
          onChange={handleInputChange}
        />
      </div>

      {/* TABLE SECTION */}
      <button className="add-row-btn" onClick={addRow}>+ Add Row</button>

      <table className="data-table">
        <thead>
          <tr>
            <th>S.No</th>
            <th>Item Name</th>
            <th>Lot No</th>
            <th>Weight</th>
            <th>Qty</th>
            <th>Total Wt</th>
            <th>Papad Kg</th>
            <th>Wages / Bag</th>
            <th>Wages</th>
            <th>Delete</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td>{index + 1}</td>
              <td>
                <input
                  type="text"
                  value={item.item_name}
                  onChange={(e) => updateItem(index, 'item_name', e.target.value)}
                  className="table-input"
                />
              </td>
              <td>
                <input
                  type="text"
                  value={item.lot_no}
                  onChange={(e) => updateItem(index, 'lot_no', e.target.value)}
                  className="table-input"
                />
              </td>
              <td>
                <input
                  type="number"
                  value={item.weight}
                  onChange={(e) => updateItem(index, 'weight', e.target.value)}
                  className="table-input"
                />
              </td>
              <td>
                <input
                  type="number"
                  value={item.qty}
                  onChange={(e) => updateItem(index, 'qty', e.target.value)}
                  className="table-input"
                />
              </td>
              <td>
                <input
                  type="number"
                  value={item.total_wt}
                  readOnly
                  className="table-input"
                />
              </td>
              <td>
                <input
                  type="number"
                  value={item.papad_kg}
                  onChange={(e) => updateItem(index, 'papad_kg', e.target.value)}
                  className="table-input"
                />
              </td>
              <td>
                <input
                  type="number"
                  value={item.wages_bag}
                  onChange={(e) => updateItem(index, 'wages_bag', e.target.value)}
                  className="table-input"
                />
              </td>
              <td>
                <input
                  type="number"
                  value={item.wages}
                  readOnly
                  className="table-input"
                />
              </td>
              <td>
                <button onClick={() => deleteRow(index)} className="delete-btn">X</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="totals-box">
        <div>Total Qty: <span>{totals.qty.toFixed(2)}</span></div>
        <div>Total Weight: <span>{totals.weight.toFixed(2)}</span></div>
        <div>Total Wages: <span>{totals.wages.toFixed(2)}</span></div>
      </div>

      <button className="save-btn" onClick={handleSubmit} disabled={loading}>
        {loading ? 'Saving...' : 'Save'}
      </button>
    </div>
  )
}

export default BVCFOCreate
