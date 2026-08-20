import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress
} from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import BusinessIcon from '@mui/icons-material/Business';

const themeColors = {
  primary: '#1f4fb2',
  secondary: '#2a5ea0',
  lightBlue: '#dbe7fb',
  lighterBlue: '#eaf2fb',
  white: '#ffffff',
  textPrimary: '#333333',
};

const AuthChoice = () => {
  const navigate = useNavigate();
  const { selectedCompany, loading } = useAuth();

  if (loading || !selectedCompany) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: `linear-gradient(135deg, ${themeColors.primary} 0%, ${themeColors.secondary} 100%)`,
        }}
      >
        <CircularProgress sx={{ color: themeColors.white }} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: `linear-gradient(135deg, ${themeColors.primary} 0%, ${themeColors.secondary} 100%)`,
        padding: 2,
      }}
    >
      <Card
        sx={{
          maxWidth: 500,
          width: '100%',
          boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
          borderRadius: 2,
        }}
      >
        <CardContent sx={{ p: 4 }}>
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <BusinessIcon sx={{ fontSize: 60, color: themeColors.primary, mb: 2 }} />
            <Typography
              variant="h4"
              sx={{
                fontWeight: 'bold',
                color: themeColors.primary,
                mb: 1,
              }}
            >
              {selectedCompany.name}
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Welcome! Please choose an option below
            </Typography>
          </Box>

          {/* Options */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<LoginIcon />}
              onClick={() => navigate('/login')}
              sx={{
                backgroundColor: themeColors.primary,
                '&:hover': { backgroundColor: themeColors.secondary },
                py: 2,
                fontSize: '16px',
                fontWeight: 'bold',
              }}
            >
              Login
            </Button>
            
            <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center' }}>
              OR
            </Typography>
            
            <Button
              variant="outlined"
              size="large"
              startIcon={<PersonAddIcon />}
              onClick={() => navigate('/user/create')}
              sx={{
                borderColor: themeColors.primary,
                color: themeColors.primary,
                '&:hover': { 
                  backgroundColor: themeColors.lightBlue,
                  borderColor: themeColors.secondary 
                },
                py: 2,
                fontSize: '16px',
                fontWeight: 'bold',
              }}
            >
              Create New User
            </Button>
          </Box>

          {/* Back Button */}
          <Button
            fullWidth
            sx={{ mt: 3, color: themeColors.textPrimary }}
            onClick={() => navigate('/company-select')}
          >
            ← Back to Company List
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AuthChoice;
