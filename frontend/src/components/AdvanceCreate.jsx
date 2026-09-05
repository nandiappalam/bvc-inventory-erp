import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdvanceCreate.css';
import api from "../services/api.js";
import { EntryTopFrame, EntryActions } from './entry';

const AdvanceCreate = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    s_no: '',
    date: new Date().toISOString().split('T')[0],
    papad_company: '',
    amount: '',
    dr_cr: 'Dr',
    pay_mode: 'Cash',
    remarks: '',
    address: ''
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  const searchParams = new URLSearchParams(window.location.search);
  const editId = searchParams.get('id');

  // Fetch next sequential S.No on load or fetch existing data if editId is provided
  useEffect(() => {
    const initData = async () => {
      try {
        if (editId) {
          const res = await api(`/advances/${editId}`);
          if (res) {
            const companyVal = String(res.papad_company || res.papad_company_name || '');
            setFormData({
              s_no: String(res.s_no || res.sNo || ''),
              date: res.date ? res.date.substring(0, 10) : new Date().toISOString().split('T')[0],
              papad_company: companyVal,
              amount: String(res.amount || ''),
              dr_cr: res.dr_cr || 'Dr',
              pay_mode: res.pay_mode || 'Cash',
              remarks: res.remarks || '',
              address: res.address || ''
            });

            if (companyVal) {
              try {
                const compRecord = await api(`/masters/record/papad_company_master/${companyVal}`).catch(() => null);
                if (compRecord) {
                  const name = compRecord.name || '';
                  const contactPerson = compRecord.contact_person || '';
                  const addressLine = [compRecord.address, compRecord.address1, compRecord.address2].filter(Boolean).join(', ');
                  const phone = compRecord.mobile || compRecord.phone_off || '';
                  setFormData(prev => ({
                    ...prev,
                    papad_company: String(compRecord.id || companyVal),
                    address: prev.address || `Name : ${name}\nContact Person : ${contactPerson}\nAddress : ${addressLine}\nPhone : ${phone}`
                  }));
                }
              } catch (e) {
                console.error('Error fetching company details:', e);
              }
            }
          }
        } else {
          const result = await api('/advances/next-sno');
          if (result && result.success) {
            setFormData(prev => ({ ...prev, s_no: String(result.next_s_no) }));
          }
        }
      } catch (err) {
        console.error('Failed to init advance data:', err);
      }
    };
    initData();
  }, [editId]);

  const handleFormChange = (nameOrEvent, maybeValue) => {
    if (nameOrEvent && nameOrEvent.target) {
      const { name, value } = nameOrEvent.target;
      setFormData(prev => ({ ...prev, [name]: value }));
    } else {
      setFormData(prev => ({ ...prev, [nameOrEvent]: maybeValue }));
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const postData = {
        s_no: formData.s_no,
        date: formData.date,
        papad_company: formData.papad_company,
        amount: formData.amount,
        dr_cr: formData.dr_cr,
        pay_mode: formData.pay_mode,
        remarks: formData.remarks
      };
      
      const endpoint = editId ? `/advances/${editId}` : '/advances';
      const method = editId ? 'PUT' : 'POST';
      const result = await api(endpoint, { method, body: postData });
      
      if (result && (result.success || result.message)) {
        setMessage(editId ? 'Advance updated successfully!' : 'Advance saved successfully!');
        setMessageType('success');
        
        setTimeout(() => {
          setMessage('');
          navigate('/entry/advance-display');
        }, 1500);
      } else {
        setMessage(result?.message || 'Error saving advance');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error saving advance:', error);
      setMessage('Error: ' + error.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const topFrameFields = [
    { name: 's_no', label: 'S.No', type: 'text', readOnly: true, value: formData.s_no, col: 1 },
    { name: 'date', label: 'Date', type: 'date', value: formData.date, col: 1 },
    { name: 'amount', label: 'Amount', type: 'text', value: formData.amount, col: 1 },
    { name: 'dr_cr', label: 'Dr/Cr', type: 'select', options: [
      { value: 'Dr', label: 'Dr' },
      { value: 'Cr', label: 'Cr' }
    ], value: formData.dr_cr, col: 2 },
    { name: 'pay_mode', label: 'Pay Mode', type: 'select', options: [
      { value: 'Cash', label: 'Cash' },
      { value: 'Bank/NEFT', label: 'Bank/NEFT' },
      { value: 'Cheque', label: 'Cheque' },
      { value: 'UPI', label: 'UPI' }
    ], value: formData.pay_mode, col: 2 },
    { name: 'remarks', label: 'Remarks', type: 'text', value: formData.remarks, col: 2 },
    { name: 'papad_company', label: 'Papad Company', type: 'masterSelect', masterType: 'papad_companies', value: formData.papad_company, col: 3 },
    { name: 'address', label: 'Address', type: 'textarea', readOnly: true, value: formData.address, col: 3 }
  ];

  return (
    <div className="window">
      <div className="screen-title">Advance Creation</div>

      {message && <div className={`message ${messageType}`}>{message}</div>}

      <form onSubmit={handleSubmit}>
        <EntryTopFrame 
          fields={topFrameFields} 
          data={formData} 
          onChange={handleFormChange}
        />

        <EntryActions 
          onSave={handleSubmit}
          saving={loading}
          saveText="Save"
        />
      </form>
    </div>
  );
};

export default AdvanceCreate;
