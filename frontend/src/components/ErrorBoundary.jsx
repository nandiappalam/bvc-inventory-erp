import React from 'react';
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
    };
  }

  static getDerivedStateFromError(error) {
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

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
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
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
