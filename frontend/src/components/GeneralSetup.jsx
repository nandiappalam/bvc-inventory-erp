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
  FormControl,
  Select,
  MenuItem,
  Divider,
  Paper
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
  Settings as SettingsIcon,
  FolderOpen as FolderIcon
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

const GeneralSetup = () => {
  const navigate = useNavigate();
  const { selectedCompany } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState('success');

  const todayStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');

  const [formData, setFormData] = useState({
    current_date: todayStr,
    auto_backup: 'Yes',
    backup_subfolder: 'Yes',
    backup_path: 'D:\\BACKUP',
    printer_path: 'CutePDF Writer',
    select_theme: 'Blue',
    credit_debit_instead: 'No',
    manual_voucher_no: 'No',
    use_voucher_print: 'No',
    date_locked_upto: '31-03-2024',
    reset_version_no: 'No'
  });

  useEffect(() => {
    fetchSetup();
  }, [selectedCompany]);

  const fetchSetup = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/features/general-setup?company_id=${selectedCompany?.id || 1}`);
      if (res.ok) {
        const data = await res.json();
        setFormData(prev => ({
          ...prev,
          ...data,
          current_date: data.current_date || todayStr
        }));
      }
    } catch (e) {
      console.error('Error fetching general setup:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, val) => {
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/features/general-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: selectedCompany?.id || 1,
          ...formData
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSeverity('success');
        setMessage('General system configuration saved successfully!');
      } else {
        setSeverity('error');
        setMessage(data.message || 'Failed to save configuration');
      }
    } catch (e) {
      setSeverity('error');
      setMessage('Server error while saving setup');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 900, margin: '0 auto' }}>
      {/* Header Banner */}
      <Card sx={{ mb: 3, bgcolor: themeColors.primary, color: 'white', borderRadius: 2, boxShadow: 2 }}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <SettingsIcon sx={{ fontSize: 28 }} />
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              General System Setup
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

      {/* Settings Form Card */}
      <Card sx={{ borderRadius: 2, boxShadow: 3 }}>
        <CardContent sx={{ p: 4 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress sx={{ color: themeColors.primary }} />
            </Box>
          ) : (
            <form onSubmit={handleSave}>
              <Grid container spacing={3}>
                {/* Date & Backup Options */}
                <Grid item xs={12}>
                  <Typography variant="subtitle1" sx={{ color: themeColors.primary, fontWeight: 'bold' }}>
                    Backup & Storage Preferences
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>Current System Date:</Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={formData.current_date}
                    onChange={(e) => handleChange('current_date', e.target.value)}
                  />
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>Auto Backup on Exit:</Typography>
                  <FormControl fullWidth size="small">
                    <Select
                      value={formData.auto_backup}
                      onChange={(e) => handleChange('auto_backup', e.target.value)}
                    >
                      <MenuItem value="Yes">Yes</MenuItem>
                      <MenuItem value="No">No</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>Backup Sub-Folder:</Typography>
                  <FormControl fullWidth size="small">
                    <Select
                      value={formData.backup_subfolder}
                      onChange={(e) => handleChange('backup_subfolder', e.target.value)}
                    >
                      <MenuItem value="Yes">Yes</MenuItem>
                      <MenuItem value="No">No</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>Backup Storage Path:</Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={formData.backup_path}
                    onChange={(e) => handleChange('backup_path', e.target.value)}
                    placeholder="e.g. D:\BACKUP"
                  />
                </Grid>

                {/* System & Printing Options */}
                <Grid item xs={12} sx={{ mt: 2 }}>
                  <Typography variant="subtitle1" sx={{ color: themeColors.primary, fontWeight: 'bold' }}>
                    Printing & Vouchers Options
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>Default Printer Path:</Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={formData.printer_path}
                    onChange={(e) => handleChange('printer_path', e.target.value)}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>Application Theme:</Typography>
                  <FormControl fullWidth size="small">
                    <Select
                      value={formData.select_theme}
                      onChange={(e) => handleChange('select_theme', e.target.value)}
                    >
                      <MenuItem value="Blue">ERP Standard Blue</MenuItem>
                      <MenuItem value="Gray">Classic Gray</MenuItem>
                      <MenuItem value="Dark">Modern Dark</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>Use Dr/Cr Instead of To/By:</Typography>
                  <FormControl fullWidth size="small">
                    <Select
                      value={formData.credit_debit_instead}
                      onChange={(e) => handleChange('credit_debit_instead', e.target.value)}
                    >
                      <MenuItem value="Yes">Yes</MenuItem>
                      <MenuItem value="No">No</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>Manual Voucher Numbering:</Typography>
                  <FormControl fullWidth size="small">
                    <Select
                      value={formData.manual_voucher_no}
                      onChange={(e) => handleChange('manual_voucher_no', e.target.value)}
                    >
                      <MenuItem value="Yes">Yes</MenuItem>
                      <MenuItem value="No">No</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>Use Voucher Printing:</Typography>
                  <FormControl fullWidth size="small">
                    <Select
                      value={formData.use_voucher_print}
                      onChange={(e) => handleChange('use_voucher_print', e.target.value)}
                    >
                      <MenuItem value="Yes">Yes</MenuItem>
                      <MenuItem value="No">No</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>Date Locked Upto:</Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={formData.date_locked_upto}
                    onChange={(e) => handleChange('date_locked_upto', e.target.value)}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>Reset Version No:</Typography>
                  <FormControl fullWidth size="small">
                    <Select
                      value={formData.reset_version_no}
                      onChange={(e) => handleChange('reset_version_no', e.target.value)}
                    >
                      <MenuItem value="Yes">Yes</MenuItem>
                      <MenuItem value="No">No</MenuItem>
                    </Select>
                  </FormControl>
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
                  Save Changes
                </Button>
              </Box>
            </form>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default GeneralSetup;
