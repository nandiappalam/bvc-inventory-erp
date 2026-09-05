import React from 'react';
import { Box, Typography } from '@mui/material';

const ERPStatisticsCard = ({ title, items = [] }) => {
  return (
    <Box sx={{ backgroundColor: 'var(--erp-card)', border: '1px solid var(--erp-border)', borderRadius: 'var(--erp-radius)', p: 2, boxShadow: 'var(--erp-shadow-soft)' }}>
      <Typography sx={{ fontWeight: 900, fontSize: 14, color: 'var(--erp-primary)', mb: 1 }}>{title}</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {items.map((it) => (
          <Box key={it.label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Typography sx={{ fontSize: 13, color: '#4b5b76' }}>{it.label}</Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 900 }}>{it.value}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default ERPStatisticsCard;

