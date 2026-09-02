import api from '../services/api.js'

// Re-export api for direct use
export { api };

export const safeArray = (data) => Array.isArray(data) ? data : [];

export const getMasters = async (type) => {
  const result = await api(`/masters/${type}`);
  if (!result) {
    console.error("❌ API failed");
    return [];
  }
  // Handle both {success: true, data: [...]} and direct array responses
  if (Array.isArray(result)) {
    return result;
  }
  if (result.success) {
    return result.data || [];
  }
  return [];
};

// Get FULL records (all columns) for display tables
export const getAllMasters = async (table) => {
  const result = await api(`/masters/all/${table}`);
  if (!result) {
    console.error("❌ API failed");
    return [];
  }
  if (Array.isArray(result)) {
    return result;
  }
  if (result.success) {
    return result.data || [];
  }
  return [];
};

export const createMaster = async (table, data) => {
  const result = await api(`/masters/${table}`, { method: 'POST', body: data });
  if (!result) {
    console.error("❌ Create failed");
    return null;
  }
  if (result.success) {
    return result;
  }
  return result; // Return the error response so caller can read result.error
}

export const updateMaster = async (table, id, data) => {
  const result = await api(`/masters/${table}/${id}`, { method: 'PUT', body: data });
  if (!result) {
    console.error("❌ Update failed — no response");
    return { success: false, message: 'No response from server' };
  }
  if (!result.success) {
    console.error("❌ Update failed:", result.message || result.error);
    return { success: false, message: result.message || result.error || 'Update failed' };
  }
  return result;
}

export const deleteMaster = async (table, id) => {
  const result = await api(`/masters/${table}/${id}`, { method: 'DELETE' });
  if (!result || !result.success) {
    console.error("❌ Delete failed");
    return { success: false, message: result?.message || result?.error || 'Delete failed' };
  }
  return { success: true, message: result?.message };
}

