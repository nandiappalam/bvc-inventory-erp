import React, { useState, useEffect, useMemo } from 'react';
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
  Paper,
  Tabs,
  Tab,
  Chip,
  Switch,
  FormControlLabel,
  InputLabel,
  Tooltip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Stack,
  IconButton
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
  Settings as SettingsIcon,
  Palette as PaletteIcon,
  Business as BusinessIcon,
  Public as RegionalIcon,
  Tag as NumberingIcon,
  Inventory as InventoryIcon,
  ReceiptLong as TaxIcon,
  Security as SecurityIcon,
  NotificationsActive as NotificationsIcon,
  Storage as BackupIcon,
  Extension as IntegrationsIcon,
  Assessment as AuditIcon,
  Refresh as RefreshIcon,
  Lock as LockIcon,
  CheckCircle as CheckIcon,
  Contrast as DarkModeIcon,
  FormatSize as FontSizeIcon,
  Language as LanguageIcon,
  DensityMedium as DensityIcon,
  Restore as RestoreIcon,
  Check as SelectedCheckIcon
} from '@mui/icons-material';
import ViewControlToolbar from './ViewControlToolbar';
import { useAuth } from '../context/AuthContext';
import { useThemeConfig, COLOR_PALETTES } from '../context/ThemeContext';
import api from '../services/api.js';

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`setup-tabpanel-${index}`}
      aria-labelledby={`setup-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3, pb: 2 }}>{children}</Box>}
    </div>
  );
}

const GeneralSetup = () => {
  const navigate = useNavigate();
  const { selectedCompany, user } = useAuth();
  const { themeSettings, updateTheme, resetTheme } = useThemeConfig();

  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState('success');

  const isAdmin = useMemo(() => {
    if (!user) return true;
    const role = (user.role || '').toLowerCase();
    const uname = (user.username || '').toLowerCase();
    return role === 'admin' || uname === 'admin' || user.is_admin === true || user.is_admin === 1;
  }, [user]);

  const todayStr = useMemo(() => new Date().toLocaleDateString('en-GB').replace(/\//g, '-'), []);

  // Form State covering core legacy + 11 extended sections
  const [formData, setFormData] = useState({
    // Core Legacy setup fields
    current_date: todayStr,
    auto_backup: 'Yes',
    backup_subfolder: 'Yes',
    backup_path: 'C:\\BVC_ERP\\Backups',
    printer_path: 'CutePDF Writer',
    select_theme: themeSettings.color || 'Blue',
    credit_debit_instead: 'No',
    manual_voucher_no: 'No',
    use_voucher_print: 'No',
    date_locked_upto: '31-03-2017',
    reset_version_no: 'No',

    // Section 01: Appearance
    theme_color: themeSettings.color || 'Blue',
    appearance_mode: themeSettings.mode || 'light',
    screen_density: themeSettings.density || 'comfortable',
    font_size: themeSettings.fontSize || 'medium',
    display_language: themeSettings.language || 'en',

    // Section 02: Company & Organization
    company_name: selectedCompany?.name || 'BVC Exports Pvt. Ltd.',
    company_code: 'BVC-001',
    address_line1: 'Plot No. 42, Industrial Development Area',
    address_line2: 'SIPCOT Industrial Complex',
    city: 'Madurai',
    state: 'Tamil Nadu',
    pincode: '625001',
    gstin: '33AABCB1234F1Z5',
    pan_no: 'AABCB1234F',
    cin_no: 'U15310TN2020PTC134567',
    contact_email: 'info@bvcerp.com',
    contact_phone: '+91 452 2345678',
    bank_name: 'State Bank of India',
    bank_account_no: '382910482019',
    bank_ifsc: 'SBIN0001234',

    // Section 03: Regional & Financial
    currency_symbol: 'INR (₹)',
    date_format: 'DD-MM-YYYY',
    time_zone: 'Asia/Kolkata (IST +5:30)',
    decimal_precision: '2',
    financial_year_start: 'April',
    number_formatting: 'Lakhs/Crores (1,00,000)',

    // Section 04: Document Numbering
    prefix_pr: 'PR-2026-',
    prefix_po: 'PO-2026-',
    prefix_csi: 'CSI-',
    prefix_cso: 'CSO-',
    prefix_invoice: 'INV-',
    prefix_outpass: 'OUT-',
    prefix_inpass: 'INP-',
    prefix_voucher: 'VCH-',
    auto_reset_numbering: 'Annual',

    // Section 05: Inventory & Workflow
    default_godown: 'Factory Main Godown',
    stock_valuation_method: 'Weighted Average',
    negative_stock_policy: 'Block Transaction',
    purchase_approval_limit: '100000',
    sales_approval_limit: '250000',

    // Section 06: Tax & Charges
    gst_config_type: 'Regular',
    default_gst_rate: '5%',
    invoice_rounding_rule: 'Nearest Rupee',
    default_freight_head: 'Freight & Transportation Charges',
    default_labour_head: 'Loading & Unloading Labour Charges',

    // Section 07: Users & Security
    min_password_length: '8',
    password_expiry_days: '90',
    idle_session_timeout: '30 Minutes',
    failed_login_lockout: '5 Attempts',
    mfa_policy: 'Optional',

    // Section 08: Notifications
    in_app_alerts: 'Enabled',
    whatsapp_alerts: 'Enabled',
    sms_alerts: 'Disabled',
    email_reports: 'Daily Summary',
    low_stock_alert_threshold: '10%',

    // Section 09: Backup & Data
    backup_frequency: 'Daily at Midnight',
    backup_retention_days: '90',
    pdf_export_engine: 'CutePDF Writer',

    // Section 10: Integrations
    whatsapp_provider: 'Meta Cloud API',
    sms_provider: 'MSG91 Gateway',
    smtp_host: 'smtp.gmail.com',
    smtp_port: '587',

    // Section 11: Audit & Diagnostics
    app_version: 'BVC ERP v3.8.2 Enterprise',
    database_engine: 'SQLite / PostgreSQL Hybrid',
    system_status: '100% Operational',
  });

  // Fetch setup from backend on load
  useEffect(() => {
    fetchGeneralSetup();
  }, [selectedCompany]);

  const fetchGeneralSetup = async () => {
    setLoading(true);
    try {
      const companyId = selectedCompany?.id || 1;
      const res = await api.get(`/features/general-setup?company_id=${companyId}`);
      const data = res && res.data ? res.data : res;
      if (data && typeof data === 'object') {
        const extra = data.extra_settings_data || {};
        setFormData((prev) => ({
          ...prev,
          ...data,
          ...extra,
          select_theme: data.select_theme || themeSettings.color,
          theme_color: extra.theme_color || data.select_theme || themeSettings.color,
          appearance_mode: extra.appearance_mode || themeSettings.mode,
          screen_density: extra.screen_density || themeSettings.density,
          font_size: extra.font_size || themeSettings.fontSize,
          display_language: extra.display_language || themeSettings.language,
        }));

        // Sync loaded theme with theme context immediately
        const loadedColor = extra.theme_color || data.select_theme || 'Blue';
        const loadedMode = extra.appearance_mode || 'light';
        const loadedDensity = extra.screen_density || 'comfortable';
        const loadedFontSize = extra.font_size || 'medium';
        const loadedLanguage = extra.display_language || 'en';

        updateTheme({
          color: COLOR_PALETTES[loadedColor] ? loadedColor : 'Blue',
          mode: loadedMode,
          density: loadedDensity,
          fontSize: loadedFontSize,
          language: loadedLanguage,
        });
      }
    } catch (err) {
      console.error('Failed to load setup:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // If changing theme color, mode, density, font size live in Tab 0:
    if (name === 'theme_color' || name === 'select_theme') {
      const colorVal = COLOR_PALETTES[value] ? value : 'Blue';
      updateTheme({ color: colorVal });
    } else if (name === 'appearance_mode') {
      updateTheme({ mode: value });
    } else if (name === 'screen_density') {
      updateTheme({ density: value });
    } else if (name === 'font_size') {
      updateTheme({ fontSize: value });
    } else if (name === 'display_language') {
      updateTheme({ language: value });
    }
  };

  const handleColorSelect = (colorName) => {
    setFormData((prev) => ({ ...prev, theme_color: colorName, select_theme: colorName }));
    updateTheme({ color: colorName });
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const companyId = selectedCompany?.id || 1;
      const payload = {
        company_id: companyId,
        current_date: formData.current_date,
        auto_backup: formData.auto_backup,
        backup_subfolder: formData.backup_subfolder,
        backup_path: formData.backup_path,
        printer_path: formData.printer_path,
        select_theme: formData.theme_color || formData.select_theme,
        credit_debit_instead: formData.credit_debit_instead,
        manual_voucher_no: formData.manual_voucher_no,
        use_voucher_print: formData.use_voucher_print,
        date_locked_upto: formData.date_locked_upto,
        reset_version_no: formData.reset_version_no,
        extra_settings_data: formData,
      };

      const res = await api.post('/features/general-setup', payload);
      const isSuccess = res && (res.success === true || res.data?.success === true);

      if (isSuccess) {
        const msg = res.message || res.data?.message || 'General System Setup updated successfully!';
        setMessage(msg);
        setSeverity('success');

        // Ensure global theme context is synced persistently
        updateTheme({
          color: formData.theme_color,
          mode: formData.appearance_mode,
          density: formData.screen_density,
          fontSize: formData.font_size,
          language: formData.display_language,
        });
      } else {
        const errMsg = res?.message || res?.data?.message || 'Failed to update settings';
        setMessage(errMsg);
        setSeverity('error');
      }
    } catch (err) {
      console.error('Save error:', err);
      setMessage(err?.message || err?.response?.data?.message || 'Error saving setup');
      setSeverity('error');
    } finally {
      setSaving(false);
    }
  };

  const handleResetAppearance = () => {
    resetTheme();
    setFormData((prev) => ({
      ...prev,
      theme_color: 'Blue',
      select_theme: 'Blue',
      appearance_mode: 'light',
      screen_density: 'comfortable',
      font_size: 'medium',
      display_language: 'en',
    }));
    setMessage('Appearance reset to default BVC Blue theme');
    setSeverity('info');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading General System Setup...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      <ViewControlToolbar />

      {/* Header Banner */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: 2,
          background: (theme) =>
            theme.palette.mode === 'dark'
              ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          border: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/dashboard')}
            sx={{ borderRadius: 2 }}
          >
            Dashboard
          </Button>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <SettingsIcon color="primary" sx={{ fontSize: 28 }} />
              <Typography variant="h5" fontWeight={700}>
                General System Setup
              </Typography>
              <Chip
                label={isAdmin ? 'Administrator Access' : 'User Preference Mode'}
                color={isAdmin ? 'primary' : 'default'}
                size="small"
                variant="outlined"
                icon={isAdmin ? <CheckIcon /> : <LockIcon />}
              />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Central place to manage application theme, organization details, document rules & security settings
            </Typography>
          </Box>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="contained"
            color="primary"
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving}
            sx={{ px: 3, borderRadius: 2 }}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </Stack>
      </Paper>

      {message && (
        <Alert severity={severity} onClose={() => setMessage('')} sx={{ mb: 3, borderRadius: 2 }}>
          {message}
        </Alert>
      )}

      {/* Main Tabbed Interface */}
      <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Tabs
            value={activeTab}
            onChange={(e, val) => setActiveTab(val)}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="General Setup Tabs"
            sx={{
              '& .MuiTab-root': {
                fontWeight: 600,
                minHeight: 48,
                fontSize: '0.875rem',
                textTransform: 'none',
              },
            }}
          >
            <Tab icon={<PaletteIcon fontSize="small" />} iconPosition="start" label="01. Appearance & Theme" />
            <Tab icon={<BusinessIcon fontSize="small" />} iconPosition="start" label="02. Company & Org" />
            <Tab icon={<RegionalIcon fontSize="small" />} iconPosition="start" label="03. Regional & Financial" />
            <Tab icon={<NumberingIcon fontSize="small" />} iconPosition="start" label="04. Document Numbering" />
            <Tab icon={<InventoryIcon fontSize="small" />} iconPosition="start" label="05. Inventory & Workflow" />
            <Tab icon={<TaxIcon fontSize="small" />} iconPosition="start" label="06. Tax & Charges" />
            <Tab icon={<SecurityIcon fontSize="small" />} iconPosition="start" label="07. Users & Security" />
            <Tab icon={<NotificationsIcon fontSize="small" />} iconPosition="start" label="08. Notifications" />
            <Tab icon={<BackupIcon fontSize="small" />} iconPosition="start" label="09. Backup & Data" />
            <Tab icon={<IntegrationsIcon fontSize="small" />} iconPosition="start" label="10. Integrations & API" />
            <Tab icon={<AuditIcon fontSize="small" />} iconPosition="start" label="11. Audit & Diagnostics" />
          </Tabs>
        </Box>

        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          {/* TAB 01: APPEARANCE & THEME */}
          <TabPanel value={activeTab} index={0}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={7}>
                <Card variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PaletteIcon color="primary" /> THEME SETTINGS — COLOR PALETTE
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      Select a theme color below. The selected theme will apply instantly across all pages, navigation, tables, buttons, and status indicators.
                    </Typography>

                    <Grid container spacing={2} sx={{ mb: 3 }}>
                      {Object.keys(COLOR_PALETTES).map((colorKey) => {
                        const palette = COLOR_PALETTES[colorKey];
                        const isSelected = formData.theme_color === colorKey;

                        return (
                          <Grid item xs={6} sm={4} key={colorKey}>
                            <Paper
                              onClick={() => handleColorSelect(colorKey)}
                              elevation={isSelected ? 3 : 0}
                              sx={{
                                p: 2,
                                cursor: 'pointer',
                                border: '2px solid',
                                borderColor: isSelected ? palette.primary : 'divider',
                                borderRadius: 2,
                                transition: 'all 0.2s ease',
                                bgcolor: isSelected ? (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f8fafc' : 'background.paper',
                                '&:hover': {
                                  borderColor: palette.primary,
                                  transform: 'translateY(-2px)',
                                },
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                                <Typography variant="subtitle2" fontWeight={700}>
                                  {palette.name}
                                </Typography>
                                {isSelected && <SelectedCheckIcon sx={{ color: palette.primary, fontSize: 20 }} />}
                              </Box>

                              <Stack direction="row" spacing={0.75}>
                                <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: palette.primary }} />
                                <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: palette.secondary }} />
                                <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: palette.sidebarBg }} />
                              </Stack>
                            </Paper>
                          </Grid>
                        );
                      })}
                    </Grid>

                    <Divider sx={{ my: 3 }} />

                    <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <DarkModeIcon color="primary" /> APPEARANCE MODE & DISPLAY PREFERENCES
                    </Typography>

                    <Grid container spacing={2} sx={{ mt: 1 }}>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth size="small">
                          <InputLabel id="appearance-mode-label">Appearance Mode</InputLabel>
                          <Select
                            labelId="appearance-mode-label"
                            name="appearance_mode"
                            value={formData.appearance_mode}
                            label="Appearance Mode"
                            onChange={handleChange}
                          >
                            <MenuItem value="light">Light Mode (Classic White)</MenuItem>
                            <MenuItem value="dark">Dark Mode (Night ERP)</MenuItem>
                            <MenuItem value="system">System Default (Auto OS)</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth size="small">
                          <InputLabel id="density-label">Screen Density</InputLabel>
                          <Select
                            labelId="density-label"
                            name="screen_density"
                            value={formData.screen_density}
                            label="Screen Density"
                            onChange={handleChange}
                          >
                            <MenuItem value="comfortable">Comfortable (Standard Padding)</MenuItem>
                            <MenuItem value="compact">Compact (High Data Density)</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth size="small">
                          <InputLabel id="font-size-label">Font Size Scale</InputLabel>
                          <Select
                            labelId="font-size-label"
                            name="font_size"
                            value={formData.font_size}
                            label="Font Size Scale"
                            onChange={handleChange}
                          >
                            <MenuItem value="small">Small (13px Base)</MenuItem>
                            <MenuItem value="medium">Medium (14px Standard)</MenuItem>
                            <MenuItem value="large">Large (16px Enhanced Accessibility)</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth size="small">
                          <InputLabel id="language-label">Display Language</InputLabel>
                          <Select
                            labelId="language-label"
                            name="display_language"
                            value={formData.display_language}
                            label="Display Language"
                            onChange={handleChange}
                          >
                            <MenuItem value="en">English (US / India)</MenuItem>
                            <MenuItem value="hi">Hindi (हिंदी)</MenuItem>
                            <MenuItem value="ta">Tamil (தமிழ்)</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>

                    <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
                      <Button
                        variant="contained"
                        color="primary"
                        startIcon={<SaveIcon />}
                        onClick={handleSave}
                        disabled={saving}
                      >
                        Save Settings
                      </Button>
                      <Button
                        variant="outlined"
                        color="secondary"
                        startIcon={<RestoreIcon />}
                        onClick={handleResetAppearance}
                      >
                        Reset to Default
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              {/* Live Interactive Preview */}
              <Grid item xs={12} md={5}>
                <Card variant="outlined" sx={{ borderRadius: 2, position: 'sticky', top: 20 }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CheckIcon color="primary" /> Interactive Live Preview
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Changes update immediately across the live ERP interface.
                    </Typography>

                    <Paper
                      elevation={2}
                      sx={{
                        p: 2.5,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight={700} color="primary">
                          BVC ERP
                        </Typography>
                        <Chip label="Live Preview" color="primary" size="small" />
                      </Box>

                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid item xs={6}>
                          <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 1.5 }}>
                            <Typography variant="caption" color="text.secondary">Stock Summary</Typography>
                            <Typography variant="h5" fontWeight={700} color="primary">1,250</Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={6}>
                          <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 1.5 }}>
                            <Typography variant="caption" color="text.secondary">Pending Orders</Typography>
                            <Typography variant="h5" fontWeight={700} color="secondary">24</Typography>
                          </Paper>
                        </Grid>
                      </Grid>

                      <TextField
                        fullWidth
                        size="small"
                        label="Sample Input Field"
                        defaultValue="BVC Exports Pvt. Ltd."
                        sx={{ mb: 2 }}
                      />

                      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                        <Button variant="contained" color="primary" size="small">
                          Primary Action
                        </Button>
                        <Button variant="outlined" color="primary" size="small">
                          Secondary
                        </Button>
                      </Stack>

                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Item Code</TableCell>
                            <TableCell align="right">Qty</TableCell>
                            <TableCell align="right">Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          <TableRow>
                            <TableCell>GRN-RAW-01</TableCell>
                            <TableCell align="right">500 KG</TableCell>
                            <TableCell align="right">
                              <Chip label="Approved" color="success" size="small" />
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </Paper>

                    <Alert severity="info" sx={{ mt: 2, fontSize: '0.8rem' }}>
                      Selected theme is active globally across all modules, forms, popups, and dialogs.
                    </Alert>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>

          {/* TAB 02: COMPANY & ORGANIZATION */}
          <TabPanel value={activeTab} index={1}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BusinessIcon color="primary" /> Company Profile & Legal Registration
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Specify official organization details printed on invoices, purchase orders, reports, and tax filings.
                </Typography>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Company Registered Name"
                      name="company_name"
                      value={formData.company_name}
                      onChange={handleChange}
                      disabled={!isAdmin}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Company Short Code"
                      name="company_code"
                      value={formData.company_code}
                      onChange={handleChange}
                      disabled={!isAdmin}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Address Line 1"
                      name="address_line1"
                      value={formData.address_line1}
                      onChange={handleChange}
                      disabled={!isAdmin}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Address Line 2 / Industrial Estate"
                      name="address_line2"
                      value={formData.address_line2}
                      onChange={handleChange}
                      disabled={!isAdmin}
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label="City / Town"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      disabled={!isAdmin}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label="State"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      disabled={!isAdmin}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Pincode"
                      name="pincode"
                      value={formData.pincode}
                      onChange={handleChange}
                      disabled={!isAdmin}
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label="GSTIN Number"
                      name="gstin"
                      value={formData.gstin}
                      onChange={handleChange}
                      disabled={!isAdmin}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label="PAN Number"
                      name="pan_no"
                      value={formData.pan_no}
                      onChange={handleChange}
                      disabled={!isAdmin}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Corporate ID (CIN)"
                      name="cin_no"
                      value={formData.cin_no}
                      onChange={handleChange}
                      disabled={!isAdmin}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Official Email"
                      name="contact_email"
                      value={formData.contact_email}
                      onChange={handleChange}
                      disabled={!isAdmin}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Contact Phone / Mobile"
                      name="contact_phone"
                      value={formData.contact_phone}
                      onChange={handleChange}
                      disabled={!isAdmin}
                    />
                  </Grid>
                </Grid>

                <Divider sx={{ my: 3 }} />

                <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                  Primary Bank Account Details (Printed on Invoices)
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Bank Name"
                      name="bank_name"
                      value={formData.bank_name}
                      onChange={handleChange}
                      disabled={!isAdmin}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Account Number"
                      name="bank_account_no"
                      value={formData.bank_account_no}
                      onChange={handleChange}
                      disabled={!isAdmin}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label="IFSC Code"
                      name="bank_ifsc"
                      value={formData.bank_ifsc}
                      onChange={handleChange}
                      disabled={!isAdmin}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </TabPanel>

          {/* TAB 03: REGIONAL & FINANCIAL */}
          <TabPanel value={activeTab} index={2}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <RegionalIcon color="primary" /> Regional & Financial Year Configurations
                </Typography>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Base Currency</InputLabel>
                      <Select
                        name="currency_symbol"
                        value={formData.currency_symbol}
                        label="Base Currency"
                        onChange={handleChange}
                        disabled={!isAdmin}
                      >
                        <MenuItem value="INR (₹)">Indian Rupee - INR (₹)</MenuItem>
                        <MenuItem value="USD ($)">US Dollar - USD ($)</MenuItem>
                        <MenuItem value="EUR (€)">Euro - EUR (€)</MenuItem>
                        <MenuItem value="AED (🇦🇪)">UAE Dirham - AED (🇦🇪)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Date Format</InputLabel>
                      <Select
                        name="date_format"
                        value={formData.date_format}
                        label="Date Format"
                        onChange={handleChange}
                      >
                        <MenuItem value="DD-MM-YYYY">DD-MM-YYYY (e.g., 27-10-2026)</MenuItem>
                        <MenuItem value="YYYY-MM-DD">YYYY-MM-DD (e.g., 2026-10-27)</MenuItem>
                        <MenuItem value="MM/DD/YYYY">MM/DD/YYYY (e.g., 10/27/2026)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>System Time Zone</InputLabel>
                      <Select
                        name="time_zone"
                        value={formData.time_zone}
                        label="System Time Zone"
                        onChange={handleChange}
                        disabled={!isAdmin}
                      >
                        <MenuItem value="Asia/Kolkata (IST +5:30)">Asia/Kolkata (IST +5:30)</MenuItem>
                        <MenuItem value="UTC">UTC (Universal Time)</MenuItem>
                        <MenuItem value="America/New_York (EST)">America/New_York (EST)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Decimal Precision (Amounts)</InputLabel>
                      <Select
                        name="decimal_precision"
                        value={formData.decimal_precision}
                        label="Decimal Precision (Amounts)"
                        onChange={handleChange}
                      >
                        <MenuItem value="2">2 Decimals (0.00)</MenuItem>
                        <MenuItem value="3">3 Decimals (0.000 - Precision Stock)</MenuItem>
                        <MenuItem value="4">4 Decimals (0.0000 - Export Tariff)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Financial Year Start</InputLabel>
                      <Select
                        name="financial_year_start"
                        value={formData.financial_year_start}
                        label="Financial Year Start"
                        onChange={handleChange}
                        disabled={!isAdmin}
                      >
                        <MenuItem value="April">April 1st to March 31st (India FY)</MenuItem>
                        <MenuItem value="January">January 1st to December 31st (Calendar Year)</MenuItem>
                        <MenuItem value="July">July 1st to June 30th</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Number Formatting System</InputLabel>
                      <Select
                        name="number_formatting"
                        value={formData.number_formatting}
                        label="Number Formatting System"
                        onChange={handleChange}
                      >
                        <MenuItem value="Lakhs/Crores (1,00,000)">Indian (Lakhs & Crores: 1,00,000)</MenuItem>
                        <MenuItem value="Millions/Billions (100,000)">International (Thousands/Millions: 100,000)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </TabPanel>

          {/* TAB 04: DOCUMENT NUMBERING */}
          <TabPanel value={activeTab} index={3}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <NumberingIcon color="primary" /> Transaction Document Numbering & Auto-Sequences
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Configure prefixes for voucher generation across entry modules.
                </Typography>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Purchase Order Prefix"
                      name="prefix_po"
                      value={formData.prefix_po}
                      onChange={handleChange}
                      disabled={!isAdmin}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Purchase Request Prefix"
                      name="prefix_pr"
                      value={formData.prefix_pr}
                      onChange={handleChange}
                      disabled={!isAdmin}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Cold Storage Inward (CSI)"
                      name="prefix_csi"
                      value={formData.prefix_csi}
                      onChange={handleChange}
                      disabled={!isAdmin}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Cold Storage Outward (CSO)"
                      name="prefix_cso"
                      value={formData.prefix_cso}
                      onChange={handleChange}
                      disabled={!isAdmin}
                    />
                  </Grid>

                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Sales Invoice Prefix"
                      name="prefix_invoice"
                      value={formData.prefix_invoice}
                      onChange={handleChange}
                      disabled={!isAdmin}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Outpass / Gate Pass"
                      name="prefix_outpass"
                      value={formData.prefix_outpass}
                      onChange={handleChange}
                      disabled={!isAdmin}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Inpass Prefix"
                      name="prefix_inpass"
                      value={formData.prefix_inpass}
                      onChange={handleChange}
                      disabled={!isAdmin}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      size="small"
                      label="General Voucher Prefix"
                      name="prefix_voucher"
                      value={formData.prefix_voucher}
                      onChange={handleChange}
                      disabled={!isAdmin}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </TabPanel>

          {/* TAB 05: INVENTORY & WORKFLOW */}
          <TabPanel value={activeTab} index={4}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <InventoryIcon color="primary" /> Inventory Controls & Approval Rules
                </Typography>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Default Godown Location</InputLabel>
                      <Select
                        name="default_godown"
                        value={formData.default_godown}
                        label="Default Godown Location"
                        onChange={handleChange}
                      >
                        <MenuItem value="Factory Main Godown">Factory Main Godown</MenuItem>
                        <MenuItem value="Cold Storage Godown 1">Cold Storage Godown 1</MenuItem>
                        <MenuItem value="Finished Goods Store">Finished Goods Store</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Stock Valuation Method</InputLabel>
                      <Select
                        name="stock_valuation_method"
                        value={formData.stock_valuation_method}
                        label="Stock Valuation Method"
                        onChange={handleChange}
                        disabled={!isAdmin}
                      >
                        <MenuItem value="Weighted Average">Weighted Average Cost (Recommended)</MenuItem>
                        <MenuItem value="FIFO">First-In First-Out (FIFO)</MenuItem>
                        <MenuItem value="LIFO">Last-In First-Out (LIFO)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Negative Stock Policy</InputLabel>
                      <Select
                        name="negative_stock_policy"
                        value={formData.negative_stock_policy}
                        label="Negative Stock Policy"
                        onChange={handleChange}
                        disabled={!isAdmin}
                      >
                        <MenuItem value="Block Transaction">Strict: Block Negative Stock Sales</MenuItem>
                        <MenuItem value="Warning Only">Warning Only: Allow with Alert</MenuItem>
                        <MenuItem value="Allow">Permissive: Allow Negative Quantities</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="PO Mandatory Approval Limit (₹)"
                      name="purchase_approval_limit"
                      value={formData.purchase_approval_limit}
                      onChange={handleChange}
                      disabled={!isAdmin}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </TabPanel>

          {/* TAB 06: TAX & CHARGES */}
          <TabPanel value={activeTab} index={5}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TaxIcon color="primary" /> Tax Setup & Master Charges Rules
                </Typography>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>GST Registration Type</InputLabel>
                      <Select
                        name="gst_config_type"
                        value={formData.gst_config_type}
                        label="GST Registration Type"
                        onChange={handleChange}
                        disabled={!isAdmin}
                      >
                        <MenuItem value="Regular">Regular Taxpayer (CGST/SGST/IGST)</MenuItem>
                        <MenuItem value="Composition">Composition Scheme</MenuItem>
                        <MenuItem value="SEZ / Export">SEZ / 100% Export Unit</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Default Tax Rate</InputLabel>
                      <Select
                        name="default_gst_rate"
                        value={formData.default_gst_rate}
                        label="Default Tax Rate"
                        onChange={handleChange}
                      >
                        <MenuItem value="0%">0% Exempted</MenuItem>
                        <MenuItem value="5%">5% Standard Raw Food</MenuItem>
                        <MenuItem value="12%">12% Processed Food</MenuItem>
                        <MenuItem value="18%">18% Services & Goods</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Default Freight Charges Ledger"
                      name="default_freight_head"
                      value={formData.default_freight_head}
                      onChange={handleChange}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Default Labour Charges Ledger"
                      name="default_labour_head"
                      value={formData.default_labour_head}
                      onChange={handleChange}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </TabPanel>

          {/* TAB 07: USERS & SECURITY */}
          <TabPanel value={activeTab} index={6}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SecurityIcon color="primary" /> Security Policies & Password Rules
                </Typography>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Minimum Password Length</InputLabel>
                      <Select
                        name="min_password_length"
                        value={formData.min_password_length}
                        label="Minimum Password Length"
                        onChange={handleChange}
                        disabled={!isAdmin}
                      >
                        <MenuItem value="6">6 Characters</MenuItem>
                        <MenuItem value="8">8 Characters (Recommended)</MenuItem>
                        <MenuItem value="12">12 Characters (High Security)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Session Timeout</InputLabel>
                      <Select
                        name="idle_session_timeout"
                        value={formData.idle_session_timeout}
                        label="Session Timeout"
                        onChange={handleChange}
                      >
                        <MenuItem value="15 Minutes">15 Minutes</MenuItem>
                        <MenuItem value="30 Minutes">30 Minutes (Default)</MenuItem>
                        <MenuItem value="1 Hour">1 Hour</MenuItem>
                        <MenuItem value="Disabled">Never Timeout</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </TabPanel>

          {/* TAB 08: NOTIFICATIONS */}
          <TabPanel value={activeTab} index={7}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <NotificationsIcon color="primary" /> Alerts & Integration Gateway Notifications
                </Typography>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>In-App Badge Alerts</InputLabel>
                      <Select
                        name="in_app_alerts"
                        value={formData.in_app_alerts}
                        label="In-App Badge Alerts"
                        onChange={handleChange}
                      >
                        <MenuItem value="Enabled">Enabled (Stock & Approvals)</MenuItem>
                        <MenuItem value="Disabled">Disabled</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>WhatsApp PO & Invoice Gateway</InputLabel>
                      <Select
                        name="whatsapp_alerts"
                        value={formData.whatsapp_alerts}
                        label="WhatsApp PO & Invoice Gateway"
                        onChange={handleChange}
                      >
                        <MenuItem value="Enabled">Enabled (Dispatch Auto Alerts)</MenuItem>
                        <MenuItem value="Disabled">Disabled</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </TabPanel>

          {/* TAB 09: BACKUP & DATA */}
          <TabPanel value={activeTab} index={8}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BackupIcon color="primary" /> Database Backup & Local Storage Policy
                </Typography>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Automatic Database Backup</InputLabel>
                      <Select
                        name="auto_backup"
                        value={formData.auto_backup}
                        label="Automatic Database Backup"
                        onChange={handleChange}
                        disabled={!isAdmin}
                      >
                        <MenuItem value="Yes">Yes (Automated Daily Schedule)</MenuItem>
                        <MenuItem value="No">No (Manual Only)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Backup Directory Path"
                      name="backup_path"
                      value={formData.backup_path}
                      onChange={handleChange}
                      disabled={!isAdmin}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Default PDF Printer Driver"
                      name="printer_path"
                      value={formData.printer_path}
                      onChange={handleChange}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </TabPanel>

          {/* TAB 10: INTEGRATIONS */}
          <TabPanel value={activeTab} index={9}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <IntegrationsIcon color="primary" /> External API & Communication Gateways
                </Typography>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="WhatsApp API Gateway Provider"
                      name="whatsapp_provider"
                      value={formData.whatsapp_provider}
                      onChange={handleChange}
                      disabled={!isAdmin}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="SMTP Email Host"
                      name="smtp_host"
                      value={formData.smtp_host}
                      onChange={handleChange}
                      disabled={!isAdmin}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </TabPanel>

          {/* TAB 11: AUDIT & DIAGNOSTICS */}
          <TabPanel value={activeTab} index={10}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AuditIcon color="primary" /> System Health & Audit Information
                </Typography>

                <Paper sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2, mb: 3 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <Typography variant="caption" color="text.secondary">Application Version</Typography>
                      <Typography variant="subtitle1" fontWeight={700}>{formData.app_version}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Typography variant="caption" color="text.secondary">Active Engine</Typography>
                      <Typography variant="subtitle1" fontWeight={700}>{formData.database_engine}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Typography variant="caption" color="text.secondary">System Status</Typography>
                      <Chip label={formData.system_status} color="success" size="small" />
                    </Grid>
                  </Grid>
                </Paper>

                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                  Recent System Setup Changes Audit Log
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Timestamp</TableCell>
                      <TableCell>User</TableCell>
                      <TableCell>Setting Category</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>{todayStr} 10:30 AM</TableCell>
                      <TableCell>{user?.username || 'admin'}</TableCell>
                      <TableCell>Appearance & Theme</TableCell>
                      <TableCell><Chip label="Active" color="primary" size="small" /></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  );
};

export default GeneralSetup;
