import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getSuppliers, updateSupplier } from '../utils/api'
import { safeArray } from '../utils/api'

// Import modular master components
import { MasterFormLayout, MasterFieldGroup, MasterActions } from './master'

const SupplierUpdate = () => {
  const navigate = useNavigate()
  const location = useLocation()
  
  // Get ID from URL query parameter
  const searchParams = new URLSearchParams(location.search)
  const supplierId = searchParams.get('id')

  const [formData, setFormData] = useState({
    name: '',
    print_name: '',
    contact_person: '',
    address1: '',
    phone_res: '',
    phone_off: '',
    mobile1: '',
    email: '',
    web: '',
    gst_number: '',
    area: '',
    transport: '',
    limit_days: '',
    limit_amount: '',
    opening_balance: '',
    drcr: 'Dr',
    status: 'Active'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (supplierId) {
      loadSupplierData(supplierId)
    }
  }, [supplierId])

  const loadSupplierData = async (id) => {
    try {
      const result = await getSuppliers()
      
      // Use safeArray utility for safe data handling
      const suppliers = safeArray(result);
      const supplier = suppliers.find(s => s.id == id)
      
      if (supplier) {
        setFormData({
          name: supplier.name || '',
          print_name: supplier.print_name || '',
          contact_person: supplier.contact_person || '',
          address1: supplier.address1 || '',
          phone_res: supplier.phone_res || '',
          phone_off: supplier.phone_off || '',
          mobile1: supplier.mobile1 || '',
          email: supplier.email || '',
          web: supplier.web || '',
          gst_number: supplier.gst_number || '',
          area: supplier.area || '',
          transport: supplier.transport || '',
          limit_days: supplier.limit_days || '',
          limit_amount: supplier.limit_amount || '',
          opening_balance: supplier.opening_balance || '',
          drcr: supplier.drcr || 'Dr',
          status: supplier.status || 'Active'
        })
      }
    } catch (err) {
      setError('Failed to load supplier data')
      console.error('Error loading supplier:', err)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (!formData.name.trim()) {
      setError('Supplier name is required')
      setLoading(false)
      return
    }

    try {
      const result = await updateSupplier(parseInt(supplierId), formData)

      if (result.success) {
        setSuccess('Supplier updated successfully')
        setTimeout(() => {
          navigate('/suppliers-display')
        }, 1500)
      } else {
        setError(result.message || 'Error updating supplier')
      }
    } catch (err) {
      setError(err.message || 'Error updating supplier')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    navigate('/suppliers-display')
  }

  return (
    <MasterFormLayout moduleName="Supplier">
      {error && <div className="message error">{error}</div>}
      {success && <div className="message success">{success}</div>}

      <MasterFieldGroup label="Name" name="name" value={formData.name} onChange={handleChange} required />
      <MasterFieldGroup label="Print Name" name="print_name" value={formData.print_name} onChange={handleChange} />
      <MasterFieldGroup label="Contact Person" name="contact_person" value={formData.contact_person} onChange={handleChange} />
      <MasterFieldGroup label="Address" name="address1" value={formData.address1} onChange={handleChange} />
      <MasterFieldGroup label="Phone (Res)" name="phone_res" value={formData.phone_res} onChange={handleChange} />
      <MasterFieldGroup label="Phone (Off)" name="phone_off" value={formData.phone_off} onChange={handleChange} />
      <MasterFieldGroup label="Mobile" name="mobile1" value={formData.mobile1} onChange={handleChange} />
      <MasterFieldGroup label="Email" name="email" type="email" value={formData.email} onChange={handleChange} />
      <MasterFieldGroup label="Web" name="web" value={formData.web} onChange={handleChange} />
      <MasterFieldGroup label="GST / TIN No" name="gst_number" value={formData.gst_number} onChange={handleChange} />
      <MasterFieldGroup label="Area" name="area" value={formData.area} onChange={handleChange} />
      <MasterFieldGroup label="Transport" name="transport" value={formData.transport} onChange={handleChange} />
      <MasterFieldGroup label="Limit Days" name="limit_days" type="number" value={formData.limit_days} onChange={handleChange} />
      <MasterFieldGroup label="Limit Amount" name="limit_amount" value={formData.limit_amount} onChange={handleChange} />
      <MasterFieldGroup label="Opening Balance" name="opening_balance" value={formData.opening_balance} onChange={handleChange} />
      <MasterFieldGroup 
        label="Dr/Cr" 
        name="drcr" 
        type="select" 
        value={formData.drcr} 
        onChange={handleChange}
        options={[
          { value: 'Dr', label: 'Dr' },
          { value: 'Cr', label: 'Cr' }
        ]}
      />
      <MasterFieldGroup 
        label="Status" 
        name="status" 
        type="select" 
        value={formData.status} 
        onChange={handleChange}
        options={[
          { value: 'Active', label: 'Active' },
          { value: 'Inactive', label: 'Inactive' }
        ]}
      />
      
      <MasterActions
        onSave={handleSubmit}
        onCancel={handleCancel}
        showSave={true}
        saving={loading}
        mode="update"
      />
    </MasterFormLayout>
  )
}

export default SupplierUpdate
