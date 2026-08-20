import React from 'react';
import { Box } from '@mui/material';
import '../erp/erpTheme.css';

/**
 * Shared 70/30 SAP-style page layout.
 * - Sticky right summary column
 * - Sticky bottom action bar (via props.childrenBottom)
 */
const ERPPageLayout = ({
  breadcrumb,
  header,
  children,
  childrenBottom,
  rightSlot,
  containerProps,
}) => {
  const { sx: customSx, ...restContainerProps } = containerProps || {};
  return (
    <Box
      sx={{
        minHeight: 'calc(100vh - 64px)',
        backgroundColor: 'transparent',
        pt: 2,
        pb: childrenBottom ? '90px' : 2,
        '@media print': {
          pb: 0,
          minHeight: 'auto',
        },
        ...customSx
      }}
      {...restContainerProps}
    >
      {/* Breadcrumb */}
      {breadcrumb && (
        <Box sx={{ '@media print': { display: 'none !important' } }}>
          {breadcrumb}
        </Box>
      )}

      {/* Page Header */}
      {header && (
        <Box sx={{ '@media print': { display: 'none !important' } }}>
          {header}
        </Box>
      )}

      {/* Main Content */}
      <Box
        sx={{
          display: rightSlot ? 'grid' : 'block',
          gridTemplateColumns: rightSlot ? { xs: '1fr', lg: '74% 24%' } : 'none',
          gap: 2.5,
          alignItems: 'start',
          '@media print': {
            display: 'block',
            width: '100%',
          }
        }}
      >
        <Box sx={{ minWidth: 0 }}>{children}</Box>
        {rightSlot && (
          <Box
            sx={{
              position: { lg: 'sticky' },
              top: { lg: 84 },
              minWidth: 0,
              '@media print': {
                display: 'none !important',
              }
            }}
          >
            {rightSlot}
          </Box>
        )}
      </Box>

      {/* Sticky Bottom Action Bar */}
      {childrenBottom && (
        <Box
          sx={{
            position: 'fixed',
            left: { xs: 0, md: 'auto' },
            right: { xs: 0, md: 24 },
            bottom: 16,
            zIndex: 1200,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
            '@media print': {
              display: 'none !important',
            }
          }}
        >
          <Box
            sx={{
              width: { xs: 'calc(100% - 24px)', md: 720 },
              backgroundColor: 'var(--erp-card)',
              border: '1px solid var(--erp-border)',
              borderRadius: 'var(--erp-radius)',
              boxShadow: 'var(--erp-shadow-soft)',
              px: 2,
              py: 1.5,
              display: 'flex',
              gap: 1.5,
              justifyContent: 'flex-end',
              pointerEvents: 'auto',
            }}
          >
            {childrenBottom}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default ERPPageLayout;

