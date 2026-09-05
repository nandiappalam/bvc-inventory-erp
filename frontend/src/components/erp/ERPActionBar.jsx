import React from 'react';
import { Box } from '@mui/material';

const ERPActionBar = ({ children, sx }) => {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end', ...sx }}>
      {children}
    </Box>
  );
};

export default ERPActionBar;

