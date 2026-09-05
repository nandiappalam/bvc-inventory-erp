import React, { useState } from 'react'
import { createSale } from '../utils/api'
import './SalesEntry.css'

const SalesEntry = () => {
  const [formData, setFormData] = useState({
    bill_no: '',
    date: new Date().toISOString().split('T')[0],
    customer: '',
    address: '',
    sender: '',
    consignee: '',
    godown_from: '',
    lorry_no: '',
    po_no: '',
    driver: '',
    pay_type: '',
    tax_type: '',
    type: '',
    pur_trans: '',
    remarks: '',
    items: [{ item_name: '', lot_no: '', qty: '', box: '', rate: '', disc: '', tax: '', amount: '' }],
    bill_amt: 0,
    tax_amt: 0,
    total_amt: 0,
    deduction: 0,
    deduction_remarks: ''
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleItemChange = (index, name, value) => {
    const newItems = [...formData.items]
    newItems[index][name] = value
    setFormData(prev => ({ ...prev, items: newItems }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setMessageType('')
    try {
      const result = await createSale(formData, formData.items, {
        bill_amt: formData.bill_amt,
        tax_amt: formData.tax_amt,
        total_amt: formData.total_amt,
        deduction: formData.deduction
      })
      
      if (result.success) {
        setMessage('Sales saved successfully')
        setMessageType('success')
        setFormData({
          bill_no: '',
          date: new Date().toISOString().split('T')[0],
          pay_type: 'Credit',
          tax_type: 'Exclusive',
          type: '',
          lorry_no: '',
          p_o_no: '',
          driver: '',
          pur_trans: '',
          remarks: '',
          customer: '',
          address: '',
          sender: '',
          consigned_to: '',
          godown_from: '',
          bill_amt: 0,
          tax_amt: 0,
          total_amt: 0,
          deduction: '',
          deduction_remarks: '',
          items: [{ item_name: '', lot_no: '', qty: '', box: '', rate: '', disc: '', tax: '', amount: '' }]
        })
        setTimeout(() => setMessage(''), 3000)
      } else {
        setMessage('Error: ' + (result.message || 'Unknown error'))
        setMessageType('error')
      }
    } catch (err) {
      setMessage(err.message || 'Error saving sales')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Top Title */}
      <div className="top-bar">Sales Entry</div>

      {/* Window Header */}
      <div className="window-header">
        Sales Creation
        <span className="close">✕</span>
      </div>

      <div className="form-wrapper">
        {message && <div className={`message-box ${messageType}`}>{message}</div>}
        <form className="entry-form" onSubmit={handleSubmit}>
          <div className="row"><label>Bill No</label><input name="bill_no" value={formData.bill_no} onChange={handleChange} required /></div>
          <div className="row"><label>Date</label><input type="date" name="date" value={formData.date} onChange={handleChange} /></div>
          <div className="row"><label>Pay Type</label><input name="pay_type" value={formData.pay_type} onChange={handleChange} /></div>
          <div className="row"><label>Tax Type</label><input name="tax_type" value={formData.tax_type} onChange={handleChange} /></div>
          <div className="row"><label>Type</label><input name="type" value={formData.type} onChange={handleChange} /></div>
          <div className="row"><label>Lorry No</label><input name="lorry_no" value={formData.lorry_no} onChange={handleChange} /></div>
          <div className="row"><label>P.O No</label><input name="po_no" value={formData.po_no} onChange={handleChange} /></div>
          <div className="row"><label>Driver</label><input name="driver" value={formData.driver} onChange={handleChange} /></div>
          <div className="row"><label>Pur. Trans</label><input name="pur_trans" value={formData.pur_trans} onChange={handleChange} /></div>
          <div className="row"><label>Remarks</label><input name="remarks" value={formData.remarks} onChange={handleChange} /></div>
          <div className="row"><label>Customer</label><input name="customer" value={formData.customer} onChange={handleChange} /></div>
          <div className="row"><label>Address</label><input name="address" value={formData.address} onChange={handleChange} /></div>
          <div className="row"><label>Sender</label><input name="sender" value={formData.sender} onChange={handleChange} /></div>
          <div className="row"><label>Consigned To</label><input name="consignee" value={formData.consignee} onChange={handleChange} /></div>
          <div className="row"><label>Godown from</label><input name="godown_from" value={formData.godown_from} onChange={handleChange} /></div>

          <div className="grid-box">
            <table>
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Lot No</th>
                  <th>Qty</th>
                  <th>Box</th>
                  <th>Rate</th>
                  <th>Disc %</th>
                  <th>Tax %</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {formData.items.map((item, index) => (
                  <tr key={index}>
                    <td><input name="item_name" value={item.item_name} onChange={(e) => handleItemChange(index, 'item_name', e.target.value)} /></td>
                    <td><input name="lot_no" value={item.lot_no} onChange={(e) => handleItemChange(index, 'lot_no', e.target.value)} /></td>
                    <td><input name="qty" value={item.qty} onChange={(e) => handleItemChange(index, 'qty', e.target.value)} /></td>
                    <td><input name="box" value={item.box} onChange={(e) => handleItemChange(index, 'box', e.target.value)} /></td>
                    <td><input name="rate" value={item.rate} onChange={(e) => handleItemChange(index, 'rate', e.target.value)} /></td>
                    <td><input name="disc" value={item.disc} onChange={(e) => handleItemChange(index, 'disc', e.target.value)} /></td>
                    <td><input name="tax" value={item.tax} onChange={(e) => handleItemChange(index, 'tax', e.target.value)} /></td>
                    <td><input name="amount" value={item.amount} onChange={(e) => handleItemChange(index, 'amount', e.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="totals">
            <div><label>Bill Amt</label><input value={formData.bill_amt} readOnly /></div>
            <div><label>Tax Amt</label><input value={formData.tax_amt} readOnly /></div>
            <div><label>Total Amt</label><input value={formData.total_amt} readOnly /></div>
          </div>

          <div className="deduction">
            <div><label>Deduction</label><input name="deduction" value={formData.deduction !== undefined && formData.deduction !== null ? formData.deduction : ''} onChange={handleChange} /></div>
            <div><label>Remarks</label><input name="deduction_remarks" value={formData.deduction_remarks || ''} onChange={handleChange} /></div>
          </div>

          <div className="actions"><button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save'}</button></div>
        </form>
      </div>
    </div>
  )
}

export default SalesEntry
