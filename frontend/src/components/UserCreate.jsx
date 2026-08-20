import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth, MODULE_CATEGORIES } from '../context/AuthContext';
import api from '../services/api.js';
import {
  Box, Card, CardContent, Typography, TextField, Button, Grid,
  FormControl, InputLabel, Select, MenuItem, Checkbox, CircularProgress,
  Alert, Accordion, AccordionSummary, AccordionDetails, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const themeColors = {
  primary: '#1f4fb2',
  secondary: '#2a5ea0',
  lightBlue: '#dbe7fb',
  white: '#ffffff',
  textPrimary: '#333333'
};

const PERMISSION_ACTIONS = [
  { key: 'can_view', label: 'View', color: '#4caf50' },
  { key: 'can_create', label: 'Create', color: '#2196f3' },
  { key: 'can_edit', label: 'Edit', color: '#ff9800' },
  { key: 'can_delete', label: 'Delete', color: '#f44336' },
  { key: 'can_print', label: 'Print', color: '#9c27b0' }
];

const CATEGORY_CONFIG = {
  MASTER: { label: '🟦 Master Modules', color: '#1f4fb2', expandedDefault: true },
  ENTRY: { label: '🟢 Entry Modules', color: '#2e7d32', expandedDefault: true },
  QUALITY: { label: '🟠 Quality Control Modules', color: '#d32f2f', expandedDefault: true },
  REPORTS: { label: '🟣 Report Modules', color: '#7b1fa2', expandedDefault: false },
  ACCOUNTS: { label: '🟡 Accounts Modules', color: '#ed6c02', expandedDefault: false },
  FEATURES: { label: '⚙️ Features & System Modules', color: '#0288d1', expandedDefault: false },
  COMPANY: { label: '🏢 Company Submenu Modules', color: '#388e3c', expandedDefault: false }
};

const UserCreate = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { user, selectedCompany, isAdmin, permissions } = useAuth();
  const [isFirstUser, setIsFirstUser] = useState(false);
  const isEditing = userId && userId !== 'null' && userId !== 'undefined' && userId !== '';
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [companies, setCompanies] = useState([]);
  const [expandedCategories, setExpandedCategories] = useState({
    MASTER: true,
    ENTRY: true,
    QUALITY: true,
    REPORTS: false,
    ACCOUNTS: false,
    FEATURES: false,
    COMPANY: false
  });

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    role: 'Admin',
    status: 'Active',
    company_id: selectedCompany?.id ? String(selectedCompany.id) : '',
    permissions: {}
  });

  // Fetch companies on mount
  useEffect(() => { 
    fetchCompanies(); 
  }, []);

  const companyInitialized = React.useRef(false);
  
  useEffect(() => {
    if (companies.length > 0 && !companyInitialized.current) {
      companyInitialized.current = true;
      
      if (selectedCompany && selectedCompany.id) {
        const companyExists = companies.some(c => c.id === selectedCompany.id);
        if (companyExists) {
          setFormData(prev => ({ ...prev, company_id: String(selectedCompany.id) }));
        } else {
          setFormData(prev => ({ ...prev, company_id: String(companies[0].id) }));
        }
      } else {
        setFormData(prev => ({ ...prev, company_id: String(companies[0].id) }));
      }
    }
  }, [companies, selectedCompany]);

  useEffect(() => { if (isEditing && userId) fetchUser(); }, [userId]);

  useEffect(() => {
    const checkFirstUser = async () => {
      const companyData = selectedCompany;
      if (companyData && companyData.id) {
        try {
          const users = await api(`/auth/users/${companyData.id}`);
          if (Array.isArray(users) && users.length === 0) {
            setIsFirstUser(true);
            setFormData(prev => ({ ...prev, company_id: String(companyData.id), role: 'Admin' }));
          }
        } catch (e) { console.error('Error checking users:', e); }
      }
    };
    checkFirstUser();
  }, [selectedCompany]);

  const fetchCompanies = async () => {
    try {
      const data = await api('/companies');
      console.log('Companies fetched:', data);
      if (Array.isArray(data) && data.length > 0) {
        setCompanies(data);
        if (!formData.company_id) {
          const targetId = selectedCompany?.id ? String(selectedCompany.id) : String(data[0].id);
          setFormData(prev => ({ ...prev, company_id: targetId }));
        }
      }
    } catch (e) { 
      console.error('Error fetching companies:', e); 
    }
  };

  const fetchUser = async () => {
    try {
      setLoading(true);
      const companyIdToUse = selectedCompany?.id || formData.company_id || 1;
      const response = await api(`/auth/users/${companyIdToUse}/${userId}`);
      if (response && (response.id || response.username)) {
        const data = response;
        const structuredPerms = {};
        (data.permissions || []).forEach(perm => {
          if (!structuredPerms[perm.module_name]) structuredPerms[perm.module_name] = {};
          structuredPerms[perm.module_name][perm.page_name] = {
            can_view: perm.can_view,
            can_create: perm.can_create,
            can_edit: perm.can_edit,
            can_delete: perm.can_delete,
            can_print: perm.can_print
          };
        });
        setFormData({
          username: data.username,
          password: '',
          confirmPassword: '',
          role: data.role,
          status: data.status,
          company_id: String(data.company_id || selectedCompany?.id || ''),
          permissions: structuredPerms
        });
      } else {
        setError(response?.message || 'Failed to fetch user');
      }
    } catch (e) { setError('Error connecting to server'); }
    finally { setLoading(false); }
  };

  const canManageUsers = !user || isFirstUser || isAdmin || permissions.some(p => p.module_name === 'User' && p.page_name === 'Create' && p.can_create === 1);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAccordionChange = (category) => (event, isExpanded) => {
    setExpandedCategories(prev => ({ ...prev, [category]: isExpanded }));
  };

  const handlePermissionChange = (moduleName, pageName, actionKey, checked) => {
    setFormData(prev => {
      const currentPerms = { ...prev.permissions };
      if (!currentPerms[moduleName]) currentPerms[moduleName] = {};
      if (!currentPerms[moduleName][pageName]) currentPerms[moduleName][pageName] = { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, can_print: 0 };
      currentPerms[moduleName][pageName][actionKey] = checked ? 1 : 0;
      return { ...prev, permissions: currentPerms };
    });
  };

  const hasPermission = (moduleName, pageName, actionKey) => {
    const modulePerms = formData.permissions[moduleName];
    if (!modulePerms || !modulePerms[pageName]) return false;
    return modulePerms[pageName][actionKey] === 1;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.username.trim()) { setError('Username is required'); return; }
    if (!isEditing && !formData.password) { setError('Password is required'); return; }
    if (formData.password && formData.password.length < 3) { setError('Password must be at least 3 characters'); return; }
    if (formData.password !== formData.confirmPassword) { setError('Passwords do not match'); return; }

    try {
      setSaving(true);
      const companyIdValue = formData.company_id || selectedCompany?.id;
      if (!companyIdValue) { setError('No company selected'); setSaving(false); return; }

      const permissionsArray = [];
      Object.entries(formData.permissions).forEach(([moduleName, pagePerms]) => {
        Object.entries(pagePerms).forEach(([pageName, actions]) => {
          if (actions.can_view || actions.can_create || actions.can_edit || actions.can_delete || actions.can_print) {
            permissionsArray.push({ module_name: moduleName, page_name: pageName, ...actions });
          }
        });
      });

      // If no permissions were explicitly selected for a non-admin role, grant default full view/create permissions
      if (permissionsArray.length === 0 && formData.role !== 'Admin') {
        Object.values(MODULE_CATEGORIES).flat().forEach(modName => {
          permissionsArray.push({ module_name: modName, page_name: 'Create', can_view: 1, can_create: 1, can_edit: 1, can_delete: 1, can_print: 1 });
          permissionsArray.push({ module_name: modName, page_name: 'Display', can_view: 1, can_create: 1, can_edit: 1, can_delete: 1, can_print: 1 });
        });
      }

      const payload = {
        username: formData.username.trim(),
        role: formData.role,
        status: formData.status,
        company_id: parseInt(companyIdValue, 10),
        permissions: permissionsArray
      };
      if (formData.password) payload.password = formData.password;

      const url = isEditing ? `/auth/users/${userId}` : '/auth/users';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await api(url, {
        method,
        body: payload
      });

      if (response && (response.id || response.message?.includes('success') || response.success !== false)) {
        const msg = isEditing ? 'User updated successfully!' : `User "${formData.username.trim()}" created successfully!`;
        setSuccess(msg);
        alert(msg);
        if (isFirstUser || !user) {
          navigate('/login');
        } else {
          navigate('/master/user-display');
        }
      } else {
        setError(response?.message || 'Operation failed');
      }
    } catch (e) { 
      console.error('Error submitting user:', e);
      setError('Error connecting to server'); 
    }
    finally { setSaving(false); }
  };

  const handleBack = () => {
    if (isFirstUser || !user) navigate('/auth-choice');
    else navigate('/master/user-display');
  };

  const renderModulePermissionTable = (category) => {
    const categoryModules = MODULE_CATEGORIES[category] || [];
    return (
      <>
        <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: themeColors.lightBlue }}>
                <TableCell sx={{ fontWeight: 'bold', width: '20%' }}>Module Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }} colSpan={5}>Page: Create</TableCell>
              </TableRow>
              <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                <TableCell></TableCell>
                {PERMISSION_ACTIONS.map(action => (
                  <TableCell key={`create-${action.key}`} sx={{ textAlign: 'center', color: action.color, fontWeight: 'bold' }}>
                    {action.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {categoryModules.map(module => (
                <TableRow key={`${module}-create`}>
                  <TableCell sx={{ fontWeight: 500 }}>{module}</TableCell>
                  {PERMISSION_ACTIONS.map(action => (
                    <TableCell key={`${module}-create-${action.key}`} sx={{ textAlign: 'center' }}>
                      <Checkbox
                        checked={hasPermission(module, 'Create', action.key)}
                        onChange={(e) => handlePermissionChange(module, 'Create', action.key, e.target.checked)}
                        size="small"
                        sx={{ color: action.color, '&.Mui-checked': { color: action.color } }}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#e8f5e9' }}>
                <TableCell sx={{ fontWeight: 'bold', width: '20%' }}>Module Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }} colSpan={5}>Page: Display</TableCell>
              </TableRow>
              <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                <TableCell></TableCell>
                {PERMISSION_ACTIONS.map(action => (
                  <TableCell key={`display-${action.key}`} sx={{ textAlign: 'center', color: action.color, fontWeight: 'bold' }}>
                    {action.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {categoryModules.map(module => (
                <TableRow key={`${module}-display`}>
                  <TableCell sx={{ fontWeight: 500 }}>{module}</TableCell>
                  {PERMISSION_ACTIONS.map(action => (
                    <TableCell key={`${module}-display-${action.key}`} sx={{ textAlign: 'center' }}>
                      <Checkbox
                        checked={hasPermission(module, 'Display', action.key)}
                        onChange={(e) => handlePermissionChange(module, 'Display', action.key, e.target.checked)}
                        size="small"
                        sx={{ color: action.color, '&.Mui-checked': { color: action.color } }}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </>
    );
  };

  if (!canManageUsers) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">You don't have permission to manage users.</Alert>
      </Box>
    );
  }
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1600, margin: '0 auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={handleBack} sx={{ mr: 2, color: themeColors.textPrimary }}>
          Back
        </Button>
        <Typography variant="h5" sx={{ fontWeight: 'bold', color: themeColors.primary }}>
          {isEditing ? ' Update User' : 'Create New User'}
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, color: themeColors.primary }}>🧾 User Details</Typography>
                <TextField fullWidth label="Username" name="username" value={formData.username} onChange={handleChange} margin="normal" required disabled={isEditing} />
                <FormControl fullWidth margin="normal">
                  <InputLabel>Company</InputLabel>
                  <Select 
                    name="company_id" 
                    value={formData.company_id} 
                    onChange={handleChange} 
                    label="Company" 
                    required
                    // Add displayEmpty to allow empty value without warning
                    displayEmpty
                  >
                    {companies.map(company => (
                      <MenuItem key={company.id} value={String(company.id)}>{company.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField fullWidth label="Password" name="password" type="password" value={formData.password} onChange={handleChange} margin="normal" required={!isEditing} helperText={isEditing ? 'Leave blank to keep current password' : ''} />
                <TextField fullWidth label="Confirm Password" name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} margin="normal" required={!isEditing && !!formData.password} />
                <FormControl fullWidth margin="normal">
                  <InputLabel>Role</InputLabel>
                  <Select name="role" value={formData.role} onChange={handleChange} label="Role">
                    <MenuItem value="Admin">Admin</MenuItem>
                    <MenuItem value="Staff">Staff</MenuItem>
                    <MenuItem value="User">User</MenuItem>
                  </Select>
                </FormControl>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Status</InputLabel>
                  <Select name="status" value={formData.status} onChange={handleChange} label="Status">
                    <MenuItem value="Active">Active</MenuItem>
                    <MenuItem value="Inactive">Inactive</MenuItem>
                  </Select>
                </FormControl>
                {formData.role === 'Admin' && <Alert severity="info" sx={{ mt: 2 }}>Admin users have full access.</Alert>}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={8}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, color: themeColors.primary }}>🛡 Module Permissions</Typography>
                {formData.role === 'Admin' ? (
                  <Alert severity="info">Admin role has full access.</Alert>
                ) : (
                  <Box sx={{ maxHeight: '70vh', overflowY: 'auto' }}>
                    {Object.entries(CATEGORY_CONFIG).map(([categoryKey, config]) => {
                      const categoryModules = MODULE_CATEGORIES[categoryKey];
                      if (!categoryModules || categoryModules.length === 0) return null;
                      return (
                        <Accordion
                          key={categoryKey}
                          expanded={expandedCategories[categoryKey] || false}
                          onChange={handleAccordionChange(categoryKey)}
                          sx={{ mb: 1, border: `1px solid ${config.color}30` }}
                        >
                          <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            sx={{ bgcolor: `${config.color}10`, '&:hover': { bgcolor: `${config.color}20` } }}
                          >
                            <Typography sx={{ fontWeight: 'bold', color: config.color }}>
                              {config.label} ({categoryModules.length} modules)
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails sx={{ p: 0 }}>
                            {renderModulePermissionTable(categoryKey)}
                          </AccordionDetails>
                        </Accordion>
                      );
                    })}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button variant="outlined" onClick={handleBack} sx={{ borderColor: themeColors.textPrimary, color: themeColors.textPrimary }}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={saving}
                sx={{ backgroundColor: themeColors.primary, '&:hover': { backgroundColor: themeColors.secondary } }}
              >
                {saving ? <CircularProgress size={24} /> : (isEditing ? 'Update User' : 'Create User')}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </form>
    </Box>
  );
};

export default UserCreate;
