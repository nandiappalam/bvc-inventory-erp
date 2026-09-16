import React, { useState, useEffect } from 'react';
import {
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Typography,
  Box,
  Divider,
  Chip,
  Button
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function CentralNotificationsBell() {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    fetchLiveAlerts();
    const interval = setInterval(fetchLiveAlerts, 30000); // 30s auto-refresh
    return () => clearInterval(interval);
  }, []);

  const fetchLiveAlerts = async () => {
    try {
      const res = await axios.get('/api/central-notifications/live');
      if (res.data.success) {
        setUnreadCount(res.data.count || 0);
        setAlerts(res.data.alerts || []);
      }
    } catch (err) {
      // Quietly ignore in background
    }
  };

  const handleOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = async (alert) => {
    try {
      await axios.post(`/api/central-notifications/mark-read/${alert.id}`);
      fetchLiveAlerts();
    } catch (e) {
      // ignore
    }
    handleClose();

    if (alert.reference_module === 'COLD_STORAGE') {
      navigate('/cold-storage-intelligence');
    } else if (alert.reference_module === 'ORDERS') {
      navigate('/order-fulfillment');
    } else if (alert.reference_module === 'FINANCE') {
      navigate('/financial-intelligence');
    } else if (alert.reference_module === 'BARCODE_QR') {
      navigate(`/barcode-qr?code=${encodeURIComponent(alert.reference_id)}`);
    }
  };

  return (
    <>
      <IconButton color="inherit" onClick={handleOpen} title="Enterprise Notifications & Alerts">
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: { width: 380, maxHeight: 480, overflowY: 'auto', p: 1 }
        }}
      >
        <Box sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Enterprise Alerts & Intelligence
          </Typography>
          <Chip label={`${unreadCount} New`} size="small" color={unreadCount > 0 ? 'error' : 'default'} />
        </Box>
        <Divider sx={{ my: 0.5 }} />

        {alerts.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              All systems normal. No operational alerts.
            </Typography>
          </Box>
        ) : (
          alerts.map((item, idx) => {
            const isCritical = item.severity === 'CRITICAL';
            const isWarning = item.severity === 'WARNING';

            return (
              <MenuItem
                key={idx}
                onClick={() => handleNotificationClick(item)}
                sx={{
                  py: 1.5,
                  px: 2,
                  whiteSpace: 'normal',
                  borderBottom: '1px solid #f1f5f9',
                  bgcolor: item.is_read ? 'transparent' : '#f8fafc'
                }}
              >
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', width: '100%' }}>
                  {isCritical ? (
                    <ErrorOutlineIcon color="error" fontSize="small" sx={{ mt: 0.3 }} />
                  ) : isWarning ? (
                    <WarningAmberIcon color="warning" fontSize="small" sx={{ mt: 0.3 }} />
                  ) : (
                    <InfoOutlinedIcon color="primary" fontSize="small" sx={{ mt: 0.3 }} />
                  )}
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: item.is_read ? 600 : 700 }}>
                      {item.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.2 }}>
                      {item.message}
                    </Typography>
                    <Typography variant="caption" color="primary.main" sx={{ display: 'block', mt: 0.5, fontWeight: 600 }}>
                      Tap to navigate →
                    </Typography>
                  </Box>
                </Box>
              </MenuItem>
            );
          })
        )}
      </Menu>
    </>
  );
}
