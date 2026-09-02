/**
 * Tauri API Wrapper - Extended Version
 * This module provides functions to interact with the Tauri backend using invoke()
 * instead of HTTP calls. This enables the app to work offline without a Node.js server.
 * 
 * Uses Tauri v1 API (@tauri-apps/api)
 */

/*import { invoke } from '@tauri-apps/api';

// Check if running in Tauri environment
const isTauri = () => {
  try {
    return window.__TAURI__ !== undefined;
  } catch (e) {
    return false;
  }
};

// Generic invoke wrapper with error handling
const tauriInvoke = async (command, args = {}) => {
  try {
    if (!isTauri()) {
      throw new Error('Not running in Tauri environment');
    }
    return await invoke(command, args);
  } catch (error) {
    console.error(`Tauri command ${command} failed:`, error);
    throw error;
  }
};

// ==================== Purchase Commands ====================

export const getPurchases = () => tauriInvoke('get_purchases');

export const createPurchase = (formData, items, totals) => 
  tauriInvoke('create_purchase', { formData, items, totals });

export const updatePurchase = (id, formData, items, totals) => 
  tauriInvoke('update_purchase', { id, formData, items, totals });

export const deletePurchase = (id) => tauriInvoke('delete_purchase', { id });

// ==================== Sales Commands ====================

export const getSales = () => tauriInvoke('get_sales');

export const createSale = (formData, items, totals) => 
  tauriInvoke('create_sale', { formData, items, totals });

export const updateSale = (id, formData, items, totals) => 
  tauriInvoke('update_sale', { id, formData, items, totals });

export const deleteSale = (id) => tauriInvoke('delete_sale', { id });

// ==================== Master Data Commands ====================

// Customers
export const getCustomers = () => tauriInvoke('get_customers');
export const createCustomer = (data) => tauriInvoke('create_customer', { data });
export const updateCustomer = (id, data) => tauriInvoke('update_customer', { id, data });
export const deleteCustomer = (id) => tauriInvoke('delete_customer', { id });

// Suppliers
export const getSuppliers = () => tauriInvoke('get_suppliers');
export const createSupplier = (data) => tauriInvoke('create_supplier', { data });
export const updateSupplier = (id, data) => tauriInvoke('update_supplier', { id, data });
export const deleteSupplier = (id) => tauriInvoke('delete_supplier', { id });

// Items
export const getItems = () => tauriInvoke('get_items');
export const createItem = (data) => tauriInvoke('create_item', { data });
export const updateItem = (id, data) => tauriInvoke('update_item', { id, data });
export const deleteItem = (id) => tauriInvoke('delete_item', { id });

// ==================== Areas ====================

export const getAreas = () => tauriInvoke('get_areas');
export const createArea = (data) => tauriInvoke('create_area', { data });
export const updateArea = (id, data) => tauriInvoke('update_area', { id, data });
export const deleteArea = (id) => tauriInvoke('delete_area', { id });

// ==================== Cities ====================

export const getCities = () => tauriInvoke('get_cities');
export const createCity = (data) => tauriInvoke('create_city', { data });
export const updateCity = (id, data) => tauriInvoke('update_city', { id, data });
export const deleteCity = (id) => tauriInvoke('delete_city', { id });

// ==================== Transport ====================

export const getTransports = () => tauriInvoke('get_transports');
export const createTransport = (data) => tauriInvoke('create_transport', { data });
export const deleteTransport = (id) => tauriInvoke('delete_transport', { id });

// ==================== Flour Mills ====================

export const getFlourMills = () => tauriInvoke('get_flour_mills');
export const createFlourMill = (data) => tauriInvoke('create_flour_mill', { data });
export const deleteFlourMill = (id) => tauriInvoke('delete_flour_mill', { id });

// ==================== Consignees ====================

export const getConsignees = () => tauriInvoke('get_consignees');
export const createConsignee = (data) => tauriInvoke('create_consignee', { data });
export const deleteConsignee = (id) => tauriInvoke('delete_consignee', { id });

// ==================== PTrans ====================

export const getPTrans = () => tauriInvoke('get_ptrans');
export const createPTrans = (data) => tauriInvoke('create_ptrans', { data });
export const deletePTrans = (id) => tauriInvoke('delete_ptrans', { id });

// ==================== Papad Companies ====================

export const getPapadCompanies = () => tauriInvoke('get_papad_companies');
export const createPapadCompany = (data) => tauriInvoke('create_papad_company', { data });
export const deletePapadCompany = (id) => tauriInvoke('delete_papad_company', { id });

// ==================== Senders ====================

export const getSenders = () => tauriInvoke('get_senders');
export const createSender = (data) => tauriInvoke('create_sender', { data });
export const deleteSender = (id) => tauriInvoke('delete_sender', { id });

// ==================== Weights ====================

export const getWeights = () => tauriInvoke('get_weights');
export const createWeight = (data) => tauriInvoke('create_weight', { data });
export const deleteWeight = (id) => tauriInvoke('delete_weight', { id });

// ==================== Ledgers ====================

export const getLedgers = () => tauriInvoke('get_ledgers');
export const createLedger = (data) => tauriInvoke('create_ledger', { data });
export const updateLedger = (id, data) => tauriInvoke('update_ledger', { id, data });
export const deleteLedger = (id) => tauriInvoke('delete_ledger', { id });

// ==================== Ledger Groups ====================

export const getLedgerGroups = () => tauriInvoke('get_ledger_groups');
export const createLedgerGroup = (data) => tauriInvoke('create_ledger_group', { data });
export const deleteLedgerGroup = (id) => tauriInvoke('delete_ledger_group', { id });

// ==================== Item Groups ====================

export const getItemGroups = () => tauriInvoke('get_item_groups');
export const createItemGroup = (data) => tauriInvoke('create_item_group', { data });
export const deleteItemGroup = (id) => tauriInvoke('delete_item_group', { id });

// ==================== Deduction Sales ====================

export const getDeductionSales = () => tauriInvoke('get_deduction_sales');
export const createDeductionSales = (data) => tauriInvoke('create_deduction_sales', { data });
export const deleteDeductionSales = (id) => tauriInvoke('delete_deduction_sales', { id });

// ==================== Deduction Purchase ====================

export const getDeductionPurchase = () => tauriInvoke('get_deduction_purchase');
export const createDeductionPurchase = (data) => tauriInvoke('create_deduction_purchase', { data });
export const deleteDeductionPurchase = (id) => tauriInvoke('delete_deduction_purchase', { id });

// ==================== Companies ====================

export const getCompanies = () => tauriInvoke('get_companies');
export const createCompany = (data) => tauriInvoke('create_company', { data });

// ==================== Stock ====================

export const getStock = () => tauriInvoke('get_stock');
export const getAvailableLots = (itemName, itemId) => 
  tauriInvoke('get_available_lots', { itemName, itemId });

// ==================== Auth Commands ====================

export const login = (username, password) =>
  tauriInvoke('login', { username, password });

export const createUser = (companyId, username, password) =>
  tauriInvoke('create_user', { companyId, username, password });

// ==================== Generic Commands ====================

export const executeQuery = (sql, params = []) =>
  tauriInvoke('execute_query', { sql, params });

export const executeStatement = (sql, params = []) =>
  tauriInvoke('execute_statement', { sql, params });

export const healthCheck = () => tauriInvoke('health_check');

export const getDbPath = () => tauriInvoke('get_db_path');

// ==================== Utility Functions ====================

export const getTableData = async (tableName, orderBy = 'id DESC', limit = 100) => {
  const sql = `SELECT * FROM ${tableName} ORDER BY ${orderBy} LIMIT ?`;
  return executeQuery(sql, [limit]);
};

export const insertData = async (tableName, data) => {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map(() => '?').join(', ');
  const sql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
  return executeStatement(sql, values);
};

export const updateData = async (tableName, id, data) => {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const setClause = keys.map(k => `${k} = ?`).join(', ');
  const sql = `UPDATE ${tableName} SET ${setClause} WHERE id = ?`;
  return executeStatement(sql, [...values, id]);
};

export const deleteData = async (tableName, id) => {
  const sql = `UPDATE ${tableName} SET status = 'Inactive' WHERE id = ?`;
  return executeStatement(sql, [id]);
};

export default {
  isTauri,
  tauriInvoke,
  // Purchases
  getPurchases, createPurchase, updatePurchase, deletePurchase,
  // Sales
  getSales, createSale, updateSale, deleteSale,
  // Customers
  getCustomers, createCustomer, updateCustomer, deleteCustomer,
  // Suppliers
  getSuppliers, createSupplier, updateSupplier, deleteSupplier,
  // Items
  getItems, createItem, updateItem, deleteItem,
  // Areas
  getAreas, createArea, updateArea, deleteArea,
  // Cities
  getCities, createCity, updateCity, deleteCity,
  // Transport
  getTransports, createTransport, deleteTransport,
  // Flour Mills
  getFlourMills, createFlourMill, deleteFlourMill,
  // Consignees
  getConsignees, createConsignee, deleteConsignee,
  // PTrans
  getPTrans, createPTrans, deletePTrans,
  // Papad Companies
  getPapadCompanies, createPapadCompany, deletePapadCompany,
  // Senders
  getSenders, createSender, deleteSender,
  // Weights
  getWeights, createWeight, deleteWeight,
  // Ledgers
  getLedgers, createLedger, updateLedger, deleteLedger,
  // Ledger Groups
  getLedgerGroups, createLedgerGroup, deleteLedgerGroup,
  // Item Groups
  getItemGroups, createItemGroup, deleteItemGroup,
  // Deduction Sales
  getDeductionSales, createDeductionSales, deleteDeductionSales,
  // Deduction Purchase
  getDeductionPurchase, createDeductionPurchase, deleteDeductionPurchase,
  // Companies
  getCompanies, createCompany,
  // Stock
  getStock, getAvailableLots,
  // Auth
  login, createUser,
  // Generic
  executeQuery, executeStatement, healthCheck, getDbPath,
  // Utilities
  getTableData, insertData, updateData, deleteData,
};
*/