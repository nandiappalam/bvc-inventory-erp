import React, { useState } from 'react'
import axios from 'axios'
import './SalesDeductionCreate.css'

const SalesDeductionCreate = () => {
  const [formData, setFormData] = useState({
    ded_name: '',
    print_name: '',
    adjust_with_sales: 'No',
    account_head: '',
    ded_type: 'Add',
    calc_type: 'Amount',
    ded_value: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (!formData.ded_name.trim()) {
      setError('Deduction name is required')
      setLoading(false)
      return
    }

    try {
      const response = await axios.post('/api/masters/deduction_sales', formData)

      if (response.status === 201) {
        setSuccess('Sales Deduction created successfully')
        // Clear form
        setFormData({
          ded_name: '',
          print_name: '',
          adjust_with_sales: 'No',
          account_head: '',
          ded_type: 'Add',
          calc_type: 'Amount',
          ded_value: ''
        })
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error creating Sales Deduction')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        Sales Deduction Creation
      </div>

      {/* Main Area */}
      <div className="content">
        <div className="form-box">
          {error && <div className="alert error">{error}</div>}
          {success && <div className="alert success">{success}</div>}

          <form onSubmit={handleSubmit}>
            <table>
              <tbody>
                <tr>
                  <td>Deduction Name<br></br><span>(Print Name)</span></td>
                  <td>
                    <input
                      type="text"
                      name="ded_name"
                      value={formData.ded_name}
                      onChange={handleInputChange}
                      required
                    />
                  </td>
                </tr>

                <tr>
                  <td>Print Name</td>
                  <td>
                    <input
                      type="text"
                      name="print_name"
                      value={formData.print_name}
                      onChange={handleInputChange}
                    />
                  </td>
                </tr>

                <tr>
                  <td>Adjust with Sales Amount</td>
                  <td>
                    <select
                      name="adjust_with_sales"
                      value={formData.adjust_with_sales}
                      onChange={handleInputChange}
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </td>
                </tr>

                <tr>
                  <td>Account Head</td>
                  <td>
                    <input
                      type="text"
                      name="account_head"
                      value={formData.account_head}
                      onChange={handleInputChange}
                    />
                  </td>
                </tr>

                <tr>
                  <td>Deduction Type</td>
                  <td>
                    <select
                      name="ded_type"
                      value={formData.ded_type}
                      onChange={handleInputChange}
                    >
                      <option value="Add">Add</option>
                      <option value="Less">Less</option>
                    </select>
                  </td>
                </tr>

                <tr>
                  <td>Deduction Calc Type</td>
                  <td>
                    <select
                      name="calc_type"
                      value={formData.calc_type}
                      onChange={handleInputChange}
                    >
                      <option value="Amount">Amount</option>
                      <option value="Percentage">Percentage</option>
                    </select>
                  </td>
                </tr>

                <tr>
                  <td>Deduction Value</td>
                  <td>
                    <input
                      type="text"
                      name="ded_value"
                      value={formData.ded_value}
                      onChange={handleInputChange}
                    />
                  </td>
                </tr>

                <tr>
                  <td>Status</td>
                  <td>
                    <select name="status" defaultValue="Active">
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </td>
                </tr>
              </tbody>
            </table>
          </form>
        </div>

        <div className="save-btn">
          <button type="submit" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SalesDeductionCreate
