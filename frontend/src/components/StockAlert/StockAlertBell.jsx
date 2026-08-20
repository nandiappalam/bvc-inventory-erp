import React, { useState, useEffect } from 'react';
import {
  IconButton,
  Badge,
  Popover,
  Box,
  Typography,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Button,
  Stack,
  Tooltip
} from '@mui/material';
import {
  Notifications as BellIcon,
  Warning as WarningIcon,
  Error as CriticalIcon,
  NotificationsActive as AlertIcon,
  ArrowForward as ArrowIcon,
  CheckCircle as OkIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const StockAlertBell = () => {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [alertData, setAlertData] = useState({
    count: 0,
    criticalCount: 0,
    lowCount: 0,
    reorderCount: 0,
    alerts: []
  });

  const fetchActiveAlerts = async () => {
    try {
      const res = await fetch('/api/stock-alerts/active-count');
      const data = await res.json();
      if (data.success) {
        setAlertData(data);
      }
    } catch (err) {
      console.error('Error fetching stock alert count:', err);
    }
  };

  useEffect(() => {
    fetchActiveAlerts();

    const handleStockUpdate = () => {
      fetchActiveAlerts();
    };
    window.addEventListener('stock-alerts-updated', handleStockUpdate);

    // Poll every 20 seconds
    const interval = setInterval(fetchActiveAlerts, 20000);
    return () => {
      window.removeEventListener('stock-alerts-updated', handleStockUpdate);
      clearInterval(interval);
    };
  }, []);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
    fetchActiveAlerts();
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);
  const id = open ? 'stock-alert-popover' : undefined;

  return (
    <>
      <Tooltip title={alertData.count > 0 ? `${alertData.count} Stock Alerts Active` : 'Inventory in Healthy State'}>
        <IconButton
          color="inherit"
          onClick={handleClick}
          sx={{
            ml: 1,
            backgroundColor: alertData.criticalCount > 0 ? 'rgba(220, 38, 38, 0.15)' : 'transparent',
            '&:hover': {
              backgroundColor: alertData.criticalCount > 0 ? 'rgba(220, 38, 38, 0.25)' : 'rgba(255, 255, 255, 0.08)'
            }
          }}
        >
          <Badge
            badgeContent={alertData.count}
            color={alertData.criticalCount > 0 ? 'error' : alertData.lowCount > 0 ? 'warning' : 'info'}
            max={99}
          >
            <BellIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            width: 360,
            maxHeight: 460,
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
          }
        }}
      >
        {/* Header */}
        <Box sx={{ p: 2, backgroundColor: '#1f4fb2', color: '#ffffff' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
              <AlertIcon fontSize="small" /> Inventory Stock Alerts
            </Typography>
            <Chip
              label={`${alertData.count} Active`}
              size="small"
              sx={{ backgroundColor: '#ffffff', color: '#1f4fb2', fontWeight: 'bold', fontSize: '11px' }}
            />
          </Box>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            {alertData.criticalCount > 0 && (
              <Chip label={`${alertData.criticalCount} Critical`} size="small" sx={{ backgroundColor: '#fef2f2', color: '#dc2626', fontWeight: 'bold', fontSize: '10px', height: '20px' }} />
            )}
            {alertData.lowCount > 0 && (
              <Chip label={`${alertData.lowCount} Low`} size="small" sx={{ backgroundColor: '#fff7ed', color: '#ea580c', fontWeight: 'bold', fontSize: '10px', height: '20px' }} />
            )}
            {alertData.reorderCount > 0 && (
              <Chip label={`${alertData.reorderCount} Reorder`} size="small" sx={{ backgroundColor: '#fffbeb', color: '#d97706', fontWeight: 'bold', fontSize: '10px', height: '20px' }} />
            )}
          </Stack>
        </Box>

        {/* Content List */}
        <List sx={{ p: 0, maxHeight: 300, overflowY: 'auto' }}>
          {alertData.alerts && alertData.alerts.length > 0 ? (
            alertData.alerts.map((item, idx) => {
              const isCrit = item.status === 'CRITICAL';
              const isLow = item.status === 'LOW';

              return (
                <React.Fragment key={idx}>
                  <ListItem
                    button
                    onClick={() => {
                      handleClose();
                      navigate('/features/stock-alert-dashboard');
                    }}
                    sx={{
                      py: 1.2,
                      px: 2,
                      backgroundColor: isCrit ? '#fff1f2' : isLow ? '#fff7ed' : '#ffffff',
                      '&:hover': {
                        backgroundColor: isCrit ? '#ffe4e6' : isLow ? '#ffedd5' : '#f1f5f9'
                      }
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      {isCrit ? (
                        <CriticalIcon sx={{ color: '#dc2626', fontSize: '20px' }} />
                      ) : isLow ? (
                        <WarningIcon sx={{ color: '#ea580c', fontSize: '20px' }} />
                      ) : (
                        <AlertIcon sx={{ color: '#d97706', fontSize: '20px' }} />
                      )}
                    </ListItemIcon>

                    <ListItemText
                      disableTypography
                      primary={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" component="div" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                            {item.item_name}
                          </Typography>
                          <Typography variant="caption" component="div" sx={{ fontWeight: 'bold', color: isCrit ? '#dc2626' : isLow ? '#ea580c' : '#d97706' }}>
                            {item.current_qty?.toFixed(1)} Kg
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.3 }}>
                          <Typography variant="caption" component="div" sx={{ color: '#64748b' }}>
                            {item.godown_name}
                          </Typography>
                          <Typography variant="caption" component="div" sx={{ color: '#475569', fontSize: '10px' }}>
                            Min: {item.minimum_qty} | Reorder: {item.reorder_level}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                  <Divider />
                </React.Fragment>
              );
            })
          ) : (
            <ListItem sx={{ py: 3, textAlign: 'center' }}>
              <ListItemText
                disableTypography
                primary={
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <OkIcon sx={{ color: '#16a34a', fontSize: '32px' }} />
                    <Typography variant="body2" component="div" sx={{ fontWeight: 'bold', color: '#16a34a' }}>
                      All Stock Levels Healthy
                    </Typography>
                    <Typography variant="caption" component="div" sx={{ color: '#64748b' }}>
                      No items below configured reorder or minimum thresholds.
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
          )}
        </List>

        {/* Footer */}
        <Box sx={{ p: 1.5, backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
          <Button
            fullWidth
            size="small"
            variant="contained"
            endIcon={<ArrowIcon />}
            onClick={() => {
              handleClose();
              navigate('/features/stock-alert-dashboard');
            }}
            sx={{ backgroundColor: '#1f4fb2', textTransform: 'none', fontWeight: 'bold' }}
          >
            View Full Stock Alert Dashboard
          </Button>
        </Box>
      </Popover>
    </>
  );
};

export default StockAlertBell;
