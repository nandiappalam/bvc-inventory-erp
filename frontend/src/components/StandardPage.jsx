import React from 'react'
import { Container, Paper, Typography } from '@mui/material'

const StandardPage = ({ title, children, containerSx = {}, paperSx = {} }) => {
  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4, ...containerSx }}>
      <Paper elevation={3} sx={{ p: 2, backgroundColor: '#DCE6D0', overflow: 'hidden', ...paperSx }}>
        <Typography
          variant="h5"
          component="h1"
          sx={{
            backgroundColor: '#3b6fd8',
            color: 'white',
            p: 1.5,
            fontSize: '20px',
            fontWeight: 'bold',
            m: '-8px -8px 16px -8px'
          }}
        >
          {title}
        </Typography>

        {children}
      </Paper>
    </Container>
  )
}

export default StandardPage
