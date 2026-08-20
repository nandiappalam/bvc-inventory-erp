import React from 'react';
import { Box, Typography } from '@mui/material';

const ERPBreadcrumb = ({ items = [] }) => {
  return (
    <Box sx={{ px: 2, pt: 2, pb: 1 }}>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        {items.map((it, idx) => (
          <React.Fragment key={`${it.label}-${idx}`}>
            {idx !== 0 && (
              <Typography sx={{ color: '#8aa4d6' }}>{'>'}</Typography>
            )}
            <Typography
              sx={{
                fontSize: 13,
                color: it.isCurrent ? 'var(--erp-primary)' : '#5b6b86',
                fontWeight: it.isCurrent ? 700 : 500,
              }}
            >
              {it.label}
            </Typography>
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );
};

export default ERPBreadcrumb;

