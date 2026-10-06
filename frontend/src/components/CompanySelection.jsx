import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api.js';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  TextField,
  InputAdornment,
  IconButton,
  Grid,
  Divider,
  Chip
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import LoginIcon from '@mui/icons-material/Login';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InventoryIcon from '@mui/icons-material/Inventory';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ShieldIcon from '@mui/icons-material/Shield';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import KitchenIcon from '@mui/icons-material/Kitchen';
import FactoryIcon from '@mui/icons-material/Factory';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import SecurityIcon from '@mui/icons-material/Security';
import PersonAddIcon from '@mui/icons-material/PersonAdd';

const themeColors = {
  primary: '#1f4fb2',
  secondary: '#2a5ea0',
  navy: '#0f172a',
  slate: '#334155',
  lightBlue: '#dbe7fb',
  lighterBlue: '#f0f5ff',
  accent: '#10b981',
  white: '#ffffff',
  textPrimary: '#1e293b',
  border: '#e2e8f0',
};

const CompanySelection = () => {
  const navigate = useNavigate();
  const { 
    user, 
    selectedCompany, 
    selectCompany, 
    login: setAuthLogin, 
    logout 
  } = useAuth();

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [initializing, setInitializing] = useState(false);

  // Quick Login State for Selected Company
  const [loginUsername, setLoginUsername] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('admin123');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('list'); // 'list' or 'login'

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    if (selectedCompany && selectedCompany.id) {
      setActiveTab('login');
    }
  }, [selectedCompany]);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      setError('');
      const result = await api('companies');
      if (result && result.success === false) {
        setError(result.message || 'Error connecting to database');
        setCompanies([]);
        return;
      }
      const list = Array.isArray(result) ? result : [];
      setCompanies(list);
    } catch (err) {
      console.error('Error fetching companies:', err);
      setError(err.message || 'Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  const handleInitDefault = async () => {
    try {
      setInitializing(true);
      setError('');
      const res = await api('companies/init-default', { method: 'POST' });
      if (res && res.success === false) {
        setError(res.message || 'Failed to initialize default company');
      } else {
        setSuccessMsg('Default company initialized successfully!');
        await fetchCompanies();
      }
    } catch (err) {
      setError(err.message || 'Failed to initialize default company');
    } finally {
      setInitializing(false);
    }
  };

  const handleSelectCompany = (comp) => {
    selectCompany(comp);
    setLoginError('');
    setActiveTab('login');
  };

  const handleSwapCompany = () => {
    setActiveTab('list');
  };

  const handleQuickLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    if (!loginUsername.trim() || !loginPassword) {
      setLoginError('Please enter both username and password');
      return;
    }

    if (!selectedCompany) {
      setLoginError('Please select a company first');
      return;
    }

    setLoginLoading(true);

    try {
      const response = await api('/auth/login', {
        method: 'POST',
        body: {
          username: loginUsername.trim(),
          password: loginPassword,
          company_id: selectedCompany.id
        }
      });

      if (response && response.success === false) {
        if (response.message === 'no_user_exists') {
          navigate('/user/create', { state: { companyId: selectedCompany.id, fromLogin: true } });
          return;
        }
        setLoginError(response.message || 'Invalid username or password for this company');
        return;
      }

      if (!response || (!response.user && !response.id)) {
        setLoginError(response?.message || 'Invalid username or password for this company');
        return;
      }

      const res = await setAuthLogin(response);
      if (res && res.success === false) {
        setLoginError(res.message || 'Login failed');
        return;
      }

      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setLoginError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  const filteredCompanies = companies.filter(comp => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const name = (comp.name || comp.company_name || '').toLowerCase();
    const code = String(comp.code || comp.company_code || comp.id || '').toLowerCase();
    const gst = String(comp.gst_number || comp.gst_no || comp.gstin || '').toLowerCase();
    const city = String(comp.city || comp.location || comp.address || '').toLowerCase();
    return name.includes(term) || code.includes(term) || gst.includes(term) || city.includes(term);
  });

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc', color: themeColors.textPrimary, display: 'flex', flexDirection: 'column' }}>
      {/* 1. Header Navigation Bar */}
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 1100,
          bgcolor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(8px)',
          borderBottom: `1px solid ${themeColors.border}`,
          px: { xs: 2, md: 6 },
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        {/* Zone 1: Brand */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }} onClick={() => scrollToSection('hero')}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              bgcolor: themeColors.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: '0 2px 8px rgba(31, 79, 178, 0.3)'
            }}
          >
            <BusinessIcon />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, color: themeColors.primary, lineHeight: 1.1, letterSpacing: '-0.5px' }}>
              BVC EXPORTS
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, letterSpacing: '0.5px' }}>
              Enterprise ERP Hub
            </Typography>
          </Box>
        </Box>

        {/* Zone 2: Navigation links */}
        <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 4 }}>
          <Button onClick={() => scrollToSection('hero')} sx={{ color: themeColors.slate, textTransform: 'none', fontWeight: 600 }}>
            Overview
          </Button>
          <Button onClick={() => scrollToSection('company-portal')} sx={{ color: themeColors.primary, textTransform: 'none', fontWeight: 700 }}>
            Company Portal & Login
          </Button>
          <Button onClick={() => scrollToSection('modules')} sx={{ color: themeColors.slate, textTransform: 'none', fontWeight: 600 }}>
            ERP Modules
          </Button>
          <Button onClick={() => scrollToSection('about')} sx={{ color: themeColors.slate, textTransform: 'none', fontWeight: 600 }}>
            About BVC
          </Button>
          <Button onClick={() => scrollToSection('compliance')} sx={{ color: themeColors.slate, textTransform: 'none', fontWeight: 600 }}>
            QC & Compliance
          </Button>
        </Box>

        {/* Zone 3: Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {user ? (
            <Button
              variant="contained"
              onClick={() => navigate('/dashboard')}
              startIcon={<ArrowForwardIcon />}
              sx={{
                bgcolor: themeColors.accent,
                '&:hover': { bgcolor: '#059669' },
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: 2,
                px: 2.5
              }}
            >
              Go to Dashboard
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={() => scrollToSection('company-portal')}
              startIcon={<LoginIcon />}
              sx={{
                bgcolor: themeColors.primary,
                '&:hover': { bgcolor: themeColors.secondary },
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: 2,
                px: 2.5
              }}
            >
              Company Login
            </Button>
          )}
        </Box>
      </Box>

      {/* 2. Hero Section */}
      <Box
        id="hero"
        sx={{
          background: `linear-gradient(180deg, #0f172a 0%, #1e293b 100%)`,
          color: 'white',
          pt: { xs: 8, md: 10 },
          pb: { xs: 8, md: 12 },
          px: { xs: 3, md: 6 },
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <Box sx={{ maxWidth: 1200, mx: 'auto', textAlign: 'center', position: 'relative', zIndex: 2 }}>
          <Chip
            label="Enterprise ERP & Material Management Platform"
            sx={{
              bgcolor: 'rgba(255, 255, 255, 0.1)',
              color: '#93c5fd',
              fontWeight: 600,
              fontSize: '0.85rem',
              mb: 3,
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}
          />

          <Typography
            variant="h2"
            sx={{
              fontWeight: 800,
              fontSize: { xs: '2.2rem', md: '3.6rem' },
              lineHeight: 1.15,
              letterSpacing: '-1px',
              mb: 3,
              maxWidth: 900,
              mx: 'auto'
            }}
          >
            Streamlined Milling, Papad Manufacturing & Stock Storage Operations
          </Typography>

          <Typography
            variant="h6"
            sx={{
              color: '#cbd5e1',
              fontWeight: 400,
              fontSize: { xs: '1rem', md: '1.25rem' },
              lineHeight: 1.6,
              maxWidth: 760,
              mx: 'auto',
              mb: 5
            }}
          >
            A unified, multi-tenant inventory ecosystem engineered for raw grain procurement, moisture inspection, flour milling, finished papad tracking, weighing scale integration, and audit-ready accounting.
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap', mb: 8 }}>
            <Button
              variant="contained"
              size="large"
              onClick={() => scrollToSection('company-portal')}
              startIcon={<LoginIcon />}
              sx={{
                bgcolor: themeColors.primary,
                '&:hover': { bgcolor: '#2563eb' },
                fontSize: '1rem',
                fontWeight: 700,
                textTransform: 'none',
                py: 1.5,
                px: 4,
                borderRadius: 2,
                boxShadow: '0 4px 20px rgba(31, 79, 178, 0.4)'
              }}
            >
              Select Company & Login
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => scrollToSection('modules')}
              sx={{
                color: 'white',
                borderColor: 'rgba(255, 255, 255, 0.3)',
                '&:hover': { borderColor: 'white', bgcolor: 'rgba(255, 255, 255, 0.05)' },
                fontSize: '1rem',
                fontWeight: 600,
                textTransform: 'none',
                py: 1.5,
                px: 3.5,
                borderRadius: 2
              }}
            >
              Explore Modules
            </Button>
          </Box>

          {/* Quick Metrics & Pillars Bar */}
          <Grid container spacing={3} sx={{ maxWidth: 1050, mx: 'auto', textAlign: 'left' }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: 'rgba(255, 255, 255, 0.06)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'white', borderRadius: 2 }}>
                <CardContent sx={{ p: 2.5 }}>
                  <ShieldIcon sx={{ color: '#60a5fa', mb: 1, fontSize: 28 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    100% Tenant Isolation
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                    Zero cross-company data leakage with isolated table structures.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: 'rgba(255, 255, 255, 0.06)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'white', borderRadius: 2 }}>
                <CardContent sx={{ p: 2.5 }}>
                  <FactoryIcon sx={{ color: '#34d399', mb: 1, fontSize: 28 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Lot & Batch Genealogy
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                    End-to-end traceability from raw grain purchase to export packing.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: 'rgba(255, 255, 255, 0.06)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'white', borderRadius: 2 }}>
                <CardContent sx={{ p: 2.5 }}>
                  <KitchenIcon sx={{ color: '#38bdf8', mb: 1, fontSize: 28 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Cold Storage Logistics
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                    Chamber allocations, pallet capacity & godown movement control.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: 'rgba(255, 255, 255, 0.06)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'white', borderRadius: 2 }}>
                <CardContent sx={{ p: 2.5 }}>
                  <AssessmentIcon sx={{ color: '#fbbf24', mb: 1, fontSize: 28 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Live Financials & BI
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                    Instant ledger statements, trial balances & automated audit logs.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </Box>

      {/* 3. Central Company Selection & Login Portal */}
      <Box
        id="company-portal"
        sx={{
          py: { xs: 8, md: 10 },
          px: { xs: 2, md: 6 },
          maxWidth: 1200,
          mx: 'auto',
          width: '100%'
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography variant="overline" sx={{ color: themeColors.primary, fontWeight: 800, letterSpacing: '1px' }}>
            SECURE ACCESS PORTAL
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 800, color: themeColors.navy, letterSpacing: '-0.5px' }}>
            Company Selection & Login
          </Typography>
          <Typography variant="body1" sx={{ color: '#64748b', maxWidth: 600, mx: 'auto', mt: 1 }}>
            Select your registered business entity to access your dedicated inventory dashboard, master registers, and operational workflows.
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {successMsg && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMsg('')}>
            {successMsg}
          </Alert>
        )}

        {/* Selected Company Banner if active */}
        {selectedCompany && (
          <Card sx={{ mb: 4, bgcolor: themeColors.lighterBlue, border: `1px solid ${themeColors.lightBlue}`, borderRadius: 2 }}>
            <CardContent sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <CheckCircleIcon sx={{ color: themeColors.primary, fontSize: 32 }} />
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    Current Active Company
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: themeColors.navy }}>
                    {selectedCompany.name || selectedCompany.company_name || `Company ${selectedCompany.id}`}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#475569' }}>
                    Code: {selectedCompany.code || selectedCompany.company_code || selectedCompany.id} | GST: {selectedCompany.gst_number || selectedCompany.gst_no || 'N/A'}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Button
                  variant="outlined"
                  startIcon={<SwapHorizIcon />}
                  onClick={handleSwapCompany}
                  sx={{
                    borderColor: themeColors.primary,
                    color: themeColors.primary,
                    textTransform: 'none',
                    fontWeight: 700,
                    borderRadius: 1.5
                  }}
                >
                  Swap / Change Company
                </Button>
                {activeTab !== 'login' && (
                  <Button
                    variant="contained"
                    startIcon={<LoginIcon />}
                    onClick={() => setActiveTab('login')}
                    sx={{
                      bgcolor: themeColors.primary,
                      textTransform: 'none',
                      fontWeight: 700,
                      borderRadius: 1.5
                    }}
                  >
                    Proceed to Login
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Main Portal Card */}
        <Card sx={{ borderRadius: 3, boxShadow: '0 8px 32px rgba(15, 23, 42, 0.08)', border: `1px solid ${themeColors.border}`, overflow: 'hidden' }}>
          {/* Sub Navigation Bar for the Portal: Company List vs Quick Login */}
          <Box sx={{ display: 'flex', borderBottom: `1px solid ${themeColors.border}`, bgcolor: '#f8fafc', px: 3, pt: 2 }}>
            <Button
              onClick={() => setActiveTab('list')}
              sx={{
                pb: 1.5,
                px: 3,
                fontWeight: 700,
                color: activeTab === 'list' ? themeColors.primary : '#64748b',
                borderBottom: activeTab === 'list' ? `3px solid ${themeColors.primary}` : '3px solid transparent',
                borderRadius: 0,
                textTransform: 'none',
                fontSize: '0.95rem'
              }}
            >
              1. Company Selection List ({filteredCompanies.length})
            </Button>
            <Button
              onClick={() => {
                if (selectedCompany) setActiveTab('login');
              }}
              disabled={!selectedCompany}
              sx={{
                pb: 1.5,
                px: 3,
                fontWeight: 700,
                color: activeTab === 'login' ? themeColors.primary : '#64748b',
                borderBottom: activeTab === 'login' ? `3px solid ${themeColors.primary}` : '3px solid transparent',
                borderRadius: 0,
                textTransform: 'none',
                fontSize: '0.95rem'
              }}
            >
              2. Selected Company Login {selectedCompany ? `(${selectedCompany.name})` : ''}
            </Button>
          </Box>

          <CardContent sx={{ p: { xs: 3, md: 5 } }}>
            {activeTab === 'list' ? (
              /* TAB 1: COMPANY LIST (ONLY LOGIN ACTION, ZERO PRINT/UPDATE/DELETE) */
              <Box>
                {/* Search and Action Bar */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                  <TextField
                    placeholder="Search company by name, code, GST, or city..."
                    size="small"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    sx={{ width: { xs: '100%', sm: 380 } }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ color: '#94a3b8' }} />
                        </InputAdornment>
                      )
                    }}
                  />

                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => navigate('/company-create')}
                      sx={{
                        borderColor: themeColors.primary,
                        color: themeColors.primary,
                        textTransform: 'none',
                        fontWeight: 700,
                        borderRadius: 1.5
                      }}
                    >
                      Add Company
                    </Button>
                    <Button
                      variant="text"
                      size="small"
                      onClick={fetchCompanies}
                      sx={{ color: '#64748b', textTransform: 'none', fontWeight: 600 }}
                    >
                      Refresh
                    </Button>
                  </Box>
                </Box>

                {loading ? (
                  <Box sx={{ textAlign: 'center', py: 8 }}>
                    <CircularProgress size={36} sx={{ color: themeColors.primary }} />
                    <Typography variant="body2" sx={{ mt: 2, color: '#64748b' }}>
                      Loading registered companies...
                    </Typography>
                  </Box>
                ) : companies.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 6, px: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px dashed #cbd5e1' }}>
                    <BusinessIcon sx={{ fontSize: 48, color: '#94a3b8', mb: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 700, color: themeColors.navy }}>
                      No Registered Companies Found
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748b', maxWidth: 450, mx: 'auto', mt: 1, mb: 3 }}>
                      Initialize the default standard BVC Company database or create a new company manually to begin.
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
                      <Button
                        variant="contained"
                        onClick={handleInitDefault}
                        disabled={initializing}
                        sx={{ bgcolor: themeColors.primary, textTransform: 'none', fontWeight: 700 }}
                      >
                        {initializing ? 'Initializing...' : 'Initialize Default Company'}
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={() => navigate('/company-create')}
                        sx={{ borderColor: themeColors.primary, color: themeColors.primary, textTransform: 'none', fontWeight: 700 }}
                      >
                        Create Company
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <TableContainer component={Paper} sx={{ boxShadow: 'none', border: `1px solid ${themeColors.border}`, borderRadius: 2, overflow: 'hidden' }}>
                    <Table>
                      <TableHead sx={{ bgcolor: themeColors.lighterBlue }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700, color: themeColors.primary }}>Company Name & Address</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: themeColors.primary }}>Code & GST</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: themeColors.primary }}>Contact & State</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: themeColors.primary, textAlign: 'center', width: 140 }}>
                            Action
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredCompanies.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} align="center" sx={{ py: 4, color: '#64748b' }}>
                              No companies match "{searchTerm}".
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredCompanies.map((comp) => {
                            const isSelected = selectedCompany?.id === comp.id;
                            return (
                              <TableRow
                                key={comp.id}
                                hover
                                sx={{
                                  bgcolor: isSelected ? 'rgba(219, 231, 251, 0.3)' : 'inherit',
                                  transition: 'background-color 0.15s'
                                }}
                              >
                                <TableCell>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: themeColors.navy }}>
                                    {comp.name || comp.company_name || `Company ${comp.id}`}
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.25 }}>
                                    {comp.address || comp.address1 || comp.location || comp.city || 'Tamil Nadu, India'}
                                  </Typography>
                                </TableCell>

                                <TableCell>
                                  <Typography variant="body2" sx={{ fontWeight: 600, color: themeColors.slate }}>
                                    Code: {comp.code || comp.company_code || comp.id}
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                                    GST: {comp.gst_number || comp.gst_no || comp.gstin || '-'}
                                  </Typography>
                                </TableCell>

                                <TableCell>
                                  <Typography variant="body2" sx={{ color: themeColors.slate }}>
                                    {comp.contact || comp.phone || comp.mobile || '-'}
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                                    {comp.state || 'Tamil Nadu'} ({comp.state_code || '33'})
                                  </Typography>
                                </TableCell>

                                <TableCell align="center">
                                  {/* ONLY ONE ACTION: LOGIN / SELECT */}
                                  <Button
                                    variant="contained"
                                    size="small"
                                    startIcon={<LoginIcon sx={{ fontSize: 16 }} />}
                                    onClick={() => handleSelectCompany(comp)}
                                    sx={{
                                      bgcolor: themeColors.primary,
                                      '&:hover': { bgcolor: themeColors.secondary },
                                      textTransform: 'none',
                                      fontWeight: 700,
                                      borderRadius: 1.5,
                                      px: 2
                                    }}
                                  >
                                    Login
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            ) : (
              /* TAB 2: SELECTED COMPANY LOGIN & SWAP VIEW */
              <Box sx={{ maxWidth: 520, mx: 'auto', py: 2 }}>
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      bgcolor: themeColors.lighterBlue,
                      color: themeColors.primary,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 1.5
                    }}
                  >
                    <LockIcon fontSize="large" />
                  </Box>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: themeColors.navy }}>
                    Sign in to {selectedCompany?.name || 'Company'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
                    Enter your user credentials to access {selectedCompany?.name}
                  </Typography>
                </Box>

                {loginError && (
                  <Alert severity="error" sx={{ mb: 2.5 }} onClose={() => setLoginError('')}>
                    {loginError}
                  </Alert>
                )}

                <Box component="form" onSubmit={handleQuickLogin}>
                  <TextField
                    fullWidth
                    label="Username"
                    margin="normal"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    autoFocus
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonIcon sx={{ color: '#94a3b8' }} />
                        </InputAdornment>
                      )
                    }}
                  />

                  <TextField
                    fullWidth
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    margin="normal"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockIcon sx={{ color: '#94a3b8' }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                            {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                  />

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1.5, mb: 1 }}>
                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                      Quick Fill Credentials:
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Chip 
                        size="small" 
                        label="Admin (admin / admin123)" 
                        onClick={() => { setLoginUsername('admin'); setLoginPassword('admin123'); }} 
                        clickable 
                        sx={{ fontSize: '0.75rem', bgcolor: themeColors.lighterBlue, color: themeColors.primary, fontWeight: 600 }}
                      />
                      <Chip 
                        size="small" 
                        label="Staff (staff / staff123)" 
                        onClick={() => { setLoginUsername('staff'); setLoginPassword('staff123'); }} 
                        clickable 
                        sx={{ fontSize: '0.75rem', bgcolor: '#f1f5f9', color: '#475569', fontWeight: 600 }}
                      />
                    </Box>
                  </Box>

                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    size="large"
                    disabled={loginLoading}
                    startIcon={loginLoading ? <CircularProgress size={20} color="inherit" /> : <LoginIcon />}
                    sx={{
                      bgcolor: themeColors.primary,
                      '&:hover': { bgcolor: themeColors.secondary },
                      py: 1.5,
                      mt: 2,
                      mb: 2,
                      fontWeight: 700,
                      fontSize: '1rem',
                      textTransform: 'none',
                      borderRadius: 1.5
                    }}
                  >
                    {loginLoading ? 'Authenticating...' : `Log In to ${selectedCompany?.name || 'Company'}`}
                  </Button>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                    <Button
                      variant="text"
                      startIcon={<SwapHorizIcon />}
                      onClick={handleSwapCompany}
                      sx={{ color: themeColors.primary, textTransform: 'none', fontWeight: 600 }}
                    >
                      Swap / Choose Another Company
                    </Button>

                    <Button
                      variant="text"
                      startIcon={<PersonAddIcon />}
                      onClick={() => navigate('/user/create', { state: { companyId: selectedCompany.id } })}
                      sx={{ color: '#64748b', textTransform: 'none', fontWeight: 600 }}
                    >
                      Create User
                    </Button>
                  </Box>
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* 4. ERP Modules Showcase Section */}
      <Box
        id="modules"
        sx={{
          py: { xs: 8, md: 10 },
          px: { xs: 3, md: 6 },
          bgcolor: 'white',
          borderTop: `1px solid ${themeColors.border}`
        }}
      >
        <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography variant="overline" sx={{ color: themeColors.primary, fontWeight: 800, letterSpacing: '1px' }}>
              POWERFUL SYSTEM MODULES
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 800, color: themeColors.navy, letterSpacing: '-0.5px' }}>
              Built for Manufacturing & Supply Chain
            </Typography>
            <Typography variant="body1" sx={{ color: '#64748b', maxWidth: 640, mx: 'auto', mt: 1 }}>
              Comprehensive modules engineered to handle high-volume grain intake, production planning, warehouse lots, and multi-tier distribution.
            </Typography>
          </Box>

          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%', border: `1px solid ${themeColors.border}`, borderRadius: 2.5, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                <CardContent sx={{ p: 3.5 }}>
                  <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#eff6ff', color: themeColors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                    <InventoryIcon />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: themeColors.navy, mb: 1 }}>
                    1. Procurement & Purchase
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748b', lineHeight: 1.6 }}>
                    Purchase orders, inward lab inspection, moisture testing, supplier ledgers, and return management with automated weighbridge data sync.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%', border: `1px solid ${themeColors.border}`, borderRadius: 2.5, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                <CardContent sx={{ p: 3.5 }}>
                  <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                    <FactoryIcon />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: themeColors.navy, mb: 1 }}>
                    2. Flour Milling & Papad Prod
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748b', lineHeight: 1.6 }}>
                    Grain issuance to flour mills, grinding work order slips, flour out returns, Papad In receipts, and final carton packing batch allocations.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%', border: `1px solid ${themeColors.border}`, borderRadius: 2.5, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                <CardContent sx={{ p: 3.5 }}>
                  <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#f0f9ff', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                    <KitchenIcon />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: themeColors.navy, mb: 1 }}>
                    3. Cold Storage & Godown
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748b', lineHeight: 1.6 }}>
                    Multi-chamber inventory allocation, pallet capacity monitoring, temperature verification logs, and inter-godown transfer vouchers.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%', border: `1px solid ${themeColors.border}`, borderRadius: 2.5, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                <CardContent sx={{ p: 3.5 }}>
                  <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                    <AssessmentIcon />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: themeColors.navy, mb: 1 }}>
                    4. Accounting & Day Book
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748b', lineHeight: 1.6 }}>
                    Debit & credit vouchers, real-time balance sheets, party ledgers with one-click statements, trial balances, and cash/bank flow books.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%', border: `1px solid ${themeColors.border}`, borderRadius: 2.5, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                <CardContent sx={{ p: 3.5 }}>
                  <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                    <LocalShippingIcon />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: themeColors.navy, mb: 1 }}>
                    5. Sales & Export Logistics
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748b', lineHeight: 1.6 }}>
                    Export orders, quotation management, domestic sales invoices, customer deductions, and transport vehicle movement passes.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%', border: `1px solid ${themeColors.border}`, borderRadius: 2.5, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                <CardContent sx={{ p: 3.5 }}>
                  <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#fdf2f8', color: '#db2777', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                    <ShieldIcon />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: themeColors.navy, mb: 1 }}>
                    6. Quality & Traceability
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748b', lineHeight: 1.6 }}>
                    Incoming quality reports (IQR), certificate of analysis (CoA), CCP monitoring logs, mock recall simulator, and compliance records.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </Box>

      {/* 5. About BVC Exports & QC Section */}
      <Box
        id="about"
        sx={{
          py: { xs: 8, md: 10 },
          px: { xs: 3, md: 6 },
          bgcolor: '#f8fafc',
          borderTop: `1px solid ${themeColors.border}`
        }}
      >
        <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography variant="overline" sx={{ color: themeColors.primary, fontWeight: 800, letterSpacing: '1px' }}>
                ABOUT THE ENTERPRISE
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 800, color: themeColors.navy, letterSpacing: '-0.5px', mb: 3 }}>
                Engineered for Integrity, Speed & Precision
              </Typography>
              <Typography variant="body1" sx={{ color: '#475569', lineHeight: 1.7, mb: 2 }}>
                BVC Exports is an industry-leading agro-processing and food manufacturing enterprise specializing in premium papads, flour milling, and high-standard grain processing.
              </Typography>
              <Typography variant="body1" sx={{ color: '#475569', lineHeight: 1.7, mb: 4 }}>
                The BVC ERP system acts as the digital backbone across our manufacturing plants, cold storages, quality labs, and administrative offices—empowering teams to operate with total traceability and financial accuracy.
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <CheckCircleIcon sx={{ color: themeColors.primary, mt: 0.25 }} />
                  <Typography variant="body2" sx={{ color: themeColors.slate, fontWeight: 600 }}>
                    Strict Role-Based Access Control (RBAC) ensuring user permissions are respected.
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <CheckCircleIcon sx={{ color: themeColors.primary, mt: 0.25 }} />
                  <Typography variant="body2" sx={{ color: themeColors.slate, fontWeight: 600 }}>
                    Tamper-proof audit trails for all creation, update, and voucher operations.
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <CheckCircleIcon sx={{ color: themeColors.primary, mt: 0.25 }} />
                  <Typography variant="body2" sx={{ color: themeColors.slate, fontWeight: 600 }}>
                    Zero risk on public portals: protected destructive actions restricted to internal admin tools.
                  </Typography>
                </Box>
              </Box>
            </Grid>

            <Grid item xs={12} md={6} id="compliance">
              <Card sx={{ bgcolor: themeColors.navy, color: 'white', borderRadius: 3, p: 4, boxShadow: '0 12px 36px rgba(15, 23, 42, 0.2)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <SecurityIcon sx={{ color: '#60a5fa', fontSize: 32 }} />
                  <Typography variant="h5" sx={{ fontWeight: 800, color: 'white' }}>
                    Quality & Regulatory Assurance
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: '#94a3b8', mb: 3, lineHeight: 1.6 }}>
                  Our automated compliance framework complies with global food safety standards, including HACCP, FSSAI, and ISO 22000 practices.
                </Typography>

                <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)', mb: 3 }} />

                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="h6" sx={{ color: '#38bdf8', fontWeight: 800 }}>
                      CCP / OPRP
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                      Automated hazard control logs
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="h6" sx={{ color: '#34d399', fontWeight: 800 }}>
                      ISO & FSSAI
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                      Audit-ready batch certifications
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="h6" sx={{ color: '#fbbf24', fontWeight: 800 }}>
                      Mock Recall
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                      30-minute full genealogy lookup
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="h6" sx={{ color: '#a78bfa', fontWeight: 800 }}>
                      Zero Data Loss
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                      Point-in-time recovery architecture
                    </Typography>
                  </Grid>
                </Grid>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </Box>

      {/* 6. Footer */}
      <Box
        component="footer"
        sx={{
          bgcolor: themeColors.navy,
          color: '#94a3b8',
          py: 6,
          px: { xs: 3, md: 6 },
          mt: 'auto',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)'
        }}
      >
        <Box sx={{ maxWidth: 1200, mx: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <BusinessIcon sx={{ color: '#60a5fa' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'white' }}>
              BVC EXPORTS ERP
            </Typography>
          </Box>

          <Typography variant="body2" sx={{ color: '#64748b' }}>
            © {new Date().getFullYear()} BVC Exports. All Rights Reserved. Enterprise Edition v2.4
          </Typography>

          <Box sx={{ display: 'flex', gap: 3 }}>
            <Button onClick={() => scrollToSection('hero')} sx={{ color: '#94a3b8', textTransform: 'none', fontSize: '0.85rem' }}>
              Back to Top
            </Button>
            <Button onClick={() => scrollToSection('company-portal')} sx={{ color: '#60a5fa', textTransform: 'none', fontSize: '0.85rem', fontWeight: 700 }}>
              Company Portal
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default CompanySelection;
