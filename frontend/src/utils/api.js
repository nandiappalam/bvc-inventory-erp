// Use relative URLs so that the application handles API calls locally
const BASE_URL = "";

console.log("🚀 BASE URL:", BASE_URL || "(relative — using Vite proxy)");

// ✅ BASE_URL must NOT include /api — it is added per-request below
export async function api(endpoint, options = {}) {
  if (!endpoint || typeof endpoint !== "string") {
    console.error("❌ Invalid endpoint:", endpoint)
    return null;
  }

  // Ensure leading slash
  if (!endpoint.startsWith("/")) {
    endpoint = "/" + endpoint;
  }

  // ✅ Prevent double /api — only prepend if not already present
  const cleanEndpoint = endpoint.startsWith("/api")
    ? endpoint
    : `/api${endpoint}`;

  let url = `${BASE_URL}${cleanEndpoint}`;

  // ✅ Handle query parameters if present
  if (options.params && typeof options.params === 'object') {
    const searchParams = new URLSearchParams();
    Object.entries(options.params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        searchParams.append(key, val);
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  console.log("🌐 FINAL URL:", url);

  try {
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    const text = await res.text();

    // ✅ Null-safe JSON parse
    if (!res.ok) {
      console.error("❌ API HTTP error:", res.status, res.statusText);
      console.error("❌ Response body:", text);
      let errorMsg = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const parsed = JSON.parse(text);
        if (parsed && (parsed.message || parsed.error)) {
          errorMsg = parsed.message || parsed.error;
        }
      } catch (e) {}
      return { success: false, data: null, message: errorMsg };
    }

    let json = null;
    try {
      json = text ? JSON.parse(text) : {};
    } catch (parseErr) {
      console.warn("⚠️ Response body is not valid JSON:", text.substring(0, 100));
      return { success: false, data: null, message: "Invalid JSON from server" };
    }

    const isReportOrAccount = endpoint.startsWith("/reports") || endpoint.startsWith("/accounts") || endpoint.startsWith("/api/reports") || endpoint.startsWith("/api/accounts");
    if (isReportOrAccount) {
      if (json && typeof json === 'object' && 'success' in json) {
        return json;
      }
      return { success: true, data: json };
    }
    return json;
  } catch (err) {
    console.error("🔥 API FAILED:", err.message);
    return { success: false, data: null, message: err.message };
  }
}

// Generic getMasters
export async function getMasters(type) {
  return api(`/masters/${type}`);
}

// CRUD functions  
export const createMaster = (table, data) => api(`masters/${table}`, { method: 'POST', body: data });
export const updateMaster = (table, id, data) => api(`masters/${table}/${id}`, { method: 'PUT', body: data });
export const deleteMaster = (table, id) => api(`masters/${table}/${id}`, { method: 'DELETE' });

// Specific master getters
export const getAreas = () => getMasters('areas');
export const getCities = () => getMasters('cities');
export const getCustomers = () => getMasters('customers');
export const getSuppliers = () => getMasters('suppliers');
export const getItems = () => getMasters('items');
export const getItemGroups = () => getMasters('item_groups');
export const getLedgerGroups = () => getMasters('ledger_groups');
export const getWeights = () => getMasters('weights');
export const getTransports = () => getMasters('transports');
export const getSenders = () => getMasters('senders');
export const getConsignees = () => getMasters('consignees');
export const getPapadCompanies = () => getMasters('papad_companies');

// Fallback getNextLot
export async function getNextLot() {
  const result = await api('/lots/next');
  return result || { lot_no: 'LOT001' };
}

// ✅ getNextSNo helper
export async function getNextSNo(endpoint) {
  try {
    const res = await api(endpoint);
    // If endpoint returned direct next_sno object
    if (res && typeof res === 'object' && !Array.isArray(res)) {
      const directSno = res.next_sno ?? res.s_no ?? res.sNo ?? res.data?.s_no ?? res.data?.next_sno ?? res.data?.sNo;
      if (directSno !== undefined && directSno !== null && !isNaN(parseInt(directSno)) && parseInt(directSno) > 0) {
        return parseInt(directSno);
      }
    }
    const list = res && (Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []));
    let max = list.length; // Max is at least the total record count (1 to N)
    list.forEach(item => {
      const val = parseInt(item.s_no || item.sNo || item.sno || item.id || item.bill_no || item.voucher_no || item.inv_no) || 0;
      if (val > max) max = val;
    });
    return max + 1;
  } catch (err) {
    console.error('Error fetching next S.No:', err);
    return 1;
  }
}

// ✅ Purchase API - uses existing backend /api/purchases
export const createPurchase = (formData, items, totals) => 
  api('/purchases', { 
    method: 'POST', 
    body: { formData, items, totals } 
  });

export const deletePurchase = (id) => api(`/purchases/${id}`, { method: 'DELETE' });

// ✅ Flour Out Return
export const createFlourOut = (formData, items) =>
  api('/flour-out', {
    method: 'POST',
    body: { formData, items }
  });

export const updateFlourOut = (id, formData, items) =>
  api(`/flour-out/${id}`, {
    method: 'PUT',
    body: { formData, items }
  });

export const deleteFlourOut = (id) =>
  api(`/flour-out/${id}`, {
    method: 'DELETE'
  });

export const createFlourOutReturn = (payload) =>
  api('/flour-out-return', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  });


// Attach properties to api function for backward compatibility and to prevent runtime errors
api.api = api;
api.get = (endpoint, options = {}) => api(endpoint, { ...options, method: "GET" });
api.post = (endpoint, body, options = {}) => api(endpoint, { ...options, method: "POST", body });
api.put = (endpoint, body, options = {}) => api(endpoint, { ...options, method: "PUT", body });
api.delete = (endpoint, options = {}) => api(endpoint, { ...options, method: "DELETE" });
api.getMasters = getMasters;
api.createMaster = createMaster;
api.updateMaster = updateMaster;
api.deleteMaster = deleteMaster;
api.getAreas = getAreas;
api.getCities = getCities;
api.getCustomers = getCustomers;
api.getSuppliers = getSuppliers;
api.getItems = getItems;
api.getItemGroups = getItemGroups;
api.getLedgerGroups = getLedgerGroups;
api.getWeights = getWeights;
api.getTransports = getTransports;
api.getSenders = getSenders;
api.getConsignees = getConsignees;
api.getPapadCompanies = getPapadCompanies;
api.getNextLot = getNextLot;
api.getNextSNo = getNextSNo;
api.createPurchase = createPurchase;
api.deletePurchase = deletePurchase;
api.createFlourOut = createFlourOut;
api.updateFlourOut = updateFlourOut;
api.deleteFlourOut = deleteFlourOut;
api.createFlourOutReturn = createFlourOutReturn;

export default api;

