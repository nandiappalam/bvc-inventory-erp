/**
 * Server startup utility for desktop app
 * In standalone Tauri mode, no external server is needed - everything runs in the Rust backend
 */

import { invoke } from '@tauri-apps/api';
import { isTauri as checkIsTauri } from '@tauri-apps/api/runtime';

let initialized = false;

// Check if running in Tauri
const isTauri = () => {
  try {
    return checkIsTauri();
  } catch (e) {
    return false;
  }
};

export const initializeBackend = async () => {
  // Prevent multiple initializations
  if (initialized) {
    console.log('[Backend] Already initialized');
    return true;
  }

  try {
    // Check if we're running in Tauri
    const runningInTauri = isTauri();
    
    if (!runningInTauri) {
      console.log('[Backend] Not running in Tauri mode');
      initialized = true;
      return true;
    }

    console.log('[Backend] Initializing Tauri backend...');
    
    // Call health check to verify backend is responding
    try {
      const health = await invoke('health_check');
      console.log('[Backend] Health check:', health);
    } catch (e) {
      console.warn('[Backend] Health check failed:', e);
    }

    // Try to seed default data if needed
    try {
      const result = await invoke('seed_default_data');
      console.log('[Backend] Seed result:', result);
    } catch (e) {
      console.log('[Backend] Seed not needed or failed:', e.message || e);
    }

    initialized = true;
    console.log('[Backend] Tauri backend initialized successfully');
    return true;
  } catch (error) {
    console.error('[Backend] Initialization error:', error);
    return false;
  }
};

// Simple health check using Tauri invoke
export const checkServerConnection = async (maxAttempts = 3) => {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const result = await invoke('health_check');
      console.log('[Backend] Connection OK:', result);
      return true;
    } catch (error) {
      console.log(`[Backend] Connection check failed (attempt ${i + 1}/${maxAttempts})`);
      if (i < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  return false;
};

// Get database path
export const getDatabasePath = async () => {
  try {
    return await invoke('get_db_path');
  } catch (e) {
    console.error('[Backend] Failed to get DB path:', e);
    return null;
  }
};

export default { initializeBackend, checkServerConnection, getDatabasePath };
