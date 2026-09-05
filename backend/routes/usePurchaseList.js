import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAsync, useDebounce } from '@/shared/hooks';
import { purchaseApi } from '@/purchase/services';
import { INITIAL_PAGINATION, INITIAL_SORT } from '@/shared/constants/paginationDefaults';
import { ASYNC_DEFAULTS } from '@/shared/constants/asyncDefaults';
import { buildCleanQuery } from '@/shared/utils';

/**
 * A hook to manage the state and data fetching for the purchase list.
 * It orchestrates filtering, pagination, sorting, and searching, using the
 * shared async infrastructure.
 *
 * @returns {{
 *   purchases: Array<any>,
 *   total: number,
 *   loading: boolean,
 *   error: Error | null,
 *   status: 'idle' | 'pending' | 'success' | 'error',
 *   filters: object,
 *   search: string,
 *   isInitialLoading: boolean,
 *   hasResults: boolean,
 *   isRefreshing: boolean,
 *   isEmpty: boolean,
 *   pagination: { page: number, pageSize: number },
 *   sort: object,
 *   updateSearch: (search: string) => void,
 *   updateFilters: (updater: object | ((prev: object) => object)) => void,
 *   changePage: (newPage: number) => void,
 *   changePageSize: (newPageSize: number) => void,
 *   changeSort: (newSort: object) => void,
 *   resetFilters: () => void,
 *   refresh: () => void
 * }}
 */
export const usePurchaseList = () => {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [pagination, setPagination] = useState(INITIAL_PAGINATION);
  const [sort, setSort] = useState(INITIAL_SORT);

  // Debounce the search term to avoid excessive API calls while typing.
  const debouncedSearch = useDebounce(search, ASYNC_DEFAULTS.DEBOUNCE_DELAY); // Use shared constant

  // Memoize the API call to ensure `useAsync` has a stable function reference.
  const getPurchases = useCallback((params) => {
    return purchaseApi.getPurchaseList(params);
  }, []);

  const {
    execute: fetchPurchases,
    loading,
    data,
    error,
    reset: resetAsync,
    status,
  } = useAsync(getPurchases);

  // A ref to store the latest query parameters used for a fetch.
  const lastRequestRef = useRef(null);

  // Memoize the final query object to be sent to the API.
  const query = useMemo(() => {
    const baseQuery = {
      ...filters,
      search: debouncedSearch,
      page: pagination.page,
      pageSize: pagination.pageSize,
      sortField: sort.field,
      sortDirection: sort.direction,
    };

    return buildCleanQuery(baseQuery);
  }, [debouncedSearch, filters, pagination, sort]);

  // This effect triggers the API call whenever the memoized query changes.
  useEffect(() => {
    lastRequestRef.current = query;

    fetchPurchases(query).catch((err) => {
      // Errors are re-thrown by useAsync, so we can optionally handle them here
      // (e.g., logging), but we don't show UI notifications as per the architecture.
      if (err.name !== 'AbortError') {
        console.error('Failed to fetch purchase list:', err);
      }
    });
  }, [query, fetchPurchases]);

  /**
   * Re-fetches the purchase list using the last used query parameters.
   */
  const refresh = useCallback(() => {
    // Ensure lastRequestRef.current has been set by an initial fetch.
    if (!lastRequestRef.current) return Promise.resolve();
    return fetchPurchases(lastRequestRef.current);
  }, [fetchPurchases]);

  // Helper functions to update state, abstracting away the `set` calls.
  const updateSearch = useCallback((value) => {
    setSearch(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const updateFilters = useCallback((updater) => {
    setFilters((prev) => {
      const nextFilters = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      return nextFilters;
    });
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset page on filter change
  }, []);

  const changePage = useCallback((newPage) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  }, []);

  const changePageSize = useCallback((newPageSize) => {
    setPagination({ page: 1, pageSize: newPageSize });
  }, []);

  const changeSort = useCallback((newSort) => {
    setSort(newSort);
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const resetFilters = useCallback(() => {
    setSearch('');
    setFilters({});
    setPagination(INITIAL_PAGINATION);
    setSort(INITIAL_SORT);
    resetAsync();
    lastRequestRef.current = null;
  }, [resetAsync]);

  // Normalize the output to prevent null values in the UI.
  const purchases = data?.rows ?? [];
  const total = data?.total ?? 0;

  // Derived state for easier UI consumption
  const isEmpty = !loading && purchases.length === 0;
  const hasResults = purchases.length > 0;
  const isInitialLoading = loading && !hasResults;
  const isRefreshing = loading && hasResults;

  return {
    // Data
    purchases,
    total,

    // Request State
    loading,
    isInitialLoading,
    isRefreshing,
    error,
    status,

    // Derived State
    isEmpty,
    hasResults,

    // UI State
    search,
    filters,
    pagination,
    sort,

    // Actions
    updateSearch,
    updateFilters,
    changePage,
    changePageSize,
    changeSort,
    resetFilters,
    refresh,
  };
};