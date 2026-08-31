import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './App.jsx'
<<<<<<< HEAD
import ErrorBoundary from './components/ErrorBoundary.jsx'
=======
>>>>>>> origin/main
import './index.css'
import './components/global-styles.css'
import './components/SalesCreate.css'

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
<<<<<<< HEAD
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
=======
    <App />
>>>>>>> origin/main
  </React.StrictMode>,
)
