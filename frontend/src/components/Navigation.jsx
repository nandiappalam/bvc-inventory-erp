import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Collapse,
  IconButton,
  Box,
  Tooltip,
} from '@mui/material';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import LogoutIcon from '@mui/icons-material/Logout';
import CalculateIcon from '@mui/icons-material/Calculate';
import RecyclingIcon from '@mui/icons-material/Recycling';
import CalculatorModal from './CalculatorModal';
import RecycleBinModal from './RecycleBinModal';
import StockAlertBell from './StockAlert/StockAlertBell';
import SystemStatus from './SystemStatus';
import { useAuth, MODULE_CATEGORIES, PERMISSION_TYPES } from '../context/AuthContext';

// ERP Theme Colors
const themeColors = {
  primary: '#1f4fb2',
  secondary: '#2a5ea0',
  lightBlue: '#dbe7fb',
  lighterBlue: '#eaf2fb',
  white: '#ffffff',
  textPrimary: '#333333',
};

// Module name mapping for permissions
const modulePermissionMap = {
  'Advance': 'Advance',
  'Flour Out': 'Flour Out',
  'Flour Out Return': 'Flour Out Return',
  'Work Order Slip': 'Grind',
  'Grind': 'Grind',
  'Papad In': 'Papad In',
  'Papad Return': 'Papad Return',
  'Cheque Printing': 'Cheque Printing',
  'Packing': 'Packing',
  'Purchase': 'Purchase',
  'Purchase Request': 'Purchase Request',
  'Purchase Order': 'Purchase Order',
  'Purchase Return': 'Purchase Return',
  'Quality Control': 'Quality Control',
  'Incoming Quality': 'Incoming Quality',
  'Open': 'Open',
  'Quotation': 'Quotation',
  'Sales': 'Sales',
  'Sales Order': 'Sales Order',
  'Sales Export': 'Sales Export',
  'Sales Export Order': 'Sales Export Order',
  'Sales Return': 'Sales Return',
  'Stock Adjust': 'Stock Adjust',
  'Weight Conversion': 'Weight Conversion',
  'Voucher': 'Voucher',
  'Vehicle Movement': 'Vehicle Movement',
  // Master
  'Item': 'Item',
  'Item Group': 'Item Group',
  'Customer': 'Customer',
  'Suppliers': 'Supplier',
  'Supplier': 'Supplier',
  'Flour Mill': 'Flour Mill',
  'Papad Company': 'Papad Company',
  'Weight': 'Weight',
  'Ledger Group': 'Ledger Group',
  'Ledger': 'Ledger',
  'Area': 'Area',
  'City': 'City',
  'Consignee': 'Consignee',
  'P.Trans': 'P.Trans',
  'Sender': 'Sender',
  'Transport': 'Transport',
  'Godown': 'Godown',
  'Tax': 'Tax',
  'Deduction Sales': 'Deduction Sales',
  'Deduction Purchase': 'Deduction Purchase',
};

const EntryModuleItem = ({ module, actions, generatePath, toggleDrawer, hasPermission, isAdmin }) => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const permissionModule = modulePermissionMap[module];

  const moduleActions = module === 'Purchase Request' 
    ? ['Create', 'Display', 'Approval', 'Reports', 'Dashboard'] 
    : actions;

  // Check if user has any permission for this module
  if (!isAdmin && permissionModule && !hasPermission(permissionModule, PERMISSION_TYPES.VIEW)) {
    return null;
  }

  const handleClick = () => {
    setOpen(!open);
  };

  // Check if any child is active
  const isActive = moduleActions.some(action => {
    const path = generatePath('entry', module, action)
    return location.pathname === path
  });

  return (
    <>
      <ListItemButton 
        onClick={handleClick} 
        sx={{ 
          pl: 4,
          backgroundColor: open || isActive ? themeColors.lighterBlue : 'transparent',
          '&:hover': {
            backgroundColor: themeColors.lightBlue,
          }
        }}
      >
        <ListItemText 
          primary={module} 
          primaryTypographyProps={{
            fontSize: '13px',
            fontWeight: isActive ? 'bold' : 'normal',
            color: isActive ? themeColors.primary : themeColors.textPrimary,
          }}
        />
        {open ? <ExpandLess sx={{ color: themeColors.primary }} /> : <ExpandMore sx={{ color: themeColors.primary }} />}
      </ListItemButton>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <List component="div" disablePadding>
          {moduleActions.map((action) => {
            const path = generatePath('entry', module, action)
            const isItemActive = location.pathname === path
            
            // Check specific permission based on action
            let canAccess = isAdmin;
            if (!isAdmin && permissionModule) {
              if (action === 'Create') {
                canAccess = hasPermission(permissionModule, PERMISSION_TYPES.CREATE);
              } else {
                canAccess = hasPermission(permissionModule, PERMISSION_TYPES.VIEW);
              }
            }

            if (!canAccess) return null;

            return (
              <ListItemButton
                key={`${module}-${action}`}
                component={Link}
                to={path}
                onClick={toggleDrawer}
                sx={{ 
                  pl: 6,
                  backgroundColor: isItemActive ? themeColors.primary : 'transparent',
                  '&:hover': {
                    backgroundColor: themeColors.lightBlue,
                  }
                }}
              >
                <ListItemText 
                  primary={action}
                  primaryTypographyProps={{
                    fontSize: '12px',
                    fontWeight: isItemActive ? 'bold' : 'normal',
                    color: isItemActive ? themeColors.white : themeColors.textPrimary,
                  }}
                />
              </ListItemButton>
            )
          })}
        </List>
      </Collapse>
    </>
  )
}

const MasterModuleItem = ({ module, actions, generatePath, toggleDrawer, hasPermission, isAdmin }) => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const permissionModule = modulePermissionMap[module];

  // Check if user has any permission for this module
  if (!isAdmin && permissionModule && !hasPermission(permissionModule, PERMISSION_TYPES.VIEW)) {
    return null;
  }

  const handleClick = () => {
    setOpen(!open);
  };

  // Check if any child is active
  const isActive = actions.some(action => {
    const path = generatePath('master', module, action)
    return location.pathname === path
  });

  return (
    <>
      <ListItemButton 
        onClick={handleClick} 
        sx={{ 
          pl: 4,
          backgroundColor: open || isActive ? themeColors.lighterBlue : 'transparent',
          '&:hover': {
            backgroundColor: themeColors.lightBlue,
          }
        }}
      >
        <ListItemText 
          primary={module}
          primaryTypographyProps={{
            fontSize: '13px',
            fontWeight: isActive ? 'bold' : 'normal',
            color: isActive ? themeColors.primary : themeColors.textPrimary,
          }}
        />
        {open ? <ExpandLess sx={{ color: themeColors.primary }} /> : <ExpandMore sx={{ color: themeColors.primary }} />}
      </ListItemButton>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <List component="div" disablePadding>
          {actions.map((action) => {
            const path = generatePath('master', module, action)
            const isItemActive = location.pathname === path

            // Check specific permission based on action
            let canAccess = isAdmin;
            if (!isAdmin && permissionModule) {
              if (action === 'Create') {
                canAccess = hasPermission(permissionModule, PERMISSION_TYPES.CREATE);
              } else if (action === 'Display') {
                canAccess = hasPermission(permissionModule, PERMISSION_TYPES.VIEW);
              }
            }

            if (!canAccess) return null;

            return (
              <ListItemButton
                key={`${module}-${action}`}
                component={Link}
                to={path}
                onClick={toggleDrawer}
                sx={{ 
                  pl: 6,
                  backgroundColor: isItemActive ? themeColors.primary : 'transparent',
                  '&:hover': {
                    backgroundColor: themeColors.lightBlue,
                  }
                }}
              >
                <ListItemText 
                  primary={action}
                  primaryTypographyProps={{
                    fontSize: '12px',
                    fontWeight: isItemActive ? 'bold' : 'normal',
                    color: isItemActive ? themeColors.white : themeColors.textPrimary,
                  }}
                />
              </ListItemButton>
            )
          })}
        </List>
      </Collapse>
    </>
  )
}

const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, selectedCompany, financialYear, isAdmin, hasPermission, logout, isSidebarOpen, toggleSidebar } = useAuth();
  
  const [calcOpen, setCalcOpen] = useState(false);
  const [recycleBinOpen, setRecycleBinOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleString());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const [entryOpen, setEntryOpen] = useState(true);
  const [masterOpen, setMasterOpen] = useState(true);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);

  const entryModules = [
    'Purchase Request',
    'Purchase Order',
    'Purchase',
    'Purchase Return',
    'Quality Control',
    'Incoming Quality',
    'Advance',
    'Flour Out',
    'Flour Out Return',
    'Work Order Slip',
    'Grind',
    'Papad In',
    'Papad Return',
    'Packing',
    'Open',
    'Quotation',
    'Sales',
    'Sales Order',
    'Sales Export',
    'Sales Export Order',
    'Sales Return',
    'Stock Adjust',
    'Godown Transfer',
    'Weight Conversion',
    'Voucher',
    'Vehicle Movement',
    'Cheque Printing',
  ];

  const masterModules = [
    'Item',
    'Item Group',
    'Deduction Sales',
    'Deduction Purchase',
    'Customer',
    'Suppliers',
    'Flour Mill',
    'Papad Company',
    'Weight',
    'Ledger Group',
    'Ledger',
    'Area',
    'City',
    'Consignee',
    'P.Trans',
    'Sender',
    'Transport',
    'Godown',
    'Tax',
  ];


  const reportModules = [
    { name: 'Stock Reports', path: '/reports/category/stock', permission: 'Stock Report' },
    { name: 'Godown Wise Stock Report', path: '/reports/godown-stock', permission: 'Godown Stock Report' },
    { name: 'Stock Alert & Reorder Report', path: '/features/stock-alert-dashboard', permission: 'Stock Report' },
    { name: 'Purchase Reports', path: '/reports/category/purchase', permission: 'Purchase Register' },
    { name: 'Purchase Return Reports', path: '/reports/category/purchase-return', permission: 'Purchase Return Register' },
    { name: 'Sales Reports', path: '/reports/category/sales', permission: 'Sales Register' },
    { name: 'Sales Return Reports', path: '/reports/category/sales-return', permission: 'Sales Return Register' },
    { name: 'Tax Reports', path: '/reports/category/tax', permission: 'Voucher' },
    { name: 'Production Reports', path: '/reports/category/production', permission: 'Daily Production' },
    { name: 'Pending Reports', path: '/reports/category/pending', permission: 'Purchase Request' },
    { name: 'All Reports Hub', path: '/reports', permission: 'Stock Report' }
  ];

  // Accounts modules with paths
  const accountsModules = [
    { name: 'Voucher Register', path: '/entry/voucher-create', permission: 'Voucher' },
    { name: 'Voucher Book', path: '/entry/voucher-display', permission: 'Voucher' },
    { name: 'General Ledger', path: '/reports/ledger-statement', permission: 'Ledger Statement' },
    { name: 'Supplier Ledger', path: '/reports/ledger-statement', permission: 'Ledger Statement' },
    { name: 'Day Book', path: '/reports/day-book', permission: 'Day Book' },
    { name: 'Trial Balance', path: '/reports/trial-balance', permission: 'Trial Balance' },
    { name: 'Balance Sheet', path: '/reports/balance-sheet', permission: 'Balance Sheet' },
    { name: 'Profit & Loss', path: '/reports/profit-loss', permission: 'Profit & Loss' },
    { name: 'Outstanding Summary', path: '/reports/outstanding-summary', permission: 'Outstanding Summary' },
    { name: 'Outstanding Details', path: '/reports/outstanding-details', permission: 'Outstanding Details' },
  ];

  const featuresModules = [
    { name: 'Stock Alert Dashboard', path: '/features/stock-alert-dashboard', permission: 'User' },
    { name: 'Stock Alert Configuration', path: '/features/stock-alert-config', permission: 'User' },
    { name: 'Alert Contacts Master', path: '/features/stock-alert-contacts', permission: 'User' },
    { name: 'User Activities Display', path: '/features/user-activities', permission: 'User' },
    { name: 'Setup', path: '/features/setup', permission: 'User' },
    { name: 'General Setup', path: '/features/general-setup', permission: 'User' },
    { name: 'User Creation', path: '/features/user-create', permission: 'User' },
    { name: 'User Display', path: '/features/user-display', permission: 'User' },
    { name: 'User Change Password', path: '/features/change-password', permission: 'User' },
    { name: 'Financial Year', path: '/features/financial-year', permission: 'User' },
    { name: 'Financial Year Creation', path: '/features/financial-year-create', permission: 'User' },
    { name: 'Backup & Restore', path: '/db-utility', permission: 'User' },
  ];

  const companyModules = [
    { name: 'Select', path: '/company-select', permission: 'Company Select' },
    { name: 'Create', path: '/company-create', permission: 'Company Create' },
  ];

  const qualityModules = [
    { name: 'Quality Dashboard', path: '/quality/dashboard', permission: 'Quality Control' },
    { name: 'Purchase Lab Entry', path: '/quality/purchase-lab-testing-create', permission: 'Quality Control' },
    { name: 'Parameter Registry', path: '/quality/parameter-master', permission: 'Quality Control' },
    { name: 'QC Template Master', path: '/quality/qc-template-master', permission: 'Quality Control' },
  ];

  const documentsModules = [
    { name: 'Document Dashboard', path: '/documents/dashboard', permission: 'Quality Control' },
    { name: 'Production Records (P1–P8)', path: '/documents/production', permission: 'Quality Control' },
    { name: 'Cleaning Records (C1–C10)', path: '/documents/cleaning', permission: 'Quality Control' },
    { name: 'Controlled Documents (D1–D11)', path: '/documents/controlled', permission: 'Quality Control' },
    { name: 'Document Templates', path: '/documents/templates', permission: 'Quality Control' },
    { name: 'Document Schedule', path: '/documents/schedule', permission: 'Quality Control' },
    { name: 'Pending Documents', path: '/documents/pending', permission: 'Quality Control' },
    { name: 'Expiring Documents', path: '/documents/expiring', permission: 'Quality Control' },
    { name: 'Document Register', path: '/documents/register', permission: 'Quality Control' },
  ];

  const crudActions = ['Create', 'Display'];
  const masterActions = ['Create', 'Display'];

  const toggleDrawer = () => {
    if (document.activeElement) {
      document.activeElement.blur();
    }
    toggleSidebar();
  };

  const handleEntryClick = () => {
    setEntryOpen(!entryOpen);
  };

  const handleMasterClick = () => {
    setMasterOpen(!masterOpen);
  };

  const handleQualityClick = () => {
    setQualityOpen(!qualityOpen);
  };

  const handleDocumentsClick = () => {
    setDocumentsOpen(!documentsOpen);
  };

  const handleReportClick = () => {
    setReportOpen(!reportOpen);
  };

  const handleAccountsClick = () => {
    setAccountsOpen(!accountsOpen);
  };

  const handleFeaturesClick = () => {
    setFeaturesOpen(!featuresOpen);
  };

  const handleCompanyClick = () => {
    setCompanyOpen(!companyOpen);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/company-select');
  };

  const generatePath = (type, module, action) => {
    // Replace dots and special chars with hyphens, then collapse multiple hyphens
    const slug = module.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/\./g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    const actionSlug = action.toLowerCase().replace(/\s+/g, '-').replace('/', '-')
    return `/${type}/${slug}-${actionSlug}`
  };

  const isDashboardActive = location.pathname === '/' || location.pathname === '/dashboard';

  return (
    <>
      {/* App Bar - Blue Theme */}
      <AppBar 
        position="sticky" 
        sx={{ 
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1100,
          background: `linear-gradient(135deg, ${themeColors.primary} 0%, ${themeColors.secondary} 100%)`,
          boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
          '@media print': {
            display: 'none !important',
          }
        }}
      >
        <Toolbar>
          <IconButton
            size="large"
            edge="start"
            color="inherit"
            aria-label="menu"
            onClick={toggleDrawer}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography 
            variant="h6" 
            component="div" 
            sx={{ 
              flexGrow: 1,
              fontWeight: 'bold',
              fontSize: '18px',
              letterSpacing: '0.5px',
            }}
          >
            BVC ERP
          </Typography>
          
          {/* Header Info */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mr: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.95)', fontSize: '13px' }}>
              <strong>Company:</strong> {selectedCompany?.name || 'BVC Company'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.95)', fontSize: '13px' }}>
              <strong>FY:</strong> {financialYear || '2024-2025'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.95)', fontSize: '13px' }}>
              <strong>User:</strong> {user?.username || 'admin'} ({user?.role || 'Admin'})
            </Typography>
            <Typography variant="body2" sx={{ color: '#e0f2fe', fontSize: '12px', background: 'rgba(255,255,255,0.15)', px: 1, py: 0.3, borderRadius: '4px', fontFamily: 'monospace' }}>
              {currentTime}
            </Typography>
            <SystemStatus />
            <StockAlertBell />
            <Tooltip title="Calculator Tool">
              <IconButton 
                size="small" 
                onClick={() => setCalcOpen(true)}
                sx={{ 
                  color: 'white', 
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.35)' },
                  ml: 0.5
                }}
              >
                <CalculateIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      <CalculatorModal open={calcOpen} onClose={() => setCalcOpen(false)} />
      
      {/* Sidebar - White & Blue Theme */}
      <Drawer 
        anchor="left" 
        variant="temporary"
        open={isSidebarOpen}
        onClose={toggleSidebar}
        disableRestoreFocus
        ModalProps={{
          keepMounted: true,
          disableAutoFocus: true,
          disableEnforceFocus: true,
        }}
        sx={{
          '& .MuiDrawer-paper': {
            width: 260,
            backgroundColor: themeColors.white,
            borderRight: `1px solid ${themeColors.lightBlue}`,
            overflowX: 'hidden',
          },
        }}
      >
        <Box sx={{ width: 260, pt: 2 }}>
          {/* Dashboard Link */}
          <ListItemButton 
            component={Link} 
            to="/" 
            onClick={toggleDrawer}
            sx={{ 
              justifyContent: 'flex-start',
              backgroundColor: isDashboardActive ? themeColors.primary : 'transparent',
              '&:hover': {
                backgroundColor: isDashboardActive ? themeColors.primary : themeColors.lightBlue,
              },
              py: 2
            }}
          >
            <DashboardIcon sx={{
              color: isDashboardActive ? themeColors.white : themeColors.primary,
              mr: 1
            }} />
            <ListItemText 
              primary="Dashboard"
              primaryTypographyProps={{
                fontSize: '14px',
                fontWeight: isDashboardActive ? 'bold' : 'normal',
                color: isDashboardActive ? themeColors.white : themeColors.textPrimary,
              }}
              sx={{ my: 0 }}
            />
          </ListItemButton>

          {/* Entry Section */}
          <ListItemButton
            onClick={handleEntryClick}
            sx={{
              minHeight: 48,
              borderTop: `1px solid ${themeColors.lightBlue}`,
              borderBottom: `1px solid ${themeColors.lightBlue}`,
              backgroundColor: themeColors.lighterBlue,
              px: 2,
            }}
          >
            <ListItemText
              primary="Entry"
              primaryTypographyProps={{
                fontSize: '14px',
                fontWeight: 'bold',
                color: themeColors.primary,
              }}
              sx={{ mr: 1 }}
            />
            {entryOpen ? <ExpandLess sx={{ color: themeColors.primary }} /> : <ExpandMore sx={{ color: themeColors.primary }} />}
          </ListItemButton>
          <Collapse in={entryOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {entryModules.map((module) => (
                <EntryModuleItem
                  key={module}
                  module={module}
                  actions={crudActions}
                  generatePath={generatePath}
                  toggleDrawer={toggleDrawer}
                  hasPermission={hasPermission}
                  isAdmin={isAdmin}
                />
              ))}
            </List>
          </Collapse>

          {/* Master Section */}
          <ListItemButton
            onClick={handleMasterClick}
            sx={{
              minHeight: 48,
              borderTop: `1px solid ${themeColors.lightBlue}`,
              borderBottom: `1px solid ${themeColors.lightBlue}`,
              backgroundColor: themeColors.lighterBlue,
              px: 2,
            }}
          >
            <ListItemText
              primary="Master"
              primaryTypographyProps={{
                fontSize: '14px',
                fontWeight: 'bold',
                color: themeColors.primary,
              }}
              sx={{ mr: 1 }}
            />
            {masterOpen ? <ExpandLess sx={{ color: themeColors.primary }} /> : <ExpandMore sx={{ color: themeColors.primary }} />}
          </ListItemButton>
          <Collapse in={masterOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {masterModules.map((module) => (
                <MasterModuleItem
                  key={module}
                  module={module}
                  actions={masterActions}
                  generatePath={generatePath}
                  toggleDrawer={toggleDrawer}
                  hasPermission={hasPermission}
                  isAdmin={isAdmin}
                />
              ))}
            </List>
          </Collapse>

          {/* Quality & Compliance Section */}
          {(isAdmin || qualityModules.some(q => hasPermission('Quality Control', PERMISSION_TYPES.VIEW) || hasPermission('Quality Check', PERMISSION_TYPES.VIEW) || hasPermission(q.name, PERMISSION_TYPES.VIEW))) && (
            <ListItemButton
              onClick={handleQualityClick}
              sx={{
                minHeight: 48,
                borderTop: `1px solid ${themeColors.lightBlue}`,
                borderBottom: `1px solid ${themeColors.lightBlue}`,
                backgroundColor: themeColors.lighterBlue,
                px: 2,
              }}
            >
              <ListItemText
                primary="Quality"
                primaryTypographyProps={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: themeColors.primary,
                }}
                sx={{ mr: 1 }}
              />
              {qualityOpen ? <ExpandLess sx={{ color: themeColors.primary }} /> : <ExpandMore sx={{ color: themeColors.primary }} />}
            </ListItemButton>
          )}
          <Collapse in={qualityOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {qualityModules
                .filter(module => isAdmin || hasPermission('Quality Control', PERMISSION_TYPES.VIEW) || hasPermission('Quality Check', PERMISSION_TYPES.VIEW) || hasPermission(module.name, PERMISSION_TYPES.VIEW))
                .map((module) => {
                const isQualityActive = location.pathname === module.path;
                return (
                  <ListItemButton 
                    key={module.name} 
                    component={Link} 
                    to={module.path}
                    onClick={toggleDrawer}
                    sx={{ 
                      pl: 4,
                      backgroundColor: isQualityActive ? themeColors.primary : 'transparent',
                      '&:hover': {
                        backgroundColor: isQualityActive ? themeColors.primary : themeColors.lightBlue,
                      }
                    }}
                  >
                    <ListItemText 
                      primary={module.name}
                      primaryTypographyProps={{
                        fontSize: '12px',
                        fontWeight: isQualityActive ? 'bold' : 'normal',
                        color: isQualityActive ? themeColors.white : themeColors.textPrimary,
                      }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Collapse>

          {/* Documents Section (Between Quality and Reports) */}
          {(isAdmin || hasPermission('Quality Control', PERMISSION_TYPES.VIEW)) && (
            <ListItemButton
              onClick={handleDocumentsClick}
              sx={{
                minHeight: 48,
                borderTop: `1px solid ${themeColors.lightBlue}`,
                borderBottom: `1px solid ${themeColors.lightBlue}`,
                backgroundColor: themeColors.lighterBlue,
                px: 2,
              }}
            >
              <ListItemText
                primary="Documents"
                primaryTypographyProps={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: themeColors.primary,
                }}
                sx={{ mr: 1 }}
              />
              {documentsOpen ? <ExpandLess sx={{ color: themeColors.primary }} /> : <ExpandMore sx={{ color: themeColors.primary }} />}
            </ListItemButton>
          )}
          <Collapse in={documentsOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {documentsModules.map((docMod) => {
                const isDocActive = location.pathname === docMod.path;
                return (
                  <ListItemButton
                    key={docMod.name}
                    component={Link}
                    to={docMod.path}
                    onClick={toggleDrawer}
                    sx={{
                      pl: 4,
                      backgroundColor: isDocActive ? themeColors.primary : 'transparent',
                      '&:hover': {
                        backgroundColor: isDocActive ? themeColors.primary : themeColors.lightBlue,
                      }
                    }}
                  >
                    <ListItemText
                      primary={docMod.name}
                      primaryTypographyProps={{
                        fontSize: '12px',
                        fontWeight: isDocActive ? 'bold' : 'normal',
                        color: isDocActive ? themeColors.white : themeColors.textPrimary,
                      }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Collapse>

          {/* Report Section - Only show if user has permission */}
          {(isAdmin || reportModules.some(r => hasPermission(r.permission, PERMISSION_TYPES.VIEW))) && (
            <ListItemButton onClick={handleReportClick}>
              <ListItemText 
                primary="Report" 
                primaryTypographyProps={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: themeColors.primary,
                }}
              />
              {reportOpen ? <ExpandLess sx={{ color: themeColors.primary }} /> : <ExpandMore sx={{ color: themeColors.primary }} />}
            </ListItemButton>
          )}
          <Collapse in={reportOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {reportModules
                .filter(report => isAdmin || hasPermission(report.permission, PERMISSION_TYPES.VIEW))
                .map((report) => {
                const isReportActive = location.pathname === report.path
                return (
                  <ListItemButton 
                    key={report.name} 
                    component={Link} 
                    to={report.path}
                    onClick={toggleDrawer}
                    sx={{ 
                      pl: 4,
                      backgroundColor: isReportActive ? themeColors.primary : 'transparent',
                      '&:hover': {
                        backgroundColor: isReportActive ? themeColors.primary : themeColors.lightBlue,
                      }
                    }}
                  >
                    <ListItemText 
                      primary={report.name}
                      primaryTypographyProps={{
                        fontSize: '12px',
                        fontWeight: isReportActive ? 'bold' : 'normal',
                        color: isReportActive ? themeColors.white : themeColors.textPrimary,
                      }}
                    />
                  </ListItemButton>
                )
              })}
            </List>
          </Collapse>

          {/* Accounts Section - Only show if user has permission */}
          {(isAdmin || accountsModules.some(a => hasPermission(a.permission, PERMISSION_TYPES.VIEW))) && (
            <ListItemButton onClick={handleAccountsClick}>
              <ListItemText 
                primary="Accounts" 
                primaryTypographyProps={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: themeColors.primary,
                }}
              />
              {accountsOpen ? <ExpandLess sx={{ color: themeColors.primary }} /> : <ExpandMore sx={{ color: themeColors.primary }} />}
            </ListItemButton>
          )}
          <Collapse in={accountsOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {accountsModules
                .filter(module => isAdmin || hasPermission(module.permission, PERMISSION_TYPES.VIEW))
                .map((module) => {
                const isAccountActive = location.pathname === module.path
                return (
                  <ListItemButton 
                    key={module.name} 
                    component={Link} 
                    to={module.path}
                    onClick={toggleDrawer}
                    sx={{ 
                      pl: 4,
                      backgroundColor: isAccountActive ? themeColors.primary : 'transparent',
                      '&:hover': {
                        backgroundColor: isAccountActive ? themeColors.primary : themeColors.lightBlue,
                      }
                    }}
                  >
                    <ListItemText 
                      primary={module.name}
                      primaryTypographyProps={{
                        fontSize: '12px',
                        fontWeight: isAccountActive ? 'bold' : 'normal',
                        color: isAccountActive ? themeColors.white : themeColors.textPrimary,
                      }}
                    />
                  </ListItemButton>
                )
              })}
            </List>
          </Collapse>

          {/* Features Section */}
          <ListItemButton onClick={handleFeaturesClick}>
            <ListItemText 
              primary="Features" 
              primaryTypographyProps={{
                fontSize: '14px',
                fontWeight: 'bold',
                color: themeColors.primary,
              }}
            />
            {featuresOpen ? <ExpandLess sx={{ color: themeColors.primary }} /> : <ExpandMore sx={{ color: themeColors.primary }} />}
          </ListItemButton>
          <Collapse in={featuresOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {featuresModules
                .filter(module => isAdmin || hasPermission(module.permission, PERMISSION_TYPES.VIEW))
                .map((module) => (
                <ListItemButton 
                  key={module.name} 
                  component={Link} 
                  to={module.path}
                  onClick={toggleDrawer}
                  sx={{ pl: 4 }}
                >
                  <ListItemText 
                    primary={module.name}
                    primaryTypographyProps={{
                      fontSize: '12px',
                      color: themeColors.textPrimary,
                    }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Collapse>

          {/* Company Section */}
          {(isAdmin || companyModules.some(c => hasPermission('Company', PERMISSION_TYPES.VIEW) || hasPermission(c.permission, PERMISSION_TYPES.VIEW) || hasPermission('Company Select', PERMISSION_TYPES.VIEW))) && (
            <ListItemButton onClick={handleCompanyClick}>
              <ListItemText 
                primary="Company" 
                primaryTypographyProps={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: themeColors.primary,
                }}
              />
              {companyOpen ? <ExpandLess sx={{ color: themeColors.primary }} /> : <ExpandMore sx={{ color: themeColors.primary }} />}
            </ListItemButton>
          )}
          <Collapse in={companyOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {companyModules
                .filter(module => isAdmin || hasPermission('Company', PERMISSION_TYPES.VIEW) || hasPermission(module.permission, PERMISSION_TYPES.VIEW) || hasPermission('Company Select', PERMISSION_TYPES.VIEW))
                .map((module) => (
                <ListItemButton 
                  key={module.name} 
                  component={Link} 
                  to={module.path}
                  onClick={toggleDrawer}
                  sx={{ pl: 4 }}
                >
                  <ListItemText 
                    primary={module.name}
                    primaryTypographyProps={{
                      fontSize: '12px',
                      color: themeColors.textPrimary,
                    }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Collapse>

          {/* Recycle Bin Action Button (Before Logout) */}
          <ListItemButton 
            onClick={() => setRecycleBinOpen(true)}
            sx={{ 
              borderTop: `1px solid ${themeColors.lightBlue}`,
              mt: 2,
              '&:hover': {
                backgroundColor: '#ffe4e6',
              }
            }}
          >
            <RecyclingIcon sx={{ mr: 1, color: '#e11d48' }} />
            <ListItemText 
              primary="Recycle Bin"
              primaryTypographyProps={{
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#e11d48',
              }}
            />
          </ListItemButton>

          {/* Logout Button */}
          <ListItemButton 
            onClick={handleLogout}
            sx={{ 
              borderTop: `1px dashed ${themeColors.lightBlue}`,
              mt: 0.5,
            }}
          >
            <LogoutIcon sx={{ mr: 1, color: themeColors.primary }} />
            <ListItemText 
              primary="Logout"
              primaryTypographyProps={{
                fontSize: '14px',
                fontWeight: 'bold',
                color: themeColors.primary,
              }}
            />
          </ListItemButton>
        </Box>
      </Drawer>

      {/* Recycle Bin Dialog Modal */}
      <RecycleBinModal open={recycleBinOpen} onClose={() => setRecycleBinOpen(false)} />
    </>
  )
}

export default Navigation
