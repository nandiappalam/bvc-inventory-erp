import { useState, useEffect, useCallback, useRef } from 'react';
import { getMasters, getCachedMasters, getTenantCacheScope, safeArray } from '../services/masterservice.js';

/**
 * useMasterData - Custom hook for caching master data dropdowns
 * Uses generic getMasters(type) - no mapping needed
 */
export const useMasterData = (masterType) => {
  const [data, setData] = useState(() => getCachedMasters(masterType));
  const [loading, setLoading] = useState(() => !getCachedMasters(masterType).length);
  const [error, setError] = useState(null);
  const requestVersion = useRef(0);

  const fetchMaster = useCallback(async () => {
    if (!masterType) {
      setData([]);
      setLoading(false);
      return;
    }

    const tenantScope = getTenantCacheScope();
    const version = ++requestVersion.current;
    const isCurrentRequest = () => (
      requestVersion.current === version && getTenantCacheScope() === tenantScope
    );
    const cached = getCachedMasters(masterType);
    if (!cached || cached.length === 0) {
      setLoading(true);
    }
    setError(null);
    try {
      const result = await getMasters(masterType);
      if (result) {
        const masters = safeArray(result.data || result);
        if (isCurrentRequest()) {
          setData(masters);
        }
      }
    } catch (err) {
      console.error(`Failed to fetch ${masterType}:`, err);
      if (isCurrentRequest()) {
        setError(err.message);
        setData(cached);
      }
    } finally {
      if (isCurrentRequest()) {
        setLoading(false);
      }
    }
  }, [masterType]);

  useEffect(() => {
    fetchMaster();
  }, [fetchMaster]);

  useEffect(() => {
    const refreshForTenant = () => {
      requestVersion.current += 1;
      setData(getCachedMasters(masterType));
      setError(null);
      setLoading(true);
      fetchMaster();
    };
    const handleStorage = (event) => {
      if (event.key === 'erp_selected_company' || event.key === 'erp_company') {
        refreshForTenant();
      }
    };

    window.addEventListener('erp_company_changed', refreshForTenant);
    window.addEventListener('storage', handleStorage);
    return () => {
      requestVersion.current += 1;
      window.removeEventListener('erp_company_changed', refreshForTenant);
      window.removeEventListener('storage', handleStorage);
    };
  }, [fetchMaster, masterType]);

  // Auto-refresh every 5min or on window focus
  useEffect(() => {
    let refreshInterval;
    const handleFocus = () => fetchMaster();

    if (masterType) {
      refreshInterval = setInterval(fetchMaster, 5 * 60 * 1000);
      window.addEventListener('focus', handleFocus);
    }

    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [masterType, fetchMaster]);

  const refresh = useCallback(() => fetchMaster(), [fetchMaster]);

  return { data, loading, error, refresh };
};
