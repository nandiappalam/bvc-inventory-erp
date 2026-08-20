import React, { useState } from 'react'
import axios from 'axios'
import './customer-entry.css'

const CustomerCreationPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    print_name: '',
    contact_person: '',
    address1: '',
    address2: '',
    address3: '',
    address4: '',
    gst_number: '',
    phone_off: '',
    phone_res: '',
    mobile1: '',
    mobile2: '',
    area: '',
    opening_balance: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setError('Customer Name is required!')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await axios.post('/api/masters/customer_master', {
        name: formData.name,
        print_name: formData.print_name,
        contact_person: formData.contact_person,
        address1: formData.address1,
        address2: formData.address2,
        address3: formData.address3,
        address4: formData.address4,
        gst_number: formData.gst_number,
        phone_off: formData.phone_off,
        phone_res: formData.phone_res,
        mobile1: formData.mobile1,
        mobile2: formData.mobile2,
        area: formData.area,
        opening_balance: parseFloat(formData.opening_balance) || 0,
      })

      setSuccess('Customer saved successfully!')
      // Reset form
      setFormData({
        name: '',
        print_name: '',
        contact_person: '',
        address1: '',
        address2: '',
        address3: '',
        address4: '',
        gst_number: '',
        phone_off: '',
        phone_res: '',
        mobile1: '',
        mobile2: '',
        area: '',
        opening_balance: '',
      })
    } catch (error) {
      if (error.response?.status === 400) {
        setError('Customer name already exists!')
      } else {
        setError('Error saving customer. Please try again.')
      }
      console.error('Error saving customer:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setFormData({
      name: '',
      print_name: '',
      contact_person: '',
      address: '',
      phone_res: '',
      phone_off: '',
      mobile: '',
      email: '',
      web: '',
      tin_no: '',
      cst_no: '',
      area: '',
      transport: '',
      limit_days: '',
      limit_amount: '',
      opening_balance: '',
      dr_cr: 'Dr',
      status: 'Active',
    })
    setError('')
    setSuccess('')
  }

  return (
    <div>
      
      
      <div className="screen-title">Customer Creation</div>
      {/* Form Area */}
      <div className="form-wrapper">
        <form className="entry-form" onSubmit={handleSubmit}>

          <div className="row">
            <label>Name</label>
            <input type="text" name="name" value={formData.name} onChange={handleInputChange} />
          </div>

          <div className="row">
            <label>(Print Name)</label>
            <input type="text" name="print_name" value={formData.print_name} onChange={handleInputChange} />
          </div>

          <div className="row">
            <label>Contact Person</label>
            <input type="text" name="contact_person" value={formData.contact_person} onChange={handleInputChange} />
          </div>

          <div className="row">
            <label>Address</label>
            <textarea rows="3" name="address1" value={formData.address1} onChange={handleInputChange}></textarea>
          </div>

          <div className="row">
            <label>Phone (Res)</label>
            <input type="text" name="phone_res" value={formData.phone_res} onChange={handleInputChange} />
          </div>

          <div className="row">
            <label>Phone (Off)</label>
            <input type="text" name="phone_off" value={formData.phone_off} onChange={handleInputChange} />
          </div>

          <div className="row">
            <label>Mobile</label>
            <input type="text" name="mobile1" value={formData.mobile1} onChange={handleInputChange} />
          </div>

          <div className="row">
            <label>Email ID</label>
            <input type="text" name="gst_number" value={formData.gst_number} onChange={handleInputChange} />
          </div>

          <div className="row">
            <label>Web</label>
            <input type="text" />
          </div>

          <div className="row">
            <label>TIN No</label>
            <input type="text" />
          </div>

          <div className="row">
            <label>CST No</label>
            <input type="text" />
          </div>

          <div className="row">
            <label>Area</label>
            <input type="text" name="area" value={formData.area} onChange={handleInputChange} />
          </div>

          <div className="row">
            <label>Transport</label>
            <input type="text" />
          </div>

          <div className="row">
            <label>Limit Days</label>
            <input type="number" />
          </div>

          <div className="row">
            <label>Limit Amount</label>
            <input type="text" />
          </div>

          <div className="row">
            <label>Opening Balance</label>
            <input type="text" name="opening_balance" value={formData.opening_balance} onChange={handleInputChange} />
            <select className="drcr">
              <option>Dr</option>
              <option>Cr</option>
            </select>
          </div>

          <div className="row">
            <label>Status</label>
            <select>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </div>

          <div className="actions">
            <button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
          </div>

        </form>
      </div>
    </div>
  )
}

export default CustomerCreationPage
