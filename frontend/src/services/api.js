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

  // Resolve authentication & company headers from storage
  const authHeaders = {};
  try {
    const token = localStorage.getItem('erp_token');
    if (token) {
      authHeaders['Authorization'] = `Bearer ${token}`;
    }
    const selComp = localStorage.getItem('erp_selected_company') || localStorage.getItem('erp_company');
    if (selComp) {
      const parsedComp = JSON.parse(selComp);
      if (parsedComp && parsedComp.id) {
        authHeaders['X-Company-Id'] = String(parsedComp.id);
      }
    }
    const storedUser = localStorage.getItem('erp_user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      if (parsedUser && parsedUser.id) {
        authHeaders['X-User-Id'] = String(parsedUser.id);
      }
    }
  } catch (e) {}

  const maxRetries = options.method && options.method !== 'GET' ? 1 : 3;
  let lastErr = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: options.method || "GET",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
          ...(options.headers || {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      // If backend is still initializing (503 from proxy), retry if attempts remain
      if (res.status === 503 && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 400 * attempt));
        continue;
      }

      const text = await res.text();

      // ✅ Null-safe JSON parse
      if (!res.ok) {
        console.error("❌ API HTTP error:", res.status, res.statusText);
        console.error("❌ Response body:", text);
        let errorMsg = `HTTP ${res.status}: ${res.statusText}`;
        try {
          const parsed = JSON.parse(text);
          if (parsed) {
            if (typeof parsed.message === 'string') {
              errorMsg = parsed.message;
            } else if (typeof parsed.error === 'string') {
              errorMsg = parsed.error;
            } else if (parsed.error && typeof parsed.error === 'object' && parsed.error.message) {
              errorMsg = parsed.error.message;
            } else if (parsed.message && typeof parsed.message === 'object' && parsed.message.message) {
              errorMsg = parsed.message.message;
            } else if (parsed.error) {
              errorMsg = JSON.stringify(parsed.error);
            }
          }
        } catch (e) {}
        return { success: false, data: null, message: String(errorMsg) };
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
      lastErr = err;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 400 * attempt));
        continue;
      }
      console.error("🔥 API FAILED:", err);
      return { success: false, data: null, message: err?.message || 'Network request failed' };
    }
  }

  return { success: false, data: null, message: lastErr?.message || 'Network request failed' };
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

