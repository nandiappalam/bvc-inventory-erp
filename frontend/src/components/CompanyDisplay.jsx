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
      const result = await api.delete(`/companies/${company.id}`);
      if (result && result.success === false) {
        throw new Error(result.message || 'Failed to delete company');
      }
      await loadCompanies();
    } catch (error) {
      console.error('Error deleting company:', error);
      throw error;
    }
  };


  const handleOpen = (company) => {
    // Navigate to auth choice page with the selected company
    navigate('/auth-choice', { state: { company } })
  }

  const handleUpdate = (company) => {
    navigate(`/company-alter/${company.id}`)
  }

  const handlePrint = (company) => {
    const name = company.name || company.company_name || `Company ${company.id}`;
    const address = company.address || company.address1 || company.location || company.city || '-';
    const gst = company.gst_number || company.gst_no || company.gstin || '-';
    const contact = company.contact || company.phone || company.mobile || company.phone_off || '-';
    const email = company.email || company.email_id || '-';

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Company Details</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><label style="font-weight: bold;">Company Name:</label></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${name}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><label style="font-weight: bold;">Address:</label></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${address}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><label style="font-weight: bold;">GST Number:</label></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${gst}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><label style="font-weight: bold;">Contact:</label></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${contact}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><label style="font-weight: bold;">Email:</label></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${email}</td></tr>
        </table>
      </div>
    `;
    printHtml(html, `Company Details - ${name}`);
  }

  const columns = [
    { key: 'sno', title: 'S.No', width: '60px', render: (_, __, index) => index + 1 },
    { key: 'name', title: 'Company Name', render: (val, row) => val || row?.company_name || `Company ${row?.id}` },
    { key: 'address', title: 'Address', render: (val, row) => val || row?.address1 || row?.location || row?.city || '-' },
    { key: 'gst_number', title: 'GST Number', render: (val, row) => val || row?.gst_no || row?.gstin || '-' },
    { key: 'contact', title: 'Contact', render: (val, row) => val || row?.phone || row?.mobile || row?.phone_off || '-' },
    { key: 'email', title: 'Email', render: (val, row) => val || row?.email_id || '-' },
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
      onRefresh={loadCompanies}
      onCreate={() => navigate('/company-create')}
      showActions={true}
    />
  )
}

export default CompanyDisplay
