import React, { useState, useEffect } from 'react';
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
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  const searchParams = new URLSearchParams(window.location.search);
  const editId = searchParams.get('id');

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
              papadBalance: String(res.papad_balance || res.papadBalance || '0.00'),
              paymentBalance: String(res.payment_balance || res.paymentBalance || '0.00'),
              type: res.type || 'Less',
              papadLess: String(res.papad_less || res.papadLess || ''),
              paymentLess: String(res.payment_less || res.paymentLess || ''),
              remarks: res.remarks || ''
            });
          }
        } else {
          const res = await api('/papad-returns/next-sno');
          if (res && res.next_s_no) {
            setFormData(prev => ({ ...prev, sNo: res.next_s_no }));
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
        body: formData
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

  const topFields = [
    { name: 'sNo', label: 'S.No.', type: 'text', readOnly: true, col: 1 },
    { name: 'date', label: 'Date', type: 'date', col: 1 },
    { name: 'papadCompany', label: 'Papad Company', type: 'masterSelect', masterType: 'papad_companies', col: 1 },
    { name: 'papadBalance', label: 'Papad Balance', type: 'number', readOnly: true, col: 2 },
    { name: 'paymentBalance', label: 'Payment Balance', type: 'number', readOnly: true, col: 2 },
    { name: 'type', label: 'Type', type: 'select', options: [{ value: 'Less', label: 'Less' }, { value: 'Add', label: 'Add' }], col: 2 },
    { name: 'papadLess', label: 'Papad Less', type: 'number', col: 3 },
    { name: 'paymentLess', label: 'Payment Less', type: 'number', col: 3 },
    { name: 'remarks', label: 'Remarks', type: 'text', col: 3 }
  ];

  return (
    <div className="window">
      <div className="screen-title">Papad Return Creation</div>

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
            saving={loading}
            saveText="Save"
          />
        </div>
      </form>
    </div>
  );
};

export default PapadReturnCreate;
