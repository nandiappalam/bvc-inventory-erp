import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const UnderConstruction = ({ moduleName = 'This Module' }) => {
  return (
    <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
      <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h5" color="primary" gutterBottom>{moduleName} is Under Construction</Typography>
        <Typography variant="body1">We're working hard to bring you this feature. Please check back later!</Typography>
      </Paper>
    </Box>
  );
};

export default UnderConstruction;