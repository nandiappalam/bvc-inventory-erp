import React, { useState } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  Typography,
  Chip,
  Divider,
} from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useViewControl, ZOOM_STEPS } from '../context/ViewControlContext';

export default function ViewControlToolbar({ variant = 'header' }) {
  const { zoomLevel, zoomIn, zoomOut, resetZoom, setZoom, isFullscreen, toggleFullscreen } = useViewControl();
  const [anchorEl, setAnchorEl] = useState(null);

  const handleOpenMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleSelectZoom = (step) => {
    setZoom(step);
    handleCloseMenu();
  };

  const isHeader = variant === 'header';

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        backgroundColor: isHeader ? 'rgba(255, 255, 255, 0.15)' : '#f8fafc',
        border: isHeader ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid #e2e8f0',
        borderRadius: '20px',
        px: 0.8,
        py: 0.2,
        boxShadow: isHeader ? 'none' : '0 2px 6px rgba(0,0,0,0.05)',
      }}
    >
      {/* Zoom Out Button */}
      <Tooltip title="Zoom Out (Ctrl + -)">
        <span>
          <IconButton
            size="small"
            onClick={zoomOut}
            disabled={zoomLevel <= 50}
            sx={{
              color: isHeader ? '#ffffff' : '#334155',
              padding: '4px',
              '&:hover': {
                backgroundColor: isHeader ? 'rgba(255, 255, 255, 0.25)' : '#e2e8f0',
              },
              '&.Mui-disabled': {
                color: isHeader ? 'rgba(255, 255, 255, 0.4)' : '#cbd5e1',
              },
            }}
          >
            <ZoomOutIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </span>
      </Tooltip>

      {/* Zoom Level Indicator & Dropdown Trigger */}
      <Tooltip title="Click to choose zoom level (Ctrl + 0 to Reset)">
        <Chip
          label={`${zoomLevel}%`}
          size="small"
          onClick={handleOpenMenu}
          sx={{
            height: '22px',
            fontSize: '11px',
            fontWeight: 700,
            fontFamily: 'monospace',
            backgroundColor: isHeader
              ? zoomLevel !== 100
                ? '#f59e0b'
                : 'rgba(255, 255, 255, 0.22)'
              : zoomLevel !== 100
              ? '#1f4fb2'
              : '#e2e8f0',
            color: isHeader ? '#ffffff' : zoomLevel !== 100 ? '#ffffff' : '#1e293b',
            cursor: 'pointer',
            px: 0.5,
            transition: 'all 0.2s ease',
            '&:hover': {
              backgroundColor: isHeader ? 'rgba(255, 255, 255, 0.35)' : '#cbd5e1',
              transform: 'scale(1.05)',
            },
          }}
        />
      </Tooltip>

      {/* Zoom In Button */}
      <Tooltip title="Zoom In (Ctrl + =)">
        <span>
          <IconButton
            size="small"
            onClick={zoomIn}
            disabled={zoomLevel >= 200}
            sx={{
              color: isHeader ? '#ffffff' : '#334155',
              padding: '4px',
              '&:hover': {
                backgroundColor: isHeader ? 'rgba(255, 255, 255, 0.25)' : '#e2e8f0',
              },
              '&.Mui-disabled': {
                color: isHeader ? 'rgba(255, 255, 255, 0.4)' : '#cbd5e1',
              },
            }}
          >
            <ZoomInIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </span>
      </Tooltip>

      {/* Fullscreen Toggle */}
      <Box sx={{ width: '1px', height: '14px', backgroundColor: isHeader ? 'rgba(255,255,255,0.3)' : '#cbd5e1', mx: 0.3 }} />

      <Tooltip title={isFullscreen ? 'Exit Fullscreen (F11)' : 'Fullscreen Mode (F11)'}>
        <IconButton
          size="small"
          onClick={toggleFullscreen}
          sx={{
            color: isHeader ? '#ffffff' : '#334155',
            padding: '4px',
            backgroundColor: isFullscreen ? (isHeader ? 'rgba(255,255,255,0.3)' : '#dbeafe') : 'transparent',
            '&:hover': {
              backgroundColor: isHeader ? 'rgba(255, 255, 255, 0.25)' : '#e2e8f0',
            },
          }}
        >
          {isFullscreen ? <FullscreenExitIcon sx={{ fontSize: 18 }} /> : <FullscreenIcon sx={{ fontSize: 18 }} />}
        </IconButton>
      </Tooltip>

      {/* Zoom Level Selection Dropdown Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
        PaperProps={{
          sx: {
            width: 170,
            maxHeight: 320,
            borderRadius: 2,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            p: 0.5,
          },
        }}
      >
        <Box sx={{ px: 1.5, py: 0.8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase', fontSize: 10 }}>
            App Scale / Zoom
          </Typography>
          {zoomLevel !== 100 && (
            <Tooltip title="Reset to 100%">
              <IconButton size="small" onClick={resetZoom} sx={{ p: 0.2 }}>
                <RestartAltIcon sx={{ fontSize: 16, color: '#1f4fb2' }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        <Divider sx={{ my: 0.5 }} />

        {[50, 60, 75, 80, 85, 90, 100, 110, 125, 150, 175, 200].map((step) => (
          <MenuItem
            key={step}
            onClick={() => handleSelectZoom(step)}
            selected={zoomLevel === step}
            sx={{
              fontSize: 13,
              fontWeight: zoomLevel === step ? 800 : 500,
              py: 0.6,
              px: 1.5,
              borderRadius: 1,
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center',
              color: zoomLevel === step ? '#1f4fb2' : 'inherit',
            }}
          >
            <span>{step}%</span>
            {step === 100 && (
              <Typography variant="caption" sx={{ fontSize: 10, color: '#94a3b8', ml: 'auto' }}>
                Default
              </Typography>
            )}
          </MenuItem>
        ))}

        <Divider sx={{ my: 0.5 }} />
        <Box sx={{ px: 1.5, py: 0.5, textAlign: 'center' }}>
          <Typography variant="caption" sx={{ fontSize: 10, color: '#94a3b8', display: 'block' }}>
            Shortcuts:
          </Typography>
          <Typography variant="caption" sx={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>
            Ctrl + / - • Ctrl 0 • F11
          </Typography>
        </Box>
      </Menu>
    </Box>
  );
}
