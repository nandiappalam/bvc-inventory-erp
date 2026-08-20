import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';

/**
 * ErrorBoundary Component
 * Catches React errors and displays a user-friendly message instead of crashing
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    // Navigate to home
    if (window.location.hash !== '#/') {
      window.location.hash = '#/';
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f5f5f5',
            padding: 2,
          }}
        >
          <Paper
            elevation={3}
            sx={{
              maxWidth: 500,
              width: '100%',
              p: 4,
              textAlign: 'center',
            }}
          >
            <ErrorOutlineIcon 
              sx={{ 
                fontSize: 64, 
                color: '#f44336',
                mb: 2 
              }} 
            />
            <Typography 
              variant="h5" 
              component="h1" 
              sx={{ 
                fontWeight: 'bold',
                color: '#333',
                mb: 2 
              }}
            >
              Something Went Wrong
            </Typography>
            <Typography 
              variant="body1" 
              sx={{ 
                color: '#666',
                mb: 3 
              }}
            >
              The application encountered an unexpected error. This might be due to:
            </Typography>
            <Box 
              component="ul" 
              sx={{ 
                textAlign: 'left',
                mb: 3,
                pl: 2,
                color: '#666'
              }}
            >
              <li>Database connection issues</li>
              <li>Missing data or configuration</li>
              <li>Network connectivity problems</li>
            </Box>
            
            {/* Error details for debugging - only show in development */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <Paper 
                sx={{ 
                  p: 2, 
                  mb: 3, 
                  backgroundColor: '#fff3e0',
                  textAlign: 'left',
                  overflow: 'auto',
                  maxHeight: 150
                }}
              >
                <Typography 
                  variant="caption" 
                  sx={{ 
                    fontFamily: 'monospace',
                    color: '#e65100',
                    wordBreak: 'break-word'
                  }}
                >
                  {this.state.error.toString()}
                </Typography>
              </Paper>
            )}
            
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={this.handleReload}
                sx={{
                  backgroundColor: '#1976d2',
                  '&:hover': { backgroundColor: '#1565c0' }
                }}
              >
                Reload App
              </Button>
              <Button
                variant="outlined"
                onClick={this.handleGoHome}
                sx={{
                  borderColor: '#1976d2',
                  color: '#1976d2',
                  '&:hover': { borderColor: '#1565c0' }
                }}
              >
                Try Again
              </Button>
            </Box>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

