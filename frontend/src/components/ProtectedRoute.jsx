import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, PERMISSION_TYPES } from '../context/AuthContext';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';

const ProtectedRoute = ({ 
  children, 
  requiredPermission = null, 
  permissionType = PERMISSION_TYPES.VIEW 
}) => {
  const { user, selectedCompany, isAdmin, hasPermission, loading } = useAuth();
  const location = useLocation();

  // Show loading while checking auth
  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          gap: 2
        }}
      >
        <CircularProgress />
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  // Redirect to company selection if not logged in
  if (!user || !selectedCompany) {
    return <Navigate to="/company-select" state={{ from: location }} replace />;
  }

  // Check permission if required
  if (requiredPermission && !isAdmin) {
    const hasAccess = hasPermission(requiredPermission, permissionType);
    
    if (!hasAccess) {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '60vh',
            gap: 2,
            p: 3
          }}
        >
          <LockIcon sx={{ fontSize: 60, color: '#f44336' }} />
          <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#f44336' }}>
            Access Denied
          </Typography>
          <Alert severity="error" sx={{ maxWidth: 400 }}>
            You don't have permission to access this page.
            <br />
            <Typography variant="body2" sx={{ mt: 1 }}>
              Required Module: <strong>{requiredPermission}</strong>
              <br />
              Required Permission: <strong>{permissionType}</strong>
            </Typography>
          </Alert>
        </Box>
      );
    }
  }

  return children;
};

export default ProtectedRoute;
