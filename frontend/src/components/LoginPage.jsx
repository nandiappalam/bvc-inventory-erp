import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api.js';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  InputAdornment,
  IconButton
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import PersonIcon from '@mui/icons-material/Person';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import BusinessIcon from '@mui/icons-material/Business';

const themeColors = {
  primary: '#1f4fb2',
  secondary: '#2a5ea0',
  lightBlue: '#dbe7fb',
  lighterBlue: '#eaf2fb',
  white: '#ffffff',
  textPrimary: '#333333',
};

const LoginPage = () => {
  const navigate = useNavigate();
  const { login: setAuthLogin, selectedCompany } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Redirect to company selection if no company is selected
  useEffect(() => {
    if (selectedCompany === null) {
      navigate('/company-select');
    }
  }, [selectedCompany]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Please enter username and password');
      return;
    }

    if (!selectedCompany) {
      setError('Please select a company first');
      return;
    }

    setLoading(true);

    try {
      // Use dual-mode API (works in both browser and Tauri)
      // Pass company_id along with username and password
      const response = await api('/auth/login', {
        method: 'POST',
        body: {
          username: username.trim(),
          password,
          company_id: selectedCompany.id
        }
      });

      if (response && response.success === false) {
        if (response.message === 'no_user_exists') {
          navigate('/user/create', { state: { companyId: selectedCompany.id, fromLogin: true } });
          return;
        }
        setError(response.message || 'Invalid username or password for this company');
        return;
      }

      if (!response || (!response.user && !response.id)) {
        setError(response?.message || 'Invalid username or password for this company');
        return;
      }

      // Update auth context with login data
      const res = await setAuthLogin(response);
      if (res && res.success === false) {
        setError(res.message || 'Login failed');
        return;
      }

      // Navigate to the dashboard (protected route)
      navigate('/dashboard');
    } 
    catch (err) {
      console.error('Login error:', err);
      setError(err?.message || 'Invalid username or password for this company');
    } 
    finally {
      setLoading(false);
    }
  };

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
          maxWidth: 450,
          width: '100%',
          boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
          borderRadius: 2,
        }}
      >
        <CardContent sx={{ p: 4 }}>
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                backgroundColor: themeColors.lightBlue,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                mb: 2
              }}
            >
              <BusinessIcon sx={{ fontSize: 40, color: themeColors.primary }} />
            </Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 'bold',
                color: themeColors.primary,
                mb: 1,
              }}
            >
              BVC Login
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Enter your credentials to continue
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            {/* Username Field */}
            <TextField
              fullWidth
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              margin="normal"
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon sx={{ color: themeColors.primary }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': {
                    borderColor: themeColors.primary,
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: themeColors.primary,
                  },
                },
              }}
            />

            {/* Password Field */}
            <TextField
              fullWidth
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon sx={{ color: themeColors.primary }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': {
                    borderColor: themeColors.primary,
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: themeColors.primary,
                  },
                },
              }}
            />

            {/* Login Button */}
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading}
              sx={{
                mt: 3,
                mb: 2,
                backgroundColor: themeColors.primary,
                '&:hover': { backgroundColor: themeColors.secondary },
                py: 1.5,
                fontSize: '16px',
                fontWeight: 'bold',
              }}
            >
              {loading ? (
                <CircularProgress size={24} sx={{ color: themeColors.white }} />
              ) : (
                'Login'
              )}
            </Button>
          </form>

          {/* Help Text */}
          <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', mt: 2 }}>
            Contact your administrator if you don't have login credentials.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default LoginPage;
