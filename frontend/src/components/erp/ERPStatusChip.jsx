import React from 'react';
import { Chip } from '@mui/material';

const colorMap = {
  PASS: { bg: 'rgba(46, 99, 199, 0.14)', fg: '#1E5BD8', border: 'rgba(46, 99, 199, 0.35)' },
  FAIL: { bg: 'rgba(220, 38, 38, 0.12)', fg: '#B42318', border: 'rgba(220, 38, 38, 0.35)' },
  HOLD: { bg: 'rgba(245, 158, 11, 0.14)', fg: '#B45309', border: 'rgba(245, 158, 11, 0.35)' },
};

const ERPStatusChip = ({ status = '', label }) => {
  const cfg = colorMap[String(status).toUpperCase()] || {
    bg: 'rgba(31, 79, 178, 0.12)',
    fg: 'var(--erp-primary)',
    border: 'rgba(31, 79, 178, 0.35)',
  };

  return (
    <Chip
      label={label ?? status}
      variant="outlined"
      sx={{
        backgroundColor: cfg.bg,
        color: cfg.fg,
        borderColor: cfg.border,
        fontWeight: 800,
      }}
    />
  );
};

export default ERPStatusChip;

