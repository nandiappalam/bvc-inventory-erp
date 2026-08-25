import React, { createContext, useContext, useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api';
import api from '../services/api.js';

// Check if running in Tauri environment (Tauri v1 uses window.__TAURI__)
const isRunningInTauri = () => {
  try {
    return typeof window !== 'undefined' && window.__TAURI__ !== undefined;
  } catch (e) {
    return false;
  }
};

const AuthContext = createContext(null);

// Page types
export const PAGE_TYPES = {
  CREATE: 'Create',
  DISPLAY: 'Display'
};

// Permission action types
export const PERMISSION_ACTIONS = {
  VIEW: 'can_view',
  CREATE: 'can_create',
  EDIT: 'can_edit',
  DELETE: 'can_delete',
  PRINT: 'can_print'
};

// Permission types (for permission_type field)
export const PERMISSION_TYPES = {
  FULL: 'Full',
  CREATE: 'Create',
  EDIT: 'Edit',
  DELETE: 'Delete',
  VIEW: 'View'
};

// Module categories - with full company modules
export const MODULE_CATEGORIES = {
  // Master Modules
  MASTER: [
    'Item', 'Item Group', 'Deduction Sales', 'Deduction Purchase', 'Customer', 'Supplier', 
    'Flour Mill', 'Papad Company', 'Weight', 'Ledger Group', 'Ledger', 'Area', 'City', 
    'Consignee', 'P.Trans', 'Sender', 'Transport', 'Godown'
  ],
  // Entry Modules
  ENTRY: [
    'Purchase Order', 'Purchase', 'Purchase Return', 'Quality Control', 'Incoming Quality', 
    'Advance', 'Flour Out', 'Flour Out Return', 'Grind', 'Papad In', 'Papad Return', 'Packing', 
    'Open', 'Quotation', 'Sales', 'Sales Order', 'Sales Export', 'Sales Export Order', 
    'Sales Return', 'Stock Adjust', 'Weight Conversion', 'Voucher', 'Vehicle Movement', 'Cheque Printing'
  ],
  // Quality Control Modules
  QUALITY: [
    'Quality Dashboard', 'Purchase Lab Entry', 'Parameter Registry', 'QC Template Master', 
    'Quality Control', 'Incoming Quality'
  ],
  // Report Modules
  REPORTS: [
    'Stock Report', 'Stock Status', 'Lot History', 'Purchase Register',
    'Purchase Return Register', 'Sales Register', 'Sales Return Register', 'Papad Ledger'
  ],
  // Accounts Modules
  ACCOUNTS: [
    'Voucher Register', 'Voucher Book', 'Voucher', 'General Ledger', 'Supplier Ledger', 
    'Day Book', 'Trial Balance', 'Balance Sheet', 'Profit & Loss',
    'Ledger Statement', 'Outstanding Summary', 'Outstanding Details'
  ],
  // Features & System Modules
  FEATURES: [
    'User', 'User Activities', 'Setup', 'General Setup', 'User Creation', 
    'User Display', 'User Change Password', 'Financial Year', 'Database Utility'
  ],
  // Company Modules
  COMPANY: [
    'Company', 'Company Select', 'Company Create', 'Company Display'
  ]
};

// Features menu items with page-level permissions
export const FEATURES_MENU = [
  { name: 'User Activities', path: '/features/user-activities', page: 'Display', icon: '📋' },
  { name: 'Setup', path: '/features/setup', page: 'Setup', icon: '⚙️' },
  { name: 'General Setup', path: '/features/general-setup', page: 'GeneralSetup', icon: '🛠️' },
  { name: 'User Creation', path: '/features/user-create', page: 'Create', icon: '👤' },
  { name: 'User Display', path: '/features/user-display', page: 'Display', icon: '👥' },
  { name: 'User Change Password', path: '/features/change-password', page: 'ChangePassword', icon: '🔑' },
  { name: 'Financial Year', path: '/features/financial-year', page: 'Display', icon: '📅' },
  { name: 'Database Utility', path: '/db-utility', page: 'DatabaseUtility', icon: '💾' }
];

// Company menu items with page-level permissions
export const COMPANY_MENU = [
  { name: 'Select Company', path: '/company-select', page: 'Select', icon: '🏢' },
  { name: 'Create Company', path: '/company-create', page: 'Create', icon: '➕' },
  { name: 'Alter Company', path: '/company-alter/:id', page: 'Alter', icon: '✏️' },
  { name: 'Company Backup', path: '/company-backup', page: 'Backup', icon: '💾' },
  { name: 'Company Attach', path: '/company-attach', page: 'Attach', icon: '🔗' }
];

// Default permissions for admin - full access to all modules and pages
export const ADMIN_PERMISSIONS = [];

// Get all modules as a flat array
export const getAllModules = () => Object.values(MODULE_CATEGORIES).flat();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loginHistoryId, setLoginHistoryId] = useState(null);
const [financialYear, setFinancialYear] = useState('2024-2025');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
  };

  // Check for stored session on mount
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setCompany(null);
      setSelectedCompany(null);
      setPermissions([]);
      setIsAdmin(false);
      setLoginHistoryId(null);
    };

    window.addEventListener('erp:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('erp:unauthorized', handleUnauthorized);
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem('erp_user');
    const storedCompany = localStorage.getItem('erp_company');
    const storedSelectedCompany = localStorage.getItem('erp_selected_company');
    const storedPermissions = localStorage.getItem('erp_permissions');
    const storedIsAdmin = localStorage.getItem('erp_isAdmin');
    const storedLoginHistoryId = localStorage.getItem('erp_login_history_id');
    const storedFinancialYear = localStorage.getItem('erp_financial_year');

    const storedToken = localStorage.getItem('erp_token');
    if (storedUser && storedSelectedCompany && (isRunningInTauri() || storedToken)) {
      setUser(JSON.parse(storedUser));
      setCompany(JSON.parse(storedCompany));
      setSelectedCompany(JSON.parse(storedSelectedCompany));
      setIsAdmin(storedIsAdmin === 'true');
      setLoginHistoryId(storedLoginHistoryId);
      if (storedPermissions) {
        setPermissions(JSON.parse(storedPermissions));
      }
      if (storedFinancialYear) {
        setFinancialYear(storedFinancialYear);
      }
    } else if (storedUser || storedSelectedCompany) {
      localStorage.removeItem('erp_user');
      localStorage.removeItem('erp_company');
      localStorage.removeItem('erp_selected_company');
      localStorage.removeItem('erp_permissions');
      localStorage.removeItem('erp_isAdmin');
      localStorage.removeItem('erp_login_history_id');
      localStorage.removeItem('erp_financial_year');
    }
    setLoading(false);
  }, []);

  // Fetch current active financial year whenever selectedCompany is set or changed
  useEffect(() => {
    let isMounted = true;
    const fetchCurrentFY = async () => {
      if (!user || !selectedCompany || (!isRunningInTauri() && !localStorage.getItem('erp_token'))) {
        return;
      }
      const companyId = selectedCompany?.id || 1;
      try {
        const data = await api('/financial-years/current', { params: { company_id: companyId } });
        if (isMounted && data && data.financial_year) {
          setFinancialYear(data.financial_year);
          localStorage.setItem('erp_financial_year', data.financial_year);
        }
      } catch (err) {
        // Fallback silently if server is starting or endpoint unavailable
      }
    };
    fetchCurrentFY();
    return () => { isMounted = false; };
  }, [user, selectedCompany?.id]);

  // Login function
  const login = async (loginData) => {
    try {
      // Guard against null/invalid login data
      if (!loginData || typeof loginData !== 'object') {
        console.error('Login failed: invalid response', loginData);
        return { success: false, message: 'Invalid login response from server' };
      }

      // Extract data from login response
      const userData = loginData.user || {
        id: loginData.user_id,
        username: loginData.username,
        role: loginData.role,
      };
      if (loginData.token) userData.token = loginData.token;
      
      const companyData = loginData.company || {
        id: loginData.company_id,
        name: loginData.company_name,
      };

      // Set state
      setUser(userData);
      setCompany(companyData);
      setSelectedCompany(companyData);
      setIsAdmin(loginData.isAdmin || loginData.role === 'Admin' || loginData.role === 'admin');
      setPermissions(loginData.permissions || []);
      setLoginHistoryId(loginData.login_history_id);

      // Store in localStorage for persistence
      if (loginData.token) localStorage.setItem('erp_token', loginData.token);
      localStorage.setItem('erp_user', JSON.stringify(userData));
      localStorage.setItem('erp_company', JSON.stringify(companyData));
      localStorage.setItem('erp_selected_company', JSON.stringify(companyData));
      localStorage.setItem('erp_permissions', JSON.stringify(loginData.permissions || []));
      localStorage.setItem('erp_isAdmin', String(loginData.isAdmin || loginData.role === 'Admin' || loginData.role === 'admin'));
      localStorage.setItem('erp_login_history_id', String(loginData.login_history_id || ''));

      return { success: true };
    } catch (error) {
      console.error('Login error in context:', error);
      return { success: false, message: error.message };
    }
  };

  // Logout function
  const logout = async () => {
    try {
      if (loginHistoryId) {
        // Try Tauri invoke first, fall back to fetch for dev mode
        const runningInTauri = isRunningInTauri();
        if (runningInTauri) {
          try {
            await invoke('logout', { login_history_id: loginHistoryId });
          } catch (e) {
            console.warn('Tauri logout failed:', e);
          }
        } else {
          await api('/auth/logout', { method: 'POST', body: { login_history_id: loginHistoryId } });
        }
      }
    } catch (error) {
      console.error('Logout error:', error);
    }

    // Clear state
    setUser(null);
    setCompany(null);
    setSelectedCompany(null);
    setPermissions([]);
    setIsAdmin(false);
    setLoginHistoryId(null);

    // Clear localStorage
    localStorage.removeItem('erp_token');
    localStorage.removeItem('erp_user');
    localStorage.removeItem('erp_company');
    localStorage.removeItem('erp_selected_company');
    localStorage.removeItem('erp_permissions');
    localStorage.removeItem('erp_isAdmin');
    localStorage.removeItem('erp_login_history_id');
  };

  // Select company (before login)
  const selectCompany = (companyData) => {
    setSelectedCompany(companyData);
    localStorage.setItem('erp_selected_company', JSON.stringify(companyData));
  };

  // Helper to normalize action keys
  const mapActionKey = (act) => {
    if (!act) return 'can_view';
    const a = String(act).toLowerCase().trim();
    if (a === 'view' || a === 'can_view') return 'can_view';
    if (a === 'create' || a === 'can_create') return 'can_create';
    if (a === 'edit' || a === 'can_edit') return 'can_edit';
    if (a === 'delete' || a === 'can_delete') return 'can_delete';
    if (a === 'print' || a === 'can_print') return 'can_print';
    if (a === 'full') return 'full';
    return 'can_view';
  };

  // Check if user has permission for a specific module, page and action
  const hasPermission = (moduleName, arg2, arg3) => {
    // Admin has full access
    if (isAdmin) return true;
    if (!moduleName || !permissions || !Array.isArray(permissions) || permissions.length === 0) return false;

    let pageName = null;
    let actionKey = 'can_view';

    if (arg3 !== undefined) {
      pageName = arg2;
      actionKey = mapActionKey(arg3);
    } else if (arg2 !== undefined) {
      const actString = String(arg2).toLowerCase().trim();
      if (['view', 'can_view', 'create', 'can_create', 'edit', 'can_edit', 'delete', 'can_delete', 'print', 'can_print', 'full'].includes(actString)) {
        actionKey = mapActionKey(arg2);
      } else {
        pageName = arg2;
        actionKey = 'can_view';
      }
    }

    const normModuleName = String(moduleName).toLowerCase().trim();
    const aliases = [normModuleName];
    if (normModuleName === 'purchase') aliases.push('purchases');
    if (normModuleName === 'purchases') aliases.push('purchase');
    if (normModuleName === 'grind') aliases.push('flour out');
    if (normModuleName === 'flour out') aliases.push('grind');
    if (normModuleName === 'sales') aliases.push('sale');
    if (normModuleName === 'sale') aliases.push('sales');

    const modulePerms = permissions.filter(
      p => p.module_name && aliases.includes(String(p.module_name).toLowerCase().trim())
    );

    if (modulePerms.length === 0) return false;

    const targetPerms = pageName
      ? modulePerms.filter(p => p.page_name && String(p.page_name).toLowerCase().trim() === String(pageName).toLowerCase().trim())
      : modulePerms;

    if (targetPerms.length === 0) {
      if (actionKey === 'full') {
        return modulePerms.some(p => p.can_view || p.can_create || p.can_edit || p.can_delete || p.can_print);
      }
      return modulePerms.some(p => p[actionKey] === 1 || p[actionKey] === true || p[actionKey] === '1');
    }

    if (actionKey === 'full') {
      return targetPerms.some(p => p.can_view || p.can_create || p.can_edit || p.can_delete || p.can_print);
    }

    return targetPerms.some(p => p[actionKey] === 1 || p[actionKey] === true || p[actionKey] === '1');
  };

  // Get user's permitted modules for a specific page and action
  const getPermittedModules = (category, pageName = 'Display', action = 'can_view') => {
    if (isAdmin) return MODULE_CATEGORIES[category] || [];
    
    const categoryModules = MODULE_CATEGORIES[category] || [];
    return categoryModules.filter(module => 
      permissions.some(p => 
        (p.module_name === module || p.module_name.toLowerCase() === module.toLowerCase()) &&
        (p.page_name === pageName || p.page_name.toLowerCase() === pageName.toLowerCase()) &&
        p[action] === 1
      )
    );
  };

  // Get all permissions for a specific module
  const getModulePermissions = (moduleName, pageName = 'Display') => {
    if (isAdmin) {
      return {
        can_view: 1,
        can_create: 1,
        can_edit: 1,
        can_delete: 1,
        can_print: 1
      };
    }
    
    const modulePerm = permissions.find(
      p => (p.module_name === moduleName || p.module_name.toLowerCase() === moduleName.toLowerCase()) &&
           (p.page_name === pageName || p.page_name.toLowerCase() === pageName.toLowerCase())
    );

    return modulePerm || {
      can_view: 0,
      can_create: 0,
      can_edit: 0,
      can_delete: 0,
      can_print: 0
    };
  };

  // Update financial year
  const updateFinancialYear = (year) => {
    setFinancialYear(year);
    localStorage.setItem('erp_financial_year', year);
  };

const value = {
    user,
    company,
    selectedCompany,
    permissions,
    isAdmin,
    loading,
    financialYear,
    isSidebarOpen,
    toggleSidebar,
    login,
    logout,
    selectCompany,
    hasPermission,
    getPermittedModules,
    getModulePermissions,
    updateFinancialYear,
    setSelectedCompany
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
