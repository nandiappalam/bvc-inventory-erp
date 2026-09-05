import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * A generic hook to manage the lifecycle of asynchronous operations (e.g., API calls)
 * in a component. It handles loading states, errors, and prevents race conditions from
 * stale requests by only updating state from the most recent request.
 * It handles loading states, errors, and prevents race conditions from stale requests.
 *
 * IMPORTANT: The `asyncFunction` passed to this hook should be memoized with `useCallback`
 * to prevent the `execute` function from being recreated on every render.
 *
 * @template T The type of the data returned by the async function.
 * @param {(...args: any[]) => Promise<T>} asyncFunction The async function to execute.
 * @returns {{
 *   execute: (...args: any[]) => Promise<T>,
 *   reset: () => void,
 *   loading: boolean,
 *   data: T | null,
 *   error: Error | null,
 *   status: 'idle' | 'pending' | 'success' | 'error'
 * }}
 */
export const useAsync = (asyncFunction) => {
  const [status, setStatus] = useState('idle');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // Refs to manage component mounting and race conditions.
  const mountedRef = useRef(true);
  const requestCounterRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reset = useCallback(() => {
    if (mountedRef.current) {
      // Incrementing the counter invalidates any pending requests
      requestCounterRef.current++;
      setStatus('idle');
      setData(null);
      setError(null);
    }
  }, []);

  const execute = useCallback(
    async (...args) => {
      const requestId = ++requestCounterRef.current;

      setStatus('pending');
      setError(null);
      // Optionally clear previous data to prevent showing stale results while loading
      setData(null);

      try {
        const result = await asyncFunction(...args);

        // Only update state if the component is still mounted and this is the latest request.
        if (mountedRef.current && requestId === requestCounterRef.current) {
          setData(result);
          setStatus('success');
        }
        return result;
      } catch (err) {
        if (mountedRef.current && requestId === requestCounterRef.current) {
          setError(err);
          setStatus('error');
        }
        // Re-throw the error so the caller can handle it (e.g., show a notification).
        throw err;
      }
    },
    [asyncFunction] // Depends only on the memoized async function.
  );

  const loading = status === 'pending';

  return {
    execute,
    reset,
    loading,
    data,
    error,
    status,
  };
};