import React, { useState } from 'react';
import api from '../utils/api';
import { printHtml } from '../utils/printHelper';

const ChequePrinting = () => {
  const [formData, setFormData] = useState({
    bankName: 'HDFC BANK',
    acName: '',
    chqDate: new Date().toISOString().slice(0, 10),
    chqAmount: '',
    acPayee: 'Yes',
    authSign: 'Yes',
    noOfCopies: '1',
    acNo: ''
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const numberToWords = (num) => {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const inWords = (n) => {
      if ((n = n.toString()).length > 9) return 'overflow';
      let n_array = ('000000000' + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
      if (!n_array) return '';
      let str = '';
      str += (n_array[1] != 0) ? (a[Number(n_array[1])] || b[n_array[1][0]] + ' ' + a[n_array[1][1]]) + 'Crore ' : '';
      str += (n_array[2] != 0) ? (a[Number(n_array[2])] || b[n_array[2][0]] + ' ' + a[n_array[2][1]]) + 'Lakh ' : '';
      str += (n_array[3] != 0) ? (a[Number(n_array[3])] || b[n_array[3][0]] + ' ' + a[n_array[3][1]]) + 'Thousand ' : '';
      str += (n_array[4] != 0) ? (a[Number(n_array[4])] || b[n_array[4][0]] + ' ' + a[n_array[4][1]]) + 'Hundred ' : '';
      str += (n_array[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n_array[5])] || b[n_array[5][0]] + ' ' + a[n_array[5][1]]) + 'Only ' : '';
      return str;
    };

    const val = parseFloat(num);
    if (!val || isNaN(val)) return 'Zero Rupees Only';
    return inWords(Math.floor(val));
  };

  const handlePrint = async (e) => {
    if (e) e.preventDefault();
    if (!formData.acName || !formData.chqAmount) {
      setMessage('A/c Name and Chq. Amount are required');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      // Save record
      await api('/cheque-printing', {
        method: 'POST',
        body: formData
      }).catch(err => console.error('Record save error:', err));

      const amountWords = numberToWords(formData.chqAmount);
      const copies = parseInt(formData.noOfCopies) || 1;

      let copiesHtml = '';
      for (let i = 0; i < copies; i++) {
        copiesHtml += `
          <div style="width: 200mm; height: 93mm; border: 2px dashed #333; margin: 20px auto; padding: 15px; position: relative; font-family: 'Courier New', monospace; background: #fff;">
            ${formData.acPayee === 'Yes' ? '<div style="position: absolute; top: 15px; left: 20px; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 2px 10px; font-weight: bold; font-size: 14px;">A/C PAYEE ONLY</div>' : ''}
            
            <div style="position: absolute; top: 15px; right: 25px; font-weight: bold; font-size: 16px; letter-spacing: 4px;">
              ${formData.chqDate}
            </div>

            <div style="position: absolute; top: 80px; left: 80px; font-weight: bold; font-size: 16px;">
              Pay : ${formData.acName}
            </div>

            <div style="position: absolute; top: 120px; left: 80px; width: 450px; font-weight: bold; font-size: 14px; line-height: 1.6;">
              Rupees : ${amountWords}
            </div>

            <div style="position: absolute; top: 120px; right: 25px; font-weight: bold; font-size: 18px; border: 2px solid #000; padding: 5px 15px; background: #f0f0f0;">
              ₹ **${parseFloat(formData.chqAmount).toFixed(2)}/-
            </div>

            ${formData.acNo ? `<div style="position: absolute; top: 170px; left: 80px; font-size: 14px;">A/c No: <b>${formData.acNo}</b></div>` : ''}

            ${formData.authSign === 'Yes' ? '<div style="position: absolute; bottom: 25px; right: 25px; font-weight: bold; font-size: 12px; text-align: center;">Authorized Signatory</div>' : ''}
          </div>
        `;
      }

      printHtml(copiesHtml, `Cheque_${formData.acName}_${formData.chqDate}`);
      setMessage('Cheque sent to print!');
      setMessageType('success');
    } catch (err) {
      console.error(err);
      setMessage('Error printing cheque: ' + err.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="window" style={{ maxWidth: '650px', margin: '30px auto' }}>
      <div className="screen-title">Cheque Printing</div>

      {message && <div className={`message ${messageType}`}>{message}</div>}

      <form onSubmit={handlePrint} style={{ background: '#f5f7fa', padding: '20px', borderRadius: '6px', border: '1px solid #dcdcdc' }}>
        <table style={{ width: '100%', borderSpacing: '12px' }}>
          <tbody>
            <tr>
              <td style={{ fontWeight: 'bold', width: '140px' }}>Bank Name :</td>
              <td>
                <input
                  type="text"
                  name="bankName"
                  value={formData.bankName}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold' }}>A/c Name :</td>
              <td>
                <input
                  type="text"
                  name="acName"
                  value={formData.acName}
                  onChange={handleChange}
                  placeholder="Payee Name"
                  style={{ width: '100%', padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold' }}>Chq. Date :</td>
              <td>
                <input
                  type="date"
                  name="chqDate"
                  value={formData.chqDate}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold' }}>Chq. Amount :</td>
              <td>
                <input
                  type="number"
                  name="chqAmount"
                  value={formData.chqAmount}
                  onChange={handleChange}
                  placeholder="0.00"
                  style={{ width: '100%', padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold' }}>A/c Payee :</td>
              <td>
                <select
                  name="acPayee"
                  value={formData.acPayee}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px' }}
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold' }}>Auth Sign :</td>
              <td>
                <select
                  name="authSign"
                  value={formData.authSign}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px' }}
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold' }}>No. of Copies :</td>
              <td>
                <input
                  type="number"
                  name="noOfCopies"
                  value={formData.noOfCopies}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold' }}>A/c No :</td>
              <td>
                <input
                  type="text"
                  name="acNo"
                  value={formData.acNo}
                  onChange={handleChange}
                  placeholder="Optional A/c No"
                  style={{ width: '100%', padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ textAlign: 'right', marginTop: '20px' }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              background: '#1f4fb2',
              color: '#fff',
              border: 'none',
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: 'bold',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {loading ? 'Processing...' : 'Print'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChequePrinting;
