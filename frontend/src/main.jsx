import React from 'react'
import ReactDOM from 'react-dom/client'
import axios from 'axios'

import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'
import './components/global-styles.css'
import './components/SalesCreate.css'

// Helper to extract active company and user credentials from localStorage
function getActiveAuthHeaders() {
  let companyId = 1;
  let token = null;
  let userId = null;

  try {
    const selComp = localStorage.getItem('erp_selected_company') || localStorage.getItem('erp_company');
    if (selComp) {
      if (selComp.startsWith('{')) {
        const parsed = JSON.parse(selComp);
        companyId = parsed.id || parsed.company_id || parsed.companyId || 1;
      } else {
        const num = parseInt(selComp, 10);
        if (!isNaN(num) && num > 0) companyId = num;
      }
    }
  } catch (e) {}

  try {
    token = localStorage.getItem('erp_token');
    const userStr = localStorage.getItem('erp_user');
    if (userStr) {
      const userObj = JSON.parse(userStr);
      userId = userObj.id || null;
      if (!companyId && userObj.company_id) {
        companyId = userObj.company_id;
      }
    }
  } catch (e) {}

  return { companyId, token, userId };
}

// 1. Configure global Axios interceptor
axios.interceptors.request.use((config) => {
  const { companyId, token, userId } = getActiveAuthHeaders();
  config.headers = config.headers || {};
  if (!config.headers['x-company-id'] && !config.headers['X-Company-Id']) {
    config.headers['X-Company-Id'] = String(companyId);
  }
  if (!config.headers['authorization'] && !config.headers['Authorization'] && token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  if (!config.headers['x-user-id'] && !config.headers['X-User-Id'] && userId) {
    config.headers['X-User-Id'] = String(userId);
  }
  return config;
}, (error) => Promise.reject(error));

// 2. Configure global fetch interceptor
if (typeof window !== 'undefined' && window.fetch) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async function(input, init = {}) {
    let url = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input));

    // Only intercept requests to our local /api endpoints
    if (url.startsWith('/api') || url.includes('/api/')) {
      const { companyId, token, userId } = getActiveAuthHeaders();
      const currentHeaders = init?.headers || (input instanceof Request ? input.headers : {});
      const headers = new Headers(currentHeaders);

      if (!headers.has('X-Company-Id') && !headers.has('x-company-id')) {
        headers.set('X-Company-Id', String(companyId));
      }
      if (!headers.has('Authorization') && !headers.has('authorization') && token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      if (!headers.has('X-User-Id') && !headers.has('x-user-id') && userId) {
        headers.set('X-User-Id', String(userId));
      }

      init = { ...init, headers };
    }

    return originalFetch(input, init);
  };
}

// Central alert override to prevent iframe DOMExceptions from blocking execution and show styled toast instead
if (typeof window !== 'undefined') {
  window.alert = function(msg) {
    console.log('[ALERT OVERRIDE]', msg);
    let container = document.getElementById('toast-notification-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-notification-container';
      container.style.position = 'fixed';
      container.style.top = '20px';
      container.style.right = '20px';
      container.style.zIndex = '999999';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '10px';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.innerText = msg;
    toast.style.background = '#1f4fb2';
    toast.style.color = '#fff';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '6px';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = '600';
    toast.style.fontFamily = 'sans-serif';
    toast.style.minWidth = '200px';
    toast.style.transition = 'all 0.3s ease';
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        toast.remove();
        if (container.children.length === 0) {
          container.remove();
        }
      }, 300);
    }, 3000);
  };

  window.confirm = function(msg) {
    console.log('[CONFIRM OVERRIDE]', msg);
    return true;
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
