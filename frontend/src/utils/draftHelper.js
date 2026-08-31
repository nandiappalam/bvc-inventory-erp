/**
 * Universal Draft Helper for ERP Modules
 * Automatically saves and restores in-progress form entries across pages.
 */

const DRAFT_PREFIX = 'bvc_erp_draft_';

export const saveModuleDraft = (moduleKey, data) => {
  if (!moduleKey || !data) return;
  try {
    const payload = {
      savedAt: new Date().toISOString(),
      data
    };
    localStorage.setItem(`${DRAFT_PREFIX}${moduleKey}`, JSON.stringify(payload));
  } catch (e) {
    console.warn(`[Draft] Failed to save draft for ${moduleKey}:`, e);
  }
};

export const loadModuleDraft = (moduleKey) => {
  if (!moduleKey) return null;
  try {
    const raw = localStorage.getItem(`${DRAFT_PREFIX}${moduleKey}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`[Draft] Failed to load draft for ${moduleKey}:`, e);
    return null;
  }
};

export const clearModuleDraft = (moduleKey) => {
  if (!moduleKey) return;
  try {
    localStorage.removeItem(`${DRAFT_PREFIX}${moduleKey}`);
  } catch (e) {
    console.warn(`[Draft] Failed to clear draft for ${moduleKey}:`, e);
  }
};

export const hasModuleDraft = (moduleKey) => {
  if (!moduleKey) return false;
  return Boolean(localStorage.getItem(`${DRAFT_PREFIX}${moduleKey}`));
};
