import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const ERPHeader = ({ title, actionsLeft, actionsRight, action, actions }) => {
  const navigate = useNavigate();

  return (
    <Box sx={{ px: 2, pt: 1, pb: 1 }}>
      <Box
        sx={{
          backgroundColor: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => navigate(-1)}
            sx={{
              borderColor: 'var(--erp-border)',
              color: 'var(--erp-text)',
              textTransform: 'none',
              fontWeight: 'bold',
              minWidth: 'auto',
              px: 1.5,
              py: 0.5,
              '&:hover': {
                borderColor: 'var(--erp-primary)',
                backgroundColor: 'rgba(31, 79, 178, 0.04)',
              }
            }}
          >
            ← Back
          </Button>
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: { xs: 18, md: 20 },
              letterSpacing: '0.2px',
              color: 'var(--erp-primary)',
            }}
          >
            {title}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          {actionsLeft}
          {action}
          {actions}
          {actionsRight}
          <Button
            size="small"
            variant="outlined"
            onClick={() => window.location.reload()}
            sx={{
              borderColor: 'var(--erp-border)',
              color: 'var(--erp-text)',
              textTransform: 'none',
              fontWeight: 'bold',
              minWidth: 'auto',
              px: 1.5,
              py: 0.5,
              '&:hover': {
                borderColor: 'var(--erp-primary)',
                backgroundColor: 'rgba(31, 79, 178, 0.04)',
              }
            }}
          >
            Refresh ⟳
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default ERPHeader;

