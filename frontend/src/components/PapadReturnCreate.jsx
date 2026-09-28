import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { EntryTopFrame, EntryActions } from './entry';

const PapadReturnCreate = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    sNo: '',
    date: new Date().toISOString().slice(0, 10),
    papadCompany: '',
    papadBalance: '0.00',
    paymentBalance: '0.00',
    type: 'Less',
    papadLess: '',
    paymentLess: '',
    remarks: ''
  });

  const [loading, setLoading] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  const searchParams = new URLSearchParams(window.location.search);
  const editId = searchParams.get('id');

  // Fetch balances for selected Papad Company
  const fetchCompanyBalances = useCallback(async (companyName) => {
    if (!companyName || !companyName.trim()) {
      setFormData(prev => ({
        ...prev,
        papadBalance: '0.00',
        paymentBalance: '0.00'
      }));
      return;
    }

    setBalanceLoading(true);
    try {
      const res = await api(`/papad-returns/balance?company=${encodeURIComponent(companyName.trim())}`);
      if (res && res.success) {
        setFormData(prev => ({
          ...prev,
          papadBalance: String(res.papad_balance !== undefined ? res.papad_balance : (res.papadBalance ?? '0.00')),
          paymentBalance: String(res.payment_balance !== undefined ? res.payment_balance : (res.paymentBalance ?? '0.00'))
        }));
      }
    } catch (err) {
      console.warn('Could not load company balances:', err);
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  // Initialize form
  useEffect(() => {
    const init = async () => {
      try {
        if (editId) {
          const res = await api(`/papad-returns/${editId}`);
          if (res) {
            setFormData({
              sNo: String(res.s_no || res.sNo || editId),
              date: res.date ? res.date.substring(0, 10) : new Date().toISOString().slice(0, 10),
              papadCompany: String(res.papad_company || res.papadCompany || ''),
              papadBalance: String(res.papad_balance !== undefined ? res.papad_balance : (res.papadBalance ?? '0.00')),
              paymentBalance: String(res.payment_balance !== undefined ? res.payment_balance : (res.paymentBalance ?? '0.00')),
              type: res.type || 'Less',
              papadLess: String(res.papad_less !== undefined ? res.papad_less : (res.papadLess ?? '')),
              paymentLess: String(res.payment_less !== undefined ? res.payment_less : (res.paymentLess ?? '')),
              remarks: res.remarks || ''
            });
          }
        } else {
          try {
            const res = await api('/papad-returns/next-sno');
            const sno = res?.next_s_no ?? res?.next_sno ?? res?.s_no ?? res?.sNo ?? res?.data?.s_no;
            if (sno) {
              setFormData(prev => ({ ...prev, sNo: String(sno) }));
            } else {
              const fallback = await api.getNextSNo('/papad-returns');
              setFormData(prev => ({ ...prev, sNo: String(fallback) }));
            }
          } catch (e) {
            const fallback = await api.getNextSNo('/papad-returns');
            setFormData(prev => ({ ...prev, sNo: String(fallback) }));
          }
        }
      } catch (err) {
        console.error('Error initializing papad return form:', err);
      }
    };
    init();
  }, [editId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // When papad company changes and not currently in edit load, auto-fetch balances
    if (name === 'papadCompany' && !editId) {
      fetchCompanyBalances(value);
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (!formData.papadCompany) {
        setMessage('Papad Company is required');
        setMessageType('error');
        setLoading(false);
        return;
      }

      const endpoint = editId ? `/papad-returns/${editId}` : '/papad-returns';
      const method = editId ? 'PUT' : 'POST';

      const res = await api(endpoint, {
        method,
        body: {
          formData: {
            ...formData,
            s_no: formData.sNo,
            papad_company: formData.papadCompany,
            papad_balance: parseFloat(formData.papadBalance) || 0,
            payment_balance: parseFloat(formData.paymentBalance) || 0,
            papad_less: parseFloat(formData.papadLess) || 0,
            payment_less: parseFloat(formData.paymentLess) || 0
          }
        }
      });

      if (res && (res.success || res.id || res.message)) {
        setMessage(editId ? 'Papad Return updated successfully!' : 'Papad Return saved successfully!');
        setMessageType('success');
        setTimeout(() => {
          navigate('/entry/papad-return-display');
        }, 1200);
      } else {
        setMessage(res?.message || 'Error saving Papad Return');
        setMessageType('error');
      }
    } catch (err) {
      console.error(err);
      setMessage('Error saving Papad Return: ' + err.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  // Input fields configuration - papadBalance & paymentBalance are full input fields!
  const topFields = [
    { name: 'sNo', label: 'S.No.', type: 'text', readOnly: true, col: 1 },
    { name: 'date', label: 'Date', type: 'date', col: 1 },
    { name: 'papadCompany', label: 'Papad Company', type: 'masterSelect', masterType: 'papad_companies', col: 1 },
    { name: 'papadBalance', label: balanceLoading ? 'Papad Bal (Loading...)' : 'Papad Balance (Kg)', type: 'number', col: 2, placeholder: '0.00' },
    { name: 'paymentBalance', label: balanceLoading ? 'Payment Bal (Loading...)' : 'Payment Balance (₹)', type: 'number', col: 2, placeholder: '0.00' },
    { name: 'type', label: 'Type', type: 'select', options: [{ value: 'Less', label: 'Less' }, { value: 'Add', label: 'Add' }], col: 2 },
    { name: 'papadLess', label: 'Papad Less (Kg)', type: 'number', col: 3, placeholder: '0.00' },
    { name: 'paymentLess', label: 'Payment Less (₹)', type: 'number', col: 3, placeholder: '0.00' },
    { name: 'remarks', label: 'Remarks', type: 'text', col: 3, placeholder: 'Remarks...' }
  ];

  return (
    <div className="window papad-return-window">
      <div className="screen-title">{editId ? 'Papad Return Update' : 'Papad Return Creation'}</div>
      {message && <div className={`message ${messageType}`}>{message}</div>}

      <form onSubmit={handleSave}>
        <EntryTopFrame 
          fields={topFields} 
          data={formData} 
          onChange={handleChange}
        />

        <div style={{ marginTop: '20px' }}>
          <EntryActions 
            onSave={handleSave}
            onCancel={() => navigate('/entry/papad-return-display')}
            saving={loading}
            saveText={editId ? 'Update' : 'Save'}
          />
        </div>
      </form>
    </div>
  );
};

export default PapadReturnCreate;
