import React, { useState, useEffect } from 'react';
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
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
  Scale as ScaleIcon
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

const WeightMachineSetup = () => {
  const navigate = useNavigate();
  const { selectedCompany } = useAuth();
  const [portNo, setPortNo] = useState('0');
  const [baudRate, setBaudRate] = useState('0');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState('success');

  useEffect(() => {
    fetchSetup();
  }, [selectedCompany]);

  const fetchSetup = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/features/weight-machine-setup?company_id=${selectedCompany?.id || 1}`);
      if (res.ok) {
        const data = await res.json();
        setPortNo(data.port_no ?? '0');
        setBaudRate(data.baud_rate ?? '0');
      }
    } catch (e) {
      console.error('Error fetching weight machine setup:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/features/weight-machine-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: selectedCompany?.id || 1,
          port_no: portNo,
          baud_rate: baudRate
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSeverity('success');
        setMessage('Weight Machine Setup configuration saved successfully!');
      } else {
        setSeverity('error');
        setMessage(data.message || 'Failed to save setup configuration');
      }
    } catch (e) {
      setSeverity('error');
      setMessage('Server connection error while saving configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800, margin: '0 auto' }}>
      {/* Page Header Banner */}
      <Card sx={{ mb: 3, bgcolor: themeColors.primary, color: 'white', borderRadius: 2, boxShadow: 2 }}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <ScaleIcon sx={{ fontSize: 28 }} />
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              Weight Machine Setup
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

      {/* Main Setup Card */}
      <Card sx={{ borderRadius: 2, boxShadow: 3 }}>
        <CardContent sx={{ p: 4 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress sx={{ color: themeColors.primary }} />
            </Box>
          ) : (
            <form onSubmit={handleSave}>
              <Typography variant="h6" sx={{ color: themeColors.primary, fontWeight: 'bold', mb: 1 }}>
                Hardware Port Communication
              </Typography>
              <Typography variant="body2" sx={{ color: '#666', mb: 3 }}>
                Configure the serial communication parameters for external electronic weighbridges and weigh scales.
              </Typography>

              <Divider sx={{ mb: 3 }} />

              <Grid container spacing={3} alignItems="center">
                <Grid item xs={12} sm={4}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: themeColors.textPrimary }}>
                    Weight Machine Port No :
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={8}>
                  <TextField
                    fullWidth
                    size="small"
                    value={portNo}
                    onChange={(e) => setPortNo(e.target.value)}
                    placeholder="e.g. COM1 or 1"
                    helperText="Specify serial port number or identifier"
                  />
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: themeColors.textPrimary }}>
                    Weight Machine Baud Rate :
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={8}>
                  <TextField
                    fullWidth
                    size="small"
                    value={baudRate}
                    onChange={(e) => setBaudRate(e.target.value)}
                    placeholder="e.g. 9600"
                    helperText="Standard baud rates: 2400, 4800, 9600, 19200"
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
                  Save Configuration
                </Button>
              </Box>
            </form>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default WeightMachineSetup;
