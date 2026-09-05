import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  CircularProgress,
  Alert
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const themeColors = {
  primary: '#1f4fb2',
  secondary: '#2a5ea0',
  lightBlue: '#dbe7fb',
  lighterBlue: '#eaf2fb',
  white: '#ffffff',
  textPrimary: '#333333',
};

const GeneralCompanyCreate = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    gst_number: '',
    contact: '',
    email: ''
  });

  useEffect(() => {
    if (isEditMode) {
      fetchCompany();
    }
  }, [id]);

  const fetchCompany = async () => {
    try {
      setLoading(true);
      const result = await api(`companies/${id}`);
      if (result) {
        setFormData({
          name: result.name || '',
          address: result.address || '',
          gst_number: result.gst_number || '',
          contact: result.contact || '',
          email: result.email || ''
        });
      } else {
        setError('Failed to load company data');
      }
    } catch (error) {
      console.error('Error fetching company:', error);
      setError('Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "gst_number"
          ? value.toUpperCase().replace(/[^A-Z0-9]/g, "")
          : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.name) {
      setError('Company name is required');
      return;
    }

    try {
      setSaving(true);
      
      const payload = {
        name: formData.name,
        address: formData.address,
        gst_number: formData.gst_number,
        contact: formData.contact,
        email: formData.email
      };
      
      console.log('Sending payload to /api/companies:', JSON.stringify(payload, null, 2));
      
      let result;
      if (isEditMode) {
        result = await api(`companies/${id}`, { method: 'PUT', body: payload });
      } else {
        result = await api('companies', { method: 'POST', body: payload });
      }

      if (result && !result.error) {
        setSuccess(isEditMode ? 'Company updated successfully!' : 'Company created successfully!');
        setTimeout(() => {
          navigate('/company-select');
        }, 1500);
      } else {
        setError(result?.error || result?.message || `Failed to ${isEditMode ? 'update' : 'create'} company`);
      }
    } catch (error) {
      console.error('Error saving company:', error);
      setError('Error connecting to server');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 600, margin: '0 auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/company-select')}
          sx={{ mr: 2, color: themeColors.textPrimary }}
        >
          Back
        </Button>
        <Typography variant="h5" sx={{ fontWeight: 'bold', color: themeColors.primary }}>
          {isEditMode ? 'Update General Company' : 'Create General Company'}
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Company Name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  multiline
                  rows={2}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="GST Number"
                  name="gst_number"
                  value={formData.gst_number}
                  onChange={handleChange}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Contact"
                  name="contact"
                  value={formData.contact}
                  onChange={handleChange}
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                />
              </Grid>
              
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={() => navigate('/company-select')}
                    sx={{ borderColor: themeColors.textPrimary, color: themeColors.textPrimary }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={<SaveIcon />}
                    disabled={saving}
                    sx={{
                      backgroundColor: themeColors.primary,
                      '&:hover': { backgroundColor: themeColors.secondary }
                    }}
                  >
                    {saving ? <CircularProgress size={24} /> : (isEditMode ? 'Update Company' : 'Create Company')}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </form>
    </Box>
  );
};

export default GeneralCompanyCreate;

