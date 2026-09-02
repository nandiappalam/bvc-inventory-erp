import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  Lock as LockIcon,
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const themeColors = {
  primary: '#1f4fb2',
  secondary: '#2a5ea0',
  lightBlue: '#dbe7fb',
  lighterBlue: '#eaf2fb',
  white: '#ffffff',
  textPrimary: '#333333',
};

const UserChangePassword = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState('success');

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!newPassword) {
      setSeverity('error');
      setMessage('New password is required');
      return;
    }
    if (newPassword !== repeatPassword) {
      setSeverity('error');
      setMessage('New password and repeat password do not match');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const res = await fetch('/api/features/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          username: user?.username,
          oldPassword,
          newPassword,
          confirmPassword: repeatPassword
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSeverity('success');
        setMessage('Password changed successfully!');
        setOldPassword('');
        setNewPassword('');
        setRepeatPassword('');
      } else {
        setSeverity('error');
        setMessage(data.message || 'Failed to change password');
      }
    } catch (e) {
      setSeverity('error');
      setMessage('Server connection error while changing password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 650, margin: '0 auto' }}>
      {/* Header Banner */}
      <Card sx={{ mb: 3, bgcolor: themeColors.primary, color: 'white', borderRadius: 2, boxShadow: 2 }}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <LockIcon sx={{ fontSize: 28 }} />
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              Change Password
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/')}
            sx={{
              color: 'white',
              borderColor: 'rgba(255, 255, 255, 0.6)',
              '&:hover': { borderColor: 'white', bgcolor: 'rgba(255, 255, 255, 0.1)' }
            }}
          >
            Back
          </Button>
        </Box>
      </Card>

      {message && (
        <Alert severity={severity} sx={{ mb: 3 }} onClose={() => setMessage('')}>
          {message}
        </Alert>
      )}

      {/* Main Form Card */}
      <Card sx={{ borderRadius: 2, boxShadow: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <form onSubmit={handleSave}>
            <Typography variant="subtitle1" sx={{ color: themeColors.primary, fontWeight: 'bold', mb: 1 }}>
              Account Credentials Update
            </Typography>
            <Typography variant="body2" sx={{ color: '#666', mb: 3 }}>
              Logged in User: <strong>{user?.username || 'Current User'}</strong>
            </Typography>

            <Divider sx={{ mb: 3 }} />

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Old Password"
                  type="password"
                  size="small"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="New Password"
                  type="password"
                  size="small"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Repeat Password"
                  type="password"
                  size="small"
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                />
              </Grid>
            </Grid>

            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button
                variant="outlined"
                onClick={() => navigate('/')}
                sx={{ color: '#555', borderColor: '#ccc' }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={saving}
                startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                sx={{ bgcolor: themeColors.primary, '&:hover': { bgcolor: themeColors.secondary }, px: 4 }}
              >
                Change Password
              </Button>
            </Box>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default UserChangePassword;
