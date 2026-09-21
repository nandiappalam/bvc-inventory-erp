import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItemText,
  ListItemButton,
  Collapse,
  IconButton,
  Button,
  Box,
  Tooltip,
} from '@mui/material';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';
import LogoutIcon from '@mui/icons-material/Logout';
import CalculateIcon from '@mui/icons-material/Calculate';
import RecyclingIcon from '@mui/icons-material/Recycling';
import CalculatorModal from './CalculatorModal';
import RecycleBinModal from './RecycleBinModal';
import StockAlertBell from './StockAlert/StockAlertBell';
import CentralNotificationsBell from './CentralNotificationsBell';
import SystemStatus from './SystemStatus';
import { useAuth, PERMISSION_TYPES } from '../context/AuthContext';

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

// Non-clickable category label
const NavSectionHeader = ({ title }) => (
  <Box sx={{ px: 2, pt: 2, pb: 0.5 }}>
    <Typography
      variant="caption"
      sx={{
        color: '#64748b',
        fontWeight: 800,
        fontSize: '10px',
        letterSpacing: '0.8px',
        textTransform: 'uppercase',
        display: 'block',
      }}
    >
      {title}
    </Typography>
  </Box>
);

// Non-clickable sub-group label inside an expanded module list
const NavSubGroupHeader = ({ title }) => (
  <Box sx={{ pl: 3, pr: 2, pt: 1.5, pb: 0.5 }}>
    <Typography
      variant="caption"
      sx={{
        color: '#64748b',
        fontWeight: 700,
        fontSize: '9.5px',
        letterSpacing: '0.6px',
        textTransform: 'uppercase',
        display: 'block',
      }}
    >
      {title}
    </Typography>
  </Box>
);

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
    const path = generatePath('entry', module, action);
    return location.pathname === path;
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
            const path = generatePath('entry', module, action);
            const isItemActive = location.pathname === path;
            
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
            );
          })}
        </List>
      </Collapse>
    </>
  );
};

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
    const path = generatePath('master', module, action);
    return location.pathname === path;
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
            const path = generatePath('master', module, action);
            const isItemActive = location.pathname === path;

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
            );
          })}
        </List>
      </Collapse>
    </>
  );
};

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
  const [coldStorageOpen, setColdStorageOpen] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [manufacturingOpen, setManufacturingOpen] = useState(false);
  const [intelligenceOpen, setIntelligenceOpen] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);

  // Grouped Entry Modules
  const entryGroups = [
    {
      groupTitle: 'Procurement',
      modules: ['Purchase Request', 'Purchase Order', 'Purchase', 'Purchase Return']
    },
    {
      groupTitle: 'Quality & Inward',
      modules: ['Quality Control', 'Incoming Quality', 'Vehicle Movement']
    },
    {
      groupTitle: 'Manufacturing / Production',
      modules: ['Work Order Slip', 'Grind', 'Flour Out', 'Flour Out Return', 'Papad In', 'Papad Return', 'Packing']
    },
    {
      groupTitle: 'Sales & Distribution',
      modules: ['Quotation', 'Sales Order', 'Sales', 'Sales Export', 'Sales Export Order', 'Sales Return']
    },
    {
      groupTitle: 'Inventory & Movement',
      modules: ['Open', 'Stock Adjust', 'Godown Transfer', 'Weight Conversion']
    },
    {
      groupTitle: 'Finance & Other Entries',
      modules: ['Voucher', 'Advance', 'Cheque Printing']
    }
  ];

  // Grouped Master Modules
  const masterGroups = [
    {
      groupTitle: 'Items & Classification',
      modules: ['Item', 'Item Group', 'Weight', 'Tax']
    },
    {
      groupTitle: 'Customers & Suppliers',
      modules: ['Customer', 'Suppliers']
    },
    {
      groupTitle: 'Manufacturing Masters',
      modules: ['Flour Mill', 'Papad Company']
    },
    {
      groupTitle: 'Logistics & Location',
      modules: ['Godown', 'Area', 'City', 'Consignee', 'P.Trans', 'Sender', 'Transport']
    },
    {
      groupTitle: 'Accounts & Deductions',
      modules: ['Ledger Group', 'Ledger', 'Deduction Sales', 'Deduction Purchase']
    }
  ];

  // Grouped Cold Storage Modules
  const coldStorageGroups = [
    {
      groupTitle: 'Operations',
      items: [
        { name: 'Cold Storage IN (CSI)', path: '/cold-storage/in' },
        { name: 'Cold Storage OUT (CSO)', path: '/cold-storage/out' }
      ]
    },
    {
      groupTitle: 'Stock',
      items: [
        { name: 'Stock Balance', path: '/cold-storage/stock' }
      ]
    },
    {
      groupTitle: 'Transactions',
      items: [
        { name: 'Voucher Register', path: '/cold-storage/vouchers' },
        { name: 'Movement Ledger', path: '/cold-storage/ledger' }
      ]
    },
    {
      groupTitle: 'Traceability',
      items: [
        { name: 'Lot Traceability', path: '/cold-storage/traceability' }
      ]
    },
    {
      groupTitle: 'Configuration',
      items: [
        { name: 'Facility Master', path: '/cold-storage/master' }
      ]
    }
  ];

  // Grouped Quality Modules
  const qualityGroups = [
    {
      groupTitle: 'Quality Operations',
      items: [
        { name: 'Quality Dashboard', path: '/quality/dashboard', permission: 'Quality Control' },
        { name: 'Purchase Lab Entry', path: '/quality/purchase-lab-testing-create', permission: 'Quality Control' }
      ]
    },
    {
      groupTitle: 'Quality Configuration',
      items: [
        { name: 'Parameter Registry', path: '/quality/parameter-master', permission: 'Quality Control' },
        { name: 'QC Template Master', path: '/quality/qc-template-master', permission: 'Quality Control' }
      ]
    }
  ];

  // Grouped Documents Modules
  const documentsGroups = [
    {
      groupTitle: 'Compliance Dashboard',
      items: [
        { name: 'Document Compliance Dashboard', path: '/documents/dashboard', permission: 'Quality Control' }
      ]
    },
    {
      groupTitle: 'Process & Quality Records (P1–P8)',
      items: [
        { name: '1. Inward Quality Report (IQR / P1)', path: '/documents/production?code=P1', permission: 'Quality Control' },
        { name: '2. RM Storage Audit (P2)', path: '/documents/production?code=P2', permission: 'Quality Control' },
        { name: '3. Milling Pre-Start Checklist (P3)', path: '/documents/production?code=P3', permission: 'Quality Control' },
        { name: '4. CCP Monitoring Records (P4)', path: '/documents/production?code=P4', permission: 'Quality Control' },
        { name: '5. Line Changeover & Cleanliness (P5)', path: '/documents/production?code=P5', permission: 'Quality Control' },
        { name: '6. Certificate of Analysis (COA / P6)', path: '/documents/production?code=P6', permission: 'Quality Control' },
        { name: '7. Terminal Inspection & Dispatch (P7)', path: '/documents/production?code=P7', permission: 'Quality Control' },
        { name: '8. 360° Lot Traceability Engine (P8)', path: '/lot-genealogy', permission: 'Quality Control' }
      ]
    },
    {
      groupTitle: 'Sanitation & Hygiene Records (C1–C10)',
      items: [
        { name: 'Cleaning & Sanitation Master (C1–C10)', path: '/documents/cleaning', permission: 'Quality Control' }
      ]
    },
    {
      groupTitle: 'Controlled Policies & Manuals (D1–D11)',
      items: [
        { name: 'Glass & Brittle Plastic Policy (D3)', path: '/documents/controlled?code=D3', permission: 'Quality Control' },
        { name: 'Allergen Management Plan (D5)', path: '/documents/controlled?code=D5', permission: 'Quality Control' },
        { name: 'Controlled Documents Register (D1–D11)', path: '/documents/controlled', permission: 'Quality Control' }
      ]
    },
    {
      groupTitle: 'Administration & Monitoring',
      items: [
        { name: 'Document Templates', path: '/documents/templates', permission: 'Quality Control' },
        { name: 'Document Schedule', path: '/documents/schedule', permission: 'Quality Control' },
        { name: 'Document Register', path: '/documents/register', permission: 'Quality Control' },
        { name: 'Pending & Expiring Records', path: '/documents/pending', permission: 'Quality Control' }
      ]
    }
  ];

  // Grouped Manufacturing Modules
  const manufacturingGroups = [
    {
      groupTitle: 'Production Planning & Control',
      items: [
        { name: 'Factory Production Planning & Control', path: '/factory-production-planning' }
      ]
    },
    {
      groupTitle: 'Traceability',
      items: [
        { name: 'Lot Genealogy & Traceability', path: '/lot-genealogy' }
      ]
    },
    {
      groupTitle: 'Product Definition',
      items: [
        { name: 'BOM & Formulation Master', path: '/bom-master' }
      ]
    },
    {
      groupTitle: 'Planning',
      items: [
        { name: 'Production Planning & MRP', path: '/production-planning' }
      ]
    },
    {
      groupTitle: 'Production Intelligence',
      items: [
        { name: 'Yield Intelligence & Mass Balance', path: '/yield-intelligence' }
      ]
    },
    {
      groupTitle: 'Jobwork',
      items: [
        { name: 'Jobwork & Contractor Control', path: '/jobwork-control' }
      ]
    }
  ];

  // Grouped Operations & Intelligence Modules
  const enterpriseGroups = [
    {
      groupTitle: 'Cold Storage',
      items: [
        { name: 'Cold Storage Intelligence', path: '/cold-storage-intelligence' }
      ]
    },
    {
      groupTitle: 'Finance',
      items: [
        { name: 'Financial Control Center', path: '/financial-intelligence' }
      ]
    },
    {
      groupTitle: 'Business Partners',
      items: [
        { name: 'Party 360° Intelligence', path: '/party-intelligence' }
      ]
    },
    {
      groupTitle: 'Sales Operations',
      items: [
        { name: 'Order Fulfillment Pipeline', path: '/order-fulfillment' }
      ]
    },
    {
      groupTitle: 'Warehouse',
      items: [
        { name: 'Warehouse Mobile Ops', path: '/warehouse-mobile' }
      ]
    },
    {
      groupTitle: 'Identification',
      items: [
        { name: 'Barcode & QR Master 360°', path: '/barcode-qr' }
      ]
    },
    {
      groupTitle: 'Compliance',
      items: [
        { name: 'Automated Compliance', path: '/automated-compliance' }
      ]
    },
    {
      groupTitle: 'Customer Quality',
      items: [
        { name: 'Customer Complaint & Traceability', path: '/customer-complaint' }
      ]
    },
    {
      groupTitle: 'Food Safety',
      items: [
        { name: 'Recall Management', path: '/recall-management' }
      ]
    },
    {
      groupTitle: 'Analytics',
      items: [
        { name: 'Business Intelligence', path: '/business-intelligence' }
      ]
    },
    {
      groupTitle: 'AI',
      items: [
        { name: 'AI Intelligence', path: '/ai-intelligence' }
      ]
    }
  ];

  // Grouped Report Modules
  const reportGroups = [
    {
      groupTitle: 'Planning',
      items: [
        { name: 'Procurement Planning', path: '/procurement-planning', permission: 'Purchase Request' }
      ]
    },
    {
      groupTitle: 'Inventory',
      items: [
        { name: 'Inventory Intelligence', path: '/inventory-intelligence', permission: 'Stock Report' },
        { name: 'Stock Reports', path: '/reports/category/stock', permission: 'Stock Report' },
        { name: 'Godown Wise Stock Report', path: '/reports/godown-stock', permission: 'Godown Stock Report' },
        { name: 'Stock Alert & Reorder Report', path: '/features/stock-alert-dashboard', permission: 'Stock Report' }
      ]
    },
    {
      groupTitle: 'Purchase',
      items: [
        { name: 'Purchase Reports', path: '/reports/category/purchase', permission: 'Purchase Register' },
        { name: 'Purchase Return Reports', path: '/reports/category/purchase-return', permission: 'Purchase Return Register' }
      ]
    },
    {
      groupTitle: 'Sales',
      items: [
        { name: 'Sales Reports', path: '/reports/category/sales', permission: 'Sales Register' },
        { name: 'Sales Return Reports', path: '/reports/category/sales-return', permission: 'Sales Return Register' }
      ]
    },
    {
      groupTitle: 'Tax',
      items: [
        { name: 'Tax Reports', path: '/reports/category/tax', permission: 'Voucher' }
      ]
    },
    {
      groupTitle: 'Production',
      items: [
        { name: 'Production Reports', path: '/reports/category/production', permission: 'Daily Production' }
      ]
    },
    {
      groupTitle: 'Pending',
      items: [
        { name: 'Pending Reports', path: '/reports/category/pending', permission: 'Purchase Request' }
      ]
    },
    {
      groupTitle: 'Reports Hub',
      items: [
        { name: 'All Reports Hub', path: '/reports', permission: 'Stock Report' }
      ]
    }
  ];

  // Grouped Accounts Modules
  const accountsGroups = [
    {
      groupTitle: 'Vouchers',
      items: [
        { name: 'Voucher Register', path: '/entry/voucher-create', permission: 'Voucher' },
        { name: 'Voucher Book', path: '/entry/voucher-display', permission: 'Voucher' }
      ]
    },
    {
      groupTitle: 'Ledgers',
      items: [
        { name: 'General Ledger', path: '/reports/ledger-statement', permission: 'Ledger Statement' },
        { name: 'Supplier Ledger', path: '/reports/ledger-statement', permission: 'Ledger Statement' }
      ]
    },
    {
      groupTitle: 'Financial Statements',
      items: [
        { name: 'Day Book', path: '/reports/day-book', permission: 'Day Book' },
        { name: 'Trial Balance', path: '/reports/trial-balance', permission: 'Trial Balance' },
        { name: 'Profit & Loss', path: '/reports/profit-loss', permission: 'Profit & Loss' },
        { name: 'Balance Sheet', path: '/reports/balance-sheet', permission: 'Balance Sheet' }
      ]
    },
    {
      groupTitle: 'Outstanding',
      items: [
        { name: 'Outstanding Summary', path: '/reports/outstanding-summary', permission: 'Outstanding Summary' },
        { name: 'Outstanding Details', path: '/reports/outstanding-details', permission: 'Outstanding Details' }
      ]
    }
  ];

  // Grouped Features Modules
  const featuresGroups = [
    {
      groupTitle: 'Stock Alerts',
      items: [
        { name: 'Stock Alert Dashboard', path: '/features/stock-alert-dashboard', permission: 'User' },
        { name: 'Stock Alert Configuration', path: '/features/stock-alert-config', permission: 'User' },
        { name: 'Alert Contacts Master', path: '/features/stock-alert-contacts', permission: 'User' }
      ]
    },
    {
      groupTitle: 'User & Security',
      items: [
        { name: 'User Activities Display', path: '/features/user-activities', permission: 'User' },
        { name: 'User Creation', path: '/features/user-create', permission: 'User' },
        { name: 'User Display', path: '/features/user-display', permission: 'User' },
        { name: 'User Change Password', path: '/features/change-password', permission: 'User' }
      ]
    },
    {
      groupTitle: 'System Setup',
      items: [
        { name: 'Setup', path: '/features/setup', permission: 'User' },
        { name: 'General Setup', path: '/features/general-setup', permission: 'User' }
      ]
    },
    {
      groupTitle: 'Financial Year',
      items: [
        { name: 'Financial Year', path: '/features/financial-year', permission: 'User' },
        { name: 'Financial Year Creation', path: '/features/financial-year-create', permission: 'User' }
      ]
    },
    {
      groupTitle: 'Database',
      items: [
        { name: 'Backup & Restore', path: '/db-utility', permission: 'User' }
      ]
    }
  ];

  const companyModules = [
    { name: 'Select', path: '/company-select', permission: 'Company Select' },
    { name: 'Create', path: '/company-create', permission: 'Company Create' },
    { name: 'Company List', path: '/company-display', permission: 'Company Select' },
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

  const handleColdStorageClick = () => {
    setColdStorageOpen(!coldStorageOpen);
  };

  const handleQualityClick = () => {
    setQualityOpen(!qualityOpen);
  };

  const handleDocumentsClick = () => {
    setDocumentsOpen(!documentsOpen);
  };

  const handleManufacturingClick = () => {
    setManufacturingOpen(!manufacturingOpen);
  };

  const handleIntelligenceClick = () => {
    setIntelligenceOpen(!intelligenceOpen);
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
    const slug = module.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/\./g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const actionSlug = action.toLowerCase().replace(/\s+/g, '-').replace('/', '-');
    return `/${type}/${slug}-${actionSlug}`;
  };

  const isDashboardActive = location.pathname === '/' || location.pathname === '/dashboard';
  const isCommandCenterActive = location.pathname.startsWith('/command-center');

  // Check if a report group has at least one visible item
  const hasVisibleReportItem = (group) => {
    return isAdmin || group.items.some(item => hasPermission(item.permission, PERMISSION_TYPES.VIEW));
  };

  // Check if an accounts group has at least one visible item
  const hasVisibleAccountItem = (group) => {
    return isAdmin || group.items.some(item => hasPermission(item.permission, PERMISSION_TYPES.VIEW));
  };

  // Check if a features group has at least one visible item
  const hasVisibleFeatureItem = (group) => {
    return isAdmin || group.items.some(item => hasPermission(item.permission, PERMISSION_TYPES.VIEW));
  };

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
              <strong>FY:</strong> {financialYear || (new Date().getMonth() >= 3 ? `${new Date().getFullYear()}-${new Date().getFullYear() + 1}` : `${new Date().getFullYear() - 1}-${new Date().getFullYear()}`)}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.95)', fontSize: '13px' }}>
              <strong>User:</strong> {user?.username || 'admin'} ({user?.role || 'Admin'})
            </Typography>
            <Typography variant="body2" sx={{ color: '#e0f2fe', fontSize: '12px', background: 'rgba(255,255,255,0.15)', px: 1, py: 0.3, borderRadius: '4px', fontFamily: 'monospace' }}>
              {currentTime}
            </Typography>
            <SystemStatus />
            <StockAlertBell />
            <CentralNotificationsBell />
            <Tooltip title="Command Center Overview">
              <Button
                component={Link}
                to="/command-center"
                size="small"
                startIcon={<DashboardCustomizeIcon sx={{ fontSize: 16 }} />}
                sx={{
                  color: '#ffffff',
                  backgroundColor: isCommandCenterActive ? 'rgba(255, 255, 255, 0.28)' : 'rgba(255, 255, 255, 0.12)',
                  border: isCommandCenterActive ? '1px solid rgba(255, 255, 255, 0.6)' : '1px solid rgba(255, 255, 255, 0.25)',
                  fontWeight: 600,
                  fontSize: '12px',
                  textTransform: 'none',
                  px: 1.25,
                  py: 0.35,
                  borderRadius: '6px',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.32)',
                    borderColor: '#ffffff'
                  }
                }}
              >
                Command Center
              </Button>
            </Tooltip>
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
        <Box sx={{ width: 260, pt: 1, pb: 4 }}>
          {/* Dashboard Link */}
          <ListItemButton 
            component={Link} 
            to="/dashboard" 
            onClick={toggleDrawer}
            sx={{ 
              justifyContent: 'flex-start',
              backgroundColor: isDashboardActive ? themeColors.primary : 'transparent',
              '&:hover': {
                backgroundColor: isDashboardActive ? themeColors.primary : themeColors.lightBlue,
              },
              py: 1.25,
              mx: 1,
              borderRadius: '6px',
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
                fontWeight: isDashboardActive ? 'bold' : 600,
                color: isDashboardActive ? themeColors.white : themeColors.textPrimary,
              }}
              sx={{ my: 0 }}
            />
          </ListItemButton>

          {/* Command Center Link */}
          <ListItemButton 
            component={Link} 
            to="/command-center" 
            onClick={toggleDrawer}
            sx={{ 
              justifyContent: 'flex-start',
              backgroundColor: isCommandCenterActive ? themeColors.primary : 'transparent',
              '&:hover': {
                backgroundColor: isCommandCenterActive ? themeColors.primary : themeColors.lightBlue,
              },
              py: 1.25,
              mx: 1,
              mt: 0.5,
              borderRadius: '6px',
            }}
          >
            <DashboardCustomizeIcon sx={{
              color: isCommandCenterActive ? themeColors.white : themeColors.primary,
              mr: 1
            }} />
            <ListItemText 
              primary="Command Center"
              primaryTypographyProps={{
                fontSize: '14px',
                fontWeight: isCommandCenterActive ? 'bold' : 600,
                color: isCommandCenterActive ? themeColors.white : themeColors.textPrimary,
              }}
              sx={{ my: 0 }}
            />
          </ListItemButton>

          {/* Entry Section */}
          <ListItemButton
            onClick={handleEntryClick}
            sx={{
              minHeight: 44,
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
              {entryGroups.map((group) => (
                <React.Fragment key={group.groupTitle}>
                  <NavSubGroupHeader title={group.groupTitle} />
                  {group.modules.map((module) => (
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
                </React.Fragment>
              ))}
            </List>
          </Collapse>

          {/* Master Section */}
          <ListItemButton
            onClick={handleMasterClick}
            sx={{
              minHeight: 44,
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
              {masterGroups.map((group) => (
                <React.Fragment key={group.groupTitle}>
                  <NavSubGroupHeader title={group.groupTitle} />
                  {group.modules.map((module) => (
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
                </React.Fragment>
              ))}
            </List>
          </Collapse>

          {/* Cold Storage Section */}
          <ListItemButton
            onClick={handleColdStorageClick}
            sx={{
              minHeight: 44,
              borderTop: `1px solid ${themeColors.lightBlue}`,
              borderBottom: `1px solid ${themeColors.lightBlue}`,
              backgroundColor: themeColors.lighterBlue,
              px: 2,
            }}
          >
            <ListItemText
              primary="Cold Storage"
              primaryTypographyProps={{
                fontSize: '14px',
                fontWeight: 'bold',
                color: themeColors.primary,
              }}
              sx={{ mr: 1 }}
            />
            {coldStorageOpen ? <ExpandLess sx={{ color: themeColors.primary }} /> : <ExpandMore sx={{ color: themeColors.primary }} />}
          </ListItemButton>
          <Collapse in={coldStorageOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {coldStorageGroups.map((group) => (
                <React.Fragment key={group.groupTitle}>
                  <NavSubGroupHeader title={group.groupTitle} />
                  {group.items.map((module) => {
                    const isActive = location.pathname === module.path;
                    return (
                      <ListItemButton
                        key={module.name}
                        component={Link}
                        to={module.path}
                        onClick={toggleDrawer}
                        sx={{
                          pl: 4,
                          backgroundColor: isActive ? themeColors.primary : 'transparent',
                          '&:hover': {
                            backgroundColor: isActive ? themeColors.primary : themeColors.lightBlue,
                          }
                        }}
                      >
                        <ListItemText
                          primary={module.name}
                          primaryTypographyProps={{
                            fontSize: '12px',
                            fontWeight: isActive ? 'bold' : 'normal',
                            color: isActive ? themeColors.white : themeColors.textPrimary,
                          }}
                        />
                      </ListItemButton>
                    );
                  })}
                </React.Fragment>
              ))}
            </List>
          </Collapse>

          {/* Quality Section */}
          {(isAdmin || qualityGroups.some(g => g.items.some(q => hasPermission('Quality Control', PERMISSION_TYPES.VIEW) || hasPermission('Quality Check', PERMISSION_TYPES.VIEW) || hasPermission(q.name, PERMISSION_TYPES.VIEW)))) && (
            <ListItemButton
              onClick={handleQualityClick}
              sx={{
                minHeight: 44,
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
              {qualityGroups.map((group) => {
                const visibleItems = group.items.filter(m => isAdmin || hasPermission('Quality Control', PERMISSION_TYPES.VIEW) || hasPermission('Quality Check', PERMISSION_TYPES.VIEW) || hasPermission(m.name, PERMISSION_TYPES.VIEW));
                if (visibleItems.length === 0) return null;
                return (
                  <React.Fragment key={group.groupTitle}>
                    <NavSubGroupHeader title={group.groupTitle} />
                    {visibleItems.map((module) => {
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
                  </React.Fragment>
                );
              })}
            </List>
          </Collapse>

          {/* Documents Section */}
          {(isAdmin || hasPermission('Quality Control', PERMISSION_TYPES.VIEW)) && (
            <ListItemButton
              onClick={handleDocumentsClick}
              sx={{
                minHeight: 44,
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
              {documentsGroups.map((group) => (
                <React.Fragment key={group.groupTitle}>
                  <NavSubGroupHeader title={group.groupTitle} />
                  {group.items.map((docMod) => {
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
                </React.Fragment>
              ))}
            </List>
          </Collapse>

          {/* Manufacturing Section */}
          <ListItemButton
            onClick={handleManufacturingClick}
            sx={{
              minHeight: 44,
              borderTop: `1px solid ${themeColors.lightBlue}`,
              borderBottom: `1px solid ${themeColors.lightBlue}`,
              backgroundColor: themeColors.lighterBlue,
              px: 2,
            }}
          >
            <ListItemText
              primary="Manufacturing"
              primaryTypographyProps={{
                fontSize: '14px',
                fontWeight: 'bold',
                color: themeColors.primary,
              }}
              sx={{ mr: 1 }}
            />
            {manufacturingOpen ? <ExpandLess sx={{ color: themeColors.primary }} /> : <ExpandMore sx={{ color: themeColors.primary }} />}
          </ListItemButton>
          <Collapse in={manufacturingOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {manufacturingGroups.map((group) => (
                <React.Fragment key={group.groupTitle}>
                  <NavSubGroupHeader title={group.groupTitle} />
                  {group.items.map((mfgMod) => {
                    const isMfgActive = location.pathname === mfgMod.path;
                    return (
                      <ListItemButton
                        key={mfgMod.name}
                        component={Link}
                        to={mfgMod.path}
                        onClick={toggleDrawer}
                        sx={{
                          pl: 4,
                          backgroundColor: isMfgActive ? themeColors.primary : 'transparent',
                          '&:hover': {
                            backgroundColor: isMfgActive ? themeColors.primary : themeColors.lightBlue,
                          }
                        }}
                      >
                        <ListItemText
                          primary={mfgMod.name}
                          primaryTypographyProps={{
                            fontSize: '12px',
                            fontWeight: isMfgActive ? 'bold' : 'normal',
                            color: isMfgActive ? themeColors.white : themeColors.textPrimary,
                          }}
                        />
                      </ListItemButton>
                    );
                  })}
                </React.Fragment>
              ))}
            </List>
          </Collapse>

          {/* Operations & Intelligence Section */}
          <ListItemButton
            onClick={handleIntelligenceClick}
            sx={{
              minHeight: 44,
              borderTop: `1px solid ${themeColors.lightBlue}`,
              borderBottom: `1px solid ${themeColors.lightBlue}`,
              backgroundColor: themeColors.lighterBlue,
              px: 2,
            }}
          >
            <ListItemText
              primary="Operations & Intelligence"
              primaryTypographyProps={{
                fontSize: '14px',
                fontWeight: 'bold',
                color: themeColors.primary,
              }}
              sx={{ mr: 1 }}
            />
            {intelligenceOpen ? <ExpandLess sx={{ color: themeColors.primary }} /> : <ExpandMore sx={{ color: themeColors.primary }} />}
          </ListItemButton>
          <Collapse in={intelligenceOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {enterpriseGroups.map((group) => (
                <React.Fragment key={group.groupTitle}>
                  <NavSubGroupHeader title={group.groupTitle} />
                  {group.items.map((entMod) => {
                    const isEntActive = location.pathname === entMod.path;
                    return (
                      <ListItemButton
                        key={entMod.name}
                        component={Link}
                        to={entMod.path}
                        onClick={toggleDrawer}
                        sx={{
                          pl: 4,
                          backgroundColor: isEntActive ? themeColors.primary : 'transparent',
                          '&:hover': {
                            backgroundColor: isEntActive ? themeColors.primary : themeColors.lightBlue,
                          }
                        }}
                      >
                        <ListItemText
                          primary={entMod.name}
                          primaryTypographyProps={{
                            fontSize: '12px',
                            fontWeight: isEntActive ? 'bold' : 'normal',
                            color: isEntActive ? themeColors.white : themeColors.textPrimary,
                          }}
                        />
                      </ListItemButton>
                    );
                  })}
                </React.Fragment>
              ))}
            </List>
          </Collapse>

          {/* Report Section */}
          {(isAdmin || reportGroups.some(g => hasVisibleReportItem(g))) && (
            <ListItemButton
              onClick={handleReportClick}
              sx={{
                minHeight: 44,
                borderTop: `1px solid ${themeColors.lightBlue}`,
                borderBottom: `1px solid ${themeColors.lightBlue}`,
                backgroundColor: themeColors.lighterBlue,
                px: 2,
              }}
            >
              <ListItemText 
                primary="Report" 
                primaryTypographyProps={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: themeColors.primary,
                }}
                sx={{ mr: 1 }}
              />
              {reportOpen ? <ExpandLess sx={{ color: themeColors.primary }} /> : <ExpandMore sx={{ color: themeColors.primary }} />}
            </ListItemButton>
          )}
          <Collapse in={reportOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {reportGroups.map((group) => {
                const visibleItems = group.items.filter(item => isAdmin || hasPermission(item.permission, PERMISSION_TYPES.VIEW));
                if (visibleItems.length === 0) return null;
                return (
                  <React.Fragment key={group.groupTitle}>
                    <NavSubGroupHeader title={group.groupTitle} />
                    {visibleItems.map((report) => {
                      const isReportActive = location.pathname === report.path;
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
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </List>
          </Collapse>

          {/* Accounts Section */}
          {(isAdmin || accountsGroups.some(g => hasVisibleAccountItem(g))) && (
            <ListItemButton
              onClick={handleAccountsClick}
              sx={{
                minHeight: 44,
                borderTop: `1px solid ${themeColors.lightBlue}`,
                borderBottom: `1px solid ${themeColors.lightBlue}`,
                backgroundColor: themeColors.lighterBlue,
                px: 2,
              }}
            >
              <ListItemText 
                primary="Accounts" 
                primaryTypographyProps={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: themeColors.primary,
                }}
                sx={{ mr: 1 }}
              />
              {accountsOpen ? <ExpandLess sx={{ color: themeColors.primary }} /> : <ExpandMore sx={{ color: themeColors.primary }} />}
            </ListItemButton>
          )}
          <Collapse in={accountsOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {accountsGroups.map((group) => {
                const visibleItems = group.items.filter(item => isAdmin || hasPermission(item.permission, PERMISSION_TYPES.VIEW));
                if (visibleItems.length === 0) return null;
                return (
                  <React.Fragment key={group.groupTitle}>
                    <NavSubGroupHeader title={group.groupTitle} />
                    {visibleItems.map((module) => {
                      const isAccountActive = location.pathname === module.path;
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
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </List>
          </Collapse>

          {/* Features Section */}
          <ListItemButton
            onClick={handleFeaturesClick}
            sx={{
              minHeight: 44,
              borderTop: `1px solid ${themeColors.lightBlue}`,
              borderBottom: `1px solid ${themeColors.lightBlue}`,
              backgroundColor: themeColors.lighterBlue,
              px: 2,
            }}
          >
            <ListItemText 
              primary="Features" 
              primaryTypographyProps={{
                fontSize: '14px',
                fontWeight: 'bold',
                color: themeColors.primary,
              }}
              sx={{ mr: 1 }}
            />
            {featuresOpen ? <ExpandLess sx={{ color: themeColors.primary }} /> : <ExpandMore sx={{ color: themeColors.primary }} />}
          </ListItemButton>
          <Collapse in={featuresOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {featuresGroups.map((group) => {
                const visibleItems = group.items.filter(item => isAdmin || hasPermission(item.permission, PERMISSION_TYPES.VIEW));
                if (visibleItems.length === 0) return null;
                return (
                  <React.Fragment key={group.groupTitle}>
                    <NavSubGroupHeader title={group.groupTitle} />
                    {visibleItems.map((module) => (
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
                  </React.Fragment>
                );
              })}
            </List>
          </Collapse>

          {/* Company Section */}
          {(isAdmin || companyModules.some(c => hasPermission('Company', PERMISSION_TYPES.VIEW) || hasPermission(c.permission, PERMISSION_TYPES.VIEW) || hasPermission('Company Select', PERMISSION_TYPES.VIEW))) && (
            <ListItemButton
              onClick={handleCompanyClick}
              sx={{
                minHeight: 44,
                borderTop: `1px solid ${themeColors.lightBlue}`,
                borderBottom: `1px solid ${themeColors.lightBlue}`,
                backgroundColor: themeColors.lighterBlue,
                px: 2,
              }}
            >
              <ListItemText 
                primary="Company" 
                primaryTypographyProps={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: themeColors.primary,
                }}
                sx={{ mr: 1 }}
              />
              {companyOpen ? <ExpandLess sx={{ color: themeColors.primary }} /> : <ExpandMore sx={{ color: themeColors.primary }} />}
            </ListItemButton>
          )}
          <Collapse in={companyOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {companyModules
                .filter(module => isAdmin || hasPermission('Company', PERMISSION_TYPES.VIEW) || hasPermission(module.permission, PERMISSION_TYPES.VIEW) || hasPermission('Company Select', PERMISSION_TYPES.VIEW))
                .map((module) => {
                  const isCompActive = location.pathname === module.path;
                  return (
                    <ListItemButton 
                      key={module.name} 
                      component={Link} 
                      to={module.path}
                      onClick={toggleDrawer}
                      sx={{ 
                        pl: 4,
                        backgroundColor: isCompActive ? themeColors.primary : 'transparent',
                        '&:hover': {
                          backgroundColor: isCompActive ? themeColors.primary : themeColors.lightBlue,
                        }
                      }}
                    >
                      <ListItemText 
                        primary={module.name}
                        primaryTypographyProps={{
                          fontSize: '12px',
                          fontWeight: isCompActive ? 'bold' : 'normal',
                          color: isCompActive ? themeColors.white : themeColors.textPrimary,
                        }}
                      />
                    </ListItemButton>
                  );
                })}
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
  );
};

export default Navigation;
