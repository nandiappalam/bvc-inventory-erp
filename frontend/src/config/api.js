// CONFLICTING API CONFIG BACKED UP TO api.js.conflicted.backup
// DEPRECATED - Use ../services/api.js instead
// This file no longer used to avoid duplicates

//import { invoke } from "@tauri-apps/api/core";
// Detect Tauri

// Detect Tauri environment
/*const isTauri =
  typeof window !== "undefined" &&
  window.__TAURI__ !== undefined;*/

// REMOVED: Duplicate const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

// REMOVED: Duplicate const isTauri = window.__TAURI__ !== undefined

// REMOVED: Duplicate export const API_BASE_URL = isTauri ? ...
// ===============================
// SAFE TAURI DETECTION
// ===============================
/*const isTauriApp = () => {
  return (
    typeof window !== "undefined" &&
    typeof window.__TAURI_IPC__ !== "undefined"
  );
};*/

// ===============================
// LAZY TAURI INVOKE (IMPORTANT FIX)
// ===============================
/*const tauriInvoke = async (cmd, args = {}) => {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke(cmd, args);
};*/
const isTauriApp = () => false;

// ===============================
// HTTP HEADERS (WEB ONLY)
// ===============================
export const getHeaders = () => ({
  "Content-Type": "application/json",
});

// ===============================
// ENDPOINT MAP → TAURI COMMANDS
// ===============================
const endpointToCommandMap = {
  // Masters
  "/masters/customer_master": "get_customers",
  "/masters/supplier_master": "get_suppliers",
  "/masters/item_master": "get_items",
  "/masters/item_group": "get_item_groups",
  "/masters/area_master": "get_areas",
  "/masters/city_master": "get_cities",
  "/masters/ledger_master": "get_ledgers",
  "/masters/ledger_group": "get_ledger_groups",
  "/masters/consignee_master": "get_consignees",
  "/masters/ptrans_master": "get_ptrans",
  "/masters/flourmill_master": "get_flour_mills",
  "/masters/papadcompany_master": "get_papad_companies",
  "/masters/sender_master": "get_senders",
  "/masters/transport_master": "get_transports",
  "/masters/weight_master": "get_weights",

  // Entries
  "/entries/sales": "create_sale_with_lots",
  "/entries/purchase": "create_purchase_with_lots",
  "/entries/sales_return": "create_sales_return",
  "/entries/purchase_return": "create_purchase_return",
  "/entries/advance": "create_advance",
  "/entries/flour_out": "create_flour_out",
  "/entries/flour_out_return": "create_flour_out_return",
  "/entries/grind": "create_grind",
  "/entries/papad_in": "create_papad_in",
  "/entries/packing": "create_packing",
  "/entries/quotation": "create_quotation",
  "/entries/stock_adjust": "create_stock_adjust",
  "/entries/weight_conversion": "create_weight_conversion",
  "/entries/sales_export": "create_sales_export",
  "/entries/sales_export_order": "create_sales_export_order",

  // Reports
  "/reports/stock": "get_stock_summary",
  "/reports/daybook": "get_daybook",
  "/reports/trial_balance": "get_trial_balance",
};

// ===============================
// CORE API
// ===============================
export const api = {
  get: async (endpoint, params = {}) => {
    /*if (isTauriApp()) {
      const cmd = endpointToCommandMap[endpoint];
      if (cmd) return tauriInvoke(cmd, params);}*/

      if (import.meta.env.DEV) 
       console.warn("Fallback to HTTP:", endpoint);
    

     const query = new URLSearchParams(params).toString();
     const url = query ? `${endpoint}?${query}` : endpoint; // REMOVED API_BASE_URL refs

     const res = await fetch(url);
     if (!res.ok) throw new Error(await res.text());
     return res.json();
  },

  post: async (endpoint, data = {}) => {
    if (isTauriApp()) {
      const cmd = endpointToCommandMap[endpoint];
      if (cmd) return tauriInvoke(cmd, data);
    }

    const res = await fetch(API_BASE_URL + endpoint, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });

    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  put: async (endpoint, data = {}) => {
    if (isTauriApp()) {
      const cmd = endpointToCommandMap[endpoint];
      if (cmd) return tauriInvoke(cmd, data);
    }

    const res = await fetch(API_BASE_URL + endpoint, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
  if (!res.ok) throw new Error(await res.text());

    return res.json();
  },

  delete: async (endpoint, data = {}) => {
    if (isTauriApp()) {
      const cmd = endpointToCommandMap[endpoint];
      if (cmd) return tauriInvoke(cmd, data);
    }

    const res = await fetch(API_BASE_URL + endpoint, {
      method: "DELETE",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });

    if (!res.ok) throw new Error(await res.text());


    return res.json();
  },
};

// ===============================
export default api;
// ===============================
// CORE API WRAPPER
// ===============================
/*export const api = {
  // =========================
  // GET
  // =========================
  get: async (endpoint, params = {}) => {
    if (isTauri) {
      const command = endpointToCommandMap[endpoint];
      if (!command) throw new Error(`No Tauri command mapped for ${endpoint}`);
      return await invoke(command, params);
    }

    const response = await fetch(API_BASE_URL + endpoint, {
      method: "GET",
      headers: getHeaders(),
    });

    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },

  // =========================
  // POST
  // =========================
  post: async (endpoint, data = {}) => {
    if (isTauri) {
      const command = endpointToCommandMap[endpoint];
      if (!command) throw new Error(`No Tauri command mapped for ${endpoint}`);
      return await invoke(command, data);
    }

    const response = await fetch(API_BASE_URL + endpoint, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },

  // =========================
  // PUT
  // =========================
  put: async (endpoint, data = {}) => {
    if (isTauri) {
      const command = endpointToCommandMap[endpoint];
      if (!command) throw new Error(`No Tauri command mapped for ${endpoint}`);
      return await invoke(command, data);
    }

    const response = await fetch(API_BASE_URL + endpoint, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },

  // =========================
  // DELETE
  // =========================
  delete: async (endpoint, data = {}) => {
    if (isTauri) {
      const command = endpointToCommandMap[endpoint];
      if (!command) throw new Error(`No Tauri command mapped for ${endpoint}`);
      return await invoke(command, data);
    }

    const response = await fetch(API_BASE_URL + endpoint, {
      method: "DELETE",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },
};

// ===============================
// EXPORT DEFAULT
// ===============================
export default {
  API_BASE_URL,
  api,
  getHeaders,
};*/