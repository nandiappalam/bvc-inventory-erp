import React from 'react';
import { Box } from '@mui/material';

const ERPSummaryCard = ({ children, sx }) => {
  return (
    <Box
      sx={{
        backgroundColor: 'var(--erp-card)',
        border: '1px solid var(--erp-border)',
        borderRadius: 'var(--erp-radius)',
        boxShadow: 'var(--erp-shadow-soft)',
        overflow: 'hidden',
        ...sx,
      }}
    >
      {children}
    </Box>
  );
};

export default ERPSummaryCard;

