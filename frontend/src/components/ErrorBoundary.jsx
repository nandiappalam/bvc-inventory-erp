import React from 'react';
<<<<<<< HEAD
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import HomeIcon from '@mui/icons-material/Home';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      diagnosticId: null,
=======
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
>>>>>>> origin/main
    };
  }

  static getDerivedStateFromError(error) {
<<<<<<< HEAD
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    return {
      hasError: true,
      error,
      diagnosticId: `ERR-UI-${today}-${rand}`,
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[React ErrorBoundary Caught UI Exception]:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, diagnosticId: null });
  };

=======
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

>>>>>>> origin/main
  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
<<<<<<< HEAD
    window.location.href = '/';
=======
    this.setState({ hasError: false, error: null, errorInfo: null });
    // Navigate to home
    if (window.location.hash !== '#/') {
      window.location.hash = '#/';
    }
>>>>>>> origin/main
  };

  render() {
    if (this.state.hasError) {
      return (
<<<<<<< HEAD
        <div id="error_boundary_fallback" style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: 'sans-serif' }}>
          <div style={{ maxWidth: '440px', width: '100%', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0', padding: '24px', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', border: '1px solid #fee2e2' }}>
              <ErrorOutlineIcon style={{ fontSize: '36px' }} />
            </div>

            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b', margin: '0 0 8px 0' }}>Something went wrong</h1>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              The application encountered an unexpected view error. Your company data and records remain completely safe.
            </p>

            {this.state.diagnosticId && (
              <div style={{ backgroundColor: '#f1f5f9', borderRadius: '8px', padding: '12px', marginBottom: '20px', border: '1px solid #e2e8f0', textAlign: 'left' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Diagnostic Reference:</div>
                <div style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold', color: '#334155', marginTop: '2px', userSelect: 'all' }}>
                  {this.state.diagnosticId}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                id="btn_error_try_again"
                onClick={this.handleReset}
                style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 16px', backgroundColor: '#1f4fb2', color: '#ffffff', fontSize: '14px', fontWeight: 600, borderRadius: '8px', border: 'none', cursor: 'pointer' }}
              >
                <RefreshIcon style={{ fontSize: '18px' }} />
                Try Again
              </button>

              <button
                id="btn_error_reload"
                onClick={this.handleReload}
                style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 16px', backgroundColor: '#f1f5f9', color: '#334155', fontSize: '14px', fontWeight: 600, borderRadius: '8px', border: '1px solid #cbd5e1', cursor: 'pointer' }}
              >
                Reload Application
              </button>

              <button
                id="btn_error_dashboard"
                onClick={this.handleGoHome}
                style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 16px', backgroundColor: 'transparent', color: '#64748b', fontSize: '12px', fontWeight: 500, border: 'none', cursor: 'pointer' }}
              >
                <HomeIcon style={{ fontSize: '16px' }} />
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
=======
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
>>>>>>> origin/main
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
<<<<<<< HEAD
=======

>>>>>>> origin/main
