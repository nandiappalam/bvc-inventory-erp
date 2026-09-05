import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EntryDisplay } from './entry';

const columns = [
  { key: 's_no', title: 'S.No', render: (_val, row, idx) => idx !== undefined ? idx + 1 : (row.s_no || '') },
  { key: 'date', title: 'Date' },
  { key: 'papad_company', title: 'Papad Company', render: (val, row) => val || row.papadCompany || '' },
  { key: 'papad_balance', title: 'Papad Bal', render: (val, row) => parseFloat(val || row.papadBalance || 0).toFixed(2) },
  { key: 'payment_balance', title: 'Pymt Bal', render: (val, row) => parseFloat(val || row.paymentBalance || 0).toFixed(2) },
  { key: 'papad_less', title: 'Papad Less', render: (val, row) => parseFloat(val || row.papadLess || 0).toFixed(2) },
  { key: 'payment_less', title: 'Pytm Less', render: (val, row) => parseFloat(val || row.paymentLess || 0).toFixed(2) },
  { key: 'remarks', title: 'Remarks' }
];

const PapadReturnDisplay = () => {
  const navigate = useNavigate();

  return (
    <div className="window">
      <EntryDisplay
        title="Papad Return Display"
        apiEndpoint="/papad-returns"
        columns={columns}
        onEdit={(row) => navigate(`/entry/papad-return-create?id=${row.id}`)}
        addNewLink="/entry/papad-return-create"
      />
    </div>
  );
};

export default PapadReturnDisplay;
