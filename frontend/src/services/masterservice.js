import api from '../services/api.js';

// Re-export api for direct use
export { api };

export const safeArray = (data) => Array.isArray(data) ? data : [];

// In-memory cache for master dropdowns and records to prevent repeated network spam and empty UI states
const masterCache = new Map();
const inFlightRequests = new Map();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds fresh TTL

export const normalizeMasterKey = (type) => {
  if (!type) return '';
  let k = String(type).trim().toLowerCase();
  if (k.endsWith('_master')) k = k.replace(/_master$/, '');
  if (k === 'supplier') return 'suppliers';
  if (k === 'customer') return 'customers';
  if (k === 'item') return 'items';
  if (k === 'godown') return 'godowns';
  if (k === 'transport') return 'transports';
  if (k === 'weight') return 'weights';
  if (k === 'area') return 'areas';
  if (k === 'city') return 'cities';
  if (k === 'sender') return 'senders';
  if (k === 'consignee') return 'consignees';
  if (k === 'papad_company' || k === 'papadcompany' || k === 'papadcomp') return 'papad_companies';
  if (k === 'flour_mill' || k === 'flourmill') return 'flour_mills';
  return k;
};

// Clear cached master records when records are created, updated, or deleted
export const invalidateMasterCache = (type) => {
  if (!type) {
    masterCache.clear();
    return;
  }
  const key = normalizeMasterKey(type);
  masterCache.delete(key);
  masterCache.delete(String(type).toLowerCase());
  masterCache.delete(`all_${key}`);
};

const makeDualArray = (list) => {
  const arr = Array.isArray(list) ? [...list] : [];
  arr.data = arr;
  arr.success = true;
  return arr;
};

export const getMasters = async (type, options = {}) => {
  if (!type) return makeDualArray([]);
  const key = normalizeMasterKey(type);
  const now = Date.now();
  const forceRefresh = options?.forceRefresh || false;

  // 1. Check existing fresh cache
  if (!forceRefresh && masterCache.has(key)) {
    const cached = masterCache.get(key);
    if (now - cached.timestamp < CACHE_TTL_MS) {
      return makeDualArray(cached.data);
    }
  }

  // 2. Reuse in-flight request to prevent 10 simultaneous requests from table rows
  if (inFlightRequests.has(key)) {
    try {
      const res = await inFlightRequests.get(key);
      return makeDualArray(res);
    } catch (e) {
      // Fall through to retry if in-flight failed
    }
  }

  // 3. Dispatch fresh request with retry logic
  const requestPromise = (async () => {
    let lastError = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await api(`/masters/${key}`);
        if (result && (Array.isArray(result) || result.success)) {
          const rawData = Array.isArray(result) ? result : (result.data || []);
          const list = Array.isArray(rawData) ? rawData : [];
          
          // Cache successful response
          masterCache.set(key, { data: list, timestamp: Date.now() });
          return list;
        }
        lastError = new Error(result?.message || `Failed to fetch master for ${key}`);
      } catch (err) {
        lastError = err;
      }

      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 400 * attempt));
      }
    }

    // If all retries failed but stale cached data exists, return stale cache to avoid blank dropdowns
    if (masterCache.has(key)) {
      console.warn(`⚠️ [MasterCache] Network failed for ${key}, falling back to cached list.`);
      return masterCache.get(key).data;
    }

    console.error(`❌ [MasterService] getMasters failed for ${key} after ${maxRetries} attempts:`, lastError);
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

// Get FULL records (all columns) for display tables
export const getAllMasters = async (table, options = {}) => {
  if (!table) return makeDualArray([]);
  const key = `all_${normalizeMasterKey(table)}`;
  const now = Date.now();
  const forceRefresh = options?.forceRefresh || false;

  if (!forceRefresh && masterCache.has(key)) {
    const cached = masterCache.get(key);
    if (now - cached.timestamp < CACHE_TTL_MS) {
      return makeDualArray(cached.data);
    }
  }

  if (inFlightRequests.has(key)) {
    try {
      const res = await inFlightRequests.get(key);
      return makeDualArray(res);
    } catch (e) {}
  }

  const requestPromise = (async () => {
    try {
      const result = await api(`/masters/all/${table}`);
      if (result && (Array.isArray(result) || result.success)) {
        const rawData = Array.isArray(result) ? result : (result.data || []);
        const list = Array.isArray(rawData) ? rawData : [];
        masterCache.set(key, { data: list, timestamp: Date.now() });
        return list;
      }
    } catch (e) {
      console.error(`Error in getAllMasters for ${table}:`, e);
    }

    if (masterCache.has(key)) {
      return masterCache.get(key).data;
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

