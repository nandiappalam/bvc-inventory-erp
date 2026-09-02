import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import api from '../utils/api'
// safeArray not needed anymore

// Import modular master components
import { MasterFormLayout, MasterFieldGroup, MasterActions } from './master'

const AreaUpdate = () => {
  const navigate = useNavigate()
  const location = useLocation()
  
  // Get ID from URL query parameter
  const searchParams = new URLSearchParams(location.search)
  const areaId = searchParams.get('id')

  const [formData, setFormData] = useState({
    name: '',
    print_name: '',
    status: 'Active'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (areaId) {
      loadAreaData(areaId)
    }
  }, [areaId])

  const loadAreaData = async (id) => {
    try {
      const result = await api.getAreas()
      
      // Use safeArray utility for safe data handling
      const areas = Array.isArray(result) ? result : [];
      
      const area = areas.find(a => a.id == id)
      if (area) {
        setFormData({
          name: area.name || '',
          print_name: area.print_name || '',
          status: area.status || 'Active'
        })
      }
    } catch (err) {
      setError('Failed to load area data')
      console.error('Error loading area:', err)
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
      setError('Area name is required')
      setLoading(false)
      return
    }

    try {
      const result = await api.updateMaster('area_master', parseInt(areaId), formData)

      if (result.success) {
        setSuccess('Area updated successfully')
        setTimeout(() => {
          navigate('/area-display')
        }, 1500)
      } else {
        setError(result.message || 'Error updating area')
      }
    } catch (err) {
      setError(err.message || 'Error updating area')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    navigate('/area-display')
  }

  return (
    <MasterFormLayout moduleName="Area">
      {error && <div className="message error">{error}</div>}
      {success && <div className="message success">{success}</div>}

      <MasterFieldGroup
        label="Area"
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

export default AreaUpdate
