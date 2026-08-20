import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import MasterTableLayout from './master/MasterTableLayout'
import api from '../services/api.js';
import { printHtml } from '../utils/printHelper';


const CompanyDisplay = () => {
  const [companies, setCompanies] = useState([])
  const hasFetched = useRef(false);
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    loadCompanies()
  }, [])

  const loadCompanies = async () => {
    setLoading(true)
    try {
      const result = await api.get('/companies')
      setCompanies(result || [])
    } catch (error) {
      console.error('Error loading companies:', error)
      setCompanies([])
    } finally {
      setLoading(false)
    }
  }


  const handleDelete = async (company) => {
    try {
      await api.delete(`/companies/${company.id}`)
      loadCompanies()
    } catch (error) {
      console.error('Error deleting company:', error)
      throw error
    }
  }


  const handleOpen = (company) => {
    // Navigate to auth choice page with the selected company
    navigate('/auth-choice', { state: { company } })
  }

  const handleUpdate = (company) => {
    navigate(`/company-alter/${company.id}`)
  }

  const handlePrint = (company) => {
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Company Details</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><label style="font-weight: bold;">Company Name:</label></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${company.name || ''}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><label style="font-weight: bold;">Address:</label></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${company.address || ''}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><label style="font-weight: bold;">GST Number:</label></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${company.gst_number || ''}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><label style="font-weight: bold;">Contact:</label></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${company.contact || ''}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><label style="font-weight: bold;">Email:</label></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${company.email || ''}</td></tr>
        </table>
      </div>
    `;
    printHtml(html, `Company Details - ${company.name}`);
  }

  const columns = [
    { key: 'sno', title: 'S.No', width: '60px', render: (_, __, index) => index + 1 },
    { key: 'name', title: 'Company Name' },
    { key: 'address', title: 'Address' },
    { key: 'gst_number', title: 'GST Number' },
    { key: 'contact', title: 'Contact' },
    { key: 'email', title: 'Email' },
  ]

  return (
    <MasterTableLayout
      title="Companies"
      columns={columns}
      data={companies}
      onOpen={handleOpen}
      onEdit={handleUpdate}
      onDelete={handleDelete}
      onPrint={handlePrint}
      onCreate={() => navigate('/company-create')}
      showActions={true}
    />
  )
}

export default CompanyDisplay
