import { useState, useEffect, useCallback } from 'react';
import { getMasters, getCachedMasters, safeArray } from '../services/masterservice.js';

/**
 * useMasterData - Custom hook for caching master data dropdowns
 * Uses generic getMasters(type) - no mapping needed
 */
export const useMasterData = (masterType) => {
  const [data, setData] = useState(() => getCachedMasters(masterType));
  const [loading, setLoading] = useState(() => !getCachedMasters(masterType).length);
  const [error, setError] = useState(null);

  const fetchMaster = useCallback(async (forceRefresh = false) => {
    if (!masterType) {
      setData([]);
      setLoading(false);
      return;
    }

    const cached = getCachedMasters(masterType);
    if (!cached || cached.length === 0) {
      setLoading(true);
    }
    setError(null);
    try {
      const result = await getMasters(masterType, { forceRefresh });
      if (result) {
        const masters = safeArray(result.data || result);
        if (masters.length > 0) {
          setData(masters);
        } else if (!forceRefresh && cached && cached.length > 0) {
          setData(cached);
        } else {
          setData([]);
        }
      }
    } catch (err) {
      console.error(`Failed to fetch ${masterType}:`, err);
      setError(err.message);
      if (!data || data.length === 0) {
        setData([]);
      }
    } finally {
      setLoading(false);
    }
  }, [masterType]);

  useEffect(() => {
    setData(getCachedMasters(masterType));
    fetchMaster();
  }, [masterType, fetchMaster]);

  // Auto-refresh every 5min, on window focus, or when active company changes
  useEffect(() => {
    let refreshInterval;
    const handleFocus = () => fetchMaster();
    const handleCompanyChange = () => {
      setData(getCachedMasters(masterType));
      fetchMaster(true);
    };

    if (masterType) {
      refreshInterval = setInterval(fetchMaster, 5 * 60 * 1000);
      window.addEventListener('focus', handleFocus);
      window.addEventListener('erp_company_changed', handleCompanyChange);
    }

    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('erp_company_changed', handleCompanyChange);
    };
  }, [masterType, fetchMaster]);

  const refresh = useCallback(() => fetchMaster(true), [fetchMaster]);

  return { data, loading, error, refresh };
};

