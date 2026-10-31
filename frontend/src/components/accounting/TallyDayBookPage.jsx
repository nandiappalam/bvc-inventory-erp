import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import PurchaseLedgerDetailsModal from '../purchase/PurchaseLedgerDetailsModal';

const TallyDayBookPage = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [dayBookData, setDayBookData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [activeVoucherId, setActiveVoucherId] = useState(null);
  const [voucherModalOpen, setVoucherModalOpen] = useState(false);

  useEffect(() => {
    fetchDayBook();
  }, [selectedDate]);

  const fetchDayBook = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api(`/accounting/day-book?date=${selectedDate}`);
      const list = res?.data || res || [];
      setDayBookData(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Error fetching Day Book:', err);
      setError('Failed to load Day Book entries.');
    } finally {
      setLoading(false);
    }
  };

  const totalDr = dayBookData.reduce((sum, r) => sum + Number(r.debit || 0), 0);
  const totalCr = dayBookData.reduce((sum, r) => sum + Number(r.credit || 0), 0);

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Header Banner */}
      <div style={{ background: 'linear-gradient(135deg, #065f46 0%, #064e3b 50%, #0f172a 100%)', color: '#ffffff', padding: '18px 24px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
            📖
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#ffffff' }}>Accounting Day Book (Journal Register)</h1>
            <p style={{ fontSize: '12px', color: '#a7f3d0', margin: '3px 0 0 0', fontWeight: '500' }}>
              Daily Voucher Transactions · Chronological Journal Postings · Real-Time Debit & Credit Auditing
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '12px', fontWeight: '700', color: '#a7f3d0' }}>Select Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ height: '36px', padding: '6px 12px', borderRadius: '6px', border: '1px solid #34d399', fontSize: '13px', fontWeight: 'bold', color: '#064e3b', backgroundColor: '#ffffff' }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid #047857', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <p style={{ marginTop: '12px', fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Loading Day Book transactions for {selectedDate}...</p>
        </div>
      ) : error ? (
        <div style={{ padding: '16px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: '8px', fontSize: '12px', fontWeight: '600' }}>
          ⚠️ {error}
        </div>
      ) : (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #cbd5e1', boxShadow: '0 2px 6px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
              Transactions Posted on {selectedDate}
            </h3>
            <span style={{ fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '12px', backgroundColor: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' }}>
              {dayBookData.length} Voucher Entries
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', color: '#334155', borderBottom: '1px solid #cbd5e1', fontWeight: '800', textTransform: 'uppercase', fontSize: '11px' }}>
                  <th style={{ padding: '10px 12px', width: '50px', textAlign: 'center' }}>S.No</th>
                  <th style={{ padding: '10px 12px', width: '120px' }}>Voucher No</th>
                  <th style={{ padding: '10px 12px', width: '110px' }}>Voucher Type</th>
                  <th style={{ padding: '10px 12px' }}>Ledger Account / Particulars</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', width: '130px' }}>Debit Amount (Dr)</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', width: '130px' }}>Credit Amount (Cr)</th>
                  <th style={{ padding: '10px 12px', width: '90px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {dayBookData.length > 0 ? (
                  dayBookData.map((row, idx) => (
                    <tr 
                      key={idx}
                      style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}
                    >
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>{idx + 1}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <button
                          onClick={() => {
                            setActiveVoucherId(row.voucher_id || row.voucher_no);
                            setVoucherModalOpen(true);
                          }}
                          style={{ background: 'none', border: 'none', color: '#1d4ed8', fontWeight: '700', fontFamily: 'monospace', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                        >
                          {row.voucher_no || `VOC-${row.id}`}
                        </button>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#eff6ff', color: '#1e40af', fontWeight: '700', border: '1px solid #bfdbfe' }}>
                          {row.voucher_type || 'Journal'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#0f172a', fontWeight: '600' }}>
                        {row.particulars || row.ledger_name}
                        {row.narration && <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'normal', marginTop: '2px' }}>Narration: {row.narration}</span>}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#047857' }}>
                        {Number(row.debit) > 0 ? `₹${Number(row.debit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#b45309' }}>
                        {Number(row.credit) > 0 ? `₹${Number(row.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <button
                          onClick={() => {
                            setActiveVoucherId(row.voucher_id || row.voucher_no);
                            setVoucherModalOpen(true);
                          }}
                          style={{ padding: '4px 8px', backgroundColor: '#e2e8f0', color: '#1e293b', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                      No voucher transactions recorded on {selectedDate}. Select another date above.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: '800' }}>
                  <td colSpan={4} style={{ padding: '12px', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Day Book Total (Balanced):
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', color: '#34d399', fontSize: '13px' }}>
                    ₹{totalDr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', color: '#fcd34d', fontSize: '13px' }}>
                    ₹{totalCr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '12px' }}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Voucher Detail Modal */}
      {voucherModalOpen && (
        <PurchaseLedgerDetailsModal
          isOpen={voucherModalOpen}
          onClose={() => setVoucherModalOpen(false)}
          purchaseId={activeVoucherId}
        />
      )}
    </div>
  );
};

export default TallyDayBookPage;
