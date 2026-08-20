import React from 'react';
import { Box, Typography } from '@mui/material';

const ERPSectionCard = ({ title, children, sx }) => {
  return (
    <Box
      sx={{
        backgroundColor: 'var(--erp-card)',
        border: '1px solid var(--erp-border)',
        borderRadius: 'var(--erp-radius)',
        boxShadow: 'var(--erp-shadow-soft)',
        ...sx,
      }}
    >
      <Box sx={{ px: 2, pt: 1.5, pb: 0.75 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 14, color: 'var(--erp-primary)' }}>
          {title}
        </Typography>
      </Box>
      <Box sx={{ px: 2, pb: 2 }}>{children}</Box>
    </Box>
  );
};

export default ERPSectionCard;

