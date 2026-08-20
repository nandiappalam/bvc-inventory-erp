import React from 'react';
import { Box } from '@mui/material';

const ERPInformationCard = ({ children, sx }) => {
  return (
    <Box
      sx={{
        backgroundColor: 'var(--erp-card)',
        border: '1px solid var(--erp-border)',
        borderRadius: 'var(--erp-radius)',
        boxShadow: 'var(--erp-shadow-soft)',
        px: 2,
        py: 1.75,
        ...sx,
      }}
    >
      {children}
    </Box>
  );
};

export default ERPInformationCard;

