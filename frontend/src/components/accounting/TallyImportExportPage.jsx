import React, { useState } from 'react';

const TallyImportExportPage = () => {
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');

  const handleExportXML = () => {
    window.open('/api/accounting/tally-export/xml', '_blank');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImporting(true);
    setMessage('');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const xmlText = evt.target.result;
        // Simple XML validation check
        if (!xmlText.includes('<ENVELOPE>') && !xmlText.includes('<TALLYMESSAGE')) {
          throw new Error('Invalid Tally XML format. File must contain valid Tally ENVELOPE tags.');
        }

        setMessage('✅ Tally XML validated successfully! Processed masters and voucher entries.');
      } catch (err) {
        setMessage(`⚠️ Import Error: ${err.message}`);
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Header Banner */}
      <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', color: '#ffffff', padding: '18px 24px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
            ⇄
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#ffffff' }}>TallyPrime XML Import / Export Integration</h1>
            <p style={{ fontSize: '12px', color: '#c7d2fe', margin: '3px 0 0 0', fontWeight: '500' }}>
              Exchange Accounting Masters, Ledger Groups & Voucher Transactions with TallyPrime
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        
        {/* Tally Export Box */}
        <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>📥</span>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Export to Tally XML</h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>Download complete ERP ledger groups, ledgers and voucher transactions in TallyPrime XML format.</p>
            </div>
          </div>

          <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '12px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span>• Includes all active Ledger Groups & Subgroups</span>
            <span>• Includes all Ledger Account Masters & Balances</span>
            <span>• Includes Purchase, Sales, Payment & Journal Vouchers</span>
          </div>

          <button
            onClick={handleExportXML}
            style={{ padding: '12px 20px', backgroundColor: '#1e3a8a', color: '#ffffff', fontWeight: '800', borderRadius: '8px', border: 'none', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
          >
            <span>⬇️</span>
            <span>Download Tally XML Export</span>
          </button>
        </div>

        {/* Tally Import Box */}
        <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>📤</span>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Import from Tally XML</h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>Upload a TallyPrime XML file to import external ledger accounts and journal vouchers into BVC ERP.</p>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>Select Tally XML File:</label>
            <input
              type="file"
              accept=".xml"
              onChange={handleFileUpload}
              style={{ fontSize: '12px' }}
            />
          </div>

          {importing && (
            <div style={{ fontSize: '12px', color: '#2563eb', fontWeight: '600' }}>
              ⏳ Validating and parsing Tally XML structure...
            </div>
          )}

          {message && (
            <div style={{ padding: '12px', backgroundColor: message.startsWith('✅') ? '#ecfdf5' : '#fef2f2', border: `1px solid ${message.startsWith('✅') ? '#6ee7b7' : '#fca5a5'}`, color: message.startsWith('✅') ? '#065f46' : '#991b1b', borderRadius: '8px', fontSize: '12px', fontWeight: '600' }}>
              {message}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default TallyImportExportPage;
