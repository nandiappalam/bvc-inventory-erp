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
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function CentralNotificationsBell() {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    fetchLiveAlerts();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchLiveAlerts();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchLiveAlerts = async () => {
    try {
      const res = await axios.get('/api/central-notifications/live');
      if (res.data.success) {
        setUnreadCount(res.data.count || 0);
        setAlerts(res.data.alerts || []);
      }
    } catch (_) {
      // Quietly ignore background polling failures
    }
  };

  const handleOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const resolveModulePath = (moduleName, referenceId) => {
    const mod = String(moduleName || '').toUpperCase();
    if (mod === 'COLD_STORAGE') return '/cold-storage/vouchers';
    if (mod === 'OUTPASS') return '/entry/outpass-display';
    if (mod === 'INPASS') return '/entry/inpass-display';
    if (mod === 'PURCHASE_RETURN') return '/entry/purchase-return-display';
    if (mod === 'PURCHASE_ORDER') return '/entry/purchase-order-list';
    if (mod === 'PURCHASE_REQUEST') return '/entry/purchase-request-display';
    if (mod === 'PURCHASE') return '/entry/purchase-display';
    if (mod === 'SALES_RETURN') return '/entry/sales-return-display';
    if (mod === 'EXPORT_ORDER') return '/entry/sales-export-order-display';
    if (mod === 'SALES') return '/entry/sales-display';
    if (mod === 'GODOWN_TRANSFER' || mod === 'ITEM_TRANSFER') return '/entry/godown-transfer-display';
    if (mod === 'WORK_ORDER') return '/entry/work-order-display';
    if (['PRODUCTION', 'GRIND', 'FLOUR_OUT', 'FLOUR_OUT_RETURN', 'PAPAD_IN', 'PAPAD_RETURN', 'PACKING'].includes(mod)) {
      return '/entry/grind-display';
    }
    if (mod === 'STOCK_ADJUST') return '/entry/stock-adjust-display';
    if (mod === 'VOUCHER') return '/entry/voucher-display';
    if (mod === 'ADVANCE') return '/entry/advance-display';
    if (mod === 'QUOTATION') return '/entry/quotation-display';
    if (mod === 'QC') return '/entry/quality-control-list';
    if (mod === 'ORDERS') return '/order-fulfillment';
    if (mod === 'FINANCE') return '/financial-intelligence';
    if (mod === 'BARCODE_QR') return `/barcode-qr?code=${encodeURIComponent(referenceId || '')}`;
    return '/central-notifications';
  };

  const handleNotificationClick = async (alert) => {
    try {
      await axios.post(`/api/central-notifications/mark-read/${alert.id}`);
      fetchLiveAlerts();
    } catch (_) {
      // ignore
    }
    handleClose();
    navigate(resolveModulePath(alert.reference_module, alert.reference_id));
  };

  return (
    <>
      <IconButton color="inherit" onClick={handleOpen} title="Enterprise Notifications & WhatsApp Alerts">
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: { width: 390, maxHeight: 500, overflowY: 'auto', p: 1 }
        }}
      >
        <Box sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Enterprise Alerts &amp; Activity
          </Typography>
          <Chip
            label={`${unreadCount} Unread`}
            size="small"
            color={unreadCount > 0 ? 'error' : 'default'}
            sx={{ fontVariantNumeric: 'tabular-nums' }}
          />
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
                key={item.id || idx}
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
                      Open module →
                    </Typography>
                  </Box>
                </Box>
              </MenuItem>
            );
          })
        )}
        <Divider sx={{ my: 0.5 }} />
        <Box sx={{ p: 1, textAlign: 'center' }}>
          <Button
            fullWidth
            size="small"
            variant="contained"
            onClick={() => {
              handleClose();
              navigate('/central-notifications');
            }}
            sx={{
              backgroundColor: '#1f4fb2',
              color: '#ffffff',
              fontWeight: 700,
              textTransform: 'none',
              '&:hover': { backgroundColor: '#1e3a8a' }
            }}
          >
            Open WhatsApp &amp; Notification Center →
          </Button>
        </Box>
      </Menu>
    </>
  );
}
