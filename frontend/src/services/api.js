// Use relative URLs so that the application handles API calls locally
const BASE_URL = "";

console.log("🚀 BASE URL:", BASE_URL || "(relative — using Vite proxy)");

// ✅ BASE_URL must NOT include /api — it is added per-request below
export async function api(endpoint, options = {}) {
  if (!endpoint || typeof endpoint !== "string") {
    console.error("❌ Invalid endpoint:", endpoint);
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
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
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
    console.error("🔥 API FAILED:", err);
    return { success: false, data: null, message: err.message };
  }
}

// helpers

export const getMasters = (type) => api(`/masters/${type}`);

export const getNextLot = () => api(`/masters/lots/next`);

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

// Attach properties to api function for backward compatibility and to prevent runtime errors
api.get = (endpoint, options = {}) => api(endpoint, { ...options, method: "GET" });
api.post = (endpoint, body, options = {}) => api(endpoint, { ...options, method: "POST", body });
api.put = (endpoint, body, options = {}) => api(endpoint, { ...options, method: "PUT", body });
api.delete = (endpoint, options = {}) => api(endpoint, { ...options, method: "DELETE" });
api.getMasters = getMasters;
api.getNextLot = getNextLot;
api.getNextSNo = getNextSNo;
api.deleteMaster = (table, id) => api(`/masters/${table}/${id}`, { method: 'DELETE' });

// Export for backward compatibility
export default api;

