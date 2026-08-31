import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import api from '../utils/api'
// safeArray not needed anymore

// Import modular master components
import { MasterFormLayout, MasterFieldGroup, MasterActions } from './master'

const PTransUpdate = () => {
  const navigate = useNavigate()
  const location = useLocation()
  
  // Get ID from URL query parameter
  const searchParams = new URLSearchParams(location.search)
  const ptransId = searchParams.get('id')

  const [formData, setFormData] = useState({
    name: '',
    print_name: '',
    status: 'Active'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (ptransId) {
      loadPTransData(ptransId)
    }
  }, [ptransId])

  const loadPTransData = async (id) => {
    try {
      const result = await api.getMasters('ptrans')
      
      // Use safeArray utility for safe data handling
      const ptransList = safeArray(result);
      
      const ptrans = ptransList.find(p => p.id == id)
      if (ptrans) {
        setFormData({
          name: ptrans.name || '',
          print_name: ptrans.print_name || '',
          status: ptrans.status || 'Active'
        })
      }
    } catch (err) {
      setError('Failed to load PTrans data')
      console.error('Error loading PTrans:', err)
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
      setError('PTrans name is required')
      setLoading(false)
      return
    }

    try {
      const result = await api.updateMaster('ptrans_master', parseInt(ptransId), formData)

      if (result.success) {
        setSuccess('PTrans updated successfully')
        setTimeout(() => {
          navigate('/ptrans-display')
        }, 1500)
      } else {
        setError(result.message || 'Error updating PTrans')
      }
    } catch (err) {
      setError(err.message || 'Error updating PTrans')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    navigate('/ptrans-display')
  }

  return (
    <MasterFormLayout moduleName="PTrans">
      {error && <div className="message error">{error}</div>}
      {success && <div className="message success">{success}</div>}

      <MasterFieldGroup
        label="PTrans"
        name="name"
        value={formData.name}
        onChange={handleChange}
        required
      />
      <MasterFieldGroup
        label="Print Name"
        name="print_name"
        value={formData.print_name}
        onChange={handleChange}
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

export default PTransUpdate
