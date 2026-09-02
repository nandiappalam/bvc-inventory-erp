import { useState, useEffect } from 'react';
import { ASYNC_DEFAULTS } from '../constants/asyncDefaults';

/**
 * A custom hook that debounces a value.
 *
 * @template T
 * @param {T} value The value to debounce.
 * @param {number} [delay=ASYNC_DEFAULTS.DEBOUNCE_DELAY] The debounce delay in milliseconds.
 * @returns {T} The debounced value.
 */
export const useDebounce = (value, delay = ASYNC_DEFAULTS.DEBOUNCE_DELAY) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};