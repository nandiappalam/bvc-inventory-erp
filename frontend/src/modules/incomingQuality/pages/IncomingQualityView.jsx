import React from 'react';
import { Container, Paper, Typography } from '@mui/material';

const IncomingQualityView = () => {
  return (
    <Container maxWidth="md">
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5">IQR View</Typography>
        <Typography color="text.secondary" sx={{ mt: 2 }}>IQR details will be connected to QC and voucher flow next.</Typography>
      </Paper>
    </Container>
  );
};

export default IncomingQualityView;
