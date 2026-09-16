import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Button, IconButton, Tooltip } from '@mui/material';
import {
  DashboardCustomize as DashboardCustomizeIcon,
  ArrowBack as ArrowBackIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * CommandCenterReturnBanner
 * Floats or docks at the top of pages when navigated from the Command Center,
 * providing a clear, instant 1-click way to return to the Command Center.
 */
const CommandCenterReturnBanner = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showBanner, setShowBanner] = useState(false);
  const [returnInfo, setReturnInfo] = useState({
    path: '/command-center',
    sectionName: ''
  });

  const isInsideCommandCenter = location.pathname.startsWith('/command-center');

  useEffect(() => {
    // If we are already on Command Center pages, don't show the banner
    if (isInsideCommandCenter) {
      setShowBanner(false);
      return;
    }

    // Check if navigation state or sessionStorage indicates we came from Command Center
    const stateInfo = location.state;
    const stored = sessionStorage.getItem('command_center_referrer');

    let referrer = null;
    if (stateInfo && stateInfo.fromCommandCenter) {
      referrer = {
        path: stateInfo.returnPath || '/command-center',
        sectionName: stateInfo.sourceSection || ''
      };
    } else if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Only keep if within the last 2 hours
        if (Date.now() - (parsed.timestamp || 0) < 2 * 60 * 60 * 1000) {
          referrer = parsed;
        }
      } catch (e) {
        // Invalid session data
      }
    }

    if (referrer && referrer.path) {
      setReturnInfo(referrer);
      setShowBanner(true);
    } else {
      setShowBanner(false);
    }
  }, [location, isInsideCommandCenter]);

  if (!showBanner || isInsideCommandCenter) {
    return null;
  }

  const handleReturn = () => {
    const targetPath = returnInfo.path || '/command-center';
    navigate(targetPath);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    sessionStorage.removeItem('command_center_referrer');
  };

  const formattedSection = returnInfo.sectionName
    ? returnInfo.sectionName.toUpperCase()
    : 'OPERATIONS';

  return (
    <Paper
      elevation={0}
      sx={{
        mb: 2,
        p: 1.25,
        px: 2,
        borderRadius: '8px',
        backgroundColor: '#0f172a',
        color: '#ffffff',
        border: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 1.5,
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)',
        '@media print': {
          display: 'none !important'
        }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: '6px',
            backgroundColor: 'rgba(56, 189, 248, 0.15)',
            color: '#38bdf8'
          }}
        >
          <DashboardCustomizeIcon sx={{ fontSize: 18 }} />
        </Box>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '13px', color: '#f8fafc' }}>
            Navigated from Command Center
          </Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '11px' }}>
            Active section: <strong style={{ color: '#38bdf8' }}>{formattedSection}</strong>
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Button
          variant="contained"
          size="small"
          onClick={handleReturn}
          startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
          sx={{
            backgroundColor: '#0284c7',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '12px',
            textTransform: 'none',
            px: 1.75,
            py: 0.5,
            borderRadius: '6px',
            '&:hover': {
              backgroundColor: '#0369a1'
            }
          }}
        >
          Return to Command Center
        </Button>

        <Tooltip title="Dismiss return banner">
          <IconButton
            size="small"
            onClick={handleDismiss}
            sx={{
              color: '#94a3b8',
              '&:hover': { color: '#ffffff', backgroundColor: 'rgba(255, 255, 255, 0.1)' }
            }}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Paper>
  );
};

export default CommandCenterReturnBanner;
