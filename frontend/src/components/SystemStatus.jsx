import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import AutorenewIcon from '@mui/icons-material/Autorenew';

export function SystemStatus() {
  const [status, setStatus] = useState({
    ready: true,
    engine: 'Database',
    isOnline: true,
    lastChecked: new Date(),
  });
  const [isChecking, setIsChecking] = useState(false);

  const checkHealth = async () => {
    try {
      setIsChecking(true);
      const res = await axios.get('/api/health');
      if (res.data) {
        setStatus({
          ready: res.data.ready !== false,
          engine: res.data.database || 'PostgreSQL',
          isOnline: true,
          lastChecked: new Date(),
        });
      }
    } catch (err) {
      setStatus(prev => ({
        ...prev,
        isOnline: false,
        ready: false,
        lastChecked: new Date(),
      }));
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkHealth();
    // Non-intrusive health polling every 60s
    const interval = setInterval(checkHealth, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!status.isOnline) {
    return (
      <div 
        id="system_status_offline" 
        style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '6px', 
          padding: '4px 10px', 
          borderRadius: '16px', 
          backgroundColor: '#fff1f2', 
          border: '1px solid #fecdd3', 
          color: '#be123c', 
          fontSize: '12px', 
          fontWeight: 600 
        }}
      >
        <ErrorOutlineIcon style={{ fontSize: '16px', color: '#f43f5e' }} />
        <span>DB Reconnecting</span>
        <button
          onClick={checkHealth}
          disabled={isChecking}
          title="Retry Connection"
          style={{ 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer', 
            color: '#be123c', 
            padding: '2px', 
            display: 'flex', 
            alignItems: 'center' 
          }}
        >
          <AutorenewIcon style={{ fontSize: '14px' }} />
        </button>
      </div>
    );
  }

  return (
    <div 
      id="system_status_online" 
      title={`Database Engine: ${status.engine}`}
      style={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        gap: '6px', 
        padding: '3px 10px', 
        borderRadius: '16px', 
        backgroundColor: '#ecfdf5', 
        border: '1px solid #a7f3d0', 
        color: '#047857', 
        fontSize: '12px', 
        fontWeight: 600 
      }}
    >
      <CheckCircleIcon style={{ fontSize: '15px', color: '#10b981' }} />
      <span>{status.engine === 'PostgreSQL' ? 'Neon DB' : 'DB Online'}</span>
    </div>
  );
}

export default SystemStatus;
