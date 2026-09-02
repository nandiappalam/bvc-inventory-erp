import React from 'react'
import { Box, Paper, Typography, Stack, Divider } from '@mui/material'

/**
 * Shared ERP transaction shell.
 * Slots: header, details, main, summary, actions
 */
export default function TransactionPageLayout({
  title,
  header,
  details,
  main,
  summary,
  actions,
  cancelHref,
  breadcrumb,
}) {
  return (
    <Box sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        {breadcrumb ? (
          <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 1 }}>
            {breadcrumb}
          </Typography>
        ) : null}

        {title ? (
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>
            {title}
          </Typography>
        ) : null}

        {header ? (
          <Box sx={{ mb: 2 }}>
            {header}
          </Box>
        ) : null}

        {details ? (
          <Box sx={{ mb: 2 }}>
            {details}
          </Box>
        ) : null}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
            gap: 2,
            alignItems: 'start',
          }}
        >
          <Box>
            {main ? (
              <Paper variant="outlined" sx={{ p: 2 }}>
                {main}
              </Paper>
            ) : null}
          </Box>

          <Box>
            {summary ? (
              <Paper variant="outlined" sx={{ p: 2, position: 'sticky', top: 16 }}>
                {summary}
              </Paper>
            ) : null}

            {actions ? (
              <Box sx={{ mt: 2 }}>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction="row" spacing={1.2} sx={{ flexWrap: 'wrap' }}>
                    {actions}
                  </Stack>
                </Paper>
              </Box>
            ) : null}
          </Box>
        </Box>

        {cancelHref ? (
          <Divider sx={{ my: 2 }} />
        ) : null}

        {/* Optional footer reserved for future */}
      </Paper>
    </Box>
  )
}

