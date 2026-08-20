import React, { useState, useEffect } from 'react'
import api from '../utils/api.js'
import { MASTER_CONFIG } from '../utils/masterConfig.js'
import { safeArray } from '../utils/safeArray.js'
import { FormSection } from './master'
import MasterFormLayout from './master/MasterFormLayout'
import SmartField from './master/SmartField'
import './master/master.css'

/**
 * SupplierCreate - Supplier Master Creation Page
 */
const SupplierCreate = () => {
  const config = MASTER_CONFIG.supplier || {}
  const sections = safeArray(config.sections)
  const [formData, setFormData] = useState({})
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name?.trim()) {
      setMessage('Supplier Name is required')
      setMessageType('error')
      return
    }

    setLoading(true)
    setMessage('')
    try {
      const result = await api.createMaster(config.table, formData)
      if (result.success) {
        setMessage('Supplier saved successfully!')
        setMessageType('success')
        // Reset form
        const resetData = {}
        sections.forEach(section => {
          safeArray(section.fields).forEach(field => {
            resetData[field.name] = field.defaultValue || ''
          })
        })
        setFormData(resetData)
        setTimeout(() => setMessage(''), 3000)
      } else {
        setMessage('Error: ' + (result.message || 'Unknown error'))
        setMessageType('error')
      }
    } catch (error) {
      setMessage('Error saving supplier')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    const resetData = {}
    sections.forEach(section => {
      safeArray(section.fields).forEach(field => {
        resetData[field.name] = field.defaultValue || ''
      })
    })
    setFormData(resetData)
    setMessage('')
  }

  useEffect(() => {
    // Generate next supplier code
    api.getMasters(config.table).then((res) => {
      const count = (res.data || []).length
      const nextCode = `SUPP${String(count + 1).padStart(3, '0')}`
      handleChange('supplier_code', nextCode)
    }).catch(err => console.log('Supplier code gen failed', err))

    // Init form with defaults
    const initialData = {}
    sections.forEach(section => {
      safeArray(section.fields).forEach(field => {
        initialData[field.name] = field.defaultValue || ''
      })
    })
    setFormData(initialData)
  }, [])

  return (
    <MasterFormLayout title="Supplier Creation" onSave={handleSubmit} onCancel={handleCancel}>
      {message && <div className={`message ${messageType}`}>{message}</div>}

      {sections.map((section, secIndex) => (
        <FormSection key={secIndex} title={section.title}>
          {safeArray(section.fields).map((field, fieldIndex) => (
            <SmartField 
              key={fieldIndex} 
              field={field} 
              value={formData[field.name]} 
              onChange={handleChange} 
            />
          ))}
        </FormSection>
      ))}
    </MasterFormLayout>
  )
}

export default SupplierCreate
