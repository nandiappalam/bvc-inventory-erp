/**
 * Tauri API Wrapper - COMPLETE with Company functions
 

import { invoke } from '@tauri-apps/api';
import api from './api.js';

export const safeArray = api.safeArray;
export const getUsers = (companyId) => invoke('get_users', { companyId });
export const deleteMaster = (table, id) => invoke('delete_master', { table, id });
export const executeQuery = (sql, params = []) => invoke('execute_query', { sql, params });
export const executeStatement = (sql, params = []) => invoke('execute_statement', { sql, params });

// COMPANY FUNCTIONS]
export const getCompanies = () => invoke('get_companies');
export const createCompany = (companyName, address, gstNumber, contact, email) => invoke('create_company', { companyName, address, gstNumber, contact, email });
export const getCompany = (id) => invoke('get_company', { id });
export const updateCompany = (id, companyName, address, gstNumber, contact, email) => invoke('update_company', { id, companyName, address, gstNumber, contact, email });

// CRUD OPERATIONS
export const getPurchases = () => invoke('get_purchases');
export const createPurchase = (formData, items, totals) => invoke('create_purchase', { formData, items, totals });
export const getSales = () => invoke('get_sales');
export const createSale = (formData, items, totals) => invoke('create_sale', { formData, items, totals });
export const getCustomers = () => invoke('get_customers');
export const createCustomer = (data) => invoke('create_customer', { data });
export const getSuppliers = () => invoke('get_suppliers');
export const createSupplier = (data) => invoke('create_supplier', { data });
export const getItems = () => api.getMasters('items');

// DEPRECATED: Use api.createMaster("table_name", data) 
// Specific for compatibility
export const createItem = (data) => invoke('create_master', { table: 'item_master', data });
export const createArea = (data) => invoke('create_master', { table: 'area_master', data });
export const createCity = (data) => invoke('create_master', { table: 'city_master', data });
export const getAreas = () => api.getMasters('area_master');
export const getCities = () => api.getMasters('city_master');

// Specific CRUD (kept for existing specific invokes)
export const getConsignees = () => invoke('get_consignees');
export const createConsignee = (data) => invoke('create_consignee', { data });
export const deleteConsignee = (id) => invoke('delete_consignee', { id });
export const getPTrans = () => invoke('get_ptrans');
export const createPTrans = (data) => invoke('create_ptrans', { data });
export const updatePTrans = (id, data) => invoke('update_ptrans', { id, data });
export const deletePTrans = (id) => invoke('delete_ptrans', { id });
export const getFlourMills = () => invoke('get_flour_mills');
export const createFlourMill = (data) => invoke('create_flour_mill', { data });
export const deleteFlourMill = (id) => invoke('delete_flour_mill', { id });
export const getPapadCompanies = () => invoke('get_papad_companies');
export const createPapadCompany = (data) => invoke('create_papad_company', { data });
export const deletePapadCompany = (id) => invoke('delete_papad_company', { id });
export const getSenders = () => invoke('get_senders');
export const createSender = (data) => invoke('create_sender', { data });
export const deleteSender = (id) => invoke('delete_sender', { id });
export const getTransports = () => invoke('get_transports');
export const createTransport = (data) => invoke('create_transport', { data });
export const deleteTransport = (id) => invoke('delete_transport', { id });
export const getWeights = () => invoke('get_weights');
export const createWeight = (data) => invoke('create_weight', { data });
export const deleteWeight = (id) => invoke('delete_weight', { id });
export const getLedgers = () => invoke('get_ledgers');
export const createLedger = (data) => invoke('create_ledger', { data });
export const updateLedger = (id, data) => invoke('update_ledger', { id, data });
export const deleteLedger = (id) => invoke('delete_ledger', { id });
export const getLedgerGroups = () => invoke('get_ledger_groups');
export const createLedgerGroup = (data) => invoke('create_ledger_group', { data });
export const deleteLedgerGroup = (id) => invoke('delete_ledger_group', { id });
export const getItemGroups = () => api.getMasters('item_groups');
export const createItemGroup = (data) => invoke('create_item_group', { data });
export const deleteItemGroup = (id) => invoke('delete_item_group', { id });

// REPORTS
export const getDeductionSales = () => invoke('get_deduction_sales');
export const createDeductionSales = (data) => invoke('create_deduction_sales', { data });
export const deleteDeductionSales = (id) => invoke('delete_deduction_sales', { id });
export const getDeductionPurchase = () => invoke('get_deduction_purchase');
export const createDeductionPurchase = (data) => invoke('create_deduction_purchase', { data });
export const deleteDeductionPurchase = (id) => invoke('delete_deduction_purchase', { id });
export const getDayBookReport = (fromDate, toDate) => invoke('get_day_book_report', { fromDate, toDate });
export const getTrialBalanceReport = () => invoke('get_trial_balance_report');
export const getProfitLossReport = () => invoke('get_profit_loss_report');
export const getLedgerStatementReport = (ledgerId, fromDate, toDate) => invoke('get_ledger_statement_report', { ledgerId, fromDate, toDate });
export const getOutstandingSummaryReport = () => invoke('get_outstanding_summary_report');
export const getOutstandingDetailsReport = () => invoke('get_outstanding_details_report');

// ==========================
// UPDATE/DELETE MASTER HELPERS - For UI compatibility
// ==========================
export const updateArea = (id, data) => invoke('update_master', { table: 'area_master', id, data });
export const updateCity = (id, data) => invoke('update_master', { table: 'city_master', id, data });
export const updateItem = (id, data) => invoke('update_master', { table: 'item_master', id, data });
export const updateCustomer = (id, data) => invoke('update_master', { table: 'customer_master', id, data });
export const updateSupplier = (id, data) => invoke('update_master', { table: 'supplier_master', id, data });
export const updateGodown = (id, data) => invoke('update_master', { table: 'godown_master', id, data });

export const deleteArea = (id) => deleteMaster("area_master", id);
export const deleteCity = (id) => deleteMaster("city_master", id);
export const deleteItem = (id) => deleteMaster("item_master", id);
export const deleteCustomer = (id) => deleteMaster("customer_master", id);
export const deleteSupplier = (id) => deleteMaster("supplier_master", id);
export const deleteGodown = (id) => deleteMaster("godown_master", id);

export default {

  getCompanies, createCompany, getCompany, updateCompany,
  getUsers, deleteMaster, executeQuery, executeStatement, safeArray,
  getPurchases, createPurchase, getSales, createSale,
  getCustomers, createCustomer, getSuppliers, createSupplier,
  // all other functions
};

*/