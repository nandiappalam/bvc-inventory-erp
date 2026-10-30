import React from 'react';
import StandardDisplayPage from './StandardDisplayPage';

const SignDisplay = () => {
  return (
    <StandardDisplayPage
      pageTitle="Signature Management"
      apiEndpoint="/api/masters/sign"
      columns={[
        { key: 'name', title: 'Signer Name' },
        { key: 'designation', title: 'Designation' },
        { 
          key: 'signature_image', 
          title: 'Signature', 
          render: (val) => val ? (
            <img src={val} alt="Signature" style={{ height: '35px', maxWidth: '120px', objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none'; }} />
          ) : '—'
        },
        { key: 'status', title: 'Status' }
      ]}
    />
  );
};

export default SignDisplay;
