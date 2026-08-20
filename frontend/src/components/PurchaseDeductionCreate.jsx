import React, { useState } from 'react'
import axios from 'axios'

const PurchaseDeductionCreate = () => {
  const [formData, setFormData] = useState({
    deduction_name: '',
    print_name: '',
    affect_cost: 'Yes',
    debit_adjust: 'A/c Head',
    account_head: '',
    credit_adjust: 'Supplier',
    deduction_type: 'Add',
    calc_type: 'Amount',
    deduction_value: '',
    status: 'Active',
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
    if (!formData.deduction_name.trim()) {
      setError('Deduction Name is required!')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await axios.post('/api/masters/purchase_deduction_master', {
        deduction_name: formData.deduction_name,
        print_name: formData.print_name,
        affect_cost: formData.affect_cost,
        debit_adjust: formData.debit_adjust,
        account_head: formData.account_head,
        credit_adjust: formData.credit_adjust,
        deduction_type: formData.deduction_type,
        calc_type: formData.calc_type,
        deduction_value: parseFloat(formData.deduction_value) || 0,
        status: formData.status,
      })

      setSuccess('Purchase Deduction saved successfully!')
      // Reset form
      setFormData({
        deduction_name: '',
        print_name: '',
        affect_cost: 'Yes',
        debit_adjust: 'A/c Head',
        account_head: '',
        credit_adjust: 'Supplier',
        deduction_type: 'Add',
        calc_type: 'Amount',
        deduction_value: '',
        status: 'Active',
      })
    } catch (error) {
      if (error.response?.status === 400) {
        setError('Deduction name already exists!')
      } else {
        setError('Error saving purchase deduction. Please try again.')
      }
      console.error('Error saving purchase deduction:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      
      
      <div className="screen-title">Purchase Deduction Creation</div>
      {/* Center Form */}
      <div className="form-wrapper">
        <div className="form-box">

          <div className="row">
            <label>Deduction Name<br /><small>(Print Name)</small></label>
            <input type="text" name="deduction_name" value={formData.deduction_name} onChange={handleInputChange} />
          </div>

          <div className="row">
            <label>Affect the Cost of Goods</label>
            <select name="affect_cost" value={formData.affect_cost} onChange={handleInputChange}>
              <option>Yes</option>
              <option>No</option>
            </select>
          </div>

          <div className="row">
            <label>Debit Side Adjust with</label>
            <select name="debit_adjust" value={formData.debit_adjust} onChange={handleInputChange}>
              <option>A/c Head</option>
            </select>
          </div>

          <div className="row">
            <label>Account Head</label>
            <input type="text" name="account_head" value={formData.account_head} onChange={handleInputChange} />
          </div>

          <div className="row">
            <label>Credit Side Adjust with</label>
            <select name="credit_adjust" value={formData.credit_adjust} onChange={handleInputChange}>
              <option>Supplier</option>
            </select>
          </div>

          <div className="row">
            <label>Deduction Type</label>
            <select name="deduction_type" value={formData.deduction_type} onChange={handleInputChange}>
              <option>Add</option>
              <option>Subtract</option>
            </select>
          </div>

          <div className="row">
            <label>Deduction Calc Type</label>
            <select name="calc_type" value={formData.calc_type} onChange={handleInputChange}>
              <option>Amount</option>
              <option>Percent</option>
            </select>
          </div>

          <div className="row">
            <label>Deduction Value</label>
            <input type="text" name="deduction_value" value={formData.deduction_value} onChange={handleInputChange} />
          </div>

          <div className="row">
            <label>Status</label>
            <select name="status" value={formData.status} onChange={handleInputChange}>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </div>

          <div className="btn-row">
            <button type="submit" onClick={handleSubmit} disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PurchaseDeductionCreate;
