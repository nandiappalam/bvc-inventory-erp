// Dropdown mappings (API tables)
export const MASTER_FIELD_TYPES = {
  item_group: "item_groups",
  ledger_group: "ledgergroupmaster",
  ledger: "ledgermaster",
  area: "area_master",
  city: "city_master",
  transport: "transport_master",
  p_trans: "ptrans_master",
  sender: "sender_group_master",
  consignee: "consignee_group_master",
  godown: "godown_master",
  flour_mill: "flour_mill_master",
  papad_company: "papad_company_master",
  weight: "weightmaster",
  statuses: ["Active", "Inactive"], // Static
  deduction_type: ["%", "Amount"], // Static
  nature: ["Assets", "Liabilities", "Income", "Expense"] // Ledger Group
};

export const safeArray = (data) => Array.isArray(data) ? data : [];

// Input type overrides
export const FIELD_TYPES = {
  tax: "number",
  ed_percent: "number",
  phone: "number",
  address: "textarea",
  value: "number",
  wages_kg: "number",
  opening_balance: "number",
  limit_days: "number",
  limit_amount: "number",
  weight: "number",
};

// Status dropdown for ALL modules
const STATUS_FIELD = { 
  name: "status", 
  label: "Status", 
  type: "select", 
  options: ["Active", "Inactive"], 
  defaultValue: "Active" 
};

/*
DEPRECATED: MASTER_CONFIG moved to masterConfig.js
Keep only types/utils here.
*/

export const useMasterConfig = (moduleName) => {
  // Legacy hook - redirect to masterConfig
  console.warn('useMasterConfig from masterFields.js is deprecated. Use masterConfig.js directly.');
  return null;
};
