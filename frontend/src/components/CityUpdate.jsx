import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import api from '../utils/api'
// safeArray not needed anymore

// Import modular master components
import { MasterFormLayout, MasterFieldGroup, MasterActions } from './master'

const CityUpdate = () => {
  const navigate = useNavigate()
  const location = useLocation()
  
  // Get ID from URL query parameter
  const searchParams = new URLSearchParams(location.search)
  const cityId = searchParams.get('id')

  const [formData, setFormData] = useState({
    name: '',
    print_name: '',
    status: 'Active'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (cityId) {
      loadCityData(cityId)
    }
  }, [cityId])

  const loadCityData = async (id) => {
    try {
      const result = await api.getCities()
      
      // Use safeArray utility for safe data handling
      const cities = Array.isArray(result) ? result : [];
      
      const city = cities.find(c => c.id == id)
      if (city) {
        setFormData({
          name: city.name || '',
          print_name: city.print_name || '',
          status: city.status || 'Active'
        })
      }
    } catch (err) {
      setError('Failed to load city data')
      console.error('Error loading city:', err)
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
      setError('City name is required')
      setLoading(false)
      return
    }

    try {
      const result = await api.updateMaster('city_master', parseInt(cityId), formData)

      if (result.success) {
        setSuccess('City updated successfully')
        setTimeout(() => {
          navigate('/city-display')
        }, 1500)
      } else {
        setError(result.message || 'Error updating city')
      }
    } catch (err) {
      setError(err.message || 'Error updating city')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    navigate('/city-display')
  }

  return (
    <MasterFormLayout moduleName="City">
      {error && <div className="message error">{error}</div>}
      {success && <div className="message success">{success}</div>}

      <MasterFieldGroup
        label="City"
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

export default CityUpdate
