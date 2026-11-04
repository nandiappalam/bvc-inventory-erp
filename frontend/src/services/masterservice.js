import api from '../services/api.js';

// Re-export api for direct use
export { api };

export const safeArray = (data) => Array.isArray(data) ? data : [];

// In-memory cache for master dropdowns and records to prevent repeated network spam and empty UI states
const masterCache = new Map();
const inFlightRequests = new Map();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds fresh TTL

export const getTenantCacheScope = () => {
  try {
    const storedCompany = localStorage.getItem('erp_selected_company') || localStorage.getItem('erp_company');
    const parsedCompany = storedCompany ? JSON.parse(storedCompany) : null;
    const companyId = parsedCompany && typeof parsedCompany === 'object'
      ? parsedCompany.id
      : parsedCompany;
    return String(companyId || 'default');
  } catch (error) {
    return 'default';
  }
};

const getTenantCacheKey = (key) => `${getTenantCacheScope()}::${key}`;

export const normalizeMasterKey = (type) => {
  if (!type) return '';
  let k = String(type).trim().toLowerCase();
  if (k.endsWith('_master')) k = k.replace(/_master$/, '');
  if (k === 'supplier' || k === 'suppliers' || k === 'supplier_id' || k === 'supplierid' || k === 'supplier_name' || k === 'suppliername') return 'suppliers';
  if (k === 'customer' || k === 'customers' || k === 'customer_id' || k === 'customerid' || k === 'customer_name' || k === 'customername' || k === 'exporter' || k === 'buyer_other' || k === 'buyer') return 'customers';
  if (k === 'item' || k === 'items' || k === 'item_id' || k === 'itemid' || k === 'item_name' || k === 'itemname') return 'items';
  if (k === 'godown' || k === 'godowns' || k === 'godown_id' || k === 'godownid' || k === 'godown_from' || k === 'godown_to' || k === 'godown_from_id' || k === 'godown_to_id' || k === 'from_godown_id' || k === 'to_godown_id' || k === 'godown_name' || k === 'from_godown' || k === 'to_godown') return 'godowns';
  if (k === 'transport' || k === 'transports' || k === 'transporter' || k === 'transporters' || k === 'transport_id' || k === 'transportid' || k === 'pur_trans' || k === 'pur_transport' || k === 'purtransport' || k === 'ship_via' || k === 'driver' || k === 'lorry_no') return 'transports';
  if (k === 'weight' || k === 'weights' || k === 'weight_id' || k === 'weightid' || k === 'wt' || k === 'weightmaster') return 'weights';
  if (k === 'area' || k === 'areas' || k === 'area_id') return 'areas';
  if (k === 'city' || k === 'cities' || k === 'city_id') return 'cities';
  if (k === 'sign' || k === 'signs' || k === 'sign_id' || k === 'signid') return 'sign_master';
  if (k === 'terms' || k === 'term' || k === 'terms_id') return 'terms_master';
  if (k === 'sender' || k === 'senders' || k === 'sender_id' || k === 'senderid' || k === 'sender_name' || k === 'sender_group') return 'senders';
  if (k === 'consignee' || k === 'consignees' || k === 'consignee_id' || k === 'consigneeid' || k === 'consignee_name' || k === 'consigned_to' || k === 'consignedto' || k === 'consignee_group') return 'consignees';
  if (k === 'papad_company' || k === 'papad_companies' || k === 'papadcompany' || k === 'papadcomp' || k === 'papad_comp' || k === 'papad_company_id' || k === 'papad_company_name' || k === 'papadcompany') return 'papad_companies';
  if (k === 'flour_mill' || k === 'flour_mills' || k === 'flourmill' || k === 'flour_mill_id' || k === 'flourmill_id' || k === 'mill' || k === 'mills' || k === 'flour_mill_name' || k === 'flourmill') return 'flour_mills';
  if (k === 'deduction_purchase' || k === 'deduction_purchases' || k === 'purchase_deductions' || k === 'deductions' || k === 'deduction') return 'deduction_purchase';
  if (k === 'deduction_sales' || k === 'sales_deductions' || k === 'deduction_sale') return 'deduction_sales';
  if (k === 'item_group' || k === 'item_groups') return 'item_groups';
  if (k === 'worker' || k === 'workers' || k === 'worker_master' || k === 'loadman' || k === 'loadmen' || k === 'loadman_team' || k === 'loadman_name' || k === 'operational_parties') return 'workers';
  return k;
};

// Clear cached master records when records are created, updated, or deleted
export const invalidateMasterCache = (type) => {
  if (!type) {
    masterCache.clear();
    inFlightRequests.clear();
    return;
  }
  const keysToDelete = new Set([
    normalizeMasterKey(type),
    String(type).toLowerCase().trim(),
    `all_${normalizeMasterKey(type)}`,
    `all_${String(type).toLowerCase().trim()}`,
  ]);
  const tenantPrefix = `${getTenantCacheKey('')}`;
  for (const [cacheKey] of masterCache) {
    if (cacheKey.startsWith(tenantPrefix)
      && keysToDelete.has(cacheKey.slice(tenantPrefix.length))) {
      masterCache.delete(cacheKey);
    }
  }
  for (const [requestKey] of inFlightRequests) {
    if (requestKey.startsWith(tenantPrefix)
      && keysToDelete.has(requestKey.slice(tenantPrefix.length))) {
      inFlightRequests.delete(requestKey);
    }
  }
};

const makeDualArray = (list) => {
  const arr = Array.isArray(list) ? [...list] : [];
  arr.data = arr;
  arr.success = true;
  return arr;
};

export const FALLBACK_MASTERS = {};

export const getCachedMasters = (type) => {
  if (!type) return [];
  const key = normalizeMasterKey(type);
  const cacheKey = getTenantCacheKey(key);
  if (masterCache.has(cacheKey)) {
    return masterCache.get(cacheKey).data || [];
  }
  return [];
};

export const getMasters = async (type, options = {}) => {
  if (!type) return makeDualArray([]);
  const key = normalizeMasterKey(type);
  const cacheKey = getTenantCacheKey(key);
  const now = Date.now();
  const forceRefresh = options?.forceRefresh || false;

  // 1. Check existing fresh cache
  if (!forceRefresh && masterCache.has(cacheKey)) {
    const cached = masterCache.get(cacheKey);
    if (now - cached.timestamp < CACHE_TTL_MS) {
      return makeDualArray(cached.data);
    }
  }

  // 2. Reuse in-flight request to prevent simultaneous duplicate requests
  if (inFlightRequests.has(cacheKey)) {
    try {
      const res = await inFlightRequests.get(cacheKey);
      if (res && res.length > 0) {
        return makeDualArray(res);
      }
    } catch (e) {
      // Fall through to retry if in-flight failed
    }
  }

  // 3. Dispatch fresh request with retry logic
  const requestPromise = (async () => {
    let lastError = null;
    const maxRetries = 2;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await api(`/masters/${key}`);
        if (result !== undefined && result !== null) {
          if (result.success === false) {
            throw new Error(result.message || result.error || `Failed to fetch master for ${key}`);
          }
          let list = null;
          // Direct array response
          if (Array.isArray(result)) {
            list = result;
          } else if (Array.isArray(result.data)) {
            list = result.data;
          } else if (result.success) {
            list = Array.isArray(result.data) ? result.data : [];
          }

          if (list !== null) {
            // Only cache if we actually got non-empty data
            // This prevents caching an empty [] during cold starts or transient network failures on Render
            if (list.length > 0) {
              masterCache.set(cacheKey, { data: list, timestamp: Date.now() });
            }
            return list;
          }
        }
        lastError = new Error(result?.message || result?.error || `Failed to fetch master for ${key}`);
      } catch (err) {
        lastError = err;
      }

      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 250 * attempt));
      }
    }

    throw lastError || new Error(`Failed to fetch master for ${key}`);
  })();

  inFlightRequests.set(cacheKey, requestPromise);

  try {
    const resultList = await requestPromise;
    return makeDualArray(resultList);
  } finally {
    inFlightRequests.delete(cacheKey);
  }
};

// Wire getMasters onto api object to synchronize all consumers
if (api && typeof api === 'function') {
  api._masterGetter = getMasters;
}

// Get FULL records (all columns) for display tables
export const getAllMasters = async (table, options = {}) => {
  if (!table) return makeDualArray([]);
  const key = getTenantCacheKey(`all_${normalizeMasterKey(table)}`);
  const now = Date.now();
  const forceRefresh = options?.forceRefresh || false;

  if (!forceRefresh && masterCache.has(key) && masterCache.get(key).data?.length > 0) {
    const cached = masterCache.get(key);
    if (now - cached.timestamp < CACHE_TTL_MS) {
      return makeDualArray(cached.data);
    }
  }

  if (inFlightRequests.has(key)) {
    try {
      const res = await inFlightRequests.get(key);
      if (res && res.length > 0) {
        return makeDualArray(res);
      }
    } catch (e) {}
  }

  const requestPromise = (async () => {
    try {
      const result = await api(`/masters/all/${table}`);
      if (result && (Array.isArray(result) || result.success)) {
        const rawData = Array.isArray(result) ? result : (result.data || []);
        const list = Array.isArray(rawData) ? rawData : [];
        if (list.length > 0) {
          masterCache.set(key, { data: list, timestamp: Date.now() });
        }
        return list;
      }
    } catch (error) {
      console.error(`Error in getAllMasters for ${table}:`, error);
      throw error;
    }
    return [];
  })();

  inFlightRequests.set(key, requestPromise);

  try {
    const resultList = await requestPromise;
    return makeDualArray(resultList);
  } finally {
    inFlightRequests.delete(key);
  }
};

export const createMaster = async (table, data) => {
  const result = await api(`/masters/${table}`, { method: 'POST', body: data });
  invalidateMasterCache(table);
  if (!result) {
    console.error("❌ Create failed");
    return null;
  }
  return result;
};

export const updateMaster = async (table, id, data) => {
  const result = await api(`/masters/${table}/${id}`, { method: 'PUT', body: data });
  invalidateMasterCache(table);
  if (!result) {
    console.error("❌ Update failed — no response");
    return { success: false, message: 'No response from server' };
  }
  if (!result.success) {
    console.error("❌ Update failed:", result.message || result.error);
    return { success: false, message: result.message || result.error || 'Update failed' };
  }
  return result;
};

export const deleteMaster = async (table, id) => {
  const result = await api(`/masters/${table}/${id}`, { method: 'DELETE' });
  invalidateMasterCache(table);
  if (!result || !result.success) {
    console.error("❌ Delete failed");
    return { success: false, message: result?.message || result?.error || 'Delete failed' };
  }
  return { success: true, message: result?.message };
};
