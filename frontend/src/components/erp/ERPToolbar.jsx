import React from 'react';
import { Box } from '@mui/material';

const ERPToolbar = ({ children, sx }) => {
  return <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', ...sx }}>{children}</Box>;
};

export default ERPToolbar;

